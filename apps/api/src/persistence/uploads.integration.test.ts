import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse837P } from "@claim-checker/edi-parser";
import { PrismaClient, UploadStatus } from "@prisma/client";
import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createUpload,
  getUploadForOrganization,
  listClaimsForOrganizationUpload,
  persistParseFailure,
  persistParseSuccess,
} from "./uploads.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = join(apiRoot, "../..");
config({ path: join(apiRoot, ".env") });
config({ path: join(repoRoot, ".env") });

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../../../../fixtures/edi");

const prisma = new PrismaClient();

async function reset() {
  await prisma.auditLog.deleteMany();
  await prisma.validationFinding.deleteMany();
  await prisma.validationRun.deleteMany();
  await prisma.diagnosis.deleteMany();
  await prisma.claimLine.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

async function seedOrgs() {
  const orgA = await prisma.organization.create({
    data: { name: "Org A", slug: `org-a-${Date.now()}` },
  });
  const orgB = await prisma.organization.create({
    data: { name: "Org B", slug: `org-b-${Date.now()}` },
  });
  const userA = await prisma.user.create({
    data: {
      organizationId: orgA.id,
      email: `a-${Date.now()}@example.com`,
      passwordHash: "seed",
      role: "owner",
    },
  });
  const userB = await prisma.user.create({
    data: {
      organizationId: orgB.id,
      email: `b-${Date.now()}@example.com`,
      passwordHash: "seed",
      role: "owner",
    },
  });
  return { orgA, orgB, userA, userB };
}

describe("persistence (postgres)", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await reset();
  });

  it("persists normalized parse output with relationships", async () => {
    const { orgA, userA } = await seedOrgs();
    const upload = await createUpload(prisma, {
      organizationId: orgA.id,
      userId: userA.id,
      filename: "valid-single-claim.edi",
      byteSize: 100,
      contentHash: "sha256:test",
      storageKey: "uploads/test/valid-single-claim.edi",
      status: UploadStatus.processing,
    });

    const parsed = parse837P(readFileSync(join(fixtures, "valid-single-claim.edi"), "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const updated = await persistParseSuccess(prisma, {
      organizationId: orgA.id,
      uploadId: upload.id,
      actorUserId: userA.id,
      parsed: parsed.data,
    });

    // A1: parse success stays processing until validation run is persisted.
    expect(updated.status).toBe(UploadStatus.processing);
    expect(updated.igVersion).toBe("005010X222A1");
    expect(updated.parserErrors).toBeNull();

    const claims = await listClaimsForOrganizationUpload(prisma, orgA.id, upload.id);
    expect(claims).toHaveLength(1);
    expect(claims![0]!.claimControlNumber).toBe("CLM-DEMO-1001");
    expect(claims![0]!.diagnoses).toHaveLength(1);
    expect(claims![0]!.lines).toHaveLength(1);
    expect(claims![0]!.lines[0]!.procedureCode).toBe("99213");
    expect(Number(claims![0]!.totalCharge?.toString())).toBe(100);

    const audits = await prisma.auditLog.findMany({ where: { organizationId: orgA.id } });
    expect(audits.some((a) => a.action === "upload.parse.completed")).toBe(true);
    expect(JSON.stringify(audits)).not.toMatch(/ISA\*/);
  });

  it("persists parser failures without creating claims", async () => {
    const { orgA, userA } = await seedOrgs();
    const upload = await createUpload(prisma, {
      organizationId: orgA.id,
      userId: userA.id,
      filename: "bad.edi",
      byteSize: 10,
      contentHash: "sha256:bad",
      storageKey: "uploads/test/bad.edi",
    });

    const parsed = parse837P(readFileSync(join(fixtures, "unsupported-version.edi"), "utf8"));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    const updated = await persistParseFailure(prisma, {
      organizationId: orgA.id,
      uploadId: upload.id,
      actorUserId: userA.id,
      errors: parsed.errors,
    });

    expect(updated.status).toBe(UploadStatus.failed);
    expect(updated.errorSummary).toBeTruthy();
    expect(updated.parserErrors).toBeTruthy();
    expect(JSON.stringify(updated.parserErrors)).not.toMatch(/ISA\*/);

    const claims = await listClaimsForOrganizationUpload(prisma, orgA.id, upload.id);
    expect(claims).toEqual([]);
  });

  it("enforces cross-organization isolation on reads", async () => {
    const { orgA, orgB, userA } = await seedOrgs();
    const upload = await createUpload(prisma, {
      organizationId: orgA.id,
      userId: userA.id,
      filename: "a.edi",
      byteSize: 1,
      contentHash: "h",
      storageKey: "uploads/a.edi",
    });

    const fromB = await getUploadForOrganization(prisma, orgB.id, upload.id);
    expect(fromB).toBeNull();

    const claimsFromB = await listClaimsForOrganizationUpload(prisma, orgB.id, upload.id);
    expect(claimsFromB).toBeNull();

    await expect(
      persistParseFailure(prisma, {
        organizationId: orgB.id,
        uploadId: upload.id,
        errors: [
          {
            code: "PARSE_EMPTY",
            message: "x",
            suggestedAction: "y",
          },
        ],
      }),
    ).rejects.toThrow(/not found for organization/i);
  });

  it("rolls back the transaction when persistence fails mid-flight", async () => {
    const { orgA, userA } = await seedOrgs();
    const upload = await createUpload(prisma, {
      organizationId: orgA.id,
      userId: userA.id,
      filename: "valid-single-claim.edi",
      byteSize: 100,
      contentHash: "sha256:rollback",
      storageKey: "uploads/test/rollback.edi",
      status: UploadStatus.processing,
    });

    const parsed = parse837P(readFileSync(join(fixtures, "valid-single-claim.edi"), "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // Duplicate claimControlNumber in one batch should violate @@unique mid-transaction
    const broken = {
      ...parsed.data,
      claims: [parsed.data.claims[0]!, { ...parsed.data.claims[0]! }],
    };

    await expect(
      persistParseSuccess(prisma, {
        organizationId: orgA.id,
        uploadId: upload.id,
        parsed: broken,
      }),
    ).rejects.toThrow();

    const after = await getUploadForOrganization(prisma, orgA.id, upload.id);
    expect(after?.status).toBe(UploadStatus.processing);
    expect(after?.igVersion).toBeNull();

    const claimCount = await prisma.claim.count({ where: { uploadId: upload.id } });
    expect(claimCount).toBe(0);

    const auditCount = await prisma.auditLog.count({
      where: { resourceId: upload.id, action: "upload.parse.completed" },
    });
    expect(auditCount).toBe(0);
  });

  it("cascades claim deletion when an upload is deleted", async () => {
    const { orgA, userA } = await seedOrgs();
    const upload = await createUpload(prisma, {
      organizationId: orgA.id,
      userId: userA.id,
      filename: "valid-single-claim.edi",
      byteSize: 100,
      contentHash: "sha256:cascade",
      storageKey: "uploads/test/cascade.edi",
    });

    const parsed = parse837P(readFileSync(join(fixtures, "valid-single-claim.edi"), "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    await persistParseSuccess(prisma, {
      organizationId: orgA.id,
      uploadId: upload.id,
      parsed: parsed.data,
    });

    await prisma.upload.delete({ where: { id: upload.id } });

    expect(await prisma.claim.count({ where: { uploadId: upload.id } })).toBe(0);
    expect(await prisma.claimLine.count()).toBe(0);
    expect(await prisma.diagnosis.count()).toBe(0);
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse837P } from "@claim-checker/edi-parser";
import { validateClaims } from "@claim-checker/validation-rules";
import { config } from "dotenv";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./db/client.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(apiRoot, "../..");
config({ path: join(apiRoot, ".env") });
config({ path: join(repoRoot, ".env") });

const fixtures = join(repoRoot, "fixtures/edi");
const app = createApp();

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

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function register(slug = unique("org")) {
  const email = `${unique("user")}@example.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({
      organizationName: `Org ${slug}`,
      organizationSlug: slug,
      email,
      password: "password123",
    })
    .expect(201);
  return {
    email,
    token: res.body.token as string,
    orgId: res.body.user.organization.id as string,
  };
}

describe("HTTP API", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await reset();
  });

  it("registers, logs in with bearer, and returns current user", async () => {
    const { email, token } = await register(unique("auth"));
    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(me.body.user.email).toBe(email);

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "password123" })
      .expect(200);

    await request(app).get("/api/v1/auth/me").expect(401);
  });

  it("rejects unauthenticated upload access", async () => {
    await request(app).get("/api/v1/uploads").expect(401);
  });

  it("uploads a valid EDI, validates, and returns findings/csv", async () => {
    const { token } = await register(unique("up"));
    const file = readFileSync(join(fixtures, "valid-single-claim.edi"));

    const created = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", file, "valid-single-claim.edi")
      .expect(201);

    expect(created.body.upload.status).toBe("completed");
    expect(created.body.validationRun?.ruleSetVersion).toBeTruthy();

    const uploadId = created.body.upload.id as string;
    const claims = await request(app)
      .get(`/api/v1/uploads/${uploadId}/claims`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(claims.body.claims.length).toBe(1);

    const runId = created.body.validationRun.id as string;
    const findings = await request(app)
      .get(`/api/v1/validation-runs/${runId}/findings`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(findings.body.findings)).toBe(true);

    const csv = await request(app)
      .get(`/api/v1/validation-runs/${runId}/export.csv`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect(csv.text.startsWith("ruleId,severity,")).toBe(true);
  });

  it("parses multi-claim-errors fixture and persists expected validation findings", async () => {
    const { token } = await register(unique("merr"));
    const file = readFileSync(join(fixtures, "multi-claim-errors.edi"));
    const parsed = parse837P(file.toString("utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const expected = validateClaims(parsed.data);

    const created = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", file, "multi-claim-errors.edi")
      .expect(201);

    // Processing status stays completed when parse succeeds — separate from findings.
    expect(created.body.upload.status).toBe("completed");
    expect(created.body.validationRun).toBeTruthy();
    expect(created.body.validationRun.ruleSetVersion).toBe(expected.ruleSetVersion);
    expect(created.body.validationRun.summary).toEqual(expected.summary);

    const uploadId = created.body.upload.id as string;
    const claims = await request(app)
      .get(`/api/v1/uploads/${uploadId}/claims`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(claims.body.claims).toHaveLength(2);

    const runRes = await request(app)
      .get(`/api/v1/uploads/${uploadId}/validation-run`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(runRes.body.validationRun).toBeTruthy();
    expect(runRes.body.validationRun.findingCount).toBe(expected.findings.length);
    expect(runRes.body.validationRun.summaryCounts).toEqual(expected.summary);

    const list = await request(app)
      .get("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const listed = list.body.uploads.find((u: { id: string }) => u.id === uploadId);
    expect(listed.claimCount).toBe(2);
    expect(listed.validationSummary).toEqual({
      error: expected.summary.error,
      warning: expected.summary.warning,
      info: expected.summary.info,
      findingCount: expected.findings.length,
    });

    const runId = created.body.validationRun.id as string;
    const findings = await request(app)
      .get(`/api/v1/validation-runs/${runId}/findings`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(findings.body.findings).toHaveLength(expected.findings.length);
    expect(findings.body.findings.map((f: { ruleId: string }) => f.ruleId).sort()).toEqual(
      expected.findings.map((f) => f.ruleId).sort(),
    );
  });

  it("isolates uploads across organizations", async () => {
    const a = await register(unique("a"));
    const b = await register(unique("b"));
    const file = readFileSync(join(fixtures, "valid-single-claim.edi"));

    const created = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${a.token}`)
      .attach("file", file, "a.edi")
      .expect(201);

    const uploadId = created.body.upload.id as string;
    await request(app)
      .get(`/api/v1/uploads/${uploadId}`)
      .set("Authorization", `Bearer ${b.token}`)
      .expect(404);

    await request(app)
      .get(`/api/v1/validation-runs/${created.body.validationRun.id}/findings`)
      .set("Authorization", `Bearer ${b.token}`)
      .expect(404);
  });

  it("stores parser failures without inventing validation success", async () => {
    const { token } = await register(unique("fail"));
    const file = readFileSync(join(fixtures, "unsupported-version.edi"));

    const created = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", file, "bad.edi")
      .expect(201);

    expect(created.body.upload.status).toBe("failed");
    expect(created.body.validationRun).toBeNull();
    expect(created.body.upload.parserErrors).toBeTruthy();
  });

  it("rejects malformed / oversized / wrong-type uploads", async () => {
    const { token } = await register(unique("badfile"));

    await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("nope"), "notes.pdf")
      .expect(400);

    await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.alloc(0), "empty.edi")
      .expect(400);

    const huge = Buffer.alloc(2_097_153, 0x41);
    await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", huge, "huge.edi")
      .expect(413);
  });

  it("lists enabled rules", async () => {
    const { token } = await register(unique("rules"));
    const res = await request(app)
      .get("/api/v1/rules")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.rules.length).toBeGreaterThan(0);
    expect(res.body.ruleSetVersion).toBeTruthy();
  });

  it("health endpoint reports database status", async () => {
    const res = await request(app).get("/api/v1/health").expect(200);
    expect(res.body.database).toBe("up");
  });
});

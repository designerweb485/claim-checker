/**
 * Milestone 7 — behavior-backed E2E / security checks.
 * These assert outcomes (404/401/escaped CSV/no EDI leak), not merely middleware presence.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RULE_SET_VERSION } from "@claim-checker/validation-rules";
import { FindingSeverity, ValidationRunStatus } from "@prisma/client";
import { config } from "dotenv";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { appConfig } from "./config.js";
import { prisma } from "./db/client.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(apiRoot, "../..");
config({ path: join(apiRoot, ".env") });
config({ path: join(repoRoot, ".env") });

const fixtures = join(repoRoot, "fixtures/edi");
const app = createApp();
const ISA_LEAK = /ISA\*|GS\*HC|CLM\*CLM-DEMO/;

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
    password: "password123",
    token: res.body.token as string,
    orgId: res.body.user.organization.id as string,
    userId: res.body.user.id as string,
  };
}

function assertNoRawEdi(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(ISA_LEAK);
}

describe("Milestone 7 security / E2E workflows", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await reset();
  });

  it("1) register → login → me → logout revokes the prior token", async () => {
    const agent = request.agent(app);
    const slug = unique("authflow");
    const email = `${unique("auth")}@example.com`;

    const registered = await agent
      .post("/api/v1/auth/register")
      .send({
        organizationName: "Auth Flow Org",
        organizationSlug: slug,
        email,
        password: "password123",
      })
      .expect(201);
    const token = registered.body.token as string;

    await agent.get("/api/v1/auth/me").expect(200);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "wrong-password" })
      .expect(401);
    expect(login.body.error?.code).toBe("INVALID_CREDENTIALS");

    await agent.post("/api/v1/auth/login").send({ email, password: "password123" }).expect(200);
    await agent.get("/api/v1/auth/me").expect(200);

    await agent.post("/api/v1/auth/logout").expect(204);

    // Cookie session cleared
    await agent.get("/api/v1/auth/me").expect(401);

    // Prior bearer token revoked via tokenVersion bump
    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);

    // Fresh login issues a working token again
    const again = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "password123" })
      .expect(200);
    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${again.body.token}`)
      .expect(200);
  });

  it("2) upload valid 837P, inspect findings, claim detail, and persisted rule-set version", async () => {
    const { token } = await register(unique("valid"));
    const file = readFileSync(join(fixtures, "valid-single-claim.edi"));

    const created = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", file, "valid-single-claim.edi")
      .expect(201);

    assertNoRawEdi(created.body);
    expect(created.body.upload.status).toBe("completed");
    expect(created.body.validationRun.ruleSetVersion).toBe(RULE_SET_VERSION);

    const uploadId = created.body.upload.id as string;
    const runId = created.body.validationRun.id as string;

    const runRes = await request(app)
      .get(`/api/v1/uploads/${uploadId}/validation-run`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(runRes.body.validationRun.ruleSetVersion).toBe(RULE_SET_VERSION);

    const findings = await request(app)
      .get(`/api/v1/validation-runs/${runId}/findings`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    assertNoRawEdi(findings.body);
    expect(findings.body.ruleSetVersion).toBe(RULE_SET_VERSION);

    const persisted = await prisma.validationRun.findFirst({
      where: { id: runId },
      include: { findings: true },
    });
    expect(persisted?.ruleSetVersion).toBe(RULE_SET_VERSION);
    expect(persisted?.status).toBe(ValidationRunStatus.completed);
    expect(persisted?.findings.length).toBe(findings.body.findings.length);

    const claims = await request(app)
      .get(`/api/v1/uploads/${uploadId}/claims`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const claimId = claims.body.claims[0].id as string;
    const claim = await request(app)
      .get(`/api/v1/claims/${claimId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    assertNoRawEdi(claim.body);
    expect(claim.body.claim.claimControlNumber).toBe("CLM-DEMO-1001");
  });

  it("3) malformed and unsupported uploads return actionable structured errors", async () => {
    const { token } = await register(unique("bad"));

    const cases = [
      { file: "unsupported-version.edi", code: "PARSE_UNSUPPORTED_VERSION" },
      { file: "control-number-mismatch.edi", code: "PARSE_ENVELOPE_ISA_IEA_MISMATCH" },
      { file: "malformed-no-isa.txt", code: "PARSE_ISA_MISSING" },
      { file: "se-count-mismatch.edi", code: "PARSE_ENVELOPE_SE_COUNT" },
    ] as const;

    for (const c of cases) {
      const buf = readFileSync(join(fixtures, c.file));
      const res = await request(app)
        .post("/api/v1/uploads")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", buf, c.file)
        .expect(201);

      expect(res.body.upload.status).toBe("failed");
      expect(res.body.validationRun).toBeNull();
      expect(res.body.upload.errorSummary).toBeTruthy();
      const codes = (res.body.upload.parserErrors as Array<{ code: string; suggestedAction?: string }>).map(
        (e) => e.code,
      );
      expect(codes).toContain(c.code);
      const err = (res.body.upload.parserErrors as Array<{ suggestedAction: string }>).find(
        (e) => e.suggestedAction,
      );
      expect(err?.suggestedAction.length).toBeGreaterThan(8);
      assertNoRawEdi(res.body);
    }
  });

  it("4) cross-organization access is denied for uploads, claims, findings, and CSV", async () => {
    const a = await register(unique("org-a"));
    const b = await register(unique("org-b"));
    const file = readFileSync(join(fixtures, "valid-single-claim.edi"));

    const created = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${a.token}`)
      .attach("file", file, "a.edi")
      .expect(201);

    const uploadId = created.body.upload.id as string;
    const runId = created.body.validationRun.id as string;
    const claims = await request(app)
      .get(`/api/v1/uploads/${uploadId}/claims`)
      .set("Authorization", `Bearer ${a.token}`)
      .expect(200);
    const claimId = claims.body.claims[0].id as string;

    await request(app)
      .get(`/api/v1/uploads/${uploadId}`)
      .set("Authorization", `Bearer ${b.token}`)
      .expect(404);
    await request(app)
      .get(`/api/v1/uploads/${uploadId}/claims`)
      .set("Authorization", `Bearer ${b.token}`)
      .expect(404);
    await request(app)
      .get(`/api/v1/claims/${claimId}`)
      .set("Authorization", `Bearer ${b.token}`)
      .expect(404);
    await request(app)
      .get(`/api/v1/validation-runs/${runId}/findings`)
      .set("Authorization", `Bearer ${b.token}`)
      .expect(404);
    await request(app)
      .get(`/api/v1/validation-runs/${runId}/export.csv`)
      .set("Authorization", `Bearer ${b.token}`)
      .expect(404);

    const listB = await request(app)
      .get("/api/v1/uploads")
      .set("Authorization", `Bearer ${b.token}`)
      .expect(200);
    expect(listB.body.uploads.every((u: { id: string }) => u.id !== uploadId)).toBe(true);
  });

  it("5) findings and rule-set version survive reload from the database", async () => {
    const { token } = await register(unique("persist"));
    // Force at least one finding via charge mismatch fixture content is valid;
    // use valid file then assert DB round-trip of run metadata + findings array shape.
    const file = readFileSync(join(fixtures, "valid-multi-claim.edi"));
    const created = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", file, "multi.edi")
      .expect(201);

    const runId = created.body.validationRun.id as string;
    const first = await request(app)
      .get(`/api/v1/validation-runs/${runId}/findings`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const dbRun = await prisma.validationRun.findUniqueOrThrow({
      where: { id: runId },
      include: { findings: true },
    });
    expect(dbRun.ruleSetVersion).toBe(RULE_SET_VERSION);
    expect(dbRun.findings.length).toBe(first.body.findings.length);

    const second = await request(app)
      .get(`/api/v1/validation-runs/${runId}/findings`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(second.body).toEqual(first.body);
  });

  it("6) CSV formula-injection is neutralized and raw EDI never appears in export/API/audit", async () => {
    const { token, orgId } = await register(unique("csv"));
    const file = readFileSync(join(fixtures, "valid-single-claim.edi"));
    const created = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", file, "csv.edi")
      .expect(201);

    const runId = created.body.validationRun.id as string;
    await prisma.validationFinding.create({
      data: {
        validationRunId: runId,
        ruleId: "TEST-INJECT",
        severity: FindingSeverity.warning,
        message: "=cmd|'/C calc'!A0",
        suggestedAction: "+2+3",
      },
    });

    const csv = await request(app)
      .get(`/api/v1/validation-runs/${runId}/export.csv`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(csv.text).toContain("'=cmd|'/C calc'!A0");
    expect(csv.text).toContain("'+2+3");
    expect(csv.text).not.toMatch(ISA_LEAK);
    assertNoRawEdi(created.body);

    const audits = await prisma.auditLog.findMany({ where: { organizationId: orgId } });
    for (const row of audits) {
      assertNoRawEdi(row.metadata);
      expect(JSON.stringify(row)).not.toMatch(ISA_LEAK);
    }
  });

  it("7) expired/invalid sessions, empty history, failed requests, and repeated uploads", async () => {
    const { token, userId, orgId, email } = await register(unique("edge"));

    // Empty history for a brand-new org after only registering (no uploads yet — but register already used;
    // use a second org)
    const emptyOrg = await register(unique("empty"));
    const emptyList = await request(app)
      .get("/api/v1/uploads")
      .set("Authorization", `Bearer ${emptyOrg.token}`)
      .expect(200);
    expect(emptyList.body.uploads).toEqual([]);

    const expired = jwt.sign(
      {
        sub: userId,
        orgId,
        email,
        role: "owner",
        tv: 0,
      },
      appConfig.jwtSecret,
      { expiresIn: -10 },
    );
    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${expired}`)
      .expect(401);

    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not-a-jwt")
      .expect(401);

    await request(app)
      .get(`/api/v1/uploads/${"00000000-0000-4000-8000-000000000099"}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);

    const file = readFileSync(join(fixtures, "valid-single-claim.edi"));
    const first = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", file, "repeat.edi")
      .expect(201);
    const second = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", file, "repeat.edi")
      .expect(201);

    expect(first.body.upload.id).not.toBe(second.body.upload.id);
    expect(first.body.upload.status).toBe("completed");
    expect(second.body.upload.status).toBe("completed");

    const history = await request(app)
      .get("/api/v1/uploads")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(history.body.uploads.length).toBe(2);
  });
});

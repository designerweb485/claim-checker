import type { Finding } from "@claim-checker/validation-rules";
import {
  FindingSeverity,
  Prisma,
  type PrismaClient,
  ValidationRunStatus,
} from "@prisma/client";

function toSeverity(s: Finding["severity"]): FindingSeverity {
  if (s === "warning") return FindingSeverity.warning;
  if (s === "info") return FindingSeverity.info;
  return FindingSeverity.error;
}

/**
 * Persist a validation run and findings for an org-owned upload.
 * Does not modify parser persistence behavior.
 */
export async function persistValidationRun(
  db: PrismaClient,
  input: {
    organizationId: string;
    uploadId: string;
    ruleSetVersion: string;
    findings: Finding[];
    summary: { error: number; warning: number; info: number };
    actorUserId?: string;
  },
) {
  const { organizationId, uploadId, ruleSetVersion, findings, summary, actorUserId } = input;

  return db.$transaction(async (tx) => {
    const upload = await tx.upload.findFirst({
      where: { id: uploadId, organizationId },
      include: {
        claims: { include: { lines: true } },
      },
    });
    if (!upload) {
      throw new Error("Upload not found for organization");
    }

    await tx.validationFinding.deleteMany({
      where: { validationRun: { uploadId, organizationId } },
    });
    await tx.validationRun.deleteMany({ where: { uploadId, organizationId } });

    const claimByControl = new Map(
      upload.claims.map((c) => [c.claimControlNumber, c] as const),
    );

    const now = new Date();
    const run = await tx.validationRun.create({
      data: {
        organizationId,
        uploadId,
        ruleSetVersion,
        status: ValidationRunStatus.completed,
        startedAt: now,
        finishedAt: now,
        summaryCounts: summary,
      },
    });

    for (const f of findings) {
      const claim = f.claimControlNumber
        ? claimByControl.get(f.claimControlNumber)
        : undefined;
      const line =
        claim && f.lineNumber !== undefined
          ? claim.lines.find((l) => l.lineNumber === f.lineNumber)
          : undefined;

      await tx.validationFinding.create({
        data: {
          validationRunId: run.id,
          claimId: claim?.id ?? null,
          claimLineId: line?.id ?? null,
          ruleId: f.ruleId,
          severity: toSeverity(f.severity),
          message: f.message,
          suggestedAction: f.suggestedAction,
          sourceLocation: (f.sourceLocation ?? undefined) as Prisma.InputJsonValue | undefined,
          evidence: {
            ...(f.evidence ?? {}),
            ruleVersion: f.ruleVersion,
            category: f.category,
          } as Prisma.InputJsonValue,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId: actorUserId ?? null,
        action: "upload.validation.completed",
        resourceType: "validation_run",
        resourceId: run.id,
        metadata: {
          uploadId,
          ruleSetVersion,
          findingCount: findings.length,
          summary,
        },
      },
    });

    return run;
  });
}

export async function getValidationRunForOrganizationUpload(
  db: PrismaClient,
  organizationId: string,
  uploadId: string,
) {
  return db.validationRun.findFirst({
    where: { organizationId, uploadId },
    orderBy: { createdAt: "desc" },
    include: {
      findings: {
        orderBy: [{ severity: "asc" }, { ruleId: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function getValidationRunForOrganization(
  db: PrismaClient,
  organizationId: string,
  runId: string,
) {
  return db.validationRun.findFirst({
    where: { id: runId, organizationId },
    include: {
      findings: {
        orderBy: [{ severity: "asc" }, { ruleId: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

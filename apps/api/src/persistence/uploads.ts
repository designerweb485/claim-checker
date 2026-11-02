import { Prisma, type PrismaClient, UploadStatus } from "@prisma/client";
import type {
  CreateUploadInput,
  PersistParseFailureInput,
  PersistParseSuccessInput,
} from "./types.js";

type Db = PrismaClient | Prisma.TransactionClient;

function orgWhere(organizationId: string, uploadId: string) {
  return { id: uploadId, organizationId };
}

function billingProviderName(claim: PersistParseSuccessInput["parsed"]["claims"][number]): string | null {
  const p = claim.billingProvider;
  if (!p) return null;
  if (p.organizationName) return p.organizationName;
  const joined = [p.lastName, p.firstName].filter(Boolean).join(", ");
  return joined || null;
}

/** Create an upload metadata row. Raw EDI must live only at storageKey. */
export async function createUpload(db: Db, input: CreateUploadInput) {
  return db.upload.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      filename: input.filename,
      byteSize: input.byteSize,
      contentHash: input.contentHash,
      storageKey: input.storageKey,
      status: input.status ?? UploadStatus.pending,
    },
  });
}

/** Org-scoped upload read. Returns null when missing or wrong org. */
export async function getUploadForOrganization(
  db: Db,
  organizationId: string,
  uploadId: string,
) {
  return db.upload.findFirst({
    where: orgWhere(organizationId, uploadId),
  });
}

/** Org-scoped claims for an upload (with lines + diagnoses). */
export async function listClaimsForOrganizationUpload(
  db: Db,
  organizationId: string,
  uploadId: string,
) {
  const upload = await getUploadForOrganization(db, organizationId, uploadId);
  if (!upload) return null;

  return db.claim.findMany({
    where: { organizationId, uploadId },
    include: {
      lines: { orderBy: { lineNumber: "asc" } },
      diagnoses: { orderBy: { sequence: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Persist a successful parse into normalized tables.
 * Leaves status as `processing` until validation is persisted (A1).
 * Runs in a single transaction. Does not store raw EDI.
 */
export async function persistParseSuccess(
  db: PrismaClient,
  input: PersistParseSuccessInput,
) {
  const { organizationId, uploadId, actorUserId, parsed } = input;

  return db.$transaction(async (tx) => {
    const upload = await tx.upload.findFirst({
      where: orgWhere(organizationId, uploadId),
    });
    if (!upload) {
      throw new Error("Upload not found for organization");
    }

    await tx.claim.deleteMany({ where: { uploadId, organizationId } });

    for (const claim of parsed.claims) {
      await tx.claim.create({
        data: {
          organizationId,
          uploadId,
          claimControlNumber: claim.claimControlNumber,
          totalCharge: claim.totalCharge
            ? new Prisma.Decimal(claim.totalCharge)
            : null,
          placeOfServiceCode: claim.placeOfServiceCode ?? null,
          billingProviderNpi: claim.billingProvider?.npi ?? null,
          billingProviderName: billingProviderName(claim),
          subscriberMemberId: claim.subscriber?.memberId ?? null,
          subscriberLastName: claim.subscriber?.lastName ?? null,
          subscriberFirstName: claim.subscriber?.firstName ?? null,
          sourceLocation: claim.source as Prisma.InputJsonValue,
          diagnoses: {
            create: claim.diagnoses.map((d) => ({
              sequence: d.sequence,
              code: d.code,
              codeSet: d.codeSet,
              sourceLocation: d.source as Prisma.InputJsonValue,
            })),
          },
          lines: {
            create: claim.serviceLines.map((line) => ({
              lineNumber: line.lineNumber,
              procedureCode: line.procedureCode ?? null,
              procedureCodeQualifier: line.procedureCodeQualifier ?? null,
              modifiers: line.modifiers ?? [],
              charge: line.charge ? new Prisma.Decimal(line.charge) : null,
              unitCode: line.unitCode ?? null,
              units: line.units ?? null,
              diagnosisPointers: line.diagnosisPointers,
              serviceDate: line.serviceDate ?? null,
              sourceLocation: line.source as Prisma.InputJsonValue,
            })),
          },
        },
      });
    }

    const updated = await tx.upload.update({
      where: { id: uploadId },
      data: {
        // Stay processing until validation run persists — avoids completed-without-run.
        status: UploadStatus.processing,
        errorSummary: null,
        parserErrors: Prisma.DbNull,
        transactionSet: parsed.transactionSetCode,
        igVersion: parsed.implementationGuide,
        interchangeControlNumber: parsed.interchangeControlNumber,
        groupControlNumber: parsed.groupControlNumber,
        transactionControlNumber: parsed.transactionControlNumber,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId: actorUserId ?? null,
        action: "upload.parse.completed",
        resourceType: "upload",
        resourceId: uploadId,
        metadata: {
          claimCount: parsed.claims.length,
          igVersion: parsed.implementationGuide,
        },
      },
    });

    return updated;
  });
}

/** Mark upload completed after a validation run has been persisted. */
export async function markUploadCompleted(
  db: Db,
  organizationId: string,
  uploadId: string,
) {
  const result = await db.upload.updateMany({
    where: orgWhere(organizationId, uploadId),
    data: { status: UploadStatus.completed, errorSummary: null },
  });
  if (result.count === 0) {
    throw new Error("Upload not found for organization");
  }
  return getUploadForOrganization(db, organizationId, uploadId);
}

/**
 * Mark upload failed when validation cannot be persisted.
 * Never leaves status as completed without a validation run.
 */
export async function persistValidationFailure(
  db: PrismaClient,
  input: {
    organizationId: string;
    uploadId: string;
    actorUserId?: string;
    message?: string;
  },
) {
  const message =
    input.message ?? "Validation could not be completed. Please retry the upload.";

  return db.$transaction(async (tx) => {
    const upload = await tx.upload.findFirst({
      where: orgWhere(input.organizationId, input.uploadId),
    });
    if (!upload) {
      throw new Error("Upload not found for organization");
    }

    const updated = await tx.upload.update({
      where: { id: input.uploadId },
      data: {
        status: UploadStatus.failed,
        errorSummary: message,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId ?? null,
        action: "upload.validation.failed",
        resourceType: "upload",
        resourceId: input.uploadId,
        metadata: { reason: "validation_persist_failed" },
      },
    });

    return updated;
  });
}

/**
 * Persist parser failure on the upload. Stores structured errors only — never raw EDI.
 */
export async function persistParseFailure(
  db: PrismaClient,
  input: PersistParseFailureInput,
) {
  const { organizationId, uploadId, actorUserId, errors } = input;

  return db.$transaction(async (tx) => {
    const upload = await tx.upload.findFirst({
      where: orgWhere(organizationId, uploadId),
    });
    if (!upload) {
      throw new Error("Upload not found for organization");
    }

    await tx.claim.deleteMany({ where: { uploadId, organizationId } });

    const summary =
      errors[0]?.message ?? "EDI parse failed with one or more errors.";

    const updated = await tx.upload.update({
      where: { id: uploadId },
      data: {
        status: UploadStatus.failed,
        errorSummary: summary,
        parserErrors: errors as unknown as Prisma.InputJsonValue,
        transactionSet: null,
        igVersion: null,
        interchangeControlNumber: null,
        groupControlNumber: null,
        transactionControlNumber: null,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId: actorUserId ?? null,
        action: "upload.parse.failed",
        resourceType: "upload",
        resourceId: uploadId,
        metadata: {
          errorCodes: errors.map((e) => e.code),
        },
      },
    });

    return updated;
  });
}

/** Mark upload processing (org-scoped). */
export async function markUploadProcessing(
  db: Db,
  organizationId: string,
  uploadId: string,
) {
  const result = await db.upload.updateMany({
    where: orgWhere(organizationId, uploadId),
    data: { status: UploadStatus.processing },
  });
  if (result.count === 0) {
    throw new Error("Upload not found for organization");
  }
  return getUploadForOrganization(db, organizationId, uploadId);
}

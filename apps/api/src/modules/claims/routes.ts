import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { requireAuth } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/errors.js";

export const claimsRouter: ExpressRouter = Router();
claimsRouter.use(requireAuth);

claimsRouter.get("/:claimId", async (req, res, next) => {
  try {
    const claimId = z.string().uuid().parse(req.params.claimId);
    const claim = await prisma.claim.findFirst({
      where: { id: claimId, organizationId: req.user!.organizationId },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        diagnoses: { orderBy: { sequence: "asc" } },
        findings: {
          orderBy: [{ severity: "asc" }, { ruleId: "asc" }],
        },
      },
    });
    if (!claim) throw new HttpError(404, "Claim not found", "NOT_FOUND");

    res.json({
      claim: {
        id: claim.id,
        uploadId: claim.uploadId,
        claimControlNumber: claim.claimControlNumber,
        totalCharge: claim.totalCharge?.toString() ?? null,
        placeOfServiceCode: claim.placeOfServiceCode,
        billingProviderNpi: claim.billingProviderNpi,
        billingProviderName: claim.billingProviderName,
        subscriberMemberId: claim.subscriberMemberId,
        subscriberLastName: claim.subscriberLastName,
        subscriberFirstName: claim.subscriberFirstName,
        sourceLocation: claim.sourceLocation,
        diagnoses: claim.diagnoses.map((d) => ({
          id: d.id,
          sequence: d.sequence,
          code: d.code,
          codeSet: d.codeSet,
          sourceLocation: d.sourceLocation,
        })),
        lines: claim.lines.map((l) => ({
          id: l.id,
          lineNumber: l.lineNumber,
          procedureCode: l.procedureCode,
          procedureCodeQualifier: l.procedureCodeQualifier,
          modifiers: l.modifiers,
          charge: l.charge?.toString() ?? null,
          unitCode: l.unitCode,
          units: l.units,
          diagnosisPointers: l.diagnosisPointers,
          serviceDate: l.serviceDate,
          sourceLocation: l.sourceLocation,
        })),
        findings: claim.findings.map((f) => ({
          id: f.id,
          ruleId: f.ruleId,
          severity: f.severity,
          message: f.message,
          suggestedAction: f.suggestedAction,
          sourceLocation: f.sourceLocation,
          claimLineId: f.claimLineId,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

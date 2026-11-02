import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { toCsv } from "../../csv.js";
import { prisma } from "../../db/client.js";
import { requireAuth } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/errors.js";
import { getValidationRunForOrganization } from "../../persistence/validation.js";

export const validationRouter: ExpressRouter = Router();
validationRouter.use(requireAuth);

validationRouter.get("/:runId/findings", async (req, res, next) => {
  try {
    const runId = z.string().uuid().parse(req.params.runId);
    const run = await getValidationRunForOrganization(
      prisma,
      req.user!.organizationId,
      runId,
    );
    if (!run) throw new HttpError(404, "Validation run not found", "NOT_FOUND");

    res.json({
      validationRunId: run.id,
      ruleSetVersion: run.ruleSetVersion,
      summaryCounts: run.summaryCounts,
      findings: run.findings.map((f) => ({
        id: f.id,
        ruleId: f.ruleId,
        severity: f.severity,
        message: f.message,
        suggestedAction: f.suggestedAction,
        sourceLocation: f.sourceLocation,
        claimId: f.claimId,
        claimLineId: f.claimLineId,
        evidence: f.evidence,
      })),
    });
  } catch (e) {
    next(e);
  }
});

validationRouter.get("/:runId/export.csv", async (req, res, next) => {
  try {
    const runId = z.string().uuid().parse(req.params.runId);
    const run = await getValidationRunForOrganization(
      prisma,
      req.user!.organizationId,
      runId,
    );
    if (!run) throw new HttpError(404, "Validation run not found", "NOT_FOUND");

    const claimIds = [
      ...new Set(run.findings.map((f) => f.claimId).filter(Boolean)),
    ] as string[];
    const claims = await prisma.claim.findMany({
      where: { organizationId: req.user!.organizationId, id: { in: claimIds } },
      select: { id: true, claimControlNumber: true },
    });
    const controlById = new Map(claims.map((c) => [c.id, c.claimControlNumber]));

    const csv = toCsv(
      ["ruleId", "severity", "claimControlNumber", "message", "suggestedAction"],
      run.findings.map((f) => [
        f.ruleId,
        f.severity,
        f.claimId ? controlById.get(f.claimId) ?? "" : "",
        f.message,
        f.suggestedAction ?? "",
      ]),
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="validation-run-${run.id}.csv"`,
    );
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

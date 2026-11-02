import { finding } from "../finding.js";
import type { RuleDefinition } from "../types.js";

export const clm003DuplicateControl: RuleDefinition = {
  id: "CLM-003",
  title: "Duplicate claim control numbers",
  description: "Warn when the same claim control number appears more than once in the batch.",
  severity: "warning",
  category: "duplicate",
  version: "1.0.0",
  applicability:
    "Batch-level heuristic warning only. Not a payer duplicate-claim or COB determination.",
  evaluate(ctx) {
    const key = ctx.claim.claimControlNumber?.trim();
    if (!key) return [];
    const matches = ctx.allClaims.filter((c) => c.claimControlNumber?.trim() === key);
    if (matches.length < 2) return [];
    // Emit once per duplicate occurrence after the first
    const firstIndex = ctx.allClaims.findIndex((c) => c.claimControlNumber?.trim() === key);
    if (ctx.claimIndex === firstIndex) return [];
    return [
      finding(this, ctx, {
        message: `Claim control number "${key}" is duplicated in this upload (${matches.length} occurrences).`,
        suggestedAction: "Verify whether duplicate CLM01 values are intentional; correct if accidental.",
        sourceLocation: ctx.claim.source,
        evidence: { occurrences: matches.length },
      }),
    ];
  },
};

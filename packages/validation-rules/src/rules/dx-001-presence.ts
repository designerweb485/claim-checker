import { finding } from "../finding.js";
import type { RuleDefinition } from "../types.js";

export const dx001Presence: RuleDefinition = {
  id: "DX-001",
  title: "Diagnosis presence",
  description: "At least one diagnosis code must be present on the claim.",
  severity: "error",
  category: "diagnosis",
  version: "1.0.0",
  applicability:
    "Structural presence of HI diagnosis entries. Does NOT validate ICD code-set membership or code vintage.",
  evaluate(ctx) {
    if (ctx.claim.diagnoses.length === 0) {
      return [
        finding(this, ctx, {
          message: "No diagnosis codes were found on the claim.",
          suggestedAction: "Add at least one HI diagnosis composite for the professional claim.",
          sourceLocation: ctx.claim.source,
        }),
      ];
    }
    return [];
  },
};

import { finding } from "../finding.js";
import type { RuleDefinition } from "../types.js";

export const clm001RequiredFields: RuleDefinition = {
  id: "CLM-001",
  title: "Required claim header fields",
  description: "Claim control number and claim total charge must be present on the normalized claim.",
  severity: "error",
  category: "claim",
  version: "1.0.0",
  applicability:
    "Structural/required for Claim Checker MVP normalized 837P claims. Does not evaluate payer-specific optional CLM elements.",
  evaluate(ctx) {
    const out = [];
    const { claim } = ctx;
    if (!claim.claimControlNumber?.trim()) {
      out.push(
        finding(this, ctx, {
          message: "Claim control number (CLM01) is missing.",
          suggestedAction: "Provide a non-empty patient/claim control number in CLM01.",
          sourceLocation: claim.source,
        }),
      );
    }
    if (claim.totalCharge === undefined || !String(claim.totalCharge).trim()) {
      out.push(
        finding(this, ctx, {
          message: "Claim total charge (CLM02) is missing.",
          suggestedAction: "Provide the monetary amount in CLM02.",
          sourceLocation: { ...claim.source, elementIndex: 2 },
        }),
      );
    }
    return out;
  },
};

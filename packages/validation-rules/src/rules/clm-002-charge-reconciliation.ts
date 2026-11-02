import { finding } from "../finding.js";
import { formatCents, toCents } from "../money.js";
import type { RuleDefinition } from "../types.js";

export const clm002ChargeReconciliation: RuleDefinition = {
  id: "CLM-002",
  title: "Claim and line charge reconciliation",
  description: "Sum of service-line charges should equal the claim total charge.",
  severity: "error",
  category: "reconciliation",
  version: "1.0.0",
  applicability:
    "Business consistency check on normalized monetary fields. Not a payer allowed-amount or fee-schedule rule.",
  evaluate(ctx) {
    const claimCents = toCents(ctx.claim.totalCharge);
    if (claimCents === null) return [];

    let lineSum = 0;
    let parsedLines = 0;
    for (const line of ctx.claim.serviceLines) {
      const c = toCents(line.charge);
      if (c === null) continue;
      lineSum += c;
      parsedLines += 1;
    }
    if (parsedLines === 0) return [];

    if (lineSum !== claimCents) {
      return [
        finding(this, ctx, {
          message: `Claim total charge ${formatCents(claimCents)} does not equal the sum of line charges ${formatCents(lineSum)}.`,
          suggestedAction: "Reconcile CLM02 with SV102 amounts so the claim total matches the service lines.",
          sourceLocation: ctx.claim.source,
          evidence: {
            claimTotal: formatCents(claimCents),
            lineSum: formatCents(lineSum),
            linesCounted: parsedLines,
          },
        }),
      ];
    }
    return [];
  },
};

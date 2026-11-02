import { finding } from "../finding.js";
import type { RuleDefinition } from "../types.js";

/** NPI format only (10 digits). Not a registry/code-set lookup. */
function isTenDigitNpi(value: string): boolean {
  return /^\d{10}$/.test(value.trim());
}

export const prv001BillingProvider: RuleDefinition = {
  id: "PRV-001",
  title: "Billing provider identification",
  description: "Billing provider NPI must be present and formatted as a 10-digit identifier.",
  severity: "error",
  category: "provider",
  version: "1.0.0",
  applicability:
    "Structural identifier check for NM1*85 / XX. Does not validate against NPPES or any external provider directory.",
  evaluate(ctx) {
    const { claim } = ctx;
    const provider = claim.billingProvider;
    if (!provider) {
      return [
        finding(this, ctx, {
          message: "Billing provider (NM1*85) is missing.",
          suggestedAction: "Include a billing provider NM1 loop with identification qualifier XX and NPI.",
          sourceLocation: claim.source,
        }),
      ];
    }
    const npi = provider.npi?.trim() ?? "";
    if (!npi) {
      return [
        finding(this, ctx, {
          message: "Billing provider NPI is missing.",
          suggestedAction: "Populate NM109 with the billing provider NPI when NM108 is XX.",
          sourceLocation: provider.source,
        }),
      ];
    }
    if (!isTenDigitNpi(npi)) {
      return [
        finding(this, ctx, {
          message: `Billing provider NPI "${npi}" is not a 10-digit value.`,
          suggestedAction: "Correct the NPI format (10 digits). This check is format-only, not an NPPES lookup.",
          sourceLocation: provider.source,
          evidence: { npi },
        }),
      ];
    }
    return [];
  },
};

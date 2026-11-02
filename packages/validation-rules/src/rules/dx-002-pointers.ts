import { finding } from "../finding.js";
import type { RuleDefinition } from "../types.js";

export const dx002Pointers: RuleDefinition = {
  id: "DX-002",
  title: "Diagnosis pointer references",
  description: "Service-line diagnosis pointers must reference diagnosis sequences present on the claim.",
  severity: "error",
  category: "diagnosis",
  version: "1.0.0",
  applicability:
    "Structural cross-reference between SV1 diagnosis pointers and HI sequences. Does not validate clinical appropriateness.",
  evaluate(ctx) {
    const sequences = new Set(ctx.claim.diagnoses.map((d) => d.sequence));
    const out = [];
    for (const line of ctx.claim.serviceLines) {
      if (line.diagnosisPointers.length === 0) {
        out.push(
          finding(this, ctx, {
            message: `Service line ${line.lineNumber} has no diagnosis pointers.`,
            suggestedAction: "Populate SV1 diagnosis pointers that reference HI diagnosis sequences.",
            lineNumber: line.lineNumber,
            sourceLocation: line.source,
          }),
        );
        continue;
      }
      for (const pointer of line.diagnosisPointers) {
        if (!sequences.has(pointer)) {
          out.push(
            finding(this, ctx, {
              message: `Service line ${line.lineNumber} diagnosis pointer ${pointer} does not match any diagnosis sequence on the claim.`,
              suggestedAction: "Align SV1 pointers with HI diagnosis order/sequences present on the claim.",
              lineNumber: line.lineNumber,
              sourceLocation: line.source,
              evidence: { pointer, availableSequences: [...sequences] },
            }),
          );
        }
      }
    }
    return out;
  },
};

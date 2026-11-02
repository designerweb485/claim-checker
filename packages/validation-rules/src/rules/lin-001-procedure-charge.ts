import { finding } from "../finding.js";
import { toCents } from "../money.js";
import type { RuleDefinition } from "../types.js";

export const lin001ProcedureCharge: RuleDefinition = {
  id: "LIN-001",
  title: "Service-line procedure and charge",
  description: "Each service line must include a procedure code and a monetary charge.",
  severity: "error",
  category: "service_line",
  version: "1.0.0",
  applicability:
    "Structural presence/format of procedure code and charge on SV1. Does NOT validate CPT/HCPCS code-set membership.",
  evaluate(ctx) {
    const out = [];
    if (ctx.claim.serviceLines.length === 0) {
      out.push(
        finding(this, ctx, {
          message: "Claim has no service lines.",
          suggestedAction: "Add at least one LX/SV1 service line.",
          sourceLocation: ctx.claim.source,
        }),
      );
      return out;
    }
    for (const line of ctx.claim.serviceLines) {
      if (!line.procedureCode?.trim()) {
        out.push(
          finding(this, ctx, {
            message: `Service line ${line.lineNumber} is missing a procedure code.`,
            suggestedAction: "Provide the procedure code in SV101 (for example HC:99213).",
            lineNumber: line.lineNumber,
            sourceLocation: line.source,
          }),
        );
      }
      if (line.charge === undefined || !String(line.charge).trim()) {
        out.push(
          finding(this, ctx, {
            message: `Service line ${line.lineNumber} is missing a charge amount.`,
            suggestedAction: "Provide SV102 monetary amount.",
            lineNumber: line.lineNumber,
            sourceLocation: { ...line.source, elementIndex: 2 },
          }),
        );
      } else if (toCents(line.charge) === null) {
        out.push(
          finding(this, ctx, {
            message: `Service line ${line.lineNumber} charge "${line.charge}" is not a valid monetary amount.`,
            suggestedAction: "Use a plain decimal amount with up to two fractional digits.",
            lineNumber: line.lineNumber,
            sourceLocation: { ...line.source, elementIndex: 2 },
            evidence: { charge: line.charge },
          }),
        );
      }
    }
    return out;
  },
};

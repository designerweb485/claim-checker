import { finding } from "../finding.js";
import type { RuleDefinition } from "../types.js";

export const lin002Units: RuleDefinition = {
  id: "LIN-002",
  title: "Service-line units",
  description: "Service lines with a charge should include unit code and units.",
  severity: "error",
  category: "service_line",
  version: "1.0.0",
  applicability: "Structural presence of SV103/SV104 when a line charge is present.",
  evaluate(ctx) {
    const out = [];
    for (const line of ctx.claim.serviceLines) {
      if (line.charge === undefined || !String(line.charge).trim()) continue;
      if (!line.unitCode?.trim()) {
        out.push(
          finding(this, ctx, {
            message: `Service line ${line.lineNumber} is missing a unit code (SV103).`,
            suggestedAction: "Provide a unit basis code such as UN.",
            lineNumber: line.lineNumber,
            sourceLocation: { ...line.source, elementIndex: 3 },
          }),
        );
      }
      if (!line.units?.trim()) {
        out.push(
          finding(this, ctx, {
            message: `Service line ${line.lineNumber} is missing units (SV104).`,
            suggestedAction: "Provide the service unit count.",
            lineNumber: line.lineNumber,
            sourceLocation: { ...line.source, elementIndex: 4 },
          }),
        );
      } else if (!/^\d+(\.\d+)?$/.test(line.units.trim())) {
        out.push(
          finding(this, ctx, {
            message: `Service line ${line.lineNumber} units "${line.units}" is not numeric.`,
            suggestedAction: "Use a numeric unit quantity.",
            lineNumber: line.lineNumber,
            sourceLocation: { ...line.source, elementIndex: 4 },
            evidence: { units: line.units },
          }),
        );
      }
    }
    return out;
  },
};

import { finding } from "../finding.js";
import type { RuleDefinition } from "../types.js";

/** Format check for D8 CCYYMMDD only — not a calendar/business-day policy. */
function isD8(value: string): boolean {
  if (!/^\d{8}$/.test(value)) return false;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const dtp001ServiceDates: RuleDefinition = {
  id: "DTP-001",
  title: "Service line dates",
  description: "Each service line should include a D8 service date (CCYYMMDD).",
  severity: "error",
  category: "date",
  version: "1.0.0",
  applicability:
    "Structural/format check for DTP*472 service dates on lines. Not a timely-filing or payer date policy.",
  evaluate(ctx) {
    const out = [];
    for (const line of ctx.claim.serviceLines) {
      if (!line.serviceDate?.trim()) {
        out.push(
          finding(this, ctx, {
            message: `Service line ${line.lineNumber} is missing a service date.`,
            suggestedAction: "Add DTP*472 with D8 format (CCYYMMDD) for the line.",
            lineNumber: line.lineNumber,
            sourceLocation: line.source,
          }),
        );
        continue;
      }
      if (!isD8(line.serviceDate.trim())) {
        out.push(
          finding(this, ctx, {
            message: `Service line ${line.lineNumber} service date "${line.serviceDate}" is not a valid D8 CCYYMMDD calendar date.`,
            suggestedAction: "Correct the service date format/value (CCYYMMDD).",
            lineNumber: line.lineNumber,
            sourceLocation: line.source,
            evidence: { serviceDate: line.serviceDate },
          }),
        );
      }
    }
    return out;
  },
};

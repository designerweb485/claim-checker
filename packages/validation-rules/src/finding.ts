import type { Finding, RuleContext, RuleDefinition } from "./types.js";

export function finding(
  rule: RuleDefinition,
  ctx: RuleContext,
  partial: {
    message: string;
    suggestedAction: string;
    severity?: Finding["severity"];
    claimControlNumber?: string;
    lineNumber?: number;
    sourceLocation?: Finding["sourceLocation"];
    evidence?: Record<string, unknown>;
  },
): Finding {
  const fromClaim = ctx.claim.claimControlNumber?.trim();
  return {
    ruleId: rule.id,
    ruleVersion: rule.version,
    severity: partial.severity ?? rule.severity,
    category: rule.category,
    message: partial.message,
    suggestedAction: partial.suggestedAction,
    claimControlNumber: partial.claimControlNumber ?? (fromClaim || undefined),
    lineNumber: partial.lineNumber,
    sourceLocation: partial.sourceLocation,
    evidence: partial.evidence,
  };
}

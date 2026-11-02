import { RULE_SET_VERSION } from "./constants.js";
import { DEFAULT_RULES } from "./registry.js";
import type {
  Finding,
  RuleDefinition,
  ValidationInput,
  ValidationResult,
} from "./types.js";

function isParsedInterchange(
  input: ValidationInput,
): input is Extract<ValidationInput, { implementationGuide: string }> {
  return "implementationGuide" in input;
}

function compareFindings(a: Finding, b: Finding): number {
  return (
    a.ruleId.localeCompare(b.ruleId) ||
    (a.claimControlNumber ?? "").localeCompare(b.claimControlNumber ?? "") ||
    (a.lineNumber ?? -1) - (b.lineNumber ?? -1) ||
    a.message.localeCompare(b.message)
  );
}

/**
 * Run the deterministic rule set against normalized claims.
 * Same input + ruleSetVersion always yields the same findings (sorted).
 */
export function validateClaims(
  input: ValidationInput,
  options?: {
    rules?: readonly RuleDefinition[];
    ruleSetVersion?: string;
  },
): ValidationResult {
  const rules = options?.rules ?? DEFAULT_RULES;
  const ruleSetVersion = options?.ruleSetVersion ?? RULE_SET_VERSION;
  const claims = input.claims;
  const interchange = isParsedInterchange(input) ? input : undefined;

  const findings: Finding[] = [];
  for (let claimIndex = 0; claimIndex < claims.length; claimIndex++) {
    const claim = claims[claimIndex]!;
    const ctx = { claim, claimIndex, allClaims: claims, interchange };
    for (const rule of rules) {
      findings.push(...rule.evaluate(ctx));
    }
  }

  findings.sort(compareFindings);

  const summary = { error: 0, warning: 0, info: 0 };
  for (const f of findings) {
    summary[f.severity] += 1;
  }

  return { ruleSetVersion, findings, summary };
}

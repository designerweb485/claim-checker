import type { NormalizedClaim, ParsedInterchange, SourceLocation } from "@claim-checker/edi-parser";

export type Severity = "error" | "warning" | "info";

export type RuleCategory =
  | "claim"
  | "provider"
  | "subscriber"
  | "diagnosis"
  | "service_line"
  | "date"
  | "reconciliation"
  | "duplicate";

export type Finding = {
  ruleId: string;
  ruleVersion: string;
  severity: Severity;
  category: RuleCategory;
  message: string;
  suggestedAction: string;
  claimControlNumber?: string;
  lineNumber?: number;
  sourceLocation?: SourceLocation;
  evidence?: Record<string, unknown>;
};

export type RuleContext = {
  claim: NormalizedClaim;
  claimIndex: number;
  allClaims: NormalizedClaim[];
  interchange?: ParsedInterchange;
};

export type RuleDefinition = {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: RuleCategory;
  /** Per-rule documentation version (independent of rule-set bundle version). */
  version: string;
  /**
   * Applicability note: required structural check vs situational / business heuristic.
   * Must not invent payer-specific edits.
   */
  applicability: string;
  evaluate: (ctx: RuleContext) => Finding[];
};

export type ValidationInput =
  | ParsedInterchange
  | {
      claims: NormalizedClaim[];
    };

export type ValidationResult = {
  ruleSetVersion: string;
  findings: Finding[];
  summary: {
    error: number;
    warning: number;
    info: number;
  };
};

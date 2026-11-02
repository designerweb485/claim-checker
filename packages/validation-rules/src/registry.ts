import { clm001RequiredFields } from "./rules/clm-001-required-fields.js";
import { clm002ChargeReconciliation } from "./rules/clm-002-charge-reconciliation.js";
import { clm003DuplicateControl } from "./rules/clm-003-duplicate-control.js";
import { dtp001ServiceDates } from "./rules/dtp-001-service-dates.js";
import { dx001Presence } from "./rules/dx-001-presence.js";
import { dx002Pointers } from "./rules/dx-002-pointers.js";
import { lin001ProcedureCharge } from "./rules/lin-001-procedure-charge.js";
import { lin002Units } from "./rules/lin-002-units.js";
import { prv001BillingProvider } from "./rules/prv-001-billing-provider.js";
import { sub001Subscriber } from "./rules/sub-001-subscriber.js";
import type { RuleDefinition } from "./types.js";

/** Enabled MVP rule set (deterministic). Order is evaluation order. */
export const DEFAULT_RULES: readonly RuleDefinition[] = [
  clm001RequiredFields,
  prv001BillingProvider,
  sub001Subscriber,
  dx001Presence,
  dx002Pointers,
  lin001ProcedureCharge,
  lin002Units,
  dtp001ServiceDates,
  clm002ChargeReconciliation,
  clm003DuplicateControl,
] as const;

export function listRules(rules: readonly RuleDefinition[] = DEFAULT_RULES): RuleDefinition[] {
  return [...rules];
}

export function getRule(
  id: string,
  rules: readonly RuleDefinition[] = DEFAULT_RULES,
): RuleDefinition | undefined {
  return rules.find((r) => r.id === id);
}

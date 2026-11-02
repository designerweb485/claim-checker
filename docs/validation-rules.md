# Validation rules (Milestone 4)

**Package:** `@claim-checker/validation-rules`  
**Rule-set version:** `2026.10.4` (`RULE_SET_VERSION`)  
**API:** `validateClaims(normalizedInput) → { ruleSetVersion, findings, summary }`

> Deterministic structural / consistency checks on **normalized** 837P claims.  
> **Not** payer-ready certification. **Not** a guarantee against claim denial.  
> **Not** a full X12 implementation-guide conformance suite.

## Boundaries

| In scope | Out of scope |
|----------|----------------|
| Presence of required normalized fields | Payer companion-guide edits |
| Diagnosis **pointer** cross-references | Clinical medical necessity |
| Monetary reconciliation (claim vs lines) | Allowed amounts / fee schedules |
| Identifier **format** (e.g. 10-digit NPI) | NPPES or payer enrollment lookups |
| D8 date **format/calendar** shape | Timely filing policies |
| Duplicate CLM01 warnings in a batch | COB / true duplicate adjudication |

### Code-set validity

ICD / CPT / HCPCS **membership and vintage** require suitable, **versioned reference data**.  
This rule set **does not** mark a diagnosis or procedure “invalid” based on a simplistic pattern check. Presence and pointer integrity are checked; code-set catalogs are deferred.

## Enabled rules

| ID | Severity | Category | What it checks |
|----|----------|----------|----------------|
| `CLM-001` | error | claim | Claim control number and total charge present |
| `PRV-001` | error | provider | Billing provider present; NPI 10-digit format |
| `SUB-001` | error | subscriber | Subscriber + member id present |
| `DX-001` | error | diagnosis | At least one diagnosis present |
| `DX-002` | error | diagnosis | Line diagnosis pointers reference claim sequences; pointers required when lines exist |
| `LIN-001` | error | service_line | Lines present; procedure code + charge (amount format) |
| `LIN-002` | error | service_line | Unit code + units when charge present |
| `DTP-001` | error | date | Service date present; D8 CCYYMMDD calendar format |
| `CLM-002` | error | reconciliation | Sum of line charges equals claim total |
| `CLM-003` | warning | duplicate | Duplicate claim control numbers in the batch |

Each rule carries `id`, `title`, `description`, `severity`, `category`, `version`, and `applicability` text via `listRules()`.

## Determinism

- Input: normalized claims (`ParsedInterchange` or `{ claims }`).
- Same claims + `RULE_SET_VERSION` ⇒ identical findings (sorted by rule id, claim control number, line, message).
- No AI involvement. AI explanations (later) must not mutate findings.

## Usage

```ts
import { parse837P } from "@claim-checker/edi-parser";
import { validateClaims, listRules } from "@claim-checker/validation-rules";

const parsed = parse837P(ediText);
if (parsed.ok) {
  const { findings, summary, ruleSetVersion } = validateClaims(parsed.data);
}
```

## Tests

```bash
pnpm --filter @claim-checker/validation-rules test
```

## Persistence / API

Milestone 4 does **not** write findings to Postgres or expose HTTP routes. That remains Milestone 5+.

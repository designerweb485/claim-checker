# Case study: Claim Checker

Portfolio / interview narrative for a **synthetic** 837 Professional claim validation MVP.

## Problem

Medical billing teams still catch many **structural** EDI mistakes late — missing NPIs, broken diagnosis pointers, charge mismatches — after time spent assembling 837P files. Commercial clearinghouse tooling is heavy; ad-hoc spreadsheet checks do not scale or leave an audit trail.

## Constraints (chosen on purpose)

| Constraint | Why |
|------------|-----|
| Synthetic data only | Safe to demo and test without PHI |
| 837P `005010X222A1` only | Ship a sharp vertical, not a fake “all X12” product |
| Deterministic rules | Same input + `RULE_SET_VERSION` ⇒ same findings |
| Sync processing + 2 MB cap | MVP simplicity; queue when volume demands it |
| API org-scoping before RLS | Correct tenancy first; DB RLS as defense-in-depth later |
| **Not** HIPAA / IG certified | Honest scope — certification is process + product, not a flag |

## Approach

```text
Upload → parse (edi-parser) → normalize → validate (validation-rules)
       → persist claims + validation run + findings → UI / CSV
```

- **Parser** (`packages/edi-parser`): delimiters, version gate, source locations.
- **Rules** (`packages/validation-rules`): structural / consistency only (NPI format, member id presence, DX pointers, charge reconciliation, …).
- **API** (`apps/api`): JWT cookie + Bearer, org-scoped queries, audit logs without raw EDI.
- **Web** (`apps/web`): separates **processing** (parse completed) from **validation** (needs attention / clean).

## Failure modes we designed for

- Malformed / unsupported IG → parse **failed**, no invented validation success.
- Validation persist failure after parse → upload **failed**, never `completed` without a run (A1).
- Integration tests use **`claimchecker_test`**, not the demo DB — so `pnpm test` does not delete demo login.

## What I would do next (90 days)

1. Versioned ICD/CPT reference data (membership / vintage).
2. Denial-pattern fixture pack mapped to rule IDs.
3. Optional AI **explain** (non-authoritative, schema-validated).
4. Pilot with one billing team on **scrubbed/synthetic** clones only.

## What I would never claim

- Production healthcare readiness without BAA, controls, and assessment.
- Payer companion-guide completeness or denial prevention.
- Full X12 implementation-guide certification from unit tests alone.

## Demo (10 minutes)

See [`docs/demo.md`](demo.md): Postgres → migrate → ensure demo user → API + web → upload `fixtures/edi/multi-claim-errors.edi` → confirm Processing vs Validation and findings.

**Screenshots** (in `docs/screenshots/` and on the README): login, dashboard, upload detail, findings, history.

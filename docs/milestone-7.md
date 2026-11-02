# Milestone 7 — E2E testing & security verification

**Status:** Complete (behavior-backed tests + logout token revocation)  
**Not claimed:** Production hardening complete, HIPAA compliance, or denial-proof claims.

## Workflows verified

| # | Workflow | Evidence |
|---|----------|----------|
| 1 | Register / login / logout | Cookie session cleared; prior Bearer JWT rejected after `tokenVersion` bump |
| 2 | Valid 837P → findings | Upload completed; claim detail; `ruleSetVersion` matches `RULE_SET_VERSION` in API + DB |
| 3 | Malformed / unsupported | Actionable `parserErrors[].code` + `suggestedAction`; no validation run invented |
| 4 | Cross-org isolation | Other org gets **404** on upload, claims, findings, CSV; history does not list foreign IDs |
| 5 | Persisted findings | DB run/findings match API reload; identical second GET |
| 6 | CSV + EDI leakage | Formula cells prefixed with `'`; responses/audits contain no `ISA*` / raw EDI markers |
| 7 | Edges | Empty history `[]`; expired/invalid JWT → 401; missing UUID → 404; repeated uploads get distinct IDs |

Test file: `apps/api/src/security.e2e.test.ts` (plus existing HTTP/persistence/CSV suites).

## Hardening shipped in M7

- `User.tokenVersion` incremented on logout; JWT carries `tv` and is rejected when stale.

## How to re-run

```bash
docker compose up -d postgres
pnpm --filter @claim-checker/api exec prisma migrate deploy
pnpm typecheck
pnpm test
pnpm build
```

## Remaining for Milestone 8

Dockerized API/web services, GitHub Actions expansion, env/ops docs, production-readiness review (rate limits at edge, object-storage cleanup, secrets management).

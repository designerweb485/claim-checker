# Database setup (Milestone 3)

PostgreSQL stores **normalized** claim data and upload metadata. Raw EDI files are referenced by `Upload.storageKey` only and must not be written into logs or `audit_logs.metadata`.

## Prerequisites

- Docker (recommended) or a local PostgreSQL 16 instance
- Node.js ≥ 20, pnpm 9
- Copy `.env.example` → `.env` if needed

Default URL:

```text
DATABASE_URL=postgresql://claimchecker:claimchecker@127.0.0.1:55432/claimchecker?schema=public
```

Compose maps container `5432` → host **`55432`** so local Postgres on `5432`/`5433` does not steal connections. Keep `apps/api/.env` in sync (gitignored). Prefer `127.0.0.1` over `localhost` on Windows.

## Start PostgreSQL

From the repo root:

```bash
docker compose up -d postgres
```

Wait until healthy (`docker compose ps`).

## Migrate and generate client

```bash
pnpm install
pnpm --filter @claim-checker/api db:generate
pnpm --filter @claim-checker/api db:migrate:dev
# or in CI / clean environments:
pnpm --filter @claim-checker/api exec prisma migrate deploy
```

## Seed / demo login

```bash
pnpm --filter @claim-checker/api db:seed          # wipes then seeds
pnpm --filter @claim-checker/api db:ensure-demo   # upsert demo user only
```

Demo login: `demo@nexxaura.com` / `demo12345`. **Not** real credentials or PHI.

## Test database (isolated)

Compose init creates `claimchecker_test` alongside `claimchecker` (first volume only).

```bash
# One-time if volume predates this change:
docker compose exec postgres psql -U claimchecker -c "CREATE DATABASE claimchecker_test;"

pnpm --filter @claim-checker/api db:migrate:test
pnpm --filter @claim-checker/api test
```

`TEST_DATABASE_URL` (see `.env.example`) is forced in Vitest via `src/test/vitest-env.ts`.  
API tests wipe rows only inside **`claimchecker_test`**, not the demo database.

## Integration tests

Requires Postgres + migrations on the **test** database (script above runs migrate automatically before `vitest`).

## Persistence boundaries (M3)

| Concern | Behavior |
|---------|----------|
| Transaction | `persistParseSuccess` / `persistParseFailure` wrap status + claims/audit in one DB transaction |
| Org isolation | Reads/writes filter by `organizationId`; cross-org returns null / throws |
| Deletion | Org cascade deletes users/uploads/claims; upload cascade deletes claims/lines/diagnoses; findings set-null claim refs |
| Parser | `@claim-checker/edi-parser` unchanged; persistence maps `ParsedInterchange` / `ParseError[]` only |
| Raw EDI | File at `storageKey`; never stored in Postgres rows or audit metadata |

## RLS

Not enabled in MVP. Application queries are organization-scoped. Reassess Postgres RLS before production.

# Synthetic demo instructions

1. Start Postgres: `docker compose up -d postgres` (see `docs/database.md`).
2. If the Postgres volume already existed before test-DB support, create it once:
   `docker compose exec postgres psql -U claimchecker -c "CREATE DATABASE claimchecker_test;"`
3. Migrate demo DB: `pnpm --filter @claim-checker/api exec prisma migrate deploy`
4. Ensure demo login: `pnpm --filter @claim-checker/api db:ensure-demo`
5. Start API: `pnpm --filter @claim-checker/api dev`
6. Start web: `pnpm --filter @claim-checker/web dev`
7. Open http://localhost:3000 and sign in:
   - **Email:** `demo@nexxaura.com`
   - **Password:** `demo12345`
8. Upload `fixtures/edi/multi-claim-errors.edi`. Expect:
   - Processing: **Completed** (claims parsed)
   - Validation: **Needs attention** (rule findings)
   - History Validation column matches dashboard

Optional full stack: `docker compose up --build` (api + web + postgres).

Always use synthetic files. Never upload real patient EDI in demos.

**Not** HIPAA certified. **Not** an X12 IG conformance product.

## Tests vs demo data

API tests use **`TEST_DATABASE_URL`** → database `claimchecker_test`.  
They no longer wipe `demo@nexxaura.com` on the demo database.

If demo login is still missing (fresh volume / migrate reset):

```bash
pnpm --filter @claim-checker/api db:ensure-demo
```

## Portfolio screenshots

Stills for the README / case study live in `docs/screenshots/` (1440×900 desktop captures).

Re-capture after UI changes (API + web running):

```bash
node scripts/capture-screenshots.mjs
```

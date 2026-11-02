# HTTP API (Milestone 5)

Base path: `/api/v1`  
OpenAPI: `GET /api/v1/openapi.json`

**Not** HIPAA certified. Synthetic EDI only.

## Auth

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/register` | Creates organization + owner; sets httpOnly cookie; also returns `token` for Bearer tests |
| POST | `/auth/login` | Cookie + token |
| POST | `/auth/logout` | Clears cookie (auth required) |
| GET | `/auth/me` | Current user + organization |

Organization context is **always** taken from the authenticated user. Clients must not send `organizationId` for authorization.

## Uploads & validation

| Method | Path | Notes |
|--------|------|-------|
| POST | `/uploads` | multipart field `file`; `.837`/`.edi`/`.txt`; max `UPLOAD_MAX_BYTES` (default 2 MB) |
| GET | `/uploads` | History for the caller's org |
| GET | `/uploads/:id` | Detail |
| GET | `/uploads/:id/claims` | Claim summaries |
| GET | `/uploads/:id/validation-run` | Latest run summary |
| GET | `/claims/:id` | Claim detail + findings |
| GET | `/validation-runs/:id/findings` | Findings list |
| GET | `/validation-runs/:id/export.csv` | CSV (formula-injection escaped) |
| GET | `/rules` | Enabled deterministic rules |
| GET | `/health` | Liveness + DB ping |

Upload processing is synchronous: store file at `storageKey` → parse → persist normalized claims or parser errors → run `validateClaims` → persist findings + `ruleSetVersion`.

Raw EDI is never returned in JSON responses or written to audit logs.

## Run locally

```bash
docker compose up -d postgres
pnpm --filter @claim-checker/api exec prisma migrate deploy
pnpm --filter @claim-checker/api dev
```

See `docs/database.md` for `DATABASE_URL` (host port **55432**).

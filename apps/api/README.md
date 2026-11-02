# `@claim-checker/api`

Express + Zod REST API (`/api/v1`) with Prisma persistence.

- Auth: httpOnly cookie (web) + Bearer JWT (tests)
- Org scope always from authenticated user
- Upload → parse → validate → persist findings
- OpenAPI: `GET /api/v1/openapi.json`

```bash
pnpm dev
pnpm test
```

Docs: [`docs/api.md`](../../docs/api.md), [`docs/database.md`](../../docs/database.md).

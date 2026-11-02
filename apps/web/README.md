# `@claim-checker/web`

Next.js UI for Claim Checker (Milestone 6). Design: [`docs/ui-design.md`](../../docs/ui-design.md).

```bash
# Terminal 1 — API
pnpm --filter @claim-checker/api dev

# Terminal 2 — Web
pnpm --filter @claim-checker/web dev
```

Open http://localhost:3000 — uses httpOnly cookies against `NEXT_PUBLIC_API_BASE_URL`.

# Architecture — AI Medical Claim Error Checker

**Status:** Milestone 7 complete (E2E/security); Milestone 8 not started (Docker/CI/production review)  
**Date:** 2026-10-29  
**Product name:** Claim Checker (working UI name; keep configurable)  
**Outcome posture:** Hybrid C — synthetic demo data now; production-shaped tenancy, auth, audit, and logging boundaries; **not** a HIPAA-certified or X12 implementation-guide–certified product.

## 1. Goals

Build a maintainable MVP for medical billing companies that:

1. Accepts synthetic X12 **837 Professional** files (`005010X222A1`).
2. Parses and normalizes claims deterministically.
3. Runs a versioned rule engine that always produces the same findings for the same input + rule-set version.
4. Surfaces results in a web dashboard with CSV export.
5. Optionally explains findings in plain English via AI **without** treating AI as authoritative.

## 2. Frozen stack decisions

| Concern | Choice |
|--------|--------|
| Workspace | pnpm monorepo (no Turborepo/Nx in MVP) |
| Runtime | Node.js LTS only (no Python) |
| API | Express + TypeScript + Zod |
| Web | Next.js + React + TypeScript |
| Database | PostgreSQL + Prisma |
| Tests | Vitest (+ Supertest for API) |
| Auth | httpOnly cookie for web; Bearer JWT accepted for API tests |
| EDI | Custom `packages/edi-parser` — **837P `005010X222A1` only** (Milestone 2 done) |
| Rules | Custom `packages/validation-rules` (Milestone 4+) |
| Processing | Synchronous parse/validate on upload; status machine; **2 MB** via `UPLOAD_MAX_BYTES` |
| AI | Optional, sanitized, schema-validated, graceful failure |
| Delivery | Docker Compose + GitHub Actions |
| Tenancy DB | API-level `organizationId` scoping now; **assess Postgres RLS before production** |

**Explicit non-goals for MVP:** NestJS, Redis/job queues, commercial X12 suites, payer-specific rule packs, full Postgres RLS enforcement (API org-scoping first), real PHI.

Parser detail and honesty boundaries: [`docs/parser.md`](parser.md).

## 3. System overview

```text
Browser (apps/web)
    │  cookie session (httpOnly)
    ▼
REST /api/v1 (apps/api — Express + Zod)
    │  org-scoped authorization on every resource
    ├─► packages/edi-parser          (delimiter detect → segments → normalize)
    ├─► packages/validation-rules    (deterministic findings)
    ├─► packages/shared              (DTOs / Zod schemas)
    ├─► optional AI explainer        (sanitized JSON only)
    └─► PostgreSQL via Prisma
            uploads, claims, lines, diagnoses,
            validation_runs, validation_findings, audit_logs
```

## 4. Package and app responsibilities

| Path | Responsibility | Milestone |
|------|----------------|-----------|
| `apps/api` | HTTP API, auth, uploads, orchestration, OpenAPI, audit writes | 5 |
| `apps/web` | Login, dashboard, upload UX, results, settings | 6 |
| `packages/shared` | Shared TypeScript types and Zod contracts | 2–5 |
| `packages/edi-parser` | ISA delimiter detection, 837P parse, version gate, source locations, normalize | 2–3 |
| `packages/validation-rules` | Rule registry, runner, per-rule modules + unit tests | 4 |
| `fixtures/` | Synthetic `.837` / `.edi` / `.txt` + expected JSON | 2–4 |
| `docs/` | Architecture, UI design, limitations, demo notes | 1+ |

Parser and rules packages must remain **pure libraries** (no Express, no Prisma) so they are independently testable.

## 5. Data model

UUID primary keys, timestamps, foreign keys, organization scoping on owned rows. Monetary amounts use Prisma `Decimal` → PostgreSQL `NUMERIC`.

### Tables

- **organizations** — `id`, `name`, `slug`, timestamps
- **users** — `id`, `organizationId`, `email` (unique), `passwordHash`, `role` (`owner` \| `member`), timestamps
- **uploads** — `id`, `organizationId`, `userId`, `filename`, `byteSize`, `contentHash`, `status`, `errorSummary?`, `storageKey`, `transactionSet?`, `igVersion?`, timestamps
- **claims** — `id`, `organizationId`, `uploadId`, claim identifiers, billing provider identifiers, subscriber identifiers (demo-safe), `totalCharge`, service date range, structural refs JSON
- **claim_lines** — `id`, `claimId`, `lineNumber`, procedure code, modifiers, charge, units, service date, diagnosis pointers
- **diagnoses** — `id`, `claimId`, `sequence`, `code`, `codeSet` (e.g. `ICD10`)
- **validation_runs** — `id`, `organizationId`, `uploadId`, `ruleSetVersion`, `status`, `startedAt`, `finishedAt`, summary counts JSON
- **validation_findings** — `id`, `validationRunId`, optional `claimId` / `claimLineId`, `ruleId`, `severity`, `message`, `sourceLocation` JSON, `suggestedAction`, `evidence` JSON (non-PHI)
- **audit_logs** — `id`, `organizationId`, `actorUserId?`, `action`, `resourceType`, `resourceId?`, `metadata` JSON (**never** raw EDI)

### Indexes (planned)

- `(organizationId, createdAt)` on uploads, claims, validation_runs
- `(validationRunId, severity)` on findings
- `(claimId)` on lines, diagnoses, findings
- Unique constraints where natural (e.g. email; upload + claim control number when present)

### Row-Level Security

Ship as a **documented defense-in-depth path** (session `app.current_org_id`). MVP enforcement is application-layer `WHERE organization_id = :authOrgId`. RLS policies may be added later without changing the schema shape.

## 6. Upload lifecycle

```text
POST /api/v1/uploads
  → validate auth, org, extension (.837|.edi|.txt), MIME/size cap
  → persist file at storageKey (not in logs)
  → status: pending → processing
  → parse (edi-parser) → normalize → validate (validation-rules)
  → persist claims / lines / diagnoses / run / findings
  → status: completed | failed (errorSummary for user-safe message)
```

Processing is **synchronous in-process** for MVP. File-size cap (recommended default **2 MB**, configurable via env) prevents unbounded work. A queue is out of scope until volume requires it.

Statuses: `pending` | `processing` | `completed` | `failed`.

## 7. Parser strategy (Milestone 2 — implemented)

1. Read ISA; detect element, repetition, component, and segment terminators from the interchange header (do not hardcode). ISA16 is one character; the segment terminator follows immediately.
2. Split segments/elements; retain **source locations** (segment index, segment id, element index).
3. Detect transaction / IG version; **accept only** Professional `005010X222A1`; reject others with actionable errors (never silently reinterpret).
4. Validate ISA/IEA, GS/GE, ST/SE control numbers and SE segment counts.
5. Support multiple claims in one file where the transaction structure permits.
6. Map to a normalized claim batch (`parse837P`) for the future rule engine.

**Honesty boundary:** Focused structural parser for the supported IG identifier. **Unit tests ≠ full IG conformance.** See [`docs/parser.md`](parser.md).

## 8. Validation engine strategy (Milestone 4 — implemented)

Package `@claim-checker/validation-rules` runs **after** parse/normalize. Details: [`docs/validation-rules.md`](validation-rules.md).

Layers:

1. X12 syntax — handled primarily by the parser (M2)
2. Structural / consistency rules in the registry (required fields, pointers, dates, charges, duplicates)
3. Configured business heuristics limited to documented rules (e.g. CLM-002, CLM-003)
4. Payer-specific — **out of MVP**

Every rule: stable `id`, `severity`, `category`, `version`, applicability text, unit tests.  
Same normalized input + `RULE_SET_VERSION` ⇒ same findings (deterministic).  
No ICD/CPT code-set invalidation without versioned reference data.  
AI never creates, deletes, or rewrites findings.

## 9. REST API contracts (`/api/v1`)

All non-health routes require authentication. All resource access is org-scoped.

| Area | Methods (sketch) |
|------|------------------|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Uploads | `POST /uploads`, `GET /uploads`, `GET /uploads/:id` |
| Validation | `GET /uploads/:id/validation-run` |
| Claims | `GET /uploads/:id/claims`, `GET /claims/:id` |
| Findings | `GET /validation-runs/:id/findings` |
| Export | `GET /validation-runs/:id/export.csv` |
| Rules | `GET /rules` |
| AI | `POST /findings/:id/explain` (optional; `503` if disabled/unavailable) |
| Health | `GET /health` |

Request/response bodies validated with Zod. OpenAPI generated or maintained alongside handlers (Milestone 5).

## 10. Authentication and authorization

- **Register/login** issues a JWT.
- **Web:** JWT stored in **httpOnly**, `Secure` (prod), `SameSite=Lax` cookie.
- **API tests / tooling:** `Authorization: Bearer <token>` accepted by the same middleware.
- **Authorization:** every query filters by `organizationId` from the authenticated principal. Cross-org IDs return **404** (no existence leak).
- Roles: `owner` | `member` (settings mutations may require `owner` in later milestones).

## 11. Security boundaries

- Treat all uploads as **untrusted**.
- Do not log raw EDI, passwords, or member identifiers.
- AI payloads: sanitized, minimum-necessary, **no raw EDI**, no identifiable patient data in the demo.
- File allowlist + size cap + rate limits on auth and upload routes.
- Secrets only via environment variables; `.env.example` documents keys without values.
- Synthetic fixtures only — no real patient data or credentials.

## 12. AI integration (Milestone 7)

- Deterministic engine is the sole authority for findings.
- Optional service explains a finding and suggests what to review; output must match a Zod schema.
- Timeouts and provider failures must not break the app; UI shows a soft failure.
- AI output must never mutate rule results or claims.

## 13. Testing strategy

| Layer | Tool | Focus |
|-------|------|--------|
| Parser | Vitest | Delimiters, versions, fixtures, source locations |
| Rules | Vitest | Valid/invalid cases; exact finding IDs |
| API | Vitest + Supertest | Auth, org isolation, upload lifecycle |
| Web | Later / Playwright optional | Out of Milestone 1 |

Never disable tests to force a green build. Never fabricate passing results.

## 14. Delivery

- `docker-compose.yml` — `api`, `web`, `postgres` (+ `claimchecker_test` init).
- GitHub Actions — typecheck, migrate test DB, test, build on PR.
- Docs: this file, `docs/ui-design.md`, `docs/case-study.md`, `docs/demo.md`, README, limitations.

## 15. Milestone sequencing

| # | Name | Exit criteria |
|---|------|----------------|
| **1** | Architecture & scaffold | Design docs + empty monorepo — **done** |
| **2** | Parser | Package tests green for fixtures; version rejection — **done** |
| **3** | Normalized model + DB | Prisma migrations + persistence of normalized model — **done** |
| **4** | Validation engine | Rule unit tests; deterministic findings — **done** |
| **5** | API | Auth, uploads, findings, export, OpenAPI, integration tests — **done** |
| **6** | Frontend | Pages per `docs/ui-design.md` against live API — **done** |
| **7** | E2E / security hardening / bug fixes | Behavior-backed suites + logout token revocation — **done** ([`docs/milestone-7.md`](milestone-7.md)) |
| **8** | Docker / CI/CD / production-readiness review | **Done** — Compose + Dockerfiles, GitHub Actions with test DB, [`docs/case-study.md`](case-study.md) |

## 16. Known limitations (product honesty)

- Not HIPAA compliant by claim; not X12 IG certified.
- Supports only 837 Professional `005010X222A1` in the planned MVP.
- No payer-specific edits unless explicitly configured later.
- Sync processing and file-size caps limit throughput.
- Demo uses synthetic data only.

See also `docs/ui-design.md` for frontend architecture (documentation only until Milestone 6) and `docs/database.md` for Postgres/migrate.

# UI Design — Claim Checker

**Status:** Milestone 6 implemented in `apps/web` (design reference).  
**Product:** Claim Checker (AI Medical Claim Error Checker)  
**Audience:** Medical billing company staff validating synthetic 837P uploads.  
**Tone:** Calm clinical precision — a chart desk, not a generic admin template.  
**Compliance:** Synthetic sample data in all mock descriptions. Do **not** claim HIPAA compliance.

Related: `docs/architecture.md`.

---

## 1. Frontend architecture (planned)

| Layer | Choice |
|-------|--------|
| App | Next.js App Router (`apps/web`) |
| Language | TypeScript + React |
| Styling | CSS variables + module or global CSS (no mandatory UI kit in MVP) |
| Data | Fetch `/api/v1` with credentials (httpOnly cookie); shared Zod types from `@claim-checker/shared` when available |
| Auth gate | Middleware or layout that redirects unauthenticated users to `/login` |
| Layout | Authenticated shell: fixed sidebar + top utility bar + main canvas |

### Route map (Milestone 6)

| Route | Page |
|-------|------|
| `/login` | Login / register entry |
| `/` or `/dashboard` | Dashboard |
| `/uploads/new` | EDI upload |
| `/uploads` | Upload history |
| `/uploads/[id]` | Validation results for one upload |
| `/claims/[id]` | Claim details and findings |
| `/rules` | Rule reference |
| `/settings` | Organization / account settings |

---

## 2. Design system

### 2.1 Visual direction

**Name of look:** “Clinical ink on slate paper.”

Billers work with dense claim data. The UI should feel like a well-lit medical records desk: cool paper backgrounds, navy ink for structure, a single **teal** accent for primary actions (evoking scrub/sterile clarity without hospital-cliché green gradients), and severity colors that read instantly in a findings table.

Avoid: purple SaaS gradients, cream/terracotta “AI default,” dark-mode-first chrome, pill-spam, floating badge clutter, identical rounded card grids.

### 2.2 Color tokens

| Token | Hex | Use |
|-------|-----|-----|
| `--color-paper` | `#F3F5F7` | App background |
| `--color-surface` | `#FFFFFF` | Main panels, tables |
| `--color-ink` | `#142033` | Primary text, sidebar brand |
| `--color-ink-muted` | `#5B6B7C` | Secondary text, meta |
| `--color-line` | `#D7DEE7` | Borders, table rules |
| `--color-accent` | `#0F766E` | Primary buttons, active nav, focus ring |
| `--color-accent-soft` | `#E0F2F1` | Selected row / soft highlight |
| `--color-danger` | `#B42318` | Error severity, destructive |
| `--color-danger-soft` | `#FEF3F2` | Error row wash |
| `--color-warning` | `#B54708` | Warning severity |
| `--color-warning-soft` | `#FFFAEB` | Warning row wash |
| `--color-info` | `#175CD3` | Info / advisory |
| `--color-info-soft` | `#EFF8FF` | Info row wash |
| `--color-success` | `#027A48` | Completed / pass states |
| `--color-success-soft` | `#ECFDF3` | Success wash |

### 2.3 Severity indicators

| Severity | Label | Color | Pattern |
|----------|-------|-------|---------|
| `error` | Error | `--color-danger` | Filled left border + soft wash; icon optional |
| `warning` | Warning | `--color-warning` | Same pattern |
| `info` | Info | `--color-info` | Same pattern |
| (pass / none) | — | `--color-success` | Used for “0 errors” summary chips only |

Do not encode severity by color alone: always show the text label. Prefer a 4px left rule on finding rows over noisy badges.

### 2.4 Typography

| Role | Family | Notes |
|------|--------|-------|
| Brand / display | **Source Serif 4** | Wordmark “Claim Checker”, rare page titles |
| UI / body | **IBM Plex Sans** | Navigation, forms, tables, body |
| Data / codes | **IBM Plex Mono** | Rule IDs, NPI-like demo IDs, segment refs (`CLM*01`) |

Scale (approx): brand 22–28px; page title 20–24px; section 16–18px; body 14–15px; meta/table 13px; mono codes 12–13px.

Sentence case everywhere. No tracked ALL-CAPS eyebrows.

### 2.5 Layout & density

- Sidebar width ~240px desktop; collapses to icon rail or drawer on small screens.
- Main content max readable width for prose ~40rem; **tables full bleed** within the content column.
- Prefer **tables and definition lists** over card grids for claim/finding data.
- 8px spacing grid; comfortable table row height (~40–44px) for scanning.

### 2.6 Motion

Minimal. Page-load: no staggered card fades. Use short transitions on sidebar collapse, toast enter/exit, and status badge changes. Respect `prefers-reduced-motion`.

---

## 3. Shell: sidebar navigation

Authenticated layout:

```text
┌────────────┬──────────────────────────────────────────┐
│ Claim      │  [Org name]              [User ▾]        │
│ Checker    ├──────────────────────────────────────────┤
│            │                                          │
│ Dashboard  │           Main canvas                    │
│ Upload     │                                          │
│ History    │                                          │
│ Rules      │                                          │
│            │                                          │
│ Settings   │                                          │
└────────────┴──────────────────────────────────────────┘
```

| Nav item | Route | Notes |
|----------|-------|-------|
| Dashboard | `/dashboard` | Summary counts |
| Upload | `/uploads/new` | Primary creation path |
| History | `/uploads` | All uploads |
| Rules | `/rules` | Enabled rule catalog |
| Settings | `/settings` | Org + account |

Active item: teal left bar + `--color-accent-soft` background. Wordmark uses Source Serif 4 in `--color-ink`.

Footer of sidebar (small muted text): “Synthetic demo data · Not a compliance certification.”

---

## 4. Page specifications

Synthetic labels only in examples (e.g. member `MEM-000042`, claim `CLM-DEMO-1001`).

### 4.1 Login

**Purpose:** Register or sign in; establish httpOnly session cookie.

**Layout:** Split or centered single column on `--color-paper`. Brand wordmark dominant. Form: email, password; toggle Login / Create account. Primary CTA: teal filled button.

**States:** loading (button busy), error (inline under form — “Invalid email or password”), success → redirect dashboard.

**A11y:** Labels tied to inputs; focus ring teal; errors announced.

---

### 4.2 Dashboard

**Purpose:** Answer “what needs attention?” in one glance.

**Content (one job):** Recent validation health — not a widget marketplace.

- Header: “Dashboard” + short line: “Recent uploads and open errors for your organization.”
- Summary strip (not card spam): total uploads, completed, failed, open errors (numbers + muted labels).
- Recent uploads table: filename, status, claim count, error/warning counts, uploaded at, link to results.

**Empty:** Illustration-free empty copy + CTA “Upload an EDI file.”  
**Loading:** Skeleton rows.  
**Error:** Banner with retry.

---

### 4.3 EDI upload

**Purpose:** Submit a synthetic `.837` / `.edi` / `.txt` file within size cap.

**Content:** Drop zone + file picker; show allowed extensions and max size (e.g. 2 MB). Optional note field out of scope for MVP.

**Flow:** Select → Upload → show processing status (`pending` → `processing`) → redirect to validation results on `completed`, or inline failure reason on `failed`.

**States:** idle, dragging, uploading, processing, failed (actionable message), success redirect.

---

### 4.4 Upload history

**Purpose:** Browse all org uploads.

**Content:** Filterable table — status, date range, filename search. Columns: file, status badge, IG/version if known, claims, errors, warnings, date, actions (view).

**Empty / loading / error:** Same patterns as dashboard table.

---

### 4.5 Validation results

**Purpose:** Summarize one upload’s validation run.

**Content:**

- Header: filename, status, timestamps, rule-set version.
- Summary counts: errors / warnings / info.
- Claims table: control number, charge, line count, finding counts → link to claim detail.
- Actions: Export CSV, back to history.

**Failed upload:** Show `errorSummary` prominently; no fake empty success.

---

### 4.6 Claim details and findings

**Purpose:** Inspect one claim and its findings with source location.

**Layout:** Two zones —

1. **Claim summary** — subscriber/member demo IDs, billing provider, total charge, service dates, diagnosis list, service lines table.
2. **Findings** — filter by severity; each row: severity label, rule ID (mono), message, source location (e.g. `segment CLM, element 02`), suggested action. Optional “Explain” (AI) opens a panel; on AI failure show muted “Explanation unavailable.”

**Empty findings:** Clear success state — “No findings for this claim.”

---

### 4.7 Rule reference

**Purpose:** List enabled deterministic rules (documentation for billers).

**Content:** Table or grouped list — rule ID, title, severity, version, short description. No editing in MVP.

**Empty:** “No rules registered” (should not happen in demo once M4 ships).

---

### 4.8 Organization / account settings

**Purpose:** View org name, user email/role; change password (MVP-minimal).

**Content:** Org section (name, slug read-only in MVP unless owner rename later). Account section: email, role, password change form. Sign out control.

**Do not** expose API keys or raw storage paths in UI.

---

## 5. Reusable component plan

Implement only when Milestone 6 starts; design for reuse:

| Component | Role |
|-----------|------|
| `AppShell` | Sidebar + top bar + main |
| `StatusBadge` | Upload/run status with text + color |
| `SeverityMark` | Finding severity label + left rule |
| `DataTable` | Sortable/filterable table primitive |
| `EmptyState` | Title, body, optional CTA |
| `PageHeader` | Title + one supporting sentence + actions |
| `FileDropzone` | Upload control |
| `AlertBanner` | Error/info page-level messages |
| `FindingsList` | Finding rows + filters |
| `ExplainPanel` | Optional AI explanation drawer |
| `ConfirmDialog` | Rare destructive confirms |

Prefer composition over a heavy design-system package.

---

## 6. Responsive behavior

| Breakpoint | Behavior |
|------------|----------|
| ≥ 1024px | Full sidebar + tables |
| 768–1023px | Collapsible sidebar; tables horizontally scroll |
| &lt; 768px | Drawer nav; stack page headers; primary actions full-width; tables scroll with sticky first column when practical |

Touch targets ≥ 44px for primary controls.

---

## 7. Accessibility

- Semantic landmarks: `nav`, `main`, `header`.
- Visible focus (`--color-accent` ring).
- Severity never color-only.
- Form errors associated via `aria-describedby`.
- Toasts/status changes polite live regions where needed.
- Contrast: ink on paper and teal on white meet WCAG AA for text.

---

## 8. Loading, empty, and error patterns

| State | Pattern |
|-------|---------|
| Loading | Skeleton for tables; disable duplicate submits |
| Empty | One sentence + single CTA |
| Error | Banner or inline; say what failed and what to do next |
| Partial (AI) | Soft fail; core findings still visible |

Copy voice: plain, direct, no apology theater (“Upload failed: file exceeds 2 MB limit.”).

---

## 9. Sample (synthetic) dashboard row

For documentation/mockups only:

| File | Status | Claims | Errors | Warnings | Uploaded |
|------|--------|--------|--------|----------|----------|
| `demo-valid-837p.edi` | Completed | 1 | 0 | 0 | 2026-10-28 14:02 |
| `demo-bad-pointer.837` | Completed | 1 | 2 | 1 | 2026-10-28 14:10 |
| `demo-unsupported-ver.txt` | Failed | — | — | — | 2026-10-28 14:11 |

---

## 10. Milestone boundary

Implemented in Milestone 6 under `apps/web`. Optional AI explain panels remain deferred.

# Roadmap: CSPS — Carmen's Stitch & Printing Services

*Created: 2026-10-07T00:08:54-05:00 · Updated: 2026-10-19T02:05:00-05:00*

## Overview

CSPS replaces the shop's live legacy system with a strict, test-first .NET 10 + React 19 app. The work runs in four stretches:

- **Platform (Phases 1–3).** The backend foundation comes first, with the SmarterASP.NET hosting facts verified before anything else. Next comes the UI-spec design system with every quality gate in place. CI and the deploy follow once the owner supplies the GitHub repo and host credentials. The Basic plan has only the live site, so every deploy goes there, and in Phase 3 CSPS replaces the legacy site (owner, 2026-10-15).
- **Staff portal (Phases 4–10), in vertical slices.** Sign-in with mandatory email 2FA, then profiles and user management, then company expenses as the slice that proves the pattern. The order aggregate follows in three phases (domain and API, then screens, then images and maintenance jobs), and the dashboard comes last.
- **Public site and hardening (Phases 11–14).** The public site and its content management, then consent, analytics and legal pages, then quote inquiries. Phase 14 hardens the complete app.
- **Legacy data and cutover (Phases 15 to 17).** The legacy site and database are retired in Phase 3 (owner override of Prime Directive 1, 2026-10-15), and the legacy data is kept unchanged in a verified `.bak`. Phase 3 reads that `.bak` once, for table names and row counts only. Phases 1 to 14 build and test on an empty, EF-migrated database, and the live CSPS database starts empty too. Phase 15 maps the `.bak`, Phase 16 builds and rehearses the import, and Phase 17 runs it on the live database with the owner present (Prime Directive 11).

## Roadmap Conventions

- **Requirement mapping.** Each v1 requirement maps to exactly one phase: the one that establishes it. Cross-cutting QUAL/SEC/A11Y/PERF requirements map to the phase where their gate is first built. **From then on, every later phase enforces them through the PRD §22 Definition of Done:**
  - zero warnings, coverage gates and architecture tests
  - authorization-matrix rows for every new endpoint
  - an `Idempotency-Key` on every new POST, or a written allow-list entry (SEC-06)
  - `rowversion` 409s and a two-writer test for every new mutable aggregate (SEC-07)
  - `CreatedBy`/`CreatedAt`/`UpdatedBy`/`UpdatedAt` set server-side on every record a phase makes creatable or editable, plus a test proving client-sent values are ignored (SEC-08)
  - every list page keeps its filters, search, sort and page in the URL via the shared WEB-10 parsers
  - axe at zero violations, plus a keyboard pass
  - bundle budgets and Lighthouse scores
  - a UI-spec match at 320/768/1280 px
  - CWE rows mitigated and tested
  - production data untouched
- **Orders split.** Phase 7 builds the whole order API, including the server side of list/search (ORD-01, ORD-02) and delete (ORD-06). Those three IDs map to Phase 8, where they become true end to end. Phase 8 also delivers ORD-03's UI flow, ORD-08's conflict UX, ORD-22's "Received by" field and ORD-23's "Paid by" field, against IDs that stay mapped to Phase 7.
- **Pieces that grow.** Each of these is set up once, then extended by every later phase for its own entities and endpoints:
  - the dev seed (FND-04)
  - the audit event catalog (AUDIT-01)
  - rate-limit policies (SEC-03)
  - maintenance jobs (JOB-01)
  - the authorization matrix (SEC-02)
  - the idempotency allow-list (SEC-06)
- **Per-phase workflow:**
  1. `/gsd-discuss-phase N` closes the listed owner decisions before the first test.
  2. `/gsd-plan-phase N --tdd`.
  3. Phases with a UI hint run `/gsd-ui-phase N`, with `CSPS-UI-SPEC.md` as the source of truth.
  4. `/gsd-secure-phase N`, `/gsd-ui-review N` and `/gsd-verify-work` all complete before `/gsd-ship N`.
- **Owner decisions** are [OWNER DECISION] items: ask, never assume. They come from two places: OD-1…OD-21 and C-1…C-21 in PROJECT.md, and C-22…C-45 and S-1…S-12 in research/SUMMARY.md. See the Decision Calendar below.
- **Shared machine.** CLAUDE.md binds every phase:
  - Run the preflight before any dev server, Playwright run or full test run.
  - Use only ports 5180, 5115, 7028 and 5199.
  - Use only `CSPS_` databases.
  - Never kill another project's processes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Hosting Verification & Backend Foundation** - Verified host facts, a zero-warning onion API on an empty EF-migrated database, the platform contract and shared backend primitives (completed 2026-10-07)
- [x] **Phase 2: Web Foundation & Design System** - UI-spec design system imported and reconciled, layouts, primitives, `httpClient`/`api.ts`, golden vectors and all front-end gates (completed 2026-10-14)
- [x] **Phase 3: CI/CD & Deploy** *(deferred until after Phase 4, owner 2026-10-14)* - Owner-created GitHub repo, full PR pipeline, supply-chain checks, and an owner-run Web Deploy to the live SmarterASP.NET site with a smoke test and automatic rollback; CSPS replaces the legacy site (owner, 2026-10-15) (completed 2026-10-17)
- [x] **Phase 4: Identity & Authentication** - Email + password + mandatory emailed code, remember me, rotating refresh, lockout, reset, bootstrap Manager, auth audit (completed 2026-10-17)
- [ ] **Phase 5: Profile & User Management** - Own profile, email change, password and theme; Manager-only roster with guard rules and the audit-log viewer
- [ ] **Phase 6: Company Expenses** - Pattern-proving CRUD slice with filters, period totals, Manila-month KPIs and query-count guards
- [ ] **Phase 7: Order Domain & API** - Order aggregate, numbering, invariants, transitions, concurrency and import path, proven by fixtures and race tests
- [ ] **Phase 8: Order Screens** - Order list, search and filters, create flow, detail page with tabs, modals, totals and profit, safe delete
- [ ] **Phase 9: Order Images & Maintenance Jobs** - Server-signed Cloudinary uploads, accessible reorder/cover, responsive delivery, cleanup job framework
- [ ] **Phase 10: Admin Dashboard** - Greeting, KPIs, income vs expenses chart, orders by status, recent orders, staff money on hand and coworker transfers
- [ ] **Phase 11: Public Site & Content Management** - Home/Products/Gallery/Contact from database content, OG/JSON-LD in server HTML, Manager content editing
- [ ] **Phase 12: Consent, Analytics & Legal** - Cookie consent with GPC and clear-my-data, consented analytics, metrics dashboard, DRAFT legal pages
- [ ] **Phase 13: Quote Inquiries** - Get a Quote form with safe attachments, staff notification, admin inbox, convert to order, retention
- [ ] **Phase 14: Hardening & Release Readiness** - Full security review and ZAP, manual accessibility passes, PWA, View Transitions, runbooks and DSR/breach procedures
- [ ] **Phase 15: Legacy Discovery & Mapping** - Read-only restore, `LEGACY-SCHEMA.md`, owner-approved `LEGACY-MAPPING.md`
- [ ] **Phase 16: Legacy Data Import** - Test-driven idempotent ETL from the verified `.bak`, image and user migration, 100% reconciliation, a timed local dress rehearsal
- [ ] **Phase 17: Legacy Data Cutover** - The legacy data import runs on the live CSPS database with the owner present, with a rollback plan and post-go-live monitoring; CSPS has served the live site since Phase 3

## Phase Details

### Phase 1: Hosting Verification & Backend Foundation

**Goal**: A developer can clone the repo and run a zero-warning onion API against an empty, EF-migrated `CSPS_` database. The API carries the platform contract (ProblemDetails, health, logging, security headers, default-deny authorization) and the shared primitives every slice needs (business calendar, SiteSettings core, append-only audit log, SQL test fixture). A verified record of the SmarterASP.NET hosting facts sits alongside it.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06, FND-07, FND-08, FND-09, FND-10, FND-11, FND-12, FND-13, QUAL-01, QUAL-03, QUAL-06, SEC-01, SEC-02, SEC-04
**Success Criteria** (what must be TRUE):
  1. **Empty-database schema.** From a fresh clone with no `.bak` anywhere, `dotnet ef database update` builds the full schema on an empty `CSPS_` LocalDB database, and the dev seed makes it usable. The idempotent migration script applies twice without error at the host's compatibility level.
  2. **Strict build.** `Csps.slnx` (four `src/` projects, the test projects, `tools/`) builds with zero warnings, and the VS template scaffold is gone. Each of these fails the build or the architecture tests:
     - a forbidden layer or package reference
     - a floating version
     - a package with no recorded license or legitimacy check

     Missing a coverage threshold fails the test run.
  3. **Platform contract.** The running API behaves as follows:
     - `/health` reports liveness, DB reachability and time-zone resolution without exposing internals.
     - An unknown `/api/*` route returns a ProblemDetails 404 with `traceId`, never `index.html`.
     - Every response carries the strict CSP/HSTS header set.
     - An endpoint without a policy or matrix row fails the discovery-driven authorization test.
  4. **Shared backend primitives:**
     - Under a fake clock at Manila boundaries, "today" and the month and year boundaries resolve in the business time zone.
     - SiteSettings (name, time zone, currency/locale, contact placeholders) are read through a cached port.
     - Audit rows can be appended, but DB-level UPDATE and DELETE fail.
     - Logs carry a correlation id and mask secrets.
     - Data Protection keys survive an app restart.
  5. **Test fixture and hosting record.** Integration tests run in parallel against isolated `CSPS_Test_<guid>` databases with Respawn resets (Testcontainers in CI). The hosting verification record lists:
     - .NET runtime patch, `@@VERSION`, compatibility level and collation
     - in-process hosting and the proxy/client-IP topology
     - the SMTP SPF/DKIM/DMARC result
     - scheduler availability, DB quota and the staging-site option

**Owner decisions to close at discuss step:**
- **OD-1** currency/locale
- **OD-2** business time zone
- **OD-12** sender address/domain (needed for the SMTP deliverability check)
- **OD-13** OpenAPI in production
- **C-20** LocalDB vs container test databases
- **C-28** amend the CLAUDE.md line "restore the `.bak` into LocalDB as `CSPS_Dev`" to `CSPS_Legacy_Restore`
- **C-29** Testcontainers' random ports vs the 49152–65535 rule
- **C-30** dedicated `CSPS` LocalDB instance
- **C-31** confirm: no JSON columns, and pin the compatibility level to the host's
- **C-32** Data Protection key encryption at rest
- **C-45** the owner prerequisites below
- **S-3** NetArchTest vs ArchUnitNET
- **S-4** coverlet.MTP + ReportGenerator
- **S-5** license exceptions: MPL-2.0 for axe-core, OFL-1.1 for fonts
- **S-10** release cool-down
- **S-11** remove SpaProxy

**Owner prerequisites:**
- SmarterASP.NET control-panel access, or the owner runs the verification queries, for the hosting record (FND-13).
- A sender domain with DNS access, for the SPF/DKIM/DMARC check.

If access lags, the hosting-spike plan runs last. The other plans then proceed on LocalDB with a provisional compatibility-level pin.

**Research flag:** Needs research.
- Host facts are LOW confidence.
- The sources contradict each other on EF compatibility level and the `json` type (C-31).
- MapStaticAssets cache headers and `AllowAnonymous` on static files and the SPA fallback need a spike.

**Plans**: 13/13 plans complete in 7 waves

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Owner package-legitimacy gate, strict onion solution (scaffold removed), /health liveness, architecture/build/registry tests (W1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Empty-DB schema from InitialCreate, SiteSettings singleton + cached port, LocalDB `CSPS_Test_` fixture, zone fallback chain (W2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — /health database + time-zone checks over IBusinessCalendar; Manila day/month/year boundaries; health failure modes (W3)
- [x] 01-04-PLAN.md — Guarded `tools/Csps.DevSeed`, migration verification (idempotent ×2 at 160/170), startup-safety rule, Respawn + isolation, stale-DB cleanup (W3)
- [x] 01-05-PLAN.md — AuditEntry domain record with /24 and /48 IP truncation and regex-free UA family (W3)
- [x] 01-06-PLAN.md — ProblemDetails contract + /api 404 fallback, Result/Error mapping, strict security headers, web.config, Development-only OpenAPI/Scalar (W3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-07-PLAN.md — Serilog compact JSON with correlation id, secret masking, D-21 file retention, IRequestContext without forwarded headers (W4)
- [x] 01-12-PLAN.md — Owner D-28 decision, key-protected HostProbe, HOSTING-RECORD checklist + doc-lint test (W4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-08-PLAN.md — JWT validation, default-deny + Staff/Manager policies, GET /api/v1/site-settings, discovery-driven authorization matrix, 401/403/500 paths (W5)
- [x] 01-09-PLAN.md — Owner D-25 decision, append-only AuditLog (trigger, truncate guard, EF interceptor), IAuditTrail (W5)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 01-10-PLAN.md — Data Protection keys in DB encrypted by certificate, rotation runbook, local full-stack run (W6)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 01-11-PLAN.md — Coverage gate, third-party notices + license gate, exact solution layout, developer guide, clean-clone proof (W7)
- [x] 01-13-PLAN.md — Owner runs the approved host checks; record completed; compatibility level kept at 160, provisional (D-33; re-pin at Phase 17 cutover) (W7)

### Phase 2: Web Foundation & Design System

**Goal**: Visitors and staff see the approved UI-spec design system in working public and admin layouts, served from `wwwroot` by a strict TypeScript app. Its primitives, formatters, HTTP client and quality gates are all in place, so feature phases only compose. The gates are lint, axe, bundle budgets, Lighthouse and the Playwright host.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: WEB-01, WEB-02, WEB-03, WEB-04, WEB-05, WEB-06, WEB-07, WEB-08, WEB-09, WEB-10, ORD-09, QUAL-02, QUAL-04, A11Y-01, A11Y-02, A11Y-04, PERF-01, PERF-02, PERF-03, PERF-05
**Success Criteria** (what must be TRUE):
  1. **Build and dev server:**
     - `npm run build` emits the app into `src/Csps.Server/wwwroot`.
     - `npm run dev` serves it on 5180 (`strictPort`), proxies `/api` to 5115/7028 and sets no machine-level env vars.
     - Typecheck, ESLint and Prettier pass at `--max-warnings 0`.
     - The build fails if public initial JS exceeds 150 KB gz, admin initial JS 250 KB gz or total CSS 35 KB gz.
     - The self-hosted fonts render the ₱ glyph in the brand font.
  2. **Layouts.** Public and admin layouts render the approved Appendix D design styled with Tailwind utilities (D-33, 2026-10-08: replaces "verbatim markup, DOM-snapshot equal"), proven visually equal to the approved design in both themes, with every reconciliation marked `// SPEC-DEVIATION`. They work from 320 to 1920 px with no horizontal scroll and have:
     - a skip link
     - labelled landmarks
     - focus-trapped dialogs
     - one `h1` per page
  3. **Shared primitives.** Every primitive passes unit tests and axe with zero violations:
     - skeletons with `aria-busy`
     - empty and error states
     - ConfirmDialog, Toast
     - DataTable (becomes cards on phones), Pagination, FilterBar/SearchBox
     - LazyImage, OtpInput, PasswordInput and the money input

     Money shows as `₱12,450.00`, with U+2212 for negatives, and dates as `Oct 6, 2026`. Money inputs accept only 2-decimal amounts on a numeric keypad.
  4. **Money math, HTTP and data fetching:**
     - The shared golden-vector file (≥ 200 cases, including half-centavo values) passes identically in xUnit and Vitest.
     - `httpClient.ts` has 100% coverage, including the single-flight 401 refresh.
     - Every POST carries an `Idempotency-Key` created once per form submission and reused on retry, and submit buttons stay disabled while a request is pending (WEB-09).
     - Lint rejects `fetch`, `httpClient` or `axios` imports outside `api.ts`.
     - TanStack Query defaults are in place: stale time, keep-previous pagination, and a 300 ms debounced search that can be cancelled.
  5. **E2E, Lighthouse and WCAG rulings:**
     - After the preflight, Playwright runs on 5199 across Chromium, Firefox, WebKit and phone viewports. It fails on any console error, CSP violation or axe violation.
     - Lighthouse CI scores the public shell ≥ 95 on mobile.
     - Every UI-spec item that conflicts with WCAG 2.2 AA has an owner ruling applied.
  6. **URL state.** List state lives in the URL query string through nuqs (WEB-10). The shared hook and parsers pass their unit and component tests: `?size=9999`, `?page=0` and `?status=bogus` fall back to their defaults and the URL is rewritten once; a page change adds a history entry, while a filter, search, sort, tab or view change replaces it and returns to page 1; defaults never appear in the URL; date filters stay `YYYY-MM-DD` in Manila time; and the search query key waits 300 ms. `NuqsAdapter` from `nuqs/adapters/react-router/v8` sits inside the router around `<Outlet/>`, and ESLint rejects the deprecated adapter paths, the nuqs `startTransition` option and `shallow: false`. The installed version is 2.10.1, or a newer stable version at least 14 days old that the owner approved at install.

**Owner decisions to close at discuss step:**
- **OD-14** UI-spec items that conflict with WCAG
- **C-10** icons: in-house `icons.ts` vs `lucide-react` (S-12 quantifies the trade-off)
- **C-11** admin-only dark theme toggle
- **C-22** tsconfig strictness vs the verbatim Appendix D code
- **C-25** client rounding change in `csps.ts`, which fixes the golden-vector expectation
- **C-34** iOS 14 px input zoom, handled via an owner-approved `overrides.css`
- **C-35** this exact list:
  - inactive rows at 72% opacity
  - accent as the only state indicator
  - lightbox buttons hidden on phones
  - hidden hover actions that stay focusable
  - danger toasts that auto-dismiss
- **S-1** TypeScript alias pair
- **S-2** `eslint-plugin-jsx-a11y-x`
- **S-6** vitest-axe vs an in-house matcher
- **S-7** doc corrections: MSW v3, react-router 8
- **S-8** openapi-typescript isolated in `tools/` vs hand-written DTOs with a drift check

**Research flag:** Needs research:
- the TypeScript 7 alias setup
- the React Compiler vs the verbatim code
- CSP behaviour of JSON-LD data blocks
- the public bundle budget with a monolithic `ui/index.tsx`

**Plans**: 43/43 plans complete: 40/40 executed in 13 waves, plus gap-closure plans 02-41 and 02-42 (UAT G-2-199) executed; review follow-up plan 02-43 (02-REVIEW-g199-42 WR-01/WR-02: the focus trap returns focus without scrolling, the scrim close rule loses its timing window) planned 2026-10-13 (from-scratch replan under D-33, 2026-10-08; superseded plans in `superseded-2026-10-08/`; the 2026-10-08 checker revision split 02-02, 02-11, 02-13 and 02-14 into the new 02-37 to 02-40 to keep every plan within the per-plan budget, with no renumbering)

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Tracer: anonymous SPA shell (GET/HEAD) from a committed fixture web root, file and D-29 404s, L-03 probe moves, matrix rows
- [x] 02-02-PLAN.md — Tracer: owner-approved npm toolchain installed, Vite + Tailwind token theme build the D-21 placeholder into the ignored wwwroot; LF and editor rules (conditional package-drift stop)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-03-PLAN.md — HiddenSegmentFileProvider (dot/tilde/backslash/8.3 paths 404), static-text compression and caching, hosting docs
- [x] 02-37-PLAN.md — Tracer: strict TS 7 / TS 6 alias pair, per-mode Vite config test, dev-route env files, robots.txt; isolated tools/openapi-gen install (conditional package-drift stop)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-04-PLAN.md — ESLint with every architecture and D-33 ban (one syntaxBans array), Tailwind lint, Prettier class sorting, console guard, axe helper, `verify`
- [x] 02-05-PLAN.md — Stylesheet contract and class gate (every token compiles, no colour literals, D-02 opacity allow-list), styling guide
- [x] 02-38-PLAN.md — Parity inputs: shared data-only scenario list and renderNode; spec appendices extracted byte-exact and hash-pinned

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-06-PLAN.md — npm kind in the dependency registry, npm license gate (D-26 + addendum), repository notices (D-35)
- [x] 02-07-PLAN.md — Golden vectors (>= 200) in xUnit OrderMath and Vitest csps.ts with D-09 rounding; App. D.1 reconciled
- [x] 02-08-PLAN.md — Business-zone date formatting and exact money-text helpers (ORD-09)
- [x] 02-09-PLAN.md — Playwright on HTTPS 5199 across five projects with console/CSP/axe guards and self-tests
- [x] 02-10-PLAN.md — fetch-based httpClient: single-flight refresh, capped retries, Idempotency-Key reuse, 100% coverage
- [x] 02-12-PLAN.md — Self-hosted fonts with one preload and metric-matched fallbacks (₱ never in Barlow or a system font)
- [x] 02-13-PLAN.md — Look-equality reference: frozen spec app with the test-pinned owner-rulings layer, route-served under the real CSP
- [x] 02-39-PLAN.md — TanStack Query defaults, keep-previous cancellable list query, 300 ms debounced search key, intent prefetch (WEB-08)
- [x] 02-40-PLAN.md — `tw` class marker, page-root and visually-hidden recipes, and the spec Icon API over lucide-react 1.53.0

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-11-PLAN.md — nuqs URL list state (parsers, push/replace, privacy, UrlStateLayout) wired to the 02-39 list query; URL-state guide
- [x] 02-14-PLAN.md — Look-equality harness live: comparator (styles, boxes, pixels, axe, CSP) with self-test; Button proven in three engines
- [x] 02-15-PLAN.md — OpenAPI snapshot → generated types → api.ts, with the drift chain
- [x] 02-16-PLAN.md — useSubmission (one Idempotency-Key per submission), focusFirstInvalid, describeHttpError copy

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 02-17-PLAN.md — Button family, pending state (WEB-09), ButtonLink/UiLink proven equal
- [x] 02-18-PLAN.md — Mark (JSX), Logo, motifs, MediaPlaceholder and the 56-icon wrapper proven equal
- [x] 02-19-PLAN.md — Badges, Avatar (O-1), SegmentedControl, Tabs ARIA with the D-03 cue
- [x] 02-20-PLAN.md — Field, PasswordField, Select with D-01 phone 16px
- [x] 02-21-PLAN.md — EmptyState, Skeleton, Toast and the D-04/O-5/O-7 toast queue

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 02-22-PLAN.md — Focus-trapped Modal and ConfirmDialog (cascade, type-to-confirm, stay-open failure)
- [x] 02-23-PLAN.md — Money, KpiCard, OrderTotals on the spec seed orders
- [x] 02-24-PLAN.md — OrderCard, DataTable, keyboard-accessible IncomeExpenseChart
- [x] 02-25-PLAN.md — ImageUploader (D-05) and marketing cards (O-2)
- [x] 02-26-PLAN.md — SiteHeader (O-3), Sidebar (D-27, D-BL-02), Topbar
- [x] 02-27-PLAN.md — SPEC-GAP MoneyInput, OtpInput, Checkbox (D-03), SkipLink
- [x] 02-28-PLAN.md — SPEC-GAP ErrorState, skeleton family, LoadingRegion, LazyImage

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 02-29-PLAN.md — React Router 8 data router, public layout and footer, error boundaries, public parity and E2E
- [x] 02-30-PLAN.md — ResponsiveTable with every list state, Pagination, SearchBox, FilterBar, URL-state integration

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 02-31-PLAN.md — Dev-only admin shell: theme toggle (D-13), rail/tab bar, preview pages, absent from production (D-20)

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 02-32-PLAN.md — SPEC-GAP MobileNavDrawer and UserMenu with keyboard E2E
- [x] 02-33-PLAN.md — Build-enforced budgets (150/250/35 KB gz), one-CSS and no-dev-code rules in verify

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 02-34-PLAN.md — `@/ui` barrel and the /dev/components showcase in both themes, page-level axe

**Wave 12** *(blocked on Wave 11 completion)*
- [x] 02-35-PLAN.md — Lighthouse >= 95 on the real host, responsive sweep, ₱ proof, WCAG rulings, keyboard journeys, full parity matrix

**Wave 13** *(blocked on Wave 12 completion)*
- [x] 02-36-PLAN.md — Local owner visual review (D-23) and the guarded side-by-side with the design exports (D-24)

**Gap closure** *(UAT G-2-199, planned 2026-10-13; run with `/gsd-execute-phase 2 --gaps-only`)*
- [x] 02-41-PLAN.md — Dialogs fit a short window (owner ruling D-42): the 140px top gap shrinks to 16px (96px to 0 on phones), the backdrop scrolls, its scrollbar never closes the dialog; same rule in the parity reference
- [x] 02-42-PLAN.md — Backdrop close rule (D-42, re-verification gap truth 28): the scrim closes on a primary click that did not scroll it, so classic and overlay scrollbar drags and middle/right presses never close the dialog; two real-scrollbar Chromium projects prove it

**Review follow-up** *(02-REVIEW-g199-42 WR-01/WR-02, owner 2026-10-13; run with `/gsd-execute-phase 2 --gaps-only`)*
- [x] 02-43-PLAN.md — Focus that leaves a dialog comes back to where it was without scrolling (useFocusTrap, WR-01), so a non-closing press keeps the caret in the confirm field and the backdrop in place in all seven projects; the scrim close rule drops its focus re-read and timing window (WR-02)

**UI hint**: yes

### Phase 3: CI/CD & Deploy

**Goal**: Every pull request is gated by the full pipeline. A deploy runs only when the owner presses Run on a build of `main` that passed CI. It puts CSPS on the live SmarterASP.NET site, where CSPS replaces the legacy site, and a smoke test proves it or the last good package is put back automatically.
**Mode:** mvp
**Depends on**: Phase 2, because the pipeline runs the web gates. **Owner decision (2026-10-14): deferred; runs after Phase 4.**
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04, OPS-05
**Amended** (owner, 2026-10-15; 03-CONTEXT D-01 to D-19): the Basic plan has no second site, so there is no staging site and every deploy goes to the live site. The owner overrides Prime Directive 1: the legacy site and database are retired in Phase 3, after a verified `.bak` and the legacy site files are kept.
**Success Criteria** (what must be TRUE):
  1. **Merge gate.** A pull request to `main` can't merge until every check passes, in this order:
     1. locked restore
     2. .NET build, format check
     3. unit, integration and architecture tests
     4. web typecheck, lint, Prettier, Vitest with coverage
     5. web build, Playwright, Lighthouse CI
     6. coverage gates and generated `THIRD-PARTY-NOTICES`

     GitHub Free can't enforce branch rules on a private repo, so the gate is a process (D-08): CI runs every check on every PR, and the one merge command refuses to merge unless every check on the PR head is green and the PR template's Definition of Done checklist is ticked. The intended rules (required checks, linear history, 0 required approvals, CODEOWNERS, no bypass) are written down, ready to switch on. When the free CI minutes run out, a merge needs the local full gate with its output pasted in the PR (D-16).
  2. **Supply chain.** Dependabot (NuGet, npm, Actions, with a 14-day cooldown) runs on the repo with the owner-approved free set (D-10): gitleaks in CI and before each commit, NuGetAudit as error, `npm audit`, the license gates, .NET analyzers and ESLint. CodeQL, secret scanning and dependency review are not available on a free private repo. Every action is pinned by SHA with least-privilege permissions.
  3. **Live deploy.** A merge to `main` builds a deploy package tied to its commit. The owner pressing Run (`workflow_dispatch`) is the manual approval: the chosen CI-passed package goes to the live site through Web Deploy with `app_offline.htm`. The smoke test then passes, including `/health` and an unknown `/api/*` route that returns ProblemDetails through IIS. If it fails, the last good package is redeployed automatically and the run is marked failed (D-11, D-13).
  4. **Hosting configuration.** The live site serves in-process with:
     - HTTPS redirect
     - server headers removed
     - compression
     - `immutable` hashed assets and a `no-cache` `index.html`

     The smoke test checks each of these. Production secrets exist only on the server. The first deploy also verifies every "Verify on the first deploy (Phase 3)" row in the hosting record, and the owner bootstraps the first Manager and signs in (D-06).
  5. **Legacy retired safely.** Before the legacy database is deleted, the owner keeps a fresh `.bak` and the legacy site files off the host and confirms a local restore receipt of table names and row counts (D-04, D-05). CSPS then gets a new, empty SQL Server 2025 database with its compatibility level verified and pinned (D-03). Legacy data is never changed on the host.
  6. **Holding page.** Until the Phase 11 public pages, every public path shows one branded holding page (shop name, a short "new website on the way" line, phone, Facebook link, address and hours) that passes the axe, Lighthouse, bundle-budget and no-long-dash gates (D-17). The admin portal stays as built in Phase 4.

**Owner decisions to close at discuss step:**
- **C-27 / S-9** private-repo security tooling: make the repo public, pay for GitHub code and secret security, or accept the weaker free substitute set
- **C-45** the repo and host prerequisites below

**Owner prerequisites:**
- The GitHub repository exists (owner-created, private) and Claude has access.
- SmarterASP.NET Web Deploy credentials for the live site (the Basic plan has no second site).
- The owner enters the repository secrets and the app-pool settings on the host.
- The CODEOWNERS identity.
- The control-panel steps in the cutover runbook (D-18): the fresh `.bak` and legacy file download, the database delete and create, the host settings, and the first Manager sign-in.

**Research flag:** Standard patterns for the CI pipeline. SmarterASP.NET Web Deploy specifics (the AppOffline rule, the live-site deploy and rollback) are researched in 03-RESEARCH.md. They build on Phase 1's hosting record and stay LOW confidence until the first deploy verifies them.

**Plans:** 23/23 plans complete

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — CI tracer: owner approves the CI actions and tools, decides the Phase 4 ordering; the draft PR gets a green, SHA-pinned, ordered `gate (fast)` (OPS-02)
- [x] 03-02-PLAN.md — E2E and Lighthouse follow one CSPS_E2E_CONNECTION override for the CI SQL container; coverage gate Linux-safe (OPS-02)
- [x] 03-03-PLAN.md — Process merge gate (D-08) and the one merge command, with the owner's `[ci skip]` rule and the D-16 local-gate mode (OPS-01)
- [x] 03-04-PLAN.md — CI modes: docs, fast, full and package (proven-tree reuse on main) from one tested classifier (D-14)
- [x] 03-05-PLAN.md — CODEOWNERS, PR template with the Definition of Done, written branch rules and ruleset, CLAUDE.md merge rule, Dependabot with a 14-day cooldown (OPS-01, OPS-03)
- [x] 03-06-PLAN.md — Web Deploy orchestrator: app_offline, sync, smoke, release, automatic rollback, first-deploy safety, online escape hatch, optional host probe (OPS-04)
- [x] 03-07-PLAN.md — Production smoke test: health with cold-start retry, ProblemDetails through IIS, HTTPS, headers, compression, caching, AllowedHosts, requestLimits (D-06)
- [x] 03-08-PLAN.md — web.config never compresses; the win-x64 package never carries dev logs or Development settings; lock files match (OPS-05)
- [x] 03-23-PLAN.md — Owner approves the exact wording, then the Phase 3 entry, OPS-04 (and OPS-01), the Prime Directive 1 override and Phases 16 and 17 are amended to match 03-CONTEXT (wave 1, docs only)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-09-PLAN.md — Branded holding page with the owner's shop facts on every public path (D-17)
- [x] 03-10-PLAN.md — gitleaks secret scan on every PR and before every commit, pinned and checksum-verified (OPS-03)
- [x] 03-11-PLAN.md — Full OPS-02 order in CI with Playwright and Lighthouse on a CI SQL container; weekly all-engine run (OPS-02, D-15)
- [x] 03-12-PLAN.md — Manual-only, main-only, least-privilege deploy workflow; branded app_offline.htm; deploy runbook (OPS-04, D-11, D-12)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-13-PLAN.md — Deploy package on every push to main: publish, migration script, content check, secret scan, artifact (D-11, OPS-05)
- [x] 03-14-PLAN.md — Control-panel facts, guarded legacy-receipt script and the numbered D-18 cutover runbook

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03-15-PLAN.md — Conventional Commits check and actionlint/zizmor workflow lint, as approved (OPS-01, OPS-02)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 03-16-PLAN.md — Free repository settings applied; the ready Phase 3 PR passes the full gate on GitHub; CI minutes measured

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 03-17-PLAN.md — Owner decides the mid-phase pipeline merge; the gated merge lands on main and builds the first package

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 03-18-PLAN.md — Cutover step 1: fresh legacy .bak and files kept; local restore and names-and-counts receipt (D-04, D-05)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 03-19-PLAN.md — Cutover steps 2-3: receipt confirmed, legacy database retired, SQL Server 2025 database created and compatibility pinned (D-03)

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 03-20-PLAN.md — Cutover steps 4-5: host settings and deploy credentials, read-only dry run, one-time host probe, HTTPS rewrite ruling

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 03-21-PLAN.md — Cutover steps 6-7: schema script applied, first CSPS deploy on the live site with smoke and release (OPS-04)

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 03-22-PLAN.md — Cutover step 8: first Manager and sign-in on the live site; every first-deploy fact verified; CSPS accepted live (D-06)

### Phase 4: Identity & Authentication

**Goal**: Staff can securely sign in with email, password and a mandatory 6-digit code sent by email. They stay signed in the way they chose, can recover a forgotten password and can sign out everywhere. Every authentication event is audited.
**Mode:** mvp
**Depends on**: Phase 2, because the sign-in screens use the layouts and OtpInput/PasswordInput. **Owner decision (2026-10-14): runs before Phase 3**, so auth is gated by the local build/test/lint run until the Phase 3 pipeline exists, and its first deploy, to the live site, happens in Phase 3.
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, AUTH-11, AUTH-12, AUTH-13, QUAL-05, SEC-03, SEC-06, A11Y-03, AUDIT-01
**Success Criteria** (what must be TRUE):
  1. **Sign-in with the emailed code.** A staff member enters email and password, receives a 6-digit code by email, pastes or types it (`autocomplete="one-time-code"`) and reaches the admin portal. An unknown email, a wrong password and a deactivated or locked account all get the same generic error with similar timing, and none gets a session.
  2. **Code and lockout limits:**
     - A code works once within 15 minutes and dies after 5 wrong tries, with a per-account cap across tickets.
     - A code can be resent after 60 s, up to 5 times an hour, and each resend invalidates the previous code.
     - 5 failed passwords lock the account for 15 minutes and email the user.
     - Per-IP and per-account rate limits throttle the auth endpoints.
  3. **Sessions:**
     - With "Keep me signed in", the session survives browser restarts for 90 days.
     - Without it, the session ends when the browser closes, after 12 hours at most.
     - Several open tabs refresh without signing each other out, but replaying a rotated refresh token revokes its whole family.
     - Sign out and "sign out of all devices" end sessions immediately.
  4. **Password reset.** A staff member can request a reset link; the response never reveals whether the account exists. The new password must meet the owner's rule (D-11, D-15):
     - at least 8 and at most 64 characters with a number and a symbol
     - not in breach corpora
     - doesn't contain the user's email or name
     - a strength meter is shown

     After the reset, all of the user's sessions are revoked and a "password changed" email arrives.
  5. **Bootstrap, email and audit:**
     - On an empty, production-like database, the `bootstrap-manager` CLI creates a first Manager who can sign in.
     - Auth emails go out through the outbox, from the business sender over TLS.
     - E2E reads codes from the Testing-only sink, and a test proves the sink is absent from Release.
     - Sign-in, 2FA, lockout and reset events appear in the audit log.
  6. **Idempotent form posts.** Every state-changing POST needs an `Idempotency-Key` (SEC-06). Replaying a request returns the first response and creates nothing new; for example, a repeated forgot-password post queues one email. Reusing a key with a different body gets 422, a duplicate that arrives mid-request gets 409 and a missing key gets 400. The endpoint discovery test fails on any POST that is neither covered nor on the written allow-list (e.g. sign-in, 2FA verify, refresh, sign-out). Keys expire after 24 hours.

**Owner decisions to close at discuss step:** Send these as one security batch before the phase starts.
- **OD-12** sender address/domain, SPF/DKIM/DMARC
- **C-4** emailed invite link vs a Manager-set temporary password (ruled here, applied in Phase 5)
- **C-5** NIST policy vs "8+ characters with a number and a symbol"
- **C-6** composition of the 2FA screen
- **C-7** full email reset flow vs "Ask a Manager"
- **C-8** generic error vs "This account is deactivated."
- **C-9** email change with confirmation (ruled in this batch, applied in Phase 5)
- **C-19** whether "Keep me signed in" is checked by default
- **C-23** confirm the `__Secure-csps_rt` cookie
- **C-33** HIBP fail-open vs fail-closed
- **C-17** spec-gap screens: 2FA, forgot/reset password, invite acceptance
- **OD-14**

**Owner prerequisites:**
- SMTP mailbox credentials for the sender address on SmarterASP.NET.
- DNS access to publish SPF/DKIM/DMARC, if Phase 1 didn't finish it.

**Research flag:** Needs research:
- `__Secure-` cookies over the Vite HTTPS proxy and in Playwright WebKit (spike)
- the refresh grace-window design
- timing-parity tests

**Plans**: 35/35 plans complete in 18 waves (planned 2026-10-14; execution starts after the owner's D-34 mail prerequisite in 04-01)

**Status:** Complete (2026-10-17). Verification passed 6/6 with 18/18 requirement IDs, UAT 3/3 (C-23 confirmed on the live site on 2026-10-17), threats_open 0, and no review finding left open. The owner decisions above were closed at the discuss step (`04-CONTEXT.md`). Carried to Phase 5: the refresh cookie `Expires` check, review info notes IN-01 to IN-19, and the flaky resend-code test.

**Wave 1**
- [x] 04-01-PLAN.md — Owner prerequisites: no-reply mailbox, DKIM and the Gmail D2 check (D-34), the 10.0.13 runtime (D-35), stdin-only dev secrets (IN-02)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 04-02-PLAN.md — Owner-approved packages (D-36) with registry, notices and the npm legitimacy checkpoint; MSW test harness
- [x] 04-03-PLAN.md — Audit write path hardening (WR-01/02/03/05/06), unit of work, AUDIT-01 action catalog
- [x] 04-04-PLAN.md — Owner password rule (D-11, D-15) in the Domain and the browser mirror on shared cases; AUTH-11 amended
- [x] 04-05-PLAN.md — Emailed-code challenge rules (AUTH-02/03/04) as a pure Domain state machine
- [x] 04-06-PLAN.md — Session rotation rules R1-R5 and the coarse device label (D-32, D-43)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 04-07-PLAN.md — Controllers under the owner's rules, 401/429 error contract with machine codes, 1 MB body limit and list caps (SEC-03)
- [x] 04-08-PLAN.md — Identity accounts on schema v2 with the two roles and the account port

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 04-09-PLAN.md — Email outbox and dispatcher with the code email, SMTP over required TLS and the Debug-only Testing sink

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 04-10-PLAN.md — Testing-only email and staff-fixture endpoints, Testing E2E host (D-37), Release proof (QUAL-05)
- [x] 04-11-PLAN.md — Two-factor persistence with HMAC-bound codes and secure random values
- [x] 04-17-PLAN.md — Breach checks: HIBP k-anonymity, common-password floor, fail-open and fail-closed modes (D-12, D-14)
- [x] 04-33-PLAN.md — The other six auth emails with the UI-SPEC copy, and D-33 retries, expiry, single send and no secrets in logs

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 04-12-PLAN.md — Sign-in endpoint: ticket cookie and code email, generic failures with timing parity, lockout (AUTH-01/07/10)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 04-13-PLAN.md — Sessions, typed access tokens and immediate revocation; database-backed authorization matrix

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 04-14-PLAN.md — Code verify and resend, cross-ticket cap, must-change hand-off, anti-CSRF header
- [x] 04-34-PLAN.md — Session store lookups and bulk revocation for rotation and sign-out-others (D-05), and the caller's session id

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 04-15-PLAN.md — Rotating refresh with grace and reuse detection, sign-out, sign-out-others (AUTH-05/06, D-05, D-44)

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 04-16-PLAN.md — Signed-in devices API: list my sessions, sign out one (D-43)
- [x] 04-25-PLAN.md — Web session client, route guard with safe return path, multi-tab refresh, admin behind sign-in (D-20 reversal)

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 04-18-PLAN.md — Forgot password: hashed fragment-only reset links, same answer for every email (AUTH-08, D-20)
- [x] 04-26-PLAN.md — AuthLayout and the S1 sign-in screen (App. E.5) with Note, banner alignment and tap areas

**Wave 12** *(blocked on Wave 11 completion)*
- [x] 04-19-PLAN.md — Reset password: link check, full rule with breach floor, every session ended (AUTH-09, D-19)
- [x] 04-27-PLAN.md — S2 code step, end-to-end sign-in in every browser, refresh-cookie spike in three engines

**Wave 13** *(blocked on Wave 12 completion)*
- [x] 04-20-PLAN.md — Idempotency-Key on every state-changing POST with the written allow-list (SEC-06, D-40)
- [x] 04-28-PLAN.md — S4 and S5 reset screens with mirrored validation

**Wave 14** *(blocked on Wave 13 completion)*
- [x] 04-21-PLAN.md — Must-change gate and late breach re-check (D-13, D-18, D-22)
- [x] 04-29-PLAN.md — S7 Signed-in devices page with per-device and other-devices sign-out

**Wave 15** *(blocked on Wave 14 completion)*
- [x] 04-22-PLAN.md — First-Manager bootstrap handler and invite acceptance with a fail-closed breach check (AUTH-12, D-29)
- [x] 04-30-PLAN.md — User-menu session items, inert page behind dialogs (R2-10), 12-hour cap warning, two-tab proof

**Wave 16** *(blocked on Wave 15 completion)*
- [x] 04-24-PLAN.md — Per-IP rate limits on every auth endpoint (SEC-03, D-39)
- [x] 04-31-PLAN.md — S3 must-change and S6 invite screens
- [x] 04-35-PLAN.md — The guarded bootstrap-manager command and the first-Manager runbook (AUTH-12, CWE-214)

**Wave 17** *(blocked on Wave 16 completion)*
- [x] 04-23-PLAN.md — Branded auth emails with the inline logo and the owner's preview tool (D-30)

**Wave 18** *(blocked on Wave 17 completion)*
- [x] 04-32-PLAN.md — S1 look-equality proof, SPEC-GAP review pack, overflow sweep, auth API guide, Phase 3 checks, full local gate

**UI hint**: yes

### Phase 5: Profile & User Management

**Goal**: Every staff member can manage their own name, email, password and theme. Managers can run the staff roster safely: invite, edit, lock, deactivate and delete users under guard rules. Every action is audited and can be reviewed.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, USER-07, USER-08, AUDIT-02, SEC-07, SEC-08
**Success Criteria** (what must be TRUE):
  1. **Own profile.** A signed-in user can:
     - change their name
     - change their password after entering the current one; their other sessions end and a notice is emailed
     - change their email only by confirming a link sent to the new address, while the old address gets a notice
     - switch the admin theme between Blush and Espresso; the choice persists and the public site stays light
  2. **Roster management.** A Manager can:
     - list users with paging, search by name or email, and filters for role and status
     - add a user who is onboarded without the Manager ever seeing or setting the password
     - resend an invitation or send a reset link
     - edit name, email and role; lock and unlock; deactivate and reactivate
     - delete with confirmation; the deleted user's name stays on the orders and expenses they recorded
  3. **Guard rules.** A Manager can't delete, deactivate or demote themselves. Two simultaneous attempts can never remove the last active Manager. A role or status change signs the affected user out at once.
  4. **Manager-only access.** An Admin never sees the Users navigation item. Opening `/admin/users` redirects to `/admin`, and the API answers 403.
  5. **Audit-log viewer.** A Manager can open the audit log, filter it by actor, action, target and date range, and find every user-management action.
  6. **Conflict-safe edits.** Two people saving the same record never both succeed (SEC-07). The stale save gets 409 with "This was changed by someone else. Reload and try again.", and the screen shows that message and reloads the latest version. A two-writer integration test proves it, and the same rule applies to every later aggregate.
  7. **Who entered it.** Every user a Manager creates or edits, and every profile change, records who did it and when (SEC-08): `CreatedBy`, `CreatedAt`, `UpdatedBy` and `UpdatedAt`, set by the server from the signed-in user and the clock. Values a client sends for them are ignored, and an integration test proves it. Users created before this phase, such as the bootstrap Manager, show "System". The user detail shows "Recorded by" and "Last changed by" read-only (SPEC-GAP), and the names survive deactivation and deletion. The same rule applies to every later record staff create or edit.

**Owner decisions to close at discuss step:**
- **C-41** soft-delete users: scramble the email, block sign-in, keep the name. The ruling also decides how "Recorded by" and "Last changed by" (SEC-08) keep a deleted user's name: the soft-deleted user's kept name, or a stored name snapshot
- **C-4 and C-9** apply the Phase 4 rulings, or ask now if still open
- **C-35** apply the Phase 2 ruling on inactive-row contrast
- **C-17** spec-gap screens: email-change confirmation, audit log
- **OD-14**

**Carried over from Phase 4** (owner, 2026-10-15; production was not deployed yet):
- **UAT: production Set-Cookie behaviour.** After the first HTTPS deploy, sign in and check that the responses set `__Secure-csps_rt` and `__Secure-csps_2fa` with HttpOnly, Secure, SameSite=Strict and Path=/api/v1/auth, with Expires only when "Keep me signed in" is ticked. The cookie attributes were confirmed on the live site on 2026-10-17 and 04-UAT Test 2 passed; Phase 5 UAT still checks the Expires part.
- **Phase 4 review info notes (IN-01 to IN-19).** Triage and fix the 19 info-level findings in `04-REVIEW.md`, test first where behavior changes (for example IN-09 response size cap, IN-10 URL user info, IN-08 outbox recipient retention, IN-07 loopback forms). Record each outcome in `04-REVIEW-DISPOSITION.md` (owner, 2026-10-17).
- **Flaky `ResendCodeEndpointTests.TheSixthCodeInAnHourIsRefusedWithNoWaitTime`** (from `.planning/phases/04-identity-authentication/deferred-items.md`): make it pass reliably in full runs without weakening the per-hour cap it proves.

**Research flag:** Standard patterns.

**Plans**: 47/52 plans executed: 43 in 21 waves, plus 9 gap-closure plans (05-44 to 05-52) in 3 gap waves planned 2026-10-19 (planned 2026-10-17; revised the same day so no plan exceeds the context budget; the owner's shell and motion items come first, in Waves 1-2)

**Wave 1**
- [x] 05-01-PLAN.md — Full-bleed shell, phone tab bar at the viewport bottom, sticky sidebar and top bar, no sideways scroll (D-01..D-05, D-36)
- [x] 05-02-PLAN.md — Open and close motion for every dialog and slide-over with an in-house presence hook (D-38, D-39)
- [x] 05-03-PLAN.md — Manager-only route guard, fail-closed role mapping (IN-17), six new icons (USER-08)
- [x] 05-04-PLAN.md — No-new-triggers schema test (D-06) and the flaky resend-code test
- [x] 05-05-PLAN.md — Staff account schema (edit version, attribution, Manager lock, soft-delete marker, pending email); blocked accounts cannot sign in
- [x] 05-06-PLAN.md — Invitation links last 7 days (D-13)
- [x] 05-07-PLAN.md — Review notes IN-07, IN-08, IN-09, IN-10, IN-12

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 05-08-PLAN.md — Drawer and user-menu motion; existing dialogs close with motion (D-34, D-35, D-39)
- [x] 05-09-PLAN.md — Profile API: name save with the edit version and the two-writer helper (PROF-01, SEC-07)
- [x] 05-10-PLAN.md — Every auth path refuses Manager-locked and deleted accounts (D-16, D-17, D-41 Q5)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 05-11-PLAN.md — Server-set attribution in one stamping point (SEC-08)
- [x] 05-13-PLAN.md — My Profile page: tabs, name save with the conflict banner, theme (PROF-01, PROF-04, D-20, D-23)
- [x] 05-38-PLAN.md — Profile name change audited by field names only; profile handler unit tests (USER-06, D-40)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 05-12-PLAN.md — Change password from My Profile (PROF-03, D-41 Q9)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 05-14-PLAN.md — Email change: request and confirm through a 24-hour link (PROF-02, D-25)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 05-39-PLAN.md — Email change: shared current-password check, address rules, link check and exact email copy (PROF-02, D-24, D-41 Q9)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 05-15-PLAN.md — Email change: pending state, resend, cancel, taken meanwhile (D-24)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 05-16-PLAN.md — Confirm-your-email page and shared fragment helpers (PROF-02, IN-18 part)
- [x] 05-17-PLAN.md — Users roster API: list and detail with attribution (USER-01, USER-08, D-09, D-11)

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 05-18-PLAN.md — My Profile Security tab and Change Email dialog (PROF-02, PROF-03)
- [x] 05-19-PLAN.md — Create a user by invitation or temporary password (USER-02, C-4, SEC-08)
- [x] 05-20-PLAN.md — Users roster page with URL state (USER-01, USER-08)
- [x] 05-36-PLAN.md — Web review notes IN-11, IN-13..IN-16, IN-18, IN-19

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 05-21-PLAN.md — Race-safe last-Manager guard, deactivate and activate (USER-04, USER-05, D-18, D-19)
- [x] 05-22-PLAN.md — Add User panel, RadioGroup, temporary password shown once (USER-02, D-12, D-14, D-15)

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 05-23-PLAN.md — Edit a user's name and role with the edit version; two-writer proof (USER-03, USER-04, USER-05, SEC-07)

**Wave 12** *(blocked on Wave 11 completion)*
- [x] 05-40-PLAN.md — A Manager changes a colleague's email the C-9 way, or cancels a pending change (USER-03, C-9)

**Wave 13** *(blocked on Wave 12 completion)*
- [x] 05-24-PLAN.md — Manager lock and unlock (D-16, D-17)
- [x] 05-25-PLAN.md — Edit User panel with the conflict banner and Recorded by / Last changed by (SEC-08, D-11)

**Wave 14** *(blocked on Wave 13 completion)*
- [x] 05-26-PLAN.md — Final soft delete (D-07..D-11)
- [x] 05-32-PLAN.md — Expandable table rows, grouped Select, DateInput, Audit Log navigation item

**Wave 15** *(blocked on Wave 14 completion)*
- [x] 05-27-PLAN.md — Resend invitation, send reset link, set temporary password (USER-07, C-4)
- [x] 05-28-PLAN.md — Roster row actions: deactivate, activate, delete

**Wave 16** *(blocked on Wave 15 completion)*
- [x] 05-29-PLAN.md — Audit log API: list, filters and date bounds (AUDIT-02, D-26..D-29, D-40)
- [x] 05-30-PLAN.md — Edit panel Account access, Lock and Temporary Password dialogs, email notes (USER-07, C-9)
- [x] 05-31-PLAN.md — Owner review of the Phase 5 emails (checkpoint)

**Wave 17** *(blocked on Wave 16 completion)*
- [x] 05-34-PLAN.md — Application review notes IN-01, IN-03, IN-05, IN-06
- [x] 05-41-PLAN.md — Audit filter people list and the viewer docs (AUDIT-02, D-11)

**Wave 18** *(blocked on Wave 17 completion)*
- [x] 05-33-PLAN.md — Audit Log page (AUDIT-02)
- [x] 05-43-PLAN.md — Application review notes IN-02, IN-04: one home for audit words, keys and messages

**Wave 19** *(blocked on Wave 18 completion)*
- [x] 05-35-PLAN.md — Component showcase for Managers at /admin/components (D-30..D-33)

**Wave 20** *(blocked on Wave 19 completion)*
- [x] 05-42-PLAN.md — Phase 5 demos in the showcase (UI-SPEC C1)

**Wave 21** *(blocked on Wave 20 completion)*
- [x] 05-37-PLAN.md — Phase gate: overflow and long-text sweeps, owner review pack and OQ rulings, review dispositions, full local gate (checkpoint)

**Gap closure** (planned 2026-10-19 from 05-VERIFICATION.md gaps_found and owner rulings D-49, D-50; 9 plans in 3 waves)

**Gap wave 1**
- [x] 05-44-PLAN.md — Sign Out Other Devices works on every use again; Resend Code too (CR-01, AUTH-06)
- [x] 05-45-PLAN.md — Temporary password, profile password change and at-once email move end open reset links (WR-01)
- [x] 05-46-PLAN.md — Temporary-password address unproved until the first correct code; sign-in still reaches the code (D-49, WR-03)
- [x] 05-48-PLAN.md — One active-Manager rule for the bootstrap gate; bootstrap tests can never reach TheBETSLLC's database (WR-05, WR-14, WR-08)
- [ ] 05-49-PLAN.md — Keyed idempotency request hash and a real 24-hour lifetime (D-50, security D-1)

**Gap wave 2** *(blocked on Gap wave 1 completion)*
- [ ] 05-47-PLAN.md — No reset link to an unproved address; an invited person's temporary password leaves it unproved (D-49, WR-03)
- [ ] 05-50-PLAN.md — 44 px tap areas for the phone menu button, sidebar toggle and filter-chip clear (WR-20, part 1)
- [ ] 05-52-PLAN.md — Rate-limit test for the profile password change and a guard over every limited endpoint (WR-09)

**Gap wave 3** *(blocked on Gap wave 2 completion)*
- [ ] 05-51-PLAN.md — Owner ruling D-51 on row-action spacing, row-action tap areas and the roster target-size sweep (WR-20, part 2; checkpoint)

**UI hint**: yes

### Phase 6: Company Expenses

**Goal**: Staff can record, find and total the shop's company expenses, with month KPIs that are correct in Manila time. This is the simplest aggregate, so it proves the slice pattern before the order aggregate: rowversion 409s, filters, period totals, query-count guards and ConfirmDialog.
**Mode:** mvp
**Depends on**: Phase 5, because "Recorded by" must survive user deletion
**Requirements**: CEXP-01, CEXP-02, CEXP-03, CEXP-04, CEXP-05, PERF-04
**Success Criteria** (what must be TRUE):
  1. **List and filter.** Staff can list company expenses (last 30 days by default, newest first), filter by date range and category, search by description or staff name, page through results and see the period total.
  2. **Edit with conflict protection.** Staff can add, edit and delete (after confirmation) an expense with a date, category, description and an amount above zero. Saving over someone else's newer change shows a 409 conflict instead of overwriting it. Deletion follows the OD-5 ruling.
  3. **Month KPIs.** KPI cards show this month, the last full month and this month's top category with its share. Month boundaries are in Asia/Manila, so an expense at 07:00 Manila time on the 1st counts in the new month.
  4. **Attribution.** Each expense shows a read-only "Recorded by", which is its creator even in the Edit modal, and, once edited, a read-only "Last changed by" (SEC-08). Both still show the name after that user is deleted, and values a client sends for them are ignored.
  5. **List performance.** The list endpoint runs a fixed number of queries whatever the page size (query-count test). It meets p95 < 300 ms on staging, with an index on every filter and sort column.
  6. **Paid by.** Every expense names who paid it (CEXP-05): a required, server-validated reference to an active Admin or Manager on create and edit, chosen from a staff lookup that both roles can use, with a plain-English field error otherwise. The list shows it, the staff-name search matches it, and a change of payer is audited because it moves money between staff balances (MONEY-01).

**Owner decisions to close at discuss step:**
- **OD-5** hard vs soft delete for company expenses
- **OD-8** fixed vs Manager-editable categories, for both the company and the order expense lists
- **C-43** whether the categories fit, e.g. SSS, PhilHealth, Pag-IBIG, BIR
- **OD-21** whether an expense can be paid by the company (e.g. from the business bank or GCash account) instead of a staff member (default: no, a staff member is required)
- **OD-14**
- **Sequencing check:** research recommends this slice before Orders. If the owner prefers Orders first, Phase 7 becomes the slice that sets the pattern.
- **No staging site** (Phase 3, owner 2026-10-15): where the p95 < 300 ms check in criterion 5 runs, since CSPS serves the live site and the Basic plan has no second site

**Research flag:** Standard patterns.

**Plans**: TBD
**UI hint**: yes

### Phase 7: Order Domain & API

**Goal**: The order aggregate and its full API enforce every owner-ruled business rule and always return correct, server-computed totals. The API covers create, read, list/search, update, child mutations, status and delete. Fixtures, invariant tests and race tests prove the Core Value before Phase 8 builds on it.
**Mode:** mvp
**Depends on**: Phase 6 (the proven slice pattern), Phase 4 (staff policies)
**Requirements**: ORD-03, ORD-05, ORD-08, ORD-13, ORD-14, ORD-16, ORD-17, ORD-18, ORD-20, ORD-21, ORD-22, ORD-23
**Success Criteria** (what must be TRUE):
  1. **Atomic create and numbering.** One API call creates an order atomically: customer details, dates, status, notes and one or more items, plus optional payments, discounts and expenses.
     - The order gets the next `ORD-{YYYY}-{NNNN}` number, with no duplicates under 20 parallel creates and the correct year across New Year in Manila.
     - Every item carries one of the 6 product types plus a size/variant.
  2. **Exact math.** The ORD-2026-0148 fixture reproduces exactly: Total ₱22,450.00 · Discount −₱1,122.50 · Paid −₱12,000.00 · Balance ₱9,327.50 · Expenses ₱6,065.00 · Profit ₱15,262.50. Every add, edit or removal of an item, payment, discount or expense revalidates the invariants and returns recomputed server totals. That includes the overpayment rule across all mutation types.
  3. **Concurrency.** Two concurrent edits to the same order never both succeed; the stale one gets 409. This holds for child-only edits too, such as two payments against one balance.
  4. **Status rules.** Status changes follow only the ruled transitions, and each one is recorded: from, to, who and when. Payments on cancelled orders and refunds follow the ruled policy, so collected-cash figures stay correct.
  5. **Legacy import path.** `Order.Import` accepts legacy-shaped data (preserved order numbers, lenient rules) through configurable rule constants. An owner ruling then becomes a constant change rather than a schema change.
  6. **Payment receiver.** Every payment names who received the money (ORD-22): a required, server-validated reference to an active Admin or Manager on payment create, payment edit and full-aggregate create, with a plain-English field error otherwise. A receiver change is audited, and a staff lookup gives both roles the list of eligible receivers.
  7. **Expense payer.** Every order expense names who paid it (ORD-23): a required, server-validated reference to an active Admin or Manager on order-expense create, order-expense edit and full-aggregate create, with a plain-English field error otherwise. A change of payer is audited because it moves money between staff balances (MONEY-01).

**Owner decisions to close at discuss step:** All of these must close before the first test.
- **OD-3 + C-39** statuses, transitions, reopen rules and status history
- **OD-4 + C-38** overpayments, including via removed items or added discounts. *OD-4 ruled by the owner, 2026-10-13: no overpayment; the server refuses a payment above the balance and the payment form warns during input. Still to confirm here: C-38 (other mutations that would push the balance below zero) and how already-overpaid legacy orders import and display.*
- **OD-5** order delete semantics (affects the schema)
- **OD-6** whether Admins can delete orders
- **OD-7** reusable Customer entity vs customer fields on each order
- **C-1** one discount vs many
- **C-3** create-flow shape; the API accepts the full aggregate as a superset
- **C-13** Total/Subtotal naming in the DTOs
- **C-14** whether the due date is required
- **C-15 + C-24** per-year counter, and whether the year comes from the creation instant in Manila or from `OrderDate`
- **C-37** refund and cancelled-with-downpayment policy
- **C-42** optional early read-only legacy fit check. If approved, insert it as Phase 7.1, and never derive the schema from it.
- **C-43** payment methods, e.g. cheque
- **C-44** fixed `ProductType` enum with no price-item FK
- **OD-15** (shape only; the final rule is a Phase 15 ruling) how legacy payments get a receiver and legacy order expenses a payer: `Order.Import` must be able to accept both, e.g. a "Legacy / unassigned" holder that can't sign in
- **OD-21** apply the Phase 6 ruling on company payers to order expenses, or ask now if still open

**Research flag:** Needs research:
- EF 10 complex-type `Money` translation for `Sum`/`OrderBy` (spike)
- counter-table locking under the execution strategy

**Plans**: TBD

### Phase 8: Order Screens

**Goal**: Staff can run every order day to day in the portal. They can find an order, create one, work its detail page (items, payments, discounts, expenses, totals and estimated profit) and delete it safely.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: ORD-01, ORD-02, ORD-06, ORD-07, ORD-10, ORD-11, ORD-12, ORD-15, ORD-19
**Success Criteria** (what must be TRUE):
  1. **Find orders.** Staff can browse orders as grid cards or a table, and the choice persists. They can:
     - search by number, customer, team or phone
     - filter by status (default "Active + recent"), date range, product type and "has balance"
     - sort and page through the results

     Cards and rows show overdue and days-left flags computed from Manila "today". They show "Fully Paid" when Total > 0 and Balance ≤ 0 (fixture ORD-2026-0151).
  2. **Create.** Staff can create an order through the UI-spec flow. Leaving the create or edit form with unsaved changes asks "Discard changes?".
  3. **Detail page.** The detail page shows the customer card, the live OrderTotals panel and tabbed Items/Payments/Discounts/Expenses tables with counts and add/edit/delete modals.
     - After every save, the figures come from the server.
     - A 409 conflict explains itself, keeps the user's input and offers a reload.
     - The payment modal has a required "Received by" picker of active staff (ORD-22, label per OD-20). The UI spec's modal lacks this field, so it is marked SPEC-GAP.
     - The order-expense modal has a required "Paid by" picker of active staff (ORD-23), and the Expenses tab shows it. The UI spec's modal and tab lack this field, so they are marked SPEC-GAP.
     - The order header and every add/edit modal show a read-only "Recorded by" and, once changed, "Last changed by" (SEC-08). On a payment, Received by is who took the money and Recorded by is who entered it.
  4. **Internal figures.** Staff see Order Expenses and Estimated Profit on the detail page. Neither appears anywhere outside the staff portal.
  5. **Safe delete.** Deleting an order shows its child counts and requires typing the order number. The order and all its children are then removed in one transaction, under the OD-5 and OD-6 rulings.

**Owner decisions to close at discuss step:**
- **C-13** on-screen labels for Total, Discount and Balance
- **C-18** where Estimated Profit appears
- **OD-20** payment field label: "Received by" or the owner's "Paid to"
- **OD-14**
- The Phase 7 rulings (C-3 flow, OD-5, OD-6) apply.

**Research flag:** Standard patterns, once Phase 7 is settled.

**Plans**: TBD
**UI hint**: yes

### Phase 9: Order Images & Maintenance Jobs

**Goal**: Staff can attach, arrange and view order photos, including straight from a phone camera. The photos load fast and stay private per the OD-9 ruling. Storage cleanup and token purges run as short, reliable, scheduled jobs.
**Mode:** mvp
**Depends on**: Phase 8, because the Images card joins the order form and detail page
**Requirements**: ORD-04, IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, JOB-01, JOB-02
**Success Criteria** (what must be TRUE):
  1. **Upload.** Staff can add images to an order during creation and later, up to the ruled per-order limit.
     - Uploads go through the server to a Cloudinary signed upload.
     - Files are checked by magic bytes: JPEG/PNG/WebP/HEIC only, ≤ 10 MB, within max dimensions, SVG rejected.
     - Files never touch local disk or the webroot, and the Cloudinary secret never reaches the browser.
  2. **Arrange.** Staff can reorder images and choose the cover with a non-drag control that works from the keyboard. They can set alt text and delete images. The cover appears as the lazy thumbnail in the order list, with a placeholder when there's none.
  3. **Delivery.** Images get random public ids under `csps/orders/{orderId}/`, and delivery strips EXIF/GPS. Pages load responsive variants with explicit sizes and placeholders, never larger than they're displayed.
  4. **Phone camera.** On a phone, staff can take a photo with the camera, and it's downscaled before upload.
  5. **Cleanup jobs.** Deleting an image or an order queues the Cloudinary deletion in the same transaction. The secret-protected maintenance endpoint, triggered on a schedule:
     - processes that queue with leases and retries
     - purges expired tokens, 2FA codes and idempotency keys

     A weekly orphan sweep reconciles storage.
**Owner decisions to close at discuss step:**
- **OD-9 + C-26** public vs authenticated delivery. Authenticated delivery allows eager variants only, and signed URLs don't expire below the Advanced plan.
- **C-2** 5 vs 12 images per order
- **C-16** accessible reorder and cover instead of drag and a hover star
- **OD-14**

**Owner prerequisites:**
- A Cloudinary account with API credentials (cloud name, key, secret), and its plan tier.
- The scheduler choice (host scheduler or GitHub Actions cron), based on the hosting record.

**Research flag:** Needs research:
- Cloudinary authenticated vs public delivery
- eager variants
- caching of signed URLs

**Plans**: TBD
**UI hint**: yes

### Phase 10: Admin Dashboard

**Goal**: Staff land on a dashboard that shows how the business stands today: active work, money owed, money collected and money spent. Each staff member also sees the money they hold and can hand it to a coworker (owner addition, 2026-10-07).
**Mode:** mvp
**Depends on**: Phase 6, Phase 8. Until this phase ships, `/admin` redirects to Orders.
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, MONEY-01, MONEY-02, MONEY-03, MONEY-04, MONEY-05, MONEY-06, MONEY-07, MONEY-08
**Success Criteria** (what must be TRUE):
  1. **Landing.** After sign-in, staff land on the dashboard. They see "Good morning/afternoon/evening, {firstName}", today's date in Manila time, and View Orders and New Order actions.
  2. **KPI cards,** per the C-40 definitions:
     - active orders, plus those due this week
     - total receivables: Σ max(balance, 0) over active orders
     - collected this month, plus the change vs the same day last month
     - company expenses this month, plus their count and top category
  3. **Chart and lists:**
     - The income vs expenses chart switches between 6 and 12 months. Income is payments by payment date; expenses are company plus order expenses.
     - "Orders by status" shows the active total.
     - The 6 most recent orders link to their detail pages.
  4. **Card states.** Every card shows a skeleton while loading, an empty state when there's no data and an error state with retry.
  5. **Money on hand.** Each staff member sees their own server-computed money on hand (payments they received + transfers in − transfers out − expenses they paid) and its ledger, plus a dashboard card. An Admin sees only their own figures and transfers and gets 403 for anyone else's. A Manager sees every staff member's balance and all transfers.
  6. **Coworker transfers.** A staff member can transfer part of their money on hand to another active staff member: above zero, not to themselves, not future-dated in Manila time and, by default, never more than they hold, even under two concurrent attempts. A double-click records one transfer. Transfers can't be edited. Only a Manager can delete one (an Admin gets 403), and every delete lands in the audit log with the full record. Every new endpoint has authorization-matrix rows for anonymous, Admin and Manager.

**Owner decisions to close at discuss step:**
- **C-40** metric definitions:
  - "due this week" boundaries
  - "same day last month" on month-end days
  - whether cancelled orders appear in "Orders by status"
  - whether receivables include overdue orders
- **C-18** confirm the dashboard scope
- **OD-16** staff balance rules: transfers above the sender's balance (default: refuse); whether paying an expense may take the payer's balance below zero (default: allow it, because refusing would leave a real expense unrecorded); a payment correction or order deletion that pushes a balance below zero; whether refunds paid from a staff member's cash count (default: no). Expenses a staff member paid always count (owner ruling, 2026-10-07). Also: how money still held by a deactivated or deleted staff member is handed over (otherwise the sender is always the signed-in user)
- **OD-17** transfer edits (default: none; delete and re-create)
- **OD-18** soft vs hard delete for transfers (recommended: soft)
- **OD-19** apply the 2026-10-07 ruling: only Managers delete transfers, an Admin sees only their own money and transfers, and a Manager sees everyone's
- **OD-14**

**Research flag:** Standard patterns, once the C-40 definitions are settled.

**Plans**: TBD
**UI hint**: yes

### Phase 11: Public Site & Content Management

**Goal**: Visitors arriving on a phone from Facebook can browse Home, Products, Gallery and Contact, with real business info and prices from the database, and their link previews look right. Managers keep all that content current without a developer.
**Mode:** mvp
**Depends on**: Phase 4 (Manager policy), Phase 9 (the image upload pipeline, reused for gallery photos)
**Requirements**: PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06, GAL-01, GAL-02, GAL-03, CONT-01, CONT-02, CONT-03, CONT-04, CONT-05
**Success Criteria** (what must be TRUE):
  1. **Public pages.** Visitors can browse Home, Products, Gallery and Contact, built to UI-SPEC §7, from 320 to 1920 px. Prices, product lines, address, phone numbers, hours and the Messenger link come from the database. Unknown paths show the 404 page with a real 404 status.
  2. **Link previews and SEO.** Sharing any public URL on Facebook shows that page's own title, description and image, because the OG tags and `LocalBusiness` JSON-LD are in the server-sent HTML. `robots.txt` and `sitemap.xml` are served, and admin routes are `noindex`.
  3. **Contact.** The Contact page shows "Open now" or "Closed now", computed from business hours and closure dates in Manila. It has Messenger (`m.me`) and phone (`tel:`) CTAs, including the sticky bar shown only on phones.
  4. **Gallery.** Visitors can filter the masonry gallery by category pills with correct counts. They can open an item in a lightbox with:
     - its position
     - prev/next that wraps
     - Esc, ← and →
     - swipe, plus visible buttons, on phones
  5. **Content management.** A Manager can edit:
     - site settings
     - product lines and prices
     - testimonials and the "Recent work" strip
     - holiday and closure dates
     - gallery items: upload, publish/unpublish, reorder

     Each change appears publicly at once, because the cache is invalidated (`ETag`/`Cache-Control`).
**Owner decisions to close at discuss step:**
- **C-21** content model: fixed product lines with rich copy vs a database price list (a hybrid `ProductLine` is recommended)
- **C-12** Gallery scope
- **C-36** scope check only: does the quote/inquiry feature ship this milestone? The answer decides the Contact layout; the details close in Phase 13.
- **C-35** apply the Phase 2 ruling on lightbox controls on phones
- **C-17** spec-gap screens: site content and price-list management
- **OD-14**
- **Carry-over from Phase 3 (WINDOWS.md entry 1):** public LCP is about 2.1 to 2.2 s against the 2.0 s limit and is report-only in CI. Revisit fonts here (options in `.planning/phases/03-ci-cd-staging-deploy/deferred-items.md`), then empty `REPORT_ONLY_METRICS` in `web/scripts/lighthouse-assert.mjs` so LCP fails the build again.

**Owner prerequisites:** Real business content: prices, hours, address, phone numbers, Messenger URL and gallery photos. The phase doesn't need it, since the seed holds placeholders, but it must be entered through the management screens before cutover.

**Research flag:** Needs research:
- how Facebook's link scraper behaves without JS (LOW–MEDIUM confidence)
- server-shaped `index.html` with HybridCache
- fitting the Contact page within the 150 KB budget

**Plans**: TBD
**UI hint**: yes

### Phase 12: Consent, Analytics & Legal

**Goal**: Visitors get a fair cookie choice and can wipe their data. Managers see visitor metrics that respect privacy. Visitors can read versioned legal pages marked DRAFT.
**Mode:** mvp
**Depends on**: Phase 11 (public pages), Phase 9 (maintenance jobs for aggregation and purge)
**Requirements**: ANL-01, ANL-02, ANL-03, ANL-04, ANL-05, ANL-06, ANL-07, ANL-08, ANL-09, LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05
**Success Criteria** (what must be TRUE):
  1. **Consent banner:**
     - On a first visit, visitors see Accept all and Reject all with equal prominence, plus Customize. Nothing non-essential is set before they choose.
     - GPC counts as "reject analytics".
     - The footer "Cookie settings" link reopens the preferences.
     - Consent is asked again after a cookie-policy version change or after 12 months, and every decision is logged.
  2. **Clear my data.** "Clear my cookies & data":
     - expires non-essential cookies (server-side for HttpOnly ones)
     - clears local and session storage
     - deletes the server-side analytics tied to that visitor
  3. **Analytics capture:**
     - With consent, visits record a random visitor id, sessions, page views, referrer host, device/browser/OS family and Core Web Vitals. IPs are never stored in clear.
     - Without consent, only anonymous path-and-day counts are recorded.
     - Raw events are aggregated and purged after the ruled retention.
  4. **Metrics dashboard.** A Manager can view metrics for a chosen date range and export them as CSV: unique visitors, sessions, page views, top pages and referrers, device/browser split, a trend chart and Core Web Vitals.
  5. **Legal pages.** Visitors can read the Privacy Policy, the Cookie Policy (linked from the banner), the Terms of Use and the Accessibility Statement. All are linked in the footer, versioned with "last updated" dates and marked DRAFT until the owner approves the text.

**Owner decisions to close at discuss step:**
- **OD-10** retention: analytics 13 months. Ask the full set now: orders and financial records, audit log, inquiries.
- **OD-11** jurisdiction (likely the Data Privacy Act of 2012, RA 10173) and who reviews the legal text
- **C-17** spec-gap screens: cookie banner and preferences, metrics dashboard, legal pages, accessibility statement
- **OD-14**

**Owner prerequisites:**
- The business's legal name and address, for the controller section.
- The legal reviewer named under OD-11.

**Research flag:** Standard patterns. The PRD and NPC guidance are already detailed.

**Plans**: TBD
**UI hint**: yes

### Phase 13: Quote Inquiries

**Goal**: Visitors can ask for a quote from the Contact page, and staff never lose a lead. Every inquiry is stored, announced, worked in an inbox and can be turned into an order.
**Mode:** mvp
**Depends on**: Phase 12 (Privacy Policy for the collection notice), Phase 8 (order creation), Phase 9 (private storage and jobs)
**Requirements**: INQ-01, INQ-02, INQ-03, INQ-04, INQ-05, INQ-06, INQ-07, INQ-08
**Success Criteria** (what must be TRUE):
  1. **Quote form.** A visitor can submit "Get a Quote" (name, team, PH mobile, email, product type, quantity range, message), with the UI-spec validation copy and success state.
     - They see a privacy notice that links to the Privacy Policy.
     - They can attach reference files within the ruled types, size and count. Files are checked by magic bytes and stored privately.
  2. **Bot protection.** A honeypot, a minimum time-to-submit and per-IP rate limits stop bots, with no CAPTCHA.
  3. **Notification.** Each inquiry is saved before staff are emailed at the ruled address. The email carries no attachments.
  4. **Inbox and conversion.** Staff can work inquiries in an admin inbox:
     - unread badge
     - detail view with attachments
     - status New → Contacted → Quoted → Converted / Closed / Spam
     - an internal note

     They can convert an inquiry into a new order prefilled with customer, team, contact and product type, and the two stay linked.
  5. **Retention.** The maintenance job purges unconverted inquiries and their attachments after the ruled retention period.

**Owner decisions to close at discuss step:**
- **C-36** the inquiry feature's shape:
  - persistence and the inbox
  - the notification address
  - visibility: Admin and Manager, or Manager only
  - retention and attachment storage
  - whether to accept PDF/AI files at all
- **C-12** the CWE-434 upload risk for PDF/AI
- **OD-10** inquiry retention, if Phase 12 didn't close it
- **C-17** the inbox spec-gap screen
- **OD-14**

If the owner rules under C-36 that inquiries are out of this milestone, this phase is deferred and INQ-01…INQ-08 move to v2.

**Owner prerequisites:** The staff address that receives inquiry notifications.

**Research flag:** Needs research only if PDF/AI attachments are accepted (CWE-434 handling). Otherwise standard patterns, with images re-encoded through Cloudinary.

**Plans**: TBD
**UI hint**: yes

### Phase 14: Hardening & Release Readiness

**Goal**: The complete app, still on an empty database, is proven ready for release: reviewed end to end for security, accessible under manual testing, installable for staff, and backed by runbooks.
**Mode:** mvp
**Depends on**: Phase 13 (all features built)
**Requirements**: SEC-05, A11Y-05, PERF-06, PERF-07, LEGAL-06
**Success Criteria** (what must be TRUE):
  1. **Security review:**
     - The full MITRE CWE Top 25 / ATT&CK review is recorded, with a test for each mitigation.
     - CodeQL, or the approved substitute set, is clean.
     - A ZAP baseline against staging has no high or critical findings.
     - The owner has signed the security checklist.
  2. **Manual accessibility.** Keyboard-only and screen-reader (NVDA + VoiceOver) passes are recorded for the critical flows: sign-in with 2FA, order create, payment, expense entry and consent. No WCAG 2.2 AA issue or OD-14 item remains open.
  3. **PWA.** Staff can install the admin portal as a PWA. The service worker caches only static assets and the app shell, never API or authenticated responses. A "new version available — reload" prompt appears after a deploy.
  4. **Motion.** Route changes use View Transitions where the browser supports them, and all motion stops under `prefers-reduced-motion`.
  5. **Runbooks and final audit.** Documented Manager procedures cover data subject requests (access, correction, deletion) and breach response, including the owner notification steps. They sit alongside the break-glass mail and lockout runbooks. Budgets and Lighthouse scores are re-audited on staging across every public page.

**Owner decisions to close at discuss step:**
- **OD-10** audit-log and financial-record retention, if Phase 12 didn't close it
- **OD-13** confirm OpenAPI exposure in production
- **C-32** confirm the Data Protection key-protection ruling, or record risk acceptance
- any open **OD-14** item, which must close before release
- **No staging site** (Phase 3, owner 2026-10-15): where the ZAP baseline (criterion 1, SEC-05) and the Lighthouse re-audit (criterion 5) run, since CSPS serves the live site and the Basic plan has no second site

**Owner prerequisites:** The owner reviews and signs the security checklist.

**Research flag:** Standard patterns (checklist-driven).

**Plans**: TBD
**UI hint**: yes

### Phase 15: Legacy Discovery & Mapping

**Goal**: The owner approves a complete, written map of how every legacy table and field fits the new schema, before any import code exists.
**Mode:** mvp
**Depends on**: Phase 14. Per Prime Directive 11, the complete app must run on an empty database first.
**Requirements**: MIG-01, MIG-02
**Success Criteria** (what must be TRUE):
  1. **Read-only restore.** The `_local/` `.bak` is restored read-only into a disposable, `CSPS_`-prefixed local database (named per C-28), behind a prefix guard. No `BetsLLC_*` database, `CSPS_Dev` or the live system is touched, and the `.bak` never leaves `_local/`.
  2. **Schema record.** `.planning/LEGACY-SCHEMA.md` documents:
     - every table, column, type, key and relationship, with row counts
     - value shapes, without real customer data
     - data-quality anomalies, with counts
     - image storage and user accounts
  3. **Mapping.** `.planning/LEGACY-MAPPING.md` maps every legacy field to the new model, or to "not migrated — reason". It proposes any new columns or tables and revisits the rulings that real data may stress. It includes the rules that give every migrated payment a Received by (MIG-09, OD-15), and every migrated expense a Paid by and every migrated record its creator attribution (MIG-10, OD-15).
  4. **Approval gate.** The owner has approved `LEGACY-MAPPING.md`, and no ETL code was written before that approval.

**Owner decisions to close at discuss step:**
- **C-28** final name of the legacy-restore database
- the rulings real data may break: **C-1, C-2, C-14, C-15, OD-3, OD-4, OD-7**. Examples: multiple discounts, overpayments, more than 5 images, missing due dates, unknown statuses, local-time timestamps.
- **OD-15** (final) how migrated payments get a Received by and migrated company and order expenses a Paid by; whether those payments and expenses count toward money on hand; whether a legacy record that names its creator keeps that creator as a migrated user (a record with an unknown creator gets "Legacy import", owner ruling 2026-10-07); and whether staff start with opening balances at go-live

**Owner prerequisites:** Owner approval of `LEGACY-MAPPING.md`. This is a blocking checkpoint.

**Research flag:** Needs research. The legacy schema is unknown by design.

**Plans**: TBD

### Phase 16: Legacy Data Import

**Goal**: Every legacy order, payment, discount, expense, image and user in the verified `.bak` is proven to land in the EF-migrated CSPS schema with 100% reconciliation by a timed local dress rehearsal, ready for the Phase 17 import into the database that already serves CSPS.
**Mode:** mvp
**Depends on**: Phase 15 (approved mapping)
**Requirements**: MIG-03, MIG-04, MIG-05, MIG-06, MIG-07, MIG-08, MIG-09, MIG-10
**Success Criteria** (what must be TRUE):
  1. **Legacy columns.** The approved legacy-only columns (`LegacyId`, legacy order number) exist as nullable columns, added through normal migrations. The app still builds, tests and runs on an empty database.
  2. **ETL.** The `tools/Csps.LegacyMigration` ETL:
     - supports `--dry-run`
     - runs in batched transactions with clear logs
     - writes through the domain factories, preserving legacy keys and order numbers
     - seeds the per-year counters so the next new order continues the sequence

     A second run changes nothing.
  3. **Images and users.** Legacy images, if any, upload to Cloudinary with a resumable mapping, so an interrupted run resumes without duplicates. Legacy users, if any, become profiles. Their passwords aren't carried over unless verifiably compatible, and they're queued for "set your password" emails at go-live.
  4. **Reconciliation.** The report compares the legacy source with the new database:
     - row counts per entity
     - Σ items, payments, discounts, order expenses and company expenses
     - Total/Paid/Balance per order

     It lists every transformed or rejected row with a reason, and blocks cutover unless reconciliation is 100% with zero unexplained differences.
  5. **Dress rehearsal.** A timed dress rehearsal with the verified `.bak` runs end to end into a local `CSPS_` database built from the production migration script, and passes reconciliation. The Basic plan has only the live site, so the rehearsal runs locally.
  6. **Payment receivers.** Every migrated payment has a Received by under the approved OD-15 rule. None was dropped or changed, and reconciliation covers them all.
  7. **Expense payers and record attribution.** Every migrated company and order expense has a Paid by, and every migrated record has its creator attribution ("Legacy import" when the creator is unknown), under the approved OD-15 rules. No expense or record was dropped or changed, and reconciliation covers them all.

**Owner decisions to close at discuss step:**
- Anything the approved `LEGACY-MAPPING.md` doesn't cover. New columns or tables, drops, renames and lossy type changes are one-way doors: stop and ask.
- How each class of rejected row is treated.
- How imported legacy orders and numbers fit with the orders staff have already recorded in CSPS (order numbers, per-year counters, duplicates), and the name of the local rehearsal database (`CSPS_` prefix).

**Owner prerequisites:**
- The verified legacy `.bak` kept in Phase 3. The legacy database no longer exists on the host, so it is the only source.

**Research flag:** Needs research. The import route into the live database (the host's one database has been CSPS's since Phase 3) is LOW confidence, and whether the image mapping can resume depends on how legacy images turn out to be stored.

**Plans**: TBD

### Phase 17: Legacy Data Cutover

**Goal**: The shop's legacy data moves into the live CSPS database in one cutover with the owner present and a rollback path, and the shop runs on CSPS with its full history from then on. CSPS has served the live site since Phase 3, so no site switch remains.
**Mode:** mvp
**Depends on**: Phase 16
**Requirements**: CUT-01, CUT-02, CUT-03
**Success Criteria** (what must be TRUE):
  1. **Production ready.** Before the window, production has:
     - a least-privilege production SQL login
     - scheduled DB backups, with one restore tested
     - a live TLS certificate, with HSTS enabled after verification
     - SPF/DKIM/DMARC passing on the sender domain
     - the SQL Server 2025 database created in Phase 3 (D-03), with its compatibility level still matching the pinned `SqlCompatibility.Level`
  2. **Runbook executed.** The cutover runbook is executed with the owner present. The point of no return and the rollback plan are written down beforehand. The steps:
     1. maintenance notice (`app_offline.htm`)
     2. a fresh backup of the live CSPS database, kept as the rollback
     3. ETL from the verified legacy `.bak` with 100% reconciliation
     4. deploy and smoke test
     5. the owner checks sample orders and totals
  3. **Post-go-live.** After go-live, logs, errors and the key flows (sign-in, order create, payments) are monitored for the agreed period, and migrated users have received their set-password emails.

**Owner decisions to close at discuss step:** The cutover window, the post-go-live monitoring period, how long to keep the legacy backup, and the point of no return (PRD §19.4).

**Owner prerequisites:**
- The owner is present for the whole cutover.
- Control of the production domain and DNS.
- The production SQL login and scheduled backups, enabled in the SmarterASP.NET control panel.
- The production TLS certificate.

**Research flag:** Needs research: how the ETL reaches the live database, since the host's one database has been CSPS's since Phase 3 and a `.bak` restore there would replace it (LOW confidence).

**Plans**: TBD

## Decision Calendar

Owner decisions are [OWNER DECISION] items. Each one is asked at the listed point and recorded in PROJECT.md Key Decisions. None is assumed. OD-14 (UI-spec vs WCAG conflicts) is re-checked at every phase with a UI hint.

| When to ask | Decisions | What they gate |
|---|---|---|
| **Before Phase 1** | C-45 prerequisites (SmarterASP.NET access, sender domain), OD-1, OD-2, OD-12, OD-13, C-20, C-28 (CLAUDE.md wording), C-29, C-30, C-31, C-32, S-3, S-4, S-5, S-10, S-11 | Hosting record, SiteSettings defaults, business calendar, test-DB setup, license gate, compatibility-level pin |
| **Phase 2 discuss** | OD-14, C-10 (with S-12), C-11, C-22, C-25, C-34, C-35, S-1, S-2, S-6, S-7, S-8 | Design-system import/reconcile, golden-vector expectations, lint and a11y gates |
| **Before Phase 3** | C-27 / S-9, C-45 (owner creates the GitHub repo; Web Deploy credentials; secrets) | CI security set, the process merge gate, the deploy to the live site |
| **Before Phase 4 starts** (one security batch) | OD-12, C-4, C-5, C-6, C-7, C-8, C-9, C-19, C-23, C-33 | Sign-in, 2FA, reset, onboarding and email change. Email is a hard sign-in dependency, so send this batch early |
| **Phase 5 discuss** | C-41 (+ C-4 and C-9 if still open) | User delete semantics, onboarding, email change |
| **Phase 6 discuss** | OD-5 (expenses), OD-8, C-43, OD-21 | Expense schema and categories, expense payer |
| **Before Phase 7's first test** (Orders batch) | OD-3, OD-4, OD-5 (orders), OD-6, OD-7, C-1, C-3, C-13, C-14, C-15/C-24, C-37, C-38, C-39, C-42, C-43, C-44, OD-15 (shape only) | The order aggregate, numbering, invariants and schema (Core Value) |
| **Phase 8 discuss** | C-13 (labels), C-18, OD-20 | Order screens, payment receiver label |
| **Phase 9 discuss** | OD-9 / C-26, C-2, C-16 (+ Cloudinary account) | Image delivery, per-order limit, accessible reorder |
| **Phase 10 discuss** | C-40, C-18, OD-16, OD-17, OD-18 | Dashboard metric definitions, staff money rules |
| **Phase 11 discuss** | C-21, C-12, C-36 (scope only), C-17 | Content model, Contact layout, whether Phase 13 runs |
| **Phase 12 discuss** | OD-10 (full retention set), OD-11 | Retention jobs, legal text |
| **Phase 13 discuss** | C-36 (details), OD-10 (inquiry retention) | Inquiry storage, inbox, attachment types |
| **Phase 14 discuss** | OD-10 (audit and financial records), OD-13 (confirm), C-32 (confirm), every open OD-14 item | Release readiness |
| **Phase 15** | C-28 (final), OD-15 (final), re-check C-1, C-2, C-14, C-15, OD-3, OD-4, OD-7 against real data; **LEGACY-MAPPING.md approval** | All ETL code |
| **Phase 17** | Cutover window, monitoring period, legacy-backup retention, point of no return | Go-live |

## Coverage

All 180 v1 requirements are mapped, each to exactly one phase. There are no orphans and no duplicates.

| Phase | Requirements | Count |
|---|---|---|
| 1 | FND-01…FND-13, QUAL-01, QUAL-03, QUAL-06, SEC-01, SEC-02, SEC-04 | 19 |
| 2 | WEB-01…WEB-10, ORD-09, QUAL-02, QUAL-04, A11Y-01, A11Y-02, A11Y-04, PERF-01, PERF-02, PERF-03, PERF-05 | 20 |
| 3 | OPS-01…OPS-05 | 5 |
| 4 | AUTH-01…AUTH-13, QUAL-05, SEC-03, SEC-06, A11Y-03, AUDIT-01 | 18 |
| 5 | PROF-01…PROF-04, USER-01…USER-08, AUDIT-02, SEC-07, SEC-08 | 15 |
| 6 | CEXP-01…CEXP-05, PERF-04 | 6 |
| 7 | ORD-03, ORD-05, ORD-08, ORD-13, ORD-14, ORD-16, ORD-17, ORD-18, ORD-20, ORD-21, ORD-22, ORD-23 | 12 |
| 8 | ORD-01, ORD-02, ORD-06, ORD-07, ORD-10, ORD-11, ORD-12, ORD-15, ORD-19 | 9 |
| 9 | ORD-04, IMG-01…IMG-05, JOB-01, JOB-02 | 8 |
| 10 | DASH-01…DASH-06, MONEY-01…MONEY-08 | 14 |
| 11 | PUB-01…PUB-06, GAL-01…GAL-03, CONT-01…CONT-05 | 14 |
| 12 | ANL-01…ANL-09, LEGAL-01…LEGAL-05 | 14 |
| 13 | INQ-01…INQ-08 | 8 |
| 14 | SEC-05, A11Y-05, PERF-06, PERF-07, LEGAL-06 | 5 |
| 15 | MIG-01, MIG-02 | 2 |
| 16 | MIG-03…MIG-10 | 8 |
| 17 | CUT-01…CUT-03 | 3 |
| **Total** | | **180** |

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → … → 17. Decimal insertions (for example 7.1, if C-42 is approved) run between their neighbours. Two phases can run alongside others:
- **Phase 3** can run alongside Phase 4 if the owner prerequisites arrive late.
- **Phase 11's content model** (settings, product lines, closures) is independent of Phases 6–10 after Phase 5. Gallery uploads still need Phase 9.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Hosting Verification & Backend Foundation | 13/13 | Complete    | 2026-10-07 |
| 2. Web Foundation & Design System | 43/43 | Complete    | 2026-10-14 |
| 3. CI/CD & Deploy | 23/23 | Complete    | 2026-10-17 |
| 4. Identity & Authentication | 35/35 | Complete    | 2026-10-17 |
| 5. Profile & User Management | 47/52 | In Progress | - |
| 6. Company Expenses | 0/TBD | Not started | - |
| 7. Order Domain & API | 0/TBD | Not started | - |
| 8. Order Screens | 0/TBD | Not started | - |
| 9. Order Images & Maintenance Jobs | 0/TBD | Not started | - |
| 10. Admin Dashboard | 0/TBD | Not started | - |
| 11. Public Site & Content Management | 0/TBD | Not started | - |
| 12. Consent, Analytics & Legal | 0/TBD | Not started | - |
| 13. Quote Inquiries | 0/TBD | Not started | - |
| 14. Hardening & Release Readiness | 0/TBD | Not started | - |
| 15. Legacy Discovery & Mapping | 0/TBD | Not started | - |
| 16. Legacy Data Import | 0/TBD | Not started | - |
| 17. Legacy Data Cutover | 0/TBD | Not started | - |

## Backlog

### Phase 999.1: Owner decisions deferred during Phase 2 execution (BACKLOG)

**Goal:** Collect every owner decision, approval or sign-off that came up while the owner was away during Phase 2 execution, so they can be settled in one sitting. Each item, its options and its impact are listed in `.planning/phases/999.1-owner-decisions-deferred-during-phase-2-execution/DECISIONS.md`.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.2: Follow-up — Phase 02 deferred UAT follow-up: Test 6 (BACKLOG)

**Goal:** Resolve the UAT checkpoint deferred during Phase 02 verification
**Source phase:** 02
**Deferred at:** 2026-10-08 during /gsd-verify-work 2 session completion
**Follow-ups:**
- [ ] Test 6: Check on the Phase 8 order screens and the Discount modal that server totals replace the client preview after a save (02-04 D7, D-09). (deferred 2026-10-08)

### Phase 999.3: Follow-up — Phase 02 deferred UAT follow-up: Test 8 (BACKLOG)

**Goal:** Resolve the UAT checkpoint deferred during Phase 02 verification
**Source phase:** 02
**Deferred at:** 2026-10-08 during /gsd-verify-work 2 session completion
**Follow-ups:**
- [ ] Test 8: Review the shared list-query defaults (staleTime 30 s, gcTime 5 min, refetchOnWindowFocus true, retry false) per list screen as later phases build them, and override per query where needed (02-08 D10). (deferred 2026-10-08)

---
*Roadmap created: 2026-10-07*
*Last updated: 2026-10-17T09:30:00-05:00 after plans 03-20 to 03-22 were marked complete (CSPS live, first Manager signed in, owner acceptance 2026-10-17). Earlier: 2026-10-15T22:10:30-05:00 after plan 03-23 amended Phases 3, 16 and 17 to the Phase 3 owner decisions (no staging site; CSPS replaces the legacy site in Phase 3)*

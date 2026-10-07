# Roadmap: CSPS — Carmen's Stitch & Printing Services

## Overview

CSPS replaces the shop's live legacy system with a strict, test-first .NET 10 + React 19 app. The work runs in four stretches:

- **Platform (Phases 1–3).** The backend foundation comes first, with the SmarterASP.NET hosting facts verified before anything else. Next comes the UI-spec design system with every quality gate in place. CI and the staging deploy follow once the owner supplies the GitHub repo and host credentials.
- **Staff portal (Phases 4–10), in vertical slices.** Sign-in with mandatory email 2FA, then profiles and user management, then company expenses as the slice that proves the pattern. The order aggregate follows in three phases (domain and API, then screens, then images and maintenance jobs), and the dashboard comes last.
- **Public site and hardening (Phases 11–14).** The public site and its content management, then consent, analytics and legal pages, then quote inquiries. Phase 14 hardens the complete app.
- **Legacy data and cutover (Phases 15–17).** Phases 1–14 run on an empty, EF-migrated database. Only Phases 15–16 open the legacy `.bak`, and only Phase 17 touches the live legacy system, at the cutover the owner attends (Prime Directives 1 and 11).

## Roadmap Conventions

- **Requirement mapping.** Each v1 requirement maps to exactly one phase: the one that establishes it. Cross-cutting QUAL/SEC/A11Y/PERF requirements map to the phase where their gate is first built. **From then on, every later phase enforces them through the PRD §22 Definition of Done:**
  - zero warnings, coverage gates and architecture tests
  - authorization-matrix rows for every new endpoint
  - axe at zero violations, plus a keyboard pass
  - bundle budgets and Lighthouse scores
  - a UI-spec match at 320/768/1280 px
  - CWE rows mitigated and tested
  - production data untouched
- **Orders split.** Phase 7 builds the whole order API, including the server side of list/search (ORD-01, ORD-02) and delete (ORD-06). Those three IDs map to Phase 8, where they become true end to end. Phase 8 also delivers ORD-03's UI flow and ORD-08's conflict UX, against IDs that stay mapped to Phase 7.
- **Pieces that grow.** Each of these is set up once, then extended by every later phase for its own entities and endpoints:
  - the dev seed (FND-04)
  - the audit event catalog (AUDIT-01)
  - rate-limit policies (SEC-03)
  - maintenance jobs (JOB-01)
  - the authorization matrix (SEC-02)
- **Per-phase workflow:**
  1. `/gsd-discuss-phase N` closes the listed owner decisions before the first test.
  2. `/gsd-plan-phase N --tdd`.
  3. Phases with a UI hint run `/gsd-ui-phase N`, with `CSPS-UI-SPEC.md` as the source of truth.
  4. `/gsd-secure-phase N`, `/gsd-ui-review N` and `/gsd-verify-work` all complete before `/gsd-ship N`.
- **Owner decisions** are [OWNER DECISION] items: ask, never assume. They come from two places: OD-1…OD-14 and C-1…C-21 in PROJECT.md, and C-22…C-45 and S-1…S-12 in research/SUMMARY.md. See the Decision Calendar below.
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

- [ ] **Phase 1: Hosting Verification & Backend Foundation** - Verified host facts, a zero-warning onion API on an empty EF-migrated database, the platform contract and shared backend primitives
- [ ] **Phase 2: Web Foundation & Design System** - UI-spec design system imported and reconciled, layouts, primitives, `httpClient`/`api.ts`, golden vectors and all front-end gates
- [ ] **Phase 3: CI/CD & Staging Deploy** - Owner-created GitHub repo, full PR pipeline, supply-chain checks and Web Deploy to SmarterASP.NET staging
- [ ] **Phase 4: Identity & Authentication** - Email + password + mandatory emailed code, remember me, rotating refresh, lockout, reset, bootstrap Manager, auth audit
- [ ] **Phase 5: Profile & User Management** - Own profile, email change, password and theme; Manager-only roster with guard rules and the audit-log viewer
- [ ] **Phase 6: Company Expenses** - Pattern-proving CRUD slice with filters, period totals, Manila-month KPIs and query-count guards
- [ ] **Phase 7: Order Domain & API** - Order aggregate, numbering, invariants, transitions, concurrency and import path, proven by fixtures and race tests
- [ ] **Phase 8: Order Screens** - Order list, search and filters, create flow, detail page with tabs, modals, totals and profit, safe delete
- [ ] **Phase 9: Order Images & Maintenance Jobs** - Server-signed Cloudinary uploads, accessible reorder/cover, responsive delivery, cleanup job framework
- [ ] **Phase 10: Admin Dashboard** - Greeting, KPIs, income vs expenses chart, orders by status, recent orders
- [ ] **Phase 11: Public Site & Content Management** - Home/Products/Gallery/Contact from database content, OG/JSON-LD in server HTML, Manager content editing
- [ ] **Phase 12: Consent, Analytics & Legal** - Cookie consent with GPC and clear-my-data, consented analytics, metrics dashboard, DRAFT legal pages
- [ ] **Phase 13: Quote Inquiries** - Get a Quote form with safe attachments, staff notification, admin inbox, convert to order, retention
- [ ] **Phase 14: Hardening & Release Readiness** - Full security review and ZAP, manual accessibility passes, PWA, View Transitions, runbooks and DSR/breach procedures
- [ ] **Phase 15: Legacy Discovery & Mapping** - Read-only restore, `LEGACY-SCHEMA.md`, owner-approved `LEGACY-MAPPING.md`
- [ ] **Phase 16: Legacy Data Import** - Test-driven idempotent ETL, image and user migration, 100% reconciliation, staging dress rehearsal
- [ ] **Phase 17: Production Cutover** - Runbook executed with the owner present, with a rollback plan and post-go-live monitoring

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

**Plans**: 3/13 plans executed in 7 waves

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Owner package-legitimacy gate, strict onion solution (scaffold removed), /health liveness, architecture/build/registry tests (W1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Empty-DB schema from InitialCreate, SiteSettings singleton + cached port, LocalDB `CSPS_Test_` fixture, zone fallback chain (W2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — /health database + time-zone checks over IBusinessCalendar; Manila day/month/year boundaries; health failure modes (W3)
- [ ] 01-04-PLAN.md — Guarded `tools/Csps.DevSeed`, migration verification (idempotent ×2 at 160/170), startup-safety rule, Respawn + isolation, stale-DB cleanup (W3)
- [ ] 01-05-PLAN.md — AuditEntry domain record with /24 and /48 IP truncation and regex-free UA family (W3)
- [ ] 01-06-PLAN.md — ProblemDetails contract + /api 404 fallback, Result/Error mapping, strict security headers, web.config, Development-only OpenAPI/Scalar (W3)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 01-07-PLAN.md — Serilog compact JSON with correlation id, secret masking, D-21 file retention, IRequestContext without forwarded headers (W4)
- [ ] 01-12-PLAN.md — Owner D-28 decision, key-protected HostProbe, HOSTING-RECORD checklist + doc-lint test (W4)

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 01-08-PLAN.md — JWT validation, default-deny + Staff/Manager policies, GET /api/v1/site-settings, discovery-driven authorization matrix, 401/403/500 paths (W5)
- [ ] 01-09-PLAN.md — Owner D-25 decision, append-only AuditLog (trigger, truncate guard, EF interceptor), IAuditTrail (W5)

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 01-10-PLAN.md — Data Protection keys in DB encrypted by certificate, rotation runbook, local full-stack run (W6)

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 01-11-PLAN.md — Coverage gate, third-party notices + license gate, exact solution layout, developer guide, clean-clone proof (W7)
- [ ] 01-13-PLAN.md — Owner runs the approved host checks; record completed; compatibility level re-pinned and re-proven (W7)

### Phase 2: Web Foundation & Design System

**Goal**: Visitors and staff see the approved UI-spec design system in working public and admin layouts, served from `wwwroot` by a strict TypeScript app. Its primitives, formatters, HTTP client and quality gates are all in place, so feature phases only compose. The gates are lint, axe, bundle budgets, Lighthouse and the Playwright host.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: WEB-01, WEB-02, WEB-03, WEB-04, WEB-05, WEB-06, WEB-07, WEB-08, ORD-09, QUAL-02, QUAL-04, A11Y-01, A11Y-02, A11Y-04, PERF-01, PERF-02, PERF-03, PERF-05
**Success Criteria** (what must be TRUE):
  1. **Build and dev server:**
     - `npm run build` emits the app into `src/Csps.Server/wwwroot`.
     - `npm run dev` serves it on 5180 (`strictPort`), proxies `/api` to 5115/7028 and sets no machine-level env vars.
     - Typecheck, ESLint and Prettier pass at `--max-warnings 0`.
     - The build fails if public initial JS exceeds 150 KB gz, admin initial JS 250 KB gz or total CSS 35 KB gz.
     - The self-hosted fonts render the ₱ glyph in the brand font.
  2. **Layouts.** Public and admin layouts render the verbatim Appendix D markup (DOM-snapshot equal), with every reconciliation marked `// SPEC-DEVIATION`. They work from 320 to 1920 px with no horizontal scroll and have:
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
     - Lint rejects `fetch`, `httpClient` or `axios` imports outside `api.ts`.
     - TanStack Query defaults are in place: stale time, keep-previous pagination, and a 300 ms debounced search that can be cancelled.
  5. **E2E, Lighthouse and WCAG rulings:**
     - After the preflight, Playwright runs on 5199 across Chromium, Firefox, WebKit and phone viewports. It fails on any console error, CSP violation or axe violation.
     - Lighthouse CI scores the public shell ≥ 95 on mobile.
     - Every UI-spec item that conflicts with WCAG 2.2 AA has an owner ruling applied.

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

**Plans**: TBD
**UI hint**: yes

### Phase 3: CI/CD & Staging Deploy

**Goal**: Every pull request is gated by the full pipeline. Every merge to `main` deploys to a SmarterASP.NET staging site that passes a smoke test, and production deploys wait for manual approval.
**Mode:** mvp
**Depends on**: Phase 2, because the pipeline runs the web gates. If owner prerequisites arrive late, this phase can run alongside Phase 4.
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04, OPS-05
**Success Criteria** (what must be TRUE):
  1. **Merge gate.** A pull request to `main` can't merge until every check passes, in this order:
     1. locked restore
     2. .NET build, format check
     3. unit, integration and architecture tests
     4. web typecheck, lint, Prettier, Vitest with coverage
     5. web build, Playwright, Lighthouse CI
     6. coverage gates and generated `THIRD-PARTY-NOTICES`

     `main` requires pull requests, linear history and CODEOWNERS review. The PR template carries the Definition of Done checklist.
  2. **Supply chain.** Dependabot (NuGet, npm, Actions, with cooldown) and the owner-approved supply-chain set run on the repo. That set is CodeQL, secret scanning with push protection and dependency review, or the approved substitute. Every action is pinned by SHA with least-privilege permissions.
  3. **Staging deploy.** Merging to `main` deploys to staging through Web Deploy with `app_offline.htm`. The staging smoke E2E passes, including `/health` and an unknown `/api/*` route that returns ProblemDetails through IIS.
  4. **Hosting configuration.** Staging serves in-process with:
     - HTTPS redirect
     - server headers removed
     - compression
     - `immutable` hashed assets and a `no-cache` `index.html`

     Production secrets exist only on the server. A production deploy waits for manual approval.
**Owner decisions to close at discuss step:**
- **C-27 / S-9** private-repo security tooling: make the repo public, pay for GitHub code and secret security, or accept the weaker free substitute set
- **C-45** the repo and host prerequisites below

**Owner prerequisites:**
- The owner creates the new GitHub repository when asked and grants access.
- SmarterASP.NET Web Deploy credentials and a staging site (Advance plan or higher, per the hosting record).
- The owner enters the repository and environment secrets.
- The CODEOWNERS identity.

**Research flag:** Standard patterns for the CI pipeline. SmarterASP.NET Web Deploy specifics (the AppOffline rule, staging-site setup) need research. They build on Phase 1's hosting record and stay LOW confidence until verified.

**Plans**: TBD

### Phase 4: Identity & Authentication

**Goal**: Staff can securely sign in with email, password and a mandatory 6-digit code sent by email. They stay signed in the way they chose, can recover a forgotten password and can sign out everywhere. Every authentication event is audited.
**Mode:** mvp
**Depends on**: Phase 2, because the sign-in screens use the layouts and OtpInput/PasswordInput. Run Phase 3 first if possible so auth ships through CI and staging.
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, AUTH-11, AUTH-12, AUTH-13, QUAL-05, SEC-03, A11Y-03, AUDIT-01
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
  4. **Password reset.** A staff member can request a reset link; the response never reveals whether the account exists. The new password must meet the NIST policy:
     - 12–128 characters
     - not in breach corpora
     - doesn't contain the user's email or name
     - a strength meter is shown

     After the reset, all of the user's sessions are revoked and a "password changed" email arrives.
  5. **Bootstrap, email and audit:**
     - On an empty, production-like database, the `bootstrap-manager` CLI creates a first Manager who can sign in.
     - Auth emails go out through the outbox, from the business sender over TLS.
     - E2E reads codes from the Testing-only sink, and a test proves the sink is absent from Release.
     - Sign-in, 2FA, lockout and reset events appear in the audit log.

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

**Plans**: TBD
**UI hint**: yes

### Phase 5: Profile & User Management

**Goal**: Every staff member can manage their own name, email, password and theme. Managers can run the staff roster safely: invite, edit, lock, deactivate and delete users under guard rules. Every action is audited and can be reviewed.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, USER-07, USER-08, AUDIT-02
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

**Owner decisions to close at discuss step:**
- **C-41** soft-delete users: scramble the email, block sign-in, keep the name
- **C-4 and C-9** apply the Phase 4 rulings, or ask now if still open
- **C-35** apply the Phase 2 ruling on inactive-row contrast
- **C-17** spec-gap screens: email-change confirmation, audit log
- **OD-14**

**Research flag:** Standard patterns.

**Plans**: TBD
**UI hint**: yes

### Phase 6: Company Expenses

**Goal**: Staff can record, find and total the shop's company expenses, with month KPIs that are correct in Manila time. This is the simplest aggregate, so it proves the slice pattern before the order aggregate: rowversion 409s, filters, period totals, query-count guards and ConfirmDialog.
**Mode:** mvp
**Depends on**: Phase 5, because "Recorded by" must survive user deletion
**Requirements**: CEXP-01, CEXP-02, CEXP-03, CEXP-04, PERF-04
**Success Criteria** (what must be TRUE):
  1. **List and filter.** Staff can list company expenses (last 30 days by default, newest first), filter by date range and category, search by description or staff name, page through results and see the period total.
  2. **Edit with conflict protection.** Staff can add, edit and delete (after confirmation) an expense with a date, category, description and an amount above zero. Saving over someone else's newer change shows a 409 conflict instead of overwriting it. Deletion follows the OD-5 ruling.
  3. **Month KPIs.** KPI cards show this month, the last full month and this month's top category with its share. Month boundaries are in Asia/Manila, so an expense at 07:00 Manila time on the 1st counts in the new month.
  4. **Attribution.** Each expense shows a read-only "Recorded by", and it still shows the name after that user is deleted.
  5. **List performance.** The list endpoint runs a fixed number of queries whatever the page size (query-count test). It meets p95 < 300 ms on staging, with an index on every filter and sort column.

**Owner decisions to close at discuss step:**
- **OD-5** hard vs soft delete for company expenses
- **OD-8** fixed vs Manager-editable categories, for both the company and the order expense lists
- **C-43** whether the categories fit, e.g. SSS, PhilHealth, Pag-IBIG, BIR
- **OD-14**
- **Sequencing check:** research recommends this slice before Orders. If the owner prefers Orders first, Phase 7 becomes the slice that sets the pattern.

**Research flag:** Standard patterns.

**Plans**: TBD
**UI hint**: yes

### Phase 7: Order Domain & API

**Goal**: The order aggregate and its full API enforce every owner-ruled business rule and always return correct, server-computed totals. The API covers create, read, list/search, update, child mutations, status and delete. Fixtures, invariant tests and race tests prove the Core Value before Phase 8 builds on it.
**Mode:** mvp
**Depends on**: Phase 6 (the proven slice pattern), Phase 4 (staff policies)
**Requirements**: ORD-03, ORD-05, ORD-08, ORD-13, ORD-14, ORD-16, ORD-17, ORD-18, ORD-20, ORD-21
**Success Criteria** (what must be TRUE):
  1. **Atomic create and numbering.** One API call creates an order atomically: customer details, dates, status, notes and one or more items, plus optional payments, discounts and expenses.
     - The order gets the next `ORD-{YYYY}-{NNNN}` number, with no duplicates under 20 parallel creates and the correct year across New Year in Manila.
     - Every item carries one of the 6 product types plus a size/variant.
  2. **Exact math.** The ORD-2026-0148 fixture reproduces exactly: Total ₱22,450.00 · Discount −₱1,122.50 · Paid −₱12,000.00 · Balance ₱9,327.50 · Expenses ₱6,065.00 · Profit ₱15,262.50. Every add, edit or removal of an item, payment, discount or expense revalidates the invariants and returns recomputed server totals. That includes the overpayment rule across all mutation types.
  3. **Concurrency.** Two concurrent edits to the same order never both succeed; the stale one gets 409. This holds for child-only edits too, such as two payments against one balance.
  4. **Status rules.** Status changes follow only the ruled transitions, and each one is recorded: from, to, who and when. Payments on cancelled orders and refunds follow the ruled policy, so collected-cash figures stay correct.
  5. **Legacy import path.** `Order.Import` accepts legacy-shaped data (preserved order numbers, lenient rules) through configurable rule constants. An owner ruling then becomes a constant change rather than a schema change.

**Owner decisions to close at discuss step:** All of these must close before the first test.
- **OD-3 + C-39** statuses, transitions, reopen rules and status history
- **OD-4 + C-38** overpayments, including via removed items or added discounts
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
  4. **Internal figures.** Staff see Order Expenses and Estimated Profit on the detail page. Neither appears anywhere outside the staff portal.
  5. **Safe delete.** Deleting an order shows its child counts and requires typing the order number. The order and all its children are then removed in one transaction, under the OD-5 and OD-6 rulings.

**Owner decisions to close at discuss step:**
- **C-13** on-screen labels for Total, Discount and Balance
- **C-18** where Estimated Profit appears
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
     - purges expired tokens and 2FA codes

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

**Goal**: Staff land on a dashboard that shows how the business stands today: active work, money owed, money collected and money spent.
**Mode:** mvp
**Depends on**: Phase 6, Phase 8. Until this phase ships, `/admin` redirects to Orders.
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06
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

**Owner decisions to close at discuss step:**
- **C-40** metric definitions:
  - "due this week" boundaries
  - "same day last month" on month-end days
  - whether cancelled orders appear in "Orders by status"
  - whether receivables include overdue orders
- **C-18** confirm the dashboard scope
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
  3. **Mapping.** `.planning/LEGACY-MAPPING.md` maps every legacy field to the new model, or to "not migrated — reason". It proposes any new columns or tables and revisits the rulings that real data may stress.
  4. **Approval gate.** The owner has approved `LEGACY-MAPPING.md`, and no ETL code was written before that approval.

**Owner decisions to close at discuss step:**
- **C-28** final name of the legacy-restore database
- the rulings real data may break: **C-1, C-2, C-14, C-15, OD-3, OD-4, OD-7**. Examples: multiple discounts, overpayments, more than 5 images, missing due dates, unknown statuses, local-time timestamps.

**Owner prerequisites:** Owner approval of `LEGACY-MAPPING.md`. This is a blocking checkpoint.

**Research flag:** Needs research. The legacy schema is unknown by design.

**Plans**: TBD

### Phase 16: Legacy Data Import

**Goal**: Every legacy order, payment, discount, expense, image and user lands in a fresh EF-migrated database with 100% reconciliation, proven by a timed dress rehearsal on staging.
**Mode:** mvp
**Depends on**: Phase 15 (approved mapping)
**Requirements**: MIG-03, MIG-04, MIG-05, MIG-06, MIG-07, MIG-08
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
  5. **Dress rehearsal.** A timed dress rehearsal on the staging site, using a fresh `.bak`, runs end to end and passes reconciliation.

**Owner decisions to close at discuss step:**
- Anything the approved `LEGACY-MAPPING.md` doesn't cover. New columns or tables, drops, renames and lossy type changes are one-way doors: stop and ask.
- How each class of rejected row is treated.

**Owner prerequisites:**
- A fresh `.bak` of the legacy database for the dress rehearsal.
- Enough staging DB quota for the rehearsal.

**Research flag:** Needs research. `.bak` restore on the host is unverified (LOW confidence), and whether the image mapping can resume depends on how legacy images turn out to be stored.

**Plans**: TBD

### Phase 17: Production Cutover

**Goal**: The shop moves from the legacy system to CSPS in one cutover with the owner present and a rollback path, and runs on CSPS from then on.
**Mode:** mvp
**Depends on**: Phase 16
**Requirements**: CUT-01, CUT-02, CUT-03
**Success Criteria** (what must be TRUE):
  1. **Production ready.** Before the window, production has:
     - a least-privilege production SQL login
     - scheduled DB backups, with one restore tested
     - a live TLS certificate, with HSTS enabled after verification
     - SPF/DKIM/DMARC passing on the sender domain
  2. **Runbook executed.** The cutover runbook is executed with the owner present. The point of no return and the rollback plan are written down beforehand. The steps:
     1. maintenance notice
     2. legacy set read-only
     3. fresh legacy backup, kept as the rollback
     4. ETL with 100% reconciliation
     5. deploy and smoke test
     6. the owner checks sample orders and totals
     7. domain switch
  3. **Post-go-live.** After go-live, logs, errors and the key flows (sign-in, order create, payments) are monitored for the agreed period, and migrated users have received their set-password emails.

**Owner decisions to close at discuss step:** The cutover window, the post-go-live monitoring period, how long to keep the legacy backup, and the point of no return (PRD §19.4).

**Owner prerequisites:**
- The owner is present for the whole cutover.
- Control of the production domain and DNS.
- The production SQL login and scheduled backups, enabled in the SmarterASP.NET control panel.
- The production TLS certificate.

**Research flag:** Needs research: restoring a `.bak` on the host vs running the ETL locally and then restoring on the host (LOW confidence).

**Plans**: TBD

## Decision Calendar

Owner decisions are [OWNER DECISION] items. Each one is asked at the listed point and recorded in PROJECT.md Key Decisions. None is assumed. OD-14 (UI-spec vs WCAG conflicts) is re-checked at every phase with a UI hint.

| When to ask | Decisions | What they gate |
|---|---|---|
| **Before Phase 1** | C-45 prerequisites (SmarterASP.NET access, sender domain), OD-1, OD-2, OD-12, OD-13, C-20, C-28 (CLAUDE.md wording), C-29, C-30, C-31, C-32, S-3, S-4, S-5, S-10, S-11 | Hosting record, SiteSettings defaults, business calendar, test-DB setup, license gate, compatibility-level pin |
| **Phase 2 discuss** | OD-14, C-10 (with S-12), C-11, C-22, C-25, C-34, C-35, S-1, S-2, S-6, S-7, S-8 | Design-system import/reconcile, golden-vector expectations, lint and a11y gates |
| **Before Phase 3** | C-27 / S-9, C-45 (owner creates the GitHub repo; Web Deploy credentials; secrets) | CI security set, branch protection, staging deploy |
| **Before Phase 4 starts** (one security batch) | OD-12, C-4, C-5, C-6, C-7, C-8, C-9, C-19, C-23, C-33 | Sign-in, 2FA, reset, onboarding and email change. Email is a hard sign-in dependency, so send this batch early |
| **Phase 5 discuss** | C-41 (+ C-4 and C-9 if still open) | User delete semantics, onboarding, email change |
| **Phase 6 discuss** | OD-5 (expenses), OD-8, C-43 | Expense schema and categories |
| **Before Phase 7's first test** (Orders batch) | OD-3, OD-4, OD-5 (orders), OD-6, OD-7, C-1, C-3, C-13, C-14, C-15/C-24, C-37, C-38, C-39, C-42, C-43, C-44 | The order aggregate, numbering, invariants and schema (Core Value) |
| **Phase 8 discuss** | C-13 (labels), C-18 | Order screens |
| **Phase 9 discuss** | OD-9 / C-26, C-2, C-16 (+ Cloudinary account) | Image delivery, per-order limit, accessible reorder |
| **Phase 10 discuss** | C-40, C-18 | Dashboard metric definitions |
| **Phase 11 discuss** | C-21, C-12, C-36 (scope only), C-17 | Content model, Contact layout, whether Phase 13 runs |
| **Phase 12 discuss** | OD-10 (full retention set), OD-11 | Retention jobs, legal text |
| **Phase 13 discuss** | C-36 (details), OD-10 (inquiry retention) | Inquiry storage, inbox, attachment types |
| **Phase 14 discuss** | OD-10 (audit and financial records), OD-13 (confirm), C-32 (confirm), every open OD-14 item | Release readiness |
| **Phase 15** | C-28 (final), re-check C-1, C-2, C-14, C-15, OD-3, OD-4, OD-7 against real data; **LEGACY-MAPPING.md approval** | All ETL code |
| **Phase 17** | Cutover window, monitoring period, legacy-backup retention, point of no return | Go-live |

## Coverage

All 162 v1 requirements are mapped, each to exactly one phase. There are no orphans and no duplicates.

| Phase | Requirements | Count |
|---|---|---|
| 1 | FND-01…FND-13, QUAL-01, QUAL-03, QUAL-06, SEC-01, SEC-02, SEC-04 | 19 |
| 2 | WEB-01…WEB-08, ORD-09, QUAL-02, QUAL-04, A11Y-01, A11Y-02, A11Y-04, PERF-01, PERF-02, PERF-03, PERF-05 | 18 |
| 3 | OPS-01…OPS-05 | 5 |
| 4 | AUTH-01…AUTH-13, QUAL-05, SEC-03, A11Y-03, AUDIT-01 | 17 |
| 5 | PROF-01…PROF-04, USER-01…USER-08, AUDIT-02 | 13 |
| 6 | CEXP-01…CEXP-04, PERF-04 | 5 |
| 7 | ORD-03, ORD-05, ORD-08, ORD-13, ORD-14, ORD-16, ORD-17, ORD-18, ORD-20, ORD-21 | 10 |
| 8 | ORD-01, ORD-02, ORD-06, ORD-07, ORD-10, ORD-11, ORD-12, ORD-15, ORD-19 | 9 |
| 9 | ORD-04, IMG-01…IMG-05, JOB-01, JOB-02 | 8 |
| 10 | DASH-01…DASH-06 | 6 |
| 11 | PUB-01…PUB-06, GAL-01…GAL-03, CONT-01…CONT-05 | 14 |
| 12 | ANL-01…ANL-09, LEGAL-01…LEGAL-05 | 14 |
| 13 | INQ-01…INQ-08 | 8 |
| 14 | SEC-05, A11Y-05, PERF-06, PERF-07, LEGAL-06 | 5 |
| 15 | MIG-01, MIG-02 | 2 |
| 16 | MIG-03…MIG-08 | 6 |
| 17 | CUT-01…CUT-03 | 3 |
| **Total** | | **162** |

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → … → 17. Decimal insertions (for example 7.1, if C-42 is approved) run between their neighbours. Two phases can run alongside others:
- **Phase 3** can run alongside Phase 4 if the owner prerequisites arrive late.
- **Phase 11's content model** (settings, product lines, closures) is independent of Phases 6–10 after Phase 5. Gallery uploads still need Phase 9.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Hosting Verification & Backend Foundation | 3/13 | In Progress|  |
| 2. Web Foundation & Design System | 0/TBD | Not started | - |
| 3. CI/CD & Staging Deploy | 0/TBD | Not started | - |
| 4. Identity & Authentication | 0/TBD | Not started | - |
| 5. Profile & User Management | 0/TBD | Not started | - |
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
| 17. Production Cutover | 0/TBD | Not started | - |

---
*Roadmap created: 2026-10-07*

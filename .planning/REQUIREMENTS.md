# Requirements: CSPS — Carmen's Stitch & Printing Services

*Created: 2026-10-06T23:54:39-05:00 · Updated: 2026-10-15T22:10:30-05:00*

**Defined:** 2026-10-06
**Core Value:** Staff can record every order (items, payments, discounts, expenses, images) and always see correct, server-computed totals and balances. Existing production data is carried over with zero loss.

**Sources:** `CSPS-PRD.md` §6–§19 (IDs kept verbatim where the PRD defines them), `CSPS-UI-SPEC.md` §7–§13, `.planning/research/FEATURES.md` (proposed IDs for features neither document numbers).
**Conventions:**
- ⚑ marks a requirement whose final shape depends on an owner decision or conflict in PROJECT.md (OD-x / C-x) or research/SUMMARY.md (C-22…C-45). Settle it at that phase's discuss step before writing the first test. Never assume.
- Every requirement needs unit + integration coverage. User journeys also need Playwright coverage (PRD §6, §14).
- Cross-cutting quality requirements (QUAL-*, SEC-*, A11Y-*, PERF-*) are **established** in the phase they map to, then **enforced in every later phase** by the PRD §22 Definition of Done.

## v1 Requirements

Initial release: everything needed to replace the production system at cutover.

### Foundation & Platform (FND)

- [x] **FND-01**: A developer can clone the repo and get the full schema on an empty database from `dotnet ef database update` alone, with no `.bak` present (Prime Directive 11, PRD §5.6)
- [x] **FND-02**: Solution `Csps.slnx` has the four `src/` projects (Domain, Application, Infrastructure, Server), the five test projects and `tools/` per PRD §3.1. The VS template scaffold (`CarmensStitchAndPrintingServices.*`, SpaProxy, `.esproj`) is removed and the port assignments are kept (Vite 5180, API 5115/7028)
- [x] **FND-03**: Architecture tests fail the build when a layer references a forbidden layer or package (PRD §3.2) ⚑ S-3 (NetArchTest vs ArchUnitNET)
- [x] **FND-04**: A development seed creates realistic fake data from UI-SPEC §12 (users for both roles, orders with all children, company expenses, price list, site settings), so every screen is usable without real data
- [x] **FND-05**: Every API error is an RFC 9457 ProblemDetails with `traceId` and field `errors`. No stack traces outside Development. Unknown `/api/*` routes return a ProblemDetails 404, never `index.html`
- [x] **FND-06**: `/health` reports liveness, DB reachability and business time-zone resolution without exposing internals
- [x] **FND-07**: Structured Serilog logging with a correlation id per request, and destructuring policies that mask passwords, codes, tokens and secrets (CWE-532/117)
- [x] **FND-08**: Business calendar (`IBusinessCalendar` over `TimeProvider`) resolves "today", month and year boundaries in the configured business time zone (Asia/Manila fallback chain). No `DateTime.Now` in code ⚑ OD-2
- [x] **FND-09**: SiteSettings core (business name, time zone, currency/locale, contact placeholders) exists as an entity with seed data and a cached read port, available to all later phases ⚑ OD-1
- [x] **FND-10**: Append-only AuditLog table and `IAuditTrail` port record UTC time, actor, action, target, truncated IP, user-agent family and correlation id, with no secrets. Updates and deletes are rejected at the DB level (PRD §11.4)
- [x] **FND-11**: The test SQL fixture runs integration tests against LocalDB (`CSPS_Test_<guid>`) locally and Testcontainers SQL Server 2025 in CI, with Respawn resets and parallel isolation ⚑ C-20, C-29, C-30
- [x] **FND-12**: Migrations are verified to apply cleanly to an empty DB and to the previous version. The idempotent script (`migrations script --idempotent`) applies twice without error at the host's compatibility level ⚑ C-31
- [x] **FND-13**: A hosting verification record captures SmarterASP.NET facts: .NET runtime patch, `@@VERSION`, compatibility level, collation, in-process hosting, client-IP/proxy topology, SMTP deliverability (SPF/DKIM/DMARC), scheduler availability, DB quota and staging-site option. Later phases build on it

### Web Foundation (WEB)

- [x] **WEB-01**: React 19 + TypeScript strict + Vite app in `web/` builds into `src/Csps.Server/wwwroot`. The dev server runs on 5180 (`strictPort`) and proxies `/api` to the API with hard-coded ports (no machine-level env vars) ⚑ S-1 (TS alias pair), S-11
- [x] **WEB-02**: The UI-spec design system (Appendices A–D: tokens, components, screens; `src/components`, `src/utils/csps.ts`, icons, mark; layout per the owner, 2026-10-14) is implemented with **Tailwind v4 utilities for all UI styling** (owner ruling D-33, 2026-10-08, amends the earlier "imported verbatim" wording): CSPS tokens via `@theme`, only theme/`@font-face`/`@keyframes`/base CSS left in stylesheets, and the rendered look proven equal to the approved design (Blush and Espresso, 320/390/820/1440 px) instead of a verbatim-CSS/DOM-equality check. The approved component code is reconciled with PRD gates via `// SPEC-DEVIATION` markers. Fixes include the focus-trapping Modal, Tabs ARIA, `Mark` without `dangerouslySetInnerHTML`, no non-null assertions, and the stricter tsconfig ⚑ C-22, C-10, C-34, C-35
- [x] **WEB-03**: `web/src/core/api/http/httpClient.ts` is a fetch-based, axios-like client (instances, interceptors, timeout/abort, params, JSON/FormData, upload progress via XHR only when requested, single-flight 401 refresh with one retry, capped retries for idempotent calls, normalized `HttpError`) with 100% unit coverage (PRD §9.3)
- [x] **WEB-04**: Endpoint calls live in per-module services (`web/src/modules/{public,admin}/services/`) over the shared client in `web/src/core/api/` (owner, 2026-10-14), not in one file. ESLint keeps the HTTP transport inside `core/api`, lets only the services import `apiClient`, and forbids `fetch` and `axios` elsewhere
- [x] **WEB-05**: Public and Admin layouts per UI-SPEC §2.2/§8.1 (`.s-page[data-theme]`, sidebar/rail/tab bar, mobile nav drawer marked SPEC-GAP) with route-level code splitting and a global error boundary
- [x] **WEB-06**: Shared primitives exist with unit + axe tests: Skeleton family with `aria-busy` + polite live region, EmptyState, ErrorState with retry, ConfirmDialog, Toast, DataTable (`.s-rt` → cards on phones), Pagination, FilterBar/SearchBox, LazyImage, OtpInput, PasswordInput. No primitive is re-implemented in feature code (PRD §9.2)
- [x] **WEB-07**: The money/date formatters and order math (`formatPeso`, `formatDate`, `orderTotals`) agree with the server on a shared golden-vector file (≥ 200 cases including half-centavo values) consumed by both xUnit and Vitest ⚑ C-25 (client rounding change)
- [x] **WEB-08**: TanStack Query provider and query-key conventions: `staleTime` defaults, keep-previous-data pagination, 300 ms debounced search with `AbortSignal` cancellation, intent prefetch
- [x] **WEB-09**: The `core/api` client (WEB-03) sends an `Idempotency-Key` (a UUID from `crypto.randomUUID()`) with every POST (SEC-06). It creates one key per form submission and reuses it on every retry of that submission, including the single-flight 401 refresh retry; a POST carrying a key counts as idempotent for WEB-03's capped retries. Submit buttons are disabled (`aria-disabled`, keeping keyboard focus) and show a pending state while the request is in flight, so a double-click sends one request. `core/api`'s 100% coverage includes key reuse on retry, and component tests cover the pending button (owner, 2026-10-07)
- [x] **WEB-10**: List and page view state lives in the URL query string through **nuqs** (owner, 2026-10-07), so refresh, Back/Forward, a bookmark or a shared link reopens the same view: filters, free-text search, sort, page, page size, the active tab and the view mode. **Setup:** nuqs 2.10.1 (MIT; owner-approved 2026-10-07 after an advisory, deprecation and cool-down check). At install, if a stable 2.10.2 or later is at least 14 days old, ask the owner before switching to it; never take a beta. `NuqsAdapter` comes from `nuqs/adapters/react-router/v8` (never the deprecated `nuqs/adapters/react-router` or the `/v6` and `/v7` paths) and renders inside the router around `<Outlet/>`, never around `RouterProvider`. One shared, lazily loaded layout component (`NuqsAdapter` around `<Outlet/>`, one set of `defaultOptions`) is used as a pathless layout route above the admin routes and above every public route that keeps URL state (today the Gallery, GAL-01), so the other public pages don't load it (about 5.6 KB gz). If that nesting fails, the root route's `<Outlet/>` is the fallback, which still fits the 150 KB public budget (PERF-01). **One hook per list:** each list reads and writes its state only through one typed `useXxxListParams()` hook built on `useQueryStates`, and never copies it into `useState` or form state. **Untrusted input (CWE-20):** every param has an allow-list or validating parser: `parseAsStringLiteral` for status, sort, tab and view; `parseAsNumberLiteral([10, 20, 50, 100])` for page size where a list offers it (default 20; the server still caps it, SEC-03); a page parser that rejects values below 1; search trimmed and capped at 100 characters. Defaults stay out of the URL (`clearOnDefault`). An invalid or out-of-range value falls back to its default and the URL is rewritten once with `replace`; a page past the last page is replaced by the last page, and an empty result shows EmptyState. A param never reaches an `href`, `navigate()` or a redirect without validation (CWE-601). **History:** a page change adds a history entry (`push`); a filter, search, sort, page-size, tab or view change replaces the current entry and resets the page to 1 in the same update. **Data fetching (WEB-08):** TanStack Query keys hold the parsed, defaulted values, never raw strings or `location.search`, and `api.ts` serializes them (WEB-04). The search box writes the URL with `limitUrlUpdates: debounce(300)`, and the query key uses an in-house `useDebouncedValue(q, 300)`, never the immediate value. **Dates:** date filters stay plain `YYYY-MM-DD` strings in business time (Asia/Manila) through a shared `parseAsBusinessDate`, never `parseAsIsoDate`, which round-trips through UTC and shifts the day. A preset range (such as Last 30 days or This month) is stored by its name and resolved against the business "today" on every visit; only a custom range stores `from` and `to`; no default is computed from `new Date()`. **Known nuqs bugs, avoided by rule:** never use the nuqs `startTransition` option (#1567: the value flip-flops; fixed only in 2.10.2-beta.1); keep `shallow: true`, the default, and never set `shallow: false` (#1563, open); never render `<Navigate>` to set or change query params, and redirect from a route `loader` with `redirect()` instead (#1245, open). ESLint rejects the deprecated adapter paths, the `startTransition` option and `shallow: false`. **Privacy (the owner chose search in the URL over keeping it out):** tokens, codes and secrets never go in a URL (PRD §8.2, §9.3); personal data appears only inside the free-text `q`, never as its own param such as `email=` or `phone=`; analytics, Core Web Vitals and any client error report send the path without its query string (ANL-05); the server's request log already records the path without the query string (FND-07); `Referrer-Policy: strict-origin-when-cross-origin` keeps the query from other sites (SEC-01); the server rejects search text over 100 characters (SEC-03). **Tests:** parser unit tests (`size=9999`, `page=0`, `status=bogus`, `from=2026-02-30`); hook component tests through `nuqs/adapters/testing` that assert push vs replace, the page reset and dropped defaults; React Compiler lint is clean on the hooks. Every list screen adds a Playwright test where list → detail → Back restores its filters and rows. Phase 2 builds the adapter, the conventions, the shared hook and parsers and their tests; the list screens in Phases 5, 6, 8, 10, 11, 12 and 13 use them

### Quality Gates (QUAL)

- [x] **QUAL-01**: .NET builds have `TreatWarningsAsErrors`, nullable, latest-recommended analyzers, code style in build, NuGet audit as errors, central package management with no floating versions, and `dotnet format --verify-no-changes` (PRD §17.1)
- [x] **QUAL-02**: TypeScript/ESLint/Prettier run with zero warnings (`--max-warnings 0`). The tsconfig and ESLint rule sets follow PRD §17.2 (no `any`, no non-null assertions, no `console`, no `dangerouslySetInnerHTML`, jsx-a11y strict) ⚑ S-2
- [x] **QUAL-03**: Coverage gates are enforced: Domain 100% line + branch, Application ≥ 95%, `core/api` 100%, web overall ≥ 90% ⚑ S-4
- [x] **QUAL-04**: Playwright E2E runs on its own host port 5199 (`reuseExistingServer: false`) across Chromium, Firefox, WebKit + Pixel/iPhone viewports, and fails on any console error/warning, CSP violation or axe violation. The preflight script runs before dev servers, Playwright and full test runs
- [x] **QUAL-05**: A Testing-environment-only email sink lets E2E read 2FA codes and links. A test proves it is absent from Release builds
- [x] **QUAL-06**: Dependency hygiene: every package has a recorded purpose, license (MIT/Apache-2.0/BSD/ISC, or an owner-approved exception) and legitimacy check. A `THIRD-PARTY-NOTICES` file is generated in CI. A release cool-down policy is recorded ⚑ S-5, S-10

### CI/CD & Hosting (OPS)

- [ ] **OPS-01**: The GitHub repo exists (private) with a PR template carrying the DoD checklist, Conventional Commits, `.gitignore` per PRD §18 and CODEOWNERS. GitHub Free can't enforce branch rules on a private repo, so `main` is protected by the process merge gate (D-08): CI runs every check on every PR, and the merge command refuses unless every check on the PR head is green and the DoD is ticked. The intended rules (PR required, green checks, linear history, 0 approvals, CODEOWNERS, no bypass) are written down, ready to switch on ⚑ C-45 (owner creates the repo; owner, 2026-10-15)
- [ ] **OPS-02**: The CI pipeline on every PR runs locked restore → .NET build → format check → unit → integration → architecture tests → web typecheck/lint/Prettier/Vitest + coverage → web build → Playwright → Lighthouse CI → coverage gates → license notices. Actions are pinned by SHA with least-privilege permissions
- [ ] **OPS-03**: Supply-chain security runs in CI: Dependabot (NuGet, npm, Actions) with cooldown, plus CodeQL, secret scanning with push protection and dependency review, or the owner-approved substitute set ⚑ C-27/S-9
- [ ] **OPS-04**: A deploy runs only when the owner presses Run (`workflow_dispatch`) on a build of `main` that passed CI; that press is the manual approval. The package goes to the live SmarterASP.NET site, the only site on the Basic plan, through Web Deploy with `app_offline.htm`. A smoke test runs afterwards, and a failed smoke test redeploys the last good package automatically ⚑ C-45 (host credentials; owner, 2026-10-15)
- [ ] **OPS-05**: `web.config` provides in-process hosting, HTTPS rewrite, removed server headers, compression, `immutable` caching for hashed assets and `no-cache` for `index.html`. Production configuration secrets live only on the server

### Security (SEC)

- [x] **SEC-01**: Security headers on every response: strict CSP per PRD §11.3 (no `unsafe-inline`/`unsafe-eval`), HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP, `frame-ancestors 'none'`, and server headers removed
- [x] **SEC-02**: Default-deny authorization: a fallback policy plus named policies. A discovery-driven integration test fails if any endpoint lacks a policy or an authorization-matrix row (endpoint × {anonymous, Admin, Manager} → exact status)
- [ ] **SEC-03**: Rate limiting (per IP and per account) on auth, consent, analytics ingestion, inquiry and public endpoints. Request body limits (JSON 1 MB, uploads per §10), and page-size caps (max 100). List endpoints also cap free-text search at 100 characters and reject longer text with a 400 field error, because search text travels in URLs (WEB-10)
- [x] **SEC-04**: Data Protection keys persist to the database, so app-pool recycles don't sign everyone out ⚑ C-32 (key encryption at rest)
- [ ] **SEC-05**: Each phase's security review lists the CWE IDs it touches with the test proving each mitigation. Pre-release: full MITRE CWE Top 25 / ATT&CK review, CodeQL clean, ZAP baseline against staging with no high/critical findings, and signed security checklist (PRD §11.5)
- [ ] **SEC-06**: Form posts are idempotent, so a double-click, retry or network replay never creates a duplicate (owner, 2026-10-07). Every state-changing `POST` requires an `Idempotency-Key` header holding a client-generated UUID. The server stores each key in a relational table with the user id (none for anonymous forms), the route, a SHA-256 hash of the request body, and the response status and body (`nvarchar`, never a JSON column, D-13) for 24 hours, and a key only ever matches for the same user and route. A replay with the same key and body returns the stored response without running the handler again. The same key with a different body gets a 422 ProblemDetails, a duplicate arriving while the first request is still running gets 409, and a missing or malformed key gets 400. Expired keys are ignored at once, and a JOB-01 maintenance job purges them (cron-endpoint pattern, no host scheduler). The only exemptions are POSTs on an explicit allow-list with a written reason, such as sign-in, 2FA verify, refresh and sign-out (their responses carry tokens, which must never be stored) and analytics beacons (ANL-05; beacons can't send headers). The endpoint discovery test (SEC-02) fails on any POST that is neither covered nor allow-listed, and an integration test proves a duplicate POST creates exactly one record. PUT, PATCH and DELETE rely on `rowversion` instead (SEC-07), so a replay can never apply a second change
- [ ] **SEC-07**: Concurrent writes never lose an update or produce wrong money (owner, 2026-10-07). This sharpens CEXP-02, ORD-08 and USER-04 and applies to every later aggregate. Every mutable aggregate (orders with their items, payments, discounts and expenses; company expenses; users; site content; money transfers) uses optimistic concurrency: a `rowversion` (for users, a `rowversion` or Identity's concurrency stamp) comes with every read and must match on every update or delete. A stale write gets a 409 ProblemDetails reading "This was changed by someone else. Reload and try again.", and the UI shows that message and reloads the latest version (ORD-08 also keeps the user's typed input). Check-then-write money operations, such as the transfer balance check (MONEY-05) and the overpayment rule (ORD-05), run in one transaction with locking (e.g. `UPDLOCK, HOLDLOCK` on the guarded rows, or SERIALIZABLE), so two concurrent requests can't both pass the check. Order totals, balances and other server-computed figures are never served stale after a write: no server cache holds them across a write, and the client invalidates every affected query after each mutation. For each aggregate, integration tests run two concurrent conflicting writes and assert that exactly one wins, the other gets 409 or a refusal, and totals and balances stay exact
- [ ] **SEC-08**: Every record staff create or edit shows who entered it and who last changed it (owner, 2026-10-07). Each such record stores `CreatedBy`, `CreatedAt` (UTC), `UpdatedBy` and `UpdatedAt` (UTC). This covers at least orders and their items, payments, discounts, order expenses and images; company expenses; money transfers; site content (settings, product lines and prices, testimonials, closures and gallery items); users; and inquiries once staff edit them. The server sets these values in one place (e.g. an EF `SaveChanges` interceptor, like Phase 1's audit interceptor) from the signed-in user (`IRequestContext.UserId`, the token's `sub` claim) and from `TimeProvider`, never from the request: request DTOs have no such fields, and anything a client sends for them is ignored (spoofing; CWE-915 mass assignment). Nobody can edit them, and no endpoint accepts them. `UpdatedBy` and `UpdatedAt` stay empty until the first change, then change on every staff edit (including actions such as lock, deactivate or a role change), but not on system bookkeeping such as Identity's failed-attempt counter, security stamp or token rotation. A change to a child record (for example a payment) stamps the child and its order, as ORD-08 treats child-only edits as order edits. `CreatedBy` and `UpdatedBy` reference the user, and the name still shows after that user is deactivated or deleted (as CEXP-04, USER-03); the C-41 ruling decides whether that is the soft-deleted user's kept name or a stored name snapshot. Records written with no signed-in user get a fixed attribution that can't sign in: "System" for tools such as the AUTH-12 bootstrap-manager command and for rows that exist before the fields are added, and "Legacy import" for migrated records whose creator is unknown (MIG-10). Anonymous visitor submissions (INQ-01) have no creator. Read endpoints return the values, and every detail or edit view shows them read-only as "Recorded by" and "Last changed by", with the name and the date in business time (ORD-09). They are separate from the domain's people fields: on a payment, Received by (ORD-22) is who took the money and `CreatedBy` is who entered it; on an expense, Paid by (CEXP-05, ORD-23) is whose money paid it. MONEY-04's "recorded by, recorded at" are a transfer's `CreatedBy` and `CreatedAt`. Deletes are covered by the audit log (AUDIT-01), not by these fields. For every aggregate, an integration test sends forged values for all four fields on create and on update and asserts that the stored values come from the token and the clock ⚑ C-41

### Authentication (AUTH)

- [x] **AUTH-01**: Staff can sign in with email + password. Failures show one generic error ("Email or password is incorrect.") and never reveal whether the email exists, with similar timing either way ⚑ C-8
- [x] **AUTH-02**: After a correct password, staff must enter a 6-digit code emailed to them before any session is issued. The code is bound to a pending-login ticket cookie and user, and required on every new sign-in ⚑ C-6, OD-12
- [x] **AUTH-03**: The 6-digit code is valid 15 minutes, single-use, and invalidated after 5 wrong attempts. It is stored only as HMAC-SHA256 and compared in fixed time. A per-account cross-ticket attempt cap applies
- [x] **AUTH-04**: Staff can resend the code after a 60-second cooldown, up to 5 sends per hour per account. A new code invalidates the previous one
- [x] **AUTH-05**: "Keep me signed in" keeps staff signed in for 90 days (absolute). Without it, the session ends when the browser closes, at most 12 hours. Access tokens last 15 minutes and stay in memory only. Refresh tokens are hashed, rotated on every use, delivered as an `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api/v1/auth`, and need an anti-CSRF header ⚑ C-19, C-23
- [x] **AUTH-06**: Staff can sign out, which revokes the current refresh token and clears cookies, and can sign out of all devices from their profile. Reuse of a rotated refresh token revokes the whole family, with a short grace window for concurrent tabs
- [x] **AUTH-07**: An account locks for 15 minutes after 5 failed password attempts, and the user is emailed about the lockout
- [ ] **AUTH-08**: Staff can request a password reset by email. The response is always "If an account exists, we sent a link". The link token is hashed, valid 30 minutes and single-use ⚑ C-7
- [ ] **AUTH-09**: Resetting a password enforces the password policy (AUTH-11), revokes all sessions and sends a "your password was changed" email ⚑ C-5
- [ ] **AUTH-10**: Deactivated or locked users cannot sign in, refresh or reset into an active session
- [ ] **AUTH-11**: Passwords are at least 8 and at most 64 characters with at least one number and one symbol (owner D-11, 2026-10-14, chosen over the NIST recommendation after seeing the trade-off). Any printable characters, spaces included, are allowed; length counts characters (Unicode code points after NFC). Passwords are rejected if found in breach corpora (HIBP k-anonymity, 5-char SHA-1 prefix only; when HIBP is unreachable a bundled common-password list is the floor and invite acceptance fails closed, D-14) or if they contain the user's email local part, first name or last name (parts under 3 characters ignored, D-15). A strength meter and accessible errors are shown ⚑ C-5, C-33 (HIBP fail mode)
- [ ] **AUTH-12**: A first Manager can be bootstrapped on an empty database (CLI command), so staging and production can be signed into without seed data
- [ ] **AUTH-13**: Auth emails (code, lockout, reset, changed-password, invite) are sent from the business domain over TLS SMTP through an outbox behind `IEmailSender`. They contain no secrets beyond the intended code or link ⚑ OD-12

### Profile (PROF)

- [ ] **PROF-01**: Any signed-in user can update their first and last name
- [ ] **PROF-02**: A user can change their email after entering their current password. A confirmation link goes to the new address and a notice to the old one, and the change applies only after confirmation ⚑ C-9
- [ ] **PROF-03**: A user can change their password after entering the current one. The policy is enforced, other sessions are revoked and a notification email is sent
- [ ] **PROF-04**: A user can toggle the admin theme between Blush (light) and Espresso (dark). The choice persists in `localStorage['csps-theme']` and the public site stays light ⚑ C-11

### User Management — Manager only (USER)

- [ ] **USER-01**: A Manager can list users with pagination, search by name/email, and filter by role and status. The search, filters and page live in the URL (WEB-10)
- [ ] **USER-02**: A Manager can create a user (first name, last name, email, role). The user is onboarded without the Manager ever seeing or setting their password (emailed invitation link per PRD) ⚑ C-4
- [ ] **USER-03**: A Manager can edit a user's name, email and role, lock/unlock, deactivate/reactivate, and delete with confirmation. Deleted users' names remain on the orders and expenses they recorded ⚑ C-41
- [ ] **USER-04**: A Manager cannot delete, deactivate or demote themselves, and the system never allows removing the last active Manager (race-safe)
- [ ] **USER-05**: Role or status changes revoke the affected user's sessions immediately
- [ ] **USER-06**: All user-management actions are written to the audit log
- [ ] **USER-07**: A Manager can resend an invitation or send a password-reset link from the Users screen
- [ ] **USER-08**: Non-Managers never see the Users navigation item, and hitting `/admin/users` redirects them to `/admin`. The API returns 403

### Audit (AUDIT)

- [ ] **AUDIT-01**: These events are recorded in the audit log: sign-in success/failure, 2FA issued/verified/failed, lockouts, password reset/change, email change, session revocation, user CRUD/role/status changes, order and company-expense deletions, order status changes and site-content changes
- [ ] **AUDIT-02**: A Manager can view the audit log filtered by actor, action, target and date range (SPEC-GAP screen composed from the `.s-rt` table + toolbar pattern). The filters and page live in the URL (WEB-10), and the actor filter holds the user id, never an email

### Company Expenses (CEXP)

- [ ] **CEXP-01**: Staff can list company expenses with pagination, a date-range filter (default last 30 days), a category filter, search by description or staff name, newest-first sorting and a period total. The date range, category, search and page live in the URL (WEB-10), and the 30-day default is counted from the business "today"
- [ ] **CEXP-02**: Staff can create, update and delete (with confirmation) a company expense: date, category, description, amount > 0. Stale updates return 409 ⚑ OD-5, OD-8, C-43
- [ ] **CEXP-03**: The expenses page shows KPIs: this month, last full month, and top category this month with its share, using business-time-zone month boundaries
- [ ] **CEXP-04**: Each expense shows who recorded it (read-only "Recorded by"), and the attribution survives user deletion. Recorded by is the expense's SEC-08 `CreatedBy`, so the Edit modal shows the original recorder rather than the editor (the UI spec's "{name} (you)" fits only Add, marked SPEC-DEVIATION), and an edited expense also shows a read-only "Last changed by"
- [ ] **CEXP-05**: Every company expense has a required **Paid by**: the staff user who paid it (owner, 2026-10-07). The domain name is `PaidByUserId`, a required (non-null) reference, and the on-screen label is "Paid by". The server validates it on create and edit: it must name an existing, active Admin or Manager, otherwise the request gets a plain-English field error. Any staff member may name any active coworker, as for the payment receiver (ORD-22). A saved expense keeps its payer, with the name still shown, after that user is deactivated or deleted (as CEXP-04, USER-03). The amount comes off the payer's money on hand (MONEY-01), so a change of payer moves money between staff balances and is written to the audit log (old → new payer, who, when); that event joins the AUDIT-01 catalog. The form has a required "Paid by" picker of active staff, the list shows a Paid by column, and CEXP-01's staff-name search also matches it; the UI spec's modal and table lack the field, so both are marked SPEC-GAP. This phase builds the staff lookup (id and display name of active Admins and Managers, open to both roles because the USER-01 roster is Manager-only) that ORD-22 and ORD-23 reuse. Paid by is separate from Recorded by (CEXP-04, SEC-08): Paid by is whose money paid the expense, Recorded by is who entered it ⚑ OD-16, OD-21

### Orders (ORD)

- [ ] **ORD-01**: Staff see a paginated order preview list (grid cards or table) with order number, customer/team, dates, status, Total, Total Paid, Total Discount, Balance, and the cover image as a lazy thumbnail (placeholder if none). The list is projected server-side without N+1 queries ⚑ C-13
- [ ] **ORD-02**: Staff can search orders by number, customer name, team and phone; filter by status (default "Active + recent"), order-date range, product type and "has balance"; sort by due date, newest, balance or total, with server-side pagination (default 20). The search, filters, sort and page live in the URL (WEB-10)
- [ ] **ORD-03**: Staff can create an order (customer details, dates, status, notes, one or more items) in a single database transaction. The API accepts the full aggregate (optionally payments, discount(s), expenses), and the UI follows the UI-spec flow ⚑ C-3, C-14, OD-7
- [ ] **ORD-04**: Staff can upload images to an order (during creation and later): a per-order maximum, reorder via an accessible non-drag alternative, choose the cover, set alt text and delete images ⚑ C-2, C-16, OD-9
- [ ] **ORD-05**: Staff can update order details and add/edit/remove items, payments, discount(s) and order expenses. Each change revalidates invariants (quantity > 0, unit price ≥ 0, description 1–200 chars, payment > 0 and not future-dated in business time, percent 0–100, discount ≤ items total, overpayment rule across all mutation types) and recomputes totals server-side ⚑ C-1, OD-4, C-38
- [ ] **ORD-06**: Staff can delete an order through a cascade confirmation that shows child counts and requires typing the order number. Deletion removes all children in one transaction and schedules its images for storage cleanup ⚑ OD-5, OD-6
- [ ] **ORD-07**: The order detail page shows the image gallery, tabbed Items/Payments/Discounts/Expenses tables with counts and add/edit/delete modals, the live OrderTotals panel and the customer card. The active tab lives in the URL (WEB-10), so Back and a shared link reopen the same tab
- [ ] **ORD-08**: Concurrent edits to the same order, including child-only edits, return 409. The UI explains the conflict, preserves the user's input and offers reload
- [x] **ORD-09**: Money displays as `₱12,450.00` (en-PH, U+2212 minus) and dates as `Oct 6, 2026`. Money inputs accept only valid 2-decimal amounts with the numeric keypad ⚑ OD-1
- [ ] **ORD-10**: The Orders grid ⇄ table view choice persists in `localStorage['csps-orders-view']`. With URL state (WEB-10, owner 2026-10-07), the view shown is the URL's `view` when it is valid (`grid` or `table`), otherwise the saved `localStorage['csps-orders-view']` when it is valid, otherwise Grid, the UI spec's default. Only the explicit toggle writes both the URL (`replace`) and localStorage, so a shared or bookmarked link with `?view=table` applies to that visit only and never overwrites the viewer's saved choice. The `view` parser has no `withDefault`, so a missing value falls through to localStorage, and no localStorage-derived default is ever handed to nuqs (that would break `clearOnDefault`). A component test covers the URL × localStorage matrix
- [ ] **ORD-11**: Orders show overdue / days-left indicators (cards, table, detail subline) computed from the business-time-zone "today"
- [ ] **ORD-12**: An order shows "Fully Paid" when Total > 0 and Balance ≤ 0 (fixture ORD-2026-0151)
- [ ] **ORD-13**: Each order item has a product type (the 6 fixed types) and a free-text size/variant ⚑ C-44
- [ ] **ORD-14**: New orders get a human-readable number `ORD-{YYYY}-{NNNN}`, sequential per year, unique and concurrency-safe. Legacy numbers are preserved ⚑ C-15, C-24
- [ ] **ORD-15**: Leaving the create/edit form with unsaved changes asks "Discard changes?"
- [ ] **ORD-16**: Each order keeps a status change history (from → to, who, when)
- [ ] **ORD-17**: Order status changes follow defined allowed transitions among Pending, Mockup, In Production, Ready, Completed and Cancelled ⚑ OD-3, C-39
- [ ] **ORD-18**: Payments on cancelled orders and refunds follow a decided policy, so collected-cash figures stay correct ⚑ C-37
- [ ] **ORD-19**: The order detail shows internal Order Expenses and Estimated Profit (Total − Discount − Order Expenses), visible to staff only
- [ ] **ORD-20**: The order math reproduces the UI-SPEC §12.2 fixtures exactly (ORD-2026-0148: Total ₱22,450.00 · Discount −₱1,122.50 · Paid −₱12,000.00 · Balance ₱9,327.50 · Expenses ₱6,065.00 · Profit ₱15,262.50)
- [ ] **ORD-21**: The domain exposes a lenient import path (`Order.Import`) and configurable rule constants, so legacy data can be brought in without schema rewrites
- [ ] **ORD-22**: Every order payment has a required **Received by**: the staff user who took the money. The owner calls it "PaidTo"; the domain name is `ReceivedByUserId`, a required (non-null) reference, and the on-screen label is the owner's choice. The server validates it like the other ORD-05 invariants on payment create, payment edit and the full-aggregate create (ORD-03): a new payment, or a change of receiver, must name an existing, active Admin or Manager, otherwise the request gets a plain-English field error. A saved payment keeps its receiver, with the name still shown, after that user is deactivated or deleted (as CEXP-04, USER-03). A change of receiver moves money between staff balances (MONEY-01), so it is written to the audit log (old → new receiver, who, when). A staff lookup (id and display name of active Admins and Managers) serves both roles, because the USER-01 roster is Manager-only. `Order.Import` (ORD-21) accepts the legacy receiver rule (MIG-09). Received by is separate from who entered the payment, its SEC-08 `CreatedBy` (owner, 2026-10-07) ⚑ OD-15, OD-20
- [ ] **ORD-23**: Every order expense has a required **Paid by**: the staff user who paid it (owner, 2026-10-07). The domain name is `PaidByUserId`, a required (non-null) reference, and the on-screen label is "Paid by". The server validates it like the other ORD-05 invariants on order-expense create, order-expense edit and the full-aggregate create (ORD-03): a new order expense, or a change of payer, must name an existing, active Admin or Manager, otherwise the request gets a plain-English field error. Any staff member may name any active coworker, as for ORD-22. A saved order expense keeps its payer, with the name still shown, after that user is deactivated or deleted (as CEXP-04, USER-03). The amount comes off the payer's money on hand (MONEY-01), so a change of payer moves money between staff balances and is written to the audit log (old → new payer, who, when); that event joins the AUDIT-01 catalog. The staff lookup from CEXP-05 serves the picker. Paid by is separate from the expense's CreatedBy (SEC-08): Paid by is whose money paid it, CreatedBy is who entered it. `Order.Import` (ORD-21) accepts the legacy payer rule (MIG-10) ⚑ OD-15, OD-16, OD-21

### Background Jobs (JOB)

- [ ] **JOB-01**: Maintenance work (Cloudinary deletions, token/2FA purge, idempotency-key purge, analytics aggregation and purge, inquiry retention) runs as short, leased, idempotent jobs behind a secret-protected maintenance endpoint, triggered on a schedule (host scheduler or GitHub Actions cron). Nothing relies on long-running in-memory state
- [ ] **JOB-02**: Image deletions are queued in the same transaction as the business change and retried until they succeed. Failures are logged and an orphan sweep reconciles storage

### Images (IMG)

- [ ] **IMG-01**: Order images upload through the server only (multipart → validation → Cloudinary signed upload). The Cloudinary secret never reaches the browser
- [ ] **IMG-02**: Uploads are validated by magic bytes (JPEG/PNG/WebP/HEIC), max 10 MB (configurable), max dimensions, and SVG is rejected. Images are never stored on local disk or in the webroot (CWE-434)
- [ ] **IMG-03**: Images use random public ids in `csps/orders/{orderId}/…`, with EXIF/GPS stripped on delivery and original dimensions stored ⚑ OD-9, C-26
- [ ] **IMG-04**: Images are delivered lazy and responsive (`srcset`/`sizes`, `f_auto,q_auto` or eager variants, explicit width/height, blur/skeleton placeholder). Nothing larger than its display size is loaded
- [ ] **IMG-05**: On mobile, staff can capture an order image with the camera, and it is downscaled client-side before upload

### Admin Dashboard (DASH)

- [ ] **DASH-01**: Staff land on a dashboard with a greeting ("Good morning/afternoon/evening, {firstName}") and the date in business time, plus View Orders / New Order actions
- [ ] **DASH-02**: The dashboard shows KPIs: active orders (+ due this week), total receivables (Σ max(balance, 0) of active orders), collected this month (+ delta vs same day last month), company expenses this month (+ count, top category) ⚑ C-40
- [ ] **DASH-03**: The dashboard shows an income vs expenses chart for the last 6 or 12 months. Income is payments by payment date; expenses are company + order expenses. The 6- or 12-month choice lives in the URL (WEB-10)
- [ ] **DASH-04**: The dashboard shows orders by status, with the active total ⚑ C-40
- [ ] **DASH-05**: The dashboard shows the 6 most recent orders with links to detail
- [ ] **DASH-06**: Every dashboard card has loading (skeleton), empty and error states

### Staff Money (MONEY)

Added by the owner on 2026-10-07: "Every user can have money tied to them and users can transfer their money to basically other user which they are coworker." The owner then ruled the same day that only Managers delete transfers, and that an Admin sees only their own money while a Manager sees everyone's (OD-19, resolved). Later that day the owner added that every expense records who paid it, and that the amount comes off the payer's money on hand (CEXP-05, ORD-23). `CSPS-PRD.md` and `CSPS-UI-SPEC.md` don't cover this yet.

- [ ] **MONEY-01**: Each staff user (Admin or Manager) has a **money on hand** balance that the server computes from the ledger: Σ payments they received (ORD-22) + Σ transfers to them − Σ transfers from them − Σ company and order expenses they paid (CEXP-05, ORD-23; owner ruling, 2026-10-07). Deleted transfers and deleted expenses never count. It is `decimal(18,2)` PHP, never stored as an editable number, and no endpoint accepts a balance value (Core Value: money is computed server-side). The expense payers ship before this phase (CEXP-05 in Phase 6, ORD-23 in Phase 7), so Phase 10 depends on both and no phase moves. An integration test gives one staff member payments received, transfers in and out, and company and order expenses paid, and asserts the exact balance; changing an expense's Paid by moves its amount from one balance to the other exactly ⚑ OD-15, OD-16
- [ ] **MONEY-02**: A staff user can see their own money on hand and its ledger (payments received with their order numbers, transfers in and out, and expenses they paid with their category, plus the order number for order expenses), newest first with server-side pagination, on a SPEC-GAP "My money" screen composed from the existing card and `.s-rt` table patterns. The dashboard shows their money on hand as one card. Every figure comes from the server. The ledger's page lives in the URL (WEB-10)
- [ ] **MONEY-03**: Who sees which balances (owner ruling OD-19, 2026-10-07): an Admin sees only their own money on hand, ledger and transfers. A Manager sees every staff member's money on hand in one list, can open any member's ledger, and sees their own. The transfer list holds only the transfers an Admin sent or received, and every transfer for a Manager. An Admin asking for any other user's balance, ledger or transfers gets 403 whether or not that user exists, so the response reveals nothing (CWE-639, CWE-204). Deactivated or deleted users who still hold money stay visible to Managers
- [ ] **MONEY-04**: A staff user can transfer part of their money on hand to a coworker, meaning another **active** Admin or Manager. The server validates every field with plain-English errors: amount `decimal(18,2)` PHP above zero with at most 2 decimals, recipient different from the sender, transfer date not in the future in business time (`IBusinessCalendar`), optional note of at most 200 characters. The sender is always the signed-in user, taken from the token and never from the request body (CWE-639). Creating a transfer needs an `Idempotency-Key` (SEC-06), so a double-click records one transfer. Each transfer stores from, to, amount, date, note, recorded by, recorded at (UTC) and a `rowversion`
- [ ] **MONEY-05**: By default, a transfer larger than the sender's current money on hand is refused with a plain-English error. The balance check and the insert run in one transaction that locks the sender's ledger (e.g. `UPDLOCK, HOLDLOCK`, or SERIALIZABLE; SEC-07), so two concurrent transfers from the same sender can never together overdraw it. The lock covers every ledger source, including the expenses the sender paid (CEXP-05, ORD-23), so an expense saved at the same moment can't slip past the check. If OD-16 rules that paying an expense may not take the payer below zero, expense create, edit and payer change run the same locked check. An integration test sends two concurrent transfers that together exceed the balance and asserts that exactly one succeeds, the other is refused, and both balances stay exact ⚑ OD-16
- [ ] **MONEY-06**: Only the **Manager** role can delete a transfer record; an Admin gets 403 and an anonymous caller 401 (owner ruling OD-19, 2026-10-07). Delete asks for confirmation and needs the current `rowversion` (a stale one gets 409, SEC-07). Every delete writes an append-only audit entry through `IAuditTrail` (FND-10): who deleted it, when, and what the record said (from, to, amount, date, note, recorded by). Soft delete is recommended, so the record stays visible and past balances stay explainable; a hard delete silently changes past balances, and its audit copy is purged after 8 months (D-32) ⚑ OD-18
- [ ] **MONEY-07**: Transfers can't be edited. There is no update endpoint, and a wrong transfer is corrected by deleting it (MONEY-06) and recording a new one ⚑ OD-17
- [ ] **MONEY-08**: Every staff-money endpoint has authorization-matrix rows for {anonymous, Admin, Manager} with exact statuses (SEC-02). Anonymous gets 401 everywhere. Own balance, own ledger, transfer create and transfer list succeed for both roles, and an Admin's list holds only their own transfers. Another user's balance or ledger, and the all-balances list, get 403 for an Admin and succeed for a Manager. Transfer delete gets 403 for an Admin and succeeds for a Manager. The transfer-deleted event joins the AUDIT-01 catalog

### Public Site (PUB)

- [ ] **PUB-01**: Visitors can browse Home, Products, Gallery and Contact/Get a Quote, built to UI-SPEC §7, plus the legal pages (§13) and a 404 page
- [ ] **PUB-02**: Prices, product lines, address, contact numbers, hours, Messenger link and other business info on public pages load from the database, not hard-coded values ⚑ C-21
- [ ] **PUB-03**: A Manager can edit all public content and the price list (create/edit/reorder/activate/deactivate/delete), and changes appear publicly at once (cache invalidated)
- [ ] **PUB-04**: Public pages have unique titles/meta descriptions, Open Graph tags and `LocalBusiness` JSON-LD from site settings, present in the server-sent HTML (link-preview scrapers don't run JS). `robots.txt` and `sitemap.xml` are served, admin routes are `noindex`, and unknown paths return a real 404
- [ ] **PUB-05**: The Contact page shows "Open now / Closed now" computed from business hours and closure dates in Asia/Manila
- [ ] **PUB-06**: Visitors can reach the shop via Messenger (`m.me` link) and phone (`tel:`) CTAs, including the phone-only sticky bar on Contact

### Gallery (GAL)

- [ ] **GAL-01**: Visitors can browse a masonry gallery filtered by category pills with correct counts. The chosen category lives in the URL (WEB-10, owner 2026-10-07), so a shared gallery link opens on the same category
- [ ] **GAL-02**: Visitors can open a gallery item in a lightbox with position, prev/next wrapping within the filter, Esc/←/→, and swipe plus a button alternative on phones ⚑ C-35
- [ ] **GAL-03**: A Manager can manage gallery items (upload photo, team, category, pieces, note, order, publish/unpublish)

### Site Content (CONT)

- [ ] **CONT-01**: A Manager can edit site settings: business name, tagline, address, map link, phone numbers, email, Messenger URL, social links, business hours, about text, time zone, currency/locale
- [ ] **CONT-02**: A Manager can manage product lines/price list: name, description, "starts at" price, minimum quantity, display order, active flag ⚑ C-21
- [ ] **CONT-03**: A Manager can manage testimonials and the "Recent work" strip
- [ ] **CONT-04**: A Manager can record holiday and special closure dates, which feed "Open now" and JSON-LD opening hours
- [ ] **CONT-05**: Site settings and the price list are served from an output cache / HybridCache, with `ETag`/`Cache-Control`, and invalidated when a Manager edits them

### Inquiries (INQ)

- [ ] **INQ-01**: Visitors can submit the "Get a Quote" inquiry form (name\*, team, PH mobile\*, email, product type, quantity range, message) with the UI-spec validation copy and success state ⚑ C-36
- [ ] **INQ-02**: Visitors can attach reference files to an inquiry, within the owner-approved file types, size and count limits, validated by magic bytes and stored privately ⚑ C-36 (CWE-434)
- [ ] **INQ-03**: The inquiry endpoint is protected by a honeypot, minimum time-to-submit and per-IP rate limits (no CAPTCHA)
- [ ] **INQ-04**: Staff are emailed a notification for each new inquiry, without attachments. The inquiry is persisted before the email is sent ⚑ C-36 (recipient)
- [ ] **INQ-05**: Staff can review inquiries in an admin inbox (unread badge, detail with attachments, status New → Contacted → Quoted → Converted / Closed / Spam, internal note). The inbox's filters and page live in the URL (WEB-10) ⚑ C-36 (visibility)
- [ ] **INQ-06**: Staff can convert an inquiry into a new order with customer, team, contact and product type prefilled, and the two stay linked
- [ ] **INQ-07**: Unconverted inquiries and their attachments are purged after the configured retention period ⚑ OD-10
- [ ] **INQ-08**: The inquiry form shows a privacy notice at collection, linking to the Privacy Policy

### Consent & Analytics (ANL)

- [ ] **ANL-01**: On first visit, visitors see a cookie consent banner with Accept all, Reject all (equally prominent) and Customize. Nothing non-essential is set before a choice
- [ ] **ANL-02**: The browser Global Privacy Control signal is honored as "reject analytics"
- [ ] **ANL-03**: A persistent footer "Cookie settings" link reopens preferences at any time
- [ ] **ANL-04**: A "Clear my cookies & data" button expires non-essential cookies (server-side for HttpOnly ones), clears local/session storage and deletes server-side analytics tied to the visitor id
- [ ] **ANL-05**: With consent, analytics records visitor id (random UUID cookie, ≤ 12 months), sessions, page views, referrer host and device/browser/OS family. IPs are never stored in clear (truncated, then HMAC'd with a rotating salt). Core Web Vitals are collected only with consent. Here and in ANL-06, a page's path is `location.pathname` only: the client never sends the query string or fragment, which can hold search text (WEB-10); Core Web Vitals reports carry the same path; and the server cuts a reported path at the first `?` or `#` before storing it, so a crafted beacon can't store one either
- [ ] **ANL-06**: Without consent, only anonymous aggregate counts (path + day) are recorded, with no cookies or identifiers
- [ ] **ANL-07**: Consent is re-requested when the cookie policy version changes or after 12 months, and every consent decision is logged as proof
- [ ] **ANL-08**: A Manager can view a metrics dashboard (unique visitors, sessions, page views, top pages, top referrers, device/browser split, trend chart, Core Web Vitals) for a chosen date range, and export it as CSV. The date range lives in the URL (WEB-10)
- [ ] **ANL-09**: Raw analytics events are retained for 13 months, then aggregated and purged ⚑ OD-10

### Legal (LEGAL)

- [ ] **LEGAL-01**: Visitors can read a Privacy Policy covering the controller, purposes (orders, inquiries, analytics), retention, rights and contact, drafted for the owner's jurisdiction ⚑ OD-11
- [ ] **LEGAL-02**: Visitors can read a versioned Cookie Policy linked from the consent banner
- [ ] **LEGAL-03**: Visitors can read Terms of Use ⚑ OD-11
- [ ] **LEGAL-04**: Visitors can read an Accessibility Statement with a contact method for issues
- [ ] **LEGAL-05**: All legal pages are linked in the footer, versioned with "last updated" dates, and clearly marked DRAFT until the owner approves the text
- [ ] **LEGAL-06**: Documented Manager procedures exist for data subject requests (access, correction, deletion of a customer's data) and breach response, including the owner notification steps

### Accessibility (A11Y)

- [x] **A11Y-01**: Every page passes axe with zero violations for `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` (vitest-axe per component, `@axe-core/playwright` per page)
- [x] **A11Y-02**: All functionality is keyboard-operable with visible focus, a skip-to-content link, focus trapping and return in dialogs, landmarks with labels, and one `h1` per page
- [x] **A11Y-03**: Accessible authentication: paste allowed in password and OTP fields, `autocomplete` attributes set, no cognitive puzzles
- [x] **A11Y-04**: UI-spec items that conflict with WCAG 2.2 AA (contrast, target size, drag-only, hover-only, auto-dismissing danger toasts) are flagged to the owner and resolved before release ⚑ OD-14, C-35
- [ ] **A11Y-05**: Manual keyboard-only and screen-reader (NVDA + VoiceOver) passes are recorded for critical flows before release

### Performance & Responsive (PERF)

- [x] **PERF-01**: Bundle budgets are enforced in CI from the first build: public route initial JS ≤ 150 KB gz, admin ≤ 250 KB gz, total CSS ≤ 35 KB gz
- [x] **PERF-02**: Public pages score ≥ 95 in every Lighthouse category on the mobile profile, with LCP < 2.0 s, CLS < 0.05 and INP < 200 ms (Lighthouse CI)
- [x] **PERF-03**: Every screen works from 320 px to 1920 px in portrait and landscape (verified at 320/375/414/768/1024/1280/1536/1920) with no horizontal scrolling, touch targets ≥ 44 px, ≥ 16 px inputs and correct `inputmode`/`type`
- [ ] **PERF-04**: List endpoints meet API p95 < 300 ms on the target host with `AsNoTracking` projections, indexes on every filter/sort column, compiled queries on hot paths, and query-count tests guarding against N+1
- [x] **PERF-05**: Fonts are self-hosted woff2, subset, `font-display: swap`, with the primary font preloaded and metric-matched fallbacks. The ₱ glyph renders in the brand font
- [ ] **PERF-06**: Staff can install the admin portal as a PWA (manifest + icons). The service worker caches only static assets and the app shell, never API or authenticated responses, and shows a "new version available — reload" prompt
- [ ] **PERF-07**: Route transitions use the View Transitions API as a progressive enhancement, and all motion is disabled under `prefers-reduced-motion`

### Legacy Migration (MIG)

- [ ] **MIG-01**: The legacy `.bak` is restored read-only into a local, `CSPS_`-prefixed disposable database, and `.planning/LEGACY-SCHEMA.md` documents every table, column, type, key, relationship, row count, value shape (no real customer data), data-quality issues, image storage and user accounts ⚑ C-28
- [ ] **MIG-02**: `.planning/LEGACY-MAPPING.md` maps every legacy field to the new model (or "not migrated — reason"), proposing any new columns/tables. The owner approves it before any ETL code is written
- [ ] **MIG-03**: Approved legacy-only columns (`LegacyId`, legacy order number) are added as nullable via normal migrations
- [ ] **MIG-04**: The `tools/Csps.LegacyMigration` ETL is test-driven, idempotent and re-runnable, with `--dry-run`, batched transactions and clear logs. It writes through the domain into the EF-migrated database that already serves CSPS (live since Phase 3), preserving legacy keys and order numbers, and seeds the per-year order counters from them; how they fit with orders staff have already recorded in CSPS is settled at the Phase 16 discuss step
- [ ] **MIG-05**: Legacy images (if any) are uploaded to Cloudinary with a resumable mapping record
- [ ] **MIG-06**: Legacy user accounts (if any) become profiles. Passwords are not carried over unless verifiably compatible, and users get a "set your password" email at go-live
- [ ] **MIG-07**: An automated reconciliation report compares legacy source vs new: row counts per entity; Σ items, payments, discounts, order expenses and company expenses; per-order Total/Paid/Balance. Every transformed or rejected row is listed with a reason. Cutover is blocked unless it is 100% with zero unexplained differences
- [ ] **MIG-08**: A timed local dress rehearsal with the verified legacy `.bak` kept in Phase 3 succeeds end to end (the Basic plan has only the live site)
- [ ] **MIG-09**: Every migrated payment gets a Received by (ORD-22) under the rule in the approved `LEGACY-MAPPING.md`, because legacy payments probably name no receiver. Example rules: a designated "Legacy / unassigned" holder that can't sign in, or an owner-chosen staff user. No migrated payment is dropped or changed (amount, date, method, reference and order link stay exact), and MIG-07 reconciliation covers every one. The same ruling says whether migrated payments count toward money on hand (MONEY-01) ⚑ OD-15
- [ ] **MIG-10**: Every migrated company expense and order expense gets a Paid by (CEXP-05, ORD-23), and every migrated record gets its SEC-08 attribution, under the rules in the approved `LEGACY-MAPPING.md` (owner, 2026-10-07). A record whose legacy creator is unknown is attributed to a fixed "Legacy import" identity that can't sign in. Its CreatedAt comes from the legacy timestamp where the mapping finds one (converted to UTC), otherwise from the import time. No migrated expense or record is dropped or changed (amount, date, category, description and order link stay exact), and MIG-07 reconciliation covers every one. The OD-15 ruling says who the Paid by is for migrated expenses, whether those expenses count toward money on hand (MONEY-01), and whether a legacy record that names its creator keeps that creator as a migrated user (MIG-06) ⚑ OD-15

### Cutover (CUT)

- [ ] **CUT-01**: Production hosting is ready: production SQL login with least privilege, scheduled DB backups enabled, a restore procedure tested once, TLS certificate and HSTS active after verification, and SPF/DKIM/DMARC configured on the sender domain
- [ ] **CUT-02**: A legacy data cutover runbook exists and is executed with the owner present: maintenance notice, a fresh backup of the live CSPS database kept as the rollback, ETL from the verified legacy `.bak` + 100% reconciliation, deploy + smoke test, owner verifies sample orders and totals, a documented point of no return and a rollback plan. The site switch already happened in Phase 3 (owner, 2026-10-15)
- [ ] **CUT-03**: After go-live, logs, errors and key flows (sign-in, order create, payments) are monitored for an agreed period, and migrated users receive their set-password emails

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Orders (later)

- **ORD-V2-01**: Staff can attach non-image files (rosters, PDF/AI artwork) to an order. Pull into v1 if INQ-02 accepts PDF/AI
- **ORD-V2-02**: Staff can print a customer-safe order summary labelled "Order summary — not an official receipt" (excludes estimated profit)
- **ORD-V2-03**: Staff can duplicate an order for a reorder
- **ORD-V2-04**: Staff can record a per-player roster/size breakdown on an order (changes the item model; validate against migrated data first)

### Customers

- **CUST-01**: Staff can pick a reusable customer record instead of retyping repeat customers (moves to v1 if OD-7 chooses the Customer entity)
- **CUST-02**: Staff can store customer measurement profiles for tailoring

### Growth & Insight

- **ANL-V2-01**: A Manager can see inquiry → order conversion metrics
- **PUB-V2-01**: The quote form can be prefilled from a product or gallery item ("Get a quote for something like this")
- **GAL-V2-01**: Staff can publish an order image to the gallery
- **CEXP-V2-01**: Staff can export company expenses as CSV
- **LEGAL-V2-01**: A Manager can look up, export and anonymize all data for a phone/email (DSR tool; v1 keeps the documented procedure)

### Platform

- **AUTH-V2-01**: Staff can use SMS or an authenticator app as the second factor (`ISecondFactorDelivery` abstraction ready)
- **API-V2-01**: The Android app consumes the same API with body-delivered refresh tokens (API is client-agnostic in v1)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Customer self-service accounts / customer portal | Staff-only portal this milestone (PRD §23) |
| Online payments / payment gateway | Payments are recorded manually (Cash, GCash, Maya, bank transfer) (PRD §23) |
| Official receipts / invoices | BIR registration (CAS, RR 7-2024) compliance risk. Only an internal order summary is allowed later (ORD-V2-02) |
| The Android app itself | API stays client-agnostic so it can be added later (PRD §15, §23) |
| Multi-language UI | English copy per UI spec (PRD §23) |
| Marketing emails | Transactional email only, no marketing without separate consent (PRD §13, §23) |
| Inventory | Not part of the shop's workflow (PRD §23) |
| Financial reporting beyond order summary, expense totals, dashboard KPIs, visitor metrics | PRD §23. Staff money on hand (MONEY-*) is an owner-added ledger, not a report (2026-10-07) |
| Meta Pixel / Messenger chat plugin | Privacy and performance cost. The plugin was retired in 2024; use `m.me` links |
| reCAPTCHA / cognitive puzzles | Accessibility (WCAG 3.3.8) and privacy. Use honeypot + time-trap + rate limits instead |
| Embedded Google Maps iframe | CSP, privacy and performance. The UI spec's stylized SVG map + "Directions" link is used |
| Instant online price calculator | Pricing is quote-based via mockup |
| Drag-only Kanban board / real-time sync | Not needed at ~5 staff. Drag-only violates WCAG 2.5.7 |
| Modifying legacy data, on the host or anywhere else | Prime Directive 1 as amended (owner, 2026-10-15): the legacy site and database are retired in Phase 3 after a verified `.bak` is kept; legacy data reaches CSPS only through the Phase 16/17 import |
| Deriving the schema from the legacy `.bak` | Prime Directive 11. Legacy data is reshaped to fit the new schema |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 1 | Complete |
| FND-04 | Phase 1 | Complete |
| FND-05 | Phase 1 | Complete |
| FND-06 | Phase 1 | Complete |
| FND-07 | Phase 1 | Complete |
| FND-08 | Phase 1 | Complete |
| FND-09 | Phase 1 | Complete |
| FND-10 | Phase 1 | Complete |
| FND-11 | Phase 1 | Complete |
| FND-12 | Phase 1 | Complete |
| FND-13 | Phase 1 | Complete |
| WEB-01 | Phase 2 | Complete |
| WEB-02 | Phase 2 | Complete |
| WEB-03 | Phase 2 | Complete |
| WEB-04 | Phase 2 | Complete |
| WEB-05 | Phase 2 | Complete |
| WEB-06 | Phase 2 | Complete |
| WEB-07 | Phase 2 | Complete |
| WEB-08 | Phase 2 | Complete |
| WEB-09 | Phase 2 | Complete |
| WEB-10 | Phase 2 | Complete |
| QUAL-01 | Phase 1 | Complete |
| QUAL-02 | Phase 2 | Complete |
| QUAL-03 | Phase 1 | Complete |
| QUAL-04 | Phase 2 | Complete |
| QUAL-05 | Phase 4 | Complete |
| QUAL-06 | Phase 1 | Complete |
| OPS-01 | Phase 3 | Pending |
| OPS-02 | Phase 3 | Pending |
| OPS-03 | Phase 3 | Pending |
| OPS-04 | Phase 3 | Pending |
| OPS-05 | Phase 3 | Pending |
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 4 | Pending |
| SEC-04 | Phase 1 | Complete |
| SEC-05 | Phase 14 | Pending |
| SEC-06 | Phase 4 | Pending |
| SEC-07 | Phase 5 | Pending |
| SEC-08 | Phase 5 | Pending |
| AUTH-01 | Phase 4 | Complete |
| AUTH-02 | Phase 4 | Complete |
| AUTH-03 | Phase 4 | Complete |
| AUTH-04 | Phase 4 | Complete |
| AUTH-05 | Phase 4 | Complete |
| AUTH-06 | Phase 4 | Complete |
| AUTH-07 | Phase 4 | Complete |
| AUTH-08 | Phase 4 | Pending |
| AUTH-09 | Phase 4 | Pending |
| AUTH-10 | Phase 4 | Pending |
| AUTH-11 | Phase 4 | Pending |
| AUTH-12 | Phase 4 | Pending |
| AUTH-13 | Phase 4 | Pending |
| PROF-01 | Phase 5 | Pending |
| PROF-02 | Phase 5 | Pending |
| PROF-03 | Phase 5 | Pending |
| PROF-04 | Phase 5 | Pending |
| USER-01 | Phase 5 | Pending |
| USER-02 | Phase 5 | Pending |
| USER-03 | Phase 5 | Pending |
| USER-04 | Phase 5 | Pending |
| USER-05 | Phase 5 | Pending |
| USER-06 | Phase 5 | Pending |
| USER-07 | Phase 5 | Pending |
| USER-08 | Phase 5 | Pending |
| AUDIT-01 | Phase 4 | Pending |
| AUDIT-02 | Phase 5 | Pending |
| CEXP-01 | Phase 6 | Pending |
| CEXP-02 | Phase 6 | Pending |
| CEXP-03 | Phase 6 | Pending |
| CEXP-04 | Phase 6 | Pending |
| CEXP-05 | Phase 6 | Pending |
| ORD-01 | Phase 8 | Pending |
| ORD-02 | Phase 8 | Pending |
| ORD-03 | Phase 7 | Pending |
| ORD-04 | Phase 9 | Pending |
| ORD-05 | Phase 7 | Pending |
| ORD-06 | Phase 8 | Pending |
| ORD-07 | Phase 8 | Pending |
| ORD-08 | Phase 7 | Pending |
| ORD-09 | Phase 2 | Complete |
| ORD-10 | Phase 8 | Pending |
| ORD-11 | Phase 8 | Pending |
| ORD-12 | Phase 8 | Pending |
| ORD-13 | Phase 7 | Pending |
| ORD-14 | Phase 7 | Pending |
| ORD-15 | Phase 8 | Pending |
| ORD-16 | Phase 7 | Pending |
| ORD-17 | Phase 7 | Pending |
| ORD-18 | Phase 7 | Pending |
| ORD-19 | Phase 8 | Pending |
| ORD-20 | Phase 7 | Pending |
| ORD-21 | Phase 7 | Pending |
| ORD-22 | Phase 7 | Pending |
| ORD-23 | Phase 7 | Pending |
| JOB-01 | Phase 9 | Pending |
| JOB-02 | Phase 9 | Pending |
| IMG-01 | Phase 9 | Pending |
| IMG-02 | Phase 9 | Pending |
| IMG-03 | Phase 9 | Pending |
| IMG-04 | Phase 9 | Pending |
| IMG-05 | Phase 9 | Pending |
| DASH-01 | Phase 10 | Pending |
| DASH-02 | Phase 10 | Pending |
| DASH-03 | Phase 10 | Pending |
| DASH-04 | Phase 10 | Pending |
| DASH-05 | Phase 10 | Pending |
| DASH-06 | Phase 10 | Pending |
| MONEY-01 | Phase 10 | Pending |
| MONEY-02 | Phase 10 | Pending |
| MONEY-03 | Phase 10 | Pending |
| MONEY-04 | Phase 10 | Pending |
| MONEY-05 | Phase 10 | Pending |
| MONEY-06 | Phase 10 | Pending |
| MONEY-07 | Phase 10 | Pending |
| MONEY-08 | Phase 10 | Pending |
| PUB-01 | Phase 11 | Pending |
| PUB-02 | Phase 11 | Pending |
| PUB-03 | Phase 11 | Pending |
| PUB-04 | Phase 11 | Pending |
| PUB-05 | Phase 11 | Pending |
| PUB-06 | Phase 11 | Pending |
| GAL-01 | Phase 11 | Pending |
| GAL-02 | Phase 11 | Pending |
| GAL-03 | Phase 11 | Pending |
| CONT-01 | Phase 11 | Pending |
| CONT-02 | Phase 11 | Pending |
| CONT-03 | Phase 11 | Pending |
| CONT-04 | Phase 11 | Pending |
| CONT-05 | Phase 11 | Pending |
| INQ-01 | Phase 13 | Pending |
| INQ-02 | Phase 13 | Pending |
| INQ-03 | Phase 13 | Pending |
| INQ-04 | Phase 13 | Pending |
| INQ-05 | Phase 13 | Pending |
| INQ-06 | Phase 13 | Pending |
| INQ-07 | Phase 13 | Pending |
| INQ-08 | Phase 13 | Pending |
| ANL-01 | Phase 12 | Pending |
| ANL-02 | Phase 12 | Pending |
| ANL-03 | Phase 12 | Pending |
| ANL-04 | Phase 12 | Pending |
| ANL-05 | Phase 12 | Pending |
| ANL-06 | Phase 12 | Pending |
| ANL-07 | Phase 12 | Pending |
| ANL-08 | Phase 12 | Pending |
| ANL-09 | Phase 12 | Pending |
| LEGAL-01 | Phase 12 | Pending |
| LEGAL-02 | Phase 12 | Pending |
| LEGAL-03 | Phase 12 | Pending |
| LEGAL-04 | Phase 12 | Pending |
| LEGAL-05 | Phase 12 | Pending |
| LEGAL-06 | Phase 14 | Pending |
| A11Y-01 | Phase 2 | Complete |
| A11Y-02 | Phase 2 | Complete |
| A11Y-03 | Phase 4 | Complete |
| A11Y-04 | Phase 2 | Complete |
| A11Y-05 | Phase 14 | Pending |
| PERF-01 | Phase 2 | Complete |
| PERF-02 | Phase 2 | Complete |
| PERF-03 | Phase 2 | Complete |
| PERF-04 | Phase 6 | Pending |
| PERF-05 | Phase 2 | Complete |
| PERF-06 | Phase 14 | Pending |
| PERF-07 | Phase 14 | Pending |
| MIG-01 | Phase 15 | Pending |
| MIG-02 | Phase 15 | Pending |
| MIG-03 | Phase 16 | Pending |
| MIG-04 | Phase 16 | Pending |
| MIG-05 | Phase 16 | Pending |
| MIG-06 | Phase 16 | Pending |
| MIG-07 | Phase 16 | Pending |
| MIG-08 | Phase 16 | Pending |
| MIG-09 | Phase 16 | Pending |
| MIG-10 | Phase 16 | Pending |
| CUT-01 | Phase 17 | Pending |
| CUT-02 | Phase 17 | Pending |
| CUT-03 | Phase 17 | Pending |

**Coverage:**
- v1 requirements: 180 total
- Mapped to phases: 180
- Unmapped: 0 ✓

Cross-cutting QUAL/SEC/A11Y/PERF requirements are mapped to the phase where their gate is first built. Every later phase enforces them through the PRD §22 Definition of Done (see ROADMAP.md "Roadmap Conventions").

---
*Requirements defined: 2026-10-06*
*Last updated: 2026-10-15T22:10:30-05:00 after plan 03-23 amended OPS-01, OPS-04, MIG-04, MIG-08 and CUT-02 to the Phase 3 owner decisions. Earlier: 2026-10-14T20:26:27-05:00 after plan 04-04 amended AUTH-11 to the owner's password rule (D-11: 8 to 64 characters with a number and a symbol; AUTH-09 now names the policy). Earlier: 2026-10-07, the owner chose URL query-string state with nuqs (WEB-10; 180/180 mapped)*

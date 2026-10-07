# Requirements: CSPS — Carmen's Stitch & Printing Services

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

- [ ] **FND-01**: A developer can clone the repo and get the full schema on an empty database from `dotnet ef database update` alone, with no `.bak` present (Prime Directive 11, PRD §5.6)
- [ ] **FND-02**: Solution `Csps.slnx` has the four `src/` projects (Domain, Application, Infrastructure, Server), the five test projects and `tools/` per PRD §3.1. The VS template scaffold (`CarmensStitchAndPrintingServices.*`, SpaProxy, `.esproj`) is removed and the port assignments are kept (Vite 5180, API 5115/7028)
- [x] **FND-03**: Architecture tests fail the build when a layer references a forbidden layer or package (PRD §3.2) ⚑ S-3 (NetArchTest vs ArchUnitNET)
- [x] **FND-04**: A development seed creates realistic fake data from UI-SPEC §12 (users for both roles, orders with all children, company expenses, price list, site settings), so every screen is usable without real data
- [x] **FND-05**: Every API error is an RFC 9457 ProblemDetails with `traceId` and field `errors`. No stack traces outside Development. Unknown `/api/*` routes return a ProblemDetails 404, never `index.html`
- [x] **FND-06**: `/health` reports liveness, DB reachability and business time-zone resolution without exposing internals
- [x] **FND-07**: Structured Serilog logging with a correlation id per request, and destructuring policies that mask passwords, codes, tokens and secrets (CWE-532/117)
- [x] **FND-08**: Business calendar (`IBusinessCalendar` over `TimeProvider`) resolves "today", month and year boundaries in the configured business time zone (Asia/Manila fallback chain). No `DateTime.Now` in code ⚑ OD-2
- [x] **FND-09**: SiteSettings core (business name, time zone, currency/locale, contact placeholders) exists as an entity with seed data and a cached read port, available to all later phases ⚑ OD-1
- [ ] **FND-10**: Append-only AuditLog table and `IAuditTrail` port record UTC time, actor, action, target, truncated IP, user-agent family and correlation id, with no secrets. Updates and deletes are rejected at the DB level (PRD §11.4)
- [x] **FND-11**: The test SQL fixture runs integration tests against LocalDB (`CSPS_Test_<guid>`) locally and Testcontainers SQL Server 2025 in CI, with Respawn resets and parallel isolation ⚑ C-20, C-29, C-30
- [ ] **FND-12**: Migrations are verified to apply cleanly to an empty DB and to the previous version. The idempotent script (`migrations script --idempotent`) applies twice without error at the host's compatibility level ⚑ C-31
- [ ] **FND-13**: A hosting verification record captures SmarterASP.NET facts: .NET runtime patch, `@@VERSION`, compatibility level, collation, in-process hosting, client-IP/proxy topology, SMTP deliverability (SPF/DKIM/DMARC), scheduler availability, DB quota and staging-site option. Later phases build on it

### Web Foundation (WEB)

- [ ] **WEB-01**: React 19 + TypeScript strict + Vite app in `web/` builds into `src/Csps.Server/wwwroot`. The dev server runs on 5180 (`strictPort`) and proxies `/api` to the API with hard-coded ports (no machine-level env vars) ⚑ S-1 (TS alias pair), S-11
- [ ] **WEB-02**: The UI-spec design system (Appendices A–D: tokens, globals, compat, components, screens CSS; `src/ui`, `src/lib/csps.ts`, icons, mark) is imported verbatim, then reconciled with PRD gates via `// SPEC-DEVIATION` markers with no DOM/markup change. Fixes include the focus-trapping Modal, Tabs ARIA, `Mark` without `dangerouslySetInnerHTML`, no non-null assertions, and the stricter tsconfig ⚑ C-22, C-10, C-34, C-35
- [ ] **WEB-03**: `web/src/lib/http/httpClient.ts` is a fetch-based, axios-like client (instances, interceptors, timeout/abort, params, JSON/FormData, upload progress via XHR only when requested, single-flight 401 refresh with one retry, capped retries for idempotent calls, normalized `HttpError`) with 100% unit coverage (PRD §9.3)
- [ ] **WEB-04**: `web/src/lib/api.ts` is the only module that defines endpoint calls (grouped `api.auth/orders/expenses/users/site/analytics/profile/inquiries`). ESLint forbids `fetch`, `httpClient` and `axios` imports elsewhere
- [ ] **WEB-05**: Public and Admin layouts per UI-SPEC §2.2/§8.1 (`.s-page[data-theme]`, sidebar/rail/tab bar, mobile nav drawer marked SPEC-GAP) with route-level code splitting and a global error boundary
- [ ] **WEB-06**: Shared primitives exist with unit + axe tests: Skeleton family with `aria-busy` + polite live region, EmptyState, ErrorState with retry, ConfirmDialog, Toast, DataTable (`.s-rt` → cards on phones), Pagination, FilterBar/SearchBox, LazyImage, OtpInput, PasswordInput. No primitive is re-implemented in feature code (PRD §9.2)
- [ ] **WEB-07**: The money/date formatters and order math (`formatPeso`, `formatDate`, `orderTotals`) agree with the server on a shared golden-vector file (≥ 200 cases including half-centavo values) consumed by both xUnit and Vitest ⚑ C-25 (client rounding change)
- [ ] **WEB-08**: TanStack Query provider and query-key conventions: `staleTime` defaults, keep-previous-data pagination, 300 ms debounced search with `AbortSignal` cancellation, intent prefetch

### Quality Gates (QUAL)

- [x] **QUAL-01**: .NET builds have `TreatWarningsAsErrors`, nullable, latest-recommended analyzers, code style in build, NuGet audit as errors, central package management with no floating versions, and `dotnet format --verify-no-changes` (PRD §17.1)
- [ ] **QUAL-02**: TypeScript/ESLint/Prettier run with zero warnings (`--max-warnings 0`). The tsconfig and ESLint rule sets follow PRD §17.2 (no `any`, no non-null assertions, no `console`, no `dangerouslySetInnerHTML`, jsx-a11y strict) ⚑ S-2
- [ ] **QUAL-03**: Coverage gates are enforced: Domain 100% line + branch, Application ≥ 95%, `lib/http` 100%, web overall ≥ 90% ⚑ S-4
- [ ] **QUAL-04**: Playwright E2E runs on its own host port 5199 (`reuseExistingServer: false`) across Chromium, Firefox, WebKit + Pixel/iPhone viewports, and fails on any console error/warning, CSP violation or axe violation. The preflight script runs before dev servers, Playwright and full test runs
- [ ] **QUAL-05**: A Testing-environment-only email sink lets E2E read 2FA codes and links. A test proves it is absent from Release builds
- [ ] **QUAL-06**: Dependency hygiene: every package has a recorded purpose, license (MIT/Apache-2.0/BSD/ISC, or an owner-approved exception) and legitimacy check. A `THIRD-PARTY-NOTICES` file is generated in CI. A release cool-down policy is recorded ⚑ S-5, S-10

### CI/CD & Hosting (OPS)

- [ ] **OPS-01**: The GitHub repo exists with a protected `main` (PR required, green checks, linear history, CODEOWNERS), a PR template with the DoD checklist, Conventional Commits and `.gitignore` per PRD §18 ⚑ C-45 (owner creates the repo)
- [ ] **OPS-02**: The CI pipeline on every PR runs locked restore → .NET build → format check → unit → integration → architecture tests → web typecheck/lint/Prettier/Vitest + coverage → web build → Playwright → Lighthouse CI → coverage gates → license notices. Actions are pinned by SHA with least-privilege permissions
- [ ] **OPS-03**: Supply-chain security runs in CI: Dependabot (NuGet, npm, Actions) with cooldown, plus CodeQL, secret scanning with push protection and dependency review, or the owner-approved substitute set ⚑ C-27/S-9
- [ ] **OPS-04**: Merge to `main` deploys to a SmarterASP.NET staging site via Web Deploy with `app_offline.htm`, and a staging smoke E2E runs afterwards. Production deploy requires manual approval ⚑ C-45 (host credentials)
- [ ] **OPS-05**: `web.config` provides in-process hosting, HTTPS rewrite, removed server headers, compression, `immutable` caching for hashed assets and `no-cache` for `index.html`. Production configuration secrets live only on the server

### Security (SEC)

- [x] **SEC-01**: Security headers on every response: strict CSP per PRD §11.3 (no `unsafe-inline`/`unsafe-eval`), HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP, `frame-ancestors 'none'`, and server headers removed
- [x] **SEC-02**: Default-deny authorization: a fallback policy plus named policies. A discovery-driven integration test fails if any endpoint lacks a policy or an authorization-matrix row (endpoint × {anonymous, Admin, Manager} → exact status)
- [ ] **SEC-03**: Rate limiting (per IP and per account) on auth, consent, analytics ingestion, inquiry and public endpoints. Request body limits (JSON 1 MB, uploads per §10), and page-size caps (max 100)
- [ ] **SEC-04**: Data Protection keys persist to the database, so app-pool recycles don't sign everyone out ⚑ C-32 (key encryption at rest)
- [ ] **SEC-05**: Each phase's security review lists the CWE IDs it touches with the test proving each mitigation. Pre-release: full MITRE CWE Top 25 / ATT&CK review, CodeQL clean, ZAP baseline against staging with no high/critical findings, and signed security checklist (PRD §11.5)

### Authentication (AUTH)

- [ ] **AUTH-01**: Staff can sign in with email + password. Failures show one generic error ("Email or password is incorrect.") and never reveal whether the email exists, with similar timing either way ⚑ C-8
- [ ] **AUTH-02**: After a correct password, staff must enter a 6-digit code emailed to them before any session is issued. The code is bound to a pending-login ticket cookie and user, and required on every new sign-in ⚑ C-6, OD-12
- [ ] **AUTH-03**: The 6-digit code is valid 15 minutes, single-use, and invalidated after 5 wrong attempts. It is stored only as HMAC-SHA256 and compared in fixed time. A per-account cross-ticket attempt cap applies
- [ ] **AUTH-04**: Staff can resend the code after a 60-second cooldown, up to 5 sends per hour per account. A new code invalidates the previous one
- [ ] **AUTH-05**: "Keep me signed in" keeps staff signed in for 90 days (absolute). Without it, the session ends when the browser closes, at most 12 hours. Access tokens last 15 minutes and stay in memory only. Refresh tokens are hashed, rotated on every use, delivered as an `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api/v1/auth`, and need an anti-CSRF header ⚑ C-19, C-23
- [ ] **AUTH-06**: Staff can sign out, which revokes the current refresh token and clears cookies, and can sign out of all devices from their profile. Reuse of a rotated refresh token revokes the whole family, with a short grace window for concurrent tabs
- [ ] **AUTH-07**: An account locks for 15 minutes after 5 failed password attempts, and the user is emailed about the lockout
- [ ] **AUTH-08**: Staff can request a password reset by email. The response is always "If an account exists, we sent a link". The link token is hashed, valid 30 minutes and single-use ⚑ C-7
- [ ] **AUTH-09**: Resetting a password enforces the password policy, revokes all sessions and sends a "your password was changed" email ⚑ C-5
- [ ] **AUTH-10**: Deactivated or locked users cannot sign in, refresh or reset into an active session
- [ ] **AUTH-11**: Passwords follow the NIST SP 800-63B policy (12–128 chars, any printable characters, no composition or rotation rules). They are rejected if found in breach corpora (HIBP k-anonymity, 5-char SHA-1 prefix only) or if they contain the user's email or name. A strength meter and accessible errors are shown ⚑ C-5, C-33 (HIBP fail mode)
- [ ] **AUTH-12**: A first Manager can be bootstrapped on an empty database (CLI command), so staging and production can be signed into without seed data
- [ ] **AUTH-13**: Auth emails (code, lockout, reset, changed-password, invite) are sent from the business domain over TLS SMTP through an outbox behind `IEmailSender`. They contain no secrets beyond the intended code or link ⚑ OD-12

### Profile (PROF)

- [ ] **PROF-01**: Any signed-in user can update their first and last name
- [ ] **PROF-02**: A user can change their email after entering their current password. A confirmation link goes to the new address and a notice to the old one, and the change applies only after confirmation ⚑ C-9
- [ ] **PROF-03**: A user can change their password after entering the current one. The policy is enforced, other sessions are revoked and a notification email is sent
- [ ] **PROF-04**: A user can toggle the admin theme between Blush (light) and Espresso (dark). The choice persists in `localStorage['csps-theme']` and the public site stays light ⚑ C-11

### User Management — Manager only (USER)

- [ ] **USER-01**: A Manager can list users with pagination, search by name/email, and filter by role and status
- [ ] **USER-02**: A Manager can create a user (first name, last name, email, role). The user is onboarded without the Manager ever seeing or setting their password (emailed invitation link per PRD) ⚑ C-4
- [ ] **USER-03**: A Manager can edit a user's name, email and role, lock/unlock, deactivate/reactivate, and delete with confirmation. Deleted users' names remain on the orders and expenses they recorded ⚑ C-41
- [ ] **USER-04**: A Manager cannot delete, deactivate or demote themselves, and the system never allows removing the last active Manager (race-safe)
- [ ] **USER-05**: Role or status changes revoke the affected user's sessions immediately
- [ ] **USER-06**: All user-management actions are written to the audit log
- [ ] **USER-07**: A Manager can resend an invitation or send a password-reset link from the Users screen
- [ ] **USER-08**: Non-Managers never see the Users navigation item, and hitting `/admin/users` redirects them to `/admin`. The API returns 403

### Audit (AUDIT)

- [ ] **AUDIT-01**: These events are recorded in the audit log: sign-in success/failure, 2FA issued/verified/failed, lockouts, password reset/change, email change, session revocation, user CRUD/role/status changes, order and company-expense deletions, order status changes and site-content changes
- [ ] **AUDIT-02**: A Manager can view the audit log filtered by actor, action, target and date range (SPEC-GAP screen composed from the `.s-rt` table + toolbar pattern)

### Company Expenses (CEXP)

- [ ] **CEXP-01**: Staff can list company expenses with pagination, a date-range filter (default last 30 days), a category filter, search by description or staff name, newest-first sorting and a period total
- [ ] **CEXP-02**: Staff can create, update and delete (with confirmation) a company expense: date, category, description, amount > 0. Stale updates return 409 ⚑ OD-5, OD-8, C-43
- [ ] **CEXP-03**: The expenses page shows KPIs: this month, last full month, and top category this month with its share, using business-time-zone month boundaries
- [ ] **CEXP-04**: Each expense shows who recorded it (read-only "Recorded by"), and the attribution survives user deletion

### Orders (ORD)

- [ ] **ORD-01**: Staff see a paginated order preview list (grid cards or table) with order number, customer/team, dates, status, Total, Total Paid, Total Discount, Balance, and the cover image as a lazy thumbnail (placeholder if none). The list is projected server-side without N+1 queries ⚑ C-13
- [ ] **ORD-02**: Staff can search orders by number, customer name, team and phone; filter by status (default "Active + recent"), order-date range, product type and "has balance"; sort by due date, newest, balance or total, with server-side pagination (default 20)
- [ ] **ORD-03**: Staff can create an order (customer details, dates, status, notes, one or more items) in a single database transaction. The API accepts the full aggregate (optionally payments, discount(s), expenses), and the UI follows the UI-spec flow ⚑ C-3, C-14, OD-7
- [ ] **ORD-04**: Staff can upload images to an order (during creation and later): a per-order maximum, reorder via an accessible non-drag alternative, choose the cover, set alt text and delete images ⚑ C-2, C-16, OD-9
- [ ] **ORD-05**: Staff can update order details and add/edit/remove items, payments, discount(s) and order expenses. Each change revalidates invariants (quantity > 0, unit price ≥ 0, description 1–200 chars, payment > 0 and not future-dated in business time, percent 0–100, discount ≤ items total, overpayment rule across all mutation types) and recomputes totals server-side ⚑ C-1, OD-4, C-38
- [ ] **ORD-06**: Staff can delete an order through a cascade confirmation that shows child counts and requires typing the order number. Deletion removes all children in one transaction and schedules its images for storage cleanup ⚑ OD-5, OD-6
- [ ] **ORD-07**: The order detail page shows the image gallery, tabbed Items/Payments/Discounts/Expenses tables with counts and add/edit/delete modals, the live OrderTotals panel and the customer card
- [ ] **ORD-08**: Concurrent edits to the same order, including child-only edits, return 409. The UI explains the conflict, preserves the user's input and offers reload
- [ ] **ORD-09**: Money displays as `₱12,450.00` (en-PH, U+2212 minus) and dates as `Oct 6, 2026`. Money inputs accept only valid 2-decimal amounts with the numeric keypad ⚑ OD-1
- [ ] **ORD-10**: The Orders grid ⇄ table view choice persists in `localStorage['csps-orders-view']`
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

### Background Jobs (JOB)

- [ ] **JOB-01**: Maintenance work (Cloudinary deletions, token/2FA purge, analytics aggregation and purge, inquiry retention) runs as short, leased, idempotent jobs behind a secret-protected maintenance endpoint, triggered on a schedule (host scheduler or GitHub Actions cron). Nothing relies on long-running in-memory state
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
- [ ] **DASH-03**: The dashboard shows an income vs expenses chart for the last 6 or 12 months. Income is payments by payment date; expenses are company + order expenses
- [ ] **DASH-04**: The dashboard shows orders by status, with the active total ⚑ C-40
- [ ] **DASH-05**: The dashboard shows the 6 most recent orders with links to detail
- [ ] **DASH-06**: Every dashboard card has loading (skeleton), empty and error states

### Public Site (PUB)

- [ ] **PUB-01**: Visitors can browse Home, Products, Gallery and Contact/Get a Quote, built to UI-SPEC §7, plus the legal pages (§13) and a 404 page
- [ ] **PUB-02**: Prices, product lines, address, contact numbers, hours, Messenger link and other business info on public pages load from the database, not hard-coded values ⚑ C-21
- [ ] **PUB-03**: A Manager can edit all public content and the price list (create/edit/reorder/activate/deactivate/delete), and changes appear publicly at once (cache invalidated)
- [ ] **PUB-04**: Public pages have unique titles/meta descriptions, Open Graph tags and `LocalBusiness` JSON-LD from site settings, present in the server-sent HTML (link-preview scrapers don't run JS). `robots.txt` and `sitemap.xml` are served, admin routes are `noindex`, and unknown paths return a real 404
- [ ] **PUB-05**: The Contact page shows "Open now / Closed now" computed from business hours and closure dates in Asia/Manila
- [ ] **PUB-06**: Visitors can reach the shop via Messenger (`m.me` link) and phone (`tel:`) CTAs, including the phone-only sticky bar on Contact

### Gallery (GAL)

- [ ] **GAL-01**: Visitors can browse a masonry gallery filtered by category pills with correct counts
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
- [ ] **INQ-05**: Staff can review inquiries in an admin inbox (unread badge, detail with attachments, status New → Contacted → Quoted → Converted / Closed / Spam, internal note) ⚑ C-36 (visibility)
- [ ] **INQ-06**: Staff can convert an inquiry into a new order with customer, team, contact and product type prefilled, and the two stay linked
- [ ] **INQ-07**: Unconverted inquiries and their attachments are purged after the configured retention period ⚑ OD-10
- [ ] **INQ-08**: The inquiry form shows a privacy notice at collection, linking to the Privacy Policy

### Consent & Analytics (ANL)

- [ ] **ANL-01**: On first visit, visitors see a cookie consent banner with Accept all, Reject all (equally prominent) and Customize. Nothing non-essential is set before a choice
- [ ] **ANL-02**: The browser Global Privacy Control signal is honored as "reject analytics"
- [ ] **ANL-03**: A persistent footer "Cookie settings" link reopens preferences at any time
- [ ] **ANL-04**: A "Clear my cookies & data" button expires non-essential cookies (server-side for HttpOnly ones), clears local/session storage and deletes server-side analytics tied to the visitor id
- [ ] **ANL-05**: With consent, analytics records visitor id (random UUID cookie, ≤ 12 months), sessions, page views, referrer host and device/browser/OS family. IPs are never stored in clear (truncated, then HMAC'd with a rotating salt). Core Web Vitals are collected only with consent
- [ ] **ANL-06**: Without consent, only anonymous aggregate counts (path + day) are recorded, with no cookies or identifiers
- [ ] **ANL-07**: Consent is re-requested when the cookie policy version changes or after 12 months, and every consent decision is logged as proof
- [ ] **ANL-08**: A Manager can view a metrics dashboard (unique visitors, sessions, page views, top pages, top referrers, device/browser split, trend chart, Core Web Vitals) for a chosen date range, and export it as CSV
- [ ] **ANL-09**: Raw analytics events are retained for 13 months, then aggregated and purged ⚑ OD-10

### Legal (LEGAL)

- [ ] **LEGAL-01**: Visitors can read a Privacy Policy covering the controller, purposes (orders, inquiries, analytics), retention, rights and contact, drafted for the owner's jurisdiction ⚑ OD-11
- [ ] **LEGAL-02**: Visitors can read a versioned Cookie Policy linked from the consent banner
- [ ] **LEGAL-03**: Visitors can read Terms of Use ⚑ OD-11
- [ ] **LEGAL-04**: Visitors can read an Accessibility Statement with a contact method for issues
- [ ] **LEGAL-05**: All legal pages are linked in the footer, versioned with "last updated" dates, and clearly marked DRAFT until the owner approves the text
- [ ] **LEGAL-06**: Documented Manager procedures exist for data subject requests (access, correction, deletion of a customer's data) and breach response, including the owner notification steps

### Accessibility (A11Y)

- [ ] **A11Y-01**: Every page passes axe with zero violations for `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` (vitest-axe per component, `@axe-core/playwright` per page)
- [ ] **A11Y-02**: All functionality is keyboard-operable with visible focus, a skip-to-content link, focus trapping and return in dialogs, landmarks with labels, and one `h1` per page
- [ ] **A11Y-03**: Accessible authentication: paste allowed in password and OTP fields, `autocomplete` attributes set, no cognitive puzzles
- [ ] **A11Y-04**: UI-spec items that conflict with WCAG 2.2 AA (contrast, target size, drag-only, hover-only, auto-dismissing danger toasts) are flagged to the owner and resolved before release ⚑ OD-14, C-35
- [ ] **A11Y-05**: Manual keyboard-only and screen-reader (NVDA + VoiceOver) passes are recorded for critical flows before release

### Performance & Responsive (PERF)

- [ ] **PERF-01**: Bundle budgets are enforced in CI from the first build: public route initial JS ≤ 150 KB gz, admin ≤ 250 KB gz, total CSS ≤ 35 KB gz
- [ ] **PERF-02**: Public pages score ≥ 95 in every Lighthouse category on the mobile profile, with LCP < 2.0 s, CLS < 0.05 and INP < 200 ms (Lighthouse CI)
- [ ] **PERF-03**: Every screen works from 320 px to 1920 px in portrait and landscape (verified at 320/375/414/768/1024/1280/1536/1920) with no horizontal scrolling, touch targets ≥ 44 px, ≥ 16 px inputs and correct `inputmode`/`type`
- [ ] **PERF-04**: List endpoints meet API p95 < 300 ms on the target host with `AsNoTracking` projections, indexes on every filter/sort column, compiled queries on hot paths, and query-count tests guarding against N+1
- [ ] **PERF-05**: Fonts are self-hosted woff2, subset, `font-display: swap`, with the primary font preloaded and metric-matched fallbacks. The ₱ glyph renders in the brand font
- [ ] **PERF-06**: Staff can install the admin portal as a PWA (manifest + icons). The service worker caches only static assets and the app shell, never API or authenticated responses, and shows a "new version available — reload" prompt
- [ ] **PERF-07**: Route transitions use the View Transitions API as a progressive enhancement, and all motion is disabled under `prefers-reduced-motion`

### Legacy Migration (MIG)

- [ ] **MIG-01**: The legacy `.bak` is restored read-only into a local, `CSPS_`-prefixed disposable database, and `.planning/LEGACY-SCHEMA.md` documents every table, column, type, key, relationship, row count, value shape (no real customer data), data-quality issues, image storage and user accounts ⚑ C-28
- [ ] **MIG-02**: `.planning/LEGACY-MAPPING.md` maps every legacy field to the new model (or "not migrated — reason"), proposing any new columns/tables. The owner approves it before any ETL code is written
- [ ] **MIG-03**: Approved legacy-only columns (`LegacyId`, legacy order number) are added as nullable via normal migrations
- [ ] **MIG-04**: The `tools/Csps.LegacyMigration` ETL is test-driven, idempotent and re-runnable, with `--dry-run`, batched transactions and clear logs. It writes through the domain into a fresh EF-migrated database, preserving legacy keys and order numbers, and seeds the per-year order counters from them
- [ ] **MIG-05**: Legacy images (if any) are uploaded to Cloudinary with a resumable mapping record
- [ ] **MIG-06**: Legacy user accounts (if any) become profiles. Passwords are not carried over unless verifiably compatible, and users get a "set your password" email at go-live
- [ ] **MIG-07**: An automated reconciliation report compares legacy source vs new: row counts per entity; Σ items, payments, discounts, order expenses and company expenses; per-order Total/Paid/Balance. Every transformed or rejected row is listed with a reason. Cutover is blocked unless it is 100% with zero unexplained differences
- [ ] **MIG-08**: A timed dress rehearsal on the staging site with a fresh `.bak` succeeds end to end

### Cutover (CUT)

- [ ] **CUT-01**: Production hosting is ready: production SQL login with least privilege, scheduled DB backups enabled, a restore procedure tested once, TLS certificate and HSTS active after verification, and SPF/DKIM/DMARC configured on the sender domain
- [ ] **CUT-02**: A production cutover runbook exists and is executed with the owner present: maintenance notice, legacy read-only, fresh legacy backup kept as rollback, ETL + 100% reconciliation, deploy + smoke test, owner verifies sample orders and totals, domain switch, a documented point of no return and a rollback plan
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
| Financial reporting beyond order summary, expense totals, dashboard KPIs, visitor metrics | PRD §23 |
| Meta Pixel / Messenger chat plugin | Privacy and performance cost. The plugin was retired in 2024; use `m.me` links |
| reCAPTCHA / cognitive puzzles | Accessibility (WCAG 3.3.8) and privacy. Use honeypot + time-trap + rate limits instead |
| Embedded Google Maps iframe | CSP, privacy and performance. The UI spec's stylized SVG map + "Directions" link is used |
| Instant online price calculator | Pricing is quote-based via mockup |
| Drag-only Kanban board / real-time sync | Not needed at ~5 staff. Drag-only violates WCAG 2.5.7 |
| Touching the live legacy DB/site before approved cutover | Prime Directive 1 |
| Deriving the schema from the legacy `.bak` | Prime Directive 11. Legacy data is reshaped to fit the new schema |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Pending |
| FND-02 | Phase 1 | Pending |
| FND-03 | Phase 1 | Complete |
| FND-04 | Phase 1 | Complete |
| FND-05 | Phase 1 | Complete |
| FND-06 | Phase 1 | Complete |
| FND-07 | Phase 1 | Complete |
| FND-08 | Phase 1 | Complete |
| FND-09 | Phase 1 | Complete |
| FND-10 | Phase 1 | Pending |
| FND-11 | Phase 1 | Complete |
| FND-12 | Phase 1 | Pending |
| FND-13 | Phase 1 | Pending |
| WEB-01 | Phase 2 | Pending |
| WEB-02 | Phase 2 | Pending |
| WEB-03 | Phase 2 | Pending |
| WEB-04 | Phase 2 | Pending |
| WEB-05 | Phase 2 | Pending |
| WEB-06 | Phase 2 | Pending |
| WEB-07 | Phase 2 | Pending |
| WEB-08 | Phase 2 | Pending |
| QUAL-01 | Phase 1 | Complete |
| QUAL-02 | Phase 2 | Pending |
| QUAL-03 | Phase 1 | Pending |
| QUAL-04 | Phase 2 | Pending |
| QUAL-05 | Phase 4 | Pending |
| QUAL-06 | Phase 1 | Pending |
| OPS-01 | Phase 3 | Pending |
| OPS-02 | Phase 3 | Pending |
| OPS-03 | Phase 3 | Pending |
| OPS-04 | Phase 3 | Pending |
| OPS-05 | Phase 3 | Pending |
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 4 | Pending |
| SEC-04 | Phase 1 | Pending |
| SEC-05 | Phase 14 | Pending |
| AUTH-01 | Phase 4 | Pending |
| AUTH-02 | Phase 4 | Pending |
| AUTH-03 | Phase 4 | Pending |
| AUTH-04 | Phase 4 | Pending |
| AUTH-05 | Phase 4 | Pending |
| AUTH-06 | Phase 4 | Pending |
| AUTH-07 | Phase 4 | Pending |
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
| ORD-01 | Phase 8 | Pending |
| ORD-02 | Phase 8 | Pending |
| ORD-03 | Phase 7 | Pending |
| ORD-04 | Phase 9 | Pending |
| ORD-05 | Phase 7 | Pending |
| ORD-06 | Phase 8 | Pending |
| ORD-07 | Phase 8 | Pending |
| ORD-08 | Phase 7 | Pending |
| ORD-09 | Phase 2 | Pending |
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
| A11Y-01 | Phase 2 | Pending |
| A11Y-02 | Phase 2 | Pending |
| A11Y-03 | Phase 4 | Pending |
| A11Y-04 | Phase 2 | Pending |
| A11Y-05 | Phase 14 | Pending |
| PERF-01 | Phase 2 | Pending |
| PERF-02 | Phase 2 | Pending |
| PERF-03 | Phase 2 | Pending |
| PERF-04 | Phase 6 | Pending |
| PERF-05 | Phase 2 | Pending |
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
| CUT-01 | Phase 17 | Pending |
| CUT-02 | Phase 17 | Pending |
| CUT-03 | Phase 17 | Pending |

**Coverage:**
- v1 requirements: 162 total
- Mapped to phases: 162
- Unmapped: 0 ✓

Cross-cutting QUAL/SEC/A11Y/PERF requirements are mapped to the phase where their gate is first built. Every later phase enforces them through the PRD §22 Definition of Done (see ROADMAP.md "Roadmap Conventions").

---
*Requirements defined: 2026-10-06*
*Last updated: 2026-10-07 after roadmap creation (traceability filled, 162/162 mapped)*

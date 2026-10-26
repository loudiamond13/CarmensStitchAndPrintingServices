# CSPS — Carmen's Stitch & Printing Services

*Created: 2026-10-06T23:20:28-05:00 · Updated: 2026-10-26T07:02:00-05:00*

## What This Is

CSPS replaces the current production system of Carmen's Stitch & Printing Services, a Philippine shop that makes custom full-sublimation jerseys and does tailoring. It has two faces:

- **Public site:** home, products, gallery and contact/quote pages, plus legal pages and cookie consent. Visitors are mostly teams, leagues and riding clubs arriving on a phone from Facebook.
- **Admin portal:** staff with the roles `Admin` and `Manager` run orders (items, payments, discounts, order expenses, images), company expenses, users, site content, visitor metrics and their own profiles.

All existing production data is migrated in without loss. The API is client-agnostic, so a future Android app can use the same backend.

## Core Value

**Staff can record every order (items, payments, discounts, expenses, images) and always see correct, server-computed totals and balances. Existing production data is carried over with zero loss.** If everything else slips, the order math, the security of staff accounts, and the integrity of migrated data must still hold.

## Business Context

- **Customer**: The shop's staff (Admin and Manager roles) use the admin portal. The public site serves anonymous visitors: Filipino sports teams, barangay leagues, riding clubs, schools and offices.
- **Revenue model**: The shop sells custom jerseys, apparel and tailoring. The site generates inquiries ("Get a Quote", Messenger, phone). The admin portal tracks orders, downpayments, balances and costs. The app itself is not monetized.
- **Success metric**: (1) Every legacy order and expense is migrated with 100% reconciliation at cutover. (2) Staff run every new order through CSPS with correct balances. (3) Public pages meet Lighthouse ≥ 95 on mobile.
- **Strategy notes**: `CSPS-PRD.md` is the engineering contract. `CSPS-UI-SPEC.md` (v1.1, Oct 6, 2026) is the approved visual design and the design source of truth.

## Canonical Source Documents (read these; PROJECT.md summarizes them)

| Document | Role | Notes |
|---|---|---|
| `CSPS-PRD.md` | Product requirements & engineering contract | MUST/MUST NOT are non-negotiable; §0 Prime Directives override everything; §21 lists `[OWNER DECISION]` items that MUST be asked, never assumed. |
| `CSPS-UI-SPEC.md` | Strict UI implementation spec | Prose is lines 1–1578. Appendices A–E (lines 1579+) hold verbatim CSS, TS components (`src/ui/index.tsx`), order math (`src/lib/csps.ts` + tests), and reference markup for every screen. Precedence: Appendix › tables › prose. Gaps are marked `// SPEC-GAP:`. |
| `.planning/design/` (local-only, git-ignored) | Visual UI reference: the owner's Claude Design exports `CSPS Website Public Face.html` and `CSPS Website Admin and Manager.html`, from which `CSPS-UI-SPEC.md` was derived | Never commit, upload or deploy (owner, 2026-10-07). The UI researcher, planner, executors and UI auditor open it next to `CSPS-UI-SPEC.md` for look and feel and to resolve `// SPEC-GAP:` items. `CSPS-UI-SPEC.md` stays the source of truth (Appendix › tables › prose); where the two disagree the spec wins unless the owner rules otherwise. Missing on fresh clones and in CI: ask the owner, never recreate it. The files are large (4.2 MB and 1.5 MB), so search them rather than reading them whole. |
| `CLAUDE.md` (repo root) | Shared-machine rules | Ports, DB prefixes, preflight script, no machine-level env vars. Binding on every session. |

## Requirements

### Validated

- ✓ **Foundation:** onion solution, zero-warning builds, architecture tests, EF Core code-first schema with a guarded dev seed, ProblemDetails, `/health`, Serilog JSON logs, business calendar, SiteSettings core, append-only AuditLog, SQL test fixture, idempotent migration scripts, hosting record, coverage and license gates, security headers, default-deny authorization, Data Protection key ring (FND-01..13, QUAL-01/03/06, SEC-01/02/04) — Phase 1 (2026-10-07: UAT 11/11, 526 tests, threats_open 0)

- ✓ **Web foundation:** React 19 + TS strict + Vite + Tailwind v4 shell built into `Csps.Server/wwwroot`, the UI-spec design system converted to Tailwind and proven visually equal to the approved design (parity in 3 engines), `httpClient.ts` and `api.ts`, shared primitives, URL state, order-math preview with 220 shared golden vectors, lint/axe/budget/Lighthouse/E2E gates (WEB-01..10, ORD-09, QUAL-02/04, A11Y-01/02/04, PERF-01/02/03/05) — Phase 2 (2026-10-14: UAT 202/202, 3110 web + 908 .NET tests, threats_open 0, Nyquist-compliant, UI review 18/24)

- ✓ **CI/CD and live deploy:** ordered PR gate with modes and the merge script, GitHub ruleset on `main`, Dependabot with 14-day cooldown, gitleaks, CodeQL, dependency review, actionlint and zizmor, SHA-pinned least-privilege workflows, owner-dispatched Web Deploy to SmarterASP.NET with smoke test and automatic rollback, legacy site retired after a verified `.bak` receipt, branded holding page live on the new empty DB (OPS-01..05) — Phase 3 (2026-10-17: UAT 78 passed and 2 deferred (Weekly re-run after ship, LCP report-only until Phase 11), threats_open 0)

- ✓ **Authentication:** email + password, mandatory 6-digit email code, remember me, rotating refresh tokens with reuse detection, lockout, auth rate limits, forgot/reset password, sign out everywhere, password policy with breach check, bootstrap Manager CLI, auth emails over TLS SMTP through an outbox, idempotent POSTs, auth audit events (AUTH-01..13, QUAL-05, A11Y-03; Phase 4 share of SEC-03, SEC-06, AUDIT-01) — Phase 4 (2026-10-17: UAT 3/3 including the live cookie check, verification 6/6, threats_open 0)

- ✓ **Profile and user management:** own name, email change with confirmation, password change, admin theme; Manager-only users list with URL filters, invite or temporary password, edit, role, lock, deactivate, delete with last-Manager guard, session revoke on role or status change, resend invite or reset link; audit log viewer; optimistic concurrency and server-set record attribution for users (PROF-01..04, USER-01..08, AUDIT-02; Phase 5 share of SEC-07, SEC-08) — Phase 5 (2026-10-19: 52 plans, UAT 4/4 on a real phone and inbox, verification 12/12, threats_open 0; owner rulings D-50 to D-55)

- ✓ **Company expenses:** add, edit, soft delete with Manager restore and permanent delete; filters, search, period totals and Manila-time month KPIs; Manager-editable categories on a Settings page; required "Paid by" with audited payer changes; rowversion 409s; fixed query counts and a 300 ms p95 list gate (CEXP-01..05, PERF-04) — Phase 6 (2026-10-26: 21 plans plus quick 261026-89i, UAT 6/6 with the live speed check deferred to backlog 999.4, verification 6/6, threats_open 0, UI review 20/24 with all five warnings fixed; owner rulings D-54 to D-62)

### Active

Every PRD requirement is in scope for this milestone. The IDs follow `CSPS-PRD.md` §6, and REQUIREMENTS.md expands them.

- [ ] **Orders:** aggregate with items, payments, discount(s), order expenses; create, edit, delete; preview list with totals; search, filter, sort; concurrency (ORD-01..09)
- [ ] **Order images:** Cloudinary signed server-side upload, a per-order limit, cover image, reorder, alt text, lazy responsive delivery, cleanup job (ORD-04, PRD §10)
- [ ] **Admin dashboard:** KPIs, income vs expenses chart, orders by status, recent orders (UI-SPEC §8.3)
- [ ] **Staff money (owner addition, 2026-10-07):** every payment names the staff member who received it ("Received by", the owner's "PaidTo"), and every company and order expense names the staff member who paid it ("Paid by"); each staff member has a server-computed money on hand (payments received + transfers in − transfers out − expenses paid); staff can transfer money to coworkers. An Admin sees only their own money and a Manager sees everyone's; only a Manager can delete a transfer, and every delete is audited (ORD-22, ORD-23, CEXP-05, MONEY-01..08, MIG-09, MIG-10; open rulings OD-15..OD-18, OD-20, OD-21). `CSPS-PRD.md` and `CSPS-UI-SPEC.md` don't cover it yet and need a later update
- [ ] **Record attribution (owner addition, 2026-10-07):** every record staff create or edit stores and shows who entered it and who last changed it, with UTC times, set by the server and never by the client ("Recorded by" / "Last changed by", SEC-08; MIG-10 for migrated records). `CSPS-PRD.md` and `CSPS-UI-SPEC.md` need a later update
- [ ] **Public site:** Home, Products, Gallery and Contact/Get a Quote per the UI spec, with database-managed content, prices and business info, SEO and JSON-LD (PUB-01..04, UI-SPEC §7)
- [ ] **Site content management (Manager only):** site settings, price list, public content (PUB-03)
- [ ] **Consent & analytics:** cookie banner (accept, reject, customize), GPC, clear-my-data, consented analytics, cookieless aggregates, Manager metrics dashboard, retention (ANL-01..09)
- [ ] **Legal pages:** Privacy, Cookie, Terms and Accessibility Statement, versioned and marked DRAFT until the owner approves (PRD §13)
- [ ] **Hardening:** MITRE CWE/ATT&CK review, ZAP, manual a11y audit, performance budgets, backup/restore test, runbooks (PRD §11, §12, §7.1, §19)
- [ ] **Legacy migration:** read-only discovery of the `.bak` → mapping that the owner approves → test-driven ETL → 100% reconciliation → local dress rehearsal (PRD §16)
- [ ] **Legacy data cutover:** a runbook that imports the legacy data into the live CSPS database, executed with the owner present, plus post-go-live monitoring (PRD §19.4). CSPS itself replaces the legacy site in Phase 3

### Out of Scope

- Customer self-service accounts: staff-only portal for this milestone (PRD §23)
- Online payments: payments are recorded manually (Cash, GCash, Maya, bank transfer); no payment gateway (PRD §23)
- SMS or authenticator-app 2FA: email code only for now. `ISecondFactorDelivery` keeps the abstraction ready (PRD §8.2, §23)
- The Android app itself: the API stays client-agnostic so it can be added later (PRD §15, §23)
- Multi-language UI: English copy per UI spec (PRD §23)
- Marketing emails: transactional email only, no marketing without separate consent (PRD §13, §23)
- Inventory: not part of the shop's workflow in this release (PRD §23)
- Financial reporting beyond the order summary, company-expense totals, dashboard KPIs and visitor metrics (PRD §23)
- Modifying legacy data anywhere: Prime Directive 1 as amended (2026-10-15). The legacy site and database are retired in Phase 3 after a verified `.bak` is kept, and legacy data reaches CSPS only through the Phase 16/17 import
- Designing the schema from the legacy `.bak`: Prime Directive 11. The app owns its schema, and legacy data is reshaped to fit it

## Context

**Existing code (brownfield scaffold only).** The folder holds a fresh Visual Studio "React and ASP.NET Core" template:

- `CarmensStitchAndPrintingServices.slnx`
- `CarmensStitchAndPrintingServices.Server/`: .NET 10 Web API with the `WeatherForecast` sample, `Microsoft.AspNetCore.SpaProxy` and `Microsoft.AspNetCore.OpenApi` 10.0.12
- `carmensstitchandprintingservices.client/`: JavaScript React 19.2 + Vite 8.3, no TypeScript or Tailwind yet

None of it is product code. Phase 1 replaces it with the PRD §3.1 layout (`Csps.slnx`, `src/Csps.{Domain,Application,Infrastructure,Server}`, `web/`, `tests/`, `tools/`). Phase 1 keeps the port assignments the scaffold already uses: Vite 5180 (`strictPort`), API 5115 http / 7028 https.

**Legacy system.** A live production site and database exist today on SmarterASP.NET (legacy DB name pattern `csptailoringdb`). A production backup from 2026-10-06 sits in `_local/` (gitignored). The legacy schema is unknown and intentionally unexamined until the legacy-discovery phase. It is retired in Phase 3 (owner, 2026-10-15): after a fresh `.bak` and the site files are kept and the restore receipt is confirmed, the legacy database is deleted and CSPS takes over the live site.

**Version control.** Local git repo initialized 2026-10-06 on branch `main`, with a repo-local author identity. The owner created the private GitHub repo, and pull requests target `main`. It stays private on GitHub Free (03-CONTEXT D-07), which can't enforce branch rules there, so merges go through the process merge gate (D-08).

**Machine & tooling (verified 2026-10-06).** Windows 11 Pro. .NET SDK 10.0.401, Node 24.21, Docker 29.8.1, SQL Server LocalDB (`MSSQLLocalDB`), git 2.56. The machine is shared with another project, TheBETSLLC (see Constraints).

**Domain facts from the UI spec (seed data and copy rely on them):**

- Currency: Philippine peso, shown as `₱12,450.00` with en-PH grouping and a true minus sign U+2212 for negatives.
- Time zone: Asia/Manila for "today", greetings, open-now and month boundaries.
- Order statuses: Pending, Mockup, In Production, Ready, Completed, Cancelled. "Active" means Pending through Ready.
- Product types (6): Basketball Jersey, Volleyball Jersey, Moto Riding Jersey, Long Sleeves, Polo Shirt, Custom Design.
- Payment methods: Cash, GCash, Maya, Bank Transfer.
- Company expense categories: Rent, Utilities, Salaries, Supplies, Equipment, Maintenance, Others.
- Order expense categories: Fabric, Ink & paper, Outsourcing, Labor, Delivery, Others.
- Order number format `ORD-{YYYY}-{NNNN}`, sequential per year.
- Order customer fields: customer name\*, team/organization, contact number\* (PH mobile), email, address.
- The order-detail math fixture **ORD-2026-0148** (Total ₱22,450.00 · Discount −₱1,122.50 · Paid −₱12,000.00 · Balance ₱9,327.50 · Expenses ₱6,065.00 · Estimated profit ₱15,262.50) and **ORD-2026-0151** ("Fully Paid") are acceptance tests.
- Seed users: Carmen Reyes (Manager), Paolo Garcia, Liza Mercado, Rhea Villanueva (Manager) and Jomar Santos (Admin, inactive). Seed orders and expenses are in UI-SPEC §12.

**Design system.** Fonts are Barlow Condensed (display) and Archivo Variable (UI), self-hosted via @fontsource. Themes: Blush (light, default) and Espresso (dark, admin-only toggle). Responsive rules use container queries on `.s-page` (`@container pg`). Tailwind's default palette, radii and shadows are removed from the theme. No component library may be added.

## Constraints

- **Tech stack (pinned, PRD §2)**:
  - Backend: .NET 10 LTS / C# 14 controller-based APIs (`[ApiController]` + attribute routes) under `/api/v1`, EF Core 10 code-first with Fluent configuration only, SQL Server 2025, ASP.NET Core Identity (`IdentityUser<Guid>`), FluentValidation, MailKit SMTP via SmarterASP.NET, Cloudinary, Serilog.
  - Frontend: React 19 + TypeScript strict + Vite, Tailwind v4, React Router, TanStack Query, react-hook-form + zod.
  - Tests: xUnit v3, NSubstitute, Shouldly, Testcontainers, Respawn, NetArchTest, Vitest + RTL + vitest-axe + MSW, Playwright + axe.
- **Forbidden libraries**: axios (and wrappers), MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit conflicting with the UI spec, and any GPL/AGPL/SSPL/commercial license. Only MIT, Apache-2.0, BSD and ISC are allowed. Every new dependency needs its purpose, license, maintenance status and a legitimacy check recorded in the phase RESEARCH.md.
- **Architecture (PRD §3)**: Onion. Domain ← Application ← Infrastructure ← Server, with dependencies pointing inward only, enforced by NetArchTest. No mediator: one handler per use case and manual mapping. `Result<T>` errors map to RFC 9457 ProblemDetails. Each aggregate gets a `rowversion` (409 on conflict). Store times as UTC and use `IClock`/`TimeProvider`, never `DateTime.Now`. Money is `decimal(18,2)` and computed server-side only.
- **Schema ownership (Prime Directive 11, PRD §5.6)**: Every table and column comes from EF migrations. The app must build, test, run and deploy against an empty DB with no `.bak` present. Drops, renames and lossy type changes are one-way doors: stop and ask the owner. Production gets reviewed idempotent scripts after a backup, never auto-migrate on startup.
- **Quality gates (PRD §14, §17)**:
  - TDD for every behavior (red → green → refactor); `workflow.tdd_mode` is on.
  - Zero warnings in build, analyzers, lint, types, tests and the browser console.
  - Coverage: 100% Domain, ≥ 95% Application, 100% `core/api`, ≥ 90% web overall.
  - Authorization matrix tests cover every endpoint × {anonymous, Admin, Manager}.
- **Security (PRD §11)**: MITRE CWE Top 25 / ATT&CK / CAPEC drive each phase's security review. Every phase lists the CWE IDs it touches and the tests that prove each mitigation. Strict CSP (no `unsafe-inline` or `unsafe-eval`), default-deny policies, append-only audit log, no secrets or data in git.
- **Accessibility (PRD §12)**: WCAG 2.2 AA. axe must report zero violations at the component level (vitest-axe) and page level (Playwright). Keyboard and screen-reader passes are recorded for critical flows.
- **Performance (PRD §7.1, enforced in CI)**:
  - Public initial JS ≤ 150 KB gz, admin ≤ 250 KB gz, total CSS ≤ 35 KB gz.
  - Lighthouse ≥ 95 in all categories on mobile.
  - LCP < 2.0 s, CLS < 0.05, INP < 200 ms; API p95 < 300 ms for list endpoints.
- **Responsive**: Mobile-first, 320 px to 1920 px, portrait and landscape, touch targets ≥ 44 px, no horizontal scroll. Visual QA uses the UI spec's 1440 / 820 / 390 px plus the PRD breakpoints.
- **Hosting (PRD §19)**: SmarterASP.NET (Windows/IIS), Web Deploy from GitHub Actions, in-process hosting. Shared-hosting limits apply: app pools recycle, Data Protection keys live in the DB, and jobs must be short and idempotent.
- **Data safety (Prime Directives 1, 2)**: Prime Directive 1 as amended by the owner (2026-10-15, 03-CONTEXT D-01): the legacy site and database are retired in Phase 3, and only after a fresh `.bak` and the legacy site files are kept off the host and a local restore receipt is confirmed (D-04, D-05). Legacy data is never modified: it stays as it is in the `.bak` until the Phase 16/17 import. The `.bak` lives only in `_local/`, is never committed, uploaded or deployed, and is only restored into a local disposable `CSPS_` database.
- **Shared machine (CLAUDE.md, binding)**:
  - Ports: Vite 5180, API 5115 / 7028, Playwright host 5199 (`reuseExistingServer: false`).
  - Never use 5173, 5023 or 5099. Avoid 49152–65535.
  - LocalDB is the default `(localdb)\MSSQLLocalDB` (owner, 2026-10-14), shared with TheBETSLLC. CSPS databases use the `CSPS_` prefix. Never touch `BetsLLC_*`.
  - Run `C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` before any dev server, Playwright run or full test run. Never kill another project's processes.
  - Never set `ASPNETCORE_*` / `DEV_SERVER_PORT` env vars at User or Machine level.
  - One session per folder.
- **Workflow (PRD "How to use")**: Plan every phase with `/gsd-plan-phase N --tdd`. Run `/gsd-ui-phase N` for frontend phases, with `CSPS-UI-SPEC.md` as the source of truth. Run `/gsd-secure-phase N` and `/gsd-ui-review N` before `/gsd-ship N`.

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| SQL Server 2025 is the production target; compatibility level stays pinned at 160 until the 2025 database exists (D-33) | SmarterASP.NET offers 2025 only as a new database plus `.bak` restore, not an in-place upgrade; the Basic plan has 1 database. The move happens in Phase 3 (03-CONTEXT D-03): after the backup proof the legacy database is deleted, a new SQL Server 2025 database is created, and the pin moves to its verified level | — Pending |
| Two free Microsoft runtime parts of the SQL Server driver ship under an exact-version license exception (`docs/license-exceptions.json`) | They are free but not open source; Microsoft.Data.SqlClient needs them on Windows. Any other version needs a new owner approval | ✓ Good (Phase 1) |
| The dev seed runs only on `(localdb)\MSSQLLocalDB` or a loopback test container, and only against `CSPS_Dev` or `CSPS_E2E` (code review WR-04; instance changed by the owner, 2026-10-14, quick 261014-ctx) | Keeps sample data and `--reset` away from the live host and TheBETSLLC's databases. The database name is now the guard, because TheBETSLLC shares the instance | ✓ Good (quick 261007-p98, 261014-ctx) |
| Owner conventions 2026-10-14 (OR-1..OR-6): default `MSSQLLocalDB` with separate `CSPS_*` databases; minimal comments; client-side (zod) validation of every backend rule before any request; no long dash in the client; API calls per module in `modules/*/services` with the shared client in `core/api`; the owner's `web/src` layout | Standing rules set before Phase 4. Recorded in `.claude/CLAUDE.md` Conventions, the PRD (§9) and REQUIREMENTS (WEB-02/03/04/09, QUAL-03) | ✓ Adopted (quick 261014-ctx) |
| API style is controller-based (`[ApiController]`, attribute routes under `/api/v1`), not Minimal APIs (owner, 2026-10-07) | Owner preference. Conventions: thin actions → one handler; default-deny fallback policy with explicit `[Authorize(Policy)]`/`[AllowAnonymous]`; automatic model-state 400s suppressed, FluentValidation in handlers → `Result<T>` → ProblemDetails. The one existing Minimal API endpoint (`GET /api/v1/site-settings`) converts when a later phase touches it | — Pending |
| Follow the PRD's 12-phase vertical-slice roadmap as the baseline (Fine granularity) | The PRD §20 phases are already dependency-ordered vertical slices. Phases 1–9 run on an empty DB, and only 10–12 touch legacy data | — Pending |
| Replace the VS template scaffold with the PRD §3.1 layout and keep its port config | The template layout (`*.Server` + `*.client` + SpaProxy) doesn't match the onion layout or the build-into-`wwwroot` model | — Pending |
| `CSPS-UI-SPEC.md` governs visuals, copy and component markup. The PRD governs behavior, security, a11y and data rules | PRD Prime Directive 5. Where they conflict on security or a11y, stop and ask the owner | — Pending |
| Server is authoritative for all money math. The client uses the UI-spec `orderTotals()` only for live previews | PRD §3.3 and UI-SPEC §9.2 both require it, and both must produce identical figures | — Pending |
| Legacy `.bak` is opened only in the legacy-discovery phase; one owner-approved exception in Phase 3 reads table names and row counts only, as the backup proof (03-CONTEXT D-04) | Prime Directive 11 and PRD §16 | — Pending |
| TDD mode on for every phase | PRD Prime Directive 3 and §14 | ✓ Good |
| **OD-19 resolved** and owner answers (2026-10-07): only the Manager role deletes money transfers (Admin 403); an Admin sees only their own money on hand and transfers, a Manager sees everyone's; every state-changing form post is idempotent (SEC-06, WEB-09); concurrency guarantees are explicit (SEC-07) | The owner answered in chat. The rulings match PRD §4, where the Manager is the senior role. Duplicate posts and lost updates would break the Core Value of correct, server-computed money | ✓ Owner decided (2026-10-07) |
| Owner answers on expenses and record attribution (2026-10-07): (1) an expense's "Paid by" reduces that staff member's money on hand, so the balance is payments received + transfers in − transfers out − expenses paid, computed server-side (MONEY-01); (2) every record staff create or edit stores and shows `CreatedBy`, `CreatedAt`, `UpdatedBy` and `UpdatedAt`, set by the server from the signed-in user and the clock and never from the client, with "Legacy import" for migrated records whose creator is unknown (SEC-08, MIG-10); (3) company and order expenses both have a required, server-validated "Paid by" naming an active Admin or Manager, and a payer change is audited (CEXP-05, ORD-23) | The owner asked that a payment show who received it and who entered it, and that expenses record who paid them, then answered three follow-up questions in chat. Received by (ORD-22) and Recorded by (SEC-08) are separate fields. Attribution that the client can't forge, plus audited payer changes, keeps staff balances explainable (Core Value) | ✓ Owner decided (2026-10-07) |
| URL query-string state with nuqs (owner, 2026-10-07): (1) list and page view state (filters, search, sort, page, page size, tab, view mode) lives in the URL query string through nuqs 2.10.1 (MIT, free), approved after a check for security advisories, deprecation and the 14-day cool-down; switching to any newer version, such as a stable 2.10.2, needs the owner's approval at the Phase 2 install; (2) free-text search goes in the URL too, chosen over the privacy-conservative default of keeping it out, with mitigations: no query string in analytics, Core Web Vitals, client error reports or server logs, the strict Referrer-Policy, a 100-character server cap and no tokens or secrets in URLs; (3) the public gallery keeps its category filter in the URL as well, about 5.6 KB gz within the 150 KB public budget (WEB-10, ORD-10, GAL-01, ANL-05, SEC-03) | The owner asked for query-string URLs using nuqs. URL state lets Back, refresh, bookmarks and shared links reopen the same list view. Usage rules in WEB-10 avoid three known nuqs bugs (#1567, #1563, #1245), and ORD-10's saved view becomes the fallback when the URL has no valid view | ✓ Owner decided (2026-10-07) |
| **Prime Directive 1 override** (owner, 2026-10-15): CSPS deploys to the live site and replaces the legacy app in Phase 3; the legacy site and database are retired then, not at the end of the project. There is no staging site (Basic plan, Phase 1 D-11) | The owner chose to surrender the legacy site now, accepting that staff have no order screens until the order phases ship. Legacy data is kept unchanged in a verified `.bak` (receipt confirmed before the delete) and imported in Phases 16 and 17. Until the owner accepts CSPS live, the legacy rollback kit (site files plus the `.bak`) can put the legacy site back | ✓ Owner decided (2026-10-15) |
| Phase 6 owner rulings at UAT (2026-10-26, 06 D-54 to D-62): all UI-SPEC defaults confirmed; wording approved; expense notes readable by all staff; the live p95 check after release is a backlog follow-up, not a gate; every count uses the en-PH thousands format app-wide; required selects show the " *" mark; native date boxes show the friendly date beside them | Owner review of the review pack, UAT and the UI audit. Keeps the shipped screens consistent with the en-PH format rules and the spec | ✓ Owner decided (2026-10-26) |

## Open Owner Decisions (PRD §21: MUST be asked at the relevant phase's discuss step, never assumed)

The UI spec already answers some of these. The owner still has to confirm each one.

| # | Decision | What the UI spec implies | Needed by |
|---|---|---|---|
| OD-1 | Currency & locale | PHP `₱`, en-PH | Phase 1 (formatters) |
| OD-2 | Business time zone | Asia/Manila | Phase 1 |
| OD-3 | Order statuses & allowed transitions | Pending → Mockup → In Production → Ready → Completed, plus Cancelled. Transitions aren't defined | Orders phase |
| OD-4 | Overpayments allowed? | **Ruled by the owner, 2026-10-13: no.** The system never accepts an overpayment: the server refuses a payment above the remaining balance with a plain-English error, and the payment form warns while the amount is typed that it exceeds the balance. Default reading (confirm at the Orders discuss step, C-38): the same rule blocks any other change (removing an item, lowering a quantity, adding or raising a discount) that would leave the balance below zero. Open: how legacy orders that are already overpaid are imported and shown | Orders phase |
| OD-5 | Delete semantics (hard vs soft) for orders and company expenses | The UI spec says "permanently deleted… can't be undone" with type-to-confirm. The PRD recommends soft delete with a Manager purge. **Company expenses ruled (owner, 2026-10-25; 06 D-01 to D-07):** soft delete, Managers only; Managers restore from a Manager-only Deleted view and may also delete permanently from the list or that view; both use a plain Yes/Cancel confirm; a permanent delete's audit entry keeps date, category, amount and payer. Orders are still open | Orders phase (orders) |
| OD-8 | Expense categories: fixed or Manager-editable | Fixed lists in the UI spec. **Company expenses ruled (owner, 2026-10-25; 06 D-08 to D-15, also closes C-43):** a Manager-editable list on a Manager-only Settings page; it starts with Rent, Utilities, Salaries, Supplies, Equipment, Maintenance, Government contributions (SSS, PhilHealth, Pag-IBIG), Taxes and permits, Transport and fuel, Others; used categories are retired, never deleted. The order expense list is still open | Phase 7 (order expenses) |
| OD-6 | Can Admins delete orders? | Yes (PRD and UI spec agree) | Orders phase |
| OD-7 | Reusable `Customer` entity vs customer fields on each order | The UI spec puts the fields on the order. The PRD recommends a reusable entity. Decide before the Orders phase | Orders phase |
| OD-9 | Order image delivery: public or authenticated Cloudinary | PRD recommends authenticated | Order images phase |
| OD-10 | Retention: orders and financial records, analytics (13 mo), audit log (2 yr) | — | Consent/analytics + hardening |
| OD-11 | Legal jurisdiction and reviewer | The Philippines is likely, under the Data Privacy Act of 2012 (RA 10173) | Legal pages phase |
| OD-12 | System sender email/domain; SPF/DKIM/DMARC feasibility | Footer placeholder `[hello@yourdomain.ph]` | Auth phase (email) |
| OD-13 | OpenAPI in production: Managers only, or disabled | — | Foundation / hardening |
| OD-14 | UI-spec items that conflict with WCAG | See C-16 below | Every UI phase |
| OD-15 | Legacy payments' "Received by" and legacy expenses' "Paid by": a designated "Legacy / unassigned" holder that can't sign in, or an owner-chosen staff user. Also: do migrated payments and expenses count toward money on hand; does a legacy record that names its creator keep that creator as a migrated user (MIG-06); and do staff start with opening balances at go-live? | Neither document covers it (owner additions, 2026-10-07). Legacy payments and expenses probably name no receiver or payer, and ORD-22, CEXP-05 and ORD-23 make those fields required. Ruled 2026-10-07: a migrated record with an unknown creator is attributed to "Legacy import" (SEC-08, MIG-10). A migrated payment or expense is never dropped or changed | Phase 7 (import shape), Phase 15 (final) |
| OD-16 | Staff balance rules: may a transfer exceed the sender's balance; may paying an expense take the payer's balance below zero; what happens when a payment correction or order deletion pushes a balance below zero; do refunds paid from a staff member's cash count; how is money still held by a deactivated or deleted staff member handed over? | Not covered. Ruled 2026-10-07: expenses a staff member paid always count (MONEY-01). Defaults: refuse transfers above the balance; let an expense take the payer below zero, because refusing would leave a real expense unrecorded; refunds don't count; the sender is always the signed-in user | Phase 10 |
| OD-17 | Can a money transfer be edited? | Not covered. Default: no edit; delete and re-create | Phase 10 |
| OD-18 | Money-transfer delete: soft or hard | Not covered. Recommended: soft, so history stays and past balances stay explainable. A hard delete changes past balances, and its audit copy is purged after 8 months (D-32) | Phase 10 |
| OD-20 | Payment field label: "Received by" or "Paid to" | The UI-spec payment modal has no such field (SPEC-GAP) | Phase 8 |
| OD-21 | Can an expense (company or order) be paid by the company, e.g. from the business bank or GCash account, instead of a staff member? | Not covered (owner addition, 2026-10-07). Default: no; Paid by must name an active Admin or Manager, matching the payment's Received by (ORD-22). A "yes" adds a company payer that holds no staff balance, and raises the same question for payments received into a company account. **Ruled (owner, 2026-10-25; 06 D-17): no.** Paid by is always an active Admin or Manager; Phase 7 applies the same rule to order expenses | ✓ Owner decided (2026-10-25) |

## PRD ↔ UI-Spec Conflicts (found at initialization; the owner rules at the relevant phase)

| # | Topic | PRD says | UI spec says | Type |
|---|---|---|---|---|
| C-1 | Discounts per order | At most **one** (0..1) | **Many** (Discounts tab with count, `Σ discountAmount`) | Domain rule |
| C-2 | Image limit per order | Max **5** (domain + DB) | `ImageUploader` defaults to `max = 12`. The prop exists, so the app can pass 5 | Domain rule |
| C-3 | Create-order flow | One transactional flow: details + items + payments + discount (+ expenses) | Create holds details, images and items only. Payments, discounts and expenses are added on the detail page after saving | UX / API shape |
| C-4 | New-user onboarding | Emailed invitation link; the Manager never sees or sets the password | The Manager sets a temporary password (prefilled `Csp-tahi-4821`) and the user changes it on first sign-in | **Security**: ask |
| C-5 | Password policy | NIST: 12–128 chars, no composition rules, breach check, no email/name | Copy reads "Use 8+ characters with a number and a symbol" | **Security**: ask |
| C-6 | Second factor | Mandatory 6-digit email code on every sign-in | No 2FA screen (SPEC-GAP; compose from `OtpInput` and the login layout) | Spec gap |
| C-7 | Forgot password | Full email reset flow (30-min single-use token) | Toast: "Ask a Manager to reset your password." (marked SPEC-GAP) | Spec gap |
| C-8 | Deactivated-account login error | One generic error; never reveal account state (CWE-204) | Separate banner: "This account is deactivated." | **Security**: ask |
| C-9 | Email change | Confirmation link to the new address, notice to the old one, applied only after confirmation | "Changes saved / Your name and email are updated." (immediate) | **Security**: ask |
| C-10 | Icons | `lucide-react` only | Must **not** add `lucide-react`. Use in-house `icons.ts` with Lucide v0.460.0 node data and a typed `IconName` | Library (recommend the UI spec) |
| C-11 | Dark mode | Respect `prefers-color-scheme` if a dark theme exists | Admin-only manual toggle persisted in `localStorage['csps-theme']`. Does **not** follow `prefers-color-scheme`. Public is light only | Theming (recommend the UI spec) |
| C-12 | Public pages | Home, services & prices, contact/location, legal | Home, Products, **Gallery** (masonry + lightbox), Contact with an **inquiry form** (attachments: JPG/PNG/PDF/AI, 10 MB, multiple). Inquiry storage and routing are undefined | Scope + **security** (CWE-434 for PDF/AI uploads) |
| C-13 | "Total" terminology | Subtotal = Σ items; Total = Subtotal − Discount; Balance = Total − Paid | "Total" = Σ items (pre-discount); Balance = Total − Total Discount − Total Paid | Naming (same math, different labels) |
| C-14 | Due date | Optional | Required, ≥ order date | Domain rule |
| C-15 | Order number | From a SQL `SEQUENCE`; legacy numbers preserved | `ORD-{YYYY}-{NNNN}`, sequential per year | Domain rule |
| C-16 | Image reorder & cover | No drag-only interactions (WCAG 2.5.7); no hover-only actions | Native drag reorder plus a hover star "Make cover"; actions are always visible only on touch devices | **A11y**: ask |
| C-17 | Screens the PRD requires that the UI spec doesn't show | — | 2FA, forgot/reset password, invite acceptance, email-change confirm, site content & price list management, metrics dashboard, audit log, cookie banner and preferences, legal pages, accessibility statement | Spec gaps: compose from existing patterns, mark `// SPEC-GAP:` |
| C-18 | Admin dashboard and estimated profit | Not in PRD §6 | Dashboard KPIs, income vs expenses chart, orders by status, recent orders; per-order "Estimated Profit" (internal only) | Scope addition |
| C-19 | "Keep me signed in" | Remember me, 90-day absolute | Checkbox **checked by default** | Security default: ask |
| C-20 | Local and test databases | Docker SQL Server 2025 + Testcontainers; legacy restore as `CSPS_Legacy_Restore` only in the discovery phase | (CLAUDE.md) LocalDB with `CSPS_Dev` / `CSPS_E2E` / `CSPS_Test_<guid>`, "restore the `.bak` into LocalDB as `CSPS_Dev`" | Environment: reconcile in Phase 1 and the legacy phase |
| C-21 | Products content | Price list from DB (`PriceCategory` → `PriceItem`) | Six fixed product lines with rich option copy, "Starts at [YOUR PRICE] / pc · min. [X] pcs"; gallery, testimonials and "recent work" are static data | Content model |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted
6. Owner decisions or conflicts resolved? → Move the row into Key Decisions with the ruling

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Business Context check — customer, revenue model, success metric still accurate?
4. Audit Out of Scope — reasons still valid?
5. Update Context with current state

---
*Last updated: 2026-10-26T07:02:00-05:00 after Phase 6 verification and transition*

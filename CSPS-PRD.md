# CSPS — Carmen's Stitch & Printing Services
## Product Requirements & Engineering Contract (for GSD Core)

> **How to use this file**
> 1. Put this file at the repository root next to `CSPS-UI-SPEC.md`.
> 2. Run: `/gsd-new-project --auto @CSPS-PRD.md`
> 3. Set `tdd_mode: true` in `.planning/config.json`, plan every phase with `/gsd-plan-phase N --tdd`.
> 4. For every phase with frontend work run `/gsd-ui-phase N` and treat `CSPS-UI-SPEC.md` as the design source of truth.
> 5. Run `/gsd-secure-phase N` and `/gsd-ui-review N` before `/gsd-ship N`.
>
> **Language used in this document:** **MUST / MUST NOT** = non-negotiable. **SHOULD** = expected unless a written reason is recorded in the phase CONTEXT.md. Anything marked **[OWNER DECISION]** MUST be asked, never assumed.

---

## 0. Prime Directives (read before anything else)

These rules override every other instruction, convenience, or "quick fix".

1. **Never lose or touch production data.** The legacy `.bak` is restored only into a local/disposable SQL Server. The live legacy database and site MUST NOT be modified at any point before the approved cutover (§16).
2. **Never commit secrets or data.** No `.bak`, connection strings, API keys, SMTP passwords, Cloudinary secrets, or customer data in git — ever.
3. **Test first.** Every behavior begins with a failing test (red → green → refactor). No production code without a test that demanded it.
4. **Zero warnings.** A build, lint, type-check, test run, or browser console that produces a warning is a failed build.
5. **Follow `CSPS-UI-SPEC.md` strictly.** Do not invent layouts, colors, spacing, typography, or components that contradict it. If the spec is silent, follow its existing patterns and record the gap. If the spec conflicts with accessibility (§12) or security (§11), stop and ask the owner.
6. **Respect the onion.** Dependencies point inward only (§3). Architecture tests enforce it.
7. **Security and accessibility are features, not phases.** Every phase is checked against §11 (MITRE) and §12 (WCAG).
8. **No axios.** All HTTP goes through the in-house `httpClient`, and every endpoint call lives in `api.ts` (§9.3).
9. **Ask, don't assume,** for every **[OWNER DECISION]** item (§21) and for every one-way-door action (schema/data migration, deletions, cutover).
10. **Responsive, optimized, and modern — everywhere.** Every screen must work beautifully on a phone first, load fast, and use current platform features (§7.1). Performance budgets are enforced in CI; a regression is a failed build.
11. **The app owns its database schema — no dependency on the `.bak`.** GSD designs and creates every table and column from the domain model (§5) using EF Core code-first migrations (§5.6). The app MUST build, run, pass every test, and deploy against a brand-new empty database with no `.bak` present. The `.bak` is used only for a one-time data import at the end (§16), and the legacy data is reshaped to fit the new schema — never the other way around.

---

## 1. Product Overview

**CSPS** is a tailoring/printing business application with two faces:

| Face | Audience | Purpose |
|---|---|---|
| **Public site** | Anonymous visitors | Shows services & prices, address, contact numbers, business info, legal pages, cookie consent. |
| **Admin portal** | Staff (`Admin`, `Manager`) | Orders (with items, payments, discount, expenses, images), company expenses, users, site content, visitor metrics, own profile. |

**Quality bar:** production-grade, secure, accessible, responsive (mobile-first), fast, fully tested, clean, and legally careful. Existing production data MUST be migrated without loss.

**Future:** an Android app will consume the same backend. The API MUST be client-agnostic (§15).

---

## 2. Technology Stack (pinned)

| Concern | Choice | Notes |
|---|---|---|
| Runtime | **.NET 10 (LTS), C# 14** | `global.json` pins the SDK. Solution file: `Csps.slnx`. |
| API style | ASP.NET Core **controller-based APIs** (`[ApiController]`, attribute routing; one controller per resource; thin actions calling one handler) | Versioned under `/api/v1`. Owner change 2026-10-07 (was Minimal APIs). Automatic model-state 400s are suppressed; validation runs in handlers and errors are RFC 9457 ProblemDetails. |
| ORM | **EF Core 10** (SQL Server provider) | Code-first migrations; Fluent configuration only (no attributes in Domain). |
| Database | **SQL Server 2025** | Local/dev/test via Docker image `mcr.microsoft.com/mssql/server:2025-latest`. |
| Identity | **ASP.NET Core Identity** (`IdentityUser<Guid>`, roles) | §8. |
| Validation | FluentValidation (Application layer) | Mirrored on the client with zod for UX only — server is authoritative. |
| Email | MailKit via SmarterASP.NET mail hosting (SMTP, TLS) | Behind `IEmailSender` abstraction. |
| Images | Cloudinary (`CloudinaryDotNet`) | Server-side signed uploads only (§10). |
| Logging | Serilog (structured) | No PII/secrets in logs (§11). |
| Frontend | **React 19 + TypeScript (strict) + Vite** | Built into `Csps.Server/wwwroot`, same origin as the API. |
| Styling | **Tailwind CSS v4** | Design tokens taken from `CSPS-UI-SPEC.md`. |
| Icons | `lucide-react` only | |
| Routing | React Router | Route-level code splitting with `React.lazy`. |
| Server state | TanStack Query | Uses `api.ts` functions as query/mutation functions. |
| Forms | react-hook-form + zod | |
| Tests (.NET) | xUnit v3, NSubstitute, Shouldly, Testcontainers (MsSql), Respawn, NetArchTest | |
| Tests (web) | Vitest + React Testing Library + vitest-axe, MSW (component tests only) | |
| E2E | **Playwright** + `@axe-core/playwright` | Chromium, Firefox, WebKit, plus mobile viewports. |
| VCS / CI | GitHub + GitHub Actions | §18. |
| Hosting | SmarterASP.NET (Windows/IIS) | §19. |

**Forbidden libraries:** `axios` (and wrappers of it), MediatR, AutoMapper, FluentAssertions v8+ (license changes), jQuery, any UI kit that conflicts with `CSPS-UI-SPEC.md`, any GPL/AGPL/SSPL/commercial-licensed package.
**Adding any dependency** requires: purpose, license (MIT/Apache-2.0/BSD/ISC only), maintenance status, and a passing GSD package-legitimacy check — recorded in the phase RESEARCH.md.

---

## 3. Architecture — Onion / Clean (4 production projects)

```
Domain  <--  Application  <--  Infrastructure  <--  Server
```

### 3.1 Repository layout

```
/CSPS-PRD.md                     (this file)
/CSPS-UI-SPEC.md                 (design source of truth)
/Csps.slnx
/global.json
/Directory.Build.props           (shared strict build settings)
/Directory.Packages.props        (central package versions)
/.editorconfig
/src
  /Csps.Domain                   entities, value objects, domain rules, domain errors — NO package refs
  /Csps.Application              use cases, DTOs, interfaces (ports), validators, authorization policies names
  /Csps.Infrastructure           EF Core DbContext + migrations, Identity, Cloudinary, SMTP, clock, crypto
  /Csps.Server                   API controllers, auth wiring, middleware, DI composition, wwwroot host
/web                             React + TS + Tailwind app (builds into src/Csps.Server/wwwroot)
  /src
  /tests/e2e                     Playwright specs
/tests
  /Csps.Domain.UnitTests
  /Csps.Application.UnitTests
  /Csps.Infrastructure.IntegrationTests
  /Csps.Server.IntegrationTests  (HTTP-level, incl. authorization matrix)
  /Csps.ArchitectureTests
/tools
  /Csps.LegacyMigration          one-time ETL console app (§16) — never deployed with the site
/.github                         workflows, CODEOWNERS, PR template, dependabot.yml
/_local                          GITIGNORED — legacy .bak and local-only files
```

Only the four `src/Csps.*` projects ship to production. Test projects and `tools/` are allowed and expected.

### 3.2 Layer rules (enforced by `Csps.ArchitectureTests`)

| Layer | May reference | MUST NOT reference |
|---|---|---|
| **Domain** | nothing (BCL only) | Application, Infrastructure, Server, EF Core, ASP.NET, Identity, any NuGet package |
| **Application** | Domain, `Microsoft.Extensions.*.Abstractions`, FluentValidation | Infrastructure, Server, EF Core, ASP.NET Core, Cloudinary, MailKit |
| **Infrastructure** | Application, Domain, EF Core, Identity, Cloudinary, MailKit | Server |
| **Server** | Infrastructure (and transitively Application/Domain) | Direct `DbContext` usage in endpoints (must call Application use cases) |

### 3.3 Patterns

- **Domain:** rich aggregates; invariants enforced in constructors/methods; no public setters on aggregate state; value objects (`Money`, `EmailAddress`, `PhoneNumber`, `OrderNumber`); domain errors as typed results, not exceptions, for expected failures.
- **Application:** one handler class per use case (`CreateOrderHandler`, …) behind small interfaces — no mediator library. Manual mapping via extension methods. Returns `Result<T>` / `Result` with typed errors that the Server maps to RFC 9457 ProblemDetails.
- **Ports in Application:** `IOrderRepository`, `IUnitOfWork`, `IImageStorage`, `IEmailSender`, `IIdentityService`, `ICurrentUser`, `IClock`, `ISecureCodeGenerator`, `IAnalyticsStore`, etc. Implemented in Infrastructure.
- **Identity isolation:** `ApplicationUser : IdentityUser<Guid>` lives in Infrastructure. Domain refers to users only by `UserId` (Guid).
- **Money:** `decimal(18,2)` in SQL, `decimal` in C#. **All totals are computed on the server**; the client only displays them.
- **Time:** store UTC (`datetimeoffset`/`datetime2`); calendar dates as `DateOnly`; display in the business time zone from site settings. `IClock` for testability — never `DateTime.Now` in code.
- **Concurrency:** every aggregate root has a SQL `rowversion`; stale updates return **409 Conflict** and the UI offers reload.
- **Auditing:** `CreatedAt/CreatedBy/UpdatedAt/UpdatedBy` on all aggregates + an append-only `AuditLog` table for security and financial events (§11.4).

---

## 4. Roles & Permissions

Two roles. Authorization is enforced **on the server** with named policies; the UI only hides what the user cannot do.

| Capability | Admin | Manager |
|---|:-:|:-:|
| Sign in, 2FA, remember me, sign out | ✅ | ✅ |
| Update own first name, last name, email, password | ✅ | ✅ |
| Orders: list/preview, view, create, update, delete | ✅ | ✅ |
| Order items, payments, discount, order expenses, order images: CRUD | ✅ | ✅ |
| Company expenses: list, create, update, delete | ✅ | ✅ |
| Manage users (create/invite, edit, change role, lock/unlock, deactivate, delete) | ❌ | ✅ |
| Manage public site content (prices, address, phone, hours, about, etc.) | ❌ | ✅ |
| View visitor metrics dashboard | ❌ | ✅ |
| View audit log | ❌ | ✅ |

**Rules**
- A Manager MUST NOT delete, deactivate, or demote themselves, and the system MUST NOT allow removing the **last active Manager**.
- Every endpoint declares a policy explicitly; endpoints without a policy fail the architecture/integration test suite (default-deny).
- An integration test **authorization matrix** covers every endpoint × {anonymous, Admin, Manager} and asserts the exact expected status code.

---

## 5. Domain Model

### 5.1 Order aggregate (root: `Order`)

Order items, payments, the discount, order expenses, and images **cannot exist without an order**. They are created, changed, and deleted only through the `Order` aggregate and are removed with it.

| Entity | Key fields | Invariants |
|---|---|---|
| **Order** | `Id`, `OrderNumber` (human-readable, unique, from SQL `SEQUENCE`; legacy numbers preserved), customer name, customer phone, customer email (optional), `OrderDate`, `DueDate` (optional), `Status`, notes, `RowVersion` | Customer name required; due date ≥ order date; status transitions per §21 decision. |
| **OrderItem** (1..n) | description, quantity, unit price, line total (computed), optional link to a price-list item | quantity > 0; unit price ≥ 0; description 1–200 chars. |
| **Payment** (0..n) | amount, paid on (date), method (enum), reference/note | amount > 0; date not in the future; overpayment rule per §21. |
| **Discount** (0..1) | type (`Fixed` \| `Percent`), value, reason | At most **one** per order; percent 0–100; resulting discount ≤ subtotal. |
| **OrderExpense** (0..n) | description, amount, date | amount > 0. Cost incurred for this order (e.g., materials). |
| **OrderImage** (0..5) | Cloudinary public id, width, height, bytes, format, sort order, alt text | **Maximum 5 images per order**; the first by sort order is the "cover" image. |

**Computed values (server-side, single source of truth):**
- `Subtotal = Σ item.LineTotal`
- `DiscountAmount = Fixed ? value : round(Subtotal × value / 100, 2)` (banker's rounding is NOT used — use `MidpointRounding.AwayFromZero`, documented in one place)
- `Total = Subtotal − DiscountAmount`
- `TotalPaid = Σ payment.Amount`
- `Balance = Total − TotalPaid`
- `TotalOrderExpenses = Σ expense.Amount`

### 5.2 Company expense aggregate (`CompanyExpense`)
Independent of orders: description, category (from a manageable list or enum per §21), amount, expense date, vendor (optional), notes, `RowVersion`. amount > 0.

### 5.3 Site content
- `SiteSettings` (singleton): business name, tagline, address lines, city/region/postal code, map link, phone numbers, email, business hours, social links, about text, business time zone, currency & locale (§21).
- `PriceCategory` → `PriceItem`: name, description, price, "starts at" flag, display order, active flag.

### 5.4 Analytics & consent
- `ConsentRecord`: consent id (random), choices (necessary/analytics), policy version, timestamp, GPC flag. No IP stored in clear.
- `Visit` / `PageView`: visitor id (random, only with consent), session id, path, referrer host, device class, browser family, OS family, timestamp. Aggregated `DailyPageStats` for no-consent traffic.

### 5.5 Security tables
`TwoFactorChallenge`, `RefreshToken` (hashed, with family id for reuse detection), `AuditLog`, Data Protection keys table.

### 5.6 Database schema ownership (code-first)
- **GSD creates all tables and columns.** Every table, column, index, constraint, and sequence comes from the domain model + EF Core Fluent configuration, delivered as an EF Core **migration**. Nothing is created or changed by hand in SQL Server.
- **Adding a column or table** = change the domain entity (test first) → update its EF configuration → `dotnet ef migrations add <DescriptiveName>` → integration test proves the migration applies to an empty database and to the previous version → review the generated SQL.
- **Fresh start:** a new developer, CI run, or test container gets the full schema from `dotnet ef database update` alone. A **development seed** creates fake but realistic data (staff users for both roles, orders with items/payments/discounts/images, company expenses, price list, site settings), so every screen is usable without real data.
- **Safe changes:** prefer additive migrations (new nullable column, new table, then backfill). Dropping or renaming a column/table, or changing a type that can lose data, is a **one-way door**: GSD stops and asks the owner, and the migration must include a data-preserving step.
- **Production:** migrations are applied as a reviewed idempotent SQL script after a backup (§19.2) — never automatically at app startup.
- **Legacy-only columns** (e.g., `LegacyId`, legacy order number) are added through the same migration process during the import phase (§16), and are optional/nullable so the app never depends on them.

---

## 6. Functional Requirements

Each requirement has an ID for GSD traceability. Every requirement needs unit + integration coverage; user journeys also need Playwright coverage.

### 6.1 Authentication (AUTH)

| ID | Requirement |
|---|---|
| AUTH-01 | Sign in with email + password. Generic error ("Invalid email or password") — never reveal whether the email exists. |
| AUTH-02 | After a correct password, the user MUST complete **second-factor verification with a 6-digit code** sent to their email before any session is issued (§8.2). |
| AUTH-03 | The 6-digit code is valid for **15 minutes**, single-use, max **5** wrong attempts, then invalidated. |
| AUTH-04 | "Resend code" with 60-second cooldown and max 5 sends per hour per account; a new code invalidates the previous one. |
| AUTH-05 | **"Remember me"** keeps the user signed in for **90 days** (absolute). Without it, the session ends when the browser closes (and at most 12 hours). |
| AUTH-06 | Sign out revokes the current refresh token and clears cookies. "Sign out of all devices" available on the profile page. |
| AUTH-07 | Account lockout after 5 failed password attempts for 15 minutes; user is notified by email of the lockout. |
| AUTH-08 | **Forgot password** via email (SmarterASP.NET mail hosting): always responds "If an account exists, we sent a link"; link token valid 30 minutes, single-use. |
| AUTH-09 | Reset password enforces the password policy (§8.4) and revokes all existing sessions; user receives a "your password was changed" email. |
| AUTH-10 | Deactivated or locked users cannot sign in, refresh, or reset into an active session. |

### 6.2 Profile (PROF)

| ID | Requirement |
|---|---|
| PROF-01 | Any signed-in user can update first name and last name. |
| PROF-02 | Changing email requires the current password, sends a confirmation link to the **new** address, and a notice to the **old** address. The change applies only after confirmation. |
| PROF-03 | Changing password requires the current password, enforces policy, revokes other sessions, and sends a notification email. |

### 6.3 User management — Manager only (USER)

| ID | Requirement |
|---|---|
| USER-01 | List users (paginated, searchable by name/email, filter by role/status). |
| USER-02 | Create user: first name, last name, email, role. The system emails an **invitation link** to set a password — the manager never sees or sets the password. |
| USER-03 | Edit user name, email, and role; lock/unlock; deactivate/reactivate; delete (with confirmation). |
| USER-04 | Guard rules from §4 (no self-demotion/deletion, never remove the last active Manager). |
| USER-05 | Role or status changes revoke the affected user's sessions immediately. |
| USER-06 | All user-management actions are written to the audit log. |

### 6.4 Orders (ORD)

| ID | Requirement |
|---|---|
| ORD-01 | **Order preview list**: paginated cards/rows showing order number, customer, date, status, **Total, Total Paid, Total Discount, Balance**, and the **first image** as a lazy-loaded thumbnail (placeholder if none). |
| ORD-02 | Search by order number, customer name, phone; filter by status, date range, "has balance"; sort by date, balance, total. Server-side pagination (default 20). |
| ORD-03 | **Create order** in one flow: order details + **one or more items** + **zero or more payments** + **at most one discount** (+ optional order expenses). Saved in a single database transaction. |
| ORD-04 | Upload up to **5 images** per order (during creation flow and later). Reorder images; choose cover; set alt text; delete images. |
| ORD-05 | Update order details; add/edit/remove items, payments, the discount, and expenses — each change revalidates invariants and recomputes totals. |
| ORD-06 | Delete order with confirmation dialog stating the consequences; deleting the order deletes all its children and schedules its Cloudinary images for deletion (delete semantics per §21). |
| ORD-07 | Order detail page shows all children and the computed summary (Subtotal, Discount, Total, Paid, Balance, Order expenses). |
| ORD-08 | Concurrency conflicts return 409; the UI explains and lets the user reload. |
| ORD-09 | Money is formatted with the configured currency/locale; inputs accept only valid amounts (2 decimals). |

### 6.5 Company expenses (CEXP)

| ID | Requirement |
|---|---|
| CEXP-01 | Page listing company expenses with pagination, date-range filter, category filter, search, and a period total. |
| CEXP-02 | Create, update, delete (with confirmation) a company expense. |

### 6.6 Public site (PUB)

| ID | Requirement |
|---|---|
| PUB-01 | Public pages per `CSPS-UI-SPEC.md` (e.g., home, services & prices, contact/location), plus legal pages (§13). |
| PUB-02 | Prices, categories, address, contact numbers, hours, and other business info are loaded from the database. |
| PUB-03 | Manager-only admin screens to edit all public content and the price list (create/edit/reorder/activate/deactivate/delete). |
| PUB-04 | Public pages are fast and SEO-friendly: unique titles/meta descriptions, Open Graph tags, `robots.txt`, `sitemap.xml`, structured data (`LocalBusiness` JSON-LD) built from site settings. Admin routes are `noindex`. |

### 6.7 Consent & visitor metrics (ANL)

| ID | Requirement |
|---|---|
| ANL-01 | On first visit show a cookie consent banner with **Accept all**, **Reject all** (equally prominent), and **Customize**. Nothing non-essential is set before a choice. |
| ANL-02 | Honor the browser **Global Privacy Control** signal as "reject analytics". |
| ANL-03 | A persistent "Cookie settings" link (footer) reopens preferences at any time. |
| ANL-04 | **"Clear my cookies & data"** button: expires all non-essential cookies (server-side for HttpOnly ones), clears local/session storage, and deletes server-side analytics tied to the visitor id. |
| ANL-05 | With consent: record visitor id (random UUID cookie, max 12 months), sessions, page views, referrer host, device/browser/OS family. IP addresses are never stored in clear (truncated, then HMAC'd with a rotating salt). |
| ANL-06 | Without consent: record only anonymous aggregate counts (path + day), no cookies, no identifiers. |
| ANL-07 | Consent is re-requested when the cookie policy version changes or after 12 months; consent decisions are logged (proof of consent). |
| ANL-08 | **Manager metrics dashboard**: unique visitors, sessions, page views, top pages, top referrers, device/browser split, trend chart; date-range picker; CSV export. |
| ANL-09 | Analytics data retention: raw events 13 months, then aggregated and purged (§21 to confirm). |

---

## 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Responsiveness | Mobile-first. Works from **320px** to large desktop; no horizontal scrolling; touch targets ≥ 44×44px; tables become cards on small screens as per UI spec. |
| Performance | Public pages: Lighthouse ≥ 95 (Performance, Accessibility, Best Practices, SEO) on mobile profile. Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms. API p95 < 300ms for list endpoints on the target host. |
| Loading states | **Skeletons everywhere** content loads (pages, lists, cards, detail panels, dashboards, images). Skeletons match final layout to avoid layout shift. Spinners only inside buttons during submission. |
| Images | Lazy-loaded, responsive (`srcset`/`sizes`), `f_auto,q_auto`, explicit width/height, skeleton/blur placeholder (§10). |
| Reliability | Graceful error states for every view (retry button), offline/network error messaging, global error boundary. |
| Observability | Structured logs, correlation id per request (returned in ProblemDetails `traceId`), health endpoint `/health` (no internals exposed). |
| Browser support | Last 2 versions of Chrome, Edge, Firefox, Safari (desktop + iOS), Chrome Android. |

### 7.1 Responsive, Optimized & Modern (mandatory)

**Responsive — mobile-first on every screen, public and admin**
- Design and build for the smallest screen first, then enhance upward using the breakpoints in `CSPS-UI-SPEC.md`.
- Verify every page at **320, 375, 414, 768, 1024, 1280, 1536, and 1920px**, in portrait and landscape.
- Use **container queries** (Tailwind v4 `@container`) for shared components, so a component adapts to the space it is given, not only to the window size.
- Use fluid typography and spacing (`clamp()`) within the UI spec's scale.
- Use `dvh`/`svh` units instead of `vh` for full-height layouts (mobile address bars).
- Respect safe areas (`env(safe-area-inset-*)`) on notched phones.
- Form inputs use ≥ 16px font size so iOS does not zoom. Use the correct `inputmode`/`type` (numeric keypad for money and OTP, `tel` for phone, `email` for email).
- No hover-only interactions. Every gesture has a button alternative.
- Data tables become cards on small screens. The admin navigation becomes a drawer or bottom navigation on mobile, as the UI spec defines.
- Order creation and other long forms are comfortable on a phone: sticky primary action, sectioned steps, no horizontal scrolling.
- Camera capture for order images on mobile (`accept="image/*"` with `capture` option), with client-side downscaling before upload.

**Optimized — fast on a mid-range phone over 4G**
- **Budgets (enforced in CI; build fails if exceeded):**

  | Budget | Limit |
  |---|---|
  | Public route initial JS | ≤ 150 KB gzipped |
  | Admin route initial JS | ≤ 250 KB gzipped |
  | Total CSS | ≤ 35 KB gzipped |
  | Lighthouse (mobile, public pages) | ≥ 95 in every category |
  | LCP | < 2.0 s |
  | CLS | < 0.05 |
  | INP | < 200 ms |

- **Code splitting:** split by route and heavy component (charts, image uploader, dashboard). Prefetch a route's chunk on link hover/focus/viewport. Bundle analysis runs in CI.
- **Rendering:** use the React Compiler (if stable and compatible at project start — verify in research) for automatic memoization, and avoid needless re-renders. Virtualize long lists (orders, expenses, users) once they exceed 100 rows.
- **Data:**
  - TanStack Query caching with sensible `staleTime`.
  - Prefetch on intent (e.g., hovering an order card).
  - Keep previous data while paginating.
  - Debounce search inputs (300 ms) and cancel stale requests with `AbortSignal`.
- **Fonts:**
  - Self-hosted `woff2`, subset to the characters actually used.
  - `font-display: swap`; preload the primary font.
  - Metric-matched fallback (`size-adjust`) so text does not shift when the font loads.
- **Icons:** named `lucide-react` imports only, so unused icons are tree-shaken out.
- **Images:** per §10. Add `preconnect` to `res.cloudinary.com`. Never load an image larger than its display size.
- **Server:**
  - Brotli/gzip response compression.
  - `ETag` + `Cache-Control` on public read endpoints.
  - **Output caching / HybridCache** for site settings and price list, invalidated when a Manager edits them.
  - Hashed static assets cached `immutable` for 1 year.
- **Database:**
  - `AsNoTracking` + projection straight to DTOs (no over-fetching).
  - Indexes on every filter/sort column used by list pages (order number, customer name, phone, status, order date).
  - No N+1 queries (an integration test asserts query count on list endpoints).
  - Compiled queries for hot paths; server-side pagination everywhere.
- **Real-user monitoring:** collect Core Web Vitals (`web-vitals`) only with analytics consent, and show them on the Manager metrics dashboard.

**Modern — current, clean, and pleasant**
- **Versions:** latest stable versions of every tool at project start (.NET 10, React 19, Tailwind v4, Vite, Playwright), kept current by Dependabot.
- **CSS:** modern platform CSS (container queries, `:has()`, logical properties, `color-mix()`, `@layer`) via Tailwind v4. No legacy hacks or polyfills for unsupported browsers.
- **Loading UX:**
  - React 19 + Suspense boundaries paired with skeletons.
  - Smooth route and state transitions using the **View Transitions API** as a progressive enhancement.
  - All motion disabled under `prefers-reduced-motion`.
- **Micro-interactions:** subtle, as defined by the UI spec (button feedback, toasts, inline success states). Nothing flashy that hurts performance or accessibility.
- **Installable web app (PWA):**
  - Web app manifest and icons, so staff can "Add to Home Screen" and use the admin portal like an app.
  - The service worker caches **only static assets/app shell**. It never caches API responses or authenticated data.
  - It uses a "new version available — reload" prompt, so deploys are never stale.
- **Theming:**
  - Dark mode and theme tokens only if `CSPS-UI-SPEC.md` defines them (otherwise [OWNER DECISION]).
  - Respect `prefers-color-scheme` when a dark theme exists.
- **Backend:**
  - .NET 10 controller-based APIs (`[ApiController]`) with built-in OpenAPI; validation via FluentValidation in handlers.
  - `TimeProvider` for time.
  - Primary constructors and records where they improve clarity.
  - No outdated patterns (no `Startup.cs`, no `WebClient`, no synchronous I/O).

---

## 8. Authentication & Session Design

### 8.1 Token model (web now, Android later)
- **Access token:** JWT, **15 minutes**, signed (HMAC-SHA256 with a ≥256-bit secret from configuration, or asymmetric key), claims: `sub`, `role`, `sid` (session id), `jti`. Held **in memory only** on the web client (never `localStorage`).
- **Refresh token:** 256-bit random, stored **hashed** in DB, **rotated on every use**, with **reuse detection** (reuse of a rotated token revokes the whole token family and forces sign-in).
  - Web: delivered in an `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` cookie, prefixed `__Host-` where path rules allow (otherwise `__Secure-`). Refresh requests require an anti-CSRF header.
  - Android (future): delivered in the response body when the client authenticates as a mobile client; stored in Android Keystore-backed storage.
- **Remember me:** refresh family absolute lifetime 90 days, persistent cookie. Otherwise: session cookie (no `Expires`) and 12-hour absolute server-side limit.
- Password change, reset, role change, deactivation, or "sign out everywhere" revoke all refresh tokens for the user.

### 8.2 Second-factor 6-digit code
- Generated with `System.Security.Cryptography.RandomNumberGenerator.GetInt32(0, 1_000_000)` formatted `D6` — **never** `System.Random`, GUID slicing, or time-based seeds.
- Stored only as **HMAC-SHA256(code, server key)**; compared with `CryptographicOperations.FixedTimeEquals`.
- Bound to a **pending-login ticket** (random opaque id in a short-lived HttpOnly cookie) and to the user id — a code cannot be used for another account or session.
- Expires in **15 minutes**; single use; 5 wrong attempts invalidates it (guess probability ≤ 5 in 1,000,000 per code).
- Email contains the code, its expiry time, and a "this wasn't me" line; the code never appears in logs, URLs, or analytics.
- Required on **every** new sign-in (including when "remember me" is chosen).
- Abstracted as `ISecondFactorDelivery` so SMS/authenticator apps can be added later without touching the domain.

### 8.3 ASP.NET Core Identity configuration
- `RequireUniqueEmail = true`, `RequireConfirmedEmail = true` for invited users.
- Lockout: 5 attempts / 15 minutes, enabled for new users.
- Password hashing: Identity's default PBKDF2 (do not lower iteration count).
- **Data Protection keys persisted to the database** (shared hosting recycles app pools — losing keys would break tokens and sign everyone out).

### 8.4 Password policy (NIST SP 800-63B aligned)
- Minimum **12** characters, maximum 128; allow all printable characters and spaces; no forced composition rules or periodic rotation.
- Reject passwords found in breach corpora (Have I Been Pwned k-anonymity range API — only the first 5 SHA-1 hex characters leave the server) and passwords containing the user's email/name.
- Show a strength meter and clear, accessible error messages.

---

## 9. Frontend Standards

### 9.1 Structure
```
web/src
  /app            router, providers, layouts (Public, Admin), error boundary
  /components/ui  reusable primitives (the shared component library)
  /features       orders, expenses, users, site-content, analytics, auth, profile (feature UI only)
  /lib/http       httpClient.ts (+ tests)
  /lib/api.ts     THE ONLY file containing API endpoint calls
  /lib            formatters (money/date), consent, query keys, utils
  /types          DTO types (mirroring the OpenAPI contract)
```

### 9.2 Reusable component library (build first, reuse everywhere)
Implement as generic, accessible, fully typed primitives styled per `CSPS-UI-SPEC.md`, each with unit + axe tests. Minimum set:
`Button`, `IconButton`, `Link`, `Input`, `TextArea`, `Select`, `Checkbox`, `Switch`, `MoneyInput`, `DateInput`, `PasswordInput` (show/hide + strength), `OtpInput` (6 boxes, paste support, `autocomplete="one-time-code"`), `FormField` (label/hint/error wiring), `Card`, `Badge`, `Alert`, `Toast`, `Dialog`, `ConfirmDialog`, `Drawer`, `Tabs`, `DataTable` (responsive → cards on mobile), `Pagination`, `SearchBox`, `FilterBar`, `EmptyState`, `ErrorState`, `PageHeader`, `Breadcrumbs`, `Skeleton` (+ `SkeletonText`, `SkeletonCard`, `SkeletonTable`, `SkeletonImage`), `LazyImage`, `ImageUploader` (max count, drag & drop, progress, reorder), `StatCard`, `Chart` wrapper, `CookieBanner`, `CookiePreferences`.
**Rule:** if a UI pattern appears twice, it becomes a shared component. Feature code MUST NOT re-implement a primitive.

### 9.3 HTTP layer (no axios)
**`web/src/lib/http/httpClient.ts`** — an axios-like, reusable, fetch-based client:
- `createHttpClient(config)` returns an instance with `get/post/put/patch/delete<T>()` and `request<T>(config)`.
- Config: `baseURL`, default headers, `timeout` (AbortController), `params` serialization, `signal` for cancellation.
- Automatic JSON serialization/parsing; `FormData` passthrough for uploads; optional `onUploadProgress` (uses an XHR transport only when progress is requested).
- **Request/response interceptors** (add access token, anti-CSRF header, correlation id).
- **401 handling:** single-flight refresh (concurrent requests wait for one refresh), retry once, otherwise sign out and redirect to login.
- Retries only for idempotent methods on network errors/503 with capped exponential backoff (max 2).
- Normalized `HttpError` (status, ProblemDetails body, field errors, traceId); never throws raw `Response`.
- `credentials: 'same-origin'`; no tokens in URLs.
- 100% unit test coverage.

**`web/src/lib/api.ts`** — the single file that defines every API call as a typed function grouped by area (`api.auth.*`, `api.orders.*`, `api.expenses.*`, `api.users.*`, `api.site.*`, `api.analytics.*`, `api.profile.*`). Components and hooks MUST call these functions, never `fetch`/`httpClient` directly (enforced with an ESLint `no-restricted-imports`/`no-restricted-globals` rule).

### 9.4 UX rules
- Optimistic UI only where safe; financial mutations wait for the server response.
- Every destructive action uses `ConfirmDialog` naming the item being deleted.
- Forms: inline validation on blur + submit, focus moves to the first error, errors announced to screen readers.
- Unsaved-changes guard on long forms (order create/edit).

---

## 10. Images (Cloudinary)

- Upload **through the server** (multipart → validation → Cloudinary signed upload). The Cloudinary API secret never reaches the browser.
- Validate: max **5 per order** (checked in the domain and the DB), allowed types JPEG/PNG/WebP/HEIC by **magic bytes** (not extension/MIME header), max size **10 MB** (configurable), max dimensions, reject SVG.
- Strip metadata (EXIF/GPS) on delivery; store original dimensions.
- Private naming: random public ids in a dedicated folder (`csps/orders/{orderId}/…`); consider `authenticated` delivery type for order images since they may show customers' garments (§21).
- Delivery URLs built with transformations: `f_auto,q_auto,c_limit` + width breakpoints for `srcset`; thumbnails `c_fill,g_auto`; low-quality blurred placeholder for progressive loading.
- `LazyImage`: `loading="lazy"`, `decoding="async"`, width/height set, skeleton until load, accessible `alt` (required field). The public LCP hero image is the only eager image (`fetchpriority="high"`).
- Deleting an order/image removes it from Cloudinary (retry-safe cleanup job; failures logged and retried).

---

## 11. Security — MITRE as the Guideline

Security follows **MITRE CWE** (weakness prevention, using the **latest CWE Top 25** at implementation time), **MITRE ATT&CK** (adversary techniques to defend against), and **MITRE CAPEC** (attack patterns used to write security tests). Each phase's SECURITY review MUST list which CWE IDs it touches and the test that proves the mitigation.

### 11.1 CWE mitigation map

| CWE | Weakness | Mandatory mitigation in CSPS |
|---|---|---|
| CWE-79 | Cross-site scripting | React escaping only; `dangerouslySetInnerHTML` banned (ESLint); strict CSP; server output encoding; sanitize any rich text with an allow-list. |
| CWE-89 | SQL injection | EF Core LINQ/parameters only; raw SQL banned except reviewed `FromSql` with interpolation parameters. |
| CWE-352 | CSRF | Access token in memory + `Authorization` header; refresh cookie `SameSite=Strict` + anti-CSRF header. |
| CWE-862 / CWE-863 | Missing / incorrect authorization | Default-deny policies; authorization matrix tests for every endpoint. |
| CWE-639 | IDOR | Resource lookups always scoped and policy-checked; GUID ids; tests for cross-access. |
| CWE-287 / CWE-306 | Improper / missing authentication | Identity + mandatory 2FA; no unauthenticated mutating endpoints except auth flows and consent. |
| CWE-307 | Excessive auth attempts | Lockout + ASP.NET Core rate limiting on login, 2FA verify, resend, forgot/reset password. |
| CWE-330 / CWE-338 | Weak randomness | `RandomNumberGenerator` for codes, tokens, ids used for security. |
| CWE-613 | Insufficient session expiration | 15-min access tokens, rotating refresh tokens, absolute lifetimes, revocation on credential changes. |
| CWE-640 | Weak password recovery | Single-use, 30-min, hashed reset tokens; no user enumeration; notification emails. |
| CWE-204 / CWE-203 | Observable discrepancy (user enumeration) | Identical responses and similar timing for existing/non-existing accounts. |
| CWE-916 / CWE-312 | Weak password hashing / cleartext storage | Identity PBKDF2; codes/tokens stored hashed; secrets never in DB in clear. |
| CWE-319 | Cleartext transmission | HTTPS only, HSTS (with preload once verified), TLS SMTP. |
| CWE-434 | Unrestricted file upload | Magic-byte validation, size/count limits, no SVG, server-side Cloudinary upload, never stored on local disk/webroot. |
| CWE-22 | Path traversal | No user-controlled file paths anywhere. |
| CWE-20 | Improper input validation | FluentValidation on every command/query; length limits on all strings; request body size limits. |
| CWE-502 | Unsafe deserialization | System.Text.Json only, no polymorphic type-name handling. |
| CWE-918 | SSRF | No server-side fetching of user-supplied URLs; outbound calls only to allow-listed hosts (Cloudinary, HIBP, SMTP). |
| CWE-200 / CWE-209 | Information exposure via errors | ProblemDetails without stack traces in production; generic messages; `traceId` for support. |
| CWE-532 / CWE-117 | Sensitive data in logs / log injection | Serilog destructuring policies masking secrets, codes, tokens, passwords; structured logging only. |
| CWE-798 | Hard-coded credentials | Secrets from environment/host configuration; secret scanning with push protection. |
| CWE-400 | Uncontrolled resource consumption | Rate limits, pagination caps (max 100), request size limits, timeouts. |
| CWE-601 | Open redirect | `returnUrl` must be a local path (validated). |
| CWE-1021 | Clickjacking | `frame-ancestors 'none'`. |
| CWE-1104 / CWE-1395 | Vulnerable/unmaintained components | NuGet audit as error, `npm audit` gate, Dependabot, dependency review on PRs. |
| CWE-1333 | ReDoS | No user-controlled regex; regex timeouts / `GeneratedRegex` with `NonBacktracking` where applicable. |

### 11.2 ATT&CK techniques explicitly defended
T1110 Brute Force (incl. T1110.003 spraying, T1110.004 credential stuffing) · T1078 Valid Accounts · T1190 Exploit Public-Facing Application · T1539 Steal Web Session Cookie · T1556 Modify Authentication Process · T1566 Phishing (lookalike reset emails — consistent sender, SPF/DKIM/DMARC) · T1499 Endpoint DoS · T1552 Unsecured Credentials · T1195 Supply Chain Compromise (pinned dependencies, lockfiles, actions pinned by SHA).

### 11.3 HTTP hardening (Server middleware + `web.config`)
- `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests` (adjust only for documented needs; no `unsafe-inline`/`unsafe-eval`).
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (deny camera, mic, geolocation, etc.), `Cross-Origin-Opener-Policy: same-origin`.
- Remove `Server`, `X-Powered-By`, `X-AspNet-Version` headers.
- HTTPS redirection; no CORS needed for the same-origin web app (keep CORS disabled until a specific origin is required).
- Rate limiting (fixed/sliding window, per IP and per account) on auth, consent, analytics ingestion, and public endpoints.
- Request body limits: JSON 1 MB; uploads per §10.

### 11.4 Audit log (append-only)
Sign-in success/failure, 2FA issued/verified/failed, lockouts, password reset/change, email change, session revocation, user CRUD/role/status changes, order and company-expense deletions, site-content changes. Each entry: UTC time, actor id, action, target type/id, IP (truncated), user-agent family, correlation id. No secrets or codes.

### 11.5 Security verification
- Unit/integration tests for each CWE row above (CAPEC-guided: CAPEC-66 SQLi, CAPEC-63 XSS, CAPEC-62 CSRF, CAPEC-112 brute force, CAPEC-593 session hijacking, CAPEC-1 authorization bypass).
- CodeQL (C# + TypeScript), secret scanning, dependency review, OWASP ZAP baseline scan against the staging deployment in CI.
- Pre-release security checklist sign-off in the hardening phase.

---

## 12. Accessibility — WCAG 2.2 Level AA

- Semantic HTML first; ARIA only when needed. Landmarks, one `h1` per page, logical heading order.
- Full keyboard operation; visible focus indicators meeting WCAG 2.2 focus appearance guidance; skip-to-content link; focus trapping and return in dialogs.
- Color contrast ≥ 4.5:1 text, ≥ 3:1 large text and UI components. If `CSPS-UI-SPEC.md` colors fail, flag to the owner — do not silently change the design.
- Target size ≥ 24×24 CSS px minimum (44×44 preferred), no drag-only interactions (image reorder also has buttons), no reliance on color alone, accessible authentication (paste allowed in password/OTP fields, no cognitive puzzles).
- Forms: programmatic labels, error identification and suggestion, `autocomplete` attributes.
- Respect `prefers-reduced-motion`; text resizes to 200% and reflows at 320px without loss.
- Skeletons use `aria-busy` on the region and a polite live region announcing loading/completion.
- Automated: vitest-axe on every component, `@axe-core/playwright` on every page in E2E with **zero** violations for `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` tags. Manual: keyboard-only and screen-reader (NVDA + VoiceOver) passes recorded in UAT for critical flows.
- Publish an Accessibility Statement page with a contact method for issues.

---

## 13. Legal & Privacy (best effort — owner must have it reviewed by a lawyer)

- Pages: **Privacy Policy**, **Cookie Policy**, **Terms of Use**, **Accessibility Statement**, all linked in the footer, versioned, with "last updated" dates; text supplied/approved by the owner (GSD drafts templates clearly marked DRAFT).
- Privacy by design & data minimization: collect only what orders require; customer data visible only to staff.
- Cookie consent per §6.7 — designed to satisfy common requirements (opt-in for non-essential cookies, equal-prominence reject, granular choices, withdrawal as easy as consent, GPC honored).
- Data retention rules configurable and documented (orders and financial records per local tax/bookkeeping rules — [OWNER DECISION]).
- Data subject requests (access/correction/deletion of a customer's data) supported by a documented manager procedure.
- Breach response: audit log + logs sufficient to investigate; owner notification procedure documented.
- Email: transactional only, from the business domain with SPF/DKIM/DMARC configured; no marketing emails without separate consent.
- Third-party licenses: only permissive licenses; generate a `THIRD-PARTY-NOTICES` file in CI; fonts and images must be licensed for web use.
- ADA/accessibility compliance via §12.

---

## 14. Testing Strategy (TDD)

**Workflow:** every task starts with a failing test that expresses the requirement (red), the minimal code to pass (green), then refactor with tests green. Commits show the test before or with the implementation. GSD plans use `--tdd`.

| Level | Tooling | Scope | Gate |
|---|---|---|---|
| Unit (Domain) | xUnit v3 + Shouldly | All invariants and calculations (totals, discount, 5-image limit, single discount) | **100%** line & branch coverage |
| Unit (Application) | xUnit v3 + NSubstitute | Handlers, validators, authorization rules, 2FA logic with fake clock | ≥ 95% |
| Integration (Infrastructure) | Testcontainers SQL Server 2025 + Respawn | EF mappings, migrations apply cleanly, concurrency, cascade rules, sequences | All migrations tested up from empty DB |
| Integration (API) | `WebApplicationFactory` + Testcontainers | Every endpoint: happy path, validation errors, authorization matrix, rate limits, ProblemDetails shape | 100% endpoint coverage |
| Architecture | NetArchTest | Layer rules in §3.2, endpoint policy presence, naming | Must pass |
| Frontend unit/component | Vitest + RTL + vitest-axe (+ MSW) | `httpClient` (100%), `api.ts`, every shared component, forms, formatters | ≥ 90% overall, 100% for `lib/http` |
| **E2E** | **Playwright** + axe | Critical journeys (below) on Chromium/Firefox/WebKit + Pixel/iPhone viewports | All green, zero axe violations, **zero console errors/warnings** |
| Security | CodeQL, ZAP baseline, dependency audits | §11.5 | No high/critical findings |
| Performance | Lighthouse CI on public pages | §7 targets | Budgets enforced |

**Critical E2E journeys:** sign in with 2FA (with and without remember me) · wrong code / expired code / lockout · forgot & reset password · profile updates · manager user management incl. guard rules · admin denied user management · create order with items + payments + discount + images · edit/delete each child · delete order · order preview totals correctness · company expense CRUD · public site renders managed content · manager edits prices and sees them publicly · cookie consent accept/reject/customize/clear · metrics dashboard shows recorded visits · responsive layouts at 320/768/1280px.

**Email in tests:** a `Testing`-environment-only email sink (in-memory, exposed through a test-only endpoint compiled out of Release builds or registered only when `ASPNETCORE_ENVIRONMENT=Testing`) lets Playwright read 2FA codes and reset links. It MUST NOT exist in production builds — verified by a test.

**Test data:** builders/factories; no production data in tests; seed scripts create realistic fake data.

---

## 15. API Design (Android-ready)

- RESTful JSON under `/api/v1/...`; plural nouns; nested resources for aggregate children (e.g., `/api/v1/orders/{orderId}/payments/{paymentId}`).
- Errors: RFC 9457 ProblemDetails with `traceId` and field-level `errors`.
- Pagination: `?page=&pageSize=` (max 100) returning `{ items, page, pageSize, totalCount }`; filtering/sorting via documented query params.
- Dates ISO-8601 (UTC with `Z`, or `yyyy-MM-dd` for `DateOnly`); money as JSON numbers with 2 decimals, computed server-side.
- Optimistic concurrency via `rowVersion` (base64) in payloads or `If-Match`/`ETag`.
- OpenAPI document generated with .NET 10's built-in OpenAPI support; available in Development, and to authenticated Managers only in Production (or disabled — [OWNER DECISION]). Frontend DTO types SHOULD be generated from it and checked in CI for drift.
- No web-only assumptions in the API (no server-rendered redirects for API calls, no cookie-only auth for mobile — §8.1).

---

## 16. Legacy Data Migration (existing production `.bak`)

**Goal:** bring all existing production data into CSPS with **zero loss**, while the current production system stays untouched until cutover.

**Independence:** the app is designed and built from this PRD and `CSPS-UI-SPEC.md`, not from the legacy database. The `.bak` is never a source of table or column design, never required to build, test, run, or deploy, and is not opened until the import phases near the end of the roadmap (§20). If legacy data has something the new model can't hold, GSD proposes a new column or table in the new model (owner approves) and adds it via a normal migration (§5.6).

### 16.1 Rules
- The `.bak` lives in `/_local/` (gitignored). It is never committed, uploaded to CI, or shared.
- Restore only into a local SQL Server 2025 container/instance named for the purpose (e.g., `CSPS_Legacy_Restore`). Treat it as **read-only**.
- No step may connect to the live legacy production database except the final, owner-approved cutover.

### 16.2 Phase steps
1. **Discovery (read-only):** restore the `.bak`, then produce `.planning/LEGACY-SCHEMA.md`: every table, column, type, key, relationship, row count, sample value shapes (no real customer data copied into planning docs), data-quality issues (nulls, duplicates, orphans, negative amounts, inconsistent totals), how images are stored, whether user accounts exist.
2. **Mapping proposal:** `.planning/LEGACY-MAPPING.md` mapping each legacy field to the new model (or "not migrated — reason"). **Human checkpoint: the owner approves the mapping before any ETL code is written** (one-way door).
3. **ETL tool** (`tools/Csps.LegacyMigration`), test-driven:
   - Reads the restored legacy DB, writes to a fresh CSPS DB created by EF migrations.
   - Idempotent and re-runnable; `--dry-run` mode; batch processing; full transaction per batch with clear logs.
   - Preserves legacy primary keys in `LegacyId` columns and legacy order numbers.
   - Legacy images (if any) uploaded to Cloudinary with mapping recorded.
   - Legacy user accounts (if any): profiles migrated; passwords are **not** carried over unless the hash format is verifiably compatible — users get a "set your password" email at go-live.
4. **Reconciliation report** (automated, must be 100% before cutover): row counts per entity; Σ item totals, Σ payments, Σ discounts, Σ order expenses, Σ company expenses; per-order Total/Paid/Balance compared legacy vs new; list of every transformed or rejected row with reason. Any unexplained difference blocks cutover.
5. **Dress rehearsal** on the staging site with a fresh `.bak`, timed.
6. **Cutover runbook** (§19.4).

---

## 17. Code Quality — Zero Warnings, Clean Code

### 17.1 .NET (`Directory.Build.props`)
- `TreatWarningsAsErrors=true`, `Nullable=enable`, `ImplicitUsings=enable`, `AnalysisLevel=latest-recommended` (raise rule severities where useful), `EnforceCodeStyleInBuild=true`, `GenerateDocumentationFile=true` for `src/` projects, `Deterministic=true`, `ContinuousIntegrationBuild=true` in CI.
- `NuGetAudit=true`, `NuGetAuditMode=all`, audit warnings as errors.
- Central package management; no floating versions.
- `dotnet format --verify-no-changes` in CI.
- No `#pragma warning disable` or `[SuppressMessage]` without a justification comment and an issue link — reviewed in PR.

### 17.2 TypeScript/React
- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`.
- ESLint (flat config): `typescript-eslint` strict-type-checked + stylistic-type-checked, `react-hooks`, `jsx-a11y` (strict), custom restrictions (no `axios`, no direct `fetch` outside `lib/http`, no `dangerouslySetInnerHTML`, no `any`, no non-null assertions, no `console` in app code). Run with `--max-warnings 0`.
- Prettier check in CI. Vite build must produce no warnings (chunk-size budget set explicitly).
- Playwright fails a test on any browser console error or warning, and on React key/act warnings in Vitest.

### 17.3 Clean code rules
- Small, single-purpose functions and components; descriptive names over comments.
- **Comments: short, precise, explain *why*, not *what*.** XML doc `<summary>` (one line) on public types/members in `src/`. TSDoc one-liners on exported functions/components. No commented-out code. No `TODO` without an issue link.
- No magic numbers/strings — named constants or configuration (e.g., `MaxImagesPerOrder = 5`, `TwoFactorCodeLifetime = 15 min`, `RememberMeLifetime = 90 days`).
- No duplication of business rules between client and server beyond UX validation.

---

## 18. Version Control & CI/CD (GitHub)

- Private repository; default branch `main` protected: PR required, all status checks green, up-to-date branch, linear history, no force-push, CODEOWNERS review.
- **Conventional Commits**; PR template with checklist (tests first, zero warnings, a11y, security CWE list, UI-spec conformance, screenshots at 3 breakpoints).
- `.gitignore` includes: `_local/`, `*.bak`, `*.mdf`, `*.ldf`, `appsettings.*.local.json`, `.env*`, user secrets, Playwright reports/traces, `wwwroot` build output.
- Secret scanning + push protection, Dependabot (NuGet, npm, GitHub Actions), CodeQL, dependency review action. Third-party actions pinned by commit SHA; least-privilege `permissions:` per workflow.
- **CI pipeline (on every PR):** restore (locked) → build .NET (warnings = errors) → `dotnet format` check → unit tests → integration tests (Testcontainers) → architecture tests → web: typecheck, lint, Prettier, Vitest with coverage → build web into `wwwroot` → Playwright E2E (all browsers + mobile) → Lighthouse CI → coverage gates → license/notice generation.
- **CD:** on merge to `main` → deploy to **staging** on SmarterASP.NET → ZAP baseline + smoke E2E against staging → **manual approval** → production deploy.

---

## 19. Hosting — SmarterASP.NET

### 19.1 Deployment
- Verify in the hosting control panel that the plan provides the **.NET 10 (ASP.NET Core) hosting bundle** and **SQL Server 2025**, and check database size limits of the plan. If the exact runtime is not available, publish **self-contained** for the host's architecture.
- Deploy via **Web Deploy (MSDeploy)** from GitHub Actions using repository secrets; use `app_offline.htm` during deploy.
- `web.config`: in-process hosting, remove server headers, HTTPS rewrite, static file caching (hashed Vite assets `immutable`, `index.html` `no-cache`), compression.
- Configuration secrets live on the server (host environment variables or a server-only `appsettings.Production.json` never stored in git).
- Free/managed TLS certificate enabled for the domain; HSTS after HTTPS verified.

### 19.2 Database
- **Do not auto-migrate on startup in production.** Generate an idempotent script (`dotnet ef migrations script --idempotent`), review it, take a backup, then apply.
- Least-privilege SQL login for the app (no `db_owner` at runtime if the host allows separate logins).
- Scheduled database backups enabled in the control panel; restore procedure tested once before go-live.

### 19.3 Shared-hosting constraints
- App pools recycle/idle: no reliance on long-running in-memory state; Data Protection keys and rate-limit-sensitive state handled accordingly; background cleanup (Cloudinary deletions, analytics aggregation, token purge) runs as short, idempotent jobs triggered on schedule (host scheduler if available, otherwise a GitHub Actions cron calling a secret-protected maintenance endpoint).
- Keep memory footprint small; response compression on.

### 19.4 Production cutover runbook (one-way door — owner present)
1. Announce maintenance; put legacy site in read-only/maintenance mode.
2. Take a fresh legacy backup (kept untouched as rollback).
3. Run ETL into the production CSPS database; run reconciliation — must be 100%.
4. Deploy app; smoke test; owner verifies sample orders and totals.
5. Switch domain/site; monitor logs.
6. Rollback plan: re-point to legacy site and backup if any blocker appears. Keep the legacy backup for an agreed retention period.

---

## 20. Suggested Roadmap (GSD phases)

Each phase is a vertical slice: domain → application → infrastructure → API → UI → tests (unit, integration, E2E) → security & a11y review.

| # | Phase | Key outputs |
|---|---|---|
| 1 | **Foundation / walking skeleton** | Solution + 4 projects + test projects, strict build props, architecture tests, CI, initial EF Core migration + dev seed, security headers, ProblemDetails, logging, `/health`, React shell + routing + layouts per UI spec, `httpClient.ts` + `api.ts`, core UI primitives + Skeletons, staging deploy to SmarterASP.NET |
| 2 | **Identity & authentication** | Login, 6-digit 2FA, remember me (90d), refresh rotation, lockout, rate limits, forgot/reset password, email sender, role seeding, audit log |
| 3 | **Profile & user management** | Profile updates (name, email w/ confirmation, password); Manager user management with guard rules |
| 4 | **Orders core** | Order aggregate, items, payments, discount, order expenses, create flow, edit/delete, preview list with totals |
| 5 | **Order images** | Cloudinary upload/validation, max 5, cover image, reorder, lazy responsive delivery, cleanup job |
| 6 | **Company expenses** | CRUD page with filters and totals |
| 7 | **Public site & content management** | Public pages per UI spec, price list & site settings management, SEO |
| 8 | **Consent, analytics & legal pages** | Cookie banner/preferences/clear, GPC, analytics capture, manager dashboard, legal & accessibility pages |
| 9 | **Hardening** | Full MITRE CWE/ATT&CK review, ZAP, manual a11y audit, performance budgets, backup/restore test, runbooks |
| 10 | **Legacy discovery & mapping (read-only)** | Restore `.bak` locally, `LEGACY-SCHEMA.md`, `LEGACY-MAPPING.md` (legacy → new schema, plus any proposed new columns/tables) → owner approval checkpoint |
| 11 | **Legacy data import** | Approved new columns/tables via migrations, ETL tool, reconciliation report, dress rehearsal on staging |
| 12 | **Production cutover** | Runbook execution with owner, post-go-live monitoring |

Phases 1–9 deliver the complete, working app on an empty database. Phases 10–11 are the only ones that touch the `.bak`.

---

## 21. [OWNER DECISION] — GSD must ask; recommended defaults in parentheses

1. Currency and number/date locale (configurable in site settings; default to owner's answer).
2. Business time zone (stored in site settings).
3. Order status list and allowed transitions (e.g., Received → In Progress → Ready → Picked Up, plus Cancelled). Legacy statuses are mapped onto this list during import.
4. Are overpayments allowed? (Default: **no** — payment cannot exceed the remaining balance.)
5. Delete semantics for orders and company expenses: hard delete, or soft delete hidden from the app with audit trail? (Recommended: **soft delete** for financial records, with Manager-only permanent purge.)
6. Should Admins be allowed to delete orders, or only edit? (Spec currently: Admin can delete.)
7. Customers: store customer details on each order, or a reusable `Customer` entity? (Recommended: reusable `Customer` entity so repeat customers aren't retyped. Decide before Phase 4; legacy customer data is mapped into whichever is chosen.)
8. Company expense categories: fixed list or manager-editable?
9. Order images: public Cloudinary delivery or authenticated (private) delivery? (Recommended: **authenticated**.)
10. Retention periods for orders/financial records, analytics (default 13 months), audit log (default 2 years).
11. Jurisdiction(s) for legal pages and which privacy laws apply; who reviews the legal text.
12. Sender email address/domain for system emails and whether SPF/DKIM/DMARC can be configured on the domain.
13. Expose the OpenAPI document in production to Managers, or disable it?
14. Any UI-spec item that conflicts with WCAG contrast or target-size rules.

---

## 22. Definition of Done (every phase, every task)

- [ ] Requirements (by ID) implemented and traced in SUMMARY.md coverage.
- [ ] Tests were written first; unit, integration, and E2E tests for the slice pass; coverage gates met.
- [ ] **Zero** compiler, analyzer, lint, type, test, build, and browser-console warnings.
- [ ] Architecture tests pass; no layer violations.
- [ ] Matches `CSPS-UI-SPEC.md` at 320px, 768px, and 1280px (screenshots attached); skeletons for every loading state; images lazy and optimized.
- [ ] Responsive at every breakpoint in §7.1 (portrait + landscape); performance budgets and Lighthouse scores met; no bundle-size regressions.
- [ ] All API calls go through `api.ts` → `httpClient`; no axios; shared components reused.
- [ ] WCAG 2.2 AA: axe zero violations + keyboard pass.
- [ ] Security: relevant CWE rows mitigated and tested; authorization matrix updated; no secrets committed; CodeQL clean.
- [ ] Comments short and purposeful; no dead code; no unexplained suppressions.
- [ ] Production data untouched; migrations reviewed and reversible where possible.
- [ ] `/gsd-secure-phase`, `/gsd-ui-review`, and `/gsd-verify-work` completed before `/gsd-ship`.

---

## 23. Out of Scope (for this milestone)

Customer self-service accounts, online payments, SMS/authenticator-app 2FA (abstraction ready), the Android app itself (API ready), multi-language UI, marketing emails, inventory, and financial reporting beyond the order summary, company expense totals, and visitor metrics.

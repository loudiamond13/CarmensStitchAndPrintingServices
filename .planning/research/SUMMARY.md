# Project Research Summary

**Project:** CSPS — Carmen's Stitch & Printing Services (staff order portal + public marketing site, replacing a live legacy system)
**Domain:** Small-business order management + marketing site for a Philippine custom-sublimation/tailoring shop. .NET 10 onion Minimal API + React 19 SPA served from `wwwroot`, SQL Server, SmarterASP.NET shared Windows/IIS hosting, one-time legacy `.bak` migration
**Researched:** 2026-10-06
**Confidence:** MEDIUM overall. Versions, licenses and local machine measurements are HIGH. Framework behaviour is MEDIUM. Anything about SmarterASP.NET is LOW until someone checks the control panel.

## Executive Summary

CSPS is a print-shop order manager for about 5 staff, with a phone-first marketing site in front. Commercial tools in this space (Printavo, YoPrint, ShopVOX) share one core: line items with pricing, deposit and final-payment tracking, a status pipeline with due dates, and a KPI/profit dashboard. Most also have an inquiries inbox fed by the website form. CSPS covers that core and deliberately skips online payments, a customer portal and inventory. That fits a shop whose customers live on Facebook Messenger. Sources disagree in places, but the research found no reason to change the PRD's pinned architecture: onion layers, a handler per use case, `Result<T>` → ProblemDetails, server-authoritative money, rowversion concurrency, custom JWT with rotating refresh and email 2FA, and cron-driven idempotent jobs instead of background services. What the research adds is concrete wiring, plus a list of places where the PRD, the UI spec, CLAUDE.md and the current package ecosystem collide.

The recommended approach is the PRD's vertical-slice roadmap with corrections. Put the cross-cutting primitives in Foundation: SiteSettings core (time zone/currency), the append-only AuditLog, the authorization-matrix harness, bundle budgets, the golden-vector money tests and the E2E host. Prove the slice pattern on Company Expenses before tackling the Order aggregate. Split Orders into domain/API and UI. Add a Dashboard phase, which no PRD phase covers today. Keep legacy discovery last (Prime Directive 11), but build `Order.Import(...)` and configurable rule constants early so real data can't force domain rewrites after hardening. Several Order-domain decisions should be designed as supersets so an owner ruling becomes a constant change rather than a schema change: discounts as a collection, persisted totals with explicit names, a per-year order-number counter table, and a create endpoint that accepts the full aggregate.

The main risks concentrate on the Core Value:
- **Order math.** Client rounding (`Math.round(n*100)/100`) differs from server `AwayFromZero` by ₱0.01 on about 3–4% of 2.5%/7.5% discounts [measured], and the official fixture ORD-2026-0148 doesn't catch it.
- **Concurrency.** The root rowversion doesn't move when only child rows change, so concurrent payments can overpay.
- **"Today" in UTC.** Computing it in UTC rejects morning payments in Manila.
- **Refresh rotation.** Reuse detection signs users out across tabs, under StrictMode and on flaky networks.
- **Email deliverability.** It is a hard sign-in dependency, because 2FA is mandatory and OD-12 (sender domain) is unresolved.
- **Hosting unknowns.** SmarterASP.NET's runtime patch, SQL compat level, collation, proxy topology and plan limits are all unverified.

Mitigations: golden-vector parity tests, a root-touch interceptor, `IBusinessCalendar`, Web Locks plus a server grace window, an early SMTP/DNS spike, and a Foundation hosting-verification spike done first.

## Key Findings

### Recommended Stack

The stack is pinned by PRD §2 and verified current as of 2026-10-06. Core: .NET SDK 10.0.401 / runtime 10.0.12 LTS, EF Core 10.0.12, ASP.NET Core Identity via `AddIdentityCore` (not `AddIdentity` or `MapIdentityApi`), JwtBearer with `JsonWebTokenHandler`, built-in OpenAPI 3.1, FluentValidation 12.1.1, MailKit 4.18.1, CloudinaryDotNet 1.29.3, Serilog.AspNetCore 10 with a File sink, and HybridCache. Frontend: React 19.3, Vite 8.3 (Rolldown), Tailwind 4.3, react-router 8.4, TanStack Query 5.104, react-hook-form + zod 4. There is no chart library (the UI spec's SVG charts are enough) and no axios. LocalDB on this machine is SQL Server 2025 (17.0.4025.3) [measured].

**Core technologies:**
- **.NET 10 / EF Core 10 / SQL Server 2025.** The LTS runtime matches the installed SDK. Pin `UseCompatibilityLevel` explicitly to whatever the host reports.
- **Custom JWT + rotating refresh on Identity Core.** The PRD's 2FA, refresh-family and reuse rules rule out `MapIdentityApi`.
- **React 19.3 + Vite 8 + Tailwind 4.3.** These match the UI spec's tested versions. Add the React Compiler only through the Babel path (`@rolldown/plugin-babel` + `babel-plugin-react-compiler` 1.0 + `@babel/core` 7.29).
- **xUnit v3 4.0.1 on Microsoft.Testing.Platform v2.** Use coverlet.MTP plus ReportGenerator for coverage thresholds. Testcontainers 4.15 needs an explicit `2025-CU9` image. Use Respawn 7.
- **Vitest 5, MSW 3, Playwright 1.63, @axe-core/playwright 4.13, @lhci/cli 0.15.**

**Pinned-stack adjustments. Each one is an owner-visible decision, not a silent change:**

| # | Adjustment | Why | Decide in |
|---|---|---|---|
| S-1 | **TypeScript alias pair:** `typescript` → `npm:@typescript/typescript6@6.0.2` (API for tools) + `@typescript/native` → `npm:typescript@7.0.2` (fast CLI) | typescript-eslint 8.71 peers `<6.1.0`, and TS 7 has no stable API until 7.1 | Phase 1 |
| S-2 | **`eslint-plugin-jsx-a11y-x` 0.2.0** (e18e fork) replaces `eslint-plugin-jsx-a11y` 6.10.2 | The original doesn't support ESLint 10, and ESLint 9 has been EOL since 2026-08-06 | Phase 1 |
| S-3 | **NetArchTest.Rules 1.3.2** (unmaintained since 2021, no nuspec license) vs **ArchUnitNET 0.13.4** (Apache-2.0, maintained) vs NetArchTest.eNhancedEdition | CWE-1104 unmaintained component; the license tool needs an override | Phase 1 |
| S-4 | **Coverage: coverlet.MTP + ReportGenerator** | `coverlet.collector` is VSTest-only. `Microsoft.Testing.Extensions.CodeCoverage` has a proprietary license (forbidden). coverlet.MTP doesn't enforce thresholds itself | Phase 1 |
| S-5 | **License exceptions:** MPL-2.0 for axe-core and everything built on it (dev/test only, and the PRD mandates axe); OFL-1.1 for the @fontsource fonts (shipped) | The PRD allow-list is MIT/Apache/BSD/ISC only | Phase 1 **[OWNER DECISION]** |
| S-6 | **vitest-axe 0.1.0** (2022, types predate Vitest 5) vs a ~20-line in-house axe matcher | Maintenance and typing | Phase 1 |
| S-7 | **MSW v3** (the PRD says v2); **react-router 8** (no `react-router-dom`); TanStack Query stays on v5 (v6 doesn't exist) | Ecosystem moved on | Phase 1 (doc correction) |
| S-8 | **openapi-typescript 7.13** peers TS 5: isolate it in `tools/openapi-gen/` or hand-write DTOs with a drift check | Peer conflict with S-1 | Phase 1 |
| S-9 | **Private-repo GitHub Advanced Security cost:** CodeQL, dependency-review and push protection need GH Code Security (~$30/committer/mo) + Secret Protection (~$19). The free substitute (NuGetAudit + npm audit + license gates + gitleaks) is weaker than PRD §18 | Cost vs control set | Phase 1 (before CI) **[OWNER DECISION]** |
| S-10 | **Release cool-down:** many latest packages were flagged "too-new" (<30 days) by the legitimacy seam. Prefer versions 7–14 days old, set Dependabot `cooldown`, and record "aged" or "accepted" per package | Supply chain (T1195) | Phase 1 |
| S-11 | **Remove `Microsoft.AspNetCore.SpaProxy`** (the scaffold's floating `10.*-*` version breaks PRD §17.1). Use a Vite proxy with hard-coded ports instead | Fits the build-into-`wwwroot` model and CLAUDE.md env-var rules | Phase 1 |
| S-12 | **Icons (C-10):** in-house `icons.ts` (all 57 icons in every chunk that uses it, including public) vs `lucide-react` 1.52 (tree-shaken, but drawings may have drifted from 0.460) | Already in PROJECT.md. Research quantifies the trade-off | Phase 1 |

### Expected Features

Every PRD §6 ID is accounted for. The research adds proposed IDs (DASH-, INQ-, GAL-, CONT-, LEGAL-, AUDIT-, MIG-, ORD-10+) for features neither document numbers. REQUIREMENTS.md should adopt them.

**Must have (table stakes, v1 cutover):**
- AUTH-01..10, PROF-01..03, USER-01..06, plus **USER-07** (resend invite / send reset link: a GAP in both documents).
- ORD-01..09 plus ORD-10..15 (view toggle, overdue flags, "Fully Paid", product type per item, `ORD-YYYY-NNNN` numbering, unsaved-changes guard).
- **ORD-16 status history, ORD-17 status transition rules, ORD-18 refund/cancelled-order payment policy.** All three are GAPs.
- ORD-04 images with an accessible reorder (C-16). CEXP-01..04.
- **DASH-01..06.** This is the staff landing screen. It's in the UI spec, but no PRD phase covers it.
- PUB-01..07, GAL-01..03 (gallery management is a GAP), CONT-01..05 (holidays CONT-04 is a GAP).
- **PUB-04 server-side `<head>` injection.** Facebook's scraper doesn't run JS, and that's the main traffic source.
- **INQ-01..08.** The approved design has a public quote form, but no admin side exists. Shipping without an inbox loses leads.
- ANL-01..09, LEGAL-01..05, AUDIT-01..02 (the audit viewer has no PRD ID or UI).
- MIG-01..07.

**Should have (differentiators, v1.x):**
- Estimated profit per order (already in the UI spec; must never appear on customer-facing output).
- ORD-19 non-image order files (rosters, PDF/AI). This becomes table stakes if INQ-02 accepts PDF/AI.
- ORD-20 printable customer-safe order summary, labelled "not an official receipt".
- ORD-22 duplicate/reorder, ANL-10 inquiry-conversion metric, PUB-08 quote prefill, GAL-04 publish-to-gallery, CEXP-05 CSV export.

**Defer (v2+):**
- ORD-21 roster/size breakdown (changes the item model).
- CUST-01/02 reusable customer + measurements, unless OD-7 chooses the entity.
- Customer status links, SMS/TOTP 2FA, the Android app.

**Anti-features (don't build):**
- Generating official receipts or invoices (BIR CAS / RR 7-2024 compliance risk).
- Meta Pixel or the Messenger chat plugin (the plugin was retired in 2024). Use `m.me` links.
- reCAPTCHA. Use honeypot + time-trap + rate limit.
- An embedded Google Maps iframe.
- An instant price calculator.
- A drag Kanban board.
- Real-time sync.

### Architecture Approach

Four `src/` projects: `Csps.Domain` (BCL only), `Csps.Application` (one handler per use case, ports, FluentValidation, manual mapping), `Csps.Infrastructure` (one `CspsDbContext` holding Identity + Data Protection keys + domain tables, interceptors, adapters) and `Csps.Server` (composition root, endpoint groups, transport, SPA host). Add `web/` (Vite building into `src/Csps.Server/wwwroot`) and `tools/Csps.LegacyMigration`. The UI-spec file paths (`@/ui`, `@/lib/csps`) are load-bearing and win over PRD §9.1 naming. `lib/csps.ts` is the single client formatter and math module.

**Major components and patterns:**
1. **Order aggregate.** Children are EF entities (not owned types), value objects are EF 10 complex types, and no `ToJson()`. **Persist a domain-computed totals snapshot** (`ItemsTotal/DiscountTotal/NetTotal/PaidTotal/Balance/ExpenseTotal`) with a DB CHECK constraint. That gives indexable sort/filter with no N+1, and it resolves the C-13 naming ambiguity. An **`AggregateRootTouchInterceptor`** forces a root UPDATE on any child change so the rowversion is checked. Discounts are a collection with `MaxDiscountsPerOrder`. `Order.Import(...)` is a lenient factory for legacy data.
2. **Order numbers.** A per-year counter table `OrderNumberCounters(Year, LastValue)` with `MERGE … WITH (HOLDLOCK)` inside the create transaction. The year comes from the business time zone. Legacy numbers are preserved, and counters are seeded from the legacy max.
3. **Auth.** The Application layer issues tokens and Server delivers them (cookie transport for web, body transport for future Android). Refresh cookie is `__Secure-csps_rt; Path=/api/v1/auth; SameSite=Strict`. A per-request `sid` session check (≤30 s cache) gives "immediate" revocation. Lockout, 2FA attempts and resend quotas live in the DB; in-memory rate limits are only the coarse layer. Web Locks single-flight on the client plus a 20–30 s server grace window. A `bootstrap-manager` CLI handles first-user creation.
4. **Authorization.** `FallbackPolicy` default-deny, separate anonymous/staff/manager endpoint groups, and **discovery-driven matrix tests**: every `/api` endpoint must have a matrix row, verified with real JWTs. Static assets and the SPA fallback need explicit `AllowAnonymous`. Unknown `/api/*` routes return a ProblemDetails 404, never `index.html`.
5. **Jobs.** No `BackgroundService`. Outbox work tables (for example `PendingImageDeletions`) are written in the business transaction. Leased, bounded, idempotent `POST /api/v1/maintenance/{job}` endpoints sit behind a secret-key scheme and are driven by GitHub Actions cron.
6. **SPA host.** It serves an `index.html` shaped per public route (title/OG/JSON-LD from SiteSettings via HybridCache), returns real 404s for unknown paths, and sends `noindex` for `/admin`.
7. **Test architecture.** One SQL fixture with two providers (`CSPS_TEST_SQL=localdb|container`): LocalDB `CSPS_Test_<guid>` locally, Testcontainers in CI on ubuntu. The email sink is compiled out of Release (`#if CSPS_TESTING` + environment guard + a reflection test on the production publish). Playwright runs the built E2E artifact on https://localhost:5199.
8. **Deploy.** Build and test on ubuntu, then Web Deploy from a Windows job with `-enableRule:AppOffline` and cleanup. Production gets reviewed idempotent migration scripts. Run `npm run build` before `dotnet publish` (the MapStaticAssets manifest).

### Critical Pitfalls

1. **₱0.01 rounding drift, client vs server** [measured: 8,203 disagreements for 2.5% and 6,117 for 7.5% across whole-peso totals ₱1–₱200k]. Avoid it with a shared golden-vector file (≥200 cases) consumed by both xUnit and Vitest, integer-centavo half-away-from-zero rounding on the client (a `// SPEC-DEVIATION` to `csps.ts`, **[OWNER DECISION]**), a pinned operation order, and showing server figures after every save.
2. **Root rowversion doesn't cover child edits.** Use the root-touch interceptor. Child endpoints require and return the order `rowVersion`. Write the two-context race test first.
3. **UTC "today".** Use `IBusinessCalendar` over `TimeProvider` with zone fallbacks (`Asia/Manila` → `Singapore Standard Time` → +08:00) and a `/health` check. Calendar facts are `DateOnly`. Run tests with `TZ=UTC` and Playwright `timezoneId: 'Asia/Manila'`, with fake clocks at Manila boundaries.
4. **Refresh-rotation false positives and cookie wiring.** `__Host-` with a non-root path is silently dropped by browsers. Use `__Secure-`. Use `AddIdentityCore` to avoid 302s to HTML. Set `MapInboundClaims=false`. Use Web Locks plus the grace window, and give every Playwright worker its own user.
5. **Email deliverability blocks sign-in.** Ask OD-12 before the Auth phase. In the Foundation spike, prove `spf/dkim/dmarc=pass` to Gmail. Never disable certificate validation. Send auth email through a DB outbox (this also gives timing parity against enumeration). Write a break-glass runbook.
6. **Verbatim UI-spec code breaks PRD gates.** Known breakages: `dangerouslySetInnerHTML` in `Mark`, a non-null `!`, a Modal with no focus trap, Tabs without ARIA wiring, unrevoked `blob:` previews, fonts inlined as `data:`, and a tsconfig looser than PRD §17.2. Plan an explicit "import + reconcile" task with `// SPEC-DEVIATION` markers and DOM-snapshot equality against the verbatim markup.
7. **Host engine/compat/collation drift and shared-hosting realities.** Do the hosting-verification spike first: `@@VERSION`, compat level, collation, runtime patch, client-IP topology, SMTP, scheduler, quotas. Set `UseCompatibilityLevel` explicitly. CI applies the idempotent script twice, and at the host compat level.
8. **Legacy traps.** Real data may violate invariants: multiple discounts, overpayments, >5 images, missing due dates, unknown statuses, local-time timestamps. Reconciliation can turn tautological (new vs new instead of legacy source vs new). Rollback has a point of no return. Restore only as `CSPS_Legacy_Restore` and compare source-side aggregates with zero unexplained centavos. Make the ETL idempotent, with a resumable image-mapping table. Time the rehearsal on a backup of comparable size.

## Consolidated New Conflicts & Decisions (surfaced by research; not in PROJECT.md's C-1…C-21 / OD-1…OD-14)

None of these is decided here. Items marked **[OWNER DECISION]** need an explicit ruling. The rest are recommended resolutions for the plan or discuss step to confirm.

| # | Topic | Conflict / finding | Research recommendation | Resolve in |
|---|---|---|---|---|
| **C-22** | tsconfig strictness | UI-spec D.7b sets `noUncheckedIndexedAccess: false` and lacks `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch` and `verbatimModuleSyntax`. PRD §17.2 requires all of them. Appendix D was never compiled or linted under the PRD settings | Compile and lint Appendix D verbatim *first*, report the delta, then apply minimal `// SPEC-DEVIATION` fixes with no DOM change | Phase 1 **[OWNER DECISION]** |
| C-23 | Refresh cookie prefix | PRD §8.1 asks for `__Host-` but also `Path=/api/v1/auth`. `__Host-` requires `Path=/`, so the browser silently drops it | `__Secure-csps_rt` (PRD's own fallback) | Auth phase (confirm) |
| C-24 | Order-number generator | PRD says SQL `SEQUENCE`. UI says per-year `ORD-YYYY-NNNN`. A SEQUENCE can't reset per year, and Respawn doesn't reset sequences | Per-year counter table with `MERGE HOLDLOCK`. Also decide which **year** applies: creation instant in Manila vs `OrderDate`. Extends C-15 | Orders domain phase **[OWNER DECISION]** |
| C-25 | Client rounding | UI-spec `round2` (verbatim, "never re-implement") vs PRD `AwayFromZero`. Measured drift | Change client `round2` to integer-centavo half-away-from-zero as a recorded deviation, plus golden vectors | Phase 1 (harness) / Orders **[OWNER DECISION]** |
| C-26 | Cloudinary authenticated delivery (OD-9 implication) | Authenticated assets allow **no on-the-fly transformations** (eager variants only), and signed URLs **don't expire** below the Advanced plan. A static gallery can't reuse authenticated order images | Present both options with these trade-offs. If authenticated: a fixed eager variant set, explicit `f_webp`, and server-signed URLs. Adding breakpoints later requires re-deriving images | Order images phase **[OWNER DECISION]** (OD-9) |
| C-27 | Private-repo security tooling cost | PRD §18 assumes CodeQL + secret scanning + dependency review. All three are paid on private repos | Public repo, buy GHAS, or accept the weaker substitute set | Phase 1 (before CI) **[OWNER DECISION]** |
| C-28 | Legacy restore name | CLAUDE.md says "restore the `.bak` into LocalDB as `CSPS_Dev`". PRD §16.1 says `CSPS_Legacy_Restore`. Restoring over `CSPS_Dev` overwrites the code-first dev DB and blurs Prime Directive 11 | Use `CSPS_Legacy_Restore` (still `CSPS_`-prefixed). Owner amends the CLAUDE.md line. Extends C-20 | Phase 1 (wording) + Legacy discovery **[OWNER DECISION]** |
| C-29 | Testcontainers ports vs CLAUDE.md | Testcontainers/Docker Desktop map to random host ports in 49152–65535, which CLAUDE.md says to avoid. Researchers differ: ARCHITECTURE says acceptable (no fixed listener); STACK and PITFALLS say pin a safe port (for example 5190) when run locally | CI on ubuntu is unaffected. Locally, default to LocalDB. If containers run locally, use one container per run with a fixed safe port checked by preflight, recorded as a CLAUDE.md-compatible exception | Phase 1 **[OWNER DECISION]** |
| C-30 | Dedicated LocalDB instance | The shared `MSSQLLocalDB` is also used by TheBETSLLC | Propose a `sqllocaldb create CSPS` instance, plus a cleanup regex guard `^CSPS_Test_[0-9a-f-]{36}$` | Phase 1 **[OWNER DECISION]** |
| C-31 | EF compat level / `json` type | STACK: `json` is GA in SQL 2025 at every compat level, so pin to the host's level. ARCHITECTURE: `json` is still preview, so pin `UseCompatibilityLevel(160)` and avoid `ToJson()`. Moving 160→170 later alters columns (one-way door) | Avoid JSON columns entirely. Pin compat explicitly once the host level is known | Phase 1 (hosting spike) |
| C-32 | Data Protection at-rest | `PersistKeysToDbContext` without a certificate stores keys unencrypted and logs a startup **warning**. That conflicts with zero-warnings and lets anyone with DB read forge tokens | `ProtectKeysWithCertificate` if a PFX is possible. Otherwise document risk acceptance and how the warning is treated | Phase 1 / Hardening **[OWNER DECISION]** |
| C-33 | HIBP fail mode | An HIBP outage leaves two choices: fail-open or fail-closed | Fail-open with an audit entry and a re-check, plus an embedded common-password floor | Auth phase **[OWNER DECISION]** |
| C-34 | iOS 14px input zoom | Four verbatim selectors set 14px text, which iOS zooms on focus. PRD requires ≥16px. CSS must stay byte-for-byte | Owner-approved `overrides.css`. Never use `maximum-scale=1` | Phase 1 (OD-14) **[OWNER DECISION]** |
| C-35 | A11y in the approved design (extends OD-14/C-16) | Inactive user rows at 72% opacity reach 3.69:1. Orange `--accent` is the only state indicator at 2.29:1 (fails 1.4.11). Lightbox prev/next are hidden on phones. Hover actions use `opacity:0` but stay focusable. Danger toasts auto-dismiss | Raise this exact list at the first UI discuss step | Phase 1 **[OWNER DECISION]** |
| C-36 | Inquiry form scope (extends C-12) | Persistence, the admin inbox, the notification address, visibility (Admin+Manager vs Manager), retention, attachment storage, and whether to accept PDF/AI at all (CWE-434) | Persist first, then notify. Pitfalls recommends images only (re-encoded through Cloudinary) this milestone | Public site phase **[OWNER DECISION]** |
| C-37 | Refund / cancelled-with-downpayment | Neither document models refunds. "Collected" overstates cash | At minimum a decided policy: a negative refund payment or a forfeiture flag. Ties to OD-4 | Orders domain phase **[OWNER DECISION]** |
| C-38 | Overpayment via non-payment edits | OD-4 is usually framed per payment. Balance also goes negative when an item is removed or a discount added after payment | Aggregate-level invariant across all mutation types, plus a block-or-flag UI rule | Orders domain phase **[OWNER DECISION]** (with OD-4) |
| C-39 | Status transitions + history | OD-3 lists statuses without transitions. The audit log covers deletions only | Forward/back among active statuses; Cancelled from any active status; terminal states reopen by Manager only. An `OrderStatusChange` history | Orders domain phase **[OWNER DECISION]** (OD-3) |
| C-40 | Dashboard metric definitions | Undefined: "due this week" (Mon–Sun?), "same day last month" on month-end days, whether cancelled orders appear in "Orders by status", Receivables including overdue | Define these in the dashboard discuss step | Dashboard phase **[OWNER DECISION]** |
| C-41 | User delete semantics | UI copy promises "records stay, under their name" | Users are soft-deleted (scramble email, block sign-in, keep the name) | Profile/users phase (confirm) |
| C-42 | Early read-only legacy fit check | The PRD puts discovery last. Real data may break invariants after hardening | Optionally ask whether a *read-only* fit check after Orders domain is acceptable. It must not derive the schema | Orders domain phase **[OWNER DECISION]** |
| C-43 | Payment methods / expense categories fit | No cheque payment method. No SSS/PhilHealth/Pag-IBIG/BIR expense category (LOW confidence) | Raise under OD-8 | Orders / Expenses phases **[OWNER DECISION]** |
| C-44 | "Recorded by" on deleted users, and `OrderItem` → price-item FK | The PRD links OrderItem to a price-list item, which would make Orders depend on the content phase | Fixed `ProductType` enum on items; drop or defer the FK | Orders domain phase |
| C-45 | Owner prerequisites | The GitHub remote, SmarterASP credentials and a sender domain with DNS access are all on the critical path | Ask before Phase 1's CI/deploy plan and before Auth | Before Phase 1 / Phase 2 **[OWNER DECISION]** |

## Implications for Roadmap

### Reconciliation: PRD §20 (12 phases) vs research corrections

| PRD §20 phase | Research correction | Result |
|---|---|---|
| 1 Foundation | Too big, and it's blocked by owner prerequisites. Split it. Move in SiteSettings core, the AuditLog table/port/trigger, the authz-matrix harness, golden-vector money tests, bundle budgets plus Lighthouse CI, the E2E host and the OpenAPI→TS pipeline. Make the hosting spike first and the staging deploy a separately gated last plan | Phases 1a / 1b / 1c |
| 2 Identity & auth | Add the set-password-by-token flow (shared by reset and invite acceptance), the `bootstrap-manager` CLI, the compiled-out email sink and the auth email outbox. The audit log already exists from Phase 1 | Phase 2 |
| 3 Profile & users | Add the Manager audit-log viewer (AUDIT-02) and USER-07 | Phase 3 |
| 6 Company expenses | Move it before Orders as the pattern-proving CRUD slice. Recommended, not required: if the owner prefers Orders first, Orders becomes the pattern-setter | Phase 4 |
| 4 Orders | Split into domain+API and UI. The form ships without the Images card | Phases 5, 6 |
| 5 Order images | Add the maintenance job framework (lease, key scheme, cron workflow). Register the auth purges here | Phase 7 |
| — (missing) | The Admin dashboard (C-18) needs orders, payments, order expenses and company expenses. Until it ships, `/admin` redirects to Orders | Phase 8 (new) |
| 7 Public site & content | Order inside the phase: content model → seeded read API → public pages → management UI. Add server-shaped `index.html` (PUB-04), gallery management, holidays and the inquiry feature if approved | Phase 9 |
| 8 Consent/analytics/legal | Unchanged. Adds the metrics dashboard and the inquiry-conversion metric | Phase 10 |
| 9 Hardening | Budgets are no longer introduced here (they're enforced from Phase 1); this phase only audits them. Add PWA + View Transitions here (the service worker affects deploy freshness, so it's tested last) | Phase 11 |
| 10–12 Legacy + cutover | Order stays per Prime Directive 11. De-risked by `Order.Import` and configurable rule constants from Phase 5 | Phases 12–14 |

### Suggested phase structure (14 phases, Fine granularity; 1 split into 1a/1b/1c)

### Phase 1a: Hosting verification + backend foundation
**Rationale:** Every later phase depends on the strict build, the layers and the unknown host facts. The hosting spike retires the largest LOW-confidence area first.
**Delivers:**
- Hosting spike record: runtime patch, `@@VERSION`, compat level, collation, client-IP topology, SMTP→Gmail `spf/dkim/dmarc`, scheduler, quotas, staging-site option.
- `Csps.slnx` onion skeleton, `global.json` (MTP runner), central packages, `.editorconfig` with migrations treated as `generated_code`, BannedSymbols, architecture tests (S-3).
- `IBusinessCalendar`/`TimeProvider`.
- SiteSettings core entity + seed + read port.
- AuditLog table, `IAuditTrail` and the append-only trigger (wrapped in `EXEC`).
- Initial migration, with the idempotent script tested twice.
- ProblemDetails, the `/api` 404 fallback, security headers/CSP (production only), Serilog file sink, `/health` (with the zone check).
- Endpoint-group conventions plus an empty discovery-driven authz-matrix harness.
- The dual-provider SQL fixture (LocalDB/container).
**Addresses:** foundation requirements, OD-1, OD-2, OD-13.
**Avoids:** Pitfalls 6, 7, 8, 16, 17, 21. Resolves S-1…S-11, C-22 (partial), C-27, C-29, C-30, C-31, C-32.

### Phase 1b: Web foundation + design-system import/reconcile
**Rationale:** Verbatim UI-spec code conflicts with PRD gates (Pitfall 13, C-22). Find and fix that once, before any screen work.
**Delivers:**
- Vite 5180 `strictPort` with a hard-coded proxy, building into `wwwroot`.
- TS alias pair, ESLint 10 + jsx-a11y-x.
- Appendix A–D copied verbatim, then reconciled with `// SPEC-DEVIATION` markers and DOM-snapshot tests: focus trap, Tabs ARIA, `Mark` as JSX, blob revocation, no font inlining.
- `lib/http` at 100% coverage, `api.ts`, layouts, skeleton/LoadingRegion.
- The **golden-vector money harness**, shared with Domain tests.
- The budget script plus Lighthouse CI.
- Playwright on 5199 with a smoke test, CSP-violation listener and console-fail fixture; preflight wired into the scripts.
**Avoids:** Pitfalls 1, 13, 14, 22, 23. Resolves C-22, C-25 (harness), C-34, C-35, C-10, C-11.

### Phase 1c: CI + staging deploy (owner-gated)
**Rationale:** It needs the GitHub remote, secrets and host credentials. Isolating it keeps 1a/1b unblocked.
**Delivers:** SHA-pinned CI on ubuntu, a Windows Web Deploy job with AppOffline cleanup, environment-protected secrets, a staging smoke test (including the `/api/nope` ProblemDetails check through IIS), and the Dependabot cooldown.
**Avoids:** Pitfalls 16, 24.

### Phase 2: Identity & authentication
**Rationale:** Every endpoint needs policies and real sessions. Email is the earliest hard dependency.
**Delivers:**
- AUTH-01..10.
- Session families with grace-window rotation and reuse detection.
- `__Secure-` cookies (C-23).
- Per-request `sid` check.
- Persisted lockout, attempt and resend counters.
- A per-account cross-ticket 2FA cap.
- Dummy-hash timing parity.
- The auth email outbox.
- HIBP with a decided fail mode (C-33).
- The shared set-password-by-token flow plus the `bootstrap-manager` CLI.
- The compiled-out email sink with a Release reflection test.
- The single-input OTP (`autocomplete="one-time-code"`).
**Must ask first:** OD-12, C-4, C-5, C-6, C-7, C-8, C-19.
**Avoids:** Pitfalls 9, 10, 11, 12, 21, M7, M8.

### Phase 3: Profile & user management
**Delivers:** PROF-01..03 (C-9 confirm-new/notify-old), USER-01..07, last-Manager guard (race-safe, M11), immediate revocation, soft-delete users (C-41), AUDIT-02 viewer, PROF-04 theme toggle.
**Avoids:** M9, M10, M11.

### Phase 4: Company expenses (pattern-proving slice)
**Rationale:** The simplest aggregate. It proves rowversion/409, filters, period totals, Manila month boundaries, query-count tests and the ConfirmDialog before the complex aggregate.
**Delivers:** CEXP-01..04. **Decide:** OD-5 (for expenses), OD-8, C-43.

### Phase 5: Orders — domain & API
**Rationale:** This is the Core Value, so every domain ruling must be settled before the first test.
**Delivers:**
- The aggregate with persisted totals snapshot and CHECK constraint.
- The root-touch interceptor and two-context race tests.
- The per-year counter table (C-24) with a 20-parallel-create test and a Manila New Year test.
- Discounts as a collection, with Σ ≤ items total.
- An aggregate-level overpayment invariant (C-38).
- The transition table and status history (C-39).
- Refund policy (C-37).
- A superset create endpoint (C-3).
- Unambiguous DTO names (C-13).
- `Order.Import(...)`.
- IDOR-safe nested routes.
- `decimal`/percent precision conventions.
- The ≤2-query list test.
- SPIKE: EF 10 `Sum`/`OrderBy` over complex-type `Money`.
**Must ask first:** C-1, C-3, C-13, C-14, C-15/C-24, C-25, OD-3, OD-4, OD-5, OD-6, OD-7, C-37, C-38, C-39, C-42, C-44.
**Avoids:** Pitfalls 1–5, M2, M3, M5, M6.

### Phase 6: Orders — UI
**Delivers:** ORD-01/02/07/10/11/12/15 screens; the form without the Images card; detail tabs and modals; `rowVersion` refreshed from every child response; 409 handling that preserves input; server figures in toasts.

### Phase 7: Order images + job framework
**Delivers:** ORD-04, server signed upload, magic-byte sniffing, client downscale, accessible reorder/cover (C-16), the `PendingImageDeletions` outbox, the leased maintenance endpoint plus the cron workflow, auth purges registered, a weekly orphan sweep, and the Images card added to the form.
**Must ask first:** OD-9/C-26, C-2.
**Avoids:** M1, M12, M13, m6.

### Phase 8: Admin dashboard (new)
**Delivers:** DASH-01..06 with a lazy SVG chart. **Must ask first:** C-40.

### Phase 9: Public site & content management
**Delivers:**
- The content model (C-21; hybrid `ProductLine` recommended), then a seeded read API, then the public pages, then the management UI.
- CONT-01..05 including holidays.
- Server-shaped `index.html` with OG/JSON-LD and real 404s.
- "Open now", Messenger/phone CTAs, the gallery plus GAL-03 management, the lightbox with visible buttons.
- INQ-01..08 if approved (C-36).
- HybridCache invalidation on edit.
- Contact page within the 150 KB budget (lazy form stack, maybe `zod/mini`).
**Avoids:** Pitfall 22, M16, M18.

### Phase 10: Consent, analytics & legal
**Delivers:** ANL-01..09 (GPC, equal-prominence buttons, nothing before consent), ANL-10, LEGAL-01..05 marked DRAFT. **Must ask first:** OD-10, OD-11. **Avoids:** M14, M15.

### Phase 11: Hardening
**Delivers:** the CWE/ATT&CK review, ZAP baseline, manual NVDA/VoiceOver plus 1.4.11 checks, a budget audit, backup/restore test, runbooks (break-glass mail, lockout, breach 72 h), PWA (prompt registration, `/api` denylist, `no-store`) and View Transitions. **Avoids:** Pitfalls 14, 15, M20.

### Phase 12: Legacy discovery & mapping
**Delivers:** restore as `CSPS_Legacy_Restore` (C-28) with a prefix guard; `LEGACY-SCHEMA.md` with anomaly counts; an owner-approved `LEGACY-MAPPING.md` (revisit C-1, C-2, C-14, C-15, OD-3, OD-4, OD-7). **Avoids:** Pitfall 18.

### Phase 13: Legacy import
**Delivers:** an idempotent ETL through the domain factories, `--dry-run`, a resumable image mapping, counter seeding, a source-vs-target reconciliation with zero unexplained centavos, and a timed dress rehearsal. **Avoids:** Pitfall 19.

### Phase 14: Production cutover
**Delivers:** a runbook with a point of no return, a pre-issued TLS certificate (HSTS enabled after verification), production DNS SPF/DKIM, legacy behind `app_offline.htm` only at cutover with the owner present, and the option of local ETL → `.bak` restore on the host. **Avoids:** Pitfall 20.

### Phase Ordering Rationale

- Dependencies drive the order. Email, audit and SiteSettings are needed by nearly everything, so they come early. Auth comes before every protected slice. Expenses and Orders come before the Dashboard. The content model comes before the public pages. Everything else comes before Hardening, and the legacy phases come last.
- **Parallelization:** after Phase 3, Phases 4, 5 and the Phase 9 content model are mutually independent. Phases 9–10 need only the Manager policy plus SiteSettings core.
- **Decision calendar:** the roadmap should list which OD and C items each discuss step must close. Security rulings (C-4, C-5, C-8, C-9, C-19, OD-12) should be sent *before* Phase 2 starts. The Orders rulings must close before Phase 5's first test.

### Research Flags

Phases likely needing `/gsd-plan-phase --research-phase`:
- **Phase 1a:** host facts are unknown (LOW), EF compat/`json` sources contradict each other (C-31), and the MapStaticAssets cache headers and `AllowAnonymous` behaviour need a spike.
- **Phase 1b:** the TS 7 alias setup, React Compiler vs verbatim code, the CSP behaviour of JSON-LD data blocks, and the public bundle budget with a monolithic `ui/index.tsx`.
- **Phase 2:** `__Secure-` cookies over the Vite HTTPS proxy and Playwright WebKit (SPIKE), grace-window design, timing-parity tests.
- **Phase 5:** EF 10 complex-type `Money` translation (SPIKE), counter-table locking under the execution strategy.
- **Phase 7:** Cloudinary authenticated vs public delivery, eager variants, signed-URL caching.
- **Phase 9:** Facebook scraper behaviour (LOW–MEDIUM, from training knowledge), inquiry attachment security if PDF/AI is accepted.
- **Phases 12–14:** the legacy schema is unknown by design, and `.bak` restore on the host is unverified (LOW).

Phases with standard patterns (research can be skipped): **3** (Profile/users), **4** (Company expenses), **6** (Orders UI, once 5 is set), **8** (Dashboard, once definitions are set), **10** (Consent/analytics: PRD plus NPC guidance already detailed), **11** (Hardening: checklist-driven).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions, peers and licenses were read directly from npm/NuGet/MCR/GitHub today. Behaviour claims are MEDIUM. Hosting is LOW |
| Features | MEDIUM | Classification from PRD/UI spec is HIGH. Competitor and PH regulatory norms are MEDIUM (web, cross-checked). PH shop-practice claims are LOW |
| Architecture | MEDIUM | First-party docs, though the seam rated webfetch LOW. Several design points are marked SPIKE. Design recommendations are opinion |
| Pitfalls | MEDIUM–HIGH | Rounding drift, contrast, CSS sizes and LocalDB/Docker versions were **measured** on this machine (HIGH). SmarterASP.NET claims are LOW |

**Overall confidence:** MEDIUM

### Gaps to Address

- **SmarterASP.NET operational facts.** Runtime patch, in-process hosting, staging-site option, env-var/secret mechanism, compat level, collation, a second SQL login, proxy/client IP, scheduler availability, plan tier (Advance is the floor for staging + production), and `.bak` restore support. All of these come from the Phase 1a spike.
- **SQL `json` GA vs preview.** The researchers contradict each other. Avoid JSON columns and pin compat explicitly.
- **Testcontainers port handling locally.** The researchers disagree (C-29). Decide in Phase 1a.
- **Facebook link-scraper JS behaviour.** From training knowledge only. Verify in Phase 9 research. PUB-04 design assumes no JS.
- **React `style={{}}` under `style-src 'self'`.** Assumed safe via CSSOM. Prove it with a Playwright CSP test.
- **Barlow Condensed ₱ glyph coverage.** Verify with `document.fonts.check`.
- **The legacy data shape.** Unknown by design until Phase 12. Lenient `Order.Import` and constants-not-schema rules hedge against it.
- **BIR/DPA compliance claims.** The owner's accountant and lawyer should confirm (OD-11).

## Sources

### Primary (HIGH confidence)
- `CSPS-PRD.md`, `CSPS-UI-SPEC.md` (prose + Appendices A–E), `.planning/PROJECT.md` (OD-1…14, C-1…21).
- npm registry, NuGet v3 API (including license files inside packages), MCR tag list, `builds.dotnet.microsoft.com` release metadata, GitHub Releases API, all read 2026-10-06.
- Local measurements: `sqllocaldb versions` (17.0.4025.3), `docker version` (29.8.1 linux), round2-vs-AwayFromZero sweep, gzip sizes, WCAG contrast from tokens, greps of Appendix D.

### Secondary (MEDIUM confidence)
- learn.microsoft.com: EF Core 10 what's new/breaking changes, concurrency, SQL Server provider, ASP.NET Core 10 release notes, static files/MapStaticAssets, antiforgery, Data Protection key storage, SQL `json` type.
- TypeScript 7.0 announcement, React Compiler docs, vite-plugin-react README, ESLint version support, xUnit v3 4.0 notes, coverlet.MTP docs, MSW v3, Vitest 5, React Router v8 changelog.
- Cloudinary access-control docs (authenticated = eager only; signed URLs non-expiring below Advanced).
- MDN Set-Cookie prefixes; Google sender guidelines; efcore #12911/#29530; Respawn README.
- Printavo/YoPrint/team-roster/tailoring tool feature pages; NPC Circular 2023-04; BIR RR 7-2024 commentary; Messenger plugin retirement.

### Tertiary (LOW confidence)
- SmarterASP.NET marketing and plan pages, plus aggregator sites (.NET 10, SQL 2025, plan limits).
- GitHub GHAS pricing for private repos (web).
- Facebook scraper no-JS behaviour (training knowledge).
- PH shop-practice assumptions (discount stacking, cheque payments, gov-contribution expense categories).

---
*Research completed: 2026-10-06*
*Ready for roadmap: yes*

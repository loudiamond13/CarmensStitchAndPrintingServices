# Phase 12: Consent, Analytics & Legal - Research

*Created: 2026-11-15T21:55:00-06:00 · Updated: 2026-11-15T21:55:00-06:00*

**Researched:** 2026-11-15
**Domain:** first-party consent management, privacy-safe visitor analytics (ASP.NET Core 10 + EF Core 10 + React 19), maintenance-job retention, versioned legal pages (RA 10173)
**Confidence:** HIGH for the codebase seams and the stack; MEDIUM for browser behaviour details; LOW for legal interpretation (owner approves the text, D-09)

## Summary

Phase 12 needs **no new server package and at most one new web package** (`web-vitals` 6.2.3, owner approval required). Every hard part already has a seam in the repo: the maintenance runner (`IMaintenanceJob`, `PurgeExpiredRecordsJob`, `IMaintenanceCursors`) for rollup and purge; `IpPrefix` and `UserAgentFamily` in `Csps.Domain/Auditing`, which their own doc comments say "visitor analytics use the same rule"; the per-address rate limiter; the `X-CSPS-CSRF` header check; the idempotency allow-list (SEC-06 already names analytics beacons as exempt); `PublicRouteTable` / `PublicPageHeads` / the sitemap for the legal routes; `dateRangeParsers` and the Audit Log range pattern for the stats page; and `IncomeExpenseChart` for the trend chart.

Five findings change the plan's shape and must not be missed. (1) **The site JSON is embedded as boot data in every page** (`ShellPage.cs` line 287, `PublicHeadWriter.BootData`), so adding the shop email to `PublicSiteDto` would put it in every page's HTML and break D-29. The email needs its own small public read that only the four legal pages call. (2) **`httpClient` rejects any non-JSON answer** (`httpClient.ts` toHttpResponse, LIB-WR-05), so the CSV export needs either an opt-in text mode in `core/api/http` or a JSON wrapper, and `Response.text()` strips the UTF-8 byte-order mark (verified below), so the client must add it back. (3) **The auth cookies are scoped to `/api/v1/auth`**, so a collect endpoint cannot see whether the browser is signed in to admin (D-21). Recommended: a small HttpOnly "staff" marker cookie set and cleared with the refresh cookie. (4) **The maintenance run is monthly** (D-21 of Phase 9, `cron: "17 19 1 * *"`), so a "13 months" purge really keeps data up to about 14 months. That is an owner question. (5) **Safari caps cookies written by JavaScript to 7 days**, so the consent and visitor-id cookies must be set by the server with `Set-Cookie`. Otherwise iPhone visitors are re-asked every week.

**Primary recommendation:** Store every public page view as an anonymous `(business day, page key)` counter for everyone, plus identified raw rows (`Visit`, `PageView`, `VitalSample`) only behind a server-issued HttpOnly visitor-id cookie that exists only after a logged consent decision. Roll up referrer and device counts eagerly for every closed day in the maintenance run, and purge the raw rows at 13 months. Read the stats page from raw rows for days inside 13 months and from the daily tables before that.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All rulings below: owner, 2026-11-15, in this discussion. They close OD-10 and OD-11 and the Phase 12 part of C-17.

#### Data retention (OD-10: closed)
- **D-01:** **Orders, payments, discounts, order expenses and company expenses are kept forever.** No automatic deletion. Manual deletes stay as they are today. The Privacy Policy states this and the reason: bookkeeping and tax records.
- **D-02:** **Quote inquiries that never became an order, and their attachments, are purged 6 months after they were received** (INQ-07, Phase 13). Phase 12 only records the rule and the Privacy Policy wording. Phase 13 builds the purge job. **Reversibility:** one-way. Purged inquiries cannot be brought back.
- **D-03:** **Raw analytics events (visits, sessions, page views, Web Vitals) are kept 13 months**, then rolled into daily counts and purged (ANL-09). **Reversibility:** one-way. Once purged, unique visitors and sessions for that period cannot be recounted.
- **D-04:** **The anonymous daily counts are deleted after 3 years.** They hold no visitor id. **Reversibility:** one-way.
- **D-05:** **Consent records are kept 13 months** (a choice lasts 12 months, plus 1 month of margin), then purged.
- **D-06:** **The audit log stays at 8 months (D-32), unchanged.** PROJECT.md's OD-10 row ("audit log 2 yr") is out of date and gets corrected to point at D-32 and this ruling.
- **D-07:** **All purges run as maintenance jobs** through the Phase 9 maintenance endpoint called by GitHub Actions. They are not SQL triggers (OR-7), and their retention periods are named constants with tests, like `PurgeExpiredRecordsJob`.

#### Legal pages and text (OD-11: closed)
- **D-08:** **Jurisdiction: the Philippines only.** The text is drafted for the Data Privacy Act of 2012 (RA 10173) and NPC rules. The Terms also consider the Consumer Act (RA 7394) and the Internet Transactions Act of 2023 (RA 11967).
- **D-09:** **The owner reviews and approves the text.** A lawyer review is optional and can come later: it is parked in the backlog. The owner asked what kind of lawyer: a Philippine data privacy / ICT lawyer for a one-time document review, found through an IBP chapter referral, with the free NPC guides to compare against. That is general information, not legal advice. A paid lawyer is the owner's choice and not required by this phase.
- **D-10:** **The legal text lives in the site's code** (in the web app, per page, with a version number and a last-updated date). It changes only through a reviewed release. There is no admin editor. **Reversibility:** costly. Moving to Manager-editable text later needs tables, an editor screen, history and a publish flow.
- **D-11:** **The controller is named from site settings:** the business name and the address parts already in `PublicSiteDto` (Phase 11), so the pages update when a Manager changes them. There are no hard-coded name or address values and no placeholders.
- **D-12:** **The Data Protection Officer is named by role:** "The owner, Data Protection Officer". There is no personal name on the public page.
- **D-13:** **Privacy requests go to the Contact page email from site settings.** There is no separate privacy mailbox.
- **D-14:** **DRAFT is shown as a notice box at the top of each legal page** ("Draft: this text is not final yet"), above the title, with the version and last-updated date. Each page has its own approved flag in code. The notice is removed per page when the owner approves that page. The owner's approval of each page is a manual check (parked in the backlog if the owner is away).
- **D-15:** **The Privacy Policy covers** the controller, the purposes (orders, quote inquiries, visitor stats, staff accounts), the retention rules D-01 to D-06, the visitor's rights under RA 10173, the NPC complaint route and the contact (D-13). It also covers the "Customer said OK to show" rule for public order photos (Phase 11 D-11).

#### Cookie banner and consent (C-17: spec-gap screens)
- **D-16:** **First visit: a bar along the bottom of the screen.** The page stays visible and scrollable. Accept all and Reject all have the same size and weight. Customize opens the preferences. The bar links to the Cookie Policy. It is a `// SPEC-GAP:` screen composed from existing patterns.
- **D-17:** **Three categories:** Necessary (always on, not switchable), Visitor stats (analytics and Web Vitals), and Google map (the Contact page embed, D-20 of Phase 11). Accept all turns both optional ones on and Reject all turns both off.
- **D-18:** **A "Show map" tap without map consent loads the map for that view only**, then shows a small "Always show maps?" link. Choosing it saves map consent as a logged consent decision (ANL-07).
- **D-19:** **"Clear my cookies & data" is in the cookie settings panel** (opened from the footer "Cookie settings" link). It asks to confirm, then shows a success message. It does what ANL-04 says: expires non-essential cookies (server-side for HttpOnly ones), clears local and session storage, and deletes the server-side analytics tied to the visitor id.
- **D-20:** **GPC: no banner and visitor stats off.** The site respects the signal and doesn't ask. Cookie settings shows "Your browser asked us not to track you", keeps visitor stats off, and still lets the visitor allow the Google map. The GPC flag is stored on the consent record (PRD §5.4).
- **D-21:** **Visits from a browser signed in to admin are not counted** in the stats, not even as anonymous counts.
- **D-22:** **The cookie policy version changes only with a reviewed release**, bumped in code together with the Cookie Policy text. Every visitor is asked again after that release (ANL-07). There is no admin "ask everyone again" button.

#### Visitor stats page (C-17: spec-gap screen)
- **D-23:** **"Visitor stats" is its own admin page with its own menu item, for Managers only.** It is not on the dashboard. Admin users are denied, and the authorization-matrix test covers it.
- **D-24:** **It opens on the last 30 days.** Presets: Last 7 days, Last 30 days, This month, Last month, This year, plus custom dates. The range is in the URL (WEB-10), and days follow the business calendar (`Asia/Manila`, `IBusinessCalendar`).
- **D-25:** **The CSV export is one row per day:** date, unique visitors, sessions, page views. A day with no data shows zeros. (Wording amended by D-33: "Visits" instead of "sessions".)
- **D-26:** **Web Vitals are shown in plain words with a color and an icon:** "Loading speed" (LCP), "Layout shifting" (CLS), "Response to taps" (INP), each rated Good, Needs work or Poor by Google's thresholds, with the number in small text. Color is never the only signal (WCAG).
- **D-27:** **Ranges older than 13 months:** page views, top pages and the device/browser split come from the daily counts. Unique visitors and sessions show "Not available for dates over 13 months ago" (an `EmptyValue`-style marker, not a dash, OR-4). A range that crosses the 13-month line says which part is partial.
- **D-28:** **Referrers are grouped into friendly names** for known sites: Facebook (m., l., lm., www.facebook.com), Messenger, Instagram and Google. Other referrers show their host. Visits with no referrer are listed as "Direct". The grouping happens when the referrer is stored, so the daily counts use the same names.

#### UI-SPEC rulings (owner, 2026-11-15, answered in chat; 12-UI-SPEC OQ-1 to OQ-5 and two copy items)
- **D-29:** **The privacy contact email shows on the four legal pages only** (Privacy Policy, Cookie Policy, Terms of Use, Accessibility Statement), as an "Email:" link. It stays off the footer, Contact, JSON-LD and every other public page. This is a narrow exception to Phase 11 D-25, which otherwise stands. (OQ-1 A, owner, 2026-11-15)
- **D-30:** **On the Contact page on phones, the Messenger and Call bar is hidden until the visitor answers the cookie bar**, then it comes back. Only one bar sits at the bottom at a time. (OQ-2 A, owner, 2026-11-15)
- **D-31:** **"Clear my cookies & data" resets the saved choice to visitor stats off and map off**, logged as a new decision. The cookie bar does not ask again. (OQ-3 A, owner, 2026-11-15)
- **D-32:** **Three icons are added to `icons.ts` from the installed lucide-react 1.53.0:** `chart-column` (Visitor Stats menu item), `circle-x` ("Poor" speed rating) and `download` (Export CSV). No new package. (OQ-4 A, owner, 2026-11-15)
- **D-33:** **"Visits" replaces "Sessions"** on the Visitor Stats page and in the CSV header (`Date,Unique visitors,Visits,Page views`). This amends the wording of D-25. (OQ-5 A, owner, 2026-11-15)
- **D-34:** **The cookie bar's third button is "Cookie Settings"** (not "Customize"), the same name as the settings window and the footer button. (owner, 2026-11-15, on the UI checker's advice)
- **D-35:** **The "Clear your cookies and data?" dialog's dismiss button is "Keep My Data"**, for this dialog only; the shared ConfirmDialog default "Cancel" stays. (owner, 2026-11-15)

### Claude's Discretion
- How consent is stored in the browser (a first-party necessary cookie is expected), cookie names, and the consent record and analytics table design, within PRD §5.4, "no JSON columns" and the 256 MB host limits.
- How the visitor id, session timeout and IP truncation plus rotating-salt HMAC (ANL-05) are built. IPs are cut to /24 and /48 first, as in D-32.
- The collect endpoint's shape, rate limits and bot filtering. The beacon path cut at `?` and `#` is server-side as ANL-05 says.
- When the daily rollup runs and how it handles days still in progress.
- The legal page routes and their footer order, and the plain-English wording of the drafts.
- The trend chart, built by reusing or extending `IncomeExpenseChart` (hand-rolled SVG).

### Deferred Ideas (OUT OF SCOPE)
- **Lawyer review of the legal text** (optional, owner's choice, paid): backlog item. The DRAFT notice comes off on the owner's own approval (D-09, D-14).
- **Manager-editable legal text** in admin: not now (D-10).
- **A visitor-stats card on the Manager dashboard:** not chosen (D-23). It could be added later.
- **An admin "ask everyone again" consent button:** not chosen (D-22).

**Also binding:** `12-UI-SPEC.md` (approved 2026-11-15) fixes every screen, string, route (`/privacy`, `/cookies`, `/terms`, `/accessibility`, `/admin/visitor-stats`), the CSV header and filename, the speed thresholds, the validation messages and the lazy-chunk split. This research does not reopen any of it.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANL-01 | Consent bar with equal Accept all / Reject all and a third button (Cookie Settings, D-34); nothing non-essential before a choice | § Consent mechanics (cookie design, "pending landing view"), § Pattern 2, Pitfall 5 (Safari cap), Pitfall 9 (E2E fixture) |
| ANL-02 | GPC honored as "reject analytics" | § GPC (both `navigator.globalPrivacyControl` and `Sec-GPC: 1`, enforced server-side too) |
| ANL-03 | Footer "Cookie settings" reopens preferences | UI-SPEC FT; § Architecture (lazy CS1 chunk) |
| ANL-04 | Clear my cookies & data: server-side HttpOnly expiry, local/session storage, server analytics for the visitor id | § Pattern 4 (Clear flow), Pitfall 6 (do not use `Clear-Site-Data`), Security (IDOR) |
| ANL-05 | Visitor id cookie (12 months max), sessions, page views, referrer host, device/browser/OS family; IP truncated then HMAC'd with a rotating salt; CWV only with consent; path = pathname only, server cuts at `?`/`#` | § Schema, § Pattern 3 (collect pipeline), reuse `IpPrefix` and `UserAgentFamily`, § Daily salt |
| ANL-06 | Without consent only anonymous (path + day) counts | § Schema `DailyPageCounts`, Pattern 3 |
| ANL-07 | Re-ask on policy version change or after 12 months; every decision logged | § Consent cookie codec, `ConsentRecords` table, shared `legal-pages.json` fixture |
| ANL-08 | Manager metrics dashboard with date range in URL and CSV export | § Pattern 5 (stats read), Pitfall 2 (httpClient JSON only), Pitfall 3 (BOM), CSV safety |
| ANL-09 | Raw events 13 months, then aggregated and purged | § Pattern 6 (`AnalyticsRetentionJob`), Open Question 1 (monthly run lag) |
| LEGAL-01 | Privacy Policy (controller, purposes, retention, rights, contact) for PH | § Legal content (RA 10173 points), Pitfall 1 (email not in boot data) |
| LEGAL-02 | Versioned Cookie Policy linked from the bar | § Cookie inventory; Cookie Policy `version` = consent policy version (D-22) |
| LEGAL-03 | Terms of Use | § Legal content (RA 7394, RA 11967), no business promises |
| LEGAL-04 | Accessibility Statement with contact method | § Legal content; LegalFacts contact lines |
| LEGAL-05 | Footer links, versioned, last-updated dates, DRAFT until approved | § Pattern 7 (legal metadata shared by server and web through a fixture), noindex and sitemap |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Binding directives the planner must verify against (root `CLAUDE.md`, `.claude/CLAUDE.md`, owner global rules):

- **Shared machine:** ports 5180, 5115/7028, 5116/7029, 5199 only; never 5173/5023/5099; never 49152-65535. Run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` before dev servers, Playwright or full test runs. Never touch `BetsLLC_*` databases or another project's processes.
- **LocalDB:** `(localdb)\MSSQLLocalDB`, `CSPS_*` databases only; tests pick the backend from `CSPS_TEST_SQL=localdb|container` set per process. No Docker locally.
- **Free only; licenses** MIT, Apache-2.0, BSD, ISC plus named exceptions. Never GPL/AGPL/SSPL/commercial. New dependencies need purpose, license, maintenance and a legitimacy check in RESEARCH.md, a 14-day release cool-down, and the owner's yes before install.
- **Forbidden:** axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit, `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, SpaProxy, Serilog DB sinks.
- **Architecture:** Onion (Domain ← Application ← Infrastructure ← Server, ArchUnitNET); no mediator, one handler per use case, manual mapping; `Result<T>` to RFC 9457 ProblemDetails; one `[ApiController]` per resource under `/api/v1`, thin actions; default-deny with explicit `[Authorize(Policy = ...)]` or `[AllowAnonymous]` on every action; `SuppressModelStateInvalidFilter` (FluentValidation in handlers).
- **Data:** UTC storage plus `TimeProvider` / `IBusinessCalendar`, never `DateTime.Now`. EF migrations only, Fluent config only. **No JSON columns. No SQL triggers (OR-7)** beyond `TR_AuditLog_AppendOnly`. **No inline SQL** in application code: LINQ, `ExecuteUpdate`, `ExecuteDelete` only. Drops, renames and lossy changes need the owner first. Production gets the CI-built idempotent script (`ci.yml` line 296: `dotnet ef migrations script --idempotent ...`); never `Database.Migrate()` at startup.
- **Quality:** TDD (red, green, refactor); zero warnings in build, analyzers, lint, types, tests and the browser console; coverage Domain 100%, Application 95% or more, `core/api` 100%, web 90% or more; authorization matrix covers every endpoint for {anonymous, Admin, Manager}.
- **Security:** CWE Top 25 drives the security review; strict CSP with no `unsafe-inline`/`unsafe-eval`; append-only audit log; no secrets or real data in git (repo is public).
- **A11y:** WCAG 2.2 AA, zero axe violations at component and page level. **Perf:** public initial JS 150 KB gz or less, admin 250 KB gz or less, CSS 35 KB gz or less; Lighthouse 95 or more on mobile; LCP < 2.0 s, CLS < 0.05, INP < 200 ms.
- **Web conventions:** OR-2 minimal comments; OR-3 zod mirror of every server rule with the server's message; OR-4 no em or en dash anywhere in `web/src` (use `EmptyValue` for empty values); OR-5 API calls in `modules/{public,admin}/services/`, only `core/api/http` touches `fetch`; OR-6 owner tree (`modules/*` may hold only `components`, `hooks`, `pages`, `services` folders plus module-root files: enforced by `web/src/test/source-layout.node.test.ts` lines 54-57); public parts import from deep module paths (PERF-01).
- **Merges** only through `tools/scripts/Merge-PullRequest.ps1` on the owner's instruction. Stage files by path; run gitleaks before every commit.
- **Docs:** every markdown file carries created and updated timestamps.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Consent bar, settings window, clear dialog | Browser / Client | API (records the decision, sets cookies) | UI and local state are client; proof of consent and HttpOnly cookies are server |
| Reading the saved choice (`needsChoice`) | Browser / Client | — | The consent cookie is readable by JS; GPC is read from `navigator` |
| Logging each decision (ANL-07) | API / Backend | Database | Proof must be server-side and tamper-resistant |
| Issuing / expiring the visitor-id cookie | API / Backend | — | HttpOnly; issued only with a logged decision |
| Honoring GPC | Browser / Client | API (`Sec-GPC` header check) | Defense in depth: a crafted request cannot record identified data under GPC |
| Page-view and speed beacons | Browser / Client | API | Client sends `location.pathname` only; server validates, cuts, maps to a page key |
| Bot and staff filtering | API / Backend | — | UA and the staff marker cookie are only trustworthy server-side |
| Sessions ("Visits", 30 min) | API / Backend | Database | Sessionized from the visitor's last activity row; no session cookie |
| IP minimization (truncate + HMAC with daily salt) | API / Backend | Database (salt rows) | Reuses `IpPrefix`; salts deleted after 2 days |
| Rollup and purge | Database / Storage (via maintenance job) | API (keyed maintenance endpoint), GitHub Actions (scheduler) | No host scheduler; D-07 |
| Stats aggregation, shares, percentiles, ratings, 13-month cut, buckets | API / Backend | Database | Core Value: server computes, client formats |
| CSV export | API / Backend | Browser (blob download) | Server builds rows; client saves through `blob:` URL |
| Legal text, version, approved flag | Browser / Client (text modules, D-10) | Frontend server (shell head: title, noindex, sitemap) | Text in web code; the server must know approval for `noindex` and the sitemap |
| Controller name/address on legal pages | API (`PublicSiteDto`) | Browser | D-11 from site settings |
| Privacy contact email (D-29) | API (separate small public read) | Browser (legal pages only) | Must not enter the boot data every page carries (Pitfall 1) |

## Standard Stack

### Core (all already installed; no change)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| .NET SDK / ASP.NET Core | 10.0.402 SDK (probed) | Controllers, cookies, rate limiter, `Results.File`/text responses | Project stack |
| EF Core SqlServer | 10.0.x (central props) | Tables, `ExecuteUpdate`/`ExecuteDelete`, grouped LINQ aggregates | Project stack; no inline SQL |
| FluentValidation | 12 | Stats range validator, collect/consent body validators | Project stack (handlers, not `FluentValidation.AspNetCore`) |
| `Microsoft.AspNetCore.RateLimiting` (in framework) | 10.0 | New `consent`, `analytics-collect`, `analytics-clear` policies | Existing `RateLimitingRegistration` pattern |
| React / react-router / TanStack Query / nuqs / zod | 19.3.0 / 8.4.0 / 5.103.2 / 2.10.1 / 4.6.7 | UI, routes, server state, URL range, OR-3 schemas | Installed (`web/package.json`) |
| lucide-react | 1.53.0 | `chart-column`, `circle-x`, `download` icons (D-32) | Installed |

### Supporting (new, needs owner approval)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `web-vitals` | 6.2.3 | LCP, CLS, INP from real visitors (`onLCP`, `onCLS`, `onINP`) | Dynamic `import()` only after Visitor stats consent; never in the initial chunk |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `web-vitals` | First-party `PerformanceObserver` reader | LCP and CLS are simple enough; **INP is not** (interaction grouping by `interactionId`, the "98th percentile, one excluded per 50 interactions" rule, bfcache and prerender cases). Hand-rolling INP gives numbers that do not match Google's. Use only if the owner declines the package, and then ship LCP and CLS only. |
| Hand-rolled UA family | `ua-parser-js` | **Forbidden:** 2.0.10 is `AGPL-3.0-or-later` (probed below). Also browser-side, and the server must classify anyway. Reuse `UserAgentFamily`. |
| Server-side sessionization | A session cookie | A second cookie with nothing to gain; the server already sees the visitor id |
| `navigator.sendBeacon` | `fetch` with `keepalive: true` through `httpClient` | sendBeacon cannot send the `X-CSPS-CSRF` header and lives outside the OR-5 transport. Firefox supports `keepalive` since 133 [CITED: Mozilla intent-to-ship], Chrome since 66, Safari since 13. Use `keepalive` in `httpClient` |

**Installation (only after the owner's yes):**
```bash
npm --prefix web install --save-exact web-vitals@6.2.3
```

**Version verification (run this session):**
```
$ npm view web-vitals version license time.modified repository.url --json
{ "version": "6.2.3", "license": "Apache-2.0", "time.modified": "2026-10-05T10:03:40.735Z",
  "repository.url": "git+https://github.com/GoogleChrome/web-vitals.git" }
```
Published 2026-10-05, 41 days before today: passes the 14-day cool-down.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `web-vitals` 6.2.3 | npm | 6.2.3 published 2026-10-05 (41 days); the package itself is years old | 84,277,940 / week (seam) | github.com/GoogleChrome/web-vitals | OK | Recommended, **pending owner approval** (owner rule) |
| `ua-parser-js` 2.0.10 | npm | n/a | n/a | n/a | not run (license) | **REMOVED: AGPL-3.0-or-later**, forbidden |

Plain-words findings for the owner on `web-vitals` 6.2.3 (checked 2026-11-15):
- **License:** Apache-2.0, on the allowed list. Free, no payment, keep the notice (the existing THIRD-PARTY-NOTICES step does that).
- **Security advisories:** none. The npm advisory database answered `{}` for `{"web-vitals":["6.2.3"]}`.
- **Deprecated:** no (seam `deprecated: false`). **Install scripts:** none (`postinstall: null`). **Runtime dependencies:** none.
- **Recent bugs fixed:** 6.2.3 fixed an INP memory leak (#799) and a negative LCP attribution value (#803); 6.2.2 capped a LoAF buffer leak (#796). These were fixed *in* this version; no open regression against 6.2.3 was found in the changelog [CITED: github.com/GoogleChrome/web-vitals CHANGELOG.md].
- **Size:** about 3 KB brotli for the standard build [CITED: README]. It loads in its own lazy chunk, so it does not count against the 150 KB initial budget.
- **Browser reach:** `onLCP`, `onINP` work in Chromium, Firefox and Safari; `onCLS` is Chromium only [CITED: README], so iPhone visitors give no layout-shift numbers. The stats page already handles "no data".

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.
**Planner:** add a `checkpoint:human-verify` (owner approval of `web-vitals@6.2.3`) before the install task. If the owner is away, park it in the backlog and build the speed reader behind an interface so LCP/CLS can ship with the fallback.

## Architecture Patterns

### System Architecture Diagram

```
 Visitor browser (public SPA)
 ───────────────────────────────────────────────────────────────────────────────
  route change ──► usePageViewBeacon ──► [pending landing view?] ──┐
  first load  ──► useConsent (reads __Host-csps_consent, navigator.globalPrivacyControl)
                    │ needsChoice && !GPC ──► lazy ConsentBar (CB1) ─► choice ─┐
                    │ footer "Cookie Settings" ──► lazy CS1 / CS2 ─────────────┤
                    │ stats on ──► lazy speed reader (web-vitals) ─► on page hide ─┐
                    ▼                                                          │   │
          consentService.record ── POST /api/v1/consent ◄──────────────────────┘   │
          analyticsService.pageView ── POST /api/v1/analytics/page-views ◄─────────┤(keepalive)
          analyticsService.vitals ── POST /api/v1/analytics/vitals ◄──────────────┘
          consentService.clear ── POST /api/v1/analytics/clear ─► then clear local/session storage
 ───────────────────────────────────────────────────────────────────────────────
 Server (ASP.NET Core)          every anonymous POST: rate limit ─► X-CSPS-CSRF ─► size limit ─► validator
   /consent ──► GPC header? force stats off ─► ConsentRecords INSERT ─► Set-Cookie consent (+ vid on / expire vid off)
   /page-views ─► bot UA? staff marker or bearer? ─► drop
                └► cut path at ? # ─► PublicRouteTable.Match ─► page key (Admin/Dev ─► drop)
                     ├─► DailyPageCounts += 1 (everyone not dropped)            [anonymous, 3 years]
                     └─► vid cookie AND consent cookie stats=1 current AND no Sec-GPC?
                           └─► Visit (reuse if last seen < 30 min, else new: referrer name, device, browser, OS, IP HMAC)
                               └─► PageView INSERT                               [raw, 13 months]
   /vitals ──► same gates; consented only ─► VitalSamples INSERT                [raw, 13 months]
   /clear ──► vid hash from cookie ─► delete Visits (cascade PageViews, VitalSamples) ─► expire vid ─► log reset decision
 ───────────────────────────────────────────────────────────────────────────────
 GitHub Actions maintenance.yml ─► POST /api/v1/maintenance/run (key) ─► AnalyticsRetentionJob
     1 roll up each closed day not yet rolled ─► DailyReferrerCounts, DailyDeviceCounts
     2 delete raw rows with BusinessDay < today − 13 months
     3 delete ConsentRecords older than 13 months
     4 delete daily tables older than 3 years
     5 delete IP salts older than yesterday
 ───────────────────────────────────────────────────────────────────────────────
 Manager (admin SPA) /admin/visitor-stats?range=… ─► GET /api/v1/visitor-stats?range=&from=&to=
     server resolves preset with IBusinessCalendar ─► days ≥ cut: raw tables; days < cut: daily tables
     ─► totals, buckets (day ≤ 62 days, else month), top pages, referrers, device/browser shares, p75 + rating
   Export CSV ─► GET /api/v1/visitor-stats/export?… ─► text/csv, one row per business day ─► blob download
```

### Recommended Project Structure

```
src/Csps.Domain/Analytics/            # pure, 100% covered: PageKey, ReferrerName, DeviceClass, OsFamily,
                                      #   AnalyticsPath (cut at ? #), ConsentCookie codec, VitalRating, Percentile,
                                      #   AnalyticsRetention constants, ConsentRecord, Visit, PageView, VitalSample
src/Csps.Application/Analytics/       # RecordConsent, CollectPageView, CollectVitals, ClearVisitorData,
                                      #   GetVisitorStats, ExportVisitorStats handlers + validators + DTOs
src/Csps.Application/Ports/           # IAnalyticsStore, IVisitorStatsReader, IIpSalts (new ports)
src/Csps.Infrastructure/Analytics/    # EF store, stats reader, salt provider, AnalyticsRetentionJob
src/Csps.Infrastructure/Persistence/Configurations/  # one *Configuration.cs per new table
src/Csps.Server/Controllers/          # ConsentController, AnalyticsController, VisitorStatsController,
                                      #   PublicPrivacyContact action (on PublicSiteController or its own)
src/Csps.Server/Security/             # AnalyticsCookies (names/attributes), StaffMarker, new rate-limit rules
src/Csps.Server/Endpoints/            # PublicRouteTable + PublicPageHeads + LegalPages (approved/version)
tests/fixtures/legal-pages.json       # path, version, lastUpdated, approved: read by server and web tests
tests/fixtures/consent-cookie-cases.json  # codec cases shared by C# and TS tests
web/src/modules/public/
  hooks/useConsent.ts, usePageViewBeacon.ts, useSpeedReport.ts
  services/consentService.ts, analyticsService.ts, privacyContactService.ts
  components/ConsentBar.tsx, CookieSettingsDialog.tsx, ClearDataDialog.tsx, Legal*.tsx, consent.recipe.ts, legal.recipe.ts
  pages/PrivacyPolicyPage.tsx, CookiePolicyPage.tsx, TermsPage.tsx, AccessibilityPage.tsx
  legalPrivacy.ts, legalCookies.ts, legalTerms.ts, legalAccessibility.ts, consentCookie.ts   # module root files
web/src/modules/admin/
  pages/VisitorStatsPage.tsx; components/VisitorStats*.tsx, StatBarList.tsx, ...; visitorStatsCopy.ts, visitorStatsRange.ts
  services/visitorStatsService.ts; hooks/useVisitorStatsQuery.ts
web/src/components/data/VisitorTrendChart.tsx
```
No new folder under `modules/public` or `modules/admin` (the layout test allows only `components`, `hooks`, `pages`, `services`).

### Pattern 1: Schema (no JSON columns, small rows, all from migrations)

Recommended tables (names are the planner's; types are the recommendation):

| Table | Columns | Keys / indexes | Retention |
|---|---|---|---|
| `ConsentRecords` | `Id` uniqueidentifier PK; `ConsentId` uniqueidentifier (the browser's chain id, from the cookie); `PolicyVersion` varchar(16); `Stats` bit **null** (null = not chosen yet, D-18 map-only save); `Map` bit; `Gpc` bit; `Source` tinyint (Bar, Settings, MapLink, Clear); `DecidedAtUtc` datetimeoffset | IX on `DecidedAtUtc` (purge) | 13 months (D-05) |
| `AnalyticsVisits` | `Id` uniqueidentifier PK; `VisitorHash` binary(32) (SHA-256 of the cookie value, so a database copy cannot be matched to a browser); `BusinessDay` date (start day); `StartedAtUtc`, `LastSeenAtUtc` datetimeoffset; `Referrer` nvarchar(100) (D-28 name, "Direct" stored as null or a constant); `Device` tinyint; `Browser` varchar(20) (`UserAgentFamily` label); `Os` varchar(20); `IpHash` binary(32) null; `PageViews` int | IX (`VisitorHash`, `LastSeenAtUtc`) for sessionizing and Clear; IX (`BusinessDay`) INCLUDE (`VisitorHash`, `Referrer`, `Device`, `Browser`) for stats | 13 months (D-03) |
| `AnalyticsPageViews` | `Id` bigint identity PK; `VisitId` FK cascade; `BusinessDay` date; `OccurredAtUtc`; `PageKey` varchar(32) | IX (`VisitId`), IX (`BusinessDay`) | 13 months |
| `AnalyticsVitalSamples` | `Id` bigint identity PK; `VisitId` FK cascade; `BusinessDay` date; `Metric` tinyint (Lcp, Cls, Inp); `Value` decimal(9,3) (ms for LCP/INP, unitless for CLS); `PageKey` varchar(32) | IX (`BusinessDay`, `Metric`, `Value`) for the p75 read | 13 months |
| `DailyPageCounts` | `BusinessDay` date; `PageKey` varchar(32); `Views` int | PK (`BusinessDay`, `PageKey`) | 3 years (D-04) |
| `DailyReferrerCounts` | `BusinessDay`; `Referrer` nvarchar(100); `Visits` int | PK (`BusinessDay`, `Referrer`) | 3 years |
| `DailyDeviceCounts` | `BusinessDay`; `Dimension` tinyint (Device, Browser); `Name` varchar(20); `Visits` int | PK (`BusinessDay`, `Dimension`, `Name`) | 3 years |
| `AnalyticsSalts` | `BusinessDay` date PK; `Salt` binary(32) | PK | today and yesterday only |

Notes:
- **`BusinessDay` is written at insert time** from `IBusinessCalendar` (Asia/Manila), so every group-by is a plain `date` group and no time-zone math runs in SQL. A visit spanning midnight belongs to its start day.
- **Page views count everyone:** every page view that passes the bot and staff gates increments `DailyPageCounts`, with or without consent (UI-SPEC: "Every page opened, with or without cookies"). So page views and top pages for **any** range come from one table and need no rollup. The raw `AnalyticsPageViews` rows exist for the consented detail and for ANL-04 deletion. Do not add raw page views to `DailyPageCounts` a second time.
- **No `rowversion`:** none of these rows is edited by a person; counters change through atomic `UPDATE ... SET Views = Views + 1` (`ExecuteUpdate`), and the job holds the maintenance lease. This follows `MaintenanceCursor`'s documented reasoning ("It has no row version: only the run that holds the maintenance lease writes it").
- **No triggers, no JSON:** the "only one trigger" schema test (`AuditLogAppendOnlyTests`, which lists `sys.triggers`) keeps guarding.
- **Size on the 256 MB / single-DB plan:** a small shop at a few hundred page views a day stores about 100k raw page views a year at under 100 bytes a row: a few tens of MB with indexes. The 13-month purge bounds it [ASSUMED: traffic estimate].

### Pattern 2: Consent cookie and decisions

**Cookies** (server-set with `Set-Cookie`, because Safari caps cookies written by `document.cookie` to 7 days [ASSUMED: WebKit ITP behaviour, widely documented; verify in the WebKit E2E project]):

| Name | Category | HttpOnly | Path | SameSite | Lifetime | Value |
|---|---|---|---|---|---|---|
| `__Host-csps_consent` | Necessary | no (the client reads it) | `/` | Lax | 12 months from the decision | compact codec, e.g. `1_<consentId>_<policyVersion>_<s>_<m>_<yyyymmdd>` with `s` in {1, 0, -}, `m` in {1, 0} |
| `__Secure-csps_vid` | Visitor stats | yes | `/api/v1/analytics` | Strict | 12 months from the decision, not sliding (ANL-05 "≤ 12 months") | 32 random bytes, base64url (`ISecureRandom.NewToken()`) |
| `__Secure-csps_staff` (recommended, D-21) | Necessary | yes | `/api/v1/analytics` | Strict | same as the refresh cookie | `1` |

- The `__Host-` / `__Secure-` prefixes stop subdomain cookie tossing; the project already uses `__Secure-csps_rt` and the E2E host is `https://localhost:5199` (`web/playwright.config.ts` line 21), so prefixed cookies work in every Playwright engine.
- The cookie value uses only `cookie-octet` characters (no comma, semicolon, space, quote or backslash). Use `_` separators. The policy version may contain `.` (allowed).
- **Codec is a TDD candidate on both sides:** C# `ConsentCookie.TryParse/Format` (Domain) and TS `consentCookie.ts` (module root), both tested against one `tests/fixtures/consent-cookie-cases.json` (the repo already shares `philippine-phone-cases.json` this way).
- **Provisional local write:** UI-SPEC says a failed save must still apply in the browser and be re-sent on the next page view. So the client writes the same cookie with `document.cookie` immediately, with a "pending" marker (for example a trailing `_p`), then POSTs. The server answer re-sets it without the marker and with the long lifetime. On the next page view a pending cookie is re-posted. A provisional cookie never makes the server issue a visitor id by itself.
- **`needsChoice`** = no cookie, or `policyVersion` ≠ current, or decided more than 12 months ago, or `s` is `-` (map-only save, D-18); never true under GPC (D-20).
- **Decision record:** each POST inserts one `ConsentRecords` row holding the full state after the decision, the source, the GPC flag and the server time. No IP, no UA (data minimization; PRD §5.4 "No IP stored in clear": storing none is the simplest way to meet it).
- **Server rules:** if `Sec-GPC: 1` is present, store `Stats = false`, `Gpc = true` whatever the body says, and never issue a visitor id. If `PolicyVersion` is not the current one, record nothing and answer 409 with a code (`consent.policy-changed`) and the current version; the client keeps the bar (UI-SPEC § Validation "server only"). Stats on issues `__Secure-csps_vid` (keep an existing one); stats off expires it. Withdrawal does **not** delete past rows (that is what Clear is for) [ASSUMED: see A6].
- **Under GPC there is no automatic record:** GPC is not a decision made on the site. The flag is stored on any decision the visitor does make there (map choice) [ASSUMED: A7].

### Pattern 3: Collect pipeline (page views and speed)

```csharp
// Source: pattern from src/Csps.Server/Controllers/MaintenanceController.cs (attributes) and the SEC-06 allow-list
[HttpPost("page-views")]
[AllowAnonymous]
[RequireCsrfHeader]                                      // X-CSPS-CSRF: a cross-site form post cannot add it
[EnableRateLimiting(RateLimitPolicies.AnalyticsCollect)] // new policy, per address
[IdempotencyExempt("An analytics beacon: a repeat only adds one page view, and beacons are exempt by SEC-06.")]
[RequestSizeLimitMetadata(2048)]                         // existing attribute; tiny JSON body
public async Task<IResult> PageView(PageViewRequest body, CancellationToken cancellationToken) { ... }
```

Server steps, in order (each a unit-testable function or handler branch):
1. **Bot gate:** `UserAgentFamily.Classify(ua) is Bot or Unknown` → 204, store nothing. Add analytics-only tokens on top of the shared list (`HeadlessChrome`, `Lighthouse`, `PTST` for WebPageTest) in a separate classifier so the audit log's labels do not change [ASSUMED: token list].
2. **Staff gate (D-21):** the staff marker cookie, or a valid bearer token on the request → 204, store nothing, not even the anonymous count.
3. **Path:** take `body.Path`, cap at 2,048 characters, cut at the first `?` or `#` (ANL-05), then `PublicRouteTable.Match(path, devRoutesKnown)`: `Page` → its page key; `NotFound` → `not-found`; `Admin`/`Dev` → 204, store nothing. Arbitrary paths are never stored, so the "top pages" list cannot be spammed.
4. **Anonymous count:** `DailyPageCounts` for `(businessDay, pageKey)`: `ExecuteUpdateAsync(s => s.SetProperty(r => r.Views, r => r.Views + 1))`; when it affects 0 rows, insert; on a unique-key violation (SQL 2627/2601, which `SqlErrors.cs` does not name yet: add the constants) run the update again.
5. **Identified record** only when all hold: `__Secure-csps_vid` present, the consent cookie parses with `s = 1` and the current version, and no `Sec-GPC: 1`. Then find the visitor's newest `AnalyticsVisits` row with `LastSeenAtUtc > now − 30 min` (session timeout matches the UI copy "A new one starts after 30 minutes away"); reuse it (update `LastSeenAtUtc`, `PageViews + 1`) or create one with the referrer name, device class, browser and OS family, and the IP HMAC. Insert the `AnalyticsPageViews` row.
6. **Referrer** (landing view only; the client sends the hostname of `document.referrer`, never the full URL): validate as a host name (letters, digits, `.`, `-`, 253 characters max, no regex needed), then group (D-28) with an ordered, case-insensitive suffix table: `facebook.com` (m., l., lm., www.) → Facebook; `messenger.com` → Messenger; `instagram.com` → Instagram; `google.<tld>` and `google.com.<cc>` (for example `google.com.ph`) → Google; the site's own host → no referrer; anything else → the host, lowercased, `www.` dropped. An `android-app://com.facebook.katana` style referrer maps to Facebook [ASSUMED]. Pure Domain function, 100% branch coverage.
7. **Device class** (new, family level): `iPad` or `Tablet` or (`Android` without `Mobile`) → Tablet; `iPhone` or `iPod` or `Mobi` or `Android` → Phone; Windows / Macintosh / CrOS / Linux → Computer; else Other. iPadOS Safari reports a Mac UA, so iPads count as Computer [ASSUMED]. OS family reuses `DeviceSummary`'s ordered checks (iPhone/iPad before Mac, Android and CrOS before Linux).
8. **IP:** `IpPrefix.From(remoteIp)` (the existing /24 and /48 rule, which already maps IPv4-mapped, 6to4 and NAT64 to IPv4), then `HMACSHA256(daySalt, prefixBytes)`. The day salt is 32 random bytes in `AnalyticsSalts`, created on first use for that business day (insert, catch the unique violation, read back) and cached in process for the day. The job deletes salts older than yesterday, so old hashes can never be recomputed: a real rotation, not a derivable one.

**Client side:**
- `usePageViewBeacon` in `PublicLayout`: on each `location.pathname` change send `{ path: location.pathname, referrerHost? }` (referrer on the first view of a page load only).
- **"Pending landing view" state machine** (TDD candidate): when the bar shows on the landing page, hold that view; flush it on the choice (identified or anonymous), on the next route change (anonymous), or on `visibilitychange` to hidden (anonymous, `keepalive`). It is sent exactly once (UI-SPEC "never sent twice").
- `useSpeedReport`: only with stats consent, `import('web-vitals')` then `onLCP`, `onCLS`, `onINP` (defaults; no `reportAllChanges`, no `reportSoftNavs`); queue and flush on `visibilitychange` hidden in one `keepalive` POST of up to 3 metrics with the landing path. Loading late is fine: the library reads buffered entries [CITED: web-vitals README "you do not need to load this library early"].
- Server re-checks the consent gates for vitals and rejects out-of-range values (LCP and INP 0 to 60,000 ms, CLS 0 to 10; System.Text.Json already rejects `NaN`).

### Pattern 4: Clear my cookies & data (ANL-04, D-19, D-31)

`POST /api/v1/analytics/clear` (anonymous, `RequireCsrfHeader`, `analytics-clear` rate limit with the detail "Too many tries. Wait a minute and try again.", idempotency-exempt because it sets cookies, the same reason as sign-in):
1. Read `__Secure-csps_vid` from the request (it reaches this path because the cookie path is `/api/v1/analytics`). No id in the URL or body: there is nothing to tamper with (CWE-639).
2. `ExecuteDelete` the visitor's `AnalyticsVisits` by `VisitorHash` (page views and samples go by cascade, or delete children first in batches).
3. Expire `__Secure-csps_vid` (`Response.Cookies.Delete` with the same path and attributes).
4. Record a new decision: stats off, map off, source Clear, with a **new** `ConsentId` (the old chain is no longer linked to the browser), and set the consent cookie (D-31: no re-ask).
5. Answer 204 (or a fixed body). Same answer whether or not anything was deleted.

Client, only after a 2xx: `localStorage.clear()`, `sessionStorage.clear()`, expire any readable non-essential cookie it knows by name, but **never** the consent cookie the server just set. Then show the cleared note.

The rolled-up daily counts and `DailyPageCounts` have no visitor id and stay; the Cookie Policy "Clear your cookies and data" section should say that totals without an id stay [ASSUMED: A8 wording for owner approval]. Google's own map cookies belong to google.com: the site cannot clear them, and the policy must say so.

### Pattern 5: Stats read and CSV

- `GET /api/v1/visitor-stats?range=last-30-days` or `?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`, `[Authorize(Policy = Policies.Manager)]`. **The server resolves presets** against `IBusinessCalendar` (never the device clock) and returns the resolved `from`/`to` for the subline, matching UI-SPEC "the resolved range from the server". The validator reuses the Audit Log messages verbatim ("Enter a real date.", "The start date must be on or before the end date.", the "Choose a date from {date} to today." window) with a **3-year floor** (D-04). Source: `ListAuditLogRequestValidator.cs` lines 23-26 and 77-78.
- **Cut date** `cut = businessToday.AddMonths(-13)`. Days ≥ cut: unique visitors = `COUNT(DISTINCT VisitorHash)` over `AnalyticsVisits` (LINQ `.Select(v => v.VisitorHash).Distinct().CountAsync()`); visits = row count; referrers, devices, browsers from the raw visits. Days < cut: unique visitors and visits are null (D-27), referrers and devices from the daily tables. Page views and top pages always from `DailyPageCounts`.
- **Buckets:** per day up to 62 days, else per month (`GroupBy(d => new { d.BusinessDay.Year, d.BusinessDay.Month })`; EF translates `DateOnly` members on SQL Server [ASSUMED: verify with an integration test]). Unique visitors per month are a distinct count over the month, never a sum of days.
- **Shares** as whole percents computed server-side with largest-remainder rounding so a list sums to 100 [discretion; TDD candidate]. Browser list: top 5 plus "Other".
- **p75 (Google's method, nearest rank):** count n per metric, then `OrderBy(Value).Skip(ceil(0.75 × n) − 1).Take(1)`. Two LINQ queries, no `PERCENTILE_CONT` (EF has no translation for it, and inline SQL is forbidden) [ASSUMED: EF translation gap]. Ratings by the UI-SPEC thresholds (LCP ≤ 2,500 ms good, ≤ 4,000 needs work; CLS ≤ 0.1, ≤ 0.25; INP ≤ 200 ms, ≤ 500 ms), which match the web-vitals README thresholds. Speed is **not** rolled up: older than 13 months shows "Not available" (UI-SPEC allows it) [ASSUMED: A3].
- **Read on demand, no cache** (the dashboard's precedent, D-13 of Phase 10). Manager-only traffic is tiny.
- **CSV** `GET /api/v1/visitor-stats/export?...`: `text/csv; charset=utf-8`, UTF-8 BOM, `Content-Disposition: attachment; filename="visitor-stats-YYYY-MM-DD-to-YYYY-MM-DD.csv"` built only from the validated dates, header `Date,Unique visitors,Visits,Page views` (D-33), one row per business day, zeros for empty days, an empty cell where a count is not available, `\r\n` line ends, invariant culture. Every cell is a date or an integer, so formula injection (CWE-1236) cannot occur. Keep a unit test that fails if any cell starts with `=`, `+`, `-`, `@`, tab or CR, so a later text column cannot slip in unescaped.
- **Client download:** `httpClient` throws a parse error for any non-JSON answer (`httpClient.ts` toHttpResponse: "The API never redirects and answers with JSON or 204 ... a body of another type ... never the DTO the caller typed (LIB-WR-05)"). Recommended: add an explicit opt-in to `core/api/http` (for example `responseType: 'text'` with an allow-list of `text/csv`), keeping the guard for every other call and the 100% `core/api` coverage. Then build `new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' })` (the BOM must be re-added; Pitfall 3), `URL.createObjectURL`, click a temporary `<a download>`, revoke the URL.

### Pattern 6: `AnalyticsRetentionJob` (ANL-09, D-03 to D-05, D-07)

Follows `PurgeExpiredRecordsJob` exactly: an `IMaintenanceJob` registered in `MaintenanceRegistration.AddCspsMaintenance`, fixed plain-English labels, a failure in one rule reported as that rule's failed line (`SqlErrors.IsDatabaseFailure`), batches of 500, budget checked after each full batch, `More = true` when the budget is spent. Order between purge (10) and stray sweep (20), for example 15, so database work runs before the Cloudinary network jobs.

Rules, in order:
1. **Roll up** every closed business day (before today) not yet rolled, oldest first, one day per transaction: insert that day's `DailyReferrerCounts` and `DailyDeviceCounts` from `AnalyticsVisits`, then save the day in `IMaintenanceCursors` (job name, cursor `YYYY-MM-DD`). **Eager rollup** means a day 13 months old was rolled up a year ago, so the read rule "days < cut use the daily tables" never meets a gap even though the run is monthly. Days in progress are never touched.
2. **Purge raw** `BusinessDay < today.AddMonths(-13)`: page views and samples, then visits (or rely on the cascade). A day is purged only if the cursor shows it rolled up.
3. **Purge consent** `DecidedAtUtc < now.AddMonths(-13)`.
4. **Purge daily tables** `BusinessDay < today.AddYears(-3)` (D-04: every daily table, all without a visitor id).
5. **Purge salts** older than yesterday.

Constants `AnalyticsRetention.RawMonths = 13`, `ConsentMonths = 13`, `DailyYears = 3`, named and unit-tested like `AuditRetention.Months` (`src/Csps.Domain/Auditing/AuditRetention.cs` line 7: `public const int Months = 8;`). Tests use `FakeTimeProvider` at month and leap-year edges.

### Pattern 7: Legal pages metadata shared by web and server (LEGAL-05, D-10, D-14, D-22)

The text lives in the web modules (D-10), but the **server** needs three facts per page: approved (for `noindex` and `sitemap.xml`), title/description (first response), and the Cookie Policy version (to validate consent). Use the repo's existing pattern: `tests/fixtures/public-paths.json` is read by both `web/src/test/public-paths.node.test.ts` and `tests/Csps.Server.IntegrationTests/Http/PublicRouteTableTests.cs`. Add `tests/fixtures/legal-pages.json` (`path`, `version`, `lastUpdated`, `approved`) and assert in both test suites that the server's `LegalPages` constants and the web `legal*.ts` modules equal it. Then approving a page is one reviewed change in three files, and a mismatch fails CI.

Server changes: `PublicPage` gains `Privacy`, `Cookies`, `Terms`, `Accessibility`; `PublicRouteTable.Pages` gains the four paths; `PublicPageHeads.For` gains the UI-SPEC titles ("Privacy Policy · CSPS" and so on) and the leads as descriptions; the shell sets `NoIndex: !approved`; `SeoEndpoints` lists only approved legal paths. Note `PublicRouteTable.PagePaths` is also the sitemap order, so the sitemap needs an approved filter rather than the raw list.

Privacy contact (D-29): a new anonymous read such as `GET /api/v1/public/privacy-contact` answering `{ email }` (or 204 when not set), with the `public-read` rate limit and the same cache tag invalidation as site settings. Only `LegalFacts` calls it. It must not be added to `PublicSiteDto`, the boot JSON or JSON-LD (Pitfall 1).

Approval note for the owner: the first approved Cookie Policy becomes version 1.0 (UI-SPEC), and D-22 says a version change asks every visitor again. Approving the Cookie Policy therefore re-asks everyone once. That follows the ruling; it is listed here so it is not a surprise.

### Anti-Patterns to Avoid
- **Adding the email to `PublicSiteDto`:** it lands in every page's boot data (Pitfall 1).
- **Reading consent only from the client cookie on the server:** a hand-written cookie must never cause identified storage; the HttpOnly visitor-id cookie, issued only with a logged decision, is the gate.
- **Storing raw paths, full referrer URLs or the raw User-Agent:** store a page key, a referrer name and family labels.
- **`Clear-Site-Data` header:** clears the staff sign-in cookies and races with the new consent cookie (Pitfall 6).
- **A `legal/` or `analytics/` folder under `modules/public`:** fails `source-layout.node.test.ts`.
- **Computing presets or the 13-month cut with the device clock:** use the server's resolved range.
- **Summing daily unique visitors into a monthly figure:** distinct-count over the bucket.
- **Using `navigator.webdriver` to skip tracking:** it is true under Playwright and would break the analytics E2E journeys.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| INP measurement | A custom event-timing aggregator | `web-vitals` 6.2.3 (owner approval) | Interaction grouping, percentile rule, bfcache, prerender; numbers must match Google's |
| IP truncation | New prefix code | `Csps.Domain.Auditing.IpPrefix.From` | Already handles IPv4-mapped, 6to4, NAT64, scope ids, with tests |
| Browser family | A new UA parser or a package | `Csps.Domain.Auditing.UserAgentFamily.Classify` (+ a small analytics bot and device add-on) | No regex (CWE-1333), 512-character scan cap (CWE-400), Facebook and Instagram in-app first |
| Rate limiting | Counters in the database | `RateLimitingRegistration` sliding-window policies | Rejects before any handler or DB work |
| HMAC | Custom hashing | `System.Security.Cryptography.HMACSHA256.HashData` | Built in |
| Random ids and salts | `Guid.NewGuid()` for secrets | `ISecureRandom.NewToken()` / `RandomNumberGenerator` | CWE-330/338 |
| Upsert | `MERGE` SQL | `ExecuteUpdate` then insert, retry on unique violation | No inline SQL rule |
| Scheduler | A hosted service timer | `IMaintenanceJob` in the keyed GitHub Actions run | Host has no scheduler; app pool recycles |
| Date range URL state | New parsers | `dateRangeParsers`, `CUSTOM_RANGE`, `isCalendarDate` in `web/src/lib/url-state/parsers.ts` and the `AuditCustomRange` pattern | WEB-10 rules and known nuqs bugs already handled |
| Trend chart | A chart package | `IncomeExpenseChart` geometry and `data.recipe.ts` looks | Hand-rolled SVG is the project rule |
| CSV library | A package | A 30-line server writer with invariant formatting | Only dates and integers |

**Key insight:** privacy analytics is mostly *data minimization at the edge of the server*. Every value that is stored must be reduced first (page key, referrer name, family labels, truncated and salted IP, hashed visitor id). The repo already has the reduction functions; the work is wiring them into one well-tested pipeline.

## Common Pitfalls

### Pitfall 1: The shop email leaks into every page
**What goes wrong:** the email is added to `PublicSiteDto` for `LegalFacts`, and appears in the boot JSON of every page.
**Why it happens:** `ShellPage.cs` line 287 embeds the site JSON (`PublicHeadWriter.BootData(snapshot.Json.Json, ...)`) in each page's first response.
**How to avoid:** a separate read only the legal pages call (Pattern 7). Server test: the Home, Contact and 404 HTML and the JSON-LD never contain the test email.
**Warning signs:** a `PublicSiteDto` diff adding `Email`.

### Pitfall 2: The CSV export cannot pass `httpClient`
**What goes wrong:** the export call rejects with a parse error.
**Why it happens:** `toHttpResponse` treats any non-JSON 2xx as a captive portal (LIB-WR-05).
**How to avoid:** an explicit, allow-listed text mode in `core/api/http` with its own tests (100% coverage), or a JSON wrapper `{ fileName, csv }`. Recommended: the text mode, so the API stays a real CSV endpoint for the future Android app.

### Pitfall 3: The byte-order mark disappears
**What goes wrong:** Excel opens the CSV with broken characters.
**Why it happens:** `Response.text()` decodes UTF-8 and drops a leading BOM. Probed this session:
```
$ node -e "new Response(new Uint8Array([0xEF,0xBB,0xBF,0x41])).text().then(t=>console.log(JSON.stringify(t), t.length))"
"A" 1
```
**How to avoid:** prepend `'\uFEFF'` when building the Blob; a unit test checks the first bytes.

### Pitfall 4: Purge lag with a monthly run
**What goes wrong:** raw rows and consent records stay up to about 14 months while the Privacy Policy says 13.
**Why it happens:** `maintenance.yml` runs `cron: "17 19 1 * *"` (monthly, Phase 9 D-21), and GitHub pauses schedules after 60 days without repository activity.
**How to avoid:** Open Question 1 (owner). Whatever the ruling, the stats read uses the cut date, never "whatever rows exist", so the page is right even when the purge is late.

### Pitfall 5: iPhone visitors asked again every week
**What goes wrong:** the bar returns after 7 days on Safari.
**Why it happens:** WebKit caps cookies set through `document.cookie` to 7 days [ASSUMED].
**How to avoid:** the server sets both cookies with `Set-Cookie`; the client's provisional write is only a fallback. Facebook's in-app browser keeps its own cookie jar, so a visitor coming from the Facebook app and later opening Safari is asked again: expected, not a bug.

### Pitfall 6: `Clear-Site-Data` wipes staff sign-in
**What goes wrong:** a staff member testing Clear is signed out, and the new consent cookie may be cleared too.
**Why it happens:** `Clear-Site-Data: "cookies"` clears every cookie of the origin, including `__Secure-csps_rt` and the cookie set in the same response.
**How to avoid:** expire the known cookie names explicitly.

### Pitfall 7: Staff visits counted (D-21)
**What goes wrong:** the owner browsing the public site in another tab is counted.
**Why it happens:** the refresh cookie is scoped to `/api/v1/auth` (`AuthCookies.cs` line 17: `public const string CookiePath = "/api/v1/auth";`) and the access token lives only in memory in the admin tab, so the collect request carries neither.
**How to avoid:** the staff marker cookie (path `/api/v1/analytics`) set where `SetRefresh` is called and deleted where `ClearRefresh` is called; plus "bearer present means drop". Do **not** widen the refresh cookie path (it would expose the refresh token to every API call and sign every device out once).

### Pitfall 8: Rate limits trip in E2E
**What goes wrong:** E2E fails with 429 on beacons.
**Why it happens:** all seven Playwright projects share one address (the config already raises the upload limit for this, `playwright.config.ts` line 110).
**How to avoid:** bind the new limits from configuration (`RateLimits:AnalyticsCollect` etc., with `Validate()` like `PublicReadRateLimit`) and raise them in the E2E host settings.

### Pitfall 9: The bar breaks the existing public E2E, axe and Lighthouse runs
**What goes wrong:** Phase 11 specs (focus-not-obscured, public sweeps, gallery lightbox) fail because a fixed bar covers controls on first visit.
**Why it happens:** every fresh Playwright context is a first visit.
**How to avoid:** a shared fixture in `web/e2e/fixtures.ts` that adds a decided consent cookie to the context by default; consent specs opt out to start clean. Lighthouse should measure the honest first visit (bar showing) and record whether the bar text becomes the LCP element on phones.

### Pitfall 10: Bots and test runners counted, or E2E filtered out
**What goes wrong:** crawlers inflate counts, or a too-broad filter drops Playwright's browsers.
**Why it happens:** UA lists are heuristic; Playwright's `devices[...]` descriptors send normal UAs (the config uses them for all projects) [ASSUMED].
**How to avoid:** count only JavaScript beacons (non-JS bots never send one), filter by UA tokens, and keep the analytics-only tokens in a separate tested list. Never filter on `navigator.webdriver`.

### Pitfall 11: Facebook arrivals show as "Direct"
**What goes wrong:** the most important source (owner: "most visitors arrive on a phone from Facebook") is under-counted.
**Why it happens:** in-app browsers often send no referrer [ASSUMED: third-party sources only].
**How to avoid:** Open Question 2: when the referrer is empty and `UserAgentFamily` says Facebook or Instagram in-app, store "Facebook" or "Instagram" (Messenger's in-app UA also carries `FBAN`).

### Pitfall 12: The client copy of a server rule drifts
**What goes wrong:** the custom range accepts a date the server refuses.
**How to avoid:** OR-3: `visitorStatsRange.ts` mirrors the validator with the same messages and the same 3-year floor; one test per message on each side.

## Code Examples

### Atomic daily counter without SQL
```csharp
// Source: EF Core ExecuteUpdate pattern used in src/Csps.Infrastructure/Images/ImageDeletionQueue.cs
var updated = await context.Set<DailyPageCount>()
    .Where(row => row.BusinessDay == day && row.PageKey == key)
    .ExecuteUpdateAsync(set => set.SetProperty(row => row.Views, row => row.Views + 1), cancellationToken);
if (updated == 0)
{
    context.Add(DailyPageCount.First(day, key));
    try { await context.SaveChangesAsync(cancellationToken); }
    catch (DbUpdateException error) when (SqlErrors.Has(error, SqlErrors.UniqueViolation, SqlErrors.UniqueIndexViolation))
    {
        context.ChangeTracker.Clear();
        await context.Set<DailyPageCount>()
            .Where(row => row.BusinessDay == day && row.PageKey == key)
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.Views, row => row.Views + 1), cancellationToken);
    }
}
```
`SqlErrors.UniqueViolation` (2627) and `UniqueIndexViolation` (2601) do not exist yet; `SqlErrors.cs` today names `Timeout = -2` (line 14) and `DeadlockVictim = 1205` (line 17) [VERIFIED: src/Csps.Infrastructure/Persistence/SqlErrors.cs:14-17].

### Nearest-rank p75 in LINQ
```csharp
var n = await samples.Where(s => s.Metric == metric).CountAsync(ct);
decimal? p75 = n == 0 ? null : await samples.Where(s => s.Metric == metric)
    .OrderBy(s => s.Value).Skip((int)Math.Ceiling(0.75 * n) - 1).Select(s => (decimal?)s.Value).FirstAsync(ct);
```

### Lazy speed reader after consent
```ts
// Source: web-vitals README (onLCP/onCLS/onINP callbacks; loading late is fine because entries are buffered)
export async function startSpeedReport(report: (name: 'LCP' | 'CLS' | 'INP', value: number) => void) {
  const { onLCP, onCLS, onINP } = await import('web-vitals');
  onLCP((metric) => { report('LCP', metric.value); });
  onCLS((metric) => { report('CLS', metric.value); });
  onINP((metric) => { report('INP', metric.value); });
}
```

### GPC read (client)
```ts
// Source: W3C GPC spec: `readonly attribute boolean globalPrivacyControl` on Navigator; header `Sec-GPC: 1`
const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
```

## Verified In-Repo Values (quoted verbatim)

| Value | Source | Verbatim |
|---|---|---|
| Rate limit policy pattern | `src/Csps.Server/Security/RateLimitSettings.cs:24-31` [VERIFIED] | `public const string Maintenance = "maintenance-run";` · `public const string ImageUpload = "images-upload";` · `public const string PublicRead = "public-read";` |
| Default 429 detail | `src/Csps.Server/Security/RateLimitingRegistration.cs:20` [VERIFIED] | `private const string AttemptsDetail = "Too many attempts from this address. Please wait and try again.";` (Clear needs its own: "Too many tries. Wait a minute and try again.") |
| Auth cookies | `src/Csps.Server/Security/AuthCookies.cs:11,14,17` [VERIFIED] | `RefreshCookieName = "__Secure-csps_rt"` · `TicketCookieName = "__Secure-csps_2fa"` · `CookiePath = "/api/v1/auth"` |
| CSRF header | `src/Csps.Server/Security/RequireCsrfHeaderAttribute.cs:19` [VERIFIED] | `public const string HeaderName = "X-CSPS-CSRF";` |
| Production CSP | `src/Csps.Server/Http/SecurityHeadersMiddleware.cs:20` [VERIFIED] | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-src https://www.google.com/maps/embed; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests` (no change needed) |
| Request size and exemption attributes | `src/Csps.Server/Http/RequestSizeLimitMetadataAttribute.cs:12`, `src/Csps.Server/Security/IdempotencyExemptAttribute.cs:14` [VERIFIED] | `public sealed class RequestSizeLimitMetadataAttribute(long bytes)` · `public IdempotencyExemptAttribute(string reason)` |
| Job order convention | `src/Csps.Application/Maintenance/IMaintenanceJob.cs:9` [VERIFIED] | `Gets where the job runs in a pass: purge 10, stray sweep 20, removals 30, usage 40. Lower runs first.` |
| Purge batch, order, name | `src/Csps.Infrastructure/Maintenance/PurgeExpiredRecordsJob.cs:33,48,51` [VERIFIED] | `internal const int BatchSize = 500;` · `public int Order => 10;` · `public string Name => "purge-expired-records";` |
| Job registration | `src/Csps.Infrastructure/Maintenance/MaintenanceRegistration.cs:22` [VERIFIED] | `services.AddScoped<IMaintenanceJob, PurgeExpiredRecordsJob>();` |
| Monthly schedule | `.github/workflows/maintenance.yml:9` [VERIFIED] | `- cron: "17 19 1 * *"` |
| Public pages | `src/Csps.Server/Endpoints/PublicRouteTable.cs:55-58` [VERIFIED] | `("/", PublicPage.Home),` `("/products", PublicPage.Products),` `("/gallery", PublicPage.Gallery),` `("/contact", PublicPage.Contact),` |
| Public paths fixture | `tests/fixtures/public-paths.json:1` [VERIFIED] | `{ "pages": ["/", "/products", "/gallery", "/contact"] }` |
| Range presets | `web/src/lib/url-state/parsers.ts:124,128` [VERIFIED] | `export const RANGE_PRESETS = ['today', 'last-7-days', 'last-30-days', 'this-month', 'last-month', 'this-year'] as const;` · `export const CUSTOM_RANGE = 'custom';` |
| Range messages | `src/Csps.Application/Audit/ListAuditLogRequestValidator.cs:23,26,78` [VERIFIED] | `"Enter a real date."` · `"The start date must be on or before the end date."` · `$"Choose a date from {floor.ToString("MMM d, yyyy", CultureInfo.InvariantCulture)} to today."` |
| Audit retention constant | `src/Csps.Domain/Auditing/AuditRetention.cs:7` [VERIFIED] | `public const int Months = 8;` |
| UA family labels | `src/Csps.Domain/Auditing/UserAgentFamily.cs:17-47` [VERIFIED] | `Bot = "Bot"`, `FacebookInApp = "Facebook in-app"`, `InstagramInApp = "Instagram in-app"`, `Edge`, `Opera`, `SamsungInternet = "Samsung Internet"`, `Firefox`, `Chrome`, `Safari`, `Other`, `Unknown`; bot tokens `"bot"`, `"crawl"`, `"spider"`, `"slurp"`, `"facebookexternalhit"` (lines 68-69) |
| ConfirmDialog dismiss label | `web/src/components/overlays/ConfirmDialog.tsx:48,95` [VERIFIED] | `cancelLabel?: string;` · `cancelLabel = 'Cancel',` |
| E2E origin | `web/playwright.config.ts:21` [VERIFIED] | `const origin = 'https://localhost:5199';` |
| Module layout rule | `web/src/test/source-layout.node.test.ts:55,57` [VERIFIED] | `expect(entries('modules', 'dir')).toEqual(['admin', 'public']);` · `toEqual(['components', 'hooks', 'pages', 'services'])` |

## Legal Content Notes (for the planner's drafts; the owner approves, D-09)

General information, not legal advice.
- **RA 10173 data subject rights** to name in "Your rights": to be informed, to access, to object, to erasure or blocking, to rectification, to damages, to data portability, and to lodge a complaint with the NPC [ASSUMED: RA 10173 Sec. 16 to 18 from training knowledge; compare against privacy.gov.ph].
- **NPC Circular 2023-04 (Guidelines on Consent)** took effect 27 May 2024; it sets general consent rules (freely given, specific, informed, evidenced, withdrawable) and has no cookie-specific rule [CITED: digitalpolicyalert.org and Legal500 summaries; MEDIUM]. Opt-in for visitor stats, equal Reject, granular choices and easy withdrawal meet that standard.
- **Complaint route:** the NPC accepts written complaints (Complaints-Assisted Form, Complaint-Affidavit template from 1 July 2025); guides say to raise the matter with the controller first. Whether the 15-day prior notice is mandatory is disputed in secondary sources [CITED: privacy.gov.ph complaint pages via search; LOW]. Word it as "You can complain to the National Privacy Commission at privacy.gov.ph. We ask that you contact us first so we can fix it."
- **Lawful basis per purpose** (helps the owner's review): orders and quotes = contract; tax and bookkeeping records = legal obligation (D-01 "kept for good"); staff accounts and the audit log = legitimate interest in security; visitor stats and the map = consent.
- **"Who else handles it":** the web host, Cloudinary (photos), the email sender, and Google (only when the map is allowed). The owner should confirm the list and where the host keeps the data; do not write data-centre or server names [ASSUMED: A9].
- **Terms:** RA 7394 (Consumer Act) and RA 11967 (Internet Transactions Act of 2023). No payment share, turnaround or refund promise unless the owner gives one (UI-SPEC L4).
- **Cookie Policy inventory:** Necessary: `__Host-csps_consent`, `__Secure-csps_rt`, `__Secure-csps_2fa`, the staff marker; the admin's own browser-storage settings (theme, orders view) for staff. Visitor stats: `__Secure-csps_vid`. Google map: Google's own cookies, linked to Google's policy. Lifetimes must match the code: the Cookie Policy test should read the cookie constants.
- **Optional:** serve `/.well-known/gpc.json` `{ "gpc": true, "lastUpdate": "YYYY-MM-DD" }` [CITED: w3c.github.io/gpc]. It is a public statement, so it needs the owner's OK (Open Question 4).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `onFID` | `onINP` | web-vitals 5.0.0 removed FID | Measure INP only |
| `sendBeacon` only | `fetch(..., { keepalive: true })` in all target browsers | Firefox 133 | One transport with headers |
| Derived ("rotating") salts from a master key | Random daily salts that are deleted | Privacy-first analytics practice | Hashes become unlinkable after 2 days |
| Third-party analytics scripts | First-party beacons, same origin | n/a | No CSP change, no third-party cookies |

**Deprecated/outdated:** `ua-parser-js` 2.x is AGPL (forbidden). web-vitals soft-navigation reporting (`reportSoftNavs`) needs Chromium 151+ and is opt-in: leave it off; speed numbers describe the landing load.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Safari caps `document.cookie` cookies at 7 days; server-set cookies are not capped for a same-site server | Pattern 2, Pitfall 5 | iPhone visitors re-asked weekly; mitigated by server-set cookies anyway |
| A2 | Traffic is a few hundred page views a day, so raw tables stay in tens of MB | Pattern 1 | Larger DB; the purge bounds it |
| A3 | Speed numbers are not rolled up; ranges older than 13 months show "Not available" for speed | Pattern 5 | Owner may want old speed; would need daily histogram tables |
| A4 | EF Core 10 translates `DateOnly.Year/Month` group keys and `Distinct().Count()` on SQL Server; no `PERCENTILE_CONT` translation | Pattern 5 | Verify early with an integration test; fall back to in-memory grouping of a bounded result |
| A5 | Analytics bot tokens (`HeadlessChrome`, `Lighthouse`, `PTST`) and the device-class rules (iPad as Computer) | Pattern 3 | Small count drift |
| A6 | Reject after Accept stops collection and expires the visitor id, but does not delete past rows (Clear does) | Pattern 2 | Owner may expect withdrawal to delete |
| A7 | GPC alone creates no consent record; the flag is stored on decisions made under GPC | Pattern 2 | Owner may want a GPC record per browser |
| A8 | Clear leaves daily totals (no visitor id) in place, and `localStorage.clear()` also resets a staff member's admin theme and orders view in that browser | Pattern 4 | Wording in the Cookie Policy; minor staff annoyance |
| A9 | The processors list (host, Cloudinary, email sender, Google) and their data locations | Legal notes | Privacy Policy accuracy |
| A10 | Facebook/Instagram in-app browsers often send no referrer; Messenger's UA carries `FBAN` | Pitfall 11 | Facebook under-counted |
| A11 | Playwright `devices[...]` UAs do not contain bot tokens | Pitfall 10 | E2E journeys dropped by the bot filter |
| A12 | RA 10173 rights list (Sec. 16 to 18) | Legal notes | Draft wording; the owner reviews |
| A13 | A staff marker cookie is the right way to meet D-21 (Claude's discretion: cookie names) | Pitfall 7 | Listed in the Cookie Policy under Necessary |

## Open Questions (owner, plain words, recommendation first)

1. **The cleanup runs once a month, so "kept for 13 months" really means up to about 14 months.**
   - What we know: the maintenance run is monthly (Phase 9 D-21); the Privacy Policy lines are verbatim "Kept for 13 months".
   - Options: **A (recommended):** add a weekly run to the same workflow (one line, free, reversible); the extra data lives at most a week. **B:** keep monthly and change the policy line to "about 13 months; removed at the next monthly cleanup". **C:** delete at 12 months so nothing passes 13 (the stats page then loses its last month of visitor counts).
   - Note: a weekly run also runs the other monthly jobs weekly (photo removals sooner, usage report weekly).
2. **Facebook app visitors often arrive with no "came from" information.** Options: **A (recommended):** when the referrer is empty and the browser is the Facebook, Messenger or Instagram app, record the app name. Nothing extra is sent from the phone; the server already sees the browser type. **B:** show them as "Direct".
3. **Speed tool package:** approve `web-vitals` 6.2.3 (Apache-2.0, free, no advisories, 41 days old, no install scripts, about 3 KB, loaded only after "Visitor stats" is allowed)? **A (recommended):** yes. **B:** no; then only loading speed and layout shifting are measured, with our own code, and "Response to taps" stays empty.
4. **Publish a GPC statement file** (`/.well-known/gpc.json` saying the site honors the "do not track" signal)? **A (recommended):** yes, it matches D-20. **B:** no.
5. **Confirm the "Who else handles your data" list** for the Privacy Policy (web host, Cloudinary for photos, the email sender, Google for the map when allowed). Needed before the Privacy Policy draft is final.
6. Lower priority, recommended as written unless the owner says otherwise: A6 (withdrawal does not delete past records), A7 (no record for GPC alone), A8 (Clear also resets a staff member's admin theme in that browser).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | build, tests, migrations | ✓ | 10.0.402 | — |
| Node | web build, tests, maintenance script | ✓ | 24.21.0 | — |
| npm registry | `web-vitals` install (after approval) | ✓ | — | first-party LCP/CLS reader |
| gitleaks | pre-commit secret scan | ✓ | 8.30.1 | — |
| LocalDB `(localdb)\MSSQLLocalDB` | integration tests (`CSPS_TEST_SQL=localdb`) | not probed (no DB work in research) | — | CI container |
| Live site and admin login | D-133 gallery photo check | owner only | — | park in backlog when away |
| GitHub secret `MAINTENANCE_KEY` / host `Maintenance__Key` | the retention job in production | owner action pending (STATE 09-12, 09-22) | — | jobs still testable locally |

**Missing dependencies with no fallback:** none for building and testing. Production purges depend on the Phase 9 maintenance secrets the owner still has to set.

**D-133 carry-over:** an owner-only task: in the live admin, add one Gallery photo marked shown, then open `/gallery` on a phone and confirm it loads from `res.cloudinary.com` with no CSP error in the console. Plan it as its own `checkpoint:human-verify` with no code dependency; park it in the backlog in away mode.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | .NET: xunit.v3 (MTP v2), Shouldly, NSubstitute, `FakeTimeProvider`, ArchUnitNET. Web: Vitest 5.0.4, RTL, MSW 3.0.1, in-house axe matcher. E2E: Playwright 1.63.0 + @axe-core/playwright 4.13.0 |
| Config file | `tests/Directory.Build.props`, `web/vite.config.*` (Vitest), `web/playwright.config.ts` |
| Quick run command | `dotnet test --project <touched test project> --filter-class "*<Class>*"` (with `CSPS_TEST_SQL=localdb` set for that process only) or `npm --prefix web run test -- --run <touched path>` |
| Full suite command | after preflight: `dotnet test Csps.slnx` and `npm --prefix web run verify`; phase gate adds `npm --prefix web run e2e` and `npm --prefix web run lighthouse` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANL-01 | Bar shows with no/old/expired choice; never under GPC or on `/admin`; Accept and Reject equal classes and size, neither focused | component | `npm --prefix web run test -- --run src/modules/public/components/ConsentBar.test.tsx` | ❌ Wave 0 |
| ANL-01 | `needsChoice` rules and pending landing view sent exactly once | unit | `npm --prefix web run test -- --run src/modules/public/hooks/useConsent.test.tsx src/modules/public/hooks/usePageViewBeacon.test.tsx` | ❌ |
| ANL-01 | First visit sets no cookie and makes no map or web-vitals request before a choice | e2e | `npm --prefix web run e2e -- --grep @consent` | ❌ |
| ANL-02 | `Sec-GPC: 1` forces stats off on consent and drops identified collect | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ConsentEndpointTests*"` | ❌ |
| ANL-02 | GPC browser: no bar, stats locked, map allowed | e2e | `npm --prefix web run e2e -- --grep @gpc` | ❌ |
| ANL-03 | Footer row on both variants opens CS1 and returns focus | component | `npm --prefix web run test -- --run src/modules/public/components/SiteFooter.test.tsx` | ✅ (extend) |
| ANL-04 | Clear deletes only the cookie's visitor rows, expires `__Secure-csps_vid`, logs a reset with a new consent id, same answer with no cookie | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AnalyticsClearTests*"` | ❌ |
| ANL-04 | Browser storage cleared only after server success; consent cookie kept | component + e2e | `npm --prefix web run test -- --run src/modules/public/components/ClearDataDialog.test.tsx` · `npm --prefix web run e2e -- --grep @consent` | ❌ |
| ANL-05 | Path cut at `?`/`#`, mapped to a page key; admin/dev dropped | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AnalyticsPathTests*"` | ❌ |
| ANL-05 | Referrer grouping (D-28), device class, OS family, bot tokens | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*ReferrerNameTests*"` (and `*DeviceClassTests*`, `*AnalyticsBotTests*`) | ❌ |
| ANL-05 | Sessionizing at 30 min, IP stored only as HMAC of the prefix with the day salt, visitor stored only as hash | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*AnalyticsStoreTests*"` | ❌ |
| ANL-05 | Staff marker or bearer adds nothing, not even the anonymous count (D-21) | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*PageViewCollectTests*"` | ❌ |
| ANL-05 | Speed reader loads only with consent; beacon sends `pathname` only | unit | `npm --prefix web run test -- --run src/modules/public/hooks/useSpeedReport.test.tsx` | ❌ |
| ANL-06 | Without the visitor-id cookie only `DailyPageCounts` changes | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*PageViewCollectTests*"` | ❌ |
| ANL-07 | Cookie codec round-trips and rejects bad values (shared fixture, both sides) | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*ConsentCookieTests*"` · `npm --prefix web run test -- --run src/modules/public/consentCookie.test.ts` | ❌ |
| ANL-07 | Every decision inserts a record; stale version answers 409 and records nothing | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ConsentEndpointTests*"` | ❌ |
| ANL-08 | Range validator messages, 3-year floor, preset resolution in the business calendar | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*VisitorStatsRequestValidatorTests*"` · `npm --prefix web run test -- --run src/modules/admin/visitorStatsRange.test.ts` | ❌ |
| ANL-08 | Totals, buckets, 13-month cut, shares, p75 and ratings | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*VisitorStats*"` · `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*VisitorStatsReaderTests*"` | ❌ |
| ANL-08 | CSV header, one row per day, zeros, empty cells, BOM, no formula-start cell | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*VisitorStatsCsvTests*"` | ❌ |
| ANL-08 | Manager 200, Admin 403, anonymous 401 for stats and export | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationMatrixTests*"` | ✅ (add rows) |
| ANL-08 | Text mode in httpClient (allow-listed content type) | unit | `npm --prefix web run test -- --run src/core/api/http/httpClient.test.ts` | ✅ (extend) |
| ANL-08 | Page renders, chart keyboard, URL range, export | component + e2e | `npm --prefix web run test -- --run src/modules/admin/pages/VisitorStatsPage.test.tsx src/components/data/VisitorTrendChart.test.tsx` · `npm --prefix web run e2e -- --grep @visitor-stats` | ❌ |
| ANL-09 | Rollup then purge at 13 months, consent at 13 months, daily at 3 years, salts after 2 days; budget and failed-line behaviour | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*AnalyticsRetentionJobTests*"` | ❌ |
| LEGAL-01 to 04 | Each page: one h1, sections in TOC, LegalFacts from settings, email from the separate read, axe clean | component | `npm --prefix web run test -- --run src/modules/public/pages/PrivacyPolicyPage.test.tsx` (one per page) | ❌ |
| LEGAL-01 | The email never appears in Home, Contact, 404 HTML, boot JSON or JSON-LD | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ShellPageTests*"` | ✅ (extend) |
| LEGAL-05 | Server, web and `legal-pages.json` agree; DRAFT pages `noindex` and out of the sitemap | node + integration | `npm --prefix web run test -- --run src/test/legal-pages.node.test.ts` · `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SeoEndpointTests*"` | ❌ / ✅ |
| All | OpenAPI snapshot and generated client in sync | contract | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests*"` · `npm --prefix tools/openapi-gen run check` | ✅ |
| All | Every new POST covered or allow-listed (SEC-06); every action has a policy | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*IdempotencyCoverageTests*"` · `--filter-class "*AuthorizationCoverageTests*"` | ✅ (add entries) |
| All | Layer rules; no new trigger; format | arch / schema | `dotnet test --project tests/Csps.ArchitectureTests` · `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*AuditLogAppendOnlyTests*"` · `dotnet format Csps.slnx --verify-no-changes` | ✅ |
| PERF | Public initial JS ≤ 150 KB gz; bar, CS1, CS2, speed reader in own chunks | build gate | `npm --prefix web run verify` | ✅ |

### Sampling Rate
- **Per task commit:** the quick command for the touched test file.
- **Per wave merge:** `dotnet test Csps.slnx` and `npm --prefix web run verify` (after preflight).
- **Phase gate:** full suite plus `npm --prefix web run e2e` and `npm --prefix web run lighthouse` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/fixtures/legal-pages.json` and `tests/fixtures/consent-cookie-cases.json`
- [ ] `web/e2e/fixtures.ts`: default "decided" consent cookie so Phase 11 specs keep passing; opt-out for `@consent`, `@gpc`, `@visitor-stats`
- [ ] Testing-only analytics seeding (the `TestingFixturesController` pattern, Testing environment only) for E2E ranges older than 13 months
- [ ] E2E server config: raised `RateLimits:AnalyticsCollect` / `Consent` / `AnalyticsClear`
- [ ] Authorization matrix rows, anonymous allow-list entries and idempotency allow-list entries for every new action

**TDD candidates (pure, fast, write the failing test first):** `AnalyticsPath`, `ReferrerName`, `DeviceClass`, analytics bot tokens, `ConsentCookie` codec (C# and TS on one fixture), `VitalRating`, nearest-rank `Percentile`, largest-remainder shares, bucket choice (62-day rule), 13-month cut and 3-year floor date math, CSV writer, the pending-landing-view state machine, `needsChoice`, `AnalyticsRetention` constants.

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | Existing; the staff marker is set and cleared with the refresh cookie |
| V3 Session Management | yes | Cookie attributes: `__Host-`/`__Secure-` prefixes, Secure, SameSite, HttpOnly for the visitor id and staff marker; narrow paths |
| V4 Access Control | yes | `Policies.Manager` on stats and export; authorization matrix; Clear bound to the HttpOnly cookie only |
| V5 Validation | yes | FluentValidation in handlers plus zod mirrors (OR-3); path, host and metric bounds; size limit |
| V6 Cryptography | yes | `HMACSHA256`, `RandomNumberGenerator`/`ISecureRandom`, SHA-256 of the visitor id; no custom crypto |
| V7 Logging | yes | Never log path, referrer, UA, IP or cookie values; `LoggerMessage` fixed templates |
| V8 Data Protection | yes | Minimization, retention jobs, no IP in clear, consent proof |
| V13 API | yes | `X-CSPS-CSRF` on every new anonymous POST, JSON only, rate limits, ProblemDetails |
| V14 Config | yes | CSP unchanged; rate limits from validated configuration |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Beacon flooding or count inflation (CWE-770, CWE-799) | Tampering / DoS | Per-address rate limit, 2 KB body limit, bot filter, page-key allow-list, CSRF header (blocks cross-site form posts) |
| Storage growth from crafted values (CWE-400) | DoS | Page keys only, referrer host length cap and grouping, retention jobs |
| Consent spoofing / CSRF-induced tracking (CWE-352) | Spoofing | `RequireCsrfHeader`; the visitor id is issued only by the server with a logged decision; `Sec-GPC` enforced server-side |
| IDOR on Clear (CWE-639) | Information disclosure / Tampering | No id in the request; the HttpOnly 256-bit visitor id selects the rows; stored hashed; same answer either way |
| Formula injection in CSV (CWE-1236) | Tampering | Dates and integers only; a test rejects formula-start cells |
| Log forging (CWE-117) | Repudiation | No request-supplied text in logs |
| ReDoS on UA or referrer (CWE-1333) | DoS | Substring scans with a 512-character cap, no regex (existing `UserAgentFamily` rule) |
| Stats exposure to Admin or anonymous (CWE-200, CWE-285) | Information disclosure | Manager policy, matrix rows, loader redirect in the client |
| Email exposure beyond legal pages | Information disclosure | Separate read; shell test (Pitfall 1) |
| Re-identification from IP (privacy) | Information disclosure | /24 and /48 truncation, HMAC with a random daily salt deleted after 2 days |
| Cookie tossing from a subdomain | Spoofing | `__Host-` prefix for the consent cookie |

## Sources

### Primary (HIGH confidence)
- Codebase, read this session: `src/Csps.Application/Maintenance/IMaintenanceJob.cs`, `src/Csps.Infrastructure/Maintenance/PurgeExpiredRecordsJob.cs`, `MaintenanceRegistration.cs`, `.github/workflows/maintenance.yml`, `src/Csps.Server/Security/{AuthCookies,RateLimitSettings,RateLimitingRegistration,RequireCsrfHeaderAttribute}.cs`, `src/Csps.Server/Http/SecurityHeadersMiddleware.cs`, `src/Csps.Server/Endpoints/{PublicRouteTable,PublicPageHeads,ShellPage,SeoEndpoints}.cs`, `src/Csps.Domain/Auditing/{IpPrefix,UserAgentFamily,AuditRetention}.cs`, `src/Csps.Domain/Identity/DeviceSummary.cs`, `src/Csps.Application/Content/PublicSiteDto.cs`, `src/Csps.Application/Audit/ListAuditLogRequestValidator.cs`, `web/src/core/api/http/httpClient.ts`, `web/src/layouts/PublicLayout.tsx`, `web/src/lib/url-state/parsers.ts`, `web/src/modules/admin/auditRange.ts`, `web/playwright.config.ts`, `web/package.json`, `tests/fixtures/public-paths.json`
- npm registry (`npm view`, advisory bulk endpoint) and the GSD package-legitimacy seam for `web-vitals` 6.2.3; `npm view ua-parser-js license`
- Node probe of `Response.text()` BOM handling (output pasted in Pitfall 3)

### Secondary (MEDIUM confidence)
- [web-vitals CHANGELOG](https://github.com/GoogleChrome/web-vitals/blob/main/CHANGELOG.md) and [README](https://github.com/GoogleChrome/web-vitals/blob/main/README.md): API, thresholds, browser support, late loading
- [W3C Global Privacy Control](https://w3c.github.io/gpc/): `Sec-GPC: 1`, `navigator.globalPrivacyControl`, `/.well-known/gpc.json`
- Firefox `keepalive` in 133: [Mozilla intent to ship](https://groups.google.com/a/mozilla.org/g/dev-platform/c/IN7wT_r1jJI), [caniuse Request keepalive](https://caniuse.com/mdn-api_request_keepalive)
- NPC Circular 2023-04: [digitalpolicyalert.org](https://digitalpolicyalert.org/event/15573-adopted-national-privacy-commission-guidelines-on-consent-circular-no-2023-04), [Legal500 Philippines cookies](https://www.legal500.com/developments/thought-leadership/philippines-cookies-similar-technologies/)

### Tertiary (LOW confidence)
- NPC complaint process summaries: [privacy.gov.ph](https://www.privacy.gov.ph/), [Baker McKenzie on the Complaint-Affidavit template](https://insightplus.bakermckenzie.com/bm/data-technology/philippines-npc-releases-complaint-affidavit-template-for-data-privacy-violations), [Respicio NPC complaint guide](https://www.respicio.ph/commentaries/national-privacy-commission-complaint-guide-philippines)
- Facebook in-app referrer behaviour: vendor blogs only ([Huffington Post on Bitly and Facebook](https://www.huffingtonpost.com/entry/how-bitly-and-facebook-cl_us_5bb3790ee4b0fa920b99ff3a), [Mozilla bug 1568341](https://bugzilla.mozilla.org/show_bug.cgi?id=1568341))

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Everything is installed except `web-vitals`, which was checked on the registry, the advisory database and the legitimacy seam.
- Architecture: HIGH for the seams (read in the source); MEDIUM for the EF translation details (A4: prove early with one integration test).
- Pitfalls: HIGH for the repo-specific ones (1, 2, 3, 4, 7, 8, 9: from source or a probe); MEDIUM/LOW for browser and Facebook behaviour (5, 10, 11).
- Legal: LOW by design. The owner approves the text (D-09); a lawyer review is in the backlog.

**Research date:** 2026-11-15
**Valid until:** 2026-12-15 (stable stack); recheck `web-vitals` for a newer patch at install time and apply the 14-day rule to it.

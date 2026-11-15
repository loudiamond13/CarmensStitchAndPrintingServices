---
phase: "11"
slug: "public-site-content-management"
created: "2026-11-11T12:40:00-06:00"
updated: "2026-11-11T12:40:00-06:00"
---

# Phase 11: Public Site & Content Management - Research

*Created: 2026-11-11T12:40:00-06:00 · Updated: 2026-11-11T12:40:00-06:00*

**Researched:** 2026-11-11
**Domain:** server-shaped SPA shell (OG, JSON-LD, real 404) on ASP.NET Core 10; public content model in EF Core 10; cached anonymous reads with ETag; React 19 public pages under a 150 KB gz budget; Cloudinary strict named sizes; Manager content admin
**Confidence:** MEDIUM-HIGH (codebase facts HIGH; Facebook crawler and HybridCache payload edge MEDIUM)

<user_constraints>
## User Constraints (from CONTEXT.md)

Copied from `11-CONTEXT.md`. All rulings: owner, 2026-11-11.

### Locked Decisions

**Products and prices (C-21: closed)**
- **D-01:** **Product lines live in the database** (the hybrid `ProductLine`). Each line has a title, short name, number, lead/description, the five customize texts, an optional "starts at" price, an optional minimum quantity, display order and an active flag. No separate per-line price items. **Reversibility:** costly. The new tables come from a migration; going to a price-item model later means a new schema and moving data.
- **D-02:** **A Manager uploads up to 3 photos per line** (main, back view, fabric detail) through the Phase 9 upload pipeline. Until a slot has a photo, the design's drawn jersey placeholder shows.
- **D-03:** **The Gallery filter pills are the product lines.** Hiding or adding a line changes the pills. "See {short} work" opens the Gallery filtered to that line.
- **D-04:** **No price entered:** the price line reads "Message us for a price" and no price or placeholder shows. A line can go public without a price.
- **D-05:** **Testimonials are typed in by a Manager** (quote, name, team, 1 to 5 stars), ordered and hidden like other content.
- **D-06:** **At go-live, the six lines hold the UI-SPEC §7 text** (titles, descriptions, customize texts) with prices blank, and a Manager reviews it and adds prices before cutover. The production database must get this content without breaking the "nothing seeds or migrates at startup" rule and the dev seed's `CSPS_Dev`/`CSPS_E2E`-only guard: the planner picks the mechanism (for example migration data in the reviewed idempotent script) and states it in the plan.
- **D-07:** **The five customize cards are fixed** (Fabric, Collar style, Cut & fit, Names & numbers, Logos & sponsors, with their icons and order). A Manager edits only the text under each one, per line.
- **D-08:** **Delete only when unused.** A line that gallery items, order product types or photos still use cannot be deleted; the Manager is told to hide it instead. Hidden lines and everything filed under them leave the public site, and nothing is lost.
- **D-09:** **Order product types link to product lines.** The existing staff-side `ProductType` list (Phase 7 D-18) stays separate. A Manager links each order product type to at most one public line (for example "Basketball jersey" and "Basketball shorts" to Basketball Jerseys). A public order is filed under a line automatically from its items, and the person making it public can change the line for that order. Unlinked types (repairs, hemming) never file anything publicly. **Reversibility:** costly. It adds a foreign key on `ProductTypes` and the filing rule other features read.

**Gallery and privacy (C-12: closed)**
- **D-10:** **Photos come from orders, plus direct uploads.** Recent work and the Gallery show orders that staff made public. The Gallery also takes direct uploads (photo, team, line, pieces, note) for old work with no order in the system (GAL-03).
- **D-11:** **An order needs a "Customer said OK to show" box before it can go public.** It is off by default, including for every migrated order. This replaces the Phase 9 deferred idea "public by default, Manager hides" (09-CONTEXT Deferred, 2026-10-31) because of the Data Privacy Act. The Privacy Policy wording is Phase 12 (LEGAL-01). **Reversibility:** costly. It is a new order column, and it is the consent record the privacy policy relies on.
- **D-12:** **All photos of a public order show.** No per-photo choice.
- **D-13:** **Public text for an order:** team name, product line and total pieces. The team name comes from the order and staff can set a different public team name (for example to hide it). The customer's own name, phone, email, prices and notes never reach any public response.
- **D-14:** **Recent work on Home = the 6 newest public orders, automatically.** No separate "feature on Home" step.
- **D-15:** **Unticking "Customer said OK" or deleting the order removes it from the public site at once** (cache invalidated like any content change). The private order photos are kept.
- **D-16:** **Admin and Manager can both tick "Customer said OK" and make an order public**, from the order screens. This is the one public-content action not limited to Managers; everything else in this phase is Manager only (Phase 4 policy). The change is audited. **Reversibility:** reversible. It is one policy on the endpoint plus the authorization-matrix rows.

**Contact page and quotes (C-36 scope check: closed)**
- **D-17:** **The quote form ships this release, in Phase 13**, as the roadmap has it. Phase 11 builds Contact so the form can slot in without a redesign.
- **D-18:** **Until Phase 13, the left column is a large Messenger and call card**: "Message us on Messenger" and "Call us" buttons plus a short line on what to send (team, quantity, design). Mark it `// SPEC-GAP: contact before quote form`.
- **D-19:** **"Get a Quote" buttons keep their label and go to `/contact`** everywhere (header, drawer, hero, product sections, final CTA, gallery).
- **D-20:** **Embedded Google map, tap to load.** Contact shows a map preview card with a "Show map" button, and the Google iframe loads only after the tap. Once Phase 12's consent exists, a visitor who has allowed it sees the map straight away. CSP gets only the narrow `frame-src` the embed needs, nothing for scripts.
- **D-21:** **Business hours: one open and close time per weekday, or closed.** Holidays and special closures are dates with an optional public note (CONT-04).
- **D-22:** **The closed status says when the shop opens next**, for example "Closed now. Opens Monday 9:00 AM", or the closure note on a closure date ("Closed today for Christmas"). Computed in `Asia/Manila` through `IBusinessCalendar`.
- **D-23:** **Several phone numbers; a Manager marks one as the main number.** The Call buttons and the phone-only sticky bar dial the main number, and Contact lists all of them.
- **D-24:** **Social links: fixed Facebook, Instagram and TikTok spots** with their icons. Empty spots are hidden. Messenger stays its own field.
- **D-25:** **The shop email is not shown publicly**: not on Contact, in the footer or in JSON-LD. It stays in site settings for internal use. This overrides the UI-SPEC footer's email line.

**Link previews and admin screens**
- **D-26:** **Share pictures:** a Manager uploads one default share picture for the site. Products uses its first product photo and Gallery uses the newest public photo when they exist; every other page uses the default.
- **D-27:** **One "Site Content" admin area** (Manager only) with tabs: Business info, Hours & closures, Products, Testimonials, Gallery. The "Customer said OK" box and the public toggle sit on the order screens (D-16), not here. Spec-gap screens follow C-17 (built from existing parts, `// SPEC-GAP:`), and design-vs-WCAG clashes are ruled item by item in `/gsd-ui-phase 11` (OD-14).

**Page speed (LCP carry-over from Phase 3)**
- **D-28:** **Fixes that keep the look come first:** precompressed Brotli files, subsetting fonts to the characters the site uses, and dropping font files a page doesn't need. Measure on the real Phase 11 pages. If LCP is still over 2.0 s, bring the owner before/after screenshots of a font change (for example a system font for body text) and wait for a ruling. Never change the fonts or the look without that ruling.
- **D-29:** **LCP stays report-only in CI after this phase.** The number keeps printing on every run with the 2000 ms target, and `REPORT_ONLY_METRICS` in `web/scripts/lighthouse-assert.mjs` keeps LCP. This supersedes the Phase 3 plan (deferred-items.md, WINDOWS.md entry 1) to empty that list in Phase 11. The 2000 ms target itself is unchanged.

**UI design rulings (owner, 2026-11-11, `/gsd-ui-phase 11`; detail in `11-UI-SPEC.md` § Owner Questions)**
- **D-30 (OQ-1):** the Gallery shows **one tile per order** (its cover photo). The viewer has thumbnails to switch between that order's photos, and Previous / Next go to the next order.
- **D-31 (OQ-2):** caption text over photos sits on a **solid blush band**, with the fade only above it, so it always passes contrast.
- **D-32 (OQ-3):** the Products jump links and Gallery filter pills are **44px** tall (the drawing has 40px).
- **D-33 (OQ-4):** the footer squares are spoken as **"FB, CSPS on Facebook"**, "IG, CSPS on Instagram" and "TT, CSPS on TikTok". Nothing visible changes.
- **D-34 (OQ-5):** each product line has **two text fields**: "Card text" (Home card) and "Description" (Products page).
- **D-35 (OQ-6):** time zone (Asia/Manila) and money format (PHP, en-PH) show on Business Info **read-only**.
- **D-36 (OQ-7):** the "Fast turnaround" promise is an **editable Business Info field**, the "Turnaround line" (optional, at most 120 characters). It starts empty. When it is empty, the card shows a line with no time promise. This field is new in the settings schema.
- **D-37 (OQ-8):** add the `chevron-up` and `globe` icons from the installed lucide-react (no new package).
- **D-38 (OQ-9):** any order **except Cancelled** may be shown on the website, Completed included. Cancelling an order takes it off the website.

**Carried forward (already ruled, not re-asked)**
- **C-35 (02 D-06):** on phones the lightbox has invisible full-height left/right tap zones that are real `<button>`s ("Previous photo" / "Next photo"), focusable with a visible ring; swipe, Esc, ← and → also work.
- **C-17 (04 D-06):** undrawn screens are built from existing parts and marked `// SPEC-GAP:`.
- **OD-14:** design-vs-WCAG clashes are ruled item by item in `/gsd-ui-phase 11`.
- **09 D-01:** order photos use public Cloudinary delivery with random ids; public responses may now carry those addresses for orders made public under D-11.
- **WEB-10:** the Gallery's chosen category lives in the URL.
- Locale `en-PH`, `₱`, Manila time; money is `decimal(18,2)` and computed server-side; no JSON columns; no new triggers (OR-7); no inline SQL.

**Carry-over (ROADMAP Phase 11, D-119):** P10-BL-22 order-number deadlock 500 fix (test first); owner reviews P10-BL-23 and P10-BL-20 item 3; mark UAT 18 and 19 passed; Dependabot alert 6 (minimatch 11.0.1) needs the package check and owner approval.

### Claude's Discretion
- The exact schema, endpoints and cache keys, the server-shaped `index.html` approach for OG tags and JSON-LD (research flag), and how each change invalidates HybridCache and ETags.
- Which gallery photo becomes an order's tile (its cover photo is the natural choice) and the masonry ratios for real photos.
- The audit entries for content edits and public toggles.
- How "pieces" is computed for a public order (the sum of item quantities is the natural reading).

### Deferred Ideas (OUT OF SCOPE)
- Per-photo choice of which order photos go public (the owner chose all photos, D-12). Revisit if staff start posting work-in-progress shots.
- Hours with a lunch break (two time ranges per day): not needed now (D-21).
- A Manager-curated Home strip (pinning or ordering Recent work): automatic for now (D-14).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|------------------------------|------------------|
| PUB-01 | Browse Home, Products, Gallery, Contact per UI-SPEC §7, plus a 404 page (legal pages are Phase 12) | Pattern 1 (server route table + real 404), Pattern 6 (public data layer), budget findings |
| PUB-02 | Prices, lines, address, numbers, hours, Messenger link from the database | Schema sketch (Pattern 3), seed via migration `InsertData` (Pattern 8), placeholder pitfall P-3 |
| PUB-03 | Manager edits all public content and the price list, changes appear at once | Pattern 4 (one invalidation port, ETag from bytes), invalidation matrix |
| PUB-04 | Titles, meta, OG, `LocalBusiness` JSON-LD in server-sent HTML; robots, sitemap; admin noindex; real 404 | Pattern 1, Facebook crawler findings, JSON-LD findings, pitfalls P-1, P-2, P-6 |
| PUB-05 | Open now / Closed now from hours and closures in Asia/Manila | Pattern 5 (pure domain `OpenStatus` on `BusinessClock`) |
| PUB-06 | Messenger (`m.me`) and `tel:` CTAs incl. phone-only sticky bar | E.164 formatting server-side, validation table in UI-SPEC |
| GAL-01 | Masonry gallery, category pills with counts, category in URL | Pattern 7 (gallery entries), WEB-10 nuqs on the Gallery route only, image slots (Pattern 9) |
| GAL-02 | Lightbox: position, wrap, Esc/←/→, swipe plus buttons | Reuse overlay hooks and PhotoViewer recipe; lazy chunk; Playwright map |
| GAL-03 | Manager manages gallery items (upload, team, line, pieces, note, order, publish) | Pattern 7, Phase 9 upload reuse, stray sweep extension (P-9) |
| CONT-01 | Manager edits site settings (name, tagline, address, map link, phones, email, Messenger, socials, hours, about, zone and money read-only per D-35) | Schema sketch, column-keep vs drop open question OQ-R1, SEC-08 mapping |
| CONT-02 | Product lines/price list: name, description, starts-at price, minimum, order, active | Pattern 3, D-08 delete guard, ordering under a lock |
| CONT-03 | Testimonials and the Recent work strip | Recent work is automatic (D-14): it reads shown orders; testimonials as ordered rows |
| CONT-04 | Holiday and closure dates feeding Open now and JSON-LD | Pattern 5, closure overlap check under lock, JSON-LD closure form |
| CONT-05 | Settings and price list cached (HybridCache), ETag and Cache-Control, invalidated on edit | Pattern 4, P-4 (64 KB payload cap), P-5 (weak ETag on compressed HTML) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

The planner must check every plan against these. Sources: `CLAUDE.md`, `.claude/CLAUDE.md`, and the owner's global rules.

- **Stack:** .NET 10 controllers under `/api/v1` (`[ApiController]`, attribute routes, thin actions calling one handler), EF Core 10 Fluent config only, FluentValidation in handlers, `Result<T>` to ProblemDetails, `SuppressModelStateInvalidFilter`. React 19, TS strict, Vite 8, Tailwind 4.3, `react-router` 8 (never `react-router-dom`), TanStack Query 5, RHF + zod 4.
- **Forbidden:** axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit, `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, SpaProxy, Serilog DB sinks.
- **Free only; licenses** MIT, Apache-2.0, BSD, ISC plus recorded exceptions (BlueOak-1.0.0 is already approved for test and tool scope, `docs/license-exceptions.json`). Never GPL/AGPL/SSPL/commercial.
- **Packages:** none new without purpose, license, maintenance, legitimacy check, 14-day cool-down and the owner's yes. Subagents never install silently.
- **Architecture:** onion (Domain ← Application ← Infrastructure ← Server) enforced by ArchUnitNET; no mediator; manual mapping; default-deny (fallback policy needs an authenticated user; every action declares `[Authorize(Policy=...)]` or `[AllowAnonymous]`); authorization matrix covers every endpoint × {anonymous, Admin, Manager}; `rowversion` per aggregate with 409; UTC + `TimeProvider`/`IBusinessCalendar`, never `DateTime.Now`; money `decimal(18,2)` server-side only.
- **Schema:** EF migrations only; app works on an empty DB; **no JSON columns**; drops, renames and lossy changes need the owner first; production gets reviewed idempotent scripts; never `Database.Migrate()` at startup; nothing seeds at startup; dev seed refuses any DB but `CSPS_Dev`/`CSPS_E2E`.
- **No inline SQL** in app code (no `FromSql`, `SqlQuery`, `ExecuteSql`, ADO strings). Use LINQ, `ExecuteUpdate`/`ExecuteDelete`, rowversion.
- **OR-7:** no new database triggers. `TR_AuditLog_AppendOnly` is the only one; a schema test fails on any other.
- **OR-1:** LocalDB default instance, `CSPS_*` databases only; never touch `BetsLLC_*`.
- **OR-2:** minimal, concise comments, no history narration.
- **OR-3:** every form has a zod schema mirroring the API validator; errors inline before any request.
- **OR-4:** no em dash or en dash anywhere in `web/src` (code, copy, comments, alt, title, meta). The `EmptyValue` icon for empty values. U+2212 minus in money stays. This applies to the server-sent meta text too (it is client-visible copy).
- **OR-5:** API calls per module in `modules/{public,admin}/services/`; only `core/api/http` touches `fetch`.
- **OR-6:** owner layout tree in `web/src`.
- **Quality:** TDD (red, green, refactor); zero warnings in build, analyzers, lint, types, tests and browser console; coverage Domain 100 %, Application ≥ 95 %, `core/api` 100 %, web ≥ 90 %.
- **Security:** strict CSP (no `unsafe-inline`/`unsafe-eval`), no `style` attribute or inline script (also in the server-shaped HTML), append-only audit log, CWE Top 25 review, no secrets or infra names in git.
- **A11y:** WCAG 2.2 AA, zero axe violations at component and page level.
- **Perf:** public initial JS ≤ 150 KB gz, admin ≤ 250 KB gz, CSS ≤ 35 KB gz; Lighthouse ≥ 95 mobile; LCP < 2.0 s (report-only per D-29), CLS < 0.05, INP < 200 ms. Never raise a limit to pass.
- **Responsive:** 320 to 1920 px, 44 px targets, no horizontal scroll.
- **Shared machine:** ports 5180, 5115, 7028, 5199 only; run `C:\Work\dev-tools\preflight.ps1` before dev servers, Playwright or full test runs; no machine-level env vars; never read stdin; leave no background shell.
- **Git:** stage by path, never `git add -A`; gitleaks plus a manual look for server/DB names, emails, local paths before each commit; merges only through `tools/scripts/Merge-PullRequest.ps1` on the owner's word.
- **Docs:** every markdown file carries created/updated ISO 8601 timestamps with offset.
- **Workflow:** `/gsd-plan-phase 11 --tdd`; `/gsd-secure-phase 11` and `/gsd-ui-review 11` before ship.

## Summary

Phase 11 replaces the holding page with five real public pages and a Manager "Site Content" area, and it adds the public website controls to the order screens. Almost everything it needs already exists in the codebase: the HybridCache with tag invalidation (`SiteSettingsReader`), the business clock (`BusinessClock`, `IBusinessCalendar`), the Phase 9 upload and Cloudinary pipeline, the overlay hooks and the PhotoViewer recipe, the authorization matrix, the record-stamp interceptor, the database lock rows and the budget plugin. **No new package is needed.** The work is mostly new schema, new handlers and new pages that follow existing patterns.

The research flags resolve as follows. **(1) Facebook's crawler** reads the server's HTML only; Meta's crawler page says the Open Graph properties must sit within the first 1 MB, that the server must honor or ignore its `Range` header, and that it accepts only gzip and deflate encodings; images are cached by URL, so a new share picture needs a new URL (which the random Cloudinary ids already give). Meta's docs do not state outright that the crawler skips JavaScript; treat it as "never runs JS" and prove the tags with a no-JS fetch test. **(2) Server-shaped `index.html`:** replace `MapFallbackToFile` with a GET/HEAD fallback endpoint that fills a marked block in the built `index.html` with per-route `<title>`, meta, canonical, OG, Twitter and JSON-LD, sets the real status (200 for known routes, 404 for the rest, `noindex` for `/admin*`), and caches the rendered page per route under one HybridCache tag. **(3) The 150 KB budget:** today's production public initial JS is **124.85 KB** with the bare holding page; the PublicLayout shell, its header, footer and toasts are not yet counted, and the build rule forbids TanStack Query, nuqs, zod and RHF in public initial chunks. Contact itself is small in Phase 11 (no form), so the real risk is the shared base. Use a tiny public data store over `fetch` plus data shipped inside the server HTML, keep TanStack Query out of the public chunks, and measure in Wave 0 before building pages.

**Primary recommendation:** build in vertical slices behind one Wave 0 "skeleton" that (a) wires the server route table and shaped shell, (b) wires PublicLayout with stub pages into the budget plugin for every public route, and (c) adds the content schema migration with the six seeded lines; then slice by page (Contact and hours first, then Products, Home, Gallery) with each slice carrying its admin tab, its cache invalidation test and its Playwright check.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-route `<title>`, meta, OG, JSON-LD, robots meta, real 404 status | API / Backend (Server host) | Browser (sets the same title on client navigation) | Scrapers do not run JS; only the server can put tags in the first response |
| `robots.txt`, `sitemap.xml` | API / Backend | — | Need the configured public origin and the last content change |
| Public content reads (settings, home, lines, gallery) | API / Backend (Application handlers + Infrastructure cache) | Browser (formats only) | Core Value: every price, count and status is server-computed |
| Open now / Closed now and next opening | Domain (pure function on `BusinessClock`) | API (anonymous endpoint, 60 s cache) | Must use Asia/Manila business time, never the device clock (D-22) |
| Cache and invalidation (HybridCache, ETag, Cache-Control) | Infrastructure (cache) + Server (headers, 304) | Browser (HTTP cache revalidation) | CONT-05; one in-process cache on a single host |
| Content writes (settings, hours, closures, lines, testimonials, gallery) | API / Backend (Manager policy) | Database (constraints, rowversion) | Default-deny, audited, SEC-08 stamped |
| Order public settings (consent, shown, line, public name) | Domain (`Order`) + API (Staff policy, D-16) | Database (new columns) | Consent record and privacy filter belong to the aggregate |
| Privacy filter (only D-13 data public) | Application (public projections) | Tests (backstop) | Projections pick fields; nothing else can leak |
| Photo storage and delivery | Infrastructure (Cloudinary, named sizes) | CDN (Cloudinary) | Strict mode: only named sizes are served |
| Gallery lightbox, filter pills, masonry, hash scroll | Browser | — | Pure interaction; data already loaded |
| Category URL state | Browser (nuqs on the Gallery route only) | — | WEB-10 |
| Static assets (precompressed Brotli) | CDN/Static (Server static files) | Build (Vite plugin writes `.br`) | D-28 option (a) |

## Standard Stack

### Core (all already installed; versions read from `Directory.Packages.props` and `web/package.json` this session)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Microsoft.Extensions.Caching.Hybrid | 10.10.0 | In-process cache with tags (`GetOrCreateAsync`, `RemoveByTagAsync`) for content snapshots and shaped HTML | Already the project's cache (D-10); tag invalidation is in use in `SiteSettingsReader` |
| ASP.NET Core 10 (shared framework) | 10.0.x | Fallback endpoint, static files, response compression, rate limiting | In-box; no package |
| System.Text.Json (in-box) | 10.0.x | Serializing public payloads, JSON-LD and the boot data block; its default encoder escapes `<`, `>`, `&` | Safe embedding in HTML without a library |
| System.Text.Encodings.Web `HtmlEncoder` (in-box) | 10.0.x | Encoding meta attribute values | In-box HTML attribute encoding |
| EF Core SqlServer | 10.0.13 | New content tables and order columns | Project ORM |
| FluentValidation | 12.1.1 | Content validators with the UI-SPEC messages | Project standard |
| CloudinaryDotNet | 1.29.3 | Uploads and the setup command for new named sizes | Phase 9 pipeline |
| react / react-dom | 19.3.0 | Pages | Project standard |
| react-router | 8.4.0 | Public routes, lazy route modules | Project standard |
| nuqs | 2.10.1 | Gallery `category` param (Gallery route only) | WEB-10; already owner-approved |
| lucide-react | 1.53.0 | `chevron-up`, `globe` icons (D-37) | Installed |
| @tanstack/react-query | 5.103.2 | Admin side only (Site Content, order card) | Already in admin chunks |
| react-hook-form 7.89.0 + zod 4.6.7 + @hookform/resolvers 5.9.1 | as installed | Admin forms (OR-3) | Project standard; never in public chunks |

### Supporting (in-repo, reuse)

| Part | Where | Use |
|------|-------|-----|
| `SiteSettingsReader` (HybridCache, tag `site-settings`) | `src/Csps.Infrastructure/Content/` | Pattern to copy for the public content snapshot |
| `BusinessClock`, `IBusinessCalendar` | `src/Csps.Domain/Time/`, `src/Csps.Application/Ports/` | Open status, business "today", copyright year |
| `DatabaseLocks.TakeAsync` | `src/Csps.Infrastructure/Persistence/Locking/` | Ordering moves and closure overlap checks under one new lock row |
| `RecordStampInterceptor` + `IAttributedRecord` | `src/Csps.Infrastructure/Persistence/` | SEC-08 stamps on every new content entity |
| `ImageInspection`, `ImageUploadSettings`, `PublicIds`, `CloudinaryImageDelivery`, `ImageCandidates`, `ImageNamedSizes`, `CloudinarySetupCommand` | `src/Csps.Application/Images/`, `src/Csps.Infrastructure/Images/` | Line photos, share picture, gallery uploads |
| `StraySweepJob`, `ImageRemovalJob`, `IImageInventory` | `src/Csps.Application/Maintenance/` | Must learn the new content folder (P-9) |
| `AppLinksOptions.PublicBaseUrl` (`App:PublicBaseUrl`) | `src/Csps.Infrastructure/Email/AppLinksOptions.cs` | Canonical, `og:url`, sitemap, robots; never the request Host |
| `useFocusTrap`, `useInertOutside`, `useBodyScrollLock`, `photoViewer.recipe` | `web/src/components/...` | Gallery lightbox |
| `prepareImage`, `usePhotoUploadQueue` | `web/src/utils/images.ts`, `web/src/modules/admin/hooks/` | Admin photo slots |
| budget plugin (`budget.ts`, `vite-budget-plugin.ts`) | `web/scripts/` | Extend to measure every public route |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HybridCache + hand-set ETag from cached bytes | ASP.NET Output Caching (`AddOutputCache`, `EvictByTagAsync`) | In-box, does 304 for cached ETags, but a second cache mechanism, skips requests carrying auth cookies (Managers previewing), and keeps the 304 logic outside the handler. Use HybridCache only. |
| A tiny public store over `fetch` | TanStack Query in public chunks | About 8.3 KB gz more on every public page (measured: `query` 5,213 B + `queryClient` 3,077 B) and it breaks the existing PERF-02 build rule. Needs an owner ruling (OQ-R4). |
| Vite plugin writing `.br` files + a small "serve precompressed" step | `MapStaticAssets()` | Framework feature with build-time Brotli and ETags, but non-fingerprinted paths get `no-cache` + ETag (Vite-hashed files lose `immutable`), the files must exist at `dotnet publish`, and the HiddenSegment and SPA fallbacks would need porting. Too big a change for one LCP lever. |
| Named Cloudinary sizes per crop ratio for masonry | Width-limited named sizes + CSS `object-fit: cover` in a clamped `--ratio` box | Strict mode allows named sizes only; per-ratio fills multiply the size list. Width-limit sizes keep the list short. |

**Installation:** none. No package is added. The only package question is the minimatch alert (below).

**Version verification:** versions above were read from the repo files this session. `npm view minimatch@11.0.1` and `npm view minimatch time` were run this session (results in the audit below).

## Package Legitimacy Audit

Phase 11 installs **no new package**. The carry-over Dependabot alert 6 is the only package question. Checked this session (`npm view`, `npm ls`, `gsd-tools package-legitimacy check`, GitHub advisory page):

| Package | Registry | Age (asked version) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|---------------------|-----------|-------------|---------|-------------|
| minimatch 11.0.1 (replaces 10.2.6) | npm | 11.0.1 published 2026-10-27 (15 days; passes 14-day cool-down). Latest 11.0.8 published today. | ~955 M/wk | github.com/isaacs/minimatch | SUS (tool flags "too-new" on the latest version) | Owner decides (OQ-R7). Not installed. |
| @isaacs/nonrecursive-glob-match (new dependency of minimatch 11) | npm | package created 2026-10-26; 1.0.1 from 2026-10-27; latest 1.1.0 | ~26 M/wk | none in registry metadata | SUS ("too-new", "no-repository") | Owner decides. If minimatch 11 is taken, pin this one to a version at least 14 days old. |

**Findings in plain words:**
- The advisory (GHSA-g3hv-75wg-m249, Moderate, CWE-405) affects minimatch 7.0.0 up to 11.0.1 when `optimizationLevel` is 2 or more and an attacker supplies the pattern. Here minimatch is used only by ESLint, typescript-eslint, the license checker and glob: dev tools fed by our own config. No attacker supplies patterns. [VERIFIED: github.com/advisories/GHSA-g3hv-75wg-m249; `npm ls minimatch`]
- There is no fixed 10.x. Every user here asks for `^10` (eslint `^10.2.6` even in its latest 10.14.0; `@typescript-eslint/typescript-estree` `^10.2.2`; `glob` `^10.2.2`). Forcing 11 with an `overrides` entry crosses a major version under all of them. [VERIFIED: `npm view eslint dependencies.minimatch`, `npm view @typescript-eslint/typescript-estree dependencies.minimatch`]
- License stays BlueOak-1.0.0 (10.2.6 was already BlueOak), which the owner approved on 2026-10-07 for test and tool scope. No postinstall script on either package. [VERIFIED: `npm view minimatch@11.0.1 license`; `docs/license-exceptions.json`]
- **Time-critical:** `docs/audit-exceptions.json` holds owner exceptions for both GHSA-g3hv-75wg-m249 (minimatch) and GHSA-3g3m-2fjr-6pw4 (glob), each with `"reviewBy": "2026-11-14"`. After that date the audit gate will fail every Phase 11 CI run unless the owner rules again. [VERIFIED: docs/audit-exceptions.json lines 4-22]

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** minimatch 11.0.1 and @isaacs/nonrecursive-glob-match (only if the owner picks the override). The planner adds a `checkpoint:human-verify` before any change.

## Architecture Patterns

### System Architecture Diagram

```
 Visitor phone / Facebook crawler
        |  GET /, /products, /gallery?category=x, /contact, /anything, /admin/...
        v
 [SecurityHeaders (CSP + frame-src for maps)] -> [ResponseCompression br/gzip for html]
        -> [UseStaticFiles: /assets/*.js (serve .br if accepted), fonts, mark.svg]
        -> [Routing]
              |-- /api/v1/public/*  (anonymous, rate limit "public-read")
              |       -> Handler -> IPublicContentReader (HybridCache, tag "public-content")
              |              -> EF projections (D-13 fields only) -> PublicSnapshot {json, etag}
              |       -> If-None-Match == etag ? 304 : 200 + ETag + Cache-Control: no-cache
              |-- /api/v1/public/open-status -> IBusinessCalendar + cached hours/closures
              |       -> OpenStatus.Compute(clock) -> 200, Cache-Control: public, max-age=60
              |-- /robots.txt, /sitemap.xml (anonymous endpoints, PublicBaseUrl)
              |-- /api/v1/site-content/* (Manager) | /api/v1/orders/{id}/public (Staff, D-16)
              |       -> validate -> domain -> SaveChanges (stamps, rowversion, audit)
              |       -> IPublicContentCache.InvalidateAsync()  (tag "public-content")
              |-- {*path:file} miss -> ProblemDetails 404
              '-- {*path:nonfile} GET/HEAD -> ShellPage endpoint
                      -> PublicRouteTable.Match(path)  (case-insensitive, optional trailing /)
                           known public -> 200 | /admin* -> 200 + X-Robots-Tag | else -> 404
                      -> HybridCache["shell:{route}"] (tag "public-content")
                           -> template(index.html markers) + head(title, meta, canonical, OG,
                              Twitter, JSON-LD) + boot data <script type="application/json">
                      -> on DB failure: plain template head, same status rules
        v
 Browser: entry chunk -> router -> PublicLayout + lazy page chunk
        -> public store reads boot data (no request on first visit), later fetch()+ETag
        -> Gallery route only: NuqsAdapter (category), lazy lightbox chunk on first open
 Admin (Manager) in same browser: TanStack Query -> writes -> also clears the public store
```

### Recommended Project Structure (new parts only)

```
src/Csps.Domain/Content/            SiteSettings (widened), OpeningHours, ShopClosure, ProductLine,
                                    ProductLinePhoto, Testimonial, GalleryEntry, OpenStatus (pure),
                                    PhilippinePhone (parse, E.164), LineKey (slug, allow-list)
src/Csps.Domain/Orders/Order.cs      public settings methods (consent, show, line, public name)
src/Csps.Application/Content/        one handler per use case (Get*/Update*/Move*/Hide*/Delete*),
                                    validators with UI-SPEC messages, public projections
src/Csps.Application/Ports/          IPublicContentReader, IPublicContentCache (invalidate)
src/Csps.Infrastructure/Content/     PublicContentReader (HybridCache), configurations, migration
src/Csps.Server/Controllers/         PublicSiteController (anonymous reads), SiteContent*Controllers
                                    (Manager), OrderPublicSettingsController (Staff)
src/Csps.Server/Endpoints/           ShellPage (route table, head writer), SeoEndpoints (robots, sitemap)
web/src/modules/public/              pages/, components/, hooks/, services/, copy.ts
web/src/modules/admin/               pages/SiteContentPage, ProductLinePage, components/*Tab, services/
web/src/utils/hours.ts               grouping and summaries only, no status math
web/scripts/vite-brotli-plugin.ts    writes .br next to built assets (node:zlib, no package)
```

### Pattern 1: Server-shaped shell with a route table and a real 404

**What:** one GET/HEAD fallback on `{*path:nonfile}` that reads the built `index.html` once, splits it at two marker comments, and writes the head block for the matched route.

**When to use:** every non-file, non-API page path.

**Key rules:**
- Keep the existing pattern string `SpaHosting.ShellPattern = "{*path:nonfile}"` so the authorization matrix keys (`GET {*path:nonfile}`, `HEAD {*path:nonfile}`) stay. [VERIFIED: src/Csps.Server/Endpoints/SpaHosting.cs; tests/.../AuthorizationMatrix.cs lines 303-304, 335-337]
- `MapFallback(pattern, handler)` alone maps **every** method. Today `MapFallbackToFile` limits it to GET and HEAD (comment in `SpaHosting.MapSpaHost`, rule L-01). The new endpoint must add `HttpMethodMetadata(["GET", "HEAD"])` so a POST on a page path still meets default-deny. [ASSUMED: framework behavior; keep the existing L-01 test green]
- Route table mirrors the client router: React Router matches paths case-insensitively by default and tolerates a trailing slash, so `/Products` and `/products/` must be known on the server too, else the server sends 404 for a page the browser renders. Canonical stays lower case without the slash. [ASSUMED: React Router default `caseSensitive: false`]
- Known public paths: `/`, `/products`, `/gallery`, `/contact`. `/admin` and `/admin/*`: 200 with `X-Robots-Tag: noindex, nofollow` and the meta robots tag. `/dev/*`: known only where the dev routes exist (Development and the e2e/Testing host), 404 elsewhere. Everything else: **404 with the shell** and `noindex`. Phase 12 adds the legal paths to the same table.
- Origin for canonical, `og:url`, sitemap and robots: `App:PublicBaseUrl` only, never the request Host (host-header poisoning, as `AppLinksOptions` already says). [VERIFIED: src/Csps.Infrastructure/Email/AppLinksOptions.cs lines 5-20: "Every link is built from <see cref=\"PublicBaseUrl\"/>, never from the request host, so a forged Host header cannot poison a reset link." and `public const string SectionName = "App";`]
- Markers: add `<!--csps:head-->` ... `<!--/csps:head-->` around the default title and description in `web/index.html`, and a test on the built `wwwroot/index.html` (and the fixture `tests/Csps.Testing/Fixtures/webroot/index.html`) that both markers survive the Vite build. Vite does not minify HTML by default. [ASSUMED]
- The template is read through `IWebHostEnvironment.WebRootFileProvider` (already wrapped by `HiddenSegmentFileProvider`), once, with a change token in Development.
- `/index.html` itself is a real static file and would bypass the shaping. Hide it from `UseStaticFiles` (wrap the provider) so the only way to get the shell is through the shaped endpoint; update `SpaHostTests.OtherStaticFilesRevalidate` (it lists `/index.html` and `/robots.txt`). [VERIFIED: SpaHostTests.cs lines 188-190]
- `robots.txt` exists as a static file in `web/public/robots.txt` and in the fixture web root; static files run before endpoints, so it must be deleted for the dynamic one to answer. [VERIFIED: web/public/robots.txt content `User-agent: *` / `Allow: /`; Program.cs runs `UseStaticFiles` before `UseRouting`]
- Failure: if the content read throws, write the plain template head with the same status rules and log once; never 500 the site (UI-SPEC "the server falls back to the plain shell").
- `Cache-Control: no-cache` (as today) plus a **weak** `ETag` (`W/"..."`), because the HTML is compressed with br or gzip after the tag is set. [ASSUMED: RFC 9110 strong-validator semantics]

**Example (shape only):**
```csharp
// Source: pattern built on the existing SpaHosting.MapSpaHost; names are the planner's.
app.MapFallback(SpaHosting.ShellPattern, ShellPage.WriteAsync)
    .WithMetadata(new HttpMethodMetadata(["GET", "HEAD"]))
    .AllowAnonymous()
    .ExcludeFromDescription();

// Head writer: attribute values through HtmlEncoder; JSON through JsonSerializer (default encoder escapes < > &).
var json = JsonSerializer.Serialize(localBusiness, PublicJson.Options);
head.Append("<script type=\"application/ld+json\">").Append(json).Append("</script>");
head.Append("<meta property=\"og:title\" content=\"").Append(HtmlEncoder.Default.Encode(title)).Append("\">");
```

### Pattern 2: What goes in the head (per UI-SPEC § Link previews)

- `<title>`, `meta description`, `link rel=canonical`, `og:type website`, `og:site_name`, `og:locale en_PH`, `og:title`, `og:description`, `og:url`, `og:image` with `og:image:width` 1200, `og:image:height` 630, `og:image:alt`, `twitter:card` (`summary_large_image` with an image, else `summary`), JSON-LD `LocalBusiness` (no `email`, D-25).
- `og:image` must be an absolute JPEG URL at 1200 × 630 (Meta: minimum 200 × 200, 600 × 315 for the large card, about 1.91:1, up to 8 MB; width and height tags let the first share render the image at once). Meta does not list WebP, so use the JPEG share size. [CITED: developers.facebook.com/docs/sharing/webmasters/images/]
- Facebook caches images by URL. A replaced share picture must get a new URL: upload it under a new random public id (the `PublicIds.New` design already does this); never reuse an id. [CITED: same page: "cached based on the URL and won't be updated unless the URL changes"]
- Open Graph tags must be within the first 1 MB, and the server must either answer the crawler's `Range` request with the tags inside the range or ignore `Range`. A custom endpoint ignores `Range` by default; keep the head early and the boot data small. [CITED: developers.facebook.com/docs/sharing/webmasters/web-crawlers/]
- The crawler accepts only gzip and deflate. Response compression negotiates from `Accept-Encoding`, so the crawler gets gzip; never force Brotli. [CITED: same page]
- Add `<link rel="preconnect" href="https://res.cloudinary.com">` on pages with photos (PRD performance notes). [VERIFIED: CSPS-PRD.md line with "Add `preconnect` to `res.cloudinary.com`"]
- JSON-LD closed days: Google documents closures as `openingHoursSpecification` entries with `opens` and `closes` both `"00:00"` plus `validFrom`/`validThrough` (YYYY-MM-DD); it does not mention `specialOpeningHoursSpecification`. UI-SPEC names `specialOpeningHoursSpecification` (valid schema.org). Either validates in schema.org; the planner follows the UI-SPEC and may add a note. Required: `name`, `address`; recommended: `telephone` with country code, `url`, `geo`, `priceRange`. [CITED: developers.google.com/search/docs/appearance/structured-data/local-business]

### Pattern 3: Content schema (relational, no JSON columns)

A sketch for the planner to finalize (Claude's discretion):

| Table / change | Columns (indicative) | Notes |
|---|---|---|
| `SiteSettings` (widen) | Tagline, AboutText, TurnaroundLine (D-36), Street, TownOrCity, Province, PostalCode, DirectionsUrl, MapEmbedUrl, MessengerUrl, InstagramUrl, TikTokUrl, SharePicture (PublicId, Width, Height) | Existing `ContactPhone` and `AddressLine` are replaced by phones and address parts: dropping them is a one-way door (OQ-R1). Existing `FacebookUrl`, `ContactEmail` stay. |
| `SitePhoneNumbers` | Id, Number (normalized), Label, IsMain, Position | 1 to 4 rows; filtered unique index "one main" (`HasFilter("[IsMain] = 1")`); unique number |
| `OpeningHours` (7 rows) | DayOfWeek PK 1..7, OpensAt `time(0)` null, ClosesAt null, CHECK both-or-none and closes > opens | Own concurrency token so Business Info and Hours saves do not 409 each other (P-8) |
| `ShopClosures` | Id, FirstDay `date`, LastDay `date`, Note `nvarchar(80)` null, rowversion, stamps | CHECK LastDay >= FirstDay and span ≤ 31 days; overlap checked in the handler under the content lock |
| `ProductLines` | Id, Key (fixed URL key, unique), Title, ShortName (unique, case-insensitive), Number, CardText, Description, 5 customize text columns (D-07), StartsAtPrice `decimal(18,2)` null, MinimumQuantity int null, Position, IsActive, PlaceholderArt (fixed look id), rowversion, stamps | Delete only when unused (D-08): check photos, gallery entries and linked product types in the handler; FK `Restrict` as the backstop |
| `ProductLinePhotos` | LineId, Slot (0 main, 1 back, 2 fabric), PublicId, Width, Height, Bytes, Format, stamps | unique (LineId, Slot) |
| `ProductTypes` (add) | ProductLineId null FK → ProductLines (`Restrict`) | D-09 |
| `Testimonials` | Id, Quote, Name, TeamOrRole, Stars (CHECK 1..5), Position, IsShown, rowversion, stamps | |
| `GalleryEntries` | Id, Kind (Order/Upload), OrderId null unique, Position (one manual order across kinds), upload fields: PublicId, Width, Height, TeamName, ProductLineId, Pieces, Note, IsShown; stamps, rowversion | One row per shown order (created when shown, kept while shown) plus upload rows; new rows go on top |
| `Orders` (add) | PublicConsentAtUtc, PublicConsentById, ShownOnWebsiteSinceUtc null, PublicProductLineId null, PublicName null | D-11 off by default, migrated orders included (columns null) |
| `DatabaseLocks` (row) | new `site-content` lock row | Serializes moves and closure overlap checks; seeded like the existing `staff-money` row |

- SEC-08: `SiteSettings` today has `CreatedByUserId`/`UpdatedByUserId` and does not implement `IAttributedRecord`, so the stamp interceptor skips it. Map new `IAttributedRecord` properties onto the existing column names with `HasColumnName` (no rename, no owner question). [VERIFIED: src/Csps.Domain/Content/SiteSettings.cs lines 104-111: `public Guid? CreatedByUserId { get; private set; }` ... `public Guid? UpdatedByUserId { get; private set; }`; class declared `public sealed class SiteSettings` with no interface]
- Field lengths: today `BusinessNameMaxLength = 120` and `AddressLineMaxLength = 200`; UI-SPEC validates the name at 100. A tighter validator over a wider column needs no schema change. [VERIFIED: SiteSettings.cs lines 13-34]

### Pattern 4: One public snapshot, one invalidation port, ETag from bytes

**What:** an Application port `IPublicContentReader` returns immutable snapshots (site, home, lines, gallery), each holding the serialized UTF-8 JSON and its ETag; `IPublicContentCache.InvalidateAsync()` calls `RemoveByTagAsync("public-content")` and also clears the existing `site-settings` tag (the business calendar reads the zone through it).

- Copy the existing reader: key versioned (`"csps:public:home:v1"`), tag list, a factory that makes its own `DbContext` from `IDbContextFactory` (the cache factory can outlive the request, WR-01), `[ImmutableObject(true)]` sealed records so L1 returns the same instance. [VERIFIED: src/Csps.Infrastructure/Content/SiteSettingsReader.cs lines 10-37: `internal const string CacheKey = "csps:site-settings:v1";` `internal const string CacheTag = "site-settings";` and `cache.RemoveByTagAsync(CacheTag, cancellationToken)`]
- Server: compare `If-None-Match` to the snapshot ETag; 304 with no body, else 200 with `ETag` and `Cache-Control: no-cache` (so a change shows on the next load, CONT-05 "at once"). Open status: `Cache-Control: public, max-age=60`.
- JSON is never compressed (BREACH rule in `SpaCaching.CompressibleTypes`); public JSON stays uncompressed unless the owner changes that rule. Keep public payloads lean. [VERIFIED: src/Csps.Server/Composition/SpaRegistration.cs: `["text/html", "text/css", "text/javascript", "application/javascript", "image/svg+xml"]`]
- **Invalidation matrix** (each row gets an integration test: write, then the public read returns the new value and a new ETag): settings, share picture, hours, closures (add, edit, delete), lines (add, edit, move, hide, show, delete, photo add/replace/remove), product type link change, testimonials (all actions), gallery uploads (all actions) and moves, and on orders: public settings save, status change into or out of Cancelled, order delete and restore, item add/edit/delete (pieces and the auto line), team name change, order photo add/remove/reorder (cover), product type rename is not public. Simplest safe rule: every order write invalidates when the order is or was shown.

### Pattern 5: Open status as a pure domain function

```csharp
// Source: built on src/Csps.Domain/Time/BusinessClock.cs (LocalNow, Today, Zone).
public sealed record OpenStatus(bool IsOpen, TimeOnly? ClosesAt, DayOfWeek? OpensOnDay, DateOnly? OpensOnDate,
    TimeOnly? OpensAt, string? TodayClosureNote, bool ClosedToday);

public static OpenStatus Compute(BusinessClock clock, IReadOnlyList<DayHours> week, IReadOnlyList<Closure> closures)
// Open when today is not a closure day and OpensAt <= LocalNow.TimeOfDay < ClosesAt (closing minute is closed).
// Next opening: scan today (if before opening) then the next 14 days, skipping closure days; none -> nulls.
```
- Server returns words-ready facts (day, time, whether it is today or tomorrow); the client only formats, never computes (D-22, UI-SPEC "never computed in the browser").
- Times: opening options run 5:00 AM to 11:30 PM and closing must be after opening, so no overnight spans.
- Tests at 8:59, 9:00, 17:59, 18:00 Manila, on a closure day, a Sunday, a closure that covers the next 14 days, and a run across month and year ends. `FakeTimeProvider` pins the instant.

### Pattern 6: Public data without TanStack Query

- Boot data: the shaped shell carries `<script type="application/json" id="csps-boot">` with the site settings and the page's own data (Home, Products, Contact; Gallery fetches, because it can be large). The client reads `textContent` and `JSON.parse`s it once. A data block is not executed, so `script-src 'self'` does not apply; the Playwright CSP listener proves it (UI-SPEC requires this proof for JSON-LD too). [ASSUMED: HTML/CSP data-block behavior; verify with the CSP listener]
- A small store per resource in `modules/public/hooks` (`useSyncExternalStore`) with `staleTime` 5 minutes, calling services in `modules/public/services` that use `core/api/http` (OR-5). The browser HTTP cache handles `If-None-Match` revalidation by itself with `Cache-Control: no-cache` + `ETag`, so no ETag code is needed in the client. [ASSUMED: default `fetch` cache mode revalidates]
- The admin, after a content write, clears the public store in its own browser (UI-SPEC "the admin client invalidates the public query keys").
- This keeps the existing PERF-02 build rule (`PUBLIC_FORBIDDEN_MODULE_PREFIXES` includes `node_modules/@tanstack/`, `node_modules/nuqs/`, `node_modules/react-hook-form/`, `node_modules/zod/`). [VERIFIED: web/scripts/budget.ts lines 146-159]

### Pattern 7: Gallery entries and order public settings

- An order reaches a public response only when: consent recorded, shown, status not Cancelled, not deleted, effective line active, at least one photo. Effective line = `PublicProductLineId` override, else the auto line (linked line with most pieces; tie to display order). Pieces = sum of item quantities. All in one projection that selects only D-13 fields (public name or team, line key and short name, pieces, photo delivery URLs, sizes); never `CustomerName`, `ContactNumber`, `Email`, `Notes`, prices, or `OrderImage.Description`. [VERIFIED: src/Csps.Domain/Orders/Order.cs lines 57-81 show `CustomerName`, `TeamName`, `ContactNumber`, `Email`, `Address`, `Notes`; OrderImage.cs line 59 `Description`]
- Cover photo = the order photo at `Position == 0`. [VERIFIED: src/Csps.Domain/Orders/OrderImage.cs line 40: "the photo at 0 is the cover"]
- Status values: `Pending = 1, Mockup = 2, InProduction = 3, Ready = 4, Delivered = 5, Completed = 6, Cancelled = 7`. [VERIFIED: src/Csps.Domain/Orders/OrderStatus.cs]
- Completed orders are locked by `EnsureEditable` (D-05 of Phase 8); the public settings method must bypass that lock for Completed (D-38) and refuse Cancelled with "Cancelled orders can't be shown on the website." It still bumps `EditVersion` so SEC-08 stamps the order. [VERIFIED: Order.cs line 11 "a Completed or Cancelled order is locked until it is reopened (D-05)"]
- Gallery position: "newly shown order and new upload join at the top"; Move swaps with the visible neighbour (filtered list when a line filter is on). Do swaps under the `site-content` lock; avoid a unique index on `Position` (a swap would collide mid-update).
- Admin and Manager both set public settings (Staff policy); everything else is Manager.

### Pattern 8: Seeding the six lines for production (D-06)

- Use a hand-written `migrationBuilder.InsertData(...)` in the new migration's `Up` with fixed literal Guids, keys `basketball`, `volleyball`, `moto`, `longsleeves`, `polo`, `custom` and the UI-SPEC text, prices null. Do **not** use `HasData` in the model for editable rows: any later edit to a `HasData` value generates an `UpdateData` that overwrites a Manager's text on the next deploy. The idempotent script (`dotnet ef migrations script --idempotent`) runs each migration once, so production gets the rows through the reviewed script, nothing seeds at startup, and the dev seed guard stays untouched. Same for the `site-content` lock row. [ASSUMED: EF `HasData` diffing behavior; the existing `SiteSettings` row uses `HasData` with literal values, VERIFIED: SiteSettingsConfiguration.cs lines 35-46]
- Seeded lines start **hidden or shown per the owner's go-live step** (UI-SPEC § Seeded product line content); see OQ-R2.

### Pattern 9: Image slots under Cloudinary strict mode

- The account allows **named transformations only**; every address is `https://res.cloudinary.com/{cloud}/image/private/t_{name}/v1/{publicId}`. Today there are 13 sizes: squares `csps_sq_44/88/176` (`c_fill,g_auto,.../f_webp`), cards `csps_card_320..960` (16:10), views `csps_view_640..1600` (`c_limit`), and `csps_full_2000` (`f_jpg`). [VERIFIED: src/Csps.Infrastructure/Images/ImageNamedSizes.cs; CloudinaryImageDelivery.cs line with `$"https://res.cloudinary.com/{_cloudName}/image/private/t_{size.Name}/v1/{publicId}"`]
- Phase 11 adds named sizes for the UI-SPEC slots, for example: 4:5 fills (category card 320 to 960, strip 240 to 1060), 1:1 fills (200, 400, 720), width-limited sizes for masonry and the product large cell (the box crops with `object-fit: cover` inside a clamped `--ratio`, so no per-ratio fills), the share picture `c_fill,g_auto,w_1200,h_630/q_auto/f_jpg`, and share previews 320 × 168 and 640 × 336. Then `CloudinarySetupCommand` creates them in the live account: an **owner operational step** before the public photos show (OQ-R6).
- New public ids live outside `{root}/orders/` (for example `{root}/content/lines/...`, `{root}/content/share/...`, `{root}/content/gallery/...`), still random (128 bits).

### Anti-Patterns to Avoid
- **Building OG tags in React** (react-helmet or `document.title` only): scrapers never see them.
- **Using the request Host for canonical or sitemap URLs:** host-header poisoning.
- **Computing open or closed in the browser:** device clock and zone are wrong for visitors abroad.
- **One public endpoint returning the whole `Order`:** privacy leak risk; project to a public record.
- **`HasData` for Manager-editable seed rows:** later deploys overwrite edits.
- **A unique index on display `Position`:** swaps fail.
- **Importing `@/components/*` barrels in public modules:** pulls admin parts into public chunks (PERF-01, documented in `docs/web/budgets.md`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML attribute and script-data escaping | string `Replace` chains | `HtmlEncoder.Default`, `JsonSerializer` default encoder | XSS through Manager-typed text (CWE-79) |
| Cache with invalidation | a static dictionary | HybridCache tags (already used) | stampede protection, one pattern |
| Business time | `DateTime.Now`, offsets | `BusinessClock` / `IBusinessCalendar` | banned symbols; Manila rules |
| Locking for moves and overlaps | `sp_getapplock` or raw SQL | `DatabaseLocks.TakeAsync` | no inline SQL; deadlock handling exists |
| Deadlock mapping (P10-BL-22) | new exception plumbing | copy `StaffMoneyLock`'s `catch ... when (SqlErrors.Has(error, SqlErrors.DeadlockVictim))` | proven fix |
| Image checks and EXIF stripping | new upload code | `ImageInspection`, `prepareImage`, Phase 9 handlers | already hardened |
| Focus trap, inert, scroll lock in the lightbox | new overlay logic | `useFocusTrap`, `useInertOutside`, `useBodyScrollLock` | a11y edge cases solved |
| URL param parsing | `URLSearchParams` by hand | nuqs `parseAsStringLiteral` over the loaded line keys | WEB-10 rules, CWE-601 |
| Brotli compression | a package | `node:zlib` `brotliCompressSync` at quality 11 in a Vite plugin | built into Node 24 |

**Key insight:** the hard parts here (escaping, time, caching, locks, uploads, overlays) are already solved in this repo. New code should be mostly projections, validators and pages.

## Runtime and Live-Service State

Not a rename phase, but the migration and deploy touch state that lives outside git:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Production `SiteSettings` row was seeded with bracket placeholders: `ContactEmail = "[hello@yourdomain.ph]"`, `ContactPhone = "[0917 000 0000]"`, `AddressLine = "[Shop address], [City], Philippines"`, `FacebookUrl = "[Facebook page URL]"`. [VERIFIED: src/Csps.Domain/Content/SiteSettingsDefaults.cs lines 20-30] | Migration must not copy placeholders into the new phone and address columns; the public site hides empty values; the first Business Info save must pass the new validators. A data step: blank `FacebookUrl` and `ContactEmail` if they still hold the brackets (code edit in the migration plus a one-time data update), see OQ-R1 |
| Stored data | Every existing order: new public columns default to null (not shown, no consent) | none beyond the migration; D-11 |
| Live service config | Cloudinary account in strict mode knows only the 13 named sizes | Owner runs the setup command after deploy to create the new sizes (OQ-R6) |
| Live service config | `docs/audit-exceptions.json` exceptions expire 2026-11-14 | Owner ruling before CI fails (OQ-R7) |
| OS-registered state | None: no scheduler on the host; maintenance runs from GitHub Actions. Verified by reading `StraySweepJob` (runs through the maintenance endpoint) | Stray sweep must learn the content folder (P-9) |
| Secrets/env vars | `App:PublicBaseUrl` must be set on the host (already required by email links) | verify it holds the live origin; no new secret |
| Build artifacts | `src/Csps.Server/wwwroot/robots.txt` from `web/public/robots.txt` | remove from `web/public` and the fixture web root |

## Common Pitfalls

### P-1: The real 404 breaks the e2e host or the dev routes
**What goes wrong:** Playwright specs that open `/dev/...` previews or check status codes start seeing 404.
**Why:** the server route table does not know dev-only paths.
**How to avoid:** add `/dev/*` to the table only when the dev routes exist (Development and the Testing host); production returns 404.
**Warning signs:** e2e failures on preview pages; `response.status()` assertions.

### P-2: Case and trailing slash mismatch
**What goes wrong:** `/Products` renders the Products page but the server sent 404 and `noindex`.
**How to avoid:** match the server table case-insensitively with an optional trailing slash; one table, a unit test that compares it with the client route list.

### P-3: Placeholders reach the public site
**What goes wrong:** "[0917 000 0000]" shows in the footer or JSON-LD, or `tel:[0917...`.
**How to avoid:** new columns start empty; validators reject brackets; every public element is hidden when its value is empty; a backstop test greps public responses for `[`.

### P-4: HybridCache payload cap
**What goes wrong:** a large gallery snapshot or shaped page is silently not cached and every request hits the database.
**Why:** `MaximumPayloadBytes` is set to 64 KB for the whole cache (`private const int MaximumCachePayloadBytes = 64 * 1024;`). [VERIFIED: src/Csps.Infrastructure/DependencyInjection.cs line 40] Whether the cap applies to immutable L1-only entries is not confirmed. [ASSUMED]
**How to avoid:** a query-count test: two reads of a 300-item gallery snapshot run zero database commands on the second read. If it fails, raise the cap (still small; the app pool is 256 MB) or split the gallery snapshot.

### P-5: Strong ETag on compressed HTML
**What goes wrong:** caches treat the gzip and br bodies as byte-identical.
**How to avoid:** weak ETags on HTML; strong ETags on uncompressed JSON.

### P-6: Google map iframe noise in tests
**What goes wrong:** the console guard fails on messages from Google's frame, or CI has no network.
**How to avoid:** Playwright routes `https://www.google.com/maps/embed*` to a local stub page; the CSP listener still checks that `frame-src` allows it. CSP line is today `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests` and has no `frame-src`, so frames fall back to `'self'`. Add `frame-src https://www.google.com/maps/embed` (a path without a trailing slash matches that exact path; the query is ignored). [VERIFIED: src/Csps.Server/Http/SecurityHeadersMiddleware.cs `StrictCsp`; path-matching rule ASSUMED from CSP3]
**Note:** `Permissions-Policy` denies geolocation for all frames; that is fine (no `allow` features on the iframe).

### P-7: The public budget is already tight
**What goes wrong:** pages are built, then the build fails at 150 KB.
**Facts:** production public JS today 124,848 B (entry `index-*.js` 112,146 B gz alone) with only the holding page; adding PublicLayout pulls `SiteHeader` (2,797 B), `ToastProvider` (2,477 B) and `PublicLayout` (796 B) in the budget build, plus the shared recipe chunk. [VERIFIED: artifacts/budget/budget.production.json `"publicJs": 124848`; gzip -9 of built chunks this session] `PUBLIC_ROUTE` still names only `src/modules/public/pages/HoldingPage.tsx`. [VERIFIED: web/scripts/budget.ts line 87]
**How to avoid:** Wave 0 changes `PUBLIC_ROUTE` to a per-page measurement (PublicLayout plus each page module: Home, Products, Gallery, Contact, NotFound), each ≤ 150 KB; the forbidden list applies to all except nuqs on Gallery (WEB-10 allows it there); lazy lightbox; no barrels; measure before and after each slice. Phase 13 must lazy-load the quote form (RHF + zod) when it lands.

### P-8: Shared concurrency token between tabs
**What goes wrong:** saving Business Info then Hours gives a 409 because both send the settings version.
**How to avoid:** hours get their own aggregate and token, or the Hours form reads the refreshed version without dropping typed values.

### P-9: Stray sweep deletes content photos, or never sees them
**What goes wrong:** the sweep only lists `{RootFolder}/orders/`; content photos under a new folder are never swept, and if they were put under `orders/` they would be swept as strays.
**How to avoid:** extend the sweep and `IImageInventory` to the content folder, keep the trailing slash rule ("The trailing slash keeps "csps" from matching "csps-dev""). [VERIFIED: src/Csps.Application/Maintenance/StraySweepJob.cs line 61 `var folder = $"{storage.RootFolder}/orders/";`]

### P-10: Rate limiting the crawler
**What goes wrong:** a strict per-IP limit on the shell blocks Facebook when a post is shared widely (its crawler comes from few addresses).
**How to avoid:** no limiter on the shell, robots and sitemap; a generous `public-read` sliding window on `/api/v1/public/*` only (SEC-03). The limiter partitions by `Connection.RemoteIpAddress` (no forwarded headers yet). [VERIFIED: src/Csps.Server/Security/RateLimitingRegistration.cs `PartitionKey(context.Connection.RemoteIpAddress)`]

### P-11: Idempotency keys on new POSTs
Every POST needs an `Idempotency-Key` unless exempt with a written reason (`IdempotencyMiddleware`). Admin services already send one through the shared client; uploads and moves must too. [VERIFIED: Program.cs comment "Every POST needs an Idempotency-Key unless it is exempt with a written reason (SEC-06, D-40)"]

### P-12: P10-BL-22 deadlock mapping
`OrderNumberAllocator.TakeLockAsync` catches `InvalidOperationException` by message and turns every lock failure, a deadlock too, into `OrderNumberBusyException`; inside the idempotency gate's outer transaction that ends in a 500 (SQL error 3903 on the savepoint rollback). Fix like `StaffMoneyLock`: deadlock victim → `ChangeTracker.Clear()` then `ConcurrencyConflictException`; timeout stays busy. Test first by copying `StaffMoneyLockTests.ADeadlockOnTheLockInsideAnOuterTransactionIsALostRaceWithTheTransactionEnded`. Lock names in use: `ActiveManagers = "active-managers"`, `OrderNumbers = "order-numbers"`, `StaffMoney = "staff-money"`. [VERIFIED: OrderNumberAllocator.cs lines 68-79; StaffMoneyLock.cs; DatabaseLocks.cs lines 14-20; DatabaseLockExceptions.cs line 9 `DatabaseLockTimeoutException(...) : InvalidOperationException`]

### P-13: Cancel and reopen
D-38 says cancelling takes an order off the site. If "shown" is only filtered by status, reopening puts it back without anyone choosing to. See OQ-R3.

## Code Examples

### Deadlock mapping to copy (P10-BL-22)
```csharp
// Source: src/Csps.Infrastructure/Money/StaffMoneyLock.cs (this repo)
catch (DatabaseLockTimeoutException error) when (SqlErrors.Has(error, SqlErrors.DeadlockVictim))
{
    _context.ChangeTracker.Clear();
    throw new ConcurrencyConflictException(error);
}
catch (DatabaseLockTimeoutException error)
{
    LogBusy(_logger, error, DatabaseLocks.StaffMoney, (int)Math.Ceiling(_wait.TotalSeconds));
    throw new StaffMoneyBusyException(error);
}
```

### Conditional GET in a thin action
```csharp
// Shape only: the handler returns a cached snapshot with Json and ETag.
var snapshot = await handler.HandleAsync(ct);
Response.Headers.ETag = snapshot.ETag;
Response.Headers.CacheControl = "no-cache";
if (Request.Headers.IfNoneMatch.Contains(snapshot.ETag)) return TypedResults.StatusCode(StatusCodes.Status304NotModified);
return TypedResults.Text(snapshot.Json, "application/json", Encoding.UTF8);
```

### Brotli files at build time (no package)
```ts
// Source: Node 24 node:zlib API; Vite plugin hook names from Vite 8 docs.
import { brotliCompressSync, constants } from 'node:zlib';
// in writeBundle: for each .js/.css/.svg/.html asset over 1 KB, write `${file}.br` with
// brotliCompressSync(buffer, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
```
Serving: when `Accept-Encoding` includes `br` and `{path}.br` exists, serve it with `Content-Encoding: br`, the original `Content-Type` and `Vary: Accept-Encoding`; response compression should skip a response that already has `Content-Encoding` [ASSUMED: verify with a test]. The crawler never asks for br, so it keeps getting gzip.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prerender services or SSR for link previews | Server-shaped shell head with per-route tags, SPA body unchanged | — | No Node server needed on the .NET host |
| `UseStaticFiles` only | `MapStaticAssets()` with build-time Brotli and ETags (.NET 9+) | .NET 9 | Available, but its caching model conflicts with Vite-hashed `immutable` assets here; not adopted |
| `specialOpeningHoursSpecification` | Google documents closures as `openingHoursSpecification` with `00:00` and `validFrom`/`validThrough` | — | Both valid schema.org |

**Deprecated/outdated:** `PublicPlaceholderPage`, `HoldingPage` and `siteContact.ts` placeholders retire with their tests in this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Facebook's crawler does not run JavaScript (Meta's page does not say so; vendors do) | Summary, Pattern 2 | Low: server tags work either way |
| A2 | A `<script type="application/json">` or `ld+json` data block is not blocked by `script-src 'self'` | Pattern 6 | CSP console error; caught by the CSP listener |
| A3 | `frame-src https://www.google.com/maps/embed` matches the embed URL with any query | P-6 | Map blocked; caught by Playwright |
| A4 | `MapFallback` without method metadata maps every method | Pattern 1 | L-01 regression; caught by the existing test |
| A5 | React Router matches paths case-insensitively by default | P-2 | Wrong 404 on mixed case |
| A6 | Vite keeps HTML comments (markers) in the built `index.html` | Pattern 1 | Shaping fails; build test catches it |
| A7 | HybridCache's 64 KB cap may skip large snapshots | P-4 | Slow public reads; query-count test catches it |
| A8 | Response compression skips responses that already set `Content-Encoding` | Code Examples | Double encoding; test catches it |
| A9 | EF `HasData` changes generate `UpdateData` that overwrites live rows | Pattern 8 | Manager edits lost on deploy |
| A10 | Browsers revalidate `no-cache` + `ETag` responses with `If-None-Match` under default `fetch` | Pattern 6 | Stale public data until reload |
| A11 | The Archivo and Barlow OFL notices declare no Reserved Font Name, so subset files may keep their names (copyright lines read this session show none) | D-28 fonts | Rename needed for subset files |
| A12 | Meta's crawler accepts JPEG `og:image`; WebP support unknown | Pattern 2 | Missing preview image |

## Open Questions (for the owner, plain words, recommendation first)

1. **OQ-R1: Old contact fields in the settings table.** The single phone and single address fields are replaced by a phone list and address parts. Production holds only placeholder text there.
   - **A (recommended):** keep the two old columns for now, stop using them, and remove them in a later cleanup you approve. Reason: nothing is deleted without your say.
   - **B:** remove them in this phase's migration. Reason: a cleaner table now; it is a one-way change.
   - Also: blank the old Facebook and email placeholders (they hold square-bracket text) in the migration. Recommended yes.

2. **OQ-R2: Are the six seeded product lines shown or hidden at go-live?** UI-SPEC leaves it to your go-live step.
   - **A (recommended):** start shown, with "Message us for a price". Reason: the site has content on day one, and prices can be added later (D-04).
   - **B:** start hidden; a Manager shows each line after adding its price.

3. **OQ-R3: Reopening a cancelled order.** Cancelling takes it off the website (D-38).
   - **A (recommended):** cancelling also turns off "Show on the website" (the customer OK stays); after reopening, staff show it again on purpose. Reason: nothing goes public without a deliberate step.
   - **B:** it comes back on its own when reopened.

4. **OQ-R4: Loading public data.** The build rule keeps the data library (TanStack Query) off public pages for speed.
   - **A (recommended):** keep the rule; public pages use a small built-in loader plus data sent inside the page. Reason: smaller download, no rule change.
   - **B:** allow the library on public pages (about 8 KB more per page).

5. **OQ-R5: Compressing public data.** JSON is never compressed today (a security rule for private data).
   - **A (recommended):** keep it; public data is small and also sent inside the compressed page.
   - **B:** allow compression for the anonymous public reads only.

6. **OQ-R6: New picture sizes in Cloudinary.** The account only serves sizes created in advance. Phase 11 needs about a dozen more.
   - **A (recommended):** you run the existing setup command once after the deploy (it only adds missing sizes, never changes old ones). No cost beyond your free plan's normal use.
   - **B:** a developer runs it with your keys.

7. **OQ-R7: Dependabot alert 6 (minimatch) and the expiring exceptions.** Both the minimatch and glob audit exceptions run out on 2026-11-14, after which the build check fails. The fix is a major version that ESLint does not support yet, and it is only used by developer tools with our own patterns.
   - **A (recommended):** extend both exceptions by 30 days and check again. Reason: nothing visitors download is affected, and forcing the new version may break the lint tools.
   - **B:** force minimatch 11.0.1 now (15 days old, same BlueOak license you approved for tools) and pin its new helper package; then run the full lint and test suite.

8. **OQ-R8: Font work order (D-28).** Subsetting needs a font tool that is not installed (for example the Python fontTools, MIT license). Recommended: do Brotli and "drop unneeded font files" first, measure, and only ask about a subsetting tool if LCP is still over 2.0 s.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | build, tests | ✓ (pinned) | `global.json` 10.0.401, rollForward latestPatch | — |
| Node / npm | web build, Vitest, Playwright | ✓ (engines `>=24.15 <25`) | per `web/package.json` | — |
| LocalDB `(localdb)\MSSQLLocalDB` | integration tests (`CSPS_TEST_SQL=localdb`) | ✓ (project standard) | — | CI uses the SQL 2025 container |
| Cloudinary account | photo delivery | ✓ (live, strict mode) | — | Testing image delivery fakes in tests |
| Python fontTools | font subsetting (only if OQ-R8 asks) | ✗ not checked as installed | — | skip; Brotli and file dropping first |
| Google Maps embed | Contact map | external | — | stub in Playwright |
| Facebook Sharing Debugger | manual link-preview check | external, owner's browser | — | no-JS fetch test in CI |

**Missing dependencies with no fallback:** none.
**Missing with fallback:** font subsetting tool (deferred behind OQ-R8).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (.NET) | xunit.v3 4.0.1 on Microsoft.Testing.Platform, Shouldly 4.3.0, NSubstitute 6.2.0, `FakeTimeProvider` (Microsoft.Extensions.TimeProvider.Testing 10.10.0), `Microsoft.AspNetCore.Mvc.Testing` 10.0.13 (`CspsApiFactory`), Respawn 7.0.0, ArchUnitNET 0.13.4 |
| Framework (web) | Vitest 5.0.4 (jsdom; `*.node.test.ts` in node), RTL 16.3.3, user-event, jest-dom, MSW 3.0.1, in-house axe matcher over axe-core 4.13.0, Playwright 1.63.0 + @axe-core/playwright, Lighthouse 13.5.0 |
| Config files | `global.json` (MTP), `web/vitest.config.ts`, `web/playwright.config.ts`, `web/scripts/budget.ts` |
| Quick run (.NET) | `dotnet test tests/Csps.Domain.UnitTests` or `dotnet test tests/Csps.Server.IntegrationTests -- --filter-class "*SpaHost*"` (MTP filter syntax per project docs) |
| Quick run (web) | `npm --prefix web exec vitest run src/modules/public` |
| Full suite | `npm --prefix web run verify`, `dotnet test Csps.slnx`, `npm --prefix web run e2e` (after preflight) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUB-01 | Known public paths 200, unknown 404 with shell, `/api/*` stays ProblemDetails, POST on page path meets default-deny, case and slash variants | integration | `dotnet test tests/Csps.Server.IntegrationTests` (`SpaHostTests`, new `ShellPageTests`) | partial (SpaHostTests) ❌ new |
| PUB-01 | Each page renders per UI-SPEC states (loading, empty, error, populated), one h1, zero axe | component | `vitest run src/modules/public/pages` | ❌ Wave 0 |
| PUB-01 | 320 to 1920 px no horizontal scroll, focus not obscured | e2e | `npm --prefix web run e2e -- public-*.spec.ts` | ❌ |
| PUB-02 | Values come from DB; placeholders never appear; email never public | integration + backstop | `PublicContentTests` (grep responses for `[` and `@`) | ❌ |
| PUB-03 | Each write invalidates: new value and new ETag on next read (matrix rows) | integration | `PublicCacheInvalidationTests` | ❌ |
| PUB-04 | No-JS fetch of each URL has title, description, canonical, OG image with size, JSON-LD without email; admin has X-Robots-Tag and meta robots; robots.txt names sitemap; sitemap lists 4 URLs with absolute origin from `App:PublicBaseUrl` (forged Host ignored) | integration + e2e | `ShellHeadTests`, `SeoEndpointTests`; Playwright `link-preview.spec.ts` with `javaScriptEnabled: false` | ❌ |
| PUB-04 | Markers survive the real build | node test | `vitest run src/test/build-output.node.test.ts` | ✅ extend |
| PUB-05 | Open status at 8:59, 9:00, 17:59, 18:00 Manila, closure day, Sunday, 14-day horizon, year end | unit (Domain) | `dotnet test tests/Csps.Domain.UnitTests` (`OpenStatusTests`) | ❌ |
| PUB-05 | Client renders server words only (MSW fixtures) | component | `vitest run src/modules/public/components/HoursCard` | ❌ |
| PUB-06 | `tel:` in E.164 from the main number; m.me link; sticky bar only at ≤ 767 px | unit + component + e2e | `PhilippinePhoneTests`; `ContactBar.test.tsx`; `contact.spec.ts` | ❌ |
| GAL-01 | Pill counts equal tiles; hidden lines excluded; category URL drops unknown with replace | integration + component | `GalleryReadTests`; `useGalleryCategory.test.tsx` (nuqs testing adapter) | ❌ |
| GAL-02 | Lightbox ←, →, Esc, wrap, tap zones named, thumbnails `aria-current`, focus return, Back closes | component + e2e | `GalleryLightbox.test.tsx`; `gallery.spec.ts` | ❌ |
| GAL-03 | Upload, edit, hide, show, delete, move across kinds; Manager only | integration | `GalleryAdminTests`; authorization matrix rows | ❌ |
| CONT-01 | Settings validators mirror UI-SPEC messages (server and zod); 409 on stale version; SEC-08 stamps from token | unit + integration + component | `UpdateSiteSettingsValidatorTests`; `SiteSettingsWriteTests`; `siteContentSchemas.test.ts` | ❌ |
| CONT-02 | Line CRUD, unique short name, fixed key, delete refused when used, move under lock | integration | `ProductLineTests` | ❌ |
| CONT-03 | Testimonials CRUD and order; Home shows first 3 shown; Recent work = 6 newest shown orders | integration | `TestimonialTests`, `HomeReadTests` | ❌ |
| CONT-04 | Closure validation, overlap refused (server only), feeds open status and JSON-LD | integration | `ClosureTests`, `ShellHeadTests` | ❌ |
| CONT-05 | 304 on matching If-None-Match; Cache-Control values; second read no DB commands (query-count) | integration | `PublicCachingTests` | ❌ |
| D-11/D-13/D-16 | Order public settings: consent required, Cancelled refused, Completed allowed, Admin and Manager allowed, privacy projection | unit + integration | `OrderPublicSettingsTests` (Domain and Server) | ❌ |
| D-28/D-29 | `.br` served when accepted, gzip to a crawler; LCP printed report-only | integration + script test | `PrecompressedFilesTests`; `lighthouse-assert.test.ts` keeps LCP in `REPORT_ONLY_METRICS` | partial |
| PERF-01 | Every public route ≤ 150 KB gz; forbidden modules out (nuqs allowed on Gallery only); lightbox lazy | build test | `vitest run scripts/budget.test.ts` + `npm --prefix web run build:budget` | ✅ extend |
| P10-BL-22 | Deadlock on the order-number lock inside an outer transaction answers 409 busy, not 500 | integration | `OrderNumberAllocatorTests` (copy of the StaffMoneyLock test) | ✅ extend |
| Arch | New code respects onion layers | architecture | `dotnet test tests/Csps.ArchitectureTests` | ✅ |
| OR-7 | No new trigger | schema test | existing `sys.triggers` test | ✅ |

### Sampling Rate
- **Per task commit:** the quick command of the touched area (one test class or one Vitest folder).
- **Per wave merge:** `dotnet test Csps.slnx` and `npm --prefix web run verify` (after preflight).
- **Phase gate:** full suite green, `npm --prefix web run e2e` and `npm --prefix web run lighthouse` (LCP report-only) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Budget plugin: per-route public measurement (PublicLayout + each page), nuqs allowance on Gallery only, stub pages so the numbers exist before real pages.
- [ ] Fixture web root: markers in `tests/Csps.Testing/Fixtures/webroot/index.html`, remove its `robots.txt`.
- [ ] `ShellPageTests` and `SeoEndpointTests` skeletons; public route table unit test shared with a client list.
- [ ] Domain `OpenStatusTests` and `PhilippinePhoneTests` (pure, `FakeTimeProvider`).
- [ ] MSW handlers and fixtures for public reads (`web/src/test/publicFixtures.ts`).
- [ ] Playwright: Google embed stub route, `link-preview.spec.ts` with JS disabled.
- [ ] Authorization matrix rows for every new endpoint (anonymous reads, Manager writes, Staff order public settings).

## Security Domain

`security_enforcement` is on (ASVS level 1, block on high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no new | existing JWT bearer |
| V3 Session Management | no new | existing |
| V4 Access Control | yes | default-deny; `Policies.Manager` on Site Content; `Policies.Staff` on order public settings (D-16); `[AllowAnonymous]` only on public reads, shell, robots, sitemap; matrix test |
| V5 Input Validation | yes | FluentValidation in handlers with UI-SPEC messages; zod mirrors (OR-3); URL allow-lists for Messenger, Facebook, Instagram, TikTok, Maps; embed link reduced to `https://www.google.com/maps/embed?` |
| V6 Cryptography | yes (ids only) | `RandomNumberGenerator` 128-bit public ids (existing `PublicIds`) |
| V7 Error handling/logging | yes | ProblemDetails, generic 500; audit entries without quote or note text |
| V8 Data protection | yes | D-13 projections; consent record with who and when (D-11) |
| V12 Files | yes | Phase 9 inspection, size and type limits, upload slots and rate limit |
| V14 Config | yes | CSP adds only `frame-src https://www.google.com/maps/embed`; HSTS unchanged |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS through Manager text into meta tags, JSON-LD or boot data (CWE-79) | Tampering | `HtmlEncoder` for attributes; `JsonSerializer` default encoder for script data; never raw concatenation; test with `</script><script>` in a tagline |
| Host header poisoning of canonical, sitemap (CWE-644) | Spoofing | `App:PublicBaseUrl` only; test with a forged Host |
| Open redirect or `javascript:` links from settings (CWE-601) | Tampering | https host allow-lists; line keys from an allow-list; `rel="noopener noreferrer"` on new-tab links |
| Customer data leak in public responses (CWE-200, Data Privacy Act) | Information disclosure | projection records with only D-13 fields; backstop test over every public response and the public DOM |
| Mass assignment of stamps or consent fields (CWE-915) | Tampering | request DTOs without stamp fields; consent who and when from the token and clock |
| Clickjacking via the map | — | our `frame-ancestors 'none'` unchanged; only outbound `frame-src` added |
| Resource exhaustion on public reads (CWE-770) | DoS | cached snapshots, generous `public-read` limiter, page-size caps on admin lists |
| Race on moves and closure overlaps | Tampering | `site-content` lock row, rowversion 409 |

## Sources

### Primary (HIGH confidence)
- This repository, files read this session: `SpaHosting.cs`, `SpaRegistration.cs`, `Program.cs`, `SecurityHeadersMiddleware.cs`, `SiteSettings.cs`, `SiteSettingsDefaults.cs`, `SiteSettingsConfiguration.cs`, `SiteSettingsReader.cs`, `SiteSettingsController.cs`, `IBusinessCalendar.cs`, `BusinessCalendar.cs`, `BusinessClock.cs`, `DependencyInjection.cs`, `AppLinksOptions.cs`, `ImageNamedSizes.cs`, `ImageCandidates.cs`, `CloudinaryImageDelivery.cs`, `PublicIds.cs`, `StraySweepJob.cs`, `Order.cs`, `OrderImage.cs`, `OrderStatus.cs`, `ProductType.cs`, `StaffMoneyLock.cs`, `OrderNumberAllocator.cs`, `DatabaseLocks.cs`, `RecordStampInterceptor.cs`, `RateLimitingRegistration.cs`, `AuthorizationMatrix.cs`, `SpaHostTests.cs`, `web/package.json`, `web/scripts/budget.ts`, `web/src/core/routes/router.tsx`, `web/src/layouts/PublicLayout.tsx`, `web/src/ui/base.css`, `docs/web/budgets.md`, `docs/audit-exceptions.json`, `docs/license-exceptions.json`, `artifacts/budget/budget.production.json`, Phase 3 `deferred-items.md`, 999.6 `DECISIONS.md`.
- npm registry via `npm view` / `npm ls` (minimatch versions, licenses, dependents).
- GitHub Advisory GHSA-g3hv-75wg-m249: https://github.com/advisories/GHSA-g3hv-75wg-m249

### Secondary (MEDIUM confidence)
- Meta, web crawlers: https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/
- Meta, images for sharing: https://developers.facebook.com/docs/sharing/webmasters/images/
- Meta, sharing guide for webmasters: https://developers.facebook.com/docs/sharing/webmasters/
- Google, LocalBusiness structured data: https://developers.google.com/search/docs/appearance/structured-data/local-business
- Microsoft Learn, static files and MapStaticAssets (ASP.NET Core 10): https://learn.microsoft.com/en-us/aspnet/core/fundamentals/static-files?view=aspnetcore-10.0
- W3C CSP Level 3: https://www.w3.org/TR/CSP3/ (data-block and path-matching text not reached; claims kept ASSUMED)

### Tertiary (LOW confidence)
- Vendor articles on SPA link previews (prerender.io and others in the search results) for the "crawler does not run JS" claim.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (everything is already installed and read from repo files).
- Architecture: MEDIUM-HIGH (patterns copy existing code; route-table and HybridCache payload details need the listed tests).
- Pitfalls: HIGH for repo-derived items (budget, robots, placeholders, sweep folder, deadlock), MEDIUM for external behavior (crawler, CSP path match).

**Research date:** 2026-11-11
**Valid until:** 2026-12-11 for the codebase findings; 2026-11-14 for the audit-exception finding (expiry date).

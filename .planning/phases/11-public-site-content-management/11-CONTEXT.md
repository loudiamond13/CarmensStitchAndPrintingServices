# Phase 11: Public Site & Content Management - Context
*Created: 2026-11-11T08:30:00-06:00 · Updated: 2026-11-15T07:30:00-06:00*

**Gathered:** 2026-11-11
**Status:** Ready for planning
**Branch:** `gsd/phase-11-public-site-content-management` (owner, 2026-11-11: all Phase 11 commits go here). It was cut from `docs/phase-10-carry-to-11`, so it carries the three Phase 10 carry-over docs commits that are not on `main` yet.

<domain>
## Phase Boundary

Visitors, mostly arriving on a phone from Facebook, get the real public site: Home, Products, Gallery and Contact, built to UI-SPEC §7, with prices and business info from the database, a real 404, and correct link previews (OG tags and `LocalBusiness` JSON-LD in the server-sent HTML, `robots.txt`, `sitemap.xml`, `noindex` on admin). Managers keep all of it current from the admin portal, and every change shows publicly at once.

Requirements: PUB-01 to PUB-06, GAL-01 to GAL-03, CONT-01 to CONT-05. Legal pages (§13) are Phase 12; the quote form is Phase 13.

Also in scope (carry-over, unchanged from ROADMAP.md): the public LCP work (see D-28, D-29), and the Phase 10 items under D-119 (P10-BL-22 deadlock fix, test first; owner reviews P10-BL-23 and P10-BL-20 item 3; mark UAT 18 and 19 passed; Dependabot alert 6, minimatch 11.0.1, which needs the usual package check and owner approval).

</domain>

<decisions>
## Implementation Decisions

All rulings below: owner, 2026-11-11, in this discussion.

### Products and prices (C-21: closed)
- **D-01:** **Product lines live in the database** (the hybrid `ProductLine`). Each line has a title, short name, number, lead/description, the five customize texts, an optional "starts at" price, an optional minimum quantity, display order and an active flag. No separate per-line price items. **Reversibility:** costly. The new tables come from a migration; going to a price-item model later means a new schema and moving data.
- **D-02:** **A Manager uploads up to 3 photos per line** (main, back view, fabric detail) through the Phase 9 upload pipeline. Until a slot has a photo, the design's drawn jersey placeholder shows.
- **D-03:** **The Gallery filter pills are the product lines.** Hiding or adding a line changes the pills. "See {short} work" opens the Gallery filtered to that line.
- **D-04:** **No price entered:** the price line reads "Message us for a price" and no price or placeholder shows. A line can go public without a price.
- **D-05:** **Testimonials are typed in by a Manager** (quote, name, team, 1 to 5 stars), ordered and hidden like other content.
- **D-06:** **At go-live, the six lines hold the UI-SPEC §7 text** (titles, descriptions, customize texts) with prices blank, and a Manager reviews it and adds prices before cutover. The production database must get this content without breaking the "nothing seeds or migrates at startup" rule and the dev seed's `CSPS_Dev`/`CSPS_E2E`-only guard: the planner picks the mechanism (for example migration data in the reviewed idempotent script) and states it in the plan.
- **D-07:** **The five customize cards are fixed** (Fabric, Collar style, Cut & fit, Names & numbers, Logos & sponsors, with their icons and order). A Manager edits only the text under each one, per line.
- **D-08:** **Delete only when unused.** A line that gallery items, order product types or photos still use cannot be deleted; the Manager is told to hide it instead. Hidden lines and everything filed under them leave the public site, and nothing is lost.
- **D-09:** **Order product types link to product lines.** The existing staff-side `ProductType` list (Phase 7 D-18) stays separate. A Manager links each order product type to at most one public line (for example "Basketball jersey" and "Basketball shorts" to Basketball Jerseys). A public order is filed under a line automatically from its items, and the person making it public can change the line for that order. Unlinked types (repairs, hemming) never file anything publicly. **Reversibility:** costly. It adds a foreign key on `ProductTypes` and the filing rule other features read.

### Gallery and privacy (C-12: closed)
- **D-10:** **Photos come from orders, plus direct uploads.** Recent work and the Gallery show orders that staff made public. The Gallery also takes direct uploads (photo, team, line, pieces, note) for old work with no order in the system (GAL-03).
- **D-11:** **An order needs a "Customer said OK to show" box before it can go public.** It is off by default, including for every migrated order. This replaces the Phase 9 deferred idea "public by default, Manager hides" (09-CONTEXT Deferred, 2026-10-31) because of the Data Privacy Act. The Privacy Policy wording is Phase 12 (LEGAL-01). **Reversibility:** costly. It is a new order column, and it is the consent record the privacy policy relies on.
- **D-12:** **All photos of a public order show.** No per-photo choice.
- **D-13:** **Public text for an order:** team name, product line and total pieces. The team name comes from the order and staff can set a different public team name (for example to hide it). The customer's own name, phone, email, prices and notes never reach any public response.
- **D-14:** **Recent work on Home = the 6 newest public orders, automatically.** No separate "feature on Home" step.
- **D-15:** **Unticking "Customer said OK" or deleting the order removes it from the public site at once** (cache invalidated like any content change). The private order photos are kept.
- **D-16:** **Admin and Manager can both tick "Customer said OK" and make an order public**, from the order screens. This is the one public-content action not limited to Managers; everything else in this phase is Manager only (Phase 4 policy). The change is audited. **Reversibility:** reversible. It is one policy on the endpoint plus the authorization-matrix rows.

### Contact page and quotes (C-36 scope check: closed)
- **D-17:** **The quote form ships this release, in Phase 13**, as the roadmap has it. Phase 11 builds Contact so the form can slot in without a redesign.
- **D-18:** **Until Phase 13, the left column is a large Messenger and call card**: "Message us on Messenger" and "Call us" buttons plus a short line on what to send (team, quantity, design). Mark it `// SPEC-GAP: contact before quote form`.
- **D-19:** **"Get a Quote" buttons keep their label and go to `/contact`** everywhere (header, drawer, hero, product sections, final CTA, gallery).
- **D-20:** **Embedded Google map, tap to load.** Contact shows a map preview card with a "Show map" button, and the Google iframe loads only after the tap. Once Phase 12's consent exists, a visitor who has allowed it sees the map straight away. CSP gets only the narrow `frame-src` the embed needs, nothing for scripts.
- **D-21:** **Business hours: one open and close time per weekday, or closed.** Holidays and special closures are dates with an optional public note (CONT-04).
- **D-22:** **The closed status says when the shop opens next**, for example "Closed now. Opens Monday 9:00 AM", or the closure note on a closure date ("Closed today for Christmas"). Computed in `Asia/Manila` through `IBusinessCalendar`.
- **D-23:** **Several phone numbers; a Manager marks one as the main number.** The Call buttons and the phone-only sticky bar dial the main number, and Contact lists all of them.
- **D-24:** **Social links: fixed Facebook, Instagram and TikTok spots** with their icons. Empty spots are hidden. Messenger stays its own field.
- **D-25:** **The shop email is not shown publicly**: not on Contact, in the footer or in JSON-LD. It stays in site settings for internal use. This overrides the UI-SPEC footer's email line.

### Link previews and admin screens
- **D-26:** **Share pictures:** a Manager uploads one default share picture for the site. Products uses its first product photo and Gallery uses the newest public photo when they exist; every other page uses the default.
- **D-27:** **One "Site Content" admin area** (Manager only) with tabs: Business info, Hours & closures, Products, Testimonials, Gallery. The "Customer said OK" box and the public toggle sit on the order screens (D-16), not here. Spec-gap screens follow C-17 (built from existing parts, `// SPEC-GAP:`), and design-vs-WCAG clashes are ruled item by item in `/gsd-ui-phase 11` (OD-14).

### Page speed (LCP carry-over from Phase 3)
- **D-28:** **Fixes that keep the look come first:** precompressed Brotli files, subsetting fonts to the characters the site uses, and dropping font files a page doesn't need. Measure on the real Phase 11 pages. If LCP is still over 2.0 s, bring the owner before/after screenshots of a font change (for example a system font for body text) and wait for a ruling. Never change the fonts or the look without that ruling.
- **D-29:** **LCP stays report-only in CI after this phase.** The number keeps printing on every run with the 2000 ms target, and `REPORT_ONLY_METRICS` in `web/scripts/lighthouse-assert.mjs` keeps LCP. This supersedes the Phase 3 plan (deferred-items.md, WINDOWS.md entry 1) to empty that list in Phase 11. The 2000 ms target itself is unchanged.

### UI design rulings (owner, 2026-11-11, `/gsd-ui-phase 11`; detail in `11-UI-SPEC.md` § Owner Questions)
- **D-30 (OQ-1):** the Gallery shows **one tile per order** (its cover photo). The viewer has thumbnails to switch between that order's photos, and Previous / Next go to the next order.
- **D-31 (OQ-2):** caption text over photos sits on a **solid blush band**, with the fade only above it, so it always passes contrast.
- **D-32 (OQ-3):** the Products jump links and Gallery filter pills are **44px** tall (the drawing has 40px).
- **D-33 (OQ-4):** the footer squares are spoken as **"FB, CSPS on Facebook"**, "IG, CSPS on Instagram" and "TT, CSPS on TikTok". Nothing visible changes.
- **D-34 (OQ-5):** each product line has **two text fields**: "Card text" (Home card) and "Description" (Products page).
- **D-35 (OQ-6):** time zone (Asia/Manila) and money format (PHP, en-PH) show on Business Info **read-only**.
- **D-36 (OQ-7):** the "Fast turnaround" promise is an **editable Business Info field**, the "Turnaround line" (optional, at most 120 characters). It starts empty. When it is empty, the card shows a line with no time promise. This field is new in the settings schema.
- **D-37 (OQ-8):** add the `chevron-up` and `globe` icons from the installed lucide-react (no new package).
- **D-38 (OQ-9):** any order **except Cancelled** may be shown on the website, Completed included. Cancelling an order takes it off the website.

### Research rulings (owner, 2026-11-11, `/gsd-plan-phase 11`; detail in `11-RESEARCH.md` § Open Questions)
- **D-39 (OQ-R1):** keep the old `ContactPhone` and `AddressLine` columns and stop using them. They are removed later, only in a cleanup the owner approves (no drop in Phase 11). The migration blanks the bracket placeholders in `FacebookUrl` and `ContactEmail` and never copies placeholders into the new phone and address fields.
- **D-40 (OQ-R2):** the six seeded product lines **start shown** at go-live, with "Message us for a price" until a price is added (D-04).
- **D-41 (OQ-R3):** cancelling an order also turns off "Show on the website" (the customer OK stays). Reopening does not put it back; staff turn it on again on purpose.
- **D-42 (OQ-R4):** TanStack Query stays off public pages (the PERF-02 build rule is unchanged). Public pages use a small built-in loader plus data sent inside the server HTML.
- **D-43 (OQ-R5):** JSON responses stay uncompressed, public reads included.
- **D-44 (OQ-R6):** the owner runs the existing Cloudinary setup command once after the Phase 11 deploy to create the new named sizes. It goes on the go-live checklist.
- **D-45 (OQ-R7):** extend the minimatch and glob audit exceptions in `docs/audit-exceptions.json` by 30 days (to 2026-12-14) and check again then. No minimatch 11 in Phase 11. This must land before 2026-11-14.
- **D-46 (OQ-R8):** D-28 font work goes in order: precompressed Brotli and dropping unused font files first, then measure. Ask the owner about a font subsetting tool only if LCP is still over 2.0 s.

### Carried forward (already ruled, not re-asked)
- **C-35 (02 D-06):** on phones the lightbox has invisible full-height left/right tap zones that are real `<button>`s ("Previous photo" / "Next photo"), focusable with a visible ring; swipe, Esc, ← and → also work.
- **C-17 (04 D-06):** undrawn screens are built from existing parts and marked `// SPEC-GAP:`.
- **OD-14:** design-vs-WCAG clashes are ruled item by item in `/gsd-ui-phase 11`.
- **09 D-01:** order photos use public Cloudinary delivery with random ids; public responses may now carry those addresses for orders made public under D-11.
- **WEB-10:** the Gallery's chosen category lives in the URL.
- Locale `en-PH`, `₱`, Manila time; money is `decimal(18,2)` and computed server-side; no JSON columns; no new triggers (OR-7); no inline SQL.

### Claude's Discretion
- The exact schema, endpoints and cache keys, the server-shaped `index.html` approach for OG tags and JSON-LD (research flag), and how each change invalidates HybridCache and ETags.
- Which gallery photo becomes an order's tile (its cover photo is the natural choice) and the masonry ratios for real photos.
- The audit entries for content edits and public toggles.
- How "pieces" is computed for a public order (the sum of item quantities is the natural reading).

### Carry-over reviews (D-119)
- **D-120 (P10-BL-23, plan 11-06):** the owner reviewed the faster expense list query (it picks the page's ids from the sorted index first) and the create-user race fix (every create takes the Manager roster lock, and two lost deadlocks answer 409 "busy, try again"), together with plan 11-01's roster and account-token lock findings. Answer: "Approve both". No changes asked, so no follow-up and no code changed in plan 11-06. (owner, 2026-11-11)
- **D-121 (P10-BL-20 item 3, plan 11-06):** the owner reviewed the three choices quick 261109-vj6 made inside D-111: (a) the dashboard line "Showing figures from {time}. Couldn't refresh." with Try Again, (b) the Audit Log label "Money transfer added", (c) the WebKit-only e2e guard. Answer: "Approve all three". No changes asked, so no follow-up and no code changed in plan 11-06. (owner, 2026-11-11)
- **D-122 (page head encoding, plan 11-02 deviation 4):** keep the narrower Latin-1-range HTML encoder in `PublicHeadWriter` instead of `HtmlEncoder.Default`, so titles such as "Products · CSPS" read exactly as written. The five markup characters (`<` `>` `&` `'` `"`) are still escaped, and a test covers that. (owner, 2026-11-11)
- **D-123 (plan 11-38 Task 2, go-live data gap):** option A, "fill in right after". Business Info and the opening hours are entered as the first steps of the go-live checklist. No prefill migration. Plan 11-38 applies this and skips its checkpoint. (owner, 2026-11-11)
- **D-124 (plan 11-36 Task 3, font step, answered ahead of the measurement):** if any public page LCP is still over 2000 ms after Tasks 1 and 2, try font subsetting as a follow-up /gsd-quick, with the usual package check and the owner's yes before any tool is added. No change to the look. If every page is at or under 2000 ms, the step is not needed. Plan 11-36 applies this and skips its checkpoint. (owner, 2026-11-11)
- **D-125 (third code review, IN-3-03, e2e lock timing):** option 1. The site content lock wait in `web/e2e/site-content-lock.ts` drops from 7 to 6 minutes, so a lock-taking test keeps 2 of its 8 minute budget for setup and fails with the clear lock message, not a generic timeout. The test budgets stay at 8 minutes. `web/scripts/e2e-lock-timeouts.test.ts` checks the 2 minute margin. Applied in `eb986cf7`. (owner, 2026-11-15)
- **D-126 (validate-phase, G-11-19 test gap):** no automated test is added for removing GPS or location data from uploaded photos. The owner's reason: nobody will upload a photo that holds location data. The redraw rules stay covered by `web/src/utils/images.test.ts`. This ruling covers only the automated test; UAT test 19 in `11-UAT.md` is unchanged. (owner, 2026-11-15)
- **D-127 (ship gate, go-live steps):** option A. UAT tests 21 to 23 (live Cloudinary setup, real content entry, Facebook Sharing Debugger) and VERIFICATION human items 2 to 4 cannot be done before the deploy. They are deferred to after the deploy and tracked in `docs/operations/go-live-public-site.md`, not shipping blockers. UAT test 19 counts as passed: gap G-11-19 was closed by plan 11-39 (D-P11-BL-65), and the owner accepts that fix in place of the manual phone-photo re-test. (owner, 2026-11-15)

### Go-live (plan 11-38)
- **Deploy gap applied (D-123):** plan 11-38 Task 2 was already answered by D-123 (option A, "fill in right after", owner, 2026-11-11), so no new D-number was needed and the checkpoint was skipped. `docs/operations/go-live-public-site.md` puts Business Info and the opening hours first after the deploy, and no prefill migration was written. The checklist also holds the Cloudinary setup step (D-44, P11-BL-21), the line review and prices (D-06, D-40) and the live checks, including one shared link in the Facebook Sharing Debugger (P11-BL-40 item 4). (applied 2026-11-13)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` § Phase 11: goal, success criteria, carry-overs, research flags.
- `.planning/REQUIREMENTS.md`: PUB-01 to PUB-06, GAL-01 to GAL-03, CONT-01 to CONT-05 (and LEGAL-01, INQ-* for the boundaries).
- `.planning/PROJECT.md`: conflict rows C-12 and C-21; constraints.
- `.planning/research/SUMMARY.md`: C-36 and the public-site build order.
- `CSPS-PRD.md` §5 (content data model), §12 (PUB-*), the caching notes.

### Design
- `docs/CSPS-UI-SPEC.md` §7 (Home, Products, Gallery, Contact, 404), Appendix E.1 to E.4, the component sections (TestimonialCard, sticky contact bar, header and footer).
- `.planning/design/` (local only, git-ignored): visual reference; the UI spec wins.
- `.planning/phases/02-web-foundation-design-system/02-CONTEXT.md` D-06 (lightbox on phones), D-02 to D-05 (accessibility rulings).
- `.planning/phases/04-identity-authentication/04-CONTEXT.md` D-06 (C-17), D-41 (OD-14).

### Earlier phases this builds on
- `.planning/phases/09-order-images-maintenance-jobs/09-CONTEXT.md`: D-01 public delivery, D-03 sizes, D-17/D-18 upload rules, and the Deferred "featured orders" note that D-11 closes.
- `.planning/phases/07-order-domain-api/07-CONTEXT.md` D-18: order product types.
- `.planning/phases/03-ci-cd-staging-deploy/deferred-items.md`: the LCP measurements and the fix options (a) to (e).
- `.planning/WINDOWS.md` entry 1: LCP report-only waiver.
- `.planning/phases/999.6-owner-items-parked-during-phase-10-execution/DECISIONS.md`: the Phase 10 carry-over items (D-119).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Csps.Domain/Content/SiteSettings.cs` and `SiteSettingsController`: the singleton settings aggregate (business name, time zone, currency, locale, email, one phone, address, Facebook URL). CONT-01 widens it (several phones with a main one, Messenger, Instagram, TikTok, map link, tagline, about text, hours, share picture).
- `src/Csps.Domain/OrderLists/ProductType.cs` and `ProductTypesController`: the staff-side list that D-09 links to product lines.
- Phase 9 image pipeline: `src/Csps.Application/Images/` (`ImageInspection`, `ImageUploadSettings`), order image handlers, and the maintenance jobs (`ImageRemovalJob`, `StraySweepJob`) for product and gallery uploads.
- Web: `web/src/components/media` (`ImageUploader`, `PhotoTile`, `PhotoViewer`), `web/src/components/marketing` (`TestimonialCard`, `CategoryCard`, `ProcessSteps`), `web/src/layouts/PublicLayout.tsx`, and `EmptyValue` from `@/components`.
- Server shell hosting: `src/Csps.Server/Endpoints/SpaHosting.cs` and `src/Csps.Server/Composition/SpaRegistration.cs` (the `index.html` fallback and its cache headers) are where server-shaped HTML for OG tags and the real 404 status plug in.

### Established Patterns
- Controllers per resource under `/api/v1`, one handler per use case, `Result<T>` to ProblemDetails, FluentValidation in handlers, zod mirrors on the client (OR-3), services per module (OR-5), `rowversion` with 409 on conflict, default-deny authorization plus the authorization-matrix test.
- The public pages today are `HoldingPage` and `PublicPlaceholderPage` in `web/src/modules/public/pages`.

### Integration Points
- Order screens (`OrderPage`, `OrderFormPage`) get the "Customer said OK to show" box, the public toggle and the public team name (D-11, D-13, D-16).
- The admin nav gets one "Site Content" item (D-27).
- The public bundle budget is 150 KB gz, and the LCP work (D-28) runs against the real pages.

</code_context>

<specifics>
## Specific Ideas

- The owner thinks of "Recent work" as orders from the order list that staff choose to show publicly. Both Recent work and the Gallery build on that.
- Most visitors arrive from Facebook, so Messenger is the main call to action until the quote form lands.

</specifics>

<deferred>
## Deferred Ideas

- Per-photo choice of which order photos go public (the owner chose all photos, D-12). Revisit if staff start posting work-in-progress shots.
- Hours with a lunch break (two time ranges per day): not needed now (D-21).
- A Manager-curated Home strip (pinning or ordering Recent work): automatic for now (D-14).

</deferred>

---

*Phase: 11-public-site-content-management*
*Context gathered: 2026-11-11*

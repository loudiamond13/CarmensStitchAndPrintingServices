# Phase 12: Consent, Analytics & Legal - Context
*Created: 2026-11-15T21:05:00-06:00 · Updated: 2026-11-18T17:30:00-06:00*

**Gathered:** 2026-11-15
**Status:** Ready for planning
**Branch:** `gsd/phase-12-consent-analytics-legal` (owner, 2026-11-15: all Phase 12 commits go here). It was cut from `docs/phase-11-uat-close` (PR #27, still open), so it carries the Phase 11 UAT close commit (D-133) that is not on `main` yet.

<domain>
## Phase Boundary

Visitors get a fair cookie choice (bottom bar, Accept all and Reject all equal, Customize) and can clear their cookies and server-side analytics. With consent, the site records privacy-safe visits, sessions, page views, referrers, device families and Core Web Vitals. Without consent, it records only anonymous path-and-day counts. Managers see a Visitor stats page with a date range and a CSV export. Visitors can read the Privacy Policy, Cookie Policy, Terms of Use and Accessibility Statement, all linked in the footer, versioned, and marked DRAFT until the owner approves each one.

Requirements: ANL-01 to ANL-09, LEGAL-01 to LEGAL-05. LEGAL-06 (Manager procedures for data requests and breaches) is Phase 14. The quote form is Phase 13.

Also in scope (carry-over, D-133): add the first public Gallery photo on the live site and check that it loads (the gallery part of UAT 11-21).

</domain>

<decisions>
## Implementation Decisions

All rulings below: owner, 2026-11-15, in this discussion. They close OD-10 and OD-11 and the Phase 12 part of C-17.

### Data retention (OD-10: closed)
- **D-01:** **Orders, payments, discounts, order expenses and company expenses are kept forever.** No automatic deletion. Manual deletes stay as they are today. The Privacy Policy states this and the reason: bookkeeping and tax records.
- **D-02:** **Quote inquiries that never became an order, and their attachments, are purged 6 months after they were received** (INQ-07, Phase 13). Phase 12 only records the rule and the Privacy Policy wording. Phase 13 builds the purge job. **Reversibility:** one-way. Purged inquiries cannot be brought back.
- **D-03:** **Raw analytics events (visits, sessions, page views, Web Vitals) are kept 13 months**, then rolled into daily counts and purged (ANL-09). **Reversibility:** one-way. Once purged, unique visitors and sessions for that period cannot be recounted.
- **D-04:** **The anonymous daily counts are deleted after 3 years.** They hold no visitor id. **Reversibility:** one-way.
- **D-05:** **Consent records are kept 13 months** (a choice lasts 12 months, plus 1 month of margin), then purged.
- **D-06:** **The audit log stays at 8 months (D-32), unchanged.** PROJECT.md's OD-10 row ("audit log 2 yr") is out of date and gets corrected to point at D-32 and this ruling.
- **D-07:** **All purges run as maintenance jobs** through the Phase 9 maintenance endpoint called by GitHub Actions. They are not SQL triggers (OR-7), and their retention periods are named constants with tests, like `PurgeExpiredRecordsJob`.

### Legal pages and text (OD-11: closed)
- **D-08:** **Jurisdiction: the Philippines only.** The text is drafted for the Data Privacy Act of 2012 (RA 10173) and NPC rules. The Terms also consider the Consumer Act (RA 7394) and the Internet Transactions Act of 2023 (RA 11967).
- **D-09:** **The owner reviews and approves the text.** A lawyer review is optional and can come later: it is parked in the backlog. The owner asked what kind of lawyer: a Philippine data privacy / ICT lawyer for a one-time document review, found through an IBP chapter referral, with the free NPC guides to compare against. That is general information, not legal advice. A paid lawyer is the owner's choice and not required by this phase.
- **D-10:** **The legal text lives in the site's code** (in the web app, per page, with a version number and a last-updated date). It changes only through a reviewed release. There is no admin editor. **Reversibility:** costly. Moving to Manager-editable text later needs tables, an editor screen, history and a publish flow.
- **D-11:** **The controller is named from site settings:** the business name and the address parts already in `PublicSiteDto` (Phase 11), so the pages update when a Manager changes them. There are no hard-coded name or address values and no placeholders.
- **D-12:** **The Data Protection Officer is named by role:** "The owner, Data Protection Officer". There is no personal name on the public page.
- **D-13:** **Privacy requests go to the Contact page email from site settings.** There is no separate privacy mailbox.
- **D-14:** **DRAFT is shown as a notice box at the top of each legal page** ("Draft: this text is not final yet"), above the title, with the version and last-updated date. Each page has its own approved flag in code. The notice is removed per page when the owner approves that page. The owner's approval of each page is a manual check (parked in the backlog if the owner is away).
- **D-15:** **The Privacy Policy covers** the controller, the purposes (orders, quote inquiries, visitor stats, staff accounts), the retention rules D-01 to D-06, the visitor's rights under RA 10173, the NPC complaint route and the contact (D-13). It also covers the "Customer said OK to show" rule for public order photos (Phase 11 D-11).

### Cookie banner and consent (C-17: spec-gap screens)
- **D-16:** **First visit: a bar along the bottom of the screen.** The page stays visible and scrollable. Accept all and Reject all have the same size and weight. Customize opens the preferences. The bar links to the Cookie Policy. It is a `// SPEC-GAP:` screen composed from existing patterns.
- **D-17:** **Three categories:** Necessary (always on, not switchable), Visitor stats (analytics and Web Vitals), and Google map (the Contact page embed, D-20 of Phase 11). Accept all turns both optional ones on and Reject all turns both off.
- **D-18:** **A "Show map" tap without map consent loads the map for that view only**, then shows a small "Always show maps?" link. Choosing it saves map consent as a logged consent decision (ANL-07).
- **D-19:** **"Clear my cookies & data" is in the cookie settings panel** (opened from the footer "Cookie settings" link). It asks to confirm, then shows a success message. It does what ANL-04 says: expires non-essential cookies (server-side for HttpOnly ones), clears local and session storage, and deletes the server-side analytics tied to the visitor id.
- **D-20:** **GPC: no banner and visitor stats off.** The site respects the signal and doesn't ask. Cookie settings shows "Your browser asked us not to track you", keeps visitor stats off, and still lets the visitor allow the Google map. The GPC flag is stored on the consent record (PRD §5.4).
- **D-21:** **Visits from a browser signed in to admin are not counted** in the stats, not even as anonymous counts.
- **D-22:** **The cookie policy version changes only with a reviewed release**, bumped in code together with the Cookie Policy text. Every visitor is asked again after that release (ANL-07). There is no admin "ask everyone again" button.

### Visitor stats page (C-17: spec-gap screen)
- **D-23:** **"Visitor stats" is its own admin page with its own menu item, for Managers only.** It is not on the dashboard. Admin users are denied, and the authorization-matrix test covers it.
- **D-24:** **It opens on the last 30 days.** Presets: Last 7 days, Last 30 days, This month, Last month, This year, plus custom dates. The range is in the URL (WEB-10), and days follow the business calendar (`Asia/Manila`, `IBusinessCalendar`).
- **D-25:** **The CSV export is one row per day:** date, unique visitors, sessions, page views. A day with no data shows zeros. (Wording amended by D-33: "Visits" instead of "sessions".)
- **D-26:** **Web Vitals are shown in plain words with a color and an icon:** "Loading speed" (LCP), "Layout shifting" (CLS), "Response to taps" (INP), each rated Good, Needs work or Poor by Google's thresholds, with the number in small text. Color is never the only signal (WCAG).
- **D-27:** **Ranges older than 13 months:** page views, top pages and the device/browser split come from the daily counts. Unique visitors and sessions show "Not available for dates over 13 months ago" (an `EmptyValue`-style marker, not a dash, OR-4). A range that crosses the 13-month line says which part is partial.
- **D-28:** **Referrers are grouped into friendly names** for known sites: Facebook (m., l., lm., www.facebook.com), Messenger, Instagram and Google. Other referrers show their host. Visits with no referrer are listed as "Direct". The grouping happens when the referrer is stored, so the daily counts use the same names.

### UI-SPEC rulings (owner, 2026-11-15, answered in chat; 12-UI-SPEC OQ-1 to OQ-5 and two copy items)
- **D-29:** **The privacy contact email shows on the four legal pages only** (Privacy Policy, Cookie Policy, Terms of Use, Accessibility Statement), as an "Email:" link. It stays off the footer, Contact, JSON-LD and every other public page. This is a narrow exception to Phase 11 D-25, which otherwise stands. (OQ-1 A, owner, 2026-11-15)
- **D-30:** **On the Contact page on phones, the Messenger and Call bar is hidden until the visitor answers the cookie bar**, then it comes back. Only one bar sits at the bottom at a time. (OQ-2 A, owner, 2026-11-15)
- **D-31:** **"Clear my cookies & data" resets the saved choice to visitor stats off and map off**, logged as a new decision. The cookie bar does not ask again. (OQ-3 A, owner, 2026-11-15)
- **D-32:** **Three icons are added to `icons.ts` from the installed lucide-react 1.53.0:** `chart-column` (Visitor Stats menu item), `circle-x` ("Poor" speed rating) and `download` (Export CSV). No new package. (OQ-4 A, owner, 2026-11-15)
- **D-33:** **"Visits" replaces "Sessions"** on the Visitor Stats page and in the CSV header (`Date,Unique visitors,Visits,Page views`). This amends the wording of D-25. (OQ-5 A, owner, 2026-11-15)
- **D-34:** **The cookie bar's third button is "Cookie Settings"** (not "Customize"), the same name as the settings window and the footer button. (owner, 2026-11-15, on the UI checker's advice)
- **D-35:** **The "Clear your cookies and data?" dialog's dismiss button is "Keep My Data"**, for this dialog only; the shared ConfirmDialog default "Cancel" stays. (owner, 2026-11-15)

### Research rulings (owner, 2026-11-15, answered in chat; 12-RESEARCH Open Questions 1 to 6)
- **D-36:** **The maintenance run stays monthly.** The Privacy Policy and Cookie Policy wording changes from "Kept for 13 months" to "Kept for about 13 months; removed at the next monthly cleanup". The same wording style applies to every retention line that a monthly job enforces (D-03, D-05). No weekly cron line is added. (OQ 1 B, owner, 2026-11-15)
- **D-37:** **A visit with no referrer from the Facebook, Messenger or Instagram in-app browser is recorded under that app's name** (from the User-Agent the server already sees), not as "Direct". This extends D-28. Nothing extra is collected from the phone. (OQ 2 A, owner, 2026-11-15)
- **D-38:** **`web-vitals` 6.2.3 is approved** (Apache-2.0, no advisories, 41 days old on 2026-11-15, no install scripts, no dependencies). It is loaded only after "Visitor stats" consent, in its own chunk. Exact version pinned. The research findings in 12-RESEARCH § Package Legitimacy Audit are the recorded check. (OQ 3 A, owner, 2026-11-15)
- **D-39:** **The site publishes `/.well-known/gpc.json`** stating that it honors GPC, matching D-20. (OQ 4 A, owner, 2026-11-15)
- **D-40:** **The Privacy Policy's "Who else handles your data" list is:** the web host, Cloudinary (photos), the email sender, and Google (the Contact map, only when allowed). (OQ 5, owner, 2026-11-15)
- **D-41:** **Three defaults accepted as written** (12-RESEARCH A6 to A8): turning visitor stats off stops collection and expires the visitor id but keeps past rows (Clear is what deletes them); the GPC signal alone creates no consent record, and the GPC flag is stored on any decision made under it; Clear runs `localStorage.clear()`, which also resets a staff member's admin theme and orders view in that browser, and the daily totals with no visitor id stay (the Cookie Policy says so). (OQ 6, owner, 2026-11-15)

### Execution rulings (owner, 2026-11-16, answered in chat during wave 1)
- **D-42:** **Free about 1 KB of the public first download before wave 2.** Plan 12-05 (four legal routes) pushes `build:budget` to Home 150.09 KB and Contact 150.13 KB, over the 150 KB limit; the production build stays under (about 149.9 KB). A small recovery plan runs before any wave 2 plan, for example by keeping the admin route chunk list out of the public entry. The 150 KB limit is not raised. Later entry-touching plans (footer legal row, consent bar loader) must fit inside the freed room. (12-05 checkpoint option 1, owner, 2026-11-16)
- **D-43:** **A consent cookie dated in the future is rejected and the visitor is asked again.** Both codecs (`ConsentCookie.cs`, `consentCookie.ts`) treat a decision date later than now as no choice, with fixture cases in `tests/fixtures/consent-cookie-cases.json`. A crafted cookie cannot stretch its own 12-month life. (12-03 open point, owner, 2026-11-16)

### Legal review rulings (owner, 2026-11-18, answered in chat for plan 12-22)
- **D-44:** **Clear my data says it clears the optional cookies (option B).** The Cookie Settings Clear section, the Clear dialog, the Done line and the Cookie Policy say Clear deletes the optional cookies and saved settings, and that the necessary cookies stay (a signed-in staff member stays signed in). Clear itself does not change. (owner, 2026-11-18)
- **D-45:** **"Admin settings in this browser" stays under Necessary** in the Cookie Policy, as drafted; no separate "Staff only" group. (owner, 2026-11-18)
- **D-46:** **Privacy Policy retention lines follow D-36.** The cleanup runs monthly, so quote requests read "Kept for about 6 months after we receive them; removed at the next monthly cleanup." and the staff activity log reads "Kept for about 8 months; removed at the next monthly cleanup." The daily visitor totals line gets the same style ("about 3 years"), because the monthly job deletes those too. The rest of the drafted Privacy wording is kept. (owner, 2026-11-18)
- **D-47:** **Terms of Use kept as drafted**, including "By using the website, you agree to them", "offered as it is", no notice period for changes, and the shop name and address in the contact block. (owner, 2026-11-18)
- **D-48:** **Accessibility Statement kept as drafted:** "We will reply as soon as we can", no reply time and no full-accessibility promise. (owner, 2026-11-18)
- **D-49:** **The live Gallery photo check (plan 12-01, carried from Phase 11 as D-133) moves to Phase 13.** It needs the live site, which is not deployed yet. Phase 12 closes without it; the check is not marked passed. (owner, 2026-11-18)
- **D-50:** **Referrer names are checked as real host names (code review WR-G1-03, option 1).** A referrer name is kept only when it looks like a real web address: labels of 1 to 63 characters, no leading or trailing hyphen, at least one dot, no trailing dot, no bare IP address. Other names are not stored. Signing the visitor id is not done now. (owner, 2026-11-18)
- **D-51:** **One site-wide ceiling on the anonymous write routes (code review WR-G2-04, option 1).** The consent, page view, speed sample and clear routes get one shared limit across all callers (about 600 a minute), chained to the existing per-address limit. IPv6 grouping stays at /64. (owner, 2026-11-18)
- **D-52:** **The address hash is no longer saved (code review WR-G1-02, option 1).** A new visit stores no `IpHash`, and the page view handler no longer reads the address or the day salt. Rate limiting is unaffected: it reads the live connection and keeps its counts in memory. Removing the `IpHash` column, and the now unused day salt table, cache and purge, is a schema drop that needs its own owner approval later. The Privacy Policy never mentioned the address, so its wording is unchanged. (owner, 2026-11-18)
- **D-53:** **Visitor stats keep only the daily page tally (option B, replaces the per-visit records).** The site stops saving visits, page views and speed samples. Only `DailyPageCounts` (date, page, count, no personal data) is written. Unique visitors, sources, devices and page speed are removed from Visitor Stats. Reason: the per-visit rows are what a script could flood, and the owner does not need the detail. Cloudflare analytics was considered and not chosen. Planned and built as Phase 12.1. (owner, 2026-11-18)
- **D-54:** **No cookie banner.** With visitor stats gone, the Google map is the only optional item, and it stays off until the visitor taps "Show map"; that tap is the choice. The cookie bar, the Cookie Settings window and the footer "Cookie settings" link are removed. Phase 12.1. (owner, 2026-11-18)
- **D-55:** **The map tap lasts for that visit only.** Nothing is saved, so the site sets no optional cookies at all. "Always show maps?" and "Clear my cookies & data" are removed. Phase 12.1. (owner, 2026-11-18)
- **D-56:** **The unused visit, page view, speed sample and salt tables stay for now.** Nothing writes to them after D-53, and the monthly cleanup keeps removing old rows. Dropping them, and the `IpHash` column, needs a separate owner yes. (owner, 2026-11-18)
- **D-57:** **The smaller Visitor Stats page shows total page views, the most viewed pages and a page views per day or month chart, with CSV export.** (owner, 2026-11-18)
- **D-58:** **The D-53 to D-57 work is a new Phase 12.1,** with its own plan and review, and the owner approves the new Privacy and Cookie Policy wording there. Phase 12 records stay as they are. D-50 (referrer name check) no longer applies once referrers are not stored. D-51 (site-wide ceiling) still applies to the anonymous routes that remain. (owner, 2026-11-18)
- These rulings settle wording only. Each page stays DRAFT until the owner approves it page by page (D-09, D-14, plan 12-22 Task 1).

### Claude's Discretion
- How consent is stored in the browser (a first-party necessary cookie is expected), cookie names, and the consent record and analytics table design, within PRD §5.4, "no JSON columns" and the 256 MB host limits.
- How the visitor id, session timeout and IP truncation plus rotating-salt HMAC (ANL-05) are built. IPs are cut to /24 and /48 first, as in D-32.
- The collect endpoint's shape, rate limits and bot filtering. The beacon path cut at `?` and `#` is server-side as ANL-05 says.
- When the daily rollup runs and how it handles days still in progress.
- The legal page routes and their footer order, and the plain-English wording of the drafts.
- The trend chart, built by reusing or extending `IncomeExpenseChart` (hand-rolled SVG).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/ROADMAP.md` Phase 12: goal, success criteria, owner decisions and prerequisites.
- `.planning/REQUIREMENTS.md`: ANL-01 to ANL-09, LEGAL-01 to LEGAL-05 (LEGAL-06 is Phase 14, INQ-07 is Phase 13 and takes D-02).
- `CSPS-PRD.md` §5.4 (ConsentRecord, Visit, PageView, DailyPageStats), §6.7 (ANL table), §12 (WCAG 2.2 AA), §13 (Legal & Privacy), §14 (the E2E journeys "cookie consent accept/reject/customize/clear" and "metrics dashboard shows recorded visits").
- `.planning/PROJECT.md`: the OD-10, OD-11, OD-14 and C-17 rows (update OD-10 and OD-11 to point here).

### Prior rulings that bind this phase
- `.planning/phases/11-public-site-content-management/11-CONTEXT.md`: D-11 (the "Customer said OK to show" rule, which the Privacy Policy wording covers), D-20 (the tap-to-load Google map tied to consent and the narrow CSP `frame-src`), D-133 (the Gallery photo carry-over).
- D-32 (audit log append-only, 8-month retention, IP truncation /24 and /48): see `.planning/PROJECT.md` and the root `CLAUDE.md` Audit/logs line.
- `docs/CSPS-UI-SPEC.md`: tokens, components and §11 Accessibility. The cookie banner and preferences, the stats page and the legal pages are spec gaps (C-17): compose them from existing patterns and mark them `// SPEC-GAP:`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/components/data/IncomeExpenseChart.tsx`: the hand-rolled SVG chart from Phase 10, the base for the trend chart.
- `web/src/modules/public/components/SiteFooter.tsx`: where the "Cookie settings" link and the four legal links go.
- `web/src/modules/public/components/MapCard.tsx`: the tap-to-load map, which reads map consent (D-18).
- `web/src/lib/url-state/`: URL-held list and range params (WEB-10), for the stats date range.
- `src/Csps.Application/Content/PublicSiteDto.cs`: business name, address parts and contact email for the legal pages (D-11, D-13).
- `src/Csps.Application/Maintenance/IMaintenanceJob.cs` and `src/Csps.Infrastructure/Maintenance/PurgeExpiredRecordsJob.cs`: the pattern for the rollup and purge jobs (D-07).

### Established Patterns
- Controllers per resource under `/api/v1`, with explicit `[Authorize(Policy = ...)]` or `[AllowAnonymous]` and the authorization-matrix test. The collect and consent endpoints are anonymous and rate-limited; the stats endpoints are Manager only.
- The strict CSP is in `src/Csps.Server/Http/SecurityHeadersMiddleware.cs`. web-vitals loads only after consent, with no third-party script.
- API calls go in `modules/{public,admin}/services/` (OR-5), with zod mirrors of each validator (OR-3) and no long dash (OR-4).

### Integration Points
- PublicLayout: the banner mounts here, plus a page-view beacon on route change (path = `location.pathname` only).
- AdminLayout nav: a "Visitor stats" item for Managers.
- The maintenance endpoint and GitHub Actions cron: the new rollup and purge jobs.

</code_context>

<specifics>
## Specific Ideas

- Most visitors arrive on a phone from Facebook, so the bar must not hide the first jersey view more than it has to, and the Facebook referrer grouping matters most.
- The owner wants plain words on the stats page (Web Vitals as "Loading speed" and so on), not acronyms.

</specifics>

<deferred>
## Deferred Ideas

- **Lawyer review of the legal text** (optional, owner's choice, paid): backlog item. The DRAFT notice comes off on the owner's own approval (D-09, D-14).
- **Manager-editable legal text** in admin: not now (D-10).
- **A visitor-stats card on the Manager dashboard:** not chosen (D-23). It could be added later.
- **An admin "ask everyone again" consent button:** not chosen (D-22).

</deferred>

---

*Phase: 12-consent-analytics-legal*
*Context gathered: 2026-11-15*

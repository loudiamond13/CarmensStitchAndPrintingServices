---
phase: 12-consent-analytics-legal
plan: 30
subsystem: testing
tags: [visitor-stats, e2e, playwright, testing-endpoint, analytics, csv, axe, ef-core]
created: "2026-11-18T09:05:00-06:00"
updated: "2026-11-18T09:05:00-06:00"

requires:
  - phase: 12-28
    provides: "GET /api/v1/visitor-stats/export, the Export CSV button, downloadCsv with one byte-order mark"
  - phase: 12-24
    provides: "the consent, GPC and legal E2E specs and the consent fixture option"
  - phase: 12-23
    provides: "the Visitor Stats page, toolbar and URL state"
  - phase: 12-25
    provides: "the trend chart (one tab stop, arrow keys, live text)"
  - phase: 12-26
    provides: "the ranked lists and the device and browser card"
  - phase: 12-27
    provides: "the 13-month Note and the Not available KPI states"
provides:
  - "POST /api/testing/analytics (Testing only, compiled only with CSPS_TESTING): replaces the visitor stats on business days relative to today; 204, 400, or 403 on any database but CSPS_E2E and CSPS_Test_<guid>"
  - "TestingAnalyticsSeeder (Infrastructure): daily page counts always; rolled-up source, device and browser counts before the 13-month cut; raw visits and page views with made-up hashes from the cut on"
  - "seedAnalytics(request, days) in web/e2e/testing-api.ts"
  - "web/e2e/visitor-stats.spec.ts: eight @visitor-stats journeys in all five projects"
affects: [12-verify, secure-phase, ui-review, visitor-stats]

actuals:
  tokens: 14110
  tasks: 3
  commits: 6

plan_head_before: e5bf6a3f5afdbf0b7e5c762307b0ba969da87059
plan_head_after: 76a161b2

tech-stack:
  added: []
  patterns:
    - "Per-project seeded days: each Playwright project seeds its own business days, so exact counts hold while the five projects run at once"
    - "settle(page) before a navigation: load every font face first, so Firefox never logs a font download the test cut off"
    - "adminMenu(page): the sidebar on desktop, the opened drawer on a phone; the phone tab bar is not the menu"

key-files:
  created:
    - src/Csps.Infrastructure/Analytics/TestingAnalyticsSeeder.cs
    - src/Csps.Server/Controllers/TestingAnalyticsController.cs
    - tests/Csps.Server.IntegrationTests/Testing/TestingAnalyticsTests.cs
    - web/e2e/visitor-stats.spec.ts
    - .planning/phases/12-consent-analytics-legal/deferred-items.md
  modified:
    - src/Csps.Infrastructure/Analytics/AnalyticsRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
    - web/e2e/testing-api.ts

key-decisions:
  - "Seeded old days are 420 or more days back, a separate six-day block per project (slot x 10 days apart), not 400 to 395: the 13-month cut is 393 to 397 days back, so 395 days could fall inside the raw window"
  - "The seed writes rolled-up source and device rows only before the cut and raw visits only from the cut on, as the retention job leaves real data, so the reader and the job never meet both for one day"
  - "D-21 is proved on the Terms of Use row: no other @visitor-stats journey opens Terms, so the row moves only if the Manager's own view were counted; the total page views move while other projects run"
  - "Back and Forward are proved over a trip to the Dashboard, because a range change replaces the history entry (UI-SPEC URL params)"
  - "The chart's one tab stop is proved by one focusable inside the figure, Tab from Export CSV landing on the plot, and Shift+Tab going straight back to Export CSV"

patterns-established:
  - "A Testing seed for analytics: validate in the controller, write in an Infrastructure seeder under the TestingDatabaseGuard, one transaction and ExecuteDelete for the old rows"

requirements-completed: [ANL-08, ANL-05, ANL-06, ANL-09]

coverage:
  - id: D1
    description: "PRD §14: a visitor who accepts and opens Home, Products and Gallery shows up for a Manager in another browser: page views at least 3, visits and unique visitors at least 1, today's trend bar, and the three pages in Most viewed pages"
    requirement: ANL-08
    verification:
      - kind: e2e
        ref: "web/e2e/visitor-stats.spec.ts#@visitor-stats a visitor accepts and opens three pages, and a Manager in another browser sees the visits"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-21: a public page a signed-in Manager opens adds nothing (the staff marker cookie is set, the beacon is answered 204, the Terms of Use row does not move)"
    requirement: ANL-05
    verification:
      - kind: e2e
        ref: "web/e2e/visitor-stats.spec.ts#@visitor-stats a page a signed-in Manager opens on the public site adds nothing to the counts"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-23: an Admin who opens /admin/visitor-stats lands on /admin, and the menu (sidebar or drawer) has no Visitor Stats item"
    requirement: ANL-08
    verification:
      - kind: e2e
        ref: "web/e2e/visitor-stats.spec.ts#@visitor-stats an Admin who opens Visitor Stats lands on /admin and the menu has no Visitor Stats item"
        status: pass
    human_judgment: false
  - id: D4
    description: "WEB-10, D-24: This year writes ?range=this-year, a reload keeps it, Back and Forward bring it back; From after To shows the order message and sends no stats read until fixed"
    requirement: ANL-08
    verification:
      - kind: e2e
        ref: "web/e2e/visitor-stats.spec.ts#@visitor-stats This year is written to the URL, a reload keeps it, and Back and Forward bring it back"
        status: pass
      - kind: e2e
        ref: "web/e2e/visitor-stats.spec.ts#@visitor-stats a custom range with From after To shows the message and sends no request until it is fixed"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-27, ANL-09: seeded days over 13 months ago show the info Note, Not available for unique visitors and visits, page views 25, Home 21, Products 4, Facebook 6, Messenger 1"
    requirement: ANL-09
    verification:
      - kind: e2e
        ref: "web/e2e/visitor-stats.spec.ts#@visitor-stats a range wholly over 13 months ago shows the Note, Not available for the two counts, and the seeded figures"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Testing/TestingAnalyticsTests.cs#ARangeWhollyBeforeTheCutReadsTheSeededPageViewsAndReferrersAndNoVisitCounts"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-25, D-33: Export CSV downloads visitor-stats-{from}-to-{to}.csv; bytes start EF BB BF; the text is exactly the header and one row per day"
    requirement: ANL-08
    verification:
      - kind: e2e
        ref: "web/e2e/visitor-stats.spec.ts#@visitor-stats Export CSV saves the range with a byte-order mark, the header and one row per day"
        status: pass
    human_judgment: false
  - id: D7
    description: "A11Y: one h1 and zero axe violations at 390 and 1440 in Blush and Espresso, no sideways scroll at 320, the chart is one tab stop that moves with ArrowRight"
    requirement: ANL-08
    verification:
      - kind: e2e
        ref: "web/e2e/visitor-stats.spec.ts#@visitor-stats one h1 and no axe violations at 390 and 1440 in Blush and Espresso, no sideways scroll at 320, and the chart is one tab stop"
        status: pass
    human_judgment: false
  - id: D8
    description: "The Testing-only POST /api/testing/analytics: daily rows before the cut, raw visits from the cut on, a repeat replaces the day, a bad body is a 400, a database outside the test list is a 403 that never names it; matrix rows and allow-list entries; absent from Release"
    requirement: ANL-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Testing/TestingAnalyticsTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs#POST /api/testing/analytics (400 x3)"
        status: pass
      - kind: other
        ref: "dotnet build src/Csps.Server -c Release -warnaserror; grep -c TestingAnalytics on the Release dlls = 0"
        status: pass
    human_judgment: false

duration: 120min
completed: 2026-11-18
status: complete
---

# Phase 12 Plan 30: Recorded visits reach a Manager's Visitor Stats page and its CSV export, proved in real browsers Summary

*Created: 2026-11-18T09:05:00-06:00 · Updated: 2026-11-18T09:05:00-06:00*

**A visitor who accepts visitor stats and opens three pages now shows up on a Manager's Visitor Stats page in another browser, in all five Playwright projects. A new Testing-only `POST /api/testing/analytics` puts exact visit totals on chosen days, so the spec also proves the 13-month view, the URL range, the custom range check, the CSV export bytes and the page's accessibility.**

## Performance

- **Duration:** about 2 hours
- **Started:** 2026-11-18T13:00:00Z
- **Completed:** 2026-11-18T15:05:00Z
- **Tasks:** 3 (Task 1 the tracer; Task 2 TDD; Task 3 end-to-end checks)
- **Files:** 9 (5 created, 4 modified)

## Accomplishments

- **The live journey (PRD §14):** a visitor context with no saved choice presses Accept All on Home and opens Products and Gallery, waiting for each page view to be answered 204. A Manager signs in in another browser context, opens Visitor Stats from the menu and sees page views at least 3, visits and unique visitors at least 1, today's bar in the trend, and Home, Products and Gallery in Most viewed pages.
- **D-21:** a signed-in Manager (the staff marker cookie is checked) opens Terms of Use; the beacon is answered 204, and the Terms of Use row on a fresh read has not moved.
- **D-23:** an Admin who opens `/admin/visitor-stats` lands on `/admin`. The full menu (the sidebar, or the drawer on a phone) has no Users and no Visitor Stats item, and no link to the page exists.
- **The Testing seed:** `POST /api/testing/analytics` takes `{ days: [{ offsetDays, pageKey, views, visits?: [{ referrer, device, browser, os, pageViews }] }] }` relative to the business today. The controller checks every value: days are 0 or back to the 3-year floor, page keys come from a fixed list, and each day and page appears once. The seeder replaces every analytics row on those days in one transaction, using `ExecuteDelete` and EF adds only, with no SQL text. Before the 13-month cut it writes daily page, source, device and browser counts; from the cut on it writes daily page counts plus raw visits and page views with made-up SHA-256 hashes. It uses `#if CSPS_TESTING`, `[TestingOnly]`, `[AllowAnonymous]`, `[IdempotencyExempt]` and the `TestingDatabaseGuard` 403, like the site content seed.
- **The range in the URL (WEB-10, D-24):** This year writes `?range=this-year`; the subline reads "Jan 1 to ..."; a reload keeps it; Back from the Dashboard and Forward and Back again bring it back. A custom range with From after To shows "The start date must be on or before the end date." with `aria-invalid`, and no `GET /api/v1/visitor-stats` leaves until To is fixed; then one read carries both dates.
- **The 13-month view (D-27):** each project seeds its own six days 420 or more days back. A custom range over them shows the info Note, "Not available" for Unique visitors and Visits, page views 25, Home 21, Products 4, Facebook 6 and Messenger 1, all exact.
- **The CSV (D-25, D-33):** Export CSV saves `visitor-stats-{from}-to-{to}.csv`. Its first bytes are EF BB BF, and the text is exactly the header `Date,Unique visitors,Visits,Page views` and one CRLF row per day, with the two visit cells empty. The toast names the file.
- **Accessibility:** the page has one h1 and zero axe violations at 390 and 1440 in Blush and Espresso, and no sideways scroll at 320. The figure holds one focusable element: Tab from Export CSV lands on the plot, ArrowRight moves the live text to the next day, and Shift+Tab goes straight back to Export CSV.

## Task Commits

1. **Task 1 (tracer): the live journey, D-21 and D-23:** `7fc3f564`. The tracer gate re-ran `npm --prefix web run e2e -- --grep @visitor-stats` on the committed spec: `15 passed (54.9s)`. Only then did Task 2 start.
2. **Task 2: the Testing seed:** RED `772ebdb9`, GREEN `038130a0`.
3. **Task 3: URL range, custom range, 13-month view, CSV, accessibility:** `9f0abdd8`.
4. **Fix: the lock timeout rule:** `76a161b2`. `scripts/e2e-lock-timeouts.test.ts` (part of `verify`) failed on the new spec until the journey used the timeout form the rule reads.

## TDD Gate Compliance

| Task | RED | GREEN | Evidence |
|------|-----|-------|----------|
| 2 | 772ebdb9 | 038130a0 | RED run of the plan's filter set (`*TestingAnalyticsTests`, `*AuthorizationMatrixTests`, `*AuthorizationCoverageTests`, `*IdempotencyCoverageTests`, `*TestingConfigurationTests`): `total: 620, failed: 22, succeeded: 598`. Every new test failed on its first status check (for example "seed.StatusCode should be NoContent", the route was a 404). The three new matrix rows, `DiscoveredEndpointsAreFullyCovered`, `ParallelCallersEachGetTheirOwnStatus` and `EveryDiscoveredPostIsCoveredOrExemptWithAWrittenReason` failed because the rows named a route that did not exist yet. GREEN: `total: 620, failed: 1`. The one failure was a tie in my own test's sort order (two Facebook visits in either order); after adding `ThenBy(PageViews)`, `*TestingAnalyticsTests` passed 16 of 16. |

- Tasks 1 and 3 are end-to-end checks of behaviour that already shipped (12-23 to 12-28), so they could not be written to fail first, as in 12-24. Each was run in all five projects. Every red run was traced to a cause in the test (see Deviations) before the fix.
- The one red-first rule outside Task 2: `scripts/e2e-lock-timeouts.test.ts` failed on the spec (`expected [ Array(1) ] to deeply equal []`), and passed (4 of 4) after `76a161b2`.

## Verification (quoted)

Every E2E, full test and `verify` run came after `preflight.ps1 -Ports 5180,5115,7028,5199` showed the four ports free and "Dev/test processes: none".

- `npm --prefix web run e2e -- --grep @visitor-stats` (all five projects, after Task 3): `40 passed (2.4m)`, exit 0. Final run on the last commit: see "Final E2E run" below.
- `npm --prefix web run e2e -- --grep @visitor-stats --project firefox --repeat-each 3` (after the font fix): `24 passed (1.2m)`.
- `npm --prefix web run e2e -- --grep "@consent|@gpc"` (all five projects, after Task 3): `85 passed (7.5m)`, exit 0. Nothing regressed.
- `dotnet test --project tests/Csps.Server.IntegrationTests` with `CSPS_TEST_SQL=localdb` for that process only, filters `*TestingAnalyticsTests *AuthorizationMatrixTests *AuthorizationCoverageTests *IdempotencyCoverageTests *TestingConfigurationTests *OpenApiSnapshotTests *OpenApiExposureTests`: `total: 639, failed: 0, succeeded: 639, skipped: 0`.
- `dotnet test --project tests/Csps.ArchitectureTests`: `total: 290, failed: 0`.
- `dotnet build Csps.slnx -warnaserror`: `0 Warning(s) 0 Error(s)`.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- `dotnet build src/Csps.Server -c Release -warnaserror`: `0 Warning(s) 0 Error(s)`. `grep -c TestingAnalytics` gives 0 on the Release `Csps.Server.dll` and `Csps.Infrastructure.dll`, and 8 on the Debug `Csps.Server.dll`: the endpoint never exists in Release.
- `dotnet build Csps.slnx -c Release`: 27 errors, all in two test projects this plan did not touch (`TestingImageDelivery`, `TestingImageStorage` and `StoredTestImage` are Testing-only types). Logged in `deferred-items.md`. Every `src/` project builds in Release.
- **Web `verify`, run 1:** typecheck, lint and format:check passed; `test:coverage` `Tests 1 failed | 11509 passed (11510)`, the lock timeout rule on my spec (fixed in `76a161b2`).
- **Web `verify`, run 2 (after the fix, vitest cache deleted first):** typecheck, lint and format:check passed; `test:coverage` `Tests 1 failed | 11509 passed (11510)`: `OrderFormPage.test.tsx` "cannot be left through the dialog while a save is pending ...", the known load flake. Run alone: `Tests 84 passed (84)`. `verify` stops at the first failing step, so I ran the rest one by one: `build` exit 0, `build:budget` exit 0, `license:check` exit 0, `notices:check` exit 0, with no warning lines.
- **`build:budget` (D-42, no limit changed):** public JS home 147.84, products 144.55, gallery 145.89, contact 149.39, privacy 149.58, cookies 149.49, terms 148.69, accessibility 148.25, notFound 140.61 KB (limit 150.00); admin JS 223.32 KB (limit 250.00); CSS 20.50 KB (limit 35.00). All `ok`. This plan added no app bytes: Privacy and admin match the wave 11 figures.
- **Acceptance greps:** `@visitor-stats` 8 (needs 3 or more); `#if CSPS_TESTING` in the controller 1; `POST /api/testing/analytics` in AuthorizationMatrix.cs 2; `seedAnalytics` in the spec 4; `Date,Unique visitors,Visits,Page views` in the spec 1; `from './fixtures'` 0, see deviation 7.
- **Final E2E run** (`npm --prefix web run e2e -- --grep @visitor-stats` on `76a161b2`, all five projects): `40 passed (2.7m)`, exit 0.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug in the new test] The menu helper on phones and slow shells**
- **Found during:** Task 1, first all-project run (2 failed, 13 passed).
- **Issue:** on Pixel the test clicked a Visitor Stats link that never became visible. A context made with `browser.newContext()` inherits the project's device, and the phone tab bar has a visible Dashboard link but no Visitor Stats, so the drawer was never opened. On WebKit the check ran before the shell had rendered.
- **Fix:** `adminMenu(page)` waits for the sidebar or the "Open navigation" button, opens the drawer on a phone, and returns the sidebar or the drawer.
- **Commit:** part of `7fc3f564` (before the tracer commit).

**2. [Rule 3 - Blocking] Firefox logged a font download that the test cut off**
- **Found during:** Task 1 and Task 3 runs (Firefox only).
- **Issue:** `downloadable font: download failed ... status=2152398850` (NS_BINDING_ABORTED) for `archivo-latin-ext`. The dashboard's late data (the peso sign) starts that font download, and the test's next `goto` cut it off. Waiting for `document.fonts.ready` or `networkidle` was not enough, because the download starts after both.
- **Fix:** `settle(page)` loads every font face of the page before a navigation, a reload or the Export click.
- **Verification:** Firefox `--repeat-each 3`: 24 of 24; all projects 40 of 40.

**3. [Plan detail] Old days 420 or more days back, one block per project**
- **Issue:** the plan's "days 400 to 395 ago" can cross the 13-month cut (393 to 397 days back), and the five projects seeding the same days at once would replace each other's rows.
- **Fix:** each project seeds six days starting 425 + 10 x slot days back. The counts stay exact.

**4. [Spec conflict] Back and Forward**
- **Issue:** the plan says Back and Forward restore the previous range, but UI-SPEC "URL params" says a change replaces the history entry, so there is no earlier range entry to go back to.
- **Fix:** proved over a trip: This year, then Dashboard, then Back gives This year, Forward gives the Dashboard, and Back gives This year again. Recorded as owner question 1.

**5. [Plan detail] D-21 on one page row**
- The other projects record views at the same time, so total page views can move between two reads. The check reads the Terms of Use row, which no @visitor-stats journey opens.

**6. [Browser difference] The chart's tab stop**
- Firefox keeps focus on the plot when Tab leaves the last tab stop of the page, so "Tab leaves the chart" failed there. The check is now: one focusable inside the figure, Tab from Export CSV lands on the plot, and Shift+Tab goes straight back to Export CSV.

**7. [Criterion wording] `grep -c "from './fixtures'"` is 0**
- The spec imports `from './fixtures.ts'`, as every spec does (the same note as 12-24). The plan's intent, that the spec uses the shared guard fixture, holds: `grep -c "from './fixtures.ts'"` is 1.

**8. [Verify command] The plan's Release build**
- `dotnet build Csps.slnx -c Release` fails in two test projects this plan did not touch (deferred-items.md). The Release proof is the `src/Csps.Server` Release build with 0 warnings, plus the dll check.

**9. [Tooling] Commit ledger**
- The sandbox does not allow writing the ledger file under `.git/worktrees/`, so `plan_head_before` is the base commit given at spawn, `e5bf6a3f`. `git rev-list --count e5bf6a3f..HEAD` was measured: 4 at the Task 3 commit and 5 after the fix. The SUMMARY commit makes 6.

**Total:** 2 test fixes, 1 blocking fix, 6 plan or wording notes. No app code changed and no package was added.

## Owner questions (away mode; nothing blocked)

1. **Back and Forward on Visitor Stats.** The plan says Back and Forward "restore the previous range". The UI spec says a range change replaces the history entry, which is what the page does, so Back leaves the page instead of going to the last range.
   - **Recommended: keep "replace"** (today's behaviour, as the UI spec says). Back leaves the page, like the Dashboard and Audit Log filters. The spec proves Back and Forward bring the range back after leaving.
   - Or: add a history entry for each range change, so Back steps through earlier ranges. This changes the URL-state helper used by other pages.
2. **Firefox's "downloadable font: download failed" console line.** A real visitor who leaves a page while the second font subset is still downloading gets this line in Firefox's console. Nobody sees it, and the page is fine.
   - **Recommended: no app change.** The tests load the fonts before they navigate.
   - Or: preload the latin-ext subset in the page head. This costs one more request on every public page.
3. **"Today" range (open from 12-22).** This plan did not change it. "Today's" counts are proved inside the default Last 30 days (today's bar and the live counts), as the wave notes suggested.

## Flakes

- `OrderFormPage.test.tsx` "cannot be left through the dialog while a save is pending, and lands on the order when the save ends" failed once in `verify` run 2 (load). Run alone: 84 of 84 passed. This is the known load flake.
- No E2E flake: each E2E red run was traced to a cause in the new test (deviations 1, 2 and 6) and passed after the fix.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-12-74 is mitigated: the endpoint uses `#if CSPS_TESTING` and `[TestingOnly]`, it is absent from the Release dlls, and the database guard 403 never names the database (tested with three names). T-12-75 is mitigated by the Admin journey. T-12-SC: no package was added or bumped (`npm ci` with the lock files only).

## Next Phase Readiness

- The Phase 12 verify can cite `@visitor-stats` (40 tests in five projects) for PRD §14 "metrics dashboard shows recorded visits", D-21, D-23 to D-27 and D-33.
- The phase gate still needs the full `dotnet test Csps.slnx`, full `npm --prefix web run e2e` and `lighthouse` (the /gallery Lighthouse question from 12-24 is still open).

## Self-Check: PASSED

- Files found: `src/Csps.Infrastructure/Analytics/TestingAnalyticsSeeder.cs`, `src/Csps.Server/Controllers/TestingAnalyticsController.cs`, `tests/Csps.Server.IntegrationTests/Testing/TestingAnalyticsTests.cs`, `web/e2e/visitor-stats.spec.ts`, `.planning/phases/12-consent-analytics-legal/deferred-items.md`.
- Commits found on this branch after `e5bf6a3f`: `7fc3f564`, `772ebdb9`, `038130a0`, `9f0abdd8`, `76a161b2`.

---
phase: 12-consent-analytics-legal
created: 2026-11-20T19:00:00-06:00
updated: 2026-11-20T19:35:00-06:00
fixed_at: 2026-11-20T19:00:00-06:00
review_path: .planning/phases/12-consent-analytics-legal/12-REVIEW.md
iteration: 1
findings_in_scope: 14
fixed: 14
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

*Created: 2026-11-20T19:00:00-06:00 · Updated: 2026-11-20T19:00:00-06:00*

**Fixed at:** 2026-11-20T19:00:00-06:00
**Source review:** `.planning/phases/12-consent-analytics-legal/12-REVIEW.md` (fresh pass, D-79)
**Iteration:** 1

**Summary:**
- Findings in scope: 14 (all Warning; Info findings were out of scope)
- Fixed: 14
- Skipped: 0

The older REVIEW-FIX.md (2026-11-18) is replaced by this file; it stays in git history.

**Where the checks ran:** the fixes were made in an isolated git worktree (`.claude/worktrees/rf-12-...`), then fast-forwarded onto `gsd/phase-12-consent-analytics-legal` and the worktree was removed. The worktree had its own `npm ci` install, so the web numbers below are not reproducible from a leftover tree. Re-run them in the main checkout. Local runs used LocalDB (`CSPS_TEST_SQL=localdb`, set per process). The preflight showed ports 5180, 5115, 7028 and 5199 free before every web and E2E run. No package was added or bumped.

## Fixed Issues

### D80-WR-01: Dead domain code from the removed consent and visit design

**Status:** fixed: requires human verification (a model-neutral refactor; please eyeball the diff)
**Files modified:** `src/Csps.Domain/Analytics/` (`AnalyticsVisit`, `AnalyticsPageView`, `AnalyticsVitalSample`, `AnalyticsSalt`, `ConsentRecord`, `DailyDeviceCount`, `DailyReferrerCount`, `ReferrerName`; deleted `ConsentSource`, `DeviceKind`, `VitalMetric`, `VitalBounds`), the four EF configurations for `AnalyticsVisit`, `AnalyticsVitalSample`, `ConsentRecord`, `DailyDeviceCount`, `tests/Csps.Application.UnitTests/Analytics/AnalyticsSurfaceTests.cs`, `tests/Csps.Domain.UnitTests/Analytics/` (deleted `AnalyticsVisitTests`, `ConsentRecordTests`, `DeviceKindTests`, `VitalBoundsTests`, `DailyAnalyticsCountTests`; reduced `ReferrerNameTests`; added `KeptAnalyticsEntityTests`), `tests/Csps.Testing/LegacyAnalyticsRows.cs` (new), `AnalyticsRetentionJobTests`, `VisitorStatsReaderTests`, `VisitorStatsExportTests`
**Commit:** 359729fd
**Applied fix:** Removed the factories (`Start`, `Of`, `Create`, `Decide`, `IsPolicyVersion`), the enums `ConsentSource`, `DeviceKind`, `VitalMetric`, `DeviceDimension`, `VitalBounds` and the five `ReferrerName` name constants. Kept all seven entity classes, their EF configurations, the tables and the four migrations. Kept `ReferrerName.MaxLength` (253).
- The four enum columns (`Device`, `Source`, `Metric`, `Dimension`) became plain `byte` properties. The model snapshot already stored them as `byte`, so there is no schema change. `dotnet ef migrations has-pending-model-changes` printed "No changes have been made to the model since the last migration."
- Retention and reader tests now seed old rows through the test-only helper `LegacyAnalyticsRows` (sets stored values by reflection; no EF or SQL).
- `AnalyticsSurfaceTests`: dropped the two `ShouldContain` lines and added the removed names to the "must not exist" lists. This test failed first (RED: 2 of 4 failed), then passed.
- Domain coverage must stay 100%, and the private constructors lost their callers. A small `KeptAnalyticsEntityTests` (constructs each entity, checks empty defaults, round-trips every stored value) covers them. No `[ExcludeFromCodeCoverage]` was used.
**Evidence:**
- Build of `Csps.slnx`: 0 warnings, 0 errors.
- Domain unit tests 1994 passed; Application unit tests 3161 passed; architecture tests 290 passed; retention and reader integration tests 35 passed; export integration tests 6 passed.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (4321/4321), branch 100% (1845/1845); Csps.Application line 98.2%. Gate passed.

### G2-WR-01: The 2048-byte body cap on the page view route has no test

**Files modified:** `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs`
**Commit:** 1be08ac4
**Applied fix:** Added a 2049-byte body test (413 and no rows) and an exactly-2048-byte test (204, counted as `not-found`, never 413). A chunked variant was not added: the test host does not apply the Kestrel max-body feature to chunked bodies, so it would not prove the control.
**Evidence:** 28 tests in the class passed. With the attribute temporarily raised to 4096, the 413 test failed; the attribute was restored.

### G2-WR-02: `TheCeilingLeavesOtherRoutesAlone` cannot fail if the ceiling never engages

**Files modified:** `tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs`
**Commit:** 0c4b7806
**Applied fix:** The four page view answers are collected and asserted (204, 204, 204, 429) before the unrelated read.
**Evidence:** 12 tests in the class passed. With the test's ceiling temporarily set to 300, the test failed; restored.

### G2-WR-03: Retention budget stop and batching only tested for raw page views

**Files modified:** `tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs`
**Commit:** 2d355e4f
**Applied fix:** Four new tests: 1200 old referrer rows and 1200 old device rows go in three batches each (line total 2400); a spent budget after the first `DailyPageCounts` batch ends the pass with `More` before the salt rule (and leaves a referrer row untouched); the same for consent records (daily rule absent); the same for salts, with a second run that finishes the rest.
**Evidence:** 24 tests in the class passed. With the referrer step's batch temporarily doubled, the referrer/device batch test failed; restored.

### G3-WR-01: A failed "business today" lookup replaces valid Visitor Stats figures with an error page

**Status:** fixed: requires human verification (logic change)
**Files modified:** `web/src/modules/admin/hooks/useVisitorStatsToday.ts`, `web/src/modules/admin/hooks/useVisitorStatsToday.test.tsx`
**Commit:** 60ec3cd6
**Applied fix:** The hook returns `isError: state.isError && today === null`, so a failed refresh is not an error while a date is held. Added the test the review asked for (answer goes stale, the refresh answers 404, `today` stays set and `isError` is false).
**Evidence:** The new test failed first (`expected true to be false`), then passed. The hook test file and `VisitorStatsPage.test.tsx` passed (66 tests). ESLint, Prettier and `tsc` clean.

### G3-WR-02: Month bars carry no year, so a multi-year trend repeats the same labels

**Status:** fixed: requires human verification (label logic; visual check on a 2 to 3 year range is worth doing)
**Files modified:** `web/src/components/data/VisitorTrendChart.tsx`, `web/src/components/data/VisitorTrendChart.test.tsx`
**Commit:** c9aed4e4
**Applied fix:** When month bars span two calendar years, the first drawn label and each drawn label that starts a new year read like "Jan 2026". The rule works on the labels that are actually drawn (not only on January), so a thinned axis still shows every year change. Those labels use the 44px room that day labels use. A single-year range is unchanged.
**Evidence:** New tests (two-year range, three-year range with thinned labels) failed first, then passed; the thinned-label test expectation was updated to `Jan 2026`. All 24 chart tests, and the data, admin page and dev scenario tests (550 tests) passed. ESLint, Prettier and `tsc` clean.

### G4-WR-01: "asks for nothing while it is not enabled" asserts before a request could arrive

**Files modified:** `web/src/modules/admin/hooks/useVisitorStatsToday.test.tsx`
**Commit:** e0f24f19
**Applied fix:** The test waits 50 ms, then checks the query client is idle and no list request arrived.
**Evidence:** Passed. With the `enabled` guard temporarily removed from `useBusinessToday.ts`, the test failed; restored.

### G4-WR-02: Cookie inventory scans a fixed pair of files and only prefixed names

**Files modified:** `web/src/test/cookie-inventory.node.test.ts`
**Commit:** 036be05b
**Applied fix:** The inventory reads every `.cs` file in `src/Csps.Server/Security` except `RetiredCookies.cs`, and the name pattern accepts a bare `csps_` name. A second check scans all server C# for `Cookies.Append(` and requires each call to use a name constant from the inventory files. The "reads at least one name" check now names the two cookie files. The retired file is still read separately.
**Evidence:** 16 tests passed. A temporary extra constant plus a literal `Cookies.Append("csps_literal", ...)` made four tests fail; the temporary file was removed.

### G4-WR-03: "has no block that opens Cookie Settings" can never fail

**Files modified:** `web/src/test/legal-content.node.test.ts`
**Commit:** 119ac48c
**Applied fix:** Replaced with a check that fails on any block kind outside `p`, `ul`, `dl`, `h3`, `facts`.
**Evidence:** 21 tests passed. With `facts` temporarily removed from the known set, 3 tests failed; restored.

### G4-WR-04: Axe test "with the export toast shown" passes when no toast is shown

**Files modified:** `web/src/modules/admin/pages/VisitorStatsPage.test.tsx`
**Commit:** a9b8e73d
**Applied fix:** The wait for the toast no longer swallows its failure; it is now `expect(await screen.findByText('Visitor stats exported', ...)).toBeInTheDocument()`.
**Evidence:** All 62 tests in the file passed. With the expected text temporarily wrong, the test failed.

### G4-WR-05: Negative beacon tests wait a fixed 60 ms

**Files modified:** `web/src/modules/public/hooks/usePageViewBeacon.test.tsx`, `web/src/layouts/PublicLayout.test.tsx`
**Commit:** 55a04600
**Applied fix:** The "skips /admin, /dev", "repeat click" and "hidden page" tests, and the PublicLayout "/dev and /admin" test, now continue to a counted path, wait for that request, and check nothing came before it. The test Beacon got a second link (Gallery) as the control for the repeat-click case.
**Evidence:** 63 tests across the two files passed. With the admin/dev skip temporarily removed, 5 tests failed. With the same-path guard removed, 2 other tests failed (the repeat-click test cannot reach that guard, because a same-path click does not re-run the effect; its control still catches a repeat send).

### G5-WR-01: "A signed-in Manager's page view adds nothing" can pass when the view is wrongly counted

**Files modified:** `web/e2e/visitor-stats.spec.ts`, `docs/web/e2e.md`
**Commit:** aaf9e839 (shared with G5-WR-02: same file, same helper)
**Applied fix:** New helper `pageViewsByName` exports the CSV for the default range and sums each page's rows (the CSV lists every page, the top 5 list does not). The test compares the Terms of Use total before and after the Manager opens `/terms`, under the site content lock.
**Evidence:** Playwright, chromium project, `@visitor-stats` and `@no-cookies`: 13 passed. With the staff gate in `CollectPageViewHandler` temporarily switched off, this test failed (`Expected: 0, Received: 1`); the handler was restored.

### G5-WR-02: The "Manager sees each count rise" test is satisfied by other projects' traffic

**Files modified:** `web/e2e/visitor-stats.spec.ts`, `docs/web/e2e.md`
**Commit:** aaf9e839
**Applied fix:** The visitor now opens `/terms`, `/accessibility` and `/privacy` (only opened by other specs under the site content lock), the whole sequence runs under that lock, and each page's CSV total must rise by exactly one. The test no longer calls `ensureDemoSiteContent` (the legal pages need no demo photos), so it waits for the lock once. Timeout is 480 s, as for the other lock test. Test title and file header changed to match; the `docs/web/e2e.md` `@visitor-stats` row now says "exactly one" and explains why the legal pages are exact.
**Evidence:** Same Playwright run as G5-WR-01 (13 passed in chromium). Not run in the other four projects.
**Note:** This commit also carries the `@no-cookies` row edit in `docs/web/e2e.md` that belongs to G5-WR-03.

### G5-WR-03: The `@no-cookies` checks are narrower than the claim

**Files modified:** `web/e2e/no-cookies.spec.ts`
**Commit:** 001aaebb
**Applied fix:** `expectNothingStored` now waits for the page view beacon and expects 204, records every response of the context and asserts none carries `Set-Cookie`, and asserts `localStorage` and `sessionStorage` are empty. The file header says so.
**Evidence:** Same Playwright run (13 passed in chromium, including both `@no-cookies` tests). With a temporary `localStorage.setItem` in the page helper, the plain-browser test failed on "nothing in browser storage"; restored. Not run in the other four projects.

## Skipped Issues

None. No finding needed an owner decision.

## Checks run at the end (in the fix worktree)

- `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- `npm run lint` (`--max-warnings 0`), `npm run typecheck` and Prettier on every changed web file: clean. No em or en dash in the changed web files.
- Full web unit run (`npx vitest run`, 420 files): 11222 passed, 2 failed, both in `scripts/license-policy.test.ts`. Re-run alone in the worktree, one still failed ("No packages found in this path", the license checker finding no packages in a git worktree). The same file run in the main checkout passed (64 of 64). The two failures are in a file these fixes did not touch, and look like a worktree artifact. Please confirm with a full web run in the main checkout.
- E2E: only the chromium project was run, and only the `@visitor-stats` and `@no-cookies` specs. Firefox, webkit, pixel and iphone were not run.
- Flakes: none seen.

## Orchestrator check in the main checkout

- Full web unit run (`npx vitest run`, 420 files): 11223 passed, 1 failed. `scripts/license-policy.test.ts` passed, so its worktree failure was an artifact.
- The one failure was real and came from G5-WR-01/02: `scripts/e2e-lock-timeouts.test.ts` did not see the 8 minute timeout on the new lock-taking visitor stats test, because it was set with `testInfo.setTimeout` instead of `test.setTimeout`. Fixed in a follow-up commit (same timeout, the form the guard reads). After the fix: `e2e-lock-timeouts.test.ts` and `license-policy.test.ts` 68 of 68 passed; ESLint, Prettier and `npm run typecheck` clean.
- Migrations: no file under any `Migrations` folder changed in the 13 fix commits (D-80 holds).

## Outcome of every finding

The disposition ledger (`12-REVIEW-DISPOSITION.md`) cannot read group-prefixed ids such as `G2-WR-01` and recorded none of them, so this table is the record. Info findings were outside this fix pass (`--fix` without `--all`) and are deferred until the owner chooses to run `--fix --all` or rules on them.

| Finding | Severity | Outcome | Where |
|---|---|---|---|
| D80-WR-01 | Warning | fixed (D-80; needs a human look at the diff) | 359729fd |
| G2-WR-01 | Warning | fixed | 1be08ac4 |
| G2-WR-02 | Warning | fixed | 0c4b7806 |
| G2-WR-03 | Warning | fixed | 2d355e4f |
| G3-WR-01 | Warning | fixed (needs a human look) | 60ec3cd6 |
| G3-WR-02 | Warning | fixed (needs a visual check on a 2 to 3 year range) | c9aed4e4 |
| G4-WR-01 | Warning | fixed | e0f24f19 |
| G4-WR-02 | Warning | fixed | 036be05b |
| G4-WR-03 | Warning | fixed | 119ac48c |
| G4-WR-04 | Warning | fixed | a9b8e73d |
| G4-WR-05 | Warning | fixed | 55a04600 |
| G5-WR-01 | Warning | fixed | aaf9e839, follow-up 89e65500 |
| G5-WR-02 | Warning | fixed | aaf9e839, follow-up 89e65500 |
| G5-WR-03 | Warning | fixed | 001aaebb |
| G5-IN-01 | Info | fixed in passing (the `docs/web/e2e.md` rows) | aaf9e839 |
| G3-IN-04 | Info | deferred: owner wording, part of the D-73 Privacy Policy review | owner backlog |
| G5-IN-02 | Info | deferred: doc wording in `.claude/CLAUDE.md` and `CSPS-PRD.md`; owner docs | owner backlog |
| G1-IN-01 to G1-IN-04 | Info | deferred: out of fix scope | `12-REVIEW.md` |
| G2-IN-01 to G2-IN-04 | Info | deferred: out of fix scope | `12-REVIEW.md` |
| G3-IN-01 to G3-IN-03, G3-IN-05 | Info | deferred: out of fix scope | `12-REVIEW.md` |
| G4-IN-01 to G4-IN-04 | Info | deferred: out of fix scope | `12-REVIEW.md` |
| G5-IN-03 | Info | deferred: out of fix scope | `12-REVIEW.md` |

---

_Fixed: 2026-11-20T19:00:00-06:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

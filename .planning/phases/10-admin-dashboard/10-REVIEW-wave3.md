---
phase: 10-admin-dashboard
created: 2026-11-07T02:58:00-06:00
updated: 2026-11-07T05:05:00-06:00
reviewed: 2026-11-07T02:58:00-06:00
scope: "wave 3: plan 10-06 (git diff 8886c2ad 687b7cfd^2) and plan 10-07 (git diff 8886c2ad 95129c9c^2), .planning/ excluded"
depth: standard
advisory: true
files_reviewed: 44
files_reviewed_list:
  - docs/api/dashboard.md
  - src/Csps.Application/Dashboard/ChartMonths.cs
  - src/Csps.Application/Dashboard/DashboardChartResponse.cs
  - src/Csps.Application/Dashboard/GetDashboardChartHandler.cs
  - src/Csps.Application/Dashboard/GetDashboardChartRequest.cs
  - src/Csps.Application/Dashboard/GetDashboardChartRequestValidator.cs
  - src/Csps.Application/Ports/IDashboardReader.cs
  - src/Csps.Infrastructure/Dashboard/DashboardReader.cs
  - src/Csps.Server/Composition/DashboardApplicationRegistration.cs
  - src/Csps.Server/Controllers/DashboardController.cs
  - tests/Csps.Application.UnitTests/Dashboard/ChartMonthsTests.cs
  - tests/Csps.Application.UnitTests/Dashboard/GetDashboardChartHandlerTests.cs
  - tests/Csps.Application.UnitTests/Dashboard/GetDashboardChartRequestValidatorTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs
  - tests/Csps.Testing/OrderSeeding.cs
  - tools/openapi-gen/openapi.v1.json
  - web/src/types/api.generated.ts
  - web/e2e/a11y-rulings.spec.ts
  - web/e2e/admin-keyboard.spec.ts
  - web/e2e/admin.spec.ts
  - web/e2e/audit-log.spec.ts
  - web/e2e/auth.ts
  - web/e2e/dashboard.spec.ts
  - web/e2e/keyboard.spec.ts
  - web/e2e/motion.spec.ts
  - web/e2e/orders-list.spec.ts
  - web/e2e/shell.spec.ts
  - web/e2e/sweep.ts
  - web/src/core/routes/router.tsx
  - web/src/layouts/AdminLayout.test.tsx
  - web/src/modules/admin/components/dashboard.recipe.ts
  - web/src/modules/admin/dashboardCopy.ts
  - web/src/modules/admin/hooks/useDashboardSummaryQuery.ts
  - web/src/modules/admin/pages/DashboardPage.test.tsx
  - web/src/modules/admin/pages/DashboardPage.tsx
  - web/src/modules/admin/routes.test.tsx
  - web/src/modules/admin/routes.tsx
  - web/src/modules/admin/services/dashboardService.test.ts
  - web/src/modules/admin/services/dashboardService.ts
  - web/src/test/dashboardFixtures.ts
  - web/src/utils/format.test.ts
  - web/src/utils/format.ts
findings:
  critical: 0
  warning: 4
  info: 10
  total: 14
status: issues_found
---

# Phase 10 wave 3: Code Review Report

*Created: 2026-11-07T02:58:00-06:00 · Updated: 2026-11-07T02:58:00-06:00*

**Reviewed:** 2026-11-07T02:58:00-06:00
**Depth:** standard, with call chains followed into BusinessClock, the SoftDelete filters, ErrorState, LoadingRegion, the query defaults and the e2e guard
**Files Reviewed:** 44
**Status:** issues_found (advisory review: nothing was edited, committed or run)

## Summary

Plan 10-06 (the chart API) is sound. The window comes from `clock.Today` through `BusinessClock.MonthOf`, so it uses the business zone and not UTC. Gap filling, year ends, the 6 or 12 allow-list (text, signs, decimals and overflow all refused before the reader runs), decimal money, the SoftDelete filters on payments, refunds and order expenses (each goes through its order) and the matrix row are all correct. No inline SQL, no cache, no trigger. I found no blocker. The main gap is a test one: no chart test pins a Manila month edge, so a slip back to a UTC month would still pass.

Plan 10-07 (the dashboard header) meets its must-haves. Dates are parsed strictly and formatted in UTC from their parts, so the device zone never enters. The greeting part is narrowed. The first name is rendered as text. Services, hooks and copy follow OR-3 to OR-6. I found no long dash, no `style` attribute and no direct `fetch`. The warnings cover two things. First, the page's behavior when a background refetch fails. Second, the e2e change that makes every signed-in spec wait on the dashboard greeting: it adds a 5-second dependency across 45 spec files, and it will stop covering the WebKit cancel error once plans 10-09 to 10-13 add more dashboard requests.

## Warnings

### WR-01: A failed background refetch shows yesterday's greeting and date next to the error

**File:** `web/src/modules/admin/pages/DashboardPage.tsx:29-33, 52`
**Issue:** The page builds the h1 and subline from `summary.data` whenever it is defined, and it shows the ErrorState whenever `summary.isError` is true. The query uses `staleTime: 0`, `refetchOnMount: 'always'` and the shared `refetchOnWindowFocus: true`, and gcTime is 5 minutes. So a failed refetch keeps the old data and also sets `isError`. The plan says "a summary error leaves the h1 'Dashboard', drops the subline and shows ErrorState". That only holds on the first load. No test covers the refetch case.
**Failure scenario:** Staff leave the dashboard open in a tab overnight. At 08:10 Manila they focus the tab. The refetch on focus fails (host restart, 503). The page shows "Good evening, Carmen" and "Tuesday, Nov 3, 2026 · Here's how the shop is doing this month." above "Couldn't load the shop figures." The business date is a day old and is not marked as stale. Plan 10-09 will copy the same `isError` test for the KPI row, and old money figures would then sit beside the error with no cue.
**Fix:** Choose the rule now, before 10-09 copies it. Write it in dashboardCopy or the page comment and add a test. Either:
```tsx
// Keep the title honest: the header only shows a greeting and date that came from a successful latest read.
const fresh = summary.isSuccess ? summary.data : undefined;
const title = fresh === undefined ? null : COPY.greeting(fresh.greeting, fresh.firstName);
```
or keep the last data on purpose (the P2 refetch rule) and add a DashboardPage test: first read OK, then `queryClient.refetchQueries` answered with a 500, and assert what the header shows. Use `summary.isLoadingError` and `summary.isRefetchError` to separate the two cases.

### WR-02: Every signed-in e2e spec now hangs on the dashboard summary with the default 5-second expect timeout

**File:** `web/e2e/auth.ts:114-116`
**Issue:** `signInAs` now waits for the greeting h1 after any landing on `/admin`. 45 spec files call `signInAs`. The wait uses the default 5 s expect timeout, and `playwright.config.ts` has `retries: 0`. The summary is the heaviest read in the app. It makes about 9 SQL commands, including a grouped read over every order in the shared, growing CSPS_E2E database. The 10-07 SUMMARY already records load flakes from the 5 s timeout in WebKit and iPhone on this machine.
**Failure scenario:** During a full run with another executor busy, the summary takes 6 s in WebKit. `orders-list.spec.ts`, `expenses.spec.ts` and the other signed-in specs fail inside `signInAs` with "expected h1 to have text /^Good (morning|afternoon|evening), .../". These specs do not test the dashboard. A failure there points away from its real cause, and a summary 500 now fails the whole suite instead of only `@dashboard`.
**Fix:** Wait on the response, not the text, with its own timeout, and report the status clearly. Start the wait before the code is submitted:
```ts
const summary = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/dashboard/summary', { timeout: 20_000 });
// ...submit the code...
if (new URL(page.url()).pathname === '/admin') {
  expect((await summary).status(), 'the dashboard summary after sign-in').toBe(200);
}
```
Or give the h1 assertion an explicit `{ timeout: 15_000 }`.

### WR-03: The signInAs workaround covers only the summary, so the WebKit failures come back when 10-09 to 10-13 add dashboard requests

**File:** `web/e2e/auth.ts:112-116` (and `web/e2e/fixtures.ts:6-8` for the guard's cancel rule)
**Issue:** The WebKit `pageerror: ... due to access control checks` comes from an in-flight request that a `page.goto` cancels. The guard header says a cancellation is not a failure, but this page error gets past that rule. The fix waits for the greeting only. Plan 10-11 adds `GET /dashboard/chart`, and plan 10-13 adds the money strip and recent-order reads, each in its own query. These can still be in flight after the h1 shows, and the SUMMARY admits this ("each new dashboard query ... adds the same exposure").
**Failure scenario:** After plan 10-11 merges, the chart request is still pending when `orders-list.spec.ts` calls `page.goto('/admin/orders')` right after `signInAs`. The WebKit and iPhone projects fail again with the same page error, in about the 12 specs seen in 10-07, and the 10-11 executor has to rediscover the cause.
**Fix:** Fix it once, in the guard. Treat a WebKit page error whose text is "... due to access control checks." for a same-origin `/api/` URL as a cancellation when a navigation started while that request was open, matching the guard's own rule. Or make `signInAs` wait until no `/api/v1/dashboard/` request is open (track `request` and `requestfinished`/`requestfailed` events). Then remove the h1 wait. Record this as a known item for plans 10-09, 10-11 and 10-13.

### WR-04: No chart test pins a Manila month edge, so a UTC month would pass every test

**File:** `tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs:20, 186`; `tests/Csps.Application.UnitTests/Dashboard/GetDashboardChartHandlerTests.cs:15, 57`
**Issue:** The handler correctly uses `BusinessClock.MonthOf(clock.Today)` (`GetDashboardChartHandler.cs:35`). But every pinned instant in the chart tests is 02:00Z, which is 10:00 in Manila on the same calendar day. The window would be the same if the handler used the UTC date. The review brief and D-04 depend on the Manila month.
**Failure scenario:** A later refactor builds the window from `DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime)`. On 1 November between 00:00 and 07:59 Manila (31 Oct 16:00Z to 23:59Z), the chart's last month would be 2026-10, and its income would not equal `collected.thisMonth`. All current tests still pass.
**Fix:** Add two endpoint cases next to the February one:
```csharp
// 00:30 Manila on Nov 1 is still Oct 31 in UTC: the last month is 2026-11 and holds a payment dated Nov 1.
new DateTimeOffset(2026, 10, 31, 16, 30, 0, TimeSpan.Zero)
// 23:59 Manila on Nov 30 is 15:59Z: the last month is still 2026-11.
new DateTimeOffset(2026, 11, 30, 15, 59, 0, TimeSpan.Zero)
```
Also add the same pair as handler unit tests using the `FixedCalendar` harness.

## Info

### IN-01: A repeated `months` parameter is silently cut to its first value; leading zeros pass

**File:** `src/Csps.Server/Controllers/DashboardController.cs:52`; `src/Csps.Application/Dashboard/GetDashboardChartRequest.cs:20`; `docs/api/dashboard.md:152`
**Issue:** MVC binds a `string` from the first query value, so `?months=6&months=7` answers 200 with six months. The unit case `"6,12"` covers only a literal comma. `NumberStyles.None` also accepts `"06"` and `"012"`. The docs say only `6` and `12` are accepted. This is not a safety risk: the allow-list still holds.
**Fix:** Either write both cases in the docs, or bind `[FromQuery] StringValues months` and refuse more than one value. Match `^(6|12)$` after trimming if leading zeros should be refused.

### IN-02: The contract types `months` as a free string and the response figures as `number | string`

**File:** `tools/openapi-gen/openapi.v1.json` (`/api/v1/dashboard/chart` parameter `months`); `web/src/types/api.generated.ts` (`GetDashboardChart.parameters.query.months?: string`, `DashboardChartResponse.months: number | string`)
**Issue:** The machine-readable contract does not carry the 6 or 12 allow-list. An Android or TS client built from it accepts any text. Plan 10-11's `dashboardService.chart(months, signal)` also has to turn a number into a string and narrow `months` and the money fields out of `number | string`.
**Fix:** Add `enum: ["6","12"]` with an operation transformer, or say so in the parameter description. Note for 10-11: narrow `items[].income/expenses/profit` the same way the summary money is narrowed.

### IN-03: Gap-filled months are written as `0`, not `0.00`

**File:** `src/Csps.Application/Dashboard/ChartMonths.cs:40-42`; `docs/api/dashboard.md:136-139, 151`
**Issue:** `0m - 0m` has scale 0, and System.Text.Json writes it as `0`. A month with real rows keeps scale 2 from SQL (`1000.00`). The docs example shows `0.00`. JSON readers see the same value, but a snapshot or a text compare will not.
**Fix:** Change the docs to "0", or seed the defaults as `0.00m` in `Of` (scale 2) so every figure has two decimals.

### IN-04: `ChartMonths.Build` is public and does not guard `months`

**File:** `src/Csps.Application/Dashboard/ChartMonths.cs:35`
**Issue:** A negative `months` throws `ArgumentOutOfRangeException` from the `List` capacity, and 0 returns an empty list. Only the validated handler calls it today.
**Fix:** `ArgumentOutOfRangeException.ThrowIfNegativeOrZero(months);` next to the null checks.

### IN-05: The chart tests do not check `Cache-Control: no-store`

**File:** `tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs`
**Issue:** The docs promise no caching. The class-level `[ResponseCache(NoStore = true)]` covers it, but only the summary test checks the header (`DashboardSummaryEndpointTests.cs:181`). A later action-level attribute could override it without any test failing.
**Fix:** Add `response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();` to one chart test.

### IN-06: The header has no loading announcement until plan 10-09

**File:** `web/src/modules/admin/pages/DashboardPage.tsx:40`
**Issue:** The skeleton has `aria-hidden` and there is no `LoadingRegion` or `aria-busy`, so a screen reader hears nothing while the summary loads, and the h1 then changes in silence. UI-SPEC gives the KPI row's "Loading the shop figures…" region to 10-09, so this is an in-between state. Also, a Try Again that fails again does not re-announce: the `role="alert"` node stays mounted with the same text.
**Fix:** Make sure 10-09 wraps the header skeleton and the KPI cards in its one LoadingRegion. Consider keying the ErrorState on `summary.errorUpdatedAt` so a repeat failure is announced again.

### IN-07: The loading test finds the skeleton through any `span[aria-hidden="true"]`

**File:** `web/src/modules/admin/pages/DashboardPage.test.tsx:145, 148`
**Issue:** The test passes or fails for reasons unrelated to the skeleton. An icon that becomes an `aria-hidden` span breaks line 148. A skeleton that stops rendering spans makes line 145 fail even though the skeleton still shows.
**Fix:** Scope the query to the title block, or use a `data-ui`/test id that the Skeleton family already exposes, if it has one.

### IN-08: The signInAs URL check still allows `/admin/sessions` and then skips the wait

**File:** `web/e2e/auth.ts:110, 114`; `web/e2e/audit-log.spec.ts:337`
**Issue:** The comment now says every bundle lands on the dashboard. The regex still accepts `/admin/sessions`, and the `if` then skips the greeting wait without a word. If sign-in ever lands on Signed-in Devices, only `dashboard.spec.ts` would notice.
**Fix:** Use `toHaveURL(/\/admin$/)` in `signInAs` (and in the audit-log Admin redirect), unless a spec passes a return path on purpose.

### IN-09: Some coverage moved off the real dashboard

**File:** `web/e2e/a11y-rulings.spec.ts:293`; `web/e2e/keyboard.spec.ts:40`; `web/e2e/sweep.ts:25`
**Issue:** D-BL-02 (current row hides the Manager tag) and the skip-link Tab test now run only on `/dev/components` with the placeholder user. The signed-in dashboard is out of the shared sweep until plan 10-21. `admin.spec.ts` still reads the first focusable element on `/admin`, so the gap is small.
**Fix:** Make sure the 10-21 plan lists D-BL-02 and the skip-link Tab stop for `/admin`, not only axe.

### IN-10: Production modules export names that only tests use

**File:** `web/src/modules/admin/pages/AdminPreviewPage.tsx:53` (`AdminPreviewRoute`); `web/src/modules/admin/hooks/useDashboardSummaryQuery.ts:7` (`dashboardKey`)
**Issue:** After the dev `/admin` entry was removed, `AdminPreviewRoute` is used only by `AdminLayout.test.tsx`. `dashboardKey` is used only by `DashboardPage.test.tsx` until a mutation invalidates it. Neither ships in production code paths, and a dead-export check would flag both.
**Fix:** Nothing is needed now. Plans 10-11 and 10-16 should invalidate `dashboardKey` from the order, payment, expense and transfer mutations, as the comment promises. Consider moving `AdminPreviewRoute` into the test or `dev/`.

---

_Reviewed: 2026-11-07T02:58:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Outcomes (owner away; recorded 2026-11-07)

| Finding | Outcome |
|---|---|
| WR-01 | Parked for the owner: P10-BL-04 (what a failed background refresh shows). |
| WR-02 | Fixed (`cd837310`): `signInAs` waits for the summary response (20 s), checks it is 200, then the greeting with a 15 s timeout. |
| WR-03 | Parked for the owner: P10-BL-05 (test guard policy for WebKit cancelled requests). |
| WR-04 | Fixed (`2b11031b`): endpoint and handler tests at 2026-10-31T16:30Z and 2026-11-30T15:59Z. The 16:30Z case fails when the handler uses the UTC date (checked, then reverted). The 15:59Z case is the same day in UTC and Manila, so it guards the month end only. |
| Info items | Deferred to the phase-end code review. Plan 10-11 executor is told to narrow the `number \| string` figures and `months`. |

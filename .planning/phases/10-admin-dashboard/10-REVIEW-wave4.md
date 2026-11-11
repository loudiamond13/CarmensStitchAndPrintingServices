---
phase: 10-admin-dashboard
created: 2026-11-07T05:44:00-06:00
updated: 2026-11-07T06:23:00-06:00
reviewed: 2026-11-07T05:44:00-06:00
scope: "wave 4: plan 10-08 and plan 10-09, plus the wave 3 fix commits in the same range (git diff e9f56fed..76f3f335), .planning/ excluded"
depth: standard
advisory: true
files_reviewed: 57
files_reviewed_list:
  - docs/api/staff-money.md
  - src/Csps.Application/Money/GetMyMoneyHandler.cs
  - src/Csps.Application/Money/MoneyErrors.cs
  - src/Csps.Application/Money/StaffMoneyResponse.cs
  - src/Csps.Application/Money/StaffMoneySums.cs
  - src/Csps.Application/Ports/IStaffMoneyReader.cs
  - src/Csps.Infrastructure/DependencyInjection.cs
  - src/Csps.Infrastructure/Money/MoneyRegistration.cs
  - src/Csps.Infrastructure/Money/StaffMoneyReader.cs
  - src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/MoneyTransferConfiguration.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
  - src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261107110304_AddMoneyTransfers.Designer.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261107110304_AddMoneyTransfers.cs
  - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
  - src/Csps.Server/Composition/ApplicationRegistration.cs
  - src/Csps.Server/Composition/MoneyApplicationRegistration.cs
  - src/Csps.Server/Controllers/StaffMoneyController.cs
  - tests/Csps.Application.UnitTests/Dashboard/GetDashboardChartHandlerTests.cs
  - tests/Csps.Application.UnitTests/Dashboard/GetDashboardSummaryHandlerTests.cs
  - tests/Csps.Application.UnitTests/Money/GetMyMoneyHandlerTests.cs
  - tests/Csps.Application.UnitTests/Money/StaffMoneySumsTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Money/StaffMoneyReaderTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksMigrationTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Persistence/MoneyTransfersMigrationTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Money/MoneyFixtures.cs
  - tests/Csps.Server.IntegrationTests/Money/StaffMoneyBalanceTests.cs
  - tests/Csps.Testing/MoneySeeding.cs
  - tests/Csps.Testing/OrderSeeding.cs
  - tools/openapi-gen/openapi.v1.json
  - web/e2e/auth.ts
  - web/src/components/lists/ResponsiveTable.test.tsx
  - web/src/components/lists/ResponsiveTable.tsx
  - web/src/components/lists/SkeletonTable.tsx
  - web/src/components/lists/lists.recipe.node.test.ts
  - web/src/components/lists/lists.recipe.ts
  - web/src/modules/admin/components/DashboardKpiRow.test.tsx
  - web/src/modules/admin/components/DashboardKpiRow.tsx
  - web/src/modules/admin/components/OrderBalanceCell.test.tsx
  - web/src/modules/admin/components/OrderBalanceCell.tsx
  - web/src/modules/admin/components/OrdersByStatusCard.test.tsx
  - web/src/modules/admin/components/OrdersByStatusCard.tsx
  - web/src/modules/admin/components/OrdersTable.tsx
  - web/src/modules/admin/components/RecentOrdersCard.test.tsx
  - web/src/modules/admin/components/RecentOrdersCard.tsx
  - web/src/modules/admin/components/dashboard.recipe.node.test.ts
  - web/src/modules/admin/components/dashboard.recipe.ts
  - web/src/modules/admin/dashboardCopy.ts
  - web/src/modules/admin/hooks/useDashboardSummaryQuery.ts
  - web/src/modules/admin/pages/DashboardPage.test.tsx
  - web/src/modules/admin/pages/DashboardPage.tsx
  - web/src/test/dashboardFixtures.ts
  - web/src/types/api.generated.ts
findings:
  critical: 0
  warning: 2
  info: 11
  total: 13
status: issues_found
---

# Phase 10 wave 4: Code Review Report

*Created: 2026-11-07T05:44:00-06:00 · Updated: 2026-11-07T05:44:00-06:00*

**Reviewed:** 2026-11-07T05:44:00-06:00
**Depth:** standard, with call chains followed into MoneyTransfer, MoneyOnHand, the SoftDelete filters, LegacyHolder, DatabaseLocks, KpiCard, LoadingRegion, ResponsiveTable, the admin shell recipe and the e2e shell overflow check
**Files Reviewed:** 57
**Status:** issues_found (advisory review: nothing was edited, committed or run; no test suite was run)

## Summary

Plan 10-08 (staff money on hand) is sound. I found no blocker in the money math or the schema.

- **Money.** The balance is never stored. The reader runs one untracked LINQ statement with six correlated sums, and `StaffMoneySums.Balance()` sends them through the one domain formula, `MoneyOnHand.Of`. Each source is counted once, by the right person column. Payments, refunds and order expenses go through their order's named SoftDelete filter, so a deleted order drops all three. Company expenses use their own filter. Deleted transfers are left out in one helper (`CountedTransfers`). The legacy holder is excluded by id. Sums of an empty set come back as 0.00 (the empty-person test proves it). All amounts stay `decimal`.
- **Migration.** `Up` only creates `MoneyTransfers`, its two CHECKs, five NO ACTION keys and six indexes, and inserts the `staff-money` lock row. The snapshot diff has no removed line, so no existing table changed. There is no trigger, no JSON column, no drop or rename in `Up`, and no lossy change. `Amount` is `decimal(18,2)`. EF binds the private `MoneyTransfer` constructor: every parameter name matches a mapped property. `IsHandover` with `HasDefaultValue(false)` is safe, because `false` is also the CLR default.
- **Security.** No inline SQL in application code. The controller declares `[Authorize(Policy = Policies.Staff)]` and `no-store`. The matrix row is 401/200/200. The route takes no id and the handler reads only the token's user, so there is no IDOR path.
- **Dates.** `today` comes from `IBusinessCalendar`. The wave 3 fix commits pin the Manila week and month edges correctly. I checked each expected count by hand.

Plan 10-09 (KPI row, Orders by status, Recent orders) meets its must-haves. Every figure comes from the summary. The comparison month comes from the server's clamped `comparisonThrough`, so there is no client date math. The footer count is the server's `orders.active`. Copy lives in `dashboardCopy.ts`. I found no em or en dash in `web/src`, no `style` attribute string, and no direct `fetch`. The new `embedded` and `skeletonRows` props are safe for every existing caller. Every default is unchanged, and `rows={undefined}` still falls back to 4. The two `SkeletonTable` callers that use it directly (OrderPage, DeletedOrderPage) pass neither prop. The OrderBalanceCell move changes no behavior.

The two warnings are both on the web side. First, the phone KPI figures: the 24 px phone size the executor reported is missing, and at 320 px the figures do not fit the 2 x 2 cards at all. Second, the Orders by status card never announces that its counts loaded.

## Warnings

### WR-01: The phone KPI figures do not fit the 2 x 2 cards at 320 px, and the 24 px phone size is not applied

**File:** `web/src/modules/admin/components/dashboard.recipe.ts:82-84` (with `web/src/components/money/money.recipe.ts:54-56`)
**Issue:** On phones the KPI row stays 2 x 2 with 16 px card padding. The KpiCard value is `whitespace-nowrap` at `clamp(26px, 15cqi, 40px)`. On a phone card, 15cqi is about 16 px, so the 26 px minimum always applies. UI-SPEC (typography table, line 181, and the KPI row, line 294) asks for 24 px at 420 px and below. That rule is not there. The executor saw the gap and left it for the screenshot review. It is more than a look question, though. Nothing on the card or in the admin shell clips overflow (`admin.recipe.ts` has no `overflow` class), so a figure that is too wide spills out of its card and can make the page scroll sideways. The project allows no sideways scroll from 320 to 1920 px. The long-figure clamp only starts at 15 characters, so normal shop figures never get it.
**Failure scenario:** At 320 px the main column is 288 px wide. Each card is about 138 px, which leaves about 104 px inside the padding. "₱126,450.00" (the 12.4 demo Collected figure) in Barlow Condensed bold at 26 px is about 120 px wide by my estimate. It runs past the right-hand card and the page scrolls sideways. `admin.spec.ts:147-150` checks for sideways scroll at 320 and 390 px on `/admin`, with whatever figures the shared CSPS_E2E database holds. That spec was not run after this plan. Only `@dashboard` on Chromium desktop was. At 24 px the same figure is still about 111 px, so the spec's own size does not fully fix 320 px for a six-digit figure.
**Fix:** This changes how the page looks, so it is the owner's call. Options, recommended first:
1. Add the UI-SPEC 24 px rule for `pg-xs` (420 px and below) to the row recipe. Then measure 320 px in the browser with a six-digit figure. If it still overflows, ask the owner whether the row goes to one column at `pg-xs`, as the Expenses KPI row does on phones (`expenses.recipe.ts:7`). This keeps the spec and fixes the worst case.
2. Lower the long-figure threshold on phone cards, so the 22 px clamp starts sooner.

Add a test either way. Put a six-digit figure in the dashboard e2e at 320 px and assert `scrollWidth <= innerWidth`, the same check `admin.spec.ts` makes.

### WR-02: Orders by status never says its counts have loaded, unlike the other two cards

**File:** `web/src/modules/admin/components/OrdersByStatusCard.tsx:72-81`
**Issue:** The card mounts `<LoadingRegion loading things="order counts">` only while the summary is missing. When the counts arrive, that branch is swapped for the list, so the whole LoadingRegion unmounts. Its polite status node goes with it. LoadingRegion is built to stay mounted, so it can say "Loading {things}…" and then "{Things} loaded." (states copy, `components/states/copy.ts:28`). The KPI row keeps its region mounted and says "The shop figures loaded." ResponsiveTable does the same for Recent orders. This card is silent, and its status node disappears mid-announcement. No test checks the "loaded" message for any of the three cards.
**Failure scenario:** A screen reader user opens the dashboard on a slow phone. They hear "Loading the shop figures…", "Loading order counts…" and "Loading recent orders…". Then they hear "The shop figures loaded." and "Recent orders loaded.", but nothing for order counts. They cannot tell whether the status card is still loading.
**Fix:** Keep one LoadingRegion around the card body whenever there is no error, and let `loading` change:
```tsx
} else {
  body = (
    <LoadingRegion loading={summary === undefined} things={COPY.things}>
      {summary === undefined || counts === null ? skeletonRows : largest === 0 ? empty : list}
    </LoadingRegion>
  );
}
```
Add a test in each card file: render as loading, rerender with data, and expect the status to read "Order counts loaded." (and "The shop figures loaded.", "Recent orders loaded.").

## Info

### IN-01: The reader comment cites "D-37", which in this phase means "no profit KPI"

**File:** `src/Csps.Infrastructure/Money/StaffMoneyReader.cs:15`
**Issue:** "the legacy holder is never read (D-37)". In 10-CONTEXT, D-37 is "No profit KPI card". The legacy holder ruling is 07 D-37. A reader in this phase is sent to the wrong ruling.
**Fix:** Write "(07 D-37)" or "(RESEARCH Pitfall 9)".

### IN-02: No endpoint test shows that a query id is ignored or that `/me` is never cached

**File:** `tests/Csps.Server.IntegrationTests/Money/StaffMoneyBalanceTests.cs`
**Issue:** The route takes no id, so there is no IDOR today. But no test pins that `GET /api/v1/staff-money/me?userId={other}` still answers the caller's own figure. No test checks the `Cache-Control: no-store` that `docs/api/staff-money.md` promises. Wave 3 IN-05 noted the same gap for the chart. Later plans add routes that do take a person id, so this guard matters more then.
**Fix:** Add one test: Liza asks for `/me?userId={paolo}` and gets her own `userId` and balance, and the response has `Cache-Control` containing `no-store`.

### IN-03: No test reads back `IsHandover = true` from the database

**File:** `tests/Csps.Infrastructure.IntegrationTests/Persistence/MoneyTransfersMigrationTests.cs:36-48`
**Issue:** `IsHandover` has a database default, so EF leaves the column out of the INSERT when the value is `false` and sends it only when it is `true`. The schema test reads back only `false`. The hand-over tests seed `true` but never read the flag. Plans 10-12 and 10-14 depend on it (D-57). A later mapping change, such as a nullable bool or a different default, could store hand-overs as `false` and no test would notice.
**Fix:** In the schema test, save a hand-over through `MoneyTransfer.RecordHandover` and assert `stored.IsHandover.ShouldBeTrue()`.

### IN-04: Most 10-08 Task 2 tests were never seen failing, and the one RED was made by holding back code

**File:** `.planning/phases/10-admin-dashboard/10-08-SUMMARY.md` (TDD section); `src/Csps.Infrastructure/Money/StaffMoneyReader.cs:26`
**Issue:** The SUMMARY says it openly: 23 of the 24 Task 2 tests passed at RED, because the tracer had already built the reader. The only RED came from leaving out `user.Id != LegacyHolder.Id` on purpose. The tests are good regression guards. But the binding rule is "a failing test first". A test that never failed has not been shown to catch the bug it names.
**Fix:** No code change. Record the outcome. For future tracer plans, either move the edge behavior out of the tracer or check each key test by breaking the code for a moment and seeing it fail, as the wave 3 WR-04 fix did.

### IN-05: A test name says "five payments" for one payment of 5,000

**File:** `tests/Csps.Infrastructure.IntegrationTests/Money/StaffMoneyReaderTests.cs:41`
**Issue:** `DeletingTheOrderThatHeldTheFivePaymentsTakesThePersonBelowZero` seeds one 5,000.00 payment. The name misleads anyone reading a failure.
**Fix:** Rename it to `DeletingTheOrderThatHeldTheFiveThousandTakesThePersonBelowZero`.

### IN-06: The new-shop fixture pairs a November today with a September comparison

**File:** `web/src/test/dashboardFixtures.ts:66-82`; `web/src/modules/admin/components/DashboardKpiRow.test.tsx:198-207`
**Issue:** The test sets `today: '2026-11-04'` but keeps the fixture's `comparisonThrough: '2026-09-06'`, and then expects "Collected · Nov" next to "Nothing collected by this day in Sep". The server never sends that pair. The test is correct about where the client takes the month from, but it writes down an impossible answer as the expected look.
**Fix:** Set `comparisonThrough: '2026-10-04'` in that test and expect "in Oct", or make `dashboardNewShopSummary` derive both dates from one `today`.

### IN-07: The Active orders figure has no thousands separator, while the status card does

**File:** `web/src/modules/admin/components/DashboardKpiRow.tsx:56-60`
**Issue:** KpiCard shows a non-money number as given, so 1,234 active orders reads "1234". The Orders by status card groups the same kind of count ("1,234", tested). Passing `formatCount(...)` would make the value text, and text skips the zero dim and takes the text clamp, so this is not a one-line fix.
**Fix:** Low priority. Either teach KpiCard to group counts when `money={false}` (it is shared, so check the parity scenarios), or accept it for a shop of this size and record that.

### IN-08: The phone rule hides the icon tile by matching another recipe's `size-8` class

**File:** `web/src/modules/admin/components/dashboard.recipe.ts:83`
**Issue:** `pg-phone:[&_.size-8]:hidden` hides any element in the row that has the class `size-8`. It works only because `kpiIconClasses` contains `size-8` (`money.recipe.ts:51`). If that tile changes size, the phone rule silently stops. If anything else in a card ever uses `size-8`, it disappears on phones. The recipe node test checks that the rule compiles, not that it still matches the tile. UI-SPEC line 45 also says the conversion adds "no ... class selector". `dashboardAllOrdersClasses` similarly borrows `loginLinkClasses` from the sign-in layout.
**Fix:** Export a hook from the money recipe, for example a `data-kpi-icon` attribute on the tile, and target `[&_[data-kpi-icon]]`. Or add a test that `kpiIconClasses` contains `size-8`, so the coupling is visible.

### IN-09: On a first-load failure the page raises three alerts with three identical "Try Again" buttons

**File:** `web/src/modules/admin/pages/DashboardPage.tsx:59-64`
**Issue:** All three cards read one query. When it fails, three `role="alert"` regions appear at once, and three buttons are all named "Try Again". Each one refetches the same request. This follows UI-SPEC (each card has its own state). But a screen reader hears three alerts in a row, and the buttons list shows three equal names.
**Fix:** No change needed for the spec. If the owner wants it quieter, give each button a name that includes its card, for example `aria-describedby` pointing at the card's alert title. Raise it in the screenshot and a11y review (10-21).

### IN-10: `DashboardCardQuery.isPending` is read by no card

**File:** `web/src/modules/admin/hooks/useDashboardSummaryQuery.ts:187-194`
**Issue:** Every card decides "loading" from `data === undefined`. The `isPending` member is only set by tests. A later card author may trust `isPending` and get a different answer, for example after `queryClient.resetQueries`.
**Fix:** Drop `isPending` from the interface, or use it in the cards and keep the two in step.

### IN-11: Until plan 10-11, the status card fills the wide 2fr column on desktop

**File:** `web/src/modules/admin/pages/DashboardPage.tsx:60-63`
**Issue:** The `.s-dash` grid is `2fr 1fr`, and the status card is its only child. So on desktop the card takes two thirds of the width and leaves an empty third. It is marked `SPEC-GAP` and is fixed when the chart card lands. If 10-11 slips or ships after a screenshot review, the review sees a broken layout.
**Fix:** None now. Make sure the 10-11 plan removes the note and the screenshot review runs after it.

---

_Reviewed: 2026-11-07T05:44:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Outcomes (owner away; recorded 2026-11-07)

| Finding | Outcome |
|---|---|
| WR-01 | Partly fixed (`5ebecbd0`, `cff3b321`): the 24 px phone size is applied, and a 320 px no-sideways-scroll check with a six-digit figure passes on chromium and iphone. A six-digit figure still runs 6 to 18 px into the card padding at 320 px, so the layout choice is parked for the owner as P10-BL-06 (its fit check is `test.fixme`). |
| WR-02 | Fixed (`afae7a23`, `332dbf0c`): one LoadingRegion stays mounted, so the card says "Order counts loaded."; loaded-message tests for all three cards. |
| IN-01 | Fixed (`d3097ba0`). |
| IN-02 | Fixed (`d4248542`): `/me` with another user id returns the caller own money and `no-store`; seen failing with the cache attribute removed. |
| IN-03 | Fixed (`dbaf025a`): a hand-over reads back `IsHandover = true`; seen failing with the flag forced off. |
| IN-04 | Accepted as recorded: the 10-08 SUMMARY states which tests were characterization tests. The mutation checks in later fix passes cover this. No change. |
| IN-05 | Fixed (`e0631141`). |
| IN-06 | Fixed (`cb705e39`). |
| IN-07 | Deferred to the plan 10-21 screenshot and a11y review: thousands separator on the Active orders figure (shared KpiCard, needs a parity check). |
| IN-08 | Fixed (`8e4a64c6`): `data-kpi-icon` on the KpiCard tile, targeted by the phone rule. |
| IN-09 | Deferred to the plan 10-21 a11y review: the three same-named "Try Again" buttons on a first-load failure (matches UI-SPEC today). |
| IN-10 | Fixed (`a67120e0`): `isPending` removed. |
| IN-11 | Accepted: plan 10-11 adds the chart as the first child of that row (SPEC-GAP marked in the code). |

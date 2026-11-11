---
phase: 10-admin-dashboard
scope: incremental since 305e5fae
created: 2026-11-10T09:00:00-06:00
updated: 2026-11-10T09:00:00-06:00
reviewed_range: 305e5fae599ffec06bbb72674f077bcc97d5a481..HEAD plus the uncommitted edit to web/src/modules/admin/auditCopy.test.ts
depth: standard
files_reviewed: 78
files_reviewed_list:
  - docs/api/orders.md
  - docs/api/staff-money.md
  - docs/operations/audit-log.md
  - docs/operations/list-performance.md
  - docs/web/e2e.md
  - src/Csps.Application/Audit/AuditChangeLines.cs
  - src/Csps.Application/Money/CreateMoneyTransferHandler.cs
  - src/Csps.Application/Money/MoneyAuditDetail.cs
  - src/Csps.Application/Ports/IOrderReader.cs
  - src/Csps.Domain/Auditing/AuditActions.cs
  - src/Csps.Infrastructure/Orders/OrderReader.cs
  - tests/Csps.Application.UnitTests/Audit/AuditChangeLinesTests.cs
  - tests/Csps.Application.UnitTests/Money/CreateMoneyTransferHandlerTests.cs
  - tests/Csps.Application.UnitTests/Money/MoneyAuditDetailTests.cs
  - tests/Csps.Application.UnitTests/Money/RemoveMoneyTransferHandlerTests.cs
  - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
  - tests/Csps.Server.IntegrationTests/Money/MoneyTransferDeletionTests.cs
  - tests/Csps.Server.IntegrationTests/Money/MoneyTransferEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs
  - web/e2e/auth.ts
  - web/e2e/dashboard-sweep.spec.ts
  - web/e2e/dashboard.spec.ts
  - web/e2e/fixture-selftest.spec.ts
  - web/e2e/fixtures.ts
  - web/e2e/money-sweep.spec.ts
  - web/e2e/money.spec.ts
  - web/e2e/orders-filters.spec.ts
  - web/src/components/data/IncomeExpenseChart.test.tsx
  - web/src/components/data/IncomeExpenseChart.tsx
  - web/src/components/lists/ResponsiveTable.test.tsx
  - web/src/components/lists/cells.tsx
  - web/src/components/overlays/overlays.recipe.node.test.ts
  - web/src/components/overlays/overlays.recipe.ts
  - web/src/components/states/ErrorState.test.tsx
  - web/src/components/states/ErrorState.tsx
  - web/src/components/states/LoadingRegion.tsx
  - web/src/components/states/loading.test.tsx
  - web/src/modules/admin/auditCopy.test.ts
  - web/src/modules/admin/auditCopy.ts
  - web/src/modules/admin/components/DashboardKpiRow.test.tsx
  - web/src/modules/admin/components/DashboardKpiRow.tsx
  - web/src/modules/admin/components/DeleteTransferDialog.test.tsx
  - web/src/modules/admin/components/DeleteTransferDialog.tsx
  - web/src/modules/admin/components/IncomeExpenseCard.test.tsx
  - web/src/modules/admin/components/IncomeExpenseCard.tsx
  - web/src/modules/admin/components/LedgerTable.test.tsx
  - web/src/modules/admin/components/LedgerTable.tsx
  - web/src/modules/admin/components/MoneyOnHandCard.test.tsx
  - web/src/modules/admin/components/MoneyOnHandCard.tsx
  - web/src/modules/admin/components/MoneyStrip.test.tsx
  - web/src/modules/admin/components/MoneyStrip.tsx
  - web/src/modules/admin/components/OrdersByStatusCard.test.tsx
  - web/src/modules/admin/components/OrdersByStatusCard.tsx
  - web/src/modules/admin/components/RecentOrdersCard.test.tsx
  - web/src/modules/admin/components/RecentOrdersCard.tsx
  - web/src/modules/admin/components/StaffBalancesTable.test.tsx
  - web/src/modules/admin/components/StaffBalancesTable.tsx
  - web/src/modules/admin/components/TransferButton.tsx
  - web/src/modules/admin/components/TransferModal.test.tsx
  - web/src/modules/admin/components/TransferModal.tsx
  - web/src/modules/admin/components/TransfersCard.test.tsx
  - web/src/modules/admin/components/TransfersTable.test.tsx
  - web/src/modules/admin/components/TransfersTable.tsx
  - web/src/modules/admin/components/dashboard.recipe.node.test.ts
  - web/src/modules/admin/components/dashboard.recipe.ts
  - web/src/modules/admin/components/money.recipe.node.test.ts
  - web/src/modules/admin/components/money.recipe.ts
  - web/src/modules/admin/dashboardCopy.ts
  - web/src/modules/admin/hooks/useTransferRowActions.ts
  - web/src/modules/admin/moneyCopy.ts
  - web/src/modules/admin/pages/DashboardPage.test.tsx
  - web/src/modules/admin/pages/DashboardPage.tsx
  - web/src/modules/admin/pages/MoneyPage.test.tsx
  - web/src/modules/admin/pages/MoneyPage.tsx
  - web/src/modules/admin/services/dashboardService.ts
  - web/src/modules/admin/services/moneyService.ts
  - web/visual/reference/rulings.css
  - web/visual/reference/rulings.test.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 10 Incremental Code Review

*Created: 2026-11-10T09:00:00-06:00 · Updated: 2026-11-10T09:00:00-06:00*

**Scope:** incremental since 305e5fae (the D-107, D-109, D-110 and D-111 fixes), plus the uncommitted edit to `auditCopy.test.ts`, read as it is on disk.
**Depth:** standard
**Files reviewed:** 78
**Status:** issues_found

## Summary

This pass read the diff from 305e5fae to HEAD. It covered the D-111 rulings (transfer audit entry, hand-over flag on the removed-transfer record, Newest sort by created time, kept dashboard figures with a stale line, half-thousand chart ticks, the WebKit cancelled-request guard) and the D-107 to D-110 layout and accessibility fixes. None of the prior review's findings (WR-01 to WR-05, IN-01 to IN-08, D-1 to D-12) are raised again.

The server side holds up well:

- The new `money-transfer.added` entry is written with `audit.Record` before the single `SaveChangesAsync`, inside the locked transaction, so it joins the transfer's save. A refused transfer returns before the `Record` call, and an idempotent replay never reaches the handler. Both are covered by unit and database tests.
- The detail holds ids, the amount, the date and `note=yes|no`, never the note text. The actor is the token's user, which the integration test pins.
- `AuditChangeLines.ReadTransfer` drops unknown keys through `default: break`, so `handover` never shows as a line. This is tested.
- The new action sits in `AuditActions.All`, in the web `AUDIT_ACTIONS` list and in the test mirrors. The count moved from 100 to 101 everywhere that counts it.
- The longest removed-transfer detail is about 260 characters, under the 400 limit.
- The Newest sort change is one expression in `OrderReader.Sort` and matches `ListNewestAsync`.
- The diff adds no raw SQL, no trigger, no `DateTime.Now`, no local path, no email and no em or en dash in `web/src`.

The web changes are sound. The kept-figures rule reads `isError && data === undefined` consistently in the three summary cards. The stale time comes from `dataUpdatedAt`, and `formatBusinessTime` accepts the `toISOString()` text with milliseconds (the INSTANT pattern allows `.\d{1,9}`). The aria-describedby ids point at nodes that exist in exactly the states where the button uses them. The tick helper is correct for every value the axis can produce (multiples of 500 from 1,000 up).

One real gap remains in the Transfer window. The rest are test and guard hygiene items.

No BLOCKER was found.

## Warnings

### WR-01: The Transfer window shows a loading skeleton forever when the business date cannot be read, and now says "Loading staff…" for it

**File:** `web/src/modules/admin/components/TransferModal.tsx:122-137` (the wrapper added at `:132-134`); `web/src/modules/admin/hooks/useBusinessToday.ts:77-79`, `:56-70`; `web/src/modules/admin/moneyCopy.ts` (`loadingThings: 'staff'`)

**Issue:** `TransferWindow` calls `useBusinessToday(open)`, which returns only `today`. `useBusinessTodayState` already exposes `isError`, `error` and `refetch`, but the window never reads them. When no fresh answer carrying `today` is held (the money answer is older than 5 minutes and its refetch fails, or it is invalidated) and the one small list call that asks for the date also fails, `today` stays `null`. The window then returns the skeleton branch with no end. D-109 and D-107 wrapped that skeleton in `<LoadingRegion loading things="staff">`, so a screen reader is now told "Loading staff…" for as long as the window stays open. That is wrong twice: nothing is loading any more, and the thing that failed is the date, not staff. The window has no failure line and no Try Again. A Manager on a flaky phone connection closes it and has no way to learn why Transfer does nothing.

**Failure scenario:**

1. Paolo leaves the dashboard open for 10 minutes. The held `staff-money` and `dashboard` answers pass the 5 minute age limit (`HELD_TODAY_MAX_AGE_MS`).
2. His phone drops off the network. He presses Transfer. The strip's figure is still shown from the earlier read, so the button is not blocked.
3. The window opens. The date probe fails. A skeleton shows and the status says "Loading staff…" with no end and no message.

**Fix:** Read the state, not just the date, and give the failure branch a line and a retry. The failed branch needs wording that the owner has not approved, so reuse the existing "Couldn't load" pattern or ask the owner for the line.

```tsx
const todayState = useBusinessTodayState(open);
const heldToday = todayState.today;
...
if (today === null) {
  return (
    <Modal open={open} title={handover ? HANDOVER.title : COPY.title} onClose={onClose}>
      <LoadingRegion loading={!todayState.isError} failed={todayState.isError} things={COPY.loadingThings}>
        {todayState.isError ? (
          <ErrorState things={COPY.failedThings} error={todayState.error} onRetry={todayState.refetch} />
        ) : (
          <SkeletonText />
        )}
      </LoadingRegion>
    </Modal>
  );
}
```

Add one test: the business-today call answers 500 with no held answer, so the window shows the alert and Try Again, and the status node does not say "Loading".

## Info

### IN-01: A test title still says 100 codes while it asserts 101

**File:** `web/src/modules/admin/auditCopy.test.ts:144`

**Issue:** The uncommitted edit raises both counts to 101 but leaves the test name as `'mirrors the 100 codes of the API'`. The name now contradicts its own assertions, and the next person to add a code will copy the wrong number from it.

**Fix:** Rename it to `'mirrors the 101 codes of the API'`, or drop the number from the title (`'mirrors every code of the API'`) so it cannot go stale again.

### IN-02: The money e2e helper accepts an earlier transfer's toast as proof that the new transfer was recorded

**File:** `web/e2e/money.spec.ts:187-189`

**Issue:** `recordTransfer` now waits for `page.getByText('Transfer recorded').first()`. The change was made so a second transfer in one test does not trip strict mode while the first toast is still on screen. The side effect is that the second call can pass on the first call's toast even if the second save showed no toast at all. The `expect(dialog).toBeHidden()` line before it still proves the window closed, so the risk is small, but the toast check no longer says anything about this particular transfer.

**Fix:** Wait for the earlier toast to leave first (`await expect(page.getByText('Transfer recorded')).toHaveCount(0)` at the start of the helper), or count toasts: record `const before = await page.getByText('Transfer recorded').count()` and assert `toHaveCount(before + 1)`.

### IN-03: The WebKit cancelled-request guard is matched on wording only, not tied to a cancelled request

**File:** `web/e2e/fixtures.ts:77-82`, `:140-149`, `:177-179`

**Issue:** The guard drops a WebKit page error when its text is exactly `/{own host}/api/... due to access control checks.` The owner ruled this scope (D-111, P10-BL-05 A), and the fixture self-tests prove the narrow cases, so this is not a defect against the ruling. The residual weakness is that WebKit uses the same sentence for any fetch rejected by access control checks, not only a cancelled one. A real fault in the app's own `/api/` fetch (for example a redirect that leaves the origin) would be swallowed in WebKit. The guard still sees HTTP failures through its `response` listener and CSP findings through the console, which covers most of that.

**Fix:** Optional hardening. Remember each own-host `/api/` URL for which `requestfailed` fired with a cancelled text (`CANCELLED` already exists for that), and drop the page error only when its URL is in that set. If the event order in WebKit makes that unreliable, leave it as is and keep the note in `docs/web/e2e.md`.

### IN-04: The Newest sort breaks ties on a GUID, which SQL Server does not order by creation

**File:** `src/Csps.Infrastructure/Orders/OrderReader.cs:57-65` and `:149`; `docs/api/orders.md` (the `sort` row)

**Issue:** Both the list's Newest sort and `ListNewestAsync` now end on `ThenByDescending(order => order.Id)`. Order ids are `Guid.CreateVersion7`. SQL Server compares `uniqueidentifier` by its last six bytes first, so for two orders with the same `CreatedAtUtc` the id order is stable but not chronological. Today this only decides exact-instant ties, which live orders almost never have, and the list and the dashboard agree because they read the same keys. It matters in Phase 16: the legacy import will carry legacy created dates (P10-BL-01, D-111), and legacy rows with a shared day or instant would sort by an effectively random but repeatable order. The docs describe the tie-break as "the highest id", which a reader may take as "the latest".

**Fix:** No change needed now. Add a note to the Phase 16 plan that imported orders which share a created time should get distinct created times (for example by a per-row offset in import order), or tie-break on a rising number such as the order number. Reword the doc line to "then by id, which only keeps pages from overlapping".

---

_Reviewed: 2026-11-10T09:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 10-admin-dashboard
wave: 10
plans: [10-20]
created: 2026-11-08T08:25:00-06:00
updated: 2026-11-08T08:54:00-06:00
reviewed_range: 6b8322f1..3b69c14f (excluding .planning/)
depth: deep
files_reviewed: 29
files_reviewed_list:
  - web/e2e/money.spec.ts
  - web/src/modules/admin/auditCopy.test.ts
  - web/src/modules/admin/auditCopy.ts
  - web/src/modules/admin/components/DeleteTransferDialog.test.tsx
  - web/src/modules/admin/components/DeleteTransferDialog.tsx
  - web/src/modules/admin/components/LedgerCard.test.tsx
  - web/src/modules/admin/components/LedgerCard.tsx
  - web/src/modules/admin/components/LedgerTable.test.tsx
  - web/src/modules/admin/components/LedgerTable.tsx
  - web/src/modules/admin/components/RemoveTransferDialog.test.tsx
  - web/src/modules/admin/components/RemoveTransferDialog.tsx
  - web/src/modules/admin/components/TransferActionDialogs.tsx
  - web/src/modules/admin/components/TransfersCard.test.tsx
  - web/src/modules/admin/components/TransfersCard.tsx
  - web/src/modules/admin/components/TransfersTable.test.tsx
  - web/src/modules/admin/components/TransfersTable.tsx
  - web/src/modules/admin/components/money.recipe.ts
  - web/src/modules/admin/hooks/useTransferDeletion.ts
  - web/src/modules/admin/hooks/useTransferRowActions.ts
  - web/src/modules/admin/hooks/useTransfersQuery.ts
  - web/src/modules/admin/moneyCopy.ts
  - web/src/modules/admin/pages/AuditLogPage.test.tsx
  - web/src/modules/admin/pages/MoneyPage.test.tsx
  - web/src/modules/admin/pages/MoneyPage.tsx
  - web/src/modules/admin/pages/StaffMoneyPage.test.tsx
  - web/src/modules/admin/pages/StaffMoneyPage.tsx
  - web/src/modules/admin/services/moneyService.test.ts
  - web/src/modules/admin/services/moneyService.ts
  - web/src/test/moneyFixtures.ts
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
status: issues_found
---

# Phase 10 Wave 10 Code Review (plan 10-20)

*Created: 2026-11-08T08:25:00-06:00 · Updated: 2026-11-08T08:54:00-06:00*

## Summary

I reviewed the Manager's Transfers tab (`TransfersCard`, `TransfersTable`, `useTransfersQuery`), the two confirms (`DeleteTransferDialog`, `RemoveTransferDialog`, `TransferActionDialogs`), the shared hooks (`useTransferDeletion`, `useTransferRowActions`), the ledger row actions (`LedgerTable`, `LedgerCard`, `StaffMoneyPage`), the new service calls and parser, the audit labels, the fixtures, the unit tests and the e2e. I traced the code into `ConfirmDialog`, `Modal`, `useFocusTrap`, `useRowFocus`, `useSubmission`, `useRefreshMoney`, `useStaffBalancesQuery`, `useMoneyListParams`, `createListParams`, the HTTP client's `params` and retry rules, the TanStack notify scheduler, and on the server `DeleteMoneyTransferHandler`, `ListStaffBalancesHandler` and `AuditActions`.

What holds:

- **Version and status handling.** The delete sends `version` through the client's `params`, so `URLSearchParams` encodes `+`, `/` and `=` (a test proves it). A 404 on a delete or a remove is a result: an info toast, the money answers read again, and the dialog closes and hands focus to the host. A 409 keeps the delete dialog open with the approved copy line, not the server's text, and reads the lists again. A remove sends no version. Every other failure goes through `describeHttpError`, so no server text reaches the screen.
- **Invalidation.** `useRefreshMoney` invalidates the `staff-money` root (my money, every ledger, staff balances, the person page), the `money-transfers` root (the Transfers list and recipients) and the dashboard. That is the full set the plan asks for.
- **Admins.** An Admin never asks for Manager data. The Transfers tab is not drawn. `useMoneyListParams` forces `tab` to `mine` and drops `deleted`. `TransfersCard` has `enabled: isManager` and returns null for a non-Manager. The ledger has no Actions column unless `canSeeActions` and the owner are both set. The staff-balance read in the delete dialog runs only while the dialog is open, and only a Manager can open it. The Audit Log, which now names money deletes, is Manager-only on both the route and the controller. Tests check the page, the card and the ledger for an Admin with `?tab=transfers` and `?deleted=true`.
- **Wave 6, 8 and 9 patterns.** `TransfersCard` matches `LedgerCard` exactly: `failed = isError && !isFetching`, `loading = (isFetching && (data === undefined || isError)) || pastTheEnd`, `clampPage` only on fresh data, the result bar and pager hidden past the end, and `Pagination` with `sizeOnlyWhenSinglePage`. `parseTransferPage` passes every amount, total, page and size through `toFiniteFigure` and refuses the whole answer on a bad one. The person page still calls `useCleanStaffMoneyUrl`.
- **Rules check.** I found no em or en dash in any added line (the minus sign in money is allowed). There is no `style` attribute, no `any`, no `eslint-disable` and no new package. The calls live in `modules/admin/services/moneyService.ts`. The web side takes no lock (D-53). The audit code list matches the 100 action codes in `AuditActions.cs` exactly. I diffed the two lists.
- **Test amendments.** The SUMMARY's amendments hold up. The ledger test that used to ban every button now allows exactly three buttons named `Delete|Remove transfer of`, and it still bans edit and restore. The StaffMoneyPage name pattern is anchored. The counts went from 97 to 100 codes and from seven to eight groups. None of them is weaker.

The main problems sit in the delete confirm. After a 409 its retry can never succeed (WR-01). Any later staff-balance read disables the focused confirm button and drops keyboard focus (WR-02). And the D-33 warning, the one safety message of the dialog, is never announced to a screen reader (WR-03). There is no critical finding.

## Critical

None.

## Warning

### WR-01: After a 409 the dialog keeps the old version, so "try again" sends the same stale version and fails every time

**Files:** `web/src/modules/admin/hooks/useTransferRowActions.ts:189-199`; `web/src/modules/admin/components/DeleteTransferDialog.tsx:55-61`; `web/src/modules/admin/hooks/useTransferDeletion.ts:103-106`; test `web/src/modules/admin/components/DeleteTransferDialog.test.tsx:384-402`

**Issue:** `openDelete` stores a snapshot of the row (`deleting.target`), including `version`. On a 409, `settle` reads the lists again, but nothing updates `deleting.target` from the new rows. The dialog stays open, the line says "Reload and try again.", and Delete Transfer stays enabled. A second press sends the same old version. `DeleteMoneyTransferHandler` compares that version with the stored `RowVersion` and answers `edit.stale` again. The person is stuck in a loop until they close the dialog and reopen it from the refreshed row. Nothing on screen tells them to do that.

The test "lets a corrected retry after a 409 go through" hides this. Its mock answers 409 the first time and 204 the second, whatever version arrives. Nothing is "corrected" in it, and it never checks the version of the second request.

**Failure scenario:** Carmen opens Delete on a transfer. Before she confirms, the row's version changes on the server (any update to the live row, such as a future import fix). She presses Delete Transfer and gets "This was changed by someone else. Reload and try again." The list behind the dialog refreshes, but the dialog does not. She presses Delete Transfer again and gets the same line, as often as she tries.

**Fix:** Have the host follow the fresh row. In `useTransferRowActions`, when `rows` change while `deleting` is open, swap in the new version for the same id. The row type needs the version for that, so pass `version` in `ActionableRow` or pass the full targets:

```ts
useEffect(() => {
  if (deleting === null || !deleting.open) return;
  const fresh = targets?.find((t) => t.id === deleting.target.id);
  if (fresh !== undefined && fresh.version !== deleting.target.version) {
    setDeleting({ target: fresh, open: true });
  }
}, [targets, deleting]);
```

Another option: keep the confirm disabled after a stale 409 until the refetch brings a new version. Change the test so the second request must carry the fresh version (`deletions.urls[1]?.searchParams.get('version')`), and so the mock answers 409 again when the old version is sent.

### WR-02: Any later staff-balance read disables the focused Delete Transfer button and drops keyboard focus out of the dialog

**Files:** `web/src/modules/admin/components/DeleteTransferDialog.tsx:46-48`, `:84`; `web/src/components/overlays/ConfirmDialog.tsx:123`, `:131`, `:191`; `web/src/modules/admin/hooks/useStaffBalancesQuery.ts:25-27`; `web/src/lib/query/queryClient.ts:11`

**Issue:** `checking = balances.isFetching` treats every fetch as "checking", not only the first read after the dialog opens. `ConfirmDialog` turns `countsLoading` into a native `disabled` on the confirm button (`disabled={!ok}`). The staff-balance query has `staleTime: 0`, and the app default is `refetchOnWindowFocus: true`, so it fetches again in two common cases while the dialog is open:

1. **After a 409.** `settle` calls `refreshMoney()`, which invalidates the `staff-money` root, and the open dialog's query is active. `ConfirmDialog.fail` first moves focus to the confirm button (line 131). One macrotask later (TanStack's `notifyManager` uses `setTimeout(0)`), `isFetching` turns true and the focused button becomes natively disabled. The browser's focus fixup drops focus to `body`. `useFocusTrap` only reacts to `focusin`, so it does not bring focus back.
2. **On window focus.** The Manager tabs to Delete Transfer, checks a figure in another window and comes back. The refetch disables the focused button in the same way. The warning also flickers to a skeleton and back.

A keyboard or screen reader user loses their place inside a modal dialog (WCAG 2.4.3 Focus Order). The skeleton's `role="status"` then announces "Loading staff balances…" with no context.

**Failure scenario:** A keyboard user presses Delete Transfer and gets the 409 line. Focus lands on the button and then disappears a moment later. The next Tab starts from the page body behind the modal, and the screen reader says nothing useful.

**Fix:** Distrust only the read the dialog started, and keep focus on the button during later reads:

```ts
const balances = useStaffBalancesQuery(open, { refetchOnWindowFocus: false });
// Only the first answer since this open gates the confirm; a later refresh keeps the last good figures.
const checking = balances.isFetching && balances.dataUpdatedAt < openedAt.current;
```

Set `openedAt` when `open` turns true. Or skip the staff-balance refetch for the 409 path, for example by invalidating the transfer lists only. Separately, `ConfirmDialog` could use `aria-disabled` (as `Button` already does for `loading`) instead of native `disabled` while counts load, so focus can never be lost. That is a shared-component change, so put it to the owner first.

### WR-03: The D-33 resulting-balance warning and the "Couldn't check" line appear late and are never announced

**File:** `web/src/modules/admin/components/DeleteTransferDialog.tsx:75-81`

**Issue:** The warning ("Liza Mercado's balance will be −₱500.00.") comes into view only after the staff-balance read finishes, after the dialog has opened and focus is on Cancel. It is a plain `<span>` inside the message `<p>`, with no live region. The dialog has no `aria-describedby` (`ConfirmDialog` passes no description). The skeleton's `role="status"` node is removed when the read ends, so nothing announces what replaced it. `ConfirmDialog` gives its own late cascade box `role="alert"` for exactly this reason (`ConfirmDialog.tsx:210`). The new block has nothing like it. This fails WCAG 4.1.3 Status Messages, and it hides the one safety fact this dialog exists to show (D-33, T-10-44). The "Couldn't check the new balances. The delete still works." line has the same gap.

**Failure scenario:** A screen reader user opens Delete on a ₱2,000.00 transfer to Liza, who holds ₱1,500.00. They hear "Delete this transfer?, dialog, Cancel, button", tab to Delete Transfer and press it. They were never told that Liza's balance will go to −₱500.00. A sighted Manager would have seen the warning.

**Fix:** Announce the block when it appears, and test it by role:

```tsx
{warn && (
  <span role="alert" className={transferWarningClasses}>…</span>
)}
{checkFailed && <span role="status" className={transferCheckFailedClasses}>{COPY.checkFailed}</span>}
```

In the tests, change `findByText(WARNING)` to `findByRole('alert')` with that text. Keep the axe run.

## Info

### IN-01: The busy 409 is shown as the stale line, though a retry would work

**File:** `web/src/modules/admin/components/DeleteTransferDialog.tsx:38-40`

**Issue:** `describeFailure` maps every 409 to "This was changed by someone else. Reload and try again." The delete has two 409s: `edit.stale`, and `money-transfers.busy` when two saves lose a race twice (wave 9 IN-07). After a busy 409 nothing changed, and the same press would succeed. The line tells the Manager to reload anyway.

**Fix:** Check the problem `code`. Keep the stale line for `edit.stale`, and let `describeHttpError` (or a short "Try again." line) handle `money-transfers.busy`. If that needs new wording, park it with P10-BL-14.

### IN-02: A focus intent left over from a failed refetch moves focus later, on an unrelated change

**File:** `web/src/modules/admin/hooks/useTransferRowActions.ts:175-185`

**Issue:** `after.current` is cleared only when the rows show the change. If the refetch after a successful delete fails, the old rows stay and the intent stays armed. The next rows change of any kind then fires it.

**Failure scenario:** A delete succeeds, but the list refetch hits a network blip, so the list shows its error state. The Manager ticks Show deleted. The new answer contains the deleted row (`isDeleted: true`), the effect counts the delete as settled, and focus jumps from the checkbox to another row's action (an unexpected change of context on input, WCAG 3.2.2).

**Fix:** Drop the intent when the list fails or the query key changes. For example, clear `after.current` when `failed` turns true or when `page`, `size` or `deleted` change. Or give the intent a short life tied to the refetch promise that `useRefreshMoney` already returns.

### IN-03: A receiver missing from the staff balances is assumed to hold ₱0.00, which is wrong for the legacy holder and no-role accounts

**File:** `web/src/modules/admin/components/DeleteTransferDialog.tsx:50-53`

**Issue:** `ListStaffBalancesHandler` leaves out zero-balance leavers, but also "the legacy holder and accounts with no staff role", whatever they hold. For those receivers the dialog computes `0 - amount` and shows a negative-balance warning that is not true. It also puts the internal placeholder name on screen, which P10-BL-07 option A avoids. This matters once the Phase 15-17 import brings in legacy transfers.

**Fix:** Treat a missing receiver as 0.00 only when the row says it is former staff (`transfer.to.formerStaff`). Otherwise show no warning, or show the "Couldn't check" line.

### IN-04: A test name promises two cases but tests one

**File:** `web/src/modules/admin/components/DeleteTransferDialog.test.tsx:230-239`

**Issue:** The test "shows no warning when the balance stays at or above zero: 3,000.00 held, and exactly 2,000.00 held" sets up only 3,000.00. The 2,000.00 case is the next test. A reader may think the boundary is covered twice, or that this test covers it.

**Fix:** Rename it to "... 3,000.00 held".

### IN-05: The e2e checks only that something in the tab panel has focus after a delete

**File:** `web/e2e/money.spec.ts:227`

**Issue:** `locator(':focus')).toHaveCount(1)` passes if focus is on the Show deleted box, the heading or any button. It does not prove the focus rule in a real browser, where the order of the dialog's focus return and the refetch can differ from jsdom.

**Fix:** Assert the exact target. Before the delete, read the name of the next row's Delete action (or note that the row is the only one). After it, expect that button to be focused, for example `await expect(table.getByRole('button', { name: nextName })).toBeFocused()`, else the caption or the heading 'Transfers'.

### IN-06: `TransfersCard` copies about 40 lines of paging and loading logic from `LedgerCard`

**Files:** `web/src/modules/admin/components/TransfersCard.tsx:38-58`, `:88-124`; `web/src/modules/admin/components/LedgerCard.tsx:44-63`, `:108-142`

**Issue:** The `failed`, `pastTheEnd` and `loading` rules, the `clampPage` effect, the result bar guard and the pager block are copied word for word. Waves 6, 8 and 9 each fixed one of these rules. The next fix must now land in two places, and a miss brings back a bug that was already fixed (for example "No transfers yet" flashing past the end).

**Fix:** Move the shared part into a hook, for example `usePagedListState(query, values, set)` that returns `{ failed, loading, pastTheEnd, total, pageCount }` and runs the clamp. Both cards then draw from it.

### IN-07: The ledger owner's `ActorRef` always says `formerStaff: false`

**File:** `web/src/modules/admin/services/moneyService.ts:395`

**Issue:** `toLedgerTransferTarget` builds the owner as `{ formerStaff: false }`, even on a deactivated or deleted person's page. The dialogs use only `.name` today. But `TransferTarget` looks complete, and a later `ActorName` on `from` or `to` would drop the former-staff mark for leavers. Hand-overs come from exactly those ledgers.

**Fix:** Pass the owner's standing from `StaffMoneyRoute` (`person.status !== 'active'`) into `owner`. Or type the owner part of the target as a name only, so nobody reads a flag that was never set.

---

_Reviewed: 2026-11-08T08:25:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

## Outcomes

| Finding | Outcome |
|---|---|
| WR-01 | Fixed (`bb94c64c`): the open delete follows the row version the list shows; a 409 waits for the refresh, so the next press sends the fresh version. Tests assert each request version; failed first, mutation failed. |
| WR-02 | Fixed (`7ed06e4c`): only the dialog own first balance read disables Delete; later reads keep the button enabled and focused. Two tests failed first; mutation failed both. |
| WR-03 | Fixed (`ae981dfc`): the late warning and the failed-check line carry `role="alert"`. Tests failed first; axe split into two cases. |
| IN-01 | Fixed (`71547122`): the busy 409 shows the same busy line as the Transfer window (P10-BL-11). Failed first; mutation failed. |
| IN-02 | Fixed (`14323f78`): a failed list read clears the pending focus move. Failed first; mutation failed. |
| IN-03 | Fixed (`ea67dce4`): a receiver missing from the staff balances gets no warning, so no placeholder name shows (P10-BL-07 A). Side effect parked in P10-BL-14. |
| IN-04 | Fixed (`8db70a20`): test renamed; the 2,000.00 boundary has its own test. |
| IN-05 | Fixed (`34a65bb6`): the e2e works out the exact focus target and checks it after the delete. |
| IN-06 | Deferred to the phase-end review (shared paging and loading logic of TransfersCard and LedgerCard). |
| IN-07 | Fixed (`14880b56`): the ledger target carries the owner former-staff state (deleted account), with no server change. Tests failed first; mutations failed. |

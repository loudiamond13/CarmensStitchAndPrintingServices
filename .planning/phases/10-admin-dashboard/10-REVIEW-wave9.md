---
phase: 10-admin-dashboard
wave: 9
plans: [10-18, 10-19]
created: 2026-11-08T03:57:00-06:00
updated: 2026-11-08T03:57:00-06:00
reviewed_range: 3630e04e..698bb0aa (excluding .planning/)
depth: deep
files_reviewed: 52
findings:
  critical: 0
  warning: 2
  info: 8
  total: 10
status: issues_found
---

# Phase 10 Wave 9 Code Review (plans 10-18 and 10-19)

*Created: 2026-11-08T03:57:00-06:00 · Updated: 2026-11-08T03:57:00-06:00*

## Summary

I reviewed the two delete routes (10-18: `DeleteMoneyTransferHandler`, `RemoveMoneyTransferHandler`, `MoneyAuditDetail`, `AuditChangeLines`, `IMoneyTransfers.FindAsync`, the controller, the matrix rows, the routes test, the docs and the contract). I also reviewed the Manager money screens (10-19: the Mine and All Staff tabs, `StaffBalancesTable`, `StaffMoneyRoute`, `requireOtherStaffLoader`, the hand-over mode of `TransferModal`, the owed-leaver cap, `moneySchemas`, `moneyService`, the new hooks, the Users page refresh and the e2e). I traced the handlers into `MoneyTransfer.SoftDelete` and `EnsureRemovable`, `ConflictRetry`, `RowVersions`, `MoneyTransferStore` and `HandOverMoneyHandler`. I traced the web parts into `useMoneyListParams`, `LedgerCard`, `useRefreshMoney`, `useBusinessToday`, `Modal`, `ErrorState`, the guid parser and the admin layout recipe.

What holds:

- **D-53 and the lock.** Neither the delete nor the remove takes the `staff-money` lock. Only `CreateMoneyTransferHandler` and `HandOverMoneyHandler` take `IStaffMoneyLock`. Nothing from the locked version is left: no lock parameter, no lock unit test, and no busy path other than the shared `ConflictRetry` fallback, which is still reachable when two saves lose twice. The docs say "A delete and a remove do not take the lock", and the audit-log table mentions the lock only for the hand-over. Two integration tests hold the lock row in another transaction and prove that a delete and a remove still answer 204. The SUMMARY records that both tests failed against the locked handlers.
- **Delete and remove.** The version is parsed before any lookup (400 under `version`). The handler then reads live rows only (404), compares the stored `RowVersion` (409 `edit.stale`), marks the row and records the audit entry, all in one save. A repeated or racing delete finds no live row on its retry, so it writes nothing more. The race test passes five times in a row. The remove reads deleted rows too, refuses a live one with 422, and writes the audit entry before the tracked `Remove` in the same save. Neither detail holds the note text, only `note=yes|no`. The remove detail carries every field D-25 lists. The integration tests show both balances moving back at once after a delete, a recipient left below zero (D-33), and no balance change after a remove. `StaffMoneyReader` is not touched, so the D-105 serializable ledger read is as it was.
- **Authorization.** Both actions carry `[Authorize(Policy = Policies.Manager)]` on top of the class Staff policy, and the matrix has rows for both (401, 403, 404). An Admin gets the same 403 body for a live transfer, a deleted transfer, an unknown id and a missing version, because the policy runs before the handler. The test scans those bodies for amounts, names and ids. There is no PUT, PATCH, restore or bulk route, and the exact route list is asserted.
- **Web authorization.** An Admin never asks for staff figures. The All Staff tab and the hand-over window exist only for a Manager. The staff balances query in the Transfer window is enabled only for a Manager. The person route's loader redirects an Admin before the page's queries can run (the routes test asserts zero person and ledger requests). The owed-leaver figure lives only in a schema option that an Admin is never given, and the Admin test checks the DOM for it.
- **Hand Over.** The To list keeps active people only (`pickHandoverRecipients`, wave 6 IN-03). The leaver is only ever the sender (`fromUserId` from the row). The cap is the leaver's figure from a fresh staff read, falling back to the row's figure. Each submission gets one Idempotency-Key through `useSubmission`. A save calls `useRefreshMoney`, which invalidates the whole `staff-money` root (All Staff, the person, the ledgers), the transfer lists and the dashboard.
- **Rules check.** No inline SQL (the test lock helper uses `ExecuteUpdateAsync`), no new package, no migration, no trigger. I scanned every added line of the diff for U+2012 to U+2015 and found none. The calls stay in `modules/admin/services`. Every new figure goes through `toFiniteFigure`, and a bad figure or status fails the whole answer. The table and the card follow the LoadingRegion pattern (`failed = isError && !isFetching`, pending only without data or after an error). The client messages match `MoneyRules.cs` word for word (`LeaverNothingOnHand`, `LeaverAboveBalance`, `OwedOnlyForManager`).
- **The Amount fix.** It works: the 0 ms `clearErrors('amount')` runs after the blur check's microtasks. The SUMMARY's mutation check and two tests prove it bites. IN-01 covers what is left.

**The iPhone scroll change in the 10-17 e2e (asked for).** The phone tab bar is a sticky bar at the **bottom** of the main column (`admin.recipe.ts:39-40`), not at the top. With the new tab strip, the page grows by about one row, so at scroll position 0 on the iPhone viewport the Show deleted box sits at the bottom edge, partly under the bar. axe's `target-size` rule counts the bar's links as covering the box. My judgment: this does not hide a layout failure that needs a layout fix. The overlap exists only at that one scroll position, and the person can scroll the box clear or tap its visible label. The real WCAG 2.2 AA risk is 2.4.11 Focus Not Obscured: a keyboard user's focus landing on the box while the bar covers it. The layout is meant to prevent that with the root's bottom scroll padding on phones (`admin.recipe.ts:15`, technique C43). But the test as changed proves nothing about that, and the 300 px scroll is a magic number. See WR-01.

No critical issue was found. Two warnings and eight info items follow.

## Critical

None.

## Warning

### WR-01: The iPhone axe fix scrolls a fixed 300 px instead of proving that a focused Show deleted clears the tab bar

**File:** `web/e2e/money.spec.ts:146-149`; layout `web/src/modules/admin/components/admin.recipe.ts:15`, `:39-40`

**Issue:** The test now runs `window.scrollBy(0, 300)` in all five projects before `expectNoAxeViolations`. The number fits today's iPhone viewport and today's content height. It does not follow the box, and it does not check what a phone user actually meets:

- 2.4.11 (AA) depends on the root's bottom scroll padding moving a focused control above the sticky bar. No test checks that on this page, and WebKit (the `iphone` project) is the engine where focus scrolling and `scroll-padding` have been least consistent.
- The scroll also moves the desktop and tablet projects, so their axe run no longer sees the page as it loads.
- If a later change removes or breaks the `scroll-pb` utility, or adds another row above the ledger, this test stays green while focus lands under the bar.

**Failure scenario:** Plan 10-20 adds the Transfers tab, or a banner, above the ledger, so Show deleted sits about 350 px lower. A refactor of `admin.recipe.ts` also drops the `vp-lt-md` scroll padding. On an iPhone, a keyboard or switch user tabs to Show deleted and the focus ring is hidden under the tab bar (a 2.4.11 failure). The e2e still scrolls 300 px, axe sees a clear box at that position, and the run passes.

**Fix:** Bring the box into view the way a person does, then assert it is clear before running axe:

```ts
await showDeleted.focus(); // focus scrolling honours the root scroll padding
const box = await showDeleted.boundingBox();
const bar = await page.locator('nav[data-ui="s-tabbar"]').boundingBox(); // or the tab bar's role or label
if (box !== null && bar !== null && (await page.locator('nav[data-ui="s-tabbar"]').isVisible())) {
  expect(box.y + box.height).toBeLessThanOrEqual(bar.y);
}
await expectNoAxeViolations(page);
```

If this assertion fails in WebKit, the layout does have a 2.4.11 gap and needs a layout fix (for example `scroll-margin-bottom` on form controls, or a JS `scrollIntoView` with the bar's height on focus). Do not keep the blind scroll.

### WR-02: A hand-over refused under `fromUserId` leaves All Staff offering Hand Over for a person who is no longer a leaver

**Files:** `web/src/modules/admin/components/TransferModal.tsx:53`, `:251-270`; `web/src/modules/admin/hooks/useTransferAction.ts` (`onFailure`); server `src/Csps.Domain/Money/MoneyTransfer.cs:152-155`

**Issue:** `FIELD_ORDER` has no `fromUserId`. When the server refuses a hand-over because the sender is active again ("Only money held by former staff can be handed over.", field `fromUserId`), `showFailure` finds no known field. It shows the text as a banner and re-reads nothing. `useTransferAction` re-reads money only after a 5xx, a 408 or no answer. So the staff balances stay as they were: the row still says Deactivated and still has Hand Over. The other refusals already re-read what they depend on (Amount re-reads the staff balances, To re-reads the people). This one is the only refusal whose cause is a roster change, and nothing follows it.

**Failure scenario:** Carmen opens Hand Over for Jomar (deactivated, holds ₱2,000.00). Meanwhile another Manager activates Jomar on the Users page. Carmen presses Record Handover and gets the banner. She closes the window. All Staff still shows Jomar as Deactivated with a Hand Over button, and every new try gives the same banner until she leaves the tab and comes back.

**Fix:** Treat a `fromUserId` refusal as a reason to re-read the staff balances, and show it where the person looks:

```ts
const sender = serverFieldMessage(error.fieldErrors, 'fromUserId');
if (sender !== undefined) {
  onRefreshBalance(); // the staff read in hand-over mode; All Staff follows (same key)
  setBanner({ kind: 'message', text: sender });
  return;
}
```

Add a TransferModal test: a 400 under `fromUserId` shows the banner and makes a second `GET /staff-money` request.

## Info

### IN-01: The Amount fix works around the first focus landing on Amount instead of removing the cause

**File:** `web/src/modules/admin/components/TransferModal.tsx:285-300`

**Issue:** The window first puts the cursor on Amount, because To is `disabled` while the people load. The fix moves the cursor to To and clears the Amount error on a 0 ms timer. It is correct today because the blur check only uses microtasks, but it depends on that order. The timer is never cleared if the window unmounts first. On a pristine form it also clears an Amount error the person caused themselves, for example by tabbing through Amount before the list arrived.

**Fix:** Keep To focusable while it loads (`aria-disabled` plus read-only behaviour, as the Transfer button does), or give the Modal an initial focus target of To. The first focus then never touches Amount, and the timer can go. If the timer stays, clear it in an effect cleanup.

### IN-02: `toTransferRecipients` is now used only by tests

**File:** `web/src/modules/admin/services/moneyService.ts:183-186`

**Issue:** The recipients query now stores `toTransferPeople`, and both windows pick their lists with `pickTransferRecipients` or `pickHandoverRecipients`. No production code calls `toTransferRecipients`. Its tests (`moneyService.test.ts:230-250`, `:318`) keep a dead path alive.

**Fix:** Remove it and point its tests at `pickTransferRecipients(toTransferPeople(...))`.

### IN-03: The person page calls `useStaffMoneyParams` only for its side effect

**Files:** `web/src/modules/admin/pages/StaffMoneyPage.tsx:48`; `web/src/modules/admin/hooks/useStaffMoneyParams.ts:10-28`

**Issue:** `StaffMoneyRoute` throws away the hook's return value. `LedgerCard` reads `useMoneyListParams` itself. So the hook's tested return value (`page`, `size`, `deleted`) is used by no screen, and only the stray `tab` drop matters. A reader expects the page to drive the ledger from this hook.

**Fix:** Rename it to what it does (for example `useDropStrayTab`) and return nothing. Or pass its values into `LedgerCard` so the hook really owns the person page's URL.

### IN-04: The person page's not-found state has no heading at all, and a test locks that in

**Files:** `web/src/modules/admin/pages/StaffMoneyPage.tsx:58-67`; `web/src/modules/admin/pages/StaffMoneyPage.test.tsx:209-218`

**Issue:** `ErrorState` draws its title as `<strong>`, so "This person wasn't found." is the only text on the page, with no h1. A screen reader user who jumps by heading finds nothing in `main`. The test asserts `queryByRole('heading', { level: 1 })` is null, which makes a later fix look like a regression. The SUMMARY lists the missing h1 only for the loading and failed states, not for not-found.

**Fix:** Render the not-found title as the page h1 (the same words), and change the test to expect it. Add this case to the P10-BL-07 owner list next to the loading-state h1.

### IN-05: Adding or editing a user does not mark the staff money answers old, while deactivating does

**File:** `web/src/modules/admin/pages/UsersPage.tsx:230-255`, `:380-382`

**Issue:** `refreshRoster` runs after deactivate, activate and delete. `created` and `saved` (name and role changes) still invalidate only `usersKey`. All Staff shows names and roles, the person page shows the role badge, and the To lists show names. Each money query refetches on mount, so the effect is only a brief flash of the cached old name or role, not a lasting error. But the D-43 reasoning in the comment applies to these two actions as well.

**Fix:** Call `refreshRoster()` from `created` and `saved`, and extend the UsersPage test to cover an edit.

### IN-06: The permanent-remove record does not say the transfer was a hand-over

**File:** `src/Csps.Application/Money/MoneyAuditDetail.cs:247-259`

**Issue:** `Facts` writes from, to, amount, date, note and recordedBy. That matches the D-25 list exactly. But `IsHandover` is not written. Once the row is gone, a removed hand-over's `money-transfer.permanently-deleted` entry reads like an ordinary transfer that a former staff member sent. Only the separate `money-transfer.handed-over` entry, matched by target id, tells the difference.

**Fix:** Ask the owner whether the full record should include `handover=yes|no`. If so, add it to `Facts`, to `ReadTransfer` and to the audit-log doc. Otherwise record that the hand-over entry is the source.

### IN-07: The DELETE table row in the API doc leaves out the busy 409

**File:** `docs/api/staff-money.md:353`

**Issue:** The row lists 409 only for a stale version. The controller documents a second 409 (`money-transfers.busy`, when two saves lose twice), and the remove row lists it. An Android client that reads only the table cannot tell the two 409 codes apart.

**Fix:** Add "or when two saves lost a race twice (`money-transfers.busy`)" to the delete row.

### IN-08: The 320 px checks for the new screens are still unproven

**Files:** `web/src/modules/admin/pages/MoneyPage.tsx:230-245`; `web/src/modules/admin/components/StaffBalancesTable.tsx`; `web/src/modules/admin/pages/StaffMoneyPage.tsx:69-99`

**Issue:** The plan's UI list asks that the tab strip scroll sideways at 320 px while the page never does. The SUMMARY records this as a known gap (D8, human judgment, plan 10-21). The new e2e runs on the 390 px iPhone, not at 320 px, so nothing measures the All Staff row cards, the person header with two badges, or the Hand Over button's 44 px area at the narrowest width.

**Fix:** Keep it on the 10-21 sweep. When that runs, add one e2e at 320 px for `/admin/money?tab=staff` and `/admin/money/staff/:id` that checks `document.documentElement.scrollWidth <= innerWidth`.

---

_Reviewed: 2026-11-08T03:57:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---
phase: 10-admin-dashboard
plan: 20
subsystem: ui
tags: [react, money, transfers, delete, confirm-dialog, audit-log, tanstack-query, nuqs, vitest, playwright, tdd]
created: "2026-11-08T08:15:00-06:00"
updated: "2026-11-08T08:15:00-06:00"

requires:
  - phase: 10-admin-dashboard
    provides: DELETE /api/v1/money-transfers/{id}?version=, DELETE .../{id}/permanent, GET /api/v1/money-transfers and the generated types (10-16, 10-18)
  - phase: 10-admin-dashboard
    provides: MoneyPage tabs, StaffBalancesTable, useStaffBalancesQuery, useMoneyListParams, LedgerCard, useRefreshMoney, moneyFixtures, e2e/money.spec.ts (10-13 to 10-19)
provides:
  - "Transfers tab on My Money (Manager only, ?tab=transfers opens it): TransfersCard and TransfersTable with Date, From, To, Amount, Note, Recorded by and Actions, server paging, result bar and the loading, empty and error states"
  - "DeleteTransferDialog: the simple confirm, the version in the query string, the labelled resulting-balance warning, 409 and 404 handling"
  - "RemoveTransferDialog: the stronger confirm with the danger details box, Remove Permanently, 404 handling"
  - "Show deleted on the Transfers tab (deleted=true in the URL), deleted rows with the Deleted badge, a struck muted amount and a Deleted by line"
  - "Delete and Remove on ledger transfer rows (My Money and one person's page) for a Manager; an Admin has no Actions column"
  - "moneyService.transfers, deleteTransfer, removeTransfer, parseTransferPage, toTransferTarget, toLedgerTransferTarget; useTransfersQuery, transfersKey, useTransferDeletion, useTransferRowActions, TransferActionDialogs"
  - "auditCopy: group Staff money and the labels for money-transfer.deleted, money-transfer.permanently-deleted and money-transfer.handed-over"
affects: [10-21 dashboard sweep and screenshot review, phase-end security review and code review]

actuals:
  tokens: 35000
  tasks: 3
  commits: 6

plan_head_before: 6b8322f136e4da80662cc77cc85cf84c40cb2493
plan_head_after: 0e2811c7d82aa122325b7b2ca7966aa2039c2cdc

tech-stack:
  added: []
  patterns:
    - "One host for the Manager's transfer row actions: useTransferRowActions holds which confirm is open and the focus rule; the card draws TransferActionDialogs outside the table (a table's paint containment would trap a dialog)"
    - "The focus rule waits for fresh data: after a delete the row must be gone or shown as deleted, after a remove it must be gone; then focus goes to the next row's action, else the previous, else the caption, else the card heading"
    - "A 404 on a delete or remove is a result, not a failure: info toast, lists read again, dialog closes like a success"
    - "The one piece of client arithmetic is a labelled preview built from staff balances read fresh when the dialog opens; the read is distrusted while it runs (skeleton, confirm off)"

key-files:
  created:
    - web/src/modules/admin/components/TransfersTable.tsx
    - web/src/modules/admin/components/TransfersTable.test.tsx
    - web/src/modules/admin/components/TransfersCard.tsx
    - web/src/modules/admin/components/TransfersCard.test.tsx
    - web/src/modules/admin/components/DeleteTransferDialog.tsx
    - web/src/modules/admin/components/DeleteTransferDialog.test.tsx
    - web/src/modules/admin/components/RemoveTransferDialog.tsx
    - web/src/modules/admin/components/RemoveTransferDialog.test.tsx
    - web/src/modules/admin/components/TransferActionDialogs.tsx
    - web/src/modules/admin/hooks/useTransfersQuery.ts
    - web/src/modules/admin/hooks/useTransferDeletion.ts
    - web/src/modules/admin/hooks/useTransferRowActions.ts
  modified:
    - web/src/modules/admin/pages/MoneyPage.tsx
    - web/src/modules/admin/pages/MoneyPage.test.tsx
    - web/src/modules/admin/pages/StaffMoneyPage.tsx
    - web/src/modules/admin/pages/StaffMoneyPage.test.tsx
    - web/src/modules/admin/pages/AuditLogPage.test.tsx
    - web/src/modules/admin/components/LedgerTable.tsx
    - web/src/modules/admin/components/LedgerTable.test.tsx
    - web/src/modules/admin/components/LedgerCard.tsx
    - web/src/modules/admin/components/LedgerCard.test.tsx
    - web/src/modules/admin/components/money.recipe.ts
    - web/src/modules/admin/services/moneyService.ts
    - web/src/modules/admin/services/moneyService.test.ts
    - web/src/modules/admin/moneyCopy.ts
    - web/src/modules/admin/auditCopy.ts
    - web/src/modules/admin/auditCopy.test.ts
    - web/src/test/moneyFixtures.ts
    - web/e2e/money.spec.ts

key-decisions:
  - "The 409 line on a delete is the approved copy constant ('This was changed by someone else. Reload and try again.'), not the server's text. The server's edit.stale line is the same words, and the project rule is that server text never reaches the screen"
  - "A dialog lives in the card, outside the table, and a hook (useTransferRowActions) holds the open dialog and the focus rule, so the Transfers card and the ledger card share one behaviour"
  - "When the last row of the Transfers list is deleted the list has no caption to focus, so focus goes to the card heading (the h2 takes tabIndex -1)"
  - "A receiver the staff balances list leaves out (a leaver at 0.00) counts as holding 0.00 in the warning"
  - "The Transfers card draws nothing for a non-Manager and asks for nothing, as defence in depth behind the tab being absent for an Admin"

patterns-established:
  - "The ledger's Actions column is added only for a Manager who knows the ledger owner; the names say both people on the transfer"

requirements-completed: [MONEY-03, MONEY-06, MONEY-07]

coverage:
  - id: D1
    description: "A Manager's My Money has a third tab 'Transfers' kept in ?tab=; a link with ?tab=transfers opens it (P10-BL-12). The card has the head 'Transfers' with 'Every transfer between staff, newest first.', a table captioned 'Transfers' (Date, From, To, Amount, Note, Recorded by, Actions), 'Showing {n} transfers · newest first', paging with Rows per page, 'Loading transfers…', 'Couldn't load transfers.' with Try Again and 'No transfers yet' with no button"
    requirement: MONEY-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/TransfersCard.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/TransfersTable.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/MoneyPage.test.tsx#the Manager tabs Mine and All Staff (D-42, MONEY-03; plan 10-19)"
        status: pass
      - kind: e2e
        ref: "web/e2e/money.spec.ts#@money a Manager deletes a wrong transfer from the Transfers tab and both balances correct themselves (D-29, D-35, D-48)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Delete Transfer confirm: 'Delete this transfer?' with the amount, both people and the date, Cancel focused first, no reason box, the row's version sent URL-encoded, 'Deleting' while it runs, toast 'Transfer deleted' / 'It no longer counts toward any balance.', and the transfers, ledger, my money, staff balances and dashboard answers read again; focus moves to the next row's action, else the previous, else the caption or heading"
    requirement: MONEY-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/DeleteTransferDialog.test.tsx#Delete Transfer (D-23)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/TransfersCard.test.tsx#deleting from the list (D-29, D-35; plan 10-20)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/services/moneyService.test.ts#moneyService.deleteTransfer (MONEY-06, D-23; plan 10-20)"
        status: pass
      - kind: e2e
        ref: "web/e2e/money.spec.ts#@money a Manager deletes a wrong transfer ... (five browsers; both balances return)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The resulting-balance warning: the receiver's balance (staff balances read fresh when the dialog opens) minus the amount, '{name}'s balance will be {−₱500.00}.' only when below zero; a skeleton and a disabled confirm while the read runs; 'Couldn't check the new balances. The delete still works.' with the confirm enabled when the read fails"
    requirement: MONEY-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/DeleteTransferDialog.test.tsx#the resulting-balance warning (D-33, T-10-44)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A 409 keeps the delete dialog open with a role=alert line and reads the lists again; a 404 on a delete closes it with the info toast 'Already deleted' and reads the lists again"
    requirement: MONEY-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/DeleteTransferDialog.test.tsx#a stale or missing transfer (SEC-07)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Delete on each counted ledger transfer row and Remove on each deleted one, named by the row ('Delete transfer of ₱2,000.00 from Carmen Reyes to Liza Mercado, Nov 2, 2026'), with a matching title, on My Money and on one person's page; payment, refund and expense rows have no action; an Admin's ledger has no Actions column"
    requirement: MONEY-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/LedgerTable.test.tsx#the Manager row actions (plan 10-20)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/LedgerCard.test.tsx#the Manager row actions on transfers (plan 10-20)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/StaffMoneyPage.test.tsx#names the person on the Manager's Delete action of a transfer row (plan 10-20)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Show deleted on the Transfers tab (deleted=true, replace, page reset); deleted rows show the Deleted badge after the date, a struck muted amount, 'Deleted by {name} · {date and time}' under the note and a Remove action; Remove Permanently opens 'Permanently remove this transfer?' with 'This can't be undone.', the danger details box, Cancel first, 'Removing' while it runs, toast 'Transfer removed for good' / 'Balances didn't change.', 404 closes with 'Already removed'; no restore, edit or bulk action exists anywhere"
    requirement: MONEY-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/RemoveTransferDialog.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/TransfersTable.test.tsx#a deleted transfer (D-30, D-31, D-24)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/TransfersCard.test.tsx#Show deleted (D-30, D-31)"
        status: pass
      - kind: e2e
        ref: "web/e2e/money.spec.ts#@money a Manager deletes a wrong transfer ... (Show deleted, then Remove Permanently; five browsers)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The audit log screen labels money-transfer.deleted 'Money transfer deleted', money-transfer.permanently-deleted 'Money transfer removed permanently' and money-transfer.handed-over 'Money handed over' in the new group 'Staff money'; the code list mirrors the API's 100 codes"
    requirement: MONEY-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/auditCopy.test.ts#reads the three money events in plain words under Staff money (AUDIT-01, MONEY-06; plan 10-20)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/AuditLogPage.test.tsx#A1 the Group select (D-80)"
        status: pass
    human_judgment: false
  - id: D8
    description: "An Admin never sees the Transfers tab, deleted transfers, Show deleted or any delete or remove action, and the browser never asks for them: the tab is absent, the card draws nothing and sends no request, and the ledger has no Actions column"
    requirement: MONEY-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/MoneyPage.test.tsx#shows an Admin no Transfers tab, asks for no transfer list and holds no transfer in the DOM (D-31, D-32, T-10-45)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/TransfersCard.test.tsx#an Admin (D-31, D-32, T-10-45)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/LedgerCard.test.tsx#gives an Admin no Actions column and no button, even on transfer rows (D-31, D-32, T-10-45)"
        status: pass
    human_judgment: false
  - id: D9
    description: "How the Transfers table, the two dialogs (warning block, danger details box) and the deleted rows look on phones (row cards), at 320 px (the tab strip now holds three tabs) and in Espresso; no screenshot review was done here"
    verification: []
    human_judgment: true
    rationale: "jsdom draws no layout. The look belongs to the plan 10-21 screenshot review. The 320 px tab strip with three tabs has only the Tabs component's own tests; no e2e measures it for My Money"

duration: about 100 min (start time not recorded; estimated from the first test run at 07:12 local)
completed: 2026-11-08
status: complete
---

# Phase 10 Plan 20: A Manager reviews every transfer, deletes a wrong one, and removes a deleted one for good

*Created: 2026-11-08T08:15:00-06:00 · Updated: 2026-11-08T08:15:00-06:00*

**A Manager now has a Transfers tab listing every transfer between staff, a simple Delete Transfer confirm that warns when the receiver would go below zero, a stronger Remove Permanently confirm for deleted transfers, the same two actions on ledger transfer rows, and audit log labels for every money event; an Admin gets none of it and the browser never asks for it.**

## Performance

- **Duration:** about 100 min (the start time was not recorded; estimated)
- **Tasks:** 3 (Task 1 was a tracer), all TDD; 6 task commits before this SUMMARY
- **Files:** 29 touched by the task commits (12 created, 17 modified; includes test files)

## Accomplishments

- **Tracer (Task 1).** `moneyService.transfers` and `deleteTransfer`, `parseTransferPage` (a bad amount or total refuses the whole answer), `useTransfersQuery`, `TransfersTable`, `TransfersCard`, `DeleteTransferDialog`, the third tab on `MoneyPage`, and an e2e that records a transfer, deletes it from the tab and checks both balances come back. The tracer `<verify>` is automated only, so it was re-run end to end after the GREEN commit (`Tests 140 passed (140)` for the five unit files, then `20 passed (3.1m)` for `money.spec.ts` in five browsers) and expansion went ahead: `Tracer verified end-to-end, expanding`.
- **The warning and the missing-transfer cases (Task 2).** The dialog reads the staff balances fresh each time it opens and shows the labelled preview only when the result is below zero. While the read runs the confirm is off and a skeleton shows. A 409 keeps the dialog with the approved line; a 404 closes it with the info toast. The ledger got an Actions column for a Manager, so the same two confirms work from My Money and from one person's page.
- **Show deleted, Remove Permanently and the audit labels (Task 3).** Deleted rows look as the ledger's deleted rows do. The remove dialog has the danger details box. `auditCopy` has the group `Staff money` and the three labels, and its code list now mirrors the API's 100 codes.

## Task Commits

1. **Task 1 (tracer): Transfers tab and Delete Transfer** - RED `26640dc5` (test), GREEN `736e6508` (feat)
2. **Task 2: warning, 409 and 404, ledger row actions** - RED `ca7fd048` (test), GREEN `8b975277` (feat)
3. **Task 3: Show deleted, Remove Permanently, audit labels** - RED `3ce8883b` (test), GREEN `0e2811c7` (feat)

**Plan metadata:** the SUMMARY commit that follows this file. `commits: 6` was measured with `git rev-list --count 6b8322f1..HEAD` before it.

## TDD Gate Compliance

`gsd_run check tdd-red-evidence` was not run: Vitest's default reporter is not a format that classifier reads (same as plans 10-02 to 10-19), so each RED was inspected by hand. `git log -E --grep` shows `test(10-20)` before `feat(10-20)` in all three cycles. The e2e was written after the unit-level GREEN of each task (the server routes were built in 10-16 and 10-18), so it has no RED run.

**Cycle 1, Task 1.** RED `26640dc5`: `Test Files 5 failed (5)`, `Tests 56 failed | 84 passed (140)` over `TransfersTable`, `TransfersCard`, `DeleteTransferDialog`, `moneyService` and `MoneyPage` tests. Failures: no table named 'Transfers' (the stub draws nothing), `parseTransferPage` returning an empty page where amounts or a refusal were expected, `transfers` and `deleteTransfer` rejecting with a stub error, no dialog, no third tab. Semantic assessment: the target tests ran and failed on the planned behavior. Passed at RED on purpose: the Admin test (no Transfers tab, no list request) and the existing My Money tests. GREEN: `Tests 140 passed (140)`. Four RED test files were corrected in the GREEN commit (not weakened): the loading announcement is 'Transfers loaded.', two rows needed different ids, a request with no body records `null`, and an `any` lint error.

**Cycle 2, Task 2.** RED `ca7fd048`: `Test Files 3 failed (3)`, `Tests 20 failed | 66 passed (86)`. Failures: no warning block, no skeleton, no check-failed line, the 409 line was the mapper's 'Someone else changed this', no 'Already deleted' toast, no Actions column on the ledger. Semantic assessment: real failures on the planned behavior. Passed at RED on purpose: the cases that show no warning (3,000.00 held, exactly 2,000.00 held), the corrected retry after a 409, and the Admin tests (no Actions column). GREEN: `Test Files 150 passed (150)`, `Tests 3354 passed (3354)` over `src/modules/admin/components`, `pages`, `hooks`, `services`, `routes.test.tsx`, `no-long-dash`, `source-layout` and `tailwind-classes`. Mutation check: replacing the warning test `isNegativeMoney(after)` with `after <= 0` made 'shows no warning when the balance lands exactly on zero' fail (`Tests 1 failed | 21 passed (22)`); restored.

**Cycle 3, Task 3.** RED `3ce8883b`: `Test Files 5 failed (5)`, `Tests 32 failed | 139 passed (171)`. Failures: no Remove dialog (15 tests), no Deleted badge, strike or Deleted by line, no Show deleted checkbox, no Remove action, the audit code list at 97 and seven groups. Semantic assessment: real failures on the planned behavior. GREEN: all pass. Two checks after GREEN: an Admin test for the Transfers card was added (draws nothing, no request) and a mutation that removed its guard made it fail; a mutation that made a delete settle only when the row left the list failed 'keeps a counted transfer in the list as a deleted row after a delete, and focus goes to the next row'. Both restored. No `refactor` commit was needed.

## Files Created/Modified

See the `key-files` block. Every string is in `web/src/modules/admin/moneyCopy.ts` (`MONEY_COPY.page.tabs.transfers`, `transfers`, `deleteTransfer`, `removeTransfer`) and `auditCopy.ts`; the looks are in `money.recipe.ts`.

## Decisions Made

See `key-decisions`. The two that matter most: the 409 line is the approved copy constant, and the dialogs live in the card outside the table, driven by one shared hook.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The Transfers card draws nothing for a non-Manager**
- **Found during:** Task 3 (T-10-45 check)
- **Issue:** The tab is absent for an Admin, but the card itself would have drawn the empty state ('No transfers yet') if ever mounted for one.
- **Fix:** The card returns null for a non-Manager (its query was already disabled). A test proves it and a mutation proves the test bites.
- **Files modified:** `TransfersCard.tsx`, `TransfersCard.test.tsx`
- **Committed in:** `0e2811c7`

**2. [Rule 3 - Blocking] Files outside the plan's list**
- **Issue:** The plan does not list: `TransferActionDialogs.tsx` and `useTransferRowActions.ts` (the shared host for the two confirms and the focus rule, used by both cards), `money.recipe.ts` (the warning, details box and deleted-row classes), `StaffMoneyPage.tsx` and its test (it passes the person's name to the ledger so row actions can name both people), `AuditLogPage.test.tsx` (the Group select now lists eight groups), `LedgerCard.test.tsx`, and `StaffMoneyPage.test.tsx`.
- **Committed in:** `8b975277`, `0e2811c7`

**3. [Test amendment] Existing tests adapted to the new behavior**
- `MoneyPage.test.tsx`: the Manager tab list is now Mine, All Staff, Transfers.
- `LedgerCard.test.tsx`: 'offers a Manager no edit action' now allows exactly the Delete and Remove names and still bans edit and restore.
- `StaffMoneyPage.test.tsx`: 'no Transfer and no Hand Over button' now anchors its name pattern so the row action 'Delete transfer of ...' does not match it.
- `auditCopy.test.ts` and `AuditLogPage.test.tsx`: 97 codes became 100 and seven groups became eight.
- No assertion was weakened.

**4. [Plan staging] Compile-only stubs in the RED commits**
- Each RED commit holds only the smallest stubs (empty components, a parse that returns an empty page, calls that reject, props that are ignored). GREEN replaced all of them (`grep "compile-only stub" web/src` finds nothing).

**5. [Plan wording] The 409 line**
- The plan says a 409 shows the line 'This was changed by someone else. Reload and try again.' The orchestrator note says to show the server's line. The server's `edit.stale` text is the same words, and the project rule is that server text never reaches the screen, so the dialog uses the approved copy constant. A test covers both a 409 with a detail and one without.

**6. [Dispatch] Worktree instead of the main checkout**
- The plan's executor rules say to work in the main checkout on `gsd/phase-10-admin-dashboard`. This run was dispatched into a worktree on `worktree-agent-ad25b4a4f9790b49b`; no push, no merge, no STATE.md or ROADMAP.md edit. `web/node_modules` and `tools/openapi-gen/node_modules` were linked to the main checkout's copies and the links removed at the end. The plan-head ledger file in the shared git folder was not written (the worktree shell refuses compound commands), so `plan_head_before` is the dispatch base hash and `commits:` was measured from it.

---

**Total deviations:** 6 (1 missing critical, 1 files outside the plan, 1 test amendment group, 1 plan staging, 1 wording, 1 dispatch).
**Impact on plan:** None changes behavior the plan defined.

## Issues Encountered

- **Shell.** The worktree shell refused heredocs and some compound commands, so files were written with the file tools and short `node -e` edits. Two edits lost a template literal to the shell and were repaired by hand before any test ran.
- **Flake.** `routes.test.tsx` 'with the dev routes added, /dev/public shows the real public layout ...' failed once in the large run (`Test Files 1 failed | 226 passed (227)`, `Tests 1 failed | 5671 passed (5672)`) and passed alone (`Tests 60 passed (60)`). It is a load flake on a test this plan did not touch.
- **Parked items left alone.** P10-BL-04 (failed background refresh), P10-BL-05 (WebKit access control checks), P10-BL-06 (KPI layout at 320 px; the dashboard was not touched and the money e2e passes), P10-BL-07 (the hand-over 'Done to' column in the audit log stays as the server gives it), P10-BL-12 (the tab opening bug is fixed here for `?tab=transfers`; the rest of that item is unchanged) and P10-BL-13 (the audit record of a removed hand-over is unchanged). The e2e guard was not weakened.
- **Known gap.** The 320 px check of the three-tab strip has a unit-level guarantee only (the Tabs component's own tests). It belongs to the 10-21 sweep.
- **Coverage figures.** Branch and statement figures below 100% in the new files are the React Compiler's generated cache checks, as in 10-17 and 10-19. The e2e ran against the build made just before the Admin guard in `TransfersCard` was added; that guard does not change what a Manager sees and has its own unit test.

## Known Stubs

None. The RED stubs were all replaced in GREEN.

## Owner review: new wording and choices (P10-BL-07)

Every owner-facing sentence is spelled out in the plan or the UI-SPEC except these:

- **Screen reader label for the delete dialog's skeleton:** 'Loading staff balances…' (the All Staff loading line, reused). The UI-SPEC names no label.
- **'Show deleted' on the Transfers tab shares the `deleted` setting in the URL with the Mine ledger.** Switching tabs with it on keeps it on. Say if each tab should have its own.
- **Result bar with Show deleted on:** the Transfers tab keeps 'Showing {n} transfers · newest first' (the UI-SPEC gives a variant for the ledger only).
- **Empty list after the last transfer is deleted:** focus goes to the card heading 'Transfers', because an empty list has no table caption.
- **A refused permanent remove (409 busy or 422) shows the standard error line,** not a special sentence.
- **A hand-over row on the Transfers tab** is not marked as a hand-over. 'Recorded by' shows the Manager, as it does for any transfer.
- **Open from earlier waves, not changed:** whether the audit screen should show when a transfer was deleted for a remove entry (plan 10-18 note), P10-BL-07 (the hand-over 'Done to' column stays empty) and P10-BL-13.

## Threat Flags

None beyond the plan's threat model.

- T-10-44 mitigated: the warning is built only from staff balances read fresh when the dialog opens, is labelled as what will happen, and the server's figures win after the delete (the money answers are read again). T-10-45 mitigated: the tab, Show deleted, the card, the Actions column and every delete or remove button render only for a Manager; component tests assert the Admin view for the page, the card and the ledger; the API refuses anyway (403). T-10-SC: no package added or bumped.
- Prohibitions hold: no edit, restore or bulk action exists (tests assert no button or checkbox of that kind on the table, the card or the ledger), and nothing tells an Admin a transfer was deleted.

## User Setup Required

None - no external service configuration required.

## Verification Results

All from this worktree, final code unless noted.

- `npm --prefix web run typecheck`: exit 0, no output. `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output. `prettier --check` on `src/modules/admin` and `src/test`: all formatted.
- Task 1 verify (unit): `TransfersTable`, `TransfersCard`, `DeleteTransferDialog`, `moneyService`, `MoneyPage` tests at the tracer: `Test Files 5 passed (5)`, `Tests 140 passed (140)`.
- Wider runs: `src/modules/admin/components`, `pages`, `hooks`, `services`, `routes.test.tsx`, `no-long-dash.node.test.ts`, `source-layout.node.test.ts`, `tailwind-classes.test.ts` after Task 2: `Test Files 150 passed (150)`, `Tests 3354 passed (3354)`. After Task 3, `src/modules/admin`, `src/components` and the three guard files: `Test Files 226 passed | 1 failed (227)`, `Tests 5671 passed | 1 failed (5672)` (the `routes.test.tsx` flake above, which passed alone).
- Plan e2e (`npm --prefix web run e2e -- e2e/money.spec.ts --workers=1 --reporter=line`; `@money` is only in this file): at the tracer `20 passed (3.1m)`; after Task 3 `20 passed (3.4m)`. That is the 10-15 transfer test, the 10-17 ledger Back test, the new delete-then-remove test and the 10-19 hand-over test, each in chromium, firefox, webkit, pixel and iphone. Ports 5180, 5115, 7028 and 5199 had no listener before each run.
- Coverage (v8, this plan's eight unit test files, new and changed files): lines 100% for `TransfersTable.tsx`, `TransfersCard.tsx`, `DeleteTransferDialog.tsx`, `RemoveTransferDialog.tsx`, `LedgerTable.tsx`, `LedgerCard.tsx`, `useTransfersQuery`, `useTransferDeletion`, `useTransferRowActions` and `moneyService.ts`; statements 90 to 100%; branches 81 to 98% (compiler cache checks). The suite-wide gate is the orchestrator's.
- Axe: zero violations in jsdom for the table (counted and deleted rows), the card (loaded and error), the Transfers tab page, the Delete dialog with the warning shown, and the Remove dialog; zero on the page and on both open dialogs in the e2e in five browsers (target-size included).
- gitleaks (`gitleaks git --pre-commit --staged`, run by the pre-commit hook): no leaks found on each of the 6 commits. Fixtures and the e2e use made-up people (Carmen Reyes, Liza Mercado, Paolo Garcia; fresh `Sela Wrong`, `Rina Recv` with a random token).
- Acceptance greps: `Delete this transfer?` in `moneyCopy.ts` 1, `params: { version` in `moneyService.ts` 1, `Every transfer between staff, newest first.` 1, `Couldn't check the new balances. The delete still works.` 1, `Permanently remove this transfer?` 1, `Staff money` in `auditCopy.ts` 1, `money-transfer.handed-over` 1, `restore` outside comments in `moneyCopy.ts` 0; `DeleteTransferDialog.test.tsx` has tests named with 'warning', '409' and '404'. No em or en dash and no `style` attribute in any file this plan added or changed.
- Not run: the full Vitest and Playwright suites, parity and Lighthouse (the orchestrator's gate). `web/src/types/api.generated.ts` and `tools/openapi-gen/openapi.v1.json` were not touched.

## Next Phase Readiness

Plan 10-21 owns the screenshot review: the Transfers table on phones and at 320 px with three tabs, the warning block and the danger details box in Blush and Espresso, and deleted rows. The audit log now knows every money event the server writes.

## Self-Check: PASSED

- FOUND: all 12 files in `key-files.created` exist on disk.
- FOUND: commits `26640dc5`, `736e6508`, `ca7fd048`, `8b975277`, `3ce8883b`, `0e2811c7` on this branch; `git rev-list --count 6b8322f1..HEAD` = 6 before this SUMMARY commit.
- STATE.md and ROADMAP.md were not modified. `web/src/types/api.generated.ts` and `tools/openapi-gen/openapi.v1.json` were not touched.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-08*

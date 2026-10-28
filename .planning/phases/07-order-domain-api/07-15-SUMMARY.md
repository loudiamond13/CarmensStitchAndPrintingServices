---
phase: 07-order-domain-api
plan: 15
subsystem: api
tags: [orders, soft-delete, restore, permanent-delete, deleted-list, audit, privacy, race, openapi]
created: "2026-10-28T17:45:00-05:00"
updated: "2026-10-28T17:45:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-05 the soft-delete pair and the named SoftDelete filter on the order and every child, 07-09 IOrders.LockAsync and the row-version re-read in OrderStore.FindAsync, 07-13 the status routes, 07-14 OrderRefunds and the refunder ids"
provides:
  - "DELETE /api/v1/orders/{id} (Staff, no version): soft-deletes the order, answers 204; afterwards GET, PUT, the status route and every item, discount, payment, expense and refund route answer 404 orders.not-found, and every child leaves every default query while the rows stay"
  - "GET /api/v1/orders/deleted (Manager, page and pageSize 1 to 100, default 20): newest deleted first with id, number, customerName, teamName, status, total, paid, balance, deletedAt, deletedBy; two SQL commands whatever the page size; an Admin gets 403"
  - "POST /api/v1/orders/{id}/restore (Manager, Idempotency-Key): 204, everything comes back with the same figures; an order that is not deleted is 404 and writes nothing"
  - "DELETE /api/v1/orders/{id}/permanent?confirm= (Manager): one tracked remove of the order and every child row in one transaction; confirm must equal the number exactly (400 on confirm, nothing removed); unknown id is 404 before the confirm check"
  - "order.deleted and order.restored (number, status, total, paid, balance) and order.permanently-deleted (number, status, subtotal, discount, total, paid, refunded, balance, expenses, receivers, payers, refunders as user ids), all in the same save as the change, never customer details or notes"
  - "Order.SoftDelete and Order.Restore; IOrders.Remove; IOrderReader.ListDeletedAsync; OrderAuditDetail.Deleted, Restored and PermanentlyDeleted; OrderErrors.ConfirmMismatch; DeleteOrderHandler, RestoreOrderHandler, PermanentlyDeleteOrderHandler, ListDeletedOrdersHandler (+ request, validator, response)"
  - "Delete section in docs/api/orders.md (who may do what, the confirm, what the audit keeps, image cleanup joins in Phase 9), routes table rows, audit paragraph; docs/operations/audit-log.md note on the cut lists; refreshed OpenAPI contract and generated types"
affects: [07-16, 07-17, 07-18, 07-19, 07-20]

actuals:
  tokens: 27000
  tasks: 3
  commits: 6
plan_head_before: dc6ad4c3d0e1ab279c257c2f1c4f1e07d283f0c5
plan_head_after: 40a762a1656ee691643e5ea785d3836f0ba9f8be

tech-stack:
  added: []
  patterns:
    - "Delete runs lock, audit, save inside ConflictRetry with no version, so it always acts on the latest state; restore and permanent delete find with includeDeleted and decide on what they read"
    - "A people list in an audit detail is cut from the longest list down to fit the 400 character limit and ends with +N, so a purge can never fail on audit length"
    - "The permanent delete is a tracked remove after the audit record in one save; the database cascade removes the history rows that were never loaded"

key-files:
  created:
    - src/Csps.Application/Orders/DeleteOrderHandler.cs
    - src/Csps.Application/Orders/RestoreOrderHandler.cs
    - src/Csps.Application/Orders/PermanentlyDeleteOrderHandler.cs
    - src/Csps.Application/Orders/ListDeletedOrdersRequest.cs
    - src/Csps.Application/Orders/ListDeletedOrdersRequestValidator.cs
    - src/Csps.Application/Orders/ListDeletedOrdersHandler.cs
    - src/Csps.Application/Orders/DeletedOrderListResponse.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderDeletionTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderDeletionHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderDeleteRestoreHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderDeletedListTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderDeletionTests.cs
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Application/Ports/IOrders.cs
    - src/Csps.Application/Ports/IOrderReader.cs
    - src/Csps.Application/Orders/OrderErrors.cs
    - src/Csps.Application/Orders/OrderAuditDetail.cs
    - src/Csps.Infrastructure/Orders/OrderStore.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - src/Csps.Server/Controllers/OrdersController.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md
    - docs/operations/audit-log.md

key-decisions:
  - "Delete does not use OrderChildWrite. It needs no child write, and restore and permanent delete must find a deleted order, which OrderChildWrite cannot. All three handlers use the same shape: ConflictRetry around one transaction, the order read with includeDeleted as needed, the audit entry recorded before the save."
  - "Delete takes the order row lock before it changes the row (LockAsync, then audit, then save), the same protocol every child write uses. Restore and permanent delete rely on the row version check in the save, because they write no child row."
  - "Two lost races on delete, restore or permanent delete answer 409 edit.stale, the same as the status route, not the auth.busy answer the Phase 6 expense handlers use."
  - "The people lists of order.permanently-deleted are ordered by when each person was first recorded (the child Position), because the database gives no order for an Include load, and each person appears once."
  - "The permanent-delete detail is cut to fit 400 characters (see Deviations): the longest of the three people lists loses its last ids first and ends with +N."

patterns-established:
  - "Pattern: an audit detail that can carry an open-ended list is built with a fit-to-limit step, with a test that proves the limit with many people"
  - "Pattern: handler tests that simulate a lost race put the shared in-memory order back to its starting state when the unit of work rolls back, as a fresh read would"

requirements-completed: [ORD-06]

coverage:
  - id: S1
    description: "D-26 to D-28: an Admin deletes the full ORD-2026-0148 order (204); GET is 404 orders.not-found; a Manager finds it in the deleted list with number, customer, team, status pending, total 21,327.50, paid 12,000.00, balance 9,327.50, deletedAt and the Admin as deletedBy; the Admin gets 403 on the list and on restore; the Manager restores it (204) and all five items, one discount, two payments, three expenses, the history and the same totals are back"
    requirement: ORD-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDeletionTests.cs#AnAdminDeletesAnOrderItDisappearsAManagerFindsItInTheDeletedListAndRestoresItWhole"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (matrix rows for DELETE, GET deleted, POST restore, DELETE permanent)"
        status: pass
    human_judgment: false
  - id: S2
    description: "D-26, T-07-45: after a soft delete the default counts of orders, items, discounts, payments, expenses, refunds and history are all zero and the payment, expense and refund sums are 0.00, while the filter-lifted counts still hold every row; restore brings every default count back; every item, discount, payment, expense, refund, details, status and second-delete request for the deleted id answers 404 orders.not-found"
    requirement: ORD-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDeletionTests.cs#ADeletedOrdersChildrenAndMoneyLeaveEveryDefaultReadAndComeBackOnRestore"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDeletionTests.cs#EveryRouteForADeletedOrderAnswers404OrdersNotFound"
        status: pass
    human_judgment: false
  - id: S3
    description: "D-28, D-29, T-07-43, T-07-44: a Manager deletes a soft-deleted order and a live one for good with confirm equal to the number (204); the order and its items, discounts, payments, expenses, refunds and history rows are all gone; the audit entry stays with money facts and user ids and no customer, team, contact, description or reason text; a wrong, empty, missing or lower-case confirm is 400 on confirm and removes nothing; an Admin is 403; an unknown id is 404 even with a wrong confirm"
    requirement: ORD-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDeletionTests.cs#AManagerDeletesADeletedOrALiveOrderForGoodWithItsNumberAndEveryRowGoesButTheAuditEntryStays"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDeletionTests.cs#APermanentDeleteWithoutTheExactNumberIs400OnConfirmAndRemovesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDeletionTests.cs#AnAdminCannotDeleteForGoodAndAnUnknownOrderIs404EvenWithABadConfirm"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderDeletionHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: S4
    description: "D-29: the permanent-delete detail for ORD-2026-0148 is number, status, subtotal 22450.00, discount 1122.50, total 21327.50, paid 12000.00, refunded 0.00, balance 9327.50, expenses 6065.00, receivers, payers, refunders, with each person once; with many people it stays at or under 400 characters and says how many ids were left out"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs (PermanentlyDeleted cases)"
        status: pass
    human_judgment: false
  - id: S5
    description: "D-31: delete and restore each write one entry with the documented keys and the right actor; a second delete, a restore of a live order and a repeat of the same restore Idempotency-Key write nothing more"
    requirement: ORD-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDeletionTests.cs#DeleteAndRestoreEachWriteOneEntryWithTheDocumentedKeysAndRepeatsWriteNone"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderDeleteRestoreHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: S6
    description: "ORD-08: over 10 rounds a soft delete racing an item add (current version) always gives a 204 delete and an item add of 200, 404 or 409; a deleted order never has an item added after its delete entry; the item-added entry comes before the delete entry or is absent"
    requirement: ORD-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs#ASoftDeleteRacingAnItemAddNeverLeavesADeletedOrderWithANewItemAfterTheDeleteEntry"
        status: pass
    human_judgment: false
  - id: S7
    description: "D-28, PERF-04: the deleted list runs exactly two SQL commands for a page of 1, 10 or 100 and for an empty list; it holds only deleted orders, newest deletion first, with pages that do not overlap"
    requirement: ORD-06
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderDeletedListTests.cs"
        status: pass
    human_judgment: false
  - id: S8
    description: "D-26, D-28: SoftDelete sets the pair once and returns false the second time, works in every status, Restore clears it and returns false when not deleted"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderDeletionTests.cs"
        status: pass
    human_judgment: false
  - id: S9
    description: "The Deleting, restoring and purging section of docs/api/orders.md, the +N sentence about cut audit lists, and the open D-39 note read clearly to a person"
    requirement: ORD-06
    verification: []
    human_judgment: true
    rationale: "Wording is the owner's call; no test judges prose."

duration: 45 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 15: Delete, restore, deleted list and permanent delete Summary

**Staff of either role can delete an order (`DELETE /api/v1/orders/{id}`); it and all its money leave every default read; only Managers can list deleted orders, restore them whole, or delete them for good after typing the exact order number, and the purge audit keeps the money facts and user ids with no customer details.**

## Performance

- **Duration:** about 45 min
- **Tasks:** 3 of 3
- **Files changed:** 27 files, about 2,000 added lines (about 27,000 tokens of hand-written lines, chars/4, with the OpenAPI JSON and the generated types left out)

## Accomplishments

- Task 1 (tracer): `Order.SoftDelete` and `Restore`, `IOrderReader.ListDeletedAsync` (two commands), the delete, restore and deleted-list handlers, three controller actions, matrix rows, a refreshed contract. The tracer test passed on its first GREEN run, including the child rows coming back through `IgnoreQueryFilters(["SoftDelete"])` on the includes.
- Task 2: `IOrders.Remove`, `PermanentlyDeleteOrderHandler` (404, then the exact confirm, then audit first, then a tracked remove), `OrderErrors.ConfirmMismatch`, `OrderAuditDetail.Deleted`, `Restored` and `PermanentlyDeleted`, the fourth route, the docs section, coverage gate.
- Task 3: the audit entries for delete and restore, proof that every default query hides a deleted order's children and every route answers 404, the delete-versus-item-add race (10 rounds), handler tests for delete, restore and the list, and the two-command proof for the deleted list.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | ff4d442f `test(07-15): delete, list deleted and restore an order (RED)` | 979fdb0d `feat(07-15): soft delete, deleted list and restore for orders (D-26 to D-28)` |
| 2 | f08273f5 `test(07-15): permanent delete with confirm and the D-29 snapshot (RED)` | b891bfe0 `feat(07-15): permanent order delete with the type-the-number confirm (D-28, D-29)` |
| 3 | 5364b082 `test(07-15): hidden money, delete audit and delete races (RED)` | 40a762a1 `feat(07-15): deleted orders hidden everywhere, audited (D-26, D-31)` |

- **Task 1 RED:** the endpoint test failed on the missing route (the DELETE answered 404 where 204 was expected). Valid assertion failure. `gsd_run check tdd-red-evidence` was not run (this runner's output is not TAP, JUnit or Surefire); the output was read by hand.
- **Task 2 RED:** the Application test project did not build (`PermanentlyDeleteOrderHandler` missing, compile-time RED); at runtime 7 of 8 server cases failed. The 7 Domain tests for `SoftDelete` and `Restore` were added in this commit and passed at once, because the Domain code came with Task 1. They sit here so the Domain coverage gate (100%) could run at the end of Task 2.
- **Task 3 RED:** the Application test project did not build (the handlers had no audit dependency yet); at runtime 1 of 11 deletion cases (the audit case) and the new race case failed. The hidden-children, every-route-404, and deleted-list-count cases passed at once, because the SoftDelete filters from 07-05 and the Task 1 handlers already do that work (the plan says "fix any default query that still sees a deleted order's children"; none did).
- **Teeth:** one one-run break was tried on the race test (removing `ConflictRetry` from the delete handler); the race test still passed in that run, because ten rounds rarely hit the lost-race window, so this proof was not shown. The handler tests that force a lost save do cover the retry (`DeleteALostRaceIsReadAgainAndDecidedAgain`). The break was reverted before any commit. The race test then passed three more times alone.
- REFACTOR: none needed.
- Tracer gate (Task 1): auto mode off and `human_verify_mode` end-of-phase with automated-only `<verify>`, so the verify commands were re-run after GREEN (`OrderDeletionTests` 1 passed, `*Authorization*` 315 passed) before expansion. Tracer verified end-to-end, expanding.

## Verification Evidence

- `dotnet build -warnaserror` (whole solution): 0 warnings, 0 errors.
- Preflight before the integration runs: ports 5180, 5115, 7028, 5199 free, no dev or test processes.
- Full runs after the last commit: `Csps.Server.IntegrationTests` 1621 total, 1621 passed, 0 failed (the known `ExpenseListTimingTests` passed this time; D-76 stands). `Csps.Infrastructure.IntegrationTests` 674 total, 673 passed, 0 failed, 1 skipped (the same skip as before). `Csps.ArchitectureTests` 241 passed. `Csps.Domain.UnitTests` 1142 passed. `Csps.Application.UnitTests` 1705 passed.
- Filtered classes, each alone: `*OrderDeletionTests` (Server) 11, `*OrderConcurrencyTests` 10, `*Authorization*` 318, `*Idempotency*` 54, `*OpenApiSnapshotTests` 10, `*OrderDeletionHandlerTests` 16, `*OrderDeleteRestoreHandlerTests` 19, `*OrderAuditDetailTests` 47, Domain `*OrderDeletionTests` 7, `*OrderReaderDeletedListTests` 5. All passed. The delete race passed three more times alone.
- `tools/scripts/Invoke-CoverageGate.ps1` after the last commit: Csps.Domain line 100% (2310/2310), branch 100% (940/940); Csps.Application line 97.9% (5823/5942), branch 94.6% (not gated). "Coverage gate passed."
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The snapshot was refreshed with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command only, twice (after Task 1 and after Task 2). `npm --prefix web run typecheck` is clean.
- Acceptance criteria: `Policies.Manager` in the controller 3 (at least 2); `orders/deleted` in the matrix 1 (at least 1); the confirm sentence in `OrderErrors.cs` 1 (exactly 1); `.ExecuteDelete` in the handler and the store 0 and 0 (total 0); `Phase 9` in `docs/api/orders.md` 1 (at least 1); `OrderDeleted` in `DeleteOrderHandler.cs` 1 (exactly 1); `OrderRestored` in `RestoreOrderHandler.cs` 1 (exactly 1).
- gitleaks on each staged change: no leaks. Only fake values appear. No em or en dash in any changed source file or the added doc text. No package, trigger, migration, SQL string or JSON column was added.

## Task Commits

1. **Task 1: tracer, delete, deleted list, restore** - RED `ff4d442f`, GREEN `979fdb0d`
2. **Task 2: permanent delete and the D-29 snapshot** - RED `f08273f5`, GREEN `b891bfe0`
3. **Task 3: hidden money, delete audit, races** - RED `5364b082`, GREEN `40a762a1`

## Decisions Made

See key-decisions above. The ones the owner should know about: the cut audit lists (below), 409 `edit.stale` on two lost races (not the Phase 6 `auth.busy` answer), and restore of a live order being a 404 (as the plan states, unlike Phase 6 expenses where it was a quiet success).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The D-29 snapshot does not fit the audit log's 400 character limit**
- **Found during:** Task 2 GREEN, when a unit test with two people in each list came out cut.
- **Issue:** `AuditEntry.DetailMaxLength` is 400. The money keys alone take about 182 characters and each user id takes 36, so an order with six or more distinct people across receivers, payers and refunders would make the audit constructor throw, and the permanent delete would answer 500 and remove nothing. With 3 staff in all three lists that is already 9 ids.
- **Fix:** `OrderAuditDetail.PermanentlyDeleted` builds the full detail, and while it is over 400 it drops the last id of the longest list and ends that list with `+N` for the N ids left out. Each person appears once, in the order first recorded. This keeps the money facts whole, which is what D-29 is for. Documented in `docs/api/orders.md` and `docs/operations/audit-log.md`; tested with 8 people in each list (24 ids): the result is at most 400 characters and kept plus left out equals 24.
- **Files modified:** `src/Csps.Application/Orders/OrderAuditDetail.cs`, the two docs, `OrderAuditDetailTests.cs`
- **Commit:** b891bfe0
- **For the owner:** this changes what the audit keeps in a busy case. See "Deferred Issues".

### Plan notes (no behaviour change beyond what the plan states)

- **Domain tests landed in the Task 2 RED commit** (the plan lists them under Task 3), so the Domain 100% coverage gate could run at the end of Task 2. They passed at once.
- **Audit code for delete and restore landed in Task 3**, as the plan words it. Between the Task 1 and Task 3 commits the delete and restore routes worked but wrote no audit entry; nothing shipped between them.
- **Files beyond the plan's list:** `tests/Csps.Application.UnitTests/Orders/OrderDeleteRestoreHandlerTests.cs` (delete, restore and list handler cases) and `tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderDeletedListTests.cs` (the exactly-two-commands proof), plus `docs/operations/audit-log.md` (the `+N` sentence). The plan listed `DeleteOrderHandler.cs` and `RestoreOrderHandler.cs` only under Task 3; they came in Task 1 and gained their audit lines in Task 3.
- **`OrderStore.LockAsync` was not changed.** It still hides a deleted order, which is fine: delete locks a live order, and restore and permanent delete write no child row, so they rely on the row version in the save.
- **No new user-facing wording** beyond the plan's sentence "Type the order number exactly to delete it for good." The page and page size messages are the shared list messages ("Use a page from 1 to 100000.", "Use a page size from 1 to 100.").

**Total deviations:** 1 auto-fixed (Rule 2, the audit length), 5 plan notes. **Impact:** one behaviour call for the owner; no change to scope.

## Issues Encountered

- **One of my shell commands hung on standard input.** I typed `python -` by mistake, which waits for a script on stdin. I found the `python.exe` process by its start time and parent shell, confirmed it was mine, killed only it (and its shell ended with it), and checked that no `python`, `dotnet` or `node` process of mine was left. No file was affected, and nothing was written outside the repo and the scratchpad.
- The working tree stores files with CRLF; edits by the Edit tool and `sed` kept the line endings, and git only prints the usual LF to CRLF notice.
- `OrderAuditDetail`'s first version returned the people in database order, which differs from insertion order; the integration test caught it and the lists are now ordered by `Position`.
- The unit test double for the order store returns the same in-memory order on a retry, so the delete and restore lost-race tests put the order back to its starting state when the unit of work rolls back.

## Deferred Issues

- **For the owner: a ruling on the audit length.** The permanent-delete audit entry cannot hold all three people lists once more than about five people are involved. I cut the lists with `+N` so a purge never fails (see Deviations). Other choices: (1) keep this; (2) widen the audit detail column from 400 to a larger size, which is a schema change and one for you to approve; (3) record only the money facts and drop the three people lists. My recommendation is 1 for now, and 2 if you want every id kept.
- **Open from D-39, parked in the STATE.md owner backlog (not decided here):** whether refunds on a soft-deleted order count toward money on hand. The docs say it is decided in Phase 10. The refund rows and the filters keep either answer possible.
- **Phase 9:** image cleanup joins the permanent delete when orders can have images. The docs say so; nothing is scheduled today.
- **Teeth for the retry:** see TDD Gate Compliance. If you want a stronger proof of the delete-versus-add race, a deterministic test would need a hook that pauses a save, which the code does not have.
- The `ExpenseListTimingTests` machine-speed failure in `deferred-items.md` did not fail in this plan's full run; owner ruling D-76 stands.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-07-42 (an Admin restoring or purging) is mitigated by `Policies.Manager` on the three routes, and the matrix and the endpoint tests assert 403 for an Admin. T-07-43 (a purge by accident) is mitigated by the server-side exact confirm, the 400 tests (wrong case, blank, missing) and the audit entry written first. T-07-44 (customer data in the audit) is mitigated by the money-and-ids-only snapshot, with tests that look for customer, team, contact, description and reason text. T-07-45 (a deleted order's money still counting) is mitigated by the named SoftDelete filters, with default-count and sum tests for every child. No package was added.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 07-16. A deleted order and all its money are hidden from every default query, so list, search and report plans can rely on the filters without extra checks; the deleted list gives the Manager screen its data.

## Self-Check: PASSED

All 12 files listed under key-files.created exist on disk, and all six task commits (ff4d442f, 979fdb0d, f08273f5, b891bfe0, 5364b082, 40a762a1) are ancestors of HEAD. The acceptance criteria above were re-run after the last commit.

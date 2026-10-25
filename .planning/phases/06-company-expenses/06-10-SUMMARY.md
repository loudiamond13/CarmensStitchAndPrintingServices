---
phase: 06-company-expenses
plan: 10
subsystem: api
tags: [soft-delete, restore, hard-delete, audit, authorization, idempotency, ef-core, openapi]
created: "2026-10-25T12:08:00-05:00"
updated: "2026-10-25T12:08:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: CompanyExpense, ICompanyExpenses.FindAsync(includeDeleted), CompanyExpenseReader with the named SoftDelete filter, ExpenseAuditDetail.Snapshot, ExpenseErrors.NotFound, ListQueryRules, ExpenseFixtures, the stamp interceptor (plans 06-01 to 06-08)
provides:
  - DELETE /api/v1/company-expenses/{id}, a Manager-only soft delete
  - POST /api/v1/company-expenses/{id}/restore, Manager-only, with an Idempotency-Key
  - DELETE /api/v1/company-expenses/{id}/permanent, Manager-only hard delete with the audit entry written first
  - GET /api/v1/company-expenses/deleted, the Manager-only deleted list
  - CompanyExpense.SoftDelete and Restore, ICompanyExpenses.Remove, ICompanyExpenseReader.ListDeletedAsync
affects: [06-12, 06-13, 06-16, 06-17]

actuals:
  tokens: 28400
  tasks: 3
  commits: 6
plan_head_before: 6c97857eeec137a782b868070073e942d0e5aabc
plan_head_after: a8896996f83c1f9cda877611d8bc059aeedf45da

tech-stack:
  added: []
  patterns:
    - "Single-click action with no row version: ConflictRetry plus InTransactionAsync, read the latest state, decide, audit and save once; a lost race is read again and a vanished row becomes a 404"
    - "Tracked Remove (never ExecuteDelete) so the audit row and the delete share one save and one transaction"
    - "The deleted list lifts only the named SoftDelete filter (IgnoreQueryFilters([\"SoftDelete\"])) and keeps rows with DeletedAtUtc not null; search and category narrowing is one shared helper with the live list"

key-files:
  created:
    - src/Csps.Application/Expenses/DeleteCompanyExpenseHandler.cs
    - src/Csps.Application/Expenses/RestoreCompanyExpenseHandler.cs
    - src/Csps.Application/Expenses/PermanentlyDeleteCompanyExpenseHandler.cs
    - src/Csps.Application/Expenses/ListDeletedExpensesHandler.cs
    - src/Csps.Application/Expenses/ListDeletedExpensesRequest.cs
    - src/Csps.Application/Expenses/ListDeletedExpensesRequestValidator.cs
    - src/Csps.Application/Expenses/DeletedExpenseListResponse.cs
    - tests/Csps.Application.UnitTests/Expenses/DeleteCompanyExpenseHandlerTests.cs
    - tests/Csps.Application.UnitTests/Expenses/RestoreCompanyExpenseHandlerTests.cs
    - tests/Csps.Application.UnitTests/Expenses/PermanentlyDeleteCompanyExpenseHandlerTests.cs
    - tests/Csps.Application.UnitTests/Expenses/ListDeletedExpensesHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseDeletionTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/ListDeletedExpensesEndpointTests.cs
  modified:
    - src/Csps.Domain/Expenses/CompanyExpense.cs
    - src/Csps.Application/Ports/ICompanyExpenses.cs
    - src/Csps.Application/Ports/ICompanyExpenseReader.cs
    - src/Csps.Infrastructure/Expenses/CompanyExpenseStore.cs
    - src/Csps.Infrastructure/Expenses/CompanyExpenseReader.cs
    - src/Csps.Server/Controllers/CompanyExpensesController.cs
    - src/Csps.Server/Composition/ExpensesApplicationRegistration.cs
    - tests/Csps.Domain.UnitTests/Expenses/CompanyExpenseTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseFixtures.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/company-expenses.md
    - .planning/phases/06-company-expenses/deferred-items.md

key-decisions:
  - "The restore matrix row expects Manager 404 (not the plan's 400): the matrix harness always sends an Idempotency-Key, so a missing key is covered by a dedicated test instead"
  - "Deleted-list tie order is asserted as stable across pages, not as .NET Guid order, because SQL Server orders uniqueidentifier by its own byte order"
  - "The live list's Filter and the deleted list share one Narrow helper for category and search, so the two cannot drift"

requirements-completed: [CEXP-02]

coverage:
  - id: D1
    description: "A Manager soft-deletes an expense: it leaves the list, its total, the KPIs and the detail, an edit is 404, the row and stamps stay (D-01, D-31)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseDeletionTests.cs (AManagerDeletesAnExpenseAndItLeavesTheListItsTotalTheKpisAndTheDetail, TheRowStaysWithTheDeleteMarkerAndTheManagerAsLastChangedBy, AnEditFormSavedAfterASoftDeleteGets404)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Expenses/CompanyExpenseTests.cs (SoftDelete and Restore cases), tests/Csps.Application.UnitTests/Expenses/DeleteCompanyExpenseHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only Managers delete, restore, permanently delete or list deleted expenses; an Admin gets 403 even on their own expense, anonymous 401 (D-02, D-07, T-06-31)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (matrix rows for the four routes), CompanyExpenseDeletionTests (AnAdminIsRefusedEvenOnAnExpenseTheyRecordedAndNothingChanges, AnAdminCannotPermanentlyDeleteEvenWhatTheyRecordedAndNothingChanges, ARestoreWithoutAKeyIs400ForAManagerAndAnAdminIsRefusedFirst), ListDeletedExpensesEndpointTests.AnAdminIsRefusedAndAnonymousIsUnauthorized"
        status: pass
    human_judgment: false
  - id: D3
    description: "Restore makes the expense count again and stamps the restoring Manager; a live expense is a 204 that writes and audits nothing; an unknown id is 404; the same key replays the stored 204 (D-03, D-31)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseDeletionTests.cs (ARestoreBringsTheExpenseBackInto..., RestoringALiveExpenseIsNoContentAndWritesAndAuditsNothing, RestoringAnUnknownIdIs404, TheSameRestoreWithTheSameKeyReplaysTheStoredNoContentAndRunsOnce)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Expenses/RestoreCompanyExpenseHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Permanent delete removes a live or soft-deleted row, a second call is 404, and the audit entry written first survives (D-04, D-06)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseDeletionTests.cs (APermanentDeleteRemovesALiveOrASoftDeletedRow... x2, ThePermanentDeleteAuditEntrySurvivesTheRowWithTheSnapshotAndNoText)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Expenses/PermanentlyDeleteCompanyExpenseHandlerTests.cs (audit recorded before Remove and before the save)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The deleted list shows only soft-deleted rows, newest deletion first, with q and category filters, paging caps and no period total or notes (D-07)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/ListDeletedExpensesEndpointTests.cs (18 cases)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Expenses/ListDeletedExpensesHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D6
    description: "Each action writes one audit entry (deleted, restored, permanently-deleted) with date, category id, amount and payer id and never the description or notes (D-06, D-27, T-06-33)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "CompanyExpenseDeletionTests (TheDeleteWritesOneAuditEntryWithTheSnapshotAndNoDescriptionOrNotes, ARestoreWritesOneAuditEntryWithTheSnapshotAndNoText, ThePermanentDeleteAuditEntrySurvivesTheRowWithTheSnapshotAndNoText)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Two deletes, or two permanent deletes, sent together give one 204, one 404 and one audit entry (T-06-34)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "CompanyExpenseDeletionTests (TwoDeletesSentTogether... and TwoPermanentDeletesSentTogether..., five rounds each)"
        status: pass
    human_judgment: false
---

# Phase 6 Plan 10: Manager Deletion Set Summary

**Managers can soft-delete, restore and permanently delete a company expense and list the deleted ones, each action audited with a text-free snapshot, with no row version, a retry on lost races, and 403 for every Admin.**

## Performance

- **Duration:** about 40 min (16:26Z to 17:05Z, plus close-out)
- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 TDD)
- **Files:** 26 changed in code and tests, plus the planning files

## Accomplishments

- **Soft delete (D-01, D-31):** `CompanyExpense.SoftDelete(by, now)` and `Restore()` return a bool, so a second call is a no-op. `DeleteCompanyExpenseHandler` finds the live row, marks the Manager and the server time, records `company-expense.deleted` and saves once, inside `ConflictRetry` plus `InTransactionAsync`. The stamp interceptor sets Last changed by and at to the Manager with no change to it. The expense then leaves the list, its total, the KPIs and the detail, and a PUT is 404.
- **Restore (D-03):** `RestoreCompanyExpenseHandler` finds the row including deleted ones, does nothing for a live row (204, no write, no audit, version unchanged), and otherwise clears the marker and records `company-expense.restored`. The POST goes through the existing idempotency middleware: the same key replays the stored 204 and does not run twice.
- **Permanent delete (D-04, D-06):** `ICompanyExpenses.Remove` is a tracked remove. The handler records `company-expense.permanently-deleted` first, then removes, then saves once, so the audit row and the delete are one transaction and the entry outlives the row. A unit test proves the entry is recorded before the Remove and before the save.
- **Deleted list (D-07):** `ICompanyExpenseReader.ListDeletedAsync` lifts only the named `SoftDelete` filter, keeps `DeletedAtUtc != null`, orders by deletion time then id, and runs in two SQL commands (count, then page). Search and category narrowing moved into one `Narrow` helper shared with the live list. The validator reuses the list rules and words.
- **Access (D-02):** each of the four actions carries `[Authorize(Policy = Policies.Manager)]` on top of the class-level Staff policy; the matrix has four new rows and the whole matrix passes.
- **Audit (D-27):** the snapshot is `date=...;category=<id>;amount=...;payer=<id>`. Tests assert the description and notes text ("Zebra", "Nena") is absent in all three entries.
- **Contract and docs:** the OpenAPI snapshot and generated web types are refreshed (LF kept); `docs/api/company-expenses.md` documents the four routes, who may call, no row version, the audit entries and that a permanently deleted expense frees its category under D-30.

## Task Commits

1. **Task 1: Tracer, Manager soft delete (D-01, D-02, D-31)**
   - RED `e47edf3` (test)
   - GREEN `66a7b90` (feat)
2. **Task 2: Deleted list and restore (D-03, D-07)**
   - RED `40b57c7` (test)
   - GREEN `fa1a0e2` (feat)
3. **Task 3: Permanent delete (D-04, D-06)**
   - RED `efd8478` (test)
   - GREEN `a889699` (feat)

**Plan metadata:** the `docs(06-10)` commit that follows this file.

### TDD gate compliance

`test(06-10)` precedes `feat(06-10)` for all three tasks; no REFACTOR commits. The `gsd_run check tdd-red-evidence` classifier does not read the MTP console report (same as 06-08), so the evidence is the quoted run plus a semantic assessment.

- **Task 1 RED:** the Domain test project did not build (`CS1061: 'CompanyExpense' does not contain a definition for 'SoftDelete'`, and `Restore`). `*CompanyExpenseDeletionTests` ran 8: 7 failed on the planned missing route (the 204 or 403 was not returned) and 1 passed (`AnUnknownIdIs404`, which the generic not-found already satisfies, kept as a regression test).
- **Task 2 RED:** the Application test project failed to build (`CS0246: ListDeletedExpensesHandler`, `RestoreCompanyExpenseHandler` could not be found). `*ListDeletedExpensesEndpointTests` ran 18: all 18 failed; `*CompanyExpenseDeletionTests` ran 14: the 6 new restore tests failed and the 8 old ones passed.
- **Task 3 RED:** the Application test project failed to build (`CS0246: PermanentlyDeleteCompanyExpenseHandler`). `*CompanyExpenseDeletionTests` ran 20: 5 new tests failed on the missing route; `APermanentDeleteOfAnUnknownIdIs404` passed on the generic not-found and stays as a regression test. `DeleteCompanyExpenseHandlerTests` was written in this RED commit against the Task 1 handler and passes once the project compiles (a characterization of code that already existed).
- Semantic assessment: every target either failed to compile on exactly the missing feature or failed on the planned status assertion.

## Verification evidence

- `dotnet build Csps.slnx`: `0 Warning(s)`, `0 Error(s)` (after each GREEN).
- Task 1: `*CompanyExpenseDeletionTests` 8/8, Domain `*CompanyExpenseTests` 42/42, `*Authorization*` 213/213 (after adding the row), `*OpenApiSnapshotTests` 10/10 after refresh.
- Task 2: `*ListDeletedExpensesEndpointTests` 18/18, `*CompanyExpenseDeletionTests` 14/14, Application `*Expenses*` 185/185, `*Authorization*` 219/219.
- Task 3: `*CompanyExpenseDeletionTests` 20/20, Application `*Expenses*` 201/201, `*Authorization*` 222/222.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): "Csps.Domain line 100% (1009/1009) branch 100% (424/424) PASS; Csps.Application line 99.2% (3374/3398) PASS. Coverage gate passed."
- Architecture tests 239/239. `dotnet format Csps.slnx --verify-no-changes` reports only the known `UserDirectory.cs(1,1): IMPORTS` item from deferred-items; none of this plan's files.
- Full Server integration run after the last commit: 1248 total, 1247 passed, 1 failed: `ExpenseListTimingTests` (see Issues).
- Acceptance greps: `Policies.Manager` in the controller 1 (class-level Staff plus per-action attributes; the four actions each carry it); `CompanyExpenseDeleted` in the delete handler 1; `ConflictRetry` in the delete handler 1; `IgnoreQueryFilters` in the reader 1; `/api/v1/company-expenses/deleted` in the matrix 1; `restore` in the matrix 1; `CompanyExpensePermanentlyDeleted` in the permanent handler 1; `ExecuteDelete` in the permanent handler and the store 0 and 0; `/permanent` in the matrix 1.
- Tracer gate: the Task 1 `<verify>` (both automated commands) ran end to end and passed before expansion.

## Decisions Made

- **Restore matrix row expects Manager 404, not 400.** The plan said "400: no Idempotency-Key", but the matrix harness always sends a key (and the gate runs after authorization), so a random id meets 404. The missing-key 400 is its own test (`ARestoreWithoutAKeyIs400ForAManagerAndAnAdminIsRefusedFirst`).
- **Tie order is asserted as stable, not as .NET order.** SQL Server compares `uniqueidentifier` in its own byte order, so the first draft of the tie test (which sorted with .NET `OrderDescending`) failed intermittently. The test now checks the whole list, a repeat read and one-row pages all give the same sequence.
- **Shared `Narrow` helper** for category and search in the reader, so the live list and the deleted list cannot drift (no change to the live list's SQL).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's matrix expectation for the restore row**
- **Found during:** Task 2 (writing the matrix row)
- **Issue:** The plan asked for "(401, 403, 400: no Idempotency-Key)", but `AuthorizationMatrixTests` adds an `Idempotency-Key` to every request, so a Manager on a random id gets 404.
- **Fix:** The row expects Manager 404 and carries a comment saying so; the 400 case is covered by a dedicated integration test.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`, `CompanyExpenseDeletionTests.cs`
- **Commit:** `fa1a0e2`

**2. [Rule 1 - Bug] Tie-order test compared against .NET Guid order**
- **Found during:** Task 2 (first GREEN run, 17 of 18 passed)
- **Issue:** The test asserted ids in .NET descending order, which is not SQL Server's `uniqueidentifier` order. The RED commit `40b57c7` still holds that first draft.
- **Fix:** Replaced by `ExpensesDeletedAtTheSameInstantKeepOneStableOrderAcrossPages`.
- **Files modified:** `tests/Csps.Server.IntegrationTests/CompanyExpenses/ListDeletedExpensesEndpointTests.cs`
- **Commit:** `fa1a0e2`

**3. [Rule 3 - Blocking] ExpenseFixtures helper for the permanent delete added in Task 3**
- **Found during:** Task 3 (RED)
- **Issue:** `PermanentDeleteAsync` was needed by the Task 3 tests but `ExpenseFixtures.cs` is not in Task 3's file list. It sits in the Task 2 and Task 1 list, and the file was already being changed by this plan.
- **Fix:** Added to the RED commit `efd8478`.

---

**Total deviations:** 3 auto-fixed (2 plan or test bugs, 1 file-list gap). **Impact:** None on scope or behaviour.

## Issues Encountered

- **`ExpenseListTimingTests` fails on this machine today.** The "five years, last page, size 100" case p95 was 406.9 ms and 313.0 ms in two runs alone (and failed in two larger runs), against 197.8 ms recorded by 06-06; the cheap cases slowed too (category filter p95 6.2 to 6.8 ms against 3.7; month KPIs 16 ms against 8.5). This plan changes no list or KPI query shape (the list filter was only split into a shared helper with the same SQL), and the numbers move about 30 percent between identical runs, so it reads as machine load (TheBETSLLC shares the box). I tried to confirm with a baseline worktree of the plan's start commit, but it failed at 0 ms for a setup reason, so there is no same-day baseline number. Recorded in `deferred-items.md`, not hidden, test not changed. D-28 says the CI runner decides.
- The baseline worktree I made in the scratchpad hit "Filename too long" on removal; I removed that folder myself with a long-path delete and ran `git worktree prune`; `git worktree list` shows only the main checkout.
- The `.planning/config.json` change that was uncommitted before this plan is untouched and unstaged.

## Known Stubs

None. The Delete, Restore and Permanent actions and the deleted list are real server behaviour; the web dialogs and the deleted page come in 06-16.

## Threat Flags

None. All new surface is in the plan's threat model: T-06-31 (Admin on Manager routes) by `[Authorize(Policy = Policies.Manager)]`, four matrix rows and Admin 403 tests on every route; T-06-32 (untraced deletion) by one audit entry per action in the same transaction and D-31 stamps; T-06-33 (text kept after a permanent delete) by the text-free snapshot and the absence assertions; T-06-34 (double delete, replayed restore) by 404 on a second delete, the restore no-op, the Idempotency-Key replay test and the two-at-once tests; T-06-SC by installing nothing.

## User Setup Required

None - no external service configuration required.

## Owner items

None new. The CI-runner timing margin for D-28 (already parked from 06-06) now also has a local machine-speed note in `deferred-items.md`.

## Next Phase Readiness

- 06-16 can call `DELETE /company-expenses/{id}`, `POST /company-expenses/{id}/restore` (send an `Idempotency-Key`), `DELETE /company-expenses/{id}/permanent` and `GET /company-expenses/deleted`; the generated types are in `web/src/types/api.generated.ts`. After each of these, invalidate `expenseKpisKey` with `expensesKey` (phase note).
- No blockers.

## Self-Check: PASSED

All 13 created files exist on disk; the six task commits (`e47edf3`, `66a7b90`, `40b57c7`, `fa1a0e2`, `efd8478`, `a889699`) are ancestors of HEAD; the test runs above passed.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*

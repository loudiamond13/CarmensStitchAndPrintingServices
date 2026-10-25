---
phase: 06-company-expenses
plan: 13
subsystem: api
tags: [expense-categories, manager-writes, rowversion, audit, idempotency, ef-core, foreign-key, deadlock, openapi]
created: "2026-10-25T14:10:00-05:00"
updated: "2026-10-25T14:10:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: ExpenseCategory table, seed, list route, AuditDetailFormat and the six expense-category audit codes (06-01); category checks on add and edit (06-02, 06-08); permanent delete that frees a category (06-10)
provides:
  - POST /api/v1/expense-categories, a Manager-only add with an Idempotency-Key
  - GET and PUT /api/v1/expense-categories/{id}, a Manager-only detail read and a rename or recolor with a row version
  - POST /{id}/retire, POST /{id}/reactivate and DELETE /{id}, Manager-only, no version
  - expenseCount on every list item, soft-deleted expenses included
  - ExpenseCategory.Create, Rename, Recolor, Retire and Reactivate with the Others guard
  - Typed race exceptions CategoryNameTakenException, CategoryInUseException and CategoryDeletedException
  - Deadlock victims in the unit of work are a lost race (ConcurrencyConflictException)
affects: [06-14, 06-17, 06-18]

actuals:
  tokens: 46800
  tasks: 3
  commits: 7
plan_head_before: ea6053d8e551607c05a065fc319b41a50cb05084
plan_head_after: 6da9640bf4c07453cc64ea4acd4e25e36b129912

tech-stack:
  added: []
  patterns:
    - "Constraint backstops become typed exceptions in CspsUnitOfWork.SaveChangesAsync (unique name, expense foreign key from both sides), not in the store, because the audit row shares the save"
    - "The failing EF entries, not the SQL message text, say which side of the foreign key was refused"
    - "A deadlock victim, which EF wraps in an InvalidOperationException, becomes ConcurrencyConflictException so ConflictRetry reads again"
    - "Single-click category actions: ConflictRetry plus InTransactionAsync, read the latest state, decide, audit and save once"

key-files:
  created:
    - src/Csps.Application/ExpenseCategories/CategoryAuditDetail.cs
    - src/Csps.Application/ExpenseCategories/CreateExpenseCategoryHandler.cs
    - src/Csps.Application/ExpenseCategories/CreateExpenseCategoryRequest.cs
    - src/Csps.Application/ExpenseCategories/CreateExpenseCategoryRequestValidator.cs
    - src/Csps.Application/ExpenseCategories/DeleteExpenseCategoryHandler.cs
    - src/Csps.Application/ExpenseCategories/ExpenseCategoryDetailResponse.cs
    - src/Csps.Application/ExpenseCategories/ExpenseCategoryErrors.cs
    - src/Csps.Application/ExpenseCategories/ExpenseCategoryFieldsValidator.cs
    - src/Csps.Application/ExpenseCategories/ExpenseCategoryRules.cs
    - src/Csps.Application/ExpenseCategories/GetExpenseCategoryHandler.cs
    - src/Csps.Application/ExpenseCategories/IExpenseCategoryFields.cs
    - src/Csps.Application/ExpenseCategories/ReactivateExpenseCategoryHandler.cs
    - src/Csps.Application/ExpenseCategories/RetireExpenseCategoryHandler.cs
    - src/Csps.Application/ExpenseCategories/UpdateExpenseCategoryHandler.cs
    - src/Csps.Application/ExpenseCategories/UpdateExpenseCategoryRequest.cs
    - src/Csps.Application/ExpenseCategories/UpdateExpenseCategoryRequestValidator.cs
    - src/Csps.Application/Ports/CategoryDeletedException.cs
    - src/Csps.Application/Ports/CategoryInUseException.cs
    - src/Csps.Application/Ports/CategoryNameTakenException.cs
    - tests/Csps.Domain.UnitTests/Expenses/ExpenseCategoryTests.cs
    - tests/Csps.Application.UnitTests/ExpenseCategories/CategoryLifecycleHandlerTests.cs
    - tests/Csps.Application.UnitTests/ExpenseCategories/CreateExpenseCategoryHandlerTests.cs
    - tests/Csps.Application.UnitTests/ExpenseCategories/GetExpenseCategoryHandlerTests.cs
    - tests/Csps.Application.UnitTests/ExpenseCategories/UpdateExpenseCategoryHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Expenses/ExpenseCategoryStoreTests.cs
    - tests/Csps.Server.IntegrationTests/ExpenseCategories/ExpenseCategoriesManagementTests.cs
    - tests/Csps.Server.IntegrationTests/ExpenseCategories/ExpenseCategoryFixtures.cs
  modified:
    - src/Csps.Domain/Expenses/ExpenseCategory.cs
    - src/Csps.Application/ExpenseCategories/ExpenseCategoryListItem.cs
    - src/Csps.Application/ExpenseCategories/ListExpenseCategoriesHandler.cs
    - src/Csps.Application/Expenses/CreateCompanyExpenseHandler.cs
    - src/Csps.Application/Expenses/UpdateCompanyExpenseHandler.cs
    - src/Csps.Application/Ports/IExpenseCategories.cs
    - src/Csps.Infrastructure/Expenses/ExpenseCategoryStore.cs
    - src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
    - src/Csps.Server/Controllers/ExpenseCategoriesController.cs
    - src/Csps.Server/Composition/ExpensesApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/ExpenseCategories/ListExpenseCategoriesEndpointTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/test/expenseFixtures.ts
    - docs/api/company-expenses.md

key-decisions:
  - "Race backstops are translated in CspsUnitOfWork, not in ExpenseCategoryStore: the audit row shares the save, so only the unit of work sees the failed SaveChanges. The store owns the translation rules (TranslateSaveFailure)."
  - "The foreign key direction (delete refused vs expense insert or update refused) is read from the failing EF entries, so it does not depend on the SQL Server message language."
  - "A deadlock victim is a lost race (ConcurrencyConflictException): the delete handler reads again and answers 422 in-use."
  - "An expense saved in a category deleted a moment earlier is a 400 on categoryId, 'Choose a category.', the same words as an unknown category."
  - "The matrix rows for retire and reactivate expect Manager 404, not 400, because the matrix harness always sends an Idempotency-Key (same ruling as 06-10 for restore). The missing-key 400 has its own test."

patterns-established:
  - "Category writes: Manager policy per action on top of the class-level Staff policy, matrix row per route"
  - "Shared field rules for add and edit forms through an interface plus one FluentValidation validator (Include)"

requirements-completed: [CEXP-02]

coverage:
  - id: D1
    description: "A Manager adds a category with a chosen badge colour; it is trimmed, unique among all categories ignoring case, appears A to Z with Others last, is stamped and audited as added (D-08, D-13, D-15, D-27, OQ-10)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/ExpenseCategories/ExpenseCategoriesManagementTests.cs (AManagerAddsACategoryAndItAppearsInTheListInOrderWithOthersStillLast, ASecondCategoryWithTheSameNameInAnotherCaseIs400OnName, AToneOutsideTheSixIs400OnTone, AddingWritesOneAuditEntryWithTheNameAndTone, TwoAddsWithTheSameNameSentTogetherGiveOneCreatedAndOneNameError)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Expenses/ExpenseCategoryTests.cs, tests/Csps.Application.UnitTests/ExpenseCategories/CreateExpenseCategoryHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every write and the detail read are Manager only: an Admin gets 403, anonymous 401; the list stays readable by both roles (D-14, T-06-40)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (six new matrix rows), ExpenseCategoriesManagementTests (AnAdminCannotAddACategoryAndNothingIsWritten, AnAdminCannotSaveAndAnUnknownCategoryIs404, AnAdminCannotRetireReactivateOrDeleteAndNothingChanges)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A rename and a recolor save with a row version, show the new name on every expense, write separate audit rows, return 409 edit.stale for an old version and give one 200 and one 409 for two saves with one version (D-12, D-13, SEC-07)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "ExpenseCategoriesManagementTests (ARenameAndRecolorShowOnEveryExpenseWithANewVersionAndTwoAuditRows, ASaveWithAnOldVersionIs409EditStaleAndChangesNothing, TwoSavesWithOneVersionSentTogetherGiveOneOkAndOneConflict, ASaveWithNothingChangedIs200WithTheSameVersionAndWritesNoAudit)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/ExpenseCategories/UpdateExpenseCategoryHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Others can change colour but not name, and can be neither retired nor deleted (OQ-6, D-15)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "ExpenseCategoriesManagementTests (OthersCannotBeRenamedButCanBeRecolored, OthersCanNeitherBeRetiredNorDeleted)"
        status: pass
      - kind: unit
        ref: "ExpenseCategoryTests (Others cases), UpdateExpenseCategoryHandlerTests, CategoryLifecycleHandlerTests"
        status: pass
    human_judgment: false
  - id: D5
    description: "Retiring keeps the category listed as retired, refuses it on a new expense and keeps old expenses editable; bringing back restores it; repeats are 204 no-ops that write and audit nothing (D-11, OQ-4)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "ExpenseCategoriesManagementTests (RetiringKeepsTheCategoryListedAsRetiredRefusesNewExpensesAndKeepsOldOnesEditable, RetireAndReactivateWriteTheirAuditRowsWithTheName, ARetireOrReactivateWithoutAnIdempotencyKeyIs400ForAManager, TwoRetiresSentTogetherBothSucceedAndWriteOneAuditRow)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/ExpenseCategories/CategoryLifecycleHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D6
    description: "A category is deleted only while no expense row uses it, soft-deleted ones included; it can be deleted again once the last expense is deleted for good; the foreign key is the race backstop and no orphan is ever left (D-10, D-30, T-06-41)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "ExpenseCategoriesManagementTests (ACategoryNoExpenseUsesIsDeletedAndGoneAndASecondDeleteIs404, AUsedCategoryCannotBeDeletedEvenForASoftDeletedExpenseUntilThatExpenseIsDeletedForGood, ADeleteRacingANewExpenseNeverLeavesAnOrphan)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Expenses/ExpenseCategoryStoreTests.cs (the foreign key and unique name backstops), tests/Csps.Infrastructure.IntegrationTests/Persistence/CspsUnitOfWorkTests.cs (ADeadlockVictimIsALostRaceAndTheOtherSaveGoesThrough)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The category list carries expenseCount and the detail route carries status, isOthers, expenseCount, recordedBy (null reads System), lastChangedBy and version"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "ListExpenseCategoriesEndpointTests.EachItemCountsTheExpensesThatUseItSoftDeletedOnesIncluded, ExpenseCategoriesManagementTests (AManagerReadsASeededCategoryWithItsStatusCountAndSystemAsRecorder, ACategoryAManagerAddedNamesThatManagerAsTheRecorder)"
        status: pass
    human_judgment: false

duration: 68min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 13: Manager-owned expense categories Summary

**Managers can add, rename, recolor, retire, bring back and delete expense categories under the owner's rules (Others protected, names unique, a used category only retired, stale saves 409), every change audited, with the foreign key and a deadlock-safe unit of work as the race backstops.**

## Performance

- **Duration:** 68 min (17:51Z to 18:59Z, plus close-out)
- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 TDD), plus one extra RED and GREEN pair for the deadlock finding
- **Files:** 48 changed (4858 insertions, 51 deletions) including the generated contract

## Accomplishments

- **Domain (D-08, D-13, OQ-6):** `ExpenseCategory.Create`, `Rename`, `Recolor`, `Retire` and `Reactivate` return `Result`s with the owner's words. Others keeps its name (sending its own name is a no-op), may change colour, and can never be retired.
- **Add (D-08, D-13, D-15, OQ-10):** `POST /expense-categories` trims the name, checks 1 to 40 characters and one of the six tones, pre-checks the name against every category (retired ones included, any letter case) and relies on `IX_ExpenseCategories_NormalizedName` for the race. The 201 carries the list shape and a Location header.
- **Rename and recolor (D-12, SEC-07):** `PUT /{id}` compares the row version first (409 `edit.stale`), then the Others and name rules, writes `expense-category.renamed` and `.recolored` separately, and saves nothing when nothing changed. `GET /{id}` returns the detail with `recordedBy` (null for the ten seeded categories), `lastChangedBy`, `expenseCount` and `version`.
- **Retire, bring back, delete (D-10, D-11, D-30, OQ-4):** three single-click routes inside `ConflictRetry` plus `InTransactionAsync`. Repeats are 204 no-ops. Delete counts expense rows with the SoftDelete filter lifted, so a category is blocked by a soft-deleted expense and freed by a permanent delete (D-30). No schema change and no trigger.
- **Races:** two adds with one name give one 201 and one 400; two PUTs with one version give one 200 and one 409; two retires give two 204 and one audit row; a delete racing a new expense never leaves an orphan (1000 stressed races: see Verification).
- **List:** every item gains `expenseCount` (soft-deleted expenses included) from one correlated count, so the Settings page (06-17) can show which categories are deletable.
- **Contract and docs:** OpenAPI snapshot and `api.generated.ts` refreshed (LF kept); `docs/api/company-expenses.md` documents all seven category routes, the rules and messages, Others, D-10 and D-30, the race behaviour and the audit table.

## Task Commits

1. **Task 1: Tracer, add a category and see it in the list**
   - RED `6c47d95` (test)
   - GREEN `95fc602` (feat)
2. **Task 2: Rename and recolor with conflict protection**
   - RED `7b209b8` (test)
   - GREEN `524abbb` (feat)
3. **Task 3: Retire, bring back and delete**
   - RED `8d85465` (test)
   - RED (deadlock finding) `e1738cc` (test)
   - GREEN `6da9640` (feat)

**Plan metadata:** the `docs(06-13)` commit that follows this file.

### TDD gate compliance

`test(06-13)` precedes `feat(06-13)` for every task; no REFACTOR commits. The `gsd_run check tdd-red-evidence` classifier does not read the MTP console report (same as 06-08 and 06-10), so the evidence is the quoted run plus a semantic assessment. The plan is `type: execute`, not `type: tdd`.

- **Task 1 RED:** the Domain test project did not build (`CS1061: 'ExpenseCategory' does not contain a definition for 'Rename'`, and the missing `Create` showed as `CS7036 ... FileSystemAclExtensions.Create`); the Application project did not build either (`CreateExpenseCategoryHandler` missing). Semantic assessment: every failure names the missing behaviour.
- **Task 2 RED:** the Application project did not build (`CS0246: UpdateExpenseCategoryHandler`, `ExpenseCategoryDetailView`). `*ExpenseCategoriesManagementTests` ran 22: 12 failed on the missing routes (404 or 405 instead of the planned 200, 400, 403, 409) and the 10 Task 1 tests passed.
- **Task 3 RED:** the Application and Infrastructure projects did not build (`RetireExpenseCategoryHandler`, `CountExpensesAsync`, `CategoryInUseException`). `*ExpenseCategoriesManagementTests` ran 31: 9 failed on the missing routes and the 22 earlier tests passed.
- **Deadlock RED (`e1738cc`):** `ADeadlockVictimIsALostRaceAndTheOtherSaveGoesThrough` failed on the planned assertion: `outcomes.Count(... is ConcurrencyConflictException) but was  saved | InvalidOperationException`. It is deterministic: two explicit transactions lock one category row each, then cross.

## Verification evidence

- `dotnet build Csps.slnx`: `0 Warning(s)`, `0 Error(s)`.
- Tracer gate: Task 1 `<verify>` (all three automated commands) ran end to end and passed before expansion: `*ExpenseCategoriesManagementTests` 10/10, Domain `*ExpenseCategoryTests` 21/21, `*ListExpenseCategoriesEndpointTests` 4/4.
- Task 2: Application `*ExpenseCategoryHandlerTests` 24/24, `*ExpenseCategoriesManagementTests` 22/22, `*Authorization*` 231/231.
- Task 3: `*CategoryLifecycleHandlerTests` 19/19, `*ExpenseCategoryStoreTests` 8/8 (after the deleted-category cases), `*ExpenseCategoriesManagementTests` 31/31, `*Authorization*` 240/240, `*CspsUnitOfWorkTests` 3/3.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): "Csps.Domain line 100% (1071/1071) branch 100% (446/446) PASS; Csps.Application line 99.1% (3669/3699) PASS. Coverage gate passed."
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." `*OpenApiSnapshotTests` 10/10 after refresh.
- Final full runs after the last commit: Domain 697/697, Application 1188/1188, Architecture 239/239, Infrastructure 558 passed and 1 skipped (a skip that existed before this plan), Server 1296 of 1298 (the 2 failures are recorded under Issues). An earlier full Server run after the Task 3 code was 1298/1298.
- Stress of the delete-versus-expense race (scratch test, since removed): 90 races before any fix gave 28 expense 500s (the foreign key insert refusal); 200 races gave 1 to 3 delete 500s (deadlock victim, SQL error 1205 in the captured exception). After both fixes, 1000 races (5 runs of 200) gave only `204/400` (998) and `422/201` (2), with no 500.
- `dotnet format Csps.slnx --verify-no-changes` reports only the known `UserDirectory.cs(1,1): IMPORTS` item from deferred-items; none of this plan's files.
- Web: `npm --prefix web run typecheck` clean; ESLint on the changed fixture clean; Vitest for the four category-related files 25/25.
- Acceptance greps: `CategoryNameTakenException` in the store 2; `ExpenseCount` in `ExpenseCategoryListItem.cs` 2 (the plan said 1: the record has one member and its required XML doc line); `Another category already has this name.` in the rules 1; `EditErrors.Stale` in the update handler 2; `The Others name can't change.` in the rules 1; `ExpenseCategoryDetailResponse` in the generated types 3; `expense-categories.in-use` in the errors 1; `IgnoreQueryFilters` in the store 3; retire and reactivate matrix rows 2.

## Decisions Made

- **Backstop translation lives in `CspsUnitOfWork`.** The plan said the store throws the typed exceptions, but the store never saves: the audit row shares the save, so only the unit of work sees the failed `SaveChanges`. The store keeps the rules (`ExpenseCategoryStore.TranslateSaveFailure`) and the unit of work calls it, then clears the tracker so the failed row cannot save again. The store tests drive both together.
- **Foreign key direction by entries, not message text.** A refused delete (an `ExpenseCategory` in state Deleted) is `CategoryInUseException`; a refused expense insert or update is `CategoryDeletedException`. Only the constraint name is read from the SQL message, and constraint names are not translated.
- **Domain and Application share the Others words.** The Domain guards Others with its own message, the Application checks first for the 400 on `name`, and a unit test pins the two texts equal.
- **Rename and retire test on created categories.** The class shares one database, so the tests that rename or retire use categories they create. The seeded Rent and Others are only read, or recolored and restored.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A deadlock between a delete and an expense save was a 500**
- **Found during:** Task 3 (full-suite run; `ADeleteRacingANewExpenseNeverLeavesAnOrphan` failed once with delete 500, then reproduced under load)
- **Issue:** When a delete and an expense save for the same category collide, SQL Server picks a deadlock victim (error 1205). EF wraps it in an `InvalidOperationException`, so the delete answered 500 instead of the planned 422.
- **Fix:** `CspsUnitOfWork` treats a deadlock victim as a lost race (`ConcurrencyConflictException`), so the delete reads again, sees the expense and answers 422. Extra RED commit `e1738cc` proves it with a deterministic two-transaction deadlock.
- **Files modified:** `src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs`, `tests/Csps.Infrastructure.IntegrationTests/Persistence/CspsUnitOfWorkTests.cs`
- **Verification:** the deadlock test and 1000 stressed races (see Verification evidence).
- **Committed in:** `e1738cc` (RED), `6da9640` (GREEN)

**2. [Rule 1 - Bug] An expense saved while its category was being deleted was a 500**
- **Found during:** Task 3 (stress of the same race: 28 of 90 races gave a 500 on the expense)
- **Issue:** If the delete commits between the expense handler's category check and its insert, the foreign key refused the insert and the person saw the generic error.
- **Fix:** the foreign key refusal on an expense insert or update becomes `CategoryDeletedException`; `CreateCompanyExpenseHandler` and `UpdateCompanyExpenseHandler` answer it as a 400 on `categoryId`, "Choose a category.", the same words as an unknown category. The plan's own edge says the expense may be refused in this race.
- **Files modified:** `src/Csps.Application/Expenses/CreateCompanyExpenseHandler.cs`, `src/Csps.Application/Expenses/UpdateCompanyExpenseHandler.cs`, `src/Csps.Application/Ports/CategoryDeletedException.cs`, the store, and tests in `CreateCompanyExpenseHandlerTests`, `UpdateCompanyExpenseHandlerTests` and `ExpenseCategoryStoreTests`
- **Committed in:** `6da9640`

**3. [Rule 1 - Bug] The plan's matrix expectation for retire and reactivate**
- **Found during:** Task 3 (writing the matrix rows)
- **Issue:** The plan asked for "(401, 403, 400)" on retire and reactivate, but the matrix harness always sends an `Idempotency-Key`, so a Manager on a random id meets 404 (the same finding as 06-10 for restore).
- **Fix:** the rows expect Manager 404 and carry a comment; the missing-key 400 is its own test (`ARetireOrReactivateWithoutAnIdempotencyKeyIs400ForAManager`). The create and update rows keep Manager 400 (empty body).
- **Files modified:** `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`
- **Committed in:** `8d85465`

**4. [Rule 3 - Blocking] The web test fixture needed `expenseCount`**
- **Found during:** Task 1 (`npm --prefix web run typecheck`)
- **Issue:** The generated list item type now requires `expenseCount`, so `categoryItem` in `web/src/test/expenseFixtures.ts` stopped compiling.
- **Fix:** the fixture default is `expenseCount: 0`.
- **Files modified:** `web/src/test/expenseFixtures.ts`
- **Committed in:** `95fc602`

**5. [Plan wording] Files outside the plan's list**
- Added: `IExpenseCategoryFields.cs` and `ExpenseCategoryFieldsValidator.cs` (one shared rule set for add and edit, as the expense forms do), `GetExpenseCategoryHandlerTests.cs`, `CspsUnitOfWork.cs`, `CspsUnitOfWorkTests.cs`, a `ThrowOnSave` helper in `AuthTestDoubles.cs`, `web/src/test/expenseFixtures.ts`. The Create handler tests were written in Task 1 with the handler instead of in Task 2.

---

**Total deviations:** 4 auto-fixed (3 Rule 1, 1 Rule 3), 1 file-list note. **Impact:** None on scope. Fixes 1 and 2 are small and are what makes the plan's own edge ("the delete refused or the expense refused, never an orphan") hold without a 500.

## Issues Encountered

- **Flake: `CompanyExpenseListQueryCountTests.ThePageSizeDoesNotChangeTheNumberOfSqlCommands`** failed in two of three full Server runs (`large.Count` was 3, `small.Count` 4) and passed every time it was re-run alone and in the third full run (1298/1298). This plan touches no expense list or KPI query. Recorded in `deferred-items.md`, test unchanged.
- **Machine speed: `ExpenseListTimingTests`** failed once in the last full run ("five years, last page, size 100": p50 287.5 ms, p95 392.8 ms), the same item 06-10 recorded (406.9 ms). Not touched by this plan; already in `deferred-items.md`.
- Two of my early scripted edits failed to parse in the shell and ran nothing; the files were then written with the Write and Edit tools. A temporary scratch race test and a temporary diagnostic in the delete handler were removed before the GREEN commit; `git status` showed only the pre-existing `.planning/config.json` change afterwards.
- The pre-existing uncommitted `.planning/config.json` change is untouched and unstaged.
- No background shell or process was left running.

## Known Stubs

None. The routes are real server behaviour; the Settings page that calls them is 06-17.

## Threat Flags

None. All new surface is in the plan's threat model: T-06-40 (Admin on category writes) by `[Authorize(Policy = Policies.Manager)]` on every write and the detail, six matrix rows and Admin 403 tests; T-06-41 (deleting a used category) by the count including soft-deleted rows, the foreign key mapped to 422, and the orphan race test, with no trigger; T-06-42 (duplicate names) by the pre-check plus the unique index mapped to the same field error, and the two-adds test; T-06-43 (stale save) by the row version compare, the 409 and the two-writer test; T-06-44 (stored XSS) by names being text only and percent-encoded in the audit detail (a name with `;` and `=` is tested); T-06-SC by installing nothing.

## User Setup Required

None - no external service configuration required.

## Owner items

None new. The A-06-01 and CI-timing items from earlier plans are unchanged in the STATE.md backlog.

## Next Phase Readiness

- 06-17 (Settings page) can call all seven category routes; the generated types are in `web/src/types/api.generated.ts`. Send an `Idempotency-Key` on add, retire and reactivate, and send `version` from `GET /{id}` on save. After a category change, invalidate the category list query; after a rename or recolor also invalidate the expense queries (`expensesKey`, `expenseKpisKey`), because every expense shows the category name and tone.
- 06-14 and 06-18 can rely on `expenseCount` in the list to decide whether Delete or only Retire is offered, and on `422 expense-categories.in-use` as the server's final word.
- No blockers.

## Self-Check: PASSED

All 27 created files exist on disk; the seven task commits (`6c47d95`, `95fc602`, `7b209b8`, `524abbb`, `8d85465`, `e1738cc`, `6da9640`) are ancestors of HEAD; the test runs above passed.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*

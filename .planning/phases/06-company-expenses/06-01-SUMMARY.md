---
phase: 06-company-expenses
plan: 01
subsystem: api
tags: [ef-core, migration, seed, expense-categories, staff-lookup, audit-catalog, controllers]
created: "2026-10-25T07:04:00-05:00"
updated: "2026-10-25T07:04:00-05:00"

requires:
  - phase: 05-profile-users-audit
    provides: IUserDirectory pattern, Identity tables, AuditActions catalog (37 codes), AuditKey, Staff policy, authorization matrix
provides:
  - ExpenseCategories table with the ten seeded categories (migration 20261025114714_AddExpenseCategories)
  - GET /api/v1/expense-categories (Staff, both roles) and GET /api/v1/staff (Staff, names and ids only)
  - IStaffDirectory.GetStaffStateAsync and StaffState.CanPay, the single payer rule for plans 06-02 and 06-08
  - Twelve Phase 6 audit codes and AuditDetailFormat (Pair, Change, Join, Encode, Decode, Parse)
  - CspsDatabase.ResetAsync reseed of the ten categories after the Respawn reset
affects: [06-02, 06-04, 06-08, 06-13, phase-07-orders]

actuals:
  tokens: 24700
  tasks: 3
  commits: 7
plan_head_before: 942a8385ebc135cb46ff7f82f723cfdb8c462f05
plan_head_after: 87ad6cbe5e0b6a91454b3059685f5c5667d066a7

tech-stack:
  added: []
  patterns:
    - "Literal HasData seed built from a Domain seed list shared with the test reseed"
    - "Correlated role subquery in the staff read (same shape as UserDirectory)"
    - "Audit detail as key=value and key=old>new pairs, percent-encoding only for free text"

key-files:
  created:
    - src/Csps.Domain/Expenses/ExpenseCategory.cs
    - src/Csps.Domain/Expenses/CategoryTones.cs
    - src/Csps.Domain/Expenses/ExpenseCategorySeed.cs
    - src/Csps.Infrastructure/Persistence/Configurations/ExpenseCategoryConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261025114714_AddExpenseCategories.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261025114714_AddExpenseCategories.Designer.cs
    - src/Csps.Infrastructure/Expenses/ExpenseCategoryStore.cs
    - src/Csps.Infrastructure/Expenses/ExpensesRegistration.cs
    - src/Csps.Infrastructure/Identity/StaffDirectory.cs
    - src/Csps.Application/Ports/IExpenseCategories.cs
    - src/Csps.Application/Ports/IStaffDirectory.cs
    - src/Csps.Application/ExpenseCategories/ListExpenseCategoriesHandler.cs
    - src/Csps.Application/ExpenseCategories/ExpenseCategoryListItem.cs
    - src/Csps.Application/Staff/ListStaffHandler.cs
    - src/Csps.Application/Staff/StaffMember.cs
    - src/Csps.Application/Staff/StaffState.cs
    - src/Csps.Application/Common/AuditDetailFormat.cs
    - src/Csps.Server/Controllers/ExpenseCategoriesController.cs
    - src/Csps.Server/Controllers/StaffController.cs
    - src/Csps.Server/Composition/ExpensesApplicationRegistration.cs
    - docs/api/company-expenses.md
  modified:
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - tests/Csps.Testing/CspsDatabase.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md
    - .planning/STATE.md

key-decisions:
  - "A-06-01 built as option 2 (D-32 literally: has a password); parked in the STATE.md owner backlog with three options, recommendation first, and pinned by StaffLookupEndpointTests.ATemporaryPasswordPersonWhoHasNotSignedInIsListed"
  - "The D-32 set-up check lives only in StaffDirectory.cs (list filter and HasPassword projection); StaffState.CanPay reads HasPassword"
  - "Seed ids and SeededAtUtc (2026-10-25) are pinned literals in ExpenseCategorySeed, shared by HasData and the test reseed"
  - "The migration file names carry the tool's real timestamp 20261025114714, not the plan's placeholder 20261025000000"

patterns-established:
  - "Test reseed: CspsDatabase.ResetAsync re-inserts missing seeded categories through CreateContext (no interceptors, so CreatedAtUtc stays the seed stamp)"
  - "Phase 6 lookups use Policies.Staff controllers returning bare arrays with no-store caching"

requirements-completed: [CEXP-02, CEXP-05]

coverage:
  - id: D1
    description: "Ten seeded expense categories (D-08, D-09, D-13) in a migrated table with a unique normalized name and a six-tone check, back after every test reset"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Expenses/ExpenseCategorySeedTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/ExpenseCategoriesMigrationTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /api/v1/expense-categories returns every category A to Z with Others last, with status and tone, for both roles; anonymous gets 401 (D-15, D-11)"
    requirement: CEXP-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/ExpenseCategories/ListExpenseCategoriesEndpointTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/ExpenseCategories/ListExpenseCategoriesHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (matrix row GET /api/v1/expense-categories)"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /api/v1/staff returns id and name of staff who can pay (active, unlocked, undeleted, with a password), sorted, never an email (CEXP-05, D-32)"
    requirement: CEXP-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Staff/StaffLookupEndpointTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Staff/StaffStateTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (matrix row GET /api/v1/staff)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Twelve expense and category audit codes in the catalog (49 in total) and one detail format that cannot carry description or notes text (D-27)"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Common/AuditDetailFormatTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "Owner choice A-06-01 (can a temporary-password person who never signed in be chosen as Paid by) is built as the literal D-32 rule and waits for the owner"
    verification: []
    human_judgment: true
    rationale: "A behavior and security-posture ruling that belongs to the owner; parked in the STATE.md owner backlog"

duration: 20min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 01: Categories, staff lookup and audit catalog Summary

**Ten seeded expense categories behind GET /api/v1/expense-categories, a names-only staff lookup with one StaffState.CanPay payer rule, and the twelve D-27 audit codes with one tested detail format.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-10-25T11:43:18Z
- **Completed:** 2026-10-25T12:03:05Z
- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 TDD)
- **Files modified:** 41 (including generated contract and migration files)

## Accomplishments

- The `ExpenseCategories` table exists with a unique normalized name (`IX_ExpenseCategories_NormalizedName`), a six-tone check (`CK_ExpenseCategories_Tone`), SEC-08 attribution with NO ACTION foreign keys and a rowversion. The migration seeds the ten D-09 categories in their D-13 tones from literals, so an empty production database gets them too.
- Both roles read the categories A to Z with Others last (retired ones included with status `retired`) and the staff who can pay (id and name only). Anonymous callers get 401 on both. Matrix rows, the OpenAPI snapshot and `api.generated.ts` are refreshed.
- `StaffState.CanPay` is the one payer rule the create and edit validators will use in plans 06-02 and 06-08. The set-up check (`PasswordHash != null`) sits only in `StaffDirectory.cs`, in two clauses.
- `CspsDatabase.ResetAsync` puts the ten categories back after every Respawn reset, so later tests never fail on the category foreign key (Pitfall 1).
- `AuditActions` holds 49 codes. `AuditDetailFormat` writes and reads the D-27 `key=value` and `key=old>new` format, with percent-encoding only for free text, and a test proves the worst cases stay under 400 characters.

## Task Commits

1. **Task 1: Tracer, seeded categories read end to end**
   - RED `b882d86` (test)
   - GREEN `958f216` (feat)
2. **Task 2: Staff who can pay (CEXP-05, D-32)**
   - RED `017f4b6` (test)
   - GREEN `34d587e` (feat)
3. **Task 3: Audit codes and detail format (D-27)**
   - RED `3606d74` (test)
   - GREEN `2166574` (feat)
4. **Coverage support:** `87ad6cb` (test) unit tests for the two list handlers

**Plan metadata:** the `docs(06-01)` commit that follows this file.

### TDD gate compliance

RED then GREEN commit pairs exist for all three tasks (`test(06-01)` before `feat(06-01)`). No REFACTOR commits were needed.

RED evidence: each RED run failed because the new types did not exist, so the run stopped at compile errors (for example `CS0234: The type or namespace name 'Expenses' does not exist in the namespace 'Csps.Domain'`, `CS0117: 'AuditActions' does not contain a definition for 'CompanyExpenseAdded'`). That is a build failure, not a runner report, so `gsd_run check tdd-red-evidence` could not classify it. Semantic assessment: in a compiled language, tests that name a type that does not exist fail exactly because the planned behavior is missing; the plan itself says "run them failing (the types and the table do not exist yet)". The first run of each GREEN suite passed (Task 1: 14, 4 and 3 tests; Task 2: 11 and 8; Task 3: 35 and 20).

## Verification evidence

- `dotnet build Csps.slnx`: `0 Warning(s)`, `0 Error(s)`.
- Task 1 verify: `*ExpenseCategorySeedTests` 14/14, `*ExpenseCategoriesMigrationTests` 4/4, `*ListExpenseCategoriesEndpointTests` 3/3, `*TriggerInventoryTests` 2/2, `*MigrationScriptTests` 6/6, `*MigrationTests` 9/9.
- Task 2 verify: `*StaffLookupEndpointTests` 8/8, `*StaffStateTests` 11/11, `*Authorization*` 192/192, `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."; the A-06-01 pin case `*ATemporaryPasswordPersonWhoHasNotSignedInIsListed` ran 1 test, passed.
- Task 3 verify: `*AuditActionsTests` 35/35, `*AuditDetailFormatTests` 20/20.
- Full suites after the last commit: Domain 634/634, Application 929/929 (then 932 with the handler tests), Architecture 217/217, Infrastructure integration 519 passed and 1 skipped (a skip that existed before this plan), Server integration 1068/1068.
- `npm --prefix web run typecheck`: three programs, no errors.
- Tracer gate: Task 1 `<verify>` ran end to end in `end-of-phase` mode with automated checks only (four commands, all passed), so the slice was verified and expansion went ahead.
- Acceptance greps: `HasData` 2, `IX_ExpenseCategories_NormalizedName` 1, `ExpenseCategorySeed` in CspsDatabase 1, matrix rows for both routes, `ShouldBe(49)` 1, `company-expense.` 6 and `expense-category.` 6 in AuditActions, `PasswordHash` 0 in `StaffState.cs` and `ListStaffHandler.cs`.

## Files Created/Modified

See the frontmatter `key-files`. The migration files are `src/Csps.Infrastructure/Persistence/Migrations/20261025114714_AddExpenseCategories.cs` and `.Designer.cs` (the tool's real timestamp; the plan listed `20261025000000`). The generated migration holds one table, its three foreign-key indexes plus the unique name index, the check constraint and ten inserts; nothing else.

## Decisions Made

- A-06-01 is built as option 2, the literal D-32 rule ("has a password"). The owner choice is parked in the STATE.md owner backlog with all three options. The swap point is the two clauses in `StaffDirectory.cs`; the pinned test flips for options 1 and 3.
- Seed ids were generated once and pinned as literals; `SeededAtUtc` is 2026-10-25T00:00:00Z.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added unit tests for the two list handlers**
- **Found during:** final full run (coverage gate: Csps.Application is measured from its own unit test project only, Application at least 95 percent)
- **Issue:** `ListExpenseCategoriesHandler` (the retired status branch) and `ListStaffHandler` were only exercised through the integration suite.
- **Fix:** `ListExpenseCategoriesHandlerTests` (2 tests) and `ListStaffHandlerTests` (1 test).
- **Files modified:** `tests/Csps.Application.UnitTests/ExpenseCategories/ListExpenseCategoriesHandlerTests.cs`, `tests/Csps.Application.UnitTests/Staff/ListStaffHandlerTests.cs`
- **Verification:** 3 tests pass; Application suite 932 passed.
- **Committed in:** `87ad6cb`

**2. [Plan wording] Real migration timestamp**
- The plan listed the migration as `20261025000000_AddExpenseCategories`; `dotnet ef migrations add` produced `20261025114714_AddExpenseCategories`, as the plan told us to record.

---

**Total deviations:** 1 auto-fixed (1 missing critical test coverage), 1 naming note
**Impact on plan:** No scope change. The coverage tests keep the Application gate honest.

## Issues Encountered

- `CA1861` (constant array argument) in the first draft of the endpoint test; fixed with a `static readonly` field before the GREEN commit.
- An early shell command with several heredocs failed to parse and ran nothing; the files were then written with the Write tool. No state was affected.

## Known Stubs

None. The `ExpenseCategory` behavior methods (create, rename, recolor, retire, reactivate) are deliberately absent until plan 06-13, as the plan states; nothing in the UI or API shows placeholder data.

## Threat Flags

None. The two new endpoints are the ones in the plan's threat model (T-06-01, T-06-02, T-06-04), with the mitigations tested: names and ids only (no email key asserted), Staff policy plus matrix rows for anonymous, Admin and Manager, and one payer rule. T-06-03 is covered by `TriggerInventoryTests` and `MigrationScriptTests`; T-06-05 by `AuditDetailFormatTests`.

## User Setup Required

None - no external service configuration required.

## Owner items

- **A-06-01 (parked, away mode):** which of the three Paid by options the owner wants for a person created with a temporary password who has not signed in. The item is in the STATE.md "Owner backlog" with the recommendation first. Nothing was auto-approved.

## Next Phase Readiness

- Plan 06-02 can write expenses: the category foreign key target, the payer rule (`IStaffDirectory.GetStaffStateAsync`, `StaffState.CanPay`), the audit codes and `AuditDetailFormat` are all in place.
- Not yet done here, by design: the web still lists the 37 Phase 5 audit codes and the fixed category union; plans 06-04 and later replace those.

## Self-Check: PASSED

All created files exist; all seven task commits (`b882d86`, `958f216`, `017f4b6`, `34d587e`, `3606d74`, `2166574`, `87ad6cb`) are ancestors of HEAD; the final full test runs above passed.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*

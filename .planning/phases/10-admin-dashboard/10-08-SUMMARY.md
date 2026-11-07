---
phase: 10-admin-dashboard
plan: 08
subsystem: api
tags: [dotnet, csharp, ef-core, money, migration, linq, openapi, tdd, authorization-matrix]
created: "2026-11-07T05:35:00-06:00"
updated: "2026-11-07T05:35:00-06:00"

requires:
  - phase: 10-admin-dashboard
    provides: MoneyTransfer aggregate, MoneyOnHand.Of, MoneyRules, MoneyParty (plan 10-03)
  - phase: 10-admin-dashboard
    provides: DashboardController, serial contract-file order, AuthorizationMatrix chart row (plan 10-06)
provides:
  - "GET /api/v1/staff-money/me: the caller's own money on hand from six sums read on every request"
  - "The MoneyTransfers table (AddMoneyTransfers migration) with two CHECKs, NO ACTION keys and six indexes, no trigger and no query filter"
  - "The staff-money standing lock row (67 standing rows) for the transfer plans"
  - "IStaffMoneyReader.GetSumsAsync for many people (used by the ledger, recipients and all-staff plans)"
  - "MoneyErrors (NotFound, Forbidden, Busy) and MoneySeeding test helper"
affects: [10-10, 10-12, 10-14, 10-16, web money panel]

actuals:
  tokens: 19900
  tasks: 2
  commits: 4

plan_head_before: e9f56fedab20001f5050a780c4b18984d80de954
plan_head_after: 68a8dcb0dbc8282ce26f902e336626f7e1c8b196

tech-stack:
  added: []
  patterns:
    - "One statement over Users with six correlated LINQ sums; deleted transfers are left out in one private helper because the entity has no query filter"
    - "Transfer rows for tests are built through the domain factories and stamped on a test context until the transfer endpoints exist"

key-files:
  created:
    - src/Csps.Infrastructure/Persistence/Configurations/MoneyTransferConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261107110304_AddMoneyTransfers.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261107110304_AddMoneyTransfers.Designer.cs
    - src/Csps.Infrastructure/Money/StaffMoneyReader.cs
    - src/Csps.Infrastructure/Money/MoneyRegistration.cs
    - src/Csps.Application/Ports/IStaffMoneyReader.cs
    - src/Csps.Application/Money/StaffMoneySums.cs
    - src/Csps.Application/Money/StaffMoneyResponse.cs
    - src/Csps.Application/Money/GetMyMoneyHandler.cs
    - src/Csps.Application/Money/MoneyErrors.cs
    - src/Csps.Server/Controllers/StaffMoneyController.cs
    - src/Csps.Server/Composition/MoneyApplicationRegistration.cs
    - tests/Csps.Infrastructure.IntegrationTests/Money/StaffMoneyReaderTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/MoneyTransfersMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyFixtures.cs
    - tests/Csps.Server.IntegrationTests/Money/StaffMoneyBalanceTests.cs
    - tests/Csps.Application.UnitTests/Money/GetMyMoneyHandlerTests.cs
    - tests/Csps.Application.UnitTests/Money/StaffMoneySumsTests.cs
    - tests/Csps.Testing/MoneySeeding.cs
    - docs/api/staff-money.md
  modified:
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs
    - src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksMigrationTests.cs
    - tests/Csps.Testing/OrderSeeding.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "The new migration is 20261107110304_AddMoneyTransfers; it creates the table, its constraints and indexes and inserts the staff-money lock row, and touches no existing table"
  - "MoneyTransfer has no query filter; CountedTransfers in StaffMoneyReader is the one place that leaves deleted transfers out"
  - "IsHandover is a required bit with a database default of false, as the plan says; the EF constructor binding uses the domain's private constructor unchanged"
  - "IX_MoneyTransfers_List is TransferDate desc, CreatedAtUtc desc, Id ascending (the plan names Id without a direction)"
  - "A /me caller with no user row gets the existing 401 session-ended error, not a new money error"

patterns-established:
  - "MoneySeeding.AddTransferAsync writes a normal or hand-over transfer through the domain factories for reader and endpoint tests"

requirements-completed: [MONEY-01, MONEY-02, MONEY-08]

coverage:
  - id: D1
    description: "GET staff-money/me gives the caller's own exact balance (payment received minus company expense paid) for Admin and Manager, with only userId, name, balance and today; anonymous gets 401"
    requirement: MONEY-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffMoneyBalanceTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus (GET /api/v1/staff-money/me)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The balance is exact across all six sources, a payer change, an empty person, one centavo and a hand-over; deleted orders, transfers and company expenses never count, and a balance below zero is reported as negative"
    requirement: MONEY-01
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffMoneyReaderTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffMoneyBalanceTests.cs#ChangingAnExpensesPayerMovesTheAmountExactlyFromOnePersonToTheOther"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/StaffMoneySumsTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "The MoneyTransfers table has the designed columns, both CHECKs refuse bad rows, every people key is NO ACTION, the six indexes exist, and there is no trigger and no query filter"
    requirement: MONEY-01
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/MoneyTransfersMigrationTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs"
        status: pass
    human_judgment: false
  - id: D4
    description: "The staff-money lock row is seeded and the standing rows count 67"
    requirement: MONEY-01
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksMigrationTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "The OpenAPI snapshot and generated web types carry GetMyMoney and stay in step with the live document; docs/api/staff-money.md describes the route"
    requirement: MONEY-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false
  - id: D6
    description: "The wording of the NotFound and Forbidden error messages in MoneyErrors, which no route returns yet"
    verification: []
    human_judgment: true
    rationale: "The plan names the errors but not their words, and wording is the owner's call. The messages are plain placeholders until the plans that return them (10-10, 10-14, 10-16) set the final text."

duration: 42min
completed: 2026-11-07
status: complete
---

# Phase 10 Plan 08: Each staff member reads their own money on hand from the server Summary

*Created: 2026-11-07T05:35:00-06:00 · Updated: 2026-11-07T05:35:00-06:00*

**`GET /api/v1/staff-money/me` returns the caller's money on hand from six LINQ sums read on every request (payments, transfers in and out, company and order expenses, refunds), with the new `MoneyTransfers` table, its two CHECKs and the `staff-money` lock row added by one reviewed migration that touches nothing else.**

## Performance

- **Duration:** about 42 min
- **Started:** 2026-11-07T04:49:00-06:00
- **Completed:** 2026-11-07T05:31:00-06:00
- **Tasks:** 2 (one tracer, one auto), both TDD
- **Files:** 20 created, 11 modified (4 task commits, plus this SUMMARY commit)

## Accomplishments

- The tracer went through the whole stack first: configuration, migration, lock row, reader, port, handler, controller, registrations, matrix row, OpenAPI snapshot and web types. Its automated `<verify>` was re-run after the contract refresh (404 of 404 tests, `npm ... run check` exit 0). The tracer has only automated evidence, so no checkpoint was needed. Tracer verified end to end, then expanded.
- `StaffMoneyReader` runs one untracked statement over the asked people with six correlated sums. A test pins that two people cost one command. A person with no rows sums to 0.00 in every column.
- Money of a deleted order (payments, refunds, order expenses), a deleted company expense and a deleted transfer never counts. Deleted transfers are left out by one private helper, `CountedTransfers`, because the entity has no query filter. The legacy holder is never read.
- The balance can go below zero and is reported as a negative figure (D-15, D-16); nothing refuses it. Changing an expense's Paid by moves its amount exactly from one person to the other. A hand-over lowers the leaver and raises the recipient and leaves the recording Manager untouched.
- The migration adds the table, both CHECKs, five NO ACTION keys and six indexes, and seeds the `staff-money` lock row. No trigger, no JSON column, no drop in `Up`, no rename, and no existing table is touched.
- `docs/api/staff-money.md` documents the route, the six sources, what never counts and the schema note.

## Task Commits

1. **Task 1 (tracer): own money on hand, table and lock row** - RED `b9cb48a6` (test), GREEN `cd611e30` (feat)
2. **Task 2: all six sources, every delete, empty person, schema pinned** - RED `617e58a3` (test), GREEN `68a8dcb0` (feat)

**Plan metadata:** the SUMMARY commit that follows this file.

## Migration (real file names and quoted Up and Down)

Generated with `dotnet ef migrations add AddMoneyTransfers --project src/Csps.Infrastructure --startup-project src/Csps.Server --output-dir Persistence/Migrations`. The plan's placeholder `20261106000001` became `20261107110304`:

- `src/Csps.Infrastructure/Persistence/Migrations/20261107110304_AddMoneyTransfers.cs`
- `src/Csps.Infrastructure/Persistence/Migrations/20261107110304_AddMoneyTransfers.Designer.cs`
- `CspsDbContextModelSnapshot.cs`: 119 lines added, 0 removed (so no existing table changed)

Read line by line: only `CreateTable`, `InsertData` into `DatabaseLocks`, and `CreateIndex` in `Up`; `DropTable` of the new table and `DeleteData` of the new lock row in `Down`. No trigger, no JSON column, no rename, no alter of an existing table.

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.CreateTable(
        name: "MoneyTransfers",
        columns: table => new
        {
            Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
            FromUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
            ToUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
            Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
            TransferDate = table.Column<DateOnly>(type: "date", nullable: false),
            Note = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
            IsHandover = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
            CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
            CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
            UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
            UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
            DeletedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
            DeletedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
            RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
        },
        constraints: table =>
        {
            table.PrimaryKey("PK_MoneyTransfers", x => x.Id);
            table.CheckConstraint("CK_MoneyTransfers_Amount_Positive", "[Amount] > 0");
            table.CheckConstraint("CK_MoneyTransfers_FromTo_Different", "[FromUserId] <> [ToUserId]");
            // five foreign keys to AspNetUsers (CreatedById, DeletedById, FromUserId, ToUserId, UpdatedById), all with no onDelete (NO ACTION)
        });

    migrationBuilder.InsertData(
        table: "DatabaseLocks",
        columns: new[] { "Name", "ExpiresAtUtc", "HolderId", "TakenAtUtc" },
        values: new object[] { "staff-money", null, null, null });

    // IX_MoneyTransfers_CreatedById, _DeletedById, _UpdatedById (plain);
    // IX_MoneyTransfers_FromUserId and _ToUserId (include Amount, TransferDate, CreatedAtUtc, DeletedAtUtc);
    // IX_MoneyTransfers_List on TransferDate desc, CreatedAtUtc desc, Id
}

protected override void Down(MigrationBuilder migrationBuilder)
{
    migrationBuilder.DropTable(
        name: "MoneyTransfers");

    migrationBuilder.DeleteData(
        table: "DatabaseLocks",
        keyColumn: "Name",
        keyValue: "staff-money");
}
```

(The foreign key and index calls are summarised in comments here to keep the page short; the file has every call in full.)

## TDD Gate Compliance

Two RED to GREEN cycles, one per task; gate order in git is `test` then `feat` for each. No `refactor` commit was needed. `gsd_run check tdd-red-evidence` was not run: the xunit v3 / Microsoft.Testing.Platform console output is not a report format that classifier reads (same as plans 10-02, 10-03, 10-05 and 10-06), so each RED was inspected by hand.

**Cycle 1, Task 1 (tracer)**

- RED `b9cb48a6`. Command: `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*StaffMoneyBalanceTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*AuthorizationCoverageTests" --filter-class "*OpenApiSnapshotTests"`. Result: total 404, failed 9, succeeded 395, exit code 2. Every failure is an assertion on the planned behavior: `HttpStatusCode.OK` expected, `NotFound` got (3 endpoint tests), the anonymous test got 404 instead of 401, the three matrix rows got 404, and `DiscoveredEndpointsAreFullyCovered` / `ParallelCallersEachGetTheirOwnStatus` failed on the row that matched no endpoint.
- Semantic assessment: the seeding (payment, company expense, rename) ran and passed before each failing call, so the target tests ran and failed on the planned behavior; no load, fixture or zero-test fault. The lock-count change (66 to 67) sits in this RED commit too, because the migration of this cycle changes it.
- GREEN `cd611e30`: same command, total 404, failed 0, succeeded 404 (after `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command, `npm --prefix tools/openapi-gen run generate`, then `run check` exit 0). `*DatabaseLocksMigrationTests`, `*DatabaseLocksTests`, `*TriggerInventoryTests`, `*MigrationScriptTests`, `*MigrationTests`: total 124, failed 0.

**Cycle 2, Task 2**

- RED `617e58a3`: `*StaffMoneyReaderTests` + `*MoneyTransfersMigrationTests`: total 24, failed 1, succeeded 23. The one failure is `TheLegacyHolderAskedForReturnsNoRow` (expected `[paolo]`, got `[paolo, 18ed889a-...]`). Server `*StaffMoneyBalanceTests` 9 of 9 passed, Application `*GetMyMoneyHandlerTests` + `*StaffMoneySumsTests` 9 of 9 passed.
- Semantic assessment: the legacy holder test is a real RED on new behavior. The tracer reader was left without the legacy-holder exclusion on purpose, so Task 2 has behavior to add. The other tests (all six sources, deleted order, transfer and expense, empty person, one centavo, hand-over, payer change, schema, handler and sums) passed at RED. They are characterization tests: the plan builds the whole reader in the tracer, so they pin rules that already hold rather than failing first. They are kept because the plan's Task 2 behavior lists them.
- GREEN `68a8dcb0`: `*StaffMoneyReaderTests`, `*MoneyTransfersMigrationTests`, `*DatabaseLocksMigrationTests`, `*TriggerInventoryTests`, `*MigrationScriptTests`: total 35, failed 0. Server `*StaffMoneyBalanceTests`: 9 of 9. `*NoInlineSqlTests` + `*LayerTests`: 33 of 33.

## Verification Results (quoted from the runs)

- `dotnet build Csps.slnx`: Build succeeded, 0 Warning(s), 0 Error(s).
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output (run before each commit and at the end).
- Server group (`*StaffMoneyBalanceTests`, `*AuthorizationMatrixTests`, `*AuthorizationCoverageTests`, `*OpenApiSnapshotTests`), final run: total 409, failed 0, succeeded 409.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Infrastructure namespaces `Persistence`, `Money` and `Dashboard`: total 204, failed 0.
- Architecture tests, whole project: total 290, failed 0.
- Application unit tests, whole project with coverlet (`--coverlet-include=[Csps.Application]*`): total 2317, failed 0. Cobertura line-rate 0.9804, branch-rate 0.9569. `GetMyMoneyHandler` and `StaffMoneySums` line-rate and branch-rate 1.
- `npm --prefix web run typecheck`: clean (exit 0, no output) with the regenerated types.
- Acceptance greps: `CK_MoneyTransfers_FromTo_Different` names exactly one migration file; trigger count in the migration 0; `public const string StaffMoney = "staff-money";` 1; `HasQueryFilter` in the configuration 0; `GetMyMoney` in the snapshot 1; `ShouldBe(67)` in `DatabaseLocksMigrationTests` 2; `head -4 docs/api/staff-money.md` shows `created:` and `updated:`; the reader tests are named `AllSixSourcesAddUpToTheExactBalance`, `ADeletedOrderTakesItsPaymentRefundAndOrderExpenseOutTogether`, `ADeletedTransferNoLongerCountsForEitherPerson`, `AnEmptyPersonSumsToZeroInEveryColumn` and `AHandoverLowersTheLeaverAndRaisesTheRecipient...`.
- No em or en dash in any file this plan wrote (checked with a byte-level grep). `gitleaks protect --staged --no-banner` ran before each of the 4 task commits: no leaks found. Test people are made-up names (Liza Mercado, Paolo Garcia, Carmen Reyes, Jomar Santos).
- Not run, as instructed: the whole Server and Infrastructure suites and `ExpenseListTimingTests` (known timing failure D-76, D-103). No flake was seen in any run of this plan.

## Decisions Made

- The reader sums per person with correlated LINQ sums in one statement. Payments, refunds and order expenses rely on their order's named SoftDelete filter and company expenses on their own; transfers use `CountedTransfers`.
- `GetMyMoneyHandler` answers the existing `auth.session-ended` 401 when the token names no user or the reader finds no row, the same way the dashboard summary does. `MoneyErrors.NotFound`, `Forbidden` and `Busy` exist for the plans that need them.
- The index `IX_MoneyTransfers_List` sorts `Id` ascending; the plan names `Id` with no direction and the later list plan can still read it either way.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan staging] The 66 to 67 lock assertion moved from Task 2 to the Task 1 RED commit**
- **Found during:** Task 1
- **Issue:** The plan's Task 2 updates `DatabaseLocksMigrationTests` from 66 to 67, but the Task 1 migration is what adds the row, so Task 1's GREEN would have left a failing test in the tree.
- **Fix:** Updated the assertion (and added `staff-money` to the names checked) in the Task 1 RED commit, where it genuinely fails first.
- **Files modified:** `tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksMigrationTests.cs`
- **Committed in:** `b9cb48a6` (RED), made green by `cd611e30`

**2. [Plan staging] The legacy holder exclusion was left out of the tracer reader and added in Task 2**
- **Found during:** Task 1 design
- **Issue:** The plan builds the whole reader in the tracer, which would leave Task 2's RED with nothing that fails (fail-fast rule: an unexpected green in RED).
- **Fix:** The tracer reader sums all six sources but reads any asked id. Task 2's RED test `TheLegacyHolderAskedForReturnsNoRow` fails on that, and the GREEN adds `user.Id != LegacyHolder.Id`. The gap existed only between two commits of this plan; no caller can ask for the holder in between.
- **Files modified:** `src/Csps.Infrastructure/Money/StaffMoneyReader.cs`
- **Committed in:** `617e58a3` (RED), `68a8dcb0` (GREEN)

**3. [Rule 3 - Blocking] Test helpers outside the plan's file list**
- **Found during:** Task 2
- **Issue:** Both the reader tests and the endpoint tests need transfer rows, and the plan's `MoneyFixtures` lives only in the Server test project. The reader tests also need staff with a chosen last name.
- **Fix:** Added `tests/Csps.Testing/MoneySeeding.cs` (builds a normal or hand-over transfer through the domain factories and stamps it on a test context) and an optional `lastName` parameter on `OrderSeeding.AddStaffAsync`. Existing callers are unchanged.
- **Files modified:** `tests/Csps.Testing/MoneySeeding.cs`, `tests/Csps.Testing/OrderSeeding.cs`
- **Committed in:** `617e58a3`

**4. [Extra tests] Application unit tests, not in the plan's file list**
- **Issue:** The project holds Application at 95% or more, and the handler, the sums record and `MoneyErrors` are new Application code.
- **Fix:** Added `GetMyMoneyHandlerTests` and `StaffMoneySumsTests`. Application coverage after: line 0.9804, branch 0.9569; every new class is 100%.
- **Committed in:** `617e58a3`

---

**Total deviations:** 4 (2 plan staging, 1 blocking test helper, 1 extra tests).
**Impact on plan:** None changes behavior the plan defined. No scope creep, no package, no schema change beyond the planned migration.

## Issues Encountered

- `ln -s` in this shell made real copies of the two `node_modules` folders, not links. They were git-ignored and were removed with `rm -rf` after a marker-file test proved they were separate from the main checkout; the main checkout's `web/node_modules` (385 entries) and `tools/openapi-gen/node_modules` (30 entries) were counted before and after and were untouched. Nothing was committed from them and no `npm install` ran.
- The harness refuses compound shell commands that mix `cd`, `cmd` or variables with git in a worktree, so commands were run plain from the worktree root. No effect on the work.
- The build had 0 warnings with `IsHandover` set to `HasDefaultValue(false)`. The runtime EF logs were not read line by line for a bool-default notice.

## Open Questions for the Owner

- **Wording of two error messages (D6 above).** `MoneyErrors.NotFound` ("This person was not found.") and `MoneyErrors.Forbidden` ("You can't do this.") are plain placeholders. No route returns them yet, so no user sees them. The plans that return them (10-10, 10-14, 10-16) should set the final text, or the owner can give the words.
- The plan keeps `Down` as a drop of the new table. That is the undo of this migration, not a drop of existing data, and it is not used in production (production gets the reviewed idempotent script).

## Known Stubs

None. No placeholder, empty data source or TODO was left in the files of this plan.

## Threat Flags

None beyond the plan's threat model.

- T-10-12 mitigated: no stored balance; six sums on every read; no DTO or route accepts a balance; `MoneyOnHand.Of` is the single formula (through `StaffMoneySums.Balance()`).
- T-10-13 mitigated: the id is the token's subject; the route takes no id; matrix row 401/200/200.
- T-10-14 mitigated: two CHECKs instead of triggers; `TriggerInventoryTests` and `MigrationScriptTests` pass; the snapshot diff shows no change to an existing table.
- T-10-SC: no package was added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 10-10 (transfers), 10-12 (hand-overs and recipients), 10-14 (ledger) and 10-16 (all staff) can use `IStaffMoneyReader.GetSumsAsync`, the `MoneyTransfers` table, the `staff-money` lock name `DatabaseLocks.StaffMoney`, `MoneyErrors` and `MoneySeeding`. The next contract-file plan in the serial order is 10-10. Production needs the reviewed idempotent script for `AddMoneyTransfers` from the package step; nothing migrates at startup. No blockers.

## Self-Check: PASSED

- FOUND: all 20 files listed in `key-files.created` exist on disk.
- FOUND: commits `b9cb48a6`, `cd611e30`, `617e58a3`, `68a8dcb0` on this branch; measured `git rev-list --count e9f56fed..HEAD` = 4 before this SUMMARY commit.
- STATE.md and ROADMAP.md were not modified.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-07*

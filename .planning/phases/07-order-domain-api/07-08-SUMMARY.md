---
phase: 07-order-domain-api
plan: 08
subsystem: database
tags: [identity, legacy-holder, migration, seed-data, d-37, authorization, audit]
created: "2026-10-28T12:25:00-05:00"
updated: "2026-10-28T12:25:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-05 order aggregate and money foreign keys that point at AspNetUsers; D-37 owner ruling (07-AMENDMENTS.md)"
provides:
  - "LegacyHolder (Csps.Domain.Identity): the fixed id and literal values of the Legacy / unassigned holder"
  - "Migration AddLegacyHolder: one InsertData of one AspNetUsers row, inactive, no email, no password, no role"
  - "ApplicationUser.ForLegacyHolder(): the one row builder shared by the migration seed and the test reset"
  - "The holder is absent from GET /staff, GET /users (rows and total), GET /users/{id} (404) and GET /audit-log/people, and every /users/{id} action answers 404 and changes nothing"
  - "CspsDatabase.ReseedLegacyHolderAsync: Respawn resets put the holder row back"
  - "Holder section in docs/api/users.md"
affects: [07-09, 07-10, 07-11, 07-12, 07-13, 07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20]

actuals:
  tokens: 11300
  tasks: 2
  commits: 4
plan_head_before: 984614a9acde4419638ada73e46af9fcda4add45
plan_head_after: e67f7b177092e58732d70806ebfa54348f6e39f9

tech-stack:
  added: []
  patterns:
    - "A seeded Identity row is built once from domain literals (ApplicationUser.ForLegacyHolder) and used by both HasData and the Respawn reseed"
    - "UserAccounts.FindUserAsync is the single door to a user row for sign-in and every user action, so a hidden id is unknown on every path"
    - "Person-name lookups (audit, expense payer, order people) are deliberately not filtered, so legacy money still shows Legacy / unassigned"

key-files:
  created:
    - src/Csps.Domain/Identity/LegacyHolder.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028165341_AddLegacyHolder.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028165341_AddLegacyHolder.Designer.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/LegacyHolderMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Users/LegacyHolderHiddenTests.cs
    - tests/Csps.Domain.UnitTests/Identity/LegacyHolderTests.cs
  modified:
    - src/Csps.Infrastructure/Identity/ApplicationUser.cs
    - src/Csps.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/Identity/StaffDirectory.cs
    - src/Csps.Infrastructure/Identity/UserDirectory.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Infrastructure/Auditing/AuditLogReader.cs
    - tests/Csps.Testing/CspsDatabase.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/IdentitySchemaTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/BootstrapManagerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/CompanyExpensesSeedStepTests.cs
    - docs/api/users.md

key-decisions:
  - "The migration id is 20261028165341, the one dotnet ef generated, not the placeholder 20261028000003 in the plan. The placeholder sorts before AddOrders (20261028152204), so databases that already ran AddOrders would see an older pending migration."
  - "IsActive = false is listed by hand in the InsertData. The column default is true and EF leaves a false value out of generated seed rows, so the generated migration would have inserted an ACTIVE holder. The model snapshot is untouched, so ModelHasNoPendingChanges stays green."
  - "The row builder lives in ApplicationUser.ForLegacyHolder(), not in ApplicationUserConfiguration, because Csps.Testing cannot see the internal configuration class and the test reset must insert the identical row."
  - "UserAccounts hides the holder in one private FindUserAsync used by FindByIdAsync, CheckPasswordAsync, UpdateDetailsAsync and LoadAsync, so every Manager action, token lookup and sign-in step sees an unknown account (404 or failed password)."
  - "The holder keeps resolving by name in audit entries and payer lookups (formerStaff false) because the plan says legacy money must still show who holds it."

requirements-completed: [ORD-21, ORD-22, ORD-23]

coverage:
  - id: D1
    description: "Every database gets one Legacy / unassigned holder row from the migration: inactive, no email, user name, password or role, with literal stamps, and a test reset puts it back"
    requirement: ORD-21
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/LegacyHolderMigrationTests.cs#AFreshlyMigratedDatabaseHasTheHolderWithEveryColumnSetExplicitly"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/LegacyHolderMigrationTests.cs#TheTestResetBringsTheHolderBack"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "The holder never appears in the staff lookup, the roster rows or total, the user detail (404) or the audit people list"
    requirement: ORD-22
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LegacyHolderHiddenTests.cs#TheStaffLookupNeverListsTheHolder"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LegacyHolderHiddenTests.cs#TheRosterNeverListsOrCountsTheHolder"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LegacyHolderHiddenTests.cs#ReadingTheHolderByIdAnswers404LikeAnUnknownId"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LegacyHolderHiddenTests.cs#TheAuditPeopleListNeverHasTheHolder"
        status: pass
    human_judgment: false
  - id: D3
    description: "No user-management route can change the holder: all 11 /users/{id} routes answer 404 and the row, its role links and its tokens are unchanged; it cannot sign in or be named as a payer"
    requirement: ORD-23
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LegacyHolderHiddenTests.cs#EveryUserActionAimedAtTheHolderIsRefusedAndLeavesTheRowUnchanged"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LegacyHolderHiddenTests.cs#TheHolderCannotBeNamedAsAPayerAndFailsTheCanPayCheck"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LegacyHolderHiddenTests.cs#TheHolderCannotSignInOrBeFoundAsAnAccount"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LegacyHolderHiddenTests.cs#AnAuditEntryThatNamesTheHolderStillShowsLegacySlashUnassignedAndNotFormerStaff"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Legacy / unassigned note in docs/api/users.md reads clearly to a person"
    requirement: ORD-22
    verification: []
    human_judgment: true
    rationale: "No test judges prose."

duration: 35 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 08: The Legacy / unassigned holder Summary

**One inactive "Legacy / unassigned" user row is seeded by migration AddLegacyHolder and kept out of every picker, roster, count and user action, so legacy money with no known holder has a real foreign key target that can never sign in or be chosen.**

## Performance

- **Duration:** about 35 min
- **Completed:** 2026-10-28T17:20Z
- **Tasks:** 2 of 2
- **Files changed:** 14 hand-written (about 11,300 tokens of diff, chars/4, migrations left out), 18 in all

## Accomplishments

- Task 1 (tracer): `LegacyHolder` literals, `ApplicationUser.ForLegacyHolder()`, `HasData`, the migration, the staff lookup exclusion by id and `CspsDatabase.ReseedLegacyHolderAsync`. A new database has the holder with every column explicit; a Respawn reset brings it back identical.
- Task 2: the roster rows and total, the user detail (404), the audit people list and every user action now treat the holder as unknown. `UserAccounts` has one private `FindUserAsync` that all sign-in and Manager paths go through. Person-name resolution is left alone, so old money and old audit entries still read "Legacy / unassigned" with `formerStaff` false. Holder note added to `docs/api/users.md`.

## Migration Up and Down (Identity table, read line by line)

`Up` is one call. `IsActive` is the hand-added column (see Deviations); everything else is as generated.

```csharp
migrationBuilder.InsertData(
    table: "AspNetUsers",
    columns: new[] { "Id", "AccessFailedCount", "ConcurrencyStamp", "CreatedAtUtc", "CreatedById", "DeletedAtUtc", "EditVersion", "Email", "EmailConfirmed", "FirstName", "IsActive", "LastName", "LockoutEnabled", "LockoutEnd", "ManagerLockedAtUtc", "MustChangePasswordReason", "NormalizedEmail", "NormalizedUserName", "PasswordHash", "PendingEmail", "PhoneNumber", "PhoneNumberConfirmed", "SecurityStamp", "TwoFactorEnabled", "UpdatedAtUtc", "UpdatedById", "UserName" },
    values: new object[] { new Guid("18ed889a-b94d-42f5-a5b0-ee2f47b437cd"), 0, "1C1442FA-A6FF-48DD-A9DC-A9D8E061C456", new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, null, new Guid("4094c10f-b3f9-4b9b-8368-ab918b46a3b2"), null, false, "Legacy", false, "/ unassigned", false, null, null, null, null, null, null, null, null, false, "D794185C-717C-4A46-AFFF-FFC9616BFFE8", false, null, null, null });
```

`Down` is one call, by key only:

```csharp
migrationBuilder.DeleteData(
    table: "AspNetUsers",
    keyColumn: "Id",
    keyValue: new Guid("18ed889a-b94d-42f5-a5b0-ee2f47b437cd"));
```

Reading it: the row has no Email, UserName, PasswordHash, PhoneNumber or PendingEmail (null), `EmailConfirmed`, `TwoFactorEnabled` and `LockoutEnabled` false, `IsActive` false, no creator, no delete or lock stamp, literal stamps and `EditVersion`. `MustChangePassword` and `BreachRecheckPending` are left to their column default (false). No `CreateTable`, `AddColumn`, `DropColumn`, `DropTable`, `RenameColumn`, `CreateIndex` or trigger; no inline SQL; nothing migrates at startup.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | cb4919a7 `test(07-08): the legacy holder is seeded and hidden from the staff lookup (RED)` | b4139015 `feat(07-08): seed the Legacy / unassigned holder (D-37)` |
| 2 | 1c026498 `test(07-08): the holder is hidden everywhere and untouchable (RED)` | e67f7b17 `feat(07-08): hide the legacy holder from every list and user action (D-37)` |

- **Task 1 RED:** compile-time (`LegacyHolder` did not exist), the same style as plans 07-05 and 07-07.
- **Task 2 RED:** 5 of 10 cases failed with real assertions: the roster listed or counted the holder, `GET /users/{holderId}` answered 200, the first route in the loop answered 200, the audit people list had the holder, and `FindByIdAsync` returned the account. The other 5 passed already (staff lookup, reset, payer refusal, audit name, and the unrelated cases) and are regression proof.
- REFACTOR: none needed.
- Tracer gate (Task 1): auto mode off and `human_verify_mode` end-of-phase with automated-only verify, so the three tracer verify commands were re-run after GREEN (`LegacyHolderMigrationTests` 3, `MigrationScriptTests` 6, `LegacyHolderHiddenTests` 3, all passed) before expansion. Tracer verified end-to-end, expanding.

## Verification Evidence

- `dotnet build src/Csps.Server`: 0 warnings, 0 errors (also under the test builds, which treat analyzer warnings as errors).
- `Csps.Infrastructure.IntegrationTests` (full, 2 runs): 633 total, 632 passed, 1 skipped (`HibpLiveTests`, live network, pre-existing).
- `Csps.Server.IntegrationTests` (full, after Task 2 code): 1411 total, 1410 passed, 1 failed: `ExpenseListTimingTests` (known, see Issues).
- Filtered after the last code change: `*LegacyHolderHiddenTests` 10 of 10, `*StaffLookupEndpointTests` 10 of 10, `*Authorization*` 258 of 258, `*Users*` 174 of 174 on the second run (one flake on the first, see Issues).
- `Csps.Domain.UnitTests` 999 passed. `Csps.ArchitectureTests` 241 passed.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (1633/1633), branch 100% (628/628); Csps.Application line 98.4% (4203/4270). "Coverage gate passed."
- Acceptance criteria re-run: `InsertData` in `*_AddLegacyHolder.cs` 1 (is 1); `CreateTable|AddColumn|DropColumn|DropTable|RenameColumn` 0 (is 0); `ReseedLegacyHolderAsync` in `CspsDatabase.cs` 2 (at least 2); `LegacyHolder.Id` in `UserDirectory.cs` 2 (at least 2) and in `AuditLogReader.cs` 1 (at least 1); `D-37` in `docs/api/users.md` 1 (at least 1).
- gitleaks on every staged change: no leaks. The stamps are plain uppercase GUID text. No en or em dash in any added line. No real name, email or path in the new files (only `example.com` test addresses).
- Preflight run before the integration runs: all ports free, no other dev or test processes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The generated migration would have inserted an active holder**
- **Found during:** Task 1
- **Issue:** `IsActive` has a column default of true. `dotnet ef` left `IsActive = false` out of the InsertData columns, so the row would have come out active.
- **Fix:** listed `IsActive` with `false` in the InsertData by hand, with a one-line comment. The model snapshot is unchanged, so `ModelHasNoPendingChanges` stays green. The migration test checks `IsActive` is false in a fresh database and after a reset.
- **Files modified:** `src/Csps.Infrastructure/Persistence/Migrations/20261028165341_AddLegacyHolder.cs`
- **Commit:** b4139015

**2. [Rule 3 - Blocking] Existing tests counted every user row**
- **Found during:** Task 1 (full Infrastructure run, 11 failures)
- **Issue:** every migrated database now has one user, so tests that expected 0, 1 or 2 users failed (`BootstrapManagerTests`, `CompanyExpensesSeedStepTests`, `IdentitySchemaTests.ResetKeepsTheMigrationRolesAndRemovesUsers`).
- **Fix:** those counts now ignore the holder; the reset test asserts the only remaining user is the holder. Production code (bootstrap manager, seed step) already counted Managers, not users, and needed no change.
- **Files modified:** the three test files above
- **Commit:** b4139015

**3. [Rule 2 - Missing critical] Domain coverage gate**
- **Found during:** Task 2
- **Issue:** the new static `LegacyHolder` initializers are not run by any Domain unit test, which would drop Csps.Domain below the 100% gate.
- **Fix:** added `tests/Csps.Domain.UnitTests/Identity/LegacyHolderTests.cs` (2 tests). Gate passes at 100%/100%.
- **Commit:** e67f7b17

### Plan notes (no behaviour change)

- Migration file id is `20261028165341`, not the placeholder `20261028000003` (see key-decisions).
- `ApplicationUser.ForLegacyHolder()` is a file the plan did not list; `ApplicationUser.cs` was edited for it (see key-decisions).
- `UserAccounts` also hides the holder in `CheckPasswordAsync`, `UpdateDetailsAsync` and `LoadAsync` (not only `FindByIdAsync`), as the plan allowed for the load used by user mutations.
- The all-routes test asserts 404 on every route, stricter than the plan's "non-2xx".

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical), 4 plan notes. **Impact:** none on scope; stronger than planned.

## Issues Encountered

- `ExpenseListTimingTests.TheListAndTheKpisAnswerUnder300MsAtP95OnFiveYearsOfData` failed in the full Server run (about 2 min for that case). It is the known pre-existing machine-speed failure in `deferred-items.md` (D-76). Left alone.
- `TemporaryPasswordTests.AnInvitedPersonWhoGetsATemporaryPasswordCanSignInWithItAndTheOldInvitationDies` failed once in the first `*Users*` run (message not captured). It passed in the full Server run before and after, 3 of 3 alone, and in a second `*Users*` run. Recorded as an unreproduced flake, not hidden.
- Windows prints "LF will be replaced by CRLF" warnings on commit; line endings are normalised by git settings, no effect on the result.

## Deferred Issues

- The `ExpenseListTimingTests` machine-speed failure (pre-existing, D-76 stands).
- Order.Import (plan 07-18) must read the holder through `LegacyHolder.Id` directly, not through `UserAccounts` or `IStaffDirectory`, because both treat it as unknown or not payable on purpose.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-07-23 (activate, password or role for the holder) is mitigated by the single `FindUserAsync` door and the 11-route test; T-07-24 (naming the holder as payer) by `CanPay` plus the company-expense refusal test; T-07-25 (migration beyond one insert) by the acceptance greps and `MigrationScriptTests`. No package was added.

## Authentication Gates

None.

## Next Phase Readiness

Ready for plan 07-09. The holder exists in every database and in every reset test database, so order money plans can point `ReceivedBy`, `PaidBy` and `RefundedBy` at `LegacyHolder.Id` for imports. Any new code that lists people must filter the holder by id (as `StaffDirectory`, `UserDirectory` and `AuditLogReader.ListPeopleAsync` do); code that resolves a name for existing money must not.

## Self-Check: PASSED

All 6 created files and 12 modified files were checked on disk, and the four task commits (cb4919a7, b4139015, 1c026498, e67f7b17) are ancestors of HEAD. The acceptance criteria above were re-run after the last code commit.

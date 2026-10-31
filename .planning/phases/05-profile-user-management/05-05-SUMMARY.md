---
phase: 05-profile-user-management
plan: 05
subsystem: database
tags: [ef-core, migration, aspnet-identity, sql-server, sign-in, audit, tdd]
created: 2026-10-17T20:36:00-05:00
updated: 2026-10-17T20:36:00-05:00

requires:
  - phase: 04-identity-authentication
    provides: SignInHandler with the 04 D-02 generic 401 and ResponseFloor, UserAccounts over UserManager, the audit trail and its sign-in failure reasons
  - phase: 05-profile-user-management (plan 05-04)
    provides: TriggerInventoryTests, which prove this migration adds no trigger (OR-7)
provides:
  - AddUserManagement migration (20261018012015) with EditVersion, CreatedById, CreatedAtUtc, UpdatedById, UpdatedAtUtc, ManagerLockedAtUtc, DeletedAtUtc, PendingEmail on AspNetUsers
  - Backfill of CreatedAtUtc for pre-Phase-5 accounts from the earliest user.bootstrap-manager-created or user.invited audit entry, else migration time
  - UserAccount.IsManagerLocked, IsDeleted and the single computed rule IsBlocked
  - Sign-in refuses Manager-locked and deleted accounts with the same generic 401, timing and no session; audit details manager-locked and deleted
  - AccountStateFixtures.ManagerLockAsync and MarkDeletedAsync for later plans
affects: [05-06, 05-09, 05-10, 05-11, 05-19, 05-21, 05-23, roster, profile, every auth path that must honour IsBlocked]

plan_head_before: d3b6bfa73d8120247e9d2659460824ddc8c47544
plan_head_after: 1e7370dcde3b6202fbfa8df2ed182ff665d5ce9f

actuals:
  tokens: 10800
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Backfill SQL in a migration is wrapped in EXEC(N'...') so the idempotent production script compiles it in the batch that adds the column"
    - "Migration tests run the backfill both through IMigrator and through the generated idempotent script text"
    - "One computed rule (UserAccount.IsBlocked) for every auth path; a failed-password lockout is deliberately not part of it"

key-files:
  created:
    - src/Csps.Infrastructure/Persistence/Migrations/20261018012015_AddUserManagement.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261018012015_AddUserManagement.Designer.cs
    - tests/Csps.Server.IntegrationTests/Auth/AccountStateFixtures.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/UserManagementMigrationTests.cs
  modified:
    - src/Csps.Infrastructure/Identity/ApplicationUser.cs
    - src/Csps.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Infrastructure/Identity/IdentityRegistration.cs
    - src/Csps.Application/Auth/UserAccount.cs
    - src/Csps.Application/Auth/SignInHandler.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs
    - tests/Csps.Application.UnitTests/Auth/UserAccountTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/IdentitySchemaTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - docs/operations/audit-log.md

key-decisions:
  - "D-07 deleted marker is the nullable DeletedAtUtc timestamp, so the roster filter stays Active, Inactive, Locked; D-16 Manager lock is ManagerLockedAtUtc, separate from LockoutEnd"
  - "UserAccounts.CreateAsync stamps CreatedAtUtc from TimeProvider, because the column is NOT NULL and the CLR default (year 0001) would be stored otherwise"
  - "Sign-in detail order is deleted, then manager-locked, then deactivated"

patterns-established:
  - "Tracer slice: columns, mapping, rule and the sign-in check land together and are proven end to end before the backfill is added"

requirements-completed: [USER-03, USER-04, SEC-07, SEC-08]

coverage:
  - id: D1
    description: "A Manager-locked or deleted account signing in with the right password gets the generic 401, no session cookie and one audited reason (manager-locked or deleted), with no challenge and no email"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs#AManagerLockedOrDeletedAccountGetsTheGenericErrorNoSessionAndOneAuditedReason"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs#AnActiveAccountStillStartsASignIn"
        status: pass
    human_judgment: false
  - id: D2
    description: "AddUserManagement adds the eight columns and two NO ACTION self-referencing keys, with the NEWID default and no JSON column or trigger"
    requirement: "SEC-07"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Identity/IdentitySchemaTests.cs#UserManagementColumnsHaveTheirTypeNullabilityAndLength"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Identity/IdentitySchemaTests.cs#AttributionKeysAreIndexedNoActionKeysToTheUserTableAndTheVersionDefaultsToNewId"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pre-Phase-5 accounts get CreatedAtUtc from their earliest bootstrap or invite audit entry (else migration time), a distinct EditVersion and null attribution; the idempotent script does the same and applies twice"
    requirement: "SEC-08"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/UserManagementMigrationTests.cs#ExistingAccountsGetTheirCreationDateAFreshVersionAndSystemAttribution"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs#IdempotentScriptAppliesTwice"
        status: pass
    human_judgment: false
  - id: D4
    description: "UserAccount.IsBlocked is true for inactive, Manager-locked or deleted accounts and false for an active account in a failed-password lockout"
    requirement: "USER-04"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/UserAccountTests.cs#AnAccountIsBlockedWhenDeactivatedManagerLockedOrDeleted"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/UserAccountTests.cs#AFailedPasswordLockoutIsNotABlock"
        status: pass
    human_judgment: false
  - id: D5
    description: "Reviewed production script for AddUserManagement applied once by the owner to the live database"
    requirement: "SEC-08"
    verification: []
    human_judgment: true
    rationale: "Prime Directive 11: the owner applies the reviewed idempotent script; tests only prove it on throwaway CSPS_Test databases"

duration: 21min
completed: 2026-10-17
status: complete
---

# Phase 5 Plan 05: User Management Columns and Blocked Sign-in Summary

**One additive AddUserManagement migration puts EditVersion, attribution, Manager lock, soft delete and pending email on AspNetUsers, back-fills creation dates from the audit log, and a single UserAccount.IsBlocked rule makes sign-in refuse Manager-locked and deleted accounts with the same generic 401.**

## Performance

- **Duration:** about 21 min
- **Started:** 2026-10-17T20:14:00-05:00
- **Completed:** 2026-10-17T20:35:00-05:00
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 17 (4 created, 13 modified; 1,644 lines including the generated Designer file)

## Accomplishments

- Migration `20261018012015_AddUserManagement` (the dotnet-ef emitted timestamp; the plan's `20261018000000` was indicative): EditVersion (uniqueidentifier NOT NULL, default NEWID(), concurrency token), CreatedById and UpdatedById (nullable self-referencing keys, NO ACTION, indexed), CreatedAtUtc (NOT NULL after the backfill), UpdatedAtUtc, ManagerLockedAtUtc, DeletedAtUtc and PendingEmail (nvarchar(256)). No JSON column, no trigger, no drop or rename.
- CreatedAtUtc back-fill: the earliest `user.bootstrap-manager-created` or `user.invited` audit entry for the user (target type User, lower-case "D" id), else the migration time; EditVersion is distinct per existing row; attribution stays null (reads as System).
- `UserAccount` gained defaulted `IsManagerLocked` and `IsDeleted` (existing six constructions compile unchanged) and the computed `IsBlocked`; a failed-password lockout is not a block.
- Sign-in uses `IsBlocked` and records `manager-locked` or `deleted` (deactivated otherwise) through `RecordIndependentlyAsync`; the answer, status, timing floor and lack of a cookie are identical to a wrong password (T-05-10).

## Task Commits

1. **Task 1 (tracer): blocked accounts cannot sign in**
   - RED `f81782f` test(05-05): Manager-locked and deleted accounts cannot sign in (RED)
   - GREEN `fcc6288` feat(05-05): staff account columns for Phase 5; blocked accounts cannot sign in (D-07, D-16)
2. **Task 2: backfill and schema pins**
   - RED `e0c8035` test(05-05): backfill and schema of the user columns (RED)
   - GREEN `1e7370d` feat(05-05): backfill creation dates for existing accounts; pin the schema

**Plan metadata:** the docs(05-05) commit that carries this file, STATE.md, ROADMAP.md and REQUIREMENTS.md.

## TDD Gate Compliance

RED and GREEN commits exist for both tasks, in order; no REFACTOR commit was needed.

- **Task 1 RED (`f81782f`):** `InactiveAccountTests.AManagerLockedOrDeletedAccountGetsTheGenericErrorNoSessionAndOneAuditedReason` for `manager-locked` and `deleted` failed with `SqlException: Invalid column name 'ManagerLockedAtUtc'` / `'DeletedAtUtc'` (the columns did not exist). The fixtures wrote the columns with parameterised SQL so the target test ran and failed at the planned point instead of failing to compile; GREEN switched them to typed UserManager updates as the plan asks. 14 other tests in the class passed.
- **Task 2 RED (`e0c8035`):** `UserManagementMigrationTests.ExistingAccountsGet...` failed with `SqlNullValueException` reading CreatedAtUtc (no backfill), and `IdentitySchemaTests.UserManagementColumnsHave...(CreatedAtUtc, nullable: False)` failed (the column was still nullable). The remaining new schema pins and the `UserAccount` unit cases passed already, because Task 1 had created those columns, keys and the rule; they are regression pins, not RED drivers.
- **Machine validation:** the repo's runner (xunit v3 on Microsoft Testing Platform) does not emit TAP, JUnit XML or another format `gsd_run check tdd-red-evidence` supports, so `RED_EVIDENCE_OK` could not be produced. The semantic assessment above is from the real run output; nothing was fabricated.

## Decisions Made

- `UserAccounts.CreateAsync` stamps `CreatedAtUtc` from `TimeProvider`, so new accounts never store year 0001 in the NOT NULL column.
- Detail precedence in sign-in is `deleted`, then `manager-locked`, then `deactivated`, as the plan states.
- The hosts' registration `AddCspsIdentity` now does `TryAddSingleton(TimeProvider.System)` (the host registers the same instance first), so test providers that build Identity alone keep working.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] UserAccounts needed a TimeProvider that test service providers did not register**
- **Found during:** Task 1 (full Infrastructure test run)
- **Issue:** Stamping CreatedAtUtc added a `TimeProvider` dependency; 27 UserAccounts and TwoFactorStore tests failed resolving it.
- **Fix:** `services.TryAddSingleton(TimeProvider.System)` in `AddCspsIdentity` (a fake registered by a test still wins).
- **Files modified:** src/Csps.Infrastructure/Identity/IdentityRegistration.cs, src/Csps.Infrastructure/Identity/UserAccounts.cs
- **Verification:** Infrastructure suite 438/438.
- **Committed in:** fcc6288

**2. [Rule 1 - Bug] Domain pin test listed only the six old sign-in reasons**
- **Found during:** Task 2 (full solution test run; the Domain project was not in the plan's verify commands)
- **Issue:** `AuditActionsTests.SignInFailureReasonsAreTheSixDocumentedOnes` failed after `manager-locked` and `deleted` were added.
- **Fix:** Renamed to `...TheEightDocumentedOnes` and listed both new reasons.
- **Files modified:** tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
- **Verification:** Domain suite 590/590.
- **Committed in:** 1e7370d

**3. [Rule 1 - Bug] Backfill failed in the idempotent production script**
- **Found during:** Task 2 (`MigrationScriptTests.IdempotentScriptAppliesTwice`)
- **Issue:** The UPDATE named CreatedAtUtc in the same SQL batch that adds the column, so the script failed with "Invalid column name" (the direct `MigrateAsync` path passed).
- **Fix:** The backfill is sent as `EXEC(N'...')` with doubled quotes. `UserManagementMigrationTests` now runs both through `IMigrator` and through the generated idempotent script text, since the owner ships the script.
- **Files modified:** src/Csps.Infrastructure/Persistence/Migrations/20261018012015_AddUserManagement.cs, tests/Csps.Infrastructure.IntegrationTests/Persistence/UserManagementMigrationTests.cs
- **Verification:** both theory cases and MigrationScriptTests pass.
- **Committed in:** 1e7370d

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All three were needed for correctness of the migration and the existing suites; no scope creep.

## Issues Encountered

- Two test-only SQL slips (a banned `DateTimeOffset.UtcNow` and a catalog-vs-database collation conflict in a `sys.*` query) were fixed before the RED commit.

## Verification Results

- `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- Domain 590, Application 376, Architecture 217 (layer rules hold: ApplicationUser stays in Infrastructure), Infrastructure integration 438 (includes MigrationScriptTests, TriggerInventoryTests), HostProbe 9, Server integration 660: all pass.
- Acceptance greps: IsConcurrencyToken 1, DeleteBehavior.NoAction 2, one `*_AddUserManagement.cs`, "trigger" 0 in the migration, IsBlocked in SignInHandler 1, `user.bootstrap-manager-created` in the migration 1, `manager-locked` in audit-log.md on 2 lines.
- gitleaks on every staged diff: no leaks.

## User Setup Required

None. The reviewed idempotent script for `AddUserManagement` goes into the owner's production apply step with the other Phase 5 migrations (Prime Directive 11); it is additive and re-runnable.

## Known Stubs

None.

## Threat Flags

None. The migration adds columns on an existing table and no endpoint, auth path or file access.

## Self-Check: PASSED

- Created files exist: the migration and Designer, AccountStateFixtures.cs, UserManagementMigrationTests.cs.
- Commits `f81782f`, `fcc6288`, `e0c8035`, `1e7370d` are ancestors of HEAD.

## Next Phase Readiness

- Plan 05-10 and the other auth paths (refresh, reset, verify code) must apply `IsBlocked` with a table-driven test (T-05-12); only sign-in is covered here.
- `EditVersion`, `CreatedById`/`UpdatedById`, `PendingEmail`, `ManagerLockedAtUtc` and `DeletedAtUtc` exist but nothing writes them yet except CreatedAtUtc on create; the roster and profile plans do that.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-17*

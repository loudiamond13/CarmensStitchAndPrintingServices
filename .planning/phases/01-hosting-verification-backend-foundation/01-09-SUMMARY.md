---
phase: 01-hosting-verification-backend-foundation
plan: 09
subsystem: database
tags: [audit-log, append-only, sql-trigger, ef-core, interceptor, respawn, fnd-10]

requires:
  - phase: 01-05
    provides: AuditEntry domain entity with IpPrefix/UserAgentFamily minimization
  - phase: 01-07
    provides: IRequestContext port (HttpRequestContext in Server)
  - phase: 01-04
    provides: CspsDatabase fixture with Respawn, MigrationScriptTests (idempotent script at 160/170)
  - phase: 01-03
    provides: CspsDbContext, CspsDbContextOptions.Configure, InitialCreate migration
provides:
  - IAuditTrail port (Application) and AuditTrail (Infrastructure, scoped)
  - dbo.AuditLog table with IX_AuditLog_OccurredAtUtc (AddAuditLog migration)
  - TR_AuditLog_AppendOnly trigger (UPDATE -> 51000, DELETE -> 51001, 8-month purge exception)
  - dbo.AuditLogTruncateGuard (FK blocks TRUNCATE)
  - AuditLogAppendOnlyInterceptor on every context
  - docs/operations/audit-log.md with the D-32 purge recipe
affects: [phase-4-auth-audit-events, hardening-phase-purge-job, phase-3-first-deploy]

actuals:
  tokens: 15900
  tasks: 3
  commits: 4
plan_head_before: bd45b1617b5861c6e8b083ffbbdfe62498a209d0
plan_head_after: 6e2fea2a4468497a75bd00d33afa803e14c36d59

tech-stack:
  added: []
  patterns:
    - "Append-only table: AFTER UPDATE, DELETE trigger with THROW, plus an empty FK guard table against TRUNCATE"
    - "Trigger DDL in migrations goes inside EXEC(N'...') after CreateTable (idempotent-script safe)"
    - "Triggered tables map with HasTrigger + UseSqlOutputClause(false)"
    - "Cross-cutting EF interceptors register once in CspsDbContextOptions.Configure"
    - "Audit tests find rows by a fresh correlation id; Respawn never resets audit tables"

key-files:
  created:
    - src/Csps.Application/Ports/IAuditTrail.cs
    - src/Csps.Infrastructure/Auditing/AuditTrail.cs
    - src/Csps.Infrastructure/Auditing/AuditLogAppendOnlyInterceptor.cs
    - src/Csps.Infrastructure/Persistence/Configurations/AuditEntryConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261007165906_AddAuditLog.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261007165906_AddAuditLog.Designer.cs
    - tests/Csps.Infrastructure.IntegrationTests/Auditing/FixedRequestContext.cs
    - tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogSql.cs
    - tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditTrailTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs
    - docs/operations/audit-log.md
  modified:
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContextOptions.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - tests/Csps.Testing/CspsDatabase.cs
    - tests/Csps.Infrastructure.IntegrationTests/Content/SiteSettingsReaderTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Time/BusinessCalendarTests.cs

key-decisions:
  - "D-25 checkpoint resolved as option-a with 8-month retention (owner, 2026-10-07, D-32): the trigger refuses every UPDATE (51000) and DELETE (51001) except a DELETE on a connection with the read-only session flag csps.audit_purge = 1 where every deleted row is older than DATEADD(month, -8, SYSUTCDATETIME())"
  - "A purge statement that mixes old and recent rows is refused as a whole (NOT EXISTS over deleted)"
  - "AddInfrastructure now requires the host to register IRequestContext (AuditTrail depends on it); plain-ServiceCollection callers must add one"
  - "CorrelationId stored as varchar(32), not char(32): research Pattern 9 states varchar(32)"

patterns-established:
  - "Append-only enforcement in three layers: DB trigger, FK truncate guard, EF SaveChanges interceptor"
  - "Purge recipe: dedicated Pooling=false connection, sp_set_session_context read-only flag, DELETE TOP (500) batches"

requirements-completed: [FND-10]

coverage:
  - id: D1
    description: "IAuditTrail.AppendAsync stores one minimized row (UTC time, actor, action, target, /24 prefix, UA family, correlation id)"
    requirement: FND-10
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditTrailTests.cs#AppendWritesMinimizedRow"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs#StoresNoRawIpOrUserAgent"
        status: pass
    human_judgment: false
  - id: D2
    description: "Raw UPDATE fails with 51000 and raw DELETE with 51001 at the database; rows unchanged"
    requirement: FND-10
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditTrailTests.cs#RawUpdateIsRejected"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditTrailTests.cs#RawDeleteIsRejected"
        status: pass
    human_judgment: false
  - id: D3
    description: "TRUNCATE refused by the AuditLogTruncateGuard foreign key; trigger exists, is enabled and is AFTER UPDATE, DELETE"
    requirement: FND-10
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs#TruncateIsRejected"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs#TriggerIsEnabled"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-32 purge path: flagged non-pooled connection deletes a 9-month-old row; today's row, a row just inside 8 months and a mixed statement are refused; no flag refuses everything"
    requirement: FND-10
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs#PurgeFlagDeletesOnlyOldRows"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs#PurgeFlagRefusesRowJustInsideEightMonths"
        status: pass
    human_judgment: false
  - id: D5
    description: "EF refuses Modified/Deleted AuditEntry with InvalidOperationException before SQL (async and sync SaveChanges)"
    requirement: FND-10
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs#EfModifyIsRejectedBeforeSql"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs#EfRemoveIsRejectedBeforeSql"
        status: pass
    human_judgment: false
  - id: D6
    description: "Respawn resets leave AuditLog alone; idempotent migration script with the trigger still applies twice at 160 and 170"
    requirement: FND-10
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs#ResetLeavesAuditLogAlone"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs#IdempotentScriptAppliesTwice"
        status: pass
    human_judgment: false
  - id: D7
    description: "docs/operations/audit-log.md explains the design, residual db_owner risk and the 8-month purge recipe in plain words for the owner"
    requirement: FND-10
    verification: []
    human_judgment: true
    rationale: "Plain-language clarity for a non-technical owner is a judgment call; the greps only prove the key phrases exist"

duration: 15min
completed: 2026-10-07
status: complete
---

# Phase 1 Plan 09: Append-only Audit Log Summary

**`dbo.AuditLog` behind `IAuditTrail`, with an AFTER UPDATE/DELETE trigger (51000/51001), a foreign-key guard that blocks TRUNCATE, and an EF SaveChanges interceptor. The owner-approved D-32 purge path deletes only rows older than 8 months, and only on a connection carrying the read-only `csps.audit_purge` flag.**

## Performance

- **Duration:** 15 min (continuation agent; the D-25 checkpoint wait is not counted)
- **Started:** 2026-10-07T16:52:54Z
- **Completed:** 2026-10-07T17:07:39Z
- **Tasks:** 3 (Task 1 was the owner decision; Tasks 2 and 3 were built)
- **Files modified:** 18

## D-25 Decision (Task 1)

- **Answer (owner, 2026-10-07):** "Entries older than 8 mos can be deleted."
- **Applied as:** option-a with an 8-month threshold instead of 2 years. It is recorded as **D-32** in 01-CONTEXT.md, and D-25 is amended to 8-month retention (commit `bd45b16`, made before this agent started).
- **Mechanism:**
  - The trigger refuses every UPDATE (51000) and every DELETE (51001).
  - The one exception is a DELETE on a connection that set `csps.audit_purge = 1` as read-only, where every deleted row has `OccurredAtUtc < DATEADD(month, -8, SYSUTCDATETIME())`.
  - Rows younger than 8 months can never be deleted, and no row can ever be edited.
  - TRUNCATE stays blocked by the guard table.
- **Supersedes:** the "2-year audit retention" in `CLAUDE.md` for this work. CLAUDE.md was not edited, as instructed.
- **Also recorded in:** `docs/operations/audit-log.md`, "Owner decision (D-25, D-32)".

## Accomplishments

- **`IAuditTrail.AppendAsync`:**
  - Writes one row through `AuditEntry.Create`, using `TimeProvider` and `IRequestContext`.
  - Stores only the /24 prefix and the browser family. The raw IP and User-Agent are never stored, and are not logged.
- **`AddAuditLog` migration:**
  - The `AuditLog` table and the `IX_AuditLog_OccurredAtUtc` index.
  - The empty `AuditLogTruncateGuard` table with `FK_AuditLogTruncateGuard_AuditLog`.
  - `TR_AuditLog_AppendOnly`, created inside `EXEC(N'...')` after `CreateTable`.
  - The idempotent script still applies twice at levels 160 and 170.
- **EF:**
  - `AuditEntryConfiguration` uses `HasTrigger` and `UseSqlOutputClause(false)`, so inserts work despite the trigger.
  - `AuditLogAppendOnlyInterceptor` is registered once in `CspsDbContextOptions.Configure`.
- **Purge path:**
  - Proven at the boundary: a 9-month-old row can be purged.
  - Today's row, a row at 8 months minus 1 day, and a statement mixing old and recent rows are all refused, even with the flag.
- **`CSPS_Dev`** is migrated to AddAuditLog, and the trigger is enabled (`is_disabled = 0`).

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2 (tracer) | `6b69216` | `9d3aecb` | none needed |
| 3 | `d9a3ba0` | `6e2fea2` | none needed |

- **Task 2 RED:**
  - Command: `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*AuditTrailTests" --report-xunit-junit`, exit 2.
  - All 3 tests failed on Shouldly assertions. `rows.Count` should be 1 but was 0, because `AuditTrail` saved nothing; the table already existed from the generated migration.
  - Target `...AuditTrailTests.AppendWritesMinimizedRow`: `gsd check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed).
- **Task 2 GREEN:** AuditTrailTests 3/3 and MigrationScriptTests 6/6.
  - Tracer feedback gate (interactive, end-of-phase, automated-only verify): re-ran both commands on the committed code, both passed, then expanded.
- **Task 3 RED:**
  - Command: `--filter-class "*AuditLogAppendOnlyTests"`, exit 2, with 3 of 8 failing.
  - `EfModifyIsRejectedBeforeSql` should have thrown `InvalidOperationException` but threw `DbUpdateException`, meaning the trigger's 51000 reached SQL. `EfRemoveIsRejectedBeforeSql` failed the same way.
  - `ResetLeavesAuditLogAlone` failed because Respawn threw "No tables found" (see deviations).
  - Target `...AuditLogAppendOnlyTests.EfModifyIsRejectedBeforeSql`: `RED_EVIDENCE_OK`.
  - The other 5 tests were already green from the tracer: truncate, trigger enabled, purge, boundary, and no raw IP/UA.
- **Task 3 GREEN:** AuditLog* 8/8, Infrastructure 99/99.

## Task Commits

1. **Task 1: D-25 owner decision.** No code. The decision was recorded by the orchestrator in `bd45b16` (CONTEXT D-32 and the plan thresholds). This agent recorded it in the docs commit `6e2fea2` and in this SUMMARY.
2. **Task 2: Tracer, IAuditTrail plus DB-level UPDATE/DELETE rejection.** `6b69216` (test), `9d3aecb` (feat).
3. **Task 3: TRUNCATE guard, purge semantics, EF interceptor, trigger-enabled check, operations note.** `d9a3ba0` (test), `6e2fea2` (feat).

## Files Created/Modified

- `src/Csps.Application/Ports/IAuditTrail.cs`: the append-only audit port, with plain parameters.
- `src/Csps.Infrastructure/Auditing/AuditTrail.cs`: builds and saves a minimized `AuditEntry`.
- `src/Csps.Infrastructure/Auditing/AuditLogAppendOnlyInterceptor.cs`: refuses Modified or Deleted audit entries before SQL.
- `src/Csps.Infrastructure/Persistence/Configurations/AuditEntryConfiguration.cs`: the AuditLog mapping, trigger-aware with no OUTPUT clause.
- `src/Csps.Infrastructure/Persistence/Migrations/20261007165906_AddAuditLog*.cs`: the table, index, guard table and trigger.
- `src/Csps.Infrastructure/Persistence/CspsDbContext.cs`: adds the `AuditLog` DbSet.
- `src/Csps.Infrastructure/Persistence/CspsDbContextOptions.cs`: `AddInterceptors`.
- `src/Csps.Infrastructure/DependencyInjection.cs`: registers `IAuditTrail` as scoped.
- `tests/Csps.Testing/CspsDatabase.cs`: the Respawn ignore list now includes the audit tables, plus an early return when nothing is resettable.
- `tests/Csps.Infrastructure.IntegrationTests/Auditing/*`: `FixedRequestContext`, `AuditLogSql` helper, `AuditTrailTests` (3), `AuditLogAppendOnlyTests` (8).
- `tests/.../Content/SiteSettingsReaderTests.cs` and `tests/.../Time/BusinessCalendarTests.cs`: register an `IRequestContext`.
- `docs/operations/audit-log.md`: the decision, the design, residual risk and the purge recipe.

## Decisions Made

- **D-32 option-a, 8 months:** see the decision section above.
- **Mixed purge statements fail as a whole.** The trigger uses `NOT EXISTS` over every deleted row, so the purge must filter by date. A purge can never "accidentally" sweep recent rows.
- **AddInfrastructure depends on a host-registered IRequestContext.** The Server already registers one (plan 07). Test and tool callers that use a plain ServiceCollection must add one. The doc comment on `AddInfrastructure` says so.
- **CorrelationId is `varchar(32)`.** The plan said "varchar(32) (non-Unicode, fixed)". I kept varchar, not char(32), matching research Pattern 9. The value is always exactly 32 characters anyway.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Respawn throws "No tables found" when only ignored tables exist**
- **Found during:** Task 3 RED (`ResetLeavesAuditLogAlone`).
- **Issue:** after adding AuditLog and AuditLogTruncateGuard to `TablesToIgnore`, a freshly migrated test database has no resettable table. `Respawner.CreateAsync` then throws `InvalidOperationException`, so `CspsDatabase.ResetAsync` failed on any class that had not created its own table.
- **Fix:** `ResetAsync` first checks `sys.tables` for any table not on the ignore list, using parameterized names. If there is none, it returns without building or caching the Respawner, so a table created later is still picked up. The ignore list became a single `IgnoredTables` array used by both the check and Respawn.
- **Files modified:** `tests/Csps.Testing/CspsDatabase.cs`
- **Verification:** `ResetLeavesAuditLogAlone` passes; Infrastructure 99/99; solution 489/489.
- **Committed in:** `6e2fea2`

**2. [Rule 3 - Blocking] Existing DI tests failed ValidateOnBuild once IAuditTrail was registered**
- **Found during:** Task 2, before the RED run.
- **Issue:** `SiteSettingsReaderTests` and `BusinessCalendarTests` build `AddInfrastructure` on a plain `ServiceCollection` with `ValidateOnBuild = true`. They had no `IRequestContext`, which `AuditTrail` needs.
- **Fix:** both register `new FixedRequestContext()` as `IRequestContext`, the same way the Server registers `HttpRequestContext`.
- **Files modified:** the two test files. Both were outside the plan's file list.
- **Committed in:** `6b69216`

**3. [Rule 2 - Missing critical] Extra test and helper beyond the plan's list**
- **Added:**
  - `PurgeFlagRefusesRowJustInsideEightMonths`, the boundary the orchestrator asked for. A row at 8 months minus 1 day is refused even with the flag, and a statement mixing an old and a recent row is refused as a whole.
  - `EfRemoveIsRejectedBeforeSql` as its own test, covering the synchronous `SaveChanges` path.
  - `TriggerIsEnabled` also asserts that the trigger is an AFTER trigger on exactly DELETE and UPDATE.
  - `AuditLogSql.cs`, a shared raw-SQL and DI-composition helper that is not in the plan's file list.
- **Committed in:** `6b69216`, `d9a3ba0`

---

**Total deviations:** 3 auto-fixed (1 Rule 1, 1 Rule 2, 1 Rule 3).
**Impact on plan:** all three were needed for a working fixture or the requested boundary coverage. No scope creep and no new packages.

## Issues Encountered

- **Hung helper process (my own):** a `python -` heredoc combined with `< /dev/null` dropped Python into an interactive REPL error loop.
  - I confirmed by command line, parent bash and start time that it was mine (PID 1744), and stopped only that process.
  - It had modified no files. Its oversized output file was deleted, and the edits were redone with the Edit tool.
  - No other project's processes were touched.
- **Respawn "No tables found":** see deviation 1.
- **Test runs:** every run was gated on a clean preflight. TheBETSLLC held no ports and ran no test processes. Only `(localdb)\CSPS` was used, and no `CSPS_Test_` databases were left behind.

## Verification

- `dotnet build Csps.slnx -tl:off`: 0 warnings, 0 errors.
- `dotnet test --solution Csps.slnx`: 489/489 passed.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- `dotnet ef database update`: `CSPS_Dev` now has `20261007165906_AddAuditLog`, `TR_AuditLog_AppendOnly` with is_disabled 0, and both tables.
- Acceptance greps for Tasks 2 and 3: all pass.

## Threat Model Coverage

- **T-01-32 (repudiation):** the trigger, the truncate-guard FK, the EF interceptor and the trigger-enabled test are all in place and tested.
- **T-01-33 (tampering with the trigger):** accepted residual risk (a db_owner can disable the trigger or drop the guard). It is documented in `docs/operations/audit-log.md`, with a manual `sys.triggers` check until the hardening-phase runtime check exists.
- **T-01-34 (information disclosure):** only ids, the /24 prefix and the UA family are stored, and Detail is capped at 400 characters. `StoresNoRawIpOrUserAgent` proves no raw IP or UA in any column.
- **T-01-SC (supply chain):** no packages were added.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **Phase 4** can write sign-in and other events through `IAuditTrail` (AUDIT-01 adds the action catalog).
- **Hardening phase:**
  - Build the purge endpoint from the recipe in `docs/operations/audit-log.md`.
  - Add the runtime trigger-enabled check to `/health` or the maintenance job.
- **Phase 3 first deploy:** the trigger's behavior on the SmarterASP.NET host is verified only when that deployment applies the migration (Edge Coverage flagged assumption, D-28).

---
*Phase: 01-hosting-verification-backend-foundation*
*Completed: 2026-10-07*

## Self-Check: PASSED

- All 11 created files exist on disk.
- Commits 6b69216, 9d3aecb, d9a3ba0, 6e2fea2 (and the decision commit bd45b16) are in git history.

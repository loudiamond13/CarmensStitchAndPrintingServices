---
phase: 06-company-expenses
plan: 11
subsystem: testing
tags: [dev-seed, architecture-test, no-inline-sql, ef-core]
created: "2026-10-25T08:13:00-05:00"
updated: "2026-10-25T08:13:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: CompanyExpense aggregate and the CompanyExpenses table (plan 06-02), the ten seeded categories (plan 06-01)
provides:
  - CompanyExpensesSeedStep (Order 300) in DevSeedSteps.All, which fills an empty CompanyExpenses table with 64 demo rows for CSPS_Dev and CSPS_E2E
  - NoInlineSqlTests, an architecture guard that fails on raw SQL entry points in src outside migrations and three named files
  - An Owner backlog item asking the owner to approve the three lock files by name or have them reworked
affects: [06-04, 06-10, phase-07-orders]

actuals:
  tokens: 6400
  tasks: 2
  commits: 4
plan_head_before: 43f7705e9df4d7ebf26e84406b32eb4f09507991
plan_head_after: 454797d81718155bf0db7b1d3f225c5984e4264b

tech-stack:
  added: []
  patterns:
    - "Seed step derives every row from its index (no Random), so empty databases get the same demo data"
    - "Source-scan architecture test with synthetic violation cases and a stale allow-list check"

key-files:
  created:
    - src/Csps.Infrastructure/Seeding/CompanyExpensesSeedStep.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/CompanyExpensesSeedStepTests.cs
    - tests/Csps.ArchitectureTests/NoInlineSqlTests.cs
  modified:
    - src/Csps.Infrastructure/Seeding/DevSeedSteps.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs
    - docs/development.md
    - .planning/STATE.md

key-decisions:
  - "Demo rows come from an index-based formula instead of System.Random, so the output is the same on every empty database and no insecure-random analyzer is involved"
  - "Demo descriptions are generic (Electric bill, Staff government contributions) and name no real business"
  - "The skip note for a database with no eligible staff is printed by the step itself, because the seed command prints only changed or unchanged"

patterns-established:
  - "Allow-list entries in a source-scan test must still match, or the test fails as stale"

requirements-completed: [CEXP-01, PERF-04]

coverage:
  - id: D1
    description: "A developer who runs the dev seed gets 60 past and 4 upcoming demo expenses over all ten seeded categories, paid and recorded by active staff with a password, only on an empty expenses table"
    requirement: CEXP-01
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/CompanyExpensesSeedStepTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "A build fails if application code adds raw SQL outside migrations and the three reviewed lock files"
    requirement: PERF-04
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/NoInlineSqlTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "The owner decides whether the three existing inline SQL lock files are approved by name or reworked"
    verification: []
    human_judgment: true
    rationale: "Owner rule: inline SQL needs approval by name; parked in the STATE.md Owner backlog, never auto-approved"

duration: 8min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 11: Dev seed and no-inline-SQL guard Summary

**Index-derived demo company expenses for CSPS_Dev (64 rows, ten categories, paid by real local staff) and an architecture test that fails on any new raw SQL in src, with the three existing lock files parked for the owner.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-25T13:04:00Z
- **Completed:** 2026-10-25T13:12:00Z
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 7

## Accomplishments

- `CompanyExpensesSeedStep` (Order 300, "CompanyExpenses") writes nothing when any expense exists (soft-deleted ones count), prints a note and skips when no active Admin or Manager with a password exists, and never creates accounts or categories. With staff present it adds 60 expenses dated 60 days back to today and 4 dated 1 to 30 days ahead (business today in Asia/Manila), one description per category, fake amounts from 150.00 to 25,000.00, payer and recorder from the eligible staff.
- The step is in `DevSeedSteps.All`; the existing target guard (CSPS_Dev or CSPS_E2E only) is untouched, and nothing seeds at API start-up.
- `NoInlineSqlTests` scans every `*.cs` under `src/` for `ExecuteSql`, `FromSql`, `SqlQuery`, `CommandText`, `new SqlCommand`, `ExecuteNonQuery` and `ExecuteScalar`. It skips bin, obj and `Persistence/Migrations`, allows exactly `IdempotencyGate.cs`, `AccountTokenStore.cs` and `ManagerRosterLock.cs`, flags synthetic violations, and fails if an allowed file no longer holds a token.
- The owner question about the three lock files is in the STATE.md Owner backlog, worded as the plan specified, recommended option first.

## Task Commits

1. **Task 1: Tracer, dev seed for company expenses**
   - RED `e509448` (test)
   - GREEN `4a8a934` (feat)
2. **Task 2: Architecture guard against inline SQL**
   - RED `3464feb` (test)
   - GREEN `454797d` (feat)

**Plan metadata:** the `docs(06-11)` commit that follows this file.

### TDD gate compliance

RED then GREEN pairs exist for both tasks. No REFACTOR commits were needed.

RED evidence and semantic assessment (the formal `tdd-red-evidence` classifier does not read MTP console output or compile errors, as noted in 06-02, so the quoted run is the evidence):

- **Task 1:** `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CompanyExpensesSeedStepTests"` failed to build with `error CS0246: The type or namespace name 'CompanyExpensesSeedStep' could not be found` (two sites, nothing else). Semantic assessment: the only failure is the missing type this task adds, so GREEN was not authorized by an unrelated fault. After GREEN, 6 of 6 pass.
- **Task 2:** the Architecture test project failed to build with `CS0103` for `SourceFiles`, `RelativePath`, `AllowedFiles`, `Offences` and `IsScanned`, the scanner members GREEN adds. The scanner lives inside the test class by the plan, so a compile failure was the only honest RED. After GREEN, 22 of 22 pass.

## Verification evidence

- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CompanyExpensesSeedStepTests"`: "Test run summary: Passed! total: 6 failed: 0 succeeded: 6".
- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*DevSeederTests"`: "total: 6 failed: 0 succeeded: 6".
- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*NoInlineSqlTests"`: "total: 22 failed: 0 succeeded: 22".
- `dotnet test --project tests/Csps.ArchitectureTests`: "total: 239 failed: 0 succeeded: 239".
- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests`: "total: 543 failed: 0 succeeded: 542 skipped: 1" (the skip existed before this plan).
- `dotnet build Csps.slnx -tl:off`: "0 Warning(s) 0 Error(s)". `dotnet format --verify-no-changes` on the new files printed nothing.
- Acceptance greps: `CompanyExpensesSeedStep` in `DevSeedSteps.cs` 1; `Order => 300` 1; "demo company expenses" in `docs/development.md` 1; the three file names in `NoInlineSqlTests.cs` on 4 lines; `Migrations` on 5 lines; the backlog item in STATE.md 1.
- Tracer gate: both Task 1 `<verify>` commands are automated only; they passed end to end after GREEN, so expansion went ahead.
- gitleaks ran in the pre-commit hook on all four commits: "no leaks found".

## Decisions Made

- The demo rows are derived from the row number, not `System.Random`. This avoids the insecure-random analyzer, and keeps the output identical on any empty database.
- Descriptions are generic (for example "Electric bill", "Staff government contributions"), not the brand or agency names the plan listed as examples, so no real business appears in demo data.
- The step prints its own skip note, since the seed command only prints "changed" or "unchanged".
- The scanner skips lines that are only comments, so documentation can name the banned calls; code with a trailing comment is still checked.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `DevSeederTests` assumed `DevSeedSteps.All` has one step**
- **Found during:** Task 1 (GREEN)
- **Issue:** the tests used `results.ShouldHaveSingleItem()` over `DevSeedSteps.All`. Adding the second step would break them, and they are about the SiteSettings step only.
- **Fix:** `RunSeedAsync` now runs only the step named "SiteSettings" from `DevSeedSteps.All`.
- **Files modified:** `tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs`
- **Verification:** `*DevSeederTests` 6 of 6 pass.
- **Committed in:** `4a8a934`

### Plan wording notes

- The plan said to use "a fixed-seed Random" and listed descriptions naming real organizations. Both were replaced as described under Decisions Made. Behavior covered by the plan (counts, date ranges, amount range, ten categories) is unchanged.
- The plan said the seed sets CreatedById and CreatedAtUtc through entry properties. That works here because a context built by `CspsDbContextOptions.Configure` has no stamp interceptor (only the DI container adds it). The code comment says so.

---

**Total deviations:** 1 auto-fixed (1 Rule 3)
**Impact on plan:** No scope change.

## Issues Encountered

- The first preflight call failed because the Windows path lost its backslashes inside a bash command; it passed with forward slashes. No state was affected.

## Known Stubs

None. Every demo value is invented on purpose and only written to CSPS_Dev or CSPS_E2E by the explicit seed command.

## Threat Flags

None. T-06-35 (demo data in the wrong database) is covered by the unchanged `DevSeedTargetGuard`, and the step never creates accounts. T-06-36 (hand-written SQL) is covered by `NoInlineSqlTests`.

## User Setup Required

None - no external service configuration required.

## Owner items

- **Inline SQL in three existing files:** parked in the STATE.md Owner backlog (approve `IdempotencyGate.cs`, `AccountTokenStore.cs` and `ManagerRosterLock.cs` by name, or rework them). Until the owner answers, the allow-list holds exactly those three and no new file can be added. Nothing was auto-approved.

## Next Phase Readiness

- A developer can run `dotnet run --project tools/Csps.DevSeed` after creating a first Manager to get a realistic local expense list for the web plans and the owner review.
- Phase 7 inherits the no-inline-SQL guard.

## Self-Check: PASSED

All created files exist on disk (`CompanyExpensesSeedStep.cs`, `CompanyExpensesSeedStepTests.cs`, `NoInlineSqlTests.cs`); the four task commits (`e509448`, `4a8a934`, `3464feb`, `454797d`) are ancestors of HEAD; the test runs above passed.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*

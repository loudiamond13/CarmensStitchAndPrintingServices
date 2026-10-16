---
phase: 03-ci-cd-staging-deploy
plan: 19
subsystem: cutover-database
tags: [d-18, d-03, sql-server-2025, compatibility-level, checkpoint, one-way]
created: "2026-10-16T18:31:51-05:00"
updated: "2026-10-16T18:31:51-05:00"
status: complete

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-18: legacy backup proven, receipt in _local"
provides:
  - "Owner decision confirmed-go on the receipt (17 tables, 988 rows)"
  - "Legacy host database deleted (preserved only in the .bak); new SQL Server 2025 database db_…_cspsdb (17.0.4025.3, level 170, SQL_Latin1_General_CP1_CI_AS)"
  - "HOSTING-RECORD Facts row CSPS production database; legacy row marked retired"
  - "SqlCompatibility.Level re-pinned 160 to 170"
affects: [03-20, 03-21, persistence]

actuals:
  tasks: 3
  commits: 1
plan_head_before: c12db58d364f785331510ba312042f4165f8fb64
plan_head_after: 98b3013c08916a18a72416f677ccb509b320db27

key-files:
  created: []
  modified:
    - .planning/HOSTING-RECORD.md
    - .planning/phases/03-ci-cd-staging-deploy/03-CUTOVER-LOG.md
    - src/Csps.Infrastructure/Persistence/SqlCompatibility.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs
---

# Phase 3 Plan 19: Point of no return

- **Task 1 (owner):** the owner replied confirmed-go after reviewing the receipt table.
- **Task 2 (owner):** the owner deleted the legacy database and created the SQL Server 2025 database. @@VERSION reports SQL Server 2025 (RTM-CU3) 17.0.4025.3, Standard Edition, with compatibility level 170 and collation SQL_Latin1_General_CP1_CI_AS. The database name is masked as `db_…_cspsdb`.
- **Task 3:** the database facts are recorded and the level is pinned to 170.
  - HostingRecordTests: 4 passed.
  - LocalDB is the same build, 17.0.4025.3. The Infrastructure integration suite passed with 415 run and 1 skipped. The full .NET suite passed with 2247 tests, and the build has 0 warnings.
  - **Deviation:** `MigrationScriptTests.IdempotentScriptAppliesTwice` had `InlineData(SqlCompatibility.Level)` and `InlineData(170)`. These became duplicates (xUnit1025), so the second was removed.
- **Follow-up:** the runbook lands the re-pin on main through a PR with green CI, so steps 6 and 7 deploy a package built at level 170.
- **Not yet confirmed:** whether the owner created the lower-rights SQL user (runbook step 3.4). Step 4 needs its user name and password in the host settings.

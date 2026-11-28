---
phase: 14-hardening-release-readiness
plan: 08
subsystem: operations
tags: [backup, restore-drill, sec-05, powershell, runbook]
created: "2026-11-27T21:11:00-06:00"
updated: "2026-11-27T21:11:00-06:00"
status: complete
requires: []
provides:
  - "tools/scripts/Restore-BackupDrill.ps1: restores a .bak from _local only into CSPS_RestoreDrill, verifies first, runs DBCC CHECKDB, writes a metadata-only receipt with Match/Mismatch lines; -Drop removes the copy"
  - "docs/operations/backup-restore.md: six-section owner runbook, from the control-panel backup to dropping the checked copy"
  - "RestoreDrillScriptTests: fixed targets, local-only, order of checks, metadata-only reads, runbook sections and safety phrases"
affects: [14-10, 14-17]
actuals:
  tokens: 10500
  tasks: 2
  commits: 2
plan_head_before: 1da702e25f8170db2643037a98f2c00186e19c31
plan_head_after: 1d990a831a898871393c9cab9b33818352e09749
tech-stack:
  added: []
  patterns:
    - "Tool script copied from Restore-LegacyReceipt.ps1 with parameter sets (Restore and Drop) and a text test that reads its code with comments removed"
key-files:
  created:
    - tools/scripts/Restore-BackupDrill.ps1
    - tests/Csps.ArchitectureTests/RestoreDrillScriptTests.cs
    - docs/operations/backup-restore.md
  modified: []
key-decisions:
  - "No new ruling. Applied 14 D-07 and D-40 as ruled (drill DB name CSPS_RestoreDrill was Claude's discretion)."
requirements-completed: []
coverage:
  - id: D1
    description: "The drill script can only restore into CSPS_RestoreDrill on the default LocalDB instance, from a .bak inside _local, and drops nothing else"
    requirement: SEC-05
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.ArchitectureTests --filter-class *RestoreDrillScriptTests"
        status: pass
  - id: D2
    description: "The backup is read and verified before any drop or restore, DBCC CHECKDB runs after, and the receipt reads only catalog views plus the latest migration id"
    requirement: SEC-05
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.ArchitectureTests --filter-class *RestoreDrillScriptTests"
        status: pass
  - id: D3
    description: "The runbook keeps the drill copy from sending mail (smtp.invalid, dev certificate, no sign-in) and holds no secret or personal detail"
    requirement: SEC-05
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.ArchitectureTests --filter-class *RestoreDrillScriptTests"
        status: pass
  - id: D4
    description: "The script really restores, checks and drops on a real backup"
    requirement: SEC-05
    verification:
      - kind: other
        ref: "not run here by design: the owner runs the drill in plan 14-17"
        status: pending
---

# Phase 14 Plan 08: The backup restore drill has a guarded script and a runbook Summary

*Created: 2026-11-27T21:11:00-06:00 · Updated: 2026-11-27T21:11:00-06:00*

**A PowerShell script restores a hosting backup into one throwaway database on this PC, checks it and writes a metadata-only receipt. A runbook walks the owner through it.**

## What was built

- **`Restore-BackupDrill.ps1`** (Windows PowerShell 5.1) copies the proven `Restore-LegacyReceipt.ps1` pattern.
  - The server `(localdb)\MSSQLLocalDB` and the database `CSPS_RestoreDrill` are fixed in the script. They are not parameters.
  - Parameters: `-BakPath`, `-Replace`, `-ReceiptPath`, `-ExpectedOrders`, `-ExpectedUsers`, `-ExpectedQuoteRequests`, `-ExpectedMigration` (the restore set), and `-Drop` (its own set, so it cannot be mixed with a restore).
  - The `.bak` must be a `.bak` inside `_local` and not a link. This is refused before any connection opens. A receipt path inside the repository but outside `_local` is refused too.
  - Order: file list, `RESTORE VERIFYONLY`, then the single `DROP DATABASE [CSPS_RestoreDrill]` (only with `-Replace` or `-Drop`), then `RESTORE DATABASE`, then `DBCC CHECKDB`.
  - The receipt reads `sys.tables`, `sys.schemas` and `sys.partitions` and, from the migration history, one row: the latest `MigrationId`. It adds the local server version and the copy's compatibility level, and a Match, Mismatch or Not compared line for Orders (`dbo.Orders`), Users (`dbo.AspNetUsers`), Quote Requests (`dbo.QuoteRequests`) and the last migration. The migration can be given as the full id or the name after the underscore.
  - Exit code 0 when all passed, 1 when it refused, 3 when the restore finished but a check failed or a number did not match.
- **`docs/operations/backup-restore.md`** has the six sections in order: Make the backup, Restore it on this PC, Check it, Open the app against it, Drop the copy, What stays on this PC. The app-open check runs the Development host on one terminal with `Smtp__Host` set to `smtp.invalid` and the dev certificate, checks the host starts, `/health` answers, no migration is pending (`dotnet ef migrations list`) and the sign-in page loads, and says do not sign in. It records that LocalDB on this PC and the live server are the same version (17.0.4025.3, RTM-CU3), and that backups stay manual until D-51 is decided before the Phase 17 cutover.
- **`RestoreDrillScriptTests`** (13 facts) mirror `CutoverRunbookTests` for the new script and add the runbook facts, with paired-sample secret and personal-detail detectors.

## Verification

- RED first: 9 script facts failed with "script is missing", then 4 runbook facts failed with "runbook is missing".
- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*RestoreDrillScriptTests" --filter-class "*CutoverRunbookTests"`: total 20, succeeded 20.
- Whole `Csps.ArchitectureTests` project after the runbook: total 355, succeeded 355, failed 0, no warnings in the output.
- The script parses with the PowerShell parser (0 errors). Three refusals were run and stopped before any connection: a `.bak` outside `_local` (exit 1), a file that does not end in `.bak` (exit 1), and `-Drop` together with `-BakPath` (parameter set refused).
- `dotnet ef migrations list --help` lists both `--no-connect` and `--connection`, which the runbook uses.
- gitleaks on each staged change: no leaks. No em or en dash in any new file.

## Deviations from Plan

None - plan executed exactly as written. One small test adjustment in Task 1: the DBCC test looks for the SQL with doubled quotes, because the script writes it inside a single-quoted PowerShell string.

## Not run here (by design)

The restore, `DBCC CHECKDB`, receipt and `-Drop` paths were not run, because this plan must not restore anything. No database was created or dropped, `_local/` was not opened, and no real backup was touched. Plan 14-17 is the first live run, so a small runtime slip in those paths can only show up there. The text tests prove the safety rules, not that every statement runs.

## Items for the review pack (plan 14-10)

- The first live run of the drill (plan 14-17) is the only proof the script's restore, check and receipt code runs. Recommendation: the owner runs it once on a small backup and reads the receipt before trusting it.
- The runbook asks the owner to count Orders, Users and Quote Requests in the live admin. I did not check which screens give a total without a filter, and whether the Users list includes deactivated people (the script counts every account). Recommendation: the owner confirms the counting rule on the first run and the runbook is tightened with the real screen names then.

## Known Stubs

None.

## Threat Flags

None. The script and runbook add no network surface.

## Self-Check: PASSED

- FOUND: tools/scripts/Restore-BackupDrill.ps1
- FOUND: tests/Csps.ArchitectureTests/RestoreDrillScriptTests.cs
- FOUND: docs/operations/backup-restore.md
- FOUND commits: eb1572b7, 1d990a83

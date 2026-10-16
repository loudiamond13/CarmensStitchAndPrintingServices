---
phase: 03-ci-cd-staging-deploy
plan: 14
subsystem: cutover
tags: [cutover, runbook, legacy-restore, receipt, powershell, localdb, ops-04, d-04, d-05, d-18, tdd, tracer]
created: "2026-10-16T08:22:00-05:00"
updated: "2026-10-16T08:22:00-05:00"

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-06 deploy.mjs and the hostprobe action; 03-12 docs/operations/deploy.md and the Deploy workflow; 03-13 the csps-package-<sha> artifact with csps-migrations.sql; the owner's control-panel answers of 2026-10-16"
provides:
  - "tools/scripts/Restore-LegacyReceipt.ps1: -BakPath (inside _local, .bak only) [-Replace] [-ReceiptPath]; fixed target (localdb)\\MSSQLLocalDB and CSPS_Legacy_Restore; writes a names-and-counts receipt with the .bak file name, size and SHA-256"
  - "docs/operations/cutover-runbook.md: the eight D-18 steps, each with Who, What to do, Paste back, Claude checks and Stop if; the rollback kit; the least-privilege SQL login note"
  - "tests/Csps.ArchitectureTests/CutoverRunbookTests.cs: 9 facts"
affects: [03-15, 03-18, 03-19, 03-20, 03-21, 03-22]

actuals:
  tokens: 13100
  tasks: 3
  commits: 4
plan_head_before: 83c1b4b37d3d20e0e896b79aab4be675ad435a03
plan_head_after: ea1aa6a11b4caad5dc1e4bfc30bf8262bc2de5a4

tech-stack:
  added: []
  patterns:
    - "A PowerShell script whose every argument refusal runs before any connection, tested by text facts (the order is asserted by string position) plus real guard runs"
    - "Runbook doc-lint: the step sections are cut out by heading, each checked for its five labels; host-setting names are checked against the options classes in src/ (section constant and property name), so a renamed setting breaks the test"

key-files:
  created:
    - tools/scripts/Restore-LegacyReceipt.ps1
    - docs/operations/cutover-runbook.md
    - tests/Csps.ArchitectureTests/CutoverRunbookTests.cs
  modified: []

key-decisions:
  - "The app connects as an extra database user with db_datareader and db_datawriter only; the owner's main db_owner login in SSMS applies the migration script (PRD 19.2 answered: yes). Fallback is the main login, recorded as an accepted risk."
  - "The pool switch (Change to .Net Core, 64-bit, Load User Profile) is the first action of runbook Step 4, after the legacy database is deleted in Step 3, and is covered by a test that forbids it in any other step. Rollback switches back to ASP.NET 4.X Integrated, 32-bit, Load User Profile disabled."
  - "The D-05 rollback kit is a plain folder in _local, put back with Web Deploy (VS Code publish with delete of extra files on), because the file manager cannot upload or unzip a zip"
  - "If the host cuts the ~5,000 character certificate value, the first fallback is a shorter RSA-2048 certificate (about 2,700 characters, no code change); reading the certificate from a file outside the site folder would be a separate change needing the owner's approval"
  - "AllowedHosts on the host is cspstailoring.com;www.cspstailoring.com, and App__PublicBaseUrl is https://cspstailoring.com"

requirements-completed: [OPS-04]

coverage:
  - id: D1
    description: "Restore-LegacyReceipt.ps1 has a fixed server and database (no parameter for either), drops only [CSPS_Legacy_Restore], queries catalog views only, and refuses a path outside _local or without .bak before any connection"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/CutoverRunbookTests.cs#ReceiptScriptHasFixedTargets, ReceiptScriptReadsMetadataOnly, ReceiptScriptKeepsTheBakLocal"
        status: pass
      - kind: command
        ref: "powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Restore-LegacyReceipt.ps1 -BakPath C:\\Windows\\Temp\\not-in-local.bak (exit 1, one plain refusal line); also _local\\notes.txt, _local\\no-such-file.bak and ..\\outside.bak (exit 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The cutover runbook has the eight ordered steps with the five labels, names every host setting and checks each against src/, links its docs, holds no secret, switches the pool only in Step 4, and names both site addresses"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/CutoverRunbookTests.cs#RunbookHasTheEightStepsInOrder, RunbookNamesEveryHostSetting, RunbookLinksItsDocs, RunbookHoldsNoSecret, RunbookSwitchesThePoolOnlyAfterTheLegacySiteIsRetired, RunbookNamesBothSiteAddresses"
        status: pass
    human_judgment: false
  - id: D3
    description: "The restore, the receipt write and the SHA-256 path of the script run end to end against a real .bak"
    requirement: OPS-04
    verification: []
    human_judgment: true
    rationale: "This plan restores nothing by design (no .bak is touched and no database is created). The script parses cleanly and every refusal path ran, but the first real restore is plan 03-18."
  - id: D4
    description: "The runbook's steps work on the real control panel and host (pool menu names, environment variable length, SSMS port, query tool and GO lines)"
    requirement: OPS-04
    verification: []
    human_judgment: true
    rationale: "These can only be proven on the cutover day by the owner; each step has a Paste back, Claude checks and Stop if line for exactly that."

duration: 15min
completed: 2026-10-16
status: complete
---

# Phase 3 Plan 14: Cutover tooling and the D-18 runbook Summary

**A guarded legacy-restore script that writes only table names and row counts (plus the .bak's name, size and SHA-256), and an eight-step cutover runbook built from the owner's control-panel answers, with the .NET Core pool switch held back until the legacy site is retired, a Web Deploy based rollback kit, and a least-privilege database user.**

## Performance

- **Duration:** about 15 min
- **Completed:** 2026-10-16
- **Tasks:** 3 (an owner checkpoint resolved by the orchestrator, a tracer, an auto task; both code tasks TDD)
- **Files modified:** 3 (all new)

## The owner's answers (Task 1, relayed by the orchestrator, 2026-10-16)

No secret was received. Masked forms are used everywhere.

1. **Remote database access:** yes, with SSMS. Server name format `sql####.site4now.net`. The port was not stated: default 1433 assumed, **unverified** (runbook Step 6 checks it).
2. **Second, lower-rights database user:** yes ("Create SQL User / Extra DB User"). Such a user cannot connect with SSMS (apps and scripts only). User name up to 32 characters, password 8 to 20 characters. Roles offered: db_datareader, db_datawriter, db_ddladmin, db_owner, db_backupoperator, db_securityadmin, db_accessadmin. Plan: the app uses an extra user with db_datareader and db_datawriter only; the owner's db_owner login in SSMS applies the migration script. The real database name is `db_…_csptailoringdb` everywhere.
3. **Web Deploy address format:** `https://win####.site4now.net:8172/MsDeploy.axd?site=csptailoring-###-site1` (placeholder form only).
4. **App-pool Environment Variables page exists** (pool menu, Configuration). The value length limit was **not checked**: runbook Step 4 makes the owner prove the ~5,000 character certificate value saves whole, with a fallback.
5. **SSL:** valid, expires in 2027 (exact date not given; Step 7 reads it).
6. **Addresses:** both `cspstailoring.com` and `www.cspstailoring.com` (AllowedHosts and the browser check name both).
7. **SSMS** is installed on the owner's PC.
8. **File manager cannot upload or unzip a .zip;** the owner can Web Deploy from VS Code. So the D-05 kit is a folder restored by Web Deploy.

Pool facts from the screenshots (pool named like `csptailoring-###`): today ASP.NET 4.x Integrated, 32-bit, Load User Profile Disabled, 256 MB, one pool and one site. The runbook switches it to .Net Core (No Managed Code), 64-bit, Load User Profile Enabled at the start of Step 4, after the legacy database is deleted in Step 3 and before the host probe and the first deploy, with a check and a rollback note.

## Accomplishments

- **Restore-LegacyReceipt.ps1** (Windows PowerShell 5.1, System.Data.SqlClient, no package): the path guard runs first (must end in `.bak`, must resolve inside the repository's `_local`, must exist, and neither the file nor `_local` may be a link), then the SHA-256, then the connection. The server `(localdb)\MSSQLLocalDB` and the database `CSPS_Legacy_Restore` are literals in the script, not parameters. An existing database stops the run unless `-Replace`, which drops only `[CSPS_Legacy_Restore]`. `RESTORE FILELISTONLY` drives the MOVE clauses into the instance's default data folder. The receipt query joins `sys.tables`, `sys.schemas` and `sys.partitions` and reads no user table.
- **Guard runs (real):** `C:\Windows\Temp\not-in-local.bak`, `..\outside.bak`, `_local\..\outside.bak`, `_local\notes.txt` and `_local\no-such-file.bak` each exit 1 with one plain line and no connection line. **No restore ran in this plan, no database was created, `_local` was never listed or read** (only a nonexistent path was probed).
- **cutover-runbook.md:** "Rules for the whole day", "Before you start", the owner's control-panel facts, Steps 1 to 8, "If something goes wrong" (legacy kit by Web Deploy with the pool switched back to ASP.NET 4.X Integrated, 32-bit, Load User Profile disabled; after acceptance, redeploy an earlier CSPS build) and "Least-privilege SQL login". Step 3 is marked the point of no return and carries the compatibility-level query verbatim; if it reports 170, Claude re-pins `SqlCompatibility.Level` and lands it on `main` before Steps 6 and 7 (D-03).
- **CutoverRunbookTests:** 9 facts (3 script, 6 runbook). `RunbookNamesEveryHostSetting` checks each environment-variable name against the `SectionName` constants and property names in `src/` and `ConnectionStringKey`, so a renamed setting fails the test.

## Task Commits

1. **Task 1 (owner checkpoint):** resolved by the orchestrator with the owner's answers above; no commit.
2. **Task 2 (tracer): receipt script**
   - RED `7f17c4e` (test) - 3 facts failed: script missing
   - GREEN `a6087b4` (feat)
3. **Task 3: runbook**
   - RED `daa7d7d` (test) - 6 facts failed: runbook missing
   - GREEN `ea1aa6a` (docs)

**Plan metadata:** the docs commit that holds this SUMMARY, STATE.md, ROADMAP.md and .planning/state.json.

## TDD Gate Compliance

RED then GREEN for both code tasks; no refactor was needed.

- Task 2 RED: `ReceiptScriptHasFixedTargets`, `ReceiptScriptReadsMetadataOnly`, `ReceiptScriptKeepsTheBakLocal` all failed with "tools/scripts/Restore-LegacyReceipt.ps1 is missing". Semantic assessment: the intended failure for a new file, not a build error.
- Task 3 RED: the six runbook facts failed with "docs/operations/cutover-runbook.md is missing". Same assessment.
- RED evidence was read by hand from the xunit.v3 Microsoft Testing Platform output.

## Files Created/Modified

- `tools/scripts/Restore-LegacyReceipt.ps1` - guarded restore and receipt
- `docs/operations/cutover-runbook.md` - the D-18 runbook
- `tests/Csps.ArchitectureTests/CutoverRunbookTests.cs` - 9 facts

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Absolute -BakPath crashed before the guard**
- **Found during:** Task 2 (the planned guard run)
- **Issue:** the first draft joined the current folder to the path, so `C:\Windows\Temp\not-in-local.bak` became an invalid path and the script printed a .NET error instead of the plain refusal.
- **Fix:** a `Get-FullPath` helper joins the current folder only to relative paths. The planned guard run now prints the one plain refusal and exits 1.
- **Files modified:** `tools/scripts/Restore-LegacyReceipt.ps1`
- **Committed in:** `a6087b4` (the bug was found and fixed before the GREEN commit)

### Additions required by the owner's answers (Rule 2)

**2. [Rule 2 - Missing critical] Two extra runbook facts**
- **Issue:** the owner's answers add rules the plan's four facts do not cover: the pool switch must happen only after the legacy site is retired, and both site addresses must be named.
- **Fix:** `RunbookSwitchesThePoolOnlyAfterTheLegacySiteIsRetired` (the phrase "Change to .Net Core" is allowed only in Step 4; Step 4 names No Managed Code, 64-bit and Load User Profile; the rollback section names Change to ASP.NET 4.X and 32-bit) and `RunbookNamesBothSiteAddresses`.
- **Committed in:** `daa7d7d`, `ea1aa6a`

**3. [Rule 2 - Missing critical] A long-encoded-value secret detector in RunbookHoldsNoSecret**
- **Issue:** the runbook handles a ~5,000 character certificate value, so a pasted certificate or key must be caught as well as the HostingRecord-style patterns.
- **Fix:** a detector for a run of 200 or more base64 characters, paired with a sample it must catch.
- **Committed in:** `daa7d7d`

---

**Total deviations:** 3 (1 bug fixed before its commit, 2 additions driven by the owner's answers)
**Impact on plan:** none on scope; the plan's own facts and acceptance criteria all hold (`grep -c "^## Step [1-8]"` is 8, `point of no return` appears, `CSPS_Legacy_Restore` appears 16 times, `sys.partitions` twice).

## Issues Encountered

None.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. T-03-52 (legacy values into git through the receipt), T-03-53 (restoring over the wrong database) and T-03-54 (the .bak leaving `_local/`) are mitigated by the script and its three text facts plus the guard runs. T-03-SC: no package was installed.

## User Setup Required

None for this plan. The runbook itself lists what the owner does on cutover day (plans 03-18 to 03-22).

## Next Phase Readiness

- **03-18 runs the real restore** and is the first proof of the restore, SHA-256 and receipt-writing code paths, which this plan could not exercise without a .bak (no database was created here). A restore of a backup from a newer SQL Server version than LocalDB will fail with a plain SQL message; if that happens, report it instead of working around it.
- Unverified until cutover day (each has a Stop if line): the SSMS port (default 1433 assumed), the environment variable value length, the exact pool menu results, whether the host's SQL certificate needs the TrustServerCertificate setting, and whether the control panel's restore page exists for the legacy rollback.
- The runbook assumes the cutover log `.planning/phases/03-ci-cd-staging-deploy/03-CUTOVER-LOG.md` that plan 03-18 creates.

## Self-Check: PASSED

- Files exist: `tools/scripts/Restore-LegacyReceipt.ps1`, `docs/operations/cutover-runbook.md`, `tests/Csps.ArchitectureTests/CutoverRunbookTests.cs`.
- Commits exist on this branch: `7f17c4e`, `a6087b4`, `daa7d7d`, `ea1aa6a`.
- `dotnet test --project tests/Csps.ArchitectureTests`: 201 of 201 pass (9 are `CutoverRunbookTests`).
- The guard run exits 1 with the plain refusal only.

---
*Phase: 03-ci-cd-staging-deploy*

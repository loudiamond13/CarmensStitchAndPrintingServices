---
phase: "09"
slug: "order-images-maintenance-jobs"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-31T10:10:00-05:00"
updated: "2026-10-31T18:55:00-05:00"
---

# Phase 9: Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The full requirement-to-test map is in `09-RESEARCH.md` under "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | .NET: xunit.v3 on Microsoft.Testing.Platform, Shouldly, NSubstitute, FakeTimeProvider. Web: Vitest + RTL + MSW 3; Playwright + axe |
| **Config file** | `global.json`, `web/vitest.config.ts`, `web/playwright.config.ts` |
| **Quick run command** | `dotnet test --project tests/<Project> --filter-class "*<Class>"` or `npm --prefix web run test -- --run <path>` |
| **Full suite command** | preflight (`powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`), then `dotnet test --solution Csps.slnx` (with `CSPS_TEST_SQL=localdb` set in that process only), `npm --prefix web run verify`, `npm --prefix web run e2e` |
| **Estimated runtime** | quick: about 30 seconds; full: about 15 minutes |

---

## Sampling Rate

- **After every task commit:** run the quick command for the class or file the task touches.
- **After every plan wave:** run the full .NET suite after preflight, plus `npm --prefix web run verify`.
- **Before `/gsd-verify-work`:** full suite, coverage gate, e2e and the manual phone and HEIC checks must be green.
- **Max feedback latency:** 60 seconds for quick runs.

---

## Per-Task Verification Map

Filled by the planner and executor from the plans. Each row maps a task to a requirement and its automated command, using the test classes named in `09-RESEARCH.md` (Validation Architecture).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-31-01 | 31 | 1 | CUT-01, JOB-01 | T-09-81, T-09-82 | One parameterised BACKUP statement in one allowed file; the probe answers facts only (D-40, D-42) | integration, unit, architecture | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*SqlServerBackupStatementTests"`; `dotnet test --project tests/Csps.HostProbe.Tests --filter-class "*BackupCheckTests"`; `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*NoInlineSqlTests"` | no, the task creates them (NoInlineSqlTests exists) | pending |
| 09-31-02 | 31 | 1 | CUT-01 | T-09-83, T-09-84 | Owner adds db_backupoperator and runs the probe from the PC; a blocked host stops the work (D-42, D-44, D-45) | manual (owner checkpoint) | `dotnet build tools/Csps.HostProbe --configuration Release` | yes | pending |
| 09-31-03 | 31 | 1 | CUT-01 | T-09-83 | Probe facts recorded without paths or names; the cutover runbook lists the three roles, or Task 1 is reverted (D-44) | architecture | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*HostingRecordTests" --filter-class "*CutoverRunbookTests" --filter-class "*NoInlineSqlTests"` | yes | pending |
| 09-32-01 | 32 | 8 | JOB-01, CUT-01 | T-09-86, T-09-87 | Backup first in the run (Order 5); counts-only lines; red when not set up; off on Development and test hosts (D-39, D-47) | unit, integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*DatabaseBackupJobTests"`; `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*DatabaseBackupStoreTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DatabaseBackupRunTests"` | no, the task creates them | pending |
| 09-32-02 | 32 | 8 | JOB-01, CUT-01 | T-09-85, T-09-88, T-09-89 | 20-day gap; keep own newest 3; never touch foreign files; red on any failure while other jobs run (D-41, D-43, D-46, D-47) | unit, integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*DatabaseBackupJobTests"`; `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*DatabaseBackupStoreTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DatabaseBackupRunTests"` | created in 09-32-01 | pending |
| 09-32-03 | 32 | 8 | CUT-01 | T-09-87 | Runbook backup and restore sections, no path or name; UI-SPEC run-summary row | docs check | `grep -c "Maintenance__Backup__SqlServerFolder" docs/operations/maintenance.md` | yes | pending |

*Status: pending, green, red, flaky*

---

## Wave 0 Requirements

- [ ] Synthetic image fixtures built in test code, never real photos (public repo): JPEG with fake GPS at 0N 0E and Orientation 6, JPEG with XMP and trailing MPF bytes, PNG with `tEXt`/`eXIf`, WebP with `EXIF`/`XMP ` chunks, an ISOBMFF HEIC shell with an `Exif` item and `ispe`, an AVIF shell, an SVG renamed `.jpg`, truncated and looping files.
- [ ] `TestingImageStorage` and `TestingImageDelivery` (memory store, same-origin URLs) so tests and Playwright never call Cloudinary.
- [ ] A multipart request helper for integration tests (chosen boundary).
- [ ] A large JPEG generated in the browser by canvas at Playwright test time.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera capture on a real Android phone and iPhone | IMG-05 | Needs a device camera; `Permissions-Policy: camera=()` behavior with `capture` is assumed | Open an order on each phone, tap "Take Photo", take a photo, confirm it uploads and shows |
| Real HEIC upload | IMG-02, IMG-03 | Test fixtures are synthetic shells | Upload one real iPhone HEIC; confirm it shows and the delivered file has no GPS |
| Live "Run now" of the maintenance workflow | JOB-01, JOB-02 | Needs the host key and GitHub secret | Trigger `workflow_dispatch`, confirm a green run with a counts-only summary |
| Backup probe from the owner's PC (plan 09-31) | CUT-01 | Needs the site's connection string and the host's db folder, which only the owner holds (D-44, D-45) | Follow 09-31 Task 2: tick db_backupoperator, run `POST /probe/backup` on port 5116, check and delete the file in the file manager, paste the facts |
| First real backup after the deploy (plan 09-32) | JOB-01, CUT-01 | Needs the host's db folder settings and the live site; proves the web app's own folder access (D-45) | Set `Maintenance__Backup__SqlServerFolder` and `Maintenance__Backup__AppFolder`, press Run now, confirm "Database backups written: 1" and a green run |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

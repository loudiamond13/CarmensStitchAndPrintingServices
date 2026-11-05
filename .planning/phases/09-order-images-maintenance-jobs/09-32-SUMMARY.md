---
phase: 09-order-images-maintenance-jobs
plan: 32
created: "2026-11-05T18:55:00-06:00"
updated: "2026-11-05T18:55:00-06:00"
status: deferred
completed: 2026-11-05
requirements-completed: []
requirements-deferred: [JOB-01, CUT-01]
---

# Phase 9 Plan 32: Monthly database backup job Summary (deferred)

**Deferred by the owner on 2026-11-05 (D-51): database backups are skipped for now.**

## What happened

- Nothing was built. The job depended on 09-31 proving a TO DISK backup, which the host does not allow.
- SmarterASP.NET support says `BACKUP DATABASE` is allowed, but the SQL server cannot write into `/db`. The owner's own test confirmed that no usable folder exists.
- An export uploaded by FTP (D-50) was looked at: FluentFTP (MIT) fits the rules, but Microsoft's export library is not MIT licensed. A hand-built export of every table remains possible later.

## Left for later

- Backups are made by hand in the control panel until an automated way is chosen (STATE.md backlog).
- CUT-01 (Phase 17) still asks for scheduled backups: decide the approach before the cutover.

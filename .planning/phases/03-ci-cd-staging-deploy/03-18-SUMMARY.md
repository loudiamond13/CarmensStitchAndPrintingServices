---
phase: 03-ci-cd-staging-deploy
plan: 18
subsystem: cutover-backup
tags: [d-18, d-04, legacy-backup, localdb, checkpoint]
created: "2026-10-16T18:11:48-05:00"
updated: "2026-10-16T18:11:48-05:00"
status: complete

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-14: Restore-LegacyReceipt.ps1; 03-17: pipeline on main"
provides:
  - "Legacy .bak (exported 2026-10-06, site unused since per owner) and the legacy site zip in _local, git-ignored"
  - "Two off-host copies: this PC (_local) and the owner's other computer"
  - "Backup verified and restored into CSPS_Legacy_Restore: 17 tables, 988 rows, SHA-256 c9100fb0a390..."
  - "Receipt in _local/legacy-receipt.md (names and counts only, never committed)"
affects: [03-19]

actuals:
  tasks: 2
  commits: 2
plan_head_before: 6f2e14bbc70567a959b0ff099f8c848d6653decb
plan_head_after: f0a03411806e51919a7fb9578caeb857a7fa2c34

key-files:
  created: []
  modified:
    - .planning/phases/03-ci-cd-staging-deploy/03-CUTOVER-LOG.md
---

# Phase 3 Plan 18: Legacy backup proven

- **Task 1 (owner):** The owner put the 2026-10-06 legacy .bak and the site files (as a zip) in `_local`. The owner confirmed nobody used the site after the export, so the backup is complete. The off-host copies are on this PC and on the owner's other computer.
- **Deviation:** the .bak was copied in `_local` as `legacy-20261006.bak`, a byte-identical copy, and restored from that. This keeps the hosting database id, which is in the original file name, out of the receipt and the public repo.
- **Task 2:** the preflight was clear. `Restore-LegacyReceipt.ps1` verified the backup and then restored it: 17 tables, 988 rows. The receipt header is present and `git status --porcelain -- _local` is empty.
- **Plan wording:** the plan names `03-LEGACY-RECEIPT.md` under `.planning`. Since WR-05 the script keeps the receipt in git-ignored `_local` instead, so it is never committed.

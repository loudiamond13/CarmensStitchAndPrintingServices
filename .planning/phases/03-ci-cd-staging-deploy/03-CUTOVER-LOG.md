---
phase: 03-ci-cd-staging-deploy
created: "2026-10-16T17:54:41-05:00"
updated: "2026-10-16T23:40:00-05:00"
---

# Phase 3 cutover log

Evidence for the D-18 cutover. Run ids, shas, artifact and release names and dates only; never secrets.

| Step | Date | Evidence | Checked by Claude |
|------|------|----------|-------------------|
| Pipeline merged | 2026-10-16 | PR #1 squash-merged by `Merge-PullRequest.ps1 -Pr 1 -KeepBranch` as fb9b20cb07d3782dc7bdaedd0625aa1f154ebf3d. GitHub built its squash message from the full commit log, which quoted a skip marker, so no push workflow ran on it and no package was built. Fixed by quick task 261016-ns5 (PR #4): the script now sets the squash message and the gate refuses skip markers. PR #4 merged by `Merge-PullRequest.ps1 -Pr 4 -KeepBranch` as ba7c8a7493e2b5d4465e58b8c541e8fcb240f4f6. Main push CI run 38977811876 (mode package): success, artifact `csps-package-ba7c8a7493e2b5d4465e58b8c541e8fcb240f4f6`. deploy.yml and weekly.yml are on main (Deploy and Weekly workflows registered). Branch brought level with main after each merge (empty `git diff --stat origin/main HEAD`). | Yes |
| Step 1: backup and legacy files | 2026-10-16 | Legacy .bak exported 2026-10-06 (5.1 MB; owner confirms the site was not used since). Copied in _local as legacy-20261006.bak so the hosting database id stays out of the repo. Legacy site files as a zip in _local (9.7 MB). Both git-ignored; `git status --porcelain -- _local` empty. Off-host copies: this PC (_local) and the owner's other computer. | Yes |
| Step 2: receipt ready | 2026-10-16 | Restored into CSPS_Legacy_Restore on (localdb)\MSSQLLocalDB by Restore-LegacyReceipt.ps1 (backup verified first). 17 tables, 988 rows. SHA-256 c9100fb0a390... Receipt kept in _local/legacy-receipt.md (git-ignored, names and counts only). | Yes |
| Step 2: receipt confirmed by the owner (2026-10-16) | 2026-10-16 | Owner replied confirmed-go after reviewing the 17 tables and 988 rows. | Yes |
| Step 3: new database | 2026-10-16 | Legacy database deleted by the owner (preserved only in the .bak). New database `db_…_cspsdb`: SQL Server 2025 (RTM-CU3) 17.0.4025.3, Standard Edition; compatibility_level 170; collation SQL_Latin1_General_CP1_CI_AS. SqlCompatibility.Level re-pinned 160 to 170; Infrastructure integration suite and full .NET suite green on LocalDB 17.0.4025.3. | Yes |
| Probe (probe_rewrite false) | 2026-10-16 | deploy.yml action hostprobe, run 39000637708: success. Probe facts recorded in HOSTING-RECORD (Verified 2026-10-16). | Yes |
| Probe (probe_rewrite true) | 2026-10-16 | deploy.yml action hostprobe, run 39000906168: success. http answered 301 to https, so the URL Rewrite module is present. Follow-up on the phase branch, quick 261016-w4u: self-contained win-x64 package, the IIS HttpToHttps rule and the MachineKeySet certificate load. | Yes |

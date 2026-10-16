---
phase: 03-ci-cd-staging-deploy
created: "2026-10-16T17:54:41-05:00"
updated: "2026-10-16T17:54:41-05:00"
---

# Phase 3 cutover log

Evidence for the D-18 cutover. Run ids, shas, artifact and release names and dates only; never secrets.

| Step | Date | Evidence | Checked by Claude |
|------|------|----------|-------------------|
| Pipeline merged | 2026-10-16 | PR #1 squash-merged by `Merge-PullRequest.ps1 -Pr 1 -KeepBranch` as fb9b20cb07d3782dc7bdaedd0625aa1f154ebf3d. GitHub built its squash message from the full commit log, which quoted a skip marker, so no push workflow ran on it and no package was built. Fixed by quick task 261016-ns5 (PR #4): the script now sets the squash message and the gate refuses skip markers. PR #4 merged by `Merge-PullRequest.ps1 -Pr 4 -KeepBranch` as ba7c8a7493e2b5d4465e58b8c541e8fcb240f4f6. Main push CI run 38977811876 (mode package): success, artifact `csps-package-ba7c8a7493e2b5d4465e58b8c541e8fcb240f4f6`. deploy.yml and weekly.yml are on main (Deploy and Weekly workflows registered). Branch brought level with main after each merge (empty `git diff --stat origin/main HEAD`). | Yes |

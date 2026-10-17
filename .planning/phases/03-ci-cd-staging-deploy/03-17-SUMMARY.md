---
phase: 03-ci-cd-staging-deploy
plan: 17
subsystem: ci-merge-to-main
tags: [merge-gate, d-08, d-11, ops-01, ops-04, checkpoint]
created: "2026-10-16T17:55:04-05:00"
updated: "2026-10-16T17:55:04-05:00"
status: complete

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-16: green full gate on PR 1, repository settings and ruleset applied"
provides:
  - "Owner decision: merge-now (the switch stays in Phase 3)"
  - "The pipeline on main (PR 1, fb9b20c), with Deploy and Weekly registered"
  - "The merge script composes the squash message and the gate refuses skip markers (quick 261016-ns5, PR 4, ba7c8a7)"
  - "Main push CI run 38977811876 (mode package) green with artifact csps-package-ba7c8a7493e2b5d4465e58b8c541e8fcb240f4f6"
  - "03-CUTOVER-LOG.md started with the Pipeline merged row"
affects: [03-18, branch-rules, merge-gate]

actuals:
  tasks: 2
  commits: 9
plan_head_before: 95b8ea9dcdc0fb68f8d8cae04c5d63d69ecfbb21
plan_head_after: 331069e4d5719a2beaebdebf2a30ba0aa9b15f65

key-files:
  created:
    - .planning/phases/03-ci-cd-staging-deploy/03-CUTOVER-LOG.md
  modified: []
---

# Phase 3 Plan 17: Pipeline merged to main

## Decision (Task 1)

The owner chose **merge-now** on 2026-10-16. Plans 03-18 to 03-22 stay in Phase 3.

## Merge (Task 2)

- The owner ticked the Definition of Done on PR 1. Claude then fixed the box format to `[x]` and added N/A reasons, at the owner's request. The owner said "merge", and `Merge-PullRequest.ps1 -Pr 1 -KeepBranch` merged it as `fb9b20c`.
- **Deviation:** GitHub built the squash message from the whole commit log, and one quoted line held a skip marker. No push workflow ran on `fb9b20c`, so no package existed. ci.yml uploads the package only on a push run, and deploy.mjs accepts only a push run's package, so a dispatch run could not stand in.
- **Fix:** quick task 261016-ns5 (PR 4) makes the merge script pass its own subject (`<title> (#n)`) and a one-line body. The gate now refuses skip markers, double quotes and control characters in the title. It was written test first: 39 new tests, 197 passing.
- PR 4 was merged on the owner's "merge" as `ba7c8a7`. The main push CI run 38977811876 (mode package) succeeded with `csps-package-ba7c8a7493e2b5d4465e58b8c541e8fcb240f4f6`.
- The branch was brought level with main after each merge, and the diff to main was empty each time.

## Verification

- `gh run list --workflow ci.yml --branch main --limit 1` reports conclusion success.
- The run's artifacts include one `csps-package-` entry.
- `gh workflow list` lists Deploy and Weekly.

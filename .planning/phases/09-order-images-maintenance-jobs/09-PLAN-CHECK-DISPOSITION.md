---
created: "2026-10-31T19:40:00-05:00"
updated: "2026-10-31T19:40:00-05:00"
---

# Phase 9: plan check of 09-31 and 09-32, outcomes

The GSD plan checker read 09-31 (host backup probe) and 09-32 (monthly backup job) on 2026-10-31. It found 0 blockers, 3 warnings and 4 info notes. The owner said to fix all seven (owner, 2026-10-31). Owner rulings D-39 to D-48, the one allowed SQL statement (D-40), public-repo safety and the project rules all passed.

| # | Severity | Finding | Outcome | Where |
|---|---|---|---|---|
| 1 | Warning | 09-19 depended on all of 09-31, so the owner's blocking probe step would stall waves 5 to 9 | Fixed. 09-19 no longer depends on 09-31. Its restore step always refreshes the two HostProbe lock files and commits them when they change. | 09-19 frontmatter, Task 1 |
| 2 | Warning | A failing backup was retried on every repeat call in one run (up to 10), using most of the 90 s budget each time | Fixed. A `database-backup-attempt` row in `DatabaseLocks` (EF, no schema change) allows one try per 24 hours. A repeat call in the same run (claim under 25 minutes old) prints a plain skipped line; a later run inside the 24 hours prints a red skipped line, so a failure is never hidden. New tests and threat T-09-91. | 09-32 Task 2, 09-VALIDATION row 09-32-02 |
| 3 | Warning | The probe's tests could not see two internal types | Fixed. `InternalsVisibleTo` for Csps.HostProbe.Tests added beside the Csps.HostProbe entry. | 09-31 Task 1 |
| 4 | Info | The UI-SPEC run-summary row would miss some backup lines | Fixed. All twelve backup lines are named by exact text, with which ones turn the run red. | 09-32 Task 3 |
| 5 | Info | Repeat calls printed "written: 0" lines after "written: 1" | Fixed. A call whose newest backup is under 24 hours old prints no backup line. 09-30's "Database backups written: 1" check still holds. | 09-32 Task 2 |
| 6 | Info | The raw-SQL test could miss some forms | Fixed. `CreateCommand`, `ExecuteReader`, `"BACKUP "` and `"RESTORE "` added to the tokens, with must-flag samples. | 09-31 Task 1 |
| 7 | Info | One cleanup check looked only at the top of the temp folder | Fixed. Test folders use the prefix `csps-backup-test-{guid}`, and the check confirms none is left. | 09-31 Task 1, 09-32 Tasks 1 and 2 |

## Side effects the owner should know

- After a failed backup, the next try is allowed only 24 hours later, even if the cause is fixed and Run now is pressed sooner. Runs in between show the red skipped line. The runbook says so.
- 09-32 now touches 18 files, a little above the checker's soft limit of about 15.
- "Database backup failed: Not set up on the host." still appears once per call when the folders are missing. It is cheap and causes no retry, so it is left as it is.

Both plans pass `frontmatter.validate` and `verify.plan-structure` after the fixes (3 tasks each, no errors or warnings).

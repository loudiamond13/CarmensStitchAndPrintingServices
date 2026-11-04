---
phase: 09-order-images-maintenance-jobs
plan: 17
subsystem: api
tags: [maintenance, jobs, purge, sessions, two-factor, outbox, batched-delete]

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plans 09-06, 09-11 and 09-12 (purge job, budget, batches of 500, maintenance runbook)
provides:
  - PurgeExpiredRecordsJob rules for sessions, 2FA challenges, account links and closed outbox rows
  - One report line per rule, and a failed line per rule that hits a database error
  - Purge table in docs/operations/maintenance.md; mail-setup.md retention sentence updated
affects: [09-22, 09-32]

created: "2026-11-03T17:50:00-06:00"
updated: "2026-11-03T17:50:00-06:00"

actuals:
  tokens: 7500
  tasks: 2
  commits: 4

plan_head_before: f27ee1493070e68ed51238211092f8ae5f4e9fd9
plan_head_after: 00927024cd80cc168183b24462d1484e2e9a5270
commits: 4

tech-stack:
  added: []
  patterns:
    - "Purge rules are PurgeRule(label, failed text, steps). Each step is one batched ExecuteDeleteAsync of 500 ordered by the cut-off column; a rule reports one line; a database error becomes that rule's failed line only"
    - "A cut-off is strict: a row exactly at the cut-off stays, a row one tick older goes"

key-files:
  created: []
  modified:
    - src/Csps.Infrastructure/Maintenance/PurgeExpiredRecordsJob.cs
    - tests/Csps.Infrastructure.IntegrationTests/Maintenance/PurgeExpiredRecordsJobTests.cs
    - tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs
    - docs/operations/maintenance.md
    - docs/operations/mail-setup.md

key-decisions:
  - "Cut-offs are strict less-than, so a row exactly at the cut-off stays (plan boundary rule)"
  - "A closed outbox row is removed only when every close time that is set (SentAt, FailedAt, ExpiredAt) is past 30 days, and at least one is set. Open rows never match"
  - "The job always returns every rule's line, including zeros, so the monthly report is complete"

requirements-completed: [JOB-01]

status: complete
duration: about 45 min
completed: 2026-11-03
---

# Phase 9 Plan 17: The monthly run clears expired sign-in data and old emails Summary

**The purge job now also removes sessions 1 day after their fixed end (refresh tokens cascade), 2FA challenges 1 day after expiry (codes cascade), invite and reset links 7 days after expiry, and sent, failed or expired outbox emails 30 days after they closed, each in batches of 500 with its own report line and its own failure isolation.**

## Accomplishments

- Rules run in this order: request keys, short-lived claims (one line), sessions, 2FA challenges, account links, outbox. Lines: "Expired request keys removed", "Expired sign-in tokens removed", "Expired 2FA codes removed", "Expired account links removed", "Old sent emails removed".
- Cascades confirmed in the model snapshot before relying on them: `RefreshToken.SessionId` and `TwoFactorCode.ChallengeId` are both `OnDelete(DeleteBehavior.Cascade)`. No children are deleted by hand. The test with a rotated token chain (3 tokens in a removed session) shows the self-reference on `ParentId` does not block the delete.
- Consumed refresh tokens of a live session stay (test: live session keeps 3 tokens, 2 of them used).
- Failure isolation: each rule has its own catch. A database error in the sessions rule gives a failed line "The expired sign-in tokens could not be removed." and the other three new rules still delete. A request-key failure no longer stops the later rules either (before this plan one catch wrapped everything).
- Budget: after a full batch of 500 with a spent budget the pass ends with `More` and the line shows what was removed so far (500 of 1,100 sessions in the test; later rules wait for the next call).
- Docs: `docs/operations/maintenance.md` has a "What the purge removes" table with all six rules, cut-offs and the reason for each margin. `docs/operations/mail-setup.md` now says the monthly run deletes closed rows 30 days after they close.

## Task Commits

1. **Task 1 RED:** `56a78bae` (sessions: boundary, cascade, three batches, spent budget; existing tests find their line by label)
2. **Task 1 GREEN:** `051292ad` (rule structure, per-rule failure isolation, sessions rule)
3. **Task 2 RED:** `b465c3a8` (challenges, links, outbox, empty-run lines, failure isolation)
4. **Task 2 GREEN:** `00927024` (three rules, docs, endpoint order test)

## TDD Gate Compliance

- RED `56a78bae`: `PurgeExpiredRecordsJobTests` `total: 10, failed: 4, succeeded: 6`. The four new session tests failed because the "Expired sign-in tokens removed" line did not exist ("Sequence contains no matching element"); the six existing tests passed.
- GREEN `051292ad`: same class `total: 10, failed: 0`. `NoInlineSqlTests` `total: 31, failed: 0`. `dotnet build src/Csps.Infrastructure`: `0 Warning(s)`, `0 Error(s)`.
- RED `b465c3a8`: class `total: 18, failed: 7, succeeded: 11`. The seven failures are the new challenge, link, outbox, empty-run-lines and sessions-failure tests (their lines did not exist). `AFailedRequestKeyPurgeDoesNotStopTheLaterPurges` passed already, because Task 1 GREEN restructured the failure handling; it stays as a guard.
- GREEN `00927024`: class `total: 18, failed: 0, succeeded: 18`, run again after `dotnet format` reordered an import, still `18/18`.

## Checks I saw

- `dotnet build Csps.slnx`: `0 Warning(s)`, `0 Error(s)`.
- `dotnet format Csps.slnx --verify-no-changes`: no output (clean) after letting format sort one `using` order in the test file.
- `Csps.ArchitectureTests` (all): `total: 263, failed: 0`.
- `MaintenanceEndpointTests`: first run `total: 10, failed: 1` (see deviation 1), after the fix `total: 10, failed: 0`.
- Acceptance greps: `Expired sign-in tokens removed` in the job: 1. `Old sent emails removed`: 1. `FromSql|SqlQuery|ExecuteSql`: 0. `IsSpent`: 1. No en or em dash in `src/Csps.Infrastructure/Maintenance`.
- `gitleaks protect --staged --no-banner` before each of the four commits: "no leaks found". Test emails are `staff@example.test` and `staff.<guid>@example.test`.
- I did not run the full `Csps.Server.IntegrationTests` suite (long, and four other executors share the machine). No timing flake showed up in what I ran (ExpenseListTimingTests and OrderListTimingTests were not run).
- Preflight: not run. These tests use the in-process test host and `CSPS_Test_<guid>` LocalDB databases only; no dev server, port or Playwright was started. No background shell is left running.

## Decisions Made

- Strict cut-off (`<`): the plan's boundary rule ("exactly at the cut-off stays, one second past it is removed"). The older request-key and claim rules keep `<=` because their own plan said so.
- Outbox "closed" test needs every set close time past 30 days. In practice only one of the three is ever set; this form can never remove a row that closed more recently through another column.
- The outbox batch is ordered by `CreatedAt` (the close time spans three columns, and creation time is the closest single stand-in).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The endpoint order test pinned the purge to exactly one line**
- **Found during:** Task 2 GREEN verification (`MaintenanceEndpointTests`)
- **Issue:** `JobsRunByOrderWhateverTheirRegistrationOrder` expected the labels `["Early job", "Expired request keys removed", "Late job"]`. With the new rules the purge reports five lines, so it failed.
- **Fix:** The test now checks that the early job is first, the late job is last, the request-key line comes right after the early job, and the purge adds more lines. Order is still what the test proves.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs`
- **Commit:** `00927024`

**2. [Plan scope] Task 1 also moved the purge to one catch per rule**
- The plan's feature block puts failure isolation in Task 2, but the shared per-rule structure was cleaner to build once in Task 1 (the helper the plan asked for). The Task 2 RED therefore contains one failure test that already passed. Nothing else differs.

**3. [Plan scope] Two request-key rows in the runbook**
- The plan says the runbook lists "all six purge rules". Request keys and claims share one report line but are two rules, so the table has two rows for them and says so.

**Total deviations:** 3 (1 bug in an existing test, 2 scope notes). **Impact:** none on behavior the plan asked for. No schema change, no trigger, no package, no inline SQL.

## Known Stubs

None.

## Threat Flags

None. T-09-39 (margins, consumed tokens of live sessions kept, boundary tests on both sides of every cut-off), T-09-40 (closed outbox rows removed 30 days after closing) and T-09-41 (batches of 500 within the budget, `More` continues) are mitigated as planned. T-09-SC: no package added.

## Known risks left on purpose

- A pass cut off by the budget (`More`) reports only the rules it reached. Rules after it show up in the next call. The workflow already calls again on `more`.
- A full batch of exactly 500 with a spent budget reports `More` although nothing is left; the next call reports 0. Harmless (same as 09-11).
- The `Phase 5` deferred item for the outbox purge (`.planning/phases/05-profile-user-management/deferred-items.md`) is now delivered by this plan. I did not edit that file (outside this plan's files); the orchestrator may close it.

## Owner backlog items (for the orchestrator to copy into STATE.md)

- [ ] Review the 7 day margin for expired invite and reset links (SPEC-GAP in the plan). Why 7 days: staff may still see "this link was already used" or "has expired" for a week instead of "not found". Cost of a longer or shorter time: a few kept rows versus a less clear message. Default taken: 7 days. It is one constant, `PurgeExpiredRecordsJob.AccountLinkMargin`. The 1 day margin for sessions and 2FA challenges and the 30 day email rule (D-35) are settled.
- [ ] Wording check (low priority): the four new report lines read "Expired sign-in tokens removed", "Expired 2FA codes removed", "Expired account links removed" and "Old sent emails removed", and a failed rule reads "The expired sign-in tokens could not be removed." (and the same pattern for the others). The labels come from the plan; the failed-line sentences are my wording.
- [ ] Preflight could not be run from this agent (the same shell limit as 09-11). Nothing here needed a port, but the orchestrator may want to run `preflight.ps1` before the next full server run.

## Self-Check: PASSED

- Files: the job, both test files, `maintenance.md` and `mail-setup.md` exist and are committed (`git status` clean for them after `00927024`).
- Commits: `56a78bae`, `051292ad`, `b465c3a8` and `00927024` are ancestors of HEAD; `f27ee149` is an ancestor of HEAD.

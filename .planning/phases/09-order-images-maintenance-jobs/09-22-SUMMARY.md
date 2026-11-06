---
phase: 09-order-images-maintenance-jobs
plan: 22
subsystem: ci
tags: [github-actions, cron, maintenance, node-script, workflow-tests]
requires: [09-11, 09-12, 09-17]
provides:
  - ".github/workflows/maintenance.yml: monthly cron 17 19 1 * * and Run now, no token rights, no environment"
  - "web/scripts/maintenance.mjs: runMaintenance and formatSummary, counts-only run summary, exit 1 on any failure"
  - "MaintenanceWorkflowTests and the one-line MAINTENANCE_KEY exception in CiWorkflowTests"
  - "Schedule and red-run sections in docs/operations/maintenance.md; Maintenance entry in docs/operations/ci.md"
affects: [09-30, 09-32]
key-files:
  created:
    - .github/workflows/maintenance.yml
    - web/scripts/maintenance.mjs
    - web/scripts/maintenance.test.ts
    - tests/Csps.ArchitectureTests/MaintenanceWorkflowTests.cs
  modified:
    - tests/Csps.ArchitectureTests/CiWorkflowTests.cs
    - docs/operations/ci.md
    - docs/operations/maintenance.md
key-decisions:
  - "A script-made failure is a plain bullet sentence in the summary (for example '- The maintenance key was refused.'), not a 'label: value' line"
  - "A 'more' answer is followed up even when ok is false, so a failing job cannot block the rest of the backlog; any failure still ends in exit 1"
  - "A line with failed true makes the run red even when the answer says ok true"
  - "fetch uses redirect 'error' and a 120 second limit per call, so the key cannot travel to another host and a hung call cannot hold the run"
requirements-completed: [JOB-01, JOB-02]
status: complete
commits: 6
plan_head_before: 37ba6bf403cc6a52bc583fc3e737c9511edef2b5
plan_head_after: d70c7892555f655d507b5148a3ae51ec7a707dac
actuals:
  tokens: 12000
  tasks: 3
  commits: 6
created: 2026-11-03T20:58:00-06:00
updated: 2026-11-03T20:58:00-06:00
---

# Phase 9 Plan 22: The maintenance run happens every month, and on "Run now" Summary

*Created: 2026-11-03T20:58:00-06:00 · Updated: 2026-11-03T20:58:00-06:00*

**A GitHub Actions workflow calls the maintenance endpoint on the 1st of each month (19:17 UTC) and on Run now, through a small tested Node script that loops while there is more work, writes only counts to the public run summary, and exits 1 on any failure so the run turns red and GitHub emails the owner.**

## Accomplishments

- **Script (`web/scripts/maintenance.mjs`):** one keyed POST to `{SITE_ORIGIN}/api/v1/maintenance/run`. Calls again while the answer says `more` (at most 10 calls). On 409 it waits 60 seconds and retries up to 4 times. Fixed sentences for 401, 429, other statuses, network failures and unreadable answers: none holds a body, an error message or the key. The origin must be `https` with no path, query or sign-in details, and the key must be printable with no spaces, both checked before any call. Redirects are refused. Labels and texts are cut to one printable line of at most 120 characters. The script never throws; the CLI sets the exit code.
- **Workflow (`.github/workflows/maintenance.yml`):** schedule `17 19 1 * *` plus `workflow_dispatch`. `permissions: {}` at both levels, `ubuntu-24.04`, `timeout-minutes: 20`, concurrency group `maintenance` with `cancel-in-progress: false`, no `environment`. Only the approved SHA pins for checkout (`persist-credentials: false`) and setup-node. The key and origin reach the script as env entries only; no `${{ }}` in a run line.
- **CI rules:** `NoWorkflowCarriesAProductionSecret` now allows exactly one line, `MAINTENANCE_KEY: ${{ secrets.MAINTENANCE_KEY }}`, in `maintenance.yml`. A sample test proves the same line elsewhere, any other secret, and any other form of the key still fail. `MaintenanceWorkflowTests` (9 tests) pins triggers, permissions, job shape, concurrency, actions, env-only inputs, built-ins-only script and the runbooks.
- **Docs:** `maintenance.md` gains the schedule, Run now, what the owner sets in GitHub, main-only schedules, delays, the 60-day pause and how to re-enable it, who gets the failure email, and a table of every fixed summary sentence. `ci.md` gains the Maintenance entry and the secrets rule.

## Task Commits

| Task | Phase | Commit |
|---|---|---|
| 1 (tracer) | RED | `2da583b3` test(09-22): Run now posts once with the key and writes the counts |
| 1 (tracer) | GREEN | `ba3db682` feat(09-22): Run now calls the site once ... (script and workflow) |
| 2 | RED | `e5c4dffe` test(09-22): long runs, failures and odd answers |
| 2 | GREEN | `437070a3` feat(09-22): long runs continue, failures turn the run red, odd answers are safe |
| 3 | RED | `665c9ad5` test(09-22): pin the maintenance workflow and allow only its one secret |
| 3 | GREEN | `d70c7892` feat(09-22): allow only the maintenance key and document the monthly run |

## TDD Gate Compliance

- **RED 1 `2da583b3`:** `web/scripts/maintenance.test.ts`, 2 tests, 2 failed. The stub script returns 1 and makes no call, so `expect(run.code).toBe(0)` failed ("expected 1 to be +0"). `gsd-tools check tdd-red-evidence` on the JUnit report: `RED_EVIDENCE_OK`, reason `target_test_failed`. Semantic assessment: the target ran and failed on the planned assertion for the intended reason (no request, wrong exit code).
- **GREEN 1 `ba3db682`:** 2 of 2 pass. Tracer gate: the same command re-run end to end, passed, "Tracer verified end-to-end, expanding".
- **RED 2 `e5c4dffe`:** 35 tests, 31 failed, 4 passed. `RED_EVIDENCE_OK` for the target "stops after 10 calls and fails the run when there is still more" (1 call made, 10 expected). The harness turns a throw from the script into the value `threw <Name>`, so failures show as assertion failures ("expected 'threw TypeError' to be 1"), not as test errors. The 4 that passed already were the two Task 1 tests, "exits 1 when the answer says ok is false" and the closing-sentence test; they stay as guards.
- **GREEN 2 `437070a3`:** 35 of 35 pass. Prettier, ESLint (max warnings 0) and `tsc -p tsconfig.node.json` clean.
- **RED 3 `665c9ad5`:** `CiWorkflowTests` + `MaintenanceWorkflowTests`, 46 tests, 3 failed, on their assertions: the docs test (runbook phrases missing), the exception sample test (stub `IsTheMaintenanceKeyLine` returns false) and `NoWorkflowCarriesAProductionSecret` (the exact line was flagged). The other `MaintenanceWorkflowTests` passed at once because the workflow file already existed from Task 1; they are characterization tests.
- **GREEN 3 `d70c7892`:** 46 of 46 pass; the whole `Csps.ArchitectureTests` project 275 of 275.
- RED stubs: `maintenance.mjs` was a stub in the first commit and `IsTheMaintenanceKeyLine` was a stub in the third, because a compile or import error is not a valid RED.

## Checks I saw

- `npm --prefix web run test -- --run scripts/maintenance.test.ts`: `Tests 35 passed (35)`.
- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiWorkflowTests" --filter-class "*MaintenanceWorkflowTests"`: `total: 46, failed: 0, succeeded: 46`.
- `dotnet test --project tests/Csps.ArchitectureTests` (all): `total: 275, failed: 0, succeeded: 275`.
- `dotnet format Csps.slnx --verify-no-changes --include <the two test files>`: no output (clean).
- Acceptance greps: `grep -c workflow_dispatch maintenance.yml` = 1; `grep -c "environment:"` = 0; `grep -c "secrets\."` = 1 and the count of lines without MAINTENANCE_KEY = 0; `grep -c "60 days" maintenance.md` = 1; test names hold "10 calls" (2), "401" (2) and "origin" (3).
- No en or em dash in any new or edited file (checked with a small Node script).
- `gitleaks protect --staged --no-banner` ran before each of the six code commits: "no leaks found". The fake key in the tests is `fake-maintenance-key-for-tests-only-0000000000`.
- Local CLI run with no settings (`node web/scripts/maintenance.mjs`, no network): prints the fixed "SITE_ORIGIN must be an https address..." sentence and exits 1.

## Deviations from Plan

**1. [Process] An intermediate state is red.** The plan puts `maintenance.yml` in Task 1 and the secret exception in Task 3. From `ba3db682` until `d70c7892`, `CiWorkflowTests.NoWorkflowCarriesAProductionSecret` fails (it flags the key line). That failure doubles as the Task 3 RED. The branch end state is green.

**2. [Rule 2 - Missing critical] Extra safeguards beyond the plan's list.** Refuse redirects (`redirect: 'error'`, so a redirect cannot carry the key to another host), a 120 second limit per call, a check of the key's shape before it is sent, validation of the answer's shape (a line with no label, a non-boolean `ok`, or text that is not JSON is "could not read"), and `failed: true` on a line turning the run red even when `ok` is true. Each has a test.

**3. [Rule 1 - Bug in my own test] `WorkflowText.RunBlocks` reads the job id `run:` as a run key** (empty value), so the first draft of the "one run line" test saw `["", "node ..."]`. The test now reads run lines from the job's steps only. No change to the shared helper.

**4. [Interpretation] `{value or text}`.** A line shows its number when it has one, otherwise its text, otherwise just `- label:`. The summary also has a `## Maintenance run` heading, which the plan does not forbid.

**5. [Environment] `npm ci --ignore-scripts` was run in `web/`** because the worktree had no `node_modules`. It installs only what the lockfile pins; no package was added or changed and no lockfile is modified (`git status` clean).

**Total deviations:** 5 (1 process, 1 added safeguards, 1 own test bug, 2 notes). **Impact:** none on the behavior the plan asked for.

## Pre-existing issue seen (out of scope, not fixed)

- `web/scripts/license-policy.test.ts` > "exits 1 on a stricter policy given through --exceptions (no npm exceptions at all)" fails here with "No packages found in this path" from the license checker (run alone twice: same result). The 24 other script test files pass (1180 tests). This plan touches no package, lockfile or license file. It looks tied to this worktree's fresh `node_modules` (installed with `--ignore-scripts`) or its path; the orchestrator's post-merge gate on the real checkout will show whether it is real.

## Not run

- `actionlint` and `zizmor`: not installed on this machine, and the Hygiene workflow runs them in CI. No inline ignore was added: `deploy.yml` already uses secrets outside an environment with no ignore, so zizmor's `secrets-outside-env` check is evidently not raised for this repository's setup. If Hygiene does report it for `maintenance.yml`, the plan's allowed fix is `# zizmor: ignore[secrets-outside-env] a production environment's reviewer would hold every cron run (Pitfall 17)` on the `MAINTENANCE_KEY` line (this exact line is what `CiWorkflowTests` allows, so the comment would need to go on the line above or the test to ignore a trailing comment).
- `preflight.ps1`: PowerShell cannot be started from this worktree. Nothing here uses a port, a database or a dev server. No background process is left running.
- The full `web` Vitest suite and coverage run: only `scripts/**` was run (see above). The post-merge gate owns the rest.
- The workflow was not triggered and no GitHub secret or variable was set (owner steps, plan 09-30).

## Known Stubs

None.

## Threat Flags

None. T-09-54 (key and bodies never printed; env only), T-09-55 (no expression in a run line; tests pin it), T-09-56 (`permissions: {}` at both levels, no persisted credentials), T-09-57 (60-day pause and Run now documented; red run emails the owner), T-09-58 (https origin check before any call; redirects refused) and T-09-SC (no new action or package) are mitigated as planned.

## Owner decisions pending

None block this plan. These are the owner's steps and one wording check:

1. **Owner steps in GitHub (plan 09-30 covers them; written as plain steps in `docs/operations/maintenance.md`).** In the repository, Settings, Secrets and variables, Actions: create the repository secret `MAINTENANCE_KEY` with the same value as the host's `Maintenance__Key` (at least 32 characters, from the password manager), and check that the variable `SITE_ORIGIN` exists (Deploy already uses it) and is the live `https` address with no path. Then, after this branch is merged to `main`, press Run now once to prove the key works. Never paste the key into a chat or a commit.
2. **Failure email.** GitHub sends a scheduled run's failure email to the person who last changed the workflow's `cron` line. Recommendation: have the owner's own GitHub account be the last to touch that line, or keep Actions emails on for whoever does. One line to confirm.
3. **Wording check (low priority).** The fixed sentences in the summary are mine (listed in the table in `maintenance.md`). Tell me if you want different words.

## Self-Check: PASSED

- Files found: `.github/workflows/maintenance.yml`, `web/scripts/maintenance.mjs`, `web/scripts/maintenance.test.ts`, `tests/Csps.ArchitectureTests/MaintenanceWorkflowTests.cs`, `CiWorkflowTests.cs`, `docs/operations/ci.md`, `docs/operations/maintenance.md`.
- Commits `2da583b3`, `ba3db682`, `e5c4dffe`, `437070a3`, `665c9ad5` and `d70c7892` are ancestors of HEAD; base `37ba6bf4` is an ancestor of HEAD. `git rev-list --count 37ba6bf4..HEAD` was 6 before this SUMMARY commit.

---
created: 2026-10-18T20:53:00-05:00
updated: 2026-10-18T20:53:00-05:00
phase: quick-261018-st8
plan: 01
subsystem: web-tooling
tags: [vitest, class-gate, timeout, test-only]
status: complete
requirements: [QUAL-02, WEB-02]
key-files:
  modified:
    - web/scripts/tailwind-classes.test.ts
actuals:
  tasks: 1
  commits: 1
plan_head_before: b645502368022f48f8479661cd2a93076f945b3e
plan_head_after: 831f3fa
---

# Quick 261018-st8: Class-gate sweep timeout budgets Summary

Test-only change: the class-gate sweep now has a 90 s budget and its three slow siblings 30 s each, set through the options object form the file already used. No test name, body, expectation or import changed.

## Budgets

| Test | Old | New |
| ---- | --- | --- |
| every class token in src compiles, with no colour literal and no stray opacity | 30 s | 90 s |
| reads a class const exported by a plain module (through a barrel) and reports it in that module | 5 s default | 30 s |
| does not read a recipe const twice | 5 s default | 30 s |
| collects the real class tokens (so the sweep below is not vacuous) | 5 s default | 30 s |

Comments above each budget say only why it exists (full coverage run loads every core), with no plan numbers, dates or run history, and no long dash.

## Results

- `npm --prefix web run test -- --run scripts/tailwind-classes.test.ts`: 57 of 57 passed, 13.8 s alone (sweep 10.4 s).
- ESLint `--max-warnings 0`: clean. `prettier --check`: clean. `tsc -p tsconfig.node.json`: clean.
- Budget count check (outside comments): one `timeout: 90_000`, three `timeout: 30_000`; no `plan N` or `timed out` text; no U+2013 or U+2014.
- Commit `831f3fa` contains only `web/scripts/tailwind-classes.test.ts`; `web/scripts` has no uncommitted changes.

## Deviations from Plan

None. The first draft of the runClassGate comment was 123 characters, so it was shortened to fit the 120 limit before the commit.

## Not run

The full `npm --prefix web run verify` is left for the orchestrator (E2E run in progress on this machine).

## Known Stubs

None.

## Self-Check: PASSED

- web/scripts/tailwind-classes.test.ts: FOUND
- commit 831f3fa: FOUND

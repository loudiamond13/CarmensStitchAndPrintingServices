---
phase: 11-public-site-content-management
plan: 05
subsystem: ui
tags: [typescript, vitest, hours, formatting, en-PH]
created: "2026-11-11T19:55:00-05:00"
updated: "2026-11-11T19:55:00-05:00"

requires: []
provides:
  - "web/src/utils/hours.ts: WeekDayHours, HoursRow, formatTime, groupWeek, summarizeOpenDays, callButtonSummary"
affects: [11-11, 11-14, 11-16]

actuals:
  tokens: 4400
  tasks: 2
  commits: 4
plan_head_before: 24e4cef7ec03832dbb2b7fd29c27fa1abbe989bf
plan_head_after: b8ef689f8611a1f29f995473b439a1dbca979546

tech-stack:
  added: []
  patterns:
    - "One internal run builder (buildRuns) feeds every hours output"
    - "Formatters return null for a missing or malformed value, never a dash string"

key-files:
  created:
    - web/src/utils/hours.ts
    - web/src/utils/hours.test.ts
  modified: []

key-decisions:
  - "A day with only one time, a malformed time, or no entry from the server counts as closed"
  - "Closed days join into runs too, so groupWeek can show 'Saturday to Sunday' as one Closed row"
  - "Times are parsed with a regex and plain arithmetic: no Date, no Intl, no clock (D-22)"

requirements-completed: [PUB-05, CONT-04]

coverage:
  - id: D1
    description: "formatTime writes 12-hour times (9:00 AM, 12:00 PM, 12:00 AM) and returns null for a malformed time"
    requirement: PUB-05
    verification:
      - kind: unit
        ref: "web/src/utils/hours.test.ts#formatTime"
        status: pass
    human_judgment: false
  - id: D2
    description: "summarizeOpenDays gives one line per run of open days (Mon-Sat · 9:00 AM - 6:00 PM), empty for a closed week"
    requirement: PUB-05
    verification:
      - kind: unit
        ref: "web/src/utils/hours.test.ts#summarizeOpenDays"
        status: pass
    human_judgment: false
  - id: D3
    description: "groupWeek gives Monday-first card rows of days with the same hours, Sunday with null hours"
    requirement: CONT-04
    verification:
      - kind: unit
        ref: "web/src/utils/hours.test.ts#groupWeek"
        status: pass
    human_judgment: false
  - id: D4
    description: "callButtonSummary joins open runs with '; ' and a comma after the days, null for a closed week"
    requirement: PUB-05
    verification:
      - kind: unit
        ref: "web/src/utils/hours.test.ts#callButtonSummary"
        status: pass
    human_judgment: false
  - id: D5
    description: "No output holds a long dash (OR-4) and hours.ts reads no clock (D-22)"
    requirement: PUB-05
    verification:
      - kind: unit
        ref: "web/src/utils/hours.test.ts#long dashes (OR-4); web/src/test/no-long-dash.node.test.ts"
        status: pass
      - kind: other
        ref: "grep -v '^\\s*//' web/src/utils/hours.ts | grep -c 'new Date(' returns 0"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 05: Weekly hours formatter Summary

**One tested formatter (`web/src/utils/hours.ts`) turns the server's seven days into card rows, footer lines and the Call button sub line, with no clock and no status math.**

## Performance

- **Duration:** about 20 min
- **Tasks:** 2 (a tracer, then an auto task), both TDD
- **Files modified:** 2 created, none changed

## Accomplishments

- `formatTime`: "09:00" gives "9:00 AM", "12:00" gives "12:00 PM", "00:00" gives "12:00 AM". "9am", "9:00", "24:00", "09:60" and "" give null.
- `summarizeOpenDays`: "Mon-Sat · 9:00 AM - 6:00 PM" for the common week. Mixed hours give two lines. Closed days are left out and a closed week gives [].
- `groupWeek`: Monday-first rows such as "Monday to Friday" / "9:00 AM - 6:00 PM", "Saturday", "Sunday" with null hours. Days can arrive in any order. A missing day is closed.
- `callButtonSummary`: "Mon-Fri, 9:00 AM - 6:00 PM; Sat, 9:00 AM - 5:00 PM", or null for a closed week.
- The input shape is `WeekDayHours { day: 1..7 (Monday = 1), opensAt, closesAt: "HH:mm" | null }`. Plan 11-11 must send exactly this.

## Task Commits

1. **Task 1 (tracer): Mon-Sat 9 to 6 reads "Mon-Sat · 9:00 AM - 6:00 PM"**
   - RED `1bc4129e` (test)
   - GREEN `1576ba9d` (feat)
2. **Task 2: mixed hours, closed weeks, midnight edges**
   - RED `f624b359` (test)
   - GREEN `b8ef689f` (feat)

**Plan metadata:** the docs(11-05) commit that adds this file.

## TDD Gate Compliance

- **RED 1:** 3 of 3 tests failed on their assertions (`expected null to be '6:00 PM'`, `expected [] to deeply equal ['Mon-Sat · 9:00 AM - 6:00 PM']`). `hours.ts` was committed as a deliberate stub (wrong return values) so the failure is an assertion, not an import error. `gsd check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`).
  - Semantic assessment: the target ran and failed on the planned assertion for the intended reason.
- **GREEN 1:** `Tests 3 passed (3)`.
- **Tracer gate:** the tracer `<verify>` is automated-only and `human_verify_mode` is `end-of-phase`, so it was re-run (3 passed) and expansion continued.
- **RED 2:** `Tests 9 failed | 17 passed (26)`. The 9 failing tests are the groupWeek and callButtonSummary cases. `RED_EVIDENCE_OK` for the target `callButtonSummary > writes the common week with a comma after the days`. The 17 passing tests were formatTime and summarizeOpenDays cases that task 1 already satisfied, plus the closed-week null case and the long-dash test (both true against the stub by accident). A first draft of the "Monday first whatever order" test also passed vacuously against the stub; it was rewritten with explicit expected rows before the RED commit.
- **GREEN 2:** `Test Files 2 passed (2)`, `Tests 27 passed (27)` (hours.test.ts 26 plus the no-long-dash gate).
- **REFACTOR:** none needed. `shortDays` and `longDays` are two small helpers over one shared run builder.

## Verification evidence

- `npm --prefix web run test -- --run src/utils/hours.test.ts src/test/no-long-dash.node.test.ts`: 2 files, 27 tests passed.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0, no output after the command banner. Run on the final tree.
- `npm run typecheck` (app, node and reference tsconfigs): exit 0.
- `prettier --check` on both files: clean.
- Acceptance greps: `export function summarizeOpenDays` 1, `export function groupWeek` 1, `export function callButtonSummary` 1, `new Date(` outside comments 0. No `Date.now`, `performance.now` or `Intl.` in `hours.ts`.
- gitleaks (pre-commit hook) ran on every commit: "no leaks found".

## Decisions Made

- A day with one time missing, a malformed time or no server entry reads as closed. Reason: showing half an opening time would mislead visitors.
- Closed days group into runs like open days. Reason: the card needs one "Saturday to Sunday" / Closed row, and the plan example already shows Sunday alone as a null row.
- Two-day runs read "Monday to Tuesday" in the card and "Mon-Tue" in summaries, the same rule as longer runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Linked `web/node_modules` into the worktree**
- **Found during:** Task 1 (RED run)
- **Issue:** the fresh worktree had no `web/node_modules`, so vitest could not run. The project rule is to add no package, so a new install was the wrong move.
- **Fix:** a directory junction from `web/node_modules` to the main checkout's existing `web/node_modules`. It is git-ignored and was not committed. No package was installed, added or changed.
- **Files modified:** none tracked.

**2. [Rule 1 - Bug] The test file's long-dash regex tripped the OR-4 gate**
- **Found during:** Task 2 (GREEN verification)
- **Issue:** the `‒-―` escapes in a regex literal were written to disk as the real characters, so `no-long-dash.node.test.ts` failed on `utils/hours.test.ts:174`.
- **Fix:** the regex is built with `String.fromCharCode(0x2012)` and `String.fromCharCode(0x2015)`, so the file holds no long dash. A node check confirmed neither file matches `[‒-―]`.
- **Files modified:** `web/src/utils/hours.test.ts`
- **Committed in:** `b8ef689f`

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). **Impact:** none on scope.

Note for the orchestrator: the plan's "Executor rules" name the branch `gsd/phase-11-public-site-content-management` and the main checkout path. This run was in a worktree on `worktree-agent-ae05d08013cb7914b`, as the dispatch required. Nothing was pushed or merged.

## Issues Encountered

None beyond the deviations above. The full `eslint .` run takes over 2 minutes on this machine, so it ran in the background.

## Known Stubs

None. The RED-phase stubs were replaced in the GREEN commits.

## Threat Flags

None. Pure formatting of server values, no new endpoint, file access or schema (T-11-09 accepted as planned; T-11-SC: no package added or bumped).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 11-14 (Contact HoursCard, footer) and 11-16 (Hours tab preview) can import `groupWeek`, `summarizeOpenDays` and `callButtonSummary` from `@/utils/hours`. The component writes "Closed" for a row whose `hours` is null.
- Plan 11-11 must serve days in the `WeekDayHours` shape (ISO day 1 to 7, "HH:mm" or null).

## Self-Check: PASSED

- FOUND: web/src/utils/hours.ts
- FOUND: web/src/utils/hours.test.ts
- FOUND commits: 1bc4129e, 1576ba9d, f624b359, b8ef689f
- STATE.md and ROADMAP.md untouched (orchestrator owns them).

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-11*

---
phase: 08-order-screens
plan: 05
subsystem: ui
tags: [react, vitest, a11y, tdd, due-flag, business-date]
created: "2026-10-29T17:59:00-05:00"
updated: "2026-10-29T17:59:00-05:00"

requires:
  - phase: 08-order-screens
    provides: "EmptyValue, Icon (triangle-alert), formatCalendarDate and the recipe and copy file patterns"
provides:
  - "dueDays(today, dueDate) and dueFlagState(today, dueDate, status) in utils/dueFlag.ts"
  - "DueFlag({ dueDate, status, today, layout }) with inline and stacked layouts"
  - "ORDERS_COPY.due in ordersCopy.ts (new file; later order plans extend it)"
  - "dueFlag* classes in orders.recipe.ts (new file)"
affects: [08-order-list, 08-order-cards, 08-order-page]

actuals:
  tokens: 3600
  tasks: 2
  commits: 3
plan_head_before: 71d0bff94b3dd94c19b8e6a132d4d9f428836396
plan_head_after: 49e8073dcf380a7bac0d5232fc1539139683500e

tech-stack:
  added: []
  patterns:
    - "Day counts are UTC-midnight subtraction of two YYYY-MM-DD strings, so no zone or device clock is involved"
    - "A component that needs the business date takes it as a prop from the server response (D-59)"

key-files:
  created:
    - web/src/utils/dueFlag.ts
    - web/src/utils/dueFlag.test.ts
    - web/src/modules/admin/components/DueFlag.tsx
    - web/src/modules/admin/components/DueFlag.test.tsx
    - web/src/modules/admin/components/orders.recipe.ts
    - web/src/modules/admin/ordersCopy.ts
  modified: []

key-decisions:
  - "dueDays throws a RangeError for text that is not a real YYYY-MM-DD day; dueFlagState never throws: an unreadable due date gives no flag and an unreadable today keeps the date and drops the flag"
  - "A status the types do not know shows the date only, so a new server status can never show a false overdue flag"
  - "The dot between date and flag is aria-hidden in the inline layout; the stacked layout has no dot"

patterns-established:
  - "orders.recipe.ts and ordersCopy.ts are the class and copy homes for all order screens in this phase"

requirements-completed: [ORD-11]

duration: 9min
completed: 2026-10-29
status: complete

coverage:
  - id: D1
    description: "dueDays and dueFlagState count whole calendar days between the server's business today and the due date and pick the flag kind for each status"
    requirement: "ORD-11"
    verification:
      - kind: unit
        ref: "web/src/utils/dueFlag.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "DueFlag shows the date with days left, tomorrow, today or the alert-icon overdue flag in the danger color, date only for delivered, completed and cancelled, and EmptyValue with no flag when there is no due date"
    requirement: "ORD-11"
    verification:
      - kind: automated_ui
        ref: "web/src/modules/admin/components/DueFlag.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "The device clock cannot change a flag: with the system clock at 23:30 and 00:30 Manila the output depends only on the today prop"
    requirement: "ORD-11"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/DueFlag.test.tsx#reads Due tomorrow at 23:30 Manila because only the today prop counts"
        status: pass
    human_judgment: false
---

# Phase 08 Plan 05: Due dates and overdue flags Summary

*Created: 2026-10-29T17:59:00-05:00 · Updated: 2026-10-29T17:59:00-05:00*

**Pure whole-day due count and a DueFlag component (days left, tomorrow, today, alert-icon overdue) driven only by the server's business date**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-29T22:49:38Z
- **Completed:** 2026-10-29T22:58:16Z
- **Tasks:** 2
- **Files modified:** 6 (all new, plus the Task 1 stubs replaced)

## Accomplishments

- `dueDays` subtracts two `YYYY-MM-DD` dates as UTC midnights, so leap days, month ends and year ends are exact and no time zone is used.
- `dueFlagState` maps a due date and status to `none`, `date-only`, `days-left`, `tomorrow`, `today` or `overdue`. Only Pending, Mockup, In Production and Ready can be flagged (D-37).
- `DueFlag` renders "Due Nov 3, 2026" with the flag in the UI-SPEC looks: muted for days left, bold ink for today and tomorrow, bold danger with a 14px `triangle-alert` icon (hidden from assistive technology) for overdue. Inline joins with a dot; stacked puts the flag 4px under the date.
- No due date renders "Due" plus `EmptyValue` and no flag (D-38, OR-4).
- The tracer slice (ORD-2026-0153, "Overdue by 3 days") passed end to end before the other cases were added. Tracer feedback gate: the verify command is automated only, so it was re-run and passed.

## Task Commits

1. **Task 1: tracer, overdue by 3 days from the server's today**
   - RED `2bd07317` (test): failing dueDays and DueFlag tests over stub exports
   - GREEN `84645b05` (feat): dueFlag.ts, DueFlag.tsx, ordersCopy.ts, orders.recipe.ts
2. **Task 2: every threshold, status and the device-clock guard** - `49e8073d` (test)

**Plan metadata:** the docs commit that holds this file (see git log).

## TDD Gate Compliance

- **RED (Task 1):** the stubs returned `0`, `{ kind: 'none' }` and `null`. The four target tests failed on their own assertions (for example `expected 0 to be -3`, and "Unable to find an element with the text: Due Oct 26, 2026"), not on import or setup errors. Semantic assessment: valid RED, each failure is the planned behavior missing. The `gsd_run check tdd-red-evidence` classifier was not run: Vitest here writes JUnit for Vitest's own layout, not a TAP report the classifier reads, so the semantic inspection above is the evidence.
- **GREEN:** `84645b05` made all four tests pass.
- **Task 2 had no separate RED.** Task 1's implementation already covered every case the Task 2 table lists, so the new tests passed on their first run (an unexpected green by design, not a wrong test). To prove the tests can fail, one mutation was tried: changing the tomorrow rule from `days === 1` to `days === 2` made 7 tests fail, then it was reverted with `git checkout`. No source change was needed in Task 2, so it is one `test` commit.
- No REFACTOR commit.

## Files Created/Modified

- `web/src/utils/dueFlag.ts` - `dueDays`, `dueFlagState`, the `DueFlagState` and `DueFlagKind` types.
- `web/src/utils/dueFlag.test.ts` - day-count, refusal and per-status state cases (25 tests).
- `web/src/modules/admin/components/DueFlag.tsx` - the component, a pure function of its props.
- `web/src/modules/admin/components/DueFlag.test.tsx` - thresholds, statuses, EmptyValue, 23:30 and 00:30 clock guards, layouts, axe (20 tests).
- `web/src/modules/admin/components/orders.recipe.ts` - `dueFlag*Classes` as complete Tailwind tokens (no `style` attribute, strict CSP).
- `web/src/modules/admin/ordersCopy.ts` - `ORDERS_COPY.due`.

## Decisions Made

- `dueDays` fails loudly (RangeError) on bad input because it is a utility; `dueFlagState` never throws, because a bad value from the server must not blank a whole list row. An unreadable due date has no flag; an unreadable today keeps the date and drops the flag.
- An unknown status shows the date only.
- The "·" in the inline layout is `aria-hidden`; the date and flag stay separate text for screen readers.

## Deviations from Plan

None - plan executed exactly as written. (The Task 2 "red first" step was green on first run, explained under TDD Gate Compliance; the plan said "then fix any gap" and there was none.)

## Issues Encountered

- First GREEN run of the Task 1 test failed because the test read the `text-danger` class from the inner text span while the class sits on the wrapper that also holds the icon. The test was corrected to look at `closest('.text-danger')`. No source change.
- Prettier reformatted three files after the first draft; applied before the GREEN commit.

## Verification

- `npm run test -- --run src/utils/dueFlag.test.ts src/modules/admin/components/DueFlag.test.tsx src/test/no-long-dash.node.test.ts`: 3 files, 46 tests passed.
- Full web suite `npm run test -- --run`: 208 files, 6201 tests passed.
- `npm run typecheck`: exit 0, no output errors. `npm run lint` (`eslint . --max-warnings 0`): exit 0, no output. Prettier check on the touched files: clean.
- Acceptance: `grep -n "new Date()"` on the two source files finds nothing; `setSystemTime` appears twice in DueFlag.test.tsx; a test is named with "Overdue by 3 days".
- gitleaks on each staged change: no leaks found.

## Known Stubs

None. The Task 1 RED stubs were replaced in the GREEN commit.

## Threat Flags

None. T-08-07 (device clock) is mitigated: `today` is a prop and the two system-clock tests prove it. T-08-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Cards, the table and the order page subline can import `DueFlag` and pass the server's business date as `today`. `ordersCopy.ts` and `orders.recipe.ts` now exist for the other order plans to extend.

The flagged ORD-11 assumption from the plan stays open for the verifier: day counts are whole calendar days between the server's `today` and the due date string, with no browser zone conversion.

---
*Phase: 08-order-screens*
*Completed: 2026-10-29*

## Self-Check: PASSED

- FOUND: web/src/utils/dueFlag.ts, web/src/utils/dueFlag.test.ts, web/src/modules/admin/components/DueFlag.tsx, web/src/modules/admin/components/DueFlag.test.tsx, web/src/modules/admin/components/orders.recipe.ts, web/src/modules/admin/ordersCopy.ts
- FOUND commits: 2bd07317, 84645b05, 49e8073d

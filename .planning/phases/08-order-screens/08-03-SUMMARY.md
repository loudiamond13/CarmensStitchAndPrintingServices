---
phase: 08-order-screens
plan: 03
subsystem: ui
tags: [react, confirm-dialog, tabs, select, a11y, tdd]
created: "2026-10-29T17:32:00-05:00"
updated: "2026-10-29T17:32:00-05:00"

requires:
  - phase: 06-expenses
    provides: "ConfirmDialog, Tabs and PaidBySelect with Phase 6 behaviour"
provides:
  - "ConfirmDialog cancelLabel (default Cancel), confirmIcon (default trash-2) and a describeFailure that may return a sentence or null"
  - "Tabs keeps the selected tab in view (nearest on both axes, smooth, auto under reduced motion)"
  - "PaidBySelect label, name and hint props (defaults Paid by, paidByUserId, expense hint)"
  - "jsdom scrollIntoView no-op in the shared test setup"
affects: [08-discard-guard, 08-cancel-order-dialog, 08-money-windows, order-page]

actuals:
  tokens: 9500
  tasks: 3
  commits: 6
plan_head_before: fe3d9fbb4e947592d005063b8b8635b6723bd3b0
plan_head_after: 00ec5c4db45412f466acd36a511742bfe791c131

tech-stack:
  added: []
  patterns:
    - "Shared parts grow by optional props whose defaults are today's behaviour, so older tests stay unchanged"
    - "Scroll-into-view effect keyed on the selected index, with a last-shown ref so first render and count changes never scroll"

key-files:
  created: []
  modified:
    - web/src/components/overlays/ConfirmDialog.tsx
    - web/src/components/overlays/ConfirmDialog.test.tsx
    - web/src/components/choice/Tabs.tsx
    - web/src/components/choice/Tabs.test.tsx
    - web/src/modules/admin/components/PaidBySelect.tsx
    - web/src/modules/admin/components/PaidBySelect.test.tsx
    - web/src/test/setup.ts

key-decisions:
  - "describeFailure keeps its existing title-and-body return and also accepts a plain sentence or null, so the five existing callers need no change"
  - "scrollIntoView is stubbed once in the shared test setup (jsdom has none) rather than guarded in component code"

requirements-completed: [ORD-07, ORD-15]

duration: 13min
completed: 2026-10-29
status: complete

coverage:
  - id: D1
    description: "ConfirmDialog takes cancelLabel, confirmIcon and a sentence-or-null describeFailure; Keep Editing takes first focus and Esc; old dialogs unchanged"
    requirement: "ORD-15"
    verification:
      - kind: unit
        ref: "web/src/components/overlays/ConfirmDialog.test.tsx#ConfirmDialog dismiss words, confirm icon and failure line (Phase 8)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedExpensesPage.test.tsx (Phase 6 dialog use, unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tabs scrolls the newly selected tab into view, smooth or instant under reduced motion, with no look change"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/components/choice/Tabs.test.tsx#Tabs keep the selected tab in view (Phase 8, D-34)"
        status: pass
    human_judgment: true
    rationale: "Whether the strip feels right on a real 320 px phone is a visual check; unit tests prove the scrollIntoView call only"
  - id: D3
    description: "PaidBySelect renders its own label, field name and hint; defaults stay Paid by and paidByUserId"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PaidBySelect.test.tsx#takes its label, field name and hint from props"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/ExpenseModal.test.tsx (Phase 6 picker use, unchanged)"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 03: Dialog words, tab keep-in-view and the people picker Summary

**ConfirmDialog, Tabs and PaidBySelect now take the Phase 8 words, scroll behaviour and field names by prop, with Phase 6 behaviour as the default and every Phase 6 test unchanged.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-29T22:19:00Z
- **Completed:** 2026-10-29T22:32:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- ConfirmDialog takes `cancelLabel`, `confirmIcon` and a `describeFailure` that can return a plain sentence. A dialog with "Keep Editing" and "Discard Changes" focuses Keep Editing first and Esc acts as Keep Editing.
- Tabs scrolls a newly selected tab into view (`block` and `inline` nearest, smooth, `auto` under reduced motion). It does not scroll on first render or when only the counts change.
- PaidBySelect takes `label`, `name` and `hint`, so the same picker reads "Received by", "Paid by" or "Refunded by".

## Task Commits

1. **Task 1: Discard dialog words (tracer)** - RED `9e3957ca` (test), GREEN `93c67d97` (feat)
2. **Task 2: Tabs keep the selected tab in view** - RED `c7cbfce4` (test), GREEN `ffa389ec` (feat)
3. **Task 3: One people picker** - RED `7b76246d` (test), GREEN `00ec5c4d` (feat)

**Plan metadata:** committed with this summary (docs: complete plan)

## TDD Gate Compliance

Each task has a `test(08-03)` commit before its `feat(08-03)` commit.

- RED 1: three new tests failed on the planned assertions (no "Keep Editing" button, no `lucide-x` icon, string failure line not shown). The default-words, axe and null-fallback checks passed, as they pin today's behaviour.
- RED 2: five tests failed with "expected scrollIntoView to be called" (click, ArrowRight, End, reduced motion, controlled value). The first-render and counts-only tests passed, as they pin the absence of a scroll.
- RED 3: the new label/name/hint test failed to find a combobox named "Received by". The defaults test passed (guards today's behaviour).
- Evidence came from the Vitest run output. `gsd_run check tdd-red-evidence` was not run: this plan is `type: execute`, not `type: tdd`.

## Files Created/Modified

- `web/src/components/overlays/ConfirmDialog.tsx` - `cancelLabel`, `confirmIcon`, sentence-or-null `describeFailure`.
- `web/src/components/choice/Tabs.tsx` - keep-in-view effect keyed on the selected index.
- `web/src/modules/admin/components/PaidBySelect.tsx` - `label`, `name`, `hint` props with Phase 6 defaults.
- `web/src/test/setup.ts` - no-op `Element.prototype.scrollIntoView` for jsdom.
- The three matching `*.test.tsx` files - new tests.

## Decisions Made

- `describeFailure` keeps its existing return shape (title and body) and now also accepts a sentence or null. The plan wrote `string | null`, but five callers (UsersPage, SettingsPage, DeactivateUserDialog, LockUserDialog and the Phase 6 test) already return title and body, and the plan requires them to stay unchanged. A plain sentence is shown as the title, so it gets a closing full stop only if it lacks one.
- `scrollIntoView` is stubbed once in the shared test setup, because jsdom has none and every page test that changes a tab would otherwise throw.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom has no `scrollIntoView`**
- **Found during:** Task 2
- **Issue:** the new effect calls `scrollIntoView` on tab changes, which exists in browsers but not in jsdom. Any page test that switches a tab would throw.
- **Fix:** added a configurable no-op to `web/src/test/setup.ts` next to the existing `matchMedia` stub. The Tabs tests spy on it.
- **Files modified:** `web/src/test/setup.ts` (not in the plan's `files_modified`)
- **Verification:** full web suite passes (202 files, 6110 tests).
- **Committed in:** `c7cbfce4`

**2. [Rule 1 - Contract mismatch] `describeFailure` return type**
- **Found during:** Task 1
- **Issue:** the plan's `(error) => string | null` conflicts with the existing `ErrorCopy | undefined` contract used by five callers.
- **Fix:** accept `ErrorCopy | string | null | undefined`. No caller changed.
- **Files modified:** `web/src/components/overlays/ConfirmDialog.tsx`
- **Verification:** typecheck clean; Phase 6 and Phase 2 dialog tests pass unchanged.
- **Committed in:** `93c67d97`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 contract mismatch)
**Impact on plan:** both keep the plan's promise that old behaviour is unchanged. No scope creep.

## Issues Encountered

None. The tracer gate (interactive, end-of-phase, automated-only verify) was re-run after Task 1 and passed, so expansion went ahead.

## Verification Results

- `npm --prefix web run test -- --run` (full): Test Files 202 passed, Tests 6110 passed.
- `npm --prefix web run typecheck`: clean.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): clean.
- Prettier check on all changed files: clean.
- gitleaks on every staged change: no leaks found.
- Acceptance: `cancelLabel` appears 3 times in ConfirmDialog.tsx; `scrollIntoView` and `prefers-reduced-motion` are in Tabs.tsx; `name="paidByUserId"` no longer appears in PaidBySelect.tsx; the tests name "Keep Editing" and "Received by".

## Known Stubs

None.

## Threat Flags

None. T-08-05 is met: `describeFailure` only shows client-written text, and anything it does not name falls back to `describeHttpError` (fixed text plus trace id). T-08-SC is met: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The discard guard, cancel-order dialog and money windows can use the new props directly. The "(you)" preselection is still set by the caller passing the signed-in user as `value`, as in Phase 6.

## Self-Check: PASSED

---
*Phase: 08-order-screens*
*Completed: 2026-10-29*

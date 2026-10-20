---
phase: 05-profile-user-management
plan: 28
subsystem: ui
tags: [react, tanstack-query, dialogs, focus-management, users-roster, playwright]

requires:
  - phase: 05-profile-user-management
    provides: "05-21 deactivate/activate routes, 05-25 roster Edit row and focus registry, 05-26 delete route with the last-Manager and own-account guards"
provides:
  - "Roster row actions: status toggle (Deactivate behind DeactivateUserDialog, one-tap Activate) and Delete behind the shared ConfirmDialog"
  - "usersService.deactivate, activate (POST with Idempotency-Key) and remove (DELETE)"
  - "SignOutDialog.confirmIcon and describeFailure; ConfirmDialog.pendingLabel and describeFailure"
  - "usersGuards.describeUserGuard: last-active-Manager, own-account and deleted-meanwhile words for dialogs and toasts"
  - "useUserAction: one Idempotency-Key per attempt and a fresh one per intent"
affects: [05-29, 05-30, 05-31, 05-37, phase-5-verification]

actuals:
  tokens: 15000
  tasks: 3
  commits: 6
plan_head_before: f122b3cc4689b5cc61538f446bbabca1b6592781
plan_head_after: cb0cba0b6a9d92a08a6fc4d0fc2773d19f517963
commits: 6

tech-stack:
  added: []
  patterns:
    - "describeFailure prop on the confirm dialogs: a caller words the refusals it knows, describeHttpError speaks for the rest"
    - "useUserAction: useSubmission whose identity carries a generation that moves on once the roster has read again, so a repeated intent on the same person is a new submission"
    - "Focus after a removal is chosen at confirm time and applied by a render effect once the refreshed list no longer holds the row"

key-files:
  created:
    - web/src/modules/admin/components/DeactivateUserDialog.tsx
    - web/src/modules/admin/components/DeactivateUserDialog.test.tsx
    - web/src/modules/admin/hooks/useUserAction.ts
    - web/src/modules/admin/usersGuards.ts
  modified:
    - web/src/modules/admin/pages/UsersPage.tsx
    - web/src/modules/admin/pages/UsersPage.test.tsx
    - web/src/modules/admin/services/usersService.ts
    - web/src/modules/admin/services/usersService.test.ts
    - web/src/modules/admin/usersCopy.ts
    - web/src/modules/admin/components/SignOutDialog.tsx
    - web/src/components/overlays/ConfirmDialog.tsx
    - web/src/components/overlays/ConfirmDialog.test.tsx
    - web/e2e/users.spec.ts
    - .planning/phases/05-profile-user-management/deferred-items.md

key-decisions:
  - "Guard and deleted-meanwhile words ride a describeFailure prop on SignOutDialog and ConfirmDialog (undefined falls back to describeHttpError) instead of forking the dialogs"
  - "ConfirmDialog gained an optional pendingLabel so the delete button reads 'Deleting' while it runs (UI-SPEC pending label); other callers are unchanged"
  - "A 404 on Deactivate or Delete keeps the dialog open with 'This user was deleted. Close this and refresh the list.' (the plan's 'closes nothing')"
  - "Focus after a delete skips the signed-in Manager's own row (it has a link, no Edit button): next other row, else previous other row, else the h1"

patterns-established:
  - "Row-action toggles keep their own useRowFocus registry beside the Edit registry"
  - "Dialogs for a roster row render in the page root only after the first open and stay mounted with open=false so the exit plays"

requirements-completed: [USER-03, USER-04]

coverage:
  - id: D1
    description: "Each other row has the status toggle (user-x 'Deactivate {first}' for Active and Locked, user-check 'Activate {first}' for Inactive, same title) and a danger 'Delete {First Last}'; the signed-in Manager's own row has neither (USER-03, OQ-1, D-19)"
    requirement: USER-03
    verification:
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/UsersPage.test.tsx#gives every other row a status toggle"
        status: pass
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/UsersPage.test.tsx#gives every other row a danger trash button"
        status: pass
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users-actions deleting a colleague removes the row and ends their access"
        status: pass
    human_judgment: false
  - id: D2
    description: "Deactivate opens DeactivateUserDialog with 'Keep Active' focused; confirming turns the row Inactive, flips the toggle to 'Activate {first}' with focus and toasts 'User deactivated'; Activate acts at once with its toast; a failed Activate is a persistent danger toast (USER-03, OQ-3)"
    requirement: USER-03
    verification:
      - kind: automated_ui
        ref: "web/src/modules/admin/components/DeactivateUserDialog.test.tsx"
        status: pass
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/UsersPage.test.tsx#U4 Deactivate and Activate from the page"
        status: pass
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users-actions deactivating a signed-in colleague ends their session"
        status: pass
    human_judgment: false
  - id: D3
    description: "Delete opens the shared ConfirmDialog with the amended message and Cancel focused, no type-to-confirm; success removes the row, toasts 'User deleted' and moves focus to the next row's Edit, else the previous row's, else the h1"
    requirement: USER-03
    verification:
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/UsersPage.test.tsx#U4 Delete from the page"
        status: pass
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users-actions deleting a colleague removes the row and ends their access"
        status: pass
    human_judgment: false
  - id: D4
    description: "Failure rule on every dialog: the dialog stays open with the guard or mapper line in a role alert (last active Manager, deleted meanwhile, server error), the primary leaves pending and takes focus, a retry reuses the Idempotency-Key (POST) or repeats the DELETE"
    requirement: USER-04
    verification:
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/UsersPage.test.tsx#keeps the dialog open with the last-Manager guard line"
        status: pass
      - kind: unit
        ref: "web/src/components/overlays/ConfirmDialog.test.tsx#words a failure the caller recognises through describeFailure"
        status: pass
    human_judgment: false
  - id: D5
    description: "USER-05 in the browser: deactivating a signed-in colleague ends their session at once (their next move shows 'Your session ended'), activating lets them sign in again, a deleted person cannot sign in; both dialogs fit a 320 px phone with zero axe violations"
    requirement: USER-03
    verification:
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users-actions (3 tests x 5 projects)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The last-active-Manager refusal is shown as the guard line in a real browser against the real API"
    requirement: USER-04
    verification:
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/UsersPage.test.tsx#keeps the dialog open with the last-Manager guard line and focus on Delete User for a 422"
        status: pass
    human_judgment: true
    rationale: "The shared CSPS_E2E database always holds many active Managers, so the 422 cannot be provoked end to end; the refusal itself is proven by the 05-26 API integration tests and the line by the MSW page tests"
  - id: D7
    description: "Wording of the Deactivate dialog, the Activate and Delete toasts and the row action names was built from the UI-SPEC (SPEC-GAP copy) and is not yet approved by the owner (D-48)"
    verification: []
    human_judgment: true
    rationale: "Owner ruling D-48: built, not yet approved; reviewed on the rendered screens in the 05-37 review"

duration: 42min
completed: 2026-10-18
status: complete
created: 2026-10-18T09:58:00-05:00
updated: 2026-10-18T09:58:00-05:00
---

# Phase 5 Plan 28: Roster Row Actions Summary

**The Users roster gets a Deactivate / Activate toggle (Deactivate behind a "Keep Active"-first confirm, Activate in one tap) and Delete behind the shared ConfirmDialog, with guard lines, focus that never gets lost, and 15 passing browser runs.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-10-18T09:15:00-05:00
- **Completed:** 2026-10-18T09:58:00-05:00
- **Tasks:** 3
- **Files modified:** 13 code files (4 created) plus `deferred-items.md`

## Accomplishments

- Every other roster row now shows three buttons: Edit, the status toggle (`user-x` "Deactivate {first}" for Active and Locked people, `user-check` "Activate {first}" for Inactive, same title) and a danger `trash-2` "Delete {First Last}". The signed-in Manager's own row still has only the My Profile link (D-19).
- Deactivate opens `DeactivateUserDialog` (a thin wrapper over `SignOutDialog` with the `user-x` confirm icon). "Keep Active" has the focus. Confirming closes the dialog, the row turns Inactive, the toggle flips to "Activate {first}" and takes focus, and the toast says "User deactivated". Activate acts at once, keeps focus on the flipped toggle and toasts "User activated"; a failed Activate is a danger toast that stays ("Couldn't activate {First Last}" plus the mapper line).
- Delete opens the shared `ConfirmDialog` with the amended OQ-7 message, Cancel focused, no type-to-confirm and a "Deleting" pending label. After success focus goes to the next row's Edit button, else the previous row's, else the page `h1`.
- The failure rule holds for both dialogs: the dialog stays open, the guard line shows in a `role="alert"` ("You can't remove the last active Manager. Make another user a Manager first, then try again."; "This user was deleted. Close this and refresh the list." for a 404), the primary leaves pending and takes focus. A POST retry reuses its Idempotency-Key; a DELETE retry repeats the DELETE.
- Browser proof (`@users-actions`, five projects): deactivating a signed-in colleague ends their session in their own browser, activating lets them sign in again, a deleted person cannot sign in, a Manager's own row has no toggle or Delete, another Manager can be deleted, and both dialogs fit 320 x 568 with no sideways scroll and zero axe violations.

## Task Commits

1. **Task 1 (tracer): deactivate and activate from the roster** - `620cdbf` (test, RED), `4d9dd74` (feat, GREEN)
2. **Task 2: delete with the shared confirm, focus and guard line** - `9bf2157` (test, RED), `343b88b` (test, RED for the Deleting label), `1a909ee` (feat, GREEN)
3. **Task 3: browser proof** - `cb0cba0` (test; its RED evidence is the Vitest failures of Tasks 1-2, as the plan states)

**Plan metadata:** the docs(05-28) commit that carries this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md and the deferred-items note.

## TDD Gate Compliance

The plan type is `execute` with `tdd="true"` tasks, so `gsd_run check tdd-red-evidence` was not run (the project's Vitest output is not one of its supported report formats here); RED was inspected by hand against the real failing assertions. Each feature commit has its `test(05-28)` commit before it. No REFACTOR commit was needed.

- **RED 1 (`620cdbf`):** against `not implemented` service stubs and a dialog stub that renders nothing, 28 tests failed on the planned behavior across the three files: no `Deactivate {first}` / `Activate {first}` buttons, no `Deactivate User` button or dialog, the service methods rejecting "not implemented", and axe finding an empty container. Semantic assessment: every failure was a missing element or an unmet assertion, no import, syntax or fixture fault. The "renders nothing while open is false" case passed against the stub and stayed a regression guard.
- **GREEN 1 (`4d9dd74`):** 110 of 110 in the five touched test files, then 2475 across `src/modules/admin`, `src/components` and `src/test`.
- **RED 2 (`9bf2157`, `343b88b`):** 11 tests failed (no `Delete {name}` button anywhere in the page, `describeFailure` ignored by ConfirmDialog), then 2 more for the "Deleting" label (the prop was accepted but unused). Semantic assessment: all on the planned assertions.
- **GREEN 2 (`1a909ee`):** 228 of 228 in the page and overlay tests, then 2816 across admin, components, test and dev.

## Files Created/Modified

- `web/src/modules/admin/components/DeactivateUserDialog.tsx` and `.test.tsx` - the U4 deactivate confirm (OQ-3) and its 10 tests.
- `web/src/modules/admin/hooks/useUserAction.ts` - one roster action on one person through `useSubmission`.
- `web/src/modules/admin/usersGuards.ts` - `describeUserGuard` for the 422 guard codes and the 404.
- `web/src/modules/admin/pages/UsersPage.tsx` (+ test) - the toggle, Delete, the two dialogs, the activate submission, toasts and focus rules.
- `web/src/modules/admin/services/usersService.ts` (+ test) - `deactivate`, `activate`, `remove`.
- `web/src/modules/admin/usersCopy.ts` - row action names, dialog copy, toasts.
- `web/src/modules/admin/components/SignOutDialog.tsx` - `confirmIcon` and `describeFailure`.
- `web/src/components/overlays/ConfirmDialog.tsx` (+ test) - `pendingLabel` and `describeFailure`.
- `web/e2e/users.spec.ts` - three `@users-actions` tests, and the roster test's per-row button count is now three.

## Decisions Made

- The guard words travel as a `describeFailure` prop on the two confirm dialogs rather than a forked component, so every other caller keeps the `describeHttpError` line.
- `ConfirmDialog` gained `pendingLabel` for the UI-SPEC "Deleting" pending text; without it the shared dialog could only show a spinner.
- Focus after a delete skips the signed-in Manager's own row, which has no Edit button to land on.
- A repeated action on the same person (deactivate, activate, deactivate) must send a request each time. `useSubmission` treats equal data after a success as the same submission, so `useUserAction` moves a generation counter once the roster has read again.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Guard words needed a hook into the shared dialogs**
- **Found during:** Task 1 and Task 2
- **Issue:** `SignOutDialog` and `ConfirmDialog` always worded failures with `describeHttpError`, so the plan's "map 422 guard codes to the guard line" had nowhere to go, and ConfirmDialog could not show "Deleting".
- **Fix:** Optional `describeFailure` on both dialogs, optional `confirmIcon` on SignOutDialog and optional `pendingLabel` on ConfirmDialog. Defaults leave every existing caller unchanged; tests for both new ConfirmDialog props were added.
- **Files modified:** `SignOutDialog.tsx`, `ConfirmDialog.tsx`, `ConfirmDialog.test.tsx`
- **Committed in:** `4d9dd74`, `343b88b` and `1a909ee`

**2. [Rule 1 - Bug] Repeating an action on the same person would have sent nothing**
- **Found during:** Task 1 (design review of `useSubmission`)
- **Issue:** `useSubmission` returns the stored success for equal data, so Activate then Deactivate then Activate again on the same person would skip the third request.
- **Fix:** `useUserAction` keys the submission identity on the person plus a generation that moves on after the roster has refreshed. A test (deactivate, activate, deactivate) proves three requests with three keys.
- **Files modified:** `useUserAction.ts`, `UsersPage.test.tsx`
- **Committed in:** `620cdbf` (test) and `4d9dd74`

**3. [Rule 1 - Bug] The roster e2e test counted one button per row**
- **Found during:** Task 3
- **Issue:** `@users` asserted another person's row has exactly one button; it now has three.
- **Fix:** Updated the assertion and its comment.
- **Files modified:** `web/e2e/users.spec.ts`
- **Committed in:** `cb0cba0`

**4. [Plan wording not achievable] "With only two Managers" in the browser**
- **Found during:** Task 3
- **Issue:** The shared `CSPS_E2E` database holds many active Managers from other tests, so the last-active-Manager 422 cannot be provoked end to end.
- **Fix:** The e2e proves the achievable part (a Manager deletes another Manager; the Manager's own row has no toggle or Delete). The refusal and its line are proven by the 05-26 API tests and by `UsersPage.test.tsx` (422 in both dialogs). Listed as `D6` with `human_judgment: true` in the coverage block.
- **Committed in:** `cb0cba0`

---

**Total deviations:** 4 (2 auto-fixed bugs, 1 blocking, 1 plan wording adjusted)
**Impact on plan:** No scope creep; the shared-dialog props are optional and backward compatible.

## Issues Encountered

- Firefox printed its "font preloaded but not used" console warning during the long `@users-actions` journey under 4 workers, and once in the untouched first `@users` test under 2 workers. This is the existing deferred item (05-08, 05-18); both tests pass alone and at 2 workers. The note was extended in `deferred-items.md`. The final `@users` run: 59 passed, 1 Firefox warning (passes alone).
- `web/e2e` and `web` unit suites, lint, types, format, coverage, license and notices gates all pass (`npm --prefix web run verify` exit 0).

## Known Stubs

None. The RED-phase stubs were replaced in the GREEN commits.

## Threat Flags

None. No new endpoints or trust boundaries: the plan only calls the 05-21 and 05-26 routes. T-05-81 (accidental destructive tap) is mitigated by the confirm dialogs with a safe dismiss focused first and the danger Delete styling; T-05-82 (double submission) by the WEB-09 pending state, one Idempotency-Key per POST attempt, and a DELETE that answers 404 on a repeat.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Row actions are in place for the Lock / Unlock, Resend Invitation and Send Reset Link actions of the next plans; `describeUserGuard`, `useUserAction` and the toggle focus registry are reusable.
- Owner wording review (D-48) of the Deactivate dialog, Activate and Delete toasts and row action names stays for the 05-37 screen review.

## Self-Check: PASSED

- Created files present: `DeactivateUserDialog.tsx`, `DeactivateUserDialog.test.tsx`, `useUserAction.ts`, `usersGuards.ts`.
- Commits present on the branch: `620cdbf`, `4d9dd74`, `9bf2157`, `343b88b`, `1a909ee`, `cb0cba0`.
- Acceptance criteria: `export function DeactivateUserDialog` count 1; SPEC-DEVIATION OQ-1 / OQ-3 markers in `UsersPage.tsx` and `DeactivateUserDialog.tsx`; `This can't be undone.` appears once in `usersCopy.ts`; `ConfirmDialog` appears in `UsersPage.tsx`; `@users-actions` appears in `users.spec.ts`.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*

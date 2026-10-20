---
phase: 05-profile-user-management
plan: 02
subsystem: ui
tags: [react, tailwind, keyframes, dialogs, motion, a11y, playwright]

requires:
  - phase: 02-web-foundation-design-system
    provides: Modal, ConfirmDialog, focus trap, inert-outside and scroll-lock hooks, overlay recipe, class gate and stylesheet contract
  - phase: 05-profile-user-management (plan 01)
    provides: shell height chain the dialogs sit on
provides:
  - usePresence hook (exit-animation presence, no package)
  - csp-*-out, csp-drawer-in/out and csp-pop-in/out theme keyframes (the drawer and pop ones are for 05-08)
  - Modal and ConfirmDialog that animate open and close at every width, with data-state on the overlay and dialog
  - open prop (default true) on ConfirmDialog, SignOutDialog, SignOutOthersDialog, SignOutDeviceDialog
  - web/e2e/motion.spec.ts (tag @motion), docs/web/styling.md section 8
affects: [05-08 phone drawer and user menu motion, every later phase that uses Modal or ConfirmDialog]

actuals:
  tokens: 12345
  tasks: 3
  commits: 6
plan_head_before: c6e7e1f3aeb18c2edc3034160c9e32fb53f23404
plan_head_after: df1c5f3f6b992c79ee5a6c75d44a6c2d8ab33f80

tech-stack:
  added: []
  patterns:
    - "Exit motion: theme @keyframes plus data-[state=closed]:animate-csp-*-out utilities, kept mounted by usePresence"
    - "Reset-on-reopen via the React adjust-state-while-rendering pattern (previous open tracked in state, no effect)"

key-files:
  created:
    - web/src/hooks/usePresence.ts
    - web/src/hooks/usePresence.test.ts
    - web/e2e/motion.spec.ts
  modified:
    - web/src/ui/app.css
    - web/src/components/overlays/overlays.recipe.ts
    - web/src/components/overlays/overlays.recipe.node.test.ts
    - web/src/components/overlays/Modal.tsx
    - web/src/components/overlays/Modal.test.tsx
    - web/src/components/overlays/ConfirmDialog.tsx
    - web/src/components/overlays/ConfirmDialog.test.tsx
    - web/src/modules/admin/components/SignOutDialog.tsx
    - web/src/modules/admin/components/SignOutOthersDialog.tsx
    - web/src/modules/admin/components/SignOutDeviceDialog.tsx
    - web/src/modules/admin/components/SignOutOthersDialog.test.tsx
    - web/src/modules/admin/components/SignOutDeviceDialog.test.tsx
    - docs/web/styling.md

key-decisions:
  - "The presence node is the dialog panel, not the scrim: the slide-over exit (0.2 s) outlasts the scrim fade (0.15 s), so the dialog's own animationend decides when everything leaves."
  - "usePresence decides in a layout effect, so a node with no animation is gone before paint (and under WebKit reduced motion, not a later task)."
  - "Inline dialogs in an Overlay region get no exit classes (they keep animate-none) and unmount at once."
  - "The closing overlay is also inert, on top of pointer-events-none, so no focus or click can reach a dialog that is only playing its exit."
  - "Callers are left as they are; 05-08 converts them to keep the dialogs mounted so the exit plays."

patterns-established:
  - "Every animated element carries motion-reduce:animate-none, and an exit utility adds motion-reduce:data-[state=closed]:animate-none beside it (the data selector outranks the plain media variant)."
  - "Dialog e2e opens by keyboard (focus, Enter): WebKit does not focus a button on a mouse click, so the focus trap would remember the body."

requirements-completed: [USER-03]

coverage:
  - id: D1
    description: "Modal (centred, phone bottom sheet and slide-over) and ConfirmDialog animate on open and on close; the close finishes before the dialog leaves the DOM"
    requirement: USER-03
    verification:
      - kind: unit
        ref: "web/src/components/overlays/Modal.test.tsx#Modal closing animation (D-38, D-39)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @motion (@motion dialog, chromium, firefox, webkit, pixel, iphone)"
        status: pass
    human_judgment: false
  - id: D2
    description: "On close start focus returns to the trigger, the page is live, scroll lock is released, the closing layer takes no clicks and Esc, and stacked dialogs answer Esc only on top"
    requirement: USER-03
    verification:
      - kind: unit
        ref: "web/src/components/overlays/Modal.test.tsx#ignores Esc and a scrim click while it closes"
        status: pass
      - kind: e2e
        ref: "web/e2e/motion.spec.ts#@motion dialog"
        status: pass
    human_judgment: false
  - id: D3
    description: "Motion uses Tailwind animate utilities over @keyframes inside @theme (150 to 250 ms, transform and opacity), nothing moves under prefers-reduced-motion, and layout shift stays under 0.05"
    requirement: USER-03
    verification:
      - kind: unit
        ref: "web/src/components/overlays/overlays.recipe.node.test.ts#Dialog exit motion (D-38, D-39)"
        status: pass
      - kind: e2e
        ref: "web/e2e/motion.spec.ts#@motion reduced and @motion cls"
        status: pass
    human_judgment: false
  - id: D4
    description: "usePresence unmounts at once with no animation, waits for the node's own animationend (child events ignored) or 300 ms, and cancels on reopen"
    requirement: USER-03
    verification:
      - kind: unit
        ref: "web/src/hooks/usePresence.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "ConfirmDialog and the SignOut dialogs accept open (default true) and reset typed text, pending flag and failure line each time they open again"
    requirement: USER-03
    verification:
      - kind: unit
        ref: "web/src/components/overlays/ConfirmDialog.test.tsx#ConfirmDialog open prop (D-39)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/SignOutOthersDialog.test.tsx#SignOutOthersDialog open prop (D-39)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/SignOutDeviceDialog.test.tsx#SignOutDeviceDialog open prop (D-39)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The approved open looks are unchanged (parity look-equality rows for overlays stay equal)"
    requirement: USER-03
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep \"@parity @overlays\" (18 passed)"
        status: pass
    human_judgment: false

duration: 29min
completed: 2026-10-17
status: complete
created: "2026-10-17T19:36:00-05:00"
updated: "2026-10-17T19:36:00-05:00"
---

# Phase 5 Plan 02: Dialog open and close motion Summary

**Every Modal, slide-over and ConfirmDialog now fades, scales or slides out as well as in, using theme keyframes plus an in-house `usePresence` hook, with focus, inert page and scroll lock released the moment close starts and no new package.**

## Performance

- **Duration:** 29 min (about; start taken from the first commit time of the plan)
- **Started:** 2026-10-17T19:08:21-05:00
- **Completed:** 2026-10-17T19:36:00-05:00
- **Tasks:** 3 (Task 1 tracer, Task 2 and Task 3 auto)
- **Files modified:** 16 (3 created, 13 modified)

## Accomplishments

- `usePresence(open)` returns `{ mounted, state, ref }`. A closing node stays mounted only until its own `animationend` (child events are ignored) or a 300 ms fallback, and leaves in the same commit when it has no animation (jsdom, reduced motion). Reopening while it closes cancels the unmount.
- app.css `@theme` gained `csp-fade-out`, `csp-rise-out`, `csp-slide-out` (dialogs) and `csp-drawer-in/out`, `csp-pop-in/out` (for 05-08), all 150 to 200 ms, transform and opacity only, each with its `@keyframes` inside `@theme`.
- The overlay recipe adds `data-[state=closed]:animate-csp-*-out`, `pointer-events-none` on the scrim and `motion-reduce:data-[state=closed]:animate-none`; inline dialogs keep `animate-none`.
- `Modal` routes `open` through `usePresence`, sets `data-state` on the overlay and dialog, passes `active: open` to the focus trap, `!inline && open` to the inert hook and `open` to the scroll lock, and ignores Esc and scrim clicks while closing.
- `ConfirmDialog`, `SignOutDialog`, `SignOutOthersDialog` and `SignOutDeviceDialog` take `open` (default true) and start clean on every open.
- `web/e2e/motion.spec.ts` proves it in Chromium, Firefox, WebKit, Pixel and iPhone: exit keyframes run while focus is already back on the trigger, reduced motion is instant, layout shift is under 0.05 (Chromium reports it).
- `docs/web/styling.md` has a new section 8 "Motion" (keyframes, 150 to 250 ms rule, `motion-reduce`, `usePresence`, no animation package).

## TDD Gate Compliance

Plan type is `execute` with `tdd="true"` tasks. RED then GREEN commits exist for Tasks 1 and 2; Task 3 is browser proof (the plan names the Task 1 Vitest failure as its RED evidence).

- **RED (Task 1):** `87b1e54` `test(05-02): dialogs animate out before unmount (RED)`. Target test `stays mounted as closed until the node ends its own animation` in `web/src/hooks/usePresence.test.ts` failed on `expected false to be true` (the stub returned `mounted: open`). `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`, Vitest TAP report, exit 1). Semantic assessment: the target executed and failed on the planned assertion (mounted must stay true while the exit runs), not on a load, syntax or fixture fault. The Modal closing tests and the recipe tests failed on their planned assertions too (missing `data-state`, missing closed-state tokens and keyframes).
- **GREEN (Task 1):** `e001d3d` `feat(05-02): dialogs and slide-overs animate open and close (D-39)`.
- **RED (Task 2):** `52f84f9` `test(05-02): confirm dialogs take open and reset on reopen (RED)`. 8 tests failed on the planned assertions (open ignored, state not reset).
- **GREEN (Task 2):** `6c00178` `feat(05-02): confirm and sign-out dialogs animate closed (D-39)`.
- **Task 3:** `16e4a4d` `test(05-02): motion proof in three engines`, then `df1c5f3` `feat(05-02): motion verified in three engines; rules documented (D-38)`.
- No REFACTOR commit was needed.

## Task Commits

1. **Task 1: Tracer, Add Payment dialog fades and scales out, focus back at once** - `87b1e54` (test, RED), `e001d3d` (feat)
2. **Task 2: ConfirmDialog and SignOut dialogs take `open` and start clean** - `52f84f9` (test, RED), `6c00178` (feat)
3. **Task 3: Browser proof in three engines, motion rules documented** - `16e4a4d` (test), `df1c5f3` (feat)

**Plan metadata:** recorded in the docs commit after this file.

Tracer gate: `HUMAN_VERIFY_MODE` is `end-of-phase` and the tracer `<verify>` is automated-only, so the verify (`npm --prefix web run test -- --run src/hooks src/components/overlays`) was re-run after the GREEN commit and passed; "Tracer verified end-to-end, expanding".

## Files Created/Modified

- `web/src/hooks/usePresence.ts` - exit-animation presence hook (layout effect, callback ref, 300 ms fallback)
- `web/src/hooks/usePresence.test.ts` - nine hook cases with a mocked computed animation name and fake timers
- `web/src/ui/app.css` - seven `--animate-csp-*` tokens and their `@keyframes` inside `@theme`
- `web/src/components/overlays/overlays.recipe.ts` - closed-state exit utilities for the scrim, centred dialog and slide-over
- `web/src/components/overlays/Modal.tsx` - presence wrapper, `data-state`, release of trap, inert and scroll lock at close start, closing guards
- `web/src/components/overlays/ConfirmDialog.tsx` - `open` prop and reset on reopen
- `web/src/modules/admin/components/SignOutDialog.tsx`, `SignOutOthersDialog.tsx`, `SignOutDeviceDialog.tsx` - `open` prop (and reset in `SignOutDialog`)
- `web/e2e/motion.spec.ts` - `@motion dialog`, `@motion reduced`, `@motion cls`
- `docs/web/styling.md` - section 8 "Motion"; animations list updated; timestamp refreshed
- Tests extended: `Modal.test.tsx`, `overlays.recipe.node.test.ts`, `ConfirmDialog.test.tsx`, `SignOutOthersDialog.test.tsx`, `SignOutDeviceDialog.test.tsx`

## Decisions Made

- The presence node is the dialog panel. With the scrim as the node, the slide-over exit (0.2 s) would be cut short by the scrim's 0.15 s fade; the panel's own `animationend` is the longest one and the scrim, which ends with `forwards`, stays faded until then.
- `usePresence` decides in a layout effect (see Deviations 2).
- The closing overlay is `inert` as well as `pointer-events-none`.
- Reset on reopen uses the React "adjust state while rendering" pattern; `inFlight` stays as it is, so a destructive action that is still in flight cannot be started a second time by reopening.
- Inline dialogs (Overlay region mock-ups) get no exit classes and unmount at once.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `inert` on the closing overlay**
- **Found during:** Task 1 (threat T-05-04)
- **Issue:** The plan releases the trap, inert page and scroll lock and sets `pointer-events-none`, but keyboard focus could still Tab into a dialog that is only playing its exit, which is the T-05-04 concern (a destructive dialog re-triggered blindly).
- **Fix:** `MountedModal` sets `inert` on the overlay while `open` is false.
- **Files modified:** `web/src/components/overlays/Modal.tsx`
- **Verification:** Modal closing unit tests; `@motion dialog` in five projects.
- **Committed in:** `e001d3d`

**2. [Rule 1 - Bug] WebKit left a no-animation dialog attached for a task**
- **Found during:** Task 3 (`@motion reduced` in webkit and iphone)
- **Issue:** With the unmount decided in a passive effect, a closing dialog with `animation-name: none` was still attached 40 ms after Cancel in WebKit (state closed, name `none`, focus already on the trigger).
- **Fix:** `usePresence` decides in `useLayoutEffect`, so the node leaves before paint; behavior in jsdom and the other engines is unchanged.
- **Files modified:** `web/src/hooks/usePresence.ts`
- **Verification:** `npm --prefix web run e2e -- --grep @motion` 22 passed, 3 skipped; hook and overlay unit tests pass.
- **Committed in:** `df1c5f3`

**3. [Rule 3 - Blocking] E2E opens dialogs by keyboard**
- **Found during:** Task 3
- **Issue:** WebKit does not focus a button on a mouse click, so the focus trap remembered `body` and "focus is back on the button" could not hold after a mouse open (the same reason `keyboard.spec.ts` opens by keyboard).
- **Fix:** `openFromTrigger` focuses the trigger and presses Enter.
- **Files modified:** `web/e2e/motion.spec.ts`
- **Committed in:** `16e4a4d`, formatting in `df1c5f3`

---

**Total deviations:** 3 auto-fixed (1 Rule 2, 1 Rule 1, 1 Rule 3)
**Impact on plan:** All three were needed for correctness of the plan's own promises (focus, inert, no motion under reduced motion, three engines). No scope creep and no new package.

## Issues Encountered

- The `@motion cls` case is skipped in Firefox, WebKit and iPhone because those engines do not report `layout-shift` entries; Chromium and Pixel prove it (the skip names the reason). Layout shift cannot arise from transform and opacity keyframes in any engine.
- The parity overlays rows (`@parity @overlays`, 18 cases in three engines) stayed equal, so no `P5 D-39` ruling group was added to `web/visual/reference/rulings.css` or `rulings.test.ts`; both files are unchanged.
- Known edge, left as is: if a confirm is reopened while its previous action is still in flight, the button looks idle but a confirm click is ignored until that action settles (the `inFlight` guard protects destructive actions).

## Known Stubs

None.

## Threat Flags

None. Keyframes live in the bundled stylesheet; no style attribute, no injected style element, no new package (T-05-03). T-05-04 is covered by the Modal closing tests and the `inert` addition. The e2e CSP and console guard stayed green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-08 can use `usePresence`, `animate-csp-drawer-in/out` and `animate-csp-pop-in/out`, and should keep `Modal`, `ConfirmDialog` and the SignOut dialogs mounted with `open` so their exit plays (callers still mount them conditionally today and so get no exit).
- Verification evidence: `npm --prefix web run verify` exit 0; `npm --prefix web run e2e -- --grep @motion` 22 passed, 3 skipped; `npm --prefix web run parity -- --grep "@parity @overlays"` 18 passed.

## Self-Check: PASSED

- Files exist: `web/src/hooks/usePresence.ts`, `web/src/hooks/usePresence.test.ts`, `web/e2e/motion.spec.ts`, `docs/web/styling.md` (FOUND).
- Commits are ancestors of HEAD: `87b1e54`, `e001d3d`, `52f84f9`, `6c00178`, `16e4a4d`, `df1c5f3` (FOUND).
- Acceptance criteria: `export function usePresence` count 1; theme keyframes count 7; `data-[state=closed]:animate-csp` lines in the recipe 3; `usePresence` in `Modal.tsx` 3; `open?: boolean` in `ConfirmDialog.tsx` 1; `open` in `SignOutDialog.tsx` 10; `@motion` in the spec 3; `usePresence` in `docs/web/styling.md` 2 with a refreshed timestamp.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-17*

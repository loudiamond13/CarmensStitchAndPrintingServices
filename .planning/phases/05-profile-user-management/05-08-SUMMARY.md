---
phase: 05-profile-user-management
plan: 08
subsystem: ui
tags: [react, tailwind, motion, usePresence, navigation, drawer, user-menu, dialogs, playwright]
created: 2026-10-17T21:52:00-05:00
updated: 2026-10-17T21:52:00-05:00

requires:
  - phase: 05-profile-user-management
    provides: "05-02: usePresence, theme keyframes (csp-drawer-in/out, csp-pop-in/out, csp-fade/-out) and dialogs that take an open prop"
provides:
  - "Phone navigation drawer that slides in and out with the scrim fading, driven by usePresence (D-34)"
  - "Menu button named Open navigation / Close navigation to follow the drawer state (D-34)"
  - "User menu popover that pops in and out from its top-right anchor at every width, with a half-turn chevron (D-35)"
  - "Sign-out-others (shell and Signed-in devices page) and per-device sign-out dialogs kept mounted so they close with motion (D-39)"
affects: [05-09, 05-10, later Phase 5 plans that add dialogs or menus, parity rulings layer]

actuals:
  tokens: 14980
  tasks: 3
  commits: 7
plan_head_before: e6250d1d71b9a28d4b9b7c1dad32db65d6267fd2
plan_head_after: 1af77d9df6e8cacd5c744ba8386a7567817690fd

tech-stack:
  added: []
  patterns:
    - "Presence-driven overlays: render while usePresence.mounted, mark data-state, release trap/scroll lock/focus when open turns false, make the closing layer inert and pointer-events none"
    - "Tailwind v4 rotate utilities set the individual `rotate` property, so motion e2e reads computed `rotate` (180deg), not `transform`"
    - "Motion differences on the frozen parity reference are owner rulings in rulings.css on spec classes (commented 'P5 D-xx'), never tolerances"

key-files:
  created: []
  modified:
    - web/src/components/navigation/MobileNavDrawer.tsx
    - web/src/components/navigation/UserMenu.tsx
    - web/src/components/navigation/Topbar.tsx
    - web/src/components/navigation/navigation.recipe.ts
    - web/src/layouts/AdminLayout.tsx
    - web/src/modules/admin/pages/SessionsPage.tsx
    - web/visual/reference/rulings.css
    - web/e2e/motion.spec.ts
    - web/e2e/admin-keyboard.spec.ts

key-decisions:
  - "A closing drawer layer and a closing user-menu popover are inert and pointer-events none, and their handlers ignore events while open is false (T-05-20)"
  - "The per-device dialog keeps one state { device, open } in SessionsPage instead of a separate shownDevice, so the closing dialog still has its device"
  - "Only the chevron needed a parity ruling (P5 D-35 on .csp-usermenu svg); no parity row shows the drawer, so no P5 D-34 group was added"
  - "Chevron classes add motion-reduce:duration-0 so the computed transition duration is 0s under reduced motion"

patterns-established:
  - "Open-prop dialog callers: always render the dialog with open={state}; keep the last subject in state when the closing dialog still shows it"

requirements-completed: [USER-08, PROF-01]

coverage:
  - id: D1
    description: "On a phone the navigation drawer slides in from the left and out again with the scrim fading; the close animation finishes before the drawer leaves the DOM; Esc, scrim click and followed link still close it and focus returns to the menu button"
    requirement: USER-08
    verification:
      - kind: unit
        ref: "web/src/components/navigation/MobileNavDrawer.test.tsx#MobileNavDrawer closing animation (D-34, D-38)"
        status: pass
      - kind: e2e
        ref: "web/e2e/motion.spec.ts#@motion drawer (chromium, firefox, webkit, pixel, iphone)"
        status: pass
      - kind: e2e
        ref: "web/e2e/admin-keyboard.spec.ts#@keyboard @admin the navigation drawer"
        status: pass
    human_judgment: false
  - id: D2
    description: "The menu button is named Open navigation while the drawer is closed and Close navigation while it is open, and aria-expanded follows"
    requirement: USER-08
    verification:
      - kind: unit
        ref: "web/src/components/navigation/Topbar.test.tsx#Topbar menu button name follows the drawer (D-34)"
        status: pass
      - kind: unit
        ref: "web/src/layouts/AdminLayout.test.tsx#wires the Topbar menu button to the drawer"
        status: pass
    human_judgment: false
  - id: D3
    description: "The user menu popover fades and scales in from its top-right anchor and out again at all widths, the chevron turns 180 degrees while open, and focus, Escape, Tab and outside-press behaviour are unchanged"
    requirement: PROF-01
    verification:
      - kind: unit
        ref: "web/src/components/navigation/UserMenu.test.tsx#UserMenu motion (D-35, D-38)"
        status: pass
      - kind: e2e
        ref: "web/e2e/motion.spec.ts#@motion user menu (desktop 1440x900 and phone 390x844, all five projects)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep \"@parity @(navigation|navigation-gaps)\" (46 passed) and layouts-admin groups (28 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The sign-out-others dialog (shell and Signed-in devices page) and the per-device sign-out dialog stay mounted with an open prop and close with motion; the per-device dialog keeps showing its device while it closes"
    verification:
      - kind: unit
        ref: "web/src/layouts/AdminLayout.test.tsx and web/src/modules/admin/pages/SessionsPage.test.tsx#S7 dialogs close with motion (D-39)"
        status: pass
      - kind: e2e
        ref: "web/e2e/motion.spec.ts#@motion sessions"
        status: pass
    human_judgment: false
  - id: D5
    description: "Motion uses only theme keyframes and Tailwind utilities (150 to 250 ms, transform and opacity), nothing moves under prefers-reduced-motion, layout shift stays under 0.05, and no package is added"
    verification:
      - kind: e2e
        ref: "web/e2e/motion.spec.ts#@motion drawer reduced, @motion drawer cls, @motion user menu reduced"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (4547 tests, coverage thresholds, build, budgets, license gate) exit 0; package.json untouched"
        status: pass
    human_judgment: false
  - id: D6
    description: "The drawer and menu motion reads smooth and natural on a real phone"
    verification: []
    human_judgment: true
    rationale: "Whether 150 to 250 ms motion feels right on a real device is a matter of taste; automation proves the animation names, timing and reduced-motion behaviour, not the feel"

duration: 58min
completed: 2026-10-17
status: complete
---

# Phase 5 Plan 08: Navigation and Dialog Motion Summary

**Presence-driven slide/fade for the phone navigation drawer and scrim, a pop-in/out user menu with a turning chevron at every width, and the shell and Signed-in devices sign-out dialogs kept mounted so they close with motion, all on the 05-02 keyframes with no new package.**

## Performance

- **Duration:** 58 min
- **Started:** 2026-10-17T20:54:00-05:00
- **Completed:** 2026-10-17T21:52:00-05:00
- **Tasks:** 3
- **Files modified:** 15 (9 source and e2e files above plus 6 test files and the rulings test)

## Accomplishments

- `MobileNavDrawer` mounts through `usePresence`: layer and panel carry `data-state`, the panel slides in/out (`csp-drawer-in/out`) and the scrim fades (`csp-fade/-out`). At close start focus goes back to the menu button, the focus trap and scroll lock are released, the layer is `inert` with `pointer-events-none`, and Esc, scrim and link events are ignored until it leaves the DOM on the panel's own `animationend`.
- `Topbar` names the menu button "Close navigation" while the drawer is open ("Open navigation" otherwise); `aria-expanded` follows. No hamburger morph.
- `UserMenu` popover uses `usePresence` with `origin-top-right animate-csp-pop-in/-out`; the chevron (`userMenuChevronClasses`, `group/um` on the button) turns 180 degrees when expanded; the closing popover is inert, takes no pointer input and answers no key or click.
- `AdminLayout` and `SessionsPage` always render `SignOutOthersDialog` with `open`; `SessionsPage` keeps the per-device dialog's device in `{ device, open }` state so it still names the device while closing.
- `@motion drawer`, `@motion drawer reduced`, `@motion drawer cls`, `@motion user menu` (desktop and phone, normal and reduced) and `@motion sessions` e2e cases pass in all five projects (layout-shift cases run in Chromium).

## Task Commits

1. **Task 1: Tracer, drawer slides in and out (D-34)** - `ba6f8a5` (test, RED), `a6c8a1c` (feat)
2. **Task 2: User menu pops in and out, chevron turns (D-35)** - `f94e997` (test, RED), `e85e8ab` (feat)
3. **Task 3: Dialog callers stay mounted (D-39)** - `4732702` (test, RED), `1af77d9` (feat)

**Plan metadata:** recorded in the docs commit that carries this file.

## TDD Gate Compliance

All three tasks have a `test(05-08)` commit before the `feat(05-08)` commit. No REFACTOR commits.

- **RED (Task 1):** `ba6f8a5`. Target test `stays mounted as closed while it animates out, with the layer and the panel marked closed` (MobileNavDrawer.test.tsx) failed on `expected false to be true` (the drawer unmounted at once). `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`, vitest TAP). Semantic assessment: the target ran and failed on the planned assertion (panel must stay connected as `data-state="closed"`), not on a load or fixture fault. Six more drawer tests and the Topbar name test failed on their planned assertions too.
- **RED (Task 2):** `f94e997`. Target `stays mounted as closed while it animates out, with focus on the button at once` (UserMenu.test.tsx) failed on the popover being unmounted at once; `RED_EVIDENCE_OK`. Six tests failed in all (data-state, chevron and animation classes, inert, reopen).
- **RED (Task 3):** `4732702`. Target `keeps the per-device dialog in the tree and showing its device while it closes after Keep Signed In` (SessionsPage.test.tsx) failed on the dialog being unmounted when the target was cleared; `RED_EVIDENCE_OK`. Four tests failed in all.
- Targets use single-line assertions (`isConnected`, `getAttribute`) so the TAP report parses; multi-line jest-dom messages made the classifier return `invalid_record`.

## Files Created/Modified

- `web/src/components/navigation/MobileNavDrawer.tsx` - presence-driven drawer; focus-to-controller effect keyed on `open`
- `web/src/components/navigation/UserMenu.tsx` - presence-driven popover, `{ open, at }` state, guarded handlers, chevron class
- `web/src/components/navigation/Topbar.tsx` - state-following menu button name
- `web/src/components/navigation/navigation.recipe.ts` - drawer, scrim, popover motion classes; `group/um`; new `userMenuChevronClasses`
- `web/src/layouts/AdminLayout.tsx`, `web/src/modules/admin/pages/SessionsPage.tsx` - dialogs kept mounted with `open`
- `web/visual/reference/rulings.css` and `rulings.test.ts` - `P5 D-35` ruling for the chevron transition on `.csp-usermenu svg`
- `web/e2e/motion.spec.ts` - drawer, user menu and sessions motion cases
- `web/e2e/admin-keyboard.spec.ts` - follows the state-following button name and waits for the slide-in before measuring the panel
- Tests: `MobileNavDrawer.test.tsx`, `Topbar.test.tsx`, `UserMenu.test.tsx`, `AdminLayout.test.tsx`, `SessionsPage.test.tsx`

## Decisions Made

- Closing layers are `inert` plus `pointer-events-none`, and handlers also check `open`, so a closing menu cannot run Logout or Sign Out Other Devices (T-05-20).
- One `{ device, open }` state in `SessionsPage` replaces the plan's separate `shownDevice`; same behaviour, one state to keep in step.
- The parity proof needed only a chevron ruling. No parity row shows the open drawer, so no `P5 D-34` group was added (the plan allowed this).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing tests and e2e looked the menu button up by "Open navigation" while the drawer was open**
- **Found during:** Task 1
- **Issue:** The D-34 name change made `AdminLayout.test.tsx` (`openNavigation()`) and three `admin-keyboard.spec.ts` locators fail once the drawer is open.
- **Fix:** Both look the button up as `/^(Open|Close) navigation$/` and assert the expected name per state. `admin-keyboard.spec.ts` is not in the plan's file list.
- **Verification:** `npx vitest run src/layouts`; `@keyboard @admin` e2e in five projects
- **Committed in:** `a6c8a1c`

**2. [Rule 1 - Bug] `admin-keyboard` drawer geometry was measured mid slide-in**
- **Found during:** Task 1
- **Issue:** `boundingBox().x` read -4 to -10 px while the 200 ms slide-in ran (Chromium, Pixel).
- **Fix:** The test awaits `getAnimations().finished` on the panel before measuring.
- **Verification:** `@keyboard @admin the navigation drawer` passes in five projects
- **Committed in:** `a6c8a1c`

**3. [Rule 3 - Blocking] Chevron rotation is Tailwind's `rotate` property, not `transform`**
- **Found during:** Task 2 (`@motion user menu`)
- **Issue:** Tailwind v4 `rotate-180` sets `rotate: 180deg`, so computed `transform` stays `none`; the plan's transform check could not pass.
- **Fix:** The e2e reads computed `rotate` (accepting a half-turn matrix too).
- **Committed in:** `e85e8ab`

**4. [Rule 2 - Missing critical] Chevron needs `motion-reduce:duration-0`, and closing layers need `inert`**
- **Found during:** Tasks 1 and 2
- **Issue:** The plan's chevron classes left a 0.2 s duration under reduced motion (its e2e expects 0s), and tab focus could reach a closing drawer or popover (T-05-20).
- **Fix:** Added `motion-reduce:duration-0` to `userMenuChevronClasses` and `inert` to the closing drawer layer and popover (as Modal does).
- **Committed in:** `a6c8a1c`, `e85e8ab`

**5. [Rule 3 - Blocking] Parity needed a ruling for the chevron transition**
- **Found during:** Task 2 (`parity @navigation`)
- **Issue:** Computed `transition-property`/`transition-duration` on the chevron svg differed from the frozen reference in every engine (as the plan predicted).
- **Fix:** Added the commented `P5 D-35` rule on `.csp-usermenu svg` and its id in `RULING_IDS`; no tolerance.
- **Verification:** `@parity @(navigation|navigation-gaps)` 46 passed; `@parity @(layouts-admin|layouts-admin-boundaries)` 28 passed
- **Committed in:** `e85e8ab`

**6. [Rule 1 - Bug] `@motion sessions` opened the dialog with a mouse click**
- **Found during:** Task 3 (WebKit, iPhone)
- **Issue:** WebKit does not focus a button on a click, so the focus trap had nothing to return to.
- **Fix:** The e2e opens by keyboard, as the dialog cases from 05-02 do.
- **Committed in:** `1af77d9`

---

**Total deviations:** 6 auto-fixed (3 Rule 1, 2 Rule 3, 1 Rule 2)
**Impact on plan:** All needed for correctness, accessibility or the parity proof. No scope creep and no new package.

## Issues Encountered

- `src/modules/admin/routes.test.tsx` timed out (5 s) in two full vitest runs under parallel load and passes alone and inside `npm run verify`. It is not touched by this plan.
- In one heavily parallel Playwright run, Firefox `@sessions` failed on a "font preloaded but not used within a few seconds" console warning (the test ran 28 to 42 s under load). Alone it passes in about 14 s with this plan's code, and the run `@motion|@sessions|@shell|@keyboard @admin` with `--workers=2` passed 209 tests. Nothing in this plan loads fonts.
- The measured `commits: 7` includes `4b2859d docs(05): record owner rulings OQ-1..OQ-11`, landed on the branch by the orchestrator during the plan; the plan's own commits are the six listed above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. T-05-19 (CSP) holds: theme keyframes and utilities only, e2e guard clean. T-05-20 holds: tests cover clicks and keys while closing. T-05-SC: no installs.

## Self-Check: PASSED

- Commits `ba6f8a5`, `a6c8a1c`, `f94e997`, `e85e8ab`, `4732702`, `1af77d9` are ancestors of HEAD.
- Acceptance criteria: `usePresence` in `MobileNavDrawer.tsx` and `UserMenu.tsx`; `animate-csp-drawer-in` and `animate-csp-drawer-out` once each in `navigation.recipe.ts`; "Close navigation" once in `Topbar.tsx`; `userMenuChevronClasses` in the recipe and `UserMenu.tsx`; `animate-csp-pop-in` once in the recipe; `open={signOutOthersOpen}` once in `AdminLayout.tsx`; `open=` at least twice in `SessionsPage.tsx`; `npm --prefix web run verify` exit 0.

## Next Phase Readiness

Plans 05-09 and 05-10 are backend-only and unaffected. Later web plans that add dialogs or menus can reuse the open-prop caller pattern and the `P5 D-xx` ruling convention.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-17*

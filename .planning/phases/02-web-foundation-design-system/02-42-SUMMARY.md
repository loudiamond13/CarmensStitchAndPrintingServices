---
phase: 02-web-foundation-design-system
plan: 42
subsystem: ui
tags: [react, modal, dialog, scrollbar, overlay-scrollbars, playwright, vitest, d-42, g-2-199]
gap_closure: true
gap_ids: [G-2-199]
created: "2026-10-13T20:46:00-05:00"
updated: "2026-10-13T20:46:00-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "plan 02-41: the D-42 dialog layout (shrinking top gap, scrolling Overlay region) and the classic-scrollbar geometry guard pressedOnScrollbar"
provides:
  - "Modal scrim close rule: a primary-button click that follows a primary scrim press off a classic scrollbar, with every scrim at the same scroll position (focus-move scrolls re-read at focusin and one task later)"
  - "Two Chromium Playwright projects with real scrollbars: chromium-classic-scrollbars and chromium-overlay-scrollbars, running only dialog-scrollbars.spec.ts"
  - "web/e2e/deleteOrderDialog.ts: shared Delete Order helpers (DIALOG_NAME, ORDER, openDeleteOrder, readRegion, boxOf, topOf, Box, RegionMetrics, OpenDialog)"
  - "@dialog-fit scrollbars T1-T4 and @dialog-fit D1-D3 scrim-click cases"
affects: [order-delete-confirm, user-management-slideover, any ConfirmDialog or Modal in an Overlay region]

actuals:
  tokens: 15587
  tasks: 3
  commits: 8
plan_head_before: f2af90f0eb4430ac91d443ef688cfa6a5afdeb59
plan_head_after: 7c259318072fd1b3ea79fa077c6ac3c3286de723

tech-stack:
  added: []
  patterns:
    - "Scrim dismissal is a click, not a mousedown: the press records the scrims' scroll positions, the click closes only when they are unchanged (engine-independent overlay-scrollbar detection)"
    - "Focus-trap reveal scrolls are re-read at focusin and once more a task later (WebKit applies them after the focusin)"
    - "Real-scrollbar E2E: launchOptions.ignoreDefaultArgs ['--hide-scrollbars'] (classic) plus args ['--enable-features=OverlayScrollbar'] (overlay), scoped by testMatch/testIgnore"
    - "Overlay-scrollbar E2E presses first reveal the scrollbar (pointer on the edge plus a 30px wheel turn, then wait for the scroll to settle)"

key-files:
  created:
    - web/e2e/deleteOrderDialog.ts
    - web/e2e/dialog-scrollbars.spec.ts
  modified:
    - web/src/ui/overlays/Modal.tsx
    - web/src/ui/overlays/Modal.test.tsx
    - web/src/ui/overlays/Overlay.tsx
    - web/playwright.config.ts
    - web/e2e/dialog-fit.spec.ts
    - docs/web/e2e.md
    - docs/web/release-gates.md
    - docs/web/parity.md
    - .planning/phases/02-web-foundation-design-system/02-UAT.md
    - .planning/phases/02-web-foundation-design-system/02-REVIEW-g199-DISPOSITION.md
    - .planning/phases/02-web-foundation-design-system/deferred-items.md

key-decisions:
  - "D-42 close rule: the scrim closes on a primary click after a primary scrim press with unchanged scroll positions; middle and right buttons never close (WR-01)"
  - "Focus-move scrolls are not drags: positions are re-read at every focusin while a press is pending and once more one task later, because WebKit applies the reveal scroll just after the focusin (found by an event probe; Rule 1)"
  - "Overlay-scrollbar launch configuration: ignoreDefaultArgs ['--hide-scrollbars'] plus args ['--enable-features=OverlayScrollbar'] reproduces overlay scrollbars headless (clientWidth 1280/1280); the args-only fallback was not needed"
  - "T1/T2 reveal the overlay scrollbar (pointer on the edge, 30px wheel, wait until settled) before pressing it: a press before Chromium shows it is a press on the dark area and rightly closes (no assertion changed)"

patterns-established:
  - "pressAndRelease(target, init) in Modal.test.tsx: mousedown, mouseup and click with one init"
  - "setScroll(scrim, top, left) and OVERLAY_SCROLLBAR geometry for jsdom scroll-dependent tests"

requirements-completed: [WEB-06, A11Y-02]

coverage:
  - id: D1
    description: "Dragging the backdrop's scrollbar (classic and overlay) scrolls it and keeps the Delete Order dialog open with ORD-2026-0148 typed"
    requirement: WEB-06
    verification:
      - kind: unit
        ref: "web/src/ui/overlays/Modal.test.tsx#keeps the dialog open after a drag on an overlay scrollbar that scrolled the backdrop"
        status: pass
      - kind: e2e
        ref: "web/e2e/dialog-scrollbars.spec.ts#@dialog-fit scrollbars 1280x420: dragging the backdrop's scrollbar scrolls it and keeps the Delete Order dialog open with the typed order number (chromium-classic-scrollbars, chromium-overlay-scrollbars)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A press on the backdrop's scrollbar without moving keeps the dialog open (classic at width-4 and at clientWidth; overlay at width-4)"
    requirement: WEB-06
    verification:
      - kind: e2e
        ref: "web/e2e/dialog-scrollbars.spec.ts#@dialog-fit scrollbars 1280x420: a press on the backdrop's scrollbar without moving keeps the dialog open"
        status: pass
      - kind: unit
        ref: "web/src/ui/overlays/Modal.test.tsx#counts the first scrollbar column as scrollbar and the scrim just left of it as scrim"
        status: pass
    human_judgment: false
  - id: D3
    description: "Middle and right presses on the dark area never close the dialog (jsdom buttons 1 and 2; real engines at 1440x900 and 1280x420)"
    requirement: WEB-06
    verification:
      - kind: unit
        ref: "web/src/ui/overlays/Modal.test.tsx#never closes on a press with mouse button %i; a primary press and click then closes"
        status: pass
      - kind: e2e
        ref: "web/e2e/dialog-fit.spec.ts#@dialog-fit 1440x900: a left click on the dark area above the dialog closes it; a middle or a right press there does not"
        status: pass
      - kind: e2e
        ref: "web/e2e/dialog-scrollbars.spec.ts#a middle press on the dark area keeps the dialog open; a right press on the dark area keeps the dialog open, and a left click there closes it"
        status: pass
    human_judgment: false
  - id: D4
    description: "A left click on the dark area still closes the dialog in all seven projects (above it at 1440x900, beside it at 1280x420 after the wheel, above the phone sheet, the last scrim column in classic)"
    requirement: A11Y-02
    verification:
      - kind: e2e
        ref: "web/e2e/dialog-fit.spec.ts#@dialog-fit 1280x420: after the wheel scrolls the backdrop to the buttons, a left click on the dark area beside the dialog still closes it (chromium, firefox, webkit)"
        status: pass
      - kind: e2e
        ref: "web/e2e/dialog-fit.spec.ts#@dialog-fit on the phone's own screen: a click on the dark area above the sheet closes it (pixel, iphone)"
        status: pass
      - kind: unit
        ref: "web/src/ui/overlays/Modal.test.tsx#does not count the scroll the browser applies just after that focus move as a drag"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ordering, empty, adjacency, encoding and loading edges: press alone never closes, a later press replaces an earlier one, zero scroll closes once, strict per-scrim equality, loading ignores then closes once"
    requirement: A11Y-02
    verification:
      - kind: unit
        ref: "web/src/ui/overlays/Modal.test.tsx#scrim close rule: only a press and click on the scrim that does not scroll it closes (D-42, G-2-199)"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-42 layout and look unchanged: every @dialog-fit layout test in five projects, @overlays parity rows and @selftest in three engines"
    requirement: WEB-06
    verification:
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep \"@dialog-fit|@showcase|@keyboard|@a11y-rulings\" (399 passed, 0 failed, 24 skipped)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep \"@overlays|@selftest\" (21 passed)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Owner re-check of UAT test 199 in real Chrome at 125-150% zoom (drag the backdrop scrollbar, middle/right click, left click)"
    verification: []
    human_judgment: true
    rationale: "Plan Task 3 human-check: the owner's own browser, zoom and scrollbar setting are the acceptance for UAT test 199; real Safari and Windows Firefox overlay scrollbars cannot be run on this machine"

duration: 89min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 42: Backdrop scrollbar close rule (G-2-199) Summary

**The dialog backdrop now closes on a primary-button click that began on the dark area and did not scroll it. A drag or a press on the backdrop's scrollbar (classic or overlay) and a middle or right press never close the Delete Order dialog or lose ORD-2026-0148. Two real-scrollbar Chromium projects prove it.**

## Performance

- **Duration:** 89 min
- **Started:** 2026-10-14T00:15:44Z
- **Completed:** 2026-10-14T01:45:17Z
- **Tasks:** 3 (all complete)
- **Files modified:** 13 (2 created, 11 modified; 672 insertions, 145 deletions)

## Accomplishments

- **Close rule (Modal.tsx).** A primary mousedown on a scrim that is not on a classic scrollbar records every scrim's scrollTop and scrollLeft. A primary click on a scrim closes only when those positions are unchanged. Each mousedown replaces the pending press, and the click consumes it, so the bubbled second call does nothing. No markup, class, style or default-prevent change.
- **Focus scrolls are not drags.** A press on the dark area focuses `main`, and the focus trap pulls focus back to the dialog's Close button, which scrolls the backdrop. The positions are re-read at every `focusin` while a press is pending, and once more one task later for WebKit.
- **Real scrollbars in E2E.** The `chromium-classic-scrollbars` and `chromium-overlay-scrollbars` projects run only `dialog-scrollbars.spec.ts`. They use the same base URL, HTTPS host, guard and strict CSP as the other projects, with no `bypassCSP`.
- **Proof.** Unit tests 111/111. Seven-project E2E: 399 passed, 0 failed. Parity `@overlays` and `@selftest`: 21 passed. `npm run verify` exits 0.

## Task Commits

1. **Task 1 (tracer): overlay-scrollbar drag keeps the dialog open**
   - `0bfd2c5` test (RED)
   - `a680b7f` fix (GREEN)
2. **Task 2: middle and right presses, focus scrolls, left click still closes**
   - `3eaa7a2` refactor (shared helpers)
   - `6989fa3` test (RED)
   - `f7120f3` test (RED, the WebKit deferred reveal; deviation 1)
   - `33d0a8d` test (overlay scrollbar reveal before pressing; deviation 2)
   - `5c392dc` fix (GREEN)
3. **Task 3: records and full gate** - `7c25931` docs

**Plan metadata:** recorded in the final docs commit for this SUMMARY.

## Measurements

**Launch configuration that reproduced overlay scrollbars.** The first configuration worked: `launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--enable-features=OverlayScrollbar'] }`. The `args`-only fallback was not needed.

**T1 annotations:**

| Project | clientWidth / window | scrollTop before → after the drag |
|---|---|---|
| chromium-classic-scrollbars | 1265 / 1280 | 0 → 105 at the first GREEN; 30 → 105 after the reveal step |
| chromium-overlay-scrollbars | 1280 / 1280 | 0 → 105 at the first GREEN; 30 → 105 after the reveal step |

**RED outcomes per project:**

| Stage | Unit | E2E |
|---|---|---|
| Task 1 RED (`0bfd2c5`) | (a), (b), (c), (d) and (g) first half fail (5 failed, 98 passed); the conversions pass | T1 failed in chromium-overlay-scrollbars (the dialog closed) and passed in chromium-classic-scrollbars |
| Task 2 RED (`6989fa3`) | (h) button 1, (h) button 2, (i) and (j) first case fail (4 failed, 106 passed) | D2 failed in chromium, firefox and webkit (the press focuses `main`, the trap moves focus to Close and that scrolls the backdrop, so the scroll check blocked the close). T2, T3 and T4 passed in both scrollbar projects; D1 passed in chromium, firefox and webkit; D3 passed in pixel and iphone. |
| Deviation 1 RED (`f7120f3`) | the deferred-reveal test fails (1 failed, 110 passed) | D2 still failed in webkit after the first GREEN draft |

Every RED was checked with `gsd-tools check tdd-red-evidence` and returned `RED_EVIDENCE_OK`.

**Final runs:**

- **Unit:** `npm --prefix web run test -- --run src/ui/overlays` gives 5 files, 111 tests passed.
- **E2E** `--grep "@dialog-fit|@showcase|@keyboard|@a11y-rulings"`: 399 passed, 0 failed, 24 skipped.

  | Project | Passed | Skipped |
  |---|---|---|
  | chromium | 81 | 2 |
  | firefox | 81 | 2 |
  | webkit | 81 | 2 |
  | pixel | 74 | 9 |
  | iphone | 74 | 9 |
  | chromium-classic-scrollbars | 4 (T1-T4) | 0 |
  | chromium-overlay-scrollbars | 4 (T1-T4) | 0 |

  Zero guard findings.
- **`@dialog-fit` alone (seven projects):** 39 passed, 24 skipped.
- **Repeat check:** 25 repeats of T1 and T2 in both scrollbar projects, 100 passed.
- **Parity** `--grep "@overlays|@selftest"`: 21 passed. Chromium ran 10 `@overlays` rows plus `@selftest`; firefox and webkit each ran 4 rows plus `@selftest`. Each self-test found its 1px drift.
- **Full gate:** `npm --prefix web run verify` exits 0. 109 test files, 3102 tests. All files: 98.26% statements, 96.5% branches, 99.82% functions, 99.82% lines. Modal.tsx: 100% lines, 95.79% branches. Budgets: public JS 126.18 / 150 KB, CSS 13.04 / 35 KB. License gate: 0 problems. Notices up to date.
- **Owner-review test:** 62/62. The parity.md D-42 row still has 3 cells.

## Files Created/Modified

- `web/src/ui/overlays/Modal.tsx`: the click-based close rule (`pendingPress`, `onClick`, `onFocusIn` with the deferred re-read, `readScrollPositions`, `samePositions`, button checks) and the `SPEC-DEVIATION: D-42` comment.
- `web/src/ui/overlays/Modal.test.tsx`:
  - `pressAndRelease` conversions;
  - the new describe with cases (a)-(l), plus the deferred-reveal case;
  - helpers `OVERLAY_SCROLLBAR` and `setScroll`.
- `web/src/ui/overlays/Overlay.tsx`: header comment only.
- `web/playwright.config.ts`: `scrollbarSpecs`, `testIgnore` on the five standard projects, and the two scrollbar projects.
- `web/e2e/deleteOrderDialog.ts` (new): the shared Delete Order helpers and `readRegion`.
- `web/e2e/dialog-scrollbars.spec.ts` (new): T1-T4, `scrollbarMode`, `expectRealScrollbars`, `revealScrollbar`, `openTyped`.
- `web/e2e/dialog-fit.spec.ts`: uses the shared helpers; adds D1-D3.
- `docs/web/e2e.md`, `docs/web/release-gates.md`, `docs/web/parity.md`: the records described in Task 3.
- `02-UAT.md`: G-2-199 points at 02-41 and 02-42, still `failed`.
- `02-REVIEW-g199-DISPOSITION.md`: WR-01 and WR-02 marked `fixed`.
- `deferred-items.md`: one out-of-scope entry.

## Decisions Made

- I kept the planned design (click plus unchanged scroll positions) and did not use the dedicated backdrop layer, because that would change the markup under D-08.
- The deferred re-read uses one `setTimeout(0)`, rescheduled on each `focusin` and cleared on effect cleanup. It is a listener-and-timer change only (D-33/CSP safe, no style writes).
- The overlay-scrollbar reveal step in T1 and T2 changes only how the gesture is set up. Every assertion stays as planned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-reading only at focusin missed WebKit's focus reveal scroll, so a left click beside the dialog at 1280x420 did not close in webkit**
- **Found during:** Task 2 GREEN, in the seven-project `@dialog-fit` run (D2 failed in webkit only).
- **Issue:** WebKit applies the reveal scroll after the `focusin` on the Close button. An event probe read scrollTop 105 at that `focusin` and 0 one task later, before pointerup. So the "unchanged positions" check blocked a real click on the dark area. That broke the truth "a left click on the dark area closes … at 1280x420 … in chromium, firefox and webkit".
- **Fix:** while a press is pending, re-read the positions at each `focusin` and once more in a `setTimeout(0)` scheduled there. The timer is cleared and rescheduled on each `focusin` and cleared on cleanup. New RED test (fake timers) committed first.
- **Files modified:** web/src/ui/overlays/Modal.tsx, web/src/ui/overlays/Modal.test.tsx
- **Verification:**
  - the new unit test fails at RED (`RED_EVIDENCE_OK`) and passes at GREEN;
  - the existing (j) cases pass unchanged, so a scroll after the focus move with no task between still blocks the close;
  - webkit D2 passed 8 of 8 repeats, then passed in every full run.
- **Committed in:** f7120f3 (RED), 5c392dc (GREEN)

**2. [Rule 1 - Bug, test] T1 and T2 sometimes pressed before Chromium had shown its overlay scrollbar**
- **Found during:** Task 2 GREEN.
  - The overlay T1 and T2 failed once in the parallel seven-project run, after passing in earlier runs.
  - Repeats then failed 3 of 8, then 1 of 15 with a 1s hover, and 1 of 24 under the probe.
- **Issue:** the probe showed that in the failing runs the press went to the page and not the scrollbar: no scroll events, mousemove events reached the page during the "drag", and Chromium sent a `click`. Chromium's overlay scrollbar is hidden until the backdrop scrolls, and hovering at the edge did not always reveal it. A press there is a press on the dark area, so closing is correct product behaviour. The test setup was the problem, not the close rule. It is not the D-42 "press without a drag" checkpoint: every probe where the press landed on the thumb shows no `click` afterwards.
- **Fix:** `revealScrollbar` rests the pointer on the right edge, turns the wheel 30px (a scroll always shows overlay scrollbars, and the resting pointer keeps them shown), then polls until the backdrop has settled. T1 reads its starting scrollTop after that (30), so "scrollTop grows" stays strict (30 → 105). The thumb still covers y 120. No assertion was removed, loosened or retried.
- **Files modified:** web/e2e/dialog-scrollbars.spec.ts
- **Verification:** 25 repeats × T1/T2 × both scrollbar projects gave 100 passed, and the next two seven-project runs were green.
- **Committed in:** 33d0a8d

**3. [Rule 1 - Bug, test] D1's "Open Delete Order" locator was ambiguous**
- **Found during:** Task 2 RED.
- **Issue:** the page has three "Open Delete Order" buttons, so Playwright's strict mode failed the final check after the dialog had correctly closed.
- **Fix:** scoped the locator to `[data-case="confirm-delete-order"]`, the same way `openDeleteOrder` does.
- **Files modified:** web/e2e/dialog-fit.spec.ts
- **Committed in:** 6989fa3 (before RED was committed)

**4. [Tooling] RED evidence format**
- `gsd-tools check tdd-red-evidence` cannot read Vitest output as-is:
  - Vitest's TAP output has no summary counts;
  - in Vitest's JUnit output the checker's `name="` regex matches inside `classname="`.
- The RED records were therefore built from JUnit output with the `name` and `classname` attributes swapped, with the same data. The verdict was `RED_EVIDENCE_OK` for all three REDs.

**5. GREEN commit type.** The plan specifies `fix(02-42)` for the GREEN commits, so they are `fix`, not `feat`. RED (`test`) commits come before each GREEN.

---

**Total deviations:** 3 auto-fixed (1 product bug, 2 test bugs), plus 2 process notes.
**Impact on plan:** each fix was needed to meet a must-have truth in a real engine. There was no scope creep, no package change, no look or markup change, and no assertion was weakened.

## TDD Gate Compliance

- **RED:** 0bfd2c5, 6989fa3, f7120f3 (`test(02-42)`), each verified `RED_EVIDENCE_OK`.
- **GREEN:** a680b7f, 5c392dc (`fix(02-42)` as the plan specifies; no `feat` commit).
- **REFACTOR:** 3eaa7a2.

Order: RED 0bfd2c5 → GREEN a680b7f → REFACTOR 3eaa7a2 → RED 6989fa3 → RED f7120f3 → test fix 33d0a8d → GREEN 5c392dc.

## Conditional Checkpoints

None fired.
- **Packages:** `web/package.json` and `package-lock.json` are unchanged (frozen-file diff against 9e2b3d6 is empty).
- **Look (D-08):** recipe, rulings and classes are untouched, and parity is equal.
- **Overlay scrollbar press without a drag (D-42):** T2 passes in chromium-overlay-scrollbars, and the probe shows no `click` after a real thumb press.
- **Overlay scrollbars cannot be reproduced headless:** clientWidth was 1280 and the drag scrolled 105px.

## Issues Encountered

- One full seven-project E2E run had a single failure in firefox: `@a11y-rulings D-05 /admin/users (dark)`, where `page.goto` timed out at 60s before any Tab press. Alone it passed in 1.1s, all 52 firefox `@a11y-rulings` tests passed, and the next full run was green (399 passed). The page has no dialog. It is logged in deferred-items.md as out of scope.

## Flagged Assumptions (carried from the plan)

- **WEB-06:** only the backdrop dismissal changed. ConfirmDialog's trimmed exact-match rule, the pending state, the failure state and the cascade tiles are unchanged, and their tests pass in `verify`.
- **Engines not runnable here:** real Safari on macOS and Firefox overlay scrollbars on Windows 11. For them, the drag case rests on the engine-independent scroll check (jsdom-proven). A press without a drag rests on the engine sending no click after a scrollbar press, which is proven for Chromium only (T2).

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- G-2-199 is ready for `/gsd-verify-work 2` to reconcile. Its UAT status stays `failed` until the owner re-checks test 199 (see the end-of-phase human check below).
- **End-of-phase human check (owner, UAT test 199):**
  1. In Chrome at 125-150% zoom, open /dev/components and press "Open Delete Order".
  2. Shorten the window until the dark backdrop scrolls, type the order number and drag the backdrop's scrollbar: it scrolls, and the dialog stays open with the text kept.
  3. A middle or right click on the dark area does nothing.
  4. A left click on the dark area closes the dialog.
  5. On a normal-height window, the dialog sits where it did before.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-13*

## Self-Check: PASSED

- **Files:** web/e2e/deleteOrderDialog.ts, web/e2e/dialog-scrollbars.spec.ts and this SUMMARY are present.
- **Commits:** all 8 plan commits are present in `git log` (0bfd2c5, a680b7f, 3eaa7a2, 6989fa3, f7120f3, 33d0a8d, 5c392dc, 7c25931).
- **Acceptance greps:**
  - Task 1: pendingPress 5; click listener added 1, removed 1; SPEC-DEVIATION 1; scrollbarSpecs 8; bypassCSP 0; readRegion 1; OVERLAY_SCROLLBAR 4.
  - Task 2: `event.button !== 0` 2; `'focusin'` 2; preventDefault 1; Overlay D-42 2; "a click on it closes" 1; dialog-fit import 1; READ_REGION 0; "@dialog-fit scrollbars" 4; "button: 'middle'" 1.
  - Task 3: WR-01/WR-02 fixed 2; G-2-199 status failed 1; 02-42-PLAN.md 1.

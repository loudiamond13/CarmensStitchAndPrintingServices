---
phase: 02-web-foundation-design-system
plan: 43
subsystem: ui
tags: [react, focus-trap, modal, overlay, playwright, vitest, wr-01, wr-02, d-42, a11y-02]
gap_closure: true
gap_ids: []
review_ids: [WR-01, WR-02]
created: "2026-10-14T05:15:00-05:00"
updated: "2026-10-14T05:15:00-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "plan 02-42: the Modal scrim close rule (press snapshot compared with the click), the shared Delete Order E2E helpers and the two real-scrollbar Playwright projects"
provides:
  - "useFocusTrap returns focus that leaves an open overlay to the element inside that last had it, through focus({ preventScroll: true }); first focusable element is the fallback (nothing inside had focus, the element is gone, or it cannot take focus)"
  - "Modal scrim close rule without a focus re-read, document focusin listener or deferred timer: any scroll between the press and the click blocks the close"
  - "E2E from a scrolled 1280x420 backdrop in all seven projects: middle, right and scrollbar presses keep the caret (13/13) in the confirm field and the backdrop's scrollTop; mutation-proven against the plan-base trap"
  - "web/e2e/deleteOrderDialog.ts helpers: wheelOverDialog (moved), waitForSettledScroll, waitForFramesAndTask, readCaret"
affects: [order-delete-confirm, user-management-slideover, any Modal, ConfirmDialog or MobileNavDrawer (every overlay uses the trap)]

actuals:
  tokens: 9671
  tasks: 3
  commits: 8
plan_head_before: ac30238bde47c225aa2078238f2a69edbf15b27e
plan_head_after: fb9870473c2d76c73a7449fe865c51727a3863c9

tech-stack:
  added: []
  patterns:
    - "Focus trap remembers its own last element (module-private lastInside, seeded at activation) and returns to it with preventScroll; only the top trap pulls"
    - "Scrim close compares the press snapshot with the click only: no re-read, no timer"
    - "E2E assertions after a press wait two animation frames and a task (waitForFramesAndTask) so a late focus move or scroll is seen"

key-files:
  created: []
  modified:
    - web/src/ui/overlays/useFocusTrap.ts
    - web/src/ui/overlays/useFocusTrap.test.tsx
    - web/src/ui/overlays/Modal.tsx
    - web/src/ui/overlays/Modal.test.tsx
    - web/e2e/deleteOrderDialog.ts
    - web/e2e/dialog-fit.spec.ts
    - web/e2e/dialog-scrollbars.spec.ts
    - docs/web/e2e.md
    - .planning/phases/02-web-foundation-design-system/02-REVIEW-g199-42-DISPOSITION.md

key-decisions:
  - "WR-01 and WR-02 share one fix in useFocusTrap.ts: focus returns to the last focused element inside with preventScroll, so the backdrop does not jump and the caret stays in the confirm field; that removes the cause Modal's re-read hid, so the re-read and timer are deleted"
  - "Owner decision 2026-10-14 (option a): Firefox's own middle-button scroll of a scrolled backdrop is a known engine limit; only D5's 'scrollTop unchanged' assertion is scoped out for the firefox project, everything else in D5 still runs there"

patterns-established:
  - "An engine limit is recorded next to the one assertion it scopes, with the reason, the owner decision date and the plan; no retries, tolerances or timing windows"

requirements-completed: [WEB-02, WEB-06, A11Y-02]

coverage:
  - id: D1
    description: "A focus move outside an open overlay (a middle or right press on the dark area, a press on the backdrop scrollbar) returns focus to the element inside that last had it, with preventScroll, so the caret stays in the confirm field"
    requirement: "A11Y-02"
    verification:
      - kind: unit
        ref: "web/src/ui/overlays/useFocusTrap.test.tsx#useFocusTrap: focus that leaves comes back to where it was (review WR-01, plan 02-43)"
        status: pass
      - kind: e2e
        ref: "web/e2e/dialog-fit.spec.ts#@dialog-fit 1280x420 scrolled: a right press / a middle press ... (chromium, firefox, webkit)"
        status: pass
      - kind: e2e
        ref: "web/e2e/dialog-scrollbars.spec.ts#T1-T4 (chromium-classic-scrollbars, chromium-overlay-scrollbars)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The first-focusable fallback keeps focus inside the dialog when nothing inside had focus, the remembered element is gone, or it can no longer take focus; initial focus, Tab wrap, the toast exemption, restore-on-close and stacking are unchanged"
    requirement: "A11Y-02"
    verification:
      - kind: unit
        ref: "web/src/ui/overlays/useFocusTrap.test.tsx#falls back to the first focusable element (d, e, f) and every pre-existing trap test"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @keyboard (seven projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Modal scrim close rule has no focus re-read or timing window: any scroll between press and click blocks the close, and a left click on the dark area still closes the dialog in every project (webkit 25 of 25)"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/overlays/Modal.test.tsx#counts a scroll during the press as a scroll, even with a focus move inside it (review WR-02)"
        status: pass
      - kind: unit
        ref: "web/src/ui/overlays/Modal.test.tsx#counts a scroll a task after a focus move as a scroll too: no timing window (review WR-02)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep \"@dialog-fit 1280x420\" --project webkit --repeat-each 25 --workers 4 (125 passed, 0 flaky)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Overlay look unchanged (D-08): the @overlays parity rows are equal in chromium, firefox and webkit; no markup, class or recipe change"
    requirement: "WEB-02"
    verification:
      - kind: e2e
        ref: "npm --prefix web run parity -- --grep \"@overlays|@selftest\" (21 passed)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A person typing in the Delete Order confirm field on a scrolled backdrop in a real browser can middle- or right-click the dark area without losing the caret or the scroll position"
    verification: []
    human_judgment: true
    rationale: "The plan's optional human check (Chrome at 125-150% zoom) is end-of-phase owner re-confirmation; automation covers the behaviour, the felt experience is the owner's call"

duration: "~7h elapsed including the owner checkpoint pause (Task 1 started 2026-10-13T22:13:30-05:00; last commit 2026-10-14T05:14:00-05:00)"
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 43: Focus trap returns focus without scrolling; scrim close loses its timing window Summary

**useFocusTrap now returns focus to the element inside that last had it with preventScroll (first focusable as fallback), which let Modal drop its WebKit-timed focus re-read; a middle, right or scrollbar press keeps the caret in the confirm field and the backdrop where it was, shown by E2E in all seven projects and by a mutation run against the old trap.**

## Performance

- **Duration:** about 7 hours elapsed, including the wait for the owner's checkpoint decision
- **Started:** 2026-10-13T22:13:30-05:00 (first RED commit)
- **Completed:** 2026-10-14T05:14:00-05:00 (docs commit; this SUMMARY follows)
- **Tasks:** 3 (Task 1 tracer, Task 2, Task 3)
- **Files modified:** 9

## Accomplishments

- **WR-01 fixed.** `activateTrap` keeps a local `lastInside`, seeded from the element the trap focused on activation and updated on every focus-in inside the root (in every trap). When the top trap sees focus land outside its root and outside the toast layer, it calls `returnInside()`: `lastInside.focus({ preventScroll: true })`, falling back to `focusFirst()` if the element is gone, no longer inside, or did not take focus.
- **WR-02 fixed.** Modal's document `focusin` listener, its re-read helper and its 0 ms timer are deleted. The scrim close compares the press snapshot with the click and nothing else. Two unit tests are inverted: a scroll around a focus move, or one task after it, now blocks the close.
- **Real-engine proof.** Delete Order at 1280x420, text typed, backdrop wheeled to scrollTop 105: a middle or right press on the dark area keeps the dialog open, the field focused, the value `ORD-2026-0148` and the caret 13/13, and (except Firefox's middle press, below) leaves scrollTop at 105. T1-T4 do the same in both scrollbar projects; D6 does it for a right press above the phone sheet in pixel and iphone.
- **Mutation-proven** (see the table below).

## Task Commits

1. **Task 1 (tracer, RED):** `f24f437` test(02-43): focus that leaves a dialog must come back to where it was, without scrolling the backdrop
2. **Task 1 (GREEN):** `4250905` fix(02-43): the focus trap returns focus to where it was, without scrolling the backdrop (review WR-01)
3. **Task 2 (REFACTOR):** `23f156c` refactor(02-43): share wheelOverDialog between the dialog specs
4. **Task 2 (E2E strengthening):** `f7ffea4` test(02-43): non-closing presses must keep the caret in the confirm field and the backdrop where it was, in all seven projects (mutation-proven)
5. **Task 3 (RED):** `02b212e` test(02-43): any scroll between the press and the click must block the scrim close, with no timing window (RED)
6. **Task 3 (GREEN):** `65363ea` fix(02-43): the scrim close compares the press with the click, with no focus re-read or timing window (review WR-02)
7. **Task 3 (annotation fix):** `f35b3c4` test(02-43): record the caret, not an undefined focus flag, in the dialog-focus annotation
8. **Task 3 (records):** `fb98704` docs(02-43): record WR-01/WR-02 as fixed and the scrolled-backdrop focus cases

**Plan metadata:** the commit that adds this SUMMARY, STATE.md and ROADMAP.md.

## Files Created/Modified

- `web/src/ui/overlays/useFocusTrap.ts` - `lastInside`, `returnInside`, the rewritten `onFocusIn`, updated header comment
- `web/src/ui/overlays/useFocusTrap.test.tsx` - two updated expectations, new describe (a)-(f)
- `web/src/ui/overlays/Modal.tsx` - focus re-read, document listener and timer removed; one comment sentence added
- `web/src/ui/overlays/Modal.test.tsx` - two WR-02 tests inverted, new trap-plus-Modal describe (m), (n)
- `web/e2e/deleteOrderDialog.ts` - `wheelOverDialog` (moved), `waitForSettledScroll`, `waitForFramesAndTask`, `readCaret`
- `web/e2e/dialog-fit.spec.ts` - D1 focus checks, D4/D5 (shared helper `expectScrolledPressKept`), D6
- `web/e2e/dialog-scrollbars.spec.ts` - T1-T4 with focus, caret and scrollTop checks, `expectKept`
- `docs/web/e2e.md` - `@dialog-fit` row describes the scrolled-backdrop cases and cites 02-43
- `.planning/phases/02-web-foundation-design-system/02-REVIEW-g199-42-DISPOSITION.md` - WR-01 and WR-02 `fixed`

## Decisions Made

- One shared fix in the trap, as the owner locked; the Modal workaround it made redundant was deleted, not kept as a safety net (WEB-06: no timing window).
- **Owner-approved engine limit (2026-10-14, option a):** see the next section.

## Engine limit: Firefox middle press on a scrolled backdrop (owner-approved deviation)

At the first seven-project `@dialog-fit` run of Task 2, D5 failed in **firefox** only: a middle press on the dark area at 1280x420 from a scrolled backdrop left the dialog open and the field focused with value and caret 13/13, but scrollTop went from 105 to 0.

Probe (Firefox): the trap's only `focus()` call used `preventScroll`, and scrollTop stayed 105 through the trap's re-focus and the mouseup. A scroll event about 22 ms after the mouseup took it to 4 and then 0. A right press does not do this, and moving the mouse afterwards does not scroll further. No code in `web/src` scrolls. So this is Firefox's own middle-button behaviour, not a `focus()` call.

The plan's conditional checkpoint "A backdrop scroll the focus trap does not cause" fired and the owner chose option (a): record it as a known limit of Firefox. Applied exactly as ruled:

- In `web/e2e/dialog-fit.spec.ts`, only D5's "scrollTop unchanged" assertion is skipped, and only when the button is `middle` and the project is `firefox`. The reason is written next to it (Firefox's own middle-button scroll about 22 ms after mouseup, 105 -> 4 -> 0, not caused by a `focus()` call; owner decision 2026-10-14; plan 02-43).
- In Firefox, D5 still asserts that the dialog is open, the field is focused, the value is exactly `ORD-2026-0148` and the caret is 13/13. Every other assertion, project and engine is unchanged. No retry, tolerance, timing window or Firefox-specific product code was added.
- The WR-01 disposition note records the limit. In the mutation table below, a Firefox D5 scroll outcome is explained by this limit.

Annotation from the final run: `firefox middle press: scrollTop 105 -> 0, caret {"start":13,"end":13}`. Chromium and WebKit middle presses read 105 -> 105.

## Evidence

### RED outcomes

| Commit | Failing tests | Evidence |
|---|---|---|
| `f24f437` (Task 1) | The updated "brings focus back..." expectation, the updated UI-WR-02 expectation, (a), (b), (c): 5 unit tests; D4 in chromium (field lost focus) | `RED_EVIDENCE_OK` via `gsd-tools check tdd-red-evidence` for each. (d), (e), (f) passed before and after, as planned |
| `02b212e` (Task 3) | The two inverted WR-02 tests: 2 failed, 51 passed (including (m), (n)) | `RED_EVIDENCE_OK` for both |

### Mutation run (Task 2)

The plan-base `useFocusTrap.ts` (`git show abea9db:...`) was written over the working copy only, `npm --prefix web run e2e -- --grep @dialog-fit` was run in all seven projects, and the file was restored with `git checkout HEAD --` (`git diff --quiet HEAD -- web/src/ui/overlays/useFocusTrap.ts` exited 0 at every commit). Result: **19 failed, 28 passed, 31 skipped.** Every failure is `toBeFocused` on the confirm field (Expected focused, Received inactive): the old trap moved focus to Close.

| Project | Failed against the pre-fix trap | Passed against it (reason) |
|---|---|---|
| chromium | D1 (middle press focus), D4 (right), D5 (middle) | D2, D3-style left clicks: they close the dialog and never needed the caret |
| firefox | D1, D4, D5 | same |
| webkit | D1, D4, D5 | same |
| pixel | D6 | D3: left click only |
| iphone | D6 | D3: left click only |
| chromium-classic-scrollbars | T1 (focus lost at the scrollbar press), T2, T3, T4 | none of T1-T4 |
| chromium-overlay-scrollbars | T1, T2, T3, T4 | none of T1-T4 |

All 19 failed on the focus assertion, which runs before the scrollTop assertion, so the mutation run shows the focus loss in every engine and project; the scrollTop checks are proven by the green runs (105 -> 105). A Firefox D5 scroll outcome is explained by the engine limit above, not by the trap. No case was deleted.

### E2E pass counts

| Run | Result |
|---|---|
| Task 2, `--grep @dialog-fit`, trap restored | 47 passed, 31 skipped (by design: desktop-only cases in pixel/iphone and the reverse), 0 failed |
| Task 3, `--grep @dialog-fit`, after the Modal change | 47 passed, 31 skipped, 0 failed |
| Webkit repeat, `--grep "@dialog-fit 1280x420" --project webkit --repeat-each 25 --workers 4` | 125 passed, 0 failed, 0 flaky, retries 0 |
| Full proof, `--grep "@dialog-fit\|@showcase\|@keyboard\|@a11y-rulings"` | 407 passed, 31 skipped, 0 failed, 0 flaky. Per project (passed/skipped): chromium 83/3, firefox 83/3, webkit 83/3, pixel 75/11, iphone 75/11, chromium-classic-scrollbars 4/0, chromium-overlay-scrollbars 4/0 |
| Parity, `--grep "@overlays\|@selftest"` | 21 passed in chromium, firefox and webkit; self-test found its drift |
| `npm --prefix web run verify` | exit 0: typecheck, lint (`--max-warnings 0`), format, 109 test files / 3110 tests, coverage (all files 98.26 statements, 96.51 branches, 99.82 functions, 99.82 lines), build, budgets, license gate, notices |

### Annotations (final run, scrollTop before -> after)

- chromium: right 105 -> 105, middle 105 -> 105; caret 13/13
- firefox: right 105 -> 105; middle 105 -> 0 (the engine limit); caret 13/13
- webkit: right 105 -> 105, middle 105 -> 105; caret 13/13
- pixel, iphone (right press above the sheet): 0 -> 0
- chromium-classic-scrollbars: drag 30 -> 105; first scrollbar column press 30 -> 30
- chromium-overlay-scrollbars: drag 30 -> 105

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The `dialog-focus` annotation printed `field focused undefined`**
- **Found during:** Task 3 (reading the annotations of the seven-project run)
- **Issue:** the annotation used `field.evaluate<boolean>('(element) => ...')` with a string function, which returned `undefined`. The assertions were not affected (`toBeFocused` and `readCaret` run separately), only the recorded evidence.
- **Fix:** the annotation now records the real caret from `readCaret(page)`.
- **Files modified:** `web/e2e/dialog-fit.spec.ts`
- **Verification:** the full seven-project run printed `caret {"start":13,"end":13}`.
- **Committed in:** `f35b3c4`

### Owner-approved deviation

**2. [Owner decision, Rule 4 checkpoint] Firefox middle-press scroll scoped out of D5** - described in full above. Decision of 2026-10-14, option (a). Commit `f7ffea4`.

### Process notes

**3. [Tooling] RED evidence format.** As in 02-42 deviation 4, `gsd-tools check tdd-red-evidence` only reads Vitest JUnit output with the `name` and `classname` attributes swapped. The records were built that way from the same data; both Task 3 REDs and all five Task 1 REDs returned `RED_EVIDENCE_OK`.

**4. [Task split] The Task 2 REFACTOR and Task 1/Task 3 commits** follow the plan's commit titles. Task 3 has one extra small `test(02-43)` commit (deviation 1).

---

**Total deviations:** 1 auto-fixed (1 bug in evidence output), 1 owner-approved engine-limit scope, 2 process notes.
**Impact on plan:** no scope creep, no package change, no look/markup/class change, no assertion weakened beyond the single owner-approved Firefox middle-press scrollTop scope.

## Issues Encountered

- The Firefox middle-press scroll (above), resolved by the owner's decision.
- Python is not installed on this machine, so scripted edits used Node and the Edit tool.

## Known Stubs

None. No stub, TODO or placeholder was added.

## Threat Flags

None. No new network endpoint, auth path, file access or schema change.

## Threat model status

| Threat | Result |
|---|---|
| T-02-91 (focus jump and backdrop jump after a non-closing press) | mitigated: trap returns with preventScroll; D4/D5/D6/T1-T4 pass, mutation-proven |
| T-02-92 (Modal timing window) | mitigated: re-read and timer deleted; webkit 25/25, 0 retries |
| T-02-93 (focus escapes the modal) | mitigated: `returnInside` checks `isConnected`, `root.contains` and that focus landed, else `focusFirst()`; unit (d), (e), (f) |
| T-02-94 (stacked traps) | mitigated: every trap records, only the top one pulls; the four UI-WR-02 tests pass |
| T-02-95 (pre-fix trap committed) | mitigated: restored and `git diff --quiet` clean before every commit |
| T-02-SC (installs) | no installs; `web/package.json` and `web/package-lock.json` unchanged |

## Constraint checks

- Frozen/unchanged since `abea9db` (diff prints nothing): `playwright.config.ts`, `Overlay.tsx`, `MobileNavDrawer.tsx`, `overlays.recipe.ts`, `rulings.css`, `rulings.test.ts`, `package.json`, `package-lock.json`.
- Modal.tsx: no `setTimeout`, `clearTimeout`, `rereadPending` or `'focusin'`; the SPEC-DEVIATION D-42 paragraph is untouched; one `preventDefault` (Esc).
- `.claude/launch.json` and `02-REVIEW-g199-DISPOSITION.md` were never staged. The probe spec was never committed. Deferred review items IN-01..IN-06 are still `deferred` (6 rows).

## User Setup Required

None - no external service configuration required.

## Human check (end of phase, optional)

Open `/dev/components`, press "Open Delete Order", shorten the window until the dark backdrop scrolls, type the order number, wheel down to Cancel and Delete Order, then middle-click and right-click the dark area. The dialog stays open, the backdrop does not jump (in Firefox a middle-click may scroll the backdrop: the documented engine limit), and typing continues in the field. Drag the backdrop's scrollbar: it scrolls and typing continues. A left click on the dark area closes the dialog.

## Next Phase Readiness

WR-01 and WR-02 are closed, so the G-2-199 follow-up is complete. The deferred review items stay deferred. Nothing blocks the next plan.

## TDD Gate Compliance

RED (`test(02-43)`) commits `f24f437` and `02b212e` precede their GREEN (`fix(02-43)`) commits `4250905` and `65363ea`; the Task 2 REFACTOR is `23f156c`. Each RED returned `RED_EVIDENCE_OK`.

## Self-Check: PASSED

All nine modified files and the eight task commits (`f24f437`, `4250905`, `23f156c`, `f7ffea4`, `02b212e`, `65363ea`, `f35b3c4`, `fb98704`) exist. The acceptance greps for Modal.tsx, the disposition rows (2 fixed, 6 deferred) and the docs row (5 fields, cites 02-43) pass, and the frozen-file diff against `abea9db` is empty.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-14*

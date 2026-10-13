---
phase: 02-web-foundation-design-system
plan: 41
subsystem: ui
tags: [overlays, modal, tailwind, playwright, wcag-1.4.10, d-42, gap-closure]
created: "2026-10-13T17:46:06-05:00"
updated: "2026-10-13T17:46:06-05:00"
gap_ids: [G-2-199]

requires:
  - phase: 02-web-foundation-design-system
    provides: "Overlay region (App. C .s-overlay), Modal/ConfirmDialog, rulings layer and parity proof, E2E host"
provides:
  - "D-42 Overlay region: column flow with a shrinkable ::before spacer (124px desktop, 96px phone), no-shrink children, scrolling backdrop"
  - "D-42 rulings-layer groups so the frozen reference renders the same rule (parity stays equal)"
  - "@dialog-fit E2E spec: short-window geometry and reachability of the Delete Order dialog in all five projects"
  - "Modal scrim guard: a press on the backdrop's own scrollbar never closes the dialog"
affects: [admin orders, confirm dialogs, every inline Modal in an Overlay region]

actuals:
  tokens: 10765
  tasks: 3
  commits: 5
plan_head_before: 6272a79d7ac7499c6f3b5dcd1feb08f166a4658d
plan_head_after: a3899b5ddf1e8a3f18b08a02e1a9a98a13cd2982

tech-stack:
  added: []
  patterns:
    - "Shrinkable pseudo-element spacer (before:basis-[Npx] in a flex column) to keep an approved offset where content fits and give it up where it does not, pure CSS"
    - "Scrim mousedown ignores presses on the scrim's own scrollbar (geometry check, no listeners added)"

key-files:
  created:
    - web/e2e/dialog-fit.spec.ts
    - web/src/ui/overlays/overlays.recipe.node.test.ts
  modified:
    - web/src/ui/overlays/overlays.recipe.ts
    - web/src/ui/overlays/Modal.tsx
    - web/src/ui/overlays/Modal.test.tsx
    - web/src/ui/overlays/Overlay.tsx
    - web/visual/reference/rulings.css
    - web/visual/reference/rulings.test.ts
    - docs/web/parity.md
    - docs/web/e2e.md
    - .planning/phases/02-web-foundation-design-system/02-CONTEXT.md
    - .planning/phases/02-web-foundation-design-system/02-UI-SPEC.md
    - .planning/phases/02-web-foundation-design-system/02-UAT.md

key-decisions:
  - "D-42 is pure CSS: the region is a flex column whose ::before spacer (124px, 96px on phone pages) is the only part that shrinks, so 16px padding + 124px = the approved 140px wherever the dialog fits; no JS measuring, no inline style"
  - "The phone sheet had the same defect (393x659, 320x568, 659x393), so it follows the same rule with App. C's phone values (96px down to 0)"
  - "@dialog-fit measures the layout top as box top + region scrollTop: opening the dialog focuses its first field, which scrolls the backdrop on a window shorter than the dialog"

patterns-established:
  - "Owner look rulings that change layout land in three places together: the recipe (SPEC-DEVIATION marker), rulings.css + rulings.test.ts, and parity.md section 6 / UI-SPEC intentional differences"

requirements-completed: [WEB-02, WEB-06, A11Y-02, A11Y-04, PERF-03]

coverage:
  - id: D1
    description: "At 1440x900 the Delete Order dialog stays 140px down and centred; at 412x839 the phone sheet stays 96px down (approved position unchanged where it fits)"
    requirement: "WEB-02"
    verification:
      - kind: e2e
        ref: "web/e2e/dialog-fit.spec.ts#@dialog-fit 1440x900 / 412x839 phone page (chromium, firefox, webkit; pixel device test)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep \"@overlays|@selftest\" (21 passed, chromium/firefox/webkit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "At the owner's 1274x585 window the dialog moves up (top 76.4) so Cancel and Delete Order are fully inside the window with no scrolling"
    requirement: "A11Y-04"
    verification:
      - kind: e2e
        ref: "web/e2e/dialog-fit.spec.ts#@dialog-fit 1274x585 (the owner's window)"
        status: pass
    human_judgment: false
  - id: D3
    description: "At 1280x420 (and 320x568 phone pages) the dialog sits at the edge gap and the backdrop scrolls; wheel and keyboard focus bring both buttons fully into view; scrim covers the window; axe-clean"
    requirement: "PERF-03"
    verification:
      - kind: e2e
        ref: "web/e2e/dialog-fit.spec.ts#@dialog-fit 1280x420 by mouse / by keyboard / 320x568 phone page"
        status: pass
    human_judgment: false
  - id: D4
    description: "A press on the backdrop's own scrollbar never closes the dialog; a press on the scrim still does"
    requirement: "WEB-06"
    verification:
      - kind: unit
        ref: "web/src/ui/overlays/Modal.test.tsx#scrim presses on the backdrop's own scrollbar (D-42)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Owner re-check of UAT test 199 in Chrome at 125-150% zoom (centred, whole dialog visible or reachable by scrolling, scrollbar drag keeps it open)"
    requirement: "A11Y-02"
    verification: []
    human_judgment: true
    rationale: "The plan's <human-check>: the owner reported the gap at real browser zoom and must re-check test 199 at end of phase"

duration: 40min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 41: Dialog fit on short windows (D-42) Summary

**Overlay region rebuilt as a flex column with a shrinkable 124px/96px `::before` spacer and a scrolling backdrop, so the Delete Order dialog keeps its approved 140px/96px place where it fits, moves up to the 16px/0 edge gap on a short window, and scrolls when still taller; backdrop-scrollbar presses no longer close the dialog.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-10-13T22:05:30Z
- **Completed:** 2026-10-13T22:46:06Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- G-2-199 closed in code: at the owner's 1274x585 window the whole Delete Order dialog (Cancel and Delete Order included) is visible with no scrolling, in chromium, firefox and webkit.
- Below that, the backdrop scrolls (WCAG 1.4.10): at 1280x420 the mouse wheel over the dialog and keyboard focus on Delete Order both bring the buttons fully into view, the scrim still covers the whole window, and the page is axe-clean.
- Phone check (decision point 4): the sheet had the same defect before the fix (measured in Chromium while planning: 393x659 Delete Order ended at 680 > 659; 320x568 at 759; 659x393 at 618; 412x839 fit). It now follows the same rule: 96px down where it fits, moving up to 0, then scrolling.
- Nothing moved where the dialog already fit: 1440x900 stays 140px down and centred, 412x839 stays 96px down, and the `@overlays` parity rows (900px tall) stay equal in all three engines.
- Ruling D-42 recorded in rulings.css (pinned by rulings.test.ts), docs/web/parity.md section 6, 02-UI-SPEC.md intentional differences, 02-CONTEXT.md and docs/web/e2e.md; G-2-199 keeps `status: failed` with `fix_plan`, `fix_state` and `phone_check` for `/gsd-verify-work` to reconcile.

### Measured post-fix positions (dialog top as laid out, dialog height, region scrollHeight/clientHeight)

| Window | chromium | firefox | webkit | Expected |
|---|---|---|---|---|
| 1440x900 | top 140, h 492.6, 900/900 | top 140, h 492.6, 900/900 | top 140, h 492.6, 900/900 | 140 (unchanged) |
| 1274x585 | top 76.4, h 492.6, 585/585 | top 76.4, h 492.6, 585/585 | top 76.4, h 492.6, 585/585 | 585 − 16 − h |
| 1280x420 | top 16, h 492.6, 525/420 | top 16, h 492.6, 525/420 | top 16, h 492.6, 525/420 | 16, scrolls |
| 412x839 phone page | top 96, h 581.2, 839/839 | top 96, h 581.2, 839/839 | top 96, h 581.2, 839/839 | 96 (unchanged) |
| 393x659 phone page | top 57.8, h 601.2, 659/659 | top 57.8, h 601.2, 659/659 | top 57.8, h 601.2, 659/659 | 659 − h |
| 320x568 phone page | top 0, h 680.0, 680/568 | top 0, h 680.0, 680/568 | top 0, h 680.0, 680/568 | 0, scrolls |
| Device | pixel (412x839): top 96, h 581.2, 839/839 | iphone (393x659): top 57.8, h 601.2, 659/659 | | clamp(H − h, 0, 96) |

## Task Commits

1. **Task 1 (tracer): region recipe, rulings layer, real-host E2E** - `05d444f` (test, RED), `7ddc287` (feat, GREEN). Tracer gate: verify re-run end-to-end (chromium 7 passed, 1 skipped) before expanding.
2. **Task 2: backdrop-scrollbar press guard; five-project proof; parity re-run** - `63a6984` (test, RED), `5c50ad4` (fix, GREEN)
3. **Task 3: record D-42, point G-2-199 at this plan, full web gate** - `a3899b5` (docs)

**Plan metadata:** this SUMMARY commit (docs: complete plan)

## TDD Gate Compliance

- Task 1: RED `05d444f` before GREEN `7ddc287`. RED evidence verdict `RED_EVIDENCE_OK` (target `src/ui/overlays/overlays.recipe.node.test.ts`, 8 unit assertions failing on the planned behaviour); E2E RED in chromium failed exactly 1274x585, 1280x420 (mouse and keyboard), 393x659 and 320x568, and passed 1440x900 and 412x839, as the plan predicted.
- Task 2: RED `63a6984` before GREEN `5c50ad4` (the plan names it `fix(02-41)`). RED evidence `RED_EVIDENCE_OK` (target `src/ui/overlays/Modal.test.tsx`: the three scrollbar-press tests closed the dialog).
- No REFACTOR commits were needed.

## Verification

- Unit: `npm --prefix web run test -- --run src/ui/overlays visual/reference/rulings scripts/tailwind-classes.test.ts scripts/owner-review.test.ts` passed (overlays 96, rulings + class gate 190 incl. overlays, owner-review + rulings 103).
- E2E `--grep "@dialog-fit|@showcase|@keyboard|@a11y-rulings"`, all five projects (17.5 min): chromium 79 passed / 1 skipped; firefox 77 passed / 1 skipped / 2 failed; webkit 79 passed / 1 skipped; pixel 73 passed / 7 skipped; iphone 73 passed / 7 skipped. Both firefox failures were page-load timeouts under the full parallel load (`page.goto` timed out at 60s on /admin/users in an untouched `@a11y-rulings` D-05 test; the showcase h1 had not rendered within 5s in `@dialog-fit 1440x900`). Re-run in isolation, firefox `@dialog-fit` plus that D-05 test: 9 passed, 1 skipped. Then `@dialog-fit` alone in all five projects: 23 passed, 17 skipped, 0 failed, 0 flaky. No guard findings (console, page error, CSP, failed response) in any run.
- Parity `--grep "@overlays|@selftest"`: 21 passed in chromium, firefox and webkit; the self-test still catches its 1px drift. No tolerance, no normalization, no `--update-snapshots`.
- Full gate: `npm --prefix web run verify` exited 0 (typecheck, lint with zero warnings, format, 109 files / 3087 tests with coverage at 98.25% statements, build, budgets, license gate, notices).

## Files Created/Modified

- `web/src/ui/overlays/overlays.recipe.ts` - `overlayRegionClasses` is the D-42 transcription, with a `SPEC-DEVIATION: D-42` doc comment
- `web/src/ui/overlays/overlays.recipe.node.test.ts` - pins the tokens and the compiled CSS (column, flex-start, centre, overflow-y auto, `> *` no-shrink, `::before` 124px / 96px in the phone container, no 140px)
- `web/visual/reference/rulings.css` / `rulings.test.ts` - four D-42 groups (`.s-overlay`, `.s-overlay::before`, `.s-overlay > *`, the phone container), pinned
- `web/e2e/dialog-fit.spec.ts` - `@dialog-fit`: desktop, phone-page and device tests; records the measured place as a report annotation
- `web/src/ui/overlays/Modal.tsx` - module-level `pressedOnScrollbar`; the scrim mousedown skips scrollbar presses
- `web/src/ui/overlays/Modal.test.tsx` - scrollbar-press tests (vertical, none, horizontal, fixed Modal scrim)
- `web/src/ui/overlays/Overlay.tsx` - header comment only
- `docs/web/parity.md`, `docs/web/e2e.md`, `02-CONTEXT.md`, `02-UI-SPEC.md`, `02-UAT.md` - D-42 records and the gap pointer

## Decisions Made

- Followed the plan's pure-CSS design exactly: the spacer is a pseudo-element both sides draw, so the parity pairing needs no structural exception and `web/visual/intentional-differences.ts` is unchanged.
- No look checkpoint was needed: no dialog that fits moved (140px and 96px held in every engine), the dialog stayed centred, and every `@overlays` parity row stayed equal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The E2E top assertion now adds back the backdrop's scroll position**
- **Found during:** Task 1 (GREEN, chromium run)
- **Issue:** at 320x568 the sheet measured top -16, not 0. Opening the dialog focuses its first field (focus trap), and on a window shorter than the sheet the browser scrolls the now-scrollable backdrop to show that field. The layout was right; the test measured the scrolled position.
- **Fix:** the region metrics include `scrollTop`, and every top assertion uses `topOf(fit) = box top + scrollTop` (the place the layout gives the dialog). The spec also records the measured place as a `dialog-fit` report annotation, which the plan asked for in the SUMMARY.
- **Files modified:** web/e2e/dialog-fit.spec.ts
- **Verification:** `@dialog-fit` green in all five projects with the expected tops (table above)
- **Committed in:** `7ddc287` (Task 1 GREEN)

---

**Total deviations:** 1 auto-fixed (1 test-measurement bug)
**Impact on plan:** No scope change. The production rule is exactly the planned D-42 transcription.

## Issues Encountered

- Two firefox page-load timeouts in the 17.5-minute five-project E2E run (see Verification). Both passed on an isolated re-run, and `@dialog-fit` then passed in all five projects together. This is the same load-timing class as the known plan 02-35 showcase timing flake in deferred-items.md. It is not caused by this plan, and no tolerance or retry was added.
- The `check tdd-red-evidence` JUnit parser reads a testcase's `classname` attribute as its `name`, so a Vitest RED record has to name the test file as the target. RED evidence was recorded at the file level for both RED commits.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- G-2-199 is implemented. Next: `/gsd-verify-work 2` reconciles the gap through this plan's `gap_ids`, and the owner re-checks UAT test 199 in Chrome at 125-150% zoom (the dialog is centred; the whole dialog is visible or the dark backdrop scrolls to it; a normal-height window looks as before; dragging the backdrop's scrollbar does not close it).

## Self-Check: PASSED

- FOUND: web/e2e/dialog-fit.spec.ts, web/src/ui/overlays/overlays.recipe.node.test.ts, web/src/ui/overlays/overlays.recipe.ts, web/visual/reference/rulings.css, web/src/ui/overlays/Modal.tsx
- FOUND commits: 05d444f, 7ddc287, 63a6984, 5c50ad4, a3899b5
- Acceptance greps: rulings.css D-42 = 4; recipe `SPEC-DEVIATION: D-42` = 1; rulings.test.ts `'D-42'` = 2; spec `@dialog-fit` = 8; Modal.tsx `pressedOnScrollbar` = 2 and `SPEC-DEVIATION: D-42` = 1; Overlay.tsx D-42 = 1; UAT `status: failed` present with `fix_plan`; e2e.md `@dialog-fit` = 1; parity.md D-42 = 2

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-13*

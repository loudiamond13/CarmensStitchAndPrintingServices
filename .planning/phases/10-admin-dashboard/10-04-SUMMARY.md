---
phase: 10-admin-dashboard
plan: 04
subsystem: ui
tags: [react, svg, chart, income-expenses, profit-line, resize-observer, tdd]
created: "2026-11-06T22:35:00-06:00"
updated: "2026-11-06T22:35:00-06:00"

requires:
  - phase: 02-ui-foundation
    provides: IncomeExpenseChart (App. D.3), data.recipe.ts and the parity suite
provides:
  - "IncomeExpenseChart showProfit: the server's monthly profit as a line with halo, points, legend key and tooltip row"
  - "labels prop for the legend and tooltip words (defaults unchanged)"
  - "Below-zero scale: negative income bars grow down, zero line, U+2212 ticks, profit line split at zero"
  - "True-pixel width and every-other month labels on narrow frames (with showProfit)"
affects: [10-11 dashboard income vs expenses card, 10-21 e2e]

requirements-completed: [DASH-03]

actuals:
  tokens: 9500
  tasks: 3
  commits: 8
plan_head_before: b8d2494f23b4de7a6734ecea1ae8c6ef88438d1c
plan_head_after: 3675a26946e5d36b4e6c24e309b7f7b5b761f8de

tech-stack:
  added: []
  patterns:
    - "Hand-rolled SVG under the strict CSP: no style attribute, clip ids from useId()"
    - "Optional props keep the default drawing byte-for-byte; the new modes switch on showProfit"

key-files:
  created: []
  modified:
    - web/src/components/data/IncomeExpenseChart.tsx
    - web/src/components/data/IncomeExpenseChart.test.tsx
    - web/src/components/data/data.recipe.ts

key-decisions:
  - "True-pixel width and label thinning switch on with showProfit, not always (see Deviations): the parity suite compares the default chart at the scaled 640 look"
  - "labels.profit is one word used by both the legend and the tooltip row, as the plan's prop shape says"
  - "A month without a profit figure draws no point and shows no Profit or Net row; the browser never fills it in"

patterns-established:
  - "Below-zero axis: bottom is the lowest figure rounded down to the top's step; with nothing below zero it is 0 and every position is as in App. D.3"

coverage:
  - id: D1
    description: "With showProfit the chart draws the server's profit per month (halo, line, points), a Profit legend key with a line swatch, a Profit tooltip row replacing Net, and names ending with the server profit; the browser never computes profit"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "web/src/components/data/IncomeExpenseChart.test.tsx#IncomeExpenseChart profit line (D-36, D-50)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The labels prop sets the legend and tooltip words; without it the words are today's"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "web/src/components/data/IncomeExpenseChart.test.tsx#replaces the legend and tooltip words with the labels prop"
        status: pass
    human_judgment: false
  - id: D3
    description: "Months below zero: the axis runs from the lowest figure down to the top step, zero line in the axis look, negative income bars grow down, ticks use U+2212, the profit line is solid green above zero and dashed red below, split at zero by two useId clipPaths"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "web/src/components/data/IncomeExpenseChart.test.tsx#IncomeExpenseChart below zero (D-36)"
        status: pass
    human_judgment: false
  - id: D4
    description: "With showProfit the chart draws at the measured frame width (640 until measured) and draws every other month label, counting back from the last, when a group is under 28px; the observer disconnects on unmount"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "web/src/components/data/IncomeExpenseChart.test.tsx#IncomeExpenseChart true-pixel width (D-51)"
        status: pass
    human_judgment: false
  - id: D5
    description: "With no new prop the chart draws exactly as before (P2 parity scenarios chart-6-months and chart-12-months)"
    requirement: DASH-03
    verification:
      - kind: e2e
        ref: "npm --prefix web run parity: chart-6-months and chart-12-months computed styles and boxes (all four themes and widths, three browsers)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run parity: chart-6-months and chart-12-months pixel snapshots"
        status: fail
    human_judgment: true
    rationale: "The structural look-equality check passes. The pixel snapshot check fails for the chart and for components this plan never touched (data table, status badge, overlays, KPI), so it looks like a local rendering difference, but I could not run the base commit to prove it (the shared machine stayed busy). A person or CI should confirm."
  - id: D6
    description: "How the profit line, halo, dashed red segment, points and legend swatch look beside the bars on a phone and a desktop"
    requirement: DASH-03
    verification: []
    human_judgment: true
    rationale: "There is no approved reference drawing for the profit line; plan 10-11 puts the chart on the dashboard and the UI review judges the look."

duration: 110min
completed: 2026-11-06
status: complete
---

# Phase 10 Plan 04: Income vs expenses chart with profit line, negative months and phone widths Summary

*Created: 2026-11-06T22:35:00-06:00 · Updated: 2026-11-06T22:35:00-06:00*

**The shared IncomeExpenseChart now draws the server's monthly profit as a split green/red line, handles months below zero, and draws at the frame's real width with thinned month labels, all behind `showProfit` and `labels`; with no new prop it draws as before.**

## Performance

- **Duration:** about 110 min
- **Started:** 2026-11-06T20:44:00-06:00
- **Completed:** 2026-11-06T22:35:00-06:00
- **Tasks:** 3 (plus one fix found by the parity run)
- **Files modified:** 3 (all under `web/src/components/data/`)

## Accomplishments

- `showProfit` draws one point per month at the server's `profit` over a 4px `--surface` halo, joined by a 2px line. The legend gets a profit key (16 x 2px bar with a 6px dot). The tooltip's Net row becomes a Profit row. Month names end with `, profit ₱…`. The browser never works profit out. A month with no profit figure draws nothing for it.
- `labels` sets the legend and tooltip words. Defaults are "Income (payments)", "Expenses (company + orders)", "Profit", "Net".
- Below zero: the axis bottom is the lowest income or profit figure rounded down to the top's step. Gridlines sit at the bottom, zero, half the top and the top. The zero line uses the axis look. Negative income bars grow down from zero with rounded bottom corners. Ticks read `−₱20k` with U+2212. The profit line is drawn twice, `--success` solid above zero and `--danger` dashed `4 3` below, split exactly at zero by two `clipPath`s whose ids come from `useId()`. Points take the color of their side. A negative profit shows in `--danger` in the tooltip and reads `−₱` in the name.
- True-pixel drawing (with `showProfit`): `ResizeObserver` measures the frame, the width becomes the view box width (640 until measured and in jsdom), and a group narrower than 28px draws only every other month label, counting back from the last. All groups keep their full names. The observer disconnects on unmount.
- No package added, no style attribute, no new token, color, size or weight.

## TDD record

Every task has a RED commit before its GREEN commit. RED evidence was checked with `gsd_run check tdd-red-evidence` and returned `RED_EVIDENCE_OK` (`target_test_failed`) each time. The `tap-flat` reporter could not be used: Vitest prints multi-line failure messages unindented, so the classifier rejects it (`invalid_record`, "Non-TAP data"). The evidence records use the Vitest JUnit report instead, which the classifier accepts.

| Gate | RED commit | Target test (failed on the planned assertion) | Failing / total | GREEN commit |
| ---- | ---------- | --------------------------------------------- | --------------- | ------------ |
| Task 1 profit line | `d0f1eb75` | "shows the profit row from the server figure and no Net row in the tooltip": profit row missing, Net row present | 9 / 31 | `1d273914` |
| Task 2 below zero | `0882555a` | "splits the profit line at zero with two clipPaths...": no clipPath drawn | 10 / 43 | `5905cb1d` |
| Task 3 true-pixel | `7a670e11` | "disconnects the observer when the chart unmounts": disconnect never called | 5 / 51 | `5fc489e0` |
| Gate fix (parity) | `0eb5ac76` | "keeps the 640 scaled drawing and every month label without showProfit": view box became 320 | 1 / 52 | `3675a269` |

Semantic assessment for each RED: the target tests ran and failed on the assertion about the new drawing (a missing row, missing clip paths, a view box that did not change, no disconnect call), not on an import, setup or fixture fault. For RED 1 the recipe class exports were added in the RED commit so the tests fail on behavior and not on `undefined` class lists. Some tests in each RED batch passed at once (for example "without showProfit keeps the Net row"); they are regression guards for the unchanged default.

No refactor commit was needed.

## Task Commits

1. **Task 1 (tracer): profit line, legend key, tooltip row, labels** - `d0f1eb75` (test), `1d273914` (feat)
2. **Task 2: months below zero** - `0882555a` (test), `5905cb1d` (feat)
3. **Task 3: true-pixel width and thinned labels** - `7a670e11` (test), `5fc489e0` (feat)
4. **Fix found by the parity run: keep the scaled 640 default** - `0eb5ac76` (test), `3675a269` (fix)

**Plan metadata:** the commit that adds this file.

The tracer gate ran after Task 1: `<verify>` is automated only and `HUMAN_VERIFY_MODE` is the default `end-of-phase`, so the test file was re-run (31 passed) and the plan expanded.

## Files Created/Modified

- `web/src/components/data/IncomeExpenseChart.tsx` - the chart: new props, below-zero scale, profit drawing, measuring, label thinning
- `web/src/components/data/IncomeExpenseChart.test.tsx` - 52 tests (was 21): profit, labels, below zero, true-pixel width, parity-default guards
- `web/src/components/data/data.recipe.ts` - `chartProfitGroupClasses`, `chartProfitHaloClasses`, `chartProfitLineClasses`, `chartProfitPointClasses`, `chartProfitSwatchClasses`, `chartProfitLossClasses`, `chartZeroLineClasses` (existing tokens only)

## Decisions Made

- `labels.profit` feeds both the legend key and the tooltip row, because the plan fixes the prop shape. UI-SPEC D3 wants a longer legend word ("Profit (income minus expenses)") but the tooltip word "Profit". Plan 10-11 can pass "Profit" and accept a short legend, or the owner can rule that the prop gets a separate tooltip word. I did not decide this.
- The tooltip's Income and Expenses rows keep the plain words "Income" and "Expenses" (as today). Only the legend uses `labels.income` and `labels.expenses`, so the default tooltip is unchanged.
- The line is drawn as two clipped copies whenever `showProfit` is on, even when nothing is negative (the below copy is then clipped away). One code path, two extra DOM nodes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] True-pixel width broke the default chart's parity**
- **Found during:** Task 3 verification (`npm --prefix web run parity`)
- **Issue:** The plan has the chart always measure its frame (D-51), but also says the P2 parity scenarios must pass unchanged when no new prop is given. The first parity run failed `chart-6-months` and `chart-12-months` "computed styles and boxes" in every theme, width and browser: the reference scales a 640-wide drawing (523px tall at 1440) while the measured chart drew 248px tall.
- **Fix:** Width measuring and every-other-label thinning now apply only with `showProfit` (the dashboard card, which is what D-51 is for). Without it the chart keeps the scaled 640 drawing and every label. This follows the plan's stronger, testable rule that the default look is unchanged. Plan 10-11 needs no change because it already passes `showProfit`.
- **Files modified:** `web/src/components/data/IncomeExpenseChart.tsx`, `web/src/components/data/IncomeExpenseChart.test.tsx`
- **Verification:** new RED test then green; second parity run has no chart "computed styles and boxes" failure.
- **Committed in:** `0eb5ac76` (test), `3675a269` (fix)

**2. [Rule 3 - Blocking] RED reporter**
- **Found during:** Task 1 RED evidence
- **Issue:** the classifier rejects Vitest's TAP output (multi-line messages are not indented).
- **Fix:** used the Vitest JUnit report as the evidence record. No product change.

**3. [Rule 1 - Bug] A RED test queried the wrong element**
- **Found during:** Task 1 GREEN
- **Issue:** a test looked for "Profit" on the whole page, which also matches the legend key.
- **Fix:** scoped the check to the tooltip. Committed in `1d273914`.

---

**Total deviations:** 3 auto-fixed (2 bug, 1 blocking). **Impact on plan:** the first one changes when true-pixel drawing is active (only with `showProfit`); flagged for the orchestrator so plan 10-11 and the UI review know. No scope creep.

## Verification results

- `npm --prefix web run test -- --run src/components/data/IncomeExpenseChart.test.tsx`: 52 passed. The data folder plus `no-long-dash` run: `Test Files 4 passed (4), Tests 121 passed (121)`.
- `npm --prefix web run typecheck`: exit 0 (all three tsconfigs).
- `npm --prefix web run lint` (`--max-warnings 0`): exit 0, no output.
- `npm --prefix web run test -- --run src/test/no-long-dash.node.test.ts`: 1 passed.
- `node scripts/class-gate.mjs` (recipe classes compile against the theme): no findings.
- Coverage of `IncomeExpenseChart.tsx`: 97.95% statements, 95% branches, 100% functions, 100% lines.
- `gitleaks protect --staged`: no leaks on every commit.
- **Parity (`npm --prefix web run parity`)**, second run after the fix: `450 passed (22.5m)`, `parity: playwright failed with exit code 1`, 50 failed.
  - Chart "computed styles and boxes": 0 failures (the first run had 24 chart failures).
  - The 50 failures are 36 "computed styles and boxes" and 122 "pixels" error entries. The structural failures are all `confirm-delete-order` and `confirm-delete-order-typed` (overlays), which this plan never touched.
  - The pixel failures cover `chart-6-months`, `chart-12-months`, `data-table-*`, `status-badge-completed`, `kpi-loading` and `confirm-delete-order*`. The diff images show thin edge differences on every text glyph and line, also on the untouched data table. This looks like a local (Windows) rendering difference, not a layout change. **I could not prove it against the base commit:** a baseline `--grep @data` run waited 15 minutes for TheBETSLLC's dev server to leave the shared machine and then exited without running. I did not stop the other project's process. The plan's "parity passes" check is therefore NOT met on this machine; see below.

## Issues Encountered

- The parity run does not pass here (above). The plan's `<verify>` says "non-zero exit, or any failed look-equality scenario" fails the task. The chart's structural equality passes; the pixel snapshots fail here and also fail for untouched components, so I treat it as environmental, but this needs a CI run or a baseline run on a quiet machine to close. Recorded as coverage D5, human judgment.
- The shared-machine preflight kept reporting TheBETSLLC's server on a later run, so the baseline run did not start. Nothing of theirs was touched.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access. T-10-05 (strict CSP): no `style` attribute is written; the only custom property still goes through the React style object (`--tip-x`); clip ids come from `useId()`. T-10-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 10-11 can use `<IncomeExpenseChart data={...} showProfit labels={...} />` with `ChartDatum.profit` from the server. It must pass `showProfit` to get true-pixel width and label thinning.
- Open question for the owner or plan 10-11: whether the legend word may differ from the tooltip word for profit (see Decisions Made).
- Parity needs one clean run (CI or a quiet machine) to confirm the pixel snapshots are unaffected by this plan.

## Self-Check: PASSED

- Files found: `IncomeExpenseChart.tsx`, `IncomeExpenseChart.test.tsx`, `data.recipe.ts`, this summary.
- Commits found on the branch: `d0f1eb75`, `1d273914`, `0882555a`, `5905cb1d`, `7a670e11`, `5fc489e0`, `0eb5ac76`, `3675a269`.
- Acceptance greps: `showProfit` in the component (11), `chartProfitLineClasses` in the recipe (1), `useId` (2), `"4 3"` (1), `ResizeObserver` in the component, test names with "profit", "narrow" and "every other", `−₱` in the tests.
- The one plan check that did not pass here is the whole-suite parity exit code (see Issues Encountered).

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-06*

---
created: 2026-11-09T10:40:00-06:00
updated: 2026-11-09T10:40:00-06:00
phase: quick-261109-c4l
plan: 01
status: complete
commits: 3
plan_head_before: 7c2f0672edd662d428eb024351edc4d5df9bc794
plan_head_after: 96a5981f49fec5be45585a1df456881467815b49
requirements: [DASH-02, DASH-03, DASH-06, MONEY-02, MONEY-03, MONEY-04, MONEY-06]
actuals:
  tokens: 90000
  tasks: 3
  commits: 3
---

# Quick 261109-c4l: Phase 10 UI review findings fixed (UI-01 to UI-24)

*Created: 2026-11-09T10:40:00-06:00 · Updated: 2026-11-09T10:40:00-06:00*

One KPI column at 420 px and below, a wrapping shared window footer, a chart range line that follows the data on screen, 44 px tap areas on the strip buttons, a Transfer description while the figure loads, and a ledger that fits its card at 768 px. Every finding UI-01 to UI-24 has one recorded outcome.

## Commits

- `c0438e17` fix(web): one KPI column on small phones, wrapping window buttons and the chart range line (D-107)
- `d69ac35b` fix(web): money strip tap areas, Transfer reason while loading, and the ledger at 768 px (D-107)
- `96a5981f` docs(phase-10): UI-SPEC follows D-107 and D-108, and every UI review finding has an outcome

## Outcomes per finding

Fixed: UI-01, 02, 03, 07, 09, 12, 13, 14, 15, 16, 18, 20, 21, 23, 24. Closed as allowed: UI-11. Accepted by owner D-107: UI-06, 08, 10, 17, 22. Accepted by owner D-108 (spec updated): UI-04, 05, 19. Full table with evidence: `10-UI-REVIEW.md` → Outcomes (48 `| UI-` rows: 24 findings, 24 outcomes).

## Red then green

- Vitest red (before the fix): Task 1, 8 failed (KPI one column, `pt-2`, chart empty dim, footer wrap, D-107 ruling group x2, two range-switch tests). Task 2, 16 failed (statusId, tap tokens, four description states, label colour, spacing tokens, banner recipe, 20 px icon, eye title, loading region, 680 px floor).
- e2e red: `@dashboard` KPI fit failed on chromium and firefox ("figures wider than their card", 2 failed, 6 passed); the Manager sweep at 320 px failed with "the Cancel button sticks out past the window edge" for Hand Over and Remove Permanently; the tap-area test failed (`::before` height NaN) and the 768 px ledger test failed (frame scrolls 680 against 646).

## Results (quoted)

- Task 1 Vitest: 6 files, 231 passed. `@dashboard ` all five projects: 20 passed. "switches from the phone tab bar": 5 passed. "windows fit at 320 px": 5 passed. `@dialog-fit`: 47 passed, 31 skipped (exit 0, run alone).
- Task 2 Vitest: 35 files, 1287 passed. e2e "44px tap area|ledger fits its card": 10 passed on the first run; after a test rewrite, the tap tests passed again inside `@money ` (28 passed). `@money-sweep`: 45 passed. `@dashboard-sweep`: 40 passed.
- Full Vitest run: 324 files, 9035 passed, exit 0, no warning lines.
- `typecheck`, `lint` (`--max-warnings 0`) and `format:check` exit 0.
- Parity `@overlays`: 18 failed, all and only `confirm-delete-order` and `confirm-delete-order-typed` (computed styles and pixels: the Delete Order dialog's cascade list). These were already failing and are named in `10-04-SUMMARY.md` as not touched by that plan; no failure mentions `flex-wrap` or the footer. Every other overlay scenario passed.

## 768 px measurements (Chromium, 768 x 1024, frame 646 px)

| Table | Frame scroll width | Frame client width | Last column right edge | Frame right edge |
|---|---|---|---|---|
| Ledger (Manager, with Actions) | 646 | 646 | 743 | 743 |
| All Staff | 680 | 646 | 777 | 743 |
| Transfers | 680 | 646 | 777 | 743 |

Before the fix the ledger frame was 680 against 646. All Staff and Transfers were not changed (they keep the declared tablet frame scroll) and are parked as P10-BL-21.

## Deviations from Plan

**1. [Rule 3 - Blocking] Prettier drift in `web/e2e/auth.ts`** (found in Task 1). `format:check` failed on a committed line unrelated to this work, so the plan's "format check exit 0" could not pass. Ran Prettier on that one file (one call re-wrapped over three lines), in commit `c0438e17`.

**2. [Rule 1 - Test fix] Node tests cannot import recipes that pull in components.** `dashboard.recipe.node.test.ts` first imported the recipe and made `tsc -p tsconfig.node.json` fail (TS6142, `--jsx`). Both node tests now read the class list from the recipe source with a small `classesOf` helper.

**3. [Rule 1 - Test fix] Playwright page functions.** The e2e specs have no DOM typings, so the tap-area check uses a self-contained page function (like `reachableWithoutScrolling`) and the ledger reader returns an error instead of a non-null assertion (lint).

No other deviation. No package, server, database or `src/` (.NET) change. `docs/CSPS-UI-SPEC.md` not touched.

## Flakes and unattributed failures

- `@dialog-fit` failed 8 tests with `toHaveText` timeouts once, while a lint and a format run shared the machine. Re-run alone: 47 passed, 0 failed. Recorded as machine-load flake.
- `tsc` (v7) printed TS6142 for one run while an e2e build was running, then passed alone; the real cause was item 2 above.
- **`@money a Manager deletes a wrong transfer ... (D-29, D-35, D-48)` fails its focus check** ("focus is on the next row action, else the previous one") on 2 or 3 of the 5 projects, whichever run, alone and in the suite. It failed the same way with every source file of this task put back to the commit before it (`7c2f0672`), so this work did not cause it. Parked as P10-BL-21 (c).

## Known Stubs

None.

## Open for the owner (P10-BL-21)

(a) The My Money header Transfer has the same loading or failure gap, but the balance card shows on the Mine tab only. (b) All Staff and Transfers tables scroll 34 px at 768 px and cut the Actions column at the card edge. (c) The focus-after-delete browser test fails before this work.

## Threat Flags

None. No new endpoint, auth path or schema; the Transfer description points only at lines already on screen.

## Self-Check: PASSED

Commits `c0438e17`, `d69ac35b` and `96a5981f` are in `git log`. `git rev-list --count 7c2f0672..HEAD` is 3. Working tree clean except the SUMMARY, STATE and PLAN files the orchestrator commits.

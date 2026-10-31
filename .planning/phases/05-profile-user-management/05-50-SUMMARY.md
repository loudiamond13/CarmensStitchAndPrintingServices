---
phase: 05-profile-user-management
plan: 50
subsystem: ui
tags: [gap-closure, wr-20, touch-target, tailwind, e2e, tdd, tracer]
created: "2026-10-19T03:58:00-05:00"
updated: "2026-10-19T03:58:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-VERIFICATION.md gap 5 (WR-20, non-row half); hitAreaClasses precedent (OQ-5)"
provides:
  - "targetAreaClasses: a shared invisible 44 x 44 px ::before tap area centred on a small icon control"
  - "The phone Open navigation button, the desktop Collapse sidebar button and the filter-chip Clear buttons answer a tap anywhere in a 44 px square"
  - "web/e2e/target-size.spec.ts (@target-size): hit-box probes and a drawn-box sweep of /admin/users at 390 and 1280 px"
affects: [05-51 row actions (reuses the probe helper), 05-VERIFICATION gap 5]

actuals:
  tokens: 4075
  tasks: 2
  commits: 4
plan_head_before: f6d542112900d13158f860e27ec519e2d1390016
plan_head_after: e600c7d4d24299e37c0d60fa0b3645ed63db17f7

tech-stack:
  added: []
  patterns:
    - "A tap area is composed at the use site with clsx(controlClasses, targetAreaClasses) from @/components/actions; the recipe files that carry the App. B and App. E transcription stay untouched"
    - "E2E tap-area probes are page-script strings (the e2e program has no DOM lib): elementFromPoint at the centre and at +/-21 px on each axis and diagonal"

key-files:
  created:
    - web/e2e/target-size.spec.ts
  modified:
    - web/src/components/actions/button.recipe.ts
    - web/src/components/actions/button.recipe.node.test.ts
    - web/src/components/actions/index.ts
    - web/src/components/navigation/Topbar.tsx
    - web/src/components/navigation/Sidebar.tsx
    - web/src/components/lists/FilterBar.tsx

key-decisions:
  - "The three controls keep their drawn boxes (36, 36 and 22 px, D-31 O-8); the larger area is a ::before box only, and the E2E asserts both the hit area and the unchanged drawn size"
  - "The drawn-box sweep insets each corner by 2 px plus 30 percent of the corner radius, so a rounded or circular control is not asked to answer outside its curve"
  - "Probes address controls by aria-label selector in a page script, because the e2e tsconfig has no DOM lib and a string passed to Locator.evaluate is not called as a function"

requirements-completed: [USER-01]

coverage:
  - id: D1
    description: "The phone Open navigation button answers a tap anywhere in a 44 x 44 px square and is still drawn 36 x 36"
    requirement: "USER-01"
    verification:
      - kind: e2e
        ref: "web/e2e/target-size.spec.ts#@target-size on a phone the Open navigation button answers a tap anywhere in a 44 px square and is still drawn 36 px (chromium)"
        status: pass
      - kind: unit
        ref: "web/src/components/actions/button.recipe.node.test.ts#targetAreaClasses (WR-20)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Collapse sidebar button (36 px) and each filter-chip Clear button (22 px) answer a tap anywhere in a 44 x 44 px square, drawn size unchanged"
    requirement: "USER-01"
    verification:
      - kind: e2e
        ref: "web/e2e/target-size.spec.ts#@target-size on a desktop the Collapse sidebar button ... and #@target-size at 390 px / 1280 px each filter chip clear ... (chromium)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No tap area covers another control's drawn box on /admin/users at 390 and 1280 px"
    requirement: "USER-01"
    verification:
      - kind: e2e
        ref: "web/e2e/target-size.spec.ts#@target-size at 390 px / 1280 px no tap area covers another control's drawn box on the Users page (chromium)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-19
---

# Phase 5 Plan 50: Tap areas for the small icon controls Summary

**An invisible 44 x 44 px `::before` tap area (`targetAreaClasses`) on the phone menu button, the sidebar toggle and the filter-chip clear, with the drawn 36, 36 and 22 px boxes unchanged and a browser test that hit-tests what a tap reaches.**

## Performance

- **Duration:** 15 min
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files:** 1 created, 6 modified
- **Commits:** 4 (two RED, two GREEN)

## Accomplishments

- `targetAreaClasses` sits beside `hitAreaClasses` in `button.recipe.ts` and is exported from `@/components/actions`. Its node test checks the exact token list, the compiled 44 px square centred on the element, and that on the element itself only `.relative` is added.
- `Topbar` (Open navigation), `Sidebar` (Collapse sidebar) and `FilterBar`'s `FilterChip` (Clear filter) compose it with `clsx`. `navigation.recipe.ts` and `lists.recipe.ts` were not edited.
- `@target-size` E2E: each control is hit-tested at its centre and 21 px out on both axes and diagonals, and its `getBoundingClientRect()` is asserted at 36, 36 and 22 px. A sweep of every visible button, link, input and select on `/admin/users` (two chips showing) at 390 x 844 and 1280 x 900 checks the centre and four inset corners of each drawn box.
- The sweep passed on the old code and still passes, so no new tap area steals a tap from a neighbour. No ancestor clipped an area, so no shape or placement change was needed.

## Task Commits

1. Task 1 RED: `9a77fe2` test(05-50): the phone menu button's tap area is 36 px (RED, WR-20)
2. Task 1 GREEN: `a47dd32` fix(05-50): a 44 px tap area for the phone menu button (WR-20)
3. Task 2 RED: `108a77c` test(05-50): the sidebar toggle and chip clear are under 44 px (RED, WR-20)
4. Task 2 GREEN: `e600c7d` fix(05-50): 44 px tap areas for the sidebar toggle and chip clear (WR-20)

## Verification

- `npm --prefix web run test -- --run src/components/actions src/components/navigation`: 8 files, 266 tests pass.
- `npm --prefix web run e2e -- --grep @target-size --project chromium`: 6 passed (after RED: 1 failed for Task 1, 3 failed for Task 2).
- `npm --prefix web run e2e -- --grep "@target-size|@users|@shell" --project chromium`: 56 passed.
- `npm --prefix web run verify`: exit 0 (lint, types, unit tests with coverage, class gate, bundle budgets, licence and notices gates). Bundle sizes: public JS 122.55 KB, admin JS 206.96 KB, CSS 14.64 KB.
- Tracer gate: the Task 1 verify was re-run end to end before expansion and passed.
- No change to `web/package.json` or `web/package-lock.json`; no em or en dash in the touched files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Probe helper takes a selector, not a Locator**
- **Found during:** Task 1 (RED run)
- **Issue:** The first draft passed a string page script to `Locator.evaluate`; Playwright evaluates a string as an expression and does not call it, so the probe returned `undefined`. A typed function would need DOM types, which the e2e tsconfig does not include.
- **Fix:** The helper builds a page-script IIFE from a CSS selector and runs it with `page.evaluate`, like the other specs. The helper is the shared one Task 2 and 05-51 reuse.
- **Files modified:** web/e2e/target-size.spec.ts
- **Commit:** 9a77fe2

**Total deviations:** 1 auto-fixed (1 blocking). **Impact:** none on scope or look.

## Issues Encountered

None. The phase gate still runs `@target-size` in all five projects; only chromium was run here, as the plan's verify commands specify.

## Known Stubs

None.

## Threat Flags

None. No new network, auth or file surface; T-05-122 (a tap area covering a neighbour) is covered by the drawn-box sweep, T-05-123 (CSP) by Tailwind utilities only plus the guard's CSP and console listeners, T-05-SC by no dependency change.

## Next Phase Readiness

Ready for 05-51 (row actions): `target-size.spec.ts` already holds the probe and sweep helpers it needs.

## Self-Check: PASSED

- web/e2e/target-size.spec.ts: found
- Commits 9a77fe2, a47dd32, 108a77c, e600c7d: found on the branch
- Acceptance criteria: `targetAreaClasses` appears in button.recipe.ts, index.ts, Topbar.tsx, Sidebar.tsx and FilterBar.tsx; `@target-size` appears in the spec; both verify commands exit 0

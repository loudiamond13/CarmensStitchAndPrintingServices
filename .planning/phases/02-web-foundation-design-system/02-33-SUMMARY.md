---
phase: 02-web-foundation-design-system
plan: 33
subsystem: web-build
tags: [vite, rolldown, bundle-budget, gzip, perf-01, d-20, d-33, verify]
created: "2026-10-09T03:23:00-05:00"
updated: "2026-10-09T03:23:00-05:00"

requires:
  - phase: 02-06
    provides: verify STEPS with the license and notices gates (new steps pinned by verify.test.ts)
  - phase: 02-31
    provides: the admin route chunk (src/app/admin/AdminLayout.tsx) behind __DEV_ROUTES__
  - phase: 02-32
    provides: drawer and user menu in the admin chunk; production entry ~122 KB gz
  - phase: 02-14
    provides: the main + parity two-entry topology of the dev-route builds
  - phase: 02-37
    provides: the committed web/.env.budget dev-route build mode
provides:
  - "web/scripts/budget.ts: BUDGETS, BARREL_SPLIT_TRIGGER, PUBLIC_ROUTE, ADMIN_ROUTE, routeInitialSize, evaluateBudgets (pure)"
  - "web/scripts/vite-budget-plugin.ts: budgetPlugin({ devRoutes, reportDir? }) failing the build through this.error with the size table"
  - "Production build fails on admin/src-dev/web-visual code, a second entry, more or fewer than one CSS asset, and .reference-* output in wwwroot"
  - "npm run verify runs build:budget right after build"
  - "artifacts/budget/budget.json + budget.<mode>.json (git-ignored)"
  - "docs/web/budgets.md"
affects: [02-34, 02-35, 02-36, phase-03-ci, phase-04-barrel-split, every-later-web-plan]

actuals:
  tokens: 14300
  tasks: 2
  commits: 4
plan_head_before: 7eb79aa635f562aa34902660c9a844fb6b305f04
plan_head_after: ba0ee1e3da5a053a37607c928405a6a1b45fe80c

tech-stack:
  added: []
  patterns:
    - "Build-gate plugin = pure evaluator over a normalized graph (web-root-relative posix ids) + a thin Vite plugin that builds the graph, writes a JSON report and calls this.error"
    - "A route module is found by facade first, then by the chunk that contains it (dev-route builds put statically imported route modules in shared chunks)"
    - "Only modules with renderedLength > 0 count as shipped (tree-shaken dev modules stay listed in moduleIds)"

key-files:
  created:
    - web/scripts/budget.ts
    - web/scripts/budget.test.ts
    - web/scripts/vite-budget-plugin.ts
    - web/scripts/vite-budget-plugin.test.ts
    - docs/web/budgets.md
  modified:
    - web/vite.config.ts
    - web/scripts/verify.mjs
    - web/scripts/verify.test.ts
    - .planning/phases/02-web-foundation-design-system/deferred-items.md

key-decisions:
  - "Public initial JS = index.html entry + PublicLayout + PublicPlaceholderPage chunks and their static-import closure; admin = entry + AdminLayout + UrlStateLayout + AdminPreviewPage (all three load on /admin), stricter than the layout alone"
  - "The 150 KB public limit is enforced in every build, dev-route builds included (plan truth 1: every vite build); the 135 KB barrel-split note is info only and only in dev-route builds"
  - "verify STEPS follow the plan's explicit list (build:budget right after build, before license:check/notices:check), not the older 02-06 hint of appending after notices:check"
  - "Rolldown checks.bundlerTimings is off in vite.config.ts: the dev-route builds printed a PLUGIN_TIMINGS warning (React Compiler + Tailwind time, not a defect) that the new verify step would surface"
  - "budget.json is the latest build; budget.<mode>.json keeps each mode, because verify builds two modes and e2e/parity builds write too"

patterns-established:
  - "New build gate: put the rules in a pure scripts/*.ts module tested on synthetic graphs, and keep the plugin to graph building + reporting"

requirements-completed: [PERF-01]

coverage:
  - id: D1
    description: "Production build measures public initial JS and CSS (gzip -9, 1 KB = 1000 B) and fails through this.error with the size table over 150 KB / 35 KB; exactly-at-limit passes"
    requirement: PERF-01
    verification:
      - kind: unit
        ref: "web/scripts/budget.test.ts#evaluateBudgets: public JS and CSS (production build)"
        status: pass
      - kind: unit
        ref: "web/scripts/vite-budget-plugin.test.ts#fails the build through this.error with the size table when public JS is over its limit"
        status: pass
      - kind: other
        ref: "npm --prefix web run build (public JS 129.94 KB, CSS 12.90 KB)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Budget-mode build measures admin initial JS (<= 250 KB) and the admin-included public number with the 135 KB note"
    requirement: PERF-01
    verification:
      - kind: unit
        ref: "web/scripts/budget.test.ts#evaluateBudgets: admin topology (budget-mode build with dev routes)"
        status: pass
      - kind: unit
        ref: "web/scripts/budget.test.ts#evaluateBudgets: the Phase 4 barrel-split trigger (research Flag 4)"
        status: pass
      - kind: other
        ref: "npm --prefix web run build:budget (public 149.34 KB, admin 154.48 KB, CSS 12.90 KB, note printed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fail-closed build-shape rules: missing entry or route module, not exactly one CSS asset, admin/src-dev/web-visual code or a second entry in production, .reference-* output or folders in wwwroot"
    requirement: PERF-01
    verification:
      - kind: unit
        ref: "web/scripts/budget.test.ts#evaluateBudgets: no dev code in production (D-20, CWE-489)"
        status: pass
      - kind: unit
        ref: "web/scripts/vite-budget-plugin.test.ts#budgetPlugin: the admin topology and the web root (D-20)"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run verify runs build:budget after build; the full gate passes warning-free"
    requirement: PERF-01
    verification:
      - kind: unit
        ref: "web/scripts/verify.test.ts#runs typecheck, lint, format:check, test:coverage, build, build:budget, license:check and notices:check in that order"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (exit 0; 95 files, 2313 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/web/budgets.md explains the limits, the measurement, the rules, the 135 KB trigger and what to do when over"
    verification: []
    human_judgment: true
    rationale: "Documentation clarity for the owner is a reading judgment no test asserts"

duration: 19min
completed: 2026-10-09
status: complete
---

# Phase 2 Plan 33: Build-enforced bundle budgets Summary

**Every Vite build now measures public JS, admin JS and CSS at gzip level 9 and fails with a size table over 150/250/35 KB. The same Rolldown plugin also fails a production build that ships admin, dev or parity code, has more or fewer than one CSS file, or leaves parity reference output in wwwroot. `npm run verify` checks both build topologies.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-09T08:02:22Z
- **Completed:** 2026-10-09T08:21:38Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- **Pure budget rules** (`web/scripts/budget.ts`):
  - `BUDGETS` = 150_000 / 250_000 / 35_000 bytes.
  - `routeInitialSize` follows static imports and counts shared chunks once.
  - `evaluateBudgets` returns errors, notes and a readable table.
- **Rolldown plugin** (`web/scripts/vite-budget-plugin.ts`):
  - Runs as a `generateBundle` hook (order `post`) and measures the shipped bytes.
  - Writes `artifacts/budget/budget.json` and `budget.<mode>.json`, even when the build fails.
  - Fails through `this.error` with the table.
  - Its `writeBundle` check fails when the production web root holds `.reference-dist` or `.reference-src`.
- **Wiring:** `budgetPlugin({ devRoutes })` in `web/vite.config.ts` (SPEC-DEVIATION: PERF-01), and `build:budget` in verify.
- **Measured** (gzip -9, 1 KB = 1000 B):

| Build | Public JS | Admin JS | CSS |
|---|---|---|---|
| Production | 129.94 KB | — | 12.90 KB |
| Budget (admin + parity page) | 149.34 KB | 154.48 KB | 12.90 KB |

- `docs/web/budgets.md`: the operator guide.

## Task Commits

1. **Task 1 (tracer): public JS and CSS budgets in the production build**
   - `900b4ec` test(02-33): add failing tests for the public and CSS bundle budgets (RED_EVIDENCE_OK: 27 fail on assertions)
   - `fade222` feat(02-33): fail the build when public JS or CSS passes its budget
   - Tracer gate: re-ran `<verify>` (30/30 unit, `npm run build` passes with the table), then expanded.
2. **Task 2: admin topology, no-dev-code and one-CSS assertions, verify step**
   - `3edd3d1` test(02-33): add failing tests for the admin topology, dev-code and verify rules (RED_EVIDENCE_OK: 11 fail on assertions)
   - `ba0ee1e` feat(02-33): measure the admin topology and block dev code in every verify

No REFACTOR commits were needed.

## Files Created/Modified

- `web/scripts/budget.ts`: pure rules, limits, route module lists, table.
- `web/scripts/budget.test.ts`: 33 cases on synthetic graphs.
- `web/scripts/vite-budget-plugin.ts`: bundle → graph (web-root-relative ids, rendered modules only), report files, `this.error`, web-root check.
- `web/scripts/vite-budget-plugin.test.ts`: 12 cases, including the vite.config registration per mode.
- `web/vite.config.ts`: registers the budget plugin; `rolldownOptions` restructured to hold `checks.bundlerTimings: false` plus the dev-route inputs.
- `web/scripts/verify.mjs` and `verify.test.ts`: the `build:budget` step.
- `docs/web/budgets.md`: the guide.
- `.planning/phases/02-web-foundation-design-system/deferred-items.md`: the headroom risk below.

## Decisions Made

- **Admin initial JS** counts all three modules `/admin` loads first: AdminLayout, UrlStateLayout and AdminPreviewPage, not only the layout the plan names. This is stricter and matches what the browser downloads.
- **The 150 KB public limit applies to every build**, dev-route builds included, following plan truth 1 ("Every `vite build` ... fails ... when any limit is exceeded"). The 135 KB barrel-split note goes through Vite's info logger, not as a warning.
- **The verify order follows the plan's explicit `STEPS` list:** `build:budget` right after `build`. 02-06's earlier hint was to append new steps after `notices:check`.
- **Report files:** `budget.json` holds the latest build, and `budget.<mode>.json` holds each mode, because verify builds two modes and the e2e and parity builds also write.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tree-shaken dev modules counted as shipped**
- **Found during:** Task 1, first real production build.
- **Issue:** Rolldown keeps `src/app/admin/routes.tsx` in the entry chunk's `moduleIds` even though `__DEV_ROUTES__` is a literal false and the module renders 0 bytes. The no-admin rule therefore failed a clean production build.
- **Fix:** only modules with `renderedLength > 0` count. A test was added for both cases (rendered 0 passes, rendered 120 fails).
- **Files modified:** web/scripts/vite-budget-plugin.ts, web/scripts/vite-budget-plugin.test.ts.
- **Committed in:** fade222.

**2. [Rule 1 - Bug] Route modules not found in the dev-route builds**
- **Found during:** Task 1, first `build:budget`.
- **Issue:** the parity entry imports PublicPlaceholderPage, AdminLayout and AdminPreviewPage statically. Their code therefore sits in shared chunks with no facade, and the facade-only lookup failed closed.
- **Fix:** the lookup tries the facade first, then the chunk that contains the module, which is the chunk the router's dynamic import loads. A test was added first (it failed, then passed).
- **Files modified:** web/scripts/budget.ts, web/scripts/budget.test.ts.
- **Committed in:** fade222.

**3. [Rule 2 - Zero-warning rule] PLUGIN_TIMINGS warning in the dev-route builds**
- **Found during:** Task 2, full verify.
- **Issue:** Rolldown printed a `[PLUGIN_TIMINGS]` warning on every budget-mode build, about the React Compiler (babel) and Tailwind taking most of the build time. The warning was already there before this plan (confirmed with the budget plugin removed), and the new verify step would surface it in the gate.
- **Fix:** `build.rolldownOptions.checks.bundlerTimings: false` in vite.config.ts, marked SPEC-DEVIATION with the reason. It reports speed, not a defect, and nothing in the project can act on it.
- **Files modified:** web/vite.config.ts.
- **Committed in:** ba0ee1e.

**4. [Rule 1 - Test data] Note test used too little random text**
- **Found during:** Task 2 GREEN.
- **Issue:** random base64 gzips to about 3/4 of its length, so 140,000 characters stayed under 135 KB.
- **Fix:** the test uses 185,000 characters.
- **Committed in:** ba0ee1e.

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 zero-warning fix).
**Impact on plan:** every fix was needed for the gate to measure the real build correctly. No limit was changed and no package was added.

## Issues Encountered

- **The dev-route builds have little headroom on public JS.** They measure 149.34 KB against the 150 KB limit. The same build without the parity page measures 137.96 KB. The 135 KB Phase 4 trigger has already fired. If a later plan pushes the number over 150 KB, `build:budget`, `npm run e2e` and `npm run parity` will fail. Never raise the limit. Either split the barrels now or stop measuring the parity page's topology; that choice is for the planner or owner. Logged in deferred-items.md.

## TDD Gate Compliance

- Task 1: RED `900b4ec` → GREEN `fade222`.
- Task 2: RED `3edd3d1` → GREEN `ba0ee1e`.
- Every RED record (two test files for Task 1, three for Task 2) was verified `RED_EVIDENCE_OK` by `gsd-tools check tdd-red-evidence`.

## Verification

- `npm --prefix web run test -- --run scripts/budget.test.ts scripts/vite-budget-plugin.test.ts scripts/verify.test.ts`: 50/50 pass.
- `npm --prefix web run build`: passes (public 129.94 KB, CSS 12.90 KB).
- `npm --prefix web run build:budget`: passes (public 149.34 KB, admin 154.48 KB, CSS 12.90 KB, note printed). After it, budget.json holds `publicJs` 149345, `adminJs` 154478 and `css` 12904, all under their limits.
- `npm --prefix web run verify`: exit 0, no warnings. 95 test files and 2313 tests passed. Coverage: statements 98.05, branches 96.12, functions 99.8, lines 99.81. License gate passed; notices up to date.
- Acceptance greps:
  - `grep -c "150_000" web/scripts/budget.ts` = 1.
  - `grep -c "35_000" web/scripts/budget.ts` = 1.
  - `grep -c "build:budget" web/scripts/verify.mjs` = 1.
  - `git check-ignore artifacts/budget/budget.json` prints the path.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **02-34 (showcase):** run `build:budget` after adding the showcase. Public JS in the dev-route topology has 0.66 KB of headroom (see Issues).
- **02-35 / 02-36:** `npm run verify` now builds both modes, which adds about 3 s.
- **Phase 3 CI:** run `npm --prefix web run verify` (it includes `build:budget`) and upload nothing from `artifacts/budget/`, which is git-ignored.
- **Phase 4:**
  - When the admin routes join the production build, the production public number becomes the admin-included topology.
  - Split the `src/ui/*/index.ts` barrels per research Flag 4; the 135 KB trigger has fired.
  - Removing `src/app/admin/` from `DEV_ONLY_MODULE_PREFIXES` in budget.ts is part of that phase's work.

## Self-Check: PASSED

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-09*

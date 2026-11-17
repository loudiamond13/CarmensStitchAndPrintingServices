---
phase: 12-consent-analytics-legal
plan: 32
subsystem: web-performance
tags: [rolldown, codeSplitting, bundle-budget, vite, vitest, playwright]
created: "2026-11-17T04:40:00-06:00"
updated: "2026-11-17T04:40:00-06:00"
status: complete

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-09 consent store split and 12-11 Privacy Policy text, which pushed Privacy over 150 KB; 12-31 entry recovery"
provides:
  - "One $initial entry chunk group in the production, e2e and budget builds (D-42): same modules, fewer files, about 3.5 KB off every public row"
  - "Legal rows that count legalLoaders.ts, and a build that fails when that chunk is missing"
  - "Per-route headroom table and reserve options R1 to R3 in docs/web/budgets.md"
affects: [12-13, 12-15]

actuals:
  tokens: 5900
  tasks: 3
  commits: 6
plan_head_before: 31420f7c25afcb1e38cfb6374eba9e3f4b3ecf24
plan_head_after: ee5dec1a779154725b50f47fce16bee23259febc
commits: 6

tech-stack:
  added: []
  patterns:
    - "build.rolldownOptions.output.codeSplitting with one group tagged $initial, only where settings.parityEntry is false"
    - "A budget row lists every chunk the route downloads before its first view (LEGAL_LOADERS)"

key-files:
  created: []
  modified:
    - web/vite.config.ts
    - web/src/test/build-config.node.test.ts
    - web/scripts/budget.ts
    - web/scripts/budget.test.ts
    - web/scripts/vite-budget-plugin.test.ts
    - docs/web/budgets.md

key-decisions:
  - "D-42 applied: BUDGETS.publicJs stays 150_000, no file exception, no page content changed; packaging only"
  - "The parity build keeps the default chunking, because the $initial tag would merge parity.html into the visitor entry"
  - "Reserve options R1 to R3 were not needed and not implemented"

requirements-completed: [LEGAL-01, ANL-01]

metrics:
  duration: about 95 min
  completed: 2026-11-17
---

# Phase 12 Plan 32: One entry chunk and honest legal figures Summary

*Created: 2026-11-17T04:40:00-06:00 · Updated: 2026-11-17T04:40:00-06:00*

**Every public page now downloads the same modules in 7 fewer files, and every public row is at or under 147.12 KB in both builds (target 148.50 KB, limit 150 KB), with the four legal rows now counting the loader chunk they always downloaded.**

## What was done

- **Task 1 (tracer):** one Rolldown `codeSplitting` group `{ name: 'index', tags: ['$initial'] }` in `web/vite.config.ts`, added only when `settings.parityEntry` is false. The entry chunk now holds the whole static import chain. The parity and development configs have no `codeSplitting`. RED `1ce08f94` (3 failed, 32 passed), GREEN `9705cf4b`.
- **Task 2:** `LEGAL_LOADERS = 'src/modules/public/legalLoaders.ts'` is exported from `web/scripts/budget.ts` and sits between the layout and the page in the four legal rows. A build without that chunk fails with "the route module ... has no chunk" (once). RED `e48c6d69` (7 failed, 100 passed), GREEN `927e8922`.
- **Task 3:** `docs/web/budgets.md` has the new section "Entry chunk merge and headroom (Phase 12, plan 12-32, D-42)" with both builds' tables, the headroom table, R1 to R3, and the 500 KB raw limit to watch. The legal gap sentence is replaced, the "How initial JS is worked out" line and the pointer from the 12-31 section are added. Created is kept, Updated changed. Commit `1cfcd00a`.
- A formatting commit `ee5dec1a` fixed two Prettier findings in the two test files.

## Figures (gzip -9, 1 KB = 1000 B, from the numbers files)

The plan base was copied to the session scratchpad before any code change. It reproduced the planner's figures to the byte (budget Privacy 150,042 B, production Privacy 149,992 B).

`npm run build` (production), files before to after:

| Row | Before | After | Files |
|---|---|---|---|
| Home | 149.14 | 145.55 | 31 to 24 |
| Products | 145.82 | 142.25 | 30 to 23 |
| Gallery | 147.13 | 143.60 | 29 to 22 |
| Contact | 149.09 | 145.62 | 32 to 25 |
| Privacy | 149.99 | 147.09 | 30 to 24 |
| Cookies | 147.92 | 145.03 | 30 to 24 |
| Terms | 149.10 | 146.20 | 30 to 24 |
| Accessibility | 148.66 | 145.76 | 30 to 24 |
| Not found | 141.79 | 138.32 | 27 to 20 |
| Admin JS | 221.10 | 217.47 | |
| CSS | 20.39 | 20.39 | |

`npm run build:budget`, files before to after:

| Row | Before | After | Files |
|---|---|---|---|
| Home | 149.19 | 145.57 | 31 to 24 |
| Products | 145.88 | 142.28 | 30 to 23 |
| Gallery | 147.18 | 143.62 | 29 to 22 |
| Contact | 149.15 | 145.64 | 32 to 25 |
| Privacy | 150.04 (over) | 147.11 | 30 to 24 |
| Cookies | 147.97 | 145.04 | 30 to 24 |
| Terms | 149.15 | 146.22 | 30 to 24 |
| Accessibility | 148.71 | 145.78 | 30 to 24 |
| Not found | 141.84 | 138.34 | 27 to 20 |
| Admin JS | 223.12 | 219.44 | |
| CSS | 20.39 | 20.39 | |

The legal "after" figures include the loader chunk (0.54 to 0.55 KB). With the loader counted at the base the legal rows were Privacy 150.61 / 150.67 KB, Cookies 148.54 / 148.60, Terms 149.72 / 149.78, Accessibility 149.28 / 149.33 (production / budget). Those "loader counted" figures are the base figure plus the loader size the planner measured at the base (621 B and 624 B); the base builds did not list the loader.

## Headroom (larger of the two builds, the budget build)

| Page | Size | Room to 150 KB | Room to 148.50 KB |
|---|---|---|---|
| Home | 145.57 | 4.43 | 2.93 |
| Products | 142.28 | 7.72 | 6.22 |
| Gallery | 143.62 | 6.38 | 4.88 |
| Contact | 145.64 | 4.36 | 2.86 |
| Privacy | 147.11 | 2.89 | 1.39 |
| Cookies | 145.04 | 4.96 | 3.46 |
| Terms | 146.22 | 3.78 | 2.28 |
| Accessibility | 145.78 | 4.22 | 2.72 |
| Not found | 138.34 | 11.66 | 10.16 |

## Verification (real output)

- `npm run test -- --run src/test/build-config.node.test.ts`: `Tests 35 passed (35)`.
- `npm run test -- --run src/test/build-output.node.test.ts`: `Tests 29 passed (29)` (PERF-02, D-20, D-33 rules hold on the production output).
- `npm run test -- --run scripts/budget.test.ts scripts/vite-budget-plugin.test.ts`: `Tests 129 passed (129)`.
- `npm run build` and `npm run build:budget`: exit 0, zero warnings (checked with grep on the logs), no chunk-size warning. Entry raw size 366.74 KB (production) and 366.88 KB (budget), under Vite's 500 KB warning.
- Numbers gates from the plan: nine rows at or under 148,500 B and admin at or under 250,000 B (exit 0); Home loads fewer than 31 files (exit 0); the four legal rows list `assets/legalLoaders-` in both files (exit 0). Admin JS is below its base in both builds (217,466 vs 221,098 and 219,437 vs 223,122). `grep -c "publicJs: 150_000" web/scripts/budget.ts` is 1.
- `npm run lint` (max-warnings 0), `npm run typecheck`, `npm run format:check`: clean after the style commit. `notices:check`: up to date.
- E2E `npm --prefix web run e2e -- --grep "@admin|@auth|@shell|@public"` after the preflight reported the ports free: run 1 gave 414 passed, 5 failed. Four were the known Firefox font-abort console error (`downloadable font: download failed ... archivo-latin-ext ... status=2152398850`) and one was a WebKit `/admin/components` timeout (the heavy dev page, known from 12-31). Rerun of those five: 23 passed, 2 failed (both Firefox font abort again). Rerun of those two alone on Firefox: 2 passed. No failure was caused by this plan; the same flake appeared at the plan 12-31 base.
- `npm --prefix web run verify`: typecheck, lint, format:check pass. `test:coverage`: `Test Files 1 failed | 408 passed (409)`, `Tests 1 failed | 10991 passed (10992)`. The one failure is `scripts/license-policy.test.ts` ("No packages found in this path"), the known worktree-only failure (the license checker finds no packages under the worktree path). `license:check` fails for the same reason here. `build`, `build:budget` and `notices:check` were run on their own and pass. This needs one more full verify run in the main checkout after the merge, where the license test can find the packages.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The budget plugin's own test fixture had no loader chunk**
- **Found during:** Task 2 GREEN
- **Issue:** `web/scripts/vite-budget-plugin.test.ts` (listed in the plan's verify command, not in `files_modified`) builds its own public chunk graph. Once the legal rows needed `legalLoaders.ts`, 7 of its tests failed with "has no chunk".
- **Fix:** added a `legalLoaders` lazy chunk to its `publicChunks()` helper.
- **Files modified:** `web/scripts/vite-budget-plugin.test.ts`
- **Commit:** `927e8922`

**2. [Rule 1 - Bug] Prettier format findings in two test files**
- **Found during:** Task 3 verify (`format:check`)
- **Fix:** ran Prettier on `budget.test.ts` (quote style on two constants) and `vite-budget-plugin.test.ts` (a missing space).
- **Commit:** `ee5dec1a`

The 7 failing counts in the Task 2 RED run came from the new expectations; a first draft used the not-yet-exported constant in the test graph and failed on `undefined`, so the graph uses a string literal and the expectations use `LEGAL_LOADERS`.

## Owner decision

None needed. Every public row in both numbers files is at or under 148.50 KB (tightest: Privacy 147.11 KB), so the fallback to R1 to R3 did not trigger. Nothing is parked in the backlog.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access. The tag captures only modules the entry already imports statically (T-12-83); the PERF-02, D-20 and D-33 rules pass in both builds.

## Notes for plans 12-13 and 12-15

- The room on the tightest row (Privacy) is 1.39 KB to 148.50 KB and 2.89 KB to the 150 KB limit; Home and Contact have about 4.4 KB to the limit.
- Plans 12-13 (Cookie Settings window, footer legal row) and 12-15 (page view beacon) both add to the public first download and share that room.
- A new static import into the entry chain or the public layout is counted at once. A Cookie Settings window or a beacon that is not needed for the first view should load lazily (a dynamic `import()`), which keeps it out of the count.
- The entry is one file of 366.88 KB raw; Vite warns above 500 KB, which would break zero warnings.

## Self-Check: PASSED

- Commits `1ce08f94`, `9705cf4b`, `e48c6d69`, `927e8922`, `1cfcd00a`, `ee5dec1a` exist on this branch.
- Files changed exist: `web/vite.config.ts`, `web/src/test/build-config.node.test.ts`, `web/scripts/budget.ts`, `web/scripts/budget.test.ts`, `web/scripts/vite-budget-plugin.test.ts`, `docs/web/budgets.md`.
- STATE.md and ROADMAP.md were not modified.

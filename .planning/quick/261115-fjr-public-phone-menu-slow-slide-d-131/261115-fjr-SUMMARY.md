---
created: 2026-11-15T12:12:03-06:00
updated: 2026-11-15T12:56:08-06:00
phase: quick-261115-fjr
plan: 01
subsystem: web public header
tags: [D-131, D-132, motion, SiteHeader, parity]
status: complete
requires: [05 D-34 drawer motion pattern]
provides: [D-131 phone menu motion, D-132 SiteHeader close logic, rulings mirror]
affects: [public JS budget]
key-files:
  modified:
    - web/src/ui/app.css
    - web/src/components/navigation/navigation.recipe.ts
    - web/src/components/navigation/SiteHeader.tsx
    - web/src/components/navigation/SiteHeader.test.tsx
    - web/visual/reference/rulings.css
    - web/visual/reference/rulings.test.ts
    - .planning/phases/11-public-site-content-management/11-CONTEXT.md
    - .planning/phases/02-web-foundation-design-system/02-UI-SPEC.md
    - .planning/phases/11-public-site-content-management/11-UI-SPEC.md
  unchanged-net:
    - web/src/hooks/usePresence.ts (changed in f4f8207a, put back in 1e4a58c8; equal to main)
    - web/src/hooks/usePresence.test.ts (same)
decisions:
  - "D-132 (owner, 2026-11-15): SiteHeader writes the close itself (own 400 ms fallback), so the shared usePresence hook stays as it was and the public JS stays under 150 KB"
  - "SiteHeader trims: the burger icon class is a ternary, and the no-animation check is one includes() call, so the admin-included budget build fits"
metrics:
  completed: 2026-11-15
actuals:
  tokens: 7600
  tasks: 3
  commits: 5
plan_head_before: ec3b1b39d61e83f4f87881e2da75018f3be34958
plan_head_after: d882354cf2e03653edd7ac99f75e9042a8738557
---

# Quick 261115-fjr: Public phone menu slow slide (D-131, D-132) Summary

On phones the public menu now slides down and fades in over 0.45 s, its links and button rise in 60 ms apart, and the burger turns into the X. On close it slides back up over 0.3 s and stays mounted and inert until its own exit ends, with a 400 ms fallback. SiteHeader runs this close itself (D-132), so the public JS stays under 150 KB.

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 | f1fd421d | feat(261115-fjr): slide the public phone menu open and closed (D-131) |
| 2 | f4f8207a | feat(261115-fjr): stagger the phone menu links and turn the burger icon (D-131) |
| 3 | b337d4d4 | test(261115-fjr): state the phone menu motion in the parity reference (D-131) |
| D-132 | 1e4a58c8 | fix(261115-fjr): close the phone menu inside SiteHeader to keep the public JS budget (D-132) |
| 3 docs | d882354c | docs(261115-fjr): record D-131 and D-132 and the phone menu motion in the UI contracts |

gitleaks reported `no leaks found` before every commit. The staged-diff scan found no paths, emails, server or database names. Files were staged by path.

## Gate results (quoted)

**Task 1:** RED `Tests  4 failed | 18 passed (22)`. GREEN `Tests  59 passed (59)`, `CLASSGATE=0`, `TC=0`, `LINT=0`, and no inline style.

**Task 2:** RED `Tests  3 failed | 31 passed (34)`. GREEN `Test Files  8 passed (8)`, `Tests  283 passed (283)`; the class gate, typecheck and lint were clean.

**Task 3:** RED `× has a rule group whose comment starts with D-131` and `× D-131: the public phone menu slides in, ...`, `Tests  2 failed | 60 passed (62)`. GREEN `Tests  101 passed (101)`.

**D-132:**
- `usePresence.ts` and its test were put back first, so they equal main again.
- RED: the new SiteHeader test "leaves after the 400 ms fallback when its exit never reports an end" failed with the 300 ms shared timer: `AssertionError: expected false to be true`, `Tests  1 failed | 25 passed (26)`.
- GREEN: `Test Files  8 passed (8)`, `Tests  285 passed (285)` (navigation, hooks, PublicLayout). Then `ESLINT=0`, `TC=0`, `CLASSGATE=0`, and Prettier `All matched files use Prettier code style!`.
- A guard test, "closes at once when nothing animates (reduced motion)", passed from the start, as expected.

**Preflight (before each verify):** `5180 free`, `5115 free`, `7028 free`, `5199 free`, `Dev/test processes ... none`.

**Final full verify (`npm --prefix web run verify`, no time limit): `VERIFY=0`**
- typecheck passed. Lint `eslint . --max-warnings 0` passed. format:check `All matched files use Prettier code style!`.
- test:coverage `Test Files  393 passed (393)`, `Tests  10720 passed (10720)`, with `✓ src/test/no-long-dash.node.test.ts (1 test)` and `✓ src/test/source-layout.node.test.ts (7 tests)`. `All files | 95.5 | 90.12 | 97.77 | 98.1`.
- build (production):
  ```
  | public JS (home)     | 149.78 KB      | 150.00 KB | ok     |
  | public JS (contact)  | 149.78 KB      | 150.00 KB | ok     |
  | admin JS             | 219.31 KB      | 250.00 KB | ok     |
  | CSS                  | 20.12 KB       | 35.00 KB  | ok     |
  ```
- build:budget (admin routes included):
  ```
  | public JS (home)     | 149.98 KB      | 150.00 KB | ok     |
  | public JS (contact)  | 149.99 KB      | 150.00 KB | ok     |
  | admin JS             | 221.45 KB      | 250.00 KB | ok     |
  | CSS                  | 20.12 KB       | 35.00 KB  | ok     |
  Note: public JS in the admin-included topology is 149.99 KB, past the 135.00 KB trigger for the Phase 4 barrel split (research Flag 4).
  ```
  The pre-plan baseline of this build was 149.53 KB, so the barrel-split note was already showing before this task.

## Deviations from Plan

1. **[Rule 3] React Compiler lint and `presence.ref`.** In Task 1, `react-hooks/refs` gave 3 errors. I destructured the hook result to fix them. D-132 later removed the hook from SiteHeader.
2. **[Owner ruling D-132] The close logic sits inside SiteHeader, not in `usePresence`.**
   - Why: with the shared hook, the public pages had to load it as an extra 535 B chunk, and the production build hit 150.10 KB (over).
   - SiteHeader now has its own exit check and its own `CLOSE_FALLBACK_MS = 400`.
   - `usePresence` is back to main (300 ms). The plan's link "SiteHeader to usePresence" and its artifact "usePresence.ts FALLBACK_MS = 400" no longer apply.
3. **[Rule 3] Budget-build trims in SiteHeader.**
   - The first D-132 verify passed the production build (149.79 KB) but failed `build:budget` (`public JS (home) 150.01 KB ... OVER`).
   - Same behaviour, fewer bytes: the burger icon class became `mounted ? siteBurgerIconClasses : ''`, the no-animation check became `['', 'none'].includes(...)`, and one listener now handles both the animationend and the timer.
   - A plain template-literal join failed the D-33 lint rule (class names must be complete literals), so the item joins stay on `clsx`.
4. **[Rule 3] Line endings.** The three planning docs keep CRLF in the working copy (`i/lf w/crlf`).
5. **Process note.** One of my inspection commands hung on stdin: an empty file variable left `gzip` reading stdin. I found my own process (PID 723) and stopped it within a few minutes. No other process was touched.
6. **Timeout note.** My first verify run was stopped by my own 590 s `timeout` (`VERIFY=124`), not by a failure. Later runs had no time limit.

## Known Stubs

None.

## Owner follow-ups

1. Run `npm --prefix web run parity -- --grep @navigation` before the PR, to prove the rulings mirror. Playwright was not run here.
2. Check the menu on a phone (or at 390 px): does 0.45 s in and 0.3 s out feel right?
3. No Playwright @motion test covers the public menu yet. Parked.
4. **Owner question, budget margin:** in the admin-included budget build, public JS is now 149.98 to 149.99 KB of 150.00, about 10 bytes to spare, so the next public change will likely break it. What should happen next?
   1. (Recommended) Plan the barrel split the budget note already names (research Flag 4). The public pages load the shared navigation chunk, which also carries the admin drawer, topbar and user-menu code. This frees real room without raising any limit.
   2. Trim public code case by case as changes arrive. Cheap now, but it repeats on every change.
   3. Raise the PERF-01 public JS budget. The budget file itself says never to raise a limit to make a build pass, so this is the owner's call only.
5. `src/Csps.Server/wwwroot` and `web/.budget-dist` (git-ignored build output) hold the last verify builds, which match HEAD.

## Self-Check: PASSED

- FOUND: f1fd421d, f4f8207a, b337d4d4, 1e4a58c8, d882354c (all ancestors of HEAD).
- `git diff main -- web/src/hooks/` is empty.
- `git status --short` shows only this SUMMARY (untracked, left uncommitted as asked).

---
phase: 05-profile-user-management
plan: 01
subsystem: ui
tags: [tailwind, layout, playwright, sticky, dvh, admin-shell]
created: "2026-10-17T19:08:00-05:00"
updated: "2026-10-17T19:08:00-05:00"

requires:
  - phase: 02-design-system-and-shells
    provides: pageRootClasses, adminClasses, sidebarClasses, tabBarClasses, AdminLayout, PublicLayout
provides:
  - "data-fill=viewport marker on the real layout roots and in-data-[fill=viewport] recipe variants"
  - "Phone tab bar pinned to the viewport bottom with a safe-area bottom padding"
  - "Pinned sidebar column (h-dvh sticky) whose nav scrolls on its own"
  - "web/e2e/shell.spec.ts @shell geometry suite (D-01, D-02, D-03, D-04, D-05, D-36)"
affects: [05-37 overflow sweep for new Phase 5 pages, all later admin pages]

plan_head_before: b1c8e1fceebd0b2adc00d472f50c0ba9c387fa47
plan_head_after: 9ff62307e97ec1188ef866e7e28826ca5a9ab5f5

actuals:
  tokens: 5300
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Real layouts opt in to viewport sizing with data-fill=viewport; recipes read it through in-data-[fill=viewport] variants, so previews and parity frames keep App. C looks"
    - "Stacked in-data variants (in-data-[fill=viewport]:in-data-[ui=s-admin-side]:) scope a look to the real shell's side column"

key-files:
  created:
    - web/e2e/shell.spec.ts
  modified:
    - web/src/components/layout/layout.recipe.ts
    - web/src/components/layout/layout.recipe.node.test.ts
    - web/src/modules/admin/components/admin.recipe.ts
    - web/src/components/navigation/navigation.recipe.ts
    - web/src/layouts/AdminLayout.tsx
    - web/src/layouts/PublicLayout.tsx
    - web/src/layouts/PublicLayout.test.tsx
    - web/src/core/routes/ErrorBoundary.tsx
    - web/src/core/routes/ErrorBoundary.test.tsx
    - web/src/core/routes/ShellFallback.tsx

key-decisions:
  - "Marker approach kept: the viewport rules hang off data-fill=viewport on the layout root; no ancestor gets an overflow value"
  - "The short admin page for geometry tests is the dev preview /admin/orders, because /admin/does-not-exist is not an admin shell page in the e2e bundle"
  - "The sideways-scroll check compares scrollWidth with clientWidth (stricter than innerWidth when a real scrollbar takes width)"

requirements-completed: [USER-08]

coverage:
  - id: D1
    description: "Phone tab bar bottom equals the viewport bottom on a short and a long page at 320 to 767 px, and the end of main clears the bar (D-36)"
    requirement: USER-08
    verification:
      - kind: e2e
        ref: "web/e2e/shell.spec.ts#@shell tab bar sits at the viewport bottom at 320x568 (and 375x812, 414x896, 767x900)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Admin, public, error and fallback page roots fill the dynamic viewport; the side column spans it (D-01)"
    requirement: USER-08
    verification:
      - kind: e2e
        ref: "web/e2e/shell.spec.ts#@shell full bleed admin / full bleed public"
        status: pass
      - kind: unit
        ref: "web/src/components/layout/layout.recipe.node.test.ts#fills the dynamic viewport only under the data-fill marker"
        status: pass
      - kind: unit
        ref: "web/src/core/routes/ErrorBoundary.test.tsx#brings page roots that fill the viewport"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sidebar column and top bar stay pinned at any scroll depth on tablet, desktop and phone (D-02, D-04)"
    requirement: USER-08
    verification:
      - kind: e2e
        ref: "web/e2e/shell.spec.ts#@shell sidebar and top bar stay pinned at 1440x900 (and 1024x768, 390x844)"
        status: pass
    human_judgment: false
  - id: D4
    description: "On short screens the nav scrolls inside the pinned sidebar while the logo stays on top and Logout stays in view and reachable by Tab (D-03)"
    requirement: USER-08
    verification:
      - kind: e2e
        ref: "web/e2e/shell.spec.ts#@shell short screen 1280x360 keeps Logout in view (and 1280x600, 1024x480, 1440x450)"
        status: pass
      - kind: e2e
        ref: "web/e2e/shell.spec.ts#@shell the scrolling nav passes axe at 1280x600"
        status: pass
    human_judgment: false
  - id: D5
    description: "No shell page scrolls sideways from 320 to 1920 px and html/body never hide overflow (D-05)"
    requirement: USER-08
    verification:
      - kind: e2e
        ref: "web/e2e/shell.spec.ts#@shell no sideways scroll on {/admin/sessions,/dev/components,/,/admin/login,/admin/does-not-exist}"
        status: pass
    human_judgment: false
  - id: D6
    description: "Real iOS Safari behaviour of the bottom bar and safe-area inset (engines were probed, a real phone was not)"
    verification: []
    human_judgment: true
    rationale: "Real device Safari toolbar and notch behaviour cannot be asserted by headless engines; viewport-fit=cover stays deferred to the PWA work (D-41 Q6)"

duration: 39min
completed: 2026-10-17
status: complete
---

# Phase 5 Plan 01: Shell Height Chain Summary

**One data-fill=viewport marker on the real layout roots makes the admin, public, error and fallback pages fill the dynamic viewport, pins the phone tab bar to the screen bottom with a safe-area pad, and pins the sidebar column so its nav scrolls on its own, proven by a 23-test @shell Playwright suite in five projects.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-10-17T18:28:00-05:00
- **Completed:** 2026-10-17T19:07:00-05:00
- **Tasks:** 3 (1 tracer, 2 auto), each as a RED commit then a GREEN commit
- **Files modified:** 11 (1 created)

## Accomplishments

- D-01 and D-36: `pageRootClasses` and `adminClasses` gain `min-h-dvh` under the marker; `tabBarClasses` pads `12px + env(safe-area-inset-bottom)`. The tab bar's bottom edge now equals the viewport bottom on a short page and on a long page (scrolled to the middle and the end) at 320, 375, 414 and 767 px, and the last content of main clears the bar.
- D-02, D-03, D-04: under the marker the side column Sidebar is `sticky top-0 h-dvh min-h-0` and its nav is `min-h-0 flex-1 overflow-y-auto overscroll-contain`, so the logo stays on top, the user chip and Logout stay at the bottom, and Tab from the last nav link reaches Logout. The top bar stays pinned on phones as before. The stale drawer comment (page root "traps" fixed children) is rewritten to the probed truth.
- D-01 (public and error roots): `PublicLayout`, both error-screen roots and `ShellFallback` carry the marker.
- D-05: the sweep covers 5 paths at 8 widths and checks `scrollWidth <= clientWidth` and `overflow-x: visible` on html and body. It passes in chromium, firefox, webkit and both phone projects, and in classic-scrollbar Chromium (probed once, config reverted).
- Verified: `npm run verify` (typecheck, lint, format, coverage thresholds, both builds and budgets, licenses, notices) exit 0; `npm run parity --project chromium` 240 passed, so the look-equality cases are unchanged.

## Task Commits

1. **Task 1 (tracer): tab bar and admin full bleed**
   - RED `bde0c25` test(05-01): pin the phone tab bar and fill the viewport
   - GREEN `214febb` feat(05-01): admin shell fills the viewport and the tab bar stays at the bottom (D-01, D-36)
2. **Task 2: sticky sidebar and own nav scroll**
   - RED `73246d7` test(05-01): sticky sidebar and own nav scroll
   - GREEN `65db97b` feat(05-01): sidebar and top bar stay pinned; nav scrolls on short screens (D-02, D-03)
3. **Task 3: public and error roots, no sideways scroll**
   - RED `eebb40e` test(05-01): no sideways scroll 320-1920 and full-bleed public and error roots
   - GREEN `9ff6230` feat(05-01): full-bleed public and error pages; shell never scrolls sideways (D-01, D-05)

**Plan metadata:** the docs(05-01) commit that holds this SUMMARY, STATE.md and ROADMAP.md.

## TDD Gate Compliance

Each task has its `test(05-01)` commit before its `feat(05-01)` commit; no refactor commit was needed. The plan type is `execute` (tasks carry `tdd="true"`), so `gsd_run check tdd-red-evidence` was not run; the RED evidence is below with a semantic assessment.

- **Task 1 RED:** `layout.recipe.node.test.ts` failed 3 tests on the planned assertions (exact token list lacked `data-[fill=viewport]:min-h-dvh`, class-gate token list, no `[data-fill=viewport]` rule with `min-height: 100dvh`). Playwright failed 5 of 6 on the planned assertions: bar bottom 240 to 329 px short of the viewport bottom at 375x812, 414x896, 767x900; page root bottom 536 and 571 px against 900 and 844. The 320x568 case passed because content was already as tall as the screen there. Assessment: failures are the intended behaviour gap, not setup or syntax errors.
- **Task 2 RED:** `@shell sidebar and top bar stay pinned` at 1440x900 and 1024x768 failed with the sidebar top at 56556 px after scrolling (the sticky Sidebar was as tall as the whole page, so it could not stick); the three short-screen tests failed with nav `overflow-y: visible`. 390x844 passed (D-04 already held). Assessment: correct failures on the planned assertions.
- **Task 3 RED:** two Vitest tests failed on the missing `data-fill="viewport"` marker (public layout and shell fallback; both error roots). The e2e sweep and public full-bleed tests passed from the start (see deviation 3); they are kept as regression guards.

## Files Created/Modified

- `web/e2e/shell.spec.ts` - `@shell` geometry suite: tab bar, full bleed admin and public, pinned layers, short screens, axe, sideways sweep.
- `web/src/components/layout/layout.recipe.ts` - `pageRootClasses` adds `data-[fill=viewport]:min-h-dvh`.
- `web/src/components/layout/layout.recipe.node.test.ts` - pins the new token and the compiled `100dvh` rule.
- `web/src/modules/admin/components/admin.recipe.ts` - `adminClasses` `in-data-[fill=viewport]:min-h-dvh`; tab bar safe-area padding.
- `web/src/components/navigation/navigation.recipe.ts` - stacked sticky `h-dvh min-h-0` for the side column Sidebar, own scroll for its nav, drawer comment rewritten.
- `web/src/layouts/AdminLayout.tsx`, `PublicLayout.tsx`, `web/src/core/routes/ErrorBoundary.tsx`, `ShellFallback.tsx` - `data-fill="viewport"` on the page roots.
- `web/src/layouts/PublicLayout.test.tsx`, `web/src/core/routes/ErrorBoundary.test.tsx` - marker assertions.

## Decisions Made

- Kept the plan's marker design. The `/dev/components` showcase sits under the marked AdminLayout root, but it renders no shell previews of its own (probed: only the real `s-admin-side` exists there), and the parity bundle has no marker, so previews and parity frames keep their App. C looks (parity run green).
- `HoldingPage` (the live public page until Phase 11) was left alone: its `main` is already `min-h-dvh`, so it fills the viewport.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan defect] The short admin page `/admin/does-not-exist` is not an admin shell page**
- **Found during:** Task 1 (reading the routes)
- **Issue:** No route matches it under `/admin`, so the e2e bundle shows the public holding page (no sidebar, no tab bar). The "Page not found" screen appears only for guarded `/admin/orders` and similar, and in the e2e bundle the dev preview wins those paths.
- **Fix:** The short admin page in the tab bar, full-bleed and short-screen tests is the dev preview `/admin/orders` (it renders the real AdminLayout with a placeholder user, so no sign-in is needed). `/admin/does-not-exist` stays in the D-05 sweep as the holding page. `/admin/sessions` in the sweep signs in as a Manager.
- **Files modified:** web/e2e/shell.spec.ts
- **Committed in:** bde0c25, 73246d7, eebb40e

**2. [Rule 1 - Plan defect] The nav does not overflow at 1280x600, 1024x480 or 1440x450**
- **Found during:** Task 2 GREEN (measured: the five items need 241px, and 1440x450 leaves exactly 241px)
- **Issue:** The plan asked for `scrollHeight > clientHeight` at all three sizes, which is false because the content fits.
- **Fix:** All sizes assert `overflow-y: auto`, logo on top, Logout inside the viewport and Tab reaching Logout; the must-scroll assertion applies at an added 1280x360 case.
- **Files modified:** web/e2e/shell.spec.ts
- **Committed in:** 65db97b

**3. [Rule 1 - Plan assumption] D-05 sideways scroll does not reproduce at this commit**
- **Found during:** Task 3 RED
- **Issue:** The sweep passed before any Task 3 change, in chromium, firefox, webkit, pixel, iphone and classic-scrollbar Chromium (probed once through a temporary config edit, reverted). The existing D-41 R2-01 topbar fix and the `overflow-x-auto` showcase case frames already hold. No wide child was found, so no culprit file was changed (`showcase.recipe.ts` untouched). The sweep and the public full-bleed tests stay as regression guards, and the sweep is stricter than the plan (`clientWidth`, and html/body `overflow-x` must be `visible`). The RED for Task 3 is the Vitest marker tests.
- **Files modified:** none beyond the tests
- **Committed in:** eebb40e

**4. [Rule 2 - Coverage] Unit tests added for the new markers**
- **Found during:** Task 3
- **Issue:** The e2e bundle cannot reach the public layout, the error roots or the shell fallback, so nothing would have caught a missing marker there.
- **Fix:** Marker assertions in `PublicLayout.test.tsx` and `ErrorBoundary.test.tsx` (not in the plan's file list).
- **Committed in:** eebb40e, 9ff6230

---

**Total deviations:** 4 (3 plan defects or assumptions corrected, 1 added coverage)
**Impact on plan:** No scope creep; every D-xx truth in the plan holds and is asserted.

## Issues Encountered

None blocking. `npm run e2e` passes the shared-machine preflight (ports free, no other project's processes) before each run.

## Known Stubs

None.

## Threat Flags

None. The change is utilities and one data attribute; no style attribute or injected style, and the guard's CSP and console rules stayed green (T-05-01). The geometry tests assert the last main element clears the bar and Logout is reachable at short heights (T-05-02). No packages were installed (T-05-SC).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 05-02. 05-37 adds the new Phase 5 pages to the same `SWEEP_PATHS` list.
- Owner phone check in UAT still needed for real iOS Safari (D6).

## Self-Check: PASSED

- `web/e2e/shell.spec.ts` exists; commits `bde0c25`, `214febb`, `73246d7`, `65db97b`, `eebb40e`, `9ff6230` are ancestors of HEAD.
- Acceptance greps: `data-[fill=viewport]:min-h-dvh` 1, `env(safe-area-inset-bottom)` 1, `data-fill="viewport"` AdminLayout 1, PublicLayout 1, ErrorBoundary 2, ShellFallback 1, stacked side-column variant lines 2, `overscroll-contain` lines 2, `@shell` 7, `1920` 3.
- `npm --prefix web run e2e -- --grep @shell` 115 passed (23 tests, five projects); `npm run verify` exit 0; `npm run parity --project chromium` 240 passed.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-17*

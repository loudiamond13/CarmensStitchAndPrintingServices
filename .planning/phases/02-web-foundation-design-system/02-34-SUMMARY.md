---
phase: 02-web-foundation-design-system
plan: 34
subsystem: ui
tags: [react, design-system, barrel, showcase, playwright, axe, dev-routes]
created: "2026-10-09T04:09:00-05:00"
updated: "2026-10-09T04:09:00-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "every area barrel (02-17..02-32), the scenario list + renderNode + impl kit (02-13/02-14/02-38), the admin shell (02-31/02-32), the budget plugin (02-33)"
provides:
  - "@/ui barrel (web/src/ui/index.ts): all 15 area barrels + @/lib/csps, with the export-list test"
  - "kit completeness test: every scenario component resolves in the impl kit"
  - "D-22 Component Showcase at /dev/components inside the admin shell (dev/e2e/budget builds only)"
  - "Sidebar active={null} (no current item) used by the admin shell on non-section paths"
  - "@showcase E2E: both themes, five projects, page-level axe, 320px overflow, toast tones, Delete Order dialog"
affects: [02-35, 02-36, phase-04, feature-phases]

actuals:
  tokens: 15300
  tasks: 2
  commits: 4
plan_head_before: 2be2c39a604a85035fe16785ed726a427c991b39
plan_head_after: b6450b5cc441486613431bf782abf4fd1742ca31

tech-stack:
  added: []
  patterns:
    - "Feature code imports primitives from @/ui (one surface; identity-checked against the area barrels)"
    - "Showcase case frame: page root + overflow-x-auto + role=region tabIndex=0 named by its overline label"
    - "Fixed-position scenarios become trigger demos with real handlers (no page root around them)"

key-files:
  created:
    - web/src/ui/index.test.ts
    - web/src/dev/kit.test.ts
    - web/src/dev/ComponentShowcase.test.tsx
    - web/src/dev/ShowcaseDemos.tsx
    - web/src/dev/showcase.recipe.ts
    - web/src/dev/showcaseCopy.ts
    - web/src/dev/showcaseSections.ts
    - web/src/dev/showcaseSections.test.ts
    - web/e2e/showcase.spec.ts
  modified:
    - web/src/ui/index.ts
    - web/src/dev/ComponentShowcase.tsx
    - web/src/app/admin/routes.tsx
    - web/src/app/admin/AdminLayout.tsx
    - web/src/ui/navigation/Sidebar.tsx
    - web/src/ui/navigation/Sidebar.test.tsx

key-decisions:
  - "Showcase sections: the UI-SPEC's seven in order, then Navigation and Marketing (so every scenario appears); whole-page layout groups are left out (own h1/main; their routes show them)"
  - "Fixed-position (viewport) scenarios render as trigger demos with real handlers; the user-menu case renders on request; the skip-link case shows the SkipLink alone (no second main)"
  - "Case frames are named, focusable scroll regions so a case wider than a phone frame never widens the page and stays keyboard-scrollable (axe scrollable-region-focusable)"
  - "Sidebar accepts active={null}; AdminFrame passes it for non-section paths, so /dev/components marks no item current"
  - "Budget: dev-route public JS 149.47 KB of 150 KB (was 149.34); no remedy applied, none needed yet"

patterns-established:
  - "New scenario group files must be placed in showcaseSections.ts (scenariosBySection throws otherwise)"
  - "A one-theme scenario keeps its theme in its showcase frame (data-theme); two-theme cases take the shell theme"

requirements-completed: [WEB-06, WEB-02, A11Y-01]

coverage:
  - id: D1
    description: "@/ui exports the 37 App. D.3 components, the six constants/hooks, the SPEC-GAP primitives and the csps helpers, each identical to its area barrel export"
    requirement: WEB-06
    verification:
      - kind: unit
        ref: "web/src/ui/index.test.ts (63 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every component name in every scenario tree resolves in the implementation kit"
    requirement: WEB-02
    verification:
      - kind: unit
        ref: "web/src/dev/kit.test.ts (189 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "/dev/components renders the showcase (page head, sections in order, every non-layout scenario, icon names, live demos) inside the admin shell with no current sidebar item"
    requirement: WEB-06
    verification:
      - kind: unit
        ref: "web/src/dev/ComponentShowcase.test.tsx (23 cases) + showcaseSections.test.ts (4)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep \"@showcase|@admin|@public\" (105 passed, 25 of them @showcase)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Page-level axe, console and CSP clean on /dev/components in Blush and Espresso in all five projects; open Delete Order dialog axe-clean"
    requirement: A11Y-01
    verification:
      - kind: e2e
        ref: "web/e2e/showcase.spec.ts#@showcase /dev/components in Blush|Espresso"
        status: pass
    human_judgment: false
  - id: D5
    description: "Overall look of the showcase in both themes and long-text wrapping (toast, field message, EmptyState) as seen in the D-23 screenshots"
    verification: []
    human_judgment: true
    rationale: "UI-SPEC marks long-text as a backstop verified in the D-23 owner screenshots (plan 02-36's review pack); no automated test judges the overall impression"

duration: 39min
completed: 2026-10-09
status: complete
---

# Phase 2 Plan 34: @/ui Barrel and Component Showcase Summary

**One `@/ui` import surface (15 area barrels plus `@/lib/csps`, pinned by an identity-checked export test) and the D-22 `/dev/components` showcase inside the admin shell, which renders all 177 non-layout scenarios plus live dialog/drawer/toast demos and is axe/console/CSP-clean in Blush and Espresso in all five Playwright projects.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-10-09T08:29:16Z
- **Completed:** 2026-10-09T09:08:11Z
- **Tasks:** 2 (both TDD: RED, then GREEN)
- **Files modified:** 15

## Accomplishments

- `web/src/ui/index.ts` re-exports every area barrel in alphabetical order plus `@/lib/csps` (App. D.3 does the same: `// SPEC-DEVIATION: D.3 re-exports csps; kept`). The test checks the 37 App. D.3 names, STATUS_TONE/PAYMENT_TONE/EXPENSE_TONE/SITE_LINKS/ADMIN_NAV/useToast, the 17 SPEC-GAP primitives plus Overlay, and that every export is the same object as its area barrel's, so there is no second implementation.
- `kit.test.ts` walks every scenario node tree (nested nodes in props, arrays and objects) and finds each component in the impl kit, so the page never shows "Missing component".
- The `ComponentShowcase` page has the `.s-ph` head, the h1 "Component Showcase", the UI-SPEC subline and the title "Component Showcase · CSPS (dev)". Below that are nine `.s-card` sections with `.s-card-h h2` headings. Each case sits under its id in the `.csp-overline` look, inside a fixed-width `[data-case]` page-root frame (L-29).
- Live demos use real handlers: Add Payment modal, Add User slide-over, Delete Order (empty, typed, failed with a traceId), the phone navigation drawer, and toast triggers for every tone plus the long-copy toast. Delete Order only raises the spec §9.3 success toast, so nothing is deleted.
- Extra cases: all 56 icons with their names, ORD-2026-0148 dates via `formatCalendarDate`, and a loaded LazyImage of `/mark.svg`.
- `/dev/components` is a lazy route under `AdminLayout`, compiled in behind `__DEV_ROUTES__` with both admin error boundaries. Production `wwwroot` holds no "Component Showcase" (the existing build-output test, re-run in verify).
- `web/e2e/showcase.spec.ts` tests (@showcase) cover both themes and page-level axe, plus the 320px check: `main` does not overflow, the page is no wider than `/admin` alone, and the 4-chip FilterBar wraps. They also cover the four toast tones and an axe-clean open Delete Order dialog. Result: 25 of 25 passed across 5 projects.

## Task Commits

1. **Task 1: @/ui barrel + kit completeness (tracer)**
   - `b7567b0` test(02-34): add failing tests for the @/ui barrel and kit completeness (RED_EVIDENCE_OK: 63 fail on assertions)
   - `a365049` feat(02-34): expose every primitive through the @/ui barrel
   - Tracer gate: verify re-run (254 passed) before expansion.
2. **Task 2: /dev/components showcase**
   - `9575493` test(02-34): add failing tests for the component showcase and its route (RED_EVIDENCE_OK: 22 fail on assertions)
   - `b6450b5` feat(02-34): add the /dev/components showcase in the admin shell

**Plan metadata:** recorded in the docs(02-34) commit that adds this file.

## Files Created/Modified

- `web/src/ui/index.ts` and `index.test.ts`: the single `@/ui` surface and its export-list test.
- `web/src/dev/kit.test.ts`: kit completeness over every scenario tree.
- `web/src/dev/ComponentShowcase.tsx`: the page, the `CaseFrame` and `ShowcaseSection` components (the latter exported for tests), and on-demand cases.
- `web/src/dev/ShowcaseDemos.tsx`: the viewport demos, the block replacement (SkipLink) and the extra cases.
- `web/src/dev/showcaseSections.ts` and its test: the section order and the group-to-section map. It throws on a group no section takes.
- `web/src/dev/showcase.recipe.ts`: the `.s-card`, `.s-card-h`, `.s-card-b` and frame looks. `showcaseCopy.ts` holds the page and trigger copy.
- `web/src/app/admin/routes.tsx`: the `dev` → `components` branch, sharing one lazy AdminLayout loader.
- `web/src/app/admin/AdminLayout.tsx`, `web/src/ui/navigation/Sidebar.tsx` and `Sidebar.test.tsx`: `active={null}` means no item is current.
- `web/e2e/showcase.spec.ts`: the @showcase E2E.

## Decisions Made

- **Sections:** the UI-SPEC's seven groups come first, then Navigation (navigation + navigation-gaps) and Marketing. Without those two, the navigation and marketing scenarios (which 02-32 asked this plan to show) would have no place. The three whole-page layout groups are excluded because each brings its own h1, `main` and skip link, and `/` and `/admin/*` already show them.
- **Placement:** LazyImage (`lazy-image-*`) and MediaPlaceholder (`media-placeholder-*`) cases move to Media, as the UI-SPEC lists them there.
- **Themes:** a one-theme scenario keeps that theme on its frame. The public parts stay Blush (D-14), and `topbar-dark` stays Espresso. Two-theme cases inherit the shell theme, which is the one the toggle switches.
- **Interactive cases:**
  - Viewport scenarios become trigger demos whose frames are not page roots, so the fixed layer they open covers the page.
  - `user-menu-open` renders only on "Show this example", because it focuses a menu item on mount and would jump the page.
  - `skip-link-focused` shows the SkipLink alone. Its wrapper focuses on load and renders a second `main#main`.
- **Budget:** dev-route public JS is now 149.47 KB of 150 KB (was 149.34). Every build passes, so the orchestrator-approved remedy was not needed. This is recorded in deferred-items.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / A11Y] The showcase claimed to be the Dashboard page**
- **Found during:** Task 2
- **Issue:** `adminNavItemForPath('/dev/components')` is undefined. The Sidebar's App. D.3 default (`active = 'dashboard'`) then marked Dashboard `aria-current="page"` on a page that is not Dashboard. The 02-31 hand-off flagged this.
- **Fix:** `SidebarProps.active` now also accepts `null`, meaning no current item (SPEC-DEVIATION comment). `AdminFrame` passes `section ?? null` to both of its Sidebars. The App. D.3 default for `undefined` is unchanged, and every approved section path renders as before.
- **Files modified:** web/src/ui/navigation/Sidebar.tsx, Sidebar.test.tsx, web/src/app/admin/AdminLayout.tsx
- **Verification:** Sidebar test "marks no item current with active null"; the route test, plus E2E checks that `[data-ui=s-admin-side] [aria-current=page]` has count 0 on the showcase; @admin E2E is unchanged and green.
- **Committed in:** 9575493 (test), b6450b5 (fix)

**2. [Rule 2 - A11Y] Case frames are named, focusable scroll regions**
- **Found during:** Task 2, first E2E run
- **Issue:** On Pixel 7 and iPhone 15, `logo-lg` is wider than its frame inside the phone card. axe then reported `scrollable-region-focusable` (WCAG 2.1.1).
- **Fix:** every block frame is now `overflow-x-auto` with `role="region" tabIndex={0} aria-labelledby={label}` and a focus-visible ring. It uses the same recorded lint exception as DataTable and ResponsiveTable.
- **Files modified:** web/src/dev/ComponentShowcase.tsx, web/src/dev/showcase.recipe.ts
- **Verification:** @showcase passed 25 of 25 in five projects.
- **Committed in:** b6450b5

**3. [Rule 3 - Blocking] The page-level 320px check is scoped to what the showcase adds**
- **Found during:** Task 2
- **Issue:** The approved admin Topbar already makes every admin page 398px wide below 398px. That is an open owner item from 02-31. Measured at 320px: `/admin` and `/dev/components` both have a 398px page and a 320px `main`. A plain `scrollWidth <= innerWidth` check therefore cannot pass until the owner rules.
- **Fix:** the spec now checks that `main` does not overflow, that the page is no wider than `/admin` alone, and that the 4-chip FilterBar wraps onto several rows. The note sits under the Topbar owner item, so the test can be tightened once the ruling lands.
- **Files modified:** web/e2e/showcase.spec.ts, deferred-items.md
- **Committed in:** b6450b5

**4. [Rule 3 - Blocking] Full-page unit tests timed out under the parallel verify run**
- **Issue:** Each test renders about 190 cases. The per-id loop and a whole-page axe run exceeded 5 s and 30 s under the parallel run.
- **Fix:**
  - The frames are now counted in a single pass (2.7 s down to 0.34 s).
  - Axe runs on the Buttons and Forms sections rendered on their own (`ShowcaseSection` export), as the plan's "representative slice".
  - The full-page describe blocks get a 20 s timeout.
- **Committed in:** b6450b5

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing critical, 2 blocking). **Impact:** none changes an approved screen. The Sidebar API gained one optional value.

## Issues Encountered

- On phones the toast stack covers the next trigger button, so the E2E dismisses each toast after checking it.
- RTL queries over the roughly 190-case DOM are slow. Prefer single-pass `querySelectorAll` checks in any future showcase test.

## TDD Gate Compliance

RED `b7567b0` → GREEN `a365049` (Task 1). RED `9575493` → GREEN `b6450b5` (Task 2). `gsd-tools check tdd-red-evidence` verified both RED records as `RED_EVIDENCE_OK`, with the target test files `src/ui/index.test.ts` and `src/dev/ComponentShowcase.test.tsx`. No refactor commit was needed.

## Owner Decisions Pending (logged in deferred-items.md)

- The two extra showcase sections ("Navigation", "Marketing") and the dev-only demo button words. This is a copy/look question and does not block anything.
- FYI only: no sidebar item is current on the showcase.

## Verification

- `npm --prefix web run test -- --run src/ui/index.test.ts src/dev/kit.test.ts`: 254 passed.
- `npm --prefix web run test -- --run src/dev`: all passed (ComponentShowcase 23, showcaseSections 4, kit 189 and others).
- `npm --prefix web run verify`: exit 0. That is 2595 tests in 99 files, with coverage of 98.05% statements and 96.09% branches. Production public JS is 129.95 KB and CSS 12.92 KB. Dev-route public JS is 149.47 KB and admin JS 154.61 KB, all under their limits.
- Preflight, then `npm --prefix web run e2e -- --grep "@showcase|@admin|@public"`: 105 passed, including @showcase at 25 of 25.
- Acceptance: `grep -c "export \* from" web/src/ui/index.ts` gives 16. "Component Showcase" appears in ComponentShowcase.tsx (2) and showcaseCopy.ts (3), and is absent from `src/Csps.Server/wwwroot`.

## Known Stubs

None. The trigger demos open real components, and the success toast is the spec's own copy for a demo that deletes nothing by design (UI-SPEC Copywriting: "nothing is deleted").

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- 02-35 (keyboard and real-browser checks) and 02-36 (owner review pack with D-23 screenshots of `/dev/components` in both themes) can use the showcase now.
- Any later plan that adds dev-route code will probably push dev-route public JS past 150 KB, since only 0.53 KB of headroom is left. Apply the orchestrator-approved remedy (build `budget`/`e2e` without the parity entry, or split the barrels). Never raise the limit.

## Self-Check: PASSED

- All created and modified files listed above exist on disk.
- Commits b7567b0, a365049, 9575493 and b6450b5 are present in `git log`.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-09*

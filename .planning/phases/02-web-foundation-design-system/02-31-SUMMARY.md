---
phase: 02-web-foundation-design-system
plan: 31
subsystem: ui
tags: [react, react-router, tailwind, container-queries, parity, a11y, admin-shell, theme]
created: "2026-10-09T02:18:00-05:00"
updated: "2026-10-09T02:18:00-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "UrlStateLayout (02-11), ToastProvider/EmptyState/Skeleton (02-21), Sidebar/Topbar/ADMIN_NAV and the nav-item recipe (02-26), SkipLink (02-27), the data router, lazyRoute and the error boundaries (02-29)"
provides:
  - "Dev-only admin route tree (adminRoutes): lazy AdminLayout > lazy pathless UrlStateLayout > /admin, /admin/orders, /admin/expenses, /admin/users, /admin/profile, added by router.tsx only when __DEV_ROUTES__ is true (D-20)"
  - "AdminLayout (default) and AdminFrame (the App. E.6 frame: data-ui s-admin-side / s-admin-main, sticky Topbar, main#main in the .s-body look, TabBar), dev user Carmen Reyes (Manager), Logout info toast"
  - "theme.ts: readTheme/writeTheme/THEME_KEY/Theme (D-13), read in a lazy useState initializer"
  - "TabBar (phone, App. E.6 nav.s-tabbar) with TAB_BAR_ITEMS"
  - "AdminPreviewPage + AdminPreviewRoute (page head, EmptyState, showcase link, document title)"
  - "Page-head looks in @/ui/layout/layout.recipe: pageHeadClasses, pageHeadTitleClasses, pageTitleClasses, pageSublineClasses"
  - "Tablet icon rail as pg-tablet:in-data-[ui=s-admin-side]: variants on the Sidebar, nav item, label, tag, user chip, toggle and Logo (new brand maps logoLettersContextClasses, logoLetterMarkContextClasses)"
  - "AdminRouteErrorBoundary and AdminRootErrorBoundary (admin body copy)"
  - "lazyRoute moved to web/src/app/lazyRoute.ts (still re-exported from router.tsx)"
  - "Parity groups layouts-admin and layouts-admin-boundaries (767.5px and 1023.5px page roots); wrapper pair AdminShell"
  - "UiLink aria-labelledby prop; Sidebar items and Logout named by aria-labelledby"
affects: [02-32, 02-33, 02-34, 02-35, 02-36, phase-04-auth, admin-screens]

actuals:
  tokens: 28500
  tasks: 3
  commits: 7
plan_head_before: 096d3d9fdd8de7a4fc5f54414a962dedc295384b
plan_head_after: ddbed1ae5b845361cc8527f961b60605679bd86b

tech-stack:
  added: []
  patterns:
    - "Dev-only route branches: `...(__DEV_ROUTES__ ? adminRoutes : [])` at module scope in router.tsx, loaders marked /* @__PURE__ */, so a production build drops every admin module (build-output test on the copy strings, proven by a VITE_DEV_ROUTES=true mutation build)"
    - "Shell context looks: the layout marks its regions with data-ui (s-admin-side, s-admin-main) and the component recipes carry in-data-[ui=…] / pg-tablet:in-data-[ui=…] variants; collapsed-sidebar rules keep precedence by living only in the expanded layout maps"
    - "Breakpoint variants keep App. C's exact query text (pg-phone + pg-tablet, never pg-lt-lg for a rule App. C states twice), so fractional widths between 767/768 and 1023/1024 behave as the approved CSS does"
    - "Fractional-width parity: a second page root of frameWidth px (max-w-full) inside the case frame, in its own non-responsive group"
    - "E2E width checks set the viewport so the page root is exactly the target width and wait for running transitions (page.evaluate on document.getAnimations, since waitForFunction needs eval under the strict CSP)"

key-files:
  created:
    - web/src/app/admin/routes.tsx
    - web/src/app/admin/AdminLayout.tsx
    - web/src/app/admin/AdminLayout.test.tsx
    - web/src/app/admin/AdminPreviewPage.tsx
    - web/src/app/admin/TabBar.tsx
    - web/src/app/admin/theme.ts
    - web/src/app/admin/theme.test.ts
    - web/src/app/admin/admin.recipe.ts
    - web/src/app/admin/copy.ts
    - web/src/app/admin/sections.ts
    - web/src/app/lazyRoute.ts
    - web/src/dev/previews/AdminShell.tsx
    - web/src/dev/scenarios/groups/layouts-admin.ts
    - web/src/dev/scenarios/groups/layouts-admin-boundaries.ts
    - web/visual/reference/fragments/AdminShell.tsx
    - web/e2e/admin.spec.ts
  modified:
    - web/src/app/router.tsx
    - web/src/app/ErrorBoundary.tsx
    - web/src/app/ErrorBoundary.test.tsx
    - web/src/test/build-output.node.test.ts
    - web/src/ui/layout/layout.recipe.ts
    - web/src/ui/layout/layout.recipe.node.test.ts
    - web/src/ui/navigation/navigation.recipe.ts
    - web/src/ui/navigation/navItem.recipe.ts
    - web/src/ui/navigation/Sidebar.tsx
    - web/src/ui/navigation/Sidebar.test.tsx
    - web/src/ui/brand/brand.recipe.ts
    - web/src/ui/brand/Logo.tsx
    - web/src/ui/actions/UiLink.tsx
    - web/src/ui/actions/links.test.tsx
    - web/visual/intentional-differences.ts
    - web/visual/compare.test.ts
    - docs/web/parity.md
    - .planning/phases/02-web-foundation-design-system/deferred-items.md

key-decisions:
  - "Admin branch compiled in only via the module-scope `__DEV_ROUTES__ ? adminRoutes : []`; production assets carry none of 'Open Component Showcase', 'Component Showcase' or 'CSPS Admin' (D-20, T-02-69)"
  - "The section comes from the path (adminNavItemForPath over ADMIN_NAV), shared by the shell, the tab bar and the preview page"
  - "Admin error boundaries: AdminRouteErrorBoundary on the UrlStateLayout route (inside main), AdminRootErrorBoundary on the admin route (own page root), both with ERROR_BOUNDARY_COPY.adminBody"
  - "Sidebar items and Logout are named by aria-labelledby (SPEC-DEVIATION A11Y-01): App. C's tablet rail hides the labels with display:none, which left the approved rail links nameless (axe link-name); attributes only, reference side gets the same attribute after mount"
  - "Tab bar items are plain links (App. E.6 nav), not a roving list"
  - "Kept the approved Topbar overflow under 398px and recorded it as an owner question; the E2E scroll check covers 767/768/1023/1024"
  - "EmptyState words on the preview pages are SPEC-GAP copy in web/src/app/admin/copy.ts, pending owner confirmation"

patterns-established:
  - "AdminFrame is the reusable shell body: later admin plans render it through AdminLayout; 02-32 adds drawerOpen/onMenu and the UserMenu there"
  - "Every admin preview or later admin page sets its document title as '{Section} · CSPS Admin'"

requirements-completed: [WEB-05, WEB-10, A11Y-02]

coverage:
  - id: D1
    description: "Dev-only admin routes render the admin shell with the section's preview page, current sidebar item and document title on all five paths, in five Playwright projects"
    requirement: WEB-05
    verification:
      - kind: unit
        ref: "web/src/app/admin/AdminLayout.test.tsx#AdminLayout sections (D-20, A11Y-04)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @admin (35 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Production builds contain no admin or /dev module (D-20)"
    requirement: WEB-10
    verification:
      - kind: unit
        ref: "web/src/test/build-output.node.test.ts#contains no admin or /dev module"
        status: pass
    human_judgment: false
  - id: D3
    description: "UrlStateLayout (the one NuqsAdapter) sits as a lazy pathless route above the admin pages"
    requirement: WEB-10
    verification:
      - kind: unit
        ref: "web/src/app/admin/AdminLayout.test.tsx#AdminLayout error boundaries (admin > url state > pages shape)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Theme toggle persists in localStorage['csps-theme'], starts in Blush, never reads prefers-color-scheme, works in memory when storage throws"
    requirement: WEB-05
    verification:
      - kind: unit
        ref: "web/src/app/admin/theme.test.ts"
        status: pass
      - kind: e2e
        ref: "web/e2e/admin.spec.ts#@admin the theme toggle switches to Espresso, and the choice survives a reload"
        status: pass
    human_judgment: false
  - id: D5
    description: "Shell switches at exactly 767/768 (tab bar to 72px rail, no Manager tag) and 1023/1024 (rail to 248px sidebar) with no horizontal scroll at those widths"
    requirement: WEB-05
    verification:
      - kind: e2e
        ref: "web/e2e/admin.spec.ts#@admin switches from the phone tab bar to the tablet rail at 768px and to the full sidebar at 1024px"
        status: pass
    human_judgment: false
  - id: D6
    description: "Admin shell pixel- and style-equal to App. E.6 at 320/390/820/1440 and in 767.5px/1023.5px page roots, both themes"
    requirement: WEB-05
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep '@layouts-admin|@navigation|@brand|@layouts-public' (90 passed, three engines)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Skip link first, main#main focus target, labelled landmarks, rail items keep their names, zero axe findings"
    requirement: A11Y-02
    verification:
      - kind: unit
        ref: "web/src/app/admin/AdminLayout.test.tsx#AdminLayout landmarks and keyboard (A11Y-01, A11Y-02)"
        status: pass
      - kind: unit
        ref: "web/src/ui/navigation/Sidebar.test.tsx#Sidebar names on the tablet rail (A11Y-01, plan 02-31)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Preview-page empty-state wording and the sub-398px Topbar overflow need the owner's ruling"
    verification: []
    human_judgment: true
    rationale: "Copy and look questions recorded under 'Owner decisions pending' in deferred-items.md; no automated check can decide them"

duration: 65min
completed: 2026-10-09
status: complete
---

# Phase 2 Plan 31: Dev-only Admin Shell Summary

**The dev-only admin shell now runs on the data router behind `__DEV_ROUTES__`: a lazy AdminLayout and a lazy UrlStateLayout above five preview pages. It has the App. E.6 frame (sticky Topbar, a sidebar that turns into a 72px rail from 768 to 1023px, and a phone tab bar), a Blush/Espresso toggle saved in localStorage, and a skeleton page head while a page chunk loads. Production builds provably carry none of it. It is equal to the approved design in three engines, including the 767.5px and 1023.5px gaps between breakpoints.**

## Performance

- **Duration:** 65 min
- **Started:** 2026-10-09T06:10:59Z
- **Completed:** 2026-10-09T07:16:09Z
- **Tasks:** 3
- **Files:** 34 (16 created, 18 modified)

## Accomplishments

- **Routes (D-20, WEB-10):**
  - `adminRoutes` = `/admin` (lazy AdminLayout, AdminRootErrorBoundary) > pathless lazy UrlStateLayout (AdminRouteErrorBoundary) > index, `orders`, `expenses`, `users`, `profile`. Each section loads `AdminPreviewRoute`.
  - `router.tsx` appends the branch with `...(__DEV_ROUTES__ ? adminRoutes : [])`.
  - The production build has no admin chunk; index JS is 121.94 KB gz.
  - A build with `VITE_DEV_ROUTES=true` fails the three new build-output assertions, which proves they bite.
- **AdminLayout and AdminFrame:**
  - The page root (`data-theme`) holds the SkipLink, then the frame, then the toast layer.
  - The side column (`data-ui="s-admin-side"`) has a sticky Sidebar and is hidden on phones.
  - The main column (`data-ui="s-admin-main"`) has the sticky z-20 Topbar, `main#main` in the `.s-body` look (`aria-busy` with a 40%×34 / 60%×14 skeleton head while a chunk loads), and the TabBar.
  - The dev user is Carmen Reyes (Manager). Logout shows the "Not available yet" / "Sign-out comes with the sign-in phase." info toast.
- **Theme (D-13):** `readTheme()` returns `'dark'` only when exactly `'dark'` is saved; it never calls matchMedia. `writeTheme()` returns false when storage refuses the write, and the in-memory toggle keeps working. Both are guarded with try/catch, including the access to `localStorage` itself.
- **TabBar:** the App. E.6 `nav.s-tabbar` with Dashboard, Orders, Expenses and Profile. The current link has `aria-current`, the D-03 bold, the accent-ink icon and the accent bar. It shows only in the phone container.
- **Tablet rail:** every App. C `.s-admin-side` rule is now a `pg-tablet:in-data-[ui=s-admin-side]:` variant: width 72, centred top, no toggle, a 36px mark only, nav and foot padding 12/8, 52px items, no labels, tags or user chip, and the marker at −8px.
- **AdminPreviewPage:**
  - The `.s-ph` head: the h1 is the nav label, with the dev subline under it.
  - An EmptyState (h2) with the section's nav icon and a primary md "Open Component Showcase" link to `/dev/components`.
  - The document title is "{Section} · CSPS Admin".
- **Parity:** `layouts-admin` (dashboard and users, both themes, 320/390/820/1440) and `layouts-admin-boundaries` (767.5px and 1023.5px page roots) are equal. With `@navigation`, `@brand` and `@layouts-public`, 90 of 90 pass in Chromium, Firefox and WebKit, and `@actions` passes 16 of 16 in Chromium. A mutation run (h1 sizes via `pg-lt-lg`, and the rail item width removed) failed exactly in the boundary and 820 cases.

## Task Commits

1. **Task 1 (tracer): routes, shell, preview pages, production exclusion.**
   - RED `e0f14ba`: 13 of 15 fail, `RED_EVIDENCE_OK`.
   - GREEN `78721be`.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran the unit and build-output tests (31 of 31) and the class gate after the commit; E2E `@admin` had already passed 25 of 25 in five projects. Then I moved on to Task 2.
2. **Task 2: theme persistence, tab bar, tablet rail, chunk skeleton.**
   - RED `c02810d`: 17 fail, `RED_EVIDENCE_OK` for theme.test.ts and AdminLayout.test.tsx.
   - GREEN `25f5515`.
3. **Task 3: parity against App. E.6.**
   - RED `c1de8bc`: the pair and scenarios. The first Chromium run was equal at 390/1440 but failed axe `link-name` at 820 and `target-size` at 320 in the boundary cases. The Sidebar rail-naming tests fail 2 against the old Sidebar, `RED_EVIDENCE_OK`.
   - GREEN `83c452e`.
4. **Docs:** `ddbed1a` (parity.md and the owner items).

## Files Created/Modified

- `web/src/app/admin/`: routes, AdminLayout (+test), AdminPreviewPage, TabBar, theme (+test), admin.recipe, copy, sections
- `web/src/app/lazyRoute.ts`, `router.tsx`, `ErrorBoundary.tsx` (the admin pair)
- `web/src/ui/layout/layout.recipe.ts`: the `.s-ph` looks (+node test pinning App. C's query text)
- `web/src/ui/navigation/*`, `web/src/ui/brand/*`: the sticky and rail context variants and the rail naming
- `web/src/ui/actions/UiLink.tsx`: the `aria-labelledby` prop
- Parity: `web/src/dev/previews/AdminShell.tsx`, `web/visual/reference/fragments/AdminShell.tsx`, the two scenario groups, the D-27 registry entries (`0/0/0/0/2/1`, and `0/0/0/0/0/2/1` in the boundary cases)
- `web/e2e/admin.spec.ts` (7 tests × 5 projects)

## Decisions Made

See `key-decisions` in the frontmatter. What later plans need:

- **02-32:**
  - AdminLayout owns the shell. Add `drawerOpen` state and pass `onMenu`, `menuExpanded` and `menuControls` to the Topbar inside `AdminFrame`; the phone "Open navigation" button does nothing yet.
  - The UserMenu goes on the Topbar user button.
  - Sidebar link names now come from `aria-labelledby`, so `getByRole('link', { name })` sees "Users Manager" on a non-current Users row.
- **02-34:** mount `/dev/components` under AdminLayout. `adminNavItemForPath` returns undefined there, and the Sidebar then defaults to Dashboard. If nothing should be current, give `AdminFrame.section` a "none" path.
- **02-33:** the admin route chunk is `src/app/admin/AdminLayout.tsx`. Production has no admin chunk.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The approved tablet rail left the nav links without accessible names**
- **Found during:** Task 3 (first Chromium parity run, axe `link-name` at 820)
- **Issue:** App. C hides `.csp-nav-label` with `display: none` on the rail, so the links (and Logout) had no name in the reference, and would have had none in the implementation either.
- **Fix:** each Sidebar item and Logout is now named by `aria-labelledby` pointing at its own label (plus the "Manager" tag on a non-current Users row), so the names match the visible text at every width. UiLink gained the prop. The reference fragment adds the same attribute after mount. It is marked `// SPEC-DEVIATION: A11Y-01` and flagged to the owner as an FYI. Nothing visible changes.
- **Files modified:** Sidebar.tsx, UiLink.tsx, links.test.tsx, Sidebar.test.tsx, fragments/AdminShell.tsx
- **Commit:** `c1de8bc` (RED), `83c452e` (GREEN)

**2. [Rule 3 - Blocking] The boundary cases at 320px tripped axe `target-size`**
- **Issue:** in the 320 rows the capped boundary roots overflow (the approved Topbar does not fit under 398px), so the overflowing theme toggle met another target.
- **Fix:** the 767.5/1023.5 cases are their own non-responsive group (`layouts-admin-boundaries`), so they run at 390 and 1440 only. This follows 02-30's split of compared and other cases.
- **Commit:** `c1de8bc`

**3. [Rule 3 - Blocking] Context looks outside the planned files**
- **Issue:** the rail hides the "SPS" letters and resizes the mark (App. C `.s-admin-side .csp-logo-mark`, `.csp-logo-word .csp-logo-c`). Neither has a hook in the navigation recipes.
- **Fix:** two new Logo context maps in brand.recipe.ts (`logoLettersContextClasses`, `logoLetterMarkContextClasses`), applied only for the sidebar context.
- **Commit:** `25f5515`

**4. [Rule 2 - Missing critical] Admin error boundaries**
- **Issue:** 02-29 left `ERROR_BOUNDARY_COPY.adminBody` for this plan.
- **Fix:** `AdminRouteErrorBoundary` shows the screen inside main and keeps the shell. `AdminRootErrorBoundary` shows it in its own light page root. Both are tested, including a failed AdminLayout chunk.
- **Commit:** `78721be`

**5. [Rule 3 - Blocking] lazyRoute moved to its own module**
- **Issue:** `admin/routes.tsx` needs `lazyRoute` and `router.tsx` needs `adminRoutes`, a circular import.
- **Fix:** `web/src/app/lazyRoute.ts`, re-exported from router.tsx, so existing imports still work.
- **Commit:** `78721be`

**6. [Rule 1 - Bug] Test timing**
- Title assertions now wait for the title effect. The first cold render in ErrorBoundary.test and AdminLayout.test may take 5 s; under the parallel full run they took just over the default 1 s (seen twice for ErrorBoundary).
- The E2E width checks wait for the sidebar's 200 ms width transition, through `page.evaluate`, because `waitForFunction` needs eval, which the CSP blocks.
- **Commits:** `25f5515`, `83c452e`

### Plan wording notes

- **E2E scroll check widths:** the check covers 767/768/1023/1024, as the plan says. 320 is excluded because the approved Topbar overflows under 398px (owner question below).
- **Scenario ids are per theme:** `admin-shell-dashboard` and `-dark`, and so on. Each case's Topbar then shows that theme's toggle icon. Boundary cases: `admin-shell-767-5(-dark)` and `admin-shell-1023-5(-dark)`.
- **Tab bar is not roving:** App. E.6 makes it a nav of plain links. rovingItem is for radio and tab lists.
- **Copy:** `Theme` lives in theme.ts as planned; AdminLayout imports it.

**Total deviations:** 6 auto-fixed (1 accessibility bug in the approved rail, 3 blocking, 1 missing critical, 1 test timing). **Impact:** no visible change outside the plan, and parity is still exact.

## Owner Decisions Pending (recorded in deferred-items.md)

1. **Admin Topbar under 398px:** the page scrolls sideways by 8px at 390 and 78px at 320. This is the approved behaviour, which I kept. The recommended fix is `min-w-0` on the search box.
2. **Preview-page empty-state wording** (SPEC-GAP): "Nothing to show here yet" / "Until this screen is built, the Component Showcase shows every shared building block."
3. **FYI:** the rail item names via `aria-labelledby` (no visible change).

## Known Stubs

- `web/src/app/admin/AdminPreviewPage.tsx`: the dev-only preview pages are placeholders by design (D-20). Phase 4 onwards replaces them with real screens.
- The Topbar "Open navigation" button has no drawer yet; 02-32 adds MobileNavDrawer.
- Logout shows a toast until Phase 4 (UI-SPEC copy).

## TDD Gate Compliance

| Task | RED | GREEN | Evidence |
|------|-----|-------|----------|
| 1 | `e0f14ba` | `78721be` | RED_EVIDENCE_OK (src/app/admin/AdminLayout.test.tsx, 13/15) |
| 2 | `c02810d` | `25f5515` | RED_EVIDENCE_OK (theme.test.ts and AdminLayout.test.tsx, 17 failing) |
| 3 | `c1de8bc` | `83c452e` | RED_EVIDENCE_OK (src/ui/navigation/Sidebar.test.tsx, 2 failing); parity RED log: axe link-name / target-size |

## Verification

- `npm --prefix web run verify` exits 0 (91 files, 2221 tests; coverage 98.44 / 96.82 / 99.8 / 99.8).
- `npm --prefix web run e2e -- --grep "@admin|@public|@smoke"`: 60 passed in five projects.
- Parity `@layouts-admin|@navigation|@brand|@layouts-public`: 90 passed in three engines. `@actions` (Chromium): 16 passed.
- Acceptance: `__DEV_ROUTES__` in router.tsx 2 (≥1), `UrlStateLayout` in routes.tsx 2 (≥1), `csps-theme` in theme.ts 1, `matchMedia(` 0, `in-data-[ui=s-admin-side]` in the two navigation recipes 12 (≥2). The 767.5 and 1023.5 cases ran and passed in Chromium, Firefox and WebKit.

## Threat Flags

None. No new network endpoint or storage beyond the planned `csps-theme` key (T-02-70); T-02-69 is mitigated by the build-output assertions.

*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-09*

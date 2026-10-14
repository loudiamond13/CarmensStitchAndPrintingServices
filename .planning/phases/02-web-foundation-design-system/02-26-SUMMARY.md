---
phase: 02-web-foundation-design-system
plan: 26
subsystem: ui
tags: [navigation, sidebar, siteheader, topbar, parity, playwright, tailwind, d-03, d-27, o-3, d-bl-02, d-01, a11y, tdd]
created: "2026-10-08T22:42:00-05:00"
updated: "2026-10-08T22:42:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-17)
    provides: "UiLink (react-router Link), Button, the parity harness settle and timeout rules"
  - phase: 02-web-foundation-design-system (plan 02-18)
    provides: "Logo, Icon; the open sidebar and header Logo context looks"
  - phase: 02-web-foundation-design-system (plan 02-19)
    provides: "Avatar; the open .csp-sidebar .csp-avatar context look"
  - phase: 02-web-foundation-design-system (plan 02-14)
    provides: "the D-27 provisional Logout paths in intentional-differences.ts"
provides:
  - "web/src/ui/navigation: Sidebar, ADMIN_NAV, AdminSection, AdminNavItem, SidebarProps; SiteHeader, SITE_LINKS, NavLinkItem, SiteHeaderProps; Topbar, TopbarProps; navItemClasses, navButtonClasses (barrel)"
  - "navItem.recipe.ts: navItemClasses({ collapsed }), navButtonClasses (D-27 button resets), navIconClasses, navLabelHiddenClasses — shared with 02-32's UserMenu items"
  - "navigation.recipe.ts: sidebar*, navTagClasses (D-BL-02), site* header looks, topbar/search/userMenu looks"
  - "Logo `context` prop ('default' | 'sidebar' | 'siteHeader'); Avatar `context` prop ('default' | 'sidebar')"
  - "Topbar menuExpanded / menuControls props for 02-31's MobileNavDrawer"
  - "8 navigation scenarios and the OpenedSiteDrawer wrapper pair"
  - "D-27 registry paths confirmed (0/0/2/1 expanded with the user chip, 0/0/2/0 collapsed); a second D-27 rulings group for WebKit's link cursor"
affects: [02-29, 02-30, 02-31, 02-32, 02-33, 02-35, parity, public-layout, admin-layout]

actuals:
  tokens: 24700    # chars/4 over the realized diff (98,844 chars, 22 files)
  tasks: 3
  commits: 6
plan_head_before: 89e9f8a31a05c8b3bc609c8f9d5c7c8aa21e8772
plan_head_after: b299837b2fe3e091356354e8c79b31fcfd6bd2cc

tech-stack:
  added: []
  patterns:
    - "Context looks for a child the component renders itself are a `context` prop on the child (Logo, Avatar), mapped to complete class lists in the child's recipe"
    - "Current state from aria-current with a named group (`group/nav`) for child state (`group-aria-[current=page]/nav:`); hover on a current-able item is guarded with `hover:not-aria-[current=page]:`"
    - "Frame-keyed App. C container rules win over App. B media rules for header and topbar display, so those become `pg-*` variants; App. B media-only values stay `md:`"
    - "A hover target that is hidden at some widths uses Playwright's `:visible` (hover/press only; focus-visible targets go through document.querySelector)"

key-files:
  created:
    - web/src/ui/navigation/navItem.recipe.ts
    - web/src/ui/navigation/navigation.recipe.ts
    - web/src/ui/navigation/Sidebar.tsx
    - web/src/ui/navigation/Sidebar.test.tsx
    - web/src/ui/navigation/SiteHeader.tsx
    - web/src/ui/navigation/SiteHeader.test.tsx
    - web/src/ui/navigation/Topbar.tsx
    - web/src/ui/navigation/Topbar.test.tsx
    - web/src/ui/navigation/index.ts
    - web/src/dev/scenarios/groups/navigation.ts
    - web/src/dev/previews/OpenedSiteDrawer.tsx
    - web/visual/reference/fragments/OpenedSiteDrawer.tsx
  modified:
    - web/src/ui/brand/Logo.tsx
    - web/src/ui/brand/brand.recipe.ts
    - web/src/ui/status/Avatar.tsx
    - web/src/ui/status/status.recipe.ts
    - web/src/ui/status/status.test.tsx
    - web/visual/intentional-differences.ts
    - web/visual/compare.test.ts
    - web/visual/reference/rulings.css
    - web/visual/reference/rulings.test.ts
    - docs/web/parity.md

key-decisions:
  - "Get a Quote stays App. D.3's <button> and goes to /contact through useNavigate unless onQuote is given; the plan said ButtonLink, but a link would change the element (button → a) with no owner ruling (D-08; spec wins over plan wording, as in 02-25)"
  - "The Sidebar collapse toggle keeps App. D.3's state-in-the-name ('Collapse sidebar' / 'Expand sidebar') and gets no aria-pressed / aria-expanded: adding one is an ARIA change outside the UI-SPEC list (D-08)"
  - "The D-27 Logout button needs appearance-none besides w-full cursor-pointer text-start to be computed-equal to the approved link"
  - "WebKit reports the approved Logout link's hand cursor as `auto`; a second D-27 rulings group states `cursor: pointer` on the reference Logout link (no visible change in any engine), instead of changing the button's real cursor or adding a normalization"
  - "The sidebar chip Avatar takes leading-4 as well as surface-3: App. B's `.csp-sidebar-user span` rule also reaches the avatar span"
  - "Topbar sticky position belongs to the admin shell (App. C `.s-admin-main > .csp-topbar`, plan 02-31), and the tablet icon rail to `data-ui=\"s-admin-side\"` (02-31)"

patterns-established:
  - "navItemClasses({ collapsed }) + navButtonClasses for any button that must look like a nav link (02-32 UserMenu items)"
  - "Pass the user role through a typed constant in scenarios and tests (L-20)"

requirements-completed: [WEB-02, WEB-05, A11Y-04]

coverage:
  - id: D1
    description: "Sidebar (both themes): App. D.3 markup and props, Manager tag on manager-only rows, user chip, collapse, D-03 current row (aria-current, primary fill, accent marker, 700), D-BL-02 tag hidden on the current row, D-27 Logout button with the nav-item look; computed-, box- and pixel-equal to the approved sidebar"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/navigation/Sidebar.test.tsx (20 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep \"@navigation|@brand|@status|@marketing\" (74 passed, chromium/firefox/webkit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SiteHeader (Blush, 320/390/820/1440): D-03 current link, no current link, O-3 italic aria-current drawer link, drawer open/close, Get a Quote to /contact; equal to the approved header"
    requirement: "WEB-05"
    verification:
      - kind: unit
        ref: "web/src/ui/navigation/SiteHeader.test.tsx (18 tests)"
        status: pass
      - kind: automated_ui
        ref: "parity @navigation site-header-* rows in three engines; mutation run (italic and hover removed) failed as expected"
        status: pass
    human_judgment: false
  - id: D3
    description: "Topbar (Blush moon / Espresso sun, every width): / shortcut, Enter to onSearch, theme toggle names, user-menu trigger, phone menu button with aria-expanded/aria-controls pass-through, D-01 16px phone search text, A.3 compat padding; equal to the approved topbar"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/navigation/Topbar.test.tsx (19 tests)"
        status: pass
      - kind: automated_ui
        ref: "parity @navigation topbar-* rows in three engines; mutation run (D-01 and kbd family removed) failed as expected"
        status: pass
    human_judgment: false
  - id: D4
    description: "Owner rulings on navigation applied and accessible: D-03, D-27, O-3, D-BL-02, FYI-01, D-01; zero axe findings in unit tests and on both parity pages"
    requirement: "A11Y-04"
    verification:
      - kind: unit
        ref: "axe cases in Sidebar/SiteHeader/Topbar tests (8 scenarios through the kit); visual/reference/rulings.test.ts (32)"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (exit 0: 74 files, 1912 tests, coverage 99.08/98.04/100/99.89)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Get a Quote stays a button that navigates (not a link), pending an owner view on whether it should become a link"
    verification: []
    human_judgment: true
    rationale: "Element choice for the public CTA is an owner look/ARIA decision (D-08); the plan asked for a link, the approved design has a button"

duration: 34min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 26: Navigation (Sidebar, SiteHeader, Topbar) Summary

**The admin Sidebar, the public SiteHeader and the admin Topbar are converted to utilities with every navigation ruling applied (D-03 bold current item, D-27 Logout button, D-31 O-3 italic drawer link, D-BL-02 hidden Manager tag, FYI-01, D-01), and all 8 navigation scenarios match the approved design in Chromium, Firefox and WebKit at every width they run, in both themes where they apply. One shared nav-item recipe serves the sidebar links, the Logout button and, next, the UserMenu items.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-10-09T03:06:34Z
- **Completed:** 2026-10-09T03:40:27Z
- **Tasks:** 3 of 3
- **Files modified:** 22 (12 created, 10 modified)

## Accomplishments

- **Nav-item recipe** (`navItem.recipe.ts`): `navItemClasses({ collapsed })` transcribes `.csp-nav`, its hover, `.is-on` with the `::before` marker and the collapsed layout. The current state comes from `aria-current="page"`, with the D-03 weight 700. Hover is guarded with `hover:not-aria-[current=page]:`, so the current row keeps its look (App. B source order). `navButtonClasses` (`w-full cursor-pointer appearance-none text-start`) turns a `<button>` into the same look (D-27).
- **Sidebar:**
  - App. D.3 markup, props and copy, with `ADMIN_NAV`.
  - The Users row shows its "Manager" tag for a manager at full opacity (FYI-01), and the tag hides on the current row through `group-aria-[current=page]/nav:hidden` (D-BL-02).
  - Logout is a `<button type="button">` (D-27, `// SPEC-DEVIATION`).
  - The collapsed layout is a TSX class map.
  - The sidebar renders its Logo, Avatar and icons with the sidebar context (nav ink, surface-3 chip avatar).
- **SiteHeader:**
  - App. D.3 markup, props and copy, with `SITE_LINKS`.
  - The current link is read from `aria-current` (D-03 bold plus the skewed underline). The phone drawer ("Mobile") marks its current link with `aria-current` and italic (O-3).
  - The header background `color-mix(in srgb, …)` and the 14px blur are copied literally.
  - Phone and desktop display rules are `pg-*` container variants. The phone tagline (8px, .12em) comes through Logo `context="siteHeader"`.
- **Topbar:**
  - App. D.3 markup, props and copy. `/` focuses the search box outside fields, Enter hands its text to `onSearch`, the theme toggle is named for what it will do (moon / sun), and the user button announces its menu.
  - The search text is 14px, and 16px on phones (D-01). The input keeps the A.3 compat padding `px-[2px] py-px`.
  - `menuExpanded` / `menuControls` are ready for 02-31's mobile drawer.
- **Scenarios and proof:** the navigation group holds 8 cases:
  - `sidebar-dashboard-current`, `sidebar-users-current` and `sidebar-collapsed` (Blush and Espresso; rest, hover and focus-visible);
  - `site-header-home`, `site-header-none-current` and `site-header-drawer-open` (Blush);
  - `topbar-light` and `topbar-dark`.

  The D-27 Logout paths from 02-14 are confirmed (`0/0/2/1`, and `0/0/2/0` when collapsed) and pinned in `compare.test.ts`.

## Task Commits

1. **Task 1 (tracer): Sidebar**
   - RED `9fc92c9`: 19 of 20 tests fail against an inert stub (`RED_EVIDENCE_OK`).
   - GREEN `14b527d`: the first Chromium run found only `appearance: button` on the Logout (fixed with `appearance-none`), then passed 12/12. `@brand|@status|@marketing` stayed 18/18 in Chromium.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran the unit verify (20/20) after the commit, with the Chromium run already green on the committed code, then started Task 2.
2. **Task 2: SiteHeader**
   - RED `0dd912e`: 15 of 18 tests fail (`RED_EVIDENCE_OK`).
   - GREEN `05f1f4c`: Chromium `@navigation` passed 14/14, including 320 and 820. A mutation run that removed the O-3 italic and the link hover failed as expected (style and pixel findings), so the header cases are really compared.
3. **Task 3: Topbar, then three engines**
   - RED `fbb8f43`: 17 of 19 tests fail (`RED_EVIDENCE_OK`).
   - GREEN `b299837`: Chromium passed 16/16. A mutation run that removed D-01 and the kbd font family failed as expected.
   - The first three-engine run failed 8 WebKit rows on one property (see deviation 3). After the fix, WebKit passed 8/8, and `@navigation|@brand|@status|@marketing` passed 74/74 in three engines. `verify` exits 0.

**Plan metadata:** recorded in the docs(02-26) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/ui/navigation/navItem.recipe.ts`: the shared nav-item recipe
- `web/src/ui/navigation/navigation.recipe.ts`: the Sidebar, SiteHeader and Topbar looks
- `web/src/ui/navigation/{Sidebar,SiteHeader,Topbar}.tsx` and their tests (20 + 18 + 19 tests)
- `web/src/ui/navigation/index.ts`: the barrel
- `web/src/dev/scenarios/groups/navigation.ts`: the 8 scenarios
- `web/src/dev/previews/OpenedSiteDrawer.tsx`, `web/visual/reference/fragments/OpenedSiteDrawer.tsx`: the wrapper pair that presses the burger once after mount
- `web/src/ui/brand/{Logo.tsx,brand.recipe.ts}`: the Logo `context` prop (root and tagline maps)
- `web/src/ui/status/{Avatar.tsx,status.recipe.ts,status.test.tsx}`: the Avatar `context` prop (+1 test)
- `web/visual/intentional-differences.ts`, `web/visual/compare.test.ts`: the confirmed D-27 paths, now pinned by path
- `web/visual/reference/rulings.css`, `rulings.test.ts`: the second D-27 group (+1 test)
- `docs/web/parity.md`: the OpenedSiteDrawer pair, `:visible` hover targets, and the D-27 paths and cursor note

## Decisions Made

See `key-decisions` in the frontmatter. Later plans need these most:

- **02-29 (public layout):** render `<SiteHeader active={label} />`. It goes to `/contact` by itself, so do not pass `onQuote` unless the action should change. The catch-all route passes a label no link has (for example `''`), so nothing is marked current.
- **02-31 (admin shell):**
  - Wrap the Sidebar in `data-ui="s-admin-side"` for the tablet rail. Add the rail rules (`.s-admin-side .csp-nav { width: 52px }` and the rest) as `pg-tablet:in-data-[ui=s-admin-side]:…` on the Sidebar parts, including `pg-tablet:in-data-[ui=s-admin-side]:hidden` on the tag.
  - Give the Topbar its sticky position from the shell (`.s-admin-main > .csp-topbar`).
  - Pass `menuExpanded` and `menuControls` for the drawer.
  - The Sidebar's nav and the tab bar are both named "Admin" (App. D.3 / UI-SPEC). axe's WCAG tags allow that, but keep it in mind for the landmark review.
- **02-32 (UserMenu):** build menu items with `clsx(navItemClasses(), navButtonClasses)`. The Topbar's user button has no `onClick` or `aria-expanded` yet. Add them as explicit props.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Logout button reported `appearance: button`**
- **Found during:** Task 1 (first Chromium run)
- **Issue:** The plan's D-27 utility list (`w-full cursor-pointer text-start`) left the browser's `appearance: button`, while the approved link reports `none`.
- **Fix:** `appearance-none` in `navButtonClasses`, the same reset the D-27 rulings rule has.
- **Files modified:** web/src/ui/navigation/navItem.recipe.ts, Sidebar.test.tsx
- **Committed in:** `14b527d`

**2. [Rule 3 - Blocking] Context looks for Logo and Avatar**
- **Found during:** Task 1 and Task 2
- **Issue:** App. B `.csp-sidebar .csp-logo` (nav ink), `.csp-sidebar .csp-avatar` (surface-3) and App. C `.csp-site-header .csp-logo-tag` (phone 8px) are context looks. Plans 02-18 and 02-19 left them to this plan. App. B `.csp-sidebar-user span` also gives the chip avatar a 16px line height.
- **Fix:** A `context` prop on Logo (`sidebar`, `siteHeader`) and on Avatar (`sidebar` = `bg-surface-3 leading-4`), mapped in their recipes. The defaults are unchanged, and the `@brand|@status` parity still passes in three engines.
- **Committed in:** `14b527d`, `05f1f4c`

**3. [Rule 3 - Blocking] WebKit reports a link's hand cursor as `auto`**
- **Found during:** Task 3 (three-engine run)
- **Issue:** All 8 WebKit rows reported only `cursor: reference auto | implementation pointer` on the D-27 Logout. WebKit's UA sheet leaves a link's hand cursor to link behaviour (computed `auto`), while the button has to state `pointer` to show the same hand. Pixels were equal, and Chromium and Firefox passed.
- **Fix:**
  - Rejected: giving the button `cursor: auto`, which would show an arrow in Safari, and a comparator normalization, which is forbidden.
  - Done: added a second D-27 group to the reference rulings layer, `.csp-sidebar-foot > a.csp-nav { cursor: pointer }`. It states the pointer the approved Logout link already shows. Nobody sees a change in any engine, and the cursor is still compared, so a button that lost its pointer would fail in all three engines.
  - Pinned in `rulings.test.ts` and documented in the rulings header and parity.md §6.
- **Files modified:** web/visual/reference/rulings.css, web/visual/reference/rulings.test.ts, docs/web/parity.md
- **Verification:** WebKit `@navigation` 8/8, then 74/74 in three engines
- **Committed in:** `b299837`

**4. [Plan wording vs D-08] "Get a Quote" stays a button**
- The plan asked for `ButtonLink` to `/contact`. That would render `<a>` where the approved header has `<button>`, an element change that is not on the UI-SPEC intentional-differences list and has no owner ruling or registry decision ID. The UI-SPEC Layout Contract only says it "navigates to /contact".
- The button keeps App. D.3's element, `onQuote` API and look. Without `onQuote` it navigates to `/contact` through `useNavigate`, and in the drawer it also closes the drawer. It is marked `// SPEC-DEVIATION: UI-SPEC Layout Contract`.
- Tests assert "takes the visitor to /contact", not "is a link". If the owner prefers a real link (middle-click, "open in new tab"), it is a one-line switch to `ButtonLink` plus a registry entry with that decision ID.

**5. [Plan wording vs D-08] No aria-pressed / aria-expanded on the collapse toggle**
- The plan's behaviour line said "aria-pressed/expanded". App. D.3 conveys the state through the changing name ("Collapse sidebar" / "Expand sidebar"). Adding a state attribute on top is an ARIA change outside the UI-SPEC list, and it would announce the state twice. The tests pin the changing name.

**6. [Plan wording] The drawer case runs at 390 and 1440**
- The matrix has no "390 only" option. `site-header-drawer-open` is non-responsive (390 and 1440). At 1440 the drawer is hidden on both sides, and the case still compares equal.

---

**Total deviations:** 3 auto-fixed (1 Rule 1, 2 Rule 3), plus 3 recorded plan-wording notes.
**Impact on plan:**
- No look, element, text or ARIA change beyond the listed rulings, and no tolerance or comparator normalization.
- The reference-side change (deviation 3) changes no look, and it keeps the cursor compared in WebKit.

## Issues Encountered

- `SiteHeader.tsx` has one uncovered branch (line 70, a React Compiler cache branch). The 02-20 note says these branches can be unreachable. Global thresholds pass: 99.08 / 98.04 / 100 / 99.89.

## TDD Gate Compliance

- Task 1: RED `9fc92c9` → GREEN `14b527d`, with `RED_EVIDENCE_OK` for `src/ui/navigation/Sidebar.test.tsx`.
- Task 2: RED `0dd912e` → GREEN `05f1f4c`, with `RED_EVIDENCE_OK` for `src/ui/navigation/SiteHeader.test.tsx`.
- Task 3: RED `fbb8f43` → GREEN `b299837`, with `RED_EVIDENCE_OK` for `src/ui/navigation/Topbar.test.tsx`.
- Written in GREEN together with their fixes: the Avatar sidebar test, the D-27 path pin in `compare.test.ts` and the second D-27 rulings test.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved.

## Look Gate (D-08 conditional checkpoint)

It did not fire. No fix changed the rendered look, the elements, the text or the ARIA structure beyond the listed rulings. Where the plan's wording would have done that (deviations 4 and 5), the approved design was kept. The Get a Quote element choice (button vs link) is left open for the owner below.

## Open for the Owner

- **Get a Quote: button or link?** Today it is the approved button, and it takes the visitor to /contact. A link would add "open in new tab" and announce as a link, with the same look. That is an element change, so it needs your ruling (D-08). No action is needed if the button is fine.

## Threat Flags

None. Logout is a button that only calls `onLogout` (T-02-58). The manager-only Users item is display only (T-02-59, accepted). `/contact` is a constant path, and no input reaches navigation.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- `@/ui/navigation` is ready for 02-29 (public layout), 02-31 (admin shell, tablet rail, mobile drawer) and 02-32 (UserMenu).
- WEB-02, WEB-05 and A11Y-04 are also declared by unfinished sibling plans. `requirements.ready-ids` reports 0 of 3 ready, so REQUIREMENTS.md is not ticked here.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 12 created files and 10 modified files exist on disk.
- Commits `9fc92c9`, `14b527d`, `0dd912e`, `05f1f4c`, `fbb8f43` and `b299837` exist on `gsd/phase-2-web-foundation-design-system`.
- Acceptance:
  - `group-aria-[current=page]/nav:hidden` in navigation.recipe.ts = 1 (at least 1 required).
  - `type="button"` in Sidebar.tsx = 4.
  - `aria-[current=page]:italic` = 1.
  - `in_srgb` = 2.
  - `px-[2px] py-px` = 1.
  - `npm --prefix web run verify` exits 0.
- Parity:
  - `@navigation|@brand|@status|@marketing`: 74 passed in three engines.
  - `@reference`: 6 passed.

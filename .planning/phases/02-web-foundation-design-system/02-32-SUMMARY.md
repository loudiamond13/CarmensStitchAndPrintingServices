---
phase: 02-web-foundation-design-system
plan: 32
subsystem: ui
tags: [react, a11y, focus-trap, wai-aria-menu, playwright, spec-gap]
created: "2026-10-09T02:56:30-05:00"
updated: "2026-10-09T02:56:30-05:00"

requires:
  - phase: 02-22
    provides: useFocusTrap, useBodyScrollLock (overlay primitives)
  - phase: 02-31
    provides: AdminFrame / AdminLayout wiring points, Topbar menuExpanded/menuControls props
  - phase: 02-26
    provides: Topbar user button look, navItemClasses + navButtonClasses
  - phase: 02-19
    provides: rovingItem (extended here with a 'menu' pattern)
provides:
  - MobileNavDrawer (SPEC-GAP phone navigation drawer, exported from @/ui/navigation)
  - UserMenu (SPEC-GAP user menu popover, rendered by the Topbar; exported from @/ui/navigation)
  - AdminFrame owns the drawer (state, inert frame) and passes onLogout to the Topbar
  - rovingItem pattern 'menu' (Down/Up wrap, Home/End)
  - UiLink role ('menuitem') and tabIndex props
  - navigation-gaps scenario group (user-menu-open, drawer-open, user-chip-long-name) + previews
  - web/e2e/admin-keyboard.spec.ts (@keyboard) and web/visual/navigation-overflow.spec.ts (@navigation @overflow)
affects: [02-33, 02-34, 02-35, phase-04-auth]

actuals:
  tokens: 20200
  tasks: 2
  commits: 4
plan_head_before: 483fba07e88aba8d20eeaaea4cf52795e78655c4
plan_head_after: f4bd16a1b02885b720d6fc13b3c71badb0cf59c2

tech-stack:
  added: []
  patterns:
    - "A drawer closes on a followed link from a document click listener (after React's root listener), never from a listener on the panel"
    - "Overlay focus returns to the element whose aria-controls names it (looked up on close; Safari does not focus clicked buttons)"
    - "The background frame is inert while a modal drawer is open"
    - "A menu-button component renders trigger + popover as siblings (no wrapper), with the sticky Topbar as containing block"

key-files:
  created:
    - web/src/ui/navigation/MobileNavDrawer.tsx
    - web/src/ui/navigation/MobileNavDrawer.test.tsx
    - web/src/ui/navigation/UserMenu.tsx
    - web/src/ui/navigation/UserMenu.test.tsx
    - web/e2e/admin-keyboard.spec.ts
    - web/visual/navigation-overflow.spec.ts
    - web/src/dev/scenarios/groups/navigation-gaps.ts
    - web/src/dev/previews/OpenedUserMenu.tsx
    - web/src/dev/previews/OpenedNavDrawer.tsx
    - web/src/dev/previews/LongUserName.tsx
  modified:
    - web/src/ui/navigation/index.ts
    - web/src/ui/navigation/navigation.recipe.ts
    - web/src/ui/navigation/Topbar.tsx
    - web/src/app/admin/AdminLayout.tsx
    - web/src/app/admin/AdminLayout.test.tsx
    - web/src/ui/actions/UiLink.tsx
    - web/src/ui/actions/links.test.tsx
    - web/src/ui/choice/roving.ts
    - web/src/ui/choice/Tabs.test.tsx

key-decisions:
  - "MobileNavDrawer closes on a followed link through a document-level click listener, so React Router handles the click first; closing from a panel listener unmounted the link before React dispatched its click and the browser reloaded the page (found by E2E in Chromium and WebKit)."
  - "Drawer focus returns to the element whose aria-controls names the drawer (looked up on close): Safari/WebKit does not focus a clicked button, so the trap's remembered trigger was the body."
  - "AdminFrame owns the drawer state; the frame is inert while the drawer is open, and the drawer holds a second Sidebar for the current section."
  - "UserMenu renders App. D.3's user button unchanged plus the popover as a sibling (no wrapper), so the Topbar and AdminShell parity pairs are unchanged; the sticky Topbar is the popover's containing block."
  - "Implementation-only navigation cases live in their own group file navigation-gaps.ts (not navigation.ts), per the 02-30 rule that compared and impl-only cases must not share a page."

patterns-established:
  - "SPEC-GAP overlay close-on-navigation: listen on document (bubble) for clicks inside the panel on a[href]"
  - "Menu keyboard: rovingItem(items, index, key, 'menu') with a roving tabIndex -1 on every menuitem"

requirements-completed: [WEB-05, A11Y-02]

coverage:
  - id: D1
    description: "Phone navigation drawer: opens from the Topbar menu button (aria-expanded/aria-controls), modal dialog named Navigation with the full Sidebar, focus trapped, closes on Esc/scrim/followed link with focus back on the menu button, body scroll class, frame inert"
    requirement: WEB-05
    verification:
      - kind: unit
        ref: "web/src/ui/navigation/MobileNavDrawer.test.tsx (15 tests)"
        status: pass
      - kind: integration
        ref: "web/src/app/admin/AdminLayout.test.tsx#AdminLayout phone navigation drawer (5 tests)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @keyboard (drawer journeys, 3 tests x 5 projects at 390px)"
        status: pass
    human_judgment: false
  - id: D2
    description: "User menu: aria-haspopup button with aria-expanded opens a role=menu popover (surface-3, radius 12, shadow-2, min 200px) with My Profile and Logout; arrows wrap, Home/End jump, Esc returns focus, Tab and outside press close"
    requirement: A11Y-02
    verification:
      - kind: unit
        ref: "web/src/ui/navigation/UserMenu.test.tsx (22 tests)"
        status: pass
      - kind: integration
        ref: "web/src/app/admin/AdminLayout.test.tsx#AdminLayout user menu (3 tests)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep \"@keyboard|@admin\" (60 passed, five projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "40-character user name wraps inside the sidebar chip and adds no width to the phone Topbar button at 320 and 390px"
    requirement: WEB-05
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @overflow (web/visual/navigation-overflow.spec.ts, 2 widths x 3 engines)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Look of the drawer and the user menu popover (SPEC-GAP, no reference) in both themes"
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep \"@navigation|@layouts-admin\" (navigation-gaps rows: axe, CSP, console guard)"
        status: pass
    human_judgment: true
    rationale: "SPEC-GAP primitives have no approved reference; the owner reviews their look in the D-23 screenshots."

duration: 32min
completed: 2026-10-09
status: complete
---

# Phase 2 Plan 32: Phone Navigation Drawer and User Menu Summary

**The admin shell's phone navigation drawer (a focus-trapped modal Sidebar opened from "Open navigation") and the Topbar user menu (WAI-ARIA menu button with My Profile and Logout), both fully keyboard-operable in all five Playwright projects.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-10-09T07:24:14Z
- **Completed:** 2026-10-09T07:56:13Z
- **Tasks:** 2 (tracer + expansion), TDD RED → GREEN each
- **Files modified:** 19

## Accomplishments

- `MobileNavDrawer` (`// SPEC-GAP: mobile nav drawer`): the full Sidebar as a 248px left panel over `bg-scrim` at `z-(--z-overlay)`, inside the page root; `role="dialog"`, modal, named "Navigation"; `useFocusTrap`; closes on Esc, a scrim click or a followed link; focus back on the menu button; the body scroll class while open. The panel sticks to the viewport top at the viewport height, so the whole Sidebar shows however far the page was scrolled.
- `AdminFrame` now owns the drawer: Topbar `onMenu` / `menuExpanded` / `menuControls`, a second Sidebar for the current section in the drawer, and the frame `inert` while the drawer is open.
- `UserMenu` (`// SPEC-GAP: user menu`): App. D.3's user button, unchanged, now with `aria-expanded` (and `aria-controls` while open), plus a `role="menu"` popover labelled by the button with "My Profile" (`user-round`, → `/admin/profile`) and "Logout" (`log-out`, → `onLogout`) in the nav-item look. Enter/Space/ArrowDown open on the first item, ArrowUp on the last; ArrowDown/ArrowUp wrap, Home/End jump; Esc returns focus; Tab closes and moves on; a press outside closes. The Topbar renders it (new `onLogout` prop), and the shell shows the dev "Not available yet" toast.
- Keyboard E2E (`web/e2e/admin-keyboard.spec.ts`, `@keyboard @admin`): the drawer opens by keyboard, 20 Tabs and 5 Shift+Tabs stay inside and come back round, Esc returns to the button, a followed link navigates in the app (same document) and closes, a tap on the scrim closes; the user menu's arrows, Home/End, Esc and keyboard Logout/My Profile. Axe runs with each overlay open. 60/60 pass in chromium, firefox, webkit, pixel and iphone.
- Long-name backstop: the `user-chip-long-name` case (40 characters) and `web/visual/navigation-overflow.spec.ts` show the name wraps inside the sidebar chip and adds no width to the phone Topbar button at 320 and 390px in three engines.

## Task Commits

1. **Task 1 (tracer): phone navigation drawer**
   - `3393e07` test(02-32): add failing tests for the phone navigation drawer (RED_EVIDENCE_OK: 16 fail on assertions)
   - `ee50e04` feat(02-32): open the admin navigation drawer from the phone menu button
   - Tracer gate: re-ran `<verify>` (15/15 unit, 15/15 E2E in five projects) before expanding.
2. **Task 2: user menu, scenarios, long-name check**
   - `0ddec4d` test(02-32): add failing tests for the user menu (RED_EVIDENCE_OK: 26 fail on assertions)
   - `f4bd16a` feat(02-32): add the Topbar user menu with the menu keyboard pattern

No REFACTOR commits were needed.

## Files Created/Modified

- `web/src/ui/navigation/MobileNavDrawer.tsx` (+ test): the drawer.
- `web/src/ui/navigation/UserMenu.tsx` (+ test): the user button and the menu popover; exports `PROFILE_PATH`.
- `web/src/ui/navigation/navigation.recipe.ts`: `drawerClasses`, `drawerPanelClasses`, `userMenuPopoverClasses` (existing tokens only).
- `web/src/ui/navigation/Topbar.tsx`: renders `UserMenu`; new `onLogout` prop (marked SPEC-DEVIATION).
- `web/src/ui/navigation/index.ts`: exports `MobileNavDrawer`, `UserMenu` and their props types.
- `web/src/app/admin/AdminLayout.tsx` (+ test): drawer state, inert frame, Topbar wiring, Logout to the user menu.
- `web/src/ui/choice/roving.ts` (+ Tabs.test): the `'menu'` pattern.
- `web/src/ui/actions/UiLink.tsx` (+ links.test): `role` and `tabIndex` props.
- `web/src/dev/scenarios/groups/navigation-gaps.ts`, `web/src/dev/previews/{OpenedUserMenu,OpenedNavDrawer,LongUserName}.tsx`: implementation-only scenarios.
- `web/e2e/admin-keyboard.spec.ts`, `web/visual/navigation-overflow.spec.ts`: keyboard journeys and the long-name measurement.

## Decisions Made

See `key-decisions` in the frontmatter. In short: the close-on-navigation listener sits on the document so the router handles the click first; focus returns to the drawer's `aria-controls` owner; AdminFrame owns the drawer and makes the frame inert; UserMenu adds no wrapper element, so both parity pairs (Topbar, AdminShell) are unchanged; the impl-only cases have their own group file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A followed drawer link reloaded the whole page**
- **Found during:** Task 1 (first E2E run: Chromium, WebKit and the phone projects failed the focus-return check)
- **Issue:** The panel's own click listener closed the drawer before React's root listener ran, so the link was unmounted before React Router could handle the click, and the browser followed the href as a full page load (focus was lost with the old document).
- **Fix:** The link close is read from a document-level click listener (after React's root listener). The E2E now also checks the navigation stays in the same document.
- **Files modified:** web/src/ui/navigation/MobileNavDrawer.tsx, web/e2e/admin-keyboard.spec.ts
- **Verification:** `npm --prefix web run e2e -- --grep @keyboard` 15/15
- **Committed in:** ee50e04

**2. [Rule 1 - Bug] WebKit returned focus to the body after a tap-opened drawer closed**
- **Found during:** Task 1 (scrim test in webkit/iphone)
- **Issue:** Safari does not focus a clicked button, so the focus trap's remembered trigger was the body.
- **Fix:** On close, the drawer focuses the element whose `aria-controls` names it (fallback: the trap's own return). Unit tests cover both paths.
- **Files modified:** web/src/ui/navigation/MobileNavDrawer.tsx, MobileNavDrawer.test.tsx
- **Committed in:** ee50e04

**3. [Rule 2 - Missing critical] Background frame made inert while the drawer is open**
- **Found during:** Task 1
- **Issue:** `aria-modal` alone does not keep the keyboard or assistive technology out of the page under the scrim.
- **Fix:** `AdminFrame` sets `inert` on the frame while the drawer is open (tested in AdminLayout.test).
- **Committed in:** ee50e04

**4. [Rule 3 - Blocking] Small primitive extensions the menu needed**
- **Found during:** Task 2
- **Issue:** `rovingItem` had no vertical menu pattern, and `UiLink` (explicit props, L-13) could not carry `role="menuitem"` / `tabIndex`.
- **Fix:** Added the `'menu'` pattern (Down/Up wrap, Home/End; side arrows ignored) and the two UiLink props, each with tests.
- **Files modified:** web/src/ui/choice/roving.ts, web/src/ui/actions/UiLink.tsx (+ tests)
- **Committed in:** f4bd16a

**5. [Plan file list] Scenarios in a new group file, plus an overflow spec**
- **Found during:** Task 2
- **Issue:** The plan lists `navigation.ts` for the three scenarios, but plan 02-30 found that compared and implementation-only cases on one page cause anti-aliasing noise in the compared frames. The long-name truth names "the Playwright overflow test", which did not exist for these surfaces.
- **Fix:** The scenarios live in `navigation-gaps.ts` (`--grep @navigation` still runs both groups); `web/visual/navigation-overflow.spec.ts` measures the long name at 320/390.
- **Committed in:** f4bd16a

---

**Total deviations:** 5 (2 bugs, 1 missing critical, 1 blocking, 1 file-list adjustment). **Impact:** all needed for correct keyboard/AT behaviour or to keep the parity suite stable; no scope creep, no package changes.

## Issues Encountered

- Python edits on Windows wrote CRLF into a few working-copy files; the whole web tree's working copy was normalised to LF (matching `.gitattributes` `web/** text eol=lf`). Git showed no content change; committed blobs are LF.
- The overflow spec's first version picked the Logo (also `role="img"`) instead of the chip avatar; fixed to start from the name before the passing run.

## Known limits (not stubs)

- The "phones only" drawer opens only from the phone-only menu button; if the page is widened past 767px while it is open, it stays open until closed (Esc, scrim, link). Closing it on a resize can come later if wanted.
- The long-name check covers names with spaces (real names). A single unbroken 40-character token would run past the sidebar chip: the chip text has no `min-w-0` / `wrap-anywhere`, and adding them would change the approved Sidebar's computed styles (parity), so it was not done silently.
- Below 398px the approved Topbar row is still wider than the page (owner item from plan 02-31, unchanged). There the user menu popover lines up with the bar's right padding rather than exactly under the partly off-screen button.

## Next Phase Readiness

- 02-33 (budgets): the admin route chunk now also carries MobileNavDrawer and UserMenu; production entry 121.98 KB gz (verify build).
- 02-34 (showcase): new impl-only cases `user-menu-open`, `drawer-open` (viewport frame) and `user-chip-long-name`; previews open their overlays once after mount.
- 02-35 (keyboard journeys): `web/e2e/admin-keyboard.spec.ts` covers the drawer and the user menu in all five projects; the frame is inert while the drawer is open.
- Phase 4: replace the dev Logout toast through `AdminFrame`'s `onLogout` (now used by the Sidebar, the drawer's Sidebar and the user menu).

## Verification

- `npm --prefix web run verify`: exit 0 (typecheck, lint, format, 2268 tests with coverage, build, license, notices).
- `npm --prefix web run e2e -- --grep "@keyboard|@admin"`: 60 passed (five projects), after the preflight.
- `npm --prefix web run parity -- --grep "@navigation|@layouts-admin"`: 74 parity rows passed in three engines; `--grep @overflow`: 15 passed.
- Acceptance: `grep -c "aria-modal" MobileNavDrawer.tsx` = 1; `grep -c "SPEC-GAP" MobileNavDrawer.tsx` = 2; `grep -c 'role="menu"' UserMenu.tsx` = 1; `grep -c navItemClasses UserMenu.tsx` = 3.

## TDD Gate Compliance

RED `3393e07` → GREEN `ee50e04` (Task 1); RED `0ddec4d` → GREEN `f4bd16a` (Task 2). Both RED records verified `RED_EVIDENCE_OK` by `gsd-tools check tdd-red-evidence`.

## Self-Check: PASSED

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-09*

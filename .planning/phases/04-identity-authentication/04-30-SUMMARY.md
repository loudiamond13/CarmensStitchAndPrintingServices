---
phase: 04-identity-authentication
plan: 30
subsystem: auth
tags: [web, user-menu, sign-out-others, inert, modal, a11y, session-cap-warning, multi-tab, e2e, playwright, auth-05, auth-06, d-04, d-05, d-43, d-44, r2-10, oq-3, oq-4]
status: complete
created: "2026-10-15T06:50:00-05:00"
updated: "2026-10-15T06:50:00-05:00"

requires: ["04-29", "04-25", "04-26"]
provides:
  - "components/navigation/UserMenu.tsx: devicesPath and onSignOutOthers props; the items 'Signed-in Devices' (shield-check link) and 'Sign Out Other Devices' (lock button) render only when their prop is given, between My Profile and Logout; Topbar and AdminFrame pass both through"
  - "layouts/AdminLayout.tsx: AdminShell passes /admin/sessions, opens SignOutOthersDialog from the menu, calls useSessionCapWarning"
  - "components/overlays/useInertOutside.ts (exported from the overlays barrel): everything outside the newest open dialog is inert except the toast layer; Modal calls it (R2-10)"
  - "modules/admin/hooks/useSessionCapWarning.ts: persistent warning toast 5 minutes before the 12-hour cap of a browser session (OQ-4)"
  - "utils/format.ts formatBusinessTime ('3:42 PM' in Asia/Manila, null for bad input)"
  - "e2e/session-menu.spec.ts (@session-menu, five projects), e2e/auth-multitab.spec.ts (@auth-multitab, three desktop engines), admin-keyboard.spec.ts user-menu and sign-out-dialog journeys"
affects: [04-31, 04-32]

requirements-completed: []

actuals:
  tokens: 60000
  tasks: 3
  commits: 6
plan_head_before: fba58047c9a93be7574eeac35e4f6b6860f8aa13
plan_head_after: 195767202d7865919f271b420c4a9197ae214a7b

tech-stack:
  added: []
  patterns:
    - "Inert page behind a dialog as a recompute-from-the-top stack: only the newest open dialog decides, the set of inert elements is rebuilt on every open and close, and an element that was inert for another reason is never owned"
    - "Hook order for focus return: useInertOutside applies in a passive effect declared after useFocusTrap (the trap captures its trigger first) and releases in a layout-effect cleanup (runs before the trap's passive cleanup, so the trigger can take focus again)"
    - "A menu item that opens a dialog calls its handler first and the menu then focuses its own button, so the dialog's focus trap takes the button as its return target"

key-files:
  created:
    - web/src/components/overlays/useInertOutside.ts
    - web/src/components/overlays/useInertOutside.test.tsx
    - web/src/modules/admin/hooks/useSessionCapWarning.ts
    - web/src/modules/admin/hooks/useSessionCapWarning.test.tsx
    - web/e2e/session-menu.spec.ts
    - web/e2e/auth-multitab.spec.ts
  modified:
    - web/src/components/navigation/UserMenu.tsx
    - web/src/components/navigation/UserMenu.test.tsx
    - web/src/components/navigation/Topbar.tsx
    - web/src/layouts/AdminLayout.tsx
    - web/src/layouts/AdminLayout.test.tsx
    - web/src/components/overlays/Modal.tsx
    - web/src/components/overlays/Modal.test.tsx
    - web/src/components/overlays/index.ts
    - web/src/utils/format.ts
    - web/src/utils/format.test.ts
    - web/e2e/keyboard.spec.ts
    - web/e2e/admin-keyboard.spec.ts
    - web/playwright.config.ts
    - docs/web/e2e.md
    - .planning/phases/02-web-foundation-design-system/deferred-items.md

key-decisions:
  - "The session items in the shared UserMenu use literal labels ('Signed-in Devices', 'Sign Out Other Devices') like 'My Profile' and 'Logout', not AUTH_COPY: components/ does not import from modules/, and the labels equal AUTH_COPY.menu"
  - "Only the newest open dialog decides what is inert: opening a second dialog makes the first one inert too (it is outside the second), and closing the second restores the first"
  - "An inline Modal (a static mock-up inside an Overlay region, used by the showcase) does not make the page inert, so the showcase and its parity cases are unchanged"
  - "The cap warning is a 'warning' tone toast, which the toast queue already keeps until closed (D-04, D-31 O-7), so no new persistent option was added"
  - "A timer that fires after the cap has passed (a laptop that slept) shows nothing"

patterns-established:
  - "Page-level axe with a dialog open is the rule again (the 02-35 dialog-scoped workaround is gone)"

coverage:
  - id: C1
    description: "D-04, D-43, OQ-3: the admin user menu lists 'My Profile', 'Signed-in Devices' (shield-check, link to /admin/sessions), 'Sign Out Other Devices' (lock, opens the confirm dialog) and 'Logout', with arrow, Home, End and Esc over all four; the Phase 2 menu without the props keeps two items"
    requirement: "AUTH-06"
    verification:
      - "UserMenu.test.tsx 'UserMenu session items' (8 tests) and AdminLayout.test.tsx 'AdminLayout user menu' (3 new tests)"
      - "e2e/session-menu.spec.ts and e2e/admin-keyboard.spec.ts pass in chromium, firefox, webkit, pixel and iphone"
  - id: C2
    description: "D-05, D-44: 'Sign Out Other Devices' from the menu signs a second browser context out (it lands on sign-in) while this one stays signed in, focus returns to the menu button, and the same toast shows when nothing else was signed in"
    requirement: "AUTH-06"
    verification:
      - "e2e/session-menu.spec.ts @session-menu in five projects, with page-level axe clean while the dialog is open"
  - id: C3
    description: "R2-10: while a Modal (so every ConfirmDialog and both sign-out dialogs) is open, everything outside it is inert except the toast layer; closing restores exactly the previous state; nested dialogs work; page-level axe with a dialog open is clean on phones"
    requirement: "AUTH-06"
    verification:
      - "useInertOutside.test.tsx (10 tests), Modal.test.tsx 'Modal makes the page behind it inert' (4 tests)"
      - "e2e/keyboard.spec.ts now runs page-level axe with Add Payment, Add User and both ConfirmDialogs open in all five projects; @showcase, @dialog-fit, @a11y-rulings and the @overlays parity rows pass"
  - id: C4
    description: "OQ-4: a browser-session sign-in gets a persistent warning toast 5 minutes before the 12-hour cap ('Your session ends soon' / 'You'll be signed out at 3:42 PM. Save your work, then sign in again.' in business time); a 90-day session never does"
    requirement: "AUTH-05"
    verification:
      - "useSessionCapWarning.test.tsx (8 tests, fake timers) and format.test.ts formatBusinessTime"
    human_judgment: true
    rationale: "The toast is proven by unit tests with a fake clock; no E2E waits 11 hours 55 minutes, and how the warning looks beside other toasts is a visual call for the 04-32 review"
  - id: C5
    description: "AUTH-06 multi-tab: two tabs reloading at the same moment both stay signed in; a sign-out in one sends the other to sign-in with 'Your session ended. Sign in again.' without a reload; no BroadcastChannel message carries a token or the email"
    requirement: "AUTH-06"
    verification:
      - "e2e/auth-multitab.spec.ts @auth-multitab passes in chromium, firefox and webkit"
---

# Phase 4 Plan 30: Session Controls in the Admin Shell Summary

The admin user menu now offers "Signed-in Devices" and "Sign Out Other Devices", every dialog makes the page behind it inert, browser sessions get a warning toast 5 minutes before the 12-hour cap, and two tabs of one browser are proven to share one session.

## What was built

- **Tracer (Task 1):** `UserMenu` gained `devicesPath` and `onSignOutOthers`; each item renders only when its prop is given, so the Phase 2 showcase keeps its two-item menu. `Topbar` and `AdminFrame` pass the props through, and `AdminShell` opens `SignOutOthersDialog` (built in 04-29) from the menu. The menu focuses its own button before the dialog mounts, so the focus trap returns focus to the menu button on close. `@session-menu` runs in all five projects: two browser contexts, the four items in order, Esc, the dialog with "Keep Others Signed In" focused, the toast, the other browser sent to sign in, the same flow again with nothing else signed in, and the devices item opening `/admin/sessions`.
- **R2-10 (Task 2):** `useInertOutside` marks every sibling along the path from the newest open dialog up to the body as `inert` (the toast layer stays live; script, style and similar elements are skipped) and rebuilds that set on every open and close. `Modal` calls it right after `useFocusTrap`. The Phase 2 deferred item is marked resolved.
- **OQ-4 and AUTH-06 (Task 3):** `formatBusinessTime`, `useSessionCapWarning` (called by `AdminShell`) and `@auth-multitab`.

Tracer gate: interactive mode, `human_verify_mode` end-of-phase, automated-only `<verify>`. The `@session-menu` E2E (five projects), the component tests, lint, typecheck and format were re-run after GREEN and passed before the expansion tasks began.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | Sign Out Other Devices from the user menu | 7520ca2 (RED), f8b1446 |
| 2 | The page behind any open dialog becomes inert (R2-10) | 7318101 (RED), aea9ddc |
| 3 | The 12-hour cap warning and the two-tab proof | 2e7453f (RED), 1957672 |

## Verification

- `npm --prefix web run verify` passes: typecheck, lint with zero warnings, format, `test:coverage` (all files 97.41% statements, 94.66% branches, 98.88% functions, 99.62% lines), production build, budget build (public 134.26 KB, admin 172.09 KB, CSS 13.54 KB gzip), license gate, notices check.
- Full unit run before Task 3: 136 files, 3605 tests passed. New in this plan: 8 UserMenu, 3 AdminLayout, 10 useInertOutside, 4 Modal, 8 useSessionCapWarning, 13 formatBusinessTime.
- E2E: `@keyboard|@dialog-fit|@showcase|@a11y-rulings|@session-menu` 416 passed (one firefox navigation timeout in `@a11y-rulings` during a concurrent unit run, passed on rerun), `@auth-multitab` 3 of 3, `@sessions` 5 of 5 (one chromium sign-in failure in a parallel run, "The verify answer carried no signed-in user", passed on rerun), `--grep "@overlays|@selftest"` parity 21 of 21 with no style, box or pixel difference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The scoped axe workaround lives in keyboard.spec.ts, not admin-keyboard.spec.ts**
- **Found during:** Task 2
- **Issue:** The plan says to unscope the dialog-only axe run in `admin-keyboard.spec.ts`; the run is in `web/e2e/keyboard.spec.ts` (the showcase journeys), and `admin-keyboard.spec.ts` had no dialog journey.
- **Fix:** `keyboard.spec.ts` now runs page-level axe with each dialog open. `admin-keyboard.spec.ts` gained a journey for "Sign Out Other Devices" (phone-wide page, dialog open, shell inert, page-level axe, Esc back to the menu button) and its user-menu journey walks all four items.
- **Commits:** 7318101, aea9ddc

**2. [Rule 1 - Bug in the plan's E2E assumption] The sign-out notice needs a request, not a reload**
- **Found during:** Task 1
- **Issue:** The plan says the second browser "reloads" and sees "Your session ended". A reload boots from the cookie, gets a 401 and shows plain sign-in; the notice lives in memory and is set only by a 401 or a channel message in a running tab. Also, `/admin/profile` and the other dev preview pages in the e2e bundle are not guarded, so a menu action there runs without a session in memory.
- **Fix:** `@session-menu` asserts the other browser lands on the sign-in page at its next visit (as `@sessions` does); the notice itself is proven in `@auth-multitab`, where a running tab receives the sign-out message. The menu flow runs on the landing page (in-memory session) and then on the guarded `/admin/sessions`.
- **Commit:** f8b1446

**3. [Rule 3 - Blocking] auth-multitab joins the desktop-engines-only list in playwright.config.ts**
- **Found during:** Task 3
- **Issue:** The plan lists `@auth-multitab` for chromium, firefox and webkit only; the config needs the spec added to a project exclusion list for the phone projects to skip it.
- **Fix:** added to `desktopEnginesOnly` beside `auth-cookies.spec.ts` (precedent from 04-27).
- **Commit:** 2e7453f

**Total deviations:** 3 auto-fixed (1 plan file mismatch, 1 plan assumption, 1 config). **Impact:** none on scope or behaviour.

## Decisions for the owner

- **Inline dialogs stay live.** The showcase renders ConfirmDialogs "inline" inside an Overlay region as static mock-ups. Making those inert would freeze the whole showcase page, so `Modal` skips the inert step for `inline`. Real dialogs (every admin screen) are inert behind. Say if you want the showcase to behave the same.
- **Warning toast closes only by hand.** The cap warning is a warning-tone toast, which stays until closed (existing D-04 rule). If it should also disappear when the person signs in again, that is a small follow-up.
- **Cap warning only fires in a running tab.** A tab that slept through the warning time shows nothing on wake, because the cap may already have passed. The next request after the cap ends the session and shows the usual "Your session ended" notice.

## Known Stubs

None.

## Threat Flags

None. T-04-102 (tokens on the channel) is checked by the `@auth-multitab` listener, which asserts no message contains "eyJ", the email or the word token; T-04-103 (actions behind an open dialog) is mitigated by `useInertOutside` plus the focus trap.

## Issues Encountered

Two intermittent E2E failures under load (a firefox page load timing out at 30 s while unit tests ran beside it, and one chromium sign-in whose verify answer had no user in a four-worker run); both passed on rerun. The second is worth watching: if it recurs, check the sign-in rate limit against parallel workers.

## Self-Check: PASSED

- Created files exist: useInertOutside.ts and its test, useSessionCapWarning.ts and its test, session-menu.spec.ts, auth-multitab.spec.ts.
- Commits 7520ca2, f8b1446, 7318101, aea9ddc, 2e7453f, 1957672 are on branch gsd/phase-04-identity-authentication.
- Acceptance greps: onSignOutOthers 8, devicesPath 8, `/admin/sessions` in AdminLayout 1, useInertOutside in Modal 4, `SPEC-DEVIATION: R2-10` in Modal 1, formatBusinessTime in format.ts 1, useSessionCapWarning in AdminLayout 2.

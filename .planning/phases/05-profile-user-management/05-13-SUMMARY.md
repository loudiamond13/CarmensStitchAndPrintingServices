---
phase: 05-profile-user-management
plan: 13
subsystem: ui
tags: [react, react-hook-form, zod, nuqs, tabs, optimistic-concurrency, conflict-banner, theme, playwright, tdd]
created: "2026-10-17T23:58:00-05:00"
updated: "2026-10-17T23:58:00-05:00"

requires:
  - phase: 05-profile-user-management
    provides: "05-03: guarded admin routes and fail-closed session role; 05-08: user menu and dialog motion; 05-09: GET/PUT /api/v1/profile with the EditVersion (409 edit.stale)"
provides:
  - "/admin/profile (ProfileRoute): the E.13 header card and the D-23 tabs Details, Security and Appearance, with the URL tab parameter"
  - "Personal Information name save with the loaded edit version, the zod mirror of the server validator, and the session refresh that updates the sidebar chip and top bar"
  - "ConflictBanner (shared D-20 stale-save banner in @/components states) and the Load Latest flow"
  - "useThemeState / useAdminTheme: one admin theme state shared by the top bar toggle and the Appearance tab through the layout Outlet context"
  - "profileService, useProfileQuery, useProfileTab, profileKey, profileNameSchema, profileCopy, profile.recipe"
affects: [05-18 password and email cards on the Security and Details tabs, 05-25 Edit User panel (reuses ConflictBanner), 05-20 users page (its dev preview shadows the real page the same way), 05-37 screen review]

actuals:
  tokens: 49000
  tasks: 3
  commits: 6
plan_head_before: 65ff41f4cad0e387c3fc5022222a4235bf57d55a
plan_head_after: c435e9458895ac79cf3e2e7362602bfceb8529f3

tech-stack:
  added: []
  patterns:
    - "A form that carries a row version keeps the version it was opened with (component state), never the live query data, so a refetch cannot silently turn a stale save into a good one"
    - "createListParams with one literal parser gives a single URL tab with the invalid-value replace, instead of hand-rolled useQueryState"
    - "All tab panels stay mounted and hidden, so typed form values survive a tab change"
    - "The layout owns shared page state (useThemeState) and hands it to pages through the Outlet context; UrlStateLayout forwards the context"

key-files:
  created:
    - web/src/modules/admin/pages/ProfilePage.tsx
    - web/src/modules/admin/services/profileService.ts
    - web/src/modules/admin/hooks/useProfileQuery.ts
    - web/src/modules/admin/hooks/useProfileTab.ts
    - web/src/modules/admin/hooks/useAdminTheme.ts
    - web/src/modules/admin/profileCopy.ts
    - web/src/modules/admin/profileSchemas.ts
    - web/src/modules/admin/components/profile.recipe.ts
    - web/src/components/states/ConflictBanner.tsx
    - web/e2e/profile.spec.ts
  modified:
    - web/src/modules/admin/routes.tsx
    - web/src/layouts/AdminLayout.tsx
    - web/src/lib/url-state/UrlStateLayout.tsx
    - web/src/lib/query/keys.ts
    - web/src/components/states/copy.ts
    - web/src/components/states/index.ts
    - web/src/components/status/status.recipe.ts
    - web/e2e/admin.spec.ts
    - web/e2e/sweep.ts
    - web/e2e/admin-keyboard.spec.ts

key-decisions:
  - "The name form sends the version it was opened with; Load Latest and a successful save are the only things that change it (D-20)"
  - "The tab is read with createListParams (literal parser, default details, replace) rather than a bare useQueryState, so an invalid value is removed with one replace by the shared code"
  - "All three tab panels stay mounted and the inactive ones are hidden, so a typed but unsaved name is not lost by changing tab"
  - "zod's max() counts code points but the server counts UTF-16 units, so the length rule is a refine on string length"
  - "The profile dev preview was removed from devRoutes because it shadowed the real page in the e2e bundle; the two review scripts that screenshot it are deferred to 05-37"

patterns-established:
  - "ConflictBanner is shown from the first 409 edit.stale, remounts (and so re-focuses Load Latest) on each further one, and never clears the form itself"
  - "A visually hidden polite status div beside a control announces only real changes, and ends its announcement when the state changes elsewhere"

requirements-completed: [PROF-01, PROF-04, SEC-07]

coverage:
  - id: D1
    description: "/admin/profile shows the E.13 header (avatar ring, name, role badge, email and member-since date) and the Details, Security and Appearance tabs with the WAI-ARIA keyboard behaviour; the active tab is the URL tab parameter, an invalid value falls back to Details with one replace"
    requirement: PROF-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ProfilePage.test.tsx#P1 the header and P1 the tabs (D-23)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useProfileTab.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/profile.spec.ts#@profile the tabs follow the URL and the keyboard (chromium, firefox, webkit, pixel, iphone)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Personal Information card saves first and last name with Save Changes (Saving while pending), trims, validates in the browser first (OR-3, UTF-16 length), lets server field errors win, toasts Changes saved, and refreshes the session so the sidebar chip, top bar and header show the new name"
    requirement: PROF-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ProfilePage.test.tsx#P1 Details: Personal Information and P1 the shell learns the new name"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/profileSchemas.test.ts and web/src/modules/admin/services/profileService.test.ts"
        status: pass
      - kind: unit
        ref: "web/src/layouts/AdminLayout.test.tsx#AdminLayout session user (PROF-01)"
        status: pass
      - kind: e2e
        ref: "web/e2e/profile.spec.ts#@profile renaming saves, and the sidebar, the top bar and the header show the new name"
        status: pass
    human_judgment: false
  - id: D3
    description: "A 409 edit.stale keeps every typed value behind the shared ConflictBanner with focus on Load Latest; Load Latest fetches the current profile, replaces values and version, removes the banner, focuses First name and announces it politely; the next save sends the new version; a profile changed elsewhere reaches the header but never overwrites the open form"
    requirement: SEC-07
    verification:
      - kind: unit
        ref: "web/src/components/states/ConflictBanner.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/ProfilePage.test.tsx#P1 stale save (D-20, SEC-07)"
        status: pass
      - kind: e2e
        ref: "web/e2e/profile.spec.ts#@profile a stale save keeps what was typed behind the conflict banner (two pages, five projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Appearance tab Theme control (Blush light, Espresso dark) applies at once, saves csps-theme in this browser only, announces only a real change, stays in step with the top bar toggle through one layout state, survives a reload and a second tab, never reaches the server, and leaves the public site light"
    requirement: PROF-04
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ProfilePage.test.tsx#P1 Appearance: Theme (PROF-04, D-22)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useAdminTheme.test.tsx and web/src/layouts/AdminLayout.test.tsx#AdminLayout theme context for pages"
        status: pass
      - kind: e2e
        ref: "web/e2e/profile.spec.ts#@profile Espresso from the Appearance tab sticks on this browser, and the public site stays light"
        status: pass
    human_judgment: false
  - id: D5
    description: "Loading shows header and card skeletons with Loading your profile... to Profile loaded.; a failed load shows Couldn't load your profile. with Try Again"
    requirement: PROF-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ProfilePage.test.tsx#P1 loading and failure"
        status: pass
    human_judgment: false
  - id: D6
    description: "The page looks like App. E.13 (stripe, avatar ring, card rhythm) at phone, tablet and desktop widths in both themes"
    verification:
      - kind: e2e
        ref: "web/e2e/profile.spec.ts axe and no-sideways-scroll checks on every tab (all five projects, both themes on Appearance)"
        status: pass
    human_judgment: true
    rationale: "Axe, overflow and contrast pass, but whether the transcribed header and cards match the owner's design is a visual judgement; the UI-SPEC copy is built but not yet owner-approved (D-48) and goes to the 05-37 screen review"

duration: 82min
completed: 2026-10-17
status: complete
---

# Phase 5 Plan 13: My Profile page, name save with the shared conflict banner, and the shared theme Summary

**My Profile at /admin/profile with the E.13 header and keyboard-driven D-23 tabs in the URL, a name save that carries its edit version and keeps typed values behind the shared ConflictBanner on a 409, and an Appearance tab whose theme is one layout state shared with the top bar.**

## Performance

- **Duration:** 82 min
- **Started:** 2026-10-18T03:35:25Z
- **Completed:** 2026-10-18T04:58:00Z
- **Tasks:** 3 (one tracer, two auto; all TDD)
- **Files modified:** 29 (10 created source or spec files, plus tests and the files listed above)

## Accomplishments

- `/admin/profile` is a real page: the E.13 header card (accent stripe, 72px avatar with the 3px accent ring, name, role badge, "{email} · Member since {date}" in the business zone) over three WAI-ARIA tabs. The tab lives in the `tab` URL parameter through `createListParams` (default Details out of the URL, replace on change, an invalid value removed with one replace). Loading and failure states use the shared LoadingRegion and ErrorState.
- The Personal Information card saves with `react-hook-form` and a zod schema that mirrors `UpdateProfileNameRequestValidator`, including the server's UTF-16 length. The version sent is the one the form was opened with. After a save the query cache is updated and `refreshSession()` runs, so the sidebar chip and top bar show the new name; `AdminLayout` now reads the shell user from `useSession()` for the same account.
- `ConflictBanner` is the first shared D-20 pattern: `role="alert"`, the `.s-banner.is-danger` look with the icon at the top, a secondary sm Load Latest button, focus on the button, and no power to clear anything. The profile form shows it from the first `409 edit.stale`, and Load Latest swaps in the latest names and version, focuses First name, and announces "Latest version loaded. Make your changes again."
- The Appearance tab's Theme control and the top bar toggle share one state: `useThemeState` in the layout, `useAdminTheme` in pages through the Outlet context (`UrlStateLayout` forwards it). Choosing the active theme writes and announces nothing; a throwing storage still works in memory; nothing is sent to the server and the public layout never reads it.
- 111 new unit and integration tests (100 in the six new test files, 11 added to the layout and URL-state suites) and 20 Playwright runs (4 `@profile` tests in 5 projects) pass. `npm --prefix web run verify` passes (159 files, 4657 tests, coverage 97.2% statements, admin bundle 202.6 KB gz of 250, public 121.9 of 150, CSS 14.4 of 35).

## Task Commits

1. **Task 1: Tracer, tabs and name save** - `96a2553` (test, RED), `662ffd6` (feat, GREEN)
2. **Task 2: Conflict banner and Load Latest** - `d63e8c2` (test, RED), `1e29742` (feat, GREEN)
3. **Task 3: Appearance tab and shared theme, three-engine proof** - `18725eb` (test, RED), `c435e94` (feat, GREEN)

**Plan metadata:** recorded in the docs(05-13) commit that follows this summary.

## TDD record

- **RED 1 (`96a2553`):** 49 of 53 tests failed on the planned behavior against stubs: the page stub renders nothing so every page test failed on "Unable to find ... heading Carmen Reyes", the service stub rejected "not implemented", the schema stub accepted blank and over-long names, the tab stub never wrote the URL. The 4 that passed are the stub-compatible cases (a valid name, "reads details with no tab", the exported instance shape). Semantic assessment: every failure is the planned assertion or the missing content, no import, syntax or fixture fault.
- **GREEN 1 (`662ffd6`):** 53 of 53. One GREEN-time correction: zod 4's `max()` counts code points, so the 51-emoji case passed the schema; the length rule became a `refine` on string length to match the server.
- **RED 2 (`d63e8c2`):** 16 failures: the banner stub rendered nothing, the page showed the ordinary conflict toast instead of the banner, no session refresh happened after a save, and the shell kept the old name. Three tests already passed as regression guards (the dev placeholder user is kept, a 409 that is not `edit.stale` still toasts, a failed save does not refresh).
- **GREEN 2 (`1e29742`):** all pass. Two test bugs fixed on the way (a GET override that returned the newer profile from the start).
- **RED 3 (`18725eb`):** 28 failures against the hook stub (no Appearance control, no layout context, UrlStateLayout dropped the context).
- **GREEN 3 (`c435e94`):** all pass. The Playwright spec was written with the implementation, not before it; its first five-project run found one real test issue (below), no product defect.
- No REFACTOR commits were needed. The `gsd_run check tdd-red-evidence` classifier was not run: the plan is `type: execute` with `tdd="true"` tasks, the same call 05-03 made.

## Files Created/Modified

- `web/src/modules/admin/pages/ProfilePage.tsx` - `ProfileRoute`: header, tabs, Personal Information, Signed-in Devices and Theme cards, loading and error states
- `web/src/modules/admin/services/profileService.ts` - `get` and `updateName` over the shared client (no Idempotency-Key on the PUT)
- `web/src/modules/admin/hooks/useProfileQuery.ts`, `useProfileTab.ts`, `useAdminTheme.ts` - the query, the URL tab, and the theme state and reader
- `web/src/modules/admin/profileCopy.ts`, `profileSchemas.ts`, `components/profile.recipe.ts` - the words, the zod mirror, the App. C looks
- `web/src/components/states/ConflictBanner.tsx` (+ `copy.ts`, `index.ts`) - the shared D-20 banner
- `web/src/layouts/AdminLayout.tsx` - session-fresh shell user, `useThemeState`, Outlet context
- `web/src/lib/url-state/UrlStateLayout.tsx` - forwards the layout Outlet context
- `web/src/components/status/status.recipe.ts` - `profile` Avatar context (the 3px accent ring)
- `web/src/modules/admin/routes.tsx`, `web/src/lib/query/keys.ts` - the lazy profile route (dev preview removed), `profileKey`
- `web/e2e/profile.spec.ts` - four `@profile` journeys; `admin.spec.ts`, `sweep.ts`, `admin-keyboard.spec.ts` adapted to the real page

## Decisions Made

See `key-decisions` above. Besides those: the stripe's 95% opacity is drawn as a 95% `color-mix` of the accent, because D-02 keeps opacity tokens off boxes and the class gate enforces it; the Appearance card's second grid column stays empty as the UI-SPEC says.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The profile dev preview shadowed the real page in the e2e bundle**
- **Found during:** Task 3 (the `@profile` e2e)
- **Issue:** `devRoutes` is listed before `adminRoutes` and had `{ path: 'profile', lazy: previewPage }`, so in the e2e bundle `/admin/profile` always rendered the unsigned placeholder preview, never the guarded page. The plan's e2e (and every later plan's e2e for users and the audit log) cannot reach a real page behind a preview at the same path.
- **Fix:** removed the `profile` entry from `devRoutes`. Updated what relied on it: `admin.spec.ts` and `sweep.ts` (profile dropped from the unsigned page lists; `profile.spec.ts` covers axe, overflow and both themes on every tab), the `admin-keyboard.spec.ts` "My Profile in the user menu" journey (now signs in first), and four `AdminLayout.test.tsx` cases (sections list, phone tab bar, re-render, user menu link).
- **Files modified:** `web/src/modules/admin/routes.tsx`, `web/e2e/admin.spec.ts`, `web/e2e/sweep.ts`, `web/e2e/admin-keyboard.spec.ts`, `web/src/layouts/AdminLayout.test.tsx`
- **Verification:** `npm --prefix web run verify` passes; the combined run `@profile|@admin|@keyboard|@responsive|@a11y-rulings` passed 399 of 400 in five projects (the one failure is below)
- **Committed in:** `c435e94`

**2. [Rule 3 - Blocking] UrlStateLayout dropped the layout's Outlet context**
- **Found during:** Task 3 (wiring `useOutletContext`)
- **Issue:** the admin pages sit under `UrlStateLayout`, whose `<Outlet />` gave pages `null` instead of the admin layout's `{ theme, setTheme }`, so the plan's outlet-context design could not reach them.
- **Fix:** `UrlStateLayout` reads `useOutletContext()` and passes it to its own `<Outlet context={...} />`. Two tests added: the context passes through, and a page under no layout still gets none.
- **Files modified:** `web/src/lib/url-state/UrlStateLayout.tsx`, `web/src/lib/url-state/UrlStateLayout.test.tsx`
- **Committed in:** `c435e94` (tests in `18725eb`)

**3. [Rule 1 - Bug] zod's max() measures code points, the server measures UTF-16 units**
- **Found during:** Task 1 GREEN (the 51-emoji case)
- **Issue:** `z.string().max(100)` accepted 51 emoji (102 UTF-16 units) that the server refuses, so the browser rule did not mirror the validator.
- **Fix:** the length rule is a `refine` on `string.length`.
- **Files modified:** `web/src/modules/admin/profileSchemas.ts`
- **Committed in:** `662ffd6`

**4. [Rule 2 - Missing critical] All tab panels stay mounted**
- **Found during:** Task 1 design
- **Issue:** unmounting the Details panel on a tab change would drop typed, unsaved names and, on return, re-open the form with the live (possibly newer) version, which defeats D-20.
- **Fix:** the three panels are always rendered; inactive ones are `hidden`.
- **Committed in:** `662ffd6`

**5. [Rule 3 - Blocking] E2E test state: the sticky phone tab bar covered a field under axe**
- **Found during:** Task 3 (iphone project, banner state)
- **Issue:** with the banner pushing the form down, the sticky tab bar overlapped the First name input at the scrolled position, and axe's target-size rule reported it. This is the scroll position of the test, not a layout defect.
- **Fix:** the test scrolls to the top before the axe pass.
- **Files modified:** `web/e2e/profile.spec.ts`
- **Committed in:** `c435e94`

### Plan-file-list additions (no behavior beyond the plan)

`web/src/lib/url-state/UrlStateLayout.tsx` and its test (deviation 2), `web/src/components/status/status.recipe.ts` (the `profile` Avatar context for the accent ring), `web/src/modules/admin/hooks/useAdminTheme.test.tsx`, `web/e2e/admin.spec.ts`, `web/e2e/sweep.ts`, `web/e2e/admin-keyboard.spec.ts` (deviation 1).

---

**Total deviations:** 5 auto-fixed (1 bug, 1 missing-critical, 3 blocking)
**Impact on plan:** all five were needed for correctness or to make the planned e2e reachable; no scope growth beyond them.

## Issues Encountered

- One Firefox failure in the broad e2e run (`@a11y-rulings` D-05 on `/dev/components` dark): `page.goto` waited the full 10-minute test timeout for the load event under four parallel workers. The same test passes alone in 35 s and the page is untouched by this plan, so it is recorded as a host or engine stall, not a regression.
- `owner-review.mjs` and `design-side-by-side.mjs` still list `/admin/profile` as an unsigned dev preview. Logged in `deferred-items.md` for plan 05-37; their unit tests check only the lists and pass.

## Authentication Gates

None.

## Known Stubs

None. The Security tab holds only the Signed-in Devices card and the Details tab only Personal Information because the password and email cards are planned for 05-18; that is the planned scope, not a stub.

## Threat Flags

None. The plan's threat register is mitigated as written: T-05-33 (literal `tab` parser, one replace), T-05-34 (React text nodes only, no HTML injection), T-05-35 (banner keeps values, two-page e2e), T-05-36 (only the tab name is in the URL), T-05-SC (no installs, `package.json` untouched).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ConflictBanner` and the version-carrying form pattern are ready for the Edit User panel (05-25); the version is component state, loaded by Load Latest.
- 05-18 adds the password and sign-in email cards inside the existing Details and Security panels; the panels are already mounted and hidden, and the Security panel's grid has room.
- 05-20 and 05-33 will meet the same dev-preview shadowing for `users` and `audit-log`; the fix pattern is in deviation 1.
- Owner review is still open for the UI-SPEC wording built here (D-48): tab names, the Signed-in Devices and Theme card text, and the profile header line.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-17*

## Self-Check: PASSED

All ten created source and spec files exist on disk, and the six task commits (`96a2553`, `662ffd6`, `d63e8c2`, `1e29742`, `18725eb`, `c435e94`) are on the branch.

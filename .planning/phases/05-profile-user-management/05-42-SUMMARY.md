---
phase: 05-profile-user-management
plan: 42
subsystem: ui
tags: [react, component-showcase, demo-data, radio-group, date-input, conflict-banner, record-meta, audit-row, roster, add-user, dialogs, profile-tabs, playwright, tdd, d-32, d-33]
created: "2026-10-18T15:16:00-05:00"
updated: "2026-10-18T15:16:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-35 (the production Component Showcase at /admin/components, ShowcaseDemos EXTRA_CASES, showcaseSections, showcaseCopy, the build rules and secret scan); the Phase 5 components 05-13, 05-20 to 05-33"
provides:
  - "A 'Staff and audit' showcase section (the 11th) with nine live demos on made-up data: RadioGroup, DateInput, ConflictBanner (on request), RecordMeta (System row and '(former staff)' row), an expandable audit row, roster rows in Active, Inactive, Locked, Invite pending, Invite expired and own-row states plus a 100-character name, Add User by the invitation and the temporary password routes with the shown-once step, the Deactivate, Lock, Delete and Set Temporary Password dialogs, and the profile tabs"
  - "web/src/modules/admin/components/showcase/Phase5Demos.tsx (Phase5Demos), local state only, no service, query or API call"
  - "Every sample email in the shipped showcase and preview data now uses example.com (owner ruling 2026-10-18); the build-output address allow-list no longer names any gmail.com or yahoo.com address"
affects: [05-37 screen review (the new section is part of the showcase the owner reviews), Phase 5 security review, later phases that add showcase cases]

actuals:
  tokens: 15150
  tasks: 2
  commits: 6
plan_head_before: aa03d0cd53bb6ba083844b04c9cccda1b307173f
plan_head_after: b0e122064c1ba389b725dc84ae9c5c544a339c0a

tech-stack:
  added: []
  patterns:
    - "A live demo of a component whose real version calls the API (Add User) is a local-state twin built from the same primitives (Modal, Field, RoleField, RadioGroup, PasswordField, CopyField); components that take their request as a prop (Deactivate, Lock, Temporary Password, Delete) are used as they are with a handler that only closes"
    - "A component that takes focus when it mounts (ConflictBanner) sits behind a button so the page never moves focus on load, and focus goes back to the button when it leaves"
    - "A section with no scenarios lists groups: [] and gets its cases from EXTRA_CASES only"

key-files:
  created:
    - web/src/modules/admin/components/showcase/Phase5Demos.tsx
    - web/src/modules/admin/components/showcase/Phase5Demos.test.tsx
  modified:
    - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
    - web/src/modules/admin/components/showcase/showcaseSections.ts
    - web/src/modules/admin/components/showcase/showcaseSections.test.ts
    - web/src/modules/admin/components/showcase/showcaseCopy.ts
    - web/src/modules/admin/components/showcase/showcase.recipe.ts
    - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
    - web/e2e/showcase.spec.ts
    - web/src/dev/scenarios/groups/lists.ts
    - web/src/dev/previews/ListTableState.tsx
    - web/src/dev/previews/AuthScreens.tsx
    - web/src/dev/previews/LoginScreen.tsx
    - web/src/dev/LoginScreen.test.tsx
    - web/src/test/build-output.node.test.ts
    - web/visual/reference/fragments/LoginScreen.tsx
    - .planning/phases/05-profile-user-management/deferred-items.md

key-decisions:
  - "The Add User demo is a local-state twin, not the real AddUserPanel: the real panel calls the users API from inside (usersService.create), so mounting it in the public showcase would send a request. The twin shares the primitives and copy, so the look and wording match; TemporaryPasswordDialog, DeactivateUserDialog, LockUserDialog and ConfirmDialog are the real components because they take their request as a prop."
  - "Phase5Demos is one component that lays out its nine cases, each in the same two frames the page gives other cases (a page-root region for static cases, a plain frame for live ones that open a fixed layer). ShowcaseDemos registers it as one demo extra case of the new section."
  - "The stale-save banner appears only after 'Show stale save banner', because ConflictBanner focuses Load Latest the moment it mounts."
  - "The trigger labels 'Open Add User (invite)' and 'Open Add User (password)' are small buttons: the first wording, 'Open Add User (temporary password)', was 311 px wide and pushed the page past 320 px."
  - "name@gmail.com stays in the build-output allow-list: it is the product's own validation hint ('Enter a valid email, like name@gmail.com') shown by the server and the forms, not demo data."

patterns-established:
  - "Tests that need an absent module use an inert stub only in the RED commit, never a missing import, so the RED run fails on assertions"

requirements-completed: [USER-08]

coverage:
  - id: D1
    description: "UI-SPEC C1: the showcase at /admin/components has a 'Staff and audit' section with RadioGroup, DateInput, ConflictBanner, RecordMeta (System and '(former staff)' rows), an expandable audit row, and roster rows in the six states, on made-up data"
    requirement: "USER-08"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/showcase/Phase5Demos.test.tsx#Phase5Demos: the primitives / the audit row and the roster"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/ComponentShowcasePage.test.tsx#has one section with an h2 per group, in the UI-SPEC order"
        status: pass
    human_judgment: false
  - id: D2
    description: "UI-SPEC C1: Add User by both routes with the shown-once step, the Deactivate, Lock, Temporary Password and Delete dialogs and the profile tabs are live demos; each closes and returns focus"
    requirement: "USER-08"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/showcase/Phase5Demos.test.tsx#Phase5Demos: the panels, dialogs and profile tabs are live"
        status: pass
      - kind: e2e
        ref: "web/e2e/showcase.spec.ts#@showcase the Staff and audit demos open and close for a Manager, show a sample password once, and call no API but the session refresh (D-32, D-33)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-32 / D-33: the demos use local state only and call no service, query or API; 100-character names wrap at 320 px; zero axe violations, zero console warnings and no CSP violation"
    requirement: "USER-08"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/showcase/Phase5Demos.test.tsx#makes no request while the demos render and are used / makes no request through any panel, dialog or tab"
        status: pass
      - kind: e2e
        ref: "web/e2e/showcase.spec.ts#@showcase a Manager opens /admin/components ... / does not scroll sideways at 320px (D-33) / /dev/components every section, no axe findings"
        status: pass
    human_judgment: false
  - id: D4
    description: "Owner ruling 2026-10-18: every sample email in the shipped showcase and preview data uses example.com"
    verification:
      - kind: unit
        ref: "web/src/test/build-output.node.test.ts#has no email address in the showcase chunks beyond the made-up demo ones (T-05-96)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The wording of the new demo triggers and the made-up values (Ana Mendoza, the dialog person, the audit entries) as they read in the showcase"
    verification: []
    human_judgment: true
    rationale: "Dev-only trigger wording is SPEC-GAP; the owner reviews the rendered section in the 05-37 screen review (D-48)"

duration: 50min
completed: 2026-10-18
---

# Phase 5 Plan 42: Phase 5 demos in the Component Showcase Summary

**A "Staff and audit" section in the production showcase with live, made-up-data demos of RadioGroup, DateInput, the stale-save banner, RecordMeta, an expandable audit row, the roster in six states, Add User by both routes with the shown-once step, the four account dialogs and the profile tabs, none of which makes a request**

## Performance

- **Duration:** about 50 min
- **Started:** 2026-10-18 (about 14:25 CDT)
- **Completed:** 2026-10-18T15:16:00-05:00
- **Tasks:** 2 (plus the owner's email ruling as its own commit)
- **Files modified:** 16 (code and tests), plus `deferred-items.md`

## Accomplishments

- The showcase has an 11th section, "Staff and audit", with nine cases. The six new icons show in the icon grid automatically (the grid reads the icon table).
- All data is made up. People: Carmen Reyes (own row), Paolo Garcia, Jomar Santos, Rhea Villanueva, Liza Mercado, Noel Bautista, Ana Mendoza and a 100-character name; addresses are `@example.com`; the audit IP is the documentation range `203.0.113.0`.
- `Phase5Demos.tsx` imports no service, query or API client (grep gate returns 0), and the tests prove no request through MSW's request events and a spy on `fetch`.
- The owner's ruling (all showcase and preview sample emails to `example.com`) is its own commit, with the build-output allow-list updated to match.
- `npm --prefix web run verify` passes (186 files, 5432 tests, build, budget build, license and notices checks). `npm --prefix web run e2e -- --grep @showcase` passes 55 of 55 across chromium, firefox, webkit, pixel and iphone.

## Task Commits

1. **Owner ruling: sample emails use example.com** - `0e37dc6` (fix)
2. **Task 1 (tracer): the showcase gains a Staff and audit section**
   - RED `4059816` (test)
   - GREEN `d263ec7` (feat)
3. **Task 2: panels, dialogs and profile tabs are live demos**
   - RED `21862cc` (test)
   - GREEN `041de80` (feat)
4. **Fix found by the e2e run: shorter Add User triggers so the page fits at 320 px** - `b0e1220` (fix)

**Plan metadata:** the docs commit that follows this file.

## TDD Gate Compliance

- **Task 1 RED** (`4059816`): `Phase5Demos.test.tsx` and the section tests, with `Phase5Demos` an inert stub that returns null. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` for the target "lists roster rows in Active, Inactive, Locked, Invite pending, Invite expired and own-row states" (TAP, exit 1, error "No [data-case="staff-roster-rows"] frame."). Semantic assessment: the stub renders nothing, so the target fails on its first planned lookup for the intended reason; no import, syntax or fixture fault. 9 of the 9 new unit tests and 2 section-list tests failed (one axe case was green against the empty render until a frame assertion was added before the commit).
- **Task 1 GREEN** (`d263ec7`): 13 tests in the showcase folder and the page test pass. The same commit corrects two matchers written in RED: RecordMeta's `dd` holds the actor as separate text nodes, so `getByText` needed `/^System ·/` and `'(former staff)'`; and two audit rows needed the row-specific toggle name.
- **Task 2 RED** (`21862cc`): 14 new unit cases plus the `@showcase` e2e additions. `RED_EVIDENCE_OK` for the target "shows the profile tabs: Details first, and choosing Security or pressing Right shows that panel" (exit 1, "No [data-case="staff-profile-tabs"] frame."), same semantic assessment. The e2e case was not run before GREEN: it needs the full host and the unit RED already proves the gate.
- **Task 2 GREEN** (`041de80`): all unit cases pass; e2e passes after the 320 px fix.
- **REFACTOR:** none needed. All four gate commits are present in order.

## Files Created/Modified

- `web/src/modules/admin/components/showcase/Phase5Demos.tsx` - `Phase5Demos` and its nine demos (local state only)
- `web/src/modules/admin/components/showcase/Phase5Demos.test.tsx` - 23 unit cases
- `web/src/modules/admin/components/showcase/ShowcaseDemos.tsx` - registers `Phase5Demos` as the one demo case of the `staff` section
- `web/src/modules/admin/components/showcase/showcaseSections.ts` (+ test) - the `staff` section, `groups: []`
- `web/src/modules/admin/components/showcase/showcaseCopy.ts` - dev trigger wording and the made-up person for the demos
- `web/src/modules/admin/components/showcase/showcase.recipe.ts` - `staffStackClasses`
- `web/src/modules/admin/pages/ComponentShowcasePage.test.tsx` - the section list and placement
- `web/e2e/showcase.spec.ts` - 11 sections and the Manager run through the new section
- `web/src/dev/scenarios/groups/lists.ts`, `web/src/dev/previews/{ListTableState,AuthScreens,LoginScreen}.tsx`, `web/src/dev/LoginScreen.test.tsx`, `web/visual/reference/fragments/LoginScreen.tsx`, `web/src/test/build-output.node.test.ts` - the example.com ruling

## Decisions Made

See `key-decisions` above. In short: the Add User demo is a local-state twin because the real panel posts to the API from inside; the other dialogs are the real components with closing handlers; the stale-save banner waits for a button because it takes focus on mount; the new Add User triggers are small and short so the page fits at 320 px.

## Deviations from Plan

### Owner instruction

**1. [Coordinator message, owner ruling 2026-10-18] Sample emails use example.com**
- **Found during:** before Task 1 (received while reading)
- **What:** `@gmail.com` and `@yahoo.com` sample addresses in the shipped showcase and preview data (lists scenarios, list table state, sign-in previews) became `@example.com` with the names and local parts kept; the sign-in reference fragment and the build-output allow-list followed. `name@gmail.com` stays: it is product copy (the validation hint shown by the server and every form), not demo data.
- **Left alone as instructed:** unit and e2e fixtures (`ResponsiveTable.test.tsx`, `auth-overflow.spec.ts`, the schema and page tests), the email-preview tool and the integration tests.
- **Files:** see the list above. **Commit:** `0e37dc6`.

### Auto-fixed Issues

**2. [Rule 1 - Bug] Add User demo trigger widened the page at 320 px**
- **Found during:** Task 2 (`@showcase` e2e, 9 failures at 320 px in all five projects)
- **Issue:** "Open Add User (temporary password)" was a 311 px unbreakable button, so `main` scrolled sideways (348 px).
- **Fix:** small buttons with the labels "Open Add User (invite)" and "Open Add User (password)".
- **Verification:** `@showcase` e2e 55 of 55; unit tests renamed to match.
- **Commit:** `b0e1220`.

**3. [Rule 2 - Missing critical / T-05-105] Add User demo is a twin of the panel, not the panel**
- **Found during:** Task 2
- **Issue:** the real `AddUserPanel` calls `usersService.create` itself; mounting it in the public showcase would send a request and, with a session, create a real user.
- **Fix:** `AddUserPanelDemo` built from the same primitives and copy, local state only. The dialogs that take their request as a prop (`TemporaryPasswordDialog`, `DeactivateUserDialog`, `LockUserDialog`, `ConfirmDialog`) are the real components.
- **Commit:** `041de80`.

**4. [Rule 3 - Blocking] Test matchers corrected in GREEN**
- **Found during:** Task 1 GREEN; RecordMeta puts the actor in the `dd` as separate text nodes and the audit demo has two rows. The matchers written in RED were tightened (see TDD Gate Compliance). **Commit:** `d263ec7`.

**5. [Scope note] `showcase.recipe.ts` also changed**
- One class (`staffStackClasses`) was added; the plan's `files_modified` did not list the file. **Commit:** `d263ec7`.

---

**Total deviations:** 1 owner instruction and 4 auto-fixed or noted (1 bug, 1 missing critical, 1 blocking, 1 scope note)
**Impact on plan:** no scope creep. The plan's two tasks and all acceptance criteria hold.

## Issues Encountered

- One full `verify` run failed on `AdminLayout.test.tsx` ("shows the new name in the Sidebar chip ..."), a timing flake under load: it passes alone three times and the next full run passed everything. Unrelated to this plan. Logged in `deferred-items.md`.
- The first `verify` failed on `build-output.node.test.ts` because it reads the previous production build and `verify` runs the tests before `build`; running `npm --prefix web run build` once fixed it. Logged in `deferred-items.md`.
- The `Monitor` tool was not available; waiting on long runs used polling instead.

## Known Stubs

None. The demo values are intentional made-up data (D-32), not placeholders for wiring.

## Threat Flags

None. No new endpoint, auth path or file access. T-05-105 is mitigated: no service, query or API client in `Phase5Demos.tsx` (grep gate 0), tests assert no request, and the build secret and address scan passes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The new section is ready for the 05-37 screen review (wording of the trigger labels and demo values is dev wording, D-48).
- No blockers. The two deferred items above are for the Phase 5 close-out test review.

## Self-Check: PASSED

- Files exist: `Phase5Demos.tsx`, `Phase5Demos.test.tsx`, this SUMMARY.
- Commits found in the branch: 0e37dc6, 4059816, d263ec7, 21862cc, 041de80, b0e1220.
- `grep -c "export function Phase5Demos"` is 1; `grep -c "Service\|useQuery\|apiClient"` is 0; `@showcase` appears 9 times in the e2e spec; `verify` passes.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*

---
phase: 05-profile-user-management
plan: 20
subsystem: ui
tags: [react, nuqs, tanstack-query, users-roster, url-state, badges, playwright, tdd]
created: "2026-10-18T04:22:00-05:00"
updated: "2026-10-18T04:22:00-05:00"

requires:
  - phase: 05-profile-user-management
    provides: "05-17 GET /api/v1/users and /users/{id}; 05-03 requireManager route guard; 05-13 profile page and the dev-preview fix pattern; 05-10 createStaff e2e states"
provides:
  - "/admin/users (UsersRoute): the Manager-only roster with search, Role and Status filters, chips, result bar, paging and the caption"
  - "usersService (list, get), useUsersQuery, useUsersListParams (page, size, q, role, status through createListParams), USERS_COPY, users.recipe"
  - "RowAction link form: a router link in the 36px icon-button look (the `to` prop)"
  - "web/e2e/users.spec.ts (@users), three journeys in five projects"
affects: [05-22 Add User panel, 05-25 Edit panel, 05-28 row dialogs, 05-37 screen review and signed-in review capture]

actuals:
  tokens: 17800
  tasks: 3
  commits: 5
plan_head_before: 557a8819d72068b7bedda1fcc42eecf8535ae24f
plan_head_after: c548f439634b41a3642d3a49ef0c0103b70549b0

tech-stack:
  added: []
  patterns:
    - "A list page reads and writes its view only through its createListParams hook, keys the query on useSettledListParams, and clamps a page past the end once fresh data says so"
    - "RowAction is a discriminated union: with `to` it is a router link (anchor ref), without it a button (button ref)"
    - "A real guarded page replaces its dev preview by removing the preview from devRoutes (same fix as 05-13)"

key-files:
  created:
    - web/src/modules/admin/pages/UsersPage.tsx
    - web/src/modules/admin/pages/UsersPage.test.tsx
    - web/src/modules/admin/services/usersService.ts
    - web/src/modules/admin/services/usersService.test.ts
    - web/src/modules/admin/hooks/useUsersQuery.ts
    - web/src/modules/admin/hooks/useUsersListParams.ts
    - web/src/modules/admin/hooks/useUsersListParams.test.tsx
    - web/src/modules/admin/usersCopy.ts
    - web/src/modules/admin/components/users.recipe.ts
    - web/e2e/users.spec.ts
  modified:
    - web/src/components/lists/cells.tsx
    - web/src/components/lists/lists.recipe.ts
    - web/src/components/lists/ResponsiveTable.test.tsx
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/src/layouts/AdminLayout.test.tsx
    - web/e2e/admin.spec.ts
    - web/e2e/sweep.ts
    - web/e2e/a11y-rulings.spec.ts

key-decisions:
  - "The Users dev preview is removed from devRoutes because it shadowed the real page in the e2e bundle (same fix as 05-13 for profile); the AdminLayout tests that used it as a generic Manager page now use /admin/orders"
  - "No Add User button in this plan: the panel it opens is 05-22, which adds the button to the header"
  - "Clear Filters clears the search, Role and Status but keeps the page size (reset() would also drop Rows per page)"
  - "The page count uses the URL size and the server total; the generated int32 type allows number or text, so the total goes through Number()"
  - "The caption sits directly under the table, above Pagination, as the UI-SPEC says"

patterns-established:
  - "UserCell's text wrapper carries min-w-0 and wrap-anywhere, so a long name or sub line wraps beside the avatar for every list"
  - "A 403 on a Manager-only list shows the shared 'You don't have access to this' banner in place of the toolbar and table"

requirements-completed: [USER-01, USER-08]

coverage:
  - id: D1
    description: "USER-01: a Manager opens /admin/users and sees the h1 with the Manager only badge and the verbatim subline, then every staff member with name, email, role badge, status badge (Active success, Inactive neutral, Locked warning), the invitation badge (Invite pending info, Invite expired warning) only without a password, the created date in the business zone, and the caption"
    requirement: "USER-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/UsersPage.test.tsx#U1 the header, U1 the rows"
        status: pass
      - kind: integration
        ref: "web/src/modules/admin/routes.test.tsx#a Manager who opens /admin/users stays and sees the Users roster (USER-01)"
        status: pass
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users the roster shows staff in every state (chromium, firefox, webkit, pixel, iphone)"
        status: pass
    human_judgment: false
  - id: D2
    description: "WEB-10: search (debounced 300 ms, capped at 100), Role, Status, page and size live in the URL through useUsersListParams; filters and search replace and reset the page, page changes push, invalid values fall back with one replace, a page past the end clamps to the last page; chips, the result bar singular/plural, No matches with Clear Filters and the dimmed refetch work"
    requirement: "USER-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useUsersListParams.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/UsersPage.test.tsx#U1 toolbar (WEB-10), U1 result bar and empty result, U1 paging, U1 refetch"
        status: pass
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users the roster shows staff in every state (filters, page 2 at 10 a page, bad link cleanup)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-19 and the prohibitions: the signed-in Manager's own row has only a pencil link to My Profile (no toggle, no delete); there is no Deleted filter, Restore action or deleted row (D-09); Back from My Profile restores the search, the filter and the row"
    requirement: "USER-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/UsersPage.test.tsx#U1 the row actions (D-19), U1 deleted users (D-09)"
        status: pass
      - kind: unit
        ref: "web/src/components/lists/ResponsiveTable.test.tsx#RowAction with `to`"
        status: pass
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users ... Back from My Profile restores it"
        status: pass
    human_judgment: false
  - id: D4
    description: "USER-08 (UI half): an Admin who opens /admin/users is sent to /admin and never sees the roster; the Users sidebar item is absent for an Admin; a 403 on the list shows the access banner instead of the table"
    requirement: "USER-08"
    verification:
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users an Admin who opens /admin/users lands on /admin and the sidebar has no Users item"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/UsersPage.test.tsx#U1 states > the role was lost mid-session (403)"
        status: pass
    human_judgment: false
  - id: D5
    description: "States and accessibility: first-load skeleton with 'Loading users…', 'Couldn't load users.' with Try Again, zero axe violations in the unit and e2e runs, no sideways scroll at 320 px, both themes"
    requirement: "USER-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/UsersPage.test.tsx#U1 states, U1 accessibility"
        status: pass
      - kind: e2e
        ref: "web/e2e/users.spec.ts#@users the roster has no sideways scroll at 320 px and no axe violations in Espresso"
        status: pass
    human_judgment: false
  - id: D6
    description: "The roster looks like App. E.12 (title row, badges, C-35 inactive rows, caption) and its SPEC-GAP wording (Locked, Invite pending, Invite expired, the own-row link name) reads right to the owner"
    verification: []
    human_judgment: true
    rationale: "Owner ruling D-48: the UI-SPEC wording is built as written and is not approved until the owner reviews it (05-37 screen review); the visual match needs a person's eye"

duration: 60min
completed: 2026-10-18
status: complete
---

# Phase 5 Plan 20: Users roster Summary

**A Manager-only /admin/users roster with the role, status and invitation badges, search, Role and Status filters, chips and paging kept in the URL through one createListParams hook, an own row that links only to My Profile, and a RowAction link form to carry it.**

## Performance

- **Duration:** 60 min
- **Started:** 2026-10-18T03:22:00-05:00
- **Completed:** 2026-10-18T04:22:00-05:00
- **Tasks:** 3 (one tracer, two auto; Tasks 1 and 2 TDD)
- **Files modified:** 19 (10 created, 9 modified)

## Accomplishments

- `/admin/users` is a real page behind the `requireManager` loader: the E.12 header (h1, "Manager only" badge, verbatim subline), a table of User, Email, Role, Status, Created and a hidden Actions header, and the OQ-7 caption. Status shows Active (success), Inactive (neutral) and Locked (warning) with a dot, followed by Invite pending (info) or Invite expired (warning) when no password is set. Inactive rows take the C-35 look (surface-2 cells, full-opacity text). A 403 shows the shared "You don't have access to this" banner in place of the toolbar and table.
- The signed-in Manager's row says "You" and has one action, a pencil link named "Edit your details in My Profile" (D-19): `RowAction` gained a `to` form (a router link in the same 36px look, anchor ref) as a discriminated union beside the unchanged button form.
- `useUsersListParams` holds page, size, q and the allow-listed role and status in the URL; defaults stay out, invalid values fall back with one replace, filters and search replace and reset the page, page changes push. The page keys its query on `useSettledListParams`, so typing makes one request for the settled text; chips ("Search: x", "Role: Manager", "Status: Locked") clear one filter each; the result bar says "1 user" or "n users · sorted by name"; "No matches" names the search and filters and Clear Filters clears them (keeping the page size); a page past the end clamps to the last page; the table dims by colour after 200 ms on a refetch.
- `web/e2e/users.spec.ts` (`@users`, 3 journeys) passes in all five projects (15 of 15 at 2 workers): every account state, filters, page 2 at 10 a page, bad-link cleanup, the own-row link and Back restoring the view, 320 px width, both themes, and an Admin redirected.
- `npm --prefix web run verify` passes: 166 files, 4874 tests, coverage 97.11% statements, admin bundle 189.6 KB gz (production) and 203.7 KB (budget build) of 250, license and notices gates clean.

## Task Commits

1. **Task 1: Tracer, the roster with badges and the own-row link** - `ad6fc8b` (test, RED), `279aecd` (feat, GREEN)
2. **Task 2: Search, filters, chips and paging in the URL** - `6b0a693` (test, RED), `a243e29` (feat, GREEN)
3. **Task 3: Browser proof** - `c548f43` (test)

**Plan metadata:** the docs(05-20) commit that carries this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md and the deferred-items note.

## TDD Gate Compliance

- **RED 1 (`ad6fc8b`):** 29 of 59 tests in the service, page and ResponsiveTable files failed on the planned behavior against stubs: the service stub rejected "not implemented", the page stub rendered nothing (every page test failed finding the "Users" heading or a row), `RowAction` with `to` rendered a button, not a link, and the routes test still met the page-not-found screen. The existing passes are regression guards. The `check tdd-red-evidence` classifier was not run: this repo's Vitest output is not a report format it reads, the same call 05-13, 05-16 and 05-17 made. Semantic assessment: each failure is the planned assertion or the missing content; no import, syntax or fixture fault.
- **GREEN 1 (`279aecd`):** all pass (116 files, 3499 tests in the admin, components, layouts, dev and scripts folders).
- **RED 2 (`6b0a693`):** 15 of 56 failed: 14 page tests (no Role or Status control, no chips, no result bar, no paging, no clamp, no dimming) and the hook's allow-list test (the stub took any text for role and status). The other hook tests passed against the stub because `page`, `size` and `q` were already real; they are regression guards.
- **GREEN 2 (`a243e29`):** 56 of 56. No REFACTOR commit was needed.
- **Tracer gate:** Task 1's `<verify>` is automated only, so the four files were re-run after GREEN (and again in the wider run) before expanding.
- Task 3 is a browser spec written after the implementation, as the plan says ("the plan's RED evidence is the Vitest failures").

## Files Created/Modified

- `web/src/modules/admin/pages/UsersPage.tsx` - `UsersRoute`: header, FilterBar, ResultBar with chips, ResponsiveTable, Pagination, caption, 403 banner
- `web/src/modules/admin/services/usersService.ts` - `list` (q, role, status, page, pageSize; nulls not sent) and `get` (id encoded), plus the filter value lists
- `web/src/modules/admin/hooks/useUsersListParams.ts`, `useUsersQuery.ts` - the URL state and the list query
- `web/src/modules/admin/usersCopy.ts`, `components/users.recipe.ts` - the words and the looks
- `web/src/components/lists/cells.tsx` - `RowAction` link form; `lists.recipe.ts` - UserCell text wraps anywhere
- `web/src/modules/admin/routes.tsx` - users route points at the roster; the dev preview is gone
- `web/e2e/users.spec.ts` - the `@users` journeys; `admin.spec.ts`, `sweep.ts`, `a11y-rulings.spec.ts` drop the unsigned Users preview

## Decisions Made

See `key-decisions` above. The own-row link and the C-35 rows carry their `// SPEC-DEVIATION: D-19` and `// SPEC-DEVIATION: C-35` markers at the sites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Users dev preview shadowed the real page in the e2e bundle**
- **Found during:** Task 1 (routes), as 05-13's SUMMARY warned
- **Issue:** `devRoutes` is listed before `adminRoutes`; its `users` preview would answer `/admin/users` with the unsigned placeholder page in the e2e bundle, so no signed-in e2e could reach the guarded roster.
- **Fix:** removed `users` from `devRoutes`. Updated what relied on it: `AdminLayout.test.tsx` (ten cases that used `/admin/users` as a generic page now use `/admin/orders`; the three Users-specific cases moved to `routes.test.tsx`, which renders the real page and checks Users current with its Manager tag hidden and no tab current), `routes.test.tsx` (the "page-not-found" cases), and the unsigned e2e lists in `admin.spec.ts`, `sweep.ts` and `a11y-rulings.spec.ts` (the hidden-tag ruling is still proven on every remaining page; `users.spec.ts` covers axe, 320 px and both themes for the real page).
- **Files modified:** `web/src/modules/admin/routes.tsx`, `routes.test.tsx`, `web/src/layouts/AdminLayout.test.tsx`, `web/e2e/admin.spec.ts`, `web/e2e/sweep.ts`, `web/e2e/a11y-rulings.spec.ts`
- **Verification:** `verify` passes; `npm --prefix web run e2e -- --grep "@admin |D-BL-02"` passed 85 of 85 in five projects
- **Committed in:** `ad6fc8b` (tests), `279aecd` (route and e2e lists)

**2. [Rule 2 - Missing critical] Long names did not wrap in the shared UserCell**
- **Found during:** Task 1 (the "wrapping anywhere" truth)
- **Issue:** `UserCell`'s text wrapper could not shrink beside the avatar and had no overflow-wrap, so a long name would widen the table.
- **Fix:** `cellUserTextClasses` gained `min-w-0` and `wrap-anywhere` (overflow-wrap is inherited by the name and sub line).
- **Files modified:** `web/src/components/lists/lists.recipe.ts`
- **Committed in:** `279aecd`

**3. [Rule 1 - Bug] Test-side faults found by the first browser runs**
- **Found during:** Task 3
- **Issue:** the admin top bar has its own `searchbox` named "Search" (strict-mode clash); the URL kept before the own-row click did not yet hold `role=manager` (nuqs writes it a moment after the select); and the e2e bundle's `/admin` is the Dashboard preview of the placeholder user, so "lands on /admin and the sidebar has no Users item" cannot read the sidebar there.
- **Fix:** the roster's Search is found by its placeholder; the spec waits for the URL before keeping it; the Admin test asserts the URL `/admin`, then checks the sidebar on the real `/admin/sessions` page.
- **Files modified:** `web/e2e/users.spec.ts`
- **Committed in:** `c548f43`

**4. [Plan acceptance wording] `grep -c "createListParams" useUsersListParams.ts` is 2, not 1**
- The file has one import line and one call line that both name it, and the hook cannot be built without both. The criterion's intent (the hook is built on createListParams, and has no `useState`) holds: the `useState` count is 0.

### Plan-file-list additions (no behavior beyond the plan)

`web/src/components/lists/lists.recipe.ts` and `web/src/modules/admin/components/users.recipe.ts` (looks), `web/src/layouts/AdminLayout.test.tsx`, `web/e2e/admin.spec.ts`, `web/e2e/sweep.ts`, `web/e2e/a11y-rulings.spec.ts` (deviation 1).

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing-critical, 1 blocking) plus 1 acceptance-wording note
**Impact on plan:** all needed to make the real page reachable and correct; no scope growth.

## Issues Encountered

- **Firefox "font preloaded but not used" warning (known item):** in two default-worker runs the long first `@users` journey failed on Firefox with the console warning already logged in `deferred-items.md` (found in 05-08 and 05-18). It passes at `--workers=1` and in the 15 of 15 run at `--workers=2`. Left for the Phase 5 close-out test review as recorded; no product behavior is involved.
- `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` still shows as modified (line endings only, from an earlier plan) and was left alone.
- The review scripts `owner-review.mjs` and `design-side-by-side.mjs` still list `/admin/users` as an unsigned page. Added to the existing item in `deferred-items.md` for 05-37.
- The estimate was 95000 tokens and the work measured 17800 on the same scale (added characters over 4); the estimate was too high, and the figure is not rounded toward it.

## Authentication Gates

None.

## Known Stubs

None. The other rows' actions (Edit, the Deactivate/Activate toggle, Delete) and the Add User button are not built here by design: they arrive with 05-22, 05-25 and 05-28, which attach to this page.

## Threat Flags

None. The plan's register is mitigated as written: T-05-57 (allow-list parsers with one replace, parsed values only in query keys, search capped at 100), T-05-58 (only q, role, status, page and size are keys; createListParams refuses email or name keys), T-05-59 (names and emails are React text nodes, wrap-anywhere), T-05-SC (no installs, `package.json` untouched).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-22 adds the Add User button and slide-over to the page header; 05-25 and 05-28 add the other rows' actions in the same `RowActions` cell (the own row stays link-only).
- Owner review is still open for the UI-SPEC wording built here (D-48): Locked, Invite pending, Invite expired, the own-row link name and the caption.
- 05-37 needs a signed-in capture path for the review scripts (users and profile are no longer unsigned previews).

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*

## Self-Check: PASSED

All ten created source and spec files exist on disk, and the five task commits (`ad6fc8b`, `279aecd`, `6b0a693`, `a243e29`, `c548f43`) are ancestors of HEAD.

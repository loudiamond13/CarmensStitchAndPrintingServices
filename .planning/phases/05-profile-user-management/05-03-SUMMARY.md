---
phase: 05-profile-user-management
plan: 03
subsystem: ui
tags: [react-router, route-guard, session, roles, lucide-react, icons, tdd]

requires:
  - phase: 04-identity-authentication
    provides: requireSessionLoader, session.ts role mapping, safeReturnUrl, the admin route tree
  - phase: 02-web-foundation-design-system
    provides: Icon wrapper and ICONS object over lucide-react
provides:
  - requireManagerLoader (Manager-only route guard, session check first, Admin redirected to /admin)
  - Guarded users and audit-log admin routes (not-found placeholder pages until 05-20 and 05-33)
  - Fail-closed role mapping (only the exact server values Admin and Manager make a session)
  - Six icons in ICONS: copy, lock-open, key-round, user-x, user-check, history
affects: [05-20 users page, 05-33 audit log page, every Manager-only screen, Phase 5 profile and roster screens]

actuals:
  tokens: 5100
  tasks: 2
  commits: 4
plan_head_before: d326f333ab696908275fd7250ce9753d49df6bb0
plan_head_after: 6be6b4444dc8cc8d8fb3431aac2550b71dfe71d3

tech-stack:
  added: []
  patterns:
    - "Manager-only routes: a lazy requireManager loader wrapper beside requireSession, so the public entry never carries guard code"
    - "Unknown server role is refused in acceptSession and surfaces from a refresh as a 401, so the existing signed-out path runs"

key-files:
  created: []
  modified:
    - web/src/modules/admin/services/session.ts
    - web/src/modules/admin/services/session.test.ts
    - web/src/modules/admin/guard.ts
    - web/src/modules/admin/guard.test.ts
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/src/components/brand/icons.ts
    - web/src/components/brand/Icon.test.tsx
    - web/src/dev/ComponentShowcase.test.tsx

key-decisions:
  - "A refresh that brings an unknown role throws HttpError 401 inside requestSession, so ensureSession resolves null and the shared client's refresh failure runs the same session-ended path as a real 401"
  - "completeSignIn with a refused role keeps no session and posts no 'refreshed' message to other tabs"
  - "Manager redirect target is the constant /admin; the return path logic (safeReturnUrl) is reused unchanged"

patterns-established:
  - "requireManagerLoader awaits requireSessionLoader first: anonymous visitors get sign-in with the return path, only a signed-in Admin is sent to /admin"

requirements-completed: [USER-08]

coverage:
  - id: D1
    description: "An Admin who opens /admin/users or /admin/audit-log is redirected to /admin by the route loader; a Manager stays; an anonymous visitor goes to sign-in with the return path"
    requirement: USER-08
    verification:
      - kind: unit
        ref: "web/src/modules/admin/guard.test.ts#requireManagerLoader (USER-08)"
        status: pass
      - kind: integration
        ref: "web/src/modules/admin/routes.test.tsx#Manager-only routes (USER-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "IN-17 fixed: only the exact roles Admin and Manager make a session; other casings, trailing space, unknown, empty and missing roles end the session as signed out with no console output"
    requirement: USER-08
    verification:
      - kind: unit
        ref: "web/src/modules/admin/services/session.test.ts#the role mapping fails closed (IN-17, USER-08)"
        status: pass
      - kind: integration
        ref: "web/src/modules/admin/routes.test.tsx#a session with an unknown role is sent to sign-in, never shown the Manager pages"
        status: pass
    human_judgment: false
  - id: D3
    description: "Six Phase 5 icons render through <Icon name /> from the installed lucide-react; the showcase icon grid shows 63"
    verification:
      - kind: unit
        ref: "web/src/components/brand/Icon.test.tsx#ICONS (App. D.5 names, D-32 aliases)"
        status: pass
      - kind: unit
        ref: "web/src/dev/ComponentShowcase.test.tsx#shows all 63 icons in a grid with their names"
        status: pass
    human_judgment: false
  - id: D4
    description: "Backstop: a Manager demoted while a Manager-only page is open is signed out by the next API call and redirected by the next loader (proven end to end by 05-23 and 05-37)"
    requirement: USER-08
    verification: []
    human_judgment: true
    rationale: "Depends on server-side session revocation (USER-05) from later plans; verified end to end in 05-23 revocation tests and 05-37 review"

duration: 22min
completed: 2026-10-17
status: complete
created: "2026-10-17T19:51:00-05:00"
updated: "2026-10-17T19:51:00-05:00"
---

# Phase 5 Plan 03: Manager-only route guard, fail-closed roles and six icons Summary

**requireManagerLoader guards /admin/users and /admin/audit-log (Admins redirected to /admin), the session now maps only the exact roles Admin and Manager (IN-17), and six lucide icons join ICONS**

## Performance

- **Duration:** about 22 min
- **Started:** 2026-10-17T19:27:00-05:00 (approximate; the start time was not captured)
- **Completed:** 2026-10-17T19:50:00-05:00
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- `requireManagerLoader` (guard.ts) awaits `requireSessionLoader` first, then throws `redirect('/admin')` unless the role is `manager`. Wired through a lazy `requireManager` wrapper in routes.tsx onto `users` and a new `audit-log` child route; both still render the not-found page until 05-20 and 05-33.
- IN-17 fixed test-first: `toUser` maps `Admin` to admin and `Manager` to manager only. `acceptSession` refuses anything else (clears token and snapshot); a refresh that brings such a role throws a 401 `HttpError` inside `requestSession`, so `ensureSession` resolves `null` and the shared client runs the existing session-ended path. No console output, no message posted to other tabs.
- Six icons (`copy`, `lock-open`, `key-round`, `user-x`, `user-check`, `history`) added after `minus` in ICONS from per-icon named lucide-react 1.53.0 imports. No package or lockfile change.
- Full `npm --prefix web run verify` passes (typecheck, lint, format, 153 test files / 4523 tests with coverage, build, budget build, license gate, notices).

## IN-17 outcome

Resolved. `session.ts` no longer defaults an unknown server role to Manager. The roles `manager`, `MANAGER`, `admin`, `Manager ` (trailing space), `Owner`, an empty role and a missing role each end the session as signed out (session.test.ts), and `/admin/users` with an `Owner` session lands on `/admin/login` (routes.test.tsx). The server's Manager policy (403) stays the real guarantee. 05-37 records this in `04-REVIEW-DISPOSITION.md`.

## TDD record

- **RED 1 (82f2e09):** 18 tests failed on the planned behavior: unknown roles still produced a Manager session (`expected { role: 'manager' } to be null`, a spurious 'refreshed' message), `requireManagerLoader is not a function`, and `/admin/audit-log` was not a route. Semantic assessment: every target failure is the planned assertion or the missing symbol, no fixture or import faults. One added regression test (a 401 followed by a refresh with an unknown role) already passed at RED because the replayed request 401s again and the existing path clears the session; it stays as a regression guard.
- **GREEN 1 (df84585):** all 445 admin-module tests passed.
- **RED 2 (1f98b90):** 15 failures: ICONS lacked the six keys, `<Icon name="history" />` had no component, the showcase grid held 57 not 63.
- **GREEN 2 (6be6b44):** brand and showcase tests pass, then full verify.
- No REFACTOR commit was needed. The `gsd_run check tdd-red-evidence` classifier was not run: the plan is `type: execute` with `tdd="true"` tasks, not a `type: tdd` plan.

## Task Commits

1. **Task 1: Tracer, Manager-only routes and fail-closed roles** - `82f2e09` (test, RED), `df84585` (feat, GREEN)
2. **Task 2: Six Phase 5 icons** - `1f98b90` (test, RED), `6be6b44` (feat, GREEN)

**Plan metadata:** recorded in the docs(05-03) commit that follows this summary.

## Files Created/Modified

- `web/src/modules/admin/services/session.ts` - exact role mapping, refused-role handling in `acceptSession`, `requestSession` and `completeSignIn`
- `web/src/modules/admin/guard.ts` - `requireManagerLoader`
- `web/src/modules/admin/routes.tsx` - lazy `requireManager` wrapper; guarded `users` and `audit-log` routes
- `web/src/components/brand/icons.ts` - six new icon imports and keys
- Tests: `session.test.ts`, `guard.test.ts`, `routes.test.tsx`, `Icon.test.tsx`, `ComponentShowcase.test.tsx`

## Decisions Made

- A refused role in a refresh is signalled as a 401 `HttpError` so one code path (the existing refresh-401 handling) covers it, instead of a new failure kind.
- `completeSignIn` with a refused role simply keeps no session; the guard then sends the person to sign-in on the next navigation.
- `devRoutes` are unchanged: they are dev-only and unguarded by design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Showcase test pinned 57 icons**
- **Found during:** Task 2
- **Issue:** `ComponentShowcase.test.tsx` asserted 57 icons, which the plan says grows to 63 automatically; the pinned count would fail once the six icons land. The file is not in the plan's `files_modified`.
- **Fix:** Updated the expectation and title to 63 in the RED commit.
- **Files modified:** `web/src/dev/ComponentShowcase.test.tsx`
- **Committed in:** 1f98b90

**2. [Rule 1 - Spec wording] Acceptance grep counts 5, not 6**
- **Found during:** Task 2
- **Issue:** The criterion `grep -c "'user-check'\|'user-x'\|'lock-open'\|'key-round'\|'history'\|  copy"` expects at least 6, but Prettier keeps `history: History,` unquoted (a valid identifier, like `plus: Plus`), so the quoted `'history'` pattern does not match and the line count is 5.
- **Fix:** None needed. All six keys are present (`grep -n "history:" icons.ts` shows line 139) and covered by Icon.test.tsx.

---

**Total deviations:** 2 (1 blocking test expectation, 1 criterion wording)
**Impact on plan:** No scope creep. No package or version change (`git diff --stat -- web/package.json web/package-lock.json` is empty).

## Issues Encountered

None. A first test helper left an unused variable that ESLint flagged and `exactOptionalPropertyTypes` rejected a `Partial` assignment; both were fixed before the GREEN commit.

## Known Stubs

The `users` and `audit-log` routes render the existing not-found page on purpose (plan scope): 05-20 and 05-33 replace them. No data stubs.

## Threat Flags

None. The guard narrows access (T-05-05, T-05-06 mitigated; T-05-07 unchanged because `safeReturnUrl` is reused and the Manager redirect target is the constant `/admin`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for the Users page (05-20) and Audit Log page (05-33): both mount behind `requireManager` already.
- The six icons are available for the roster, profile and audit screens.

## Self-Check: PASSED

- Files modified exist and are committed; `git status` is clean.
- Commits 82f2e09, df84585, 1f98b90 and 6be6b44 are ancestors of HEAD.
- Acceptance: `requireManagerLoader` export count 1; `requireManager` appears 5 times in routes.tsx; `audit-log` appears once; no package files changed.
- `npm --prefix web run verify` exit 0.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-17*

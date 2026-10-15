---
phase: 04-identity-authentication
plan: 25
subsystem: auth
tags: [web, session, bearer, refresh, web-locks, broadcast-channel, route-guard, return-url, cwe-601, auth-05, auth-06, d-07, d-20, r2-09]
status: complete
created: "2026-10-15T00:58:00-05:00"
updated: "2026-10-15T00:58:00-05:00"

requires: ["04-15"]
provides:
  - "core/api configureSession({ accessToken, refresh, onUnauthorized }) on the shared apiClient: Bearer header from the hook, X-CSPS-CSRF: 1 on every request, 401 refresh single flight and sign-out through the hooks"
  - "modules/admin/services/authService.ts: createAuthService/authService (signIn, verifyCode, resendCode, refresh, signOut, signOutOthers); all but signOutOthers pass skipAuthRefresh"
  - "modules/admin/services/session.ts: in-memory session (createSession factory plus the shared instance): ensureSession, refreshSession, acceptSession, clearSession, signOut, getSessionUser, getSessionSnapshot, subscribeSession, setNavigator, setSignInNotice/takeSignInNotice, setPendingEmail/getPendingEmail"
  - "modules/admin/hooks/useSession.ts (useSyncExternalStore over the session)"
  - "modules/admin/guard.ts: safeReturnUrl (D-07), requireSessionLoader, redirectIfSignedInLoader"
  - "Route lists adminRoutes (guarded, every build) and devRoutes (unguarded previews and /dev/components, dev-route builds only); AdminNotFoundPage inside the shell for Orders, Expenses, Users and My Profile until Phases 5-9"
  - "AdminLayout: the shell shows the loader's user; Logout signs out then goes to /admin/login; the layout registers the session navigator"
  - "Production builds now contain the guarded admin shell; dev showcase and preview copy stay out (build-output and budget rules)"
affects: [04-26, 04-27, 04-28, 04-29, 04-30]

requirements-completed: []

actuals:
  tokens: 19800
  tasks: 3
  commits: 7
plan_head_before: 4a01e941ef9c4ff24314b068d0b5082a6afc2aa3
plan_head_after: f5caf01c59ec756eb1ed32c648043cd869230407

tech-stack:
  added: []
  patterns:
    - "Session code is reached from the router only through dynamic imports (the guard wrapper in routes.tsx), so the public entry never carries it (PERF-01)"
    - "createSession(deps) factory with injectable locks, channel, sleep and clock; the shared instance registers itself with configureSession at module load"
    - "Admin layout reads its user from the route loader (session user or DEV_USER), with a type guard and an error screen instead of a made-up user"
    - "Dev-only routes in devRoutes come first in the route list so a preview wins where a guarded route has the same path (Pitfall 11)"

key-files:
  created:
    - web/src/core/api/apiClient.test.ts
    - web/src/modules/admin/services/authService.ts
    - web/src/modules/admin/services/authService.test.ts
    - web/src/modules/admin/services/session.ts
    - web/src/modules/admin/services/session.test.ts
    - web/src/modules/admin/hooks/useSession.ts
    - web/src/modules/admin/hooks/useSession.test.tsx
    - web/src/modules/admin/guard.ts
    - web/src/modules/admin/guard.test.ts
    - web/src/modules/admin/routes.test.tsx
    - web/src/modules/admin/pages/AdminNotFoundPage.tsx
    - web/src/modules/admin/previewCopy.ts
    - web/src/test/sessionFixtures.ts
  modified:
    - web/src/core/api/apiClient.ts
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/sections.ts
    - web/src/modules/admin/copy.ts
    - web/src/modules/admin/pages/AdminPreviewPage.tsx
    - web/src/core/routes/router.tsx
    - web/src/layouts/AdminLayout.tsx
    - web/src/layouts/AdminLayout.test.tsx
    - web/src/layouts/PublicLayout.test.tsx
    - web/src/dev/ComponentShowcase.test.tsx
    - web/src/dev/previews/AdminShell.tsx
    - web/src/dev/previews/OpenedNavDrawer.tsx
    - web/src/test/build-output.node.test.ts
    - web/scripts/budget.ts
    - web/scripts/budget.test.ts
    - web/scripts/vite-budget-plugin.test.ts
    - web/e2e/admin-keyboard.spec.ts
    - docs/web/budgets.md

key-decisions:
  - "Only a 401 from the refresh call ends the session. A busy refresh (409 auth.session-busy, orchestrator note from 04-15) is retried once; a second 409, a network error or a 5xx rejects the request but keeps the session and does not navigate"
  - "A tab skips its refresh only when a peer tab announced a fresh refresh while it waited for the lock and its own token has more than 60 s left; tabs cannot share a token (it never crosses the channel), so an expired tab always refreshes, one after another"
  - "A peer sign-out only affects a tab that has a session, so a tab sitting on the sign-in page never gets a stray 'session ended' notice"
  - "Orders, Expenses, Users and My Profile stay as guarded routes that render an in-shell 'Page not found' screen; /admin goes to /admin/sessions (D-43)"
  - "The session navigator is registered by AdminLayout (useNavigate), not by router.tsx, so the public entry does not import the session module"

patterns-established:
  - "Route-level redirects only from loaders (throw redirect), never <Navigate>"

coverage:
  - id: C1
    description: "AUTH-05: the access token lives only in session.ts memory; every call sends it as Bearer and X-CSPS-CSRF: 1; nothing is written to storage, cookies, URLs or the channel"
    requirement: "AUTH-05"
    verification:
      - "apiClient.test.ts (Bearer, no header without a token, CSRF header always); session.test.ts 'keeps the token, the code and the email out of every browser store' and 'announces a refresh with the expiry only'; acceptance grep: no localStorage in session.ts code lines"
  - id: C2
    description: "Opening /admin/* without a session runs one refresh and lands on /admin/login?returnUrl=<path> through a loader redirect; with a session the shell shows the real name and role"
    requirement: "AUTH-05"
    verification:
      - "routes.test.tsx (one refresh request with X-CSPS-CSRF, search '?returnUrl=%2Fadmin%2Forders', query kept, real name and role, /admin goes to /admin/sessions)"
  - id: C3
    description: "D-07: safeReturnUrl accepts only same-origin /admin paths that are not the sign-in area; absolute, '//', backslash, '..', control characters and encoded or double-encoded forms fall back to /admin"
    requirement: "AUTH-05"
    verification:
      - "guard.test.ts (4 accepted, 20 rejected cases, both loaders)"
  - id: C4
    description: "AUTH-06 multi-tab: refresh single flight in a tab and across tabs (Web Locks, in-tab fallback), StrictMode double boot sends one refresh, a peer's fresh refresh lets a fresh tab skip its request"
    requirement: "AUTH-06"
    verification:
      - "session.test.ts 'refreshSession single flight' (6 tests, fake locks and channel hub)"
  - id: C5
    description: "R2-09: an unrecoverable 401 or a sign-out in another tab clears the tab, leaves the 'session-ended' notice and goes to /admin/login; Logout signs out, clears even when the server call fails, tells other tabs and leaves the 'signed-out' notice"
    requirement: "AUTH-06"
    verification:
      - "session.test.ts (sign-out and other tabs, failures, shared client wiring); AdminLayout.test.tsx (Logout from sidebar, drawer and user menu, server failure, session ended through the client); e2e admin-keyboard Logout lands on /admin/login"
  - id: C6
    description: "D-20 reversal: the production build contains the guarded admin app and no dev showcase or preview copy; budgets unchanged and met"
    requirement: "AUTH-05"
    verification:
      - "build-output.node.test.ts (no asset carries 'Open Component Showcase', 'Component Showcase' or 'Development only'; assets carry 'CSPS Admin' and 'returnUrl'); budget.test.ts and vite-budget-plugin.test.ts; npm run verify exit 0"
  - id: C7
    description: "Pitfall 11: dev-route builds keep serving the previews and /dev/components unguarded"
    requirement: "AUTH-05"
    verification:
      - "routes.test.tsx (dev routes render with no refresh request); AdminLayout.test.tsx and ComponentShowcase.test.tsx over the dev tree; e2e admin, admin-keyboard and showcase specs on chromium (18 passed)"
---

# Phase 4 Plan 25: Web Session, Guard and Multi-Tab Refresh Summary

The web app now has a real staff session: an in-memory access token on the shared client, a cookie-based refresh that is single flight across tabs, a guarded `/admin` tree with a safe return path, the signed-in user and a working Logout in the shell, and the admin app in production builds behind that guard.

## What was built

- **Tracer (Task 1):** `configureSession` on `core/api/apiClient.ts` (Bearer header from the hook, `X-CSPS-CSRF: 1` on every request, the client's refresh and unauthorized hooks delegate to the session). `authService`, a first `session.ts` (`ensureSession` with one boot promise, `refreshSession`), `guard.ts` (`safeReturnUrl`, `requireSessionLoader`, `redirectIfSignedInLoader`), and the guarded `admin` layout route. `/admin/orders` without a session makes one refresh and lands on `/admin/login?returnUrl=%2Fadmin%2Forders`; with a session the shell shows the real user from the loader.
- **Multi-tab and sign-out (Task 2):** `createSession` factory with Web Locks `csps-refresh` (in-tab single flight where locks are missing), `BroadcastChannel('csps-auth')` carrying only `{type:'refreshed', expiresAt}` and `{type:'signed-out'}`, `signOut()`, the typed one-shot notices, the in-memory pending email, `setNavigator`, `subscribeSession` and `useSession`.
- **Production admin (Task 3):** `adminRoutes` (guarded, every build) and `devRoutes` (unguarded previews and `/dev/components`, dev-route builds only, placed first in the route list). `AdminLayout` reads its user from the loader and Logout signs out then goes to `/admin/login`. The build-output test and the budget rules now expect the admin app in production and still refuse the showcase, the preview page and their copy.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | /admin/orders without a session refreshes once and lands on sign-in with the return path; with a cookie the shell shows the real user | fe735e1 (RED), 460a20b |
| 2 | Multi-tab single-flight refresh, sign-out, one-shot notices, pending email | 5390919 (RED), cbbd7d5 |
| 3 | Admin code in production behind the guard, real user and Logout | 75fa9b7 (RED), 04ebbee, f5caf01 (budget docs) |

Tracer gate: interactive, `human_verify_mode` end-of-phase, automated-only `<verify>`. The verify commands (`src/core/api` and `src/modules/admin` tests, typecheck) were re-run after GREEN and passed before expanding.

## RED / GREEN evidence

- Task 1 RED: `configureSession` was not a function (6 apiClient tests failed), `./guard` did not exist, the route tests could not resolve `session`. GREEN: apiClient 7, guard 29, routes 5 pass.
- Task 2 RED: `createSession`, `signOut`, notices and the other exports did not exist. GREEN: session 30, authService 12, useSession 1.
- Task 3 RED: 11 tests failed (Logout, session-ended navigation, the build-output positive checks against the old build, the budget rule changes). GREEN after the layout and budget changes and a fresh production build.

## Verification

- `npm --prefix web run typecheck` clean; `npx eslint . --max-warnings 0` clean; Prettier clean.
- `npm --prefix web run verify` exit 0 (tests with coverage 3280 tests, build, budget build, license gate, notices). Coverage: statements 98.24%, branches 96.52%, functions 99.52%, lines 99.73%. `core/api` stays at 100% (apiClient.ts fully covered).
- E2E (chromium, after the preflight; ports 5180, 5115, 7028, 5199 free): `admin`, `admin-keyboard` and `showcase` specs, 18 passed, including Logout landing on `/admin/login`.

## Bundle sizes (gzip -9, 1 KB = 1000 B)

| Build | Before | After | Limit |
|---|---|---|---|
| Production public JS | 130.40 KB (docs, 2026-10-13) | 130.16 KB | 150 KB |
| Production CSS | 12.92 KB | 13.04 KB | 35 KB |
| Dev-route (budget/e2e) public JS | 149.70 KB (docs, before the barrel fix) | 132.75 KB | 150 KB |
| Dev-route (budget/e2e) admin JS | 154.86 KB (docs) | 160.67 KB | 250 KB |

Admin initial JS is not measured in the production build (unchanged rule); the production admin chunks are AdminLayout 10.1 KB, session 4.3 KB, UrlStateLayout 4.2 KB, AdminNotFoundPage and guard under 1 KB each. No limit was raised. The "before" numbers are the last documented ones; the dev-route "before" is from before the barrel split, so its drop is not caused by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A 409 auth.session-busy refresh would have signed the user out** (orchestrator note from plan 04-15)
- **Found during:** Task 2 design.
- **Issue:** the shared client treats any rejected refresh as "session over" and calls `onUnauthorized`. Two tabs losing a save race get a 409 with the cookie kept; ending the session there would sign people out for a retryable condition.
- **Fix:** `requestSession` retries a 409 once after 250 ms. The session records how the last refresh failed; `handleUnauthorized` ignores a failure that was not a 401 (second 409, network error, 5xx). The failed request still rejects, the session and the tab stay. Tested at the unit level and through the real client (409 then 200 replays the request; two 409s keep the session).
- **Files modified:** web/src/modules/admin/services/session.ts, session.test.ts
- **Commit:** cbbd7d5

**2. [Rule 3 - Blocking] Production builds and the budget rules refused the admin app**
- **Found during:** Task 3.
- **Issue:** `DEV_ONLY_MODULE_PREFIXES` in `web/scripts/budget.ts` failed any production chunk with `src/modules/admin/` or `src/layouts/AdminLayout`, so the D-20 reversal could not build. `scripts/budget.ts`, its tests and `docs/web/budgets.md` were not in the plan's file list.
- **Fix:** the prefixes are now `src/modules/admin/pages/AdminPreviewPage`, `src/modules/admin/previewCopy`, `src/dev/`, `visual/`. Tests (`budget.test.ts`, `vite-budget-plugin.test.ts`) and the docs rule text follow, plus a measured-sizes table.
- **Commit:** 04ebbee, f5caf01

**3. [Rule 3 - Blocking] The dev preview copy lived in the shared admin copy file**
- **Found during:** Task 3 (build-output must not find "Development only" or "Open Component Showcase").
- **Issue:** `ADMIN_COPY.preview` sat in `copy.ts`, which the production AdminLayout and not-found page import.
- **Fix:** moved to `modules/admin/previewCopy.ts` (`PREVIEW_COPY`), imported only by AdminPreviewPage. `ADMIN_COPY.logoutToast` is gone with the dev toast.
- **Commit:** 460a20b, 04ebbee

**4. [Rule 3 - Blocking] `/admin/login` had no route of its own, so a guarded splat would loop**
- **Found during:** Task 1 design.
- **Issue:** a catch-all child under the guarded `admin` layout would also match `/admin/login` (plans 04-26/04-27 add it) and redirect to itself.
- **Fix:** the guarded layout lists only `index`, `orders`, `expenses`, `users` and `profile`. Until 04-26 adds the sign-in routes, `/admin/login` and `/admin/sessions` fall through to the public placeholder.
- **Commit:** 460a20b

### Plan interpretation

- **Cross-tab "skip":** the plan says the second tab skips its request when the first already refreshed. A tab cannot receive the first tab's token (it never crosses the channel), so a tab with an expired token must refresh, serialised by the lock. It skips only when a peer announced a fresh refresh while it waited and its own token has more than 60 s left. Documented in `session.ts` and tested both ways.
- **Navigator registration:** done in `AdminLayout` (`useNavigate` in an effect) instead of in `router.tsx`, because importing the session module in the router would put it in the public entry. The sign-in routes' layout (04-26/04-27) must register the navigator the same way.
- **Dev preview Logout:** the plan makes Logout real everywhere, so the dev previews no longer show the "Not available yet" toast. `e2e/admin-keyboard.spec.ts` now expects the URL to end in `/admin/login`. The Phase 2 visual and parity suites were not changed and were not run.
- **New files outside the plan list:** `AdminNotFoundPage.tsx`, `previewCopy.ts`, `src/test/sessionFixtures.ts`, `hooks/useSession.test.tsx`. Existing tests that assumed the old tree were adapted: `PublicLayout.test.tsx` (`/admin/orders` is no longer an unknown path), `AdminLayout.test.tsx` and `ComponentShowcase.test.tsx` (the dev tree is now `devRoutes` in front of the public routes).
- `acceptSession` and `clearSession` are exported besides the plan's list (sign-in completion in 04-26/04-27 and tests use them).

## Decisions for the owner

- **No requirement ticked.** AUTH-05 and AUTH-06 still need the sign-in screens (04-26/04-27), the devices page and the E2E proof (04-29/04-30). Say so if you want the browser halves ticked now.
- **Interim production behaviour (the plan's human check, end of phase):** in a production build, signed-in staff go from `/admin` to `/admin/sessions`, which does not exist until a later plan, so it shows the public placeholder for now. Orders, Expenses, Users and My Profile open a "Page not found" screen inside the admin shell (new wording: "Nothing here yet. This screen is not available yet. Use the menu to go to another page."). Confirm this is acceptable for the Phase 3 staging deploy, or say what those items should show.
- **"Session ended" returns to a plain `/admin/login`** (no returnUrl), as the plan says. If you would rather bring people back to the page they were on after an expired session, that is a small change.
- **Sign-out copy and the 250 ms retry delay** are conservative defaults; both are easy to change.

## Known Stubs

None that hide data. `AdminNotFoundPage` is an intentional placeholder for the Phase 5-9 admin screens; `/admin` goes to `/admin/sessions` until the S7 page (a later Phase 4 plan) exists.

## Threat Flags

None beyond the plan's threat model. T-04-88 (token storage) is proven by the store-spy test and channel-content tests; T-04-89 (open redirect) by the `safeReturnUrl` table and loader-only redirects; T-04-90 by the guard on the layout loader plus the build-output and budget rules; T-04-91 by the lock, boot de-dupe and 409 retry tests. No installs.

## Self-Check: PASSED

All created and modified files exist, and commits fe735e1, 460a20b, 5390919, cbbd7d5, 75fa9b7, 04ebbee and f5caf01 are ancestors of HEAD.

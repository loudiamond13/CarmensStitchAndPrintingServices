---
phase: 12-consent-analytics-legal
plan: 31
subsystem: web-performance
tags: [react-router, patchRoutesOnNavigation, bundle-budget, consent-cookie, vitest, playwright, xunit]
created: "2026-11-16T23:10:00-06:00"
updated: "2026-11-16T23:10:00-06:00"
status: complete

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-03 consent cookie codec and shared fixture; 12-05 legal routes that pushed the entry over 150 KB"
provides:
  - "Lazy discovery of the admin and dev route tables (D-42): the public entry holds neither"
  - "Budget rule that fails any public initial chunk holding src/modules/admin/routes.tsx"
  - "Consent cookie D-43 rule on both sides: a decision day after today is no choice"
affects: [12-09, 12-13, 12-23]

actuals:
  tokens: 14600
  tasks: 3
  commits: 8
plan_head_before: e83312adbe77a2642b8d20546f4fd49707e67f1d
plan_head_after: 3a9732aa6e0d6477c2ab7cf45bb1eeae0d3f4129
commits: 8

tech-stack:
  added: []
  patterns:
    - "Route tables load on first navigation through createBrowserRouter patchRoutesOnNavigation (routeDiscovery)"
    - "One date rule per side for the consent cookie (isCurrentChoice in TS, IsCurrent in C#), shared fixture proves both agree"

key-files:
  created:
    - web/src/modules/admin/devRoutes.tsx
    - web/src/core/routes/router.test.tsx
  modified:
    - web/src/core/routes/router.tsx
    - web/src/modules/admin/routes.tsx
    - web/scripts/budget.ts
    - web/scripts/budget.test.ts
    - web/scripts/vite-budget-plugin.test.ts
    - web/scripts/vite-budget-plugin.ts
    - web/src/modules/admin/routes.test.tsx
    - web/src/layouts/AdminLayout.test.tsx
    - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
    - web/e2e/shell.spec.ts
    - web/e2e/auth-overflow.spec.ts
    - docs/web/budgets.md
    - tests/fixtures/consent-cookie-cases.json
    - src/Csps.Domain/Analytics/ConsentCookie.cs
    - tests/Csps.Domain.UnitTests/Analytics/ConsentCookieTests.cs
    - web/src/modules/public/consentCookie.ts
    - web/src/modules/public/consentCookie.test.ts

key-decisions:
  - "D-42 applied: limit stays 150_000, no file exception; the admin table and dev table load lazily"
  - "D-43 applied: future-dated cookie is no choice; GPC still wins (D-20)"
  - "A failed table load patches one segment/* route with AdminRootErrorBoundary instead of throwing"

patterns-established:
  - "routeDiscovery skips a path when its matches already hold the QUERY_ROUTE_ID route, so no closure state is shared between routers"
  - "Tests that need the admin sign-in screens over the app tree pass patchRoutesOnNavigation: discoverRoutes"

requirements-completed: [ANL-07, LEGAL-05]

metrics:
  duration: 86min
  completed: 2026-11-16
---

# Phase 12 Plan 31: Room in the public first download again, and no consent cookie can date itself into the future Summary

**The admin and dev route tables now load on the first navigation under /admin or /dev, which frees about 2.4 KB gzip on every public route (all nine rows at or under 147.51 KB, limit unchanged at 150 KB), and a consent cookie dated after today is treated as no choice on both sides.**

## What was built

- **D-42, route discovery.** `router.tsx` no longer imports the admin route module. `routeDiscovery(tables)` returns a `patchRoutesOnNavigation` function. It reads the first path segment, finds its table, skips when the matches already hold the `QUERY_ROUTE_ID` route, otherwise awaits `load()` and patches the children into that route. `discoverRoutes` holds the admin table, plus the dev table only inside the `__DEV_ROUTES__` branch. `devRoutes` moved to its own module `devRoutes.tsx`.
- **Failed load.** A rejected `load()` patches one `segment/*` route with `AdminRootErrorBoundary`, so the visitor sees the admin error screen with Reload Page, the same screen a failed admin layout chunk shows today.
- **Budget gate.** The one-file admin allow-list is gone. A public initial chunk holding `src/modules/admin/routes.tsx` now fails both builds with the PERF-02 message. `ADMIN_ROUTE` and `ADMIN_SIGN_IN_ROUTE` list the route table chunk, so admin JS is measured honestly. `BUDGETS.publicJs` is still 150_000.
- **D-43.** `isCurrentChoice` (TS) and the private `IsCurrent` (C#) hold the version (D-22), future-day (D-43) and 12-month (ANL-07) rules once per side. `needsChoice` and `AllowsStats` follow them. The shared fixture gained five future-dated needsChoice cases (one GPC, one pending, one Reject All), four future-dated allowsStats cases and the year-9999 saturation pair. Both suites assert those cases stay in the file.

## Before and after (gzip -9, 1 KB = 1000 B, from the numbers files)

`npm run build` (production):

| Measure | Before (plan base) | After |
|---|---|---|
| Home | 149.88 KB | 147.47 KB |
| Products | 146.55 KB | 144.16 KB |
| Gallery | 147.92 KB | 145.51 KB |
| Contact | 149.92 KB | 147.48 KB |
| Privacy | 144.98 KB | 142.54 KB |
| Cookies | 144.98 KB | 142.54 KB |
| Terms | 144.97 KB | 142.53 KB |
| Accessibility | 144.98 KB | 142.54 KB |
| Not found | 142.63 KB | 140.18 KB |
| Admin JS | 219.44 KB | 221.07 KB |
| CSS | 20.13 KB | 20.13 KB |

`npm run build:budget`:

| Measure | Before (plan base) | After |
|---|---|---|
| Home | 150.09 KB (OVER) | 147.50 KB |
| Products | 146.76 KB | 144.19 KB |
| Gallery | 148.13 KB | 145.54 KB |
| Contact | 150.13 KB (OVER) | 147.51 KB |
| Privacy | 145.19 KB | 142.57 KB |
| Cookies | 145.19 KB | 142.57 KB |
| Terms | 145.18 KB | 142.56 KB |
| Accessibility | 145.19 KB | 142.57 KB |
| Not found | 142.83 KB | 140.21 KB |
| Admin JS | 221.57 KB | 223.05 KB |
| CSS | 20.13 KB | 20.13 KB |

Admin JS rose by about 1.5 to 1.6 KB because the route table is now its own counted chunk (still 27 KB under 250 KB). The numbers gate (`node -e` from the plan) exits 0: nine rows, every one at or under 149,000 bytes, admin JS at or under 250,000.

## Notes for plans 12-09 and 12-13

- **Room left.** The tightest row is Contact: 147.48 KB (production) and 147.51 KB (budget build), so 2.52 KB and 2.49 KB under the 150 KB limit, and 1.48 KB and 1.49 KB of margin below the 149 KB target. The 12-09 consent bar loader and the 12-13 footer legal row must fit in that room together, or load lazily.
- **12-09, the date.** The consent store must pass the Asia/Manila business day as `today`, not the device date. A device zone behind Manila would make a cookie the server set today look future-dated under D-43 and re-ask. `consentCookie.ts` reads no clock, by design.
- **12-09, one rule.** Use `isCurrentChoice(cookie, { currentVersion, today })` to derive `statsAllowed` and `mapAllowed` from a saved cookie (stats and map permission), so the version, future-day and 12-month rules are never re-written in the store.
- **12-23.** `routes.tsx` and `routes.test.tsx` changed here (devRoutes moved out; every router in `routes.test.tsx` passes `patchRoutesOnNavigation: discoverRoutes`). Plan 12-23 starts from that shape.

## Evidence

- TDD per task: RED commit with failures, then GREEN.
  - Task 1 RED: `router.test.tsx`, "Tests 8 failed | 2 passed (10)", `TypeError: routeDiscovery is not a function`.
  - Task 2 RED: 14 cases failed across `budget.test.ts` and `vite-budget-plugin.test.ts`.
  - Task 3 RED: 13 web cases failed (`isCurrentChoice is not a function`, five needsChoice cases) and 4 C# cases failed (`AllowsStats ... should be False but was True`).
- Task 1 verify set (router, routes, AdminLayout, ComponentShowcase, ErrorBoundary, NotFound, LegalPages, public-paths): "Test Files 8 passed (8), Tests 224 passed (224)".
- `scripts/budget.test.ts` and `scripts/vite-budget-plugin.test.ts`: "Tests 127 passed (127)".
- `consentCookie.test.ts` and `no-long-dash.node.test.ts`: "Tests 87 passed (87)".
- `dotnet test --project tests/Csps.Domain.UnitTests`: "total: 2208, failed: 0, succeeded: 2208". `ConsentCookieTests` class: 62 passed. `dotnet build --no-incremental`: 0 warnings, 0 errors.
- `src/test/build-output.node.test.ts`: "Tests 29 passed (29)" (no /dev/ path in production).
- `npm --prefix web run lint` (`--max-warnings 0`), `typecheck` and `prettier --check` on the changed files: clean.
- Full web suite: "Tests 1 failed | 10856 passed (10857)". The one failure is unrelated (see Deferred Issues).
- E2E (`npm --prefix web run e2e -- --grep "@admin|@auth|@shell|@public"`, after the preflight reported the ports free): final run "417 passed", 2 failed (Firefox font-abort flake, see below). Run 1 of the same set: 411 passed, 8 failed; 6 of those passed on a quiet rerun and the other 2 are the WebKit item below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AdminLayout tests needed discovery for the sign-in screens**
- **Found during:** Task 1 verify
- **Issue:** the plan changed one router in `AdminLayout.test.tsx` (the '/admin/sessions' case). The `renderAt` helper builds the dev tree and the Logout cases navigate to `/admin/login`, which now comes only from the discovered admin table, so 3 tests failed. A file-wide wrapper (as in `routes.test.tsx`) broke three synchronous `path: '*'` tests, because a splat match now triggers the patch function.
- **Fix:** `renderAt` and the '/admin/sessions' router pass `patchRoutesOnNavigation: discoverRoutes`. No assertion changed.
- **Files modified:** `web/src/layouts/AdminLayout.test.tsx`
- **Commit:** 551900fe

**2. [Rule 1 - Bug] WebKit e2e timing of the heavy /dev/components page**
- **Found during:** final e2e checks
- **Issue:** `/dev/components` (the showcase, dev builds only) shows its h1 about 7 s after the first request in WebKit in BOTH the old and the new build (measured: 6.8 to 7.8 s new, 6.9 to 7.7 s old). The new build fires the load event earlier (about 0.7 to 1.0 s against 1.5 to 2.7 s), so the 5 s default wait after `goto` ran out. Measured with the base router files and a temporary limit: 6 of 6 passed at base, 3 of 6 failed on the new build before the fix.
- **Fix:** 20 s wait for the h1 or main in `shell.spec.ts` (`openAt`, the sweep) and `auth-overflow.spec.ts`. Test-only change; nothing the visitor sees changed. Other specs outside the requested grep that open `/dev/components` (`@showcase`, `@motion`, `@a11y-rulings` and others) were not run and may need the same wait.
- **Files modified:** `web/e2e/shell.spec.ts`, `web/e2e/auth-overflow.spec.ts`
- **Commit:** 275974df

**3. [Rule 3 - Blocking] A stale comment named the removed route list**
- **Fix:** `vite-budget-plugin.ts` comment now cites `devRoutes.tsx` (the module that is tree-shaken to nothing behind the literal-false `__DEV_ROUTES__`).
- **Commit:** 25a4455e

### Note on the commit trailer

The plan and the orchestrator ask for `Co-Authored-By: Claude Opus 5.5`. This run is Claude Sonnet 5.5 and the session attribution rule says to sign with that name, so commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Deferred Issues

- **Firefox font-abort e2e flake (pre-existing).** Firefox sometimes reports `downloadable font: download failed ... status=2152398850` (a request aborted when a test ends or resizes) as a console error, and the console guard fails that test. Different tests fail each run (run 1: `auth-multitab`, `shell full bleed`; final run: `admin tablet rail`, `shell tab bar 375x812`), and each passes alone. Measured with `--repeat-each 8` on two Firefox tests: new build 1 of 16 failed, base router files (temporary limit) 5 of 16 failed. So this plan did not cause it and did not make it worse. Two Firefox tests also hit `page.goto` timeouts in run 1 while another job loaded the machine; they passed on rerun. Needs an owner call: ignore font aborts in the console guard for Firefox, or preload the Archivo latin-ext font.
- **`scripts/license-policy.test.ts` fails in this worktree.** `exits 1 on a stricter policy given through --exceptions` fails with `No packages found in this path...` (the license checker finds no packages here). It fails alone, and nothing this plan touched is near `license-gate.mjs`. Probably the worktree path. Re-run it in the main checkout.
- **Other `/dev/components` e2e specs** outside the requested grep (see deviation 2) were not run.

## Known Stubs

None.

## Threat Flags

None. The mitigations of T-12-76 (future-dated cookie), T-12-78 (admin routes keep every guard loader and the whole `routes.test.tsx` suite runs through discovery), T-12-79 (the dev table is imported only in the literal `__DEV_ROUTES__` branch and `build-output.node.test.ts` passes) and T-12-80 (failed table load shows the admin error screen, tested in `router.test.tsx`) are in place. No package was added or bumped.

## Self-Check: PASSED

- Created files found: `web/src/modules/admin/devRoutes.tsx`, `web/src/core/routes/router.test.tsx`.
- Modified files found: `router.tsx`, `docs/web/budgets.md`, `tests/fixtures/consent-cookie-cases.json`.
- All 8 plan commits are on the branch (`git log e83312ad..HEAD`): 3e8988b4, 551900fe, 48acd9fc, 25a4455e, df298840, 2ac018f3, 275974df, 3a9732aa. The SUMMARY commit follows them.

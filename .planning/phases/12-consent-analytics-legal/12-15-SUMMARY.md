---
phase: 12-consent-analytics-legal
plan: 15
subsystem: public-web-analytics
tags: [page-views, beacon, privacy, keepalive, consent-bar, bundle-budget, tdd]
created: "2026-11-17T06:50:00-06:00"
updated: "2026-11-17T06:50:00-06:00"
status: complete

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-09 consentStore (needsChoice, GPC, subscribe) and the decided test default; 12-10 POST /api/v1/analytics/page-views (204, CSRF header, staff and bots dropped); 12-31 and 12-32 entry room"
provides:
  - "usePageViewBeacon / createBeaconMachine: one page-view beacon per public route change, path only, with the pending landing view"
  - "analyticsService.pageView (OR-5) with an opt-in keepalive; plan 12-16 adds vitals to the same service"
  - "httpClient RequestConfig.keepalive: passed to fetch only when set"
  - "MSW pageViewHandler (204 default in test setup) and pageViewProbe (records body and CSRF header)"
affects: [12-14, 12-16, 12-13, 12-24]

actuals:
  tokens: 7400
  tasks: 3
  commits: 6
plan_head_before: e9a110c3b00517baabc84f29400c89089d2c581f
plan_head_after: d94c26ae15da5070f92771bde3171c915c92283a
commits: 6

tech-stack:
  added: []
  patterns:
    - "A pure state machine (createBeaconMachine) holds at most one pending landing view; the hook only wires it to the consent store and visibilitychange"
    - "The first download holds the hook only; the service and the HTTP client load through a dynamic import, warmed while a view is held so a hidden-page keepalive send is not waiting on a chunk"

key-files:
  created:
    - web/src/modules/public/hooks/usePageViewBeacon.ts
    - web/src/modules/public/hooks/usePageViewBeacon.test.tsx
    - web/src/modules/public/services/analyticsService.ts
    - web/src/modules/public/services/analyticsService.test.ts
  modified:
    - web/src/core/api/http/httpClient.ts
    - web/src/core/api/http/httpClient.test.ts
    - web/src/layouts/PublicLayout.tsx
    - web/src/layouts/PublicLayout.test.tsx
    - web/src/test/msw.ts
    - web/src/test/setup.ts

key-decisions:
  - "The beacon sends location.pathname only and never reads location.search or location.hash; the referrer is cut to its hostname on the landing view only"
  - "The machine counts the same path twice in a row once, so React StrictMode (effects run twice) cannot double-count in development"
  - "The hook skips /admin and /dev paths (the server drops them too), because /dev/public renders inside PublicLayout"
  - "While a landing view is held, the analytics chunk is loaded early so a keepalive send on a hidden page does not wait for it"

requirements-completed: [ANL-05, ANL-06]

metrics:
  duration: 4h50m
  completed: 2026-11-17
---

# Phase 12 Plan 15: Each page a visitor opens is counted once, with the address cut to the page and nothing more Summary

**The public layout now sends one `POST /api/v1/analytics/page-views` per route change with `{ path: location.pathname }` only (the first view of a load adds the referrer hostname), holds the landing view while the cookie bar asks and sends it exactly once (on the choice, on the next route change, or on a hidden page with keepalive), and drops any failure silently. It costs about 0.59 KB in every public row (Home 145.57 to 146.16 KB in the budget build, limit 150).**

## What was built

- **`httpClient.ts`:** `RequestConfig.keepalive?: boolean`. `sendWithFetch` adds `keepalive: true` to the fetch init only when the request sets it, so every other request is byte for byte what it was. The XHR (upload progress) path is untouched.
- **`analyticsService.ts`:** `AnalyticsService.pageView(body, options?)` posts to `/analytics/page-views` over the shared client (so the `X-CSPS-CSRF: 1` header comes with it). No idempotency key, so the client never retries it (a network failure or 503 is not retried for a POST without a key). `PageViewBody` is `{ path, referrerHost? }`, the same shape as the generated `PageViewRequest`. `createAnalyticsService` and `analyticsService` exported.
- **`usePageViewBeacon.ts`:** `createBeaconMachine(send)` with `view(path, { landing, needsChoice, referrerHost? })`, `choiceMade()` and `hidden()`. The hook builds the machine once, sends through `import('../services/analyticsService')`, subscribes to `consentStore` (needsChoice going false calls `choiceMade`) and to `visibilitychange` (hidden calls `hidden`), and removes both on unmount.
- **`PublicLayout.tsx`:** one line, `usePageViewBeacon(pathname)`.
- **Tests support:** `web/src/test/msw.ts` has `pageViewHandler(status = 204)` and `pageViewProbe(status)`; `setup.ts` answers page views with 204 by default so every existing public test stays green.

## TDD gate sequence

| Step | Commit | Evidence |
|------|--------|----------|
| Task 1 RED | cac8aeaf | `Test Files  4 failed (4)`, `Tests  12 failed \| 76 passed (88)`; the stubs compile and send nothing (`expected [] to have a length of 1 but got +0`, `expected undefined to be true` for keepalive) |
| Task 1 GREEN | 187462f1 | `Test Files  7 passed (7)`, `Tests  206 passed (206)` (httpClient suites, analyticsService, usePageViewBeacon, PublicLayout) |
| Task 2 RED | 996a5221 | `Test Files  1 failed (1)`, `Tests  11 failed \| 10 passed (21)`: hold, flush on choice, on the next route, on hidden with keepalive, StrictMode double count, listener cleanup, /admin and /dev |
| Task 2 GREEN | a0fcb809 | first run `1 failed \| 20 passed` (one test compared the order in which two requests reached the mock server; a sent order is the machine's contract and is asserted there, so the network test now compares the pair); then `Test Files  2 passed (2)`, `Tests  74 passed (74)` three runs in a row |
| Task 3 tests | c4ecb907 | `Test Files  2 passed (2)`, `Tests  59 passed (59)` (PublicLayout and no-long-dash) |
| Coverage test | d94c26ae | the hook: 100% statements, 32 of 32 branches |

Tests that pass on arrival (recorded, not hidden): in Task 2, 10 of 21 passed against the Task 1 code (cases where sending at once gives the same answer: the immediate-send, referrer-host and rejected-send machine cases, GPC, `/administrator`). All Task 3 layout cases (500, 429, `/` then `/products`, first visit then Reject All, `/dev` and `/admin`) passed on arrival because Tasks 1 and 2 had already built the behavior; they are kept as the layout-level guard. The machine classifier `tdd-red-evidence` was not run; the RED evidence is quoted from the console and each RED failed on the planned assertion, not on a load error.

**Tracer gate (Task 1):** `human_verify_mode` is the default `end-of-phase` and the tracer's `<verify>` is automated only, so after GREEN the verify group was re-run (7 files, 206 tests passed) together with `npm run build`, which passed within budget, before Task 2 began.

## Verification (real output)

- Web test subsets: httpClient (4 files), analyticsService, usePageViewBeacon (22 tests), PublicLayout: `Test Files  8 passed (8)`, `Tests  235 passed (235)`.
- Typecheck (`npm run typecheck`, three projects) exit 0; `npm run lint` (`eslint . --max-warnings 0`) exit 0; `npm run format:check`: "All matched files use Prettier code style!".
- Coverage (`--coverage.include` narrowed to `src/core/api/**`, the hook and the service): `Statements 100% (311/311)`, `Branches 98.94% (187/189)` at the first run, the two missed branches were both in the hook and are now covered (hook alone: `Statements 100% (60/60)`, `Branches 100% (32/32)`). `core/api` stayed at 100% (it is not in the uncovered list).
- **Production build** (`npm run build`), gzip -9, limit 150.00 KB: Home 146.13, Products 142.84, Gallery 144.18, Contact 146.20, Privacy 147.68, Cookies 145.61, Terms 146.79, Accessibility 146.35, Not found 138.90, Admin JS 217.50, CSS 20.39. Zero warnings, no chunk-size warning.
- **Budget build** (`npm run build:budget`): Home 146.16, Products 142.87, Gallery 144.21, Contact 146.23, Privacy 147.70, Cookies 145.64, Terms 146.81, Accessibility 146.37, Not found 138.93, Admin JS 219.46, CSS 20.39. All `ok`; the same Phase 4 barrel-split note as before.
- **Cost of this plan** (budget build, after 12-32 to now): +0.59 KB in every public row (Home 145.57 to 146.16, Contact 145.64 to 146.23, Privacy 147.11 to 147.70, Terms 146.22 to 146.81).
- **Room left for plan 12-13 (footer row)**, budget build: Home 3.84 KB below 150 (2.34 below 148.50), Contact 3.77 (2.27), Gallery 5.79 (4.29), Products 7.13 (5.63), Cookies 4.36 (2.86), Terms 3.19 (1.69), Accessibility 3.63 (2.13), **Privacy 2.30 (0.80)**. Privacy is the tight row.
- `src/test/build-output.node.test.ts`, `build-config.node.test.ts` and `scripts/budget.test.ts`: `Tests  171 passed (171)`. The PERF-02 module list holds: no public first chunk carries the HTTP client.
- **E2E** after the preflight (ports 5180, 5115, 7028, 5199 free; the only other processes were other sessions' own): `npm run e2e -- --grep "@public"`: `115 passed (24.1m)` across chromium, firefox, webkit, pixel and iphone, with beacons firing. No server of mine was left running (second preflight shows no process from this worktree).
- **Full web suite** (`npm run test:coverage`, the machine was shared with several other sessions' test runs, 2094 s): `Test Files  14 failed | 397 passed (411)`, `Tests  18 failed | 11006 passed (11024)`. None is in this plan's files. Re-run alone or with a longer timeout, 12 of the 14 files pass: `GalleryPage` 28 passed; `vite-brotli-plugin`, `vite-route-preload-plugin`, `OrderItemModal`, `OrderRefundModal`, `routes` (admin) 160 passed with `--testTimeout=60000`; `build-config.node`, `Phase8Demos`, `AdminLayout`, `StaffMoneyPage.owner`, `OrderFormPage` and `media` passed in the first re-run. The remaining two are `scripts/license-policy.test.ts` ("No packages found in this path": the license checker finds no packages inside a worktree, as 12-09 and 12-31 recorded) and `scripts/third-party-notices.test.ts` (120 s timeout; same worktree cause, not chased). The failures were 5000 ms and 15000 ms timeouts under load plus assertions that depend on a loaded page; none reproduces alone.
- **Global coverage not measured:** vitest prints no coverage report when any test fails, so the global 90% line was not read from this run. The files this plan touched are at 100% (hook), 100% (service) and `core/api` is at 100%. The plan adds 98 lines of source and 356+ lines of tests, so a drop below 90% is not expected, but the owner or the wave gate should read it from a clean run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The beacon must not run on /admin or /dev**
- **Found during:** orchestrator note and a router check: `/dev/public` renders inside the real `PublicLayout`, and an unknown path under the public catch-all also reaches it.
- **Fix:** the hook skips `^/(admin|dev)(/|$)` (the server already drops them). `/administrator` is a normal public not-found path and is counted. Tests cover `/admin`, `/admin/orders`, `/dev/public` and `/administrator`.
- **Commit:** a0fcb809

**2. [Rule 1 - Bug] StrictMode would count the landing view twice in development**
- **Found during:** Task 2 design. React StrictMode runs effects twice; with the landing flag already used the second run would send the same path again.
- **Fix:** the machine ignores the same path announced twice in a row (a real route change always changes the path). Tested with StrictMode and at machine level.
- **Commit:** a0fcb809

**3. [Rule 3 - Blocking] A hidden-page send must not wait for a chunk**
- **Found during:** Task 2 design. The service loads through a dynamic import, so a `visibilitychange` to hidden with the chunk not yet loaded could lose the held view when the page closes.
- **Fix:** when a landing view is held, the hook loads the service chunk at once (a static file request, no analytics request and no cookie, so ANL-01 holds). The import is cached, so the later send is a microtask away.
- **Commit:** a0fcb809

**4. [Rule 3 - Blocking] Smaller items**
- `web/node_modules` was missing in the worktree: `npm ci` against the lockfile (about 2 minutes, no package added or bumped, `git status` shows no package file change).
- `client.post<void>` is rejected by `@typescript-eslint/no-invalid-void-type`; the service uses `client.post<undefined>` (the 204 answer parses to `undefined`) and still returns `Promise<void>`.
- The test harness cannot reassign a module variable in render (`react-hooks/globals`), so the route-change test clicks a `Link` instead of calling a captured `navigate`.
- `pageViewProbe` is an addition in `web/src/test/msw.ts` beside the plan's `pageViewHandler`.
- The commit trailer is `Co-Authored-By: Claude Sonnet 5.5`, as in plans 12-08, 12-09 and 12-31 (the plan text says Opus 5.5; the session attribution rule names this model).
- The per-plan HEAD ledger could not be written under the shared git dir from this worktree (it sits outside the worktree path); the base `e9a110c3` was taken from the spawn-time assertion, and `commits: 6` was measured with `git rev-list --count e9a110c3..HEAD` before this summary commit.
- `npm --prefix web exec prettier` cannot find its plugin from the repo root; Prettier was run from `web/` with `node node_modules/prettier/bin/prettier.cjs`.

## Decisions for the owner or later plans (none block this plan)

- **Plan 12-14 (identified record) and the held landing view:** when the visitor chooses, the held view is sent at once, while the consent call is still in flight. The cookie the server sees on that page view is the provisional cookie the client wrote (pending marker), not yet the server's own. The server never issues a visitor id from a cookie alone (12-08), so the anonymous count is right, but 12-14 should decide what the identified record does when the cookie is still pending. If it should wait for the server cookie, the beacon would need to send after the consent answer instead of at the choice. This is a behavior question for 12-14, not changed here.
- **A held view when the layout unmounts:** if the visitor leaves the public layout (for example to `/admin`) with the bar still open, the held view is not sent. It is not sent on unmount on purpose: StrictMode's simulated unmount would otherwise send a view before any choice in development. Staff are dropped by the server anyway.
- **Own-site referrer:** a reload keeps `document.referrer` as the previous page of this same site, so that landing view carries this site's hostname as `referrerHost`. The plan asks for the hostname of the referrer and the server (12-10, 12-14) can drop its own host; the client does not filter it, to stay small.
- **Plan 12-13 and 12-16 share the first-download room:** the table above is the room after this plan. Privacy has 0.80 KB to the 148.50 KB target and 2.30 KB to the limit.

## Known Stubs

None.

## Threat Flags

None new. T-12-42 is mitigated: the body is built from `location.pathname` only (the hook has no `location.search` or `location.hash`; grep returns 0), tested with `/gallery?q=jersey#top` at hook and layout level, and the server cuts at `?` and `#` too (12-10). T-12-43 is mitigated: only `new URL(document.referrer).hostname`, on the landing view only, never the full address (tested with a referrer that has a path, query and fragment). T-12-44 is mitigated: no retry (no idempotency key, the client retries only keyed POSTs), one beacon per route change, every failure is swallowed (a 500, a 429 and a rejected send are tested with a clean console), and the same path is never sent twice in a row. T-12-SC: no package added or bumped. The sole new network call is the plan's own endpoint; `navigator.sendBeacon` and `navigator.webdriver` are not used.

## Self-Check: PASSED

- Files found: `usePageViewBeacon.ts`, `usePageViewBeacon.test.tsx`, `analyticsService.ts`, `analyticsService.test.ts`, `web/src/test/msw.ts`.
- All 6 plan commits are on the branch (`git log e9a110c3..HEAD`): cac8aeaf, 187462f1, 996a5221, a0fcb809, c4ecb907, d94c26ae. The SUMMARY commit follows them.
- Acceptance greps: `keepalive` in `httpClient.ts` 6 (needs 2); `usePageViewBeacon` in `PublicLayout.tsx` 2 (needs 1); `location.search` outside comments in the hook 0 (needs 0); `export function createBeaconMachine` 1; `visibilitychange` 2 (needs 1); `import('../services/analyticsService')` in the hook 1 (needs 1); `sendBeacon` and `navigator.webdriver` in the hook 0.
- STATE.md and ROADMAP.md untouched.

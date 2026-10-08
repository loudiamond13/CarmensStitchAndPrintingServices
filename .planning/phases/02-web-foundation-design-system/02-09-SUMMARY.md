---
phase: 02-web-foundation-design-system
plan: 09
subsystem: testing
tags: [playwright, e2e, axe, csp, https, shared-machine, run-lock]
created: "2026-10-08T12:07:30-05:00"
updated: "2026-10-08T12:07:30-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "02-01/02-03 SPA host (--webroot, strict CSP, ProblemDetails 404s); 02-04 axe tags, lint and verify gate; 02-37 e2e build mode and web/.env.e2e"
provides:
  - "npm run e2e: wx run lock web/.locks/e2e.lock (15 min wait), busy-port refusal, preflight, guarded CSPS_E2E seed, vite build --mode e2e, playwright test"
  - "web/playwright.config.ts: real API host on https://localhost:5199 serving web/.e2e-dist, five projects, reuseExistingServer false"
  - "web/e2e/fixtures.ts: auto guard (console error/warning, pageerror, CSP via exposeBinding, undeclared same-origin >= 400) and expectNoAxeViolations(page)"
  - "@smoke (5 projects) and @fixture self-tests (3 engines) tags"
  - "docs/web/e2e.md developer guide"
affects: [02-35, 02-36, every later plan that adds @axe/@keyboard/@responsive/@fonts/@a11y-rulings E2E tests]

actuals:
  tokens: 11300
  tasks: 2
  commits: 3
plan_head_before: 0cd75bafe629ac4aaaf1b402054bfd3ca1b96848
plan_head_after: 8277cf84afa5208108541e08453f09b4925bc778

tech-stack:
  added: []
  patterns:
    - "Runner as data: planSteps() returns the steps (unit-tested), executeSteps() spawns them; Node tools via process.execPath + JS entry (L-22)"
    - "Exclusive run lock via openSync(file, 'wx') with a per-run token; release removes the file only while it still holds that token"
    - "E2E page scripts are strings (the node TS program has no DOM types; Playwright evaluates them outside the CSP)"

key-files:
  created:
    - web/scripts/e2e.mjs
    - web/scripts/e2e.test.ts
    - web/playwright.config.ts
    - web/e2e/fixtures.ts
    - web/e2e/smoke.spec.ts
    - web/e2e/fixture-selftest.spec.ts
    - docs/web/e2e.md
  modified: []

key-decisions:
  - "e2e.mjs order is lock, port probe, then preflight/seed/build/playwright: planSteps({portBusy:true}) is a single refusal step (plan behavior), so the preflight runs only when the run goes ahead; the refusal is the only output on a busy port"
  - "guard.expectStatus(urlPart, status) also suppresses the matching 'Failed to load resource: ... status of N' console error that Chromium and WebKit log at the resource URL (Firefox logs none); without it a declared status still failed the test"
  - "The phone projects (pixel, iphone) skip fixture-selftest.spec.ts via testIgnore; the self-tests run once per engine (chromium, firefox, webkit)"
  - "Guard API: expectStatus, peek (snapshot), take (snapshot + clear); fixtures.ts also exports listFindings and assertNoFindings (the end-of-test check) so self-tests prove the check throws"

patterns-established:
  - "Import test/expect/expectNoAxeViolations from web/e2e/fixtures.ts, never from @playwright/test"
  - "Tag at the start of the test title (@smoke, @fixture, ...) and select with npm --prefix web run e2e -- --grep <tag>"
  - "Plans 02-35/02-36 that start the same host must take web/.locks/e2e.lock (acquireLock and LOCK_PATH are exported from web/scripts/e2e.mjs)"

requirements-completed: [QUAL-04, A11Y-01]

coverage:
  - id: D1
    description: "npm run e2e runner: busy-port refusal (no kill), preflight -> CSPS_E2E seed -> e2e build -> playwright with no .cmd shims, stop at first failure, wx run lock that waits, times out and releases only its own file"
    requirement: QUAL-04
    verification:
      - kind: unit
        ref: "web/scripts/e2e.test.ts (21 tests)"
        status: pass
      - kind: manual_procedural
        ref: "live check: a temporary listener on 127.0.0.1:5199 made npm run e2e print the refusal and exit 1 with the lock released"
        status: pass
    human_judgment: false
  - id: D2
    description: "The real API host serves the e2e build on https://localhost:5199 and / is clean (200, strict CSP, one h1 'Site update in progress.', no guard findings, axe clean) in chromium, firefox, webkit, pixel and iphone"
    requirement: QUAL-04
    verification:
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @smoke (5 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each guard is proven to fire in all three engines: console.error, injected <style> (style-src CSP violation), unlabelled image (axe image-alt), undeclared same-origin 404 (and a declared one is not reported)"
    requirement: A11Y-01
    verification:
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @fixture (12 passed); combined @smoke|@fixture run 17 passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/web/e2e.md explains prerequisites, the preflight rule, npm run e2e -- --grep <tag>, the run lock, the busy-port refusal, why HTTPS, the projects, the tags and the never-kill rule"
    verification:
      - kind: other
        ref: "grep: 'never' x5, '5199' x7, the preflight command x1 in docs/web/e2e.md"
        status: pass
    human_judgment: true
    rationale: "Whether the guide is clear enough for a new developer is a reader judgment; the greps only prove the required content is present"

duration: 11min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 09: Playwright E2E Host on HTTPS 5199 with Console, CSP, Response and Axe Guards Summary

**`npm run e2e` now takes an exclusive run lock, refuses a busy port 5199 without touching the other process, seeds CSPS_E2E through the guarded dev-seed tool, builds the e2e bundle and runs Playwright against the real ASP.NET Core host on https://localhost:5199 in chromium, firefox, webkit, Pixel 7 and iPhone 15. Every test fails on console errors or warnings, page errors, CSP violations (via `exposeBinding`), undeclared same-origin failures and, through `expectNoAxeViolations`, axe findings. Self-tests prove each guard fires in all three engines.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-08T16:55:43Z
- **Completed:** 2026-10-08T17:07:04Z
- **Tasks:** 2 of 2
- **Files modified:** 7 (all new)

## Accomplishments

- `web/scripts/e2e.mjs`:
  - `planSteps` returns the run as data: one refusal step on a busy port, otherwise preflight (`powershell ... preflight.ps1 -Ports 5180,5115,7028,5199`), `dotnet run --project tools/Csps.DevSeed -- --database CSPS_E2E`, `node node_modules/vite/bin/vite.js build --mode e2e`, and `node node_modules/@playwright/test/cli.js test <args>`.
  - `executeSteps` spawns them with inherited output and stops at the first failure.
  - `acquireLock` holds `web/.locks/e2e.lock` (created with `wx`). A second run waits up to 15 minutes, then exits 1 with a wait-and-retry message. The lock is released on exit, on SIGINT/SIGTERM and in `finally`, and only while it still holds this run's token.
  - The port probe is a TCP connect on 127.0.0.1 and ::1. The file contains no process-stopping command (a unit test reads the source).
- `web/playwright.config.ts`:
  - `webServer` runs `dotnet run --project src/Csps.Server --no-launch-profile -- --urls https://localhost:5199 --webroot <web/.e2e-dist>` and waits for `/health`.
  - The `Development` environment and the `CSPS_E2E` connection string are set on that child only.
  - `reuseExistingServer: false`, five projects, list + html reporters.
- `web/e2e/fixtures.ts`: an auto `guard` fixture (callback named `provide`) with `expectStatus`, `peek` and `take`. It also exports `expectNoAxeViolations` (with `AXE_TAGS`), `listFindings` and `assertNoFindings`.
- `@smoke` passes in all five projects. `@fixture` passes 12/12 across chromium, firefox and webkit.
- `docs/web/e2e.md` is the one page that explains the E2E host.

## Task Commits

1. **Task 1 (tracer): Playwright drives the real HTTPS 5199 host and `/` is clean in all five projects**
   - RED `b8fc7e4` (test): `scripts/e2e.test.ts` against an inert `e2e.mjs`. 17 of 21 failed on assertions (for example, `[]` was not the refusal step, the second `acquireLock` was not null, and the lock file was never created). `RED_EVIDENCE_OK`.
   - GREEN `8710426` (feat): e2e.mjs, playwright.config.ts, fixtures.ts and smoke.spec.ts. The unit tests pass 21/21 and `--grep @smoke` passes 5/5.
   - Tracer gate (end-of-phase mode, automated-only verify): after the commit I re-ran both verify commands (21/21 and 5/5), then expanded. I also checked the busy-port refusal live: a temporary self-closing listener on 5199 produced the exact message, exit 1, and a released lock.
2. **Task 2: Fixture self-tests prove each guard fires, and the E2E guide documents the workflow.** Commit `8277cf8` (test).

**Plan metadata:** recorded in the docs commit that adds this SUMMARY.

## Files Created/Modified

- `web/scripts/e2e.mjs`: the runner (`planSteps`, `executeSteps`, `acquireLock`, `lockTimeoutMessage` and constants; `main` runs only when the file is executed directly)
- `web/scripts/e2e.test.ts`: 21 node-environment tests for the plan, the executor, the lock and the no-kill rule
- `web/playwright.config.ts`: the host, the projects and the reporters
- `web/e2e/fixtures.ts`: the guard and the page-level axe check
- `web/e2e/smoke.spec.ts`: `@smoke`, which checks status 200, a strict CSP (`script-src 'self';`, `style-src 'self';`, no `unsafe-`), one h1 and a clean axe run
- `web/e2e/fixture-selftest.spec.ts`: four `@fixture` self-tests
- `docs/web/e2e.md`: the developer guide

## Decisions Made

- **Order of the run.** It goes lock, then port probe, then preflight, seed, build and Playwright. The plan's behavior wants a busy port to produce one refusal step, so the preflight report runs only when the run goes ahead.
- **Self-tests on desktop only.** The phone projects skip `fixture-selftest.spec.ts` through `testIgnore`, because the guards are proven once per engine.
- **Page scripts as strings.** The e2e TS program (`tsconfig.node.json`) has no DOM lib, so page scripts are passed as strings. Adding DOM to the node program would widen globals for every script.
- **Stricter smoke test.** The smoke test also checks that the CSP is strict without pinning the full header text. A later CSP change that keeps it strict won't break the test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `guard.expectStatus` did not make a declared failure usable in Chromium and WebKit**
- **Found during:** Task 2, with a throwaway probe spec that I deleted afterwards.
- **Issue:** Chromium and WebKit log every failed load as `console.error: Failed to load resource: the server responded with a status of 404 ()` located at the resource URL. Firefox logs nothing. So a status declared with `expectStatus` still failed the test through the console guard.
- **Fix:** The console listener now skips a `Failed to load resource ... status of N` line only when its location URL and status match a declared same-origin expectation. Every other console error still counts.
- **Files modified:** `web/e2e/fixtures.ts`, `web/e2e/fixture-selftest.spec.ts` (the 404 self-test now waits for the undeclared console line in Chromium/WebKit and asserts that no line mentions the declared URL)
- **Verification:** the `@smoke|@fixture` run passed 17/17.
- **Committed in:** `8277cf8`

**2. [Rule 2 - Missing critical] A fourth self-test for the response guard**
- **Found during:** Task 2
- **Issue:** The plan's three self-tests cover the console, CSP and axe guards. The fourth guard (undeclared same-origin responses of 400 or more) and `expectStatus` were left unproven.
- **Fix:** Added `@fixture an unexpected same-origin 404 is caught, and a declared one is not`. The plan's minimum was 9 tests; there are now 12 (4 × 3 engines).
- **Committed in:** `8277cf8`

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 2)
**Impact on plan:** Both make the guard contract the plan describes actually hold. No scope creep, and no package was added or changed.

## Issues Encountered

- A stale `.git/gsd-plan-head-before-02-09` ledger (`248418b`) was left over from the superseded run. I reset it to `0cd75ba` before the first commit, so `commits: 3` is measured from this run.
- The inert RED placeholder had unused-parameter lint errors. GREEN replaced it within the plan, and the final lint is clean.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved, and `package.json` and `package-lock.json` are unchanged. The pinned Playwright 1.63.0 browsers were already installed.

## TDD Gate Compliance

- Task 1: RED `b8fc7e4` (`test(02-09)`) comes before GREEN `8710426` (`feat(02-09)`). The RED evidence record (target `scripts/e2e.test.ts`, 17 assertion failures) was verified `RED_EVIDENCE_OK`. No refactor was needed.
- Task 2 is `type="auto"` (not TDD), committed as `test(02-09)`.

## Verification

- `npm --prefix web run test -- --run scripts/e2e.test.ts`: 21/21 passed.
- Preflight, then `npm --prefix web run e2e -- --grep "@smoke|@fixture"`: 17 passed (5 smoke + 12 fixture).
- `npm --prefix web run verify`: exit 0. That covers typecheck, lint (`e2e/` and `scripts/` included), format, 724 tests in 21 files with coverage at 100/99.18/100/100, build, the license gate and the notices check.
- Acceptance greps all pass:
  - `reuseExistingServer: false` = 1
  - `https://localhost:5199` = 2
  - `exposeBinding` = 1
  - kill commands in e2e.mjs = 0
  - `@fixture` = 4
  - `never` in the guide = 5, and the guide names 5199 and the preflight command
- After every run, port 5199 was free again and `web/.locks/` was empty.

## User Setup Required

None. The precondition (trusted dev certificate, plus user-secrets for `Jwt:SigningKey` and `DataProtection:*`) was already met on this machine. The guide lists it for other machines.

## Next Phase Readiness

- Later Phase 2 plans can add `@axe`, `@keyboard`, `@responsive`, `@fonts` and `@a11y-rulings` specs by importing from `web/e2e/fixtures.ts`.
- Plans 02-35/02-36 must take the same `web/.locks/e2e.lock` lock (import `acquireLock`/`LOCK_PATH` from `web/scripts/e2e.mjs`) before they start the host on 5199.
- A test that expects a failed request must call `guard.expectStatus(urlPart, status)` before the request is made.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 7 created files exist on disk.
- Commits `b8fc7e4`, `8710426` and `8277cf8` are on `gsd/phase-2-web-foundation-design-system`.

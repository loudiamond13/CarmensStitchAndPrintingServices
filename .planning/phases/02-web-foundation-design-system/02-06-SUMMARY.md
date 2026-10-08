---
phase: 02-web-foundation-design-system
plan: 06
subsystem: testing
tags: [playwright, e2e, axe-core, csp, aspnetcore, https, webkit, firefox, chromium]
created: "2026-10-08T00:34:43-05:00"
updated: "2026-10-08T00:34:43-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "Plan 01: web/ scaffold, vite --mode e2e -> web/.e2e-dist, @playwright/test 1.63.0 and @axe-core/playwright 4.13.0 installed; Plan 02: tsconfig.node.json covering playwright.config.ts and e2e/**, eslint node globals for e2e/**, AXE_TAGS in src/test/axeTags.ts"
provides:
  - "npm --prefix web run e2e (scripts/e2e.mjs): preflight report, busy-5199 refusal, CSPS_E2E migration via the guarded dev seed, e2e build, playwright test with passed arguments"
  - "playwright.config.ts: real ASP.NET Core host on https://localhost:5199 (Development, --webroot web/.e2e-dist, reuseExistingServer: false), five projects chromium/firefox/webkit/pixel/iphone, no CSP bypass"
  - "web/e2e/fixtures.ts: test (automatic guard fixture + guard.take()), expect, expectNoAxeViolations(page)"
  - "@smoke and @fixture specs; tags for later plans to build on"
affects: [02-07, 02-14, 02-15, 02-16, 02-17, 02-18, phase-03-ci, every later E2E spec]

actuals:
  tokens: 5665        # chars/4 over git diff d99773a..57d6f9b (22660 chars)
  tasks: 2
  commits: 4
plan_head_before: d99773ae94f6d151ded5f84234a0b87d2100fda4
plan_head_after: 57d6f9b6890d45ff16c38cb5ef8a0ecd3f708d5a

tech-stack:
  added: []
  patterns:
    - "E2E specs import test/expect/expectNoAxeViolations from web/e2e/fixtures.ts, never from @playwright/test"
    - "CSP violations are reported from an init-script securitypolicyviolation listener through a Playwright binding, so they survive navigation; take() does one page round trip first so in-flight binding calls land"
    - "Synthetic bad pages for guard self-tests exist only in page.route under /__e2e-fixture/ and carry the strict CSP copied from the host's own / response"
    - "Local bins are run as process.execPath + the package's JS entry (vite/bin/vite.js, @playwright/test/cli.js), never .cmd shims"

key-files:
  created:
    - web/playwright.config.ts
    - web/scripts/e2e.mjs
    - web/e2e/fixtures.ts
    - web/e2e/smoke.spec.ts
    - web/e2e/fixture-selftest.spec.ts
  modified:
    - web/package.json
    - docs/development.md

key-decisions:
  - "A2 resolved: `--webroot <abs path>` on the dotnet run command line sets the web root for WebApplication.CreateBuilder(args); a probe file that exists only in web/.e2e-dist was served 200. ASPNETCORE_WEBROOT is not needed and the bundle is never copied into wwwroot"
  - "A1 resolved: addInitScript, exposeBinding, page.evaluate and AxeBuilder injection all work under the strict CSP in Chromium, Firefox and WebKit (and the Pixel 7 / iPhone 15 projects): smoke passes with zero findings and every guard self-test fires in all five projects"
  - "The webServer runs with cwd = src/Csps.Server so the content root (appsettings, logs) matches a normal dotnet run; only ASPNETCORE_ENVIRONMENT and the CSPS_E2E connection string are added on that one process"
  - "CSP violations go through a Playwright binding instead of a window array read at teardown, because a window array is lost when the page navigates"

patterns-established:
  - "Every E2E test fails at teardown on console error/warning, pageerror, CSP violation or same-origin response >= 400; self-tests that provoke a finding call guard.take() to consume it"
  - "Page-level axe and component axe share AXE_TAGS (A11Y-01 adjacency); page level keeps color-contrast on"

requirements-completed: [QUAL-04, A11Y-01]

coverage:
  - id: D1
    description: "npm --prefix web run e2e runs the preflight, refuses a busy 5199, migrates CSPS_E2E through the dev-seed guard, builds web/.e2e-dist and starts the real host on https://localhost:5199 in Development with --webroot"
    requirement: QUAL-04
    verification:
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep \"@smoke|@fixture\" (exit 0, 25 passed; log shows preflight report, 'Migrated CSPS_E2E (compatibility level 160)', vite e2e build, then Playwright)"
        status: pass
      - kind: other
        ref: "A2 probe: web/.e2e-dist/a2-probe.txt (absent from wwwroot) served 200 by the exact webServer command; probe file deleted, host stopped, 5199 free afterwards"
        status: pass
    human_judgment: false
  - id: D2
    description: "The shell page is clean in all five projects: 200, the exact StrictCsp header, one h1, zero axe violations (contrast on), no console/pageerror/CSP/response findings"
    requirement: A11Y-01
    verification:
      - kind: e2e
        ref: "web/e2e/smoke.spec.ts#@smoke shell loads clean (5/5: chromium, firefox, webkit, pixel, iphone)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each guard is proven to fire: console error, CSP violation (script-src*), axe image-alt rejection, routed 404 subresource; and an unconsumed finding fails the test at teardown"
    requirement: QUAL-04
    verification:
      - kind: e2e
        ref: "web/e2e/fixture-selftest.spec.ts (4 tests x 5 projects = 20 passed)"
        status: pass
      - kind: other
        ref: "Mutation runs on chromium/firefox/webkit: disabling the console, CSP, response or axe guard fails exactly its matching self-test (3 failed / 9 passed each); a throwaway spec with an unconsumed console.warn failed in all 5 projects with 'The page reported 1 problem(s)'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Developer guide documents running E2E safely on the shared machine"
    verification:
      - kind: other
        ref: "grep -c 'npm --prefix web run e2e' docs/development.md = 3; Updated timestamp 2026-10-08T00:32:10-05:00"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 06: Playwright E2E Host and Guard Fixture Summary

**`npm --prefix web run e2e` now runs Playwright against the real ASP.NET Core host on https://localhost:5199. The host serves the e2e bundle through `--webroot`. Every test in Chromium, Firefox, WebKit, Pixel 7 and iPhone 15 fails on any console error or warning, page error, CSP violation, same-origin 4xx/5xx or axe violation. Self-tests prove each guard fires, and the CSP is never bypassed.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-08T05:17:29Z
- **Completed:** 2026-10-08T05:34:43Z
- **Tasks:** 2 of 2
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- `web/playwright.config.ts` sets up the real host:
  - It runs `dotnet run --project src/Csps.Server --no-launch-profile -- --urls https://localhost:5199 --webroot <abs>/web/.e2e-dist` with `cwd` set to the server project.
  - It waits on `/health`, uses `reuseExistingServer: false` and a 120 s timeout, and sets two per-process variables: `ASPNETCORE_ENVIRONMENT=Development` and the `CSPS_E2E` connection string.
  - It has five projects, `forbidOnly`, no retries, a list reporter plus an HTML report (never auto-opened), and `trace: retain-on-failure`. There is no `bypassCSP` anywhere.
- `web/scripts/e2e.mjs` runs these steps in order:
  1. Prints the preflight report.
  2. Checks 5199 on 127.0.0.1 and ::1. It tries to connect, then briefly listens. If the port is busy it exits 1 with the plan's message and never kills anything.
  3. Runs `dotnet run --project tools/Csps.DevSeed -- --database CSPS_E2E`.
  4. Runs `vite build --mode e2e`.
  5. Runs `playwright test <args>` and exits with Playwright's code.
- `web/e2e/fixtures.ts` has an automatic `guard` fixture. It records console error/warning (with location), `pageerror`, same-origin responses with status 400 or higher, and CSP violations. The CSP violations come from an init-script `securitypolicyviolation` listener that reports through `exposeBinding`. At teardown the fixture fails the test with one line per finding. `guard.take()` returns and clears the record. `expectNoAxeViolations(page)` runs `AxeBuilder.withTags([...AXE_TAGS])` and rejects with sorted `id: targets` lines, the same format as the component helper.
- Smoke (`@smoke shell loads clean`) passes in 5/5 projects.
- Fixture self-tests (`@fixture`) pass 20/20.
- `docs/development.md` has a new "End-to-end tests (Playwright)" section.

## Task Commits

1. **Task 1 (tracer): Playwright drives the real HTTPS 5199 host and `/` is clean in all five projects**
   - RED `66aba6c` (test), GREEN `2de7571` (feat)
   - Tracer gate (interactive, end-of-phase, automated-only verify): `npm --prefix web run e2e -- --grep @smoke` was re-run after the GREEN commit, exit 0 with 5 passed. Then expansion started.
2. **Task 2: fixture self-tests and the developer guide**
   - `41f839d` (test, characterization, see the TDD section), `57d6f9b` (docs)

No REFACTOR commits were needed.

## TDD Gate Compliance (RED evidence)

| Task | RED run | Failing target | Checker |
|------|---------|----------------|---------|
| 1 | `playwright test --grep @smoke` exit 1, 5 of 5 failed | `@smoke shell loads clean` failed in every project with `page.goto: net::ERR_CONNECTION_REFUSED` (Firefox/WebKit: "Could not connect to server"). The RED commit had a placeholder config (projects and base URL, no `webServer`) and an inert `fixtures.ts`, so nothing started the host. The failure is in the target test's own navigation to the missing host, not a load or parse error. | RED_EVIDENCE_OK (`p06/t1-red.json`) |
| 2 | No RED. The guards were built in Task 1 (the tracer), and the plan says to adjust `fixtures.ts` only if a guard misses a case. None did, so these are characterization tests. Mutations show they can fail. With chromium, firefox and webkit, turning off the console guard, the CSP push, the response guard or the axe throw each failed exactly its matching self-test, 3 failed / 9 passed every time. A throwaway spec that left a `console.warn` unconsumed failed in all 5 projects with "The page reported 1 problem(s)", which proves the teardown check. Every mutation was reverted with `git checkout -- web/e2e/fixtures.ts`, and the throwaway spec was deleted. | n/a (no `feat` for Task 2) |

Evidence files are in the session scratchpad under `p06/` (`t1-red.json`, `t1-red.xml`, `mut-*.log`, `diag.log`).

## Assumptions resolved

- **A1 (axe and listeners under the strict CSP):** confirmed in all three engines and both phone projects.
  - `addInitScript({ content })`, `exposeBinding`, `page.evaluate('0')` and AxeBuilder injection all ran under `script-src 'self'`.
  - The smoke test passes with the exact StrictCsp header and zero findings.
  - A blocked inline script is reported as directive `script-src-elem`, `blockedURI: "inline"` in Chromium, Firefox and WebKit alike.
- **A2 (`--webroot`):** confirmed. A probe file that exists only in `web/.e2e-dist` was served 200 by the exact webServer command (it is absent from `src/Csps.Server/wwwroot`). The probe was then deleted, the host stopped, and 5199 was free again. No `ASPNETCORE_WEBROOT` fallback was needed.

### Engine-specific behaviour observed (recorded per plan)

- Chromium (and Pixel 7) writes its own `console.error` for a CSP block ("Executing inline script violates...") and for a 404 subresource ("Failed to load resource: ... 404").
- WebKit (and iPhone 15) writes "Refused to execute a script because its hash, its nonce, or 'unsafe-inline' does not appear..." plus the same 404 line.
- Firefox writes its CSP message as a console error but writes **no** console message for a 404 image. The response guard still catches it there.
- So in every engine a CSP violation is caught twice (event plus console), and a 404 is caught by the response guard (plus the console in Chromium and WebKit).
- **QUAL-04 flagged assumption:** no browser-internal warning appeared without page code in any engine. The smoke page is clean in all five projects, so nothing needed an allow-list.

## Files Created/Modified

- `web/playwright.config.ts`: host, projects and reporters.
- `web/scripts/e2e.mjs`: the `npm run e2e` wrapper.
- `web/e2e/fixtures.ts`: the guard fixture, `guard.take()`, `expectNoAxeViolations`.
- `web/e2e/smoke.spec.ts`: `@smoke shell loads clean`. It holds a copy of `SecurityHeadersMiddleware.StrictCsp`.
- `web/e2e/fixture-selftest.spec.ts`: four `@fixture` tests. Their synthetic pages live only in `page.route`.
- `web/package.json`: `"e2e": "node scripts/e2e.mjs"`.
- `docs/development.md`: the E2E section, with the Updated timestamp changed.

## Decisions Made

See `key-decisions` in the frontmatter. In short:
- `--webroot` works (A2).
- Everything works under the strict CSP (A1).
- The host's cwd is the server project.
- CSP violations travel through a binding, so they survive navigation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] CSP violations reported through a binding, not only a window array read at teardown**
- **Found during:** Task 1 (GREEN)
- **Issue:** The plan's window array lives in the document. Any navigation before teardown would discard violations raised on the earlier page, so the guard would miss them silently.
- **Fix:** The init script listener calls a Playwright binding (`exposeBinding('__cspsE2eCspViolation')`), and Node holds the record. Before reading, `take()` does one `page.evaluate('0')` round trip so that in-flight binding calls are delivered. A closed page is skipped.
- **Files modified:** web/e2e/fixtures.ts
- **Verification:** The CSP self-test passes in all 5 projects. With the push turned off, it fails in chromium, firefox and webkit.
- **Committed in:** `2de7571`

**2. [Rule 3 - Blocking] RED placeholders committed with the RED test**
- **Found during:** Task 1 (RED)
- **Issue:** With no `fixtures.ts` the spec cannot load, which is an INVALID_RED load failure. With no config, Playwright would scan web/ and pick up the Vitest files.
- **Fix:** The RED commit has an inert `fixtures.ts` and a config with only the projects and base URL, so the target test runs and fails on the missing host. GREEN replaced both.
- **Committed in:** `66aba6c`

**3. [Rule 3 - Blocking] Local bins run through node, not `.cmd` shims**
- **Found during:** Task 1
- **Issue:** On Windows, `spawnSync` cannot run `node_modules/.bin/*.cmd` without a shell.
- **Fix:** `e2e.mjs` runs `process.execPath` with `node_modules/vite/bin/vite.js` and `node_modules/@playwright/test/cli.js`. `dotnet` and `powershell` are real executables.
- **Committed in:** `2de7571`

---

**Total deviations:** 3 auto-fixed (1 missing critical, 2 blocking).
**Impact on plan:** All planned behaviour is delivered. No package was added or changed, no browser was downloaded (chromium 1243, firefox 1543 and webkit 2359 were already present), and no CSP relaxation was made.

## Issues Encountered

- The fixture's auto `guard` names its callback parameter `provide`, not `use`, so `react-hooks/rules-of-hooks` does not mistake Playwright's `use` for React's `use()`.
- `@typescript-eslint/dot-notation` rejected `candidate['directive']` on a `Record<string, unknown>`. It now uses dot access.
- A throwaway probe script showed that doubled backslashes in a Bash heredoc are halved on this Windows spawn path, the same issue the root-pin script notes. The probe used forward slashes and `String.fromCharCode(92)` instead. Nothing in the repo is affected, since `playwright.config.ts` builds its paths with `fileURLToPath`.
- MSBuild node-reuse workers (`dotnet MSBuild.dll /nodeReuse:true`) stay alive for a few minutes after `dotnet run`. They are not servers, the preflight filters them out, and they exit on their own. No `Csps.Server` or Playwright browser process was left running, and 5199 was free after every run.

## Known Stubs

None. `smoke.spec.ts` holds a copy of `SecurityHeadersMiddleware.StrictCsp` on purpose. If the C# constant changes without the copy, the smoke test fails, which is the intended alarm.

## Threat Flags

None. The surface is test-only: a local host on 5199 that uses user-secrets, as planned in T-02-15..T-02-17. Each mitigation is in place:
- **T-02-15:** no secret is passed on a command line or in the config.
- **T-02-16:** there is no `bypassCSP`, the smoke test checks the exact header, and the CSP self-test fires in every engine.
- **T-02-17:** only `CSPS_E2E` is used, through DevSeedTargetGuard.
- **T-02-SC:** no installs and no browser downloads were made.

## User Setup Required

None. The prerequisites (`Initialize-LocalDb.ps1`, `Initialize-DevSecrets.ps1`) were already done on this machine. The precondition check counted 2 secret keys without printing them, and `sqllocaldb info CSPS` succeeded.

## Next Phase Readiness

- Later plans add `@axe`, `@keyboard`, `@responsive`, `@fonts` and `@a11y-rulings` specs on top of `web/e2e/fixtures.ts`.
- Phase 3 CI must supply the JWT key and Data Protection certificate to the host process. It must also provide the dev HTTPS certificate on Linux, or an equivalent.
- `node web/scripts/license-gate.mjs` still exits 1 on exactly the 5 D-BL-01 packages, with no new failures.

## Self-Check: PASSED

- All 5 created files exist. Commits 66aba6c, 2de7571, 41f839d and 57d6f9b exist. The ledger count is 4 (d99773a..57d6f9b).
- Acceptance checks:
  - `grep -c "reuseExistingServer: false" web/playwright.config.ts` = 1.
  - `grep -c bypassCSP` = 0 in both files.
  - `grep -rl "__e2e-fixture" web/src` prints nothing.
  - docs/development.md contains `npm --prefix web run e2e` (3 times), and its Updated timestamp changed.
- Plan `<verification>`:
  - `npm --prefix web run e2e -- --grep "@smoke|@fixture"`: exit 0, 25 passed (5 smoke + 20 self-tests).
  - `npm --prefix web run verify`: exit 0, 14 files and 430 tests, lint `--max-warnings 0`.
- Full suites:
  - The preflight was clean.
  - `dotnet build Csps.slnx` reports 0 warnings and 0 errors.
  - `dotnet test --solution Csps.slnx` passed 837/837 (CSPS_TEST_SQL=localdb, per process).

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

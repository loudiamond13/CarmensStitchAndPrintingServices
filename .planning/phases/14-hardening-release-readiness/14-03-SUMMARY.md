---
phase: 14-hardening-release-readiness
plan: 03
subsystem: security
tags: [codeql, x-frame-options, cwe-1021, cwe-614, cwe-94, web-config]
requires: []
provides:
  - "src/Csps.Server/web.config: one X-Frame-Options DENY add under customHeaders (IIS only)"
  - "WebConfigTests.SendsXFrameOptionsDenyOnce and SecurityHeadersTests.TheAppNeverSendsXFrameOptionsBecauseIisDoes"
  - "IdempotencyProbeController.Cookie writes a Secure, HttpOnly cookie, checked by IdempotencyTests"
  - "design-side-by-side.mjs applyThemeToFrame: the theme goes to the page as an evaluate argument"
  - "An outcome for each of the 11 open code-scanning alerts (table below)"
affects: [14-10, 14-11, 14-20, 14-21, 14-25]
actuals:
  tokens: 2200
  tasks: 2
  commits: 4
plan_head_before: 1eca5efd880b71deddfa54046dc58e73e2208bc1
plan_head_after: e2fe8387e263ce14ee92471b43601c108c07ffe4
tech-stack:
  added: []
  patterns:
    - "X-Frame-Options is sent in one place only: IIS customHeaders. Kestrel hosts rely on CSP frame-ancestors."
    - "Page scripts get values as evaluate arguments, never spliced into code text"
key-files:
  created: []
  modified:
    - src/Csps.Server/web.config
    - tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs
    - tests/Csps.Server.IntegrationTests/Http/SecurityHeadersTests.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyProbeController.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs
    - web/scripts/design-side-by-side.mjs
    - web/scripts/design-side-by-side.test.ts
key-decisions:
  - "X-Frame-Options DENY goes in web.config only, never in SecurityHeadersMiddleware, so the live response carries it once (RESEARCH Pitfall 10)"
requirements-completed: []
coverage:
  - id: D1
    description: "web.config sends one X-Frame-Options DENY header and the app adds none"
    requirement: SEC-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs#SendsXFrameOptionsDenyOnce"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SecurityHeadersTests.cs#TheAppNeverSendsXFrameOptionsBecauseIisDoes"
        status: pass
      - kind: integration
        ref: "tests/Csps.ArchitectureTests/PublishOutputTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "The probe cookie is Secure and HttpOnly"
    requirement: SEC-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs#AnAnswerThatSetsACookieIsNeverStored"
        status: pass
    human_judgment: false
  - id: D3
    description: "The design review script passes the theme as an argument, not code text"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "web/scripts/design-side-by-side.test.ts#applyThemeToFrame (CWE-94)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The CodeQL alerts close on the next CodeQL run of the pull request"
    requirement: SEC-05
    verification: []
    human_judgment: true
    rationale: "Only a CodeQL run on GitHub shows whether the query accepts the web.config header (RESEARCH A7); the run happens after the branch is pushed, which executors never do."
duration: 11min
completed: 2026-11-27
status: complete
created: 2026-11-27T18:30:00-06:00
updated: 2026-11-27T18:30:00-06:00
---

# Phase 14 Plan 03: The open CodeQL alerts are fixed in code Summary

*Created: 2026-11-27T18:30:00-06:00 · Updated: 2026-11-27T18:30:00-06:00*

**IIS now sends one `X-Frame-Options: DENY` header from web.config, the probe test cookie is Secure and HttpOnly, and the design review script passes its theme to the page as data, so every CodeQL alert in this repository's own code is fixed or has a named owner.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-11-27T18:22:47-06:00
- **Completed:** 2026-11-27T18:30:00-06:00
- **Tasks:** 2
- **Files modified:** 7 (plus this summary)

## Accomplishments

- web.config has exactly one `X-Frame-Options` add with `DENY`, after the `X-Powered-By` remove. A test reads the XML and expects one. A second test proves the app sends no such header, so the two never double up. CSP `frame-ancestors 'none'` is unchanged.
- The idempotency probe cookie is written with `Secure` and `HttpOnly`. The test that checks the cookie is never stored now also checks both flags. It failed first.
- `design-side-by-side.mjs` has an exported `applyThemeToFrame`. It calls `frame.evaluate` with a function and the theme as the argument. Two tests cover it: a quote and a code fragment in the theme reach the page as data, and the function text never contains the value.
- All 11 alerts have an outcome (table below).

## Alert outcomes (SEC-05, for the security checklist in plan 14-25)

| Alert | Rule | Location | Outcome |
|-------|------|----------|---------|
| 14 | cs/web/missing-x-frame-options | src/Csps.Server/web.config | Fixed here (`f8fecf88`). Closes when CodeQL re-runs on the PR. |
| 15 | cs/web/missing-x-frame-options | bin copy of web.config | Fixed here: the copy is built from the fixed source file. |
| 16 | cs/web/missing-x-frame-options | bin copy of web.config | Fixed here, same reason. |
| 17 | cs/web/missing-x-frame-options | bin copy of web.config | Fixed here, same reason. |
| 18 | cs/web/missing-x-frame-options | bin copy of web.config | Fixed here, same reason. |
| 19 | cs/web/missing-x-frame-options | bin copy of web.config | Fixed here, same reason. |
| 23 | cs/web/missing-x-frame-options | bin copy of web.config | Fixed here, same reason. |
| 13 | cs/web/cookie-secure-not-set | IdempotencyProbeController.cs:124 | Fixed here (`3c054c82`): `Secure` and `HttpOnly`. |
| 4 | js/bad-code-sanitization | web/scripts/design-side-by-side.mjs:345 | Fixed here (`e2fe8387`): argument passing, no code text. |
| 3 | js/bad-code-sanitization | web/e2e/deleteOrderDialog.ts:15 | Fixed in plan 14-11, which owns that file. Not touched here. |
| 5 | js/disabling-certificate-validation | web/scripts/deploy.mjs:363 | Fixed in plan 14-21 under 14 D-39. Not touched here. |

No alert was dismissed in GitHub. Dependabot alert 6 (minimatch) is not a code-scanning alert and belongs to plan 14-14 under 14 D-35.

Alerts 14 to 19 and 23 are the source file plus six build copies. I could not read the exact path of each copy from here (no GitHub call was made), so rows 15 to 19 and 23 are matched by count and rule from RESEARCH, not by path.

## Task Commits

1. **Task 1: One X-Frame-Options header from IIS (CWE-1021)**
   - RED: `a59a2794` (test). `SendsXFrameOptionsDenyOnce` failed on its assertion: no matching add element was found (16 tests, 1 failed).
   - GREEN: `f8fecf88` (feat). 16 of 16 pass; `PublishOutputTests` 1 of 1 passes.
2. **Task 2: Secure cookie and argument-passing script**
   - Cookie: `3c054c82` (fix). The cookie assertion failed first ("should contain secure"), then the 61 idempotency tests passed.
   - Script: `e2fe8387` (fix). Both new tests failed first (`applyThemeToFrame is not a function`), then 27 of 27 pass.

**Plan metadata:** the docs commit that holds this summary.

## Verification (run in this worktree)

- `dotnet test` WebConfigTests + SecurityHeadersTests: total 16, failed 0.
- `dotnet test` PublishOutputTests: total 1, failed 0.
- `dotnet test` `*Idempotency*`: total 61, failed 0. No build warnings in any of the runs.
- `npm --prefix web run test -- --run scripts/design-side-by-side.test.ts`: 27 passed.
- `npm --prefix web run typecheck`: exit 0.
- `eslint --max-warnings 0` and `prettier --check` on the two script files: clean.
- Acceptance greps: `X-Frame-Options` in web.config 1, in WebConfigTests 1; `Secure = true` in the probe controller 1.
- Tracer gate (task 1): automated verify re-run, passed, expansion continued.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The node tsconfig has no DOM types**
- **Found during:** Task 2
- **Issue:** `document` inside the evaluate function failed `tsc -p tsconfig.node.json` (TS2584, TS7006).
- **Fix:** typed the part of the document the script uses with a JSDoc typedef and read it from `globalThis`. No tsconfig change.
- **Files modified:** web/scripts/design-side-by-side.mjs
- **Verification:** typecheck exit 0, eslint clean.
- **Committed in:** `e2fe8387`

**2. [Rule 3 - Blocking] Lint rule on void shorthand arrows in the new test**
- **Found during:** Task 2
- **Issue:** `no-confusing-void-expression` on two arrow functions in the new test.
- **Fix:** added braces. Prettier applied.
- **Committed in:** `e2fe8387`

**3. Plan said "existing fake-frame pattern"; none existed**
- The test file had no fake frame, so I added one in the new tests, and moved the evaluate call into an exported `applyThemeToFrame` so it can be tested without launching a browser.

**Total deviations:** 3 (2 Rule 3, 1 plan wording). **Impact:** none on scope.

## Issues Encountered

None. The plan's step "adjust any test that read the cookie over plain http" was not needed: all idempotency tests passed unchanged.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or trust boundary.

## User Setup Required

None.

## Next Phase Readiness

- The CodeQL run on the pull request decides whether alerts 14 to 19 and 23 close (RESEARCH A7: the query may ignore the header). If one stays open, bring it to the owner. Do not dismiss it.
- Plan 14-20 checks the live response carries `X-Frame-Options` exactly once.
- Plan 14-25 copies the alert table into the security checklist.

## Self-Check: PASSED

- All 7 modified files exist; the four commits `a59a2794`, `f8fecf88`, `3c054c82`, `e2fe8387` are ancestors of HEAD.

---
*Phase: 14-hardening-release-readiness*
*Completed: 2026-11-27*

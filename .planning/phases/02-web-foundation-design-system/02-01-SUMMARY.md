---
phase: 02-web-foundation-design-system
plan: 01
subsystem: api
tags: [aspnetcore, spa-host, static-files, routing, authorization-matrix, xunit-v3, tdd]
created: "2026-10-08T09:31:27-05:00"
updated: "2026-10-08T09:31:27-05:00"

requires:
  - phase: 01-foundation
    provides: "Default-deny fallback policy, /api/{**path} ProblemDetails fallback, SecurityHeadersMiddleware strict CSP, AuthorizationMatrix/AuthorizationCoverage, CspsApiFactory"
provides:
  - "SpaHosting.MapSpaHost: anonymous GET/HEAD shell fallback {*path:nonfile} with Cache-Control no-cache"
  - "Anonymous {*path:file} ProblemDetails 404 for missing files (never 401)"
  - "Outside Development: /openapi/{**path} and /scalar/{**path} reserved 404 fallbacks marked with ReservedPathMetadata (D-29)"
  - "Program.cs order: UseStaticFiles, then explicit UseRouting (L-02), MapSpaHost last"
  - "Committed fixture web root tests/Csps.Testing/Fixtures/webroot served by every .NET test host (CspsApiFactory.FixtureWebRoot)"
  - "Test hosts run with static web assets off, so the suite passes with no src/Csps.Server/wwwroot (L-06)"
  - "Five new matrix rows and allow-list keys"
affects: [02-web-foundation-design-system, web-build-into-wwwroot, playwright-host, lighthouse-host, compression-and-caching]

actuals:
  tokens: 7500
  tasks: 2
  commits: 4
plan_head_before: 3b42ddcf592bb83883c032c10d4378f6d296d8a7
plan_head_after: a908f1a3de450bd6936f8233f94cbe3c17111cde

tech-stack:
  added: []
  patterns:
    - "SPA fallbacks: literal-prefix fallbacks (/api, /openapi, /scalar) outrank the {*path:file} and {*path:nonfile} catch-alls"
    - "Static files before an explicit UseRouting, so real files are served before any endpoint is matched"
    - "Every test host serves a committed fixture web root and never the build output"

key-files:
  created:
    - src/Csps.Server/Endpoints/SpaHosting.cs
    - src/Csps.Server/Endpoints/ReservedPathMetadata.cs
    - tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs
    - tests/Csps.Testing/Fixtures/webroot/index.html
    - tests/Csps.Testing/Fixtures/webroot/robots.txt
    - tests/Csps.Testing/Fixtures/webroot/assets/app-fixture.js
  modified:
    - src/Csps.Server/Program.cs
    - tests/Csps.Testing/CspsApiFactory.cs
    - tests/Csps.Testing/Csps.Testing.csproj
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs
    - tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs

key-decisions:
  - "Test hosts turn static web assets off (WebHostDefaults.StaticWebAssetsKey points at a manifest that does not exist). The build-time manifest always names src/Csps.Server/wwwroot, and in Development the loader throws without it, so WebRootKey alone did not close the L-06 fresh-clone gap."
  - "The L-03 probe moves (clock skew, unserved method on a page path, generic 500) landed with Task 1, because the Task 1 shell fallback is what broke them."

patterns-established:
  - "New anonymous fallback = .AllowAnonymous() + matrix row + allow-list key, with the key text equal to the RoutePattern.RawText the coverage discovery reports"
  - "Auth and 500 probes target the real Staff endpoint GET /api/v1/site-settings with an in-memory ISiteSettingsReader, never an unmatched page path"

requirements-completed: [WEB-01]

coverage:
  - id: D1
    description: "Anonymous GET/HEAD on page paths (/, /products, /admin/orders) returns the fixture shell as text/html with the strict CSP and Cache-Control no-cache"
    requirement: "WEB-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#NonFilePathsServeTheShell"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#HeadServesTheShell"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#ExistingFileIsServed"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unknown /api paths, missing files (GET and POST) and, outside Development, /openapi and /scalar prefixes answer anonymous ProblemDetails 404s; POST to a page path stays 401"
    requirement: "WEB-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#UnknownApiRouteIsStillProblem404"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#MissingFileIsProblem404"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#ReservedDocsPathsAre404OutsideDevelopment"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs#UnservedMethodOnAPagePathIsChallenged"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs#ProductionMapsOnlyTheReservedDocsFallbacks"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs#ProductionHasNoApiDocs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Default-deny is kept: all five new endpoint keys have matrix rows and allow-list entries, and discovery finds no unlisted endpoint"
    requirement: "WEB-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#DiscoveredEndpointsAreFullyCovered"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus"
        status: pass
    human_judgment: false
  - id: D4
    description: "The whole Csps.Server.IntegrationTests project passes with no src/Csps.Server/wwwroot folder, rebuilt from scratch without it"
    requirement: "WEB-01"
    verification:
      - kind: other
        ref: "mv src/Csps.Server/wwwroot aside; dotnet build tests/Csps.Server.IntegrationTests; dotnet test --project tests/Csps.Server.IntegrationTests (210/210)"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 01: Anonymous SPA Host over a Fixture Web Root Summary

**The API host now serves the single-page app shell anonymously for GET and HEAD on any page path, with the strict CSP and no-cache. Missing files and the reserved `/openapi` and `/scalar` prefixes answer ProblemDetails 404s, and POST to a page path stays 401. Every .NET test host serves a committed fixture web root, so the suite no longer needs `src/Csps.Server/wwwroot`.**

## Performance

- **Duration:** about 13 min
- **Started:** 2026-10-08T14:17:50Z
- **Completed:** 2026-10-08T14:31:15Z
- **Tasks:** 2 of 2
- **Files modified:** 13

## Accomplishments

- `SpaHosting.MapSpaHost` maps three things in order:
  - an anonymous `{*path:file}` 404 (Pitfall 11);
  - outside Development, `/openapi/{**path}` and `/scalar/{**path}` reserved 404s marked with `ReservedPathMetadata` (D-29);
  - the `MapFallbackToFile("index.html")` shell, GET and HEAD only, with `Cache-Control: no-cache` (L-01).
- In `Program.cs`, `UseStaticFiles()` runs before an explicit `UseRouting()` (L-02), so real files never hit the fallbacks.
- The fixture web root (`index.html` with the marker "CSPS fixture shell", `robots.txt`, `assets/app-fixture.js`) is copied to the test output. `CspsApiFactory.FixtureWebRoot` serves it to every host.
- The authorization matrix has five new keys: `GET {*path:nonfile}`, `HEAD {*path:nonfile}`, `* {*path:file}`, `* /openapi/{**path}` and `* /scalar/{**path}`. `DiscoveredEndpointsAreFullyCovered` passes.
- Phase 1 probes that relied on an unmatched page path were moved (L-03).

## Task Commits

1. **Task 1 (tracer): an anonymous visitor gets the app shell from the fixture web root**
   - RED `b08d196` (test): SpaHostTests plus an inert `MapSpaHost`. Target `NonFilePathsServeTheShell(path: "/")` failed with 401 instead of 200; RED_EVIDENCE_OK.
   - GREEN `6ce1bf5` (feat).
   - Tracer gate: the automated verify was re-run and passed (SpaHostTests 6/6, `*Authorization*` 53/53).
2. **Task 2: missing files, reserved docs paths and page-path POSTs keep their ProblemDetails answers**
   - RED `f182fce` (test): target `MissingFileIsProblem404(method: "GET", path: "/missing.js")` failed with 401 instead of 404, and `/scalar` in Production returned the shell's 200; RED_EVIDENCE_OK.
   - GREEN `a908f1a` (feat).

REFACTOR: none needed.

## Files Created/Modified

- `src/Csps.Server/Endpoints/SpaHosting.cs`: the SPA host fallbacks and their constants.
- `src/Csps.Server/Endpoints/ReservedPathMetadata.cs`: the marker for the D-29 reserved-prefix fallbacks.
- `src/Csps.Server/Program.cs`: `UseStaticFiles`, explicit `UseRouting` and `MapSpaHost`. Every existing line and comment is kept.
- `tests/Csps.Testing/Fixtures/webroot/*`: the committed stub web root.
- `tests/Csps.Testing/Csps.Testing.csproj`: `<None Include="Fixtures\webroot\**" CopyToOutputDirectory="PreserveNewest" />`.
- `tests/Csps.Testing/CspsApiFactory.cs`: `FixtureWebRoot`, the `WebRootKey` setting, and static web assets turned off.
- `tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs`: 6 tests, 16 cases.
- `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`: 5 rows and 5 allow-list keys.
- `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs`: the clock-skew probe now calls site-settings through a `FixedSiteSettingsReader`, and `UnservedMethodOnAPagePathIsChallenged` sends `POST /products`.
- `tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs`: `DocsRoutes` ignores `ReservedPathMetadata`, `ProductionHasNoApiDocs` now expects exactly 404, and `ProductionMapsOnlyTheReservedDocsFallbacks` is new.
- `tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs`: the generic-500 probe now throws from an `ISiteSettingsReader` on the Staff endpoint.

## Decisions Made

- Test hosts turn static web assets off (see Deviation 2).
- The L-03 probe moves landed with Task 1, because Task 1 is what broke them (see Deviation 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The L-03 probe moves were brought forward into Task 1, and ProblemDetailsTests was added**
- **Found during:** Task 1 GREEN.
- **Issue:** Once the shell fallback existed, every GET page path matched an endpoint. That broke `ClockSkewIsThirtySeconds`, `UnknownNonApiPathIsChallenged` and `ProblemDetailsTests.UnhandledExceptionIsGeneric500WithReference`. The last one threw from a terminal middleware on the unmatched path `/test-only/throws`. Task 1's own verify (`--filter-class "*Authorization*"`) would have failed.
- **Fix:** I made the plan's Task 2 L-03 moves in Task 1. ProblemDetailsTests is the extra probe that the plan's "search the whole test tree" step points to; it moved to a throwing `ISiteSettingsReader` on `GET /api/v1/site-settings`.
- **Files modified:** AuthorizationFailureTests.cs, ProblemDetailsTests.cs.
- **Commit:** 6ce1bf5.

**2. [Rule 1 - Bug] The fixture web root alone did not make the suite independent of `src/Csps.Server/wwwroot`**
- **Found during:** Task 2's acceptance check, run with the folder moved aside and the tests rebuilt.
- **Issue:** `DevelopmentMapsTheDocsRoutes` and `DevelopmentServesOpenApiAndScalar` threw `DirectoryNotFoundException` from `StaticWebAssetsLoader`. The SDK's runtime manifest always lists the project's `wwwroot` as a content root, and the loader runs only in Development. `WebRootKey` does not affect it.
- **Fix:** `CspsApiFactory` now sets `WebHostDefaults.StaticWebAssetsKey` to a manifest path that is never created. ASP.NET Core treats a missing manifest as "feature not enabled", so test hosts serve only the fixture web root.
- **Verification:** Rebuilt and ran the full project with no `wwwroot` (210/210), then again with the folder restored (210/210).
- **Commit:** a908f1a.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug).
**Impact on plan:** Both were needed to meet the plan's own truths (default-deny verify green, suite independent of `wwwroot`). No scope creep, and no packages were added.

## Issues Encountered

- The plan's acceptance grep `grep -c 'Fixtures\\webroot\\\*\*' tests/Csps.Testing/Csps.Testing.csproj` prints 0 under GNU grep because of a pattern-escaping quirk. The fixed-string check `grep -cF 'Fixtures\webroot\**'` prints 1, so the item is present exactly once.
- A stale ledger file, `.git/gsd-plan-head-before-02-01`, was left over from the superseded attempt. I reset it to `3b42ddc` before the first commit, so `commits: 4` is measured from this run.
- Under `TDD_MODE`, xunit.v3 on MTP writes JUnit XML with `--report-xunit-junit` (not `--report-junit`). That XML was the input for `check tdd-red-evidence`.

## Verification

- `dotnet test --project tests/Csps.Server.IntegrationTests`: 210/210 passed, with `wwwroot` present and with it absent (rebuilt).
- `dotnet test --project tests/Csps.ArchitectureTests`: 77/77 passed.
- `dotnet build Csps.slnx -tl:off`: 0 warnings, 0 errors.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- `git ls-files src/Csps.Server/wwwroot`: empty.

## TDD Gate Compliance

RED then GREEN for both tasks (`test(02-01)` b08d196 → `feat(02-01)` 6ce1bf5; `test(02-01)` f182fce → `feat(02-01)` a908f1a). Both RED records were verified as `RED_EVIDENCE_OK` on assertion failures, not compile errors.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- The server half of WEB-01 is in place. The Vite build into `wwwroot` and the static-file hardening (dot-folder refusal, compression, cache headers) come in later Phase 2 plans.
- Real `/.well-known/` files will need an explicit, tested exception later (AR-02-02); nothing serves them today.

## Self-Check: PASSED

All 6 created files exist, and all 4 task commits (b08d196, 6ce1bf5, f182fce, a908f1a) are in the log.

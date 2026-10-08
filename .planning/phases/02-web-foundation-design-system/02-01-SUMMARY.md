---
phase: 02-web-foundation-design-system
plan: 01
subsystem: infra
tags: [vite, react, npm, aspnetcore, static-files, spa-fallback, response-compression, csp, authorization-matrix]
created: "2026-10-07T22:35:00-05:00"
updated: "2026-10-07T22:35:00-05:00"

requires:
  - phase: 01-foundation
    provides: "Default-deny authorization, SecurityHeadersMiddleware (strict CSP), CspsProblemDetails, ApiRouting /api fallback, CspsApiFactory, authorization matrix"
provides:
  - "web/ Vite 8.3.3 + React 19.3 app pinned exactly to the owner-approved D-25 table, lockfile committed, npm audit 0"
  - "tools/openapi-gen/ (openapi-typescript 7.13.0 + typescript 5.9.3), lockfile committed"
  - "npm run build writes the shell into the git-ignored src/Csps.Server/wwwroot"
  - "SpaHosting.MapSpaHost: anonymous shell for non-file paths, ProblemDetails 404 for missing files, reserved /openapi and /scalar 404s outside Development"
  - "SpaRegistration.AddCspsSpaHosting + SpaCaching: br/gzip for html/css/js/svg only; /assets immutable, everything else no-cache"
  - "CspsApiFactory.FixtureWebRoot: committed stub web root, so .NET tests never need npm run build"
affects: [02-02, 02-03, 02-05, 02-14, phase-03-ci-hosting, public-site, admin-portal]

actuals:
  tokens: 96706       # chars/4 over the whole realized diff (880713c..644ae7c), of which 81411 are the two package-lock.json files; 15295 without lockfiles
  tasks: 3
  commits: 6
plan_head_before: 880713ce642e9028163a1518bb63e3908b765d61
plan_head_after: 644ae7c18a300b71b63b0a0c0d65800a1956ea90

tech-stack:
  added:
    - "vite 8.3.3 (security-fix cool-down exception, D-25) on rolldown 1.2.11 (owner waiver 2026-10-07)"
    - "react / react-dom 19.3.0, react-router 8.4.0, @tanstack/react-query 5.103.2, nuqs 2.10.1, clsx 2.1.1, lucide-react 1.52.0, @fontsource 5.3.0"
    - "@vitejs/plugin-react 6.1.1 + @rolldown/plugin-babel 0.2.4 + babel-plugin-react-compiler 1.0.0 (React Compiler)"
    - "tailwindcss / @tailwindcss/vite 4.3.3"
    - "typescript alias pair (npm:@typescript/typescript6@6.0.2 -> TS 6.0.3 API, @typescript/native = typescript 7.0.2)"
    - "eslint 10.11.0 stack, prettier 3.9.9, vitest 5.0.1, jsdom 30.1.1, Testing Library, axe-core 4.13.0, @playwright/test 1.63.0, lighthouse 13.5.0, license-checker-rseidelsohn 5.0.1 (installed now, wired by later plans)"
    - "openapi-typescript 7.13.0 + typescript 5.9.3 (tools/openapi-gen)"
  patterns:
    - "UseResponseCompression -> UseStaticFiles(SpaCaching.Apply) -> explicit UseRouting, so real files win over the {*path:file} fallback"
    - "Anonymous fallbacks are mapped explicitly, each with a matrix row and an allow-list key"
    - "Reserved server prefixes are 404 fallbacks marked with ReservedPathMetadata"
    - "Transitive npm pins live in package.json overrides with a matching min-release-age-exclude[] line and a reason comment"

key-files:
  created:
    - web/vite.config.ts
    - web/.npmrc
    - web/package.json
    - web/package-lock.json
    - web/index.html
    - web/public/mark.svg
    - web/public/robots.txt
    - web/src/main.tsx
    - tools/openapi-gen/package.json
    - tools/openapi-gen/package-lock.json
    - src/Csps.Server/Endpoints/SpaHosting.cs
    - src/Csps.Server/Endpoints/ReservedPathMetadata.cs
    - src/Csps.Server/Composition/SpaRegistration.cs
    - tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs
    - tests/Csps.Testing/Fixtures/webroot/index.html
    - tests/Csps.Testing/Fixtures/webroot/robots.txt
    - tests/Csps.Testing/Fixtures/webroot/assets/app-fixture.js
    - .gitattributes
  modified:
    - src/Csps.Server/Program.cs
    - .gitignore
    - docs/dependencies.json
    - docs/development.md
    - tests/Csps.Testing/CspsApiFactory.cs
    - tests/Csps.Testing/Csps.Testing.csproj
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs
    - tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs

key-decisions:
  - "Owner (2026-10-07, now-plus-rolldown): cool-down exceptions source-map-js 1.2.2 (GHSA-68fv-2mgg-jv7q), http-cache-semantics 4.3.0 (GHSA-ch52-4w7c-c8xp) and rolldown + @rolldown/binding-* 1.2.11 (vite 8.3.3 engine), pinned exactly via web/package.json overrides and min-release-age-exclude[]"
  - "The SPA shell endpoint keeps the framework's GET/HEAD-only registration, so the matrix has GET and HEAD {*path:nonfile} rows instead of one * row; other methods on page paths stay default-deny (anonymous 401)"
  - "D-29 resolved by metadata: outside Development /openapi/{**path} and /scalar/{**path} are anonymous ProblemDetails 404 fallbacks marked ReservedPathMetadata; DocsRoutes ignores them and a test pins the exact two"
  - "Phase 1 tests that used an unmatched page path as an auth probe now use the Staff site-settings endpoint with an in-memory reader (clock skew, unhandled 500) or POST on a page path (default-deny)"
  - "npm cool-down exceptions are recorded under docs/dependencies.json approvals until plan 03 teaches the registry validator the npm kind"

patterns-established:
  - "SPA host: MapSpaHost after MapCspsApiDocs; literal-prefix fallbacks outrank the {*path:file} / {*path:nonfile} catch-alls"
  - "Static caching: /assets/* public, max-age=31536000, immutable; shell and other files no-cache"
  - "Compression MIME list replaces the defaults (no JSON over HTTPS, BREACH)"

requirements-completed: [WEB-01, PERF-02]

coverage:
  - id: D1
    description: "Approved npm package set installed exactly and locked in web/ and tools/openapi-gen/, npm audit 0, whole tree past the 14-day cool-down except the approved exceptions"
    requirement: WEB-01
    verification:
      - kind: other
        ref: "npm --prefix web ls --depth=0 (42 entries = D-25 table); npm ls rolldown source-map-js http-cache-semantics; npm audit (both folders) = 0; scratchpad ages.mjs lists only rolldown/bindings 1.2.11, source-map-js 1.2.2, http-cache-semantics 4.3.0, lucide-react 1.52.0, vite 8.3.3"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm --prefix web run build writes index.html, hashed assets, mark.svg and robots.txt into the git-ignored wwwroot with no warnings; the built index.html has no inline script or style"
    requirement: WEB-01
    verification:
      - kind: other
        ref: "npm --prefix web run build && git status --porcelain src/Csps.Server/wwwroot (empty) && git check-ignore -q src/Csps.Server/wwwroot/index.html"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dev server is pinned to 5180 with strictPort (a busy 5180 is an error, never a port hop) and proxies /api to http://localhost:5115"
    requirement: WEB-01
    verification:
      - kind: other
        ref: "Held 5180 with a node listener, ran npm --prefix web run dev -> exit 1 'Port 5180 is already in use'"
        status: pass
    human_judgment: false
  - id: D4
    description: "API serves the shell anonymously with no-cache and the strict CSP at any non-file path; missing files and reserved docs prefixes are anonymous ProblemDetails 404s; /api unknowns stay ProblemDetails 404"
    requirement: WEB-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#NonFilePathsServeTheShell, UnknownApiRouteIsStillProblem404, MissingFileIsProblem404, ExistingFileIsServed, ReservedDocsPathsAre404OutsideDevelopment"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs#ProductionHasNoApiDocs, ProductionMapsOnlyTheReservedDocsFallbacks, DevelopmentServesOpenApiAndScalar"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#DiscoveredEndpointsAreFullyCovered"
        status: pass
    human_judgment: false
  - id: D5
    description: "Static html/css/js/svg compressed (br/gzip), JSON and ProblemDetails never compressed; /assets immutable, everything else no-cache"
    requirement: PERF-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#CompressesStaticText, NeverCompressesJson, AssetsAreImmutable, OtherStaticFilesRevalidate"
        status: pass
    human_judgment: false
  - id: D6
    description: "Developer guide explains the web workflow (ci, two-terminal dev, build into wwwroot, preflight, no machine-level env vars)"
    verification: []
    human_judgment: true
    rationale: "Documentation clarity for the owner and future developers is a reading judgment; no test asserts it"

duration: 37min
completed: 2026-10-07
status: complete
---

# Phase 2 Plan 01: Web Foundation Tracer (SPA host) Summary

**Exact-pinned Vite 8.3.3 + React 19.3 app that builds into the git-ignored API wwwroot. ASP.NET Core serves it anonymously under the strict CSP, with ProblemDetails 404s for missing files and the reserved /openapi and /scalar paths, br/gzip only for static text, and immutable /assets caching.**

## Performance

- **Duration:** 37 min wall clock (2026-10-08T02:56:34Z to 03:33:45Z, including the package-approval checkpoint pause)
- **Started:** 2026-10-08T02:56:34Z
- **Completed:** 2026-10-08T03:33:45Z
- **Tasks:** 3 of 3
- **Files modified:** 30

## Accomplishments

- `web/` installed exactly per the owner-approved D-25 table: 42 top-level packages, both lockfiles committed, `npm audit` 0 in both folders. The 568-package tree is past the 14-day cool-down except the approved exceptions (vite 8.3.3, lucide-react 1.52.0, rolldown and its bindings 1.2.11, source-map-js 1.2.2, http-cache-semantics 4.3.0). The D-15 alias works: `tsc --version` is 7.0.2 and `require('typescript')` is 6.0.3.
- `vite.config.ts` (App. D.7 plus marked SPEC-DEVIATIONs): port 5180 with `strictPort` (proven: a busy 5180 exits 1), `/api` proxied to http 5115, the React Compiler limited to `src/**/*.ts(x)` (proven by a compiled probe component), `__DEV_ROUTES__`, and a per-mode `outDir`.
- The API host serves the shell anonymously at `/`, `/products` and `/admin/orders` (200, no-cache, strict CSP). It answers ProblemDetails 404 for `/missing.js`, `/assets/missing.js` and `/favicon.ico` (GET and POST, never 401), and for `/openapi/*` and `/scalar/*` outside Development (D-29). Development still serves Scalar and OpenAPI.
- Response compression (br, gzip) covers html, css, js and svg only. `/health` and ProblemDetails are never compressed (BREACH). `/assets/*` is cached `public, max-age=31536000, immutable`, and everything else is `no-cache`.
- Full solution: 565/565 tests pass, `dotnet build` reports 0 warnings, `dotnet format --verify-no-changes` is clean.

## Task Commits

1. **Task 1 (tracer): the built React shell is served anonymously from wwwroot at /**
   - RED `f4d1c52` (test, previous executor), GREEN `5985365` (feat)
2. **Task 2: missing files and reserved API-doc paths answer ProblemDetails 404**
   - RED `a9f8b26` (test), GREEN `7446a0e` (feat)
3. **Task 3: static text is compressed and cached correctly; JSON never is**
   - RED `21af017` (test), GREEN `644ae7c` (feat)

No REFACTOR commits were needed.

## TDD Gate Compliance (RED evidence)

| Task | RED run | Failing target tests (assertion) | Checker |
|------|---------|----------------------------------|---------|
| 1 | `SpaHostTests` exit 1, 4 tests: 3 failed, 1 passed | `NonFilePathsServeTheShell("/", "/products", "/admin/orders")`: expected 200, got **401** (default-deny fallback, Phase 1 A3). `UnknownApiRouteIsStillProblem404` passed (FND-05 regression guard). Evidence: scratchpad `t1-red.xml` / `t1-red.json` | RED_EVIDENCE_OK |
| 2 | `SpaHostTests` + `OpenApiExposureTests` exit 1, 24 tests: 13 failed. The matrix class also failed 7 of 50. | `MissingFileIsProblem404` x6: expected 404, got **401**. `ReservedDocsPathsAre404OutsideDevelopment` x5: got the 200 shell or 401. `ProductionHasNoApiDocs`: got 200. `ProductionMapsOnlyTheReservedDocsFallbacks`: 0 reserved endpoints. Matrix: anonymous `{*path:file}`/docs rows got 401, and `DiscoveredEndpointsAreFullyCovered` failed. `ExistingFileIsServed` passed (guard). Evidence: `t2-red.xml`, `t2-red-spa.json`, `t2-red-docs.json` | RED_EVIDENCE_OK (both classes) |
| 3 | `SpaHostTests` exit 1, 23 tests: 4 failed | `CompressesStaticText` x2: no Content-Encoding. `AssetsAreImmutable`: Cache-Control "" (expected immutable). `OtherStaticFilesRevalidate("/robots.txt")`: "" (expected no-cache). `NeverCompressesJson` and `OtherStaticFilesRevalidate("/")` passed (guards). Evidence: `t3-red.xml`, `t3-red.json` | RED_EVIDENCE_OK |

The evidence files are in the session scratchpad (`C:/Users/<user>/AppData/Local/Temp/claude/C--Work-CarmensStitchAndPrintingServices/a337486a-6eb9-40ae-aacf-62d9c5c49aa5/scratchpad/`). Each `test(02-01)` commit precedes its `feat(02-01)` commit.

## Files Created/Modified

- `web/.npmrc`: save-exact, engine-strict, min-release-age=14, and excludes with reason comments: lucide-react, vite, source-map-js, http-cache-semantics, rolldown and its 15 `@rolldown/binding-*` packages.
- `web/package.json`: exact pins plus `overrides` (axe-core 4.13.0, source-map-js 1.2.2, http-cache-semantics 4.3.0, rolldown and its bindings 1.2.11). Scripts `dev` and `build`.
- `web/vite.config.ts`, `web/index.html` (App. D.7c plus the description meta), `web/public/mark.svg` (App. F verbatim), `web/public/robots.txt`, `web/src/main.tsx` (minimal StrictMode slice).
- `tools/openapi-gen/{.npmrc,package.json,package-lock.json}`: openapi-typescript 7.13.0 and typescript 5.9.3.
- `src/Csps.Server/Endpoints/SpaHosting.cs`: `ShellFile`, `ShellPattern`, `FilePattern`, `ReservedDocsPatterns`, `MapSpaShell`, `MapSpaHost`.
- `src/Csps.Server/Endpoints/ReservedPathMetadata.cs`: the D-29 marker.
- `src/Csps.Server/Composition/SpaRegistration.cs`: `AddCspsSpaHosting`, `SpaCaching` (`CompressibleTypes`, `Apply`).
- `src/Csps.Server/Program.cs`: `AddCspsSpaHosting`, then `UseResponseCompression`, `UseStaticFiles(SpaCaching.Apply)` and an explicit `UseRouting` after `UseStatusCodePages`, then `MapSpaHost` after `MapCspsApiDocs`.
- `tests/...`: SpaHostTests (9 behaviours), the fixture web root, matrix rows and allow-list keys, D-29 changes to OpenApiExposureTests, and three Phase 1 probe updates.
- `docs/dependencies.json` (three owner approvals), `docs/development.md` ("Web app (web/)" section, Node prerequisite, D-29 note), `.gitattributes`, `.gitignore`, `web/.gitignore`.

## Decisions Made

See `key-decisions` above. The owner's cool-down exceptions are recorded in three places: `web/.npmrc` (exclude plus reason), `web/package.json` (`overrides` exact pins) and `docs/dependencies.json` `approvals`. Each approval entry carries `coolDown: "accepted: security fix GHSA-..."` or `"accepted: owner cool-down waiver 2026-10-07 ..."`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, owner-resolved] Transitive cool-down exceptions for the dev install**
- **Found during:** Task 1 (dev-dependency install, previous executor's checkpoint)
- **Issue:** The D-25 dev set pulls in rolldown 1.2.x (vite 8.3.3's engine; 1.2.11 was 11.5 hours short of 14 days, and npm would otherwise pick 1.2.13) and two high-advisory transitive packages.
- **Fix:** Applied the owner's "now-plus-rolldown" decision exactly. Exact `overrides` pins and `min-release-age-exclude[]` lines with reasons for source-map-js 1.2.2, http-cache-semantics 4.3.0, rolldown 1.2.11 and all 15 `@rolldown/binding-*` 1.2.11 packages (taken from rolldown@1.2.11's optionalDependencies). Recorded in docs/dependencies.json `approvals`.
- **Verification:** the top-level `npm ls --depth=0` matches D-25 exactly, `npm ls` shows only the approved versions of the three packages, `npm audit` reports 0, and the age scan finds no other package under 14 days.
- **Committed in:** `5985365`

**2. [Rule 1 - Bug in plan data] The shell's matrix key is GET/HEAD, not `*`**
- **Found during:** Task 1
- **Issue:** `MapFallbackToFile` registers `HttpMethodMetadata` GET and HEAD, so the discovered keys are `GET {*path:nonfile}` and `HEAD {*path:nonfile}`. The planned `* {*path:nonfile}` row matched no endpoint, so `DiscoveredEndpointsAreFullyCovered` failed.
- **Fix:** Two rows (GET `/`, HEAD `/products`, 200/200/200) and two allow-list keys. The framework behaviour is kept on purpose: POST on a page path is not the shell and stays default-deny (anonymous 401, see `UnservedMethodOnAPagePathIsChallenged`). The must-have "four rows on the allow-list" is now five keys, one more than planned.
- **Files modified:** tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
- **Committed in:** `5985365`

**3. [Rule 1 - Tests encoding the replaced Phase 1 assumption A3] Three Phase 1 tests probed "unmatched page path"**
- **Found during:** Task 1 (full integration run)
- **Issue:** `AuthorizationFailureTests.ClockSkewIsThirtySeconds` and `UnknownNonApiPathIsChallenged` used `/nope` as a signed-in probe. Its own comment said "Phase 2 maps the SPA host anonymously". `ProblemDetailsTests.UnhandledExceptionIsGeneric500WithReference` threw from a terminal middleware that runs only when no endpoint matches, and after this plan every path matches an endpoint.
- **Fix:** Clock skew now probes the Staff `GET /api/v1/site-settings` with an in-memory `FixedSiteSettingsReader` (inside skew 200, expired 401). The challenge test became `UnservedMethodOnAPagePathIsChallenged` (`POST /nope` gives 401 ProblemDetails). The 500 test throws from a `ThrowingSiteSettingsReader` on the real endpoint and keeps every assertion (generic title, reference, no secret, strict CSP).
- **Files modified:** AuthorizationFailureTests.cs, ProblemDetailsTests.cs
- **Committed in:** `5985365`

**4. [Rule 3 - Blocking] ReservedPathMetadata added in the RED commit, in its own file**
- **Found during:** Task 2 RED
- **Issue:** The RED tests reference `ReservedPathMetadata`. A compile error is INVALID_RED.
- **Fix:** The empty marker type (no behaviour) went into `src/Csps.Server/Endpoints/ReservedPathMetadata.cs` with the RED commit, so the tests compile and fail on assertions. It sits in its own file, not inside SpaHosting.cs.
- **Committed in:** `a9f8b26`

**5. [Rule 3 - Blocking] npm exceptions recorded under `approvals`, not `packages`**
- **Found during:** Task 1
- **Issue:** `DependencyRegistry` accepts only the `nuget` and `tool` kinds until plan 03 adds npm support. An npm entry under `packages` would fail `DependencyRegistryTests`.
- **Fix:** Three structured `approvals` entries (package, version, published, adopted, coolDown). Plan 03 creates the `web/*` package entries.
- **Committed in:** `5985365`

---

**Total deviations:** 5 (1 owner-resolved blocking, 2 plan-data/test corrections, 2 blocking workarounds).
**Impact on plan:** All the intended behaviour is delivered. Default-deny is strictly preserved, and the only anonymous endpoints are the five allow-listed SPA/static keys. No scope creep.

## Issues Encountered

- `vite build` with `license: true` writes `.vite/license.md` inside `src/Csps.Server/wwwroot`. ASP.NET Core's default physical file provider should exclude dot-prefixed folders, so `/.vite/license.md` would fall through to the `{*path:file}` 404. This was **not verified against a running host**. Plan 03 (D-10 credit pipeline) should move or consume that file so it is never deployed.
- Process note: one of my shell-quoted edit commands for docs/development.md had backticks expanded by bash. It failed without changing any file, and its stuck shells (this session's own) were stopped. No npm, dotnet or dev-server process was left running. The edit was redone with the Edit tool. An earlier throwaway probe command was refused by a safety check before it ran. Nothing was deleted.
- The `/.vite` observation and the main.tsx placeholder (below) are the only open items.

## Known Stubs

| File | Line | Stub | Resolution |
|------|------|------|------------|
| web/src/main.tsx | 15 | Renders only `<h1>Site update in progress.</h1>` | Intentional tracer slice per the plan. Plan 05 adds the CSS imports and plan 14 replaces the body with the router. |

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 02 can add the gate scripts (lint, typecheck, test) to `web/package.json`. The toolchain is installed and locked.
- Plan 03 owns the npm entries in docs/dependencies.json, the npm kind in the registry validator, the MPL-2.0 build exception for lightningcss, and the `.vite/license.md` placement.
- No blockers.

## Self-Check: PASSED

- All 17 key created files exist on disk.
- Commits f4d1c52, 5985365, a9f8b26, 7446a0e, 21af017 and 644ae7c exist; the ledger count is 6 (880713c..644ae7c).
- Plan `<verification>`: preflight clean, then `dotnet test --solution Csps.slnx` 565/565, `dotnet build Csps.slnx -tl:off` 0 warnings, `dotnet format --verify-no-changes` exit 0, `npm --prefix web run build` exit 0 with no warnings, and `git status --porcelain src/Csps.Server/wwwroot` empty.
- Acceptance greps: `min-release-age=14` 1, `strictPort: true` 1, `ReservedPathMetadata` in OpenApiExposureTests 3, `{*path:file}` in AuthorizationMatrix 2, `image/svg+xml` in SpaRegistration 1 (no application/json), and `UseResponseCompression` on line 74 comes before `UseStaticFiles` on line 78.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-07*

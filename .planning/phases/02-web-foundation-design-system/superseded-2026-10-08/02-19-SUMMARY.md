---
phase: 02-web-foundation-design-system
plan: 19
subsystem: api
tags: [aspnetcore, static-files, ifileprovider, spa-host, security, cwe-538, cwe-41, gap-closure]
gap_closure: true
gap_ids: [G-02-2]
created: "2026-10-08T04:52:00-05:00"
updated: "2026-10-08T04:52:00-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "02-01 SPA host: UseStaticFiles before UseRouting, SpaCaching.Apply, the anonymous {*path:file} ProblemDetails 404, the committed fixture web root"
provides:
  - "HiddenSegmentFileProvider: web-root IFileProvider wrapper that reports any path with a dot-prefixed or tilde segment (split on / and \\) as missing, for file lookups and directory listings"
  - "UseStaticFiles over the wrapped web root on every host (wwwroot, --webroot web/.e2e-dist, test fixture root, Development composite)"
  - "Regression fixtures .vite/license.md and .x/y.txt in tests/Csps.Testing/Fixtures/webroot"
  - "docs/development.md bullet: dot-folder rule and the /.well-known/ exception path"
affects: [02-17, phase-3-deploy, android-app-links, security-review]

actuals:
  tokens: 5021
  tasks: 2
  commits: 4
plan_head_before: 3cfcf99dccc9534b27945f03b4bb4ad1f5bfbe33
plan_head_after: 79e25149fadd1133dbf8bed7482ce19f85d102ec

tech-stack:
  added: []
  patterns:
    - "Static-file refusal lives in an IFileProvider wrapper (NotFoundFileInfo / NotFoundDirectoryContents), so StaticFileMiddleware falls through to the existing missing-file endpoint instead of writing its own 404"
    - "Path rules split on both / and \\ and refuse ~ segments, because the production host is Windows (backslash separator, NTFS 8.3 short names)"

key-files:
  created:
    - src/Csps.Server/Composition/HiddenSegmentFileProvider.cs
    - tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs
    - tests/Csps.Testing/Fixtures/webroot/.vite/license.md
    - tests/Csps.Testing/Fixtures/webroot/.x/y.txt
  modified:
    - src/Csps.Server/Program.cs
    - tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs
    - docs/development.md

key-decisions:
  - "G-02-2 closed server-side (diagnosis option A): HiddenSegmentFileProvider wraps the web root in UseStaticFiles; a segment starting with '.' or containing '~' (split on / and \\) reads as missing and gets the anonymous {*path:file} ProblemDetails 404. D-BL-04 (build.license, credits) stays open and untouched."
  - "Any future /.well-known/ file (security.txt, Android App Links, ACME) needs an explicit, tested exact-path exception inside HiddenSegmentFileProvider, never a relaxed rule (docs/development.md)."

patterns-established:
  - "Web-root refusals: wrap app.Environment.WebRootFileProvider; never short-circuit in middleware"

requirements-completed: [WEB-01]

coverage:
  - id: D1
    description: "Files in dot folders and their case, %2E, nested, backslash and 8.3 aliases get the same anonymous ProblemDetails 404 as a missing file, with no ETag/Last-Modified (GET) and no Accept-Ranges (HEAD)"
    requirement: WEB-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#HiddenFilesAreProblem404 (6 rows)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#HeadOnAHiddenFileIs404WithoutFileMetadata"
        status: pass
    human_judgment: false
  - id: D2
    description: "HiddenSegmentFileProvider rule and IFileProvider contract: truth table on every OS, GetFileInfo, directory listings, Watch, constructor guard"
    requirement: WEB-01
    verification:
      - kind: unit
        ref: "tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs (32 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real app files keep their caching, compression and CSP; no endpoint or authorization change"
    requirement: WEB-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs (all 30 cases)"
        status: pass
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*Authorization*\" (62 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real host (production build, dotnet run on 5115) answers 404 application/problem+json for /.vite/license.md and all variants and 200 for every built file outside .vite/ (UAT test 2 reproduction)"
    requirement: WEB-01
    verification:
      - kind: manual_procedural
        ref: "curl --path-as-is against http://localhost:5115 (output recorded in this SUMMARY)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-08
status: complete
---

# Phase 02 Plan 19: Dot-folder static files (G-02-2) Summary

**`HiddenSegmentFileProvider` wraps the web root in `UseStaticFiles`, so `/.vite/license.md` and its case, `%2E`, `..`, backslash and NTFS 8.3 (`VITE~1`) variants answer the same anonymous ProblemDetails 404 as a missing file, while every real app file keeps its caching and compression.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-08T04:39:09-05:00
- **Completed:** 2026-10-08T04:51:01-05:00
- **Tasks:** 2 (tracer + auto, both TDD)
- **Files modified:** 7

## Accomplishments

- G-02-2 closed server-side. A path with any segment that starts with `.` or contains `~`, split on `/` and `\`, reads as missing. `StaticFileMiddleware` then calls next, and routing picks the existing `{*path:file}` endpoint. Status, title, logging and the no-401 rule are the same as for `/missing.js`.
- Directory listings through the wrapper never open or show a hidden folder. `Watch` delegates unchanged, because a change token discloses no content.
- Regression fixtures model Vite's `build.license` output inside the served test web root. A `File.Exists` guard keeps the 404 rows from passing vacuously.
- The developer guide states the rule and the `/.well-known/` exception path.

## Task Commits

1. **Task 1 (tracer): dot-folder and alias 404 in the static-file pipeline**
   - RED `75a15f4` (test): fixtures, `HiddenFilesAreProblem404` (6 rows), `HeadOnAHiddenFileIs404WithoutFileMetadata`
   - GREEN `842974b` (fix): `HiddenSegmentFileProvider` (file lookups) and the `Program.cs` wiring
2. **Task 2: the whole IFileProvider contract, docs and the real-host check**
   - RED `ba36834` (test): `HiddenSegmentFileProviderTests`
   - GREEN `79e2514` (feat): directory-listing filter plus the docs/development.md bullet

**Plan metadata:** recorded in the `docs(02-19)` commit that adds this SUMMARY.

## TDD Evidence

**Task 1 RED** (`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SpaHostTests"`, exit 2): 7 of 30 failed, and every one failed on `response.StatusCode should be HttpStatusCode.NotFound but was HttpStatusCode.OK`. The 7 were all six `HiddenFilesAreProblem404` rows (`/.vite/license.md`, `/.VITE/LICENSE.MD`, `/%2Evite/license.md`, `/.x/y.txt`, `/assets%5C..%5C.vite%5Clicense.md`, `/VITE~1/license.md`) and `HeadOnAHiddenFileIs404WithoutFileMetadata`. The 23 existing cases passed. `check tdd-red-evidence` returned RED_EVIDENCE_OK for the `/.vite/license.md` row, the `/VITE~1/license.md` row and the HEAD fact (theory targets use `&quot;` entities).

**`VITE~1` observation:** `dir /x /a` on `tests\Csps.Server.IntegrationTests\bin\Debug\net10.0\Fixtures\webroot` shows `VITE~1` for `.vite`, `XF4C6~1` for `.x` and `INDEX~1.HTM` for `index.html`. The 8.3 row was therefore genuinely RED on this machine, not a guard only. The fixture was copied into the test output (`.../Fixtures/webroot/.vite/license.md` exists) with no csproj change.

**Task 1 GREEN:** SpaHostTests 30/30, authorization tests 62/62 (`DiscoveredEndpointsAreFullyCovered` green), `dotnet build Csps.slnx -tl:off` 0 warnings. Tracer gate (interactive, end-of-phase, automated-only verify): verify re-run passed, so expansion went ahead.

**Task 2 RED** (`--filter-class "*HiddenSegmentFileProviderTests"`, exit 2): 3 of 32 failed, on assertions. The other 29 (the truth table, GetFileInfo, Watch and the constructor) characterize Task 1 and passed at once.
- `VisibleListingOmitsHiddenEntries`: expected `["index.html"]`, got `["index.html", ".cache", "VITE~1"]`.
- `RealWebRootDotFolderListingDoesNotExist`: `Exists` was True.
- `HiddenListingNeverAsksTheInnerProvider`: `Exists` was True.

All three records returned RED_EVIDENCE_OK.

**Task 2 GREEN:** HiddenSegmentFileProviderTests 32/32, SpaHostTests 30/30, `dotnet format Csps.slnx --verify-no-changes` exit 0.

## Real-Host Check (UAT test 2 reproduction)

Setup:
- Preflight was clean (5180/5115/7028/5199 free, no dev/test processes).
- `npm --prefix web run build` exited 0 with no warnings and wrote `src/Csps.Server/wwwroot/.vite/license.md` (14,203 bytes). The build is unchanged (D-BL-04).
- `dir /x /a src\Csps.Server\wwwroot` shows `VITE~1` for `.vite`.
- `dotnet run --project src/Csps.Server --launch-profile http` answered `/` with 200 after 2.2 s.

Hidden variants, checked with `curl -s --path-as-is -o /dev/null -w "%{http_code} %{content_type}"`:

```
/.vite/license.md                        404 application/problem+json
/.VITE/LICENSE.MD                        404 application/problem+json
/%2Evite/license.md                      404 application/problem+json
/assets/../.vite/license.md              404 application/problem+json
/assets%5C..%5C.vite%5Clicense.md        404 application/problem+json
/assets%2F..%2F.vite%2Flicense.md        404 application/problem+json
/VITE~1/license.md                       404 application/problem+json
```

`curl -sI http://localhost:5115/.vite/license.md` returned `HTTP/1.1 404 Not Found` with `Content-Type: application/problem+json` and the security headers. It had no ETag, no Last-Modified and no Accept-Ranges.

Every built file outside `.vite/`:
- All 32 files answered 200.
- All 29 `/assets/*` files carry `public, max-age=31536000, immutable`.
- `/index.html`, `/mark.svg` and `/robots.txt` carry `no-cache`.
- `/assets/index-BHn42nLh.js` requested with `Accept-Encoding: br` came back 200 `text/javascript` with `Content-Encoding: br` and the immutable cache header.
- `/` returned 200 `text/html` with `Cache-Control: no-cache`.

Teardown:
- Only this step's processes were stopped: `Csps.Server.exe` (PID 8952, from this repository's bin) and its `dotnet run` parent (PID 12668).
- The preflight re-run shows 5115 free and no dev/test processes.
- The git-ignored `wwwroot/.vite/license.md` is left in place.

## Plan Verification

- Full `dotnet test --solution Csps.slnx` (`CSPS_TEST_SQL=localdb` set for that process only, after the preflight): 878 passed, 0 failed, 0 skipped.
- `dotnet build Csps.slnx -tl:off`: 0 warnings. `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- `npm --prefix web run verify`: exit 0, with ESLint at `--max-warnings 0` and 1242 Vitest tests passing in 47 files.
- `npm --prefix web run e2e -- --grep "@smoke|@fixture"`: 25 passed.
- `node web/scripts/license-gate.mjs`: exit 1 on exactly the 5 D-BL-01 packages, which is expected. They are @csstools/color-helpers and @csstools/css-syntax-patches-for-csstree (MIT-0), argparse (Python-2.0), spdx-exceptions (CC-BY-3.0) and spdx-ranges (MIT AND CC-BY-3.0).
- `git diff --quiet 3cfcf99..HEAD` exits 0 over the protected set. That set is web/vite.config.ts, web/src/test/build-config.test.ts, web/scripts/third-party-notices.mjs, web/THIRD-PARTY-NOTICES.txt, tests/Csps.Testing/Csps.Testing.csproj, AuthorizationMatrix.cs, the 999.1 DECISIONS.md and plans 02-11 and 02-14..02-18. SpaRegistration.cs and SpaHosting.cs are unchanged too.
- `git status --porcelain src/Csps.Server/wwwroot` prints nothing.
- Acceptance greps all print 1:
  - `HiddenSegmentFileProvider(app.Environment.WebRootFileProvider)` in Program.cs
  - `OnPrepareResponse = SpaCaching.Apply` in Program.cs
  - `NotFoundFileInfo` and `NotFoundDirectoryContents` in the provider
  - `HiddenSegmentFileProvider` in docs/development.md
- The guide's `Updated` is now 2026-10-08T04:46:33-05:00.

## Files Created/Modified

- `src/Csps.Server/Composition/HiddenSegmentFileProvider.cs`: the wrapper, with `IsHidden`, `GetFileInfo`, `GetDirectoryContents` (filtered listing) and `Watch` (delegated). Its XML docs cite G-02-2, CWE-538, CWE-41 and CWE-58, plus `SpaHosting.FilePattern`.
- `src/Csps.Server/Program.cs`: `UseStaticFiles` gets `FileProvider = new HiddenSegmentFileProvider(app.Environment.WebRootFileProvider)` next to the unchanged `OnPrepareResponse = SpaCaching.Apply`, with a one-line comment.
- `tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs`: `FixtureHiddenMarker`, the `HiddenFilesAreProblem404` theory, the `HeadOnAHiddenFileIs404WithoutFileMetadata` fact and one more sentence in the class summary.
- `tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs`: the truth table (14 hidden rows, 9 kept rows), file lookup tests with a recording fake and a real `PhysicalFileProvider`, listing tests, Watch and the constructor guard.
- `tests/Csps.Testing/Fixtures/webroot/.vite/license.md`, `tests/Csps.Testing/Fixtures/webroot/.x/y.txt`: regression fixtures with the marker "CSPS fixture build internal".
- `docs/development.md`, "How the API serves the app": **new bullet** saying that files inside a dot folder (such as Vite's `.vite/`), and Windows short-name or backslash aliases of them, are never served and get the same 404 as a missing file, and that a deliberate `/.well-known/` file needs an explicit, tested exception in `HiddenSegmentFileProvider`. **Plan 02-17's executor should expect this bullet** in the section it edits.

## Decisions Made

- The Task 1 GREEN commit uses `fix(02-19)`, as the plan directs (it fixes a UAT gap). Task 2 GREEN is `feat(02-19)`. Both RED `test(02-19)` commits come before their GREEN commits.
- An inner directory listing that does not exist is passed through unchanged. An existing one is wrapped and keeps `Exists = true`.

## Deviations from Plan

None. The plan was executed exactly as written.

## Issues Encountered

None. The first preflight call failed only because Bash consumed the backslashes in the script path. It was re-run with a quoted path and was clean.

## Known Stubs

None.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- G-02-2 is ready for re-verification. The orchestrator reconciles the UAT gap status on the next verify-work resume, and this plan did not edit 02-UAT.md.
- D-BL-04 (fate of `build.license` / public credits) is still open for the owner. The server no longer serves the file whatever the owner decides.
- Phase 3 first deploy: record how SmarterASP.NET validates Let's Encrypt certificates. Any `/.well-known/` need gets an exact-path exception in the wrapper, with its own tests.

## Self-Check: PASSED

- FOUND: src/Csps.Server/Composition/HiddenSegmentFileProvider.cs, tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs, tests/Csps.Testing/Fixtures/webroot/.vite/license.md, tests/Csps.Testing/Fixtures/webroot/.x/y.txt
- FOUND commits: 75a15f4, 842974b, ba36834, 79e2514 (`git rev-list --count 3cfcf99..HEAD` = 4)

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

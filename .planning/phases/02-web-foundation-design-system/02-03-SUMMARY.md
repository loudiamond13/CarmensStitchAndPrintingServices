---
phase: 02-web-foundation-design-system
plan: 03
subsystem: api
tags: [aspnetcore, static-files, file-provider, response-compression, cache-control, security, tdd, xunit-v3]
created: "2026-10-08T09:59:07-05:00"
updated: "2026-10-08T09:59:07-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "02-01 SPA host: UseStaticFiles before explicit UseRouting, {*path:file} ProblemDetails 404, fixture web root (CspsApiFactory.FixtureWebRoot)"
provides:
  - "HiddenSegmentFileProvider: dot-prefixed or tilde segments (split on / and \\) read as missing for files and listings; Watch delegates"
  - "UseStaticFiles serves through HiddenSegmentFileProvider(app.Environment.WebRootFileProvider) with OnPrepareResponse = SpaCaching.Apply"
  - "AddCspsSpaHosting: Brotli + gzip compression (EnableForHttps) for html/css/js/svg only; JSON never compressed"
  - "SpaCaching: /assets/* public, max-age=31536000, immutable; every other static file no-cache"
  - "The {*path:file} and reserved-docs 404 send no content for HEAD (same status and media type as GET)"
  - "Regression fixtures tests/Csps.Testing/Fixtures/webroot/.vite/license.md and .x/y.txt (copied to the test output)"
  - "docs/development.md section: How the API serves the web app"
affects: [02-web-foundation-design-system, playwright-host, lighthouse-host, phase-03-deploy-web-config]

actuals:
  tokens: 8079
  tasks: 2
  commits: 4
plan_head_before: 20515cb072e1d1e836def5f6bdab9aa07c2ea8a4
plan_head_after: a3270008d0a2fbe98bb0a77d6d9da04b4cf3a0f7

tech-stack:
  added: []
  patterns:
    - "Web-root hardening lives in an IFileProvider wrapper, so refused files fall through to the existing missing-file 404 and look exactly like missing ones"
    - "Response compression uses an explicit MIME allow-list that replaces the framework defaults (no JSON, BREACH)"
    - "Static-file cache policy is one OnPrepareResponse callback: hashed /assets immutable, everything else no-cache"

key-files:
  created:
    - src/Csps.Server/Composition/HiddenSegmentFileProvider.cs
    - src/Csps.Server/Composition/SpaRegistration.cs
    - tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs
    - tests/Csps.Testing/Fixtures/webroot/.vite/license.md
    - tests/Csps.Testing/Fixtures/webroot/.x/y.txt
  modified:
    - src/Csps.Server/Program.cs
    - src/Csps.Server/Endpoints/SpaHosting.cs
    - tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs
    - docs/development.md

key-decisions:
  - "02-03: The SpaHosting file 404 (and the reserved /openapi, /scalar 404s) answer HEAD with status 404 and Content-Type application/problem+json but no content (RFC 9110 9.3.2). Kestrel drops HEAD bodies anyway; the test host does not, so the app writes none and every host is identical"
  - "02-03: The tilde rule refuses any segment containing '~' (NTFS 8.3 aliases such as VITE~1, INDEX~1.HTM); Vite asset names never contain one. A future /.well-known/ file needs an explicit, tested exact-path exception (AR-02-02)"

patterns-established:
  - "Directory-listing tests use PhysicalFileProvider(root, ExclusionFilters.None) as the inner provider, because the default Sensitive filter already hides dot-prefixed entries and would make the test vacuous"
  - "Integration tests that must not pass vacuously first assert File.Exists on the fixture under CspsApiFactory.FixtureWebRoot"

requirements-completed: [WEB-01, PERF-02]

coverage:
  - id: D1
    description: "Any web-root file under a dot-prefixed or tilde segment (/.vite/license.md, /.VITE/LICENSE.MD, /%2Evite/license.md, /assets%5C..%5C.vite%5Clicense.md, /VITE~1/license.md, /.x/y.txt) answers the anonymous ProblemDetails 404 with no ETag, Last-Modified or Accept-Ranges, for GET and HEAD, identical to a missing file"
    requirement: "WEB-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs#DotFolderFilesAre404"
        status: pass
      - kind: unit
        ref: "tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs#IsHiddenRules"
        status: pass
      - kind: unit
        ref: "tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs#DirectoryListingsHideSegments"
        status: pass
    human_judgment: false
  - id: D2
    description: "Real files keep being served: /assets/app-fixture.js answers 200 text/javascript"
    requirement: "WEB-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#ExistingFileIsServed"
        status: pass
      - kind: unit
        ref: "tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs#RealWebRootAppFileIsUnchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "The shell and static js are Brotli-compressed when the client accepts br, gzip; /health JSON and /api ProblemDetails are never compressed"
    requirement: "PERF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#CompressesStaticText"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#NeverCompressesJson"
        status: pass
    human_judgment: false
  - id: D4
    description: "/assets/* carry Cache-Control public, max-age=31536000, immutable; /robots.txt, /index.html and the shell at / carry no-cache"
    requirement: "PERF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#AssetsAreImmutable"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#OtherStaticFilesRevalidate"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/development.md explains how the API serves the web app (build output, fixture web root, shell, file 404, hidden-segment rule, /.well-known/ exception policy, compression, caching)"
    requirement: "WEB-01"
    verification:
      - kind: other
        ref: "grep -c \"How the API serves the web app\" docs/development.md (1)"
        status: pass
    human_judgment: true
    rationale: "Whether the prose is clear and complete for a new developer is a reading judgment; the grep only proves the section exists"

duration: 10min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 03: Hidden-Segment Refusal, Static Compression and Cache Headers Summary

**The API's web root now refuses every path with a dot-prefixed or tilde segment (split on `/` and `\`), so Vite build internals, encoded, cased, backslash and NTFS 8.3 alias requests all get the same anonymous ProblemDetails 404 as a missing file, with no file metadata. Static html, css, js and svg are Brotli/gzip-compressed while JSON never is, and hashed `/assets/*` files are cached as immutable while everything else revalidates.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-10-08T14:49:58Z
- **Completed:** 2026-10-08T14:59:07Z
- **Tasks:** 2 of 2
- **Files modified:** 9

## Accomplishments

- `HiddenSegmentFileProvider` wraps `app.Environment.WebRootFileProvider`:
  - `IsHidden` refuses any segment that starts with `.` (which also covers `.` and `..`) or contains `~`, split on `/` and `\`. Null and empty paths are not hidden.
  - `GetFileInfo` returns `NotFoundFileInfo` and `GetDirectoryContents` returns `NotFoundDirectoryContents.Singleton` for hidden paths, without asking the inner provider. Visible listings drop hidden entries. `Watch` delegates.
  - The XML docs name L-04, L-05, CWE-538/41/58/204 and the AR-02-02 `/.well-known/` exception rule.
- `Program.cs`: `AddCspsSpaHosting()` after `AddCspsOpenApi`, then `UseResponseCompression()` immediately before `UseStaticFiles(new StaticFileOptions { FileProvider = new HiddenSegmentFileProvider(app.Environment.WebRootFileProvider), OnPrepareResponse = SpaCaching.Apply })`.
- `SpaRegistration.AddCspsSpaHosting` sets up Brotli + gzip with `EnableForHttps`. `MimeTypes = SpaCaching.CompressibleTypes` (html, css, text/javascript, application/javascript, svg) replaces the defaults, so JSON is never compressed.
- `SpaCaching.Apply`: `/assets/*` gets `public, max-age=31536000, immutable`, and every other static file gets `no-cache`.
- The dot-folder regression fixtures are committed and copied to the test output. The existing `<None Include="Fixtures\webroot\**">` item copies dot folders; `dir /x` in the test output shows `VITE~1` and `XF4C6~1`, so the 8.3 rows were genuinely RED.
- `docs/development.md` has a new section, "How the API serves the web app".

## Task Commits

1. **Task 1 (tracer): a request for Vite's build internal in a dot folder gets the anonymous missing-file 404**
   - RED `fc86d26` (test): fixtures, `HiddenSegmentFileProviderTests` and an inert delegating provider. Target `DotFolderFilesAre404(method: "GET", path: "/.vite/license.md", fixtureFile: ".vite/license.md")` failed with 200 instead of 404. All 12 DotFolder rows failed on the 200, the 8.3 rows included. 31/44 failed in total. RED_EVIDENCE_OK.
   - GREEN `49df9c9` (feat): 44/44 passed.
   - Tracer gate (end-of-phase mode, automated-only verify): verify re-run after the commit, 44/44 passed, then expansion.
2. **Task 2: static text is compressed and cached correctly, JSON is never compressed, developer guide updated**
   - RED `6ebb836` (test): target `CompressesStaticText(path: "/")` failed with no Content-Encoding. `AssetsAreImmutable` and `OtherStaticFilesRevalidate` (`/robots.txt`, `/index.html`) failed on the missing Cache-Control. RED_EVIDENCE_OK.
   - GREEN `a327000` (feat): SpaHostTests 24/24 passed.

REFACTOR: none needed.

## Files Created/Modified

- `src/Csps.Server/Composition/HiddenSegmentFileProvider.cs`: the web-root wrapper (L-04).
- `src/Csps.Server/Composition/SpaRegistration.cs`: `AddCspsSpaHosting` and `SpaCaching` (`CompressibleTypes`, `ImmutableCacheControl`, `RevalidateCacheControl`, `Apply`).
- `src/Csps.Server/Program.cs`: compression registration, `UseResponseCompression`, and the wrapped, cache-aware `UseStaticFiles`.
- `src/Csps.Server/Endpoints/SpaHosting.cs`: the file 404 sends no content for HEAD (Deviation 1).
- `tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs`: DotFolderFilesAre404 (12 rows), IsHiddenRules (23 rows), DirectoryListingsHideSegments and 8 provider unit tests.
- `tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs`: CompressesStaticText, NeverCompressesJson, AssetsAreImmutable, OtherStaticFilesRevalidate.
- `tests/Csps.Testing/Fixtures/webroot/.vite/license.md`, `.x/y.txt`: the build-internal fixtures.
- `docs/development.md`: the hosting section and the `Updated` timestamp.

## Decisions Made

- HEAD on the file 404 sends no content (see Deviation 1).
- The `.vite/license.md` fixture carries `created`/`updated` front matter (owner timestamp rule) above the plan's one line. The test checks only for "must never be served", so this changes nothing.
- The provider uses the primary constructor the plan names, with `inner ?? throw new ArgumentNullException(nameof(inner))`, so a null inner provider still fails fast (tested).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The file 404 sent a ProblemDetails body on HEAD**
- **Found during:** Task 1 GREEN.
- **Issue:** The plan's truth says the HEAD rows get no body. The `{*path:file}` fallback wrote a ProblemDetails body for HEAD. Kestrel discards HEAD bodies, but the test host returned it (6 HEAD rows failed), and RFC 9110 9.3.2 forbids content in a HEAD response.
- **Fix:** `SpaHosting.NotFound` is now a `RequestDelegate`. For HEAD it sets status 404 and `Content-Type: application/problem+json` and writes nothing. Setting the content type keeps `UseStatusCodePages` from adding a body. GET and every other method still write the ProblemDetails. HEAD on a hidden file and HEAD on `/missing.js` are asserted identical (CWE-204).
- **Files modified:** `src/Csps.Server/Endpoints/SpaHosting.cs`, `tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs`.
- **Verification:** HiddenSegmentFileProviderTests 44/44. The full integration project passed 254/254 (after Task 1) and 262/262 (after Task 2), the authorization matrix included.
- **Committed in:** `49df9c9`.

---

**Total deviations:** 1 auto-fixed (missing critical).
**Impact on plan:** Needed to meet the plan's own HEAD truth on every host. It also covers the reserved `/openapi` and `/scalar` 404s, which share the handler. No scope creep, and no packages.

## Issues Encountered

- A stale ledger file, `.git/gsd-plan-head-before-02-03` (`88912f2`), was left over from the superseded run. I reset it to `20515cb` before the first commit, so `commits: 4` is measured from this run.
- The `DirectoryListingsHideSegments` test needs an inner `PhysicalFileProvider` with `ExclusionFilters.None`. The default `Sensitive` filter already hides dot-prefixed entries from listings, which would let the test pass vacuously.

## Verification

- `dotnet test --project tests/Csps.Server.IntegrationTests`: 262/262 passed.
- `dotnet test --project tests/Csps.ArchitectureTests`: 77/77 passed.
- `dotnet build Csps.slnx -tl:off`: 0 warnings, 0 errors.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- Acceptance greps:
  - Both fixtures are tracked by `git ls-files`.
  - `HiddenSegmentFileProvider(app.Environment.WebRootFileProvider)` appears once in `Program.cs`.
  - `'~'` appears once in the provider.
  - `application/json` appears 0 times in `SpaRegistration.cs`.
  - `UseResponseCompression` appears once, on line 74, before `UseStaticFiles` on line 79.
  - The section heading appears once in `docs/development.md`.

## TDD Gate Compliance

Both tasks went RED then GREEN: `test(02-03)` fc86d26 → `feat(02-03)` 49df9c9, and `test(02-03)` 6ebb836 → `feat(02-03)` a327000. Both RED records were verified as `RED_EVIDENCE_OK` on assertion failures (200 instead of 404, and no Content-Encoding), not on compile errors.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- WEB-01's server hardening and PERF-02's compression and caching are in place for the Playwright and Lighthouse hosts in later Phase 2 plans.
- Phase 3 (deploy) must confirm IIS leaves app-compressed responses alone (research A6) and that `web.config` adds no compression for JSON.

## Self-Check: PASSED

All 5 created files exist, and all 4 task commits (fc86d26, 49df9c9, 6ebb836, a327000) are in the log.

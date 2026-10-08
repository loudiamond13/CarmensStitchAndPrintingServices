---
phase: 02-web-foundation-design-system
plan: 15
subsystem: api
tags: [openapi, openapi-typescript, codegen, drift-check, api-client, tdd, xunit, node-test, vitest]
created: "2026-10-08T14:44:00-05:00"
updated: "2026-10-08T14:44:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-10)
    provides: "createHttpClient (single-flight 401 refresh, HttpError), web/src/test/fakeFetch.ts"
  - phase: 02-web-foundation-design-system (plan 02-37)
    provides: "tools/openapi-gen with openapi-typescript 7.13.0 + typescript 5.9.3 and the generate/check script names"
  - phase: 02-web-foundation-design-system (plan 02-06)
    provides: "npm registry entries for the tools/openapi-gen pins (unchanged by this plan)"
provides:
  - "tools/openapi-gen/openapi.v1.json: the normalized Development /openapi/v1.json snapshot"
  - "OpenApiSnapshotTests: live document vs committed snapshot, first differing JSON path in the message, CSPS_WRITE_OPENAPI_SNAPSHOT=1 write switch (write runs always fail)"
  - "web/src/types/api.generated.ts: generated from the snapshot, never hand-edited"
  - "tools/openapi-gen/check.mjs (+ check.test.mjs, `npm --prefix tools/openapi-gen test`): drift check through a temp-file CLI run, --snapshot/--generated options"
  - "web/src/lib/api.ts: api, createApi, Api, SiteSettings, HttpError, isHttpError, HttpErrorKind; eight declared groups, only site.settings(signal) has a call"
  - "docs/web/api.md: the drift chain, refresh steps, adding calls, Idempotency-Key rule"
affects: [02-16, every-later-plan-that-adds-an-endpoint, phase-3-ci, phase-4-auth]

actuals:
  tokens: 11500    # chars/4 over the realized diff (45,857 chars, 10 files)
  tasks: 2
  commits: 4
plan_head_before: 52c6eb0d24a784f99490ca76aea7282bf64a004d
plan_head_after: 6516f00d6fd5e4d7a6db396c4acda5cb82041c1c

tech-stack:
  added: []
  patterns:
    - "Contract drift chain: live Development document -> committed snapshot (xUnit) -> committed generated types (check.mjs) -> api.ts (tsc)"
    - "Snapshot comparisons normalize JSON (ordinal key sort, whitespace ignored) and report the first differing JSON path"
    - "tools/openapi-gen tests run on node:test (`npm --prefix tools/openapi-gen test`), so the tool folder needs no test package"

key-files:
  created:
    - tools/openapi-gen/openapi.v1.json
    - tools/openapi-gen/check.mjs
    - tools/openapi-gen/check.test.mjs
    - tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs
    - web/src/types/api.generated.ts
    - web/src/lib/api.ts
    - web/src/lib/api.test.ts
    - docs/web/api.md
  modified:
    - tools/openapi-gen/package.json
    - web/eslint.config.mjs

key-decisions:
  - "The snapshot test reads tools/openapi-gen/openapi.v1.json from the repository root (walk up to Csps.slnx from the test output folder), not through a csproj-linked copy, so no project file changes"
  - "check.mjs runs the openapi-typescript CLI into a temp folder (not the in-memory API) so the check uses exactly the code path `npm run generate` uses"
  - "All eight api groups are declared as empty `PlannedGroup` objects now; a group's type becomes an object type with its first call"
  - "api.ts imports the client as `import * as http`, so one line names createHttpClient (the single shared client)"
  - "src/lib/api.test.ts joins the csps/restrictions/api ESLint override so it can build clients over a fake fetch"

patterns-established:
  - "Adding an endpoint: change the API -> CSPS_WRITE_OPENAPI_SNAPSHOT=1 for one command -> npm --prefix tools/openapi-gen run generate -> update api.ts -> commit all three"
  - "api.ts tests use createApi(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) and check method, URL and the typed result"

requirements-completed: [WEB-04]

coverage:
  - id: D1
    description: "OpenApiSnapshotTests fails when the live Development /openapi/v1.json differs from the committed snapshot after JSON normalization, naming the first differing JSON path and the refresh steps"
    requirement: WEB-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument"
        status: pass
      - kind: unit
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#AnEditedSnapshotFailsNamingTheChangedPath (5 cases), KeyOrderAndWhitespaceAreNotDifferences, CanonicalFormSortsObjectKeysOrdinallyAndKeepsArrayOrder, ASnapshotThatIsNotJsonFailsWithAPlainMessage"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm --prefix tools/openapi-gen run check regenerates types from the committed snapshot and fails on any difference from web/src/types/api.generated.ts; generate rewrites it"
    requirement: WEB-04
    verification:
      - kind: unit
        ref: "tools/openapi-gen/check.test.mjs (9 cases, node:test)"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check (exit 0); node tools/openapi-gen/check.mjs --snapshot <temp copy with facebookUrl renamed> (exit 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "api.ts is the single endpoint module: api.site.settings(signal) returns the generated SiteSettingsDto type through one shared createHttpClient({ baseURL: '/api/v1' }); groups declared; HttpError re-exported"
    requirement: WEB-04
    verification:
      - kind: unit
        ref: "web/src/lib/api.test.ts#api.site.settings (WEB-04) (4 cases), api groups"
        status: pass
      - kind: other
        ref: "npm --prefix web run lint (exit 0); npm --prefix web run typecheck (0 errors)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Three concurrent 401s through createApi share one refresh and retry once each; a failed refresh rejects all three and signs out once"
    requirement: WEB-04
    verification:
      - kind: unit
        ref: "web/src/lib/api.test.ts#one shared client (WEB-04 concurrency edge) (2 cases)"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (exit 0; 46 files, 1276 tests)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 15: OpenAPI Snapshot, Generated Types and the Single Endpoint Module Summary

**The live Development OpenAPI document is now a committed, normalized snapshot that an xUnit test holds to the running API. A node drift check holds the committed `api.generated.ts` to that snapshot, and `api.ts`, the only module that calls endpoints, returns those generated types through one shared HTTP client. `api.site.settings(signal)` is the first typed call.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-08T19:28:26Z
- **Completed:** 2026-10-08T19:43:57Z
- **Tasks:** 2
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments

- **Snapshot test (D-16).** `OpenApiSnapshotTests.CommittedSnapshotMatchesTheLiveDocument` starts the Development host with no database, gets `/openapi/v1.json`, and compares it with `tools/openapi-gen/openapi.v1.json`. Key order and whitespace do not count. On a mismatch the message names the first differing JSON path, for example `$.components.schemas.SiteSettingsDto.properties.locale (only in the snapshot)`, and gives the refresh steps. `CSPS_WRITE_OPENAPI_SNAPSHOT=1`, set for one command only, rewrites the snapshot in canonical form, and that run always fails on purpose.
- **Generated types.** `web/src/types/api.generated.ts` comes from the snapshot through openapi-typescript 7.13.0 (`npm --prefix tools/openapi-gen run generate`) and has `SiteSettingsDto` with all 9 required properties.
- **Drift check.** `npm --prefix tools/openapi-gen run check` runs the same CLI into a temp folder and compares the result line by line with the committed file. It exits 1 with the first differing line (and both sides), or when the types file is missing, and exits 2 on bad arguments. It never writes the committed file. `--snapshot` and `--generated` allow proof runs.
- **api.ts (WEB-04).** It keeps the 74621f5 convention comment and declares the eight groups `auth`, `orders`, `expenses`, `users`, `site`, `analytics`, `profile` and `inquiries`. Only `site.settings(signal)` has a call. It exports `createApi(client)` for tests and one shared `api = createApi(http.createHttpClient({ baseURL: '/api/v1' }))`, and re-exports `HttpError`, `isHttpError` and `HttpErrorKind`.
- **Concurrency edge.** Three concurrent `site.settings()` calls that all get a 401 cause one `refresh()` and three retries, for 6 fetch calls. A failed refresh rejects all three with a 401 and calls `onUnauthorized` once.
- **Guide.** `docs/web/api.md` covers the drift chain table, the refresh steps (bash and PowerShell, per-process only), the generated-file rules, how to add a call, the Idempotency-Key rule and the shared-client refresh.

## Task Commits

1. **Task 1: Tracer, the live OpenAPI document becomes committed types that api.site.settings() returns**
   - RED `510b720` (test): OpenApiSnapshotTests against an empty `{}` snapshot failed at `$.components (only in the live document)`, and api.test.ts against an inert api.ts had 4 of 5 failing. Both were `RED_EVIDENCE_OK`: the target for .NET was `Csps.Server.IntegrationTests.Http.OpenApiSnapshotTests` and the target for web was `src/lib/api.test.ts`.
   - GREEN `957c1f2` (feat): the snapshot written with the switch, the generated types, api.ts and the ESLint override entry.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran both verify commands after the commit. The .NET filter passed 9/9 and api.test.ts passed 5/5, so I expanded.
2. **Task 2: Type drift check, shared-client concurrency test and the API pipeline guide**
   - RED `7b810b1` (test): check.test.mjs had 7 of 8 failing against an inert check.mjs (`RED_EVIDENCE_OK`, target `check.mjs (the D-16 drift check)`). The two api.test.ts concurrency cases were also added here, and they passed at once (see Deviations).
   - GREEN `6516f00` (feat): check.mjs, the final-newline case and docs/web/api.md.
   - REFACTOR: none needed.

**Plan metadata:** recorded in the docs commit that adds this SUMMARY.

## Files Created/Modified

- `tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs`: the snapshot test, `Canonicalize`, `Difference` (first JSON path) and the write switch. It has 9 tests.
- `tools/openapi-gen/openapi.v1.json`: the canonical snapshot (sorted keys, 2-space indent, LF).
- `tools/openapi-gen/check.mjs`: the drift check, exporting `firstDifference`.
- `tools/openapi-gen/check.test.mjs`: 9 node:test cases.
- `tools/openapi-gen/package.json`: adds the `"test": "node --test check.test.mjs"` script. Dependencies are unchanged.
- `web/src/types/api.generated.ts`: the generated types.
- `web/src/lib/api.ts`: the endpoint module.
- `web/src/lib/api.test.ts`: 7 cases covering the call, the signal, the HttpError, the shared instance, the concurrency cases and the groups.
- `web/eslint.config.mjs`: `src/lib/api.test.ts` is added to the `csps/restrictions/api` files.
- `docs/web/api.md`: the API pipeline guide.

## Decisions Made

- **Snapshot read from the repository root.** The test finds the root by walking up to `Csps.slnx` from the test output folder. The reference linked the file into the output through the csproj instead, but walking up needs no project change and also finds the root under `artifacts/`.
- **check.mjs uses the CLI, not the library API.** Generating into a temp file with the same `bin/cli.js` that `generate` runs means the check and the generator cannot drift apart. Its text is compared line by line with CRLF treated as LF, and a change in the final newline alone is still reported.
- **Groups declared now.** Each is a `PlannedGroup` (`Readonly<Record<string, never>>`). The groups test pins all eight keys and checks that only `site` has a call.
- **`import * as http` in api.ts.** This meets the plan's criterion that `grep -c createHttpClient` equals 1 and keeps the single construction obvious.
- **The servers entry stays in the snapshot.** The test host's `https://localhost/` server entry is part of the live document, so it is kept with no extra normalization. It does not reach the generated types.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] api.test.ts needed the lib/http ESLint exception**
- **Found during:** Task 1 (GREEN)
- **Issue:** The test builds clients with `createHttpClient` and a fake fetch, and the WEB-04 import fence allows `lib/http` only in api.ts. The 02-10 and 02-04 notes anticipated this.
- **Fix:** I added `src/lib/api.test.ts` to the `csps/restrictions/api` `files` list in `web/eslint.config.mjs`. The lint-rules and eslint-config tests (88) still pass.
- **Files modified:** `web/eslint.config.mjs`
- **Committed in:** `957c1f2`

**2. [Rule 2 - Missing critical] A test runner for check.mjs**
- **Found during:** Task 2 (RED)
- **Issue:** The plan makes check.mjs a TDD target, but `tools/openapi-gen` had no test runner. Adding a package would need the owner's approval.
- **Fix:** I wrote `check.test.mjs` on Node's built-in `node:test` and added an `npm test` script. No package was added, and the lockfile and dependencies are unchanged.
- **Files modified:** `tools/openapi-gen/check.test.mjs`, `tools/openapi-gen/package.json`
- **Committed in:** `7b810b1`

**3. [TDD note] The concurrency tests passed at RED**
- **Found during:** Task 2 (RED)
- **Issue:** The three-401 and failed-refresh cases pass against the Task 1 api.ts. That is expected, because api.ts already routes every call through one client and the single-flight refresh comes from 02-10 (WEB-03). They are characterization tests for the WEB-04 concurrency edge, not new behaviour.
- **Fix:** None needed. Task 2's RED evidence targets check.test.mjs, which failed on assertions as required.
- **Committed in:** `7b810b1`

---

**Total deviations:** 2 auto-fixed (1 Rule 3, 1 Rule 2) plus 1 TDD note.
**Impact on plan:** Every must-have truth is proven. No package was added and the backend endpoint is untouched.

## Issues Encountered

- The first xUnit JUnit run used `--report-junit`, which MTP rejected with exit 5 (zero tests). The right option is `--report-xunit-junit`.
- One Python-driven edit lost a backslash escape. I fixed it with the Edit tool before any commit, and the tests then passed.

## Package Approval Gate (conditional checkpoint)

It did not fire. Nothing was installed, upgraded or re-resolved. `tools/openapi-gen/package-lock.json`, `web/package.json` and `web/package-lock.json` are unchanged. The only package.json change is a `scripts` entry.

## Proof Run (acceptance criterion)

I copied the snapshot to a temp file, renamed `"facebookUrl"` to `"facebookPage"` in the copy, and ran `node tools/openapi-gen/check.mjs --snapshot <copy>`:

```text
Generated API types are out of date: web/src/types/api.generated.ts differs from what
C:\...\proof-02-15\openapi.v1.json generates.
First difference at line 40:
- committed:             facebookUrl: string;
+ generated:             facebookPage?: string;
Run npm --prefix tools/openapi-gen run generate and commit the result (docs/web/api.md).
exit 1
```

## Verification

- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshot*"`: 9/9 pass.
- `npm --prefix tools/openapi-gen run check`: exit 0, "Generated API types match tools/openapi-gen/openapi.v1.json."
- `npm --prefix tools/openapi-gen test`: 9/9 pass.
- `npm --prefix web run test -- --run src/lib/api.test.ts`: 7/7 pass.
- `npm --prefix web run verify`: exit 0. Typecheck, lint and format are clean, 46 files and 1276 tests pass, all-files coverage is 100/99.78/100/100, and the build, license gate and notices check pass.
- `dotnet test --project tests/Csps.ArchitectureTests`: 97/97 pass, so the dependency registry still matches the tools/openapi-gen manifest.
- `grep -c "SiteSettingsDto" web/src/types/api.generated.ts` = 2, and `grep -c "createHttpClient" web/src/lib/api.ts` = 1.

## TDD Gate Compliance

- Task 1: RED `510b720` comes before GREEN `957c1f2`. `RED_EVIDENCE_OK` for `Csps.Server.IntegrationTests.Http.OpenApiSnapshotTests` and for `src/lib/api.test.ts`.
- Task 2: RED `7b810b1` comes before GREEN `6516f00`. `RED_EVIDENCE_OK` for `check.mjs (the D-16 drift check)` (node:test JUnit classname).
- No refactor commits were needed.

## Notes for Later Plans

- **02-16 (useSubmission):** POST functions in api.ts take `{ idempotencyKey }` and pass it to the client. docs/web/api.md already points at useSubmission as the key source.
- **Adding an endpoint:** after the API change, `OpenApiSnapshotTests` fails. Refresh it with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command, then run `npm --prefix tools/openapi-gen run generate` and commit the snapshot and the types together.
- **Phase 3 CI:** run `npm --prefix tools/openapi-gen ci`, then `run check` and `test`. The OpenApiSnapshotTests run with the integration tests and need no database.
- **Phase 4:** pass `refresh` and `onUnauthorized` to the shared `http.createHttpClient` in api.ts.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

The API contract chain is complete, and api.ts is ready for the feature phases' endpoint groups.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 8 created files exist on disk.
- Commits `510b720`, `957c1f2`, `7b810b1` and `6516f00` are on `gsd/phase-2-web-foundation-design-system`.

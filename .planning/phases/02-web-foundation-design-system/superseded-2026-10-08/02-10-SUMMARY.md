---
phase: 02-web-foundation-design-system
plan: 10
subsystem: web-api
tags: [openapi, openapi-typescript, api-ts, idempotency-key, useSubmission, error-copy, vitest, xunit]
created: "2026-10-08T02:45:00-05:00"
updated: "2026-10-08T02:45:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 01)
    provides: "tools/openapi-gen (openapi-typescript 7.13.0 + typescript 5.9.3); Development-only /openapi/v1.json; Prettier and ESLint already ignore src/types/api.generated.ts"
  - phase: 02-web-foundation-design-system (plan 02)
    provides: "ESLint WEB-04 rules: lib/http imports only from src/lib/api.ts (and its test)"
  - phase: 02-web-foundation-design-system (plan 07)
    provides: "createHttpClient, HttpError/isHttpError/HttpErrorKind, RequestConfig.idempotencyKey reuse on retries, createFakeFetch/createDeferred"
provides:
  - "OpenApiSnapshotTests: live Development /openapi/v1.json (canonical: ordinal key sort, 2-space, LF) must equal tools/openapi-gen/openapi.v1.json; CSPS_WRITE_OPENAPI_SNAPSHOT=1 writes it and fails"
  - "tools/openapi-gen scripts generate (CLI) and check (check.mjs, in-memory regeneration, exit 1 on drift)"
  - "web/src/types/api.generated.ts (committed generated types)"
  - "web/src/lib/api.ts: createApi(client), default api (/api/v1), api.site.settings(signal?), SiteSettings type, re-exports HttpError, isHttpError, HttpErrorKind"
  - "web/src/lib/forms/useSubmission.ts: useSubmission(submit) -> { run, pending, error, reset }, newIdempotencyKey(), SubmitContext, SubmissionOutcome"
  - "web/src/lib/forms/focusFirstInvalid.ts: focusFirstInvalid(root): boolean"
  - "web/src/lib/errors/describeHttpError.ts: describeHttpError(error) -> { title, body, fieldErrors? } | null"
  - "docs/development.md: API types section"
affects: [02-11 ConfirmDialog error copy and Button pending, 02-13 ErrorState reference line, 02-16 component showcase pending demo, phase 04 auth api group and refresh, every feature phase adding api.<area> groups]

actuals:
  tokens: 11748
  tasks: 3
  commits: 6
plan_head_before: 78a239754defb53973a0a55c11cbf4cd8dfd88a0
plan_head_after: 324563f439583e0044a44c4a48560f8bba30e682

tech-stack:
  added: []
  patterns:
    - "Contract pipeline: live Development OpenAPI -> canonical committed snapshot (xUnit drift test) -> openapi-typescript types (node drift check) -> api.ts, the only consumer"
    - "api.<area>.<verb>(…, signal?) returning client.get<T>/post<T> with types from components['schemas']; POST functions take { idempotencyKey } from useSubmission"
    - "useSubmission.run never rejects: it resolves to { ok: true, value } | { ok: false, error }, so handlers can `void run(values)` with no unhandled rejection"
    - "Per-mount AbortSignal for submissions: aborted before mount (module-level AbortSignal.abort()) and on unmount"

key-files:
  created:
    - tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs
    - tools/openapi-gen/check.mjs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/lib/api.ts
    - web/src/lib/api.test.ts
    - web/src/lib/forms/useSubmission.ts
    - web/src/lib/forms/useSubmission.test.tsx
    - web/src/lib/forms/focusFirstInvalid.ts
    - web/src/lib/forms/focusFirstInvalid.test.tsx
    - web/src/lib/errors/describeHttpError.ts
    - web/src/lib/errors/describeHttpError.test.ts
  modified:
    - tests/Csps.Server.IntegrationTests/Csps.Server.IntegrationTests.csproj
    - tools/openapi-gen/package.json
    - docs/development.md

key-decisions:
  - "useSubmission.run resolves to a SubmissionOutcome ({ ok, value } or { ok, error }) and never rejects; the failure is also exposed as `error` state. A rejecting run would make every `void run(values)` handler an unhandled rejection (a console error, which the zero-console rule forbids)"
  - "A run without data (run(undefined), e.g. a ConfirmDialog delete) is comparable: its failed retry reuses the key. Data JSON cannot compare (BigInt, cycles, functions) never reuses a key, so a retry of it is a new submission"
  - "describeHttpError: a 400 with field errors returns title 'Check the highlighted fields.', body '' and the fieldErrors (the messages go under the fields); a 400 without field errors, any unmapped status (410, 413, 422, ...) and kind parse get the 5xx copy with the reference; a non-HttpError value gets the 5xx copy without a reference"
  - "The snapshot keeps the test host's servers entry (https://localhost/); the snapshot test is the single source of truth for the canonical form"
  - "tools/openapi-gen/package.json gains type: module (check.mjs is ESM); no dependency changes"

patterns-established:
  - "Refresh the API contract: CSPS_WRITE_OPENAPI_SNAPSHOT=1 dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*OpenApiSnapshotTests\" (per process), rerun without it, npm --prefix tools/openapi-gen run generate, then run check"
  - "Error copy comes only from describeHttpError; UI never shows HttpError.message or ProblemDetails text"

requirements-completed: [WEB-04, WEB-09]

coverage:
  - id: D1
    description: "Committed canonical OpenAPI snapshot with a live-vs-snapshot drift test that writes only under the per-process switch and then still fails"
    requirement: WEB-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument"
        status: pass
      - kind: unit
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CanonicalFormSortsObjectKeysOrdinallyAndKeepsArrayOrder"
        status: pass
      - kind: other
        ref: "CSPS_WRITE_OPENAPI_SNAPSHOT=1 dotnet test --project tests/Csps.Server.IntegrationTests --filter-class \"*OpenApiSnapshotTests\" -> 'Snapshot written; run again without CSPS_WRITE_OPENAPI_SNAPSHOT' (fails by design)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Generated API types committed and drift-checked by openapi-typescript 7.13.0 regeneration in memory"
    requirement: WEB-04
    verification:
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check (exit 0); mutation: an edited api.generated.ts makes check exit 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "api.ts is the only endpoint module: createApi, default api at /api/v1, api.site.settings typed from components['schemas'], independent AbortSignals per call, HttpError re-exports"
    requirement: WEB-04
    verification:
      - kind: unit
        ref: "web/src/lib/api.test.ts"
        status: pass
      - kind: other
        ref: "npm --prefix web run lint (exit 0, max-warnings 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "useSubmission: one Idempotency-Key per submission, reused for a JSON-equal retry of a failed submission, new after success/reset/changed data; one request in flight; pending state; unmount aborts; v4 key from randomUUID or getRandomValues, never Math.random"
    requirement: WEB-09
    verification:
      - kind: unit
        ref: "web/src/lib/forms/useSubmission.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "focusFirstInvalid focuses the first aria-invalid=\"true\" element in DOM order and returns false when there is none"
    requirement: WEB-09
    verification:
      - kind: unit
        ref: "web/src/lib/forms/focusFirstInvalid.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "describeHttpError returns the UI-SPEC copy for every listed kind and status, null for 401 and aborted, and never shows server text"
    requirement: WEB-04
    verification:
      - kind: unit
        ref: "web/src/lib/errors/describeHttpError.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Developer guide 'API types' section (api.ts rule, snapshot refresh, generate, check)"
    verification: []
    human_judgment: true
    rationale: "Documentation clarity is a reading judgment; no test asserts it"

duration: 20min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 10: API Contract Pipeline, useSubmission and Error Copy Summary

**The API's Development OpenAPI document is now a committed canonical snapshot. An xUnit drift test guards it, and openapi-typescript turns it into committed `api.generated.ts` types with a node drift check. `api.ts` is the single typed gateway (`api.site.settings`). `useSubmission` mints one Idempotency-Key per submission and reuses it only for a retry of that same failed submission. `describeHttpError` holds all of the approved error copy.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-10-08T07:25:27Z
- **Completed:** 2026-10-08T07:45:00Z
- **Tasks:** 3 of 3 (TDD: 3 RED and 3 GREEN commits)
- **Files modified:** 15 (12 created, 3 modified)

## Accomplishments

- **Contract pipeline (Task 1, tracer).**
  - How `OpenApiSnapshotTests` works:
    - It starts a Development host with no database and fetches `/openapi/v1.json`.
    - It canonicalizes the document: object keys sorted ordinally (arrays keep their order), 2-space indent, LF line endings and a final newline.
    - It compares the result with `tools/openapi-gen/openapi.v1.json`, which is linked into the test output as `Fixtures/openapi.v1.json`.
  - With `CSPS_WRITE_OPENAPI_SNAPSHOT=1` the test writes the snapshot (finding the repository root by walking up to `Csps.slnx` from the source file) and then fails on purpose.
  - `npm --prefix tools/openapi-gen run generate` runs the openapi-typescript CLI. `run check` (`check.mjs`) regenerates the types in memory from `COMMENT_HEADER + astToString(openapiTS(snapshot))` and exits 1 with "Generated API types are out of date; run npm --prefix tools/openapi-gen run generate" when the committed file differs.
  - `api.ts`:
    - `createApi(client)` and the default `api` instance (baseURL `/api/v1`).
    - `api.site.settings(signal?)`, typed `SiteSettings = components['schemas']['SiteSettingsDto']`.
    - Re-exports `HttpError`, `isHttpError` and `HttpErrorKind`.
    - A header comment states the WEB-04 rule, the `api.<area>.<verb>` convention and the `{ idempotencyKey }` rule for POSTs.
  - The server endpoint `GET /api/v1/site-settings` is unchanged (the plan does not touch it, so it stays a Minimal API).
- **Submissions (Task 2).**
  - How `useSubmission(submit)` handles a submission:
    - The key is minted before the first attempt, and `submit(args, { idempotencyKey, signal })` gets it.
    - A second trigger while pending gets the same promise.
    - A JSON-equal retry of a failed submission reuses the key. A success, `reset()` or changed data starts a new key.
    - It returns `{ run, pending, error, reset }`, and `run` resolves to `{ ok, value | error }`.
    - The signal aborts on unmount.
  - `newIdempotencyKey()` uses `crypto.randomUUID`. When that is missing it builds a v4 UUID from `crypto.getRandomValues`, with the version and variant bits set (Pitfall 15).
  - `focusFirstInvalid(root)` focuses the first `aria-invalid="true"` element.
- **Error copy (Task 3).**
  - `describeHttpError` returns the UI-SPEC wording for:
    - network and timeout
    - a 400 with field errors (the field errors are passed on)
    - 403, 404, 409 and 429
    - any 5xx: "Please try again. Reference: {traceId}", or "Please try again." when there is no traceId
  - It returns null for a 401 and for a request the user aborted.
  - Docs: `docs/development.md` has a new "API types" section, and its Updated timestamp is bumped.

## Task Commits

1. **Task 1 (tracer): the live OpenAPI document becomes committed types that api.site.settings() returns**
   - RED `e1d4672` (test), GREEN `1f9d01d` (feat)
2. **Task 2: useSubmission and focusFirstInvalid**
   - RED `5bb3f5a` (test), GREEN `4cd3f94` (feat)
3. **Task 3: describeHttpError and developer docs**
   - RED `571caa4` (test), GREEN `324563f` (feat)

No REFACTOR commits were needed.

## TDD Gate Compliance (RED evidence)

| Task | RED run | Failing target (assertion) | Checker |
|------|---------|----------------------------|---------|
| 1 (.NET) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"`: exit 2, 1 of 2 failed | `CommittedSnapshotMatchesTheLiveDocument`: Shouldly string mismatch, because the committed placeholder `{}` is not the live document. The pure canonical-form test passed. | RED_EVIDENCE_OK (`p10/t1-red-dotnet.json`) |
| 1 (web) | `npm --prefix web run test -- --run src/lib/api.test.ts`: exit 1, 5 of 5 failed | `expected undefined to deeply equal { …(9) }` and `expected the promise to reject`. The placeholder `createApi` resolved undefined without calling the client. | RED_EVIDENCE_OK (`p10/t1-red-web.json`) |
| 2 | `npm --prefix web run test -- --run src/lib/forms`: exit 1, 15 of 17 failed | pending `expected false to be true`, `expected Promise to be Promise`, `expected '' to match` the v4 pattern, and focusFirstInvalid `expected false to be true`. The two guard cases (focus unchanged when nothing is invalid, and Math.random never called on the randomUUID path) passed. | RED_EVIDENCE_OK (`p10/t2-red-submission.json`, `p10/t2-red-focus.json`) |
| 3 | `npm --prefix web run test -- --run src/lib/errors`: exit 1, 18 of 19 failed | `expected { title: '', body: '' } to deeply equal` the approved copy. The "never shows server text" guard passed. | RED_EVIDENCE_OK (`p10/t3-red.json`) |

The evidence files are in the session scratchpad under `p10/`: the `t*-red.{xml,json,log}` files, `verify.log`, `dotnet-test.log`, `license.log` and `e2e.log`. Each `test(02-10)` commit comes before its `feat(02-10)` commit.

## Files Created/Modified

- `tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs`: the drift test, the write switch and `Canonicalize`.
- `tests/Csps.Server.IntegrationTests/Csps.Server.IntegrationTests.csproj`: links the snapshot as `Fixtures\openapi.v1.json` (XML comment names D-16).
- `tools/openapi-gen/openapi.v1.json`: the canonical snapshot (contains `/api/v1/site-settings` and `SiteSettingsDto`).
- `tools/openapi-gen/package.json`: `type: module`, plus the `generate` and `check` scripts.
- `tools/openapi-gen/check.mjs`: the in-memory regeneration and diff.
- `web/src/types/api.generated.ts`: the generated types.
- `web/src/lib/api.ts` and `api.test.ts`: the endpoint module and its tests (5).
- `web/src/lib/forms/useSubmission.ts` and its test (19 tests together with focusFirstInvalid).
- `web/src/lib/forms/focusFirstInvalid.ts` and its test.
- `web/src/lib/errors/describeHttpError.ts` and its test (19).
- `docs/development.md`: the "API types" section.

## Decisions Made

See `key-decisions` in the frontmatter. In short:
- `run` never rejects. It resolves to an outcome, and the failure is also exposed as `error`.
- A no-data run is a comparable submission.
- Data that JSON cannot represent never reuses a key.
- A 400 with field errors gets an empty body.
- Any unmapped failure falls back to the 5xx copy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] The concurrency test aborted before either request reached fetch**
- **Found during:** Task 1 GREEN.
- **Issue:** `first.abort()` ran synchronously, before the client called fetch. The fake fetch rejects an already-aborted call without consuming its planned answer. That left the `{ hang: true }` answer for the second call, which then hung until the 5 s timeout.
- **Fix:** The test now waits (`vi.waitFor`) until both requests are in flight before it aborts the first one. This is also the realistic case: aborting an in-flight request.
- **Files modified:** web/src/lib/api.test.ts
- **Committed in:** `1f9d01d`

**2. [Rule 2 - Missing correctness] A retry of a no-data submission would have minted a new key**
- **Found during:** Task 2 GREEN.
- **Issue:** `JSON.stringify(undefined)` is undefined, so `run(undefined)` (for example a ConfirmDialog delete, UI-SPEC "ConfirmDialog action fails") would never reuse its key on retry. That breaks WEB-09 for confirm buttons.
- **Fix:** A run without data now serializes as `'undefined'`, which can be compared. Two tests were added: a no-data retry reuses its key, and function data never does.
- **Files modified:** web/src/lib/forms/useSubmission.ts, useSubmission.test.tsx
- **Committed in:** `4cd3f94`

**3. [Rule 1 - Coverage] Unreachable fallback branch**
- **Found during:** Task 2 coverage.
- **Issue:** `lifetimeRef.current ?? new AbortController()` had a branch that no test could reach.
- **Fix:** The ref now starts as a module-level aborted signal (`AbortSignal.abort()`), and the mount effect replaces it. A submission before mount or after unmount is therefore aborted, which is also the correct meaning. `src/lib/forms` is at 100/100/100/100.
- **Committed in:** `4cd3f94`

---

**Total deviations:** 3 auto-fixed (1 test bug, 1 missing correctness, 1 coverage).
**Impact on plan:** No change in scope. Every plan truth holds.

## Issues Encountered

- The `tdd-red-evidence` checker matches .NET JUnit names by their fully qualified name, so the Task 1 .NET record names `Csps.Server.IntegrationTests.Http.OpenApiSnapshotTests.CommittedSnapshotMatchesTheLiveDocument`. Vitest records name the test file, as in plans 02 to 07.

## Threat Model Coverage

| Threat | Mitigation | Proof |
|--------|------------|-------|
| T-02-28 contract drift | OpenApiSnapshotTests (live vs committed) and `tools/openapi-gen` check (snapshot vs types) | RED run of the snapshot test, and the check mutation exits 1 |
| T-02-29 predictable keys | `crypto.randomUUID` or `crypto.getRandomValues` only. `grep -c "Math.random" useSubmission.ts` gives 0. | useSubmission tests: a `Math.random` spy is never called on either path |
| T-02-30 server text in errors | describeHttpError shows only approved copy plus the traceId | test "never shows server text" |
| T-02-SC npm installs | No packages added. The license gate still fails on exactly the 5 D-BL-01 packages and nothing new. `npm audit` is 0 in web and tools/openapi-gen. | `license.log` |

## Verification

- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"`: exit 0 (2/2).
- `npm --prefix tools/openapi-gen run check`: exit 0.
- `npm --prefix web run verify`: exit 0.
  - Covers typecheck, lint (0 warnings), Prettier and the build.
  - 1030 tests in 33 files (987 before this plan + 43 new).
  - Coverage thresholds pass, and lib/http, lib/url-state and lib/query stay at 100%. The new `src/lib/forms` and `src/lib/errors` and `src/lib/api.ts` are all at 100%.
- `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx`: 839/839 passed (837 before + 2), 0 warnings. `dotnet format --verify-no-changes` is clean on the integration-test project.
- `npm --prefix web run e2e -- --grep "@smoke|@fixture"`: 25/25 passed. Preflight ran first, all four ports were free, and no other project's processes were running. No processes were left afterwards.
- `node web/scripts/license-gate.mjs`: exit 1 on exactly the 5 known D-BL-01 packages, as expected.
- Acceptance greps:
  - The snapshot contains `/api/v1/site-settings`.
  - `Math.random` appears 0 times in useSubmission.ts.
  - `docs/development.md` contains `npm --prefix tools/openapi-gen run check`, and its Updated timestamp changed.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **Plan 11:**
  - ConfirmDialog and forms use `useSubmission(submit)`. `run` resolves to an outcome, so `if (!outcome.ok) setError(describeHttpError(outcome.error))` needs no try/catch.
  - `focusFirstInvalid(dialogBody)` after field errors.
  - Pending buttons read `pending`.
- **Plan 13:** ErrorState can show `describeHttpError(err)`. A 400 with field errors has an empty `body`, so the banner should skip an empty second line.
- **Phase 4:** add `api.auth` and the bearer interceptor, and set `refresh`/`onUnauthorized` on the default client in `api.ts`.
- **Every endpoint change:** refresh the snapshot and the types as described in docs/development.md "API types".
- **Blockers carried:** 02-11 is still blocked on D-BL-03 (owner rulings). This plan does not depend on them.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

All 8 key source files exist; all 6 task commits (e1d4672, 1f9d01d, 5bb3f5a, 4cd3f94, 571caa4, 324563f) are in git log.

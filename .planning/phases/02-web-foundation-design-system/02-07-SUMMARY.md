---
phase: 02-web-foundation-design-system
plan: 07
subsystem: web-http
tags: [fetch, xhr, abortsignal, retries, idempotency-key, problem-details, vitest, coverage]
created: "2026-10-08T01:00:38-05:00"
updated: "2026-10-08T01:00:38-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02)
    provides: "ESLint architecture rules: fetch/XMLHttpRequest only inside src/lib/http, lib/http imports only from src/lib/api.ts"
  - phase: 01-foundation
    provides: "CspsProblemDetails: plain-English title, traceId extension, errors object for validation"
provides:
  - "createHttpClient (web/src/lib/http/httpClient.ts): the project's only HTTP transport, over fetch, with an XHR transport only for upload progress"
  - "HttpError / isHttpError / parseProblemDetails / HttpErrorKind (web/src/lib/http/HttpError.ts)"
  - "Test doubles in web/src/test/fakeFetch.ts: createFakeFetch, createFakeXhrFactory (FakeXhr, XhrClass), createDeferred"
  - "coverage.thresholds['src/lib/http/**'] = 100 (lines, branches, functions, statements) in web/vitest.config.ts"
affects: [02-08 query defaults, 02-10 api.ts and useSubmission, 02-11 ConfirmDialog errors, 02-13 ErrorState, phase 04 auth refresh]

actuals:
  tokens: 21517
  tasks: 3
  commits: 6
plan_head_before: e600a7f7c84b66c30b5799065b4e23eb86a93383
plan_head_after: 1f81363cdbd16c9c043c65c91ebb3d4033e8b25a

tech-stack:
  added: []
  patterns:
    - "Inject fetch, the XHR factory and sleep; tests never touch the network or real timers they do not control"
    - "One per-attempt AbortController for the timeout, combined with the caller signal by AbortSignal.any; the kind comes from which signal fired"
    - "One RefreshCycle per client, published before refresh() runs and cleared in finally; onUnauthorized at most once per cycle"
    - "The Idempotency-Key header comes only from RequestConfig.idempotencyKey and is set before request interceptors, so every retry and the refresh retry resend it"

key-files:
  created:
    - web/src/lib/http/httpClient.ts
    - web/src/lib/http/HttpError.ts
    - web/src/lib/http/httpClient.test.ts
    - web/src/lib/http/httpClient.resilience.test.ts
    - web/src/lib/http/httpClient.transport.test.ts
    - web/src/lib/http/HttpError.test.ts
    - web/src/test/fakeFetch.ts
  modified:
    - web/vitest.config.ts

key-decisions:
  - "The client never creates an Idempotency-Key, and never sends one on a safe method (GET, HEAD, OPTIONS), even when a caller passes one"
  - "A 401 with no refresh configured calls onUnauthorized and rejects. Concurrent second 401s after one refresh call onUnauthorized once"
  - "Retry defaults: max 2 (clamped 0..2), backoff 250 ms doubling to a 2 s cap, no jitter (deterministic tests); only after kind network or a 503, never after timeout or aborted"
  - "Response interceptors are use(onFulfilled?, onRejected?); onRejected receives each HttpError and returns the error the request rejects with. A TypeError from a secret param skips them"
  - "A 2xx body that is not JSON resolves to its text; an empty body resolves to undefined; an error body that is not valid JSON gives kind http with no problem"
  - "Secret params (token, access_token, refresh_token, password, secret, otp; case-insensitive) throw a TypeError before fetch, including ones an interceptor adds"

patterns-established:
  - "Plan 10's api.test.ts reuses createFakeFetch with { hang: true } plans for abort tests"
  - "HTTP tests use the rejection(promise) helper (expect.fail on a non-HttpError) so RED runs fail on assertions, not on thrown errors"

requirements-completed: [WEB-03, WEB-09]

coverage:
  - id: D1
    description: "Typed GET round trip: baseURL + path, same-origin credentials, Accept JSON, params serialization (repeated keys, null/undefined skipped), default and request headers, method helpers"
    requirement: WEB-03
    verification:
      - kind: unit
        ref: "web/src/lib/http/httpClient.test.ts#createHttpClient: GET round trip"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every failure is an HttpError (kind, status 0 without a response, problem, fieldErrors, traceId) with a plain-English message; never a raw Response"
    requirement: WEB-03
    verification:
      - kind: unit
        ref: "web/src/lib/http/HttpError.test.ts"
        status: pass
      - kind: unit
        ref: "web/src/lib/http/httpClient.test.ts#createHttpClient: ProblemDetails errors"
        status: pass
    human_judgment: false
  - id: D3
    description: "Caller abort gives kind aborted, the timeout gives kind timeout, neither is retried, and timers are cleared"
    requirement: WEB-03
    verification:
      - kind: unit
        ref: "web/src/lib/http/httpClient.resilience.test.ts#timeout and abort"
        status: pass
    human_judgment: false
  - id: D4
    description: "At most 2 capped exponential retries, only for GET/HEAD/PUT/DELETE/OPTIONS and a keyed POST, only after a network error or 503"
    requirement: WEB-03
    verification:
      - kind: unit
        ref: "web/src/lib/http/httpClient.resilience.test.ts#capped retries"
        status: pass
    human_judgment: false
  - id: D5
    description: "Idempotency-Key reuse: the same key on every retry and on the refresh retry; no key on GET or keyless requests; a keyless POST is never retried; two POSTs make two requests"
    requirement: WEB-09
    verification:
      - kind: unit
        ref: "web/src/lib/http/httpClient.resilience.test.ts#Idempotency-Key (WEB-09)"
        status: pass
      - kind: unit
        ref: "web/src/lib/http/httpClient.transport.test.ts#a keyed POST upload is retried after a network error with the same key"
        status: pass
    human_judgment: false
  - id: D6
    description: "Single-flight 401 refresh: three concurrent 401s make one refresh call and one retry each; a failed refresh rejects all with 401 and calls onUnauthorized once"
    requirement: WEB-03
    verification:
      - kind: unit
        ref: "web/src/lib/http/httpClient.resilience.test.ts#single-flight 401 refresh"
        status: pass
    human_judgment: false
  - id: D7
    description: "Secret param names are rejected before any request is sent"
    requirement: WEB-03
    verification:
      - kind: unit
        ref: "web/src/lib/http/httpClient.resilience.test.ts#secrets never go in a URL (PRD 8.2, 9.3)"
        status: pass
    human_judgment: false
  - id: D8
    description: "JSON/FormData bodies, parse failures, the XHR upload transport (progress, errors, abort, timeout) and response interceptors"
    requirement: WEB-03
    verification:
      - kind: unit
        ref: "web/src/lib/http/httpClient.transport.test.ts"
        status: pass
    human_judgment: false
  - id: D9
    description: "100% line, branch, function and statement coverage for src/lib/http, enforced by a Vitest threshold"
    requirement: WEB-03
    verification:
      - kind: other
        ref: "npm --prefix web run verify (exit 0; src/lib/http 227/227 statements, 131/131 branches, 57/57 functions, 223/223 lines)"
        status: pass
      - kind: other
        ref: "mutation: vitest run --coverage without httpClient.transport.test.ts fails the src/lib/http/** threshold (exit 1)"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 07: Fetch-based HTTP Client Summary

**`createHttpClient` is the project's only HTTP transport. It runs over fetch and uses XMLHttpRequest only when a caller asks for upload progress. It supports request/response interceptors, combines the caller's AbortSignal with a per-attempt timeout, retries at most 2 times with capped backoff (idempotent methods and keyed POSTs only), runs one shared 401 refresh, resends the same Idempotency-Key on every retry, and turns every failure into an `HttpError` carrying the ProblemDetails, field errors and traceId. Vitest holds `src/lib/http` at 100% coverage.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-08T05:41:48Z
- **Completed:** 2026-10-08T06:00:38Z
- **Tasks:** 3 (TDD: 3 RED + 3 GREEN commits)
- **Files modified:** 8 (7 created, 1 modified)

## Accomplishments

- **Core client (Task 1).**
  - `get/post/put/patch/delete<T>()` and `request<T>()` build the URL as baseURL + path + serialized params.
  - Every request has `credentials: 'same-origin'` and `Accept: application/json`.
  - Bodies: JSON gets `Content-Type: application/json` unless the caller set a Content-Type. FormData goes through unchanged with no Content-Type.
  - Responses: a 2xx JSON or problem+json body is parsed, an empty body resolves to undefined, and other text is returned as is.
  - Errors: any non-2xx becomes `HttpError` kind `http` with the parsed ProblemDetails.
  - Request interceptors run in registration order. `use()` returns an eject function.
- **HttpError.**
  - Fields: `kind` (`network | timeout | aborted | http | parse`), `status` (0 when there was no response), `problem`, frozen `fieldErrors`, `traceId`.
  - The message is the problem title, or a plain-English default for the kind. It never contains response text.
  - `parseProblemDetails` keeps only members of the right type, and only string messages in `errors`.
- **Resilience (Task 2).**
  - Abort and timeout: `AbortSignal.any([caller, timeout])`. The kind (aborted or timeout) comes from which signal fired, and neither is retried.
  - Retries: at most 2 (clamped), capped exponential backoff through an injectable `sleep` that rejects on abort. Only GET, HEAD, PUT, DELETE, OPTIONS and a POST with an `idempotencyKey` are retried, and only after kind network or a 503.
  - Idempotency-Key: comes from `idempotencyKey` only, is set before the interceptors run, and is reused on every retry and on the refresh retry.
  - Single-flight refresh: one `RefreshCycle` per client, retry once, `onUnauthorized` at most once per cycle.
  - Secret param names throw a TypeError before fetch.
- **Transport (Task 3).**
  - The XHR path covers headers, upload progress (`total` is undefined when the browser can't compute it), abort, timeout and response-header parsing, and errors take the same `HttpError` path as fetch.
  - Response interceptors: `use(onFulfilled?, onRejected?)`.
  - The 100% coverage threshold for `src/lib/http/**`.
- **Test doubles.** `createFakeFetch` builds real `Response` objects from planned responses (`{ status, headers, body }`, `{ networkError }`, `{ hang }`, or a function) and records every call. `createFakeXhrFactory` returns a factory and a stub class for the global `XMLHttpRequest`.

## Task Commits

1. **Task 1: Tracer, a typed GET round trip and a ProblemDetails 404**
   - `9fad810` test: GET round trip, params, headers, bodies, ProblemDetails, request interceptors, HttpError (RED)
   - `d4a4dc0` feat: fetch client core and HttpError (GREEN)
2. **Task 2: Timeout and abort, capped retries, single-flight 401 refresh, Idempotency-Key reuse**
   - `040dcec` test: resilience suite (RED)
   - `3ed539c` feat: AbortSignal.any timeout/abort, retry policy, refresh cycle, secret-param guard (GREEN)
3. **Task 3: Bodies, XHR upload progress, parse failures, 100% coverage gate**
   - `1b8d59f` test: transport suite and fake XHR (RED)
   - `1f81363` feat: XHR transport, response interceptors, coverage threshold (GREEN)

No REFACTOR commit: nothing needed cleanup after GREEN.

## TDD Gate Compliance (RED evidence)

| Task | RED run | Failing target (assertion) | Checker |
|------|---------|----------------------------|---------|
| 1 | `vitest run httpClient.test.ts HttpError.test.ts` exit 1, 35 of 40 failed, all AssertionError | `GETs baseURL + path with same-origin credentials…`: `expected [] to have a length of 1 but got +0`. The RED commit's placeholder client resolved `undefined` without calling fetch, and the HttpError placeholder had an empty message and status -1. | RED_EVIDENCE_OK (`p07/t1-red.json`) |
| 2 | `vitest run httpClient.resilience.test.ts` exit 1, 40 of 50 failed | `retries a GET after a network error and resolves on the second call`: `promise rejected "HttpError: We couldn't reach the server…" instead of resolving`. Also `expected 'network' to be 'aborted'`, refresh `called 0 times`, and `expected [] to deeply equal [100, 150]`. | RED_EVIDENCE_OK (`p07/t2-red.json`) |
| 3 | `vitest run httpClient.transport.test.ts` exit 1, 12 of 23 failed (9 AssertionError, 3 direct awaits that rejected with an HttpError) | `turns a ProblemDetails error into the same HttpError shape as fetch`: `expected ['network', 0, …] to deeply equal ['http', 413, 'File too large', …]`. There was no XHR transport yet, so the upload went to fetch. The RED commit added an inert `interceptors.response.use`, so the interceptor tests failed on assertions rather than a TypeError. | RED_EVIDENCE_OK (`p07/t3-red.json`) |

The evidence files are in the session scratchpad under `p07/`: `t1..t3-red.{xml,json,log}`, `verify.log`, `dotnet-test.log`, `license.log` and `t3-gate-mutation.log`.

## Files Created/Modified

- `web/src/lib/http/httpClient.ts`: `createHttpClient` and the types `HttpClient`, `HttpClientConfig`, `RequestConfig`, `RequestOptions`, `RetryPolicy`, `Sleep`, `HttpRequest`, `HttpResponse`, `RequestInterceptor`, `ResponseInterceptor`, `ErrorInterceptor`, `Eject`, `FetchFunction`, `XhrFactory`, `UploadProgress`, `Params`, `HttpMethod`.
- `web/src/lib/http/HttpError.ts`: `HttpError`, `isHttpError`, `parseProblemDetails`, and the types `HttpErrorKind`, `ProblemDetails`, `FieldErrors`, `HttpErrorInit`.
- `web/src/lib/http/httpClient.test.ts`: core round trip, ProblemDetails errors, request interceptors (17 tests).
- `web/src/lib/http/httpClient.resilience.test.ts`: abort, timeout, retries, Idempotency-Key, secret params, refresh (47 tests).
- `web/src/lib/http/httpClient.transport.test.ts`: bodies, parse failures, XHR transport, response interceptors (23 tests).
- `web/src/lib/http/HttpError.test.ts`: error shape, messages, isHttpError, parseProblemDetails (23 tests).
- `web/src/test/fakeFetch.ts`: `createFakeFetch`, `createFakeXhrFactory`, `FakeXhr`, `createDeferred`.
- `web/vitest.config.ts`: the `src/lib/http/**` 100% threshold.

## Decisions Made

- **Idempotency-Key only on unsafe methods.**
  - It is never sent on GET, HEAD or OPTIONS, even when a key is passed. This follows the plan's rule that a GET "never carries an Idempotency-Key header".
  - The client never creates a key. Plan 10's `useSubmission` creates one per submission (WEB-09).
- **401 handling.**
  - No `refresh` configured: the client calls `onUnauthorized` and rejects (PRD 9.3: "otherwise sign out").
  - With `refresh`: a failed refresh, or a 401 again on the retry, calls `onUnauthorized` once per refresh cycle. Concurrent requests therefore trigger only one redirect.
  - A 401 that arrives after a cycle has finished starts a new refresh.
- **Backoff without jitter.** Delays are 250 ms, then 500 ms, capped at 2 s. That keeps tests deterministic. With max 2 retries and no TanStack retries (plan 08 sets `retry: false`), the worst case is 3 requests per call.
- **Same-origin cookies on XHR.** XHR keeps `withCredentials = false`, which sends cookies to its own origin only, the same as fetch's `credentials: 'same-origin'`. The literal appears once in httpClient.ts, as the acceptance grep requires.
- **Lenient response headers.** A malformed line from `getAllResponseHeaders()` is skipped, not fatal. Otherwise a throw inside `onload` would leave the request hanging until the timeout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's folder coverage command cannot exit 0 under the project-wide 90% threshold**
- **Found during:** Task 3 verification.
- **Issue:** `npm --prefix web run test -- --run src/lib/http --coverage` exits 1. The existing global thresholds (90%) apply to every file in `coverage.include` (`src/**`), and a run filtered to lib/http leaves the other files untested (global lines 73%).
- **Fix:** No config was weakened.
  - The folder check runs as `npm --prefix web run test -- --run src/lib/http --coverage "--coverage.include=src/lib/http/**"`: exit 0, 100/100/100/100.
  - The full `npm --prefix web run verify` (every test, with coverage) enforces the new `src/lib/http/**` threshold: exit 0.
  - A mutation run without `httpClient.transport.test.ts` failed exactly that threshold, proving the gate fires.
- **Files modified:** none beyond the plan's.
- **Committed in:** n/a (verification only).

**2. [Rule 1 - Test expectation] "No body" is `null`, not `undefined`**
- **Found during:** Task 1 GREEN.
- **Issue:** The RED test expected `init.body` to be `undefined` on a GET. Under `exactOptionalPropertyTypes` the client passes `body: null`, which is fetch's documented "no body" value.
- **Fix:** The assertion is now `toBeNull()`.
- **Committed in:** `d4a4dc0`.

**3. [Rule 2 - Missing branch test] Non-401 failure on the refresh retry**
- **Found during:** Task 3 coverage.
- **Issue:** A refresh retry that fails with a 500 had no test (the last uncovered branch).
- **Fix:** Added a resilience test. It rejects with the 500 and does not call `onUnauthorized`.
- **Committed in:** `1f81363`.

---

**Total deviations:** 3 auto-fixed (1 blocking verify command, 1 test expectation, 1 missing test).
**Impact on plan:** None on scope. All plan truths hold, and the coverage gate is stricter than the plan's command alone.

## Issues Encountered

- The `tdd-red-evidence` checker names Vitest JUnit failures by file, so each RED record's target is the test file. The specific failing test and its assertion are recorded in the table above, as in plans 02 and 05.

## Threat Model Coverage

| Threat | Mitigation in code | Proof |
|--------|--------------------|-------|
| T-02-18 secrets in URLs | `assertNoSecretParams` runs after the interceptors and before fetch. Every request has `credentials: 'same-origin'`. | resilience: "secrets never go in a URL" (7 names + the interceptor case) |
| T-02-19 refresh storms and retry loops | One refresh cycle, one retry after it, at most 2 capped retries | resilience: three concurrent 401s, then one refresh; clamp to 2 |
| T-02-20 duplicate writes | Only keyed POSTs are retried, and the same key goes on every attempt | resilience: Idempotency-Key suite; transport: keyed upload retry |
| T-02-21 raw server errors shown | `HttpError` messages are the title or a default; no Response is ever thrown | HttpError: "never puts response text…"; transport: text/plain 502 |
| T-02-SC npm installs | No packages added. The license gate still fails on exactly the 5 D-BL-01 packages and nothing new. | `license.log` |

## Verification

- `npm --prefix web run verify`: exit 0. Typecheck, lint (0 warnings), Prettier, 540 tests across 18 files (430 before this plan + 110 new), coverage thresholds including `src/lib/http/**` at 100%, and the build.
- Folder coverage: `src/lib/http` has 227/227 statements, 131/131 branches, 57/57 functions and 223/223 lines.
- `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx`: 837/837 passed, 0 warnings. Nothing on the .NET side changed.
- Acceptance greps:
  - `credentials: 'same-origin'`: 1
  - `AbortSignal.any`: 1
  - `src/lib/http/**` in vitest.config.ts: 1
  - ignore comments in `web/src/lib/http`: 0 in every file
- Preflight before the full runs showed ports 5180, 5115, 7028 and 5199 free and no other project's test processes. Plan 06's E2E suite was not re-run, because the app shell is unchanged.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 08: TanStack Query must keep `retry: false` for queries and mutations, because this client owns retries.
- Plan 10:
  - `createApi(createHttpClient({ baseURL: '/api/v1' }))`. `client.get<T>(path, { signal })` accepts `signal: undefined` (exactOptionalPropertyTypes-safe).
  - Re-export `HttpError`, `isHttpError` and `type HttpErrorKind` from `./http/HttpError`.
  - `createFakeFetch` with `{ hang: true }` covers the abort test.
- Phase 4: wire `refresh` and `onUnauthorized`, and add the bearer token with a request interceptor. Interceptors run again on the refresh retry, so the new token applies. A login endpoint that legitimately returns 401 may need a per-request opt-out from refresh then; it is not needed yet.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

---
phase: 02-web-foundation-design-system
plan: 10
subsystem: api
tags: [http-client, fetch, xhr, abortsignal, retries, idempotency-key, problem-details, vitest, tdd]
created: "2026-10-08T12:20:00-05:00"
updated: "2026-10-08T12:20:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-04)
    provides: "the lib/http import fence (only src/lib/api.ts may import it; src/lib/http/** may use fetch/XMLHttpRequest), the fail-on-console guard, npm run verify"
provides:
  - "web/src/lib/http/httpClient.ts: createHttpClient({ baseURL, fetch, xhrFactory, headers, timeoutMs, retry, sleep, refresh, onUnauthorized }) -> request/get/post/put/patch/delete<T> + request/response interceptors"
  - "web/src/lib/http/HttpError.ts: HttpError (kind, status, problem, fieldErrors, traceId), isHttpError, parseProblemDetails, HttpErrorKind, FieldErrors, ProblemDetails"
  - "web/src/test/fakeFetch.ts: createFakeFetch (planned answers: status/headers/body, networkError, hang; records calls), createFakeXhrFactory (progress, load/error/hang, XhrClass for stubbing), createDeferred"
affects: [02-15, api.ts, every-later-web-plan-that-calls-the-api, WEB-08, WEB-09]

actuals:
  tokens: 21900    # chars/4 over the realized diff (87,584 chars, 7 files)
  tasks: 3
  commits: 6
plan_head_before: 2eda39116fea706cea33c0f5dbc5f5ce5be233df
plan_head_after: 8f956fd2c95d276997562dfdf5878f971f39075e

tech-stack:
  added: []
  patterns:
    - "Every failure leaves the client as an HttpError; the message is the ProblemDetails title or a fixed plain-English default, never response text"
    - "Transport faults are classified by which signal fired: the caller's signal -> aborted, the client's timer -> timeout, otherwise network"
    - "Idempotency-Key is set once from config.idempotencyKey before interceptors run, so every retry and the 401 replay resend the same key; the client never mints one"
    - "Tests inject fetch, the XHR factory and sleep; nothing in Vitest touches the network (Pitfall 14)"

key-files:
  created:
    - web/src/lib/http/httpClient.ts
    - web/src/lib/http/HttpError.ts
    - web/src/lib/http/httpClient.test.ts
    - web/src/lib/http/HttpError.test.ts
    - web/src/lib/http/httpClient.resilience.test.ts
    - web/src/lib/http/httpClient.transport.test.ts
    - web/src/test/fakeFetch.ts
  modified: []

key-decisions:
  - "The backoff sleep is a top-level createHttpClient option (as the plan's must-have lists it), and retry holds only max/baseDelayMs/maxDelayMs, each optional"
  - "'code' joins the rejected secret param names (token, access_token, refresh_token, password, secret, otp, code), compared case-insensitively; a later feature that needs a non-secret 'code' query param must rename it"
  - "Request interceptors run on every attempt, so a refreshed token reaches the retry; the secret-param check runs after them, so an interceptor cannot smuggle a secret into the URL"
  - "A 401 with no refresh function calls onUnauthorized directly; a second 401 after a successful refresh signs out once per refresh cycle"

patterns-established:
  - "Concurrency tests wait for in-flight requests with vi.waitFor before aborting or answering (L-25)"
  - "HTTP tests import fakes from src/test/fakeFetch.ts; api.ts tests (02-15) can reuse createFakeFetch through an injected client"

requirements-completed: [WEB-03, WEB-09]

coverage:
  - id: D1
    description: "A typed GET round trip and a ProblemDetails 404/400 travel through one client: baseURL join, params (arrays repeated, null/undefined skipped), same-origin credentials, Accept JSON, default/request headers, ordered request interceptors with eject, 204/205/empty -> undefined"
    requirement: WEB-03
    verification:
      - kind: unit
        ref: "web/src/lib/http/httpClient.test.ts (18 cases)"
        status: pass
      - kind: unit
        ref: "web/src/lib/http/HttpError.test.ts (23 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Caller abort -> aborted, timeout -> timeout, neither retried; at most 2 retries (250/500 ms, cap 2 s) only for GET/HEAD/PUT/DELETE/OPTIONS and a keyed POST, only on network error or 503; secret params rejected before sending"
    requirement: WEB-03
    verification:
      - kind: unit
        ref: "web/src/lib/http/httpClient.resilience.test.ts#timeout and abort / capped retries / secrets never go in a URL"
        status: pass
    human_judgment: false
  - id: D3
    description: "One Idempotency-Key per submission from the caller, identical on every retry and on the 401 refresh replay, never on GET/HEAD/OPTIONS, never created by the client; two calls send two requests"
    requirement: WEB-09
    verification:
      - kind: unit
        ref: "web/src/lib/http/httpClient.resilience.test.ts#Idempotency-Key (WEB-09) (13 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Three concurrent 401s share exactly one refresh and each retries once; a failed refresh rejects every waiter with a 401 HttpError and calls onUnauthorized once"
    requirement: WEB-03
    verification:
      - kind: unit
        ref: "web/src/lib/http/httpClient.resilience.test.ts#single-flight 401 refresh (11 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "JSON bodies, FormData passthrough, kind parse for malformed JSON, XHR upload transport only with onUploadProgress (progress, abort, timeout, same HttpError shapes), response interceptors; lib/http at 100% in every column"
    requirement: WEB-03
    verification:
      - kind: unit
        ref: "web/src/lib/http/httpClient.transport.test.ts (23 cases)"
        status: pass
      - kind: other
        ref: "npm --prefix web run test -- --run src/lib/http --coverage --coverage.include=src/lib/http/** (100% statements 227/227, branches 131/131, functions 57/57, lines 223/223)"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (exit 0; 844 tests)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 10: fetch-based HTTP Client (WEB-03, WEB-09) Summary

**`createHttpClient` is the project's only HTTP transport. It runs over an injected `fetch` with same-origin credentials, request and response interceptors, a combined abort and timeout signal, at most 2 capped retries for idempotent or keyed calls, a single-flight 401 refresh that resends the caller's own Idempotency-Key, and an XHR path used only for upload progress. Every failure is a plain-English `HttpError` carrying the ProblemDetails status, field errors and traceId. All 120 tests pass and `src/lib/http/**` is at 100% coverage.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-08T17:11:03Z
- **Completed:** 2026-10-08T17:19:34Z
- **Tasks:** 3
- **Files modified:** 7 (all created)

## Accomplishments

- **One client instance for a typed GET and a ProblemDetails failure.** `get<T>('/site-settings')` with baseURL `/api/v1` calls fetch once with `/api/v1/site-settings`, `credentials: 'same-origin'` and `Accept: application/json`. A 404 `problem+json` rejects with `HttpError{ kind: 'http', status: 404, traceId }`, and a 400 with `errors` fills `fieldErrors`.
- **Cancellation and timeouts.** The caller's signal and the timer combine through `AbortSignal.any`. Cancelling gives `aborted`, the timer gives `timeout` (30 s by default, overridable per request), and neither is retried. The timer is cleared on every outcome.
- **Capped retries.** There are at most 2 retries, waiting 250 ms then 500 ms (capped at 2 s, no jitter) through the injected `sleep`. They happen only after a network error or a 503, and only for GET, HEAD, PUT, DELETE, OPTIONS or a POST that carries an `idempotencyKey`. PATCH, an unkeyed POST and a 500 are never retried. Cancelling during the backoff stops the request.
- **Idempotency-Key (WEB-09).** The header comes only from `config.idempotencyKey`. It is identical on every retry and on the post-refresh replay, never sent on GET, HEAD or OPTIONS, and never created by the client. Calling the same POST twice sends two requests.
- **Single-flight refresh.** Three concurrent 401s cause exactly one `refresh()` call, then each request retries once with the refreshed token. If the refresh fails, every waiting request rejects with a 401 `HttpError` and `onUnauthorized` runs once. A refresh that throws synchronously counts as a failed refresh.
- **No secrets in URLs (CWE-598).** Params named `token`, `access_token`, `refresh_token`, `password`, `secret`, `otp` or `code` (any case) are rejected with a `TypeError` before anything is sent. This includes params added by an interceptor.
- **Bodies and parsing.** JSON bodies get `Content-Type: application/json` unless the caller set one. FormData passes through with no content type. A malformed JSON 2xx gives kind `parse`. A non-JSON error body never reaches the message.
- **XHR upload transport.** It is used only when `onUploadProgress` is given. It reports `loaded`/`total` (`total` is undefined when unknown), honours abort and timeout, and produces the same `HttpError` shapes and key reuse as fetch.
- **Coverage.** `src/lib/http/**` is at 100% for statements (227), branches (131), functions (57) and lines (223), with no ignore comments. The Vitest per-folder threshold enforces it.

## Task Commits

1. **Task 1: Tracer, a typed GET round trip and a ProblemDetails 404 through one client instance**
   - RED `d842768` (test): fakeFetch.ts, httpClient.test.ts, HttpError.test.ts, inert placeholders with the final types. 35 assertion failures; `RED_EVIDENCE_OK` for both test files.
   - GREEN `a23fd4a` (feat): HttpError, parseProblemDetails, and the client core.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran the verify command after the commit and all 41 tests passed. Tracer verified end-to-end, so I expanded.
2. **Task 2: Timeout and abort, capped retries, single-flight 401 refresh and Idempotency-Key reuse**
   - RED `5b2ba8e` (test): 56 resilience cases, 46 failing against the Task 1 client (`RED_EVIDENCE_OK`).
   - GREEN `758212c` (feat): the combined signals, the retry policy, the refresh cycle, the key header and the secret-param guard.
3. **Task 3: JSON/FormData bodies, XHR upload progress, parse failures and the 100% coverage gate**
   - RED `e04f3f5` (test): 23 transport cases, 15 failing against the Task 2 client (`RED_EVIDENCE_OK`).
   - GREEN `8f956fd` (feat): the full client, with FormData, kind parse, the XHR transport, response interceptors and documented types.

**Plan metadata:** recorded in the docs commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/lib/http/httpClient.ts`: the client. Exports `createHttpClient`, `HttpClient`, `HttpClientConfig`, `RequestConfig`, `RequestOptions`, `HttpRequest`, `HttpResponse`, `HttpMethod`, `UploadProgress`, `Params`, `ParamValue`, `RetryPolicy`, `Sleep`, `FetchFunction`, `XhrFactory` and the interceptor types.
- `web/src/lib/http/HttpError.ts`: `HttpError`, `isHttpError`, `parseProblemDetails`, `HttpErrorKind`, `FieldErrors`, `ProblemDetails`, `HttpErrorInit`.
- `web/src/lib/http/httpClient.test.ts`: the round trip, params, headers, methods, empty bodies, ProblemDetails errors and request interceptors (18 cases).
- `web/src/lib/http/HttpError.test.ts`: the error shape, messages and ProblemDetails parsing (23 cases).
- `web/src/lib/http/httpClient.resilience.test.ts`: timeout/abort, retries, Idempotency-Key, secret params and refresh (56 cases).
- `web/src/lib/http/httpClient.transport.test.ts`: bodies, parse failures, the XHR transport and response interceptors (23 cases).
- `web/src/test/fakeFetch.ts`: the fake fetch, the fake XHR factory and `createDeferred`.

## Decisions Made

- `sleep` is a top-level client option, as the plan's must-have lists it. `retry` holds only optional `max`, `baseDelayMs` and `maxDelayMs`. The reference at `74621f5` had `retry.sleep`, and the tests were adapted.
- `code` was added to the secret param names, which the reference lacked. The check ignores case.
- Response `onRejected` interceptors see only `HttpError`s. A programming error, such as the secret-param `TypeError`, skips them and rejects as itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The vitest.config.ts threshold already existed**
- **Found during:** Task 3
- **Issue:** The plan's Task 3 adds the `'src/lib/http/**': 100` threshold, but `web/vitest.config.ts` already had it from an earlier plan. The global 90 was kept as well.
- **Fix:** No edit was needed. `grep -c "src/lib/http/\*\*" web/vitest.config.ts` = 1, and the threshold now applies to real files and passes at 100%.
- **Files modified:** none
- **Committed in:** n/a

**2. [Rule 2 - Missing critical] Secret-param list and key-header coverage widened**
- **Found during:** Task 2 (RED)
- **Issue:** The reference implementation left out `code`, and its tests did not prove that HEAD and OPTIONS carry no key, that PUT, PATCH and DELETE pass the caller's key unchanged, or that a keyed POST keeps its key across a 401 refresh followed by a 503 retry.
- **Fix:** Added `code` (and `CODE`) cases, HEAD and OPTIONS no-key cases, the per-method key cases, and a 401 → 503 → 200 keyed-POST case that checks the same key on all three attempts.
- **Files modified:** `web/src/lib/http/httpClient.resilience.test.ts`, `web/src/lib/http/httpClient.ts`
- **Committed in:** `5b2ba8e`, `758212c`

---

**Total deviations:** 2 (1 Rule 3 no-op, 1 Rule 2)
**Impact on plan:** Every must-have truth is proven. No scope creep, and no package changed.

## Issues Encountered

- A stale `.git/gsd-plan-head-before-02-10` ledger from the superseded run pointed at `78a2397`. I reset it to this plan's real base `2eda391` before the first commit, so `commits: 6` is measured against the right base.
- The first inert placeholder held a NUL character in a string literal, a side effect of shell quoting. I replaced it before the RED commit.

## Notes for Later Plans

- **02-15 (api.ts):** construct one client with `createHttpClient({ baseURL: '/api/v1', refresh, onUnauthorized })`. Pass `idempotencyKey` on every POST (one per submission, WEB-09); the client never creates one. Set TanStack Query `retry: false` (Pitfall 16), because the client owns retries. If `src/lib/api.test.ts` imports from `@/lib/http`, add it to the `csps/restrictions/api` override's `files` (02-04 note). Tests can inject `createFakeFetch(...).fetch`.
- **Secret params:** a query param named `code` (for example an order code) is rejected. Name it something else, such as `orderCode`.
- **Errors:** show `error.message` (plain English) and `error.traceId` for 5xx. Map `error.fieldErrors` keys (server PascalCase, for example `Amount`) to form fields.

## TDD Gate Compliance

- Task 1: RED `d842768` comes before GREEN `a23fd4a`. `RED_EVIDENCE_OK` for `src/lib/http/httpClient.test.ts` and `src/lib/http/HttpError.test.ts`.
- Task 2: RED `5b2ba8e` comes before GREEN `758212c`. `RED_EVIDENCE_OK` for `src/lib/http/httpClient.resilience.test.ts`.
- Task 3: RED `e04f3f5` comes before GREEN `8f956fd`. `RED_EVIDENCE_OK` for `src/lib/http/httpClient.transport.test.ts`.
- No refactor commits were needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved. `package.json` and `package-lock.json` are unchanged, MSW is still deferred (D-25) and axios is not used.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- The transport is ready for `api.ts` (02-15). `npm --prefix web run verify` is green at `8f956fd`: typecheck, lint and format are clean, 844 tests pass, and the build succeeds.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 7 created files exist on disk.
- Commits `d842768`, `a23fd4a`, `5b2ba8e`, `758212c`, `e04f3f5` and `8f956fd` are on `gsd/phase-2-web-foundation-design-system`.
- Acceptance criteria re-run: `same-origin` = 1, `from 'axios'` = 0, `src/lib/http/**` in vitest.config.ts = 1, the concurrency test asserts `refresh` was called once, the key-reuse tests assert the same header on every attempt including the post-refresh replay, the lib/http coverage run is 100% in every column, and `verify` exits 0.

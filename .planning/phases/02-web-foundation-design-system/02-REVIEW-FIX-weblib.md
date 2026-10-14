---
phase: 02-web-foundation-design-system
lane: weblib
created: 2026-10-13T06:59:00-05:00
updated: 2026-10-13T06:59:00-05:00
fixed_at: 2026-10-13T06:59:00-05:00
review_path: .planning/phases/02-web-foundation-design-system/02-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report (lane: weblib)

**Fixed at:** 2026-10-13T06:59:00-05:00
**Source review:** .planning/phases/02-web-foundation-design-system/02-REVIEW.md (lane detail: 02-REVIEW-lane-weblib.md)
**Iteration:** 1
**Scope:** LIB-CR-* and LIB-WR-* only. The other lanes' findings and all LIB-IN-* findings were not touched.

**Summary:**

- Findings in scope: 10
- Fixed: 10. One of them (LIB-WR-03) is fixed in part; its second part is deferred, see below.
- Skipped: 0

**How the fixes were made:** every behaviour fix was test-first. A failing test was added or extended, the RED run was seen, then the fix went in. Each finding has one commit, on the main tree (branch `gsd/phase-2-web-foundation-design-system`, no worktree, per the orchestrator). The root-pin guard ran before every commit.

**Verification:** run in the **main checkout** (`C:/Work/CarmensStitchAndPrintingServices`), after the shared-machine preflight showed all ports free and no other project's processes. `npm --prefix web run verify` exited 0:

- 103 test files and 2786 tests passed (the baseline for the touched files was 328 tests in 10 files).
- Coverage thresholds held: `src/lib/http/**` at 100%, and `src/lib/forms` is now 100%.
- Typecheck, lint, format, build, `build:budget`, the license gate and `notices:check` all passed.
- The production public JS budget is 130.10 KB of 150 (it was 129.94). The dev-route (budget) build is 149.69 KB of 150 (it was 149.47), so it now has **0.31 KB headroom**. Later plans should know this.

**Public API:** `useSubmission` keeps its signature. It gains one optional option, `identity`. `RequestConfig` and `RequestOptions` gain one optional field, `skipAuthRefresh`. Nothing in `src/` calls `useSubmission` yet, so no caller had to change. The changed contract is documented in the hook header and in `docs/web/api.md`.

## Fixed Issues

### LIB-CR-01: A double-click that straddles a fast success creates a duplicate record

**Files modified:** `web/src/lib/forms/useSubmission.ts`, `web/src/lib/forms/useSubmission.test.tsx`, `docs/web/api.md`
**Commit:** 64afff6
**Status:** fixed: requires human verification (a contract change in the submission logic)
**Applied fix:**

- **Design: lock after success.** The hook keeps the last settled submission as `{ key, serialized, success }`. When a trigger arrives with the same data after a success, nothing is sent. `submit` resolves with the *same* success outcome object, and `onSuccess` does not run again (the same rule as joining an in-flight submission). So a second click that lands after a fast response cannot create a second order, payment or expense, and this does not depend on the server's SEC-06 store.
- **What starts a new submission:** changed data or `reset()` gets a new key. The docs tell screens to call `reset()` when the form is ready for a new entry, not inside `onSuccess`, because that would remove the protection.
- **Tests:**
  - The old test "new key after a success, even with the same data" pinned the bug, so it was replaced by "sends nothing for a second Save with the same data after a fast success" (RED: the send ran 2 times).
  - A new test checks that changed data and `reset()` each get a new key.

### LIB-CR-02: FormData, File, Blob, Map and Set payloads compare equal, so a key is reused for a different body

**Files modified:** `web/src/lib/forms/useSubmission.ts`, `web/src/lib/forms/useSubmission.test.tsx`, `web/src/lib/http/httpClient.ts`, `web/src/lib/http/httpClient.transport.test.ts`, `web/src/lib/http/httpClient.resilience.test.ts`, `docs/web/api.md`, `.planning/phases/02-web-foundation-design-system/deferred-items.md`
**Commits:** b179442, plus 8f5cfe2 (a coverage test only)
**Status:** fixed: requires human verification
**Applied fix:**

- **Hook: plain JSON only.** The hook compares only data that is plain JSON: plain objects (including null-prototype objects), arrays, strings, finite numbers, booleans, null, and undefined members.
  - Everything else is never "the same submission", so every submit of it gets a new key: FormData, File, Blob, Map, Set, Date, class instances, symbols (as values or keys), BigInts, NaN or Infinity, and cycles.
  - A getter that throws or an `identity` option that throws also counts as "cannot compare".
  - Data that cannot be compared is never locked after a success.
- **Hook: new optional `identity` option.** A screen sets `identity: (data) => string` for data that is not plain JSON. For an upload, that is the file's name, size and `lastModified` plus the form's other fields. With it, the screen gets back retry key reuse and the CR-01 double-click lock. A key is no longer shared by identity of reference, because a FormData object changed in place would then reuse its key for a different body.
- **Client: no auto-retry of a keyed FormData body.** `canRetry` never retries a request that carries an Idempotency-Key and has a `FormData` body: the browser picks a new multipart boundary on every send, so the retry is not the same body byte for byte. An unkeyed FormData PUT and a keyed JSON body sent over XHR still retry.
  - The old test "a keyed POST upload is retried after a network error with the same key" pinned the bug and was replaced.
- **Server side, recorded in deferred-items.md under "Deferred Items" for the Phase 4 SEC-06 plan.** SEC-06 must hash a multipart request from its parsed parts, not its raw bytes. Otherwise the first user retry of an upload that passes `identity` gets a 422.
- **Tests:**
  - RED: 13 hook cases failed (FormData, File, Blob, Map, Set, Date, File inside an object, Blob inside an array, NaN, a symbol, the identity cases, and "no repeat on success").
  - RED: 2 client cases failed.

### LIB-WR-01: The key is reused after definitive 4xx rejections

**Files modified:** `web/src/lib/forms/useSubmission.ts`, `web/src/lib/forms/useSubmission.test.tsx`
**Commit:** 4c31ff0
**Status:** fixed: requires human verification (please confirm the list of ambiguous statuses)
**Applied fix:** a new `mayHaveRun(error)` keeps the key for a same-data retry only when the server may have saved the first attempt:

- anything that is not an HttpError,
- kind `network`, `timeout`, `aborted` or `parse` (an unreadable 2xx),
- or an `http` status of 5xx, 408 or 409 (SEC-06 "still running").

A final 400 (with or without field errors), 401, 403, 404, 422 or 429 clears the key, so the next submit is a new submission. This also unsticks the 422 loop from CR-02.

Tests: 9 "reuse" cases and 7 "new key" cases. RED: all 7 "new key" cases failed.

### LIB-WR-02: A 400 with field errors gives no feedback when no rendered field matches

**Files modified:** `web/src/lib/forms/useSubmission.ts`, `web/src/lib/forms/useSubmission.test.tsx`
**Commit:** 80ff9c6
**Status:** fixed
**Applied fix:**

- `onFailure` now runs for every failure that has copy. For a 400 with field errors, that copy is the UI-SPEC banner "Check the highlighted fields." (`describeHttpError` already returned it). The option's docs tell screens to show it as the form banner, never to drop it, and that it is the only feedback when `focusFirstInvalid` returns false.
- A 401 and a cancelled request still call nothing, as the UI-SPEC says.
- No visible change today, because nothing calls the hook yet, and the copy is the spec's own.
- RED: 1 case.

### LIB-WR-03: Every 401 is silent, and there is no per-request opt-out

**Files modified:** `web/src/lib/http/httpClient.ts`, `web/src/lib/http/httpClient.resilience.test.ts`, `docs/web/api.md`, `.planning/phases/02-web-foundation-design-system/deferred-items.md`
**Commit:** 9205eea
**Status:** fixed in part (the request opt-out); the 401 copy is deferred
**Applied fix:**

- **Part 1, done.** A new `RequestConfig.skipAuthRefresh`. A 401 on such a request rejects untouched: no refresh, no retry and no `onUnauthorized`, whether or not the client has a `refresh`. This is for sign-in, 2FA verify and the refresh call itself. RED: 2 cases.
- **Part 2, not applied.** This is the "Your session ended. Sign in again." copy for a 401. The UI-SPEC rules "401 after the failed refresh: no toast (redirect to sign-in from Phase 4)", and new user-facing words need the owner. The current behaviour was kept.
  - It is recorded in deferred-items.md under "Deferred Items" for the Phase 4 sign-in plan: wire `refresh` (with `skipAuthRefresh`) and `onUnauthorized` in `api.ts`, and give the sign-in and 2FA forms their own approved wrong-password copy.
  - The owner is asked only if a 401 can still reach a screen unhandled after that.

### LIB-WR-04: The refresh single flight deadlocks if `refresh` uses the same client, and a stale 401 starts a second refresh

**Files modified:** `web/src/lib/http/httpClient.ts`, `web/src/lib/http/httpClient.resilience.test.ts`, `docs/web/api.md`
**Commit:** 8306748
**Status:** fixed: requires human verification (a change in the concurrency logic)
**Applied fix:**

- **Stale 401.** Each request notes `lastRefreshed`, the last cycle that succeeded, when it is sent. If a refresh has succeeded since then, the request's 401 is stale: it retries once with the new session and starts no second refresh. If that retry gets a 401 again, it signs out through that finished cycle's single notification.
- **Deadlock.** The deadlock cannot be detected automatically, because a request made inside `refresh` looks like any other request. So:
  - the `refresh` docs (and `docs/web/api.md`) now require its own request to pass `skipAuthRefresh: true`;
  - a regression test proves that this path ends the session instead of hanging.
- RED: 2 cases (a second refresh was made, and the sign-out ran twice).

### LIB-WR-05: Non-JSON or empty 2xx bodies resolve as the typed DTO

**Files modified:** `web/src/lib/http/httpClient.ts`, `web/src/lib/http/HttpError.ts` (doc only), `web/src/lib/http/httpClient.test.ts`, `web/src/lib/http/httpClient.transport.test.ts`, `web/src/test/fakeFetch.ts`, `docs/web/api.md`
**Commit:** 64bda88
**Status:** fixed: requires human verification (a contract change: an empty 2xx body is now accepted only from 204, 205 or HEAD)
**Applied fix:**

- `toHttpResponse` resolves `undefined` only for 204, 205 or a HEAD.
- It rejects with an HttpError of kind `parse` (keeping the status) for:
  - any other empty 2xx,
  - any 2xx that is not JSON (a captive portal or a host page),
  - any 2xx reached through a redirect. For fetch this is `Response.redirected`. For XHR it is `responseURL` differing from the resolved request URL.
- `docs/web/api.md` now says that an endpoint with no body answers 204 and is typed `Promise<void>`.
- The test doubles gained `redirected` (fetch) and `responseURL` (XHR) plan fields. The old test "an empty 200 is undefined and a text 200 is its text" pinned the bug and was replaced. The XHR header-parsing test now answers with JSON.
- RED: 8 cases.

### LIB-WR-06: `normalizePastedMoney` strips commas anywhere, so "1,50" becomes ₱150.00

**Files modified:** `web/src/lib/format.ts`, `web/src/lib/format.test.ts`
**Commit:** afff7c2
**Status:** fixed
**Applied fix:**

- Only surrounding whitespace is trimmed now.
- Grouping is removed only when the whole text is valid thousands grouping: 1 to 3 digits, then groups of exactly 3 after one consistent separator, then an optional fraction. The separator can be a comma, a space, a no-break space, a narrow no-break space or a thin space.
- Anything else is refused with `''`, so MoneyInput rejects the paste. That covers "1,50", "12,5", "1,2,3", "12 50", "1,2500", ",250", "1,250,", mixed separators, and a tab or newline inside the number.
- The existing accepted pastes still work: " 12,450.00 ", "1 250.50", "\t5000\n".
- RED: 12 cases.

### LIB-WR-07: `csps.formatDate` reads the machine's time zone for timestamps

**Files modified:** `web/src/lib/csps.ts`, `web/src/lib/csps.test.ts`
**Commit:** 89902e2
**Status:** fixed
**Applied fix:**

- `formatDate` is now a thin wrapper over `@/lib/format`:
  - a `YYYY-MM-DD` date goes to `formatCalendarDate`;
  - an instant with a zone, or a Date, goes to `formatBusinessDate` (Asia/Manila);
  - empty, a date-time with no zone, unparseable text and an Invalid Date give "—".
- It is marked as a SPEC-DEVIATION from App. D.1. The App. D.2 verbatim tests still pass. The D.1 characterization test was updated: D.1 read the machine's zone and echoed unparseable text.
- A new test runs it under 3 machine zones.
- No caller exists in `src/`.
- RED: 3 cases.

### LIB-WR-08: The CWE-598 secret-parameter guard can be bypassed through the URL string

**Files modified:** `web/src/lib/http/httpClient.ts`, `web/src/lib/http/httpClient.resilience.test.ts`, `docs/web/api.md`
**Commit:** d90885b
**Status:** fixed
**Applied fix:**

- `assertNoSecretParams` now runs on the built URL. It checks the `params` keys (still including keys whose value is skipped) and every name in the final query, read through `URL.searchParams`, so the names are decoded and compared case-insensitively.
- This covers a query written into the path (`/auth/confirm?token=…`, `%74oken`, `Code`) and one added by a request interceptor.
- Values and fragments are not names, so they stay allowed.
- RED: 4 cases.

## Owner decisions

None of these fixes needed an owner ruling. No approved look, copy or ARIA changed. The only open wording question is LIB-WR-03 part 2, a possible 401 message. It is parked for Phase 4 in deferred-items.md under "Deferred Items", not under "Owner decisions pending", because the UI-SPEC already rules that a 401 shows no message.

## Notes for later work

- **Budget:** the dev-route budget build now has 0.31 KB headroom (149.69 of 150 KB). The orchestrator-approved remedy from 02-33 still applies if a later change pushes it over.
- **Phase 4:**
  - Pass `refresh`, with its request sent as `skipAuthRefresh: true`, and pass `onUnauthorized`.
  - Mark sign-in and 2FA verify `skipAuthRefresh`.
  - Build SEC-06 with a boundary-independent multipart hash.
  - Every no-body endpoint answers 204.
- **Screens that use `useSubmission`:**
  - Render the `onFailure` copy as the banner for a 400 with field errors.
  - Call `reset()` only when the form is ready for a new entry.
  - Upload screens pass `identity`.

---

_Fixed: 2026-10-13T06:59:00-05:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

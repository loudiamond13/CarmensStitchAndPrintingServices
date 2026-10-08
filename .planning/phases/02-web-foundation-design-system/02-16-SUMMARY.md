---
phase: 02-web-foundation-design-system
plan: 16
subsystem: web-forms
tags: [idempotency-key, useSubmission, forms, error-copy, focus-management, react, vitest, tdd]
created: "2026-10-08T14:59:00-05:00"
updated: "2026-10-08T14:59:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-10)
    provides: "HttpError (kind, status, fieldErrors, traceId), createDeferred in web/src/test/fakeFetch.ts"
  - phase: 02-web-foundation-design-system (plan 02-15)
    provides: "web/src/lib/api.ts re-exports HttpError/isHttpError; POST functions will take { idempotencyKey }"
provides:
  - "web/src/lib/forms/idempotencyKey.ts: newIdempotencyKey() (crypto.randomUUID, else a v4 UUID from getRandomValues; never Math.random)"
  - "web/src/lib/forms/useSubmission.ts: useSubmission(send, options) -> SubmissionState { submit, pending, error, fieldErrors, reset }; also exports SubmissionOptions, SubmissionOutcome, SubmitArgs, FieldErrors"
  - "web/src/lib/forms/focusFirstInvalid.ts: focusFirstInvalid(root) -> boolean"
  - "web/src/lib/errors/describeHttpError.ts: describeHttpError(error) -> ErrorCopy | null; ErrorCopy { title, body }"
affects: [02-17, 02-23, 02-24, phase-4-auth, every-feature-form]

actuals:
  tokens: 9900    # chars/4 over the realized diff (39,661 chars, 8 files)
  tasks: 2
  commits: 4
plan_head_before: 2e4f25ff8132787c7111940e6900b81c07a36f19
plan_head_after: 2b1886a0ef751585a6466dd090e668b84ec849bd

tech-stack:
  added: []
  patterns:
    - "Form submission: useSubmission((key, data) => api.x.create(data, { idempotencyKey: key }), { onSuccess, onFailure })"
    - "Retry identity: the last failed submission's data JSON plus its key in a ref; NO_DATA sentinel for submit() without data; uncomparable data (function, BigInt, cycle) always gets a new key"
    - "Callbacks run after the state settles; submit never rejects (resolves with { ok, value } or { ok: false, error })"

key-files:
  created:
    - web/src/lib/forms/idempotencyKey.ts
    - web/src/lib/forms/idempotencyKey.test.ts
    - web/src/lib/forms/useSubmission.ts
    - web/src/lib/forms/useSubmission.test.tsx
    - web/src/lib/forms/focusFirstInvalid.ts
    - web/src/lib/forms/focusFirstInvalid.test.tsx
    - web/src/lib/errors/describeHttpError.ts
    - web/src/lib/errors/describeHttpError.test.ts
  modified: []

key-decisions:
  - "useSubmission follows the plan signature send(key, data) with no AbortSignal: an in-flight write is not aborted on unmount"
  - "submit takes (...args: SubmitArgs<TData>) so a no-data submission is submit() without a void type argument (ESLint no-invalid-void-type)"
  - "onFailure(copy, error) runs only for a failure without field errors whose describeHttpError copy is not null; a 400 with field errors fills fieldErrors instead, and a 401 or a cancelled request calls nothing"
  - "fieldErrors come only from a 400 HttpError with a non-empty errors member; keys keep server casing (Amount)"
  - "describeHttpError ends the second line with 'Reference: {traceId}' for every HttpError copy that has a traceId (UI-SPEC ErrorState row), not only the 5xx copy; the 400 field-errors banner keeps an empty body"
  - "describeHttpError returns null for kind 'aborted' as well as a 401; parse failures, unmapped 4xx and non-HttpError values get the 5xx copy"

patterns-established:
  - "Form wiring: Button loading={pending}; on failure with fieldErrors render messages under fields with aria-invalid, then focusFirstInvalid(formElement); otherwise onFailure shows a persistent danger toast (D-04) from the copy"
  - "Hook tests use a real form harness with user-event on real timers and vi.waitFor for the pending state; deferred sends resolve inside act()"

requirements-completed: [WEB-09, WEB-04]

coverage:
  - id: D1
    description: "newIdempotencyKey returns an RFC 4122 v4 UUID from crypto.randomUUID, or from getRandomValues with version/variant bits set when randomUUID is missing; Math.random is never called on either path"
    requirement: WEB-09
    verification:
      - kind: unit
        ref: "web/src/lib/forms/idempotencyKey.test.ts (5 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A double-clicked Save or a second Enter sends exactly one request; a trigger while pending (even with changed data) gets the same outcome; pending is true until settle"
    requirement: WEB-09
    verification:
      - kind: unit
        ref: "web/src/lib/forms/useSubmission.test.tsx#useSubmission: one request in flight (WEB-09 concurrency) (3 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A failed submission retried with the same data (including submit() with no data) reuses its key; success, reset() or changed data gets a new key; uncomparable data never reuses a key"
    requirement: WEB-09
    verification:
      - kind: unit
        ref: "web/src/lib/forms/useSubmission.test.tsx#useSubmission: key per submission (WEB-09 idempotency) (7 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A 400 with errors.Amount fills fieldErrors.Amount; failures without field errors call onFailure with the describeHttpError copy; 400 field errors and 401 do not call onFailure; a synchronous throw in send never leaves the form stuck"
    requirement: WEB-09
    verification:
      - kind: unit
        ref: "web/src/lib/forms/useSubmission.test.tsx#useSubmission: results and errors (11 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "describeHttpError gives the exact Copywriting Contract strings for network/timeout, 400 with field errors, 403, 404, 409, 429 and any 5xx (with Reference: {traceId}), null for 401 and aborted, and never shows server text"
    requirement: WEB-04
    verification:
      - kind: unit
        ref: "web/src/lib/errors/describeHttpError.test.ts (24 cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "focusFirstInvalid focuses the first aria-invalid control in DOM order inside the root and returns false (focus kept) when none is invalid"
    requirement: WEB-09
    verification:
      - kind: unit
        ref: "web/src/lib/forms/focusFirstInvalid.test.tsx (3 cases)"
        status: pass
      - kind: other
        ref: "npm --prefix web run test -- --run src/lib/errors src/lib/forms --coverage (100% statements/branches/functions/lines); npm --prefix web run verify (exit 0; 50 files, 1329 tests)"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 16: Submission Discipline and Shared Error Copy Summary

**Forms now have one submission path. `useSubmission` sends one request per click with a crypto-random v4 Idempotency-Key, reuses that key when the same failed data is retried, and exposes pending, error and 400 field errors. One `describeHttpError` mapper turns every failure into the approved plain-English copy, and `focusFirstInvalid` takes the user to the first bad field.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-08T19:48:01Z
- **Completed:** 2026-10-08T19:59:00Z
- **Tasks:** 2 (TDD: 2 RED and 2 GREEN commits, no refactor needed)
- **Files created:** 8

## Accomplishments

- **Idempotency key (WEB-09, T-02-45).** `newIdempotencyKey()` uses `crypto.randomUUID()`. Where that is missing (a plain-HTTP LAN address, Pitfall 15), it builds a v4 UUID from `crypto.getRandomValues` and sets the version and variant bits. A spy proves `Math.random` is never called on either path.
- **useSubmission (WEB-09, T-02-43).** `useSubmission(send, { onSuccess, onFailure })` returns `{ submit, pending, error, fieldErrors, reset }`:
  - While a submission is pending, every further trigger gets the same in-flight promise, so a double-click or a second Enter sends one request.
  - A failed submission resubmitted with JSON-equal data keeps its key. `submit()` with no data uses a fixed sentinel (L-25).
  - A success, `reset()` or changed data starts a new key. Data JSON cannot compare (a function or a BigInt) always gets a new key.
  - `submit` never rejects.
- **describeHttpError (WEB-04 copy half, T-02-44).** It covers every Copywriting Contract row, word for word. Every HttpError copy with a traceId ends with "Reference: {traceId}". It returns `null` for a 401 and for a cancelled request, and server text never reaches the copy.
- **focusFirstInvalid.** It focuses the first `aria-invalid="true"` control in DOM order inside the root. When nothing is invalid it returns `false` and leaves focus where it was.
- **Coverage and gate.** Both `src/lib/forms` and `src/lib/errors` are at 100% statements, branches, functions and lines. `npm --prefix web run verify` exits 0 with 50 files and 1329 tests.

## Task Commits

1. **Task 1 (tracer): a double-clicked save sends one request, and a retry after failure reuses its key**
   - RED `120653d` (test): 23 of 23 cases failed on assertions against inert placeholders. Both records returned `RED_EVIDENCE_OK`, with targets `src/lib/forms/useSubmission.test.tsx` and `src/lib/forms/idempotencyKey.test.ts`.
   - GREEN `10f1600` (feat): 23 of 23 pass. The tracer gate re-ran `npm --prefix web run test -- --run src/lib/forms` and it passed (end-of-phase mode, automated-only verify), so expansion continued.
2. **Task 2: shared HttpError copy mapper and focus on the first invalid field**
   - RED `e6b9ee6` (test): 29 cases failed on assertions: describeHttpError 23 of 24, focusFirstInvalid 2 of 3, and the 4 new useSubmission onFailure cases. All three records returned `RED_EVIDENCE_OK`.
   - GREEN `2b1886a` (feat): 53 of 53 pass, both folders are at 100% branch coverage, and `verify` exits 0.

**Plan metadata:** see the docs(02-16) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/lib/forms/idempotencyKey.ts`: the v4 UUID factory with the secure fallback.
- `web/src/lib/forms/useSubmission.ts`: single-flight submit, key reuse, pending/error/fieldErrors state and the callbacks.
- `web/src/lib/forms/focusFirstInvalid.ts`: focus on the first invalid control.
- `web/src/lib/errors/describeHttpError.ts`: HttpError to `ErrorCopy`, the only place the copy strings live.
- Their four test files, with 5, 21, 3 and 24 cases.

## Decisions Made

- **No AbortSignal in `send`.** The plan's signature is `send(key, data)`. An in-flight write is not aborted on unmount, because the server may still process it.
- **No-data submit.** `submit(...args: SubmitArgs<TData>)` makes the data optional when `TData` admits `undefined`. A confirm button calls `submit()` without a `void` type argument, which ESLint `no-invalid-void-type` rejects.
- **onFailure contract.** `onFailure(copy, error)` runs only for a failure without field errors whose copy is not null. A 400 with field errors fills `fieldErrors` instead, and the caller renders the messages and calls `focusFirstInvalid(form)`. A 401 or a cancelled request calls nothing.
- **Reference line.** Any HttpError copy with a traceId gets "Reference: {traceId}" at the end of its second line. This follows the UI-SPEC ErrorState row; the 74621f5 reference added it to the 5xx copy only. The field-errors banner keeps an empty body.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A synchronous throw in `send` would have left the form stuck "pending" forever**
- **Found during:** Task 1 (GREEN)
- **Issue:** In an async `run`, a `send` that throws before it returns a promise settles synchronously. The settle code cleared the in-flight ref before `submit` stored it, so every later submit would have returned a settled promise and never sent again.
- **Fix:** An `attempt()` helper turns the result, a rejection or a synchronous throw into an outcome promise. `run` awaits it, so settling is always asynchronous and always happens after the in-flight promise is stored.
- **Files modified:** web/src/lib/forms/useSubmission.ts, web/src/lib/forms/useSubmission.test.tsx (the sync-throw case now also submits again and checks that send ran twice with the same key)
- **Verification:** the useSubmission tests pass.
- **Committed in:** 10f1600

**2. [Rule 3 - Blocking] Task 2 also edited useSubmission.ts and its test, which are not in Task 2's file list**
- **Found during:** Task 2
- **Issue:** The must-have says `onFailure` receives the describeHttpError copy, but describeHttpError only exists from Task 2.
- **Fix:** Task 1 shipped `onFailure(error)`. Task 2's RED added 4 cases for `onFailure(copy, error)` and for skipping it on field errors and on a 401, and its GREEN wired describeHttpError into the hook.
- **Files modified:** web/src/lib/forms/useSubmission.ts, web/src/lib/forms/useSubmission.test.tsx
- **Committed in:** e6b9ee6 (RED), 2b1886a (GREEN)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking/sequencing).
**Impact on plan:** Both were needed for correctness and to meet the must-haves. There was no scope creep and no package change.

## TDD Gate Compliance

Each task has a `test(02-16)` commit before its `feat(02-16)` commit. Every RED was verified `RED_EVIDENCE_OK` and failed on assertions against inert placeholders that compile (L-26). No refactor commit was needed.

## Issues Encountered

- `web/src/lib/csps.ts` has one uncovered branch (79 of 80; global branches 99.81%). It was there before this plan and is out of scope; the global 90% threshold still passes.

## Threat Model

- T-02-43: one in-flight submission per form, and an identical retry keeps its key. Both are tested.
- T-02-44: the copy is fixed and only the traceId is shown. A stack-trace title is tested to be absent.
- T-02-45: keys come only from Web Crypto, and a test proves `Math.random` is never called.
- T-02-SC: no packages were installed or changed.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Feature forms compose these pieces: `useSubmission((key, data) => api.orders.create(data, { idempotencyKey: key }))`, `Button loading={pending}`, `fieldErrors` under the fields with `aria-invalid`, then `focusFirstInvalid(form)`, and `onFailure(copy)` for a danger toast that stays until closed.
- Server-side dedupe of the key arrives with SEC-06 in Phase 4.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 8 key files exist on disk.
- Commits 120653d, 10f1600, e6b9ee6 and 2b1886a are in git log.
- Acceptance greps: "Something went wrong" = 1, "Check the highlighted fields." = 1. The Math.random spy is in both idempotencyKey paths, and the double-click case asserts `toHaveBeenCalledTimes(1)`.

---
phase: 05-profile-user-management
plan: 49
subsystem: security
tags: [gap-closure, d-50, d-52, sec-06, security-d-1, idempotency, hmac, hkdf, tdd, tracer]
created: "2026-10-19T03:30:00-05:00"
updated: "2026-10-19T03:30:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-SECURITY.md deferred item D-1; owner rulings D-50 and D-52 (05-CONTEXT.md); Auth:CodeMacKey (AuthSecretsOptions)"
provides:
  - "IdempotencyRecords.RequestHash is an HMAC-SHA256 of the length-prefixed request target and body under an HKDF-derived key (label csps/idempotency/request-hash/v1), still 32 bytes, no schema change"
  - "A record stored before this change, or before an Auth:CodeMacKey rotation, answers 422 idempotency.key-mismatch and the handler never runs a second time"
  - "Each covered POST deletes up to 100 expired idempotency rows of any key, route or user in one short statement before its transaction; a DbException there is logged and ignored"
  - "docs/api/auth.md, SEC-06 and deferred-items.md describe the keyed hash, the lifetime and the retry behaviour"
affects: [05-SECURITY re-run (closes D-1), Phase 9 JOB-01 (sweep still scheduled there)]

actuals:
  tokens: 10900
  tasks: 2
  commits: 5
plan_head_before: 0c34bf19f51f064798b35959198226ed54367116
plan_head_after: e0a4cd88270ab437d4d468137528c18e42b64cca

tech-stack:
  added: []
  patterns:
    - "Purpose-separated key: HKDF-SHA256 from the one host secret with a versioned label, never the raw key"
    - "Housekeeping delete as its own short statement before the request transaction, failure logged and ignored"

key-files:
  created:
    - src/Csps.Infrastructure/Idempotency/IdempotencyRequestHasher.cs
    - tests/Csps.Infrastructure.IntegrationTests/Idempotency/IdempotencyRequestHasherTests.cs
  modified:
    - src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs
    - src/Csps.Infrastructure/Idempotency/IdempotencyRegistration.cs
    - src/Csps.Infrastructure/Idempotency/IdempotencyRecord.cs
    - src/Csps.Server/Security/IdempotencyMiddleware.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs
    - docs/api/auth.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/05-profile-user-management/deferred-items.md

key-decisions:
  - "Retry across the deploy or a key rotation: a stored hash that no longer matches is a 422 mismatch, never treated as a new request, so a POST (a payment, an email) cannot run twice; the browser's next submit uses a new key"
  - "The purge orders by ExpiresAt and takes 100 rows, so it uses IX_IdempotencyRecords_ExpiresAt and is deterministic"

requirements-completed: [PROF-03, USER-02]

coverage:
  - id: D1
    description: "The stored request hash is a keyed HMAC-SHA256 (HKDF label, 32 bytes) and another Auth:CodeMacKey stores a different hash"
    requirement: "PROF-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Idempotency/IdempotencyRequestHasherTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs#TheStoredHashIsAKeyedHmacThatChangesWithTheKey"
        status: pass
    human_judgment: false
  - id: D2
    description: "A record from before the change, or from another code key, is a 422 key-mismatch and the handler does not run again"
    requirement: "USER-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs#ARecordStoredBeforeTheKeyedHashIsAMismatchAndNeverRunsAgain"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs#ARetryAfterTheCodeKeyChangedIsAMismatchAndNeverRunsAgain"
        status: pass
    human_judgment: false
  - id: D3
    description: "Expired rows of any key, route or user are deleted by the next covered POST, at most 100 per request; an unexpired row is never deleted"
    requirement: "PROF-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs#ExpiredRecordsOfAnyKeyRouteOrUserAreDeletedByTheNextCoveredPost"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs#OneRequestDeletesAtMostOneBatch"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs#AnUnexpiredRecordIsNeverDeleted"
        status: pass
    human_judgment: false
  - id: D4
    description: "A failed purge (DbException) never fails the POST"
    requirement: "PROF-03"
    verification: []
    human_judgment: true
    rationale: "Implemented as a catch of DbException with a warning log; no test forces a database failure inside the purge statement."

duration: 17min
completed: 2026-10-19
---

# Phase 5 Plan 49: Keyed idempotency request hash and batch purge Summary

**Idempotency request hashes are now HMAC-SHA256 under an HKDF key derived from Auth:CodeMacKey, and each covered POST deletes up to 100 expired rows, so a copy of the table no longer allows offline password guessing and the 24-hour lifetime is real (D-50, closes security D-1).**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-19T08:11Z
- **Completed:** 2026-10-19T08:28Z
- **Tasks:** 2
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments

- `IdempotencyRequestHasher` (singleton): derives a 32-byte key once with `HKDF.DeriveKey(SHA256, codeMacKey, 32, salt: empty, info: "csps/idempotency/request-hash/v1")` and returns `IncrementalHash.CreateHMAC(SHA256, key)`. The sign-in code MAC keeps using the raw key; this hash never does. An invalid key throws `InvalidOperationException(CodeMacKeyInvalidMessage)`.
- `IdempotencyMiddleware` takes the hasher and keeps the same length-prefixed target then body layout, so the result is still 32 bytes and the column is unchanged (no migration).
- Retry behaviour chosen: a record stored by an older build (plain SHA-256) or under a rotated key compares unequal, so the gate answers `422 idempotency.key-mismatch` and the handler does not run again. The alternative, treating it as new, could run a payment or email twice.
- `IdempotencyGate.PurgeBatchSize = 100`: before the request transaction, one `ExecuteDeleteAsync` over `ExpiresAt <= now` (ordered by `ExpiresAt`, take 100); `DbException` is logged through a `LoggerMessage` warning with no request data and the POST goes on; cancellation propagates. The per-key expired replace in `InspectAsync` stays.
- Docs: "How a repeat is recognised" in `docs/api/auth.md`; SEC-06 reworded as owner-approved D-52; three deferred-items entries marked resolved.

## Task Commits

1. **Task 1 (tracer): keyed hash** - `4c510f9` (test, RED) then `8987ff9` (feat, GREEN)
2. **Task 2: bounded purge and docs** - `f5cd51f` (test, RED), `148a909` (feat, GREEN), `e0a4cd8` (docs)

**Plan metadata:** the docs(05-49) completion commit that follows this file.

## TDD Gate Compliance

- RED 1 (`4c510f9`): a shell hasher still returned the unkeyed SHA-256. Hasher tests failed on assertions (4 of 6: another key gave the same hash, not the HKDF/HMAC bytes, equal to plain SHA-256, no throw for an invalid key). Server tests `TheStoredHashIsAKeyedHmacThatChangesWithTheKey` (stored hash equals plain SHA-256), `ARecordStoredBeforeTheKeyedHashIsAMismatchAndNeverRunsAgain` and `ARetryAfterTheCodeKeyChangedIsAMismatchAndNeverRunsAgain` (both got 200, expected 422) failed on the planned assertions. Semantic assessment: each target test executed and failed for the intended reason; the build was clean.
- RED 2 (`f5cd51f`): `OneRequestDeletesAtMostOneBatch` (105 rows left, expected 5) and `ExpiredRecordsOfAnyKeyRouteOrUserAreDeletedByTheNextCoveredPost` (record still present) failed on assertions. `AnUnexpiredRecordIsNeverDeleted` passed in RED by design: it is a regression guard for behaviour that must survive the purge. The `PurgeBatchSize` constant was added with the RED commit so the tests compile.
- GREEN commits `8987ff9` and `148a909` follow each RED; no refactor commit was needed.
- Tracer gate: the Task 1 verify commands were re-run after GREEN (6/6 hasher tests, 37/37 IdempotencyTests) before expansion.

## Files Created/Modified

- `src/Csps.Infrastructure/Idempotency/IdempotencyRequestHasher.cs` - keyed hash with purpose label (new)
- `src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs` - `PurgeBatchSize`, `PurgeExpiredAsync`, logger
- `src/Csps.Infrastructure/Idempotency/IdempotencyRegistration.cs` - hasher singleton
- `src/Csps.Infrastructure/Idempotency/IdempotencyRecord.cs` - XML docs say keyed HMAC
- `src/Csps.Server/Security/IdempotencyMiddleware.cs` - uses the hasher
- `tests/Csps.Infrastructure.IntegrationTests/Idempotency/IdempotencyRequestHasherTests.cs` - format, key and purpose-separation tests (new)
- `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs` - 6 new cases; `ReadRecordsAsync` returns the hash bytes; `ProbeHost` accepts a code key
- `docs/api/auth.md`, `.planning/REQUIREMENTS.md` (SEC-06 only), `.planning/phases/05-profile-user-management/deferred-items.md`

## Decisions Made

- Mismatch (422), not "treat as new", for records the new key cannot match; documented in the API guide.
- Purge is ordered by `ExpiresAt` so the index serves it and the batch is deterministic.

## Deviations from Plan

None - plan executed exactly as written. Two small points inside the plan's scope: the `PurgeBatchSize` constant was added in the second RED commit so the tests compile, and the unexpired-row test passing in RED is intended (see TDD Gate Compliance). In `IdempotencyRecord.cs` only XML docs changed. The acceptance check `grep -c "05 D-50" .planning/REQUIREMENTS.md` counts lines and SEC-06 is one line, so it prints 1; the text holds the phrase twice (`grep -o` shows 3 with the footer note).

## Issues Encountered

- The first Server test build failed on analyzer RS0030 (`DateTimeOffset.UtcNow` is banned); replaced with `TimeProvider.System.GetUtcNow()`. No other warnings.
- `ExecuteDeleteAsync` after `OrderBy` and `Take` translated and ran correctly on SQL Server.

## Verification

- `IdempotencyRequestHasherTests`: 6/6. `IdempotencyTests`: 40/40.
- Whole `Csps.Server.IntegrationTests`: 1046/1046 passed (no failures in any other gap plan's classes). `Csps.ArchitectureTests`: 217/217.
- Preflight run before each DB-backed batch: ports free, no other project's processes. `CSPS_TEST_SQL=localdb` set per process only; no `BetsLLC_*` database touched.
- Acceptance greps: `HKDF.DeriveKey` 1, label 1, `IdempotencyRequestHasher` in middleware 1 and registration 2, `PurgeBatchSize` 2, `ExecuteDeleteAsync` 2, `D-50` in auth.md 1, `Resolved by plan 05-49` 3.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema; T-05-118 to T-05-121 are mitigated by the keyed hash, the batch purge, the 422 behaviour and the logged-and-ignored purge failure. T-05-SC: no packages, csproj or lock file changed.

## Next Phase Readiness

`/gsd-secure-phase 5` can close deferred item D-1 against this plan. The scheduled idempotency sweep stays with Phase 9 JOB-01. Deploying this change gives at most one day of 422 on retries of requests stored by the old build.

## Self-Check: PASSED

- Created files exist (hasher and hasher tests); commits `4c510f9`, `8987ff9`, `f5cd51f`, `148a909`, `e0a4cd8` are ancestors of HEAD.

---
phase: 10-admin-dashboard
plan: 18
subsystem: api
tags: [dotnet, csharp, ef-core, money, soft-delete, rowversion, audit, openapi, tdd, authorization-matrix]
created: "2026-11-08T03:05:00-06:00"
updated: "2026-11-08T03:05:00-06:00"

requires:
  - phase: 10-admin-dashboard
    provides: MoneyTransfer.SoftDelete and EnsureRemovable, IMoneyTransfers, MoneyAuditDetail, MoneyTransfersController, StaffMoneyLock, AuditChangeLines, MoneyFixtures (plans 10-03 to 10-16)
provides:
  - "DELETE /api/v1/money-transfers/{id}?version= (Manager only): version-checked soft delete, 204; 400 under version, 404, 409 stale or busy"
  - "DELETE /api/v1/money-transfers/{id}/permanent (Manager only): removes a soft-deleted transfer after writing its full record to the audit log, 204; 422 for a live one, 404, 409 busy"
  - "money-transfer.deleted and money-transfer.permanently-deleted audit entries (ids, amount, date, note=yes|no, recordedBy, and for a remove deletedBy and deletedAt), never the note text"
  - "AuditChangeLines reads recordedBy and deletedBy as people for both events"
  - "MoneyTransferRoutesTests: the exact endpoint list under /api/v1/money-transfers, no PUT, PATCH, restore, bulk or collection delete"
affects: [10-19 Transfers panel, 10-20 audit labels and delete dialogs, phase-end security review]

actuals:
  tokens: 23043
  tasks: 3
  commits: 6
plan_head_before: 3630e04eec364fb65089e07f56cb24da2d7a66fb
plan_head_after: 1afd364ac352da1274343a60238af0b0b53c20d1

tech-stack:
  added: []
  patterns:
    - "Version in the query string for a DELETE: parse first (400 under version), look up second, compare the stored RowVersion third (409 edit.stale)"
    - "Money writes that are not a transfer still take the staff-money lock first, so a delete never overlaps a transfer or a hand-over"
    - "Audit first, then the tracked Remove, one save: the permanent remove's only surviving copy is the audit entry"

key-files:
  created:
    - src/Csps.Application/Money/DeleteMoneyTransferHandler.cs
    - src/Csps.Application/Money/RemoveMoneyTransferHandler.cs
    - tests/Csps.Application.UnitTests/Money/DeleteMoneyTransferHandlerTests.cs
    - tests/Csps.Application.UnitTests/Money/RemoveMoneyTransferHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyTransferDeletionTests.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyTransferRoutesTests.cs
  modified:
    - src/Csps.Application/Money/MoneyAuditDetail.cs
    - src/Csps.Application/Money/MoneyErrors.cs
    - src/Csps.Application/Audit/AuditChangeLines.cs
    - src/Csps.Application/Ports/IMoneyTransfers.cs
    - src/Csps.Infrastructure/Money/MoneyTransferStore.cs
    - src/Csps.Server/Controllers/MoneyTransfersController.cs
    - src/Csps.Server/Composition/MoneyApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Money/MoneyAuditDetailTests.cs
    - tests/Csps.Application.UnitTests/Audit/AuditChangeLinesTests.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyFixtures.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/staff-money.md
    - docs/operations/audit-log.md

key-decisions:
  - "The delete and the remove take the staff-money lock first, as the wave 9 notes direct. The plan text said no lock (D-53); this is flagged below for the owner."
  - "The deletedAt instant is written in the remove's audit detail (UTC, yyyy-MM-ddTHH:mm:ssZ) but AuditChangeLines does not turn it into a line. Plan 10-20 can decide whether the audit screen shows it."
  - "A missing or malformed version is refused before the lock and before any lookup, so a bad request never waits and never reveals whether the id exists."
  - "IMoneyTransfers.FindAsync(id, includeDeleted, ct): the delete reads live rows only (a deleted one is a 404), the remove reads both."

patterns-established:
  - "Compile-only stubs in a RED commit: the remove handler returned a fixed 404 and the delete handler took the lock as an unused parameter, so the new unit tests built and failed on their planned assertions"
  - "Admin figure scan for delete routes: an Admin gets the same 403 for a live, a deleted and an unknown transfer, with no amount, name or id in any body"

requirements-completed: [MONEY-06, MONEY-07, MONEY-08]

coverage:
  - id: D1
    description: "A Manager deletes a wrong transfer with its version: 204, both balances move back at once, the row stays with DeletedById and DeletedAtUtc, one money-transfer.deleted audit entry with the Manager as actor"
    requirement: MONEY-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferDeletionTests.cs#AManagerDeletesATransferWithItsVersionAndBothBalancesMoveBackAtOnce"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferDeletionTests.cs#TheDeleteWritesOneAuditEntryWithTheManagerAsActorAndNoNoteText"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stale, missing, malformed, repeated and racing deletes are refused cleanly; a plus-and-slash version parses; the race gives one winner and one audit entry; no email is queued"
    requirement: MONEY-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferDeletionTests.cs#AStaleVersionIs409WithTheStaleMessageAndChangesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferDeletionTests.cs#ARaceBetweenTwoDeletesWithTheSameVersionGivesOneWinnerAndOneAuditEntry"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/DeleteMoneyTransferHandlerTests.cs#AVersionWithPlusAndSlashInItsTextMatchesTheStoredBytes"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Manager removes a deleted transfer for good: 422 for a live one, 204 after a delete, no balance change, one money-transfer.permanently-deleted entry with the full record, 404 the second time"
    requirement: MONEY-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferDeletionTests.cs#ADeletedTransferIsRemovedForGoodBalancesStayAndOneAuditEntryKeepsTheFullRecord"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/RemoveMoneyTransferHandlerTests.cs#TheLockComesFirstThenTheReadThenTheAuditEntryThenTheRemoveAndOneSave"
        status: pass
    human_judgment: false
  - id: D4
    description: "No edit, restore, bulk or collection-delete route exists under /api/v1/money-transfers"
    requirement: MONEY-07
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferRoutesTests.cs#TheMoneyTransferEndpointsAreExactlyTheListTheRecipientsTheTransferTheHandOverTheDeleteAndTheRemove"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both new actions have matrix rows (anonymous 401, Admin 403, Manager 404) and an explicit Manager policy; an Admin learns nothing from a delete or remove answer"
    requirement: MONEY-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferDeletionTests.cs#AnAdminGetsTheSame403ForALiveADeletedAndAnUnknownTransferWithNoFigureOrName"
        status: pass
    human_judgment: false
  - id: D6
    description: "The audit screen can name recordedBy and deletedBy for both events"
    requirement: MONEY-06
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Audit/AuditChangeLinesTests.cs#ResolveNamesTheRecordedByAndDeletedByPeopleAndMarksADeletedOneFormerStaff"
        status: pass
    human_judgment: false

duration: 63min
completed: 2026-11-08
status: complete
---

# Phase 10 Plan 18: A Manager deletes a wrong transfer, can remove it for good, and no one can edit one Summary

**Version-checked soft delete and audited permanent remove of money transfers (Manager only, under the staff-money lock), with the full record kept in the audit log and an enumerated proof that no edit, restore or bulk route exists.**

## Performance

- **Duration:** about 63 min (the start time was not recorded by the run, so this is estimated from the first tool call)
- **Started:** 2026-11-08T02:02:00-06:00 (estimate)
- **Completed:** 2026-11-08T03:05:00-06:00
- **Tasks:** 3 (task 1 was the tracer)
- **Files modified:** 21 in the code range (6 new, 15 changed)

## Accomplishments

- `DELETE /api/v1/money-transfers/{id}?version=`: Manager only. The version is parsed first (400 `Reload the form and try again.` under `version`), then the lock is taken, then the row is found live only (404 `This transfer wasn't found.`), then the stored `RowVersion` is compared (409 `edit.stale`), then `SoftDelete`, the `money-transfer.deleted` audit entry and one save.
- `DELETE /api/v1/money-transfers/{id}/permanent`: Manager only. Lock, find including deleted (404), `EnsureRemovable` (422 `Delete the transfer first.`), audit entry with the full record, tracked `Remove`, one save.
- `MoneyAuditDetail.Deleted` and `Removed`: ids, a `0.00` amount, a date, `note=yes|no`, `recordedBy`, and for a remove `deletedBy` and `deletedAt`. The note text never appears. The longest possible detail is far under 400 characters (tested).
- `AuditChangeLines`: `recordedBy` and `deletedBy` are person fields, so the audit screen gets names and the former-staff mark.
- Tests: 23 integration cases in `MoneyTransferDeletionTests` (4 of them theory rows), 5 in `MoneyTransferRoutesTests`, 17 delete and 8 remove handler unit cases, audit detail and audit line cases, and two matrix rows.
- Contract refreshed (`openapi.v1.json`, `api.generated.ts`), docs written for both routes and the two audit events.

## Task Commits

1. **Task 1 (tracer): delete with its version** - RED `03e20866` (test), GREEN `25bd985c` (feat)
2. **Task 2: stale, repeated, racing, malformed deletes and no email** - RED `ee2b4705` (test), GREEN `b2af6495` (feat)
3. **Task 3: permanent remove, person keys, no edit routes** - RED `89881b70` (test), GREEN `1afd364a` (feat)

**Plan metadata:** the SUMMARY commit that follows these six.

## Tracer gate

Task 1 was the tracer. After its GREEN commit I re-ran its `<verify>` end to end: 421 tests in `MoneyTransferDeletionTests`, `AuthorizationMatrixTests` and `AuthorizationCoverageTests` passed, `OpenApiSnapshotTests` passed after the refresh, and `npm --prefix tools/openapi-gen run check` printed `Generated API types match tools/openapi-gen/openapi.v1.json.` Tracer verified end-to-end, expanding.

## TDD Gate Compliance

Each task has a `test(10-18)` commit before its `feat(10-18)` commit (`git log --grep` order above). The `gsd_run check tdd-red-evidence` classifier reads TAP, JUnit, swift-testing and unittest reports; this project runs xunit v3 on Microsoft Testing Platform, whose console output is none of those, so I did not run it. The semantic assessment below is mine, from the real run output.

- **Task 1 RED:** 8 failures in the first run. `MoneyTransferDeletionTests` delete cases got `404 Not Found` where the test expects `204`, `403` and `401` (the route did not exist); `AuthorizationMatrixTests` failed with `DELETE /api/v1/money-transfers/{id:guid}: matrix row matches no endpoint.` These are the planned assertions failing for the planned reason, not build or fixture errors.
- **Task 2 RED:** 2 of 17 new handler unit tests failed on the planned assertions: `TheLockIsTakenBeforeTheTransferIsReadAndTheAuditEntryJoinsTheSave` (`CallSequenceNotFoundException`, `LockAsync` never received) and `ALockThatCannotBeHadAnswersBusyAndWritesNothing` (no error because the lock was never asked). The 17 integration tests and the new audit detail tests passed on arrival: the Task 1 handler already did what the plan's Task 1 action describes (version parse, 404, stale compare, audit), so those tests are characterization tests, not a RED. This is the plan's own task split, recorded here as an unexpected green.
- **Task 3 RED:** 11 unit failures (`RemoveMoneyTransferHandlerTests` against the compile-only stub, three `AuditChangeLinesTests`, the Resolve case) and 11 integration failures (all remove cases got 404, the matrix row matched no endpoint, and the routes test found five endpoints instead of six). Planned assertions, planned reasons.
- **Compile-only stubs:** the Task 2 RED commit gave `DeleteMoneyTransferHandler` an unused lock parameter; the Task 3 RED commit added `RemoveMoneyTransferHandler` returning a fixed 404. Both are replaced in the next GREEN commit.

## Verification (quoted from the runs)

- Handler and audit unit tests (`RemoveMoneyTransferHandlerTests`, `AuditChangeLinesTests`, `DeleteMoneyTransferHandlerTests`, `MoneyAuditDetailTests`): `total: 109, failed: 0, succeeded: 109`.
- Plan verify set 3 (`MoneyTransferDeletionTests`, `MoneyTransferRoutesTests`, `AuthorizationMatrixTests`, `AuthorizationCoverageTests`, `IdempotencyCoverageTests`, `OpenApiSnapshotTests`): `total: 470, failed: 0` after the routes test fix (first run `failed: 1`, see Deviations).
- Whole `Csps.Server.IntegrationTests.Money` namespace: `total: 157, failed: 0, succeeded: 157`.
- `AuditLog*`, `Idempotency*`, `OpenApi*`, `Authorization*` classes: `total: 567, failed: 0, succeeded: 567`.
- `Csps.ArchitectureTests` `NoInlineSqlTests` and `LayerTests`: `total: 33, failed: 0`.
- Whole `Csps.Application.UnitTests`: `total: 2533, failed: 0`. Coverage with coverlet over `Csps.Application`: 98.17% line, 95.72% branch overall; `DeleteMoneyTransferHandler`, `RemoveMoneyTransferHandler` and `MoneyAuditDetail` 100% line and branch; `AuditChangeLines` 99.64% line, 91% branch.
- `dotnet format Csps.slnx --verify-no-changes`: no output (clean). `npm --prefix web run typecheck`: clean. `npm --prefix tools/openapi-gen run check`: match.
- Build: 0 warnings, 0 errors for the integration, unit and architecture projects.
- `gitleaks protect --staged` before each of the six code commits: `no leaks found`.

**The delete race, five separate runs in a row** (`ARaceBetweenTwoDeletesWithTheSameVersionGivesOneWinnerAndOneAuditEntry`, 3 rounds per run, two deletes released together, one 204 plus a 404 or 409, one audit row per round):

| Run | Result | Duration |
|-----|--------|----------|
| 1 | passed (1 of 1) | 7s 985ms |
| 2 | passed (1 of 1) | 7s 836ms |
| 3 | passed (1 of 1) | 7s 886ms |
| 4 | passed (1 of 1) | 7s 916ms |
| 5 | passed (1 of 1) | 8s 245ms |

**Endpoint enumeration** (`MoneyTransferRoutesTests` asserts this exact sorted list; a PUT or PATCH to a transfer answers 405 or 404):

```text
DELETE /api/v1/money-transfers/{id:guid}
DELETE /api/v1/money-transfers/{id:guid}/permanent
GET /api/v1/money-transfers
GET /api/v1/money-transfers/recipients
POST /api/v1/money-transfers
POST /api/v1/money-transfers/handovers
```

**Acceptance criteria:** `EditErrors.Stale` in the delete handler 1; `AuditActions.MoneyTransferDeleted` 1; `DeleteMoneyTransfer` in the contract 1; `?version=` in the matrix 1; names containing Stale, MissingVersion, PlusSlash, Twice, Race and NoEmail all exist in `MoneyTransferDeletionTests`; `EnsureRemovable` in the remove handler 1; `HttpPut|HttpPatch` in the controller 0; both audit codes in `audit-log.md` 1 each; `RemoveMoneyTransfer` in the contract 1.

## Files Created/Modified

See `key-files` above. The two new unit test files were not in the plan's file list; they carry the handler logic to 100% coverage because the application coverage bar is 95%.

## Decisions Made

- **Lock on delete and remove (needs the owner's eye).** The plan truth said "No staff-money lock (D-53)", and D-53 says only a transfer and a hand-over take it. The wave 9 notes from the orchestrator say deletes and permanent deletes take the lock like the other money writes, so both handlers take it as the first statement in the transaction. The cost is that a delete can answer the busy 409 if a transfer holds the lock for 10 seconds. D-53's reason (payments and expenses may already take a balance below zero) does not apply to a delete in the same way, so the owner may want to confirm or reverse this. Reversing it is two lines per handler plus the two lock unit tests.
- **`deletedAt` is stored but not a line.** The remove's audit detail holds `deletedAt=<UTC instant>` as D-25 asks. `AuditChangeLines` does not read it into a line, so the audit screen does not show it until plan 10-20 decides to.
- **Version checked before the lock.** A bad version never waits for the lock and never says whether the id exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Routes test keys had no leading slash**
- **Found during:** Task 3 GREEN run
- **Issue:** `MoneyTransferRoutesTests` compared endpoint keys written as `GET api/v1/...` with the keys `AuthorizationCoverage.KeysOf` produces (`GET /api/v1/...`). The exact-list test failed, and the "collection cannot be deleted" assertion had been passing without checking anything.
- **Fix:** Expected keys and the collection check now carry the slash.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Money/MoneyTransferRoutesTests.cs`
- **Verification:** the 5 routes tests pass; the exact list mismatch is gone.
- **Committed in:** `1afd364a`

**2. [Rule 3 - Blocking] Test world seeded a 0.00 payment**
- **Found during:** Task 2 RED run
- **Issue:** my own test setup tried to seed a zero payment for tests that need no money, which threw before the request was sent.
- **Fix:** the world helper seeds only when the amount is above zero.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Money/MoneyTransferDeletionTests.cs`
- **Committed in:** `ee2b4705`

### Plan differences, not auto-fixes

- **Lock on delete and remove** (above), from the orchestrator's wave notes, against the plan text.
- **PlusSlash on a real row.** A stored `rowversion` cannot be written, so a real transfer with `+` and `/` in its version text cannot be produced on demand. `PlusSlash` is covered two ways: a unit test whose stored bytes (set by reflection on the private setter) give a version containing both characters and the delete succeeds; and an integration test that sends such a version URL-encoded for an unknown id and gets 404, which proves it parsed and reached the lookup (a wrong decode would give 400).
- **Two extra unit test files** (`DeleteMoneyTransferHandlerTests`, `RemoveMoneyTransferHandlerTests`) beyond the plan list, for the coverage bar.

**Total deviations:** 2 auto-fixed (1 bug in a test, 1 blocking in test setup), 3 plan differences recorded above.
**Impact on plan:** no scope creep. No package added, no schema change, no trigger, no inline SQL.

## Issues Encountered

- A worktree-isolated shell refuses long compound commands and loops, so file edits were done with small Node scripts kept in the scratchpad and the race was run as five separate commands. Nothing was lost.
- No flakes seen. `ExpenseListTimingTests` and the other known load flakes were not touched by the runs above.

## Needs owner review

- **New owner-facing sentences: none.** Every message is one the plan or D-58 spelled out or an existing approved line: `This transfer wasn't found.`, `Reload the form and try again.`, `This was changed by someone else. Reload and try again.`, `Delete the transfer first.` and the existing busy line `Something changed at the same time. Try again.`
- **The lock on delete and remove** (see Decisions Made).
- **Whether the audit screen should show when a transfer was deleted** for a remove entry (plan 10-20).

## Known Stubs

None.

## Threat Flags

None. The two new routes are the ones the plan's threat model covers (T-10-36 to T-10-40): stale delete (version check and race test), unaudited delete (audit in the same save), note text in the log (tests), Admin access (Manager policy, matrix rows, same 403 for live, deleted and unknown ids with no figure or name in any body) and an edit path (the enumerated endpoint list).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 10-19 and 10-20 can call `DELETE /api/v1/money-transfers/{id}?version=` and `DELETE /api/v1/money-transfers/{id}/permanent`; the generated types carry `DeleteMoneyTransfer` and `RemoveMoneyTransfer`. The version is the `version` on each list item, sent URL-encoded.
- Audit lines for both events use the fields `from`, `to`, `amount`, `date`, `recordedBy` and `deletedBy` (a person line puts the person in `toPerson`). 10-20 owns the labels.
- Nothing blocks the next plan.

## Self-Check: PASSED

- Created files exist: the six files listed under `key-files.created` and this SUMMARY.
- Commits exist on this branch: `03e20866`, `25bd985c`, `ee2b4705`, `b2af6495`, `89881b70`, `1afd364a` (checked with `git merge-base --is-ancestor`).
- `commits: 6` was measured with `git rev-list --count` from the ledger base `3630e04eec364fb65089e07f56cb24da2d7a66fb` to `1afd364ac352da1274343a60238af0b0b53c20d1`.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-08*

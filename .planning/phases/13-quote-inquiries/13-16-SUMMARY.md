---
created: 2026-11-23T13:35:00-06:00
updated: 2026-11-23T13:35:00-06:00
phase: 13-quote-inquiries
plan: 16
subsystem: quote-requests-staff-api
tags: [quote-requests, status-history, spam, image-removal, audit, rowversion, ef-core, tdd]
status: complete

requires:
  - phase: 13-quote-inquiries
    provides: "13-08 ImageDeletionReason.QuoteSpam and the quote retention job, 13-11 the staff controller, reader and inbox list, 13-13 AuditActions at 133"
provides:
  - "QuoteRequestStatusChange entity and table QuoteRequestStatusChanges (cascade from QuoteRequests; staff and order links NO ACTION), QuoteRequest.PhotosRemovedAtUtc, migration 20261123184951_AddQuoteRequestStatusChanges"
  - "QuoteRequest.ChangeStatus(to, by, at): free moves among the five hand-set statuses, Converted never set or left by hand, Spam returns the stored ids and removes every photo place"
  - "GET /api/v1/quote-requests/{id} (GetQuoteRequest, Staff): every field, private photo addresses, missing names, photosRemovedAtUtc, history ending with the arrival, last changer, version"
  - "POST /api/v1/quote-requests/{id}/status (ChangeQuoteRequestStatus, Staff): 400 quote-requests.validation or quote-requests.converted-locked, 404, 409 quote-requests.conflict"
  - "AuditActions.QuoteRequestStatusChanged = quote-request.status-changed (catalog 134), web label 'Quote request status changed' under Orders"
  - "IQuoteRequestReader.GetDetailAsync, IQuoteRequestStore.FindAsync, GetQuoteRequestHandler, ChangeQuoteRequestStatusHandler, QuoteRequestAuditDetail"
  - "Inbox rows read photosRemoved from PhotosRemovedAtUtc (13-11 hand-off)"
affects: [13-18, 13-19, 13-20, 13-25]

actuals:
  tokens: 84000
  tasks: 3
  commits: 6
plan_head_before: f3aaeb4e4ec0df78c39b8bffa751e870d06df6ae
plan_head_after: 1ed23f91cf970c11d5348bf2982df2b04347006c

tech-stack:
  added: []
  patterns:
    - "Status change: validate, then one transaction that finds the request, compares the row version, lets the domain decide, queues files, records the audit entry and saves once"
    - "The arrival is not a stored history row: the reader's moves plus one synthetic row from the received time, so requests saved before the table existed read the same"

key-files:
  created:
    - src/Csps.Domain/QuoteRequests/QuoteRequestStatusChange.cs
    - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestStatusChangeConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261123184951_AddQuoteRequestStatusChanges.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261123184951_AddQuoteRequestStatusChanges.Designer.cs
    - src/Csps.Application/QuoteRequests/GetQuoteRequestHandler.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestDetailResponse.cs
    - src/Csps.Application/QuoteRequests/ChangeQuoteRequestStatusRequest.cs
    - src/Csps.Application/QuoteRequests/ChangeQuoteRequestStatusRequestValidator.cs
    - src/Csps.Application/QuoteRequests/ChangeQuoteRequestStatusHandler.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestAuditDetail.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/GetQuoteRequestTests.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestStatusTests.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestStaffRig.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/ChangeQuoteRequestStatusHandlerTests.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/GetQuoteRequestHandlerTests.cs
  modified:
    - src/Csps.Domain/QuoteRequests/QuoteRequest.cs
    - src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Ports/IQuoteRequestReader.cs
    - src/Csps.Application/Ports/IQuoteRequestStore.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestReader.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs
    - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestConfiguration.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Server/Controllers/QuoteRequestsController.cs
    - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
    - tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Maintenance/QuoteRequestRetentionJobTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/modules/admin/auditCopy.ts
    - web/src/modules/admin/auditCopy.test.ts
    - docs/api/quote-requests.md

key-decisions:
  - "The arrival row of the history is built from the received time, not stored, so old requests and new ones read the same and the public create path is untouched"
  - "History is newest first, ending with the arrival, as UI-SPEC R2 shows it"
  - "Entering Spam removes every photo place, stored or missing, and sets PhotosRemovedAtUtc whenever a place was removed; a request with no places keeps it null"
  - "The body is checked before the lookup, as for orders, so the matrix row with no body is 400 for both roles"
  - "A move to the status the request already has is a 400 refusal ('This request is already {Status}.'), not a silent 200"
  - "The 409 has its own code quote-requests.conflict with the shared stale text"

requirements-completed: [INQ-05]

coverage:
  - id: D1
    description: "GET one request answers every field, private photo addresses (thumb, viewer, 2000 px full size), missing names, photosRemovedAtUtc, history with the arrival, last changer and version; unknown id 404; anonymous 401"
    requirement: INQ-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/GetQuoteRequestTests.cs (4 tests)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/QuoteRequests/GetQuoteRequestHandlerTests.cs (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Free moves among the five hand-set statuses with history and audit; Converted refused as a target and locked as a source; same status refused; stale version 409; forged stamps ignored; New count drops"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs, tests/Csps.Application.UnitTests/QuoteRequests/ChangeQuoteRequestStatusHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestStatusTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Spam queues each stored photo as QuoteSpam, removes the places and sets the removal time in the same save; leaving Spam restores nothing; a forced failure before the save changes nothing; inbox shows the removed mark"
    requirement: INQ-05
    verification:
      - kind: integration
        ref: "QuoteRequestStatusTests#MovingToSpamQueuesEachStoredPhotoRemovesThePlacesAndSetsTheRemovalTime, #SpamWithNoPhotosQueuesNothingAndSetsNoRemovalTime, #AFailureBeforeTheSaveLeavesThePhotosTheStatusAndTheQueueUnchanged"
        status: pass
    human_judgment: false
  - id: D4
    description: "A purged request's history rows go with it"
    requirement: INQ-07
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Maintenance/QuoteRequestRetentionJobTests.cs#APurgedRequestTakesItsStatusHistoryWithIt"
        status: pass
    human_judgment: false

duration: about 50 min
completed: 2026-11-23
---

# Phase 13 Plan 16: Staff open a request, change its status, and Spam photos are removed Summary

*Created: 2026-11-23T13:35:00-06:00 · Updated: 2026-11-23T13:35:00-06:00*

**Staff of either role open one quote request with server-made private photo addresses and its history, move it freely between New, Contacted, Quoted, Closed and Spam with the row version (Converted stays locked), and a Spam move queues its photos for the daily removal job and never brings them back.**

## What was built

- **History table.** `QuoteRequestStatusChange` (Id, QuoteRequestId, FromStatus, ToStatus as checked bytes, ChangedById nullable with NO ACTION to users, ChangedAtUtc, OrderId nullable with NO ACTION to orders for plan 13-20). It cascades from `QuoteRequests`, so the 6-month purge takes it along. `QuoteRequest.PhotosRemovedAtUtc` is a new nullable column. Migration `20261123184951_AddQuoteRequestStatusChanges` is additive only: one table, three indexes, two check constraints, one column. No trigger, no JSON, no inline SQL.
- **Detail read.** `GET /api/v1/quote-requests/{id}`. The reader runs three commands (request with last changer, photo places, moves with each mover's current name). `GetQuoteRequestHandler` builds every photo address with `IImageDelivery.ForPhoto` (D-36), lists the missing names, shows the phone in display form and adds the arrival row last. The storage id is never sent.
- **Status change.** `POST /api/v1/quote-requests/{id}/status` with `{ status, version }`. The validator allows the five hand-set keys and an eight-byte version. In one transaction: find (404), compare the row version (409 `quote-requests.conflict`), `ChangeStatus` in the domain (400 for the same status or a Converted request), queue Spam files, one `quote-request.status-changed` entry with `status=from>to`, one save. A lost race at the save is the same 409. `UpdatedById` and `UpdatedAtUtc` come from the stamp interceptor (token and clock), so forged members in the body do nothing.
- **Spam.** Entering Spam returns the stored public ids; the handler queues each with `ImageDeletionReason.QuoteSpam` through `Enqueue` (same unit of work, never `EnqueueNowAsync`), the domain clears the photo places and sets `PhotosRemovedAtUtc`. The daily `ImageRemovalJob` (D-34) deletes the files. Leaving Spam keeps them gone.
- **13-11 hand-off done.** `QuoteRequestReader.ListAsync` now reads `photosRemoved` as `PhotosRemovedAtUtc != null`, with an integration check in the Spam test (the inbox row shows the mark, and keeps it after the move back to New).
- **Audit catalog.** 134 entries; web label "Quote request status changed" in the Orders group.
- OpenAPI snapshot and `web/src/types/api.generated.ts` refreshed twice (Task 1 and Task 2); `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." `docs/api/quote-requests.md` documents both calls, the free-move rule, the Converted lock, the Spam rule and retention.

## TDD record

The RED outputs are xUnit MTP and vitest console text, which `gsd_run check tdd-red-evidence` does not read, so each RED was assessed by hand from the real output.

**Task 1 (tracer), detail read**
- RED `f41016f7`: GetQuoteRequestTests 4 of 4 failed (`HttpStatusCode.OK` expected, `NotFound` got; the not-found case found no `code` member because the route fell through to the generic 404). Matrix: anonymous row `401` expected, `404` got, and the coverage check "matrix row matches no endpoint". Valid RED: the route did not exist; no compile stub was needed.
- GREEN `a13023e2`: server GetQuoteRequestTests, AuthorizationMatrixTests and OpenApiSnapshotTests 602 of 602. Infrastructure MigrationScriptTests, TriggerInventoryTests, MigrationTests and QuoteRequestRetentionJobTests 221 of 221. Tracer re-run end to end after the snapshot refresh before Task 2.

**Task 2, status moves**
- RED `6b0e6b03`: domain 37 of 187 failed (for example `result.IsFailure should be True but was False`; `AuditActions.All.Count should be 134 but was 133`). Handler 13 of 18 failed; the 4 GetQuoteRequestHandlerTests passed (regression tests for Task 1 mapping) and the 404 case passed under the stub. Server 11 of 596 failed (404 where 200, 400, 401 or 409 was expected; the new matrix row matched no endpoint). Web 3 of 98 failed (`expected 'quote-request.status-changed' to be 'Quote request status changed'`, length 133 not 134). `ChangeStatus`, the validator, the handler and the audit detail were compile-only stubs.
- GREEN `ff11f6cd`: domain 187 of 187; application quote tests 234 of 234; server QuoteRequestStatusTests, GetQuoteRequestTests, AuthorizationMatrixTests and OpenApiSnapshotTests 611 of 611; web auditCopy 98 of 98; `dotnet build Csps.slnx -warnaserror` 0 warnings, 0 errors.

**Task 3, Spam removal**
- RED `4087838e`: domain 3 of 71 failed (the Spam cases); handler 1 of 15 failed (no Enqueue calls); server 1 of 9 failed (`body.GetProperty("photos").GetArrayLength() should be 0 but was 2`). The forced-failure rollback case and the retention cascade case passed at RED: they guard the one-transaction rule and the cascade built in Task 1, so they are regression tests, not RED evidence.
- GREEN `1ed23f91`: domain 71 of 71, handler 15 of 15, server QuoteRequestStatusTests, GetQuoteRequestTests and ListQuoteRequestsTests 37 of 37, infrastructure QuoteRequestRetentionJobTests, MigrationScriptTests and TriggerInventoryTests 21 of 21.

No REFACTOR commit was needed.

## Final verification (quoted)

- `dotnet build Csps.slnx -warnaserror`: "0 Warning(s) 0 Error(s)".
- `dotnet test --project tests/Csps.ArchitectureTests`: total 290, failed 0.
- `dotnet test --project tests/Csps.Domain.UnitTests`: total 2219, failed 0.
- `dotnet test --project tests/Csps.Application.UnitTests`: total 3444, failed 0.
- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests` with every QuoteRequests class, AuthorizationMatrixTests, OpenApiSnapshotTests, MaintenanceEndpointTests and ImageCleanupRunTests: total 710, failed 0.
- `npm --prefix web run typecheck`: clean. `eslint --max-warnings 0` on the two audit copy files: clean.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match".
- Preflight ran before the first integration run and again before the final run: ports 5180, 5115, 7028 and 5199 free. The second run listed the 13-17 executor's own vitest processes in its worktree (no port, no LocalDB), so the .NET run went ahead. `gitleaks protect --staged` found no leaks on all six commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test data in a regression test**
- **Found during:** Task 2 RED
- **Issue:** `GetQuoteRequestHandlerTests.ANumberThatIsNotAPhilippineMobileIsShownAsStored` expected no product while its view had one.
- **Fix:** the test view clears the product and quantity. Commit `6b0e6b03`.

**2. [Plan text] `recordedBy` and `recordedAt` left out of the detail**
- A visitor has no account, so `recordedBy` would always be null and `recordedAt` repeats `receivedAtUtc`. The answer keeps `receivedAtUtc`, `lastChangedBy` and `lastChangedAt`. The two assertions were removed from the Task 1 test before its GREEN commit.

### Plan notes

- **Files outside files_modified:** `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestStaffRig.cs` (shared seed and request helpers for the two new server test classes), `tests/Csps.Application.UnitTests/QuoteRequests/GetQuoteRequestHandlerTests.cs` (Application coverage for the detail mapping), `src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs` (the status field name and the new messages and code, next to the other quote rules).
- **Matrix row for the status call:** the plan's "(404 for the random id)" applies to the read row. The status row sends no body, so both roles meet 400 before the lookup, as the order status row does.
- **Plan commit ledger:** the sandbox refuses a write under `.git`, as in 13-13. Commits were counted from the known base: `git rev-list --count f3aaeb4e..HEAD` = 6 before this summary.
- **Branch:** the plan text says `gsd/phase-13-quote-inquiries`; this ran on the orchestrator's worktree branch `worktree-agent-ac420465cf20f776b` as instructed. No branch was created or switched.
- `npm ci` ran in `web/` and `tools/openapi-gen/` of this worktree to run the checks. It installs only the locked packages; no package was added or changed.
- STATE.md, ROADMAP.md and DECISIONS.md were not touched.

## Not run here

- The full .NET suites of Server and Infrastructure, the full web suite and Playwright e2e. The orchestrator gate covers them.

## Flakes

None seen. Every run above passed on its first try.

## Authentication Gates

None.

## Known Stubs

None. The RED compile-only stubs were all replaced in their GREEN commits, and the 13-11 `photosRemoved: false` stub is now wired.

## Threat Flags

None beyond the plan. T-13-45: `Policies.Staff` on the controller, matrix rows for both new actions (anonymous 401). T-13-46: row version 409 with a test, and a lost race at the save is the same 409. T-13-47: the validator allows five keys, the domain refuses Converted both ways, stamps come from the token. T-13-48: addresses are built by `IImageDelivery` and the storage id is never in the answer (asserted). T-13-49: history row plus audit entry. T-13-SC: no package added or bumped.

One known limit, recorded rather than fixed: if a photo upload fills an empty place in the moment between the Spam move reading the places and saving, that place is removed without its file being queued. The stray sweep (13-08) queues such a file after 2 days, so it goes within 2 days instead of 1.

## Owner items

Nothing blocks. These are choices made while the owner was away. A is what was built.

1. **Spam and photos that never arrived.** A: entering Spam removes every photo place, including the names of photos that never arrived, and marks the photos as removed (built). B: keep the missing names, so the page still says which photos never came.
2. **The arrival row of the history.** A: built from the received time when the request is read, never stored (built). B: store a first row when the visitor sends the form, as orders do.
3. **History order.** A: newest first, ending with the arrival, as UI-SPEC R2 shows (built). B: oldest first, like the order history answer.
4. **Moving to the status it already has.** A: 400 "This request is already Quoted." (built, the plan's wording). B: answer 200 and change nothing, as the order status call does.
5. **Wording to confirm.** "A request that became an order can't change status." (400 `quote-requests.converted-locked`), "Choose a status." for Converted or an unknown key, and the shared "This was changed by someone else. Reload and try again." for the 409.
6. **Audit "What changed" line.** A: the audit page shows the label only; the stored detail `status=new>contacted` is not turned into a sentence yet (built). B: show "Status: New to Contacted" for this entry.
7. **The upload race in Threat Flags.** A: accept the 2-day stray sweep for that rare case (built). B: take a lock on the request during uploads and the Spam move so the file is always queued at once.
8. No package was added or changed.

## Self-Check: PASSED

- Files exist: `QuoteRequestStatusChange.cs`, `QuoteRequestStatusChangeConfiguration.cs`, `20261123184951_AddQuoteRequestStatusChanges.cs` and its Designer file, `GetQuoteRequestHandler.cs`, `QuoteRequestDetailResponse.cs`, `ChangeQuoteRequestStatusRequest.cs`, `ChangeQuoteRequestStatusRequestValidator.cs`, `ChangeQuoteRequestStatusHandler.cs`, `QuoteRequestAuditDetail.cs`, `GetQuoteRequestTests.cs`, `QuoteRequestStatusTests.cs`, `QuoteRequestStaffRig.cs`, `ChangeQuoteRequestStatusHandlerTests.cs`, `GetQuoteRequestHandlerTests.cs`.
- Commits reachable from HEAD: `f41016f7`, `a13023e2`, `6b0e6b03`, `ff11f6cd`, `4087838e`, `1ed23f91`.
- Acceptance greps: `ForPhoto` in GetQuoteRequestHandler.cs (1); `ShouldBe(134)` in AuditActionsTests.cs (1); `quote-request.status-changed` in AuditActions.cs (1); `QuoteSpam` in ChangeQuoteRequestStatusHandler.cs (1).

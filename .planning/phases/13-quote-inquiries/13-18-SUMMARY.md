---
created: 2026-11-23T16:09:00-06:00
updated: 2026-11-23T16:09:00-06:00
phase: 13-quote-inquiries
plan: 18
subsystem: quote-requests-staff-api
tags: [quote-requests, notes, delete, image-removal, audit, rowversion, ef-core, tdd]
status: complete

requires:
  - phase: 13-quote-inquiries
    provides: "13-08 ImageDeletionReason.QuoteDeleted and the retention job, 13-16 the detail read, the status change, the staff rig and AuditActions at 134, W7 the one-snapshot detail read"
provides:
  - "QuoteRequestNote entity and table QuoteRequestNotes (cascade from QuoteRequests, author NO ACTION), migration 20261123212018_AddQuoteRequestNotes"
  - "QuoteRequest.AddNote(text, by, at) and QuoteRequestRules.NoteMaxLength = 1000 with 'Write a note first.' and 'Keep the note to 1,000 characters or fewer.'"
  - "POST /api/v1/quote-requests/{id}/notes (AddQuoteRequestNote, Staff): 200 the detail with the new note first; 400, 401, 404, 409"
  - "DELETE /api/v1/quote-requests/{id}?version= (DeleteQuoteRequest, Manager): 204; 400 on version or converted-locked; 401; 403 Admin; 404; 409"
  - "The detail gains notes (id, text, createdBy, createdAtUtc), newest first, read inside the one-snapshot loop"
  - "AuditActions.QuoteRequestNoteAdded = quote-request.note-added and QuoteRequestDeleted = quote-request.deleted (catalog 136), web labels under Orders"
  - "IQuoteRequestStore.Remove, AddQuoteRequestNoteHandler, DeleteQuoteRequestHandler, QuoteRequestErrors.ConvertedDeleteLocked"
affects: [13-19, 13-21, 13-22, 13-25]

actuals:
  tokens: 76600
  tasks: 2
  commits: 5
plan_head_before: bd27b37150c775549357455083b94576aec9cd30
plan_head_after: ccf783242ff189c7d92ac1bc0d26194b74133c8f

tech-stack:
  added: []
  patterns:
    - "Add-only child: the domain appends and moves the edit version, so the save stamps who last changed the request and moves its row version; no route edits or removes a child"
    - "Permanent delete: version checked first, then one transaction that finds, refuses Converted, compares the version, queues files, removes the request (children cascade), records the audit entry and saves once"

key-files:
  created:
    - src/Csps.Domain/QuoteRequests/QuoteRequestNote.cs
    - src/Csps.Application/QuoteRequests/AddQuoteRequestNoteRequest.cs
    - src/Csps.Application/QuoteRequests/AddQuoteRequestNoteRequestValidator.cs
    - src/Csps.Application/QuoteRequests/AddQuoteRequestNoteHandler.cs
    - src/Csps.Application/QuoteRequests/DeleteQuoteRequestHandler.cs
    - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestNoteConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261123212018_AddQuoteRequestNotes.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261123212018_AddQuoteRequestNotes.Designer.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/AddQuoteRequestNoteRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/AddQuoteRequestNoteHandlerTests.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/DeleteQuoteRequestHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestNoteTests.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/DeleteQuoteRequestTests.cs
  modified:
    - src/Csps.Domain/QuoteRequests/QuoteRequest.cs
    - src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Ports/IQuoteRequestReader.cs
    - src/Csps.Application/Ports/IQuoteRequestStore.cs
    - src/Csps.Application/QuoteRequests/GetQuoteRequestHandler.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestAuditDetail.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestDetailResponse.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
    - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestConfiguration.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestReader.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs
    - src/Csps.Server/Controllers/QuoteRequestsController.cs
    - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
    - tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/GetQuoteRequestHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Maintenance/QuoteRequestRetentionJobTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/QuoteRequests/QuoteRequestReaderDetailSnapshotTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestStaffRig.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/modules/admin/auditCopy.ts
    - web/src/modules/admin/auditCopy.test.ts
    - docs/api/quote-requests.md

key-decisions:
  - "The note call answers the whole detail, as the plan says ('200 with the detail'); the privacy cost of that is owner item 1"
  - "A note moves the request's row version (plan assumption), so a status change sent from before the note is a 409"
  - "Notes may be added in every status, Converted included; there is no cap on how many"
  - "The delete audit detail is status=<key>;photos=<n>, never customer details"
  - "The delete refuses Converted before it compares the version, in the plan's order"
  - "The converted-locked delete error is listed on the status field, because a validation error needs a field"

requirements-completed: [INQ-05]

coverage:
  - id: D1
    description: "Staff add a note of 1 to 1,000 characters with who and when from the token and clock; the detail lists notes newest first with the author kept after the account is deleted; audit without text; no route edits or removes a note"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs, tests/Csps.Application.UnitTests/QuoteRequests/AddQuoteRequestNoteRequestValidatorTests.cs, AddQuoteRequestNoteHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestNoteTests.cs (11 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Manager deletes a request with its photo places, notes and history in one save, queues each stored photo as QuoteDeleted, and records quote-request.deleted with no customer details; Admin 403, Converted 400, stale 409, unknown 404, missing version 400, a failure before the save changes nothing"
    requirement: INQ-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/DeleteQuoteRequestTests.cs (8 tests)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/QuoteRequests/DeleteQuoteRequestHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "A purged request's notes go with it"
    requirement: INQ-07
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Maintenance/QuoteRequestRetentionJobTests.cs#APurgedRequestTakesItsNotesWithIt"
        status: pass
    human_judgment: false

duration: about 75 min
completed: 2026-11-23
---

# Phase 13 Plan 18: Staff add internal notes, and a Manager can delete a request for good Summary

*Created: 2026-11-23T16:09:00-06:00 · Updated: 2026-11-23T16:09:00-06:00*

**Staff of either role add add-only notes to a quote request (stamped from the token and the clock, audited by id only), and a Manager can delete a request with its row version: the request, its photo places, notes and history go in one save, each stored photo is queued for the daily removal job, and the audit entry holds no customer details.**

## What was built

- **Notes table.** `QuoteRequestNote` (Id, QuoteRequestId, Text up to 1,000, CreatedById NO ACTION to users, CreatedAtUtc) in `QuoteRequestNotes`, which cascades from `QuoteRequests`, so the 6-month purge and the Manager delete take the notes along. Migration `20261123212018_AddQuoteRequestNotes` is additive only: one table, two indexes, two foreign keys. No trigger, no JSON, no inline SQL.
- **Add a note.** `POST /api/v1/quote-requests/{id}/notes` with `{ text }`. The validator and the domain both check 1 to 1,000 characters after trimming ("Write a note first." / "Keep the note to 1,000 characters or fewer."). In one transaction: find (404), `AddNote` (trims, stamps who and when, moves the edit version), one `quote-request.note-added` entry with `note=<id>`, one save. A lost race at the save is read again once, then 409. The answer is the detail with the new note first.
- **Detail.** The reader runs a fourth command for the notes with each author's current name (and `formerStaff`), inside the W7 snapshot loop, so the notes and `version` come from one save. An unchanged read is now 5 commands.
- **No edit or delete of a note.** There is no such route; a route-table test checks that the only notes route is `POST api/v1/quote-requests/{id:guid}/notes`.
- **Manager delete.** `DELETE /api/v1/quote-requests/{id}?version=` under `Policies.Manager`. Version checked first (400 on `version`). In one transaction: find with photo places (404), refuse Converted (400 `quote-requests.converted-locked`, "A request that became an order can't be deleted."), compare the version (409 `quote-requests.conflict`), queue each stored public id with `ImageDeletionReason.QuoteDeleted` through `Enqueue`, tracked remove (the database cascades notes and history; EF removes the loaded photo places), one `quote-request.deleted` entry `status=contacted;photos=2`, one save. A lost race at the save is the same 409. Nothing calls the photo storage.
- **Audit catalog** 136; web labels "Quote request note added" and "Quote request deleted" under Orders.
- OpenAPI snapshot and `web/src/types/api.generated.ts` refreshed twice (Task 1 and Task 2). `docs/api/quote-requests.md` documents both calls, the add-only rule, the version effect, the delete and retention.

## TDD record

The RED outputs are xUnit MTP and vitest console text, which `gsd_run check tdd-red-evidence` does not read, so each RED was assessed by hand from the real output.

**Task 1 (tracer), notes**
- RED `6b22c353`: domain 10 of 200 failed (for example `result.IsSuccess should be True but was False`; `typeof(AuditActions).GetField("QuoteRequestNoteAdded") should not be null`; `AuditActions.All.Count should be 135`). Validator 6 of 10 failed (`result.IsValid should be False`); the 4 "accepted" cases passed, as an empty validator accepts them. Server 16 of 604 failed: the notes route did not exist, so every POST answered the fall-through status, the detail had no `notes` member (KeyNotFound), the route-table test found no notes route, and the matrix row matched no endpoint. Web 3 of 99 failed (`expected 'quote-request.note-added' to be 'Quote request note added'`, length 134 not 135). Compile-only stubs: `AddNote` returned a failure, an empty validator, and `Notes` ignored by EF so the model did not change (a first try without the ignore made the fixture fail on pending model changes, which is not valid RED; it was fixed before the commit).
- GREEN `c9d784ce`: domain 200 of 200; application quote tests 245 of 245; server QuoteRequestNoteTests, AuthorizationMatrixTests, OpenApiSnapshotTests, GetQuoteRequestTests and QuoteRequestStatusTests 628 of 629, then the one failure (the known flake below) passed alone and in a class re-run (593 of 593); infrastructure retention, reader snapshot, MigrationScriptTests, TriggerInventoryTests and MigrationTests 226 of 226; web 99 of 99. The retention cascade case was added in this commit, because it needs the table; it is a regression guard, not RED evidence.
- Tracer gate: the three Task 1 verify commands ran end to end and passed before Task 2 started.

**Task 2, delete**
- RED `37af80bf`: domain 3 of 122 failed (count 136, catalog tail, the `QuoteRequestDeleted` field). Web 3 of 100 failed. Server 12 of 604 failed: every delete answered the fall-through status, and the Admin and anonymous matrix rows failed. The Manager row passed at RED by coincidence: with no DELETE route the fall-through also answers 404.
- GREEN `82108bd0`: server DeleteQuoteRequestTests, QuoteRequestNoteTests, AuthorizationMatrixTests, OpenApiSnapshotTests, QuoteRequestStatusTests, GetQuoteRequestTests and ListQuoteRequestsTests 664 of 664; domain 201 of 201; web 100 of 100; infrastructure MigrationScriptTests, TriggerInventoryTests, MigrationTests and QuoteRequestRetentionJobTests 223 of 223, Infrastructure QuoteRequests namespace 21 of 21.

**Coverage tests** `ccf78324`: `AddQuoteRequestNoteHandlerTests` and `DeleteQuoteRequestHandlerTests` (16 tests) were written after GREEN so the Application coverage target holds; they passed on their first run, so they are not RED evidence.

No REFACTOR commit was needed.

## Final verification (quoted)

- `dotnet build Csps.slnx -warnaserror`: "Build succeeded.", "0 Warning(s)", "0 Error(s)".
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- `dotnet test --project tests/Csps.ArchitectureTests`: total 290, failed 0.
- `dotnet test --project tests/Csps.Domain.UnitTests`: total 2229, failed 0.
- `dotnet test --project tests/Csps.Application.UnitTests`: total 3454, failed 0 (before the 16 coverage tests); the new classes: total 16, failed 0.
- Server QuoteRequests and matrix set (above): total 664, failed 0. IdempotencyCoverageTests, OpenApiExposureTests, OpenApiSnapshotTests and AuthorizationCoverageTests: total 44, failed 0.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- `npm --prefix web run typecheck`: clean. `eslint --max-warnings 0` and `prettier --check` on the two audit copy files and the generated types: clean.
- Preflight ran before every LocalDB run: ports 5180, 5115, 7028 and 5199 free each time. Later runs listed only the 13-19 executor's own eslint and vitest processes in its CSPS worktree (no port, no TheBETSLLC), so the .NET runs went ahead. gitleaks (pre-commit hook) found no leaks on all five commits.
- Acceptance greps: `quote-request.note-added` in AuditActions.cs (1); `Write a note first.` in QuoteRequestRules.cs (1); `ShouldBe(136)` in AuditActionsTests.cs (1); `QuoteDeleted` in DeleteQuoteRequestHandler.cs (2); `Policies.Manager` on the delete action.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A validation error needs a field**
- **Found during:** Task 2 GREEN
- **Issue:** the first `ConvertedDeleteLocked` passed an empty field list. `Error.Validation` refuses that, so the static setup of `QuoteRequestErrors` threw and every quote call that touched it answered 500.
- **Fix:** the message is listed on `status`, the same field the status-change lock uses. Commit `82108bd0`.

**2. [Rule 1 - Bug] Test counted other tests' audit entries**
- **Found during:** Task 2 GREEN
- **Issue:** the audit log is append-only, so the class database keeps entries from earlier tests; the "nothing deleted" check counted every `quote-request.deleted` entry.
- **Fix:** the check counts this request's entries only. Commit `82108bd0`.

### Plan notes

- **Files outside files_modified:** `src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestConfiguration.cs` (the notes navigation, next to photos and history), `src/Csps.Application/Ports/IQuoteRequestReader.cs` (the note row and the view member), `src/Csps.Application/QuoteRequests/GetQuoteRequestHandler.cs` (maps the notes; `ReadAsync` is `internal` again so the note handler answers with the same mapping), `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestStaffRig.cs` (note and delete helpers), `tests/Csps.Application.UnitTests/QuoteRequests/GetQuoteRequestHandlerTests.cs` (the view's new member), `tests/Csps.Infrastructure.IntegrationTests/QuoteRequests/QuoteRequestReaderDetailSnapshotTests.cs` (an unchanged read is 5 commands, not 4), and the two handler unit test files.
- **Catalog order test:** `ThePhaseSevenCodes...ComeLast` lists the catalog tail; it was extended with the two new codes.
- **Matrix rows:** the notes row sends no body, so both roles meet 400 before the lookup, as the status row does. The delete row sends a version, so a Manager meets 404 and an Admin 403.
- **Hand-off to 13-19 (runs in parallel):** `QuoteRequestDetailResponse` now has a required `notes` array in the generated types. Any typed detail fixture in 13-19's web tests needs `notes: []` after the merge, or typecheck fails.
- **Hand-off to 13-21:** the note call answers the full detail; 13-21 already invalidates the detail query after a note, which also works if the answer is made slim (owner item 1). The delete takes `?version=` like the money transfer delete.
- **Plan commit ledger:** not written under `.git`; commits were counted from the known base, `git rev-list --count bd27b371..HEAD` = 5 before this summary.
- **Branch:** the plan text says `gsd/phase-13-quote-inquiries`; this ran on the orchestrator's worktree branch `worktree-agent-affac8ac155e31c12` as instructed. No branch was created or switched.
- `npm ci` ran in `web/` and `tools/openapi-gen/` of this worktree (locked packages only; no package added or changed).
- `docs/api/quote-requests.md` does not pass `prettier --check`; it did not before this plan either, and docs are outside the web Prettier gate.
- STATE.md, ROADMAP.md and DECISIONS.md were not touched.

## Not run here

- The full .NET suites of Server and Infrastructure, the full web suite and Playwright e2e. The orchestrator gate covers them.

## Flakes

| Seen | Test | What happened | Re-run alone |
|---|---|---|---|
| 2026-11-23, 13-18 Task 1 GREEN | `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` | one wrong status in a run of five server classes (the known flake in deferred-items.md) | alone: 1 of 1; the matrix class: 593 of 593 |

## Authentication Gates

None.

## Known Stubs

None. The RED stubs (failing `AddNote`, empty validator, EF ignore of `Notes`) were all replaced in `c9d784ce`.

## Threat Flags

None beyond the plan. T-13-52: `[Authorize(Policy = Policies.Manager)]` on the delete; matrix row Admin 403 and an integration test. T-13-53: no edit or delete route for a note, checked by a route-table test. T-13-54: the note entry holds the note id only and the delete entry holds the status and photo count only; both tests check that no name, team, phone, email, message or note text is in the detail. T-13-55: `quote-request.deleted` records the actor and the time. T-13-SC: no package added or bumped.

## Owner items

Nothing blocks. These are choices made while the owner was away. A is what was built.

1. **What the note call answers (privacy, same point as W7 IN-01).** A: the whole request with its notes, as the plan says ("200 with the detail") (built). The idempotency gate keeps that answer for 24 hours, with the visitor's name, phone, email, message, photo addresses and the note text, where the Manager delete and the 6-month purge cannot reach it. B: answer only `{ id, noteId, createdAtUtc, version }`, like the status change, and let the page read the request again (13-21 already does). Recommendation: B, for the same reason the status change was made slim.
2. **Stored answers after a Manager delete.** A: the delete removes the request's rows only; earlier stored answers of its calls stay for up to 24 hours (built). B: the delete also removes the stored answers of that request's calls. With item 1 at B and the slim status answer, nothing personal would be left in them.
3. **Notes on a Converted request.** A: staff may add notes in every status, Converted included (built). B: lock notes once the request became an order.
4. **How many notes.** A: no cap (built). B: a cap, for example 200 per request, like the 100-payment cap on orders.
5. **Delete audit detail.** A: `status=contacted;photos=2` (built). B: also the number of notes and history rows, or no detail at all.
6. **Check order on delete.** A: a Converted request is refused before the version is compared, as the plan orders it (built). B: compare the version first, so an out-of-date page always gets the 409.
7. **Wording to confirm.** "Write a note first.", "Keep the note to 1,000 characters or fewer.", "A request that became an order can't be deleted." (listed under `status`), audit labels "Quote request note added" and "Quote request deleted".
8. No package was added or changed.

## Self-Check: PASSED

- Files exist: `QuoteRequestNote.cs`, `AddQuoteRequestNoteRequest.cs`, `AddQuoteRequestNoteRequestValidator.cs`, `AddQuoteRequestNoteHandler.cs`, `DeleteQuoteRequestHandler.cs`, `QuoteRequestNoteConfiguration.cs`, `20261123212018_AddQuoteRequestNotes.cs` and its Designer file, `QuoteRequestNoteTests.cs`, `DeleteQuoteRequestTests.cs`, `AddQuoteRequestNoteRequestValidatorTests.cs`, `AddQuoteRequestNoteHandlerTests.cs`, `DeleteQuoteRequestHandlerTests.cs`.
- Commits reachable from HEAD: `6b22c353`, `c9d784ce`, `37af80bf`, `82108bd0`, `ccf78324`.

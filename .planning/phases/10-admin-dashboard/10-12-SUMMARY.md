---
phase: 10-admin-dashboard
plan: 12
subsystem: api
tags: [dotnet, csharp, ef-core, money, hand-over, audit, recipients, concurrency, lock-row, idempotency, openapi, tdd, authorization-matrix]
created: "2026-11-07T14:35:00-06:00"
updated: "2026-11-07T14:35:00-06:00"

requires:
  - phase: 10-admin-dashboard
    provides: MoneyTransfer.RecordHandover, MoneyRules hand-over messages, AuditActions.MoneyHandedOver (plan 10-03)
  - phase: 10-admin-dashboard
    provides: CreateMoneyTransferHandler shape, IStaffMoneyLock, StaffMoneyBusyException, MoneyParties.From, MoneyTransferResponse, MoneyFixtures, race tests (plan 10-10)
provides:
  - "POST /api/v1/money-transfers/handovers: a Manager moves a deactivated or deleted staff member's money to an active coworker under the staff-money lock, answered 201 with the hand-over and the leaver's new balance"
  - "One money-transfer.handed-over audit entry in the same save, with the Manager as actor and ids, amount, date and note=yes|no only"
  - "AuditChangeLines reads the from and to keys as people (plus amount and date) so the audit screen can name them"
  - "GET /api/v1/money-transfers/recipients: active Admins and Managers (locked and not-set-up included) then leavers owed money, with name, status word and isYou only, no figure"
  - "IStaffMoneyReader.ListStaffPeopleAsync and StaffPerson for the recipients list"
affects: [10-14, 10-16, 10-18, 10-20, web money panel, web transfer window]

actuals:
  tokens: 35700
  tasks: 3
  commits: 8

plan_head_before: 8f2dd1ff13f3da987476b0e1ee18d82dc4fbc15d
plan_head_after: 3634f4c48e3df20f697ce311fe9f491a6f571b5a

tech-stack:
  added: []
  patterns:
    - "A second create path copies the first one's shape: validate, then ConflictRetry around InTransactionAsync with the lock first, every read after it, the domain decides, audit.Record joins the save"
    - "The acting Manager is read again under the lock (deactivated, deleted, locked or role lost gives 401 and nothing saved), the same as the sender in plan 10-10"
    - "A race test is proved by mutation: the lock removed gives a 500, the lock moved after the reads gives two 201s; both put back before the commit"
    - "The audit log is append-only and Respawn does not clear it, so a test reads audit rows scoped by its own actor id"

key-files:
  created:
    - src/Csps.Application/Money/CreateMoneyHandoverRequest.cs
    - src/Csps.Application/Money/CreateMoneyHandoverRequestValidator.cs
    - src/Csps.Application/Money/HandOverMoneyHandler.cs
    - src/Csps.Application/Money/MoneyAuditDetail.cs
    - src/Csps.Application/Money/ListTransferRecipientsHandler.cs
    - src/Csps.Application/Money/TransferRecipientResponse.cs
    - src/Csps.Application/Money/StaffPerson.cs
    - tests/Csps.Application.UnitTests/Money/HandOverMoneyHandlerTests.cs
    - tests/Csps.Application.UnitTests/Money/ListTransferRecipientsHandlerTests.cs
    - tests/Csps.Application.UnitTests/Money/MoneyAuditDetailTests.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyHandoverEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Money/TransferRecipientsEndpointTests.cs
  modified:
    - src/Csps.Application/Money/CreateMoneyTransferRequestValidator.cs
    - src/Csps.Application/Money/MoneyErrors.cs
    - src/Csps.Application/Money/MoneyParties.cs
    - src/Csps.Application/Audit/AuditChangeLines.cs
    - src/Csps.Application/Ports/IStaffMoneyReader.cs
    - src/Csps.Infrastructure/Money/StaffMoneyReader.cs
    - src/Csps.Server/Controllers/MoneyTransfersController.cs
    - src/Csps.Server/Composition/MoneyApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Audit/AuditChangeLinesTests.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyFixtures.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyTransferConcurrencyTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/staff-money.md
    - docs/operations/audit-log.md

key-decisions:
  - "The hand-over sender is the leaver named in fromUserId; the Manager is the token's user, recorded as RecordedBy and as the audit actor, and is read again under the lock (401 and nothing saved when no longer an active, unlocked Manager)"
  - "An unknown id, the legacy holder or a non-staff account as sender gets the approved line 'Only money held by former staff can be handed over.' (nameless), and as recipient the approved nameless line 'This person can't receive transfers now. Choose someone else.'; both reuse D-58 lines and leak no name"
  - "MoneyAuditDetail.Handover delegates to a public Snapshot builder (from, to, amount, date, note=yes|no) that the later delete events can reuse; the note text is never a parameter"
  - "The recipients reader returns the people already sorted by first name, last name, id in SQL, and the handler only splits them, so the order follows the database collation exactly as the payer list does"
  - "The recipients response is a bare array of { id, name, status, isYou }, the same shape family as GET /api/v1/staff"

patterns-established:
  - "Audit change lines for a single value use From null and To the value; a person key puts the person in ToPerson"

requirements-completed: [MONEY-04, MONEY-05, MONEY-06, MONEY-08]

coverage:
  - id: D1
    description: "A Manager records a hand-over from a deactivated or deleted staff member to an active coworker: 201 with isHandover true, from the leaver, to the coworker, recordedBy the Manager and senderBalance the leaver's new balance; only the leaver's and the coworker's balances move"
    requirement: MONEY-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyHandoverEndpointTests.cs#AManagerHandsOverADeactivatedPersonsTwoThousandPesosAndOnlyThoseTwoBalancesMove"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyHandoverEndpointTests.cs#ADeletedLeaverWorksLikeADeactivatedOneAndIsMarkedFormerStaff"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only a Manager can hand over: an Admin gets 403, anonymous gets 401, and a Manager who left or lost the role after signing in gets 401 with nothing saved; the matrix row is 401/403/400"
    requirement: MONEY-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyHandoverEndpointTests.cs#AnAdminPostingTheSameBodyGets403AndNothingIsRecorded"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyHandoverEndpointTests.cs#AManagerWhoLeavesAfterSigningInCannotHandOverWithTheOldToken"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/HandOverMoneyHandlerTests.cs#AManagerWhoIsNoLongerAnActiveManagerIsRefusedUnderTheLockAndNothingIsSaved"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus (POST /api/v1/money-transfers/handovers)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every hand-over refusal answers 400 under the right field with the approved wording, including above-balance, nothing on hand, active sender, recipient equal to the leaver, a recipient who cannot receive, and an empty body listing four fields"
    requirement: MONEY-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyHandoverEndpointTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/HandOverMoneyHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two hand-overs of 1,500.00 from a leaver holding 2,000.00 released together give one 201 and one 400 'Jomar Santos only has ₱500.00 on hand.' and the leaver ends at 500.00; the class is green five runs in a row and fails with the lock removed or moved after the reads"
    requirement: MONEY-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferConcurrencyTests.cs#TwoHandoversThatTogetherExceedWhatTheLeaverHoldsGiveExactlyOneSuccess"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every hand-over writes one money-transfer.handed-over audit entry in the same save with the Manager as actor and detail from, to, amount, date, note=yes|no (never the note text); a replay with the same key writes one; the audit screen names the from and to people and marks a deleted leaver as former staff"
    requirement: MONEY-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyHandoverEndpointTests.cs#AHandOverWritesOneAuditEntryWithTheManagerAsActorAndIdsOnly"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyHandoverEndpointTests.cs#TheAuditScreenNamesTheLeaverAndTheCoworkerAndMarksADeletedLeaverFormerStaff"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Audit/AuditChangeLinesTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/MoneyAuditDetailTests.cs"
        status: pass
    human_judgment: false
  - id: D6
    description: "GET /api/v1/money-transfers/recipients answers both roles with every active Admin and Manager (locked and not-set-up included, the caller isYou) then every deactivated or deleted one owed money; Ana at 0.00, Ben holding 300.00, role-less accounts and the legacy holder never appear; sorted by first name, last name; matrix row 401/200/200"
    requirement: MONEY-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/TransferRecipientsEndpointTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/ListTransferRecipientsHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus (GET /api/v1/money-transfers/recipients)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The recipients list carries no figure for any caller: every entry has only id, name, status and isYou, no value is a number, and the body holds no balance, amount or owed word"
    requirement: MONEY-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/TransferRecipientsEndpointTests.cs#NoEntryCarriesAnyNumberOrFigure"
        status: pass
    human_judgment: false
  - id: D8
    description: "The OpenAPI snapshot, the generated web types and the idempotency and authorization coverage tests carry both new routes in step with the live document"
    requirement: MONEY-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false
  - id: D9
    description: "The wording choices this plan made where the plan was silent: the approved 'Only money held by former staff can be handed over.' also answers an unknown, legacy or non-staff sender, and the approved nameless recipient line answers an unknown, legacy or non-staff recipient"
    verification: []
    human_judgment: true
    rationale: "Wording is the owner's call (P10-BL-07). Both lines are existing D-58 sentences reused for cases the plan lists only as 'answers 400'; no new sentence was written."

duration: 62min
completed: 2026-11-07
status: complete
---

# Phase 10 Plan 12: A Manager hands over money held by a former staff member, and the transfer window knows who can receive Summary

*Created: 2026-11-07T14:35:00-06:00 · Updated: 2026-11-07T14:35:00-06:00*

**`POST /api/v1/money-transfers/handovers` lets a Manager move a leaver's money to an active coworker under the same `staff-money` lock, with the Manager read again under it and one ids-only `money-transfer.handed-over` audit entry in the same save; `GET /api/v1/money-transfers/recipients` gives both roles an exact, figure-free list of who can receive.**

## Performance

- **Duration:** about 62 min (the start time was not recorded at launch; this is estimated from the first command and the last commit)
- **Started:** about 2026-11-07T19:25:00Z
- **Completed:** 2026-11-07T20:27:00Z
- **Tasks:** 3 (one tracer, two auto), all TDD
- **Files:** 12 created, 16 modified (8 task commits, plus this SUMMARY commit)

## Accomplishments

- **Tracer.** The hand-over went through the whole stack first: request, validator, handler, audit detail, controller action, registration, matrix row, OpenAPI snapshot and web types. Its automated `<verify>` was re-run after the contract refresh (422 of 422 tests, `npm ... run check` exit 0), and it has only automated evidence, so no checkpoint was needed. Tracer verified end to end, then expanded.
- **Hand-over handler.** Lock first, then the Manager, the leaver and the coworker are read, then both sums, then `MoneyTransfer.RecordHandover` decides. The Manager is read again under the lock (WR-01 for the person doing the hand-over): deactivated, deleted, locked or no longer a Manager gives 401 "Your session ended. Sign in again." and nothing is saved. `audit.Record` joins the save, and the answer re-reads the leaver's balance.
- **Audit.** `MoneyAuditDetail.Handover` writes ids, `0.00` amount, `yyyy-MM-dd` date and `note=yes|no`; the note text is not a parameter anywhere. `AuditChangeLines` now reads `from` and `to` as people (plus the amount and date) and drops values of the wrong shape and the note flag. The audit screen test shows the deleted leaver with the former-staff mark.
- **Recipients.** One reader statement lists every Admin and Manager except the legacy holder with their flags, already sorted; the handler splits active from leavers, reads the leavers' sums in one call and keeps only those below zero. No entry has a number, and the body has no balance, amount or owed word (test).
- **Races.** Two hand-overs of 1,500.00 from a leaver holding 2,000.00 give `[201, 400]` with "Jomar Santos only has ₱500.00 on hand." and the leaver ends at 500.00. Proved by mutation (below) and green five runs in a row.
- **Docs.** `docs/api/staff-money.md` documents both routes and the refusal table; `docs/operations/audit-log.md` has a new "Phase 10 staff money events" section with the `money-transfer.handed-over` row.

## Task Commits

1. **Task 1 (tracer): a Manager hands over a deactivated person's 2,000.00** - RED `55defd18` (test), GREEN `6506b29a` (feat)
2. **Task 2: refusals, races, audit names** - RED `f25d1b7a` (test), GREEN `25bba4c3` (feat), then `38981807` (test: handler unit tests and the audit screen check)
3. **Task 3: recipients list** - RED `52654f74` (test), GREEN `881e484e` (feat), then `3634f4c4` (test: recipients handler unit tests)

**Plan metadata:** the SUMMARY commit that follows this file.

## TDD Gate Compliance

`gsd_run check tdd-red-evidence` was not run: the xunit v3 / Microsoft.Testing.Platform console output is not a report format that classifier reads (same as plans 10-02 to 10-10), so each RED was inspected by hand.

**Cycle 1, Task 1 (tracer)**

- RED `55defd18`. Command: `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MoneyHandoverEndpointTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*AuthorizationCoverageTests" --filter-class "*IdempotencyCoverageTests" --filter-class "*OpenApiSnapshotTests"`. Result: total 422, failed 9, succeeded 413, exit code 2. The failures: the four endpoint tests (`HttpStatusCode.NotFound` where `Created`, `Forbidden` or `Unauthorized` was expected), the three matrix rows, `ParallelCallersEachGetTheirOwnStatus` (404 where 401) and `DiscoveredEndpointsAreFullyCovered` ("matrix row matches no endpoint").
- Semantic assessment: seeding (payments, staff sessions, the deactivation) ran and passed before each failing call, and every failure is on the planned status code of the absent route. One test first failed by parsing an empty 404 body; it was fixed to assert the status before parsing, then re-run (4 of 4 fail on the status). No load, fixture or zero-test fault.
- GREEN `6506b29a`: same command, total 422, failed 0, succeeded 422 (after `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command, `npm --prefix tools/openapi-gen run generate`, then `run check` exit 0).

**Cycle 2, Task 2**

- RED `f25d1b7a`. Application unit tests `*MoneyAuditDetailTests` + `*AuditChangeLinesTests`: total 72, failed 3, succeeded 69. The 3 failures are the new hand-over cases in `AuditChangeLinesTests` (`AHandOverGivesTheFromAndToPeople...`, `AHandOverWithValuesOfTheWrongShape...`, `ResolveNamesTheFromAndToPeopleOfAHandOver...`): `parsed.Lines` and `lines` were empty because the action was not read.
- Semantic assessment: the three target tests ran and failed on the planned assertion for the intended reason. The other new tests pass at RED. They are characterization tests, kept because the plan's Task 2 behavior lists them: the tracer's handler already decides every refusal, the audit detail class already exists, and the race is covered by the lock the tracer already takes. After the actor-scoping fix described below, `*MoneyHandoverEndpointTests` + `*MoneyTransferConcurrencyTests` read total 30, failed 0 at RED. `AHandOverWithNothingReadableGivesNoLines` also passes at RED, because an unread action returns no lines already.
- GREEN `25bba4c3`: total 72, failed 0; server hand-over and concurrency classes total 31, failed 0.
- **Race proved by mutation** (`HandOverMoneyHandler.cs`, applied, run, reverted with `git checkout -- <file>`; the file is unchanged afterwards):
  - Lock removed: `*MoneyTransferConcurrencyTests` total 7, failed 1. `TwoHandoversThatTogetherExceed...` statuses `[Created, InternalServerError]`, expected `[Created, BadRequest]`.
  - Lock taken after the sums are read (RESEARCH Pitfall 2): total 7, failed 1. Statuses `[Created, Created]`: this is the double spend the lock exists to stop.

**Cycle 3, Task 3**

- RED `52654f74`. `*TransferRecipientsEndpointTests` + `*AuthorizationMatrixTests` + `*OpenApiSnapshotTests`: the 8 recipients tests failed (status `NotFound` where `OK` or `Unauthorized` was expected; `TheAnswerIsNeverCached` has no cache header), plus the new matrix rows. `OpenApiSnapshotTests` also failed, for the reason in Deviation 2.
- Semantic assessment: seeding of nine accounts (locked, not set up, owed, deleted, role-less, the legacy holder with the Admin role) ran before the failing call; each failure is the absent route.
- GREEN `881e484e`: `*TransferRecipientsEndpointTests` + `*AuthorizationMatrixTests` + `*AuthorizationCoverageTests` + `*IdempotencyCoverageTests` + `*OpenApiSnapshotTests`: total 429, failed 0.
- No `refactor` commit was needed.

## Verification Results (quoted from the runs)

- `dotnet build Csps.slnx`: 0 Warning(s), 0 Error(s).
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output (run mid-plan and again at the end of Task 3 with every file written).
- Server group for all three tasks (`*MoneyHandoverEndpointTests`, `*TransferRecipientsEndpointTests`, `*MoneyTransferEndpointTests`, `*MoneyTransferAttributionTests`, `*StaffMoneyBalanceTests`, `*AuthorizationMatrixTests`, `*AuthorizationCoverageTests`, `*IdempotencyCoverageTests`, `*IdempotencyTests`, `*OpenApiSnapshotTests`, `*ExpenseAuditViewerTests`, `*AuditLogEndpointTests`), final run: total 557, failed 0, succeeded 557.
- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*NoInlineSqlTests" --filter-class "*LayerTests"`: total 33, failed 0.
- Application unit tests, whole project with coverlet (`--coverlet --coverlet-output-format cobertura --coverlet-include "[Csps.Application]*"`): total 2427, failed 0. Cobertura line-rate 0.981, branch-rate 0.957 (above the 95% gate). New or changed classes: `HandOverMoneyHandler`, `ListTransferRecipientsHandler`, `MoneyAuditDetail`, `CreateMoneyHandoverRequestValidator` and `MoneyParties` at line 1 and branch 1; `AuditChangeLines` 0.9964 / 0.9175; `CreateMoneyTransferRequestValidator` 1 / 0.9285 (lambda artifacts).
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- **Hand-over race class, five runs in a row** (`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MoneyTransferConcurrencyTests"`; each race test loops three rounds with fresh people):
  - Run 1: total 7, failed 0, succeeded 7
  - Run 2: total 7, failed 0, succeeded 7
  - Run 3: total 7, failed 0, succeeded 7
  - Run 4: total 7, failed 0, succeeded 7
  - Run 5: total 7, failed 0, succeeded 7
- Acceptance greps: `Policies.Manager` in the controller 1; `AuditActions.MoneyHandedOver` in the handler 1; `"/api/v1/money-transfers/handovers"` in the matrix 1; `string? note` in non-comment lines of `MoneyAuditDetail.cs` 0; `FromField` 4 and `ToField` 4 in `AuditChangeLines.cs`; `money-transfer.handed-over` in `audit-log.md` 1; test names with "Handover" in the concurrency class 6; `ListTransferRecipients` in the OpenAPI snapshot 1; `decimal|balance` in non-comment lines of `TransferRecipientResponse.cs` 0; `handovers` 2 and `recipients` 3 in `staff-money.md`. Key links: `moneyLock.LockAsync` is the first statement of the attempt, `MoneyTransfer.RecordHandover` is called by the handler.
- No em or en dash in any line this plan added (byte-level grep of every staged diff). `gitleaks protect --staged --no-banner` ran before each of the 8 commits: no leaks found. Test people are made-up names (Carmen Reyes, Liza Mercado, Paolo Garcia, Jomar Santos, Ana Abad, Ben Lim, Rico Dela Cruz).
- Not run, as instructed: the whole Server and Infrastructure suites and `ExpenseListTimingTests`. No flake was seen in any run of this plan. One test command ran longer than three minutes while another executor was working on the machine; it finished normally.

## Decisions Made

- The nameless lines for senders and recipients who are not staff (see key-decisions and coverage D9). This is the safer reading, and it adds no new sentence.
- `MoneyParties.FromPerson` is a separately named method, because a second `From` overload made the existing `MoneyParties.From(null, 0m)` calls ambiguous.
- The recipients reader sorts in SQL. The handler never re-sorts, so the order matches the payer list.
- The audit entry's "Done to" column stays empty for a hand-over (no `PayerId` is set in the parsed changes). The plan names only the from and to people. Plan 10-20 can decide whether the coworker should read there.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan staging] Task 2 tests are mostly characterization tests; its real RED is the audit-name tests**
- **Found during:** Task 2 design
- **Issue:** The plan builds the whole handler in the tracer, so the refusal tests, the Manager re-check, the replay test and the race tests pass the moment they are written (fail-fast rule: an unexpected green in RED).
- **Fix:** The only code Task 2 needs is `AuditChangeLines`, so its three tests are the RED. The rest are committed in the same RED commit, and the race is proved by two mutations of the handler (above).
- **Committed in:** `f25d1b7a` (RED), `25bba4c3` (GREEN)

**2. [Rule 1 - Bug] The Task 2 GREEN commit left the OpenAPI snapshot stale for one commit**
- **Found during:** Task 3 RED run
- **Issue:** Task 2 reworded two XML doc lines on `AuditChangeLine` (`Field` and `ToPerson`). Those texts are descriptions in the OpenAPI document, so `OpenApiSnapshotTests.CommittedSnapshotMatchesTheLiveDocument` failed from `25bba4c3` until the next refresh. I did not run the snapshot test after Task 2.
- **Fix:** The Task 3 contract refresh (`881e484e`) regenerated the snapshot and the web types, which now carry both the audit doc change and the recipients route. The serial contract rule is kept (one rewriter, this plan). The commit message says so.
- **Files modified:** `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts`
- **Verification:** `*OpenApiSnapshotTests` green and `npm ... run check` exit 0 at `881e484e`.
- **Committed in:** `881e484e`

**3. [Rule 3 - Blocking] The audit log is not reset between tests**
- **Found during:** Task 2 RED run (12 of 30 failed)
- **Issue:** `ReadAuditAsync(database, action)` returned entries from earlier tests, because the audit table is append-only and Respawn does not clear it.
- **Fix:** `MoneyFixtures.ReadAuditAsync` takes the actor id, and every test scopes by its own Manager (ids are fresh per test).
- **Files modified:** `tests/Csps.Server.IntegrationTests/Money/MoneyFixtures.cs`, `MoneyHandoverEndpointTests.cs`, `MoneyTransferConcurrencyTests.cs`
- **Committed in:** `f25d1b7a`

**4. [Rule 2 - Missing critical] Handler unit tests and one new file outside the plan's file list**
- **Found during:** Task 2 and Task 3 verification
- **Issue:** The project holds Application at 95% or more, and plan 10-10 added handler unit tests for the same reason. The plan lists no unit test for `HandOverMoneyHandler` or `ListTransferRecipientsHandler`, and no file for `StaffPerson`.
- **Fix:** Added `HandOverMoneyHandlerTests` (24 tests), `ListTransferRecipientsHandlerTests` (6 tests) and `src/Csps.Application/Money/StaffPerson.cs` (the plan names the type but not its file).
- **Committed in:** `38981807`, `3634f4c4`, `881e484e`

**5. [Plan wording] Fixture helper names**
- **Issue:** The plan names `MoneyFixtures.DeactivateAsync` and `DeleteStaffAsync`; the fixtures already had `DeactivateAccountAsync` and `DeleteAccountAsync` from plan 10-08.
- **Fix:** Reused the existing helpers. Added `PostHandoverAsync`, `HandoverBody`, `GetRecipientsAsync`, `AddRoleAsync`, `ReadAuditAsync` and `ReadBalanceByIdAsync`.

**6. [Refactor] The date check is shared**
- **Issue:** The hand-over validator needs the transfer validator's date rule.
- **Fix:** `CreateMoneyTransferRequestValidator.CheckDate` became `internal static CheckDate<T>`, used by both validators. No behavior change; the 10-10 tests still pass.

**7. [Dispatch] Worktree instead of the main checkout**
- **Issue:** The plan's executor rules say to work in the main checkout on `gsd/phase-10-admin-dashboard`. This run was dispatched into a worktree on `worktree-agent-a90b4a57b2da629c5` with the orchestrator owning merges.
- **Fix:** Followed the dispatch (worktree, no push, no merge, no STATE.md or ROADMAP.md edits). Package folders `web/node_modules` and `tools/openapi-gen/node_modules` were linked to the main checkout's copies for the contract commands and removed afterwards.

---

**Total deviations:** 7 (1 plan staging, 1 bug found late, 1 blocking test fixture fact, 1 missing coverage, 1 name, 1 refactor, 1 dispatch). **Impact on plan:** None changes behavior the plan defined. No package, no schema change, no inline SQL, no trigger, no new lock row.

## Issues Encountered

- The harness refused compound shell commands (loops, `cd` plus sed) in the worktree, so commands were run plain from the worktree root, and the five race runs were five separate commands.
- A first wait loop I wrote for a background command watched for text my own `grep | head` filter had cut off. It ended when I appended a marker to its output file; no shell was left running.

## Open Questions for the Owner

- **Wording (D9).** Please confirm that the approved sentence "Only money held by former staff can be handed over." also answers a sender who is an unknown id, the legacy placeholder or a non-staff account, and that the approved nameless sentence "This person can't receive transfers now. Choose someone else." answers an unknown, legacy or non-staff hand-over recipient. No new sentence was written. (Parked item P10-BL-07 covers money wording.)
- **Audit "Done to".** The audit screen will show the leaver and the coworker as named lines, but its "Done to" column is empty for a hand-over. Plan 10-20 owns the audit labels and can decide whether it should show the coworker.
- **Still open from 10-08 and 10-10.** `MoneyErrors.NotFound` and `MoneyErrors.Forbidden` are still placeholders; this plan returns neither. Plans 10-14, 10-16 and 10-18 may.

## Known Stubs

None. No placeholder, empty data source or TODO was left in the files of this plan.

## Threat Flags

None beyond the plan's threat model.

- T-10-23 mitigated: `Policies.Manager` on the action; matrix row 401/403/400; the domain refuses an active sender; the Manager is read again under the lock.
- T-10-24 mitigated: `money-transfer.handed-over` is written in the same save with the Manager as actor (test reads actor, target, detail).
- T-10-25 mitigated: the lock is the first statement; the race test is green five runs in a row and fails under both mutations.
- T-10-26 mitigated: the recipients body has no number-valued field and no balance, amount or owed word (test); the audit detail is ids plus `note=yes|no` and a test pins that the note text is absent.
- T-10-SC: no package was added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 10-14 and later can reuse `MoneyAuditDetail.Snapshot` for the delete events, `StaffPerson` and `ListStaffPeopleAsync` for any Manager roster of leavers, and the actor-scoped `ReadAuditAsync` fixture. The web transfer window (a later plan) can call `GET /money-transfers/recipients` and `POST /money-transfers/handovers`; the contract files already carry both. The serial contract-file order continues with the next plan after 10-12. Production needs no new migration from this plan. No blockers.

## Self-Check: PASSED

- FOUND: all 12 files listed in `key-files.created` exist on disk.
- FOUND: commits `55defd18`, `6506b29a`, `f25d1b7a`, `25bba4c3`, `38981807`, `52654f74`, `881e484e`, `3634f4c4` on this branch (`git merge-base --is-ancestor` for each); measured `git rev-list --count 8f2dd1ff..HEAD` = 8 before this SUMMARY commit.
- STATE.md and ROADMAP.md were not modified.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-07*

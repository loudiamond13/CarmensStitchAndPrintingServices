---
phase: 10-admin-dashboard
plan: 10
subsystem: api
tags: [dotnet, csharp, ef-core, money, transfer, concurrency, lock-row, idempotency, openapi, tdd, authorization-matrix]
created: "2026-11-07T09:55:00-06:00"
updated: "2026-11-07T09:55:00-06:00"

requires:
  - phase: 10-admin-dashboard
    provides: MoneyTransfer.Record, MoneyParty, MoneyRules (plan 10-03)
  - phase: 10-admin-dashboard
    provides: MoneyTransfers table, staff-money lock row, IStaffMoneyReader, MoneyErrors, MoneyFixtures (plan 10-08)
provides:
  - "POST /api/v1/money-transfers: a staff member sends money on hand to a coworker, answered 201 with the saved transfer and the sender's new balance only"
  - "The staff-money lock port and adapter (IStaffMoneyLock, StaffMoneyLock, StaffMoneyBusyException) for this plan and the hand-over plan"
  - "IMoneyTransfers store port (Add, FindAsync, Remove) and MoneyTransferStore for the delete plans"
  - "MoneyParties.From: the D-56 recipient status rule, and MoneyTransferResponse / MoneyTransferSavedResponse"
  - "Race tests that prove a transfer never overdraws (two transfers, transfer vs expense, two transfers into a leaver)"
affects: [10-12, 10-14, 10-16, 10-18, web money panel]

actuals:
  tokens: 24900
  tasks: 3
  commits: 6

plan_head_before: 06efa0dca651f10b91282554ef4289e5a803e507
plan_head_after: 6d6f105dd383f995a4e9e62d9ed5a59194d028ad

tech-stack:
  added: []
  patterns:
    - "Lock row first inside the transaction, then every read, then the domain decides (RESEARCH Pattern 4): the lock is the ExecuteUpdate on the standing staff-money row, no inline SQL"
    - "ConflictRetry plus InTransactionAsync joins the idempotency gate's outer transaction with a savepoint; a lock timeout is a typed StaffMoneyBusyException mapped to the 409"
    - "A recipient with no staff meaning (no account, the legacy holder, no Admin or Manager role) gets one nameless line, so no non-staff name leaks"

key-files:
  created:
    - src/Csps.Application/Money/CreateMoneyTransferRequest.cs
    - src/Csps.Application/Money/CreateMoneyTransferRequestValidator.cs
    - src/Csps.Application/Money/CreateMoneyTransferHandler.cs
    - src/Csps.Application/Money/MoneyTransferResponse.cs
    - src/Csps.Application/Money/MoneyParties.cs
    - src/Csps.Application/Ports/IMoneyTransfers.cs
    - src/Csps.Application/Ports/IStaffMoneyLock.cs
    - src/Csps.Application/Ports/StaffMoneyBusyException.cs
    - src/Csps.Infrastructure/Money/MoneyTransferStore.cs
    - src/Csps.Infrastructure/Money/StaffMoneyLock.cs
    - src/Csps.Server/Controllers/MoneyTransfersController.cs
    - tests/Csps.Application.UnitTests/Money/MoneyPartiesTests.cs
    - tests/Csps.Application.UnitTests/Money/CreateMoneyTransferRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/Money/CreateMoneyTransferHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyTransferEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyTransferAttributionTests.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyTransferConcurrencyTests.cs
  modified:
    - src/Csps.Application/Money/MoneyErrors.cs
    - src/Csps.Infrastructure/Money/MoneyRegistration.cs
    - src/Csps.Server/Composition/MoneyApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyFixtures.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/staff-money.md

key-decisions:
  - "The lock is the first statement in the attempt; both StaffStates and both sums are read after it, and the sender's balance in the answer is re-read after the save"
  - "A recipient who is not staff (no account, the legacy holder, no Admin or Manager role) is refused with the nameless unknown-recipient line, not the named line, so the answer never shows a non-staff account's name"
  - "The 201 has no Location header, because there is no single-transfer read route; a test pins it"
  - "The response factory is MoneyTransferResponse.Of, because the record's own From property would clash with a method named From"

patterns-established:
  - "A race test is proved by mutation: the lock removed gives a 500, the lock moved after the reads gives two 201s; both put back before the commit"

requirements-completed: [MONEY-04, MONEY-05, MONEY-08]

coverage:
  - id: D1
    description: "POST /api/v1/money-transfers records a transfer from the signed-in user (Admin or Manager), answers 201 with the transfer and senderBalance, moves both balances exactly, and carries no recipient balance"
    requirement: MONEY-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferEndpointTests.cs#AManagerSendsTwoThousandPesosAndBothBalancesMoveByExactlyThatAmount"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferEndpointTests.cs#TheAnswerCarriesTheSendersBalanceOnlyAndNeverTheRecipientsFigure"
        status: pass
    human_judgment: false
  - id: D2
    description: "The sender comes from the token only; a forged fromUserId, createdById, createdAtUtc, updatedById and updatedAtUtc in the body are ignored and the stamps come from the token and the clock"
    requirement: MONEY-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferAttributionTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every field and balance refusal answers 400 with the UI-SPEC message under its field, including the Manager and Admin leaver caps, and an empty body lists the three required fields together"
    requirement: MONEY-04
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/CreateMoneyTransferRequestValidatorTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferEndpointTests.cs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Recipient rules: Manager-locked and not-yet-set-up active staff can receive (D-56); deactivated or deleted staff at or above 0.00, the legacy holder, role-less accounts and unknown ids are refused under toUserId"
    requirement: MONEY-05
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/MoneyPartiesTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferEndpointTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "The same Idempotency-Key and body twice record one transfer and replay the stored 201; the same key with another body answers 422; IdempotencyCoverageTests discovers the new POST"
    requirement: MONEY-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferEndpointTests.cs#TheSameKeyAndBodyTwiceRecordsOneTransferAndReplaysTheStored201"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyCoverageTests.cs"
        status: pass
    human_judgment: false
  - id: D6
    description: "Two concurrent transfers, a transfer racing an expense and two transfers into a leaver never overdraw; the concurrency class is green five runs in a row"
    requirement: MONEY-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferConcurrencyTests.cs"
        status: pass
    human_judgment: false
  - id: D7
    description: "Matrix row POST /api/v1/money-transfers is 401/400/400, and the OpenAPI snapshot and generated web types carry CreateMoneyTransfer in step with the live document"
    requirement: MONEY-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus (POST /api/v1/money-transfers)"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false
  - id: D8
    description: "The wording of two refusals the plan leaves open: the nameless unknown-recipient line used for the legacy holder and a role-less account, and the placeholder NotFound and Forbidden texts in MoneyErrors that no route returns yet"
    verification: []
    human_judgment: true
    rationale: "Wording is the owner's call. The unknown-recipient line is the D-58 approved sentence; using it for the legacy holder and role-less accounts is this plan's reading, and the two MoneyErrors placeholders are still unchanged from 10-08."

duration: 50min
completed: 2026-11-07
status: complete
---

# Phase 10 Plan 10: A staff member transfers money to a coworker, and two transfers can never overdraw Summary

*Created: 2026-11-07T09:55:00-06:00 · Updated: 2026-11-07T09:55:00-06:00*

**`POST /api/v1/money-transfers` records a transfer from the signed-in user under the `staff-money` lock row (lock first, then every read, then the domain decides), idempotent and stamped from the token, and three race tests, proved by mutation, show two transfers can never spend the same money twice.**

## Performance

- **Duration:** about 50 min
- **Started:** 2026-11-07T09:03:00-06:00
- **Completed:** 2026-11-07T09:53:00-06:00
- **Tasks:** 3 (one tracer, two auto), all TDD
- **Files:** 17 created, 8 modified (6 task commits, plus this SUMMARY commit)

## Accomplishments

- The tracer went through the whole stack first: request, validator, handler, response, recipient mapping, ports, store, lock adapter, controller, registrations, matrix row, OpenAPI snapshot and web types. Its automated `<verify>` was re-run after the contract refresh (419 of 419 tests, `npm ... run check` exit 0). The tracer has only automated evidence, so no checkpoint was needed. Tracer verified end to end, then expanded.
- The handler takes the staff-money lock as the first statement of the attempt, reads both people and both sums only after it, lets `MoneyTransfer.Record` decide every rule, saves, and re-reads the sender's balance for the answer. The answer is `{ transfer, senderBalance }`; the recipient's balance is never in it (a test pins the exact property names and scans for the recipient's figure).
- Recipient rules follow D-56, not the payer rule: `StaffState.CanPay` is not used. Manager-locked and not-yet-set-up active staff receive. A deactivated or deleted person can receive only while owed money, capped at what brings them to 0.00 (a Manager reads the figure, an Admin reads "ask a Manager" and the body has no "500.00").
- Idempotency (SEC-06) and stamps (SEC-08) work as for every other create: the same key and body replays one stored 201, another body is 422, forged sender and stamps in the body are ignored.
- The three races and a double-click are green five runs in a row, and they are real tests: with the lock removed the two main races return a 500, and with the lock moved after the reads they return two 201s.
- `docs/api/staff-money.md` documents the route, the body, who can receive, every refusal message, idempotency and the lock (D-53).

## Task Commits

1. **Task 1 (tracer): send 2,000.00 to a coworker, balances move by it** - RED `9c5d1bc5` (test), GREEN `0eb5a239` (feat)
2. **Task 2: refusals, recipient rules, replays, forged stamps** - RED `7f66a0bc` (test), GREEN `66c6717c` (feat)
3. **Task 3: concurrent transfers and a transfer racing an expense** - `e1ab9c62` (test; no feat commit, see TDD Gate Compliance), plus `6d6f105d` (test: handler unit tests)

**Plan metadata:** the SUMMARY commit that follows this file.

## TDD Gate Compliance

`gsd_run check tdd-red-evidence` was not run: the xunit v3 / Microsoft.Testing.Platform console output is not a report format that classifier reads (same as plans 10-02 to 10-08), so each RED was inspected by hand.

**Cycle 1, Task 1 (tracer)**

- RED `9c5d1bc5`. Command: `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MoneyTransferEndpointTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*AuthorizationCoverageTests" --filter-class "*IdempotencyCoverageTests" --filter-class "*OpenApiSnapshotTests"`. Result: total 419, failed 9, succeeded 410, exit code 2. The failures: the four endpoint tests (404 where 201 or 401 was expected), the three matrix rows (404 where 401/400/400 was expected), `DiscoveredEndpointsAreFullyCovered` ("matrix row matches no endpoint") and `ParallelCallersEachGetTheirOwnStatus`.
- Semantic assessment: the seeding (payments, staff sessions) ran and passed before each failing call, so the target tests ran and failed on the planned status code; no load, fixture or zero-test fault.
- GREEN `0eb5a239`: same command, total 419, failed 0, succeeded 419 (after `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command, `npm --prefix tools/openapi-gen run generate`, then `run check` exit 0).

**Cycle 2, Task 2**

- RED `7f66a0bc`. Application unit tests `*MoneyPartiesTests` + `*CreateMoneyTransferRequestValidatorTests`: total 41, failed 11, succeeded 30. The 11 failures: the legacy holder, a role-less account (3 role values) and a former staff member with no role are not mapped to NotStaff; three decimal amounts (10.005, 0.001, 99.999) are not refused; tomorrow is not refused; a 201-character note is not refused; the validator does not need the business today. Server `*MoneyTransferEndpointTests` + `*MoneyTransferAttributionTests` + `*IdempotencyTests`: total 66, failed 1, succeeded 65. The one failure is `AnUnknownIdTheLegacyHolderAndAnAccountWithNoStaffRoleAreAllRefusedWithTheUnknownRecipientLine`: expected "This person can't receive transfers now. Choose someone else." under toUserId, got "Legacy / unassigned can't receive transfers now. Choose someone else." (the legacy holder's name leaked).
- Semantic assessment: all failing tests ran and failed on the planned assertion for the intended reason. The other new tests (balance and recipient refusals, owed caps, past date, empty body, replay, 422, forged stamps) passed at RED. They are characterization tests: the domain already decides those rules and the tracer already ignores unknown body members, so they pin behavior that holds. They are kept because the plan's Task 2 behavior lists them.
- GREEN `66c6717c`: unit tests total 41, failed 0; server tests total 66, failed 0.

**Cycle 3, Task 3 (no RED/GREEN pair)**

- The lock is part of the tracer on purpose (the tracer's acceptance checks require `moneyLock.LockAsync` before the first `GetSumsAsync`), so the race tests pass as soon as they are written. They are characterization tests. To prove they would catch a defect, two mutations were applied to `CreateMoneyTransferHandler.cs`, run, and reverted (`git diff` is empty for the handler afterwards):
  - Lock removed: `*MoneyTransferConcurrencyTests` total 4, failed 2. Two transfers and Leaver: statuses `[Created, InternalServerError]`, expected `[Created, BadRequest]`.
  - Lock taken after the sums are read (RESEARCH Pitfall 2): total 4, failed 2. Statuses `[Created, Created]`, expected `[Created, BadRequest]`. This is the double spend the lock exists to stop.
  - The expense race and the double-click test pass under both mutations by design: the expense race allows both serial outcomes (D-53), and the double-click is guarded by the idempotency gate.
- No `refactor` commit was needed.

## Verification Results (quoted from the runs)

- `dotnet build Csps.slnx`: 0 Warning(s), 0 Error(s).
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output (run before each commit and at the end).
- Task 1/2/3 server group together (`*MoneyTransferEndpointTests`, `*MoneyTransferAttributionTests`, `*MoneyTransferConcurrencyTests`, `*StaffMoneyBalanceTests`, `*AuthorizationMatrixTests`, `*AuthorizationCoverageTests`, `*IdempotencyCoverageTests`, `*IdempotencyTests`, `*OpenApiSnapshotTests`), final run: total 495, failed 0, succeeded 495.
- Application unit tests: `*MoneyPartiesTests` + `*CreateMoneyTransferRequestValidatorTests` total 41, failed 0 at GREEN; `*CreateMoneyTransferHandlerTests` total 17, failed 0.
- Application unit tests, whole project with coverlet (`--coverlet --coverlet-output-format cobertura --coverlet-include "[Csps.Application]*"`): total 2380, failed 0. Cobertura line-rate 0.9807, branch-rate 0.9572 (above the 95% gate). Every new class is at 100% lines: `CreateMoneyTransferHandler`, `MoneyParties`, `MoneyTransferResponse`, `StaffMoneyBusyException`, `CreateMoneyTransferRequestValidator` (branch 0.9286, lambda artifacts).
- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*NoInlineSqlTests" --filter-class "*LayerTests"`: total 33, failed 0.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." `npm --prefix web run typecheck`: clean.
- **Concurrency class, five runs in a row** (`dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MoneyTransferConcurrencyTests"`; each test loops three rounds with fresh people):
  - Run 1: total 4, failed 0, succeeded 4
  - Run 2: total 4, failed 0, succeeded 4
  - Run 3: total 4, failed 0, succeeded 4
  - Run 4: total 4, failed 0, succeeded 4
  - Run 5: total 4, failed 0, succeeded 4
- Acceptance greps: `moneyLock.LockAsync` at line 73 of the handler and the first `GetSumsAsync` at line 83 (lock is first); `DatabaseLocks.StaffMoney` in `StaffMoneyLock.cs` 1; `fromUserId` in non-comment lines of the request 0; `CanPay` in the handler 0; `CreateMoneyTransfer` in the OpenAPI snapshot 5; `IStaffMoneyLock` outside the handler and its port 0 (no expense, payment or refund handler takes the lock); `POST /api/v1/money-transfers` in the doc 1; test names contain "Locked", "NotSetUp", "Admin"+"Owed", "TwoTransfers", "Expense" and "Leaver".
- No em or en dash in any file this plan wrote (byte-level grep). `gitleaks protect --staged --no-banner` ran before each of the 6 task commits (and the commit hook ran it again): no leaks found. Test people are made-up names (Carmen Reyes, Liza Mercado, Paolo Garcia, Jomar Santos, Ana Abad).
- Not run, as instructed: the whole Server and Infrastructure suites and `ExpenseListTimingTests`. No flake was seen in any run of this plan.

## Decisions Made

- The non-staff recipient line. For the legacy holder and an account with no Admin or Manager role, the handler answers the nameless line "This person can't receive transfers now. Choose someone else." (the D-58 approved sentence) instead of the named line, so the answer never shows a non-staff account's name. The plan names the unknown id for this line and the named line for a deactivated person; it lists the legacy holder and non-staff accounts only as "answers 400 under toUserId". This is the safer reading; see Open Questions.
- `MoneyParties.From` returns an empty id for no account, and the handler checks `NotStaff` before calling `Record`, so the domain's "Choose who got the cash." is only for a missing id in the body.
- The answer uses `ActorRef.FormerStaff = IsDeleted` for the recipient, the same meaning as everywhere else in the API.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan staging] The tracer left out the legacy-holder/role mapping and three validator rules; Task 2 adds them**
- **Found during:** Task 1 design
- **Issue:** The plan builds the whole mapping and validator in the tracer, which would leave Task 2's tests with nothing that fails first (fail-fast rule: an unexpected green in RED).
- **Fix:** The tracer's `MoneyParties.From` maps null, deleted, deactivated and active only, and its validator has the required, positive and real-date rules only. Task 2's RED tests fail on the legacy holder, role-less accounts, extra decimals, a future date, a long note and the missing business today; the GREEN adds them. The gap existed only between two commits of this plan; no caller could use the route in between.
- **Files modified:** `src/Csps.Application/Money/MoneyParties.cs`, `src/Csps.Application/Money/CreateMoneyTransferRequestValidator.cs`
- **Committed in:** `7f66a0bc` (RED), `66c6717c` (GREEN)

**2. [Plan staging] Task 3 has tests only, with mutation evidence instead of a RED commit**
- **Found during:** Task 3
- **Issue:** The lock is part of the tracer (its acceptance checks require it), so the race tests cannot fail first.
- **Fix:** The tests are committed as `test(10-10)`, and two mutations of the handler (lock removed, lock after the reads) were run to show the tests fail, then reverted. Details above.
- **Committed in:** `e1ab9c62`

**3. [Rule 2 - Missing critical] Application unit tests for the handler, response and busy exception**
- **Found during:** Task 3 verification
- **Issue:** The first coverage run showed `CreateMoneyTransferHandler`, `MoneyTransferResponse` and `StaffMoneyBusyException` at 0% in the Application unit tests (they were only exercised by the integration tests). The project holds Application at 95% or more and plan 10-08 left every new class at 100%.
- **Fix:** Added `CreateMoneyTransferHandlerTests` (17 tests: lock order, success, every refusal path, retry and busy) and one validator test. Not in the plan's file list.
- **Files modified:** `tests/Csps.Application.UnitTests/Money/CreateMoneyTransferHandlerTests.cs`, `tests/Csps.Application.UnitTests/Money/CreateMoneyTransferRequestValidatorTests.cs`
- **Committed in:** `6d6f105d`

**4. [Rule 3 - Blocking] Response factory named `Of`, not `From`**
- **Found during:** Task 1 GREEN build
- **Issue:** `MoneyTransferResponse` has a `From` property (the sender), so a static factory named `From` is error CS0102.
- **Fix:** The factory is `MoneyTransferResponse.Of(...)`.
- **Committed in:** `0eb5a239`

---

**Total deviations:** 4 (2 plan staging, 1 missing coverage, 1 blocking name clash).
**Impact on plan:** None changes behavior the plan defined. No scope creep, no package, no schema change, no inline SQL, no trigger.

## Issues Encountered

- The harness refused compound shell commands that mix `cd`, loops or variables with git in a worktree, so commands were run plain from the worktree root. No effect on the work.
- Mutation A (lock removed) produced a 500 on the losing request, not a 400. That is the unprotected path failing loudly (the read-then-insert race hits a database error). It is only a test of the test; the production handler has the lock.
- The first `dotnet test` of the coverage run did not write a report until `--results-directory` was given; the reports were written to the session scratchpad, not the repo.

## Open Questions for the Owner

- **Wording (D8 above).** Please confirm the nameless line "This person can't receive transfers now. Choose someone else." (D-58) for the legacy placeholder and for an account with no Admin or Manager role. The alternative is the named line ("{name} can't receive transfers now..."), which would show the placeholder's name "Legacy / unassigned" to a user.
- **Still open from 10-08.** `MoneyErrors.NotFound` ("This person was not found.") and `MoneyErrors.Forbidden` ("You can't do this.") are still placeholders. This plan returns neither, so they remain for the plans that do (10-12, 10-14, 10-16).

## Known Stubs

None. No placeholder, empty data source or TODO was left in the files of this plan. `IMoneyTransfers.FindAsync` and `Remove` are public port members with no handler yet; the delete plans use them. They are implemented, not stubbed.

## Threat Flags

None beyond the plan's threat model.

- T-10-16 mitigated: the request has no sender field; the sender is `requestContext.UserId`; the attribution test forges `fromUserId` and the stored sender is the token's user.
- T-10-17 mitigated: the staff-money lock is the first statement; three race tests run five times in a row and fail under both mutations.
- T-10-18 mitigated: same key and body replays the stored 201 (a test pins the `Idempotent-Replayed` header), another body is 422, `IdempotencyCoverageTests` discovers the POST.
- T-10-19 mitigated: the answer carries the sender's balance only; the Admin leaver refusal has no figure and a test scans the Admin body for "500.00"; the non-staff line carries no name.
- T-10-20 mitigated: stamps come from the token and the clock; the attribution test forges them.
- T-10-SC: no package was added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 10-12 (hand-over and recipients) can reuse `IStaffMoneyLock`, `StaffMoneyBusyException`, `MoneyParties.From`, `IMoneyTransfers` and `MoneyTransferResponse`; hand-over is the only other path that takes the lock (the Task 3 acceptance grep already allows `HandOverMoneyHandler.cs`). The serial contract-file order continues with the next plan after 10-10. Production needs the reviewed idempotent script for `AddMoneyTransfers` from the package step; nothing migrates at startup. No blockers.

## Self-Check: PASSED

- FOUND: all 17 files listed in `key-files.created` exist on disk.
- FOUND: commits `9c5d1bc5`, `0eb5a239`, `7f66a0bc`, `66c6717c`, `e1ab9c62`, `6d6f105d` on this branch (`git merge-base --is-ancestor` for each); measured `git rev-list --count 06efa0dc..HEAD` = 6 before this SUMMARY commit.
- STATE.md and ROADMAP.md were not modified.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-07*

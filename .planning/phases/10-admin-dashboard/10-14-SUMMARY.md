---
phase: 10-admin-dashboard
plan: 14
subsystem: api
tags: [dotnet, csharp, ef-core, money, ledger, running-balance, serializable-transaction, paging, openapi, tdd, authorization-matrix]
created: "2026-11-07T18:50:00-06:00"
updated: "2026-11-07T18:50:00-06:00"

requires:
  - phase: 10-admin-dashboard
    provides: StaffLedgerQuery union of payments, refunds, company expenses and order expenses; LedgerEntryKind (plan 10-01)
  - phase: 10-admin-dashboard
    provides: MoneyTransfer table and entity, StaffMoneyReader sums, MoneyFixtures, MoneySeeding, the Manager hand-over (plans 10-08 to 10-12)
provides:
  - "GET /api/v1/staff-money/me/ledger: the caller's own money rows newest first, server-paged, each with its details and the running balance after it"
  - "StaffLedgerQuery.For(context, userId, includeDeletedTransfers): transfers in (kind 3) and out (kind 4) join the union; a deleted transfer is Signed 0 with the deleted mark and appears only when asked"
  - "IStaffMoneyReader.GetLedgerPageAsync: page, total, newer-rows sum and balance read inside one serializable read transaction (D-105), plus one detail read per source table on the page"
  - "LedgerRunningBalance.Apply: the pure walk-down of balances, null for a deleted row"
  - "Manager-only deleted view: an Admin who sends deleted=true gets 403 before any read; an Admin ledger never holds a deleted transfer"
affects: [10-16 ledger of another person, 10-17 ledger screen, 10-18 transfer delete and remove, 10-20 audit labels]

actuals:
  tokens: 26473
  tasks: 3
  commits: 7
plan_head_before: 16ed49926be311a732d1d671fa846322bf5c36ff
plan_head_after: e5de79bc47a44864c363a3a8f4d3f105dc51998e

tech-stack:
  added: []
  patterns:
    - "A multi-read page opens its own serializable transaction (EF Core BeginTransactionAsync with IsolationLevel.Serializable) unless the caller already has one open; no inline SQL and no database option change"
    - "Row text is joined after the union, one untracked read per source table on the page; transfers in and out share one read, so a page costs at most five detail reads at any page size"
    - "A concurrency test starts a write on a second connection from a DbCommandInterceptor right after the first read, gives it two seconds, and asserts the read still agrees with itself"

key-files:
  created:
    - src/Csps.Application/Money/GetLedgerHandler.cs
    - src/Csps.Application/Money/GetLedgerRequest.cs
    - src/Csps.Application/Money/GetLedgerRequestValidator.cs
    - src/Csps.Application/Money/LedgerPage.cs
    - src/Csps.Application/Money/LedgerPageResponse.cs
    - src/Csps.Application/Money/LedgerRowView.cs
    - src/Csps.Application/Money/LedgerRunningBalance.cs
    - src/Csps.Infrastructure/Money/StaffLedgerDetails.cs
    - tests/Csps.Application.UnitTests/Money/GetLedgerHandlerTests.cs
    - tests/Csps.Application.UnitTests/Money/LedgerRunningBalanceTests.cs
    - tests/Csps.Server.IntegrationTests/Money/StaffLedgerEndpointTests.cs
  modified:
    - src/Csps.Application/Money/MoneyErrors.cs
    - src/Csps.Application/Ports/IStaffMoneyReader.cs
    - src/Csps.Infrastructure/Money/StaffLedgerQuery.cs
    - src/Csps.Infrastructure/Money/StaffLedgerRow.cs
    - src/Csps.Infrastructure/Money/StaffMoneyReader.cs
    - src/Csps.Server/Composition/MoneyApplicationRegistration.cs
    - src/Csps.Server/Controllers/StaffMoneyController.cs
    - tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyFixtures.cs
    - tests/Csps.Testing/OrderSeeding.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/staff-money.md

key-decisions:
  - "D-105 is met inside the reader: GetLedgerPageAsync returns LedgerPage(Rows, Total, NewerSum, Balance), and the four reads run in one serializable transaction opened with EF Core's transaction API. The handler no longer calls GetSumsAsync for the ledger."
  - "A deleted transfer shows its face amount in moneyIn or moneyOut (by direction) with balanceAfter null. The plan did not say what a deleted row's amounts are; the union row stays Signed 0 so no balance moves."
  - "LedgerRowView names its signed amount SignedAmount (CA1720 refuses a public member called Signed). The infrastructure row keeps Signed."
  - "GetLedgerHandler.HandleAsync(Guid? userId, ...) follows the plan's signature, but another person's ledger is refused with MoneyErrors.Forbidden until plan 10-16 adds that rule."

patterns-established:
  - "Running balance: balanceAfterFirst = current balance - sum of newer rows, then each next row = previous balance - previous signed amount; a deleted row gets null and changes nothing"
  - "Proof that a consistency test bites: its RED failed with a row landing between the reads, and a ReadCommitted mutation of the GREEN code failed it again"

requirements-completed: [MONEY-02, MONEY-08]

coverage:
  - id: D1
    description: "GET /api/v1/staff-money/me/ledger answers both roles with their own ledger newest first with items, total, page, pageSize, balance and includesDeleted; anonymous gets 401; the matrix row is 401/200/200"
    requirement: MONEY-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffLedgerEndpointTests.cs#LizasThreeRowsComeNewestFirstEachWithTheBalanceAfterIt"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffLedgerEndpointTests.cs#CarmensLedgerShowsTheSameTransferAsATransferOut"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffLedgerEndpointTests.cs#AnAnonymousCallerGets401"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus (GET /api/v1/staff-money/me/ledger)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every balanceAfter comes from the server: the newest row of page 1 equals the money on hand, page 2 starts where page 1 ended, and the oldest row ends on its own signed amount, across three pages of 25 rows"
    requirement: MONEY-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffLedgerEndpointTests.cs#TheRunningBalanceHoldsAcrossPages"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/LedgerRunningBalanceTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/GetLedgerHandlerTests.cs#TheBalanceAfterTheFirstRowIsTheBalanceMinusTheSumOfTheNewerRows"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every kind carries the details its row names: order, team or customer and method for a payment; order and customer for a refund; order, category and description for an order expense; category and description for a company expense; counterpart, note, recorded by, transfer id, version and the hand-over mark for a transfer"
    requirement: MONEY-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffLedgerEndpointTests.cs#EveryKindCarriesItsDetails"
        status: pass
    human_judgment: false
  - id: D4
    description: "The four ledger reads (page, newer-rows sum, count, balance) agree even when a row is recorded between them, because they run in one serializable read transaction (D-105); the test fails when the isolation is lowered"
    requirement: MONEY-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs#ThePageTheNewerSumTheCountAndTheBalanceAgreeWhenARowIsRecordedBetweenTheReads"
        status: pass
    human_judgment: false
  - id: D5
    description: "A page costs the same number of commands at page sizes 10 and 100 (8 on page 1: the page, the count, the balance and five detail reads)"
    requirement: MONEY-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs#AReaderPageRunsTheSameNumberOfCommandsAtAnyPageSize"
        status: pass
    human_judgment: false
  - id: D6
    description: "Empty ledger, ordering and the SEC-03 limits: a person with no rows gets items [], total 0 and balance 0.00; page below 1 or above 100000 and pageSize below 1 or above 100 answer 400 with the shared list messages; the limits themselves are accepted"
    requirement: MONEY-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffLedgerEndpointTests.cs#APersonWithNoMoneyRowsGetsAnEmptyLedger"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffLedgerEndpointTests.cs#APageSizeOrPageOutOfRangeAnswers400WithTheSharedListMessage"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs#ATransferAndAPaymentOnTheSameDayOrderByRecordedTime"
        status: pass
    human_judgment: false
  - id: D7
    description: "A Manager can show deleted transfers in their own ledger (isDeleted, deletedBy, deletedAtUtc, no balanceAfter, every other balance unchanged); an Admin who asks gets 403 before any read; an Admin's ledger never holds a deleted transfer's id or an isDeleted true mark"
    requirement: MONEY-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffLedgerEndpointTests.cs#AManagerWhoAsksForDeletedTransfersSeesThemWithNoBalanceAndEveryOtherBalanceIsUnchanged"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffLedgerEndpointTests.cs#AnAdminWhoAsksForDeletedTransfersGets403AndTheSentence"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffLedgerEndpointTests.cs#AnAdminsLedgerNeverHoldsADeletedTransferAndItsBodyNamesNeitherItsIdNorTheFlag"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/GetLedgerHandlerTests.cs#AnAdminOrAnAccountWithNoRoleWhoAsksForDeletedTransfersIsRefusedBeforeAnyRead"
        status: pass
    human_judgment: false
  - id: D8
    description: "The OpenAPI snapshot and the generated web types carry the new route in step with the live document; docs/api/staff-money.md documents it"
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
    description: "A deleted transfer in a Manager's ledger shows its face amount in moneyIn or moneyOut (by direction) while counting toward no balance; the plan did not state this"
    verification: []
    human_judgment: true
    rationale: "What a deleted row's amount columns should show is a wire choice the plan left open; plan 10-17 draws it and the owner may prefer a blank or struck-through figure."

duration: 42min
completed: 2026-11-07
status: complete
---

# Phase 10 Plan 14: Staff read their own ledger with a running balance after every row Summary

*Created: 2026-11-07T18:50:00-06:00 · Updated: 2026-11-07T18:50:00-06:00*

**`GET /api/v1/staff-money/me/ledger` pages a staff member's own money rows from all six sources newest first, each with its details and a server-computed running balance, reads the page, count, newer-rows sum and balance in one serializable read transaction (D-105), and keeps deleted transfers Manager-only.**

## Performance

- **Duration:** about 42 min
- **Started:** 2026-11-08T00:06:31Z
- **Completed:** 2026-11-08T00:49:00Z
- **Tasks:** 3 (one tracer, two auto), all TDD
- **Files:** 11 created, 14 modified (7 task commits, plus this SUMMARY commit)

## Accomplishments

- **Tracer verified end to end, then expanded.** The whole stack went in first: union with transfers, reader, request, validator, handler, pure running balance, response, controller action, matrix row, OpenAPI snapshot and web types. Its automated `<verify>` (6 of 6 unit tests, 416 of 416 server tests, `npm ... run check` exit 0) passed, and it has only automated evidence, so no checkpoint was needed.
- **Union with transfers.** Transfer in (kind 3, `+Amount`) and transfer out (kind 4, `-Amount`) join the existing `Concat` as member-initializer projections (the 10-01 rule). Still one `UNION ALL` statement. A deleted transfer is `Signed 0` and `Deleted true` and only joins when `includeDeletedTransfers` is true. The transfer entity still has no query filter and no filter is lifted.
- **Running balance.** `balanceAfterFirst = balance - NewerSum`, then `LedgerRunningBalance.Apply` walks down the page. Proved across three pages of 25 rows against an independent sum, and the newest row of page 1 equals the balance on `GET /staff-money/me`.
- **Details.** At most five untracked detail reads per page (payments, refunds, order expenses, company expenses, transfers; a transfer in and out share one read), never one per row. A deleted person keeps their name with the former-staff mark.
- **D-105.** The reader opens `BeginTransactionAsync(IsolationLevel.Serializable)` (or joins a transaction the caller already has) around the four reads and the detail reads. No inline SQL, no snapshot isolation.
- **Deleted transfers.** `includeDeleted` is passed to the reader only when a Manager asks. An Admin who asks gets 403 `Only Managers can see deleted transfers.` before any read.
- **Docs.** `docs/api/staff-money.md` has a new `GET /api/v1/staff-money/me/ledger` section: parameters, the fields, the running-balance rule, the deleted rule, the statuses and the two new error codes.

### Command counts (CommandCounter, `AReaderPageRunsTheSameNumberOfCommandsAtAnyPageSize`)

| Page | Page size | Commands | Which |
|---|---|---|---|
| 1 | 10 | 8 | page, count, balance, five detail reads |
| 1 | 100 | 8 | the same |

Page 2 and later add one command for the newer-rows sum (an aggregate over a `TOP(n)` subquery, from plan 10-01). Test data held 27 rows of all six kinds, so the first 10 rows already contain every source table.

## Task Commits

1. **Task 1 (tracer): a staff member opens page 1 of their ledger and every row shows the balance after it** - RED `8ed1d1ad` (test), GREEN `d89991fa` (feat)
2. **Task 2: paging carries the balance across pages, every kind carries its details, limits hold** - RED `d7d054e2` (test), GREEN `bc561941` (feat)
3. **Task 3: Managers can show deleted transfers, Admins never can** - RED `92ba955f` (test), GREEN `d38e1758` (feat)
4. Extra coverage tests for two branches of the response row - `e5de79bc` (test)

**Plan metadata:** the SUMMARY commit that follows this file.

## TDD Gate Compliance

`gsd_run check tdd-red-evidence` was not run: the xunit v3 / Microsoft.Testing.Platform console output is not a report format that classifier reads (same as plans 10-01 to 10-12), so each RED was inspected by hand. `git log --grep "^test(10-14)"` and `--grep "^feat(10-14)"` show a `test` commit before every `feat` commit.

- **Task 1 RED `8ed1d1ad`.** `*LedgerRunningBalanceTests`: total 6, failed 4, succeeded 2 (the stub returned `[]`, so `balances` was `[]` where `[900, -100, 200]` and the other lists were expected; the two passing tests are the empty list and the null guard). `*StaffLedgerEndpointTests` + `*AuthorizationMatrixTests` + `*AuthorizationCoverageTests` + `*OpenApiSnapshotTests`: total 416, failed 9, succeeded 407. The four endpoint tests answered `HttpStatusCode.NotFound` where `OK` or `Unauthorized` was expected, plus three matrix rows, `ParallelCallersEachGetTheirOwnStatus` and `DiscoveredEndpointsAreFullyCovered`. Semantic assessment: seeding (payments, company expense, the 500.00 transfer through the real route) ran and passed before each failing call, and every failure is the absent route. No load, fixture or zero-test fault.
- **Task 1 GREEN `d89991fa`:** 6 of 6, and 416 of 416. `StaffLedgerQueryTests` (the 12 tests of plan 10-01) stayed green: 12 of 12.
- **Task 2 RED `d7d054e2`.** Three real failures, all on the planned assertion: `ThePageTheNewerSumTheCountAndTheBalanceAgreeWhenARowIsRecordedBetweenTheReads` (`page.Total` should be 25 but was 26: the row landed between the reads), `AReaderPageRunsTheSameNumberOfCommandsAtAnyPageSize` for sizes 10 and 100 (`counter.Count` should be 8 but was 6: no refund or order-expense detail read), `EveryKindCarriesItsDetails` (a `JsonValueKind.Null` order id on the refund row, found by `GetGuid()`), and `AnAccountTheDirectoryDoesNotKnowIsRefusedAndNothingIsRead` (unit). Totals: Infrastructure 17 with 3 failed; Application 13 with 1 failed; Server 13 with 1 failed. The other Task 2 tests (running balance across pages, empty ledger, page-size limits, the transfer union cases) passed at RED because the tracer already built them. They are characterization tests that the plan's Task 2 behavior list requires.
- **Task 2 GREEN `bc561941`:** Infrastructure 17 of 17, Application 13 of 13, Server 13 of 13.
- **D-105 proved to bite.** After GREEN I replaced `IsolationLevel.Serializable` with `IsolationLevel.ReadCommitted` in `StaffMoneyReader.cs`. The test failed (total 1, failed 1). I put `Serializable` back (`grep` shows line 99) and the class passed again: `*StaffLedgerQueryTests` + `*StaffMoneyReaderTests` total 29, failed 0. The agree test was then run twice more alone: 1 of 1 each time.
- **Task 3 RED `92ba955f`.** Application: total 17, failed 3 (the Manager flag case and the two Admin or no-role cases). Server: total 18, failed 2: `AManagerWhoAsksForDeletedTransfersSees...` (kinds should be `[payment-received, transfer-in, transfer-out, transfer-out, payment-received]` but were `[payment-received, transfer-out, payment-received]`) and `AnAdminWhoAsksForDeletedTransfersGets403AndTheSentence` (should be `Forbidden` but was `OK`). The query and reader deleted cases (2 more Infrastructure tests, 19 total) passed at RED because the tracer already built the deleted mark; they stay as guards.
- **Task 3 GREEN `d38e1758`:** Application 17 of 17; Server (`*StaffLedgerEndpointTests` + `*OpenApiSnapshotTests`) 28 of 28.
- No `refactor` commit was needed.

## Verification Results (quoted from the runs)

- `dotnet build Csps.slnx`: 0 Warning(s), 0 Error(s).
- `dotnet format Csps.slnx --verify-no-changes`: no output after Task 3 (clean).
- `dotnet test --project tests/Csps.Application.UnitTests` (whole project, with coverlet `--coverlet-include "[Csps.Application]*"`): total 2453, failed 0. Cobertura line-rate 0.9811, branch-rate 0.9573 (above the 95% gate). New classes: `GetLedgerHandler` 1 / 1, `GetLedgerRequestValidator` 1 / 1, `LedgerRunningBalance` 1 / 1, `LedgerEntryResponse` 0.9838 / 0.9523 at that run. The two tests added after it (`AnUnknownKindIsRefused`, `ADeletedRowWithNoFaceAmountShowsZeroAndNoBalance`) cover its two remaining branches; coverage was not re-measured after them. `*GetLedgerHandlerTests` after them: total 19, failed 0.
- Server money group (`*StaffLedgerEndpointTests`, `*StaffMoneyBalanceTests`, `*AuthorizationMatrixTests`, `*AuthorizationCoverageTests`, `*IdempotencyCoverageTests`, `*OpenApiSnapshotTests`, `*MoneyTransferEndpointTests`, `*MoneyHandoverEndpointTests`, `*TransferRecipientsEndpointTests`, `*MoneyTransferAttributionTests`, `*MoneyTransferConcurrencyTests`): total 518, failed 0, succeeded 518.
- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*NoInlineSqlTests" --filter-class "*LayerTests"`: total 33, failed 0.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Acceptance greps: `LedgerEntryKind.TransferIn` 1 and `LedgerEntryKind.TransferOut` 1 in `StaffLedgerQuery.cs`; `GetMyLedger` 1 in `openapi.v1.json`; `public static IReadOnlyList<decimal?> Apply` 1; `Only Managers can see deleted transfers.` 1 in `MoneyErrors.cs`; `me/ledger` 2 in `docs/api/staff-money.md`; test names with `AcrossPages`, `Details`, `Empty`, `PageSize`, `Admin` plus `Deleted`, and `Commands` all exist.
- No em or en dash in any line this plan added (byte-level grep of each staged diff). `gitleaks` ran in the pre-commit hook on every commit: no leaks found. Test people are made-up names (Carmen Reyes, Liza Mercado, Jomar Santos, Ana, Ben, Cora). No package added or bumped, no schema change, no trigger, no inline SQL, no query filter lifted.
- Not run, as instructed: the whole Server and Infrastructure suites and `ExpenseListTimingTests`. No flake was seen in any run of this plan.

## Decisions Made

- **D-105 lives in the reader.** The plan had the handler read the balance from `GetSumsAsync`. The ruling needs the page, newer-rows sum, count and balance in one transaction, and only the Infrastructure layer can set an isolation level without leaking EF into Application. `LedgerPage` therefore carries `Balance`, and the handler uses it.
- **Deleted rows show their face amount** (decision D9, needs owner review before plan 10-17 draws it).
- **Another person's ledger is refused for now.** `HandleAsync(Guid? userId, ...)` keeps the plan's signature; a non-null id other than the caller's answers `MoneyErrors.Forbidden` so the rule cannot be skipped by accident. Plan 10-16 replaces it with the real Admin-own-only, Manager-all rule.
- The 400 for a bad page uses a new code `staff-money.invalid-request` with the existing text `Check the highlighted fields.` and the shared list lines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CA1720 refuses a public member called `Signed`**
- **Found during:** Task 1 RED build
- **Issue:** `LedgerRowView(..., decimal Signed, ...)` failed the build with CA1720 (identifier contains a type name).
- **Fix:** The Application row names it `SignedAmount`. The Infrastructure union row keeps `Signed` (it is internal and part of plan 10-01).
- **Files modified:** `src/Csps.Application/Money/LedgerRowView.cs`, `tests/Csps.Application.UnitTests/Money/LedgerRunningBalanceTests.cs`
- **Committed in:** `8ed1d1ad`

**2. [Rule 2 - Missing critical] D-105 moves the balance read into the reader**
- **Found during:** Task 1 design (owner ruling D-105)
- **Issue:** The plan has the handler read the balance separately, which cannot be in the same transaction as the reader's reads.
- **Fix:** `LedgerPage(Rows, Total, NewerSum, Balance)`; the reader reads the balance (with the same private sums read that `GetSumsAsync` uses) inside the transaction.
- **Files modified:** `src/Csps.Application/Ports/IStaffMoneyReader.cs`, `src/Csps.Infrastructure/Money/StaffMoneyReader.cs`, `src/Csps.Application/Money/GetLedgerHandler.cs`
- **Committed in:** `d89991fa` (shape), `bc561941` (transaction)

**3. [Rule 3 - Blocking] Files outside the plan's list**
- **Issue:** The plan lists no file for the row view, the page record or the detail reads, and no change to the shared test seeding.
- **Fix:** Added `src/Csps.Application/Money/LedgerRowView.cs`, `src/Csps.Application/Money/LedgerPage.cs`, `src/Csps.Infrastructure/Money/StaffLedgerDetails.cs`. Added `TeamName`, `CustomerName` (default unchanged) to `SeedOrder` and `Description` to `SeedMoney` in `tests/Csps.Testing/OrderSeeding.cs` so the details test can name a team and an expense description. Added `LedgerRoute`, `GetLedgerAsync` and `ReadLedgerAsync` to `MoneyFixtures`.
- **Committed in:** `8ed1d1ad`, `d89991fa`, `d7d054e2`

**4. [Plan staging] The tracer leaves three behaviors to Tasks 2 and 3**
- **Issue:** Built whole, the tracer would leave Tasks 2 and 3 with tests that pass the moment they are written.
- **Fix:** The tracer built everything its own tests need but not the refund and order-expense detail reads, the serializable transaction, the account check, or the Manager-only deleted rule. Those are the real REDs of Tasks 2 and 3 (see TDD Gate Compliance). The tracer handler read `IStaffDirectory` only as a stub in the Task 2 RED commit so the unit test could compile.
- **Committed in:** `d89991fa`, `d7d054e2`, `bc561941`, `d38e1758`

**5. [Rule 2 - Missing critical] Two extra unit tests for coverage**
- **Issue:** `LedgerEntryResponse` was at 0.9838 / 0.9523 after Task 3.
- **Fix:** Added `AnUnknownKindIsRefused` and `ADeletedRowWithNoFaceAmountShowsZeroAndNoBalance`.
- **Committed in:** `e5de79bc`

**6. [Dispatch] Worktree instead of the main checkout**
- **Issue:** The plan's executor rules say to work in the main checkout on `gsd/phase-10-admin-dashboard`. This run was dispatched into a worktree on `worktree-agent-a96fe04d8fc5653b0` with the orchestrator owning merges.
- **Fix:** Followed the dispatch (worktree, no push, no merge, no STATE.md or ROADMAP.md edits). `web/node_modules` and `tools/openapi-gen/node_modules` were linked to the main checkout's copies for the contract commands and the links removed at the end.

---

**Total deviations:** 6 (1 blocking analyzer rule, 1 missing critical for D-105, 1 extra files, 1 plan staging, 1 extra tests, 1 dispatch). **Impact on plan:** None changes behavior the plan defined, except the D-105 placement and the deleted-row amount (decision D9).

## Issues Encountered

- The harness refused compound shell commands that name git (pipes, command substitution, `git diff | grep`), so staged diffs were written to the scratchpad with `git diff --cached --output=` and searched there.
- A broad `find .` for a coverage file crossed the `web/node_modules` link and ran for more than two minutes in the background; it ended by itself and left nothing running. Coverage files were then found at `TestResults/` (git-ignored).
- The serializable transaction holds range locks on the person's rows for the length of one ledger read (a few statements). A concurrent writer for the same person waits until the read ends. That is what D-105 asks for. Watch it in the phase-end review if the ledger is ever read in a tight loop.

## Open Questions for the Owner

- **D9, deleted rows.** A deleted transfer in a Manager's ledger shows its face amount in `moneyIn` or `moneyOut` and no `balanceAfter`. If the owner would rather show no amount at all, it is one line in `LedgerEntryResponse.Of`. Plan 10-17 draws it.
- **New owner-facing sentence.** `Only Managers can see deleted transfers.` (spelled out in the plan; listed here as P10-BL-07 asks). Every other message reuses an existing line: `Use a page size from 1 to 100.`, `Use a page from 1 to 100000.` and `Check the highlighted fields.`
- Still open from plans 10-08 to 10-12: `MoneyErrors.NotFound` is still unused; plan 10-16 will return it.

## Known Stubs

None. No placeholder, empty data source or TODO was left in the files of this plan.

## Threat Flags

None beyond the plan's threat model.

- T-10-28 mitigated: `includeDeleted` is passed only for a Manager; an Admin's `deleted=true` is 403 before any read (unit test: the reader is never called); the Admin body test scans for the deleted transfers' ids and `"isDeleted":true`.
- T-10-29 mitigated: shared list limits (`pageSize` 1 to 100, `page` 1 to 100000) on both sides of each limit; a fixed command count per page (8 on page 1 at sizes 10 and 100).
- T-10-SC: no package was added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 10-16 can reuse `IStaffMoneyReader.GetLedgerPageAsync`, `LedgerRunningBalance`, `LedgerPageResponse` and `GetLedgerHandler` for another person's ledger: replace the `Forbidden` refusal in `HandleAsync(Guid? userId, ...)` with the Admin-own-only, Manager-all rule (role check first, then existence, RESEARCH Pitfall 5). The reader already takes the person's id.
- Plan 10-17 can draw `GET /staff-money/me/ledger` from the contract in `web/src/types/api.generated.ts` (`LedgerPageResponse`, `LedgerEntryResponse`). The kind words are `payment-received`, `refund-handed-back`, `transfer-in`, `transfer-out`, `company-expense` and `order-expense`.
- Plan 10-18's delete endpoint needs no ledger change: a soft-deleted transfer leaves every balance and the default ledger, and shows only in a Manager's `deleted=true` view.
- No blockers.

## Self-Check: PASSED

- FOUND: all 11 files listed in `key-files.created` exist on disk.
- FOUND: commits `8ed1d1ad`, `d89991fa`, `d7d054e2`, `bc561941`, `92ba955f`, `d38e1758`, `e5de79bc` on this branch (`git merge-base --is-ancestor` for each); measured `git rev-list --count 16ed4992..HEAD` = 7 before this SUMMARY commit.
- Final run after the last code commit: `dotnet build Csps.slnx` 0 warnings, 0 errors; `dotnet format Csps.slnx --verify-no-changes` no output; `*StaffLedgerQueryTests` + `*StaffMoneyReaderTests` total 31, failed 0.
- STATE.md and ROADMAP.md were not modified.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-07*

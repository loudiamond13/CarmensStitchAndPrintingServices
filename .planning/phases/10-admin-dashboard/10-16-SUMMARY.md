---
phase: 10-admin-dashboard
plan: 16
subsystem: api
tags: [dotnet, csharp, ef-core, money, authorization, idor, cwe-639, cwe-204, openapi, tdd, authorization-matrix]
created: "2026-11-07T23:12:00-06:00"
updated: "2026-11-07T23:12:00-06:00"

requires:
  - phase: 10-admin-dashboard
    provides: IStaffMoneyReader (sums, people, ledger page), MoneyParties, GetLedgerHandler with the D-105 serializable read, StaffMoneyController, MoneyTransfersController, MoneyFixtures (plans 10-08 to 10-14)
provides:
  - "GET /api/v1/staff-money (Managers only): every active Admin and Manager by name, then leavers with a non-zero balance by name, each with userId, name, role, status, balance and isYou, plus the total held by staff"
  - "GET /api/v1/staff-money/{userId} and /{userId}/ledger: an Admin gets 403 for any id but their own, decided from the token before any lookup; a Manager reads any Admin or Manager, former staff included, and gets 404 for anyone else"
  - "GET /api/v1/money-transfers: the transfer list, complete for a Manager (deleted=true optional) and own-only for an Admin (deleted=true is 403)"
  - "StaffMoneyAccess.Check / FindAsync: the one role-before-existence rule; StaffMoneyResponse gains role and status"
affects: [10-17 ledger screen, 10-18 transfer delete and remove, 10-19 All Staff and Transfers panels, 10-20 audit labels]

actuals:
  tokens: 34148
  tasks: 3
  commits: 6
plan_head_before: c4eea685121f4f809fe453bcd2a3afd13fd95645
plan_head_after: 5970749fd0031043322bf9eac26e32a1d203cc6c

tech-stack:
  added: []
  patterns:
    - "Role before existence: a pure Check(callerId, callerState, requestedId) decides 403 from the caller's own account; only then does FindAsync look the person up (404), so a real coworker and a made-up id look the same to an Admin"
    - "A figure scan: one test reads every Admin-facing money answer, every refusal and a refused D-49 transfer and asserts none holds another person's figure, a leaver's figure or a deleted transfer"

key-files:
  created:
    - src/Csps.Application/Money/StaffMoneyAccess.cs
    - src/Csps.Application/Money/GetStaffMoneyHandler.cs
    - src/Csps.Application/Money/ListStaffBalancesHandler.cs
    - src/Csps.Application/Money/StaffBalancesResponse.cs
    - src/Csps.Application/Money/ListMoneyTransfersHandler.cs
    - src/Csps.Application/Money/ListMoneyTransfersRequest.cs
    - src/Csps.Application/Money/ListMoneyTransfersRequestValidator.cs
    - src/Csps.Application/Money/MoneyTransferListResponse.cs
    - tests/Csps.Application.UnitTests/Money/StaffMoneyAccessTests.cs
    - tests/Csps.Application.UnitTests/Money/ListStaffBalancesHandlerTests.cs
    - tests/Csps.Application.UnitTests/Money/ListMoneyTransfersHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Money/StaffBalancesEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Money/StaffMoneyAccessEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyTransferListEndpointTests.cs
  modified:
    - src/Csps.Application/Money/GetLedgerHandler.cs
    - src/Csps.Application/Money/GetMyMoneyHandler.cs
    - src/Csps.Application/Money/MoneyErrors.cs
    - src/Csps.Application/Money/MoneyParties.cs
    - src/Csps.Application/Money/StaffMoneyResponse.cs
    - src/Csps.Application/Money/StaffPerson.cs
    - src/Csps.Application/Ports/IStaffMoneyReader.cs
    - src/Csps.Infrastructure/Money/StaffMoneyReader.cs
    - src/Csps.Server/Controllers/StaffMoneyController.cs
    - src/Csps.Server/Controllers/MoneyTransfersController.cs
    - src/Csps.Server/Composition/MoneyApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Money/MoneyFixtures.cs
    - tests/Csps.Server.IntegrationTests/Money/StaffMoneyBalanceTests.cs
    - tests/Csps.Application.UnitTests/Money/GetLedgerHandlerTests.cs
    - tests/Csps.Application.UnitTests/Money/GetMyMoneyHandlerTests.cs
    - tests/Csps.Testing/MoneySeeding.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/test/moneyFixtures.ts
    - docs/api/staff-money.md

key-decisions:
  - "The 403 comes first: StaffMoneyAccess.Check uses only the token's user and the caller's own account state, so an Admin gets the same 403 'You can only see your own money.' for a real coworker, a leaver, the legacy holder and a random id."
  - "MoneyErrors.Forbidden now carries the plan's sentence 'You can only see your own money.' (it was the unused 'You can't do this.'). PersonNotFound is new with its own code staff-money.person-not-found; the older NotFound stays defined and unused."
  - "On the ledger routes the page query is validated before the role check. A bad page gives an Admin a 400 whatever the id is, so nothing about the id leaks."
  - "An Admin who sends deleted=true on their own ledger still gets the D-31 403 'Only Managers can see deleted transfers.'; on another person's ledger the access 403 wins."
  - "The all-staff list keeps a leaver when the balance is not 0.00 (D-43); the recipients list keeps one only when owed money. Both share ListStaffPeopleAsync and MoneyParties."
  - "StaffPerson gains an init-only Role (set by the reader, which already computed it) instead of a positional member, so no existing call site changes."

patterns-established:
  - "Compile-only stubs in a RED commit (an access rule that always passes, a handler that returns a fixed error) so the new unit tests build and fail on their planned assertions"

requirements-completed: [MONEY-03, MONEY-08]

coverage:
  - id: D1
    description: "A Manager lists every active Admin and Manager by name, then leavers with a non-zero balance by name, with isYou and the total; the legacy holder, a zero-balance leaver and role-less accounts stay out; an Admin gets 403 and anonymous 401"
    requirement: MONEY-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffBalancesEndpointTests.cs#AManagerSeesActivePeopleByNameThenLeaversWithMoneyByNameAndTheTotal"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffBalancesEndpointTests.cs#ALeaverAtZeroTheLegacyHolderAndAnAccountWithNoRoleNeverAppear"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffBalancesEndpointTests.cs#WithOnlyOneManagerOnStaffTheAnswerIsOneRowAndTheTotalEqualsIt"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/ListStaffBalancesHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "The total is the sum of the listed balances and may be below zero"
    requirement: MONEY-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffBalancesEndpointTests.cs#TheTotalIsTheSumOfTheListedBalancesEvenWhenItIsBelowZero"
        status: pass
    human_judgment: false
  - id: D3
    description: "An Admin gets 403 on /staff-money/{userId} and /{userId}/ledger for a random id and for a coworker id, decided before any lookup (the directory and reader are never asked); the Admin's own id answers like /me"
    requirement: MONEY-03
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/StaffMoneyAccessTests.cs#AnAdminAskingForACoworkerOrAMadeUpIdIsRefusedAndNeitherThePersonNorTheirMoneyIsRead"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffMoneyAccessEndpointTests.cs#AnAdminGets403ForARandomIdOnBothRoutesAndNothingIsRevealed"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffMoneyAccessEndpointTests.cs#AnAdminGets403ForACoworkerIdOnBothRoutesAndTheCoworkersFigureIsNotInTheBody"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffMoneyAccessEndpointTests.cs#ARealCoworkerAndARandomIdGiveAnAdminTheSameAnswer"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffMoneyAccessEndpointTests.cs#AnAdminsOwnIdAnswers200EqualToTheMeAnswerOnBothRoutes"
        status: pass
    human_judgment: false
  - id: D4
    description: "A Manager reads a deactivated or deleted person's figure and ledger with name, role, status and balance; a random id, the legacy holder and a role-less account answer 404 'This person wasn't found.'"
    requirement: MONEY-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffMoneyAccessEndpointTests.cs#AManagerReadsADeactivatedPersonsFigureAndLedger"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffMoneyAccessEndpointTests.cs#AManagerReadsADeletedPersonAndAnActiveCoworker"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffMoneyAccessEndpointTests.cs#AManagerGets404ForARandomIdTheLegacyHolderAndAnAccountWithNoStaffRole"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-31 on the one-person ledger: a Manager may pass deleted=true for another person; an Admin's deleted=true is 403, for their own id and for another's"
    requirement: MONEY-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffMoneyAccessEndpointTests.cs#AManagerMayAskForAnotherPersonsDeletedTransfersAndAnAdminMayNotEvenForTheirOwn"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/GetLedgerHandlerTests.cs#AManagerReadsAnotherStaffMembersLedgerThroughTheReaderWithThatPersonsId"
        status: pass
    human_judgment: false
  - id: D6
    description: "GET /money-transfers lists newest first by date, recorded time, then id with from, to, amount, date, note, recordedBy, isHandover and version; a Manager sees all, an Admin only their own; deleted ones only for a Manager who asks, with isDeleted, deletedBy and deletedAtUtc; paging limits answer 400 with the shared words"
    requirement: MONEY-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/MoneyTransferListEndpointTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Money/ListMoneyTransfersHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D7
    description: "RESEARCH Pitfall 6, OD-19: across GET staff-money/me, me/ledger, money-transfers, money-transfers/recipients, every Admin refusal and a refused D-49 transfer, no body holds the 7777.77 or 333.33 figures, the deleted transfer's id or an isDeleted true mark"
    requirement: MONEY-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Money/StaffMoneyAccessEndpointTests.cs#NoOtherFiguresReachAnAdminOnAnyMoneyReadRefusalOrRefusedTransfer"
        status: pass
    human_judgment: false
  - id: D8
    description: "Matrix rows: GET staff-money 401/403/200; GET staff-money/{userId:guid} and /ledger 401/403/404 with fresh random ids; GET money-transfers 401/200/200; the OpenAPI snapshot and generated web types match; docs/api/staff-money.md documents the four routes"
    requirement: MONEY-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false
  - id: D9
    description: "Two new owner-facing sentences: 'You can only see your own money.' (Admin naming someone else) and 'This person wasn't found.' (Manager naming no staff member). Both were spelled out in the plan."
    verification: []
    human_judgment: true
    rationale: "P10-BL-07 asks that new owner-facing wording be listed for owner review."

duration: 40min
completed: 2026-11-07
status: complete
---

# Phase 10 Plan 16: Managers see everyone's money and transfers, and Admins see only their own Summary

*Created: 2026-11-07T23:12:00-06:00 · Updated: 2026-11-07T23:12:00-06:00*

**Four new read routes (all-staff balances with the total, one person's balance, one person's ledger, the transfer list) enforce OD-19: a Manager sees everyone, an Admin sees only themselves and gets the same 403 for a real coworker as for a made-up id, decided from the token before any lookup.**

## Performance

- **Duration:** about 40 min
- **Started:** 2026-11-08T04:29:26Z
- **Completed:** 2026-11-08T05:12:00Z
- **Tasks:** 3 (one tracer, two auto), all TDD
- **Files:** 14 created, 21 modified (6 task commits, plus this SUMMARY commit)

## Accomplishments

- **Tracer verified end to end, then expanded.** `GET /staff-money` went in whole first (handler, response, reader role, controller action, registration, matrix row, snapshot, web types). Its automated `<verify>` (422 of 422 server tests, `npm --prefix tools/openapi-gen run check`) passed and it carries no human check, so no checkpoint was needed.
- **All staff.** Active Admins and Managers by name (a Manager-locked or not-yet-set-up person included, D-56), then deactivated or deleted people whose balance is not 0.00, by name. The people and their sums come from one `ListStaffPeopleAsync` and one `GetSumsAsync` call. The legacy holder falls out through `MoneyParties.FromPerson` (not staff). `total` is the sum of the listed rows (9,650.00 in the test world).
- **The access rule.** `StaffMoneyAccess.Check(callerId, caller, requestedId)` is a pure function of the caller's own account: own id or Manager passes, anything else is `MoneyErrors.Forbidden`. `FindAsync` then looks the person up and answers `PersonNotFound` for no account, the legacy holder or an account with no staff role. `GetStaffMoneyHandler` and `GetLedgerHandler` both call `Check` first.
- **One person's money.** `GET /staff-money/{userId}` returns name, role, status (`active`, `deactivated`, `deleted`), balance and today; an Admin's own id equals `/me` byte for byte (tested on the figure and on the ledger).
- **One person's ledger.** `GetLedgerHandler` serves other people through the rule. The D-105 serializable read, its three-try deadlock retry and its refusal to run inside an outer transaction are untouched; the reader's ledger method was not edited and its 35 Infrastructure tests still pass.
- **Transfer list.** `GET /money-transfers` orders by transfer date, recorded time (both newest first), then id. The handler sets `involving = caller` for an Admin and `null` for a Manager, and includes deleted only for a Manager who asks; an Admin's `deleted=true` is 403 before any read.
- **Figure scan.** One integration test reads `me`, `me/ledger`, `money-transfers`, `recipients`, three refusals on each of the one-person routes, the all-staff refusal and a refused D-49 transfer as an Admin (12 bodies). None holds `7777.77`, `333.33`, the deleted transfer's id or `"isDeleted":true`.
- **Docs.** `docs/api/staff-money.md` documents the four routes, the new `role` and `status` fields, the access rules and the new error codes.

## Task Commits

1. **Task 1 (tracer): a Manager lists every staff member's money on hand with the total** - RED `96ddddee` (test), GREEN `d6cc58f6` (feat)
2. **Task 2: one person's balance and ledger answer a Manager and refuse an Admin before any lookup** - RED `417f03fd` (test), GREEN `80652f55` (feat)
3. **Task 3: the transfer list is own-only for an Admin and complete for a Manager, with the figure scan** - RED `b380ee4e` (test), GREEN `5970749f` (feat)

**Plan metadata:** the SUMMARY commit that follows this file. No `refactor` commit was needed.

## TDD Gate Compliance

`gsd_run check tdd-red-evidence` was not run: the xunit v3 / Microsoft.Testing.Platform console output is not a report format that classifier reads (same as plans 10-01 to 10-14), so each RED was inspected by hand. `git log --grep "^test(10-16)"` and `--grep "^feat(10-16)"` show a `test` commit before each `feat` commit.

- **Task 1 RED `96ddddee`.** `*StaffBalancesEndpointTests` + `*AuthorizationMatrixTests` + `*AuthorizationCoverageTests` + `*OpenApiSnapshotTests`: total 422, failed 12, succeeded 410. Seeding (payments, expenses, locks, deactivations, the legacy holder's role) ran and passed before every failing call; each failure is the status check on the absent route (404 where 200, 401 or 403 was expected), plus the three matrix rows, `ParallelCallersEachGetTheirOwnStatus` and `DiscoveredEndpointsAreFullyCovered`. Semantic assessment: the planned assertion, for the intended reason. No load, fixture or zero-test fault.
- **Task 1 GREEN `d6cc58f6`.** Same four classes: 422 of 422. `*ListStaffBalancesHandlerTests`: 5 of 5.
- **Task 2 RED `417f03fd`.** Only compile stubs existed (an access rule that always passes, a one-person handler that always answers `PersonNotFound`, `role` and `status` filled with empty text). Unit (`*StaffMoneyAccessTests`, `*GetLedgerHandlerTests`, `*GetMyMoneyHandlerTests`): total 47, failed 21, on the planned assertions (Admin not Forbidden, Manager not served, role and status empty, unknown caller not `SessionEnded`). Server (`*StaffMoneyAccessEndpointTests`, `*StaffMoneyBalanceTests`, `*StaffLedgerEndpointTests`, `*AuthorizationMatrixTests`, `*OpenApiSnapshotTests`): total 446, failed 17: the new routes answered 404 where 200 or 403 was expected, the 404 body lacked 'This person wasn't found.', the `/me` body lacked `role` and `status`, and the snapshot no longer matched. The tests that expect `PersonNotFound` pass at RED on purpose, because the stub's fixed answer is `PersonNotFound`; they are guards.
- **Task 2 GREEN `80652f55`.** Unit (six classes): 65 of 65. Server: 466 of 466.
- **Task 3 RED `b380ee4e`.** Stub handler answers `SessionEnded`, empty validator, reader method returns an empty page. Unit `*ListMoneyTransfersHandlerTests`: total 12, failed 11 (the one pass is the no-user case, which the stub answers correctly). Server: total 452, failed 23: every list test and the matrix rows, and the figure scan failed first on `GET /money-transfers` answering 404 for the Admin.
- **Task 3 GREEN `5970749f`.** Unit 12 of 12. Server (`*MoneyTransferListEndpointTests`, `*StaffMoneyAccessEndpointTests`, matrix, coverage, snapshot): 452 of 452.
- **The access rule bites.** At the Task 2 RED the always-passing `Check` made the Admin 403 tests, the "nothing is looked up" tests and the matrix Admin rows fail; the real rule turns them green. The figure scan fails if the Admin list or any refusal carries another person's figure or a deleted transfer.

## Verification Results (quoted from the runs)

- `dotnet build Csps.slnx`: 0 Warning(s), 0 Error(s).
- `dotnet format Csps.slnx --verify-no-changes`: no output (clean).
- Task 3 verify commands: `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MoneyTransferListEndpointTests" --filter-class "*StaffMoneyAccessEndpointTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*AuthorizationCoverageTests" --filter-class "*OpenApiSnapshotTests"`: total 452, failed 0. `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*NoInlineSqlTests" --filter-class "*LayerTests"`: total 33, failed 0. `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Server money group (`*StaffLedgerEndpointTests`, `*StaffMoneyBalanceTests`, `*StaffMoneyAccessEndpointTests`, `*StaffBalancesEndpointTests`, `*MoneyTransferListEndpointTests`, `*AuthorizationMatrixTests`, `*AuthorizationCoverageTests`, `*IdempotencyCoverageTests`, `*OpenApiSnapshotTests`, `*MoneyTransferEndpointTests`, `*MoneyHandoverEndpointTests`, `*TransferRecipientsEndpointTests`, `*MoneyTransferAttributionTests`, `*MoneyTransferConcurrencyTests`): total 565, failed 0.
- Infrastructure `*StaffLedgerQueryTests` + `*StaffMoneyReaderTests` (the D-105 serializable read): total 35, failed 0.
- `dotnet test --project tests/Csps.Application.UnitTests` (whole project, coverlet `[Csps.Application]*`): total 2496, failed 0. Cobertura line-rate 0.9814, branch-rate 0.9578 (above the 95% gate). New classes at line 1 and branch 1: `StaffMoneyAccess`, `GetStaffMoneyHandler`, `ListStaffBalancesHandler`, `ListMoneyTransfersHandler`, `ListMoneyTransfersRequestValidator`; `GetLedgerHandler`, `GetMyMoneyHandler` and `MoneyParties` stay at 1 and 1.
- `npm --prefix web run typecheck`: clean. Web `moneyService.test.ts`, `MoneyOnHandCard.test.tsx`, `MoneyStrip.test.tsx`, `useRefreshMoney.test.tsx`: 81 tests passed.
- Acceptance greps: `ListStaffBalances` 1 and `ListMoneyTransfers` 1 in `openapi.v1.json`; the `"/api/v1/staff-money", "/api/v1/staff-money"` matrix row 1; `LegacyHolder` 2 in `StaffMoneyReader.cs`; `StaffMoneyAccess.Check` 1 in each of `GetStaffMoneyHandler.cs` and `GetLedgerHandler.cs`; `{userId:guid}/ledger` 1 in the matrix; tests named `...RandomId...` and `...CoworkerId...` assert 403 for an Admin; the figure-scan test name contains `NoOtherFigures`; `GET /api/v1/money-transfers` 2 in `docs/api/staff-money.md`.
- No em or en dash in any line this plan added (byte-level grep of each staged diff and of the docs file). `gitleaks` ran in the pre-commit hook on every commit: no leaks found. Test people are made-up names (Carmen Reyes, Liza Mercado, Paolo Garcia, Jomar Santos, Ana Abad, Ben Lim, Noel Abad, Quiet Person). No package added or bumped, no schema change, no trigger, no inline SQL, no query filter lifted.
- Not run, as instructed: the whole Server and Infrastructure suites and `ExpenseListTimingTests`. No flake was seen in any run of this plan.

## Decisions Made

- See `key-decisions` above. The two most visible: the Forbidden sentence now says what the Admin did wrong, and the page query is validated before the role check on the ledger routes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The web money fixture lacked the two new required fields**
- **Found during:** Task 2 GREEN (`npm --prefix web run typecheck` after regenerating the types)
- **Issue:** `StaffMoneyResponse` gained required `role` and `status`, so `myMoneyFixture` in `web/src/test/moneyFixtures.ts` no longer matched the generated type. The plan lists no web file but `api.generated.ts`.
- **Fix:** Added `role: 'Admin'` and `status: 'active'` to the fixture (Prettier reflowed the object). This file is not one of the files plan 10-17 owns.
- **Files modified:** `web/src/test/moneyFixtures.ts`
- **Verification:** `npm --prefix web run typecheck` clean; four related web test files pass (81 tests).
- **Committed in:** `80652f55`

**2. [Rule 3 - Blocking] Files outside the plan's list**
- **Issue:** The plan did not list: `StaffPerson.cs` (the all-staff row needs the role, which the reader already computes), `MoneyParties.cs` (`StatusWord`, shared by three handlers), `GetMyMoneyHandlerTests`, `GetLedgerHandlerTests` and `StaffMoneyBalanceTests` (changed expectations: a new constructor argument, the Manager rule, two new body members), `ListStaffBalancesHandlerTests` and `ListMoneyTransfersHandlerTests` (coverage of the new handlers, Application must stay at or above 95%), `MoneyFixtures.cs` (request helpers), and `tests/Csps.Testing/MoneySeeding.cs` (an optional `Note` on `SeedTransfer`, default unchanged).
- **Committed in:** `96ddddee`, `d6cc58f6`, `417f03fd`, `80652f55`, `b380ee4e`, `5970749f`

**3. [Plan staging] Compile stubs in the Task 2 and Task 3 RED commits**
- **Issue:** The new unit tests need the new types to build. Per the plan 10-14 precedent, each RED commit holds only the smallest stubs: an always-passing `StaffMoneyAccess.Check`, a `GetStaffMoneyHandler` that answers `PersonNotFound`, `role` and `status` filled with empty text in `GetMyMoneyHandler`, a `ListMoneyTransfersHandler` that answers `SessionEnded`, an empty validator and a reader method that returns an empty page.
- **Committed in:** `417f03fd`, `b380ee4e`

**4. [Dispatch] Worktree instead of the main checkout**
- **Issue:** The plan's executor rules say to work in the main checkout on `gsd/phase-10-admin-dashboard`. This run was dispatched into a worktree on `worktree-agent-a45ec7f7113d8a0ad` with the orchestrator owning merges.
- **Fix:** Followed the dispatch (worktree, no push, no merge, no STATE.md or ROADMAP.md edits). `tools/openapi-gen/node_modules` and `web/node_modules` were linked to the main checkout's copies for the contract and web checks, and the links removed at the end.

---

**Total deviations:** 4 (1 blocking fixture, 1 extra files, 1 plan staging, 1 dispatch). **Impact on plan:** None changes behavior the plan defined.

## Issues Encountered

- The harness refused compound shell commands that name git (pipes, command substitution, `cd` then git), so staged diffs were written to the scratchpad with `git diff --cached --output=` and searched there, and every command ran from the worktree root.
- `sed -i` on a test file prints the "LF will be replaced by CRLF" notice; the diffs stayed to the lines changed.
- Nothing was left running. The `TestResults/` folder written by the coverage run is git-ignored.

## Open Questions for the Owner

- **New owner-facing sentences (P10-BL-07).** Both are spelled out in the plan, listed here as asked: `You can only see your own money.` (an Admin naming anyone else) and `This person wasn't found.` (a Manager naming no staff member). Every other message reuses an existing line: `Only Managers can see deleted transfers.`, `Check the highlighted fields.`, `Use a page size from 1 to 100.`, `Use a page from 1 to 100000.` and the D-49 refusal text.
- **Carried from plan 10-14, still open (D9).** A deleted transfer shows its face amount in `moneyIn` or `moneyOut` in a Manager's ledger, and now also in another person's ledger. Plan 10-17 draws it.
- **A bad page on the one-person ledger answers an Admin 400 whatever the id is.** The 400 does not depend on whether the person exists, so it leaks nothing. If the owner would rather every Admin call for another id be 403 first, it is a one-line move in `GetLedgerHandler`.

## Known Stubs

None. No placeholder, empty data source or TODO was left in the files of this plan.

## Threat Flags

None beyond the plan's threat model.

- T-10-32 mitigated: `StaffMoneyAccess.Check` runs on the token's user before any lookup; unit tests prove neither the directory nor the reader is asked for an Admin, integration tests give a real coworker, a leaver, the legacy holder and a random id the same 403, and the figure scan covers every Admin-facing body.
- T-10-33 mitigated: `[Authorize(Policy = Policies.Manager)]` on `GET /staff-money`; matrix row 401/403/200.
- T-10-34 mitigated: the legacy holder is excluded by id in the reader and by `MoneyParties` (not staff); tests give it the Admin role and a payment and expect absence from the list and 404 on both one-person routes.
- T-10-SC: no package was added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 10-17 and 10-19 can draw `GET /staff-money`, `GET /staff-money/{userId}`, `GET /staff-money/{userId}/ledger` and `GET /money-transfers` from `web/src/types/api.generated.ts` (`StaffBalancesResponse`, `StaffBalanceRow`, `StaffMoneyResponse` with `role` and `status`, `MoneyTransferListResponse`). `StaffMoneyResponse` is now `{ userId, name, role, status, balance, today }`.
- The Manager's own row in the all-staff list has `isYou: true`; the screen links it to `/admin/money`.
- A 404 on the one-person routes carries code `staff-money.person-not-found` and the sentence the UI-SPEC error state uses.
- Plan 10-18 (delete and remove) can reuse the `deleted=true` list and ledger views; nothing here changes a transfer.
- No blockers.

## Self-Check: PASSED

- FOUND: all 14 files listed in `key-files.created` exist on disk.
- FOUND: commits `96ddddee`, `d6cc58f6`, `417f03fd`, `80652f55`, `b380ee4e`, `5970749f` on this branch; measured `git rev-list --count c4eea685..HEAD` = 6 before this SUMMARY commit.
- Final run after the last code commit: `dotnet build Csps.slnx` 0 warnings, 0 errors; `dotnet format Csps.slnx --verify-no-changes` no output; money group 565 of 565.
- STATE.md and ROADMAP.md were not modified.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-07*

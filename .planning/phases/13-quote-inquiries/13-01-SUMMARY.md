---
created: 2026-11-22T16:45:00-06:00
updated: 2026-11-22T16:45:00-06:00
phase: 13-quote-inquiries
plan: 01
subsystem: api
tags: [quote-requests, anonymous-endpoint, ef-core, fluentvalidation, tdd, sec-08]

requires:
  - phase: 11-public-site-content-management
    provides: shown product lines (ProductLines.IsActive) and the Philippine phone rule
  - phase: 07-orders
    provides: OrderRules limits and IsValidEmail, the IAttributedRecord stamp, the Idempotency-Key gate
provides:
  - QuoteRequest aggregate (Receive, status New, no creator, row version) and the QuoteRequests table
  - Anonymous POST /api/v1/public/quote-requests with every UI-SPEC field rule
  - Product line snapshot (id and title) for a shown line, refused for an unknown or hidden one
  - OpenAPI snapshot, generated web types and docs/api/quote-requests.md
affects: [13-02, 13-05, 13-06, 13-10, 13-11, 13-16, 13-20]

actuals:
  tokens: 22300
  tasks: 2
  commits: 4

plan_head_before: 4007cc6132a44baa4997cc37433b37b24fb7695a
plan_head_after: 78b5cd5d0fe24c5696bf29708a2f406e285a5489

tech-stack:
  added: []
  patterns:
    - "Public anonymous create: AllowAnonymous controller, one handler, Result to ProblemDetails, Idempotency-Key from the shared middleware"
    - "Domain Receive re-checks the same rules as the validator, so a saved request always fits the New Order form (Pitfall 7)"
    - "Stored byte enums with fixed numbers, wire names in Domain static classes, check constraints on the stored range"

key-files:
  created:
    - src/Csps.Domain/QuoteRequests/QuoteRequest.cs
    - src/Csps.Domain/QuoteRequests/QuoteRequestStatus.cs
    - src/Csps.Domain/QuoteRequests/QuoteRequestInputs.cs
    - src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs
    - src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs
    - src/Csps.Application/QuoteRequests/CreateQuoteRequestRequest.cs
    - src/Csps.Application/QuoteRequests/CreateQuoteRequestRequestValidator.cs
    - src/Csps.Application/QuoteRequests/CreateQuoteRequestResponse.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
    - src/Csps.Application/Ports/IQuoteRequestStore.cs
    - src/Csps.Application/Ports/QuoteProductLine.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestsRegistration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261122221314_AddQuoteRequests.cs
    - src/Csps.Server/Controllers/PublicQuoteRequestsController.cs
    - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
    - docs/api/quote-requests.md
  modified:
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "Field for a missing line key: a 'line' choice with no key (or a key that is too long, over 40) is reported on productLineKey; an unknown choice word is reported on productChoice. Both say 'Choose a product from the list.'"
  - "A productLineKey sent with 'custom' or 'not-sure' is ignored, not refused"
  - "The visible-line lookup is a direct database read (IQuoteRequestStore.FindShownLineAsync), not the cached public snapshot, because the snapshot has no line id"
  - "No rate limit on the create yet: the plan accepts T-13-03 until 13-06; the 429 is listed in the OpenAPI and the API note ahead of it"

patterns-established:
  - "Quote text limits are the OrderRules constants, aliased in QuoteRequestRules"
  - "RED evidence for xUnit v3 on Microsoft.Testing.Platform comes from --report-xunit-junit, accepted by gsd-tools check tdd-red-evidence as junit"

requirements-completed: [INQ-01]

coverage:
  - id: D1
    description: "An anonymous POST with a name and a mobile number saves one QuoteRequest at status New and answers 200 with its id"
    requirement: INQ-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/CreateQuoteRequestTests.cs#TheTextIsSavedAsANewRequest"
        status: pass
    human_judgment: false
  - id: D2
    description: "The saved request has no creator, takes its time from the clock, and ignores forged stamp, status and order members (SEC-08, CWE-915)"
    requirement: INQ-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/CreateQuoteRequestTests.cs#ForgedStampsAreIgnored"
        status: pass
    human_judgment: false
  - id: D3
    description: "A replay with the same Idempotency-Key returns the stored answer with one row; two creates at once are two requests"
    requirement: INQ-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/CreateQuoteRequestTests.cs#AReplayReturnsTheSameAnswer"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/CreateQuoteRequestTests.cs#TwoCreatesAtOnceAreBothSaved"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every field rule answers its UI-SPEC message word for word, with limits counted in UTF-16 units after trimming, and the number stored as E.164"
    requirement: INQ-01
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestRequestValidatorTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "A shown product line is saved with its id and title snapshot; an unknown or hidden line is a 400 on productLineKey; custom and not-sure save no line"
    requirement: INQ-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/CreateQuoteRequestTests.cs#EveryFieldIsSavedTrimmedWithTheVisibleLineAndItsTitle"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/CreateQuoteRequestTests.cs#AHiddenLineAnswers400OnTheLineKey"
        status: pass
    human_judgment: false
  - id: D6
    description: "The QuoteRequests table, its migration, the matrix row, the OpenAPI snapshot and the web types are in place and agree"
    requirement: INQ-01
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class *AuthorizationMatrixTests,*OpenApiSnapshotTests"
        status: pass
      - kind: integration
        ref: "dotnet test --project tests/Csps.Infrastructure.IntegrationTests (full project, 1287 passed, 1 live-only skipped)"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-11-22
status: complete
---

# Phase 13 Plan 01: Quote request create Summary

**An anonymous visitor's quote form is saved as a New request (no creator, clock time, idempotent) through POST /api/v1/public/quote-requests, with every UI-SPEC field rule enforced by the domain, the validator and the shown-product-line lookup.**

## Performance

- **Duration:** about 40 min
- **Started:** 2026-11-22T22:03Z (approximate; no start stamp was taken)
- **Completed:** 2026-11-22T22:45Z
- **Tasks:** 2 (a tracer and a TDD task)
- **Files changed:** 31 (6,346 added lines, 4 commits)

## Accomplishments

- The thin vertical slice works end to end: Domain `QuoteRequest.Receive`, the create handler, the `QuoteRequests` table and migration, the anonymous controller, the matrix row, the OpenAPI snapshot and the generated web types.
- SEC-08 and CWE-915 hold: the request record has no stamp, status or order member, the row has `CreatedById` null, and `ForgedStampsAreIgnored` proves forged members do nothing.
- Every UI-SPEC Validation message is a `QuoteRequestRules` constant used by the domain and the validator. Limits reuse the `OrderRules` numbers and `OrderRules.IsValidEmail`, so a saved request always fits the New Order form later (Pitfall 7).
- A product line is chosen by key among the shown lines only, and its id and title are stored as a snapshot (D-24). The line link clears if the line is deleted; the title stays.
- Domain stays at 100% line and 100% branch, Application at 98.2% line (gate: `Invoke-CoverageGate.ps1`).

## Task Commits

1. **Task 1 (tracer): a name and mobile number reach the database as a New request**
   - RED: `973b045e` (test) 4 integration tests, all failing 404 against the planned 200
   - GREEN: `35ed46f0` (feat)
2. **Task 2 (TDD): every quote form field is checked with the UI-SPEC message**
   - RED: `0777c6cd` (test) 9 domain, 16 validator and 6 integration failures
   - GREEN: `78b5cd5d` (feat)

No refactor commit: nothing needed cleaning after GREEN.

**Plan metadata:** the `docs(13-01)` commit that adds this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

RED then GREEN for both tasks. RED evidence was machine-checked with `gsd-tools check tdd-red-evidence` from xUnit v3 `--report-xunit-junit` reports. Each returned `RED_EVIDENCE_OK`, reason `target_test_failed`.

| Run | Target test | Result | Semantic assessment |
|---|---|---|---|
| Task 1, Server integration | `CreateQuoteRequestTests.TheTextIsSavedAsANewRequest` | 4 total, 4 failed | The POST answered 404 (route not mapped) where the test expects 200; first assertion, the planned behavior |
| Task 2, Domain unit | `QuoteRequestTests.ATeamNameIsLimitedToOneHundredCharacters` | 32 total, 9 failed | A 101 character team name was accepted; the rule was not there yet |
| Task 2, Validator unit | `CreateQuoteRequestRequestValidatorTests.ATeamNameIsLimitedToOneHundredCharacters` | 49 total, 16 failed | The validator reported no error; the rule was not there yet |
| Task 2, Server integration | `CreateQuoteRequestTests.AnUnknownLineKeyAnswers400OnTheLineKey` | 12 total, 6 failed | The unknown key answered 200 and saved; the lookup was not there yet |

The tests that already passed in a RED run (for example the status key round trip) covered code written earlier in the plan, not the target rule.

## Decisions Made

- **Which field carries which product error** (not set by the plan): a `line` choice with no key, or a key longer than any line key (40), reports on `productLineKey`; an unknown choice word reports on `productChoice`. All use "Choose a product from the list."
- **A line key sent with `custom` or `not-sure` is ignored** rather than refused, because the form cannot produce it and refusing would cost a visitor a lead.
- **The shown-line lookup reads the database directly** (`IQuoteRequestStore.FindShownLineAsync`), because the cached public snapshot carries no line id.
- **No rate limit in this plan**, as the plan states (T-13-03 accepted until 13-06). The 429 is already listed in the controller docs, the OpenAPI snapshot and `docs/api/quote-requests.md`, as the plan asked.

## Deviations from Plan

### Auto-fixed and judgment calls

**1. [Rule 3 - Blocking] Compile-only types in the first RED commit**
- **Found during:** Task 1 RED
- **Issue:** The integration tests read the saved row through `QuoteRequest`, which did not exist, so a RED run would be a build failure (INVALID_RED), not a failing assertion.
- **Fix:** The RED commit carries a properties-only `QuoteRequest` and the `QuoteRequestStatus` enum. The tests then fail on the 404 against the planned 200.
- **Files:** `src/Csps.Domain/QuoteRequests/QuoteRequest.cs`, `QuoteRequestStatus.cs`
- **Commit:** `973b045e`

**2. [Rule 2 - Missing critical] Line key length cap**
- **Found during:** Task 2 GREEN
- **Issue:** A very long `productLineKey` would be sent to the database as a lookup value. No line key is over 40 characters, so such a key can never match.
- **Fix:** The validator refuses a key over `ProductLine.KeyMaxLength` with the product message. Its test (`ALineKeyLongerThanAnyLineKeyIsRefused`) was added in the GREEN commit, not in the RED commit, so that one rule was not driven by a prior failing run.
- **Files:** `CreateQuoteRequestRequestValidator.cs`, `CreateQuoteRequestRequestValidatorTests.cs`
- **Commit:** `78b5cd5d`

**3. [Rule 2 - Missing critical] Handler unit tests**
- **Issue:** The plan lists no handler unit tests, but the Application project must stay at or above 95% line coverage, and the handler's second domain check is not reachable through the validator.
- **Fix:** `CreateQuoteRequestHandlerTests` (six tests) with a pass-through validator for the domain re-check.
- **Commit:** `78b5cd5d`

**4. Commit trailer and branch.** The plan text names `Claude Opus 5.5` and the branch `gsd/phase-13-quote-inquiries`. This run was dispatched into a parallel worktree with its own branch and the orchestrator's attribution line (`Claude Sonnet 5.5`), so those were used. No branch was created, switched or merged.

**5. Task 1 handler maps only the name and the number.** As the plan says ("In this task the validator checks name and number only"), the handler passed no other field until Task 2, so no unchecked text reached the table.

**Total deviations:** 2 auto-added (Rule 2), 1 blocking fix (Rule 3), 2 notes. **Impact:** none on scope; the ProductLineKey rule is the only code that was not RED-first.

## Issues Encountered

- A first handler test build failed the `xUnit1051` analyzer (a NSubstitute `DidNotReceive` call with `default` cancellation tokens). Fixed with `Arg.Any<CancellationToken>()`.
- No flaky tests. Every failing run above was a deliberate RED.

## Verification Results

All run in this worktree, `CSPS_TEST_SQL=localdb` for database runs, preflight clean before the full runs.

- `CreateQuoteRequestTests`, `AuthorizationMatrixTests`, `AuthorizationCoverageTests`, `OpenApiSnapshotTests`: 605 total, 0 failed.
- Domain `QuoteRequestTests`: 32 passed. Application validator and handler tests: 57 passed.
- Infrastructure integration tests (whole project, includes `MigrationScriptTests` and `TriggerInventoryTests`): 1288 total, 1287 passed, 1 skipped (the live HIBP test, as before).
- Architecture tests: 290 passed.
- `dotnet build Csps.slnx -warnaserror`: 0 warnings, 0 errors. `dotnet format Csps.slnx --verify-no-changes --no-restore`: exit 0.
- `npm --prefix tools/openapi-gen run check`: types match the snapshot.
- Coverage gate: Domain 100% line (4537/4537) and 100% branch (1929/1929); Application 98.2% line.
- Acceptance greps: `QuoteRequest` in `CspsDbContext.cs` = 2; `/api/v1/public/quote-requests` in the matrix = 2; both Rules message greps = 1.
- `npm ci` in `tools/openapi-gen` installed only the already locked packages; no package was added or bumped.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-13-01 and T-13-02 are mitigated and tested. T-13-03 (flooding before 13-06) stays accepted: this endpoint has no per-address limit and no bot guard until plan 13-06, so the branch must not be deployed before then.

## Next Phase Readiness

- 13-02 and the plans after it can build on `QuoteRequest`, `IQuoteRequestStore` and the public controller. Later plans own the order link (`OrderId`, 13-20), the status history and `PhotosRemovedAtUtc` (13-16), photos (13-05), bot guards and limits (13-06) and the alert email (13-10).
- `QuoteRequestStatusNames` exists and is tested for the list and status plans.

## Self-Check: PASSED

- All created files were found on disk.
- Commits `973b045e`, `35ed46f0`, `0777c6cd` and `78b5cd5d` are ancestors of HEAD.
- The measured commit count is 4 (`rev-list --count` from the plan base).

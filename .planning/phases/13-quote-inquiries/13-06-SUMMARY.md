---
created: 2026-11-22T20:00:00-06:00
updated: 2026-11-22T20:00:00-06:00
phase: 13-quote-inquiries
plan: 06
subsystem: api
tags: [quote-requests, bot-guard, honeypot, rate-limiting, data-protection, advisory-lock, tdd, cwe-799, cwe-770, cwe-362, cwe-532]

requires:
  - phase: 13-quote-inquiries
    provides: "13-01 anonymous create and QuoteRequests table; 13-05 photo upload, QuoteRequestSettings, upload key"
  - phase: 12-consent-analytics-legal
    provides: "the page view per-address limit and the site-wide ceiling pattern, RateLimitRule.Problems"
provides:
  - "GET /api/v1/public/quote-requests/ticket (GetQuoteFormTicket): a Data Protection ticket (purpose Csps.QuoteTicket.v1) plus the photo rules { maxPhotos, maxBytes, maxPixels }; no-store; public-read limit"
  - "The create body takes ticket and the hidden subjectLine; a missing, changed or expired ticket is a 400 quote-requests.ticket-expired"
  - "Honeypot and minimum time (QuoteRequests:MinimumSeconds, 3): a normal-looking 200 with a made-up id, nothing saved, one log line with a reason code only"
  - "RateLimits:QuoteCreate (5 an hour per address) and RateLimits:QuoteCeiling (60 an hour site-wide), both checked at start"
  - "QuoteRequests:PerSenderPerDay (3): the same E.164 phone or email in 24 hours is a 429 rate-limited with a Retry-After; count and insert run under the new standing quote-requests lock (migration AddQuoteRequestsLock)"
  - "docs/api/quote-requests.md describes the ticket, honeypot, minimum time and the three limits"
affects: [13-07, 13-08, 13-09, 13-12, 13-16]

actuals:
  tokens: 21400
  tasks: 3
  commits: 6
plan_head_before: 0d16c25af42d132e4663b8bb9b744be411513fc6
plan_head_after: ba6f273c1196b1938c514f43532afcca13cafc4b

tech-stack:
  added: []
  patterns:
    - "The ticket holds the issue time inside a time-limited Data Protection payload; the age is also checked against the injected clock, so tests move the clock and the real clock is only a backstop"
    - "One global limiter keys per-address windows by route name plus address, and one site-wide window per route by a fixed key, so the page view and quote routes never share a window"
    - "A count-then-insert rule runs under a standing lock row taken first in the transaction; under read committed snapshot the count statement starts after the lock is had, so it sees the other send's commit"
    - "Case-insensitive email match uses EF.Functions.Collate with an explicit CI collation, not the database default"

key-files:
  created:
    - src/Csps.Application/Ports/IQuoteFormTickets.cs
    - src/Csps.Application/Ports/IQuoteBotCatchLog.cs
    - src/Csps.Application/Ports/QuoteSenderRecent.cs
    - src/Csps.Application/QuoteRequests/GetQuoteFormTicketHandler.cs
    - src/Csps.Application/QuoteRequests/QuoteFormTicketResponse.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteFormTickets.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteBotCatchLog.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261123013252_AddQuoteRequestsLock.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261123013252_AddQuoteRequestsLock.Designer.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteSenderLimitTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/QuoteRateLimitTests.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/QuoteRequestSettingsTests.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/GetQuoteFormTicketHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/QuoteRequests/QuoteFormTicketsTests.cs
  modified:
    - src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs
    - src/Csps.Application/QuoteRequests/CreateQuoteRequestRequest.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestSettings.cs
    - src/Csps.Application/Ports/IQuoteRequestStore.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestsRegistration.cs
    - src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs
    - src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Server/Controllers/PublicQuoteRequestsController.cs
    - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
    - src/Csps.Server/Security/RateLimitSettings.cs
    - src/Csps.Server/Security/RateLimitingRegistration.cs
    - src/Csps.Server/Security/SiteWideCeilingLimiter.cs
    - tests/Csps.Testing/CspsApiFactory.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestFixtures.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/CreateQuoteRequestTests.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksMigrationTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/quote-requests.md

key-decisions:
  - "The bot catch log is a port (IQuoteBotCatchLog) implemented in Infrastructure, because the Application project has no logging package and no package may be added"
  - "The ticket is checked twice: the time-limited protector refuses an old one by the system clock, and the age is compared again against the clock the handler passes, so tests can move time and the age is exact"
  - "A whitespace-only honeypot is not a fill, so autofill of blanks never drops a lead"
  - "The sender-limit 429 uses the same code (rate-limited) and detail as the per-address 429, as the plan says, with a Retry-After computed from the counted requests' times"
  - "Email match uses an explicit case-insensitive collation (Latin1_General_100_CI_AS) so it never depends on the database default"

patterns-established:
  - "Test hosts turn the quote guards down by default (MinimumSeconds 0, per-sender 50, rate limits 100000); RealLimitsFactory restores 5 and 60 an hour; tests that exercise a guard set its number"
  - "QuoteRequestFixtures.PostAsync fetches a ticket first when the body has no ticket member; a body with a null ticket sends none"

requirements-completed: [INQ-03]

coverage:
  - id: D1
    description: "A visitor with a fresh ticket is saved; the ticket answer carries the photo rules and is never cached"
    requirement: INQ-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs#ARealVisitorWithAFreshTicketIsSaved"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs#TheTicketAnswerCarriesThePhotoRulesAndIsNeverCached"
        status: pass
    human_judgment: false
  - id: D2
    description: "A filled honeypot or a ticket one tick under the minimum time gets a normal success shape, saves nothing and logs one reason code only; exactly 3 seconds is saved"
    requirement: INQ-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs#AFilledHoneypotLooksLikeSuccess"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs#ATooFastSendLooksLikeSuccessAndExactlyTheMinimumIsSaved"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestHandlerTests.cs#ATicketOneTickYoungerThanTheMinimumIsCaughtAndExactlyTheMinimumIsSaved"
        status: pass
    human_judgment: false
  - id: D3
    description: "An expired, changed, nonsense or missing ticket is a 400 quote-requests.ticket-expired and saves nothing (never a silent success)"
    requirement: INQ-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs#AnExpiredOrTamperedTicketIsA400AndNothingIsSaved"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteBotGuardTests.cs#NoTicketIsTheSame400"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/QuoteRequests/QuoteFormTicketsTests.cs"
        status: pass
    human_judgment: false
  - id: D4
    description: "The sixth create from one address in an hour is a 429 with a whole-second Retry-After; the site-wide ceiling stops many addresses and says the site is busy; a per-address refusal does not use the ceiling"
    requirement: INQ-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/QuoteRateLimitTests.cs#TheSixthCreateFromOneAddressIs429WithAWholeSecondRetryAfter"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/QuoteRateLimitTests.cs#TheSiteWideCeilingStopsManyAddressesAndSaysTheSiteIsBusy"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/QuoteRateLimitTests.cs#ACreateRefusedPerAddressDoesNotUseUpTheSiteWideCeiling"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every number is a setting checked at start, naming the setting and never the value; the ticket, photo and page view routes keep their own limits"
    requirement: INQ-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/QuoteRateLimitTests.cs#AnUnusableQuoteLimitStopsStartUpAndNamesTheSettingNotTheValue"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/QuoteRequests/QuoteRequestSettingsTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/QuoteRateLimitTests.cs#TheQuoteCeilingLeavesTheTicketThePhotoAndThePageViewRoutesAlone"
        status: pass
    human_judgment: false
  - id: D6
    description: "The fourth request in 24 hours from one phone (any written form) or one email (any case) is a 429 and is not saved; the window slides at exactly 24 hours; requests of one sender are separate rows until the limit"
    requirement: INQ-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteSenderLimitTests.cs#TheFourthRequestFromOnePhoneInADayIs429AndTheDayWindowSlides"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteSenderLimitTests.cs#TheSameEmailCountsAcrossPhonesAndIgnoresCase"
        status: pass
    human_judgment: false
  - id: D7
    description: "Two sends at once from one sender never make a fourth row (count and insert under the quote-requests lock); caught bots and replays are not counted"
    requirement: INQ-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteSenderLimitTests.cs#ParallelSendsFromOnePhoneNeverMakeAFourthRow"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteSenderLimitTests.cs#ACaughtBotIsNotCountedAndAReplayIsNotCountedAgain"
        status: pass
    human_judgment: false

duration: 130min
completed: 2026-11-22
status: complete
---

# Phase 13 Plan 06: Bot guards for the quote form Summary

*Created: 2026-11-22T20:00:00-06:00 · Updated: 2026-11-22T20:00:00-06:00*

**The quote form now needs a server-signed ticket, ignores a filled honeypot and a send that is too fast with a normal-looking success, and is limited to 5 sends an hour per address, 60 an hour for the whole site and 3 a day per phone or email, with no CAPTCHA and no real lead silently dropped.**

## Performance

- **Duration:** about 130 min (no start stamp was recorded; estimated from the first and last commit)
- **Completed:** 2026-11-22
- **Tasks:** 3 (a tracer and two TDD tasks)
- **Commits:** 6 test and feature commits, plus this summary
- **Files changed:** 41 (about 5,800 added lines; 4,000 of them are the generated migration designer, the OpenAPI snapshot and the web types)

## Accomplishments

- **The ticket (Pattern 2).** `GET /api/v1/public/quote-requests/ticket` answers a ticket made with a time-limited Data Protection protector and the photo rules the form checks (`maxPhotos` 5, `maxBytes` 10,485,760, `maxPixels` 25,000,000). A missing, changed or too old ticket is a 400 `quote-requests.ticket-expired` on the `ticket` field. The ticket is judged first, so a real visitor who left the tab open gets a visible error and the form can fetch a new ticket (Pitfall 4).
- **Honeypot and minimum time (D-25).** A filled `subjectLine`, or a ticket younger than `QuoteRequests:MinimumSeconds` (3), gets a 200 in the normal shape with a made-up id and the declared photo places. Nothing is saved. One log line carries the reason code (`honeypot` or `too-fast`) and nothing else. A ticket exactly 3 seconds old is saved; one tick younger is caught.
- **Per-address and site-wide limits (D-26).** `RateLimits:QuoteCreate` (5 an hour) and `RateLimits:QuoteCeiling` (60 an hour). The global limiter now keeps a window per route and address, and one shared window per route for the ceiling. The per-address window is taken first, so a refused create never uses a ceiling permit. A ceiling refusal says the site is busy. Retry-After is whole seconds, rounded up, at least 1. A bad number stops start-up naming the setting, never the value.
- **Per-sender limit (D-37).** `QuoteRequests:PerSenderPerDay` (3). The same E.164 number (so `0917 123 4567` and `+63 917 123 4567` match) or the same email (any case) is a 429 `rate-limited`, not saved, with a Retry-After for when enough earlier requests leave the window. The count and the insert run under the new standing `quote-requests` lock row, so two sends at once make one row, not two.
- **Docs and contract.** `docs/api/quote-requests.md`, the OpenAPI snapshot and the web types are updated; `npm --prefix tools/openapi-gen run check` passes.

## Task Commits

1. **Task 1 (tracer): the ticket, honeypot and minimum time**
   - RED: `71abc649` (test)
   - GREEN: `99bc43b5` (feat)
2. **Task 2 (TDD): per-address and site-wide quote limits**
   - RED: `53d6adc6` (test)
   - GREEN: `8d8f0976` (feat)
3. **Task 3 (TDD): per-sender daily limit under a lock**
   - RED: `05fc7b7e` (test)
   - GREEN: `ba6f273c` (feat)

No refactor commit: nothing needed cleaning after GREEN.

## TDD Gate Compliance

RED evidence came from xUnit v3 `--report-xunit-junit` reports, each checked with `gsd-tools check tdd-red-evidence` and returning `RED_EVIDENCE_OK`, reason `target_test_failed`.

| Run | Target test | Result | Semantic assessment |
|---|---|---|---|
| Task 1, Server integration | `QuoteBotGuardTests.NoTicketIsTheSame400` | 7 total, 7 failed | The create with no ticket answered 200 where 400 was planned; the other six failed on a 404 from the missing ticket route (the planned first assertion) |
| Task 2, Server integration | `QuoteRateLimitTests.TheSixthCreateFromOneAddressIs429WithAWholeSecondRetryAfter` | 10 total, 10 failed | The sixth create answered 200 where 429 was planned; the four start-up cases found no start-up failure for a bad quote limit; the policy test found no `quote-create` metadata |
| Task 3, Server integration | `QuoteSenderLimitTests.TheFourthRequestFromOnePhoneInADayIs429AndTheDayWindowSlides` | 5 total, 3 failed | The fourth request from one phone answered 200 where 429 was planned; the email and parallel tests failed the same way |
| Task 3, Infrastructure integration | `DatabaseLocksMigrationTests` | 3 total, 2 failed | 68 standing lock rows where 69 (with `quote-requests`) were planned |

Notes that matter for the gate:

- **Unexpected green, recorded as characterization tests.** In `QuoteSenderLimitTests`, `ARequestWithNoEmailNeverMatchesOtherRequestsWithNoEmail` and `ACaughtBotIsNotCountedAndAReplayIsNotCountedAgain` passed on their first run, because without a limit nothing is refused. They guard against a wrong implementation (a null email matching every null email, a bot or replay being counted), and they fail if the limit counts the wrong rows.
- **Several unit tests were written with GREEN, not RED-first:** `QuoteFormTicketsTests` (Infrastructure), `GetQuoteFormTicketHandlerTests`, `QuoteRequestSettingsTests` and the new `CreateQuoteRequestHandlerTests` cases. They hold Application coverage and the ticket edges (exactly 24 hours is good, one tick older is not, a clock that moved back is age zero, payloads that are not a time). They passed on the first run.

## Decisions Made

- **Log through a port.** The Application project has no logging package and none may be added, so `IQuoteBotCatchLog` is implemented in Infrastructure with a source-generated message. The plan said "one source-generated log line"; this keeps that and keeps the onion rule.
- **Two time checks on the ticket.** `ToTimeLimitedDataProtector` is kept (the plan names it), but it uses the system clock, so the age is also compared with the clock the handler passes. Tests move a fake clock and still get an exact answer.
- **Judgment calls the plan did not make** (owner may change): the ticket-expired message is "The form timed out. Please send it again." (the UI-SPEC has no copy because the form resends without telling the visitor); a whitespace-only honeypot is not a fill; a made-up success echoes at most the first 5 declared file names, cleaned.
- **The sender 429 detail** is the per-address text ("Too many attempts from this address..."), as the plan says. It reads a little oddly for a per-phone limit, but the form shows its own Messenger copy for every 429 (UI-SPEC).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two port files the plan did not list**
- **Issue:** The create handler needs to log a caught send and the Application project cannot reference a logging package.
- **Fix:** Added `src/Csps.Application/Ports/IQuoteBotCatchLog.cs` and `src/Csps.Infrastructure/QuoteRequests/QuoteBotCatchLog.cs`; added `src/Csps.Application/Ports/QuoteSenderRecent.cs` for the per-sender read.
- **Commits:** `99bc43b5`, `ba6f273c`

**2. [Rule 2 - Missing critical] Test host defaults and fixtures**
- **Issue:** Every existing test that posts a quote request would now meet a missing ticket, the 3 second minimum, the 5 an hour limit and the 3 a day sender limit.
- **Fix:** `CspsApiFactory` turns the quote guards down (minimum 0, per-sender 50, rate limits 100000) and `RealLimitsFactory` restores 5 and 60 an hour; `QuoteRequestFixtures.PostAsync` fetches a ticket first; the replay test reuses one body. `RateLimitTests` gained rows for the ticket (600) and the create (5). `DatabaseLocksMigrationTests` now expects 69 rows. None of these were in the plan's file list.
- **Commits:** `99bc43b5`, `53d6adc6`, `05fc7b7e`

**3. [Plan truth not met as worded] A replay is not free in the per-address and site-wide windows**
- **Truth:** "a replay with the same Idempotency-Key ... is not counted again against any limit".
- **What holds:** the replay returns the stored answer, saves nothing, and is not counted against the per-sender limit or the bot catches (tested in `ACaughtBotIsNotCountedAndAReplayIsNotCountedAgain`).
- **What does not:** the rate limiter runs before the idempotency middleware by design (SEC-03: a throttled request costs nothing, nothing is read), so a replay still uses one permit in the per-address and site-wide windows. Changing that means reordering the middleware or reading the idempotency table inside the limiter, which is an architecture change (Rule 4). Documented in `docs/api/quote-requests.md`. A visitor retrying a lost reply a few times stays far under 5 an hour.

**4. Commit trailer and branch.** The plan text names `Claude Opus 5.5` and `gsd/phase-13-quote-inquiries`. This run was dispatched into a parallel worktree with its own branch and the orchestrator's attribution line (`Claude Sonnet 5.5`), so those were used. No branch was created, switched or merged.

**Total deviations:** 2 additions (Rule 2 and 3), 1 plan truth only partly met (needs an owner or planner call if a full replay exemption is wanted), 1 note.

## Review follow-up (13-REVIEW-W2 WR-01)

WR-01 (the anonymous photo action takes the app-wide two-at-a-time upload slots that staff also use) is **not changed** by this plan. The create action has no `[UploadSlot]` and the new limits cover only the create route. The photo route keeps its per-address `images-upload` window (30 per 10 minutes) and the shared slots. The new ticket check does not sit in front of the photo route either, so a caller with no ticket can still reach the photo action (it still needs a valid request id and upload key to get past the 404). WR-01 and its fix options stay open for a later plan.

## Issues Encountered

- **Flake, recorded:** `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` failed 3 times in about 7 runs of the whole matrix class, each time on `POST /api/testing/site-content` answering 500 for one caller (a test-only endpoint that resets site content, hit 4 times by 16 parallel callers). Alone, the test passed 3 of 3. The failing call is not a quote route and none of this plan's code runs on it. I did not change it. The final whole-project run passed (3089 of 3089).
- A first CA1311 / CA1862 analyzer error rejected `ToLower()` in the sender query; the match now uses `EF.Functions.Collate` with an explicit case-insensitive collation.
- No server was started on a project port; all runs used the in-memory test host and LocalDB test databases.

## Verification Results

All run in this worktree with `CSPS_TEST_SQL=localdb`, preflight clean (ports free, no other project processes).

- Task 1 verify set (`QuoteBotGuardTests`, `CreateQuoteRequestTests`, `UploadQuotePhotoTests`, `QuotePhotoFailureTests`, `AuthorizationMatrixTests`, `OpenApiSnapshotTests`): 616 total, 0 failed.
- `RateLimitTests`: 38 total, 0 failed (after the ticket row), then with the create row in the Task 2 run.
- Task 2 verify set (`QuoteRateLimitTests`, `AnalyticsRateLimitTests`, `PageViewCeilingRouteTests`, `RateLimitTests`, `PublicReadRateLimitTests`, `ImageUploadRateLimitTests`, `RateLimitPartitionTests`): 85 total, 0 failed.
- Task 3 verify set (`QuoteSenderLimitTests`, `QuoteBotGuardTests`, `CreateQuoteRequestTests`): 24 total, 0 failed.
- Infrastructure integration tests, whole project (includes `MigrationScriptTests`, `TriggerInventoryTests`, `DatabaseLocksMigrationTests`, `QuoteFormTicketsTests`): 1302 total, 1301 passed, 1 live-only skipped.
- Application unit tests: 3303 passed. Domain unit tests: 2064 passed. Architecture tests: 290 passed.
- Whole Server integration project (run after the last commit of code): 3089 total, 3089 passed, 0 failed (including the matrix class).
- `dotnet build Csps.slnx -warnaserror`: 0 warnings, 0 errors. `dotnet format Csps.slnx --verify-no-changes --no-restore`: exit 0.
- `npm --prefix tools/openapi-gen run check`: types match the snapshot.
- Acceptance greps: `Csps.QuoteTicket.v1` in `QuoteFormTickets.cs` = 1; `quote-requests.ticket-expired` in `QuoteRequestErrors.cs` = 1; `quote-create` in `RateLimitSettings.cs` = 1; `RateLimits:QuoteCeiling` in `RateLimitSettings.cs` = 1; `"quote-requests"` in `DatabaseLocks.cs` = 1.
- The coverage gate script was not run (no Domain change; the Application tests above cover each new branch).

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-13-15 (flood), T-13-17 (one reason-code line, no values, checked in `AFilledHoneypotLooksLikeSuccess` and `ATooFastSendLooksLikeSuccess`) and T-13-19 (race, tested in `ParallelSendsFromOnePhoneNeverMakeAFourthRow`) are mitigated and tested. T-13-16 holds because the ticket comes from a same-origin GET and the create needs the `Idempotency-Key` header. T-13-18 (carrier NAT) is accepted as planned: the numbers are settings.

## Next Phase Readiness

- 13-09 and 13-12 build the form on the ticket: fetch the ticket when the form opens, send `ticket` and an empty hidden `subjectLine` (a name no autofill matches), and on a `quote-requests.ticket-expired` 400 fetch a new ticket and resend once with a new `Idempotency-Key`. The 429 copy and the Messenger link come from the UI-SPEC.
- 13-07 (staff alert email) can add its own standing lock row the same way (`DatabaseLocks` constant plus a migration); the standing count is now 69.
- The owner may tune `QuoteRequests:MinimumSeconds`, `QuoteRequests:PerSenderPerDay`, `RateLimits:QuoteCreate` and `RateLimits:QuoteCeiling` in configuration after launch; the log lines `honeypot` and `too-fast` show if catches spike.

## Self-Check: PASSED

- All 15 created source and test files were found on disk.
- Commits `71abc649`, `99bc43b5`, `53d6adc6`, `8d8f0976`, `05fc7b7e` and `ba6f273c` are ancestors of HEAD.
- The measured commit count from the plan base is 6 (`rev-list --count`), before this summary's own commit.
- Gate order holds: each `test(13-06)` commit precedes its `feat(13-06)` commit.

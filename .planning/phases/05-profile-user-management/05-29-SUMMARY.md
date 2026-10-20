---
phase: 05-profile-user-management
plan: 29
subsystem: api
tags: [audit-log, viewer, manager-only, filters, business-days, done-by, self-service, openapi, audit-02, user-06, d-26, d-27, d-28, d-29, d-40]
created: "2026-10-18T10:21:00-05:00"
updated: "2026-10-18T10:21:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-17 ActorRef(Id, Name, FormerStaff); 05-27 and earlier Phase 4 and 5 audit codes and the AuditKey target-id form; 01 AuditEntry, BusinessClock.UtcRange and the append-only AuditLog"
provides:
  - "GET /api/v1/audit-log (Manager policy, never cached): { items, total, page, pageSize } newest first (OccurredAtUtc then Id descending), last 7 business days by default, Admin 403, anonymous 401"
  - "Filters from, to (business days YYYY-MM-DD, whole Manila days), actor (a user id or system), action (a known code), target (a user id, including their session events); 400 field errors with plain messages"
  - "AuditLogItem { id, occurredAt, doneBy { kind user|system|unknown-account, person }, action, doneTo, detail, ipPrefix (with /24 or /48), device, reference }"
  - "AuditRetention.Months = 8, AuditActions.SelfService (21 codes), IAuditLogReader + AuditLogReader, ListAuditLogHandler, ListAuditLogRequest(+Validator), AuditLogResponse, DoneBy, DoneByKinds, AuditActorFilter, AuditLogController"
affects: [05-33 Audit Log page, 05-41 people list and viewer docs, 05 security review]

actuals:
  tokens: 25600
  tasks: 2
  commits: 4
plan_head_before: 87e10b6e4f21fcd60165cfa3e7e44c6c58ec1ab8
plan_head_after: 4da3e0e67d7c14ef730c6da2994c381b70b0e159

tech-stack:
  added: []
  patterns:
    - "One done-by rule in the handler (actor, else the person a self-service entry is about, else unknown account, else System) and the same rule written as SQL for the actor filter, so what a row shows and what the filter matches agree"
    - "The reader returns stored rows with their people resolved (ActorRef) and the handler decides the meaning; names always come from the user row, never from the log"
    - "A validator that needs the business clock takes IBusinessCalendar and checks dates in one CustomAsync rule; the filter text parsing lives in one internal helper shared with the handler"

key-files:
  created:
    - src/Csps.Domain/Auditing/AuditRetention.cs
    - src/Csps.Application/Ports/IAuditLogReader.cs
    - src/Csps.Application/Audit/AuditLogResponse.cs
    - src/Csps.Application/Audit/ListAuditLogRequest.cs
    - src/Csps.Application/Audit/ListAuditLogRequestValidator.cs
    - src/Csps.Application/Audit/ListAuditLogHandler.cs
    - src/Csps.Infrastructure/Auditing/AuditLogReader.cs
    - src/Csps.Server/Controllers/AuditLogController.cs
    - tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs
    - tests/Csps.Application.UnitTests/Audit/ListAuditLogHandlerTests.cs
  modified:
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "ipPrefix is returned with its length (203.0.113.0/24, 2001:db8:abcd::/48): the log stores the bare network address, and UI-SPEC shows the row with the length, so the handler adds /24 or /48 and the page needs no logic."
  - "AuditActions.SelfService holds 21 codes: sign-in, sign-in failure, lockout, the five sign-in code events, signed-in and signed-out, refresh reuse, session revoked(s), reset requested/completed/link-invalid, password changed, breach found/unavailable, invitation accepted, email confirmed and canceled. Manager and signed-in profile actions are not in it."
  - "The actor filter and the done-by column use one rule. actor=system matches no-actor entries that are not a person's self-service step or an unknown-account sign-in failure, so a self-service step with no resolvable person (reset link invalid) shows System and also matches actor=system."
  - "With only one date: from alone means up to today, to alone means from the start of the kept window. Neither means today and the 6 days before. The handler clamps a start to the end if the business day turns between the validator's clock read and its own."
  - "A missing browser is stored as Unknown, so device is the string Unknown (not null) for entries with no User-Agent; the page can word it 'Unknown browser'."
  - "actor accepts only system (lower case) or a dashed GUID; SYSTEM or a 32-digit GUID is a 400, so the client has one spelling to send."

patterns-established:
  - "Audit viewer tests share one class database and the log is append-only, so every test finds its own rows by person id or by a unique reference, and inserts old or odd entries with AuditEntry.Create instead of UPDATE"

requirements-completed: [AUDIT-02, USER-06]

coverage:
  - id: D1
    description: "A Manager reads the audit log newest first with who did what to whom: doneBy, doneTo, detail, ipPrefix, device and reference; the person signing in is the done-by of their own sign-in and code events; a Manager's action names the Manager and the person; a deleted person stays named and is marked former staff"
    requirement: "AUDIT-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#AManagerReadsTheLastWeekNewestFirstWithWhoDidWhatToWhom"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#ADeletedPersonStaysNamedAndIsMarkedFormerStaff"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Audit/ListAuditLogHandlerTests.cs#ASelfServiceEntryWithNoActorWasDoneByThePersonItIsAbout"
        status: pass
    human_judgment: false
  - id: D2
    description: "The default range is the last 7 business days (the boundary is the start of the sixth day back in Manila time); equal times keep write order by id; a role change reads before its session revocation in write order"
    requirement: "USER-06"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#OnlyTheLastSevenBusinessDaysAreListedAndTheBoundaryIsTheStartOfTheSixthDayBack"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#EntriesWithTheSameTimeAreOrderedByIdDescendingSoPagingIsStable"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#ARoleChangeAndItsSessionRevocationReadInTheOrderTheyWereWritten"
        status: pass
    human_judgment: false
  - id: D3
    description: "Filters by actor (a user id also matching their own self-service steps, or system), action and target (including the person's session events) are applied before paging; a day runs from 00:00 to the end of that Manila day; the oldest kept day is reachable; paging totals count the whole match; no match is an empty list"
    requirement: "AUDIT-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#TheActorFilterFindsWhatAPersonDidAndWhatTheyDidAsThemselvesAndSystemMeansNobody"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#ADayRunsFromMidnightToTheEndOfThatManilaDayAndTheNextMidnightIsLeftOut"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#TheTargetFilterFindsEntriesAboutAPersonIncludingTheirSessionEvents"
        status: pass
    human_judgment: false
  - id: D4
    description: "The server half of the date and filter validation answers 400 with the UI-SPEC messages: not a real date, outside the kept window or in the future, start after end, a bad actor or target id, an unknown action, a bad page or size"
    requirement: "AUDIT-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#ABadFilterIsA400NamingTheFieldWithThePlainMessage"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Audit/ListAuditLogHandlerTests.cs#ABadDateOrRangeIsA400WithThePlainMessageAndTheLogIsNeverRead"
        status: pass
    human_judgment: false
  - id: D5
    description: "Managers only and no export: an Admin gets 403, anonymous 401, the matrix row passes and the export-style paths are 404; details are returned exactly as stored"
    requirement: "AUDIT-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#AnAdminIsRefusedWith403AndAnAnonymousCallerWith401"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs#ThereIsNoExportRoute"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Audit/ListAuditLogHandlerTests.cs#EveryStoredFieldPassesThroughAndNothingIsAdded"
        status: pass
    human_judgment: false
  - id: D6
    description: "The contract snapshot and the generated TS types carry the new route and its five filters"
    verification:
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument"
        status: pass
    human_judgment: false
  - id: D7
    description: "The wording of the new 400 messages for the actor, target and action filters ('Choose a person from the list.', 'Choose an action from the list.') was chosen by the executor; UI-SPEC gives text only for the dates"
    verification: []
    human_judgment: true
    rationale: "These messages are only reachable by a crafted URL (the selects send valid ids), but the owner reviews new strings in 05-37 (D-48)."

duration: 31min
completed: 2026-10-18
---

# Phase 5 Plan 29: Audit Log Viewer API Summary

**A Manager-only `GET /api/v1/audit-log` lists every audited event newest first with who did it, who it was done to, the stored detail, truncated network, browser family and reference, filtered by business-day range, actor, action and target, with the kept-window floor and plain 400 messages.**

## Performance

- **Duration:** about 31 min
- **Started:** 2026-10-18T14:50:00Z (approximate)
- **Completed:** 2026-10-18T15:21:00Z
- **Tasks:** 2
- **Files modified:** 17 (10 created, 7 modified)

## Accomplishments

- **Tracer (Task 1):** the route, the reader, the handler and the done-by rule work end to end. A person signing in is the done-by of their own sign-in, code and session events (these have no actor), a Manager's action names the Manager and the person, an anonymous failed sign-in with no account is `unknown-account`, and anything else is `system`. People come from the user row (one lookup for session owners, one for the people), so a deleted person keeps their name and is marked `formerStaff`.
- **Default range and order:** with no dates the range is today and the 6 business days before it (the start of the sixth day back, Manila time). Entries are ordered by time then id, newest first, so entries written in the same request read in write order.
- **Filters (Task 2):** `from` and `to` are whole Manila days (00:00 of the first to the start of the day after the last); `actor` is a user id, which also matches that person's own self-service steps and their session events, or `system`; `action` is a known code; `target` is a user id including their session events. All are applied in SQL before paging, and `total` is the whole match.
- **Validation (server half of OR-3):** real calendar dates only, inside the kept window (8 months back to today), start on or before end, ids as dashed GUIDs, a known action, and the shared page rules. Messages are the UI-SPEC wording ("Enter a real date.", "Choose a date from Feb 19, 2026 to today.", "The start date must be on or before the end date.").
- **Prohibitions:** Admins get 403 and anonymous 401; there is no export route; the reader is AsNoTracking LINQ only and returns the stored detail words untouched (D-40).

## Task Commits

1. **Task 1 (tracer): a Manager reads the last 7 days newest first** - `15e37e5` (test, RED), `3728fa0` (feat, GREEN)
2. **Task 2: filters by who, what, whom and business-day range** - `d8cb426` (test, RED), `4da3e0e` (feat, GREEN)

**Plan metadata:** recorded in the docs commit that follows this file (`docs(05-29): complete audit log viewer API plan`).

The tracer gate (Task 1) was verified end to end before expanding: `AuditLogEndpointTests` 8/8, `AuditActionsTests`, the authorization matrix and the contract snapshot all passed.

## TDD Gate Compliance

Both tasks have a `test(05-29)` RED commit before the `feat(05-29)` GREEN commit. No REFACTOR commits were needed.

- **RED 1 (`15e37e5`):** `AuditLogEndpointTests`, 7 of 8 failed on the planned assertions (the route did not exist: 404 where 200, 401 or 403 were expected). The eighth, `ThereIsNoExportRoute`, passes by design because it guards a prohibition. `semanticAssessment`: the target tests executed and failed for the intended reason; no compile, setup or discovery fault.
- **RED 2 (`d8cb426`):** 8 of 17 failed on the planned assertions (filters ignored: whole lists returned where one entry or none was expected; 200 where 400 was expected). The paging test passed at RED only because it ran first in a fresh database; it is robust once the target filter exists. `semanticAssessment`: intended failures only.
- The xUnit MTP report is not a format `gsd check tdd-red-evidence` supports, so the semantic inspection above is the evidence (same as 05-26 and 05-27).
- Tests that name a new type (`AuditActionsTests`, `ListAuditLogHandlerTests`) cannot compile in a RED commit without making the whole run INVALID_RED, so they were written in the GREEN commit of the same task; the endpoint tests for the same behavior were RED first.

## Files Created/Modified

- `src/Csps.Domain/Auditing/AuditRetention.cs`, `AuditActions.cs` - the 8-month constant and the self-service code list
- `src/Csps.Application/Ports/IAuditLogReader.cs` - the port, `AuditLogQuery`, `AuditActorFilter`, `AuditLogEntryView`, `AuditLogPage`
- `src/Csps.Application/Audit/*` - `ListAuditLogRequest` (with the shared filter parsing), the validator (clock-aware), the handler (range, done-by, network length), `AuditLogResponse`, `AuditLogItem`, `DoneBy`, `DoneByKinds`
- `src/Csps.Infrastructure/Auditing/AuditLogReader.cs`, `DependencyInjection.cs` - SQL filters and the one-lookup-each person resolution
- `src/Csps.Server/Controllers/AuditLogController.cs`, `Composition/ApplicationRegistration.cs` - the route and registration
- `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` - regenerated contract (`ListAuditLog`)
- Tests: `AuditLogEndpointTests` (17), `ListAuditLogHandlerTests` (60 cases), `AuditActionsTests` (+3), matrix row

## Decisions Made

See `key-decisions` above. In short: the network is returned with its length, the self-service list, one done-by rule for rows and for the actor filter, one-sided date ranges, `Unknown` device text, and strict actor spelling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The page rules were put in the validator in Task 1**
- **Found during:** Task 1
- **Issue:** The plan creates `ListAuditLogRequestValidator.cs` in Task 2, but Task 1 already takes `page` and `pageSize`; without a check, `pageSize=100000000` would be passed to `Take` on an 8-month table (T-05-85).
- **Fix:** Task 1 creates the validator with the shared page and size rules (SEC-03); Task 2 extends it with the dates and filters.
- **Files modified:** `src/Csps.Application/Audit/ListAuditLogRequestValidator.cs`, `src/Csps.Server/Composition/ApplicationRegistration.cs`
- **Committed in:** `3728fa0`, `4da3e0e`

**2. [Rule 3 - Blocking] The validator is registered scoped in `ApplicationRegistration`, not singleton in `AuthRegistration`**
- **Found during:** Task 2
- **Issue:** The date rules need `IBusinessCalendar`, which is scoped; the other validators are singletons in `AuthRegistration.cs`.
- **Fix:** `AddScoped<IValidator<ListAuditLogRequest>, ListAuditLogRequestValidator>()` next to the handler.
- **Files modified:** `src/Csps.Server/Composition/ApplicationRegistration.cs`
- **Committed in:** `3728fa0`

**3. [Rule 2 - Missing critical] `ipPrefix` carries its length**
- **Found during:** Task 1
- **Issue:** The plan says `ipPrefix (/24 or /48 or null)`, but the log stores only the network address (`203.0.113.0`); UI-SPEC shows `203.0.113.0/24`.
- **Fix:** The handler appends `/24` for IPv4 and `/48` for IPv6, so 05-33 shows the value as is.
- **Files modified:** `src/Csps.Application/Audit/ListAuditLogHandler.cs`
- **Committed in:** `3728fa0`

**4. [Rule 2 - Missing critical] One-sided date ranges and a midnight clamp**
- **Found during:** Task 2
- **Issue:** The plan defines no meaning for a request with only `from` or only `to`, and the validator and handler read the clock separately, so the day could turn between them and leave a start after the end (an exception, a 500).
- **Fix:** Defined the one-sided ranges (see decisions) and clamped the start to the end; both have tests.
- **Files modified:** `src/Csps.Application/Audit/ListAuditLogHandler.cs`
- **Committed in:** `4da3e0e`

---

**Total deviations:** 4 auto-fixed (3 missing critical, 1 blocking)
**Impact on plan:** All necessary for safety or for a defined contract. No new packages and no scope creep.

## Issues Encountered

- A stray `cat > /tmp/...` in one of my shell commands waited on input and moved the command to the background; I ended only that one `cat` process (mine, started in that minute). The sed edits in the same command had already applied once it ended, and the repository was unaffected.
- `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` still shows a line-ending-only difference from an earlier plan; it was left alone as instructed.

## Verification

- `AuditLogEndpointTests` 17/17, `ListAuditLogHandlerTests` 60/60, `AuditActionsTests` 18/18, `OpenApiSnapshotTests` and `AuthorizationMatrixTests` pass.
- Full runs: Csps.Server.IntegrationTests 1030/1030, Csps.Infrastructure.IntegrationTests 502 passed 1 skipped, Csps.ArchitectureTests 217/217, Csps.Application.UnitTests 865/865, Csps.Domain.UnitTests 603/603.
- Coverage gate: Csps.Domain 100% line and branch; Csps.Application 99.7% line (rule 95%).
- `npm --prefix tools/openapi-gen run check` passes.
- Acceptance greps: `Policies.Manager` in the controller (1), `Months = 8` in `AuditRetention.cs` (1), `/api/v1/audit-log` in the matrix (1), `AuditRetention.Months` in the validator and the handler, the order-message text once in the validator.
- Staged-diff gitleaks scan was clean for every commit.

## Known Stubs

None.

## Threat Flags

None. The one new route is the surface in the plan's threat model (T-05-83 to T-05-86): Manager policy with matrix rows, names only from user rows with truncated network and browser family, a date floor with the default 7 days and the page-size cap, and a read-only reader.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-33 (Audit Log page) can call `GET /api/v1/audit-log?from&to&actor&action&target&page&pageSize` through the generated `ListAuditLog` operation. Field errors come back under `from`, `to`, `actor`, `action`, `target`, `page` and `pageSize`; the start-after-end message is on `from`.
- Plan 05-41 adds `GET /api/v1/audit-log/people` to the same port and controller and the "Viewing the log" docs. `docs/operations/audit-log.md` was not touched here.
- Owner wording review (D-48): the three new filter messages ('Choose a person from the list.', 'Choose an action from the list.') for 05-37.

## Self-Check: PASSED

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*

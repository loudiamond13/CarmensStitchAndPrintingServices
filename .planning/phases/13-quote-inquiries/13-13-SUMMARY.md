---
created: 2026-11-23T11:30:00-06:00
updated: 2026-11-23T11:30:00-06:00
phase: 13-quote-inquiries
plan: 13
subsystem: site-content
tags: [quote-alerts, email-outbox, rate-limit, audit, tdd, cwe-532, cwe-862]
status: complete

requires:
  - phase: 13-quote-inquiries
    provides: "13-07 ISiteContentStore.GetQuoteAlertsEmailAsync and QuoteAlertsCard, 13-10 QuoteAlert kinds and the Quote alerts footer"
provides:
  - "AuthEmailKind.QuoteAlertTest = 14 and QuoteAlertTestEmail(To) with the 'Test: quote alerts work' template"
  - "POST /api/v1/site-settings/quote-alerts/test (SendQuoteAlertTest, Manager only): 202, 409 site-settings.no-quote-alerts-address, 422 site-settings.quote-alerts-address-undeliverable, 429"
  - "SendQuoteAlertTestHandler: queues the email and audits quote-alerts.test-sent (no detail) in one save"
  - "RateLimitPolicies.QuoteAlertTest = quote-alerts-test and QuoteAlertTestRateLimit (RateLimits:QuoteAlertTest, 3 in 10 minutes)"
  - "AuditActions.QuoteAlertsTestSent (catalog 133) and the web label 'Quote alerts test email sent'"
  - "siteSettingsService.sendQuoteAlertTest(idempotencyKey) and the Send Test Email button with its R5 states"
affects: [13-26]

actuals:
  tokens: 18000
  tasks: 2
  commits: 4
plan_head_before: 8ff68a31280dd639d52646d5889332605ebb6d20
plan_head_after: 4c88901ca761d5e0df51517e968f8f62769d0299

tech-stack:
  added: []
  patterns:
    - "A Manager action that only queues an email: read the saved value, enqueue, audit with no detail, one SaveChanges"
    - "A button that waits for a saved value: aria-disabled plus a muted reason linked by aria-describedby, computed from useWatch against the saved baseline"

key-files:
  created:
    - src/Csps.Application/Content/SendQuoteAlertTestHandler.cs
    - tests/Csps.Server.IntegrationTests/Content/QuoteAlertTestEmailTests.cs
    - tests/Csps.Application.UnitTests/Content/SendQuoteAlertTestHandlerTests.cs
  modified:
    - src/Csps.Application/Email/AuthEmail.cs
    - src/Csps.Application/Content/SiteContentErrors.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Infrastructure/Email/EmailRenderer.cs
    - src/Csps.Server/Controllers/SiteSettingsController.cs
    - src/Csps.Server/Composition/ContentApplicationRegistration.cs
    - src/Csps.Server/Security/RateLimitSettings.cs
    - src/Csps.Server/Security/RateLimitingRegistration.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs
    - tests/Csps.Testing/CspsApiFactory.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/modules/admin/services/siteSettingsService.ts
    - web/src/modules/admin/services/siteSettingsService.test.ts
    - web/src/modules/admin/components/QuoteAlertsCard.tsx
    - web/src/modules/admin/components/QuoteAlertsCard.test.tsx
    - web/src/modules/admin/components/BusinessInfoTab.tsx
    - web/src/modules/admin/siteContentCopy.ts
    - web/src/modules/admin/auditCopy.ts
    - web/src/modules/admin/auditCopy.test.ts
    - docs/api/site-content.md

key-decisions:
  - "The test goes to the saved address only; the request has no body, so a typed but unsaved address can never be mailed"
  - "The audit entry has no detail at all, so the address cannot leak into the audit log (CWE-532); the handler logs nothing"
  - "The limit is a per-connection-address policy like every other RateLimits section; the matrix database has no saved address, so its Manager row is 409"
  - "A failed test keeps its Idempotency-Key, so a retry after a dropped connection replays instead of sending twice; a sent test resets the key"

requirements-completed: [INQ-04]

coverage:
  - id: D1
    description: "A Manager's test is queued to the saved address as one QuoteAlertTest row, the sink gets 'Test: quote alerts work', and one quote-alerts.test-sent entry is written with no address in the audit detail or the log"
    requirement: INQ-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/QuoteAlertTestEmailTests.cs#AManagerQueuesTheTestToTheSavedAddressAndItIsAuditedWithoutTheAddress"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Content/SendQuoteAlertTestHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Anonymous 401, Admin 403, Manager 409 in the matrix; 409 with no saved address and 422 for an undeliverable one queue nothing"
    requirement: INQ-04
    verification:
      - kind: integration
        ref: "AuthorizationMatrixTests (POST /api/v1/site-settings/quote-alerts/test row), QuoteAlertTestEmailTests#NoSavedAddressAnswers409AndQueuesNothing, #AnAdminGets403AndNothingIsQueued, #AnAddressThatCanNeverReceiveMailAnswers422AndQueuesNothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fourth test from one address within 10 minutes is 429 with a whole-second Retry-After; the limit is a validated setting with 3 in 10 minutes by default"
    requirement: INQ-04
    verification:
      - kind: integration
        ref: "QuoteAlertTestEmailTests#TheFourthTestFromOneAddressWithinTenMinutesIs429WithAWholeSecondRetryAfter, #TheActionCarriesTheQuoteAlertTestPolicy, #AnUnusableLimitStopsStartUpAndNamesTheSettingNotTheValue, #TheDefaultIsThreeInTenMinutesInItsOwnSection; RateLimitTests (route row at 3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The renderer gives the UI-SPEC E1 Test subject and body with the Quote alerts footer and no link"
    requirement: INQ-04
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs#TheTestEmailHasTheUiSpecSubjectAndBodyTheQuoteFooterAndNoLink"
        status: pass
    human_judgment: false
  - id: D5
    description: "R5 states: empty and partial aria-disabled with their reasons, populated enabled, Sending while pending, success, 429 and failure toasts, long address wraps, zero axe violations"
    requirement: INQ-04
    verification:
      - kind: component
        ref: "web/src/modules/admin/components/QuoteAlertsCard.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "How the test email looks in a real inbox, and that it arrives on the live site"
    verification: []
    human_judgment: true
    rationale: "Plan 13-26 is the owner's live check; the wording is SPEC-GAP copy the owner reviews."

duration: about 1h 15m
completed: 2026-11-23
---

# Phase 13 Plan 13: A Manager can send a test email to the Quote alerts address Summary

*Created: 2026-11-23T11:30:00-06:00 · Updated: 2026-11-23T11:30:00-06:00*

**A Manager presses Send Test Email on the Quote alerts card and a "Test: quote alerts work" email is queued to the saved address, audited without the address, limited to 3 in 10 minutes per connection, and the button says why it waits when there is nothing saved to test.**

## Performance

- **Tasks:** 2 of 2, each a RED test commit and a GREEN feature commit
- **Commits:** 4 before this summary (f5860750, d4303893, e30db9bd, 4c88901c)
- **Files:** 28 changed, 933 lines added, 20 removed

## Accomplishments

- **Task 1 (tracer):** kind 14 and its template; `SendQuoteAlertTestHandler` reads the saved address, answers 409 when it is empty, else queues the email and writes `quote-alerts.test-sent` in the same save. Thin Manager action `POST /api/v1/site-settings/quote-alerts/test` answers 202. Matrix row, OpenAPI snapshot and types, the web service call, the button with "Sending" and the success toast, the audit label (catalog 133 on both sides). The tracer was re-run end to end before Task 2.
- **Task 2:** the `quote-alerts-test` policy (3 in 10 minutes, checked at start-up, with its Retry-After window) on the action. The button is `aria-disabled` with "Save an address first, then send a test." or "Save your change first, then send a test." linked by `aria-describedby`. A 429 shows "Too many test emails."; any other failure shows "Couldn't send the test email.". `docs/api/site-content.md` documents the call.

## TDD evidence

- Task 1 RED `f5860750`: AuditActionsTests 3 of 119 failed (count 132, order list, missing constant). EmailRendererTests 3 of 90 failed with the renderer's own `NotSupportedException` ("The QuoteAlertTest email has no template."), not an assertion, because the kind had no template yet. Server 6 of 585 failed (404 on the new route, the coverage check). Web 7 of 118 failed (no service method, no button). The enum value and record were added as compile-only contract types.
- Task 1 GREEN `d4303893`: Domain 119 of 119; EmailRenderer, EmailOutbox and EmailDispatcher tests 117 of 117; server QuoteAlertTestEmailTests, AuthorizationMatrixTests and OpenApiSnapshotTests 596 of 596; web 175 of 175.
- Task 2 RED `e30db9bd`: 5 of 9 QuoteAlertTestEmailTests (policy missing, 202 where 429 was expected, start-up did not throw, defaults `(0, 00:00:00)`) and 2 RateLimitTests failed on assertions; web 4 of 12 card tests failed. `RateLimitPolicies.QuoteAlertTest` and `QuoteAlertTestRateLimit` were empty compile-only stubs. The 409, 422 and 403 server cases and the handler unit tests passed already (see deviations).
- Task 2 GREEN `4c88901c`: server QuoteAlertTestEmailTests, RateLimitTests, OpenApiSnapshotTests and AuthorizationMatrixTests 681 of 681; Application unit tests 3425 of 3425; architecture tests 290 of 290; web card, tab, service and audit copy tests 181 of 181; node rule tests (no-long-dash, source-layout, orders-boundaries, lint-rules) 124 of 124; `dotnet build Csps.slnx -warnaserror` 0 warnings, 0 errors; `npm run lint` 0 warnings; `npm run typecheck` clean; `npm --prefix tools/openapi-gen run check` "Generated API types match".

No REFACTOR commit was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] An address that can never get mail answered 500**
- **Found during:** Task 1
- **Issue:** the outbox throws `UndeliverableRecipientException` for a reserved domain such as `.invalid`. Without a guard the test send would fail with a 500.
- **Fix:** 422 `site-settings.quote-alerts-address-undeliverable`, nothing queued or audited. Unit and integration tests.
- **Commit:** d4303893 (tests in e30db9bd)

**2. [Rule 1 - Bug] Test queries read the append-only audit log across tests**
- **Found during:** Task 2 RED
- **Issue:** `ResetAsync` does not clear the audit log (append-only), so counts saw entries from earlier tests in the class.
- **Fix:** the assertions filter on the acting Manager, as the share picture tests do.
- **Commit:** e30db9bd

**3. [Rule 1 - Bug] The Task 1 GREEN commit left a type error**
- **Issue:** `useSubmission<undefined, undefined>` did not accept the service's `Promise<void>`; vitest passed, `tsc` failed. Lint and typecheck were not run before that commit.
- **Fix:** `useSubmission<undefined, unknown>`, as EditUserPanel does.
- **Commit:** 4c88901c

### Plan notes

- **Files outside files_modified:** `web/src/modules/admin/components/BusinessInfoTab.tsx` (one line: passes the saved address to the card), `tests/Csps.Application.UnitTests/Content/SendQuoteAlertTestHandlerTests.cs` (Application coverage), `tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs` (its list of limited routes must name every limited endpoint), `tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs` and `tests/Csps.Testing/CspsApiFactory.cs` (the test hosts set the new limit: 100000 normally, the real 3 in RealLimitsFactory; without it the parallel matrix test would hit 429).
- The 409 path was built in Task 1, because the matrix row needs one exact status. So the Task 2 409, 403 and 422 tests passed at RED, and the handler unit tests were written after the handler. They are regression tests, not RED evidence.
- `npm ci` was run in `web/` and `tools/openapi-gen/` of this worktree to run the tests. It installs only the locked packages; no package was added or changed.
- The plan commit ledger could not be written under `.git` (the sandbox refuses it). Commits were counted from the known base: `git rev-list --count 8ff68a31..HEAD` = 4.
- The plan text says to stay on `gsd/phase-13-quote-inquiries`; this ran on the orchestrator's worktree branch `worktree-agent-af97f41f60e59d2e4` as instructed.
- STATE.md, ROADMAP.md and DECISIONS.md were not touched.

## Not run here

- The full .NET and web suites, Playwright e2e and `build-output.node.test.ts` (the admin bundle changed; the orchestrator gate should rebuild `wwwroot` first, as deferred-items.md says).

## Flakes

None seen. Every run above passed on its first try, except the snapshot check, which failed as intended after a doc comment change and passed after the refresh.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None beyond the plan. T-13-39: `Policies.Manager` with matrix rows (anonymous 401, Admin 403). T-13-40: 3 per 10 minutes per connection, to the saved address only. T-13-41: no audit detail and no log line; the integration test scans every captured log event for the address. T-13-SC: no package added or bumped.

## Owner items

Nothing blocks. These are choices made while the owner was away. A is what was built.

1. **Test email wording (SPEC-GAP).** Subject and body are the UI-SPEC E1 Test row. The spec gives no heading or preview, so: heading "Quote alerts work", preview "Quote alerts reach this address.", no button. A: no link (built). B: add an "Open Quote Requests" button like the overflow email.
2. **An address that can never get mail.** A: 422 `site-settings.quote-alerts-address-undeliverable` with "This address can't get email. Save a different address, then send a test." (built). B: answer it as the 409 "no address" case.
3. **Failure toast for 409 and 422.** The UI-SPEC has one failure toast, so a 409 (someone cleared the address in the meantime) or a 422 shows "Couldn't send the test email." / "Check your internet connection and try again.". A: spec copy for every non-429 failure (built). B: show the server's own sentence for 409 and 422.
4. **What "per address" means for the limit.** A: per connection address, like every other `RateLimits` section (built). B: per Quote alerts email address, counted from the outbox like the hourly alert cap.
5. **Audit detail.** A: no detail at all (built). B: a fixed word such as `sent=1`, still with no address.
6. **Unsaved-change check ignores spaces.** The field and the saved address are compared after trimming, because the server stores the trimmed value. A: trimmed (built). B: exact text, so a typed trailing space also asks to save first.
7. No package was added or changed.

## Self-Check: PASSED

- Files exist: SendQuoteAlertTestHandler.cs, QuoteAlertTestEmailTests.cs, SendQuoteAlertTestHandlerTests.cs.
- Commits are on the branch: f5860750, d4303893, e30db9bd, 4c88901c.

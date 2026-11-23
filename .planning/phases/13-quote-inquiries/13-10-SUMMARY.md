---
created: 2026-11-23T01:36:00-06:00
updated: 2026-11-23T01:36:00-06:00
phase: 13-quote-inquiries
plan: 10
subsystem: email
tags: [quote-alerts, email-outbox, rate-cap, tdd, cwe-79, cwe-93, cwe-362, cwe-532]

requires:
  - phase: 13-quote-inquiries
    provides: "13-06 quote-requests lock and sender limit, 13-07 ISiteContentStore.GetQuoteAlertsEmailAsync"
provides:
  - "AuthEmailKind.QuoteAlert = 12 and QuoteAlertsOverflow = 13 with QuoteAlertEmail and QuoteAlertsOverflowEmail records"
  - "CreateQuoteRequestHandler queues one alert to the Quote alerts address in the same save as the request, capped at QuoteRequests:AlertsPerHour (20) per business hour with one overflow email"
  - "QuoteAlertText: the 60 character subject cut, the 300 character message excerpt, one-line cleaning of visitor text"
  - "EmailRenderer templates for both kinds, a FieldBlock for labelled lines, and an optional footer reason on EmailContent"
  - "AppLinksOptions.QuoteRequestLink(id) and QuoteRequestsPage()"
affects: [13-13, 13-14]

actuals:
  tokens: 17000
  tasks: 3
  commits: 7
plan_head_before: 9f2e47349aff04ad0cd9111f9d9cacdd0d89f6a8
plan_head_after: b6ddcb9976cd92c295c65d0acc2a9ddbe801a449

tech-stack:
  added: []
  patterns:
    - "A staff alert is queued through IEmailOutbox inside the create transaction, after the insert and before the one SaveChanges"
    - "Visitor text is cleaned in a pure Application class (QuoteAlertText) before it reaches a subject or a labelled line"
    - "The hourly count uses IEmailOutbox.CountRecentAsync from the start of the business hour, under the quote-requests lock"

key-files:
  created:
    - src/Csps.Application/QuoteRequests/QuoteAlertText.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/QuoteAlertTextTests.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteAlertEmailTests.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteAlertCapTests.cs
  modified:
    - src/Csps.Application/Email/AuthEmail.cs
    - src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestSettings.cs
    - src/Csps.Infrastructure/Email/EmailRenderer.cs
    - src/Csps.Infrastructure/Email/EmailHtmlLayout.cs
    - src/Csps.Infrastructure/Email/AppLinksOptions.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestHandlerTests.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/QuoteRequestSettingsTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
    - docs/api/quote-requests.md

key-decisions:
  - "The renderer, not the handler, cuts the message to 300 characters (QuoteAlertText.Excerpt), so the one place that builds the email owns every visitor text rule"
  - "Name, team, phone and product are put on one line in the body; line breaks and control characters become one space. The message keeps its line breaks (shown as <br> in HTML)"
  - "The hour is the business hour from the stored zone (local hour start converted to UTC), not a fixed UTC hour, so a zone with a half hour offset is also right"
  - "An address that the outbox refuses (an ArgumentException, for example a reserved .invalid domain) skips the alert and the request is still saved"

patterns-established:
  - "Pattern: an email block for visitor text (FieldBlock) encodes the value and turns line breaks into <br>"

requirements-completed: [INQ-04]

coverage:
  - id: D1
    description: "A saved request queues one QuoteAlert to the Quote alerts address in the same transaction; the sink gets one email with the name and the admin link; nothing is queued without an address, for a caught bot, a refused sender or a rolled-back request; the visitor is never mailed"
    requirement: INQ-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteAlertEmailTests.cs#ASavedRequestEmailsTheAlertsAddress"
        status: pass
      - kind: integration
        ref: "QuoteAlertEmailTests#NoAddressNoEmail, #ARolledBackRequestQueuesNothing, #CaughtAndRefusedSendsQueueNothing, #TheVisitorsOwnAddressIsNeverMailed, #AnAddressThatCannotReceiveMailNeverLosesTheRequest"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/QuoteRequests/CreateQuoteRequestHandlerTests.cs#AnAlertIsQueuedAfterTheInsertAndBeforeTheSaveWithTheSummary"
        status: pass
    human_judgment: false
  - id: D2
    description: "The alert has the summary lines in order, leaves empty lines out, encodes visitor text, keeps message line breaks, carries no attachment and only the site's own admin link, and has the Quote alerts footer"
    requirement: INQ-04
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs#TheQuoteAlertHasTheSubjectTheSummaryLinesTheButtonAndTheQuoteFooter"
        status: pass
      - kind: integration
        ref: "EmailRendererTests#EmptyValuesAndNoPhotosLeaveTheirLinesOut, #VisitorTextIsEncodedInTheHtmlAndLineBreaksAreKept, #TheQuoteAlertHasNoAttachmentAndOnlyTheSitesOwnAdminLink"
        status: pass
    human_judgment: false
  - id: D3
    description: "The subject cuts the name at 60 characters with an ellipsis and no visitor text can add a header or a line (review W1 IN-04); the message is cut at 300"
    requirement: INQ-04
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/QuoteRequests/QuoteAlertTextTests.cs"
        status: pass
      - kind: integration
        ref: "EmailRendererTests#AVisitorNameCannotChangeTheSubjectOrAddALine"
        status: pass
    human_judgment: false
  - id: D4
    description: "At most 20 alerts and one overflow email per business hour, a new hour starts again, parallel sends never pass the limit, every request is saved, and the limit is a validated setting"
    requirement: INQ-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteAlertCapTests.cs#TheTwentyFirstBecomesOneOverflow, #ANewHourStartsAgain, #ParallelSendsNeverPassTwenty, #TheHourlyLimitIsASetting"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/QuoteRequests/QuoteRequestSettingsTests.cs#AnAlertsPerHourJustOutsideTheRangeIsRefused"
        status: pass
    human_judgment: false
  - id: D5
    description: "The wording and look of the two staff emails in a real mail client"
    verification: []
    human_judgment: true
    rationale: "The copy is the UI-SPEC E1 wording, which is SPEC-GAP copy the owner reviews before release, and the look in a real inbox needs a person's eye."

duration: about 3h of wall time, including four network interruptions
completed: 2026-11-23
status: complete
---

# Phase 13 Plan 10: Staff get an email for each new quote request, at most 20 an hour Summary

*Created: 2026-11-23T01:36:00-06:00 · Updated: 2026-11-23T01:36:00-06:00*

**Each saved quote request now queues one summary email to the Quote alerts address in the same save, capped at 20 an hour with one "More quote requests are waiting" email, and no visitor text can add a header or a line.**

## Performance

- **Tasks:** 3 of 3 (each with a RED test commit and a GREEN feature commit)
- **Commits:** 7 before this summary: 3 RED, 3 GREEN and 1 docs commit
- **Files:** 14 changed, 1093 lines added

## Accomplishments

- **Task 1 (tracer):** `AuthEmailKind.QuoteAlert = 12` and `QuoteAlertsOverflow = 13` were added without touching numbers 1 to 11. The create handler reads the address under the quote-requests lock, queues the alert after the insert and before the one `SaveChanges`, and queues nothing for no address, a caught bot, a refused sender or a rolled-back request. A forced failure after queueing proves the rollback leaves no request and no outbox row.
- **Task 2:** `QuoteAlertText` holds the 60 and 300 limits, never splits an emoji, and cleans visitor text. The renderer lists Name, Team, Phone, Product, Quantity, Photos and Message, leaves empty lines out (and the Photos line for zero photos), encodes every value, keeps message line breaks, and uses the Quote alerts footer sentence for both quote kinds. Other kinds keep the staff-account footer.
- **Task 3:** inside the lock, the handler counts this business hour's `QuoteAlert` rows. Below `QuoteRequests:AlertsPerHour` it queues the alert. At the limit it queues one overflow email for the hour and nothing more. The setting is 1 to 200 and checked at start.
- Review W1 IN-04 is handled in the alert: a name or team with CR/LF or control characters becomes one space in the subject and in every body line.
- `docs/api/quote-requests.md` now describes the alert, the cap and the setting.

## TDD evidence

- Task 1 RED (`27c85555`): 4 of 6 `QuoteAlertEmailTests` failed on assertions (no `QuoteAlert` row, no email, no forced failure). The two enum values and two records were added in the RED commit as compile-only contract types.
- Task 2 RED (`3e6e7e11`): 16 of 19 `QuoteAlertTextTests` failed against a pass-through stub, and 7 new `EmailRendererTests` failed. The two overflow cases failed with the renderer's own `NotSupportedException` ("has no template"), not an assertion, because that kind had no template yet.
- Task 3 RED (`a3b98efb`): 4 of 4 `QuoteAlertCapTests` and 3 settings tests failed on assertions. `AlertsPerHour` was added as a plain property stub.
- Final runs (all green): QuoteAlertCapTests, QuoteAlertEmailTests, CreateQuoteRequestTests, QuoteBotGuardTests, QuoteSenderLimitTests 38 of 38; EmailRendererTests, EmailOutboxTests, EmailDispatcherTests 114 of 114; Application unit tests 3363 of 3363; architecture tests 290 of 290; `dotnet build Csps.slnx -warnaserror` 0 warnings, 0 errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] An address the outbox refuses must not cost a lead**
- **Found during:** Task 1
- **Issue:** `OutboxEmailSender` throws `ArgumentException` for a recipient in a reserved domain (`.invalid`). Without a guard, one such saved address would make every quote request fail with a 500.
- **Fix:** the handler skips the alert on `ArgumentException`; the request is still saved. Tests: unit `AnAddressThatCannotReceiveMailStillSavesTheRequest` and integration `AnAddressThatCannotReceiveMailNeverLosesTheRequest`.
- **Commit:** 5942b294

**2. [Rule 2 - Missing critical functionality] Visitor text cleaning for header and line injection (review W1 IN-04)**
- **Found during:** Task 2
- **Issue:** the plan named the subject cut only, but the review item requires no unsanitized visitor text in a header, and a name with a line break could also fake a body line.
- **Fix:** `QuoteAlertText.OneLine` for every single-line value, the subject built from the cleaned and cut name, the message excerpt keeps only plain new lines. The cut never splits a surrogate pair.
- **Commit:** bd10b4b1

**3. [Rule 1 - Bug] A raw U+2028 character reached two source files**
- **Found during:** Task 2 RED
- **Issue:** a typed backslash-u-2028 escape was written into the files as the real character, which C# reads as a line break, so the build failed.
- **Fix:** replaced it with the escape sequence before the first commit of those files. No commit contains the raw character.

### Plan notes

- The plan's file list did not include `docs/api/quote-requests.md`, `CreateQuoteRequestHandlerTests.cs` or `QuoteRequestSettingsTests.cs`; they were updated to describe and test the new behavior (commit b6ddcb99 for the docs).
- No OpenAPI change: no endpoint or API doc comment changed.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. The alert adds no network endpoint or auth path. T-13-29 to T-13-31 are mitigated as planned (encoding test, parallel cap test, no visitor email). T-13-32: logs hold no address or content; the handler logs nothing and the dispatcher logs only the row id, kind and error code.

## Owner items

Nothing blocks. These are choices made while the owner was away, for review:

1. **Wording (SPEC-GAP copy).** The subjects and body lines follow UI-SPEC E1 exactly. The spec does not give a heading or hidden preview line, so I used the heading "New quote request" and the preview "{name} sent a quote request." for the alert, and for the overflow email the heading "More quote requests are waiting" and the preview "Open Quote Requests to see them all." Please approve or change them.
2. **Quiet skips.** With no Quote alerts address, or an address the outbox refuses, nothing is logged and no email is sent. If you want a log line or a staff notice for the refused-address case, say so.
3. **The cap follows the address.** The count is by recipient address, so changing the Quote alerts address mid-hour starts a fresh count for the new address.
4. **Photos line.** As in RESEARCH A4, "Photos: n" is the number the visitor said they would attach; the inbox shows which arrived.
5. **Review W1 IN-04, optional part.** I did not reject control characters in `QuoteRequestRules` (a behavior change for the form). The alert is safe without it. Say if you want the stricter rule and its zod mirror.
6. **Admin link target.** The button links to `/admin/quote-requests/{id}` and `/admin/quote-requests` as the plan says. Those pages come from later Phase 13 plans.
7. No package was added or changed.

## Self-Check: PASSED

- Files exist: QuoteAlertText.cs, QuoteAlertTextTests.cs, QuoteAlertEmailTests.cs, QuoteAlertCapTests.cs (all found).
- Commits are on the branch: 27c85555, 5942b294, 3e6e7e11, bd10b4b1, a3b98efb, d6861f0a, b6ddcb99.

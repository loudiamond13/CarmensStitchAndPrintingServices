---
phase: 04-identity-authentication
plan: 33
subsystem: auth-email
tags: [email, outbox, renderer, dispatcher, retry, rowversion, cwe-532, auth-13]
status: complete
created: "2026-10-14T23:05:00-05:00"
updated: "2026-10-14T23:05:00-05:00"

requires: ["04-09"]
provides:
  - "EmailRenderer renders all seven auth email kinds (sign-in code, account locked, password reset, password changed, Manager reset, deactivated notice, invite) with the UI-SPEC copy, business-time dates, the D-32 device line, HTML-encoded values and links built only from AppLinksOptions"
  - "EmailDispatcher D-33 rules: retry at +30 s, +1 min, +2 min, +4 min, +2.5 min then close; a row past NotAfter is closed unsent; a row is leased with a rowversion save before sending; transport errors become smtp-connect, smtp-auth, smtp-send or unknown"
  - "EmailOutboxMessage.Claim, RetryAt and MarkExpired (no schema change)"
affects: [04-22, 04-23, 04-32, password reset, invite, lockout, deactivated notice]

requirements-completed: []

actuals:
  tokens: 13000
  tasks: 2
  commits: 4
plan_head_before: 90e172f8284c4ffa2770b03d155f2ae5cb76fee1
plan_head_after: a5aac3024504d36acb34bff5632865f61a48311d

tech-stack:
  added: []
  patterns:
    - "One Compose frame (heading, paragraphs, optional button with its link repeated as a text fallback) renders every notice kind; the sign-in code email keeps its own layout"
    - "A row is leased by saving NextAttemptAt with its rowversion; a DbUpdateConcurrencyException detaches only that row and the sweep continues"
    - "Exception text never leaves the dispatcher: ErrorCodeFor maps the exception type to a short code"

key-files:
  created:
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailDispatcherTests.cs
  modified:
    - src/Csps.Infrastructure/Email/EmailRenderer.cs
    - src/Csps.Infrastructure/Email/EmailDispatcher.cs
    - src/Csps.Infrastructure/Email/EmailOutboxMessage.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailOutboxTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/SignInCodeEmailRenderTests.cs

key-decisions:
  - "The retry delay is counted from the failed attempt, not from the previous due time, so a late sweep never shortens the wait"
  - "The claim lease is 2 minutes, longer than the SMTP client's 30 s timeouts, so a slow send is not picked up by a second dispatcher"
  - "Timeouts, socket, IO and TLS failures map to smtp-connect; MailKit authentication failures to smtp-auth; SMTP command and protocol failures to smtp-send"
  - "Retries are logged at Debug (quiet, D-33); closing a row logs a Warning with id, kind and code; expiry logs Information"

patterns-established:
  - "Dispatcher tests drive SweepAsync directly with a FakeTimeProvider and a scripted transport, so the schedule is checked to the second"
---

# Phase 4 Plan 33: Auth Email Content and Delivery Rules Summary

All seven auth emails now render with the UI-SPEC words and safe links through the 04-09 outbox, and the dispatcher retries a failed send for about 10 minutes, drops mail that has outlived its code or link, never sends a row twice and logs only the row id, the kind and a short error code.

## What was built

- **Tracer (Task 1):** a queued `PasswordResetEmail` goes through `IEmailOutbox`, the unit of work, the dispatcher and the recording transport. The transport receives the subject "Reset your CSPS password" and a text part with `https://localhost/admin/reset-password#token=...`, and the row ends with `SentAt` set and its three protected columns null. The same renderer then got the other five kinds (account locked, password changed, Manager reset, deactivated notice, invite).
- **Renderer:** times use the pattern `MMM d, yyyy, h:mm tt` with the invariant culture in the business zone (07:42 UTC reads "Oct 14, 2026, 3:42 PM" at +08:00). The device line reads "from Chrome on Android" or "from an unknown browser". The lockout and password-changed emails link to the forgot-password page with no token (D-25); the reset and invite tokens appear only in the button URL and its text fallback; the deactivated and Manager-reset emails have no link (D-20, D-24). The password-changed notice mentions signed-out devices only on the reset path. Every value is HTML-encoded in the HTML part and plain in the text part, and a test with a `<script>` Manager name proves it.
- **Dispatcher (Task 2):** schedule 30 s, 1 min, 2 min, 4 min, 2.5 min, then the sixth failure sets `FailedAt`, scrubs the content and logs one warning. A row at or past `NotAfter` is marked `ExpiredAt`, scrubbed and never handed to the transport, including between retries. Before sending, the row is leased for 2 minutes by saving `NextAttemptAt` with the rowversion; a `DbUpdateConcurrencyException` means another dispatcher owns it and only that row is dropped from the context.
- **Tests added:** `EmailRendererTests` (23 cases including a theory over all kinds that rejects placeholders, `<img`, `src=`, `url(`, `http://`, and IPv4 addresses), `EmailDispatcherTests` (12 cases: the full schedule at one-second resolution, recovery, expiry, a lease seen by a second dispatcher mid-send, 20 rows swept by two dispatchers at once, five error-code mappings, and a FakeLogger case where the exception text carries the SMTP secret, the code and the token), and one more `EmailOutboxTests` case.

## Task commits

| Task | Commit | Message |
| --- | --- | --- |
| 1 RED | 67c70de | test(04-33): every auth email renders with the UI-SPEC copy (RED) |
| 1 GREEN | 4b22b46 | feat(04-33): all auth email kinds with the UI-SPEC copy (D-30 text, D-32) |
| 2 RED | a09070b | test(04-33): the D-33 delivery rules (RED) |
| 2 GREEN | a5aac30 | feat(04-33): the D-33 delivery rules |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The old failure handler detached every tracked row**
- **Found during:** Task 2 design. `SaveAsync` called `ChangeTracker.Clear()` on a concurrency conflict, which would silently stop later rows in the same batch from being saved.
- **Fix:** `TrySaveAsync` detaches only the conflicting row.
- **Commit:** a5aac30

**2. [Process] Obsolete test removed**
- `SignInCodeEmailRenderTests.KindsWithoutATemplateYetAreRefused` asserted that the deactivated notice had no template. It was removed in the Task 1 RED commit; `EmailRendererTests.AKindWithoutATemplateIsRefused` keeps the default arm covered with a test-only email kind.

**3. [Process] First Task 2 RED run hung**
- The "claimed by another dispatcher" test re-entered the second dispatcher's send on the old code, which recursed without end (the old code had no lease). The test hook now fires once per transport. The killed process was this plan's own test host. The RED commit has the final test and fails on 11 of 12 cases.

### Plan files touched beyond the list
- None. `SweepAsync` became `internal` for the tests in the Task 2 RED commit (the project already exposes internals to the integration tests).

## Decisions for the owner

None blocking. For awareness:
- **Preheader and button copy are exactly the UI-SPEC table.** The owner's D-30 preview of rendered emails (Gmail web and Android) still waits for plan 04-23, which adds the branded frame and the logo through the same `RenderAsync` seam.
- **Retry timing granularity.** The dispatcher sweeps every 30 s by default, so a retry may start up to one sweep interval after its due time. This still fits "about 10 minutes".

## Known Stubs

None.

## Threat Flags

None. T-04-108 (HTML injection in mail) is covered by the encoding tests, and T-04-109 (secrets in logs, CWE-532) by the FakeLogger test; T-04-SC has no installs to cover.

## Verification

Run on LocalDB after the preflight, zero build warnings for the integration test project (`--no-incremental`).

| Project | Tests | Failed | Skipped |
| --- | --- | --- | --- |
| Csps.Infrastructure.IntegrationTests | 310 | 0 | 1 (HibpLiveTests, by design) |
| Csps.Server.IntegrationTests | 348 | 0 | 0 |
| Csps.ArchitectureTests | 127 | 0 | 0 |

- The tracer gate re-ran `EmailOutboxTests` (7) and `EmailRendererTests` (23) green before Task 2.
- Acceptance greps hold: "Reset your CSPS password", "Your account is deactivated. Ask a Manager if you need access." and "MMM d, yyyy, h:mm tt" in `EmailRenderer.cs`; `DbUpdateConcurrencyException` and `smtp-connect` in `EmailDispatcher.cs`.

## Requirements

AUTH-13 is not ticked: `requirements.ready-ids` reports it blocked because plans 04-22, 04-23 and 04-32 also declare it and have no SUMMARY yet.

## Self-Check: PASSED

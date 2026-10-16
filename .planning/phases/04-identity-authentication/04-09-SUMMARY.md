---
phase: 04-identity-authentication
plan: 09
subsystem: auth
tags: [email, outbox, data-protection, mailkit, smtp, tls, testing-sink, auth-13, qual-05]
status: complete
created: "2026-10-14T21:32:00-05:00"
updated: "2026-10-14T21:32:00-05:00"

requires: ["04-02", "04-03", "04-08"]
provides:
  - "AuthEmail (seven kinds as records), AuthEmailKind, LockoutCause and IEmailOutbox.{EnqueueAsync, CountRecentAsync} in Application"
  - "EmailOutbox table (AddEmailOutbox migration, new table only): subject, text and HTML Data-Protection-encrypted (purpose Csps.EmailOutbox.v1) and set to null after sending"
  - "OutboxEmailSender (queues on the caller's unit of work), OutboxSignal plus OutboxSignalInterceptor (signal after the commit, deferred to the outer transaction's commit), EmailDispatcher (BackgroundService: signal plus sweep)"
  - "EmailRenderer with the sign-in code email (subject per D-08, text and HTML, business time per D-32); AppLinksOptions (App:PublicBaseUrl, IN-06)"
  - "MailKitTransport (STARTTLS or SSL-on-connect only), SmtpOptions, EmailSenderOptions, IEmailTransport, OutgoingEmail"
  - "InMemoryEmailSink and SinkMessage compiled under CSPS_TESTING (Debug only); Release refuses the Testing environment"
affects: [04-10, 04-12, 04-18, 04-23, 04-33, Phase 5 user management]

requirements-completed: []

actuals:
  tokens: 24000
  tasks: 2
  commits: 4
plan_head_before: 8cf277320e62200d3495aed0203ec99115e62162
plan_head_after: 706320dc0bdb4b867febd8c2b16e6f827c703300

tech-stack:
  added: []
  patterns:
    - "Outbox rows join the caller's unit of work; a SaveChanges interceptor signals the dispatcher only after the rows are committed (immediately when the save owns its transaction, at TransactionCommitted when an outer transaction is open, never after a rollback)"
    - "Options that hold secrets are read as plain text where binding could echo a bad value (Smtp:Security), and every start-up failure message names the setting, never the value"
    - "Test-only code sits under #if CSPS_TESTING, defined for Debug builds only; tests that touch it do so by type name so the test project still compiles in Release"

key-files:
  created:
    - src/Csps.Application/Email/AuthEmail.cs
    - src/Csps.Application/Ports/IEmailOutbox.cs
    - src/Csps.Infrastructure/Email/EmailOutboxMessage.cs
    - src/Csps.Infrastructure/Email/OutboxEmailSender.cs
    - src/Csps.Infrastructure/Email/EmailRenderer.cs
    - src/Csps.Infrastructure/Email/AppLinksOptions.cs
    - src/Csps.Infrastructure/Email/EmailDispatcher.cs
    - src/Csps.Infrastructure/Email/EmailDispatcherOptions.cs
    - src/Csps.Infrastructure/Email/IEmailTransport.cs
    - src/Csps.Infrastructure/Email/OutboxSignal.cs
    - src/Csps.Infrastructure/Email/MailKitTransport.cs
    - src/Csps.Infrastructure/Email/SmtpOptions.cs
    - src/Csps.Infrastructure/Email/EmailSenderOptions.cs
    - src/Csps.Infrastructure/Email/InMemoryEmailSink.cs
    - src/Csps.Infrastructure/Email/EmailRegistration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/EmailOutboxMessageConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261015022016_AddEmailOutbox.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261015022016_AddEmailOutbox.Designer.cs
    - tests/Csps.Application.UnitTests/Email/AuthEmailTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailOutboxTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/MailKitTransportTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/AppLinksOptionsTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/SignInCodeEmailRenderTests.cs
    - tests/Csps.ArchitectureTests/MailSafetyTests.cs
  modified:
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Infrastructure/Csps.Infrastructure.csproj
    - src/Csps.Server/appsettings.json
    - src/Csps.Server/appsettings.Development.json
    - tests/Csps.Testing/CspsApiFactory.cs

key-decisions:
  - "The signal is raised after the commit, not after SaveChanges: with an outer transaction the interceptor keeps the signal pending until TransactionCommitted and drops it on a rollback, so the dispatcher never looks for a row that is not visible yet and a rolled-back change sends nothing"
  - "Smtp:Security is stored as text and parsed to SmtpSecurity (StartTls, SslOnConnect) with exact, case-sensitive names: None, Auto, StartTlsWhenAvailable, numbers and any other value fail the start-up check, and the message never repeats the value (enum binding would have thrown a binder error that quotes it)"
  - "Test hosts carry placeholder Smtp:* settings (smtp.test.invalid) because existing Server tests switch a Testing host to Development or Production; they pass the start-up check and nothing ever connects"
  - "An outbox row whose content can no longer be decrypted is closed as failed (FailedAt, code 'unreadable', content wiped) instead of retried forever; any transport exception only records Attempts and the exception type name and leaves the row due (backoff, expiry and the single-send claim stay in plan 04-33)"
  - "The email HTML in this plan is simple semantic HTML; the branded frame and inline logo are plan 04-23, as the 04-33 and 04-23 plans already state"

patterns-established:
  - "Email rendering: invariant culture with the pattern 'MMM d, yyyy, h:mm tt' in the business zone, so output matches en-PH without depending on host ICU data"
  - "Every outbox log line carries the row id and an error code only, never an address, subject or body (CWE-532)"
---

# Phase 4 Plan 9: Email Outbox, SMTP over TLS and the Testing Sink Summary

Auth emails now go through a transactional outbox with Data-Protection-encrypted content and a background dispatcher, leave over required TLS from `no-reply@cspstailoring.com`, and in the Testing environment can only reach a Debug-only in-memory sink, so automated tests never send real mail.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | A queued sign-in code email commits with the caller, reaches the transport through the dispatcher and leaves no readable content behind | RED 1aa876e, GREEN 38edddd |
| 2 | SMTP over required TLS from the business sender, and the Testing-only sink Release builds cannot contain | RED ba4c03b, GREEN 706320d |

`commits: 4` is measured from the plan ledger base (`plan_head_before`). Tracer gate: the tracer's `EmailOutboxTests` and `MigrationScriptTests` were run green after the whole slice was built, before the second task started.

## Reviewed AddEmailOutbox migration

One new table, `EmailOutbox`; nothing dropped, renamed or changed, no JSON column, compat level stays 160.

| Column | Type |
|--------|------|
| Id | uniqueidentifier (version-7 Guid, primary key) |
| Kind | tinyint |
| ToAddress | nvarchar(256) |
| ProtectedSubject, ProtectedText, ProtectedHtml | nvarchar(max), null after the row is closed |
| CreatedAt, NotAfter, NextAttemptAt | datetimeoffset |
| Attempts | int |
| SentAt, FailedAt, ExpiredAt | datetimeoffset, null |
| LastErrorCode | varchar(64), codes only |
| RowVersion | rowversion |

Indexes: `IX_EmailOutbox_Due` on (SentAt, FailedAt, ExpiredAt, NextAttemptAt) and `IX_EmailOutbox_Kind_ToAddress_CreatedAt` on (Kind, ToAddress, CreatedAt).

## Verification

- Infrastructure integration 212 passed, Server integration 326, Architecture 109, Application unit 24, Domain unit 576; the Debug and the Release solution builds have 0 warnings and 0 errors.
- Coverage gate (`Invoke-CoverageGate.ps1`): Domain 100% line and branch, Application 100% line.
- Release proof: `dotnet build Csps.slnx -c Release` succeeds with no sink in the assembly, and `MailKitTransportTests` run in Release passes with its Release-only test asserting the Testing environment is refused (message names QUAL-05).
- Acceptance greps all met: `Csps.EmailOutbox.v1` in OutboxEmailSender, `is your CSPS sign-in code` in EmailRenderer, `ProtectedSubject` in EmailOutboxMessage, `_AddEmailOutbox.cs` present, `PublicBaseUrl` in appsettings.Development.json, both `SecureSocketOptions` modes in MailKitTransport, zero `ServerCertificateValidationCallback` outside comments, `CSPS_TESTING` under a Debug-only condition, and no `Smtp` section in appsettings.json.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing Server tests would fail the new start-up check**
- **Found during:** Task 2 planning (tests such as `OpenApiExposureTests` and `SecurityHeadersTests` start a Testing-derived host as Development or Production).
- **Issue:** Outside Testing the host now requires `Smtp:*`, which those hosts did not have.
- **Fix:** `CspsApiFactory` sets placeholder `Smtp:*` values for a never-contacted `smtp.test.invalid` host (also `App:PublicBaseUrl` and the dispatcher switches, which the plan listed).
- **Files modified:** tests/Csps.Testing/CspsApiFactory.cs
- **Commit:** 706320d

**2. [Rule 2 - Missing critical] Poison rows and a failing transport must not stop mail**
- **Found during:** Task 1 (dispatcher).
- **Issue:** The plan leaves retries to 04-33, but a row whose ciphertext can no longer be decrypted, or a transport that throws, would otherwise crash or hot-loop the sweep.
- **Fix:** Unreadable content closes the row as failed and wipes it; a transport error records the attempt and the exception type name and keeps the row due; the sweep loop survives any exception and logs the type only.
- **Files modified:** src/Csps.Infrastructure/Email/EmailDispatcher.cs, EmailOutboxMessage.cs
- **Commit:** 38edddd

### Plan interpretation

- `OutboxSignal.cs` also holds `OutboxSignalInterceptor`. It is registered from `AddCspsPersistence` (not only `AddCspsEmail`) so every composition that uses the context factory carries it; `OutboxSignal` is added with `TryAdd` in both places.
- The interceptor also implements `IDbTransactionInterceptor` so the signal waits for the outer transaction's commit (see key decisions); two extra tests cover commit-then-send (sweep set to one hour so only the signal can trigger it) and rollback-sends-nothing.
- `Smtp:Security` is a string property with `TryGetSecurity` and the `SmtpSecurity` enum (see key decisions).
- Tests added beyond the listed behavior: `AuthEmailTests` (Application coverage), `AppLinksOptionsTests`, `SignInCodeEmailRenderTests` (business-time line, unknown browser, HTML encoding, no remote resource) and `MailSafetyTests` in the architecture project (no `Smtp` section in any appsettings file, no weakened TLS in `MailKitTransport`, `CSPS_TESTING` defined only for Debug). The three Infrastructure and Application additions were written alongside the Task 1 GREEN and passed on first run; they were not part of the RED commit.
- `MailKitTransportTests` uses a real test database: Data Protection reads its key ring when a host starts, and a missing database stalls start for about 12 seconds.
- The RED commits fail at build time (types under test do not exist yet), as in earlier Phase 4 plans.
- Co-author trailer on commits is `Claude Sonnet 5.5` (the model that ran the plan).

## Known Stubs

- `EmailRenderer` renders only the sign-in code kind; the other six throw `NotSupportedException("The <kind> email has no template yet.")`. Intentional: plan 04-33 adds them, and 04-23 wraps all seven in the branded frame with the inline logo. A handler test that queues another kind through the real renderer before 04-33 would hit this exception (04-12 already names the lockout copy as 04-33's).
- The HTML part is simple semantic HTML without the D-30 frame or logo (plan 04-23).

## Threat Flags

None. No new endpoint or auth path. The threat register items are mitigated as planned: T-04-26 (outbox content encrypted, wiped after sending), T-04-27 (only STARTTLS or SSL-on-connect are representable, no certificate callback, settings checked at start and pinned by `MailSafetyTests`), T-04-28 (every value HTML-encoded, links only from `App:PublicBaseUrl` with the token in the fragment), T-04-29 (Testing uses the Debug-only sink; Release refuses the Testing environment).

## Notes for later plans

- **Owner / deploy:** Production now also needs the host setting `App:PublicBaseUrl` (the public https address of the site) next to the `Smtp:*` values; the API refuses to start without them. The hosting checklist should list it. Development uses `http://localhost:5180` from appsettings.Development.json, and `Initialize-DevSecrets.ps1 -Smtp` must have been run for a real `dotnet run` in Development (mail-setup.md step 3).
- Plan 04-10 reads the sink with `InMemoryEmailSink.After(cursor, to)`; its Server code must sit under `#if CSPS_TESTING` and the Server csproj needs the same Debug-only define.
- Plan 04-33 adds the retry schedule, expiry and the rowversion claim; the dispatcher's `SendAsync` and `SweepAsync` are the seams. `EmailOutboxMessage` already has `Attempts`, `NextAttemptAt`, `ExpiredAt` and `MarkAttemptFailed`.
- A handler must enqueue and save in the same unit of work as its business change; `IEmailOutbox.EnqueueAsync` renders (one SiteSettings read for the zone) but never saves.
- A host started against a database that does not exist waits about 10 seconds at start for Data Protection; tests that start a real host should use a `CspsDatabase`.

## Self-Check: PASSED

- Files: AuthEmail.cs, IEmailOutbox.cs, every file under src/Csps.Infrastructure/Email, EmailOutboxMessageConfiguration.cs, the AddEmailOutbox migration and designer, and the six new test files all exist.
- Commits 1aa876e, 38edddd, ba4c03b and 706320d are ancestors of HEAD.

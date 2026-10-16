---
phase: 04-identity-authentication
plan: 11
subsystem: auth-persistence
tags: [two-factor, challenges, hmac, secure-random, ef-migration, concurrency, auth-02, auth-03, auth-04]
status: complete
created: "2026-10-14T22:31:00-05:00"
updated: "2026-10-14T22:31:00-05:00"

requires: ["04-05", "04-09"]
provides:
  - "ITwoFactorChallenges (Add, FindByTicketHashAsync, CountCodesIssuedSinceAsync, CountFailedAttemptsSinceAsync, InvalidateOpenAsync) over CspsDbContext"
  - "ICodeMac: HMAC-SHA256 over challenge id, user id and the six ASCII digits, keyed by Auth:CodeMacKey"
  - "ISecureRandom: six-digit codes via RandomNumberGenerator.GetInt32(0, 1_000_000), 43-char base64url tokens from 32 random bytes"
  - "Tables TwoFactorChallenges and TwoFactorCodes (migration AddTwoFactorChallenges), binary(32) ticket hash and code MAC only"
  - "AuthSecretsOptions (section Auth, CodeMacKey) validated at start; TestSecrets.CodeMacKeyBase64 for tests"
affects: [04-12, 04-13, 04-14, 04-15, sign-in handlers, resend and verify handlers]

requirements-completed: []

actuals:
  tokens: 60000
  tasks: 3
  commits: 5
plan_head_before: 43604a7303fa33a34e2425335f665fc51184daae
plan_head_after: a7959b01cdd25d54041e69687e120140101179c9

tech-stack:
  added: []
  patterns:
    - "Domain-assigned version 7 keys use ValueGeneratedNever so a child added to a tracked aggregate is inserted, not updated"
    - "A child row that the domain mutates alone carries concurrency tokens on its own mutable columns, because EF checks only the rows it updates"
    - "Test secrets are derived in-process from a fixed label (TestSecrets, like TestJwt); no key literal is committed"

key-files:
  created:
    - src/Csps.Application/Ports/ITwoFactorChallenges.cs
    - src/Csps.Application/Ports/ICodeMac.cs
    - src/Csps.Application/Ports/ISecureRandom.cs
    - src/Csps.Infrastructure/Identity/TwoFactorChallengeStore.cs
    - src/Csps.Infrastructure/Identity/HmacCodeMac.cs
    - src/Csps.Infrastructure/Identity/SecureRandom.cs
    - src/Csps.Infrastructure/Identity/AuthSecretsOptions.cs
    - src/Csps.Infrastructure/Persistence/Configurations/TwoFactorChallengeConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/TwoFactorCodeConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261015032323_AddTwoFactorChallenges.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261015032323_AddTwoFactorChallenges.Designer.cs
    - tests/Csps.Testing/TestSecrets.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/TwoFactorStoreTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/AuthSecretsTests.cs
  modified:
    - src/Csps.Infrastructure/Identity/IdentityRegistration.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - tests/Csps.Testing/CspsApiFactory.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailOutboxTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/MailKitTransportTests.cs

key-decisions:
  - "Concurrency tokens sit on TwoFactorCode.FailedAttempts, SupersededAt and ConsumedAt, in addition to the challenge rowversion, because verifying a code changes only the code row"
  - "InvalidateOpenAsync does not save; the handler saves it with the new challenge in one unit of work"
  - "The code MAC input uses big-endian GUID bytes so the stored format does not depend on the platform byte order"
  - "AuthSecretsOptions is validated in AddCspsIdentity (ValidateOnStart), so every host that composes Infrastructure needs Auth:CodeMacKey"

patterns-established:
  - "Hosts built in tests with AddInfrastructure add TestSecrets.CodeMacKeySetting to their in-memory configuration"
---

# Phase 4 Plan 11: Challenge Storage and the Code Secrets Summary

Sign-in challenges and emailed codes now persist as a SHA-256 ticket hash and an HMAC-SHA256 code MAC only, with durable per-account counts, one open challenge per account, a double-verification guard, and a mandatory `Auth:CodeMacKey` that is never printed.

## What was built

- **Tracer (Task 1):** a challenge with an HMAC-bound code round-trips LocalDB. A new scope finds it by `TokenHash.Compute(ticket)`, the code verifies once, a reload shows it consumed and a second verify returns `ChallengeClosed`. Raw SQL confirms the stored `TicketHash` and `CodeMac` are 32-byte hashes and not the plain ticket or code. Tables `TwoFactorChallenges` (unique `UX_TwoFactorChallenges_TicketHash`, `IX_TwoFactorChallenges_UserId_CreatedAt`, rowversion, cascade FK to `AspNetUsers`) and `TwoFactorCodes` (`IX_TwoFactorCodes_ChallengeId`, cascade FK). No JSON columns; the migration is additive.
- **Counts and invalidation (Task 2):** `CountCodesIssuedSinceAsync` and `CountFailedAttemptsSinceAsync` are set-based, untracked queries across all of an account's challenges (6 codes over 3 challenges count 6, codes 61 minutes old and other accounts are excluded). `InvalidateOpenAsync` loads only Pending and AwaitingNewPassword challenges and calls the Domain `Invalidate`.
- **Secrets (Task 3):** a host without `Auth:CodeMacKey`, with a non-base64 value or with a 31-byte key fails at start with an `OptionsValidationException` that names `Auth:CodeMacKey` and never contains the value; a 32-byte key starts. A known-answer test pins the MAC input layout. Malformed codes throw `ArgumentException` without echoing them. 1,000 codes are six digits with leading zeros present; 1,000 tokens are 43 base64url characters, decode to 32 bytes and are distinct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The challenge rowversion alone does not stop two verifications of one code**
- **Found during:** Task 2 (the concurrency test failed on first run, as expected from reading the Domain code).
- **Issue:** `TwoFactorChallenge.Verify` changes only the `TwoFactorCode` row (`ConsumedAt`, `FailedAttempts`). EF checks a rowversion only on rows it updates, so with the plan's design both concurrent saves succeeded and a code could sign in twice. The same gap would have let parallel wrong guesses lose count updates and slip past the 5-per-code cap.
- **Fix:** concurrency tokens on the code's own mutable columns (`FailedAttempts`, `SupersededAt`, `ConsumedAt`). The second save now throws `DbUpdateConcurrencyException`. The challenge rowversion still guards status changes (`Complete`, `RequirePasswordChange`, `Invalidate`). No schema change: `Up()` is empty. I verified that with a temporary migration, then folded the three `IsConcurrencyToken()` lines into the model snapshot and the existing migration's Designer; `has-pending-model-changes` reports none.
- **Files modified:** `TwoFactorCodeConfiguration.cs`, `CspsDbContextModelSnapshot.cs`, `20261015032323_AddTwoFactorChallenges.Designer.cs`
- **Commit:** 123e0fb

**2. [Rule 3 - Blocking] Existing in-process hosts needed the new required key**
- **Found during:** Task 1.
- **Issue:** `AddInfrastructure` now registers a start-up check for `Auth:CodeMacKey`, so the two test hosts that call `StartAsync` with Infrastructure (`EmailOutboxTests`, `MailKitTransportTests`) would fail without it.
- **Fix:** added `TestSecrets.CodeMacKeySetting` to their in-memory configuration. `CspsApiFactory` sets it for every Server host.
- **Commit:** e70f107

**3. [Process] Task 3 had no RED phase**
- The behavior Task 3 specifies (key validation, MAC binding, random shapes) was already delivered by Task 1, so all 16 tests passed on first run and no source change followed. They are committed as one `test(04-11)` commit without a `(RED)` marker. They are characterization tests, and the known-answer MAC test is what would catch an accidental layout change.

## Decisions for the owner

None blocking. For awareness:
- `docs/web/e2e.md` line 14 still lists only `Jwt:SigningKey` and `DataProtection:*` as the dev secrets. `Initialize-DevSecrets.ps1` already creates `Auth:CodeMacKey`, so nothing breaks; the doc line could mention it when that file is next touched (not changed here to keep the plan's file list).
- The migration timestamp (`20261015032323`) is in UTC on the 15th, like the previous two, because the machine's UTC date is already the next day.

## Known Stubs

None.

## Threat Flags

None. T-04-34, T-04-35 and T-04-36 are mitigated as planned (T-04-36 by the code-row tokens described above).

## Verification

Run on LocalDB (`CSPS_TEST_SQL=localdb`), zero build warnings:

| Project | Tests | Failed |
| --- | --- | --- |
| Csps.Domain.UnitTests | 576 | 0 |
| Csps.Application.UnitTests | 24 | 0 |
| Csps.ArchitectureTests | 111 | 0 |
| Csps.Infrastructure.IntegrationTests | 233 | 0 |
| Csps.Server.IntegrationTests | 348 | 0 |

Acceptance greps: `HMACSHA256` in `HmacCodeMac.cs`, `RandomNumberGenerator.GetInt32` in `SecureRandom.cs`, the `_AddTwoFactorChallenges.cs` migration, `CodeMacKey` in `CspsApiFactory.cs`, `CountFailedAttemptsSinceAsync` in the port, `InvalidateOpenAsync` in the store, and `Auth:CodeMacKey` plus `Initialize-DevSecrets.ps1` in `AuthSecretsOptions.cs` all hold.

## Requirements

AUTH-02, AUTH-03 and AUTH-04 are not ticked complete: this plan delivers their storage and secrets primitives, and the handlers that enforce the rules arrive in later plans.

## Self-Check: PASSED

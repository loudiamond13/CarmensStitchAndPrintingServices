---
phase: 04-identity-authentication
plan: 17
subsystem: auth-password-checks
tags: [hibp, k-anonymity, common-passwords, seclists, fail-open, fail-closed, dependency-registry, auth-11]
status: complete
created: "2026-10-14T22:48:00-05:00"
updated: "2026-10-14T22:48:00-05:00"

requires: ["04-04", "04-09"]
provides:
  - "PasswordRules.CheckAsync(password, PersonalInfo, BreachCheckMode, ct) -> PasswordRulesResult(Status, Message, BreachCheckSkipped): the owner's rule first, then the breach service"
  - "IPwnedPasswords / BreachCheckResult and ICommonPasswords ports; HibpPwnedPasswords (typed client, resilience handler, 3 s total timeout), HibpRangeParser, CommonPasswordList (embedded SecLists top-10k)"
  - "TestingPwnedPasswords offline stand-in (Debug builds, Testing environment): Pwned#Pass2026 is breached, Hibp-Down#2026 is unavailable"
  - "PasswordCheckRegistration.AddCspsPasswordChecks(environment), called from AddInfrastructure (registers PasswordRules scoped, the list as a singleton)"
  - "Dependency registry kind data (source at a commit SHA, sha256, path) with DataFiles checks; SecLists record and MIT notice in THIRD-PARTY-NOTICES.md"
affects: [04-19, 04-20, 04-21, 04-22, reset, must-change, invite acceptance, sign-in breach re-check]

requirements-completed: []

actuals:
  tokens: 90000
  tasks: 3
  commits: 6
plan_head_before: a4660af84b27b7bbf83eb1b0584c25c7c051348e
plan_head_after: 938f27fb4ff8599e7e946243b7b410de3a4aec08

tech-stack:
  added: []
  patterns:
    - "A third-party lookup address is a code constant on the call itself (absolute URI), so no HttpClient setting can redirect it (CWE-918)"
    - "Any failure of the breach call (status, timeout, open circuit, malformed body) is the single value Unavailable; the caller's mode decides what that means"
    - "Bundled data files are registry records of kind data, hash-pinned and checked against the embedded bytes; git is told not to touch their line endings (-text)"

key-files:
  created:
    - src/Csps.Application/Ports/IPwnedPasswords.cs
    - src/Csps.Application/Ports/ICommonPasswords.cs
    - src/Csps.Application/Auth/PasswordRules.cs
    - src/Csps.Infrastructure/Passwords/HibpPwnedPasswords.cs
    - src/Csps.Infrastructure/Passwords/HibpRangeParser.cs
    - src/Csps.Infrastructure/Passwords/CommonPasswordList.cs
    - src/Csps.Infrastructure/Passwords/common-passwords-10k.txt
    - src/Csps.Infrastructure/Passwords/TestingPwnedPasswords.cs
    - src/Csps.Infrastructure/Passwords/PasswordCheckRegistration.cs
    - tests/Csps.Application.UnitTests/Auth/PasswordRulesTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Passwords/HibpPwnedPasswordsTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Passwords/CommonPasswordListTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Passwords/PasswordCheckRegistrationTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Passwords/HibpLiveTests.cs
  modified:
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Infrastructure/Csps.Infrastructure.csproj
    - .gitattributes
    - tests/Csps.ArchitectureTests/DependencyRegistry.cs
    - tests/Csps.ArchitectureTests/DependencyRegistryTests.cs
    - tools/scripts/New-ThirdPartyNotices.ps1
    - THIRD-PARTY-NOTICES.md
    - docs/dependencies.json
    - docs/dependencies.md
    - docs/development.md

key-decisions:
  - "The HIBP address is an absolute URI built in HibpPwnedPasswords from a constant, not HttpClient.BaseAddress, so even a misconfigured client cannot redirect it"
  - "One retry after 250 ms inside a 3 s total and 2 s attempt limit; the library default (3 retries with 2 s exponential delay) would make every outage cost the full 3 s"
  - "A response with no well-formed line is Unavailable, because a padded answer always has about a thousand lines; an empty or HTML body is not an answer"
  - "The common-password list is compared on the NFC-normalized password, ignoring case"
  - "SecLists pinned at commit 913b327 (file last changed 2026-09-08, 36 days old, repository license MIT)"

patterns-established:
  - "Registry kind data: id, version (commit SHA), source, sha256, path; every EmbeddedResource under src/ needs a record"
---

# Phase 4 Plan 17: Breached-Password Check and the Common-Password Floor Summary

A new password that passes the owner's rule is now checked against Have I Been Pwned with only a 5-character SHA-1 prefix sent to a fixed address, and when that service is down the flow either falls back to a hash-pinned SecLists top-10k floor (resets and must-change) or refuses to save (invite acceptance).

## What was built

- **Tracer (Task 1):** `PasswordRules` runs `PasswordPolicy.Check` first (HIBP is never called on a policy failure), then `IPwnedPasswords`. `HibpPwnedPasswords` sends one GET to `https://api.pwnedpasswords.com/range/{prefix}` with `Add-Padding: true` and the User-Agent `CSPS-Password-Check`; the suffix is compared locally by `HibpRangeParser` (count 0 padding and malformed lines are ignored). A recorded body listing the suffix with count 12 is Breached; count 0 or an absent suffix is NotBreached. HTTP 403/429/500/503, network errors, timeouts and bodies with no well-formed line are Unavailable, and the log carries only the status or the exception type name. A cancelled caller token still throws.
- **Floor and modes (Task 2):** `FailOpenWithFloor` + Unavailable refuses a password on the embedded list ("This password is too common. Choose a different one.") and otherwise accepts it with `BreachCheckSkipped = true` so the caller audits `auth.breach-check-unavailable` and sets the re-check mark (D-18). `FailClosed` + Unavailable returns `CheckUnavailable` ("We couldn't check your password right now.") and never touches the list. `CommonPasswordList` loads the embedded file once (10,001 lines, about 10,000 entries) into a case-insensitive frozen set. In the Testing environment of Debug builds `TestingPwnedPasswords` replaces HIBP; a Release build with Testing refuses to start (QUAL-05 message, like the email sink).
- **Registered data dependency (Task 3):** registry kind `data` (source must be an https URL with a 40-character commit SHA, lowercase sha256, repo path). `DependencyRegistryTests` hashes the file at `path`, fails on a mismatch or a missing file, and fails when a `.csproj` under `src/` embeds a non-`.resx` file that has no record. `THIRD-PARTY-NOTICES.md` gained a "Bundled data files" section with the SecLists copyright and the MIT permission text. `HibpLiveTests` is skipped unless `CSPS_LIVE_HIBP=1`.
- **Wiring:** `AddCspsPasswordChecks(environment)` is called from `AddInfrastructure`, which registers `PasswordRules` (scoped) and the list (singleton). Plan 04-19 does not need to register them again.

## SecLists data file (D-36)

| Item | Value |
| --- | --- |
| Source | `https://raw.githubusercontent.com/danielmiessler/SecLists/913b327317496d062bcc7cace524aaad8a693be2/Passwords/Common-Credentials/10k-most-common.txt` |
| Commit | `913b327317496d062bcc7cace524aaad8a693be2` (2026-09-08, "Add '66668888' to common credentials list"; 36 days old at adoption) |
| SHA-256 | `68782d6a4a19a4768d5f15dd66bd534e7a33055cc755411e33f16d18c50fdcce` |
| Repository license | MIT (GitHub API and the LICENSE at that commit, "Copyright (c) 2018 Daniel Miessler"); repository not archived, about 74,000 stars |
| Shape | ASCII, LF endings, 10,001 lines, no blanks or duplicates, no leading or trailing spaces |

The conditional checkpoint did not trigger: the file exists at the pinned path, the license is MIT, and no package was added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Analyzer errors on the first build of new code**
- **Found during:** Tasks 1 and 2 (TreatWarningsAsErrors).
- **Issue:** CA1848 (use `LoggerMessage` delegates) on the three `LogWarning` calls, and CA1822 on `CommonPasswordList.Count` (it reads only the shared static set).
- **Fix:** the client is a `partial` class with two `[LoggerMessage]` methods (status; reason), the same style as `EmailDispatcher`; `Count` became `static` and the tests read `CommonPasswordList.Count`.
- **Commits:** a3d037a, 1b62aee

**2. [Rule 2 - Missing critical] `.gitattributes` entry so the pinned list keeps its bytes**
- **Found during:** Task 2. `core.autocrlf=true` checks text out as CRLF on Windows, which would change the SHA-256 the registry pins.
- **Fix:** `src/Csps.Infrastructure/Passwords/common-passwords-10k.txt -text`. `git ls-files --eol` shows `i/lf w/lf attr/-text`, and the staged blob hashes to the recorded value.
- **Commit:** 1b62aee

**3. [Process] Task 2 and Task 3 RED commits are compile failures**
- The RED commits fail to compile because the types they test do not exist yet, the same convention as earlier plans in this phase. `HibpLiveTests` compiles and is skipped by design.

### Plan files touched beyond the list
- `.gitattributes` (above), `tests/Csps.Infrastructure.IntegrationTests/Passwords/PasswordCheckRegistrationTests.cs` (resilience limits, per-environment selection, singleton list), and a `copyright` field on the registry record (used only by the notices generator).

## Decisions for the owner

None blocking. For awareness:
- **Absolute URI, not `BaseAddress`.** The plan said "BaseAddress a constant"; the client builds the full address from a constant on every call instead, which is stricter (a test proves a client with a foreign `BaseAddress` still calls only `api.pwnedpasswords.com`).
- **Retry policy.** One retry after 250 ms, with the 3 s total and 2 s attempt timeouts the plan names. Say so if you prefer no retry.
- **Floor list is the current upstream file.** The last upstream change (2026-09-08) added one entry; the commit is pinned, so later upstream edits never change what ships.
- **Hosts need no extra setting.** HIBP needs no key, and `AddInfrastructure` now also needs outbound HTTPS to `api.pwnedpasswords.com` on the host; if the SmarterASP.NET plan blocks outbound calls the check simply reads as Unavailable (fail open with the floor, fail closed on invite acceptance). Worth confirming in the hosting checklist.

## Known Stubs

None.

## Threat Flags

None. T-04-58 (only the prefix leaves, no password or hash in logs, proven by test), T-04-59 (constant address), T-04-60 (3 s limit, fail open with floor except invite), T-04-61 (SHA-256 pinned and tested) and T-04-SC (no package installs) are mitigated as planned.

## Verification

Run on LocalDB (`CSPS_TEST_SQL=localdb`), zero build warnings in Debug and a Release build of the integration test project:

| Project | Tests | Failed | Skipped |
| --- | --- | --- | --- |
| Csps.Domain.UnitTests | 576 | 0 | 0 |
| Csps.Application.UnitTests | 35 | 0 | 0 |
| Csps.ArchitectureTests | 127 | 0 | 0 |
| Csps.Infrastructure.IntegrationTests | 275 | 0 | 1 (HibpLiveTests) |
| Csps.Server.IntegrationTests | 348 | 0 | 0 |

- The tracer gate re-ran both Task 1 verify commands (25 + 5 tests) green before Task 2 started.
- `HibpLiveTests` was run once with `CSPS_LIVE_HIBP=1` for that single process: "password" is Breached and a random 40-character password is NotBreached against the real service.
- `New-ThirdPartyNotices.ps1` passes the license gate and lists SecLists (MIT).
- Acceptance greps hold: the HIBP address and `Add-Padding` in `HibpPwnedPasswords.cs`, `AddStandardResilienceHandler` in `PasswordCheckRegistration.cs`, `EmbeddedResource` in the csproj, `#if CSPS_TESTING` in `TestingPwnedPasswords.cs`, 10,001 lines in the list, `"kind": "data"` in `docs/dependencies.json`, `sha256` in `DependencyRegistry.cs`.

## Requirements

AUTH-11 is not ticked complete: this plan delivers the breached-password check and the common-password floor, while the strength meter, the web mirror of the messages and the handlers that apply `PasswordRules` arrive in later plans.

## Self-Check: PASSED

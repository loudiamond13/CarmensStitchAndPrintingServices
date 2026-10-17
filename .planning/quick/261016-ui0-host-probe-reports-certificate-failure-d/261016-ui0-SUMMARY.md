---
created: 2026-10-16T22:32:00-05:00
updated: 2026-10-16T22:32:00-05:00
phase: quick-261016-ui0
plan: 01
subsystem: host-probe
tags: [hostprobe, certificate, data-protection, sec-04, tdd]
requires: []
provides:
  - "Probe JSON certificateRoundTrips: four attempts (ephemeral, machine, user, ephemeral-3des) with step, exceptionType, hResult, cleaned message and keyCleanup"
  - "tests/Csps.HostProbe.Tests, run in CI's 3 unit tests step"
affects: [03-20, HOSTING-RECORD]
tech-stack:
  added: []
  patterns: ["attempt table (name, export, flags)", "per-attempt dispose then key store check and handle delete"]
key-files:
  created:
    - tools/Csps.HostProbe/CertificateChecks.cs
    - tests/Csps.HostProbe.Tests/Csps.HostProbe.Tests.csproj
    - tests/Csps.HostProbe.Tests/packages.lock.json
    - tests/Csps.HostProbe.Tests/HostFactsJsonTests.cs
    - tests/Csps.HostProbe.Tests/CertificateChecksTests.cs
  modified:
    - tools/Csps.HostProbe/HostFacts.cs
    - tools/Csps.HostProbe/Csps.HostProbe.csproj
    - tools/Csps.HostProbe/README.md
    - Csps.slnx
    - tests/Csps.ArchitectureTests/SolutionLayoutTests.cs
    - .github/workflows/ci.yml
    - web/scripts/smoke.test.ts
    - .planning/HOSTING-RECORD.md
    - .planning/phases/03-ci-cd-staging-deploy/03-20-PLAN.md
decisions:
  - "Use key as RSA PKCS#1 v1.5 encrypt/decrypt, because Data Protection's EncryptedXml key wrap uses it"
  - "Message cleaning replaces the password with [hidden] and drive, UNC and Unix paths with [path], one line, max 200"
status: complete
commits: 7
plan_head_before: d0b42f4f2602c3c17175ae1f54ac3e83cba7cbe0
plan_head_after: c2730c77a65853abb271e146b896037529c2eea8
actuals:
  tokens: 40000
  tasks: 3
  commits: 7
---

# Phase quick-261016-ui0 Plan 01: Host probe certificate attempts Summary

The host probe now reports four certificate load attempts (ephemeral, machine, user, ephemeral-3des) with the failing step, error type, hex HResult, a cleaned one-line message and a key cleanup result, so the next `hostprobe` run shows how CSPS must load its Data Protection certificate on SmarterASP.NET.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 RED | e0e8334 | test: the host probe must report each certificate attempt with its failing step, code and a cleaned message (RED) |
| 1 GREEN | 266459a | fix: the host probe reports where and why the certificate round trip fails (GREEN) |
| 2 RED | 25d78fa | test: the probe must also try the machine and user key stores and the 3DES PFX format, and leave no key behind (RED) |
| 2 GREEN | 8d1039b | fix: the probe tries the machine and user key stores and the 3DES PFX format and confirms no key is left (GREEN) |
| 3 | 482586e | ci: run the host probe tests in the unit test step |
| 3 | 3fbea1b | test: pin that the probe reader prints every certificate attempt and hides the key |
| 3 | c2730c7 | docs: explain the certificate attempts and name the new probe field in the record and plan 03-20 |

## RED failure evidence

- Task 1 RED (e0e8334), `dotnet test --project tests/Csps.HostProbe.Tests`, compile error:
  `CertificateChecksTests.cs(9,20): error CS0246: The type or namespace name 'CertificateAttempt' could not be found`
- Task 2 RED (25d78fa), compile error:
  `CertificateChecksTests.cs(134,31): error CS0117: 'CertificateChecks' does not contain a definition for 'RemoveKeyIfLeft'` (also at line 136)

## Result on this machine (Windows, probe code run directly)

All four attempts Ok; keyCleanup: ephemeral none, machine removed, user removed, ephemeral-3des none. The host answer is still unknown; that needs the owner's run on SmarterASP.NET.

## Verification run

- `dotnet test --project tests/Csps.HostProbe.Tests`: 9 passed, 0 failed
- `dotnet test --project tests/Csps.ArchitectureTests`: 217 passed (includes SolutionLayoutTests, CI workflow and hosting record lints)
- `npm --prefix web test -- --run scripts/smoke.test.ts`: 101 passed; `typecheck`, `lint` and `format:check` clean
- `dotnet format Csps.slnx --verify-no-changes`: clean
- `dotnet build tools/Csps.HostProbe -c Release`: 0 warnings; `dotnet publish tools/Csps.HostProbe -c Release -o artifacts/hostprobe`: succeeded (artifacts/ is git-ignored)
- `git diff --quiet d0b42f4 -- CertificateLoader.cs ProbeKey.cs Program.cs smoke.mjs`: unchanged
- No commit message since d0b42f4 carries a skip marker

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-commit gitleaks flagged the test password constant**
- **Found during:** Task 1 RED commit
- **Issue:** the `generic-api-key` rule matched the first fake test password constant in CertificateChecksTests.cs (a high-entropy made-up value)
- **Fix:** used the low-entropy fake value `pfx-test-value`; commit then passed without bypassing the hook
- **Commit:** e0e8334

**2. [Rule 1 - Bug] Prettier format check failed on the new smoke test**
- **Found during:** Task 3 verify
- **Fix:** ran Prettier on `web/scripts/smoke.test.ts` before committing
- **Commit:** 3fbea1b

Other notes: `ReadStoredKey` disposes the `CngKey` it reads from `RSACng.Key` (after the use step) instead of leaving it undisposed, so a duplicated handle cannot keep the key open. Behaviour on this machine confirmed (keys removed).

## Known Stubs

None.

## Threat Flags

None. The probe adds no endpoint or auth path; ProbeKey.cs and Program.cs are unchanged. It writes machine and user key store entries on the host only transiently, with cleanup verified (threat T-ui0-02).

## Owner's next step

After PR #5 is merged to main, run the deploy workflow with action `hostprobe` (a probe change must be on main first) and paste back the whole `certificateRoundTrips` block. Which attempt passes decides how CSPS loads its certificate in the follow-up fix.

## Self-Check: PASSED

Created files exist (CertificateChecks.cs, the four test project files). Commits e0e8334, 266459a, 25d78fa, 8d1039b, 482586e, 3fbea1b and c2730c7 are all ancestors of HEAD.

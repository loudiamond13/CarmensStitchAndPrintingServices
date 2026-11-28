---
phase: 14-hardening-release-readiness
plan: 04
subsystem: security
tags: [ci-mailbox, zap, signed-in-scan, outbox, data-protection, guard]
requires: []
provides:
  - "tools/Csps.CiMailbox: console tool that prints the newest queued sign-in code or invite token for one address (CI only)"
  - "CiMailboxTargetGuard.Check(connectionString, getEnvironmentVariable) and constant CiMailboxTargetGuard.DatabaseName = CSPS_Zap"
  - "OutboxReader.ReadNewestAsync, OutboxReader.Extract, OutboxReader.ProtectionPurpose"
  - "tests/Csps.CiMailbox.Tests: 50 tests (guard theories, reader on a CSPS_Test database, purpose-drift check, usage cases)"
affects: [14-19]
actuals:
  tokens: 7800
  tasks: 2
  commits: 3
plan_head_before: e757d62f4057abb5ed322f9be50e486653489a19
plan_head_after: 423724c20d221faadfb790b4d146826c8793f754
tech-stack:
  added: []
  patterns:
    - "Tool guard: pure Check() before any connection; reasons never repeat the connection string"
    - "Tool seams for tests: public RunAsync (guard first), internal PrintAsync and CreateProvider (past the guard) via InternalsVisibleTo"
key-files:
  created:
    - tools/Csps.CiMailbox/Csps.CiMailbox.csproj
    - tools/Csps.CiMailbox/Program.cs
    - tools/Csps.CiMailbox/CiMailboxTargetGuard.cs
    - tools/Csps.CiMailbox/OutboxReader.cs
    - tools/Csps.CiMailbox/packages.lock.json
    - tests/Csps.CiMailbox.Tests/Csps.CiMailbox.Tests.csproj
    - tests/Csps.CiMailbox.Tests/CiMailboxTargetGuardTests.cs
    - tests/Csps.CiMailbox.Tests/OutboxReaderTests.cs
    - tests/Csps.CiMailbox.Tests/packages.lock.json
  modified:
    - Csps.slnx
    - tests/Csps.ArchitectureTests/SolutionLayoutTests.cs
key-decisions:
  - "The newest outbox row is chosen by CreatedAt, not by Id: SQL Server sorts a GUID by its last bytes, so a version-7 id does not sort by time in the database"
  - "The tool reads the certificate from DataProtection__* in the process environment (AddEnvironmentVariables), the same way the site does; only CSPS_* and GITHUB_ACTIONS go through the injected reader"
requirements-completed: []
coverage:
  - id: D1
    description: "The tool refuses, before any connection, every target except the loopback container database CSPS_Zap inside GitHub Actions"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "tests/Csps.CiMailbox.Tests/CiMailboxTargetGuardTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.CiMailbox.Tests/OutboxReaderTests.cs#RefusesALocalDbTargetBeforeAnyConnectionOpens"
        status: pass
    human_judgment: false
  - id: D2
    description: "A queued sign-in code or invite token is printed alone; no row, a closed row, another address or another kind exits 1 with nothing on stdout"
    requirement: SEC-05
    verification:
      - kind: integration
        ref: "tests/Csps.CiMailbox.Tests/OutboxReaderTests.cs#PrintsOnlyTheCodeThroughTheWholeToolAndOnlyTheCode"
        status: pass
      - kind: integration
        ref: "tests/Csps.CiMailbox.Tests/OutboxReaderTests.cs#AClosedRowIsSkippedAndTheToolSaysSoInPlainWords"
        status: pass
      - kind: integration
        ref: "tests/Csps.CiMailbox.Tests/OutboxReaderTests.cs#ARowForAnotherRecipientOrAnotherKindIsNeverReturned"
        status: pass
    human_judgment: false
  - id: D3
    description: "The protection purpose equals OutboxEmailSender.ProtectionPurpose; a reflection test fails on drift"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "tests/Csps.CiMailbox.Tests/OutboxReaderTests.cs#ThePurposeEqualsTheOneTheSiteQueuesWith"
        status: pass
    human_judgment: false
  - id: D4
    description: "The tool works against the real CI SQL container with the CI key ring"
    requirement: SEC-05
    verification: []
    human_judgment: true
    rationale: "There is no Docker locally. The first real run happens in the CI job that plan 14-19 adds; the tool was proven here on LocalDB with the real Infrastructure composition and a test certificate."
duration: 19min
completed: 2026-11-27
status: complete
created: 2026-11-27T18:50:00-06:00
updated: 2026-11-27T18:50:00-06:00
---

# Phase 14 Plan 04: A CI-only mailbox tool lets the signed-in scan walk the real sign-in flow Summary

*Created: 2026-11-27T18:50:00-06:00 · Updated: 2026-11-27T18:50:00-06:00*

**`tools/Csps.CiMailbox` prints the newest queued sign-in code or invite token for one address from the outbox, using the site's own key ring, and it refuses every target except `CSPS_Zap` in a loopback SQL container inside GitHub Actions (14 D-36).**

## Performance

- **Duration:** 19 min
- **Started:** 2026-11-27T18:31:00-06:00
- **Completed:** 2026-11-27T18:50:00-06:00
- **Tasks:** 2
- **Files:** 9 created, 2 modified (plus this summary)

## Accomplishments

- CLI: `dotnet run --project tools/Csps.CiMailbox -- --to <address> --kind code|invite`. The connection string comes only from `CSPS_CI_MAILBOX_CONNECTION`. There is no argument for it and no prompt, so the tool never reads stdin. Exit codes: 0 printed, 1 nothing to print or failed, 2 refused, 64 usage.
- The guard runs on the final connection string before any context is built. It needs `GITHUB_ACTIONS` to be exactly `true`, a data source of `127.0.0.1,<port>` or `localhost,<port>`, and the database `CSPS_Zap`. LocalDB, a missing port, a `tcp:` prefix, a remote host, a failover partner, an attached file, and the names `CSPS_Dev`, `CSPS_E2E`, `CSPS_Legacy_Restore`, `CSPS_Zap2`, `BetsLLC_Dev`, `master` are each refused. Reasons never repeat the connection string.
- The reader uses EF LINQ only and the site's Data Protection key ring (same services as the site's `AddInfrastructure`, no host started, so no dispatcher runs and nothing migrates). Purpose `Csps.EmailOutbox.v1` is checked against `OutboxEmailSender.ProtectionPurpose` by reflection.
- The sign-in code is taken from the line that holds only six digits, so a date or time in the text never matches. The invite token is taken from the `#token=` fragment of the accept-invite link and URL-decoded.
- Nothing changed under `src/`. No token is minted, no session created, no package added (both lock files match the existing tools' package sets).

## Task Commits

1. **Task 1 (tracer): the tool prints a queued sign-in code, only from CSPS_Zap**
   - RED: `6ac16044` (test)
   - GREEN: `c74a5bd8` (feat)
2. **Task 2: invite token and plain failures**
   - Tests: `423724c2` (test). No feat commit; see TDD Gate Compliance.

**Plan metadata:** the docs commit that holds this summary.

## TDD evidence

**RED (Task 1, `6ac16044`).** The project compiled with a stub tool: the guard refused everything, `RunAsync` returned 0, the reader threw `NotImplementedException`, the purpose was empty. `dotnet test --project tests/Csps.CiMailbox.Tests` gave `total: 36, failed: 12, succeeded: 24, exit 2`. The 12 red tests were the 3 allowed-target rows, the 5 outside-GitHub-Actions rows, `ThePurposeEqualsTheOneTheSiteQueuesWith` (expected `"Csps.EmailOutbox.v1"`, was `""`), `ReturnsTheTextOfAQueuedSignInCode...`, `PrintsOnlyTheCode...` (both `NotImplementedException`), and `RefusesALocalDbTarget...` (expected exit 2, was 0). The 24 green ones were the refusal rows, which a refuse-everything stub passes by design. Semantic assessment: each red test failed on the planned behavior being absent, not on a build, load or fixture fault. The `gsd_run check tdd-red-evidence` classifier was not run: it reads TAP, JUnit, swift-testing, unittest and go reports, and xUnit v3 on Microsoft.Testing.Platform prints none of those.

**GREEN (Task 1, `c74a5bd8`).** Same command: `total: 36, failed: 0, succeeded: 36`. The Task 1 verify set also passed: `dotnet build Csps.slnx -warnaserror` (0 warnings, 0 errors); `Csps.ArchitectureTests` `SolutionLayoutTests` + `NoInlineSqlTests` + `StartupSafetyTests` `total: 32, failed: 0`; the whole architecture project `total: 290, failed: 0`.

**Task 2 (`423724c2`).** Fourteen new tests (invite token with a plain and an escaped value, nothing-to-extract cases, newer-row-wins with a GUID that sorts the wrong way in SQL Server, closed row, other address and kind, seven usage cases, missing connection variable). They passed on the first run (`total: 18` in `OutboxReaderTests`, then `total: 50, failed: 0` for the project). To show they can fail I broke the reader three ways (order by `Id`, invite returns null, drop the null-text filter) and re-ran: `failed: 4` (both invite rows, the newest-row test, the other-kind test). I then restored the file with `git checkout -- tools/Csps.CiMailbox/OutboxReader.cs`.

## Deviations from Plan

**1. [Rule 1 - Bug] Newest row is chosen by `CreatedAt`, not `Id`**
- **Found during:** Task 1 design, proven in Task 2.
- **Issue:** The plan says "newest by `Id`". SQL Server orders a `uniqueidentifier` by its last six bytes first, so a version-7 GUID does not sort by time in a query. Ordering by `Id` can return an older code.
- **Fix:** `OrderByDescending(CreatedAt)`. `TheNewerRowWinsEvenWhenSqlServerSortsItsIdLower` uses two fixed GUIDs where the older one sorts higher in SQL Server; the broken variant fails it.
- **Files:** tools/Csps.CiMailbox/OutboxReader.cs, tests/Csps.CiMailbox.Tests/OutboxReaderTests.cs
- **Commit:** c74a5bd8, 423724c2

**2. [Rule 3 - Blocking] Stub project in the RED commit**
- C# tests that name missing types do not compile, and a build failure is not valid RED. The RED commit therefore carries the tool project with stub bodies. This is also why the project, lock files, `Csps.slnx` and `SolutionLayoutTests` entries are in the `test(...)` commit.

**3. [Rule 2 - Missing critical functionality] Two internal seams**
- `Program.PrintAsync` and `Program.CreateProvider` are `internal` (with `InternalsVisibleTo` for the test project). `RunAsync` is the only path from `Main`, and it runs the guard first. The seams let tests run the full composition on a `CSPS_Test_<guid>` LocalDB database, which the guard would refuse. Without them the closed-row exit code and the end-to-end print could not be tested here.

**4. Task 2 has no `feat` commit.** The Task 1 GREEN code already held the invite extraction and the plain-failure handling, so the Task 2 tests started green. This is recorded under TDD Gate Compliance.

**5. Commit trailer.** Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` as the plan and the orchestrator rules require, and as plans 14-01 to 14-03 do. The harness reminder in this session named a different model; the orchestrator may want to confirm which line it wants.

**6. Housekeeping.** An empty `python -` heredoc I typed by mistake hung one shell for a few minutes; I killed that one process (my own, matched by its start time and command line). The delayed `sed` edits it released duplicated two lines in `Csps.slnx` and `SolutionLayoutTests.cs`; I removed the duplicates before any commit.

## TDD Gate Compliance

- RED gate: `6ac16044` `test(14-04)`. Present.
- GREEN gate: `c74a5bd8` `feat(14-04)`. Present, after RED.
- REFACTOR: none needed.
- Task 2: tests only (`423724c2`), no `feat` commit, because the behavior already existed. Mutation check above shows the tests are not vacuous. The plan-level RED then GREEN order holds through Task 1.

## Issues Encountered

None open. No build warnings, no test flakes in any run.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-14-08 (guard) is mitigated and tested. T-14-09 (value in a public log) is the job of plan 14-19, which must capture the value and mask it with `::add-mask::` before any other use. T-14-SC: no package added.

## Not verified here

- A run against a real SQL Server container. There is no Docker on this machine (project rule). The tool was run on LocalDB through `PrintAsync` with the real `AddInfrastructure` composition and a test certificate. The first container run is plan 14-19's CI job.
- The certificate settings reach the tool through `DataProtection__CertificateBase64` and `DataProtection__CertificatePassword` in the process environment, as the plan says. The test passes them as in-memory settings; the environment path is the same configuration builder the site uses.

## Next

Plan 14-19 can call the tool to walk invite, set password, sign in and code in the signed-in ZAP scan.

## Self-Check: PASSED

- Files found: all nine created files and both modified files.
- Commits found: `6ac16044`, `c74a5bd8`, `423724c2` are ancestors of HEAD.
- Acceptance greps: `Csps.CiMailbox` in `Csps.slnx` = 2 (baseline 0); `CSPS_CI_MAILBOX_CONNECTION` in `Program.cs` = 2; the plain no-row message in `Program.cs` = 1.

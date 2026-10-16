---
phase: 04-identity-authentication
plan: 35
subsystem: auth-bootstrap
tags: [bootstrap-manager, cli, target-guard, cwe-214, auth-12, runbook]
status: complete
created: "2026-10-15T07:50:00-05:00"
updated: "2026-10-15T07:50:00-05:00"

requires: ["04-22"]
provides:
  - "tools/Csps.BootstrapManager: the guarded bootstrap-manager command (exit 0 done, 1 failed, 2 refused, 64 usage or settings)"
  - "BootstrapTargetGuard.Check(connectionString, confirmedDatabase) and BootstrapTargetCheck"
  - "BootstrapManagerOptions.Parse(args, getEnvironmentVariable) with ConnectionVariable CSPS_BOOTSTRAP_CONNECTION"
  - "SystemRequestContext: IRequestContext with no user, IP, session or user agent and a random W3C correlation id"
  - "docs/operations/bootstrap-manager.md runbook and the first-login steps in docs/development.md"
affects: [phase 3 first deploy, 04 verification]

requirements-completed: []

actuals:
  tokens: 18000
  tasks: 2
  commits: 3
plan_head_before: 1f1965f00229ec5ae5a5b6f5f6615623bb19f6eb
plan_head_after: 39d05de91162bbee21aa12ac3c109a190bb9be24

tech-stack:
  added: []
  patterns:
    - "A tools/ Exe exposes a public RunAsync(args, env reader, extra settings, prompt, output, error, token) so integration tests run the real command in process"
    - "Host.CreateEmptyApplicationBuilder composes AddInfrastructure without a web host; hosted services are never started, so nothing sends mail or migrates"
    - "Option validators run by reading IOptions<T>.Value, so a bad site address or certificate is reported by name before any database work"

key-files:
  created:
    - tools/Csps.BootstrapManager/Csps.BootstrapManager.csproj
    - tools/Csps.BootstrapManager/Program.cs
    - tools/Csps.BootstrapManager/packages.lock.json
    - src/Csps.Infrastructure/Seeding/BootstrapTargetGuard.cs
    - src/Csps.Infrastructure/Seeding/BootstrapManagerOptions.cs
    - src/Csps.Infrastructure/Seeding/SystemRequestContext.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/BootstrapManagerTests.cs
    - docs/operations/bootstrap-manager.md
  modified:
    - Csps.slnx
    - tests/Csps.ArchitectureTests/SolutionLayoutTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Csps.Infrastructure.IntegrationTests.csproj
    - tests/Csps.Infrastructure.IntegrationTests/packages.lock.json
    - docs/development.md

key-decisions:
  - "The guard is stricter than the plan: it also refuses the SQL Server system databases, and on this machine (LocalDB or a loopback address) allows only CSPS_Dev, CSPS_E2E and CSPS_Test_<guid>, as the orchestrator asked"
  - "The command refuses (exit 2) a database with pending migrations instead of failing on a missing table, and never migrates"
  - "Unknown or connection arguments are reported by flag name only, never by value, because a mistyped argument could be the password"
  - "The command reads its environment from DOTNET_ENVIRONMENT or ASPNETCORE_ENVIRONMENT (default Production); only Development adds the Server's user-secrets (read only)"

patterns-established:
  - "Tool-side refusals print 'Refused: <plain reason>' to stderr and never repeat the connection string; failures redact it from exception text"
---

# Phase 4 Plan 35: Guarded bootstrap-manager command and runbook Summary

An operator can create the first Manager on an empty, migrated database with one guarded command that cannot reach the wrong database, never takes the connection string as an argument, and never offers a way around the emailed code.

## What was built

- **Tracer (Task 1):** `tools/Csps.BootstrapManager` parses options, runs `BootstrapTargetGuard`, composes `AddInfrastructure` from environment variables (plus the Server's user-secrets in Development) with `SystemRequestContext`, then calls `BootstrapManagerHandler` from plan 04-22. On success it prints `Invite queued for <email>. The running CSPS site sends it within a minute.`
  - `BootstrapTargetGuard`: needs `--confirm-database` equal to the connection's database; refuses `BetsLLC_*`, `CSPS_Legacy_Restore`, system databases, `AttachDBFilename`, `Failover Partner`, an empty, unreadable or database-less string. On LocalDB or loopback only `CSPS_Dev`, `CSPS_E2E` and `CSPS_Test_<guid>` pass. No reason repeats the connection string.
  - `BootstrapManagerOptions`: `--email`, `--first-name`, `--last-name`, `--confirm-database`, `--public-base-url`; the connection comes from `CSPS_BOOTSTRAP_CONNECTION` or a hidden prompt (no prompt when input is piped). `--connection` and its look-alikes are a usage error that echoes nothing.
  - Exit codes: 0 done; 2 for a guard refusal, an unmigrated database, `bootstrap.manager-exists` and `bootstrap.email-taken` (both printed in plain words); 64 for bad arguments, a bad email or an unusable site address; 1 for other failures.
  - The audit entries carry the System actor (no user, no address, no session).
- **Task 2:** `docs/operations/bootstrap-manager.md` (when and how to run it, SMTP prerequisite, 72-hour invite, re-run rule, exit codes, the no-bypass rule when mail breaks) and a first-login walkthrough under "Signing in locally" in `docs/development.md`.

## Verification

- `BootstrapManagerTests`: 46 passed in the class (guard allow, protected, local-only, confirmation, attach and failover, unreadable cases; options; `SystemRequestContext`; in-process runs on fresh `CSPS_Test_<guid>` databases: first run creates one active Manager with no password and one queued invite and System-actor audits, second run exits 2 with nothing created, reused email exits 2, bad email exits 64, wrong confirmation and `BetsLLC_Dev` exit 2 before any connection, missing connection exits 64, prompt used, `--connection` rejected without echo, `http://` site address exits 64).
- Full Infrastructure.IntegrationTests 369 (368 passed, 1 pre-existing skipped), ArchitectureTests 127 passed (including the layout rule that lists the new project), `dotnet build Csps.slnx` 0 warnings and 0 errors.
- Smoke runs of the real executable: a `BetsLLC_Dev` connection exits 2 with the refusal text, and `--connection` exits 64 without printing the value. The command was not run against `CSPS_Dev` (it would put an account in the owner's dev database).
- Tracer gate (end-of-phase, automated verify only): all three `<verify>` commands re-run green before Task 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan drift] The Manager is not email-confirmed at bootstrap**
- **Found during:** Task 1 (RED run)
- **Issue:** The plan truth says the command yields a "confirmed" Manager; plan 04-22 confirms the email when the invite is accepted (orchestrator note).
- **Fix:** The test asserts `EmailConfirmed` is false after the command; the runbook says the invite link sets the password.
- **Commit:** 688f22f

**2. [Rule 2 - Missing critical functionality] Extra guard and migration checks**
- **Found during:** Task 1
- **Issue:** The plan guard would let the command run on any non-listed database on this machine, and an unmigrated database would die on a missing table.
- **Fix:** Local servers allow only the CSPS dev, E2E and test databases; system databases are refused; pending migrations are refused with a plain message.
- **Commit:** 688f22f

## Known gaps (for the owner)

- An invite that expires unused leaves an active Manager, so the command refuses a second run; no resend exists until staff management (a later phase). The runbook says this plainly: clearing the account needs a reviewed one-off script from the developer.
- The real production run waits for Phase 3 (host SMTP, the database connection details and whether the host database accepts remote connections, which `.planning/HOSTING-RECORD.md` does not yet record).

## Threat model

- T-04-78 (CWE-214): connection string only from the environment variable or hidden prompt; `--connection` is a usage error; refusal and failure text never repeat it (tests assert this against password-bearing strings).
- T-04-79: guard refusals plus confirmation equality, protected names and the local-only allow-list; the command never migrates.
- T-04-SC: no packages installed (lock files only gained the project reference).

## Known Stubs

None.

## Threat Flags

None. The command is an operator tool that adds no network endpoint.

## Decisions for the owner

- Choose how an unused first invite is recovered (a staff-management resend in a later phase, or a documented reviewed script). Until then the runbook points to the developer.
- Requirement AUTH-12 stays unticked: the command exists and is tested, but "production can be signed into" is proven only at the Phase 3 deploy. AUDIT-01 spans other plans.

## Self-Check: PASSED

- Files found: all created files listed above exist.
- Commits found: 5c79c25, 688f22f, 39d05de are ancestors of HEAD.

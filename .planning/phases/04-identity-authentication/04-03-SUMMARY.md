---
phase: 04-identity-authentication
plan: 03
subsystem: auth
tags: [audit, unit-of-work, ef-core, serilog, masking, correlation-id, ipprefix, audit-01, wr-01, wr-02, wr-03, wr-05, wr-06]
status: complete
created: "2026-10-14T20:20:00-05:00"
updated: "2026-10-14T20:20:00-05:00"

requires: ["04-01"]
provides:
  - "IUnitOfWork (SaveChangesAsync, InTransactionAsync that joins an open transaction) over the scoped CspsDbContext"
  - "IAuditTrail.Record (add only) and RecordIndependentlyAsync (own factory context); AppendAsync is gone"
  - "AddDbContextFactory<CspsDbContext>: factory plus scoped context, same options and append-only interceptor"
  - "IpPrefix maps 6to4 and NAT64 clients to the embedded IPv4 /24"
  - "Log masking for Identity and sign-in secrets; request-bound correlation id"
  - "AuditActions: the 21 Phase 4 audit codes with detail value lists; docs/operations/audit-log.md write-path table"
affects: [04-04, every Phase 4 handler that audits or commits, 04-12 to 04-22]

requirements-completed: []

actuals:
  tokens: 17200
  tasks: 3
  commits: 6
plan_head_before: 9234e4cd262dc1f3119234c003b8118ff3d5380b
plan_head_after: 45f4619a3f08638a950160fa5fcad253fbec0f6c

tech-stack:
  added: []
  patterns:
    - "Handlers commit through IUnitOfWork; Record joins the business change, RecordIndependentlyAsync is for failures that must survive a rollback"
    - "Cache factories and other work that can outlive a request create their own context from IDbContextFactory"

key-files:
  created:
    - src/Csps.Application/Ports/IUnitOfWork.cs
    - src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/ContextFactoryRegistrationTests.cs
  modified:
    - src/Csps.Domain/Auditing/IpPrefix.cs
    - src/Csps.Application/Ports/IAuditTrail.cs
    - src/Csps.Infrastructure/Auditing/AuditTrail.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Infrastructure/Content/SiteSettingsReader.cs
    - src/Csps.Server/Logging/SensitiveDataMasking.cs
    - src/Csps.Server/Http/CorrelationId.cs
    - docs/operations/audit-log.md
    - .planning/phases/01-hosting-verification-backend-foundation/01-REVIEW-DISPOSITION.md

key-decisions:
  - "Record only adds; the handler's IUnitOfWork commits. Failure audits use RecordIndependentlyAsync so a rollback cannot erase evidence"
  - "InTransactionAsync joins a transaction already open on the context (for example the idempotency transaction of plan 04-20) instead of starting a second"
  - "The masker treats any property ending in Hash, Stamp, Key or Mac as secret, so an innocent name such as CacheKey is masked too; the safe side of CWE-532"
---

# Phase 4 Plan 3: Safe Audit Write Path Summary

The audit write path is now safe before Phase 4 writes its first auth event: a 6to4 or NAT64 visitor is stored as their IPv4 /24, handlers commit audit entries with their own change through `IUnitOfWork`, failure audits survive a rollback through their own context, and Identity secrets, request-bound trace ids and the 21 auth action codes are fixed in code and in the operations guide.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 | Tracer: audit entry commits only with the handler's unit of work; 6to4 and NAT64 mapped to /24 (WR-02, WR-03 a) | 4bfcc5c (RED), fc6af13 |
| 2 | Failure audits through their own context; settings cache on a context factory (WR-03 b, WR-01) | 0bcdbc8 (RED), d32306a |
| 3 | Mask Identity and auth secrets, request-bound correlation id, AUDIT-01 catalog (WR-05, WR-06) | 31cf5be (RED), 45f4619 |

`commits: 6` is the measured count from the plan ledger base (all plan work, no orchestrator commits).

The tracer gate: Task 1's `<verify>` (Domain IpPrefix tests and Infrastructure AuditTrail tests) was re-run end to end before Task 2 and passed (27 and 9 tests), then Task 2 expanded.

## Verification

- `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- `dotnet test Csps.slnx`: 972 tests, 0 failed (Application, Domain, Architecture, Infrastructure integration, Server integration).
- `tools/scripts/Invoke-CoverageGate.ps1`: Domain line 100% (378/378) and branch 100% (160/160); Application line 100%. PASS.
- Task 2's concurrency test and the "no scoped CspsDbContext" test were checked against the previous `SiteSettingsReader`: both fail there ("connection is closed", "unable to resolve CspsDbContext") and pass on the factory version, so they do discriminate.
- Acceptance greps all hold (`void Record(` 1, `AppendAsync` outside docs 0, `InTransactionAsync` 1, 6to4 and NAT64 branches present, `AddDbContextFactory` 1, `IDbContextFactory<CspsDbContext>` in the reader 1, `RecordIndependentlyAsync` in the port 1, `PasswordHash` in the masker, `IHttpActivityFeature` 1, `auth.sign-in-failed` in the guide, `disposition: open` 0).

## Final disposition of the Phase 1 review items

| Item | Disposition | Where |
|------|-------------|-------|
| WR-01 HybridCache factory on a scoped context | fixed | plan 04-03 (Task 2) |
| WR-02 IpPrefix 6to4 and NAT64 | fixed | plan 04-03 (Task 1); the owner's deferral condition (before any audit write) is met |
| WR-03 AuditTrail commits the whole context | fixed | plan 04-03 (Tasks 1 and 2) |
| WR-04 dev-seed guard | fixed | quick-261007-p98 (unchanged) |
| WR-05 masker misses Identity secrets | fixed | plan 04-03 (Task 3) |
| WR-06 correlation id and nested activities | fixed | plan 04-03 (Task 3) |
| WR-07 HSTS includeSubDomains | deferred | Phase 3 deploy |
| WR-08 log retention under a flood | deferred | Phase 14 hardening |
| WR-09 vacuous content-type assertions | deferred | Phase 14 hardening |
| IN-01 "bot" user-agent substring | deferred | Phase 14 hardening |
| IN-02 secrets on the command line | fixed | plan 04-01 |
| IN-03 forwarded-headers detector | deferred | Phase 14 hardening |
| IN-04 JWT token type | planned | plan 04-13 |
| IN-05 HTTPS redirection vs termination | deferred | Phase 3 deploy |
| IN-06 AllowedHosts and Host-header links | planned | links in plan 04-09 (App:PublicBaseUrl); AllowedHosts value deferred to Phase 3 deploy |
| IN-07 non-RSA PFX check | deferred | Phase 14 hardening |
| IN-08 minor tooling inaccuracies | deferred | Phase 14 hardening |
| IN-09 CLAUDE.md retention | fixed | the line already says 8 months (D-32); verified |

No item is left `open`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test deadlock in the "joins an outer transaction" test**
- **Found during:** Task 1 GREEN
- **Issue:** The test read the audit log on a second connection while the outer transaction held an uncommitted insert, so the read blocked until the command timeout.
- **Fix:** Removed that intermediate read; the test still proves the join (`CurrentTransaction` is the outer transaction before and after) and that the row exists after the outer commit.
- **Files modified:** `tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditTrailTests.cs`
- **Commit:** fc6af13

### Small additions beyond the plan text

- `AuditActions` also exposes `LockoutDetails` (`password`, `code`) and `SessionsRevokedDetails` (`sign-out-others`, `password-reset`) as lists, so later handlers and tests use the same strings the plan names for those details.
- `SigningKeyId` is an exact masked name, because Task 3's behavior list requires it and no suffix covers it.
- `audit-log.md` had no timestamp line, so `created`/`updated` front matter was added (created taken from the file's first commit date).
- The disposition file gained a `planned` value (legend line extended) for IN-04 and IN-06, which are scheduled in named plans but not done yet.

### Notes

- The research note says `CorrelationId.For` falls back to `context.TraceIdentifier`. The code already used a random W3C id there, so WR-06 reduced to preferring the request's own activity (`IHttpActivityFeature`) over `Activity.Current`.
- Tasks 1 and 2 RED states are compile failures (the new members do not exist), plus five failing Domain cases for Task 1.
- `AuditLogSql` test helper now exposes `BuildProvider` and records through `Record` plus `IUnitOfWork`; the existing append-only tests are unchanged.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or trust-boundary file. T-04-06 to T-04-09 mitigations are implemented and tested: 6to4 and NAT64 minimization, rollback and isolation of audit entries, Identity secret masking, and the factory-backed settings cache.

## Requirements

AUDIT-01 is not marked complete: this plan fixes the write path and the action catalog, but the events themselves are written by plans 04-12 to 04-22.

## Self-Check: PASSED

All created files exist and the six task commits (4bfcc5c, fc6af13, 0bcdbc8, d32306a, 31cf5be, 45f4619) are ancestors of HEAD.

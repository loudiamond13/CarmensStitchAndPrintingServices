---
gsd_state_version: "1.0"
current_phase: 1
current_phase_name: Hosting Verification & Backend Foundation
status: executing
stopped_at: Completed 01-05-PLAN.md
last_updated: "2026-10-07T15:21:36.378Z"
last_activity: 2026-10-07
last_activity_desc: Phase 1 execution started
state_head: 44592d74a393c793d3457948d90e14e99ffcd96e
progress:
  total_phases: 17
  completed_phases: 0
  total_plans: 13
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-06)

**Core value:** Staff can record every order (items, payments, discounts, expenses, images) and always see correct, server-computed totals and balances. Existing production data is carried over with zero loss.
**Current focus:** Phase 1 — Hosting Verification & Backend Foundation

## Current Position

Phase: 1 (Hosting Verification & Backend Foundation) — EXECUTING
Plan: 6 of 13
Status: Ready to execute
Last activity: 2026-10-07 — Phase 1 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 14 min | 3 tasks | 43 files |
| Phase 01 P02 | 25 min | 3 tasks | 39 files |
| Phase 01 P03 | 13 min | 3 tasks | 12 files |
| Phase 01 P04 | 29 min | 3 tasks | 22 files |
| Phase 01 P05 | 9 min | 3 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in the PROJECT.md Key Decisions table. Recent decisions that affect current work:

- [Roadmap]: Took the 14-phase structure from research/SUMMARY.md and renumbered its Phase 1a/1b/1c as Phases 1–3. Inquiries were split out of the public-site phase into Phase 13, giving 17 phases. Legacy discovery, legacy import and cutover stay last (Prime Directive 11).
- [Roadmap]: Company Expenses (Phase 6) comes before Orders to prove the slice pattern. Orders are split three ways: domain & API (7), screens (8), images & jobs (9). The Admin Dashboard is added as Phase 10.
- [Roadmap]: Cross-cutting QUAL/SEC/A11Y/PERF requirements map to the phase where their gate is first built. The PRD §22 Definition of Done enforces them in every later phase.
- [Phase 01]: Owner approved the full Phase 1 package list (01-01 Task 1 legitimacy gate) on 2026-10-07 before first restore; recorded in docs/dependencies.json approvals
- [Phase 01]: Dependency registry scopes are runtime|build|test|tool|font; D-18 exceptions MPL-2.0->test, OFL-1.1->font; pin/registry mismatch fails DependencyRegistryTests
- [Phase 01]: xUnit v3 MTP: zero-match filter exits 8 (A14 first half confirmed); report switches are --report-xunit-junit/--report-xunit-trx
- [Phase 01]: CspsApiFactory keeps one public ctor (xUnit1056); the (string) ctor is protected and CspsApiFactory.ForDatabase(connectionString) is the public entry for real databases
- [Phase 01]: LocalDB (localdb)\CSPS 17.0 connects with Integrated Security and no TrustServerCertificate (A12 confirmed); CSPS_Dev is created by dotnet ef at compat 170 while EF SQL and test DBs are pinned to 160
- [Phase 01]: TestDatabaseName.IsDisposable also checks exact length because .NET $ matches before a trailing newline
- [Phase 01]: BusinessClock (Domain, pure) gives business day/month/calendar-year ranges as [StartUtc, EndUtcExclusive); DST-gap midnight starts at the first valid minute, ambiguous midnight at the first occurrence
- [Phase 01]: Both database-backed /health checks (database, time-zone) share a 3 s timeout: on a cold cache the time-zone check reads SiteSettings and SqlClient retries a failed login after 10 s
- [Phase 01]: AddInfrastructure calls AddLogging (TryAdd only) so the health service validates on a plain ServiceCollection
- [Phase 01]: MinimalHealthWriter sends no body for HEAD; status, Content-Type and Cache-Control: no-store are kept
- [Phase 01]: Dev-seed CLI (tools/Csps.DevSeed) creates the database and pins it to SqlCompatibility.Level before migrating; CSPS_Dev is now at 160
- [Phase 01]: DevSeedTargetGuard allows only CSPS_Dev/CSPS_E2E (OrdinalIgnoreCase) on any server; refuses MSSQLLocalDB, AttachDBFilename, empty/unparseable; reasons never echo the connection string
- [Phase 01]: Seed steps implement ISeedStep with a unique Order and are appended to DevSeedSteps.All by the phase that creates their entity; DevSeeder rejects duplicate Order before running
- [Phase 01]: ArchUnitNET rules against types from unloaded assemblies must use NotDependOnAnyTypesThat(); NotDependOnAny(Types().That()...) misses them
- [Phase 01]: CspsDatabase.ResetAsync (Respawn) ignores __EFMigrationsHistory and SiteSettings; plan 09 must add AuditLog and AuditLogTruncateGuard
- [Phase 01]: AuditEntry.Create (Domain) stores only IpPrefix.From (/24, /48) and UserAgentFamily.Classify labels; throws ArgumentNullException/ArgumentException for programming errors and never echoes rejected values
- [Phase 01]: IpPrefix picks /24 vs /48 from AddressFamily; IPAddress holds only 4 or 16 bytes, so there is no unreachable third-family branch (keeps Domain at 100% branch)
- [Phase 01]: UserAgentFamily reads only the first 512 chars as a span; blank within them is Unknown; Edge/Opera/Samsung precede Chrome and bots precede everything
- [Phase 01]: tdd-red-evidence matches theory target names against raw JUnit text, so theory targets must use &quot; entities

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: The FND-13 hosting record needs SmarterASP.NET control-panel access, and the SMTP check needs a sender domain with DNS (C-45, OD-12). If access lags, the hosting spike runs last and the compatibility level is pinned provisionally.
- [Phase 3]: The owner must create the GitHub repo and provide Web Deploy credentials and secrets. C-27 (security tooling cost) must be ruled before CI.
- [Phase 4]: Send the security batch (OD-12, C-4, C-5, C-6, C-7, C-8, C-9, C-19, C-23, C-33) before the phase starts. Email delivery is a hard dependency for sign-in.
- [Phase 7]: All order rulings must close before the first test: OD-3 to OD-7, C-1, C-3, C-13, C-14, C-15/C-24, C-37 to C-39, C-42 to C-44.
- [Phase 9]: Needs a Cloudinary account and credentials, and the OD-9 / C-26 delivery ruling.
- [Phase 13]: The C-36 ruling may defer the whole phase to v2.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-07T15:21:36.338Z
Stopped at: Completed 01-05-PLAN.md
Resume file: None

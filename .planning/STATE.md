---
gsd_state_version: "1.0"
current_phase: 02
current_phase_name: Web Foundation & Design System
status: executing
stopped_at: Completed 02-01-PLAN.md
last_updated: "2026-10-08T03:35:46.248Z"
last_activity: 2026-10-07
last_activity_desc: Phase 02 execution started
state_head: 968c81a0f7d08d773450276a1791d2302c6dec56
progress:
  total_phases: 17
  completed_phases: 1
  total_plans: 31
  completed_plans: 14
  percent: 6
created: "2026-10-07T00:08:54-05:00"
updated: "2026-10-07T19:13:13-05:00"
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-07)

**Core value:** Staff can record every order (items, payments, discounts, expenses, images) and always see correct, server-computed totals and balances. Existing production data is carried over with zero loss.
**Current focus:** Phase 02 — Web Foundation & Design System

## Current Position

Phase: 02 (Web Foundation & Design System) — EXECUTING
Plan: 2 of 18
Status: Ready to execute
Last activity: 2026-10-07 — Phase 02 execution started

Progress: [█░░░░░░░░░] 6%

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 13 | - | - |

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
| Phase 01 P06 | 17 min | 3 tasks | 22 files |
| Phase 01 P07 | 18 min | 3 tasks | 18 files |
| Phase 01 P12 | 10min | 3 tasks | 10 files |
| Phase 01 P08 | 17 min | 3 tasks | 26 files |
| Phase 01 P09 | 15 min | 3 tasks | 18 files |
| Phase 01 P10 | 23min | 3 tasks | 15 files |
| Phase 01 P11 | 29min | 3 tasks | 13 files |
| Phase 01 P13 | 4 min | 2 tasks | 2 files |
| Phase 02 P01 | 37 min | 3 tasks | 30 files |

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
- [Phase 01]: DevSeedTargetGuard allows only CSPS_Dev/CSPS_E2E (OrdinalIgnoreCase) and only on `(localdb)\CSPS` or a loopback container (`127.0.0.1,<port>` / `localhost,<port>`); refuses every other server (incl. MSSQLLocalDB, named-pipe aliases, remote hosts), Failover Partner, AttachDBFilename, empty/unparseable; reasons never echo the connection string (WR-04 fixed, quick 261007-p98)
- [Phase 01]: Seed steps implement ISeedStep with a unique Order and are appended to DevSeedSteps.All by the phase that creates their entity; DevSeeder rejects duplicate Order before running
- [Phase 01]: ArchUnitNET rules against types from unloaded assemblies must use NotDependOnAnyTypesThat(); NotDependOnAny(Types().That()...) misses them
- [Phase 01]: CspsDatabase.ResetAsync (Respawn) ignores __EFMigrationsHistory and SiteSettings; plan 09 must add AuditLog and AuditLogTruncateGuard
- [Phase 01]: AuditEntry.Create (Domain) stores only IpPrefix.From (/24, /48) and UserAgentFamily.Classify labels; throws ArgumentNullException/ArgumentException for programming errors and never echoes rejected values
- [Phase 01]: IpPrefix picks /24 vs /48 from AddressFamily; IPAddress holds only 4 or 16 bytes, so there is no unreachable third-family branch (keeps Domain at 100% branch)
- [Phase 01]: UserAgentFamily reads only the first 512 chars as a span; blank within them is Unknown; Edge/Opera/Samsung precede Chrome and bots precede everything
- [Phase 01]: tdd-red-evidence matches theory target names against raw JUnit text, so theory targets must use &quot; entities
- [Phase 01]: Serilog uses preserveStaticLogger: true and UseSerilogRequestLogging gets the host's own Serilog.ILogger, so parallel hosts never share the static Log.Logger
- [Phase 01]: CspsLogging:WriteToFile defaults on; only CspsApiFactory turns it off (LogFileSwitchKey = LoggingRegistration.WriteToFileKey)
- [Phase 01]: Request-completion events are matched by Serilog's template 'HTTP {RequestMethod} {RequestPath} responded {StatusCode}'; framework events also carry RequestPath and StatusCode
- [Phase 01]: The masking enricher also walks captured structures, dictionaries and sequences; the destructuring policy masks {@x} objects before capture
- [Phase 01]: IRequestContext uses Connection.RemoteIpAddress only; ForwardedHeadersTests blocks forwarded-headers setup or proxy-header reads under src/ until FND-13
- [Phase 01]: Shared log files are read in tests with FileShare.ReadWrite|Delete and a short retry (a sharing violation on fresh %TEMP% files is transient)
- [Phase 01]: D-28 decision: option-a (2026-10-07). The owner may create one temporary probe site next to the live site (never inside it) and run SELECT-only queries on the live database in the control panel; the probe site is deleted afterwards and its key never enters chat or git
- [Phase 01]: tools/Csps.HostProbe is a throwaway key-protected probe (503 without a 32+ char key, 401 empty body without a match, fixed-time SHA-256 compare); never referenced by src/ or deployed with the site
- [Phase 01]: HOSTING-RECORD.md Facts rows start Unverified and are doc-linted by HostingRecordTests (valid statuses, Verified needs result and date, no secrets, D-28 line)
- [Phase 01]: Default deny: fallback RequireAuthenticatedUser plus named Staff/Manager policies; every endpoint needs an AuthorizationMatrix row and either an allow-listed AllowAnonymous or a Policies constant (DiscoveredEndpointsAreFullyCovered)
- [Phase 01]: JwtBearer challenge is a bare Bearer (IncludeErrorDetails false, CWE-209); MapInboundClaims false keeps the raw sub and role claims
- [Phase 01]: Jwt:SigningKey (base64, >= 32 bytes) comes only from user-secrets (UserSecretsId 7d33a131-9aea-4f9c-90eb-213d2b59cbee, tools/scripts/Initialize-DevSecrets.ps1) or host settings; ValidateOnStart fails startup otherwise
- [Phase 01]: Test JWT keys are SHA-384 digests of fixed labels computed in-process (TestJwt), so no key literal is committed
- [Phase 01]: Unknown non-API paths answer 401 to anonymous callers (A3 confirmed); Phase 2 must map and allow-list the SPA host anonymously
- [Phase 01]: D-25/D-32 resolved as option-a with 8-month retention (owner, 2026-10-07): TR_AuditLog_AppendOnly refuses every UPDATE (51000) and DELETE (51001) except a DELETE with read-only session flag csps.audit_purge = 1 where every row is older than 8 months; mixed statements fail as a whole; TRUNCATE blocked by AuditLogTruncateGuard FK
- [Phase 01]: AddInfrastructure requires a host-registered IRequestContext (AuditTrail depends on it); plain-ServiceCollection callers (tests, tools) must register one
- [Phase 01]: Append-only audit log enforced in three layers: DB trigger, FK truncate guard, EF AuditLogAppendOnlyInterceptor registered once in CspsDbContextOptions.Configure; Respawn never resets AuditLog/AuditLogTruncateGuard
- [Phase 01]: 01-10: AddCspsDataProtection loads the DP certificates from IConfiguration at registration (XmlKeyDecryptionOptions is internal); ValidateOnStart still stops the host on any bad secret
- [Phase 01]: 01-10: A refusing XML encryptor is installed when no certificate loads, so no composition can store a key unencrypted
- [Phase 01]: 01-10: No-database test hosts keep the (certificate-encrypted) key ring in memory; DB-backed hosts use dbo.DataProtectionKeys
- [Phase 01]: 01-11: Owner approved (2026-10-07, Option A) a narrow version-pinned license exception: Microsoft.Data.SqlClient.SNI.runtime 6.0.2 and Microsoft.Identity.Client.NativeInterop 0.20.6 (Microsoft Software License Terms; free, not open source, shipped unmodified inside the app only, Microsoft notices kept). Recorded in docs/license-exceptions.json; any other version fails the license gate.
- [Phase 01]: 01-11: License gate fails on stale exceptions (an entry matching no package), so an SqlClient/EF upgrade that moves either package needs a new owner approval.
- [Phase 01]: D-33 (owner, 2026-10-07): target production DB is SQL Server 2025 (host is 2022 today); the 2025 move happens at cutover after a fresh backup; SqlCompatibility.Level stays 160 provisional, re-pin to 170 after the 2025 DB exists and is verified
- [Phase 01]: 01-13: Host facts (2026-10-07): .NET Basic, 1/1 DB, 1000 MB, SQL Server 2022 16.0.x Web, app login db_owner; probe impossible (no extra site) so runtime/in-process/proxy/tz/PFX facts are verified on the Phase 3 first deploy
- [Phase 01]: 01-13: cspstailoring.com SPF ends -all and DMARC is p=reject; Phase 4 mail must use SmarterASP.NET mail servers (include:_spf.site4now.net) with aligned DKIM; Gmail D2 check still due
- [Phase 02]: Owner cool-down exceptions (2026-10-07): source-map-js 1.2.2 and http-cache-semantics 4.3.0 (security fixes) and rolldown + @rolldown/binding-* 1.2.11 (vite 8.3.3 engine waiver), pinned via web/package.json overrides
- [Phase 02]: SPA shell keeps GET/HEAD-only registration: matrix keys GET and HEAD {*path:nonfile}; other methods on page paths stay default-deny
- [Phase 02]: D-29 via ReservedPathMetadata: outside Development /openapi/{**path} and /scalar/{**path} are anonymous ProblemDetails 404 fallbacks

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 → 3/4/17]: Hosting record still has Unverified facts: probe facts (runtime patch, content root, logs, client IP, HTTPS, Manila/en-PH, PFX, memory) verified on the Phase 3 first deploy; Gmail SPF/DKIM/DMARC pass (D2) before Phase 4. SmarterASP.NET confirmed SQL Server 2025 is offered (new DB + `.bak` restore, no in-place upgrade); still ask whether a temporary second database is allowed at no cost (Phase 17 prerequisite, D-33).
- [Phase 4]: Code review WR-02 (IpPrefix 6to4/NAT64 → IPv4 before truncation) is owner-deferred and MUST be fixed before any code path writes audit rows. Also triage the remaining open review items (WR-01, WR-03, WR-05..WR-09, IN-*) before shipping.
- [Phase 2+]: API style is now controller-based (owner, 2026-10-07); `GET /api/v1/site-settings` converts to a controller when a phase touches it.
- [Phase 3]: GitHub repo exists (private, default branch `dev`; PRs target `dev`). The owner must still provide Web Deploy credentials and secrets. C-27 (security tooling cost) must be ruled before CI.
- [Phase 4]: Send the security batch (OD-12, C-4, C-5, C-6, C-7, C-8, C-9, C-19, C-23, C-33) before the phase starts. Email delivery is a hard dependency for sign-in.
- [Phase 7]: All order rulings must close before the first test: OD-3 to OD-7, C-1, C-3, C-13, C-14, C-15/C-24, C-37 to C-39, C-42 to C-44.
- [Phase 9]: Needs a Cloudinary account and credentials, and the OD-9 / C-26 delivery ruling.
- [Phase 13]: The C-36 ruling may defer the whole phase to v2.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261007-j0u | Add staff money requirements (payment Received by, staff balances, coworker transfers, Manager-only transfer delete), idempotent form posts and concurrency guarantees | 2026-10-07 | ac2f224 | [261007-j0u-add-staff-money-requirements-payment-rec](./quick/261007-j0u-add-staff-money-requirements-payment-rec/) |
| 261007-k45 | Add expense Paid by (company and order expenses, deducts from money on hand) and record-level Created by / Updated by on every record | 2026-10-07 | 1bb8dd7 | [261007-k45-add-expense-paid-by-and-record-level-cre](./quick/261007-k45-add-expense-paid-by-and-record-level-cre/) |
| 261007-kz6 | URL query-string UI state with nuqs 2.10.1 (owner-approved): WEB-10, list requirements, analytics query stripping, planned dependency record | 2026-10-07 | 415c7cb | [261007-kz6-url-query-string-ui-state-with-nuqs](./quick/261007-kz6-url-query-string-ui-state-with-nuqs/) |
| 261007-p98 | Fix WR-04: dev-seed guard allows only (localdb)\\CSPS or a loopback container (127.0.0.1/localhost,<port>), refuses Failover Partner | 2026-10-07 | 50a0cd3 | [261007-p98-fix-wr-04-dev-seed-guard-server-allow-li](./quick/261007-p98-fix-wr-04-dev-seed-guard-server-allow-li/) |
| 261007-qde | Gitignore .planning/design/ (local-only Claude Design HTML) and record it as the visual UI reference | 2026-10-08 | 8c2d4f9 | [261007-qde-gitignore-planning-design-local-only-cla](./quick/261007-qde-gitignore-planning-design-local-only-cla/) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-08T03:35:46.135Z
Stopped at: Completed 02-01-PLAN.md
Resume file: None

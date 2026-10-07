# Walking Skeleton - CSPS (Carmen's Stitch & Printing Services)

**Phase:** 1
**Generated:** 2026-10-07

## Capability Proven End-to-End

On a fresh clone, a developer applies the EF migrations to an empty `CSPS_` database on `(localdb)\CSPS`, starts the API, and `GET /health` reports the database reachable and the business time zone (Asia/Manila) read from the SiteSettings row that the migration itself created, through the cached SiteSettings port and `IBusinessCalendar`.

Built by plans 01 (strict build + `/health` liveness), 02 (empty-database schema, SiteSettings row, cached port, LocalDB fixture) and 03 (database and time-zone health checks over the business calendar). Plan 10 Task 3 proves the documented local full-stack run (`dotnet run --project src/Csps.Server --launch-profile http`, then `http://localhost:5115/health`), and plan 11 proves the same from a clean `git clone`.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | .NET 10 / C# 14 Minimal APIs under `/api/v1`, onion with four production projects (`Csps.Domain` <- `Csps.Application` <- `Csps.Infrastructure` <- `Csps.Server`), no mediator, one handler per use case, manual mapping, `Result<T>` mapped to RFC 9457 | PRD sections 2-3; client-agnostic API for the web app now and an Android app later; ArchUnitNET enforces the layers (D-16) |
| Build | `TreatWarningsAsErrors` (+ MSBuild warnings), latest-recommended analyzers, code style in build, nullable, central exact pins, lock files, NuGetAudit all as error, BannedApiAnalyzers for clock and `System.Random`, 14-day cool-down, dependency registry test | QUAL-01, QUAL-06, D-19; zero warnings everywhere |
| Data layer | SQL Server 2025, EF Core 10 code-first, Fluent configuration only, schema only from migrations, no JSON columns, compatibility level pinned in one constant (`SqlCompatibility.Level`, 160 provisional until FND-13), nothing migrates or seeds at startup, production gets reviewed idempotent scripts | PRD section 5.6, Prime Directive 11, D-08, D-13 |
| Shared data | `SiteSettings` singleton (Id 1, CHECK constraint) seeded by the migration with D-04 values, read through `ISiteSettingsReader` backed by in-process HybridCache (tag `site-settings`, 64 KB cap) and invalidated through `ISiteSettingsCache` | FND-09, D-02, D-04, D-10 (256 MB pool) |
| Time | `TimeProvider` + `IBusinessCalendar` -> pure `BusinessClock`; zone from SiteSettings with the Asia/Manila -> Singapore Standard Time -> fixed UTC+08 fallback chain; calendar year | FND-08, D-02 (costly), D-03 |
| Auth | JWT bearer validation (HS256, key >= 32 bytes from user-secrets/host settings) now; issuance, 2FA and sessions in Phase 4; default-deny fallback policy plus named `Staff` and `Manager` policies; discovery-driven authorization matrix | SEC-02, D-29 |
| Errors | Every API error is `application/problem+json` with a 32-hex `traceId` (= W3C trace id = log correlation id), plain-English titles, generic 5xx text "Something went wrong. Reference: <traceId>" | FND-05, D-26, D-27 |
| HTTP hardening | Outermost middleware sets strict CSP (no unsafe-inline/eval), HSTS on HTTPS, nosniff, Referrer-Policy, Permissions-Policy, COOP; no Server/X-Powered-By; OpenAPI + Scalar only in Development | SEC-01, D-14 |
| Logging | Serilog compact JSON files in `{contentRoot}/logs` (daily, 30 files/30 days, 10 MB, shared), secret masking by exact name/suffix, no DB sink, no alerting yet | FND-07, D-21, D-22 |
| Audit | Append-only `AuditLog` (trigger + truncate-guard FK + EF interceptor), /24 and /48 IP prefixes, UA family only, purge path per the D-25 checkpoint | FND-10, D-24, D-25 (one-way) |
| Key ring | Data Protection keys in the database (`PersistKeysToDbContext`), application name `Csps`, encrypted with a certificate from host secrets (dev PFX in user-secrets) | SEC-04, D-15 (costly) |
| Testing | xUnit v3 on Microsoft.Testing.Platform, Shouldly, NSubstitute; one `CSPS_Test_<guid>` database per test class on `(localdb)\CSPS` locally, Testcontainers SQL Server 2025 only in CI (`CSPS_TEST_SQL` per process); Respawn resets; coverage via coverlet.MTP + ReportGenerator (Domain 100% line+branch, Application >= 95% line) | FND-11, QUAL-03, D-05, D-07, D-17 |
| Deployment target | SmarterASP.NET Basic, IIS in-process (`web.config`), no staging, manual-approval production deploys via Web Deploy (Phase 3); Phase 1 proves a documented local full-stack run | D-10, D-11; FND-13 records the host facts |
| Directory layout | `src/` (4 production projects), `tests/` (5 test projects + `Csps.Testing` shared library), `tools/` (`Csps.DevSeed`, `Csps.HostProbe`, `scripts/`), `docs/` (registry, operations, development guide), `web/` from Phase 2 | PRD section 3.1, FND-02 |

## Stack Touched in Phase 1

- [x] Project scaffold (framework, build, lint/analyzers, test runner) - plan 01
- [x] Routing - `GET /health` (anonymous), `* /api/{**path}` ProblemDetails 404 (anonymous), `GET /api/v1/site-settings` (Staff) - plans 01, 03, 06, 08
- [x] Database - real read (SiteSettings through the cached port, `/health`, `/api/v1/site-settings`) AND real writes (migration seed row, dev seed, audit append, Data Protection keys) - plans 02, 03, 04, 09, 10
- [ ] UI - not in Phase 1 by design: this phase is backend-only (no UI-SPEC); the first UI interaction wired to this API is Phase 2's web app. In Phase 1 the "client" is the integration-test HTTP client and curl against the running API.
- [x] Deployment - documented local full-stack run (plan 10 Task 3, `docs/development.md` in plan 11); hosted deploy is Phase 3

## Out of Scope (Deferred to Later Slices)

- The React web app, its layouts, the SPA host with anonymous static assets and the SPA fallback route (Phase 2, WEB-01..08). Note for Phase 2: under the default-deny fallback policy, unknown non-API paths currently return 401, so the SPA host and static assets must be mapped with explicit `AllowAnonymous` and added to the authorization matrix.
- CI/CD, Web Deploy, `web.config` caching/compression/rewrite rules, Web Deploy exclusion of `logs/` (Phase 3, OPS-01..05).
- Token issuance, sign-in, 2FA, sessions, email, the audit event catalog (Phase 4, AUTH-*, AUDIT-01); rate limiting including `/health` (SEC-03, Phase 4).
- SiteSettings editing UI and the Manager-editable time zone (Phase 11, CONT-01); dev-seed steps for users, orders, company expenses and the price list (added by the phases that create those entities, D-30).
- Audit-log retention purge job and a runtime trigger-enabled check (hardening phase); error alerting and an uptime monitor (deferred, D-22).
- Forwarded-headers processing (only after the FND-13 record verifies the proxy topology); a staging site (D-11).

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Visitors and staff see the UI-spec design system in working public and admin layouts served from `wwwroot`.
- Phase 3: Every pull request runs the full pipeline, and merges deploy to SmarterASP.NET behind manual approval.
- Phase 4: Staff sign in with email, password and an emailed 6-digit code; every auth event is audited.
- Phase 5: Staff manage their own profiles; Managers run the staff roster under guard rules.
- Phase 6: Staff record, find and total company expenses with Manila-month KPIs (the pattern-proving CRUD slice).
- Phase 7: The order aggregate and API enforce every business rule with server-computed totals.
- Phase 8: Staff run orders day to day in the portal.
- Phase 9: Staff attach and arrange order photos; maintenance jobs run on a schedule.
- Phase 10: Staff land on a dashboard showing how the business stands today.
- Phase 11: Visitors browse the public site from database content; Managers edit it.
- Phase 12: Visitors get a fair cookie choice and legal pages; Managers see privacy-respecting metrics.
- Phase 13: Visitors request quotes; staff work them in an inbox.
- Phase 14: The complete app is hardened and proven release-ready.
- Phases 15-17: Legacy discovery and mapping, test-driven import with 100% reconciliation, and the owner-attended cutover.

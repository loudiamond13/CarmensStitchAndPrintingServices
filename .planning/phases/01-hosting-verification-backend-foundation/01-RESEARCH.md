# Phase 1: Hosting Verification & Backend Foundation - Research

**Researched:** 2026-10-07
**Domain:** .NET 10 onion Minimal API foundation (strict build, EF Core 10 on SQL Server 2025, platform contract, shared primitives, SQL test fixture) plus a SmarterASP.NET hosting verification record
**Confidence:** HIGH for package versions, dates, licenses and the EF/analyzer behaviours proven in a scratch spike. MEDIUM for framework behaviour taken from official docs and source. LOW for SmarterASP.NET host facts, which FND-13 exists to verify.

> **Cool-down cutoff used throughout:** today is 2026-10-07, so a version is "aged" (D-19) only if published on or before **2026-09-23**.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Project-wide rule (from this discussion)
- **D-00:** **No paid licenses, tools or services.** Every package, tool and service must be free. The only paid items are the SmarterASP.NET hosting and the domain the owner already pays for. Allowed licenses: MIT, Apache-2.0, BSD, ISC, plus the S-5 exceptions below. This feeds Phase 3's C-27: on a private repo, use free substitutes for CodeQL and dependency-review (NuGetAudit as error, `npm audit`, license gates, gitleaks), or make the repo public. Never use GitHub Code Security.

#### Locale & business clock (OD-1, OD-2)
- **D-01:** Currency and locale are PHP `₱` with `en-PH` formatting, for example `₱12,450.00` with a U+2212 minus and dates like `Oct 6, 2026`. Single currency, no conversion.
- **D-02:** The business time zone is `Asia/Manila`, stored in SiteSettings and **Manager-editable** later. The editing UI belongs to a later site-content phase. Phase 1 only builds the entity, seed and cached read port. `IBusinessCalendar` must read the zone from SiteSettings through the cached port, with an `Asia/Manila` fallback chain (IANA → Windows id) when the stored value can't be resolved. Cache invalidation on edit must be designed now. — **Reversibility:** costly. A later zone change shifts every "today", month and year bucket, so reports would re-bucket historical data.
- **D-03:** "Year" means the calendar year, Jan–Dec. There is no fiscal-year setting.
- **D-04:** The SiteSettings seed uses the real business name "Carmen's Stitch & Printing Services". Contact fields (email, phone, address, Facebook) keep the UI-spec placeholders, such as `[hello@yourdomain.ph]`, until the owner supplies real values.

#### Local & test databases (C-20, C-28, C-29, C-30)
- **D-05:** Use a dedicated LocalDB instance named **`CSPS`** (`sqllocaldb create CSPS`), never the shared `MSSQLLocalDB` that TheBETSLLC uses. Dev DB: `(localdb)\CSPS` / `CSPS_Dev`. E2E DB: `CSPS_E2E`. Test DBs: `CSPS_Test_<guid>`. Cleanup code may drop only names matching `^CSPS_Test_[0-9a-f-]{36}$`. Named pipes only, so no ports.
- **D-06:** The legacy `.bak` will be restored as **`CSPS_Legacy_Restore`** (in the legacy-discovery phase), never over `CSPS_Dev`. The CLAUDE.md line is amended accordingly.
- **D-07:** The test fixture selects its backend from `CSPS_TEST_SQL=localdb|container`, set per process only. Local runs always use LocalDB, and Docker/Testcontainers never run locally. CI (ubuntu) uses Testcontainers with an explicit `mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04` image. No exception to the 49152–65535 rule is needed. Integration tests run in parallel with a database per class or collection, reset with Respawn.
- **D-08:** The dev seed is an **explicit command** in a `tools/` project, for example `dotnet run --project tools/Csps.DevSeed -- --reset`. It refuses any database not named `CSPS_Dev` or `CSPS_E2E`. Nothing seeds or migrates at app startup.

#### Hosting record & email (C-45, FND-13, OD-12, C-31)
- **D-09:** The owner has SmarterASP.NET access. Phase 1 delivers a **verification checklist**: SQL queries (`@@VERSION`, compat level, collation, DB size/quota) plus a minimal probe (runtime patch, in-process hosting, `X-Forwarded-For` and client-IP topology). The owner runs it and pastes the results into the hosting record. Missing facts are marked unverified, never guessed.
- **D-10:** The hosting plan is **SmarterASP.NET Basic**: 1 database, a 256 MB app pool and no host scheduler. Consequences:
  - keep memory use small, with a small HybridCache and no heavy in-process work
  - scheduled jobs must run from a GitHub Actions cron calling a secret-protected endpoint
  - CI and integration tests never touch the hosted DB
- **D-11:** **No staging environment.** Production deploys go behind a manual approval gate, after CI tests pass against containers. This **amends OPS-04** (Phase 3): drop the staging site and the staging smoke E2E, or run the smoke check against production after deploy. — **Reversibility:** reversible. Upgrading the plan later re-enables staging.
- **D-12:** The system sender uses the **domain of the current legacy production site**, which the owner controls. The exact domain name is still to come from the owner. Constraints:
  - Add SPF/DKIM/DMARC by **merging** with any existing records. The legacy site may already send mail, so never replace an existing SPF record.
  - DNS edits must not disturb the live legacy site (Prime Directive 1).
  - The SPF/DKIM/DMARC pass-to-Gmail check is the last item in the hosting record.
- **D-13:** **No JSON columns anywhere**, only relational columns. Pin `UseCompatibilityLevel(160)` provisionally, then re-pin to the host's verified level once FND-13 reports it. This is safe because no JSON columns exist. The idempotent script must apply twice at the pinned level.

#### Security & tooling (OD-13, C-32, S-3, S-4, S-5, S-10, S-11)
- **D-14:** OpenAPI uses the built-in `Microsoft.AspNetCore.OpenApi`, with **Scalar** (`Scalar.AspNetCore`, MIT) as the viewer. Both `/openapi/v1.json` and `/scalar` are mapped **only in Development**. Production exposes neither, so Scalar's inline bootstrap never meets the strict production CSP. The researcher must confirm Scalar serves its assets locally (no CDN) and check whether Development needs a CSP carve-out for `/scalar`. Record Scalar's license and legitimacy check.
- **D-15:** Data Protection keys persist to the DB with `PersistKeysToDbContext` and `SetApplicationName("Csps")`. They are **encrypted with `ProtectKeysWithCertificate`**, using a self-signed PFX supplied as a host secret: base64 PFX plus password in host app settings, never in git. A script generates a dev PFX and stores it in `dotnet user-secrets`. Production and Development use the same code path, and no "No XML encryptor configured" warning appears. Document certificate rotation. — **Reversibility:** costly. Losing the cert, or rotating it without keeping the old one, makes the existing keys unreadable and signs everyone out.
- **D-16:** Architecture tests use **TngTech.ArchUnitNET 0.13.4 + ArchUnitNET.xUnitV3** (Apache-2.0), replacing the PRD's NetArchTest pin for maintenance reasons (CWE-1104). Record it as a PRD substitution.
- **D-17:** .NET coverage uses **coverlet.MTP** (MIT) with **ReportGenerator** (Apache-2.0) enforcing per-assembly thresholds: Domain 100% line and branch, Application ≥ 95%. Never use `coverlet.collector` or `Microsoft.Testing.Extensions.CodeCoverage`, which has a proprietary license.
- **D-18:** License exceptions are approved:
  - MPL-2.0 for axe-core and its wrappers, dev/test only
  - OFL-1.1 for the @fontsource fonts, which ship
  - an allow-list-with-review policy for transitive dev-only licenses

  Production dependencies stay strict.
- **D-19:** **Release cool-down is 14 days.** Adopt only package versions at least 14 days old, and set Dependabot `cooldown` to 14 days. Record "aged" or "accepted with reason" per package. Security fixes may skip the cool-down with a recorded reason. Many versions in STACK.md (dated 2026-10-06) are younger than 14 days, so the researcher must choose the newest version that is at least 14 days old.
- **D-20:** Remove `Microsoft.AspNetCore.SpaProxy` and the whole VS scaffold (`CarmensStitchAndPrintingServices.Server`, `.client`, `.esproj`). The Phase 2 Vite dev server proxies `/api` with hard-coded ports, never `ASPNETCORE_HTTPS_PORT`. Keep the API ports 5115/7028 in `launchSettings.json`, minus the SpaProxy env var.

#### Logging (FND-07)
- **D-21:** Production logs are Serilog compact JSON files in `{contentRoot}/logs` (outside `wwwroot`), with:
  - a daily roll
  - `retainedFileCountLimit: 30`
  - a 10 MB per-file cap, `shared: true` and `flushToDiskInterval`
  - the `logs` folder excluded from Web Deploy sync

  There is no DB sink, and logs mask passwords, codes, tokens and secrets.
- **D-22:** No error alerting in Phase 1, only logging. The decision is deferred.

#### Health (FND-06)
- **D-23:** `/health` is **anonymous and public, with a minimal body**: overall status plus per-check name and status (liveness, DB reachable, time-zone resolvable). It never includes versions, connection strings, exception text or timings that reveal internals. Keep it cheap. There is no uptime monitor; the owner checks manually.

#### Audit log (FND-10)
- **D-24:** The IP is stored **truncated**: IPv4 to /24 (for example `203.177.12.0`) and IPv6 to /48 (RA 10173 data minimization). The user-agent is stored as its family only.
- **D-25:** Retention is **2 years**. Phase 1 builds the append-only table and blocks UPDATE and DELETE at the DB level. The purge job, a short idempotent cron-triggered endpoint, comes in the hardening phase. Because shared hosting probably gives one `db_owner` login, `DENY` permissions likely won't stop the app user. The researcher should verify that a trigger-based block (INSTEAD OF / AFTER UPDATE, DELETE → THROW) works there, and design how the future purge legitimately bypasses it. — **Reversibility:** one-way. Once audit rows exist, weakening append-only guarantees undermines their evidentiary value.

#### Errors (FND-05)
- **D-26:** API error titles and details are in **plain English** (en-PH), short and human, consistent with the UI-spec copy, for example "This order was changed by someone else."
- **D-27:** A production 500 returns a generic message plus the `traceId` as a reference, such as "Something went wrong. Reference: <traceId>". There is never a stack trace or exception text outside Development.

### Claude's Discretion
- The correlation-id header name and propagation (W3C `traceparent` vs `X-Correlation-Id`). Default to the Activity/W3C trace id surfaced as `traceId`.
- The exact `/health` JSON shape within D-23's limits.
- SiteSettings cache invalidation (HybridCache tags) and the shape of the business-calendar API.
- The project and test-project names within PRD §3.1.

### Deferred Ideas (OUT OF SCOPE)
- Error alerting (for example a throttled email on unhandled exceptions). Revisit in hardening, after SMTP exists (Phase 4).
- An uptime monitor. The owner declined for now, but it can be added free later (for example the UptimeRobot free tier).
- The audit-log purge job (2-year retention). Hardening phase, together with OD-10.
- The SiteSettings editing UI, including a Manager-editable time zone. Later site-content phase.
- Staging environment: re-enable if the hosting plan is upgraded from Basic (affects OPS-04, Phase 3).
- The exact sender domain name and SPF/DKIM/DMARC records. The owner supplies the legacy site domain; the checks finish at the end of FND-13 or before Phase 4.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Full schema on an empty DB from `dotnet ef database update` alone, no `.bak` | Pattern 6 (EF context, `HasData` singleton), Pattern 12 (migration tests), LocalDB setup script (Environment Availability) |
| FND-02 | `Csps.slnx` with 4 `src/` projects, test projects, `tools/`; scaffold removed; ports kept | Recommended Project Structure, Runtime State Inventory, Pattern 1 |
| FND-03 | Architecture tests fail the build on forbidden layer/package references | Pattern 13 (ArchUnitNET 0.13.4 + xUnitV3 adapter, verified namespace), dependency registry test |
| FND-04 | Dev seed (incremental; grows each phase) | Pattern 14 (guarded `tools/Csps.DevSeed`), Open Question 3 |
| FND-05 | RFC 9457 ProblemDetails with `traceId` + field `errors`; `/api/*` 404 is ProblemDetails | Pattern 3 (verified `DefaultProblemDetailsWriter` traceId + Accept behaviour) |
| FND-06 | `/health`: liveness, DB, time-zone, no internals | Pattern 10 |
| FND-07 | Serilog, correlation id, masking (CWE-532/117) | Pattern 5 (Sinks.File 7.0.0 options verified) |
| FND-08 | `IBusinessCalendar` over `TimeProvider`, Asia/Manila fallback; no `DateTime.Now` | Pattern 8 (zone resolution verified on this machine), BannedApiAnalyzers 5.6.0 (Roslyn 4.12 reference verified compatible with SDK Roslyn 5.9) |
| FND-09 | SiteSettings entity + seed + cached read port | Pattern 7 (HybridCache tags, verified docs) |
| FND-10 | Append-only AuditLog, `IAuditTrail`, DB-level UPDATE/DELETE rejection | Pattern 9 (trigger + `UseSqlOutputClause(false)` verified in spike; TRUNCATE gap cited) |
| FND-11 | LocalDB locally / Testcontainers in CI, Respawn, parallel isolation | Pattern 11 (Respawn uses DELETE, verified from source) |
| FND-12 | Migrations apply to empty + previous; idempotent script twice at host compat level | Pattern 12 (idempotent script shape verified in spike) |
| FND-13 | Hosting verification record | Pattern 15 (owner checklist + probe), Open Question 1 (Basic plan's single DB) |
| QUAL-01 | Warnings as errors, analyzers, code style, NuGet audit, CPM no floating, `dotnet format` | Pattern 1 (NU1011 and CA1861/editorconfig behaviour verified in spike) |
| QUAL-03 | Coverage gates Domain 100% / Application ≥ 95% | Pattern 16 (coverlet.MTP 10.0.1 + ReportGenerator thresholds) |
| QUAL-06 | Purpose, license, legitimacy, cool-down per package | Package Legitimacy Audit, dependency registry test |
| SEC-01 | Strict CSP/HSTS/nosniff/Referrer/Permissions/COOP, server headers removed | Pattern 4 (Scalar nonce support verified in package) |
| SEC-02 | Fallback deny + named policies + discovery-driven matrix test | Pattern 2 |
| SEC-04 | Data Protection keys in DB, encrypted by certificate | Pattern 9b (decryption-certificate registration verified in source) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

From `C:\Work\CarmensStitchAndPrintingServices\CLAUDE.md` (read this session) and `.claude/CLAUDE.md`. The planner must verify every plan against these.

| # | Directive | Source |
|---|-----------|--------|
| PC-1 | Ports: "Vite 5180 (`strictPort: true`), API 5115 http / 7028 https, Playwright E2E host 5199". Never 5173, 5023, 5099. Avoid 49152–65535. | `CLAUDE.md:7-9` |
| PC-2 | "use the dedicated instance `(localdb)\CSPS` (`sqllocaldb create CSPS`), never the shared `MSSQLLocalDB`. Databases use the `CSPS_` prefix (`CSPS_Dev`, `CSPS_E2E`, `CSPS_Test_<guid>`, `CSPS_Legacy_Restore`). Automated cleanup may drop only `^CSPS_Test_[0-9a-f-]{36}$`." | `CLAUDE.md:10` |
| PC-3 | "No Docker or Testcontainers locally. Tests pick their backend from `CSPS_TEST_SQL=localdb|container`, set per process only." | `CLAUDE.md:11` |
| PC-4 | Run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` before a dev server, Playwright or a full test run. Never kill another project's processes. | `CLAUDE.md:12-14` |
| PC-5 | Never set `ASPNETCORE_URLS`, `ASPNETCORE_HTTPS_PORT`, `DEV_SERVER_PORT`, `ASPNETCORE_ENVIRONMENT` or any other variable at User/Machine level. | `CLAUDE.md:15` |
| PC-6 | `_local/` holds a production backup: never commit/upload/deploy; restore only in the legacy-discovery phase. **Phase 1 must not read `_local/`.** | `CLAUDE.md:16` |
| PC-7 | Free only; explain license terms in plain words to the owner. | `CLAUDE.md:21` |
| PC-8 | Forbidden: axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit, `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, SpaProxy, Serilog DB sinks. | `.claude/CLAUDE.md` Constraints |
| PC-9 | New dependencies need purpose, license, maintenance status and legitimacy recorded in RESEARCH.md; 14-day cool-down. | `.claude/CLAUDE.md` Constraints |
| PC-10 | Onion Domain ← Application ← Infrastructure ← Server enforced by ArchUnitNET; no mediator; one handler per use case; manual mapping; `Result<T>` → RFC 9457. | `.claude/CLAUDE.md` Architecture |
| PC-11 | `rowversion` per aggregate (409); UTC storage + `TimeProvider` / `IBusinessCalendar`; never `DateTime.Now`; money `decimal(18,2)` server-side. | `.claude/CLAUDE.md` Architecture |
| PC-12 | Schema only from EF migrations; works on empty DB; no JSON columns; drops/renames are one-way doors; production gets reviewed idempotent scripts; never `Database.Migrate()` at startup. | `.claude/CLAUDE.md` Schema |
| PC-13 | TDD; zero warnings everywhere; coverage Domain 100%, Application ≥ 95%; authorization-matrix tests for every endpoint × {anonymous, Admin, Manager}. | `.claude/CLAUDE.md` Quality |
| PC-14 | Strict CSP (no `unsafe-inline`/`unsafe-eval`), default-deny authorization, append-only audit, no secrets/data in git; CWE Top 25 per phase. | `.claude/CLAUDE.md` Security |
| PC-15 | Workflow: `/gsd-plan-phase N --tdd`; `/gsd-secure-phase N` before ship. | `.claude/CLAUDE.md` Workflow |

## Summary

Phase 1 is a greenfield backend foundation on a machine that already has exactly the right toolchain: .NET SDK 10.0.401, ASP.NET Core runtime 10.0.12 and LocalDB 17.0.4025.3 (SQL Server 2025) are installed [VERIFIED: local probe]. Only the dedicated `CSPS` LocalDB instance and the local `dotnet` tools are missing. Every Phase 1 package has a version at least 14 days old. The newest builds of three packages are too young and are pinned to their predecessors: **coverlet.MTP 10.0.1** (not 10.1.0), **Scalar.AspNetCore 2.17.8** (not 2.17.14) and the transitive Microsoft.Testing.Platform (resolved through xUnit's floor, not 2.5.0) [VERIFIED: NuGet registration API].

The research found five things that would otherwise break the build or a test:
1. **Wrong glob in `.editorconfig`.** A section like `[**/Migrations/*.cs] generated_code = true` does not suppress CA1861 in EF migrations, and the build fails. A root-relative glob works.
2. **Respawn and the audit trigger.** Respawn resets tables with `DELETE`, which the append-only trigger rejects.
3. **EF and triggers.** EF Core's default `OUTPUT`-clause saves fail on tables with triggers, so the AuditLog table needs `UseSqlOutputClause(false)`.
4. **TRUNCATE skips triggers.** `TRUNCATE TABLE` bypasses triggers and is allowed for `db_owner`.
5. **ProblemDetails and `Accept`.** The default ProblemDetails writer falls back to plain text when the client sends `Accept: text/html`.

Each has a prescribed fix below. Scalar 2.17.8 serves its JS bundle from embedded resources. It loads fonts from a CDN by default (`DisableDefaultFonts()` turns that off) and supports per-request CSP nonces (`WithNonce()`). So the Development-only `/scalar` page needs a narrow CSP carve-out, never a global one.

The largest unresolved risk isn't technical. The owner's SmarterASP.NET **Basic** plan allows exactly **1 MSSQL database** [CITED: smarterasp.net/hosting_plans], and the live legacy database (`csptailoringdb`) already runs on SmarterASP.NET (PROJECT.md:81). If both are on the same account, there's no database slot for a probe or for CSPS until cutover. The FND-13 checklist must then be limited to read-only facts plus a probe app deployed to a separate site, all approved by the owner (Prime Directive 1). This is Open Question 1, and the hosting plan should be a separate, owner-gated plan that runs in parallel.

**Primary recommendation:** Build a walking skeleton first: strict build → `SiteSettings` + `CspsDbContext` + initial migration → LocalDB `SqlFixture` → anonymous `/health` that reads the zone through the cached SiteSettings port into `IBusinessCalendar`. Then layer on ProblemDetails, headers, logging, default-deny, audit log and Data Protection, each driven by a failing integration test. The hosting checklist runs as an independent, owner-gated plan.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Strict build, CPM, analyzers, banned APIs | Build tooling (repo root props) | Architecture tests | Enforced at compile/restore time; tests re-check config files |
| Layer rules, forbidden packages, dependency registry | Architecture tests | — | ArchUnitNET over loaded assemblies + file scans |
| ProblemDetails, `/api` 404, status pages, 500 text | API / Backend (Csps.Server) | Application (`Result`/`Error` types) | HTTP concern; Application only returns typed errors |
| Security headers / CSP / HSTS | API / Backend (Server middleware) | IIS `web.config` (server header removal) | Must cover every response incl. errors |
| Authentication (JWT validation) + default-deny policies | API / Backend (Server) | Application (policy-name constants, roles) | Transport/auth wiring is Server; names are shared constants |
| Structured logging, correlation, masking | API / Backend (Server composition) | Infrastructure (no logging sinks) | Serilog configured once in composition root |
| Business calendar math | Domain (pure `BusinessClock`, zone resolver) | Application port, Infrastructure impl | Pure math is BCL-only, 100% testable; zone read needs DB/cache |
| SiteSettings entity | Domain | Infrastructure (EF config, `HasData`) | Aggregate in Domain; mapping and seed in Infrastructure |
| SiteSettings cached read + invalidation | Infrastructure (HybridCache adapter) | Application (ports) | Cache is an infrastructure concern behind a port |
| Audit entry + IP/UA reduction | Domain (value logic) | Infrastructure (`AuditTrail`, trigger), Server (`IRequestContext` from HttpContext) | IP/UA come from HTTP, persistence from EF, rules are pure |
| Append-only enforcement | Database / Storage (trigger + FK truncate guard) | Infrastructure (EF `UseSqlOutputClause(false)`) | Must hold even when app code is wrong |
| Data Protection key ring | Database / Storage (`DataProtectionKeys` table) | Infrastructure (DP registration), host secrets | Keys persisted in DB, cert from host config |
| Health checks | API / Backend (endpoint, response writer) | Infrastructure (DB and zone checks) | Server owns HTTP shape; checks need DB/port access |
| SQL test fixture | Test infrastructure (`Csps.Testing`) | — | LocalDB / container switch per process |
| Dev seed | `tools/` console | Infrastructure (seeding steps) | Explicit, guarded, never at startup |
| Hosting facts (FND-13) | Owner + host control panel | `tools/Csps.HostProbe` (throwaway) | Facts only the host can report |

## Standard Stack

All versions below are pinned exactly in `Directory.Packages.props`. Dates are from the NuGet registration API, queried 2026-10-07 [VERIFIED: api.nuget.org registration5-gz-semver2].

### Core (runtime, ships to production)

| Library | Version | Published | License | Purpose | Layer |
|---------|---------|-----------|---------|---------|-------|
| Microsoft.EntityFrameworkCore.SqlServer | 10.0.12 | 2026-09-08 | MIT | ORM, migrations runtime | Infrastructure |
| Microsoft.AspNetCore.DataProtection.EntityFrameworkCore | 10.0.12 | 2026-09-08 | MIT | `PersistKeysToDbContext` | Infrastructure |
| Microsoft.Extensions.Caching.Hybrid | 10.10.0 | 2026-09-09 | MIT | Cached SiteSettings port with tag invalidation | Infrastructure |
| Microsoft.AspNetCore.Authentication.JwtBearer | 10.0.12 | 2026-09-08 | MIT | Bearer **validation** only (issuance is Phase 4); needed so the fallback policy can challenge and the matrix can test Admin/Manager | Server |
| Serilog.AspNetCore | 10.0.0 | 2025-11-28 | Apache-2.0 | Request logging, `AddSerilog`, bundles Sinks.File 7.0.0 + Formatting.Compact 3.0.0 | Server |
| Serilog.Sinks.File | 7.0.0 | 2025-04-28 | Apache-2.0 | Pinned explicitly (transitive anyway) for the file options | Server |
| Microsoft.AspNetCore.OpenApi | 10.0.12 | 2026-09-08 | MIT | Built-in OpenAPI 3.1 doc, **Development only** (D-14) | Server |
| Scalar.AspNetCore | **2.17.8** | 2026-09-22 | MIT | API viewer, **Development only** (D-14). Latest 2.17.14 (2026-10-06) is too new | Server |

### Build / design-time

| Library | Version | Published | License | Purpose |
|---------|---------|-----------|---------|---------|
| Microsoft.EntityFrameworkCore.Design | 10.0.12 | 2026-09-08 | MIT | Migrations (PrivateAssets=all, Infrastructure) |
| Microsoft.CodeAnalysis.BannedApiAnalyzers | 5.6.0 | 2026-07-02 | MIT | RS0030: ban `DateTime.Now/UtcNow/Today`, `DateTimeOffset.Now/UtcNow`, `System.Random`. As a `GlobalPackageReference` |

**BannedApiAnalyzers compatibility:** the analyzer DLL references `Microsoft.CodeAnalysis 4.12.0.0`, and SDK 10.0.401 ships `Microsoft.CodeAnalysis 5.9.0.0`, so no CS9057 "analyzer references newer compiler" warning occurs [VERIFIED: reflection over both assemblies this session].

### Tests

| Library | Version | Published | License | Purpose |
|---------|---------|-----------|---------|---------|
| xunit.v3 | 4.0.1 | 2026-09-12 | Apache-2.0 | Test framework (MTP v2 only). Requires `Microsoft.Testing.Platform >= 2.4.0` |
| xunit.runner.visualstudio | 4.0.0 | 2026-08-15 | Apache-2.0 | Optional back-compat (xUnit recommends keeping it) |
| Microsoft.NET.Test.Sdk | 18.10.1 | 2026-09-15 | MIT | Optional back-compat (same recommendation) |
| Shouldly | 4.3.0 | 2025-01-23 | BSD-3-Clause | Assertions (PRD pin) |
| NSubstitute | 6.2.0 | 2026-08-11 | BSD-3-Clause | Port fakes in Application tests |
| Testcontainers.MsSql | 4.15.0 | 2026-09-06 | MIT | CI-only SQL 2025 container (D-07) |
| Respawn | 7.0.0 | 2025-11-30 | Apache-2.0 | DB reset between tests |
| TngTech.ArchUnitNET | 0.13.4 | 2026-08-20 | Apache-2.0 | Architecture rules (D-16) |
| TngTech.ArchUnitNET.xUnitV3 | 0.13.4 | 2026-08-20 | Apache-2.0 | xUnit v3 adapter, namespace `ArchUnitNET.xUnitV3` |
| coverlet.MTP | **10.0.1** | 2026-05-18 | MIT | Coverage under MTP (D-17). 10.1.0 (2026-09-27) is too new. Needs MTP ≥ 2.2.2 |
| Microsoft.AspNetCore.Mvc.Testing | 10.0.12 | 2026-09-08 | MIT | `WebApplicationFactory<Program>` |
| Microsoft.Extensions.TimeProvider.Testing | 10.10.0 | 2026-09-09 | MIT | `FakeTimeProvider` |

### Local dotnet tools (`.config/dotnet-tools.json`)

| Tool | Version | Published | License | Purpose |
|------|---------|-----------|---------|---------|
| dotnet-ef | 10.0.12 | 2026-09-08 | MIT | `migrations add`, `database update`, `migrations script --idempotent` |
| dotnet-reportgenerator-globaltool | 5.5.11 | 2026-07-27 | Apache-2.0 | Per-assembly coverage thresholds (D-17). The only PRO-license mention in its settings docs is `settings:rawMode`; line/branch thresholds have none [CITED: github.com/danielpalme/ReportGenerator/wiki/Settings] |
| nuget-license | 4.0.18 | 2026-09-21 | Apache-2.0 | License report → THIRD-PARTY-NOTICES (QUAL-06; CI wiring in Phase 3) |

### Deliberately NOT added in Phase 1
- **FluentValidation**: Phase 1 has no command validation. Add it with the first validated use case. The arch rule still allows it in Application.
- **Microsoft.AspNetCore.Identity.EntityFrameworkCore**: Phase 4. Adding Identity tables later is an additive migration.
- **Microsoft.Extensions.Diagnostics.Testing (FakeLogger)**: not needed. Serilog tests use an in-DI `ILogEventSink` collector, see Pattern 5.
- **Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore** (`AddDbContextCheck`): avoid an extra package. A 10-line `IHealthCheck` calling `Database.CanConnectAsync` is enough.
- **NetEscapades.AspNetCore.SecurityHeaders**: not needed. Headers are a constant set in one middleware.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JwtBearer validation in Phase 1 | A custom test-only auth handler | Rejected: ARCHITECTURE Pattern 4 wants real JWTs, and the fallback policy needs a registered challenge scheme or it throws at runtime |
| ReportGenerator thresholds | ~40-line Cobertura parser | Keep ReportGenerator (locked D-17). The parser is the fallback if a PRO restriction ever appears |
| Serilog `ReadFrom.Configuration` file path | Code-built path from `ContentRootPath` | Use code. Relative Serilog paths resolve against the **current directory**, not the content root [ASSUMED], and D-21 requires `{contentRoot}/logs` |
| AFTER trigger | INSTEAD OF trigger | AFTER + `THROW` is simpler: the statement and transaction roll back, and no nested re-delete is needed |

**Installation (Directory.Packages.props, central, exact):**
```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
    <CentralPackageTransitivePinningEnabled>true</CentralPackageTransitivePinningEnabled>
  </PropertyGroup>
  <ItemGroup>
    <GlobalPackageReference Include="Microsoft.CodeAnalysis.BannedApiAnalyzers" Version="5.6.0" />
  </ItemGroup>
  <ItemGroup>
    <PackageVersion Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.12" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.12" />
    <PackageVersion Include="Microsoft.AspNetCore.DataProtection.EntityFrameworkCore" Version="10.0.12" />
    <PackageVersion Include="Microsoft.Extensions.Caching.Hybrid" Version="10.10.0" />
    <PackageVersion Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="10.0.12" />
    <PackageVersion Include="Microsoft.AspNetCore.OpenApi" Version="10.0.12" />
    <PackageVersion Include="Scalar.AspNetCore" Version="2.17.8" />
    <PackageVersion Include="Serilog.AspNetCore" Version="10.0.0" />
    <PackageVersion Include="Serilog.Sinks.File" Version="7.0.0" />
    <!-- tests -->
    <PackageVersion Include="xunit.v3" Version="4.0.1" />
    <PackageVersion Include="xunit.runner.visualstudio" Version="4.0.0" />
    <PackageVersion Include="Microsoft.NET.Test.Sdk" Version="18.10.1" />
    <PackageVersion Include="Shouldly" Version="4.3.0" />
    <PackageVersion Include="NSubstitute" Version="6.2.0" />
    <PackageVersion Include="Testcontainers.MsSql" Version="4.15.0" />
    <PackageVersion Include="Respawn" Version="7.0.0" />
    <PackageVersion Include="TngTech.ArchUnitNET" Version="0.13.4" />
    <PackageVersion Include="TngTech.ArchUnitNET.xUnitV3" Version="0.13.4" />
    <PackageVersion Include="coverlet.MTP" Version="10.0.1" />
    <PackageVersion Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.12" />
    <PackageVersion Include="Microsoft.Extensions.TimeProvider.Testing" Version="10.10.0" />
  </ItemGroup>
</Project>
```
`global.json`:
```json
{
  "sdk": { "version": "10.0.401", "rollForward": "latestPatch" },
  "test": { "runner": "Microsoft.Testing.Platform" }
}
```
The `test.runner` key is from the xUnit MTP guide [CITED: xunit.net/docs/getting-started/v3/microsoft-testing-platform].

**Version verification:** every row above was read from `https://api.nuget.org/v3/registration5-gz-semver2/{id}/index.json` with the 2026-09-23 cutoff applied (script in scratch, reproducible).

## Package Legitimacy Audit

> The GSD seam `package-legitimacy check` supports only `npm|pypi|crates`; it returned a usage error for `--ecosystem nuget` this session. NuGet legitimacy below is a **manual assessment** from NuGet search API signals: total downloads, the reserved-prefix "verified" flag, owners and repo. No package showed a slop signal.

| Package | Registry | Age (first listed) | Downloads (total) | Owner / prefix | Source repo | Verdict | Cool-down | Disposition |
|---------|----------|--------------------|-------------------|----------------|-------------|---------|-----------|-------------|
| Microsoft.EntityFrameworkCore.SqlServer 10.0.12 | NuGet | 2016 (1.0.0) | 1,035M | Microsoft, verified prefix | github.com/dotnet/efcore | OK | aged (29 d) | Approved |
| Microsoft.EntityFrameworkCore.Design 10.0.12 | NuGet | 2016 | 1,075M | Microsoft, verified | dotnet/efcore | OK | aged (29 d) | Approved |
| Microsoft.AspNetCore.DataProtection.EntityFrameworkCore 10.0.12 | NuGet | 2.2.0 | 59.8M | Microsoft, verified | dotnet/aspnetcore | OK | aged (29 d) | Approved |
| Microsoft.Extensions.Caching.Hybrid 10.10.0 | NuGet | 9.3.0 | 34.4M | Microsoft, verified | dotnet/extensions | OK | aged (28 d) | Approved |
| Microsoft.AspNetCore.Authentication.JwtBearer 10.0.12 | NuGet | 1.0.0 | 1,363M | Microsoft, verified | dotnet/aspnetcore | OK | aged (29 d) | Approved |
| Microsoft.AspNetCore.OpenApi 10.0.12 | NuGet | 7.0.0 | 246M | Microsoft, verified | dotnet/aspnetcore | OK | aged (29 d) | Approved (already in scaffold) |
| Scalar.AspNetCore 2.17.8 | NuGet | 1.0.1, 329 versions | 48.1M | Scalar (marclave), verified prefix | github.com/scalar/scalar (nuspec commit cba18455) | OK | aged (15 d) | Approved, Development only |
| Serilog.AspNetCore 10.0.0 | NuGet | 2.0.0 | 817M | serilog, verified | serilog/serilog-aspnetcore | OK | aged | Approved |
| Serilog.Sinks.File 7.0.0 | NuGet | 2.0.0 | 1,240M | serilog, verified | serilog/serilog-sinks-file | OK | aged | Approved |
| Microsoft.CodeAnalysis.BannedApiAnalyzers 5.6.0 | NuGet | 2.9.0 | 49.1M | Microsoft/RoslynTeam, verified | dotnet/roslyn | OK | aged (97 d) | Approved (build-only) |
| xunit.v3 4.0.1 | NuGet | 1.0.0 | 50.1M | xunit, verified | xunit/xunit | OK | aged (25 d) | Approved (test) |
| xunit.runner.visualstudio 4.0.0 | NuGet | 2.0.0 | 1,090M | xunit, verified | xunit | OK | aged | Approved (test, optional) |
| Microsoft.NET.Test.Sdk 18.10.1 | NuGet | 15.0.0 | 1,896M | Microsoft, verified | microsoft/vstest | OK | aged (22 d) | Approved (test, optional) |
| Shouldly 4.3.0 | NuGet | 1.0.1 | 129M | Shouldly (no prefix) | shouldly/shouldly | OK | aged | Approved (test) |
| NSubstitute 6.2.0 | NuGet | 1.0.0 | 312M | NSubstitute, verified | nsubstitute/NSubstitute | OK | aged | Approved (test) |
| Testcontainers.MsSql 4.15.0 | NuGet | 3.0.0 | 36.5M | Testcontainers, verified | testcontainers/testcontainers-dotnet | OK | aged (31 d) | Approved (test, CI-only use) |
| Respawn 7.0.0 | NuGet | 0.1.0 | 34.4M | jbogard (no prefix) | github.com/jbogard/Respawn | OK | aged | Approved (test) |
| TngTech.ArchUnitNET 0.13.4 | NuGet | 0.1.0, 55 versions | 9.4M | fgather (TNG maintainer) | github.com/TNG/ArchUnitNET | OK | aged (48 d) | Approved (test) |
| TngTech.ArchUnitNET.xUnitV3 0.13.4 | NuGet | 0.11.3 | 0.8M | fgather | TNG/ArchUnitNET | OK (lower downloads, normal for a new adapter of an established package) | aged (48 d) | Approved (test) |
| coverlet.MTP 10.0.1 | NuGet | 8.0.0, 5 versions | 1.0M | coverlet (daveMueller), verified prefix | github.com/coverlet-coverage/coverlet | OK | aged (142 d) | Approved (test) |
| Microsoft.AspNetCore.Mvc.Testing 10.0.12 | NuGet | 2.1.0 | 402M | Microsoft, verified | dotnet/aspnetcore | OK | aged | Approved (test) |
| Microsoft.Extensions.TimeProvider.Testing 10.10.0 | NuGet | 8.0.0 | 47.1M | Microsoft, verified | dotnet/extensions | OK | aged | Approved (test) |
| dotnet-ef 10.0.12 | NuGet tool | 2.1.0 | 129M | Microsoft, verified | dotnet/efcore | OK | aged | Approved (tool) |
| dotnet-reportgenerator-globaltool 5.5.11 | NuGet tool | 4.0.0 | 120M | danielpalme | danielpalme/ReportGenerator | OK | aged (72 d) | Approved (tool) |
| nuget-license 4.0.18 | NuGet tool | 3.0.0 | 1.9M | sensslen | github.com/sensslen/nuget-license | OK | aged (16 d) | Approved (tool) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none. The seam couldn't evaluate NuGet. The planner should add one `checkpoint:human-verify` that shows the owner this table (plain-words license summary, PC-7) before the first `dotnet restore`.
**Notable transitive packages:** ArchUnitNET pulls Newtonsoft.Json ≥ 13.0.4 (MIT), JetBrains.Annotations (MIT), Mono.Cecil (MIT) and CycleDetection. The xUnitV3 adapter's netstandard2.0 group pulls `System.Net.Http 4.3.4` and `System.Text.RegularExpressions 4.3.1`, which are patched versions and pruned on net10.0. Testcontainers pulls Docker.DotNet.Enhanced, SSH.NET and SharpZipLib (test only). EF SqlServer 10.0.12 floors `Microsoft.Data.SqlClient` at 6.1.6 [VERIFIED: nuspec dependency groups]. `NuGetAuditMode=all` covers all of these.
**Runtime infrastructure (not packages):** SQL Server 2025 LocalDB / container images use the Microsoft EULA. They aren't redistributed, so record them as infrastructure.

## Architecture Patterns

### System Architecture Diagram

```
 HTTP request (browser / curl / test client)
        │
        ▼
 IIS in-process (prod) | Kestrel 5115/7028 (dev) | TestServer (tests)
        │
        ▼
 ┌──────────────────────────── Csps.Server (composition root) ────────────────────────────┐
 │ SecurityHeaders (OnStarting: CSP/HSTS/nosniff/...; /scalar dev-only nonce carve-out)    │
 │   → ExceptionHandler (500 → ProblemDetails "Something went wrong. Reference: <traceId>") │
 │   → StatusCodePages (empty 401/403/404/405 → ProblemDetails)                            │
 │   → Serilog request logging (TraceId = correlation id)                                  │
 │   → Routing → Authentication (JWT bearer validate) → Authorization (fallback = deny)    │
 │   → Endpoints:                                                                          │
 │        GET /health ───────────────► HealthChecks: self | database | time-zone           │
 │        GET /api/v1/site-settings (Staff policy) ─► ISiteSettingsReader                  │
 │        *   /api/{**path} (anon) ─► ProblemDetails 404                                   │
 │        /openapi/v1.json, /scalar  (Development only)                                    │
 └───────────────┬───────────────────────────────────────────┬────────────────────────────┘
                 │ ports (interfaces in Csps.Application)     │
                 ▼                                            ▼
   ISiteSettingsReader / ISiteSettingsCache        IBusinessCalendar        IAuditTrail ◄── IRequestContext
                 │                                     │                       │        (Server: HttpContext →
                 ▼                                     ▼                       ▼         IP, UA, user, traceId)
 ┌──────────────────────────── Csps.Infrastructure ─────────────────────────────────────┐
 │ HybridCache (L1 only, tag "site-settings") ──miss──► CspsDbContext (EF Core 10)       │
 │ BusinessCalendar = TimeProvider + resolved zone (Domain BusinessClock math)           │
 │ AuditTrail → AuditLog entity (UseSqlOutputClause(false))                              │
 │ DataProtection → DataProtectionKeys (cert-encrypted XML)                              │
 └───────────────────────────────────────┬──────────────────────────────────────────────┘
                                         ▼
               SQL Server 2025  ((localdb)\CSPS / container / host DB), compat level pinned 160
               Tables: __EFMigrationsHistory, SiteSettings(Id=1), AuditLog (+ trigger, truncate-guard FK),
                       DataProtectionKeys
 Out of band:  tools/Csps.DevSeed (guarded: CSPS_Dev|CSPS_E2E only) ──► same DB via migrations
               tools/Csps.HostProbe (owner deploys to a throwaway site, then deletes) ──► FND-13 record
```

### Recommended Project Structure
```
/Csps.slnx                        replaces CarmensStitchAndPrintingServices.slnx
/global.json                      SDK 10.0.401 latestPatch + MTP runner
/Directory.Build.props            strict settings (Pattern 1)
/Directory.Packages.props         central versions + GlobalPackageReference (BannedApiAnalyzers)
/BannedSymbols.txt                RS0030 list
/.editorconfig                    code style + migrations generated_code (root-relative glob!)
/.config/dotnet-tools.json        dotnet-ef, reportgenerator, nuget-license
/docs/dependencies.json           dependency registry (purpose, license, legitimacy, published, cool-down)
/src/Csps.Domain/                 Common/ (Result, Error), Time/ (BusinessClock, TimeZoneResolver),
                                  Content/ (SiteSettings), Auditing/ (AuditEntry, IpPrefix, UserAgentFamily)
/src/Csps.Application/            Ports/ (ISiteSettingsReader, ISiteSettingsCache, IBusinessCalendar,
                                  IAuditTrail, IRequestContext), Security/ (Policies, Roles), Auditing/ (AuditActions)
/src/Csps.Infrastructure/         DependencyInjection.cs, Persistence/ (CspsDbContext, Configurations/,
                                  Migrations/), Content/ (SiteSettingsReader), Time/ (BusinessCalendar),
                                  Auditing/ (AuditTrail), Health/ (DatabaseHealthCheck, TimeZoneHealthCheck),
                                  DataProtection/ (CertificateLoader), Seeding/ (DevSeeder + steps)
/src/Csps.Server/                 Program.cs, Composition/, Http/ (SecurityHeadersMiddleware, ProblemDetailsSetup,
                                  RequestContext), Endpoints/ (ApiRouting, SiteSettingsEndpoints, HealthEndpoint),
                                  Logging/ (SensitiveDataMasking), web.config, Properties/launchSettings.json
/tests/Csps.Domain.UnitTests/
/tests/Csps.Application.UnitTests/
/tests/Csps.Infrastructure.IntegrationTests/
/tests/Csps.Server.IntegrationTests/      authorization matrix lives here
/tests/Csps.ArchitectureTests/
/tests/Csps.Testing/                       shared: SqlFixture, Respawn wrapper, TestTokens, CspsApiFactory, CollectingSink
/tools/Csps.DevSeed/                       guarded seed CLI
/tools/Csps.DevSeed.Tests/                 (or fold guard tests into Infrastructure tests)
/tools/Csps.HostProbe/                     throwaway FND-13 probe app, never in the deploy artifact
/tools/scripts/                            Initialize-LocalDb.ps1, Initialize-DevSecrets.ps1 (PS 5.1-compatible),
                                           Remove-StaleTestDatabases.ps1, coverage-gate (see Pattern 16)
/.planning/HOSTING-RECORD.md               FND-13 record (no credentials, no connection strings)
```
"Five test projects" (FND-02) = the five `tests/Csps.*Tests` projects. `Csps.Testing` is a shared class library, not a test project.

### Pattern 1: Strict build (QUAL-01)
**What:** One `Directory.Build.props` for every project, plus a root `.editorconfig`.
```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>14.0</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <Deterministic>true</Deterministic>
    <ContinuousIntegrationBuild Condition="'$(CI)' == 'true'">true</ContinuousIntegrationBuild>
    <NuGetAudit>true</NuGetAudit>
    <NuGetAuditMode>all</NuGetAuditMode>
    <NuGetAuditLevel>low</NuGetAuditLevel>
    <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
    <RestoreLockedMode Condition="'$(CI)' == 'true'">true</RestoreLockedMode>
  </PropertyGroup>
  <PropertyGroup Condition="$(MSBuildProjectDirectory.Contains('\src\')) Or $(MSBuildProjectDirectory.Contains('/src/'))">
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
  </PropertyGroup>
  <ItemGroup>
    <AdditionalFiles Include="$(MSBuildThisFileDirectory)BannedSymbols.txt" />
  </ItemGroup>
</Project>
```
`BannedSymbols.txt` (RS0030):
```
P:System.DateTime.Now;Use TimeProvider / IBusinessCalendar
P:System.DateTime.UtcNow;Use TimeProvider
P:System.DateTime.Today;Use IBusinessCalendar
P:System.DateTimeOffset.Now;Use TimeProvider
P:System.DateTimeOffset.UtcNow;Use TimeProvider
T:System.Random;Use RandomNumberGenerator (CWE-330/338)
```
**Verified in a scratch spike this session**, with the same props, EF Core 10.0.12 and an initial migration:
- `[**/Migrations/*.cs] generated_code = true` did **not** take effect. The build failed with `Migrations\20261007120135_Initial.cs(44,26): error CA1861: Prefer 'static readonly' fields over constant array arguments…`.
- Changing the section to `[Migrations/**.cs]`, relative to the `.editorconfig` directory, made the build succeed. In this repo use the root-relative path **`[src/Csps.Infrastructure/Persistence/Migrations/**.cs]`** with `generated_code = true`.
- EF-generated migrations compiled clean with `GenerateDocumentationFile=true`. No CS1591 appeared.
- CA1515 did not fire under `latest-recommended`.

[VERIFIED: local spike output]
- Floating versions are blocked natively. A `PackageVersion Version="4.*"` produced `error NU1011: The following PackageVersion items cannot specify a floating version` [VERIFIED: local spike].
- `dotnet format --verify-no-changes` skips generated code unless `--include-generated` is passed [ASSUMED]. Confirm in the first plan's verification step.

### Pattern 2: Default-deny + discovery-driven authorization matrix (SEC-02)
```csharp
// Server/Composition/SecurityRegistration.cs
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer, ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(jwt.SigningKeyBytes),   // >= 32 bytes, from user-secrets/host
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            RoleClaimType = "role", NameClaimType = "sub",
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });
services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
    .AddPolicy(Policies.Staff,   p => p.RequireAuthenticatedUser().RequireRole(Roles.Admin, Roles.Manager))
    .AddPolicy(Policies.Manager, p => p.RequireAuthenticatedUser().RequireRole(Roles.Manager));
```
- The fallback policy needs a registered challenge scheme. Without one, an anonymous request throws "No authenticationScheme was specified…" instead of returning 401 [ASSUMED, standard ASP.NET Core behaviour]. That's why JwtBearer *validation* lands in Phase 1. Phase 4 adds issuance and the active-session requirement.
- **Discovery test:** resolve `EndpointDataSource` from `CspsApiFactory.Services` and enumerate every `RouteEndpoint`, not only `/api`: `/health` and the fallback count too. Key = `"{METHOD|*} {RoutePattern.RawText}"` from `HttpMethodMetadata`. Rule: each endpoint has either `IAllowAnonymous` **and** a row in the checked-in `AnonymousEndpoints` allow-list, or ≥ 1 `IAuthorizeData` whose `Policy` is a `Policies.*` constant. It also needs a row in `AuthorizationMatrix`, and every matrix row must match a discovered endpoint.
- **Proving the harness fails:** put the rule in a pure function `AuthorizationCoverage.FindViolations(endpoints, matrix, allowList)` and unit-test it with synthetic endpoints from `new RouteEndpointBuilder(...)` that have no policy. This satisfies "an endpoint without a policy or matrix row fails the test" without adding endpoints to the app.
- **Matrix execution:** a theory over rows × {Anonymous, Admin, Manager}, using real HS256 JWTs minted in `Csps.Testing` with `JsonWebTokenHandler` (transitive via JwtBearer).
- **Phase 1 endpoints:**
  - `* /health` (anon, allow-listed)
  - `* /api/{**path}` (anon, allow-listed; 404)
  - recommended: `GET /api/v1/site-settings` (Staff). Expected statuses 401 / 200 / 200. It gives the matrix a non-anonymous row and gives FND-05 a way to provoke a 500, by swapping the reader for a throwing fake in `ConfigureTestServices`. Planner's discretion, see Open Question 4.
- Unknown **non-API** paths with no endpoint fall under the fallback policy, so anonymous callers get 401 [ASSUMED]. Phase 1 has no SPA, so this is acceptable. Phase 2 must add an anonymous SPA host.

### Pattern 3: ProblemDetails contract (FND-05, D-26, D-27)
```csharp
services.AddProblemDetails(o => o.CustomizeProblemDetails = ctx =>
{
    var traceId = Activity.Current?.TraceId.ToHexString() ?? ctx.HttpContext.TraceIdentifier;
    ctx.ProblemDetails.Extensions["traceId"] = traceId;            // overwrite default "00-…-…-00" form
    var status = ctx.ProblemDetails.Status ?? StatusCodes.Status500InternalServerError;
    ctx.ProblemDetails.Title = PlainEnglish.TitleFor(status);       // e.g. 404 "We couldn't find that."
    if (status >= 500)
        ctx.ProblemDetails.Detail = $"Something went wrong. Reference: {traceId}";  // never exception text
});
// pipeline (outer → inner)
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseExceptionHandler();          // Production/Testing: ProblemDetails 500. Development: developer page (automatic)
app.UseStatusCodePages();           // empty 401/403/404/405 → ProblemDetails
app.UseSerilogRequestLogging();
app.UseAuthentication();
app.UseAuthorization();
app.MapFallback("/api/{**path}", ApiNotFound).AllowAnonymous();   // named static method, TypedResults.Problem(404)
```
- The default writer sets `traceId = Activity.Current?.Id ?? httpContext.TraceIdentifier`. That's the full `00-<trace>-<span>-00` form, hence the override to the 32-hex trace id, which matches Serilog's `@tr` [VERIFIED: aspnetcore `DefaultProblemDetailsWriter.cs` source].
- `DefaultProblemDetailsWriter.CanWrite` accepts no `Accept` header, `application/json`, `application/problem+json` or wildcards. With `Accept: text/html`, status-code pages fall back to plain text [CITED: learn.microsoft.com/aspnet/core/fundamentals/error-handling-api]. Two fixes: write `/api` responses with `TypedResults.Problem(...)`, which always serializes JSON, and add a test with `Accept: text/html` on `/api/v1/nope`.
- Use a pattern-based `MapFallback("/api/{**path}", …)`. The parameterless `MapFallback` uses a `{*path:nonfile}` pattern, which would skip `/api/foo.json` [ASSUMED]. A catch-all fallback matching all methods turns a wrong-method call on a known route into 404, not 405 [ASSUMED]. Accept this, and document it.
- Map `Error` to status in one place: `Validation` → `TypedResults.ValidationProblem(errors)` (field `errors`), `NotFound` → 404, `Conflict` → 409, `BusinessRule` → 422, `Forbidden` → 403. Unit-test `ResultHttpExtensions` by executing the `IResult` against a `DefaultHttpContext` with the ProblemDetails service registered.

### Pattern 4: Security headers (SEC-01) + Development-only Scalar carve-out (D-14)
```csharp
internal sealed class SecurityHeadersMiddleware(RequestDelegate next, IHostEnvironment env)
{
    // PRD §11.3, verbatim
    private const string StrictCsp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests";
    public Task InvokeAsync(HttpContext ctx)
    {
        ctx.Response.OnStarting(() =>
        {
            var h = ctx.Response.Headers;
            h.ContentSecurityPolicy = IsDevScalar(ctx) ? ScalarDevCsp(ctx) : StrictCsp;
            h.XContentTypeOptions = "nosniff";
            h["Referrer-Policy"] = "strict-origin-when-cross-origin";
            h["Permissions-Policy"] = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";
            h["Cross-Origin-Opener-Policy"] = "same-origin";
            if (ctx.Request.IsHttps) h.StrictTransportSecurity = "max-age=31536000; includeSubDomains";
            h.Remove("Server"); h.Remove("X-Powered-By");
            return Task.CompletedTask;
        });
        return next(ctx);
    }
}
```
- Register it **outermost** and set headers in `OnStarting`. `ExceptionHandlerMiddleware` clears the response before writing the 500 body, and `OnStarting` callbacks registered earlier still fire, so error responses keep the headers [ASSUMED; prove with a 500 test].
- HSTS is emitted only when `Request.IsHttps`. Tests set `factory.ClientOptions.BaseAddress = new Uri("https://localhost")`. Don't use `UseHsts()`: by default it excludes `localhost` hosts [ASSUMED].
- `Server` header:
  - Kestrel: `builder.WebHost.ConfigureKestrel(o => o.AddServerHeader = false)`.
  - IIS: ship `src/Csps.Server/web.config` with `<requestFiltering removeServerHeader="true" />` and `<remove name="X-Powered-By" />` (`hostingModel="inprocess"`). A file test asserts both.
  - Phase 3 (OPS-05) extends the same file.
- Use only Permissions-Policy features that browsers recognize. An unrecognized feature (for example the retired `interest-cohort`) logs a Chrome console error, which breaks Phase 2's zero-console-warning gate [ASSUMED].
- **Scalar facts (verified from the 2.17.8 package this session):**
  - The DLL embeds `ScalarStaticAssets.scalar.js` and `scalar.aspnetcore.js`, so the bundle is served locally. The docs confirm: "Scalar uses local assets by default." [CITED: scalar.com/products/api-references/integrations/aspnetcore/integration]
  - Fonts load from the CDN unless you call `DisableDefaultFonts()` ("Disables the default fonts (Inter and JetBrains Mono from CDN)").
  - Telemetry is on by default (`DisableTelemetry()`).
  - The rendered HTML contains `<script type="module">` inline script tags. `WithNonce()` generates a per-request nonce, stores it in `HttpContext.Items[ScalarOptions.NonceHttpContextItemKey]`, and sets `Cache-Control: no-store`.

  Configuration:
  ```csharp
  if (app.Environment.IsDevelopment())
  {
      app.MapOpenApi().AllowAnonymous();
      app.MapScalarApiReference(o => o.WithNonce().DisableDefaultFonts().DisableTelemetry()).AllowAnonymous();
  }
  ```
  For `/scalar*` in Development only, the carve-out CSP is `default-src 'self'; script-src 'self' 'nonce-{Items[NonceHttpContextItemKey]}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. The `style-src 'unsafe-inline'` part is [ASSUMED] (Scalar injects styles at runtime) and must be confirmed in a browser. It never applies outside Development, and a test proves `/scalar` and `/openapi/v1.json` return 404 under `Production`. Register `AddOpenApi()` only in Development too, which saves memory on the 256 MB pool.

### Pattern 5: Serilog logging, correlation and masking (FND-07, D-21)
```csharp
builder.Services.AddSerilog((sp, lc) =>
{
    lc.ReadFrom.Configuration(builder.Configuration)          // MinimumLevel + overrides only
      .ReadFrom.Services(sp)                                   // picks up ILogEventSink/enrichers registered in DI (tests)
      .Enrich.FromLogContext()
      .Enrich.With<SensitiveDataMaskingEnricher>()
      .Destructure.With<SensitiveDataDestructuringPolicy>();
    if (!builder.Environment.IsEnvironment("Testing"))
        lc.WriteTo.File(new CompactJsonFormatter(),
            Path.Combine(builder.Environment.ContentRootPath, "logs", "csps-.json"),
            rollingInterval: RollingInterval.Day, retainedFileCountLimit: 30,
            fileSizeLimitBytes: 10 * 1024 * 1024, rollOnFileSizeLimit: true,
            shared: true, flushToDiskInterval: TimeSpan.FromSeconds(2));
    if (builder.Environment.IsDevelopment()) lc.WriteTo.Console();
});
```
- Serilog.Sinks.File 7.0.0 parameters `shared`, `flushToDiskInterval`, `rollOnFileSizeLimit`, `retainedFileCountLimit` and `retainedFileTimeLimit` all exist [VERIFIED: package XML docs].
  - `retainedFileCountLimit` is "The maximum number of log files that will be retained, including the current log file".
  - With size rolling, a busy day uses several of the 30 slots, so retention can be shorter than 30 days. D-21 locks the count of 30. Adding `retainedFileTimeLimit: TimeSpan.FromDays(30)` is compatible (stricter wins). Planner's call.
- **Correlation id** = W3C trace id (`Activity.Current.TraceId`, 32 hex). It appears as `traceId` in ProblemDetails and as `@tr` in compact JSON [ASSUMED: Serilog ≥ 3.1 captures Activity trace/span ids and CompactJsonFormatter 3.0 writes `@tr`/`@sp`]. ASP.NET Core creates the request Activity when logging is enabled [ASSUMED]. A test asserts that the 404's `traceId` equals the request-log event's `TraceId`.
- **Masking:** an enricher rewrites top-level properties, and a destructuring policy handles objects (`{@x}`). Both use an **exact-name / suffix** rule set: `Password`, `*Password`, `Code` (exact), `Otp`, `*Token`, `*Secret`, `ApiKey`, `Authorization`, `Cookie`, `ConnectionString`, `CertificatePassword`, `CertificateBase64`. Value becomes `"***"`. Don't use a substring rule: `StatusCode` contains "code" and would get masked.
- **CWE-117:** compact JSON escapes CR/LF, and request logging logs `RequestPath` without the query string by default [ASSUMED]. Never log headers or bodies.
- **Tests:** register a `CollectingSink : ILogEventSink` singleton in `ConfigureTestServices`. `ReadFrom.Services(sp)` attaches it. No file sink runs in `Testing`, because WebApplicationFactory's content root is the Server project folder and would otherwise write `src/Csps.Server/logs` during tests.
- Add `logs/` to `.gitignore`. Web Deploy `-skip:Directory=\\logs` is Phase 3.

### Pattern 6: SiteSettings singleton entity (FND-09, D-04)
- Domain `SiteSettings`: `Id` (int, always 1), `BusinessName`, `TimeZoneId`, `CurrencyCode` ("PHP"), `Locale` ("en-PH"), contact placeholders (`ContactEmail`, `ContactPhone`, `AddressLine`, `FacebookUrl`), `RowVersion`, audit stamps. Private setters; a factory/`Rehydrate`; an `Update…` method returning `Result` for later phases.
- EF config:
  - `ValueGeneratedNever()` on `Id`
  - `HasCheckConstraint("CK_SiteSettings_Singleton", "[Id] = 1")`
  - `IsRowVersion()` on `RowVersion`
  - `HasData(...)` with **literal values only** (fixed `CreatedAtUtc` such as `2026-10-07T00:00:00Z`; no `DateTime.UtcNow`, no `Guid.NewGuid()`)

  Dynamic values cause `PendingModelChangesWarning` (PITFALLS #8). The spike's `HasData` singleton generated `EXEC(N'INSERT INTO [SiteSettings] …')` inside the idempotent script and `HasPendingModelChanges()` returned `False` [VERIFIED: spike].
- Because the row comes from the **migration**, production gets it through the reviewed idempotent script, and nothing seeds at startup (D-08).
- String columns are `nvarchar` with explicit max lengths. The ₱ sign needs Unicode.

### Pattern 7: Cached SiteSettings port + invalidation (FND-09, D-02)
```csharp
// Application
public interface ISiteSettingsReader { ValueTask<SiteSettingsSnapshot> GetAsync(CancellationToken ct); }
public interface ISiteSettingsCache  { ValueTask InvalidateAsync(CancellationToken ct); }   // call after any SiteSettings save (CONT-01)
[ImmutableObject(true)] public sealed record SiteSettingsSnapshot(string BusinessName, string TimeZoneId, string CurrencyCode, string Locale, /* contacts */ string RowVersion);

// Infrastructure
internal sealed class SiteSettingsReader(HybridCache cache, CspsDbContext db) : ISiteSettingsReader, ISiteSettingsCache
{
    private const string Key = "csps:site-settings:v1"; private static readonly string[] Tags = ["site-settings"];
    private static readonly HybridCacheEntryOptions Options = new() { Expiration = TimeSpan.FromHours(1), LocalCacheExpiration = TimeSpan.FromHours(1) };
    public ValueTask<SiteSettingsSnapshot> GetAsync(CancellationToken ct) =>
        cache.GetOrCreateAsync(Key, async c => await db.SiteSettings.AsNoTracking().Select(s => new SiteSettingsSnapshot(/*…*/)).SingleAsync(c), Options, Tags, ct);
    public ValueTask InvalidateAsync(CancellationToken ct) => cache.RemoveByTagAsync("site-settings", ct);
}
```
- From the HybridCache docs [CITED: learn.microsoft.com/aspnet/core/performance/caching/hybrid]:
  - `RemoveByTagAsync` is a **logical** invalidation: "it establishes an 'ignore anything created before this point' rule".
  - `sealed` + `[ImmutableObject(true)]` lets HybridCache reuse the instance instead of deserializing on every hit.
  - Defaults are `MaximumPayloadBytes` 1 MB and `MaximumKeyLength` 1024.
  - With no `IDistributedCache` it is in-process only, which suits D-10.
- Single instance on Basic, so no cross-server invalidation is needed. Configure `AddHybridCache(o => o.MaximumPayloadBytes = 64 * 1024)` to keep memory small.
- Test: read → change the row with raw SQL → still cached → `InvalidateAsync` → new value.

### Pattern 8: Business calendar (FND-08, D-02, D-03)
```csharp
// Domain (BCL only, 100% coverage)
public static class TimeZoneResolver
{
    public const string DefaultIana = "Asia/Manila", DefaultWindows = "Singapore Standard Time";
    public static (TimeZoneInfo Zone, ZoneSource Source) Resolve(string? storedId)
    {
        if (!string.IsNullOrWhiteSpace(storedId) && TimeZoneInfo.TryFindSystemTimeZoneById(storedId, out var z)) return (z, ZoneSource.Stored);
        if (TimeZoneInfo.TryFindSystemTimeZoneById(DefaultIana, out z)) return (z, ZoneSource.FallbackIana);
        if (TimeZoneInfo.TryFindSystemTimeZoneById(DefaultWindows, out z)) return (z, ZoneSource.FallbackWindows);
        return (TimeZoneInfo.CreateCustomTimeZone("CSPS+08", TimeSpan.FromHours(8), "UTC+08", "UTC+08"), ZoneSource.FixedOffset); // PH has no DST
    }
}
public sealed record BusinessClock(TimeZoneInfo Zone, DateTimeOffset UtcNow)
{
    public DateTimeOffset LocalNow => TimeZoneInfo.ConvertTime(UtcNow, Zone);
    public DateOnly Today => DateOnly.FromDateTime(LocalNow.DateTime);
    public int Year => Today.Year;                                           // calendar year (D-03)
    public (DateTimeOffset StartUtc, DateTimeOffset EndUtcExclusive) UtcRange(DateOnly from, DateOnly toInclusive) => /* local midnight → UTC */;
    public (DateOnly First, DateOnly Last) MonthOf(DateOnly d) => /* … */;
}
// Application port
public interface IBusinessCalendar { ValueTask<BusinessClock> GetClockAsync(CancellationToken ct); }
// Infrastructure: BusinessCalendar(TimeProvider time, ISiteSettingsReader settings) → Resolve(settings.TimeZoneId) + time.GetUtcNow()
```
- Verified on this machine with .NET 10.0.12 [VERIFIED: `dotnet run tz.cs` output]:
  - `TryFindSystemTimeZoneById("Asia/Manila")` → found, offset +08:00, no DST
  - `TryConvertIanaIdToWindowsId("Asia/Manila")` → `Singapore Standard Time`
  - `2026-10-06T16:00Z` → `2026-10-07 00:00 +08:00`

  The IANA lookup on Windows depends on ICU, so **never set `InvariantGlobalization=true`**. Run the host's zone check through the HostProbe.
- Fake-clock test vectors: `2026-10-06T15:59:59Z` (Oct 6, 23:59:59 Manila), `2026-10-06T16:00:00Z` (Oct 7, 00:00), `2026-09-30T16:00:00Z` (start of October in Manila), `2026-12-31T15:59:59Z` / `2026-12-31T16:00:00Z` (year rollover to 2027).
- Health's time-zone check: `Healthy` when `Source == Stored`, `Degraded` for any fallback. Fallbacks never throw.

### Pattern 9: Append-only AuditLog (FND-10, D-24, D-25)
**Entity (Domain `AuditEntry`):**
- `Id` bigint identity
- `OccurredAtUtc` datetimeoffset
- `ActorUserId` uniqueidentifier NULL
- `Action` nvarchar(64): constant from `AuditActions`
- `TargetType` nvarchar(64) NULL, `TargetId` nvarchar(64) NULL
- `IpPrefix` nvarchar(45) NULL, `UserAgentFamily` nvarchar(32) NULL
- `CorrelationId` varchar(32)
- `Detail` nvarchar(400) NULL: plain text only (no JSON, no secrets)

Index on `OccurredAtUtc` (purge). The `(ActorUserId, OccurredAtUtc)` and `(Action, OccurredAtUtc)` indexes can wait for AUDIT-02.

**EF config:** `ToTable("AuditLog", t => { t.HasTrigger("TR_AuditLog_AppendOnly"); t.UseSqlOutputClause(false); })`. Since EF Core 7, SaveChanges uses an `OUTPUT` clause that SQL Server rejects on tables with triggers. The EF 8+ fix is `UseSqlOutputClause(false)` [CITED: learn.microsoft.com/ef/core/what-is-new/ef-core-7.0/breaking-changes]. Both calls compiled against EF 10.0.12 in the spike [VERIFIED].

**Trigger (in the migration, after `CreateTable`, wrapped in `EXEC`):**
```sql
CREATE TRIGGER dbo.TR_AuditLog_AppendOnly ON dbo.AuditLog AFTER UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    IF EXISTS (SELECT 1 FROM inserted)
        THROW 51000, N'AuditLog is append-only: UPDATE is not allowed.', 1;
    IF CAST(SESSION_CONTEXT(N'csps.audit_purge') AS int) = 1
       AND NOT EXISTS (SELECT 1 FROM deleted WHERE OccurredAtUtc >= DATEADD(year, -2, SYSUTCDATETIME()))
        RETURN;   -- sanctioned retention purge (hardening phase) of rows older than 2 years only
    THROW 51001, N'AuditLog is append-only: DELETE is not allowed.', 1;
END
```
- Inside the generated idempotent script, each migration operation sits in an `IF NOT EXISTS (… __EFMigrationsHistory …) BEGIN … END` block within one `BEGIN TRANSACTION … COMMIT; GO` batch. `CREATE TRIGGER` must be first in its batch, so it **must** be in `EXEC(N'…')` [VERIFIED: spike's generated script]. Put the `Sql(...)` call **after** the `CreateTable` call. The spike placed it first, and the script ordered the trigger before the table.
- **The future purge** sets the session flag on a dedicated, non-pooled connection: `EXEC sp_set_session_context @key=N'csps.audit_purge', @value=1, @read_only=1;` followed by `DELETE TOP (500) FROM dbo.AuditLog WHERE OccurredAtUtc < DATEADD(year,-2,SYSUTCDATETIME())`. Even then, the trigger refuses recent rows. Whether pooled-connection resets clear the session context is [ASSUMED], so use `Pooling=false` for the purge.
- **TRUNCATE gap:** "`TRUNCATE TABLE` can't activate a trigger" and is allowed for `db_owner`, but you "can't use `TRUNCATE TABLE` on tables that: Are referenced by a `FOREIGN KEY` constraint" [CITED: learn.microsoft.com/sql/t-sql/statements/truncate-table-transact-sql]. Recommended defense in depth: an empty guard table created in the same migration, `AuditLogTruncateGuard(AuditLogId bigint NULL REFERENCES dbo.AuditLog(Id))`. It never holds rows, so DELETE purges still work, but TRUNCATE fails.
- **Residual risk to document (D-25):** a `db_owner` can still `DISABLE TRIGGER` or drop the FK. The guarantee protects against app bugs and injected statements, not against a malicious DB admin. Plan a later check that the trigger exists and is enabled (`sys.triggers.is_disabled = 0`), for example in `/health` or a maintenance job.
- **Respawn:** it resets with `DELETE <table>` statements, not TRUNCATE [VERIFIED: Respawn `SqlServerDbAdapter.BuildDeleteCommandText`, "`DELETE {table.GetFullName(QuoteCharacter)};`"]. So `AuditLog` (and the guard) **must** be in `TablesToIgnore`. Audit tests assert on rows filtered by their own unique `CorrelationId`.
- **Defense in depth in EF:** a `SaveChangesInterceptor` throws if any `AuditEntry` entry is `Modified`/`Deleted`, which gives a clearer error than SqlException 51000.
- **IP truncation** (pure, Domain or Application). Use `ip.IsIPv4MappedToIPv6 ? ip.MapToIPv4() : ip`. For IPv4, zero byte 3 (/24). For IPv6, keep 6 bytes and zero the rest (/48). Null or other families give null. Example: `203.177.12.45` → `203.177.12.0`.
- **UA family:** an ordered `Contains` classifier capped at 512 chars, with **no regex** (CWE-1333):
  - FBAN/FBAV → "Facebook in-app" (the main traffic source)
  - Instagram → "Instagram in-app"
  - Edg/ → Edge; OPR/ → Opera; SamsungBrowser → "Samsung Internet"
  - Firefox/FxiOS → Firefox; CriOS/Chrome/ → Chrome
  - Safari + Version/ → Safari
  - bot/crawl/spider → Bot
  - otherwise "Other"
- **Request context port:** `IRequestContext { Guid? UserId; IPAddress? RemoteIp; string? UserAgent; string CorrelationId; }` is implemented in Server from `HttpContext`. Use `Connection.RemoteIpAddress` only. **No `ForwardedHeaders`** until FND-13 proves the proxy topology (PITFALLS #17). Add a test showing a spoofed `X-Forwarded-For` is ignored.

### Pattern 9b: Data Protection with certificate (SEC-04, D-15)
```csharp
// Infrastructure (needs CspsDbContext : IDataProtectionKeyContext)
var cert = X509CertificateLoader.LoadPkcs12(Convert.FromBase64String(opts.CertificateBase64), opts.CertificatePassword,
                                            X509KeyStorageFlags.EphemeralKeySet);
services.AddDataProtection()
    .SetApplicationName("Csps")
    .PersistKeysToDbContext<CspsDbContext>()
    .ProtectKeysWithCertificate(cert)
    .UnprotectKeysWithAnyCertificate(previousCerts);   // rotation: keep every old cert that encrypted any stored key
```
- `ProtectKeysWithCertificate(X509Certificate2)` registers the encryptor **and** calls `XmlKeyDecryptionOptions.AddKeyDecryptionCertificate(certificate)`, so decryption doesn't need the Windows certificate store [VERIFIED: aspnetcore `DataProtectionBuilderExtensions.cs`]. `UnprotectKeysWithAnyCertificate` is the documented rotation mechanism [CITED: learn.microsoft.com/aspnet/core/security/data-protection/configuration/overview].
- Use `X509CertificateLoader.LoadPkcs12`. The docs' sample `new X509Certificate2(path, pwd)` is obsolete on .NET 9+ (SYSLIB0057), which would be a warning, hence an error [ASSUMED for the diagnostic id]. On this machine, an `EphemeralKeySet` load had `HasPrivateKey=True` and `GetRSAPrivateKey()` non-null [VERIFIED: tz.cs probe]. On IIS without a loaded user profile, ephemeral keys avoid writing key files. Confirm with the HostProbe.
- Dev cert: `tools/scripts/Initialize-DevSecrets.ps1` (PowerShell 5.1-compatible; pwsh 7 isn't installed) or a `.cs` file-based app.
  - It creates an RSA-3072 self-signed cert in memory with `CertificateRequest.CreateSelfSigned` and a 10-year validity, so it never touches the Windows certificate store.
  - It exports a PFX with a random password and runs `dotnet user-secrets set DataProtection:CertificateBase64 …` and `DataProtection:CertificatePassword …` for `src/Csps.Server`. It also generates `Jwt:SigningKey`.
  - It's idempotent: if the secrets exist, it doesn't regenerate them, because regenerating orphans the dev key ring.
- Fail fast: when the options are missing outside `Testing`, startup throws (`ValidateOnStart`). In tests, `Csps.Testing` builds an in-memory PFX once per run and injects it through configuration.
- **Tests:**
  1. Host A protects a payload; dispose it; host B, with the same DB and cert, unprotects it.
  2. The `DataProtectionKeys.Xml` column contains `EncryptedData` / `encryptedSecret`, not a plaintext `<masterKey>`.
  3. The collected log events contain no "No XML encryptor configured" warning.
- **Rotation doc** (`docs/operations/data-protection-rotation.md`):
  - Add the new cert as primary and move the old one to `UnprotectKeysWithAnyCertificate`.
  - Never delete an old cert while any `DataProtectionKeys` row encrypted by it remains.
  - Back up PFX + password outside the host. Losing them signs everyone out (D-15).

### Pattern 10: `/health` (FND-06, D-23)
```csharp
services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy())
    .AddCheck<DatabaseHealthCheck>("database", timeout: TimeSpan.FromSeconds(3))   // Database.CanConnectAsync
    .AddCheck<TimeZoneHealthCheck>("time-zone");                                    // reads SiteSettings via cached port
app.MapHealthChecks("/health", new HealthCheckOptions { ResponseWriter = MinimalHealthWriter.WriteAsync }).AllowAnonymous();
```
Body (200 for Healthy/Degraded, 503 for Unhealthy; `Cache-Control: no-store`):
```json
{ "status": "Healthy", "checks": [ { "name": "self", "status": "Healthy" }, { "name": "database", "status": "Healthy" }, { "name": "time-zone", "status": "Healthy" } ] }
```
No descriptions, exception text, durations, versions or tags. Tests:
- the happy path
- an unreachable DB: point the factory's connection string at a non-existent LocalDB database name `CSPS_Test_<guid>`, never a BetsLLC name → 503 with the body still minimal
- `Accept: text/html` → still JSON

Rate limiting `/health` (CWE-400) arrives with SEC-03 in Phase 4. Until then the checks are cheap: one connection open and one cached read. The `AddCheck<T>(…, timeout:)` overload is [ASSUMED].

### Pattern 11: SQL fixture — LocalDB locally, container in CI (FND-11, D-05, D-07)
```csharp
public sealed class SqlServerInstance : IAsyncLifetime            // [assembly: AssemblyFixture(typeof(SqlServerInstance))]
{
    // CSPS_TEST_SQL: "localdb" (default) → Server=(localdb)\CSPS;Integrated Security=true
    //               "container" → new MsSqlBuilder("mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04").Build()
}
public sealed class CspsDatabase : IAsyncLifetime                 // IClassFixture<CspsDatabase>: one DB per test class
{
    // name = $"CSPS_Test_{Guid.NewGuid():D}" → CREATE DATABASE → ALTER DATABASE … SET COMPATIBILITY_LEVEL = 160
    // → context.Database.MigrateAsync() (migrations are under test; never EnsureCreated)
    // → Respawner.CreateAsync(conn, new RespawnerOptions { DbAdapter = DbAdapter.SqlServer,
    //        TablesToIgnore = [new Table("__EFMigrationsHistory"), new Table("SiteSettings"),
    //                          new Table("AuditLog"), new Table("AuditLogTruncateGuard")] })
    // DisposeAsync: SqlConnection.ClearAllPools(); guard name with ^CSPS_Test_[0-9a-f-]{36}$;
    //   ALTER DATABASE … SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE …
}
```
- xUnit v3 4.0.1 contains `Xunit.AssemblyFixtureAttribute`, `IClassFixture<T>`, `ICollectionFixture<T>` and `IAsyncLifetime` [VERIFIED: xunit.v3.core.xml in 4.0.1]. Test classes run in parallel by default, one DB per class gives isolation, and tests inside a class run sequentially with `ResetAsync()` before each.
- `MsSqlBuilder(string image)` exists in 4.15.0. The tag `2025-CU9-ubuntu-24.04` is in the MCR list [VERIFIED: package XML + mcr.microsoft.com tag list].
- When `CSPS_TEST_SQL` is unset, default to `localdb`. Fail with a clear message if `localdb` is requested on non-Windows. The CI workflow (Phase 3) sets `CSPS_TEST_SQL=container` in the job env (per process, PC-3).
- The name guard is one shared static (`TestDatabaseName.IsDisposable(string)`). A unit test proves it rejects `BetsLLC_Test_…`, `CSPS_Dev`, `CSPS_E2E`, `CSPS_Legacy_Restore` and malformed GUIDs. `tools/scripts/Remove-StaleTestDatabases.ps1` connects **only** to `(localdb)\CSPS` and applies the same regex.
- Why `SiteSettings` is ignored by Respawn: its row comes from the migration. Tests that change it must restore it or invalidate the cache.
- LocalDB connection strings: whether `Encrypt` defaults (SqlClient 6.x, `Encrypt=True` default since EF 7) need `TrustServerCertificate` for LocalDB is [ASSUMED] (usually not needed for shared-memory/named-pipe LocalDB). Testcontainers' `GetConnectionString()` already includes `TrustServerCertificate=True`.

### Pattern 12: Migration verification (FND-01, FND-12, D-13)
```csharp
// 1. fresh DB → MigrateAsync() → tables + SiteSettings row exist                     (FND-01)
// 2. for each migration i: MigrateAsync(previous ?? "0") then MigrateAsync()        (empty → previous → latest)
// 3. idempotent script, twice, at compat 160 AND 170 (SQL 2025 default for new DBs)
var script = db.GetService<IMigrator>().GenerateScript(options: MigrationsSqlGenerationOptions.Idempotent);
foreach (var batch in GoSeparator().Split(script)) if (!string.IsNullOrWhiteSpace(batch)) await ExecAsync(batch);  // run twice
// 4. db.Database.HasPendingModelChanges() == false                                   (forgot-a-migration guard)
// 5. no JSON mapping: no entity IsMappedToJson(), no property IsPrimitiveCollection   (D-13)
[GeneratedRegex(@"^\s*GO\s*$", RegexOptions.Multiline)] private static partial Regex GoSeparator();
```
- `IMigrator.GenerateScript(options: MigrationsSqlGenerationOptions.Idempotent)` and `HasPendingModelChanges()` both ran in the spike. The script uses `GO` batch separators [VERIFIED].
- The EF metadata API names `IsMappedToJson()` / `IsPrimitiveCollection` are [ASSUMED]. If they differ in EF 10, assert on the generated migration SQL (no ` json` type) instead.
- `UseSqlServer(cs, o => o.UseCompatibilityLevel(160))` compiled in the spike [VERIFIED]. Keep the value in one constant (`SqlCompatibility.Level = 160`), so the FND-13 re-pin is a one-line change plus a re-run of test 3.

### Pattern 13: Architecture tests and dependency registry (FND-03, QUAL-06)
```csharp
using ArchUnitNET.Domain; using ArchUnitNET.Loader; using ArchUnitNET.xUnitV3;
using static ArchUnitNET.Fluent.ArchRuleDefinition;

private static readonly Architecture Arch = new ArchLoader().LoadAssemblies(
    typeof(Csps.Domain.AssemblyMarker).Assembly, typeof(Csps.Application.AssemblyMarker).Assembly,
    typeof(Csps.Infrastructure.DependencyInjection).Assembly, typeof(Program).Assembly).Build();
private static readonly IObjectProvider<IType> Domain = Types().That().ResideInAssembly(typeof(Csps.Domain.AssemblyMarker).Assembly).As("Domain");
// …Application, Infrastructure, Server likewise
[Fact] public void Domain_depends_on_nothing_inward() =>
    Types().That().Are(Domain).Should().NotDependOnAny(Types().That().Are(Application).Or().Are(Infrastructure).Or().Are(Server)).Check(Arch);
```
- The adapter's namespace is `ArchUnitNET.xUnitV3`, with `ArchRuleExtensions.Check` and `ArchRuleAssert.CheckRule` [VERIFIED: strings in `ArchUnitNET.xUnitV3.dll` 0.13.4]. Load/layer/`NotDependOnAny` usage follows [CITED: archunitnet.readthedocs.io/en/latest/guide/].
- Add **reflection checks**, which are robust where ArchUnitNET namespace matching could miss stub types:
  - `Csps.Domain.GetReferencedAssemblies()` ⊆ {`System.*`, `netstandard`}
  - Application references nothing from `Microsoft.EntityFrameworkCore*`, `Microsoft.AspNetCore*` or `Csps.Infrastructure`
  - Infrastructure doesn't reference `Csps.Server`
  - `Csps.Server` endpoint types don't depend on `Microsoft.EntityFrameworkCore.DbContext`. Making `CspsDbContext` `internal` helps.
- **File-based tests** (repo root located by walking up to `Csps.slnx`):
  - `Directory.Packages.props` versions all match `^\d+\.\d+\.\d+$`, and no `.csproj` has `Version=` on a `PackageReference` (NU1011/NU1008 also enforce this natively).
  - No forbidden package id (PC-8 list plus `NetArchTest.Rules`, `Serilog.Sinks.MSSqlServer`, `Microsoft.AspNetCore.SpaProxy`) appears anywhere.
  - Every `PackageVersion`, `GlobalPackageReference` and `.config/dotnet-tools.json` tool has an entry in `docs/dependencies.json` with `purpose`, `license` ∈ allow-list (MIT, Apache-2.0, BSD-2/3-Clause, ISC; MPL-2.0/OFL-1.1 only where D-18 allows), `legitimacy`, `published` and `coolDown` ∈ {`aged`, `accepted: <reason>`}. The version in the registry equals the pinned version.
  - `Csps.slnx` lists exactly the expected projects, and the `CarmensStitchAndPrintingServices.*` folders don't exist.
  - `launchSettings.json` has ports 5115/7028 and no `ASPNETCORE_HOSTINGSTARTUPASSEMBLIES`.
  - `Directory.Build.props` carries the required properties.
  - `BannedSymbols.txt` contains the six entries.

### Pattern 14: Guarded dev seed (FND-04, D-08)
- `tools/Csps.DevSeed` is a console app. Usage: `dotnet run --project tools/Csps.DevSeed -- [--reset] [--database CSPS_Dev|CSPS_E2E]`.
- The guard (pure, unit-tested): `new SqlConnectionStringBuilder(cs).InitialCatalog` must equal `CSPS_Dev` or `CSPS_E2E` (OrdinalIgnoreCase, since SQL names are case-insensitive under default collation). Anything else exits non-zero **before** any connection opens.
- `--reset` = `EnsureDeletedAsync` → `MigrateAsync` → run seed steps. Migrating from an explicit tool is allowed; only startup migration is banned.
- Seed steps implement `ISeedStep { int Order; Task RunAsync(CspsDbContext, CancellationToken) }` in Infrastructure `Seeding/`. Test the seeding core directly against a `CSPS_Test_*` fixture DB, bypassing the CLI guard. The guard has its own tests.
- **Phase 1 content:** an idempotent SiteSettings step that ensures the singleton matches the UI-spec demo placeholders (D-04). Users, orders, expenses and price list need entities from Phases 4, 6, 7 and 11. Per the ROADMAP's "Pieces that grow" convention, each later phase adds its own step. See Open Question 3.

### Pattern 15: FND-13 hosting verification record (owner-run)
Deliver `.planning/HOSTING-RECORD.md`: one table with Fact | How to check | Result (pasted) | Status (`Verified` / `Unverified` / `N/A`) | Date. It must contain no credentials, connection strings or passwords. The owner runs the steps. Sections:
1. **Control panel facts (read-only screens):**
   - plan name
   - databases allowed / used
   - DB quota (vendor page: Basic = 1 DB, 1 GB, 256 MB pool, no scheduled tasks [CITED: smarterasp.net/hosting_plans])
   - .NET versions offered
   - whether the legacy site and DB live in **this** account
   - how app settings / environment variables are configured
   - Web Deploy availability
2. **SQL (read-only, owner-approved, against a non-legacy DB if one exists):**
   ```sql
   SELECT @@VERSION AS Version;
   SELECT SERVERPROPERTY('ProductVersion') AS ProductVersion, SERVERPROPERTY('ProductLevel') AS Level,
          SERVERPROPERTY('Edition') AS Edition, SERVERPROPERTY('Collation') AS ServerCollation;
   SELECT name, compatibility_level, collation_name, is_read_committed_snapshot_on, recovery_model_desc
     FROM sys.databases WHERE name = DB_NAME();
   SELECT CAST(SUM(size) * 8.0 / 1024 AS decimal(10,1)) AS AllocatedMB FROM sys.database_files;
   SELECT USER_NAME() AS DbUser, IS_MEMBER('db_owner') AS IsDbOwner;
   SELECT permission_name FROM fn_my_permissions(NULL, 'DATABASE') ORDER BY 1;
   ```
   Optional trigger probe, **only** in a scratch DB the owner confirms isn't legacy: create a temp table plus the append-only trigger, try UPDATE/DELETE, expect errors 51000/51001, then drop both.
3. **HostProbe** (`tools/Csps.HostProbe`, a tiny ASP.NET Core app). The owner deploys it to a **new, separate site/subdomain**, never the legacy site's folder. Every call requires an `X-Probe-Key` header matching a value the owner sets. The owner deletes the site afterwards. It reports:
   - `RuntimeInformation.FrameworkDescription`, `Environment.Version`, `Is64BitProcess`
   - process name (`w3wp` = in-process)
   - `Directory.GetCurrentDirectory()` vs `ContentRootPath`
   - whether `{contentRoot}/logs` is writable
   - `Connection.RemoteIpAddress` plus the raw `X-Forwarded-For` / `X-Forwarded-Proto` / `X-Real-IP` / `CF-Connecting-IP`, and `Request.IsHttps`
   - Asia/Manila resolution and `en-PH` culture availability
   - PFX `EphemeralKeySet` load plus an RSA encrypt/decrypt round trip (the SEC-04 prerequisite)
   - `GC.GetGCMemoryInfo().TotalAvailableMemoryBytes`
4. **Scheduler / staging:** record "not included on Basic (plan page)" and "no staging (D-11)".
5. **SMTP (last item, D-12):**
   - Send from the host mailbox to a Gmail address and copy the "Show original" SPF/DKIM/DMARC lines.
   - Record the existing TXT records (`nslookup -type=TXT <domain>`, `_dmarc.<domain>`).
   - Any change must **merge** into a single `v=spf1` record. Two SPF records cause a permerror [ASSUMED].
   - Stays `Unverified` until the owner supplies the domain.

After the record lands, re-pin `SqlCompatibility.Level` if the host's level differs, and re-run Pattern 12 test 3.

### Pattern 16: Coverage gates (QUAL-03, D-17)
```
dotnet test --project tests/Csps.Domain.UnitTests --coverlet --coverlet-output-format cobertura \
  --coverlet-include "[Csps.Domain]*" --results-directory artifacts/coverage/domain
dotnet reportgenerator "-reports:artifacts/coverage/domain/*.xml" "-targetdir:artifacts/coverage/domain/report" \
  "-reporttypes:TextSummary;Html" "-assemblyfilters:+Csps.Domain" \
  "minimumCoverageThresholds:lineCoverage=100" "minimumCoverageThresholds:branchCoverage=100"
# Application: same with Csps.Application.UnitTests, [Csps.Application]*, lineCoverage=95 (branch threshold: planner may set 95 too)
```
- coverlet.MTP options [CITED: coverlet `Documentation/Coverlet.MTP.Integration.md`]:
  - `--coverlet`, `--coverlet-output-format` (json, lcov, opencover, cobertura, teamcity), `--coverlet-include`/`-exclude`/`-exclude-by-attribute`
  - default excludes cover `ExcludeFromCodeCoverage`, `GeneratedCodeAttribute` and `CompilerGeneratedAttribute`
  - its threshold options exist, but "Threshold validation is not yet supported", hence ReportGenerator
  - output files are timestamped (`coverage.cobertura.<ts>.xml`), hence the glob
- ReportGenerator thresholds apply to the **filtered** report and it "will exit unsuccessfully" below them [CITED: ReportGenerator wiki Settings], so run it once per assembly. Measure Domain coverage from Domain unit tests only (not merged with integration runs), so the 100% reflects real unit coverage.
- Script: `tools/scripts/coverage-gate.cs`, a .NET 10 file-based app (`dotnet run tools/scripts/coverage-gate.cs`; verified working locally) or a `.ps1` + `.sh` pair. CI on ubuntu (Phase 3) can then run the same gate. Windows PowerShell 5.1 is the only PowerShell installed here.
- Whether `dotnet test --project <path>` passes `--coverlet*` straight through in .NET 10 MTP mode is [ASSUMED] (the xUnit doc shows MTP options passed directly to `dotnet test`). Verify in Wave 0.

### Anti-Patterns to Avoid
- **`[**/Migrations/*.cs]` editorconfig glob:** verified not to apply, and the build breaks on CA1861. Use a root-relative path.
- **Dynamic values in `HasData`:** `PendingModelChangesWarning` / a non-empty migration on every `migrations add`.
- **`Database.Migrate()` / `EnsureCreated()` at startup or in the fixture:** PRD §19.2. The fixture must use `MigrateAsync` because migrations are what's under test.
- **`UseHsts()` for the header contract:** it skips localhost and HTTP, so tests either can't see it or need hacks. Set the header in the middleware on HTTPS.
- **Substring-based log masking:** masks `StatusCode`, `ZipCode`. Use exact names and suffixes.
- **Serilog file path from appsettings (relative):** resolves against the process working directory on IIS, not the content root [ASSUMED].
- **`AllowAnonymous` on a parent group:** it wins over `RequireAuthorization` (ARCHITECTURE Anti-Pattern 3). Keep anonymous and authenticated groups separate.
- **`ForwardedHeaders` before FND-13:** trusting `X-Forwarded-For` blindly lets clients spoof audit IPs.
- **Running the FND-13 SQL or trigger probe against the legacy `csptailoringdb`:** Prime Directive 1.
- **Reading `_local/` in this phase:** PC-6 / Anti-Pattern 7.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB reset between tests | custom `DELETE` ordering | Respawn 7.0.0 | FK-graph ordering, reseed, ignore-list |
| SQL Server in CI | docker scripts | Testcontainers.MsSql 4.15.0 with explicit image | readiness wait, cleanup, connection string |
| Coverage | custom instrumentation | coverlet.MTP 10.0.1 + ReportGenerator | MTP integration, Cobertura, thresholds |
| Architecture rules | reflection-only walkers | ArchUnitNET 0.13.4 (+ small reflection checks) | dependency graph incl. generics/attributes |
| Key ring persistence/encryption | own encryption of keys | Data Protection `PersistKeysToDbContext` + `ProtectKeysWithCertificate` | rotation, key lifetime, decryptor registry |
| Cache + stampede protection | `ConcurrentDictionary` cache | HybridCache 10.10.0 | single-flight factory, tags, size limits |
| JWT validation | manual token parsing | JwtBearer 10.0.12 (`JsonWebTokenHandler`) | signature/lifetime/alg validation |
| ProblemDetails | custom error JSON | `AddProblemDetails` + `TypedResults.Problem/ValidationProblem` | RFC 9457 shape, status-code pages |
| Time zones | offset math | `TimeZoneInfo` + `TimeProvider`/`FakeTimeProvider` | IANA/Windows ids, DST-safe |
| Idempotent schema scripts | hand-written DDL | `dotnet ef migrations script --idempotent` / `IMigrator.GenerateScript` | history-table guards |
| Banning `DateTime.Now` | grep in CI | BannedApiAnalyzers RS0030 | compile-time error with message |

**Key insight:** in this phase the only hand-rolled pieces are deliberately tiny and pure: IP truncation, the UA family classifier, the masking rules, the security-header constant, the health writer and the DB-name guard. Each gets 100% unit tests.

## Runtime State Inventory

> Included because Phase 1 removes and renames the VS scaffold (`CarmensStitchAndPrintingServices.*` → `Csps.*`).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. No database exists for the scaffold. LocalDB has only `MSSQLLocalDB` (TheBETSLLC's), and the `CSPS` instance doesn't exist yet [VERIFIED: `sqllocaldb info`]. | Create the `(localdb)\CSPS` instance (script). Never touch `MSSQLLocalDB`. |
| Live service config | None. No GitHub remote, CI or host deployment exists yet (MEMORY: no remote). | None |
| OS-registered state | None found. No Windows services or tasks for this project. The scaffold's `vite.config.js` would export a dev cert to `%APPDATA%\ASP.NET\https\carmensstitchandprintingservices.client.pem`, but that folder **doesn't exist** (npm was never run) [VERIFIED: ls]. One `%APPDATA%\Microsoft\UserSecrets\912089e8-…` folder exists, but the scaffold csproj has no `UserSecretsId`, so it belongs to another project. **Don't touch it.** | None. New `UserSecretsId` for `Csps.Server`. |
| Secrets / env vars | None in the repo. `.gitignore` already excludes `appsettings.*.local.json`, `.env*`, `secrets.json` (`.gitignore:8-10`). Missing: `logs/`, `artifacts/`, `*.pfx`. | Add `logs/`, `artifacts/`, `*.pfx`, `*.pem`, `*.key` to `.gitignore` |
| Build artifacts | `CarmensStitchAndPrintingServices.Server/bin`, `obj` and `.vs/` (VS caches of the old solution). All are untracked (git status `??`). | Delete the scaffold folders, `.slnx` and `.esproj`. `.vs/` is regenerated harmlessly. |

**Scaffold facts to carry over** (read this session): `launchSettings.json:8` `"applicationUrl": "http://localhost:5115"`, `:18` `"applicationUrl": "https://localhost:7028;http://localhost:5115"`. Drop `:11` and `:21` `"ASPNETCORE_HOSTINGSTARTUPASSEMBLIES": "Microsoft.AspNetCore.SpaProxy"`. Keep `"ASPNETCORE_ENVIRONMENT": "Development"` (profile-scoped, allowed by PC-5).

## Common Pitfalls

### Pitfall 1: Respawn deletes trip the append-only trigger
**What goes wrong:** the first `ResetAsync()` throws SqlException 51001.
**Why:** Respawn emits `DELETE` statements [VERIFIED source].
**Avoid:** put `AuditLog` and `AuditLogTruncateGuard` in `TablesToIgnore`, and filter audit assertions by `CorrelationId`.
**Warning sign:** fixture failures only in classes that run after an audit test.

### Pitfall 2: EF `OUTPUT` clause on the triggered table
**What goes wrong:** "The target table 'AuditLog' of the DML statement cannot have any enabled triggers if the statement contains an OUTPUT clause without INTO clause."
**Avoid:** `UseSqlOutputClause(false)` and `HasTrigger(...)` [CITED EF 7 breaking changes].

### Pitfall 3: Trigger DDL in idempotent scripts
**What goes wrong:** "CREATE TRIGGER must be the first statement in a query batch" when the script runs.
**Avoid:** wrap it in `EXEC(N'…')`, and order the `Sql()` call after `CreateTable` [VERIFIED spike script layout].

### Pitfall 4: Generated-code glob silently not matching
Verified CA1861 failure (Pattern 1). Use the root-relative path, and add an architecture test asserting the `.editorconfig` section exists.

### Pitfall 5: ProblemDetails becomes plain text for `Accept: text/html`
**Why:** `DefaultProblemDetailsWriter.CanWrite` rejects non-JSON Accept values [VERIFIED source].
**Avoid:** `TypedResults.Problem` for `/api`, plus a test with that header.

### Pitfall 6: Missing auth scheme with a fallback policy
An anonymous request throws `InvalidOperationException` instead of returning 401 [ASSUMED]. Register JwtBearer in Phase 1.

### Pitfall 7: The newest package versions violate the cool-down
coverlet.MTP 10.1.0 (10 days), Scalar.AspNetCore 2.17.14 (1 day), Microsoft.Testing.Platform 2.5.0 (1 day) and Microsoft.Data.SqlClient 7.1.1 are too new. Pin as in the Standard Stack. The 10.0.13 servicing release is expected around Patch Tuesday 2026-10-13. It may skip the cool-down **only** with a recorded security reason (D-19).

### Pitfall 8: Test runs writing logs into the repo
WebApplicationFactory's content root = the Server project folder. Disable the file sink in `Testing`.

### Pitfall 9: Basic plan's single database (FND-13)
The live legacy DB likely occupies the only slot. Running probes or the trigger test there violates Prime Directive 1. See Open Question 1.

### Pitfall 10: Unrecognized Permissions-Policy features → console errors
These break Phase 2's zero-console-warning gate. Use only well-known features [ASSUMED list].

### Pitfall 11: `SESSION_CONTEXT` and pooled connections (future purge)
**Avoid:** a dedicated `Pooling=false` connection for the purge [ASSUMED behaviour]. Document this for the hardening phase.

### Pitfall 12: Server-side money formatting uses hyphen-minus
.NET `en-PH` formats `-₱12,450.00` with U+002D [VERIFIED: probe output `-₱12,450.00`]. D-01 wants U+2212, which is the client formatter's job (Phase 2). The API returns numbers, never formatted money strings.

## Code Examples

### Minimal Program.cs shape (composition root)
```csharp
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(o => o.AddServerHeader = false);
builder.Services.AddSerilog(/* Pattern 5 */);
builder.Services.AddProblemDetails(/* Pattern 3 */);
builder.Services.AddApplication();                       // ports' default registrations, policy constants
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);  // EF (compat 160), HybridCache, DP, health checks, calendar
builder.Services.AddServerSecurity(builder.Configuration);// JwtBearer validation + fallback/named policies
builder.Services.AddSingleton(TimeProvider.System);
if (builder.Environment.IsDevelopment()) builder.Services.AddOpenApi();

var app = builder.Build();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseSerilogRequestLogging();
app.UseAuthentication();
app.UseAuthorization();
app.MapCspsApi();                                        // /health, /api/v1 groups, /api/{**path} fallback
if (app.Environment.IsDevelopment()) { /* MapOpenApi + MapScalarApiReference (Pattern 4) */ }
app.Run();
```
No `Database.Migrate()`, no seeding, no `UseHttpsRedirection()` decision hidden in here. Add HTTPS redirection outside Development and Testing, with tests at `https://localhost`. A source generator in .NET 10 emits `public partial class Program` for `WebApplicationFactory` [CITED: github.com/dotnet/aspnetcore/pull/58199]. An explicit declaration is harmless.

### Test JWT minting (Csps.Testing)
```csharp
public static string For(string role, TimeProvider time, Guid? userId = null)
{
    var now = time.GetUtcNow();                      // RS0030 bans DateTime.UtcNow in tests too
    return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
    {
        Issuer = TestJwt.Issuer, Audience = TestJwt.Audience,
        Claims = new Dictionary<string, object> { ["sub"] = (userId ?? Guid.NewGuid()).ToString(), ["role"] = role },
        NotBefore = now.UtcDateTime, IssuedAt = now.UtcDateTime, Expires = now.AddMinutes(15).UtcDateTime,
        SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(TestJwt.Key), SecurityAlgorithms.HmacSha256),
    });
}
```
If the API runs under a `FakeTimeProvider`, mint tokens from the same provider. Otherwise JwtBearer's lifetime validation, which uses the real clock unless `TimeProvider` is wired into its options [ASSUMED], could reject them. In the matrix tests, use `TimeProvider.System` for tokens.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VSTest + coverlet.collector | MTP v2 runner (xUnit v3 4.x) + coverlet.MTP | xUnit v3 4.0.0 (2026-08-14) dropped MTP v1 | `global.json` `test.runner`; test projects are executables |
| NetArchTest.Rules 1.3.2 | ArchUnitNET 0.13.4 + xUnitV3 adapter | NetArchTest last release 2021 | D-16 PRD substitution |
| `new X509Certificate2(bytes, pwd)` | `X509CertificateLoader.LoadPkcs12` | .NET 9 | obsolete ctor = warning = error |
| EF `HasTrigger` only | `UseSqlOutputClause(false)` (EF 8+) | EF 8 | both work; the latter is explicit |
| Swashbuckle UI | built-in OpenAPI 3.1 + Scalar (local assets, nonce support) | .NET 9/10 | dev-only, CSP-safe with nonce |
| `IDistributedCache`/`IMemoryCache` hand caching | HybridCache with tags | .NET 9 (pkg 9.3.0+) | logical tag invalidation |

**Deprecated/outdated:** the PRD's Docker `2025-latest` image for local dev (replaced by LocalDB + a pinned CU tag in CI, D-07); `coverlet.collector`; `FluentAssertions` 8.x (license).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The legacy site/DB is on the **same** SmarterASP account as the Basic plan the owner described | Summary, Pattern 15, OQ1 | If separate, FND-13 can use the free DB slot freely; if same, probes must avoid it entirely |
| A2 | Fallback policy without an auth scheme throws instead of 401 | Pattern 2, Pitfall 6 | Low: JwtBearer is registered anyway |
| A3 | Unknown non-API paths get 401 under the fallback policy | Pattern 2 | Low in Phase 1; Phase 2 SPA host must be anonymous |
| A4 | `MapFallback()` default pattern is `{*path:nonfile}`; catch-all fallback turns 405 into 404 | Pattern 3 | Test catches it; behaviour is documented |
| A5 | `OnStarting` headers survive `ExceptionHandlerMiddleware` clearing | Pattern 4 | Test on a 500 proves it; else move headers into the exception handler path |
| A6 | `UseHsts()` excludes localhost | Pattern 4 | None if the middleware sets HSTS itself |
| A7 | Scalar needs `style-src 'unsafe-inline'` (dev only) | Pattern 4 | Dev-only console CSP errors on `/scalar`; adjust the carve-out |
| A8 | Serilog relative file paths resolve to the working directory on IIS | Pattern 5 | Avoided by using an absolute `ContentRootPath` path |
| A9 | Serilog captures Activity TraceId → `@tr`; ASP.NET Core creates the request Activity | Pattern 5 | Test asserts equality; else add an explicit enricher/`ActivityListener` |
| A10 | `X509CertificateLoader`/`EphemeralKeySet` works on SmarterASP IIS | Pattern 9b | HostProbe verifies; fallback `MachineKeySet` |
| A11 | `SESSION_CONTEXT` reset behaviour on pooled connections | Pattern 9 | Future purge only; use `Pooling=false` |
| A12 | LocalDB connections need no `TrustServerCertificate` | Pattern 11 | Add it to the LocalDB connection string if login fails with a cert error |
| A13 | EF metadata names `IsMappedToJson()` / `IsPrimitiveCollection` | Pattern 12 | Fall back to scanning the generated SQL |
| A14 | `dotnet test --project … --coverlet …` passes options through in MTP mode; `dotnet format` skips generated code | Patterns 1, 16 | Wave 0 verification step |
| A15 | `AddCheck<T>(name, timeout:)` overload exists | Pattern 10 | Use `HealthCheckRegistration` directly |
| A16 | Two SPF records cause a permerror; the Permissions-Policy feature list is recognized by browsers | Patterns 4, 15 | Owner guidance only; Phase 2 Playwright catches console errors |
| A17 | SYSLIB0057 is the id for the obsolete `X509Certificate2` ctor | Pattern 9b | Irrelevant if the loader API is used |

## Open Questions (RESOLVED)

1. **Does the SmarterASP Basic account that will host CSPS also host the live legacy site and `csptailoringdb`?** RESOLVED: D-28 (owner).
   - Known: Basic = 1 MSSQL DB, unlimited sites, 256 MB pool [CITED], and the legacy site + DB are on SmarterASP.NET (PROJECT.md:81).
   - Unclear: whether it's the same account. If yes, there's no DB for CSPS before cutover, the FND-13 SQL facts can only come from read-only server-level queries on the legacy DB (owner approval needed), and the compat level of a *new* DB is unknowable until cutover. Phase 3 deploys also have nowhere to go without a plan change.
   - Recommendation: the FND-13 plan's first task is an owner question (`checkpoint:decision`). Record `Unverified` rather than probe the legacy DB. Test the idempotent script at both 160 and 170 so either host default is covered.
2. **Where may the HostProbe run?** RESOLVED: D-28 + plan 01-12 Task 1 checkpoint:decision (owner decides at execution time). It needs a separate site/subdomain in the account, and the owner must confirm it shares nothing with the legacy site's folder or app pool. Recommendation: owner-run, deleted after use, key-protected. If the owner declines, mark the runtime/IP/PFX facts `Unverified` and revisit before Phase 3.
3. **FND-04 scope in Phase 1.** RESOLVED: D-30 (owner). Users, orders, expenses and price list don't exist until Phases 4, 6, 7 and 11. Recommendation: Phase 1 ships the guarded tool, step framework and SiteSettings step. Mark FND-04 "established; extended per phase" in VERIFICATION, consistent with the ROADMAP's "Pieces that grow".
4. **Add `GET /api/v1/site-settings` (Staff) in Phase 1?** RESOLVED: D-29 (owner). It gives SEC-02 a non-anonymous matrix row and FND-05 a reliable 500 path. It's not in any requirement text. Recommendation: include it (small) or, if declined, prove the matrix with synthetic endpoints only.
5. **Application branch-coverage threshold.** RESOLVED (default): D-31. The gate is line ≥ 95%, branch not gated. This is the planner's default reading of QUAL-03, not an owner answer, and it differs from the recommendation below. D-17 says "Application ≥ 95%" without saying line or branch. Recommendation: line ≥ 95 **and** branch ≥ 95. Confirm cheaply at plan review.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | everything | ✓ | 10.0.401 | — |
| ASP.NET Core / .NET runtime | run/tests | ✓ | 10.0.12 | — |
| SQL Server LocalDB engine | dev DB, local tests | ✓ | 17.0.4025.3 (SQL Server 2025) | — |
| `(localdb)\CSPS` instance | dev/test DBs (D-05) | ✗ | — | Create: `sqllocaldb create CSPS -s` via idempotent `tools/scripts/Initialize-LocalDb.ps1` (allowed by PC-2) |
| dotnet-ef / reportgenerator / nuget-license | migrations, coverage, licenses | ✗ (no tools installed) | — | `dotnet tool restore` from `.config/dotnet-tools.json` (local, no machine change) |
| Docker | CI containers only | ✓ 29.8.1 | — | **Not used locally** (D-07, PC-3) |
| Windows PowerShell | scripts, preflight | ✓ | 5.1.26100 | Keep `.ps1` 5.1-compatible; pwsh 7 isn't installed |
| `C:\Work\dev-tools\preflight.ps1` | before full test runs (PC-4) | ✓ | — | Note: it lists `MSSQLLocalDB` databases, not `CSPS` |
| Node | Phase 2 only | ✓ | 24.21.0 | — |
| git | commits | ✓ | 2.56.0 | — |
| SmarterASP.NET control panel | FND-13 | owner only | — | Mark facts `Unverified` |

**Missing dependencies with no fallback:** none for code work. FND-13 depends on the owner.
**Missing dependencies with fallback:** the `CSPS` LocalDB instance and the local dotnet tools are created by scripts in Wave 0.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | xUnit v3 4.0.1 on Microsoft.Testing.Platform v2 (+ Shouldly 4.3.0, NSubstitute 6.2.0) |
| Config file | `global.json` (`"test": { "runner": "Microsoft.Testing.Platform" }`) plus per-project `OutputType Exe`. None exists yet: Wave 0 |
| Quick run command | `dotnet test --project tests/Csps.Domain.UnitTests` (swap in the project under change) |
| Full suite command | `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` then `dotnet test --solution Csps.slnx` |
| Coverage gate | `dotnet run tools/scripts/coverage-gate.cs` (Pattern 16) |
| Format gate | `dotnet format Csps.slnx --verify-no-changes` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-01 | Fresh `CSPS_Test_*` DB + `MigrateAsync` → all tables + SiteSettings row | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*MigrationTests"` | ❌ Wave 0 |
| FND-01 | `dotnet ef database update` on `CSPS_Dev` from clean clone | manual smoke | `dotnet tool restore && dotnet ef database update --project src/Csps.Infrastructure --startup-project src/Csps.Server` | n/a |
| FND-02 | slnx projects, scaffold absent, ports 5115/7028, no SpaProxy | arch (file) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*SolutionLayoutTests"` | ❌ Wave 0 |
| FND-03 | Layer rules, forbidden packages, referenced assemblies | arch | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*LayerTests"` | ❌ Wave 0 |
| FND-04 | Name guard refuses non-`CSPS_Dev/E2E`; SiteSettings seed step idempotent | unit + integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*DevSeed*"` | ❌ Wave 0 |
| FND-05 | `/api/*` 404 PD + traceId (any method, `Accept: text/html`); 401 PD; 500 PD "Reference:" no stack; Result→status mapping incl. `errors` | integration + unit | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ProblemDetails*"` | ❌ Wave 0 |
| FND-06 | `/health` 200 minimal body; 503 on DB down; no internals; anonymous | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*HealthEndpointTests"` | ❌ Wave 0 |
| FND-07 | Request log TraceId == PD traceId; masking rules (exact/suffix, not `StatusCode`); no file sink in Testing | unit + integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Logging*"` | ❌ Wave 0 |
| FND-08 | Manila boundaries under FakeTimeProvider; resolver fallback chain; RS0030 configured | unit (Domain) + arch | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*BusinessClock*"` | ❌ Wave 0 |
| FND-09 | Seeded values; cached (row change invisible until invalidate); invalidate → fresh | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*SiteSettingsReader*"` | ❌ Wave 0 |
| FND-10 | Append OK; UPDATE → 51000; DELETE → 51001; TRUNCATE fails (guard); purge flag allows only >2y rows; EF modify blocked; IP /24 /48 + mapped; UA family | integration + unit | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*AuditLog*"` and `--project tests/Csps.Domain.UnitTests --filter-class "*IpPrefix*"` | ❌ Wave 0 |
| FND-11 | Two classes get different `CSPS_Test_<guid>` DBs; Respawn clears data, keeps history/SiteSettings; name guard rejects `BetsLLC_*`, `CSPS_Dev` | integration + unit | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*SqlFixture*"` | ❌ Wave 0 |
| FND-12 | Idempotent script ×2 at 160 and 170; step-through from each previous migration; no pending model changes; no JSON mapping | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*MigrationScriptTests"` | ❌ Wave 0 |
| FND-13 | Hosting record complete (each row Verified/Unverified/N/A, required facts present) | manual (owner) + optional doc-lint arch test | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*HostingRecordTests"` | ❌ Wave 0 |
| QUAL-01 | Required props present; build has zero warnings; format clean; editorconfig migrations section | arch + build | `dotnet build Csps.slnx` && `dotnet format Csps.slnx --verify-no-changes` | ❌ Wave 0 |
| QUAL-03 | Domain 100/100, Application ≥ 95 or the gate exits non-zero | script | `dotnet run tools/scripts/coverage-gate.cs` | ❌ Wave 0 |
| QUAL-06 | Every package/tool in `docs/dependencies.json` with allowed license + cool-down status | arch (file) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*DependencyRegistryTests"` | ❌ Wave 0 |
| SEC-01 | Header set on 200/401/404/500/health; HSTS on https; no Server header; web.config removes headers; Production 404 for `/scalar` + `/openapi/v1.json` | integration + file | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SecurityHeaders*"` | ❌ Wave 0 |
| SEC-02 | Discovery: every endpoint has policy or allow-listed anon + matrix row; synthetic no-policy endpoint flagged; matrix theory with real JWTs | unit + integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Authorization*"` | ❌ Wave 0 |
| SEC-04 | Protect in host A / unprotect in host B; key XML encrypted; no "No XML encryptor" warning; missing cert fails startup outside Testing | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DataProtection*"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the quick run for the touched test project (< 30 s for unit projects; integration classes create one LocalDB DB each, roughly 3–8 s per class [ASSUMED]).
- **Per wave merge:** preflight + `dotnet test --solution Csps.slnx` + `dotnet format --verify-no-changes`.
- **Phase gate:** full suite + coverage gate green, plus the owner-filled HOSTING-RECORD reviewed, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `global.json`, `Directory.Build.props`, `Directory.Packages.props`, `.editorconfig`, `BannedSymbols.txt`, `.config/dotnet-tools.json`
- [ ] `tools/scripts/Initialize-LocalDb.ps1` (creates and starts `CSPS`; idempotent) and `Initialize-DevSecrets.ps1`
- [ ] Five test projects + `tests/Csps.Testing` (SqlServerInstance, CspsDatabase, CspsApiFactory, TestTokens, CollectingSink, test PFX)
- [ ] `tools/scripts/coverage-gate.cs`
- [ ] Verify A14 (MTP option pass-through, `dotnet format` and generated code) in the first plan

## Security Domain

`security_enforcement: true`, ASVS level 1, block on high (`.planning/config.json`).

### Applicable ASVS Categories (4.0.3 numbering)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Onion + ArchUnitNET; default-deny; dependency registry |
| V2 Authentication | partial | JwtBearer validation only (issuance/2FA in Phase 4); HS256 key ≥ 256 bit from secrets |
| V3 Session Management | no (Phase 4) | — |
| V4 Access Control | yes | Fallback policy + named policies + discovery matrix (CWE-862/863) |
| V5 Validation, Sanitization | partial | Typed route/query binding; FluentValidation arrives with the first command; no user input reaches raw SQL |
| V6 Stored Cryptography | yes | Data Protection keys encrypted by certificate (CWE-312); `RandomNumberGenerator` only (RS0030 bans `System.Random`) |
| V7 Error Handling & Logging | yes | ProblemDetails without internals (CWE-209/200); Serilog masking + JSON (CWE-532/117); append-only audit |
| V8 Data Protection | yes | IP truncation /24 /48, UA family only (RA 10173 minimization); no secrets in git (CWE-798) |
| V9 Communications | yes | HSTS, `upgrade-insecure-requests` (CWE-319) |
| V14 Configuration | yes | CSP/nosniff/Referrer/Permissions/COOP/frame-ancestors (CWE-79/1021); server headers removed; dev-only OpenAPI/Scalar; NuGetAudit as error + cool-down (CWE-1104/1395) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Endpoint added without policy | Elevation of privilege | Fallback deny + discovery test fails the build (SEC-02) |
| `AllowAnonymous` group swallowing protected routes | Elevation | Separate groups + allow-list test |
| Stack trace / exception text in 500 | Information disclosure | Generic 500 + traceId; developer page only in Development |
| Secrets/codes in logs; CRLF log forging | Information disclosure / Tampering | Masking enricher + destructuring policy; compact JSON |
| Audit row tamper / delete | Repudiation / Tampering | AFTER trigger + THROW; FK truncate guard; EF interceptor; residual `db_owner` risk documented |
| Spoofed `X-Forwarded-For` | Spoofing | No ForwardedHeaders until FND-13; test proves it's ignored |
| Key ring theft from DB | Information disclosure | Certificate-encrypted keys; PFX only in host secrets/user-secrets |
| Clickjacking / XSS via injected script | Tampering | `frame-ancestors 'none'`, `script-src 'self'`; Scalar dev-only with a per-request nonce |
| `/health` used for recon / DoS | Information disclosure / DoS | Minimal body; cheap checks; rate limit in Phase 4 |
| Supply-chain (fresh malicious release) | Tampering | 14-day cool-down, exact pins, lock files, NuGetAudit `all` as error |
| Test cleanup dropping another project's DB | Tampering (local) | `^CSPS_Test_[0-9a-f-]{36}$` guard + unit test; `(localdb)\CSPS` only |

**CWE IDs touched in Phase 1** (for `/gsd-secure-phase`): 79, 89, 117, 200, 209, 312, 319, 330/338, 400, 532, 798, 862, 863, 1021, 1104, 1333, 1395.

## Sources

### Primary (HIGH confidence)
- NuGet registration API (`api.nuget.org/v3/registration5-gz-semver2/…`): versions, publish dates, licenses and dependency groups for every package in this file (queried 2026-10-07)
- NuGet search API: downloads, owners, verified-prefix flags
- Package contents inspected this session: Scalar.AspNetCore 2.17.8 (embedded `scalar.js`, `WithNonce`, `DisableDefaultFonts`, `DisableTelemetry` XML docs), TngTech.ArchUnitNET.xUnitV3 0.13.4 (namespace), Testcontainers.MsSql 4.15.0 (ctor docs), Serilog.Sinks.File 7.0.0 (parameter docs), xunit.v3.extensibility.core 4.0.1 (fixture types), Microsoft.CodeAnalysis.BannedApiAnalyzers 5.6.0 (Roslyn 4.12 reference)
- Local probes: `dotnet --list-sdks/--list-runtimes`, `sqllocaldb info/versions`, time zone + PFX + en-PH probe (`tz.cs`), CPM NU1011 spike, EF 10.0.12 strict-build + migration + idempotent-script spike
- MCR tag list `mcr.microsoft.com/v2/mssql/server/tags/list`: `2025-CU9-ubuntu-24.04` present
- dotnet/aspnetcore source: `DataProtectionBuilderExtensions.cs` (decryption cert registration), `DefaultProblemDetailsWriter.cs` (traceId, Accept handling)
- jbogard/Respawn source: `SqlServerDbAdapter.cs` (DELETE statements)

### Secondary (MEDIUM confidence, official docs via WebFetch)
- https://xunit.net/docs/getting-started/v3/microsoft-testing-platform: MTP v2 setup, `global.json` runner
- https://github.com/coverlet-coverage/coverlet/blob/master/Documentation/Coverlet.MTP.Integration.md: options, threshold limitation
- https://github.com/danielpalme/ReportGenerator/wiki/Settings: `minimumCoverageThresholds`, PRO mention scope
- https://archunitnet.readthedocs.io/en/latest/guide/: loader/layer/rule usage
- https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/configuration/overview?view=aspnetcore-10.0: `SetApplicationName`, `UnprotectKeysWithAnyCertificate`
- https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-7.0/breaking-changes: triggers / `UseSqlOutputClause(false)`
- https://learn.microsoft.com/en-us/aspnet/core/performance/caching/hybrid?view=aspnetcore-10.0: tags, options, immutability
- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling-api?view=aspnetcore-10.0: ProblemDetails middleware, Accept fallback
- https://learn.microsoft.com/en-us/sql/t-sql/statements/truncate-table-transact-sql: TRUNCATE vs triggers/FK, permissions
- https://scalar.com/products/api-references/integrations/aspnetcore/integration: local assets, CDN fonts
- https://www.smarterasp.net/hosting_plans: Basic/Advance/Premium limits
- https://github.com/dotnet/aspnetcore/pull/58199: Program source generator (via search)

### Tertiary (LOW confidence)
- Web search on ReportGenerator PRO features (no PRO requirement found for thresholds; corroborated by the Settings wiki)

### Project documents read
- `.planning/phases/01-…/01-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` (Phase 1), `.planning/research/{STACK,ARCHITECTURE,PITFALLS,SUMMARY}.md`, `CSPS-PRD.md` (§0, §2, §3, §5.3–5.6, §11, §14, §15, §17–19, §22), `CSPS-UI-SPEC.md` §12, `CLAUDE.md`, `.claude/CLAUDE.md`, scaffold `launchSettings.json`, `.csproj`, `Program.cs`, `vite.config.js`, `.gitignore`, `C:\Work\dev-tools\preflight.ps1`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Every version, date and license was read from the registry today; cool-down applied mechanically; analyzer/SDK compatibility checked by reflection.
- Architecture: MEDIUM-HIGH. Key EF and build behaviours were proven in a local spike. ASP.NET middleware interplay (headers on 500, Activity trace ids, fallback/405) is [ASSUMED] and pinned by tests in the plan.
- Pitfalls: HIGH for the spike-verified ones (CA1861 glob, NU1011, idempotent-script layout, Respawn DELETE, OUTPUT clause); MEDIUM for the rest.
- Hosting: LOW until the owner completes FND-13 (by design).

**Research date:** 2026-10-07
**Valid until:** 2026-10-21 for versions (a servicing release is expected around 2026-10-13); 2026-11-06 for patterns.

# Phase 1: Hosting Verification & Backend Foundation - Context

*Created: 2026-10-07T06:45:19-05:00 · Updated: 2026-10-07T16:34:13-05:00*

**Gathered:** 2026-10-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a zero-warning onion API (`Csps.slnx`: Domain, Application, Infrastructure, Server, plus test projects and `tools/`). It must:

- run against an empty, EF-migrated `CSPS_` database
- carry the platform contract: ProblemDetails, `/health`, Serilog with correlation ids, strict security headers, default-deny authorization with a discovery-driven matrix test
- provide the shared primitives: business calendar, SiteSettings core with a cached port, append-only audit log, SQL test fixture

Alongside the API sits a verified SmarterASP.NET hosting record (FND-13).

Requirements: FND-01..13, QUAL-01, QUAL-03, QUAL-06, SEC-01, SEC-02, SEC-04.

Out of this phase: the web app (Phase 2), CI/deploy (Phase 3), auth and email sending (Phase 4).
</domain>

<decisions>
## Implementation Decisions

### Project-wide rule (from this discussion)
- **D-00:** **No paid licenses, tools or services.** Every package, tool and service must be free. The only paid items are the SmarterASP.NET hosting and the domain the owner already pays for. Allowed licenses: MIT, Apache-2.0, BSD, ISC, plus the S-5 exceptions below. This feeds Phase 3's C-27: on a private repo, use free substitutes for CodeQL and dependency-review (NuGetAudit as error, `npm audit`, license gates, gitleaks), or make the repo public. Never use GitHub Code Security.

### Locale & business clock (OD-1, OD-2)
- **D-01:** Currency and locale are PHP `₱` with `en-PH` formatting, for example `₱12,450.00` with a U+2212 minus and dates like `Oct 6, 2026`. Single currency, no conversion.
- **D-02:** The business time zone is `Asia/Manila`, stored in SiteSettings and **Manager-editable** later. The editing UI belongs to a later site-content phase. Phase 1 only builds the entity, seed and cached read port. `IBusinessCalendar` must read the zone from SiteSettings through the cached port, with an `Asia/Manila` fallback chain (IANA → Windows id) when the stored value can't be resolved. Cache invalidation on edit must be designed now. — **Reversibility:** costly. A later zone change shifts every "today", month and year bucket, so reports would re-bucket historical data.
- **D-03:** "Year" means the calendar year, Jan–Dec. There is no fiscal-year setting.
- **D-04:** The SiteSettings seed uses the real business name "Carmen's Stitch & Printing Services". Contact fields (email, phone, address, Facebook) keep the UI-spec placeholders, such as `[hello@yourdomain.ph]`, until the owner supplies real values.

### Local & test databases (C-20, C-28, C-29, C-30)
- **D-05:** Use a dedicated LocalDB instance named **`CSPS`** (`sqllocaldb create CSPS`), never the shared `MSSQLLocalDB` that TheBETSLLC uses. Dev DB: `(localdb)\CSPS` / `CSPS_Dev`. E2E DB: `CSPS_E2E`. Test DBs: `CSPS_Test_<guid>`. Cleanup code may drop only names matching `^CSPS_Test_[0-9a-f-]{36}$`. Named pipes only, so no ports.
- **D-06:** The legacy `.bak` will be restored as **`CSPS_Legacy_Restore`** (in the legacy-discovery phase), never over `CSPS_Dev`. The CLAUDE.md line is amended accordingly.
- **D-07:** The test fixture selects its backend from `CSPS_TEST_SQL=localdb|container`, set per process only. Local runs always use LocalDB, and Docker/Testcontainers never run locally. CI (ubuntu) uses Testcontainers with an explicit `mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04` image. No exception to the 49152–65535 rule is needed. Integration tests run in parallel with a database per class or collection, reset with Respawn.
- **D-08:** The dev seed is an **explicit command** in a `tools/` project, for example `dotnet run --project tools/Csps.DevSeed -- --reset`. It refuses any database not named `CSPS_Dev` or `CSPS_E2E`. Nothing seeds or migrates at app startup.

### Hosting record & email (C-45, FND-13, OD-12, C-31)
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

### Security & tooling (OD-13, C-32, S-3, S-4, S-5, S-10, S-11)
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

### Logging (FND-07)
- **D-21:** Production logs are Serilog compact JSON files in `{contentRoot}/logs` (outside `wwwroot`), with:
  - a daily roll
  - `retainedFileCountLimit: 30`
  - a 10 MB per-file cap, `shared: true` and `flushToDiskInterval`
  - the `logs` folder excluded from Web Deploy sync

  There is no DB sink, and logs mask passwords, codes, tokens and secrets.
- **D-22:** No error alerting in Phase 1, only logging. The decision is deferred.

### Health (FND-06)
- **D-23:** `/health` is **anonymous and public, with a minimal body**: overall status plus per-check name and status (liveness, DB reachable, time-zone resolvable). It never includes versions, connection strings, exception text or timings that reveal internals. Keep it cheap. There is no uptime monitor; the owner checks manually.

### Audit log (FND-10)
- **D-24:** The IP is stored **truncated**: IPv4 to /24 (for example `203.177.12.0`) and IPv6 to /48 (RA 10173 data minimization). The user-agent is stored as its family only.
- **D-25:** Retention is **8 months** (amended by D-32; originally 2 years). Phase 1 builds the append-only table and blocks UPDATE and DELETE at the DB level. The purge job, a short idempotent cron-triggered endpoint, comes in the hardening phase. Because shared hosting probably gives one `db_owner` login, `DENY` permissions likely won't stop the app user. The researcher should verify that a trigger-based block (INSTEAD OF / AFTER UPDATE, DELETE → THROW) works there, and design how the future purge legitimately bypasses it. — **Reversibility:** one-way. Once audit rows exist, weakening append-only guarantees undermines their evidentiary value.

### Errors (FND-05)
- **D-26:** API error titles and details are in **plain English** (en-PH), short and human, consistent with the UI-spec copy, for example "This order was changed by someone else."
- **D-27:** A production 500 returns a generic message plus the `traceId` as a reference, such as "Something went wrong. Reference: <traceId>". There is never a stack trace or exception text outside Development.

### Plan-phase answers (2026-10-07, after research)
- **D-28:** Treat the SmarterASP.NET Basic account as **the same account that holds the live legacy site and DB** (`csptailoringdb`), or unsure. Its one DB slot is taken. The FND-13 plan starts with an owner decision checkpoint. Host checks use **read-only** queries against the live DB (owner-approved, run by the owner), plus a throwaway probe app only where the owner allows a separate site. Any fact that can't be checked is marked **Unverified**, never guessed. Nothing is created, altered or deployed on the live DB or site.
- **D-29:** Phase 1 adds **`GET /api/v1/site-settings`**, protected by the Staff policy (Admin or Manager). It gives the authorization matrix a real protected endpoint and gives FND-05 a real path for error tests. Read-only; editing stays in a later phase.
- **D-30:** **FND-04 scope in Phase 1:** the guarded `tools/` dev-seed command (refuses any DB except `CSPS_Dev`/`CSPS_E2E`), the seed-step framework and a **SiteSettings step**. The users, orders (with children), company expenses and price-list steps are added by the phases that create those entities.
- **D-31:** **Application coverage gate is line ≥ 95% (branch not gated).** This is the planner's default reading of QUAL-03 ("Domain 100% line + branch, Application ≥ 95%" names branch only for Domain) and D-17. It is **not an owner answer**: research Open Question 5 recommended line + branch, and the owner was not asked. The owner may tighten it to line + branch later. That is a reversible one-line change to the gate script (`tools/scripts/Invoke-CoverageGate.ps1`, plan 01-11).
- **D-32:** **D-25 checkpoint answer (owner, 2026-10-07): audit entries older than 8 months may be deleted.** Mechanism is option-a: the AuditLog trigger refuses every UPDATE and every DELETE, except a DELETE on a connection that has set the read-only session flag `csps.audit_purge = 1` where every deleted row is older than 8 months (`DATEADD(month, -8, SYSUTCDATETIME())`). Recent rows can never be deleted, and nothing is ever editable. This replaces the 2-year retention from D-25 and the Phase 1 discussion. The purge job itself stays in the hardening phase. — **Reversibility:** one-way once real audit rows exist (Phase 4 onward).
- **D-33:** **Database version (owner, 2026-10-07, plan 01-13).** The hosting check found SQL Server 2022 (16.0.x, Web Edition). Asked which compatibility level to pin for it, the owner answered: "We will be using 2025, I will delete the current db hosting when we can and create sql server 2025 with my live data if thats possible please." So:
  - The target production database is **SQL Server 2025**. The owner intends to replace the current SQL Server 2022 database hosting and restore the live data onto SQL Server 2025.
  - Feasibility: restoring a 2022 backup onto 2025 is supported, and the compatibility level is raised after the restore. Still to verify with SmarterASP.NET: whether 2025 is offered on the plan and whether it costs extra (any cost is an owner decision under D-00).
  - The Basic plan allows only 1 database, so deleting the current one first would take the live legacy site down until the restore. Take a fresh backup first, and ask SmarterASP.NET about an in-place version upgrade or a temporary second database.
  - Timing: only during cutover planning and execution (Phases 15–17; only Phase 17 touches the live system), never before. The live site stays up (Prime Directive 1).
  - **No re-pin now.** `SqlCompatibility.Level` stays **160, provisional** (valid on both 2022 and 2025; the `model` level was Unverified). The idempotent script is proven at 160 and 170. Re-pin to **170** only after the SQL Server 2025 database exists and its level is verified. The CI Testcontainers image (SQL Server 2025) stays as planned and matches the target.
  - Email consequence: the domain's SPF ends in `-all` and DMARC is `p=reject`, so Phase 4 mail must go through SmarterASP.NET's mail servers (`include:_spf.site4now.net`) with aligned DKIM; any other sender is merged into the one existing SPF record, never added as a second record.
  — **Reversibility:** reversible until the cutover. The 2025 move itself touches the live database and is planned with the cutover runbook.

### Claude's Discretion
- The correlation-id header name and propagation (W3C `traceparent` vs `X-Correlation-Id`). Default to the Activity/W3C trace id surfaced as `traceId`.
- The exact `/health` JSON shape within D-23's limits.
- SiteSettings cache invalidation (HybridCache tags) and the shape of the business-calendar API.
- The project and test-project names within PRD §3.1.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & requirements
- `.planning/ROADMAP.md` § "Phase 1: Hosting Verification & Backend Foundation": goal, success criteria, owner decisions, research flag
- `.planning/REQUIREMENTS.md`: FND-01..13, QUAL-01, QUAL-03, QUAL-06, SEC-01, SEC-02, SEC-04 (and OPS-04, amended by D-11)
- `.planning/PROJECT.md`: constraints, OD-1..14, C-1..21

### Product spec
- `CSPS-PRD.md` §2 (stack), §3 / §3.1 / §3.2 / §3.3 (onion layout and rules), §5.6 (schema ownership), §11 / §11.3 / §11.4 (security headers, CSP, audit), §14 / §17 / §17.1 (quality gates), §19 / §19.1–19.3 (hosting, static caching, migrations, scheduled jobs)
- `CSPS-UI-SPEC.md` §12: dev-seed fake data shapes (FND-04)

### Research
- `.planning/research/SUMMARY.md`: S-1..S-11 and C-22..C-45 (especially C-28..C-32 and C-45)
- `.planning/research/STACK.md`: pinned versions, licenses and compatibility (apply D-19's 14-day cool-down when choosing versions)
- `.planning/research/ARCHITECTURE.md`: onion layout, fixture design and the compat-level discussion
- `.planning/research/PITFALLS.md`: Pitfalls 6, 7, 8, 16, 17 and 21 (Phase 1)

### Machine rules
- `CLAUDE.md` (root): ports, the `CSPS_` DB prefix, preflight, env-var rules
- `C:\Work\dev-tools\preflight.ps1`: run with `-Ports 5180,5115,7028,5199` before dev servers or full test runs
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None worth keeping. The VS template scaffold (`CarmensStitchAndPrintingServices.Server` with WeatherForecast, Controllers and SpaProxy; `carmensstitchandprintingservices.client` with `.esproj`) is replaced wholesale (D-20, FND-02).

### Established Patterns
- `Properties/launchSettings.json` already uses the right ports: http 5115, https 7028. Carry them over without the `ASPNETCORE_HOSTINGSTARTUPASSEMBLIES=...SpaProxy` env var.
- The scaffold's `vite.config.js` derives its proxy target from `env.ASPNETCORE_HTTPS_PORT`, which CLAUDE.md forbids relying on. Phase 2 replaces it with hard-coded ports.
- The scaffold already references `Microsoft.AspNetCore.OpenApi 10.0.12`, and SpaProxy with a floating version (to remove).
- `.gitignore` already excludes `_local/` and `appsettings.*.local.json`.

### Integration Points
- Docker 29.8 is installed, but per D-07 it is not used locally.
- LocalDB currently has only the shared `MSSQLLocalDB`. The `CSPS` instance must be created (document the setup step, and make it idempotent).
</code_context>

<specifics>
## Specific Ideas

- The owner explicitly asked for **Scalar** as the API docs viewer.
- The owner wants **everything free**: no paid licenses, tools or services (D-00).
- The hosting checklist should be copy-paste friendly. The owner runs it and pastes the results back.
</specifics>

<deferred>
## Deferred Ideas

- Error alerting (for example a throttled email on unhandled exceptions). Revisit in hardening, after SMTP exists (Phase 4).
- An uptime monitor. The owner declined for now, but it can be added free later (for example the UptimeRobot free tier).
- The audit-log purge job (8-month retention, D-32). Hardening phase, together with OD-10.
- The SiteSettings editing UI, including a Manager-editable time zone. Later site-content phase.
- Staging environment: re-enable if the hosting plan is upgraded from Basic (affects OPS-04, Phase 3).
- FND-04 seed steps for users (both roles), orders with all children, company expenses and the price list. Each is added by the phase that creates its entity (D-30).
- The exact sender domain name and SPF/DKIM/DMARC records. The owner supplies the legacy site domain; the checks finish at the end of FND-13 or before Phase 4. Update 2026-10-07: the domain is `cspstailoring.com` and its SPF and DMARC records are recorded in `.planning/HOSTING-RECORD.md`; the Gmail "Show original" pass check is still due before Phase 4.
- Moving the production database to SQL Server 2025 and re-pinning the compatibility level to 170 (D-33). Cutover planning (Phases 15–17).
</deferred>

---

*Phase: 01-hosting-verification-backend-foundation*
*Context gathered: 2026-10-07*

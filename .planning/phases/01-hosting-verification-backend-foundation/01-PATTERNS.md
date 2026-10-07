# Phase 1: Hosting Verification & Backend Foundation - Pattern Map

**Mapped:** 2026-10-07
**Files analyzed:** ~45 (grouped by area below; full tree in 01-RESEARCH.md "Recommended Project Structure")
**Analogs found:** 0 in-repo / all groups. This is a greenfield phase.

## Codebase state

The only code is the Visual Studio template scaffold, and it is **untracked** in git (`??` in status), so none of it is a valid analog under the tracked-source gate. This phase removes it:
- `CarmensStitchAndPrintingServices.slnx` (replaced by `/Csps.slnx`)
- `CarmensStitchAndPrintingServices.Server/` (WeatherForecast controller, `AddControllers`, SpaProxy) — replaced by `src/Csps.Server/`
- `carmensstitchandprintingservices.client/` (`.esproj`, JSX template) — the frontend is rebuilt in a later phase as `web/`

Every file below takes its pattern from **01-RESEARCH.md**, not from the codebase.

## Carry over from the scaffold (values only, not files)

| Value | Source | Destination |
|-------|--------|-------------|
| API ports `http://localhost:5115`, `https://localhost:7028;http://localhost:5115`, profiles `http`/`https`, `launchBrowser: false` | `CarmensStitchAndPrintingServices.Server/Properties/launchSettings.json` | `src/Csps.Server/Properties/launchSettings.json` (keep `ASPNETCORE_ENVIRONMENT: Development` there, which is per-process and allowed) |
| Vite `port: 5180`, `strictPort: true`, proxy target default `https://localhost:7028` | `carmensstitchandprintingservices.client/vite.config.js` | Record for the later `web/` phase. Drop the `env.DEV_SERVER_PORT` / `ASPNETCORE_HTTPS_PORT` / `ASPNETCORE_URLS` overrides, or at least never set them machine-wide |
| `<TargetFramework>net10.0</TargetFramework>`, `Nullable`, `ImplicitUsings` | scaffold `.csproj` | Move into `/Directory.Build.props` (Pattern 1) |

## Do NOT carry over

- `ASPNETCORE_HOSTINGSTARTUPASSEMBLIES: Microsoft.AspNetCore.SpaProxy` in launchSettings, plus `SpaRoot`/`SpaProxy*` properties and the `Microsoft.AspNetCore.SpaProxy` `10.*-*` package (forbidden, and a floating version).
- The `.esproj` project and its `ProjectReference` from the server csproj.
- `AddControllers`/`MapControllers`/`WeatherForecast*` (Minimal APIs only).
- Unconditional `UseDefaultFiles`/`MapStaticAssets`/`MapFallbackToFile` (SPA hosting is decided in a later phase).
- `Microsoft.AspNetCore.OpenApi` pinned at `10.0.12` directly in the csproj: move it to `Directory.Packages.props` and recheck the 14-day cool-down.
- `CarmensStitchAndPrintingServices.Server.http`, `.csproj.user`, the template `CHANGELOG.md` files.

## File Classification

| New/Modified File(s) | Role | Data Flow | Analog | Reference |
|---|---|---|---|---|
| `/global.json`, `/Directory.Build.props`, `/Directory.Packages.props`, `/BannedSymbols.txt`, `/.editorconfig`, `/.config/dotnet-tools.json`, `/Csps.slnx` | config | build | none | RESEARCH Pattern 1, Standard Stack, Pitfall 4 (generated-code glob), Pitfall 7 (cool-down) |
| `/docs/dependencies.json` | config | n/a | none | Pattern 13, Package Legitimacy Audit |
| `src/Csps.Domain/Common/Result.cs`, `Error.cs` | model | transform | none | Pattern 3 |
| `src/Csps.Domain/Time/*` | utility | transform | none | Pattern 8 |
| `src/Csps.Domain/Content/SiteSettings.cs` | model | CRUD | none | Pattern 6 |
| `src/Csps.Domain/Auditing/*` (AuditEntry, IpPrefix, UserAgentFamily) | model | transform | none | Pattern 9 |
| `src/Csps.Application/Ports/*`, `Security/*`, `Auditing/AuditActions.cs` | service (ports) | request-response | none | Patterns 2, 7, 8, 9 |
| `src/Csps.Infrastructure/Persistence/CspsDbContext.cs`, `Configurations/*`, `Migrations/*` | model / migration | CRUD | none | Patterns 6, 9, 12; Pitfalls 2, 3 |
| `src/Csps.Infrastructure/Content/SiteSettingsReader.cs` | service | CRUD + cache | none | Pattern 7 |
| `src/Csps.Infrastructure/Time/BusinessCalendar.cs` | service | transform | none | Pattern 8 |
| `src/Csps.Infrastructure/Auditing/AuditTrail.cs` | service | append-only write | none | Pattern 9 |
| `src/Csps.Infrastructure/Health/*` | service | request-response | none | Pattern 10 |
| `src/Csps.Infrastructure/DataProtection/CertificateLoader.cs` | utility | file-I/O | none | Pattern 9b |
| `src/Csps.Infrastructure/DependencyInjection.cs` | config | n/a | none | Code Examples "Minimal Program.cs shape" |
| `src/Csps.Server/Program.cs` (+ `Composition/`) | config (composition root) | request-response | none (scaffold is the wrong shape) | Code Examples "Minimal Program.cs shape" |
| `src/Csps.Server/Http/SecurityHeadersMiddleware.cs` | middleware | request-response | none | Pattern 4, Pitfall 10 |
| `src/Csps.Server/Http/ProblemDetailsSetup.cs` | middleware | request-response | none | Pattern 3, Pitfall 5 |
| `src/Csps.Server/Http/RequestContext.cs` | service | request-response | none | Pattern 9 |
| `src/Csps.Server/Endpoints/*` (ApiRouting, SiteSettingsEndpoints, HealthEndpoint) | route | request-response | none | Patterns 2, 7, 10 |
| `src/Csps.Server/Logging/SensitiveDataMasking.cs` | utility | transform | none | Pattern 5 |
| `src/Csps.Server/web.config`, `Properties/launchSettings.json` | config | n/a | launchSettings values from scaffold (see above) | Pattern 4 |
| `tests/Csps.Testing/*` (SqlFixture, Respawn wrapper, TestTokens, CspsApiFactory, CollectingSink) | test utility | n/a | none | Patterns 11, 2; Code Examples "Test JWT minting"; Pitfall 1 |
| `tests/Csps.*.UnitTests`, `*.IntegrationTests`, `Csps.ArchitectureTests` | test | n/a | none | Patterns 2, 12, 13; Validation Architecture test map |
| `tools/Csps.DevSeed/*` | utility (CLI) | batch | none | Pattern 14 |
| `tools/Csps.HostProbe/*` | utility (throwaway) | request-response | none | Pattern 15 |
| `tools/scripts/*.ps1` (Initialize-LocalDb, Initialize-DevSecrets, Remove-StaleTestDatabases, coverage gate) | utility | batch | none | Patterns 11, 16; CLAUDE.md LocalDB/cleanup regex |
| `.planning/HOSTING-RECORD.md` | doc | n/a | none | Pattern 15 |

## Shared Patterns (all from RESEARCH.md; apply across plans)

- **Strict build / zero warnings:** Pattern 1 — every project inherits from `Directory.Build.props`; no per-project overrides.
- **Errors:** Pattern 3 — handlers return `Result<T>`; endpoints map to RFC 9457 ProblemDetails; production 500 text "Something went wrong. Reference: <traceId>".
- **Authorization:** Pattern 2 — fallback policy denies by default; every endpoint enters the discovery-driven matrix test (anonymous/Admin/Manager).
- **Time:** inject `TimeProvider` / `IBusinessCalendar`; never `DateTime.Now` (banned in `BannedSymbols.txt`).
- **Persistence:** Fluent config only, no JSON columns, `rowversion` per aggregate, compat level 160, no migrate/seed at startup (Patterns 6, 12, 14).
- **Logging:** Pattern 5 — Serilog compact JSON in `{contentRoot}/logs`, 30 days, masking; tests must not write logs into the repo (Pitfall 8).
- **Test DB:** Pattern 11 — `CSPS_TEST_SQL=localdb|container` per process, `(localdb)\CSPS`, `CSPS_Test_<guid>` names only.

## No Analog Found

All files. The planner should use the RESEARCH.md pattern listed per row above. No existing code reflects the target architecture.

## Metadata

**Analog search scope:** repo root, `CarmensStitchAndPrintingServices.Server/`, `carmensstitchandprintingservices.client/` (excluding node_modules/bin/obj). `_local/` not read.
**Files scanned:** 5 (launchSettings.json, Program.cs, server .csproj, vite.config.js, .slnx)
**Pattern extraction date:** 2026-10-07

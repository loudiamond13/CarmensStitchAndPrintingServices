---
phase: "1"
slug: "hosting-verification-backend-foundation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-07"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `01-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | xUnit v3 4.0.1 on Microsoft.Testing.Platform v2 (+ Shouldly 4.3.0, NSubstitute 6.2.0) |
| **Config file** | `global.json` (`"test": { "runner": "Microsoft.Testing.Platform" }`) + per-project `OutputType Exe` — none yet, Wave 0 installs |
| **Quick run command** | `dotnet test --project tests/<project under change>` |
| **Full suite command** | `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` then `dotnet test --solution Csps.slnx` |
| **Coverage gate** | `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` (plan 01-11; PowerShell instead of a file-based app so repo-wide props/CPM cannot interfere) |
| **Format gate** | `dotnet format Csps.slnx --verify-no-changes` |
| **Estimated runtime** | unit projects < 30 s; integration ≈ 3–8 s per class (one LocalDB DB per class) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the touched test project
- **After every plan wave:** Run preflight + `dotnet test --solution Csps.slnx` + `dotnet format Csps.slnx --verify-no-changes`
- **Before `/gsd-verify-work`:** Full suite + coverage gate green, owner-filled HOSTING-RECORD reviewed
- **Max feedback latency:** 120 seconds

---

## Per-Requirement Verification Map

Task IDs are bound by the planner in each PLAN.md `<verify>` block; this map fixes the command per requirement.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| FND-01 | Fresh `CSPS_Test_*` DB + `MigrateAsync` → all tables + SiteSettings row | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*MigrationTests"` | ❌ W0 | ⬜ pending |
| FND-02 | slnx projects, scaffold absent, ports 5115/7028, no SpaProxy | arch (file) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*SolutionLayoutTests"` | ❌ W0 | ⬜ pending |
| FND-03 | Layer rules, forbidden packages, referenced assemblies | arch | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*LayerTests"` | ❌ W0 | ⬜ pending |
| FND-04 | Name guard refuses non-`CSPS_Dev/E2E`; SiteSettings seed step idempotent | unit + integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*DevSeed*"` | ❌ W0 | ⬜ pending |
| FND-05 | `/api/*` 404 PD + traceId; 401 PD; 500 PD "Reference:" no stack; Result→status mapping | integration + unit | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ProblemDetails*"` | ❌ W0 | ⬜ pending |
| FND-06 | `/health` 200 minimal body; 503 on DB down; no internals; anonymous | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*HealthEndpointTests"` | ❌ W0 | ⬜ pending |
| FND-07 | Log TraceId == PD traceId; masking rules; no file sink in Testing | unit + integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Logging*"` | ❌ W0 | ⬜ pending |
| FND-08 | Manila boundaries under FakeTimeProvider; resolver fallback; RS0030 configured | unit + arch | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*BusinessClock*"` | ❌ W0 | ⬜ pending |
| FND-09 | Seeded values; cached; invalidate → fresh | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*SiteSettingsReader*"` | ❌ W0 | ⬜ pending |
| FND-10 | Append OK; UPDATE/DELETE/TRUNCATE fail; purge only >2y; IP /24 /48 | integration + unit | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*AuditLog*"` and `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*IpPrefix*"` | ❌ W0 | ⬜ pending |
| FND-11 | Per-class `CSPS_Test_<guid>` DBs; Respawn reset; name guard rejects `BetsLLC_*`, `CSPS_Dev` | integration + unit | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*SqlFixture*"` | ❌ W0 | ⬜ pending |
| FND-12 | Idempotent script ×2 at 160 and 170; step-through; no pending model changes; no JSON | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*MigrationScriptTests"` | ❌ W0 | ⬜ pending |
| FND-13 | Hosting record complete (each row Verified/Unverified/N/A) | doc-lint arch | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*HostingRecordTests"` | ❌ W0 | ⬜ pending |
| QUAL-01 | Zero warnings; format clean; editorconfig migrations section | build + arch | `dotnet build Csps.slnx` && `dotnet format Csps.slnx --verify-no-changes` | ❌ W0 | ⬜ pending |
| QUAL-03 | Domain 100/100, Application ≥ 95 or gate exits non-zero | script | `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` (plan 01-11; PowerShell instead of a file-based app so repo-wide props/CPM cannot interfere) | ❌ W0 | ⬜ pending |
| QUAL-06 | Every package/tool in `docs/dependencies.json` with allowed license + cool-down | arch (file) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*DependencyRegistryTests"` | ❌ W0 | ⬜ pending |
| SEC-01 | Header set on 200/401/404/500/health; HSTS; no Server header; Production 404 for `/scalar` | integration + file | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SecurityHeaders*"` | ❌ W0 | ⬜ pending |
| SEC-02 | Discovery: every endpoint has policy or allow-listed anon + matrix row | unit + integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Authorization*"` | ❌ W0 | ⬜ pending |
| SEC-04 | Protect in host A / unprotect in host B; key XML encrypted; missing cert fails startup | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DataProtection*"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `global.json`, `Directory.Build.props`, `Directory.Packages.props`, `.editorconfig`, `BannedSymbols.txt`, `.config/dotnet-tools.json`
- [ ] `tools/scripts/Initialize-LocalDb.ps1` (creates and starts `CSPS`; idempotent) and `Initialize-DevSecrets.ps1`
- [ ] Five test projects + `tests/Csps.Testing` (SqlServerInstance, CspsDatabase, CspsApiFactory, TestTokens, CollectingSink, test PFX)
- [ ] `tools/scripts/Invoke-CoverageGate.ps1` (plan 01-11)
- [ ] Verify research assumption A14 (MTP option pass-through, `dotnet format` and generated code) in the first plan

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `dotnet ef database update` on `CSPS_Dev` from a clean clone | FND-01 | Developer-machine smoke against the dev DB | `dotnet tool restore && dotnet ef database update --project src/Csps.Infrastructure --startup-project src/Csps.Server` |
| SmarterASP.NET host facts (runtime patch, `@@VERSION`, compat level, collation, in-process, proxy/IP, SPF/DKIM/DMARC, scheduler, quota) | FND-13 | Owner runs the hosting checklist and pastes results | Owner fills HOSTING-RECORD; doc-lint test confirms each row is Verified/Unverified/N/A |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

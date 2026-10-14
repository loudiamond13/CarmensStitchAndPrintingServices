---
quick_id: 261014-bxi
mode: quick
created: 2026-10-14T08:40:00-05:00
updated: 2026-10-14T08:40:00-05:00
---

# Quick 261014-bxi: Resolve Copilot review on PR #1, then merge dev → main and retire dev

Copilot left 7 findings on PR loudiamond13/CarmenStitchAndPrintingServices#1. Triage (orchestrator):

| # | Finding | Verdict | Reason |
|---|---------|---------|--------|
| 0 | Audit purge cutoff 8 months → 2 years | Reject | Owner decision D-32 (2026-10-07) set retention to 8 months. Root cause: CLAUDE.md still said "2-year" (01-REVIEW IN-09). Fix CLAUDE.md. |
| 1 | Mask Identity `PasswordHash`, `SecurityStamp` | Accept | Neither matches exact names or suffixes; Identity lands in Phase 3. |
| 2 | `/health` matches every HTTP method | Accept | Restrict to GET/HEAD; matrix lists both explicitly. |
| 3 | Correlation fallback not W3C | Accept | Fallback must be a stable 32-hex id per request. |
| 4 | 30-file cap vs 30-day retention | Reject | D-21 locks `retainedFileCountLimit: 30` (storage bound on shared hosting). |
| 5, 6 | `ContentType?.` assertions skip when header missing | Accept | Use `ShouldNotBeNull()`. |

## Task 1: Code fixes (TDD: red → green)

- `src/Csps.Server/Logging/SensitiveDataMasking.cs` + its tests: add `PasswordHash`, `SecurityStamp` to exact names.
- `src/Csps.Server/Endpoints/HealthEndpoint.cs`: add GET/HEAD method metadata. Update authorization matrix/coverage tests (`* /health` → `GET /health`, `HEAD /health`). Add test: POST /health → 405.
- `src/Csps.Server/Http/CorrelationId.cs` + tests: when no Activity, return `ActivityTraceId.CreateRandom().ToHexString()` cached in `HttpContext.Items` (stable per request).
- `tests/Csps.Server.IntegrationTests/Health/*.cs`: replace every `ContentType?.MediaType.ShouldBe(` with `ContentType.ShouldNotBeNull().MediaType.ShouldBe(` (repo-wide in tests).

Verify: `dotnet build` zero warnings; affected test projects pass (LocalDB, preflight first).

## Task 2: Docs

- Root `CLAUDE.md` Audit/logs bullet: "8-month audit retention (D-32)".

## Task 3: GitHub (orchestrator)

Reply to and resolve all 7 threads, merge PR #1 into dev, PR dev → main and merge, set default branch to main, delete dev (local + remote), retarget nothing else.

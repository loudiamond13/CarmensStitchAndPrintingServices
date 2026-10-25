---
phase: "06"
slug: "company-expenses"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-25T03:08:22-05:00"
updated: "2026-10-25T03:08:22-05:00"
---

# Phase 06: Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `06-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | .NET: xunit.v3 on MTP, Shouldly, NSubstitute, FakeTimeProvider, Respawn, ArchUnitNET, coverlet.MTP. Web: Vitest + RTL + jsdom + in-house axe matcher, MSW, Playwright + @axe-core/playwright |
| **Config file** | `global.json`, `web/vitest.config.ts`, `web/src/test/setup.ts`, `web/playwright.config.ts` |
| **Quick run command** | `dotnet test --project tests/<Project> --filter-class "*<Class>"` · `npm --prefix web run test -- --run <path>` |
| **Full suite command** | preflight, then `dotnet test --solution Csps.slnx` (`CSPS_TEST_SQL=localdb` in that process only), `tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e` |
| **Estimated runtime** | ~30 s per filtered class; full suite several minutes |

---

## Sampling Rate

- **After every task commit:** the touched class via `--filter-class`, or `npm --prefix web run test -- --run <path>`
- **After every plan wave:** preflight, `dotnet test --solution Csps.slnx`, `npm --prefix web run verify`
- **Before `/gsd-verify-work`:** full suite, coverage gate and e2e on all engines must be green, zero warnings
- **Max feedback latency:** ~60 seconds per task check

---

## Per-Task Verification Map

Requirement-level map from research. The planner's tasks fill the Task ID column.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CEXP-01 | — | Search treats `%` and `_` literally; deleted rows excluded | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ListCompanyExpensesEndpointTests"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CEXP-02 | — | Amount > 0 and ≤ ₱1,000,000.00 on client and server (D-21, D-33) | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*CompanyExpenseTests"` | ❌ | ⬜ pending |
| TBD | TBD | TBD | CEXP-02 / SEC-07 | — | Stale rowversion gives 409 `edit.stale`, never overwrites | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CompanyExpenseConcurrencyTests"` | ❌ | ⬜ pending |
| TBD | TBD | TBD | CEXP-02 / D-01..D-07 | — | Delete, restore, permanent delete Manager-only (403 for Admin) | integration + matrix | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CompanyExpenseDeletionTests"` | ❌ | ⬜ pending |
| TBD | TBD | TBD | CEXP-02 / D-26 | — | Admin edits only own (recorded or paid) expenses | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*UpdateCompanyExpenseEndpointTests"` | ❌ | ⬜ pending |
| TBD | TBD | TBD | CEXP-03 | — | 2026-10-31T23:00Z counts as November (Manila) | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CompanyExpenseKpisTests"` | ❌ | ⬜ pending |
| TBD | TBD | TBD | CEXP-04 / SEC-08 | — | Forged attribution fields ignored; names survive user deletion | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CompanyExpenseAttributionTests"` | ❌ | ⬜ pending |
| TBD | TBD | TBD | CEXP-05 | — | Payer must be active, signed-in staff (D-32); payer change audited | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CompanyExpensePayerTests"` | ❌ | ⬜ pending |
| TBD | TBD | TBD | PERF-04 | — | Fixed command count at page size 10 and 100 | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CompanyExpenseReaderQueryCountTests"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PERF-04 / D-28 | — | p95 < 300 ms on ~5 years of fake data | timing | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ExpenseListTimingTests"` | ❌ | ⬜ pending |
| TBD | TBD | TBD | OR-7 | — | Still only `TR_AuditLog_AppendOnly` | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*TriggerInventoryTests"` | ✅ | ⬜ pending |
| TBD | TBD | TBD | UI / a11y | — | Axe-clean, no sideways scroll 320 to 1920, CSP clean | E2E | `npm --prefix web run e2e -- --grep @expenses` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/Csps.Testing/CommandCounter.cs` and a `CspsDatabase.CreateContext(params IInterceptor[])` overload (query-count guard)
- [ ] Category reseed after `CspsDatabase.ResetAsync` from `ExpenseCategorySeed` (Respawn wipes `HasData` rows)
- [ ] `tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseFixtures.cs`, modelled on `Users/UserFixtures.cs`
- [ ] Timing-test class fixture with its own database and bulk data builder
- [ ] Web: MSW handlers for the new services; showcase fixtures with long descriptions and names

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live p95 from request logs after release | PERF-04 / D-28 | No staging site; live data only exists in production | Read the Serilog request log elapsed times for `/api/v1/company-expenses` after the first week |
| New and amended copy | D-48 (05) | Owner reviews copy before release | Owner reads the expense pages and dialogs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

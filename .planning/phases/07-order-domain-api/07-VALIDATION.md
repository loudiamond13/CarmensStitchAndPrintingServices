---
phase: "07"
slug: "order-domain-api"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-28T09:30:00-05:00"
updated: "2026-10-28T09:30:00-05:00"
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `07-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | xUnit v3 4.0.1 on Microsoft.Testing.Platform, Shouldly 4.3.0, NSubstitute 6.2.0, FakeTimeProvider |
| **Config file** | `global.json` (`"runner": "Microsoft.Testing.Platform"`), `tests/Directory.Build.props` |
| **Quick run command** | `dotnet test --project tests/Csps.Domain.UnitTests` |
| **Focused integration** | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Order*"` |
| **Full suite command** | preflight, then `dotnet test --solution Csps.slnx`, plus `npm --prefix web run test` and `npm --prefix tools/openapi-gen run check` when the contract changes |
| **Estimated runtime** | quick ~15 s; focused integration ~120 s; full ~10 min |

---

## Sampling Rate

- **After every task commit:** the quick command for the layer touched (Domain or Application unit tests, or one integration class).
- **After every plan wave:** preflight, then `dotnet test --project tests/Csps.Server.IntegrationTests` and `dotnet test --project tests/Csps.Infrastructure.IntegrationTests`.
- **Before `/gsd-verify-work`:** full suite green, plus `dotnet format --verify-no-changes`.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

Filled in by the planner per task. Requirement-level map from research:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| ORD-20 | ORD-2026-0148 and all v2 vectors exact; refunds and credit math | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderMath*"` | ✅ extend | ⬜ pending |
| ORD-05 | every mutation recomputes the snapshot; snapshot equals recompute from children | unit + integration | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderTests*"` | ❌ W0 | ⬜ pending |
| ORD-05 / D-11 / D-12 | payment above balance refused; item and discount changes may create credit; discounts never above subtotal | unit + endpoint | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderPayment*"` | ❌ W0 | ⬜ pending |
| ORD-03 | full-aggregate create in one transaction; a failure leaves nothing behind | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CreateOrderEndpoint*"` | ❌ W0 | ⬜ pending |
| ORD-14 | 20 parallel creates give 20 distinct, contiguous numbers; New Year in Manila | integration (race) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderNumbering*"` | ❌ W0 | ⬜ pending |
| ORD-08 | same-version edits give one 200 and one 409, including child-only edits | integration (race) | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderConcurrency*"` | ❌ W0 | ⬜ pending |
| ORD-16 / ORD-17 | transition table, history rows, reopen recorded | unit + endpoint | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderStatus*"` | ❌ W0 | ⬜ pending |
| ORD-18 | cancelled-order payments and refunds per policy | unit + endpoint | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderRefund*"` | ❌ W0 | ⬜ pending |
| ORD-21 | `Order.Import` accepts legacy shapes per rule constant | unit + infra | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderImport*"` | ❌ W0 | ⬜ pending |
| ORD-22 / ORD-23 | receiver, payer and refunder must be active Admin or Manager; change audited | endpoint | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderPeople*"` | ❌ W0 | ⬜ pending |
| ORD-13 / D-16 to D-19 | three editable lists: CRUD, unique names, in-use protection, seeds | endpoint + migration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*PaymentMethods*"` | ❌ W0 | ⬜ pending |
| D-26 to D-29 | soft delete, restore, permanent delete | endpoint | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderDeletion*"` | ❌ W0 | ⬜ pending |
| D-31 | every event audited in the same save | endpoint + unit | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderAudit*"` | ❌ W0 | ⬜ pending |
| SEC-02 | every new action has an authorization-matrix row | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Authorization*"` | ✅ add rows | ⬜ pending |
| SEC-06 | every new POST requires `Idempotency-Key` | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderIdempotency*"` | ❌ W0 | ⬜ pending |
| SEC-08 | forged CreatedBy/UpdatedBy ignored; child change stamps the order | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderAttribution*"` | ❌ W0 | ⬜ pending |
| PERF-04 | list in two commands; p95 ≤ 300 ms | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderList*"` | ❌ W0 | ⬜ pending |
| Schema | migrations apply; no new trigger; no inline SQL | infra + arch | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*Migration*"` | ✅ extend | ⬜ pending |
| Contract | OpenAPI snapshot and generated types match | integration + node | `npm --prefix tools/openapi-gen run check` | ✅ regenerate | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/Csps.Testing/ConcurrentRequests.cs`: N-way `SendAllTogetherAsync` for the 20-parallel-create test
- [ ] `tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs`: valid full-aggregate body, the ORD-2026-0148 body, helpers
- [ ] Domain test files: `OrderTests`, `OrderStatusRulesTests`, `OrderImportTests`, `OrderNumberTests`, list entry tests
- [ ] Optional testing-only order seeder (Debug + Testing only, like `TestingExpensesController`)
- [ ] Order timing data generator (copy `ExpenseTimingData`)
- [ ] `npm ci` in `web/` and `tools/openapi-gen/` in this worktree before the contract check

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

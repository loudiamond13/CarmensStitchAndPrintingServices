---
phase: "07"
slug: "order-domain-api"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-28T03:30:00-05:00"
updated: "2026-10-28T06:00:00-05:00"
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

Per task (planner, 2026-10-28). Each command is the task's primary `<automated>` check; the plan lists the rest. Integration commands run after the preflight. `dotnet test --project tests/<Project> --filter-class "<Class>"` is shortened to `<Project>: <Class>`.

| Plan-Task | Requirement / Decision | Primary check | Wave 0 file |
|-----------|------------------------|---------------|-------------|
| 07-01-T1 | ORD-13, D-18 | Server: `*ListOrderListsEndpointTests` | new |
| 07-01-T2 | D-16, D-17, D-19 | Infra: `*OrderListsMigrationTests`; Domain: `*OrderList*` | new |
| 07-01-T3 | D-31 | Domain: `*AuditActionsTests`; `npm --prefix web run test -- --run src/modules/admin/auditCopy.test.ts` | extend |
| 07-02-T1 | ORD-20 | Domain: `*OrderMath*` | new `OrderMathRefundTests` |
| 07-02-T2 | D-12, D-13, D-36 | Domain: `*OrderMath*`; coverage gate | extend |
| 07-03-T1 | D-01, D-03 | Domain: `*OrderStatusRulesTests` | new |
| 07-03-T2 | ORD-17, D-02, D-04, D-38 | Domain: `*OrderStatusRulesTests` | extend |
| 07-04-T1/T3 | D-33, amendments | `grep` checks on `07-AMENDMENTS.md`, `ROADMAP.md` (owner checkpoint between) | n/a |
| 07-05-T1 | ORD-03, ORD-14 | Server: `*CreateOrderEndpointTests`; Infra: `*OrdersMigrationTests` | new `OrderFixtures` |
| 07-05-T2 | D-21, D-22, D-30 | Domain: `*Order*`; App: `*Order*` | new |
| 07-05-T3 | D-31, SEC-06, SEC-08 | Server: `*OrderAttributionTests`; Infra: `*OrderModelTests` | new |
| 07-06-T1 | ORD-14 | Server: `*OrderNumberingTests` | new N-way `ConcurrentRequests` |
| 07-06-T2 | D-23, ORD-03 | Infra: `*OrderNumberAllocatorTests` | new |
| 07-07-T1..T3 | ORD-05, ORD-08, D-25 | Server: `*UpdateOrderDetailsEndpointTests`, `*OrderConcurrencyTests` | new |
| 07-08-T1..T2 | D-37 | Infra: `*LegacyHolderMigrationTests`; Server: `*LegacyHolderHiddenTests` | new |
| 07-09-T1..T3 | ORD-05, ORD-08, ORD-13 | Server: `*OrderItemsEndpointTests`, `*OrderConcurrencyTests` | new |
| 07-10-T1..T3 | ORD-05, D-15 | Server: `*OrderDiscountsEndpointTests`; Domain: `*OrderDiscountTests` | new |
| 07-11-T1..T3 | ORD-08, ORD-22, D-11, D-12 | Server: `*OrderPaymentsEndpointTests`, `*OrderPeopleTests`, `*OrderConcurrencyTests` | new |
| 07-12-T1..T3 | ORD-20, ORD-23 | Server: `*OrderExpensesEndpointTests`, `*CreateOrderEndpointTests` | new |
| 07-13-T1..T3 | ORD-16, ORD-17, D-05 | Server: `*OrderStatusEndpointTests`, `*OrderLockTests` | new |
| 07-14-T1..T3 | ORD-18, D-34, D-35, D-36 | Server: `*OrderRefundsEndpointTests`; Domain: `*OrderRefundTests` | new |
| 07-15-T1..T3 | D-26 to D-29 | Server: `*OrderDeletionTests` | new |
| 07-16-T1..T3 | ORD-01/02 (server), PERF-04 | Server: `*ListOrdersEndpointTests`, `*OrderListQueryCountTests`, `*OrderListTimingTests` | new timing data |
| 07-17-T1..T3 | ORD-13, D-19 | Server: `*OrderListsManagementTests`; Infra: `*OrderListStoreTests` | new |
| 07-18-T1..T3 | ORD-21, ORD-14 | Server: `*ImportOrderEndToEndTests`; Domain: `*OrderImportTests` | new |
| 07-19-T1..T3 | ORD-22, ORD-23, D-31 | Server: `*OrderAuditViewerTests`; App: `*AuditChangeLinesTests` | new |
| 07-20-T1..T2 | ORD-20, ORD-21 | Infra: `*OrdersSeedStepTests`; Server: `*TestingOrdersTests` | new testing seeder |

Requirement-level map from research:

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

---

## Plan Check Outcomes (2026-10-28)

The plan checker found 0 blockers, 1 warning and 2 info items. Each one has a recorded outcome:

| Finding | Outcome |
|---------|---------|
| Warning: plans 07-05, 07-11, 07-12, 07-01, 07-10, 07-17 and 07-14 list many files (38 to 59), mostly generated migrations, the OpenAPI contract and tests | Accepted as is. Each plan is one vertical slice and carries a scope note. If an executor runs short of context, split 07-05 at its Task 1 / Task 2 line. |
| Info: 07-04 Task 3 waits on the owner checkpoint; no other plan depends on it | No change. Phase 7 is not complete until 07-04 Task 3 is done or the owner rules otherwise. |
| Info: one-way tasks in 07-01, 07-05, 07-14 and 07-15 have no extra checkpoint | No change. Each cites the owner ruling that already covers it (D-07, D-16 to D-18, D-23, D-26 to D-28). The migrations only add tables and columns. |

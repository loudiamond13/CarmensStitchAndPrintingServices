---
phase: "08"
slug: "order-screens"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-29T12:00:00-05:00"
updated: "2026-10-29T12:00:00-05:00"
---

# Phase 08: Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `08-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Web: Vitest 5.0.4 (jsdom), RTL, MSW 3.0.1, in-house axe matcher; Playwright 1.63.0. .NET: xunit.v3 on Microsoft.Testing.Platform |
| **Config file** | `web/vitest.config.ts`, `web/playwright.config.ts` (port 5199), `web/src/test/setup.ts`, `web/src/test/msw.ts` |
| **Quick run command** | `dotnet test --project tests/<Project> --filter-class "*<Class>"` · `npm --prefix web run test -- --run <path>` |
| **Full suite command** | preflight, then `dotnet test --solution Csps.slnx`, `tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e` |
| **Estimated runtime** | quick: under 60 s per file; full: several minutes |

---

## Sampling Rate

- **After every task commit:** the quick command for the touched test files, plus `npm --prefix web run typecheck` for web tasks.
- **After every plan wave:** preflight, `dotnet test --solution Csps.slnx`, `npm --prefix web run verify`.
- **Before `/gsd-verify-work`:** full suite green, coverage gate, `npm --prefix web run e2e`.
- **Max feedback latency:** 60 seconds for a quick run.

---

## Per-Task Verification Map

Filled in by the planner and executor per task. Requirement-level map:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| ORD-01 (D-40) | Rows carry piece count; fixed command count | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*OrderReaderQueryCountTests"` | ✅ update | ⬜ pending |
| ORD-01 (D-41) | List-wide counts ignore filters and deleted orders | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ListOrdersEndpointTests"` | ✅ extend | ⬜ pending |
| ORD-01 | p95 < 300 ms | timing | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderListTimingTests" --output Detailed` | ✅ | ⬜ pending |
| ORD-01, ORD-12 | Cards and table figures; Fully Paid (0151); no internal figures | component | `npm --prefix web run test -- --run src/modules/admin/pages/OrdersPage.test.tsx` | ❌ W0 | ⬜ pending |
| ORD-01, ORD-12 | `OrderCard`, `OrderTotals` changes | component | `npm --prefix web run test -- --run src/components/money/money.test.tsx src/components/data/data.test.tsx` | ✅ update | ⬜ pending |
| ORD-02 | URL params, normalization, page reset, chips | component | `npm --prefix web run test -- --run src/modules/admin/hooks/useOrdersListParams.test.tsx` | ❌ W0 | ⬜ pending |
| ORD-10 | View choice persists (URL × localStorage) | component | `npm --prefix web run test -- --run src/modules/admin/hooks/useOrdersView.test.tsx` | ❌ W0 | ⬜ pending |
| ORD-11 | Due flags from Manila today | unit + component | `npm --prefix web run test -- --run src/modules/admin/components/DueFlag.test.tsx` | ❌ W0 | ⬜ pending |
| ORD-15 | Leave guard when dirty | component | `npm --prefix web run test -- --run src/modules/admin/pages/OrderFormPage.test.tsx` | ❌ W0 | ⬜ pending |
| ORD-07 | Detail page tabs, totals, customer card, history | component | `npm --prefix web run test -- --run src/modules/admin/pages/OrderPage.test.tsx` | ❌ W0 | ⬜ pending |
| ORD-07 (modals) | Each modal: OR-3 rules, 409 keeps input, 422 banner, RecordMeta, pickers | component | one test file per modal under `src/modules/admin/components/` | ❌ W0 | ⬜ pending |
| D-44 | Items carry recorded/changed attribution | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderAttributionTests"` | ✅ extend | ⬜ pending |
| ORD-19 | Internal figures only on the staff detail page | component + e2e | `npm --prefix web run test -- --run src/modules/admin/pages/OrdersPage.test.tsx` | ❌ W0 | ⬜ pending |
| ORD-06 (D-24) | Deleted read: Manager 200, Admin 403, anon 401, live/unknown 404 | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderDeletionTests"` and `--filter-class "*AuthorizationMatrixTests"` | ✅ extend | ⬜ pending |
| ORD-06 | Delete dialog counts; restore and purge with typed number | component | `npm --prefix web run test -- --run src/modules/admin/pages/DeletedOrdersPage.test.tsx src/modules/admin/pages/DeletedOrderPage.test.tsx` | ❌ W0 | ⬜ pending |
| SC 1 to 5 | End-to-end journeys, no sideways scroll, axe, CSP | e2e | `npm --prefix web run e2e -- --grep @orders` | ❌ W0 | ⬜ pending |
| API contract | Snapshot and generated types match | integration + node | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"`; `npm --prefix tools/openapi-gen run check` | ✅ | ⬜ pending |
| OR-4, OR-6 | No long dash; layout intact | node | `npm --prefix web run test -- --run src/test/no-long-dash.node.test.ts src/test/source-layout.node.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/src/test/orderFixtures.ts`: typed builders for ORD-2026-0148, 0151, 0153 (fake names), a credit order, a Cancelled order with refunds, a no-due-date import; MSW handlers that record requests.
- [ ] `web/e2e/testing-api.ts`: `createOrder()` over the testing seed endpoint.
- [ ] Remove the `orders` dev preview route; update `admin.spec.ts`, `shell.spec.ts`, `sweep.ts`, `routes.test.tsx`.
- [ ] New test files marked ❌ above, written red first.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser `beforeunload` prompt on a dirty form | ORD-15 | The dialog is owned by the browser | Edit an order, change a field, close or reload the tab: the browser asks to confirm |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: "08"
slug: "order-screens"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-10-30T13:55:00-05:00"
updated: "2026-10-31T02:35:00-05:00"
---

# Phase 08: Security

*Created: 2026-10-30T13:55:00-05:00 · Updated: 2026-10-31T02:35:00-05:00*

> Per-phase security contract: threat register, accepted risks, and audit trail.

The register comes from the `<threat_model>` blocks of plans 08-01 to 08-29: 82 rows, which are 53 unique threats (T-08-01 to T-08-53) plus T-08-SC repeated in every plan. The 28 `## Threat Flags` sections say "None" or map to existing ids (08-17 has no such section; its threat T-08-33 is verified in code). The first `gsd-security-auditor` run (2026-10-30) covered plans 08-01 to 08-24. A second run (2026-10-31) covered the gap plans 08-25 to 08-29 (G-08-5) and re-checked the earlier threats whose files changed since commit 8e870bfe. Both runs were ASVS level 1, static inspection, no tests run by the auditor, and both returned SECURED with 0 open threats.

Severity mix over the 82 rows: 40 high, 24 medium, 18 low. Dispositions: 81 mitigate, 1 accept (T-08-47), 0 transfer.

---

## Trust Boundaries

| Boundary | Description | Plans |
|----------|-------------|-------|
| Staff browser to `/api/v1/orders` and child routes | Admin and Manager read and write orders; anonymous is refused | 08-01 to 08-19, 08-21, 08-22 |
| Manager browser to deleted orders (list, read, restore, permanent delete) | Manager only; Admin gets 403 from the API and a redirect in the client | 08-03, 08-20, 08-23 |
| Manager browser to Settings lists | Manager only for writes and the Settings screens | 08-07, 08-08 |
| URL and localStorage to the order screens | Query keys, return URLs and the view choice are untrusted input | 08-09, 08-11, 08-15 |
| Admin module to the public module | Internal figures (order expenses, estimated profit) never reach public code | 08-12, 08-24 |
| Testing seed route | Exists only in Debug builds (`CSPS_TESTING`) | 08-21 |
| Order window refresh to the save | A refresh of the figures must never change the version a save sends | 08-26 to 08-28 |
| Two staff sessions in e2e | Two signed-in contexts against `CSPS_E2E` only | 08-29 |

---

## Threat Register

| Threat ID | Severity | Status | Evidence |
|---|---|---|---|
| T-08-01 | low | closed | `OrderListResponse.cs` rows hold no contact data; `OrderReader.cs:60` counts keep the soft-delete filter; `OrderReaderQueryCountTests.cs:87-105` |
| T-08-02 | medium | closed | `OrderAttributionTests.cs:12-62`, `:114-143` (forged attribution ignored) |
| T-08-03 | medium | closed | `OrderListQueryCountTests.cs:44` (3 commands); `OrderListTimingTests.cs:25-74` (p95 under 300 ms) |
| T-08-04 | medium | closed | `OrderTotals.tsx:132-141` (internal rows panel only); `data.test.tsx:124-130` |
| T-08-05 | low | closed | `ConfirmDialog.tsx:126-131`, `describeHttpError.ts` (fixed copy plus traceId) |
| T-08-06 | medium | closed | `productTypesService.ts:47-54` and siblings send idempotency keys and versions |
| T-08-07 | low | closed | `dueFlag.ts:37-45` takes `today` as input; `DueFlag.test.tsx:102-111` |
| T-08-08 | low | closed | `useOrdersListParams.ts:42-43`, `parsers.ts:19-41` |
| T-08-09 | medium | closed | `OrdersTable.tsx:4`; `OrdersPage.test.tsx:184-191` |
| T-08-10 | low | closed | `routes.tsx:159` (`requireSession` on the admin parent) |
| T-08-11 | high | closed | `OrdersController.cs:223-224` Manager policy; `AuthorizationMatrix.cs:246`; `OrderDeletionTests.cs:262-288` |
| T-08-12 | medium | closed | `OrderReader.cs:189,238,272`; `GetDeletedOrderHandler.cs:25`; `OrderDeletionTests.cs:235-259` |
| T-08-13 | low | closed | `OrdersController.cs:27` (`NoStore`); `OrderDeletionTests.cs:211` |
| T-08-14 | medium | closed | `routes.tsx:191` (`requireManager`); `routes.test.tsx:144,224`; `AuthorizationMatrix.cs:156-177` |
| T-08-15 | low | closed | `CategoryModal.tsx:190,214-230`; `ListSettingsSection.tsx:220-236`; `categorySchemas.ts:14,17` |
| T-08-16 | medium | closed | `useOrdersListParams.ts:41-53`; `parsers.ts:52-82,258-261` |
| T-08-17 | medium | closed | `createListParams.ts:55-90`; `Program.cs:112-117` (request log has no query string) |
| T-08-18 | medium | closed | `orderNavigation.ts:13-20` (`safeReturnUrl`); `OrderPage.test.tsx:572-585` |
| T-08-19 | medium | closed | `OrderTotals.tsx:141`; `orders-boundaries.node.test.ts:66-70` |
| T-08-20 | medium | closed | `useApplyOrder.ts:10-17` (sets the server answer, computes nothing) |
| T-08-21 | low | closed | `useOrdersView.ts:14-23` (only `grid` or `table`) |
| T-08-22 | medium | closed | No raw HTML sinks in `web/src`; `orders-boundaries.node.test.ts:73-82` |
| T-08-23 | medium | closed | `useSubmission.ts`; `OrderFormPage.tsx:239-240`; `OrderFormPage.test.tsx:252` |
| T-08-24 | medium | closed | `orderFormSchemas.ts:18-29,111-151` mirror `OrderRules.cs:15-45` |
| T-08-25 | low | closed | `useUnsavedChangesGuard.ts:12,35-48` |
| T-08-26 | high | closed | `OrderItemModal.tsx:69-77,134,228` and the other child modals send the opened version |
| T-08-27 | medium | closed | `useOrderChildSave.ts:136`; `OrderItemModal.test.tsx:253` |
| T-08-28 | low | closed | `OrderItemModal.tsx:69-77,258-260`; `OrderAttributionTests.cs:114-143` |
| T-08-29 | high | closed | `OrderFormPage.tsx:398,486`; `OrderFormPage.test.tsx:796` |
| T-08-30 | low | closed | `OrderFormPage.tsx:87,458,557` (locked banner) |
| T-08-31 | high | closed | `OrderPaymentModal.tsx:143,151,199-201,222`; `orderPaymentSchemas.ts:98-99`; server cap T-07-28 |
| T-08-32 | medium | closed | `OrderPaymentModal.tsx:70-79,336`; `PaidBySelect.tsx:41-45` |
| T-08-33 | medium | closed | `orderDiscountSchemas.ts:40-72`; `OrderDiscountModal.tsx:78-79,201-202,222` |
| T-08-34 | medium | closed | `OrderExpenseModal.tsx:77,219,335` |
| T-08-35 | medium | closed | `OrderStatusMenu.tsx:102-103,128-130`; `orderStatus.ts:12-14`; `CancelOrderDialog.tsx:35-43` |
| T-08-36 | low | closed | `OrderStatusHistory.tsx:44-49`; server T-07-37 |
| T-08-37 | high | closed | `routes.tsx:178`; `guard.ts` `requireManagerLoader`; `orders-deleted.spec.ts:138-153` |
| T-08-38 | high | closed | `PurgeOrderDialog.tsx:61,82-83,122-126`; `ConfirmDialog.tsx:122-123`; `PermanentlyDeleteOrderHandler.cs:52-55`; `PurgeOrderDialog.test.tsx:166-191` |
| T-08-39 | low | closed | `DeletedOrdersPage.tsx:204-205`; `deletedOrdersService.ts:50` |
| T-08-40 | high | closed | `orderRefundSchemas.ts:36-76`; `OrderRefundModal.tsx:143,151,224`; `Order.cs:1052,1114,1221` |
| T-08-41 | medium | closed | `TestingOrdersController.cs` inside `#if CSPS_TESTING`; `Csps.Server.csproj:4-6`; `ReleaseHasNoEmailSinkTests.cs:24-77` |
| T-08-42 | low | closed | `DeleteOrderDialog.tsx:19-37,60-70`; `DeleteOrderHandler.cs:51` (audit) |
| T-08-43 | high | closed | `routes.tsx:180`; `OrdersController.cs:223-224`; `order-deleted-view.spec.ts:134` |
| T-08-44 | medium | closed | `DeletedOrderPage.tsx:111-119,276` (all tabs read-only); `OrderDeletionTests.cs:291-` (server refuses child writes) |
| T-08-45 | high | closed | `orders-boundaries.node.test.ts:98,108,151-163`; `orders-journeys.spec.ts:461-509` |
| T-08-46 | medium | closed | `orders-boundaries.node.test.ts:100,115-117,166-180`; `e2e/fixtures.ts:52-57,174-180` (CSP listener) |
| T-08-47 | low | closed (accepted) | `OrderReader.cs:520` derives `Amount` from kind, value and stored subtotal only; `OrdersController.cs:25,27` (Staff, `NoStore`); `AuthorizationMatrix.cs:215,219,244,246` unchanged. See the Accepted Risks Log |
| T-08-48 | medium | closed | `OrderMath.cs:70,102-120` (one `DiscountAmount` rule); `OrderReader.cs:520`; `OrderDiscountsEndpointTests.cs:71-90` (amounts sum to `totals.discount`); `OrderMathTests.cs:210-239` |
| T-08-49 | high | closed | `OrderPaymentModal.tsx:142,240` (opened version frozen; `setOpened` only on Load Latest `:201,208`); `useOrderWindowFigures.ts:48`; `OrderPaymentModal.test.tsx:356-381,472-488` |
| T-08-50 | low | closed | `useOrderWindowFigures.ts:10,17-22,41-46,64-68` (shared reads under 1 s, one read on a cap failure); `useOrderWindowFigures.test.tsx:100,115,157,169`; the read is the Staff-only `GET /orders/{id}` (`OrdersController.cs:25,102`) |
| T-08-51 | low | closed | `OrderStatusMenu.tsx:121-125,149,182` (read on every open); `OrderStatusMenu.test.tsx:603-694`; server `OrderStatusRules.cs:93-103`, `Order.cs:1164` |
| T-08-52 | high | closed | `OrderRefundModal.tsx:143,248` and `OrderDiscountModal.tsx:139,247` (opened version frozen); `OrderRefundModal.test.tsx:327-352,433-449,697-734`; `OrderDiscountModal.test.tsx:445-473,536-552,817-850`; server `Order.cs:669-671,724-726,1052,1114,1221-1231` |
| T-08-53 | low | closed | `order-two-staff.spec.ts:78-86,141-143,185-187` (made-up names), `:127-129,171-173,227-229` (second context closed in `finally`); `scripts/e2e.mjs:39,80` (`CSPS_E2E` only); gitleaks: no leaks |
| T-08-SC | high | closed | No change to `web/package.json`, the lockfile, `Directory.Packages.props`, any `.csproj`, `global.json`, `nuget.config` or tool manifest since 61c6beb4 (re-checked against 8e870bfe on 2026-10-31) |

*Status: open · closed. File paths are under `src/`, `tests/` or `web/` as the summaries list them.*

---

## Accepted Risks Log

| Threat ID | Severity | Risk | Why it is accepted | Accepted in |
|---|---|---|---|---|
| T-08-47 | low | The order answer now carries each discount's peso `amount` | The figure comes only from the discount kind and value and the stored subtotal, which staff already see. No new route. Order reads keep the Staff and Manager policies and the existing matrix rows. | Plan 08-25 threat model, under owner ruling D-94 |

*Accepted risks do not resurface in future audit runs.*

---

## Related items outside the register

- **Server refusal text:** `CancelOrderDialog.tsx:39-40` and `useOrderChildSave.ts` show the server's 422 `detail` sentence. T-08-35 declares this, and the sentences are fixed domain text. The shared `ConfirmDialog` fallback never shows raw server text (T-08-05).
- **Proven only by a run:** the p95 timing test (T-08-03) and the Release build scan (T-08-41). Both passed in 08-24's `dotnet test --solution Csps.slnx` run (6224 passed, 0 failed, 2 skipped).
- **No rate limit on order reads (T-08-50):** plan 08-26 says the extra reads sit "behind the current auth and rate limits", but no rate limiter covers `GET /orders/{id}`. Limits cover only sign-in, password, invite and refresh (`RateLimitingRegistration.cs:53-100`). T-08-50 is closed on the client-side read sharing plus Staff auth, not on a rate limit.
- **Discount preview math (WR-01):** the Discounts tab shows the server's amounts (D-94), but `otherDiscountsTotal` and the discount window preview still add in the browser. The server's items-total check (`Order.cs:669-671,724-726`) still decides, so this is not a threat.
- **Phase 7.1 project files:** against the main merge base, three `.csproj` files differ with `InternalsVisibleTo` and `ProjectReference` lines only. They predate Phase 8 and add no package.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-30 | 70 rows (46 unique plus T-08-SC) | 70 | 0 | gsd-security-auditor (ASVS L1, static) |
| 2026-10-31 | 82 rows (53 unique plus T-08-SC); delta 08-25 to 08-29 plus 8 regression re-checks | 82 | 0 | gsd-security-auditor (ASVS L1, static) |

---

## Sign-Off

- [x] All threats have a disposition
- [x] Accepted risks documented (T-08-47)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-30 and re-verified 2026-10-31 by the automated audit. Owner review is part of the phase sign-off.

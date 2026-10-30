---
phase: "08"
slug: "order-screens"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-10-30T13:55:00-05:00"
updated: "2026-10-30T13:55:00-05:00"
---

# Phase 08: Security

*Created: 2026-10-30T13:55:00-05:00 · Updated: 2026-10-30T13:55:00-05:00*

> Per-phase security contract: threat register, accepted risks, and audit trail.

The register comes from the `<threat_model>` blocks of plans 08-01 to 08-24: 70 rows, which are 46 unique threats (T-08-01 to T-08-46) plus T-08-SC repeated in every plan. The 23 `## Threat Flags` sections say "None" or map to existing ids (08-17 has no such section; its threat T-08-33 is verified in code). One `gsd-security-auditor` run (ASVS level 1, static inspection, no tests run by the auditor) checked each mitigation at its file and line and returned SECURED with 0 open threats.

Severity mix over the 70 rows: 33 high, 23 medium, 14 low. Dispositions: 70 mitigate, 0 accept, 0 transfer.

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
| T-08-29 | high | closed | `OrderFormPage.tsx:397,485-486`; `OrderFormPage.test.tsx:796` |
| T-08-30 | low | closed | `OrderFormPage.tsx:87,458,557` (locked banner) |
| T-08-31 | high | closed | `OrderPaymentModal.tsx:143,151,199-201,222`; `orderPaymentSchemas.ts:98-99`; server cap T-07-28 |
| T-08-32 | medium | closed | `OrderPaymentModal.tsx:70-79,336`; `PaidBySelect.tsx:41-45` |
| T-08-33 | medium | closed | `orderDiscountSchemas.ts:40-72`; `OrderDiscountModal.tsx:78-79,201-202,222` |
| T-08-34 | medium | closed | `OrderExpenseModal.tsx:77,219,335` |
| T-08-35 | medium | closed | `OrderStatusMenu.tsx:102-103,128-130`; `orderStatus.ts:12-14`; `CancelOrderDialog.tsx:35-43` |
| T-08-36 | low | closed | `OrderStatusHistory.tsx:44-49`; server T-07-37 |
| T-08-37 | high | closed | `routes.tsx:178`; `guard.ts` `requireManagerLoader`; `orders-deleted.spec.ts:138-153` |
| T-08-38 | high | closed | `PurgeOrderDialog.tsx:82-83,106-123`; `PermanentlyDeleteOrderHandler.cs:52-55`; `PurgeOrderDialog.test.tsx:166-191` |
| T-08-39 | low | closed | `DeletedOrdersPage.tsx:204-205`; `deletedOrdersService.ts:50` |
| T-08-40 | high | closed | `orderRefundSchemas.ts:36-76`; `OrderRefundModal.tsx:143,151,224`; `Order.cs:1052,1114,1221` |
| T-08-41 | medium | closed | `TestingOrdersController.cs` inside `#if CSPS_TESTING`; `Csps.Server.csproj:4-6`; `ReleaseHasNoEmailSinkTests.cs:24-77` |
| T-08-42 | low | closed | `DeleteOrderDialog.tsx:19-37,60-70`; `DeleteOrderHandler.cs:51` (audit) |
| T-08-43 | high | closed | `routes.tsx:180`; `OrdersController.cs:223-224`; `order-deleted-view.spec.ts:134` |
| T-08-44 | medium | closed | `DeletedOrderPage.tsx:111-119,276` (all tabs read-only); `OrderDeletionTests.cs:291-` (server refuses child writes) |
| T-08-45 | high | closed | `orders-boundaries.node.test.ts:31,66-70`; `orders-journeys.spec.ts:461-509` |
| T-08-46 | medium | closed | `orders-boundaries.node.test.ts:33,73-82`; `e2e/fixtures.ts:52-57,174-180` (CSP listener) |
| T-08-SC | high | closed | No change to `web/package.json`, the lockfile, `Directory.Packages.props`, any `.csproj` or tool manifest since 61c6beb4 |

*Status: open · closed. File paths are under `src/`, `tests/` or `web/` as the summaries list them.*

---

## Accepted Risks Log

No threat has disposition `accept`, and this audit accepted none.

*Accepted risks do not resurface in future audit runs.*

---

## Related items outside the register

- **Server refusal text:** `CancelOrderDialog.tsx:39-40` and `useOrderChildSave.ts` show the server's 422 `detail` sentence. T-08-35 declares this, and the sentences are fixed domain text. The shared `ConfirmDialog` fallback never shows raw server text (T-08-05).
- **Proven only by a run:** the p95 timing test (T-08-03) and the Release build scan (T-08-41). Both passed in 08-24's `dotnet test --solution Csps.slnx` run (6224 passed, 0 failed, 2 skipped).
- **Phase 7.1 project files:** against the main merge base, three `.csproj` files differ with `InternalsVisibleTo` and `ProjectReference` lines only. They predate Phase 8 and add no package.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-30 | 70 rows (46 unique plus T-08-SC) | 70 | 0 | gsd-security-auditor (ASVS L1, static) |

---

## Sign-Off

- [x] All threats have a disposition
- [x] Accepted risks documented (none)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-30 by the automated audit. Owner review is part of the phase sign-off.

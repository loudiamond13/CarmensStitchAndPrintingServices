---
phase: 07-order-domain-api
plan: 19
subsystem: api
tags: [audit-log, orders, viewer, change-lines, snapshots, money-attribution, d-31]
created: "2026-10-28T20:42:00-05:00"
updated: "2026-10-28T21:45:00-05:00"
status: complete

requires:
  - phase: 07-order-domain-api
    provides: "07-01 the 43 order and list audit codes and docs/operations/audit-log.md Phase 7 section; 07-05 to 07-17 OrderAuditDetail and the writers of every detail key; 07-08 LegacyHolder row"
provides:
  - "AuditChangeLines reads every Phase 7 detail key into typed lines: status, orderDate, dueDate, date, amount, quantity, unitPrice, kind, value (percent values end with %), method, productType, category (order expense), receiver, payer, refunder, name, tone, and the text field names of fields="
  - "AuditOrderSnapshot { number, status, total, paid, balance } on AuditLogItem.OrderSnapshot for deleted, restored and permanently deleted orders, readable after the row is gone"
  - "AuditLogItem.OrderNumber: the order's number on every order and order child entry (deleted orders included; the entry's own detail when the row is gone)"
  - "AuditLogReader resolves product type, payment method and order expense category names (retired included), orders and people in a fixed number of commands per page"
  - "Web viewer sentences for every new field, describeAuditOrderSnapshot, isStatedValueAction, an Order row in AuditDetail and the order number in the Done to column"
affects: [07-20, 08, 15]

actuals:
  tokens: 26300
  tasks: 3
  commits: 6
plan_head_before: 9cadf87bd87c8f8537fe7d8e16cff362039ee7db
plan_head_after: 3cca330787e6666bd3cc1adebdd03d86f5d784a1

tech-stack:
  added: []
  patterns:
    - "One parser for the order family with two modes: a stated entry (created, added, removed) gives each value with no old value; an edit entry gives a line only where the detail has old>new, so unchanged current values are never repeated"
    - "A unit travels with the value: a percentage discount value is written 5.00% on each side, so a kind change (5.00% to 500.00) reads correctly without a second line"
    - "List entry names are looked up through one generic NamesAsync over OrderListEntry, one query per list that a page names"

key-files:
  created:
    - tests/Csps.Server.IntegrationTests/Audit/OrderAuditViewerTests.cs
  modified:
    - src/Csps.Application/Audit/AuditChangeLines.cs
    - src/Csps.Application/Audit/AuditLogResponse.cs
    - src/Csps.Application/Audit/ListAuditLogHandler.cs
    - src/Csps.Application/Ports/IAuditLogReader.cs
    - src/Csps.Infrastructure/Auditing/AuditLogReader.cs
    - tests/Csps.Application.UnitTests/Audit/AuditChangeLinesTests.cs
    - tests/Csps.Application.UnitTests/Audit/ListAuditLogHandlerTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/modules/admin/auditCopy.ts
    - web/src/modules/admin/auditCopy.test.ts
    - web/src/modules/admin/components/AuditDetail.tsx
    - web/src/modules/admin/components/AuditDetail.test.tsx
    - web/src/modules/admin/pages/AuditLogPage.tsx
    - web/src/modules/admin/pages/AuditLogPage.test.tsx
    - web/src/modules/admin/services/auditLogService.test.ts
    - web/src/modules/admin/components/showcase/Phase5Demos.tsx
    - docs/operations/audit-log.md

key-decisions:
  - "Done to stays empty for order entries (the API doneTo is null). The screen shows the order number in that column. Receiver, payer and refunder changes read from the lines. The Done to filter still searches only company-expense entries (see Deferred)."
  - "A percentage discount value is sent as text ending in % on each side (5.00%), decided by the kind in the same detail (the change, or the current kind). This keeps one value line and handles a kind change in the same save."
  - "Stated entries (order.created and every added or removed child) give from = null and to = the value; the web reads them with isStatedValueAction(action). Edit entries give only changed pairs."
  - "orderCategory is the internal parsed field of an order expense's category, resolved against the order expense category list and sent as the line field category; the company expense category keeps its own list."
  - "The order number comes from the Orders table (soft-deleted rows included, IgnoreQueryFilters on SoftDelete) first, then from the entry's own detail (created, deleted, restored, permanently deleted)."
  - "Order status labels are held in auditCopy.ts (all seven, including Delivered). web/src/utils/csps.ts ORDER_STATUSES has no delivered entry; that preview helper was left alone."

patterns-established:
  - "Pattern: a viewer line that states a value is told apart from a change by the action code, not by guessing from nulls"

requirements-completed: [ORD-16, ORD-22, ORD-23]

coverage:
  - id: V1
    description: "ORD-22: an order-payment.receiver-changed entry shows the old and new receiver by name (fromPerson, toPerson) and the added payment shows date, amount, method (current name) and receiver"
    requirement: ORD-22
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/OrderAuditViewerTests.cs#AReceiverChangeReadsWithBothPeopleAndAnAddedPaymentReadsAsLines"
        status: pass
    human_judgment: false
  - id: V2
    description: "ORD-23: an order-expense.payer-changed entry shows both people and the category name; a changed expense shows amount and category old and new; no description text leaves the server"
    requirement: ORD-23
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/OrderAuditViewerTests.cs#AnOrderExpensePayerChangeNamesBothPeopleAndTheCategory"
        status: pass
    human_judgment: false
  - id: V3
    description: "ORD-16: status moves and reopens read from>to; created reads status and dates; deleted, restored and permanently deleted orders carry an order snapshot (number, status, total 21327.50, paid 12000.00, balance 9327.50) even after the row is gone; every order entry names the order number"
    requirement: ORD-16
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/OrderAuditViewerTests.cs#AStatusMoveAndAReopenReadAsStatusLinesThatNameTheOrder"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/OrderAuditViewerTests.cs#ADeletedRestoredAndPermanentlyDeletedOrderEachShowAnOrderSnapshotEvenAfterTheRowIsGone"
        status: pass
    human_judgment: false
  - id: V4
    description: "D-31: items, discounts, product type renames, retired payment methods and the Legacy holder read with names, kinds, percent values and 'Legacy / unassigned'"
    requirement: ORD-22
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/OrderAuditViewerTests.cs#AnItemAndADiscountReadWithProductTypeNamesKindsAndPercentValues"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/OrderAuditViewerTests.cs#AProductTypeRenameReadsTheOldAndNewName"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/OrderAuditViewerTests.cs#ARetiredPaymentMethodStillReadsByName"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/OrderAuditViewerTests.cs#AnEntryNamingTheLegacyHolderReadsLegacyUnassigned"
        status: pass
    human_judgment: false
  - id: V5
    description: "T-07-56, T-07-57: no customer or note text in any line (only field names); unknown keys and malformed values are ignored and never thrown on"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Audit/OrderAuditViewerTests.cs#NoCustomerOrNoteTextLeavesTheServerOnlyTheNamesOfTheFieldsThatChanged"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Audit/AuditChangeLinesTests.cs#AnUnknownKeyAndAMalformedOrderValueAreLeftOutAndNeverThrownOn"
        status: pass
    human_judgment: false
  - id: V6
    description: "The web viewer describes every new field in plain words with no long dash, the order snapshot sentence, an Order row and the order number in Done to, with zero axe violations"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/auditCopy.test.ts, web/src/modules/admin/components/AuditDetail.test.tsx, web/src/modules/admin/pages/AuditLogPage.test.tsx, web/src/test/no-long-dash.node.test.ts"
        status: pass
    human_judgment: true
    rationale: "The new sentences are owner-reviewable wording (SPEC-GAP): the owner approves the exact words listed under New user-facing copy."

duration: 41min
completed: 2026-10-28
---

# Phase 7 Plan 19: Order Audit Viewer Summary

**The audit log now reads every order, child and list event as typed lines with people, list entry names and the order number resolved on the server, and the Audit Log screen says them in plain sentences, including who received a payment before and after a change.**

## Performance

- **Duration:** 41 min (about 20:01 to 20:42, Manila time)
- **Tasks:** 3 (tracer, server lines and snapshot, web sentences)
- **Files modified:** 18 (1 created)
- **Commits:** 6 (RED then GREEN for each task), measured from the plan ledger

## Accomplishments

- Tracer (Task 1): a Manager reads an `order-payment.receiver-changed` entry as one `receiver` line with `fromPerson` (Admin) and `toPerson` (Manager), and the added payment as date, amount, method name and receiver lines.
- Server lines (Task 2): `AuditChangeLines` reads the status, date, amount, quantity, unit price, discount kind and value, list entry, person and `fields=` keys of all 43 Phase 7 codes. List events (product types, payment methods, order expense categories) reuse the name and tone lines. Unknown keys, wrong shapes and unknown field names are left out and never thrown on.
- Snapshot and number: deleted, restored and permanently deleted orders carry `orderSnapshot`; every order entry carries `orderNumber`. The permanent delete reads after the row is gone.
- Contract refreshed (`openapi.v1.json`, `api.generated.ts`): `AuditOrderSnapshot`, `orderSnapshot`, `orderNumber`, and the widened `AuditChangeLine` docs.
- Web (Task 3): `describeAuditChange(line, stated)` covers every new field; `describeAuditOrderSnapshot`, `isStatedValueAction`, an Order row in the detail panel, and the order number in Done to.
- Docs: `docs/operations/audit-log.md` has an "Order and list entries (Phase 7, D-31)" part in Viewing the log.

## Task Commits

1. Task 1 RED: `5ed2cbf0` test(07-19): read a receiver change in the audit log (RED)
2. Task 1 GREEN: `7da09093` feat(07-19): the audit log reads payment receiver changes (ORD-22)
3. Task 2 RED: `158eb1b2` test(07-19): every Phase 7 audit key reads as a typed line (RED)
4. Task 2 GREEN: `0ad59af1` feat(07-19): typed audit lines for orders, items, money and lists (D-31)
5. Task 3 RED: `787a38f5` test(07-19): plain words for order audit lines (RED)
6. Task 3 GREEN: `3cca3307` feat(07-19): the audit viewer describes order changes (D-31)

Tracer gate: the tracer `<verify>` is automated only, so it was re-run after the commit and passed (1 of 1) before expansion.

## Verification (quoted from runs)

- RED for Task 2: 8 of 9 `OrderAuditViewerTests` failed, the tracer passed; the unit test project did not compile (missing members). RED for Task 3: 12 failing in `auditCopy.test.ts`.
- `AuditChangeLinesTests`/Application `*Audit*`: 200 passed. `OrderAuditViewerTests`: 9 passed. Server `*Audit*`: 34 passed. `*Order*`: 327 passed (includes the timing classes, which passed this time). `*OpenApiSnapshotTests`: 10 passed after one switch-on run. `Csps.ArchitectureTests`: 241 passed. `Csps.Infrastructure.IntegrationTests *Audit*`: 19 passed.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Web: `npm --prefix web run typecheck` and `lint` clean (max-warnings 0); full `vitest run --coverage`: 202 files, 6033 tests passed; statements 95.55, branches 90.45, functions 96.47, lines 98.49. `auditCopy.ts` 100% lines. Axe: zero violations in the AuditDetail and AuditLogPage tests.
- `dotnet build`: 0 warnings, 0 errors. `Invoke-CoverageGate.ps1`: Csps.Domain 100/100 PASS; Csps.Application line 98.4% (rule 95%) PASS.
- Acceptance greps: `"receiver"` in AuditChangeLines.cs = 1; `AuditOrderSnapshot` in AuditLogResponse.cs = 1 and in api.generated.ts = 2; `describeAuditOrderSnapshot` in auditCopy.ts = 1; no U+2013 or U+2014 in the three web source files (checked with node, and `no-long-dash.node.test.ts` passes).

## New user-facing copy (owner review)

Plain words the plan did not spell out. Please confirm or reword.

- Status: `Status: Ready to Completed` (labels Pending, Mockup, In Production, Ready, Delivered, Completed, Cancelled).
- Dates and numbers: `Order date: Oct 28, 2026 to Oct 29, 2026`, `Due date: ...`, `Date: ...`, `Quantity: 15 to 20`, `Unit price: ₱650.00 to ₱700.00`, `Amount: ...`.
- Discounts: `Discount type: Percentage to Fixed amount` (labels Percentage, Fixed amount), `Discount value: 5% to 10%` or `5% to ₱500.00`.
- Lists: `Payment method: Cash to GCash`, `Product type: Basketball Jersey to Polo Shirt`, `Category: ...`, and `a deleted payment method` / `a deleted product type` / `a deleted category` for an entry that is gone.
- People: `Received by: {name} to {name}`, `Paid by: ...`, `Refunded by: ...`, with ` (former staff)` after a deleted account, and `Legacy / unassigned` for the holder.
- Text fields (names only): `Customer name changed`, `Team name changed`, `Contact number changed`, `Email changed`, `Address changed`, `Notes changed`, `Description changed`, `Size or variant changed`, `Reference changed`, `Reason changed`.
- Order snapshot: `ORD-2026-0148, Cancelled, total ₱21,327.50, paid ₱12,000.00, balance ₱9,327.50`.
- Detail panel row label: `Order` (value is the order number). Done to column shows the order number for order entries.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Order number on every order entry**
- **Found during:** Task 2
- **Issue:** The plan's truth "the entry for an order event names the order number" and the key link to "order numbers" need a field, but the interfaces listed only `OrderSnapshot`. A payment or item entry has no snapshot to carry a number.
- **Fix:** Added `OrderNumber` (string, null for other entries) beside `OrderSnapshot` on `AuditLogEntryView` and `AuditLogItem`. The reader looks the numbers up once per page, soft-deleted orders included, and falls back to the number in the entry's own detail.
- **Files modified:** `IAuditLogReader.cs`, `AuditLogResponse.cs`, `ListAuditLogHandler.cs`, `AuditLogReader.cs`, generated contract. **Commit:** `0ad59af1`

**2. [Rule 3 - Blocking] Existing fixtures and a handler test needed the two new fields**
- **Found during:** Task 2 and Task 3
- **Issue:** `AuditLogItem` gained two required members, so `ListAuditLogHandlerTests` and four web fixtures (`Phase5Demos.tsx`, `AuditDetail.test.tsx`, `AuditLogPage.test.tsx`, `auditLogService.test.ts`) no longer compiled or typechecked. `Phase5Demos.tsx` is not in the plan's file list.
- **Fix:** Added `orderSnapshot: null, orderNumber: null` (and a pass-through handler test). **Commits:** `0ad59af1`, `787a38f5`

**3. [Plan wording] Resolve signature**
- `AuditChangeLines.Resolve` takes an optional `AuditListNames` instead of the single `methods` dictionary the tracer added, so one call resolves all three lists. Existing callers and tests keep working.

Total deviations: 3 (1 missing field, 1 blocking fixture update, 1 internal signature). Impact: none on scope; one extra nullable field on the audit item.

## Deferred Issues / Follow-ups (recorded, not done)

**Owner ruling D-48 (2026-10-28):** the copy is approved, the Done to filter is extended to order receivers, payers and refunders, and the subline names orders. The two code changes are queued in `deferred-items.md`.

- **Done to filter and order money.** The Done to filter matches only `company-expense.*` entries by the payer in the detail. It does not find order entries for a receiver, payer or refunder. The lines show the people, but a Manager cannot yet list "everything this person received" through the filter. Owner decision: extend the filter to the six order families? (Recommend yes, a small change of the same LIKE rule.)
- **Subline wording.** `AUDIT_COPY.subline` still reads "Every sign-in, security, staff account and expense change". It does not mention orders. Left unchanged because it is owner-reviewed wording.
- **`ORDER_STATUSES` in `web/src/utils/csps.ts`** has no `delivered` entry (pre-existing preview helper). Not touched here; the audit viewer has its own full map.
- `ExpenseListTimingTests` p95 flake (D-76 pattern) left alone as instructed; it did not run in the filters used here.

## Known Stubs

None.

## Threat Flags

None. No new route or trust boundary. The response of the Manager-only `GET /api/v1/audit-log` gains an order number and an order snapshot (figures already visible on the order); no customer or note text.

## Issues Encountered

- `DateTimeOffset.UtcNow` is a banned API in the test project; the Legacy holder test uses `TimeProvider.System.GetUtcNow()` like the other fixtures.
- Windows line endings: two source files are CRLF in the working tree. Edits were made with the Edit tool to keep each file's endings.

## Self-Check: PASSED

- Created file exists: `tests/Csps.Server.IntegrationTests/Audit/OrderAuditViewerTests.cs` (FOUND).
- Commits `5ed2cbf0`, `7da09093`, `158eb1b2`, `0ad59af1`, `787a38f5`, `3cca3307` are ancestors of HEAD; `git rev-list --count` from the ledger base is 6.
- All task acceptance criteria and the plan verification re-run above.

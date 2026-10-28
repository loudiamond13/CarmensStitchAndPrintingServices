# Phase 7: Order Domain & API - Context

*Created: 2026-10-27T20:53:00-05:00 · Updated: 2026-10-28T15:20:00-05:00*

**Gathered:** 2026-10-27
**Status:** Ready for planning

<domain>
## Phase Boundary

The back end for orders. There are no screens; Phase 8 builds them. The phase delivers:

- the `Order` aggregate with items, payments, refunds, discounts and order expenses, and server-computed totals
- the full order API: create (full aggregate in one call), read, list/search, update, child mutations, status changes, delete, restore and permanent delete
- per-year `ORD-{YYYY}-{NNNN}` numbering that is safe under parallel creates
- the status rules and the status history
- 409 conflicts on stale edits, child-only edits included
- `Order.Import` with configurable rule constants for legacy data
- Received by (ORD-22) and Paid by (ORD-23) validation through the Phase 6 staff lookup
- three new Manager-editable lists (payment methods, order expense categories, product types) with their API and seed data
- fixtures, invariant tests and race tests that prove the Core Value

Requirements: ORD-03, ORD-05, ORD-08, ORD-13, ORD-14, ORD-16, ORD-17, ORD-18, ORD-20, ORD-21, ORD-22, ORD-23. Phase 7 also builds the server side of ORD-01, ORD-02 and ORD-06, which stay mapped to Phase 8.

Out of scope: order screens and the Settings page sections for the new lists (Phase 8), order images and Cloudinary (later phase, OD-9), money on hand and transfers (Phase 10), the dashboard (Phase 10), reusable customers (CUST-01, v2), the final legacy migration (Phase 15).

</domain>

<decisions>
## Implementation Decisions

### Statuses and moves (OD-3, C-39; owner 2026-10-27)
- **D-01:** There are **seven statuses**: Pending, Mockup, In Production, Ready, **Delivered**, Completed and Cancelled. "Delivered" is new: the jerseys were handed to the customer, and a balance may still be owed. It sits between Ready and Completed. — **Reversibility:** costly. It is stored data that the dashboard, filters, badges and the legacy status mapping all read. It amends ORD-17 and the UI-spec status list (SPEC-DEVIATION).
- **D-02:** Staff can move an order **forward or back freely among the active statuses** (Pending, Mockup, In Production, Ready, Delivered). **Cancel** is allowed from any active status.
- **D-03:** **Completed needs a balance of exactly ₱0.00.** An order with money still owed, or with a customer credit (D-12), can't be marked Completed. The server refuses with a plain-English error.
- **D-04:** Completed and Cancelled are **end states**. **Admins and Managers** can reopen one. A reopen is a status change, so it is recorded in the history and audited like any other.
- **D-05:** A Completed or Cancelled order is **locked**. Its details, items, payments, discounts and expenses can't change until it is reopened. The one exception: a **refund** can be recorded on a Cancelled order (D-07).
- **D-06:** Every status change is stored in the history (from, to, who, when; ORD-16), reopens included.

### Cancelling and refunds (C-37, ORD-18; owner 2026-10-27)
- **D-07:** A cancelled order **keeps its payments as collected cash** unless a **Refund** is recorded. A refund is its own child record: date, amount, a short required reason, and **who handed the money back** (an active Admin or Manager, validated like Received by). — **Reversibility:** one-way. It is a new table and migration, and it feeds collected-cash and balance figures.
- **D-08:** A refund **lowers the refunder's money on hand**. This **replaces the OD-16 default** ("refunds don't count") for Phase 10 (MONEY-01).
- **D-09:** **Any staff member** (Admin or Manager) can record a refund, on a Cancelled order or on an order that shows a customer credit. A refund can never exceed the amount paid minus earlier refunds. Refunds are audited.
- **D-10:** A cancelled order's **expenses still count**: in the payer's money on hand, in expense totals and in the order's profit (the order shows a loss).

### Overpayment and customer credit (OD-4, C-38; owner 2026-10-27)
- **D-11:** A **payment above the remaining balance is refused** (OD-4, 2026-10-13, unchanged).
- **D-12:** **Other changes may push the balance below ₱0.00**: removing an item, lowering a quantity or price, or adding or raising a discount after payment. They are **allowed**, and the order then shows a **customer credit** (the amount paid over the new total). This replaces the "block them too" default reading of C-38 and amends ORD-05's "overpayment rule across all mutation types". Totals expose the credit explicitly; the planner names the field.
- **D-13:** A credit is cleared by **recording a refund** for it. An order with a credit can't be Completed (D-03).
- **D-14:** **Legacy orders that are already overpaid import as they are** and show the same customer credit. No money figure is changed (zero loss). `Order.Import` doesn't apply D-03 to imported Completed orders (lenient path, ORD-21).

### Discounts (C-1; owner 2026-10-27)
- **D-15:** An order can have **many discounts**, as the UI spec shows. `OrderMath` already sums a list of fixed and percentage discounts. Each discount still follows ORD-05 (percent 0 to 100, value > 0).

### Lists that Managers edit (OD-8 for orders, C-43, C-44; owner 2026-10-27)
- **D-16:** **Payment methods** are a **Manager-editable list**. It starts with Cash, GCash, Maya, Bank Transfer and **Cheque**. — **Reversibility:** one-way. It is a table with a foreign key from payments, replacing the UI-spec fixed union.
- **D-17:** **Order expense categories** are their **own Manager-editable list**, separate from company categories. It starts with Fabric, Ink & paper, Outsourcing, Labor, Delivery and Others. — **Reversibility:** one-way. It is a table with a foreign key from order expenses.
- **D-18:** **Product types** are a **Manager-editable list**. It starts with Basketball Jersey, Volleyball Jersey, Moto Riding Jersey, Long Sleeves, Polo Shirt and Custom Design. Items reference it by foreign key and are **not** linked to the price list (C-44). This amends ORD-13's "6 fixed types". — **Reversibility:** one-way. It is a table with a foreign key from items.
- **D-19:** All three lists follow the **Phase 6 category rules** (06 D-08 to D-15, D-30): Managers add, rename, recolor (fixed safe tone set), retire and reactivate. A value that is used, even by a soft-deleted order, is retired, never deleted, and a never-used one may be deleted. Retired values are hidden from pickers but stay in filters. Sorting is A to Z with Others last where an Others exists. Starting values ship as migration seed data (`HasData`). Every list change is audited.
- **D-20:** Phase 7 builds the lists, their **API** and seed data. Their **sections on the Manager-only Settings page come in Phase 8** with the order screens.

### The order record (OD-7, C-14, C-15/C-24, C-3; owner 2026-10-27)
- **D-21:** **Customer details are typed on each order** (name, team, contact number, email, address), as in the UI spec. There is no Customer entity; CUST-01 stays in v2.
- **D-22:** The **due date is required** and must be on or after the order date. `Order.Import` accepts legacy orders without one.
- **D-23:** The **year in the order number comes from the moment the order is saved, in business time** (Asia/Manila from SiteSettings), not from the order date. Numbers restart at 0001 each year, follow a per-year counter, and stay unique under 20 parallel creates and across New Year. Legacy numbers are preserved. — **Reversibility:** one-way. A counter table and its migration, plus the issued numbers themselves.
- **D-24:** The **Create Order screen** (Phase 8) follows the UI spec: details, images and items in the first save, with payments, discounts and expenses added on the order page afterwards. The **API still accepts the full aggregate in one call** (ORD-03), for the import and a future phone app.

### Who may do what (OD-5, OD-6; owner 2026-10-27)
- **D-25:** **Any staff member (Admin or Manager) can edit any order** and its parts. This is different from company expenses (06 D-26). Every change is audited with who made it.
- **D-26:** Order delete is a **soft delete**, like expenses (06 D-01). The order and all its parts are hidden from every list, total and balance, but the rows stay. — **Reversibility:** one-way. A deleted marker (UTC time and who) and its migration, plus a filter on every order query.
- **D-27:** **Admins and Managers can both soft-delete** an order (OD-6: yes).
- **D-28:** **Only Managers** see the **Deleted orders** view, **restore** an order, and **delete permanently**. A restored order counts again everywhere. A permanent delete removes the order and all its children in one transaction, keeps the UI spec's **type-the-order-number** confirm, and schedules image cleanup once images exist (ORD-06).
- **D-29:** After a permanent delete, the audit entry keeps the order number, totals, status, and the receivers and payers by user id. It keeps no customer details or notes (05 D-40).

### Limits (owner 2026-10-27)
- **D-30:** **Phase 6 limits are reused.** Payments, refunds and order expenses must be more than ₱0.00 and at most ₱1,000,000.00. Order expense dates may be up to 30 days ahead in business time. Payment and refund dates are never in the future (ORD-05). Item quantity is 1 to 10,000. Unit price is ₱0.00 to ₱1,000,000.00. Caps live in rule constants and validators (client zod and server), not in the database (06 D-33), so legacy data still imports.

### Audit (owner 2026-10-27)
- **D-31:** The audit log records **every** order change: create, edit, status change and reopen, soft delete, restore, permanent delete, and every add, edit or remove of an item, payment, refund, discount or expense. Old and new values are kept for money, dates, status, Received by and Paid by. Customer details, descriptions and notes show only as "changed", with no text (05 D-40). The events join `docs/operations/audit-log.md`.

### Legacy data (OD-15 shape, C-42; owner 2026-10-27)
- **D-32:** `Order.Import` can give legacy payments, refunds and order expenses a **"Legacy / unassigned" holder**: a special staff record that can **never sign in** and **never appears** in any staff picker or lookup. It matches the "Legacy import" attribution already used for unknown creators (SEC-08). The import can still name a real staff member where the old data says who. The final rule stays a Phase 15 ruling (MIG-09).
- **D-33:** **Phase 7.1 is approved**: an early, **read-only** fit check against `CSPS_Legacy_Restore` after the order rules are built, to find legacy data that breaks them. It never derives the schema, never writes to the restore, and never restores over `CSPS_Dev`. It must be inserted into the roadmap as Phase 7.1.

### Research follow-ups (07-RESEARCH Open Questions 1 to 5; owner 2026-10-28)
- **D-34:** **Refund cap on an order that is not cancelled:** at most the customer credit, so a refund never puts the customer back in debt. On a Cancelled order the cap stays paid minus earlier refunds (D-09). (owner, 2026-10-28)
- **D-35:** **Refunds on a Cancelled order can be edited or removed without reopening it.** This widens the D-05 exception from "record" to "record, edit, remove". Every change is audited (D-31). (owner, 2026-10-28)
- **D-36:** **Profit on a Cancelled order** is money kept minus money spent: `(paid − refunded) − expenses`. Every other status keeps `total − expenses`. This makes D-10's "shows a loss" true. (owner, 2026-10-28)
- **D-37:** **The "Legacy / unassigned" holder (D-32) is one seeded, hidden user record** with a fixed id. It has no role, can never sign in, never appears in any staff picker, lookup or user list, and shows as "Legacy / unassigned". Phase 7 seeds only this holder. Whether the SEC-08 "Legacy import" creator reuses it stays a Phase 15 call (MIG-10). (owner, 2026-10-28)
- **D-38:** **No direct Completed to Cancelled move.** Staff reopen the order first, then cancel it, so both steps are recorded (D-04, D-06). (owner, 2026-10-28)

### Amendment approval (plan 07-04; owner 2026-10-28)
- **D-39:** **The drafted requirement and roadmap wording in `07-AMENDMENTS.md` is approved as drafted (approve-all).** It is applied to ORD-05, ORD-06, ORD-13, ORD-17, ORD-18 and MONEY-01, the Phase 7 notes line under the roadmap success criteria (including the clause that criterion 2's "overpayment rule across all mutation types" is superseded by D-12), and Phase 7.1 "Legacy Fit Check (read-only)" is inserted (D-33). **Left open on purpose:** whether refunds on a soft-deleted order count toward money on hand. No wording was added; it is parked in the STATE.md Owner backlog for when the money-on-hand reports are planned. (owner, 2026-10-28)
- **D-40:** **The discount cap stays in the domain only for now.** No database check on `Orders` (such as discount total at most subtotal) is added in Phase 7. Revisit after Phase 7.1 measures the legacy rows. **The discount messages in `OrderRules.cs` are approved as written** (07-10), so Phase 8 mirrors them in zod. (owner, 2026-10-28)
- **D-41:** **The payment messages in `OrderRules.cs` are approved as written** (07-11), so Phase 8 mirrors them in zod. **A payment may be dated before the order date.** The only payment-date rule stays "not in the future" (D-30). (owner, 2026-10-28)

### Carried forward (not re-asked)
- **No overpayment by payment** (OD-4, 2026-10-13).
- **Names:** Subtotal before discount, Total after discount, Balance is Total minus Paid (C-13, 02 D-41 R2-06). The ORD-2026-0148 fixture's "Total ₱22,450.00" is the Subtotal in these names.
- **Rounding** to the centavo, half away from zero (C-25, 02 D-09).
- **Paid by on order expenses** is always an active Admin or Manager (OD-21, 06 D-17). Received by and Paid by use the Phase 6 staff rule: an active Admin or Manager who has had a first sign-in (06 D-32, D-49), with the existing plain-English error (06 D-56).
- **409 pattern:** form saves carry the row version and keep typed values on conflict; single-click actions act on the latest state (05 D-20, D-21).
- **No inline SQL** (06 D-50) and **no new triggers** (OR-7). The numbering lock uses EF's own API.
- Soft-deleted staff show as "{name} (former staff)" (05 D-07 to D-11).

### Claude's Discretion
- The exact field names for customer credit and refund totals in the DTOs, as long as the PRD names (D-41 R2-06) stay.
- The list endpoint's page size, filters and URL parameter names (WEB-10), and the index set.
- How the per-year counter is locked, as long as it uses EF's API (06 D-50) and the race tests prove it.
- The shape of the staff-lookup reuse and the list endpoints for the three new lists.
- The dev seed contents for orders, beyond the UI-spec §12.2 fixtures.
- Which rule constants `Order.Import` relaxes, as long as each one is a named constant (ORD-21).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` (Phase 7, line 749): goal, success criteria, the decision list closed above and the research flags (EF complex-type `Money` with `Sum`/`OrderBy`; counter locking under the execution strategy)
- `.planning/REQUIREMENTS.md`: ORD-01 to ORD-23, MONEY-01 (refunds now count, D-08), MIG-09 (legacy receivers), SEC-07 and SEC-08, AUDIT-01. Amended by D-01 (ORD-17), D-12 (ORD-05), D-18 (ORD-13) and D-26 to D-28 (ORD-06).
- `.planning/PROJECT.md`: owner decision table (OD-3 to OD-7, OD-8, OD-15, OD-16, OD-21) and conflict table (C-1, C-3, C-13, C-14, C-15)
- `.planning/research/SUMMARY.md`: C-24, C-37 to C-39, C-42 to C-44

### Behavior and data
- `CSPS-PRD.md` §5.1 (Order aggregate, line 165) and §6.4 (Orders, line 248). Its price-item FK on items is dropped (C-44, D-18).
- `docs/CSPS-UI-SPEC.md` §8.5 to §8.7 (orders screens, line 1069), §9 (data model and formulas, line 1317), §9.5 (lists), §12.2 (order seed fixtures, line 1465). Its fixed lists, six statuses and "permanently deleted" copy are superseded by D-01, D-16 to D-18 and D-26 to D-28.

### Prior phase decisions
- `.planning/phases/06-company-expenses/06-CONTEXT.md`: the slice pattern, D-01 to D-15 (delete and list rules reused), D-17, D-21, D-30, D-32, D-33, D-49, D-50, D-56
- `.planning/phases/05-profile-user-management/05-CONTEXT.md`: D-07 to D-11, D-20, D-21, D-40
- `.planning/phases/02-web-foundation-design-system/02-CONTEXT.md`: D-09 (rounding), D-41 R2-06 (names)
- `docs/operations/audit-log.md`: the audit event catalog

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Csps.Domain/Orders/OrderMath.cs`, `OrderMathModels.cs`: the order math with PRD names and a list of discounts. It needs refunds and customer credit added.
- `src/Csps.Domain/Expenses/ExpenseCategory.cs`, `ExpenseCategorySeed.cs`, `CategoryTones.cs` and `src/Csps.Application/ExpenseCategories/`: the editable-list pattern to copy for payment methods, order expense categories and product types
- `src/Csps.Domain/Expenses/CompanyExpense.cs`, `ExpenseRules.cs`: soft delete, payer validation and rule constants
- `src/Csps.Application/Staff/ListStaffHandler.cs`, `StaffState.cs`: the staff lookup for Received by, Paid by and the refunder
- `src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs`: the EF-only lock pattern (06 D-50) for the order counter
- `tests/fixtures`, `Csps.Testing`: the test harness and fixtures

### Established Patterns
- One handler per use case, FluentValidation in handlers, `Result<T>` to ProblemDetails, one `[ApiController]` per resource with explicit policies, authorization-matrix test over every action
- `rowversion` per aggregate with 409, UTC storage and `IBusinessCalendar` for Manila dates
- Money as `decimal(18,2)`, computed only on the server

### Integration Points
- Phase 8 builds the screens and the Settings sections on this API.
- Phase 10 money on hand reads payments (Received by), refunds (D-08) and order expenses (Paid by).
- Phase 7.1 (D-33) reads `CSPS_Legacy_Restore` against `Order.Import`.

</code_context>

<specifics>
## Specific Ideas

- "Delivered" is for orders that were handed over to the customer while money may still be owed. Completed means handed over and fully paid.
- The owner added Cheque to the starting payment methods.

</specifics>

<deferred>
## Deferred Ideas

- Using a customer credit on another order: not discussed; a refund clears it for now.
- The final rule for legacy receivers and payers stays in Phase 15 (MIG-09).
- OD-16's other questions (transfers above balance, deactivated staff's cash) stay in Phase 10.

</deferred>

---

*Phase: 07-order-domain-api*
*Context gathered: 2026-10-27*

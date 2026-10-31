# Phase 7: Order Domain & API - Research

*Created: 2026-10-28T01:55:00-05:00 · Updated: 2026-10-28T01:55:00-05:00*

**Researched:** 2026-10-28
**Domain:** .NET 10 / EF Core 10 order aggregate, concurrency, per-year numbering, audit, managed lists (backend only)
**Confidence:** HIGH for the codebase patterns and EF behaviour; MEDIUM for a few design defaults that need an owner nod (listed in the Assumptions Log)

## Summary

Phase 7 is a copy-and-extend of the Phase 6 slice, scaled up to an aggregate with six child collections. Almost every
building block already exists in the repo and was read this session: `Result<T>` to ProblemDetails, one handler per use case
with FluentValidation inside the handler, `IUnitOfWork.InTransactionAsync` with savepoints, `ConflictRetry`, `EditErrors.Stale`
(the 409 text), `RowVersions` (base64 of 8 bytes), the `RecordStampInterceptor` for SEC-08, the EF-only `DatabaseLocks` row lock
(D-50), named soft-delete query filters, `IStaffDirectory.GetStaffStateAsync` with the `CanPay` rule, `IBusinessCalendar` with
`BusinessClock.Year`, `AuditDetailFormat`, the authorization matrix, `ConcurrentRequests`, `CommandCounter`, the OpenAPI snapshot
and the shared golden-vector file. **No new package is needed.**

The two research flags from the roadmap resolve cleanly. (1) **Money complex type spike: not needed.** The codebase stores money
as plain `decimal` with `HasPrecision(18, 2)` everywhere (`CompanyExpense.Amount`), so the order uses plain decimal columns and
a persisted totals snapshot; no `Money` complex type, so there is no `Sum`/`OrderBy` translation risk. (2) **Counter locking
under the execution strategy: no conflict.** The context is configured without `EnableRetryOnFailure` (verified in
`CspsDbContextOptions.cs`), so user transactions are allowed, and the existing code already opens them (`CspsUnitOfWork`,
`IdempotencyGate`). The per-year counter is serialized with the existing standing-lock pattern (`DatabaseLocks.TakeAsync`, an
`ExecuteUpdate` on a lock row inside the transaction) plus a tracked counter row. That is pure EF API, so **no raw SQL and no
owner exception is needed** (the `MERGE ... WITH (HOLDLOCK)` in `.planning/research/ARCHITECTURE.md` is superseded by D-50).

The one real design hazard is concurrency on child-only edits. SQL Server's `rowversion` only moves when its own row is
updated, and EF only checks the token on rows it UPDATEs or DELETEs [CITED: learn.microsoft.com/ef/core/saving/concurrency].
Adding a payment inserts a `Payments` row and never touches `Orders`, so two payments could both pass the balance check. The fix
is for every aggregate method to bump an edit marker on the root (the existing `IEditVersioned` pattern), which forces
`UPDATE Orders ... WHERE RowVersion = @original` in the same save. That also gives SEC-08's "a child change stamps its order" for
free through the existing interceptor.

**Primary recommendation:** Build `Order` as a rich aggregate root (children as EF entities with cascade, root-only
`rowversion`, `IEditVersioned` touch on every mutation, persisted totals snapshot computed by `OrderMath`), allocate numbers
under a new `order-numbers` standing lock row, and copy the Phase 6 handler, controller, audit and test shapes one for one.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Order rules (status moves, lock on end states, overpayment, credit, refund caps, discount cap) | Domain (`Csps.Domain/Orders`) | Application validators (field shape only) | Invariants must hold for every caller, including `Order.Import`; the domain re-checks everything (Phase 6 `CompanyExpense.Create` precedent) |
| Totals and customer credit | Domain (`OrderMath`) | Database (persisted snapshot + CHECK) | Core Value: server-computed; the DB only stores the domain's answer and a CHECK guards the arithmetic |
| Order numbering `ORD-{YYYY}-{NNNN}` | Infrastructure (counter store + `DatabaseLocks`) | Domain (`OrderNumber` format/parse) | Needs a DB lock inside the create transaction; formatting is pure |
| Business year (Manila) | Infrastructure (`BusinessCalendar`) | Domain (`BusinessClock.Year`) | Existing port; never `DateTime.Now` |
| Received by / Paid by / Refunded by validation | Application (handlers via `IStaffDirectory`) | Domain (non-empty id) | Same as Phase 6: DB lookup belongs in the handler, the domain only refuses `Guid.Empty` |
| 409 on stale edits | Application (version compare) + Infrastructure (EF token + `ConcurrencyConflictException`) | API (409 ProblemDetails) | Existing `CspsUnitOfWork` and `EditErrors.Stale` |
| Soft delete hiding | Infrastructure (named query filter `SoftDelete`) | Application (Manager-only views) | Phase 6 slice item 5 |
| Audit entries | Application (`IAuditTrail.Record` in the same save) | Infrastructure (append-only table) | Phase 6 slice item 6 |
| Managed lists (payment methods, order expense categories, product types) | Domain (entry entity) + Application (handlers) | Infrastructure (unique index, FK NoAction, `HasData` seed) | Copies `ExpenseCategory` (D-19) |
| HTTP surface | API (`[ApiController]` per resource, thin actions) | - | Owner rule (2026-10-07) |
| Typed client contract | Tooling (OpenAPI snapshot, `openapi-typescript`) | Web (`api.generated.ts`, `auditCopy.ts` labels) | Every API change regenerates both committed files |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
- Using a customer credit on another order: not discussed; a refund clears it for now.
- The final rule for legacy receivers and payers stays in Phase 15 (MIG-09).
- OD-16's other questions (transfers above balance, deactivated staff's cash) stay in Phase 10.

Also out of scope (CONTEXT `<domain>`): order screens and the Settings page sections for the new lists (Phase 8), order images and Cloudinary (OD-9, later phase), money on hand and transfers (Phase 10), the dashboard (Phase 10), reusable customers (CUST-01, v2), the final legacy migration (Phase 15).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORD-03 | Create an order (details, dates, status, notes, 1+ items) in one transaction; API accepts the full aggregate (optional payments, discounts, expenses) | Pattern 1 (aggregate), Pattern 3 (create flow: number lock, then one save), Code Example "create handler skeleton" |
| ORD-05 | Update details and add/edit/remove items, payments, discounts, expenses; revalidate invariants; recompute totals server-side; overpayment rule (amended by D-12) | Pattern 1 (every mutation ends in `Recalculate()`), Pattern 4 (money rules table), Pitfall 3 (discount cap after item removal) |
| ORD-08 | Concurrent edits incl. child-only edits return 409 | Pattern 2 (root touch via `IEditVersioned`), Pitfall 1, race tests in Validation Architecture |
| ORD-13 | Item has a product type + free-text size/variant (amended by D-18: managed list) | Pattern 6 (managed lists), `ProductTypes` table with FK NoAction |
| ORD-14 | `ORD-{YYYY}-{NNNN}`, sequential per year, unique, concurrency-safe; legacy numbers preserved | Pattern 3 (counter + `order-numbers` lock row), Pitfall 4 (year from save instant), 20-way race test |
| ORD-16 | Status change history (from, to, who, when) | Pattern 5 (`OrderStatusChange` child rows, reopen included) |
| ORD-17 | Ruled transitions (amended by D-01 to D-05: seven statuses) | Pattern 5 (transition table) |
| ORD-18 | Payments on cancelled orders and refunds per policy | Pattern 4 (refund caps), D-07 to D-10, Open Questions 1 and 2 |
| ORD-20 | ORD-2026-0148 fixture math exact | Existing `OrderMath` + golden vector `ORD-2026-0148` case; extend with refunds/credit without changing v2 vectors (Pitfall 6) |
| ORD-21 | `Order.Import` lenient path with named rule constants | Pattern 7 (`OrderImportRules`), D-14, D-22, D-32 |
| ORD-22 | Payment Received by: required, active Admin/Manager on create/edit/full create; change audited | `IStaffDirectory.GetStaffStateAsync(...).CanPay` (verified), Phase 6 `CheckChangedReferencesAsync` shape |
| ORD-23 | Order expense Paid by: same rule; change audited | Same as ORD-22; separate `order.expense-payer-changed` entry (06 D-27 shape) |
| ORD-01/02/06 (server side only) | List projected server-side without N+1, search/filter/sort/page; delete cascade + type-number confirm | Pattern 8 (reader: two commands), persisted totals, `GET /orders/deleted`, `DELETE /orders/{id}/permanent?confirm=` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Binding directives from `./CLAUDE.md`, `./.claude/CLAUDE.md` and the owner's global rules, as they apply to this backend phase:

- **Stack:** .NET 10 / C# 14, `[ApiController]` + attribute routes under `/api/v1`, one controller per resource, thin actions that call one handler; EF Core 10 code-first, **Fluent config only**; FluentValidation 12 in handlers (no `FluentValidation.AspNetCore`); no MediatR, no AutoMapper (manual mapping).
- **Default-deny:** every action declares `[Authorize(Policy = ...)]` or `[AllowAnonymous]`; the authorization-matrix test discovers every action, so **every new route needs a matrix row** ({anonymous, Admin, Manager} with exact statuses).
- `SuppressModelStateInvalidFilter` is on: validation goes FluentValidation in the handler, then `Result<T>`, then ProblemDetails.
- **Onion:** Domain ← Application ← Infrastructure ← Server, enforced by ArchUnitNET (`LayerTests.cs`). Application never sees EF (hence `ConcurrencyConflictException`).
- **`rowversion` per aggregate**, 409 on conflict with "This was changed by someone else. Reload and try again."
- **UTC storage + `TimeProvider` / `IBusinessCalendar`.** Never `DateTime.Now`.
- **Money:** `decimal(18,2)`, computed server-side only.
- **Schema:** every table/column from EF migrations; **no JSON columns**; no drops/renames/lossy type changes without the owner; production gets reviewed idempotent scripts; never `Database.Migrate()` at startup.
- **No inline SQL in `src`** (`NoInlineSqlTests` bans `ExecuteSql`, `FromSql`, `SqlQuery`, `CommandText`, `new SqlCommand`, `ExecuteNonQuery`, `ExecuteScalar`; the allow-list is empty, D-50). Migrations are the only exception.
- **No new database triggers** (OR-7). `TriggerInventoryTests` fails on any trigger other than `TR_AuditLog_AppendOnly`.
- **SEC-06:** every state-changing `POST` needs an `Idempotency-Key` (or an allow-listed reason). PUT/PATCH rely on `rowversion`.
- **SEC-08:** `CreatedBy/At`, `UpdatedBy/At` set only by `RecordStampInterceptor`; DTOs never accept them; a forged-values test per aggregate.
- **TDD** (red, green, refactor). **Zero warnings** in build, analyzers, tests (and EF runtime warnings in logs, see Pitfall 5).
- **Coverage:** Domain 100%, Application ≥ 95%.
- **CWE Top 25** drives the security review; append-only audit log; no secrets or data in git.
- **Shared machine:** LocalDB `(localdb)\MSSQLLocalDB` with `CSPS_*` databases only; never touch `BetsLLC_*`; run `C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` before a full test run; never set User/Machine env vars (`CSPS_TEST_SQL`, `CSPS_WRITE_OPENAPI_SNAPSHOT` per process only); never run a command that reads stdin; leave no background shell.
- **Packages:** none proposed. Any later package needs the exact-version check (advisories, regressions, deprecation, license MIT/Apache-2.0/BSD/ISC, ≥ 14 days old) and owner approval.
- **Writing:** plain English; minimal comments with no history narration; every markdown file carries created/updated timestamps.
- **Merges** only through `tools/scripts/Merge-PullRequest.ps1` on the owner's instruction.

## Standard Stack

### Core (all already pinned in `Directory.Packages.props`; verified this session)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Microsoft.EntityFrameworkCore.SqlServer | 10.0.13 | Aggregate persistence, named query filters, `ExecuteUpdate`, `rowversion` | Project stack; named filters and non-expression `ExecuteUpdate` are EF 10 features [CITED: learn.microsoft.com/ef/core/what-is-new/ef-core-10.0/whatsnew] |
| Microsoft.EntityFrameworkCore.Design | 10.0.13 | `dotnet ef migrations add` (local tool) | Project stack |
| FluentValidation | 12.1.1 | Request validators run inside handlers | Project stack (Phase 6 validators) |
| Microsoft.AspNetCore.Identity.EntityFrameworkCore | 10.0.13 | `ApplicationUser` FKs for Received by / Paid by / Refunded by | Existing |

### Supporting (tests; all pinned)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| xunit.v3 | 4.0.1 | Test framework on MTP | All tests |
| Shouldly | 4.3.0 | Assertions | All tests |
| NSubstitute | 6.2.0 | Port fakes in Application unit tests | Handler tests |
| Microsoft.Extensions.TimeProvider.Testing | 10.10.0 | `FakeTimeProvider` for New Year and future-date tests | Numbering, date rules |
| TngTech.ArchUnitNET (+ xUnitV3) | 0.13.4 | Layer rules | Existing `LayerTests` cover new namespaces automatically |
| Respawn / Testcontainers.MsSql | 7.0.0 / 4.15.0 | DB reset / CI SQL container | Existing fixture (`CspsDatabase`) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Persisted totals snapshot on `Orders` | Compute totals on read with correlated sums | Read-time sums make ORD-02 sort by balance/total and "has balance" non-indexable and risk N+1; the snapshot costs nothing because the root row is rewritten on every child change anyway |
| Standing lock row + tracked counter row | `MERGE ... WITH (HOLDLOCK)` via `DbCommand` (ARCHITECTURE.md) | Raw SQL is banned (D-50, `NoInlineSqlTests`) |
| Standing lock row + tracked counter row | SQL `SEQUENCE` per year | Needs runtime DDL per year (least-privilege login can't), leaves gaps on rollback, and `NEXT VALUE FOR` needs raw SQL |
| Plain decimal columns | EF 10 struct complex type `Money` | No benefit in this codebase; adds the translation spike the roadmap flagged |
| Three typed list tables | One `LookupEntries` table with a `Kind` column | A single table lets a payment point at a product type row unless a composite FK is added; typed tables give plain FKs |

**Installation:** none. No package is added or bumped.

## Package Legitimacy Audit

No external package is installed, added or bumped in this phase. Every library above is already pinned in
`Directory.Packages.props` and was approved in earlier phases.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | - | - | - | - | - | No install |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Package choices needing owner approval:** none

## Architecture Patterns

### System Architecture Diagram

```
 HTTP client (Phase 8 web, future Android, tests)
        |
        v
 [Csps.Server] middleware: correlation id -> body limit (1 MB) -> auth (JWT) -> IdempotencyMiddleware (POST only:
        |          claim key, open OUTER transaction, replay stored answer) -> controller
        v
 OrdersController / OrderPaymentsController / ... (thin: build request, call ONE handler, map Result -> HTTP)
        |
        v
 [Csps.Application] handler
   1. caller id from IRequestContext (401 if none)
   2. clock = IBusinessCalendar.GetClockAsync  (Today, Year, UtcNow in Asia/Manila)
   3. FluentValidation of the body (400 lists every field)
   4. reference checks: list entries active?  staff.GetStaffStateAsync(id).CanPay?  (400 on the field)
   5. unitOfWork.InTransactionAsync  (joins the idempotency transaction through a savepoint)
        |    a. create only: IOrderNumbers.NextAsync(year) -> takes 'order-numbers' lock row, bumps counter row
        |    b. load Order + children (tracked, split query)  -> 404 if missing/soft-deleted
        |    c. compare form version with order.RowVersion   -> 409 edit.stale
        |    d. call aggregate method (Domain) -> Result: 400 field error / 422 rule error
        |          aggregate re-checks invariants, Recalculate() snapshot, Touch() (EditVersion)
        |    e. audit.Record(...) one or more entries
        |    f. SaveChanges: INSERT/UPDATE/DELETE children + UPDATE Orders ... WHERE RowVersion=@orig
        |          0 rows -> DbUpdateConcurrencyException -> ConcurrencyConflictException -> 409
        v
 [Csps.Domain] Order aggregate + OrderMath (pure, no clock reads, no I/O)
        |
        v
 [Csps.Infrastructure] EF: RecordStampInterceptor (SEC-08 stamps), AuditLog append-only interceptor
        |
        v
 SQL Server: Orders (+ totals snapshot, CHECKs, rowversion) / OrderItems / Payments / Refunds / Discounts /
             OrderExpenses / OrderStatusChanges / OrderNumberCounters / PaymentMethods / OrderExpenseCategories /
             ProductTypes / DatabaseLocks ('order-numbers') / AuditLog
        |
        v
 handler re-reads the detail (AsNoTracking projection) -> OrderDetailResponse (totals, credit, version, history)
```

### Recommended Project Structure

```
src/Csps.Domain/Orders/
  Order.cs                    # aggregate root: Create, Import, UpdateDetails, Add/Edit/Remove<Child>, ChangeStatus, SoftDelete, Restore
  OrderItem.cs, Payment.cs, Refund.cs, Discount.cs, OrderExpense.cs, OrderStatusChange.cs   # child entities
  OrderStatus.cs              # enum, explicit byte values from 1
  OrderStatusRules.cs         # transition table (D-02 to D-05)
  OrderRules.cs               # limits + plain-English messages (ExpenseRules shape)
  OrderImportRules.cs         # named relaxations for Order.Import (ORD-21)
  OrderNumber.cs              # format ORD-{YYYY}-{NNNN:D4 minimum}, parse, legacy verbatim
  OrderNumberCounter.cs       # Year PK, LastValue; Next(), EnsureAtLeast(n)
  OrderTotals.cs              # snapshot value (Subtotal, Discount, Total, Paid, Refunded, Balance, CustomerCredit, Expenses)
  OrderChanges.cs             # ValueChange records for audit (reuse Expenses.ValueChange<T>)
  OrderMath.cs, OrderMathModels.cs    # existing; add refunds + credit (Pitfall 6)
src/Csps.Domain/Lists/        # (or keep under Orders/) managed list entries
  ManagedListEntry.cs         # shared base: Name, NormalizedName, Tone, RetiredAtUtc, Rename/Recolor/Retire/Reactivate
  PaymentMethod.cs, OrderExpenseCategory.cs, ProductType.cs, *Seed.cs
src/Csps.Domain/Identity/ or Orders/
  LegacyHolder.cs             # fixed id + display name of the "Legacy / unassigned" holder (D-32)
src/Csps.Application/Orders/         # one handler per use case + requests, validators, responses, OrderErrors, OrderAuditDetail
src/Csps.Application/OrderLists/     # (or per list) list handlers, generic or per list (see Pattern 6)
src/Csps.Application/Ports/          # IOrders, IOrderReader, IOrderNumbers, IPaymentMethods, IOrderExpenseCategories, IProductTypes
src/Csps.Infrastructure/Orders/      # OrderStore, OrderReader, OrderNumberAllocator, list stores, OrdersRegistration
src/Csps.Infrastructure/Persistence/Configurations/  # one IEntityTypeConfiguration per table
src/Csps.Server/Controllers/         # OrdersController, OrderItemsController, OrderPaymentsController, OrderRefundsController,
                                     # OrderDiscountsController, OrderExpensesController, PaymentMethodsController,
                                     # OrderExpenseCategoriesController, ProductTypesController
src/Csps.Server/Composition/OrdersApplicationRegistration.cs
docs/api/orders.md, docs/api/order-lists.md, docs/operations/audit-log.md (new events)
```

### Pattern 1: The aggregate owns every rule and ends every mutation the same way

**What:** `Order` is a sealed class with private setters and private backing lists (`_items`, `_payments`, `_refunds`,
`_discounts`, `_expenses`, `_statusChanges`), exposed as `IReadOnlyList<T>`. Every public mutating method:
1. refuses when the order is locked (Completed/Cancelled), except the refund exception (D-05);
2. checks field rules again (Phase 6 `CompanyExpense.CheckFields` precedent: "checking every field rule again so no caller can skip one");
3. applies the change;
4. checks the cross-child invariants (Σ discount ≤ subtotal; payment ≤ balance; refund ≤ cap; at least one item);
5. calls `Recalculate()` which writes the totals snapshot from `OrderMath`;
6. calls `Touch(now)` which sets `EditVersion = Guid.CreateVersion7(now)`;
7. returns a `Result<...Changes>` that the handler turns into audit entries.

A failed check returns before anything is assigned (Phase 6 `Update` precedent: "Nothing is assigned when a rule fails").

**When to use:** every write: create, import, details edit, child add/edit/remove, status change, soft delete, restore.

**Children as entities, not owned or complex types.** Each child needs its own id for nested routes and per-row edit/delete.
Map them as entity types with a required FK to `Orders`, `OnDelete(Cascade)`, `ValueGeneratedNever` keys (version 7 ids made by
the domain, as `CompanyExpense` does), and `UsePropertyAccessMode(PropertyAccessMode.Field)` on the navigations.

### Pattern 2: Root touch makes child-only edits hit the row version (ORD-08, SEC-07, SEC-08)

**What:** `Order : IAttributedRecord, IEditVersioned`. `Touch(now)` assigns a new `EditVersion`, so the `Orders` entry is
`Modified` and EF issues `UPDATE [Orders] SET ... WHERE [Id] = @id AND [RowVersion] = @original` in the same `SaveChanges` as the
child INSERT/UPDATE/DELETE. If another request changed the order first, zero rows match, EF throws `DbUpdateConcurrencyException`
[CITED: learn.microsoft.com/ef/core/saving/concurrency], `CspsUnitOfWork` turns it into `ConcurrencyConflictException`
[VERIFIED: src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs:22-26 `catch (DbUpdateConcurrencyException exception)` ... `throw new ConcurrencyConflictException(exception);`], the transaction rolls back (the child insert too), and
the handler answers `EditErrors.Stale`.

**Why `IEditVersioned` and not a custom interceptor:** `RecordStampInterceptor` already stamps `UpdatedById`/`UpdatedAtUtc` on a
`Modified` `IEditVersioned` entry only when `EditVersion` changed [VERIFIED: src/Csps.Infrastructure/Persistence/RecordStampInterceptor.cs:66-75 `if (entry.Entity is not IEditVersioned)` ... `return !Equals(version.OriginalValue, version.CurrentValue);`].
So the root gets "Last changed by" on every child change (SEC-08: "A change to a child record ... stamps the child and its
order") with zero new infrastructure. Children implement `IAttributedRecord` only.

**Only the root has a `RowVersion`.** The version a form sends back is the order's version (base64 of 8 bytes,
`RowVersions.TryParse`). Every child write answers the full `OrderDetailResponse`, so the client always holds the current version.

**Form saves vs single clicks (05 D-20, D-21, carried forward):**

| Action | Carries `version`? | On conflict |
|---|---|---|
| Create order (POST) | no (new) | n/a; Idempotency-Key |
| Edit details (PUT) | yes | 409 `edit.stale`, never retried |
| Add item / payment / refund / discount / expense (POST) | **yes** + Idempotency-Key | 409 `edit.stale` (this is the "two payments against one balance" case) |
| Edit a child (PUT) | yes | 409 |
| Remove a child (DELETE) | no | `ConflictRetry.RunAsync`: reload and decide again once, then 409 |
| Change status (POST) | no + Idempotency-Key | `ConflictRetry`; rules (Completed needs ₱0.00) re-checked on the latest state |
| Soft delete / restore / permanent delete | no | `ConflictRetry`, second pass that finds nothing is 404 |

### Pattern 3: Per-year numbering with EF's own API (ORD-14, D-23)

**What:**
- New table `OrderNumberCounters (Year int PK, LastValue int NOT NULL)`, `CHECK ([LastValue] >= 0)`.
- New standing lock row `order-numbers` in `DatabaseLocks` (add the name to `DatabaseLocks.StandingNames`; the configuration's
  `HasData` then makes the migration insert it, exactly as the 65 existing rows were made)
  [VERIFIED: src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs:22 `builder.HasData(DatabaseLocks.StandingNames.Select(name => new { Name = name }));`].
- `IOrderNumbers.NextAsync(int year, ct)` in Infrastructure, called **first** inside the create transaction:
  1. `DatabaseLocks.TakeAsync(context, "order-numbers", now, DatabaseLocks.DefaultWait, message, ct)`: an `ExecuteUpdate` on the
     lock row that SQL Server holds to the end of the transaction [VERIFIED: src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs:72-75 `.ExecuteUpdateAsync(set => set.SetProperty(row => row.TakenAtUtc, now), cancellationToken)`];
  2. read the year's counter row tracked (`SingleOrDefaultAsync`); if missing, `Add(OrderNumberCounter.Start(year))`;
  3. `counter.Next()` increments `LastValue` and returns it; the counter row saves with the order in the same `SaveChanges`.
- Because every create takes the same lock first, the read-modify-write cannot race, a new year's first row cannot be inserted
  twice, and a rollback (validation failure after allocation, deadlock, cancelled request) rolls the increment back, so numbers
  stay **gapless**. The `Year` primary key and a unique index on `Orders.Number` are the backstops.
- **Year:** `clock.Year` from `IBusinessCalendar` (business today's year in the SiteSettings zone)
  [VERIFIED: src/Csps.Domain/Time/BusinessClock.cs:21 `public int Year => Today.Year;`], read inside the transaction just
  before allocation.
- **Format:** `ORD-{year}-{n:D4}` where D4 is a minimum width (`ORD-2026-10000` if a year ever passes 9,999; never truncate).
  `Number` column `varchar(32)`, unique index.
- **Legacy numbers** are stored verbatim by `Order.Import`. The import store calls `counter.EnsureAtLeast(nnnn)` when a legacy
  number parses as `ORD-{YYYY}-{NNNN}`, so the next new number never collides.

The lock wait is `DatabaseLocks.DefaultWait` (10 s) [VERIFIED: src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs:20 `public static readonly TimeSpan DefaultWait = TimeSpan.FromSeconds(10);`].
At shop scale (about 5 staff) serializing creates costs nothing. A timeout answers a plain 409/503-style busy error, never a 500.

### Pattern 4: Money rules (D-03, D-09 to D-15, D-30)

`OrderMath` gains refunds. Recommended field names (Claude's discretion, PRD names kept):

| Field | Formula | Notes |
|---|---|---|
| `subtotal` | round(Σ qty × unitPrice) | PRD Subtotal; the fixture's "Total ₱22,450.00" |
| `discount` | round(Σ round(each discount)) | existing D-09 order |
| `total` | subtotal − discount | ≥ 0 by invariant (Σ discount ≤ subtotal) |
| `paid` | Σ payments | unchanged meaning, so the v2 vectors still hold |
| `refunded` | Σ refunds | new |
| `balance` | total − paid + refunded | may be negative (credit) |
| `customerCredit` | max(−balance, 0) | D-12 "Totals expose the credit explicitly" |
| `expenses` | Σ order expenses | |
| `profit` | total − expenses (see Open Question 3 for Cancelled) | internal |
| `fullyPaid` | subtotal > 0 and balance ≤ 0 | existing D-41 R2-06 rule |

Rules each mutation enforces:

| Mutation | Rule | Error kind |
|---|---|---|
| Add/edit payment | amount > 0, ≤ 1,000,000.00, 2 dp; date ≤ business today; **resulting balance ≥ 0** unless the edit lowers the amount (D-11) | 400 on `amount` |
| Add/edit/remove item, add/edit discount | allowed to push balance below 0 (D-12); **Σ discount ≤ subtotal** stays | 400 / 422 |
| Remove last item | refused: an order keeps ≥ 1 item (ORD-03) | 422 |
| Add refund | order is Cancelled **or** shows a credit (D-09); amount ≤ paid − earlier refunds (D-09); see Open Question 1 for the credit cap | 422 / 400 |
| Status → Completed | balance == 0.00 exactly (D-03) | 422 |
| Any change on Completed/Cancelled | refused, except refunds on Cancelled (D-05) | 422 `orders.locked` |

The overpayment check and the version check sit in the same transaction as the save; the root UPDATE with the original
`RowVersion` makes the check race-free (SEC-07 "check-then-write ... can't both pass"), because the loser's UPDATE matches zero
rows after the winner commits.

### Pattern 5: Status machine and history (ORD-16, ORD-17, D-01 to D-06)

`OrderStatus : byte` with explicit values from 1 (the codebase stores enums as `byte`, e.g.
`builder.Property(token => token.Purpose).HasConversion<byte>();` [VERIFIED: src/Csps.Infrastructure/Persistence/Configurations/AccountTokenConfiguration.cs:21]),
plus `CHECK ([Status] BETWEEN 1 AND 7)`. Values are stored data, so they never get renumbered: Pending = 1, Mockup = 2,
InProduction = 3, Ready = 4, Delivered = 5, Completed = 6, Cancelled = 7 [ASSUMED numbering]. Wire values are the web's
existing keys plus `delivered`: `pending`, `mockup`, `production`, `ready`, `delivered`, `completed`, `cancelled` (the web union
today is `export type OrderStatus = 'pending' | 'mockup' | 'production' | 'ready' | 'completed' | 'cancelled';`
[VERIFIED: web/src/utils/csps.ts:13]).

Transition table:

| From \ To | any active | Completed | Cancelled |
|---|---|---|---|
| active (Pending..Delivered) | allowed (D-02) | only if balance == 0.00 (D-03) | allowed (D-02) |
| Completed | **reopen** (D-04) | no-op | refused: reopen first [ASSUMED] |
| Cancelled | **reopen** (D-04) | refused: reopen first [ASSUMED] | no-op |

- Same-status requests answer 200 with the order and write nothing (Phase 6 no-op precedent).
- Every real move appends `OrderStatusChange(Id, OrderId, FromStatus?, ToStatus, ChangedById, ChangedAtUtc)`; the create writes
  the first row with `FromStatus = null` so the history starts at creation [ASSUMED]. `ChangedById` is set from the caller id
  passed into the domain method (it is a domain fact, unlike SEC-08 stamps).
- Add `StatusChangedAtUtc` on `Orders` (cheap, indexable) for the list's "Active + recent" filter and Phase 10.
- Audit: `order.status-changed` (`status=<from>><to>`), and `order.reopened` when leaving an end state (the history row is the same).
- Reopen is open to both roles (D-04), so no extra role check beyond `Policies.Staff`.

### Pattern 6: Managed lists (D-16 to D-20)

Copy `ExpenseCategory` [VERIFIED: src/Csps.Domain/Expenses/ExpenseCategory.cs] for three new tables: `PaymentMethods`,
`OrderExpenseCategories`, `ProductTypes`. Each row: `Id`, `Name` (≤ 40), `NormalizedName` (unique index), `Tone` (one of
`CategoryTones`: `"neutral"`, `"accent"`, `"info"`, `"mockup"`, `"warning"`, `"success"` [VERIFIED: src/Csps.Domain/Expenses/CategoryTones.cs:7-22],
CHECK constraint like `CK_ExpenseCategories_Tone`), `RetiredAtUtc`, SEC-08 stamps, `RowVersion`. Seeds are literal ids and a
literal `SeededAtUtc` (the `ExpenseCategorySeed` rule: "Ids and the stamp are literals, never a clock read or a new Guid, so the
EF model stays stable between migrations").

| List | Seed (verbatim from CONTEXT) | Protected "Others" |
|---|---|---|
| Payment methods | Cash, GCash, Maya, Bank Transfer, Cheque | none |
| Order expense categories | Fabric, Ink & paper, Outsourcing, Labor, Delivery, Others | Others (rename/retire/delete refused, recolor allowed) |
| Product types | Basketball Jersey, Volleyball Jersey, Moto Riding Jersey, Long Sleeves, Polo Shirt, Custom Design | none |

Tones per seed row are not ruled; take them from the UI spec's PAYMENT_TONE / EXPENSE_TONE where they exist [ASSUMED].

- "Used" means a child row exists now, **soft-deleted orders included** (06 D-30): count with `IgnoreQueryFilters(["SoftDelete"])`.
- FKs from children to lists are `NoAction`; the FK is the backstop for a delete racing a save (Phase 6 `TranslateSaveFailure`).
- **Generalize the save-failure translation.** `CspsUnitOfWork` calls `ExpenseCategoryStore.TranslateSaveFailure` only
  [VERIFIED: src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs:32 `var translated = ExpenseCategoryStore.TranslateSaveFailure(exception);`]. The new unique-name indexes and list FKs need the same translation, or a duplicate name
  becomes a 500. Recommend one translator that knows every list's index name and FK name.
- **Code shape (recommendation):** a shared abstract domain base for the entry behaviour, plus one set of 7 generic
  Application handlers (list, get, create, update, retire, reactivate, delete) closed per list by a small descriptor (table
  errors, audit action names, target type), and **three thin controllers** (one per resource, owner rule). This avoids three
  hand-copied rule sets drifting apart. Leave `ExpenseCategory` untouched (no Phase 6 churn).
- Routes mirror `/api/v1/expense-categories` exactly: `GET` list (Staff), `POST` (Manager, Idempotency-Key), `GET {id}`,
  `PUT {id}` with `version`, `POST {id}/retire`, `POST {id}/reactivate`, `DELETE {id}` (Manager).
- New order children refuse a retired entry; an edit that keeps a saved retired entry is allowed (06 D-11, OQ-7).

### Pattern 7: `Order.Import` (ORD-21, D-14, D-22, D-32)

A static factory beside `Create` that takes a legacy snapshot (number, all fields, all children, status, history if any) and
applies only the structural rules (non-negative quantities, money scale 2 dp, known status value). Every relaxation is a named
constant in `OrderImportRules`, for example:

| Constant | Effect |
|---|---|
| `KeepLegacyNumber = true` | number stored verbatim, any format |
| `DueDateOptional = true` | D-22 import exception |
| `AllowOverpaid = true` | D-14: imported credit kept as is |
| `AllowCompletedWithBalance = true` | D-14: D-03 not applied |
| `IgnoreAmountCaps = true` | 06 D-33: caps live in validators, not the DB |
| `AllowFutureDates = true` / `AllowRetiredListEntries = true` | legacy oddities |
| `AllowLegacyHolder = true` | D-32: receiver/payer/refunder may be the Legacy holder |
| `AllowAnyStatusHistory = true` | history rows not checked against the transition table |

Import still computes and persists totals with `OrderMath` (zero money change: the figures come from the legacy children).
Phase 7 ships the domain factory, its store path (including `EnsureAtLeast` on the counter) and tests. **No HTTP import
endpoint** is needed in Phase 7 (Phase 7.1 and Phase 15 use tooling) [ASSUMED].

**The Legacy / unassigned holder (D-32).** It must be a real `AspNetUsers` row, because `ReceivedByUserId`, `PaidByUserId`
and `RefundedByUserId` are required FKs. Recommended shape (see Open Question 4): a migration seeds one `ApplicationUser` with a
fixed id, `IsActive = false`, no password hash, `EmailConfirmed = false`, no role, and **every column a literal** (including
`EditVersion`, `SecurityStamp`, `ConcurrencyStamp`). It then fails `CanPay` (no role, inactive, never set up) so it never
appears in `GET /staff`, and it can never sign in (no password). It must also be excluded by id from the Manager roster
(`UserDirectory`), the audit people list and any user count, and it displays as "Legacy / unassigned" without "(former staff)".

### Pattern 8: Reads in two commands (ORD-01, ORD-02 server side, PERF-04)

`OrderReader` (Infrastructure, `AsNoTracking`, projections only) mirrors `CompanyExpenseReader`: one command for the page, one
for `total` (count) and any figures, whatever the page size. Totals come straight from the snapshot columns, so no child
aggregation runs in the list. Proposed query (Claude's discretion; Phase 8 confirms the UI):

| Param | Rule |
|---|---|
| `q` | ≤ 100 chars; matches number, customer name, team, contact number (escaped LIKE via existing `LikePattern`) |
| `status` | `active` (default: Pending..Delivered, plus Completed/Cancelled whose `StatusChangedAtUtc` is in the last 30 days [ASSUMED]), `all`, or one status |
| `from`, `to` | order-date pair, `yyyy-MM-dd`; default window per Phase 8 (UI default "Last 90 days") |
| `productType` | list entry id; `EXISTS` over items |
| `hasBalance` | `Balance > 0` |
| `sort` | `due` (default), `newest`, `balance`, `total`; always a stable tiebreak on `Id` |
| `page`, `pageSize` | 1 to 100000; 1 to 100, default 20 (`ListQueryLimits.MaxPageSize = 100` [VERIFIED: src/Csps.Application/Common/ListQueryRules.cs:10]) |

Index set: a filtered list index on `(Status, DueDate, Id) WHERE DeletedAtUtc IS NULL` including the totals,
`(OrderDate)`, `(StatusChangedAtUtc)`, `(Balance)` filtered, unique `(Number)`, FK indexes on every child `OrderId` and every
person FK (Phase 6 indexed every person FK). The cover image subquery waits for the images phase.

Detail read: the order row with names joined (recorder, changer, receivers, payers, refunders, deleted-by, each with
`formerStaff`), then each child collection; a handful of commands is fine for a single order.

### Anti-Patterns to Avoid

- **Raw SQL for the counter or locks:** banned (D-50); the scanner fails the build.
- **Child-only save without touching the root:** silently loses the 409 (Pitfall 1).
- **A row version on each child as the concurrency guard:** two different children never conflict, so two payments still both pass.
- **Computing totals in the handler or the reader:** the domain is the only calculator; readers read the snapshot.
- **`Include` of six collections in one query:** cartesian explosion. Use `AsSplitQuery()` on the write-path load, and leave
  `StatusChanges` unloaded on writes (appending to an unloaded backing list still inserts).
- **`HasData` with a non-literal value** (`Guid.NewGuid()`, `DateTimeOffset.UtcNow`): every later `migrations add` sees a
  change. `ApplicationUser.EditVersion` defaults to `Guid.NewGuid()`, so the holder seed must set it explicitly.
- **Mutating the shared golden vector file schema in this phase:** the web suite deep-compares `expected` (Pitfall 6).
- **Putting customer text, descriptions, notes or refund reasons in the audit detail:** D-31 / 05 D-40, field names only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A DB lock | `sp_getapplock`, `UPDLOCK` hints, a C# `SemaphoreSlim` | `DatabaseLocks.TakeAsync` + a new standing row | Already race-tested, EF-only, works across processes |
| Retry after a lost race | ad hoc loops | `ConflictRetry.RunAsync` + `IUnitOfWork.InTransactionAsync` | Clears the tracker and runs once more (Phase 6 slice item 2) |
| Version text | custom parsing | `RowVersions.TryParse` / `ToText` | base64 of exactly 8 bytes, shared message |
| 409 text | new message | `EditErrors.Stale` (`edit.stale`) | Shared by web `ConflictBanner` |
| Who/when stamps | setting `UpdatedAtUtc` in handlers | `RecordStampInterceptor` + `IEditVersioned` touch | SEC-08 "one place" |
| Business today / year | `DateTime.Now`, `TimeZoneInfo` calls | `IBusinessCalendar.GetClockAsync` → `Today`, `Year`, `UtcNow` | Asia/Manila from SiteSettings |
| Payer/receiver rule | new staff query | `IStaffDirectory.GetStaffStateAsync(id)` → `CanPay` | One rule (06 D-32, D-49) |
| Audit detail text | string concatenation | `AuditDetailFormat` (+ an `OrderAuditDetail` like `ExpenseAuditDetail`) | One format the viewer parses |
| LIKE escaping | manual escaping | `LikePattern` | `%`, `_`, `[`, `\` taken literally |
| Problem responses | manual JSON | `ResultHttpExtensions.ToHttpResult` | Error kind → status in one place |
| Rounding | `Math.Round` sprinkled around | `OrderMath` | Half away from zero, pinned operation order |
| Running 2+ requests at once in tests | `Task.WhenAll` on raw calls | `ConcurrentRequests` (extend to N-way, Wave 0) | Starts requests together |

**Key insight:** this phase's risk is not missing libraries; it is a second implementation of something the repo already
proved. Every "new" mechanism above already has a race test or a golden vector behind it.

## Common Pitfalls

### Pitfall 1: Child-only edits that never check the order's version
**What goes wrong:** two staff each add a ₱5,000 payment against a ₱9,327.50 balance; both succeed and the order is overpaid.
**Why it happens:** only `Payments` rows are written; `Orders.RowVersion` is not in any WHERE clause.
**How to avoid:** `Touch(now)` in every aggregate method (Pattern 2); a domain unit test asserts `EditVersion` changes on every
mutation; an integration race test sends two payments with the same version and asserts exactly one 2xx, one 409, and the
stored balance equals the winner's.
**Warning signs:** the SQL log of an "add payment" shows an INSERT without an `UPDATE [Orders]`.

### Pitfall 2: The idempotency transaction holds locks longer than expected
**What goes wrong:** lock waits or surprise timeouts in race tests.
**Why it happens:** every idempotent POST already runs inside an outer transaction opened by `IdempotencyGate.BeginAsync`
(`transaction = await context.Database.BeginTransactionAsync(cancellationToken)` [VERIFIED: src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs:263]);
the handler's `InTransactionAsync` joins it with a savepoint, so the `order-numbers` lock is held until the stored answer
commits.
**How to avoid:** take the lock as late as possible (after validation and reference checks, right before the save); keep
external calls out of the transaction; the 20-way race test proves the throughput.

### Pitfall 3: Discount cap after an item removal
**What goes wrong:** a fixed ₱1,000 discount stays after items drop to ₱800; total goes negative.
**How to avoid:** check Σ discount ≤ subtotal after **every** item and discount mutation (ORD-05 "discount ≤ items total");
refuse with a plain-English message naming the fix ("Lower or remove a discount first.") [ASSUMED wording].

### Pitfall 4: The wrong year at New Year
**What goes wrong:** an order saved at 00:00:30 on Jan 1 in Manila (16:00:30 UTC Dec 31) gets the old year, or an order dated
Dec 30 but saved Jan 2 gets the old year.
**How to avoid:** year = `BusinessClock.Year` of the save moment (D-23), never `OrderDate.Year`, never UTC year. Tests with
`FakeTimeProvider` at `2026-12-31T15:59:59Z` (→ 2026) and `2026-12-31T16:00:00Z` (→ `ORD-2027-0001`), via the existing
`AuthClient.WithClock(baseFactory, new FakeTimeProvider(now))` helper. Asia/Manila has no DST, so UTC+8 is fixed.

### Pitfall 5: EF warning for a filtered principal with required dependents
**What goes wrong:** `Orders` has the `SoftDelete` query filter and the children have required FKs to it; EF warns that the
required end is filtered ("This may lead to unexpected results when the required entity is filtered out") [ASSUMED exact text
and trigger], and a `Posts.Include(Blog)`-style query drops rows [CITED: learn.microsoft.com/ef/core/querying/filters,
"Query filters and required navigations"]. `appsettings.json` logs `Microsoft.EntityFrameworkCore` at `Warning`
[VERIFIED: src/Csps.Server/appsettings.json:7], which breaks the zero-warnings rule.
**How to avoid:** the documented fix is matching filters on both sides. Give each child a navigation to `Order` and declare
`HasQueryFilter("SoftDelete", child => child.Order.DeletedAtUtc == null)`. This also makes Phase 10's "payments by receiver"
query skip soft-deleted orders automatically. Add a model test that builds the model with a capturing logger and asserts no EF
warning event.

### Pitfall 6: Breaking the shared golden vectors
**What goes wrong:** adding `refunds`/`refunded`/`customerCredit` to the vector file's `expected` breaks the web suite, which
deep-compares the expected object (`web/src/utils/csps.golden.test.ts`), and the C# test pins `Version.ShouldBe(2)`.
**How to avoid:** leave `tests/fixtures/order-math-golden-vectors.json` at version 2 in this phase. Add refunds through a new
`OrderMath` input with an empty default, keep every v2 case passing unchanged, and cover refunds and credit with server-only
domain tests. Record a Phase 8 follow-up to bump the vectors to v3 when the web preview learns refunds.

### Pitfall 7: Save-failure translation only knows expense categories
**What goes wrong:** two Managers add "Cheque" at once; the unique index throws; `CspsUnitOfWork` doesn't recognise the index
and the request becomes a 500.
**How to avoid:** generalize `TranslateSaveFailure` (Pattern 6) and copy the Phase 6 "two saves at once give one 201 and one
400" test per list.

### Pitfall 8: Audit catalog drift
**What goes wrong:** new actions are added to `AuditActions` but the count test, the viewer's change-line reader and the web
labels are not.
**How to avoid:** for every new action update `AuditActions.All` (and the count in `AuditActionsTests`, today
`AuditActions.All.Count.ShouldBe(49);` [VERIFIED: tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs:14]),
`AuditChangeLines` (server-side readers), `docs/operations/audit-log.md`, and `web/src/modules/admin/auditCopy.ts` plus its test
(a hand-kept mirror of `AuditActions.All`). The web label change is small; include it in Phase 7 so the audit viewer reads
order events correctly from day one [ASSUMED scope; planner may defer to Phase 8].

### Pitfall 9: Forgetting the contract artifacts
**What goes wrong:** CI fails `OpenApiSnapshotTests` or `tools/openapi-gen check`.
**How to avoid:** after each API change, regenerate the snapshot with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` set for that one process
(the write run fails by design, then run again without it) and run `npm run generate` in `tools/openapi-gen` to refresh
`web/src/types/api.generated.ts`. Both files are committed. `node_modules` is not installed in this worktree yet (`npm ci`
first in `tools/openapi-gen`).

### Pitfall 10: Delete hiding leaks
**What goes wrong:** a soft-deleted order's payments still count somewhere (a list count, a used-entry count that should
include them, or vice versa).
**How to avoid:** default queries hide (named filter on root and children); "is this list entry used" counts **include**
soft-deleted orders (06 D-30) via `IgnoreQueryFilters(["SoftDelete"])` by name.

## Code Examples

### Root touch (domain)

```csharp
// Source: pattern from src/Csps.Domain/Common/IEditVersioned.cs and CompanyExpense.Create (Guid.CreateVersion7(now))
public sealed class Order : IAttributedRecord, IEditVersioned
{
    public Guid EditVersion { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    // Every mutating method ends here, so the Orders row is UPDATEd with its RowVersion in the WHERE clause.
    private void Touch(DateTimeOffset now) => EditVersion = Guid.CreateVersion7(now);
}
```

### Number allocation (infrastructure, EF API only)

```csharp
// Source: DatabaseLocks.TakeAsync (src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs:50-89)
internal sealed class OrderNumberAllocator(CspsDbContext context) : IOrderNumbers
{
    public async Task<string> NextAsync(int year, DateTimeOffset now, CancellationToken cancellationToken)
    {
        // Serializes every create; held to the end of the caller's transaction, so a rollback undoes the increment.
        await DatabaseLocks.TakeAsync(context, DatabaseLocks.OrderNumbers, now, DatabaseLocks.DefaultWait, OrderErrors.NumberBusyMessage, cancellationToken)
            .ConfigureAwait(false);

        var counter = await context.OrderNumberCounters.SingleOrDefaultAsync(c => c.Year == year, cancellationToken).ConfigureAwait(false);
        if (counter is null)
        {
            counter = OrderNumberCounter.Start(year);
            context.OrderNumberCounters.Add(counter);
        }

        return OrderNumber.Format(year, counter.Next());   // saved with the order in the same SaveChanges
    }
}
```
`DatabaseLocks.OrderNumbers`, `OrderErrors.NumberBusyMessage`, `OrderNumberCounter` and `OrderNumber` are new names [ASSUMED].

### Create handler skeleton

```csharp
// Source: shape of src/Csps.Application/Expenses/CreateCompanyExpenseHandler.cs
var clock = await calendar.GetClockAsync(ct);
// 1. validate the body (every field, every child) -> 400 listing all failures
// 2. reference checks: product types / methods / categories active; every receiver, payer, refunder CanPay -> 400 on the field path, e.g. "payments[1].receivedByUserId"
var outcome = await unitOfWork.InTransactionAsync(async token =>
{
    var number = await numbers.NextAsync(clock.Year, clock.UtcNow, token);
    var created = Order.Create(number, details, items, payments, discounts, expenses, callerId, clock.Today, clock.UtcNow);
    if (created.IsFailure) return Result.Failure<Guid>(created.Error);   // see the note below
    orders.Add(created.Value);
    audit.Record(AuditActions.OrderCreated, OrderTarget, AuditKey.Of(created.Value.Id), OrderAuditDetail.Created(created.Value));
    await unitOfWork.SaveChangesAsync(token);
    return Result.Success(created.Value.Id);
}, ct);
```
Note: a `Result.Failure` returned from inside the transaction commits an empty transaction, but the counter increment was
already tracked. Either validate everything (including `Order.Create`'s checks via a dry run) **before** allocating, or throw a
private exception inside the delegate so the savepoint rolls back. Recommend: build the order with a placeholder-free factory
that takes the number last (`Order.Create(...)` then `order.AssignNumber(number)`), so all domain checks run before the lock.

### Named filter on a child (Pitfall 5)

```csharp
// Source: learn.microsoft.com/ef/core/querying/filters ("consistent filters on both ... entity types")
builder.HasOne(payment => payment.Order).WithMany(order => order.Payments).HasForeignKey(payment => payment.OrderId).OnDelete(DeleteBehavior.Cascade);
builder.HasQueryFilter("SoftDelete", payment => payment.Order.DeletedAtUtc == null);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One unnamed query filter per entity | Named query filters, `IgnoreQueryFilters(["SoftDelete"])` | EF Core 10 | Already used by Phase 6; reuse the name `SoftDelete` |
| `ExecuteUpdate` takes an expression tree | Accepts a regular lambda | EF Core 10 | `DatabaseLocks.TakeAsync` already uses it |
| Owned types for value objects | Complex types (struct, optional) | EF Core 8 to 10 | Not needed here; plain columns are simpler |
| `MERGE ... HOLDLOCK` counter (ARCHITECTURE.md) | Standing lock row + tracked counter | D-50 (2026-10-26) | No raw SQL anywhere in `src` |
| Fixed product types / methods / order categories (UI spec) | Manager-editable tables | D-16 to D-18 | FKs, seeds, list APIs |
| Six statuses | Seven, with Delivered | D-01 | Web union, badges and dashboards change in Phase 8/10 |
| Refunds don't count (OD-16 default) | Refunds lower the refunder's money on hand | D-08 | Phase 10 ledger reads `Refunds.RefundedByUserId` |

**Deprecated/outdated in the planning docs:**
- PRD §5.1 "Discount (0..1)" and "SQL SEQUENCE": superseded by D-15 and D-23.
- UI spec §9.1 status list and fixed lists: superseded by D-01 and D-16 to D-18.
- ARCHITECTURE.md `AggregateRootTouchInterceptor`: not needed; the existing `IEditVersioned` path does the same job.

## Runtime State Inventory

Not a rename or migration phase. Omitted. (New tables and seeds only; no existing data is renamed.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Status byte values Pending=1 ... Cancelled=7 | Pattern 5 | Low now; costly after data exists (renumbering stored data) |
| A2 | Completed ↔ Cancelled directly is refused (reopen first) | Pattern 5 | Medium: owner may want "cancel a completed order" in one step |
| A3 | History starts with a create row (`FromStatus = null`) | Pattern 5 | Low |
| A4 | "Active + recent" = active statuses plus end states changed in the last 30 days | Pattern 8 | Low; Phase 8 can change the default without schema change |
| A5 | Tones for seed rows taken from the UI spec tone maps | Pattern 6 | Low (Managers can recolor) |
| A6 | No HTTP import endpoint in Phase 7 | Pattern 7 | Low |
| A7 | Legacy holder seeded as an inactive, role-less `AspNetUsers` row excluded by id from the roster | Pattern 7 | Medium: touches the Identity table and user-management queries |
| A8 | EF logs a warning for a filtered principal with required dependents (exact trigger/text not verified) | Pitfall 5 | Low: the matching-filter fix is documented and harmless either way |
| A9 | Discount-cap and last-item refusals as described, and their wording | Pattern 4, Pitfall 3 | Low; wording goes through the owner's copy review |
| A10 | Web `auditCopy.ts` labels updated in Phase 7 | Pitfall 8 | Low |
| A11 | Permanent delete requires `?confirm=<order number>` on the server too | Phase Requirements | Low; defence in depth for D-28 |
| A12 | Field lengths for customer name/team/contact/email/address, payment reference/notes, refund reason, discount reason, size/variant, and max children per order (rule constants) | Pattern 1 | Low; constants, mirrored in zod in Phase 8 |
| A13 | Order date has no future limit beyond being a real date | Pattern 4 | Low |

## Open Questions (for the owner; each has a recommendation)

1. **How much can a refund be on an order that is not cancelled?**
   - What we know: D-09 allows refunds on a Cancelled order or one with a credit, capped at paid minus earlier refunds.
   - What's unclear: on an active order with a ₱500 credit, may staff refund ₱2,000 (which puts the customer back in debt)?
   - Recommendation: on a non-cancelled order, cap the refund at the credit; on a cancelled order, cap at paid minus refunds.
2. **Can a refund on a Cancelled order be edited or removed without reopening?**
   - D-05 allows "recording" a refund on a Cancelled order. Fixing a typo would otherwise need reopen, fix, cancel again.
   - Recommendation: allow edit and remove of refunds on a Cancelled order (same exception), audited.
3. **Profit on a cancelled order.** D-10 says the order "shows a loss". With `profit = total − expenses` a cancelled ₱22,450
   order with ₱6,065 expenses still shows +₱16,385.
   - Recommendation: for Cancelled orders, `profit = (paid − refunded) − expenses` (money kept minus money spent); unchanged
     formula for every other status.
4. **The Legacy / unassigned holder record (D-32).** Recommended: one seeded, inactive, role-less user row with a fixed id,
   hidden from the user list by id, shown as "Legacy / unassigned". Should the same row also serve as the "Legacy import"
   creator for SEC-08 (MIG-10), or should that be a second fixed row? Recommendation: two rows, because "who holds the money" and
   "who typed it in" are different facts; Phase 7 seeds only the holder.
5. **Completed to Cancelled in one step?** Recommendation: no; reopen first (keeps D-04's "reopen is a recorded status change"
   explicit).

Planner-level questions (no owner input needed): exact DTO names (recommended: `subtotal`, `discount`, `total`, `paid`,
`refunded`, `balance`, `customerCredit`, `expenses`, `profit`, `fullyPaid`); plan slicing (below).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | build, tests, `dotnet ef` | ✓ | 10.0.402 (global.json 10.0.401, latestPatch) | - |
| LocalDB `MSSQLLocalDB` | integration tests (`CSPS_Test_<guid>`) | ✓ | 17.0.4025.3 | CI container only |
| Node | `tools/openapi-gen` type generation, web tests | ✓ | v24.21.0 | - |
| `node_modules` in the worktree (`web/`, `tools/openapi-gen/`) | `npm run generate`, web tests | ✗ | - | Run `npm ci` in each folder first (lockfiles present) |
| `dotnet-ef` local tool | `migrations add` | ✓ (local tool manifest, used by earlier phases) [ASSUMED restored] | 10.0.x | `dotnet tool restore` |
| Preflight script | full test runs | ✓ path per CLAUDE.md | - | wait if another project is busy |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** worktree `node_modules` (install with `npm ci`).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | xUnit v3 4.0.1 on Microsoft.Testing.Platform, Shouldly 4.3.0, NSubstitute 6.2.0, FakeTimeProvider |
| Config file | `global.json` (`"runner": "Microsoft.Testing.Platform"`), `tests/Directory.Build.props` |
| Quick run command | `dotnet test --project tests/Csps.Domain.UnitTests` (no DB, seconds) |
| Focused integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Order*"` |
| Full suite command | preflight, then `dotnet test --solution Csps.slnx` (plus `npm --prefix web run test` and `npm --prefix tools/openapi-gen run check` when the contract changes) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORD-20 | ORD-2026-0148 and all v2 vectors exact; refunds and credit math | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderMath*"` | ✅ (extend) |
| ORD-05 | every mutation recomputes the snapshot; snapshot equals recompute-from-children | unit (domain) + integration | `... Csps.Domain.UnitTests --filter-class "*OrderTests*"` | ❌ Wave 0 |
| ORD-05 / D-11 / D-12 | payment above balance refused; item/discount changes may create credit; Σ discount ≤ subtotal | unit + endpoint | `... Csps.Server.IntegrationTests --filter-class "*OrderPayment*"` | ❌ |
| ORD-03 | full-aggregate create in one transaction; failure mid-way leaves nothing (order, counter, audit) | integration | `--filter-class "*CreateOrderEndpoint*"` | ❌ |
| ORD-14 | 20 parallel creates give 20 distinct, contiguous numbers; New Year boundary in Manila | integration (race) | `--filter-class "*OrderNumbering*"` | ❌ (needs N-way `ConcurrentRequests`) |
| ORD-08 | same-version edits: exactly one 200, one 409; two payments with one version: one wins; child remove retries once | integration (race, 10 rounds like Phase 6) | `--filter-class "*OrderConcurrency*"` | ❌ |
| ORD-16 / ORD-17 | transition table, Completed needs ₱0.00, reopen recorded, history rows | unit + endpoint | `--filter-class "*OrderStatus*"` | ❌ |
| ORD-18 | locked end states; refund caps; refund on cancelled | unit + endpoint | `--filter-class "*OrderRefund*"` | ❌ |
| ORD-21 | `Order.Import` accepts legacy shapes per constant; counter `EnsureAtLeast` | unit + infra integration | `... Csps.Domain.UnitTests --filter-class "*OrderImport*"` | ❌ |
| ORD-22 / ORD-23 | receiver/payer/refunder must `CanPay` on create, edit and full create; change audited; saved inactive payer may stay | endpoint | `--filter-class "*OrderPeople*"` | ❌ |
| ORD-13 / D-16 to D-19 | three lists: CRUD, unique names under race, retire/delete-in-use incl. soft-deleted orders, Others protected, seeds | endpoint + migration | `--filter-class "*PaymentMethods*"` etc. | ❌ |
| D-26 to D-29 | soft delete hides everywhere; restore; permanent delete cascades and audits the snapshot (no customer text) | endpoint | `--filter-class "*OrderDeletion*"` | ❌ |
| D-31 | every event writes its entry in the same save; no free text in details | endpoint + unit (`OrderAuditDetail`) | `--filter-class "*OrderAudit*"` | ❌ |
| SEC-02 | every new action has a matrix row | integration | `--filter-class "*AuthorizationMatrix*"` and `"*AuthorizationCoverage*"` | ✅ (add rows) |
| SEC-06 | every new POST requires `Idempotency-Key`; duplicate POST creates one order | integration | `--filter-class "*OrderIdempotency*"` | ❌ |
| SEC-08 | forged CreatedBy/UpdatedBy ignored on create and edit; child change stamps the order | integration | `--filter-class "*OrderAttribution*"` | ❌ |
| PERF-04 | list in exactly two commands; timing p95 ≤ 300 ms on a multi-year seed | integration | `--filter-class "*OrderListQueryCount*"`, `"*OrderListTiming*"` | ❌ |
| Schema | migrations apply to empty DB and previous version; no new trigger; no inline SQL; idempotent script | infra + arch | `--project tests/Csps.Infrastructure.IntegrationTests --filter-class "*Migration*"`, `--project tests/Csps.ArchitectureTests` | ✅ (extend) |
| Contract | OpenAPI snapshot and generated types match | integration + node | `--filter-class "*OpenApiSnapshot*"`; `npm --prefix tools/openapi-gen run check` | ✅ (regenerate) |
| Model hygiene | no EF model warning (Pitfall 5) | infra | `--filter-class "*OrderModel*"` | ❌ |

### Sampling Rate
- **Per task commit:** the project's quick command for the layer touched (Domain or Application unit tests; one integration class).
- **Per wave merge:** `dotnet test --project tests/Csps.Server.IntegrationTests` and `tests/Csps.Infrastructure.IntegrationTests` (after preflight).
- **Phase gate:** full suite green (`dotnet test --solution Csps.slnx`, web tests, openapi check, `dotnet format --verify-no-changes`) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/Csps.Testing/ConcurrentRequests.cs`: add an N-way `SendAllTogetherAsync` (today only two: `SendTogetherAsync(...)` returns `(First, Second)` [VERIFIED: tests/Csps.Testing/ConcurrentRequests.cs:16]).
- [ ] `tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs`: valid full-aggregate body, the ORD-2026-0148 body, read/put/post helpers (copy `ExpenseFixtures`).
- [ ] Domain test files: `OrderTests`, `OrderStatusRulesTests`, `OrderImportTests`, `OrderNumberTests`, list entry tests.
- [ ] A testing-only seeder (`POST /api/testing/orders`, Debug + Testing only, like `TestingExpensesController`) so Phase 8 e2e can fill lists; optional in Phase 7 but cheap to add with the fixtures.
- [ ] Timing data generator for orders (copy `ExpenseTimingData`).

## Security Domain

`security_enforcement: true`, ASVS level 1, block on high.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | existing JWT + 2FA |
| V3 Session Management | no (unchanged) | existing |
| V4 Access Control | yes | `Policies.Staff` on order routes; `Policies.Manager` on restore, permanent delete, deleted list and list writes; default-deny fallback; authorization matrix rows for every action |
| V5 Input Validation | yes | FluentValidation in handlers + domain re-checks; 1 MB body limit; list query rules; type-safe ids (`{id:guid}`) |
| V6 Cryptography | no | (row versions are not secrets; idempotency hashing already exists) |
| V7 Error handling / logging | yes | ProblemDetails with trace id only; Serilog masking; audit details without customer text |
| V8 Data protection | yes | customer PII (name, phone, email, address) never in audit details or logs; responses `no-store` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Mass assignment of `CreatedBy`, totals, `number`, `status` history, `deletedAt` (CWE-915) | Tampering | Request DTOs have no such members; totals only from `OrderMath`; forged-values test per aggregate |
| Lost update / double spend on balance (CWE-362) | Tampering | Root `rowversion` touch, overpayment check in the same transaction; race tests |
| Duplicate order numbers under load (CWE-362) | Tampering | `order-numbers` lock row + unique index; 20-way race test |
| IDOR on child routes: payment id of another order (CWE-639) | Elevation | Load the child **through** the order (`order.Payments.Single(p => p.Id == paymentId)`), 404 if it belongs elsewhere |
| Naming an ineligible receiver/payer or the Legacy holder from the API (CWE-284) | Spoofing | `CanPay` check on every new or changed person id; the holder fails `CanPay`; only `Order.Import` may use it |
| SQL injection via search (CWE-89) | Tampering | LINQ only, `LikePattern` escaping, `NoInlineSqlTests` |
| PII in audit/logs (CWE-532) | Information disclosure | `fields=` names only (05 D-40, D-31); D-29 permanent-delete snapshot has no customer text |
| Admin restoring or purging (CWE-285) | Elevation | Manager policy on those routes; matrix rows (Admin 403) |
| Replay creating duplicate orders (CWE-799 style) | Tampering | `Idempotency-Key` on every POST; duplicate POST integration test |
| Oversized aggregate (CWE-400) | DoS | 1 MB body limit; rule constants capping children per order |

## Suggested Plan Slicing (for the planner; granularity "fine")

Each slice is TDD and ends green. Waves can run in parallel where they do not share files (`CspsDbContext`, migrations and
`AuditActions.All` are shared: give migrations a strict order).

1. **Domain math and rules:** `OrderMath` refunds/credit (v2 vectors untouched), `OrderRules`, `OrderStatus` + `OrderStatusRules`, `OrderNumber`.
2. **Domain aggregate:** `Order` + children, `Create`, child add/edit/remove, status, soft delete/restore, `Touch`, `Recalculate`, `Import` + `OrderImportRules`.
3. **Managed lists domain + seeds** (three entries, shared base) and their migration.
4. **Persistence:** configurations, filters on children, counter table, `order-numbers` lock row, Legacy holder seed, migration + migration tests, model-warning test, trigger inventory unchanged.
5. **Number allocator + race test** (20-way, New Year).
6. **Managed list API** (generic handlers, three controllers, matrix rows, save-failure translation, docs).
7. **Create + read + list** (handlers, reader in two commands, controller, matrix, idempotency, attribution tests).
8. **Details edit + child routes** (items, payments, refunds, discounts, expenses; people checks; 409 races).
9. **Status + history + delete/restore/permanent/deleted list.**
10. **Audit events** (actions, `OrderAuditDetail`, `AuditChangeLines`, `audit-log.md`, web `auditCopy.ts`).
11. **Contract + docs:** OpenAPI snapshot, generated types, `docs/api/orders.md`, requirement amendments (ORD-05, ORD-06, ORD-13, ORD-17, MONEY-01 D-08), dev seed (UI-spec §12.2 orders), Phase 7.1 roadmap insertion (D-33), list timing test.

## Sources

### Primary (HIGH confidence)
- Codebase, read this session: `OrderMath.cs`, `OrderMathModels.cs`, `CompanyExpense.cs`, `ExpenseRules.cs`, `ExpenseChanges.cs`, `ExpenseCategory.cs`, `ExpenseCategorySeed.cs`, `CategoryTones.cs`, `CreateCompanyExpenseHandler.cs`, `UpdateCompanyExpenseHandler.cs`, `ConflictRetry.cs`, `ConcurrencyConflictException.cs`, `RowVersions.cs`, `IUnitOfWork.cs`, `CspsUnitOfWork.cs`, `DatabaseLock.cs`, `DatabaseLocks.cs`, `DatabaseLockConfiguration.cs`, `20261026024441_AddDatabaseLocks.cs`, `RecordStampInterceptor.cs`, `IAttributedRecord.cs`, `IEditVersioned.cs`, `CompanyExpenseConfiguration.cs`, `CompanyExpenseStore.cs`, `ExpenseCategoryStore.cs`, `CompanyExpensesController.cs`, `Policies.cs`, `IStaffDirectory.cs`, `StaffState.cs`, `StaffDirectory.cs`, `ApplicationUser.cs`, `AuditActions.cs`, `IdempotencyGate.cs`, `CspsDbContextOptions.cs`, `BusinessClock.cs`, `NoInlineSqlTests.cs`, `OpenApiSnapshotTests.cs`, `AuthorizationMatrix.cs`, `CompanyExpenseConcurrencyTests.cs`, `order-math-golden-vectors.json`, `csps.golden.test.ts`, `Directory.Packages.props`, `global.json`, `docs/api/company-expenses.md` (slice pattern checklist), `docs/development.md`.
- Planning: `07-CONTEXT.md`, `07-DISCUSSION-LOG.md`, `REQUIREMENTS.md` (ORD-*, SEC-06/07/08, MONEY-01/05, MIG-09/10), `ROADMAP.md` Phase 7, `CSPS-PRD.md` §5.1/§6.4, `CSPS-UI-SPEC.md` §8.5, §9, §12.2, `06-CONTEXT.md` D-30/D-33/D-50, `.planning/research/ARCHITECTURE.md`.

### Secondary (MEDIUM confidence)
- [What's new in EF Core 10](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-10.0/whatsnew): named query filters, non-expression `ExecuteUpdate`, complex types.
- [Global Query Filters](https://learn.microsoft.com/en-us/ef/core/querying/filters): named filters, `IgnoreQueryFilters([...])`, required navigations and matching filters.
- [Handling Concurrency Conflicts](https://learn.microsoft.com/en-us/ef/core/saving/concurrency): token only in UPDATE/DELETE WHERE, `DbUpdateConcurrencyException`, `IsRowVersion`.

### Tertiary (LOW confidence)
- Exact trigger and text of EF's filtered-required-navigation warning (A8).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new packages; versions read from `Directory.Packages.props`.
- Architecture: HIGH, every mechanism is an existing, tested pattern in the repo; EF behaviour cited from official docs.
- Pitfalls: HIGH for 1, 2, 4, 6, 7, 8, 9 (read in code); MEDIUM for 5 (documented problem, warning trigger assumed).
- Business-rule defaults: MEDIUM, five owner questions remain (Open Questions 1 to 5).

**Research date:** 2026-10-28
**Valid until:** 2026-11-27 (stable stack; re-check only if EF Core or the Phase 6 infrastructure changes)

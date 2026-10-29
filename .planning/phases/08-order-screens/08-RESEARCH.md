# Phase 8: Order Screens - Research

*Created: 2026-10-29T15:10:00-05:00 · Updated: 2026-10-29T15:10:00-05:00*

**Researched:** 2026-10-29
**Domain:** React 19 admin screens (list, form, detail, tabs, windows) over the existing Phase 7 order API, plus four small API changes the owner approved
**Confidence:** HIGH (everything below was read in this repo this session; the few guesses are in the Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Money labels (C-13; confirms 02 D-41 R2-06)
- **D-01:** The totals panel uses the PRD names: **Subtotal** (before discount), **Discount**, **Total** (after discount), **Paid**, then **BALANCE**. The UI spec's "Total / Total Discount / Total Paid" wording is replaced (SPEC-DEVIATION). For ORD-2026-0148 this reads Subtotal ₱22,450.00 · Discount −₱1,122.50 · Total ₱21,327.50 · Paid −₱12,000.00 · Balance ₱9,327.50. (owner, 2026-10-29)
- **D-02:** A **customer credit** turns the BALANCE block into a **CUSTOMER CREDIT** block in the info tone, with the line "Paid over the total. Record a refund to clear it." It is never shown as a negative balance. (owner, 2026-10-29)
- **D-03:** Refunds get their own **"Refunded"** row under Paid (shown as +₱), and only when the order has a refund. (owner, 2026-10-29)
- **D-04:** In the list, **cards show Total and Balance. The table shows Total, Paid and Balance.** Discount shows only on the order page. In the Balance spot, the list shows "Fully Paid" (green) or a **"Credit ₱X" info badge** for a customer credit. **ORD-01's wording is changed to match**, with a dated owner note. (owner, 2026-10-29)
- **D-05:** The save message names a credit: "{Thing} updated. Customer credit now ₱1,000.00." The design's "Balance now ₱…" and "Order is now fully paid." stay for the other cases. (owner, 2026-10-29)

#### Profit and people fields (C-18, OD-20)
- **D-06:** **Order Expenses and Estimated Profit show only on the order page**, in the panel below a dashed rule, as the design has it. They are never shown in the list, the cards or the table. The dashboard's figures are Phase 10's call. Closes C-18 for Phase 8. (owner, 2026-10-29)
- **D-07:** The profit note depends on the status. A normal order reads "Profit = Total − Expenses. Staff only." A Cancelled order reads "Cancelled: profit = money kept (Paid − Refunded) − Expenses. Staff only." (07 D-36) (owner, 2026-10-29)
- **D-08:** **Admins and Managers both see** Order Expenses and Estimated Profit. Nothing internal is shown outside the staff portal (ORD-19). (owner, 2026-10-29)
- **D-09:** **OD-20 is closed: the payment field is labelled "Received by".** (owner, 2026-10-29)
- **D-10:** The refund person field is labelled **"Refunded by"**. (owner, 2026-10-29)
- **D-11:** Received by, order-expense Paid by and Refunded by **start on the signed-in user, shown as "{name} (you)"**, and can be changed to any active coworker. This is the Phase 6 Paid by rule (06 D-18) and uses the same `PaidBySelect` lookup. (owner, 2026-10-29)
- **D-12:** The Payments, Expenses and Refunds tabs show **both people**: the money person (Received by, Paid by or Refunded by) **and** a Recorded by column. "Last changed by" stays in the edit window (SEC-08). On phones, both people show in the row card. (owner, 2026-10-29)

#### Refunds and status
- **D-13:** Refunds live in a **fifth "Refunds" tab with a count**. It shows only when the order is Cancelled, shows a credit, or already has refunds (SPEC-GAP). (owner, 2026-10-29)
- **D-14:** Status changes through a **"Change status" menu by the status badge in the header**, which lists only the allowed moves. When money is owed or there is a credit, Completed shows greyed out with the reason in visible text ("Balance must be ₱0.00 to complete."), not a hover-only tooltip. Cancel asks for confirmation. (owner, 2026-10-29)
- **D-15:** A **locked order** (Completed or Cancelled) shows a banner: "This order is {status}. Reopen it to make changes." with a **Reopen** button. Add, edit and delete actions are hidden. On a Cancelled order, refunds can still be added, edited and removed (07 D-35). (owner, 2026-10-29)
- **D-16:** **Reopen asks which active status to go to**, with the status before the end state preselected. (owner, 2026-10-29)
- **D-17:** The order page shows a **small "Status history" list** under the customer card, newest first ("Ready to Delivered · Maria Santos · Oct 20, 2026"). (owner, 2026-10-29)
- **D-18:** The **Cancel confirm explains the money**: "Cancel {number}? Payments of ₱X stay as collected cash. Record a refund on the Refunds tab if you give money back." No refund is recorded automatically. (owner, 2026-10-29)
- **D-19:** The CUSTOMER CREDIT block has a **"Record refund" button** that opens the refund window with the credit amount filled in. (owner, 2026-10-29)
- **D-20:** Status changes **only on the order page**, never from the list. (owner, 2026-10-29)

#### Delete and Deleted orders (applies 07 D-26 to D-29)
- **D-21:** The normal (soft) delete is a **Yes/Cancel confirm that shows the child counts**: "Delete {number}? Its 3 items, 2 payments, 1 discount and 4 expenses are hidden from every list and total. A Manager can restore it." No typing. (owner, 2026-10-29)
- **D-22:** Delete is offered **only on the order page** (header actions), not on list rows or cards. (owner, 2026-10-29)
- **D-23:** **Deleted orders work like Deleted Expenses** (06 D-54): a separate Manager-only page linked from Orders, newest deleted first, showing who deleted it and when. **Restore** takes one click with no confirm. **Delete permanently** shows the child counts and requires typing the order number (07 D-28). (owner, 2026-10-29)
- **D-24:** A Manager can **open a deleted order read-only** before restoring. This **needs a new Manager-only API route** (for example `GET /api/v1/orders/deleted/{id}`) with authorization-matrix rows for anonymous, Admin (403) and Manager. The read-only view has no add, edit, status or delete actions. Only Restore and Delete permanently are offered. — **Reversibility:** costly — it is a new public API route in the authorization matrix and the API docs, which a future phone app may use. (owner, 2026-10-29)
- **D-25:** **The ORD-06 traceability row is set back to Pending** and ticked when the Phase 8 delete screens ship, like ORD-01 and ORD-02. This closes the Phase 7 backlog item. (owner, 2026-10-29)
- **D-26:** **Roadmap success criterion 5 gets a dated note.** Its "removed in one transaction" text is superseded by 07 D-26 to D-28: a normal delete is soft, and only the Manager's permanent delete types the number and removes the rows. The criterion text is not edited. (owner, 2026-10-29)

#### Create and edit (applies C-3, 07 D-24)
- **D-27:** The create form and the order page show a **small "Image uploads are coming soon." card** where the images go, until Phase 9 replaces it with the real uploader and gallery. List cards show the placeholder thumbnail. (owner, 2026-10-29)
- **D-28:** **Edit changes details only**: customer details, dates and notes, through the details route. Items are added and changed in the Items tab windows, each saved on its own. Create still saves details and items together in one call. This is a SPEC-DEVIATION from the design's single edit form. (owner, 2026-10-29)
- **D-29:** The payment window's **Method starts empty** ("Choose a method", required). The design's GCash default is dropped, for the same reason as 06 OQ-9. (owner, 2026-10-29)
- **D-30:** A new order may **start in any active status, with Pending as the default** (the API allows Pending to Delivered). (owner, 2026-10-29)

#### Settings for the three lists (applies 07 D-19, D-20)
- **D-31:** The Settings page becomes **tabs, one per list**, with the active tab in the URL (WEB-10). The tabs are Product types, Payment methods, Order expense categories, then Company expense categories, so the order lists come first. Each tab reuses the Phase 6 category section as it stands. — **Reversibility:** reversible. (owner, 2026-10-29)
- **D-32:** **All three new lists have badge colors** from the checked tone set (07 D-19): the payment method badge in Payments, the product type badge on items, and the category badge in Expenses. (owner, 2026-10-29)

#### Phones
- **D-33:** On phones, a **slim balance card sits under the header**. It shows Total and Balance, or Fully Paid or Credit, and tapping it jumps to the full panel lower down. The full panel stays where the design stacks it. (owner, 2026-10-29)
- **D-34:** The detail tabs are a **tab row that scrolls sideways**, with the active tab kept in view. The page never scrolls sideways at 320 px. The shared `Tabs` component (`web/src/components/choice`) is the starting point. (owner, 2026-10-29)
- **D-35:** On phones, tab tables become **row cards as designed**, with Edit and Delete always visible as 44 px targets. (owner, 2026-10-29)

#### Due dates (ORD-11)
- **D-36:** The due wording follows the design: "Due Nov 18, 2026 · 5 days left", "Due today", "Due tomorrow", and "Overdue by 3 days" in the danger color **with an icon** (not color alone). Days count in Manila calendar days through `IBusinessCalendar` and the client business date. (owner, 2026-10-29)
- **D-37:** Overdue and days-left show **only for Pending, Mockup, In Production and Ready**. Delivered, Completed and Cancelled show the due date plainly. (owner, 2026-10-29)
- **D-38:** An imported order with **no due date shows `EmptyValue`** (OR-4) and no flag, and it **sorts last** in the due-date sort. The planner checks how the Phase 7 list sort handles a null due date, and asks the owner before any API change. (owner, 2026-10-29) The UI-SPEC research found the `due` sort already puts null due dates last, so no API change is needed.

#### UI-SPEC rulings (OQ-1 to OQ-18 in `08-UI-SPEC.md`, /gsd-ui-phase 8)
- **D-39 (OQ-6):** D-15 also covers the header **Delete Order**: it is hidden on a Completed or Cancelled order until the order is reopened. (owner, 2026-10-29)
- **D-40 (OQ-1):** Add a **piece count** to each order list row so cards show "{n} pcs" as designed. This is an approved small API change. (owner, 2026-10-29)
- **D-41 (OQ-2):** The Orders subline reads **"{n} orders · {active} active"**, with no date wording. The list API also returns an active-order count. This is an approved small API change. (owner, 2026-10-29)
- **D-42 (OQ-3):** The order-date filter starts at **"Any date"**. (owner, 2026-10-29)
- **D-43 (OQ-4):** Balance filter is a **checkbox, "Only orders with a balance"**. (owner, 2026-10-29)
- **D-44 (OQ-5):** Each item in the order response gains **recordedBy, recordedAt, lastChangedBy and lastChangedAt**, so the item window shows "Recorded by" like the others. This is an approved API change. (owner, 2026-10-29)
- **D-45 (OQ-7):** A Cancelled order with money unpaid shows a **neutral "Not collected"** block with the figure, not amber "Balance due". (owner, 2026-10-29)
- **D-46 (OQ-8):** The edit button reads **"Edit Details"**. (owner, 2026-10-29)
- **D-47 (OQ-9):** **No confirm** before Mark Completed. Reopen undoes it. (owner, 2026-10-29)
- **D-48 (OQ-10):** Buttons that can only fail are **hidden with a short note**: Delete on the last item, and Add Payment when nothing is owed. This is an approved exception to D-35. (owner, 2026-10-29)
- **D-49 (OQ-11):** A new order opens with **one blank item row** and no product type chosen. (owner, 2026-10-29)
- **D-50 (OQ-12):** Status history shows the **newest 5 with "Show All {n}"**. (owner, 2026-10-29)
- **D-51 (OQ-13):** The order page back link returns to the **list as the user left it**: filters, page and view. (owner, 2026-10-29)
- **D-52 (OQ-14):** Deleted Orders has **paging only**, newest deleted first, and no search. (owner, 2026-10-29)
- **D-53 (OQ-15):** The topbar search is wired: **Enter opens Orders** searched for that text. (owner, 2026-10-29)
- **D-54 (OQ-16):** All six accessibility fixes are accepted as written: (a) row actions named by row, (b) 44 px item fields on phones, (c) "Keep Order", (d) the save bar never hides the focused field, (e) a hidden "Results" heading, (f) chips only for non-default filters. (owner, 2026-10-29)
- **D-55 (OQ-17):** The reworded spec copy is accepted as written. (owner, 2026-10-29)
- **D-56 (OQ-18):** New copy is built as written and reviewed before release (05 D-48). (owner, 2026-10-29)
- **D-57 (checker Dimension 1):** One-word action buttons gain a noun: "Reopen Order", "Delete Order", "Discard Changes". Dismiss buttons that drop work name what they keep, for example "Keep Editing" and "Keep Order". Plain "Cancel" stays only where it closes a window without losing anything. (owner, 2026-10-29)
- **D-58:** The item, payment, discount, expense and refund windows keep a plain **"Cancel"**. When something was typed, Cancel, Esc, the scrim and the close button first ask **"Discard changes?"** with "Keep Editing" and "Discard Changes", as the full forms do. A clean window closes at once. (owner, 2026-10-29)

#### Carried forward (not re-asked)
- Create holds details and items. Payments, discounts and expenses are added on the order page afterwards (C-3, 07 D-24).
- 7 statuses, free moves among the active ones, Completed only at ₱0.00, and locked end states (07 D-01 to D-05, D-38).
- Soft delete for both roles. Restore, the Deleted view and permanent delete are Manager-only (07 D-26 to D-28).
- Refund caps and rules (07 D-07 to D-13, D-34, D-35, D-43). Any staff member edits any order (07 D-25).
- "Active + recent" is defined by the API: Pending to Delivered, plus Completed and Cancelled orders changed in the last 30 days (`docs/api/orders.md`).
- The client zod mirrors the approved `OrderRules.cs` messages (07 D-40 to D-43, D-46; OR-3). A payment may be dated before the order date (07 D-41).
- 409: form saves keep typed values and offer a reload, and single-click actions act on the latest state (05 D-20, D-21; ORD-08).
- Grid ⇄ table view rules are as ORD-10 is written.
- Native select and date boxes are restyled only (06 D-63). Counts use en-PH thousands everywhere (06 D-62). Soft-deleted staff show as "{name} (former staff)" (05 D-07 to D-11).
- OD-14 (design vs WCAG) is ruled item by item in `/gsd-ui-phase 8`, as in Phase 6.

### Claude's Discretion
- The **Delivered badge tone**, picked from the checked tone set so it differs from Ready and Completed, and shown to the owner in the UI review.
- The exact copy where the owner gave the meaning but not every word, for example the locked banner, empty states and refund window hints. All copy goes to the owner's copy review (05 D-48).
- The component split, hooks and URL parameter names, following the expenses slice and the API's parameter names.

### Deferred Ideas (OUT OF SCOPE)
- Profit on the dashboard: Phase 10 (C-18 dashboard scope).
- The audit line detail for order changes (APX-IN-01): decided in the Phase 8 UI review, per STATE.md.
- Status changes from the list, and delete from the list: declined for now (D-20, D-22).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORD-01 | Paginated order list (cards or table): number, customer/team, dates, status, Total and Balance on cards, Paid in the table, cover thumbnail (placeholder), "Fully Paid" or "Credit ₱X", projected server-side without N+1 | `GET /api/v1/orders` exists with stored figures and a 2-command read (`OrderReader.ListAsync`). Phase 8 adds the D-40 piece count and the D-41 counts. See "Backend inventory" and Pitfall 3. |
| ORD-02 | Search by number, customer, team, phone; filter status (default "Active + recent"), order-date range, product type, has balance; sort due/newest/balance/total; server paging (20); all in the URL | Every server parameter exists (`docs/api/orders.md` lines 67-76). URL state uses `createListParams` and the allow-list parsers (Pattern 2). |
| ORD-06 | Soft delete (both roles); Manager-only Deleted view, restore, permanent delete with counts and typed number | Delete, deleted list, restore and purge routes exist. D-24 deleted read is new (Pattern 6). |
| ORD-07 | Detail page: gallery (coming-soon card), tabbed tables with counts and modals, live OrderTotals, customer card; active tab in the URL | `GET /orders/{id}` returns everything; every child route answers the whole order (Pattern 4). Tab URL state copies `useProfileTab`. |
| ORD-10 | Grid/table view: URL `view` (no default), else `localStorage['csps-orders-view']`, else grid; only the toggle writes both | Pattern 3 and Pitfall 7. |
| ORD-11 | Overdue / days-left from the business-zone "today" | `DueFlag` (Pattern 5). The source of "today" is Open Question 1. |
| ORD-12 | "Fully Paid" when Total > 0 and Balance ≤ 0 (ORD-2026-0151) | Server sends `fullyPaid` on every list row and in `totals`; the client never recomputes it. |
| ORD-15 | Leaving create/edit with unsaved changes asks "Discard changes?" | `useBlocker` and `useBeforeUnload` are exported by the installed `react-router` 8.4.0 (Pattern 7). |
| ORD-19 | Order Expenses and Estimated Profit, staff only | `totals.expenses` and `totals.profit` exist only in the detail response; the list row has neither field (`OrderListEntry`). |
| (also) ORD-08, ORD-09, ORD-16, ORD-17, ORD-18, ORD-22, ORD-23 | 409 UX, money/date format, history, status, refunds, Received by, Paid by | Server side complete (Phase 7). UI patterns from Phase 6 (`ExpenseModal`, `ConflictBanner`, `PaidBySelect`). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These carry the same weight as locked decisions. The planner must check every plan against them.

- **Stack:** React 19 + TS strict + Vite, Tailwind v4, React Router (import from `react-router`, never `react-router-dom`), TanStack Query, RHF + zod. Backend .NET 10 controllers under `/api/v1`, EF Core 10 Fluent config only.
- **Forbidden packages:** axios, MediatR, AutoMapper, FluentAssertions v8+, jQuery, any UI kit, `react-router-dom`, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, SpaProxy, Serilog DB sinks.
- **New dependencies:** none expected in this phase. Any that appears needs purpose, license (MIT, Apache-2.0, BSD, ISC; named exceptions only), maintenance status, a legitimacy check, age of at least 14 days, and the owner's yes before install.
- **Architecture:** Onion layers enforced by ArchUnitNET. One handler per use case, manual mapping, `Result<T>` to ProblemDetails. Thin controllers with explicit `[Authorize(Policy = ...)]` or `[AllowAnonymous]`; the authorization-matrix test discovers every action.
- **Money** is `decimal(18,2)`, computed only on the server. UTC storage plus `TimeProvider` / `IBusinessCalendar`, never `DateTime.Now`.
- **Schema:** every change through EF migrations; no JSON columns; no drops, renames or lossy changes without the owner; **no new triggers (OR-7)**; never `Database.Migrate()` at startup.
- **No inline SQL** in application code (no `FromSql`, `SqlQuery`, `ExecuteSql`). Use LINQ.
- **Quality:** TDD (red, green, refactor). Zero warnings in build, lint, types, tests and the browser console. Coverage: Domain 100%, Application ≥ 95%, `core/api` 100%, web ≥ 90%. Authorization-matrix rows for every endpoint × {anonymous, Admin, Manager}.
- **Security:** strict CSP (no `style` attribute, no inline script), default-deny authorization, append-only audit log, no secrets or real data in git.
- **A11y:** WCAG 2.2 AA, zero axe violations at component and page level. Touch targets ≥ 44 px. 320 to 1920 px, no sideways scroll.
- **Perf:** admin initial JS ≤ 250 KB gz, CSS ≤ 35 KB gz; list p95 < 300 ms (`docs/operations/list-performance.md`).
- **OR-2** minimal comments. **OR-3** a zod schema per form mirroring the server validator with the server's own messages. **OR-4** no em or en dash anywhere in `web/src` (U+2212 minus in money is allowed); empty values render `EmptyValue`. **OR-5** API calls in `modules/admin/services/`, only `core/api/http` touches `fetch`. **OR-6** the owner layout tree; `modules/admin` holds exactly `components`, `hooks`, `pages`, `services` folders plus root files such as `ordersCopy.ts`.
- **Shared machine:** ports 5180, 5115, 7028, 5199 only; never 5173, 5023, 5099. Run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` before dev servers, Playwright or full test runs. LocalDB `CSPS_*` databases only. Env vars only per process. No stdin-reading commands.
- **Merges** only through `tools/scripts/Merge-PullRequest.ps1` on the owner's word. Stage files by path; run gitleaks before every commit.
- **Markdown** files carry created and updated timestamps.

## Summary

Phase 7 built the whole order API, and it is already in the generated web types. Every route the screens need exists: list with all filters and sorts, create, read, edit details, five child resources (items, discounts, payments, expenses, refunds) with add, edit and remove, status moves and reopen, soft delete, the deleted list, restore and purge. Every write answers the whole order with fresh server totals and a new `version`, so the web side never computes a saved figure. It replaces its cache from the response. Only four approved API changes are missing: the D-24 deleted read route, the D-40 piece count, the D-41 two counts and the D-44 item attribution. The item attribution needs no migration, because `OrderItem` already stores `CreatedById`, `CreatedAtUtc`, `UpdatedById` and `UpdatedAtUtc` [VERIFIED: src/Csps.Domain/Orders/OrderItem.cs:55-65].

On the web side there are no order screens yet. `/admin/orders` maps to the not-found page in real builds and to a dev preview page in dev and e2e builds, and the dev preview wins where both exist. The Phase 6 company-expenses slice is the template for everything: `createListParams` URL state, `useListQuery`, per-module services, `useSubmission` with idempotency keys, `ConflictBanner` on 409, `PaidBySelect`, the Deleted page and the Settings card. The shared `OrderTotals`, `OrderCard`, `ConfirmDialog`, `Tabs` and `csps.ts` status constants exist but need the changes the UI-SPEC lists. The main ones are the Delivered status, the refunds count, a cancel-label prop, the D-01 names and the credit block.

The riskiest parts are not the screens. They are the shared seams: the OpenAPI snapshot and generated types that every API change must regenerate, the "exactly 2 SQL commands" test that D-41 collides with, the dev preview route that shadows the real Orders route in e2e builds, and where "today" comes from (the Phase 6 precedent is the server's business today, not the device clock).

**Primary recommendation:** Do all four API changes in one serial backend plan (plus the snapshot and type regeneration) first. Then build shared primitives, then the list, forms, detail page, deleted pages and settings tabs in that order, each copying the expenses slice.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Order list filter, sort, page, counts, piece count | API / Backend | Database (indexes) | The server owns money and paging (ORD-01 "projected server-side"); the client only holds URL state. |
| List URL state, grid/table view | Browser / Client | none | WEB-10 and ORD-10: nuqs URL plus `localStorage`. |
| Totals, balance, credit, fully paid, profit | API / Backend | none | Core Value. The client shows server figures; previews only inside open forms. |
| Due flag (days left, overdue) | Browser / Client | API (the business "today") | Pure date arithmetic on the client from a business date. The date's source is Open Question 1. |
| Form validation | Browser / Client | API (authoritative) | OR-3: zod mirrors every server rule; server-only checks (active person, retired entry, balance caps) come back as field errors. |
| Concurrency (409), idempotency | API / Backend | Browser (keeps typed values, Load Latest) | `version` checks and `Idempotency-Key` replay are server-side; the UI shows the banner. |
| Manager-only pages | API / Backend (403) | Browser (route loader redirect) | Default-deny on the server; the loader is only a convenience. |
| Unsaved-changes guard | Browser / Client | none | `useBlocker` and `beforeunload`. |
| Status transitions, lock, refund caps | API / Backend | Browser (hides actions that can only fail) | The server decides; the menu only offers allowed moves and shows the server's refusal text. |

## Backend inventory: what exists and what Phase 8 adds

### Exists (Phase 7, no change needed)

| Route | Notes for the screens |
|---|---|
| `GET /api/v1/orders?q=&status=&from=&to=&productType=&hasBalance=&sort=&page=&pageSize=` | Answers `{ items, total, page, pageSize }`. `status` keys `active` (default), `all`, `pending`, `mockup`, `production`, `ready`, `delivered`, `completed`, `cancelled`. `sort` keys `due` (default), `newest`, `balance`, `total`. `pageSize` 1 to 100, default 20 [CITED: docs/api/orders.md lines 67-76]. |
| `POST /orders` (with `Idempotency-Key`) | 201 with the whole order; `409 orders.busy` when the number lock times out. |
| `GET /orders/{id}` | The whole order with `items`, `discounts`, `payments`, `refunds`, `expenses`, `statusHistory`, `totals`, attribution and `version`. |
| `PUT /orders/{id}` | Details only (D-28), with `version`; `409 edit.stale`; `422 orders.locked`. |
| `POST/PUT/DELETE /orders/{id}/{items,discounts,payments,expenses,refunds}[/{childId}]` | Add and edit send `version` (add also an `Idempotency-Key`); remove sends neither. Every one answers the whole order. |
| `POST /orders/{id}/status` (with `Idempotency-Key`, no version) | Moves and reopens. Refusals `422 orders.complete-balance-owed`, `orders.complete-credit`, `orders.reopen-first`. |
| `DELETE /orders/{id}` | 204; 404 when already deleted. Both roles. |
| `GET /orders/deleted?page=&pageSize=` | Manager; rows carry `deletedAt`, `deletedBy`, `status`, `total`, `paid`, `balance`. |
| `POST /orders/{id}/restore` (with `Idempotency-Key`) | Manager; 204. |
| `DELETE /orders/{id}/permanent?confirm=` | Manager; 400 on `confirm` when the number is not exact. |
| `GET /{product-types,payment-methods,order-expense-categories}` plus Manager CRUD, retire, reactivate | Items carry `id`, `name`, `tone`, `status`, `isOthers`, `useCount` [CITED: docs/api/order-lists.md]. Note the count field is `useCount`, while company expense categories use `expenseCount` (generated types lines 2336-2355 and 2742-2761). |
| `GET /api/v1/staff` | The Received by / Paid by / Refunded by lookup (`useStaffLookupQuery`). |

The null due-date sort is already handled [VERIFIED: src/Csps.Infrastructure/Orders/OrderReader.cs:104-111]:

```csharp
// Every sort ends on the id. The due sort puts orders with no due date last.
_ => orders.OrderBy(order => order.DueDate == null).ThenBy(order => order.DueDate).ThenBy(order => order.Id),
```

So D-38 needs no API change.

### Adds (approved API changes; one serial plan)

| # | Change | Where | Notes |
|---|---|---|---|
| 1 | **D-44** item attribution | `OrderItemResponse` (`src/Csps.Application/Orders/OrderDetailResponse.cs:20`), `OrderReader.ReadDetailOnceAsync` items query | Today: `public sealed record OrderItemResponse(Guid Id, OrderListRef ProductType, string Description, string? SizeVariant, int Quantity, decimal UnitPrice, decimal LineTotal);` [VERIFIED: OrderDetailResponse.cs:20]. Add `RecordedBy`, `RecordedAt`, `LastChangedBy`, `LastChangedAt` with the same left joins to `context.Users` the discount query already uses. **No migration**: the columns exist [VERIFIED: OrderItem.cs:55-65]. |
| 2 | **D-40** piece count | `OrderListEntry`, `OrderListRow`, `OrderReader.ListAsync` projection | Recommended: a correlated `context.Set<OrderItem>().Where(i => i.OrderId == order.Id).Sum(i => i.Quantity)` inside the existing page `Select`. It stays inside command 2, so it is not an N+1. `IX_OrderItems_OrderId` serves it. No schema change. A stored `PieceCount` column is the alternative, but it needs a migration, `OrderMath` changes and a backfill. |
| 3 | **D-41** list-wide counts | `OrderListResponse` (today `(Items, Total, Page, PageSize)` [VERIFIED: OrderListResponse.cs:43]), `OrderListPage`, `IOrderReader.ListAsync` | Two counts that ignore every filter: all non-deleted orders, and non-deleted orders in Pending to Delivered. **This collides with the "exactly 2 commands" tests** (Pitfall 3, Open Question 2). |
| 4 | **D-24** deleted read | New `[HttpGet("deleted/{id:guid}")]` with `[Authorize(Policy = Policies.Manager)]` on `OrdersController`; a new handler; an `IOrderReader` method | Reuse `ReadDetailOnceAsync` with `IgnoreQueryFilters(["SoftDelete"])` on the order **and on every child query** (each child entity has its own `SoftDelete` filter through `Order.DeletedAtUtc`; see `OrderItemConfiguration.cs:34` and the five siblings), plus `Where(order.DeletedAtUtc != null)`. The answer needs `deletedAt` and `deletedBy` for the X2 banner. A live or unknown id is 404. Add a matrix row: `Anonymous: 401, Admin: 403, Manager: 404` for a random id (same as the restore row). |
| 5 | (only if the owner says yes to Open Question 1) `today` on the list and detail responses | `OrderListResponse`, `OrderDetailResponse` | Mirrors `CompanyExpenseListResponse.Today`: "The business today, so the browser never reads the device clock for it." [VERIFIED: src/Csps.Application/Expenses/CompanyExpenseListResponse.cs:32]. |

Each change must update `docs/api/orders.md`, refresh `tools/openapi-gen/openapi.v1.json` and regenerate `web/src/types/api.generated.ts` (Pattern 1). Because those two files are shared, **all API changes belong in one plan or in strictly serial plans**; parallel worktrees would conflict on them.

## Standard Stack

Everything is already installed. Versions are the exact pins in `web/package.json` [VERIFIED: web/package.json].

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.0 | UI | Project stack |
| react-router | 8.4.0 | Routes, loaders, `useBlocker`, `useBeforeUnload` | Both hooks are exported [VERIFIED: web/node_modules/react-router/dist/development/index.d.ts export list] |
| @tanstack/react-query | 5.103.2 | Server state, `setQueryData` from write responses | `lib/query/useListQuery.ts`, `queryClient.ts` |
| nuqs | 2.10.1 | URL state through `createListParams` | `lib/url-state/createListParams.ts` |
| react-hook-form | 7.89.0 | Forms; `useFieldArray` for the create item grid | Project stack |
| zod | 4.6.7 | OR-3 schemas | Project stack |
| @hookform/resolvers | 5.9.1 | `zodResolver` | Used by `ExpenseModal.tsx` |
| clsx | 2.1.1 | Class joins | Project stack |
| lucide-react | 1.53.0 | Icons through `icons.ts` | Phase 8 adds no icon (UI-SPEC) |

### Supporting (tests)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest / @vitest/coverage-v8 | 5.0.4 | Unit and component tests | Every web task |
| @testing-library/react / user-event / jest-dom | 16.3.3 / 14.6.7 / 7.0.1 | Component tests | Every screen |
| msw | 3.0.1 | `msw/node` server in `src/test/msw.ts` | Service and screen tests |
| axe-core | 4.13.0 | In-house axe matcher (`src/test/axe.ts`) | Every new component and page |
| @playwright/test / @axe-core/playwright | 1.63.0 / 4.13.0 | E2E on port 5199 | Journeys, overflow sweep |
| .NET: xunit.v3, NSubstitute, Shouldly, Respawn, ArchUnitNET | as `Directory.Packages.props` | Integration and unit tests | API changes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useBlocker` + `beforeunload` | a hand-rolled history listener | Rejected: React Router's blocker already handles back/forward and link clicks in a data router. |
| Correlated `Sum` for piece count | a stored `PieceCount` column | Stored column needs a migration, OrderMath and backfill; the correlated sum stays inside the existing command. |

**Installation:** none. No package is added or bumped in this phase.

## Package Legitimacy Audit

No package is installed, added or bumped. The UI-SPEC confirms "New packages: none" and "Phase 8 adds no icon".

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | | | | | | |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

If a plan finds it needs a package after all, it stops and surfaces the exact version for the owner's approval (owner rule: advisories, open bugs, deprecation, license, age ≥ 14 days).

## Architecture Patterns

### System Architecture Diagram

```
 Staff browser (/admin/orders*)                                   Server (/api/v1)                     SQL Server
 ─────────────────────────────                                    ─────────────────                    ──────────
 URL (?q,status,dates,from,to,productType,hasBalance,sort,page,size,view,tab)
   │  createListParams (allow-list parsers; defaults stay out of URL)
   ▼
 useOrdersListParams ──► params ──► useListQuery(['orders','list',params]) ──► ordersService.list ──► GET /orders ──► ListOrdersHandler ──► OrderReader.ListAsync
   ▲                                                                                                                         (count cmd, page cmd,
   │ view: URL ? localStorage['csps-orders-view'] ? 'grid'                                                                     + D-41 counts)
   │                                                                                                                                  │
 OrdersPage (grid OrderCard / ResponsiveTable, DueFlag(today))  ◄──────── OrderListResponse (stored figures, pieces, counts) ◄────────┘
   │ click order (Link state: list search for D-51)
   ▼
 OrderPage ──► useOrderQuery(['order',id]) ──► GET /orders/{id} ──► GetOrderHandler ──► OrderReader.GetDetailAsync (version re-check loop)
   │  tabs (?tab) · totals panel · customer card · status history
   │
   ├─ window (item/payment/discount/expense/refund): zod (OR-3) ─► useSubmission(key) ─► POST/PUT child (version, Idempotency-Key)
   │       ├─ 200: setQueryData(['order',id], response); invalidate ['orders'], ['orders-deleted'], list-entry queries; toast
   │       ├─ 400: server field errors under fields (server wins)
   │       ├─ 409 edit.stale: ConflictBanner, keep typed values, Load Latest
   │       └─ 422: banner with server text; refetch order
   ├─ Change Status menu ─► POST /status (no version) ─► same success path
   ├─ Delete Order (counts from loaded arrays) ─► DELETE /orders/{id} ─► navigate to list URL
   └─ Edit Details ─► OrderFormPage (F2, useBlocker guard) ─► PUT /orders/{id} (version)

 Manager only: DeletedOrdersPage ─► GET /orders/deleted ; DeletedOrderPage ─► GET /orders/deleted/{id} (NEW, D-24)
               restore ─► POST /orders/{id}/restore ; purge ─► DELETE /orders/{id}/permanent?confirm=
 Manager only: SettingsPage tabs ─► ListSettingsSection(config) ─► /product-types | /payment-methods | /order-expense-categories | /expense-categories
```

### Recommended Project Structure

`modules/admin` may hold only `components/`, `hooks/`, `pages/` and `services/` folders [VERIFIED: web/src/test/source-layout.node.test.ts "modules holds exactly public and admin, each with components, hooks, pages and services only"]. Module-wide files sit at its root.

```
web/src/modules/admin/
├── ordersCopy.ts, orderListsCopy.ts       # every string (none in JSX)
├── ordersSchemas.ts, orderListSchemas.ts  # OR-3 zod mirrors (+ .test.ts)
├── services/  ordersService.ts, productTypesService.ts, paymentMethodsService.ts, orderExpenseCategoriesService.ts
├── hooks/     useOrdersListParams.ts, useOrdersView.ts, useOrdersQuery.ts, useOrderQuery.ts, useOrderTab.ts,
│              useDeletedOrdersListParams.ts, useDeletedOrdersQuery.ts, useDeletedOrderQuery.ts, useOrderAction.ts,
│              useRefreshOrders.ts, useProductTypesQuery.ts, usePaymentMethodsQuery.ts, useOrderExpenseCategoriesQuery.ts,
│              useSettingsTab.ts, useBusinessToday.ts (shape depends on Open Question 1)
├── components/ DueFlag, OrderStatusMenu, ReopenOrderModal, OrderLockedBanner, OrderNoticeBanner, OrderBalanceStrip,
│              OrderCustomerCard, OrderStatusHistory, OrderItemModal, OrderPaymentModal, OrderDiscountModal,
│              OrderExpenseModal, OrderRefundModal, OrderItemsEditor, ListEntrySelect, ListSettingsSection, orders.recipe.ts
└── pages/     OrdersPage, OrderFormPage, OrderPage, DeletedOrdersPage, DeletedOrderPage (each + .test.tsx)

web/src/components/   (shared, changed)  money/OrderTotals, data/OrderCard, overlays/ConfirmDialog, choice/Tabs, status/tones
web/src/utils/csps.ts (changed)          OrderStatus + Delivered, CascadeCounts + refunds
web/src/test/orderFixtures.ts (new)      ORD-2026-0148, 0151, 0153 builders + MSW handlers (copy expenseFixtures.ts)
web/e2e/testing-api.ts (changed)         createOrder() over POST /api/testing/orders
```

### Pattern 1: An API change travels through three committed files

**What:** API change, then the OpenAPI snapshot, then generated types, then services.
**When:** every one of the four (or five) API changes.
**Steps** [CITED: docs/web/api.md "When you change the API"]:

```bash
dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"     # fails, as expected
# PowerShell, one process only:
$env:CSPS_WRITE_OPENAPI_SNAPSHOT='1'; dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"; Remove-Item Env:CSPS_WRITE_OPENAPI_SNAPSHOT
dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"     # passes
npm --prefix tools/openapi-gen run generate
npm --prefix tools/openapi-gen run check
npm --prefix web run typecheck
```

Never edit `api.generated.ts` or the snapshot by hand. Commit the API change, `tools/openapi-gen/openapi.v1.json` and `web/src/types/api.generated.ts` together.

### Pattern 2: List URL state (copy `useExpensesListParams`)

```typescript
// Source: web/src/modules/admin/hooks/useExpensesListParams.ts (adapted)
import { createListParams } from '@/lib/url-state/createListParams';
import { guidParser, literalParser, pageParser, pageSizeParser, parseAsBusinessDate, searchParser } from '@/lib/url-state/parsers';
import { parseAsStringLiteral } from 'nuqs';

export const ORDER_STATUS_FILTERS = ['active', 'all', 'pending', 'mockup', 'production', 'ready', 'delivered', 'completed', 'cancelled'] as const;
export const ORDER_SORTS = ['due', 'newest', 'balance', 'total'] as const;
export const ORDER_DATE_RANGES = ['30d', '90d', 'month', 'custom'] as const;

const useListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  status: literalParser(ORDER_STATUS_FILTERS, 'active'),
  dates: parseAsStringLiteral(ORDER_DATE_RANGES),       // no default: absent means "Any date" (D-42)
  from: parseAsBusinessDate,
  to: parseAsBusinessDate,
  productType: guidParser,
  hasBalance: parseAsStringLiteral(['true'] as const),
  sort: literalParser(ORDER_SORTS, 'due'),
  view: parseAsStringLiteral(['grid', 'table'] as const), // NO withDefault (ORD-10)
});
```

The string values above come from the UI-SPEC route contract and the API table. They are the planner's to confirm against `docs/api/orders.md` lines 70 and 74. `createListParams` throws at definition time for keys that look like personal data (`name`, `phone`, `email`, `address`, `customername`, ...) [VERIFIED: lib/url-state/createListParams.ts FORBIDDEN_NAMES], so none of the keys above may be renamed to such a word. `30d`, `90d` and `month` resolve against the business today on every visit and are never stored as dates. The existing `dateRangeParsers` presets (`last-30-days`, `this-month`, ...) use different names, so either map them or use the UI-SPEC names; do not mix both.

### Pattern 3: ORD-10 view resolution

```typescript
// Pure, so the URL × localStorage matrix is a plain table test.
export const ORDERS_VIEW_KEY = 'csps-orders-view';
type View = 'grid' | 'table';
const isView = (v: unknown): v is View => v === 'grid' || v === 'table';

export function resolveView(urlView: View | null, stored: string | null): View {
  if (urlView !== null) return urlView;
  return isView(stored) ? stored : 'grid';
}
// The toggle alone writes both: setFilter('view', next) (replace) and localStorage.setItem(ORDERS_VIEW_KEY, next).
// Wrap localStorage reads and writes in try/catch (private mode can throw). Never pass the stored value to nuqs.
```

Note: `setFilter` resets the page (createListParams "Every change but a page change replaces the history entry and resets the page"). Decide whether a view toggle should keep the page. If yes, it needs a small `setView` that writes `view` without the page reset.

### Pattern 4: Every order write replaces the cache from the response

```typescript
// The server answers the whole order after every child write and status move.
const onSaved = (order: OrderDetailResponse) => {
  queryClient.setQueryData(orderKey(order.id), order);   // server figures and the new version
  void refreshOrders();                                   // invalidate ['orders'], ['orders-deleted'], the three list-entry queries
};
```

The list-entry queries must be invalidated too, because `useCount` decides whether Settings offers Delete (same reason `useRefreshExpenses` invalidates the categories). Each window keeps its own `opened` copy of the order (its `version`), exactly as `ExpenseForm` keeps `opened`. A background refetch must never change the version a window sends.

### Pattern 5: DueFlag from a business date

```typescript
// Whole calendar days between two YYYY-MM-DD strings; no zone is involved.
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}
// status in pending|mockup|production|ready only (D-37); dueDate null → EmptyValue, no flag (D-38).
// n >= 2 "{n} days left"; 1 "Due tomorrow"; 0 "Due today"; < 0 "Overdue by {|n|} day(s)" + triangle-alert icon.
```

`today` is either the server's business today (recommended, Open Question 1) or `businessToday(new Date())` from `lib/url-state/parsers.ts`, which `AuditLogPage` already uses.

### Pattern 6: The D-24 deleted read

```csharp
// OrdersController, beside ListDeletedOrders. "deleted/{id:guid}" cannot collide with "{id:guid}".
[HttpGet("deleted/{id:guid}")]
[Authorize(Policy = Policies.Manager)]
[EndpointName("GetDeletedOrder")]
[ProducesResponseType<DeletedOrderDetailResponse>(StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<IResult> GetDeleted(Guid id, CancellationToken cancellationToken) { ... }
```

The response name and shape are the planner's to fix (for example the `OrderDetailResponse` fields plus `deletedAt` and `deletedBy`). In the reader, every child query needs `IgnoreQueryFilters([SoftDeleteFilter])`. The comment at `OrderReader.cs:97` warns that EF applies `IgnoreQueryFilters` to the whole query, which is what this read wants.

### Pattern 7: Unsaved-changes guard (F1, F2)

```typescript
import { useBeforeUnload, useBlocker } from 'react-router';

const leaving = useRef(false);                    // set true right before navigate() after a save or a discard
const blocker = useBlocker(({ currentLocation, nextLocation }) =>
  isDirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname);
useBeforeUnload(useCallback((event) => { if (isDirty && !leaving.current) event.preventDefault(); }, [isDirty]));
// blocker.state === 'blocked' → ConfirmDialog "Discard changes?"; "Discard Changes" → blocker.proceed(); "Keep Editing" → blocker.reset().
```

`useBlocker` needs a data router. Tests must use `createMemoryRouter`, as `routes.test.tsx` does, not `<MemoryRouter>`. Sign-out must not prompt (UI-SPEC): let the session-end navigation through, for example by allowing any `/admin/login` target.

### Pattern 8: One single-click action per order (copy `useExpenseAction`)

Status moves, reopen, cancel, delete, restore and purge use `useSubmission` with an identity that includes a generation counter, so a double click sends one request and a retry after an uncertain failure reuses its `Idempotency-Key` [VERIFIED: modules/admin/hooks/useExpenseAction.ts]. Status, reopen, cancel and restore send an `Idempotency-Key`; DELETE routes send none (`expensesService.remove` precedent).

### Anti-Patterns to Avoid
- **Computing a saved figure on the client.** `csps.ts orderTotals()` is a preview only (its header says so). After any save, show `response.totals`.
- **Recomputing `fullyPaid`, `customerCredit` or the refund cap on the client** for display. Use the server fields. The refund window's "You can refund up to" helper is a preview from server figures (credit, or paid minus refunded on a Cancelled order, plus the refund's own saved amount on edit).
- **Sending `version` on single-click actions.** Only form saves send it (05 D-21; API).
- **A `withDefault` on `view`.** It breaks the ORD-10 fall-through to `localStorage`.
- **Putting order lists in one shared mega-service.** OR-5: one service per resource.
- **Inline `style`** for due colors or item grid widths (strict CSP). Use recipe classes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL list state | `useSearchParams` plumbing | `createListParams` + parsers | Normalization, debounced search, page reset, PII key guard |
| Idempotent submits, double-click guard | own key and in-flight logic | `useSubmission`, `newIdempotencyKey` | SEC-06 replay rules are subtle (which failures keep the key) |
| Navigation blocking | history listeners | `useBlocker`, `useBeforeUnload` (react-router 8.4.0) | Handles back/forward, links, and the blocked/proceed state |
| 409 banner | new banner | `ConflictBanner` | 05 D-20 copy and focus rules |
| Person picker | new select | `PaidBySelect` with new `label`, `name`, `hint` props | Keeps "(you)", "(inactive)", "(former staff)" rules |
| Money input | text input + regex | `MoneyInput`, `isMoneyText`, `moneyTextToCentavos` | Paste normalization, 2 decimals, numeric keypad |
| Peso and date text | `toLocaleString` | `formatPeso`, `formatCalendarDate`, `formatBusinessDateTime`, `formatCount` | en-PH, U+2212, no zone shift |
| Focus after a failed submit | manual focus | `focusFirstInvalid` | Already tested |
| Server field messages | own mapping | `serverFieldMessage` | Server keys and casing |
| Delete counts sentence | string building | `cascadeSentence` (add `refunds`) | Pluralization and order |
| Return-path safety (D-51) | trust `location.state` | `safeReturnUrl` in `modules/admin/guard.ts`, plus a check that the path starts with `/admin/orders` | Open-redirect guard already exists |
| Manager-only route | in-page role checks | `requireManagerLoader(args, '/admin/orders')` | Same as Deleted Expenses |

**Key insight:** the expenses slice already solved list state, idempotency, conflicts, pickers, Deleted pages and Settings. Phase 8 is mostly composition plus a few prop additions.

## Common Pitfalls

### Pitfall 1: The dev preview route shadows the real Orders route in dev and e2e builds
**What goes wrong:** In dev, e2e and budget builds, `devRoutes` come first and define `admin/orders` → the preview page, and "where both define a path the preview wins" [VERIFIED: core/routes/router.tsx header; modules/admin/routes.tsx:189-201]. Playwright runs the e2e build, so it would never see the new Orders page.
**How to avoid:** remove `{ path: 'orders', lazy: previewPage }` from `devRoutes`, and replace `{ path: 'orders', lazy: notFoundPage }` in `adminRoutes` with the real routes. Then fix the specs that use `/admin/orders` as the "short dev preview page": `web/e2e/admin.spec.ts` (PATHS, and its "Development only..." assertion), `web/e2e/shell.spec.ts` (`SHORT_ADMIN_PAGE`), `web/e2e/sweep.ts` (`ADMIN_PAGES`), and `src/modules/admin/routes.test.tsx` line 497 (`devTree()` at `/admin/orders`). Pick another short dev page or seed an order.
**Warning signs:** an e2e test sees "Development only. This screen is built in a later phase."

### Pitfall 2: The `/admin` index redirect
**What goes wrong:** the index redirects to `/admin/sessions` today: `throw redirect('/admin/sessions');` [VERIFIED: modules/admin/routes.tsx:141-147]. CONTEXT says "The `/admin` landing still redirects to Orders until the dashboard ships", and ROADMAP Phase 10 says "Until this phase ships, `/admin` redirects to Orders." (line 963).
**How to avoid:** change it to `/admin/orders` in this phase and update `routes.test.tsx` (lines 117, 157, 400 expect `/admin/sessions`). This is behaviour the owner already wrote down, but it is listed as Open Question 3 for a quick yes.

### Pitfall 3: D-41 counts break "exactly two SQL commands"
**What goes wrong:** `OrderReaderQueryCountTests` asserts `counter.Count.ShouldBe(2)` [VERIFIED: tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs:61], and `OrderListQueryCountTests` does the same through the endpoint. The runbook says "Never raise the 300 ms limit or the command counts to make a run pass." The two filter-free counts need SQL of their own.
**How to avoid:** ask the owner (Open Question 2). Recommended: one extra fixed command for both counts (`GroupBy` on a constant with `Count()` and `Count(o => o.Status <= Delivered)`), so the list runs exactly 3 commands at every page size, filter and sort. Update both tests, `docs/operations/list-performance.md` and `docs/api/orders.md` in the same plan. The piece count (D-40) adds no command if it is a correlated subquery in the page `Select`. Re-run `OrderListTimingTests` alone after both changes.
**Warning signs:** the query-count tests turn red, or someone changes `2` to `3` without a ruling.

### Pitfall 4: "Today" from the device clock
**What goes wrong:** Phase 6 rules that the browser never reads the device clock for the business today; the list response carries `today` (D-23, `CompanyExpenseListResponse.Today`). The order responses have no `today`. Using `new Date()` makes due flags, "This month", form defaults and the future-date rules wrong on a phone with a wrong clock. The business zone is also a SiteSettings value the Manager may edit later, while the client constant `BUSINESS_ZONE = 'Asia/Manila'` is fixed.
**How to avoid:** Open Question 1. The UI-SPEC wants a component test that fixes the clock at 23:30 and 00:30 Manila time; that test works either way.

### Pitfall 5: OpenAPI snapshot and generated types in parallel worktrees
**What goes wrong:** `workflow.use_worktrees` is true. Two plans that both change DTOs both rewrite `tools/openapi-gen/openapi.v1.json` and `web/src/types/api.generated.ts`, and the merge conflicts or silently drops one change.
**How to avoid:** one backend plan for all API changes, or serial plans in separate waves. Web plans that read the new types depend on it. Other shared hot files: `modules/admin/routes.tsx`, `ordersCopy.ts`, `utils/csps.ts`, `components/index.test.ts` (pins the barrel list).

### Pitfall 6: `ConfirmDialog` has fixed words and icon
**What goes wrong:** the dismiss button always says "Cancel" and the confirm button always uses `trash-2` [VERIFIED: components/overlays/ConfirmDialog.tsx:170-173]. The UI-SPEC needs "Keep Editing", "Keep Order", and an `x` icon on "Cancel Order". Its failure line uses `describeHttpError` ("fixed text plus the traceId, never server text").
**How to avoid:** add `cancelLabel` and `confirmIcon` props (default to today's values so Phase 6 stays the same). For the 422 and 400 lines the UI-SPEC wants in dialogs, pass `describeFailure` that maps known codes (`orders.last-item`, `orders.payment-below-refunds`, `confirm`) to client copy mirroring the server message, as OR-3 does for fields. Its `CASCADE_LABELS` tally also needs `refunds` (six tiles).

### Pitfall 7: ORD-10 and `createListParams` normalization
**What goes wrong:** a `view` parser with a default would be stripped from the URL when it equals the default, and a default computed from `localStorage` would make the URL depend on the viewer. ORD-10 requires a component test of the URL × localStorage matrix.
**How to avoid:** Pattern 3. Test cases: URL valid + storage anything → URL; URL invalid → storage valid → storage (and the invalid URL value is removed by normalization); both invalid or missing → grid; toggle writes both; a `?view=table` visit never writes storage.

### Pitfall 8: Generated numbers are `number | string`
**What goes wrong:** money and counts in `api.generated.ts` are typed `number | string` (for example `balance: number | string;`, `useCount: number | string;`). Comparing `balance > 0` on a string fails silently in places.
**How to avoid:** use the server booleans (`fullyPaid`) and `customerCredit` where possible; convert once with a helper (SettingsPage has `toNumber`); pass money straight to `Money`/`formatPeso`, which accept both.

### Pitfall 9: Nested "Discard changes?" over a window (D-58)
**What goes wrong:** the confirm opens over a `Modal`. Esc must close only the top dialog, focus must return to the control that tried to close, and the outer window must stay open on "Keep Editing".
**How to avoid:** overlays already stack: "traps stack ... the active trap (the top of the stack) acts on Tab" and "Only the newest open dialog decides" [VERIFIED: components/overlays/useFocusTrap.ts:12-15; useInertOutside.ts:6]. Route the `Modal` `onClose` (Esc, scrim, close button and Cancel all go through it) to a dirty check. Test Esc on the nested dialog does not also close the window.

### Pitfall 10: A refetch must not overwrite an open window's version
**What goes wrong:** `refetchOnWindowFocus: true` is the default (`lib/query/queryClient.ts`). If a window reads `version` from the live query, a focus refetch silently moves it and a stale save succeeds against values the user never saw.
**How to avoid:** each window captures `opened` at open time and sends `opened.version` (as `ExpenseForm` does). Load Latest replaces `opened` deliberately.

### Pitfall 11: `useBlocker` and saving
**What goes wrong:** after a successful create, `navigate('/admin/orders/{id}')` is blocked because the form is still dirty, and the Discard dialog appears over a saved order.
**How to avoid:** set a `leaving` ref (or reset the form) before navigating, as in Pattern 7. Test it.

### Pitfall 12: Soft-delete filters on child tables
**What goes wrong:** for the D-24 read, lifting the filter on the order alone still hides the items, payments and history, because each child has its own `SoftDelete` filter through `Order.DeletedAtUtc` [VERIFIED: grep of `HasQueryFilter("SoftDelete"` in six child configurations]. The X2 page would show an order with empty tabs.
**How to avoid:** `IgnoreQueryFilters(["SoftDelete"])` on every child query in the deleted read, and a test that a deleted order with children returns them all.

### Pitfall 13: `PaidBySelect` has fixed label, name and hint
**What goes wrong:** label "Paid by", `name="paidByUserId"` and the hint "The staff member whose money paid for this." are fixed from `EXPENSES_COPY` [VERIFIED: modules/admin/components/PaidBySelect.tsx]. A "Received by" field with a "paid for this" hint reads wrong.
**How to avoid:** add `label`, `name` and `hint` props with today's values as defaults (UI-SPEC lists label and name; add hint too). Phase 6 tests must keep passing.

### Pitfall 14: The testing seed endpoint has no refunds
**What goes wrong:** `POST /api/testing/orders` takes items, discounts, payments and expenses, and no refunds [VERIFIED: src/Csps.Server/Controllers/TestingOrdersController.cs TestingOrderRequest]. E2E scenarios for the Refunds tab and a refunded order need one.
**How to avoid:** seed a Cancelled order with payments through the testing endpoint, then add refunds through the real API in the spec, or extend the testing request with refunds (a small server change with its own test). `web/e2e/testing-api.ts` has no `createOrder` helper yet.

### Pitfall 15: Vitest watch mode
**What goes wrong:** `npm run test` is plain `vitest`, which watches in an interactive shell and never exits.
**How to avoid:** always pass `--run` (`npm --prefix web run test -- --run <path>`), as the Phase 6 validation commands do. Leave no background shell running.

## Code Examples

### Service shape (copy `expensesService.ts`)
```typescript
// Source: web/src/modules/admin/services/expensesService.ts (pattern)
const orderPath = (id: string): string => `/orders/${encodeURIComponent(id)}`;

export function createOrdersService(client: HttpClient): OrdersService {
  return {
    list: (q, signal) => client.get<OrderListResponse>('/orders', {
      params: { q: q.q, status: q.status, from: q.from, to: q.to, productType: q.productType,
                hasBalance: q.hasBalance, sort: q.sort, page: q.page, pageSize: q.pageSize }, signal }),
    get: (id, signal) => client.get<OrderDetailResponse>(orderPath(id), { signal }),
    create: (body, idempotencyKey, signal) => client.post<OrderDetailResponse>('/orders', body, { idempotencyKey, signal }),
    updateDetails: (id, body, signal) => client.put<OrderDetailResponse>(orderPath(id), body, { signal }),
    addPayment: (id, body, idempotencyKey, signal) =>
      client.post<OrderDetailResponse>(`${orderPath(id)}/payments`, body, { idempotencyKey, signal }),
    removePayment: (id, paymentId, signal) =>
      client.delete<OrderDetailResponse>(`${orderPath(id)}/payments/${encodeURIComponent(paymentId)}`, { signal }),
    changeStatus: (id, status, idempotencyKey, signal) =>
      client.post<OrderDetailResponse>(`${orderPath(id)}/status`, { status }, { idempotencyKey, signal }),
    remove: (id, signal) => client.delete(orderPath(id), { signal }),
    restore: (id, idempotencyKey, signal) => client.post(`${orderPath(id)}/restore`, undefined, { idempotencyKey, signal }),
    purge: (id, confirm, signal) => client.delete(`${orderPath(id)}/permanent`, { params: { confirm }, signal }),
    // ...items, discounts, expenses, refunds alike; listDeleted, getDeleted (D-24)
  };
}
```

Child DELETE routes answer `200` with the whole order (not 204), so they use `client.delete<OrderDetailResponse>`. The client supports this: `delete<T>(url: string, options?: RequestOptions): Promise<T>;` and `RequestOptions` is `Omit<RequestConfig, 'method' | 'url' | 'body'>`, which keeps `params` [VERIFIED: web/src/core/api/http/httpClient.ts:16-25, 41, 69]. So purge's `confirm` goes in `params`.

### Status menu options
```typescript
// Active statuses in order; Delivered joins Ready and Completed in csps.ts (UI-SPEC).
const moves = ACTIVE_STATUSES.filter((s) => s !== order.status);         // "Move to {Status}"
const canComplete = order.totals.fullyPaid && Number(order.totals.customerCredit) === 0
                    && Number(order.totals.balance) === 0;                // else aria-disabled + "Balance must be ₱0.00 to complete."
```

`fullyPaid` alone is not enough: it is true for a credit too ("Balance ≤ 0"). Completed needs a balance of exactly ₱0.00.

### Today's status constants that change
```typescript
// web/src/utils/csps.ts:128-136 today [VERIFIED]
export const ORDER_STATUSES: Record<OrderStatus, string> = {
  pending: 'Pending',
  mockup: 'Mockup',
  production: 'In Production',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'mockup', 'production', 'ready'];
// web/src/components/status/tones.ts:14-21 today [VERIFIED]
// pending: 'neutral', mockup: 'mockup', production: 'warning', ready: 'info', completed: 'success', cancelled: 'danger'
```

Phase 8 adds `delivered: 'Delivered'` between `ready` and `completed`, adds `'delivered'` to `ACTIVE_STATUSES` and to the `OrderStatus` union, and sets `STATUS_TONE.delivered = 'accent'` (UI-SPEC, Claude's discretion). The wire key `delivered` matches the API [CITED: docs/api/orders.md "Statuses" table]. `CascadeCounts` (csps.ts:101-107: `items`, `payments`, `discounts`, `expenses`, `images`) gains `refunds`, and `CASCADE_LABELS` gains `['refunds', 'refund']` after expenses.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Six statuses (UI spec §6.2) | Seven, with Delivered | 07 D-01 | csps.ts, tones, showcase, tests |
| "Total / Total Discount / Total Paid" | Subtotal, Discount, Total, Paid, Refunded, credit block | 08 D-01 to D-03 | `OrderTotals` changes |
| Hard delete from the list with type-to-confirm | Soft delete on the order page; permanent delete on Deleted Orders | 07 D-26 to D-28, 08 D-21 to D-24 | New pages, new route |
| One create/edit form with items | Edit Details only; items in the Items tab | 08 D-28 | F2 is a smaller form |
| Golden vectors v2 (no refunds) | Still v2; "golden vectors v3 when the web preview learns refunds" | 07-02 follow-up | Phase 8 previews need no refund math if the refund cap comes from server figures; keep v2 unless a preview learns refunds |

**Deprecated/outdated:** the `ORDER_STATUSES` six-status list; the `orders` dev preview route; `/admin` → `/admin/sessions`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | EF Core 10 translates `GroupBy(constant).Select(g => new { g.Count(), g.Count(pred) })` into one SQL command, and a correlated `Sum(Quantity)` in the page `Select` stays in command 2 | Pitfall 3, Backend adds | The query-count tests show a different number; then use two scalar count commands or a stored column (owner) |
| A3 | Hiding Delete on the last item and Add Payment at zero balance is enough; the server's 422s still cover races | Patterns | Low; the 422 banner path exists |
| A4 | A view toggle should keep the current page (not reset it) | Pattern 3 | Low; a UX detail the owner may want either way |
| A5 | The deleted-read response is the detail fields plus `deletedAt` and `deletedBy` | Pattern 6 | Low; the planner fixes names |
| A6 | `SUM(Quantity)` cannot overflow `int` for real orders (at most 100 items × 10,000) | Backend adds | An imported order with skipped caps could in theory exceed it; cast to `long` if worried |

## Open Questions

These change behaviour, cost or a contract, so the owner decides. Recommendation first.

1. **Where does "today" come from for due flags, date presets, form defaults and the future-date checks?**
   - What we know: Phase 6 sends the server's business today in the list response so "the browser never reads the device clock for it" (D-23). The order responses have no `today`. D-36 says "through `IBusinessCalendar` and the client business date". The UI-SPEC says "the same source P6 uses", which is the server's today.
   - Options: (A, recommended) add `today` to the order list and detail responses, bundled with the D-41 change; the create form reads it from the list cache or a tiny read. (B) Use `businessToday(new Date())` as `AuditLogPage` does; no API change, but a wrong phone clock gives wrong flags and defaults.
   - Recommendation: A, because it matches Phase 6 and the zone can change in SiteSettings.

2. **D-41 counts and the "exactly 2 SQL commands" rule.**
   - What we know: the tests and the runbook fix the count at 2 and forbid raising it without the owner.
   - Options: (A, recommended) 3 fixed commands (count, page, one command for both list-wide counts), with the tests and runbook updated. (B) Fold the counts into the count command with scalar subqueries (fragile LINQ). (C) A separate counts endpoint (another route and matrix row; the UI-SPEC wants the counts in the list response).
   - Recommendation: A; it is still a fixed number, so PERF-04 holds.

3. **`/admin` landing.** It goes to Signed-in devices today. CONTEXT and ROADMAP say Orders until the dashboard ships. Recommendation: switch to `/admin/orders` in this phase. Quick yes needed because it changes where everyone lands after sign-in.

4. **E2E seeding of refunds.** Recommendation: add refunds to the testing seed endpoint (Debug Testing builds only), so specs stay fast. The other choice is seeding refunds through the real API in each spec. Planner's call unless the owner objects to a testing-endpoint change.

5. **Golden vectors v3.** Recommendation: not in Phase 8, because no preview computes refunds. Record it as still deferred.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | web build and tests | ✓ | v24.21.0 | none |
| npm | scripts | ✓ | 11.19.0 | none |
| .NET SDK | API changes and tests | ✓ | 10.0.402 (global.json 10.0.401, latestPatch) | none |
| Shared-machine preflight | before e2e and full runs | ✓ | `C:\Work\dev-tools\preflight.ps1` present | wait if busy |
| openapi-gen tool deps | type regeneration | ✓ | `tools/openapi-gen/node_modules` installed | `npm --prefix tools/openapi-gen ci` |
| LocalDB `(localdb)\MSSQLLocalDB` | integration tests | not probed (research must not start test runs) | none | integration tests start it; CI uses the SQL 2025 container |

**Missing dependencies with no fallback:** none found.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Web: Vitest 5.0.4 (jsdom), RTL, MSW 3.0.1, in-house axe; Playwright 1.63.0. .NET: xunit.v3 on Microsoft.Testing.Platform (`global.json` `"runner": "Microsoft.Testing.Platform"`) |
| Config file | `web/vitest.config.ts` (coverage 90%, `src/core/api/**` 100%), `web/playwright.config.ts` (port 5199, five projects), `src/test/setup.ts`, `src/test/msw.ts` |
| Quick run command | `dotnet test --project tests/<Project> --filter-class "*<Class>"` · `npm --prefix web run test -- --run <path>` |
| Full suite command | preflight, then `dotnet test --solution Csps.slnx` (`CSPS_TEST_SQL=localdb` in that process only, or unset), `tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORD-01 (D-40) | List rows carry the piece count; still a fixed command count | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*OrderReaderQueryCountTests"` | ✅ (update) |
| ORD-01 (D-41) | `{n} orders` and `{active} active` ignore filters and deleted orders | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ListOrdersEndpointTests"` | ✅ (extend) |
| ORD-01 | p95 < 300 ms with the new columns | timing | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderListTimingTests" --output Detailed` (run alone) | ✅ |
| ORD-01, ORD-12 | Cards show Total, Balance, "{n} pcs", Fully Paid (0151), Credit badge, Not collected; table adds Paid; no Discount, Expenses or Profit | component | `npm --prefix web run test -- --run src/modules/admin/pages/OrdersPage.test.tsx` | ❌ Wave 0 |
| ORD-01, ORD-12 | Changed `OrderCard`, `OrderTotals` (D-01 to D-03, D-07, D-45) | component | `npm --prefix web run test -- --run src/components/money/money.test.tsx src/components/data/data.test.tsx` | ✅ (update) |
| ORD-02 | URL params, normalization, page reset, custom range pair, chips | component | `npm --prefix web run test -- --run src/modules/admin/hooks/useOrdersListParams.test.tsx` | ❌ Wave 0 |
| ORD-10 | URL × localStorage matrix; only the toggle writes both | component | `npm --prefix web run test -- --run src/modules/admin/hooks/useOrdersView.test.tsx` | ❌ Wave 0 |
| ORD-11 | Days left / tomorrow / today / overdue; D-37 statuses; D-38 null; clock at 23:30 and 00:30 Manila | unit + component | `npm --prefix web run test -- --run src/modules/admin/components/DueFlag.test.tsx` | ❌ Wave 0 |
| ORD-15 | In-app leave blocked when dirty; save and clean form pass; Keep Editing returns focus | component | `npm --prefix web run test -- --run src/modules/admin/pages/OrderFormPage.test.tsx` | ❌ Wave 0 |
| ORD-15 | Browser `beforeunload` prompt | manual (browser-owned dialog) | owner check in UAT | n/a |
| ORD-07 | Tabs with counts, `tab` in URL, conditional Refunds tab, totals panel, customer card, history (5 + Show All) | component | `npm --prefix web run test -- --run src/modules/admin/pages/OrderPage.test.tsx` | ❌ Wave 0 |
| ORD-07, ORD-08, ORD-22, ORD-23, D-44 | Each window: OR-3 rules, server field errors, 409 banner keeps values, Load Latest, 422 banner, RecordMeta, pickers default "(you)", D-58 discard | component | `npm --prefix web run test -- --run src/modules/admin/components/OrderPaymentModal.test.tsx` (one file per window) | ❌ Wave 0 |
| D-44 | Items carry recordedBy/At and lastChangedBy/At | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderAttributionTests"` | ✅ (extend) |
| ORD-17 (UI) | Menu lists only allowed moves; Completed disabled with visible reason; Cancel dialog; Reopen preselect | component | `npm --prefix web run test -- --run src/modules/admin/components/OrderStatusMenu.test.tsx` | ❌ Wave 0 |
| ORD-19 | No "Order Expenses" or "Estimated Profit" text on L1, cards, table; present on O1 for both roles | component + e2e | `npm --prefix web run test -- --run src/modules/admin/pages/OrdersPage.test.tsx` | ❌ Wave 0 |
| ORD-06 (D-24) | Deleted read: Manager 200 with children; Admin 403; anonymous 401; live or unknown id 404 | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderDeletionTests"` and `--filter-class "*AuthorizationMatrixTests"` | ✅ (extend) |
| ORD-06 | Soft delete dialog counts; X1 restore and purge with typed number; X2 read-only | component | `npm --prefix web run test -- --run src/modules/admin/pages/DeletedOrdersPage.test.tsx src/modules/admin/pages/DeletedOrderPage.test.tsx` | ❌ Wave 0 |
| D-31, D-32 | Settings tabs, each list via `ListSettingsSection`; Phase 6 behaviour unchanged | component | `npm --prefix web run test -- --run src/modules/admin/pages/SettingsPage.test.tsx` | ✅ (extend) |
| SC 1 to 5 | Journeys: find, create (guard), work an order, credit and refund, cancel and reopen, delete and restore; list → order → Back restores the list; no sideways scroll 320 to 1920; axe; CSP | e2e | `npm --prefix web run e2e -- --grep @orders` | ❌ Wave 0 |
| API contract | Snapshot and generated types match | integration + node | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"`; `npm --prefix tools/openapi-gen run check` | ✅ |
| OR-4, OR-6 | No long dash; layout intact | node | `npm --prefix web run test -- --run src/test/no-long-dash.node.test.ts src/test/source-layout.node.test.ts` | ✅ |

### Sampling Rate
- **Per task commit:** the quick command of the touched test file(s), plus `npm --prefix web run typecheck` for web tasks.
- **Per wave merge:** preflight, `dotnet test --solution Csps.slnx`, `npm --prefix web run verify`.
- **Phase gate:** full suite green, coverage gate, `npm --prefix web run e2e`, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `web/src/test/orderFixtures.ts`: typed builders for ORD-2026-0148, 0151, 0153 (UI spec §12.2, fake names), a credit order, a Cancelled order with refunds, a no-due-date import; MSW handlers that record requests (copy `expenseFixtures.ts`).
- [ ] `web/e2e/testing-api.ts`: `createOrder()` over `POST /api/testing/orders` (plus refunds per Open Question 4).
- [ ] Remove the `orders` dev preview route; update `admin.spec.ts`, `shell.spec.ts`, `sweep.ts`, `routes.test.tsx` (Pitfall 1).
- [ ] New test files listed as ❌ above, written red first (TDD).
- [ ] No framework install needed.

## Security Domain

`security_enforcement` is true, ASVS level 1, block on high.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Phase 4 session; `requireSessionLoader` |
| V3 Session Management | no (unchanged) | Bearer token in memory, refresh cookie |
| V4 Access Control | yes | `[Authorize(Policy = Policies.Manager)]` on the D-24 route; authorization-matrix row; `requireManagerLoader` for `/admin/orders/deleted*`; child routes find children only through their order (CWE-639, already server-side) |
| V5 Input Validation | yes | zod (OR-3) in the browser; FluentValidation plus domain checks on the server; allow-list URL parsers (CWE-20) |
| V6 Cryptography | no | none in this phase |
| V7 Error Handling and Logging | yes | ProblemDetails with plain text; 5xx shows only the traceId; audit entries carry no customer text (`docs/api/orders.md` "audit entries") |
| V8 Data Protection | yes | Internal figures only on `/admin/orders/:id` and X2 (ORD-19); list rows never carry contact, address or notes; URL keys guarded against PII (`createListParams`); only the view choice goes in `localStorage`; `Cache-Control: no-store` on every order answer |
| V13 API | yes | `Idempotency-Key` on creates and single-click POSTs (SEC-06); `version` on form saves (SEC-07); mass-assignment fields ignored (CWE-915) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Admin reads a deleted order through the new route | Elevation of privilege | Manager policy on the action; matrix row Admin 403; loader redirect is only a convenience |
| Open redirect through the D-51 back link state | Spoofing | Only accept a same-app path that starts with `/admin/orders`; reuse `safeReturnUrl` |
| Stale write overwrites a coworker's change | Tampering | `version` on every form save; 409 banner; windows keep their own `opened` version |
| Double submit creates two payments | Tampering | `useSubmission` one key per submission; server replay |
| XSS through customer names, notes, reasons | Tampering | React text rendering only; no `dangerouslySetInnerHTML`; strict CSP with no inline style |
| PII in URLs or logs | Information disclosure | Only free-text `q` may hold a phone or name (owner WEB-10 ruling); no other key; the server log omits query strings |
| Profit shown to the public | Information disclosure | Internal figures exist only in the staff detail response; public routes do not import admin code (PERF-02 split) |
| Forged attribution in a body | Spoofing | Server ignores `recordedBy`, `createdById` and the like (SEC-08); keep the integration test for items (D-44) |

## Sources

### Primary (HIGH confidence)
- `docs/api/orders.md`, `docs/api/order-lists.md`, `docs/web/api.md`, `docs/operations/list-performance.md`, `docs/web/e2e.md`, `docs/development.md` (read this session)
- `src/Csps.Server/Controllers/OrdersController.cs`, `TestingOrdersController.cs`; `src/Csps.Application/Orders/OrderListResponse.cs`, `OrderDetailResponse.cs`, `DeletedOrderListResponse.cs`, `GetOrderHandler.cs`; `src/Csps.Application/Ports/IOrderReader.cs`; `src/Csps.Infrastructure/Orders/OrderReader.cs`; `src/Csps.Domain/Orders/OrderItem.cs`; `OrderConfiguration.cs`, `OrderItemConfiguration.cs`
- `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`; `tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs`
- `web/package.json`; `web/node_modules/react-router` 8.4.0 type exports; `web/src/modules/admin/routes.tsx`; `core/routes/router.tsx`; `lib/url-state/*`; `lib/query/*`; `lib/forms/useSubmission.ts`; `modules/admin/{hooks,services,components,pages}` expense files; `components/{money,data,overlays,choice,status}`; `utils/csps.ts`; `test/source-layout.node.test.ts`; `test/no-long-dash.node.test.ts`; `vitest.config.ts`; `playwright.config.ts`; e2e specs
- `.planning/phases/08-order-screens/08-CONTEXT.md`, `08-UI-SPEC.md`; `.planning/REQUIREMENTS.md`; `.planning/ROADMAP.md`; `.planning/STATE.md`; `.planning/phases/06-company-expenses/06-VALIDATION.md`

### Secondary (MEDIUM confidence)
- none

### Tertiary (LOW confidence)
- EF Core translation details for the count command (A1), to be proven by the query-count tests

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - exact pins read from `web/package.json`; nothing new.
- Backend inventory: HIGH - every route and DTO read in source and docs.
- Architecture: HIGH - copies the Phase 6 slice, which is in the repo.
- Pitfalls: HIGH for 1, 2, 3, 5, 6, 12, 13, 14 (read in code); MEDIUM for the EF translation in 3.

**Research date:** 2026-10-29
**Valid until:** 2026-11-28 (stable; re-check if Phase 7/7.1 PR #17 changes the order API before merge)

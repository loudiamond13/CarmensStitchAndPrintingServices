# Phase 8: Order Screens - Context

*Created: 2026-10-29T14:05:00-05:00 · Updated: 2026-10-30T19:45:00-05:00*

**Gathered:** 2026-10-29
**Status:** Ready for planning
**Branch:** `gsd/phase-08-order-screens`, stacked on `gsd/phase-07.1-legacy-fit-check-read-only` because the joint Phase 7 and 7.1 PR #17 is still open. Every Phase 8 commit goes on this branch (owner, 2026-10-29).

<domain>
## Phase Boundary

The staff screens for orders, built on the Phase 7 order API:

- the order list: grid cards and table, search, filters, sort and paging, all held in the URL
- the create flow and the details edit form, with the "Discard changes?" guard
- the order detail page: the customer card, the totals panel, the Items, Payments, Discounts, Expenses and Refunds tabs with their add, edit and delete windows, status changes and reopen, and a status history list
- soft delete, plus the Manager-only Deleted orders page with a read-only view, restore and permanent delete
- the Manager-only Settings tabs for the three Phase 7 lists (07 D-20)

Requirements: ORD-01, ORD-02, ORD-06, ORD-07, ORD-10, ORD-11, ORD-12, ORD-15 and ORD-19. The screens also cover ORD-08 (409), ORD-09 (money and dates), ORD-16 (history), ORD-17 and ORD-18 (status and refunds), and ORD-22 and ORD-23 (Received by and Paid by).

Out of scope: image upload, gallery and cover (ORD-04, Phase 9); money on hand and transfers (Phase 10); the dashboard (Phase 10); the final legacy import (Phase 15).

</domain>

<decisions>
## Implementation Decisions

### Money labels (C-13; confirms 02 D-41 R2-06)
- **D-01:** The totals panel uses the PRD names: **Subtotal** (before discount), **Discount**, **Total** (after discount), **Paid**, then **BALANCE**. The UI spec's "Total / Total Discount / Total Paid" wording is replaced (SPEC-DEVIATION). For ORD-2026-0148 this reads Subtotal ₱22,450.00 · Discount −₱1,122.50 · Total ₱21,327.50 · Paid −₱12,000.00 · Balance ₱9,327.50. (owner, 2026-10-29)
- **D-02:** A **customer credit** turns the BALANCE block into a **CUSTOMER CREDIT** block in the info tone, with the line "Paid over the total. Record a refund to clear it." It is never shown as a negative balance. (owner, 2026-10-29)
- **D-03:** Refunds get their own **"Refunded"** row under Paid (shown as +₱), and only when the order has a refund. (owner, 2026-10-29)
- **D-04:** In the list, **cards show Total and Balance. The table shows Total, Paid and Balance.** Discount shows only on the order page. In the Balance spot, the list shows "Fully Paid" (green) or a **"Credit ₱X" info badge** for a customer credit. **ORD-01's wording is changed to match**, with a dated owner note. (owner, 2026-10-29)
- **D-05:** The save message names a credit: "{Thing} updated. Customer credit now ₱1,000.00." The design's "Balance now ₱…" and "Order is now fully paid." stay for the other cases. (owner, 2026-10-29)

### Profit and people fields (C-18, OD-20)
- **D-06:** **Order Expenses and Estimated Profit show only on the order page**, in the panel below a dashed rule, as the design has it. They are never shown in the list, the cards or the table. The dashboard's figures are Phase 10's call. Closes C-18 for Phase 8. (owner, 2026-10-29)
- **D-07:** The profit note depends on the status. A normal order reads "Profit = Total − Expenses. Staff only." A Cancelled order reads "Cancelled: profit = money kept (Paid − Refunded) − Expenses. Staff only." (07 D-36) (owner, 2026-10-29)
- **D-08:** **Admins and Managers both see** Order Expenses and Estimated Profit. Nothing internal is shown outside the staff portal (ORD-19). (owner, 2026-10-29)
- **D-09:** **OD-20 is closed: the payment field is labelled "Received by".** (owner, 2026-10-29)
- **D-10:** The refund person field is labelled **"Refunded by"**. (owner, 2026-10-29)
- **D-11:** Received by, order-expense Paid by and Refunded by **start on the signed-in user, shown as "{name} (you)"**, and can be changed to any active coworker. This is the Phase 6 Paid by rule (06 D-18) and uses the same `PaidBySelect` lookup. (owner, 2026-10-29)
- **D-12:** The Payments, Expenses and Refunds tabs show **both people**: the money person (Received by, Paid by or Refunded by) **and** a Recorded by column. "Last changed by" stays in the edit window (SEC-08). On phones, both people show in the row card. (owner, 2026-10-29)

### Refunds and status
- **D-13:** Refunds live in a **fifth "Refunds" tab with a count**. It shows only when the order is Cancelled, shows a credit, or already has refunds (SPEC-GAP). (owner, 2026-10-29)
- **D-14:** Status changes through a **"Change status" menu by the status badge in the header**, which lists only the allowed moves. When money is owed or there is a credit, Completed shows greyed out with the reason in visible text ("Balance must be ₱0.00 to complete."), not a hover-only tooltip. Cancel asks for confirmation. (owner, 2026-10-29)
- **D-15:** A **locked order** (Completed or Cancelled) shows a banner: "This order is {status}. Reopen it to make changes." with a **Reopen** button. Add, edit and delete actions are hidden. On a Cancelled order, refunds can still be added, edited and removed (07 D-35). (owner, 2026-10-29)
- **D-16:** **Reopen asks which active status to go to**, with the status before the end state preselected. (owner, 2026-10-29)
- **D-17:** The order page shows a **small "Status history" list** under the customer card, newest first ("Ready to Delivered · Maria Santos · Oct 20, 2026"). (owner, 2026-10-29)
- **D-18:** The **Cancel confirm explains the money**: "Cancel {number}? Payments of ₱X stay as collected cash. Record a refund on the Refunds tab if you give money back." No refund is recorded automatically. (owner, 2026-10-29)
- **D-19:** The CUSTOMER CREDIT block has a **"Record refund" button** that opens the refund window with the credit amount filled in. (owner, 2026-10-29)
- **D-20:** Status changes **only on the order page**, never from the list. (owner, 2026-10-29)

### Delete and Deleted orders (applies 07 D-26 to D-29)
- **D-21:** The normal (soft) delete is a **Yes/Cancel confirm that shows the child counts**: "Delete {number}? Its 3 items, 2 payments, 1 discount and 4 expenses are hidden from every list and total. A Manager can restore it." No typing. (owner, 2026-10-29)
- **D-22:** Delete is offered **only on the order page** (header actions), not on list rows or cards. (owner, 2026-10-29)
- **D-23:** **Deleted orders work like Deleted Expenses** (06 D-54): a separate Manager-only page linked from Orders, newest deleted first, showing who deleted it and when. **Restore** takes one click with no confirm. **Delete permanently** shows the child counts and requires typing the order number (07 D-28). (owner, 2026-10-29)
- **D-24:** A Manager can **open a deleted order read-only** before restoring. This **needs a new Manager-only API route** (for example `GET /api/v1/orders/deleted/{id}`) with authorization-matrix rows for anonymous, Admin (403) and Manager. The read-only view has no add, edit, status or delete actions. Only Restore and Delete permanently are offered. — **Reversibility:** costly — it is a new public API route in the authorization matrix and the API docs, which a future phone app may use. (owner, 2026-10-29)
- **D-25:** **The ORD-06 traceability row is set back to Pending** and ticked when the Phase 8 delete screens ship, like ORD-01 and ORD-02. This closes the Phase 7 backlog item. (owner, 2026-10-29)
- **D-26:** **Roadmap success criterion 5 gets a dated note.** Its "removed in one transaction" text is superseded by 07 D-26 to D-28: a normal delete is soft, and only the Manager's permanent delete types the number and removes the rows. The criterion text is not edited. (owner, 2026-10-29)

### Create and edit (applies C-3, 07 D-24)
- **D-27:** The create form and the order page show a **small "Image uploads are coming soon." card** where the images go, until Phase 9 replaces it with the real uploader and gallery. List cards show the placeholder thumbnail. (owner, 2026-10-29)
- **D-28:** **Edit changes details only**: customer details, dates and notes, through the details route. Items are added and changed in the Items tab windows, each saved on its own. Create still saves details and items together in one call. This is a SPEC-DEVIATION from the design's single edit form. (owner, 2026-10-29)
- **D-29:** The payment window's **Method starts empty** ("Choose a method", required). The design's GCash default is dropped, for the same reason as 06 OQ-9. (owner, 2026-10-29)
- **D-30:** A new order may **start in any active status, with Pending as the default** (the API allows Pending to Delivered). (owner, 2026-10-29)

### Settings for the three lists (applies 07 D-19, D-20)
- **D-31:** The Settings page becomes **tabs, one per list**, with the active tab in the URL (WEB-10). The tabs are Product types, Payment methods, Order expense categories, then Company expense categories, so the order lists come first. Each tab reuses the Phase 6 category section as it stands. — **Reversibility:** reversible. (owner, 2026-10-29)
- **D-32:** **All three new lists have badge colors** from the checked tone set (07 D-19): the payment method badge in Payments, the product type badge on items, and the category badge in Expenses. (owner, 2026-10-29)

### Phones
- **D-33:** On phones, a **slim balance card sits under the header**. It shows Total and Balance, or Fully Paid or Credit, and tapping it jumps to the full panel lower down. The full panel stays where the design stacks it. (owner, 2026-10-29)
- **D-34:** The detail tabs are a **tab row that scrolls sideways**, with the active tab kept in view. The page never scrolls sideways at 320 px. The shared `Tabs` component (`web/src/components/choice`) is the starting point. (owner, 2026-10-29)
- **D-35:** On phones, tab tables become **row cards as designed**, with Edit and Delete always visible as 44 px targets. (owner, 2026-10-29)

### Due dates (ORD-11)
- **D-36:** The due wording follows the design: "Due Nov 18, 2026 · 5 days left", "Due today", "Due tomorrow", and "Overdue by 3 days" in the danger color **with an icon** (not color alone). Days count in Manila calendar days through `IBusinessCalendar` and the client business date. (owner, 2026-10-29)
- **D-37:** Overdue and days-left show **only for Pending, Mockup, In Production and Ready**. Delivered, Completed and Cancelled show the due date plainly. (owner, 2026-10-29)
- **D-38:** An imported order with **no due date shows `EmptyValue`** (OR-4) and no flag, and it **sorts last** in the due-date sort. The planner checks how the Phase 7 list sort handles a null due date, and asks the owner before any API change. (owner, 2026-10-29) The UI-SPEC research found the `due` sort already puts null due dates last, so no API change is needed.

### UI-SPEC rulings (OQ-1 to OQ-18 in `08-UI-SPEC.md`, /gsd-ui-phase 8)
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

### Planning rulings (Open Questions 1 to 5 in `08-RESEARCH.md`, /gsd-plan-phase 8)
- **D-59 (OQ 1):** "Today" for due flags, date presets, form defaults and future-date checks comes from the server. The order list and detail responses gain a `today` field (the business date from `IBusinessCalendar`), as Phase 6 does with `CompanyExpenseListResponse.Today`. The browser never reads the device clock for it. (owner, 2026-10-29)
- **D-60 (OQ 2):** The order list may run 3 fixed SQL commands: count, page, and one command for both D-41 list-wide counts. `OrderReaderQueryCountTests`, the endpoint count test and `list-performance.md` are updated together. The number stays fixed, so PERF-04 holds. (owner, 2026-10-29)
- **D-61 (OQ 3):** `/admin` lands on `/admin/orders` in this phase, until the dashboard ships. (owner, 2026-10-29)
- **D-62 (OQ 4):** E2E specs seed refunds through the testing seed endpoint (`POST /api/testing/orders`, Debug Testing builds only, never shipped). (owner, 2026-10-29)
- **D-89 (08-06 deferred item 2):** Route `AdminNotFoundPage` as a splat under the admin layout, so an unknown `/admin/...` address shows the in-shell "Page not found" screen instead of the public holding page. Do not delete the file. (owner, 2026-10-29)
- **D-90 (UAT test 4):** The Delivered status badge keeps the accent (orange) tone. (owner, 2026-10-30)
- **D-91 (UAT test 4, RESEARCH A4):** The Grid and Table switch keeps the current page; a filter change still goes back to page 1. (owner, 2026-10-30)
- **D-92 (UAT test 4):** The display figure sizes 17, 18, 24 and 28 px stay as built and are added to the UI spec as allowed money figure sizes. (owner, 2026-10-30)
- **D-93 (UAT test 4):** The filter chip Clear buttons stay 22 px. The owner accepts that they are under the 44 px touch target rule and that axe `target-size` fails on them in `@orders-filters` on the pixel project and `@long-text four-chip toolbars`. (owner, 2026-10-30)
- **D-94 (UAT test 5, WR-01):** The server sends each discount's peso amount in the order answer (a new `Amount` field, API types regenerated, no database change). The Discounts tab shows it and does no money math. (owner, 2026-10-30)
- **D-95 (UAT test 5, WR-02):** Payment, refund and discount windows keep the instant cap check, but refresh their order figures when the window regains focus and when a cap check fails, then check again with the current figures. (owner, 2026-10-30)
- **D-96 (UAT test 5, WR-05):** The order is refetched when the status menu opens, so Mark Completed is enabled or disabled from current figures. (owner, 2026-10-30)
- **D-97 (UAT test 5, IN-08 and WR-03):** Leave both as built: the Orders count uses the live page size, and the Orders list business day is not bounded to 5 minutes. (owner, 2026-10-30)
- Note (OQ 5, not an owner ruling): golden vectors v3 stay deferred as before, because no Phase 8 preview computes refunds. Raise it with the owner if a plan needs them.

### Carried forward (not re-asked)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` (Phase 8, around line 890): goal, success criteria and the decision list closed above. Criterion 5 gets the D-26 note.
- `.planning/REQUIREMENTS.md`: ORD-01 (reworded by D-04), ORD-02, ORD-06 (row back to Pending, D-25), ORD-07, ORD-10, ORD-11, ORD-12, ORD-15, ORD-19, and the ORD-17, ORD-18, ORD-22 and ORD-23 rules the screens use
- `.planning/PROJECT.md`: OD-14, OD-20 (closed by D-09), C-13 (closed by D-01), C-18 (closed for Phase 8 by D-06)

### API and behavior
- `docs/api/orders.md`: every order route, the list filters and sorts, statuses, delete, restore and purge, and the response shapes
- `docs/CSPS-UI-SPEC.md` §6.4 OrderTotals (line 568), §8.5 to §8.7 order screens (around line 1040 to 1235), §9 formulas (line 1340), §12.2 fixtures (line 1465). Superseded where D-01 to D-58 differ.
- `CSPS-PRD.md` §6.4 (Orders)
- `docs/operations/audit-log.md`: the order audit events, including the open APX-IN-01 UI-review item in STATE.md

### Prior phase decisions
- `.planning/phases/07-order-domain-api/07-CONTEXT.md`: D-01 to D-49
- `.planning/phases/07.1-legacy-fit-check-read-only/07.1-CONTEXT.md`: D-27 and D-28 (no relaxations, so the client rules match the server)
- `.planning/phases/06-company-expenses/06-CONTEXT.md` and `06-UI-SPEC.md`: the slice pattern, D-18 (payer default), D-54 (Deleted page, OQ defaults), D-62, D-63
- `.planning/phases/02-web-foundation-design-system/02-CONTEXT.md`: D-41 R2-06 (names)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/components/money/OrderTotals.tsx` and `components/data/OrderCard.tsx`: the existing panel and card. They need the D-01 names, the Refunded row (D-03), the credit block (D-02) and the profit note (D-07).
- `web/src/components/overlays/ConfirmDialog.tsx`, `components/lists/ResponsiveTable.tsx`, `components/choice` Tabs
- `web/src/modules/admin/components/PaidBySelect.tsx` and `hooks/useStaffLookupQuery.ts`: Received by, Paid by and Refunded by
- `ExpensesPage.tsx`, `DeletedExpensesPage.tsx`, `SettingsPage.tsx`, `CategoryModal.tsx`, `CategoryBadge.tsx`, `ExpenseModal.tsx`, plus `use*ListParams` (nuqs URL state) and `use*Query` hooks: the expenses slice to copy
- `modules/admin/services/expensesService.ts` and `expenseCategoriesService.ts`: the per-module service pattern (OR-5)

### Established Patterns
- Per-module services over `core/api` (OR-5), zod mirrors of the server rules (OR-3), URL state for list views (WEB-10), the owner layout tree (OR-6), no long dash (OR-4)
- The server computes every figure. The live totals in item, discount and payment windows are previews only, and the saved figures come from the server response (success criterion 3).

### Integration Points
- New API: a Manager-only read of a deleted order (D-24) with authorization-matrix rows.
- Possibly a null-due-date sort check (D-38).
- The `/admin` landing still redirects to Orders until the dashboard ships.

</code_context>

<specifics>
## Specific Ideas

- The owner wants a credit to be impossible to miss: a separate block, a list badge, and a direct "Record refund" button.
- Both people are wanted on money tabs: who handled the money and who typed it in.

</specifics>

<deferred>
## Deferred Ideas

- Profit on the dashboard: Phase 10 (C-18 dashboard scope).
- The audit line detail for order changes (APX-IN-01): decided in the Phase 8 UI review, per STATE.md.
- Status changes from the list, and delete from the list: declined for now (D-20, D-22).

</deferred>

---

*Phase: 08-order-screens*
*Context gathered: 2026-10-29*

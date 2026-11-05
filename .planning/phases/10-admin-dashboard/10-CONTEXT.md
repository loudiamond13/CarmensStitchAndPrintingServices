# Phase 10: Admin Dashboard - Context
*Created: 2026-11-05T06:50:00-06:00 · Updated: 2026-11-05T16:40:00-06:00*

**Gathered:** 2026-11-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff (Admin and Manager) land on a dashboard at `/admin` that shows how the shop stands: a greeting with today's date in Manila time, four shop-wide KPI cards, an income vs expenses chart (6 or 12 months), orders by status, and the 6 most recent orders. Each staff member also sees their own server-computed money on hand, its ledger, and can transfer part of it to a coworker. Managers see everyone's balances, delete wrong transfers, and hand over money held by staff who left.

Requirements: DASH-01 to DASH-06, MONEY-01 to MONEY-08.

Work starts on branch `gsd/phase-10-admin-dashboard`, cut from the Phase 9 tip because Phase 9 is not merged yet (owner, 2026-11-05). Phase 9 merges to main first.

Out of scope:
- Visitor metrics and analytics (Phase 12).
- Migrated payments, expenses and opening balances counting toward money on hand (OD-15, Phase 15).
- Any email or notification about money (see D-34).

The owner decisions the roadmap lists for this phase are closed here: C-40 (D-01 to D-13), C-18 (D-36 to D-46), OD-16 (D-14 to D-21), OD-17 (D-22), OD-18 (D-23 to D-35). OD-19 was ruled on 2026-10-07 and is carried forward. OD-14 carries forward (see below).

</domain>

<decisions>
## Implementation Decisions

### Carried forward from earlier phases
- **Active orders** are Pending, Mockup, In Production, Ready **and Delivered** (07 D-01, `OrderStatusRules.IsActive`). The UI spec (§8.3, §9 dashboard aggregates) predates Delivered and says "Pending to Ready". Phase 7 wins. The Orders by status footer label is rewritten to match, with no long dash or arrow (OR-4), for example "Active (Pending to Delivered)".
- **Overdue** shows only for Pending, Mockup, In Production and Ready (08 D-37).
- **Refunds** lower the refunder's money on hand (07 D-08). MONEY-01 already says so.
- **Expenses always count** against whoever paid them (owner, 2026-10-07).
- **OD-19** (owner, 2026-10-07): only Managers delete transfers. An Admin sees only their own money, ledger and transfers and gets 403 for anyone else's. A Manager sees everyone's.
- **Order profit** stays on the order page only (08 D-06). The chart's profit line (D-36) is a shop-wide monthly figure, not per-order profit.
- **OD-14** (design vs WCAG clashes) is ruled item by item in `/gsd-ui-phase 10`, as in Phases 4 to 9.

### Dashboard number rules (C-40)
- **D-01:** **"Due this week"** counts active orders with a due date from **Monday to Sunday of the current week in Manila time** (`IBusinessCalendar`). Overdue orders are not in this count. (owner, 2026-11-05)
- **D-02:** The Active orders foot also shows **"{n} overdue"** when there are any, for example "5 due this week · 2 overdue". Overdue follows 08 D-37. (owner, 2026-11-05)
- **D-03:** **Total receivables** = Σ max(balance, 0) over **all** active orders, overdue ones included. (owner, 2026-11-05)
- **D-04:** **Collected this month** = payments dated this month **minus refunds dated this month**, so the card always equals the chart's current-month income bar. (owner, 2026-11-05)
- **D-05:** **"Same day last month"**: the comparison period runs from the 1st of last month to the same day number. When last month has no such day (Mar 31 vs Feb), it **clamps to the last day of last month**. (owner, 2026-11-05)
- **D-06:** When the comparison period collected ₱0.00, **the percent is hidden**. The foot reads plain text such as "Nothing collected by this day in Sep". (owner, 2026-11-05)
- **D-07:** **Top category** on the Company expenses card is the category with the **most money spent** this month. Ties go to the alphabetically first name. (owner, 2026-11-05)
- **D-08:** **Orders by status** shows the 5 active statuses plus **Completed this month**. **Cancelled is hidden.** The Active total counts the 5 active statuses only. (owner, 2026-11-05)
- **D-09:** **Chart income** per month = payments by payment date **minus refunds** by refund date. (owner, 2026-11-05)
- **D-10:** **Chart expenses** per month = company expenses plus order expenses, each placed by **the expense's own date**. (owner, 2026-11-05)
- **D-11:** Money on **Cancelled orders still counts** (their payments, refunds and expenses) in the chart and the KPI totals. It matches the staff money ledger. (owner, 2026-11-05)
- **D-12:** **Admin and Manager see the same shop-wide dashboard numbers.** Only personal money on hand is limited per person (OD-19). (owner, 2026-11-05)
- **D-13:** **Live numbers on every visit.** No server cache holds dashboard figures, and the client invalidates dashboard queries after any order, payment, refund or expense mutation (SEC-07). (owner, 2026-11-05)

### Staff balance limits (OD-16)
- **D-14:** **A transfer above the sender's current money on hand is refused** with a plain-English error such as "You only have ₱3,200.00 on hand." The check and the insert run in one locked transaction (MONEY-05, SEC-07). A sender at or below zero can't send. (owner, 2026-11-05) — **Reversibility:** reversible.
- **D-15:** **An expense may take the payer below zero.** Expense create, edit and payer change do **not** run the balance check. The negative balance shows in red. (owner, 2026-11-05)
- **D-16:** **A payment correction (amount or receiver) or an order delete that pushes a balance below zero is allowed.** The record must match reality; the balance shows negative. (owner, 2026-11-05)
- **D-17:** **Money held by a deactivated or deleted staff member is handed over by a Manager**, who records a transfer **from the leaver to an active staff member**. This is the only case where the sender is not the signed-in user. It is Manager-only (Admin 403), audited with who did it, and gets authorization-matrix rows. Normal transfers keep the sender from the token (MONEY-04, CWE-639). (owner, 2026-11-05) — **Reversibility:** costly — it adds a second create path, its own endpoint or mode, audit event and matrix rows.
- **D-18:** A hand-over **can't exceed what the leaver holds** (same locked check as D-14). (owner, 2026-11-05)
- **D-19:** **Any staff member may transfer into a leaver** whose balance is negative, to bring it back to zero. Otherwise only active staff can receive transfers (MONEY-04). (owner, 2026-11-05)
- **D-20:** **Transfers may be backdated to any past date**, never future-dated in Manila time. The balance check uses the sender's balance now, not on the backdated date. (owner, 2026-11-05)
- **D-21:** Negative balances are shown in the danger color with the U+2212 minus (OR-4), on the dashboard card, the My money page and the All staff tab.

### Fixing a wrong transfer (OD-17, OD-18)
- **D-22:** **Transfers can't be edited**, not even the note. A wrong one is deleted and recorded again (MONEY-07). (owner, 2026-11-05)
- **D-23:** **Delete is a soft delete**: the transfer stays stored with "Deleted by" and "Deleted at", stops counting toward every balance, and needs the current `rowversion` (409 if stale). (owner, 2026-11-05) — **Reversibility:** one-way — it shapes the transfer table (deleted-by and deleted-at columns) and every balance query.
- **D-24:** A Manager may then **permanently remove a soft-deleted transfer**. Removing changes no balance (it already doesn't count); it only drops the history. Only soft-deleted transfers can be removed. (owner, 2026-11-05)
- **D-25:** Every permanent remove writes an **audit entry with the full record** (from, to, amount, date, note, recorded by, deleted by and when). The audit copy follows the 8-month retention (D-32). (owner, 2026-11-05)
- **D-26:** Permanent remove uses a **stronger, danger-styled confirm**: "Permanently remove this transfer? This can't be undone." with the amount and both people shown. (owner, 2026-11-05)
- **D-27:** Removal is **one transfer at a time**, no bulk action. (owner, 2026-11-05)
- **D-28:** **No restore.** A deleted transfer stays deleted; re-enter it instead. (owner, 2026-11-05)
- **D-29:** The soft delete uses a **simple confirm** like other deletes in the app. **No reason field.** (owner, 2026-11-05)
- **D-30:** Deleted transfers are **hidden by default** in the ledger and the transfer list, behind a **"Show deleted"** filter (filter state in the URL, WEB-10). (owner, 2026-11-05)
- **D-31:** **Only Managers see deleted transfers.** An Admin never sees them: the filter isn't offered to an Admin, and the API never returns deleted transfers to an Admin. (owner, 2026-11-05)
- **D-32:** **An Admin isn't told about a delete.** Their balance and ledger just update. (owner, 2026-11-05)
- **D-33:** A delete that **pushes someone below zero is allowed**. The confirm warns with the resulting balance, for example "Maria's balance will be −₱500.00". (owner, 2026-11-05)
- **D-34:** **No email** on delete or on any transfer. (owner, 2026-11-05)
- **D-35:** A Manager **may delete any transfer, including their own**. The audit log records who did it. (owner, 2026-11-05)

### Dashboard scope and money screens (C-18)
- **D-36:** The income vs expenses chart gets a **profit line**: per month, the income bar minus the expenses bar (D-09 minus D-10). It can go below zero and shows in the danger color then. Both roles see it. This extends UI-SPEC §8.3 (SPEC-GAP). (owner, 2026-11-05)
- **D-37:** No profit KPI card. The four KPI cards stay as designed. (owner, 2026-11-05)
- **D-38:** **Recent orders** = the 6 **newest created** orders, matching "Newest first". (owner, 2026-11-05)
- **D-39:** A new **"My money" page at `/admin/money`**, with a sidebar item using the `wallet` icon. It shows the balance, a Transfer button and the ledger table (`.s-rt`). SPEC-GAP, composed from existing card and table patterns (MONEY-02). (owner, 2026-11-05)
- **D-40:** The phone bottom bar **keeps its 4 items** (Dashboard, Orders, Expenses, Profile). Phone users reach My money from the sidebar menu and from the dashboard card. (owner, 2026-11-05)
- **D-41:** The ledger shows a **running balance after each row**, like a bank statement, newest first with server-side pagination (page in the URL). (owner, 2026-11-05)
- **D-42:** Managers get two tabs on the money page: **"Mine"** and **"All staff"**. Clicking a person opens their ledger. Admins see only their own view with no tabs (MONEY-03). (owner, 2026-11-05)
- **D-43:** **All staff** lists every active Admin and Manager, plus any deactivated or deleted person whose balance is not ₱0.00, marked "Deactivated" or "Deleted". (owner, 2026-11-05)
- **D-44:** All staff has a **total row**: "Total held by staff ₱…". (owner, 2026-11-05)
- **D-45:** A leaver's row with money has a **"Hand over"** button. It opens the transfer dialog with the leaver as sender (D-17). (owner, 2026-11-05)
- **D-46:** The **dashboard money card** is a slim personal strip **above the KPI row**, under the greeting: "Your money on hand ₱8,450.00", with "Transfer" and "View ledger". It's the same for both roles. (owner, 2026-11-05)
- **D-47:** **Transfers are recorded in a modal dialog** (To, Amount, Date defaulting to today, Note), opened from the dashboard card or the My money page, like the payment and expense dialogs. The zod schema mirrors the API validator (OR-3). (owner, 2026-11-05)

### UI contract rulings (UI phase, 2026-11-05)

- **D-48:** Managers get a third **"Transfers" tab** on My Money: every transfer, newest first, with Show deleted, Delete and Remove Permanently. (owner, 2026-11-05; UI-SPEC OQ-1)
- **D-49:** A transfer **to a former staff member who is owed money** is capped at what brings them back to ₱0.00. The "To" list shows no figure; the refusal tells a Manager the amount and tells an Admin to ask a Manager. (owner, 2026-11-05; UI-SPEC OQ-2)
- **D-50:** Chart names: "Income (payments minus refunds)", "Expenses (company + orders)", "Profit (income minus expenses)"; the tooltip's "Net" row becomes "Profit". (owner, 2026-11-05; UI-SPEC OQ-3)
- **D-51:** On phones the chart **draws at the real width** so text stays readable; on narrow screens with 12 months it labels every other month. (owner, 2026-11-05; UI-SPEC OQ-4, OD-14)

### Research rulings (plan step, 2026-11-05)

- **D-52:** The permanent-remove (and delete) audit entry records only **whether the transfer had a note** (`note=yes|no`), never the note text. Keeps free text out of the audit log and fits the 400-character detail limit. (owner, 2026-11-05; RESEARCH OQ-1)
- **D-53:** **Only transfer create and hand-over take the `staff-money` lock.** Expense, payment and refund saves do not, because they may already take a balance below zero (D-15, D-16). An integration test races a transfer against an expense for the same person and proves the transfer still never overdraws. (owner, 2026-11-05; RESEARCH OQ-2, assumption A4)
- **D-54:** The Collected card's change percent divides by the **absolute value** of last month's comparison amount, so a move from a negative to a positive figure shows as up. Still `null` when the comparison is 0.00 (D-06). (owner, 2026-11-05; RESEARCH OQ-3, assumption A6)
- **D-55:** "Due this week" **counts a Delivered order** whose due date falls Monday to Sunday of this week, the literal reading of D-01. (owner, 2026-11-05; RESEARCH OQ-4, assumption A5)
- **D-56:** Staff who are **Manager-locked or never finished first sign-in set-up are treated as active**: they show as Active in All Staff with their balance and can receive transfers. Only deactivated or deleted staff get Hand Over. (owner, 2026-11-05; RESEARCH OQ-5, replaces assumption A8's "not recipients")
- **D-57:** MoneyTransfers stores an explicit **`IsHandover` flag** (plus the sender `FromUserId` on every row), rather than inferring a hand-over from "recorder is not the sender". Keeps a later legacy import from being misread as hand-overs. (owner, 2026-11-05; plans 10-08, 10-12)
- **D-58:** Server-only messages approved as written: "Only money held by former staff can be handed over.", "Choose whose money to hand over.", "This person can't receive transfers now. Choose someone else.", "You can only see your own money.", "Only Managers can see deleted transfers.", "This transfer wasn't found.", "Choose 6 or 12 months." (owner, 2026-11-05; plans 10-06, 10-10, 10-12, 10-16, 10-18)
- **D-59 [informational]:** The plan checker's plan-size warning (13 plans touching 16 to 26 files, mostly generated contract files and tests) is **accepted as is**; split a plan only if an executor runs short of room. (owner, 2026-11-05; plan check)

### Claude's Discretion
- How the balance and ledger queries are built (one ledger union view vs per-source queries), as long as no balance is stored as an editable number and there's no inline SQL. The lock scope for D-14 is set by D-53 (MONEY-05).
- The API shape and resource names for dashboard, balances, ledger, transfers and hand-over, following the one-controller-per-resource rule.
- The chart's profit-line styling, legend and accessible text, within UI-SPEC tokens.
- Empty, loading and error copy for each card (DASH-06), in plain English.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` § Phase 10: goal, success criteria, owner decisions list.
- `.planning/REQUIREMENTS.md`: DASH-01 to DASH-06, MONEY-01 to MONEY-08, plus SEC-06 (idempotency), SEC-07 (concurrency and locking), SEC-08 (recorded by), CEXP-05, ORD-22, ORD-23, ORD-18 (refunds), WEB-10 (URL state), AUDIT-01.
- `.planning/PROJECT.md`: OD-16 to OD-19 and C-18 rows (closed here), C-40 (from `.planning/research/SUMMARY.md`).

### Design
- `docs/CSPS-UI-SPEC.md` §8.3 Dashboard, the dashboard aggregates table, §8.4 `.s-rt` table, §12.4 dashboard demo values.
- `.planning/design/` (local only, never commit): the Claude Design dashboard reference. The UI spec wins where they differ.

### Prior phase decisions
- `.planning/phases/07-order-domain-api/07-CONTEXT.md`: D-01 statuses (Delivered active), D-08 refunds lower money on hand.
- `.planning/phases/07-order-domain-api/07-AMENDMENTS.md`: the MONEY-01 refund amendment.
- `.planning/phases/08-order-screens/08-CONTEXT.md`: D-06 profit on order page only, D-37 overdue statuses.
- `.planning/phases/06-company-expenses/06-CONTEXT.md`: expense payer and categories.
- `.planning/phases/05-profile-user-management/05-CONTEXT.md`: D-07 soft-deleted users keep their name (leavers on the All staff tab).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/components/money/KpiCard.tsx`: KPI card for the four dashboard cards.
- `web/src/components/data/IncomeExpenseChart.tsx`: the hand-rolled SVG chart; extend it with the profit line (D-36).
- `web/src/components/choice/SegmentedControl.tsx`: the 6M and 12M switch.
- `web/src/components/feedback/Skeleton.tsx`, `states/Skeletons.tsx`, `lists/SkeletonTable.tsx`, `states/LoadingRegion.tsx`: card loading states (DASH-06).
- `web/src/components/lists/ResponsiveTable.tsx`, `data/DataTable.tsx`: recent orders, ledger and All staff tables.
- `web/src/components/status/Badge.tsx`: status badges for Orders by status and recent orders.
- `web/src/components/overlays/ConfirmDialog.tsx`: soft delete and the stronger permanent-remove confirm.
- `src/Csps.Domain/Orders/OrderStatusRules.cs`: `IsActive`, the source of truth for active statuses.
- `src/Csps.Application/Staff/`: the staff lookup (active Admins and Managers) for the transfer recipient picker.
- `IBusinessCalendar` and `TimeProvider`: Manila week, month, same-day and "not in the future" rules.
- `IAuditTrail` (FND-10): transfer delete, permanent remove and hand-over audit events.

### Established Patterns
- One `[ApiController]` per resource under `/api/v1`, thin actions, one handler per use case, `Result<T>` to ProblemDetails, explicit `[Authorize(Policy = ...)]` on every action, authorization-matrix test discovers every action.
- `rowversion` on aggregates with 409 on conflict; `Idempotency-Key` on create posts (SEC-06).
- Check-then-write money rules run in one locked transaction (as the ORD-05 overpayment rule does).
- API calls per module in `web/src/modules/admin/services/`; URL state for filters and pages.

### Integration Points
- `/admin` currently redirects to Orders (`web/src/modules/admin/routes.tsx`); this phase replaces that with the dashboard and adds `/admin/money`.
- The admin sidebar gains the My money item; the bottom bar stays as is (D-40).
- Order, payment, refund and expense mutations must invalidate the dashboard and money queries (D-13).

</code_context>

<specifics>
## Specific Ideas

- Card foot examples: "5 due this week · 2 overdue"; "Nothing collected by this day in Sep".
- Delete confirm warning example: "Maria's balance will be −₱500.00".
- Permanent remove confirm: "Permanently remove this transfer? This can't be undone."
- Over-send error example: "You only have ₱3,200.00 on hand."

</specifics>

<deferred>
## Deferred Ideas

- Whether migrated legacy payments and expenses count toward money on hand, and opening balances at go-live: OD-15, Phase 15.
- Email or in-app notices about transfers or deletes: not wanted now (D-34).

</deferred>

---

*Phase: 10-admin-dashboard*
*Context gathered: 2026-11-05*

# Phase 10: Admin Dashboard - Research

*Created: 2026-11-05T13:30:00-06:00 · Updated: 2026-11-05T13:30:00-06:00*

**Researched:** 2026-11-05
**Domain:** read-side aggregates over existing order and expense data (dashboard), a new staff-money ledger with a locked check-then-write transfer, a hand-rolled SVG chart extension, and two new admin screens
**Confidence:** HIGH on the codebase patterns (read this session), MEDIUM on EF Core query shapes not yet used in this repo (set operations, aggregate after `Take`), LOW only on the items in the Assumptions Log

<user_constraints>
## User Constraints (from CONTEXT.md)

Copied from `10-CONTEXT.md`. The long dashes before "**Reversibility:**" in D-14, D-17 and D-23 are shown as a period here, per the owner's no-long-dash rule. The wording is otherwise unchanged.

### Locked Decisions

#### Carried forward from earlier phases
- **Active orders** are Pending, Mockup, In Production, Ready **and Delivered** (07 D-01, `OrderStatusRules.IsActive`). The UI spec (§8.3, §9 dashboard aggregates) predates Delivered and says "Pending to Ready". Phase 7 wins. The Orders by status footer label is rewritten to match, with no long dash or arrow (OR-4), for example "Active (Pending to Delivered)".
- **Overdue** shows only for Pending, Mockup, In Production and Ready (08 D-37).
- **Refunds** lower the refunder's money on hand (07 D-08). MONEY-01 already says so.
- **Expenses always count** against whoever paid them (owner, 2026-10-07).
- **OD-19** (owner, 2026-10-07): only Managers delete transfers. An Admin sees only their own money, ledger and transfers and gets 403 for anyone else's. A Manager sees everyone's.
- **Order profit** stays on the order page only (08 D-06). The chart's profit line (D-36) is a shop-wide monthly figure, not per-order profit.
- **OD-14** (design vs WCAG clashes) is ruled item by item in `/gsd-ui-phase 10`, as in Phases 4 to 9.

#### Dashboard number rules (C-40)
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

#### Staff balance limits (OD-16)
- **D-14:** **A transfer above the sender's current money on hand is refused** with a plain-English error such as "You only have ₱3,200.00 on hand." The check and the insert run in one locked transaction (MONEY-05, SEC-07). A sender at or below zero can't send. (owner, 2026-11-05). **Reversibility:** reversible.
- **D-15:** **An expense may take the payer below zero.** Expense create, edit and payer change do **not** run the balance check. The negative balance shows in red. (owner, 2026-11-05)
- **D-16:** **A payment correction (amount or receiver) or an order delete that pushes a balance below zero is allowed.** The record must match reality; the balance shows negative. (owner, 2026-11-05)
- **D-17:** **Money held by a deactivated or deleted staff member is handed over by a Manager**, who records a transfer **from the leaver to an active staff member**. This is the only case where the sender is not the signed-in user. It is Manager-only (Admin 403), audited with who did it, and gets authorization-matrix rows. Normal transfers keep the sender from the token (MONEY-04, CWE-639). (owner, 2026-11-05). **Reversibility:** costly. It adds a second create path, its own endpoint or mode, audit event and matrix rows.
- **D-18:** A hand-over **can't exceed what the leaver holds** (same locked check as D-14). (owner, 2026-11-05)
- **D-19:** **Any staff member may transfer into a leaver** whose balance is negative, to bring it back to zero. Otherwise only active staff can receive transfers (MONEY-04). (owner, 2026-11-05)
- **D-20:** **Transfers may be backdated to any past date**, never future-dated in Manila time. The balance check uses the sender's balance now, not on the backdated date. (owner, 2026-11-05)
- **D-21:** Negative balances are shown in the danger color with the U+2212 minus (OR-4), on the dashboard card, the My money page and the All staff tab.

#### Fixing a wrong transfer (OD-17, OD-18)
- **D-22:** **Transfers can't be edited**, not even the note. A wrong one is deleted and recorded again (MONEY-07). (owner, 2026-11-05)
- **D-23:** **Delete is a soft delete**: the transfer stays stored with "Deleted by" and "Deleted at", stops counting toward every balance, and needs the current `rowversion` (409 if stale). (owner, 2026-11-05). **Reversibility:** one-way. It shapes the transfer table (deleted-by and deleted-at columns) and every balance query.
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

#### Dashboard scope and money screens (C-18)
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

#### UI contract rulings (UI phase, 2026-11-05)
- **D-48:** Managers get a third **"Transfers" tab** on My Money: every transfer, newest first, with Show deleted, Delete and Remove Permanently. (owner, 2026-11-05; UI-SPEC OQ-1)
- **D-49:** A transfer **to a former staff member who is owed money** is capped at what brings them back to ₱0.00. The "To" list shows no figure; the refusal tells a Manager the amount and tells an Admin to ask a Manager. (owner, 2026-11-05; UI-SPEC OQ-2)
- **D-50:** Chart names: "Income (payments minus refunds)", "Expenses (company + orders)", "Profit (income minus expenses)"; the tooltip's "Net" row becomes "Profit". (owner, 2026-11-05; UI-SPEC OQ-3)
- **D-51:** On phones the chart **draws at the real width** so text stays readable; on narrow screens with 12 months it labels every other month. (owner, 2026-11-05; UI-SPEC OQ-4, OD-14)

### Claude's Discretion
- How the balance and ledger queries are built (one ledger union view vs per-source queries), as long as no balance is stored as an editable number, there's no inline SQL, and the lock for D-14 covers every ledger source (MONEY-05).
- The API shape and resource names for dashboard, balances, ledger, transfers and hand-over, following the one-controller-per-resource rule.
- The chart's profit-line styling, legend and accessible text, within UI-SPEC tokens.
- Empty, loading and error copy for each card (DASH-06), in plain English.

### Deferred Ideas (OUT OF SCOPE)
- Whether migrated legacy payments and expenses count toward money on hand, and opening balances at go-live: OD-15, Phase 15.
- Email or in-app notices about transfers or deletes: not wanted now (D-34).
- (Phase boundary) Visitor metrics and analytics belong to Phase 12.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Greeting with first name and business date, View Orders / New Order | Summary endpoint returns `today`, greeting part and first name from the server clock (Pattern 5); `/admin` index replaces the redirect; the dev `/admin` preview must go (Pitfall 1) |
| DASH-02 | Four KPI cards (C-40) | One grouped orders read (Pattern 5), payments minus refunds this month and the clamped comparison (D-04 to D-06, Pattern 6), company expense KPIs reused from `ICompanyExpenseReader.GetKpisAsync` (top category and tie rule already match D-07) |
| DASH-03 | Income vs expenses chart 6/12 months, range in URL | Four month-grouped sums by `DateOnly.Year/Month` (translated by EF, cited), server fills empty months and computes profit (Pattern 7); chart component changes behind new props (Pattern 11) |
| DASH-04 | Orders by status with active total | Conditional counts in the same orders read; Completed this month by `StatusChangedAtUtc` in the business month UTC range; Cancelled hidden |
| DASH-05 | 6 most recent orders | `CreatedAtUtc` desc, then id, reusing the order list row projection |
| DASH-06 | Loading, empty, error per card | Three client queries (summary, chart, own balance) with per-card state rendering; copy fixed in UI-SPEC |
| MONEY-01 | Server-computed money on hand from six sources | One balance read with six correlated sums; deleted orders drop out through the named `SoftDelete` filters already on payments, refunds and order expenses; deleted expenses and deleted transfers excluded (Pattern 2) |
| MONEY-02 | Own balance and paged ledger, newest first, page in URL | Narrow `Concat` ledger query plus per-kind detail reads; running balance worked out from the balance and the sum of newer rows (Pattern 3) |
| MONEY-03 | Admin own only (403 otherwise, even for unknown ids); Manager all | Handler checks role from `IStaffDirectory.GetStaffStateAsync` before any existence check (Pattern 8) |
| MONEY-04 | Transfer to an active coworker; sender from token; validation; idempotent; stored fields | New `MoneyTransfer` aggregate, FluentValidation messages from UI-SPEC § Validation, `Idempotency-Key` via the existing gate, `IAttributedRecord` stamping (Patterns 1, 4) |
| MONEY-05 | Never overdraw, even under two concurrent attempts | New standing `DatabaseLocks` row taken with `ExecuteUpdate` (existing D-50 pattern) before the balance read (Pattern 4) |
| MONEY-06 | Manager-only soft delete with rowversion and audit | Soft delete with `version` query parameter, 409 `edit.stale`, audit entry with ids only (Pattern 9; Open Question 1 on the note) |
| MONEY-07 | No edit endpoint | No PUT/PATCH route; matrix and discovery tests prove it |
| MONEY-08 | Matrix rows for every endpoint | Row list in Pattern 8 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These carry the same weight as locked decisions. The planner must check every plan against them.

- **Stack:** .NET 10 controllers (`[ApiController]`, attribute routes under `/api/v1`), EF Core 10 code-first with Fluent config only, FluentValidation in handlers, `Result<T>` to ProblemDetails. React 19 + TS strict, React Router 8 (`react-router`), TanStack Query 5, RHF + zod 4, Tailwind 4.
- **Forbidden:** axios, MediatR, AutoMapper, FluentAssertions v8+, any UI kit, `react-router-dom`, Swashbuckle/NSwag, `FluentValidation.AspNetCore`, chart packages (charts are hand-rolled SVG).
- **No inline SQL** in application code: no `FromSql`, `SqlQuery`, `ExecuteSql`, ADO SQL strings. `NoInlineSqlTests` scans `src/` and fails on them. Generated migrations are the only exception.
- **No new triggers** (OR-7). `TriggerInventoryTests` fails on any trigger other than `TR_AuditLog_AppendOnly`.
- **No JSON columns.** Drops, renames and lossy type changes need the owner first. Every table and column comes from an EF migration. Never `Database.Migrate()` at startup.
- **Money:** `decimal(18,2)`, server-computed only. No endpoint accepts a balance.
- **Time:** UTC storage plus `TimeProvider` / `IBusinessCalendar`. Never `DateTime.Now`.
- **Concurrency:** `rowversion` per aggregate, 409 on conflict; check-then-write money rules in one locked transaction (SEC-07).
- **Idempotency:** every state-changing POST needs `Idempotency-Key` (SEC-06).
- **Authorization:** default deny; every action declares `[Authorize(Policy = ...)]` or `[AllowAnonymous]`; the matrix test discovers every action; automatic 400 model-state is off.
- **Onion layers** enforced by ArchUnitNET: Domain ← Application ← Infrastructure ← Server. Application never sees EF or Identity.
- **Client:** OR-3 zod mirrors every server rule; OR-4 no em or en dash in `web/src` (`no-long-dash.node.test.ts`), `EmptyValue` for empty values, U+2212 only in money; OR-5 calls in `modules/admin/services/`, only `core/api/http` touches `fetch`; OR-6 owner layout tree; nuqs URL state rules (WEB-10).
- **Quality:** TDD; zero warnings everywhere; coverage Domain 100%, Application ≥ 95%, `core/api` 100%, web ≥ 90%; zero axe violations; strict CSP (no `style` attribute; custom properties via React).
- **Budgets:** admin initial JS ≤ 250 KB gz; pages are lazy chunks.
- **Comments:** minimal and concise (OR-2). No history narration.
- **Shared machine:** run `C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` before dev servers, e2e or full test runs; LocalDB `CSPS_*` databases only; never touch `BetsLLC_*`; set env vars per process only.
- **Packages:** no new package is needed for this phase (see Package Legitimacy Audit).
- **Merges:** only through `tools/scripts/Merge-PullRequest.ps1` on the owner's word.
- **Markdown:** created and updated timestamps on every file created or edited.

## Summary

Phase 10 is mostly read-side work over data that already exists. Orders store their money snapshot (`Total`, `Balance`, `PaidTotal`, `RefundedTotal`) as columns, payments, refunds and both kinds of expense already carry their staff person (`ReceivedByUserId`, `RefundedByUserId`, `PaidByUserId`) with covering indexes that Phases 6 and 7 added for this phase, and the company expense KPIs already compute "this month", count and top category with D-07's tie rule. The dashboard is therefore a handful of LINQ aggregates behind one summary endpoint and one chart endpoint, plus a pure date-rules helper for the Manila week, the clamped "same day last month" and the greeting.

The only new write model is the money transfer. It needs a new table with soft-delete columns and a `rowversion`, two create paths (normal and Manager hand-over), a soft delete with a version, and a permanent remove of soft-deleted rows. The hard part is MONEY-05: two concurrent transfers must never overdraw. The codebase already solves the same shape without inline SQL or triggers: the D-50 `DatabaseLocks` table holds standing lock rows, and `DatabaseLocks.TakeAsync` takes one with an `ExecuteUpdate` inside the caller's transaction, so a second taker waits. A new standing row (`staff-money`) taken first inside the transfer transaction, before the balance is read, serializes every check-then-write that can refuse on a balance. Writers that never refuse on a balance (expenses, payments, refunds, deletes, by D-15, D-16, D-33) do not need to take it, because any interleaving with them equals a serial order (analysis in Pattern 4).

The ledger is the second hard part: a page of rows from six sources, newest first, with a running balance after each row. EF Core has no window-function translation, so the running balance is worked out in code from the current balance minus the sum of the rows newer than the page. The page itself is one `Concat` (UNION ALL) of narrow, same-typed projections, followed by small per-kind reads for the text of the rows on the page. This shape avoids the known EF set-operation pitfall with mismatched string facets, and should be proved first with a Wave 0 integration test against LocalDB.

**Primary recommendation:** Build the transfer as a new aggregate guarded by a new `staff-money` standing lock row (existing `DatabaseLocks` pattern), compute every balance and the ledger with LINQ only, return all figures from three dashboard and money endpoints, and remove the dev-only `/admin` preview route so the real dashboard is reachable in dev and e2e builds.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| KPI figures, status counts, recent orders, greeting, business today | API / Backend | Database (aggregates) | Core Value: every figure is server-computed; business time comes from `IBusinessCalendar`, never the device |
| Chart month buckets and profit | API / Backend | Browser (drawing only) | D-36 profit is a figure, so the server sends it; the browser only draws and formats |
| Week, month, same-day and greeting rules | Domain (pure) | API | Pure date math on `BusinessClock`; Domain coverage is 100% |
| Money on hand and running balance | API / Backend | Database (sums) | MONEY-01: never stored, never accepted from a client |
| Transfer rules (amount, recipient, date, caps) | Domain | API (validator mirrors) | One rule set the handler and the domain both enforce; the zod schema mirrors the messages |
| Overdraw guard under concurrency | Database (lock row) | API (transaction) | Only the database can serialize two requests; existing D-50 lock pattern |
| Who may see which balance | API / Backend | Browser (route loader redirect) | The browser only hides; the API answers 403 (CWE-639) |
| Range, tab, page, size, deleted state | Browser (URL via nuqs) | API (allow-list re-checks) | WEB-10 |
| Freshness after mutations | Browser (TanStack invalidation) | API (no cache) | D-13 |
| Audit of delete, remove, hand-over | API / Backend | Database (append-only) | AUDIT-01, `IAuditTrail` |

## Standard Stack

No new libraries. Everything uses what is installed.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Microsoft.EntityFrameworkCore.SqlServer | 10.0.13 | LINQ aggregates, `Concat`, `ExecuteUpdate` lock | Pinned in `Directory.Packages.props` [VERIFIED: Directory.Packages.props:12] |
| FluentValidation | 12.1.1 | Transfer and query validators in handlers | Project standard [VERIFIED: Directory.Packages.props:22] |
| Microsoft.AspNetCore.OpenApi | 10.0.13 | Generated types for `web/src/types/api.generated.ts` | Project standard [VERIFIED: Directory.Packages.props:17] |
| @tanstack/react-query | installed | Dashboard and money queries, invalidation | Project standard [VERIFIED: web/package.json dependencies] |
| nuqs | installed (2.10.1 per WEB-10) | `range`, `tab`, `page`, `size`, `deleted` URL state | Project standard [VERIFIED: web/package.json dependencies] |
| react-hook-form + zod + @hookform/resolvers | installed | Transfer modal (OR-3) | Project standard [VERIFIED: web/package.json dependencies] |

### Test stack (already installed)
| Library | Version | Purpose |
|---------|---------|---------|
| xunit.v3 | 4.0.1 | .NET tests (MTP) [VERIFIED: Directory.Packages.props:33] |
| Shouldly | 4.3.0 | Assertions [VERIFIED: Directory.Packages.props:37] |
| Respawn | 7.0.0 | DB reset between tests [VERIFIED: Directory.Packages.props:40] |
| TngTech.ArchUnitNET | 0.13.4 | Layer rules [VERIFIED: Directory.Packages.props:41] |
| Vitest, RTL, MSW, Playwright | installed | Web unit, component and e2e |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Standing lock row (`staff-money`) | SERIALIZABLE transaction via `BeginTransactionAsync(IsolationLevel.Serializable)` | No inline SQL either, but range locks over six tables raise deadlock risk with order writes, and the idempotency gate already owns the outer transaction at READ COMMITTED. The lock row is the project's proven pattern. |
| Standing lock row | Per-person stripe rows (like the 64 `account-token:NN` rows) | Finer, but a hand-over or a D-49 transfer touches two people, so two stripes must be taken in a fixed order to avoid deadlocks. Transfers are rare in a small shop; one row is simpler and deadlock-free. |
| Standing lock row | A stored per-staff balance row with `rowversion` | Violates MONEY-01 ("never stored as an editable number") and would need every payment, refund and expense write to update it. |
| LINQ `Concat` ledger | A SQL view in a migration mapped with `ToView` | Allowed (migration SQL), but the view drifts silently from entity changes and adds a schema object to keep in step; LINQ stays typed and testable. Keep as the fallback if `Concat` will not translate. |
| LINQ `Concat` ledger | Per-source `Take(page*size)` reads merged in memory | Works on any EF version; cost grows with the page number. Second fallback. |
| Hand-rolled chart | Any chart package | Forbidden (CLAUDE.md). |

**Installation:** none.

## Package Legitimacy Audit

This phase installs no external packages. The UI-SPEC confirms "New packages: none" and "Phase 10 adds no icon" (every icon is already in `icons.ts`).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | | | | | | |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Browser (/admin, /admin/money, /admin/money/staff/:id)
  | useDashboardSummaryQuery      useDashboardChartQuery(range)      useMyMoneyQuery / useLedgerQuery / ...
  v                               v                                   v
core/api httpClient (JWT, Idempotency-Key on POST, params serialized)
  |
  v
ASP.NET Core: auth policy (Staff | Manager) -> IdempotencyGate (POST only: claim row, outer transaction)
  |
  +--> DashboardController ------> GetDashboardSummaryHandler -----> IBusinessCalendar (today, week, month, greeting)
  |                                  |                           \--> IDashboardReader: orders aggregate, payments/refunds sums,
  |                                  |                                recent 6 orders, caller first name
  |                                  \--> ICompanyExpenseReader.GetKpisAsync (reused)
  |                         \----> GetDashboardChartHandler --------> IDashboardReader: 4 month-grouped sums -> fill months, profit
  |
  +--> StaffMoneyController -----> role check (IStaffDirectory) --403--> stop
  |                                  \--> IStaffMoneyReader: balance (6 sums) | all balances | ledger page (Concat) + row details
  |
  +--> MoneyTransfersController --> CreateMoneyTransferHandler / HandOverMoneyHandler
                                     | validate (FluentValidation, business today)
                                     | InTransaction:
                                     |   1. take "staff-money" lock (ExecuteUpdate on DatabaseLocks row)
                                     |   2. read sender, recipient states and balances (6 sums each)
                                     |   3. MoneyTransfer.Record(...) decides (cap, recipient rules)
                                     |   4. add row (+ audit for hand-over), SaveChanges
                                     | commit with the gate (stored response)
                                  -> DeleteMoneyTransferHandler (version check, soft delete, audit)
                                  -> RemoveMoneyTransferHandler (only soft-deleted, audit full ids record, hard delete)
                                     |
                                     v
                                SQL Server: MoneyTransfers, OrderPayments, OrderRefunds, OrderExpenses,
                                CompanyExpenses, Orders (SoftDelete filter), Users, DatabaseLocks, AuditLog
```

### Recommended Project Structure

```
src/
  Csps.Domain/
    Money/                       MoneyTransfer.cs (aggregate), MoneyRules.cs (messages, caps), MoneyOnHand.cs (sum rule)
    Time/BusinessClock.cs        add WeekOf, SameDayLastMonth, GreetingPart (pure)
    Orders/OrderStatusRules.cs   add CanBeOverdue (Pending, Mockup, InProduction, Ready)
  Csps.Application/
    Dashboard/                   GetDashboardSummaryHandler, GetDashboardChartHandler, responses
    Money/                       Create/HandOver/Delete/Remove handlers, List/Ledger/Balance handlers, validators,
                                 MoneyErrors, MoneyAuditDetail, LedgerRunningBalance (pure)
    Ports/                       IDashboardReader, IStaffMoneyReader, IMoneyTransfers, IStaffMoneyLock, StaffMoneyBusyException
  Csps.Infrastructure/
    Dashboard/DashboardReader.cs
    Money/StaffMoneyReader.cs, MoneyTransferStore.cs, StaffMoneyLock.cs, MoneyRegistration.cs
    Persistence/Configurations/MoneyTransferConfiguration.cs
    Persistence/Locking/DatabaseLocks.cs   add StaffMoney standing name
    Persistence/Migrations/<ts>_AddMoneyTransfers.cs  (generated)
  Csps.Server/Controllers/
    DashboardController.cs, StaffMoneyController.cs, MoneyTransfersController.cs
web/src/
  components/data/IncomeExpenseChart.tsx       new optional props (showProfit, labels), negatives, true-pixel width
  components/navigation/Sidebar.tsx            MONEY_NAV_ITEM after Company Expenses
  modules/admin/
    pages/DashboardPage.tsx, MoneyPage.tsx, StaffMoneyPage.tsx
    components/MoneyStrip.tsx, OrdersByStatusCard.tsx, RecentOrdersCard.tsx, MoneyOnHandCard.tsx, LedgerTable.tsx,
               StaffBalancesTable.tsx, TransfersTable.tsx, TransferModal.tsx, DeleteTransferDialog.tsx, RemoveTransferDialog.tsx
    hooks/     useDashboardRange, useMoneyListParams, useStaffMoneyParams, query and action hooks, useRefreshMoney
    services/  dashboardService.ts, moneyService.ts
    dashboardCopy.ts, moneyCopy.ts, moneySchemas.ts, routes.tsx, sections.ts, auditCopy.ts
```

### Pattern 1: The MoneyTransfer aggregate and table

**What:** one aggregate, created by a factory that checks every rule, soft-deleted by a method, never edited. It implements `IAttributedRecord` so the existing `RecordStampInterceptor` stamps Created* and Updated* from the token and clock (SEC-08), exactly as `CompanyExpense` does.

**Schema (one migration, generated):**

| Column | Type | Notes |
|---|---|---|
| Id | uniqueidentifier PK | version 7 id made by the domain, as `Order` ("a version 7 id made by the domain" [VERIFIED: src/Csps.Domain/Orders/Order.cs:53]) |
| FromUserId, ToUserId | uniqueidentifier NOT NULL | FK to Users, `OnDelete(NoAction)` like every other people FK |
| Amount | decimal(18,2) NOT NULL | `HasPrecision(18, 2)`; CHECK `[Amount] > 0` (same form as `CK_OrderPayments_Amount_Positive`) |
| TransferDate | date NOT NULL | `HasColumnType("date")`, `DateOnly` |
| Note | nvarchar(200) NULL | trimmed, blank becomes null |
| CreatedById, CreatedAtUtc, UpdatedById, UpdatedAtUtc | per SEC-08 | set only by the interceptor |
| DeletedById, DeletedAtUtc | NULL | D-23 |
| EditVersion | uniqueidentifier | if the aggregate implements `IEditVersioned`, so the soft delete counts as a staff edit (as expenses do) |
| RowVersion | rowversion | `IsRowVersion()` |

- CHECK `[FromUserId] <> [ToUserId]` (a constraint, not a trigger; OR-7 allows it).
- Indexes: `(FromUserId) INCLUDE (Amount, TransferDate) WHERE DeletedAtUtc IS NULL`, the same on `ToUserId`, `(TransferDate DESC, CreatedAtUtc DESC, Id)` for the Transfers tab, and plain FK indexes on `CreatedById`, `UpdatedById`, `DeletedById` (the repo indexes every people FK, e.g. `IX_CompanyExpenses_DeletedById`).
- **Do not give the entity a query filter named `SoftDelete`.** See Pitfall 4. Filter deleted transfers explicitly through one helper (`CountedTransfers(context)`), or name the filter differently (for example `TransferDeleted`).
- A hand-over needs no extra column: it is the one transfer whose `CreatedById` differs from `FromUserId` (normal transfers take the sender from the token). If the planner prefers clarity, a `bit IsHandover` column is fine too.

### Pattern 2: Money on hand from six sources (MONEY-01)

**What:** one read that returns the balance for one or many people with correlated sums. Every source already has a covering index by person:

- `IX_OrderPayments_ReceivedByUserId` includes `Amount, PaymentDate` [VERIFIED: src/Csps.Infrastructure/Persistence/Configurations/OrderPaymentConfiguration.cs:40-42]
- `IX_OrderRefunds_RefundedByUserId` includes `Amount, RefundDate` [VERIFIED: src/Csps.Infrastructure/Persistence/Configurations/OrderRefundConfiguration.cs:36-38]
- `IX_OrderExpenses_PaidByUserId` includes `Amount, ExpenseDate` [VERIFIED: src/Csps.Infrastructure/Persistence/Configurations/OrderExpenseConfiguration.cs:39-41]
- `IX_CompanyExpenses_PaidByUserId` includes `Amount` [VERIFIED: src/Csps.Infrastructure/Persistence/Configurations/CompanyExpenseConfiguration.cs:47]

Deleted orders drop out with no extra code: payments, refunds and order expenses each carry the named filter on their order, for example `builder.HasQueryFilter("SoftDelete", payment => payment.Order.DeletedAtUtc == null);` [VERIFIED: src/Csps.Infrastructure/Persistence/Configurations/OrderPaymentConfiguration.cs:30], and company expenses carry `builder.HasQueryFilter("SoftDelete", expense => expense.DeletedAtUtc == null);` [VERIFIED: src/Csps.Infrastructure/Persistence/Configurations/CompanyExpenseConfiguration.cs:31]. This matches D-16 (an order delete may push a balance below zero) and MONEY-01 (deleted expenses never count).

```csharp
// Infrastructure: one statement, six correlated sums per person. EF wraps each Sum in COALESCE, so no row gives 0.00.
var rows = await context.Users.AsNoTracking()
    .Where(user => ids.Contains(user.Id))
    .Select(user => new BalanceRow
    {
        UserId = user.Id,
        Received = context.Set<OrderPayment>().Where(p => p.ReceivedByUserId == user.Id).Sum(p => p.Amount),
        Refunded = context.Set<OrderRefund>().Where(r => r.RefundedByUserId == user.Id).Sum(r => r.Amount),
        OrderSpent = context.Set<OrderExpense>().Where(e => e.PaidByUserId == user.Id).Sum(e => e.Amount),
        CompanySpent = context.CompanyExpenses.Where(e => e.PaidByUserId == user.Id).Sum(e => e.Amount),
        In = context.MoneyTransfers.Where(t => t.ToUserId == user.Id && t.DeletedAtUtc == null).Sum(t => t.Amount),
        Out = context.MoneyTransfers.Where(t => t.FromUserId == user.Id && t.DeletedAtUtc == null).Sum(t => t.Amount),
    })
    .ToListAsync(cancellationToken);
// Domain: MoneyOnHand.Of(received, transfersIn, transfersOut, orderSpent + companySpent, refunded)
```

The arithmetic belongs in a pure Domain function (`MoneyOnHand`) so it is covered at 100% and the reader only sums. [ASSUMED: EF Core translates `Sum` over an empty set with COALESCE to 0 for a non-nullable `decimal`; prove it in the reader's integration test with a person who has no rows.]

### Pattern 3: The ledger page with a running balance (MONEY-02, D-41)

**What:** EF Core has no window-function translation in its SQL Server function mappings [CITED: learn.microsoft.com/en-us/ef/core/providers/sql-server/functions, the page lists aggregates, dates, strings and math, and no `OVER` / `ROW_NUMBER`]. So:

1. **Page rows:** one `Concat` of six narrow projections with identical CLR and store types only: `Kind` (int constant), `SourceId` (Guid), `Date` (DateOnly, all `date`), `RecordedAtUtc` (DateTimeOffset), `Signed` (decimal(18,2): + for money in, − for money out, 0 for a deleted transfer), `Deleted` (bool). No strings in the union. Order by `Date desc, RecordedAtUtc desc, Kind, SourceId`, then `Skip/Take`.
2. **Row text:** for the page's ids, one small read per kind present (order number, team or customer, method name; category name and description; counterpart `ActorRef`, note, recorder; deleted by and at). At most six reads for at most 100 rows.
3. **Running balance:** `balanceAfterNewestOnPage = currentBalance − Σ Signed of the rows before this page (the newer ones)`. Then walk down the page: each next row's balance is the previous row's balance minus the previous row's `Signed`. Deleted rows carry `Signed = 0` and get `null` as their balance (UI shows "Not counted").
4. **Sum of newer rows:** `ordered.Take((page - 1) * pageSize).Sum(row => row.Signed)`. [ASSUMED: EF Core 10 pushes `Take` into a subquery before the aggregate on a `Concat` source. Prove it in Wave 0. Fallback: select only `Signed` for the skipped rows and add them in memory; the shop has thousands of rows, not millions.]

Kinds and their sign (UI-SPEC § Ledger rows): payment received +, refund handed back −, transfer in +, transfer out −, company expense paid −, order expense paid −.

Put the walk-down in a pure function (`LedgerRunningBalance.Apply(rows, balanceAfterFirst)`) with unit tests, so the reader only fetches.

The Admin ledger never includes deleted transfers, whatever the query says (D-31). The handler decides `includeDeleted = callerIsManager && request.Deleted`, and an Admin who sends `deleted=true` gets 403 (recommended, see Pattern 8).

### Pattern 4: The locked transfer (MONEY-05, D-14, D-18, D-19, D-49)

**What:** reuse the D-50 lock pattern. The lock is an `ExecuteUpdate` on a standing row inside the open transaction; SQL Server holds the row's exclusive lock to the end of the transaction, so a second taker waits:

```csharp
// Existing code [VERIFIED: src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs:76-80 in TakeAsync]
var changed = await context.Set<DatabaseLock>()
    .Where(row => row.Name == name)
    .ExecuteUpdateAsync(set => set.SetProperty(row => row.TakenAtUtc, now), cancellationToken)
```

The standing names today are `ActiveManagers = "active-managers"`, `OrderNumbers = "order-numbers"` and 64 `"account-token:"` stripes (`AccountStripeCount = 64`) [VERIFIED: src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs:13-33]. Add `StaffMoney = "staff-money"` to `StandingNames`; `DatabaseLockConfiguration` seeds every standing name with `builder.HasData(DatabaseLocks.StandingNames.Select(name => new { Name = name }));` [VERIFIED: src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs:22], so the generated migration inserts the new row. `DatabaseLocksMigrationTests` asserts `rows.Count.ShouldBe(66);` [VERIFIED: tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksMigrationTests.cs:22] and must become 67.

**Handler shape (mirrors the order-number and roster-lock handlers):**

```csharp
// Application. The lock comes first, before any balance is read.
return await ConflictRetry.RunAsync(
    () => unitOfWork.InTransactionAsync(async token =>
    {
        await moneyLock.LockAsync(token);                                  // IStaffMoneyLock -> DatabaseLocks.TakeAsync(StaffMoney)
        var sender = await staff.GetStaffStateAsync(senderId, token);     // re-read under the lock
        var recipient = await staff.GetStaffStateAsync(request.ToUserId!.Value, token);
        var balances = await money.GetBalancesAsync([senderId, recipient.Id], token);
        var recorded = MoneyTransfer.Record(senderId, recipient, amount, date, note, clock.Today, balances);
        if (recorded.IsFailure) return Result.Failure<...>(recorded.Error);   // 400 field error under amount or toUserId
        transfers.Add(recorded.Value);
        await unitOfWork.SaveChangesAsync(token);
        return Result.Success(new TransferSaved(..., senderBalanceAfter));
    }, cancellationToken),
    Result.Failure<...>(MoneyErrors.Busy));
```

- Lock timeouts: follow `OrderNumberAllocator`, which catches the lock's `InvalidOperationException` with its own message and throws `OrderNumberBusyException` for the handler to map [VERIFIED: src/Csps.Infrastructure/Orders/OrderNumberAllocator.cs:68-79]. Add `StaffMoneyBusyException` in `Application/Ports` and map it to a 409 with a plain line such as "Something changed at the same time. Try again." (the existing `AuthErrors.SessionBusyMessage` wording).
- The idempotency gate already opens the outer transaction for a POST; `InTransactionAsync` joins it with a savepoint [VERIFIED: src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs:55-72], so the lock is held until the gate commits the stored response.
- Refusals are 400 field errors, as the overpayment rule is: `OrderRules.Reject<OrderPayment>(OrderRules.PaymentPath(null, OrderRules.PaymentAmountField), OrderRules.PaymentAboveBalance(balance))` [VERIFIED: src/Csps.Domain/Orders/Order.cs:928]. The UI-SPEC wants the line under Amount (or under To for a recipient change).

**Why the other ledger writers do not take the lock (the D-14 / MONEY-05 "covers every ledger source" reading):**
- The balance is read after the lock is held, so every committed payment, refund, expense and transfer is in it. Under READ COMMITTED each statement sees all committed rows; under RCSI each statement's snapshot starts after the lock wait, so the same holds. The live database has RCSI off (05-SECURITY D-3, 01-13).
- The only writers that refuse on a balance are transfer create and hand-over, and both take the lock, so two of them can never both pass on the same balance.
- Every other writer is allowed to push a balance below zero (D-15 expenses, D-16 payment corrections and order deletes, D-33 transfer deletes). If one of them commits while a transfer holds the lock, the outcome equals "transfer first, then that write", which is a legal serial order. No invariant is broken.
- Recommendation: record this reading as a dated ruling note in the plan, and back it with an integration test that races a transfer against an expense for the same person and asserts the final balance equals the serial outcome. If the owner wants the literal reading (every ledger writer takes the lock), it is a one-line `LockAsync` call in about ten handlers; flag it as Open Question 2 rather than deciding it silently.

**Rules the domain checks (UI-SPEC § Validation wording):**

| Rule | Mode | Message |
|---|---|---|
| sender balance ≤ 0 | transfer | "You have nothing on hand to transfer." |
| amount > sender balance | transfer | "You only have {₱3,200.00} on hand." |
| leaver balance ≤ 0 | hand-over | "{name} has nothing on hand to hand over." |
| amount > leaver balance | hand-over | "{name} only has {₱2,000.00} on hand." |
| recipient not active and not a leaver owed money | transfer | "{name} can't receive transfers now. Choose someone else." |
| recipient is a leaver owed money and amount > −balance | transfer, Manager | "{name} is owed only {₱500.00}. Enter that or less." |
| same, Admin | transfer, Admin | "That's more than {name} is owed. Ask a Manager for the amount." |
| to = sender | both | "Choose someone other than yourself." / "Choose someone other than {name}." |

`Pesos.Format` writes `"₱" + amount.ToString("N2", CultureInfo.InvariantCulture)` [VERIFIED: src/Csps.Domain/Orders/Pesos.cs:11], so pass the positive figure (`-balance`) in the "owed" message, never a negative.

"Active" for a recipient is the existing payer rule: `Role is Roles.Admin or Roles.Manager && IsActive && !IsManagerLocked && !IsDeleted && HasFinishedSetUp` [VERIFIED: src/Csps.Application/Staff/StaffState.cs:16-17 (`CanPay`)]. A "leaver" is `!IsActive || IsDeleted` with an Admin or Manager role.

### Pattern 5: Dashboard summary in one request

**What:** one `GET /api/v1/dashboard/summary` returns `today`, the greeting part, the caller's first name, the four KPI figures and their foot data, the six status counts and the active total, and the 6 newest orders. One request gives one consistent snapshot (all cards use the same `today` and the same instant), which matters at a month or week boundary. Each card still renders its own loading, empty and error look from that one query (UI-SPEC lets the planner fix shapes).

- **Orders aggregate:** one grouped read, in the style the code already uses (`.GroupBy(static _ => 1).Select(group => new { ... })` [VERIFIED: src/Csps.Infrastructure/Orders/OrderReader.cs:68-72]): counts per status for the five active statuses, active total, due this week (active, `DueDate` in `[monday, sunday]`, not overdue), overdue (status in Pending, Mockup, InProduction, Ready and `DueDate < today`), receivables `Sum(o => o.Balance > 0m ? o.Balance : 0m)` over active orders, Completed this month (`Status == Completed && StatusChangedAtUtc` in `clock.MonthUtcRange(today)`). The named `SoftDelete` filter on orders already hides deleted ones.
- **Statuses:** `Pending = 1, Mockup = 2, InProduction = 3, Ready = 4, Delivered = 5, Completed = 6, Cancelled = 7` [VERIFIED: src/Csps.Domain/Orders/OrderStatus.cs:7-28]; `IsActive` is `status is OrderStatus.Pending or OrderStatus.Mockup or OrderStatus.InProduction or OrderStatus.Ready or OrderStatus.Delivered` [VERIFIED: src/Csps.Domain/Orders/OrderStatusRules.cs:51-52]. Wire keys are `"pending"`, `"mockup"`, `"production"`, `"ready"`, `"delivered"`, `"completed"`, `"cancelled"` [VERIFIED: src/Csps.Application/Orders/OrderStatusNames.cs:10-16].
- **Overdue rule:** today only the client has it (`OPEN_STATUSES ... new Set(['pending', 'mockup', 'production', 'ready'])` [VERIFIED: web/src/utils/dueFlag.ts:15]). Add `OrderStatusRules.CanBeOverdue` in the Domain so the server count and the client flag agree.
- **Collected this month:** `Σ payments dated in the month − Σ refunds dated in the month`, the same expression the chart uses for the current month (D-04). Comparison: `[1st of last month, clamped same day]` (D-05). Percent: whole number, `MidpointRounding.AwayFromZero` (as the expense share uses [VERIFIED: src/Csps.Application/Expenses/GetCompanyExpenseKpisHandler.cs:29]), `null` when the comparison is 0.00 (D-06). See Open Question 3 for a negative comparison.
- **Company expenses:** reuse `ICompanyExpenseReader.GetKpisAsync(new KpiMonths(...))`; its top-category query orders `byCategory.Sum(expense => expense.Amount) descending, byCategory.Key.Name` [VERIFIED: src/Csps.Infrastructure/Expenses/CompanyExpenseReader.cs:95], which is D-07 exactly.
- **Recent orders:** `OrderByDescending(CreatedAtUtc).ThenByDescending(Id).Take(6)` with the existing list row projection. Note the Orders list's "newest" sort is `OrderByDescending(order => order.OrderDate).ThenByDescending(order => order.CreatedAtUtc)` [VERIFIED: src/Csps.Infrastructure/Orders/OrderReader.cs:127], which is not "newest created" (D-38). Refactor the projection into a shared helper rather than calling `ListAsync`.
- **First name:** the session holds only the full name (UI-SPEC), and `StaffState.Name` is first and last joined. Read `FirstName` from the user row in the reader.

### Pattern 6: Pure date rules on BusinessClock

`BusinessClock` already has `Today`, `LocalNow`, `MonthOf(day)`, `UtcRange`, `MonthUtcRange` [VERIFIED: src/Csps.Domain/Time/BusinessClock.cs:15-54]. Add, with unit tests at 100%:

```csharp
// Monday to Sunday of the week that holds `day` (D-01).
public static (DateOnly Monday, DateOnly Sunday) WeekOf(DateOnly day)
{
    var monday = day.AddDays(-(((int)day.DayOfWeek + 6) % 7));
    return (monday, monday.AddDays(6));
}

// The last day of the comparison period (D-05): the same day number last month, clamped to that month's last day.
public static DateOnly SameDayLastMonth(DateOnly today)
{
    var (first, last) = MonthOf(new DateOnly(today.Year, today.Month, 1).AddDays(-1));
    return new DateOnly(first.Year, first.Month, Math.Min(today.Day, last.Day));
}

// Before 12:00 morning, before 18:00 afternoon, else evening (UI-SPEC D1), from LocalNow.
```

Test days: Mar 31 (Feb 28 and Feb 29 in a leap year), May 31 (Apr 30), Jan 31 (Dec 31), a Monday, a Sunday, 11:59 and 12:00, 17:59 and 18:00 in the business zone. `FixedBusinessCalendar` pins an instant in a UTC+8 zone for reader tests [VERIFIED: tests/Csps.Testing/FixedBusinessCalendar.cs:8-14].

### Pattern 7: Chart months

`GET /api/v1/dashboard/chart?months=6|12` (or `range=6m|12m`, matching the URL). Four grouped reads over `[first day of month N−1 back, last day of this month]`, grouped by `date.Year, date.Month` (EF translates `dateOnly.Year` to `DATEPART(year, @dateOnly)` and `dateOnly.Month` to `DATEPART(month, @dateOnly)` [CITED: learn.microsoft.com/en-us/ef/core/providers/sql-server/functions]): payments, refunds, company expenses, order expenses. Merge in code, fill missing months with zeros, oldest first, and send `income`, `expenses` and `profit` per month. The client draws only (Core Value). Validate `months` against the allow-list on the server (400 otherwise, CWE-20).

Expenses can be dated up to 30 days ahead (`public const int DaysAhead = 30;` [VERIFIED: src/Csps.Domain/Expenses/ExpenseRules.cs:25]), so the current month's expense bar includes later days this month, and an expense dated next month shows in no bar yet. Payments and refunds can't be future-dated.

### Pattern 8: API surface and the authorization matrix (MONEY-03, MONEY-08)

One controller per resource, thin actions, explicit policies. Policy names are `Staff = "Staff"` and `Manager = "Manager"` [VERIFIED: src/Csps.Application/Security/Policies.cs:10-13]. Suggested routes (the planner fixes names):

| Method and route | Policy | Anonymous | Admin | Manager (random id in the matrix) |
|---|---|---|---|---|
| GET `/api/v1/dashboard/summary` | Staff | 401 | 200 | 200 |
| GET `/api/v1/dashboard/chart` | Staff | 401 | 200 | 200 |
| GET `/api/v1/staff-money/me` | Staff | 401 | 200 | 200 |
| GET `/api/v1/staff-money/me/ledger` | Staff | 401 | 200 | 200 |
| GET `/api/v1/staff-money` (all balances + total) | Manager | 401 | 403 | 200 |
| GET `/api/v1/staff-money/{userId:guid}` | Staff, handler role check | 401 | 403 | 404 |
| GET `/api/v1/staff-money/{userId:guid}/ledger` | Staff, handler role check | 401 | 403 | 404 |
| GET `/api/v1/money-transfers` | Staff (Admin: own only) | 401 | 200 | 200 |
| GET `/api/v1/money-transfers/recipients` | Staff | 401 | 200 | 200 |
| POST `/api/v1/money-transfers` | Staff | 401 | 400 | 400 |
| POST `/api/v1/money-transfers/handovers` | Manager | 401 | 403 | 400 |
| DELETE `/api/v1/money-transfers/{id:guid}?version=` | Manager | 401 | 403 | 404 |
| DELETE `/api/v1/money-transfers/{id:guid}/permanent` | Manager | 401 | 403 | 404 |

- `me` is a static segment and the `{userId:guid}` constraint never matches it, so there is no route clash.
- For `{userId}` routes, the handler reads the caller's role with `IStaffDirectory.GetStaffStateAsync` (as `UpdateCompanyExpenseHandler` does: `var callerIsManager = caller?.IsManager == true;` [VERIFIED: src/Csps.Application/Expenses/UpdateCompanyExpenseHandler.cs:72]) and answers 403 for an Admin whose id differs **before** any existence check, so a 403 reveals nothing (CWE-204).
- An Admin who sends `deleted=true` gets 403 (D-31). Recommended over silently ignoring it, because a test can assert it.
- The create response returns the sender's new balance only. Never return the recipient's balance to an Admin (OD-19).
- Matrix rows follow the existing `MatrixRow(Method, RoutePattern, SamplePath, Anonymous, Admin, Manager)` record [VERIFIED: tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs:26], for example `new("DELETE", "/api/v1/company-expenses/{id:guid}", "/api/v1/company-expenses/b4d7e1a9-...", Anonymous: 401, Admin: 403, Manager: 404)` [VERIFIED: AuthorizationMatrix.cs:208]. The DELETE sample path should carry a well-formed `version` so a Manager reaches the 404.
- Controllers keep `[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]` like `CompanyExpensesController` [VERIFIED: src/Csps.Server/Controllers/CompanyExpensesController.cs:26] (D-13).

### Pattern 9: Soft delete with a version, and permanent remove

- **Version on a DELETE is new in this repo.** Every existing DELETE "takes no version" (orders, payments, company expenses). D-23 requires one. Send it as a `version` query parameter: the client's `delete(url, options)` accepts `params` [VERIFIED: web/src/core/api/http/httpClient.ts:589 and the shared `serializeParams`], and the text is base64 of exactly 8 bytes (`RowVersions.TryParse`) [VERIFIED: src/Csps.Application/Common/RowVersions.cs:28-44]. A missing or malformed version is a 400; a mismatch is `EditErrors.Stale` (`"edit.stale"`, "This was changed by someone else. Reload and try again.") [VERIFIED: src/Csps.Application/Common/EditErrors.cs:9-15]. Compare as `UpdateCompanyExpenseHandler` does: `if (!expense.RowVersion.AsSpan().SequenceEqual(version))` [VERIFIED: UpdateCompanyExpenseHandler.cs:116].
- Already deleted or unknown: 404 (UI shows "Already deleted").
- **Permanent remove:** only a soft-deleted transfer; a live one answers 422 (business rule, for example "Delete the transfer first."). No version: it acts on the latest state, like `PermanentlyDeleteCompanyExpenseHandler`, which records the audit entry first and then removes the tracked row in the same save [VERIFIED: src/Csps.Application/Expenses/PermanentlyDeleteCompanyExpenseHandler.cs:45-58].
- **Audit detail format:** use `AuditDetailFormat` pairs (`key=value;...`, ids as dashed lower-case GUIDs, amounts `0.00`, dates `yyyy-MM-dd`) [VERIFIED: src/Csps.Application/Common/AuditDetailFormat.cs:12-25]. The detail column holds at most 400 characters (`public const int DetailMaxLength = 400;` [VERIFIED: src/Csps.Domain/Auditing/AuditEntry.cs:37]). Four ids, the amount, two dates and a timestamp fit in about 280 characters. A 200-character note does not fit once encoded, and the project rule is that free text never reaches the audit log (Open Question 1).
- **Audit reader:** `AuditChangeLines` reads only known keys (`PayerField = "payer"`, `ReceiverField = "receiver"`, ...) and turns person ids into names [VERIFIED: src/Csps.Application/Audit/AuditChangeLines.cs:151-152]. New keys (`from`, `to`, `recordedBy`, `deletedBy`) must be added there, or the audit screen shows no names. The web `auditCopy.ts` needs the three new labels (UI-SPEC § Audit log).
- Existing action-code style: `"company-expense.deleted"`, `"company-expense.permanently-deleted"` [VERIFIED: src/Csps.Domain/Auditing/AuditActions.cs:130-136]. Suggested: `money-transfer.deleted`, `money-transfer.permanently-deleted`, `money-transfer.handed-over` (at most 64 characters).

### Pattern 10: Client queries, URL state and freshness

- Query keys: new roots `['dashboard']` and `['staff-money']` / `['money-transfers']`. Per UI-SPEC: `staleTime: 0`, `refetchOnMount: 'always'` on these queries only (the shared default is `staleTime: 30_000` [VERIFIED: web/src/lib/query/queryClient.ts:7]).
- **D-13 invalidation:** add the dashboard and money roots to `useRefreshOrders` (its `REFRESHED_KEYS` list, which every order write reaches through `useApplyOrder`) and to `useRefreshExpenses` [VERIFIED: web/src/modules/admin/hooks/useRefreshOrders.ts, useRefreshExpenses.ts, useApplyOrder.ts]. Also refresh money after user deactivate or delete (All Staff badges) and after any transfer action. A test asserts the keys are invalidated (UI-SPEC backstop row).
- URL hooks through the shared factory, as `useDeletedExpensesListParams = createListParams({ page: pageParser, size: pageSizeParser, ... })` [VERIFIED: web/src/modules/admin/hooks/useDeletedExpensesListParams.ts]. `range` and `tab` use `literalParser`, `deleted` a boolean literal, `:userId` the shared `guidParser`.
- M2 loader: `requireManagerLoader(args, '/admin/money')` (the guard takes a fallback path, as `requireManagerOrExpenses` does [VERIFIED: web/src/modules/admin/routes.tsx:142-144]); the Manager's own id redirects to `/admin/money` with `redirect()` (never `<Navigate>`, WEB-10 nuqs #1245).
- Transfer form: `useSubmission` and `newIdempotencyKey` in `lib/forms` (one key per submission, a new key for a corrected body, SEC-06).

### Pattern 11: Chart changes behind new props

The chart today draws a 640-wide view box, `y = T + (H − T − B) × (1 − v / top)` with `top` from the largest positive value, and `bar()` returns no path for a height of zero or less [VERIFIED: web/src/components/data/IncomeExpenseChart.tsx:47-80]. It computes "Net" in the browser (`Net {formatPeso(cur.income - cur.expenses)}`) [VERIFIED: IncomeExpenseChart.tsx:161]. Phase 10 adds `profit` to `ChartDatum` (server figure), `showProfit` and `labels` props, a below-zero scale, a profit line clipped at zero with two `clipPath`s (ids from `useId()`), and `ResizeObserver` width measuring with a 640 fallback. With no new prop it must draw exactly as now, so the P2 parity scenarios pass unchanged. The tooltip already positions through `--tip-x` with a React `style` object (CSSOM, allowed under the strict CSP); keep that form for `--bar-w`.

### Anti-Patterns to Avoid
- **Client math on money:** the browser never adds payments, computes profit or a running balance. The only client arithmetic is the labelled T2 warning from fresh server balances (UI-SPEC).
- **Reading the device clock** for "today", the week or the month: use the summary's `today` (WEB-10 dates rule; UI-SPEC backstop).
- **Ignoring query filters on a union:** `IgnoreQueryFilters` applies to the whole query (Pitfall 4).
- **Calling the Orders list handler for recent orders:** it filters to "Active + recent" by default and sorts by order date.
- **A balance column or cache:** violates MONEY-01 and D-13.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-request mutual exclusion | App-level `SemaphoreSlim`, static locks, `sp_getapplock` (inline SQL) | `DatabaseLocks.TakeAsync` on a new standing row | Works across processes, waits inside SQL Server so deadlock detection works, no inline SQL, already tested (`DatabaseLocksTests`, `DeadlockInsideAnOuterTransactionTests`) |
| Duplicate-submit protection | A client-only disabled button | The existing `IdempotencyGate` (`Idempotency-Key`) plus WEB-09 pending state | Replays return the stored answer; mismatched bodies get 422 |
| Who/when stamping | Setting `CreatedById` in handlers | `RecordStampInterceptor` via `IAttributedRecord` | SEC-08: one place, from the token and the clock |
| Optimistic concurrency text | New 409 wording | `EditErrors.Stale` | Same message app-wide |
| Concurrency test harness | Ad-hoc `Task.WhenAll` | `ConcurrentRequests.SendTogetherAsync` | Releases both requests from one gate at the same moment [VERIFIED: tests/Csps.Testing/ConcurrentRequests.cs] |
| Company expense KPIs | A new month/top-category query | `ICompanyExpenseReader.GetKpisAsync` | Already matches D-07 and is tested |
| Peso text in messages | String formatting per handler | `Pesos.Format` (positive figures) | One format |
| URL state | `useState` copies or raw `location.search` | `createListParams` and the shared parsers | WEB-10 rules and tests |
| Charts | A chart package | Extend `IncomeExpenseChart` | Forbidden packages; parity tests |

**Key insight:** every hard problem in this phase (locking, idempotency, stamping, audit, URL state, card states) already has a tested in-repo answer. The new code is the transfer aggregate, the ledger query and the date rules.

## Common Pitfalls

### Pitfall 1: The dev-only `/admin` preview shadows the real dashboard
**What goes wrong:** in development and in the e2e build, `devRoutes` come first, and its `/admin` index renders `AdminPreviewPage` with a placeholder user. The router comment says "It comes first, so where both define a path the preview wins (Pitfall 11)" [VERIFIED: web/src/core/routes/router.tsx:9-13]; e2e and budget builds have `devRoutes: true` [VERIFIED: web/vite.config.ts:39-40]. The real dashboard would never show in e2e.
**How to avoid:** remove the dev `/admin` index preview, as Phase 8 did for Orders ("/admin/orders is the real signed-in Orders page since plan 08-06, so it has no dev preview" [VERIFIED: web/e2e/admin.spec.ts:13]). Update the e2e specs that open `/admin` unsigned and expect the preview h1 "Dashboard": `admin.spec.ts` (lines 20-60, 125), `admin-keyboard.spec.ts` (40, 149), `motion.spec.ts` (176, 320). They should sign in (`signInAs`) or open another shell page. Also update `routes.test.tsx` ("opening /admin with a session goes to Orders (D-61) until the dashboard exists").
**Warning signs:** an e2e dashboard test sees "Development only. This screen is built in a later phase."

### Pitfall 2: Two concurrent transfers both pass the balance check
**What goes wrong:** read balance, check, insert, with no lock: both requests read the same balance.
**How to avoid:** take the `staff-money` lock as the first statement inside the transaction, then read states and balances. Integration test with `ConcurrentRequests.SendTogetherAsync`: two transfers of 60% each, exactly one 201 and one 400 with the balance message, final balances exact. Repeat for two hand-overs from one leaver, and for two D-49 transfers into one leaver.
**Warning signs:** the test passes only sometimes; that means the lock is taken after a read.

### Pitfall 3: EF set operations fail on mismatched column facets
**What goes wrong:** a `Concat` of projections where one side's string is `nvarchar(200)` and the other `nvarchar(500)` throws "Unable to translate set operation when matching columns on both sides have different store types" [CITED: github.com/dotnet/efcore/issues/19129, MEDIUM].
**How to avoid:** project only same-typed, non-string columns in the union (Pattern 3); fetch text per kind afterwards. Cast nullable constants explicitly (`(DateTimeOffset?)null`). Prove the query in Wave 0 against LocalDB before building screens on it.
**Warning signs:** `InvalidOperationException` at query compile time, only against a real database (not in unit tests).

### Pitfall 4: `IgnoreQueryFilters` lifts the deleted-order filter too
**What goes wrong:** if the transfer entity gets a filter named `SoftDelete` and the Manager ledger calls `IgnoreQueryFilters(["SoftDelete"])` to show deleted transfers, the same call lifts the payments' filter on deleted orders in the same union. The repo already warns: "No IgnoreQueryFilters here: EF applies it to the whole query, so it would lift the outer SoftDelete filter too." [VERIFIED: src/Csps.Infrastructure/Orders/OrderReader.cs:117]
**How to avoid:** no `SoftDelete` filter on transfers; filter `DeletedAtUtc == null` explicitly in one helper.
**Warning signs:** a deleted order's payment appears in a Manager's ledger with Show deleted on.

### Pitfall 5: A 403 that leaks existence
**What goes wrong:** the handler looks the person up first and answers 404 to an Admin for an unknown id.
**How to avoid:** role check first (Admin and not self: 403), then existence (Manager: 404). Test with a random id and a real id for an Admin; both 403.

### Pitfall 6: Leaking a coworker's figures to an Admin
**What goes wrong:** the create response, the recipients list or a refusal message carries the recipient's or a leaver's balance.
**How to avoid:** the response holds the sender's new balance only; recipients carry no figures for anyone (D-49); the Admin's D-49 refusal has no amount. An integration test scans every Admin response body for the other person's balance (UI-SPEC backstop "Admin never receives another person's figures").

### Pitfall 7: Free text or names in the audit log
**What goes wrong:** D-25 lists "note", but `IAuditTrail` says "Never pass personal data or secrets: no e-mail addresses, names, phone numbers ..." and "People are referenced only by user id" [VERIFIED: src/Csps.Application/Ports/IAuditTrail.cs:9-12], and the expense audit precedent keeps descriptions and notes out ("no text of theirs ever reaches the audit log (D-06)" [VERIFIED: src/Csps.Application/Expenses/ExpenseAuditDetail.cs:7-8]). The 400-character cap also cannot hold an encoded 200-character note with four ids.
**How to avoid:** ask the owner (Open Question 1). Until ruled, write `note=yes|no` (presence only).

### Pitfall 8: Base64 `+` and `/` in the version query parameter
**What goes wrong:** a raw `+` in a query string decodes as a space; the version then fails to parse and the user sees a 400.
**How to avoid:** send it through the client's `params` (it URL-encodes); add a server test with a version containing `+` and `/`.

### Pitfall 9: The legacy holder and other non-staff rows in "All staff"
**What goes wrong:** the seeded `LegacyHolder` account (D-37 of an earlier phase) is excluded by id everywhere (`.Where(user => user.Id != LegacyHolder.Id)` [VERIFIED: src/Csps.Infrastructure/Identity/StaffDirectory.cs:18]). Forgetting it here would list it, and in Phase 15 it may hold migrated money (OD-15).
**How to avoid:** exclude `LegacyHolder.Id` in the all-balances query and in the recipients list; note it for Phase 15.

### Pitfall 10: jsdom has no `ResizeObserver`
**What goes wrong:** the true-pixel chart (D-51) throws in component tests; nothing in `web/src` uses `ResizeObserver` today (grep found none).
**How to avoid:** guard `typeof ResizeObserver === 'undefined'` and keep the 640 fallback (UI-SPEC: "Until the frame is measured (first paint, tests), the chart uses 640"); stub it in the specific tests that check narrow widths.

### Pitfall 11: Shared e2e database makes shop-wide figures unpredictable
**What goes wrong:** `CSPS_E2E` is shared by every spec, so the KPI totals and status counts change with other tests.
**How to avoid:** e2e asserts structure and per-person money for fresh staff created by the spec (balances depend only on that person); exact figures are proved in integration tests with their own `CSPS_Test_<guid>` database.

### Pitfall 12: Week and month boundaries in Manila time
**What goes wrong:** using UTC dates for "this week" or `StatusChangedAtUtc` without the business range shifts counts by a day for eight hours of every day.
**How to avoid:** date columns (`DueDate`, `PaymentDate`, ...) compare against `clock.Today`-derived `DateOnly` values; the instant column `StatusChangedAtUtc` compares against `clock.MonthUtcRange(today)`.

### Pitfall 13: Migration snapshot conflicts with Phase 9
**What goes wrong:** this branch was cut from the unmerged Phase 9 tip (CONTEXT). If Phase 9 adds another migration before it merges, the `CspsDbContextModelSnapshot.cs` conflicts.
**How to avoid:** add the Phase 10 migration in one plan, late enough that Phase 9's remaining plans (09-30 to 09-32, backup work with no schema change expected) are settled; if a conflict appears, regenerate the migration rather than hand-merging the snapshot. The latest migration now is `20261104051745_AddImageDeletions` (directory listing).

## Code Examples

### Lock port and adapter (no inline SQL)
```csharp
// Application/Ports/IStaffMoneyLock.cs
public interface IStaffMoneyLock
{
    /// <summary>Takes the staff-money lock for the current transaction; call it first. Waits at most 10 seconds.</summary>
    /// <exception cref="StaffMoneyBusyException">The lock was not had in time.</exception>
    Task LockAsync(CancellationToken cancellationToken);
}

// Infrastructure/Money/StaffMoneyLock.cs (same shape as ManagerRosterLock and OrderNumberAllocator.TakeLockAsync)
internal sealed class StaffMoneyLock(CspsDbContext context, TimeProvider time) : IStaffMoneyLock
{
    public async Task LockAsync(CancellationToken cancellationToken)
    {
        try
        {
            await DatabaseLocks.TakeAsync(context, DatabaseLocks.StaffMoney, time.GetUtcNow(), DatabaseLocks.DefaultWait,
                MoneyErrors.BusyMessage, cancellationToken).ConfigureAwait(false);
        }
        catch (InvalidOperationException error) when (error.Message == MoneyErrors.BusyMessage)
        {
            throw new StaffMoneyBusyException();
        }
    }
}
```

### Running balance (pure)
```csharp
// Application/Money/LedgerRunningBalance.cs. Rows are newest first; Signed is 0 for a deleted transfer.
public static IReadOnlyList<decimal?> Apply(IReadOnlyList<LedgerRow> rows, decimal balanceAfterFirst)
{
    var result = new decimal?[rows.Count];
    var running = balanceAfterFirst;
    for (var i = 0; i < rows.Count; i++)
    {
        result[i] = rows[i].Deleted ? null : running;
        running -= rows[i].Signed;
    }
    return result;
}
```

### Concurrency test (shape)
```csharp
// Server.IntegrationTests: two transfers of 60% each from the same sender, released together.
var (first, second) = await ConcurrentRequests.SendTogetherAsync(
    () => client.PostTransferAsync(sender, recipientA, amount: 600m, key: Guid.NewGuid()),
    () => client.PostTransferAsync(sender, recipientB, amount: 600m, key: Guid.NewGuid()));
new[] { first.StatusCode, second.StatusCode }.Order().ShouldBe([HttpStatusCode.Created, HttpStatusCode.BadRequest]);
(await BalanceOf(sender)).ShouldBe(400m);   // started at 1,000.00
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `/admin` redirects to Orders (D-61) | `/admin` is the dashboard | This phase | Update routes, tests and e2e (Pitfall 1) |
| Chart income = payments; "Net" computed in the browser | Income = payments minus refunds; profit from the server | D-09, D-36 | New props; defaults keep today's look |
| Every DELETE takes no version | Transfer delete takes `version` | D-23 | New query-parameter pattern (Pattern 9) |
| Unnamed global filters | Named filters (`HasQueryFilter("SoftDelete", ...)`) in EF Core 10 | EF Core 10, already used here | `IgnoreQueryFilters([name])` is still query-wide (Pitfall 4) |

**Deprecated/outdated:** UI-SPEC App. E.6 "Active (Pending → Ready)" and its Cancelled row are superseded (07 D-01, D-08, OR-4).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | EF Core 10 translates a `Concat` of six same-typed projections with int constants to `UNION ALL` on SQL Server | Pattern 3 | Ledger query must move to the per-source merge or a migration view; Wave 0 test catches it early |
| A2 | EF Core 10 translates `ordered.Take(n).Sum(...)` over that `Concat` as a subquery | Pattern 3 | Use the in-memory fallback for the newer-rows sum |
| A3 | `Sum` over an empty set returns 0.00 for a non-nullable `decimal` (COALESCE) | Pattern 2 | A person with no rows would throw or read null; reader test covers it |
| A4 | Writers that never refuse on a balance need not take the lock (serial-equivalence reading of MONEY-05) | Pattern 4 | If the owner wants the literal reading, about ten handlers add one `LockAsync` call (Open Question 2) |
| A5 | "Due this week" counts a Delivered order whose due date fell earlier this week (it is active and can't be overdue) | Pattern 5 | Count differs by a few orders; Open Question 4 |
| A6 | The comparison percent uses the absolute value of a negative comparison amount | Pattern 5 | Odd percent in a refund-heavy month; Open Question 3 |
| A7 | No upper cap on a transfer amount beyond the balance check | Pattern 4 | A huge typed figure is refused by the balance rule anyway; decimal(18,2) overflow cannot be reached |
| A8 | Manager-locked or not-yet-set-up active staff are neither recipients nor leavers (they show as Active in All Staff, with no Hand Over) | Pattern 4 | A locked person holding money has no hand-over path; Open Question 5 |
| A9 | The legacy holder stays out of All Staff and recipients until Phase 15 | Pitfall 9 | Phase 15 may need to show it |

## Open Questions

1. **Does the permanent-remove audit entry carry the note text?** (owner)
   - What we know: D-25 lists "note". The project rule (IAuditTrail, expense D-06) keeps free text and names out of the audit log, and the 400-character cap cannot hold an encoded 200-character note plus four ids.
   - Options (recommended first): **A:** record only whether there was a note (`note=yes`), with ids, amount, dates and who; reason: same privacy rule as expenses, always fits. **B:** record the note text and raise the audit detail limit; reason: the full record survives, but it breaks the no-free-text rule and changes the audit schema.
   - Recommendation: A, recorded as a dated ruling before the delete plan runs.

2. **Must expense, payment and refund saves also take the staff-money lock?** (owner, low stakes)
   - What we know: MONEY-05 says "the lock covers every ledger source". With D-15, D-16 and D-33, those writers never refuse on a balance, so any interleaving is a legal serial order.
   - Options: **A (recommended):** only transfer create and hand-over take the lock, and a race test proves the outcome; reason: no extra waiting on every order save. **B:** every ledger writer takes it; reason: literal reading, small cost.

3. **The "Collected" percent when last month's comparison amount is negative** (refunds above payments). Recommend computing against the absolute value; or hide the percent as for ₱0.00. Owner call; rare case.

4. **A Delivered order due earlier this week:** count it in "due this week" (literal D-01, it is active and never overdue) or not (only due today to Sunday)? Recommend the literal reading.

5. **Manager-locked or never-set-up staff who hold money:** they can't receive (payer rule) and are not leavers, so they have no hand-over. Recommend: treat them as active (no hand-over) for now and revisit if it happens.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | build, tests | ✓ | 10.0.402 (global.json 10.0.401, latestPatch) | none |
| Node | web | ✓ | 24.21.0 | none |
| npm | web | ✓ | 11.19.0 | none |
| SQL LocalDB | integration tests (`CSPS_TEST_SQL=localdb`) | ✓ | `sqllocaldb` on PATH | CI uses the SQL 2025 container |
| gitleaks | pre-commit secret scan | ✓ | 8.30.1 | none |
| Preflight script | before dev servers, e2e, full runs | not probed (read-only research) | `C:\Work\dev-tools\preflight.ps1` | Wait if TheBETSLLC is busy |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | .NET: xunit.v3 4.0.1 on Microsoft.Testing.Platform, Shouldly, NSubstitute, Respawn. Web: Vitest, RTL, MSW, Playwright |
| Config file | `global.json` (`"runner": "Microsoft.Testing.Platform"`), `web/vitest.config.ts`, `web/playwright.config.ts` |
| Quick run command | `dotnet test --project tests/<Project> --filter-class "*<Class>"` · `npm --prefix web run test -- --run <path>` |
| Full suite command | preflight (`powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`), then `dotnet test --solution Csps.slnx` (`CSPS_TEST_SQL=localdb` set in that process only), `tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Week, same-day clamp, greeting part in the business zone | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*BusinessClockTests"` | ✅ (extend) |
| DASH-01 | Summary returns today, greeting, first name | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DashboardSummaryEndpointTests"` | ❌ Wave 0 |
| DASH-01 | Greeting h1, "Dashboard" while loading, subline from server today | component | `npm --prefix web run test -- --run src/modules/admin/pages/DashboardPage.test.tsx` | ❌ Wave 0 |
| DASH-01 | Sign-in lands on `/admin` dashboard; dev preview gone | e2e + routes | `npm --prefix web run test -- --run src/modules/admin/routes.test.tsx` · `npm --prefix web run e2e -- dashboard.spec.ts` | ✅ (update) / ❌ Wave 0 |
| DASH-02 | Active, due this week, overdue, receivables, collected and comparison, expenses (Mar 31, Monday, Sunday fixtures; cancelled money counts; deleted orders do not) | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*DashboardReaderTests"` | ❌ Wave 0 |
| DASH-02 | Percent rounding and null at ₱0.00; overdue status rule | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*GetDashboardSummaryHandlerTests"` · `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderStatusRulesTests"` | ❌ / ✅ (extend) |
| DASH-02 | KPI feet copy, zero cases, delta hidden | component | `npm --prefix web run test -- --run src/modules/admin/pages/DashboardPage.test.tsx` | ❌ Wave 0 |
| DASH-03 | 6 and 12 months, oldest first, empty months zero, income = payments minus refunds, profit; `months` allow-list 400; current month equals Collected | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DashboardChartEndpointTests"` | ❌ Wave 0 |
| DASH-03 | Profit line, negatives, below-zero ticks, month names, every-other label, unchanged without props | component + parity | `npm --prefix web run test -- --run src/components/data/IncomeExpenseChart.test.tsx` · `npm --prefix web run parity` | ✅ (extend) |
| DASH-03 | `range` in URL with replace | component | `npm --prefix web run test -- --run src/modules/admin/hooks/useDashboardRange.test.tsx` | ❌ Wave 0 |
| DASH-04 | Six status rows, Cancelled hidden, active total, bar width variable | component | `npm --prefix web run test -- --run src/modules/admin/components/OrdersByStatusCard.test.tsx` | ❌ Wave 0 |
| DASH-05 | 6 newest created, any status, links | integration + component | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*DashboardReaderTests"` · `npm --prefix web run test -- --run src/modules/admin/components/RecentOrdersCard.test.tsx` | ❌ Wave 0 |
| DASH-06 | Loading, empty, error with retry per card; axe clean | component | `npm --prefix web run test -- --run src/modules/admin/pages/DashboardPage.test.tsx` | ❌ Wave 0 |
| MONEY-01 | Exact balance from all six sources; payer change moves money; deleted order, expense and transfer excluded; empty person 0.00 | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*StaffMoneyReaderTests"` · `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*StaffMoneyBalanceTests"` | ❌ Wave 0 |
| MONEY-01 | Balance arithmetic | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*MoneyOnHandTests"` | ❌ Wave 0 |
| MONEY-02 | Ledger kinds, order, paging, running balance across pages, deleted rows null | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*LedgerRunningBalanceTests"` · `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*StaffLedgerQueryTests"` | ❌ Wave 0 (spike first) |
| MONEY-02 | Ledger table, page and Show deleted in URL, Back restores | component + e2e | `npm --prefix web run test -- --run src/modules/admin/components/LedgerTable.test.tsx src/modules/admin/pages/MoneyPage.test.tsx` · `npm --prefix web run e2e -- money.spec.ts` | ❌ Wave 0 |
| MONEY-03 | Admin 403 for any other id (real or random), own list only, no deleted rows, `deleted=true` 403; Manager sees all and leavers | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*StaffMoneyAccessTests"` | ❌ Wave 0 |
| MONEY-03 | M2 loader redirect for Admin; tabs hidden; no figures for others in Admin DOM | component | `npm --prefix web run test -- --run src/modules/admin/pages/StaffMoneyPage.test.tsx src/modules/admin/routes.test.tsx` | ❌ / ✅ (extend) |
| MONEY-04 | Field rules and messages; sender from token (forged body ignored); recipient rules; date not future; SEC-08 forged stamps | unit + integration | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*MoneyTransferTests"` · `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MoneyTransferEndpointTests"` · `--filter-class "*MoneyTransferAttributionTests"` | ❌ Wave 0 |
| MONEY-04 | Duplicate POST records one; replay returns stored 201 | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*IdempotencyTests"` | ✅ (discovery covers new POSTs) |
| MONEY-04 | zod mirrors validator; modal both modes; pending state | component | `npm --prefix web run test -- --run src/modules/admin/moneySchemas.test.ts src/modules/admin/components/TransferModal.test.tsx` | ❌ Wave 0 |
| MONEY-05 | Two concurrent transfers: one wins, balances exact; two hand-overs; two D-49 transfers; transfer racing an expense equals serial outcome | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MoneyTransferConcurrencyTests"` | ❌ Wave 0 |
| MONEY-05 | 67 standing lock rows | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*DatabaseLocksMigrationTests"` | ✅ (update 66 to 67) |
| MONEY-06 | Manager soft delete with version, 409 stale, 404 repeat, audit detail; permanent remove only of deleted, audit before remove | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MoneyTransferDeletionTests"` | ❌ Wave 0 |
| MONEY-06 | Audit lines show names for new keys; web labels | unit + component | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*AuditChangeLinesTests"` · `npm --prefix web run test -- --run src/modules/admin/auditCopy.test.ts` | ✅ (extend) |
| MONEY-07 | No PUT or PATCH on transfers | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationCoverageTests"` plus a route-absence assertion in `*MoneyTransferEndpointTests` | ✅ / ❌ |
| MONEY-08 | Every new endpoint × anonymous, Admin, Manager | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationMatrixTests"` | ✅ (add rows) |
| Schema | Table, CHECKs, indexes, no trigger, no JSON | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*MoneyTransfersMigrationTests"` · `--filter-class "*TriggerInventoryTests"` | ❌ / ✅ |
| Rules | No inline SQL; layers | arch | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*NoInlineSqlTests"` · `--filter-class "*LayerTests"` | ✅ |
| D-13 | Mutations invalidate dashboard and money keys | component | `npm --prefix web run test -- --run src/modules/admin/hooks/useRefreshOrders.test.tsx src/modules/admin/hooks/useRefreshExpenses.test.tsx` | ❌ Wave 0 |
| OR-4 | No long dash in new copy | node | `npm --prefix web run test -- --run src/test/no-long-dash.node.test.ts` | ✅ |

### Sampling Rate
- **Per task commit:** the quick command for the touched test class or file.
- **Per wave merge:** the .NET project suites touched by the wave plus `npm --prefix web run test -- --run` for touched folders.
- **Phase gate:** full suite green (after preflight) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs`: the `Concat` ledger spike against LocalDB (A1, A2). Do this first; it decides Pattern 3 or a fallback.
- [ ] `tests/Csps.Infrastructure.IntegrationTests/Money/StaffMoneyReaderTests.cs`
- [ ] `tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs`
- [ ] `tests/Csps.Infrastructure.IntegrationTests/Persistence/MoneyTransfersMigrationTests.cs`
- [ ] `tests/Csps.Domain.UnitTests/Money/MoneyTransferTests.cs`, `MoneyOnHandTests.cs`
- [ ] `tests/Csps.Application.UnitTests/Money/*HandlerTests.cs`, `LedgerRunningBalanceTests.cs`; `Dashboard/*HandlerTests.cs`
- [ ] `tests/Csps.Server.IntegrationTests/Money/` (endpoint, access, concurrency, deletion, attribution) and `Dashboard/` (summary, chart)
- [ ] A test client helper for transfers (create with key, delete with version) beside the existing expense fixtures
- [ ] Web: test fixtures for dashboard and money responses (`web/src/test/dashboardFixtures.ts`, `moneyFixtures.ts`), MSW handlers
- [ ] e2e: `web/e2e/dashboard.spec.ts`, `web/e2e/money.spec.ts`; update `admin.spec.ts`, `admin-keyboard.spec.ts`, `motion.spec.ts` (Pitfall 1)

## Security Domain

`security_enforcement` is on (`"security_enforcement": true`, ASVS level 1, block on high) in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Existing JWT bearer |
| V3 Session Management | no (unchanged) | Existing sessions |
| V4 Access Control | yes | Policies `Staff` / `Manager`, handler role check before existence (CWE-639, CWE-862, CWE-863, CWE-204), matrix test |
| V5 Input Validation | yes | FluentValidation in handlers, allow-list query params (`months`, `deleted`, `page`, `pageSize` ≤ 100), zod mirrors (OR-3), nuqs parsers (CWE-20) |
| V6 Cryptography | no | Not touched |
| V7 Error and Logging | yes | Append-only audit for delete, remove, hand-over; ids only; production 500 text unchanged |
| V8 Data Protection | yes | No coworker figures in Admin responses (CWE-200); no-store responses |
| V11 Business Logic | yes | Locked check-then-write (CWE-362, CWE-367), idempotency (SEC-06), rowversion (SEC-07) |
| V13 API | yes | No update endpoint (MONEY-07); sender never from body (CWE-915 mass assignment) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Admin reads another person's ledger by id (IDOR) | Information disclosure | 403 before lookup, matrix rows, random and real id tests |
| Forged `fromUserId` in a normal transfer body | Spoofing / Tampering | Request DTO has no sender field; sender from `IRequestContext.UserId`; hand-over is a separate Manager-only endpoint |
| Double-spend by two concurrent transfers | Tampering | `staff-money` lock row before the read; concurrency tests |
| Double-click or network replay | Tampering | Idempotency gate (same key and body replays the stored answer) |
| Stale delete over a newer state | Tampering | `version` must match; 409 `edit.stale` |
| Admin learns a leaver's debt from the D-49 refusal | Information disclosure | No figure in the Admin message; a probe only yields a bound, and a success moves real money; accept and record in the threat model |
| Audit entry altered or removed | Repudiation | Existing `TR_AuditLog_AppendOnly` and interceptor; remove writes the audit row in the same save before the delete |
| Free text or names in audit | Information disclosure | Ids only; note presence only (Open Question 1) |
| Large `pageSize` or deep page | Denial of service | Server caps at 100 (SEC-03); `page` ≤ 100000 like other lists |
| Open redirect via a URL param | Tampering | Params validated before any `href` or `redirect()` (WEB-10, CWE-601) |

## Sources

### Primary (HIGH confidence)
- Codebase, read this session: `DatabaseLocks.cs`, `DatabaseLock.cs`, `DatabaseLockConfiguration.cs`, `IManagerRosterLock.cs`, `ManagerRosterLock.cs`, `OrderNumberAllocator.cs`, `CspsUnitOfWork.cs`, `IUnitOfWork.cs`, `IdempotencyGate.cs`, `AddOrderPaymentHandler.cs`, `Order.cs`, `OrderStatus.cs`, `OrderStatusRules.cs`, `OrderStatusNames.cs`, `OrderListResponse.cs`, `OrderReader.cs`, entity configurations for orders, payments, refunds, order and company expenses, `CompanyExpenseReader.cs`, `GetCompanyExpenseKpisHandler.cs`, `PermanentlyDeleteCompanyExpenseHandler.cs`, `ExpenseAuditDetail.cs`, `AuditDetailFormat.cs`, `AuditChangeLines.cs`, `IAuditTrail.cs`, `AuditEntry.cs`, `AuditActions.cs`, `IBusinessCalendar.cs`, `BusinessClock.cs`, `StaffDirectory.cs`, `StaffState.cs`, `Policies.cs`, `EditErrors.cs`, `RowVersions.cs`, `ConflictRetry.cs`, `Pesos.cs`, `CompanyExpensesController.cs`, `AuthorizationMatrix.cs`, `ConcurrentRequests.cs`, `FixedBusinessCalendar.cs`, `NoInlineSqlTests.cs`, `DatabaseLocksMigrationTests.cs`; web `routes.tsx`, `router.tsx`, `vite.config.ts`, `IncomeExpenseChart.tsx`, `KpiCard.tsx`, `Sidebar.tsx`, `sections.ts`, `dueFlag.ts`, `queryClient.ts`, `useRefreshOrders.ts`, `useRefreshExpenses.ts`, `useApplyOrder.ts`, `expensesService.ts`, `httpClient.ts`, e2e `admin.spec.ts`, `admin-keyboard.spec.ts`, `motion.spec.ts`, `orders-list.spec.ts`
- Planning: `10-CONTEXT.md`, `10-UI-SPEC.md`, `REQUIREMENTS.md`, `ROADMAP.md` Phase 10, `STATE.md`, `config.json`, `HOSTING-RECORD.md`, `05-SECURITY.md` (RCSI note)

### Secondary (MEDIUM confidence)
- [EF Core SQL Server function mappings](https://learn.microsoft.com/en-us/ef/core/providers/sql-server/functions): `DateOnly.Year/Month` translations, no window functions listed
- [EF Core complex query operators](https://learn.microsoft.com/en-us/ef/core/querying/complex-query-operators): GroupBy and aggregate translation

### Tertiary (LOW confidence, verify in Wave 0)
- [dotnet/efcore#19129](https://github.com/dotnet/efcore/issues/19129): set operations fail when string facets differ
- [dotnet/efcore#16298](https://github.com/dotnet/efcore/issues/16298): set operations across different entity types

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new packages; versions read from `Directory.Packages.props`.
- Architecture: HIGH for locking, idempotency, stamping, audit and routing (all read in the codebase); MEDIUM for the ledger query shape (A1, A2, proved in Wave 0).
- Pitfalls: HIGH. Most come from code comments and tests read this session.

**Research date:** 2026-11-05
**Valid until:** 2026-12-05 (stable stack; re-check if Phase 9 adds a migration before merging)

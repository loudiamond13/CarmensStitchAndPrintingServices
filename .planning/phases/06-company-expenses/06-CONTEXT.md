# Phase 6: Company Expenses - Context

*Created: 2026-10-25T02:28:52-05:00 · Updated: 2026-10-25T02:28:52-05:00*

**Gathered:** 2026-10-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff record, find and total the shop's own costs (rent, bills, salaries, supplies and so on) on `/admin/expenses`. The phase delivers:

- the list with filters, search, paging and a period total
- add, edit, soft delete, restore and permanent delete with 409 conflict protection
- the month KPI cards in Asia/Manila time
- "Recorded by", "Last changed by" and the required "Paid by"
- the staff lookup that Phase 7 reuses
- a Manager-editable category list on a new Manager-only Settings page
- the list performance guards

Requirements: CEXP-01 to CEXP-05 and PERF-04. It is the first business slice, so it sets the pattern Orders (Phase 7) follows.

Out of scope: order expenses (Phase 7), money on hand balances and transfers (Phase 10), CSV export (CEXP-V2-01) and receipt photos.

</domain>

<decisions>
## Implementation Decisions

### Deleting an expense (OD-5, owner 2026-10-25)
- **D-01:** Delete is a **soft delete**. The expense is hidden from every list, total, KPI and balance, but the row stays and the audit log records the delete. — **Reversibility:** one-way. It needs a migration for the deleted marker (UTC timestamp and who deleted it), and every query has to filter on it.
- **D-02:** **Only Managers delete.** Admins can't delete their own expenses either. The delete action isn't shown to Admins, and the API refuses it (403) under a Manager policy. The authorization-matrix test covers it.
- **D-03:** Managers can **restore** a soft-deleted expense from a Manager-only **Deleted** view. A restored expense counts again in lists, totals and its payer's balance, and the restore is audited.
- **D-04:** Managers can also **delete permanently**, from **either** the main list or the Deleted view. A permanent delete removes the row.
- **D-05:** **Both** deletes use the plain ConfirmDialog (Yes/Cancel). There is no type-to-confirm. The two dialogs have different wording, and the permanent one says it can't be undone. Final copy is set in `/gsd-ui-phase 6`.
- **D-06:** After a permanent delete, the audit entry keeps the **date, category, amount and payer** (the payer as a user id reference, shown by name). It doesn't keep the description or notes, which could hold personal details (same idea as 05 D-40).
- **D-07:** The Deleted view and its actions are **Manager-only**. Admins can't see it.

### Expense categories (OD-8 for company expenses, and C-43; owner 2026-10-25)
- **D-08:** Categories are a **Manager-editable list**, stored as a table that expenses reference by foreign key, not as a fixed enum. Managers can add, rename and retire categories. — **Reversibility:** one-way. It needs a table, a foreign key and a migration, and it replaces the typed `ExpenseCategory` union and `EXPENSE_TONE` map in the web code.
- **D-09:** The starting list has 10 categories: Rent, Utilities, Salaries, Supplies, Equipment, Maintenance, **Government contributions** (one category for SSS, PhilHealth and Pag-IBIG), **Taxes and permits** (BIR, mayor's permit, other fees), **Transport and fuel**, and Others. It ships as migration seed data (`HasData`), so an empty production database gets it too. It isn't left to the dev seed.
- **D-10:** A category that has **ever** been used, including by a soft-deleted expense, can only be **retired**, never deleted. A category that was **never used** can be deleted permanently.
- **D-11:** A retired category is **hidden from the Add form's picker** but **stays in the list filter**, marked "retired". An existing expense keeps its retired category when edited.
- **D-12:** A **rename** shows the new name everywhere, past expenses included, because expenses reference the category. The audit log keeps the old and new names.
- **D-13:** Each category has a **badge color** that the Manager picks from a fixed set of design tones already checked for contrast. There is no free color picker. The starting categories keep their current UI-spec tones (§6.2).
- **D-14:** Categories are edited on a new **Manager-only Settings page in the sidebar**. Admins are redirected, as on `/admin/users`. Phase 11 may add more settings to the page later.
- **D-15:** The picker and filter list categories **A to Z, with Others always last**.
- **D-16:** The **order expense** categories (Fabric, Ink & paper, and so on) are **not decided here**. Phase 7 rules whether they work the same way, so OD-8 stays open for order expenses.

### Who paid, fields and limits (OD-21, owner 2026-10-25)
- **D-17:** **Paid by is always a staff member** (an active Admin or Manager), never "the company". OD-21 is closed as "no" for company expenses, and Phase 7 applies the same ruling to order expenses.
- **D-18:** In the Add form, **Paid by starts as the signed-in user**, who can change it to any active coworker.
- **D-19:** An expense gets one more field: an **optional Notes** box of up to **1,000 characters**. Notes show **only in the form**, not as a list column, and **search doesn't look in them**. There is **no Vendor** field. — **Reversibility:** costly. It's a new column and migration, and it touches the DTOs, validators and zod schemas.
- **D-20:** The **date may be up to 30 days ahead** of today in Asia/Manila. Any past date is allowed, for old and migrated expenses. The client (zod) and the server both enforce the limit.
- **D-21:** The **amount must be more than ₱0.00 and at most ₱1,000,000.00**, with a plain-English field error, checked on both client and server.
- **D-22:** A future-dated expense comes off the payer's money on hand **as soon as it's saved**, not on its date. This is recorded for MONEY-01 in Phase 10.
- **D-23:** The list's default range runs from **30 days before to 30 days after today** in Asia/Manila, so expenses recorded early still show. Future-dated rows get an **"Upcoming"** badge. This replaces CEXP-01's plain "last 30 days" default.
- **D-24:** KPIs count expenses by their **date**. An upcoming expense dated later this month counts in "This month", and one dated next month doesn't.

### Who can edit what (owner 2026-10-25)
- **D-25:** **Admins see every expense**: the full list, the totals and the KPIs.
- **D-26:** **An Admin can edit only their own expenses**: ones they **recorded** (SEC-08 `CreatedBy`) **or that name them as Paid by**. The server enforces this, and the Edit action is shown only on rows the user may edit. **Managers can edit any expense.** If an Admin changes the payer away from themselves on an expense someone else recorded, they lose edit access to it afterwards. This is expected.

### Audit (owner 2026-10-25)
- **D-27:** The audit log records **every** expense change: add, edit, soft delete, restore, permanent delete and payer change, plus category add, rename, recolor, retire and delete. An edit lists the changed fields, with **old and new values for amount, date, category and payer**. Description and notes appear only as "changed", with no text (05 D-40). These events join the AUDIT-01 catalog in `docs/operations/audit-log.md`.

### Speed check and build order (owner 2026-10-25)
- **D-28:** **No staging site, so the p95 < 300 ms check runs locally and in CI** with a timing test on a large fake data set (about 5 years of expenses). After release, the **live site's request logs** confirm real load times. No fake data is ever written to the live database. This replaces "on staging" in success criterion 5.
- **D-29:** **Expenses go before Orders**, as research recommends. This phase sets the slice pattern (filters, totals, 409 handling, query-count guards, ConfirmDialog) for Phase 7.

### Carried forward from earlier phases
- Soft-deleted users keep their name, and actors show as "{name} (former staff)" (05 D-07, D-08, D-11). "Recorded by", "Last changed by" and "Paid by" are foreign keys to the user row, with no name snapshot.
- A form save that gets 409 keeps the typed values and shows the banner with **Load latest** (05 D-20). Only form saves carry the row version, and single-click actions act on the latest state (05 D-21).
- Design-vs-WCAG clashes (OD-14) are ruled item by item in `/gsd-ui-phase 6`.
- New or amended copy is built as specified, but the owner reviews it before release (05 D-48).
- No new database triggers (05 D-06, OR-7). Guards live in code or constraints.
- No new UI package, and motion is Tailwind first (05 D-37, D-38).

### Claude's Discretion
- Page size and page-size options, URL parameter names (WEB-10), and the exact index set, as long as every filter and sort column is covered.
- Whether delete, restore and permanent delete send a row version. The default follows 05 D-21 and D-41: single-click actions don't, and the edit form does.
- The size and shape of the fake performance data set, and where the timing test lives.
- The staff lookup endpoint's shape (id and display name of active Admins and Managers, open to both roles), built so ORD-22 and ORD-23 can reuse it.
- How the money-on-hand ledger reads expenses later (Phase 10), as long as soft-deleted expenses never count and restored ones do.
- The dev seed contents for expenses and categories.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` (Phase 6, around line 673): goal, success criteria and the decisions closed above
- `.planning/REQUIREMENTS.md`: CEXP-01 to CEXP-05, PERF-04, SEC-07 (409 and locking), SEC-08 (attribution), MONEY-01 and MONEY-05 (how expenses feed balances), AUDIT-01
- `.planning/PROJECT.md`: owner decision table (OD-5, OD-8, OD-14, OD-16, OD-21, C-43)

### Behavior and UI
- `CSPS-PRD.md` §5.2 (CompanyExpense aggregate) and §6.5 (CEXP). Its optional vendor is dropped (D-19).
- `docs/CSPS-UI-SPEC.md` §8.8 Company Expenses (line 1234), §6.2 category badge tones (line 519), §12.3 seed data (line 1516) and Appendix E.11 (line 5747). The UI spec's fixed category list, missing Paid by, missing Notes, "last 30 days" default and "permanently deleted" copy are all superseded by the decisions above (mark them SPEC-GAP or SPEC-DEVIATION).

### Prior phase decisions
- `.planning/phases/05-profile-user-management/05-CONTEXT.md`: D-06 (no triggers), D-07 to D-11 (soft-deleted users and the former-staff label), D-20 and D-21 (409 pattern), D-37 to D-40 (UI and audit rules), D-41 (no row version on single-click deletes)
- `docs/operations/audit-log.md`: the audit event catalog the new events join

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/components/lists/`: `FilterBar`, `SearchBox`, `Pagination`, `ResponsiveTable`, `SkeletonTable`, with URL list state (`listState.integration.test.tsx`)
- `web/src/components/money/KpiCard.tsx`, `Money.tsx`: the KPI cards and ₱ formatting
- `web/src/components/overlays/ConfirmDialog.tsx`, `Modal.tsx`: delete confirms and the Add/Edit modal, with motion from Phase 5
- `web/src/components/data/RecordMeta.tsx`, `ActorName.tsx`: "Recorded by" and "Last changed by", including "(former staff)"
- `web/src/components/status/tones.ts`: `EXPENSE_TONE` keyed by the typed `ExpenseCategory` union. It has to change to a tone stored per category (D-08, D-13).
- `src/Csps.Application/Ports/IBusinessCalendar.cs`: Manila "today" and month boundaries
- `src/Csps.Domain/Common/IAttributedRecord.cs`: the SEC-08 attribution contract
- `src/Csps.Application/Users/` (`ListUsersHandler`, `ListUsersRequestValidator`, `UpdateUserHandler`): the list, validate and update handler pattern to copy
- `src/Csps.Infrastructure/Identity/UserDirectory.cs`: a likely basis for the staff lookup

### Established Patterns
- One handler per use case, FluentValidation in handlers, `Result<T>` to ProblemDetails, one `[ApiController]` per resource with explicit policies
- Per-module web services in `web/src/modules/admin/services/` (OR-5), and zod schemas that mirror the server validators (OR-3)
- No em or en dash in `web/src`, and empty values use `EmptyValue` (OR-4)

### Integration Points
- The sidebar already has `Company Expenses` at `/admin/expenses` (`web/src/components/navigation/Sidebar.tsx:60`). The new Manager-only **Settings** item is added there and to the drawer.
- `src/Csps.Infrastructure/Seeding/DevSeedSteps.cs` already expects a company-expenses seed step.
- Phase 10's dashboard (DASH-02) and money on hand (MONEY-01) read company expenses, and Phase 7 reuses the staff lookup and the slice pattern.

</code_context>

<specifics>
## Specific Ideas

- One category, "Government contributions", covers SSS, PhilHealth and Pag-IBIG.
- An Admin's own expenses are the ones they recorded or paid, which covers a coworker entering an expense on their behalf.

</specifics>

<deferred>
## Deferred Ideas

- Whether order expense categories are Manager-editable too: decide in Phase 7 (OD-8, order part).
- OD-16, whether paying an expense may take the payer's balance below zero: still Phase 10. The default is to allow it.

</deferred>

---

*Phase: 06-company-expenses*
*Context gathered: 2026-10-25*

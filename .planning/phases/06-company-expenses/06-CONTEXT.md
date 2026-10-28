# Phase 6: Company Expenses - Context

*Created: 2026-10-25T02:28:52-05:00 · Updated: 2026-10-27T21:10:00-05:00*

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

### Research follow-ups (owner, 2026-10-25, after 06-RESEARCH.md)
- **D-30:** "Ever used" in D-10 means **an expense row exists now**, soft-deleted ones included. If every expense in a category is deleted permanently, the category can be deleted again. No "was used" column. (RESEARCH open question 1, option A.)
- **D-31:** A **soft delete or restore updates "Last changed by"** to the Manager who did it, like deactivate and lock in Phase 5 (SEC-08). The stamp interceptor needs no exception. (Open question 3, option A.)
- **D-32:** **Paid by must be signed-in staff:** an active Admin or Manager who has finished set-up (has a password). An invited person who has not finished set-up **can't** be chosen. The staff lookup and the server validator both apply this rule, and the field error stays plain English. This narrows D-18 "any active coworker". (Open question 4, option B.)
- **D-33:** The **database checks only `Amount > 0`**. The ₱1,000,000.00 cap (D-21) lives in the zod schema and the server validators, so legacy imports can hold larger amounts and the cap can change without a migration. (Open question 6, option A.)

### Execution rulings (owner, 2026-10-25, during execute-phase)
- **D-49:** **Paid by needs a first sign-in.** A person a Manager created with a temporary password who has never signed in **can't** be chosen as Paid by (A-06-01, option 1). "Finished set-up" in D-32 now means the account is marked at the first sign-in code or accepted invite (`EmailConfirmed`), not only "has a password". Staff whose password a Manager reset stay choosable. No schema change. Applies to the staff lookup and the server payer check alike.
- **D-50:** **No inline SQL, not even the three existing locks.** The owner does not approve `IdempotencyGate.cs`, `AccountTokenStore.cs` or `ManagerRosterLock.cs` by name (06-11 backlog item, option 2). Each lock is rebuilt with EF's own API (for example a lock row updated with `ExecuteUpdate` inside the same transaction), with race tests proving it still serializes two requests at once. `NoInlineSqlTests` then allows no file. A small additive lock table is in scope; anything beyond that (a drop, a rename, a trigger) goes back to the owner.
- **D-51:** **Month KPI edge cases confirmed** (A-06-02, option 1). The cards follow the business time zone in Site settings (Asia/Manila today); no other case needs its own rule.
- **D-52:** **Timing data size confirmed** (RESEARCH open question 5). The shop's real rate is below about 20 expenses a day, so the 5-year set of about 36,500 rows stays as a safe upper bound.
- **D-53:** **Audit viewer option A confirmed** (RESEARCH open question 2). The server turns the stored detail into change lines and names payer and category, and "Done to" also matches expense payers, as built in 06-15.

### UAT rulings (owner, 2026-10-26, during verify-work)
- **D-54:** **UI-SPEC OQ-1 to OQ-15 confirmed as built** (06-UAT test 2). Every open question in `06-UI-SPEC.md` keeps its recommended default: eraser as a third row icon, a separate Deleted Expenses page, Settings after Audit Log, retired categories can be used again, no confirm on Restore, Retire and Use again, Others protected, an inactive saved payer may stay, an eye View for Admins, no preselected category, limits 200 and 40, per-row button names, five new icons, the amended wording, both primary buttons in the first-use empty state, and the SPEC-GAP strings as written (subject to the copy review, UAT test 3).
- **D-55:** **Phase 6 wording approved as built** (05 D-48 copy review, 06-UAT test 3). Every string in the review pack table "Words on the Phase 6 screens" (Company Expenses, Deleted Expenses, Settings and the Audit Log labels and change lines) stays as written.
- **D-56:** **Paid by wording for someone not yet signed in stays as is** (plan 06-20 backlog item, option 1; 06-UAT test 4). A person who has not had a first sign-in is left out of the Paid by list, and a save that names them anyway gets the existing sentence "This person can't be chosen because their account isn't active. Choose someone else." No new sentence and no change to `ExpenseRules.PaidByInactive`.
- **D-57:** **Every staff member may read every expense's notes** (code review A-IN-03, option 2; 06-UAT test 5). The View window shows Notes to an Admin even on expenses they cannot edit. Kept as built; `CompanyExpenseDetailResponse.From` and the View modal do not change. Notes stay out of the list and search (D-19).
- **D-58:** **The live speed check after release is a follow-up, not a Phase 6 gate** (06-UAT test 6). The local and CI timing test (D-28, 300 ms p95 on about 36,500 rows) is the speed gate for the expense list and KPI endpoints. Checking the live request logs after release (`docs/operations/list-performance.md`) moves to the ROADMAP backlog as Phase 999.4. The CI-margin backlog item (A-06-03) still stands.
- **D-59:** **Test-side fixes confirmed** (06-UAT test 7). The slow add-expense test fix (axe trims passing nodes, a7ddcd76 and 39cc69e3) and the command-count flake fix (`CommandCounter` counts only the measured request, c0616d1c) are accepted; both debug sessions are resolved. The staff accounts that pile up in `CSPS_E2E` are left as they are. A request the browser cancels and that is logged as a server error is fixed later in a quick task, not in Phase 6.
- **D-60:** **Fix all five UI review warnings before Phase 6 closes** (06-UI-REVIEW.md UI-06-01 to UI-06-05, plus the long header comments under OR-2). The shared `Select` gets the same required " *" mark as `Field` (app-wide); the native date inputs show the friendly en-PH date beside the box; the Settings row actions get fixed slots; counts use the en-PH number format; the E1 toolbar labels align. Done as one quick task, test first. Phase 6 is marked complete only after these land.
- **D-61:** **On phones each date filter takes its own row** (quick 261026-89i, UI-06-02). The From and To boxes show the friendly en-PH date beside them, so on phones they no longer fit two per row. A SPEC-DEVIATION from the UI-SPEC phone toolbar rule, approved by the owner.
- **D-62:** **Every count uses the en-PH thousands format, app-wide** (quick 261026-89i, extends UI-06-04). Not only the KPI card and the Settings column: the shared result bar ("Showing 1,687 expenses") and any other place a count shows.
- **D-63:** **Native dropdown and date boxes restyled; no written-out date beside any date box** (owner, 2026-10-27; quick 261027-t3j). R1: keep the browser's own option list and date picker, so phones keep their native wheel and calendar. Restyle only what the app draws: the box, border, hover, focus, the Select chevron, the app's own calendar icon in place of the browser's grey one (a click on it still opens the browser's picker), and both themes. No custom popup and no new package. R2: remove the written-out date ("Sep 16, 2026") beside every date box, app-wide; the DateInput option for it is gone. This supersedes D-60's date-beside-the-box item and D-61: on phones the From and To boxes may sit side by side again.
- **Review pack pictures approved** (06-UAT test 1): Company Expenses, Deleted Expenses and Settings in both themes at 390, 820 and 1440 px.

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

# Phase 6: Company Expenses - Discussion Log

*Created: 2026-10-25T02:28:52-05:00 · Updated: 2026-10-25T02:28:52-05:00*

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log keeps the alternatives that were considered.

**Date:** 2026-10-25
**Phase:** 06-company-expenses
**Areas discussed:** Deleting an expense, Expense categories, Who paid and extra fields, Speed check and order, Who can edit what, Future dates and limits, Category rename and retire, Audit

---

## Deleting an expense

| Option | Description | Selected |
|--------|-------------|----------|
| Hide it, keep it | Soft delete, no restore | |
| Hide it, Managers restore | Soft delete plus a Manager restore | ✓ |
| Delete permanently | Row removed, audit keeps a copy | |

**User's choice:** Hide it, and Managers can restore. Managers can also delete permanently.
**Who deletes:** Managers only (not "Admins and Managers").
**Where is permanent delete offered:** from either place (not "only from the Deleted view").
**Confirmation:** a normal Yes/Cancel for both (not type-to-confirm).
**Audit after a permanent delete:** date, category, amount and payer (not "only that it happened").
**Deleted view:** Managers only (not "Admins can look, not act").

---

## Expense categories

| Option | Description | Selected |
|--------|-------------|----------|
| Managers can edit | Add, rename, retire. Categories in use are retired, never deleted | ✓ |
| Fixed list | Set in code | |

**Starting additions:** Government contributions, Taxes and permits, and Transport and fuel. Three separate SSS, PhilHealth and Pag-IBIG categories were offered and not chosen.
**Order expense list:** decide in Phase 7 (not "same rule now").
**Badge color:** the Manager picks from set colors (not "one neutral color").
**Where to edit:** a Settings page in the sidebar (not "a button on the Expenses page").
**Picker order:** A to Z, Others last (not "an order the Manager sets").
**Unused category:** can be deleted for good if never used (not "retire only").
**Rename:** old expenses show the new name (not "keep the old name").
**Retired:** hidden from Add, kept in filters (not "hidden everywhere but old rows").

---

## Who paid and extra fields

| Option | Description | Selected |
|--------|-------------|----------|
| A staff member only | Always an active Admin or Manager | ✓ |
| Staff, or the company | Adds a company payer with no balance | |

**Paid by default:** the signed-in user (not "empty, must pick").
**Extra fields:** free text "add note box". The options offered were none, Vendor, or Vendor and Notes. Notes only, with no Vendor.
**Notes:** in the form only and not searched (not "searched too" or "shown and searched"). Up to 1,000 characters (not 500).

---

## Speed check and order

| Option | Description | Selected |
|--------|-------------|----------|
| Local test, then live logs | CI timing test on fake data, then the live request logs | ✓ |
| Local and CI test only | No live check | |
| Owner-run live check | A read-only script against the live site | |

**Build order:** Expenses before Orders (not "Orders first").

---

## Who can edit what

**Can an Admin edit others' expenses:** only their own (not "yes, any expense").
**What counts as "own":** recorded or paid by them (not "ones they recorded").
**Admin list view:** every expense (not "only their own").

---

## Future dates and limits

**Future dates:** up to 30 days ahead (not "no, up to today").
**Maximum amount:** ₱1,000,000.00 (not ₱10,000,000.00 or no limit).
**Balance effect of a future-dated expense:** as soon as it's saved (not "on its date").
**Default list range:** includes upcoming, from 30 days ago to 30 days ahead (not "past 30 days only").

---

## Audit

**What is recorded:** every change, with amounts (not "money-moving changes only").

---

## Claude's Discretion

Page size, URL parameter names, the index set, row versions on single-click actions (follow 05 D-21 and D-41), the performance data set, the staff lookup's shape and the dev seed contents.

## Deferred Ideas

- The order expense category rule: Phase 7.
- OD-16, whether an expense may take a balance below zero: Phase 10.

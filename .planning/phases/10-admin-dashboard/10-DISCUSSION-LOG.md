# Phase 10: Admin Dashboard - Discussion Log
*Created: 2026-11-05T06:50:00-06:00 · Updated: 2026-11-05T06:50:00-06:00*

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log keeps the alternatives considered.

**Date:** 2026-11-05
**Phase:** 10-admin-dashboard
**Areas discussed:** Dashboard number rules, Staff balance limits, Fixing a wrong transfer, Dashboard scope and money screens

Before the discussion the owner chose to cut `gsd/phase-10-admin-dashboard` from the Phase 9 tip (Phase 9 not merged yet) rather than from main.

---

## Dashboard number rules (C-40)

| Question | Options | Selected |
|---|---|---|
| "Due this week" window | Mon to Sun this week; next 7 days; Mon to Sun plus overdue | Mon to Sun this week |
| Overdue in that count | Not counted; add "{n} overdue" to the foot | Add "{n} overdue" to the foot |
| Same day last month on a missing day | Clamp to last day of last month; same number of days | Clamp to last day |
| Percent when last month is ₱0.00 | Hide the percent; show the peso difference | Hide the percent |
| Receivables include overdue | Yes; yes plus overdue part; no | Yes |
| Cancelled in Orders by status | Hide; show cancelled this month; active statuses only | Hide Cancelled |
| Top category | Most money spent; most entries | Most money spent |
| Refunds in chart income | Minus refunds; payments only | Minus refunds |
| Refunds in Collected card | Match the chart; payments only | Match the chart |
| Order expense month | Expense's own date; order date | Expense's own date |
| Money on cancelled orders | Counts; leave out | Counts |
| Admin vs Manager totals | Same for both; Managers only | Same for both |
| Freshness | Live every visit; up to 1 minute cache | Live |

**Notes:** The UI spec's "Active (Pending to Ready)" predates the Delivered status; Phase 7 D-01 counts Delivered as active, so the dashboard follows Phase 7.

---

## Staff balance limits (OD-16)

| Question | Options | Selected |
|---|---|---|
| Transfer above balance | Refuse; allow with warning | Refuse |
| Expense below zero | Allow; refuse | Allow |
| Payment fix or order delete below zero | Allow; refuse the fix | Allow |
| Leaver's money | Manager transfers it; nothing special; block until zero | Manager transfers it |
| Leaver hand-over cap | Up to what they hold; exactly all | Up to what they hold |
| Leaver negative | Allow transfers into the leaver; nothing | Allow transfers into the leaver |
| Backdating | Any past date; last 30 days | Any past date |

**Notes:** A question on negative senders had only one sensible answer; it follows from "refuse": a sender at or below zero can't send.

---

## Fixing a wrong transfer (OD-17, OD-18)

| Question | Options | Selected |
|---|---|---|
| Edits | None, delete and re-enter; note only | None |
| Delete kind | Soft; hard | Free text: "soft delete but give manager an option to hard delete those soft deleted ones" |
| Show deleted | Hidden with filter; always shown; Managers only | Hidden with a "Show deleted" filter |
| Delete reason | Required; confirm only | Confirm only |
| Permanent remove audit | Full copy; who and when | Full copy |
| Permanent remove confirm | Stronger; same as normal | Stronger |
| Restore | No; yes with check | No |
| Bulk remove | One at a time; bulk | One at a time |
| Who sees deleted | Both parties plus Managers; Managers only | Managers only |
| Notify on delete | No message; email both | No message |
| Delete pushes below zero | Allow; refuse | Allow |
| Manager deletes own | Yes; another Manager | Yes |
| Admin awareness (follow-up on a conflict between "Managers only" and "shows in their ledger") | Quiet; Admins see their own | Quiet: balance just changes |

---

## Dashboard scope and money screens (C-18)

| Question | Options | Selected |
|---|---|---|
| Profit on dashboard | None; profit line on chart; profit KPI for Managers | Profit line on chart |
| Profit line formula | Income bar minus expenses bar; order profit only | Income minus expenses |
| My money location | New page in menu; inside Profile | New page in menu |
| Manager everyone view | Tab on money page; column on Users | Tab on money page |
| All staff rows | Active plus leavers with money; everyone ever | Active plus leavers with money |
| Team total | Total row; no total | Total row |
| Hand-over entry point | Row button; from leaver's ledger | Row button |
| Dashboard money card content | My balance plus Transfer; plus team total for Managers | My balance plus Transfer |
| Money card position | Own strip above KPI row; fifth KPI; next to Orders by status | Own strip above KPI row |
| Phone navigation | Via card and menu; replace Profile; fifth item | Via card and menu |
| Running balance in ledger | Yes; no | Yes |
| Transfer form | Modal; separate page | Modal |
| Recent orders order | Newest created; last changed | Newest created |

---

## Claude's Discretion

- Ledger and balance query design, API resource names, profit-line styling, card state copy (see CONTEXT.md).

## Deferred Ideas

- Migrated money and opening balances (OD-15, Phase 15).
- Notifications about transfers (not wanted now).

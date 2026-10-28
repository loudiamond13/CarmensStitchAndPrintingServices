# Phase 7: Order Domain & API - Discussion Log

*Created: 2026-10-27T20:53:00-05:00 · Updated: 2026-10-27T20:53:00-05:00*

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log keeps the alternatives considered.

**Date:** 2026-10-27
**Phase:** 07-order-domain-api
**Areas discussed:** Order status and cancelling, Money rules, The order record, Delete and old-system data, Refunds limits and audit

---

## Order status and cancelling

| Question | Options | Selected |
|---|---|---|
| How orders move between statuses | Free among active with guarded ends / Forward one step at a time / Any to any | Free among active with guarded ends |
| Who reopens Completed or Cancelled | Managers only / Admins and Managers / Nobody | Admins and Managers |
| Completed while money is owed | Yes, payments still allowed / No, balance must be zero | Other: balance must be zero, and add a status for handed over to the customer |
| Cancelled after a downpayment | Keep unless a refund is recorded / Always kept / Must refund all to cancel | Keep unless a refund is recorded |
| Where the handed-over status goes | Ready > Delivered > Completed / Auto-complete when paid / Delivered replaces Ready | Ready > Delivered > Completed |
| Name of the new status | Delivered / Picked up / Handed over | Delivered |
| Edits on Completed or Cancelled | Locked, reopen first / Expenses still allowed / Not locked | Locked, reopen first |
| Refund lowers refunder's money on hand | Yes / No, keep OD-16 default | Yes |

## Money rules

| Question | Options | Selected |
|---|---|---|
| Other changes that push balance below zero | Block them too / Allow, show as customer credit | Allow, show as customer credit |
| Discounts per order | Many / At most one | Many |
| Payment methods | Four fixed / Four plus Cheque / Manager-editable | Other: the four plus Cheque, Manager-editable |
| Order expense categories | Own editable list / One shared list / Fixed six | Own editable list |
| Completed with a customer credit | No, refund first / Yes | No, refund first |
| Legacy overpaid orders | As-is with credit / As-is plus review list | As-is with credit |
| Payment method list rules | Same as categories / Add and retire only | Same as categories |

## The order record

| Question | Options | Selected |
|---|---|---|
| Customer records | Typed on each order / Reusable records | Typed on each order |
| Due date | Required, on or after order date / Optional | Required |
| Year in the order number | Day saved, Manila time / Order date | Day saved, Manila time |
| Create flow | Follow the design / One big form | Follow the design |

## Delete and old-system data

| Question | Options | Selected |
|---|---|---|
| Product types | Manager-editable / Fixed six | Manager-editable |
| Order delete | Same as expenses / Permanent only / Soft only | Same as expenses |
| Who deletes | Managers only / Admins and Managers | Admins and Managers |
| Legacy receiver and payer | Legacy / unassigned holder / One chosen staff member | Legacy / unassigned holder |
| Who restores or deletes for good | Managers only / Admins and Managers | Managers only |
| Who edits orders | Any staff / Admins only their own | Any staff |
| Early legacy fit check | Add Phase 7.1 / Wait for Phase 15 | Add Phase 7.1 |
| Settings sections for the new lists | Phase 8 / Phase 7 | Phase 8 |

## Refunds, limits and audit

| Question | Options | Selected |
|---|---|---|
| Who records refunds | Any staff, up to what was paid / Managers only | Any staff |
| Cancelled orders' expenses | Still count / Dropped | Still count |
| Limits | Reuse Phase 6 limits / Different numbers | Reuse Phase 6 limits |
| Audit scope | Every change / Money and status only | Every change |

## Claude's Discretion

DTO field names for credit and refunds, list paging and parameters, counter locking method, list endpoint shapes, dev seed contents, which import rules are relaxed.

## Deferred Ideas

Using a customer credit on another order; final legacy receiver rule (Phase 15); other OD-16 questions (Phase 10).

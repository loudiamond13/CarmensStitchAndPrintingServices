# Phase 8: Order Screens - Discussion Log

*Created: 2026-10-29T14:06:00-05:00 · Updated: 2026-10-29T14:06:00-05:00*

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log keeps the alternatives considered.

**Date:** 2026-10-29
**Phase:** 08-order-screens
**Areas discussed:** Money labels, Profit and Received by, Refunds and status, Delete and Deleted orders, Create flow without images, Settings for the 3 lists, Order page on phones, Due dates

The owner took the recommended option every time except where marked ✓ on a non-first option.

---

## Money labels (C-13)

| Question | Options | Selected |
|---|---|---|
| Panel wording | PRD names (Subtotal, Discount, Total, Paid, Balance) / Design wording (Total, Total Discount, Total Paid) | PRD names |
| Customer credit | Credit block / Negative balance | Credit block |
| Refunds in panel | Own Refunded row / Net paid row | Own row |
| List money | Total and Balance / All four figures | Total and Balance |
| ORD-01 wording | Table adds Paid / Only Total and Balance / Table shows all four | Table adds Paid |
| Save message on credit | Name the credit / Same as fully paid | Name the credit |
| List credit marker | "Credit ₱X" badge / "Fully Paid" only | Credit badge |

## Profit and Received by (C-18, OD-20)

| Question | Options | Selected |
|---|---|---|
| Where profit shows | Order page only / Order page and table | Order page only |
| Profit note | Note by status / One short note | Note by status |
| OD-20 label | Received by / Paid to | Received by |
| Picker default | Same as expenses (signed-in user) / Nothing chosen | Same as expenses |
| Refund person label | Refunded by / Handed back by | Refunded by |
| Who sees profit | Admins and Managers / Managers only | Admins and Managers |
| People columns | Money person only / Both people | ✓ Both people (not the recommendation) |

## Refunds and status

| Question | Options | Selected |
|---|---|---|
| Refunds location | 5th tab when needed / 5th tab always / Inside Payments | 5th tab when needed |
| Status control | Status menu in header / Step buttons | Status menu |
| Locked order | Banner + Reopen / Disabled buttons | Banner + Reopen |
| Reopen target | Staff pick / Back to the last one | Staff pick |
| Status history | Small list on page / Audit log only | Small list |
| Delivered tone | You decide / Same as Ready | You decide |
| Cancel confirm | Explain the money / Offer a refund now | Explain the money |
| Credit block button | Yes, opens refund form / No | Yes |
| Status from list | Order page only / Also from the list | Order page only |

## Delete and Deleted orders

| Question | Options | Selected |
|---|---|---|
| Soft delete confirm | Confirm with counts / Plain Yes/Cancel / Type the number too | Confirm with counts |
| Where to delete | Order page only / Page and list | Order page only |
| Deleted view | Like Deleted Expenses / A filter on the list | Like Deleted Expenses |
| Look inside a deleted order | No, list only / Read-only view (new Manager-only route) | ✓ Read-only view (not the recommendation) |
| ORD-06 row | Pending until Phase 8 / Keep Complete | Pending |

## Create flow without images

| Question | Options | Selected |
|---|---|---|
| Images card on create | Leave it out / "Coming soon" card | ✓ "Coming soon" card (not the recommendation) |
| Edit form | Details only / Details and items | Details only |
| Payment method default | Nothing chosen / First in the list | Nothing chosen |
| Start status | Any active, default Pending / Always Pending | Any active |
| Gallery on order page | Same "coming soon" / Leave it out | Same "coming soon" |

## Settings for the 3 lists

| Question | Options | Selected |
|---|---|---|
| Layout | Stacked sections / Tabs inside Settings | ✓ Tabs (not the recommendation) |
| Order | Orders lists first / Keep expenses first | Orders lists first |
| Colors | All three / Categories only | All three |

## Order page on phones

| Question | Options | Selected |
|---|---|---|
| Totals position | Balance bar on top / Design as is / Sticky bottom bar | Balance bar on top |
| Tabs at 320 px | Side-scroll tab row / Dropdown | Side-scroll |
| Tab tables | Cards as designed / Scrolling table | Cards |

## Due dates

| Question | Options | Selected |
|---|---|---|
| Wording | Design wording / Short form | Design wording |
| Which statuses flag | Pending to Ready / All active | Pending to Ready |
| No due date | EmptyValue, no flag, sorts last / "No due date" text | EmptyValue |

## Claude's Discretion

- The Delivered badge tone (the owner OKs it in the UI review).
- Copy details beyond the meanings ruled, which go to the copy review.

## Deferred Ideas

- Dashboard profit (Phase 10). APX-IN-01 audit line detail (Phase 8 UI review). Status change and delete from the list (declined for now).

## Note

- During the discussion I said the existing `TabBar` already scrolls sideways. That was wrong: `TabBar` is the phone bottom navigation, and the shared `Tabs` component is the starting point. The owner's choice did not depend on it.

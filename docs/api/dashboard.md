---
created: 2026-11-06T23:30:00-06:00
updated: 2026-11-06T23:30:00-06:00
---

# The dashboard API

This is the contract behind the admin dashboard, and the one a future Android app will use. Everything here is under `/api/v1`.
The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of this page; the
web app's types are generated from it (`web/src/types/api.generated.ts`). Sign-in and the access token are in [auth.md](auth.md).
The money-over-time chart has its own route and is added by a later plan.

## In plain words

1. One call, `GET /api/v1/dashboard/summary`, gives everything the dashboard shows except the chart: the greeting, the four cards,
   the orders-by-status bar and the six newest orders.
2. **Every figure is worked out on the server** from live data, in one request, so one answer is one consistent picture even at a
   week or month boundary. The web app only shows it.
3. **Nothing is cached.** The answer carries `Cache-Control: no-store` and no server cache holds a figure (D-13).
4. **Both roles see the same figures** (D-12). Only `firstName` and `greeting` can differ between two callers.

## The route

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /dashboard/summary` | Staff | none; no query parameters | `200` the summary, `401` without a valid token. |

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. The caller is the token's
subject: the first name is never taken from the request (T-10-08).

## The answer

```text
{
  today, greeting, firstName,
  orders    { active, dueThisWeek, overdue, receivables },
  collected { thisMonth, comparison, comparisonThrough, changePercent | null },
  expenses  { thisMonth, count, topCategory | null },
  statuses  [ { status, count } x 6 ],
  recentOrders [ order list entry x up to 6 ]
}
```

### The business day

- `today` is the business today as `yyyy-MM-dd`, in the business zone (Asia/Manila by default). It never comes from the server's or
  the device's own clock.
- `greeting` is `morning` before 12:00, `afternoon` from 12:00 to before 18:00, and `evening` from 18:00, all in the business zone
  and exact to the second.
- `firstName` is the signed-in person's first name, read from their user row.

### Orders (`orders`)

| Field | Rule |
|---|---|
| `active` | Orders in Pending, Mockup, In Production, Ready or Delivered. Deleted orders never count (07 D-01, D-01). |
| `dueThisWeek` | Active orders whose due date is Monday to Sunday of the business week and that are **not overdue**. A Delivered order due Monday counts on Wednesday; a Pending order due Monday does not (it is overdue). An order with no due date counts here and in `overdue` never (D-01, D-55). |
| `overdue` | Orders in Pending, Mockup, In Production or Ready whose due date is before the business today. A Delivered order is never overdue (D-02, 08 D-37). |
| `receivables` | The sum over all active orders, overdue ones included, of the balance when it is above zero, else zero. An overpaid order adds 0.00 (D-03). |

The week runs Monday to Sunday. At Monday 00:00 the week starts that day; at Sunday 23:59 it still holds that Sunday's orders.

### Collected (`collected`)

| Field | Rule |
|---|---|
| `thisMonth` | Payments dated in this business month minus refunds dated in this business month. Orders of every status count, Cancelled ones included; deleted orders do not. It may be below zero (D-04, D-11). |
| `comparison` | The same figure for the 1st of last month through the same day number last month (D-05). |
| `comparisonThrough` | The last day of the comparison. The same day number is clamped to the last day of last month: on 31 March the comparison runs 1 February to 28 February (29 February in a leap year). |
| `changePercent` | `(thisMonth - comparison) / abs(comparison) x 100`, rounded to a whole number half away from zero (12.5 becomes 13, -12.5 becomes -13). It is `null` when `comparison` is 0.00 (D-06, D-54). A result beyond the whole-number range is held at its end. |

Dates are compared as business dates (the payment date or refund date), not as UTC instants.

### Expenses (`expenses`)

| Field | Rule |
|---|---|
| `thisMonth`, `count` | The total and the number of company expenses dated in this business month, as the expenses page shows them. Deleted expenses never count. |
| `topCategory` | The name of the category with the most money this month. If two tie, the name that comes first A to Z wins. `null` when there are no expenses this month (D-07). |

The figures come from the same read as `GET /company-expenses/kpis`, so the dashboard and the expenses page agree.

### Orders by status (`statuses`)

Exactly six entries, always in this order: `pending`, `mockup`, `production`, `ready`, `delivered`, `completed`. Cancelled is never
listed (D-08).

- The first five are how many non-deleted orders are in that status right now.
- `completed` is how many orders **moved to Completed in this business month**, judged by when the status last changed, against
  the month's UTC range. An order completed at 00:30 Manila time on the 1st (16:30 UTC the day before) counts in this month.

### Recent orders (`recentOrders`)

The 6 newest created orders of any status, newest first (D-38, DASH-05). Ties on the creation time go by id, highest first. Deleted
orders never appear. With fewer than six orders, all are listed. Each entry has the same shape as a row of `GET /orders`
(`id`, `number`, `customerName`, `teamName`, `orderDate`, `dueDate`, `status`, the money figures, `pieces`, `imageCount`, `cover`).
This is not the order list: it does not hide old Completed or Cancelled orders and it is not sorted by order date.

## Statuses and errors

| Status | When |
|---|---|
| `200` | The summary. |
| `401` | No valid access token, or the token names an account that no longer exists. The body is the usual ProblemDetails. |

## How the server reads it

The server makes a fixed number of SQL commands whatever the data: one for the caller's first name, one grouped read of the
orders (counts, receivables and statuses), one for the payments, one for the refunds, two for the expense figures and one for
the six newest orders. Every figure is a LINQ aggregate; there is no inline SQL.

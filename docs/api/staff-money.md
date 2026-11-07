---
created: 2026-11-07T05:20:00-06:00
updated: 2026-11-07T05:20:00-06:00
---

# The staff money API

This is the contract behind the money each staff member holds, and the one a future Android app will use. Everything here is under
`/api/v1`. The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of this
page; the web app's types are generated from it (`web/src/types/api.generated.ts`). Sign-in and the access token are in
[auth.md](auth.md). Later plans add the transfer routes to this page.

## In plain words

1. Every staff member can see how much of the shop's money they hold. We call it **money on hand**.
2. **It is never stored.** No column, table or cache holds a balance, and no route accepts one. The server adds up the records on
   every read, so the figure is always right (MONEY-01).
3. The figure can be **below zero**. That means the shop owes the person money, for example when an expense is larger than what they
   hold, or when an order that held their payment was deleted. Nothing refuses it (D-15, D-16).
4. Both roles use the same route and each person reads only their own figure. The route takes no id.

## The route

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /staff-money/me` | Staff | none; no query parameters | `200` the caller's money on hand, `401` without a valid token. |

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. The person is the token's subject
(T-10-13). Nothing is cached: the answer carries `Cache-Control: no-store`.

## The answer

```text
{ userId, name, balance, today }
```

| Field | Meaning |
|---|---|
| `userId` | The signed-in person. |
| `name` | Their name, first then last. |
| `balance` | Money on hand in pesos, with two decimals. Negative when they are owed money. A person with no money records reads `0.00`. |
| `today` | The business today as `yyyy-MM-dd`, in the business zone. |

Example:

```json
{ "userId": "6f3c2a54-0b9d-4f0e-9f2a-3b1d7c5e8a10", "name": "Liza Mercado", "balance": 1100.00, "today": "2026-11-04" }
```

## The six sources

`balance` = payments received + transfers to them - transfers from them - company expenses they paid - order expenses they paid -
refunds they handed back.

| Source | Counted by |
|---|---|
| Order payments | The person who received the payment (`Received by`). |
| Transfers in | The recipient of the transfer. |
| Transfers out | The sender of the transfer. For a hand-over this is the former staff member, not the Manager who recorded it. |
| Company expenses | The person named in `Paid by`. |
| Order expenses | The person named in `Paid by`. |
| Order refunds | The person who handed the refund back. |

Change an expense's `Paid by` and its amount moves from one person's balance to the other's, exactly.

## What never counts

- A **deleted transfer**.
- A **deleted company expense**.
- The payments, refunds and order expenses of a **deleted order**. Orders that are Cancelled still count.
- The shop's own placeholder account for old records with no known person (`Legacy / unassigned`). It is never read.

## Errors

Errors are RFC 9457 Problem Details, the same as the rest of the API. This route has only `401` (the token names no usable account).
The error values for later routes (`staff-money.not-found`, `staff-money.forbidden`, `money-transfers.busy`) are defined and used when
those routes arrive.

## Schema note

The transfers table, `MoneyTransfers`, exists from this plan so that transfers count in the sums. It has two checks, not triggers:
the amount is more than zero, and the sender is not the recipient. A standing lock row, `staff-money`, is seeded for the transfer
routes that come later.

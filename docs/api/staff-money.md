---
created: 2026-11-07T05:20:00-06:00
updated: 2026-11-07T09:35:00-06:00
---

# The staff money API

This is the contract behind the money each staff member holds, and the one a future Android app will use. Everything here is under
`/api/v1`. The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of this
page; the web app's types are generated from it (`web/src/types/api.generated.ts`). Sign-in and the access token are in
[auth.md](auth.md). The transfer route is below; later plans add the hand-over and ledger routes.

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

## POST /api/v1/money-transfers

A staff member sends part of their money on hand to a coworker (MONEY-04, MONEY-05). Both roles use it.

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `POST /money-transfers` | Staff | `{ toUserId, amount, transferDate, note }` | `201` the saved transfer and the sender's new balance, `400` field errors, `401` without a valid token, `409` when the lock was busy too long, `422` when the `Idempotency-Key` was used with a different body. |

- **The sender is always the signed-in person.** The body has no sender. A `fromUserId`, `createdById`, `createdAtUtc`, `updatedById`,
  `updatedAtUtc` or `isHandover` in the body is ignored. Who recorded the transfer and when come from the token and the clock (SEC-08).
- `transferDate` is `yyyy-MM-dd`. Any past day is accepted; the balance check uses the sender's balance now (D-20).
- Send an `Idempotency-Key` header. The same key and body twice records one transfer, and the second answer replays the stored `201`
  with an `Idempotent-Replayed` header. The same key with a different body answers `422` (SEC-06).
- The answer is `{ transfer, senderBalance }`. It never carries the recipient's balance (OD-19).

### Who can receive

- An active `Admin` or `Manager` can receive. This includes a person a Manager has locked and a person who has not finished first
  sign-in set-up (D-56).
- A deactivated or deleted person can receive only while they are owed money (their balance is below zero), and only up to what brings
  them to `0.00` (D-19, D-49).
- Anyone else is refused: the legacy placeholder account, an account with no staff role, and an id that does not exist.

### Refusals (all `400` under the named field)

| Field | Message |
|---|---|
| `toUserId` | `Choose who got the cash.` (missing) |
| `toUserId` | `Choose someone other than yourself.` |
| `toUserId` | `{name} can't receive transfers now. Choose someone else.` (deactivated or deleted, and not owed money) |
| `toUserId` | `This person can't receive transfers now. Choose someone else.` (unknown id, the legacy placeholder, or a non-staff account) |
| `amount` | `Enter the amount.` |
| `amount` | `Enter an amount of at least ₱0.01.` |
| `amount` | `Use at most 2 decimal places.` |
| `amount` | `You have nothing on hand to transfer.` (sender at or below `0.00`) |
| `amount` | `You only have {₱3,200.00} on hand.` (above the sender's balance) |
| `amount` | `{name} is owed only {₱500.00}. Enter that or less.` (a Manager, into a leaver who is owed less) |
| `amount` | `That's more than {name} is owed. Ask a Manager for the amount.` (an Admin; no figure is given, D-49) |
| `transferDate` | `Enter the transfer date.`, `Enter a real date.`, `The transfer date can't be in the future.` |
| `note` | `Keep the note to 200 characters or fewer.` |

An empty body lists `toUserId`, `amount` and `transferDate` together. An anonymous call gets `401` before the body is read.

### The lock (D-53)

Only a transfer (and, in a later plan, a hand-over) takes the `staff-money` lock. It is the first statement in the transaction, before
any person or balance is read, so two transfers at the same moment can never spend the same money twice. Expense, payment and refund
saves do not take it: they may already take a balance below zero (D-15, D-16), and a race test proves a transfer still never
overdraws. A lock that cannot be had within 10 seconds answers `409` with `Something changed at the same time. Try again.`

## Errors

Errors are RFC 9457 Problem Details, the same as the rest of the API. `GET /staff-money/me` has only `401` (the token names no usable
account). The error values `staff-money.not-found` and `staff-money.forbidden` are defined and used when the routes that return them
arrive; `money-transfers.busy` is the `409` of the transfer route.

## Schema note

The transfers table, `MoneyTransfers`, exists from this plan so that transfers count in the sums. It has two checks, not triggers:
the amount is more than zero, and the sender is not the recipient. A standing lock row, `staff-money`, is seeded for the transfer
routes that come later.

---
created: 2026-11-07T05:20:00-06:00
updated: 2026-11-07T23:10:00-06:00
---

# The staff money API

This is the contract behind the money each staff member holds, and the one a future Android app will use. Everything here is under
`/api/v1`. The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of this
page; the web app's types are generated from it (`web/src/types/api.generated.ts`). Sign-in and the access token are in
[auth.md](auth.md). The ledger, transfer, hand-over, recipients, all-staff, one-person and transfer list routes are below.

## In plain words

1. Every staff member can see how much of the shop's money they hold. We call it **money on hand**.
2. **It is never stored.** No column, table or cache holds a balance, and no route accepts one. The server adds up the records on
   every read, so the figure is always right (MONEY-01).
3. The figure can be **below zero**. That means the shop owes the person money, for example when an expense is larger than what they
   hold, or when an order that held their payment was deleted. Nothing refuses it (D-15, D-16).
4. Both roles use the same route and each person reads only their own figure. The route takes no id. A Manager can also read every
   staff member's figure, ledger and the transfers; an Admin can read only their own (OD-19, MONEY-03). The rules are in the sections below.

## The route

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /staff-money/me` | Staff | none; no query parameters | `200` the caller's money on hand, `401` without a valid token. |

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. The person is the token's subject
(T-10-13). Nothing is cached: the answer carries `Cache-Control: no-store`.

## The answer

```text
{ userId, name, role, status, balance, today }
```

| Field | Meaning |
|---|---|
| `userId` | The signed-in person. |
| `name` | Their name, first then last. |
| `role` | `Admin` or `Manager`. |
| `status` | `active`, `deactivated` or `deleted`. The signed-in person is always `active`. |
| `balance` | Money on hand in pesos, with two decimals. Negative when they are owed money. A person with no money records reads `0.00`. |
| `today` | The business today as `yyyy-MM-dd`, in the business zone. |

Example:

```json
{ "userId": "6f3c2a54-0b9d-4f0e-9f2a-3b1d7c5e8a10", "name": "Liza Mercado", "role": "Admin", "status": "active", "balance": 1100.00, "today": "2026-11-04" }
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
- The sender is checked again under the lock. A sender who has been deactivated, deleted or locked, or who no longer has the `Admin` or
  `Manager` role, since signing in gets `401` `Your session ended. Sign in again.` and nothing is recorded. Money held by a leaver is moved
  only by a Manager hand-over (D-17).
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

Only a transfer and a hand-over take the `staff-money` lock. It is the first statement in the transaction, before
any person or balance is read, so two transfers, or two hand-overs, at the same moment can never spend the same money twice. Expense, payment and refund
saves do not take it: they may already take a balance below zero (D-15, D-16). An expense never checks a balance, so one transfer
racing one expense always matches one serial order. The race tests that can fail are the ones that add a second transfer, with or
without an expense: only the lock stops both from spending the same money. A lock that cannot be had within 10 seconds answers `409` with `Something changed at the same time. Try again.`
The timeout is logged as a warning with its cause. A missing `staff-money` row is a setup fault: it answers `500`, never `409`.

## POST /api/v1/money-transfers/handovers

A Manager moves money held by a deactivated or deleted Admin or Manager to a current coworker (D-17, D-18, MONEY-06). Managers only.

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `POST /money-transfers/handovers` | Manager | `{ fromUserId, toUserId, amount, transferDate, note }` | `201` the saved hand-over and the former staff member's new balance, `400` field errors, `401` without a valid token, `403` for an Admin, `409` when the lock was busy too long, `422` when the `Idempotency-Key` was used with a different body. |

- **The sender is the former staff member named in `fromUserId`.** The signed-in Manager only records the hand-over: the answer says
  `isHandover: true` and `recordedBy` is the Manager. A `createdById`, `createdAtUtc`, `updatedById`, `updatedAtUtc` or `isHandover`
  in the body is ignored (SEC-08).
- The Manager is read again under the lock. A Manager who has been deactivated, deleted or locked, or who is no longer a Manager, since
  signing in gets `401` `Your session ended. Sign in again.` and nothing is recorded.
- `transferDate` is `yyyy-MM-dd`, any past day up to today. The amount is at least `0.01`, has at most two decimals and is at most what
  the former staff member holds now (D-18).
- **The coworker must be an active Admin or Manager.** A person a Manager has locked, or who has not finished set-up, can receive (D-56).
  A former staff member cannot receive a hand-over, even one who is owed money.
- Send an `Idempotency-Key` header. The same key and body twice records one hand-over and one audit entry, and the second answer
  replays the stored `201`. The same key with a different body answers `422`.
- The answer is `{ transfer, senderBalance }`, the same shape as a transfer. `senderBalance` is the former staff member's balance after
  the hand-over. It never carries the coworker's balance.
- One audit entry, `money-transfer.handed-over`, is written in the same save, with the Manager as actor. Its detail holds ids, the
  amount, the date and `note=yes` or `note=no`, never the note text or a name (D-52). See
  [the audit log](../operations/audit-log.md).

### Hand-over refusals (all `400` under the named field)

| Field | Message |
|---|---|
| `fromUserId` | `Choose whose money to hand over.` (missing) |
| `fromUserId` | `Only money held by former staff can be handed over.` (an active person, the legacy placeholder, a non-staff account or an unknown id) |
| `toUserId` | `Choose who got the cash.` (missing) |
| `toUserId` | `Choose someone other than {name}.` (the former staff member) |
| `toUserId` | `{name} can't receive transfers now. Choose someone else.` (a deactivated or deleted person) |
| `toUserId` | `This person can't receive transfers now. Choose someone else.` (unknown id, the legacy placeholder, or a non-staff account) |
| `amount` | `Enter the amount.`, `Enter an amount of at least ₱0.01.`, `Use at most 2 decimal places.` |
| `amount` | `{name} has nothing on hand to hand over.` (at or below `0.00`) |
| `amount` | `{name} only has {₱2,000.00} on hand.` (above what they hold) |
| `transferDate` | `Enter the transfer date.`, `Enter a real date.`, `The transfer date can't be in the future.` |
| `note` | `Keep the note to 200 characters or fewer.` |

An empty body lists `fromUserId`, `toUserId`, `amount` and `transferDate` together. The two server-only lines, `Choose whose money to
hand over.` and `Only money held by former staff can be handed over.`, are never shown by the web window (D-58).

## GET /api/v1/money-transfers/recipients

Who the transfer window may offer in its To list (D-19, D-49, D-56). Both roles use it.

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /money-transfers/recipients` | Staff | none | `200` a list of `{ id, name, status, isYou }`, `401` without a valid token. |

- First every **active** Admin and Manager, a person a Manager has locked and a person who has not finished set-up included. The
  signed-in person is there with `isYou: true`. `status` is `active`.
- Then every **deactivated or deleted** Admin or Manager whose balance is **below zero** (the shop owes them money), with `status`
  `deactivated` or `deleted`. These are the people a transfer can bring back to `0.00` (D-19).
- Each group is sorted by first name, last name, then id.
- **No entry carries a figure.** There is no balance, no amount and no owed number, for any caller (D-49, OD-19). A former staff member
  who holds money or is at `0.00` is not listed. The legacy placeholder and accounts with no staff role never appear.
- Nothing is cached: the answer carries `Cache-Control: no-store`.

## GET /api/v1/staff-money/me/ledger

The signed-in person's own money rows, one page at a time, newest first, each with the running balance after it (MONEY-02, D-41). Both
roles use it, and each reads only their own ledger: the route takes no id. Another person's ledger is
`GET /staff-money/{userId}/ledger`, described below.

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /staff-money/me/ledger?page=&pageSize=&deleted=` | Staff | none | `200` the page, `400` for a bad page or page size, `401` without a valid token, `403` for an Admin who sends `deleted=true`. |

| Parameter | Meaning |
|---|---|
| `page` | The page number, `1` to `100000`. Default `1`. |
| `pageSize` | Rows per page, `1` to `100`. Default `20`. |
| `deleted` | `true` to add deleted transfers. Managers only. Default `false`. |

A page outside those limits answers `400` with the shared list words under the field: `Use a page from 1 to 100000.` under `page` and
`Use a page size from 1 to 100.` under `pageSize` (SEC-03).

### The answer

```text
{ items, total, page, pageSize, balance, includesDeleted }
```

`balance` is the person's money on hand now, the same figure as `GET /staff-money/me`. `total` counts the rows of every page. A person with no money rows
gets `items: []`, `total: 0` and `balance: 0.00`.

Each item is one row:

| Field | Meaning |
|---|---|
| `kind` | `payment-received`, `refund-handed-back`, `transfer-in`, `transfer-out`, `company-expense` or `order-expense`. |
| `date`, `recordedAtUtc` | The day the money moved, and when the row was recorded. |
| `moneyIn`, `moneyOut` | The amount in pesos in one of them; the other is `null`. Payments and transfers in are money in. |
| `balanceAfter` | The balance after this row, like a bank statement. `null` for a deleted transfer. |
| `orderId`, `orderNumber`, `team`, `customer` | Payments, refunds and order expenses: the order. `team` is `null` when the order has none. |
| `paymentMethod` | Payments: the method. |
| `category`, `description` | Company and order expenses. `description` is `null` when none was given. |
| `counterpart`, `note`, `transferId`, `version`, `isHandover`, `recordedBy` | Transfers: the other person (`{ id, name, formerStaff }`), the note, the transfer id and its version, the hand-over mark, and who recorded it. A hand-over is a transfer with `isHandover: true` and `recordedBy` the Manager. |
| `isDeleted`, `deletedBy`, `deletedAtUtc` | A deleted transfer: `isDeleted` is `true` and the other two say who and when. |

Fields a kind does not use are `null` (and `isHandover` and `isDeleted` are `false`).

### The running balance

Every `balanceAfter` is worked out on the server; the browser never adds anything up (MONEY-02).

1. The balance after the **newest row of the page** is the current balance minus the sum of the rows newer than the page.
2. Going down the page, each next row's balance is the previous row's balance minus the previous row's signed amount.

So the newest row of page 1 has `balanceAfter` equal to `balance`, page 2 starts exactly where page 1 ended, and the oldest row of the
last page ends on its own signed amount. The order is date (newest first), then the time recorded (newest first), then kind, then id, so
within one read the order is stable and a tie never reorders.

Paging is by offset, and each page is a separate request. Between two page requests a newly recorded row can shift older rows to the next
page, so a row can show twice or be missed. A back-dated row also changes the `balanceAfter` of every row newer than it, so figures read on an earlier page can be out of date. A client that
needs a steady view should read page 1 again before it trusts a long walk.

The page, the sum of the newer rows, the count and the balance are read inside one serializable read transaction (D-105), so a row
recorded at the same moment cannot make them disagree. A page costs the same number of database commands at any page size.

### Deleted transfers (D-23, D-30, D-31)

- A deleted transfer counts toward no balance. With `deleted=false` (the default) it is not in the ledger at all.
- A **Manager** can send `deleted=true` to see deleted transfers in their own ledger. Each shows `isDeleted: true`, `deletedBy`,
  `deletedAtUtc`, its face amount in `moneyIn` or `moneyOut`, and `balanceAfter: null`. Every other row's `balanceAfter` is the same
  as without the flag. `includesDeleted` is `true`.
- An **Admin** who sends `deleted=true` gets `403` `Only Managers can see deleted transfers.` before anything is read. An Admin's
  ledger never contains a deleted transfer or anything about one (D-31, D-32).
- Nothing is cached: the answer carries `Cache-Control: no-store`.

## GET /api/v1/staff-money

What every staff member holds, with the total held by staff, for Managers only (MONEY-03, D-42 to D-44, D-56).

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /staff-money` | Manager | none; no query parameters | `200` the people and the total, `401` without a valid token, `403` for an Admin. |

```text
{ items: [{ userId, name, role, status, balance, isYou }], total }
```

- First every **active** Admin and Manager, by first name, last name, then id. A person a Manager has locked, and a person who has not
  finished set-up, are listed as `active` (D-56). The signed-in person has `isYou: true`.
- Then every **deactivated or deleted** Admin or Manager whose balance is **not** `0.00`, by name, with `status` `deactivated` or
  `deleted`. A leaver at `0.00` is not listed (D-43).
- `balance` is the person's money on hand; it is negative when the shop owes them money.
- `total` is the sum of the listed balances, the **total held by staff** (D-44). It can be below zero. A shop with one Manager answers
  one row and a `total` equal to it.
- The legacy placeholder and accounts with no staff role never appear. There is no paging: every row is in one answer.
- Nothing is cached: the answer carries `Cache-Control: no-store`.

## GET /api/v1/staff-money/{userId}

One named person's money on hand (MONEY-03, OD-19). The answer has the same shape as `GET /staff-money/me`.

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /staff-money/{userId}` | Staff | none; no query parameters | `200` the figure, `401` without a valid token, `403` for an Admin asking about someone else, `404` for a Manager asking about no staff member. |

- **The role is decided first, from the token alone** (CWE-639, CWE-204). An Admin who names any id but their own gets `403` `You can only see
  your own money.` before anything about that id is looked up, so a real coworker and a made-up id look exactly the same.
- An Admin who names their own id gets the same answer as `GET /staff-money/me`.
- A Manager can name any Admin or Manager, current or former. The answer has `role` and `status` (`active`, `deactivated` or
  `deleted`).
- A Manager who names an unknown id, the legacy placeholder or an account with no staff role gets `404` `This person wasn't found.`
- Nothing is cached: the answer carries `Cache-Control: no-store`.

## GET /api/v1/staff-money/{userId}/ledger

One named person's ledger, with the same query parameters, answer and running balance as `GET /staff-money/me/ledger`.

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /staff-money/{userId}/ledger?page=&pageSize=&deleted=` | Staff | none | `200` the page, `400` for a bad page or page size, `401` without a valid token, `403` for an Admin, `404` for a Manager asking about no staff member. |

- The access rule is the one above: an Admin may name only their own id and gets `403` for any other, real or made up, before any
  lookup; a Manager may name any Admin or Manager and gets `404` for anyone else.
- Only a Manager may send `deleted=true`. An Admin who sends it gets `403`, for their own id as well as for any other.
- A deactivated or deleted person keeps their ledger and balance; a Manager can read both.
- Nothing is cached: the answer carries `Cache-Control: no-store`.

## GET /api/v1/money-transfers

The staff money transfers, newest first (MONEY-03, D-31, D-48).

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /money-transfers?page=&pageSize=&deleted=` | Staff | none | `200` the page, `400` for a bad page or page size, `401` without a valid token, `403` for an Admin who sends `deleted=true`. |

| Parameter | Meaning |
|---|---|
| `page` | The page number, `1` to `100000`. Default `1`. |
| `pageSize` | Rows per page, `1` to `100`. Default `20`. |
| `deleted` | `true` to add deleted transfers. Managers only. Default `false`. |

A page outside those limits answers `400` with the shared list words under the field (SEC-03).

```text
{ items, total, page, pageSize }
```

- The order is transfer date (newest first), then the time recorded (newest first), then id.
- A **Manager** sees every transfer. An **Admin** sees only the transfers they sent or received, a hand-over to them included.
- Each item has `id`, `from` and `to` (`{ id, name, formerStaff }`), `amount`, `transferDate`, `note`, `isHandover`, `recordedBy`,
  `recordedAtUtc`, `isDeleted`, `deletedBy`, `deletedAtUtc` and `version`. **It never carries a balance.**
- Deleted transfers are left out unless a Manager sends `deleted=true`. Then each shows `isDeleted: true` with who deleted it and when.
  An Admin who sends `deleted=true` gets `403` `Only Managers can see deleted transfers.` before anything is read, and an Admin's
  list never holds a deleted transfer (D-31).
- Nothing is cached: the answer carries `Cache-Control: no-store`.

## Errors

Errors are RFC 9457 Problem Details, the same as the rest of the API. `GET /staff-money/me` has only `401` (the token names no usable
account). `staff-money.forbidden` (`403`, `You can only see your own money.`) is an Admin naming someone else, and
`staff-money.person-not-found` (`404`, `This person wasn't found.`) is a Manager naming no staff member. `staff-money.not-found` is
defined and not yet used; `money-transfers.busy` is the `409` of the transfer route. The ledger routes add
`staff-money.invalid-request` (`400`) and `staff-money.deleted-forbidden` (`403`); the transfer list uses `money-transfers.invalid-request`
(`400`) and `staff-money.deleted-forbidden` (`403`).

## Schema note

The transfers table, `MoneyTransfers`, exists from this plan so that transfers count in the sums. It has two checks, not triggers:
the amount is more than zero, and the sender is not the recipient. A standing lock row, `staff-money`, is seeded for the transfer
routes that come later.

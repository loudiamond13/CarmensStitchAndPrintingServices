---
created: 2026-10-28T10:45:00-05:00
updated: 2026-10-28T12:45:00-05:00
---

# The orders API

This is the contract behind the Orders screens, and the one a future Android app will use. Everything here is under `/api/v1`.
The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of this page;
the web app's types are generated from it (`web/src/types/api.generated.ts`). Sign-in and the access token are in
[auth.md](auth.md). The order lists (product types, payment methods, order expense categories) are in
[order-lists.md](order-lists.md). This page covers what exists today: creating an order, reading it back, editing its details and adding, editing and removing items. Later plans add the
list, payment, discount, expense, status and delete routes to this page.

## In plain words

1. An order is the parent. Its items, status history and money figures live inside it.
2. The server decides everything. It gives the order its number, works out every money figure and records who created it. The
   web app only shows the answer.
3. The number is `ORD-{YYYY}-{NNNN}`. The year is the business year of the moment the order is saved (D-23), never the order
   date. The first order of a year is `0001`. After `9999` the number gets a fifth digit and is never cut short.
4. A new order can start as Pending, Mockup, In Production, Ready or Delivered. Completed and Cancelled are refused at create
   (D-22): create the order first, then complete or cancel it.
5. Payments, discounts and order expenses join the create body in later plans. Until then an order has items only, so the
   balance equals the total.

## Routes

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `POST /orders` | Staff | the order form below, with an `Idempotency-Key` | `201` the order, with `Location: /api/v1/orders/{id}`; `400` field errors; `409 orders.busy` |
| `GET /orders/{id}` | Staff | none | `200` the order; `404 orders.not-found` |
| `PUT /orders/{id}` | Staff | the details form below, with the `version` | `200` the order as saved; `400` field errors; `404 orders.not-found`; `409 edit.stale` |
| `POST /orders/{id}/items` | Staff | the item form below, with the `version` and an `Idempotency-Key` | `200` the whole order; `400` field errors; `404 orders.not-found`; `409 edit.stale`; `422 orders.too-many-items` |
| `PUT /orders/{id}/items/{itemId}` | Staff | the item form below, with the `version` | `200` the whole order; `400` field errors; `404 orders.not-found` or `orders.item-not-found`; `409 edit.stale` |
| `DELETE /orders/{id}/items/{itemId}` | Staff | none | `200` the whole order; `404 orders.not-found` or `orders.item-not-found`; `409 edit.stale`; `422 orders.last-item` |

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. No token is `401`. Both roles
read every order. No answer is ever cached (`Cache-Control: no-store`).

## The order form (`POST /orders`)

| Field | Required | Rule | Message |
|---|---|---|---|
| `customerName` | yes | 1 to 100 characters after trimming | Enter the customer's name. / Keep the customer name to 100 characters or fewer. |
| `teamName` | no | up to 100 characters | Keep the team name to 100 characters or fewer. |
| `contactNumber` | yes | up to 30 characters; digits, spaces and `+ - ( )` only | Enter a contact number. / Keep the contact number to 30 characters or fewer. / Use digits, spaces and + - ( ) only. |
| `email` | no | up to 254 characters; a real address | Keep the email to 254 characters or fewer. / Enter a valid email address. |
| `address` | no | up to 300 characters | Keep the address to 300 characters or fewer. |
| `orderDate` | yes | a real `yyyy-MM-dd` date | Enter the order date. / Enter a real date. |
| `dueDate` | yes | a real `yyyy-MM-dd` date, on or after `orderDate` | Enter the due date. / Enter a real date. / The due date can't be before the order date. |
| `status` | no | `pending` (default), `mockup`, `production`, `ready` or `delivered` | Choose a status. / Create the order first, then complete or cancel it. |
| `notes` | no | up to 2,000 characters | Keep notes to 2,000 characters or fewer. |
| `items` | yes | 1 to 100 items | Add at least one item. / An order can have at most 100 items. |

Each item:

| Field | Required | Rule | Message |
|---|---|---|---|
| `productTypeId` | yes | an existing product type that is not retired (D-18) | Choose a product type. / This product type was retired. Choose another one. |
| `description` | yes | 1 to 200 characters after trimming | Describe the item. / Keep the description to 200 characters or fewer. |
| `sizeVariant` | no | up to 100 characters | Keep the size or variant to 100 characters or fewer. |
| `quantity` | yes | a whole number from 1 to 10,000 | Enter a quantity from 1 to 10,000. |
| `unitPrice` | yes | from 0.00 to 1,000,000.00, at most 2 decimal places (D-30) | Enter a unit price. / Enter a unit price from ₱0.00 to ₱1,000,000.00. / Use at most 2 decimal places. |

Text is trimmed, and empty optional text is stored as `null`. Every rule is checked twice, by the validators and again by the
order itself, so no caller can skip one. Any other member in the body, such as `createdById`, `createdAt`, `updatedById`,
`number`, `totals`, `statusHistory`, `deletedAtUtc` or `version`, is ignored.

### Field errors

A bad form answers `400` with the code `orders.invalid-request`, the text "Check the highlighted fields." and an `errors` object
that lists **every** broken field, not just the first. Item fields use a camelCase path with the item's place, for example
`items[1].quantity` or `items[0].productTypeId`. The product type check (does it exist, is it retired) is made against the
database and is merged into the same `400`.

### The Idempotency-Key

`POST /orders` needs an `Idempotency-Key` header with a fresh UUID. A missing or malformed key is `400 idempotency.key-missing`.
A retry with the same key and body answers with the stored `201` (and the header `Idempotent-Replayed: true`) and creates
nothing more: one order, one number, one audit entry. The same key with a different body is refused.

### When the number lock is busy

Every create takes the order number lock first, so two creates can never get the same number. A wait that times out (about
10 seconds) answers `409 orders.busy`, "Orders are being saved right now. Try again in a moment." Nothing was saved; send the
form again.

## Editing the details (`PUT /api/v1/orders/{id}`)

This saves the customer details, the two dates and the notes of one order. Items, status, number and money figures are not
changed here; each has its own route.

| Field | Required | Rule |
|---|---|---|
| `customerName`, `teamName`, `contactNumber`, `email`, `address`, `orderDate`, `dueDate`, `notes` | as in the order form above | the same rules and the same messages as `POST /orders` |
| `version` | yes | the `version` the form was opened with: base64 of eight bytes. Anything else is `400` on `version`, "Reload the form and try again." |

- **The due date is required on every edit (D-22).** An imported order may have none, but it cannot be saved again until a due
  date is entered.
- **Any staff member may edit any order (D-25).** An Admin edits an order a Manager recorded, and the reverse. There is no
  own-order rule and no `canEdit` flag.
- **The version contract (ORD-08, SEC-07).** The `version` is the order's row version. If it is not the stored one, nothing is
  saved and the answer is `409 edit.stale`, "This was changed by someone else. Reload and try again." The same answer comes when
  two saves with the same version arrive together: exactly one wins and the other gets the `409`. The server never retries a
  form save; the person reloads and decides.
- **A save that changes nothing** answers `200`, keeps the `version`, writes no audit entry and leaves `lastChangedBy` and
  `lastChangedAt` as they were. Text that differs only in spaces counts as no change.
- **Who changed it (SEC-08).** After a real change `lastChangedBy` is the editor and `lastChangedAt` comes from the server
  clock. `recordedBy` stays the person who created the order. Any attribution, `number`, `status`, `totals` or `items` member in
  the body is ignored.
- A deleted or unknown id is `404 orders.not-found`. A bad form lists every broken field in one `400`, as when creating.

## Items (`/api/v1/orders/{id}/items`)

Staff add, correct and remove the items of a saved order. Every answer is the whole order, with every money figure worked out
again by the server and a new `version`.

| Field | Required | Rule |
|---|---|---|
| `productTypeId` | yes | a product type that exists. A new item, or an edit that changes the type, needs one that is not retired (D-18): "This product type was retired. Choose another one." An edit that keeps the type it already has is allowed even if the type was retired later (D-19) |
| `description` | yes | 1 to 200 characters after trimming |
| `sizeVariant` | no | up to 100 characters |
| `quantity` | yes | 1 to 10,000 |
| `unitPrice` | yes | 0.00 to 1,000,000.00 with at most two decimal places |
| `version` | add and edit | the order's `version` as last read: base64 of eight bytes. Anything else is `400` on `version`, "Reload the form and try again." |

- **The rules and messages are the same as in the order form** (D-30). Errors are on the plain field name, for example `quantity`.
- **The version contract (ORD-08).** Any item change moves the order's version, so a change to an item alone still counts as a
  change to the order. Two adds or edits that carry the same version give exactly one `200`; the other is `409 edit.stale`,
  "This was changed by someone else. Reload and try again." Nothing of the loser is stored. Add and edit are never retried.
- **Remove sends no version.** It acts on the latest state. If it loses a race it is read again and decided again once; only a
  second lost race is `409 edit.stale`. Two removals of different items both succeed when two or more items would remain; when
  only one would remain, one succeeds and the other is `422`.
- **At least one item (`422 orders.last-item`).** "An order needs at least one item. Add another item before removing this one."
- **At most 100 items (`422 orders.too-many-items`).** "An order can have at most 100 items."
- **Items are found only through their order (CWE-639).** An item id that is not on the order in the route is
  `404 orders.item-not-found`, "This item was not found on this order." The item of another order is never changed.
- **An edit that changes nothing** answers `200`, keeps the `version` and writes no audit entry.
- **Position.** `items` come in the order they were added. A new item goes after the last one, and a removal leaves the others
  in place.
- **Who changed it (SEC-08).** The item shows who recorded it, and the order shows the caller as last changed. Any attribution,
  `lineTotal` or `totals` member in the body is ignored.
- A retry of an add with the same `Idempotency-Key` and body answers with the stored answer and adds nothing more.

## The order

`POST`, `GET` and `PUT` answer the same shape:

```
{
  id, number, customerName, teamName, contactNumber, email, address,
  orderDate, dueDate, status, statusChangedAt, notes,
  items: [ { id, productType: { id, name, tone, retired }, description, sizeVariant, quantity, unitPrice, lineTotal } ],
  statusHistory: [ { from, to, changedBy, changedAt } ],
  totals: { subtotal, discount, total, paid, refunded, balance, customerCredit, expenses, profit, fullyPaid },
  recordedBy, recordedAt, lastChangedBy, lastChangedAt, version
}
```

- `status` and the `from` and `to` of the history are the wire keys: `pending`, `mockup`, `production`, `ready`, `delivered`,
  `completed`, `cancelled`. The first history row has `from: null` and `to` the created status, by the caller, at the save time
  (ORD-16, D-06).
- `totals` are read from the figures stored with the order, and only `OrderMath` works them out (ORD-20). `subtotal` is before
  discount, `total` is after discount (subtotal minus discount), `balance` is total minus paid plus refunded, and
  `customerCredit` is what the shop owes the customer (the balance below zero, as a positive amount; `0.00` otherwise).
  `fullyPaid` is true when the subtotal is above zero and the balance is zero or less. The five items of ORD-2026-0148 give a
  subtotal of `22450.00`.
- `recordedBy` is the staff member who created the order, `null` reads as **System**; `lastChangedBy` and `lastChangedAt` are
  `null` until a change. A person whose account was deleted keeps their name with `formerStaff: true`.
- `productType.retired` is true when a Manager later retired the type; old orders keep showing it.
- `version` is the base64 of the eight-byte row version a later save must send back.

A deleted or unknown order is the same `404 orders.not-found`, "This order was not found or was deleted."

## The audit entries (D-31)

Each create writes one `order.created` entry for the order, in the same save: `number=<n>;status=<key>;orderDate=<date>;dueDate=<date>;items=<count>;total=<amount>`.
Each details edit that changes something writes one `order.changed` entry in the same save: `orderDate=<old>><new>` and
`dueDate=<old>><new>` for the dates that changed, then `fields=` naming the customer details and notes that changed (for example
`fields=customerName,notes`). An imported order that had no due date shows an empty old value: `dueDate=><new>`.
Neither entry ever holds the customer name, team, contact number, email, address or notes. The full list of order audit codes is in
[../operations/audit-log.md](../operations/audit-log.md).

## What is stored (D-23, D-26)

- `Orders`, `OrderItems`, `OrderStatusChanges` and `OrderNumberCounters` come from the migration `AddOrders`.
- The order carries `DeletedAtUtc` and `DeletedById` from the start (D-26), and a named `SoftDelete` query filter hides a deleted
  order, its items and its history from every default query.
- The stored money figures must agree: the database checks that total equals subtotal minus discount, that balance equals total
  minus paid plus refunded, and that customer credit equals the balance below zero.
- `OrderNumberCounters` keeps the last number given out in each business year. The counter and the lock row `order-numbers` are
  used inside the create transaction, so a failed create gives its number back and numbers have no gaps.

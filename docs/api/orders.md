---
created: 2026-10-28T10:45:00-05:00
updated: 2026-10-28T23:00:00-05:00
---

# The orders API

This is the contract behind the Orders screens, and the one a future Android app will use. Everything here is under `/api/v1`.
The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of this page;
the web app's types are generated from it (`web/src/types/api.generated.ts`). Sign-in and the access token are in
[auth.md](auth.md). The order lists (product types, payment methods, order expense categories) are in
[order-lists.md](order-lists.md). This page covers what exists today: creating an order, reading it back, editing its details, adding, editing and removing items, giving, changing and removing discounts, recording, correcting and removing payments, recording, correcting and removing
order expenses, recording, correcting and removing refunds, and moving an order between statuses, deleting, restoring and purging orders, and finding orders in the list. The order screens (ORD-01, ORD-02) come in Phase 8, which makes them true end to end; this page is the server side.

## In plain words

1. An order is the parent. Its items, status history and money figures live inside it.
2. The server decides everything. It gives the order its number, works out every money figure and records who created it. The
   web app only shows the answer.
3. The number is `ORD-{YYYY}-{NNNN}`. The year is the business year of the moment the order is saved (D-23), never the order
   date. The first order of a year is `0001`. After `9999` the number gets a fifth digit and is never cut short.
4. A new order can start as Pending, Mockup, In Production, Ready or Delivered. Completed and Cancelled are refused at create
   (D-22): create the order first, then complete or cancel it.
5. Payments and expenses can be sent in the create body; an order with no payments has a balance equal to its total after discount.

## Routes

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `POST /orders` | Staff | the order form below, with an `Idempotency-Key` | `201` the order, with `Location: /api/v1/orders/{id}`; `400` field errors; `409 orders.busy` |
| `GET /orders?q=&status=&from=&to=&productType=&hasBalance=&sort=&page=&pageSize=` | Staff | none | `200` the list page; `400` field errors |
| `GET /orders/{id}` | Staff | none | `200` the order; `404 orders.not-found` |
| `PUT /orders/{id}` | Staff | the details form below, with the `version` | `200` the order as saved; `400` field errors; `404 orders.not-found`; `409 edit.stale` |
| `POST /orders/{id}/items` | Staff | the item form below, with the `version` and an `Idempotency-Key` | `200` the whole order; `400` field errors; `404 orders.not-found`; `409 edit.stale`; `422 orders.too-many-items` |
| `PUT /orders/{id}/items/{itemId}` | Staff | the item form below, with the `version` | `200` the whole order; `400` field errors; `404 orders.not-found` or `orders.item-not-found`; `409 edit.stale`; `422 orders.discount-above-subtotal` |
| `DELETE /orders/{id}/items/{itemId}` | Staff | none | `200` the whole order; `404 orders.not-found` or `orders.item-not-found`; `409 edit.stale`; `422 orders.last-item` or `orders.discount-above-subtotal` |
| `POST /orders/{id}/discounts` | Staff | the discount form below, with the `version` and an `Idempotency-Key` | `200` the whole order; `400` field errors; `404 orders.not-found`; `409 edit.stale`; `422 orders.too-many-discounts` |
| `PUT /orders/{id}/discounts/{discountId}` | Staff | the discount form below, with the `version` | `200` the whole order; `400` field errors; `404 orders.not-found` or `orders.discount-not-found`; `409 edit.stale` |
| `DELETE /orders/{id}/discounts/{discountId}` | Staff | none | `200` the whole order; `404 orders.not-found` or `orders.discount-not-found`; `409 edit.stale` |
| `POST /orders/{id}/payments` | Staff | the payment form below, with the `version` and an `Idempotency-Key` | `200` the whole order; `400` field errors; `404 orders.not-found`; `409 edit.stale`; `422 orders.too-many-payments` |
| `PUT /orders/{id}/payments/{paymentId}` | Staff | the payment form below, with the `version` | `200` the whole order; `400` field errors; `404 orders.not-found` or `orders.payment-not-found`; `409 edit.stale`; `422 orders.payment-below-refunds` |
| `DELETE /orders/{id}/payments/{paymentId}` | Staff | none | `200` the whole order; `404 orders.not-found` or `orders.payment-not-found`; `409 edit.stale`; `422 orders.payment-below-refunds` |
| `POST /orders/{id}/expenses` | Staff | the expense form below, with the `version` and an `Idempotency-Key` | `200` the whole order; `400` field errors; `404 orders.not-found`; `409 edit.stale`; `422 orders.too-many-expenses` |
| `PUT /orders/{id}/expenses/{expenseId}` | Staff | the expense form below, with the `version` | `200` the whole order; `400` field errors; `404 orders.not-found` or `orders.expense-not-found`; `409 edit.stale` |
| `DELETE /orders/{id}/expenses/{expenseId}` | Staff | none | `200` the whole order; `404 orders.not-found` or `orders.expense-not-found`; `409 edit.stale` |
| `POST /orders/{id}/refunds` | Staff | the refund form below, with the `version` and an `Idempotency-Key` | `200` the whole order; `400` field errors; `404 orders.not-found`; `409 edit.stale`; `422 orders.refund-not-allowed`, `orders.too-many-refunds` or `orders.locked` |
| `PUT /orders/{id}/refunds/{refundId}` | Staff | the refund form below, with the `version` | `200` the whole order; `400` field errors; `404 orders.not-found` or `orders.refund-not-found`; `409 edit.stale`; `422 orders.locked` |
| `DELETE /orders/{id}/refunds/{refundId}` | Staff | none | `200` the whole order; `404 orders.not-found` or `orders.refund-not-found`; `409 edit.stale`; `422 orders.locked` |
| `POST /orders/{id}/status` | Staff | `{ "status": "mockup" }` with an `Idempotency-Key` and no version | `200` the whole order; `400` on `status`; `404 orders.not-found`; `409 edit.stale` (two lost races); `422 orders.complete-balance-owed`, `orders.complete-credit` or `orders.reopen-first` |
| `DELETE /orders/{id}` | Staff | none | `204`; `404 orders.not-found` (also for an order that is already deleted); `409 edit.stale` (two lost races) |
| `GET /orders/deleted?page=&pageSize=` | Manager | none | `200` the deleted list; `400` for a bad page or page size; `403` for an Admin |
| `POST /orders/{id}/restore` | Manager | none, with an `Idempotency-Key` | `204`; `403` for an Admin; `404 orders.not-found` (also for an order that is not deleted); `409 edit.stale` |
| `DELETE /orders/{id}/permanent?confirm=` | Manager | none | `204`; `400` on `confirm`; `403` for an Admin; `404 orders.not-found`; `409 edit.stale` |

Every route above that changes an order's details, items, discounts, payments or expenses also answers `422 orders.locked` while the order is
Completed or Cancelled (see Statuses below). The refund routes are the one exception: they work on a Cancelled order and answer
`422 orders.locked` only on a Completed one.

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. No token is `401`. Both roles
read every order. No answer is ever cached (`Cache-Control: no-store`).

## Listing and searching (`GET /api/v1/orders`) (ORD-01, ORD-02)

Both roles may list. Every part of the query is optional. The answer is `{ items, total, page, pageSize }`, where `total` counts
every page of the filter. Deleted orders never appear and never count. The order screens that use this list come in Phase 8.

| Parameter | What it does | Default | Refused when |
|---|---|---|---|
| `q` | Finds orders whose number, customer name, team or contact number contain the text. A typed `%`, `_` or `[` is an ordinary character. | no search | longer than 100 characters ("Use 100 characters or fewer.") |
| `status` | `active`, `all`, or one of `pending`, `mockup`, `production`, `ready`, `delivered`, `completed`, `cancelled`. `active` keeps Pending to Delivered, plus Completed and Cancelled orders whose status changed in the last 30 days. | `active` | not one of those ("Choose a status.") |
| `from`, `to` | Keeps orders whose order date is on or after `from` and on or before `to`, as `yyyy-MM-dd`. Either may be sent alone. | no dates | not a real day ("Enter a real date."); `to` before `from` ("The end date can't be before the start date.") |
| `productType` | A product type id. Keeps orders with at least one item of that type; an order shows once however many such items it has. | all | not a dashed id ("Choose a product type.") |
| `hasBalance` | `true` keeps only orders that still owe money (balance above 0.00). `false` or none keeps all. | all | |
| `sort` | `due` (soonest due first, orders with no due date last), `newest` (latest order date first, then latest recorded), `balance` (largest first) or `total` (largest first). The order id breaks every tie, so pages never overlap. | `due` | not one of those ("Choose a sort order.") |
| `page` | The page number. | `1` | outside 1 to 100000 ("Use a page from 1 to 100000.") |
| `pageSize` | Rows per page. | `20` | outside 1 to 100 ("Use a page size from 1 to 100.") |

Each row has `id`, `number`, `customerName`, `teamName`, `orderDate`, `dueDate` (null when an imported order had none), `status`
(the wire key), `statusChangedAt`, and the stored money figures `subtotal`, `discount`, `total`, `paid`, `refunded`, `balance`,
`customerCredit` and `fullyPaid`. The server reads these figures from what it stored when the order last changed; the list works out
no money. A row never carries contact details, the address or notes. For ORD-2026-0148 the figures are 22,450.00, 1,122.50,
21,327.50, 12,000.00 and 9,327.50 for subtotal, discount, total, paid and balance.

The list runs two SQL commands (the count and the page) whatever the page size, and answers under 300 ms at the 95th percentile on
about five years of orders. How that is proved is in [list-performance.md](../operations/list-performance.md).

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
| `discounts` | no | none to 20 discounts, each as in the discount form below | An order can have at most 20 discounts. |
| `payments` | no | none to 100 payments, each as in the payment form below; together they may not be more than the total after discounts | An order can have at most 100 payments. / The payments would be more than the order total. Lower a payment first. |
| `expenses` | no | none to 100 order expenses, each as in the expense form below | An order can have at most 100 expenses. |

Each item:

| Field | Required | Rule | Message |
|---|---|---|---|
| `productTypeId` | yes | an existing product type that is not retired (D-18) | Choose a product type. / This product type was retired. Choose another one. |
| `description` | yes | 1 to 200 characters after trimming | Describe the item. / Keep the description to 200 characters or fewer. |
| `sizeVariant` | no | up to 100 characters | Keep the size or variant to 100 characters or fewer. |
| `quantity` | yes | a whole number from 1 to 10,000 | Enter a quantity from 1 to 10,000. |
| `unitPrice` | yes | from 0.00 to 1,000,000.00, at most 2 decimal places (D-30) | Enter a unit price. / Enter a unit price from ₱0.00 to ₱1,000,000.00. / Use at most 2 decimal places. |

Each discount in `discounts` has the same three fields and rules as the discount form below (`kind`, `value`, `reason`), without the
`version`. They are saved in the same transaction as the order, in the order given.

Each payment in `payments` has the same six fields and rules as the payment form below (`paymentDate`, `amount`,
`paymentMethodId`, `reference`, `notes`, `receivedByUserId`), without the `version`. They are saved in the same transaction as the
order. The ORD-2026-0148 items with the 5% discount and the two payments (`10000.00` by GCash and `2000.00` in cash) give a
total of `21327.50`, paid `12000.00` and a balance of `9327.50`.

Each expense in `expenses` has the same five fields and rules as the expense form below (`expenseDate`, `orderExpenseCategoryId`,
`description`, `amount`, `paidByUserId`), without the `version`. They are saved in the same transaction as the order. The whole
ORD-2026-0148 aggregate in one call (five items, the 5% discount, the two payments and expenses of `3825.00` Fabric, `1640.00`
Ink & paper and `600.00` Outsourcing) gives subtotal `22450.00`, discount `1122.50`, total `21327.50`, paid `12000.00`, balance
`9327.50`, expenses `6065.00` and profit `15262.50`.

Text is trimmed, and empty optional text is stored as `null`. Every rule is checked twice, by the validators and again by the
order itself, so no caller can skip one. Any other member in the body, such as `createdById`, `createdAt`, `updatedById`,
`number`, `totals`, `statusHistory`, `deletedAtUtc` or `version`, is ignored.

### Field errors

A bad form answers `400` with the code `orders.invalid-request`, the text "Check the highlighted fields." and an `errors` object
that lists **every** broken field, not just the first. Item fields use a camelCase path with the item's place, for example
`items[1].quantity` or `items[0].productTypeId`, and discount fields use `discounts[0].value` in the same way. Payment fields use
`payments[1].receivedByUserId` or `payments[0].amount`, and expense fields use `expenses[0].paidByUserId` or
`expenses[2].expenseDate`. The product type, payment method, receiver, expense category and payer checks (does it exist, is it
retired, may this person be chosen) are made against the database and are merged into the same `400`.

### The Idempotency-Key

`POST /orders` needs an `Idempotency-Key` header with a fresh UUID. A missing or malformed key is `400 idempotency.key-missing`.
A retry with the same key and body answers with the stored `201` (and the header `Idempotent-Replayed: true`) and creates
nothing more: one order, one number, one audit entry. The same key with a different body is refused.

### When orders are being saved (409 `orders.busy`)

Every create takes the order number lock first, so two creates can never get the same number. A wait that times out (about
10 seconds) answers `409 orders.busy`, "Orders are being saved right now. Try again in a moment." So does a save that SQL Server
ended as a deadlock victim (two saves waiting on each other; the database keeps one and stops the other). Nothing was saved; send the
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

## Discounts (`/api/v1/orders/{id}/discounts`)

An order can hold many discounts, up to 20 (D-15). Staff add, correct and remove them on a saved order, and the create body can
carry them in a `discounts` array. Every answer is the whole order, with every money figure worked out again by the server and a
new `version`.

| Field | Required | Rule | Message |
|---|---|---|---|
| `kind` | yes | `fixed` or `percentage` | Choose fixed or percentage. |
| `value` | yes | fixed: more than 0.00 and at most 1,000,000.00. Percentage: more than 0 and at most 100. At most 2 decimal places either way | Enter a discount value. / Enter a discount from ₱0.01 to ₱1,000,000.00. / Enter a percentage above 0 and up to 100. / Use at most 2 decimal places. |
| `reason` | yes | 1 to 100 characters after trimming | Enter a reason for the discount. / Keep the reason to 100 characters or fewer. |
| `version` | add and edit | the order's `version` as last read: base64 of eight bytes. Anything else is `400` on `version`, "Reload the form and try again." | |

- **How a discount is worked out.** A fixed discount is its value. A percentage is that share of the subtotal, rounded to the
  centavo, half away from zero. The discounts are added up and rounded, and `total` is `subtotal` minus that. Only `OrderMath`
  does this sum (ORD-20). The five items of ORD-2026-0148 (`22450.00`) with a 5% "Barangay league discount" give a discount of
  `1122.50`, a total of `21327.50` and a balance of `21327.50`.
- **The discounts never pass the items total (ORD-05).** After every discount add or edit, and after every item edit or removal,
  the discounts added up may not be more than the subtotal, so the total never goes below zero. A discount form that would break
  this is `400` on `value`: "The discounts would be more than the items total. Lower or remove a discount first." In the create
  body the same text is on `discounts`. An item edit or removal that would break it is
  `422 orders.discount-above-subtotal` with the same text. Nothing is saved in any of these cases. Equal is allowed: discounts
  that add up to exactly the subtotal give a total of `0.00`.
- **At most 20 discounts (`422 orders.too-many-discounts`).** "An order can have at most 20 discounts." In the create body,
  more than 20 is a `400` on `discounts`.
- **The version contract (ORD-08).** Any discount change moves the order's version. Two adds or edits that carry the same version
  give exactly one `200`; the other is `409 edit.stale`. Nothing of the loser is stored. Add and edit are never retried.
- **Remove sends no version.** It acts on the latest state. If it loses a race it is read again and decided again once; only a
  second lost race is `409 edit.stale`.
- **Discounts are found only through their order (CWE-639).** A discount id that is not on the order in the route is
  `404 orders.discount-not-found`, "This discount was not found on this order." The discount of another order is never changed.
- **An edit that changes nothing** answers `200`, keeps the `version` and writes no audit entry.
- **Order.** `discounts` come in the order they were added.
- **Who changed it (SEC-08).** The discount shows who recorded it and who last changed it, and the order shows the caller as last
  changed. Any attribution or `totals` member in the body is ignored.
- A retry of an add with the same `Idempotency-Key` and body answers with the stored answer and adds nothing more.

## Payments (`/api/v1/orders/{id}/payments`)

Staff record the money a customer pays, correct it and remove it on a saved order, and the create body can carry payments in a
`payments` array. An order can hold up to 100. Every answer is the whole order, with every money figure worked out again by the
server and a new `version`. Each payment shows **who received the money** (`receivedBy`) apart from **who recorded it**
(`recordedBy`): a payment recorded by an Admin and received by a Manager reads `receivedBy` the Manager and `recordedBy` the Admin
(SEC-08, ORD-22).

| Field | Required | Rule | Message |
|---|---|---|---|
| `paymentDate` | yes | a real `yyyy-MM-dd` date, never after today in the shop's time zone | Enter the payment date. / Enter a real date. / The payment date can't be in the future. |
| `amount` | yes | more than 0.00 and at most 1,000,000.00, at most 2 decimal places (D-30) | Enter the amount. / Enter an amount from ₱0.01 to ₱1,000,000.00. / Use at most 2 decimal places. |
| `paymentMethodId` | yes | an existing payment method that is not retired (D-16) | Choose a payment method. / This payment method was retired. Choose another one. |
| `reference` | no | up to 100 characters | Keep the reference to 100 characters or fewer. |
| `notes` | no | up to 500 characters | Keep notes to 500 characters or fewer. |
| `receivedByUserId` | yes | an active Admin or Manager who has finished set-up (ORD-22) | Choose who received the money. / This person can't be chosen because their account isn't active. Choose someone else. |
| `version` | add and edit | the order's `version` as last read: base64 of eight bytes. Anything else is `400` on `version`, "Reload the form and try again." | |

- **A payment can never pass the balance (D-11).** A new payment may be at most the balance, to the centavo. A payment above it is
  `400` on `amount`: "This is more than the balance. Enter ₱9,327.50 or less." When nothing is owed (the balance is `0.00` or
  below) the text is "Nothing is owed on this order." An edit may lower an amount freely, even when the order is in credit, and may
  raise it only up to the balance plus the amount it had. Nothing is saved when a payment is refused.
- **Other changes may leave a customer credit (D-12).** Removing an item, lowering a quantity or price, or adding or raising a
  discount after payment is allowed. The order then shows `customerCredit` equal to paid minus the new total. For example a
  `9750.00` order paid in full, then a fixed `500.00` discount, has a balance of `-500.00` and a `customerCredit` of `500.00`.
- **Who may be chosen as the receiver (ORD-22, D-32, D-49).** On a new payment, on a changed receiver and in the create body the
  person must be an active Admin or Manager, not locked, not deleted, who has a password and has signed in once. The Legacy holder
  is never chosen. An edit that keeps the saved receiver is allowed even if they were deactivated since: the payment keeps showing
  them, with `receivedByActive: false`, and a deleted person keeps their name with `formerStaff: true`. In the same way a saved
  payment method that was retired since may be kept on an edit, but a new or switched one may not be retired.
- **Payments never drop below refunds (D-09, D-49).** A removal, or an edit that lowers the amount, that would leave the payments
  below the refunds already recorded is `422 orders.payment-below-refunds`, "The refunds would be more than the payments. Lower or
  remove a refund first." Nothing is saved. Lowering to exactly the refunds is allowed. A legacy import keeps its refunds as they
  were (D-47) and is not judged by this rule.
- **Phase 10, money on hand.** A payment counts toward its receiver's money on hand from the moment it is saved. Changing the
  receiver moves it from one person to the other, and that move is its own audit entry. The receiver index carries the amount and
  the date, so Phase 10 reads it without touching the order rows.
- **The version contract (ORD-08).** Any payment change moves the order's version. Two payments sent together with the same version
  give exactly one `200`; the other is `409 edit.stale`, so two people can never together pay more than the balance. Nothing of
  the loser is stored. Add and edit are never retried.
- **Remove sends no version.** It acts on the latest state. If it loses a race it is read again and decided again once; only a
  second lost race is `409 edit.stale`.
- **Payments are found only through their order (CWE-639).** A payment id that is not on the order in the route is
  `404 orders.payment-not-found`, "This payment was not found on this order." The payment of another order is never changed.
- **At most 100 payments (`422 orders.too-many-payments`).** "An order can have at most 100 payments." In the create body, more
  than 100 is a `400` on `payments`.
- **An edit that changes nothing** answers `200`, keeps the `version` and writes no audit entry.
- **Order.** `payments` come oldest payment date first, then in the order they were added.
- A retry of an add with the same `Idempotency-Key` and body answers with the stored answer and adds nothing more.

## Expenses (`/api/v1/orders/{id}/expenses`)

Staff record what an order cost, correct it and remove it on a saved order, and the create body can carry expenses in an
`expenses` array. An order can hold up to 100. Every answer is the whole order, with the expenses and the profit worked out again
by the server and a new `version`. **An expense never changes the balance**: the balance is about what the customer owes, and
profit is the total minus the expenses. Each expense shows **who paid** (`paidBy`) apart from **who recorded it** (`recordedBy`):
an expense recorded by an Admin and paid by a Manager reads `paidBy` the Manager and `recordedBy` the Admin (SEC-08, ORD-23). There
is no company payer: a person always paid.

| Field | Required | Rule | Message |
|---|---|---|---|
| `expenseDate` | yes | a real `yyyy-MM-dd` date: any past day, and up to 30 days after today in the shop's time zone (D-30) | Enter the date. / Enter a real date. / Choose a date up to 30 days from today, Nov 27, 2026 at the latest. |
| `orderExpenseCategoryId` | yes | an existing order expense category that is not retired (D-17) | Choose a category. / This category was retired. Choose another one. |
| `description` | no | up to 200 characters | Keep the description to 200 characters or fewer. |
| `amount` | yes | more than 0.00 and at most 1,000,000.00, at most 2 decimal places (D-30) | Enter an amount greater than ₱0.00. / Enter an amount of ₱1,000,000.00 or less. / Use at most 2 decimal places. |
| `paidByUserId` | yes | an active Admin or Manager who has finished set-up (ORD-23) | Choose who paid. / This person can't be chosen because their account isn't active. Choose someone else. |
| `version` | add and edit | the order's `version` as last read: base64 of eight bytes. Anything else is `400` on `version`, "Reload the form and try again." | |

- **Who may be chosen as the payer (ORD-23, D-32, D-49).** On a new expense, on a changed payer and in the create body the person
  must be an active Admin or Manager, not locked, not deleted, who has a password and has signed in once. The Legacy holder is
  never chosen. An edit that keeps the saved payer is allowed even if they were deactivated since: the expense keeps showing them,
  with `paidByActive: false`, and a deleted person keeps their name with `formerStaff: true`. In the same way a saved category
  that was retired since may be kept on an edit, but a new or switched one may not be retired.
- **Phase 10, money on hand.** An order expense counts against its payer's money on hand from the moment it is saved. Changing the
  payer moves it from one person to the other, and that move is its own audit entry. The payer index carries the amount and the
  date, so Phase 10 reads it without touching the order rows.
- **A cancelled order's expenses still count (D-10).** The expenses stay on the order and in the payer's figures; profit follows
  the cancelled-order rule (D-36).
- **The version contract (ORD-08).** Any expense change moves the order's version. Two changes sent with the same version give
  exactly one `200`; the other is `409 edit.stale`, and nothing of the loser is stored. Add and edit are never retried.
- **Remove sends no version.** It acts on the latest state. If it loses a race it is read again and decided again once; only a
  second lost race is `409 edit.stale`.
- **Expenses are found only through their order (CWE-639).** An expense id that is not on the order in the route is
  `404 orders.expense-not-found`, "This expense was not found on this order." The expense of another order is never changed.
- **At most 100 expenses (`422 orders.too-many-expenses`).** "An order can have at most 100 expenses." In the create body, more
  than 100 is a `400` on `expenses`.
- **An edit that changes nothing** answers `200`, keeps the `version` and writes no audit entry.
- **Order.** `expenses` come oldest expense date first, then in the order they were added.
- A retry of an add with the same `Idempotency-Key` and body answers with the stored answer and adds nothing more.

## Refunds (`/api/v1/orders/{id}/refunds`)

Staff record money handed back to the customer, correct it and remove it on a saved order. An order can hold up to 50. Every answer
is the whole order, with `refunded`, `balance`, `customerCredit` and `profit` worked out again by the server and a new `version`.
`balance` is total minus paid plus refunded, so a refund raises it. Each refund shows **who handed the money back** (`refundedBy`)
apart from **who recorded it** (`recordedBy`), the same split as a payment's receiver (D-07, SEC-08).

| Field | Required | Rule | Message |
|---|---|---|---|
| `refundDate` | yes | a real `yyyy-MM-dd` date, never after today in the shop's time zone | Enter the refund date. / Enter a real date. / The refund date can't be in the future. |
| `amount` | yes | more than 0.00 and at most 1,000,000.00, at most 2 decimal places (D-30), and within the caps below | Enter the amount. / Enter an amount from ₱0.01 to ₱1,000,000.00. / Use at most 2 decimal places. |
| `reason` | yes | 1 to 200 characters after trimming | Add a short reason for the refund. / Keep the reason to 200 characters or fewer. |
| `refundedByUserId` | yes | an active Admin or Manager who has finished set-up (D-07) | Choose who handed the money back. / This person can't be chosen because their account isn't active. Choose someone else. |
| `version` | add and edit | the order's `version` as last read: base64 of eight bytes. Anything else is `400` on `version`, "Reload the form and try again." | |

- **Where a refund is allowed (D-09).** Only on a Cancelled order or on an order that shows a customer credit. Any other active order
  is `422 orders.refund-not-allowed`, "A refund can be recorded only on a cancelled order or one with a customer credit." Any
  staff member (Admin or Manager) may record one.
- **The caps.** On an order that is not cancelled the amount may not pass the customer credit (D-34): `400` on `amount`, "This is more
  than the customer credit. Enter ₱500.00 or less." On a Cancelled order it may not pass what was paid and not yet refunded (D-09):
  "This is more than was paid and not yet refunded. Enter ₱12,000.00 or less." Once everything paid is refunded, "Everything that was
  paid has already been refunded." An edit may lower a refund freely and may raise it up to the cap plus the refund's own old amount.
- **Clearing a credit (D-13).** A refund of the whole credit brings the balance to 0.00, so the order can then be marked Completed.
- **The cancelled-order exception (D-05, D-35).** A Cancelled order accepts refunds being added, edited and removed without a reopen.
  Every other write on it stays `422 orders.locked`. A Completed order refuses all three refund writes with `422 orders.locked`
  until it is reopened. An edit or removal on an active order follows the same lock: only a Completed order refuses it.
- **A cancelled order's profit (D-36, D-10).** Profit is the money kept minus the money spent: `(paid - refunded) - expenses`. For
  ORD-2026-0148 (paid 12,000.00, expenses 6,065.00), a refund of 12,000.00 reads `refunded` 12,000.00 and `profit` -6,065.00: the
  order shows a loss. Every other status keeps total minus expenses.
- **Who may be chosen as the refunder (D-07, D-32, D-49).** On a new refund and on a changed refunder the person must be an active
  Admin or Manager, not locked, not deleted, who has a password and has signed in once. The Legacy holder is never chosen. An edit
  that keeps the saved refunder is allowed even if they were deactivated since: the refund keeps showing them, with
  `refundedByActive: false`, and a deleted person keeps their name with `formerStaff: true`.
- **Phase 10, money on hand (D-08).** A refund lowers its refunder's money on hand from the moment it is saved. This replaces the
  OD-16 default that refunds do not count. Changing the refunder moves it from one person to the other, and that move is its own audit
  entry. The refunder index carries the amount and the date, so Phase 10 reads it without touching the order rows.
- **The version contract (ORD-08).** Any refund change moves the order's version. Two changes sent with the same version give exactly
  one `200`; the other is `409 edit.stale`, and nothing of the loser is stored, so the refunded total never passes its cap. Add and
  edit are never retried.
- **Remove sends no version.** It acts on the latest state. If it loses a race it is read again and decided again once; only a second
  lost race is `409 edit.stale`.
- **Refunds are found only through their order (CWE-639).** A refund id that is not on the order in the route is
  `404 orders.refund-not-found`, "This refund was not found on this order." The refund of another order is never changed.
- **At most 50 refunds (`422 orders.too-many-refunds`).** "An order can have at most 50 refunds."
- **An edit that changes nothing** answers `200`, keeps the `version` and writes no audit entry.
- **Order.** `refunds` come oldest refund date first, then in the order they were added.
- A retry of an add with the same `Idempotency-Key` and body answers with the stored answer and adds nothing more.

## Statuses (`POST /api/v1/orders/{id}/status`)

An order has seven statuses. The wire key is what the API sends and takes; the label is what staff read.

| Key | Label | Kind |
|---|---|---|
| `pending` | Pending | active |
| `mockup` | Mockup | active |
| `production` | In Production | active |
| `ready` | Ready | active |
| `delivered` | Delivered | active |
| `completed` | Completed | end state, locked |
| `cancelled` | Cancelled | end state, locked |

The body is `{ "status": "<key>" }`. A key that is not one of the seven (any case and surrounding spaces are fine) is `400` on `status`,
"Choose a status." No version is sent: the move is judged on the latest state inside the save, so a Complete that races a discount
which creates a credit can never leave a Completed order with money owed or held. A lost race is read again once; a second lost race
is `409 edit.stale`. A retry with the same `Idempotency-Key` and body answers with the stored answer and moves nothing more.

**The transition table (D-01 to D-04, D-38).**

| From | To | Answer |
|---|---|---|
| any active status | any other active status | free move |
| any active status | `cancelled` | allowed, whatever is owed |
| any active status | `completed` | only at a balance of exactly 0.00 (below) |
| `completed` or `cancelled` | any active status | a reopen, for an Admin and for a Manager |
| `completed` | `cancelled` | `422 orders.reopen-first`, "Reopen the order first, then cancel it." |
| `cancelled` | `completed` | `422 orders.reopen-first`, "Reopen the order first, then mark it Completed." |
| the status it already has | same | `200`, nothing written, the `version` kept |

- **Completed needs a zero balance (D-03).** Money owed is `422 orders.complete-balance-owed`, "This order still has ₱9,327.50 to pay.
  Record the payment first." A customer credit is `422 orders.complete-credit`, "This order has a customer credit of ₱100.00. Record
  a refund first."
- **Every real move is recorded (ORD-16, D-06).** A move or a reopen adds a `statusHistory` row (from, to, `changedBy`, `changedAt`),
  sets `statusChangedAt` and moves the `version`. A reopen is recorded the same way as a move.
- **The lock (D-05).** While an order is Completed or Cancelled, every write to its details, items, discounts, payments and expenses
  is `422 orders.locked`, "This order is completed. Reopen it to make changes." (or "cancelled"), and nothing is saved. A form with a field error is
  still `400` first. The lock is then checked before the order's own rules (the payment balance, the last item, the discount cap,
  a missing item id), so those read as locked, not as their own errors. After a reopen the same writes succeed.
  Reading the order is never locked. Refunds are the one write a Cancelled order still takes (see Refunds above).
- **A cancelled order keeps its money (D-07, D-10, D-36).** Every payment stays as collected cash, so `paid` is unchanged and nothing
  is refunded by cancelling. Every expense still counts. Profit on a cancelled order is the cash collected minus the expenses: for
  ORD-2026-0148 (paid 12,000.00, no refunds, expenses 6,065.00) it reads 5,935.00, and reopening it restores 15,262.50. Once the
  12,000.00 is refunded it reads -6,065.00, a loss of its expenses.

## Deleting, restoring and purging (D-26 to D-29)

Who may do what:

| Action | Admin | Manager |
|--------|-------|---------|
| Delete an order (`DELETE /orders/{id}`) | yes | yes |
| See the deleted orders (`GET /orders/deleted`) | `403` | yes |
| Restore a deleted order (`POST /orders/{id}/restore`) | `403` | yes |
| Delete for good (`DELETE /orders/{id}/permanent?confirm=`) | `403` | yes |

- **Delete (D-26, D-27).** Any status can be deleted, locked ones included. The order is only marked: it and its items, payments,
  refunds, discounts, expenses and history stay in the database, but they leave every default read. Afterwards `GET`, `PUT`, the
  status route and every item, discount, payment, expense and refund route answer `404 orders.not-found`, and the order's money counts
  nowhere. Who deleted it and when come from the token and the clock. No version is sent, so a click always acts on the latest state:
  deleting an order that is already deleted is a `404` and changes nothing. A delete that races an item add never leaves a deleted
  order with a new item.
- **The deleted list (D-28).** Newest deleted first, then by id. Each row has `id`, `number`, `customerName`, `teamName`, `status`
  (the wire key it had), `total`, `paid`, `balance`, `deletedAt` and `deletedBy`, with `items`, `total` (the count over every page),
  `page` and `pageSize` around them. `pageSize` is 1 to 100 (20 when not sent) and `page` is 1 to 100000. It never shows contact
  details, the address or notes. It reads in two SQL commands whatever the page size.
- **Restore (D-28).** The order and everything inside it come back, with the same figures. Restoring an order that is not deleted is
  `404 orders.not-found` and writes nothing, so a repeated click never has a second effect. A retry with the same `Idempotency-Key`
  answers with the stored `204`.
- **Delete for good (D-28).** The order and every child row are removed in one step, whether or not it was deleted first. The query
  value `confirm` must be the order number typed exactly, for example `ORD-2026-0148`: the same letters and no spaces around it. A missing
  or different value is `400` on `confirm` ("Type the order number exactly to delete it for good.") and nothing is removed. An unknown id
  is `404` before the confirm is looked at. The audit entry is written in the same save as the delete, so it stays when the rows are gone.
- **Images (ORD-06).** When orders can carry images (Phase 9), deleting an order for good will also schedule the cleanup of its images.
  There are none yet, so nothing is scheduled today.
- **Refunds on a deleted order.** Whether refunds on a deleted order count toward money on hand is still an open question for the owner
  (D-39); it is decided with the money reports in Phase 10. The refund data and the delete filters keep both answers possible.

## The order

`POST`, `GET` and `PUT` answer the same shape, and so do the item, discount, payment, refund, expense and status routes:

```
{
  id, number, customerName, teamName, contactNumber, email, address,
  orderDate, dueDate, status, statusChangedAt, notes,
  items: [ { id, productType: { id, name, tone, retired }, description, sizeVariant, quantity, unitPrice, lineTotal } ],
  discounts: [ { id, kind, value, reason, recordedBy, recordedAt, lastChangedBy, lastChangedAt } ],
  payments: [ { id, paymentDate, amount, method: { id, name, tone, retired }, reference, notes,
                receivedBy, receivedByActive, recordedBy, recordedAt, lastChangedBy, lastChangedAt } ],
  refunds: [ { id, refundDate, amount, reason, refundedBy, refundedByActive,
               recordedBy, recordedAt, lastChangedBy, lastChangedAt } ],
  expenses: [ { id, expenseDate, category: { id, name, tone, retired }, description, amount,
                paidBy, paidByActive, recordedBy, recordedAt, lastChangedBy, lastChangedAt } ],
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
Each item add, edit that changes something, and removal writes one entry for the order (target `Order`, the order id), in the same
save: `order-item.added`, `order-item.changed` and `order-item.removed`, each with `item=<item id>;productType=<id>;quantity=<n>;unitPrice=<amount>`.
A change shows `old>new` on the pairs that changed and ends with `fields=description,sizeVariant` naming the text fields that
changed. A save that changes nothing, and every refusal, writes nothing.
Each discount add, edit that changes something, and removal writes one entry for the order in the same save: `order-discount.added`,
`order-discount.changed` and `order-discount.removed`, each with `discount=<discount id>;kind=<fixed|percentage>;value=<amount>`. A change
shows `old>new` on `kind` and `value` where they changed and ends with `fields=reason` when the reason changed.
Each payment add, edit that changes something, and removal writes one entry for the order in the same save: `order-payment.added`,
`order-payment.changed` and `order-payment.removed`, each with `payment=<payment id>;date=<date>;amount=<amount>;method=<id>;receiver=<id>`.
A change shows `old>new` on the date, amount and method where they changed and ends with `fields=reference,notes` naming the text
fields that changed. A new receiver writes its own `order-payment.receiver-changed` entry, `payment=<payment id>;receiver=<old id>><new id>`,
besides the change entry when anything else changed too.
Each refund add, edit that changes something, and removal writes one entry for the order in the same save: `order-refund.added`,
`order-refund.changed` and `order-refund.removed`, each with `refund=<refund id>;date=<date>;amount=<amount>;refunder=<id>`. A change
shows `old>new` on the date and amount where they changed and ends with `fields=reason` when the reason changed. A new refunder writes
its own `order-refund.refunder-changed` entry, `refund=<refund id>;refunder=<old id>><new id>`, besides the change entry when anything
else changed too.
Each order expense add, edit that changes something, and removal writes one entry for the order in the same save: `order-expense.added`,
`order-expense.changed` and `order-expense.removed`, each with `expense=<expense id>;date=<date>;amount=<amount>;category=<id>;payer=<id>`.
A change shows `old>new` on the date, amount and category where they changed and ends with `fields=description` when the description
changed. A new payer writes its own `order-expense.payer-changed` entry, `expense=<expense id>;payer=<old id>><new id>`, besides
the change entry when anything else changed too.
Each status move writes one `order.status-changed` entry and each reopen from Completed or Cancelled writes one `order.reopened` entry
(never both), in the same save as the history row, each with `status=<from>><to>` by wire key, for example `status=pending>mockup`. A
request for the status the order already has writes nothing.
A delete writes one `order.deleted` entry and a restore one `order.restored` entry in the same save, each with
`number=<n>;status=<key>;total=<amount>;paid=<amount>;balance=<amount>`. A delete for good writes one `order.permanently-deleted`
entry first, in the same save as the removal: `number`, `status`, `subtotal`, `discount`, `total`, `paid`, `refunded`, `balance` and
`expenses`, then `receivers`, `payers` and `refunders` as comma-joined user ids (each person once, in the order they were first recorded).
The audit log holds 400 characters per entry, so when many people are involved the longest list is cut and ends with `+N` for the N ids
left out. A second delete, a restore of an order that is not deleted, and every refusal write nothing.
No entry ever holds the customer name, team, contact number, email, address or notes, an item's description or size, a discount's reason, a payment's reference or notes, a refund's reason, or an expense's description. The full list of order audit codes is in
[../operations/audit-log.md](../operations/audit-log.md).

## Importing legacy orders (ORD-21, ORD-14)

There is **no HTTP route** for this. It is a use case, `ImportOrderHandler`, that migration tooling calls: the Phase 7.1 fit check
and the Phase 16 import. It is separate on purpose, so nobody can reach the lenient rules from a browser or a phone. The same code
(`Order.Import`) builds the order whether the tool then saves it or only checks it.

What it does, in order:

1. `Order.Import` builds the order from the legacy data (number, details, status, items, discounts, payments, refunds, order expenses
   and status history) and checks it. Nothing is taken from the data except the facts: **every money figure is worked out again by
   `OrderMath` from the children**, so an imported ORD-2026-0148 reads the same seven figures as one created by hand, and an order that
   was already overpaid keeps every payment and shows the matching `customerCredit` (D-14). Text is trimmed like on any order, and text
   that is too long for its column is refused, never cut short.
2. The handler checks that every product type, payment method and order expense category exists, and that every receiver, refunder,
   payer and status history person is a known account. All failures come back together in one `400` on their own paths, such as
   `items[1].productTypeId` or `payments[0].receivedByUserId`.
3. Only then is the order number lock taken. The number must not be used by any order, deleted ones included (`422 orders.number-taken`,
   "This order number is already used."), the year's counter is lifted (below), and the order, its history and the counter save in one
   transaction. A lock that times out, or a save that was a deadlock victim, is the same `409 orders.busy` as on create.

**Rules that never bend** (they hold under every rules instance): a number that is not empty, is at most 32 characters and uses plain
characters only (the number column cannot hold more without changing it); a status of 1 to 7 and a discount kind of fixed or
percentage; a quantity or unit price that is not negative; money with at most two decimal places; a discount, payment, refund and
expense amount above 0.00 (the database checks these); and text that fits its column. Everything else is a named relaxation, except the
field rules that have none: the characters of a contact number, the shape of an email address and a due date before the order date still
refuse an order. If Phase 7.1 finds legacy data that breaks one of them, the owner decides whether it gets a name of its own.

**The named relaxations.** They live in `OrderImportRules`. `OrderImportRules.Default` has every one on; `OrderImportRules.Strict` has
every one off and gives the same checks, in the same words, as creating an order by hand (except that a status of Completed or
Cancelled is allowed). When the owner rules on a legacy oddity, one value changes here; no schema changes.

| Relaxation | With it on (the default) | With it off |
|------------|--------------------------|-------------|
| `KeepLegacyNumber` | The number is kept exactly as given, any format, up to 32 characters | The number must read `ORD-{YYYY}-{NNNN}` |
| `DueDateOptional` (D-22) | An order may have no due date | A due date is required |
| `ContactNumberOptional` | An order may have no contact number | A contact number is required |
| `AllowOverpaid` (D-14) | Payments may add up to more than the total; the excess is the customer credit | The payments may not pass the total |
| `AllowCompletedWithBalance` (D-14) | A Completed order may still have a balance or a credit (D-03 is not applied) | A Completed order must have a zero balance |
| `AllowDiscountAboveSubtotal` (D-40) | The discounts may add up to more than the items total | The discounts may not pass the items total |
| `IgnoreAmountCaps` (06 D-33) | The limits are skipped: quantity 1 to 10,000 (0 is allowed, negative never), unit price up to 1,000,000.00, fixed discount up to 1,000,000.00, percentage up to 100, payment, refund and expense up to 1,000,000.00 | The limits apply |
| `AllowFutureDates` | Payment and refund dates, and order expense dates, may be in the future | Payments and refunds may not be dated after the business today; expenses may be up to 30 days ahead |
| `AllowRetiredListEntries` | A retired product type, payment method or expense category may be named | A retired entry is refused |
| `AllowLegacyHolder` (D-32, D-37) | The hidden "Legacy / unassigned" holder may be named as receiver, refunder, payer or history person | The holder is refused: "This person can't be chosen because their account isn't active. Choose someone else." |
| `AllowInactivePeople` | A person who was deactivated, locked or deleted may be named | Only an active Admin or Manager who finished set-up may be named |
| `AllowAnyStatusHistory` | The history may hold moves the status rules refuse, such as Cancelled straight to Completed | Each move must be one the status rules allow |
| `IgnoreChildCaps` | The limits on how many items (100), discounts (20), payments (100), refunds (50) and expenses (100) an order holds are skipped | The limits apply |
| `AllowNoItems` | An order may have no items | At least one item is required |

A person who does not exist at all is always refused, whatever the rules say. A payment may be dated before the order date (D-41). The
refund rules that depend on the order's figures (a refund only on a cancelled order or one in credit, and the refund caps) are
not applied to imported refunds: the legacy refunds are taken as they were.

**The order number counter (ORD-14).** Importing a number that reads `ORD-{YYYY}-{NNNN}` lifts that year's counter to at least NNNN
under the order number lock, and never lowers it, so after importing `ORD-2026-0148` the next new order of 2026 is `ORD-2026-0149`.
A number in any other form, such as `LEG-0042`, leaves every counter alone. If two imports race for one number, the unique number index
stops the second one and the answer is the same `422 orders.number-taken`.

**No audit entry.** An import is tooling, not a staff change, so it writes no audit entry and no `recordedBy` person (it reads
**System**). The Phase 16 reconciliation report is the record of what came in.

**Open question (MIG-09, Phase 15).** Who the receiver of a legacy payment, the refunder of a legacy refund and the payer of a legacy
expense should be when the old data does not say is the owner's final ruling in Phase 15. Until then the import accepts the hidden
"Legacy / unassigned" holder (D-32) or a named staff member, and the holder never shows in any picker.

After an import the order is an ordinary order: a Completed or Cancelled one is locked until it is reopened (D-05), and editing the
details of an order that came in without a due date asks for one (D-22).

## What is stored (D-23, D-26)

- `Orders`, `OrderItems`, `OrderStatusChanges` and `OrderNumberCounters` come from the migration `AddOrders`. `OrderDiscounts` comes from
  the migration `AddOrderDiscounts`: its `Kind` is 1 (fixed) or 2 (percentage), its `Value` is above zero, and it leaves with its order.
  `OrderPayments` comes from the migration `AddOrderPayments`: its `Amount` is above zero, it has a `Position` like the discounts, the
  method and every person key are NO ACTION (so removing a user or a method never rewrites a payment), and it leaves with its order.
  `OrderRefunds` comes from the migration `AddOrderRefunds`: its `Amount` is above zero, it has a `Position` like the payments, the
  refunder and every other person key are NO ACTION, and it leaves with its order. Its refunder index carries the amount and the date
  for Phase 10's money on hand (D-08).
  `OrderExpenses` comes from the migration `AddOrderExpenses`: its `Amount` is above zero, it has a `Position` like the payments,
  the category and every person key (including the payer) are NO ACTION, and it leaves with its order.
- The order carries `DeletedAtUtc` and `DeletedById` from the start (D-26), and a named `SoftDelete` query filter hides a deleted
  order, its items and its history from every default query.
- The stored money figures must agree: the database checks that total equals subtotal minus discount, that balance equals total
  minus paid plus refunded, and that customer credit equals the balance below zero.
- `OrderNumberCounters` keeps the last number given out in each business year. The counter and the lock row `order-numbers` are
  used inside the create transaction, so a failed create gives its number back and numbers have no gaps.

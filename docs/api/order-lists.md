---
created: 2026-10-28T09:20:00-05:00
updated: 2026-10-28T18:52:00-05:00
---

# The order lists API

Orders point at three lists that Managers edit: product types, payment methods and order expense categories. This page covers
the read routes and the Manager routes that add, rename, recolor, retire, bring back and delete entries. Everything is under
`/api/v1`. The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of
this page; the web app's types are generated from it (`web/src/types/api.generated.ts`). Sign-in and the access token are in
[auth.md](auth.md).

## In plain words

1. Each list is its own table. An order item points at a product type, a payment points at a payment method, and an order
   expense points at an order expense category.
2. Every entry has a name (1 to 40 characters after trimming, unique in its list ignoring letter case), a colour tone and a
   status.
3. The three lists follow the same rules as the company expense categories (Phase 6). The code is written once and closed per
   list, so the lists never drift.
4. A retired entry stays in the read list with status `retired`. A picker hides it; a filter keeps it, so old orders still show
   their label. A new or changed item, payment or order expense cannot choose a retired entry. A saved row that already uses it
   keeps it and can be edited without changing it.
5. An entry that any row uses can only be retired, never deleted. Rows on soft-deleted orders count as use. An entry that was
   never used can be deleted. The Settings sections on top of these routes come in Phase 8 (D-20).
6. Only the order expense category **Others** is protected: it can be recolored but never renamed, retired or deleted.
7. Every add, rename, recolor, retire, reactivate and delete writes one audit entry in the same save (D-31).

## Routes

Each of the three lists has the same eight routes. `{list}` is `product-types`, `payment-methods` or `order-expense-categories`.

| Method and path | Who | Answers |
|---|---|---|
| `GET /{list}` | Staff | `200` an array of list items |
| `POST /{list}` | Manager | `201` the entry detail and its `Location`; `400` field errors |
| `GET /{list}/{id}` | Manager | `200` the entry detail; `404` |
| `PUT /{list}/{id}` | Manager | `200` the saved detail; `400`, `404`, `409 edit.stale`, `422` (Others) |
| `POST /{list}/{id}/retire` | Manager | `204`; `404`; `422` (Others) |
| `POST /{list}/{id}/reactivate` | Manager | `204`; `404` |
| `DELETE /{list}/{id}` | Manager | `204`; `404`; `422` (in use, or Others) |

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. **Manager** means a `Manager`
token: an Admin meets `403` and no token is `401`. No answer is ever cached (`Cache-Control: no-store`). Every state-changing
`POST` needs an `Idempotency-Key` header; a retry with the same key and body answers with the stored result.

## The list item

```json
{ "id": "01a17fce-7800-7f5d-bc6c-5d14ceeca0c6", "name": "Basketball Jersey", "tone": "accent", "status": "active", "isOthers": false, "useCount": 12 }
```

| Field | Meaning |
|---|---|
| `id` | The entry id (a GUID). |
| `name` | The display name. |
| `tone` | One of `neutral`, `accent`, `info`, `mockup`, `warning`, `success`. |
| `status` | `active`, or `retired`. |
| `isOthers` | `true` only for the order expense category Others. |
| `useCount` | How many rows use the entry: order items for a product type, payments for a payment method, order expenses for a category. Rows on soft-deleted orders count too. An entry with `0` can be deleted. |

## The entry detail

`POST`, `GET /{id}` and `PUT` answer with the list item fields plus who made and last changed the entry and the version a save
must send back.

```json
{
  "id": "01a17fce-7800-7f5d-bc6c-5d14ceeca0c6",
  "name": "Hoodie",
  "tone": "info",
  "status": "active",
  "isOthers": false,
  "useCount": 0,
  "recordedBy": { "id": "…", "name": "Maria Santos", "formerStaff": false },
  "recordedAt": "2026-10-28T14:00:00+00:00",
  "lastChangedBy": null,
  "lastChangedAt": null,
  "version": "AAAAAAAAH6Q="
}
```

`recordedBy` is `null` for the starting entries (they read as System). `lastChangedBy` and `lastChangedAt` are `null` until the
first change. `version` is the base64 of the eight-byte row version.

## Adding and editing

`POST /{list}` takes `{ "name": "Hoodie", "tone": "info" }`. `PUT /{list}/{id}` takes `{ "name", "tone", "version" }`, where
`version` is the value the form was opened with. Any other member in the body, such as a forged `createdById`, is ignored: who
changed the entry and when come from the token and the clock.

The rules, checked in this order for an edit and stopping at the first failure:

1. The form: a name of 1 to 40 characters after trimming, a tone that is one of the six, and (for an edit) a `version` of eight
   bytes. A bad form is `400` with every broken field listed.
2. The entry must exist: `404`.
3. The `version` must be the stored one: `409` `edit.stale`. A form edit is never retried; the person reloads and decides.
4. Others keeps its name: any other name for it is `422` `order-expense-categories.protected`. Sending Others its own name is
   accepted and changes nothing.
5. The name must not be held by another entry of the same list, retired ones included, in any letter case: `400` on `name`.

A form with no change saves nothing, writes no audit entry and keeps the version. A rename writes `<prefix>.renamed` and a recolor
writes `<prefix>.recolored`; both in one save when both change.

## Retire, reactivate and delete

These three take no version. They act on the latest state, so a lost race is read again and decided again, and two lost races in
a row answer `409`.

- **Retire** marks the entry retired and writes `<prefix>.retired`. Retiring a retired entry is a `204` that changes and records
  nothing. Others can never be retired: `422` `order-expense-categories.protected`.
- **Reactivate** clears the retirement and writes `<prefix>.reactivated`. Reactivating an active entry is a `204` that changes
  and records nothing.
- **Delete** writes `<prefix>.deleted` and removes the row, but only while no row uses the entry. A used entry is `422`
  `<list>.in-use`. Others can never be deleted. A row added in the same moment is caught by the database foreign key and gives
  the same `422`.

`<prefix>` is `product-type`, `payment-method` or `order-expense-category`.

## Sort order

A to Z, ignoring letter case, then by id. In the order expense categories, Others is always last.

## Starting values (D-16, D-17, D-18)

| List | Entries, in the order the API answers |
|---|---|
| Product types | Basketball Jersey, Custom Design, Long Sleeves, Moto Riding Jersey, Polo Shirt, Volleyball Jersey |
| Payment methods | Bank Transfer, Cash, Cheque, GCash, Maya |
| Order expense categories | Delivery, Fabric, Ink & paper, Labor, Outsourcing, Others |

The migration `AddOrderLists` writes these seventeen rows once, with fixed ids, so every database starts the same.

## Errors

| Status | Code | When |
|---|---|---|
| `400` | `{list}.invalid-request` | A broken field. Messages: "Enter a product type name." (also "payment method" and "category"), "Keep the name to 40 characters or fewer.", "Choose a badge color.", "Reload the form and try again." (bad version), "That name is already used. Choose another one." |
| `404` | `{list}.not-found` | "This product type was deleted." (also "payment method" and "category") |
| `409` | `edit.stale` | "This was changed by someone else. Reload and try again." |
| `422` | `{list}.in-use` | "This product type is used by an order, so it can't be deleted. Retire it instead." (also "payment method" and "category") |
| `422` | `order-expense-categories.protected` | "The Others category can't be renamed, retired or deleted." |

An order that names a retired entry is refused with `400` on the field: "This product type was retired. Choose another one.",
"This payment method was retired. Choose another one." or "This category was retired. Choose another one." An order that names
an entry deleted in the same moment is refused with "This product type was deleted." and the matching messages for the other two
lists.

## Races

- Two Managers adding the same name together: one `201` and one `400` on `name`. The unique index on the normalized name
  decides, and the loser gets the same field error as a name checked earlier.
- A delete and a new use of the same never-used entry together: either the delete wins (`204`) and the use is refused with
  "This … was deleted.", or the use wins and the delete is refused as in use. Never a `500`.

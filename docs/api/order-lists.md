---
created: 2026-10-28T09:20:00-05:00
updated: 2026-10-28T09:20:00-05:00
---

# The order lists API

Orders point at three lists that Managers will be able to edit: product types, payment methods and order expense categories.
This page covers the read routes that exist today. Everything is under `/api/v1`. The OpenAPI document (Development only, at
`/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of this page; the web app's types are generated from it
(`web/src/types/api.generated.ts`). Sign-in and the access token are in [auth.md](auth.md).

## In plain words

1. Each list is its own table. An order item points at a product type, a payment points at a payment method, and an order
   expense points at an order expense category.
2. Every entry has a name (at most 40 characters, unique in its list ignoring letter case), a colour tone and a status.
3. A retired entry stays in the read list with status `retired`. A picker hides it; a filter keeps it, so old orders still show
   their label.
4. Only the order expense category **Others** is protected: it can be recolored but never renamed, retired or deleted.
5. The Settings sections that add, rename, recolor, retire and delete entries come in Phase 8 (D-20). Until then the lists are
   read-only here.

## Routes

| Method and path | Who | Answers |
|---|---|---|
| `GET /product-types` | Staff | `200` an array of list items |
| `GET /payment-methods` | Staff | `200` an array of list items |
| `GET /order-expense-categories` | Staff | `200` an array of list items |

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. No token is `401`. No answer
is ever cached (`Cache-Control: no-store`).

## The list item

```json
{ "id": "01a17fce-7800-7f5d-bc6c-5d14ceeca0c6", "name": "Basketball Jersey", "tone": "accent", "status": "active", "isOthers": false }
```

| Field | Meaning |
|---|---|
| `id` | The entry id (a GUID). |
| `name` | The display name. |
| `tone` | One of `neutral`, `accent`, `info`, `mockup`, `warning`, `success`. |
| `status` | `active`, or `retired`. |
| `isOthers` | `true` only for the order expense category Others. |

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

The error codes the Phase 8 edit routes will use already follow one pattern: `product-types.*`, `payment-methods.*` and
`order-expense-categories.*`. Editing Others answers `order-expense-categories.protected`: "The Others category can't be
renamed, retired or deleted."

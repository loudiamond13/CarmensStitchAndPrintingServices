# The order photos API

*Created: 2026-11-03T11:43:44-06:00 · Updated: 2026-11-03T11:43:44-06:00*

This is the contract for the photos on an order, and the one a future Android app will use. Everything is under `/api/v1`. The
OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of this page; the web
app's types are generated from it (`web/src/types/api.generated.ts`). Sign-in and the access token are in [auth.md](auth.md). The
order itself, and the `images` list it carries, are in [orders.md](orders.md). This page covers what exists today: uploading one
photo and reading the photo rules. Limits that are still to come, moving, describing and deleting photos, are added to this page
when they ship.

## In plain words

1. Photos go to the server, never straight to the photo store. The server checks the file, stores it under a random id it makes
   itself, and saves a row that points at it.
2. The server reads the type from the first bytes of the file. The file name and the content type the client sends are not trusted
   and never shape the stored id.
3. An order holds at most 5 photos. A Completed or Cancelled order takes none.
4. The server never keeps a customer photo on disk. The file is read in memory and sent on.
5. Every answer is the whole order, with its photos in display order.

## Routes

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /orders/image-rules` | Staff | none | `200` the rules below; `401` |
| `POST /orders/{id}/images` | Staff | a multipart form (below), with an `Idempotency-Key` | `200` the whole order; `400`; `404 orders.not-found`; `409 edit.stale`; `413`; `422 orders.images-full` or `orders.locked`; `429`; `503` |

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. No token is `401`. Both roles
may upload to any order. No answer is ever cached (`Cache-Control: no-store`).

## The photo rules (`GET /api/v1/orders/image-rules`)

The browser reads the same limits the server enforces, so it can refuse a bad file before it sends anything (OR-3). The answer:

```
{ maxPerOrder: 5, maxBytes: 10485760, maxPixels: 25000000, maxSide: 10000,
  types: ["jpeg", "png", "webp", "heic"], descriptionMaxLength: 200 }
```

- `maxPerOrder` is the most photos one order holds.
- `maxBytes` is the largest file in bytes (10 MB). A host may be set lower, never higher.
- `maxPixels` is the most pixels (width times height) a photo may have: 25 megapixels. `maxSide` is the longest side in pixels.
- `types` are the formats the server accepts, told apart by their first bytes: JPG, PNG, WEBP and HEIC.
- `descriptionMaxLength` is the longest description, in characters, after trimming.

## Uploading a photo (`POST /api/v1/orders/{id}/images`)

The request is `multipart/form-data` with these parts:

| Part | Required | Rule |
|---|---|---|
| `file` | yes | one photo: JPG, PNG, WEBP or HEIC by its first bytes, up to `maxBytes`, up to `maxPixels` and `maxSide` |
| `description` | no | up to 200 characters after trimming. An empty one, or the default text (`Order ORD-2026-0148 photo 1`), is kept as none |

The new photo goes to the end of the order's list. Who added it and when come from the token and the server clock; any such part
in the form is ignored. The order's `version` is not sent: the upload takes the order's lock itself, and a save that loses a race
is read again and decided again once.

### Every answer

| Status | Code | Message | When |
|---|---|---|---|
| `200` | | the whole order, with the new photo in `images` | the photo was stored and saved |
| `400` | `images.file-missing` | Choose a photo to upload. | no `file` part, or it is empty |
| `400` | `images.type` | `{name} isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.` | the first bytes are not one of the four formats, or the file is damaged. Reported on `file` |
| `400` | `images.too-large` | `{name} is over 10 MB. Choose a smaller photo.` | the file is over `maxBytes`. The size in the message follows the configured limit. Reported on `file` |
| `400` | `images.too-big` | `{name} is too big. Photos can be at most 25 megapixels.` | the photo is over `maxPixels` or `maxSide`. Reported on `file` |
| `400` | `orders.image-description-too-long` | Keep the description to 200 characters or fewer. | the description is over 200 characters. Reported on `description` |
| `400` | `idempotency.key-missing` | | the `Idempotency-Key` header is missing or not a UUID |
| `401` | | | no valid token |
| `404` | `orders.not-found` | This order was not found or was deleted. | the order does not exist or was deleted |
| `409` | `edit.stale` | | two saves lost a race twice; read the order and try again |
| `413` | | The request is too large. | the body is over the request size cap (see the note below) |
| `422` | `orders.images-full` | This order already has 5 photos. | the order already holds `maxPerOrder` photos |
| `422` | `orders.locked` | This order is completed. Reopen it to make changes. (or cancelled) | the order is Completed or Cancelled; nothing changes |
| `429` | | | the caller must slow down |
| `503` | `images.not-configured` | Photo uploads aren't set up yet. | the host has no photo store set up. The site still runs |
| `503` | `images.storage-failed` | The photo couldn't be saved. Try again. | the photo store did not take the file. No photo row was saved |

`{name}` is the file name the client sent, cleaned for the message: no folders, no control characters, at most 80 characters, and
"This file" when nothing is left. It is only shown, never used for anything else.

The order is checked first (exists, open, has room, description fits), then the file is read, and only then is it sent to the
store. A refused upload never leaves a customer photo in storage.

**Note on the size cap.** The server stops every request body above 1 MiB with `413` before the upload runs. The 10 MB allowance
for this one route comes in a later plan (09-14), and until then a photo over 1 MiB answers `413`. The browser already shrinks
photos before it sends them.

### The Idempotency-Key

The upload needs an `Idempotency-Key` header with a fresh UUID for each photo the user picks. A retry with the same key and body
answers with the stored `200` (and the header `Idempotent-Replayed: true`) and adds nothing more: one photo, one audit entry. The
same key with a different body is `422 idempotency.key-mismatch`, and a key still being processed is `409 idempotency.in-progress`.
Only `200`, `400`, `404` and `422` answers are kept. A `401`, `409`, `413`, `429` or `5xx` is not, so the same key can be sent again.

## The audit entry

Each upload writes one `order-image.added` entry for the order, in the same save as the photo row:
`number=<order number>;position=<n>`, where `position` counts from 1. The entry never holds the photo's address or id, its file
name or its description. The full list of audit codes is in [../operations/audit-log.md](../operations/audit-log.md).

## What is stored

A photo row holds the order, its place (`Position`, with the cover at 0, and a `Slot` from 0 to 4 that keeps the 5-photo rule in
the database), the public id, the upright width and height, the size in bytes, the format and the description. Addresses are not
stored. The server builds them each time an order is read.

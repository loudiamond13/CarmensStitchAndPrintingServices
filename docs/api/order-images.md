# The order photos API

*Created: 2026-11-03T11:43:44-06:00 · Updated: 2026-11-04T00:50:00-06:00*

This is the contract for the photos on an order, and the one a future Android app will use. Everything is under `/api/v1`. The
OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of this page; the web
app's types are generated from it (`web/src/types/api.generated.ts`). Sign-in and the access token are in [auth.md](auth.md). The
order itself, and the `images` list it carries, are in [orders.md](orders.md). This page covers what exists today: uploading one
photo, reading the photo rules, moving a photo (which also chooses the cover), describing a photo and deleting a photo.

## In plain words

1. Photos go to the server, never straight to the photo store. The server checks the file, stores it under a random id it makes
   itself, and saves a row that points at it.
2. The server reads the type from the first bytes of the file. The file name and the content type the client sends are not trusted
   and never shape the stored id.
3. An order holds at most 5 photos. A Completed or Cancelled order takes none.
4. The server never keeps a customer photo on disk. The file is read in memory and sent on.
5. Every answer is the whole order, with its photos in display order.
6. The cover is the photo at place 0. There is no separate cover flag, so the cover can never disagree with the order of the photos.
7. Deleting a photo never calls the photo store. The photo leaves the order at once, and its file is queued for removal in the same
   save. The file leaves the store on the next monthly cleanup run.

## Routes

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /orders/image-rules` | Staff | none | `200` the rules below; `401` |
| `POST /orders/{id}/images` | Staff | a multipart form (below), with an `Idempotency-Key` | `200` the whole order; `400`; `404 orders.not-found`; `409 edit.stale`; `413`; `422 orders.images-full` or `orders.locked`; `429`; `503` |
| `PUT /orders/{id}/images/{imageId}/position` | Staff | `{ "position": 0, "version": "..." }` | `200` the whole order; `400` on `position` or `version`; `404 orders.not-found` or `orders.image-not-found`; `409 edit.stale`; `422 orders.locked` |
| `PUT /orders/{id}/images/{imageId}` | Staff | `{ "description": "...", "version": "..." }` | `200` the whole order; `400` on `description` or `version`; `404 orders.not-found` or `orders.image-not-found`; `409 edit.stale`; `422 orders.locked` |
| `DELETE /orders/{id}/images/{imageId}` | Staff | none | `200` the whole order; `401`; `404 orders.not-found` or `orders.image-not-found`; `409 edit.stale`; `422 orders.locked` |

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. No token is `401`. Both roles
may upload to, move, describe and delete photos on any order. No answer is ever cached (`Cache-Control: no-store`).

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
| `413` | | The request is too large. | the body is over 10 MiB plus 64 KiB (see the note below) |
| `422` | `orders.images-full` | This order already has 5 photos. | the order already holds `maxPerOrder` photos |
| `422` | `orders.locked` | This order is completed. Reopen it to make changes. (or cancelled) | the order is Completed or Cancelled; nothing changes |
| `422` | `idempotency.key-mismatch` | | the same `Idempotency-Key` was used with different parts (see below) |
| `429` | `rate-limited` | Too many uploads right now. Wait a minute, then try again. | more than 30 uploads from one address in 10 minutes, or the server is already busy with other uploads. A `Retry-After` header gives the wait in seconds |
| `503` | `images.not-configured` | Photo uploads aren't set up yet. | the host has no photo store set up. The site still runs |
| `503` | `images.storage-failed` | The photo couldn't be saved. Try again. | the photo store did not take the file. No photo row was saved |

`{name}` is the file name the client sent, cleaned for the message: no folders, no control characters, at most 80 characters, and
"This file" when nothing is left. It is only shown, never used for anything else.

The order is checked first (exists, open, has room, description fits), then the file is read, and only then is it sent to the
store. A refused upload never leaves a customer photo in storage.

**Note on the size cap.** This route takes a body of up to 10 MiB plus 64 KiB (the file plus room for the form fields). One byte
more answers `413` before the upload runs. Every other route in the API still stops at 1 MiB. In front of the app, IIS holds the
same line a little higher (11 MiB), so the app answers `413` itself. The browser also shrinks photos before it sends them. The
photo is held in memory only, never in a temp file.

**Note on the pace.** One address may upload 30 times in 10 minutes. The whole server works on two uploads at a time and lets up
to four more wait their turn. A seventh at the same moment answers `429` at once with `Retry-After: 60`. After a `429`, wait
that long, then send the same request again with the same `Idempotency-Key`.

### The Idempotency-Key

The upload needs an `Idempotency-Key` header with a fresh UUID for each photo the user picks. A retry with the same key and the
same parts answers with the stored `200` (and the header `Idempotent-Replayed: true`) and adds nothing more: one photo, one audit
entry. The server compares the parts, not the raw bytes of the request: each part's name, file name, content type and bytes. So
a retry that the browser sends with a new multipart boundary is still a repeat. The same key with a different file, description,
file name or part type is `422 idempotency.key-mismatch`, and a key still being processed is `409 idempotency.in-progress`.
Only `200`, `400`, `404` and `422` answers are kept. A `401`, `409`, `413`, `429` or `5xx` is not, so the same key can be sent again.
When a body is not valid multipart at all, it is compared as it is and the upload answers `400` as usual.

**To retry ("Try Again"): send the same key and the same file.** A new key makes a second photo.

## Moving a photo and choosing the cover (`PUT /api/v1/orders/{id}/images/{imageId}/position`)

The body is `{ "position": <n>, "version": "<order version>" }`. Places count from 0, and the photo at place 0 is the cover.

- The photo moves to that place and the others shift to make room, so the places stay 0 to n-1 with no gap. Only `position` values
  change. A photo's `Slot` (the database guard of the 5-photo limit) never does.
- **Make Cover** is the same request with `position` 0. Moving another photo to 0, or moving the cover away from 0, changes the
  cover.
- Moving a photo to the place it already has, or making the cover the cover, saves nothing, writes no audit row and keeps the
  order's `version`. The answer is `200` with the order as it was.
- The `version` is the order's version from the last answer. A version that is not the stored one answers `409 edit.stale` and
  changes nothing; read the order again and try once more. Two moves sent with the same version give one `200` and one `409`.
- The answer is the whole order with the new `version`.

| Status | Code | Message | When |
|---|---|---|---|
| `200` | | the whole order, with the new places and version | the photo moved, or nothing needed to change |
| `400` | `orders.invalid-request` | Check the highlighted fields. | `position` is missing, below 0 or at or above the number of photos on the order (field `position`: Choose a place that is on this order.), or `version` is missing or not a version (field `version`: Reload the form and try again.) |
| `401` | | | no valid token |
| `404` | `orders.not-found` | This order was not found or was deleted. | the order does not exist or was deleted |
| `404` | `orders.image-not-found` | This photo is no longer on this order. | the photo is not on this order, or was removed |
| `409` | `edit.stale` | | the `version` is not the stored one, or two saves lost a race |
| `422` | `orders.locked` | This order is completed. Reopen it to make changes. (or cancelled) | the order is Completed or Cancelled; nothing changes |

## Describing a photo (`PUT /api/v1/orders/{id}/images/{imageId}`)

The body is `{ "description": "<text or null>", "version": "<order version>" }`.

- The text is trimmed. An empty text, or exactly `Order {number} photo {n}` for the photo's current place `n` (counting from 1), is
  stored as none (`description` is null in the answer). So the default always follows the photo's place: after a move, a photo
  with no stored text shows the default for its new place. A client builds the default from the order number and `position + 1`.
- The limit is 200 characters after trimming, counted as .NET string length (UTF-16 code units), the same measure as JavaScript
  string length in the web form.
- A text that is already stored changes nothing: `200`, the same `version`, no audit row.
- The `version` rules and the answer are the same as for a move.

| Status | Code | Message | When |
|---|---|---|---|
| `200` | | the whole order, with the description and new version | the description was saved, or nothing needed to change |
| `400` | `orders.invalid-request` | Check the highlighted fields. | the description is over 200 characters (field `description`: Keep the description to 200 characters or fewer.), or `version` is missing or not a version |
| `401` | | | no valid token |
| `404` | `orders.not-found` | This order was not found or was deleted. | the order does not exist or was deleted |
| `404` | `orders.image-not-found` | This photo is no longer on this order. | the photo is not on this order, or was removed |
| `409` | `edit.stale` | | the `version` is not the stored one, or two saves lost a race |
| `422` | `orders.locked` | This order is completed. Reopen it to make changes. (or cancelled) | the order is Completed or Cancelled; nothing changes |

## Deleting a photo (`DELETE /api/v1/orders/{id}/images/{imageId}`)

There is no body and no `version`. Like removing an item, the delete acts on the latest state of the order, and a save that loses a
race is read again and decided again once.

- The photo leaves the order at once. The other photos close up, so the places stay 0 to n-1 with no gap. When the cover (place 0)
  is deleted, the next photo becomes the cover.
- In the same save, the photo's stored file is added to the removal queue with the reason "photo deleted". Nothing calls the photo
  store during the request, so a slow or failing store can never block a delete or leave it half done.
- The file leaves the store on the next monthly cleanup run. Until then it stays in the store, but nothing points at it and no
  address for it is ever given out again.
- The photo is looked up on the order in the route only. A photo id from another order is `404`, and nothing is queued.
- Deleting the same photo twice answers `200` and then `404 orders.image-not-found`. Only the first delete queues the file.
- The answer is the whole order with the new `version`.

| Status | Code | Message | When |
|---|---|---|---|
| `200` | | the whole order, without the photo, with the new places and version | the photo was deleted and its file queued |
| `401` | | | no valid token |
| `404` | `orders.not-found` | This order was not found or was deleted. | the order does not exist or was deleted |
| `404` | `orders.image-not-found` | This photo is no longer on this order. | the photo is not on this order, or was already deleted |
| `409` | `edit.stale` | | two saves lost a race twice; read the order and try again |
| `422` | `orders.locked` | This order is completed. Reopen it to make changes. (or cancelled) | the order is Completed or Cancelled; nothing changes and nothing is queued |

## The audit entries

Each upload writes one `order-image.added` entry for the order, in the same save as the photo row:
`number=<order number>;position=<n>`, where `position` counts from 1. The entry never holds the photo's address or id, its file
name or its description. Every place below counts from 1.

| Change | Entries (same save as the change) | Detail |
|---|---|---|
| a photo moves | `order-image.moved` | `number=<order number>;from=<n>;to=<n>` |
| the move changes the cover (a photo goes to place 1, or the cover leaves it) | also `order-image.cover-changed` | `number=<order number>;cover=<n>`, the place the new cover had before the move |
| a description changes | `order-image.description-changed` | `number=<order number>;position=<n>;description=<old>><new>` |
| a photo is deleted | `order-image.deleted` | `number=<order number>;position=<n>`, the place the photo had before it was deleted |

The description entry holds the text staff typed, percent-encoded like other audit text (`%`, `;`, `=` and `>`), and cut so the
whole detail fits the audit log's 400 character limit. A side with no stored text shows the default text of the place. No entry
holds a photo id or address. Nothing is written when nothing changed. The full list of audit codes is in
[../operations/audit-log.md](../operations/audit-log.md).

## What is stored

A photo row holds the order, its place (`Position`, with the cover at 0, and a `Slot` from 0 to 4 that keeps the 5-photo rule in
the database), the public id, the upright width and height, the size in bytes, the format and the description. Addresses are not
stored. The server builds them each time an order is read.

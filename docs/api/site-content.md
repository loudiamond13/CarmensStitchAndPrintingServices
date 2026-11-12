---
created: 2026-11-11T23:50:00-06:00
updated: 2026-11-12T09:35:00-06:00
---

# The site content API

This is the contract behind the Site Content screens that a Manager uses to keep the public website current, and the one a future
Android app will use. Everything here is under `/api/v1`. The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at
`/scalar`) is the machine-readable twin of this page; the web app's types are generated from it
(`web/src/types/api.generated.ts`). Sign-in and the access token are in [auth.md](auth.md). What visitors read is in
[public-site.md](public-site.md).

Right now this page covers the Business Info save, the weekly opening hours, the holidays and closures, and the product lines. The
line photos, testimonials and gallery routes join this page in later plans.

## In plain words

1. A Manager saves the shop's facts in one form: the name, the words, the address, the phone numbers, the links and the email.
2. The next visitor sees the change. The server clears the public cache after the save commits, so the public read and the page
   head show the new values at once, with a new `ETag`.
3. The server decides everything. Who saved and when come from the token and the clock, never from the form.

## Where the routes live

| Method and path | Who | Answers |
|---|---|---|
| `GET /api/v1/site-settings` | Staff (Admin or Manager) | `200` the settings below; `401`. |
| `PUT /api/v1/site-settings` | Manager | `200` the settings as saved; `400` field errors; `401`; `403` for an Admin; `409 edit.stale`. |
| `GET /api/v1/opening-hours` | Manager | `200` the seven days below; `401`; `403` for an Admin. |
| `PUT /api/v1/opening-hours` | Manager | `200` the hours as saved; `400` field errors; `401`; `403` for an Admin; `409 edit.stale`. |
| `GET /api/v1/shop-closures` | Manager | `200` the upcoming closures below; `401`; `403` for an Admin. |
| `POST /api/v1/shop-closures` | Manager | `201` the new closure; `400` field errors or an overlap; `401`; `403` for an Admin; `409` when the shop is busy saving another closure. Needs an `Idempotency-Key`. |
| `PUT /api/v1/shop-closures/{id}` | Manager | `200` the closure as saved; `400` field errors or an overlap; `401`; `403` for an Admin; `404`; `409 edit.stale` or busy. |
| `DELETE /api/v1/shop-closures/{id}` | Manager | `204`; `401`; `403` for an Admin; `404` when it is already gone. |
| `GET /api/v1/product-lines` | Manager | `200` every line, shown and hidden, in order; `401`; `403` for an Admin. |
| `GET /api/v1/product-lines/{id}` | Manager | `200` one line with every field; `401`; `403`; `404`. |
| `POST /api/v1/product-lines` | Manager | `201` the new line; `400` field errors or a short name in use; `401`; `403`; `409` when the shop is busy. Needs an `Idempotency-Key`. |
| `PUT /api/v1/product-lines/{id}` | Manager | `200` the line as saved; `400`; `401`; `403`; `404`; `409 edit.stale` or busy. |
| `POST /api/v1/product-lines/{id}/move` | Manager | `204`; `400` for a direction that is not `up` or `down`; `401`; `403`; `404`; `409` when the shop is busy. Needs an `Idempotency-Key`. |
| `POST /api/v1/product-lines/{id}/hide` and `/show` | Manager | `204`; `401`; `403`; `404`; `409` when the shop is busy. Need an `Idempotency-Key`. |
| `DELETE /api/v1/product-lines/{id}` | Manager | `204`; `401`; `403`; `404` when it is already gone; `422 product-lines.in-use`. |

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. An `Admin` can read the settings
but cannot save them. No token is `401`.

## Reading the settings

`GET /api/v1/site-settings` answers every Business Info field, the shop email, the phones, the version and who last changed the
settings. A value that is not set is `null`.

| Member | Meaning |
|---|---|
| `businessName`, `tagline`, `aboutText`, `turnaroundLine` | The words on the site. |
| `street`, `townOrCity`, `province`, `postalCode` | The address parts. |
| `directionsUrl`, `mapEmbedUrl` | The Google Maps links. |
| `messengerUrl`, `facebookUrl`, `instagramUrl`, `tiktokUrl` | The contact and social links. |
| `contactEmail` | The shop email, for staff only. It is never sent to a public page. |
| `phones` | `[{ number, label, isMain }]`, the main number first. `number` is written as people read it, such as `0917 123 4567`. |
| `timeZoneId`, `currencyCode`, `locale` | Fixed and read-only: `Asia/Manila`, `PHP`, `en-PH`. They are not part of the save. |
| `version` | The base64 of the eight-byte row version a save must send back. |
| `updatedByName`, `updatedAtUtc` | Who last changed the settings and when; `null` until a person does. |

## Saving the business info

`PUT /api/v1/site-settings`, Manager only. Send every field of the form:

```json
{
  "version": "AAAAAAAAB9E=",
  "businessName": "Sample Shop",
  "tagline": "Sample tagline",
  "aboutText": "About the sample shop.",
  "turnaroundLine": "Mockups in 24 hours.",
  "street": "12 Sample St., Poblacion",
  "townOrCity": "Sample City",
  "province": "Sample Province",
  "postalCode": "8600",
  "directionsUrl": "https://maps.app.goo.gl/abc123",
  "mapEmbedUrl": "https://www.google.com/maps/embed?pb=sample",
  "messengerUrl": "https://m.me/yourpage",
  "facebookUrl": "https://www.facebook.com/yourpage",
  "instagramUrl": "https://www.instagram.com/yourpage",
  "tiktokUrl": "https://www.tiktok.com/@yourpage",
  "contactEmail": "name@example.test",
  "phones": [
    { "number": "0917 123 4567", "label": "Globe", "isMain": true },
    { "number": "02 8123 4567", "label": null, "isMain": false }
  ]
}
```

- An empty optional value is stored as not set and is left out of the public site.
- Text is trimmed. Lengths count UTF-16 code units, the same unit as a JavaScript string length.
- The answer is the settings as saved, in the shape of the read above.
- Any other member in the body is ignored, including `createdById`, `updatedById`, `createdAtUtc` and `updatedAtUtc`. The server
  stamps the signed-in Manager and the clock.

### The rules

Every message is the server's own wording, and the browser shows the same text before it sends anything. Errors come back as a
`400` with `errors` keyed by field. A phone row is keyed `phones[0].number` or `phones[0].label`; a rule about the whole list is
keyed `phones`.

| Field | Rule |
|---|---|
| `version` | Required: the version the form was opened with. |
| `businessName` | Required, at most 100. |
| `tagline` | Required, at most 160. |
| `turnaroundLine` | Optional, at most 120. |
| `aboutText` | Optional, at most 600. |
| `street`, `townOrCity`, `province` | Required, at most 120, 60 and 60. |
| `postalCode` | Optional, 4 digits. |
| `directionsUrl` | Optional: https on `maps.app.goo.gl`, `goo.gl/maps`, `www.google.com/maps` or `maps.google.com`. |
| `mapEmbedUrl` | Optional: a link that starts `https://www.google.com/maps/embed?`. |
| `messengerUrl` | Optional: `https://m.me/` plus 1 to 100 letters, digits or dots. |
| `facebookUrl` | Optional: https on `facebook.com`, `www.facebook.com`, `m.facebook.com` or `fb.com`. |
| `instagramUrl` | Optional: https on `instagram.com` or `www.instagram.com`. |
| `tiktokUrl` | Optional: https on `tiktok.com` or `www.tiktok.com`. |
| `contactEmail` | Optional, a valid email, at most 254. |
| `phones` | 1 to 4 numbers, exactly one main. Each is a Philippine mobile or landline number, not listed twice, with a label of at most 20. |

A link must be https on its exact host, with no sign-in part, no odd port, no space and no square bracket. A `javascript:` or
`http:` link is refused, and so is text that still holds a bracket placeholder such as `[Shop address]`. The accept and refuse cases
for the links are in `tests/fixtures/site-link-cases.json`, which both the .NET tests and the web tests read.

### A stale save

The `version` must be the stored one. A version that is not answers `409` with the code `edit.stale` and changes nothing. A form
save is never retried: the person reloads, sees the latest values and makes the change again. Two Managers who open the form at
the same time cannot overwrite each other.

### A save that changes nothing

A form with the same values as the stored ones stores nothing, writes no audit entry and keeps the version.

### What visitors see

After a save that changes something, the next `GET /api/v1/public/site` answers the new values with a new `ETag`, and the next page
head carries the new name and tagline. A save that only changes the phone list also moves the settings row, so the version and the
sitemap date follow it.

## The opening hours

The shop has one opening time and one closing time for each weekday (D-21). The hours are Manager only, for reading and for saving
(CONT-01, D-27): an Admin gets `403` and no token gets `401`. Until a Manager saves hours, every day is closed. The migration creates the
seven closed rows, and the shop never shows hours the owner did not enter.

### Reading the hours

`GET /api/v1/opening-hours` (operation `GetOpeningHours`):

```json
{
  "days": [
    { "day": 1, "opensAt": "09:00", "closesAt": "18:00" },
    { "day": 2, "opensAt": null, "closesAt": null },
    { "day": 3, "opensAt": null, "closesAt": null },
    { "day": 4, "opensAt": null, "closesAt": null },
    { "day": 5, "opensAt": null, "closesAt": null },
    { "day": 6, "opensAt": null, "closesAt": null },
    { "day": 7, "opensAt": null, "closesAt": null }
  ],
  "version": "AAAAAAAAB9EAAAAAAAAH0gAA...",
  "updatedByName": "Paolo Reyes",
  "updatedAtUtc": "2026-11-12T08:00:00+00:00"
}
```

- `day` runs from 1 (Monday) to 7 (Sunday). The list is always seven days, Monday first.
- Times are `"HH:mm"` in 24 hours, local business time (Asia/Manila). A closed day has `null` for both.
- `version` is the seven row versions joined and written as base64. The hours have their own version, so a Business Info save never
  makes it stale (RESEARCH P-8). A change to any one day makes every older copy stale.
- `updatedByName` and `updatedAtUtc` are the last change to any day, or `null` until a change.

### Saving the hours

`PUT /api/v1/opening-hours` (operation `UpdateOpeningHours`) saves all seven days at once:

```json
{
  "version": "AAAAAAAAB9EAAAAAAAAH0gAA...",
  "days": [
    { "day": 1, "opensAt": "09:00", "closesAt": "18:00" },
    { "day": 2, "opensAt": null, "closesAt": null }
  ]
}
```

(The list must hold all seven days, each once, in any order. Two are shown to keep this short.) The answer is the saved hours, as above.
Who saved and when come from the token and the clock; any such member in the body is ignored (SEC-08).

| Rule | Message | Field |
|---|---|---|
| An open day needs an opening time | Choose the opening time. | `days[i].opensAt` |
| An open day needs a closing time | Choose the closing time. | `days[i].closesAt` |
| Closing must be after opening | Closing time must be after opening time. | `days[i].closesAt` |
| A time must be on the hour or half hour, from 05:00 to 23:30, written `HH:mm` | Choose a time on the hour or half hour, from 5:00 AM to 11:30 PM. | `days[i].opensAt` or `days[i].closesAt` |
| All seven days, each once | Send the hours for all seven days, once each. | `days` |
| The version is the stored one's shape | Reload the form and try again. | `version` |

`i` is the day's place in the request list. The last two messages are not in the UI-SPEC; they are for callers that skip the form
and are waiting for the owner's approval. The form never produces them, because it offers only half-hour choices and always sends
seven days.

A `version` that is not the stored one answers `409` with the code `edit.stale` and changes nothing. A save with no change stores
nothing, writes no audit entry and keeps the version. The database also guards each row with two CHECK constraints (both times or
neither, and closing after opening), never a trigger.

### What visitors see

After a save that changes something, the next `GET /api/v1/public/site`, the next `GET /api/v1/public/open-status` and the next page
head show the new hours, because the server clears the public cache after the commit. The page head's JSON-LD lists each open weekday.

### The hours audit entry

Each save that changes something writes one entry with the action `opening-hours.changed` (target type `OpeningHours`, target id
`week`), in the same save. The detail lists each changed day, Monday first, with its old and new times, for example
`monday=closed>09:00-18:00;saturday=09:00-17:00>closed`. A closed day reads `closed`. No person's name is copied.

## Holidays and closures

A closure is a run of days when the shop is closed whatever its weekly hours say. Only a Manager can list, add, edit or delete them.
Each closure is stored with the Manager's stamps and a row version, never a trigger. The database guards each row with two CHECK
constraints: the last day is on or after the first, and a closure is at most 31 days.

### Reading the closures

`GET /api/v1/shop-closures` lists every closure whose last day is today or later in business time (Asia/Manila), earliest first. Past
closures are not listed.

```json
[
  { "id": "01a199fc-2100-780b-893d-eb7a88419f29", "firstDay": "2026-12-24", "lastDay": "2026-12-26", "note": "Christmas", "version": "AAAAAAAAJxQ=" }
]
```

`firstDay` and `lastDay` are `"yyyy-MM-dd"`; a one-day closure has the same value in both. `note` is `null` when there is none.
`version` is what an edit must send back.

### Adding and editing

`POST` and `PUT` take the same form: `{ "firstDay": "2026-12-24", "lastDay": "2026-12-26", "note": "Christmas" }`, and `PUT` adds
`"version"`. Anything else in the body, such as who changed it or when, is ignored: the server stamps the row from the token and the clock.

| Field | Rule | Message |
|---|---|---|
| `firstDay` | Required | "Enter the first day." |
| `firstDay` | A real `yyyy-MM-dd` date | "Enter a real date." |
| `firstDay` | Today or later in business time. An edit may keep a first day that is already past, so the note of a closure that is running can still be fixed; moving it into the past is refused. | "Pick today or a later date." |
| `lastDay` | Optional; left out means one day. A real date. | "Enter a real date." |
| `lastDay` | On or after the first day | "The last day must be on or after the first day." |
| `lastDay` | At most 31 days in all | "A closure can be up to 31 days. Add another one for longer." |
| `note` | At most 80 characters after trimming; an empty note means none | "Keep the note to 80 characters or fewer." |
| `version` | Required on `PUT` | "Reload the form and try again." |

These rules are the same in the browser, which checks them before it sends anything. One rule only the server can check:

**An overlap is a `400` on `firstDay`.** A closure that shares a day with another one is refused with the first shared day, written in
the Philippine short form, for example `"There's already a closure on Dec 25, 2026."`. Closures that only touch (one ends on Dec 25
and the next starts on Dec 26) are fine. When an edit is checked, the closure being edited is left out of the comparison.

**The shop can be busy.** The overlap check runs under the `site-content` lock, one lock for the whole list, so two Managers adding
overlapping closures at the same moment end with one closure stored and one `400`. A request that cannot get the lock within 10
seconds, or that loses a deadlock twice, answers `409` with "Something changed at the same time. Try again." and stores nothing.

A `version` that is not the stored one answers `409` with the code `edit.stale` and changes nothing. A save with no change stores
nothing, writes no audit entry and keeps the version. An unknown id on `PUT` or `DELETE` is `404 shop-closures.not-found`, so
deleting twice gives `204` and then `404`.

### What visitors see

After any add, edit or delete, the server clears the public cache once the change commits. Then:

- `GET /api/v1/public/open-status` treats a closure day as closed: `closedToday` is `true`, `todayClosureNote` holds the note, and
  `nextOpening` skips every closure day.
- `GET /api/v1/public/site` lists the closures that touch the next 30 days in `upcomingClosures`, earliest first.
- The page head's JSON-LD lists the closures that touch the next 60 days as `specialOpeningHoursSpecification` closed days. The note is
  never written there.

### The closure audit entries

Each change writes one entry in the same save, with target type `ShopClosure` and the closure id as target id:

| Action | Detail |
|---|---|
| `shop-closure.added` | `first=2026-12-24;last=2026-12-26`, plus `fields=note` when a note was set |
| `shop-closure.changed` | `first=` and `last=` as the value, or `old>new` when it moved, plus `fields=note` when the note changed |
| `shop-closure.deleted` | `first=2026-12-24;last=2026-12-26` |

The note text is never copied into the audit log: `fields=note` is the whole record of it, and the audit screen reads it as "Note changed".

## Product lines

A product line is one of the lines the Home and Products pages show (basketball, volleyball and so on). Only a Manager can list, read,
add, edit, move, hide, show or delete them. Every change is stamped with the Manager and the clock, audited, and clears the public
cache once it commits, so the next `GET /api/v1/public/product-lines` and the next page head show it with a new `ETag`.

### Reading the lines

`GET /api/v1/product-lines` lists every line, shown and hidden, by `position` (from 1), then by id.

```json
[
  {
    "id": "3a48a1d6-c812-4481-a6be-d7d7412484a0", "key": "basketball", "title": "Basketball Jerseys", "shortName": "Basketball",
    "startsAtPrice": 650.00, "minimumQuantity": 10, "isActive": true, "position": 1, "mainPhotoThumb": null,
    "productTypeIds": ["01a17fce-7800-7f5d-bc6c-5d14ceeca0c6"], "shownGalleryCount": 0, "photoCount": 0,
    "canDelete": false, "version": "AAAAAAAAJxQ="
  }
]
```

`startsAtPrice` and `minimumQuantity` are `null` when not set. `mainPhotoThumb` is `null` until photos arrive and `shownGalleryCount` is
`0` until the gallery arrives. `productTypeIds` are the order product types filed under the line, A to Z. `canDelete` is `true` only
when nothing is filed under the line. `GET /api/v1/product-lines/{id}` adds `number`, `cardText`, `description`, `fabricText`,
`collarText`, `cutText`, `namesText`, `logosText`, `placeholderArt` (`basketball`, `volleyball`, `moto`, `longSleeves`, `polo` or
`custom`), `createdAtUtc`, `updatedAtUtc` and `updatedByName`.

### Adding and editing

`POST` and `PUT` take the same form and `PUT` adds `"version"`:

```json
{
  "title": "Basketball Jerseys", "shortName": "Basketball", "number": "23",
  "cardText": "...", "description": "...",
  "fabricText": "...", "collarText": "...", "cutText": "...", "namesText": "...", "logosText": "...",
  "startsAtPrice": 650.00, "minimumQuantity": 10, "isActive": true, "productTypeIds": ["..."], "version": "AAAAAAAAJxQ="
}
```

Anything else in the body, such as the key, the position, who changed the line or when, is ignored. A new line goes to the end of the
order with the `custom` drawing, and is hidden unless `isActive` is `true`. On an edit a missing `isActive` or `productTypeIds` leaves
the line as it is.

| Field | Rule | Message |
|---|---|---|
| `title` | Required, at most 60 characters after trimming | "Enter the title." · "Keep the title to 60 characters or fewer." |
| `shortName` | Required, at most 20 characters | "Enter a short name." · "Keep the short name to 20 characters or fewer." |
| `shortName` | Not used by another line, ignoring letter case and spaces around it (server only) | "Another product line already uses this short name." |
| `number` | Optional, up to 2 letters or digits | "Use up to 2 letters or digits, like 23 or 3X." |
| `cardText` | Required, at most 140 | "Enter the card text." · "Keep the card text to 140 characters or fewer." |
| `description` | Required, at most 300 | "Enter the description." · "Keep the description to 300 characters or fewer." |
| `fabricText`, `collarText`, `cutText`, `namesText`, `logosText` | Required, at most 120 each | "Enter the Fabric text." (Collar style, Cut & fit, Names & numbers, Logos & sponsors) · "Keep this to 120 characters or fewer." |
| `startsAtPrice` | Optional, ₱0.01 to ₱999,999.99, at most 2 decimals | "Enter a price of at least ₱0.01." · "Enter a price up to ₱999,999.99." · "Use at most 2 decimal places." |
| `minimumQuantity` | Optional, a whole number from 1 to 9,999 | "Enter a whole number from 1 to 9,999." |
| `productTypeIds` | Every id is an order product type that exists | "Reload the form and try again." |
| `version` | Required on `PUT` | "Reload the form and try again." |

These rules are the same in the browser, which checks them before it sends anything.

**The key never changes.** It is made once, when the line is added, from the short name: lower case `a` to `z` and `0` to `9`, words
joined by `-`, and `-2`, `-3` and so on when the key is taken. Renaming the short name later keeps the key, so shared links keep working.
A key reaches a link only after the allow-list check (CWE-601).

**Order product types (D-09).** `productTypeIds` sets exactly which order product types are filed under the line. A type that was under
another line moves here, and a type that was under this line and is not in the list is freed. A type is under at most one line.

A `version` that is not the stored one answers `409 edit.stale` and changes nothing. A save with no change stores nothing, writes no
audit entry and keeps the version. An unknown id is `404 product-lines.not-found` ("This product line wasn't found.").

### Moving, hiding, showing and deleting

- **Move.** `POST /api/v1/product-lines/{id}/move` with `{ "direction": "up" }` or `{ "direction": "down" }` trades places with the line
  next to it in the Manager's list, hidden lines included. It runs under the `site-content` lock, so two Managers moving at once end
  with every place used once. A move at the end of the order is `204` and changes and records nothing. The same request sent twice
  with one `Idempotency-Key` moves once.
- **Hide and show.** `POST .../hide` takes the line, and everything filed under it, off the public site; nothing is lost. `POST .../show`
  puts it back. Doing either twice is `204` and records once.
- **Delete.** `DELETE` removes a line only when nothing is filed under it. A line with a photo, a gallery item or an order product type
  answers `422 product-lines.in-use` with "This product line is in use. Hide it instead." and nothing is deleted.

### The product line audit entries

Each change writes entries in the same save. A product line entry has target type `ProductLine` and the line id as target id.

| Action | Detail |
|---|---|
| `product-line.added` | `key=shorts;title=Shorts` |
| `product-line.changed` | `fields=` naming every changed field in form order, then `title=old>new`, `shortName=old>new`, `price=old>new` and `minimum=old>new` for the ones that changed (an empty side means none). The long texts are named, never copied. |
| `product-line.moved` | `title=Volleyball Jerseys;position=2>1` |
| `product-line.hidden`, `product-line.shown` | `key=polo;title=Polo Shirts` |
| `product-line.deleted` | `key=shorts;title=Shorts` |
| `product-type.line-linked` | target type `ProductType`, the type id as target id, `line=old title>new title`; an empty side means no line |

A flip of `isActive` in an edit writes `product-line.shown` or `product-line.hidden`.

## Product line photos

A line has three photo places, called slots: `main` (the large front photo), `back` (the back view) and `fabric` (the fabric detail).
A slot holds at most one photo. Only a Manager can put a photo in or take it out. An Admin gets `403` and no token gets `401`.

| Method and path | Who | Answers |
|---|---|---|
| `POST /api/v1/product-lines/{lineId}/photos/{slot}` | Manager | `200` the photo below; `400` no file or a file that is not a photo we can use; `401`; `403`; `404` for a line or a slot word that does not exist; `409` when two saves lost a race; `413` for a body over the limit; `429`; `503` when photo storage is not set up. Needs an `Idempotency-Key`. |
| `DELETE /api/v1/product-lines/{lineId}/photos/{slot}` | Manager | `204`; `401`; `403`; `404` for a line or a slot word that does not exist, or a slot that is already empty; `409` when two saves lost a race. |

The slot in the path is `main`, `back` or `fabric`; any other word is `404`.

### Putting a photo in

`POST` takes a multipart form with the file in the `file` part. The same rules as the order photos apply, with the same messages: the
type is read from the first bytes (JPG, PNG, WEBP or HEIC, never SVG), the file is at most 10 MB and 25 megapixels, and the location and
camera data are removed before the file is stored. The photo is stored under a random id in this environment's content folder,
`{root}/content/lines/{lineId}/`, never in the orders folder, and the client never chooses the id. A slot that already holds a photo is
replaced: the row stays, and the old file is queued for removal in the same save and leaves the storage on the next monthly cleanup run.
Nothing calls the storage to delete during the request.

```json
{
  "slot": "main",
  "src": "https://res.cloudinary.com/example/image/private/t_csps_cat_640/v1/csps/content/lines/3a48a1d6-c812-4481-a6be-d7d7412484a0/abcdefghijklmnopqrstuvwxyz",
  "srcSet": "... 320w, ... 480w, ... 640w",
  "width": 1600,
  "height": 1200
}
```

`src` and `srcSet` are a preview for the editor: the 4:5 card sizes for `main`, the square sizes for `back` and `fabric`. `width` and
`height` are the stored upright size. Every address comes from the server; a screen never builds one.

### Where the photos show

- `GET /api/v1/product-lines` fills `mainPhotoThumb` with the 44 px square address of the main photo, and `photoCount` counts the slots in use.
- `GET /api/v1/product-lines/{id}` has a `photos` object with `main`, `back` and `fabric`; a slot with no photo is `null`.
- `GET /api/v1/public/product-lines` fills `photos.main` (the large product cell sizes, 400 to 1280 wide), `photos.back` and `photos.fabric`
  (the square sizes, 200 to 720 wide) for shown lines only, each with `src`, `srcSet`, `width` and `height`. A slot with no photo is `null`
  and the page draws the placeholder.
- The Products page head uses the first shown line's main photo as the link preview picture: `og:image` at the 1200 x 630 size
  (`csps_share_1200`), `og:image:width` `1200`, `og:image:height` `630`, `og:image:alt` the business name, and `twitter:card`
  `summary_large_image`. When that line has no main photo the picture tags are left out and `twitter:card` is `summary`.

### Rules that hold together

- A line with a photo cannot be deleted: `422 product-lines.in-use`. The delete and the photo writes take the same `site-content`
  lock, so an upload and a delete of the same line at the same moment end as a `422` for the delete or a `404` for the upload, never a
  `500`. A file uploaded just before the line vanished is queued for removal.
- Every upload is rate limited with the same cap as the order photo upload (30 in 10 minutes for one address) and bounded by the
  same body limit.
- Photo addresses are never written to the audit log or the server log.

### The photo audit entry

Each add, replace or removal writes `product-line.photo-changed` in the same save. The target type is `ProductLine` and the target id is
the line id. The detail is `key=basketball;title=Basketball Jerseys;slot=main;change=added`, where the change is `added`, `replaced` or
`removed`. It never holds an address or a file id.

## The audit entry

Each save that changes something writes one entry with the action `site-settings.changed`, in the same save as the change. The
detail starts with `fields=` and names every changed field, such as `fields=businessName,tagline,phones`. For the business name and
the six links it also shows the old and the new value, as `businessName=Old>New`. A long text, the email and the phone numbers
are named and never copied. If a pair would push the detail past 400 characters, it is left out and the field is still named.

---
created: 2026-11-11T23:50:00-06:00
updated: 2026-11-12T03:13:00-05:00
---

# The site content API

This is the contract behind the Site Content screens that a Manager uses to keep the public website current, and the one a future
Android app will use. Everything here is under `/api/v1`. The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at
`/scalar`) is the machine-readable twin of this page; the web app's types are generated from it
(`web/src/types/api.generated.ts`). Sign-in and the access token are in [auth.md](auth.md). What visitors read is in
[public-site.md](public-site.md).

Right now this page covers the Business Info save and the weekly opening hours. The closures, product lines, testimonials and
gallery routes join this page in later plans.

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

## The audit entry

Each save that changes something writes one entry with the action `site-settings.changed`, in the same save as the change. The
detail starts with `fields=` and names every changed field, such as `fields=businessName,tagline,phones`. For the business name and
the six links it also shows the old and the new value, as `businessName=Old>New`. A long text, the email and the phone numbers
are named and never copied. If a pair would push the detail past 400 characters, it is left out and the field is still named.

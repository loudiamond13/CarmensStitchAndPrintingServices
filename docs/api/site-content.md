---
created: 2026-11-11T23:50:00-06:00
updated: 2026-11-11T23:50:00-06:00
---

# The site content API

This is the contract behind the Site Content screens that a Manager uses to keep the public website current, and the one a future
Android app will use. Everything here is under `/api/v1`. The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at
`/scalar`) is the machine-readable twin of this page; the web app's types are generated from it
(`web/src/types/api.generated.ts`). Sign-in and the access token are in [auth.md](auth.md). What visitors read is in
[public-site.md](public-site.md).

Right now this page covers the Business Info save. The hours, closures, product lines, testimonials and gallery routes join this
page in later plans.

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

## The audit entry

Each save that changes something writes one entry with the action `site-settings.changed`, in the same save as the change. The
detail starts with `fields=` and names every changed field, such as `fields=businessName,tagline,phones`. For the business name and
the six links it also shows the old and the new value, as `businessName=Old>New`. A long text, the email and the phone numbers
are named and never copied. If a pair would push the detail past 400 characters, it is left out and the field is still named.

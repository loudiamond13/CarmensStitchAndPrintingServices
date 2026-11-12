---
created: 2026-11-11T20:07:28-06:00
updated: 2026-11-12T05:30:00-06:00
---

# The public site

This page says what the server sends to visitors and crawlers for the public website. Later Phase 11 plans add the public gallery
read to this page.

## In plain words

1. **The server sends each page's own head.** Link-preview crawlers (Facebook, Messenger) never run JavaScript. So the page title,
   description, canonical address and Open Graph tags are in the first response, before any script.
2. **The server sends the real status.** A known page is `200`. A path the site does not know is `404` with the same page shell,
   so the browser can still draw the "Page Not Found" screen. Search engines see a real 404.
3. **Every address comes from `App:PublicBaseUrl`.** The canonical link, `og:url`, `robots.txt` and `sitemap.xml` never use the
   request's Host header or the raw request path. A forged Host header changes none of them.

## The shell endpoint

One endpoint answers every path that is not a file and not an API path (`{*path:nonfile}`). It answers **GET** and **HEAD** only.
HEAD gets the status and headers with no body. POST, PUT and DELETE on a page path meet the default-deny rule and get `401` when
signed out.

It reads the built `index.html` once and replaces the block between `<!--csps:head-->` and `<!--/csps:head-->` with the head for
the matched route. `index.html` itself is never served as a raw file.

### The route table

| Path | Status | Head |
|---|---|---|
| `/`, `/products`, `/gallery`, `/contact` | `200` | The page's own head (below) |
| `/admin` and `/admin/*` | `200` | The default head plus `<meta name="robots" content="noindex, nofollow">`, and the header `X-Robots-Tag: noindex, nofollow` |
| `/dev` and `/dev/*` | `200` in Development and Testing, `404` in Production | The default head |
| Anything else | `404` | Title "Page Not Found · CSPS", the 404 description, and `noindex, nofollow` |
| `/api/*` that nothing answers | `404` | A ProblemDetails body, not the shell |

Paths match without regard to case and with one optional trailing slash, as the browser router does. `/Products` and `/products/`
are the Products page. The canonical address is always the lower-case path without the slash. The list of pages is shared with
the client tests in `tests/fixtures/public-paths.json`.

### The head of a page

- `title` and `meta name="description"`: the strings in the UI spec (Home's description is the shop tagline).
- `link rel="canonical"` and `og:url`: `{PublicBaseUrl}{path}`.
- `og:type` `website`, `og:site_name` (the business name from the site settings), `og:locale` `en_PH`, `og:title`,
  `og:description`.
- A `LocalBusiness` JSON-LD block and the boot data block (both below), on every public page.

Every attribute value is HTML-encoded. Later plans add the share picture tags.

If the public site facts cannot be read, the page is still sent with the same status. It carries the template's own head (and the
noindex tag where it applies) and no data blocks, and the failure is logged once until a read works again. It is never a 500.

The shaped head of each page is cached under the `public-content` tag for at most one hour. A committed content change clears it at
once, so the next page shows the new value.

### The LocalBusiness data

Every public page (not the 404 page) carries one `<script type="application/ld+json">` block:

| Field | Value |
|---|---|
| `@context`, `@type` | `https://schema.org`, `LocalBusiness` |
| `name` | The business name |
| `description` | The about text; the tagline when there is no about text |
| `url` | `App:PublicBaseUrl` |
| `telephone` | The main number in E.164 form, such as `+639171234567` |
| `address` | A `PostalAddress` with `streetAddress`, `addressLocality`, `addressRegion`, `postalCode` (only the parts that are set) and `addressCountry` `PH`; left out when no part is set |
| `openingHoursSpecification` | One `OpeningHoursSpecification` for each open weekday, with `dayOfWeek` (`Monday` to `Sunday`), `opens` and `closes` as `"HH:mm"`; left out when no day is open |
| `specialOpeningHoursSpecification` | One closed-day `OpeningHoursSpecification` for each closure that touches the next 60 days, earliest first, with `opens` and `closes` both `"00:00"` and `validFrom` and `validThrough` as `"yyyy-MM-dd"` (the same value for a one-day closure); the note is never written; left out when there is none |
| `sameAs` | The Facebook, Instagram and TikTok links that are set; left out when none is |

A value that is not set is left out. There is no `email` (D-25). The JSON is written by the JSON serializer with its default
encoder, which escapes `<`, `>` and `&`, so typed text can never close the script block.

### The boot data block

Every public page and the 404 shell carry `<script type="application/json" id="csps-boot">` holding `{ "site": ... }`, where the
value is the same JSON as `GET /api/v1/public/site` (below). The `/products` page also carries `"productLines"`, the same JSON as
`GET /api/v1/public/product-lines` (below), so the Products page needs no request on the first visit. No other page has that key. The
browser does not run a data block, so the first visit needs no request. `/admin` and `/dev` pages carry no boot block.

If the product lines cannot be read, `/products` is still sent with the `site` data and no `productLines` key, and that answer is not
cached, so the next visit tries again. The page then fetches the lines from the API.

### Caching

The shell sends `Cache-Control: no-cache` and a **weak** `ETag` (`W/"..."`). It is weak because the body is compressed after the
tag is set. A request with a matching `If-None-Match` gets `304` with no body. A `404` is always sent in full.

## robots.txt and sitemap.xml

Both answer GET and HEAD, anonymously, with `Cache-Control: no-cache`. They have no rate limit, so a crawler is never refused.
Neither is in the OpenAPI document.

- `GET /robots.txt` (`text/plain`): allows the site, disallows `/admin` and `/api`, and names `{PublicBaseUrl}/sitemap.xml`.
- `GET /sitemap.xml` (`application/xml`): one `url` entry for `/`, `/products`, `/gallery` and `/contact` under the configured
  origin. Each entry has `lastmod`, the date (`yyyy-MM-dd`, UTC) of the newest change to the public site facts. When the facts
  cannot be read, the entries are sent without `lastmod`.

There are no static `robots.txt` or `sitemap.xml` files. The static file middleware also ignores any such file in the web
root, so an old copy can never hide the real answer.

## GET /api/v1/public/site

The shop facts every visitor sees. Anonymous, never compressed, limited per address (see below). Operation name `GetPublicSite`.

```json
{
  "businessName": "Sample Shop",
  "tagline": "A sample tagline.",
  "aboutText": null,
  "turnaroundLine": "Mockups in 24 hours.",
  "address": { "street": "12 Sample St., Poblacion", "townOrCity": "Sample City", "province": "Sample Province", "postalCode": "1000" },
  "phones": [
    { "display": "0917 123 4567", "e164": "+639171234567", "label": "Globe", "isMain": true },
    { "display": "02 8123 4567", "e164": "+63281234567", "label": null, "isMain": false }
  ],
  "messengerUrl": "https://m.me/cspsdemo",
  "facebookUrl": null,
  "instagramUrl": null,
  "tiktokUrl": null,
  "directionsUrl": null,
  "mapEmbedUrl": null,
  "year": 2026,
  "hours": [
    { "day": 1, "opensAt": "09:00", "closesAt": "18:00" },
    { "day": 2, "opensAt": "09:00", "closesAt": "18:00" },
    { "day": 3, "opensAt": "09:00", "closesAt": "18:00" },
    { "day": 4, "opensAt": "09:00", "closesAt": "18:00" },
    { "day": 5, "opensAt": "09:00", "closesAt": "18:00" },
    { "day": 6, "opensAt": "09:00", "closesAt": "18:00" },
    { "day": 7, "opensAt": null, "closesAt": null }
  ],
  "upcomingClosures": []
}
```

- **Everything comes from the database.** A value that is not set is `null` (never a placeholder, never `#`), the address parts are
  `null` one by one, and `phones` is an empty list when none is stored. The main number is first.
- **No email.** The shop email is stored for staff use only and is never selected for a public answer (D-25).
- **`hours`** is always seven days, Monday (1) first, with `"HH:mm"` times in business time. A closed day has `null` for both. Until a
  Manager saves hours every day is closed; the server never invents hours.
- **`upcomingClosures`** lists the closures that touch the next 30 days (the last day is today or later and the first day is within 30
  days), earliest first, each as `{ firstDay, lastDay, note }` with `"yyyy-MM-dd"` days. A closure that is running now is included.
  The list is empty when a Manager has added none.
- **`year`** is the current year in the business zone, for the footer's copyright line. The snapshot is rebuilt at least every hour,
  so it changes on 1 January without a write.

### Caching

| Request | Answer |
|---|---|
| No `If-None-Match` | `200` with a strong `ETag` and `Cache-Control: no-cache` |
| `If-None-Match` equal to the current `ETag` (or `*`) | `304`, no body, same `ETag` |
| `If-None-Match` different | `200` with the current body |

The `ETag` is a SHA-256 hash of the exact JSON bytes, so it changes exactly when the answer does. The answer is read from one
in-process snapshot (a second read runs no SQL command). A committed change to the settings or the phone list clears the snapshot
after the commit, never before it and never on a rollback, so the first read after a change shows the new value and a new `ETag`
(PUB-03, CONT-05).

### Rate limit

`/api/v1/public/*` allows 600 reads a minute per address (a sliding window of six parts; `RateLimits:PublicRead`). The next read
gets `429` with `Retry-After`. The page shell, `robots.txt` and `sitemap.xml` have no limit, so a crawler or a widely shared link is
never refused.

## GET /api/v1/public/product-lines

The product lines a visitor sees on the Home and Products pages, in display order. Anonymous, never compressed, limited per address like
the site read. Operation name `GetPublicProductLines`.

```json
{
  "lines": [
    {
      "key": "basketball",
      "number": "23",
      "title": "Basketball Jerseys",
      "shortName": "Basketball",
      "cardText": "Full sublimation tops and shorts, any colorway, names and numbers included.",
      "description": "Game-ready tops and shorts, printed edge to edge in any colorway. Built for full-court runs and summer liga heat.",
      "customize": {
        "fabric": "Dri-fit mesh, aircool or spandex blend",
        "collar": "V-neck, round or layered",
        "cut": "Standard, slim, women's fit and kids",
        "names": "Any font: front, back and shorts",
        "logos": "Team crest, sponsors and barangay seal in full color"
      },
      "startsAtPrice": null,
      "minimumQuantity": null,
      "placeholderArt": "basketball",
      "photos": { "main": null, "back": null, "fabric": null },
      "hasGalleryItems": false
    }
  ]
}
```

- **Only shown lines.** A line a Manager has hidden is left out. With no line shown the answer is `{ "lines": [] }` with status `200`.
- **Order.** Lines come in their position order, and lines that share a position come in a fixed order, so the list never shuffles.
- **Price.** `startsAtPrice` is the price per piece in pesos as a number, or `null`. A line with no price reads "Message us for a
  price" on the page; the server never sends a placeholder or an invented price. `minimumQuantity` is a whole number of pieces, or `null`.
- **`customize`** holds the five "what you can customize" texts, in the order the page shows them: Fabric, Collar style, Cut and fit,
  Names and numbers, Logos and sponsors.
- **`placeholderArt`** names the drawing the page shows until the line has photos: `basketball`, `volleyball`, `moto`, `longSleeves`,
  `polo` or `custom`.
- **`photos`** has the three slots `main`, `back` and `fabric`. A slot is `null` until a photo is added (a later plan), or an object
  `{ src, srcSet, width, height }`.
- **`hasGalleryItems`** is `false` until the Gallery plan lists items under the line.
- **Caching and limit** are the same as the site read: a strong `ETag`, `Cache-Control: no-cache`, `304` on a match, one cached
  snapshot under the `public-content` tag, and 600 reads a minute per address. A committed change to a line or its photos clears the
  snapshot after the commit.

### The six starting lines

A new database gets six lines from the `AddProductLines` migration, once: basketball, volleyball, moto, long sleeves, polo and custom,
shown, with no price and no minimum. Production gets them through the reviewed idempotent migration script, which holds the six
inserts and runs them only when the migration is not yet recorded. The model has no `HasData` for them, nothing seeds or migrates at
startup, and a later deploy never overwrites a Manager's edits. A Manager adds the prices before the site goes live.

## GET /api/v1/public/open-status

Whether the shop is open now, worked out by the server in business time (Asia/Manila) from the stored hours, so every visitor sees the
same answer whatever their phone says (PUB-05, D-22). Anonymous and limited per address like the site read. Operation name
`GetOpenStatus`.

```json
{
  "isOpen": false,
  "closesAt": null,
  "closedToday": false,
  "todayClosureNote": null,
  "nextOpening": { "date": "2026-11-23", "day": 1, "opensAt": "09:00", "when": "weekday" }
}
```

| Member | Meaning |
|---|---|
| `isOpen` | `true` when the shop is open at this instant: no closure today and the time is from the opening time up to, not including, the closing time |
| `closesAt` | The closing time today as `"HH:mm"` when open; otherwise `null` |
| `closedToday` | `true` when a closure covers today; the shop is then closed whatever the weekly hours say |
| `todayClosureNote` | The note of the closure that covers today; `null` when none or no note |
| `nextOpening` | When the shop opens next within 14 days; `null` when open, or when nothing opens in that time (for example while every day is closed) |

`nextOpening.when` is `"today"` (it opens later today), `"tomorrow"` or `"weekday"` (a later day). `day` is 1 (Monday) to 7 (Sunday) and
`date` is the business date, and a day covered by a closure is never the next opening. The page turns these facts into words; it does
no time maths of its own.

Unlike the other public reads, this answer has no `ETag` and is sent with `Cache-Control: public, max-age=60`, so a phone or a CDN may
keep it for a minute. The hours come from the same cached snapshot as the site read, and a committed hours change clears it, so the
next read after a save is current.

## The stored settings

The Business Info fields live on the one `SiteSettings` row, and the phone numbers in `SitePhoneNumbers` (at most four, a unique E.164
number each, one main number). The old `ContactPhone` and `AddressLine` columns stay in the table, unused, until the owner approves
a cleanup (D-39). The shop email and the Facebook link start empty; where the old bracket text was still stored, the
`AddSiteContactDetails` migration blanks it and copies nothing into a new field.

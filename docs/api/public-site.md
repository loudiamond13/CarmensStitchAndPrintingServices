---
created: 2026-11-11T20:07:28-06:00
updated: 2026-11-11T22:00:33-06:00
---

# The public site

This page says what the server sends to visitors and crawlers for the public website. Later Phase 11 plans add the public JSON
reads (product lines, gallery, open status) to this page.

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
| `sameAs` | The Facebook, Instagram and TikTok links that are set; left out when none is |

A value that is not set is left out. There is no `email` (D-25). The JSON is written by the JSON serializer with its default
encoder, which escapes `<`, `>` and `&`, so typed text can never close the script block.

### The boot data block

Every public page and the 404 shell carry `<script type="application/json" id="csps-boot">` holding `{ "site": ... }`, where the
value is the same JSON as `GET /api/v1/public/site` (below). The browser does not run a data block, so the first visit needs no
request. `/admin` and `/dev` pages carry no boot block.

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
  "year": 2026
}
```

- **Everything comes from the database.** A value that is not set is `null` (never a placeholder, never `#`), the address parts are
  `null` one by one, and `phones` is an empty list when none is stored. The main number is first.
- **No email.** The shop email is stored for staff use only and is never selected for a public answer (D-25).
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

## The stored settings

The Business Info fields live on the one `SiteSettings` row, and the phone numbers in `SitePhoneNumbers` (at most four, a unique E.164
number each, one main number). The old `ContactPhone` and `AddressLine` columns stay in the table, unused, until the owner approves
a cleanup (D-39). The shop email and the Facebook link start empty; where the old bracket text was still stored, the
`AddSiteContactDetails` migration blanks it and copies nothing into a new field.

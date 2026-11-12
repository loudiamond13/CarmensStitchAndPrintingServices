---
created: 2026-11-11T20:07:28-06:00
updated: 2026-11-11T20:07:28-06:00
---

# The public site

This page says what the server sends to visitors and crawlers for the public website. Later Phase 11 plans add the public JSON
reads (site settings, product lines, gallery, open status) to this page.

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

Every value is HTML-encoded. Later plans add the share picture tags and the `LocalBusiness` data.

If the site settings cannot be read, the page is still sent with the same status. It carries the template's own head (and the
noindex tag where it applies), and the failure is logged once until a read works again. It is never a 500.

### Caching

The shell sends `Cache-Control: no-cache` and a **weak** `ETag` (`W/"..."`). It is weak because the body is compressed after the
tag is set. A request with a matching `If-None-Match` gets `304` with no body. A `404` is always sent in full.

## robots.txt and sitemap.xml

Both answer GET and HEAD, anonymously, with `Cache-Control: no-cache`. They have no rate limit, so a crawler is never refused.
Neither is in the OpenAPI document.

- `GET /robots.txt` (`text/plain`): allows the site, disallows `/admin` and `/api`, and names `{PublicBaseUrl}/sitemap.xml`.
- `GET /sitemap.xml` (`application/xml`): one `url` entry for `/`, `/products`, `/gallery` and `/contact` under the configured
  origin. There is no `lastmod` yet.

There are no static `robots.txt` or `sitemap.xml` files. The static file middleware also ignores any such file in the web
root, so an old copy can never hide the real answer.

---
phase: 11-public-site-content-management
plan: 02
subsystem: api
tags: [aspnetcore, seo, open-graph, robots, sitemap, spa-hosting, minimal-api]
created: 2026-11-11T20:20:00-06:00
updated: 2026-11-11T20:20:00-06:00

requires:
  - phase: 02-web-host
    provides: SpaHosting fallbacks, HiddenSegmentFileProvider, SpaCaching, response compression
  - phase: 03-email
    provides: AppLinksOptions.PublicBaseUrl (the only origin the server trusts)
provides:
  - ShellPage: shaped GET/HEAD shell endpoint with the page's own head and real status
  - PublicRouteTable: known pages, admin, dev and 404 matching (the one list for the server and the client tests)
  - PublicPageHeads, PublicHeadWriter: per-page title and description, HTML-encoded head tags
  - SeoEndpoints: robots.txt and sitemap.xml from App:PublicBaseUrl
  - tests/fixtures/public-paths.json shared page list
affects: [11-07, 11-08, 11-11, 11-13, 11-19, 11-26, 11-30]

requirements-completed: [PUB-04, PUB-01]

actuals:
  tokens: 18700
  tasks: 3
  commits: 5
plan_head_before: 24e4cef7ec03832dbb2b7fd29c27fa1abbe989bf
plan_head_after: 1df0fa675ffbcbb4959a6d349243b473615dace5

tech-stack:
  added: []
  patterns:
    - "Shaped shell: split the built index.html at csps:head markers, fill per route, weak ETag, 304"
    - "Server-written files (index.html, robots.txt, sitemap.xml) are hidden from UseStaticFiles"
    - "Origin only from App:PublicBaseUrl; request text is never echoed into HTML"

key-files:
  created:
    - src/Csps.Server/Endpoints/ShellPage.cs
    - src/Csps.Server/Endpoints/PublicRouteTable.cs
    - src/Csps.Server/Endpoints/PublicPageHeads.cs
    - src/Csps.Server/Endpoints/PublicHeadWriter.cs
    - src/Csps.Server/Endpoints/SeoEndpoints.cs
    - tests/fixtures/public-paths.json
    - tests/Csps.Server.IntegrationTests/Http/ShellPageTests.cs
    - tests/Csps.Server.IntegrationTests/Http/SeoEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Http/PublicRouteTableTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ShellTestFactory.cs
    - docs/api/public-site.md
  modified:
    - src/Csps.Server/Endpoints/SpaHosting.cs
    - src/Csps.Server/Composition/SpaRegistration.cs
    - src/Csps.Server/Program.cs
    - web/index.html
    - web/e2e/public.spec.ts
    - web/src/test/build-output.node.test.ts
    - tests/Csps.Testing/Fixtures/webroot/index.html
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs
  deleted:
    - web/public/robots.txt
    - tests/Csps.Testing/Fixtures/webroot/robots.txt

key-decisions:
  - "Home's description is the approved tagline constant until plan 11-07 reads the stored one"
  - "The site settings are read only for known pages; admin, dev and 404 need no database"
  - "Head text goes through a Latin-1 HTML encoder so the middle dot in the titles stays readable"
  - "Static files also ignore robots.txt and sitemap.xml, so a stale copy can never shadow the endpoints"

duration: about 60min
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 02: Server-shaped shell, real 404, robots.txt and sitemap.xml Summary

**One shaped GET/HEAD shell endpoint gives each public page its own title, description, canonical and Open Graph tags in the first response, with real 200/404 statuses, admin noindex, and robots.txt and sitemap.xml built only from App:PublicBaseUrl.**

## Performance

- **Duration:** about 60 min
- **Started:** 2026-11-11T19:12:00-06:00 (approx.)
- **Completed:** 2026-11-11T20:20:00-06:00
- **Tasks:** 3 (1 tracer, 2 auto), all TDD where the plan said so
- **Files modified:** 22 (11 created, 9 modified, 2 deleted)

## Accomplishments

- A no-JS GET of `/`, `/products`, `/gallery` and `/contact` answers 200 with that page's own title, meta description, canonical link and `og:type`, `og:site_name`, `og:locale en_PH`, `og:title`, `og:description`, `og:url`.
- Any other non-file, non-API path (`/nope`, `/products/old`, `/products//`, `/administrator`) answers a real 404 with the shell, "Page Not Found" title and `noindex, nofollow`. `/api/*` unknowns stay ProblemDetails 404.
- `/admin` and `/admin/*` answer 200 with the meta robots tag and `X-Robots-Tag: noindex, nofollow`. `/dev/*` is known only in Development and Testing (404 in Production).
- Matching is case-insensitive with one optional trailing slash; the canonical stays the lower-case path. The server's page list equals `tests/fixtures/public-paths.json`.
- GET and HEAD only (POST, PUT, DELETE on a page path give 401); weak ETag, `Cache-Control: no-cache`, 304 on a match; HEAD has no body.
- Forged Host header changes nothing: canonical, `og:url`, robots.txt and sitemap.xml use `App:PublicBaseUrl` only.
- `/robots.txt` allows the site, disallows `/admin` and `/api`, names the sitemap; `/sitemap.xml` lists the four pages. The static robots.txt files are gone.
- `/index.html` is never served raw (ProblemDetails 404); the build keeps both `csps:head` markers.

## Raw no-JS response heads (from the test host, fixture web root, stub settings)

```
GET /products -> 200
Cache-Control: no-cache
ETag: W/"B7502FF2BFBC7D9A16084A62C1DFF2EB"
Content-Type: text/html; charset=utf-8
    <title>Products and Prices · CSPS</title>
    <meta name="description" content="See our product lines, starting prices and everything you can customize, from fabric to names and numbers.">
    <link rel="canonical" href="https://localhost/products">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Test Shop&#x27;s Name &amp; Co">
    <meta property="og:locale" content="en_PH">
    <meta property="og:title" content="Products and Prices · CSPS">
    <meta property="og:description" content="See our product lines, ...">
    <meta property="og:url" content="https://localhost/products">

GET /nope -> 404
Cache-Control: no-cache
Content-Type: text/html; charset=utf-8
    <title>Page Not Found · CSPS</title>
    <meta name="description" content="This page couldn&#x27;t be found.">
    <meta name="robots" content="noindex, nofollow">

GET /admin/orders -> 200
X-Robots-Tag: noindex, nofollow
    <meta name="robots" content="noindex, nofollow">
```

## Task Commits

1. **Task 1 (tracer): own head and real 404** - RED `fbbb33b2` (test), GREEN `4c11bc03` (feat)
2. **Task 2: robots.txt and sitemap.xml** - RED `c86b85f0` (test), GREEN `4a6dc824` (feat)
3. **Task 3: e2e follows the 404, API doc** - `1df0fa67` (docs)

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

RED/GREEN pairs exist for both TDD tasks, in order. The plan frontmatter is `type: execute`, so the format-based RED classifier is not required; the failing runs were read for the right reason.

- **Task 1 RED:** 39 of 80 tests failed on planned assertions (page title and canonical missing, 404 not returned, ETag not weak, dev path not 404 in Production, `/index.html` served raw, route table empty). Web: `keeps the head markers the server fills with each page head` failed. A `PublicRouteTable` skeleton that matches nothing was committed with the RED so the tests compile; it makes them fail on assertions, not on a build error.
- **Task 2 RED:** 14 of 465 failed: sitemap 404, robots.txt content (`["User-agent: *", "Disallow:"]` instead of the new lines), matrix rows and allow-list keys matching no endpoint (`DiscoveredEndpointsAreFullyCovered`).
- No REFACTOR commit was needed.

## Verification evidence (real output)

- Task 1 GREEN: `ShellPageTests`, `PublicRouteTableTests`, `SpaHostTests`: total 80, failed 0, succeeded 80. Web `build-output.node.test.ts`: `Tests 29 passed (29)`.
- Task 2 GREEN: `SeoEndpointTests`, `AuthorizationMatrixTests`, `AuthorizationCoverageTests`, `SpaHostTests`, `ShellPageTests`, `PublicRouteTableTests`: total 521, failed 0.
- Final regression: namespaces `Http`, `Authorization`, `Logging` of the server integration tests on a clean solution build: total 798, failed 0. Architecture tests: total 290, failed 0.
- Task 3: `npm --prefix web run e2e -- --grep @public`: `30 passed (40.2s)` (chromium, pixel, webkit, firefox, iphone).
- `dotnet build Csps.slnx`: 0 warnings, 0 errors. `dotnet format Csps.slnx --verify-no-changes`: clean. Web: typecheck, ESLint `--max-warnings 0` and Prettier clean on the changed files.
- Acceptance greps: `MapFallbackToFile` in SpaHosting.cs = 0; `HttpMethodMetadata` = 1; `csps:head` in web/index.html = 3 (two markers and one comment), in the fixture = 2; `Request.Host` in PublicHeadWriter.cs (non-comment) = 0; `"/contact"` in the shared list = 1; both robots.txt files absent; `/sitemap.xml` in the matrix = 4; `Disallow: /admin` in SeoEndpoints.cs = 1; `404` in public.spec.ts = 4; docs frontmatter shows `created:` and `updated:`.
- gitleaks `protect --staged` ran before every commit: no leaks.

## Decisions Made

- **Home description** is the approved tagline constant `PublicPageHeads.HomeTagline` until plan 11-07 reads the stored tagline.
- **Settings are read only for known pages.** Admin, dev and 404 heads need no database, so a database outage never touches them. A failure on a known page sends the template's own head with the same status and logs one warning until a read works again (an `Interlocked` flag, so an outage does not log once per request).
- **Latin-1 HTML encoder** (`HtmlEncoder.Create(BasicLatin, Latin1Supplement)`) instead of `HtmlEncoder.Default`: the default turns the middle dot in the titles into `&#xB7;`, which breaks the plan's literal `<title>Products and Prices · CSPS</title>`. The five markup characters (`< > & ' "`) are still always escaped (tested with `A<b>"x"&</b>`), so the XSS protection is the same.
- `PublicPageHeads`, `PublicHeadModel` and `PublicHeadWriter` are internal; `PublicRouteTable`, `ShellPage` and `SeoEndpoints` are public (tests and later plans use them).
- Tracer gate: automated-only `<verify>`, `human_verify_mode` default; the tracer's verify was re-run end to end (80/80 and 29/29) before expanding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] One-line change in Program.cs**
- **Found during:** Task 1
- **Issue:** `UseStaticFiles` was built in `Program.cs` with its own options, so hiding `/index.html` from static files could not be done from `SpaRegistration.cs` alone. `Program.cs` is not in the plan's `files_modified`.
- **Fix:** `app.UseStaticFiles(SpaCaching.CreateStaticFileOptions(app.Environment.WebRootFileProvider))`; the provider wrapper lives in `SpaRegistration.cs`.
- **Files modified:** src/Csps.Server/Program.cs, src/Csps.Server/Composition/SpaRegistration.cs
- **Committed in:** 4c11bc03

**2. [Rule 2 - Missing critical] The static file provider also hides robots.txt and sitemap.xml**
- **Found during:** Task 2
- **Issue:** Static files run before endpoints. The plan deletes the two robots.txt files, but any stale or deployed copy in the web root would silently shadow the endpoint and its configured origin.
- **Fix:** `ServerWrittenFileProvider` hides `index.html`, `robots.txt` and `sitemap.xml` (case-insensitive, either slash). The static robots.txt files are deleted as planned.
- **Committed in:** 4a6dc824

**3. [Rule 3 - Blocking] Test host helper**
- **Found during:** Task 1
- **Issue:** Hosts without a database would make the real settings reader fail, so the head tests need a stub reader. `CspsApiFactory` is shared with other plans in this wave and not in the plan's file list.
- **Fix:** New `tests/Csps.Server.IntegrationTests/Http/ShellTestFactory.cs` (a `CspsApiFactory` subclass with a stub `ISiteSettingsReader`). `CspsApiFactory` is untouched.
- **Committed in:** fbbb33b2

**4. [Plan wording] RED commit carries a skeleton**
- `PublicRouteTable` was committed as a skeleton with the RED tests so they compile and fail on assertions (see TDD Gate Compliance).

**5. [Process] Plan commit ledger not written**
- The harness refused the compound git command that writes the `gsd-plan-head-before` and spawn-toplevel files. `plan_head_before` is the spawn base (`24e4cef7...`, asserted at start) and `commits: 5` is `git rev-list --count 24e4cef7..HEAD` measured before this SUMMARY commit.

**Total deviations:** 3 auto-fixed (1 Rule 2, 2 Rule 3), 2 process notes. **Impact:** no scope creep; items 1 and 2 follow from the plan's own aim (the raw template and static robots must never answer).

## Issues Encountered

- **Flake recorded:** in the first (RED) run of `build-output.node.test.ts` the test `contains no dev preview module: no asset carries "Development only"` timed out at the 5 s default while the machine was busy with the in-process Vite build. It is unrelated to this plan and passed in every later run (29/29). Not changed.
- The plan's `<verify>` for Task 3 resets and reseeds `CSPS_E2E` (guarded dev-seed tool, owner-approved database) and used port 5199. Preflight showed all ports free first. No process was left running.
- Not run here: Lighthouse and the full web unit suite (this plan changes no client code besides one e2e spec and one test).

## Known Stubs

None. Home's description uses the approved tagline constant on purpose; plan 11-07 replaces it with the stored tagline.

## Threat Flags

None new. Planned mitigations are in place: T-11-03 (forged Host tests in `ShellPageTests` and `SeoEndpointTests`), T-11-04 (POST/PUT/DELETE give 401), T-11-05 (`X-Robots-Tag`, meta robots, robots.txt), T-11-06 (encoded head, request path never echoed: `RequestTextIsNeverEchoedIntoTheHtml`), T-11-SC (no package added or bumped).

## User Setup Required

None. `App:PublicBaseUrl` must hold the live origin on the host (already required for email links).

## Next Phase Readiness

- Plans 11-07 (tagline, JSON-LD, boot data, sitemap `lastmod`), 11-08 (client 404 page and router, shared `public-paths.json`), 11-11 and 11-13 (hours), 11-19, 11-26 and 11-30 (share pictures) can build on `PublicHeadModel` and `PublicRouteTable`.
- Phase 12 adds legal paths to `PublicRouteTable` only; the sitemap follows.
- Flagged for the verifier (from the plan): PUB-04's `og:image`, JSON-LD and `lastmod` rows land in the later plans named above.
- STATE.md and ROADMAP.md were not touched (orchestrator owns them). `PUB-01` is shared with later plans and `PUB-04` is only partly done (head tags, 404, robots, sitemap), so the orchestrator should mark requirements only after the last declaring plan.

## Self-Check: PASSED

All created files exist on disk and the five task commits (`fbbb33b2`, `4c11bc03`, `c86b85f0`, `4a6dc824`, `1df0fa67`) are ancestors of HEAD.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-11*

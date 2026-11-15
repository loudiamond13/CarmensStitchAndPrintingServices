---
phase: 11-public-site-content-management
plan: 10
subsystem: ui
tags: [react, public-site, useSyncExternalStore, csp, playwright, parity, budget]
created: 2026-11-12T00:30:00-06:00
updated: 2026-11-12T00:30:00-06:00

requires:
  - phase: 11-07
    provides: "GET /api/v1/public/site with its ETag, the csps-boot block in every public page, POST /api/testing/site-content"
  - phase: 11-08
    provides: "PublicLayout with the four page heads and the 404 page, PUBLIC_COPY, the per-page public bundle budget"
provides:
  - "A small public data store (useSyncExternalStore, no TanStack Query) primed from the boot block, with invalidatePublicContent()"
  - "siteService, useSiteQuery and the footer drawn from the stored shop facts; siteContact.ts and its placeholders are gone"
  - "Contact: ContactNowCard with the big Messenger and Call buttons, Call or text, the tap-to-load map, the phone-only sticky bar"
  - "frame-src https://www.google.com/maps/embed in the CSP, and nothing new for scripts"
  - "Full footer on Home and Products, one-row base footer on Gallery, Contact and the 404 page"
  - "Parity footer with made-up shop facts and a new base-footer case; site content lock and demo seed helper for e2e"
affects: [11-14, 11-18, 11-25, 11-29, 11-17, 12, 13]

requirements-completed: [PUB-02, PUB-06, PUB-01]

actuals:
  tokens: 30000
  tasks: 3
  commits: 7
plan_head_before: 484632ee6272ca302992a689efe702ad824a9099
plan_head_after: 6644e0c2

tech-stack:
  added: []
  patterns:
    - "Public data store: module-level cache per key, useSyncExternalStore, primed from the boot block, stale after 5 minutes, background refresh keeps old data"
    - "The HTTP service loads through a dynamic import, so a first visit that finds the boot block never downloads the client"
    - "Parts only one page needs (the Contact sticky bar) load as their own lazy chunk from the layout"
    - "Unit tests start with the demo shop answering the site read (setup.ts); public data is reset after every test"

key-files:
  created:
    - web/src/lib/public-data/bootData.ts
    - web/src/lib/public-data/publicResource.ts
    - web/src/modules/public/services/siteService.ts
    - web/src/modules/public/hooks/useSiteQuery.ts
    - web/src/modules/public/siteFacts.ts
    - web/src/modules/public/components/SkeletonLines.tsx
    - web/src/modules/public/components/contact.recipe.ts
    - web/src/modules/public/components/BigContactButton.tsx
    - web/src/modules/public/components/ContactNowCard.tsx
    - web/src/modules/public/components/PhoneListCard.tsx
    - web/src/modules/public/components/MapCard.tsx
    - web/src/modules/public/components/ContactBar.tsx
    - web/src/modules/public/components/ContactBarSlot.tsx
    - web/src/test/publicFixtures.ts
    - web/e2e/site-content-lock.ts
    - web/e2e/contact.spec.ts
  modified:
    - src/Csps.Server/Http/SecurityHeadersMiddleware.cs
    - tests/Csps.Server.IntegrationTests/Http/SecurityHeadersTests.cs
    - web/src/modules/public/components/SiteFooter.tsx
    - web/src/modules/public/pages/ContactPage.tsx
    - web/src/modules/public/copy.ts
    - web/src/layouts/PublicLayout.tsx
    - web/src/test/setup.ts
    - web/e2e/testing-api.ts
    - web/src/dev/previews/PublicShell.tsx
    - web/src/dev/scenarios/groups/layouts-public.ts
    - web/visual/reference/fragments/PublicShell.tsx
    - docs/web/e2e.md
    - docs/web/parity.md
  deleted:
    - web/src/modules/public/components/siteContact.ts

key-decisions:
  - "The site service is loaded with a dynamic import inside the store's load function, so the HTTP client is not in a public page's first download (about 3 KB gz saved against the 150 KB limit)"
  - "The Contact sticky bar is its own lazy chunk, loaded only on /contact (about 2 KB gz saved on the other pages)"
  - "The base footer always has the 96px bottom padding on phones, as App. C's .s-foot does, so it equals the reference and the Contact bar never covers it"
  - "The big button notes keep full opacity (D-02): App. C dims them to .8"
  - "MapCard loads only an embed link that starts with the Google embed path, the one place the CSP allows"
  - "Parity footer data is made up and lives in the dev preview, not in the msw fixtures, because msw/node cannot be bundled for the browser"

patterns-established:
  - "createPublicResource({ key, load, staleMs }) for every later public read (product lines, gallery, home)"
  - "putBootBlock / siteHandler / siteFailureHandler / resetPublicData in web/src/test/publicFixtures.ts"
  - "seedDemoSiteContent plus withSiteContentLock around any e2e spec that reads or changes the shared shop facts"

coverage:
  - id: D1
    description: "A small public data store reads the server's boot block on the first visit with no request, loads the API otherwise, shares one load, refreshes after 5 minutes, clears on invalidate and gives an error with a retry"
    requirement: "PUB-02"
    verification:
      - kind: unit
        ref: "web/src/lib/public-data/bootData.test.ts; web/src/lib/public-data/publicResource.test.tsx; web/src/modules/public/hooks/useSiteQuery.test.tsx; web/src/modules/public/services/siteService.test.ts"
        status: pass
      - kind: e2e
        ref: "web/e2e/contact.spec.ts @contact the footer shows the stored tagline and main phone from the first HTML, with no site request (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The footer shows the stored tagline, the FB, IG and TT squares that are set, the address line, the main phone as a tel: link and the Messenger link; unset values leave their parts out; no email or at sign"
    requirement: "PUB-02"
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/SiteFooter.test.tsx; web/src/layouts/PublicLayout.test.tsx (footer)"
        status: pass
      - kind: other
        ref: "npm --prefix web run parity -- --grep @layouts-public (14 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Contact shows the Message us card with the Messenger and Call buttons and What to send, Call or text for two or more numbers, with the error and loading states"
    requirement: "PUB-06"
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/contact.test.tsx; web/src/modules/public/pages/ContactPage.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Google map loads only after Show Map, in a titled lazy frame with a strict referrer and no allow features, and the CSP adds only frame-src for the embed path"
    requirement: "PUB-06"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SecurityHeadersTests.cs#CspAllowsOnlyTheGoogleMapEmbedFrameAndNothingNewForScripts"
        status: pass
      - kind: e2e
        ref: "web/e2e/contact.spec.ts @contact the map loads from Google only after Show Map, with no CSP report (5 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The phone-only sticky bar shows Messenger and Call us at 767px and below, is absent above it, does not cover the last focusable element, and Call us fills the bar without a Messenger link"
    requirement: "PUB-06"
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/contact.test.tsx (ContactBar); web/src/layouts/PublicLayout.test.tsx (Contact sticky bar)"
        status: pass
      - kind: e2e
        ref: "web/e2e/contact.spec.ts @contact at 390px ... and @contact at 1440px there is no sticky bar (5 projects)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Home and Products show the full footer; Gallery, Contact and the 404 page show the one-row base footer"
    requirement: "PUB-01"
    verification:
      - kind: unit
        ref: "web/src/layouts/PublicLayout.test.tsx (footer variant by route); web/src/modules/public/components/SiteFooter.test.tsx (base)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Contact page parts look like the approved App. E.4 design (big buttons, map card before the tap, sticky bar)"
    requirement: "PUB-06"
    verification: []
    human_judgment: true
    rationale: "No parity scenarios exist yet for the Contact parts (the footer scenarios were updated, the Contact ones were not in this plan's file list); the owner reviews them in the UI review"
  - id: D8
    description: "PUB-06 edge probe (unclassified): the tel: target is the main number in E.164, Messenger goes to the stored m.me link in the same tab, the bar shows only at 767px and below"
    requirement: "PUB-06"
    verification: []
    human_judgment: true
    rationale: "The edge probe could not classify PUB-06; the verifier should judge it. The behaviors above are covered by tests"

duration: about 2h 45min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 10: Visitors can message or call the shop from Contact and the footer, using the stored details Summary

**The public footer and the Contact page now show the shop's stored facts through a small built-in data store that reads the server's boot block on the first visit (no request) and the API after that; Contact has the Message us card with big Messenger and Call buttons, a tap-to-load Google map behind one narrow CSP line, and a phone-only sticky bar.**

## Performance

- **Duration:** about 2 h 45 min
- **Started:** 2026-11-11T21:25:00-06:00 (approx.)
- **Completed:** 2026-11-12T00:30:00-06:00
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files modified:** 38 in the diff (22 created, 15 modified, 1 deleted)

## Accomplishments

- `createPublicResource({ key, load, staleMs })` (useSyncExternalStore, no TanStack Query): primed from the `csps-boot` block, one shared load, stale after 5 minutes (old data shows while it refreshes, a failed refresh keeps it), `invalidate()`, `invalidatePublicContent()` and a retry on a failed first load. It stays out of the public bundle's TanStack Query rule (acceptance grep: 0 matches).
- The footer is drawn from the stored facts: tagline, FB, IG and TT squares named "FB, CSPS on Facebook" and so on, the address line without the postal code, the main phone as `tel:` and "Message us on Messenger". Skeleton lines in Visit and Contact while loading; on a failed read it keeps Shop and Staff Login. `siteContact.ts` and its bracket placeholders and `#` links are deleted. There is no email row and no `@` in the public DOM (tests for the footer and the Contact page).
- Contact: the Message us card (D-18), the big orange Messenger button to the stored `m.me` link (same tab) and the Call button to the main number in E.164, "What to send", "Call or text" for two or more numbers (main first with a Main badge), the drawn map with Show Map, and the phone-only sticky bar. Error: "Couldn't load our contact details." with Try Again and no bar. Loading: skeletons inside "Loading our contact details…".
- The map frame (D-20): no iframe and no Google request until the tap; then a 16:10 frame with title "Map of {business name}", `loading="lazy"`, `referrerpolicy="strict-origin-when-cross-origin"` and no `allow`; focus moves to it; the label card moves under it. The CSP gains exactly `frame-src https://www.google.com/maps/embed;`.
- Footer by page: full footer on Home and Products; the one-row base footer (small logo, "© {year} {business name}", Staff Login) on Gallery, Contact and the 404 page. The year is the server's business-calendar year.
- Parity: the preview primes the store with made-up facts, the reference fragment draws the same rows, and a new `public-shell-base` case covers the base footer. `npm run parity -- --grep @layouts-public`: 14 passed.

### Public bundle figures (gzip -9, 1 KB = 1000 B, limit 150.00 KB; `npm --prefix web run e2e` build)

| Page | After 11-08 | Now |
|---|---|---|
| home | 137.68 | 141.16 |
| products | 138.08 | 141.56 |
| gallery | 143.04 | 146.52 |
| contact | 138.09 | 148.72 |
| notFound | 138.22 | 141.72 |

Contact has about 1.3 KB of room left and Gallery about 3.5 KB. The first build of this plan was over the limit (contact 151.35, gallery 151.08); loading the site service on demand and making the Contact bar its own chunk brought it back. Later plans that add to Gallery or Contact must load heavy parts lazily.

## Task Commits

1. **Task 1 (tracer): footer from the stored facts through the public data store** - RED `ab9b6ab4` (test), GREEN `b97ac187` (feat)
2. **Task 2: Contact page, map, sticky bar and the frame-src line** - RED `7b544fb4` (test), GREEN `15f168cd` (feat)
3. **Task 3: footer per page, base footer, parity footer** - RED `3989429d` (test), GREEN `b5cf0e76` (feat), fix `6644e0c2` (the parity guide table)

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier was not required. Each RED run was read for the right reason, and each RED commit precedes its GREEN commit.

- **Task 1 RED** (`ab9b6ab4`): 25 of 29 tests failed on assertions against stubs (the boot reader returned undefined, the store stayed loading, the service rejected, the footer still showed placeholders). The 4 that passed were the vacuous "no block / bad JSON / missing part" cases and the axe check on the old footer. The Contact e2e test was not run before GREEN (it needs the built app and host, and the old footer's brackets cannot satisfy it); it passed 5 of 5 after GREEN. Tracer gate: the tracer `<verify>` is automated-only, so it was re-run after the commit (unit tests and `@contact`, all green) before expanding.
- **Task 2 RED** (`7b544fb4`): 20 of 23 component tests, 4 of the new page tests and 2 layout tests failed against stub components; the CSP class failed 6 of 7 (the new test and the five tests that compare the full header). 
- **Task 3 RED** (`3989429d`): 7 tests failed (base variant, the footer per route). No REFACTOR commit was needed.

## Verification evidence (real output)

- **Task 1 verify:** `src/lib/public-data`, `siteService.test.ts`, `useSiteQuery.test.tsx`, `SiteFooter.test.tsx`: all passed (9 files together with the layout and route tests: 116 tests). `@contact` e2e: 5 passed.
- **Task 2 verify:** `contact.test.tsx`, `ContactPage.test.tsx`, `PublicLayout.test.tsx` passed; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SecurityHeadersTests"`: `total: 7, failed: 0, succeeded: 7`; with `OpenApiExposureTests`, `SpaHostTests` and `ProblemDetailsTests`: `total: 75, failed: 0`. `@contact` e2e: `25 passed (55.7s)` (chromium, firefox, webkit, pixel, iphone: 5 tests each).
- **Task 3 verify:** `SiteFooter.test.tsx`, `PublicLayout.test.tsx`, `no-long-dash.node.test.ts` passed; `npm --prefix web run parity -- --grep @layouts-public`: `14 passed (54.9s)`; `npm --prefix web run lint`: no output (0 warnings); `npm --prefix web run typecheck`: clean.
- **Final e2e** on the finished tree: `npm --prefix web run e2e -- --grep "@contact|@public|@smoke"`: `90 passed (1.8m)`.
- **Wide unit run** (modules/public, layouts, lib/public-data, core/routes, dev, tailwind class gate, src/test, visual): `Test Files 45 passed (45)`, `Tests 979 passed (979)`.
- **Acceptance greps:** `useSyncExternalStore` in `publicResource.ts`: 3; `@tanstack` outside comments there: 0; `withSiteContentLock` in `contact.spec.ts`: 2; `SPEC-GAP: contact before quote form` in `ContactNowCard.tsx`: 1; `frame-src https://www.google.com/maps/embed` in the middleware: 1; `strict-origin-when-cross-origin` in `MapCard.tsx`: 1; `siteContact.ts` does not exist; `variant` in `SiteFooter.tsx`: 3.
- **CSP header line** (from `StrictCsp`): `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-src https://www.google.com/maps/embed; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`.
- `dotnet format Csps.slnx --verify-no-changes --include` on the two C# files: exit 0. gitleaks `protect --staged` ran before every commit: no leaks. The only values in the diff are made up (`Sample Shop`, `12 Sample St.`, `cspsdemo` links, the demo numbers); no email, no local path, no real name.

- **Full web unit suite** (`npx vitest run`): `Test Files 3 failed | 334 passed (337)`, `Tests 3 failed | 9223 passed (9226)`. The three: (1) `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions": license-checker finds no packages in this worktree install, the same failure plan 11-08 recorded (it touches no package file); (2) `scripts/owner-review.test.ts` (parity table row, my doing, fixed: 119 passed, deviation 9); (3) `OrderFormPage.test.tsx` "cannot be left through the dialog while a save is pending": failed once at 3.1 s while the machine was loaded by the parity run and passed alone (1 of 1). Recorded as a flake; the plan touches no admin code.
- **Full parity** (`npm --prefix web run parity`): `450 passed, 50 failed (22.5m)`. The 50 are the machine baseline from plan 11-08 (same count; groups `@data` 12, `@money` 6, `@overlays` 18, `@status` 8 and `@navigation @overflow` 6, none in `@layouts-public`). No failure is new.
- **Final build budget** (e2e build): home 141.16, products 141.56, gallery 146.52, contact 148.72, notFound 141.72 KB; admin 220.01 KB; CSS 17.68 KB.

## Decisions Made

- **Service on demand.** `useSiteQuery` loads `siteService` with a dynamic import inside the store's load function. A first visit finds the boot block and never needs the HTTP client, so it is not in the first download. This is what got the public pages back under 150 KB.
- **Sticky bar as its own chunk.** `PublicLayout` lazy-loads `ContactBarSlot` only on `/contact`. The bar appears a moment after the page on a slow connection; it is hidden above 767px anyway.
- **Base footer padding.** The reference footer (App. C `.s-foot`) has 96px bottom padding on phones, and the parity case failed without it. So the base footer always has it, and it also keeps the Contact bar off the last row. UI-SPEC says "keeps 96px on Contact"; this reads it as the shared footer rule. Say so if the owner wants Gallery and the 404 page to have the normal 32px instead (that would be a new look ruling and a parity ruling).
- **Opacity.** App. C dims the big button note to opacity .8. D-02 allows no text below full opacity, so the note keeps full opacity and its muted ink (`// SPEC-DEVIATION: D-02` in `contact.recipe.ts`).
- **Map link guard.** `MapCard` loads only a stored link that starts with `https://www.google.com/maps/embed`, so a bad stored value can never become a frame the CSP would block.
- **Parity data lives in the dev preview.** `publicFixtures.ts` imports `msw/node`, which cannot go into a browser bundle, so `PublicShell.tsx` holds its own made-up facts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `siteContact.ts` was deleted in Task 1, not Task 3**
- **Found during:** Task 1
- **Issue:** the footer stopped reading it in Task 1, and `PublicLayout.test.tsx` imported it.
- **Fix:** the file was removed in the Task 1 GREEN commit and the layout test updated. Task 3's acceptance check (`test ! -e`) still holds.
- **Committed in:** `b97ac187`

**2. [Rule 3 - Blocking] Every unit test now starts with the demo shop answering the site read**
- **Found during:** Task 1
- **Issue:** each test that renders `PublicLayout` (about 20 files) now makes a site read, and MSW fails a request with no handler.
- **Fix:** `web/src/test/setup.ts` adds the demo handler before each test and resets the public data after each one. A test that needs another answer calls `server.use`. No other test file needed a change.
- **Committed in:** `ab9b6ab4`

**3. [Rule 3 - Blocking] The first e2e test checks the footer on Home, not on Contact**
- **Found during:** Task 1
- **Issue:** the plan asks for the footer tagline and phone on `/contact`, but Task 3 gives Contact the base footer, which has neither. The test would have had to change at Task 3.
- **Fix:** the test loads `/`, which keeps the full footer. Contact's own phone link is tested in the Contact tests.
- **Committed in:** `ab9b6ab4`

**4. [Rule 3 - Blocking] The public bundle went over the 150 KB limit**
- **Found during:** Task 2 (the e2e build runs the budget)
- **Issue:** Contact 151.35 KB and Gallery 151.08 KB.
- **Fix:** the service loads by dynamic import, and the sticky bar became a lazy chunk (`ContactBarSlot.tsx`, a file the plan did not list). `barScrollPaddingClasses` moved from the Contact recipe into `PublicLayout` so the recipe chunk stays Contact only.
- **Verification:** `build:budget` and the e2e build: all five pages under 150 KB (table above).
- **Committed in:** `15f168cd`

**5. [Rule 3 - Blocking] `readBootData` returns `unknown`**
- **Found during:** Task 1 (lint rule `no-unnecessary-type-parameters`)
- **Fix:** `readBootData(key): unknown`; the store casts it. The plan wrote `readBootData<T>`.
- **Committed in:** `b97ac187`

**6. [Rule 3 - Blocking] Two Tailwind variants the lint ban does not allow**
- **Found during:** Task 2
- **Fix:** the 420px wrap uses `pg-xs` and the page scroll padding uses the media variant `vp-lt-md`. The scroll padding must be a media query (a container query cannot style the root element), so for a desktop browser with a classic scrollbar there is a band of about 15px around 767 to 782px where the bar shows (container width 767 or less) but the extra padding is not yet applied. It is not tested; say so if it matters.
- **Committed in:** `15f168cd`

**7. [Rule 1 - Bug] axe warns when it checks a cross-origin frame**
- **Found during:** Task 2 (e2e, all 5 projects)
- **Issue:** after Show Map, page-level axe tried to talk to the Google frame and the browser logged a postMessage warning, which the console guard counts as a finding.
- **Fix:** the e2e test runs axe over the whole page before the tap and over the label card after it. The frame's title is asserted. In jsdom the unit test removes the frame before axe.
- **Committed in:** `15f168cd`

**8. [Rule 1 - Bug] Parity differences found and fixed in Task 3**
- **Issue:** (a) the reference footer's copyright was several text nodes and the app's one (a 0.03 px width difference), (b) the base logo used the `footer` context, which makes the small logo 40px on phones (the reference is 32px), (c) the base footer had no 96px phone padding.
- **Fix:** one text node in the reference fragment, the default logo context, and the 96px padding (see Decisions Made).
- **Committed in:** `b5cf0e76`

**9. [Rule 1 - Bug] The parity guide table broke a test**
- **Found during:** the full web unit run
- **Issue:** `scripts/owner-review.test.ts` requires every row of the intentional differences table in `docs/web/parity.md` to carry a decision ID. A row I added for the base footer had none. The base footer equals App. E.4, so it is not an intentional difference.
- **Fix:** the row was removed (the data and email row stays). `owner-review.test.ts`: 119 passed.
- **Committed in:** `6644e0c2`

**10. [Note] Files outside the plan's list**
- `web/src/modules/public/siteFacts.ts`, `components/SkeletonLines.tsx`, `components/contact.recipe.ts`, `components/ContactBarSlot.tsx` (small helpers and the lazy chunk), `web/src/dev/scenarios/groups/layouts-public.ts` (the new base case), `docs/web/e2e.md` and `docs/web/parity.md` (the new spec, lock, and the intentional differences, as `parity.md` asks). `SkeletonLines` copies `SkeletonText` because that file imports the admin money barrel.

**11. [Plan wording] The Call button has no second line yet**
- UI-SPEC puts the open-day summary under "Call {number}". The hours do not exist in the site data until plan 11-14, so the button shows only "Call {number}". Plan 11-14 adds the line.

**12. [Process] Plan commit ledger**
- The plan commit ledger file was not written (it has to exist before the first commit, which was made before it was thought of). `plan_head_before` is the spawn base asserted at the start, and `commits: 7` is `git rev-list --count 484632ee..HEAD` before this SUMMARY commit.

**Total deviations:** 5 Rule 3 and 3 Rule 1 auto-fixes, 4 notes. **Impact:** no scope creep. Items 4 and 8 changed how the UI is built (lazy chunks, 96px base padding) and are the ones the owner may want to look at.

## Issues Encountered

- A first e2e run failed on the budget (see deviation 4) and a second on the axe frame warning (deviation 7). Both were fixed in the component or the test that caused them, then the suite was re-run in full.
- `docs/web/budgets.md` lines 32, 42 and 125 still describe the holding page (the plan does not touch that file). Flagged for the verifier.
- Not run here: Lighthouse, the Windows deploy job, the e2e suites that do not touch public pages.

## Known Stubs

None. Intended gaps with a later plan: the Call button's second line and the hours card (plan 11-14), the inquiry form (Phase 13), and the consent hook for the map (Phase 12).

## Threat Flags

None new. T-11-22: links come only from the stored fields, `tel:` only from the E.164 form, the map frame only from a link that starts with the Google embed path, React escapes the text, no `dangerouslySetInnerHTML`. T-11-23: no frame until the tap, strict referrer, no `allow`, CSP limited to the embed path, `frame-ancestors 'none'` unchanged. T-11-24: no email member in the DTO, and DOM tests search for `@` in the footer and on Contact. T-11-SC: no package added or bumped (`package.json` and the lock file are unchanged).

## User Setup Required

None.

## Next Phase Readiness

- Plan 11-14 adds the hours card, the open status, the hours line under the Call button and the footer's clock row (the footer and Contact parts are ready for it).
- Plans 11-18, 11-25 and 11-29 can use `createPublicResource` with `key: 'productLines' | 'home'` and the boot block. Mind the budget: Contact has about 1.3 KB and Gallery about 3.5 KB of room; load heavy parts lazily.
- The admin client should call `invalidatePublicContent()` after a content write (plan 11-09 and later admin plans).
- The shared requirement IDs (PUB-01, PUB-02, PUB-06) are shared with other plans; the orchestrator should mark them complete only after the last plan that declares each one.
- STATE.md and ROADMAP.md were not touched (orchestrator owns them).

## Self-Check: PASSED

All created files exist on disk, `siteContact.ts` is deleted, and the seven commits (`ab9b6ab4`, `b97ac187`, `7b544fb4`, `15f168cd`, `3989429d`, `b5cf0e76`, `6644e0c2`) are ancestors of HEAD. Every task's acceptance greps were re-run and pass. The plan-level verification is green apart from the known baseline items listed above (license-policy test, the 50 baseline parity failures, one recorded flake).

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*

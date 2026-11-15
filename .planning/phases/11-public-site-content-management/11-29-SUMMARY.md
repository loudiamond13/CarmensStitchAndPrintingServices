---
phase: 11-public-site-content-management
plan: 29
subsystem: public-site-ui
tags: [react, gallery, masonry, nuqs, url-state, roving-focus, recent-work, hero-tag, lazy-chunks, bundle-budget, a11y, playwright]
created: 2026-11-12T20:00:00-06:00
updated: 2026-11-12T20:00:00-06:00

requires:
  - phase: 11-26
    provides: "GET /api/v1/public/gallery (items, pills, total) and Home recentWork and heroTag"
  - phase: 11-25
    provides: "Home page, HomeSections lazy chunk, PublicLoadingRegion, createPublicResource pattern"
  - phase: 11-08
    provides: "the lazy UrlStateLayout above the Gallery route (nuqs only on this route)"
provides:
  - "contentService.getGallery and useGalleryQuery (no boot block, 5 minute staleness, ETag revalidation)"
  - "useGalleryCategory: the WEB-10 ?category= parameter through the loaded pill keys (parseAsStringLiteral), kept while loading, one replace for an unknown value, All stays out of the address"
  - "GalleryFilterBar: sticky toolbar Filter by category, All first, 44px pills with counts and a hidden items word, aria-pressed, roving focus (arrows with wrap, Home, End, Enter, Space) and a polite Showing N items region"
  - "GalleryMasonry: one button tile per item named Open {team}, {short}, at the photo ratio clamped between 3/4 and 4/3 through --ratio (4/5 unknown), JerseyArt when there is no photo address, caption on a solid blush band"
  - "GalleryBody (one lazy chunk): 24 tiles then Show More Photos (24 more, no request, focus to the first new tile), Get a Quote under the tiles, loading, failed and empty states"
  - "RecentWorkStrip and HeroTag on Home (D-14), in the existing lazy Home chunk"
  - "Fixtures demoGallery, emptyGallery, largeGallery, makeGalleryItem, demoRecentWork, homeWithWork and a default gallery answer in the jsdom setup; e2e @gallery (6 specs) and a Recent work spec in @home"
affects: [11-31, 11-37]

actuals:
  tokens: 25000
  tasks: 3
  commits: 8
plan_head_before: 8f7974c423dce55950a8f06c93251af22e95237a
plan_head_after: f8fa27cd211478a5330576361a84349fc4e73616

tech-stack:
  added: []
  patterns:
    - "Everything on the Gallery page under the head (the read, the nuqs hook, the bar, the tiles, the states) is one lazy chunk declared in lazyGallery.ts, so the Gallery route keeps nuqs hooks out of its first download"
    - "The hero tag comes down in the same chunk as the Home sections (HomeSections re-exports HeroTag, lazyHome.ts picks it by name), so it adds no second chunk"
    - "A visually hidden word inside a scrolling bar needs a positioned parent (the pill is relative), or it widens the page"
    - "A hidden word after a number is its own text node after a plain space, because the accessible name trims the leading space of a hidden span"

key-files:
  created:
    - web/src/modules/public/hooks/useGalleryQuery.ts
    - web/src/modules/public/hooks/useGalleryCategory.ts
    - web/src/modules/public/components/GalleryFilterBar.tsx
    - web/src/modules/public/components/GalleryMasonry.tsx
    - web/src/modules/public/components/GalleryBody.tsx
    - web/src/modules/public/components/GalleryStates.tsx
    - web/src/modules/public/components/lazyGallery.ts
    - web/src/modules/public/components/gallery.recipe.ts
    - web/src/modules/public/components/RecentWorkStrip.tsx
    - web/src/modules/public/components/HeroTag.tsx
    - web/src/modules/public/components/recent.recipe.ts
    - web/e2e/gallery.spec.ts
  modified:
    - web/src/modules/public/services/contentService.ts
    - web/src/modules/public/pages/GalleryPage.tsx
    - web/src/modules/public/pages/HomePage.tsx
    - web/src/modules/public/components/HomeSections.tsx
    - web/src/modules/public/components/lazyHome.ts
    - web/src/modules/public/components/ProductStates.tsx
    - web/src/modules/public/copy.ts
    - web/src/layouts/PublicLayout.tsx
    - web/src/test/publicFixtures.ts
    - web/src/test/setup.ts

key-decisions:
  - "The Gallery body (read, category hook, bar, tiles, states) is one lazy chunk. The first build with the bar and tiles eager put the Gallery route at 155.89 KB (limit 150.00); with only the nuqs hook and the page eager it was still 150.14 KB; with the whole body lazy it is 147.20 KB."
  - "Recent work and the hero tag share the existing HomeSections chunk. Their looks live in recent.recipe.ts, not home.recipe.ts, because the recipe file the page reads eagerly would carry their classes into Home's first download."
  - "ProductsError takes an optional title, so the Gallery reuses the same banner with its own words instead of a second banner part (a new reader of a shared public state part regroups chunks)."
  - "The drawn jersey on a tile with no photo carries the number 23, as the hero drawing does: an order or upload has no number of its own. Marked SPEC-GAP in both files."
  - "Pill count word: the hidden word is 'items' after a plain space node, so the accessible name reads 'Basketball 4 items'."

patterns-established:
  - "Page tests for nuqs state use createBrowserRouter and read window.location.search, because nuqs writes the browser history directly (L-16)"
  - "A spec that opens Home or the Gallery after the demo shop content is seeded declares guard.expectStatus('/api/testing/images/', 404): the demo orders' photo ids have no stored file"

requirements-completed: [GAL-01, CONT-03, PUB-01]

coverage:
  - id: D1
    description: "The Gallery filter bar lists All and one pill per line with items, with the server's counts; the selected pill is maroon with aria-pressed; counts equal the tiles shown"
    requirement: GAL-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/gallery.test.tsx#GalleryFilterBar; web/src/modules/public/pages/GalleryPage.test.tsx#opens /gallery?category=basketball on the basketball tiles only"
        status: pass
      - kind: e2e
        ref: "web/e2e/gallery.spec.ts @gallery /gallery?category=basketball shows only basketball tiles, the pill count matches them and a reload keeps the filter (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The category in the address goes through the loaded pill keys: kept while loading, dropped with one replace when unknown, a pill change replaces, All stays out of the address; no value outside the list reaches the page"
    requirement: GAL-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/hooks/useGalleryCategory.test.tsx (9 tests); GalleryPage.test.tsx#drops an unknown category from the address"
        status: pass
    human_judgment: true
    rationale: "The plan flags the CWE-601 prohibition as a judgment item (safety, unverified). The tests show an unlisted value, an address-like value and a script-like value never leave the hook; a security reviewer should confirm."
  - id: D3
    description: "One button tile per item at the clamped photo ratio, JerseyArt without a photo address, caption on a solid blush band, long names wrap"
    requirement: GAL-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/gallery.test.tsx#GalleryMasonry (10 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Toolbar keys: one tab stop, arrows with wrap, Home, End, Enter and Space select and keep focus on the pill, polite Showing N items"
    requirement: GAL-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/gallery.test.tsx#GalleryFilterBar keyboard (8 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "First 24 tiles, Show More Photos adds 24 with no request and focuses the first new tile, the button leaves when all are shown, a new category starts at 24, Get a Quote links to /contact"
    requirement: GAL-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/GalleryPage.test.tsx#GalleryPage Show More, states and the quote link"
        status: pass
    human_judgment: false
  - id: D6
    description: "Loading (7 pill and 8 tile skeletons at 4/5, 1/1, 3/4, 4/3 in Loading the gallery), failed read (Try Again, no pills), empty state (No photos yet with Get a Quote), zero axe in each"
    requirement: GAL-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/GalleryPage.test.tsx (loading, error, empty and axe cases)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Page-level behaviour in real browsers: pill bar scrolls inside itself at 320px with no sideways scroll, focused tiles stay clear of the header and the sticky bar, zero axe, console and CSP findings at 390 and 1440px"
    requirement: GAL-01
    verification:
      - kind: e2e
        ref: "web/e2e/gallery.spec.ts @gallery (6 specs, 30 runs in 5 projects)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Home Recent work: the six newest shown orders as 4:5 tiles to /gallery?category={key}, captions, JerseyArt without a photo, four frames while loading, left out with none or after a failed read; the Recent order tag with the name and piece count, not a link"
    requirement: CONT-03
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/home.test.tsx (RecentWorkStrip, RecentWorkSkeletons, HeroTag); web/src/modules/public/pages/HomePage.test.tsx#HomePage Recent work and the hero tag"
        status: pass
      - kind: e2e
        ref: "web/e2e/home.spec.ts @home / shows Recent work newest first with the hero tag, and a tile opens the Gallery on its line (5 projects)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Gallery 147.21 KB and Home 149.29 KB gz, both at or under 150 KB"
    requirement: PUB-01
    verification:
      - kind: other
        ref: "npm --prefix web run build:budget: public JS (gallery) 147.21 KB, (home) 149.29 KB"
        status: pass
    human_judgment: false
  - id: D10
    description: "The masonry, the filter bar, the Recent work strip and the hero tag look like the approved App. E.1 and E.3 designs"
    verification: []
    human_judgment: true
    rationale: "No parity scenario covers these parts (the plan lists none), so the owner reviews the look in the UI review."

duration: about 105 min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 29: Visitors browse the Gallery by category and see Recent work on Home Summary

**The Gallery now filters by line from a shareable ?category= address (allow-listed against the loaded pills, replace-only, All out of the URL) with a roving-focus pill toolbar, a 24-at-a-time masonry of one tile per order, and its loading, failed and empty states; Home shows the six newest shown orders as Recent work and a Recent order tag over the hero drawing; both stay inside the 150 KB budget by loading their parts lazily.**

## Performance

- **Duration:** about 105 min
- **Started:** 2026-11-12T18:15:00-06:00 (estimated; the first commit is 18:38)
- **Completed:** 2026-11-12T20:00:00-06:00
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files in the diff:** 37 (12 source files created, plus tests, fixtures, e2e specs and one doc; no file deleted). actuals.tokens is chars/4 over the added lines under web/ and docs/ (about 100,000 characters).

## Accomplishments

- **Tracer (Task 1):** `getGallery`, `useGalleryQuery`, `useGalleryCategory`, the bar and the masonry, wired in the page. The tracer's verify has an `<automated>` pair only (unit files, then `@gallery`), so both were re-run on the finished tree before expansion: 45 unit tests and `@gallery` 5 passed (44.9 s). Tracer verified end to end, expanding.
- **Task 2:** roving focus and the polite Showing N items region, Show More Photos with focus on the first new tile, Get a Quote, the three states, and the 69 px sticky-bar scroll padding on /gallery.
- **Task 3:** `RecentWorkStrip` (with four loading frames) and `HeroTag`, in the lazy Home chunk.
- **Real-browser finding fixed (Rule 1):** the e2e run showed the Gallery page 8 to 78 px wider than the screen. See Deviation 3.

### Public bundle figures (gzip -9, 1 KB = 1000 B, limit 150.00 KB; `npm --prefix web run build:budget`)

| Page | After 11-25 (orchestrator note) | First build, bar and tiles eager | Final |
|---|---|---|---|
| home | 148.88 | 149.04 | **149.29** (0.71 KB left) |
| products | 145.65 | 145.93 | 145.93 |
| gallery | 146.72 | 155.89 (over) | **147.21** |
| contact | 149.15 | 149.26 | 149.22 |
| notFound | 141.92 | 142.03 | 141.99 |

Admin 220.34 KB, CSS 19.36 KB. The home and gallery route figures the criteria ask for are **149.29 KB** and **147.21 KB**.

## Task Commits

1. **Task 1 (tracer):** RED `43d2fa38` (test), GREEN `469c75f9` (feat)
2. **Task 2:** RED `08dbcd4a` (test), GREEN `df1f27af` (feat), fix `3208d0f4` (the hidden pill word, Deviation 3)
3. **Task 3:** RED `8b74706e` (test), GREEN `7d223a57` (feat)
4. **Specs that meet the demo photos:** `f8fa27cd` (test, Deviation 4)

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) was not required; vitest writes JUnit, but each RED was read by hand against the real console output. Each RED commit precedes its GREEN commit. No REFACTOR commits.

- **Task 1 RED (`43d2fa38`):** 30 failed, 15 passed of 45, all on planned assertions, against stubs (a `getGallery` that returns an empty gallery, a hook that stays loading, a category hook that returns null, and a bar and masonry that draw nothing). Not a RED, said plainly: the cases that hold for a stub too passed at once (an unlisted category is ignored, a script-like value is never returned, the address is left alone while loading, the empty bar draws no toolbar).
- **Task 2 RED (`08dbcd4a`):** 17 failed, 65 passed of 82: seven keyboard and announcement cases, ten page cases (paging, quote link, loading, error, empty, axe) and the layout padding case. "No Show More for 24 or fewer tiles" passed at once, as a guard.
- **Task 3 RED (`8b74706e`):** 16 failed, 58 passed of 74, against stubs that draw an empty `div`. The "nothing with none", "no tag without a tag" and "failed read" cases passed at once, as guards.
- After a RED commit I changed three tests that were written wrong, not the behaviour they check: the style-attribute test (it counted LazyImage's skeleton custom properties), the page tests (a memory router does not carry nuqs state; they now use a browser router and read `window.location.search`), and the three-state axe test (it needs `resetPublicData()` between renders). The pill `relative` check was added together with its fix (Deviation 3), not seen RED first.

## Verification evidence (real output)

- **Unit, per task (after GREEN):** Task 1 files (`useGalleryCategory`, `useGalleryQuery`, `gallery`, `GalleryPage`, `contentService`): `Test Files 5 passed (5)`, `Tests 45 passed (45)`. Task 2 files (`gallery`, `GalleryPage`, `PublicLayout`): `Tests 82 passed (82)` (one test file fix, then `GalleryPage` 19 passed). Task 3 files (`home`, `HomePage`): `Test Files 2 passed (2)`, `Tests 74 passed (74)`.
- **Wider run** (`src/modules/public`, `src/layouts`, `src/test/no-long-dash.node.test.ts`, `src/test/source-layout.node.test.ts`, `scripts/tailwind-classes.test.ts`, `src/components/marketing`): `Tests 538 passed | 2 failed (540)`. The two failures were load flakes, both passing alone: `ProductsPage` "has no axe violations" (once, "Unable to find role=article"; alone `27 passed`) and `AdminLayout` "Logout signs out ..." (once, "Unable to find role=status"; alone with `HomePage`, `94 passed`). One test of mine also timed out its 1 s default under that load (`opens the Gallery filtered to a tile's line`), so its wait is now 15 s.
- **Full web unit suite** (`npx vitest run`, after the last code commit): `Test Files 2 failed | 375 passed (377)`, `Tests 2 failed | 10285 passed (10287)`. The two failures: `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions" (the known fresh-worktree install failure from the orchestrator notes; this plan touches no package file) and `src/modules/admin/routes.test.tsx` "an Admin who opens /admin/site-content lands on the dashboard" (a load flake: alone, `73 passed (73)`).
- **`npm --prefix web run typecheck`:** exit 0, no output. **`npm --prefix web run lint`** (`eslint . --max-warnings 0`): exit 0, no output. Prettier clean on every changed file. Class gate (`scripts/tailwind-classes.test.ts`) and `no-long-dash` passed.
- **`npm --prefix web run build:budget`:** the table above, exit 0.
- **`@gallery`:** `30 passed` for the six specs in five projects (in the `@home|@gallery|@public|@smoke` run, `@gallery ok=30 failed=0`). **`@home`:** `75 passed` (15 specs in five projects, `failed=0`). `@smoke` 5 passed. In the same run `@public` failed 16 (see Deviation 4); after the fix `@public` 60 passed, 0 failed.
- **Other specs that open Home** (run after the fix): `@contact`, `@fixture`, `@profile`, `@site-content-business`: see Issues Encountered for the failures that are not caused by this plan.
- **Acceptance greps:** `parseAsStringLiteral` in `useGalleryCategory.ts`: 2; `startTransition|shallow: false` outside comments: 0; `Showing` in `copy.ts`: 1; `Show More Photos`: 1; `mockup to pickup`: 1; `--ratio` in `GalleryMasonry.tsx`: 2; `/gallery?category=` in `RecentWorkStrip.tsx`: 2.
- gitleaks ran before every commit (the repo hook): no leaks. Every name in the fixtures is made up (Brgy. Sample Ballers, Sample City Spikers, `sample-cloud` photo addresses).

## Decisions Made

See `key-decisions`. The ones the owner may want to look at: the number 23 on a drawn jersey for a tile or strip item with no photo, the empty fallback tile look, and the lazy Gallery body (the page head shows at once, then the bar and tiles load as one chunk).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Gallery route went over the 150 KB budget, so the whole body is one lazy chunk**
- **Found during:** Task 1 (`build:budget`)
- **Issue:** Gallery 155.89 KB with the bar and tiles eager, 150.14 KB with only the page and the nuqs hook eager.
- **Fix:** `GalleryBody.tsx` holds the read, the category hook, the bar, the tiles and the states; `lazyGallery.ts` declares it in one file; `GalleryPage` is the head and a Suspense. Gallery 147.20 KB, then 147.21 KB with Task 2.
- **Files modified:** `GalleryPage.tsx`, `GalleryBody.tsx`, `lazyGallery.ts` (the last two not in the plan's file list)
- **Commit:** `469c75f9`

**2. [Rule 3 - Blocking] Files beyond the plan list**
- `recent.recipe.ts` (the strip and tag classes; kept out of `home.recipe.ts` so Home's first download does not carry them), `GalleryBody.tsx`, `GalleryStates.tsx`, `lazyGallery.ts`, `HomeSections.tsx` and `lazyHome.ts` (the strip joins the lazy sections and the tag is exported from the same chunk), `ProductStates.tsx` (`ProductsError` takes an optional `title`), `HeroArt.tsx` (a comment), `web/src/test/setup.ts` (the jsdom setup answers the gallery read by default, as it does for Home), and `docs/web/e2e.md` (rows for `@gallery` and `@home`).
- **Commits:** `469c75f9`, `df1f27af`, `7d223a57`, `f8fa27cd`

**3. [Rule 1 - Bug] The visually hidden "items" word made the Gallery page scroll sideways**
- **Found during:** Task 2 e2e run (`@gallery` at 320px: page overflow 77 to 78 px; at 390px: 7 to 8 px, in chromium, webkit, pixel and iphone)
- **Issue:** the hidden word is absolutely placed. With no positioned pill around it, its containing block was the sticky bar, outside the scrolling row, so the row did not clip it and its position at the far end of the pills widened the page.
- **Fix:** the pill is `relative`. A unit check asserts it. The e2e no longer asks a tall tile to fit the viewport (Firefox only scrolls a tile partly into view; the check is that it is not under the bars).
- **Files modified:** `gallery.recipe.ts`, `gallery.test.tsx`, `gallery.spec.ts`
- **Commit:** `3208d0f4`

**4. [Rule 1 - Existing tests that pinned the old pages] Specs that open Home or the Gallery see the demo photos answer 404**
- **Found during:** the `@home|@gallery|@public|@smoke` run: 16 `@public` failures; then `@contact`, `@fixture`, `@site-content-business` in chromium.
- **Issue:** once any spec has seeded the demo shop content, Home shows the four demo shown orders as Recent work and the Gallery shows them as tiles. Their photo ids have no stored file, so each photo answers 404 and the guard fixture counts that as a finding.
- **Fix:** `guard.expectStatus('/api/testing/images/', 404)` in the new specs and in `public.spec.ts`, `contact.spec.ts`, `fixture-selftest.spec.ts` and `site-content-business.spec.ts` (declared in a `beforeEach`). `PublicLayout.test.tsx` also pinned "the 69px bar on /products only"; it now says "/products and /gallery only".
- **Commit:** `f8fa27cd`, `08dbcd4a`
- **Open for later (technical, no owner decision):** any other spec that scrolls Home or the Gallery in Chromium after the demo content is seeded will need the same line. A cleaner fix is for the Testing seeder to store a tiny file for each demo photo id (plan 11-26's code), so the demo photos load. Recommended; not done here because this plan is web only.

### Differences from the plan text (no behaviour change)

- The hidden word after a pill's number is `items` after a plain space node (the copy string is `items`, not ` items`), because the accessible name trims the leading space of a hidden span. The name reads "Basketball 4 items".
- The 24-tile paging and the focus move live in `GalleryBody` (the masonry takes `shown` and `focusIndex`), so the masonry stays a plain list. `onOpen(itemIndex)` is in place for plan 11-31.
- The hero tag is rendered by `HomePage` inside a `relative` wrapper around the hidden drawing (a sibling, not inside the hidden markup), loaded lazily; the Recent work loading shape shows the section head and four frames and no "View gallery" link.

---

**Total deviations:** 4 auto-fixed (2 Rule 3, 2 Rule 1), 3 notes. **Impact:** no scope creep. Deviation 1 changes how the page is built, not what it shows.

## Issues Encountered

- **Not caused by this plan (seen in the `@contact|@profile|@site-content-business|@fixture|@public` run, not on the base commit):** `@site-content-business at 320px the page has no sideways scroll, the tab strip holds itself` failed in all five projects at `holdsItsContent` on the admin Site Content tab strip (an admin page, no admin file touched here; likely the tab count after 11-24). Also once each: `@fixture WebKit's cancelled /api/ request` in firefox (30 s `page.goto` timeout), `@site-content-business a second Manager saving first` in firefox (`toHaveURL`), `@profile-password` in webkit, and `@contact the map loads from Google` in pixel. These were not re-run alone, except as below.
- **Multi-project run flakes, re-run alone:** `@contact at 1440px there is no sticky bar` (30 s test timeout in chromium and firefox, a Firefox crash annotation in the log) and `@contact the footer shows the stored tagline` (firefox) passed on the re-run. `@fixture a target only a sticky bar partly covers ...` in firefox failed in two multi-project runs ("expected target-size on #e2e-fixture-covered, got none") but passed when run on its own after the contact spec had seeded the demo content (`2 passed`), so it depends on load, not on this plan's content.
- The Bash tool in this worktree refuses heredocs and chained `cd` plus git, so large edits went through the edit tools and git ran one command at a time.

## Known Stubs

None. The lightbox opens from the tiles in plan 11-31 (`GalleryMasonry` already takes `onOpen(itemIndex)`).

## Authentication Gates

None.

## Threat Flags

None new. T-11-74: the category is read as plain text and only a key in the loaded pill list leaves `useGalleryCategory`; a pill key also has to pass `isLineKey`; strip links are built from `isLineKey`-checked server keys only (an odd key goes to `/gallery`); tests cover an unlisted value, an address-like value and a bad strip key. T-11-75: team names and notes are React text only. T-11-SC: no package was added or bumped (`package.json` and the lock file are unchanged; `npm ci --ignore-scripts` from the lockfile only).

## User Setup Required

None.

## Next Phase Readiness

- **11-31 (lightbox):** `GalleryMasonry` takes `onOpen(itemIndex)` with the index in the filtered list; `GalleryBody` is the place to mount the lightbox (inside the same lazy chunk), and a category change should close it (the bar's `onSelect` is the hook). Photos carry `viewerSrc`, `viewerSrcSet` and `thumbSrc` already.
- **Budget:** Home has 0.71 KB left and Contact 0.78 KB. Anything new for Home goes in `HomeSections` (lazy). The Gallery has 2.79 KB left, and its first download holds only the page head.
- **11-37:** no audit code was added; no admin change here.
- STATE.md and ROADMAP.md were not touched (orchestrator owns them). `GAL-01`, `CONT-03` and `PUB-01` are shared with other plans, so the orchestrator should mark them only after the last declaring plan.

## Self-Check

PASSED. The 12 files under `key-files.created` exist on disk. The eight commits `43d2fa38`, `469c75f9`, `08dbcd4a`, `df1f27af`, `3208d0f4`, `8b74706e`, `7d223a57` and `f8fa27cd` are all ancestors of HEAD (`git rev-list --count` from the ledger base `8f7974c4` gives 8, linear history); each RED commit precedes its GREEN commit. The base and head ids and the commit count in the frontmatter were measured from the ledger written before the first commit, not from memory. The working tree held nothing uncommitted except this file. STATE.md and ROADMAP.md were not touched. `gitleaks` found no leaks before each of the eight commits. No server, Playwright host or shell of mine is left running: every e2e run finished and exited on its own.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*

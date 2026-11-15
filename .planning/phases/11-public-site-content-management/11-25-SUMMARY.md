---
phase: 11-public-site-content-management
plan: 25
subsystem: ui
tags: [react, public-site, home, boot-data, lazy-chunks, bundle-budget, category-card, testimonials, a11y, playwright]
created: 2026-11-12T14:39:30-06:00
updated: 2026-11-12T14:39:30-06:00

requires:
  - phase: 11-21
    provides: "GET /api/v1/public/home and the home boot key (lines as cards, line count, first three testimonials)"
  - phase: 11-18
    provides: "createPublicResource pattern, the Products state parts, the public bundle rules (lazy parts, no new readers of shared states)"
  - phase: 11-10
    provides: "the site facts (turnaroundLine, messengerUrl) and the boot data reader"
provides:
  - "contentService.getHome and useHomeQuery (home boot key, then GET /api/v1/public/home, revalidated after 5 minutes)"
  - "CategoryCard optional photo prop (LazyImage, srcSet, sizes, 4:5 box); unchanged when no photo is passed"
  - "CategoryGrid (one card per active line to /products#key, lead counts lines in words), HeroArt, WhyCsps (turnaround line or no-promise text), HowOrdering, TestimonialRow (first three, stars, phone region), FinalCta"
  - "HomePage with the hero drawing, the sections in spec order and loading, empty and failed states in one region named Loading the page"
  - "PublicLoadingRegion shared by Products and Home; PublicOutletContext now also carries turnaroundLine"
  - "Fixtures demoHome, homeNoLines, homeNoTestimonials, homeOneLine, makeHomeLine, makeTestimonial and a default home answer in the jsdom setup; web/e2e/home.spec.ts (@home, 14 specs, 70 runs)"
affects: [11-26, 11-29, 11-34, 11-37]

actuals:
  tokens: 20000
  tasks: 3
  commits: 6
plan_head_before: 5ab9eb50ddfe92da4a3d734afb56329742d3ea73
plan_head_after: 6a662660a8d0d78a27db44153e8cba27883520e8

tech-stack:
  added: []
  patterns:
    - "Everything on Home below the product cards is one lazy chunk declared in one file (lazyHome.ts), so the route's first download stays under 150 KB"
    - "The layout hands the page the shop facts it needs (Messenger link, turnaround line) through the router outlet context, so the page adds no second reader of the facts hook"
    - "Stacked container variants (pg-md-up:pg-lt-xl:, pg-tablet:) where a plain wider rule would also win on phones, because the variants are declared phone first"
    - "Loading shapes are written from Skeleton and the real parts' own classes, never from the shared Skeletons file (it pulls in an admin barrel)"

key-files:
  created:
    - web/src/modules/public/hooks/useHomeQuery.ts
    - web/src/modules/public/hooks/useHomeQuery.test.tsx
    - web/src/modules/public/components/CategoryGrid.tsx
    - web/src/modules/public/components/CategoryStates.tsx
    - web/src/modules/public/components/HeroArt.tsx
    - web/src/modules/public/components/WhyCsps.tsx
    - web/src/modules/public/components/HowOrdering.tsx
    - web/src/modules/public/components/TestimonialRow.tsx
    - web/src/modules/public/components/TestimonialSkeletons.tsx
    - web/src/modules/public/components/FinalCta.tsx
    - web/src/modules/public/components/HomeSections.tsx
    - web/src/modules/public/components/lazyHome.ts
    - web/src/modules/public/components/home.recipe.ts
    - web/src/modules/public/components/home.test.tsx
    - web/e2e/home.spec.ts
  modified:
    - web/src/modules/public/services/contentService.ts
    - web/src/modules/public/services/contentService.test.ts
    - web/src/modules/public/pages/HomePage.tsx
    - web/src/modules/public/pages/HomePage.test.tsx
    - web/src/modules/public/components/ProductStates.tsx
    - web/src/modules/public/copy.ts
    - web/src/modules/public/outletContext.ts
    - web/src/layouts/PublicLayout.tsx
    - web/src/components/marketing/CategoryCard.tsx
    - web/src/components/marketing/marketing.recipe.ts
    - web/src/components/marketing/marketing.test.tsx
    - web/src/components/marketing/index.ts
    - web/src/test/publicFixtures.ts
    - web/src/test/setup.ts

key-decisions:
  - "Everything below the cards (Why CSPS, the steps, testimonials, final call to action) is one lazy chunk. The first full build put the Home route at 153.09 KB (limit 150.00); with the chunk lazy it is 148.88 KB."
  - "The turnaround line reaches Why CSPS through the outlet context, the way the Messenger link already reaches Products. While the shop facts load it is null, so the card shows the no-promise text, never a time the Manager did not type."
  - "The Products loading region became PublicLoadingRegion (a messages prop and a failed flag); Home and Products share it and the same error banner, and the shared Skeletons and LoadingRegion parts stay out of the public chunks."
  - "The category skeletons keep the section head and give each card frame the 4:5 media box plus a body the height of a real card, so the page keeps its size when the cards land."
  - "On a phone the testimonial row is a focusable region named Testimonials (SPEC-DEVIATION A11Y-SCROLL); on a wider screen it is plain markup with no tab stop. The switch follows matchMedia (max-width: 767px)."

requirements-completed: [PUB-01, PUB-02, CONT-03]

coverage:
  - id: D1
    description: "Home shows one category card per active line in display order with the title, card text, number, the Main photo when set and a link to /products#key; the lead counts the lines in words (one line reads 'One way to suit up, ...')"
    requirement: PUB-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/home.test.tsx (CategoryGrid); web/src/components/marketing/marketing.test.tsx (the photo prop); web/src/modules/public/pages/HomePage.test.tsx (product categories)"
        status: pass
      - kind: e2e
        ref: "web/e2e/home.spec.ts @home / shows six category cards ... with no home request on the first load (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The first visit reads the home boot block with no request; a page without it reads GET /api/v1/public/home"
    requirement: PUB-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/hooks/useHomeQuery.test.tsx; web/src/modules/public/services/contentService.test.ts; HomePage.test.tsx (reads the home boot block on a first visit)"
        status: pass
      - kind: e2e
        ref: "web/e2e/home.spec.ts @home (home request list stays empty on the first load)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hero with the decorative drawing (aria-hidden, no style attribute), Why CSPS with the typed turnaround line or the no-promise text, the four steps, the first three testimonials with stars and the final call to action with the Messenger button only when a link is set"
    requirement: PUB-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/home.test.tsx (HeroArt, WhyCsps, HowOrdering, TestimonialRow, FinalCta); HomePage.test.tsx (HomePage story)"
        status: pass
      - kind: e2e
        ref: "web/e2e/home.spec.ts @home / shows the demo testimonials in order and the typed turnaround line (5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "At phone width the testimonial row is a focusable region named Testimonials with a visible focus ring and scrolls inside itself; no sideways scroll from 320 to 1920 px; the Why CSPS and testimonial grids have the spec's column counts"
    requirement: CONT-03
    verification:
      - kind: e2e
        ref: "web/e2e/home.spec.ts @home at 390px the testimonials are a focusable region ...; @home at {320,768,1024,1280,1920}px no sideways scroll; @home at {1400,1100,900}px columns; @home at 390px Why CSPS is one column (5 projects each)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Loading shows six 4:5 card frames and three testimonial frames with four lines in one region named Loading the page; no active line or no shown testimonial leaves only that section out; a failed read shows the product lines error with Try Again and no testimonials; zero axe in each"
    requirement: PUB-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/HomePage.test.tsx (HomePage states: 5 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Zero axe, console and CSP findings on / at 390 and 1440 px (the e2e guard fixture fails any finding)"
    requirement: PUB-01
    verification:
      - kind: e2e
        ref: "web/e2e/home.spec.ts @home at 390px / at 1440px there are no axe, console or CSP findings and no sideways scroll (5 projects each)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Home route stays inside the 150 KB public budget"
    requirement: PUB-01
    verification:
      - kind: other
        ref: "npm --prefix web run build:budget: public JS (home) 148.88 KB of 150.00"
        status: pass
    human_judgment: false
  - id: D8
    description: "CategoryCard with no photo renders exactly as before"
    requirement: PUB-02
    verification:
      - kind: unit
        ref: "marketing.test.tsx (without a photo (undefined) renders exactly the same markup as before; the original CategoryCard tests unchanged)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run parity -- --grep @marketing: 14 passed"
        status: pass
    human_judgment: false
  - id: D9
    description: "CONT-03 prohibition: the page never shows a turnaround time promise the Manager did not type (D-36)"
    requirement: CONT-03
    verification:
      - kind: unit
        ref: "home.test.tsx (WhyCsps: the typed line as typed; the fallback for null, empty and blank); HomePage.test.tsx (fallback by default, typed line when set)"
        status: pass
    human_judgment: true
    rationale: "The plan flags this prohibition as a judgment item (product, unverified). The tests show the card text is the typed line or a fixed text with no time in it; whether that fixed wording reads as no promise to the owner is a reviewer call."
  - id: D10
    description: "The Home page looks like the approved App. E.1 design (hero drawing, cut bands, cards, Why CSPS, steps, testimonial row, orange band)"
    verification: []
    human_judgment: true
    rationale: "No parity scenario covers the Home page (the plan lists none), so the owner reviews the look in the UI review."

duration: about 90 min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 25: Visitors land on a Home page with the real product lines, promises and testimonials Summary

**Home now draws the Manager's product lines as category cards (with each Main photo), the hero drawing, Why CSPS with the Manager's own turnaround line or a no-promise text, the four steps, the first three real testimonials and the final call to action, all from the `home` boot block with no extra request, in every loading, empty and failed state, at 148.88 KB of the 150 KB budget.**

## Performance

- **Duration:** about 90 min
- **Started:** 2026-11-12T13:09:00-06:00
- **Completed:** 2026-11-12T14:39:30-06:00
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files in the diff:** 29 (15 created, 14 modified, no file deleted). The token figure (chars/4 of the added lines under `web/`) is about 20,000, far under the plan's estimate of 120,000.

## Accomplishments

- **Tracer (Task 1):** `getHome` and `useHomeQuery` (boot key `home`), the `CategoryCard` photo prop, `CategoryGrid` and the page wiring. The tracer's `<verify>` holds only `<automated>` commands, so they were re-run on the finished tree before expansion: the five unit files (44 tests) and `@home` on all five projects (5 passed). Tracer verified end to end, expanding.
- **Task 2:** `HeroArt` (the App. E.1 drawing, decorative), `WhyCsps`, `HowOrdering`, `TestimonialRow`, `FinalCta` and the lazy chunk that holds the last four.
- **Task 3:** `CategorySkeletons`, `TestimonialSkeletons`, `CategoriesError`, the shared `PublicLoadingRegion`, and the empty and failed paths.
- The line key is checked by `isLineKey` before it becomes a card address (T-11-63); an odd key sends the card to `/products`.

### Public bundle figures (gzip -9, 1 KB = 1000 B, limit 150.00 KB; `npm --prefix web run build:budget`)

| Page | After wave 9 (orchestrator note) | Tracer (Task 1) | First full Task 2 build | Final |
|---|---|---|---|---|
| home | 141.25 | 145.61 | 153.09 (over) | **148.88** |
| products | 145.07 | 145.16 | 145.27 | 145.65 |
| gallery | 146.56 | 146.60 | 146.70 | 146.72 |
| contact | 148.74 | 148.78 | 149.13 | **149.15** (0.85 KB left) |
| notFound | 141.76 | 141.80 | 141.91 | 141.92 |

Admin 220.03 KB, CSS 18.83 KB. The home figure the criteria ask for is **148.88 KB** (1.12 KB left).

## Task Commits

1. **Task 1 (tracer):** RED `0b2bbea9` (test), GREEN `f2affcb1` (feat)
2. **Task 2:** RED `fb2fd3d9` (test), GREEN `53b25738` (feat)
3. **Task 3:** RED `d51f89ea` (test), GREEN `6a662660` (feat)

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) was not required and was not run. Each RED run was read for the right reason, and each RED commit precedes its GREEN commit.

- **Task 1 RED (`0b2bbea9`):** 17 of 44 tests failed on planned assertions, against three stubs (a `getHome` that answers an empty home, a hook that stays loading, a grid that draws nothing). They are the `getHome` body and error cases, the four hook cases, the photo prop, the seven grid cases and three Home page cases.
- **Task 2 RED (`fb2fd3d9`):** 22 of 30 `home.test.tsx` tests failed and 7 of 22 `HomePage.test.tsx` tests, against stubs that return nothing. The "wide screen is not a region" and "no Messenger button" cases passed at once (they guard the behavior from the other side); recorded, not hidden.
- **Task 3 RED (`d51f89ea`):** 4 tests failed: loading, the failed read, Try Again, and an existing "Get a Quote" test (see Deviation 3). The no-lines and no-testimonials cases passed at once, because the page already left those sections out; they stay as guards.
- The e2e specs were committed with their RED and run only after GREEN. Two of them were wrong and fixed (see Issues).
- No REFACTOR commit was needed.

## Verification evidence (real output)

- **Unit, plan command:** `npm --prefix web run test -- --run src/modules/public src/components/marketing src/test/no-long-dash.node.test.ts` (plus `src/layouts`): `Test Files 26 passed (26)`, `Tests 400 passed (400)`.
- **Full web unit suite** (`npx vitest run`): `Test Files 1 failed | 364 passed (365)`, `Tests 1 failed | 10064 passed (10065)`. The one failure is `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions", the known fresh-worktree install problem the orchestrator notes record. This plan touches no package file.
- **`npm --prefix web run e2e -- --grep @home`** on the finished tree: `70 passed (2.9m)` (14 specs in chromium, firefox, webkit, pixel, iphone).
- **`npm --prefix web run e2e -- --grep @products`** (Products shares the region I changed): `30 passed (1.8m)`.
- **`npm --prefix web run parity -- --grep @marketing`** (the CategoryCard scenarios): `14 passed (48.4s)`.
- **Full parity run:** started, then stopped by me after 127 of 500 tests (it ran past what a background run is allowed to take). Of those, 6 failed: `@navigation @overflow` (2) and `@parity @data` (4), both groups on the orchestrator's known baseline list (50 failures at `f8cbb402`). Not compared further; the groups this plan can touch (`@marketing`) pass in full.
- **`npm --prefix web run lint`** on `src/modules/public src/layouts src/components/marketing src/test e2e/home.spec.ts` (`--max-warnings 0`): exit 0, no output. **`npm --prefix web run typecheck`**: exit 0, no output. Prettier clean on every changed file. The class gate (`scripts/tailwind-classes.test.ts`): `57 passed`. `src/test/no-long-dash.node.test.ts`: passed.
- **Acceptance greps:** `/products#` in `CategoryGrid.tsx`: 1; `photo` in `CategoryCard.tsx`: 14; `turnaroundLine` in `WhyCsps.tsx`: 4; `SPEC-DEVIATION: A11Y-SCROLL` in `TestimonialRow.tsx`: 1; `Loading the page` in `copy.ts`: 1; `aria-hidden` in `HeroArt.tsx`: 1; `useHomeQuery` in `HomePage.tsx`: 2; `style=` in `HeroArt.tsx`: 0.
- gitleaks ran before every commit (the repo hook): no leaks. The diff holds only made-up names (Juan Dela Cruz, Ana Reyes, Ben Santos, Brgy. Sample Ballers), `sample-cloud` photo addresses and the `cspsdemo` links already in the fixtures.

## Decisions Made

See `key-decisions`. The ones the owner may want to look at: the lazy chunk (the cards are eager, everything below them loads after the page), the null turnaround line while the shop facts load, and the 6-card default of the loading shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Home route went over the 150 KB budget, so everything below the cards is one lazy chunk**
- **Found during:** Task 2 (the e2e build runs the budget)
- **Issue:** Home 153.09 KB after the five new parts.
- **Fix:** `HomeSections.tsx` composes Why CSPS, the steps, the testimonials and the final call to action; `lazyHome.ts` declares it in one file. Home 147.57 KB, then 148.88 KB with the Task 3 states.
- **Files modified:** `HomeSections.tsx`, `lazyHome.ts` (not in the plan's file list), `HomePage.tsx`
- **Commit:** `53b25738`

**2. [Rule 3 - Blocking] The loading region and error banner come from the Products parts, generalized**
- **Found during:** Task 3
- **Issue:** the plan names LoadingRegion, ErrorState and SkeletonImage, but the 11-18 and 11-20 notes say reading them from a public page regroups shared chunks and puts Contact over its limit (Skeletons.tsx also pulls in the admin money barrel).
- **Fix:** `ProductStates.tsx` gained `PublicLoadingRegion` (a `messages` prop and a `failed` flag); `ProductsLoadingRegion` is now a thin wrapper, `ProductsError` is reused as it is (same words as the categories error). The card skeleton uses `Skeleton` and an `aspect-4/5` box instead of `SkeletonImage` and `--ratio`. Copy `states.loaded.page` ("The page loaded.") is new. Contact moved from 148.74 to 149.15 KB over the whole plan (0.85 KB left).
- **Files modified:** `ProductStates.tsx`, `copy.ts`, `CategoryStates.tsx` (not in the plan's file list)
- **Commit:** `6a662660`

**3. [Rule 1 - Existing tests that pinned the old page]**
- **Found during:** Task 2 and Task 3
- **Issue:** two HomePage tests assumed one "Get a Quote" link and a unique chip text; with the final call to action and the Why CSPS titles there are two links and two matches. A third needed the lazy final call to action to have loaded before it counted links.
- **Fix:** the first test expects the two links (hero and final), the chip test looks for the chip span among the matches, and the link test waits for the final call to action's heading. The Task 3 tests that waited for the "Pick your kit." heading now wait for the first card's text, because the loading shape also has that heading.
- **Files modified:** `HomePage.test.tsx`
- **Commit:** `53b25738`, `d51f89ea`, `6a662660`

**4. [Rule 1 - Bug] Two e2e specs were wrong**
- **Found during:** Task 2
- **Issue:** the focus-ring spec read the ring through `locator.evaluate` with a function string, which returned undefined in all five projects; the column spec expected two testimonial columns at 1100 px, but the spec makes that three (two only up to 1023 px).
- **Fix:** the ring and the overflow are read with a `page.evaluate` expression; the 1100 px row expects three. Re-run: 10 passed.
- **Commit:** `53b25738`

**5. [Rule 3 - Blocking] Shared test setup and one layout file changed**
- `web/src/test/setup.ts` answers `GET /api/v1/public/home` by default (MSW fails any unhandled request), `publicFixtures.ts` gained the Home fixtures and `putBootBlock` a third argument, `PublicOutletContext` and `PublicLayout.tsx` carry the turnaround line, and `marketing.recipe.ts` / `index.ts` got the photo class and type. None of these is in the plan's file list.
- **Commits:** `0b2bbea9`, `f2affcb1`, `53b25738`

### Differences from the plan text (no behavior change)

- **"as many SkeletonImage cards as the last count (default 6)".** The loading shape only shows before the first answer, so no earlier count exists in that state; it always shows 6 frames. A first visit normally never shows it, because the boot block carries the data.
- **The ordering steps are a part of their own** (`HowOrdering.tsx`), not inside `WhyCsps`, so the two sections can be tested alone.
- **CategoryCard hover with a photo scales 1.04 only.** The existing image rule also moves the picture up by 52% (that is the placeholder number's rise); applied to a photo it would lift it out of its box. The no-photo and plain-image looks are untouched (noted as a SPEC-DEVIATION in the file).
- **The hero tag is not drawn.** The plan and the UI-SPEC give it to plan 11-29, with the Recent work strip.

---

**Total deviations:** 5 auto-fixed (3 Rule 3, 2 Rule 1), 4 notes. **Impact:** no scope creep. Deviations 1 and 2 change how the page is built, not what it shows.

## Issues Encountered

- The first full e2e build failed on the budget (Home 153.09 KB); the lazy chunk fixed it (Deviation 1).
- A full parity run is too long for a background run here (500 tests, roughly 30 minutes); I stopped it and ran `@marketing`. The stopped run left a stale `web/.locks/parity.lock`, which I removed (my own run's file).
- The Bash tool in this worktree refuses heredocs and chained git commands, so edits went through the edit tools and git ran one command at a time.

## Known Stubs

None. Intended gaps with a later plan: the Recent work strip and the hero tag (11-29; the data is `recentWork []` and `heroTag null` until 11-26), and the product line photos are `null` until a Manager adds them (the cards then show the placeholder number).

## Authentication Gates

None.

## Threat Flags

None new. T-11-63: card and testimonial text goes through React only, the line key is checked by `isLineKey` before it becomes an address (a test sends a key with a space and gets `/products`), and the boot block is the server's encoded JSON. T-11-64: deep imports only (no admin barrel), and the per-route budget run is the check (home 148.88 KB). T-11-SC: no package added or bumped (`package.json` and the lock file are unchanged).

## User Setup Required

None.

## Next Phase Readiness

- **11-29 (Recent work and hero tag):** `HeroArt` leaves room for the tag (the art container is the positioning frame); `HomeSections` is where a strip would sit between the steps and the testimonials, but it must stay lazy. `PublicHome.recentWork` and `heroTag` are already typed.
- **Budget:** home has 1.12 KB left, contact 0.85 KB, products 4.35 KB, gallery 3.28 KB. Anything added to the Home entry must go in `HomeSections` (lazy); a reader of `useSiteQuery`, `LoadingRegion`, `ErrorState` or `ButtonLink` in a public chunk must be budget-run first (11-18 and 11-20 notes still hold).
- **11-34 and 11-37:** no new audit code and no admin change here.
- STATE.md and ROADMAP.md were not touched (orchestrator owns them). `PUB-01`, `PUB-02` and `CONT-03` are shared with other plans, so the orchestrator should mark them only after the last declaring plan.

## Self-Check: PASSED

All 15 created files under `key-files.created` exist on disk, and the six task commits (`0b2bbea9`, `f2affcb1`, `fb2fd3d9`, `53b25738`, `d51f89ea`, `6a662660`) are ancestors of HEAD; each RED commit precedes its GREEN commit. The commit count and the base and head ids in the frontmatter were measured with `git rev-list --count` and `git rev-parse` from the ledger written before the first commit, not written from memory. Every task's acceptance greps were re-run and pass (see Verification evidence). The plan-level verification is green apart from the one known baseline unit failure (`license-policy.test.ts`) and the partial parity run explained above.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*

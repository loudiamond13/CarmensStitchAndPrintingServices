---
phase: 11-public-site-content-management
plan: 18
subsystem: ui
tags: [react, public-site, products, jersey-art, boot-data, lazy-chunks, bundle-budget, playwright, a11y]
created: 2026-11-12T08:35:00-06:00
updated: 2026-11-12T08:35:00-06:00

requires:
  - phase: 11-15
    provides: "GET /api/v1/public/product-lines, the productLines boot key on /products, the six seeded lines, the Testing seeder (basketball 650.00, minimum 10)"
  - phase: 11-10
    provides: "createPublicResource, the boot data reader, siteService and useSiteQuery, the site content lock for e2e"
  - phase: 11-08
    provides: "PublicLayout, PageHead, public.recipe, PUBLIC_COPY, the per-page bundle budget"
provides:
  - "contentService.getProductLines and useProductLinesQuery (productLines boot key, then the API)"
  - "JerseyArt (tank and long sleeve, spec 7.5 paths) and artFor(placeholderArt)"
  - "PriceLine, ProductMedia, ProductArticle, ProductList (own chunk), AnchorPills, ProductsHelp (own chunk), ProductsEmpty (own chunk), ProductSkeletons, ProductStates"
  - "ProductsPage with the lead in words, the sticky 44px pill bar, one article per shown line, the help card, loading, error and empty states, and the hash scroll"
  - "isLineKey, the client allow-list for line keys (T-11-44)"
  - "PublicOutletContext: the layout hands the Messenger link to page parts"
  - "Fixtures demoLines, demoLine, oneLine, noLines, lineWithPhotos, makeLine, photoFor, productLinesHandler; the lines answer by default in every jsdom test"
  - "web/e2e/products.spec.ts (@products, 6 specs, 30 runs)"
affects: [11-19, 11-25, 11-26, 11-29, 11-37]

actuals:
  tokens: 21600
  tasks: 3
  commits: 6
plan_head_before: d8662217ef02918f4499453c291614c7efe0387f
plan_head_after: c4045266aa41d7f699892a60088436a45506579b

tech-stack:
  added: []
  patterns:
    - "Parts a page needs only after its data arrives (articles, help card, empty state) are lazy chunks declared in one file (lazyProducts.ts), so the route's first download stays under the budget"
    - "A page part that needs a shop fact the layout already reads takes it from the router's outlet context, not from a second reader of the facts hook (a third reader split a shared chunk)"
    - "Page-specific loading region and error banner when reading the shared ones would regroup chunks that Contact and the admin share"
    - "Hash scroll after the articles mount and the fonts are ready, instant under prefers-reduced-motion, no focus move"

key-files:
  created:
    - web/src/modules/public/services/contentService.ts
    - web/src/modules/public/hooks/useProductLinesQuery.ts
    - web/src/modules/public/lineKey.ts
    - web/src/modules/public/outletContext.ts
    - web/src/modules/public/components/JerseyArt.tsx
    - web/src/modules/public/components/PriceLine.tsx
    - web/src/modules/public/components/ProductMedia.tsx
    - web/src/modules/public/components/ProductArticle.tsx
    - web/src/modules/public/components/ProductList.tsx
    - web/src/modules/public/components/AnchorPills.tsx
    - web/src/modules/public/components/ProductsHelp.tsx
    - web/src/modules/public/components/ProductsEmpty.tsx
    - web/src/modules/public/components/ProductSkeletons.tsx
    - web/src/modules/public/components/ProductStates.tsx
    - web/src/modules/public/components/lazyProducts.ts
    - web/src/modules/public/components/products.recipe.ts
    - web/e2e/products.spec.ts
  modified:
    - web/src/modules/public/pages/ProductsPage.tsx
    - web/src/modules/public/copy.ts
    - web/src/modules/public/components/PageHead.tsx
    - web/src/layouts/PublicLayout.tsx
    - web/src/layouts/PublicLayout.test.tsx
    - web/src/test/publicFixtures.ts
    - web/src/test/setup.ts
    - docs/web/e2e.md

key-decisions:
  - "The articles, the help card and the empty state are lazy chunks. The first build put the Products route at 150.28 KB (limit 150.00); with the articles lazy it is 144.01 KB, and the finished page is 146.22 KB."
  - "The help card and the empty state get the Messenger link from the layout through the router's outlet context. A third reader of useSiteQuery split it out of the footer chunk and cost every Contact visitor 0.22 KB."
  - "The loading region, the error banner and the empty-state button are written for this page (ProductStates.tsx, ProductsEmpty.tsx) instead of reading LoadingRegion, ErrorState and ButtonLink. Reading them split a chunk Contact shares with the admin and put Contact at 150.16 KB."
  - "The article scroll-margin-top is 16px, not header + pill bar + 16px. The page already has the larger scroll padding (header + 1px + 24px + the 69px bar), and browsers add the two, which would stop an article about 300px down the screen. Open item for the owner, below."
  - "Pills keep the page's side padding (24px, 16px on phones) instead of App. C's 0, so the first pill lines up with the page text and its focus ring is not clipped at the screen edge."
  - "A key that fails the allow-list gets no pill, no See work link and no hash scroll (isLineKey: lower case letters and digits joined by single hyphens, the server's LineKey rule)."

requirements-completed: [PUB-01, PUB-02, CONT-02]

coverage:
  - id: D1
    description: "/products shows one article per shown line in display order from the productLines boot block with no request on a first visit, the lead counts the lines in words, and a single line reads 01 / 01"
    requirement: PUB-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/ProductsPage.test.tsx (product articles); web/src/modules/public/hooks/useProductLinesQuery.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/products.spec.ts @products shows six articles ... no lines request on the first load (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each article shows the number, title, description, the five fixed customize cards with their icons, the price line from the server value ('Starts at ₱650.00 / pc · min. 10 pcs', 'min. 1 pc', 'Message us for a price') and the buttons"
    requirement: PUB-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/products.test.tsx (ProductArticle, PriceLine, buttons)"
        status: pass
      - kind: e2e
        ref: "web/e2e/products.spec.ts @products shows six articles and the basketball demo price"
        status: pass
    human_judgment: false
  - id: D3
    description: "The main photo or the drawn jersey, the back and fabric photos or labelled placeholders, with the front, back view and fabric detail alts and the product srcset sizes"
    requirement: PUB-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/products.test.tsx (ProductMedia); JerseyArt.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "The sticky pill bar (44px pills, key allow-list), the Get a Quote, See work and Message us links, the hash scroll (once, instant under reduced motion, no focus move, after the fonts) and the larger scroll padding on /products"
    requirement: PUB-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/products.test.tsx (AnchorPills, buttons); ProductsPage.test.tsx (pills and help card, hash on load); web/src/layouts/PublicLayout.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/products.spec.ts @products #polo, 320px pill bar, focus clear of the sticky bars (5 projects each)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Loading (six 44px pill skeletons, two article skeletons, 'Loading the product lines…'), failed read (error with Try Again, help card stays) and empty (no pill bar, 'Our product list is being updated', Message Us or Get a Quote) states"
    requirement: CONT-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/ProductsPage.test.tsx (states)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Zero axe, console and CSP findings on /products at 390 and 1440 px, and no sideways scroll from 320 px"
    requirement: PUB-01
    verification:
      - kind: e2e
        ref: "web/e2e/products.spec.ts @products at 390px / at 1440px ... (5 projects each); @products at 320px"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Products page looks like the approved App. E.2 design (media grid, jersey drawings, cards, pills, help card) and the pill bar and the hash landing feel right"
    requirement: PUB-01
    verification: []
    human_judgment: true
    rationale: "No parity scenario exists for Products (the plan lists none), so the owner reviews the look in the UI review; the article scroll-margin and the pill bar side padding are owner rulings (open items)"
  - id: D8
    description: "PUB-02 prohibition: no price is computed or rounded in the browser beyond formatting the server's value"
    requirement: PUB-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/products.test.tsx (PriceLine: server number and string values written with formatPeso)"
        status: pass
    human_judgment: true
    rationale: "Flagged unverified in the plan (verification: judgment); tests show the figure is written as given, and PriceLine has no arithmetic, but the verifier should read it"

duration: about 95 min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 18: Visitors browse every product line with its price, customizations and photos Summary

**/products now draws one article per shown product line (number, title, description, the five fixed customize cards, the Manager's price line, media with the drawn jersey or photos), a sticky 44px pill bar, the help card, loading, error and empty states and a hash scroll, all from the productLines boot block with no request on a first visit and inside the 150 KB budget.**

## Performance

- **Duration:** about 95 min
- **Started:** 2026-11-12T06:55:00-06:00 (approx.)
- **Completed:** 2026-11-12T08:35:00-06:00
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files changed:** 31 (22 created, 9 modified, tests and the e2e guide included), 6 commits before this SUMMARY

## Accomplishments

- **Tracer (Task 1):** `contentService`, the `productLines` boot resource, `JerseyArt` with the verbatim spec 7.5 paths and the 7.2 colors, `PriceLine` (D-04, `formatPeso` on the server value only), `ProductMedia` (D-02), `ProductArticle` (D-07 cards in fixed order and icons) and the page. The e2e tracer saw the six articles and "Starts at ₱650.00 / pc · min. 10 pcs" from the seeded database in all five projects.
- **Task 2:** `AnchorPills` (nav "Product lines", 44px pills, allow-listed keys), Get a Quote and See {short} work (only for lines with gallery items), the help card, the hash scroll, and the 69px pill bar added to the layout's top scroll padding on `/products` only.
- **Task 3:** loading shapes, the error with Try Again, the empty state, one line / bare line / long text cases, zero axe, console and CSP findings at 390 and 1440 px.
- Every line key is checked by `isLineKey` before it reaches an href, an id lookup or the hash scroll (T-11-44).

### Public bundle figures (gzip -9, 1 KB = 1000 B, limit 150.00 KB; `npm --prefix web run build:budget`)

| Page | Before this plan (11-16 baseline) | Now |
|---|---|---|
| home | 142.12 | 142.29 |
| products | about 142.5 (head only) | **146.22** |
| gallery | 147.47 | 147.66 |
| contact | 149.76 | **149.91** (0.09 KB left) |
| notFound | 142.67 | 142.85 |

Admin 221.19 KB, CSS 18.06 KB. The products figure the criteria ask for is **146.22 KB**.

## Task Commits

1. **Task 1 (tracer):** RED `6154a08d` (test), GREEN `a374694b` (feat)
2. **Task 2:** RED `b3a3fb29` (test), GREEN `99f8c930` (feat)
3. **Task 3:** RED `3c4c06a1` (test), GREEN `c4045266` (feat)

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) was not required and was not run. Each RED run was read for the right reason, and each RED commit precedes its GREEN commit.

- **Task 1 RED (`6154a08d`):** 39 of 45 tests failed on planned assertions against stub parts (an empty `{ lines: [] }` read, a loading hook, parts that returned nothing). The 6 that passed were 2 vacuous JerseyArt cases (no style attribute on nothing, the unknown-name fallback) and the 4 head tests that already passed. Tracer gate: the tracer `<verify>` has only `<automated>`, so it was re-run after the GREEN commit (unit tests, then `@products`: 5 passed in 5 projects) before the expansion tasks.
- **Task 2 RED (`b3a3fb29`):** 26 tests failed (allow-list, pills, buttons, help card, hash scroll, layout padding). The "draws nothing", "no hash", "unknown hash" and "no gallery item" cases passed vacuously against the stubs; they guard the behavior from the other side.
- **Task 3 RED (`3c4c06a1`):** 5 tests failed (loading, error, retry, empty with and without Messenger). The one-line, bare-line and long-text tests passed at once because the articles already did that; recorded, not hidden. The two e2e axe tests were committed with the RED and also passed at once.
- **Added with a fix, not before it:** the "waits for the fonts" unit test came after the Firefox finding (see Deviations 5). It passes now; it was not seen failing against the old code.
- No REFACTOR commit was needed.

## Verification evidence (real output)

- **Final unit run of the touched areas** (`src/modules/public`, `src/layouts`, `scripts/tailwind-classes.test.ts`, `src/test/no-long-dash.node.test.ts`): `Test Files 24 passed (24)`, `Tests 386 passed (386)` before the fonts test; `ProductsPage.test.tsx`: `Tests 27 passed (27)` after it.
- **`npm --prefix web run e2e -- --grep @products`** on the finished tree: `30 passed (1.3m)` (6 specs in chromium, firefox, webkit, pixel, iphone).
- **Build budget:** the table above, `npm --prefix web run build:budget`: every public route under 150 KB, contact 149.91 KB.
- **`npm --prefix web run lint`** (`eslint . --max-warnings 0`): exit 0, no output. **`npm --prefix web run typecheck`**: exit 0, no output. Prettier clean on every changed web file.
- **Acceptance greps:** `formatPeso` in `PriceLine.tsx`: 3; `style=` outside comments in `JerseyArt.tsx`: 0; `min-h-11` in `products.recipe.ts`: 1; `prefers-reduced-motion` in `ProductsPage.tsx`: 2; "Our product list is being updated" in `copy.ts`: 1.
- gitleaks ran before every commit: no leaks. The only values in the diff are made up (`sample-cloud` photo addresses, `cspsdemo` links, the demo numbers already in the fixtures).
- **Full web unit suite** (`npx vitest run`, on the finished tree): `Test Files 1 failed | 356 passed (357)`, `Tests 1 failed | 9842 passed (9843)`. The one failure is `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions", the known fresh-worktree install problem the earlier summaries and the orchestrator notes record (`No packages found in this path`). This plan touches no package file.

## Decisions Made

See key-decisions. The ones the owner may want to look at are the 16px article scroll margin, the pill bar side padding and the page-specific state parts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Products route went over the 150 KB budget, so the articles are a lazy chunk**
- **Found during:** Task 1 (the e2e build runs the budget)
- **Issue:** products 150.28 KB. The money formatter (`csps`), `format`, `LazyImage` and the feedback barrel came in with the first article.
- **Fix:** `ProductList.tsx` (the articles) is its own chunk through `lazyProducts.ts` (`LazyProductList`), with an article-skeleton fallback. Products 144.01 KB.
- **Files modified:** `ProductList.tsx`, `lazyProducts.ts` (not in the plan's file list)
- **Commit:** `a374694b`

**2. [Rule 3 - Blocking] The help card gets the Messenger link from the layout through the outlet context**
- **Found during:** Task 2
- **Issue:** a third reader of `useSiteQuery` (the page, then the lazy help card) split it out of the footer chunk. Home and Contact each grew 0.22 KB and Contact went over 150 KB.
- **Fix:** `PublicLayout` reads the facts (the footer already does) and passes `{ messengerUrl }` through `<Outlet context>`; `ProductsHelp` and the empty state read it with `useOutletContext`. New file `outletContext.ts`. Contact 149.88 KB.
- **Files modified:** `PublicLayout.tsx`, `outletContext.ts`, `ProductsHelp.tsx`
- **Commit:** `99f8c930`

**3. [Rule 3 - Blocking] Page-specific loading region, error banner and empty-state button**
- **Found during:** Task 3
- **Issue:** reading the shared `LoadingRegion` and `ErrorState` from this page regrouped a chunk Contact shares with the admin (a new `Badge` chunk), and `ButtonLink` was split out by the lazy empty state. Contact reached 150.16 KB.
- **Fix:** `ProductStates.tsx` has `ProductsLoadingRegion` and `ProductsError` (same behavior and look: aria-busy, a polite status line, an alert with Try Again); `ProductsEmpty.tsx` uses `UiLink` with the `buttonClasses` look instead of `ButtonLink`. About 100 lines are duplicated on purpose. Contact 149.91 KB, products 146.22 KB (146.22 with these, 148.01 with the shared parts).
- **Files modified:** `ProductStates.tsx`, `ProductsEmpty.tsx`, `copy.ts` (`states.loaded.products`)
- **Commit:** `c4045266`
- **Follow-up for the owner or a later plan:** the real fix is in how the build groups shared chunks, not in this page. Until then every public page that reads a shared state part risks the same split.

**4. [Rule 3 - Blocking] Layout padding as one rule plus one property**
- **Found during:** Task 2
- **Issue:** two full scroll-padding class strings in the shared layout cost about 60 B on every page.
- **Fix:** one rule `scroll-pt-[calc(header+1px+24px+var(--bar-top,0px))]` and `--bar-top:69px` on `/products`. The layout test checks both.
- **Commit:** `99f8c930`

**5. [Rule 1 - Bug] Hash scroll landed 96px too high in Firefox**
- **Found during:** Task 3 (the `#polo` e2e spec, Firefox only)
- **Issue:** the display font swaps in after the first paint and re-wraps the titles above the target, moving it about 96px while a smooth scroll was running. The article ended under the pill bar (top 78px, bar bottom 133px). Chromium and the instant case were fine.
- **Fix:** the scroll waits for `document.fonts.ready` (when the browser has it), then runs. Firefox now lands at 174px (158px padding + 16px margin), the same as Chromium. A unit test holds the scroll back until the fonts are ready.
- **Files modified:** `ProductsPage.tsx`, `ProductsPage.test.tsx`
- **Commit:** `c4045266`

**6. [Rule 3 - Blocking] e2e specs need a longer timeout**
- **Issue:** 30 runs queue on the site content lock, so a run waited past the 30 s default (chromium 390px timed out once).
- **Fix:** `test.describe.configure({ timeout: 480_000 })`, as the site content specs do. The polo spec now waits for the article to stop moving, and the 44px checks round the height (Firefox reports 43.99997).
- **Commit:** `c4045266`

**7. [Rule 3 - Blocking] Shared test setup and one shared part changed**
- `web/src/test/setup.ts` answers the product lines by default (MSW fails any unhandled request), `publicFixtures.ts` gained `demoLine`, and `PageHead` accepts `lead?: string | undefined` (`exactOptionalPropertyTypes`). None of these is in the plan's file list.
- **Commits:** `6154a08d`, `a374694b`

### Differences from the plan text (no behavior change)

- The plan's `countInWords(n)` and `piecesLabel(n)` already exist in `copy.ts` as `countWord` and `piecesText`; they are used as they are (digits from 13).
- `isLineKey` is a new small module (`lineKey.ts`, with its test) because three parts need it.
- The plan's unit-test list shows the hash test with `window.location.hash`; the page reads `useLocation().hash` so it works in a memory router.

### Needs the owner (away mode: not decided here)

1. **Article scroll margin.** UI-SPEC P1 gives the page a top scroll padding of header + 1px + 24px + the 69px bar and each article a scroll-margin-top of header + bar + 16px. Browsers add the two, so a pill click would stop an article about 300px down the screen. I kept the page padding (it also covers focus) and set the article margin to 16px, so an article stops 40px under the pill bar. **Recommendation:** keep this. Alternative: drop the page padding on Products and give each article the header + bar + 16px margin (focus then needs its own padding).
2. **Pill bar side padding.** App. C sets it to 0, which puts the first pill against the screen edge and 24px left of the page text. I used the page's side padding. **Recommendation:** keep this. Alternative: follow App. C exactly.
3. **Page-specific state parts (Deviation 3).** They duplicate about 100 lines to stay under the budget. **Recommendation:** keep them for now and plan a build-grouping fix; the alternative is to move more of Contact to lazy chunks.

**Total deviations:** 7 auto-fixed (6 Rule 3, 1 Rule 1), 3 notes, 3 open owner items. **Impact:** no scope creep. The three budget fixes (1 to 3) change how the page is built, not what it shows.

## Issues Encountered

- The first e2e build failed on the budget (150.28 KB); three more budget rounds followed (Deviations 2 and 3). Each was measured with `build:budget` before and after, and a temporary scratch build with the budget error turned into a warning (reverted, never committed) listed the chunk sizes.
- One e2e run timed out on the lock queue and one failed in Firefox on the real scroll shift (Deviations 5 and 6); both were fixed where they started and the whole `@products` set was re-run.
- Not run here: Lighthouse, the Windows deploy job, the parity run (the plan lists no Products scenario), and the e2e suites that do not touch Products.

## Known Stubs

None. Intended gaps with a later plan: `photos` are `null` until plan 11-19 (the drawn jersey and the two placeholders show), and `hasGalleryItems` is `false` until plan 11-26 (so "See {short} work" does not show yet; it is covered by unit tests only).

## Authentication Gates

None.

## Threat Flags

None new. T-11-44: `isLineKey` guards every `#key` pill, every `?category=key` link and the hash lookup (unit tests with `Bad Key`, `javascript:alert(1)`, `../x`). T-11-45: deep imports only, no admin barrel, and the per-route budget (all five public routes under 150 KB) is the check. T-11-SC: no package added or bumped (`package.json` and the lock file are unchanged).

## User Setup Required

None.

## Next Phase Readiness

- Plan 11-19 puts photos into the three slots (`ProductMedia` already draws them with the server's `srcSet` and the product sizes). Plan 11-25 can reuse `JerseyArt` and `artFor` for Home. Plan 11-26 turns on "See {short} work". Plan 11-29 (Gallery) can reuse `isLineKey` and the `category` link.
- Budget: **contact has 0.09 KB left, gallery 2.34 KB, products 3.78 KB, home 7.71 KB.** Anything added to a public page must be a lazy chunk declared in one lazy file, and must not add a reader of `useSiteQuery`, `LoadingRegion`, `ErrorState` or `ButtonLink` to a page chunk without a budget run (Deviations 2 and 3).
- Plan 11-37: no new audit code here.
- STATE.md and ROADMAP.md were not touched (orchestrator owns them). `PUB-01`, `PUB-02` and `CONT-02` are shared with other plans, so the orchestrator should mark them only after the last declaring plan.

## Self-Check: PASSED

All 17 created source and e2e files listed under key-files exist on disk, and the six task commits (`6154a08d`, `a374694b`, `b3a3fb29`, `99f8c930`, `3c4c06a1`, `c4045266`) are ancestors of HEAD. The commit count and the base and head ids in the frontmatter were measured with `git rev-list --count` and `git rev-parse` from the ledger written before the first commit, not written from memory. Every task's acceptance greps were re-run and pass (see Verification evidence). The plan-level verification is green apart from the one known baseline unit failure (`license-policy.test.ts`).

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*

# Bundle budgets: what the build measures and what to do when it fails

*Created: 2026-10-09T03:15:00-05:00 · Updated: 2026-11-22T21:40:00-06:00*

Every `vite build` measures how much JavaScript and CSS a visitor's phone has to download before the first page appears, and the build **fails** when a number passes its limit (requirement PERF-01, plan 02-33). Nobody has to remember to check: `npm run build`, `npm run build:budget` and `npm run verify` all run the same check, and Phase 3 CI runs the same commands.

The code: `web/scripts/budget.ts` (the pure rules, tested with made-up chunk graphs in `budget.test.ts`) and `web/scripts/vite-budget-plugin.ts` (reads the real build output, wired in `web/vite.config.ts`).

## The four limits

| Measure | Limit (gzip -9) | Measured in |
|---|---|---|
| Public initial JS | **150 KB** | every build |
| Admin initial JS | **250 KB** | builds with the dev-only routes (`npm run build:budget`, the e2e build and the parity build) |
| CSS, all files together | **35 KB** | every build |
| Quote form piece | **45 KB** | every build (Phase 13, plan 13-09, D-35); see "The quote form piece" below |

- Sizes are **gzip level 9**, the way the server compresses files, and **1 KB = 1000 bytes**.
- A value exactly at its limit passes: 150,000 bytes of public JS passes and 150,001 bytes fails.

## How "initial JS" is worked out

A route's initial JS is everything the browser must download before that route can show anything:

1. the entry chunk built from `index.html`,
2. the chunk of every route module the route renders on first load,
3. every chunk those chunks import statically, followed all the way down.

Each chunk is counted once, even when several of them import it. Chunks loaded later through a dynamic `import()` are not counted. The three legal rows also list `src/modules/public/legalLoaders.ts`, the chunk their routes fetch before the page (plan 12-32).

| Route | Route modules |
|---|---|
| Public (`/`) | `src/modules/public/pages/HoldingPage.tsx` (the D-17 holding page; `PublicLayout` returns to this row with Phase 11) |
| Admin, signed in (`/admin`) | `src/core/routes/QueryRoot.tsx`, `src/modules/admin/routes.tsx`, `src/layouts/AdminLayout.tsx`, `src/lib/url-state/UrlStateLayout.tsx`, `src/modules/admin/pages/SessionsPage.tsx`, `src/modules/admin/guard.ts` |
| Admin, signed out (`/admin/login`) | `src/core/routes/QueryRoot.tsx`, `src/modules/admin/routes.tsx`, `src/layouts/AuthLayout.tsx`, `src/modules/admin/pages/SignInPage.tsx`, `src/modules/admin/guard.ts` |

The admin number is the larger of the two admin rows. Both ship in every build, so admin JS is measured in the production build too. The dev-only `AdminPreviewPage` is never part of it.

A route module is usually the start of its own lazy chunk. In the parity build the parity page imports some of them directly, so they end up inside a shared chunk; the plugin then measures that shared chunk, because it is what the router downloads.

`QueryRoot` is the lazy route that holds the TanStack Query client for every admin screen. It is in both admin rows because the admin screens need it before they show anything.

If a route module cannot be found in the build at all, the build fails. A renamed or moved route must update `PUBLIC_ROUTE` or `ADMIN_ROUTE` in `budget.ts`; the check never silently skips it.

## Public routes (Phase 11)

From plan 11-08 the public site is measured **one page at a time** (requirement PUB-01, research P-7). Each public page is `PublicLayout` plus that page, on top of the entry chunk and everything they import, and each of the five figures must be at or under 150 KB gzip. A page that grows is named in the table, and the others are not blamed. This replaces the single holding-page row above; the code is `PUBLIC_ROUTES` in `web/scripts/budget.ts`.

| Page | Route modules (after the layout, `src/layouts/PublicLayout.tsx`) |
|---|---|
| Home (`/`) | `src/modules/public/pages/HomePage.tsx` |
| Products (`/products`) | `src/modules/public/pages/ProductsPage.tsx` |
| Gallery (`/gallery`) | `src/lib/url-state/UrlStateLayout.tsx`, `src/modules/public/pages/GalleryPage.tsx` |
| Contact (`/contact`) | `src/modules/public/pages/ContactPage.tsx` |
| Not found (any other path) | `src/modules/public/pages/NotFoundPage.tsx` |

- The report and the numbers file give one figure per page (`publicRoutes`), and `publicJs` is the largest of them.
- TanStack Query, react-hook-form, zod and admin code are forbidden in every page. nuqs and the `src/lib/url-state/` modules are allowed only in the Gallery row, which is the one route under the lazy `UrlStateLayout` (WEB-10). A module in a chunk the Contact page loads fails the build; the same module in the `UrlStateLayout` chunk passes.
- The production build preloads only the layout and the Home page (`PUBLIC_PRELOAD_ROUTE`), not all five pages.

Figures from plan 11-08 (gzip -9, 1 KB = 1000 B; the limit is 150.00 KB for every page):

| Page | `npm run build:budget` (admin routes included) | `npm run build` (production) |
|---|---|---|
| Home | 137.68 KB | 137.41 KB |
| Products | 138.08 KB | 137.81 KB |
| Gallery | 143.04 KB | 142.78 KB |
| Contact | 138.09 KB | 137.82 KB |
| Not found | 138.22 KB | 137.95 KB |

The Gallery page is the largest because it also loads nuqs. The data sections of later plans must fit in the room that is left (about 12 KB on Home and 7 KB on Gallery), or load lazily.

## Legal pages (Phase 12, plan 12-05)

The three legal pages are public routes inside `PublicLayout`: `/privacy`, `/terms` and `/accessibility`. Each is its own lazy chunk and its own row in the budget report (`privacy`, `terms`, `accessibility`). The Cookie Policy page was removed in Phase 12.1 (D-72): `/cookies` is the normal page not found. The figures below are from plan 12-05 and are kept as a record; the current rows are in the build report. Figures from `npm run build` (gzip -9, 1 KB = 1000 B; the limit is 150.00 KB for every page):

| Page | Size | Result |
|---|---|---|
| Privacy Policy (`/privacy`) | 144.98 KB | ok |
| Terms of Use (`/terms`) | 144.97 KB | ok |
| Accessibility Statement (`/accessibility`) | 144.98 KB | ok |

These pages hold only the page head for now. The article text of plans 12-07, 12-11, 12-12 and 12-19 must fit in the 5.0 KB that is left on each row. The loader chunk (`legalLoaders.ts`, about 0.55 KB gzip) that the legal routes also fetch is counted in these four rows since plan 12-32.

**Entry chunk cost.** Every lazy route adds its chunk name and import to the entry chunk's route table, and every page downloads that table. Four separate legal imports in `router.tsx` grew it by about 0.24 KB (Home 149.78 to 150.02 KB, Contact 149.82 to 150.05 KB, both over the limit). The four routes now share one import of `legalLoaders.ts`, which holds the four page imports. That costs about 0.10 KB (Home 149.88 KB, Contact 149.92 KB), and each page is still its own lazy chunk. In the production build Home and Contact had about 0.1 KB left. `npm run build:budget` (the admin-included build that CI runs) was over: Home 150.09 KB and Contact 150.13 KB, where the same build before this plan gave 149.98 KB and 149.99 KB. The recovery, the figures and the room that is left now are in "Entry recovery (Phase 12, plan 12-31, D-42)" below.

## Entry recovery (Phase 12, plan 12-31, D-42)

After plan 12-05 the entry chunk was too big: `npm run build:budget` failed (Home 150.09 KB, Contact 150.13 KB). The owner ruled that the limit stays at 150 KB and the entry gets smaller (D-42).

**What moved.** The router no longer imports the admin route table (`src/modules/admin/routes.tsx`) or the dev-only table (`src/modules/admin/devRoutes.tsx`). Both load through React Router's `patchRoutesOnNavigation` on the first navigation under `/admin` or `/dev`, and patch into the one lazy `QueryRoot` route. The tables and the long list of chunk file names they carried (the `__vite__mapDeps` preload list) left the entry. The production build has a literal `false` for `__DEV_ROUTES__`, so it holds no `/dev` table and no `devRoutes` import. A table that fails to load (a stale tab after a deploy) shows the admin error screen with Reload Page.

**What now fails the build.** No admin module may sit in a public initial chunk, `routes.tsx` included. The old one-file exception is gone, so a later static import of the admin table cannot undo this. The limits did not change (`publicJs` is still 150_000).

Figures, gzip -9, 1 KB = 1000 B. Before is the plan base (after plan 12-05), After is this plan. Both are from the numbers files.

`npm run build` (production):

| Measure | Before | After |
|---|---|---|
| Home | 149.88 KB | 147.47 KB |
| Products | 146.55 KB | 144.16 KB |
| Gallery | 147.92 KB | 145.51 KB |
| Contact | 149.92 KB | 147.48 KB |
| Privacy | 144.98 KB | 142.54 KB |
| Terms | 144.97 KB | 142.53 KB |
| Accessibility | 144.98 KB | 142.54 KB |
| Not found | 142.63 KB | 140.18 KB |
| Admin JS | 219.44 KB | 221.07 KB |
| CSS | 20.13 KB | 20.13 KB |

`npm run build:budget` (admin routes included):

| Measure | Before | After |
|---|---|---|
| Home | 150.09 KB (over) | 147.50 KB |
| Products | 146.76 KB | 144.19 KB |
| Gallery | 148.13 KB | 145.54 KB |
| Contact | 150.13 KB (over) | 147.51 KB |
| Privacy | 145.19 KB | 142.57 KB |
| Terms | 145.18 KB | 142.56 KB |
| Accessibility | 145.19 KB | 142.57 KB |
| Not found | 142.83 KB | 140.21 KB |
| Admin JS | 221.57 KB | 223.05 KB |
| CSS | 20.13 KB | 20.13 KB |

Every public row drops by 2.4 to 2.6 KB. Admin JS goes up by about 1.5 to 1.6 KB because the route table is now its own chunk, which every `/admin` visit loads first, and the budget counts it (`src/modules/admin/routes.tsx` is in the admin rows above). Admin JS is still well under 250 KB.

**Room left.** The tightest row is Contact: 147.48 KB in production and 147.51 KB in the budget build, so 2.52 and 2.49 KB under the 150 KB limit (1.52 and 1.49 KB under 149 KB). Plans 12-09 (the consent bar loader) and 12-13 (the footer legal row) add to the entry and must fit in that room, together, or load lazily. After plans 12-09 and 12-11 that room was gone, and plan 12-32 made new room: see "Entry chunk merge and headroom (Phase 12, plan 12-32, D-42)" below.

## Cookie bar (removed in Phase 12.1)

The cookie bar, its four lazy chunks (`ConsentBar`, `consentRules`, `consentSave`, `consentService`) and the consent store were deleted in Phase 12.1 (D-54, D-59, plans 12.1-05 and 12.1-06). The public first download no longer loads any consent code. Plan 12.1-06 measured the public rows before and after the deletion and found no change (0.01 to 0.02 KB of hash noise), because the consent chunks were already lazy.

## Entry chunk merge and headroom (Phase 12, plan 12-32, D-42)

After wave 3 `npm run build:budget` failed again (Privacy 150.04 KB). Plan 12-09 (the consent store split into four small modules) added about 1.4 KB to every public route, and plan 12-11 (the Privacy Policy text) about 2 KB to `/privacy`. The owner ruled that the limit stays at 150 KB (D-42). Plan 12-32 made room in two honest ways, and changed no page content.

**What changed.**

1. One `$initial` group in `web/vite.config.ts` (`build.rolldownOptions.output.codeSplitting`). Every module the entry imports statically now ships in the entry chunk, instead of in 8 small shared chunks that the entry imported anyway. It applies to the production, e2e and budget builds, which have `index.html` as their only entry. It is off in the parity build (and in development): there the tag would cover both entries, and `parity.html`'s modules would merge into the visitor entry. `build-config.node.test.ts` pins both.
2. The legal rows (privacy, terms, accessibility; the cookies row was removed in Phase 12.1, D-72) now count `src/modules/public/legalLoaders.ts` (`LEGAL_LOADERS` in `budget.ts`). The legal routes always downloaded it before their page. A build without that chunk fails with "has no chunk", so the figure cannot quietly drop it again.

**Why it is honest.** Each route loads the same modules as before, in the same order, in fewer files. The entry already imported them at start-up, and Rolldown keeps the order inside a chunk. Nothing moved out of the count and nothing loads later. The saving is packaging only: one gzip stream instead of nine, and fewer import and export lines. Home goes from 31 files to 24, and `index.html` lists 24 `modulepreload` links instead of 37. Item 2 goes the other way: it raises the legal figures to what a visitor really downloads first.

Figures, gzip -9, 1 KB = 1000 B, from the numbers files. Before is the plan base (the gate as it measured it). "Before, loader counted" adds `legalLoaders.ts` to the four legal rows (the loader was 621 B in the production build and 624 B in the budget build at the base). After is this plan.

`npm run build` (production):

| Measure | Before | Before, loader counted | After | Files before to after |
|---|---|---|---|---|
| Home | 149.14 KB | 149.14 KB | 145.55 KB | 31 to 24 |
| Products | 145.82 KB | 145.82 KB | 142.25 KB | 30 to 23 |
| Gallery | 147.13 KB | 147.13 KB | 143.60 KB | 29 to 22 |
| Contact | 149.09 KB | 149.09 KB | 145.62 KB | 32 to 25 |
| Privacy | 149.99 KB | 150.61 KB (over) | 147.09 KB | 30 to 24 |
| Terms | 149.10 KB | 149.72 KB | 146.20 KB | 30 to 24 |
| Accessibility | 148.66 KB | 149.28 KB | 145.76 KB | 30 to 24 |
| Not found | 141.79 KB | 141.79 KB | 138.32 KB | 27 to 20 |
| Admin JS | 221.10 KB | 221.10 KB | 217.47 KB | |
| CSS | 20.39 KB | 20.39 KB | 20.39 KB | |

`npm run build:budget` (admin routes included, the build CI runs):

| Measure | Before | Before, loader counted | After | Files before to after |
|---|---|---|---|---|
| Home | 149.19 KB | 149.19 KB | 145.57 KB | 31 to 24 |
| Products | 145.88 KB | 145.88 KB | 142.28 KB | 30 to 23 |
| Gallery | 147.18 KB | 147.18 KB | 143.62 KB | 29 to 22 |
| Contact | 149.15 KB | 149.15 KB | 145.64 KB | 32 to 25 |
| Privacy | 150.04 KB (over) | 150.67 KB (over) | 147.11 KB | 30 to 24 |
| Terms | 149.15 KB | 149.78 KB | 146.22 KB | 30 to 24 |
| Accessibility | 148.71 KB | 149.33 KB | 145.78 KB | 30 to 24 |
| Not found | 141.84 KB | 141.84 KB | 138.34 KB | 27 to 20 |
| Admin JS | 223.12 KB | 223.12 KB | 219.44 KB | |
| CSS | 20.39 KB | 20.39 KB | 20.39 KB | |

The "loader counted" columns are the base figures plus the loader chunk size measured at the base; the base builds themselves did not list it. For the legal rows the file count before is 30 without the loader; with it the base loaded 31 files, so those rows go from 31 to 24.

**Headroom.** The larger of the two builds' figures (the budget build), per public row. The target is 148.50 KB, the room the later wave 4 plans were planned against; the hard limit is 150 KB.

| Page | Size | Room to 150 KB | Room to 148.50 KB |
|---|---|---|---|
| Home | 145.57 KB | 4.43 KB | 2.93 KB |
| Products | 142.28 KB | 7.72 KB | 6.22 KB |
| Gallery | 143.62 KB | 6.38 KB | 4.88 KB |
| Contact | 145.64 KB | 4.36 KB | 2.86 KB |
| Privacy | **147.11 KB** | **2.89 KB** | **1.39 KB** |
| Terms | 146.22 KB | 3.78 KB | 2.28 KB |
| Accessibility | 145.78 KB | 4.22 KB | 2.72 KB |
| Not found | 138.34 KB | 11.66 KB | 10.16 KB |

The tightest row is Privacy. Plans 12-13 (the Cookie Settings window and the footer legal row) and 12-15 (the page view beacon) both add to the public first download and must fit in this room together, or load lazily.

**Reserve options.** None is used. Each needs the owner's yes before any plan uses it.

| Option | What | Figure | Measured | Cost |
|---|---|---|---|---|
| R1 | One chunk for the public layout's shared chain (the 15 small chunks every public page loads through `PublicLayout`) | every public row a further 4.06 KB lower | Measured, on top of the entry merge, before the loader was counted | Admin JS 4.63 KB higher (admin visitors also download the public footer, header and copy); needs a hand-kept module list |
| R2 | Smaller legal dependencies: `format.ts` is pulled whole for one date line in `legalCopy.ts`, and `ProductStates.tsx` for `ProductsError` in `LegalFacts.tsx` | about 1.0 to 1.5 KB on the four legal rows only | Estimated | Two small modules; touches legal page code |
| R3 | A public icon registry, so the icon chunk (about 80 icons, many admin-only) stops loading with the entry on every page | about 3 to 4 KB on every public row | Estimated | Changes the `Icon` API (C-10), so it is an owner call |

**The limit to watch.** The entry is now one file: 366.74 KB raw in the production build and 366.88 KB in the budget build (117.7 KB gzip). Vite warns above 500 KB raw, and that warning would break the zero-warnings rule. There are about 133 KB raw left before it.

## Final figures after Phase 12.1 (2026-11-19)

The speed reader is gone: the `web-vitals` package is uninstalled and its lazy chunk and the `useSpeedReport` hook were deleted (D-53, D-59, plan 12.1-01). No page speed is collected, so no budget row covers it. The Cookie Policy page is gone too (D-72), so there are three legal rows, and the `/cookies` row is no longer in the budget report.

Figures from `npm run build:budget` (the build CI runs), gzip -9, 1 KB = 1000 B, limit 150.00 KB per public page. The public rows are from plan 12.1-13 (the last plan that changed them); Privacy, Admin JS and CSS are from the wave 7 gate, after plans 12.1-14 and 12.1-15. Every row is under its limit and no limit was changed.

| Measure | Size | Limit | Room |
|---|---|---|---|
| Home | 144.94 KB | 150 KB | 5.06 KB |
| Products | 141.65 KB | 150 KB | 8.35 KB |
| Gallery | 142.99 KB | 150 KB | 7.01 KB |
| Contact | 145.22 KB | 150 KB | 4.78 KB |
| Privacy | 147.17 KB | 150 KB | 2.83 KB |
| Terms | 145.52 KB | 150 KB | 4.48 KB |
| Accessibility | 145.07 KB | 150 KB | 4.93 KB |
| Not found | 137.71 KB | 150 KB | 12.29 KB |
| Admin JS | 222.03 KB | 250 KB | 27.97 KB |
| CSS | 20.32 KB | 35 KB | 14.68 KB |

The tightest row is Privacy, which carries the cookies and saved settings section (plan 12.1-10). The earlier sections of this file keep their figures as a record; their "Cookies" rows were removed with the page.

## The quote form piece (Phase 13, plan 13-09, D-35)

The Get a Quote form on `/contact` uses react-hook-form, zod and the resolver, which no public page carries (they are forbidden in every public page's initial JS, see "Rules that fail the build"). So the form is its own lazy piece: `ContactPage` renders `LazyQuoteForm` (`components/lazyQuoteForm.ts`, `lazy(() => import('./QuoteForm'))`) inside a `Suspense` with a placeholder card of the form's height, and the browser fetches the piece right after the page shows. The Contact row still counts only what the page loads first, so it stays at or under 150 KB and no limit was raised.

The piece has **its own row, "Quote form", at 45 KB** (`BUDGETS.quoteFormJs` and `QUOTE_FORM_CHUNK` in `budget.ts`, tests in `budget.test.ts`). It is the form chunk plus every chunk it imports statically, each counted once, **minus the chunks the Contact route already loads** (the entry, the layout and the shared React chunk), so it is only what the form adds. A build with no chunk for `src/modules/public/components/QuoteForm.tsx` fails, as a route module without a chunk does.

Two things to know when the form grows:

- **A shared chunk counts whole.** zod's classic API and the admin forms share one chunk with zod's core; the form pulls that chunk in full even though it uses a few checks. The form therefore uses `zod/mini` (the same package, named imports, no new package): the classic-only part stays in the admin chunks and the form loads only the core (about 14.7 KB gzip) instead of the whole classic bundle (about 23.7 KB). With the classic API the first, two-field version of the form measured 49.36 KB; with `zod/mini` it measured 40.61 KB.
- **react-hook-form is about 14 KB gzip** of the row and cannot be split.

Figures from `npm run build:budget` (gzip -9, 1 KB = 1000 B):

| Measure | Plan 13-09, task 1 (two fields) | Limit |
|---|---|---|
| Contact | 146.60 KB | 150 KB |
| Quote form | 40.61 KB | 45 KB |

## Lighthouse first visit with the consent bar (Phase 12, plan 12-24)

*Phase 12.1 note: the cookie bar was removed (D-54), so a first visit no longer shows a bar and the "Bar" columns below are a record only. The gate itself is unchanged.*

Lighthouse starts every page with an empty browser, so it always scores the honest first visit: the consent bar is showing. The question was whether the bar costs score, and whether its text becomes the LCP element on a phone. It does neither in a way that matters: the bar text was never the LCP element, and the bar adds 0 to about 160 ms of simulated LCP, inside the 200 to 400 ms run-to-run noise on this machine.

**The gate, three runs** (`npm --prefix web run lighthouse`, 2026-11-17, production build, mobile profile, simulated slow 4G, the Development host on `CSPS_Dev`). Performance score, then LCP in ms (report-only by D-29):

| Page | Run 1 | Run 2 | Run 3 | LCP element (every run) |
|---|---|---|---|---|
| `/` | **0.92**, 2658 | 0.95, 2589 | 0.95, 2644 | the hero jersey's name, an SVG `text` in Barlow Condensed |
| `/products` | 0.95, 2353 | 0.97, 2270 | 0.96, 2373 | the lead paragraph under the h1 |
| `/gallery` | **0.91**, 3124 | **0.94**, 2715 | **0.93**, 2937 | the first gallery photo (`img`), loaded from Cloudinary |
| `/contact` | **0.93**, 2569 | 0.96, 2286 | 0.95, 2508 | the lead paragraph under the h1 |

Accessibility, best practices and SEO were 1 on every page in every run. TBT stayed under 200 ms (the highest was 199 ms on `/` in run 1) and CLS under 0.05 (`/products` 0.041, `/contact` 0.043, as in Phase 11). Run 1 started right after another executor's test coverage run ended, which is the likely reason it is the slowest. **No run was fully green: `/gallery` missed the 0.95 performance score in all three.**

**Why `/gallery` misses.** On `CSPS_Dev` its LCP element is a real gallery photo fetched from `res.cloudinary.com` over the internet (about 0.5 s waiting for the request to start and 0.3 to 0.7 s to load it). With the seeded test data (`CSPS_E2E`, below) the Gallery's LCP element is its h1 and the page scores 0.96 to 0.97. The bar is not the cause.

**The bar on or off, same build and host** (a scratch script, not in the repo: Lighthouse's own API with the same mobile defaults, a fresh browser profile per run, the host on `CSPS_E2E`, two rounds). "Bar" is a first visit; "no bar" starts with a saved Reject All cookie. Performance score, LCP in ms:

| Page | Bar, round 1 | Bar, round 2 | No bar, round 1 | No bar, round 2 |
|---|---|---|---|---|
| `/` | 0.95, 2480 | 0.95, 2463 | 0.96, 2334 | 0.95, 2550 |
| `/products` | 0.96, 2371 | 0.96, 2300 | 0.96, 2297 | 0.96, 2303 |
| `/gallery` | 0.96, 2284 | 0.96, 2281 | 0.97, 2285 | 0.96, 2326 |
| `/contact` | 0.95, 2409 | 0.95, 2436 | 0.96, 2280 | 0.96, 2250 |

With the bar every page reached 0.95 or more in both rounds. The largest gap is Contact, about 160 ms of LCP and 0.01 of score: the bar, its save path and the rules load as three small chunks (about 3 KB) while the page is still waiting for its fonts. The LCP element was the same with and without the bar on every page, and the bar's text was never it, at the Lighthouse phone width (412 px) where the bar is tallest. It is `position: fixed` and drawn after the first paint, so it also adds no layout shift (`/` CLS 0.004 with it).

**What this leaves open** (for the owner, recorded in the plan 12-24 summary): the gate is not reliably green on the performance score, as plan 11-36 already found, and `/gallery` on the development database now misses on every run because of its real photos. `CSPS_Dev` is also one migration behind (`AddDailyAnalyticsCounts`, plan 12-18), so every page view the gate's host receives answers 500 there; this does not change the scores (the beacon leaves after the page has loaded) but it fills the host log. No limit was changed.

## Fonts and compression (Phase 11)

Plan 11-36 (decisions D-28, D-29, D-46) worked on the public LCP without changing the look. Nothing here changes a font family, weight or style.

**Brotli files at build time.** The production and e2e builds write a Brotli (quality 11) `.br` file next to every `.js`, `.css` and `.svg` over 1 KB (`web/scripts/vite-brotli-plugin.ts`, `node:zlib`, no package). `PrecompressedStaticFiles` in the server sends that file, with the original content type and cache headers and `Vary: Accept-Encoding`, only when the request lists `br` in `Accept-Encoding`. Every other client gets the plain file, and the host's own response compression may still gzip it: Facebook's link-preview crawler accepts only gzip and deflate and never gets a `.br` body. A `.br` file is never served by its own address, and a response that already has a `Content-Encoding` is never compressed twice. Measured with `node:zlib` on the production build of this plan:

| File | Raw | gzip 9 | Brotli 11 (`.br`) |
|---|---|---|---|
| Entry script (`index-*.js`) | 337,339 B | 105,231 B | 90,571 B (13.9% smaller than gzip) |
| CSS (`index-*.css`) | 104,637 B | 19,590 B | 15,901 B (18.8% smaller) |
| Home page chunk | 13,498 B | 4,763 B | 4,234 B (11.1% smaller) |

**Font files.** The four public pages request at most four font files, listed by `e2e/fonts.spec.ts` (`@fonts`, at 390 and 1440 px, in the test annotations): Archivo latin (the one preloaded file), Barlow Condensed latin 700, 800 italic, and on Home and Contact 800 normal. Barlow Condensed 600 was requested about four seconds after load in the Lighthouse runs (not at load in the Playwright log), so some element uses it. No file that a page requests is unused, so none was removed.

One font request was useless: Barlow Condensed has no peso sign (U+20B1, checked in the cmap of its latin and latin-ext files), yet its latin-ext files list U+20A0-20C0 in their `unicode-range`, so a peso in display text made the browser download them for nothing (14.6 KB each, one per weight in use). The peso falls through to Archivo Variable either way. `barlowNoPesoPlugin` (`web/scripts/vite-preload-font-plugin.ts`) cuts U+20B1 out of the Barlow ranges at build time; Archivo is not touched, because its latin-ext file does draw the peso. The `@fonts` showcase test proves it in the browser: with a peso in display text it requests `archivo-latin-ext-wght-normal` and no Barlow latin-ext file (without the plugin the same test failed on `barlow-condensed-latin-ext-700-normal`). The seeded public pages show no peso in display text, so their font requests are the same before and after.

**LCP on the real pages** (`npm --prefix web run lighthouse`, mobile profile, simulated slow 4G, on this machine, LCP in ms; the target is 2000 ms and stays report-only by D-29):

| Page | Before (Task 1 build) | After (fonts step) |
|---|---|---|
| `/` | 2348 | 2354, 2367 |
| `/products` | 2258 | 2134, 2530 |
| `/gallery` | 2301 | 2298, 2337 |
| `/contact` | 2120 | 2563, 2419 |

The numbers move by 200 to 400 ms between runs of the same build on this shared machine, and the font requests of the four pages are the same before and after, so the two columns show noise and not a gain. FCP is 1970 to 2260 ms on every page and LCP follows it by 150 to 300 ms, so the limit is the first paint, which waits for the entry script, the CSS and about 100 KB of fonts on the simulated link. The next step that keeps the look is font subsetting, which needs a tool and the owner's yes (D-124).

## Chunk file names

The entry chunk holds a list of every lazy chunk's file name, so the browser can preload a route's chunks when it opens the route. Every public page downloads that list, and it grows with each admin chunk. To keep it short, `chunkFileNames` in `web/vite.config.ts` names chunks this way (pinned in `src/test/build-config.node.test.ts`):

- a lazy route chunk (a page or layout reached through a dynamic `import()`) keeps its module name: `assets/ContactPage-<hash>.js`,
- a shared chunk is named by its content hash only: `assets/<hash>.js`.

The hash is the same 8 characters as before, so `/assets/*` files stay safe to cache as immutable. Nothing loads differently: the same chunks, the same preloads, only shorter names. In `budget.json` a shared chunk therefore shows as a bare hash; to see what it holds, open the file in the build output.

Measured on 2026-11-12, before and after this change (gzip -9, 1 KB = 1000 B):

| Measure | `build:budget` before | `build:budget` after | `build` (production) before | `build` (production) after |
|---|---|---|---|---|
| Home | 142.40 KB | 141.25 KB | 142.20 KB | 141.04 KB |
| Products | 146.35 KB | 145.07 KB | 146.16 KB | 144.86 KB |
| Gallery | 147.76 KB | 146.56 KB | 147.57 KB | 146.35 KB |
| Contact | 150.02 KB (over) | 148.74 KB | 149.82 KB | 148.53 KB |
| Not found | 142.96 KB | 141.76 KB | 142.76 KB | 141.55 KB |
| Admin | 221.41 KB | 219.37 KB | 219.20 KB | 217.24 KB |
| CSS | 18.17 KB | 18.17 KB | 18.17 KB | 18.17 KB |

## The builds

What a build is comes from its **Vite mode only** (`MODES` in `web/vite.config.ts`). No environment variable or `.env` file can turn the dev-only routes on in the build that ships: a production build with `VITE_DEV_ROUTES` set anywhere (the shell, CI, an untracked `.env.local`) stops with an error, and an unknown mode stops too (decision D-20, code-review finding TOOL-CR-01).

| Command | Mode | Output folder | What it measures |
|---|---|---|---|
| `npm run build` | `production` | `src/Csps.Server/wwwroot` (what ships) | public JS, admin JS and CSS, plus the "no dev code" rules below |
| `npm run build:budget` | `budget` | `web/.budget-dist` (git-ignored) | public JS, admin JS and CSS with the admin routes built in |
| `npm run build:e2e` (run by `npm run e2e`) | `e2e` | `web/.e2e-dist` (git-ignored) | the same as the budget build |
| `npm run parity` (its app build) | `parity` | `web/.parity-dist` (git-ignored) | the same, with the parity page added |

`npm run verify` runs `build` and then `build:budget`, so both are checked every time.

**The parity page is in the parity build only** (orchestrator-approved measurement fix, 2026-10-13). `parity.html` is a test-only page that imports nearly every component. Built into the budget and e2e builds, it reshaped the shared chunks the public route loads and added about 0.3 KB that no visitor ever downloads. So the budget and e2e builds have `index.html` as their only entry and measure the **shipped topology** with the admin routes added, and they fail if a second entry appears. The parity build keeps the page as a second entry, still meets every limit, and never measures the page as a route. The limits themselves did not change.

## Rules that fail the build besides the limits

- **Exactly one CSS file.** All app styles come from the one Tailwind entry (`src/ui/app.css`, decision D-33). A second CSS file means a stylesheet was imported somewhere else, so the build stops and names both files.
- **No dev code in production** (decision D-20, CWE-489). The production build fails when any chunk ships code from the parity entry (`src/dev/parity-main`), `web/visual/`, the dev preview page (`src/modules/admin/pages/AdminPreviewPage`) or its copy (`src/modules/admin/previewCopy`), the dev-only public layout check page (`src/modules/public/pages/PublicLayoutCheckPage`), or when it has an entry other than `index.html`. The rest of `src/dev/` is the showcase's, under the next rule.
- **The showcase ships only as its own lazy chunks** (decisions D-30..D-33, D-41 Q3, plan 05-35). See the section below. Since Phase 4 (plan 04-25) the guarded admin app ships in production, so `src/layouts/AdminLayout` and the rest of `src/modules/admin/` are allowed. These rules follow the mode, never a flag.
- **No TanStack Query and no admin code in the public initial JS** (PERF-02, quick task 261016). Every chunk the public route loads first must be free of `@tanstack/`, `nuqs`, `react-hook-form`, `zod`, `src/lib/query/`, `src/lib/url-state/`, `src/lib/forms/`, `QueryRoot`, the admin and auth layouts and `src/modules/admin/` (no admin module may be in the public initial JS, the route table `routes.tsx` included since plan 12-31, D-42: the router loads it on the first navigation under `/admin`). The query client lives in the lazy `QueryRoot` route, so it loads with the admin chunks. The build stops and names the chunk and the module.
- **Only the parity build has a second entry.** The budget and e2e builds fail on any entry other than `index.html`; the parity build allows `parity.html` and nothing else. Modules that the build reduced to nothing (for example the dev preview page behind the literal-false `__DEV_ROUTES__`) do not count, because no code of theirs ships.
- **No parity reference output.** No build may emit a file from a `.reference-dist` or `.reference-src` folder, and after writing, the production web root (`wwwroot`) must hold neither folder (plan 02-13).

## The component showcase in production (D-33)

The owner's component showcase (`/admin/components`, Manager only, marked "Demo data") ships to the live site so it can be shown from the owner's own Manager session. It renders the dev scenarios, so the scenario demo data, the kit and the previews go into the production build with it. That is a narrow exception to D-20, and the build keeps it narrow:

- **Showcase-only modules** (`SHOWCASE_ONLY_MODULE_PREFIXES` in `budget.ts`): `src/dev/` (except the parity entry), `src/modules/admin/components/showcase/` and `src/modules/admin/pages/ComponentShowcasePage`. In the production build a chunk that holds one of them must (1) not be in the public or admin initial JS, (2) be loaded by the showcase page's own chunk (`SHOWCASE_PAGE`), and (3) be imported by no chunk outside the showcase. The build stops and names the chunk and module otherwise. A production build that holds such a module but no showcase page chunk fails too.
- **Still never in production** (`DEV_ONLY_MODULE_PREFIXES`): the parity entry `src/dev/parity-main`, `web/visual/`, `AdminPreviewPage`, `previewCopy` and `PublicLayoutCheckPage`. The admin shell previews that the showcase's kit loads (`src/dev/previews/AdminShell.tsx`, `OpenedNavDrawer.tsx`) take their page body from `src/dev/PreviewBody.tsx`, which picks `AdminPreviewPage` only where `__DEV_ROUTES__` is true. The budget plugin counts a module only when it ships code of its own, so the CommonJS import bindings that Rolldown leaves behind for a tree-shaken `AdminPreviewPage` do not count.
- **The showcase is lazy, so it does not count toward admin JS.** Its chunk is reached only through the dynamic import of `/admin/components`. Measured on 2026-10-18: production public JS 122.21 KB, admin JS 204.85 KB, CSS 14.61 KB, with the showcase page chunk at about 28.5 KB gzip on top.
- **`/dev/components` is not in production.** The route stays in the dev-route builds only (parity and E2E tooling), on the same page module.
- **The static chunk is public even though the route is guarded**, so the showcase holds demo data only. `src/test/build-output.node.test.ts` scans the showcase chunks of the real production build for a JWT, a private key, a connection string, a cloud key, a bearer token and any email address other than the made-up ones of spec section 12 and the reserved example domains, and checks that the showcase copy appears only in the showcase chunks, that no chunk names a `/dev/` route and that admin initial JS stays at most 250 KB.

## The numbers file

Every build writes its numbers to the git-ignored `artifacts/budget/` folder at the repository root:

- `budget.json`: the latest build,
- `budget.<mode>.json`: the latest build of each mode (`budget.production.json`, `budget.budget.json`, `budget.e2e.json`, `budget.parity.json`).

Each file holds `mode`, `build` (`production`, `dev-routes` or `parity`), the `limits`, `publicJs`, `adminJs`, `css`, every measurement with its file list, the `errors` and the `notes`. The build also prints the size table.

## The 135 KB note (Phase 4 barrel split)

In the dev-route builds the public number is the **admin-included topology**: what the public site would load if the admin routes were built in, as they will be in Phase 4. When that number passes **135 KB**, the build prints a note (not a warning, and not a failure):

> Note: public JS in the admin-included topology is … KB, past the 135.00 KB trigger for the Phase 4 barrel split (research Flag 4).

It tells Phase 4 to split the component barrels (`src/components/*/index.ts`), so that public pages stop pulling admin-only components into the shared chunks. The 150 KB limit still applies to this number.

Measured at plan 02-33 (2026-10-09):

| Build | Public JS | Admin JS | CSS |
|---|---|---|---|
| Production | 129.94 KB | — | 12.90 KB |
| Budget (admin + parity page) | 149.34 KB | 154.48 KB | 12.90 KB |

The budget build's public number is high mostly because the parity page shares many components with the public layout, so they land in shared chunks the public route has to load. The same build without the parity page measured 137.96 KB public and 142.86 KB admin.

Measured after the parity page left the budget and e2e builds (2026-10-13, code-review fix):

| Build | Public JS | Admin JS | CSS |
|---|---|---|---|
| Production | 130.40 KB | — | 12.92 KB |
| Budget and e2e (admin, no parity page) | 149.70 KB | 154.86 KB | 12.92 KB |
| Parity (admin + parity page) | 149.99 KB | 155.13 KB | 12.92 KB |

Since plan 02-34 the dev-only showcase (`/dev/components`) also imports nearly every component, so without the parity page the budget build saved only 0.29 KB. The real cause was the barrels, fixed next.

Measured at plan 04-25 (2026-10-15), when the guarded admin app began to ship in production:

| Build | Public JS | Admin JS | CSS |
|---|---|---|---|
| Production (guarded admin included, admin not measured) | 130.16 KB | — | 13.04 KB |
| Budget and e2e (admin + dev showcase, no parity page) | 132.75 KB | 160.67 KB | 13.04 KB |

The session, guard and sign-out code load in the admin chunks only; the router keeps them out of the public entry through dynamic imports.

## Public route imports

The public route modules (today `src/modules/public/pages/HoldingPage.tsx`, which imports `SkipLink`, `Logo` and `layout.recipe` from their own modules; later `src/layouts/PublicLayout.tsx`, which imports `SiteHeader`, `SkipLink` and `ToastProvider` the same way) never import from the `@/components/navigation`, `@/components/entry` or `@/components/feedback` barrels. A barrel re-exports admin-only components (Sidebar, Topbar, UserMenu, MobileNavDrawer, MoneyInput, ...). In a build that uses them (the admin routes, the showcase, the parity page) the bundler cannot drop them, so a public module that imports the barrel pulled them, and the forms, overlays and HTTP-client modules they need, into the chunks the public route loads. In production it also kept about 4 KB of their module-level code. Keep new public-route imports on the component modules; the Phase 4 barrel split (research Flag 4) makes this the rule for every barrel.

Measured after that change (2026-10-13, code-review fix):

| Build | Public JS | Admin JS | CSS |
|---|---|---|---|
| Production | 126.18 KB | — | 12.92 KB |
| Budget and e2e | 131.57 KB | 156.43 KB | 12.92 KB |
| Parity | 131.13 KB | 155.88 KB | 12.92 KB |

The dev-route public number is now under the 135 KB barrel-split trigger, so those builds no longer print the note.

## When the build fails

1. **Read the table and the error lines.** They name the measure, its size, its limit, and for the rule failures the chunk and module or the CSS files.
2. **Open `artifacts/budget/budget.json`** to see which files each route loads.
3. **Find the cause** before changing anything. Typical causes:
   - a component or library imported into the entry or a public route that only an admin screen needs,
   - a static import that should be a lazy route or a dynamic `import()`,
   - a stray `import './something.css'` (the one-CSS rule),
   - a dev-only module reached from production code.
4. **Fix the cause.** If the only fix would change how the app behaves or looks, stop and take it to the owner with the table.

**Never raise a limit** to make a build pass, and never add an exception for a file. The limits are the owner's performance promise for visitors on phones (PERF-01).

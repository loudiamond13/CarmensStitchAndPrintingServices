---
phase: 03-ci-cd-staging-deploy
created: "2026-10-16T08:35:00-05:00"
updated: "2026-10-16T10:23:00-05:00"
---

# Phase 3 deferred items

## Lighthouse LCP is over 2000 ms on the public route (plan 03-09)

status: open (option b done in quick task 261016-lcp-split-public-entry, LCP still over; see "Quick task 261016" below)

**Found by:** plan 03-09 Task 3, `npm --prefix web run lighthouse` (mobile profile, simulated slow 4G and 4x CPU, real host, production build).

**What:** every category passes (performance 0.97, accessibility 1, best practices 1, SEO 1), CLS is 0.0004 and TBT is 0 ms, but LCP is **2185 to 2261 ms** against the 2000 ms limit (runs: 2185, 2257, 2261 with the holding page; 2267 on the tree before plan 03-09, measured by restoring the old router and budget files for one run). FCP is already about 1960 ms. The LCP element is the h1.

**Why it is not fixed in plan 03-09:** the holding page is not the cause. It is about 80 ms faster than the placeholder it replaced (it skips the PublicLayout chunk and its header and footer), and changing the page does not move the number: with the logo and skip link removed LCP was 2185 ms, the same as with them; with the Barlow Condensed 800 italic h1 font preloaded as well it was 2261 ms; with the Archivo preload removed it was 2258 ms. The time is the 118.9 KB gzip entry script (372 KB raw, mostly react-dom and react-router) downloading and running on the simulated phone. Phase 2 measured 1958 to 1965 ms with a similar entry size (about 121 KB), so what changed since then is not isolated (machine, Chromium build or Phase 4 code). Every lever below is a structure or owner decision, so it is left for the owner.

**Next step, choose one (never raise the 2000 ms limit):**
- (a) Serve build-time precompressed `.br` files for the entry (Brotli quality 11 is about 15 percent smaller than the gzip the host sends, about 90 ms on the simulated phone; needs a small server change and a build step, no package).
- (b) Move TanStack Query and the admin route objects out of the public entry so the public path loads less script (Root provides the query client today).
- (c) Let the owner allow a second font preload for the Barlow Condensed 800 italic display face (a change to the PERF-05 one-preload rule). Measured here: no gain on its own.
- (d) Find what changed since Phase 2 by running `npm --prefix web run lighthouse` on the last Phase 2 commit on this machine.

**CI note:** the Lighthouse step (stage 5 of the gate, plan 03-11) runs whenever the PR is classified as full mode, which a web change is. The ubuntu runner has its own CPU speed, so its LCP can differ from this machine; check the PR result before assuming either way.

## Quick task 261016 (option b done, LCP still over the limit)

status: open

**What was done:** TanStack Query now loads with the admin chunks. `QueryRoot` (the old `Root`) is a lazy pathless route above the admin and dev branches, so the public entry no longer imports `@tanstack/react-query`, `src/lib/query` or any admin page, layout or service. The error boundary imports `Button` and `EmptyState` directly, so the toast code stays out too. The build now fails when the public initial JS holds TanStack Query, forms, zod, nuqs or admin code (budget rule, `docs/web/budgets.md`). The cache-owner fix of quick task 261015-vmf is unchanged and loads with the admin chunk. No limit, test or rule was loosened.

**Result (same method: `npm --prefix web run lighthouse`, three runs, median):**

| | Before | After |
|---|---|---|
| LCP runs (ms) | 2110, 2189, 2189 | 2113, 2187, 2190 |
| LCP median (ms) | 2189 | 2187 |
| FCP (ms) | 1960 to 1964 | 1962 to 1965 |
| Public initial JS (gzip) | 128.79 KB | 119.56 KB |
| Entry script (raw / gzip) | 372,319 B / 118.9 KB | 339,147 B / 107.1 KB |
| Admin initial JS (gzip) | 184.66 KB | 186.83 KB (QueryRoot now counted) |
| CSS (gzip) | 13.64 KB | 13.64 KB |

The split is a real saving for every visitor on `/` (9.2 KB gzip less), but the number did not pass: **LCP is still 2187 ms against 2000 ms.**

**Why (measured, not guessed).** Variants of the built site, edited after the build, served by the same host and measured with the same Lighthouse settings (three runs, median LCP):

| Variant | LCP (ms) |
|---|---|
| Bare HTML with one h1 (no CSS, JS or fonts) | 796 |
| Static h1 with the real CSS and fonts, no JavaScript | 1202 |
| The real page with every `@font-face` rule removed | 1512 |
| The real page without the Archivo faces and its preload | 1951 |
| The real page with only the Archivo preload link removed | 2111 |
| The real page (after the split) | 2178 |
| The real page plus 75 KB gzip of junk appended to the entry | 2552 |

- JavaScript costs about 5 ms per gzip KB here, so the 9.2 KB saved is worth about 45 ms and shows as noise (runs of the same build vary from 2100 to 2190). Reaching 2000 ms from JavaScript alone would need about 40 KB gzip less, and react-dom and react-router are most of the 107 KB entry.
- The web fonts are the big cost: the three font files the first paint needs (about 81 KB) account for about 660 ms, and the Archivo file alone (35 KB, preloaded) for about 230 ms. Without the Archivo faces the page measured 1951 ms.
- Fonts and the approved look are an owner decision (PERF-05 one-preload rule, D-08), so this task did not touch them.

**Next step, choose one (never raise the 2000 ms limit):**
- (e) Slim the fonts: a smaller Archivo cut (a static weight or fewer axes) or a system font for body text, and check whether the Barlow Condensed 700 normal file is needed on `/`. Measured above: dropping Archivo alone brings LCP to about 1950 ms. This changes how the page looks, so it needs the owner.
- (a) Serve build-time precompressed `.br` files (Brotli is about 15 percent smaller than the gzip the host sends; at 5 ms per KB that is roughly 90 ms; needs a small server change and a build step, no package).
- (c) A second font preload did not help when measured earlier (see above); not recommended on its own.
- (d) Run Lighthouse on the last Phase 2 commit on this machine to confirm the environment moved (the bare HTML page already shows the machine floor is 796 ms).

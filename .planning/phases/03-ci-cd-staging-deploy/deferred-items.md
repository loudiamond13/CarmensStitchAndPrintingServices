---
phase: 03-ci-cd-staging-deploy
created: "2026-10-16T08:35:00-05:00"
updated: "2026-10-16T08:35:00-05:00"
---

# Phase 3 deferred items

## Lighthouse LCP is over 2000 ms on the public route (plan 03-09)

status: open

**Found by:** plan 03-09 Task 3, `npm --prefix web run lighthouse` (mobile profile, simulated slow 4G and 4x CPU, real host, production build).

**What:** every category passes (performance 0.97, accessibility 1, best practices 1, SEO 1), CLS is 0.0004 and TBT is 0 ms, but LCP is **2185 to 2261 ms** against the 2000 ms limit (runs: 2185, 2257, 2261 with the holding page; 2267 on the tree before plan 03-09, measured by restoring the old router and budget files for one run). FCP is already about 1960 ms. The LCP element is the h1.

**Why it is not fixed in plan 03-09:** the holding page is not the cause. It is about 80 ms faster than the placeholder it replaced (it skips the PublicLayout chunk and its header and footer), and changing the page does not move the number: with the logo and skip link removed LCP was 2185 ms, the same as with them; with the Barlow Condensed 800 italic h1 font preloaded as well it was 2261 ms; with the Archivo preload removed it was 2258 ms. The time is the 118.9 KB gzip entry script (372 KB raw, mostly react-dom and react-router) downloading and running on the simulated phone. Phase 2 measured 1958 to 1965 ms with a similar entry size (about 121 KB), so what changed since then is not isolated (machine, Chromium build or Phase 4 code). Every lever below is a structure or owner decision, so it is left for the owner.

**Next step, choose one (never raise the 2000 ms limit):**
- (a) Serve build-time precompressed `.br` files for the entry (Brotli quality 11 is about 15 percent smaller than the gzip the host sends, about 90 ms on the simulated phone; needs a small server change and a build step, no package).
- (b) Move TanStack Query and the admin route objects out of the public entry so the public path loads less script (Root provides the query client today).
- (c) Let the owner allow a second font preload for the Barlow Condensed 800 italic display face (a change to the PERF-05 one-preload rule). Measured here: no gain on its own.
- (d) Find what changed since Phase 2 by running `npm --prefix web run lighthouse` on the last Phase 2 commit on this machine.

**CI note:** the Lighthouse step (stage 5 of the gate, plan 03-11) runs whenever the PR is classified as full mode, which a web change is. The ubuntu runner has its own CPU speed, so its LCP can differ from this machine; check the PR result before assuming either way.

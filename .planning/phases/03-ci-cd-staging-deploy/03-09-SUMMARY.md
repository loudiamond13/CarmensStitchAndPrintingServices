---
phase: 03-ci-cd-staging-deploy
plan: 09
subsystem: public-web
tags: [holding-page, d-17, lighthouse, e2e, a11y, budget, ops-04, tracer, tdd]
created: "2026-10-16T08:00:00-05:00"
updated: "2026-10-16T08:00:00-05:00"

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-02 container-ready E2E harness (the real host on 5199 under the strict CSP)"
provides:
  - "HoldingPage: the standalone D-17 page every non-admin path renders, with the owner's real shop facts"
  - "HOLDING_PAGE in web/src/modules/public/copy.ts: owner-approved copy and facts (no CMS)"
  - "PUBLIC_ROUTE names only HoldingPage.tsx for the budget and the modulepreload plugin"
  - "src/test/publicLayoutRoutes.ts: the Phase 11 shaped route tree (Root > PublicLayout > page) the layout and boundary tests use"
  - "@public E2E over /, /products, /gallery, /contact and a deep path in all five projects"
affects: [03-16, 03-20, 03-21, phase-11-public-pages, ship-gate]

actuals:
  tokens: 60000
  tasks: 3
  commits: 3
plan_head_before: 4389fd8c70adb97e8ede3956d7fc03b8d5cb8a63
plan_head_after: d7c0409548e54471ac2714e14c575e5c4a1f8644

tech-stack:
  added: []
  patterns:
    - "A standalone public page with its own light page root; the unused PublicLayout stays tested through a Phase 11 shaped test tree"
    - "A page with no layout leaves errors to RootErrorBoundary, which brings its own page root and main"

key-files:
  created:
    - web/src/modules/public/pages/HoldingPage.tsx
    - web/src/modules/public/pages/HoldingPage.test.tsx
    - web/src/modules/public/copy.ts
    - web/src/test/publicLayoutRoutes.ts
    - .planning/phases/03-ci-cd-staging-deploy/deferred-items.md
  modified:
    - web/src/core/routes/router.tsx
    - web/scripts/budget.ts
    - web/scripts/budget.test.ts
    - web/scripts/vite-budget-plugin.test.ts
    - web/scripts/vite-route-preload-plugin.test.ts
    - web/scripts/owner-review.mjs
    - web/e2e/smoke.spec.ts
    - web/e2e/public.spec.ts
    - web/e2e/sweep.ts
    - web/e2e/a11y-rulings.spec.ts
    - web/src/core/routes/ErrorBoundary.test.tsx
    - web/src/layouts/PublicLayout.test.tsx
    - web/src/modules/admin/routes.test.tsx
    - docs/web/e2e.md
    - docs/web/budgets.md
    - docs/web/release-gates.md

key-decisions:
  - "Standalone form (owner, 2026-10-16): no site header or footer on the holding page; the skip link stays so the keyboard and responsive gates for / hold unchanged."
  - "The public * route has no RouteErrorBoundary of its own: with no layout around it, that boundary would draw outside any main and page root, so a crash falls to RootErrorBoundary, which brings both."
  - "The owner's address is shown in the owner's words with no country added, and the Google Maps link is not used: the plan's contact list has only the phone and Facebook links."
  - "The LCP limit is not touched. LCP is over 2000 ms before and after this plan; the finding and the options are in deferred-items.md for the owner."

patterns-established:
  - "publicLayoutRoutes (src/test) is the one place the Root > PublicLayout > page shape is spelled out for tests until Phase 11 returns it to router.tsx."

requirements-completed: [OPS-04]

coverage:
  - id: D1
    description: "Every public path shows one branded holding page with the shop name, the new-website line, the address, the hours, the phone as a tel:+63 link and the Facebook page as an https link with rel noopener noreferrer, all from the owner's answers; no placeholder, no # link, no long dash"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/HoldingPage.test.tsx (9 tests)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep \"@smoke|@public\" (35 passed, five projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The holding page meets the gates: one h1, zero axe violations at component and page level, no horizontal scroll at 320 px, 44 px touch targets, one main, no banner or contentinfo, strict CSP"
    requirement: OPS-04
    verification:
      - kind: e2e
        ref: "@public and @smoke in chromium, firefox, webkit, pixel and iphone; @responsive / (light), @keyboard skip link on /, @fonts / and @a11y-rulings on / all pass"
        status: pass
      - kind: unit
        ref: "HoldingPage.test.tsx#has no axe violations; min-h-11 on both contact links"
        status: pass
    human_judgment: false
  - id: D3
    description: "The public JS and CSS budgets hold with the holding page as the public route, and the build fails if the holding page has no chunk"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "web/scripts/budget.test.ts, vite-route-preload-plugin.test.ts, vite-budget-plugin.test.ts"
        status: pass
      - kind: command
        ref: "npm --prefix web run build (public JS 128.79 KB of 150, CSS 13.64 KB of 35) and npm --prefix web run verify (exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Lighthouse mobile: every category at least 0.95, LCP under 2000 ms, CLS under 0.05, TBT under 200 ms"
    requirement: OPS-04
    verification:
      - kind: command
        ref: "npm --prefix web run lighthouse: categories 1, 1, 1, 0.97, 1; CLS 0.0004; TBT 0 ms; LCP 2185 to 2261 ms FAILS the 2000 ms limit"
        status: fail
    human_judgment: true
    rationale: "LCP is over the limit before and after this plan (2267 ms on the tree before it). The page is not the cause and no page change moves it; the fix is a structure or owner decision, logged in deferred-items.md."
  - id: D5
    description: "The look of the holding page (spacing, the logo over the page head, the contact list) matches what the owner expects"
    requirement: OPS-04
    verification: []
    human_judgment: true
    rationale: "The owner said the form and copy are fine as proposed; how it looks in a real phone browser is a judgment. /gsd-ui-review 3 checks it before ship."

duration: 47min
completed: 2026-10-16
status: complete
---

# Phase 3 Plan 09: Holding page on every public path Summary

**A standalone, branded D-17 holding page with the owner's real phone, Facebook page, address and hours now answers `/` and every other non-admin path, passing the unit, a11y, budget and five-engine E2E gates; Lighthouse LCP is 2185 to 2261 ms against the 2000 ms limit, already 2267 ms before this plan, so that one gate stays open for an owner decision.**

## Performance

- **Duration:** about 47 min (start 2026-10-16T12:12:26Z)
- **Tasks:** 3 (Task 1 was the owner decision, answered in chat; Task 2 a tracer; Task 3 auto)
- **Files:** 5 created, 16 modified

## Owner answers (Task 1, 2026-10-16, given in chat before execution started)

| Item | Answer |
|------|--------|
| Form | standalone ("whatever it is right now is ok") |
| Copy | "copy ok": eyebrow "Carmen's Stitch & Printing Services"; heading "New website on the way."; line "Our new website is almost ready. To order now, call the shop or message us on Facebook." |
| Phone | 09762871938, shown as "0976 287 1938", linked as `tel:+639762871938` |
| Facebook | https://www.facebook.com/csptailoring2025 |
| Address | "D7 Dagohoy St., Poblacion, Carmen, Agusan Del Norte" (owner's words, no country added) |
| Maps link | https://maps.app.goo.gl/hKjuTtpvbb8yQqgx7 (Plus Code X7QR+567). Not used: the plan's contact list has no address link. Available for Phase 11. |
| Hours | "Mon-Sat · 9:00 AM - 6:00 PM" (confirmed) |

Nothing else is on the page. The tests refuse brackets, `#` links and long dashes (T-03-38).

## Accomplishments

- `HoldingPage` renders its own light page root with the skip link, one `main#main`, the logo, the Phase 2 page head (eyebrow, one h1, lead) and a contact list: address, hours, the phone link and the Facebook link. Links are `min-h-11`, there is no inline style, and nothing new was added to the component set.
- `HOLDING_PAGE` holds every string and fact in `web/src/modules/public/copy.ts`.
- `router.tsx` loads the page lazily for `*` directly under Root; `PUBLIC_ROUTE` is just the holding page, so the budget and the modulepreload plugin measure it.
- The public bundle is 128.79 KB gzip of 150 (the budget build reads 130.39 KB with the admin routes added); CSS is 13.64 KB of 35. `npm run verify` exits 0 (coverage 97.1 percent statements, 99.65 percent lines).
- E2E `@smoke|@public`: 35 passed in all five projects. `@responsive / (light)`, the `@keyboard` skip link on `/`, `@fonts` on `/` and the changed `@a11y-rulings` cases also pass.

## Task Commits

1. **Task 1 (decision):** answered by the owner in chat, recorded above. No commit.
2. **Task 2 (tracer):** RED `95ccab3` (test), GREEN `b87d1a7` (feat)
3. **Task 3:** `d7c0409` (test)

**Plan metadata:** the docs commit that holds this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md, state.json and the new `.planning/WINDOWS.md` entry.

## TDD Gate Compliance

- RED `95ccab3`: 50 tests failed across HoldingPage, budget, route preload and budget plugin tests, all on the planned assertions (the page and its copy did not exist; PUBLIC_ROUTE still named the placeholder). Semantic check: each failure named the new holding page or route list, not a typo or a missing helper.
- GREEN `b87d1a7`: the same files pass, plus the full Vitest run (4354 passed).
- No refactor commit was needed.
- Tracer gate: Vitest, `npm run build` and `@smoke` on chromium all passed, then the work expanded to Task 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] No RouteErrorBoundary on the public `*` route**
- **Found during:** Task 2
- **Issue:** the plan says to keep `RouteErrorBoundary` on the page. With no layout around it, that boundary draws its error screen outside any `main` and page root (no landmark, no page background).
- **Fix:** the route has no boundary of its own, so a crash or a failed chunk load reaches `RootErrorBoundary`, which brings its own light page root and `main#main`. A new test crashes the real holding page route and checks the result.
- **Files:** web/src/core/routes/router.tsx, web/src/core/routes/ErrorBoundary.test.tsx
- **Commit:** b87d1a7

**2. [Rule 3 - Blocking] Existing tests and specs that assumed the layout frame on `/`**
- **Found during:** Task 2 and Task 3
- **Issue:** the plan's file list did not include them, but they failed once `/` became standalone: the PublicLayout and ErrorBoundary tests rendered the app's own route tree; `routes.test.tsx` expected the placeholder h1; `sweep.ts` and `owner-review.mjs` expected the old h1; the preload and budget plugin tests used the old two-module route; and three `@a11y-rulings` cases assumed a site header on `/`.
- **Fix:** `src/test/publicLayoutRoutes.ts` spells out the Phase 11 shape for the layout and boundary tests; the h1 text is updated in `sweep.ts` and `owner-review.mjs`; D-03 and D-05 allow the navigation-less page (D-05 skips the "at least one stop" rule only for WebKit on `/`, where Tab skips links); O-3 now reads the showcase's opened SiteHeader drawer instead of a drawer on `/`. No limit or check was loosened.
- **Files:** see key-files modified
- **Commits:** b87d1a7, d7c0409

**3. [Rule 2 - Missing critical] Skip link kept on the standalone page**
- **Found during:** Task 2
- **Issue:** the `@keyboard` and `@responsive` gates require "Skip to main content" first on `/`; a page with no layout would have dropped it.
- **Fix:** `HoldingPage` renders the existing `SkipLink` (imported from its own module, PERF-01). The plan's checks (one main, no banner, no contentinfo) still hold, and `@public` tests the skip link on every path.
- **Commit:** b87d1a7

### Gate not met (documented, not fixed)

**4. Lighthouse LCP 2185 to 2261 ms, limit 2000 ms (D4 above)**
- **Found during:** Task 3
- **Facts:** all categories pass (performance 0.97), CLS 0.0004, TBT 0 ms. LCP over three runs on this tree: 2185, 2257, 2261 ms. I restored the old router and budget files for one run and measured 2267 ms, so the gate was already failing before this plan; the holding page is about 80 ms faster than the placeholder.
- **What I tried (all reverted):** removing the logo and the skip link (2185 ms, no change); preloading the Barlow Condensed 800 italic h1 font as well (2261 ms); dropping the Archivo preload (2258 ms). Page content does not move the number; the 118.9 KB gzip entry script does. FCP alone is about 1960 ms.
- **Why it stops here:** every real lever (Brotli files, moving TanStack Query out of the public entry, a PERF-05 font rule change, finding what changed since Phase 2's 1958 to 1965 ms) is a structure or owner decision (Rule 4). They are written up in `.planning/phases/03-ci-cd-staging-deploy/deferred-items.md`, in `docs/web/release-gates.md`, and as an open entry in `.planning/WINDOWS.md`, which blocks `/gsd-ship` until it is resolved. The 2000 ms limit was not changed.

**Total deviations:** 3 auto-fixed (1 Rule 1, 1 Rule 2, 1 Rule 3) and 1 gate left open for the owner.
**Impact:** the plan's functional goal is met; the Lighthouse LCP gate needs an owner decision before ship.

## Verification run

| Check | Result |
|-------|--------|
| `npm --prefix web test -- --run` | 4354 passed |
| `npm --prefix web run build` | budgets ok (public JS 128.79 KB, CSS 13.64 KB) |
| `npm --prefix web run e2e -- --grep "@smoke\|@public"` | 35 passed, five projects |
| Other E2E touching `/` (`@responsive / (light)`, `@keyboard` skip link, `@fonts`, `@a11y-rulings`) | all pass after the fixes above |
| `npm --prefix web run lighthouse` | LCP 2185 to 2261 ms, over the limit (see deviation 4) |
| `npm --prefix web run verify` | exit 0 |
| `grep -c HoldingPage router.tsx` / `PublicPlaceholderPage` / `tel:+63` in copy.ts | 2 / 0 / 1 |
| no-long-dash and source-layout tests | pass |

## Known Stubs

None. No placeholder text, empty data flow or `#` link is on the page.

## Threat Flags

None. The page adds no endpoint, no input and no new trust boundary; its only outward links are the `tel:` and Facebook links covered by T-03-38 and T-03-39.

## Next Phase Readiness

- Phase 11 puts `PublicLayout` back in `router.tsx` and replaces the holding page; at that point `src/test/publicLayoutRoutes.ts` can be dropped and the O-3 check can return to a real public route.
- The owner needs to decide the Lighthouse LCP option before `/gsd-ship 3`.

## Self-Check: PASSED

- Created files exist: HoldingPage.tsx, HoldingPage.test.tsx, copy.ts, publicLayoutRoutes.ts, deferred-items.md.
- Commits `95ccab3`, `b87d1a7` and `d7c0409` are on the branch and pushed.
- Task acceptance criteria re-run: router greps (2 and 0), `tel:+63` count 1, no-long-dash and source-layout tests pass, `HoldingPage` in budgets.md, `contentinfo` in public.spec.ts.
- The one failing gate (Lighthouse LCP) is recorded above, not hidden.

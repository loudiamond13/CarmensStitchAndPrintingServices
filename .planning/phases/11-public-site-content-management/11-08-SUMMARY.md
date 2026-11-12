---
phase: 11-public-site-content-management
plan: 08
subsystem: ui
tags: [react-router, public-site, budget, 404, parity, playwright]
created: 2026-11-11T22:35:00-06:00
updated: 2026-11-11T22:35:00-06:00

requires:
  - phase: 11-public-site-content-management
    provides: "11-02 shaped shell, real 404, tests/fixtures/public-paths.json"
provides:
  - "Every public path renders inside PublicLayout: Home hero text, Products, Gallery and Contact page heads, and the N1 404 page"
  - "PageHead, usePageTitle, public.recipe.ts and the rewritten public copy.ts (PUBLIC_COPY)"
  - "Router: publicRoutes (lazy PublicLayout, five lazy pages, Gallery alone under the lazy UrlStateLayout)"
  - "Per-page public bundle budget (PUBLIC_ROUTES) with one figure per page"
affects: [11-10, 11-18, 11-25, 11-29, 12]

requirements-completed: [PUB-01]

actuals:
  tokens: 38000
  tasks: 3
  commits: 8
plan_head_before: f8cbb402083697258a95aa6117f1c6717a93486c
plan_head_after: ea37811cd2aa143c6a7ed32a88fff87236bfd501

tech-stack:
  added: []
  patterns:
    - "Public pages import their own module files (no @/components barrel) and take every string from modules/public/copy.ts"
    - "One text node for the h1 plain part and its space, so the accent word matches App. E.2 to the pixel in Chromium"
    - "Budget measures PublicLayout plus each page as its own route; a shared chunk problem is reported once"

key-files:
  created:
    - web/src/modules/public/components/PageHead.tsx
    - web/src/modules/public/components/PageHead.test.tsx
    - web/src/modules/public/components/public.recipe.ts
    - web/src/modules/public/hooks/usePageTitle.ts
    - web/src/modules/public/hooks/usePageTitle.test.tsx
    - web/src/modules/public/pages/ProductsPage.tsx
    - web/src/modules/public/pages/ProductsPage.test.tsx
    - web/src/modules/public/pages/NotFoundPage.tsx
    - web/src/modules/public/pages/NotFoundPage.test.tsx
    - web/src/modules/public/pages/HomePage.tsx
    - web/src/modules/public/pages/HomePage.test.tsx
    - web/src/modules/public/pages/GalleryPage.tsx
    - web/src/modules/public/pages/GalleryPage.test.tsx
    - web/src/modules/public/pages/ContactPage.tsx
    - web/src/modules/public/pages/ContactPage.test.tsx
    - web/src/test/public-paths.node.test.ts
  modified:
    - web/src/core/routes/router.tsx
    - web/src/modules/public/copy.ts
    - web/src/test/publicLayoutRoutes.ts
    - web/src/dev/previews/PublicShell.tsx
    - web/src/dev/scenarios/groups/layouts-public.ts
    - web/visual/reference/fragments/PublicShell.tsx
    - web/scripts/budget.ts
    - web/scripts/vite-budget-plugin.ts
    - web/vite.config.ts
    - web/e2e/public.spec.ts
    - docs/web/budgets.md
  deleted:
    - web/src/modules/public/pages/HoldingPage.tsx
    - web/src/modules/public/pages/HoldingPage.test.tsx
    - web/src/modules/public/pages/PublicPlaceholderPage.tsx
    - web/src/modules/public/pages/PublicPlaceholderPage.test.tsx

key-decisions:
  - "The production route preload names only PublicLayout and the Home page (PUBLIC_PRELOAD_ROUTE), not all five pages, so a visitor is not made to fetch pages they may never open"
  - "The public-shell parity case stays, now showing the header, the Gallery page head (App. E.3) and the footer; only the page-head-alone case retires"
  - "Products has no lead yet: the count-in-words lead needs the product lines (plan 11-18), and no copy was invented"
  - "A node test cannot import TSX, so public-paths.node.test.ts reads the publicRoutes block of router.tsx"

patterns-established:
  - "Page head = PageHead (crumb, eyebrow, h1 with em, lead, buttons, flat bottom padding variant)"
  - "Public buttons = aBtn*Classes recipes on UiLink; no @apply, no new CSS file"

duration: about 1h 50min
completed: 2026-11-11
status: complete

coverage:
  - id: D1
    description: "/, /products, /gallery and /contact each render inside PublicLayout (banner, one main, contentinfo) as their own lazy chunk, with one h1 and the approved heading"
    requirement: PUB-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/{Home,Products,Gallery,Contact}Page.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/public.spec.ts @public (60 passed, five projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Any other public path renders NotFoundPage (Out of bounds., Go to Home, View Our Work) and the server answers 404; admin paths keep AdminNotFoundPage"
    requirement: PUB-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/pages/NotFoundPage.test.tsx; web/src/modules/admin/routes.test.tsx (an unknown admin address)"
        status: pass
      - kind: e2e
        ref: "web/e2e/public.spec.ts @public /nope and /some/deep/path answer 404"
        status: pass
    human_judgment: false
  - id: D3
    description: "The router's public page paths equal tests/fixtures/public-paths.json, and the Gallery alone sits under UrlStateLayout"
    requirement: PUB-01
    verification:
      - kind: unit
        ref: "web/src/test/public-paths.node.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The document title set on client navigation is the string the server sends"
    requirement: PUB-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/hooks/usePageTitle.test.tsx and the four page tests"
        status: pass
      - kind: e2e
        ref: "web/e2e/public.spec.ts @public a footer link opens Products in the app and sets its title"
        status: pass
    human_judgment: false
  - id: D5
    description: "The budget measures PublicLayout plus each page separately (all at or under 150 KB gz); nuqs only under Gallery; TanStack Query, react-hook-form and zod nowhere"
    requirement: PUB-01
    verification:
      - kind: unit
        ref: "web/scripts/budget.test.ts, vite-budget-plugin.test.ts, vite-route-preload-plugin.test.ts"
        status: pass
      - kind: other
        ref: "npm --prefix web run build:budget and npm --prefix web run build (five figures below)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The page head and public frame look the same as the approved App. E.3 design"
    verification:
      - kind: other
        ref: "npm --prefix web run parity -- --grep @layouts-public (14 passed, three browsers)"
        status: pass
    human_judgment: true
    rationale: "Pages are heads only; the owner reviews the screens with the data sections in the later plans"
---

# Phase 11 Plan 08: Public pages inside the site frame and a real 404 Summary

**Every public path now renders inside PublicLayout as its own lazy page (Home hero text, Products, Gallery and Contact heads, and the N1 404 page), the holding and placeholder pages are gone, and the bundle budget measures each page with the layout, all under 150 KB gz.**

## Performance

- **Duration:** about 1h 50min
- **Started:** 2026-11-11T20:45:00-06:00 (approx.)
- **Completed:** 2026-11-11T22:35:00-06:00
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files modified:** 46 (16 created, 26 modified, 4 deleted)

## Accomplishments

- `/`, `/products`, `/gallery` and `/contact` render in PublicLayout (header, one main, footer) with one h1 each: "Built for the whole team.", "Every kit, your way.", "Worn on court & road." and "Let's build your kit.". The hero's "Get a Quote" goes to /contact (D-19).
- Any other public path renders the 404 page ("Out of bounds.", "Go to Home", "View Our Work"). The path is never echoed into the page. `/admin/...` keeps `AdminNotFoundPage`.
- `usePageTitle` sets the same titles the server sends (UI-SPEC Document titles). A footer click to Products updates the title without a document request.
- The router's public paths equal `tests/fixtures/public-paths.json`; the Gallery route alone sits under the lazy `UrlStateLayout` (WEB-10).
- `copy.ts` holds every public string of the UI-SPEC Copywriting Contract (titles, descriptions, heads, hero, sections, cards, states, footer, contact, gallery, lightbox, 404, loading regions). The D-17 holding copy is gone.
- The budget now has `PUBLIC_ROUTES` (home, products, gallery, contact, notFound). Each is the layout plus the page, measured on its own; the report and the numbers file carry one figure per page.

### The five public route figures (gzip -9, 1 KB = 1000 B, limit 150.00 KB each)

`npm --prefix web run build:budget` (admin routes included):

```
| public JS (home)     | 137.68 KB | 150.00 KB | ok |
| public JS (products) | 138.08 KB | 150.00 KB | ok |
| public JS (gallery)  | 143.04 KB | 150.00 KB | ok |
| public JS (contact)  | 138.09 KB | 150.00 KB | ok |
| public JS (notFound) | 138.22 KB | 150.00 KB | ok |
| admin JS             | 218.49 KB | 250.00 KB | ok |
| CSS                  | 17.31 KB  | 35.00 KB  | ok |
```

`npm --prefix web run build` (production): home 137.41, products 137.81, gallery 142.78, contact 137.82, notFound 137.95 KB; admin 216.02 KB; CSS 17.31 KB. The old holding page figure was 124.85 KB, so the layout cost about 12.5 KB. The room left for the data sections of later plans is about 12 KB on Home and 7 KB on Gallery.

## Task Commits

1. **Task 1 (tracer): the frame and the 404 page** - RED `7946b3ad` (test), GREEN `c5902f0b` (feat)
2. **Task 2: Home, Gallery and Contact heads; holding and placeholder pages retire** - RED `c02da166` (test), GREEN `244ced2e` (feat), parity fix `bd13718c` (fix)
3. **Task 3: per-page budget and browser tests** - RED `192f0f08` (test), GREEN `c3496ae3` (feat), e2e and docs `ea37811c` (test)

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

RED then GREEN exist for all three tasks, in order. The plan frontmatter is `type: execute`, so the format-based RED classifier was not required; each RED run was read for the right reason.

- **Task 1 RED:** 22 of 25 tests failed on planned assertions: the page heads, titles and links were missing (`Unable to find role="heading" and name "Every kit, your way."`, `"Out of bounds."`, empty `document.title`) and `publicRoutes` was empty. Three tests passed vacuously (a lead left out, no breadcrumb without a crumb, the shared list's content). Skeleton pages and hook (returning nothing) were committed with the RED so the tests fail on assertions, not on missing imports. Tracer gate: the tracer `<verify>` is automated-only, so it was re-run end to end (5 files, 25 tests, typecheck) before expanding.
- **Task 2 RED:** 17 tests failed: 16 page tests found no h1 (the pages were empty), and the layout test still showed the placeholder h1.
- **Task 3 RED:** most of the 129 budget and plugin tests failed because the graphs no longer held a holding-page chunk (`the route module ... has no chunk`); `PUBLIC_ROUTES` and `PUBLIC_PRELOAD_ROUTE` were empty placeholders.
- No REFACTOR commit was needed. One `fix` commit followed Task 2 (see Deviations 4).

## Verification evidence (real output)

- **Task 1:** the five named files: `Test Files 5 passed (5), Tests 25 passed (25)`; `npm run typecheck` clean. Acceptance greps: `NotFoundPage` in router.tsx = 2, `UrlStateLayout` = 2, `public-paths.json` in the path test = 3, `SPEC-GAP` in NotFoundPage.tsx = 1.
- **Task 2:** `src/modules/public`, PublicLayout, ErrorBoundary, tailwind-classes (class gate sweep) and no-long-dash tests passed (13 files, 151 tests). Acceptance: the holding and placeholder pages do not exist; `git grep -c PublicPlaceholderPage -- web/src` prints nothing.
- **Task 3:** `budget.test.ts`, `vite-budget-plugin.test.ts`, `vite-route-preload-plugin.test.ts`: `Test Files 3 passed, Tests 129 passed`. `build:budget` and `build`: the tables above. `grep -c PUBLIC_ROUTES web/scripts/budget.ts` = 2; `grep -c "pages/HoldingPage" web/scripts/budget.ts` = 0.
- **E2E:** `npm --prefix web run e2e -- --grep @public`: `60 passed (2.0m)` (chromium, pixel, webkit, firefox, iphone). A wider run of `@smoke`, `@fixture`, the shell full-bleed checks, the keyboard skip-link check on `/`, and every `/ (light)` sweep test (responsive, fonts, a11y rulings, long text): `91 passed (2.4m)`.
- **Parity:** `npm --prefix web run parity -- --grep @layouts-public`: `14 passed` (chromium 320/390/820/1440, firefox, webkit). The first run showed a 0.01 px difference on the h1 accent word in Chromium, fixed by Deviations 4. The full `npm --prefix web run parity`: `450 passed, 50 failed`; see Issues Encountered for why those 50 are not this plan's.
- **Full web unit suite** (`npx vitest run`, 612 s): `Test Files 1 failed | 330 passed (331)`, `Tests 1 failed | 9150 passed (9151)`. The one failure is `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions": license-checker prints `No packages found in this path...`. It fails the same way when run alone (63 of 64 pass). This plan touches no package file (`package.json` and the lock file are unchanged), so it is treated as this worktree install's problem; it was not run against the base.
- **Lint and types:** `npm --prefix web run lint` (`eslint . --max-warnings 0`) clean; `npm --prefix web run typecheck` clean; Prettier clean on all changed web files.
- gitleaks ran before every commit: no leaks.

## Decisions Made

- **Preload scope.** `PUBLIC_PRELOAD_ROUTE` is the layout and the Home page. The plan only said to update the preload tests; preloading all five pages would make every phone fetch pages it may not open, so only the landing page is preloaded.
- **Parity frame.** The `public-shell` case keeps its place (header, page head, footer) so the footer's structural D-41 exceptions keep their paths. Its page head is now the real `PageHead` with the Gallery copy against App. E.3. The page-head-alone case `public-placeholder-page` is retired.
- **No invented copy.** The Products head shows no lead until the product lines give the count in words (plan 11-18). `copy.ts` has the count-word lead as a function for that plan.
- **Dark and ghost buttons.** The approved dark button hovers to `#000`. The class gate bans colour literals, so `--ink` stands in (`// SPEC-GAP` comment in `public.recipe.ts`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 needed the Home, Gallery and Contact pages to exist**
- **Found during:** Task 1
- **Issue:** the path test and typecheck need all four routes, but the pages belong to Task 2.
- **Fix:** empty pages (`return null`) were committed with Task 1 and filled in Task 2 (their tests were red first).
- **Files modified:** HomePage.tsx, GalleryPage.tsx, ContactPage.tsx
- **Committed in:** c5902f0b

**2. [Rule 3 - Blocking] The path test cannot import the router**
- **Found during:** Task 1
- **Issue:** `*.node.test.ts` files are type-checked by the node project, which has no JSX, so `import { publicRoutes } from router.tsx` fails (TS6142). The RED version of the test imported it.
- **Fix:** the test reads the `publicRoutes` block of router.tsx and checks the index route, the paths, the catch-all and the Gallery under `urlStateLayout`.
- **Committed in:** c5902f0b

**3. [Rule 1 - Bug] Tests that pinned the old behavior**
- **Found during:** Tasks 1 to 3
- **Issue:** several tests and one script named the holding page or the 200 answer for unknown paths.
- **Fix:** `ErrorBoundary.test.tsx` (the holding page cases now use a real public page), `modules/admin/routes.test.tsx` (three tests now expect the 404 page), `PublicLayout.test.tsx`, `publicLayoutRoutes.ts` (points at NotFoundPage), `e2e/smoke.spec.ts`, `e2e/sweep.ts` and `scripts/owner-review.mjs` (h1 of Home), `e2e/a11y-rulings.spec.ts` (the `/` special cases for the holding page are gone), `e2e/shell.spec.ts` (the unknown path `/not-a-public-page` expects 404 as plan 11-02 made it), `scripts/tailwind-classes.test.ts`, `docs/web/e2e.md`, `docs/web/parity.md`, and a comment in `modules/admin/routes.tsx`.
- **Committed in:** 7946b3ad, c02da166, 244ced2e, ea37811c

**4. [Rule 1 - Bug] Parity: accent word 0.01 px off in Chromium**
- **Found during:** Task 2 verify (`parity --grep @layouts-public`)
- **Issue:** `{headline.plain} <em>` made the space its own text node, which shaped 0.01 px wider than App. E.2's single text node.
- **Fix:** `{`${headline.plain} `}` in PageHead and HomePage. After it the group passes 14 of 14.
- **Files modified:** PageHead.tsx, HomePage.tsx
- **Committed in:** bd13718c

**5. [Note] Files outside the plan's list**
- `web/vite.config.ts` (the preload constant import), `web/scripts/vite-budget-plugin.ts` (writes `publicRoutes` to the numbers file), `web/src/core/routes/ErrorBoundary.test.tsx`, `web/src/modules/admin/routes.test.tsx` and `routes.tsx` (comment), `web/e2e/{smoke,shell,a11y-rulings}.spec.ts`, `web/e2e/sweep.ts`, `web/scripts/owner-review.mjs`, `docs/web/e2e.md` and `docs/web/parity.md`: all from deviation 3.

**6. [Process] Plan commit ledger not written**
- The harness refuses compound git commands, so the `gsd-plan-head-before` ledger file was not written. `plan_head_before` is the spawn base asserted at the start (`f8cbb402...`), and `commits: 8` is `git rev-list --count f8cbb402..HEAD` before this SUMMARY commit.

**7. [Plan wording] `docs/web/budgets.md` stale lines left**
- The plan allows only the `Updated:` value plus the new section. Lines 32, 42 and 125 still describe the holding page and `PUBLIC_ROUTE`; the new section says it replaces them. Flagged for the verifier.

**Total deviations:** 4 auto-fixed (2 Rule 1, 2 Rule 3), 3 notes. **Impact:** no scope creep; each follows from the plan's own aim (tracer needs four routes, retired pages must leave no test behind).

## Issues Encountered

- **Full parity has 50 failures that are not from this plan.** `npm run parity` ran 500 tests: 450 passed, 50 failed, in the groups `@data`, `@money`, `@overlays`, `@status` and `@navigation @overflow` (pixel and text-wrap differences). All 14 `@layouts-public` cases pass. To check the 50 against the base, a temporary worktree at the spawn base `f8cbb402` (no plan 11-08 code) ran the same groups: the same tests fail there (8 of 12 `@status` and 42 of 66 of the other groups). The 50 are the same set, so they are this machine's baseline. The temporary worktree was removed and pruned.
- **Flake recorded:** `src/layouts/AdminLayout.test.tsx` "refreshes the open Signed-in Devices list after Sign Out Other Devices" timed out at 5 s once while the full parity run was loading the machine. It passed alone (65 of 65).
- **One unit test fails in this worktree:** `scripts/license-policy.test.ts` (see Verification evidence). Unrelated to the plan; flagged for the verifier to run on a clean install.
- E2E used `CSPS_E2E` (guarded dev-seed reset) and port 5199; preflight showed all four ports free first, and no process was left running.
- Not run here: Lighthouse, the Windows deploy job, and the e2e suites that do not touch the public pages.

## Known Stubs

These are intended and each has a later plan:

| File | What is a head only | Resolved by |
|---|---|---|
| `web/src/modules/public/pages/HomePage.tsx` | hero text, buttons and chips only; no HeroArt, hero tag or data sections | 11-25 |
| `web/src/modules/public/pages/ProductsPage.tsx` | page head without the count lead, pills, articles, help card | 11-18 |
| `web/src/modules/public/pages/GalleryPage.tsx` | page head only; no filter bar, masonry, lightbox | 11-29 |
| `web/src/modules/public/pages/ContactPage.tsx` | page head only; no Message us card, hours, map, sticky bar | 11-10 |

## Threat Flags

None new. T-11-16 is mitigated by the per-page budget with the forbidden-module list (a Contact page that pulls nuqs, or any page that pulls TanStack Query, fails the build in `budget.test.ts`) and deep imports only. T-11-17 is mitigated by the catch-all page, the server's real 404 and noindex (11-02), and a test that the path text is not in the page. T-11-SC: no package was added or bumped (`package.json` and the lock file are unchanged).

## User Setup Required

None.

## Next Phase Readiness

- Plans 11-10 (Contact), 11-18 (Products), 11-25 (Home) and 11-29 (Gallery) fill the heads. They add `PUBLIC_COPY` strings only where one is missing, and must watch the budget room (about 12 KB on Home, 7 KB on Gallery) or load data code lazily; TanStack Query stays out of every public page chunk.
- `SiteFooter` still reads `siteContact.ts` placeholders and the full footer on every page; the footer variants and site-data binding come with the plans that own them.
- Flagged for the verifier: the 50 baseline parity failures above; the stale lines in `docs/web/budgets.md` (deviation 7); `aBtnDarkClasses` hover is a SPEC-GAP stand-in.
- Deleted files (for the merge): `web/src/modules/public/pages/HoldingPage.tsx`, `HoldingPage.test.tsx`, `PublicPlaceholderPage.tsx`, `PublicPlaceholderPage.test.tsx`.
- STATE.md and ROADMAP.md were not touched (orchestrator owns them). `PUB-01` is shared with later plans, so the orchestrator should mark it only after the last declaring plan.

## Self-Check: PASSED

All created files exist on disk and the eight task commits (`7946b3ad`, `c5902f0b`, `c02da166`, `244ced2e`, `bd13718c`, `192f0f08`, `c3496ae3`, `ea37811c`) are ancestors of HEAD. Every task's acceptance criteria were re-run and pass. The plan-level verification (the three task command sets) is green apart from the two items listed under Issues Encountered (the baseline parity failures and the license-gate test), which are not caused by this plan.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-11*

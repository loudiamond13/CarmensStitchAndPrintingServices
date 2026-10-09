---
phase: 02-web-foundation-design-system
plan: 29
subsystem: ui
tags: [react-router-8, data-router, lazy-routes, error-boundary, public-layout, footer, parity, playwright, a11y]
created: "2026-10-09T00:06:00-05:00"
updated: "2026-10-09T00:06:00-05:00"

requires:
  - phase: 02-09
    provides: "Playwright host on https://localhost:5199, guarded fixtures and expectNoAxeViolations"
  - phase: 02-11
    provides: "UrlStateLayout lazy mounting rule and the HydrateFallback requirement"
  - phase: 02-21
    provides: "ToastProvider (placed inside the page root)"
  - phase: 02-26
    provides: "SiteHeader (active label, Main/Mobile navs, Get a Quote to /contact)"
  - phase: 02-27
    provides: "SkipLink and the main#main tabIndex -1 contract"
  - phase: 02-39
    provides: "createQueryClient and QUERY_DEFAULTS"
  - phase: 02-40
    provides: "pageRootClasses, Icon"
  - phase: 02-28
    provides: "EmptyState-based error look conventions"
provides:
  - "web/src/app/router.tsx: routes + createBrowserRouter (Root, ShellFallback hydrate fallback, RootErrorBoundary, lazy PublicLayout, lazy catch-all PublicPlaceholderPage with RouteErrorBoundary) and lazyRoute()"
  - "web/src/app/public/PublicLayout.tsx: Blush page root, SkipLink, SiteHeader with the path's current link, main#main (min-h 100dvh minus header, aria-busy while a chunk loads), SiteFooter, ToastProvider"
  - "web/src/app/public/SiteFooter.tsx + siteContact.ts (SITE_CONTACT)"
  - "web/src/app/ErrorBoundary.tsx: RouteErrorBoundary, RootErrorBoundary, ERROR_BOUNDARY_COPY (public and admin bodies)"
  - "Logo context 'footer' (App. C .s-foot .csp-logo-md phone sizes)"
  - "Parity group layouts-public with the PublicShell wrapper pair; e2e/public.spec.ts (@public)"
  - "E2E host fix: --staticWebAssets points at a missing manifest so the host serves web/.e2e-dist, not a stale wwwroot"
affects: [02-30, 02-31, 02-32, 02-33, 02-35, 02-36, public-site-phase]

actuals:
  tokens: 16600
  tasks: 3
  commits: 5
plan_head_before: 583680a2a12ac0c0d55120c714f4831d7c04a5fb
plan_head_after: fe1431036d76a36ad435e907ed71ad4e17833175

tech-stack:
  added: []
  patterns:
    - "Every lazy route loader goes through lazyRoute(): a failed chunk load becomes a render error of that route"
    - "Route boundaries take an optional reload prop (tests inject it; React Router renders them without props)"
    - "Layout parity pairs: the impl preview renders the real app components; a reference fragment that needs frozen App. D.3 components loads the extracted spec module with import.meta.glob"
    - "E2E keyboard order in WebKit: check the first focusable element in the DOM and focus it directly (WebKit's Tab skips links)"

key-files:
  created:
    - web/src/app/router.tsx
    - web/src/app/Root.tsx
    - web/src/app/ShellFallback.tsx
    - web/src/app/ErrorBoundary.tsx
    - web/src/app/ErrorBoundary.test.tsx
    - web/src/app/public/PublicLayout.tsx
    - web/src/app/public/PublicLayout.test.tsx
    - web/src/app/public/SiteFooter.tsx
    - web/src/app/public/siteContact.ts
    - web/src/dev/previews/PublicShell.tsx
    - web/visual/reference/fragments/PublicShell.tsx
    - web/src/dev/scenarios/groups/layouts-public.ts
    - web/e2e/public.spec.ts
  modified:
    - web/src/main.tsx
    - web/src/ui/brand/Logo.tsx
    - web/src/ui/brand/brand.recipe.ts
    - web/playwright.config.ts
    - docs/web/e2e.md
    - docs/web/parity.md

key-decisions:
  - "lazyRoute() wraps every lazy loader: React Router 8 keeps a route whose lazy() rejected marked as still loading and then renders nothing below the root (not even the layout), so a failed chunk is turned into a render error the route's own ErrorBoundary catches"
  - "The E2E host passes --staticWebAssets <missing file>: in Development the static web assets loader always maps src/Csps.Server/wwwroot, and a production build left there was served instead of web/.e2e-dist"
  - "main keeps min-h-[calc(100dvh-var(--header-height))] at all times (not only while loading), so the footer never jumps when a chunk lands; aria-busy is set only while useNavigation().state is loading"
  - "Production silence: createRoot onCaughtError/onUncaughtError and RouterProvider onError are no-ops when import.meta.env.PROD (React Router otherwise console.errors every render error its boundary catches)"
  - "Logo gains a 'footer' context for App. C .s-foot .csp-logo-md (phone: 10px gap, 40px letters, 9.5px tagline); App. C's 1023px footer rule is written as pg-tablet: so the phone rule wins without depending on variant order"
  - "Footer social names and copy live in SiteFooter.tsx; contact placeholders, hours and every # href live in SITE_CONTACT"

patterns-established:
  - "Router: routes exported for tests (createMemoryRouter(routes)); router = createBrowserRouter(routes) for main.tsx"
  - "Error screens: EmptyState triangle-alert inside an .s-wrap-like container (mx-auto max-w-(--container-max) px-6 py-16, phone px-4 py-8)"

requirements-completed: [WEB-05, A11Y-01, A11Y-02]

coverage:
  - id: D1
    description: "Data router with lazy public routes, hydrate fallback and Root query client; every non-API path renders PublicLayout + PublicPlaceholderPage; /admin/* falls through to the placeholder"
    requirement: WEB-05
    verification:
      - kind: unit
        ref: "web/src/app/public/PublicLayout.test.tsx#Root and ShellFallback; current link /admin/orders"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep \"@public|@smoke|@fixture\" (37 passed, five projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PublicLayout landmarks, one h1, current-link state (none on unknown paths), skip link first and focusing main with no hash, keyboard order"
    requirement: A11Y-01
    verification:
      - kind: unit
        ref: "web/src/app/public/PublicLayout.test.tsx (25 tests incl. axe)"
        status: pass
      - kind: e2e
        ref: "web/e2e/public.spec.ts @public /, /products, /some/unknown in chromium, firefox, webkit, pixel, iphone"
        status: pass
    human_judgment: false
  - id: D3
    description: "Route and root error boundaries, chunk-load failures included, no error text on screen, silent in production"
    requirement: WEB-05
    verification:
      - kind: unit
        ref: "web/src/app/ErrorBoundary.test.tsx (13 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Public frame (header, D-21 page head, footer) pixel- and style-equal to App. E.1/E.2 at 320/390/820/1440 (Chromium) and 390/1440 (Firefox, WebKit)"
    requirement: A11Y-02
    verification:
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep \"@layouts-public|@reference\" (20 passed, three engines)"
        status: pass
    human_judgment: false
  - id: D5
    description: "320px long-text backstop: the 52px placeholder h1 wraps inside its wrapper with no horizontal scroll"
    verification:
      - kind: e2e
        ref: "web/e2e/public.spec.ts#@public at 320px the placeholder h1 wraps inside its wrapper with no horizontal scroll"
        status: pass
    human_judgment: false

duration: 38min
completed: 2026-10-09
status: complete
---

# Phase 2 Plan 29: Public Layout, Data Router and Error Boundaries Summary

**The app now runs on a React Router 8 data router with lazy public routes, a Blush PublicLayout (skip link, SiteHeader with the path's current link, main#main, App. E.1 footer from one contact config), route and root error boundaries that also catch failed chunk loads, parity-equal to App. E.1/E.2 in three engines and green on the real host in all five E2E projects.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-10-09T04:27:54Z
- **Completed:** 2026-10-09T05:05:55Z
- **Tasks:** 3
- **Files modified:** 19 (13 created, 6 modified)

## Accomplishments

- `router.tsx` exports `routes` and `router`: the root route (Root with one query client, `ShellFallback` as the hydrate fallback, `RootErrorBoundary`), the lazy `PublicLayout`, and the lazy catch-all `PublicPlaceholderPage` with `RouteErrorBoundary`. Production `/admin/*` renders the placeholder. 02-31 adds the admin branch behind `__DEV_ROUTES__`.
- `main.tsx` renders `<RouterProvider router={router} />` from `react-router/dom`. The font and app.css imports are kept, and React and React Router error reporting are no-ops in production.
- `PublicLayout` contains:
  - the always-light page root;
  - `SkipLink` first;
  - `SiteHeader` with the current link taken from the path, including a trailing slash (any other path marks none);
  - `main#main` (tabIndex -1, kept at least the viewport minus the header tall, `aria-busy` while a chunk loads);
  - `SiteFooter`, all inside the `ToastProvider`.
- `SiteFooter` is App. E.1 as utilities, including its container rules. The placeholders and `#` links come from `SITE_CONTACT`, the social links carry the D-31 O-4 names, and "Staff Login" goes to `/admin/login`.
- Error screens: the EmptyState `triangle-alert` with "Something went wrong", the public body and a primary "Reload Page" button.
  - `RouteErrorBoundary` shows the screen inside main and keeps the header and footer.
  - `RootErrorBoundary` shows it in a minimal page root.
  - A failed chunk load shows the same screen, because it is routed through `lazyRoute()`.
- The parity group `layouts-public` (`public-shell`, `public-placeholder-page`) passes everywhere it runs: 320/390/820/1440 in Chromium and 390/1440 in Firefox and WebKit, at rest and on hover.

## Task Commits

1. **Task 1 (tracer): public frame on the data router.** RED `b4d98e8` (test), GREEN `dd4e4ac` (feat).
2. **Task 2: route and root error boundaries.** RED `5c10e8e` (test), GREEN `d90fc6d` (feat).
3. **Task 3: parity proof against App. E.1/E.2.** `fe14310` (test). Parity was equal on the first run; see the TDD notes.

**Plan metadata:** recorded in the docs commit that follows this summary.

## Files Created/Modified

- `web/src/app/router.tsx`: routes, `router` and `lazyRoute()`.
- `web/src/app/Root.tsx`: the QueryClientProvider (one `createQueryClient()` per mounted app) around `<Outlet/>`.
- `web/src/app/ShellFallback.tsx`: the empty light page root used as the hydrate fallback.
- `web/src/app/ErrorBoundary.tsx`: `RouteErrorBoundary`, `RootErrorBoundary` and `ERROR_BOUNDARY_COPY`.
- `web/src/app/public/PublicLayout.tsx`: the public layout.
- `web/src/app/public/SiteFooter.tsx`, `siteContact.ts`: the footer and its contact config.
- `web/src/main.tsx`: the RouterProvider and the production error silencing.
- `web/src/ui/brand/Logo.tsx`, `brand.recipe.ts`: the `footer` context, with the new `logoLetterContextClasses` map.
- `web/src/dev/previews/PublicShell.tsx`, `web/visual/reference/fragments/PublicShell.tsx`, `web/src/dev/scenarios/groups/layouts-public.ts`: the parity pair and its scenarios.
- `web/e2e/public.spec.ts`: the `@public` checks on `/`, `/products` and `/some/unknown`, plus the 320px backstop.
- `web/playwright.config.ts`, `docs/web/e2e.md`: the E2E host fix.
- `docs/web/parity.md`: documents the PublicShell pair.
- Tests: `PublicLayout.test.tsx` (25) and `ErrorBoundary.test.tsx` (13).

## Decisions Made

See `key-decisions` in the frontmatter. The two later plans most need to know:

- **Use `lazyRoute()` for every lazy route, including 02-31's admin routes.** Without it, a failed chunk renders a blank page.
- **`ERROR_BOUNDARY_COPY.adminBody` is ready for 02-31.** The admin layout needs an admin variant of the route boundary that renders that body.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The E2E host served a stale production build instead of the e2e bundle**
- **Found during:** Task 1 (first `@public` run, 15 of 15 failed with the old markup)
- **Issue:** In Development the static web assets loader always maps `src/Csps.Server/wwwroot`, and its files win over `--webroot`. A production build left in `wwwroot` by an earlier `verify` run was served. Its `index-*.js` was the pre-router bundle.
- **Fix:** The host command now also passes `--staticWebAssets <web/.e2e-dist/no-static-web-assets.json>`, a file that never exists. That turns the loader off for this host only, as the .NET test hosts already do (02-01). Documented in `docs/web/e2e.md`.
- **Files modified:** `web/playwright.config.ts`, `docs/web/e2e.md`
- **Verification:** The trace showed `index-Dk8--i6m.js` from wwwroot before the fix. After it, 20/20 `@public|@smoke` passed.
- **Committed in:** `dd4e4ac`

**2. [Rule 1 - Bug] A failed page chunk rendered a blank page**
- **Found during:** Task 2 GREEN
- **Issue:** React Router 8 leaves `lazy` on a route whose loader rejected. `_renderMatches` then treats the route as still loading and renders only the root, so neither the layout nor the route's ErrorBoundary appeared.
- **Fix:** `lazyRoute(load)` turns a rejected load into a component that throws the same error, so the route's own boundary catches it. Both lazy routes use it.
- **Files modified:** `web/src/app/router.tsx`, `ErrorBoundary.test.tsx`
- **Verification:** The chunk-failure tests (route and root) and a direct `lazyRoute` test pass. The probe showed the blank render before the fix.
- **Committed in:** `d90fc6d`

**3. [Rule 3 - Blocking] WebKit's Tab does not stop on links**
- **Found during:** Task 1 (webkit and iphone, 6 failures)
- **Issue:** Tab in WebKit skips links (Safari's default), and Alt+Tab did not help on this host.
- **Fix:** In the WebKit projects, the test asserts that the first focusable element in the document is the skip link, then focuses it directly. Chromium, Firefox and Pixel press Tab. Enter, the focus move to main and the URL check are the same in every project.
- **Files modified:** `web/e2e/public.spec.ts`
- **Committed in:** `dd4e4ac`

**4. [Rule 3 - Blocking] The footer logo context**
- **Issue:** App. C `.s-foot .csp-logo-md` (phone: 10px gap, 40px letters, 9.5px tagline) is a context look that 02-18 and 02-26 left to the layout plans.
- **Fix:** Logo `context="footer"`, plus a new `logoLetterContextClasses` map. The defaults are unchanged, and `@brand|@navigation` still pass 24/24 in Chromium.
- **Committed in:** `dd4e4ac`

**5. [Rule 2 - Missing critical] RouterProvider `onError` silenced in production**
- **Issue:** React Router `console.error`s every render error its boundary catches unless `RouterProvider` has an `onError`. The no-op `createRoot` callbacks alone would leave a console line in production (WEB-05, T-02-64).
- **Fix:** `onError` is a no-op in PROD, passed with a conditional spread because of `exactOptionalPropertyTypes`.
- **Committed in:** `dd4e4ac`

### Plan wording notes

- **`RouteErrorBoundary` does not call `useRouteError`.** It shows no error details by design (CWE-209), so reading the error would serve no purpose. The boundary is still the route's `ErrorBoundary`.
- **The error screen's title is the EmptyState h2.** No h1 is present on an error screen. axe's WCAG tags pass, and EmptyState offers levels 2 to 4 only.
- **The reference fragment keeps App. E.1's "CSPS onFacebook" `aria-label`s verbatim.** The implementation uses the O-4 names. Attributes are not compared, and axe passes on both sides.

---

**Total deviations:** 5 auto-fixed (Rule 1: 1, Rule 2: 1, Rule 3: 3), plus 3 plan-wording notes.

**Impact on plan:** There is no look, element, text or ARIA change beyond the approved list, and no tolerance or normalization. Deviation 1 also fixes a latent E2E infrastructure bug that would have hit every later E2E plan.

## TDD Gate Compliance

- **Task 1:** RED `b4d98e8`, then GREEN `dd4e4ac`. `RED_EVIDENCE_OK` for `src/app/public/PublicLayout.test.tsx` (20 of 24 failed on assertions against inert stubs).
- **Task 2:** RED `5c10e8e`, then GREEN `d90fc6d`. `RED_EVIDENCE_OK` for `src/app/ErrorBoundary.test.tsx` (11 of 11 failed).
- **Task 3: unexpected GREEN, investigated.**
  - The footer and page head were already transcribed in Task 1 GREEN, as the plan's task split put them there, so the new parity cases passed on their first Chromium run.
  - To show that the case really compares, a temporary `gap-8` → `gap-7` mutation in SiteFooter was run. It failed (`row-gap`/`column-gap` 32px vs 28px, plus the pixel snapshot) and was then reverted.
  - Task 3 is therefore one `test(02-29)` commit with no feat commit, because no implementation change was needed.
- No REFACTOR commit was needed.

## Package Approval Gate (conditional checkpoint)

Did not fire. No package was added, upgraded or re-resolved.

## Look Gate (D-08 conditional checkpoint)

Did not fire. Parity was equal at every width in three engines with no change to the look, the elements, the text or the ARIA structure. The footer's `href="#"` placeholders stay as UI-SPEC says, and axe passed on them.

## Known Stubs

- `web/src/app/public/siteContact.ts`: `[Shop address]`, `[City]`, `[0917 000 0000]`, `[hello@yourdomain.ph]` and every `#` href (phone, Messenger, email, FB/IG/TT).
  - These are intentional: they are App. E.1's approved placeholders, and the UI-SPEC Layout Contract keeps them until the public-site phase binds `SITE_CONTACT` to SiteSettings.
  - They were not added to a windows ledger, because `.planning/WINDOWS.md` does not exist.

## Issues Encountered

- **The production main chunk is now 121.8 KB gz** (`index-*.js`; PublicLayout 5.2 KB, placeholder 0.8 KB). That is under the 150 KB public budget, but 02-33 should measure it. TanStack Query and the router now sit in the entry chunk.
- **Some coverage branches are unreachable.** They are React Compiler memo branches, plus the default `reloadPage` (jsdom cannot call `location.reload`). Global thresholds pass: 98.97 / 97.91 / 99.77 / 99.86.
- **`docs/web/e2e.md` was already not Prettier-formatted before this plan.** It sits outside web's format check, and it was left as it was.

## Verification

- `npm --prefix web run test -- --run src/app`: 42/42.
- `npm --prefix web run verify`: exit 0 (83 files, 2089 tests; coverage 98.97 / 97.91 / 99.77 / 99.86).
- `npm --prefix web run e2e -- --grep "@public|@smoke|@fixture"`: 37 passed in five projects. `@public|@smoke` alone gave 20 passed (≥ 15 required).
- `npm --prefix web run parity -- --grep "@layouts-public|@reference"`: 20 passed in three engines.
- `@brand|@navigation` in Chromium: 24 passed (the Logo regression check).
- Acceptance checks:
  - `react-router/dom` appears once in main.tsx.
  - `HydrateFallback` appears once in router.tsx.
  - `CSPS on Facebook` appears once in SiteFooter.tsx.
  - `Reload Page` appears twice in ErrorBoundary.tsx (at least 1 required).
  - `SITE_CONTACT` appears 13 times in SiteFooter.tsx (at least 1 required).

## Open for the Owner

Nothing new. The 02-26 question still stands: should "Get a Quote" be a button or a link?

## User Setup Required

None.

## Next Phase Readiness

- **02-30:** can render the ResponsiveTable inside `PublicLayout`/`AdminLayout` `main`.
- **02-31:**
  - Add the admin branch to `routes` behind `__DEV_ROUTES__`, using `lazyRoute()` for every lazy loader.
  - Give the admin children an admin variant of the route boundary with `ERROR_BOUNDARY_COPY.adminBody`.
  - Mount `UrlStateLayout` as a lazy pathless route.
- **02-33:** measure the `main` entry (`index-*.js` plus the shared chunks) against 150 KB gz.
- **02-35:** WebKit keyboard journeys need the same Tab caveat, since WebKit's Tab skips links.
- **WEB-05, A11Y-01 and A11Y-02:** `requirements.ready-ids` reports 0 of 3 ready, because sibling plans still declare them. REQUIREMENTS.md is not ticked here.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-09*

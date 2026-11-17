---
phase: 12-consent-analytics-legal
plan: 05
subsystem: public-site
tags: [legal-pages, seo, noindex, sitemap, react-router, budget]
created: "2026-11-16T21:10:00-06:00"
updated: "2026-11-16T21:10:00-06:00"

requires:
  - phase: 11-public-site-content-management
    provides: PublicLayout, PageHead, the shell head writer, the route table and the budget script
provides:
  - tests/fixtures/legal-pages.json, Domain LegalPages and web LEGAL_PAGES kept equal by tests
  - /privacy, /cookies, /terms, /accessibility served with the UI-SPEC titles and leads
  - noindex on every unapproved legal shell and a sitemap that lists only approved legal pages
  - the L1 page head (DRAFT notice, crumbs, eyebrow, h1, version line, lead) on four lazy pages
affects: [12-07, 12-11, 12-12, 12-19, 12-13]

actuals:
  tokens: 16600
  tasks: 3
  commits: 7
plan_head_before: e72dfe711eb4862e77b6fb20bb78ba7afaaa5f24
plan_head_after: 3912b722c6da46a7ded5857134722dbaed6b7c0a

tech-stack:
  added: []
  patterns:
    - "ILegalPageCatalog: a public seam whose real answer comes from Domain LegalPages and which tests replace with a test-only fact set"
    - "One shared import (legalLoaders.ts) for the four legal routes keeps the entry chunk small"

key-files:
  created:
    - tests/fixtures/legal-pages.json
    - src/Csps.Domain/Content/LegalPages.cs
    - src/Csps.Server/Endpoints/LegalPageCatalog.cs
    - web/src/modules/public/legalPages.ts
    - web/src/modules/public/legalCopy.ts
    - web/src/modules/public/legalLoaders.ts
    - web/src/modules/public/components/LegalPage.tsx
    - web/src/modules/public/components/LegalNotice.tsx
    - web/src/modules/public/components/legal.recipe.ts
    - web/src/modules/public/pages/PrivacyPolicyPage.tsx
    - web/src/modules/public/pages/CookiePolicyPage.tsx
    - web/src/modules/public/pages/TermsPage.tsx
    - web/src/modules/public/pages/AccessibilityPage.tsx
  modified:
    - src/Csps.Server/Endpoints/PublicRouteTable.cs
    - src/Csps.Server/Endpoints/PublicPageHeads.cs
    - src/Csps.Server/Endpoints/ShellPage.cs
    - src/Csps.Server/Endpoints/SeoEndpoints.cs
    - src/Csps.Server/Composition/SpaRegistration.cs
    - web/src/core/routes/router.tsx
    - web/src/modules/public/components/PageHead.tsx
    - web/scripts/budget.ts
    - docs/web/budgets.md

key-decisions:
  - "Legal approval reaches the shell and the sitemap through the public ILegalPageCatalog, so a test can approve one page without editing the real facts"
  - "The four legal routes share one dynamic import (legalLoaders.ts) instead of four, to save about 0.14 KB gz in the entry chunk"

requirements-completed: [LEGAL-05, LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04]

duration: 50min
completed: 2026-11-16
status: complete
---

# Phase 12 Plan 05: Legal pages skeleton Summary

**Four versioned DRAFT legal pages (/privacy, /cookies, /terms, /accessibility) are served with their UI-SPEC titles, a noindex robots meta and no sitemap entry until the owner approves each one, on a shared LegalPage head built from one fact file that C# and web tests both check.**

One open item needs an owner decision: `npm run build:budget` (the build CI runs) is over the 150 KB limit on Home and Contact. See "Open decision: bundle budget" below. The production build passes.

## Performance

- **Duration:** about 50 min
- **Tasks:** 3 of 3
- **Commits:** 7 (3 RED test commits, 3 GREEN feature commits, 1 budget fix)

## Accomplishments

- One fact file, three copies that must agree: `tests/fixtures/legal-pages.json`, Domain `LegalPages` and web `LEGAL_PAGES`. `LegalPagesTests` and `legal-pages.node.test.ts` fail when a key, path, version, date or approved flag differs, or when a version or date is malformed. `LegalPages.CookiePolicyVersion` is the Cookie Policy version (D-22).
- Server: `PublicPage.Privacy|Cookies|Terms|Accessibility`, route table order `/`, `/products`, `/gallery`, `/contact`, `/privacy`, `/cookies`, `/terms`, `/accessibility`, the four UI-SPEC titles and leads, and `noindex, nofollow` on a draft legal shell.
- Sitemap lists the four public pages and a legal page only when approved. A test-only fact set approving `/terms` lists it and removes its noindex; the other three stay marked.
- Web: `PageHead` gained `notice` and `meta` slots. `LegalNotice` is the warning box (static, not a live region). `LegalPage` shows the notice only while `approved` is false and always shows the version line "Version 0.1 · Last updated Nov 15, 2026". Four lazy pages call `usePageTitle`.
- Budget script measures the four legal routes (each about 145 KB gz).

## Task Commits

| Task | RED | GREEN |
| --- | --- | --- |
| 1 Privacy tracer | 71d7a91c | e70085bd |
| 2 Cookies, Terms, Accessibility and budgets | 6b446068 | 58d83837 |
| 3 Approval-driven noindex and sitemap | 68adb9cc | 04c18033 |
| Budget fix (shared loader import) | | 3912b722 |

## RED evidence (quoted)

- Task 1: Domain build failed with `error CS0103: The name 'LegalPages' does not exist in the current context`; web run `Test Files 4 failed (4)`, `Tests 9 failed | 13 passed (22)`.
- Task 2: Server build failed with `error CS0117: 'PublicPage' does not contain a definition for 'Cookies'`; web budget, public-paths and four-page tests failed.
- Task 3: Server build failed with `error CS0246: The type or namespace name 'ILegalPageCatalog' could not be found`.

## GREEN evidence (quoted)

- Domain: `*LegalPagesTests` 12 passed; whole Domain suite `total: 1912 failed: 0`.
- Server (ShellHead, PublicRouteTable, SpaHost, SeoEndpoint, AuthorizationMatrix, AuthorizationCoverage): `Test run summary: Passed! total: 697 failed: 0`. ShellPageTests: `total: 34 failed: 0`.
- Architecture tests: `total: 290 failed: 0`.
- Web: prettier clean, `eslint . --max-warnings 0` clean, `tsc` (app, node, reference) clean; `Test Files 36 passed (36), Tests 621 passed (621)` over `src/modules/public`, the legal, public-paths, no-long-dash, source-layout, public-look and build-config node tests, and `scripts/budget.test.ts` and `scripts/vite-budget-plugin.test.ts`.
- Production build (`npm run build`), gzip -9: Home 149.88, Products 146.55, Gallery 147.92, Contact 149.92, Privacy 144.98, Cookies 144.98, Terms 144.97, Accessibility 144.98, Not found 142.63, admin 219.44, CSS 20.13 KB. All `ok`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The four legal routes broke the 150 KB budget on Home and Contact**
- **Found during:** Task 2 (production build)
- **Issue:** Four separate lazy imports in `router.tsx` grew the entry chunk by about 0.24 KB gz. Home went 149.78 to 150.02 KB and Contact 149.82 to 150.05 KB, so `npm run build` failed.
- **Fix:** One shared import of `web/src/modules/public/legalLoaders.ts`, which holds the four page imports. Each page is still its own lazy chunk. The cost fell to about 0.10 KB (Home 149.88, Contact 149.92). Cost: legal routes fetch one extra tiny chunk (about 0.3 KB gz, not counted in the legal route figures; noted in `docs/web/budgets.md`).
- **Files modified:** web/src/modules/public/legalLoaders.ts, web/src/core/routes/router.tsx, docs/web/budgets.md
- **Commit:** 3912b722

**2. [Rule 3 - Blocking] Test and project files outside the plan's file list had to change**
- `tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj` links the fixture (same pattern as the other fixtures).
- `tests/Csps.Server.IntegrationTests/Http/ShellTestFactory.cs` takes an optional `ILegalPageCatalog` and adds the test-only `ApprovedLegalPages`.
- `src/Csps.Server/Composition/SpaRegistration.cs` registers `ILegalPageCatalog`.
- `web/scripts/vite-budget-plugin.test.ts` lists nine public pages instead of five.
- **Commits:** 71d7a91c, 6b446068, 68adb9cc, 04c18033, 58d83837

**3. [Plan wording] No separate "Home" crumb text in `legalCopy.ts`**
- `PageHead` already renders the Home crumb from `PUBLIC_COPY.crumbs`, so `legalCopy.ts` holds the notice lines, the external-link suffix and the version-line builder only.

## Open decision: bundle budget (owner)

`npm run build:budget` is the build CI runs (the admin-included topology). Measured:

| Build | Before this plan (base e72dfe71) | After this plan |
| --- | --- | --- |
| `build:budget` Home | 149.98 KB | 150.09 KB (over) |
| `build:budget` Contact | 149.99 KB | 150.13 KB (over) |
| `build` (production) Home | 149.78 KB | 149.88 KB (ok) |
| `build` (production) Contact | 149.82 KB | 149.92 KB (ok) |

The base was already within 0.01 to 0.02 KB of the limit in `build:budget`, so any new lazy route in the entry chunk breaks it. The cheapest possible form of four routes (one shared import) still costs about 0.10 KB. Home and Contact cannot take it without freeing entry bytes elsewhere. This plan did not raise any limit and did not trim unrelated code.

Options, recommendation first:

1. **Free about 1 KB of entry bytes in a small recovery plan before more Phase 12 work touches the entry** (for example, keep the admin route chunk list out of the public first download). Recommended: it keeps the 150 KB promise for visitors and gives later Phase 12 plans room too.
2. Raise the Home and Contact limit for `build:budget` by a small amount. Cheapest, but it loosens the PERF-01 promise.
3. Park the four legal routes until a recovery is done. Delays the legal pages.

The same issue will hit the next Phase 12 plans that add to the entry (footer legal links, consent bar loader).

## Known Stubs

The four legal pages show only the page head (notice, crumbs, eyebrow, h1, version line, lead). The article text and table of contents are intentionally left to plans 12-07 (layout and Accessibility), 12-11 (Privacy), 12-12 (Terms) and 12-19 (Cookies). `LegalPage` renders its article area only when given children.

## Not run

- `npm --prefix web run e2e -- --grep @public` was not run: the e2e build uses the same budget plugin and fails on the open item above. Re-run it once the decision is made.
- Full-repo test runs were not run; targeted classes from the plan plus the Domain and Architecture suites were.

## Threat Flags

None. The only new surface is four anonymous GET pages served by the existing shell fallback; titles and descriptions are constants written through the existing head encoders (T-12-12).

## Self-Check: PASSED

All 16 created files exist and all 7 commit hashes are ancestors of HEAD.

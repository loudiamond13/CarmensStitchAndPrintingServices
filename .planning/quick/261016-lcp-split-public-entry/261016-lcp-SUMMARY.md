---
created: 2026-10-16T10:32:00-05:00
updated: 2026-10-16T10:32:00-05:00
phase: quick-261016-lcp
plan: 01
subsystem: web-performance
tags: [lighthouse, lcp, perf-01, perf-02, tanstack-query, code-splitting, budget]
status: complete
requirements: [PERF-01, PERF-02]
commits: 3
plan_head_before: a6bb52af4b5de445d9760854cb751d8c3f0d11a2
plan_head_after: f980d707ed9298ab2612dfda6a8abb182eac5872
actuals:
  tokens: 30000
  tasks: 7
  commits: 3
---

# Quick 261016-lcp: keep TanStack Query and admin code out of the public entry

TanStack Query now loads with the admin chunks, and the build fails if it or any admin page code ever returns to the public entry. The split works (public initial JS 128.79 KB to 119.56 KB gzip), but **the Lighthouse LCP gate did not pass**: the median stays at 2187 ms against 2000 ms, so the `unmet-truth` entry in `.planning/WINDOWS.md` stays open. Measurements show the web fonts, not JavaScript, are the main cost. No budget, threshold, test or lint rule was loosened.

## Commits

| # | Commit | Kind | Message |
|---|--------|------|---------|
| 1 | d4b9590 | RED | test(web): the public entry must carry no TanStack Query and no admin code |
| 2 | 5d1da43 | GREEN | perf(web): load TanStack Query with the admin chunks, not the public entry |
| 3 | f980d70 | docs | docs(web): record the public entry split and why LCP is still over 2000 ms |

The trailer is `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the harness attribution), not the Opus 5.5 line named in the task prompt (same choice as quick task 261015-vmf).

## What changed

- `web/src/core/routes/QueryRoot.tsx` (was `Root.tsx`): the same provider, client lifetime and `trackQueryClient` cache-owner wiring from quick task 261015-vmf, now a lazy pathless route.
- `web/src/core/routes/router.tsx`: the root route has no component (default outlet). `queryBranch([...devRoutes, ...adminRoutes])` wraps both branches in the lazy `QueryRoot`. The route table (`modules/admin/routes.tsx`, every page lazy) stays in the entry on purpose: moving it behind `patchRoutesOnNavigation` would save about 1.5 KB gzip and rewrite every route test.
- `web/src/core/routes/ErrorBoundary.tsx`: `Button` and `EmptyState` imported from their own modules, so the `@/components/feedback` barrel (toast code) leaves the entry. This follows the existing "Public route imports" rule in `docs/web/budgets.md`.
- `web/scripts/budget.ts`: new rule `PUBLIC_FORBIDDEN_MODULE_PREFIXES` (with `routes.tsx` the only allowed admin module) fails any chunk of the public initial JS that holds `@tanstack/`, nuqs, react-hook-form, zod, `src/lib/{query,url-state,forms}/`, `QueryRoot`, the admin or auth layout, or `src/modules/admin/`. `QueryRoot` is added to both admin routes, so the admin budget counts the chunk the admin screens need first.
- Tests: `budget.test.ts` (16 new cases and updated fixtures; the "admin app in production" test now says the admin modules live in their own lazy chunks), `vite-budget-plugin.test.ts` (QueryRoot chunk in the fixture), `build-output.node.test.ts` (no script of the first load carries TanStack Query, and some admin chunk still does), `QueryRoot.test.tsx` (moved from `Root.test.tsx`, plus the query-defaults and compiler-memo tests moved out of `PublicLayout.test.tsx`), and the three `devTree()` helpers use `queryBranch`.
- Docs: `docs/web/budgets.md`, `docs/web/release-gates.md`, `.planning/phases/03-ci-cd-staging-deploy/deferred-items.md`, `.planning/WINDOWS.md`.

## Measurements (`npm --prefix web run lighthouse`, mobile profile, three runs, same method)

| | Before | After |
|---|---|---|
| LCP runs (ms) | 2110, 2189, 2189 | 2113, 2187, 2190 |
| LCP median (ms) | **2189** | **2187** |
| FCP (ms) | 1960 to 1964 | 1962 to 1965 |
| CLS / TBT | 0.00045 / 0 ms | 0.00045 / 0 ms (one run 24 ms) |
| Performance score | 0.97 | 0.97 to 0.98 |
| Entry script raw / gzip | 372,319 B / 118.9 KB | 339,147 B / 107.1 KB |
| Public initial JS (gzip, production) | 128.79 KB (limit 150) | 119.56 KB |
| Admin initial JS (gzip, production) | 184.66 KB (limit 250) | 186.83 KB (QueryRoot now counted) |
| CSS (gzip) | 13.64 KB (limit 35) | 13.64 KB |
| Dev-route budget build, public / admin | not recorded | 121.13 KB / 196.23 KB |

What the public entry imported before: react-dom, react-router, `@tanstack/query-core` and `react-query`, the `lib/query` client and cache owner, lucide-react, the toast code (through the `feedback` barrel) and the admin route table. Not in it already: nuqs, react-hook-form, zod, every admin page, layout and service.

### Why LCP did not move

The baseline hypothesis (entry size) did not hold. Variants of the built site, served by the same host and measured the same way (three runs, median LCP):

| Variant | LCP (ms) |
|---|---|
| Bare HTML, one h1, no CSS, JS or fonts | 796 |
| Static h1, the real CSS and fonts, no JavaScript | 1202 |
| Real page, every `@font-face` removed | 1512 |
| Real page, no Archivo faces and no preload | 1951 |
| Real page, only the Archivo preload link removed | 2111 |
| Real page after the split | 2178 |
| Real page plus 75 KB gzip of junk in the entry | 2552 |

- JavaScript costs about 5 ms per gzip KB here, so 9.2 KB is worth about 45 ms and is lost in run-to-run noise (the same build ranges 2100 to 2190). To reach 2000 ms from JavaScript alone about 40 KB gzip would have to go, and react-dom and react-router are most of the 107 KB entry.
- The fonts the first paint needs (about 81 KB) cost about 660 ms, Archivo alone (35 KB) about 230 ms.
- These variants were made by editing build output in the git-ignored web root, then the real build was restored. Nothing from them is committed.

Owner options (details in `deferred-items.md`): slim or replace the Archivo font (changes the approved look, so a D-08 owner call; dropping it alone measured 1951 ms), or serve Brotli precompressed files (about 90 ms). Never raise the 2000 ms limit.

## Checks

- `npm --prefix web run verify`: typecheck, lint (zero warnings), prettier, vitest with coverage (152 files, 4374 tests; all files 97.1 percent statements, 94.08 branches, 98.96 functions), production build, budget build, license check and notices check all pass.
- Full Playwright run (`npm --prefix web run e2e`, five projects, includes `@smoke|@public`, `@responsive`, `@keyboard`, `@fonts`, `@a11y-rulings`, the sign-in and admin flows `auth*`, `sessions`, `admin`, `session-menu` and the `/dev` showcase): **684 passed, 31 skipped, 1 failed**. The one failure, Firefox `@fixture a second page of the same context is guarded too`, was a `page.goto('/')` timeout of 30 s while the run was under load; it passes alone (`--grep ... --project firefox`, 1 passed), and the test only exercises the console guard fixture. No console errors, no axe violations in the passed suites.
- PR #1 checks after the push (CodeQL, actionlint, analyze csharp and javascript-typescript, classify, commit messages, dependency review, gate (fast), secret scan, zizmor): all pass. The CI gate ran in fast mode, so the Lighthouse stage did not run there.
- Before every commit and the push: gitleaks `--pre-commit --staged` clean and a grep of the staged diff for local paths, machine names, credentials and addresses found nothing. No Lighthouse report or screenshot was committed.

## Deviations from Plan

None that change the scope. Notes:

1. **[Rule 3 - Blocking] Test fixtures.** Adding `QueryRoot` to the admin budget routes meant adding its chunk to the synthetic graphs in `budget.test.ts` and `vite-budget-plugin.test.ts`, and the derived numbers moved by 1 KB (321 to 322 KB for the sign-in route). The limits are unchanged.
2. **[Rule 3 - Blocking] Moved tests.** `Root.tsx` no longer exists, so its tests moved with it (`QueryRoot.test.tsx`), and `PublicLayout.test.tsx` / `publicLayoutRoutes.ts` lost their `Root` use. The behaviours those tests pinned are all still tested.
3. Early in the diagnosis a first set of font and JavaScript experiments was invalid (the host ignored the alternate web root); they were discarded and redone against the real web root. Only the valid numbers are quoted.

## Known Stubs

None.

## Threat Flags

None. No new network surface, auth path or file access.

## Self-Check: PASSED

- `web/src/core/routes/QueryRoot.tsx`, `web/src/core/routes/QueryRoot.test.tsx`, this file: present.
- Commits d4b9590, 5d1da43, f980d70: ancestors of HEAD and pushed to origin.

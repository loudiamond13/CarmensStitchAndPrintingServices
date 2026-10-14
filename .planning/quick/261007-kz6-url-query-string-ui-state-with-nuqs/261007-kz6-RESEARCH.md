---
created: 2026-10-07T15:13:34-05:00
updated: 2026-10-07T15:13:34-05:00
task: 261007-kz6
mode: quick-task
---

# Quick 261007-kz6: URL query-string UI state with nuqs - Research

**Researched:** 2026-10-07
**Domain:** Client-side URL state for list pages (React 19.3 + react-router 8.4.0 data router SPA)
**Confidence:** HIGH (registry, tarball source and runtime probes run this session)

## Summary

The owner chose **nuqs** (2026-10-07) to keep list-page state (filters, search, sort, page, tab, view mode) in the URL. nuqs **2.10.1** (published 2026-08-25, 43 days old) passes the 14-day cool-down. It is MIT-licensed, published with npm provenance, maintained by François Best (47ng), and downloaded about 6.2M times a week. Its only runtime dependency is `@standard-schema/spec` 1.1.0 (MIT). Since 2.9.0, nuqs ships a dedicated **React Router v8 adapter** (`nuqs/adapters/react-router/v8`), and its peer range includes `react-router ^8`. A jsdom probe this session ran nuqs 2.10.1 with `createBrowserRouter` plus `RouterProvider` from `react-router/dom` (8.4.0). Reading the URL, pushing, `clearOnDefault` and Back all worked. A Vite 8.3.3 production build showed nuqs adds **about 5.6 KB gz**.

The risks are not compatibility. They are in **how we use it**:
- nuqs parsers do not clamp numbers.
- Unknown values stay in the URL.
- `parseAsIsoDate` round-trips through UTC, which shifts days for Asia/Manila (UTC+8).
- Customer names, phones and emails typed into search would land in browser history and bookmarks.
- **`docs/dependencies.json` cannot take a "planned" npm entry inside `packages` today.** The registry test only accepts the kinds `nuget`/`tool`, and it fails any entry that has no pin.

**Primary recommendation:** Adopt nuqs 2.10.1 in Phase 2:
- Put `NuqsAdapter` from `nuqs/adapters/react-router/v8` around the `<Outlet/>` of the **admin layout route**, not around `RouterProvider`.
- Give each list one shared, typed `useXxxListParams()` hook built on `useQueryStates`. It uses allow-list parsers, `clearOnDefault`, `replace` for filters/search/sort/tab/view and `push` for page.
- Feed **parsed** values (search debounced 300 ms) into TanStack Query keys.
- Record nuqs in a new top-level `planned` array (not `packages`) until Phase 2 installs it.

## Project Constraints (from CLAUDE.md)

- Free-only licenses: MIT, Apache-2.0, BSD, ISC (MPL-2.0 for axe, test only; OFL-1.1 for fonts). nuqs and its dependency are MIT, so they comply.
- A new dependency needs its purpose, license, maintenance and legitimacy recorded in RESEARCH.md, and has a **14-day cool-down**. Cutoff today is 2026-09-23. 2.10.1 (2026-08-25) complies. Do **not** take `2.10.2-beta.1`.
- Forbidden: `react-router-dom`. The v8 adapter imports from `react-router` only (verified in source, below). The deprecated `nuqs/adapters/react-router` (v6) and `/v6` subpaths must not be used.
- Budgets: public initial JS ≤ 150 KB gz, admin ≤ 250 KB gz. Strict CSP (no `unsafe-inline`/`unsafe-eval`). Zero warnings in build, lint and browser console. TDD. Web coverage ≥ 90%.
- Every query to the API stays inside `lib/api.ts` (WEB-04). nuqs only owns the browser URL, never API calls.

## Findings

### 1. nuqs facts

| Item | Finding | Tag |
|------|---------|-----|
| Latest | `latest: '2.10.1'`, published `2026-08-25T10:59:58.402Z`. Other tags: `beta: '2.10.2-beta.1'` (2026-08-28), a snapshot. | [VERIFIED: npm registry, `npm view nuqs`] |
| Newest version ≥ 14 days old | **2.10.1** (it is also the latest stable) | [VERIFIED: npm registry] |
| Cadence | 2.9.0 2026-06-30 → 2.9.1–2.9.6 (Jul–Aug) → 2.10.0 2026-08-20 → 2.10.1 2026-08-25. That is roughly 1–3 releases a month. | [VERIFIED: npm registry `time`] |
| License | `MIT` (npm) and `MIT` (GitHub repo license) | [VERIFIED: npm registry; api.github.com/repos/47ng/nuqs] |
| Repo / maintainer | `git+https://github.com/47ng/nuqs.git`, npm maintainer `franky47 <npm@francoisbest.com>`. 10,874 stars, not archived, last push 2026-10-06, 22 open issues (49 issues+PRs). | [VERIFIED: npm registry; GitHub API] |
| Provenance | `dist.attestations.provenance.predicateType = https://slsa.dev/provenance/v1` | [VERIFIED: npm registry] |
| Downloads | 6,229,525 / week (2026-09-28 → 10-04) | [VERIFIED: api.npmjs.org] |
| Install scripts | `postinstall: null` | [VERIFIED: package-legitimacy seam] |
| Dependencies | `{"@standard-schema/spec":"1.1.0"}` only. Its peers are all optional except `react: ">=18.2.0 \|\| ^19.0.0-0"`, and it declares `"react-router":"^5 \|\| ^6 \|\| ^7 \|\| ^8"`. | [VERIFIED: npm registry] |
| Transitive | `@standard-schema/spec` 1.1.0: MIT, published 2025-12-15, maintainers fabian-hiller and colinhacks, 153.5M/week, no dependencies | [VERIFIED: npm registry] |
| Bundle | Bundlephobia (whole entry, minified): 17,559 B / **6,285 B gz**. Tree-shaken esbuild bundle (useQueryStates, 5 parsers, debounce, v8 adapter; react/react-router external): 17,503 B / **6,626 B gz**. **Real Vite 8.3.3 + plugin-react 6.1.2 build delta:** 104.95 KB gz (with nuqs) − 99.34 KB gz (same app on `useSearchParams`) = **≈ 5.6 KB gz**. | [VERIFIED: bundlephobia API; local build probes] |
| CSP | There is no `eval(`, `new Function`, `innerHTML` or `document.write` in `dist/*.js` or the react-router adapters. nuqs only calls `history.pushState/replaceState`, so it is CSP-safe. | [VERIFIED: grep of the 2.10.1 tarball] |

**Package legitimacy gate:**

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| nuqs 2.10.1 | npm | 43 days (version); project since 2020 | 6.2M/wk | github.com/47ng/nuqs | OK | Approved (planned, Phase 2) |
| @standard-schema/spec 1.1.0 (transitive) | npm | ~10 months | 153.5M/wk | github.com/standard-schema/standard-schema | OK | Approved (transitive) |

Packages removed: none. Flagged SUS: none.

### 2. React Router 8 compatibility (critical): SUPPORTED

- **Adapter exists.** The 2.10.1 `exports` include `./adapters/react-router/v6`, `/v7`, `/v8`, the deprecated generic `./adapters/react-router`, plus `./adapters/react` (SPA), `./adapters/custom` and `./adapters/testing`. `/v8` first appeared in **2.9.0**, which is also when the peer range widened to `^8`. 2.8.x has no `/v8`. [VERIFIED: `npm view nuqs@<v> exports`]
- **Source.** `dist/adapters/react-router/v8.js` is `import { NuqsAdapter, useOptimisticSearchParams } from "./v7.js"`. `v7.js` does `import { useNavigate, useSearchParams } from "react-router"`, which means no `react-router-dom`. The shared implementation (`react-router-zcKLExeY.js:8-43`) writes the URL with `history.pushState/replaceState`. It calls `navigate(..., { replace: true })` only when `shallow: false`, and listens to `popstate`. [VERIFIED: tarball read]
- **Docs.** v8 "re-exports v7's implementation" because "React Router v7 and v8 expose the same react-router hooks". For v7/v8, "Place `NuqsAdapter` around the `Outlet` component in your root route file". The generic `nuqs/adapters/react-router` "is deprecated and will be removed in nuqs@3.0.0". [CITED: nuqs.dev/docs/adapters]
- **Runtime probe (positive test, this session).** Versions: nuqs 2.10.1, react/react-dom 19.3.0, react-router 8.4.0 (deduped, no peer error) and jsdom. The router came from `createBrowserRouter`, `RouterProvider` from `react-router/dom`, and `NuqsAdapter` wrapped `<Outlet/>` in the root route. Output:
  ```
  initial state {"page":3,"status":"active","size":9999} url ?page=3&status=bogus&size=9999
  after push page=4 {"page":4,...} url ?page=4&status=bogus&size=9999 histLen 2
  after page=1 (default) url "?status=bogus&size=9999"
  after back {"page":3,...} url ?page=3&status=bogus&size=9999
  ```
  Reading, push, `clearOnDefault` and Back all work. [VERIFIED: local probe]
- **Placement rule.** The adapter calls `useNavigate`/`useSearchParams`, so it must render **inside** the router, as a route element. It must not wrap `<RouterProvider>`, because that is the v6 pattern. Any layout route works, since it is a context provider inside the router. Put it in the **admin layout route** (and in the gallery route only if GAL-01 adopts it). That keeps it out of the public initial chunk. [VERIFIED: source read above; placement on a non-root layout route is reasoned from source and not separately probed]
- **Not applicable / fallbacks.** No custom adapter (`nuqs/adapters/custom`) or SPA adapter is needed. A fallback exists but is not recommended: `nuqs/adapters/react` (SPA) works without the router, but it bypasses React Router's location, so `useLocation`/loaders would not see shallow updates.
- **Known open issues to watch:**
  - #1563, "react router: `history: 'push'` write with `shallow: false` does not advance the history index". We keep `shallow: true`, the default, so we avoid it.
  - #1245, "State desynchronization when rendering `<Navigate />` on first render". This is relevant to redirects such as USER-08 `/admin/users` → `/admin`, so prefer loader `redirect()` there. [VERIFIED: GitHub search API]

### 3. Interaction with the stack

- **Options defaults.** `history: 'replace'`, `shallow: true`, `scroll: false`, `clearOnDefault: true` (the v2 default), URL updates throttled at 50 ms (120 ms Safari). `throttleMs` "has been deprecated in `nuqs@2.5.0`", so use `limitUrlUpdates: throttle(n) | debounce(n)`. Global defaults go on `<NuqsAdapter defaultOptions={…}>`. [CITED: nuqs.dev/docs/options]
- **History policy.** Use `push` **only** for page changes, and `replace` for filters, search, sort, tab and view. Any filter, search or sort change sets `page: null` (back to 1) in the **same** `useQueryStates` call, so it is one atomic URL write. This is what makes Back work as staff expect. Detail → Back restores the list exactly, and Back steps through pages, but typing a search does not flood history. [ASSUMED: UX policy recommendation]
- **Search and TanStack Query (WEB-08's 300 ms debounce).** Docs: "The returned state is always updated **immediately**: only the network requests sent to the server are debounced… If you are fetching client-side (eg: with TanStack Query), you'll want to debounce the state returned by the hooks instead." [CITED: nuqs.dev/docs/options] So:
  - **Do:** apply `limitUrlUpdates: debounce(300)` to `q`, so history and the URL stay calm.
  - **Do:** build the query key from an in-house `useDebouncedValue(q, 300)`. Do not add a package for it.
  - **Do:** keep `placeholderData: keepPreviousData` for pagination, and let the AbortSignal cancel as WEB-08 already says.
  - **Don't:** use the immediate `q` in the query key.
- **Query keys.** Use the **parsed, defaulted** object: `['orders','list', { page, size, status, sort, q: debouncedQ, from, to, product, hasBalance }]`. Raw strings and `location.search` never go in. `api.orders.list(params, signal)` serializes them (WEB-04).
- **Parsers to use.** These were verified as exports of 2.10.1 (`index.d.ts:504`): `parseAsInteger`, `parseAsIndex`, `parseAsString`, `parseAsStringLiteral`, `parseAsNumberLiteral`, `parseAsBoolean`, `parseAsIsoDate`, `parseAsArrayOf`, `parseAsNativeArrayOf`, `createParser`, `createSerializer`, `createLoader`, `createStandardSchemaV1`, `debounce`, `throttle`, `useQueryState`, `useQueryStates`. For tests, `nuqs/adapters/testing` exports `NuqsTestingAdapter` and `withNuqsTestingAdapter`, with `searchParams` and `onUrlUpdate` props (`adapters/testing.d.ts:14-64`). That lets Vitest/RTL tests run without a router. [VERIFIED: tarball read]
  - Page size: `parseAsNumberLiteral([10, 20, 50, 100] as const).withDefault(20)`. This is an allow-list that matches SEC-03's server cap of 100.
  - Status, sort, tab and view: `parseAsStringLiteral([...] as const).withDefault(...)`.
  - Page: a `createParser` (or `parseAsInteger` plus a clamp) that rejects values below 1.
  - Date range: a custom **`parseAsBusinessDate`** that keeps a plain `YYYY-MM-DD` **string** (see pitfall 4).
- **React Compiler.** nuqs exposes plain hooks with no hook-in-condition patterns visible in the adapter source. No incompatibility was found, but nothing was probed with the compiler enabled. Phase 2 must confirm zero `react-hooks` compiler diagnostics. [ASSUMED]
- **Vite 8 / zero warnings.** A plain `vite build` (8.3.3, **no** plugin-react) emits Rolldown `MODULE_LEVEL_DIRECTIVE` warnings for `"use client"` in nuqs (`index.js`, `adapters/react-router/v7.js`, `v8.js`) **and in react-router 8.4.0 itself** (`index.js`, `dom-export.js`). **With `@vitejs/plugin-react@6.1.2` the same build emits 0 directive warnings.** So the planned config is clean. If Phase 2 ever builds without plugin-react (a lib or test build), react-router already triggers this warning, so it is not a nuqs-specific cost. [VERIFIED: local build probes]
- **SSR.** Not relevant (SPA). `nuqs/server` (`createLoader`/cache) is unused, although `createLoader` could parse the same params in a route `loader` for prefetch.

### 4. Conflict with ORD-10 (view mode) and other non-URL state

`ORD-10: The Orders grid ⇄ table view choice persists in localStorage['csps-orders-view']` [VERIFIED: .planning/REQUIREMENTS.md:130].

**Recommended precedence rule:**
- The effective view is the **URL `view` if it is valid**, otherwise **`localStorage['csps-orders-view']` if it is valid**, otherwise the responsive default (cards on phones per WEB-06 `.s-rt`).
- Only an **explicit toggle** writes both: the URL (`replace`) and localStorage.
- Opening a shared or bookmarked link with `?view=table` applies to that visit only and does **not** overwrite the recipient's saved preference.
- Implement this with `parseAsStringLiteral(['grid','table'])` **without** `withDefault`, so a `null` falls through to localStorage. Never put a localStorage-derived default into `withDefault`, because a dynamic default breaks `clearOnDefault` stability. [ASSUMED: design recommendation]

Other state that is **not** URL-bound and should stay that way:
- PROF-04: theme in `localStorage['csps-theme']` (REQUIREMENTS.md:93). This is a preference, not view state.
- Modal open state and form drafts.
- WEB-08's TanStack cache.

Candidates **to** URL-bind: USER-01, AUDIT-02, CEXP-01, ORD-02, ORD-07 tabs, MONEY-02 paging, INQ-05 inbox status/page, ANL-08 date range, and GAL-01 category (public; only if it fits the 150 KB budget: about 99 KB baseline + 5.6 KB).

### 5. Pitfalls

1. **Untrusted params (CWE-20).**
   - **Proved by the probe:** `?status=bogus` falls back to the default in state, but **stays in the URL**. `?size=9999` is **accepted as-is** by `parseAsInteger`.
   - Use allow-list parsers and clamp page numbers.
   - When parsed ≠ raw, rewrite the URL once with `replace` so shared links get normalized.
   - The **server stays authoritative**: SEC-03 caps size at 100 and validators reject unknown sorts. nuqs is not a security boundary.
   - React escapes rendered values. Never feed a param into `href`, `navigate()` or a redirect without validation (CWE-601; the PRD requires `returnUrl` to be a local path).
2. **Personal data in the URL.**
   - The PRD rules found are "no tokens in URLs" (PRD:440) and that the 2FA code "never appears in logs, URLs, or analytics" (PRD:395). A general "no personal data in URLs" rule was **not found** in PRD or REQUIREMENTS, so the owner should confirm it.
   - Free-text `q` holding a customer name, phone or email would persist in browser history and autocomplete on shared shop PCs, and in copied or shared links.
   - Existing mitigations:
     - `Referrer-Policy: strict-origin-when-cross-origin` (PRD:505) strips the query cross-origin.
     - Serilog request logging records "path (no query string)" (`src/Csps.Server/Program.cs:70-73`).
   - **Recommendation:** structured filters (status, dates, category, sort, page, size, tab, view, role, the actor id for the audit log) go in the URL. **Free-text search `q` stays out of the URL by default** (`useState` only, so it is lost on refresh and Back). If the owner prefers that search survive refresh and Back, allow `q` in **admin-only** URLs with `replace` + `debounce(300)`, never on public pages, and never as structured `email=`/`phone=` params. ⚑ Owner decision.
3. **Analytics.** ANL-05/PRD:193 records a page-view "path". Define it as `location.pathname` **without** the query, so filters and search never reach analytics.
4. **Dates in Asia/Manila.** `parseAsIsoDate` serializes with `v.toISOString().slice(0, 10)` and parses to UTC midnight (`index.js:216-222`). Probe results:
   - A local-midnight `Date` in Asia/Manila (`offset -480`) serializes as `2026-10-06` for Oct 7.
   - A UTC-midnight `2026-10-07` shown in a UTC−5 zone renders `10/6/2026`.
   - Keep date filters as plain `YYYY-MM-DD` strings in the URL and the API. The server interprets them in the business zone (`IBusinessCalendar`). Defaults such as "last 30 days" (CEXP-01) come from the business "today", **not** `new Date()`. [VERIFIED: tarball read + probe]
5. **Page beyond the last page.** A link like `?page=40` on a 3-page result returns an empty page. When `totalCount > 0 && page > totalPages`, `replace` to `totalPages`. When `totalCount === 0`, show EmptyState, not the error state.
6. **Redirects on first render.** Issue #1245 means a `<Navigate/>` that renders on first render can desync nuqs state. Use route `loader` redirects.
7. **Two sources of truth.** Never mirror nuqs state into `useState`/RHF and write it back. Read through the one `useXxxListParams()` hook.

## Recommendation

**Requirement wording (proposed WEB-10, Phase 2):**
> List and detail pages keep their view state in the URL query string, using nuqs (owner, 2026-10-07):
> - The state covered is filters, sort, page, page size, active tab and view mode, so views are shareable and bookmarkable, and Back/Forward restore them.
> - Each list reads and writes its state through one typed hook built on `useQueryStates`, from `NuqsAdapter` (`nuqs/adapters/react-router/v8`) rendered in the admin layout route.
> - Every param uses an allow-list or clamped parser, with defaults omitted from the URL (`clearOnDefault`). Invalid or out-of-range values fall back to defaults and are rewritten with `replace`.
> - Page changes add a history entry. Filter, sort, tab and view changes replace the current entry and reset the page.
> - TanStack Query keys use the parsed values. Dates are plain `YYYY-MM-DD` in the business time zone.
> - No tokens or personal data go in the URL: free-text search stays out unless the owner allows it for admin pages. Analytics records the path without the query.
> - ORD-10's saved view is the fallback when the URL has no valid `view`, and is written only by the toggle.
> - Unit tests use `nuqs/adapters/testing`.

**Placement:** Phase 2 (Web Foundation) owns the adapter, the conventions, the shared parsers (`parseAsBusinessDate`, page and page size) and the tests, next to WEB-06 Pagination/FilterBar and WEB-08. Phases 5, 6, 8, 10, 12 and 13 consume it, and ORD-10 gets a cross-reference.

**Dependency record:** `docs/dependencies.json` validation reads only `policy` and `packages` (`DependencyRegistry.cs:61-120`). It allows `Kinds = ["nuget", "tool"]` (`:17`) and reports `"{entry.Id}: registry entry has no matching pin (stale entry)."` (`:251-254`). Putting nuqs in `packages` now would **fail `DependencyRegistryTests`**. [VERIFIED: tests/Csps.ArchitectureTests/DependencyRegistry.cs read]

Instead, add a **top-level `planned` array**, which the validator ignores, using the existing entry fields (`"id"`, `"version"`, `"kind"`, `"scope"`, `"purpose"`, `"license"`, `"publisher"`, `"legitimacy"`, `"published"`, `"adopted"`, `"coolDown"`; see `docs/dependencies.json:37-49`), plus a status. Also add a "Planned (not yet installed)" line to `docs/dependencies.md`. Phase 2 must add `"npm"` to `Kinds` and read `web/package.json` pins, then move the entry into `packages`.

```json
"planned": [
  {
    "id": "nuqs",
    "version": "2.10.1",
    "kind": "npm",
    "scope": "runtime",
    "status": "planned, not yet installed (Phase 2 Web Foundation); recheck cool-down and latest version in Phase 2 research",
    "purpose": "Type-safe list-page state (filters, sort, page, tab, view) in the URL query string via the React Router v8 adapter (owner choice, 2026-10-07).",
    "license": "MIT",
    "publisher": "47ng / npm maintainer franky47 (François Best), npm provenance (SLSA v1) attested",
    "legitimacy": "6.2M weekly downloads, source github.com/47ng/nuqs (10.9k stars, active), one dependency @standard-schema/spec 1.1.0 (MIT), no install scripts; package-legitimacy seam OK",
    "published": "2026-08-25",
    "adopted": "",
    "coolDown": "aged (43 days on 2026-10-07)"
  }
]
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Push for page, replace for everything else is the right UX | 3 | Back behaves unexpectedly; trivial to flip in the shared hook |
| A2 | React Compiler raises no diagnostics on nuqs hooks | 3 | Phase 2 lint gate fails; mitigate with a compiler opt-out on the hook module |
| A3 | `NuqsAdapter` on the admin layout route (not root) works the same as at root | 2 | Move to the root route; costs about 5.6 KB on public pages |
| A4 | The owner wants free-text search out of the URL | 5 | Search not restored on Back; owner decides |
| A5 | ORD-10 precedence (URL > localStorage > responsive default) | 4 | Owner may prefer that a shared link overrides the saved preference |

## Open Questions

1. **Is free-text search allowed in admin URLs?** (Pitfall 2.) The default recommendation is no.
2. **Should GAL-01 (public) use nuqs?** It fits the budget, but adds about 5.6 KB to the public gallery route. Decide in Phase 11.
3. **Does a project-wide "no personal data in URLs" rule exist?** Only the token and 2FA-code rules were found. Recommend adding it to the PRD §11 privacy rules.

## Validation Architecture (for Phase 2)

| Behavior | Test type | How |
|----------|-----------|-----|
| Parsers reject or clamp bad input (`size=9999`, `page=0`, `status=bogus`, `from=2026-02-30`) | unit (Vitest) | Pure parser tests |
| The hook resets the page on a filter change, pushes on a page change, and drops defaults | component | `withNuqsTestingAdapter({ searchParams, onUrlUpdate })` asserting `UrlUpdateEvent` |
| ORD-10 precedence | component | URL vs localStorage matrix |
| Back/Forward restore the list after detail → back | E2E (Playwright 5199) | `page.goBack()` asserts the filters and rows |
| No query string in analytics path | unit | ANL-05 collector test |

## Sources

**Primary (HIGH):**
- npm registry (`npm view nuqs`, `nuqs@2.8.0…2.10.1`, `@standard-schema/spec`)
- The nuqs 2.10.1 tarball source
- api.npmjs.org downloads
- GitHub API (repo, issues, releases)
- gsd package-legitimacy seam
- Local probes: jsdom + RR 8.4.0, esbuild, Vite 8.3.3 ± plugin-react 6.1.2

**Secondary (MEDIUM):**
- https://nuqs.dev/docs/adapters
- https://nuqs.dev/docs/options
- Bundlephobia API

**Valid until:** 2026-11-06 (fast-moving library; recheck the latest and the cool-down in Phase 2 research)

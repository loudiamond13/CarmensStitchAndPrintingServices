---
phase: 02-web-foundation-design-system
plan: 11
subsystem: web-url-state
tags: [nuqs, react-router, tanstack-query, url-state, parsers, privacy, tdd]
created: "2026-10-08T13:39:30-05:00"
updated: "2026-10-08T13:39:30-05:00"
requires:
  - phase: 02-web-foundation-design-system (plan 02-04)
    provides: "Vitest with the fail-on-console guard, the nuqs lint bans (shallow false, startTransition, deprecated adapters, parseAsIsoDate), the verify gate"
  - phase: 02-web-foundation-design-system (plan 02-08)
    provides: "BUSINESS_ZONE in web/src/lib/format.ts"
  - phase: 02-web-foundation-design-system (plan 02-39)
    provides: "createQueryClient, useListQuery, useDebouncedValue, prefetchOnIntent"
provides:
  - "web/src/lib/url-state/parsers.ts: PAGE_SIZES, pageParser, pageSizeParser, literalParser, searchParser + normalizeSearch + SEARCH_MAX_LENGTH, parseAsBusinessDate + isCalendarDate, clampPage(page, totalPages), RANGE_PRESETS, CUSTOM_RANGE, dateRangeParsers, dateRangeValues, resolveDateRange, resolveRangePreset, businessToday"
  - "web/src/lib/url-state/createListParams.ts: createListParams(parsers) -> useListParams() returning [values, { setPage, setPageSize, setSearch, setFilter, setFilters, clampPage, reset }], SEARCH_DEBOUNCE_MS"
  - "web/src/lib/url-state/defaultOptions.ts: URL_STATE_DEFAULTS, orderSearchParams"
  - "web/src/lib/url-state/UrlStateLayout.tsx: default export, NuqsAdapter (react-router/v8) around Outlet"
  - "docs/web/url-state.md: developer guide for URL list state and the Query conventions"
affects: [02-15, every-list-screen-phase-5-13, GAL-01, ORD-02, ORD-07, ORD-10, CEXP-01, AUDIT-02, USER-01, DASH-03]
actuals:
  tokens: 17541    # chars/4 over the realized diff (70,166 added chars, 9 files)
  tasks: 2
  commits: 4
plan_head_before: 972930ca337a2f59d3c236bb1dde06d914ec09ae
plan_head_after: 3458cce6d5b2bc295ab8d03a251e34d55f3ba62a
tech-stack:
  added: []
  patterns:
    - "One createListParams definition per list at module level; state keys are the URL keys (page, size, q shared)"
    - "Normalization: a second useQueryStates over raw parseAsString reads tells absent from invalid; one replace rewrites every bad, default or non-canonical key"
    - "setPage pushes; every other setter replaces and merges page: null into the same setParams call"
    - "Date ranges: preset stored by name, resolved against an injected business today; from/to only for custom"
key-files:
  created:
    - web/src/lib/url-state/parsers.ts
    - web/src/lib/url-state/parsers.test.ts
    - web/src/lib/url-state/createListParams.ts
    - web/src/lib/url-state/createListParams.test.tsx
    - web/src/lib/url-state/defaultOptions.ts
    - web/src/lib/url-state/defaultOptions.test.ts
    - web/src/lib/url-state/UrlStateLayout.tsx
    - web/src/lib/url-state/UrlStateLayout.test.tsx
    - docs/web/url-state.md
  modified: []
key-decisions:
  - "List state keys equal the URL keys (page, size, q, then the list's own); no urlKeys mapping, so the privacy guard checks the real URL names"
  - "The hook has one generic setFilter(key, value) for filter, sort, tab and view, plus setFilters for several keys in one update; there are no per-kind setters"
  - "clampPage is a pure parsers.ts function (0 pages -> page 1) and also a hook setter that writes the clamped page with replace"
  - "Privacy guard: names containing email, phone, mobile, password, passwd, secret or token are refused; otp, code, pin, name, firstname, lastname, fullname, customername and address are refused only as the whole name (so orderCode and notPaid stay allowed)"
  - "businessToday(now, zone = BUSINESS_ZONE) lives in parsers.ts and takes an injected instant; no default is computed from new Date()"
patterns-established:
  - "Hook tests: NuqsTestingAdapter with hasMemory and an onUrlUpdate spy; assert one update with { history, queryString }"
  - "Router tests: createBrowserRouter + RouterProvider from react-router/dom with the layout as a route.lazy pathless route and HydrateFallback null; assert window.location.search and history.length"
requirements-completed: [WEB-10, WEB-08]
coverage:
  - id: D1
    description: "Allow-list parsers: page below 1 or malformed -> 1, size outside 10/20/50/100 -> 20, unknown literal -> default, q trimmed and capped at 100 code units without a lone surrogate, business dates calendar-validated (2024-02-29 valid, 2026-02-29 and 2026-02-30 invalid), clampPage (0 pages -> 1)"
    requirement: WEB-10
    verification:
      - kind: unit
        ref: "web/src/lib/url-state/parsers.test.ts (93 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "createListParams: an invalid URL (?page=0&size=9999&status=bogus) gives defaulted state and exactly one replace to the canonical URL, idempotent on re-render; setPage pushes; filter, size, search, sort, tab and view replace with page 1 in the same update; search writes after 300 ms or at once on Enter; privacy key names throw at definition"
    requirement: WEB-10
    verification:
      - kind: unit
        ref: "web/src/lib/url-state/createListParams.test.tsx (60 cases, nuqs testing adapter)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tracer: a component feeding useListParams state (search through useDebouncedValue 300) into the 02-39 useListQuery keys and fetches only the parsed, defaulted values for a hostile URL, once"
    requirement: WEB-08
    verification:
      - kind: unit
        ref: "web/src/lib/url-state/createListParams.test.tsx#createListParams with useListQuery"
        status: pass
    human_judgment: false
  - id: D4
    description: "URL_STATE_DEFAULTS exact; orderSearchParams writes page, size, q, then code-unit order and is idempotent; date presets stored by name and resolved against an injected business today, from/to only for custom"
    requirement: WEB-10
    verification:
      - kind: unit
        ref: "web/src/lib/url-state/defaultOptions.test.ts (6 cases); web/src/lib/url-state/parsers.test.ts (dateRangeParsers, resolveDateRange, resolveRangePreset, businessToday)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The lazily loaded UrlStateLayout inside createBrowserRouter: setPage pushes (history grows, window.location.search changes), a filter replaces (history length unchanged), two setters in one tick make one replaceState, Back restores, a hostile link normalizes once, router navigation is read, no markup of its own"
    requirement: WEB-10
    verification:
      - kind: unit
        ref: "web/src/lib/url-state/UrlStateLayout.test.tsx (8 cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "docs/web/url-state.md explains createListParams, push/replace, privacy, dates, the 300 ms debounce, the Query defaults, useListQuery, intent prefetch and where UrlStateLayout sits"
    verification: []
    human_judgment: true
    rationale: "Whether the guide reads clearly for later phases is an editorial judgment no test asserts"
duration: 14min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 11: URL List State (WEB-10) Wired to the List Query Summary

**Every list now has one typed nuqs hook from `createListParams`: allow-list parsers turn a hostile URL into defaults with a single replace, page changes push and every other change replaces with a page reset, personal-data and secret key names throw at definition, date presets are stored by name, and the parsed values are the only input of the 02-39 `useListQuery`. A lazy `UrlStateLayout` provides the react-router/v8 adapter with the shared options and key order.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-08T18:25:03Z
- **Completed:** 2026-10-08T18:39:13Z
- **Tasks:** 2
- **Files modified:** 9 (all created)

## Accomplishments

- `parsers.ts`: `pageParser` (plain integer of at least 1), `pageSizeParser` (`PAGE_SIZES` 10/20/50/100, default 20), `literalParser`, `searchParser` (trim, 100 UTF-16 code units, an emoji at the limit is dropped whole, blank becomes no search), `parseAsBusinessDate` (real calendar check with leap years, stays a plain string), and a pure `clampPage(page, totalPages)`.
- `createListParams(parsers)` returns the list's hook. On arrival it compares raw strings with parsed values and rewrites every bad, default or untrimmed key in one `replace`; a canonical URL is left alone. `setPage` pushes; `setPageSize`, `setSearch` (debounced 300 ms, or `{ immediate: true }`), `setFilter`, `setFilters` and `reset` replace, and the page reset goes in the same `setParams` call. `clampPage(totalPages)` replaces a page past the end.
- Privacy: defining a list with a key such as `email`, `customerEmail`, `phone`, `mobile`, `name`, `token`, `access-token`, `password`, `secret`, `otp` or `code` throws a `TypeError`.
- The tracer test feeds `useListParams()` (with `useDebouncedValue(q, 300)`) into `useListQuery` and shows that `?page=0&size=9999&status=bogus` produces one request and one cache key, both holding only `{ page: 1, size: 20, q: null, status: 'all', … }`.
- `URL_STATE_DEFAULTS` `{ shallow: true, clearOnDefault: true, scroll: false }` and `orderSearchParams` (page, size, q, then code-unit order, stable and idempotent).
- `UrlStateLayout` (default export) renders `NuqsAdapter` from `nuqs/adapters/react-router/v8` around `<Outlet />`. It was tested as a `route.lazy` pathless route inside `createBrowserRouter`.
- Date ranges: `dateRangeParsers(presets, default)` adds `range`/`from`/`to`; `dateRangeValues` stores a preset by name (removing from/to) and only a custom range with dates; `resolveDateRange(values, businessToday(now))` resolves presets on every visit and swaps a reversed custom range.
- `docs/web/url-state.md` is the guide for later phases.

## Task Commits

1. **Task 1 (tracer): parsers and the list hook, wired to useListQuery**
   - RED `7392b20` (test): 128 cases against inert parsers and a hook with no-op setters; 79 fail on assertions (`RED_EVIDENCE_OK` for `src/lib/url-state/parsers.test.ts` and `src/lib/url-state/createListParams.test.tsx`).
   - GREEN `6d95b91` (feat): the parsers and `createListParams`. The tracer verify was run again and passed (128/128) before expansion (end-of-phase mode, automated-only verify).
2. **Task 2: key order, date presets, UrlStateLayout, guide**
   - RED `9fb11b6` (test): 34 new cases against placeholder options, identity ordering, inert date helpers and an adapter without options; 25 fail on assertions (`RED_EVIDENCE_OK` for `src/lib/url-state/defaultOptions.test.ts`, `src/lib/url-state/parsers.test.ts` and `src/lib/url-state/UrlStateLayout.test.tsx`).
   - GREEN `3458cce` (feat): `defaultOptions.ts`, `UrlStateLayout.tsx`, the date-range helpers, five more hook tests, and the guide.

No REFACTOR commit was needed.

## Files Created/Modified

- `web/src/lib/url-state/parsers.ts`: allow-list parsers, `clampPage`, date-range helpers, `businessToday`.
- `web/src/lib/url-state/createListParams.ts`: the list-hook factory with normalization, history rules and the privacy guard.
- `web/src/lib/url-state/defaultOptions.ts`: `URL_STATE_DEFAULTS` and `orderSearchParams`.
- `web/src/lib/url-state/UrlStateLayout.tsx`: the lazy adapter layout.
- `web/src/lib/url-state/*.test.ts(x)`: 167 cases across four files.
- `docs/web/url-state.md`: the developer guide.

## Decisions Made

- State keys are the URL keys. The plan's own cases name the state `{ page, size, status }`, and with no `urlKeys` indirection the privacy guard checks exactly the names that reach the URL.
- One generic `setFilter(key, value)` covers filter, sort, tab and view, and `setFilters(patch)` covers several keys at once (needed for a date range). `page` and `q` are excluded from both by type, so they only change through `setPage` and `setSearch`.
- `clampPage` exists twice: a pure function in `parsers.ts` (the plan's export, 0 pages → 1) and a hook setter that calls it and writes with `replace`.
- The privacy guard matches whole names for short words (`otp`, `code`, `pin`, `name`, `address`, …) and substrings for long ones (`email`, `phone`, `mobile`, `password`, `secret`, `token`). This catches `customerEmail` and `access-token` but allows `orderCode` (the name 02-10 recommends) and `notPaid`.
- `businessToday(now, zone = BUSINESS_ZONE)` is in `parsers.ts`, because `format.ts` (02-08) has no "today" helper. It takes an injected `Date`.
- The guide uses YAML `created:`/`updated:` front matter, so the plan's acceptance check finds the literal keys.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Hook-level tests for date ranges, key order and a list without paging**
- **Found during:** Task 2 (GREEN)
- **Issue:** The plan's Task 2 file list does not include `createListParams.test.tsx`. Without a hook test, nothing proved that `setFilters(dateRangeValues(...))` stores from/to only for custom through the real hook, or that the app's `processUrlSearchParams` orders keys in a hook update. Two branches (a list without `page`, and `clampPage` on such a list) were also uncovered.
- **Fix:** Added five cases to `createListParams.test.tsx`, using the testing adapter with `URL_STATE_DEFAULTS` and `orderSearchParams`.
- **Files modified:** web/src/lib/url-state/createListParams.test.tsx
- **Verification:** 167/167 url-state tests pass; url-state coverage is 100% statements, branches, functions and lines.
- **Committed in:** `3458cce`

---

**Total deviations:** 1 auto-fixed (1 missing critical test coverage)
**Impact on plan:** Tests only; no scope change.

## Issues Encountered

- `dateRangeValues` first used one generic union parameter. TypeScript could not infer the preset type from a `custom` choice, so the result did not fit a list whose presets are narrower. It now has two overloads (custom → `DateRangeState<never>`, preset `N` → `DateRangeState<N>`).

## TDD Gate Compliance

- Task 1: RED `7392b20` comes before GREEN `6d95b91` (`RED_EVIDENCE_OK`, targets `src/lib/url-state/parsers.test.ts` and `src/lib/url-state/createListParams.test.tsx`).
- Task 2: RED `9fb11b6` comes before GREEN `3458cce` (`RED_EVIDENCE_OK`, targets `src/lib/url-state/defaultOptions.test.ts`, `src/lib/url-state/parsers.test.ts` and `src/lib/url-state/UrlStateLayout.test.tsx`).

## Verification

- `npm --prefix web run test -- --run src/lib/url-state`: 4 files, 167 tests passed.
- `npm --prefix web run verify`: exit 0 (typecheck of all three programs, lint with zero warnings, Prettier, 41 files and 1198 tests with coverage, build, license gate, notices check). Overall coverage is 100% statements and lines, 99.74% branches.
- Acceptance greps: no `parseAsIsoDate` import in `parsers.ts` (0); `useListQuery` appears in `createListParams.test.tsx` (3); `nuqs/adapters/react-router/v8` appears once in `UrlStateLayout.tsx`; the router test asserts `window.location.search` (10) and never `useLocation`; the guide has `created:`/`updated:` and names `createListParams`, `UrlStateLayout`, `useListQuery` and "300 ms".

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-15 (app routes) mounts `UrlStateLayout` as a `route.lazy` pathless layout above the admin routes: `lazy: async () => ({ Component: (await import('@/lib/url-state/UrlStateLayout')).default })`. Give the root route a `HydrateFallback`.
- List screens in Phases 5-13: one `createListParams` per list; `useDebouncedValue(values.q, 300)` before `useListQuery`; call `clampPage(totalPages)` once the server returns the page count; date filters through `dateRangeParsers` + `resolveDateRange(values, businessToday(now))`.
- ORD-10 `view` stays a `parseAsStringLiteral(['grid', 'table'])` with no default (the localStorage fallback lives in the screen).
- A list may not use `email`, `phone`, `name`, `code` and similar as keys (throws at module load). Use ids.

## Self-Check: PASSED

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

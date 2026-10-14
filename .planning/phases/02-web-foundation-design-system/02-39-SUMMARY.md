---
phase: 02-web-foundation-design-system
plan: 39
subsystem: web-data-fetching
tags: [tanstack-query, react, debounce, abortsignal, prefetch, pagination, tdd]
created: "2026-10-08T13:08:30-05:00"
updated: "2026-10-08T13:08:30-05:00"
requires:
  - phase: 02-web-foundation-design-system (plan 02-04)
    provides: "Vitest setup with the fail-on-console guard, RTL cleanup, the verify gate (typecheck, lint, format, coverage, build)"
  - phase: 02-web-foundation-design-system (plan 02-10)
    provides: "createHttpClient owns retries, so TanStack Query runs with retry false"
provides:
  - "web/src/lib/query/queryClient.ts: QUERY_DEFAULTS (as const satisfies DefaultOptions: staleTime 30_000, gcTime 300_000, retry false, refetchOnWindowFocus true; mutations retry false) and createQueryClient()"
  - "web/src/lib/query/keys.ts: listKey(resource, params) -> readonly [resource, 'list', params]"
  - "web/src/lib/query/useListQuery.ts: useListQuery({ key, params, fetcher }) with the keep-previous placeholder and the query signal forwarded as fetcher(params, signal)"
  - "web/src/lib/query/useDebouncedValue.ts: useDebouncedValue(value, delayMs) (lists pass 300)"
  - "web/src/lib/query/prefetchOnIntent.ts: prefetchOnIntent(queryClient, options) -> { onPointerEnter, onPointerLeave, onFocus, onBlur }, INTENT_DELAY_MS = 100, IntentHandlers/IntentEvent/IntentPointerEvent types"
affects: [02-11, 02-15, every-list-screen-phase-5-13]
actuals:
  tokens: 6500    # chars/4 over the realized diff (26,142 chars, 9 files)
  tasks: 2
  commits: 4
plan_head_before: 2095bd4798f405cd622768198238fc2c9ae68174
plan_head_after: 58bb7100368f272a8458f781d69ae0021f39df23
tech-stack:
  added: []
  patterns:
    - "List queries key on listKey(resource, parsed params) and always forward the query-function signal, so TanStack aborts a superseded or orphaned request"
    - "Search params reach a list key only through useDebouncedValue(q, 300)"
    - "Intent prefetch uses queryClient.query(options).catch(() => undefined); prefetchQuery is never called (L-15)"
    - "Timer cases (debounce, intent) run on fake timers with fireEvent only; cache cases run on real timers (L-24)"
key-files:
  created:
    - web/src/lib/query/queryClient.ts
    - web/src/lib/query/queryClient.test.ts
    - web/src/lib/query/keys.ts
    - web/src/lib/query/useListQuery.ts
    - web/src/lib/query/useListQuery.test.tsx
    - web/src/lib/query/useDebouncedValue.ts
    - web/src/lib/query/useDebouncedValue.test.tsx
    - web/src/lib/query/prefetchOnIntent.ts
    - web/src/lib/query/prefetchOnIntent.test.tsx
  modified: []
key-decisions:
  - "useListQuery's option `key` is the resource name (the first key segment); the full key is listKey(key, params). No `enabled` option was added (not in the plan)"
  - "prefetchOnIntent keeps one pending timer per element in a module WeakMap, so handlers rebuilt on a later render still cancel an earlier render's timer, and hover followed by focus queues only one prefetch"
  - "A touch pointerenter is ignored, so a first tap on a phone never prefetches through pointerenter (the plan's flagged WEB-08 assumption); focus still counts"
  - "useDebouncedValue takes delayMs as a required argument (no default); lists pass 300"
  - "The keep-previous helper is imported under the alias keepPreviousPage so useListQuery.ts names keepPreviousData on exactly one line, as the acceptance grep requires"
patterns-established:
  - "A component test that types into a debounced search on fake timers must also advance the query's 0 ms notify timer (settleSearch helper) before asserting rendered rows"
requirements-completed: [WEB-08]
coverage:
  - id: D1
    description: "QUERY_DEFAULTS are exactly staleTime 30 s, gcTime 5 min, retry false, refetchOnWindowFocus true, mutation retry false, and createQueryClient() applies them with its own cache"
    requirement: WEB-08
    verification:
      - kind: unit
        ref: "web/src/lib/query/queryClient.test.ts (4 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A list query keys on listKey(resource, parsed params), forwards its AbortSignal, keeps the previous page visible with isPlaceholderData true until the next page arrives, and aborts the in-flight request on unmount"
    requirement: WEB-08
    verification:
      - kind: unit
        ref: "web/src/lib/query/useListQuery.test.tsx (5 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The search key settles 300 ms after the last keystroke, restarts on a change within 300 ms, fetches once per settled value and aborts the superseded 'jer' request when it settles on 'jersey'"
    requirement: WEB-08
    verification:
      - kind: unit
        ref: "web/src/lib/query/useDebouncedValue.test.tsx (6 cases, fake timers, one input event per character)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Intent prefetch fires queryClient.query once after 100 ms of focus or mouse hover, is cancelled by blur/pointerleave, ignores touch pointers, swallows a rejection (error kept in the cache), adds no markup and never calls prefetchQuery"
    requirement: WEB-08
    verification:
      - kind: unit
        ref: "web/src/lib/query/prefetchOnIntent.test.tsx (12 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The flagged WEB-08 assumption (intent = 100 ms hover/focus; no prefetch on a touch device's first tap) matches what the owner means by intent prefetch"
    verification: []
    human_judgment: true
    rationale: "The plan marks this edge as an unresolved planner assumption to confirm at verify time; only the owner can confirm the meaning"
duration: 8min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 39: TanStack Query Conventions (WEB-08) Summary

**Every list screen now has shared Query defaults (30 s stale, 5 min gc, no Query retries), a list query keyed on parsed params that keeps the previous page on screen and aborts orphaned or superseded requests, a 300 ms settle hook for the search key, and 100 ms intent prefetch through `queryClient.query` (never the deprecated `prefetchQuery`).**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-08T18:00:26Z
- **Completed:** 2026-10-08T18:08:01Z
- **Tasks:** 2
- **Files modified:** 9 (all created)

## Accomplishments

- `QUERY_DEFAULTS` and `createQueryClient()` hold the WEB-08 values, and a test pins them exactly. Query never retries, because the HTTP client owns retries (Pitfall 16, T-02-81).
- `useListQuery({ key, params, fetcher })` keys on `listKey(key, params)`, passes the query signal on as `fetcher(params, signal)`, and uses the keep-previous placeholder. Page 1 stays visible with `isPlaceholderData` true until page 2 arrives. Unmounting during a fetch aborts the request.
- `useDebouncedValue(q, 300)`: typing "jersey" one character at a time sends one request for "jersey". When "jer" has already settled and its request is in flight, settling on "jersey" aborts the "jer" request.
- `prefetchOnIntent(queryClient, options)` returns four handlers. Focus or a mouse pointer held for 100 ms calls `queryClient.query(options).catch(() => undefined)` once. Leaving or blurring before then cancels it. A touch pointer is ignored. Each element has only one pending timer, so repeated events or handlers rebuilt on a later render cannot queue a second prefetch.

## Task Commits

1. **Task 1 (tracer): list query with keep-previous paging and cancellation**
   - RED `143134a` (test): 5 cases against an inert `useListQuery`; 3 fail on assertions (`RED_EVIDENCE_OK`, target `src/lib/query/useListQuery.test.tsx`).
   - GREEN `e3d4dda` (feat): `QUERY_DEFAULTS`, `createQueryClient`, `listKey`, `useListQuery`. The tracer verify was re-run and passed (5/5) before expansion (end-of-phase mode, automated-only verify).
2. **Task 2: debounced search key, intent prefetch, pinned defaults**
   - RED `710135f` (test): 22 new cases against a pass-through debounce and no-op handlers; 11 fail on assertions (`RED_EVIDENCE_OK` for `src/lib/query/useDebouncedValue.test.tsx` and `src/lib/query/prefetchOnIntent.test.tsx`).
   - GREEN `58bb710` (feat): `useDebouncedValue` and `prefetchOnIntent`.

No REFACTOR commit was needed.

## Files Created/Modified

- `web/src/lib/query/queryClient.ts`: shared defaults and the client factory.
- `web/src/lib/query/keys.ts`: `listKey`.
- `web/src/lib/query/useListQuery.ts`: the keep-previous, cancellable list query.
- `web/src/lib/query/useDebouncedValue.ts`: the settle hook.
- `web/src/lib/query/prefetchOnIntent.ts`: the intent handlers and `INTENT_DELAY_MS`.
- `web/src/lib/query/*.test.ts(x)`: 27 cases across the four test files.

## Decisions Made

- The `key` option of `useListQuery` is the resource name. The full key is built by `listKey`.
- The handlers keep their pending timers in a module-level `WeakMap` keyed by `event.currentTarget`. Without this, a component that rebuilds the handlers on each render would leave a timer that its new `onPointerLeave` could not cancel.
- A touch `pointerenter` is ignored, as the plan's flagged assumption says ("never prefetches on touch-only devices' first tap"). The owner should confirm this at verify time (coverage D5).
- `keepPreviousData` is imported as `keepPreviousPage`, so the word appears on exactly one line of `useListQuery.ts`. The acceptance grep requires a count of exactly 1, and an import line plus a usage line would count 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Intent-timer cases run on fake timers instead of real timers**
- **Found during:** Task 2 (RED)
- **Issue:** The plan says to use real timers everywhere except the debounce cases. On real timers, the "pointerleave after 50 ms gives no prefetch" case would be flaky. On a loaded machine, during `verify`'s parallel run, a 50 ms sleep can stretch past the 100 ms intent timer and fail the test falsely.
- **Fix:** The intent-timer cases use fake timers and `fireEvent` only. They never use user-event or axe, so L-24's reason for real timers does not apply. The two cache cases (the cache fills, and a rejection is swallowed) still run on real timers with a real 100 ms wait.
- **Files modified:** `web/src/lib/query/prefetchOnIntent.test.tsx`
- **Verification:** 12/12 pass in three repeated runs and in `verify`.
- **Committed in:** `710135f`

**2. [Rule 2 - Missing critical] One intent timer per element, and touch pointers ignored**
- **Found during:** Task 2 (GREEN)
- **Issue:** If each handler set had its own timer closure, handlers rebuilt on a re-render could not cancel an earlier timer, and hover followed by focus would send two prefetches. Both would weaken the T-02-81 request-storm mitigation. The plan's flagged assumption also excludes prefetch on a touch device's first tap.
- **Fix:** A `WeakMap<EventTarget, timer>` holds one shared timer per element, and `pointerType === 'touch'` is ignored. Each behaviour has its own test.
- **Files modified:** `web/src/lib/query/prefetchOnIntent.ts`, `web/src/lib/query/prefetchOnIntent.test.tsx`
- **Committed in:** `710135f` (tests), `58bb710` (implementation)

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 2)
**Impact on plan:** Every must-have truth is implemented and tested. No package changed, so the conditional package checkpoint did not fire.

## TDD Gate Compliance

- Task 1: RED `143134a` comes before GREEN `e3d4dda` (`RED_EVIDENCE_OK`).
- Task 2: RED `710135f` comes before GREEN `58bb710` (`RED_EVIDENCE_OK` for both target files).
- `queryClient.test.ts` passed at its RED commit. This is expected and not a gate violation: the plan builds `QUERY_DEFAULTS` in Task 1's GREEN and adds the pinning test in Task 2. The Task 1 RED placeholder had empty defaults.

## Issues Encountered

- With fake timers, TanStack's notify manager delivers results through a 0 ms `setTimeout`. After the 300 ms settle, the debounce-plus-query tests advance 0 ms once more (the `settleSearch` helper) before asserting the rendered rows.

## Verification

- `npm --prefix web run test -- --run src/lib/query`: 4 files, 27/27 passed (run 3 times, stable).
- `npm --prefix web run verify`: exit 0. Typecheck, lint (`--max-warnings 0`), format, 35 files with 958/958 tests, and the build all passed. Coverage is 100% statements, functions and lines, 99.63% branches overall; `lib/query` is fully covered, and the only uncovered branch is the existing `csps.ts:176`.
- Acceptance greps: `keepPreviousData` appears on 1 line of `useListQuery.ts`; `signal` appears on 3; `.prefetchQuery(` appears 0 times in `prefetchOnIntent.ts`; `300` appears 3 times in `useDebouncedValue.test.tsx`.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **02-11 (URL state):** drive `useListQuery({ key, params, fetcher })` with the parsed values from the list's `useXxxListParams()` hook. Pass the search through `useDebouncedValue(q, 300)` before it reaches `params`. The fetcher must pass `signal` to the api.ts call.
- **02-15 (api.ts / app root):** create one `createQueryClient()` for the app. Tests make their own client per test.
- **Prefetch:** spread `prefetchOnIntent(queryClient, { queryKey: listKey(...), queryFn })` onto a link or row. The handlers expect React's pointer and focus events (`currentTarget`, `pointerType`).

## Self-Check: PASSED

- All 9 files under `web/src/lib/query/` exist.
- Commits `143134a`, `e3d4dda`, `710135f` and `58bb710` are on `gsd/phase-2-web-foundation-design-system`.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

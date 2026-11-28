---
phase: 14-hardening-release-readiness
plan: 06
subsystem: ui
tags: [view-transitions, reduced-motion, react-router, perf-07, motion]
created: "2026-11-27T20:52:00-06:00"
updated: "2026-11-27T20:52:00-06:00"
requires: []
provides:
  - "usePrefersReducedMotion() and canStartViewTransition(): one shared media-query subscription, and a check that is true only in a Chromium-engine browser with document.startViewTransition"
  - "UiLink passes viewTransition on in-app links (internal AppLink), with a noTransition prop for drawer links"
  - "guardViewTransitions(router): a guard installed where the router is created; Back, Forward and reduced motion change the page at once, and a skipped transition raises no page error"
  - "@view-transitions e2e cases: sidebar, header, drawer, same page, Back/Forward (also after reduced motion is switched on) and rapid second click"
affects: [14-15, 14-16, 14-26, 14-30]
actuals:
  tokens: 7800
  tasks: 2
  commits: 7
plan_head_before: cf8b1a3ceb32a1296f8218140b30be37b147a944
plan_head_after: 089172b87efad5c0d3af354660141a05a47b9c46
tech-stack:
  added: []
  patterns:
    - "Feature test for the engine: navigator.userAgentData exists only in Chromium-engine browsers, so no user-agent string parsing and no package"
    - "Replace document.startViewTransition once at router creation with a wrapper that runs the page update at once when the change must be instant"
key-files:
  created:
    - web/src/hooks/usePrefersReducedMotion.ts
    - web/src/hooks/usePrefersReducedMotion.test.ts
    - web/src/core/routes/viewTransitionGuard.ts
    - web/src/core/routes/viewTransitionGuard.test.ts
    - web/src/test/viewTransitionSpy.tsx
  modified:
    - web/src/components/actions/UiLink.tsx
    - web/src/components/actions/links.test.tsx
    - web/src/components/navigation/Sidebar.tsx
    - web/src/components/navigation/SiteHeader.tsx
    - web/src/layouts/AdminLayout.tsx
    - web/src/core/routes/router.tsx
    - web/e2e/motion.spec.ts
key-decisions:
  - "14 D-48: page fades never run for Back/Forward or under reduced motion (a guard at router creation), and run only in Chromium-engine browsers; Safari and iPhone get no fade (owner, 2026-11-27)"
  - "Firefox also gets no fade, because the engine check is navigator.userAgentData, which only Chromium-engine browsers have. This follows from the ruling (Chromium-engine only)"
  - "The guard learns Back/Forward from router.subscribe (historyAction POP) and reads the reduced-motion setting at call time, so a setting switched on after a fade still stops the replay"
patterns-established:
  - "A page change that must be instant still goes through the same router code path: the wrapper returns an already-finished transition object, so React Router needs no special case"
requirements-completed: []
coverage:
  - id: D1
    description: "A click on an in-app link to another page starts exactly one View Transition in a Chromium-engine browser when motion is allowed"
    requirement: PERF-07
    verification:
      - kind: e2e
        ref: "web/e2e/motion.spec.ts#@view-transitions admin sidebar and public header (motion allowed), chromium"
        status: pass
      - kind: unit
        ref: "web/src/components/actions/links.test.tsx#asks for a View Transition on a link to another page when the browser can and motion is allowed"
        status: pass
    human_judgment: false
  - id: D2
    description: "No View Transition starts under reduced motion, and a change of the device setting applies without a reload"
    requirement: PERF-07
    verification:
      - kind: e2e
        ref: "web/e2e/motion.spec.ts#@view-transitions admin sidebar and public header (reduced motion)"
        status: pass
      - kind: unit
        ref: "web/src/hooks/usePrefersReducedMotion.test.ts#follows a change of the device setting without a reload"
        status: pass
    human_judgment: false
  - id: D3
    description: "Back and Forward, drawer links and same-page links start no transition; Back/Forward stays instant after reduced motion is switched on"
    requirement: PERF-07
    verification:
      - kind: e2e
        ref: "web/e2e/motion.spec.ts#@view-transitions history, drawer, same page"
        status: pass
      - kind: unit
        ref: "web/src/core/routes/viewTransitionGuard.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Safari and iPhone get no fade; the page changes at once there"
    requirement: PERF-07
    verification:
      - kind: e2e
        ref: "web/e2e/motion.spec.ts#@view-transitions admin sidebar and public header on the iphone project (expects 0)"
        status: pass
      - kind: unit
        ref: "web/src/hooks/usePrefersReducedMotion.test.ts#is false in a browser that has the API but is not Chromium-engine"
        status: pass
    human_judgment: false
  - id: D5
    description: "A second link click while the first fade runs ends on the second page"
    requirement: PERF-07
    verification:
      - kind: e2e
        ref: "web/e2e/motion.spec.ts#@view-transitions ordering"
        status: pass
    human_judgment: false
  - id: D6
    description: "The look of the fade (the browser's own 0.25 s cross-fade) feels right to a person"
    requirement: PERF-07
    verification: []
    human_judgment: true
    rationale: "Tests count transitions and prove the page changes; whether the fade looks good on a real phone or desktop is a human judgment for the motion audit in plan 14-16."
duration: about 3h with the stop for the owner ruling (resumed 20:30, finished 20:52)
completed: 2026-11-27
status: complete
---

# Phase 14 Plan 06: Page links fade between pages in Chromium-engine browsers, and never for history moves or reduced motion Summary

**In-app links fade between pages with the browser's own cross-fade, only in Chromium-engine browsers and only for forward clicks with motion allowed. A small guard at router creation makes Back, Forward and reduced motion an instant page change and removes the skipped-transition page error. Safari and iPhone get no fade.**

## Owner ruling

`14 D-48: page fades never run for Back/Forward or under reduced motion (a guard at router creation), and run only in Chromium-engine browsers; Safari and iPhone get no fade (owner, 2026-11-27)`

Plan 14-26 copies this line into 14-CONTEXT.md (D-48 is reserved there; the review pack starts at D-49).

## Why the plan stopped for a ruling (findings)

1. React Router 8.4.0 replays a View Transition on Back and Forward between a pair of pages that faded going forward (router.js about lines 360 to 370; the pair memory is in sessionStorage). Measured in Chromium: Back after a fade started 1 transition, and still 1 with reduced motion turned on after the fade. A quick Back then Forward threw "Transition was skipped. skipTransition() called", which fails the e2e console guard.
2. WebKit (the `iphone` project): after a sidebar click the URL changed but the new page did not render within 5 s in 3 of 4 runs (likely the browser's 4 s update timeout). A rapid second click during a fade failed every time. Chromium never stalled.

The owner chose both fixes: the guard (A) and no fade in Safari (C).

## What was built

- **Task 1 (tracer), commits 8a67c526 and 1f25b996:** the hook, `canStartViewTransition`, and `UiLink` passing `viewTransition` when the browser can, motion is allowed and the target is another page. The plain anchor branch is unchanged. `UiLink` now hands in-app paths to an internal `AppLink`.
- **Task 2, commits 6dd48cdb and 4186fedc:** `noTransition` on `UiLink`, `Sidebar` (set on the drawer's Sidebar in `AdminLayout`) and every site menu link in `SiteHeader`. Same-page links pass none.
- **Ruling follow-up, commits c6d155d7 (RED) and 089172b8 (GREEN):**
  - `guardViewTransitions(router)` in `web/src/core/routes/viewTransitionGuard.ts`, called in `router.tsx` right after `createBrowserRouter`. It tracks the history action through `router.subscribe`. For a POP, or when the reduced-motion query matches at call time, it runs the update in a microtask and returns an already-finished transition object. Otherwise it calls the real API and attaches a no-op catch to `ready`, which is what rejected on a skipped transition.
  - `canStartViewTransition()` now also needs `'userAgentData' in navigator`. No user-agent string parsing, no package.
  - e2e: Back/Forward case (0 transitions, also after reduced motion is switched on), rapid second-click case, and the sidebar and header cases expect 1 only in Chromium and 0 elsewhere.

## Verification (quoted)

- Unit: `src/hooks src/components/actions src/components/navigation src/layouts/AdminLayout.test.tsx src/core/routes`: 16 files, 476 tests passed. `src/core/routes src/hooks` after the final lint fix: 7 files, 64 tests passed.
- RED seen before GREEN: the unit run showed 2 failing assertions plus the missing guard module; the e2e run showed the history case failing with "motion allowed: Expected 0, Received 2".
- `npm --prefix web run typecheck`: exit 0.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0.
- `@view-transitions` e2e on `--project chromium --project iphone`: run 1: 16 passed (1.1 m).
- `@view-transitions|@motion` e2e on `--project chromium --project iphone`: run 2: 40 passed, 2 skipped (2.8 m). The 2 skipped are the existing Chromium-only layout-shift cases on iphone (`@motion cls`, `@motion drawer cls`). No flake in either run.
- `npm --prefix web run build:budget`: exit 0, every row under 150 KB.

| Public JS row | Before this plan | After the plan (with the guard) | Limit |
| ------------- | ---------------- | ------------------------------- | ----- |
| Privacy | 149.27 KB | 149.90 KB | 150.00 KB |
| Contact | 148.42 KB | 149.04 KB | 150.00 KB |
| Home | 146.71 KB | 147.35 KB | 150.00 KB |

Other rows after: products 144.25, gallery 145.40, terms 148.03, accessibility 147.59, notFound 140.12 KB. Privacy has 0.10 KB left. The limit did not move. The next plan that adds to the public entry chunk has almost no room and must shrink something else first (flag for the budget row in STATE).

## Deviations from Plan

### Owner-ruled change (Rule 4 stop, then ruling D-48)

**1. [Rule 4 - Architectural] Guard at router creation and a Chromium-only fade**
- **Found during:** Task 2 e2e work
- **Issue:** the findings above (Back/Forward replay, WebKit stalls)
- **Fix:** the guard and the engine check, as the owner ruled
- **Files modified:** `web/src/core/routes/viewTransitionGuard.ts` (new), `web/src/core/routes/router.tsx`, `web/src/hooks/usePrefersReducedMotion.ts`, `web/src/test/viewTransitionSpy.tsx`, tests and `web/e2e/motion.spec.ts`
- **Commits:** c6d155d7, 089172b8

### Auto-fixed Issues

**2. [Rule 3 - Blocking] ESLint rejected the first guard version**
- **Found during:** lint after the GREEN code
- **Issue:** `unbound-method` on `doc.startViewTransition` and `no-unsafe-assignment` on `Promise<any>`
- **Fix:** bind the method once (`doc.startViewTransition.bind(doc)`) and wrap the update in an async function so the promise is typed `Promise<void>`; the test checks `'startViewTransition' in doc` instead of reading the property
- **Commit:** 089172b8

**3. [Rule 1 - Bug] My first ordering e2e matched the wrong heading text**
- **Found during:** the RED e2e run
- **Issue:** the test looked for "contact|quote" but the Contact page heading reads "Let's build your kit."
- **Fix:** match `/build your kit/i`
- **Commit:** c6d155d7

### Plan-listed files and scope notes

- `files_modified` also gained `router.tsx`, `viewTransitionGuard.ts` and its test, `web/src/test/viewTransitionSpy.tsx` (shared unit-test helper) and the Sidebar, SiteHeader and AdminLayout tests. These are the ruling and the test helpers.
- The measured `commits: 7` includes the orchestrator's docs commit 30999251 that reserved D-48; the plan's own commits are 6.
- Firefox gets no fade as a side effect of the engine check (see key-decisions). This is inside "Chromium-engine browsers only".
- The WebKit 4 s stall was measured, not fixed in WebKit: the fade is simply not requested there.

## Auth gates

None.

## Known Stubs

None.

## Threat Flags

None. Client-side presentation only. T-14-11 (motion harm to motion-sensitive users) is mitigated: reduced motion turns the fade off at the link, and the guard also covers a setting switched on after a fade; e2e proves 0 transitions under reduce.

## Self-Check: PASSED

- FOUND: web/src/core/routes/viewTransitionGuard.ts, web/src/core/routes/viewTransitionGuard.test.ts, web/src/hooks/usePrefersReducedMotion.ts, web/src/hooks/usePrefersReducedMotion.test.ts, web/src/test/viewTransitionSpy.tsx
- FOUND commits: 8a67c526, 1f25b996, 6dd48cdb, 4186fedc, c6d155d7, 089172b8

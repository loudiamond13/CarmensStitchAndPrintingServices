---
created: 2026-11-24T00:04:37-06:00
updated: 2026-11-24T00:04:37-06:00
phase: 13-quote-inquiries
plan: 23
subsystem: component-showcase
tags: [showcase, quote-requests, quote-form, scenarios, react, a11y, tdd, playwright]
status: complete

requires:
  - phase: 13-quote-inquiries
    provides: "QuoteForm and its photo kit (13-09, 13-12, 13-14); QuoteStatusFilter, QuoteStatusBadge and the status tones (13-15); Sidebar counts and QuoteRequestsStrip (13-17)"
provides:
  - "A 'Quote requests' section at the end of the Component Showcase: the eight QuoteForm scenarios, then the Phase 13 admin demos on request"
  - "Phase13Demos: status pills with and without counts, the six badges in Blush and Espresso, NavCount 0, 1, 99+ and collapsed, the strip at 0, 3, loading and failed"
  - "The quote scenario group (web/src/dev/scenarios/groups/quote.ts) and the dev-only QuoteFormDemo preview, also shown on the parity page"
  - "QuoteForm takes an optional `service` (ticket, create, photo uploads); useQuoteTicket and sendWithPhotos take it too, default the real service"
affects: [13-24, 13-26]

actuals:
  tokens: 14150
  tasks: 2
  commits: 4
plan_head_before: 02fc304ae6337cc5b0ce3efbaeda5b266465d02a
plan_head_after: 09fdb93e0a2acc488851d940e654fe94bc67de75

tech-stack:
  added: []
  patterns:
    - "A dev preview drives the real form (fills fields, picks files, presses Send) against a demo service, so each state is the form's own drawing and nothing is sent"
    - "Public stores are primed in a layout effect, before the lazy form subscribes, so the form finds fresh data and reads nothing"
    - "Showcase cases that move focus when they reach their state show on request (ON_DEMAND)"

key-files:
  created:
    - web/src/modules/admin/components/showcase/Phase13Demos.tsx
    - web/src/modules/admin/components/showcase/Phase13Demos.test.tsx
    - web/src/dev/previews/QuoteFormDemo.tsx
    - web/src/dev/scenarios/groups/quote.ts
    - web/src/dev/scenarios/groups/quote.test.tsx
  modified:
    - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
    - web/src/modules/admin/components/showcase/showcaseSections.ts
    - web/src/modules/admin/components/showcase/showcaseSections.test.ts
    - web/src/modules/admin/components/showcase/showcaseCopy.ts
    - web/src/modules/admin/pages/ComponentShowcasePage.tsx
    - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
    - web/src/modules/admin/pages/ComponentShowcasePage.lazy.test.tsx
    - web/src/dev/scenarios/index.test.ts
    - web/src/dev/previews/PublicShell.tsx
    - web/src/modules/public/components/QuoteForm.tsx
    - web/src/modules/public/components/QuoteFormPhotos.test.tsx
    - web/src/modules/public/hooks/useQuoteTicket.ts
    - web/src/modules/public/quotePhotoUpload.ts

key-decisions:
  - "The QuoteForm states are reached by driving the real form against a demo service, not by a copy of its markup, so the showcase cannot drift from the Contact page"
  - "QuoteForm gets one optional `service` prop (default the real service) so the showcase sends nothing; no behavior changes for visitors"
  - "The quote scenarios sit in the showcase's new Quote requests section and on the parity page, like the Phase 12 legal notice; /dev/public keeps its focus column"
  - "Three states that move focus when reached (field errors, sent, sent with missing photos) show on request in the showcase"

patterns-established:
  - "Dev preview that plays a visitor's steps once (a ref guard survives StrictMode) after a lazy form mounts"

requirements-completed: [INQ-01, INQ-05]

coverage:
  - id: D1
    description: "Showcase Quote requests section with the Phase 13 admin demos (pills, badges in both themes, NavCount 0/1/99+/collapsed, strip 0/3/loading/failed), loaded on request, no request sent"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/showcase/Phase13Demos.test.tsx (14 tests)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/ComponentShowcasePage.lazy.test.tsx#the Quote requests cases load only on request"
        status: pass
    human_judgment: true
    rationale: "The owner reviews the look of each state (Phase 8 D-56 practice); tests prove content, axe and no requests, not the look"
  - id: D2
    description: "Eight QuoteForm scenarios (empty, every field error, photos with one refused, sending, sent, sent with missing photos, rate limited, send failed), Blush only, no request, zero axe findings"
    requirement: INQ-01
    verification:
      - kind: unit
        ref: "web/src/dev/scenarios/groups/quote.test.tsx (25 tests, includes StrictMode)"
        status: pass
      - kind: automated_ui
        ref: "npm run parity -- --grep \"@quote \" (8 rows: chromium, firefox, webkit)"
        status: pass
    human_judgment: true
    rationale: "The owner reviews the look of each state; the copy is the existing UI-SPEC copy"
  - id: D3
    description: "QuoteForm uses a given service for the ticket, the create and the photo uploads; the real service stays the default"
    requirement: INQ-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/QuoteFormPhotos.test.tsx#QuoteForm with a service of its own"
        status: pass
      - kind: unit
        ref: "web/src/modules/public (all QuoteForm, hook and upload tests)"
        status: pass
    human_judgment: false

duration: 41min
completed: 2026-11-24
---

# Phase 13 Plan 23: Component Showcase additions Summary

*Created: 2026-11-24T00:04:37-06:00 · Updated: 2026-11-24T00:04:37-06:00*

**A new "Quote requests" section in the Component Showcase shows the real Get a Quote form in all eight states (reached by a dev-only driver against a demo service, so nothing is sent) and, on request, the status pills, the six badges in both themes, the NavCount chip and the dashboard strip in every state.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-11-23T23:24:04-06:00
- **Completed:** 2026-11-24T00:04:37-06:00
- **Tasks:** 2 of 2
- **Files modified:** 18 (5 created, 13 changed)

## Accomplishments

- **Admin demos (Task 1, tracer):** `Phase13Demos` with 12 cases: `quote-status-filter` (counts 4, 12, 3, 1, 20; a press selects another pill), `quote-status-filter-loading` (no counts), `quote-status-badges-blush` and `-espresso` (the six badges in a `data-theme` frame), `nav-count-0`, `nav-count-1`, `nav-count-99-plus` (150, current row) and `nav-count-collapsed` (3, rail dot), `quote-strip-0`, `-3`, `-loading`, `-failed`. Links and the sidebar are wrapped so a press stays on the showcase. The section loads them on request as a lazy chunk ("Show the Quote requests cases"), like the Phase 10 and 11 cases.
- **QuoteForm scenarios (Task 2):** group `quote` with `quote-form-empty`, `-field-errors` (name, team, number, email and message), `-photos-refused` (two PNGs and `price-list.pdf`), `-sending` (one photo, the pending button and the photo line), `-sent`, `-sent-photos-missing` ("2 of your photos didn't upload: front-sketch.png, back-sketch.png" with the Messenger button), `-rate-limited`, `-send-failed`. Blush only, parity false, so the parity suite runs axe, the CSP listener and the request guard on each.
- **Demo data:** Juan Dela Cruz and Brgy. San Roque Ballers (the UI-SPEC sample names), 0917 555 0123, juan.delacruz@example.test, two made-up product lines; the shop facts are the existing parity ones (`PARITY_SITE`). No real customer data.

## Task Commits

1. **Task 1: admin showcase** - `d63ec77e` (test, RED), `5b8c36f8` (feat, GREEN)
2. **Task 2: QuoteForm scenarios** - `b517a0b2` (test, RED), `09fdb93e` (feat, GREEN)

**Plan metadata:** this SUMMARY commit (docs)

## Files Created/Modified

- `web/src/modules/admin/components/showcase/Phase13Demos.tsx` - the 12 admin cases
- `web/src/dev/previews/QuoteFormDemo.tsx` - dev only: the real form, a demo service, primed stores and the visitor's steps per state
- `web/src/dev/scenarios/groups/quote.ts` - the eight scenarios
- `ShowcaseDemos.tsx`, `showcaseSections.ts`, `showcaseCopy.ts` - the section, its on-request trigger and its label
- `ComponentShowcasePage.tsx` - three quote states that move focus join the on-request list
- `QuoteForm.tsx`, `useQuoteTicket.ts`, `quotePhotoUpload.ts` - the optional `service`
- `PublicShell.tsx` - exports `PARITY_SITE` so the quote preview primes the same shop facts
- Tests: `Phase13Demos.test.tsx`, `quote.test.tsx` (new); `showcaseSections.test.ts`, `ComponentShowcasePage.test.tsx`, `ComponentShowcasePage.lazy.test.tsx`, `index.test.ts`, `QuoteFormPhotos.test.tsx` (extended)

## Decisions Made

See key-decisions. The R2 and R3 page parts (Notes card, Delete Request, Turn into Order, the already-converted box, the status menu) are not in the showcase: the UI-SPEC "Component Showcase additions" list does not name them, and they send real requests when used. They are covered by their own page tests and e2e. Owner item P13-23-1 below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] QuoteForm had no way to run without the network**
- **Found during:** Task 2
- **Issue:** QuoteForm takes no props and reads its ticket on mount, so any showcase case would send a request.
- **Fix:** an optional `service` prop (default the real `quoteService`), passed to `useQuoteTicket` and to `sendWithPhotos`/`uploadPhotos`. Nothing changes for visitors.
- **Files modified:** `QuoteForm.tsx`, `useQuoteTicket.ts`, `quotePhotoUpload.ts`, `QuoteFormPhotos.test.tsx` (new test)
- **Verification:** the new test (ticket, create and upload go through the given service, no quote request on the network); every existing QuoteForm, hook and upload test passes.
- **Committed in:** `b517a0b2`, `09fdb93e`

**2. [Rule 3 - Blocking] Files outside files_modified**
- `ComponentShowcasePage.tsx` (on-request list), its two test files (section order, placement, lazy load), `PublicShell.tsx` (export `PARITY_SITE`), `QuoteFormPhotos.test.tsx`. Each was needed to place, test or prime the new cases.

**3. [Plan shape] Two acceptance greps do not match as written**
- `grep -c "Phase13" showcaseSections.ts` is 0: the section entry is `{ id: 'quotes', title: 'Quote requests', groups: ['quote'] }`, and the link to `Phase13Demos` lives in `ShowcaseDemos.tsx` `EXTRA_CASES` (5 matches), the same place the Phase 11 demos are wired. Proven by `showcaseSections.test.ts` and `ComponentShowcasePage.test.tsx`.
- `grep -c "quote" web/src/dev/scenarios/index.ts` is 0: `index.ts` finds every group file by glob, so no edit was needed. Proven by `index.test.ts` "registers the quote group".

**4. [Plan shape] "The dev public page"**
- The quote scenarios show in the showcase and on the parity page (`/parity.html?group=quote`), as the Phase 12 legal notice did; `/dev/public` keeps its field column for the focus e2e. Owner item P13-23-2.

---

**Total deviations:** 4 (2 blocking, 2 plan shape). **Impact:** one small production seam (an optional prop); no behavior change and no budget raised.

## TDD Gate Compliance

- **Task 1 RED (`d63ec77e`):** `showcaseSections.test.ts` failed on the section list (expected "Quote requests" last) and on the missing `quotes` section; `ComponentShowcasePage.lazy.test.tsx` failed: no "Show the Quote requests cases" button. `Phase13Demos.test.tsx` failed to load ("Failed to resolve import ./Phase13Demos"): a load failure, not an assertion, so the RED proof for Task 1 rests on the two assertion failures. GREEN `5b8c36f8`: 24 of 24.
- **Task 2 RED (`b517a0b2`):** `index.test.ts` failed (expected the eight ids, got `[]`); `showcaseSections.test.ts` failed (expected `['quote']`, got `[]`); the new `QuoteFormPhotos.test.tsx` case failed (no "Inquiry sent"; the ticket went to the network). `quote.test.tsx` could not load `./quote` yet (load failure). GREEN `09fdb93e`: 25 of 25 in `quote.test.tsx`.
- The machine RED classifier (`gsd_run check tdd-red-evidence`) was not available in this worktree; the assessment above is from the actual runs.

## Test Evidence (seen in this worktree)

- `npx vitest run src/modules/public src/test src/dev src/modules/admin/components/showcase src/modules/admin/pages/ComponentShowcasePage.test.tsx src/modules/admin/pages/ComponentShowcasePage.lazy.test.tsx src/components/navigation`: **95 files, 2119 tests passed** (includes no-long-dash, source-layout and build-output on a fresh build).
- `npx vitest run visual scripts`: **41 files, 1492 tests passed**.
- `npm run typecheck`: no errors. `npm run lint` (`--max-warnings 0`): clean. `npx prettier --check .`: all files formatted.
- `npm run build:budget`: every row ok, no limit raised. Before / after: Quote form 44.47 / 44.39 KB of 45; contact 148.22 / 148.32 KB of 150; privacy 149.09 / 149.10; home 146.61 / 146.63; admin JS 225.98 / 226.10 KB of 250. The small public growth comes from the bundler moving modules the Contact page and the quote form share into a common chunk, because the showcase now loads the form too.
- `npm run parity -- --grep "@quote "`: **8 passed** (chromium 320, 390, 820, 1440; firefox and webkit 390 and 1440), with the console, page-error, CSP and failed-request guards on. A throwaway chromium check (deleted after) confirmed each of the eight states is reached in a real browser.
- Preflight before the Playwright runs: ports 5180, 5115, 7028, 5199 free; no dev or test processes listed. No dev server, e2e host or browser left running.
- Flake: `QuoteFormPhotos.test.tsx` "loads the picker when photos are chosen" failed once in a 36-file run; alone 24 of 24, the same 36 files again 725 of 725. Recorded in `deferred-items.md`.

## Issues Encountered

- The vitest module cache (`web/node_modules/.vitest-cache`) kept the old glob result for `src/dev/kit.ts`, so the new preview showed as "Missing component" until the folder was deleted. Recorded in `deferred-items.md`; a checkout with an old cache may need the same after merge.
- The worktree had no `web/node_modules`: `npm ci --ignore-scripts` ran in `web/` and `tools/openapi-gen/` (locked packages only, nothing added or changed).

## Owner Items

- **P13-23-1 R2 and R3 parts in the showcase.** A (built): the showcase holds the UI-SPEC list only; the request page parts (Notes card, Delete Request, Turn into Order, already-converted box, status menu) are reviewed on the real pages. B (alternative): add read-only showcase cases for them in a follow-up, with their actions disabled so nothing is sent.
- **P13-23-2 Where the form states show.** A (built): in the showcase's Quote requests section and on the parity page; three states that move focus show behind "Show this example". B (alternative): also add them to `/dev/public`.
- **P13-23-3 Public bundle cost of showing the real form.** A (built): the showcase renders the real QuoteForm, which costs about +0.10 KB on the Contact page (148.32 of 150 KB) and saves 0.08 KB on the quote form piece. B (alternative): keep the form states on the parity page only and out of the production showcase, which removes that cost.

## Known Stubs

None.

## Threat Flags

None. T-13-66: all new code under `web/src/dev` stays dev-only (the existing D-20 guard; build-output tests pass), and all demo data is made up. T-13-SC: no package added or bumped.

## User Setup Required

None.

## Next Phase Readiness

Ready for 13-24. 13-24 may add a `@showcase` e2e case for the Quote requests section like `@site-content-showcase`.

## Self-Check: PASSED

- The five created files exist on disk.
- Commits `d63ec77e`, `5b8c36f8`, `b517a0b2` and `09fdb93e` are on this branch.

---
*Phase: 13-quote-inquiries*
*Completed: 2026-11-24*

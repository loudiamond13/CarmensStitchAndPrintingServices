---
phase: 13-quote-inquiries
plan: 15
subsystem: admin-quote-inbox
status: complete
tags: [quote-requests, staff-inbox, react, tanstack-query, nuqs, url-state, a11y, tdd]
created: "2026-11-23T11:35:00-06:00"
updated: "2026-11-23T11:35:00-06:00"

requires:
  - phase: 13-quote-inquiries
    provides: "GET /api/v1/quote-requests and /new-count with pill counts (plan 13-11)"
provides:
  - "quoteRequestsService list(params, signal) and newCount(signal)"
  - "useQuoteRequestsListParams (status, q, page, size in the URL) and useQuoteRequestsQuery (key ['quote-requests', 'list', params], 60 s refresh, refetch on every focus)"
  - "QuoteRequestsPage (R1) at /admin/quote-requests, lazy, both roles"
  - "QuoteRequestsTable with the exported QuoteStatusBadge; QuoteStatusFilter pills with roving focus"
  - "quoteStatus.ts (QUOTE_STATUS_TONE, labels), quoteRequestsCopy.ts, quoteRequests.recipe.ts"
  - "icon 'inbox' in icons.ts (D-29)"
  - "e2e helper createQuoteRequest(request, input) and web/e2e/quote-inbox.spec.ts"
affects: [13-16, 13-17, 13-19, 13-24]

actuals:
  tokens: 20600
  tasks: 3
  commits: 6
plan_head_before: 8ff68a31280dd639d52646d5889332605ebb6d20
plan_head_after: 43022aa17b326bfcba9db3efe9b65d2ed8dff7ae

tech-stack:
  added: []
  patterns:
    - "A list page that owns its own empty states renders ResponsiveTable only while there are rows or a load is running"
    - "New-arrival line: compare the New ids of a fresh answer with the last answer for the same view, adjusted during render"
    - "A nuqs Back test runs on createBrowserRouter, since nuqs writes the browser history"

key-files:
  created:
    - web/src/modules/admin/pages/QuoteRequestsPage.tsx
    - web/src/modules/admin/pages/QuoteRequestsPage.test.tsx
    - web/src/modules/admin/components/QuoteRequestsTable.tsx
    - web/src/modules/admin/components/QuoteStatusFilter.tsx
    - web/src/modules/admin/components/QuoteStatusFilter.test.tsx
    - web/src/modules/admin/components/quoteRequests.recipe.ts
    - web/src/modules/admin/services/quoteRequestsService.ts
    - web/src/modules/admin/services/quoteRequestsService.test.ts
    - web/src/modules/admin/hooks/useQuoteRequestsListParams.ts
    - web/src/modules/admin/hooks/useQuoteRequestsQuery.ts
    - web/src/modules/admin/quoteRequestsCopy.ts
    - web/src/modules/admin/quoteStatus.ts
    - web/src/modules/admin/quoteStatus.test.ts
    - web/src/test/quoteRequestFixtures.ts
    - web/e2e/quote-inbox.spec.ts
  modified:
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/src/components/brand/icons.ts
    - web/src/components/brand/Icon.test.tsx
    - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
    - web/e2e/testing-api.ts

key-decisions:
  - "Refetch on every window focus (refetchOnWindowFocus 'always'), not only when 30 s stale, because R1 says the list reads again when the window regains focus"
  - "The stale line uses the P10 D-111 words unchanged: 'Showing figures from {time}. Couldn't refresh.'"
  - "Every pill's empty state uses the inbox icon (D-29 names it for the empty state)"

requirements-completed: [INQ-05]

coverage:
  - id: D1
    description: "Staff of both roles open /admin/quote-requests and see the open requests newest first with the seven columns"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/QuoteRequestsPage.test.tsx#the inbox opens on the open requests, newest first"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/routes.test.tsx#Quote Requests for both roles"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-inbox.spec.ts#@quote staff see a new request in Quote Requests (chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Status pills and search filter the inbox; status, q and page live in the URL; Back restores them"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/QuoteStatusFilter.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/QuoteRequestsPage.test.tsx#the status pills and the search filter the inbox"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/routes.test.tsx#list to request to Back restores the pill, the search and the rows"
        status: pass
    human_judgment: false
  - id: D3
    description: "Empty, loading, error, stale, Photos and refresh states; 320px cards with no sideways scroll and zero axe violations"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/QuoteRequestsPage.test.tsx#the empty, loading, error and refresh states"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-inbox.spec.ts#@quote at 320px the inbox shows cards (chromium)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The look of the pills, the table and the phone cards in Blush and Espresso"
    verification: []
    human_judgment: true
    rationale: "Visual fit against the UI spec and the phone card order (see Owner items) needs the owner's UI review."

duration: 54min
completed: 2026-11-23
---

# Phase 13 Plan 15: Staff open the Quote Requests inbox and find any request Summary

**The R1 Quote Requests inbox at /admin/quote-requests: open requests newest first in a seven-column table (cards on phones), status pills with server counts and roving focus, a debounced search with its chip, all in the URL, plus every empty, loading, error, stale and refresh state.**

*Created: 2026-11-23T11:35:00-06:00 · Updated: 2026-11-23T11:35:00-06:00*

## Performance

- **Duration:** about 54 min
- **Started:** 2026-11-23T16:39:55Z
- **Completed:** 2026-11-23T17:33:45Z
- **Tasks:** 3 of 3
- **Files:** 21 changed (15 created, 6 modified)

## Accomplishments

- `quoteRequestsService` (`list`, `newCount`), `useQuoteRequestsListParams` (status allow-list with `open` as the default, kept out of the URL) and `useQuoteRequestsQuery` (refresh every 60 s while visible, refetch on every focus).
- `QuoteRequestsPage` with the page head, the "Search requests" box, the "Show" pills, "Showing {n} requests" with the "Search: {q}" chip, the table and Pagination. The document title is the fixed "Quote Requests · CSPS Admin".
- `QuoteRequestsTable`: Received (date over time, Manila), Name (link to `/admin/quote-requests/{id}`, team under it), Phone, Product ("Custom design", "Not sure yet" or the line title), Pieces ("21-50 pcs"), Photos ("3", warning icon with "2 of 3" and hidden "photos arrived", the empty value, "Removed"), Status (badge with dot and word).
- `QuoteStatusFilter`: five 44px pills, maroon selected pill with `aria-pressed`, one tab stop, arrows wrap, Home and End, Enter or Space; no counts until the first answer.
- States: per-pill empty words with the inbox icon; search empty with Clear Search; 5 skeleton rows in a busy region; ErrorState "Couldn't load the quote requests." with Try Again; a failed later refresh keeps the rows and shows the stale line; a hidden polite line "1 new quote request." when a refresh brings New requests for the same view; focus never moves.
- Route `quote-requests` (lazy, under the URL-state layout, no Manager loader), and `inbox` in `icons.ts` from the installed lucide-react.
- e2e helper `createQuoteRequest` (ticket, wait past the minimum time, create with a fresh Idempotency-Key, optional photo uploads) and two `@quote` cases.

## Task Commits

1. **Task 1 (tracer): open the inbox and see the newest open request**
   - RED `ba75febc`, GREEN `6bfc5746`
2. **Task 2: status pills and search, kept in the URL**
   - RED `1737f491`, GREEN `43978561`
3. **Task 3: empty, loading, error and refresh states**
   - RED `bca240dd`, GREEN `43022aa1`

No REFACTOR commit was needed.

## TDD record

- **Task 1 RED** `ba75febc`: 26 of 239 failed. All were assertion failures: the stub page rendered nothing, the stub service rejected "not built", the stub status maps were empty, the route was missing (the splat not-found page showed) and `ICONS.inbox` was undefined. `gsd-tools check tdd-red-evidence` on the target `quoteRequestsService.list > calls GET /api/v1/quote-requests with status, q, page and size` gave `RED_EVIDENCE_OK`. Vitest's TAP report is malformed when a message has more than one line, so the page target could not be classified from TAP. Semantic assessment: valid RED. GREEN: 264 of 264 passed (7 files). Tracer gate: `npm run e2e -- --grep "@quote" --project chromium` gave 9 passed, then expansion went ahead.
- **Task 2 RED** `1737f491`: 15 failed. The JUnit report of the target `QuoteStatusFilter > is a toolbar named "Show"...` gave `RED_EVIDENCE_OK`. Three cases passed before GREEN, as expected: the allow-list reset (the hook was built in Task 1) and two axe cases on a page with no pills yet. GREEN: 106 of 106 (filter, page and routes files).
- **Task 3 RED** `bca240dd`: 12 of 29 failed. The JUnit target `Open with no requests shows the inbox empty state with no button` gave `RED_EVIDENCE_OK`; the table drew its own generic "No requests yet" state. Two cases passed before GREEN: the 5-row skeleton (`skeletonRows` was set in Task 1) and "a filter change is not news". GREEN: 29 of 29.

## Verification evidence

- Page, filter, routes, service, status, Icon, brand and showcase tests: all passed. Last runs: page 29 of 29; filter, page and routes 106 of 106; Task 1 set 264 of 264.
- `src/test/build-output.node.test.ts`, `no-long-dash.node.test.ts`, `source-layout.node.test.ts` after a fresh `NODE_ENV=production vite build`: 37 of 37.
- `npm run typecheck`: exit 0. `npm run lint` (whole project, `--max-warnings 0`): exit 0. Prettier check on `src` and `e2e`: clean.
- `npm run e2e -- --grep "@quote" --project chromium` (after Task 3): 10 passed (1.2 m). That includes the 13-14 quote-form cases in this worktree.
- Bundle budget (the e2e run's budget table): admin JS 223.72 KB of 250 KB, CSS 20.50 KB of 35 KB, Quote form 44.23 KB of 45 KB. `npm run build:budget`: every public page was at or under 150 KB.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Icon count tests outside files_modified**
- **Found during:** Task 1
- **Issue:** `Icon.test.tsx` lists the owner icon names and `ComponentShowcasePage.test.tsx` counts every icon (73), so adding `inbox` needed both.
- **Fix:** added `inbox` with a lucide `Inbox` check, and changed 73 to 74.
- **Commits:** ba75febc

**2. [Rule 3 - Blocking] A shared test fixture outside files_modified**
- **Issue:** the page test and the routes test need the same list rows and the same MSW backend.
- **Fix:** new `web/src/test/quoteRequestFixtures.ts`, with fake names and numbers only.
- **Commit:** ba75febc

**3. [Rule 3 - Blocking] The Back case needs a browser router**
- **Issue:** with `createMemoryRouter`, nuqs read the default status after Back, because nuqs works on the browser history (docs/web/url-state.md).
- **Fix:** that case runs on `createBrowserRouter` and puts the address back afterwards.
- **Commit:** 43978561

**4. [Rule 1 - Bug] The hidden pill and photo words lost their space in the accessible name**
- **Fix:** the space sits before the hidden span (the Gallery pattern), and the copy is `requests` and `photos arrived` with no leading space.
- **Commits:** 43978561, 43022aa1

**5. [Rule 1 - Test bugs fixed in GREEN]** These were mistakes in the RED tests, not in the behavior they check: a default parameter swallowed `undefined` (now `null`); `QueryCache.find` is exact by default (now `exact: false`); the refresh options are read from the page's observer, because `query.options` has no `refetchInterval` type; the hidden class is compared with `srOnlyClasses`, not `sr-only`.

**6. [Plan shape]** `quoteRequests.recipe.ts` and the full `quoteRequestsCopy.ts` were created in Task 1, which needed the table looks. The plan lists them under Task 2.

**7. [Acceptance grep]** `grep -c "'inbox'" icons.ts` needs a quoted key, but Prettier writes the key as `inbox:`. The header comment now names `'inbox'`, so the grep finds 1.

**Total deviations:** 7 (3 blocking, 2 bug, 2 plan or acceptance shape). **Impact:** no scope added. Three files outside files_modified: `web/src/test/quoteRequestFixtures.ts` (new), `web/src/components/brand/Icon.test.tsx` and `web/src/modules/admin/pages/ComponentShowcasePage.test.tsx`. OpenAPI and `api.generated.ts` were not touched; every type needed was already there.

## Owner items

1. **Phone card order.** A (built): the shared ResponsiveTable card. The name is the card title, then each column with its label in table order (Received, Phone, Product, Pieces, Photos, Status). B: a custom card in the UI-SPEC order: name and status badge on one line, the team, "Received {Nov 21, 3:42 PM}", product and pieces, then photos.
2. **Stale line wording.** A (built): the P10 words unchanged, "Showing figures from 9:41 AM. Couldn't refresh." B: "Showing requests from 9:41 AM. Couldn't refresh."
3. **Hidden pill words for one.** A (built): the spec text as written, so a screen reader says "Spam 1 requests". B: "1 request" for exactly one.
4. **Refresh on focus.** A (built): every time the window regains focus. B: only when the last read is over 30 seconds old (the app default), which sends fewer reads.
5. **Name link color.** A (built): ink color, underlined on hover, because orange is kept for links inside text. B: the orange link color used for order numbers.
6. **Empty state icon on the other pills.** A (built): the inbox icon on every pill. B: the inbox icon on Open only, and no icon on the others.

## Flakes

- `src/test/no-long-dash.node.test.ts` ran past its 5 s limit (5210 ms) in a 12-file run while other executors were using the machine. Run alone it passed in 2.8 s, and it passed again in the final run (37 of 37).

## Known Stubs

None. `photosRemoved` comes from the server. 13-11 noted that it is always `false` until 13-16 adds the column, so "Removed" shows only after 13-16.

## Threat Flags

None. Visitor text is rendered as React text only (T-13-43). The title is fixed and personal data appears only in `q` (T-13-44); the e2e checks that the name is not in the title. No package was added or bumped (T-13-SC). `web/node_modules` in the worktree is a git-ignored junction to the main checkout's installed packages (same lockfile).

## Next

Ready for 13-16 (Spam photo removal), 13-17 (nav item and New count, using `newCount`) and 13-19 (the request page; `QuoteStatusBadge` is exported from `QuoteRequestsTable.tsx`).

## Self-Check: PASSED

- Commits on the branch: ba75febc, 6bfc5746, 1737f491, 43978561, bca240dd, 43022aa1.
- Files exist: QuoteRequestsPage.tsx, quoteRequestFixtures.ts, quote-inbox.spec.ts and the rest of key-files.

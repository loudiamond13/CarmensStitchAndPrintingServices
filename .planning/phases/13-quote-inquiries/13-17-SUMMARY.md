---
phase: 13-quote-inquiries
plan: 17
subsystem: admin-quote-nav-count
status: complete
tags: [quote-requests, nav-badge, tab-bar, dashboard, tanstack-query, a11y, tdd]
created: "2026-11-23T13:40:00-06:00"
updated: "2026-11-23T13:40:00-06:00"

requires:
  - phase: 13-quote-inquiries
    provides: "GET /api/v1/quote-requests/new-count (plan 13-11); quoteRequestsService.newCount and the inbox page (plan 13-15)"
provides:
  - "useNewQuoteCountQuery with NEW_QUOTE_COUNT_KEY ['quote-requests', 'new-count'] and shownNewQuoteCount (no number after a failed read)"
  - "QUOTE_REQUESTS_NAV_ITEM after Orders; AdminSection 'quotes'; Sidebar withQuoteRequests and counts props; formatNavCount and navCountName"
  - "TabBar withQuotes (fifth Quotes tab) and counts; AdminFrame withQuoteRequests and counts"
  - "QuoteRequestsStrip under the MoneyStrip on the dashboard; DASHBOARD_COPY.quotes"
  - "test fixture newQuoteCountHandler and a default New count of 0 in the test setup"
  - "web/e2e/quote-nav.spec.ts (three @quote cases)"
affects: [13-19, 13-21, 13-22, 13-23, 13-24]

actuals:
  tokens: 21070
  tasks: 3
  commits: 7
plan_head_before: f3aaeb4e4ec0df78c39b8bffa751e870d06df6ae
plan_head_after: b126a42195f668758bfe3d9b82da009f9ec59434

tech-stack:
  added: []
  patterns:
    - "A counted nav item takes its name from one visually hidden span holding the whole name, so no browser adds a space before the comma"
    - "New nav items and tabs sit behind a flag the real shell sets, so the App. D.3 and E.6 parity scenarios stay equal"
    - "A strip whose query keeps polling after a failure keeps its alert mounted during re-reads, so it is never read out twice"

key-files:
  created:
    - web/src/modules/admin/hooks/useNewQuoteCountQuery.ts
    - web/src/modules/admin/hooks/useNewQuoteCountQuery.test.tsx
    - web/src/modules/admin/components/TabBar.test.tsx
    - web/src/modules/admin/components/QuoteRequestsStrip.tsx
    - web/src/modules/admin/components/QuoteRequestsStrip.test.tsx
    - web/e2e/quote-nav.spec.ts
  modified:
    - web/src/components/navigation/Sidebar.tsx
    - web/src/components/navigation/Sidebar.test.tsx
    - web/src/components/navigation/navItem.recipe.ts
    - web/src/components/navigation/index.ts
    - web/src/components/navigation/MobileNavDrawer.test.tsx
    - web/src/components/index.test.ts
    - web/src/layouts/AdminLayout.tsx
    - web/src/layouts/AdminLayout.test.tsx
    - web/src/modules/admin/sections.ts
    - web/src/modules/admin/sections.test.ts
    - web/src/modules/admin/components/TabBar.tsx
    - web/src/modules/admin/components/admin.recipe.ts
    - web/src/modules/admin/pages/DashboardPage.tsx
    - web/src/modules/admin/pages/DashboardPage.test.tsx
    - web/src/modules/admin/dashboardCopy.ts
    - web/src/test/setup.ts
    - web/src/test/quoteRequestFixtures.ts

key-decisions:
  - "The New count keeps reading every 60 s and on focus after a failed read (no chip meanwhile), unlike the inbox list, so the badge comes back by itself; the shell has no Try Again"
  - "The hidden name says what the chip says: 'Quote Requests, 99+ new' above 99"
  - "The shell reads the count only while someone is signed in, so the dev routes never send a request that would 401 and sign out"
  - "The Quote Requests item and the Quotes tab are behind withQuoteRequests and withQuotes, set by the real shell only, so the parity scenarios keep App. D.3 and App. E.6"

requirements-completed: [INQ-05]

coverage:
  - id: D1
    description: "Quote Requests sits right after Orders in the sidebar and the phone drawer for both roles, with the inbox icon; the inbox and every request page mark it current"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/components/navigation/Sidebar.test.tsx#Sidebar Quote Requests item and New count (D-14, D-19)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/sections.test.ts#finds the Quote Requests item for the inbox and every request page under it (D-19)"
        status: pass
      - kind: unit
        ref: "web/src/components/navigation/MobileNavDrawer.test.tsx#MobileNavDrawer Quote Requests count (D-14, D-19)"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-nav.spec.ts#@quote the nav shows the new count (chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Above 0 the chip shows the server's New count ('99+' above 99) and the name reads 'Quote Requests, 3 new'; at 0 or before the read or after a failed read there is no chip, no dot and no hidden text; the collapsed sidebar and the tablet rail show a 10px dot"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/components/navigation/Sidebar.test.tsx#Sidebar Quote Requests item and New count (D-14, D-19)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useNewQuoteCountQuery.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/layouts/AdminLayout.test.tsx#AdminLayout Quote Requests count (D-14, D-19)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phones get a fifth Quotes tab after Orders with the same chip and name; at 320px the five tabs are equal, at least 44px, no label is cut and nothing scrolls sideways"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/TabBar.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-nav.spec.ts#@quote at 320px the five tabs share the bar, nothing scrolls sideways and axe finds nothing (chromium)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The dashboard strip under the MoneyStrip: inbox tile, 'New quote requests' over the count (dimmed at 0), 'Open Quote Requests'; 24px skeleton while loading; 'Couldn't load the new requests.' with Try Again on a failure"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/QuoteRequestsStrip.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/DashboardPage.test.tsx#the quote requests strip on the page (D-19, UI-SPEC R4)"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-nav.spec.ts#@quote the dashboard strip shows the new count under the money strip and opens the inbox (chromium)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The look of the chip, the rail dot, the tab chip at the icon and the strip in Blush and Espresso"
    verification: []
    human_judgment: true
    rationale: "Placement of the tab chip and the dot and the fit with the shell need the owner's UI review."

duration: 61min
completed: 2026-11-23
---

# Phase 13 Plan 17: Staff see how many new quote requests are waiting, on every screen Summary

**The server's New quote request count on a Quote Requests nav item after Orders (sidebar, drawer, collapsed rail dot), on a fifth "Quotes" phone tab, and in a dashboard strip under the money strip, all from one shared query that reads every 60 seconds and never shows a stale or made-up number.**

*Created: 2026-11-23T13:40:00-06:00 · Updated: 2026-11-23T13:40:00-06:00*

## Performance

- **Duration:** about 61 min
- **Started:** 2026-11-23T18:38:53Z
- **Completed:** 2026-11-23T19:39:23Z
- **Tasks:** 3 of 3
- **Files:** 23 changed (6 created, 17 modified)

## Accomplishments

- `useNewQuoteCountQuery` (key `['quote-requests', 'new-count']`, exported as `NEW_QUOTE_COUNT_KEY`): reads with the shell, every 60 s while visible and on every window focus. A count that is not a whole number fails the read. `shownNewQuoteCount` gives nothing after a failed read, never the last good number. Plans 13-19, 13-21 and 13-22 can invalidate `['quote-requests']` after a status change, delete or conversion.
- `QUOTE_REQUESTS_NAV_ITEM` (`// SPEC-DEVIATION: D-19`) after Orders for both roles, with the inbox icon. `sections.ts` marks `/admin/quote-requests` and `/admin/quote-requests/{id}` current.
- Sidebar `counts`: the NavCount chip (the `tabCountClasses` geometry, 600, accent ground, on-accent text, "99+" above 99) at the row's end; a 10px accent dot with a 2px nav-ground ring at the icon's top right on the collapsed sidebar and the tablet rail; the name "Quote Requests, 3 new" in all three layouts. At 0 there is no chip, no dot and no hidden text.
- TabBar `withQuotes`: Dashboard, Orders, Quotes (inbox 22), Expenses, Profile in five equal columns, with the chip at the icon and the name "Quotes, 3 new".
- AdminLayout reads the count only while someone is signed in and passes it to the side column, the drawer's Sidebar and the tab bar.
- `QuoteRequestsStrip` (`// SPEC-GAP: quote requests strip`) directly under the MoneyStrip: the 32px inbox tile (hidden on phones), "New quote requests" over the count in the strip figure look (dimmed at 0), secondary "Open Quote Requests" (its own row on phones). Loading: a 24px skeleton in the LoadingRegion "the new quote requests". Failed: "Couldn't load the new requests." with ghost sm "Try Again"; the link still works.

## Task Commits

1. **Task 1 (tracer): the sidebar shows Quote Requests with the New count**
   - RED `baae3178`, GREEN `343872a8`, fix `13caab09` (found by the tracer e2e, see Deviations 1)
2. **Task 2: the drawer, the collapsed rail and a fifth phone tab**
   - RED `ad3031c0`, GREEN `e088e470`
3. **Task 3: the dashboard strip**
   - RED `d77f8411`, GREEN `b126a421`

No REFACTOR commit was needed.

## TDD record

- **Task 1 RED** `baae3178`: 22 of 243 failed, all on assertions with stubs in place (an empty nav item, empty recipe classes, a hook stub with no data). JUnit target `Sidebar Quote Requests item and New count (D-14, D-19) > shows the New count chip and names the item "Quote Requests, 3 new"` gave `RED_EVIDENCE_OK` (the first try with the short test name gave `INVALID_RED no_target_test_failure`; the qualified name matched). Semantic assessment: valid RED, the item and chip did not exist. Three axe cases passed before GREEN, as expected for an empty item. GREEN: 243 of 243.
- **Tracer gate:** the first `npm run e2e -- --grep "@quote" --project chromium` failed: Chromium named the link "Quote Requests , 5 new". Fixed (`13caab09`) and re-run: 12 passed. Then expansion went ahead.
- **Task 2 RED** `ad3031c0`: 12 of 188 failed on assertions (four tabs, no Quotes tab). JUnit target `TabBar (App. E.6, D-30) > shows the New count chip at the icon and names the tab "Quotes, 3 new"` gave `RED_EVIDENCE_OK`. The four drawer cases passed before GREEN: Task 1 already passed the count to the drawer's Sidebar, so they pin that behavior. GREEN: 189 of 189.
- **Task 3 RED** `d77f8411`: 14 of 57 failed (the stub strip drew nothing). JUnit target `QuoteRequestsStrip (D-19, UI-SPEC R4) > with 3 shows the inbox tile, the label over the figure and the link to the inbox` gave `RED_EVIDENCE_OK`. The copy case passed before GREEN (the copy was added with the tests). GREEN: 58 of 58 (with `no-long-dash.node.test.ts`).

## Verification evidence

- Plan checks: `Sidebar.test.tsx`, `useNewQuoteCountQuery.test.tsx`, `index.test.ts`, `sections.test.ts`, `AdminLayout.test.tsx`: 243 passed. `MobileNavDrawer`, `Sidebar`, `TabBar`, `AdminLayout`: 189 passed. `QuoteRequestsStrip`, `DashboardPage`, `no-long-dash`: 58 passed.
- `npm run e2e -- --grep "@quote" --project chromium` (last run, after Task 3): "14 passed (41.0s)". That includes the three new `quote-nav.spec.ts` cases and the 13-14 and 13-15 quote cases.
- `npm run typecheck`: exit 0. `npm run lint` (`eslint . --max-warnings 0`): exit 0. `npx prettier --check .`: "All matched files use Prettier code style!"
- Fresh production build (`NODE_ENV=production node node_modules/vite/bin/vite.js build`): exit 0, "built in 24.59s", no warnings.
- Whole web suite after that build (`npx vitest run`): "Test Files 2 failed | 445 passed (447)", "Tests 2 failed | 11922 passed (11924)". Both failures are known (see Flakes); `build-output.node.test.ts` passed.
- `npm run build:budget`: exit 0, every row ok. Public JS contact 148.19 KB of 150.00, privacy 149.09 of 150.00; admin JS 225.55 of 250.00 (was 223.73); Quote form 44.39 of 45.00; CSS 20.53 of 35.00. No limit changed.
- gitleaks ran in the pre-commit hook on every commit: "no leaks found". Test data uses made-up names and numbers only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Chromium put a space before the comma in the counted name**
- **Found during:** Task 1 tracer e2e
- **Issue:** the hidden ", 5 new" span is absolutely placed, so Chromium joined it with a space: "Quote Requests , 5 new". jsdom did not show this.
- **Fix:** a counted item is named by `aria-labelledby` pointing at one hidden span with the whole name ("Quote Requests, 5 new"). The tab uses the same pattern. A unit test now pins that the name comes from that one span.
- **Files:** `Sidebar.tsx`, `Sidebar.test.tsx`, `index.ts` (`navCountName` replaces the planned hidden suffix)
- **Commit:** 13caab09

**2. [Rule 3 - Blocking] The dev routes would sign out on the count read**
- **Issue:** `/dev/components` mounts the real AdminLayout with a placeholder user and no session. A count read there answers 401 and the client signs the tab out.
- **Fix:** the shell reads the count only while a session user exists. Test: "reads no count on the dev routes, where no one is signed in".
- **Commit:** 343872a8

**3. [Rule 3 - Blocking] Every test that mounts the shell now reads the count**
- **Fix:** the test setup answers `GET /quote-requests/new-count` with 0 for every test (`newQuoteCountHandler` in `quoteRequestFixtures.ts`), as it already does for the public reads. Tests that need another answer use `server.use`.
- **Commit:** baae3178

**4. [Plan shape] No `counts` prop on MobileNavDrawer**
- The drawer holds the Sidebar as its children, so the count reaches it through that Sidebar's `counts`, which AdminFrame passes. A drawer prop would do nothing. The drawer tests cover the item, the name and axe inside the drawer.

**5. [Plan shape] The new item and tab are behind flags**
- `Sidebar withQuoteRequests` and `TabBar withQuotes`, set only by the real shell, as the earlier My Money and Audit Log items are. Without them the dev previews keep App. D.3's five items and App. E.6's four tabs, so the parity suite stays equal. `tabBarColumnClasses` gives four or five columns.

**6. [Rule 1 - Test bug fixed in GREEN]** the hook test read only `data` before the failing refetch, and TanStack Query re-renders only for the result fields a test has read, so `isError` looked false. The test now reads the count the way the shell does (`shownNewQuoteCount`, which reads both).

**7. [Consistency with W6] The strip's failure line stays in place while a read runs again**
- The count keeps reading every 60 s after a failure, so a MoneyStrip-style swap to the skeleton during each read would mount the alert again and read it out every minute (the W6 WR-01 problem). Instead the alert stays and Try Again shows busy. No second live announcement was added: the nav count has no live region.

**8. [e2e shape]** the shared CSPS_E2E database holds New requests from earlier runs, so the e2e reads the count before and after it creates two requests and checks that the item shows the server's later answer, which is at least 2 higher.

**Total deviations:** 8 (1 bug, 2 blocking, 1 test bug, 4 plan or test shape). **Impact:** no scope added.

### Files outside files_modified

- `web/src/test/setup.ts` and `web/src/test/quoteRequestFixtures.ts` (the default count answer and its fixture)
- `web/src/modules/admin/sections.test.ts` (the two quote routes)
- `web/src/layouts/AdminLayout.test.tsx` (the shell count, the five tabs, the updated item and tab lists)
- `web/src/modules/admin/components/admin.recipe.ts` (five columns, the tab chip and icon box)
- `web/src/modules/admin/pages/DashboardPage.test.tsx` (the strip's place on the page)

OpenAPI and `api.generated.ts` were not touched; `NewQuoteCountResponse` was already there. No package was added or bumped.

## Owner items

1. **The hidden name above 99.** A (built): it says what the chip says, "Quote Requests, 99+ new". B: the exact count, "Quote Requests, 120 new".
2. **The count after a failed read.** A (built): it keeps reading every 60 seconds and on focus, with no chip meanwhile, so the badge comes back by itself. B: pause like the inbox list after a failure, until Try Again on the dashboard or a page reload.
3. **Tab width at 320px.** A (built): the bar keeps its 8px side padding, so each of the five tabs is about 61px (the spec says 64px; every tab is still a 44px target and no label is cut). B: drop the bar's side padding so each tab is exactly 64px.
4. **The strip while a read runs after a failure.** A (built): the failure line stays and Try Again shows busy, so the line is read out once. B: the MoneyStrip behavior, a skeleton during each read, which reads the line out again after every failed 60-second read.
5. **The strip figure for large counts.** A (built): the exact count ("1,250"). B: "99+" as on the chip.

## Flakes and known failures

- `QuoteForm.test.tsx` "shows the pending label Sending while the request runs" failed in the full web suite. Alone: 1 of 1, and the whole file 50 of 50. The same flake is recorded for plan 13-14.
- `scripts/license-policy.test.ts` "exits 1 on a stricter policy" fails in a fresh worktree ("No packages found in this path"), alone too. Known from 13-09, 13-12 and 13-14; it passes in the main checkout. Not caused by this plan.

## Known Stubs

None. The RED stubs were all replaced in their GREEN commits.

## Threat Flags

None. The count read is a number only, staff only (T-13-50: one shared query every 60 s while visible; the shell, the tab and the strip use one cache entry). A failed read shows no chip and the strip shows its failure line, never a stale number (T-13-51). No package was added or bumped (T-13-SC).

## Next

13-19 (the request page), 13-21 and 13-22 should invalidate `['quote-requests']` after a status change, delete or conversion so the count refreshes at once. 13-23 adds NavCount and the strip to the Component Showcase.

## Self-Check: PASSED

- Commits on the branch: baae3178, 343872a8, 13caab09, ad3031c0, e088e470, d77f8411, b126a421.
- Files exist: useNewQuoteCountQuery.ts, QuoteRequestsStrip.tsx, TabBar.test.tsx, quote-nav.spec.ts and the rest of key-files.

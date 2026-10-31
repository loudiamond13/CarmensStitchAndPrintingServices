---
phase: 08-order-screens
plan: 24
subsystem: testing
tags: [orders, e2e, playwright, sweep, journeys, boundaries, showcase, coverage, axe]
created: "2026-10-30T13:25:00-05:00"
updated: "2026-10-30T13:25:00-05:00"
status: complete

requires:
  - phase: 08-order-screens
    provides: "08-01 to 08-23: the order list, form, detail page, windows, status menu, delete and deleted view that this plan proves"
provides:
  - "Five @orders-journeys real-browser tests for the five Phase 8 success criteria, in all five browser projects"
  - "@orders-sweep: 16 order pages at 8 widths in both themes, plus the chips, tab strips, payment window, status menu, 100-item form, Deleted Orders count and unknown admin address"
  - "orders-boundaries node test: no staff-only figures in the public site, no raw HTML in order files, no device clock in the order pages and windows"
  - "Orders section in the Component Showcase (Phase8Demos) on demo data"
  - "Four overflow fixes the sweep found, and web branch coverage back over the 90 percent gate"
affects: [phase-8-verification, phase-8-ui-review, ship]

actuals:
  tokens: 32300
  tasks: 3
  commits: 7
plan_head_before: 5118c1826f19e5ae64c30bce55334fbf18e7ace4
plan_head_after: eb988b6f18eb8fd5c158ca455ccd74a6aabd87d7

tech-stack:
  added: []
  patterns:
    - "A sweep reads text cut short by hidden overflow and the elements that widen the page, so a failure names the element"
    - "inStrictMode(body) draws a screen under StrictMode so the React Compiler's cached branch is measured"
    - "An e2e that must leave a page by URL goes by an in-app link, so a hard navigation cannot cut a list read short"

key-files:
  created:
    - web/e2e/orders-journeys.spec.ts
    - web/e2e/orders-sweep.spec.ts
    - web/src/test/orders-boundaries.node.test.ts
    - web/src/test/strictMode.ts
    - web/src/modules/admin/components/showcase/Phase8Demos.tsx
    - web/src/modules/admin/components/showcase/Phase8Demos.test.tsx
  modified:
    - web/e2e/sweep.ts
    - web/e2e/showcase.spec.ts
    - web/src/components/money/money.recipe.ts
    - web/src/components/money/OrderTotals.tsx
    - web/src/components/data/data.recipe.ts
    - web/src/modules/admin/components/orderPage.recipe.ts
    - web/src/modules/admin/components/OrderHeader.tsx
    - web/src/modules/admin/pages/DeletedOrderPage.tsx
    - web/src/modules/admin/components/showcase/showcaseSections.ts
    - web/src/modules/admin/components/showcase/showcaseCopy.ts
    - web/src/modules/admin/components/showcase/showcase.recipe.ts
    - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
    - web/scripts/owner-review.mjs
    - web/scripts/design-side-by-side.mjs
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The sweep runs in all five projects with axe at three widths per page and scroll and cut-text checks at all eight, so the slowest project (iphone) takes about 15 minutes"
  - "The status menu showcase demo is drawn static (no pop-in, no real menu) because the real menu sends moves and the page-wide opacity rule would see its animation"
  - "A fix found by the sweep goes in the shared recipe that owns the look, with a red recipe or component test first"
  - "The pre-existing e2e failures are recorded, not fixed here: they fail the same way at the commit before this plan"

patterns-established:
  - "Seed with createOrder at the rule limits (100-character names, 200-character text, 2,000-character note, 99,999,999.99 total) to prove long text and big figures"
  - "Collect findings in a list and assert it equals [] so one run shows every width and theme that fails"

requirements-completed: [ORD-01, ORD-02, ORD-06, ORD-07, ORD-10, ORD-11, ORD-12, ORD-15, ORD-19]

coverage:
  - id: D1
    description: "SC1 find: search by phone, Delivered and has-balance filters, sort by balance, paging, the Table view kept across a reload, a Fully Paid order and an overdue flag"
    requirement: ORD-02
    verification:
      - kind: e2e
        ref: "web/e2e/orders-journeys.spec.ts#@orders-journeys SC1 find (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SC2 create: the New Order form saves and lands on the order with the server total, and leaving a dirty form asks Discard changes?"
    requirement: ORD-15
    verification:
      - kind: e2e
        ref: "web/e2e/orders-journeys.spec.ts#@orders-journeys SC2 create (5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SC3 work: item, payment, discount and expense saves each leave the panel equal to the server answer, a stale edit shows the 409 banner and keeps typed values, Received by, Paid by and Recorded by show"
    requirement: ORD-07
    verification:
      - kind: e2e
        ref: "web/e2e/orders-journeys.spec.ts#@orders-journeys SC3 work (5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "SC4 internal figures: Order Expenses and Estimated Profit show on the order page for a Manager and an Admin and nowhere else; the node guard fails on them in public files"
    requirement: ORD-19
    verification:
      - kind: e2e
        ref: "web/e2e/orders-journeys.spec.ts#@orders-journeys SC4 internal figures (5 projects)"
        status: pass
      - kind: unit
        ref: "web/src/test/orders-boundaries.node.test.ts#ORD-19 the public site never shows Estimated Profit or Order Expenses"
        status: pass
    human_judgment: false
  - id: D5
    description: "SC5 delete safely: the soft delete shows its counts, a Manager restores it, deletes it again and deletes it for good by typing the number"
    requirement: ORD-06
    verification:
      - kind: e2e
        ref: "web/e2e/orders-journeys.spec.ts#@orders-journeys SC5 delete safely (5 projects)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every order screen fits 320 to 1920 px in both themes with long names, long text and huge amounts, with no text cut short and axe clean (UIC-61 to UIC-66, UIC-68 to UIC-70, UIC-74)"
    requirement: ORD-01
    verification:
      - kind: e2e
        ref: "web/e2e/orders-sweep.spec.ts#@orders-sweep (24 tests, 5 projects)"
        status: pass
    human_judgment: false
  - id: D7
    description: "No order flow puts a 200-character text in a toast, so the toast part of UIC-67 has nothing to prove; the owner reviews the look in Blush and Espresso (UIC-71, Delivered tone, APX-IN-01 audit line)"
    verification: []
    human_judgment: true
    rationale: "A screenshot review and a browser prompt (beforeunload) cannot be asserted by a test; the owner decides the Delivered tone and the audit line detail"
  - id: D8
    description: "The Component Showcase gains an Orders section on demo data: totals in every balance state, cards, due flags, badges, the status menu with Mark Completed off, banners and the two delete dialogs, with no request"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/showcase/Phase8Demos.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/showcase.spec.ts#@showcase a Manager opens /admin/components"
        status: pass
    human_judgment: false
  - id: D9
    description: "The server and web gates: dotnet test --solution Csps.slnx, the coverage gate and npm run verify pass"
    verification:
      - kind: other
        ref: "dotnet test --solution Csps.slnx; tools/scripts/Invoke-CoverageGate.ps1; npm --prefix web run verify"
        status: pass
    human_judgment: false
  - id: D10
    description: "The full npm run e2e is green"
    verification:
      - kind: e2e
        ref: "npm --prefix web run e2e (first full run: 1428 passed, 46 failed, 50 skipped)"
        status: fail
    human_judgment: true
    rationale: "14 of the failing tests fail the same way at the commit before this plan (dialog-fit, dialog-scrollbars, long-text four-chip, shell 1440x900) and one more (orders-filters on pixel) has the same cause as the four-chip one; the rest passed when re-run. The owner decides how to fix the chip clear buttons and the dialog height"

duration: 5h 35m
completed: 2026-10-30
---

# Phase 8 Plan 24: Prove the whole phase and hand it to the owner Summary

**Five real-browser journeys prove the Phase 8 success criteria, a sweep of every order screen at 8 widths found and fixed four overflow bugs, boundary guards and an Orders showcase section were added, and the web coverage gate was brought back over 90 percent. The full e2e still has failures that already existed before this plan.**

## Performance

- **Duration:** about 5h 35m (long because a full `npm run e2e` takes 1.6 hours)
- **Started:** 2026-10-30T07:50:00-05:00
- **Completed:** 2026-10-30T13:25:00-05:00
- **Tasks:** 3 of 3
- **Files modified:** 35 outside `.planning`

## Accomplishments

- **Success criteria proved end to end.** `@orders-journeys` SC1 to SC5 pass 25 of 25 (5 journeys x 5 projects) with axe and the console and CSP guard on each. SC3 holds the panel against the figures in each write's answer (item add, edit and delete; payment with Received by; discount; expense with Paid by) and makes a stale edit through the API to see the 409 banner, the kept value and Load Latest.
- **Sweep.** `@orders-sweep`: 16 pages (L1 grid, table and with five chips; F1; F2; O1 on all five tabs; X1; X2 on two tabs; S1 on all four tabs) at 320, 375, 414, 768, 1024, 1280, 1536 and 1920 px in Blush and Espresso, with a 100-character name with no break, a 200-character description, reason and payment note, a 2,000-character note, ₱1,000,000.00 lines and a ₱99,999,999.99 total. Plus the chips at 320, the tab strips, the payment window at 320 x 568 and 200% zoom, the status menu, the 100-item create form, the Deleted Orders count words and `/admin/no-such-page` (D-89). Result: 119 of 120 on the first all-project run, the one failure (UIC-63 firefox, 0.4 px while the strip scrolled) fixed, then 6 of 6.
- **Four real overflow bugs found by the sweep and fixed** (see Deviations): the header subline, the balance figure, the order card text and the card footer buttons.
- **Boundary guards.** `orders-boundaries.node.test.ts` (6 tests): the public module and layout hold neither "Estimated Profit" nor "Order Expenses", no Order, Orders or Deleted file uses `dangerouslySetInnerHTML`, and the due flag, order pages and order windows never read `new Date()` or `Date.now()`. Each guard is shown to flag a planted violation first.
- **Orders showcase section** (`Phase8Demos`): totals in the due, Fully Paid, Customer credit and Not collected states with the Cancelled note and the largest figures; eight order cards; the due flag in six states; the seven badges; the Change Status menu with Mark Completed off; the Completed, Cancelled and deleted banners; the soft and permanent delete dialogs. No request is made.
- **Coverage.** Web branch coverage was 89.61 percent (gate 90), unseen because earlier plans did not run the thresholds. It is now 90.68 percent.
- **Requirements.** ORD-01, ORD-02, ORD-06, ORD-07, ORD-10, ORD-11, ORD-12, ORD-15 and ORD-19 marked Complete (see the gate caveat below).

## Gate results

| Gate | Result |
| ---- | ------ |
| `npm --prefix web run e2e -- --grep @orders-journeys` | 25 passed (5 journeys x 5 projects) |
| `npm --prefix web run e2e -- --grep @orders-sweep` | 119 passed, 1 failed (UIC-63 firefox, fixed); UIC-63 re-run 6 passed; after the later fixes the chromium run passed 24 of 24 |
| `npm --prefix web run test -- --run src/test/orders-boundaries.node.test.ts` | 1 file, 6 tests passed |
| Showcase tests | `Phase8Demos.test.tsx`, `showcaseSections.test.ts`, `ComponentShowcasePage.test.tsx`: 5 files, 93 tests passed |
| `npm --prefix web run verify` | exit 0: typecheck, lint (max-warnings 0) and prettier clean; vitest 267 files, 7485 tests passed; coverage All files 95.7 statements, 90.68 branches, 97.36 functions, 98.09 lines (gate 90); budgets public 125.19 KB of 150, admin 214.71 KB of 250, CSS 16.39 KB of 35; license gate passed; THIRD-PARTY-NOTICES up to date (28 packages) |
| `dotnet test --solution Csps.slnx` | second run: Passed, total 6226, succeeded 6224, failed 0, skipped 2 (7m 59s). First run had 1 failure (see Issues) |
| `tools/scripts/Invoke-CoverageGate.ps1` | Csps.Domain line 100% (2619/2619), branch 100% (1126/1126); Csps.Application line 99.1% (6876/6934), branch 95.8% (not gated); "Coverage gate passed." |
| `npm --prefix web run e2e` (full) | **Not green.** First run: 1428 passed, 46 failed, 50 skipped (1.6 h) |

### Gate caveat: the full e2e

Of the 46 failures in the first full run:

- **Fail the same way at the commit before this plan (5118c182, throwaway worktree, since removed):** `@dialog-fit 1274x585` in chromium, firefox and webkit; `@dialog-fit scrollbars 1280x420` (2 tests x 2 scrollbar projects); `@long-text four-chip toolbars` in all five projects; `@shell sidebar and top bar stay pinned at 1440x900` in firefox and iphone. These are not caused by this plan.
- **Same cause as the four-chip failure:** `@orders-filters` on pixel (the 22 px Clear balance and Clear dates buttons next to the fixed phone tab bar fail axe `target-size`). Reproduced with the axe messages; no Phase 8 change touches the toolbar.
- **Mine, fixed:** the showcase section count (12 to 13), and the Change Status demo animating on `/dev/components` (a11y-rulings D-02 and D-05 in webkit and iphone). Re-run: pass.
- **Passed when re-run with 2 workers (133 tests, 131 passed):** `@orders-list` (webkit, pixel, iphone), `@orders-delete` (iphone), `@audit` (iphone x2), `@long-text` Audit Log card (iphone), `@auth-multitab`, `@motion`, `@profile-password` (firefox), `@orders-journeys` SC4 (firefox) and SC5 (iphone), and the iphone `/dev/components` rulings. Timeouts under four busy workers.
- The two that still failed in that re-run were `@orders-filters` pixel (above) and SC5 on pixel, a test bug of mine (two "Order deleted" toasts on screen); fixed and re-run on all five projects with the showcase test: 10 passed.

## Task Commits

1. **Task 1: the five success criteria** - `d51cf059` (test)
2. **Task 2: sweeps and boundary guards** - `9a763879` (test), with the four overflow fixes in `2fb5b37a` (fix)
3. **Task 3: showcase cases, gates, requirement ticks** - `2e3e5121` (feat), `9fffa5f3` (test: coverage), `eb988b6f` (fix: showcase menu, section count, delete journey)
4. **Earmarked from deferred-items:** `55297fe4` (fix: the owner review scripts sign in for Orders)

**Plan metadata:** the docs commit that holds this summary, STATE.md, ROADMAP.md and REQUIREMENTS.md.

## Files Created/Modified

- `web/e2e/orders-journeys.spec.ts`: the five journeys
- `web/e2e/orders-sweep.spec.ts`: the sweep and the focused backstop tests
- `web/e2e/sweep.ts`: `ORDER_PAGES` for the signed-in order pages (the unsigned `PAGES` list is unchanged)
- `web/src/test/orders-boundaries.node.test.ts`, `web/src/test/strictMode.ts`: the guards and the StrictMode helper
- `web/src/modules/admin/components/showcase/Phase8Demos.tsx` and test, plus `showcaseSections.ts`, `showcaseCopy.ts`, `showcase.recipe.ts`, `ShowcaseDemos.tsx`: the Orders section
- Fixes: `money.recipe.ts`, `OrderTotals.tsx`, `data.recipe.ts`, `orderPage.recipe.ts`, `OrderHeader.tsx`, `DeletedOrderPage.tsx`
- Scripts: `owner-review.mjs`, `design-side-by-side.mjs` and their tests
- `.planning/REQUIREMENTS.md`, `.planning/phases/08-order-screens/deferred-items.md`, `.planning/WINDOWS.md`

## Decisions Made

- The sweep runs in all five projects. It costs about 15 minutes in the iphone project, but the engines differ on wrapping and scrolling, and the Phase 6 sweep does the same.
- A fix for a sweep finding lives in the shared recipe that owns the look (`balanceValueClasses`, `orderTeamClasses`, `orderSublineClasses`), with a recipe or component test first.
- Pre-existing failures are recorded with evidence and not fixed here; the owner chooses how to fix the chip buttons and the dialog height.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Four overflows on long names and huge figures**
- **Found during:** Task 2 (sweep)
- **Issue:** a 100-character name with no break widened the order page at 320 to 414 px (the header subline); the 40 px and 28 px balance figure ran past its block at ₱99,000,999.99; the order card clipped its title and customer line; the card's View Order and Edit Details buttons ran past a card narrower than both (about 222 to 225 px, the 3-column grid at 1024 and 1280 px).
- **Fix:** `orderSublineClasses` (wrap anywhere) used by `OrderHeader` and `DeletedOrderPage`; `balanceClasses` wraps and `balanceValueClasses` is `min-w-0 wrap-anywhere`; `orderBodyClasses` is `min-w-0` and the team and customer lines wrap anywhere; `orderActionsClasses` wraps.
- **Files modified:** `orderPage.recipe.ts`, `OrderHeader.tsx`, `DeletedOrderPage.tsx`, `money.recipe.ts`, `OrderTotals.tsx` (the credit block now gets its wrap from the base class), `data.recipe.ts`, with tests in `orderPage.recipe.node.test.ts`, `money.test.tsx`, `data.test.tsx`
- **Verification:** each test went red first; the sweep then passed 24 of 24 in chromium and 119 of 120 in all projects
- **Committed in:** `2fb5b37a`

**2. [Rule 3 - Blocking] Web branch coverage under the 90 percent gate**
- **Found during:** Task 3 (`npm run verify`)
- **Issue:** 89.61 percent of branches (12,579 of 14,036). Most of the missing ones were the React Compiler's cached branch, which only runs on a second render.
- **Fix:** one StrictMode render test in each of nine test files (`inStrictMode` in `src/test/strictMode.ts`)
- **Files modified:** nine `*.test.tsx` files and `src/test/strictMode.ts`
- **Verification:** `verify` exit 0 with 90.68 percent
- **Committed in:** `9fffa5f3`

**3. [Rule 1 - Bug] The Orders showcase section broke three page-wide checks**
- **Found during:** Task 3 (full e2e)
- **Issue:** `showcase.spec.ts` counted 12 sections; the Change Status demo used the real pop-in class, so the a11y-rulings opacity rules saw it at opacity 0.
- **Fix:** the demo menu is drawn static (`statusMenuStaticClasses`); the spec counts 13.
- **Committed in:** `eb988b6f`

**4. [Rule 3 - Blocking] Owner review scripts opened `/admin/orders` unsigned** (earmarked in deferred-items from 08-06)
- **Fix:** `signedIn: true` on the Orders target in both scripts; their tests changed first (red), then the scripts.
- **Committed in:** `55297fe4`

**5. [Rule 1 - Bug, in my own tests] Journey robustness**
- The SC5 journey used `page.goto` while a list read was in flight (WebKit reports an aborted fetch as a page error) and matched two toasts at once. It now reaches Deleted Orders by its link and reads the newest toast. SC1's Table step scrolls the order link to the middle before axe (see deferred-items 07). SC4 clears cookies and signs in again instead of opening the login page twice.

### Outside the plan's file list

`money.recipe.ts`, `OrderTotals.tsx`, `data.recipe.ts`, `orderPage.recipe.ts`, `OrderHeader.tsx`, `DeletedOrderPage.tsx` (the fixes), nine test files and `strictMode.ts` (coverage), `ComponentShowcasePage.test.tsx` and `e2e/showcase.spec.ts` (section count), and the two review scripts.

---

**Total deviations:** 5 (3 bugs found by the new tests, 2 blocking)
**Impact on plan:** the fixes are small, test-first and inside the screens the plan proves; the coverage and script items were needed for the plan's own gates.

## Issues Encountered

- The full e2e is not green; see "Gate caveat". Nothing in the Phase 8 journeys, sweeps or ORD requirements is among the failures that remain.
- One server integration test failed once in the first full `dotnet test` (`TemporaryPasswordTests.AnInvitedPersonWhoGetsATemporaryPasswordCanSignInWithItAndTheOldInvitationDies`: "The newest email is not a sign-in code email"). Run alone it passed, and a second full run passed.
- Tests that read `/dev/components` on the iphone project time out at five seconds for the h1 when four workers share the machine. The showcase is a little heavier now.
- Axe `target-size` can fail for where a 20 to 22 px target sits above the fixed phone tab bar (deferred-items 07).

## Known Stubs

None. The static status menu in the showcase is a deliberate demo, not a stub.

## Threat Flags

None. No new endpoint, auth path or file access; the plan adds tests and a dev-only showcase section. T-08-45 and T-08-46 are mitigated by the new node guards and the journeys (SC4 checks the public home page and the list).

## Human checks (queued, not blocking)

Recorded in `deferred-items.md` ("From plan 08-24" item 1) and `.planning/WINDOWS.md` (entries 5 to 7):

1. The Visual Review screenshot set at 390, 820 and 1440 px in Blush and Espresso (`npm --prefix web run review`), including the Delivered tone and the APX-IN-01 audit line detail.
2. Copy review of every SPEC-GAP string (D-56).
3. The Grid and Table switch keeping the current page (RESEARCH A4).
4. The browser's `beforeunload` prompt on a dirty create and edit form.
5. The four overflow fixes (deferred-items 02), especially the card footer wrap at about 222 px.
6. The DOM-WR-04 reminder already in STATE.md.
7. How to fix the chip clear buttons and the dialog height (deferred-items 07 and 08).

## Next Phase Readiness

Phase 8 has all 24 plans built. Ready for phase verification and the UI review, then `/gsd-ship` once the owner has dealt with the queued items. The ship gate reads `.planning/WINDOWS.md`, which now holds three open entries from this plan.

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*

## Self-Check: PASSED

- Created files exist on disk (journeys, sweep, boundaries test, StrictMode helper, Phase8Demos and its test).
- All 7 plan commits are on the branch (`d51cf059`, `2fb5b37a`, `9a763879`, `55297fe4`, `2e3e5121`, `9fffa5f3`, `eb988b6f`).
- Acceptance: 5 `test('@orders-journeys` lines; 16 `/admin/orders` lines in `sweep.ts`; the ROADMAP criterion 5 note appears once; the three guards are named in `orders-boundaries.node.test.ts` test titles.
- The full `npm run e2e` is the one gate that is not green (see "Gate caveat"); the claim above is that its remaining failures are not caused by this plan, not that it passed.

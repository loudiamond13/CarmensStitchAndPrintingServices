---
phase: 08-order-screens
plan: 12
subsystem: ui
tags: [react, vitest, playwright, orders, order-page, tabs, status-history, a11y, tdd]
created: "2026-10-30T00:34:00-05:00"
updated: "2026-10-30T00:34:00-05:00"

requires:
  - phase: 08-order-screens
    provides: "08-10 the order page (header, totals panel, Items tab, tab in the URL, orderRules with showRefundsTab, orderPage.recipe and ORDER_PAGE_COPY); 08-01 the order detail answer with payments, discounts, expenses, refunds, status history and totals; 08-06 orderFixtures"
provides:
  - "OrderPaymentsTab, OrderDiscountsTab, OrderExpensesTab, OrderRefundsTab: heading and caption, ResponsiveTable with a server-figure footer, inline empty line, readOnly prop"
  - "OrderTabParts: OrderTabHead (with an action slot for the window plans), OrderTabEmpty, OrderDateCell, OrderPersonCell"
  - "OrderCustomerCard (readOnly), OrderStatusHistory (newest 5, Show All / Show Fewer), OrderBalanceStrip (phone balance card)"
  - "OrderPage: five tabs with counts, Refunds only when showRefundsTab says so, a hidden ?tab=refunds replaced by items, the side column with totals, customer card and history"
  - "OrderItemsTab readOnly prop; tablet and phone side order in orderPage.recipe.ts"
  - "web/e2e/order-page.spec.ts layout journey (@orders-page)"
affects: [08-14, 08-15, 08-16, 08-17, 08-18, 08-19, 08-20, 08-21, 08-22, 08-23, 08-24, order-page, deleted-orders]

actuals:
  tokens: 20000
  tasks: 3
  commits: 6
plan_head_before: d4c72fe047a534224bbaf9e6b2fa58c2665f1395
plan_head_after: aa7c6c7d54a823306b36e2a9057be5c7585039fd

tech-stack:
  added: []
  patterns:
    - "Each tab is its own component file taking the order and readOnly; the head has an action slot so a window plan adds its Add button inside one file"
    - "A tab with no rows shows an inline empty line instead of a table, so the empty state never needs a footer"
    - "The page replaces a hidden refunds tab with items in an effect guarded by a boolean, so the URL is written once"
    - "A state-driven button name (the balance card) is built from the server figures only; no money is worked out in the browser"
    - "Tablet and phone side order is pinned by a node test over the generated container-query CSS"

key-files:
  created:
    - web/src/modules/admin/components/OrderPaymentsTab.tsx
    - web/src/modules/admin/components/OrderDiscountsTab.tsx
    - web/src/modules/admin/components/OrderExpensesTab.tsx
    - web/src/modules/admin/components/OrderRefundsTab.tsx
    - web/src/modules/admin/components/OrderTabParts.tsx
    - web/src/modules/admin/components/OrderTabs.test.tsx
    - web/src/modules/admin/components/OrderCustomerCard.tsx
    - web/src/modules/admin/components/OrderStatusHistory.tsx
    - web/src/modules/admin/components/OrderStatusHistory.test.tsx
    - web/src/modules/admin/components/OrderBalanceStrip.tsx
    - web/src/modules/admin/components/OrderBalanceStrip.test.tsx
  modified:
    - web/src/modules/admin/components/OrderItemsTab.tsx
    - web/src/modules/admin/components/orderPage.recipe.ts
    - web/src/modules/admin/components/orderPage.recipe.node.test.ts
    - web/src/modules/admin/pages/OrderPage.tsx
    - web/src/modules/admin/pages/OrderPage.test.tsx
    - web/src/modules/admin/orderPageCopy.ts
    - web/e2e/order-page.spec.ts

key-decisions:
  - "The tab panels are titled Payments, Discounts, Expenses and Refunds (the UI-SPEC names no h3 titles); the same words name each table"
  - "A discount row's amount is csps.ts discountAmount over the server subtotal; the Total discount footer is the server's totals.discount, shown negative"
  - "The phone balance card follows the totals panel and also says Not collected for a Cancelled order with money unpaid (D-45); SPEC-GAP for owner review"
  - "On phones the side column follows the tab card; on tablets it sits above it as a two-column grid with the history across both (UI-SPEC block order)"
  - "readOnly is a prop of every tab and the customer card now; the window plans hide their own controls on it"

patterns-established:
  - "OrderTabHead takes an action node, so 08-14 to 08-18 add their Add button without touching the shared parts"
  - "Footer on a money tab: the lead cell holds the label and spans all but the amount column; the amount cell's phone label is Total"

requirements-completed: [ORD-07]

coverage:
  - id: D1
    description: "The tab card shows Items, Payments, Discounts and Expenses with counts, and Refunds with its count only when the order is Cancelled, has a customer credit or already has refunds; a hidden ?tab=refunds is replaced by items with one replace"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#the Refunds tab (ORD-07, D-13, UIC-35, UIC-46)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Payments rows show Date, Method badge, Reference no., Notes, Received by, Recorded by and Amount; the caption names the balance due, the customer credit or 'Nothing is owed on this order.'; the footer reads 'Total paid' from the server figure"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderTabs.test.tsx#the Payments tab (ORD-07, D-09, D-12)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-page.spec.ts#@orders-page the order page lays out by screen width"
        status: pass
    human_judgment: false
  - id: D3
    description: "Discounts, Expenses and Refunds rows show their columns, both people on the money tabs, '(former staff)' for a deleted user and 'System' for none, with the footers 'Total discount', 'Order expenses' and 'Total refunded'; each empty tab shows its inline empty line"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderTabs.test.tsx#the Discounts tab (ORD-07)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderTabs.test.tsx#the Expenses tab (ORD-07, D-12)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderTabs.test.tsx#the Refunds tab (ORD-07, D-10, D-12)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every tab component and the customer card take readOnly; with it set no Add, Edit, Delete or Edit Details control renders"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderTabs.test.tsx#shows no Add, Edit or Delete control when read only (D-24)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderTabs.test.tsx#the customer card read only (D-24)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The customer card shows Name, Team, Contact, Email and Address (the empty value when missing) and the order notes, with an Edit Details link hidden when the order is locked"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#the customer card (ORD-07, UIC-6)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The status history lists newest first '{From} to {To}' over '{name} · {date}' ('System' when no person, 'Created as {Status}' first), shows the newest 5 and a Show All button that becomes Show Fewer and keeps focus"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderStatusHistory.test.tsx"
        status: pass
    human_judgment: false
  - id: D7
    description: "On phones a slim balance card under the header shows Total and Balance due, Fully Paid, Credit or Not collected, is named from the server figures, and pressing it scrolls to #order-totals (instant under reduced motion) and focuses the Totals heading"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderBalanceStrip.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-page.spec.ts#@orders-page the order page lays out by screen width"
        status: pass
    human_judgment: false
  - id: D8
    description: "The tab strip scrolls inside itself at 320 px and keeps the chosen tab in view, the page never scrolls sideways, and the side column sits after the tab card on phones, above it on tablets and beside it on desktop"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/orderPage.recipe.node.test.ts"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-page.spec.ts#@orders-page the order page lays out by screen width"
        status: pass
    human_judgment: false
  - id: D9
    description: "How the finished order page looks at 390, 820 and 1440 px in Blush and Espresso (spacing, colour, the balance card)"
    verification:
      - kind: e2e
        ref: "web/e2e/order-page.spec.ts#@orders-page the order page lays out by screen width"
        status: pass
    human_judgment: true
    rationale: "Box positions, sideways scroll and axe are proved in five browser projects; the look in both themes is the owner's screenshot review (UI-SPEC Visual Review)"

duration: 25min
completed: 2026-10-30
status: complete
---

# Phase 08 Plan 12: The rest of the order page Summary

**The order page now reads end to end: Payments, Discounts, Expenses and a conditional Refunds tab with both people on every money row, a customer card, a status history that shows the newest five with Show All, and a phone balance card that jumps to the totals, all from the server's figures and laid out per screen width.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-30T00:05:30-05:00
- **Completed:** 2026-10-30T00:31:00-05:00
- **Tasks:** 3
- **Files modified:** 18 in code (11 created, 7 changed), plus the deferred list and the ledger

## Accomplishments

- Tracer: the Payments tab on the order page shows date, method badge, reference, notes, received by, recorded by and amount, with a caption from the server balance (balance due, customer credit or "Nothing is owed on this order.") and a "Total paid" footer. The tracer's `<verify>` is automated only, so the Vitest command was re-run after the commit and passed (`Tracer verified end-to-end, expanding`).
- Discounts (type badge, value, negative amount, "Total discount"), Expenses (category badge, description, paid by, recorded by, "Order expenses") and Refunds (reason, refunded by, recorded by, "Total refunded"), each with its inline empty line. The Refunds tab is drawn only for a Cancelled order, a customer credit or existing refunds; `?tab=refunds` on any other order is replaced by items with one replace.
- Customer card with an icon per row, the empty value for blanks, the notes in a note, and an Edit Details link that is hidden on a locked order or when `readOnly`.
- Status history: newest first, "Created as {Status}" for the first row, "System" for no person, `<time>` dates, the newest 5 and Show All / Show Fewer with the focus kept on the one button.
- Phone balance card under the header: names itself from the server figures, scrolls to `#order-totals` (instant under reduced motion) and focuses the Totals heading; hidden above 767 px.
- Side column order per the UI-SPEC: after the tab card on phones, above it as a two-column grid on tablets (history across both), beside it on desktop.
- `readOnly` on every tab component and the customer card, for the deleted view (D-24).

## Task Commits

1. **Task 1: The Payments tab shows who received and who recorded each payment (tracer)** - RED `42d912a7` (test), GREEN `8e99a8a7` (feat)
2. **Task 2: Discounts, Expenses and the conditional Refunds tab** - RED `498f395a` (test), GREEN `2b200faf` (feat)
3. **Task 3: Customer card, status history and the phone balance card** - RED `88cd5226` (test), GREEN `aa7c6c7d` (feat)

**Plan metadata:** the docs commit that holds this file, the state updates and the ledger.

## TDD Gate Compliance

Each task has a `test(08-12)` commit before its `feat(08-12)` commit. The RED commits carry a no-op stub of each new component so the tests fail on their own assertions, not on a missing import. Evidence came from the Vitest output; `gsd_run check tdd-red-evidence` was not run because this plan is `type: execute` and Vitest here does not write the TAP report that classifier reads (the same as plans 08-04 to 08-11).

- **RED 1** (11 failed, 35 passed over 2 files): the Payments tests failed on `Unable to find an accessible element with the role "table" and name "Payments"` and on the caption and footer text (the stub rendered nothing). The read-only case passed against the stub and pins the contract. Semantic assessment: valid RED, each failure is the planned behaviour missing.
- **RED 2** (25 failed, 52 passed over 2 files): Discounts, Expenses and Refunds tests failed on missing tables, empty lines and tabs; `?tab=refunds` stayed unreplaced. The "not drawn for an open order" case and the four read-only cases passed against stubs and pin the rules. Valid RED.
- **RED 3** (30 failed, 79 passed over 5 files): no "Status history", no list, no "Show All 7", no strip names, no "Customer" region, `order-first` missing from the tablet block in the generated CSS. Valid RED.
- **GREEN** commits `8e99a8a7`, `2b200faf` and `aa7c6c7d` each turned their RED tests green. Test edits after RED were test-only: a `typecheck` fix for `exactOptionalPropertyTypes` on the nuqs adapter prop, and a class-list read in the recipe node test after Prettier reordered Tailwind classes.
- No REFACTOR commit.

## Files Created/Modified

- `web/src/modules/admin/components/OrderPaymentsTab.tsx`, `OrderDiscountsTab.tsx`, `OrderExpensesTab.tsx`, `OrderRefundsTab.tsx` - the four money tabs.
- `web/src/modules/admin/components/OrderTabParts.tsx` - the shared head (with an action slot), empty line, date cell and person cell.
- `web/src/modules/admin/components/OrderCustomerCard.tsx`, `OrderStatusHistory.tsx`, `OrderBalanceStrip.tsx` - the side cards and the phone balance card.
- `web/src/modules/admin/components/OrderItemsTab.tsx` - `readOnly` prop.
- `web/src/modules/admin/components/orderPage.recipe.ts` (+ node test) - side order per width, card, meta, history and strip looks.
- `web/src/modules/admin/pages/OrderPage.tsx` - five tabs, the replace effect, the strip, the customer card and the history.
- `web/src/modules/admin/orderPageCopy.ts` - every new string.
- Tests: `OrderTabs.test.tsx`, `OrderStatusHistory.test.tsx`, `OrderBalanceStrip.test.tsx`, `OrderPage.test.tsx`, `orderPage.recipe.node.test.ts`; `web/e2e/order-page.spec.ts`.

## Decisions Made

- The panels are titled "Payments", "Discounts", "Expenses" and "Refunds" (the UI-SPEC gives captions, columns and footers but no `h3` titles).
- A discount row's Amount is `discountAmount` (csps.ts) over the server subtotal; the footer is the server's `totals.discount`.
- The phone card says "Not collected" for a Cancelled order with money unpaid, matching the totals panel (D-45). SPEC-GAP for owner review.
- The Refunds caption is the short sentence until the Add button (plan 08-18) brings " You can refund up to ₱X."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The side column came first on phones**
- **Found during:** Task 3 (UI-SPEC "Order page block order")
- **Issue:** Plan 08-10 put the side first up to 1023 px with `pg-lt-lg:order-first`. The UI-SPEC phone order is header, balance card, images, tabs, totals, customer, history, and only the tablet puts the side above the main column.
- **Fix:** `pg-tablet:order-first` with a two-column grid on tablets; the history spans both columns. The cascade node test now pins the tablet block, the tablet grid and the phone-only strip.
- **Files modified:** `orderPage.recipe.ts`, `orderPage.recipe.node.test.ts`
- **Commit:** `aa7c6c7d`

**2. [Rule 3 - Blocking] A second "Edit Details" link broke two existing checks**
- **Found during:** Task 3
- **Issue:** The customer card link has the same name as the header button (UI-SPEC). The 08-10 header test and the `@orders-page` e2e looked for one link and would hit two.
- **Fix:** The header test takes the first of the links (the header comes first); the e2e uses `.first()`.
- **Files modified:** `OrderPage.test.tsx`, `web/e2e/order-page.spec.ts`
- **Commit:** `88cd5226`, `aa7c6c7d`

**3. [Rule 1 - Bug] Type error in the test helper**
- **Found during:** Task 2 (typecheck)
- **Issue:** `exactOptionalPropertyTypes` rejected passing `onUrlUpdate={undefined}` to the nuqs test adapter.
- **Fix:** The prop is spread only when given.
- **Files modified:** `OrderPage.test.tsx`
- **Commit:** `2b200faf`

**4. [Rule 2 - Missing critical] The strip's Cancelled state**
- **Found during:** Task 3
- **Issue:** The UI-SPEC names three strip states; a Cancelled order with money unpaid would say "Balance due" on the phone while the panel says "Not collected".
- **Fix:** A fourth state "Not collected" with its own name; logged for owner review.
- **Files modified:** `OrderBalanceStrip.tsx`, `orderPageCopy.ts`
- **Commit:** `aa7c6c7d`

---

**Total deviations:** 4 auto-fixed (2 bug, 1 missing critical, 1 blocking)
**Impact on plan:** All kept the page true to the UI-SPEC or the suites green. No scope creep and no package added. SPEC-GAP items for the owner are in `deferred-items.md` "From plan 08-12".

## Issues Encountered

- Python is not installed on this machine, so two scripted file edits failed before they wrote anything; the edit tool was used instead. One shell heredoc with an apostrophe broke and wrote nothing.
- Nothing flaked: `@orders-page` passed 10 of 10 (the two journeys in chromium, firefox, webkit, pixel and iphone) on the first run.

## Verification

- `npx vitest --run` over the five touched test files, final state: passed (OrderTabs 33, OrderStatusHistory 10, OrderBalanceStrip 7, recipe node 5, OrderPage 54).
- Full web suite at the end: `Test Files  228 passed (228)`, `Tests  6740 passed (6740)`.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0. `npm --prefix web run typecheck`: exit 0. `npm --prefix web run format:check`: exit 0.
- `npm --prefix web run e2e -- --grep @orders-page`: `10 passed (1.0m)` (chromium, firefox, webkit, pixel, iphone; both journeys).
- Acceptance greps: "Received by" and "Recorded by" are each in `orderPageCopy.ts` once or more; `showRefundsTab` is in `OrderPage.tsx`; `OrderTabs.test.tsx` has tests named with "former staff"; `style=` is absent from `OrderBalanceStrip.tsx`, `OrderStatusHistory.tsx` and `OrderCustomerCard.tsx`; no `dangerouslySetInnerHTML` in `modules/admin`.
- gitleaks (the pre-commit hook on every commit): no leaks found. Fixture names are made up; the e2e email uses an `example.test` address; no real ids or local paths.
- Preflight run before the e2e: all four ports free, no other project's processes.

## Known Stubs

None. The Payments, Discounts and Expenses panels that plan 08-10 left empty are filled, and the ledger entry for them (WINDOWS.md id 4) is marked fixed.

## Threat Flags

None. T-08-22 (customer card, notes and reasons rendered) is mitigated: every value is a React text node, there is no `dangerouslySetInnerHTML` and no inline `style`, and the notes keep their line breaks through a class. T-08-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The window plans (08-14 to 08-18) each change one tab file: add their Add button through the `action` slot of `OrderTabHead` and their row actions in the file's columns, hidden when `readOnly`. 08-18 also adds " You can refund up to ₱X." to the Refunds caption.
- The deleted view (08-20/08-21) can build its page body from these parts with `readOnly`.
- The page look at 390, 820 and 1440 px in both themes is for the owner's screenshot review; see `deferred-items.md` "From plan 08-12" for the SPEC-GAP wording to review (Not collected on the phone card, tab panel titles, discount row amounts, footer labels, the two Edit Details links).

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*

## Self-Check: PASSED

- FOUND: OrderPaymentsTab.tsx, OrderDiscountsTab.tsx, OrderExpensesTab.tsx, OrderRefundsTab.tsx, OrderTabParts.tsx, OrderTabs.test.tsx, OrderCustomerCard.tsx, OrderStatusHistory.tsx (+ test), OrderBalanceStrip.tsx (+ test) under web/src/modules/admin/components
- FOUND commits: 42d912a7, 8e99a8a7, 498f395a, 2b200faf, 88cd5226, aa7c6c7d
- `check evaluation-scope --plan 08-12 --commits-only` returned the plan commits on this branch

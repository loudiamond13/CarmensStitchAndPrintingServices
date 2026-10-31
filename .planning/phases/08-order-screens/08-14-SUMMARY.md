---
phase: 08-order-screens
plan: 14
subsystem: ui
tags: [react, react-hook-form, zod, tanstack-query, msw, playwright, modal, idempotency]
created: 2026-10-30T02:20:00-05:00
updated: 2026-10-30T02:20:00-05:00

requires:
  - phase: 08-order-screens
    provides: orderItemSchema, useUnsavedChangesGuard pattern, orderFormCopy (08-13); OrderTabHead action slot, readOnly tabs (08-12); useApplyOrder, orderRules.canDeleteItem, order page query (08-10); ListEntrySelect (08-04)
provides:
  - "Add, edit and delete of order items from the Items tab, every save answering the whole order"
  - "OrderWindow: the shared modal frame (D-58 discard guard, stale, removed and refusal banners, record meta slot, Save footer)"
  - "useOrderChildSave and orderSavedMessage: the shared save path and D-05 toast for the payment, discount, expense and refund windows"
  - "useOrderAction: idempotent single-click order action for the row deletes of 08-16 to 08-18"
  - "orderItemsService (add with key and version, update with version, remove with neither)"
affects: [08-15, 08-16, 08-17, 08-18, 08-19, 08-24]

actuals:
  tokens: 31000
  tasks: 3
  commits: 7
plan_head_before: 88ea33d6135c973f0c0435f75023639681731375
plan_head_after: b2d6645aa64edf3995b526ac2192c1e6757c2104

tech-stack:
  added: []
  patterns:
    - "A window keeps the order it opened with and puts that version in the data it submits, so a changed version is a new submission with a new key"
    - "Failure map in one hook: 409 stale banner, 404 removed, 422 server sentence (+ refetch), 400 under the fields"
    - "Focus is returned by name after a window closes (Safari does not focus a button on click)"
    - "Windows render after the table, never inside the ResponsiveTable frame"

key-files:
  created:
    - web/src/modules/admin/components/OrderWindow.tsx
    - web/src/modules/admin/components/orderWindow.recipe.ts
    - web/src/modules/admin/components/OrderItemModal.tsx
    - web/src/modules/admin/hooks/useOrderChildSave.ts
    - web/src/modules/admin/hooks/useOrderAction.ts
    - web/src/modules/admin/services/orderItemsService.ts
    - web/src/modules/admin/orderWindowsCopy.ts
    - web/e2e/order-items.spec.ts
  modified:
    - web/src/modules/admin/components/OrderItemsTab.tsx
    - web/src/modules/admin/components/OrderTabParts.tsx
    - web/src/modules/admin/components/orderPage.recipe.ts
    - web/src/modules/admin/hooks/useApplyOrder.ts

key-decisions:
  - "The window frame owns the form element and the Save button (type submit with the form attribute), so Enter and the button take one path"
  - "Add Load Latest keeps the typed values and focuses Save; edit Load Latest replaces values and version and focuses Product type"
  - "A refusal (422) and a missing record (404) read the order again so the page matches the server"
  - "The Items tab splits into a read-only view and an editable view, so hooks that need the query client and toasts run only when the controls exist"

patterns-established:
  - "Server sentence for a 422 comes from problem.detail; 5xx and network failures use describeHttpError, never server text"
  - "After a delete, focus waits until the answer no longer holds the removed row (next row's Edit, else previous, else the tab heading)"

requirements-completed: [ORD-07]

coverage:
  - id: D1
    description: "Staff add an item from the Items tab; one Idempotency-Key and the opened version are sent, the page shows the server's totals, the window closes and focus returns to Add Item"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderItemModal.test.tsx#posts once with an Idempotency-Key and the opened version, then closes and tells the parent"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderItemsTab.test.tsx#adds an item, shows the server's new rows and subtotal, and puts focus back on Add Item"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-items.spec.ts#@orders-items a Manager adds an item and sees the new total from the server"
        status: pass
    human_judgment: false
  - id: D2
    description: "Staff edit an item with Recorded by and Last changed by shown; a focus refetch never changes the version the window sends"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderItemModal.test.tsx#keeps the version it opened with when a focus refetch brings a newer order (ORD-07 concurrency)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderItemModal.test.tsx#shows no Last changed by value for an item that was never changed (UIC-9)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-items.spec.ts#@orders-items a Manager edits an item, deletes another and sees the server totals each time, and the last item cannot be deleted"
        status: pass
    human_judgment: false
  - id: D3
    description: "A stale save shows the conflict banner and keeps typed values; Load Latest replaces values and version for an edit and refreshes the order for an add"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderItemModal.test.tsx#shows the conflict banner, keeps the typed values, and Load Latest replaces the values and the version"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderItemModal.test.tsx#Load Latest refreshes the order and keeps what was typed, and the next save sends the new version"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrderChildSave.test.tsx (17 tests: 409, 404, 422, 400, Load Latest)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Refusals show in the window: 422 orders.locked (server text, Save aria-disabled, order refetched), other 422 (server text), 404 (This item was removed.)"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderItemModal.test.tsx#edit mode refusals (3 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A dirty window asks 'Discard changes?' on Cancel, Esc, the scrim and the close button; a clean window closes at once; nothing closes while saving"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderWindow.test.tsx#closing a dirty window (D-58, UIC-43) and closing a clean window (D-58)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-items.spec.ts#@orders-items a Manager edits an item, deletes another ... (Keep Editing, Discard Changes)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Staff delete an item through a confirm dialog with no key and no version; the answer is applied, the toast names the balance, focus moves to the next row's Edit, else previous, else the tab heading"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderItemsTab.test.tsx#Delete Item (7 tests)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-items.spec.ts#@orders-items a Manager edits an item, deletes another ..."
        status: pass
    human_judgment: false
  - id: D7
    description: "With one item left Delete is not rendered and the note shows; locked and read-only views show no Add, Edit or Delete"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderItemsTab.test.tsx#the last item (D-48, UIC-49) and a locked or deleted view (D-15, D-24)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Row actions are named by their row, sit top right on a phone, keep 36 px drawn size with a 44 px tap area, and the Add Item window fits a phone with no sideways scroll"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderItemsTab.test.tsx#names each row action by its row, with a matching title"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-items.spec.ts#@orders-items on a phone the row actions sit top right and answer a 44 px tap area, and nothing scrolls sideways"
        status: pass
    human_judgment: false
  - id: D9
    description: "The look of the Add Item and Edit Item windows, the row action icons and the last item note in Blush and Espresso"
    verification: []
    human_judgment: true
    rationale: "Colour, spacing and layout feel are the owner's screenshot review; tests prove behavior, boxes and axe, not taste"

duration: 50min
completed: 2026-10-30
status: complete
---

# Phase 08 Plan 14: Work the items of an order Summary

**Add, edit and delete order items from the Items tab through a shared OrderWindow frame and useOrderChildSave hook: one key per add, the opened version on every save, a 409 banner that keeps typed values, 404 and 422 shown in the window, the D-58 discard guard, and the server's totals on the page after every change**

## Performance

- **Duration:** about 50 min
- **Started:** 2026-10-30T01:26:00-05:00 (approximate)
- **Completed:** 2026-10-30T02:20:00-05:00
- **Tasks:** 3
- **Files modified:** 17 under `web/` (8 new source files, 4 changed source files, 5 test files) plus `deferred-items.md`

## Accomplishments

- **Add Item**: the Items tab head has a primary `plus` Add Item (active, not read-only orders). The window sends one Idempotency-Key per submission and the version it opened with, closes, sets the order from the answer, and toasts "Item added" with "Balance now ₱X.", "Order is now fully paid." or "Customer credit now ₱X.".
- **Edit Item**: opens with the item's values, a retired own type kept as "{name} (retired)", and `RecordMeta` (Recorded by, Last changed by from the D-44 fields; "Not set" for an item never changed). Save PUTs the opened version; a focus refetch cannot change it.
- **Conflicts and refusals** in one place (`useOrderChildSave`): 409 `edit.stale` shows the ConflictBanner with Load Latest (edit replaces values and version; add keeps what was typed and takes the new version as a new submission), 404 shows "This item was removed." / "Close this and check the order." with Save aria-disabled, 422 shows the server sentence (and `orders.locked` also blocks Save), 400 goes under the fields with the first one focused. 404 and 422 read the order again.
- **D-58 discard guard** in `OrderWindow`: Cancel, Esc, the scrim and the close button ask "Discard changes?" with Keep Editing focused first when the window is dirty; a clean window closes at once; nothing closes while saving.
- **Delete Item**: ConfirmDialog `Delete item "{description}"?` with "This removes it from {number} and updates the totals right away."; DELETE with no key and no version; the answer is applied; focus moves to the next row's Edit, else the previous, else the tab heading. With one item left Delete is not rendered and the D-48 note shows.
- **Row actions** named "Edit item {n}, {description}" and "Delete item {n}, {description}" with matching titles; on a phone they sit top right in the card.
- **Shared pieces for 08-16 to 08-18**: `OrderWindow`, `orderWindow.recipe.ts`, `useOrderChildSave` (+ `orderSavedMessage` for all five things), `useOrderAction`, `useRefetchOrder`, and the `OrderTabHead` heading ref.

## Task Commits

1. **Service and words** - `4e648983` (feat: orderItemsService, orderWindowsCopy)
2. **Task 1: Add an item (tracer)** - `ecfffadf` (test, RED) then `3bde1d95` (feat, GREEN)
3. **Task 2: Edit an item safely** - `3885a6b4` (test, RED) then `c32c3ca5` (feat, GREEN)
4. **Task 3: Delete an item** - `bf905d40` (test, RED) then `b2d6645a` (feat, GREEN)

**Plan metadata:** the docs commit that follows this file (docs: complete plan).

## Files Created/Modified

- `web/src/modules/admin/components/OrderWindow.tsx` - modal frame, discard guard, banners, record meta slot, Save footer
- `web/src/modules/admin/components/orderWindow.recipe.ts` - window body and form grid classes
- `web/src/modules/admin/components/OrderItemModal.tsx` - add and edit item window
- `web/src/modules/admin/components/OrderItemsTab.tsx` - Add, Edit, Delete, last item note, focus rules; read-only view kept apart
- `web/src/modules/admin/components/OrderTabParts.tsx` - `OrderTabHead` heading ref and `tabIndex={-1}` on the h3
- `web/src/modules/admin/components/orderPage.recipe.ts` - `orderTabNoteClasses`
- `web/src/modules/admin/hooks/useOrderChildSave.ts` - save path, failure map, Load Latest, `orderSavedMessage`
- `web/src/modules/admin/hooks/useOrderAction.ts` - idempotent single-click order action
- `web/src/modules/admin/hooks/useApplyOrder.ts` - `useRefetchOrder`
- `web/src/modules/admin/services/orderItemsService.ts` - add, update, remove
- `web/src/modules/admin/orderWindowsCopy.ts` - shared window, toast, discard and item words
- `web/e2e/order-items.spec.ts` - three `@orders-items` tests
- Tests: `OrderWindow.test.tsx` (16), `OrderItemModal.test.tsx` (33), `OrderItemsTab.test.tsx` (17), `useOrderChildSave.test.tsx` (17), `orderItemsService.test.ts` (4)

## Decisions Made

- The frame (not each window) owns the `<form>` and the Save button, so Enter and the button take the same path and the banners and record meta sit in one place.
- A submission's data carries the version, so a retry of the same values keeps its key and a Load Latest (new version) starts a new one.
- The Items tab is two components (a read-only view and an editable view) because the editable one needs the query client and toasts, and the existing read-only usage renders without providers.
- Focus return after a window closes is explicit (see deferred item 4), because Safari does not focus a button on click.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Safari/iPhone did not return focus to Add Item**
- **Found during:** Task 1 (first `@orders-items` run: webkit and iphone failed, chromium, firefox and pixel passed)
- **Issue:** the Modal returns focus to the element that was focused at open; WebKit does not focus a button on a mouse click, so there was nothing to return to.
- **Fix:** the tab focuses Add Item, the row's Edit or the row's Delete itself after a window closes (an effect that runs once no window is open).
- **Files modified:** `web/src/modules/admin/components/OrderItemsTab.tsx`
- **Verification:** `@orders-items` e2e green in all five projects.
- **Committed in:** `3bde1d95`, extended in `c32c3ca5` and `b2d6645a`

**2. [Rule 1 - Bug] Product type could not take the cursor at open**
- **Found during:** Task 1 (unit test for "focus on Product type")
- **Issue:** the box is disabled while the product type list loads, so the Modal's first-field focus landed on Size / variant.
- **Fix:** the window focuses Product type once the list has loaded and nothing has been typed.
- **Files modified:** `web/src/modules/admin/components/OrderItemModal.tsx`
- **Committed in:** `3bde1d95`

**3. [Rule 3 - Blocking] `exactOptionalPropertyTypes` and lint rules in test helpers**
- **Found during:** Tasks 1 and 2 (typecheck, eslint)
- **Fix:** `| undefined` on optional props, `saveRef ?? null`, `useOrderHandlers` called from the test bodies instead of a helper (rules-of-hooks), void-returning arrow braces.
- **Committed in:** `3bde1d95`, `c32c3ca5`

**4. [Rule 1 - Bug] e2e phone check measured the wrong thing**
- **Found during:** Task 3 (e2e)
- **Issue:** my first phone test asserted the row actions were drawn 44 px; the shared rule (D-31 O-8, D-51) draws them 36 px with an invisible 44 px tap area. The Add Item window height was also measured mid-rise.
- **Fix:** the test now checks the 36 px drawn size, the 44 px tap area by hit test (as `target-size.spec.ts` does), and polls the quantity box height until the window has risen.
- **Files modified:** `web/e2e/order-items.spec.ts`
- **Committed in:** `b2d6645a`

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 blocking)
**Impact on plan:** none on scope. No package added. The plan's `files_modified` list gained `orderWindow.recipe.ts`, `OrderTabParts.tsx`, `orderPage.recipe.ts`, `useApplyOrder.ts` and `OrderItemModal`'s tests only because the shared frame and focus rules needed them.

## Issues Encountered

- First e2e run failed on WebKit and iPhone for the focus return (fixed, deviation 1). Two later e2e runs failed only on my new phone test (deviation 4). The final run: 15 passed in 5 projects, no flake seen.
- `orderWindowsCopy.ts` and `orderItemsService.ts` were written before their tests (the service test passed on its first run). Every other piece went red first. The RED runs for the window, hook and add modal were module-not-found load failures because the files did not exist; the edit and delete RED runs failed on assertions.

## Verification

- `npx vitest run` (whole web suite): 238 files, 6944 tests passed.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0, no output.
- `npm run typecheck`: clean. `npx prettier --check src e2e`: clean.
- `npm run e2e -- --grep @orders-items`: 15 passed (3 tests x chromium, firefox, webkit, pixel, iphone).
- gitleaks pre-commit hook: "no leaks found" on all seven task commits.
- Acceptance greps: `Customer credit now` count 1; `the last one can't be deleted` count 1; `OrderWindow.test.tsx` has tests named with "Keep Editing" and "clean window"; `useOrderChildSave.test.tsx` covers 409, 404, 422 and 400.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-15 (Edit Order) is unaffected. 08-16 to 08-18 (payments, discounts, expenses, refunds) can build on `OrderWindow`, `useOrderChildSave`, `useOrderAction`, `orderSavedMessage` and the focus-return pattern in `OrderItemsTab`. Their strings join `orderWindowsCopy.ts`.
- `OrderBody` still passes no `readOnly`; the deleted view (08-20/08-21) passes it when it builds its own body.
- Owner review items are in `deferred-items.md` under "From plan 08-14" (404 order-removed wording, add-mode Load Latest line, focus return, Product type focus, Line total hint, no 100-item cap on the button, row numbering, the look in a browser).

## Known Stubs

None. Nothing in the new files renders hardcoded empty or placeholder data.

## Threat Flags

None. No new endpoint, auth path or schema; item writes use the existing routes. Threat register: T-08-26 (version from the opened snapshot, 409 banner, focus-refetch test), T-08-27 (one key per add, double click test), T-08-28 (no attribution field sent; RecordMeta shows the server's values), T-08-SC (no package added) all hold.

## TDD Gate Compliance

Task-level TDD (the plan is `type: execute`): RED commits `ecfffadf`, `3885a6b4`, `bf905d40` precede GREEN commits `3bde1d95`, `c32c3ca5`, `b2d6645a`. No REFACTOR commit (none needed).

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*

## Self-Check: PASSED

All 14 listed files exist on disk and all seven task commits are ancestors of HEAD.

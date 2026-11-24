---
created: 2026-11-23T21:31:27-06:00
updated: 2026-11-23T21:31:27-06:00
phase: 13-quote-inquiries
plan: 22
subsystem: admin-order-form-quote-conversion
tags: [quote-requests, orders, react, react-hook-form, tanstack-query, react-router, a11y, tdd, playwright]
status: complete

requires:
  - phase: 13-quote-inquiries
    provides: "13-20 GET /quote-requests/{id}/order-prefill, quoteRequestId on the New Order body, 404 quote-requests.not-found and 409 quote-requests.already-converted (orderId, orderNumber), quoteRequestId on the order detail, orderId and orderNumber on the request detail; 13-19 and 13-21 QuoteRequestPage and its actions row; 13-17 the ['quote-requests'] prefix with NEW_QUOTE_COUNT_KEY"
provides:
  - "quoteRequestsService.getOrderPrefill(id, signal) and the OrderPrefill type"
  - "/admin/orders/new?fromRequest={id}: the skeleton until the prefill arrives, the form filled once as its starting point, the prefill note with View Request, the linked save with the Converted toast line"
  - "The already-converted box above Save with Open Order and Save as a New Order Instead; the not-found note; the save-time not-found banner"
  - "ProblemDetails.orderId and ProblemDetails.orderNumber (core/api)"
  - "R2: Turn into Order (primary) first in the actions; Open Order {number} once Converted; the history row Converted to order {number} with the number as a link"
  - "OrderCustomerCard: the From quote request row after Email (View Request link, or text in the deleted view)"
  - "web/e2e/quote-convert.spec.ts (@quote staff turn a request into an order)"
affects: [13-23, 13-24, 13-25, 13-26]

actuals:
  tokens: 18100
  tasks: 3
  commits: 6
plan_head_before: 0b70ea0d730343b3002297b6a3510102d49002f8
plan_head_after: f882bd0e963475a9c2072967c21973a288e531d7

tech-stack:
  added: []
  patterns:
    - "A form opened from another record takes that record's values as its RHF defaultValues, so the unsaved-changes guard starts from them"
    - "A save that may link to another record carries the link in the submission data, so dropping the link gives a new Idempotency-Key by itself"
    - "A load that has no data counts as failed while errorUpdatedAt > dataUpdatedAt, and the last error is held, so the alert and Try Again stay while it reads again"
    - "A URL parameter that fails its check is dropped once with setSearchParams({ replace: true }) behind a ref"

key-files:
  created:
    - web/src/modules/admin/components/OrderCustomerCard.test.tsx
    - web/e2e/quote-convert.spec.ts
  modified:
    - web/src/modules/admin/services/quoteRequestsService.ts
    - web/src/modules/admin/services/quoteRequestsService.test.ts
    - web/src/modules/admin/services/ordersService.ts
    - web/src/modules/admin/pages/OrderFormPage.tsx
    - web/src/modules/admin/pages/OrderFormPage.test.tsx
    - web/src/modules/admin/orderFormCopy.ts
    - web/src/modules/admin/orderFormSchemas.test.ts
    - web/src/modules/admin/components/orderForm.recipe.ts
    - web/src/modules/admin/components/OrderCustomerCard.tsx
    - web/src/modules/admin/components/orderPage.recipe.ts
    - web/src/modules/admin/components/QuoteHistoryCard.tsx
    - web/src/modules/admin/pages/QuoteRequestPage.tsx
    - web/src/modules/admin/pages/QuoteRequestPage.test.tsx
    - web/src/modules/admin/quoteRequestsCopy.ts
    - web/src/core/api/http/HttpError.ts
    - web/src/core/api/http/HttpError.test.ts

key-decisions:
  - "The prefill query lives under ['quote-requests', 'order-prefill', id] with gcTime 0 and no focus refetch, so each opening reads afresh and the form fills once"
  - "The deleted-order view shows the From quote request row with the value Yes as text (owner item 1)"
  - "A save that answers 404 quote-requests.not-found drops the link, keeps every value and says so in the banner, so the next Save Order saves a plain order (owner item 2)"
  - "A failed prefill read (not a 404) reuses the order form's load error, Couldn't load the order form., with Try Again (owner item 3)"
  - "The already-converted box stays during its own unlinked save, with the spinner on its button, so focus is never lost"
  - "After a 409 already-converted or a save-time 404, ['quote-requests'] is read again as after a conversion, because the request changed"

requirements-completed: [INQ-06]

coverage:
  - id: D1
    description: "Turn into Order on any request but a Converted one opens the New Order form filled once from the request (name, team, contact, email, notes, the first item's product type), with the prefill note and View Request; leaving it untouched does not ask"
    requirement: INQ-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#Turn into Order: the prefill (INQ-06, D-20, UI-SPEC R3) (8 tests)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/QuoteRequestPage.test.tsx#offers Turn into Order first in the actions on a %s request (5 statuses)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/services/quoteRequestsService.test.ts#quoteRequestsService.getOrderPrefill (2 tests)"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-convert.spec.ts#@quote staff turn a request into an order"
        status: pass
    human_judgment: false
  - id: D2
    description: "Saving sends quoteRequestId, the saved toast gains The quote request is now Converted., and the inbox, the New count and the request page read again"
    requirement: INQ-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#saves the order with quoteRequestId, says the request is now Converted and reads the quote requests again"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-convert.spec.ts#@quote staff turn a request into an order"
        status: pass
    human_judgment: false
  - id: D3
    description: "A 409 already-converted keeps every value and shows the box above Save naming the order with Open Order and Save as a New Order Instead, which saves the same order with no link and a new Idempotency-Key; a request not found opens a blank form with the note; a fromRequest that is not a GUID is dropped with one replace"
    requirement: INQ-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#Turn into Order: a race or a missing request (D-23, UI-SPEC R3) (8 tests, axe included)"
        status: pass
      - kind: unit
        ref: "web/src/core/api/http/HttpError.test.ts#reads the orderId and orderNumber extensions of an already-converted quote request"
        status: pass
    human_judgment: false
  - id: D4
    description: "The order page shows From quote request with View Request after Email (text in the deleted view); a Converted request shows Open Order {number}, no status menu, Delete aria-disabled, and the history row Converted to order {number} with the number as a link"
    requirement: INQ-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderCustomerCard.test.tsx (4 tests, axe included)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/QuoteRequestPage.test.tsx#Turn into Order on the page (Converted cases, axe included)"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-convert.spec.ts#@quote staff turn a request into an order"
        status: pass
    human_judgment: false
  - id: D5
    description: "A 2,000-character message prefills Notes and passes the order schema unchanged"
    requirement: INQ-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/orderFormSchemas.test.ts#passes a 2,000-character quote request message in Notes unchanged (UI-SPEC R3)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The wording and the choices in owner items 1 to 3 (the deleted-view value, the save-time not-found banner, the reused load error)"
    verification: []
    human_judgment: true
    rationale: "These are owner calls on copy and behavior the UI-SPEC does not settle; no test can decide them"

duration: about 45 min
completed: 2026-11-23
---

# Phase 13 Plan 22: Staff turn a quote request into a prefilled order, and the two link both ways Summary

*Created: 2026-11-23T21:31:27-06:00 · Updated: 2026-11-23T21:31:27-06:00*

**Turn into Order opens the normal New Order form filled in from the request. Saving sends `quoteRequestId`, says the request is now Converted and refreshes the inbox and the New count. A race keeps every typed value and offers Open Order or Save as a New Order Instead. The order page links to its request, and a Converted request links to its order.**

## Performance

- **Duration:** about 45 min
- **Started:** 2026-11-23T20:46:23-06:00
- **Completed:** 2026-11-23T21:31:27-06:00
- **Tasks:** 3 (one tracer, two TDD)
- **Files:** 18 changed (2 new)

## What was built

- **Service.** `quoteRequestsService.getOrderPrefill(id, signal)` calls `GET /api/v1/quote-requests/{id}/order-prefill`. The `ordersService.create` comment now names the link and its 404 and 409.
- **The prefilled form (R3, D-20).** `/admin/orders/new?fromRequest={id}`:
  - reads `fromRequest` once. A value that is not a GUID opens a blank form and is dropped with one `replace` (T-13-64);
  - shows the P8 skeleton until both the business date and the prefill arrive, then fills the form once. The prefill is the form's starting point, so leaving without typing does not ask;
  - fills customer name, team, contact number, email, Notes and the first item's product type. The rest stays at the P8 defaults;
  - shows the info Note "Filled in from the quote request from {name}, received {Nov 21, 2026}. Add the items and prices, then save." with View Request. The unsaved-changes guard asks first when something was typed;
  - saves with `quoteRequestId`. The toast gains "The quote request is now Converted." and `['quote-requests']` is read again.
- **A race or a missing request (D-23).**
  - `409 quote-requests.already-converted`: every value stays. A danger box above Save says "This request is already an order: {ORD-2026-0160}." with "Open Order {number}" and the ghost "Save as a New Order Instead". That button saves the same order with no link and a new Idempotency-Key (the link is part of the submission data, so the data differs). With no order named, the box says "This request is already an order." with no link.
  - A prefill 404 opens a blank form with "Couldn't find that quote request. The form is blank."
  - A prefill read that fails another way shows "Couldn't load the order form." with Try Again. The alert and focus stay while it reads again.
  - `parseProblemDetails` now keeps `orderId` and `orderNumber`.
- **The two point at each other (D-21).**
  - R2 shows the primary `clipboard-list` "Turn into Order" first in the actions on any status but Converted.
  - A Converted request shows the secondary "Open Order {number}" instead, no Change Status, and Delete Request stays `aria-disabled`.
  - The history row reads "Converted to order {number} · {name} · {date}" with the number as a link.
  - The order page's customer card has the row "From quote request" after Email with "View Request" and the 16px arrow. In the deleted view the row shows "Yes" as text, with no link. `DeletedOrderPage` already renders the card with `readOnly`, so it needed no change.

## Task Commits

1. **Task 1 (tracer): Turn into Order fills the form, and saving converts the request**
   - RED `a99ae657` (test)
   - GREEN `04d71e06` (feat)
2. **Task 2: A race or a missing request never loses the typed order**
   - RED `1696f314` (test)
   - GREEN `d42005be` (feat)
3. **Task 3: The order and the request point at each other**
   - RED `4505923a` (test)
   - GREEN `f882bd0e` (feat)

## TDD record

The vitest TAP reporter writes multi-line failure messages (DOM dumps) that `gsd_run check tdd-red-evidence` reads as malformed. So the classifier ran on the targets whose failures fit on one line, and the UI failures were checked by hand from the real output.

- **Task 1, RED `a99ae657`.**
  - Classifier, target `quoteRequestsService.getOrderPrefill > calls GET /api/v1/quote-requests/{id}/order-prefill ...`: `RED_EVIDENCE_OK` (`target_test_failed`, "service.getOrderPrefill is not a function").
  - By hand, from the same run: 13 failed. Six were OrderFormPage prefill cases (Customer name expected "Juan Dela Cruz" but was empty, then no "Filled in from..." text, no View Request link, and no landing on the order page). Five were R2 Turn into Order cases ("Unable to find role=link name Turn into Order"). Two were the service tests. All failed on the missing behavior, none on setup.
  - The schema backstop (2,000 characters) passed from the start, as planned, and so did the plain-save guard.
  - GREEN `04d71e06`: 228 of 228 in the four files.
  - Tracer gate: `npm run e2e -- --grep "@quote" --project chromium` gave "20 passed (1.1m)", including "@quote staff turn a request into an order", before Task 2 started.
- **Task 2, RED `1696f314`.**
  - Classifier, target `parseProblemDetails > reads the orderId and orderNumber extensions ...`: `RED_EVIDENCE_OK`.
  - By hand: six OrderFormPage cases failed. Five could not find `role="alert"` (no box, and no banner for the save-time 404). The not-found case could not find the "New Order" heading, because a 404 still showed the load error.
  - Two cases passed on the Task 1 code: the non-GUID drop and the held load error. Task 1 already built both, because its action asked for the GUID check, and the failure display was part of the loading state.
  - GREEN `d42005be`: 266 of 266. The RED test expected a unit price of `780`, but the field pads it to `780.00` on blur, so the GREEN commit fixed that expectation.
- **Task 3, RED `4505923a`.** By hand: six failed.
  - The card's terms had no "From quote request".
  - "Unable to find role=link name Open Order ORD-2026-0160".
  - The history row read "Converted · Maria Santos · ...".
  - GREEN `f882bd0e`: 71 of 71 with no-long-dash and the recipe test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The 409 extensions never reached the page**
- **Found during:** Task 2
- **Issue:** `parseProblemDetails` keeps only named members, so `orderId` and `orderNumber` were dropped.
- **Fix:** `ProblemDetails` gains both, read as text. There are new tests, so `core/api` stays at 100%.
- **Files:** `web/src/core/api/http/HttpError.ts`, `HttpError.test.ts`
- **Commits:** `1696f314`, `d42005be`

**2. [Rule 2 - Missing critical] A save that finds the request deleted**
- **Found during:** Task 2
- **Issue:** The server answers `404 quote-requests.not-found` and saves nothing. The link would then stay on the form, so every later save would fail the same way.
- **Fix:** The link is dropped, every value stays, and the banner says "Couldn't find that quote request." / "Press Save Order to save the order without it." The next save is a plain order with a new key. The wording is owner item 2.
- **Commit:** `d42005be` (test in `1696f314`)

**3. [Rule 2 - Missing critical] Read the quote requests again after a refused conversion**
- **Issue:** After a 409 already-converted or a save-time 404, the request has changed, but the inbox, the count and the request page would have shown old data.
- **Fix:** Both outcomes invalidate `['quote-requests']`, as a conversion does. Tested on the 409.
- **Commit:** `d42005be`

**4. [Rule 3 - Blocking] Files outside the plan's list**
- **Recipes:** `orderForm.recipe.ts` gains `orderFormToastLineClasses` and `orderFormConvertedClasses`, and `orderPage.recipe.ts` gains `orderMetaLinkClasses`.
- **History:** `QuoteHistoryCard.tsx` takes the order for the "Converted to order {number}" link.
- **Copy:** The order page row's copy is in `quoteRequestsCopy.ts` (`orderLink`), which the plan's acceptance grep names.

**5. [Rule 3 - Blocking] No `web/node_modules` in the worktree**
- **Fix:** I ran `npm ci` from the existing lockfile (583 packages). Nothing was added or bumped, and `node_modules` is git-ignored.

**Total deviations:** 5 auto-fixed (2 Rule 2, 3 Rule 3). **Impact:** each one is needed for correctness or to finish the work. No scope creep, and no server change.

## Owner items (A built, B alternative)

1. **The deleted-order view's "From quote request" value.**
   - A, built: the word "Yes" as text. The spec says "as text without the link" but names no text.
   - B: keep the "View Request" link. A soft-deleted order keeps its request, so the request page still works.
2. **A save that finds the request deleted (404).**
   - A, built: the banner "Couldn't find that quote request." / "Press Save Order to save the order without it.", the link is dropped and the values stay.
   - B: other wording, or ask before saving the order without the link.
3. **A prefill read that fails (not a 404).**
   - A, built: the order form's own "Couldn't load the order form." with Try Again.
   - B: a separate line such as "Couldn't load the quote request."
4. **The icon of the "From quote request" row.**
   - A, built: `inbox`, the Quote Requests menu icon.
   - B: another icon from the set.

## Issues Encountered

- `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions" fails in this worktree, also when run alone ("No packages found in this path"). 13-09, 13-12 and 13-14 recorded the same failure in fresh worktrees. None of its inputs changed here.

## Checks (evidence seen)

- Task files, after each GREEN: 228 of 228 (Task 1), 266 of 266 (Task 2), 71 of 71 (Task 3). No stderr lines.
- Full web suite (`npx vitest --run`): "Test Files 1 failed | 451 passed (452)", "Tests 1 failed | 12062 passed (12063)". The one failure is the worktree license-policy case above. It fails the same way alone.
- `npm run typecheck`: exit 0, no output.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0, no output.
- `npx prettier --check src e2e`: "All matched files use Prettier code style!"
- e2e `npm run e2e -- --grep "@quote" --project chromium`, after Task 3: "20 passed (1.2m)", including "@quote staff turn a request into an order" (21.5s). The fixture guard saw no console error, CSP violation or undeclared failed response.
- Budget table from that e2e build:
  - admin JS 226.00 KB of 250.00 (225.87 after 13-21);
  - Quote form 44.39 of 45.00;
  - CSS 20.55 of 35.00.
  - No limit changed.
- Preflight before each e2e run: ports 5180, 5115, 7028 and 5199 free, and no dev or test processes. After the runs no process of mine was left.
- gitleaks (pre-commit hook) on every commit: "no leaks found". The staged text has only test names (Juan Dela Cruz, Maria Santos, E2E Convert) and fake ids, and no paths, emails or server names beyond `example.test`.

## Threat model

- T-13-64: `fromRequest` is checked as a GUID, a bad value is dropped with one replace, and the server checks the id again on save (tested).
- T-13-65: the 409 box keeps every value and offers the unlinked save (tested).
- T-13-SC: no package was added or bumped.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

Ready for 13-23. The orchestrator runs the full gate after the merge.

## Self-Check: PASSED

- FOUND: web/src/modules/admin/components/OrderCustomerCard.test.tsx, web/e2e/quote-convert.spec.ts
- FOUND commits: a99ae657, 04d71e06, 1696f314, d42005be, 4505923a, f882bd0e (all ancestors of HEAD)
- Acceptance greps:
  - `fromRequest` in OrderFormPage.tsx: 9 (needs 1 or more);
  - "Save as a New Order Instead" in orderFormCopy.ts: 1 (needs 1 or more);
  - "From quote request" in the three named files: 3 in total (needs 1 or more).

---
*Phase: 13-quote-inquiries*
*Completed: 2026-11-23*

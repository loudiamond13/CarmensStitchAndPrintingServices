---
phase: 13-quote-inquiries
created: 2026-11-23T21:41:53-06:00
updated: 2026-11-23T21:41:53-06:00
reviewed: 2026-11-23T21:41:53-06:00
depth: standard
wave: 10
plans: [13-22]
diff: 0b70ea0d..505134ad
files_reviewed: 18
files_reviewed_list:
  - web/e2e/quote-convert.spec.ts
  - web/src/core/api/http/HttpError.test.ts
  - web/src/core/api/http/HttpError.ts
  - web/src/modules/admin/components/OrderCustomerCard.test.tsx
  - web/src/modules/admin/components/OrderCustomerCard.tsx
  - web/src/modules/admin/components/QuoteHistoryCard.tsx
  - web/src/modules/admin/components/orderForm.recipe.ts
  - web/src/modules/admin/components/orderPage.recipe.ts
  - web/src/modules/admin/orderFormCopy.ts
  - web/src/modules/admin/orderFormSchemas.test.ts
  - web/src/modules/admin/pages/OrderFormPage.test.tsx
  - web/src/modules/admin/pages/OrderFormPage.tsx
  - web/src/modules/admin/pages/QuoteRequestPage.test.tsx
  - web/src/modules/admin/pages/QuoteRequestPage.tsx
  - web/src/modules/admin/quoteRequestsCopy.ts
  - web/src/modules/admin/services/ordersService.ts
  - web/src/modules/admin/services/quoteRequestsService.test.ts
  - web/src/modules/admin/services/quoteRequestsService.ts
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
status: issues_found
---

# Phase 13: Code Review Report (wave 10, plan 13-22)

*Created: 2026-11-23T21:41:53-06:00 · Updated: 2026-11-23T21:41:53-06:00*

**Reviewed:** 2026-11-23T21:41:53-06:00
**Depth:** standard (with call-chain checks into `useSubmission`, `Button`, `parseProblemDetails`, the order and quote schemas, the routes and the server prefill handler)
**Files Reviewed:** 18 (the 13-22 summary is a planning file and was read for context only)
**Status:** issues_found

## Summary

I read the whole 13-22 diff, plus the code it calls. I did not run tests, a dev server or Playwright.

Most of the focus points hold up:

- **The prefill fills once.** `NewOrderPage` reads `fromRequest` once into state. It opens `CreateOrderForm` only after both the business date and the prefill arrive, and `opened` is set once. So a later refetch cannot overwrite typed values.
- **`fromRequest` is checked.** It must match the GUID test. A bad value is dropped with one `replace`. Every path built from it goes through `encodeURIComponent` and starts with a fixed `/admin/...` prefix, so there is no open redirect (CWE-601). Every value from the server is rendered as React text, so there is no XSS (CWE-79).
- **Save as a New Order Instead gets a new Idempotency-Key.** The link is part of the submission data, so the data changes and `useSubmission` makes a new key. The test checks both the body and the key.
- **A 404 on save drops the link.** The values stay, and the next save sends a plain order with a new key (tested).
- **Double submit and retry are covered.** `useSubmission` hands back the in-flight promise. A 409 keeps the key for a same-data retry. A final 404 gets a new key. `Button` uses `aria-disabled` rather than `disabled`, so focus stays on the pressed button during the save.
- **The cache is refreshed.** `['quote-requests']` is invalidated after a linked save, after the 409 and after the save-time 404.
- **The unsaved-changes guard starts from the prefill.** The prefill values are the RHF `defaultValues`, so an untouched prefilled form is not dirty.
- **The `HttpError.ts` change is safe.** It keeps `orderId` and `orderNumber` only when they are strings. Nothing else from the server body is kept. Both branches are tested, so `core/api` coverage holds.
- **OR-4 and OR-5 hold.** No em or en dash was added (a grep of the added lines found 0). All calls go through `modules/admin/services`.

The real problems are at the edges:

- Browser Back after a save opens a freshly prefilled form for a request that is already Converted (WR-01).
- On a Converted request, "Open Order" leads to "not found" when that order was soft-deleted (WR-02).
- The order form's email check refuses an address that the shared server rule, and the quote form, accept. So a prefilled form can be blocked from saving (WR-03, OR-3).

## Warnings

### WR-01: Browser Back after a linked save opens the prefilled form again, for a request that is now Converted

**File:** `web/src/modules/admin/pages/OrderFormPage.tsx:371` (with `:915-922`)
**Issue:**
- After a save, the form calls `navigate('/admin/orders/{id}')` as a push. So the history entry `/admin/orders/new?fromRequest={id}` is still there.
- If staff press Back on the new order page, `NewOrderPage` mounts again. Because the prefill query has `gcTime: 0`, it reads the prefill again.
- The server prefill still answers for a Converted request. `GetOrderPrefillHandler` says so: "A Converted request still answers".
- So the form opens filled in, with the note "Filled in from the quote request ... Add the items and prices, then save." That reads as if the order was never saved.
- If staff add items and save, they get the 409 box. Its "Save as a New Order Instead" is one press away, so a duplicate order for the same lead is easy to make by mistake.
- Before this plan, Back after a save only gave a blank New Order form, which was harmless.

**Fix:** Pick one of these (an owner call if it changes the flow):
1. After a linked save, replace the form's history entry, so Back skips it. Recommended, as the smallest change:
   ```tsx
   void navigate(`/admin/orders/${order.id}`, quoteRequestId !== null ? { replace: true } : undefined);
   ```
2. Or add `status`, `orderId` and `orderNumber` to `OrderPrefillResponse`. For a Converted request, show the already-converted box up front instead of the "Filled in from" note.

Add a test for whichever is chosen. For option 1, it should check `router.state.historyAction === 'REPLACE'` after a linked save.

### WR-02: "Open Order {number}" on a Converted request leads to "not found" when that order was soft-deleted

**File:** `web/src/modules/admin/pages/QuoteRequestPage.tsx:227-230, 256-260`; `web/src/modules/admin/components/QuoteHistoryCard.tsx:57-61`
**Issue:**
- The request detail reads its order with the soft-delete filter lifted (`QuoteRequestReader.cs:137`, `IgnoreQueryFilters([SoftDeleteFilter])`). So `orderId` and `orderNumber` are still filled in after the order is soft-deleted.
- Both the "Open Order {number}" button and the history link point to `/admin/orders/{id}`. For a deleted order, `OrderPage` shows "This order was not found or was deleted."
- The deleted view is a separate route, `/admin/orders/deleted/:id`, and only a Manager can open it.
- The request also stays Converted, so it is locked: Delete Request is `aria-disabled`. Staff end up on a page whose only order link is a dead end.
- The UI spec does not cover this case, and the detail response carries no "deleted" flag, so the client cannot tell the two cases apart.

**Fix:** This is an owner call. Suggested:
1. The server adds `orderDeleted: boolean` to `QuoteRequestDetailResponse`.
2. The page links a Manager to `/admin/orders/deleted/{id}`.
3. For an Admin, show the number as text with a short reason, such as "Order ORD-2026-0160 was deleted."

The 409 box's "Open Order" link in `OrderFormPage.tsx:516` has the same gap, but it is rarer.

### WR-03: The order form refuses some emails that the server and the quote form accept, so a prefilled form can be blocked (OR-3)

**File:** `web/src/modules/admin/orderFormSchemas.ts:47` (reached from the prefill at `OrderFormPage.tsx:254`)
**Issue:**
- Both server validators use the same rule: `OrderRules.IsValidEmail` (`OrderDetailsFieldsValidator.cs:35` and `CreateQuoteRequestRequestValidator.cs:34`).
- The quote form's copy of that rule, `isPlainEmail` in `modules/public/quoteSchemas.ts:49-62`, accepts a domain ending in one trailing dot, such as `juan@example.com.`.
- The order form's copy is the regex `/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/`. It refuses that address.
- So when a visitor's stored email is in that form, the prefilled order form shows "enter a valid email". Staff must edit a value the server would accept.
- The mismatch goes the other way too. The order regex accepts `a..b@example.com` and `a(b)@example.com`, which the server refuses. Those only fail at the server, after the request is sent.
- Before this plan the gap was there but hard to reach. The prefill now copies one form's accepted value straight into the other form.

**Fix:**
1. Move `isPlainEmail` into `utils/validators` and use it in both schemas: `.refine((text) => text === '' || isPlainEmail(text), COPY.emailInvalid)`.
2. Run the order schema through the shared `tests/fixtures/email-cases.json` cases that the quote schema test already uses.
3. Add one prefill case with a trailing-dot email.

## Info

### IN-01: The prefill query sits under `['quote-requests']`, so the form's own invalidations read it again

**File:** `web/src/modules/admin/pages/OrderFormPage.tsx:918` (with `:295`, `:301`, `:376`)
**Issue:**
- The prefill query key is `['quote-requests', 'order-prefill', id]`, and the query is still active while the form is open.
- So the invalidations on the 409 and the save-time 404 each send a needless `GET .../order-prefill`. The form ignores the answer, because `opened` is already set.
- On the save-time 404 path, that read also answers 404. That puts a failed request in the browser console, against the zero console errors rule, and any future e2e of this path would need to declare it.
- On a successful save, the read starts and is then cancelled when the page unmounts.

**Fix:** Give the prefill a key outside the prefix, for example `['order-prefill', id]`. Or call `invalidateQueries({ queryKey: quoteRequestsKey, predicate: (q) => q.queryKey[1] !== 'order-prefill' })`.

### IN-02: The save-time 404 path has no test that it reads `['quote-requests']` again

**File:** `web/src/modules/admin/pages/OrderFormPage.test.tsx` (the test "keeps the values, drops the link and says so when a save finds the request deleted")
**Issue:** The summary says the invalidation is "Tested on the 409". The 404 branch at `OrderFormPage.tsx:300-301` calls it too, but no test checks it. If that line were removed, every test would still pass.
**Fix:** Spy on `invalidateQueries` in that test and check that `['quote-requests']` is among the invalidated roots.

### IN-03: After the save-time 404, the "Filled in from" note still links to the deleted request

**File:** `web/src/modules/admin/pages/OrderFormPage.tsx:444-454`
**Issue:**
- The banner says "Couldn't find that quote request." But the note above it still says the form was filled from that request, with a "View Request" link.
- That link now leads to the request page's not-found state.

**Fix:** Show the note only while `linkedRequest !== null` (or drop the link once the link is gone). This sits close to owner item 2 in the summary, so record it there.

### IN-04: The two toast lines have no separator in the text

**File:** `web/src/modules/admin/pages/OrderFormPage.tsx:378-382`
**Issue:**
- `{saved}<span className="block">The quote request is now Converted.</span>` gives the text "ORD-2026-0001 · Brgy. San Roque BallersThe quote request is now Converted.".
- On screen, `display: block` splits the two lines. But copy-paste, and some screen reader readings of the live toast, run the two sentences together.

**Fix:** Add `{' '}` before the span, or render the two lines as two block elements.

### IN-05: The 409 `orderId` is used in a link without the id check the rest of the module uses

**File:** `web/src/modules/admin/pages/OrderFormPage.tsx:297, 515-519`; `web/src/core/api/http/HttpError.ts:126`
**Issue:**
- `parseProblemDetails` keeps any string as `orderId`, and the box builds `/admin/orders/{encoded id}` from it.
- `encodeURIComponent` and the fixed prefix make this safe: there is no open redirect.
- But a value that is not a GUID would render a link to a not-found page. The request page checks its own route id with `isQuoteRequestId`.

**Fix:** Keep `HttpError.ts` generic. In the page, only show the link when `existing.id` passes a GUID check, and otherwise fall back to the no-link sentence. Also, `orderNumber` in `HttpError.ts:33` has no doc comment of its own.

### IN-06: The public JS budget row was not recorded after the `core/api` change

**File:** `web/src/core/api/http/HttpError.ts:31-33, 126-127`; `.planning/phases/13-quote-inquiries/13-22-SUMMARY.md` ("Budget table")
**Issue:**
- `HttpError.ts` ships in the public bundle. After W9, the public JS was 149.06 KB of the 150.00 KB limit on the privacy page, and 148.18 KB on contact.
- The 13-22 budget table lists only the admin, Quote form and CSS rows. The quote form chunk also moved, from 44.38 to 44.39 of 45.00.
- The change is tiny, but with under 1 KB of room left, the public rows should be in the evidence.

**Fix:** The orchestrator's gate run should quote the public contact and privacy rows of `npm run build:budget` for this wave.

### IN-07: `freshMobile()` is copied into five e2e specs

**File:** `web/e2e/quote-convert.spec.ts:12-15` (and the same helper in `quote-form`, `quote-inbox`, `quote-nav` and `quote-request` specs)
**Issue:** This plan adds a fifth copy of the same helper. If one copy changes (for example, the per-sender limit rules), the others drift.
**Fix:** Move it to `web/e2e/helpers.ts` next to `manilaDate`, and import it in all five specs.

## Checked and found sound

- **Retrying the load error.** The prefill load error keeps the same alert node and keeps focus on Try Again while it reads again (`errorUpdatedAt > dataUpdatedAt` plus `heldError`). This is tested.
- **The already-converted box keeps focus.** It stays up during its own unlinked save, so focus stays on its button. The busy and 400 banners still work after it.
- **Accessibility of the new parts.**
  - The new links have names that make sense in context: "View Request" after the term "From quote request", "Open Order {number}", and the order number in the history.
  - The icons are decorative. The axe tests cover the box, the note, the card row and the Converted request page.
  - The card's "View Request" and the box's "Open Order" carry `hitAreaClasses`. The note's "View Request" and the history number are links inside text, which WCAG 2.5.8 exempts and which the UI spec lists as "links inside text".
- **Layout at 320px.** The box stacks its text, link and button (`flex-col items-start`). The R2 actions row wraps (`flex-wrap`, full width below 1024px). The e2e checks there is no sideways scroll on the prefilled form.
- **OR-3 limits.** The name, team, contact and notes limits are the same in the quote form and the order form (100, 100, 30, 2,000). The server sends the contact number in its display form, which the order contact rule accepts. The 2,000-character backstop test is present.
- **The `fromRequest` drop.** The drop runs once behind a ref, survives StrictMode and makes no prefill read (tested).

---

_Reviewed: 2026-11-23T21:41:53-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

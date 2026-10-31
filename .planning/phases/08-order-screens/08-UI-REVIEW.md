---
phase: "08"
slug: "order-screens"
status: complete
overall_score: 18
max_score: 24
baseline: "08-UI-SPEC.md"
screenshots: not-captured
interaction_capture: off
created: "2026-10-30T14:20:00-05:00"
updated: "2026-10-31T02:56:30-05:00"
---

# Phase 08: UI Review (re-audit)

*Created: 2026-10-30T14:20:00-05:00 · Updated: 2026-10-31T10:30:00-05:00*

**Audited:** 2026-10-31 by `gsd-ui-auditor` (static code audit). **Baseline:** `08-UI-SPEC.md`. **Screenshots:** not captured, no server started. **Interaction captures:** off.

This re-audit follows the first review (17/24, 2026-10-30). Plans 08-25 to 08-29 changed the Discounts tab amount, the payment, refund and discount windows, the status menu and added two-staff e2e. Nothing was rendered, so Visuals, Color and Spacing stay provisional and capped at 3. The owner screenshot review (UIC-71) is still the visual check.

## Pillar Scores

| Pillar | Score | Key finding |
|---|---|---|
| 1 Copywriting | 3/4 | No long dash in order files or copy modules. About 25 SPEC-GAP strings still wait for the owner. |
| 2 Visuals | 3/4 | Not seen in a browser. Icon-only controls carry labels. The view switch name is still unconfirmed. |
| 3 Color | 3/4 | No hard-coded hex or rgb in the order files. Tones come from tokens. 60/30/10 and Espresso contrast unverified. |
| 4 Typography | 3/4 | Off-scale sizes are now in the spec (D-92). Weight classes in `.tsx` still unchecked. |
| 5 Spacing | 3/4 | No inline `style=`. Chip Clear buttons are still 22 px with an extra tap area. Now 24 px by D-98 (owner, 2026-10-31). |
| 6 Experience Design | 3/4 | Money windows now check fresh figures and the status menu reads on open. Full e2e not green at last run. |

**Overall: 18/24** (was 17/24)

## Top Fixes

1. **Chip Clear buttons stay at 22 px.** `filterChipClearClasses` in `components/lists/lists.recipe.ts` (line 274) plus `targetAreaClasses` in `FilterBar.tsx` (line 101). Axe `target-size` fails near the fixed phone tab bar (`@orders-filters` on pixel, `@long-text four-chip toolbars` in all 5 projects). Make the button 24 px, or teach the D-71 check the neighbor case. Owner call (deferred-items, 08-24 item 7). **Resolved by D-98 (owner, 2026-10-31):** the button is 24 px and the D-71 check is unchanged (quick 261031-3oo).
2. **Full e2e was red at the last full run.** 46 of 1428 failed before 08-25 to 08-29; the dialog-fit cause (559 px dialog against 553 px allowed) is not investigated. One unexplained timeout in `@orders-refunds` (chromium) after 08-29 was not traced. Run it with the trace kept and settle the dialog height.
3. **Visuals unseen.** Run the screenshot review in Blush and Espresso at 390, 820 and 1440 px. Look hard at the four 08-24 overflow fixes, the new refund and discount window hints ("You can refund up to"), and the item grid, which takes 2 or 3 lines on a laptop (08-13, owner call).
4. **Copy review for the owner.** Admin not-found placeholder wording, the always-named status in No matches, "Product: Loading…", the empty-form "fields need attention" caption, "Balance now" after a refund on a Cancelled order.
5. **Confirm the Grid/Table switch name.** `OrdersPage.tsx` has no `aria-label` of its own; the name must come from the shared control.
6. **Deferred refactors (no user impact).** IN-02, IN-03, IN-04 from the code review.

## Carry-forward of the first review

| # | Earlier finding | Outcome |
|---|---|---|
| 1 | Off-contract sizes 17, 18, 24, 28 px | Fixed in the contract. The spec now lists them as display money figures (D-92, owner 2026-10-30). Current uses: 17 px (`orders.recipe.ts` 61, 62), 18 px (`orderPage.recipe.ts` 178), 24 px (`orderForm.recipe.ts` 141), 28 px (`orderForm.recipe.ts` 160). All match the spec rows. |
| 2 | Chip Clear buttons under 44 px | Resolved by D-98 (owner, 2026-10-31): drawn 24 px, 44 px tap area kept. |
| 3 | Full e2e not green | Still open. Two-staff e2e added in 08-29 and the gate runs repeated; one unexplained timeout logged. |
| 4 | Visuals unseen | Still open. Parked for the owner screenshot review. |
| 5 | Item grid follows card width | Parked for the owner (08-13 deviation). |
| 6 | Copy review list | Parked for the owner. Unchanged. |
| 7 | View switch label unconfirmed | Still open. Axe passes in e2e. |
| 8 | Two "Edit Details" links | Parked for the owner. |
| 9 | Phone Settings tabs proved at 320 px on one tab | Still open, low. |

## Detailed Findings

### 1 Copywriting (3/4)

- OR-4: a grep for U+2014 and U+2013 across `web/src` (non-test files) found none. The repo guard `no-long-dash.node.test.ts` covers it.
- No generic labels. The new refund window uses `COPY.canRefund(cap)` as the Amount hint and a named "Save Refund" button.
- Parked: no ghost second Add button in empty tabs; panel titles and first-column headings are SPEC-GAP wording; the back link accepts any literal `/admin/orders` path.

### 2 Visuals (3/4)

- Refund and discount windows follow the shared `OrderWindow` shell, so they match the payment window.
- Not counted: one primary action per view, focal point, Espresso contrast. No render.
- The 404 view is a banner plus a button under it, because `ErrorState` has no action slot (SPEC-GAP).

### 3 Color (3/4)

- No hex or rgb literals in the order components or pages.
- Accent use stays on the spec's list: order number, tab underline, chips, Manager-only badge, Delivered.
- Credit uses the info tone, never red.

### 4 Typography (3/4)

- Raised from 2. Order-area arbitrary sizes now: 14 px (21), 11 px (9), 22 (4), 13 (4), 12 (4), 34 (2), 30 (2), 20 (2), 17 (2), 15 (2), 28 (1), 24 (1), 18 (1). All the display money sizes are named in the spec.
- Held at 3, not 4: the declared set is still wider than 4 sizes and 2 weights (spec dimension 4 is marked FLAG), and `font-bold` is far more common than `font-semibold`. Weight classes inside `.tsx` files were not checked.

### 5 Spacing (3/4)

- No `style=` in any order component or page, so strict CSP holds.
- Arbitrary values are font sizes and tracking (`tracking-[.1em]`).
- `ordersBalanceFilterClasses` is `min-h-10` (40 px); the owner checks its 44 px tap area.
- The chip Clear button (22 px) is the one real touch-target gap. D-98 (2026-10-31) makes it 24 px.

### 6 Experience Design (3/4)

- New since the first review: the Discounts tab shows the server's amount (08-25); payment, refund and discount windows follow the current order and read it once before refusing an amount, so another person's change no longer blocks a valid save (08-26, 08-28); the status menu reads the order on open (08-27); three two-staff journeys cover it in 5 projects (08-29).
- Still covered: skeletons, 404 view, locked and deleted banners, 409 conflict banner with Load Latest, dirty-form guard, delete and cancel confirms, Reopen window.
- Gaps: browser `beforeunload` prompt is manual; long-text toast not proved; the e2e is not fully green and one timeout is unexplained.
- Raised no higher because the full suite was not shown green after these plans.

## Files Audited

`web/src/modules/admin/pages/{OrdersPage,OrderFormPage,OrderPage,DeletedOrdersPage,DeletedOrderPage}.tsx`; the Order components including `OrderRefundModal`, `OrderDiscountModal`, `OrderStatusMenu` and `hooks/useOrderWindowFigures.ts`; recipes `orderForm`, `orderPage`, `orders`, `lists`; `components/lists/FilterBar.tsx`; `web/src/modules/admin/*Copy.ts`; plans 08-25 to 08-29 summaries; `deferred-items.md`.

Registry audit skipped (`shadcn_initialized: false`).

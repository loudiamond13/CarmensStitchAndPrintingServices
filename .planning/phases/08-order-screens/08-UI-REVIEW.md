---
phase: "08"
slug: "order-screens"
status: complete
overall_score: 17
max_score: 24
baseline: "08-UI-SPEC.md"
screenshots: not-captured
interaction_capture: off
created: "2026-10-30T14:20:00-05:00"
updated: "2026-10-30T14:20:00-05:00"
---

# Phase 08: UI Review

*Created: 2026-10-30T14:20:00-05:00 · Updated: 2026-10-30T14:20:00-05:00*

**Audited:** 2026-10-30 by `gsd-ui-auditor` (static code audit). **Baseline:** `08-UI-SPEC.md`. **Screenshots:** not captured, no server started.

The auditor read `08-UI-SPEC.md` and `deferred-items.md` in full and grepped the 38 Phase 8 order components, the 5 order pages, the recipe files and the copy modules. Nothing was rendered, so Visuals, Color, Spacing and parts of Experience Design are provisional and capped at 3. The owner's screenshot review (UIC-71, `npm --prefix web run review`) is still the visual check.

## Pillar Scores

| Pillar | Score | Key finding |
|---|---|---|
| 1 Copywriting | 3/4 | No em or en dash in any order file or copy module. Copy lives in the `*Copy.ts` modules. About 25 SPEC-GAP strings wait for the owner. |
| 2 Visuals | 3/4 | Icon-only controls have labels in the status menu, balance strip and item editor. `OrdersPage.tsx` has no `aria-label` of its own (the view switch takes its label from the shared `SegmentedControl`; check). Not seen in a browser. |
| 3 Color | 3/4 | No hard-coded hex or rgb; tones come from tokens. Credit uses the info tone, never red. Delivered uses the accent tone (owner decision pending). |
| 4 Typography | 2/4 | Sizes 17, 18, 24 and 28 px are outside the spec's declared and inherited lists. |
| 5 Spacing | 3/4 | No inline `style=`. The 40 px and 36 px heights match declared exceptions. |
| 6 Experience Design | 3/4 | Loading, error, not-found, locked, deleted, conflict and dirty-form states exist. Axe `target-size` still fails on the chip Clear buttons. |

**Overall: 17/24**

## Top Fixes

1. **Typography: off-contract sizes.** `text-[17px]` (6 uses), `text-[18px]` (2), `text-[24px]` (2, `orderItemsSubtotalFigureClasses`) and `text-[28px]` (2, `orderAsideTotalFigureClasses`) in `orderForm.recipe.ts` (lines 141, 160), `orderPage.recipe.ts` and `orders.recipe.ts`. The spec names only the 17 px table balance cell. Either add the display figures to the spec or move them onto the declared scale. Owner call.
2. **Touch targets under 44 px.** The filter chip Clear buttons are about 22 px and fail axe `target-size` near the fixed phone tab bar (`@orders-filters` on pixel, `@long-text four-chip toolbars` in all 5 projects). This predates plan 08-24. Fix to 24 px with a 44 px tap area, or teach the D-71 check the neighbor case. Owner call (`deferred-items.md`, 08-24).
3. **Full e2e not green.** 46 of 1428 failed on the first run. The dialog-fit, long-text toolbar and shell-pinning failures also fail at 5118c182, before 08-24. The dialog-fit cause (559 px dialog against a 553 px allowance) is not investigated yet.
4. **Visuals unseen.** Run the screenshot set in Blush and Espresso at 390, 820 and 1440 px. Look closely at the four 08-24 overflow fixes: header subline, balance figure, order card title, card footer buttons wrapping at about 222 px.
5. **Item grid follows the card width** (08-13), so items take 2 or 3 lines on a laptop. Owner call.
6. **Copy review.** Flag first: the admin not-found placeholder wording; the No-matches line that always names the status; "Product: Loading…" on the product chip; "7 fields need attention · unsaved changes" on an untouched form; "Balance now ₱X" after a refund on a Cancelled order (credit wording intended).

## Detailed Findings

### 1 Copywriting (3/4)

- OR-4 clean in the order files and `modules/admin/*Copy.ts` (grep for U+2014 and U+2013). The repo-wide `no-long-dash.node.test.ts` passes in the full vitest run.
- No generic labels ("Submit", "Click Here").
- Parked deviations: no ghost second Add button in empty tabs (08-16, 08-17, 08-18, 08-21); the panel titles and first-column headings are SPEC-GAP wording; two "Edit Details" links with the same name on an open order (header and customer card).

### 2 Visuals (3/4)

- One primary action per view is claimed in the spec; not counted without rendering.
- The summaries report axe and layout checks passing in 5 browser projects.

### 3 Color (3/4)

- Accent is used for the order number, tab underline, chips, the Manager-only badge and Delivered, all on the spec's reserved list.
- Not verified: the 60/30/10 split and Espresso contrast.

### 4 Typography (2/4)

Sizes in use (count): 14 (39), 11 (17), 13 (7), 17 (6), 22 (5), 12 (5), 30 (4), 20 (4), 15 (4), 34 (3), 28 (2), 24 (2), 18 (2). `font-bold` 21 times against 8 `font-semibold`; bold comes from the inherited recipes (700). Weight classes inside `.tsx` files were not checked.

### 5 Spacing (3/4)

- Strict CSP holds: no inline styles.
- Arbitrary values are mostly pixel font sizes and `tracking-[.1em]`.
- `ordersBalanceFilterClasses` is `min-h-10` (40 px), inside the toolbar exception; the owner checks its 44 px tap area.

### 6 Experience Design (3/4)

- Covered: skeletons, 404 view, locked banner, deleted banner, 409 conflict banner, dirty-form guard with discard dialog, delete and cancel confirms, Reopen window.
- Gaps: the browser `beforeunload` prompt (manual); Grid/Table switch keeping the page (owner call, 08-11); phone Settings tabs checked at 320 px on Product Types only; toast with long text not proved (no flow produces it).

## Files Audited

`web/src/modules/admin/pages/{OrdersPage,OrderFormPage,OrderPage,DeletedOrdersPage,DeletedOrderPage}.tsx`; 38 Phase 8 files in `web/src/modules/admin/components/` (Order*.tsx, DueFlag, CancelOrderDialog, DeleteOrderDialog, ListEntrySelect, ListSettingsSection); the `orderForm`, `orderPage`, `orders` and `settings` recipes; `web/src/modules/admin/*Copy.ts`; `web/src/utils/csps.ts`.

Registry audit skipped (`shadcn_initialized: false`).

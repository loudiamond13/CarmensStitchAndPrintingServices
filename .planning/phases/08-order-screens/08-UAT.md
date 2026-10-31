---
status: complete
phase: 08-order-screens
source: [08-VERIFICATION.md]
started: 2026-10-30T16:00:00-05:00
created: 2026-10-30T16:00:00-05:00
updated: 2026-10-31T07:21:44.725Z
---

# Phase 08: Owner Checks (UAT)

*Created: 2026-10-30T16:00:00-05:00 · Updated: 2026-10-31T00:05:00-05:00*

## Current Test

[testing complete]

## Tests

### 1. Browser leave prompt on a dirty form (ORD-15)
expected: On New Order and Edit Order, change a field, then reload or close the tab: the browser asks to confirm. A clean or saved form never asks.
result: pass

### 2. UIC-71 screenshot review (`npm --prefix web run review`)
expected: Orders, New Order, Order detail and Deleted Orders look right in Blush and Espresso at 390, 820 and 1440 px. Look hard at the four overflow fixes from 08-24: header subline, balance figure, order card title, card footer buttons wrapping at about 222 px.
result: pass

### 3. SPEC-GAP copy review (about 25 strings)
expected: Accept or rewrite each sentence. Flag first: the admin not-found wording, the No-matches line, "Product: Loading...", "7 fields need attention" on an untouched form, "Balance now" after a refund on a Cancelled order.
result: pass
note: Owner accepted all SPEC-GAP copy as built, including "Balance now" after a refund on a Cancelled order (asked and confirmed 2026-10-30).

### 4. Parked UI rulings (deferred-items.md)
expected: A decision on the Delivered badge tone, the Grid/Table switch keeping the page, off-spec font sizes 17/18/24/28 px, and the chip Clear buttons under 44 px (these fail axe target-size on the pixel project).
result: pass
note: Ruled D-90 to D-93 in 08-CONTEXT.md. Keep Delivered orange; Grid/Table keeps the page; add 17/18/24/28 px to the spec; chip Clear stays 22 px (owner accepts the target-size failures).

### 5. Code review findings WR-01, WR-02, WR-05, the WR-03 follow-up and IN-08
expected: Pick an option for each (options and recommendations in deferred-items, "From the end-of-phase code review").
result: issue
reported: "Owner chose the recommended fix for WR-01 (server sends each discount amount), WR-02 (refresh figures, then check caps) and WR-05 (refetch when the status menu opens); leave IN-08 and WR-03 as built. Rulings D-94 to D-97."
severity: major

### 6. DOM-WR-04 read carried from Phase 7
expected: Read LegacyEditFilter.cs and the six UpdateOrder*Handler.cs files. Unchanged legacy values do not block an edit; changed fields are fully checked.
result: pass

### 7. O1 two-staff owner check (08-29)
expected: Two real browsers, two real staff, one test order. (1) A opens Add Payment, B removes a payment, A types an amount the old balance refused and saves: it goes through if the server allows it; a stale version shows the conflict banner with Load Latest and the typed values kept. (2) With Add Payment open, B changes the balance, A returns to the tab: the Balance due hint follows without pressing Save. (3) B records the last payment, A opens Change Status: Mark Completed is enabled with no reason line, and completes the order. (4) On an order with a percent discount, the Discounts tab Amount column shows peso figures that add up to the Total discount footer and move when an item changes.
result: pass

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-08-5
  truth: "Owner rulings D-94 to D-96 hold: discount amounts come from the server, money caps check against current figures, and Mark Completed reads current figures."
  status: resolved
  resolved_by: 08-29-PLAN
  resolved_at: 2026-10-30
  reason: "User reported: chose the recommended fixes for WR-01, WR-02 and WR-05 (D-94 to D-96)."
  severity: major
  test: 5
  root_cause: "Diagnosed in 08-REVIEW.md: WR-01 OrderDiscountsTab.tsx computes each discount amount in the browser; WR-02 the payment, refund and discount windows check caps against the snapshot taken when the window opened; WR-05 the status menu disables Mark Completed from the page's last answer."
  artifacts:
    - path: "web/src/modules/admin/components/OrderDiscountsTab.tsx"
      issue: "WR-01 browser money math for each discount row"
    - path: "08-REVIEW.md WR-02, WR-05"
      issue: "stale figures behind client caps and the Mark Completed state"
  missing:
    - "D-94: add Amount to each discount in the order answer, regenerate API types, show it on the Discounts tab"
    - "D-95: refresh window figures on focus and on a failed cap check, then re-check"
    - "D-96: refetch the order when the status menu opens"
  debug_session: ""

---
status: testing
phase: 08-order-screens
source: [08-VERIFICATION.md]
started: 2026-10-30T16:00:00-05:00
created: 2026-10-30T16:00:00-05:00
updated: 2026-10-30T16:00:00-05:00
---

# Phase 08: Owner Checks (UAT)

*Created: 2026-10-30T16:00:00-05:00 · Updated: 2026-10-30T16:00:00-05:00*

## Current Test

number: 1
name: Browser leave prompt on a dirty form
expected: |
  On New Order and Edit Order, change a field, then reload or close the tab: the browser asks to confirm. A clean or saved form never asks.
awaiting: user response

## Tests

### 1. Browser leave prompt on a dirty form (ORD-15)
expected: On New Order and Edit Order, change a field, then reload or close the tab: the browser asks to confirm. A clean or saved form never asks.
result: [pending]

### 2. UIC-71 screenshot review (`npm --prefix web run review`)
expected: Orders, New Order, Order detail and Deleted Orders look right in Blush and Espresso at 390, 820 and 1440 px. Look hard at the four overflow fixes from 08-24: header subline, balance figure, order card title, card footer buttons wrapping at about 222 px.
result: [pending]

### 3. SPEC-GAP copy review (about 25 strings)
expected: Accept or rewrite each sentence. Flag first: the admin not-found wording, the No-matches line, "Product: Loading...", "7 fields need attention" on an untouched form, "Balance now" after a refund on a Cancelled order.
result: [pending]

### 4. Parked UI rulings (deferred-items.md)
expected: A decision on the Delivered badge tone, the Grid/Table switch keeping the page, off-spec font sizes 17/18/24/28 px, and the chip Clear buttons under 44 px (these fail axe target-size on the pixel project).
result: [pending]

### 5. Code review findings WR-01, WR-02, WR-05, the WR-03 follow-up and IN-08
expected: Pick an option for each (options and recommendations in deferred-items, "From the end-of-phase code review").
result: [pending]

### 6. DOM-WR-04 read carried from Phase 7
expected: Read LegacyEditFilter.cs and the six UpdateOrder*Handler.cs files. Unchanged legacy values do not block an edit; changed fields are fully checked.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

# Owner items parked during Phase 10 execution

*Created: 2026-11-07T00:45:00-06:00 · Updated: 2026-11-07T01:05:00-06:00*

The owner went away during the Phase 10 run (2026-11-06). Anything that needs the owner is parked here instead of blocking the run. Nothing here was decided for the owner.

## P10-BL-01 · Imported orders and this month's dashboard figures (wave 2 review WR-02)

**Status:** open · **Blocks:** nothing in Phase 10. Matters for Phases 15 to 17 (legacy import and cut-over).

The legacy import sets an order's "status changed" time to the moment of import when the old data has no status history, and the created time is stamped when the row is saved. After the Phase 17 import, every old Completed order would count as "Completed this month", and "Recent orders" would show the last six imported rows instead of real new orders.

- **A (recommended):** the import carries the legacy dates over: created time from the legacy order date, status-changed time from the best legacy date (completion or last update). Add this to the Phase 15/16 import plans.
- **B:** keep import-time stamps and accept odd dashboard figures for the cut-over month.

## P10-BL-02 · "View all" from the dashboard's recent orders (wave 2 review info)

**Status:** open · **Blocks:** nothing. The dashboard's "Recent orders" is newest created first. The Orders list's "Newest first" sort may order differently, so a "View all" link could show a different first page. Recommended: make the Orders list "Newest first" sort by created time, matching the dashboard. Plan 10-07 was told not to change it.

## P10-BL-03 · Future-dated expenses in the dashboard chart (plan 10-06, coverage D7)

**Status:** open · **Blocks:** nothing; built and tested as below.

The chart counts an expense in the month of its date. So an expense dated later this month counts in this month's bar now, and one dated next month shows in no bar until next month arrives. The planner assumed this; no ruling covers it.

- **A (recommended):** keep it. It matches how the Collected card and the expenses page read dates.
- **B:** count only expenses dated up to today, so this month's bar never includes future-dated items.

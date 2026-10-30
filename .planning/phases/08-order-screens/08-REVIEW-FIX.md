---
phase: 08-order-screens
created: 2026-10-30T14:40:00-05:00
updated: 2026-10-30T14:40:00-05:00
review_path: .planning/phases/08-order-screens/08-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 8: Code Review Fix Report

*Created: 2026-10-30T14:40:00-05:00 · Updated: 2026-10-30T14:40:00-05:00*

Source review: `.planning/phases/08-order-screens/08-REVIEW.md`. Only the chosen subset was in scope. WR-01, WR-02, WR-05, IN-02, IN-03 and IN-04 were not touched: they wait for the owner. Work was done in the main checkout on `gsd/phase-08-order-screens` (no worktree), so the gate numbers below are reproducible from this tree.

## Fixed

### WR-04: The delete dialog and the deleted order page shared one query key

- Red: `b7745308`. Green: `1e922883`. Lint follow-up on the new test: `583360b0`.
- The dialog now reads its counts under `['order-deleted-counts', id]` (`useDeletedOrderCountsQuery`). The page keeps `['order-deleted', id]`.
- Tests (`DeletedOrderPage.test.tsx`): opening the dialog does not refetch the page query (`dataUpdateCount` stays 1), and a 404 on the dialog read does not put the page query in an error state; the dialog leaves to the list.

### WR-03: The "business today" could be a stale day from the cache

- Red: `4fed0e17`. Green: `d77afce0`.
- `useBusinessTodayState(enabled, maxAgeMs)` ignores held order answers (and its own earlier probe answer) older than `HELD_TODAY_MAX_AGE_MS` (5 minutes) or invalidated, and asks the existing probe instead. No endpoint added. Age is judged with TanStack's `isStaleByTime`, so no device clock read was added.
- The payment, refund and expense windows already take `today` from `opened.order.today` (the answer they opened with), so they needed no change.
- New Order keeps the day it opened on (`NewOrderPage` latches it), so the form is never swapped for a skeleton mid-typing when the held answer ages out. A form test proves the form and typed values survive an old day being read again (it fails without the latch).
- Orders list: passes `null` (no age bound), because its own list answers keep the day fresh and a bound would blank the list every 5 minutes. This is the one place that is not bounded. Say if you want it bounded too.
- Tests use a fake `Date` across midnight in Manila (15:00Z to 16:10Z).

### IN-07: A sync throw in `onSuccess` left the action generation stuck

- Red: `af145105`. Green: `d444d4d4`.
- The generation now advances on a sync throw (the throw still reaches the caller) and on any end of the returned promise (`finally`). New file `useOrderAction.test.tsx`.

### IN-05: The boundary guards missed lowercase-named files

- Red: `082e1de6`. Green: `a567ccff`.
- `orders-boundaries.node.test.ts` now scans every non-test `.ts`/`.tsx` under `modules/admin` whose name contains order or deleted (any case) plus all of `modules/admin/hooks`. The clock guard also covers `DueFlag.tsx`. All three guards (public site, raw HTML, clock) use one shared stripper that keeps strings and template literals, so a `//` inside a string no longer hides the rest of its line. A test also checks no real admin file ends inside a string or template (drift check).
- The wider scan found one clock user, `modules/admin/hooks/useSessionCapWarning.ts`. It counts down to the session expiry (a moment in time, not the business day), so it is allow-listed with a one-line reason. No other violation.

### IN-06: Email regex comment

- `92098aad` (comment only). Notes that the regex is deliberately stricter than the server on quoted local parts.

### IN-01: Misplaced doc block in `OrdersPage`

- `ca018115` (comment only). The "A list row as the card takes it" block now sits above `toCardOrder`.

## Skipped

### IN-08: `OrdersPage` page count from the unsettled size

**File:** `web/src/modules/admin/pages/OrdersPage.tsx:114-124`
**Reason:** The written fix (use `settled.size` for the page count and clamp) is wrong for this page, and no failing test can be written for the current code.
- `total` does not depend on the page size, so `ceil(total / values.size)` is correct for the live page. `clampPage` and the pager (`page={values.page}`, `pageSize={values.size}`, `pageCount`) all work on the live values. Switching only the count to `settled.size` would make the clamp and "Page X of Y" disagree with the live page and size (for example it would clamp a valid page 4 at 10 rows per page back to page 3 while a search is still settling).
- A size change also resets the live page to 1, so the clamp has no wrong answer to give in the short window.
- The reviewer's other option (gate the clamp until `settled.size === values.size`) needs a behavior call and has no reproducible failure to protect against. Parked for the owner.

## Gates (run from the main checkout, `C:/Work/CarmensStitchAndPrintingServices`)

- `npm run typecheck`: clean (all three tsc projects).
- `npm run lint` (`eslint . --max-warnings 0`): clean, 0 warnings.
- `npx prettier --check src e2e` (inside `web/`): "All matched files use Prettier code style!".
- `npx vitest run`: Test Files 268 passed (268), Tests 7498 passed (7498). The only console noise is four jsdom lines "Not implemented: navigation to another Document" from `OrdersTable.test.tsx`. They also appear on the commit before these fixes (`741f15e6`), so they are not new.
- Related e2e after preflight (ports 5180, 5115, 7028, 5199 free, no other dev processes): `--grep "@orders-deleted|@orders-deleted-view|@orders-list|@orders-journeys|@orders-create|@orders-delete|@orders-view" --project chromium`: 21 passed (1.6m), no flake.
- `npm --prefix web run verify`: exit 0. Coverage: Statements 95.72%, Branches 90.74% (12763/14064), Functions 97.37%, Lines 98.09%. Budget build, license gate and notices check passed.

Flakes: none seen. No package, schema, SQL, trigger or API contract change.

---

_Fixed: 2026-10-30T14:40:00-05:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

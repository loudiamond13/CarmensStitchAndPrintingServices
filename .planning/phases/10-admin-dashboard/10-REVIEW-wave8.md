---
phase: 10-admin-dashboard
wave: 8
plans: [10-16, 10-17]
created: 2026-11-07T23:25:00-06:00
updated: 2026-11-07T23:25:00-06:00
reviewed_range: c4eea685..3d094237 (excluding .planning/)
depth: deep
files_reviewed: 50
findings:
  critical: 0
  warning: 2
  info: 8
  total: 10
status: issues_found
---

# Phase 10 Wave 8 Code Review (plans 10-16 and 10-17)

*Created: 2026-11-07T23:25:00-06:00 · Updated: 2026-11-07T23:25:00-06:00*

## Summary

I reviewed the four new read routes and their access rule (10-16: `StaffMoneyAccess`, the three handlers, the reader's role and transfer list, the controllers, the matrix rows, the docs and the contract). I also reviewed the ledger on My Money (10-17: `moneyService.ledger`, `parseLedgerPage`, `useLedgerQuery`, `useMoneyListParams`, `LedgerTable`, `LedgerCard`, the copy, the recipe and the e2e). I traced each handler into `StaffDirectory`, `StaffMoneyReader`, `MoneyParties`, the Staff and Manager policies and the session check, and each web part into `createListParams`, `ResponsiveTable` and `Pagination`.

What holds:

- **Admin access.** An Admin cannot see another person's figure, a leaver's figure or a deleted transfer through any route. `StaffMoneyAccess.Check` runs on the caller's own account row before anything about the requested id is read. The 403 body is the same for a real coworker, a leaver, the legacy holder and a made-up id, and the work done before it does not depend on the id, so timing gives nothing away. `deleted=true` from an Admin is a 403 on both ledger routes and on the transfer list before any read, and the transfer list sets `involving = caller` for an Admin. The Manager policy reads the token role, and a role change revokes every session (`UpdateUserHandler.cs:21`, `:201-204`), so an old Manager token cannot outlive a demotion.
- **Declarations and matrix.** Every new action carries `[Authorize(Policy = ...)]` (Manager on `GET /staff-money`, Staff on the rest). The matrix has rows for all four routes, with 401/403/200 and 401/403/404 where they apply.
- **Money.** Totals and balances are `decimal` and worked out on the server. The total is the sum of the listed rows. `GetLedgerPageAsync` is unchanged: the serializable read, the three-attempt retry on SQL 1205 and the refusal to run inside an outer transaction are all still there. Deleted transfers never count: `CountedTransfers` is the only sum source. In the ledger, a deleted row shows its face amount in Money in or Money out and "Not counted" under Balance (P10-BL-10 option A).
- **Paging.** Paging is stable within a read: the transfer list orders by date, then time recorded, then id. The validator limits are 1 to 100 and 1 to 100000, the same as the URL parsers.
- **Rules check.** No inline SQL, no new package, no schema change and no trigger. No em or en dash was added (I checked every added line of the diff byte by byte).
- **Web.** Every ledger figure goes through `toFiniteFigure`, and a bad figure or an unknown kind refuses the whole page. The calls live only in `modules/admin/services`. The loading flags match the LoadingRegion rule. The placeholder rows never cross people. `deleted` is never sent for an Admin: the card checks the role and the hook drops the value.

No critical issue was found. Two warnings and eight info items follow.

## Critical

None.

## Warning

### WR-01: A page past the last says "No money in or out yet" next to "Showing 45 entries" until the last page loads

**Files:** `web/src/modules/admin/components/LedgerCard.tsx:45-57`, `:82-108`; `web/src/components/lists/ResponsiveTable.tsx:216-219`; `web/src/modules/admin/hooks/useLedgerQuery.ts:24-25`

**Issue:** A page past the last comes back from the server as `items: []` with the real `total`. `ResponsiveTable` treats any row-less page that is not pending and not failed as empty (`empty = !pending && !failed && !hasRows`). So the card draws the EmptyState "No money in or out yet". At the same time the result bar reads "Showing 45 entries" and the pager reads "Page 9 of 3". The clamp then replaces the URL with the last page. `placeholderData` keeps the previous answer for the same person, which is the empty one, so the false empty state stays on screen, undimmed (`marked` needs `hasRows`), until the last page arrives. The status node also announces the empty state to screen readers. On a money screen this tells the person they have no money rows when they do. The test "replaces a page past the last with the last page" checks only the replace and the final rows, so it passes with this flash.

**Failure scenario:**

1. A Manager is on My Money `?page=3&size=10` with 25 entries.
2. They open an order from page 3, and the order is deleted (or 10-18 deletes transfers), leaving 15 entries.
3. They press Back. The server answers page 3 as empty with `total: 15`.
4. The card shows "Showing 15 entries", "Page 3 of 2" and "No money in or out yet. Payments you receive, transfers and expenses you pay show here." On a slow phone link this lasts until page 2 loads.

**Fix:** Treat a row-less page with a non-zero total as still loading, and keep it out of the placeholder:

```tsx
// LedgerCard
const pastTheEnd = page !== undefined && page.rows.length === 0 && page.total > 0;
const loading = (query.isFetching && (page === undefined || query.isError)) || pastTheEnd;
// and render the ResultBar and the pager only when !pastTheEnd

// useLedgerQuery
placeholderData: (previous, previousQuery) =>
  previousQuery?.queryKey[PERSON_AT] === userId && (previous?.rows.length ?? 0) > 0 ? previous : undefined,
```

Extend the test: delay the page 3 answer and assert that `queryByText('No money in or out yet')` stays null throughout. `OrdersPage`, `ExpensesPage` and the other clamped lists use the same pattern (`OrdersPage.tsx:128-159`), so the phase-end review may want one shared fix.

### WR-02: After choosing a size that fits every row, "Rows per page" disappears and the smaller sizes cannot be chosen again

**Files:** `web/src/modules/admin/components/LedgerCard.tsx:98-109`; `web/src/components/lists/Pagination.tsx:83-85`

**Issue:** The Rows per page select lives inside `Pagination`. `Pagination` returns null when `pageCount <= 1`, and the card also renders the pager wrapper only when `pageCount > 1`. When the chosen size holds every row, the select is gone and only the URL can change the size back. The `size` value is kept in the URL, so the dead end survives a reload, Back and a shared link.

**Failure scenario:** Liza has 30 entries. At 20 rows per page she sees two pages and chooses 50 to see them all. The pager, and the select with it, vanish. She now wants 10 rows on her phone, but no control on the screen offers it. Each later visit through her history keeps `?size=50`.

**Fix:** Keep the size select whenever the ledger has more rows than the smallest size, even on one page. For example, render the wrapper when `total > PAGE_SIZES[0]`, and give `Pagination` a mode that draws only the size select when `pageCount <= 1`. Add a card test: with 30 rows choose 50, then assert that the "Rows per page" combobox is still there and that choosing 10 asks for `pageSize=10`. Every list that passes `onPageSizeChange` shares this, so this can be tracked with WR-01 for the phase-end sweep.

## Info

### IN-01: The figure scan cannot fail on the deleted transfer or on the Admin's transfer list

**File:** `tests/Csps.Server.IntegrationTests/Money/StaffMoneyAccessEndpointTests.cs:163-195`, `:257-258`

**Issue:** The world's only deleted transfer is Paolo to Jomar, and Liza (the Admin who reads) takes part in it on neither side. Liza's own ledger and her own transfer list can never hold it, even if the "Admin never gets deleted" rule or the `involving = caller` filter were removed. The world's only other transfer is Carmen to Liza, which Liza would see anyway. So for `money-transfers` and `me/ledger`, the scan's checks for the deleted id, `"isDeleted":true` and `7777.77` pass whatever the code does. Other tests do bite (`MoneyTransferListEndpointTests.cs:117-128` for Paolo, `StaffLedgerEndpointTests.cs:294-308`), so nothing is unguarded. The SUMMARY's D7 claim is stronger than this test.

**Failure scenario:** A change makes the handler pass `involving: null` for an Admin. The scan stays green. Only the separate list test catches it.

**Fix:** In the scan's world, make the deleted transfer one that Liza sent or received, and add a counted transfer between two other people. The scan then bites on both rules.

### IN-02: The result bar's wording follows the checkbox, not the rows on screen

**File:** `web/src/modules/admin/components/LedgerCard.tsx:59`, `:82-86`

**Issue:** `result` is picked from `showDeleted`, the requested filter. While the other answer loads, the placeholder rows are still the previous set. Right after a Manager ticks Show deleted, the bar reads "Showing 6 entries, deleted transfers included" over rows that hold no deleted transfer. Right after they untick it, the bar reads "Showing 7 entries · newest first" over rows that still show "Not counted". The rows are dimmed only after 200 ms.

**Fix:** Pick the wording from `page.includesDeleted`. That is the server's answer for the rows actually drawn.

### IN-03: An Admin's drop of Manager-only values also throws away the page, after one request with the old page

**File:** `web/src/modules/admin/hooks/useMoneyListParams.ts:58-69`

**Issue:** `setFilters({ tab: null, deleted: null })` resets `page` as well (the SUMMARY notes this). The hook hides `tab` and `deleted` on the first render but not `page`. So an Admin opening `?page=3&deleted=true` first asks for page 3, then the URL is replaced with page 1, and page 1 is read. The person sees page 3 flash and then lands on page 1, although page 3 was a valid place for them.

**Fix:** Remove only the two keys (a raw replace write that leaves `page` alone), or also hide `page: 1` on the first render so only one request goes out. Add a hook test for `?page=3&deleted=true` as an Admin.

### IN-04: Two nested regions are both named "Ledger"

**Files:** `web/src/modules/admin/components/LedgerCard.tsx:62`; `LedgerTable.tsx:190` (the `ResponsiveTable` frame region takes its name from the caption)

**Issue:** The card `section` is a region named by its h2 "Ledger", and the table frame inside it is a second region also named "Ledger". Screen reader landmark lists show two "Ledger" regions, one inside the other. axe's `landmark-unique` is a best-practice rule, so the WCAG-tag run passes. The SUMMARY raised this for review.

**Fix:** Drop `aria-labelledby` from the section, as the Recent orders card does. Or ask the owner which landmark should stay.

### IN-05: `ledgerStateClasses` is exported but never used

**File:** `web/src/modules/admin/components/money.recipe.ts:102-103`

**Issue:** No file imports it. It is dead code that suggests a failure banner layout the card does not have.

**Fix:** Remove it, or use it if a banner is meant to sit inside the card.

### IN-06: Two lines in the API doc do not match the code

**File:** `docs/api/staff-money.md:294`, `:308`

**Issue:**

- Line 294 says the role is decided "from the token alone". The handlers decide it from the caller's own account row (`GetStaffStateAsync(callerId)`, then `caller.IsManager`). A token whose account cannot be read answers 401, not 403.
- Line 308 lists "`403` for an Admin" on `GET /staff-money/{userId}/ledger`. An Admin's own id answers 200 there, as line 312 says. The Android client may read the table only.

**Fix:** Say "from the caller's own account, before anything about the id is read". In the table row, say "`403` for an Admin naming anyone else, or sending `deleted=true`".

### IN-07: The transfer list's `total` and its page are two separate reads

**File:** `src/Csps.Infrastructure/Money/StaffMoneyReader.cs:149-189`

**Issue:** `CountAsync` and the page query run as two statements at read committed. A transfer recorded or deleted between them gives a `total` that does not match the rows (for example a last page with fewer rows than `total` implies, or a pager one page short). The ledger avoids this with D-105. The transfer list has no running balance, so nothing is miscounted in money, but plan 10-19's Transfers panel will page by `total`.

**Fix:** Accept and document it, as the ledger doc now does for page-to-page shifts. Or read the count and the page inside one snapshot or serializable read transaction, with the same deadlock retry as the ledger.

### IN-08: The ledger's empty-state words speak to "you", but the card is built to show other people's ledgers

**File:** `web/src/modules/admin/moneyCopy.ts` (`ledger.empty.message`); `web/src/modules/admin/components/LedgerCard.tsx:1-3`

**Issue:** "Payments you receive, transfers and expenses you pay show here." is right on My Money. The card header says it is reused for one person's page in 10-19, where a Manager reading Jomar's empty ledger would be told about payments "you" receive.

**Fix:** Have `LedgerCard` take the empty copy (or a `self` flag) from its caller, and add the third-person line in 10-19 under P10-BL-07 owner review.

---

_Reviewed: 2026-11-07T23:25:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---
created: 2026-11-23T20:06:59-06:00
updated: 2026-11-23T20:06:59-06:00
phase: 13-quote-inquiries
wave: 9
review: 13-REVIEW-W9.md
fixed_at: 2026-11-23T20:06:59-06:00
iteration: 1
findings_in_scope: 10
fixed: 8
not_fixed: 2
status: partial
---

# Phase 13: Code Review Fix Report (wave 9)

*Created: 2026-11-23T20:06:59-06:00 · Updated: 2026-11-23T20:06:59-06:00*

**Branch:** `gsd/phase-13-quote-inquiries`
**Where checks ran:** the main checkout (no worktree). The preflight showed ports 5180, 5115, 7028 and 5199 free and no dev or test processes before each LocalDB run. LocalDB tests ran with `CSPS_TEST_SQL=localdb` set for each command only. No e2e ran.

In scope: all ten findings.
- Fixed: WR-01, WR-02, WR-03, IN-01, IN-02, IN-04, IN-06 and IN-07.
- Parked for the owner: IN-03 and IN-05.

Each fix is one commit with its tests. Every new test was run red on the old code first. The exceptions are noted under each finding.

## Fixed

### WR-01: a permanent order delete now refreshes the quote request data

**Commit:** d1872cfc
- `PurgeOrderDialog` now invalidates `['quote-requests']` as well as the order roots. That covers the inbox lists, the New count and any cached detail.
- It does so on a good purge and on the "already gone" 404, because a 404 can mean someone else purged the order.
- I kept it in the purge only, not in `useRefreshOrders`, so other order writes do not re-read the inbox.

Tests (`PurgeOrderDialog.test.tsx`): two new tests seed a list, a count and a detail query. After a purge, and after a purge that answers 404, all three must be stale. Both failed on the old code (`[false, false, false]`).

Status: fixed.

### WR-02: Delete Request reads the request again on a converted-locked 400

**Commit:** 9f73509b
- On `400 quote-requests.converted-locked`, the page keeps the server's sentence in the confirm and invalidates the detail.
- After Cancel, the page shows Converted, Delete Request is `aria-disabled` and Change Status is gone.
- `QuoteStatusMenu` already reads the detail again on any failure that is not a 409 or 404, so it needed no change.

Test (`QuoteRequestPage.test.tsx`): the first read is Contacted and the next is Converted. Delete Request answers 400 converted-locked. The sentence shows, then after Cancel the button is `aria-disabled`, the badge says Converted and there are two reads. On the old code the button was never disabled.

Status: fixed. Needs a human check, because it changes the failure path.

### WR-03: a test proves an unknown request takes no order number

**Commit:** 0654f1ad
- `AnUnknownRequestIs404AndSavesNoOrder` now also creates a plain order after the 404. That order must get `ORD-YYYY-0001`.
- Red first: I moved the lock after `numbers.NextAsync` for one run. The test failed with `"ORD-2026-0002"`. Then I put the lock back (`git checkout`) and it passed.

Status: fixed (test only, no code change).

### IN-01: the parallel test now truly overlaps, and the backstop wording is corrected

**Commit:** d3994418
- The test is renamed `TwoSavesAtOnceMakeOneOrderAndTheOtherWaitsThenIs409WithTheFirstOrder`. It works like this:
  - A test transaction holds the `order-numbers` lock row. So the first save stops after it has locked the request, with its transaction still open.
  - The test waits until the request row is locked. It checks this with an EF `ExecuteUpdate` that has a 1-second timeout. No raw SQL.
  - Then it sends the second save and checks that both saves are still waiting.
  - It releases the lock. The first save must be 201. The second must be `409 quote-requests.already-converted` naming the first order. There must be one order, and the next order must get `-0002`.
- Red first: with the request lock turned into a plain count, the test failed with "The first save never locked the quote request."
- Wording: the docs (`docs/api/quote-requests.md`), the 13-20 plan truth and the 13-20 summary now say this:
  - The lock is what gives the `already-converted` answer.
  - The row version is the backstop. Without the lock, the second save would fail as `409 orders.busy`.
  - The unique index keeps one order linked to one request.

Status: fixed.

### IN-02: the create contract names the already-converted 409

**Commit:** 61367d8e
- The `<returns>` of `OrdersController.Create` is not shown in OpenAPI, so I also added the 409 to its `<summary>`, which is the OpenAPI text. It now says that a request that already became an order is a 409 `quote-requests.already-converted` with `orderId` and `orderNumber`, and saves nothing.
- Both `<returns>` (controller and handler) now list it. The handler's `<returns>` also lists the 404.
- `docs/api/quote-requests.md` now says the request is "locked just before the order number is taken (after the public website block, when the form has one)", not "locked first".
- I rewrote the snapshot `tools/openapi-gen/openapi.v1.json` with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for that one command. I regenerated `web/src/types/api.generated.ts` with `npm --prefix tools/openapi-gen run generate`.

Test (`OpenApiOrderWriteContractTests`): the create summary must contain "409 `quote-requests.already-converted`" and "`orderId` and `orderNumber`". It failed on the old text.

Status: fixed.

### IN-04: the note rule trims exactly what .NET trims

**Commit:** c808241e
- I checked both sets on this machine:
  - .NET `char.IsWhiteSpace` is JavaScript's `trim` set without U+FEFF and with U+0085.
  - `"\u0085a\uFEFF".Trim()` keeps U+FEFF.
- The schema now trims that exact list (`DOTNET_TRIM`), then checks 1 to 1,000 characters.
  - A note of only U+0085 now asks for a note before anything is sent.
  - A note of only U+FEFF is accepted and passed on unchanged, as the server accepts and keeps it.
- This is not the money notes' rule. Those trim both U+0085 and U+FEFF, because that is what their server does.

Tests (`quoteRequestsSchemas.test.ts`), four new:
- U+0085 only is refused.
- U+FEFF only is accepted.
- Every one of the 25 .NET white-space characters is trimmed at both ends.
- U+FEFF counts toward the 1,000-character limit and U+0085 at the ends does not.

All four failed on the old code.

Status: fixed.

### IN-06: the conversion lock waits as long as the store is told to

**Commit:** 95397873
- `LockForConversionAsync` now sets the command timeout to the store's `wait` around its update and restores the old value afterwards, as `DatabaseLocks.TakeAsync` does. The wait is in whole seconds.
- A timeout or a deadlock still answers `409 orders.busy`, as before. I did not add a separate busy error for quote requests, because that would change the wording.
- Behavior change to note: a second save now waits at most 10 seconds (`DatabaseLocks.DefaultWait`), not the 30-second command timeout.

Tests (`QuoteRequestStoreLockTests`), two new:
- A held request row with a 1-second store wait ends in under 10 seconds. The cause is the SQL timeout, and the context's timeout of 30 is restored.
  - Red first: it waited the full 30 seconds.
- A free lock also restores the timeout. This test passed on the old code too, because the old code never changed the timeout. It guards the restore.

Status: fixed.

### IN-07: a stray blank line

**Commit:** 8cb0dfa8
- I removed one of the two blank lines after the session check in `PermanentlyDeleteOrderHandler`.
- There is no test, because only whitespace changed.

Status: fixed.

## Not fixed

### IN-03: should the suggested type skip the catch-all Others type? (parked for the owner)

No code changed, as asked. The choice is owner item 1 below.

### IN-05: the upload race now also covers the permanent order delete (parked for the owner)

No code changed, as asked. It joins W8 IN-01. The choice is owner item 2 below.

## Owner items

1. **What order the suggested product type uses (IN-03).**
   - A, built: by name only. If Others is filed under a line, it can be suggested ahead of a type like "Polo Shirt".
   - B, recommended by the review: sort Others last, as the product type list does (or skip it when another active type exists). That needs `IsOthers` in `QuoteLineProductType` and one unit case.
2. **The upload race and the deletes (IN-05, joins W8 IN-01).**
   - A, built: no lock. A late visitor upload can leave one photo in storage until `StraySweepJob` runs, about 2 to 3 days later. If accepted, add one sentence to the API doc and the Privacy Policy text. This now covers the Manager delete and the permanent order delete.
   - B: take the request lock in the upload and in both deletes.

## Flakes and other findings

- None. Every test passed on its first run in its targeted run and in the grouped runs.
- The first snapshot rewrite run reports one failure. That is the comparison in the same run that writes the file. The next plain run passed 11 of 11, as in W8.
- The 13-20 plan and summary `updated:` values were changed with the IN-01 wording edit. `docs/api/quote-requests.md` was updated in both the IN-01 and IN-02 commits.
- The budget build prints its standing note that public JS in the admin-included build is 149.06 KB, past the 135 KB trigger for the Phase 4 barrel split. It was 149.08 KB after W8.

## Checks

- `dotnet build Csps.slnx -warnaserror`: "Build succeeded.", "0 Warning(s)", "0 Error(s)".
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- Server tests (LocalDB), `QuoteConversionTests`, `OpenApiSnapshotTests`, `OpenApiOrderWriteContractTests` and `PermanentlyDeleteOrderTests`: total 50, failed 0, succeeded 50.
- Infrastructure `QuoteRequestStoreLockTests` (LocalDB): total 6, failed 0, succeeded 6.
- Application unit tests `CreateOrderHandlerTests` and `OrderDeletionHandlerTests`: total 89, failed 0, succeeded 89.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Web tests: "Test Files 7 passed (7)", "Tests 110 passed (110)", with no stderr lines. The files were `PurgeOrderDialog.test.tsx`, `QuoteRequestPage.test.tsx`, `quoteRequestsSchemas.test.ts`, `QuoteNotesCard.test.tsx`, `QuoteStatusMenu.test.tsx`, `no-long-dash.node.test.ts` and `source-layout.node.test.ts`.
- `npm run typecheck`: exit 0.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0.
- `npx prettier --check .` (in `web/`): "All matched files use Prettier code style!"
- `npm run build:budget`: exit 0, every row ok. Public JS contact 148.18 KB of 150.00, privacy 149.06 of 150.00. Admin 225.90 of 250.00. Quote form 44.38 of 45.00. CSS 20.55 of 35.00. No limit changed.
- No em or en dash was added in `web/src`. No invisible characters are in the test files: U+FEFF and U+0085 are written as `\u` escapes.
- gitleaks (pre-commit hook) said "no leaks found" on all eight commits. No real names, emails, server names or local paths were staged. The test data uses made-up names only.
- No package was added or bumped. There was no schema, migration, raw SQL, trigger or JSON column change.

---

_Fixed: 2026-11-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

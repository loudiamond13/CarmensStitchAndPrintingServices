---
created: 2026-11-23T22:36:35-06:00
updated: 2026-11-23T22:39:02-06:00
phase: 13-quote-inquiries
wave: 10
review: 13-REVIEW-W10.md
fixed_at: 2026-11-23T22:36:35-06:00
iteration: 1
findings_in_scope: 10
fixed: 8
not_fixed: 2
status: partial
---

# Phase 13: Code Review Fix Report (wave 10)

*Created: 2026-11-23T22:36:35-06:00 · Updated: 2026-11-23T22:39:02-06:00*

**Branch:** `gsd/phase-13-quote-inquiries`
**Where checks ran:** the main checkout (no worktree). The preflight showed ports 5180, 5115, 7028 and 5199 free and no dev or test processes before the e2e run, and again after it. No server code changed, so no .NET or LocalDB test ran.

In scope: all ten findings, plus the load-sensitive `routes.test.tsx` case.
- Fixed: WR-01 (option A), WR-03, IN-01, IN-02, IN-03, IN-04, IN-05 and IN-07.
- Parked for the owner: WR-02 (no code change).
- Recorded only, as asked: IN-06 (the budget rows are below).
- Also fixed: the routes test that failed in two gate runs.

Each fix is one commit with its tests. Every new test was run red on the old code first. The exceptions are noted under each finding.

## Fixed

### WR-01: Back after a save no longer refills the form for a Converted request (option A, built)

**Commit:** 96272651
- A save from a form that was filled from a quote request now replaces the form's history entry (`navigate(..., { replace: true })`). So Back from the new order goes past the form and never reads the prefill again.
  - This holds for the linked save and for Save as a New Order Instead, because both leave a `?fromRequest=` entry behind.
  - A plain New Order save still adds a history entry, as before.
- The cheap guard: when the form opens, it looks in this tab's cache for the request's detail. If that detail says Converted with an order, the already-an-order box shows from the start, naming the order, with Open Order and Save as a New Order Instead.
  - It reads the cache only. It sends no extra request.
  - Converted is final, so a cached Converted is never wrong.
  - Example it catches: a form opened earlier from the same request is still in the history, and staff come back to it after the request page showed Converted.
  - It cannot catch a request converted in another tab or by someone else when this tab never read it as Converted. The server still refuses that save with the 409 box, as before.

Tests (`OrderFormPage.test.tsx`), five new:
- A linked save ends with `historyAction` `REPLACE`. It failed on the old code (`PUSH`).
- Save as a New Order Instead from a prefilled form ends with `REPLACE`. It failed on the old code.
- A cached Converted detail shows the box up front with the order link. It failed on the old code.
- A plain save still ends with `PUSH`, and a cached detail that is not Converted shows no box. These two guard the change and passed before it too.

Status: fixed. Needs a human check, because it changes the history flow.

### WR-03: one email rule for the quote form and the order forms

**Commit:** d31a062b
- `isPlainEmail` moved from `modules/public/quoteSchemas.ts` to `web/src/utils/email.ts`. The quote schema and the order details schema (New Order and Edit Order) both use it. The old order regex is gone.
- So the order form now accepts `juan@example.com.` as the server does, and refuses `a..b@example.com` and `a(b)@example.com` before anything is sent.
- The note in `tests/fixtures/email-cases.json` now says the order forms use the same rule.

Tests:
- `orderFormSchemas.test.ts` runs every `quoteEmail` case from the shared fixture against the New Order and Edit Order schemas (cases with a space at either end are left out, because the order form trims first). 30 cases failed on the old code.
- `OrderFormPage.test.tsx`: a prefill with `juan@example.com.` saves, and the body carries that email. It failed on the old code (the form stayed on "Enter a valid email address.").

Status: fixed.

### IN-01: the prefill is no longer read again by the form's own invalidations

**Commit:** 7ec6d07a
- The prefill query key is now `['order-prefill', id]`, outside `['quote-requests']`.
- So the 409 and the save-time 404 no longer send a second `GET .../order-prefill`. On the 404 path that also removes a failed request from the console.

Test (`OrderFormPage.test.tsx`): for a 409 already-converted and for a save-time 404, the prefill is read once. Both failed on the old code (two reads).

Status: fixed.

### IN-02: the save-time 404 invalidation is tested

**Commit:** aea34928
- The test "keeps the values, drops the link and says so when a save finds the request deleted" now spies on `invalidateQueries` and checks `['quote-requests']`.
- This is a test only. To see it go red, I removed the invalidation line for one run: the test failed. Then I put the line back (`git checkout`) and it passed. The IN-01 test for the 404 case also failed with the line removed.

Status: fixed (test only).

### IN-03: the note stops linking a deleted request

**Commit:** b1691c75
- After a save finds the request deleted, the "Filled in from" note keeps its words, because the values did come from that request. It drops the View Request link, which would lead to a not-found page.
- The banner below it still says "Couldn't find that quote request."

Test: the same 404 test checks the note text is still shown and there is no View Request link. It failed on the old code.

Status: fixed.

### IN-04: a space between the two toast lines

**Commit:** 409e52fd
- The toast now reads "ORD-2026-0900 · Test Hawks The quote request is now Converted." when copied or read out. On screen the second line still starts on its own line.

Test: the linked-save test checks the toast text. It failed on the old code ("Test HawksThe").

Status: fixed.

### IN-05: the already-converted box links only a real order id

**Commit:** 184c033c
- The box shows Open Order only when the order id passes a GUID check. Otherwise it names the order with no link.
- `HttpError.ts` stays generic. `orderNumber` now has its own doc comment.

Test: a 409 with `orderId: 'not-an-id'` names "ORD-2026-0160" with no link and keeps Save as a New Order Instead. It failed on the old code.

Status: fixed.

### IN-07: one `freshMobile()` for the e2e specs

**Commit:** daabef70
- `freshMobile()` now lives in `web/e2e/helpers.ts`. The five quote specs import it. The five copies were byte for byte the same.

Test: the `@quote` e2e run below (20 of 20 passed).

Status: fixed.

### The load-sensitive routes test

**Commit:** ff9dd757
- **The cause:** after the click on the inbox name link, the test waited for the address with a plain `waitFor`, which gives up after 1 second. In a data router the address changes only once the request page's code has loaded. This test is the first in the file to load that page. Under a full-suite load, loading it can take more than a second, so the wait timed out. The second wait, after Back, had the same 1 second limit.
- **The fix:** both address waits now get 10 seconds, the same as the other finds in this file. The checks are the same as before.
- **Proof:** for one run I added a 1.5 second delay to the request page load in `routes.tsx`. The old test failed at the address wait (line 593, "expected '/admin/quote-requests' to match"). The new test passed with the delay. Then I removed the delay (`git checkout`). The whole file passed, 87 of 87.

Status: fixed.

## Not fixed

### WR-02: a Converted request whose order was soft-deleted (parked for the owner)

No code changed. A web-only fix is not safe here. The request detail looks the same for a live order and a soft-deleted one, so any web-only link would be a guess:
- Linking a Manager to `/admin/orders/deleted/{id}` would break the link for every live order.
- Plain text instead of a link would remove the working link for every live order.
- A Manager link on the order page's not-found screen would show for every missing order, not only this case, and adds new copy.

The choice is owner item 1 below.

### IN-06: the public budget rows (recorded, no code)

No code changed, as asked. The rows are under Checks. No limit was changed and no row is over.

## Owner items

1. **A Converted request whose order was deleted (WR-02).**
   - A, as built: no change. "Open Order {number}" and the history link lead to "This order was not found or was deleted." The request stays Converted and locked.
   - B, recommended by the review: the server adds `orderDeleted` to `QuoteRequestDetailResponse`. Then the page links a Manager to `/admin/orders/deleted/{id}` and shows an Admin the number as text with a short reason, such as "Order ORD-2026-0160 was deleted." The 409 box in the New Order form has the same gap, more rarely. This is a server change plus copy, so it needs your yes.
2. **How the form learns that a request is already Converted (WR-01).**
   - A, built: the history entry is replaced after the save, and the form uses this tab's cached request detail when it has one.
   - B: the server adds `status`, `orderId` and `orderNumber` to `OrderPrefillResponse`. Then the form always knows up front, for every tab and every user, and shows the already-an-order box instead of the "Filled in from" note. This is a server change, so it needs your yes.

## Flakes and other findings

- No new flakes. Every targeted run passed on its first try.
- The routes test cause is recorded above. It is the same pattern as the other `routes.test.tsx` load failures in `deferred-items.md` (13-19, 13-21): a plain 1 second wait after a click that loads a lazy page. The two deleted-order cases from 13-21 were not in scope and were not changed.
- The shared email rule adds 0.02 to 0.03 KB to each public row and 0.08 KB to the Quote form, because the rule now sits in a small shared piece. All rows stay under their limits.

## Checks

- Web tests, the affected files: "Test Files 9 passed (9)", "Tests 587 passed (587)", with no stderr lines. The files were `OrderFormPage.test.tsx`, `orderFormSchemas.test.ts`, `quoteSchemas.test.ts`, `HttpError.test.ts`, `routes.test.tsx`, `quoteRequestsService.test.ts`, `QuoteRequestPage.test.tsx`, `no-long-dash.node.test.ts` and `source-layout.node.test.ts`.
- The quote form tests, which use the moved email rule: "Test Files 5 passed (5)", "Tests 87 passed (87)".
- `npm run typecheck`: exit 0.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0.
- `npx prettier --check .` (in `web/`): "All matched files use Prettier code style!"
- `npm run build:budget`: exit 0, every row ok. No limit changed.

  | Row | Before (W9 fixes) | After |
  | --- | --- | --- |
  | public JS (contact) | 148.19 KB | 148.22 KB of 150.00 |
  | public JS (privacy) | 149.07 KB | 149.09 KB of 150.00 |
  | admin JS | 226.00 KB | 225.98 KB of 250.00 |
  | Quote form | 44.39 KB | 44.47 KB of 45.00 |
  | CSS | 20.55 KB | 20.55 KB of 35.00 |

  The "before" column is a budget build of the branch before these fixes (at f905b884). The build still prints its standing note that public JS in the admin-included build is past the 135 KB trigger for the Phase 4 barrel split.
- `npm run e2e -- --grep "@quote" --project chromium`: "20 passed (1.0m)", including "@quote staff turn a request into an order".
- No em or en dash was added in `web/src` or `web/e2e` (a check of the added lines found 0).
- gitleaks (pre-commit hook) said "no leaks found" on all nine commits. No real names, emails, server names or local paths were staged. The test data uses made-up names and `example.test` or `example.com` addresses only.
- No package was added or bumped. No server file changed. There was no schema, migration, raw SQL, trigger or JSON column change.
- No dev server, e2e host, browser or background shell is left running. The preflight after the e2e run showed all four ports free and no dev or test processes.

---

_Fixed: 2026-11-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

---
phase: 13-quote-inquiries
plan: 19
subsystem: admin-quote-request-page
status: complete
tags: [quote-requests, admin, react, tanstack-query, photo-viewer, menu-button, a11y, tdd]
created: "2026-11-23T15:56:00-06:00"
updated: "2026-11-23T16:12:00-06:00"

requires:
  - phase: 13-quote-inquiries
    provides: "GET /api/v1/quote-requests/{id} and POST /api/v1/quote-requests/{id}/status (13-16, slim answer from W7 IN-01); the inbox, QuoteStatusBadge and quoteRequestsService (13-15); NEW_QUOTE_COUNT_KEY (13-17)"
provides:
  - "quoteRequestsService.get(id, signal) and changeStatus(id, status, version, idempotencyKey, signal)"
  - "useQuoteRequestQuery (key ['quote-requests', 'detail', id], no read for a non-GUID id), quoteRequestKey, isQuoteRequestId"
  - "QuoteRequestPage at /admin/quote-requests/:id (lazy, both roles), with QuoteRequestDetailsCard, QuoteRequestPhotosCard, QuoteHistoryCard"
  - "QuoteStatusMenu (QUOTE_CHANGE_STATUS_ID) with the D-04 Spam confirm"
  - "quoteBackTarget (quoteRequestNavigation.ts): the inbox name link sends its view in the navigation state; Back goes back in history"
  - "QUOTE_REQUEST_COPY in quoteRequestsCopy.ts; R2 recipe classes in quoteRequests.recipe.ts"
  - "Test fixtures quoteRequestDetail, quoteRequestPhoto, MARIA and the MSW quoteRequestBackend (GET detail, POST status)"
  - "PhotoTile hasCover prop; ConflictBanner title and body props"
  - "web/e2e/quote-request.spec.ts (three @quote cases)"
affects: [13-21, 13-22, 13-23, 13-24]

actuals:
  tokens: 24300
  tasks: 3
  commits: 6
plan_head_before: bd27b37150c775549357455083b94576aec9cd30
plan_head_after: 652fba0ab9a2cb65e52fb7ca6ba31637e1a359dd

tech-stack:
  added: []
  patterns:
    - "A detail page with no data keeps its last error and counts a failure while errorUpdatedAt > dataUpdatedAt, so Try Again keeps the same alert and button"
    - "One back link outside the loading region, so it shows at once and keeps focus when the data lands"
    - "After a slim status answer: set the new status and version on the cached detail, then invalidate the ['quote-requests'] prefix"

key-files:
  created:
    - web/src/modules/admin/pages/QuoteRequestPage.tsx
    - web/src/modules/admin/pages/QuoteRequestPage.test.tsx
    - web/src/modules/admin/components/QuoteRequestDetailsCard.tsx
    - web/src/modules/admin/components/QuoteRequestPhotosCard.tsx
    - web/src/modules/admin/components/QuoteHistoryCard.tsx
    - web/src/modules/admin/components/QuoteStatusMenu.tsx
    - web/src/modules/admin/components/QuoteStatusMenu.test.tsx
    - web/src/modules/admin/hooks/useQuoteRequestQuery.ts
    - web/src/modules/admin/quoteRequestNavigation.ts
    - web/e2e/quote-request.spec.ts
  modified:
    - web/src/modules/admin/services/quoteRequestsService.ts
    - web/src/modules/admin/services/quoteRequestsService.test.ts
    - web/src/modules/admin/components/quoteRequests.recipe.ts
    - web/src/modules/admin/components/QuoteRequestsTable.tsx
    - web/src/modules/admin/quoteRequestsCopy.ts
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/src/components/media/PhotoTile.tsx
    - web/src/components/media/PhotoTile.test.tsx
    - web/src/components/states/ConflictBanner.tsx
    - web/src/components/states/ConflictBanner.test.tsx
    - web/src/test/quoteRequestFixtures.ts

key-decisions:
  - "Photo 1 of a quote request has no Cover mark (PhotoTile hasCover={false}); the tiles are the readonly P9 tiles"
  - "The Spam note keys off photosRemovedAtUtc only; while it is set no photo and no missing-photo note shows"
  - "A 404 from a move resets the detail query, so the page shows its not-found state"
  - "The menu button keeps the OrderStatusMenu pending label Saving"

requirements-completed: [INQ-05]

coverage:
  - id: D1
    description: "Staff open a request from the inbox name link and see the name, received line, badge, Request card (tel: and mailto: links), photos with the viewer's 2000px Open Full Size, and the history newest first"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/QuoteRequestPage.test.tsx#the populated request (INQ-05, UI-SPEC R2)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/routes.test.tsx#when a %s follows the inbox name link they see the request page titled \"Quote Request · CSPS Admin\""
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-request.spec.ts#@quote staff open a request with a photo"
        status: pass
  - id: D2
    description: "Change Status: Move to every status but the current one and Converted, version and Idempotency-Key, toast, focus back, detail read again, inbox lists and New count invalidated; Spam with photos asks first; 409 shows the ConflictBanner"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/QuoteStatusMenu.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/QuoteRequestPage.test.tsx#Change Status on the page (D-15, D-14)"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-request.spec.ts#@quote axe finds nothing on a New request, after Move to Spam, and the menu works by keyboard"
        status: pass
  - id: D3
    description: "Loading, error with Try Again, not found (gone, non-GUID, gone on move), missing photos, Spam note, no photos, EmptyValue, long text, 320px"
    requirement: INQ-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/QuoteRequestPage.test.tsx#loading, failure and not found (UI-SPEC R2 States)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/QuoteRequestPage.test.tsx#the photo states (D-03, D-04)"
        status: pass
      - kind: e2e
        ref: "web/e2e/quote-request.spec.ts#@quote at 320px the actions wrap under the title, 44px tall, and nothing scrolls sideways"
        status: pass
---

# Phase 13 Plan 19: Staff open a quote request, see its photos, and change its status Summary

*Created: 2026-11-23T15:56:00-06:00 · Updated: 2026-11-23T16:12:00-06:00*

**The R2 request page at `/admin/quote-requests/:id`: the Request, Photos and History cards, a Change Status menu that sends the row version and asks before Spam deletes photos, and every loading, error, not-found and photo state.**

## What was built

- **Route.** `quote-requests/:id` is a lazy page under the URL-state layout with no Manager-only loader, so both roles open it. It matches the inbox name link exactly (W6 IN-03). A routes test follows the link for a Manager and an Admin and checks the request heading, and the existing Back test now checks the request heading too.
- **Head.** The back link "Quote Requests", the visitor's name as the h1 (wraps anywhere), "Received Nov 21, 2026, 3:42 PM from the website" and the status badge (`QuoteStatusBadge` from the inbox). The document title is always "Quote Request · CSPS Admin".
- **Back link.** The inbox name link now sends its own address (with the pill and search) in the navigation state. On the request page a plain click on Back goes back in history when that state holds an inbox address; otherwise the link goes to `/admin/quote-requests`. A state that is not a literal inbox path is ignored (CWE-601).
- **Request card.** Team / organization, Contact number (a 44px `tel:` link), Email (`mailto:`), Product type, Quantity (estimate) ("21-50 pcs") and Message (`pre-wrap`, wraps anywhere). Each empty value is `EmptyValue`. Everything is React text.
- **Photos card.** The P9 readonly `PhotoTile` list with a count chip; a press opens `PhotoViewer`, whose Open Full Size is the server's `fullSize` address (D-36). Under the tiles: "{2} photos didn't upload: {names}. Ask the customer to send them on Messenger." (D-03); "The photos were deleted when this request was marked as spam." whenever `photosRemovedAtUtc` is set, with no tiles (D-04); otherwise "No photos were sent.".
- **History card.** Newest first as the server sends it: "{Status} · {name} · {date}", the last row "Received from the website · {date}" with no creator.
- **Change Status (D-15).** `QuoteStatusMenu` uses the OrderStatusMenu keys and look. It lists "Move to {Status}" for every status but the current one and Converted, and is not shown on a Converted request. A move sends `{ status, version }` with an Idempotency-Key through `useSubmission`, toasts "Status changed" / "This request is now {Status}.", and puts focus back on Change Status. The answer is slim (W7 IN-01), so the page sets the new status and version on the cached detail at once, then invalidates `['quote-requests']`, which reads the detail again (history, photos) and marks the inbox lists and `NEW_QUOTE_COUNT_KEY` stale (D-14).
- **Spam confirm (D-04).** With stored photos, Move to Spam opens a ConfirmDialog: "Mark this request as spam?" / "Its {3} photos will be deleted within a day and can't be brought back. The request text stays until it's cleaned up after 6 months." / "Mark as Spam" (pending "Marking") / "Cancel". Without photos it acts at once. A refusal inside the dialog shows in the dialog, not in a toast.
- **409.** The ConflictBanner "Someone else changed this request. Load the latest to see it." with Load Latest, which reads the request again and then focuses the h1. **400:** a danger toast with the server's sentence, and the detail is read again. **404 on a move:** the detail query is reset, so the page shows not found.
- **States.** Loading: the back link at once, a skeleton h1 and cards inside one LoadingRegion "the quote request". A failed first read: `ErrorState` "Couldn't load this quote request." with the shared body and Try Again. The page keeps the last error and counts a failure while `errorUpdatedAt > dataUpdatedAt`, so the same alert and button stay in place, with focus, while Try Again reads (W7 WR-01). Not found (a 404, or an id that is not a GUID, which never asks the server): "Quote request not found" / "It may have been deleted or cleaned up after 6 months." with "Back to Quote Requests".
- **Layout.** Two columns (main and a 360px aside) at 1024px and up, one column below. At 320px the actions wrap under the title, each 44px tall, with no sideways scroll (e2e).

## TDD

Each task had a `test(13-19)` commit with the failing run, then a `feat(13-19)` commit.

- Task 1 RED (e7b70d2d): `service.get is not a function`; `Failed to resolve import "@/modules/admin/pages/QuoteRequestPage"`; the routes cases could not find the request heading, and the lazy route check gave "expected undefined to be type of 'function'".
- Task 2 RED (defc18c9): `Failed to resolve import "@/modules/admin/components/QuoteStatusMenu"`; `service.changeStatus is not a function`; the page could not find "Change Status". The "Converted has no menu" case passed already, as a guard.
- Task 3 RED (ca81573b): 13 failures (no back link or busy region before data, no error or not-found state, no photo notes). The EmptyValue, product and long-text cases already passed on the Task 1 code; they pin that behavior.
- `ConflictBanner` title and body: the new test failed first, then passed.
- `PhotoTile hasCover`: the test was written together with the one-line change, not run red first.

## Checks

- Task verifies: `QuoteRequestPage.test.tsx` 30 passed; `QuoteStatusMenu.test.tsx` 14 passed; `quoteRequestsService.test.ts` and `routes.test.tsx` passed (103 tests with the page file after Task 1); `no-long-dash.node.test.ts` passed.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0. `npm run typecheck`: exit 0. `npx prettier --check src e2e`: "All matched files use Prettier code style!"
- e2e `npm run e2e -- --grep "@quote" --project chromium`: "17 passed (47.8s)", including the three new cases. The fixture guard saw no console error, no CSP violation and no undeclared failed response.
- Fresh production build (`NODE_ENV=production node node_modules/vite/bin/vite.js build`): "built in 22.23s", no warnings.
- `npm run build:budget`: every row ok. Public JS contact 148.16 KB of 150.00, privacy 149.06 of 150.00; admin JS 225.79 of 250.00; Quote form 44.38 of 45.00; CSS 20.54 of 35.00. No limit changed. The standing note about the 135 KB barrel-split trigger (149.06 KB) is unchanged from W7.
- Whole web suite (`npx vitest run`, after the fresh build, preflight clear): "Test Files 6 failed | 443 passed (449)", "Tests 16 failed | 11963 passed (11979)", 940.87 s. The machine was loaded (the 13-18 executor ran .NET builds and tests at the same time). Every failure was re-run alone:
  - `routes.test.tsx`: 87 of 87 passed. `OrderFormPage.test.tsx`: 84 of 84 passed. `ExpensesPage.test.tsx`, `UsersPage.test.tsx` and `QuoteFormPhotos.test.tsx`: 204 of 204 passed. In the full run these were 5 s and 15 s timeouts or a first render that did not land in time. None of these files read code this plan changed, except `routes.test.tsx`, whose failures were two guard cases about Orders and the dev shell.
  - `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions": fails alone too. This is the known fresh-worktree failure in `deferred-items.md` (13-09, 13-12, 13-14). No package or lockfile changed in this plan.
- gitleaks (pre-commit hook) found no leaks on any commit. Test data uses `example.test` addresses and made-up names only. No em or en dash in the diff.

## Deviations from Plan

### Files touched outside files_modified

1. **`web/src/modules/admin/components/QuoteRequestsTable.tsx`** (Rule 2, needed for "history back when the inbox is the previous entry"): the name link now navigates with `state: { from: inbox address }` on a plain click. Modifier clicks still open the plain link.
2. **`web/src/modules/admin/quoteRequestNavigation.ts`** (new): `quoteBackTarget`, the CWE-601 guard for that state, like `orderNavigation.ts`.
3. **`web/src/components/media/PhotoTile.tsx`** and its test: an optional `hasCover` prop (default true), so photo 1 of a quote request has no "Cover" mark. Order photos are unchanged. See owner item 1.
4. **`web/src/components/states/ConflictBanner.tsx`** and its test: optional `title` and `body`, so R2 shows its own sentence. Every other caller keeps the shared copy.
5. **`web/src/test/quoteRequestFixtures.ts`**: detail fixtures and the MSW detail and status backend; `quoteProblem` takes an optional code and detail.

### Auto-fixed

- **[Rule 1] The skeleton cards use 3 text lines, not 4:** `SkeletonText` takes at most 3 lines (a type error with 4).
- **[Rule 1] One back link for every state:** a back link inside the skeleton was replaced by a new node when the data landed, so a click or focus on it was lost. It now sits outside the loading region.

None of these change a ruled behavior.

## Owner items

1. **The Cover mark on quote photos.** A, built: no "Cover" mark on photo 1, because a quote request has no cover. B: show the tiles exactly as order photos do, with "Cover" on photo 1.
2. **The missing-photo sentence with one photo.** A, built: the UI-SPEC sentence word for word, so one photo reads "1 photo didn't upload: logo.png. Ask the customer to send them on Messenger." B: "send it" when one photo is missing.
3. **Where the badge sits.** A, built: as the UI-SPEC says, on the line under the h1, beside "Received ... from the website". B: beside the name in the h1 row, as on the order page.
4. **The pending label of Change Status.** A, built: "Saving", as on the order page's Change Status. B: keep "Change Status" with only the spinner.
5. **Try Again has no busy look.** A, built: the shared `ErrorState` button stays the same node and keeps focus while it reads, but it shows no spinner (ErrorState has no pending prop). B: add a pending prop to `ErrorState` so Try Again shows it is busy, as the inbox stale line does.

## Flakes

Under full-suite load, each passed when re-run alone (for the orchestrator to add to `deferred-items.md`):

| Test | What happened | Re-run alone |
|---|---|---|
| `routes.test.tsx` "opening /admin/orders without a session refreshes once..." and "with a refresh cookie the shell shows the signed-in user..." | 15 s timeout; first render not in time | 87 of 87 passed |
| `OrderFormPage.test.tsx` (10 cases, from "shows the New Order header..." on) | 5 s timeouts | 84 of 84 passed |
| `ExpensesPage.test.tsx` "shows the header, the result bar, the table name..." | table not found in time | passed (204 of 204 with the next two files) |
| `UsersPage.test.tsx` "shows the h1, the Manager only badge and the verbatim subline" | text not found in time | passed |
| `QuoteFormPhotos.test.tsx` (Sending button) | "Sending" not found in time | passed |
| `scripts/license-policy.test.ts` "exits 1 on a stricter policy..." | known fresh-worktree failure, not a flake | fails alone in the worktree, as recorded before |

No flake in the files this plan added: the page, menu, service and e2e cases passed on every run.

## Notes for later plans

- **13-18 merge.** 13-18 regenerates `api.generated.ts` and adds notes to the detail answer. If `notes` becomes a required member of `QuoteRequestDetailResponse`, `quoteRequestDetail()` in `web/src/test/quoteRequestFixtures.ts` needs a default (for example `notes: []`) for typecheck to pass after the merge.
- **13-21 (notes, delete).** The aside column of `QuoteRequestPage` holds only the History card; the Notes card goes above it. Delete Request goes in the head actions beside `QuoteStatusMenu` (`quoteActionsClasses`). After a delete, invalidate `['quote-requests']`.
- **13-22 (Turn into Order).** The primary action goes first in the same actions row; a Converted request already hides the status menu.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or trust boundary: the page reads and posts to the 13-16 endpoints. T-13-56 (text only, `tel:` and `mailto:` from server values), T-13-57 (fixed title, id-only path) and T-13-58 (the Spam confirm) are mitigated and tested.

## Self-Check: PASSED

- All 10 created files exist on disk.
- All 6 task commits (e7b70d2d, c32d3958, defc18c9, 8826aebb, ca81573b, 652fba0a) are on branch worktree-agent-a302d647acd3f2728.
- STATE.md, ROADMAP.md and DECISIONS.md were not edited.

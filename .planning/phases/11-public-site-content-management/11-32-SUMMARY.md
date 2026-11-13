---
phase: 11-public-site-content-management
plan: 32
subsystem: admin-gallery-tab
tags: [gallery, uploads, ordering, paging, url-state, site-content, react, zod, nuqs, privacy]
created: 2026-11-12T21:40:00-06:00
updated: 2026-11-12T22:17:00-06:00

requires:
  - phase: 11-public-site-content-management
    provides: "11-28 the /api/v1/gallery-items routes (list, add, edit, replace photo, move, hide, show, delete); 11-22 PhotoSlot look and the shared image rules; 11-24 the Testimonials tab patterns (move, hide, show, delete, focus); 11-12 the Site Content page, tabs and copy; 11-20 the product line list the Select reads"
provides:
  - "The Gallery tab on Site Content: every shown order and upload in the one gallery order, server paged (Rows per page 10, 20, 50, 100), filtered by Product line, with the result bar 'Showing {n} items · in gallery order'"
  - "Uploads: add (GalleryPhotoModal, the photo prepared by prepareImage and sent as multipart), edit, replace photo, hide, show, delete with its question; order items: Move up, Move down and a link to the order, nothing else"
  - "Moves across both kinds and across page edges: the tab follows the item to its new page with a push and says '{team} moved to page {n}.'"
  - "useGalleryTabParams: line, page and size in the URL on the shared list-state factory; useSiteContentTab removes them when another tab is chosen"
  - "galleryItemsService, useGalleryItemQueries, galleryUploadSchema, the S6 copy, gallery fixtures and the @site-content-gallery journey"
affects: [11-37, 11-30, 11-31]

actuals:
  tokens: 48000
  tasks: 3
  commits: 10

# actuals.tokens is chars/4 over the added lines of the realized diff (no generated files). commits is the measured git rev-list count from
# plan_head_before to plan_head_after, taken before this SUMMARY commit.
plan_head_before: 862a92061bf87252a7f4cce275a270d961bda960
plan_head_after: 3ddbb7bab0a04ffb31116797c2c8d54c25ce907a

tech-stack:
  added: []
  patterns:
    - "A picker that looks like PhotoSlot but does not save at once: the file is prepared in the browser, held with the form, and sent with it (add) or first with its own request (edit, whose answer carries the new version)"
    - "A move across a page edge follows the item: the tab pushes the new page, holds every control until that page has been read, then focuses the item's control there"
    - "A URL param that belongs to one tab is removed by the tab hook in the same replace as the tab change"
    - "A multipart upload refusal cannot be answered by the fake API in jsdom (the form body and Node fetch disagree about its length once the answer comes first), so tests make the service reject"

key-files:
  created:
    - web/src/modules/admin/services/galleryItemsService.ts
    - web/src/modules/admin/services/galleryItemsService.test.ts
    - web/src/modules/admin/hooks/useGalleryItemQueries.ts
    - web/src/modules/admin/hooks/useGalleryItemQueries.test.tsx
    - web/src/modules/admin/hooks/useGalleryTabParams.ts
    - web/src/modules/admin/hooks/useGalleryTabParams.test.tsx
    - web/src/modules/admin/components/GalleryTab.tsx
    - web/src/modules/admin/components/GalleryTab.test.tsx
    - web/src/modules/admin/components/GalleryPhotoModal.tsx
    - web/src/modules/admin/components/GalleryPhotoModal.test.tsx
    - web/e2e/site-content-gallery.spec.ts
  modified:
    - web/src/modules/admin/pages/SiteContentPage.tsx
    - web/src/modules/admin/pages/SiteContentPage.test.tsx
    - web/src/modules/admin/hooks/useSiteContentTab.ts
    - web/src/modules/admin/hooks/useSiteContentTab.test.tsx
    - web/src/modules/admin/siteContentSchemas.ts
    - web/src/modules/admin/siteContentSchemas.test.ts
    - web/src/modules/admin/siteContentCopy.ts
    - web/src/modules/admin/components/siteContent.recipe.ts
    - web/src/test/siteContentFixtures.ts
    - docs/web/e2e.md

key-decisions:
  - "A move across a page edge follows the item to its new page (push) and focuses the item's own control there. The UI-SPEC says focus goes to 'the row that took its place'; the plan's test says the tab shows the next page. Both cannot hold, so the item is followed (see O-1)"
  - "A new upload sends isShown true for the ticked default, as 11-28 asked; the API hides an upload when the field is left out"
  - "A replacement photo on an edit is sent before the form, because its answer carries the new version the form must send; a retry after a failed form does not send the photo again"
  - "Load Latest reads the page the tab shows; an upload that moved to another page reads as 'not found, may have moved' (SPEC-GAP wording)"
  - "The Gallery params are removed by useSiteContentTab (the tab hook that is always mounted), not by useGalleryTabParams, which is only mounted on the Gallery tab"
  - "Only the four row-size choices are offered; the API still accepts 1 to 100 (11-28 O-1 built as option A)"

requirements-completed: [GAL-03, CONT-03]

coverage:
  - id: D1
    description: "A Manager adds a photo of older work from the Gallery tab (photo prepared in the browser, team, line, pieces, note, Show on the website ticked by default); it is the first row of the tab and the first tile on the public Gallery"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/GalleryPhotoModal.test.tsx (the add window)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-gallery.spec.ts#a Manager adds E2E-Riders for Moto with 12 pieces, and it is the first row and the first tile on /gallery"
        status: pass
    human_judgment: false
  - id: D2
    description: "The upload form checks every rule the server checks with its own words before a request is sent (photo, team 80, line, pieces 1 to 9,999, note 120), and puts a server message under its field"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/siteContentSchemas.test.ts#galleryUploadSchema; GalleryPhotoModal.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "The list shows every shown order and upload in gallery order with Source, Status and 'Line hidden', paged by the server with a Product line filter, and all of it (line, page, size) lives in the URL with allow-list parsers"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/GalleryTab.test.tsx (the list, the Product line filter, paging and the page size, the states); hooks/useGalleryTabParams.test.tsx; hooks/useSiteContentTab.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-gallery.spec.ts#the line filter and the page size live in the URL, an order link and Back keep them, and at 320px the rows are cards"
        status: pass
    human_judgment: false
  - id: D4
    description: "Moves across both kinds and across page edges, edit, replace photo, hide, show and delete for uploads, each with its toast, busy state and focus; a stale save keeps the typed values behind the ConflictBanner"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/GalleryTab.test.tsx (the row actions); GalleryPhotoModal.test.tsx (the edit window)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-gallery.spec.ts#a Manager moves E2E-Riders below a shown order, hides it so it leaves /gallery, then deletes it"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each change clears the public data held in this browser and reads the gallery pages and product lines again"
    requirement: CONT-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useGalleryItemQueries.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "MUST NOT offer hide, edit or delete for an order item in the Gallery tab; an order is taken off the website only from its order (D-15, D-27)"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/GalleryTab.test.tsx#gives an order item Move up, Move down and a link to its order, and never Edit, Hide or Delete (D-15)"
        status: pass
    human_judgment: true
    rationale: "The plan marks this prohibition as a judgment item (privacy, unverified). The test proves no Edit, Hide, Show or Delete button exists on an order row and the e2e checks the same on a real order row; whether the link wording ('Change {team} on order {number}') is right is the owner's call"

duration: 95min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 32: A Manager manages the Gallery: uploads, order, publish and unpublish Summary

**The Gallery tab on Site Content lists every shown order and upload in the one gallery order (server paged, filtered by product line, all in the URL), lets a Manager add photos of older work and edit, replace, hide, show, delete and reorder them across pages, and sends order items to their own order page instead of offering edit, hide or delete.**

## Open items (owner)

### O-1: where focus goes after a move across a page edge

The UI-SPEC says the tab "takes the row to the next or previous page; focus then goes to the row that took its place". The plan's test says the tab "shows page 2 (push)" and "focuses the row that took its place". If the tab shows page 2, the neighbour that took the moved row's place is on page 1, which is no longer shown.

- **A (built, recommended):** the tab follows the moved item. It pushes the new page, focuses the item's own Move control there, and the polite line says "{team} moved to page {2}." The person keeps their place on the item they moved.
- **B:** stay on the same page and focus the neighbour that took the place. The moved item then vanishes from view and the person has to look for it on the other page.

### O-2: wording the UI-SPEC does not give (SPEC-GAP)

Built with plain wording the owner can change in `siteContentCopy.ts`: the polite line for a move inside a page ("{team} moved to place {2} of {6}."), "Choose a product line" (the Select's empty option), "Photo chosen" (the picker's status line), "No photo chosen yet" (the empty frame), "Filter the gallery" (the name of the toolbar), the danger toasts ("Couldn't move {team}", "Couldn't hide {team}", "Couldn't show {team}"), and "This photo wasn't found. It may have been deleted or moved to another page." (Load Latest finds the upload gone, or no longer on the page the tab shows).

### O-3: the Edit window offers one photo place, not a second save

On an edit, "Replace Photo" picks a file that goes up when "Save Photo" is pressed (the photo first, then the form). The UI-SPEC says "edit offers Replace Photo" and does not say whether the photo saves at once like PhotoSlot. Built as one Save, so a Cancel leaves the old photo.

## Accomplishments

- **Service and hooks.** `galleryItemsService` (list, create as multipart, update, replacePhoto, move, hide, show, remove) and `useGalleryItemQueries`: the page query is keyed on the parsed line, page and size and keeps the rows of the page it had; every write reads the gallery pages and the product lines again and clears the public data in this browser; one Idempotency-Key per submission, and a finished move is a new intent the next time.
- **The list.** A 56 px decorative thumb (or a placeholder) with the name over "{Basketball} · {17} pcs", Source ("Uploaded" or the order number as a link), Status (Shown or Hidden, and "Line hidden" under an item whose line is hidden), and the actions. ResultBar reads "Showing 6 items · in gallery order" ("1 item"). Empty, filtered-empty ("No items in {Basketball} yet." with Show All Lines), loading and error states each have their own copy.
- **URL state.** `useGalleryTabParams` on `createListParams`: `line` (a GUID, then checked against the loaded lines and dropped with one replace if unknown), `page`, `size`. A line or size change replaces and resets the page; a page change pushes; a page past the last becomes the last. `useSiteContentTab` removes the three params in the same replace as a tab change, and from a link that carries them on another tab.
- **The window.** `GalleryPhotoModal`: the consent Note, the Photo picker (prepareImage, the server's image rules, the pick-error box), Team or name, Product line (hidden lines as "{title} (hidden)"), Pieces, Note, "Show on the website" ticked by default, "Save Photo" (pending "Uploading", then "Saving"), the dirty guard, the server's messages under their fields, and the ConflictBanner with Load Latest on a stale edit.
- **Row actions.** Moves swap with the visible neighbour (the filtered one when a line is chosen) and may cross a page edge; Hide and Show are immediate; Delete asks first with Cancel focused. While one action saves every other control is aria-disabled and the pressed one is busy (WEB-09). Order items have only Move up, Move down and "Change {team} on order {number}".
- **E2E and docs.** `web/e2e/site-content-gallery.spec.ts` (`@site-content-gallery`, three journeys) and a row in `docs/web/e2e.md`.

## Task Commits

1. **Task 1 (tracer): add a photo of older work, the list**
   - RED `1a0555ec` (test)
   - GREEN `934290c6` (feat)
2. **Task 3 (done before Task 2): the line filter, paging and page size in the URL, every state**
   - RED `16bed76c` (test)
   - GREEN `72bbc650` (feat)
3. **Task 2: moves, edit, replace, hide, show and delete**
   - RED `f887e689` (test)
   - GREEN `01499a64` (feat)

4. **After the gates:** `69a72280` (docs: the e2e guide row and the params hook comment), `0e4ab80f` (style: Prettier over the nine files it flagged, no behavior change), `837b62e4` (test: the e2e fix, see Issues Encountered) and `3ddbb7ba` (test: five seconds for the first render of a fresh test worker).

**Plan metadata:** the SUMMARY commit follows this file.

## TDD Gate Compliance

RED and GREEN commits exist in order for all three tasks. `gsd_run check tdd-red-evidence` takes TAP, JUnit, swift-testing or unittest reports; this repository's web runner is Vitest with its own reporters and the classifier was not run. Each RED was read by hand against the real console output.

- **Task 1 RED** (`1a0555ec`): 50 failed of 385 in the six new and changed test files. The service, hooks, window and tab were stubs that threw "not built yet" or rendered nothing, so every failure was a missing behavior: `Error: The gallery service is not built yet.`, `Unable to find role="table" and name "Gallery items"`, `Unable to find role="dialog"`, and the Site Content page test that expects the Gallery tab. None was an import, compile or setup fault. **Not a RED, stated plainly:** the schema (`galleryUploadSchema`) and the copy were written before their tests, so `siteContentSchemas.test.ts` passed on its first run.
- **Task 3 RED** (`16bed76c`): 12 failed of 36 (the Product line Select, paging, Rows per page, the page clamp, the unknown-line drop and the filtered-empty state were missing; the params hook was a stub that did not check the line). The size and page fallback tests passed at once, because the shared factory already does that.
- **Task 2 RED** (`f887e689`): 18 failed of 42 (no row had an action). **Not a RED:** the edit-window tests in `GalleryPhotoModal.test.tsx` passed at once, because the window is one component and its edit branch came with Task 1.
- **Written with the code, not RED:** the four `useSiteContentTab` tests for the Gallery params passed on their first run (the hook change and its tests were written together).

## Evidence (real results)

- Tracer: `npm --prefix web run e2e -- --project=chromium --grep @site-content-gallery` after Task 1: `1 passed (1.2m)` (the add journey).
- After Task 2 and 3, the last fix (`837b62e4`) in `chromium`: `3 passed (1.4m)` (the add journey 18.7s, the URL and 320px journey 7.3s, the move, hide and delete journey 10.7s). In the other four projects (`firefox`, `webkit`, `pixel`, `iphone`, one run): `10 passed (3.8m)` and 2 failed, both the add journey: `[firefox]` stopped in `signInAs` (`/admin/login/verify` instead of `/admin`) and `[pixel]` saw "Brgy. Sample Ballers" as the first row instead of `E2E-Riders` after the add (7 rows). Run again alone: `npm --prefix web run e2e -- --project=pixel --project=firefox --grep "@site-content-gallery a Manager adds"` gave `2 passed (2.2m)`. So all three journeys passed in all five projects, but the pixel result is a failure I could not explain and it did not repeat: see Issues Encountered.
- Unit and component, the plan's three verify sets plus the files around them (`GalleryTab`, `GalleryPhotoModal`, `useGalleryItemQueries`, `galleryItemsService`, `siteContentSchemas`, `SiteContentPage`, `useGalleryTabParams`, `useSiteContentTab`, the recipe and no-long-dash node tests): all passed in their last run (GalleryTab 42 of 42, GalleryPhotoModal 24 of 24).
- `npm --prefix web run typecheck`: exit 0, no output after the three tsc lines.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`, the whole web project): `exit=0`, no problems, run after Task 2. The files that Prettier then changed (and the e2e spec) were linted again alone: no output. `npx prettier --check src/modules/admin src/test/siteContentFixtures.ts e2e/site-content-gallery.spec.ts`: "All matched files use Prettier code style!"
- `npm --prefix web run build:budget`: public JS home 149.29 KB, products 145.93, gallery 147.21, contact 149.22, notFound 142.00 (limit 150); admin JS 220.35 KB (limit 250); CSS 19.36 KB (limit 35). The public numbers are unchanged from the state after 11-29 (home 0.71 KB left, contact 0.78 KB left): the Gallery tab sits in the lazy admin Site Content chunk (46.80 KB gzip) and adds nothing to a public page.
- Acceptance greps: `'gallery'` in `SiteContentPage.tsx` = 1; `prepareImage` in `GalleryPhotoModal.tsx` = 3; `moved to page` in `siteContentCopy.ts` = 1; `useQueryStates` in `useGalleryTabParams.ts` = 1.
- `gitleaks protect --staged --no-banner` ran before every commit: no leaks. Every team, name and note in the tests is made up (Sample Barangay Riders, Brgy. Sample Ballers and so on); no real name, address, path or secret was written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 3 was built before Task 2**
- **Found during:** planning the order of work.
- **Issue:** Task 2's page-edge moves ("shows page 2 (push)") need the page in the URL, the pager and the line filter, which are Task 3's.
- **Fix:** executed Task 1, then Task 3, then Task 2. The commits carry the task in their message and each still has its RED and GREEN. No scope change.
- **Commits:** `16bed76c`, `72bbc650`, `f887e689`, `01499a64`

**2. [Rule 3 - Blocking] `useSiteContentTab` and its test changed**
- **Found during:** Task 3. The plan says the params "drop when the tab is not gallery", but `useGalleryTabParams` is only mounted on the Gallery tab, so it can never see another tab.
- **Fix:** the drop lives in `useSiteContentTab` (always mounted), in the same replace as the tab change, plus one replace for a link that carries the params on another tab. Four tests were added there. The plan's file list did not name these two files.
- **Commit:** `72bbc650`

**3. [Rule 1 - Bug avoided] Existing Site Content page tests pinned the old behavior**
- **Found during:** Task 1. `SiteContentPage.test.tsx` listed four tabs and used `?tab=gallery` as "a tab that is not built yet".
- **Fix:** the tab list now has five tabs, and the "not built" case uses `?tab=bogus`. A test for opening the Gallery tab was added.
- **Commits:** `1a0555ec`, `934290c6`

**4. [Rule 3 - Blocking] A refused multipart upload cannot be answered by the fake API**
- **Found during:** Task 1 tests. A 400 answered by MSW to a jsdom `FormData` body ends as a network error (`RequestContentLengthMismatchError`), even when the handler reads the body first.
- **Fix:** the refusal tests make `galleryItemsService.create` and `.replacePhoto` reject with `uploadRefused(...)` (a new fixture helper that builds the same `HttpError` the client raises), as the order photo tests do. The success path still goes through MSW and the real service. Add-in-flight tests gate a spied `create` with a deferred.
- **Commit:** `934290c6`

**5. [Rule 2 - Missing critical] The order row link needed a name that says where it goes**
- The plan names the action "Change {team} on order {ORD-2026-0148}" as a link; `RowAction` with `to` renders the `arrow-up-right` link with that name. No further change.

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug avoided), 1 noted. **Impact on plan:** none on scope or behavior.

## Issues Encountered

- **First test of a fresh Vitest worker timed out twice in six full-file runs.** `GalleryTab.test.tsx > the list > has the card head...` failed with `Unable to find role="table" and name "Gallery items"` (the 1 second `findByRole` default) while an e2e build, a lint run and other executors were using the machine; it passed alone each time. `openTab` now waits up to 5 seconds (`3ddbb7ba`) and the file passed in all five runs after that (42 of 42). In the one wide run (`src/modules/admin/components`, `hooks`, `services` and the page test: 158 files, 2975 tests) seven tests failed on the same cold-start timeouts, in `EditUserPanel`, `ExpenseModal`, `LedgerCard.owner`, `OrderRefundModal`, `TestimonialsTab` and mine; four of those five other files passed on a re-run, `ExpenseModal` (54 of 54) passed alone. I did not touch those files. After the last change the same folders' `hooks` and `services` (69 files, 895 tests) passed, and so did `SiteContentPage.test.tsx` with `useSiteContentTab.test.tsx`, the recipe and the two layout node tests (52 tests) in an earlier run. The page folder run (`src/modules/admin/pages` and the schema test: 28 files, 1384 tests) had 4 failures, all in `OrderFormPage.test.tsx` and `ProfilePage.test.tsx` (files this plan does not touch); both files passed alone (141 of 141).
- **The e2e host is shared with other executors, and it cost several runs.** Six runs stopped before any test with `https://localhost:5199/health is already used`, `Port 5199 is in use by another process` or `seed failed` (another executor's `scripts/e2e.mjs` held or reset the port and `CSPS_E2E`). One run that did start had the database dropped under it by another executor's start-up seed: the add journey got a 500 from `POST /api/v1/gallery-items` and the server log says `Login failed for user` on `CSPS_E2E` at that second. I did not stop their processes (the permission system refused it, rightly). I waited for the port and ran again.
- **Two real e2e faults of my own, fixed in `837b62e4`.** The first full run after Task 3 had the filter journey wait 8 minutes: the plan's text and my test used "Rows per page", but `Pagination` is drawn only above ten items and the demo has six, so `selectOption` waited for a control that does not exist. The size now comes in the link (`size=10`). The move journey looked for an order link named `ORD-...`, but the demo orders are numbered `DEMO-GALLERY-n`.
- **One e2e result I could not explain: `[pixel]` add journey, once.** In the all-projects run, after the add (7 rows) the first row was a demo order, not `E2E-Riders`. The server gives a new upload the lowest position under the site-content lock (`GetTopPositionAsync`, `MIN - 1`), the same journey passed in `chromium`, `webkit` and `iphone` in that run and in `pixel` and `firefox` when run alone, and the page read is the plain list. I suspect another worker or another executor re-showing the demo orders at that moment, but I have not shown it. Recorded, not fixed; if it comes back, run it with the trace (`test-results/...-pixel/trace.zip` is overwritten by the next run).
- **The `[firefox]` add journey, once:** `signInAs` ended on `/admin/login/verify` (the sign-in code step) instead of the dashboard, before any gallery code ran. Passed alone.
- **No Python on this machine and long heredocs are refused by the Bash tool**, so larger edits went through the Edit tool.

## Known Stubs

None. `GalleryTab` passes `onSaved={() => undefined}` to the add window on purpose: the list reads again by itself and a new upload joins page 1, so there is nothing to focus.

## Threat Flags

None new. T-11-81 (line, page and size: allow-list parsers, GUID line checked against the loaded lines, one replace; the server caps size at 100) is covered by `useGalleryTabParams.test.tsx` and `GalleryTab.test.tsx`. T-11-82 (publishing without consent): the window's Note "Only add photos the customer said you may show." is shown first and on edit too, and order items cannot be changed here. T-11-SC: no package added or bumped.

## User Setup Required

None.

## Next Phase Readiness

- **11-37:** the gallery audit codes are labelled there (11-28's table); nothing in this plan adds an audit code.
- **11-30 and 11-31 (public Gallery):** the public read is unchanged. Moves here change the order of `GET /api/v1/public/gallery`.
- **Merge hot spots:** `web/src/modules/admin/siteContentCopy.ts`, `siteContentSchemas.ts`, `siteContent.recipe.ts`, `web/src/test/siteContentFixtures.ts`, `SiteContentPage.tsx` (the `BUILT_PANELS` map) and `docs/web/e2e.md`.

## Self-Check

PASSED. The 11 files under key-files.created exist on disk (11 of 11 checked with `[ -f ]`). The ten commits `1a0555ec`, `934290c6`, `16bed76c`, `72bbc650`, `f887e689`, `01499a64`, `69a72280`, `0e4ab80f`, `837b62e4` and `3ddbb7ba` are all ancestors of HEAD (`git merge-base --is-ancestor`); the measured count is 10 (`git rev-list --count 862a9206..HEAD` before this SUMMARY commit, with the base read from the per-plan ledger file). No file was deleted (`git diff --diff-filter=D` is empty). STATE.md and ROADMAP.md were not touched. The four acceptance greps pass.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*

---
phase: 11-public-site-content-management
plan: 31
subsystem: public-site-ui
tags: [react, gallery, lightbox, dialog, focus-trap, swipe, tap-zones, history, router-state, lazy-chunk, bundle-budget, a11y, playwright]
created: 2026-11-12T22:20:00-06:00
updated: 2026-11-12T22:20:00-06:00

requires:
  - phase: 11-29
    provides: "GalleryMasonry onOpen(itemIndex), GalleryBody (the lazy Gallery body), the PublicGalleryItemDto photos with viewer and thumb addresses, the lightbox copy strings, the demo gallery fixtures"
  - phase: 11-26
    provides: "GET /api/v1/public/gallery (public text only, no photo description)"
  - phase: 09-04
    provides: "photoViewer.recipe.ts looks and the overlay hooks (useFocusTrap, useInertOutside, useBodyScrollLock)"
provides:
  - "GalleryLightbox: a modal dialog 'Gallery image viewer' inside the page root, with position '3 / 16' (hidden word 'Item 3 of 16'), wrapping Previous and Next, arrow keys, Esc, phone tap zones, swipe, a thumbnail row for 2 or more photos, the caption with a quote link, and two polite announcements"
  - "GalleryLightboxFrame: the dialog shell with a 4 / 3 skeleton, shown at once while the lightbox chunk loads"
  - "useSwipe(ref, { onLeft, onRight, minDistance: 48 }) on pointer events, swallowing the click after a swipe"
  - "useLightboxHistory(open, onClose) returning { close, leaveTo }: one history entry with the same URL and an open flag, Back closes, Esc and Close go back one entry, the quote link replaces the entry"
  - "GalleryMasonry takes focusRequest (a fresh object per request); the Gallery body returns focus to the tile of the item last shown, drawing more tiles first"
  - "Fixtures itemWithFourPhotos, itemWithNoPhoto, itemUpload, singleItemFilter; e2e @gallery-lightbox (8 specs in 5 projects)"
affects: [11-37]

actuals:
  tokens: 18700
  tasks: 3
  commits: 6
plan_head_before: 862a92061bf87252a7f4cce275a270d961bda960
plan_head_after: 5b7d53a9ecaf7fbaed10d7b2c2602e5224041df2

tech-stack:
  added: []
  patterns:
    - "The lightbox lives in the lazy Gallery body and is its own lazy chunk, declared in the one lazy file (lazyGallery.ts); the frame shown while it loads is part of the body chunk"
    - "A history entry as the 'closed by Back' signal: the open flag in router state is the single source of truth, and an effect closes the lightbox when an open lightbox loses the flag"
    - "A focus request is a new object, so the same tile can be asked for again (a counter or a changing index would not do)"
    - "Phone tap zones are real buttons shown by a 767px media class, so tests read the classes and Playwright reads the real layout"

key-files:
  created:
    - web/src/modules/public/components/GalleryLightbox.tsx
    - web/src/modules/public/components/GalleryLightbox.test.tsx
    - web/src/modules/public/components/galleryLightbox.recipe.ts
    - web/src/modules/public/hooks/useLightboxHistory.ts
    - web/src/modules/public/hooks/useLightboxHistory.test.tsx
    - web/src/modules/public/hooks/useSwipe.ts
    - web/src/modules/public/hooks/useSwipe.test.tsx
  modified:
    - web/src/modules/public/components/GalleryBody.tsx
    - web/src/modules/public/components/GalleryMasonry.tsx
    - web/src/modules/public/components/GalleryStates.tsx
    - web/src/modules/public/components/lazyGallery.ts
    - web/src/modules/public/pages/GalleryPage.test.tsx
    - web/src/modules/public/copy.ts
    - web/src/test/publicFixtures.ts
    - web/e2e/gallery.spec.ts
    - docs/web/e2e.md
    - .planning/phases/11-public-site-content-management/deferred-items.md

key-decisions:
  - "The lightbox mounts in GalleryBody (the lazy chunk 11-29 made), not in GalleryPage, and its lazy declaration sits in lazyGallery.ts beside LazyGalleryBody: one lazy file per page, as the orchestrator notes ask."
  - "The history hook lives in the Gallery body, not in the lightbox, so the entry is pushed at once on the press (the frame shows before the chunk loads) and Back works during loading."
  - "'Get a quote for something like this' replaces the lightbox's history entry with /contact instead of pushing: Back from Contact then lands on the Gallery with the lightbox closed, and no duplicate Gallery entry is left."
  - "A change of category closes the lightbox because the results are keyed by category (the lightbox state resets), and the hook takes any leftover open flag off the entry."
  - "Focus is not returned by the focus trap (returnFocus false): the body focuses the tile of the item last shown. The tile index goes through a focusRequest object on the masonry."
  - "When a focused thumbnail leaves with its item (the next item has fewer photos), focus moves to Close, so the arrow keys keep working."

patterns-established:
  - "Test the lazy chunk with a vi.mock factory counter: the factory runs on the first request of the module, so 0 before the press and 1 after proves it loads on first open."
  - "A page test that opens the lightbox waits for the Close viewer button before it reads the dialog: the frame shown while the chunk loads is also a dialog with the same name."

requirements-completed: [GAL-02]

coverage:
  - id: D1
    description: "Pressing a tile opens the lightbox on that item: modal dialog 'Gallery image viewer' inside the page root with focus on Close viewer, '3 / 16' hidden from assistive technology with a hidden 'Item 3 of 16', the photo with alt '{team}, {Basketball} work', loaded eagerly and never cropped"
    requirement: GAL-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/GalleryLightbox.test.tsx#GalleryLightbox open and step; web/src/modules/public/pages/GalleryPage.test.tsx#GalleryPage lightbox"
        status: pass
      - kind: e2e
        ref: "web/e2e/gallery.spec.ts @gallery-lightbox pressing the third tile opens the viewer on it (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Previous and Next wrap within the active filter, the arrow keys do the same from anywhere in the dialog, Esc and Close close, with one item there is no Previous, Next, tap zone or swipe"
    requirement: GAL-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/GalleryLightbox.test.tsx (wrap, keys, filter order, single item)"
        status: pass
      - kind: e2e
        ref: "web/e2e/gallery.spec.ts @gallery-lightbox (arrow wrap and Esc, 5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "C-35: above 767px the 56px buttons show and the tap zones are hidden; at 767px and below two invisible full-height buttons over the left and right thirds ('Previous photo', 'Next photo') with a 2px chrome-ink focus ring replace them; a swipe of 48px or more that is more horizontal than vertical moves, and the click after a swipe is swallowed"
    requirement: GAL-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/hooks/useSwipe.test.tsx (8 tests); GalleryLightbox.test.tsx#GalleryLightbox phone tap zones and swipe"
        status: pass
      - kind: e2e
        ref: "web/e2e/gallery.spec.ts @gallery-lightbox the 56px buttons ... and the tap zones (5 projects, zone width a third of the box and as tall); swipe of 80px and 20px (pixel and iphone)"
        status: pass
    human_judgment: false
  - id: D4
    description: "An item with 2 or more photos shows a centered row of 56px thumbnails (44px at 420px and below) named 'Show photo {i} of {n}', the shown one with aria-current and a 2px ring; the cover shows first and again after leaving and coming back; the alt adds ', photo {i} of {n}'"
    requirement: GAL-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/GalleryLightbox.test.tsx#GalleryLightbox thumbnails"
        status: pass
    human_judgment: false
  - id: D5
    description: "Caption: team in display caps (long names wrap), '{Basketball} · {17} pcs · {note}' with missing parts left out, and 'Get a quote for something like this' to /contact; D-13: only the public name, line, pieces and note are shown; JerseyArt named by the alt for no photo; MediaPlaceholder named by the alt for a failed photo"
    requirement: GAL-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/GalleryLightbox.test.tsx#GalleryLightbox caption, announcements and photos (the exact text of the dialog is asserted for an upload)"
        status: pass
      - kind: e2e
        ref: "web/e2e/gallery.spec.ts @gallery-lightbox at 320 and 1440px a long team name stays in the caption, no sideways scroll, clean axe (5 projects)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Polite announcements 'Item {3} of {16}: {team}, {Basketball}' on an item change and 'Photo {2} of {4}' on a thumbnail change; tab order Close, Previous, Next, thumbnails, Get a quote (phones: Close, the tap zones, thumbnails, Get a quote); zero axe with four photos, no photo, one item and a failed photo"
    requirement: GAL-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/GalleryLightbox.test.tsx (announcements, tab order for desktop and phone, axe cases)"
        status: pass
    human_judgment: false
  - id: D7
    description: "History and focus: opening adds one entry with the same URL, Back closes it and stays on the same category, Esc and Close leave no extra entry, the quote link replaces the entry, a category change closes it; on close focus goes to the tile of the item last shown (48 tiles drawn when it was beyond the first 24)"
    requirement: GAL-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/hooks/useLightboxHistory.test.tsx (8 tests); GalleryPage.test.tsx#GalleryPage lightbox focus, history and filter (6 tests)"
        status: pass
      - kind: e2e
        ref: "web/e2e/gallery.spec.ts @gallery-lightbox the browser Back button closes the viewer ...; Esc leaves no extra history entry (5 projects each)"
        status: pass
    human_judgment: false
  - id: D8
    description: "PERF-01: the lightbox is its own lazy chunk (GalleryLightbox 7.79 kB, 3.40 kB gz), asked for on the first press only; the Gallery route stays at 147.37 KB gz (limit 150)"
    requirement: GAL-02
    verification:
      - kind: other
        ref: "npm --prefix web run build:budget: public JS (gallery) 147.37 KB; GalleryPage.test.tsx#asks for the lightbox chunk only when a tile is first pressed"
        status: pass
    human_judgment: false
  - id: D9
    description: "The lightbox looks like the approved App. C / E.3 viewer (scrim, chrome ink, caption, thumbnails, the tap zones on a real phone)"
    verification: []
    human_judgment: true
    rationale: "No parity scenario covers the Gallery lightbox, and a real finger swipe was not exercised (the e2e swipe dispatches pointer events). The owner reviews the look and the feel in the UI review."

duration: about 95 min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 31: Visitors open any Gallery item in a lightbox and move through it by key, tap, swipe or button Summary

**A lazy Gallery lightbox (modal dialog in the page root, focus trap, inert page, scroll lock) with wrapping Previous and Next, arrow keys, phone tap zones and a 48px swipe, a thumbnail row for an order's photos, a caption with a quote link, polite announcements, focus returned to the tile of the item last shown, and one history entry so the phone Back button closes it.**

## Performance

- **Duration:** about 95 min
- **Started:** 2026-11-12T20:40:00-06:00 (estimated; the first test run is 20:45)
- **Completed:** 2026-11-12T22:20:00-06:00
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files in the diff:** 16 changed (7 source files created, plus tests, fixtures, the e2e spec, one doc and the deferred-items file; no file deleted). actuals.tokens is chars/4 over the added lines under web/ and docs/ (about 74,800 characters).

## Accomplishments

- **Tracer (Task 1):** `GalleryLightbox` opened from a tile, with the position, wrapping Previous and Next, arrows and Esc, behind a skeleton frame while its chunk loads. The tracer's verify is automated only, so it was re-run on the finished tree before expansion: unit `Tests 31 passed (31)` (2 files) and `@gallery-lightbox` `5 passed (58.8s)`. Tracer verified end to end, expanding.
- **Task 2:** the phone tap zones, `useSwipe`, the thumbnail row, the caption, the quote link, the jersey for no photo, the failed-photo placeholder, the two announcements and the single-item rules.
- **Task 3:** `useLightboxHistory`, the focus return with the extra tiles, the close on a category change, and the budget check.
- **Public bundle figures (gzip -9, 1 KB = 1000 B, limit 150.00 KB; `npm --prefix web run build:budget`, exit 0):**

| Page | After 11-29 | Final |
|---|---|---|
| home | 149.29 | **149.36** (0.64 KB left) |
| products | 145.93 | 146.01 |
| gallery | 147.21 | **147.37** (2.63 KB left) |
| contact | 149.22 | **149.30** (0.70 KB left) |
| notFound | 141.99 | 142.08 |

Admin 220.88 KB, CSS 19.59 KB. The lightbox is its own chunk: `GalleryLightbox-1jdVcdlR.js 7.79 kB │ gzip: 3.40 kB`, next to `GalleryBody-BgPuVPws.js 14.37 kB │ gzip: 5.99 kB` and `GalleryPage-Cxyc-5zS.js 1.62 kB │ gzip: 0.78 kB`. Every public page grew by about 0.07 to 0.16 KB, the new lazy chunk's entry in the preload table.

## Task Commits

1. **Task 1 (tracer):** RED `fa6cb465` (test), GREEN `c63fadf3` (feat)
2. **Task 2:** RED `ee5f8690` (test), GREEN `24c6535b` (feat)
3. **Task 3:** RED `9aa84818` (test), GREEN `5b7d53a9` (feat)

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) was not required; each RED was read by hand against the real console output. Each RED commit precedes its GREEN commit. No REFACTOR commits.

- **Task 1 RED (`fa6cb465`):** 11 failed, 19 passed of 30, against a stub `GalleryLightbox` that returns null. Every failure is a planned assertion (no dialog, no position, no image). The axe case failed on the helper's "container is empty" rule, which is a stub artifact. The frame test (`GalleryLightboxFrame`) was written together with its code and not seen RED first.
- **Task 2 RED (`ee5f8690`):** 23 failed, 16 passed of 39, against a stub `useSwipe` that never listens and the Task 1 lightbox. Passed at once, as guards: the 40px and the vertical-drift swipe, the cancelled pointer, the unmount case, "no thumbnail row for one photo", the failed-photo placeholder (LazyImage already does it) and the axe cases.
- **Task 3 RED (`9aa84818`):** 11 failed, 25 passed of 36, against a stub `useLightboxHistory` that makes no entry. Passed at once, as guards: Esc leaves no entry, a category change closes it, the quote link, plus the Task 1 and 2 tests.
- **Tests changed after their RED commit because they were written wrong, not the behaviour they check:** the page test that read the dialog node of the loading frame (now `loadedViewer()` waits for Close viewer); the page test for the quote link (the route change commits in a transition, so it waits for the dialog to leave); the 1440px long-name e2e (the name fits one line there, so only 320px asks for a second line); the Esc e2e (Esc before the chunk loads has nothing to answer it, so it waits for focus on Close); a stray `as` cast in the page test.

## Verification evidence (real output)

- **Unit, per task (after GREEN):** Task 1 files (`GalleryLightbox.test.tsx`, `GalleryPage.test.tsx`): `Test Files 2 passed (2)`, `Tests 31 passed (31)`. Task 2 files plus the page: `Test Files 3 passed (3)`, `Tests 61 passed (61)`. Task 3 files (`useLightboxHistory.test.tsx`, `GalleryPage.test.tsx`): `Test Files 2 passed (2)`, `Tests 36 passed (36)`.
- **Wider run** (`src/modules/public`, `src/layouts`, `src/components`, `src/test/no-long-dash.node.test.ts`, `src/test/source-layout.node.test.ts`, `scripts/tailwind-classes.test.ts`): `Test Files 88 passed (88)`, `Tests 2231 passed (2231)`. I did not run the whole web suite; the license-policy fresh-worktree failure in the orchestrator notes is outside this plan.
- **`npm --prefix web run typecheck`:** exit 0, no output. **`npm --prefix web run lint`** (`eslint . --max-warnings 0`): `exit=0`, no output. Prettier clean on every changed file.
- **`npm --prefix web run build:budget`:** the table above, exit 0.
- **e2e `@gallery-lightbox|@gallery` (5 projects), after the last code commit:** `60 passed`, `3 skipped` (the phone swipe spec on the three desktop projects), `2 failed`: (1) `@gallery at 1440px a focused tile is never under the header or the filter bar` in Firefox, a failure that is not from this plan (see Issues Encountered); (2) the new `Esc leaves no extra history entry` in Firefox, which logged "downloadable font: download failed" (the font download aborted when the spec ended on the Home page). I fixed (2) in the spec (wait for load and `document.fonts.ready` before it ends) and re-ran `Esc leaves no extra|Back button closes the viewer`: `ok` for all 10 runs (2 specs in 5 projects). I did not re-run the whole `@gallery-lightbox|@gallery` set after that spec-only fix.
- **Earlier e2e runs:** `@gallery-lightbox` Task 1: `5 passed (58.8s)`. Task 2: `17 passed, 5 failed, 3 skipped`, all five failures were the 1440px long-name spec (my expectation was wrong, see above); after fixing the spec, `@gallery-lightbox at 1440px`: `5 passed (58.0s)`.
- **Acceptance greps:** `createPortal` outside comments in `GalleryLightbox.tsx`: 0. `SPEC-DEVIATION: C-35`: 1. `SPEC-DEVIATION: A11Y-POS`: 1. `Show photo` in `copy.ts`: 1. `lazy(` in `GalleryPage.tsx`: 0, in `lazyGallery.ts`: 2 (see Deviation 1).
- gitleaks ran before every commit (the repo hook): no leaks. Every name in the fixtures is made up.

## Decisions Made

See `key-decisions`. The ones the owner may want to look at: the quote link replaces the lightbox's history entry (so Back from Contact lands on the Gallery with the lightbox closed), and Esc or Close pressed before the lightbox chunk has loaded does nothing (the loading frame has no handlers; Back still closes it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The lazy lightbox is declared in lazyGallery.ts and mounted in GalleryBody, not GalleryPage**
- **Found during:** Task 1
- **Issue:** the plan says "lazy-import it in GalleryPage" and checks `grep -c "lazy(" GalleryPage.tsx >= 1`. Since 11-29, GalleryPage is only the page head and the whole body (tiles included) is one lazy chunk; the tiles that open the lightbox live in `GalleryBody`. A second lazy declaration in another file would add a second preload table.
- **Fix:** `LazyGalleryLightbox` sits in `lazyGallery.ts` next to `LazyGalleryBody` (`grep -c "lazy(" lazyGallery.ts` is 2) and `GalleryBody` mounts it, as the 11-29 summary and the orchestrator notes say. The grep on `GalleryPage.tsx` is 0.
- **Files modified:** `lazyGallery.ts`, `GalleryBody.tsx`
- **Commit:** `c63fadf3`

**2. [Rule 3 - Blocking] Files beyond the plan list**
- `galleryLightbox.recipe.ts` (the lightbox classes the class gate compiles), `GalleryStates.tsx` (`GalleryLightboxFrame`), `GalleryBody.tsx`, `GalleryMasonry.tsx` (its `focusIndex` prop became `focusRequest`, a new object per request, so the same tile can be focused twice), `lazyGallery.ts`, `docs/web/e2e.md` (a row for `@gallery-lightbox`) and the phase `deferred-items.md`. `GalleryLightbox`'s props gained `onQuote`, and `useLightboxHistory` returns `{ close, leaveTo }`. `copy.ts` already held the lightbox strings from 11-29; only `meta` was added.
- **Commits:** `c63fadf3`, `24c6535b`, `5b7d53a9`

**3. [Rule 1 - Bug] Focus was lost when a focused thumbnail left with its item**
- **Found during:** Task 2 (the test "opens the next item on its cover again")
- **Issue:** choosing a thumbnail, then pressing ArrowRight to an item with one photo removed the focused button. Focus fell to the page, where the dialog's arrow keys no longer reach.
- **Fix:** an effect on the shown item moves focus to Close when focus is no longer inside the dialog.
- **Files modified:** `GalleryLightbox.tsx`
- **Commit:** `24c6535b`

**4. [Rule 1 - Bug] An item reopened on the photo chosen last time**
- **Found during:** Task 2 (same test)
- **Issue:** the chosen photo was kept by item id, so leaving an item and coming back showed photo 3, not the cover (UI-SPEC: each item opens on its cover).
- **Fix:** a step to another item clears the chosen photo.
- **Files modified:** `GalleryLightbox.tsx`
- **Commit:** `24c6535b`

### Differences from the plan text (no behaviour change)

- The plan's Task 3 e2e names the iphone project for the Back spec; it runs in all five projects.
- The e2e swipe dispatches pointer events on the photo box (a down, then an up 80px or 20px away). A real finger drag is not covered; the unit tests cover the arithmetic and `touch-action: pan-y` is on the frame.
- The history entry is pushed from `GalleryBody`, not from the lightbox, so it exists before the chunk loads.

---

**Total deviations:** 4 auto-fixed (2 Rule 3, 2 Rule 1), 3 notes. **Impact:** no scope creep; the owner-facing behaviour is the plan's.

## Issues Encountered

- **Not caused by this plan (logged as D-31-1 in `deferred-items.md`):** `@gallery at 1440px a focused tile is never under the header or the filter bar` fails in Firefox with `Open Sample Riders MC, Moto starts below the header and the bar` (`Received: 22.5, Expected: >= 132`). It failed 3 of 3 repeats in this tree and also on a clean checkout of the base commit `862a9206` (one run, same message), so it is not from the lightbox. Likely cause: the six-item seed from plan 11-28 against 11-29's spec.
- **Shared scratch folder:** the session scratch folder is shared with other executors, and another executor's run overwrote one of my e2e logs once (the name `e2e5.log`). Two of my own runs also overlapped on the e2e lock for a short time; their failures (a bind error on port 5199) are not counted. Later logs carry a `p1131-` prefix.
- **Port 5199 busy:** another executor's e2e held the host for a while twice; I waited for it to finish and never stopped any process. A temporary clean checkout of the base commit was made in the scratch folder for the Firefox comparison and removed.
- **Esc or Close before the chunk loads does nothing** (the loading frame has no handlers). Back closes it. Not changed: the plan asks for the frame at once, and the gap is a fraction of a second on a warm connection.

## Known Stubs

None.

## Authentication Gates

None.

## Threat Flags

None new. T-11-79: the alt is built from the public name and line only, and a test reads the dialog's whole text for an upload (position, name, line, pieces, note, the quote words) so no other text can appear. T-11-80: the history state is `{ "csps-gallery-lightbox": true }` and nothing else; the URL is unchanged and nothing read from history reaches a request. T-11-SC: no package was added or bumped (`package.json` and the lock file are unchanged; `npm ci --ignore-scripts` from the lockfile only).

## User Setup Required

None.

## Next Phase Readiness

- **11-37:** no audit code was added; no admin or API change here.
- **Budget:** Home has 0.64 KB left and Contact 0.70 KB; the Gallery has 2.63 KB left. The lightbox costs nothing until it is opened.
- **UI review:** the look and the real-phone feel of the lightbox (tap zones, swipe) are for the owner's UI review (coverage D9).
- STATE.md and ROADMAP.md were not touched (orchestrator owns them). `GAL-02` is declared by this plan only among the plans listed here; the orchestrator can mark it after merge.

## Self-Check

PASSED. The 7 files under `key-files.created` exist on disk. The six commits `fa6cb465`, `c63fadf3`, `ee5f8690`, `24c6535b`, `9aa84818` and `5b7d53a9` are all ancestors of HEAD (`git rev-list --count` from the base `862a9206` gives 6, linear history); each RED commit precedes its GREEN commit. The base and head ids and the commit count in the frontmatter were measured from the ledger written before the first commit. The working tree held nothing uncommitted except this file and `deferred-items.md`. STATE.md and ROADMAP.md were not touched. `gitleaks` found no leaks before each commit. No server, Playwright host or shell of mine is left running: every e2e run finished and exited on its own.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*

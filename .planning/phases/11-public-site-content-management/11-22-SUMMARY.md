---
phase: 11-public-site-content-management
plan: 22
subsystem: ui
tags: [react, photo-slot, product-lines, site-content, admin, image-upload, prepareImage, jersey-art, playwright, wcag]
created: 2026-11-12T12:20:00-06:00
updated: 2026-11-12T12:20:00-06:00

requires:
  - phase: 11-19
    provides: "POST and DELETE /api/v1/product-lines/{lineId}/photos/{slot} (main, back, fabric), the photos object on the Manager's line detail, the Testing image addresses"
  - phase: 11-20
    provides: "The product line editor (ProductLinePage), productLinesService and the product line hooks, the Photos card place and the save-first note, RowAction/dialog patterns, the site content e2e lock"
  - phase: 11-18
    provides: "JerseyArt and the public Products page that shows the photos"
  - phase: 09
    provides: "prepareImage, the image rules read, the pick-error box and the status line looks, the photo host lock"
provides:
  - "PhotoSlot: one named photo place (label, 4:5 or 1:1 or 1.91:1 frame, preview or placeholder, Choose Photo and Take Photo on touch, Replace Photo, ghost-danger Remove Photo with its question, status line Uploading then Saved, the P9 pick-error box); reused by the share picture (11-34) and the gallery window (11-32)"
  - "ProductLinePhotosCard: the three line slots in a row (one column at 767px and below), the line's drawing in an empty Main photo, labelled boxes in the other two, one slot saving at a time"
  - "productLinesService.uploadPhoto and removePhoto, useUploadLinePhoto and useRemoveLinePhoto (one Idempotency-Key per file, the line cache patched, the public data in this browser and the line list cleared)"
  - "siteContentCopy photoSlot and productLine.photos wording, test fixtures (linePhoto, lineWithPhotos, linePhotosBackend), three @site-content-photos e2e journeys in all five projects"
affects: [11-26, 11-32, 11-34, 11-37]

requirements-completed: [CONT-02, GAL-03]

actuals:
  tokens: 22900
  tasks: 2
  commits: 4
plan_head_before: 67b3e06ea0bed8a4efaa50013f29556b09e5faa0
plan_head_after: 3d3c1447fef191f3f5084d18352706e7b1345b88

tech-stack:
  added: []
  patterns:
    - "A slot with a photo and the slot with its placeholder share one fieldset (legend as the name), so the name does not become a label that the form field labels collide with"
    - "One action at a time in a card: each slot tells the card when it is busy (onBusyChange) and the card holds the other slots (locked) with aria-disabled, never disabled"
    - "The form that holds the line keeps the photos in the saved line it shows; a photo save does not touch the line version or the form's dirty state"

key-files:
  created:
    - web/src/modules/admin/components/PhotoSlot.tsx
    - web/src/modules/admin/components/PhotoSlot.test.tsx
    - web/src/modules/admin/components/ProductLinePhotosCard.tsx
    - web/src/modules/admin/components/ProductLinePhotosCard.test.tsx
    - web/src/modules/admin/components/photoSlot.recipe.ts
  modified:
    - web/src/modules/admin/pages/ProductLinePage.tsx
    - web/src/modules/admin/pages/ProductLinePage.test.tsx
    - web/src/modules/admin/services/productLinesService.ts
    - web/src/modules/admin/services/productLinesService.test.ts
    - web/src/modules/admin/hooks/useProductLineQueries.ts
    - web/src/modules/admin/hooks/useProductLineQueries.test.tsx
    - web/src/modules/admin/components/siteContent.recipe.ts
    - web/src/modules/admin/siteContentCopy.ts
    - web/src/test/siteContentFixtures.ts
    - web/e2e/site-content-products.spec.ts
    - docs/web/e2e.md

key-decisions:
  - "Other slots wait while one saves. The plan says the slot's other actions are aria-disabled; the card also holds the other two slots (they share the site content write lock on the server, and one file at a time is the threat register's rule T-11-56). Parked as OI-3"
  - "PhotoSlot is a fieldset with a legend, not role=group with aria-labelledby: a group named 'Fabric detail' is a label that getByLabel(/^Fabric/) (the textarea's own label) also found"
  - "The slot takes a noun ('Photo' or 'Picture') so the share picture can say Choose Picture, and remove, locked and busy props are optional so a slot without removal has no Remove button"
  - "A 404 on Remove Photo (the photo is already gone) counts as removed: the slot empties and the toast says Photo removed. No other state changes"
  - "The pick-error box reuses the Phase 9 recipe tokens from components/media/media.recipe.ts and the order photo rules, copy and checks (orderPhotosSchemas, ORDER_PHOTOS_COPY); only the slot's own looks are in photoSlot.recipe.ts"

patterns-established:
  - "PhotoSlot onUpload(file) / onRemove() resolve with a useSubmission-shaped outcome ({ ok: true } or { ok: false, error }), so a hook's submit is handed in as it is"
  - "The file sent is `new File([prepared.file], prepared.name, { lastModified: original.lastModified })`, so choosing the same file again is the same upload and keeps its Idempotency-Key"

duration: about 1h 10m
completed: 2026-11-12
status: complete

coverage:
  - id: D1
    description: "A Manager picks a main photo for Polo in the editor, it goes through prepareImage, uploads under one Idempotency-Key, shows Uploading then Saved with the toast 'Photo saved' / 'It shows on the website now.', and the public Products page shows it in the Polo article"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PhotoSlot.test.tsx (picking a file); ProductLinePhotosCard.test.tsx (adding a main photo)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-products.spec.ts @site-content-photos a Manager picks a main photo for Polo, it uploads, and /products shows it (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three slots in a row (one column at 767px and below): Main photo 4:5 with the line's drawing while empty, Back view and Fabric detail 1:1 with labelled boxes; Choose Photo on hover devices, Take Photo as well on touch devices"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "ProductLinePhotosCard.test.tsx (the Photos card with no photos yet); PhotoSlot.test.tsx (an empty slot)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-products.spec.ts @site-content-photos the three photo slots sit in a row on a tablet and stack at 390px (5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A refused pick (type, size, pixels, unreadable, rules not readable) shows the Phase 9 pick-error box with the Phase 9 words and sends nothing; a refused or failed upload shows the server's line or the network words in the same box"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "PhotoSlot.test.tsx (refuses a file the browser check turns down; refuses a prepared file that is still over the size rule; says so when the rules cannot be read; shows the server line; says to check the connection)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Replace Photo puts a new file in the same slot; Remove Photo asks first in the slot's words with Cancel focused, then shows 'Photo removed' / 'The drawing shows instead.', brings the drawing back and puts focus on Choose Photo; a failed removal stays in the question"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "PhotoSlot.test.tsx (removing a photo); ProductLinePhotosCard.test.tsx (replacing and removing)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-products.spec.ts @site-content-photos a Manager replaces then removes Polo main photo, and /products shows the drawn jersey again (5 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "One action at a time: the pressed control is pending (aria-busy), the slot's other actions and the other slots are aria-disabled and keep focus, and the Photos card holds the other two slots until the save ends"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "PhotoSlot.test.tsx (one action at a time); ProductLinePhotosCard.test.tsx (holds the other two slots while one saves)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A new line shows 'Save the product line first, then add photos.' and no slots; a photo save leaves the form clean (leaving asks nothing) and does not change the version a later Save Changes sends"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "ProductLinePage.test.tsx (the Photos card in the editor)"
        status: pass
    human_judgment: false
  - id: D7
    description: "PUB-03: each photo change clears the public data held in this browser and reads the line list again, and the Products page shows the new photo on the next load"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "useProductLineQueries.test.tsx (useUploadLinePhoto, useRemoveLinePhoto); ProductLinePhotosCard.test.tsx"
        status: pass
      - kind: e2e
        ref: "@site-content-photos the first two journeys (the Polo article shows the photo, then the drawing again)"
        status: pass
    human_judgment: false
  - id: D8
    description: "MUST NOT upload a file that has not been through prepareImage, and MUST NOT keep a picked photo's EXIF or location data in what is sent: only the redrawn file (prepared.file under the prepared name) is passed to onUpload, never the picked File"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "PhotoSlot.test.tsx (prepares the file with the server rules, then sends the prepared bytes under the prepared name; refuses ... and sends nothing)"
        status: pass
    human_judgment: true
    rationale: "The plan marks this prohibition as a judgment item (privacy, unverified). The tests prove the sent bytes are the prepared ones and that a refusal sends nothing; that prepareImage's canvas redraw removes metadata in every browser, and the server strips it again (11-19), is a reviewer call."
  - id: D9
    description: "The Photos card, the slots and the pick-error box look right: sizes (160px previews, 320px share picture), spacing, the Remove button, the status line"
    verification: []
    human_judgment: true
    rationale: "The screens are SPEC-GAP built from the My Profile card parts and the Phase 9 looks; no parity scenario draws them. The owner judges them in the UI review."
  - id: D10
    description: "The public Contact page stays inside its 150 KB budget"
    verification:
      - kind: other
        ref: "npm --prefix web run build:budget: public JS (contact) 150.02 KB, limit 150.00 KB, OVER (baseline before this plan 149.96 KB)"
        status: fail
    human_judgment: true
    rationale: "Open item OI-1: freeing bytes in the public graph, or moving the limit, is the orchestrator's and the owner's call. See Issues Encountered."
---

# Phase 11 Plan 22: A Manager adds the main, back and fabric photos to a product line Summary

**A reusable PhotoSlot (preview or placeholder, Choose, Take on touch, Replace, Remove with its own question, Uploading then Saved, the Phase 9 pick-error box) and the product line editor's Photos card over plan 11-19's routes: each photo is checked and redrawn in the browser, saved at once under one Idempotency-Key, clears the public data, and shows on the Products page; one action at a time.**

## Performance

- **Duration:** about 1h 10m (11:12 to about 12:20, -06:00); the e2e runs and the bundle experiments took about a third of it
- **Tasks:** 2 (1 tracer, 1 auto), both TDD
- **Files in the diff:** 16 (5 created, 11 modified), 2,170 lines added; the added text is about 22,900 tokens on the chars/4 scale (the plan estimated 110,000)

## Accomplishments

- **PhotoSlot.** A fieldset named by its legend. The frame is 4:5 or 1:1 at 160px wide, or 1.91:1 (320px, full width on a phone) for the share picture. An empty slot shows the placeholder the caller gives; a slot with a photo shows it in `LazyImage` with the server's srcSet. Choose Photo (secondary, small, `cloud-upload`) works everywhere; Take Photo (`camera`) shows only where hover is none; with a photo the first button says Replace Photo and Remove Photo (ghost-danger, `trash-2`) joins it. The word is Photo or Picture (a `noun` prop, for 11-34).
- **Pick and upload.** The file goes through `prepareImage` with the server's rules (`GET /orders/image-rules`, one read per hour), then the Phase 9 pick check (`pickIssue`), then `onUpload` gets a new `File` made from the redrawn bytes under the prepared name. A refusal shows the Phase 9 pick-error box with the Phase 9 words and sends nothing; a refused or failed upload shows the server's own line, or the connection or slow-down words. The status line reads Uploading (spinner) then Saved (check); the toast is 'Photo saved' / 'It shows on the website now.'
- **Remove.** Remove Photo opens the confirm dialog with Cancel focused: 'Remove the main photo?' / 'The drawn jersey shows instead.' (back view and fabric detail: 'The empty box shows instead.'), the confirm says Remove Photo then Removing. Success shows 'Photo removed' / 'The drawing shows instead.', brings the placeholder back and puts focus on Choose Photo. A failure stays in the question with the shared error line and keeps the photo. A 404 (already gone) counts as removed.
- **One action at a time.** The pressed button is pending (`aria-busy`, `aria-disabled`, focus kept); the slot's other buttons are `aria-disabled`; the card holds the other two slots until the save ends; `locked` and `onBusyChange` are the two props that do it.
- **Photos card.** `ProductLinePhotosCard` draws the three slots (one column at 767px and below) over `useUploadLinePhoto` and `useRemoveLinePhoto`. An empty Main photo draws the line's drawing (`JerseyArt` in the line's art and number); Back view and Fabric detail are `MediaPlaceholder` boxes. `ProductLinePage` shows the card for a line that exists (the save-first note stays for a new line) and keeps the photos in the saved line it holds, so a photo never touches the form's dirty state or the version a save sends.
- **Hooks and service.** `productLinesService.uploadPhoto(id, slot, file, fileName, idempotencyKey)` (multipart, 120 s limit) and `removePhoto(id, slot)`. Each successful write patches the cached line, clears the public data in this browser and marks the line list for a new read (the Products tab thumbnail).
- **Tests.** Fixtures `linePhoto`, `lineWithPhotos`, `linePhotosBackend`; unit tests at service, hook, slot, card and page level (axe with and without photos and while uploading); three `@site-content-photos` journeys in all five projects.

## Task Commits

| Task | Phase | Commit | Message |
|---|---|---|---|
| 1 (tracer) | RED | `d7998eb5` | test(11-22): add failing tests for a Manager's main photo on a product line and the line photo calls |
| 1 (tracer) | GREEN | `e94558af` | feat(11-22): a Manager picks a main photo for a product line, it uploads, and the Products page shows it |
| 2 | RED | `cdc4fe75` | test(11-22): add failing tests for replacing and removing line photos, the busy rules and the editor guards |
| 2 | GREEN | `3d3c1447` | feat(11-22): replace and remove line photos with the slot's own question, one action at a time |

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) is not required, and Vitest prints none of the formats it reads for a hand run. The RED evidence is the real console output, read by hand. A RED commit precedes each GREEN commit.

- **Task 1 RED** (`d7998eb5`): `PhotoSlot.test.tsx` and `ProductLinePhotosCard.test.tsx` could not load (the two modules did not exist); 8 of 59 tests failed on assertions in files that existed (4 in `productLinesService.test` for `uploadPhoto` and `removePhoto`, 3 in `useProductLineQueries.test` for `useUploadLinePhoto`, 1 in `ProductLinePage.test` for the Photos card of an existing line). The e2e journey was written in the RED commit and not run at RED (no UI existed). Semantic assessment: the target tests ran and failed because the modules, the service methods and the card did not exist; for the two new modules the RED is a missing import, not an assertion.
- **Tracer gate:** Task 1's `<verify>` is automated only. It was re-run end to end before expansion: unit set `Test Files 5 passed (5)`, `Tests 79 passed (79)`; e2e `5 passed (1.3m)` (see Issues Encountered for the budget line the e2e build needed).
- **Task 1 GREEN** (`e94558af`): the five plan test files 79 of 79. Corrections to my own RED tests were made in the GREEN commit: the Take Photo class check moved to its wrapper, two lint fixes, the refused-upload hook test uses a service spy, and the existing page test that read the Fabric textarea by label now reads it by role (the empty Fabric detail box's name also starts with "Fabric").
- **Task 2 RED** (`cdc4fe75`): 18 of 88 failed on assertions or on the missing `useRemoveLinePhoto` (3 hook tests; 6 card tests; 8 PhotoSlot tests for Remove, locked and the busy callback; 1 page test, the axe check while a photo uploads, which held the upload on the wire; it uses a service spy at GREEN, see the weak spot below). Several page and card tests of Task 2 passed at RED because the Task 1 slot already drew the card and the new-line note (see Deviations).
- **Task 2 GREEN** (`3d3c1447`): 88 of 88 in the four files; two more runs of the plan's unit set: `Test Files 6 passed (6)`, `Tests 104 passed (104)` both times. No REFACTOR commit was needed.
- **Weak spot, stated plainly:** the upload tests go through jsdom's `FormData`, which Node's `fetch` cannot send as a body (`UND_ERR_REQ_CONTENT_LENGTH_MISMATCH`). A mocked answer that comes at once hides it, one that waits shows it as a network error. So the tests that wait use a service spy, and the few that read the request headers (the Idempotency-Key) rely on the answer coming at once. They passed in every run (more than five), but they are the ones that would show a flake first.

## Verification evidence (real output)

- **Plan unit command (Task 1 and Task 2 sets plus `no-long-dash.node.test.ts`):** `Test Files 6 passed (6)`, `Tests 104 passed (104)` (run twice).
- **Admin module and the two layout node tests** (`src/modules/admin src/test/no-long-dash.node.test.ts src/test/source-layout.node.test.ts`, run before Task 2): `Test Files 196 passed (196)`, `Tests 4821 passed (4821)`.
- **Whole web suite on the final tree:** `npx vitest run` in web/: `Test Files 1 failed | 362 passed (363)`, `Tests 1 failed | 10006 passed (10007)`. The one failure is `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions" (the known fresh worktree install failure: license-checker finds no packages; no package file was touched).
- **Types and lint on the final tree:** `npm --prefix web run typecheck` exit 0 (three `tsc` lines, no output); `npm --prefix web run lint` exit 0 (`eslint . --max-warnings 0`, no output).
- **e2e `@site-content-photos`:** Task 1 (one journey): `5 passed (1.3m)`. Final tree (three journeys, five projects): `15 passed (1.4m)`; chromium, firefox, webkit, pixel and iphone all passed each journey on the first run, no retries. Both runs used the temporary budget setting described below.
- **Bundle** (`npm --prefix web run build:budget`, gzip, limit 150 KB public and 250 KB admin), final tree: home 142.40, products 146.35, gallery 147.76, **contact 150.02 (over by 0.02)**, notFound 142.96, admin 221.41, CSS 18.17. Before this plan on the same machine (the base tree): home 142.35, products 146.27, gallery 147.71, contact 149.96, notFound 142.90, admin 221.34, CSS 18.17.
- **Acceptance greps:** `prepareImage` in PhotoSlot.tsx 3 (the import, the call and a comment); `JerseyArt` in ProductLinePhotosCard.tsx 2 (the import and the use); `Save the product line first, then add photos.` in siteContentCopy.ts 1.
- gitleaks (`protect --staged`, and the repository hook) ran before each commit: `no leaks found`. The values in the diff are made up (`8c1f4a20-...` ids, `Polo Shirts`, `polo-front.jpg`, canvas-drawn images, `/api/testing/images/...` addresses).

## Decisions Made

- **Other slots wait while one saves.** See key-decisions and OI-3.
- **Fieldset and legend** for the slot's name (see key-decisions).
- **The slot's props are small and optional where a user of it may not need them:** `noun`, `locked`, `onBusyChange`, and the remove trio (`onRemove`, `removeConfirm`, `removedToast`) for a slot that cannot be removed.
- **Wording that is mine (SPEC-GAP):** 'Remove the back view?' / 'Remove the fabric detail?' with 'The empty box shows instead.', the confirm's pending word 'Removing', the empty Main photo's name 'Drawn jersey (no photo yet)', the preview names 'Main photo of Polo Shirts' (label, then 'of', then the line's title). The UI-SPEC gives the main photo question, 'Remove Photo', 'Uploading', 'Saved' and both toasts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, NOT resolved] The public Contact page is 0.02 KB over its budget with this plan**
- **Found during:** Task 1 tracer gate (`npm --prefix web run e2e` stops at the build, as in plan 11-20)
- **Issue:** the base tree builds Contact at 149.96 KB (limit 150.00). With the Photos card it is 150.02 KB (150.03 before Task 2). The other four public routes grow by about the same 0.05 KB. Cause found by comparing the two builds: only the entry chunk (`index-*.js`, the preload table of chunk names) changes, by 67 bytes gzipped. The Site Content chunk now needs modules of the order photo screens (`orderPhotosCopy`, the pick rules, `useImageRulesQuery`, `media.recipe`) and `JerseyArt` (shared with the public Products chunk), so Rolldown splits the old `orderPhotosCopy` chunk into three (`orderPhotosCopy`, `orderPageCopy`, `usePhotoUploadQueue`), adds a `JerseyArt` chunk and drops two small ones: one more chunk name in the entry's table. Tried and not enough: writing the media recipe tokens locally (no change in the names, +0.02 KB), reading the photo rules through a local query (no change), and no `JerseyArt` (-0.01 KB). Cutting the shared modules would mean copying the pick rules, their zod check and the order photo copy into Site Content, which I did not do.
- **What I did:** left the budget alone. The two e2e runs used a temporary, uncommitted change of `publicJs` in `web/scripts/budget.ts` (150_000 to 151_000), put back with `git checkout` before every commit (the committed `budget.ts` is unchanged). Without it the plan's own e2e command stops at the build. I did not decide how to free the bytes. Parked as OI-1.
- **Files modified:** none (the experiment files were put back)
- **Verification:** `build:budget` table above; the two `index` chunks compared name by name (`orderPageCopy`, `usePhotoUploadQueue` and `JerseyArt` appear, `orderFormCopy` and `orderPage.recipe` go).

**2. [Rule 1 - Plan wording] "the seed removes it at the end" is not so**
- **Found during:** Task 1 (reading `TestingSiteContentSeeder.ResetProductLinesAsync`)
- **Issue:** the demo reset removes the photos of lines whose short name starts with `E2E-` only; a photo on Polo would stay for every later test and run.
- **Fix:** the journeys take every photo off Polo through the API (`DELETE .../photos/{slot}`, 204 or 404) in their `finally`, before the demo reset, and take the photo host lock inside the site content lock. No server change (this plan lists no server file). Parked as OI-4.
- **Files modified:** `web/e2e/site-content-products.spec.ts`
- **Committed in:** `d7998eb5`, `cdc4fe75`

**3. [Rule 1 - Existing tests that pinned the old behavior]**
- **Found during:** Task 1
- **Issue:** `ProductLinePage.test.tsx` had a test named "shows no Photos card and no note on a line that exists (the photos arrive with plan 11-22)", and `has the Names, Words ... cards` read the Fabric textarea with `getByLabelText(/^Fabric/)`, which now also matches the empty Fabric detail box's name.
- **Fix:** the first now asserts the Photos card with its three slots and no save-first note; the second reads the five customize fields by role (`textbox` with a name that starts with the label).
- **Files modified:** `web/src/modules/admin/pages/ProductLinePage.test.tsx`
- **Committed in:** `d7998eb5`, `e94558af`

**4. [Rule 1 - Bug avoided] A role=group with aria-labelledby collided with a field label**
- **Found during:** Task 1 (the first GREEN run)
- **Issue:** the slot named "Fabric detail" as a labelled group is found by `getByLabelText(/^Fabric/)` and Playwright's `getByLabel(/^Fabric/)`, both of which the editor's tests use for the Fabric textarea.
- **Fix:** the slot is a fieldset with a legend, which has the group role and the same name without being a label.
- **Files modified:** `PhotoSlot.tsx`, `photoSlot.recipe.ts`
- **Committed in:** `e94558af`

### Plan wording and process notes

**5. [Process] Files outside the plan's list:** `photoSlot.recipe.ts` (the slot's looks), `siteContent.recipe.ts` (`lineSlotsClasses`, the row of three), `docs/web/e2e.md` (the `@site-content-photos` row), and the `uploadPhoto` / `removePhoto` signatures carry a file name and a key (the plan wrote `uploadPhoto(lineId, slot, blob)`; a multipart form needs a name and the server a key).
**6. [Process] RED tests that passed at RED.** Several Task 2 tests (the page's new-line note and the card's shape) already held after Task 1, because the card and the placeholders were part of the tracer. I did not hold back Task 1 code to make them fail.
**7. [Process] RED tests corrected in GREEN.** See TDD Gate Compliance.
**8. [Process] Tools.** The Bash tool in this worktree refuses commands that mix `git` with redirects or a heredoc, so edits ran through the Edit and Write tools and short `node -e` scripts, and git calls ran as plain separate commands. The plan-head ledger (`gsd-plan-head-before-11-22`) was written before the first commit; `commits: 4` is `git rev-list --count 67b3e06e..HEAD` before this SUMMARY commit.

---

**Total deviations:** 4 (1 Rule 3 not resolved, 3 Rule 1), 4 notes. **Impact:** no scope creep; no package, schema, migration, trigger or server change. The one open problem is the public Contact budget (OI-1).

## Issues Encountered

- The plan's e2e command fails at its build step on this tree because of the Contact budget (Deviation 1). The e2e passes were run with the limit raised by 1 KB in an uncommitted edit that was reverted each time.
- jsdom form bodies and Node's `fetch` (see the weak spot above).
- The first Task 1 e2e attempt failed at the build for the same budget reason; with the temporary limit the Task 1 run and the final run passed.
- Not run here: Lighthouse, parity (no parity scenario draws these screens), the Windows deploy job, the .NET suites (no server code changed).

## Owner items (open, nothing else blocks the plan; recommendation first)

**OI-1. The public Contact page is 0.02 KB over its 150 KB budget (150.02 of 150.00; it was 149.96 before this plan).** The extra bytes are one more chunk name in the entry's preload table; any admin plan that shares code with another lazy chunk can do this, and the sibling plans of this wave will too. Options: **(a) free about 1 KB in the public graph before the merge (recommended; plan 11-20's OI-4 asked for the same), for example by moving the open status or hours words behind the one lazy file of the Contact page, then run `build:budget` after merging all plans of the wave**; (b) the owner approves a higher public limit; (c) copy the pick rules and the order photo words into Site Content so it shares nothing with the order screens (I would not: it forks rules the server mirrors). Until one is done the merge gate (`build:budget`) fails.

**OI-2. New words.** 'Remove the back view?' / 'Remove the fabric detail?' with 'The empty box shows instead.', the confirm's 'Removing', 'Drawn jersey (no photo yet)' (the empty Main photo's name for a screen reader) and 'Main photo of Polo Shirts' (the preview names). Options: **(a) keep (recommended)**; (b) your own words (all in `siteContentCopy.ts`).

**OI-3. The other two slots wait while one saves.** The UI-SPEC says the slot's other actions are aria-disabled; the card also holds the other slots, so only one file is in flight (they share the server's site content lock, and a second write could answer 409). Options: **(a) keep (recommended)**; (b) let each slot save on its own and show a 409 as a refused upload.

**OI-4. The demo reset keeps photos on the six demo lines.** `TestingSiteContentSeeder` removes the photos of `E2E-` lines only, so a test that adds a photo must clean up (the journeys do, through the API). Options: **(a) leave it and keep the cleanup in the specs (recommended for now)**; (b) one more line in the seeder that removes the photos of the six demo lines in the reset (a small server change for plan 11-26 or a quick fix).

**OI-5. A 404 on Remove Photo counts as removed.** If someone else removed the photo first, the slot empties and says Photo removed. If the line itself was deleted meanwhile, the next Save Changes shows the not-found page. Options: **(a) keep (recommended)**; (b) say 'Already removed' in its own toast.

## Known Stubs

None.

## Threat Flags

None new. T-11-55 (EXIF and location): only the redrawn file from `prepareImage` is ever passed to the upload (tested), and the server strips metadata again (11-19). T-11-56 (repeated uploads): one Idempotency-Key per file through `useSubmission` (a re-picked identical file keeps its key), the pressed control is pending, and one file is in flight per card. T-11-SC: no package was added or bumped; `web/package.json` and the lock file are unchanged (`npm ci --ignore-scripts` ran only from the lockfile).

## User Setup Required

None - no external service configuration required. (The owner step from plan 11-19, running the Cloudinary setup command so the 21 new sizes exist, still stands before the first live photo.)

## Next Phase Readiness

- **11-34 (share picture):** `PhotoSlot` with `ratio="1.91/1"` and `noun="Picture"`; give it its own `onUpload`, `onRemove`, `removeConfirm` ('Remove the link preview picture?' / 'Shared links show no picture until you add one.' / 'Remove Picture') and toasts. It takes the site content lock on the server like the line photos.
- **11-32 (gallery window):** the same `PhotoSlot` or its pick logic; `onUpload` receives the redrawn `File`.
- **11-26:** `ProductLinesTab` already draws `mainPhotoThumb`; after a photo save the list is marked for a new read.
- **11-37:** no new audit code here (11-19's `product-line.photo-changed` is the one).
- **Merge hot spots:** `siteContentCopy.ts`, `siteContentFixtures.ts`, `siteContent.recipe.ts`, `useProductLineQueries.ts`, `productLinesService.ts`, `ProductLinePage.tsx`, `docs/web/e2e.md`, `site-content-products.spec.ts`.
- **Bundle:** see OI-1. The Photos card adds about 7.8 KB raw to the Site Content chunk (SiteContentPage 90.04 KB to 97.86 KB) and nothing to the public pages except the one chunk name.
- STATE.md and ROADMAP.md were not touched (orchestrator owns them). CONT-02 and GAL-03 are shared with other plans, so the orchestrator should mark them only after the last plan that declares each.

## Self-Check: PASSED

- All 5 created files exist on disk (checked with `ls`): PhotoSlot, ProductLinePhotosCard, their two test files and photoSlot.recipe.ts.
- Commits `d7998eb5`, `e94558af`, `cdc4fe75` and `3d3c1447` are ancestors of HEAD; each RED commit precedes its GREEN commit.
- The measured commit count is 4 (`git rev-list --count 67b3e06e..HEAD` before this SUMMARY commit), read against the base id kept in the per-plan ledger file; `plan_head_after` is `3d3c1447`.
- `git status` showed nothing else modified or untracked before this SUMMARY (the Playwright `test-results` and `.locks` folders are git-ignored); `web/scripts/budget.ts` is unchanged from the base.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*

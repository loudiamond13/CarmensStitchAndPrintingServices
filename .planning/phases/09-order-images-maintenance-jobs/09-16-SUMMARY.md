---
phase: 09-order-images-maintenance-jobs
plan: 16
subsystem: web
tags: [order-photos, upload-queue, order-page, idempotency, leave-guard, e2e]
requires:
  - phase: 09-order-images-maintenance-jobs
    provides: "09-03 prepareImage, 09-07 images in the order answer, 09-08 ImageUploader and PhotoTile, 09-09 image rules and the Testing image routes"
provides:
  - orderPhotosService (rules and a multipart upload with one Idempotency-Key per file, 120 s timeout)
  - useImageRulesQuery (['image-rules'], one hour stale time)
  - photoUploadQueue module store and usePhotoUploadQueue / usePendingPhotoCount (memory only, one upload at a time)
  - ORDER_PHOTOS_COPY (every order photo string of the UI-SPEC copywriting contract)
  - orderPhotosSchemas (toImageRules, cleanFileName, pickFailureMessage, buildPickSchema, pickIssue, descriptionSchema)
  - OrderPhotosCard (live and read-only Images card of the order page) and the "Leave this page?" guard on O1
  - e2e photo-host lock (web/e2e/photo-host-lock.ts) and the @order-photos-upload journeys
affects: [09-19, 09-21, 09-23, 09-27, 09-29]

created: "2026-11-03T19:00:00-06:00"
updated: "2026-11-03T19:00:00-06:00"

actuals:
  tokens: 25800
  tasks: 3
  commits: 8

plan_head_before: f27ee1493070e68ed51238211092f8ae5f4e9fd9
plan_head_after: f8a729cfbd870f43b53620f925628a9ca687c14b
commits: 8

tech-stack:
  added: []
  patterns:
    - "Upload queue as a module store keyed by order id, read with useSyncExternalStore; the screen shows it with show(orderId), and the queue is dropped one tick after the last screen leaves (StrictMode safe)"
    - "The server's message is problem.detail (its title is only the generic words of the status); a 400 falls back to the first field error"
    - "A cross-project lock directory (web/.locks/photo-host.lock) around e2e uploads, because the fail-next switch is shared by the whole Testing host"

key-files:
  created:
    - web/src/modules/admin/services/orderPhotosService.ts
    - web/src/modules/admin/hooks/useImageRulesQuery.ts
    - web/src/modules/admin/hooks/usePhotoUploadQueue.ts
    - web/src/modules/admin/orderPhotosCopy.ts
    - web/src/modules/admin/orderPhotosSchemas.ts
    - web/src/modules/admin/components/OrderPhotosCard.tsx
    - web/src/modules/admin/components/orderPhotos.recipe.ts
    - web/e2e/order-photos-upload.spec.ts
    - web/e2e/photo-host-lock.ts
  modified:
    - web/src/modules/admin/pages/OrderPage.tsx
    - web/src/modules/admin/pages/OrderPage.test.tsx
    - web/src/test/orderFixtures.ts
    - web/e2e/order-page.spec.ts
    - web/e2e/order-items.spec.ts
    - web/e2e/order-payments.spec.ts
    - docs/web/e2e.md

key-decisions:
  - "Saved-photo controls (move, make cover, edit, delete, open) stay disabled on O1 until plan 09-23 wires them: the card passes busy to the uploader and no-op handlers. Picking, Try Again and Remove work."
  - "The Images card shows 5 photos and 10 MB in its hint until the rules arrive; the pick itself always waits for the real rules (queryClient.query)."
  - "Failure reasons use the server's problem.detail; network and timeout, 429 and a missing detail use the UI-SPEC lines. Retryable: network, timeout, 5xx except images.not-configured, 409, 429."
  - "The pixel refusal message uses the server wording ('Photos can be at most 25 megapixels.'), not the UI-SPEC line ('pixels wide or tall'), because OR-3 says the server's own words."

requirements-completed: []
requirements-advanced: [ORD-04, IMG-01, IMG-02, IMG-05]

coverage:
  - id: D1
    description: "On an active order the Images card replaces the coming-soon card; a picked photo becomes a waiting tile, uploads under its own Idempotency-Key and turns into a saved photo whose thumb the server delivers"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#OrderPhotosCard (tracer)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#the Images card (ORD-04, 08 D-27)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @order-photos-upload (15 passed, 5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Several photos upload one at a time in pick order with 'Uploading photo i of n', spoken updates and the 'Photos added' toast; more picks during a batch join the same queue"
    requirement: "IMG-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/usePhotoUploadQueue.test.tsx#a batch of photos (IMG-05, D-31)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#several photos (IMG-05, D-31)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every server rule is checked in the browser first with the server's wording: type, size, pixels, readability and the 5 photo limit counting saved, waiting, uploading and failed files; an svg renamed .jpg sends no request"
    requirement: "IMG-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/orderPhotosSchemas.test.ts"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#refused files never leave the browser (OR-3, IMG-02, UIC-12, UIC-28)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#the limit of 5 (D-08, UIC-29)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A failed upload stays as a tile with its reason; Try Again (retryable failures only) resends the same key and the same bytes, once; the banner leaves when no failed tile remains; a locked order fails waiting files with the server text and turns the card read-only"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/usePhotoUploadQueue.test.tsx#Try Again (SEC-06, WEB-09)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#failed uploads (D-10, UIC-13 to UIC-15, UIC-27)"
        status: pass
      - kind: e2e
        ref: "@order-photos-upload a failed upload waits with a banner, and Try Again uploads it and clears the banner (5 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Leaving O1 with waiting, uploading or failed photos opens 'Leave this page?' with Stay on Page focused; reload and close use the browser prompt only while photos are pending; nothing is stored in browser storage"
    requirement: "IMG-05"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#leaving with photos that have not uploaded (D-29, UIC-23)"
        status: pass
      - kind: other
        ref: "grep -v '^\\s*//' usePhotoUploadQueue.ts | grep -c 'localStorage\\|sessionStorage' prints 0"
        status: pass
    human_judgment: true
  - id: D6
    description: "How the card, the banner, the status line and the tiles look and read at 320 to 1440 px in both themes, and on a real phone camera"
    requirement: "IMG-05"
    verification:
      - kind: other
        ref: "owner review: screenshots in plan 09-30 (UI-SPEC Visual Review) and the real-phone camera check"
        status: unknown
    human_judgment: true

duration: about 1h 45min
completed: 2026-11-03
status: complete
---

# Phase 9 Plan 16: Add photos on the order page Summary

*Created: 2026-11-03T19:00:00-06:00 · Updated: 2026-11-03T19:00:00-06:00*

**Staff can pick photos (camera, gallery or drop) on an order's page; each is prepared and checked in the browser, queued in memory and uploaded one at a time under its own key, with count-based progress, Try Again and Remove for failures, a read-only fallback when the order locks, and a leave guard, with no package added and nothing under `core/api/http` changed.**

## Accomplishments

- `orderPhotosService.upload` posts `file` and `description` as a multipart form to `/orders/{id}/images` with the caller's `Idempotency-Key` and a 120 s timeout. `rules` reads `/orders/image-rules`.
- `photoUploadQueue` keeps waiting, uploading and failed files per order id in module memory, runs one request at a time, keeps each file's key and bytes for Try Again, and counts the batch ("Uploading photo 2 of 4"). It is dropped when the card leaves the page (the request in flight is aborted).
- `OrderPhotosCard` maps saved photos (sorted by position, default text "Order {number} photo {n}") and queue items to `ImageUploader` tiles, runs the pick (rules, `prepareImage`, the zod pick check, the 5 photo room) and shows the status line, the polite announcements, the pick-error box and the partial-failure banner.
- `OrderPage` uses the card and holds in-app leaving with `useUnsavedChangesGuard` and a `ConfirmDialog` ("Leave this page?", Stay on Page focused first).
- `ORDER_PHOTOS_COPY` carries every order photo string of the UI-SPEC contract, including the description window and delete dialog strings that plans 09-23 and later read.

## Task Commits

1. **Task 1 (tracer): pick a photo and see it saved with its thumb** - `377080cb` (test, RED), `20c29310` (feat, GREEN)
2. **Task 2: several photos with progress; refused files stay in the browser** - `ef813d66` (test, RED), `f97bbfb0` (feat, GREEN)
3. **Task 3: failures, locked orders and the leave guard** - `be1be912` (test, RED), `f796355a` (feat, GREEN)
4. **Follow-ups found by the full e2e runs** - `0faf7f91` (e2e lock for the shared fail-next switch), `f8a729cf` (sub-pixel size compare in two older e2e tests)

## TDD Gate Compliance

Each task has a `test(09-16)` commit before its `feat(09-16)` commit. I did not run `gsd_run check tdd-red-evidence`.

- **Task 1 RED (`377080cb`):** empty stand-ins for the service, queue and card were committed with the tests so each failed on assertions. Vitest: 7 failed, 72 passed (for example `Unable to find role="heading" and name "Images"`, `expected [] to have a length of 1 but got +0`, the coming-soon text still on the page). Task 1 GREEN: `Test Files 4 passed (4)`, `Tests 79 passed (79)`, and `@order-photos-upload` passed in chromium.
- **Task 2 RED (`ef813d66`):** 9 failed in the queue and card tests (no announcements, no toast, no pick check, no limit), plus 17 of 21 failed in the schema tests against a stand-in. GREEN: `Tests 112 passed (112)` for the five files, e2e 2 passed.
- **Task 3 RED (`be1be912`):** 16 failed (no retry, no banner, no locked handling, no leave guard). Some failure-table rows already passed at RED because the Task 2 queue marked every failure as not retryable with the server message; they stay as characterization tests. GREEN: `Tests 140 passed (140)`.
- The tracer gate (auto mode off, `human_verify_mode` end-of-phase, automated-only verify) was met by re-running the verify commands end to end: unit tests and `@order-photos-upload` passed before Task 2 started.

## Check results

- `npm --prefix web run test -- --run src/modules/admin/services/orderPhotosService.test.ts src/modules/admin/hooks/usePhotoUploadQueue.test.tsx src/modules/admin/orderPhotosSchemas.test.ts src/modules/admin/components/OrderPhotosCard.test.tsx src/modules/admin/pages/OrderPage.test.tsx`: `Test Files 5 passed (5)`, `Tests 140 passed (140)`.
- `npm --prefix web run test -- --run src/modules/admin` (while other executors were busy): `Test Files 3 failed | 134 passed (137)`, `Tests 3 failed | 3193 passed (3196)`. The three were `routes.test.tsx` (dev routes /dev/public), `OrderItemModal.test.tsx` (shows "Saving") and `OrderFormPage.test.tsx` (cannot be left through the dialog while a save is pending). Re-run alone: `Test Files 3 passed (3)`, `Tests 130 passed (130)`. Recorded as load flakes; none touches code from this plan.
- `npm --prefix web run typecheck`: exit 0, no output after the three `tsc` lines.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output.
- `npx prettier --check src e2e`: `All matched files use Prettier code style!`
- `node scripts/class-gate.mjs`: no findings.
- Preflight (PowerShell is not used from the worktree): `netstat -ano | grep -E ':(5180|5115|7028|5199) '` showed nothing listening before every e2e run (only TIME_WAIT). I started and stopped only my own runs through `npm --prefix web run e2e`; no process is left running.
- `npm --prefix web run e2e -- --grep @order-photos-upload` (all five projects, after the lock): `15 passed (57.3s)`. Before the lock the same command gave `9 passed`, `6 failed`, because one project's armed fail-next failure was used up by another project's upload (see Deviations).
- `npm --prefix web run e2e -- --grep "@orders-(create|delete|deleted-view|discounts|edit|expenses|items|page|payments|refunds|status|two-staff)" --project firefox --project chromium`: `68 passed (3.0m)` (regression check of every order page spec; the first run of `@orders-page|@orders-items|@orders-create` had `39 passed`, `1 failed` for the Firefox size compare below).
- Acceptance greps: `git log --format=%s -- web/src/core/api/http` lists no `test(09-16)` or `feat(09-16)` commit (count 0); `images.soon` in `OrderPage.tsx` count 0; `Leave this page?` in `orderPhotosCopy.ts` count 1; `Uploading photo` count 1; non-comment `localStorage|sessionStorage` in `usePhotoUploadQueue.ts` count 0; `OrderPhotosCard.test.tsx` has svg tests (the one asserting zero upload requests is named "refuses an svg renamed .jpg ... sends no upload request (UIC-47)"); `usePhotoUploadQueue.test.tsx` has the test "sends the same key and the same bytes again, and the photo is stored once"; the e2e spec calls `/api/testing/images/fail-next` and asserts the banner leaves after Try Again; `git diff --stat` on `web/package.json` and `web/package-lock.json` is empty.
- `gitleaks protect --staged --no-banner` before each of the 8 commits: `no leaks found`. No em dash or en dash in the changed web files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Upload tests cannot go through MSW with a body (jsdom FormData and Node fetch)**
- **Found during:** Task 1 (the card test's upload failed with `RequestContentLengthMismatchError`)
- **Issue:** In Vitest the global `FormData`, `Blob` and `File` are jsdom's; Node's `fetch` cannot send a jsdom `FormData` once the handler holds or reads the body. This is a test environment limit, not a production bug.
- **Fix:** The card and queue tests spy on `orderPhotosService.upload` (or pass held deps to `photoUploadQueue.enqueue`). The service test uses the fake fetch and checks the form parts and the 120 s timeout. The "same key" test compares the two forms the deps build from the queue's stored key and bytes. A no-hit MSW handler still proves an svg sends no request.
- **Files modified:** the test files of this plan
- **Commits:** `20c29310`, `f97bbfb0`, `f796355a`

**2. [Rule 1 - Bug] The server's message is in `problem.detail`, not the title**
- **Found during:** Task 3 e2e (the tile said "The service is busy. Please try again shortly." instead of the photo store message)
- **Issue:** `HttpError.message` is the ProblemDetails title, which is only the generic words of the status. The specific text ("The photo couldn't be saved. Try again.", "{name} is over 10 MB...") is in `detail` (and in the field errors for a 400). My first version showed the title.
- **Fix:** `serverLine(error)` reads `detail`, then the first field error, then a plain line; the tests build ProblemDetails with a generic title and the message in `detail`.
- **Files modified:** `usePhotoUploadQueue.ts`, `usePhotoUploadQueue.test.tsx`, `OrderPhotosCard.test.tsx`
- **Commit:** `f796355a`

**3. [Rule 3 - Blocking] The fail-next switch is shared by the whole Testing host**
- **Found during:** the all-projects `@order-photos-upload` run (6 failed)
- **Issue:** The five Playwright projects run side by side against one host. A failure armed in one project was used up by another project's upload, so the banner test failed and the plain upload tests got a 503.
- **Fix:** `web/e2e/photo-host-lock.ts` (`withPhotoHost`): a lock directory under `web/.locks/` (git-ignored) around the upload part of each test, taken over after 3 minutes if a run died. The failing test also clears the switch with `{ count: 0 }` in a `finally`. `docs/web/e2e.md` now says so. Later plans that use fail-next should wrap their uploads in `withPhotoHost`.
- **Files modified:** `web/e2e/order-photos-upload.spec.ts`, `web/e2e/photo-host-lock.ts` (new), `docs/web/e2e.md`
- **Commit:** `0faf7f91`

**4. [Rule 3 - Blocking] Two older e2e tests broke on a sub-pixel height**
- **Found during:** the regression run of the order specs
- **Issue:** The Images card made the order page taller. In Firefox the phone row action button then measured 35.99993896484375 instead of 36 (float precision far down the page), so `order-items.spec.ts` failed; `order-payments.spec.ts` has the same check.
- **Fix:** both compare the rounded width and height.
- **Files modified:** `web/e2e/order-items.spec.ts`, `web/e2e/order-payments.spec.ts`
- **Commit:** `f8a729cf`

**5. [Rule 3 - Blocking] Files outside the plan list that had to change**
- `web/src/test/orderFixtures.ts`: `IMAGE_RULES` and a `GET */orders/image-rules` handler placed before the `:id` route (which would take "image-rules" for an order id). Without it every OrderPage test would hit an unhandled request.
- `web/e2e/order-page.spec.ts`: it asserted "Image uploads are coming soon." on the order page.
- `web/src/modules/admin/components/orderPhotos.recipe.ts` (new): the looks of the card body, status line and banner (class gate wants complete tokens in a recipe).
- `web/src/modules/admin/hooks/useImageRulesQuery.ts` exports `imageRulesQuery` so the pick can read the rules with `queryClient.query` (`fetchQuery` is deprecated and lint refuses it).

### Plan differences (gap fills, parked for the owner)

- **Saved-photo controls are disabled for now.** Move, Make Cover, Edit description, Delete and the thumb button (viewer) arrive in plan 09-23. The card passes `busy` and no-op handlers, so they show as disabled (`aria-disabled`) and do nothing. See Known Stubs.
- **Leave dialog, singular line:** the spec words only "1 photo hasn't uploaded yet." I wrote "1 photo hasn't uploaded yet. If you leave now, it's lost."
- **Two new lines the spec does not have:** "Couldn't check this photo. Check your connection, then try again." (the rules could not be read, so the pick cannot be checked) and "The server didn't accept this photo." (a refusal with no message).
- **Batch line in the singular:** "1 of 1 photo didn't upload." (the spec only shows "1 of 3 photos...").
- **Pixel message:** the server's wording ("Photos can be at most 25 megapixels.") is used, as OR-3 says, not the UI-SPEC "pixels wide or tall".
- **Hint before the rules load:** it shows 5 photos and 10 MB until the rules arrive.
- **Browser coverage of `e2e` is chromium, firefox, webkit and the two phone profiles** for the three journeys; the real camera (`capture`) and HEIC on a real phone are not covered by Playwright.

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking), plus the file additions and the gap fills above. **Impact:** none on the plan's goal.

## Known Stubs

- `web/src/modules/admin/components/OrderPhotosCard.tsx`: the saved photo's move, make cover, edit description, delete and open handlers are no-ops and `busy` is always true (plan 09-23 wires them and the viewer). The tile buttons render as disabled, so nothing pretends to work. Waiting, uploading and failed files are fully wired.

## Threat Flags

None new. T-09-34: one key per file, kept for Try Again with the same bytes, and a second press is ignored while the tile is waiting or uploading (tests: "same key", "pressed twice"). T-09-35: no storage API is used (grep count 0); the queue and the data: previews are module memory and the queue is dropped one tick after the card leaves the page. T-09-37: one request in flight per order, the room is checked before any request, and the server limits (09-14) stay. T-09-SC: no package added or bumped.

## Owner backlog items (for the orchestrator to copy into STATE.md)

- [ ] **Wording check for three lines I had to write** (09-16, Images card): "1 photo hasn't uploaded yet. If you leave now, it's lost." (leave dialog, singular); "Couldn't check this photo. Check your connection, then try again." (shown when the photo rules cannot be read); "The server didn't accept this photo." (a refusal with no message). My recommendation: keep them. They live in `web/src/modules/admin/orderPhotosCopy.ts` (`leave.message`, `reasons.rulesUnavailable`, `reasons.refused`).
- [ ] **Pixel-limit wording:** the page now says "Photos can be at most 25 megapixels." (the server's own sentence) where the UI-SPEC table says "...at most {max} pixels wide or tall." My recommendation: keep the server sentence so browser and server never disagree; if you prefer the UI-SPEC sentence, the server message and the browser message both change in `ImageErrors.cs` and `orderPhotosCopy.ts`.
- [ ] **Disabled controls on saved photos until 09-23:** until that plan ships, an order page shows Move, Make Cover, Edit description and Delete as greyed on saved photos. Nothing to decide; just do not ship Phase 9 between 09-16 and 09-23.
- [ ] **Manual check on a real phone (deferred to the end of the phase):** "Take Photo" opens the camera and a 12 MP photo uploads and shows its thumb on an order; pick 5 photos at once from the gallery. Playwright cannot open the real camera.

## Notes for later plans

- Use `photoUploadQueue.enqueue(orderId, items, deps)` for the F1 hand-off (plan 09-21): the queue keeps the items even when no card shows the order yet, and the O1 card shows them as "Waiting to upload" when it mounts. The `descriptionSchema(rules)` and the description window strings are ready in `orderPhotosSchemas.ts` and `orderPhotosCopy.ts`.
- The server's own message is `error.problem?.detail`; the title is generic. Read it the way `serverLine` in `usePhotoUploadQueue.ts` does.
- Any e2e that uploads photos should run the upload part inside `withPhotoHost` (`web/e2e/photo-host-lock.ts`), because of the shared fail-next switch.
- Until plan 09-14 raises the body cap, a photo over 1 MiB answers 413 on the host; the e2e images are small gradients, and the browser shrinks real photos to a 2000 px long side first.

## Deferred Issues

None. The three `src/modules/admin` unit failures under load passed alone (see Check results).

## Self-Check: PASSED

- FOUND: `web/src/modules/admin/services/orderPhotosService.ts`, `hooks/useImageRulesQuery.ts`, `hooks/usePhotoUploadQueue.ts`, `orderPhotosCopy.ts`, `orderPhotosSchemas.ts`, `components/OrderPhotosCard.tsx`, `components/orderPhotos.recipe.ts`, `web/e2e/order-photos-upload.spec.ts`, `web/e2e/photo-host-lock.ts`
- FOUND commits: `377080cb`, `20c29310`, `ef813d66`, `f97bbfb0`, `be1be912`, `f796355a`, `0faf7f91`, `f8a729cf` (all ancestors of HEAD)

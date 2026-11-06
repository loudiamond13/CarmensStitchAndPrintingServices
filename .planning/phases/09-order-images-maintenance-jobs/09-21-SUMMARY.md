---
phase: 09-order-images-maintenance-jobs
plan: 21
subsystem: web
tags: [order-photos, new-order-form, draft-photos, description-window, upload-queue-handoff, e2e]
requires:
  - phase: 09-order-images-maintenance-jobs
    provides: "09-16 photoUploadQueue, ORDER_PHOTOS_COPY, orderPhotosSchemas, useImageRulesQuery; 09-08 ImageUploader (draft mode) and PhotoTile; 09-03 prepareImage"
provides:
  - OrderPhotoPicker (F1 draft photo picker over ImageUploader mode draft) with useDraftPhotos and the DraftStore it works on
  - DraftDescriptionWindow (draft description window, drawn beside the form)
  - PhotoDescriptionModal (draft and live words, server limit, Discard changes, Saving state; live saves arrive in 09-27)
  - F1 Images card swap, dirty guard over drafts, and the hand-off to photoUploadQueue.enqueue after create
  - "@order-photos-create e2e journeys (two photos with cover; a described draft)"
affects: [09-23, 09-27, 09-29]

created: "2026-11-03T21:25:00-06:00"
updated: "2026-11-03T21:25:00-06:00"

actuals:
  tokens: 17300
  tasks: 3
  commits: 8

plan_head_before: 37ba6bf403cc6a52bc583fc3e737c9511edef2b5
plan_head_after: 409168417485a51dea9b22e7532cfe851357d741
commits: 8

tech-stack:
  added: []
  patterns:
    - "A draft store (useDraftPhotos) with a synchronous read() and update(change): the picker, which works across several awaits, and the description window share one latest list"
    - "A window that renders its own form is drawn beside the page form, never inside it (forms cannot nest and a submit would bubble to the order form)"
    - "A place is held in the draft list while a photo is prepared: the tile shows a Skeleton, counts toward 5, and is given back if the file is refused"

key-files:
  created:
    - web/src/modules/admin/components/OrderPhotoPicker.tsx
    - web/src/modules/admin/components/OrderPhotoPicker.test.tsx
    - web/src/modules/admin/components/PhotoDescriptionModal.tsx
    - web/src/modules/admin/components/PhotoDescriptionModal.test.tsx
    - web/e2e/order-photos-create.spec.ts
  modified:
    - web/src/modules/admin/pages/OrderFormPage.tsx
    - web/src/modules/admin/pages/OrderFormPage.test.tsx
    - web/e2e/order-create.spec.ts

key-decisions:
  - "The description window is not drawn by the picker. It has a form of its own, and the picker sits inside the New Order form, so the page draws DraftDescriptionWindow after the form element."
  - "Drafts live in a store (useDraftPhotos) instead of value/onChange props, because a pick runs across awaits and a description change from the window would otherwise work on a stale list."
  - "Save waits for any photo still being prepared (picker handle settled()), so a photo picked a moment before Save is not lost."
  - "The queue file was not changed (plan rule), so the upload reactions (request, order cache, locked toast, batch toast) are built again in OrderFormPage for the new order's id."

requirements-completed: [ORD-04, IMG-05]

coverage:
  - id: D1
    description: "On the New Order form, staff pick photos into the Images card; each runs prepareImage and the pick checks and becomes a draft tile named New order photo {n}; with no drafts the add area shows 0/5 and the form saves without photos"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotoPicker.test.tsx#OrderPhotoPicker (tracer)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#photos picked on the form (ORD-04, D-09, D-10, D-28)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Save creates the order exactly as before, then hands the drafts to that order's upload queue in draft order with their descriptions; the first draft becomes the cover; a failed create keeps the drafts; no drafts means no upload"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#creates the order first, then hands both drafts to the new order in their order, and lands on its page"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#keeps the drafts on the form with everything else when the create fails, and sends no upload"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @order-photos-create (10 passed, 5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Drafts can be moved, made cover and removed on the form with no request; the limit of 5 keeps the first files and counts the ones left out, then the F1 note replaces the add area; a Skeleton shows until the data: preview is ready; drafts make the form dirty so Discard changes covers them"
    requirement: "IMG-05"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotoPicker.test.tsx#arranging drafts (D-08, D-09, UIC-5)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotoPicker.test.tsx#the limit of 5 (D-08, UIC-29)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#drafts and the Discard changes guard (ORD-15, D-09)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Edit Description window for a draft: titled with New order, Photo n of total; field prefilled and selected; empty or default text kept as default; more than the server limit after trim refused in the browser; Saving state; Discard changes on a changed field; no request; the description travels with the draft to the upload"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PhotoDescriptionModal.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#describing a draft on the form (D-12, D-30)"
        status: pass
      - kind: e2e
        ref: "@order-photos-create a draft described Front mockup uploads with that description and shows it on the order page (5 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "How the F1 Images card, the draft tiles, the skeleton, the pick-error box and the description window look and read at 390, 820 and 1440 px in both themes"
    requirement: "IMG-05"
    verification:
      - kind: other
        ref: "owner review: screenshots in plan 09-30 (UI-SPEC Visual Review: F1 with 0, 1 and 5 drafts and a pick-error box)"
        status: unknown
    human_judgment: true
    rationale: "Look, spacing and wording quality at several widths and in both themes is the owner's judgment; no test asserts it."

duration: about 1h 15min
completed: 2026-11-03
status: complete
---

# Phase 9 Plan 21: Add photos while creating an order Summary

*Created: 2026-11-03T21:25:00-06:00 · Updated: 2026-11-03T21:25:00-06:00*

**Staff can pick, arrange and describe photos on the New Order form as in-memory drafts; Save creates the order exactly as in Phase 8 and then hands the drafts to the new order's upload queue, so they upload one by one on the order page with the first as cover, with no package added and the queue file untouched.**

## Performance

- **Duration:** about 1h 15min
- **Started:** 2026-11-04T02:31:49Z
- **Completed:** 2026-11-04T03:27Z
- **Tasks:** 3
- **Files modified:** 8 (5 new, 3 changed)

## Accomplishments

- `OrderPhotoPicker` runs the same pick as the order page (rules, `prepareImage`, the zod pick check, the room of 5) and keeps the results as drafts. A place is held while a photo is prepared, so its tile shows a Skeleton and counts toward 5; a refused file gives the place back and is listed in the pick-error box.
- Move, Make Cover and Remove work on the drafts with no request and no confirm, with the polite announcements and focus rules (Make Cover moves focus to that photo's Edit description; Remove moves focus to the add area). Default texts ("New order photo {n}") follow the place; a typed description stays with its photo.
- The F1 Images card is the picker (the coming-soon card and `IMAGES.soon` are gone). Drafts make the form dirty, so the existing "Discard changes?" guard covers them; a clean form with no drafts leaves without asking.
- After the create answers, `photoUploadQueue.enqueue(order.id, drafts, deps)` runs, then `allowLeave()` and the navigation. The order page's card shows the files as waiting and uploads them one at a time. A failed create sends nothing and keeps the drafts.
- `PhotoDescriptionModal` (on `OrderWindow`) is the "Edit Description" window: prefilled, selected, server limit checked in the browser with the server's words, Saving state, "Discard changes?" on Cancel, Esc, scrim or close after a change. Empty or the exact default text is handed on as "" (no description).

## Task Commits

1. **Task 1 (tracer): pick two photos on the form, save, watch them upload** - `adee1194` (test, RED), `f71f8613` (feat, GREEN), `6e4502c7` (test: 30 s for the create in the journey on a cold host)
2. **Task 2: arrange drafts within the limit, with the discard guard** - `7879a722` (test, RED), `f397abe3` (feat, GREEN)
3. **Task 3: describe a draft photo** - `d74c2a04` (test, RED), `855eb86e` (refactor: one draft store), `40916841` (feat, GREEN)

## TDD Gate Compliance

Each task has a `test(09-21)` commit before its `feat(09-21)` commit, and one `refactor(09-21)` commit. I did not run `gsd_run check tdd-red-evidence`; I inspected each RED run by hand.

- **Task 1 RED (`adee1194`):** an empty stand-in picker was committed with the tests. Vitest: 6 failed, 49 passed. The failures were `Unable to find an element with the text: JPG, PNG, WEBP or HEIC · up to 10 MB each · 0/5`, `Unable to find ... /0\/5/` in the four pick and save tests, and the coming-soon test. "No upload when there are no drafts" already passed at RED (characterization). GREEN: 55 passed. The tracer gate (auto mode off, `human_verify_mode` end-of-phase, automated-only verify) was met by re-running the unit tests and `@order-photos-create` in chromium before Task 2 (1 passed).
- **Task 2 RED (`7879a722`):** 8 failed, 5 passed. Failed on move, cover, remove, "limit: picking 6", "limit: removing one", the Skeleton and "leaves without asking once the only draft is removed". The Edit-description press, "limit: at 5", the refused file and two guard tests passed already because Task 1 had added them (characterization). GREEN: 12 picker tests and 58 form tests passed.
- **Task 3 RED (`d74c2a04`):** 14 failed (every window test and the three picker describing tests: the dialog "Edit Description" was not found); the two form tests failed in the next run for the same reason. GREEN: window 14, picker 12 (26 passed), form 58 passed.
- **REFACTOR (`855eb86e`):** the draft store; the tests that passed before still passed, and only the Task 3 RED tests still failed.

## Check results

- `npx vitest run src/modules/admin/pages src/modules/admin/components` (the plan verification): `Test Files 74 passed (74)`, `Tests 2006 passed (2006)`.
- `npx vitest run src/test/orders-boundaries.node.test.ts src/test/source-layout.node.test.ts src/test/no-long-dash.node.test.ts src/test/lint-rules.node.test.ts`: `Tests 115 passed (115)`.
- `npm run typecheck`: exit 0, no output after the three `tsc` lines.
- `npx eslint . --max-warnings 0`: no output (clean). `npx prettier --check src e2e`: `All matched files use Prettier code style!`. `node scripts/class-gate.mjs`: no findings. No em dash or en dash in the changed web files (byte grep for U+2013 and U+2014 printed nothing).
- Preflight (PowerShell is not available from the worktree): `netstat -ano | grep -E ':(5180|5115|7028|5199) '` showed nothing listening before every e2e run. I started only my own runs through `npm run e2e`; no process is left running.
- `npm run e2e -- --grep @order-photos-create` (five projects): `10 passed (1.4m)`. A first chromium run failed with the create still "Saving" after 5 s on a cold host; the journey now waits up to 30 s for the redirect (`6e4502c7`), and then passed.
- `npm run e2e -- --grep @orders-create --project chromium --project firefox` (regression of the create spec I edited): `6 passed (31.7s)`.
- Acceptance greps: `photoUploadQueue.enqueue` in `OrderFormPage.tsx` count 1; `IMAGES.soon` count 0; `OrderPhotoPicker.test.tsx` has tests named "limit: ..." and "Make Cover ..."; `PhotoDescriptionModal.test.tsx` has tests named 'asks "Discard changes?" ...'.
- `gitleaks protect --staged --no-banner` before each of the 8 commits: `no leaks found`.
- **Flake record:** `OrderFormPage.test.tsx > cannot be left through the dialog while a save is pending` (a 300 ms fake API delay) failed in two runs where two test files ran together under machine load, and passed alone every time (the same test 09-16 recorded). Two other form tests hit the 5 s test limit once in a paired run while another project was building, and passed alone. No run of the full plan verification above had a failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The description window cannot sit inside the New Order form**
- **Found during:** Task 3 design
- **Issue:** The picker is rendered inside the `<form>` of F1, and `OrderWindow` renders a `<form>` of its own. Nested forms are invalid, React warns, and the inner submit bubbles through the React tree to the order form's `onSubmit`, which would save the order.
- **Fix:** The picker only reports the press (`onEditDescription(id)`). The page draws `DraftDescriptionWindow` after the form element. A page test asserts the dialog has no `form` ancestor and that saving a description sends no request.
- **Files modified:** `OrderPhotoPicker.tsx`, `OrderFormPage.tsx`
- **Committed in:** `40916841`

**2. [Rule 3 - Blocking] The picker takes a draft store, not `value` and `onChange`**
- **Found during:** Task 3 (the description window changes drafts from outside the picker)
- **Issue:** A pick runs across several awaits and the window edits the list in between; a list read from props would be stale and could drop a photo or a description.
- **Fix:** `useDraftPhotos` returns `{ drafts, read, update }` with a synchronous latest list. The plan's artifact line says "value: draft list; onChange"; the props are now `store`, `onEditDescription` and `handleRef`.
- **Files modified:** `OrderPhotoPicker.tsx`, `OrderFormPage.tsx`, the picker tests
- **Committed in:** `855eb86e`

**3. [Rule 1 - Bug] The create e2e still expected the coming-soon text**
- **Found during:** Task 1
- **Issue:** `web/e2e/order-create.spec.ts` asserted "Image uploads are coming soon." on F1.
- **Fix:** It now asserts the text is hidden and the Images heading is visible. A regression run of `@orders-create` passed.
- **Files modified:** `web/e2e/order-create.spec.ts` (not in the plan's list)
- **Committed in:** `f71f8613`

**4. [Rule 3 - Blocking] The photo upload reactions are built again in `OrderFormPage`**
- **Issue:** The plan says not to change the queue file, and `usePhotoUploadQueue` builds its deps inside the hook for a known order id. F1 has no id until the create answers.
- **Fix:** `uploadDeps(orderId)` in `OrderFormPage.tsx` mirrors the hook (request, order cache, locked refetch and toast, batch toast). See the follow-up below.
- **Committed in:** `f71f8613`

**5. [Rule 3 - Blocking] No `node_modules` in the worktree**
- **Fix:** A junction `web/node_modules` to the main checkout's `web/node_modules`, made with Node. It is git-ignored; nothing was installed and no package changed.

**Total deviations:** 5 (2 design changes forced by nested forms and stale reads, 1 bug in an older e2e, 2 blocking setup items). **Impact:** none on the plan's goal; the plan's artifact names `OrderPhotoPicker`, `DraftPhoto` and `PhotoDescriptionModal` exist, with `DraftStore`, `useDraftPhotos` and `DraftDescriptionWindow` added.

### Plan differences (gap fills, parked for the owner)

- **Make Cover on a draft** moves focus to that photo's "Edit description" (the P3 live rule, applied to drafts). **Remove on a draft** moves focus to the add area.
- **Remove on a draft** announces "Photo deleted. {n} photos left." (the live delete line); the spec has no draft-remove line.
- **A photo picked a moment before Save** is waited for (Save runs after the picker has settled), instead of being dropped.

## Known Stubs

None. `PhotoDescriptionModal` has a `live` mode (title, default text, `banner` prop) that no screen uses yet; plan 09-27 wires it. `ORDER_PAGE_COPY.images.soon` is no longer read by F1 (the copy key remains in `orderPageCopy.ts`, owned by another plan).

## Threat Flags

None new. T-09-50: the hand-off runs only in the create's `onSuccess`, keyed by `order.id` from the server answer (test: no upload before the create answers, and none after a failed create). T-09-51: drafts live in component state and the module queue only; nothing is written to browser storage; the discard guard covers drafts. T-09-SC: no package added or bumped (`web/package.json` and the lockfile are untouched).

## Owner decisions pending

- [ ] **Wording of the draft Remove announcement.** Right now removing a draft photo is announced to screen readers as "Photo deleted. 1 photo left." (the order-page delete line). Options: (1) keep it; (2) add a line "Photo removed. 1 photo left." to `orderPhotosCopy.ts`. My recommendation: option 2 later, since a draft is "removed" on the tile ("Remove photo 1") and "deleted" is the saved-photo word; it is one string, so it can wait for the wording pass.
- [ ] **Look check of F1 with 0, 1 and 5 drafts and a pick-error box** at 390, 820 and 1440 px in Blush and Espresso (the UI-SPEC Visual Review, plan 09-30), and the real-phone camera pick on F1.

## Follow-ups (recorded, not done)

- `uploadDeps` in `OrderFormPage.tsx` repeats the deps of `usePhotoUploadQueue` (about 15 lines). A later plan that may edit the queue file can export one `photoUploadDeps` builder and use it in both places.
- The `@order-photos-create` journeys run the save and the uploads under `withPhotoHost`, as plan 09-16 advised.

## Self-Check: PASSED

- FOUND: `web/src/modules/admin/components/OrderPhotoPicker.tsx`, `OrderPhotoPicker.test.tsx`, `PhotoDescriptionModal.tsx`, `PhotoDescriptionModal.test.tsx`, `web/e2e/order-photos-create.spec.ts`
- FOUND commits (ancestors of HEAD): `adee1194`, `f71f8613`, `6e4502c7`, `7879a722`, `f397abe3`, `d74c2a04`, `855eb86e`, `40916841`

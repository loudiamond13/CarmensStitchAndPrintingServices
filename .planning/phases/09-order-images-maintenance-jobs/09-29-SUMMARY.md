---
phase: 09-order-images-maintenance-jobs
plan: 29
subsystem: web
tags: [order-photos, delete, confirm-dialog, focus, announcements, purge-dialog, e2e]
requires:
  - phase: 09-order-images-maintenance-jobs
    provides: "09-26 DELETE /orders/{orderId}/images/{imageId}, 09-27 live card (busy rule, Saved line, polite region), 09-23 viewer state and readOnly prop"
provides:
  - "orderPhotosService.remove (DELETE, no body, no version, no key)"
  - "OrderPhotosCard Delete photo flow: ConfirmDialog, single-flight delete, Saved, 'Photo deleted. n photos left.', focus rule, 404 and failure handling"
  - "PurgeOrderDialog Images tile and sentence from the deleted order's real photo count"
  - "@order-photos-delete e2e (2 journeys)"
affects: [09-30]
key-files:
  created:
    - web/e2e/order-photos-delete.spec.ts
  modified:
    - web/src/modules/admin/services/orderPhotosService.ts
    - web/src/modules/admin/services/orderPhotosService.test.ts
    - web/src/modules/admin/components/OrderPhotosCard.tsx
    - web/src/modules/admin/components/OrderPhotosCard.test.tsx
    - web/src/modules/admin/components/PurgeOrderDialog.tsx
    - web/src/modules/admin/components/PurgeOrderDialog.test.tsx
    - web/src/modules/admin/components/DeleteOrderDialog.test.tsx
    - web/src/test/deletedOrderFixtures.ts
key-decisions:
  - "The delete reuses the Phase 8 pattern from the Items tab: the dialog closes and the answer is applied in one step, and an effect on the card moves focus once the photo has left the page. That keeps the dialog's own focus return from fighting the new focus."
  - "A 422 shows the server's sentence in the dialog and re-reads the order (the card turns read-only); a 404 is handled in the confirm itself so the dialog closes quietly, the photos reload and the polite line says the photo was already deleted."
  - "Focus candidates are the photos after the deleted one, then the ones before it, nearest first, and the first candidate that is still on the page wins. If none is left, the first add control takes focus, and the card heading if even that cannot."
  - "Cancel puts focus back on that photo's Delete control by name, because Safari does not focus a button on a click and the dialog's own return has nothing to go back to."
requirements-completed: []
requirements-advanced: [ORD-04, JOB-02]
status: complete
commits: 4
plan_head_before: b9d6c05264681c7b1d17602ba2b4433a587eb3c1
plan_head_after: fa719e6e0f12bfdf53c4fd40ab23dbd9573374f0
actuals:
  tokens: 7300
  tasks: 2
  commits: 4
coverage:
  - id: D1
    description: "Delete photo n opens 'Delete photo n?' with the order number message, Cancel focused first and the danger 'Delete Photo' (pending 'Deleting'); confirming sends one DELETE; a double press sends one"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#deleting a photo (D-15, D-11, UIC-18, UIC-36, UIC-41)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @order-photos-delete (delete the cover, 5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "After a delete the photos come from the answer, Saved shows, the polite line reads 'Photo deleted. n photos left.' ('1 photo left.' / 'No photos left.'), and focus goes to the next thumb, else the previous, else the first add control, else the heading; Cancel returns focus to that photo's Delete control"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#deleting a photo (next photo, previous photo, singular, last photo, Cancel)"
        status: pass
      - kind: e2e
        ref: "@order-photos-delete: next photo becomes the cover on the page and on the Orders list, focus on its thumb (5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A 404 closes the dialog, reloads the photos and announces 'That photo was already deleted.'; a 422 shows the server sentence in the dialog and turns the card read-only; any other failure keeps the dialog open with a role=alert line and no Saved"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#already deleted (404), server failure, 422 orders.locked"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Manager's permanent-delete dialog counts the order's real photos in the Images tile and the sentence; the soft-delete sentence still leaves photos out"
    requirement: "JOB-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PurgeOrderDialog.test.tsx#counts the order's real photos in the Images tile and the sentence (D-20), says 1 image in the singular"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/DeleteOrderDialog.test.tsx#leaves photos out of the sentence, because a soft delete keeps them (D-20)"
        status: pass
      - kind: e2e
        ref: "@order-photos-delete a Manager's permanent-delete dialog counts the order's 2 photos (5 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No Delete control on a Completed or Cancelled order or on the deleted view (read-only card); a long order number in the dialog message is shown and the dialog has no axe violations"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#read-only photos (D-11, D-20, UIC-2, UIC-25) and shows a long order number in the message and has no axe violations"
        status: pass
    human_judgment: false
duration: 25min
completed: 2026-11-04
created: 2026-11-04T02:10:00-06:00
updated: 2026-11-04T02:10:00-06:00
---

# Phase 9 Plan 29: Delete photos on the order page Summary

**Staff can delete a saved photo from the order page after a confirm (Cancel focused first), land on the next photo with "Saved" and a spoken "Photo deleted. n photos left.", and a Manager's permanent-delete dialog now counts the order's real photos.**

## Performance

- **Duration:** about 25 min
- **Tasks:** 2 of 2 (Task 1 was the tracer; its end-to-end check passed in 5 of 5 projects before Task 2)
- **Commits:** 4 (two RED, two GREEN); the SUMMARY commit follows
- **Files changed:** 9 (1 created, 8 modified)

## Accomplishments

- **Remove call (OR-5).** `orderPhotosService.remove(orderId, imageId, signal)` sends `DELETE /orders/{orderId}/images/{imageId}` with no body, no version and no Idempotency-Key, and answers the whole order.
- **Confirm first (D-15, T-09-72).** The Delete photo n control on a saved tile opens a `ConfirmDialog` titled "Delete photo n?" with "It's removed from {number} right away. This can't be undone.", Cancel focused first and the danger "Delete Photo" (pending "Deleting"). All words come from `ORDER_PHOTOS_COPY`, which was not edited. The delete runs through `useOrderAction`, so a double press sends one request. While it runs, `busy` is true and every saved-photo control is `aria-disabled`.
- **After a delete.** The page takes the server's answer, "Saved" shows, and the polite region says "Photo deleted. 2 photos left." (or "1 photo left." / "No photos left."). Focus goes to the next photo's thumb, else the previous one's, else the first add control, else the card heading. Cancel sends nothing and puts focus back on that photo's Delete control.
- **Refusals.** A 404 closes the dialog, reloads the photos and announces "That photo was already deleted." (no Saved, no toast). A 422 shows the server's sentence in the dialog line and re-reads the order, so the card turns read-only. Any other failure keeps the dialog open with the shared `role="alert"` line and no Saved.
- **Permanent-delete count (D-20, T-09-73).** `PurgeOrderDialog` used a fixed `images: 0`. It now uses `order.images.length` from the deleted order it already reads, so the Images tile and the sentence ("... and 4 images.") are true. The soft-delete sentence is unchanged, and a new guard test says so.
- **E2E `@order-photos-delete`, 10 passed in 5 projects:** (1) delete the cover of three photos: the dialog asks with Cancel focused, the next photo becomes the cover on the page and on the Orders list, focus is on its thumb, Saved shows and the polite line is set; (2) a Manager soft-deletes an order with 2 photos, opens it under Deleted Orders, and the permanent-delete dialog shows "and 2 images." and a "2images" tile.

## Task Commits

| Task | Commit | Type |
| ---- | ------ | ---- |
| 1 RED | 7f46edfc | test(09-29): add failing tests for deleting an order photo |
| 1 GREEN | e0223419 | feat(09-29): delete a saved photo after confirming, and land on the next one |
| 2 RED | 53d4a3d2 | test(09-29): add failing tests for the real photo count in the permanent-delete dialog |
| 2 GREEN | fa719e6e | feat(09-29): count the order's real photos in the permanent-delete dialog |

Tracer gate: after Task 1, `Tracer verified end-to-end - expanding` (the delete-the-cover journey passed in 5 of 5 projects).

## TDD notes (RED evidence)

- **Task 1 RED:** 11 tests failed. The service test failed with `service.remove is not a function`. Nine card tests failed with `The property "remove" is not defined on the object` (the spy cannot attach to a method that does not exist yet), and the axe test failed on `Unable to find role="dialog" and name "Delete photo 1?"`. Semantic assessment: they failed because the feature is not built, not because of a fixture or load fault. As in 09-27, the card assertions (focus, announcements, 404, 422) first ran at GREEN. The machine classifier (`check tdd-red-evidence`) was not run: the plan is `type: execute` and Vitest's console output is not one of its report formats. The e2e journey was written in the RED commit but run first at GREEN (an end-to-end run builds the bundle and takes about a minute).
- **Task 2 RED:** 2 tests failed on the planned assertions: the sentence did not end "and 4 images." and, with only photos, no cascade box (`role="alert"`) showed because the count was a fixed 0. Both failed because the count was hard-coded, which is the behavior under change.

## Verification (what I saw)

- `vitest --run` for `orderPhotosService.test.ts` and `OrderPhotosCard.test.tsx`: 2 files, 65 tests passed (card 57, service 8). `PurgeOrderDialog.test.tsx` and `DeleteOrderDialog.test.tsx`: 2 files, 30 tests passed.
- Full web run: 281 of 282 files, 7987 of 7988 tests passed. The one failure is `scripts/license-policy.test.ts > exits 1 on a stricter policy given through --exceptions`, the known worktree-only failure (license-checker finds no packages in a fresh `npm ci --ignore-scripts` tree: `No packages found in this path...`). Nothing in this plan touches it, so I did not chase it.
- `npm --prefix web run e2e -- --grep @order-photos-delete`: first run (Task 1 only) `5 passed (48.3s)`, final run `10 passed (53.6s)` across chromium, firefox, webkit, pixel and iphone. Ports 5180, 5115, 7028 and 5199 were free before each run (netstat); the e2e script took its own lock and ran its own preflight.
- `npm run typecheck` clean. `eslint --max-warnings 0` clean on every changed file. `prettier --check` clean on every changed file. No en or em dash in the changed source files.
- Acceptance: `grep -c "already deleted"` in the card test = 2 and `grep -c "last photo"` = 2 (test names contain both phrases); `grep -c "images: 0" PurgeOrderDialog.tsx` = 0.
- gitleaks ran on every commit (hook and `gitleaks protect --staged`): no leaks. `git rev-list --count b9d6c052..HEAD` = 4 before this SUMMARY commit. Working tree clean after the full test run.
- No flakes seen in the unit or e2e runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test fixture could not build an order with photos**
- **Found during:** Task 2 (RED)
- **Issue:** `orderWithCounts` in `web/src/test/deletedOrderFixtures.ts` took no `images` count, so a purge-dialog test could not ask for a deleted order with 4 photos.
- **Fix:** added an optional `images` count that builds that many `orderImage(n)` photos. The default is still none, so every existing test is unchanged.
- **Files modified:** `web/src/test/deletedOrderFixtures.ts` (not in the plan's list)
- **Commit:** 53d4a3d2

**2. [Rule 2 - Missing critical] Guard that a soft delete still leaves photos out of its sentence**
- **Found during:** Task 2
- **Issue:** the plan truth says the soft-delete wording is unchanged because photos are kept (D-20), but nothing tested it. A later change to the shared cascade code could have started naming photos in the soft-delete sentence.
- **Fix:** one test in `DeleteOrderDialog.test.tsx` passes `images: 4` and checks the sentence ignores it.
- **Files modified:** `web/src/modules/admin/components/DeleteOrderDialog.test.tsx` (not in the plan's list)
- **Commit:** fa719e6e

**Total deviations:** 2 auto-fixed (1 Rule 3, 1 Rule 2). **Impact:** none on scope; two test-side files outside the plan's list were touched for the reasons above.

### Other notes

- **The ledger file for the commit count could not be written.** The sandbox refused a write to the shared `.git/worktrees/...` folder, so `plan_head_before` is the base SHA the orchestrator gave (`b9d6c052`), which is also `HEAD` at the start (checked before any work). `commits: 4` is `git rev-list --count b9d6c052..HEAD` before this SUMMARY commit.
- **Requirements not ticked.** ORD-04 and JOB-02 are declared by later plans in this phase that have no SUMMARY yet (for example 09-30), so the shared-ID rule keeps them open. `REQUIREMENTS.md` is not changed.
- **The 404 takes the dialog's confirm path, not the toast path.** The plan asks for the announcement only, so no toast is shown for "already deleted".
- **Error line for a plain failure.** `ConfirmDialog` shows the shared fixed-text line (plus the Reference for a 500), never raw server text. Only a 422 uses the server's own sentence, because that is the one status where the server writes the words for staff.

## Issues Encountered

- The full-run failure `scripts/license-policy.test.ts` is worktree-only and unrelated (see Verification).
- A heredoc append to the e2e spec was refused by the sandbox's path check; the test was added with the editor tool instead. No effect on the result.

## Authentication Gates

None.

## Known Stubs

None. The `onDelete` no-op stub that 09-27 left in `OrderPhotosCard.tsx` is now wired.

## Threat Flags

None. T-09-72 (accidental delete): the confirm dialog opens first with Cancel focused, a double press sends one request (test asserts one call), and the server audits the delete (D-19). T-09-73 (purge hides how much is removed): the permanent-delete dialog shows the true photo count (unit and e2e). T-09-SC: no package added or bumped.

## Next Phase Readiness

Plan 09-30 can build on a card whose move, make cover, describe and delete all work. The card keeps its `busy`, `setSaved`, `setAnnouncement` and focus helpers (`findControl`, `focusAfterDelete`) near the top of `OrderPhotosCard`. The server catalog and the web audit list already carry `order-image.deleted` (97 codes), so no audit wording changed here.

## Self-Check: PASSED

- Created file present: `web/e2e/order-photos-delete.spec.ts`.
- Commits 7f46edfc, e0223419, 53d4a3d2 and fa719e6e are ancestors of HEAD (`git rev-list --count b9d6c052..HEAD` = 4).

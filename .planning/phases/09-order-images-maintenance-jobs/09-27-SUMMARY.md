---
phase: 09-order-images-maintenance-jobs
plan: 27
subsystem: web
tags: [order-photos, move, make-cover, describe, conflicts, announcements, audit-log, e2e]
requires:
  - phase: 09-order-images-maintenance-jobs
    provides: "09-20 move and describe endpoints, 09-21 PhotoDescriptionModal draft mode, 09-23 card viewer state and readOnly prop"
provides:
  - "orderPhotosService.move and describe (versioned PUT calls)"
  - "OrderPhotosCard live Move, Make Cover and drag with Saved line, polite announcements, busy rule, 409 reload and 422 lock handling, focus rules"
  - "PhotoDescriptionModal live mode (opened version, Saving, ConflictBanner with Load Latest, 404 and 422 banners) and the card's Edit description wiring"
  - "auditCopy words for the five order-image codes"
  - "orderPhotoList.ts (shared photo order and default text) and @order-photos-arrange e2e (3 journeys)"
affects: [09-29, 09-30]
key-files:
  created:
    - web/src/modules/admin/orderPhotoList.ts
    - web/e2e/order-photos-arrange.spec.ts
  modified:
    - web/src/modules/admin/services/orderPhotosService.ts
    - web/src/modules/admin/services/orderPhotosService.test.ts
    - web/src/modules/admin/components/OrderPhotosCard.tsx
    - web/src/modules/admin/components/OrderPhotosCard.test.tsx
    - web/src/modules/admin/components/PhotoDescriptionModal.tsx
    - web/src/modules/admin/components/PhotoDescriptionModal.test.tsx
    - web/src/modules/admin/components/orderPhotos.recipe.ts
    - web/src/modules/admin/auditCopy.ts
    - web/src/modules/admin/auditCopy.test.ts
    - web/src/modules/admin/hooks/useOrderChildSave.ts
    - web/src/modules/admin/orderWindowsCopy.ts
    - web/src/modules/admin/orderPhotosSchemas.ts
    - web/src/modules/admin/orderPhotosSchemas.test.ts
key-decisions:
  - "A move sends the version of the latest answer the page holds (query cache), not the render's prop, so a coworker's write that landed in between is not undone"
  - "Focus after a move is restored only when a move button was the focused control at the press (a drag leaves focus alone); at an end of the list it goes to the photo's other move button"
  - "The description window reuses the Phase 8 window save hook (useOrderChildSave) with a new quiet option (no toast, the card shows Saved) and a 'photo' thing, instead of a second copy of the 409/404/422 rules"
  - "The description limit counts UTF-16 code units (JavaScript length, like the server's C# Length); zod's max counts code points and was wrong for emoji"
requirements-completed: []
requirements-advanced: [ORD-04]
status: complete
commits: 6
plan_head_before: d4e7f11afbb9255c4a0be7de124ad5ed947a703d
plan_head_after: 66335915b8248e4393ff10ea0beb6353f3845430
actuals:
  tokens: 21700
  tasks: 3
  commits: 6
coverage:
  - id: D1
    description: "Move photo n left or right saves at once with the latest order version; the tiles reorder when the server answers; focus stays on the pressed control (or the photo's other move button at an end); 'Saved' shows and the polite region says 'Moved to position n of total.'"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#moving a photo with the buttons (D-13, D-15, UIC-10, UIC-43)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @order-photos-arrange (keyboard-only move, 5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Make Cover saves as a move to position 0, announces 'It's now the cover.', focuses that photo's Edit description, and shows as the cover on the Orders list; drag onto another tile sends the same request"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#Make Cover and drag (D-13, D-14, UIC-35)"
        status: pass
      - kind: e2e
        ref: "@order-photos-arrange Make Cover on photo 3 (5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "While a change saves or a file waits or uploads, every saved-photo control is aria-disabled with focus kept and drag is off; Saved clears after 4 seconds or at the next change; the ends of the list and a single photo behave"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#the busy rule (UIC-10, WEB-09), ends of the list (UIC-35)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A 409 reloads the photos, toasts 'Photos reloaded' and focuses the Images heading with no retry; a 422 orders.locked refetches, makes the card read-only and toasts the server text; other failures toast the plain-English line"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#a photo change that is refused (D-11, D-15, UIC-16, UIC-19)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Edit description saves a saved photo at once with the version the window opened with; empty or default text clears it; 409 shows the ConflictBanner and Load Latest puts the latest text in the field; 404 and 422 block Save with their banners; the limit counts UTF-16 units; focus returns to Edit description and Saved shows"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PhotoDescriptionModal.test.tsx#the live description window, a refused live description save"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#describing a saved photo (D-12, D-15, D-30, UIC-5, UIC-11)"
        status: pass
      - kind: e2e
        ref: "@order-photos-arrange describing photo 1 (5 projects)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Audit Log words the five order-image codes as Order photo added, Order photo moved, Order cover photo changed, Order photo description changed, Order photo deleted"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/auditCopy.test.ts#reads the five order photo events in plain words under Orders (D-19)"
        status: pass
    human_judgment: false
duration: 70min
completed: 2026-11-04
created: 2026-11-04T01:35:00-06:00
updated: 2026-11-04T01:35:00-06:00
---

# Phase 9 Plan 27: Arrange photos on the order page: move, choose the cover and describe Summary

**Staff can move a photo, make it the cover and edit its description from the order page; each change saves at once with the order version it was based on, says "Saved", is spoken to screen readers, and handles conflicts and locks without retrying on its own.**

## Performance

- **Duration:** about 70 min
- **Tasks:** 3 of 3 (Task 1 was the tracer; its end-to-end check passed before expansion)
- **Commits:** 6 (three RED, three GREEN); the SUMMARY commit follows
- **Files changed:** 15 (2 created, 13 modified)

## Accomplishments

- **Move (D-13, D-15).** `orderPhotosService.move` calls `PUT .../images/{id}/position`. The card sends it through `useOrderAction` (single flight), with the version read from the order query cache. The answer is applied with `useApplyOrder`, the tile order follows the server, "Saved" shows in the card head (check icon in `--success`), and the hidden polite region says "Moved to position n of total." or, for a new cover, "Moved to position 1 of total. It's now the cover."
- **Focus.** If a move button had focus at the press, it gets focus again on the moved photo once the answer is on screen; at an end of the list, focus goes to the photo's other move button. After Make Cover it goes to that photo's "Edit description". A drag leaves focus alone.
- **Make Cover and drag (D-14).** Make Cover is a move to position 0. The `ImageUploader` drag already called `onMove(id, toIndex)`, so a drop sends the same request.
- **Busy rule (UIC-10).** `busy` is true while a move saves or a file waits or uploads. The saved-photo controls are `aria-disabled` and drag is off (the card used to pass a fixed `busy`). A second press sends nothing.
- **Conflicts and locks (D-11, D-15).** A 409 refetches the order, shows the info toast "Photos reloaded" and focuses the Images heading; nothing is retried. A 422 (or 404 or 400) refetches and shows the danger toast "Couldn't save the photo change" with the server's sentence; the card turns read-only from the refetched order. Any other failure shows the plain-English line from `describeHttpError`.
- **Description window, live mode (D-12, D-30, P5).** `PhotoDescriptionModal` is now two modes. Draft is unchanged. Live saves itself with the version it opened with, reuses `useOrderChildSave` (409 banner with Load Latest, 404 "This photo was removed.", 422 server text, Save `aria-disabled` when blocked) and sends "" for an empty field or the exact default text. The card opens it from "Edit description", closes it on success, focuses the same "Edit description", shows "Saved" and announces "Description saved.".
- **Audit words (D-19).** `auditCopy.ts` words the five codes under Orders; the mirror test now lists 97 codes.
- **E2E `@order-photos-arrange`, 15 passed in 5 projects:** keyboard-only Move photo 1 right (tiles swap, Cover tag follows, focus on Move photo 2 right, Saved); Make Cover on photo 3 (becomes the cover here and on the Orders list, focus on Edit description of photo 1); describe photo 1 as "Front mockup" (viewer shows it as the picture's name, photo 2 keeps its default text).

## Task Commits

| Task | Commit | Type |
| ---- | ------ | ---- |
| 1 RED | a9b37a6e | test(09-27): add failing tests for moving a photo with the keyboard |
| 1 GREEN | f8ad48a2 | feat(09-27): move a saved photo from the Images card |
| 2 RED | f553b198 | test(09-27): add failing tests for Make Cover, conflicts and locks on photo changes |
| 2 GREEN | 99caed89 | feat(09-27): Make Cover, conflicts and locks on photo changes |
| 3 RED | 891234e4 | test(09-27): add failing tests for describing a saved photo and the photo audit words |
| 3 GREEN | 66335915 | feat(09-27): describe a saved photo and read photo changes in the Audit Log |

Tracer gate: after Task 1, `⚡ Tracer verified end-to-end - expanding` (the keyboard journey passed in 5 of 5 projects).

## TDD notes (RED evidence)

- **Task 1 RED:** 4 tests failed. The two service tests failed with `service.move is not a function`; the two card tests failed with `The property "move" is not defined on the object` (the spy cannot attach to a method that does not exist yet). Semantic assessment: they failed because the behavior is not built, not because of a fixture or load fault; the card assertions themselves (reorder, focus, announcement) first ran at GREEN. The machine classifier (`check tdd-red-evidence`) was not run: the plan is `type: execute` and Vitest's console output here is not one of its report formats.
- **Task 2 RED:** 4 failed on planned assertions (Make Cover: tiles did not reorder; 409, 422 locked and network: no toast). Eight tests (Move photo 2 left, drag, the four busy tests including the 4-second clear, and the two list-end tests) were green on arrival, because the tracer already wired `onMove`, the busy flag and the Saved line. Investigated: the tests are right and cover real behavior the plan lists.
- **Task 3 RED:** 19 failed (service `describe` missing, live window not built, audit codes missing); the emoji-length test failed on the planned assertion only after the live window existed, and it found the zod bug below.

## Verification (what I saw)

- `npm --prefix web run test -- --run` for the plan's files at the end: `OrderPhotosCard.test.tsx` 47 tests, `PhotoDescriptionModal.test.tsx` 21, `orderPhotosService.test.ts` 7, `auditCopy.test.ts` and `orderPhotosSchemas.test.ts` all passed.
- Full web run: 281 of 282 files, 7973 of 7974 tests passed. The one failure is `scripts/license-policy.test.ts > exits 1 on a stricter policy given through --exceptions`, the same worktree-only failure 09-23 recorded (a license-checker run over a fresh `npm ci --ignore-scripts` tree); nothing in this plan touches it.
- `npm --prefix web run e2e -- --grep @order-photos-arrange`: `15 passed (1.9m)` (chromium, firefox, webkit, pixel, iphone). Ports 5180, 5115, 7028 and 5199 were free before each run (netstat); the e2e script took its own lock and ran its preflight.
- `npm --prefix web run typecheck` clean; `npm --prefix web run lint` (`--max-warnings 0`) clean; `prettier --check` clean on `src/modules/admin` and the spec; no en or em dash in the changed source files.
- Acceptance: `grep -c "/position"` in the service = 2; the card test asserts 'Moved to position 2 of 3.'; card tests named with "409", "locked" and "busy" exist; `grep -c "order-image.cover-changed" auditCopy.ts` = 1; modal tests named with "409", "404" and "Load Latest" exist.
- gitleaks ran on every commit (hook): no leaks. `git rev-list --count d4e7f11a..HEAD` = 6.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The description limit counted code points, the server counts UTF-16 units**
- **Found during:** Task 3 (the plan's EDGE ORD-04 encoding test)
- **Issue:** `descriptionSchema` used zod's `.max()`. The installed zod (4.6.7) counts code points, so 100 emoji (200 units) passed in the browser but the server (`Trim().Length > 200`) refused them. The OR-3 mirror was wrong for emoji.
- **Fix:** `.refine((text) => text.length <= max, message)`, the same pattern `profileSchemas.ts` already uses. Added a schema test.
- **Files modified:** `web/src/modules/admin/orderPhotosSchemas.ts`, `orderPhotosSchemas.test.ts` (not in the plan's list)
- **Commit:** 66335915

**2. [Rule 3 - Blocking] The Phase 8 window hook could not serve a photo as it was**
- **Found during:** Task 3
- **Issue:** the plan says to use the Phase 8 window save hook. `useOrderChildSave` always raised a balance toast ("Item updated") and had no 'photo' thing for the "removed" words. The photo spec wants no toast (the card says "Saved") and the words "This photo was removed.".
- **Fix:** a `quiet` option on the hook (no success toast) and 'photo' added to `OrderThing` (its `removed` words come out as the spec's). Both are additive; every existing caller is unchanged.
- **Files modified:** `web/src/modules/admin/hooks/useOrderChildSave.ts`, `web/src/modules/admin/orderWindowsCopy.ts` (not in the plan's list)
- **Commit:** 66335915

**3. [Rule 3 - Blocking] Shared photo order for the card and the window**
- The window needs the same "sorted photos with default text" the card computes (for Load Latest). Moving the card's `orderedImages` into `web/src/modules/admin/orderPhotoList.ts` avoids a circular import and a second copy.

**4. [Rule 2 - Missing critical] "Saved" needs its own look**
- Added `orderPhotosSavedIconClasses` (`text-success`) to `orderPhotos.recipe.ts` (not in the plan's list) for the check icon.

### Other notes

- **PhotoDescriptionModal props changed.** It is now a draft or live union (`DraftDescriptionProps`, `LiveDescriptionProps`); the unused `banner` prop is gone. `OrderPhotoPicker` (draft) needed no change. The old live-mode unit test, which passed an `onSave` spy, was rewritten for the new live props.
- **The e2e journeys for Tasks 2 and 3 were added with their GREEN commits**, not their RED commits (Task 1's was in its RED commit). The unit tests were red first for all three tasks.
- **Description limit before the rules load.** The card passes `rules.descriptionMaxLength`, and 200 (the server's value today) until the rules arrive. The server still refuses a longer text with its own message.
- **Any 409 on a move counts as a conflict** (not only `edit.stale`), because the D-15 reaction is the same: reload and ask the person to try again.
- **Server catalog.** `auditCopy.test.ts` mirrors 97 codes including `order-image.deleted`. On this branch the server's `AuditActions.All` has 96 (09-26 adds `OrderImageDeleted`). The mirror is a manual copy with no cross-check, so it only matches after 09-26 is merged; if 09-26 names that code differently, change one line here.

**Total deviations:** 4 auto-fixed (1 Rule 1, 2 Rule 3, 1 Rule 2). **Impact:** none on scope; six files outside the plan's list were touched for the reasons above.

## Issues Encountered

- The full-run failure `scripts/license-policy.test.ts` (see Verification) is worktree-only and unrelated.
- No flakes in the unit tests I ran. The "clears Saved after 4 seconds" test waits in real time (about 4 s).

## Authentication Gates

None.

## Known Stubs

- `Delete photo` on a saved tile is now enabled (the busy flag is real) but its handler `onDelete` is still a no-op in `OrderPhotosCard.tsx`. Plan 09-29 wires the delete dialog. Until it lands, pressing it does nothing.

## Threat Flags

None. T-09-63 (silent overwrite): every move and description save sends the version it was based on, a 409 reloads and never retries (unit tests assert one call). T-09-64 (double submission): single-flight action plus `aria-disabled` controls (busy test asserts one request). T-09-SC: no package added or bumped.

## Next Phase Readiness

Plan 09-29 can wire the delete dialog into the same card: it can reuse `busy`, `setSaved`, `setAnnouncement` and the `focusPlan` for its own focus rule. The card's `describing` window state and the `useOrderAction` move are at the top of `OrderPhotosCard`. `COPY.announce.deleted` and `alreadyDeleted` are already in the copy module.

## Self-Check: PASSED

- Created files present: `web/src/modules/admin/orderPhotoList.ts`, `web/e2e/order-photos-arrange.spec.ts`.
- Commits a9b37a6e, f8ad48a2, f553b198, 99caed89, 891234e4 and 66335915 are ancestors of HEAD (`git rev-list --count d4e7f11a..HEAD` = 6).

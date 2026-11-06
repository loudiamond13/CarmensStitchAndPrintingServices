---
phase: 09-order-images-maintenance-jobs
plan: 08
subsystem: web
tags: [photo-list, image-uploader, photo-tile, a11y, touch, camera, d-05]
requires:
  - phase: 09-order-images-maintenance-jobs
    provides: "09-04: LazyImage with srcSet and sizes, PhotoViewer, the camera icon, MEDIA_COPY"
provides:
  - ImageUploader rebuilt as the presentational photo list (add area, pick errors, limit note, list of tiles)
  - PhotoTile (internal), PhotoTileModel, PhotoThumb, PhotoTileState, PhotoSource, PickError, AddControlHandle and ImageUploaderMode types from @/components
  - MEDIA_COPY.uploader and MEDIA_COPY.tile strings
  - five parity-false showcase cases and the rewritten D-05 browser check
affects: [09-16, 09-21, 09-23, 09-27, 09-29, 09-30]

created: "2026-11-03T11:15:00-06:00"
updated: "2026-11-03T11:15:00-06:00"

actuals:
  tokens: 22900
  tasks: 3
  commits: 6

plan_head_before: 0a6c72cc0716a3546b6301c7d0ac8758715ab1f9
plan_head_after: 26709b41179c7900ce1637569f28ff7299363cef
commits: 6

tech-stack:
  added: []
  patterns:
    - "Presentational uploader: files, photos and limits come in as props and every action leaves as a callback; the component reads no file and makes no blob address"
    - "Hover and touch are CSS only: the drop zone carries no-hover:hidden and the touch row carries hidden no-hover:flex, so jsdom renders both and a test checks the classes"
    - "aria-disabled through Button for the ends and for busy, so a control keeps focus and ignores the press"
    - "Native drag listeners on the tile through a callback ref; the uploader keeps the id being dragged in a ref so a file drag and a tile drag never mix"

key-files:
  created:
    - web/src/components/media/PhotoTile.tsx
    - web/src/components/media/PhotoTile.test.tsx
    - web/src/components/media/photoTile.types.ts
    - web/src/dev/scenarios/groups/media.test.tsx
  modified:
    - web/src/components/media/ImageUploader.tsx
    - web/src/components/media/ImageUploader.test.tsx
    - web/src/components/media/media.recipe.ts
    - web/src/components/media/copy.ts
    - web/src/components/media/index.ts
    - web/scripts/class-gate.config.mjs
    - web/src/dev/scenarios/groups/media.ts
    - web/e2e/a11y-rulings.spec.ts
    - web/e2e/showcase.spec.ts
    - docs/web/styling.md

key-decisions:
  - "The D-05 reveal tokens now sit in PhotoTile.tsx and apply to the decorative grip only. The class gate allows them in ImageUploader* and PhotoTile* files; the ImageUploader entries stay so scripts/tailwind-classes.test.ts (outside the plan) keeps passing."
  - "The grip is not drawn on devices without hover (no-hover:hidden). UI-SPEC says the grip belongs to hover devices and touch has no drag."
  - "A saved photo is a button that opens the viewer; a draft, waiting, uploading or failed file shows its data: preview as a plain image."
  - "Move, edit and make-cover buttons are outlined (secondary) and Delete or Remove is ghost-danger. The spec fixed the 44 px size only; parked for the owner."
  - "A readonly list keeps Remove (and Try Again when retryable) on files that are not uploaded yet, because UI-SPEC P3 says a locked order leaves failed files with Remove only. Saved photos show row 1 only."

patterns-established:
  - "ImageUploader({ photos, max, maxMegabytes, mode, busy, onAddFiles(files, source), onMove(id, toIndex), onMakeCover, onEditDescription, onDelete, onRemove, onRetry, onOpen, limitNote, pickErrors, leftOutCount, addControlRef })"
  - "Position 1 is the cover; only saved and draft photos hold a position; waiting, uploading and failed files list after them and count toward the limit"

requirements-completed: [ORD-04, IMG-05]

coverage:
  - id: D1
    description: "On a device that hovers the add area is the drop zone with browse; where hover is none it is Take Photo (own input, image/*, capture environment, one file) and Choose Photos (image list, many files, no capture); both pass the files to onAddFiles with camera, gallery or drop, and every input is emptied after a pick"
    requirement: "IMG-05"
    verification:
      - kind: unit
        ref: "web/src/components/media/ImageUploader.test.tsx#ImageUploader add area (D-17, D-08)"
        status: pass
    human_judgment: true
  - id: D2
    description: "Every saved or draft photo has a tile with an 88 px thumb, Photo n of total, its description, the Cover tag and ring on photo 1, an always-visible Make Cover on the others, and four 44 px buttons (Move left, Move right, Edit description, Delete or Remove) named per photo with a matching title"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/components/media/ImageUploader.test.tsx#ImageUploader live list with two saved photos (D-25)"
        status: pass
      - kind: unit
        ref: "web/src/components/media/PhotoTile.test.tsx#PhotoTile has no hover-only control (D-14, UIC-45)"
        status: pass
    human_judgment: true
  - id: D3
    description: "Move left on the first photo and Move right on the last (and both on a single photo) are aria-disabled, stay focusable and do nothing; busy makes every saved-photo control aria-disabled with focus kept and drag off, while picking files still works"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/components/media/PhotoTile.test.tsx#PhotoTile ends of the list (D-13)"
        status: pass
      - kind: unit
        ref: "web/src/components/media/ImageUploader.test.tsx#ImageUploader busy (D-15)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Waiting, uploading, failed (retryable or not), draft, preview-pending and preview-unavailable tiles; readonly mode with 'No photos on this order.'; the limit note in place of the add area at 5 counting pending files; the pick-error alert with one line per file and the left-out count"
    requirement: "IMG-05"
    verification:
      - kind: unit
        ref: "web/src/components/media/PhotoTile.test.tsx#PhotoTile waiting, uploading and failed states"
        status: pass
      - kind: unit
        ref: "web/src/components/media/ImageUploader.test.tsx#ImageUploader pick errors (UIC-34, UIC-40)"
        status: pass
      - kind: unit
        ref: "web/src/components/media/ImageUploader.test.tsx#ImageUploader limit (D-08)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dragging a tile onto another calls onMove with the 0-based position; waiting files are not part of the drag; a tile drag never marks the drop zone"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/components/media/ImageUploader.test.tsx#ImageUploader drag between tiles (D-13 bonus)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The five showcase cases (empty, three photos, read-only, draft with a waiting and a failed file, limit) are parity false and axe-clean; the browser check shows that only the grip is hidden at rest on hover devices and every control is at full opacity on every device; a draft photo previews from a data: address under the strict CSP"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/dev/scenarios/groups/media.test.tsx"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @a11y-rulings (98 passed, 2 re-run alone and passed); --grep @showcase --project chromium (12 passed)"
        status: pass
    human_judgment: false
  - id: D7
    description: "How the list looks and feels at 320, 390, 820 and 1440 px in both themes (tile rows fit 228 px, the touch buttons share a row or wrap, the grid goes from two columns to one)"
    requirement: "ORD-04"
    verification:
      - kind: other
        ref: "owner screenshot review in plan 09-30 (UI-SPEC Visual Review)"
        status: unknown
    human_judgment: true

duration: 58min
completed: 2026-11-03
status: complete
---

# Phase 9 Plan 08: The photo list Summary

*Created: 2026-11-03T11:15:00-06:00 · Updated: 2026-11-03T11:15:00-06:00*

**`ImageUploader` is now the compact, presentational photo list: a drop zone on computers and "Take Photo" and "Choose Photos" on phones, and a tile per photo with an always-visible "Make Cover" and four 44 px named buttons, five tile states, three modes, the limit note and the pick-error alert, with no new package.**

## Performance

- **Duration:** about 58 min (10:17 to 11:15, including a 22 min browser run)
- **Tasks:** 3 (6 commits: 3 RED, 3 GREEN)
- **Files:** 4 created, 10 modified (14 files, 2105 lines added, 734 removed)

## Accomplishments

- `ImageUploader` takes `photos`, `max`, `maxMegabytes`, `mode`, `busy` and the callbacks, and reads no file. `onAddFiles(files, 'camera' | 'gallery' | 'drop')` hands the files to the caller, which runs `prepareImage` (plan 09-03).
- `PhotoTile` draws one photo: an 88 px thumb (a button that opens the viewer for a saved photo, a plain `data:` image for a draft), the info column, and row 2 with the buttons. A saved photo uses `LazyImage` with the delivered `srcSet`; with no stored size it uses a 1 / 1 box and 88 x 88.
- "Move left" and "Move right" use `aria-disabled` at the ends. They stay focusable, say nothing is possible, and do nothing when pressed. `busy` does the same for every saved-photo control.
- The grip is the one thing still hidden at rest (D-05), and only where the device hovers. Every real control is drawn at full opacity on every device (D-13, D-14).
- Waiting, uploading and failed files show their name and a status line with only the buttons that fit. A failed file the server would refuse again shows "Remove" only.
- `addControlRef` gives the caller a `focus()` that lands on "browse" or "Choose Photos", whichever shows, for the focus rule after the last delete (UI-SPEC P3).
- The showcase has five photo-list cases, all parity false, and the D-05 browser check now describes the new behaviour.

## Task Commits

1. **Task 1: pick photos on a computer or a phone and see them listed (tracer)** - `42f1b373` (test, RED) then `76044e02` (feat, GREEN)
2. **Task 2: ends, busy, states, modes, limits and pick errors** - `8aa3572a` (test, RED) then `de15de91` (feat, GREEN)
3. **Task 3: the dev scenarios and the D-05 browser check** - `80b92b8c` (test, RED) then `26709b41` (feat, GREEN)

## TDD Gate Compliance

Each task has a `test(09-08)` commit before its `feat(09-08)` commit. RED evidence is the Vitest output I saw at each RED commit; I did not run `gsd_run check tdd-red-evidence` (later runs overwrite the JUnit report).

- **Task 1 RED:** 22 of 26 tests failed on planned assertions (the old uploader had `defaultImages`, no tiles, no named buttons, no second input). A stub `PhotoTile` was committed with the RED so `PhotoTile.test.tsx` failed on assertions, not on a missing module. The 4 that passed were the empty-pick, no-blob and axe checks.
- **Task 2 RED:** 33 of 83 tests failed on planned assertions (no `aria-disabled`, no tile states, no readonly, no limit note, no pick-error alert, no drag, no handle). 50 passed because Task 1 already covered them.
- **Task 3 RED:** 4 of 9 tests failed (the scenario list had 2 cases, not 5; the read-only, draft and limit cases did not exist). The e2e edit (`a11y-rulings.spec.ts`) was made in the GREEN commit: against the Task 1 scenarios it would have passed already, so it could not be a red test.
- **Characterization tests green at RED:** the Task 2 axe, drag-start and hover/touch checks.

## Check results

- Task 1 command, after GREEN: `Test Files  3 passed (3)`, `Tests  99 passed (99)` (ImageUploader, PhotoTile, components index).
- `src/components/media` after Task 2: `Test Files  4 passed`, `Tests  173 passed` (with `scripts/tailwind-classes.test.ts`).
- `npm --prefix web run test -- --run src/dev`: `Test Files  6 passed (6)`, `Tests  306 passed (306)` (Task 3 command).
- Full web suite (`npm run test -- --run`, after the preflight showed ports and processes free): `Test Files  274 passed (274)`, `Tests  7747 passed (7747)`.
- `npm --prefix web run typecheck`: exit 0.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output.
- `npx prettier --check` on the changed folders and files: `All matched files use Prettier code style!`
- Class gate: `node scripts/class-gate.mjs` exit 0 with no findings; `scripts/tailwind-classes.test.ts` passed.
- `npm --prefix web run e2e -- --grep @a11y-rulings` (preflight clean: ports 5180, 5115, 7028, 5199 free, no processes): `98 passed (21.8m)`, 2 failed. The two were `D-02 ... /dev/components (dark)` on webkit and `(light)` on iphone, both `expect(locator('h1')).toHaveText("Component Showcase")` timing out at 5 s during the first load of the showcase. Re-run alone on webkit and iphone: `4 passed (29.4s)`. Recorded as a first-load timing flake, not chased.
- `npm --prefix web run e2e -- --grep @showcase --project chromium`: `12 passed (1.0m)` (includes the rewritten data: preview check).
- Acceptance greps: `capture="environment"` in `ImageUploader.tsx` count 1 (>= 1); `PhotoTile` in `class-gate.config.mjs` count 3 (>= 1); non-comment `createObjectURL` in `ImageUploader.tsx` count 0; `uploader-with-images` in `media.ts` count 2 (>= 1); `parity: true` in `media.ts` count 0; `PhotoTile.test.tsx` has tests named with "busy", "failed" and "readonly"; `ImageUploader.test.tsx` asserts every per-photo name template; `git diff --stat -- web/package.json web/package-lock.json` prints nothing.
- `gitleaks protect --staged --no-banner` before each of the 6 commits: `no leaks found`.
- Em dash and en dash in the changed files: none (`no-long-dash.node.test.ts` passed in the full run).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The dev scenarios changed in Task 1, not Task 3**
- **Found during:** Task 1 (the showcase page test crashed with `Cannot read properties of undefined (reading 'filter')` on the old `defaultImages` props)
- **Issue:** `ComponentShowcasePage.test.tsx` renders every scenario. The old `uploader-empty` and `uploader-with-images` cases passed props the new component does not take.
- **Fix:** Task 1's GREEN commit rewrote `media.ts` to the two existing cases with the new props. Task 3 then added the other three.
- **Files modified:** `web/src/dev/scenarios/groups/media.ts`
- **Commit:** `76044e02`

**2. [Rule 3 - Blocking] A showcase browser test depended on the removed behaviour**
- **Found during:** Task 3 (`web/e2e/showcase.spec.ts` picked a file in `uploader-empty` and expected a preview)
- **Issue:** The uploader no longer reads files, so a pick shows nothing. The test is not in the plan's file list.
- **Fix:** It now checks that the draft case's photo previews from a `data:` PNG that the browser decodes under the strict CSP (UI-CR-01 is still covered).
- **Files modified:** `web/e2e/showcase.spec.ts`
- **Commit:** `26709b41`

**3. [Rule 1 - Docs] The styling page named the old opacity allow-list**
- **Found during:** Task 3 (a grep for the old wording)
- **Fix:** `docs/web/styling.md` now says the reveal belongs to the photo tile grip and may be used in `ImageUploader*` and `PhotoTile*`; updated timestamp changed.
- **Files modified:** `docs/web/styling.md`
- **Commit:** `26709b41`

### Plan differences

- **Gap fill (parked for the owner):** a readonly list keeps Remove on files that have not uploaded (UI-SPEC P3, "locked meanwhile"), while UI-SPEC P1 says readonly is row 1 only. I followed P3 for pending files and P1 for saved photos.
- **Gap fill (parked):** the move, edit and cover buttons are outlined (secondary) buttons; Delete or Remove is ghost-danger. The spec fixed the size only.
- **Gap fill (parked):** the grip is not drawn at all where hover is none (UI-SPEC: grip on hover devices).
- **The `web/src/components/index.test.ts` file in the plan list needed no change.** `PhotoTile` is internal, and the new names are types, which the export test cannot see.
- **`web/scripts/class-gate.config.mjs`:** the ImageUploader entries were widened, not replaced, so `scripts/tailwind-classes.test.ts` (outside the plan) passes unchanged. A test in `PhotoTile.test.tsx` pins that the grip is the only element with a reveal token.

**Total deviations:** 3 auto-fixed (2 blocking, 1 docs), 3 gap fills parked. **Impact:** none on the plan's goal.

## Known Stubs

None. The `PhotoTile` stub in the Task 1 RED commit was replaced in the next commit.

## Threat Flags

None. T-09-24: file names appear only in text nodes and in `aria-label` and `title` attributes (React escapes them), and a test renders a 200-character name. T-09-25: previews are props only, with no storage API and no object URL (a test spies on `URL.createObjectURL`). T-09-SC: no package added or bumped (`git diff --stat` on `package.json` and the lock file is empty).

## Notes for later plans

- Plans 09-16, 09-21, 09-23, 09-27 and 09-29 map the server's photo to `PhotoTileModel`: `thumb` is the tile-slot delivery (`src`, `srcSet`, `sizes`, `width`, `height`); `description` is the custom or default text (the caller works out "Order {number} photo {n}" or "New order photo {n}"); a draft passes its `data:` `preview`, or `previewPending` while it is made, or `previewUnavailable` for a file the browser cannot draw.
- The caller counts the limit: `photos` must include waiting, uploading and failed files, and `limitNote` is shown once `photos.length >= max`. The caller filters picks (09-03), builds `pickErrors` with the server's own wording, and passes `leftOutCount`.
- Move and Make Cover both arrive as `onMove(id, toIndex)` and `onMakeCover(id)`. "Move left" on position 2 makes a new cover, so the caller's announcement must say so (UI-SPEC Announcements).
- After a delete, call `addControlRef.current?.focus()` when no photo is left to take focus.
- Plan 09-30 should screenshot the photo list at 320 px. The two touch buttons wrap onto two rows below roughly 318 px inside the card (parked item 4).

## Deferred Issues

None from this plan. The two @a11y-rulings D-02 first-load timeouts passed when re-run alone.

## Self-Check: PASSED

- FOUND: `web/src/components/media/PhotoTile.tsx`, `PhotoTile.test.tsx`, `photoTile.types.ts`, `web/src/dev/scenarios/groups/media.test.tsx`
- FOUND commits: `42f1b373`, `76044e02`, `8aa3572a`, `de15de91`, `80b92b8c`, `26709b41` (all ancestors of HEAD)

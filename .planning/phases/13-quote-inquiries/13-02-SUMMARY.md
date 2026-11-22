---
phase: 13-quote-inquiries
plan: 02
subsystem: ui
tags: [react, file-picker, image-preview, cwe-434, tdd, a11y]
created: "2026-11-22T16:30:00-06:00"
updated: "2026-11-22T16:30:00-06:00"

requires:
  - phase: 09-order-images
    provides: media.recipe looks, sniffImageType, P9 preview size, OrderPhotoPicker rules
provides:
  - QuotePhotoPicker (UI-SPEC Q2) with previews, Remove, refusals and focus rules
  - QUOTE_PHOTO_RULES and checkQuotePhotos, the client mirror of the server photo rules
  - cleanFileName, sizeText, fileSizeText and previewImage in @/utils/images
  - phoneE164 and isMobileE164 in @/utils/phone
  - Note icon triangle-alert (warning icon, ink text)
affects: [13-09, 13-12, 13-quote-form]

actuals:
  tokens: 16900
  tasks: 2
  commits: 4
plan_head_before: 4007cc6132a44baa4997cc37433b37b24fb7695a
plan_head_after: 6340f2b8014860dd76f2f2f8945206cd9f4e4637

tech-stack:
  added: []
  patterns:
    - "Public code imports shared helpers from @/utils, never an admin module; the admin module re-exports the moved names"
    - "Previews are data: URLs drawn one file at a time; the picked File is handed on untouched"

key-files:
  created:
    - web/src/modules/public/components/QuotePhotoPicker.tsx
    - web/src/modules/public/components/QuotePhotoPicker.test.tsx
    - web/src/modules/public/components/quoteForm.recipe.ts
    - web/src/modules/public/quotePhotos.ts
    - web/src/modules/public/quotePhotos.test.ts
    - web/src/utils/phone.ts
    - web/src/utils/phone.test.ts
  modified:
    - web/src/utils/images.ts
    - web/src/utils/images.test.ts
    - web/src/modules/admin/orderPhotosSchemas.ts
    - web/src/modules/admin/orderPhotosSchemas.test.ts
    - web/src/modules/admin/siteContentSchemas.ts
    - web/src/modules/public/copy.ts
    - web/src/components/states/Note.tsx
    - web/src/components/states/Note.test.tsx
    - web/src/components/states/states.recipe.ts

key-decisions:
  - "checkQuotePhotos checks type, then size, then count; a refused file never uses up a place, and a valid file past the limit is only counted in the count line"
  - "The picker is controlled with plain File objects (photos: readonly File[]); previews are kept inside the picker in a Map keyed by File"
  - "handleRef.clearErrors() is how the form clears the pick-error box on submit (plan 13-12 calls it)"

patterns-established:
  - "Moved helpers keep their old import path through a re-export, so no admin file changes"

requirements-completed: [INQ-02]

coverage:
  - id: D1
    description: "A visitor picks photos and sees a 64px data: preview row per photo with the cleaned name, size, Remove button and the count line; the File handed on is the one picked"
    requirement: INQ-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/QuotePhotoPicker.test.tsx#QuotePhotoPicker (tracer)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Wrong type (read from first bytes), over 10 MB, over 5 photos and unreadable files are refused in the browser with the server's words; accepted files of the same pick are kept; the box clears on the next pick and on submit"
    requirement: INQ-02
    verification:
      - kind: unit
        ref: "web/src/modules/public/quotePhotos.test.ts#checkQuotePhotos"
        status: pass
      - kind: unit
        ref: "web/src/modules/public/components/QuotePhotoPicker.test.tsx#QuotePhotoPicker refused picks (D-02, D-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Keyboard order, focus after Remove, limit Note and zero axe violations in jsdom"
    requirement: INQ-02
    verification:
      - kind: automated_ui
        ref: "web/src/modules/public/components/QuotePhotoPicker.test.tsx#QuotePhotoPicker keyboard and focus (UI Q2 a11y)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real-device behavior: the camera and gallery buttons on a phone, the drop zone with a mouse, preview drawing of a real photo and the no-preview icon for HEIC in a desktop browser"
    verification: []
    human_judgment: true
    rationale: "jsdom has no CSS, no canvas and no hover media query, so the hover versus touch split and a real image draw cannot be proven by the unit tests; plan 13-12 puts the picker in the page where it can be checked end to end"

duration: 24min
completed: 2026-11-22
status: complete
---

# Phase 13 Plan 02: Quote photo picker Summary

**A public photo picker that takes up to 5 photos, shows each as a 64px data: preview row with name, size and Remove, and refuses wrong, oversized and extra files in the browser with the server's own words, never touching the file.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-11-22T22:05:00Z
- **Completed:** 2026-11-22T22:29:00Z
- **Tasks:** 2 (tracer, then auto)
- **Files modified:** 16 (7 new)

## Accomplishments

- `QuotePhotoPicker` (Q2): drop zone with "browse" on hover devices, "Take Photo" and "Choose Photos" where hover is none, rows with preview, name, size and Remove, the "{n} of 5 photos" line, the limit Note at 5, and the focus rules after Remove.
- `checkQuotePhotos` mirrors the server (CWE-434): type from the first bytes, 10,485,760 bytes taken and one more refused, count line in the singular and plural, an unreadable file named. Every string is in `PUBLIC_COPY.contact.photos`.
- `cleanFileName` and `sizeText` moved to `@/utils/images`, `phoneE164` moved to `@/utils/phone` (with `isMobileE164` added). The admin modules re-export them, so no admin import changed and public code never imports an admin module.
- `Note` takes `triangle-alert`: warning-coloured icon, ink text.

## Task Commits

1. **Task 1 (tracer): a photo is picked, previewed and removed**
   - RED `44425402` (test): 40 failing tests across 3 files
   - GREEN `97b18e31` (feat)
2. **Task 2: refusals, pick-error box, Note warning icon**
   - RED `32fe9b14` (test): 26 failing tests across 3 files
   - GREEN `6340f2b8` (feat)

**Plan metadata:** the commit that adds this file (docs).

Tracer gate: auto mode is off and the tracer verify is automated only, so it was re-run after the GREEN commit (picker, images, orderPhotosSchemas, phone and siteContentSchemas tests plus typecheck, all green) and expansion went on.

## TDD Gate Compliance

RED, GREEN and no REFACTOR per task; each `test(13-02)` commit precedes its `feat(13-02)` commit.

- **Task 1 RED evidence:** `gsd check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`) for `QuotePhotoPicker.test.tsx > hands on the very File the input gave`. It failed with `No gallery input`: the stub picker renders nothing. Semantic assessment: the target ran and failed because the picker did not exist yet, which is the planned gap. Before GREEN the other 39 failures were assertion failures from empty stubs (`cleanFileName` returning an empty string and so on).
- **Task 2 RED evidence:** `RED_EVIDENCE_OK` for `quotePhotos.test.ts > says it in the singular for one left out`, failing with `AssertionError: expected [] to have a length of 1 but got +0` (the check was an empty stub).
- The RED commits carry empty stubs for new modules so the tests fail on behavior rather than on a missing import.
- The first TAP run of the whole tracer set was classed `INVALID_RED` only because testing-library failure messages span several lines and break the TAP parse. The single-test rerun above is the evidence that counts.
- Task 2 RED: the picker tests for the add area, limit Note, touch buttons, drop, disabled and keyboard focus already passed, because the Task 1 picker already had them. Only the refusal, pick-error box, clear-on-submit, `checkQuotePhotos` and Note warning cases were red (26 tests).

## Verification

- `npm --prefix web run test -- --run` over picker, quotePhotos, Note, components index, images, phone, orderPhotosSchemas, siteContentSchemas, no-long-dash and source-layout: 10 files, 589 tests passed.
- `npm --prefix web run typecheck`: exit 0.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output.
- `node web/scripts/class-gate.mjs`: no findings. `prettier --check` on the touched folders: clean.
- Acceptance greps: `export function cleanFileName` in images.ts is 1, `@/utils/images` in the picker is 1, `isn't a photo we can take` in copy.ts is 1, `triangle-alert` in Note.tsx is 3. All meet the plan's baselines.
- The existing admin tests (OrderPhotoPicker, OrderPhotosCard, orderPhotosSchemas, siteContentSchemas incl. the shared phone cases) pass unchanged against the re-exports.

## Decisions Made

- The picker takes `photos: readonly File[]` and keeps previews in its own Map, so the form (plan 13-12) holds only the Files it will send.
- Row keys are index plus name, because the same file name can be picked twice and a File has no id.
- A refused file does not use up a place, so a bad file never causes a good one to be reported as "not added".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two helpers the plan did not list were added to `@/utils/images`**
- **Found during:** Task 1
- **Issue:** the plan shows the size as "2.4 MB" but `sizeText` must stay unchanged (whole MB, as the server writes the limit); and drawing a preview needed a decode-draw-close function that never re-encodes.
- **Fix:** added `fileSizeText` (one decimal MB) and `previewImage` (decode, draw at the 176px P9 size, close; null for HEIC or a huge photo). Both have tests.
- **Files modified:** web/src/utils/images.ts, web/src/utils/images.test.ts
- **Committed in:** 44425402 (tests), 97b18e31 (code)

**2. [Rule 2 - Missing critical] `PHONE_INPUT_MAX` moved with `phoneE164`**
- **Found during:** Task 1
- **Issue:** `phoneE164` reads this constant, so leaving it in the admin module would make `@/utils/phone` import an admin module.
- **Fix:** moved it to `@/utils/phone` and re-exported it from `siteContentSchemas.ts`.
- **Committed in:** 97b18e31

**3. [Rule 2 - Missing critical] Added `handleRef` with `clearErrors()` to the picker**
- **Found during:** Task 2
- **Issue:** UI-SPEC says the pick-error box clears "on submit", but the plan's props (`photos`, `onChange`, `rules`, `disabled`) give the form no way to do it.
- **Fix:** optional `handleRef` exposing `clearErrors()`; plan 13-12 should call it on submit. Tested.
- **Committed in:** 32fe9b14 (test), 6340f2b8 (code)

**4. [Rule 3 - Blocking] Plan rules that could not be followed as written**
- The plan's executor rules say to stay on `gsd/phase-13-quote-inquiries` and end commits with `Claude Opus 5.5`. This ran in an isolated worktree branch, so that branch was kept, and the commit trailer follows the system attribution (`Claude Sonnet 5.5`).
- The harness blocked writes to the shared git directory, so the spawn-toplevel sentinel and the plan-head ledger file were not written. The cwd was checked by hand before each commit and `commits` is measured from the known base SHA `4007cc61`.
- `web/node_modules` in the worktree is a junction to the main checkout's installed packages (git-ignored, nothing added or bumped) so tests could run.

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing critical) plus 1 environment note
**Impact on plan:** all additions are small and needed; no scope creep, no package change.

## Issues Encountered

None that remain. No flaky tests seen; each failing run during RED was an intended failure.

## Known Stubs

None. The RED stubs were replaced in the GREEN commits.

## Threat Flags

None. The picker adds no network call and no new surface. T-13-04 (type by first bytes), T-13-05 (no preview over 10 MB, one at a time at 176px, and `previewImage` also skips a photo over 100 megapixels) and T-13-06 (`data:` previews only, `createObjectURL` never called, asserted in a test) are mitigated; T-13-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 13-12 can put `QuotePhotoPicker` in the form: pass `photos`, `onChange`, `disabled` while sending, and a `handleRef` to call `clearErrors()` on submit. The files are the originals, ready to send as they are.
- Plan 13-09 can import `phoneE164` and `isMobileE164` from `@/utils/phone`.
- The real-device check (phone buttons, a real photo preview, HEIC icon) is open until the picker is on the page (coverage item D4).

## Self-Check: PASSED

- Files found: images.ts, phone.ts, quotePhotos.ts, QuotePhotoPicker.tsx, quoteForm.recipe.ts, quotePhotos.test.ts, QuotePhotoPicker.test.tsx, phone.test.ts.
- Commits found in HEAD ancestry: 44425402, 97b18e31, 32fe9b14, 6340f2b8.

---
*Phase: 13-quote-inquiries*
*Completed: 2026-11-22*

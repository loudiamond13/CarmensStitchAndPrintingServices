---
phase: 09-order-images-maintenance-jobs
plan: 03
subsystem: web
tags: [image-preparation, client-validation, createImageBitmap, canvas, heic, csp]
requires: []
provides:
  - sniffImageType, the byte-signature check for JPEG, PNG, WebP and HEIC
  - planDownscale, the 2000 px long side plan
  - prepareImage, which checks, uprights, shrinks and previews one picked file
  - PrepareRules, PrepareResult, BrowserImageParts, DecodedBitmap and defaultBrowserImageParts
affects: [09-08, 09-16, 09-21]

created: "2026-11-03T07:55:00-06:00"
updated: "2026-11-03T07:55:00-06:00"

actuals:
  tokens: 7000
  tasks: 2
  commits: 4

plan_head_before: 0a7055cd53a4430711a5c6b5a40fea95d20a0398
plan_head_after: a6f85ea015eda21814d664c79fc30005161aac5d
commits: 4

tech-stack:
  added: []
  patterns:
    - "Pure core over an injectable BrowserImageParts seam; the real browser parts are a separate default export"
    - "No module state, so two prepareImage calls at once are independent"
    - "Previews are data: URLs only (the CSP has no blob:)"

key-files:
  created:
    - web/src/utils/images.ts
    - web/src/utils/images.test.ts
  modified: []

key-decisions:
  - "The pixel and side limits are checked on the decoded photo before it is shrunk, so a 6000 x 5000 photo is refused (the plan's test case) rather than shrunk"
  - "An unchanged photo reports the MIME type from its bytes (image/jpeg, image/heic), not the file's own type"
  - "A HEIC the browser cannot decode reports width and height as null (unknown), not 0"
  - "A JPEG result gets a white background first, so a transparent WebP that falls back to JPEG is not black"
  - "The blob type produced by the canvas decides the file extension (jpg, png, webp); a type outside those three is unreadable"

patterns-established:
  - "prepareImage(file, rules, parts = defaultBrowserImageParts): callers pass only the server's image rules"

requirements-completed: []
requirements-advanced: [IMG-05, IMG-02]

coverage:
  - id: D1
    description: "A 4000 x 3000 phone JPEG comes out 2000 x 1500 at quality 0.85, upright, with a data: preview; a 1800 x 1200 JPEG is returned as the same File"
    requirement: "IMG-05"
    verification:
      - kind: unit
        ref: "web/src/utils/images.test.ts#prepareImage > turns a 4000 x 3000 JPEG into a 2000 x 1500 JPEG at quality 0.85 with a preview"
        status: pass
      - kind: unit
        ref: "web/src/utils/images.test.ts#defaultBrowserImageParts > decodes with the photo orientation applied"
        status: pass
    human_judgment: false
  - id: D2
    description: "Files are checked by their bytes: JPEG, PNG, WebP and HEIC are accepted; SVG, GIF, AVIF, BMP and anything else are refused whatever the name or MIME type"
    requirement: "IMG-02"
    verification:
      - kind: unit
        ref: "web/src/utils/images.test.ts#sniffImageType"
        status: pass
      - kind: unit
        ref: "web/src/utils/images.test.ts#prepareImage > refuses an svg named photo.jpg without decoding it"
        status: pass
    human_judgment: false
  - id: D3
    description: "Output types: JPEG and HEIC become JPEG, PNG stays PNG, WebP stays WebP only when the browser made WebP; the produced blob type is checked"
    requirement: "IMG-05"
    verification:
      - kind: unit
        ref: "web/src/utils/images.test.ts#prepareImage > falls back to JPEG when the browser gave a PNG for a WebP request"
        status: pass
    human_judgment: false
  - id: D4
    description: "Size, pixel and unreadable refusals mirror the server; a HEIC the browser cannot decode goes unchanged with no preview when within the size"
    requirement: "IMG-02"
    verification:
      - kind: unit
        ref: "web/src/utils/images.test.ts#prepareImage > sends a heic the browser cannot decode as it is, with no preview, when it is within the size"
        status: pass
      - kind: unit
        ref: "web/src/utils/images.test.ts#prepareImage > refuses a 6000 x 5000 photo over the pixel limit and closes the bitmap"
        status: pass
    human_judgment: false
  - id: D5
    description: "No photo, preview or bytes are written to browser storage"
    requirement: "IMG-05"
    verification:
      - kind: unit
        ref: "web/src/utils/images.test.ts#prepareImage > writes nothing to browser storage"
        status: pass
    human_judgment: true

duration: 15min
completed: 2026-11-03
status: complete
---

# Phase 9 Plan 03: Prepare a photo in the browser before upload Summary

*Created: 2026-11-03T07:55:00-06:00 · Updated: 2026-11-03T07:55:00-06:00*

**`prepareImage` now checks a picked photo by its bytes, turns it upright, shrinks it to a 2000 px long side when larger, refuses what the server would refuse, and makes a 176 px `data:` preview, all in the browser, with no package and no stored copy.**

## Performance

- **Duration:** about 15 min
- **Tasks:** 2 (4 commits: 2 RED, 2 GREEN)
- **Files:** 2 created (`images.ts` 250 lines, `images.test.ts` 468 lines)

## Accomplishments

- `sniffImageType` reads the first 32 bytes. HEIC follows the research rules: `ftyp` at offset 4 with a HEIC brand, or `mif1`/`msf1` only when a compatible brand inside the box size is a HEIC brand. AVIF is refused.
- `prepareImage` runs over an injectable `BrowserImageParts` seam. The default parts use `createImageBitmap(file, { imageOrientation: 'from-image' })`, a canvas with high smoothing and `toBlob`, and a `toDataURL` preview. The bitmap is closed on every path after decode.
- A photo within 2000 px comes back as the same `File` object (D-18). A HEIC the browser cannot decode comes back unchanged with `preview: null` and `previewUnavailable: true` when within the size.
- The module keeps no state and uses no storage API.

## Task Commits

1. **Task 1: a 4000 px phone JPEG comes out 2000 px (tracer)** - `d0b6b93b` (test, RED) then `0f62918a` (feat, GREEN)
2. **Task 2: every type, size and decode case** - `5b8a4a1e` (test, RED) then `a6f85ea0` (feat, GREEN)

## TDD Gate Compliance

Both tasks have a `test(09-03)` commit before the `feat(09-03)` commit. RED evidence came from Vitest's JUnit report (`web/.vitest/junit/output.xml`), checked with `gsd_run check tdd-red-evidence`:

- **Task 1:** target `prepareImage > turns a 4000 x 3000 JPEG into a 2000 x 1500 JPEG at quality 0.85 with a preview` returned `RED_EVIDENCE_OK` (`target_test_failed`). 4 of 5 tests failed. Semantic assessment: the test ran and failed on the planned assertion (`ok` should be true, was false) because the module was an empty shell returning `unreadable`.
- **Task 2:** targets `prepareImage > turns a 3000 x 4000 PNG into a 1500 x 2000 PNG` and `prepareImage > sends a heic the browser cannot decode as it is, with no preview, when it is within the size` both returned `RED_EVIDENCE_OK`. 28 of 53 tests failed on planned assertions (PNG, WebP and HEIC were not sniffed, so they came back as `type` refusals or `null`).
- **Characterization tests (green at RED):** 25 Task 2 tests passed against the shell, mostly refusals the shell gave for free (avif, gif, bmp, unreadable JPEG, size-less checks) and the JPEG cases from Task 1. The preview-throws test was added after GREEN to cover the `previewOf` catch. They are regression tests, not drivers.
- **Skeleton in the RED commits:** each RED commit carries an empty-shell `images.ts` (right exports, wrong results) so the tests fail on assertions, not on a missing module.

## Check results

- `npm --prefix web run test -- --run src/utils/images.test.ts src/test`: `Test Files 11 passed (11)`, `Tests 255 passed (255)`. The `src/test` folder holds the no-long-dash and source-layout rule tests, which pass.
- `images.test.ts` alone: `Tests 54 passed (54)`.
- File coverage (v8): `images.ts` 98.18% statements, 93.9% branches, 100% functions, 100% lines.
- `npm --prefix web run typecheck`: exit 0.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): no output, no warnings.
- `prettier --check` on both files: `All matched files use Prettier code style!`
- Acceptance greps: `imageOrientation` count 1; `createObjectURL` count 0; `localStorage` count 0 (non-comment lines); the test names contain `avif`, `svg` and `heic`.
- `gitleaks protect --staged --no-banner` before each of the 4 commits: `no leaks found`.
- Em dash and en dash count in both files: 0.

## Deviations from Plan

None. The plan was executed as written, with these small choices the plan left open (recorded in `key-decisions`):

- Width and height are `null` for an undecoded HEIC.
- An unchanged photo reports the MIME type from its bytes.
- The pixel and side check happens on the decoded size, before shrinking, which is what the plan's 6000 x 5000 case requires.
- `decodeUpright` is exported separately so the Task 1 tracer carries the real upright decode (the Task 1 acceptance grep needs `imageOrientation` in the file).

## Known Stubs

None.

## Threat Flags

None. T-09-09 (renamed SVG or AVIF) is covered by byte sniffing before any request and by tests for an svg named `photo.jpg` and an avif named `photo.heic`. T-09-10 (bytes left in browser storage) is covered by the no-storage test and by the absence of any storage call. T-09-SC: no package added.

## Notes for later plans

- Plan 09-16 and 09-21 call `prepareImage(file, rules)` and keep the returned `file` (Blob) for "Try Again". Map `reason` to the UI-SPEC messages (`type`, `size`, `pixels`, `unreadable`).
- On a real Android and iPhone, the owner smoke test still has to prove the camera path and that a HEIC photo is handled (RESEARCH Pitfalls 11 and 12). The unit tests use fake browser parts and stubbed canvas calls, so real canvas output (for example Safari WebP encoding) is not covered here.

## Deferred Issues

None from this plan. The two known machine timing flakes in `deferred-items.md` (`ExpenseListTimingTests`, `OrderListTimingTests`) are server tests and were not touched.

## Self-Check: PASSED

- FOUND: `web/src/utils/images.ts`, `web/src/utils/images.test.ts`
- FOUND commits: `d0b6b93b`, `0f62918a`, `5b8a4a1e`, `a6f85ea0` (all ancestors of HEAD)

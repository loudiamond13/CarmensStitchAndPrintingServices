---
phase: 09-order-images-maintenance-jobs
plan: 02
subsystem: api
tags: [image-delivery, cloudinary, named-transformations, srcset, settings-guard]
requires:
  - phase: 09-order-images-maintenance-jobs
    provides: PublicIds shape and the ImageStorage port (plan 09-01)
provides:
  - IImageDelivery port with ForPhoto and ForCover
  - ImageSource, PhotoUrls and CoverUrls records
  - ImageNamedSizes, the catalog of 13 named sizes
  - CloudinaryImageDelivery, a pure address and srcset builder
  - CloudinarySettings with the root-folder guard (CloudinarySettings.Validator) and OrdersPrefix
affects: [09-05, 09-07, 09-13, 09-19, 09-25]

created: "2026-11-03T07:35:00-06:00"
updated: "2026-11-03T07:35:00-06:00"

actuals:
  tokens: 9100
  tasks: 3
  commits: 6

plan_head_before: 53f1c1a2230299ea0a125c6bbea72c114a76c38f
plan_head_after: dcb71b1fde8b4e4a0d2b27f11f21d64191354d69
commits: 6

tech-stack:
  added: []
  patterns:
    - "Delivery addresses are plain strings built from a fixed catalog; no Cloudinary SDK and no network call"
    - "Integer half-up rounding for srcset widths, no floating point"
    - "Settings guard as an internal IValidateOptions class that takes the environment name"

key-files:
  created:
    - src/Csps.Application/Images/ImageSource.cs
    - src/Csps.Application/Ports/IImageDelivery.cs
    - src/Csps.Infrastructure/Images/ImageNamedSizes.cs
    - src/Csps.Infrastructure/Images/CloudinaryImageDelivery.cs
    - src/Csps.Infrastructure/Images/CloudinarySettings.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/CloudinaryImageDeliveryTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/ImageNamedSizesTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/CloudinarySettingsTests.cs
  modified: []

key-decisions:
  - "Square slots (thumbs) drop the 2x candidate when the photo's shorter side is under the 2x box; the 1x candidate always stays"
  - "A card cover is limited by the width of its 16:10 crop (the photo width, or 1.6 x height for a wide photo), not just the photo width"
  - "Fallback src: viewer uses the 960 candidate, card uses the 640 candidate, otherwise the largest candidate listed"
  - "A host with no Cloudinary setting at all passes the guard; any setting given needs a valid root folder"

patterns-established:
  - "The 13 names live once in ImageNamedSizes; delivery and the later setup command both read it"

requirements-completed: []
requirements-advanced: [IMG-03, IMG-04]

coverage:
  - id: D1
    description: "A stored photo gets a private, named-size, /v1/ address for its tile thumb with a 1x and a 2x candidate"
    requirement: "IMG-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/CloudinaryImageDeliveryTests.cs#TheTileThumbIsThePrivateNamedSizeAddressWithATwoTimesCandidate"
        status: pass
    human_judgment: false
  - id: D2
    description: "Viewer and card candidates carry true widths, are ascending and unique, and are never wider than the photo; a smaller photo gets one candidate per slot"
    requirement: "IMG-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/CloudinaryImageDeliveryTests.cs#EveryAddressIsPrivateAndNamedAndEveryWidthIsAscendingUniqueAndNoWiderThanThePhoto"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/CloudinaryImageDeliveryTests.cs#APhotoSmallerThanEveryCandidateGetsOneCandidatePerSlotAtItsOwnSizeNeverAnUpscale"
        status: pass
    human_judgment: false
  - id: D3
    description: "The catalog has exactly the 13 agreed names, none with f_auto, display sizes in WebP and the full size in JPEG"
    requirement: "IMG-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/ImageNamedSizesTests.cs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Production accepts only the csps folder and every other environment refuses it; folder and cloud name are lowercase letters, digits and hyphens; OrdersPrefix ends in a slash"
    requirement: "IMG-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/CloudinarySettingsTests.cs"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-03
status: complete
---

# Phase 9 Plan 02: Named sizes and delivery addresses Summary

*Created: 2026-11-03T07:35:00-06:00 · Updated: 2026-11-03T07:35:00-06:00*

**A stored photo (public id, width, height) now turns into private, named-size `/v1/` addresses for every display slot, built only from the 13 allowed sizes with true-width candidates that never pass the photo's size, plus a settings guard that keeps `csps` for Production and `csps-dev` for everything else.**

## Performance

- **Duration:** about 25 min
- **Tasks:** 3 (6 commits: 3 RED, 3 GREEN)
- **Files:** 8 created, none modified (786 lines added)

## Accomplishments

- `IImageDelivery.ForPhoto` and `ForCover` return thumb, viewer, full size, card and table addresses. No Cloudinary call, no package.
- Every address is `https://res.cloudinary.com/{cloud}/image/private/t_{name}/v1/{publicId}`. The sweep test checks the shape and that the name is in the catalog for nine photo sizes, including portrait, 1 x 3200, 3200 x 1 and a 30 x 20 thumbnail-sized photo.
- Viewer widths round half away from zero in integer math (a 3 x 768 photo gives 3, not the banker's 2). Widths that collapse to the same number are listed once and never below 1.
- The settings guard refuses `csps-dev` in Production and `csps` anywhere else, and its messages never repeat a key, secret or value.

## Task Commits

1. **Task 1: thumb address (tracer)** - `94e680d7` (test, RED) then `d4b70496` (feat, GREEN)
2. **Task 2: true-width candidates for every slot** - `e8bea137` (test, RED) then `bd7fa715` (feat, GREEN)
3. **Task 3: development and live folders apart** - `eb680613` (test, RED) then `dcb71b1f` (feat, GREEN)

## TDD Gate Compliance

All three tasks have a `test(09-02)` commit before the `feat(09-02)` commit. RED evidence came from the xUnit v3 runner's own JUnit report (`-junit`), checked with `gsd_run check tdd-red-evidence`:

- **Task 1:** `CloudinaryImageDeliveryTests.TheTileThumbIsThePrivateNamedSizeAddressWithATwoTimesCandidate` returned `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: the test ran and failed on the planned assertion (`thumb.Src` should be the `csps_sq_88` address but was empty) because the compile shell returned empty strings.
- **Task 2:** `APortraitPhotoReportsTheTrueWidthOfEachViewerSize` and `FullSizeIsTheTwoThousandPixelJpegAddress` both returned `RED_EVIDENCE_OK`. 22 of 45 tests failed on planned assertions (empty viewer, card and full size from the shell).
- **Task 3:** `CloudinarySettingsTests.ProductionRefusesAnyFolderButCsps` returned `RED_EVIDENCE_OK`. 24 of 34 tests failed on planned assertions (shell validator always succeeded; shell `OrdersPrefix` and `IsConfigured` were wrong).
- **Characterization tests (green at RED):** the guard tests for a bad public id, a non-positive size and a missing cloud name (in `CloudinaryImageDeliveryTests`) and most of `ImageNamedSizesTests` were green when written, because the catalog and the input guard were already written for Task 1's GREEN. They are regression tests, not drivers of the code. The guard code was written one step ahead of its tests.
- **REFACTOR:** none.

## Check results (seen in this session, `CSPS_TEST_SQL=localdb`)

| Check | Result |
|---|---|
| `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinaryImageDeliveryTests" --filter-class "*ImageNamedSizesTests" --filter-class "*CloudinarySettingsTests"` | `total: 79  failed: 0  succeeded: 79` |
| `tests/Csps.Infrastructure.IntegrationTests` (whole project) | `total: 846  failed: 0  succeeded: 845  skipped: 1` (the skipped one is `HibpLiveTests`, skipped by the suite itself) |
| `tests/Csps.ArchitectureTests` | `total: 242  failed: 0  succeeded: 242` |
| `dotnet build Csps.slnx --no-incremental` | `0 Warning(s)  0 Error(s)` |
| `dotnet format Csps.slnx --verify-no-changes` | exit 0, no output |
| `grep -ci f_auto src/Csps.Infrastructure/Images/ImageNamedSizes.cs` | `0` |
| `grep -c "/image/private/" .../CloudinaryImageDelivery.cs` | `2` |
| `grep -c csps_full_2000 .../ImageNamedSizes.cs` | `1` |
| `grep -c OrdersPrefix .../CloudinarySettings.cs` | `1` |
| `gitleaks protect --staged --no-banner` (each of 6 commits) | `no leaks found` |

Tracer gate (Task 1): the task has no `blocking-human` gate. Its `<verify>` was re-run after the commit (`1 of 1` green) before the expansion tasks, and again at the end of the plan (79 of 79).

## Decisions Made (planner assumptions, flagged for the owner)

These fill gaps the plan left (the plan marks the edge rules as planner assumptions). Nothing here changes security, cost or wording a visitor sees.

1. **Fallback `src` per slot:** viewer uses the 960 candidate, card uses the 640 candidate; if that one is not listed (small photo), the largest candidate listed. Thumbs and table use the 1x address.
2. **Wide photos:** a card cover is limited by its 16:10 crop width, `min(photo width, 1.6 x photo height)`, so a 1000 x 300 panorama gets 320w and 480w only (a 640w would stretch). The plan said "not wider than the original"; this is stricter and fits the "never an upscale" truth.
3. **Square slots:** the 2x candidate is dropped when the photo's shorter side is under the 2x box (a 150 x 100 photo gets only the 88 address at 1x). The 1x address always stays.
4. **Small photos on a fill slot:** the smallest card size is kept and its `w` descriptor shows the photo's own crop width (30w for a 30 x 20 photo). Cloudinary still delivers that named size at its full box, since a named size cannot shrink; the descriptor only tells the browser the truth about detail.
5. **Guard when nothing is set:** a host with no Cloudinary setting at all passes the validator, so it starts and the upload answers 503 (09-01 behavior). Any setting given needs a valid folder, and an empty folder with keys given is refused.
6. **Failure wording written by me:** `Cloudinary:RootFolder may use lowercase letters, digits and hyphens only.`, `Cloudinary:CloudName may use lowercase letters, digits and hyphens only.` and `Cloudinary:RootFolder must be set. Use csps-dev outside Production.` The plan gave the other two messages. These go to the host log at start, not to visitors.
7. **Public id check:** lowercase letters, digits and hyphens in slash-separated folders (`^[a-z0-9-]+(/[a-z0-9-]+)*$`). The plan's example id (`csps/orders/0b0f/abcdefghijklmnopqrstuvwxyz`) is not a real order GUID, so the check does not demand the GUID form. Anything else throws `ArgumentException`.
8. **Missing cloud name:** `ForPhoto` and `ForCover` throw `InvalidOperationException` rather than build addresses with an empty host part. Plan 09-07 decides when delivery is registered.

## Deviations from Plan

### Auto-fixed Issues

None.

### Notes

- The `CloudinarySettings.Validator` is an `internal sealed` class with a public-looking constructor taking the environment name, as the plan says; `Csps.Infrastructure.IntegrationTests` sees it through the existing `InternalsVisibleTo`.
- The plan's file list was followed exactly; no file outside it was touched.

### Auth gates

None.

## Deferred Issues

- No DI registration, as planned. Plan 09-07 registers `IImageDelivery` and the validator with `ValidateOnStart`.
- Coverage: the three small records in `ImageSource.cs` are exercised by Infrastructure tests only; the Application project's own coverage run (target 95%) was not run in this plan. They hold no logic.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-09-06 (only catalog names are emitted, no `f_auto`, no unsized original), T-09-07 (root-folder guard, both directions tested) and T-09-SC (no package added) are covered by tests above. T-09-08 is accepted as planned.

## Self-Check

## Self-Check: PASSED

All eight created files exist on disk. Commits `94e680d7`, `d4b70496`, `e8bea137`, `bd7fa715`, `eb680613` and `dcb71b1f` are ancestors of HEAD (verified below).

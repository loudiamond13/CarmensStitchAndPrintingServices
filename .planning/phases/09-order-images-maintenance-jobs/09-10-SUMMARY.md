---
phase: 09-order-images-maintenance-jobs
plan: 10
subsystem: api
tags: [order-images, image-sniffer, png, webp, heic, avif, hostile-input, tdd]
status: complete

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-01 (JPEG sniffer, ImageFacts, SyntheticImages), 09-05 (ImageInspection size rules)
provides:
  - ImageSniffer reads PNG, WebP (VP8, VP8L, VP8X) and HEIC (ispe size, irot turn) besides JPEG, with one bounded ChunkReader
  - AVIF, animated WebP, SVG, GIF, BMP, TIFF and every damaged or hostile file give no answer (the 400 type message)
  - SyntheticImages builders for PNG, WebP, HEIC, AVIF, GIF, BMP, TIFF, boxes, truncation and a looping box
affects: [09-14, 09-16, 09-19, 09-27]

created: "2026-11-03T16:45:00-06:00"
updated: "2026-11-03T16:45:00-06:00"

actuals:
  tokens: 70000
  tasks: 3
  commits: 6

plan_head_before: a1d18a3d28a836800e1be90444bb3df42b877a05
plan_head_after: cd337a426638b04840b8f7cb363df772a7d243e9
commits: 6

tech-stack:
  added: []
  patterns:
    - "One ref-struct ChunkReader (layouts Png, WebP, Box) checks every length against the span and stops after 512 entries; no recursion, no allocation per box"
    - "HEIC irot quarter turns map to Exif orientations 1, 6, 3, 8 so ImageInspection's existing swap stores the upright size unchanged"

key-files:
  created:
    - tests/Csps.Server.IntegrationTests/Orders/OrderImageTypesTests.cs
  modified:
    - src/Csps.Application/Images/ImageSniffer.cs
    - tests/Csps.Testing/Images/SyntheticImages.cs
    - tests/Csps.Application.UnitTests/Images/ImageSnifferTests.cs
    - tests/Csps.Application.UnitTests/Csps.Application.UnitTests.csproj

key-decisions:
  - "ImageFacts.cs and ImageInspection.cs are unchanged (the plan listed ImageFacts, but its Orientation already carried what was needed)"
---

# Phase 9 Plan 10: Every photo type the shop uses is recognized; everything else is refused Summary

*Created: 2026-11-03T16:45:00-06:00 · Updated: 2026-11-03T16:45:00-06:00*

**The server now tells JPEG, PNG, WebP and HEIC apart by their bytes alone, stores the upright size, and refuses AVIF, animated WebP, SVG, GIF, BMP, TIFF and hostile files without an exception.**

## What was built

- **PNG:** signature, then the IHDR size. The file counts only when every chunk up to the first IDAT fits inside the file.
- **WebP:** VP8 (lossy), VP8L (lossless) and VP8X (canvas size). The animation flag, an ANIM chunk or an ANMF chunk refuses the file.
- **HEIC:** ftyp brands (heic, heix, hevc, hevx, heim, heis; mif1 and msf1 count only beside one of those; any avif or avis brand refuses). Then meta, pitm, iprp, ipma and ipco to find the primary item's ispe size and irot turn. An irot of 1, 2 or 3 maps to Exif orientation 6, 3 or 8. An Exif item inside a HEIC is ignored.
- **Safety:** one `ChunkReader` for all container formats: every length is checked against what is left, a wrong length ends the walk, at most 512 entries are read, and the item list is read at most 4,096 entries deep. No pixel is decoded and no package was added.
- **Tests:** 112 sniffer and inspection tests, 16 new endpoint tests in `OrderImageTypesTests`.

## Tasks and commits

| Task | RED | GREEN |
| ---- | --- | ----- |
| 1 PNG (tracer) | df46e332 | 746fcb4e |
| 2 WebP, HEIC, AVIF, animated | 64bbbfef | ad3b053f |
| 3 Hostile files | f1877954 | cd337a42 |

## Checks seen

- RED seen before each GREEN: Task 1 `failed: 2` (unit) and `failed: 3` (endpoint); Task 2 `failed: 25` (unit) and `failed: 7` (endpoint); Task 3 `failed: 9` (unit).
- `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageSnifferTests" --filter-class "*ImageInspectionTests"`: total 112, failed 0.
- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImageTypesTests" --filter-class "*OrderImagesEndpointTests"`: total 36, failed 0.
- Whole `Csps.Application.UnitTests`: total 2045, failed 0. `Csps.ArchitectureTests`: total 263, failed 0.
- `dotnet build --no-incremental` of the unit and integration test projects: 0 Warning(s), 0 Error(s).
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- Coverage of `ImageSniffer.cs` (coverlet.MTP, Images tests only): line 99.3%, branch 98.3% (Application target 95%).
- Acceptance greps: `IHDR` in the sniffer 2, `irot` 3, `System.Random` in the sniffer tests 0. Test names include Avif, Animated and Seeded.
- `gitleaks protect --staged`: no leaks found on every commit. `netstat` showed ports 5180, 5115, 7028 and 5199 free; the integration tests run in-process on a `CSPS_Test_` database and open no port.

## Deviations from Plan

**1. [Rule 3 - Blocking] Sniffer unit tests share `SyntheticImages.cs` by a linked source file.** The Application unit test project does not reference `Csps.Testing` (it pulls in the whole Server), so `tests/Csps.Application.UnitTests/Csps.Application.UnitTests.csproj` got one `<Compile Include=... Link=...>` line. No package or lock file changed. Commit df46e332.

**2. [Rule 3 - Blocking] The preflight script could not be run.** The sandbox refused `powershell` and `pwsh` from this worktree. I checked the four ports with `netstat` instead (all free). The integration tests open no port.

**3. TDD note.** In Task 3, tests for size 0, wrong size, looping and nesting boxes, truncation, the 50 ms limit and the seeded runs already passed at RED because Task 2's reads were bounds-checked as they were written. The caps, the PNG chunk walk and the item cap were the real RED failures. One RED test (every cut of a PNG) was too strict: a PNG cut after its first whole IDAT is accepted by design. I corrected the test in the GREEN commit.

**4. Scope.** `ImageFacts.cs` needed no change, and `ImageInspection.cs` is unchanged as the plan required.

**5. Mapping choice, as the plan states it.** irot 1 maps to Exif 6 and irot 3 to Exif 8. Only the width and height swap matters for the stored size. If the Exif number is ever used for display, check the direction against the HEIC standard first.

## Known limits (not defects)

- A file cut off after the header (inside a PNG's later chunks, WebP image data or the HEIC mdat) is accepted: only the header is read, never the pixels. Cloudinary is the second guard (plan 09-19).
- The two long hostile-input tests rely on wall-clock time (50 ms per file). The first call is warmed up. If they ever fail under load, re-run alone before recording a flake.

## Known Stubs

None.

## Threat Flags

None. The threats T-09-13, T-09-14, T-09-15 are mitigated by brand and animation rules, caps and the 2,000 seeded inputs. T-09-SC: no package added.

## Owner backlog items (for the orchestrator to copy into STATE.md)

- [ ] Check the direction of the HEIC turn mapping (irot 1 as Exif 6, irot 3 as Exif 8, per the plan text). Today only the swap of width and height uses it, and that is correct either way. Nothing is needed unless a later plan shows the number to users. Recommendation: no action now.
- [ ] The sandbox blocked `preflight.ps1` from the worktree. Not blocking (the ports were free by `netstat`), but the orchestrator may want to run it from the main session before any end-to-end run.

## Self-Check: PASSED

- Files found: `src/Csps.Application/Images/ImageSniffer.cs`, `tests/Csps.Testing/Images/SyntheticImages.cs`, `tests/Csps.Application.UnitTests/Images/ImageSnifferTests.cs`, `tests/Csps.Server.IntegrationTests/Orders/OrderImageTypesTests.cs`.
- Commits found in HEAD: df46e332, 746fcb4e, 64bbbfef, ad3b053f, f1877954, cd337a42.

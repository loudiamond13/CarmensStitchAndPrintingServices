---
phase: 09-order-images-maintenance-jobs
plan: 15
subsystem: api
tags: [order-images, metadata-stripper, exif, gps, jpeg, png, webp, heic, privacy, tdd]
status: complete

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-10 (ImageSniffer, ChunkReader layouts, SyntheticImages), 09-05 (ImageInspection), 09-01 (upload handler)
provides:
  - ImageMetadataStripper.Strip(kind, bytes, fileName) for JPEG, PNG, WebP and HEIC, returning Result<byte[]> (images.type on refusal)
  - Upload handler strips after inspection and before IImageStorage.UploadAsync; the stored Bytes is the cleaned length
  - Shared internal ChunkReader (own file) with entry positions and an AtEnd check
  - SyntheticImages metadata variants for all four kinds plus iinf, infe and iloc builders
affects: [09-19, 09-30]

created: "2026-11-03T17:58:00-06:00"
updated: "2026-11-03T17:58:00-06:00"

actuals:
  tokens: 26750
  tasks: 3
  commits: 8

plan_head_before: f27ee1493070e68ed51238211092f8ae5f4e9fd9
plan_head_after: c74b41d5c763b692569f071b5ee9158e4046ec2e
commits: 8

tech-stack:
  added: []
  patterns:
    - "Byte-level strip with no decoding: keep lists per format, one pre-sized output buffer, every offset checked, loops capped"
    - "Postcondition inside Strip: the cleaned bytes must sniff to the same kind, size and orientation as the input, or the file is refused"
    - "HEIC wipe in place: zero the Exif and XMP item bytes found through iinf and iloc, so no length or offset changes"

key-files:
  created:
    - src/Csps.Application/Images/ImageMetadataStripper.cs
    - src/Csps.Application/Images/ImageMetadataStripper.Heic.cs
    - src/Csps.Application/Images/ChunkReader.cs
    - tests/Csps.Application.UnitTests/Images/ImageMetadataStripperTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderImageMetadataTests.cs
  modified:
    - src/Csps.Application/Images/ImageSniffer.cs
    - src/Csps.Application/Orders/UploadOrderImageHandler.cs
    - tests/Csps.Testing/Images/SyntheticImages.cs

key-decisions:
  - "A file that is cut off (JPEG without EOI, PNG without IEND, WebP whose chunks do not fill the RIFF size) is refused with the type message; the sniffer alone used to accept some of these"
  - "A HEIC metadata item that has no iloc entry has no bytes in the file, so there is nothing to wipe and the file passes unchanged"
---

# Phase 9 Plan 15: Location and camera data never reach Cloudinary Summary

*Created: 2026-11-03T17:58:00-06:00 · Updated: 2026-11-03T17:58:00-06:00*

**Every photo is cleaned on the server before storage sees it: no GPS, camera make, model, serial, owner, date taken, XMP or IPTC data leaves for Cloudinary, the picture bytes are untouched, and a phone photo that was not downscaled still keeps its turn.**

## What was built

- **JPEG:** drops Exif, XMP, XMP extension, APP13, comments, every other APPn except APP0, the ICC profile (APP2) and APP14, and everything after the first EOI (multi-picture data). Tables, frame, scans and scan bytes (stuffed bytes, restart markers, fill) are copied as they are. When the Exif orientation is not 1, a new 36-byte Exif block holding only Orientation is written before the first kept segment that is not APP0. Orientation 1 leaves no Exif at all.
- **PNG:** keeps IHDR, PLTE, IDAT, IEND, tRNS, gAMA, cHRM, sRGB, iCCP, sBIT and pHYs whole (checksums included). Text, Exif, time, unknown ancillary chunks and bytes after IEND go. An unknown critical chunk, or a file with no IEND, is refused.
- **WebP:** drops EXIF and 'XMP ' chunks, clears the two flag bits in VP8X, pads chunks to even length and writes the RIFF size again. Bytes after the RIFF size go. A chunk list that does not fill the RIFF size is refused.
- **HEIC:** finds Exif items and mime items with the content type application/rdf+xml through iinf (infe versions 0 to 3), finds their bytes through iloc (versions 0 to 2, construction method 0 into an mdat box or method 1 into the idat box) and sets those bytes to zero in a copy. Length and offsets do not change; irot and imir stay. Refused: construction method 2, data in another file, no length field, bytes outside the data boxes, bytes shared with any other item, a damaged box, a second iinf, iloc or idat, and more than 4,096 entries.
- **Handler:** the strip step sits right after inspection. A strip failure answers 400 with the type message naming the file; nothing is uploaded and no row is saved.
- **Safety net:** `Strip` re-reads its own output with the sniffer. If the kind, size or orientation differs from the input, the file is refused.
- **Refactor:** the bounded `ChunkReader` moved out of `ImageSniffer` into its own internal file and now also reports where an entry sits and whether the whole span was read, so the stripper and sniffer share one reader.

## Tasks and commits

| Task | RED | GREEN |
| ---- | --- | ----- |
| 1 JPEG (tracer) | 278dbea5 | 861a498d |
| refactor: shared chunk reader | | 364d4e00 |
| 2 PNG and WebP | 8121f122 | 99e0f06e |
| 3 HEIC and idempotency | 797c82dd | 635cd8e2 |
| hostile and unusual-file tests | c74b41d5 | |

## Checks seen

- **Tracer gate (task 1):** `⚡ Tracer verified end-to-end — expanding`. Unit class: total 10, failed 0. Endpoint classes `OrderImageMetadataTests`, `OrderImagesEndpointTests`, `OrderImageDeliveryTests`: total 24, failed 0.
- **RED seen before each GREEN:** task 1 unit `failed: 4` of 10 and endpoint `failed: 1` of 1; task 2 unit `failed: 8` of 22 and endpoint `failed: 2` of 3; task 3 unit `failed: 18` of 61 and endpoint `failed: 2` of 6.
- `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageMetadataStripperTests"`: total 71, failed 0.
- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Image*"` (all image endpoint classes, including `OrderImageMetadataTests` and `OrderImageTypesTests`): total 55, failed 0.
- Whole `Csps.Application.UnitTests`: total 2124, failed 0. `Csps.ArchitectureTests`: total 263, failed 0.
- `dotnet build --no-incremental` of `Csps.Application.UnitTests` and `Csps.Server.IntegrationTests`: 0 Warning(s), 0 Error(s). `dotnet build src/Csps.Application --no-incremental`: 0 Warning(s), 0 Error(s).
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- Coverage (coverlet.MTP, sniffer, inspection and stripper tests): `ImageMetadataStripper.cs` line 99.5%, branch 98.6%; `ImageMetadataStripper.Heic.cs` line 97.4%, branch 95.0%; `ChunkReader.cs` 100% and 100% (Application target 95%).
- Acceptance greps: `ImageMetadataStripper.Strip` in the handler: 1. Stripper test names include `Png`, `WebP`, `Heic` and `Idempotent`. `OrderImageMetadataTests` asserts the fake serial, make, model, owner, date taken and the GPS tag bytes are absent from what storage received.
- Idempotency: `EveryFixtureIsIdempotent` strips nine fixtures (JPEG, PNG, WebP and HEIC, both HEIC layouts) twice and compares bytes.
- Hostile input: every cut of five fixtures and 2,000 seeded damaged files raise no exception; any answer sniffs the same as its input.
- `gitleaks protect --staged`: no leaks found on every commit. Ports 5180, 5115, 7028 and 5199 were free by `netstat` before every integration run; the tests run in process on a `CSPS_Test_` database and open no port.

## Deviations from Plan

**1. [Rule 3 - Blocking] Chunk reader refactor done early.** The plan puts the shared-reader REFACTOR in task 3. PNG and WebP (task 2) needed it first, so it is a separate `refactor(09-15)` commit (364d4e00) before task 2's RED.

**2. [Rule 2 - Safety] Unfinished kinds were refused, not passed through.** Between the task 1 and task 3 commits `Strip` refused PNG, WebP and HEIC (the safe default) instead of passing them on, so the 09-10 HEIC endpoint tests failed in that window. Task 3 closed it. Nothing leaked.

**3. Signature.** `Strip(ImageKind kind, ReadOnlySpan<byte> bytes, string? fileName = null)`: the optional name lets the 400 message name the file. The class is `partial`; HEIC lives in `ImageMetadataStripper.Heic.cs` to keep files readable.

**4. Stricter than the sniffer on cut-off files.** See key decisions and the backlog below. This is the "refuse rather than pass on" rule applied literally.

**5. Fixture helpers changed.** `SyntheticImages.Infe` is public with content type and version options (the old call `Infe(1, "hvc1")` still works). `PngChunk` takes an optional checksum.

**6. Existing 09-10 HEIC fixture left as is.** `Heic(..., exifOrientation: 6)` has an Exif item but no iloc box. That file passes unchanged (nothing to wipe), so the 09-10 endpoint test still holds.

## Known limits (not defects)

- A HEIC Exif item whose infe entry is version 0 or 1 has no item type, so it cannot be recognized (only an XMP content type can). The HEIF standard requires version 2 or later for Exif items, and iPhones write version 2.
- WebP chunks other than EXIF and 'XMP ' are kept, as the plan lists.
- An animated PNG loses its animation chunks (they are unknown ancillary chunks) and becomes a still. The sniffer already refuses animated WebP.
- Android "Ultra HDR" JPEGs keep the HDR gain map as a second picture after the first EOI. D-02 drops it, so those photos are stored as the plain base picture.

## Known Stubs

None.

## Threat Flags

None. T-09-31 (GPS and serial in stored photos), T-09-32 (crafted blocks), T-09-33 (corrupting the picture) are mitigated as above. T-09-SC: no package added or bumped.

## Owner backlog items (for the orchestrator to copy into STATE.md)

- [ ] **A1, open owner check (plan 09-30):** zero-filled HEIC Exif and XMP items are assumed to decode at Cloudinary (RESEARCH A1). Check once with a real iPhone HEIC in the dev folder: upload it, open it in the gallery and in the viewer, and see that it shows upright and that Cloudinary does not reject it. If Cloudinary rejects it, the fallbacks are renaming the item type or refusing HEIC (the owner's call). Nothing in the repo uses a real photo.
- [ ] **UIC-48 backstop (plan 09-30):** check one real rotated phone photo (not downscaled, so the browser did not turn it) shows upright in Cloudinary. The stripped file keeps Orientation in a one-tag Exif block.
- [ ] **Owner call, recommended: accept.** A cut-off file is now refused with "isn't a photo we can use" at upload: a JPEG with no end marker, a PNG with no IEND, or a WebP whose chunks do not fit its size. Before, the sniffer let some of these through (09-10 known limit). The plan says a file that cannot be cleaned is refused, so I applied it. If staff ever report real phone photos refused, the loosest safe change is to accept a JPEG that only lacks its final end marker.
- [ ] **Owner call, recommended: accept.** Android Ultra HDR photos lose their HDR gain map (second picture after the first end marker) and animated PNGs become stills. Both follow from D-02 and the keep lists in RESEARCH.
- [ ] The sandbox runs were checked with `netstat` only (ports free each time); `preflight.ps1` was not run from this worktree. Not blocking.

## Self-Check: PASSED

- Files found: `src/Csps.Application/Images/ImageMetadataStripper.cs`, `src/Csps.Application/Images/ImageMetadataStripper.Heic.cs`, `src/Csps.Application/Images/ChunkReader.cs`, `tests/Csps.Application.UnitTests/Images/ImageMetadataStripperTests.cs`, `tests/Csps.Server.IntegrationTests/Orders/OrderImageMetadataTests.cs`, `tests/Csps.Testing/Images/SyntheticImages.cs`.
- Commits found in HEAD: 278dbea5, 861a498d, 364d4e00, 8121f122, 99e0f06e, 797c82dd, 635cd8e2, c74b41d5.

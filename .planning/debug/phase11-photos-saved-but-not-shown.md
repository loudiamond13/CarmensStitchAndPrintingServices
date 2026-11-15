---
status: diagnosed
trigger: "phase11-photos-saved-but-not-shown: photos uploaded through Site Content and an order's own photos used as gallery cover save but no page draws them (UAT tests 4, 6, 7)"
created: 2026-11-14T19:50:00-06:00
updated: 2026-11-14T19:50:00-06:00
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED. The Cloudinary account the Development host talks to does not hold the 21 named sizes Phase 11 added (csps_cat_*, csps_strip_*, csps_w_*, csps_sq_200/400/720, csps_share_*). Every delivery address that uses one of them answers HTTP 400 "Unknown transformation", the browser img fires onError, and LazyImage draws the empty dotted placeholder.
test: Request each of the 34 named sizes for the stored photos (plain GET, status code only).
expecting: 13 Phase 9 sizes answer 200, 21 Phase 11 sizes answer 400. Observed exactly that.
next_action: Hand the diagnosis back. The fix is an owner step on the Cloudinary account (run the existing setup command), not a code change.

## Symptoms

expected: After a Manager replaces a product line photo and saves, /products and the Home card show it. An order shown on the website appears in /gallery with its cover photo. A gallery upload and the Link preview picture show in Site Content and on the public pages.
actual: Empty dotted placeholders everywhere a Phase 11 photo is drawn (UAT 4, 6, 7). Saves report success.
errors: None in the UI. No console or network capture was taken.
reproduction: UAT tests 4, 6 and 7 in .planning/phases/11-public-site-content-management/11-UAT.md. Local Development run, web on Vite 5180, API on 5115, database CSPS_Dev.
started: Phase 11 UAT, 2026-11-14.

## Eliminated

- hypothesis: CSP img-src blocks the host in Development.
  evidence: SecurityHeadersMiddleware.StrictCsp (src/Csps.Server/Http/SecurityHeadersMiddleware.cs:20) allows https://res.cloudinary.com for every non-Scalar path, Development included. Phase 9 order photos load from the same host in the same run. The failing answer is a server 400, not a block.
  timestamp: 2026-11-14T19:40:00-06:00
- hypothesis: Development is wired to another store (in-memory or unconfigured) or returns empty addresses.
  evidence: ImagesRegistration.AddCspsImages (src/Csps.Infrastructure/Images/ImagesRegistration.cs:46-54) uses the in-memory store only in Testing. Development gets CloudinaryImageDelivery and CloudinaryImageStorage. The cloud name is set in user-secrets (checked as set or not set only; value never printed). The stored files answer 200 from Cloudinary, so uploads reached the real store.
  timestamp: 2026-11-14T19:35:00-06:00
- hypothesis: The DTOs carry no photo (projection, cache, or wrong cover choice).
  evidence: CSPS_Dev (read only) holds the rows: 1 ProductLinePhotos row (line "custom", Main), SiteSettings.SharePicturePublicId set, 1 gallery Upload entry with a PublicId, 1 gallery Order entry whose order has 3 OrderImages. PublicGalleryProjection orders order photos by Position with the cover first and "never empty" (src/Csps.Infrastructure/Content/PublicGalleryProjection.cs:27,138). ProductLinePhotoMapper returns null only when the delivery gives an empty address, which needs an empty cloud name. So the DTOs carry real addresses; the addresses are what fail.
  timestamp: 2026-11-14T19:45:00-06:00
- hypothesis: The upload itself failed or stored a bad file.
  evidence: The stored files for the line photo, the gallery upload, the share picture and the order photos all answer 200 at the Phase 9 sizes (csps_sq_88, csps_view_960). The files exist and decode.
  timestamp: 2026-11-14T19:38:00-06:00

## Evidence

- timestamp: 2026-11-14T19:30:00-06:00
  checked: How addresses are built (src/Csps.Infrastructure/Images/CloudinaryImageDelivery.cs:101-102).
  found: Every address is https://res.cloudinary.com/<cloud>/image/private/t_<name>/v1/<publicId>. Strict mode: only named sizes are accepted. The shape is the same as the Phase 9 order photo addresses (git show a7c40cf2 has the identical Address).
  implication: Whether a photo draws depends only on whether the named size exists in the account.

- timestamp: 2026-11-14T19:32:00-06:00
  checked: Which named sizes each Phase 11 slot uses (src/Csps.Infrastructure/Images/ImageCandidates.cs, ImageNamedSizes.cs).
  found: ForLinePhoto: Card = csps_cat_* (4:5), Large = csps_w_*, Small = csps_sq_200/400/720, Thumb = csps_sq_44. ForGallery: Masonry = csps_w_*, Viewer = csps_view_*, Thumb = csps_sq_88. ForStrip = csps_strip_*. ForShare = csps_share_1200. ForSharePreview = csps_share_320 / csps_share_640. ImageNamedSizes.All is 34: 13 from Phase 9, 21 from Phase 11 (ImageNamedSizes.cs:72-75).
  implication: Each reported slot depends on a Phase 11 size.

- timestamp: 2026-11-14T19:41:00-06:00
  checked: Live delivery probe. Plain GET of the address the code would build, for all 34 names, against the stored Custom line main photo. Status code only; no key or secret used, no admin call made.
  found: 200 for exactly the 13 Phase 9 names (csps_sq_44/88/176, csps_card_320..960, csps_view_640..1600, csps_full_2000). 400 for exactly the 21 Phase 11 names (csps_cat_x5, csps_strip_x4, csps_w_x6, csps_sq_200/400/720, csps_share_1200/320/640). The 400 carries the header x-cld-error: "Unknown transformation csps_cat_640".
  implication: The 21 Phase 11 named sizes do not exist in the account the dev host uses. This is the direct cause.

- timestamp: 2026-11-14T19:43:00-06:00
  checked: The same probe against the gallery upload, the share picture and the first order photo.
  found: Identical split for each: csps_sq_88 and csps_view_960 answer 200; csps_w_400, csps_strip_480, csps_share_320, csps_share_1200 answer 400.
  implication: The cause is the same for all three kinds of photo, and the order's own photos are fine as files.

- timestamp: 2026-11-14T19:36:00-06:00
  checked: How the browser reacts (web/src/components/states/LazyImage.tsx:76-93).
  found: The img onError sets state 'failed', and the box then renders MediaPlaceholder with no label chip. That is the empty dotted placeholder in the owner's screenshots. There is no message and no console warning from the app.
  implication: A 400 from Cloudinary looks exactly like "saved but not shown". Nothing tells the owner why.

- timestamp: 2026-11-14T19:44:00-06:00
  checked: Planning records for the setup step.
  found: 11-CONTEXT.md D-44, 11-19-PLAN.md, 11-19-SUMMARY.md (OI-4) and docs/operations/cloudinary-setup.md ("Phase 11 sizes", lines 145-170) all say the owner must run the existing setup command once, and that "without the 21 sizes a public photo does not load under strict mode". The plans forbid running it from a plan. It was run only against a stub in tests. The doc says "after the Phase 11 deploy", and UAT test 21 is blocked for the same reason (11-UAT.md lines 138-143). The dev UAT of tests 4, 6 and 7 needs the sizes before any deploy, and the UAT text has no such pre-step.
  implication: The code behaves as designed. The account setup step was never done for the account the dev run uses, and the dev workflow never asked for it.

- timestamp: 2026-11-14T19:46:00-06:00
  checked: Which paths use only Phase 9 sizes.
  found: The 44 px thumb in the admin Products list (csps_sq_44), the admin Gallery list thumb (csps_sq_88) and the gallery viewer (csps_view_*) use existing sizes. Those should already draw in the owner's run.
  implication: Useful cross-check for the owner. Also why Phase 9 order photo screens passed UAT and the e2e suite (Testing environment, same-origin in-memory addresses) never saw the gap.

## Resolution

root_cause: The Cloudinary account behind the Development host has only the 13 Phase 9 named sizes. The 21 sizes Phase 11 added (csps_cat_*, csps_strip_*, csps_w_*, csps_sq_200/400/720, csps_share_320/640/1200) were never created there, because the owner's one-time setup command (D-44) has not been run. Under strict mode Cloudinary answers every address that uses a missing size with 400 "Unknown transformation", so the img errors and LazyImage draws the dotted placeholder. All three symptoms (tests 4, 6, 7) share this one cause. Code is correct as designed; the gap is the dev account setup, plus two small process gaps (the dev UAT never lists the setup as a pre-step, and nothing in the app or the run warns when a named size is missing).
fix: (not applied, diagnose only) Owner runs the existing setup command against the account the dev host uses: look first with --check (expect 13 exist, 21 missing), then run it without --check (creates only the 21 missing, allowed for strict mode, never touches the 13), then --check again (expect 34 exist). Then re-run UAT 4, 6, 7 and re-check the off, delete and restore steps of test 6.
verification: (not applied)
files_changed: []

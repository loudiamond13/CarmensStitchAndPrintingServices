---
created: 2026-11-15T11:09:24-06:00
updated: 2026-11-15T11:09:24-06:00
phase: quick-261115-eo5
plan: 01
status: complete
subsystem: images
tags: [cloudinary, named-sizes, public-site, D-130]
requires: [Phase 11 named sizes (D-44)]
provides: [15 centre-cut public named sizes, 49-size setup catalog]
affects: [Home category cards, Recent work strip, product small cells, og:image, admin link preview previews]
tech-stack:
  added: []
  patterns: [one gravity-aware FillSize helper builds every fill size]
key-files:
  created: []
  modified:
    - src/Csps.Infrastructure/Images/ImageNamedSizes.cs
    - src/Csps.Infrastructure/Images/CloudinarySetupCommand.cs
    - src/Csps.Server/Endpoints/PublicHeadWriter.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/ImageNamedSizesTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/CloudinarySetupCommandTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/CloudinaryImageDeliveryTests.cs
    - tests/Csps.Server.IntegrationTests/Content/ProductLinePhotoEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Content/PublicHomeEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Content/SharePictureEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs
    - tests/Csps.Server.IntegrationTests/Testing/TestingSiteContentTests.cs
    - web/src/test/siteContentFixtures.ts
    - web/src/modules/admin/services/siteSettingsService.test.ts
    - web/e2e/site-content-business.spec.ts
    - docs/operations/cloudinary-setup.md
    - docs/operations/go-live-public-site.md
    - docs/api/site-content.md
    - .planning/phases/11-public-site-content-management/11-CONTEXT.md
decisions:
  - "D-130 (owner, 2026-11-15): every public fill crop cuts from the centre (g_center) under 15 new names; the 34 old sizes stay byte for byte"
metrics:
  duration: 18 min
  completed: 2026-11-15
actuals:
  tokens: 15300
  tasks: 3
  commits: 3
plan_head_before: 988753629b5be37ab4e466967d67e472a9eddfa5
plan_head_after: e3604e181d3169b7047f3998e4db1f511312c67e
---

# Quick 261115-eo5: Public photo crops cut from the centre (D-130) Summary

The Home category cards, the Recent work strip, the product small cells, the og:image and the admin link preview previews now use 15 new `c_fill,g_center` named sizes (`csps_catc_`, `csps_stripc_`, `csps_psqc_`, `csps_sharec_`). The 34 sizes already in the account keep their exact texts, so the setup catalog goes from 34 to 49.

## Commits

| Task | Commit | Subject |
|---|---|---|
| 1 | 824c7339 | feat(261115-eo5): cut public website photos from the centre (D-130) |
| 2 | fac99519 | test(261115-eo5): use the centre-cut size names in the web fixtures and the share e2e check (D-130) |
| 3 | e3604e18 | docs(261115-eo5): record D-130 and the centre-cut setup steps |

## What changed

- `ImageNamedSizes`: one private `FillSize(name, gravity, width, height, format)` helper, with constants for `g_auto`, `g_center`, `f_webp` and `f_jpg`. `Square`, `Card`, `Portrait` and `SharePreview` are built on it. `CategoryCards`, `Strips`, `ProductSquares`, `Share` and `SharePreviews` now hold the centre-cut sizes. `Phase11` still lists the same 21 sizes, built inline on `g_auto`. The new `CentreCuts` (15) sits after `Phase11`, and `All` = Phase 9 (13) + Phase11 (21) + CentreCuts (15) = 49.
- `ImageCandidates.cs`, `CloudinaryImageDelivery.cs` and `TestingImageDelivery.cs` are not edited. They read the slot properties, so they pick up the new sizes by themselves.
- Setup command: only the two summaries changed (34 to 49). No logic change.

## Gate results (quoted)

**Task 1 RED**
- Infrastructure: `ImageNamedSizesTests.cs(29,25): error CS0117: 'ImageNamedSizes' does not contain a definition for 'CentreCuts'` ... `Build failed with exit code: 1.`
- Server (5 classes): `Test run summary: Failed!  total: 102  failed: 13  succeeded: 89`. Example: `should end with "?size=csps_catc_320" but was "/api/testing/images/7w5wosls7yi2dl6pfzlsxtvyzy?size=csps_cat_320"`.

**Task 1 GREEN**
- `dotnet build Csps.slnx`: `Build succeeded.  0 Warning(s)  0 Error(s)` (exit 0).
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- Infrastructure (ImageNamedSizesTests, CloudinarySetupCommandTests, CloudinaryImageDeliveryTests): `Test run summary: Passed!  total: 79  failed: 0  succeeded: 79  skipped: 0` (exit 0).
- Preflight before the Server run: ports 5180, 5115, 7028 and 5199 `free`. `Dev/test processes ... none`.
- Server (ProductLinePhoto, PublicHome, SharePicture, ShellHead, TestingSiteContent, PublicGallery, PublicProductLines, OrderImageDelivery): `Test run summary: Passed!  total: 109  failed: 0  succeeded: 109  skipped: 0` (exit 0).
- `grep -c "csps_catc_" src/Csps.Infrastructure/Images/ImageNamedSizes.cs` gives `1`. The commit has 11 files and none of ImageCandidates.cs, CloudinaryImageDelivery.cs or TestingImageDelivery.cs.

**Task 2**
- vitest (8 named files): `Test Files  8 passed (8)`, `Tests  164 passed (164)` (exit 0).
- `typecheck` exit 0. `lint` (`eslint . --max-warnings 0`) exit 0. `format:check`: `All matched files use Prettier code style!` (exit 0).
- Old-name grep over `web/src` and `web/e2e` is empty, and the three new-name gates pass (exit 0).

**Task 3**
- The plan's verify chain (D-130 on the line right after D-129, the timestamps, the counts, the names, no old names in `docs/api`) gave `task3 verify exit=0`.

**Every commit**
- `gitleaks git --staged --redact`: `no leaks found`.
- The staged-diff scan found no server or database names, connection strings, emails or local paths, and no em or en dash.

## TDD Gate Compliance

Task 1 (tracer, tdd) went RED then GREEN as quoted above. Tasks 2 and 3 change test data and docs only, so the plan gave them no failing test.

## Tracer feedback gate

After Task 1 I re-ran its whole verify chain and it passed (build, format, both test sets). Then I went on to Tasks 2 and 3.

## Deviations from Plan

1. **Commit scope.** The plan gave the subjects with scope `11`. The orchestrator asked for scope `261115-eo5`, so I used it. Task 1 was first committed with `feat(11)` and then amended, before any push, to `feat(261115-eo5)`. Nothing else in the commit changed.
2. **Section placement in cloudinary-setup.md.** The plan said to put the new section "right after Phase 11 sizes". The Phase 11 section ends with the paragraph about the content and orders folders, so the new section goes after that paragraph. That keeps the paragraph inside its own section. It is still the next section.
3. **Precondition.** LocalDB `MSSQLLocalDB` was `Stopped`, so I started it with `sqllocaldb start MSSQLLocalDB` (`LocalDB instance "MSSQLLocalDB" started.`), as the precondition allows. I stopped and deleted nothing.

There were no other deviations and no auto-fixes.

## Not run

- `web/e2e/site-content-business.spec.ts` was updated (it now expects `csps_sharec_1200`) but not run. The owner said no Playwright and no e2e. Typecheck and lint cover the file.

## Owner follow-ups

1. **Before the redeploy that carries D-130**, with the Cloudinary keys in your user-secrets:
   - `dotnet run --project tools/Csps.CloudinarySetup -- --check` must say `34 exist, 15 missing`.
   - `dotnet run --project tools/Csps.CloudinarySetup` must say `34 exist, 15 created`.
   - `--check` again must say `49 exist`. If any size says `different`, stop.
   - Then redeploy. If the deploy goes first, strict mode refuses the new names and the public photos do not load until the setup runs.
2. **Open owner question: the gallery lightbox thumbnail.** The thumbnail row on the public Gallery lightbox uses `csps_sq_88`, which is still a smart crop. It is shared with the admin gallery list and the order tiles. D-130 did not list it, so it was left as planned (orchestrator choice: option A). Options:
   - **A (recommended): leave it on the smart crop.** It is an 88 px helper thumb shared with admin screens, and a new name would split that share.
   - B: add a centre-cut `csps_sqc_88` for the public lightbox only. That is one more named size and one more setup run.
   - C: decide after you have seen the centre-cut site live.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, file access or schema change.

## Self-Check: PASSED

- FOUND: src/Csps.Infrastructure/Images/ImageNamedSizes.cs (holds `csps_catc_`)
- FOUND: docs/operations/cloudinary-setup.md (holds `49 exist`)
- FOUND: .planning/phases/11-public-site-content-management/11-CONTEXT.md (holds D-130)
- FOUND commits: 824c7339, fac99519, e3604e18 (all ancestors of HEAD)

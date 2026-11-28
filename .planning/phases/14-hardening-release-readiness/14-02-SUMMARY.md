---
phase: 14-hardening-release-readiness
plan: 02
subsystem: pwa, server-shell
tags: [pwa, manifest, icons, admin-head, vite-plugin-pwa]
requires: []
provides:
  - "web/public/manifest.webmanifest: the committed staff app manifest (scope /admin, start_url /admin/login)"
  - "Four PNG icons drawn from mark.svg, with a by-hand render script and a test"
  - "PublicHeadWriter.AppendAdminAppTags: manifest, theme-color, Apple icon and app title tags on admin documents only"
  - "Owner ruling 14 D-46: vite-plugin-pwa 2.0.0 approved (install is plan 14-13)"
affects: [14-07, 14-13, 14-22, 14-23, 14-24, 14-26]
actuals:
  tokens: 4400
  tasks: 3
  commits: 2
plan_head_before: 11ff9e6260e3a5080c5445767274fcb6681fa038
plan_head_after: 41ee86ab585e6082e3829622cdf5fd381cc2d5d1
tech-stack:
  added: []
  patterns:
    - "Install tags are written only in the Admin head case, so no public document can offer install (14 D-12)"
    - "In-test PNG reader on node:zlib, no image package"
key-files:
  created:
    - web/public/manifest.webmanifest
    - web/public/pwa/icon-192.png
    - web/public/pwa/icon-512.png
    - web/public/pwa/icon-maskable-512.png
    - web/public/pwa/apple-touch-icon-180.png
    - web/scripts/pwa-icons.mjs
    - web/scripts/pwa-icons.test.ts
    - tests/Csps.Testing/Fixtures/webroot/manifest.webmanifest
  modified:
    - src/Csps.Server/Endpoints/PublicHeadWriter.cs
    - src/Csps.Server/Endpoints/ShellPage.cs
    - tests/Csps.Server.IntegrationTests/Http/ShellPageTests.cs
    - tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs
key-decisions:
  - "14 D-46: vite-plugin-pwa 2.0.0 exact pin as a dev dependency approved, including its prerelease transitive @trickfilm400/rollup-plugin-off-main-thread 3.0.0-pre1 (owner, 2026-11-27)"
requirements-completed: []
coverage:
  - id: D1
    description: "Admin documents (/admin, /admin/, /admin/login, /admin/orders) carry the manifest link, theme-color, Apple icon and app title tags"
    requirement: PERF-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/ShellPageTests.cs#AdminDocumentsCarryTheStaffAppInstallTags"
        status: pass
    human_judgment: false
  - id: D2
    description: "No public document or the 404 carries a manifest link or the Apple icon"
    requirement: PERF-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/ShellPageTests.cs (public kinds and 404 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "/manifest.webmanifest is served 200 as application/manifest+json with Cache-Control no-cache"
    requirement: PERF-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs#ManifestIsServedAsManifestJsonAndRevalidates"
        status: pass
    human_judgment: false
  - id: D4
    description: "Four icons exist at the listed sizes, the maskable and Apple icons are fully opaque, and the manifest holds no long dash"
    requirement: PERF-06
    verification:
      - kind: unit
        ref: "web/scripts/pwa-icons.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Owner ruling on vite-plugin-pwa 2.0.0"
    verification: []
    human_judgment: true
    rationale: "A package approval is the owner's decision and is recorded as 14 D-46 from the owner's own answer."
duration: 19min
completed: 2026-11-27
status: complete
created: "2026-11-27T18:21:00-06:00"
updated: "2026-11-27T18:21:00-06:00"
---

# Phase 14 Plan 02: Staff can install the admin portal, and the owner rules on the PWA package Summary

*Created: 2026-11-27T18:21:00-06:00 · Updated: 2026-11-27T18:21:00-06:00*

**A committed `/admin`-scoped staff app manifest with four icons drawn from the mark, admin-only install tags written by the server, and the owner's yes (14 D-46) for vite-plugin-pwa 2.0.0.**

## Performance

- **Duration:** 19 min (the owner's answer to Task 3 arrived between the two agent runs)
- **Started:** 2026-11-27T18:02:00-06:00
- **Completed:** 2026-11-27T18:21:00-06:00
- **Tasks:** 3 (two commits, plus the owner ruling)
- **Files modified:** 12 (9 in the Task 2 commit, 3 more in Task 1)

## Accomplishments

- Admin documents link `/manifest.webmanifest`, carry `theme-color` `#572e2b`, the Apple touch icon and the title "CSPS Admin". No public document or the 404 carries any of them.
- The manifest is a committed plain JSON file (id `/admin/`, scope `/admin`, start_url `/admin/login`, standalone, no shortcuts or share target). It is served as `application/manifest+json` with `Cache-Control: no-cache` with no server change.
- Four PNG icons rendered from `mark.svg` by `web/scripts/pwa-icons.mjs` (192, 512, maskable 512 on full `#ff6600` at 72%, Apple 180 on full `#ff6600`). The maskable and Apple icons have no transparent pixel.
- The owner approved vite-plugin-pwa 2.0.0. Nothing was installed here: plan 14-13 installs it.

## Owner ruling

14 D-46: vite-plugin-pwa 2.0.0 exact pin as a dev dependency approved, including its prerelease transitive @trickfilm400/rollup-plugin-off-main-thread 3.0.0-pre1 (owner, 2026-11-27)

Findings the owner saw (read-only checks made 2026-11-27, nothing installed):

- vite-plugin-pwa 2.0.0: published 2026-10-03 (older than 14 days), MIT, not deprecated, no install scripts, no GitHub advisories.
- workbox-build 7.4.1 and workbox-window 7.4.1: published 2026-05-04, MIT, not deprecated, no install scripts, no advisories.
- Open plugin issues #959, #944, #943, #940, #936 and #933 do not block this use: they concern SolidStart, Nitro or pnpm, and we use Vite.
- Transitive: workbox-build brings glob 11 and minimatch 10 (BlueOak-1.0.0, allowed in the build scope by 14 D-34). They carry the two moderate advisories accepted until 2026-12-14, renewed by plan 14-14 per 14 D-35.
- `@trickfilm400/rollup-plugin-off-main-thread` 3.0.0-pre1 is a community fork on a prerelease tag (published 2025-12-02, Apache-2.0, not deprecated, no install script, build time only). The owner was told this and approved.
- deepmerge 4.3.1 advisory GHSA-gcqx-w48m-w2h4 is Withdrawn.
- Plain words told to the owner: it builds the small offline helper (service worker) for the staff app only. Public pages never load it.

## Task Commits

1. **Task 1 (tracer): Admin documents link the staff app manifest, public ones do not** - `5753b918` (feat)
2. **Task 2: The four icons are drawn from the mark and checked** - `41ee86ab` (feat)
3. **Task 3: Owner yes for vite-plugin-pwa 2.0.0** - decision only, recorded above as 14 D-46 (no code commit)

**Plan metadata:** the docs commit that carries this file.

## Evidence

- Task 1 RED: `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ShellPageTests" --filter-class "*SpaHostTests"` total 72, failed 5 (4 x AdminDocumentsCarryTheStaffAppInstallTags for /admin, /admin/, /admin/login, /admin/orders; ManifestIsServedAsManifestJsonAndRevalidates). GREEN: total 72, failed 0, no warnings.
- Task 1 tracer gate: the verify was re-run end to end after the commit and passed before Task 2 started.
- Task 2 RED: `npm --prefix web run test -- --run scripts/pwa-icons.test.ts` 8 tests, 5 failed. GREEN: 8 passed. ShellPageTests total 46, failed 0. `npm --prefix web run lint` exit 0. `npm --prefix web run typecheck` exit 0. The four icons were viewed after rendering.
- gitleaks clean on both task commits. No file deletions in either commit.

## Decisions Made

- 14 D-46 as above.
- Manifest `scope` is `/admin` (no trailing slash) per the plan and 14 D-42, so the dashboard at `/admin` is inside it. UI-SPEC said `/admin/`. The `id` stays `/admin/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ran `npm ci` in the worktree**
- **Found during:** Task 2
- **Issue:** `web/node_modules` was missing in the linked worktree, so the icon test and lint could not run.
- **Fix:** `npm ci` from the committed lockfile. No package was added, changed or bumped.
- **Files modified:** none tracked
- **Committed in:** not applicable

**2. [Rule 3 - Blocking] Added a fixture manifest for the SpaHostTests case**
- **Found during:** Task 1
- **Issue:** The test web root had no manifest file to serve, and the plan said the case may place one the way existing static-file cases do. The file was not in the plan's file list.
- **Fix:** Added `tests/Csps.Testing/Fixtures/webroot/manifest.webmanifest`.
- **Committed in:** 5753b918

**3. [Rule 1 - Bug] First PNG reader in the icon test timed out**
- **Found during:** Task 2
- **Issue:** The first row-unfilter loop was too slow for 512 x 512 images.
- **Fix:** Rewrote the loop before commit. No code with the slow version was committed.
- **Committed in:** 41ee86ab

**4. [Plan wording] Apple icon link added in the Task 2 edit round**
- The `apple-touch-icon` link and its ShellPageTests assertion landed in the same edit round, as Task 2's action says.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug), 1 wording note.
**Impact on plan:** None of them changed scope or added a package.

## Issues Encountered

None beyond the deviations above.

## Known Stubs

None. The manifest's only placeholder icon entry (`/mark.svg`) from Task 1 was replaced by the three PNG entries in Task 2.

## Threat Flags

None. The new surface (manifest and install tags) is the one T-14-03 and T-14-04 cover. T-14-03 is mitigated by tests on every public kind and the 404.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 14-13 may install vite-plugin-pwa 2.0.0 as an exact pin with `manifest: false`, and must record the prerelease transitive.
- Plan 14-14 renews the two accepted build-tool advisories (14 D-35).
- Plan 14-22 proves the worker's `/admin` scope. Plan 14-07 writes the install how-to. Plan 14-26 copies 14 D-46 into 14-CONTEXT.md.
- PERF-06 stays pending: the service worker part is still to come. No requirement is marked complete here.

## Self-Check: PASSED

- All created files exist (manifest, four PNGs, pwa-icons.mjs, pwa-icons.test.ts, fixture manifest).
- Commits 5753b918 and 41ee86ab are ancestors of HEAD.

---
*Phase: 14-hardening-release-readiness*
*Completed: 2026-11-27*

---
phase: 11-public-site-content-management
plan: 34
subsystem: ui
tags: [react, photo-slot, share-picture, link-preview, og-image, business-info, site-content, admin, prepareImage, playwright, wcag]
created: 2026-11-13T00:26:00-06:00
updated: 2026-11-13T00:26:00-06:00

requires:
  - phase: 11-30
    provides: "POST and DELETE /api/v1/site-settings/share-picture (Manager, multipart, Idempotency-Key), SiteSettingsDto.sharePicture {src320, src640, width, height}, og:image on the public heads, the demo share picture in the Testing seed"
  - phase: 11-22
    provides: "PhotoSlot (ratio 1.91/1, the word Picture, Replace, Remove with its question, Uploading then Saved, the P9 pick-error box), the pattern of one Idempotency-Key per file and the redrawn file only"
  - phase: 11-12
    provides: "BusinessInfoTab and useSiteSettingsQuery, the form version rule (a save sends the version the form was opened with)"
  - phase: 09
    provides: "prepareImage, the image rules read, the photo host lock for e2e"
provides:
  - "SharePictureCard: the Link preview picture card (card 6) of Business Info, on PhotoSlot, saving on its own outside the form element"
  - "siteSettingsService.uploadSharePicture(file, fileName, key) and removeSharePicture(); useUploadSharePicture and useRemoveSharePicture (settings read again after each change, public data in this browser cleared, a 404 on removal counts as removed)"
  - "Business Info takes the settings version a picture change left, so the next Save Business Info is not refused as stale, but only when nobody else changed the business fields"
  - "siteContentCopy business.sharePicture wording, sharePicture and sharePictureBackend test fixtures, three @site-content-share e2e journeys"
affects: [11-37, 11-38]

requirements-completed: [PUB-04, CONT-01]

actuals:
  tokens: 14950
  tasks: 2
  commits: 5
plan_head_before: 8b9defc5b3215dd87b09c9874df2d815eec60c01
plan_head_after: 35b77935531f1e17db0400d9ec31249e563f2b3f

tech-stack:
  added: []
  patterns:
    - "A card that saves on its own inside a screen with one form: the form element holds the form cards only, the Save button names it with the form attribute, and the picture card sits between the form cards in the visual order"
    - "A write that moves a shared row's version reads that row again and hands it to the form; the form takes only the new version, and only while the saved fields on the server still equal the ones the form was opened with"

key-files:
  created:
    - web/src/modules/admin/components/SharePictureCard.tsx
    - web/src/modules/admin/components/SharePictureCard.test.tsx
  modified:
    - web/src/modules/admin/components/BusinessInfoTab.tsx
    - web/src/modules/admin/components/BusinessInfoTab.test.tsx
    - web/src/modules/admin/services/siteSettingsService.ts
    - web/src/modules/admin/services/siteSettingsService.test.ts
    - web/src/modules/admin/hooks/useSiteSettingsQuery.ts
    - web/src/modules/admin/hooks/useSiteSettingsQuery.test.tsx
    - web/src/modules/admin/siteContentCopy.ts
    - web/src/test/siteContentFixtures.ts
    - web/e2e/site-content-business.spec.ts
    - docs/web/e2e.md
    - .planning/phases/11-public-site-content-management/deferred-items.md

key-decisions:
  - "The Business Info form element ends after the Email card. Save Business Info and Undo Changes still sit at the end of the panel, and Save names the form with the form attribute. This keeps the picture card outside the form (plan wording) and in card 6's place in the order"
  - "After a picture change the form takes the new settings version only when the other fields on the server still equal the form's saved baseline. A change by someone else in the meantime still ends in the stale banner (11-30 OI-1 made safe, see Deviations 3)"
  - "A 404 on Remove Picture counts as removed (the picture is already gone), as 11-22 did for line photos; the settings are read again either way"
  - "A picture that went up still counts when the settings cannot be read again: the answer is null, the settings are marked for a new read, and no failure shows"

patterns-established:
  - "The share picture preview is the 320 and 640 addresses as a w-descriptor srcset on a 320 x 168 box, in the 1.91:1 PhotoSlot frame"

duration: about 1h 35m (about 22:55 to 00:30, -06:00; a good part of the last hour was spent waiting for port 5199 to be free)
completed: 2026-11-13
status: complete

coverage:
  - id: D1
    description: "The Link preview picture card is card 6 of Business Info (after Email, before Time zone and money), outside the form element: hint 'Shown when someone shares a page on Facebook or Messenger.', the 1.91:1 frame with 'No picture yet', Choose Picture (Take Picture on touch), the type and size hint and the note about Products and Gallery"
    requirement: "PUB-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/SharePictureCard.test.tsx (the card with no picture yet); BusinessInfoTab.test.tsx#is card 6: after Email and before Time zone and money, and outside the form element; shows the seven cards in order"
        status: pass
    human_judgment: false
  - id: D2
    description: "Choosing a picture prepares it (prepareImage), sends POST under one Idempotency-Key, shows Uploading then Saved and the toast 'Picture saved' / 'Shared links use it now.', shows the preview from the 320 and 640 addresses, reads the settings again and clears the public data in this browser; only the redrawn file is sent"
    requirement: "PUB-04"
    verification:
      - kind: unit
        ref: "SharePictureCard.test.tsx (choosing a picture); useSiteSettingsQuery.test.tsx (useUploadSharePicture); siteSettingsService.test.ts (uploadSharePicture)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-business.spec.ts @site-content-share a Manager chooses a link preview picture, and the next server HTML of Home has it as og:image (5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PUB-04: after a save the next server HTML of / carries the new og:image (1200 x 630 share address of the new picture), fetched with no script"
    requirement: "PUB-04"
    verification:
      - kind: e2e
        ref: "@site-content-share a Manager chooses a link preview picture, and the next server HTML of Home has it as og:image (5 projects): og:image holds the new picture's key and csps_share_1200"
        status: pass
    human_judgment: false
  - id: D4
    description: "Saving the picture never resets or submits the typed Business Info fields: a typed tagline stays typed, the form stays dirty, Undo Changes stays enabled and no save is sent"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "BusinessInfoTab.test.tsx#leaves a typed but unsaved tagline typed and the form dirty while the picture saves"
        status: pass
    human_judgment: false
  - id: D5
    description: "11-30 OI-1: after a picture change the next Save Business Info sends the new settings version and is not refused as stale; a change made by someone else first still ends in the stale banner with the typed words kept"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "BusinessInfoTab.test.tsx#the next Save Business Info sends the version the picture left; #a save after someone else changed the business info still ends in the stale banner; useSiteSettingsQuery.test.tsx (settings read again)"
        status: pass
      - kind: e2e
        ref: "@site-content-share a Manager removes the link preview picture after the question (Save Business Info right after the removal is saved, not 409)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Replace Picture and Remove Picture: Remove asks 'Remove the link preview picture?' / 'Shared links show no picture until you add one.' with Cancel focused, sends DELETE, shows 'Picture removed' / 'Shared links show no picture.', brings the empty frame back and puts focus on Choose Picture; a failed removal stays in the question; a 404 counts as removed"
    requirement: "PUB-04"
    verification:
      - kind: unit
        ref: "SharePictureCard.test.tsx (a card with a picture; removing the picture); useSiteSettingsQuery.test.tsx (useRemoveSharePicture)"
        status: pass
      - kind: e2e
        ref: "@site-content-share a Manager removes the link preview picture after the question, and Home has no og:image (5 projects)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A refused file shows the P9 pick-error box with the P9 words and sends nothing (not a usable picture, over 10 MB); a server refusal shows the server's line in the same box; while the picture saves its other actions are aria-disabled and keep focus"
    requirement: "PUB-04"
    verification:
      - kind: unit
        ref: "SharePictureCard.test.tsx (a refused file; one action at a time)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The preview is 320px wide from 640px and fills the card below it; no sideways scroll at 390px; zero axe findings in every unit state (empty, with picture, uploading, refused, the question open)"
    verification:
      - kind: unit
        ref: "SharePictureCard.test.tsx (frame classes; axe in each state); BusinessInfoTab.test.tsx#has no axe violation with the card and a typed form"
        status: pass
      - kind: e2e
        ref: "@site-content-share the preview is 320px wide beside a tablet and fills the card on a phone, with no sideways scroll and no axe finding (5 projects)"
        status: pass
    human_judgment: false
  - id: D9
    description: "MUST NOT upload a share picture that has not been through prepareImage (metadata and location removed): only the redrawn file from prepareImage is ever sent"
    requirement: "PUB-04"
    verification:
      - kind: unit
        ref: "SharePictureCard.test.tsx#prepares the file, sends POST with one Idempotency-Key ... (the sent blob is the prepared bytes under the prepared name); PhotoSlot.test.tsx (11-22: a refusal sends nothing)"
        status: pass
    human_judgment: true
    rationale: "The plan marks this prohibition as a judgment item (privacy, unverified). The tests prove the sent bytes are the prepared ones; that prepareImage's canvas redraw drops metadata in every browser, and that the server strips it again (11-30), is a reviewer call."
  - id: D10
    description: "How the card looks: spacing, the Note under the slot, the placeholder wording"
    verification: []
    human_judgment: true
    rationale: "SPEC-GAP card built from the PhotoSlot and My Profile card looks; no parity scenario draws it. The owner judges it in the UI review."
---

# Phase 11 Plan 34: A Manager sets the link preview picture from Business Info Summary

**The Link preview picture card in Business Info: a 1.91:1 PhotoSlot that checks and redraws the picture in the browser, saves it at once under one Idempotency-Key, reads the settings again so the next Save Business Info carries the new version, and replaces or removes it with its own question, while the server HTML of Home follows each change.**

## Performance

- **Duration:** about 1 h 35 min (about 22:55 to 00:30, -06:00)
- **Tasks:** 2 (1 tracer, 1 auto), both TDD
- **Files in the diff:** 13 (2 created, 11 modified, none deleted); about 59,800 characters added in `web` and `docs`, which is about 14,950 tokens on the chars/4 scale (the plan estimated 80,000)

## Accomplishments

- **Card 6.** `SharePictureCard` (`SiteContentCard` + `PhotoSlot` with `ratio="1.91/1"` and `noun="Picture"`) sits between Email and Time zone and money. It shows the 320 and 640 previews or the `MediaPlaceholder` "No picture yet", the hint "JPG, PNG, WEBP or HEIC · up to 10 MB · 1200 × 630 pixels works best" and the note "Products and Gallery use their own newest photo when they have one." Choose Picture and, on touch devices, Take Picture; with a picture, Replace Picture and Remove Picture.
- **Outside the form.** The `<form>` element ends after the Email card. The picture card, the Time zone card, the "Last changed by" line and the buttons follow it. Save Business Info is `type="submit" form={formId}`, so it still submits the form, and Enter in a field still does. Nothing typed is read, reset or sent by a picture change.
- **Service and hooks.** `uploadSharePicture(file, fileName, key)` posts a multipart form (120 s limit) and `removeSharePicture()` deletes. `useUploadSharePicture` and `useRemoveSharePicture` call them, read the settings again (`queryClient.query`, always fresh), put them in the cache and clear the public data held in this browser. A removal that answers 404 counts as removed. A failed read after a good upload answers null and marks the settings for a new read; it does not look like a failed upload.
- **The version (11-30 OI-1).** The picture lives on the settings row, so each change moves the row version. The card hands the re-read settings to the form (`onSettingsChange`), and `BusinessInfoForm` takes the new version only when the business fields on the server still equal the form's saved baseline. Tested both ways (see Deviations 3).
- **Words.** `siteContentCopy.business.sharePicture` holds the UI-SPEC words (card, hint, empty, note, the remove question and "Remove Picture", both toasts).
- **Docs.** One row for `@site-content-share` in `docs/web/e2e.md`.

## Task Commits

| Task | Phase | Commit | Message |
|---|---|---|---|
| 1 (tracer) | RED | `6e9356f7` | test(11-34): add failing tests for choosing a link preview picture in Business Info |
| 1 (tracer) | GREEN | `69925a41` | feat(11-34): a Manager chooses a link preview picture in Business Info and the Home page's server HTML uses it |
| 2 | RED | `0ecd6413` | test(11-34): add failing tests for replacing and removing the link preview picture, refusals and busy states |
| 2 | GREEN | `7d839335` | feat(11-34): replace and remove the link preview picture with the question, refusals and busy states |
| 2 | follow-up test | `35b77935` | test(11-34): check the link preview picture card at 320px for sideways scroll and axe |

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier is not required and Vitest prints none of the formats it reads for a hand run. The RED evidence is the real console output, read by hand. A RED commit precedes each GREEN commit.

- **Task 1 RED** (`6e9356f7`): the four plan unit files ran: `Test Files 4 failed (4)`, `Tests 16 failed | 56 passed (72)`. `SharePictureCard.test.tsx` could not load ("Failed to resolve import ... SharePictureCard": the module did not exist); the service tests failed with "uploadSharePicture is not a function", the hook tests the same for the new hooks, and five Business Info tests failed on the missing card (the heading list had six cards, no `group` named "Link preview picture"). The e2e journey was written in the RED commit and not run at RED (no UI existed). Semantic assessment: the target tests ran and failed because the card, the service calls and the hooks did not exist; for the new card file the RED is a missing import, not an assertion.
- **Tracer gate:** Task 1's `<verify>` holds only `<automated>` commands. After GREEN: unit set `Test Files 4 passed (4)`, `Tests 80 passed (80)`; e2e `npm run e2e -- --grep @site-content-share`: `5 passed (58.5s)` (all five projects). "Tracer verified end-to-end, expanding."
- **Task 1 GREEN** (`69925a41`): corrections to my own RED tests went into the GREEN commit: the Remove Picture assertion moved to Task 2, the "Uploading" test holds the wait in a service spy (a form body that waits cannot pass jsdom's FormData through Node's fetch, as 11-22 found), the refused-upload hook test raises the refusal from the service for the same reason, and the existing test that pinned "the six cards in order" now lists seven.
- **Task 2 RED** (`0ecd6413`): `SharePictureCard.test.tsx`: `Tests 6 failed | 12 passed (18)`. The six failures are the Remove Picture button, the question, DELETE, the failed removal, the busy rule for Remove, and the SVG refusal. **Weak spots, stated plainly:** the refusal tests (over 10 MB, the server line) and the replace test passed at RED, because `PhotoSlot` (11-22) and the tracer's upload already did that work; the SVG test first failed only because `user.upload` drops a file whose type is not in the input's `accept` list, so it names the file as a JPEG by type and lets `prepareImage` refuse it by its bytes (that version passed at RED for the same reason as the others). The 639px layout rule is a class check, since jsdom has no layout; the e2e measures it.
- **Task 2 GREEN** (`7d839335`): `SharePictureCard.test.tsx` and `no-long-dash.node.test.ts`: `Test Files 2 passed (2)`, `Tests 19 passed (19)`. No REFACTOR commit was needed.

## Verification evidence (real output)

- **Unit set (plan Task 1 command, run again after Task 2):** `Test Files 4 passed (4)`, `Tests 80 passed (80)` before Task 2's card tests; `SharePictureCard.test.tsx` + `no-long-dash.node.test.ts` `Tests 19 passed (19)` after.
- **e2e `@site-content-share` on the final source (3 journeys in 5 projects):** `15 passed (1.6m)`, no retries. The journeys: choose and see og:image on Home; remove after the question, Home has no og:image, a Save Business Info right after is saved; the preview is 320px wide at 1024px and fills the card at 390px with no sideways scroll. After that run I added the 320px sideways-scroll and axe lines to the layout journey (`35b77935`) and ran it alone: `5 passed (59.3s)`, all five projects.
- **e2e `@site-content-business` (the older spec, run because Save moved out of the form element):** 15 of 20 passed. The "second Manager saving first makes the first save show the conflict banner", the "changes the tagline, saves, and the public footer shows it" and the Admin redirect tests passed in all five projects. The 320px test failed in all five projects, and is not caused by this plan (see Deviations 6 and `deferred-items.md` D-34-1): four projects fail on the tab strip line, which comes after the sideways scroll line that passed.
- **Whole admin module and the two layout node tests** (`src/modules/admin src/test/no-long-dash.node.test.ts src/test/source-layout.node.test.ts`): `Test Files 5 failed | 206 passed (211)`, `Tests 5 failed | 5139 passed (5144)` while other projects' runs used the machine. The five (`routes.test.tsx`, `OrderItemModal.test.tsx`, `TestimonialsTab.test.tsx`, `DashboardPage.test.tsx`, `OrderFormPage.test.tsx`) passed when run alone: `Test Files 5 passed (5)`, `Tests 243 passed (243)`. Recorded as load flakes; none touches this plan.
- **Types, lint, format:** `npm --prefix web run typecheck` exit 0 (three `tsc` lines, no output); `npm --prefix web run lint` (`eslint . --max-warnings 0`) exit 0, no output; `npm --prefix web run format:check` "All matched files use Prettier code style!". The first lint run found one error (`fetchQuery` is deprecated; use `queryClient.query`), fixed before the GREEN commit.
- **Bundle** (`npm --prefix web run build:budget`, gzip, limit 150 KB public and 250 KB admin): home 149.36, products 146.01, gallery 147.37, contact 149.29, notFound 142.08, admin 220.88, CSS 19.59, all "ok". Home and Contact are the same as after plan 11-31's figures (0.64 and 0.70 KB left): the public pages do not grow.
- **Acceptance greps:** `grep -c "SharePictureCard" web/src/modules/admin/components/BusinessInfoTab.tsx` is 2 (>= 1). `grep -c "Remove the link preview picture?" web/src/modules/admin/siteContentCopy.ts` is 1 (>= 1).
- gitleaks (`protect --staged`, and the repository hook) ran before each commit: `no leaks found`. The values in the diff are made up (`demo`, `held`, `upload-1` ids, `/api/testing/images/...` addresses, `shop.jpg`). No em or en dash was added (`no-long-dash.node.test.ts` passes).

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Existing test pinned the old behavior]**
- **Found during:** Task 1 GREEN
- **Issue:** `BusinessInfoTab.test.tsx` had "shows the six cards in order, each with its hint".
- **Fix:** it lists seven cards with the Link preview picture card and its hint.
- **Committed in:** `69925a41`

**2. [Rule 3 - Plan wording] The service calls carry a file name and a key**
- **Issue:** the plan names `uploadSharePicture(blob)` and `removeSharePicture()`. A multipart form needs a part name and the server needs an Idempotency-Key per file (11-30 summary), as 11-22's `uploadPhoto(lineId, slot, file, fileName, key)`.
- **Fix:** `uploadSharePicture(file, fileName, idempotencyKey)`.
- **Committed in:** `69925a41`

**3. [Rule 2 - Missing critical functionality] A picture change must not hide someone else's change**
- **Found during:** Task 1 (design of the version rule, 11-30 OI-1)
- **Issue:** the plan says to refetch the settings after a picture change so the next save is not a 409. Taking the new version blindly would also take the version of a change another Manager made in the meantime, and the next save would then overwrite their change with no banner (the rule in `BusinessInfoTab`: a refetch from elsewhere cannot hide a stale save).
- **Fix:** the form takes the re-read settings' version only when the business fields in them still equal the form's saved baseline. Two tests: the normal case saves with the new version; with another Manager's tagline change in between, the save ends in the stale banner with the typed words kept.
- **Files modified:** `BusinessInfoTab.tsx`, `BusinessInfoTab.test.tsx`
- **Committed in:** `69925a41`

**4. [Process] The Business Info layout changed so the card could be outside the form**
- **Issue:** the plan puts card 6 outside the form element, and the UI-SPEC puts it between Email and Time zone, with Save at the end of the panel. One `<form>` around everything cannot do both.
- **Fix:** the form element wraps cards 1 to 5 only; Save Business Info names it with the `form` attribute. The 11-12 and 11-34 unit tests and the older e2e journeys (save, conflict, Load Latest) pass.
- **Committed in:** `69925a41`

**5. [Process] Files outside the plan's list:** `docs/web/e2e.md` (the `@site-content-share` row) and `deferred-items.md` (D-34-1). Task 2's `siteContentCopy.ts` change was made in Task 1 (the wording lives in one block).

**6. [Out of scope, logged] The older 320px Business Info journey fails**
- **Issue:** `@site-content-business at 320px ...` fails on `holdsItsContent` for the tab strip (Chromium, Firefox, Pixel, iPhone) and times out in WebKit in `openSiteContent`. This plan changed neither. It was not run on the base tree, so "not caused by this plan" rests on the failing line and on the line before it (the page's sideways scroll, which a wider card would break) passing.
- **Action:** logged in `deferred-items.md` as D-34-1 with a suggested fix. Not fixed here.

---

**Total deviations:** 4 auto-fixed or process changes, 1 out-of-scope item logged. **Impact:** no schema, package, server or contract change; the public bundle is unchanged.

## Issues Encountered

- **Port 5199 was often held by another executor's e2e, Lighthouse and `@fonts` runs.** My first attempt at the Task 2 e2e stopped at "https://localhost:5199/health is already used", the same happened to the layout run, and my retries waited a long time. The `npm run e2e` script resets `CSPS_E2E` before it checks the port, so each refused start still reseeded that shared database; if another run showed odd demo data around 23:35 and 00:15 (-06:00), that is the cause. Nothing was killed.
- **The 320px lines of the layout journey.** The older 320px journey stops at the tab-strip line before its axe check, so after the 15 passed run I added `NO_SIDEWAYS_SCROLL` and `expectNoAxeViolations(page)` at 320px to the last `@site-content-share` journey and ran it alone once port 5199 was free: 5 of 5 passed (see Verification evidence).
- Full admin vitest run: five load flakes, each passing alone (above).
- No shell of mine is left running.

## Known Stubs

None.

## Authentication Gates

None.

## Threat Flags

None new. T-11-85 (photo metadata in the share picture): only the redrawn file from `prepareImage` is sent, under the prepared name (tested), and the server strips again (11-30). T-11-SC: no package was added or bumped (`web/package.json` and the lock file are unchanged; `npm ci --ignore-scripts` ran once from the lockfile).

## Owner items (open, nothing blocks the plan; recommendation first)

**OI-1. A 404 on Remove Picture counts as removed.** If the picture is already gone (someone removed it first), the card empties, says "Picture removed" and reads the settings again, as 11-22 did for line photos (its OI-5). Options: **(a) keep (recommended)**; (b) show the server's line "There's no link preview picture to remove." in the question instead.

**OI-2. New words.** The preview's name for a screen reader is "The link preview picture". The empty frame's name is "No picture yet (no image yet)" (the shared placeholder adds "(no image yet)" to its label). Options: **(a) keep (recommended)**; (b) your own words (the first is one constant, `siteContentCopy.business.sharePicture.alt`; the second needs a change in `MediaPlaceholder` or a wrapper).

**OI-3. Save Business Info is not held while a picture saves.** The picture and the form share the settings row version. If someone presses Save Business Info in the few seconds a picture is on its way, one of the two may answer "changed by someone else" and the banner shows. Options: **(a) keep (recommended; rare, and the banner and Load Latest recover it)**; (b) hold Save (aria-disabled) while the picture saves.

**OI-4. The preview asks for the 640 picture on a wide screen.** `PhotoSlot` passes no `sizes` to its image, so a browser may pick the 640px candidate for a 320px box. It costs a few KB on the admin screen only. Options: **(a) leave it (recommended)**; (b) add an optional `sizes` prop to `PhotoSlot` for the share picture and the line photos.

## User Setup Required

None - no external service configuration required. (The owner step from 11-19 and 11-30, running the Cloudinary setup command so the named sizes exist, still stands before the first live picture.)

## Next Phase Readiness

- **11-37 (audit labels):** nothing new here; the label for `site-settings.share-picture-changed` ("Link preview picture changed") stays with 11-37.
- **11-38 (go-live):** after the live deploy, check a shared link in the Facebook Sharing Debugger (11-30 OI-4); the new picture has a new random id every time, so Facebook does not keep an old one.
- **Merge hot spots:** `siteContentCopy.ts`, `siteContentFixtures.ts`, `BusinessInfoTab.tsx` (the form element now ends after Email), `useSiteSettingsQuery.ts`, `siteSettingsService.ts`, `docs/web/e2e.md`, `deferred-items.md`, `site-content-business.spec.ts`.
- **Bundle:** unchanged for the public pages (see Verification evidence); the card adds to the Site Content chunk only (SiteContentPage 159.96 to 160.85 KB raw).
- STATE.md and ROADMAP.md were not touched (orchestrator owns them). PUB-04 and CONT-01 are shared with other plans, so the orchestrator should mark them only after the last plan that declares each.

## Self-Check: PASSED

- Files: `SharePictureCard.tsx` and `SharePictureCard.test.tsx` exist on disk (checked with `ls`).
- Commits `6e9356f7`, `69925a41`, `0ecd6413`, `7d839335` and `35b77935` are in the branch history (`git log` from the base `8b9defc5`); each RED commit precedes its GREEN commit.
- The measured commit count is 5 (`git rev-list --count 8b9defc5..HEAD` before this SUMMARY commit), read against the base id kept in the per-plan ledger file; `plan_head_after` is `35b77935`.
- `git status` showed only this SUMMARY and `deferred-items.md` before the SUMMARY commit (the Playwright `test-results`, `.e2e-dist` and `.locks` folders are git-ignored).

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-13*

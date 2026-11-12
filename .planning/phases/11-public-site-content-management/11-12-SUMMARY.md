---
phase: 11-public-site-content-management
plan: 12
subsystem: ui
tags: [react, react-hook-form, zod, site-content, admin, playwright, dirty-guard, conflict-banner]
created: 2026-11-12T02:40:00-06:00
updated: 2026-11-12T02:40:00-06:00

requires:
  - phase: 11-09
    provides: "PUT and GET /api/v1/site-settings, the validator messages, tests/fixtures/site-link-cases.json"
  - phase: 11-10
    provides: "invalidatePublicContent(), the public data store, the demo seed and the site content lock for e2e"
provides:
  - "A Manager-only Site Content area: Site Content item (globe) after Settings in the sidebar and the phone drawer, lazy route with a loader redirect, S0 page with a ?tab= strip"
  - "The Business Info tab: six cards, one Save Business Info with the version it opened with, Undo Changes, the 409 banner, the dirty guard and per-tab loading and error states"
  - "businessInfoSchema: a zod mirror of every 11-09 rule with the server's own messages, tested on the shared phone and link case files"
  - "PhoneNumbersField: one to four rows, one native Main number radio group, add and remove focus rules, an announcement when the main number moves"
  - "siteSettingsService.update, useSiteSettingsQuery, useUpdateSiteSettings (clears the public data in this browser), useSiteContentTab"
  - "Icons chevron-up and globe, CONTENT_NAV_ITEM, the siteContentFixtures test helpers and the @site-content-business e2e journey"
affects: [11-16, 11-20, 11-24, 11-32, 11-34, 11-37]

requirements-completed: [CONT-01, PUB-03]

actuals:
  tokens: 41800
  tasks: 3
  commits: 8
plan_head_before: 55de352361614eb9640c074a0c5290e934c83ff8
plan_head_after: 7157a72e5d2a11827a8ce4554a7c5db41e51e015

tech-stack:
  added: []
  patterns:
    - "A page of tabs takes a `panels` map (tab to a function that draws it), so a later plan adds its tab in one place and the dirty and tab-change rules are tested with two tabs today"
    - "A tab reports `onDirtyChange`; the page asks Discard changes? on a tab change and, through useUnsavedChangesGuard, on an in-app move and a reload"
    - "Phone rows read their own number and main flag through useWatch on the field, never through the list's row objects (the React Compiler would reuse a stale value, RHF changes those objects in place)"
    - "e2e: sign in before the site content lock, hold the lock only for the work on the shop facts, and use press() for Safari"

key-files:
  created:
    - web/src/modules/admin/pages/SiteContentPage.tsx
    - web/src/modules/admin/components/BusinessInfoTab.tsx
    - web/src/modules/admin/components/PhoneNumbersField.tsx
    - web/src/modules/admin/components/siteContent.recipe.ts
    - web/src/modules/admin/hooks/useSiteContentTab.ts
    - web/src/modules/admin/hooks/useSiteSettingsQuery.ts
    - web/src/modules/admin/siteContentCopy.ts
    - web/src/modules/admin/siteContentSchemas.ts
    - web/src/test/siteContentFixtures.ts
    - web/e2e/site-content-business.spec.ts
  modified:
    - web/src/components/brand/icons.ts
    - web/src/components/navigation/Sidebar.tsx
    - web/src/components/navigation/index.ts
    - web/src/modules/admin/sections.ts
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/services/siteSettingsService.ts
    - docs/web/e2e.md

key-decisions:
  - "SiteContentPage takes a `panels` map; the route gives it the one built tab (Business Info). It is what lets the Discard changes? tab rule be tested now, and what later plans extend"
  - "After a save the settings answer goes into the query cache (setQueryData); there is no second GET, the PUT answer has the same shape"
  - "Load Latest asks Discard changes? first (owner rule in the plan), then reads the settings again and replaces the typed values and the version"
  - "The embed field cuts a pasted Google embed code down to its src link on blur; the schema itself stays strict (link only), as the server and the shared case file are"
  - "The link-preview picture card and its copy are left to plan 11-34, which owns them"

patterns-established:
  - "createListParams tab hook for a page of tabs: default stays out of the URL, a change replaces, a bad value is cleaned with one replace"
  - "Server 400 field errors are placed by key (`phones[1].number` becomes `phones.1.number`, `phones` becomes the list's root error), case-insensitively, and the first one gets focus"

duration: about 1h 30m
completed: 2026-11-12
status: complete

coverage:
  - id: D1
    description: "A Manager sees Site Content (globe) after Settings in the sidebar and the phone drawer, never in the tab bar; an Admin never does, and an Admin who opens /admin/site-content is sent to /admin by the route loader"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "web/src/components/navigation/Sidebar.test.tsx (Sidebar Site Content item); web/src/components/navigation/MobileNavDrawer.test.tsx; web/src/layouts/AdminLayout.test.tsx; web/src/modules/admin/routes.test.tsx (Manager-only routes, Site Content for Managers); web/src/modules/admin/sections.test.ts"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-business.spec.ts an Admin who opens Site Content is sent to the dashboard (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The S0 page shows the h1, the Manager only badge, View Website (new tab, hidden warning) and the tab strip; the tab lives in ?tab= and the default stays out of the URL"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/SiteContentPage.test.tsx; web/src/modules/admin/hooks/useSiteContentTab.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Manager changes the tagline, saves with Save Business Info (the version it opened with), sees the success toast with focus left on Save, and the public footer shows the new tagline in the same browser"
    requirement: "PUB-03"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/BusinessInfoTab.test.tsx (saving the tagline); web/src/modules/admin/hooks/useSiteSettingsQuery.test.tsx; web/src/modules/admin/services/siteSettingsService.test.ts"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-business.spec.ts a Manager changes the tagline, saves, and the public footer shows it (5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every Business Info rule runs in the browser first with the server's own message, tested on the shared phone and link case files; the first invalid field gets focus; nothing is sent while a rule is broken; server field errors land on their fields and win"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/siteContentSchemas.test.ts (242 tests); web/src/modules/admin/components/BusinessInfoTab.test.tsx (every rule runs in the browser first; what the server says wins)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The phone repeater holds one to four rows with one Main number, the first row starts as main, removing the main hands it to the first remaining row with an announcement, Add Number is hidden at four, the only row has no Remove, and the focus rules hold"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PhoneNumbersField.test.tsx (19 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Pasting the whole Google embed code into Map embed link keeps only its src link on blur; a src that is not a Google embed link is refused and left as pasted"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/siteContentSchemas.test.ts (reduceEmbedCode); web/src/modules/admin/components/BusinessInfoTab.test.tsx (embed code)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A stale save shows the ConflictBanner at the top of the panel with the typed values kept; Load Latest asks Discard changes? and then shows the server values and uses the new version; Undo Changes resets every field and is aria-disabled while nothing changed"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/BusinessInfoTab.test.tsx (a stale save; Undo Changes)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-business.spec.ts a second Manager saving first makes the first save show the conflict banner (5 projects)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Leaving the tab, navigating away or reloading with unsaved changes asks Discard changes? first; a tab with its own loading and error states never blanks the others"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/SiteContentPage.test.tsx (leaving a tab with unsaved changes); web/src/modules/admin/components/BusinessInfoTab.test.tsx (loading and failing)"
        status: pass
    human_judgment: false
  - id: D9
    description: "At 320px the page never scrolls sideways, the tab strip holds itself, a phone row stacks, and axe finds nothing"
    requirement: "CONT-01"
    verification:
      - kind: e2e
        ref: "web/e2e/site-content-business.spec.ts at 320px the page has no sideways scroll (5 projects)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/siteContent.recipe.node.test.ts"
        status: pass
    human_judgment: false
  - id: D10
    description: "The Site Content cards, the phone row and the Time zone and money rows look like the approved Settings and My Profile cards, and read well"
    requirement: "CONT-01"
    verification: []
    human_judgment: true
    rationale: "The screens are SPEC-GAP (C-17), built from the My Profile card parts; no parity scenario exists for them. The owner judges them in the UI review"
  - id: D11
    description: "MUST NOT let an Admin reach or save Site Content from the client (prohibition for CONT-01)"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/routes.test.tsx an Admin who opens /admin/site-content lands on the dashboard; an Admin sees no Site Content item"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-business.spec.ts an Admin who opens Site Content (5 projects)"
        status: pass
    human_judgment: true
    rationale: "The prohibition is flagged for judgment in the plan: the client checks pass, and the server's 403 (plan 11-09) is the real gate"
---

# Phase 11 Plan 12: A Manager edits the business info in Site Content and sees it on the website Summary

**A Manager-only Site Content area with a Business Info tab that checks every server rule in the browser (zod, the server's own messages, the shared phone and link case files), saves with the version it opened with, shows the 409 banner and the Discard changes? guard, and clears the public data in this browser so the website shows the change.**

## Performance

- **Duration:** about 1h 30m
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files in the diff:** 33 (17 created, 16 modified), 4014 lines added; the added text is about 41,800 tokens on the chars/4 scale (the plan estimated 140,000)

## Accomplishments

- **Nav and route.** `CONTENT_NAV_ITEM` (globe) follows Settings in the sidebar and the phone drawer for Managers only, never in the tab bar. `/admin/site-content` is a lazy route behind the Manager loader, so an Admin goes to `/admin`. `sections.ts` marks the item current for `/admin/site-content` and `/admin/site-content/products/*`.
- **S0 page.** h1, Manager only badge, View Website (new tab, hidden " (opens in a new tab)"), the tab strip with `?tab=` (business is the default and stays out of the URL). Only built tabs show; a tab that is not built reads as Business Info.
- **Business Info.** Six cards (Business, Address and map, Phone numbers, Messenger and social links, Email, Time zone and money read-only) and RecordMeta. One `Save Business Info` sends the version the form opened with; "Saving" on the pressed button; the toast "Business info saved"; focus stays on Save; `invalidatePublicContent()` clears the public store in this browser.
- **OR-3.** `businessInfoSchema` mirrors `UpdateSiteSettingsRequestValidator`, `SiteLinks` and `PhilippinePhone` rule for rule with the server's exact messages. 242 schema tests, including every case of both shared fixture files. A field checks when it is left, every rule runs on submit, the first invalid field takes focus, and nothing is sent while a rule is broken. A 100-character name with an n-tilde passes and 101 fails.
- **PhoneNumbersField.** One to four rows, one native radio group named "Main number, {number}", Add Number focuses the new row, a removal focuses the next row's Number (else the previous, else Add Number), removing the main hands it to the first remaining row and announces "{number} is now the main number.", Add Number is hidden at four with the note, and the only row has no Remove.
- **Embed paste.** On blur the Map embed field keeps only the `src` of a pasted Google embed code (`reduceEmbedCode`); a `src` that is not a Google embed link is left as pasted so the rule refuses it. `data-src` is never read.
- **Conflict and dirty rules.** A 409 `edit.stale` shows the shared ConflictBanner at the top of the panel with the typed values kept and focus on Load Latest; Load Latest asks Discard changes? and then replaces the values and the version. Undo Changes resets every field and is `aria-disabled` while nothing changed. A tab change, an in-app move and a reload with unsaved changes ask first.
- **Server 400.** Field errors are placed by key under their fields (a phone row as `phones[1].number`, the list as `phones`), win over the browser's, and take focus; a key this form does not draw becomes a danger toast.

## Task Commits

1. **Task 1 (tracer): a Manager opens Site Content, changes the tagline, saves, and the public footer shows it** - RED `64ac3de5`, GREEN `69003c74`
2. **Task 2: every Business Info field checks its rule in the browser with the server's message** - RED `e2247fcd`, GREEN `4e895359`
3. **Task 3: conflicts, unsaved changes and failures** - RED `43f21948`, GREEN `35165d24`, e2e fix `7ad181ef`, showcase icon count `7157a72e`

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier was not required. Each RED commit precedes its GREEN commit and every RED was run and read before the commit.

- **Task 1 RED** (`64ac3de5`): 15 tests failed on assertions in files that already existed (Sidebar, MobileNavDrawer, Icon, index barrel, sections, the service's `update`), plus 4 new test files that could not load because the new modules did not exist yet (`BusinessInfoTab`, `useSiteContentTab`, `useSiteSettingsQuery`, `SiteContentPage`). `AdminLayout.test` and `routes.test` were edited in the same commit and run at GREEN. For the new modules the RED is a missing import, not a stub that fails an assertion; I did not write compile-only stubs.
- **Tracer gate:** Task 1's `<verify>` is automated only. It was re-run before expansion: the first `@site-content-business` run passed 3 of 5 projects; WebKit and iPhone failed because Safari does not focus a button on click, so the test now presses Save from the keyboard (`press()`), and the second run passed 5 of 5 (`5 passed (50.8s)`).
- **Task 2 RED** (`e2247fcd`): `siteContentSchemas.test` 240 of 242 failed (the schema and helpers did not exist, a `TypeError` on `safeParse`), `PhoneNumbersField.test` could not load, `BusinessInfoTab.test` 19 of 29 failed on assertions.
- **Task 3 RED** (`43f21948`): 15 of 55 failed on assertions (banner, Load Latest, Undo Changes, the page's dialog and `beforeunload`). Four tests passed at RED (Loading the business info, Couldn't load with Try Again, Try Again reads again, axe in the error state): the loading and error states came with Task 1's `LoadingRegion` and `ErrorState`, so they are regression guards, not RED proof.
- No REFACTOR commit was needed.

## Verification evidence (real output)

- **Task 1 verify** (the plan's command, rerun on the final tree): `Test Files 13 passed (13)`, `Tests 490 passed (490)`. `AdminLayout.test` and `routes.test` (not in that command, but they pin the nav) with `Sidebar.test` and `SiteContentPage.test` at Task 1 GREEN: `Tests 189 passed (189)`.
- **Task 2 verify** (final tree): `Test Files 3 passed (3)`, `Tests 301 passed (301)`. The class gate for the new recipe: `siteContent.recipe.node.test.ts` `2 passed`.
- **Task 3 verify** (final tree, with `no-long-dash.node.test.ts`): `Test Files 3 passed (3)`, `Tests 56 passed (56)`.
- **Lint and types:** `npm --prefix web run typecheck`: exit 0, no output after the three `tsc` lines. `npm --prefix web run lint`: exit 0, `eslint . --max-warnings 0`, no output.
- **e2e `@site-content-business`** (final run, all five projects, 4 tests each): `20 passed (2.3m)`. The first full run was `14 passed, 6 failed (14.5m)`: 5 were test timeouts while waiting on the shared site content lock (every test signed in inside the lock) and 1 was a Firefox "downloadable font: download failed" console error when the Admin test loaded a second page mid font load. Fixes: sign in before the lock, the 320px test does not take the lock, the Admin test reads the shell on the page it was sent to. Not a flake of the app; recorded as a test design problem.
- **Public and admin bundle** (e2e build, gzip, limit 150 KB public and 250 KB admin): home 141.66, products 142.05, gallery 147.02, contact 149.21, notFound 142.21, admin 220.42, CSS 17.73 (after 11-10: home 141.16, products 141.56, gallery 146.52, contact 148.72, notFound 141.72, admin 220.01). The two new icons live in the shared icon set, which every public page carries.
- **Acceptance greps:** `'chevron-up'` in icons.ts 1 and `globe` 1; `site-content` in routes.tsx 1; `invalidatePublicContent` in BusinessInfoTab.tsx 1 (a comment; the call is in `useSiteSettingsQuery.ts`, 2); `philippine-phone-cases.json` in the schema test 3 and `site-link-cases.json` 3; `jitless` in the schema 1; `ConflictBanner` in BusinessInfoTab.tsx 3; `SPEC-GAP` in SiteContentPage.tsx 1; `git log 55de3523..HEAD -- web/package.json web/package-lock.json` prints nothing.
- gitleaks ran in the pre-commit hook for every commit: `no leaks found`. The values in the diff are made up (`example.test`, `cspsdemo`, `0917 123 4567`).
- **Full web unit suite** (`npx vitest run`, run after the Task 3 code, before the last test-only commit): `Test Files 3 failed | 341 passed (344)`, `Tests 3 failed | 9580 passed (9583)`. The three: (1) `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions": the known fresh-worktree install failure (license-checker finds no packages), touches no package file; (2) `ComponentShowcasePage.test.tsx` "shows all 69 icons": a test that pinned the old icon count, fixed in `7157a72e` (now 71, file passes: 33 tests); (3) `routes.test.tsx` "/dev/public shows the real public layout": the page title was still "Sign in · CSPS Admin" when it was read, once, at 312 ms under the parallel load; the file passed alone twice (`64 passed`) and in the first run of this plan, so it is recorded as a flake of an assertion that reads the title with no wait, not a failure of this plan.

## Decisions Made

- **`panels` map on the page.** `SiteContentPage({ panels })` draws only the tabs given; `SiteContentRoute` gives it Business Info. This is the one test seam: it lets the Discard changes? tab rule be tested with a second tab today, and a later plan adds its tab with one line.
- **No second read after a save.** The plan says "the query refetch". The PUT answers the settings as saved, in the shape of the GET, so the hook puts it in the cache (`setQueryData`) and clears the public data. A second GET would only repeat it.
- **The save version is the one the form opened with.** A refetch (window focus) cannot hide a stale save; the server answers 409 and the banner shows.
- **Strict schema, forgiving field.** The schema accepts only a link for the map embed (the shared case file refuses the iframe code); the field reduces the pasted code on blur before the rule runs.
- **Copy is complete for the cards this plan draws.** The link-preview picture card and its strings belong to plan 11-34 and are not in `siteContentCopy.ts`.
- **RecordMeta shows "Recorded by: Not set".** The settings have a last changer but no creator, and RecordMeta always draws both rows. I left the shared component alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Phone rows showed a stale number in the radio name**
- **Found during:** Task 2
- **Issue:** PhoneNumbersField read each row through `useWatch({ name: 'phones' })`. React Hook Form changes those row objects in place, and the React Compiler reuses a value it derived from the same object, so the radio name stayed "Main number, number 1" while the number was typed.
- **Fix:** a `PhoneRow` child reads its own number and main flag with `useWatch` on the field (single values); the parent uses `getValues` inside handlers.
- **Files modified:** `web/src/modules/admin/components/PhoneNumbersField.tsx`
- **Verification:** `PhoneNumbersField.test.tsx` "follows what is typed into the Number in the radio name" failed before, passes after. **Commit:** `4e895359`

**2. [Rule 3 - Blocking] The e2e test could not wait on the lock for five projects**
- **Found during:** Task 3 (e2e)
- **Issue:** 14 of 20 passed; 5 timed out and 1 failed on a Firefox font console error (see Verification).
- **Fix:** sign in before the lock, the 320px test without the lock, the Admin test without a second page load, 480 s timeouts. **Commit:** `7ad181ef`

**3. [Rule 3 - Blocking] Safari does not focus a button on click**
- **Found during:** Task 1 tracer gate (WebKit and iPhone)
- **Fix:** the spec presses Save with `press(page, button)` (focus, then Enter), as the other specs do. **Commit:** `69003c74`

**4. [Rule 3 - Blocking] A test that pinned the icon count**
- **Found during:** the full unit run after Task 3
- **Issue:** `ComponentShowcasePage.test.tsx` counted 69 icons; the set now has 71.
- **Fix:** the title and the count say 71. **Commit:** `7157a72e`

**5. [Rule 3 - Blocking] Test details**
- The View Website name is matched with `\s*` before "(opens in a new tab)" (jsdom drops the space, as the public Directions test does); `Promise.withResolvers` is not in the TypeScript lib, so the tests use `createDeferred`; the schema test needs `// @vitest-environment node` to read the shared fixture files; a navigation test clicks a real link (a script `router.navigate` logs an act warning). **Commits:** `69003c74`, `e2247fcd`, `35165d24`

### Plan wording and process notes

**6. [Process] `siteContentSchemas.ts` starts in Task 1.** It is listed only in the plan's top-level files. Task 1 needs the form values and the request mapping, so the file began there and Task 2 added the schema.

**7. [Process] The ledger file.** `gsd-plan-head-before-11-12` was written after the base was checked and before the first commit; `commits: 8` is `git rev-list --count 55de3523..HEAD` before this SUMMARY commit.

**8. [Plan wording] One tab, so no strip overflow to prove.** The tab strip is built from the tabs that exist (one). The e2e proves the strip holds itself and the page does not scroll at 320px; the sideways scroll of the strip itself is the inherited `Tabs` behavior and becomes visible when 11-16 and later plans add tabs.

**Total deviations:** 1 Rule 1, 4 Rule 3, 3 notes. **Impact:** no scope creep; no package, schema, migration or trigger.

## Issues Encountered

- The first e2e run needed the fixes above; the final run is clean.
- `docs/web/e2e.md` is the only guide edited. A sweep case for `/admin/site-content` in `expenses-sweep.spec.ts` (8 widths, two themes) was not added: it is not in the plan's file list.
- Not run here: Lighthouse, parity (no parity scenario draws these screens), the Windows deploy job.

## Owner items (park for review)

1. **Conflict banner wording.** The shared ConflictBanner says "This was changed by someone else." and "Reload and try again. Your typed changes stay here until you press Load Latest." The UI-SPEC Validation table lists "Someone else changed this" / "Reload to see the latest version, then make your change again." for this case. I used the shared component as the plan says. Options: **(a) keep the shared words (recommended, every form says the same)**; (b) change the shared component's words for all forms.
2. **Load Latest question wording.** "Load Latest replaces what you typed with the saved version. Your typed changes are lost." is mine (SPEC-GAP). Options: **(a) keep (recommended)**; (b) reuse the longer tab-change sentence.
3. **"Recorded by: Not set" on Business Info.** See Decisions Made. Options: **(a) keep as is (recommended, shared component untouched)**; (b) a small RecordMeta option that hides the Recorded by row.
4. **Public bundle room.** The two new icons add about 0.5 KB gzip to every public page. Contact is at 149.21 KB of 150 (0.79 KB left), Gallery 147.02. Plans that add to Contact must load their parts lazily.
5. **Bracket-text wording (P11-BL-02).** The zod messages use the 11-09 wording "Replace the text in square brackets with the real words." (built as option A); if the owner changes it, `SiteLinks.PlaceholderTextMessage` and `SITE_CONTENT_COPY.errors.placeholderText` change together.

## Known Stubs

None.

## Threat Flags

None new. T-11-28: the route loader sends an Admin to `/admin`, the nav item renders for Managers only, the server's 403 (11-09) is the gate; checked in unit and e2e. T-11-29: `reduceEmbedCode` keeps only a `src` that starts with the Google embed prefix (a hostile or `data-src` value is left as typed and refused), nothing pasted is rendered as HTML, and the server refuses any other value. T-11-SC: no package added or bumped; `web/package.json` and the lock file are unchanged (`npm ci --ignore-scripts` ran only from the lockfile).

## User Setup Required

None.

## Next Phase Readiness

- Plan 11-16 adds the Hours & Closures tab: give `panels` an `hours` entry that reports `onDirtyChange`; the tab strip, the `?tab=` parser and the Discard changes? rule are ready. The hours tab can reuse `siteContent.recipe.ts`, `siteContentCopy.ts` and `useSiteSettingsQuery`'s pattern.
- Plan 11-34 adds the link-preview picture card to the same tab: its strings and the card go between Email and Time zone and money.
- Plan 11-37 still owes the audit label for `site-settings.changed` and the count 102 (see the 11-09 SUMMARY).
- The shared requirement IDs CONT-01 and PUB-03 are shared with other plans; the orchestrator should mark them complete only after the last plan that declares each one.
- STATE.md and ROADMAP.md were not touched (orchestrator owns them).

## Self-Check: PASSED

All created files exist on disk and the eight plan commits (`64ac3de5`, `69003c74`, `e2247fcd`, `4e895359`, `43f21948`, `35165d24`, `7ad181ef`, `7157a72e`) are ancestors of HEAD. `git rev-list --count 55de3523..HEAD` was 8 before this SUMMARY commit.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*

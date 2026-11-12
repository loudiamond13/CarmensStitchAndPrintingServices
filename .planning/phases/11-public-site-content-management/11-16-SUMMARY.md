---
phase: 11-public-site-content-management
plan: 16
subsystem: ui
tags: [react, react-hook-form, zod, site-content, admin, opening-hours, closures, playwright, dirty-guard, conflict-banner]
created: 2026-11-12T06:10:00-06:00
updated: 2026-11-12T06:10:00-06:00

requires:
  - phase: 11-11
    provides: "GET and PUT /api/v1/opening-hours, the validator messages, the week version"
  - phase: 11-12
    provides: "SiteContentPage with its panels map, the dirty and tab-change rules, siteContent.recipe, siteContentCopy, siteContentSchemas, the e2e lock and seed helpers"
  - phase: 11-13
    provides: "GET, POST, PUT and DELETE /api/v1/shop-closures, the overlap line under firstDay, OI-1 option A (an edit keeps a past first day)"
  - phase: 11-05
    provides: "summarizeOpenDays in utils/hours.ts"
provides:
  - "The Hours & Closures tab (?tab=hours) of Site Content: the Opening hours card and the Holidays and closures card, each with its own loading and error states"
  - "Opening hours card: seven day rows (checkbox, Opens and Closes every 30 minutes from 5:00 AM to 11:30 PM, Closed), a Visitors see preview, Save Hours with the week version, Undo Changes, the 409 banner, Load Latest after Discard changes?, and the dirty report to the page"
  - "Closures card: upcoming closures with Edit and Delete named by date, Add Closure, the empty state, the delete question with its focus rules, and the 404 Already deleted path"
  - "ClosureModal: First day on the server's business today, Last day, Public note, every server rule checked first, the overlap line under First day, the discard guard and the 409 banner"
  - "hoursSchema and closureSchema (OR-3) with the server's own messages, plus the form value and request mappers"
  - "openingHoursService, shopClosuresService, useOpeningHoursQuery, useShopClosuresQuery and the three closure write hooks; every write clears the public data in this browser"
  - "Test fixtures: demoOpeningHours, demoClosures, openingHoursBackend, shopClosuresBackend, businessTodayIs; the @site-content-hours e2e journeys (5 projects)"
affects: [11-14, 11-20, 11-24, 11-32, 11-34, 11-37]

requirements-completed: [CONT-04, CONT-01, PUB-05]

actuals:
  tokens: 40400
  tasks: 3
  commits: 6
plan_head_before: a4a03788fd5d0bea05b702a2f7e3ea347fb2d76c
plan_head_after: a56a76630489105eb74b7457a81a3812814cf756

tech-stack:
  added: []
  patterns:
    - "The week is read as 21 plain values (open, opensAt and closesAt of each day) through one useWatch with a name list, never through row objects (the React Compiler rule from 11-12); unsaved is sameWeek(week, baseline), so ticking and unticking a day leaves it clean"
    - "A closed day keeps no meaning in its times: toOpeningHoursRequest sends null for it, so the form can hold leftover times and still be clean"
    - "A list card moves focus after a write through a ref and an effect that runs after every render: after a save to the saved row's Edit once the list holds it and has stopped fetching; after a delete to the next row's Edit, else the previous, else Add Closure"
    - "A closure window reads the list again for Load Latest through queryClient.query, so the card's list and the window agree without a second observer"

key-files:
  created:
    - web/src/modules/admin/components/HoursTab.tsx
    - web/src/modules/admin/components/OpeningHoursCard.tsx
    - web/src/modules/admin/components/ClosuresCard.tsx
    - web/src/modules/admin/components/ClosureModal.tsx
    - web/src/modules/admin/components/SiteContentCard.tsx
    - web/src/modules/admin/services/openingHoursService.ts
    - web/src/modules/admin/services/shopClosuresService.ts
    - web/src/modules/admin/hooks/useOpeningHoursQuery.ts
    - web/src/modules/admin/hooks/useShopClosuresQuery.ts
    - web/e2e/site-content-hours.spec.ts
  modified:
    - web/src/modules/admin/pages/SiteContentPage.tsx
    - web/src/modules/admin/siteContentSchemas.ts
    - web/src/modules/admin/siteContentCopy.ts
    - web/src/modules/admin/components/siteContent.recipe.ts
    - web/src/test/siteContentFixtures.ts
    - docs/web/e2e.md

key-decisions:
  - "The tab is a new panels entry; Business Info and Hours & Closures are the two built tabs, so the route-level tests that listed one tab now list two and the 'tab that is not built yet' test uses ?tab=products"
  - "The dirty report (onDirtyChange) is wired in Task 1 with the card, because HoursTab takes the prop from the first commit; Task 3's page-level tests are therefore regression guards for it"
  - "A saved time that is not on the 30-minute list is kept as one more choice in its place, so opening the tab never changes a value by itself; the schema still flags it until a listed time is chosen"
  - "The Visitors see line carries its label on the first line only ('Visitors see: Mon-Sat · 9:00 AM - 6:00 PM'), later runs of days follow as their own lines ('Sun · 10:00 AM - 3:00 PM')"
  - "The e2e journeys check the public site read (/api/v1/public/site) for Sunday's hours and the closure, not the Contact page, because the Contact hours card belongs to plan 11-14 (a parallel plan that is not in this base)"
  - "On an edit the zod first-day check follows OI-1 option A: an unchanged past first day passes, a moved first day must be today or later; the business today comes from useBusinessToday and the check is skipped while it is not known"

patterns-established:
  - "SiteContentCard: one h2 card with a hint, an optional head action and an optional footer, for every Site Content tab that is not one big form"
  - "Select with a visible 'Opens' (aria-hidden) and a visually hidden 'Monday opens' in the same label"

duration: about 1h 25m
completed: 2026-11-12
status: complete

coverage:
  - id: D1
    description: "The Opening hours card shows seven rows Monday to Sunday, a day checkbox ticked for open days, Opens and Closes selects every 30 minutes from 5:00 AM to 11:30 PM named '{Monday} opens' and '{Monday} closes', Closed for an unticked day, and a newly ticked day starts at 9:00 AM to 6:00 PM"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/HoursTab.test.tsx (the Opening hours card; ticking Sunday open and saving)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-hours.spec.ts a Manager ticks Sunday open 10 to 3 (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A labelled preview under the rows reads 'Visitors see: Mon-Sat · 9:00 AM - 6:00 PM' (further runs on their own lines) or 'Visitors see: Closed every day', built with summarizeOpenDays"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/HoursTab.test.tsx (reads the week to visitors; reads Closed every day; starts a ticked day at 9:00 AM to 6:00 PM and updates the preview)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Save Hours sends PUT /api/v1/opening-hours with the version the form opened with and all seven days (a closed day with null times), shows 'Opening hours saved', clears the public data in this browser and uses the answered version for the next save"
    requirement: "PUB-05"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/HoursTab.test.tsx (sends PUT; shows the toast, clears the public data; sends a second save with the version the first one answered); web/src/modules/admin/hooks/useHoursQueries.test.tsx; web/src/modules/admin/services/openingHoursService.test.ts"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-hours.spec.ts a Manager ticks Sunday open 10 to 3: /api/v1/public/site then carries Sunday 10:00 to 15:00 (5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "OR-3: hoursSchema and closureSchema check every rule the server checks with the server's own messages (opening and closing time required, half hours from 5:00 AM to 11:30 PM, closing after opening, first day required and real and today or later, last day on or after the first and at most 31 days, note at most 80), and the closure mappers send an empty last day or note as null"
    requirement: "CONT-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/siteContentSchemas.test.ts (hoursSchema; closureSchema; the hours and closure form values and request)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Holidays and closures card lists upcoming closures by first day (Date, Public note or the empty-value mark), names Edit and Delete by date, opens ClosureModal from Add Closure, and shows 'No closures coming up' with no extra button when there are none"
    requirement: "CONT-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/HoursTab.test.tsx (the Holidays and closures card)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-hours.spec.ts a Manager adds a closure for next week (5 projects)"
        status: pass
    human_judgment: false
  - id: D6
    description: "ClosureModal starts First day on the server's business today, checks every rule before sending, puts the server's overlap line under First day, asks Discard changes? before closing a changed window, sends one Idempotency-Key per add and the version on an edit, keeps a running closure's past first day when it is left alone, and shows the conflict banner with Load Latest on a stale edit; a save shows the toast, reads the list again, clears the public data and moves focus to that row's Edit"
    requirement: "CONT-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ClosureModal.test.tsx; web/src/modules/admin/components/HoursTab.test.tsx (adding a closure; editing a closure); web/src/modules/admin/services/shopClosuresService.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Delete asks 'Delete this closure?' with the date and the normal-hours line, Cancel focused first; success removes the row, clears the public data and moves focus to the next row's Edit, else the previous, else Add Closure; a 404 closes the question, shows 'Already deleted' and reads the list again"
    requirement: "CONT-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/HoursTab.test.tsx (deleting a closure)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-hours.spec.ts a Manager adds a closure for next week (the delete half, 5 projects)"
        status: pass
    human_judgment: false
  - id: D8
    description: "A stale Save Hours shows the ConflictBanner inside the Opening hours card with the typed choices kept; Load Latest asks Discard changes? then shows the latest week and uses its version; Undo Changes resets and is aria-disabled when clean; leaving the tab, navigating or reloading with unsaved hours asks first; a server 400 lands under the time it names"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/HoursTab.test.tsx (a stale save of the hours; Undo Changes; unsaved hours; what the server says about the hours); web/src/modules/admin/pages/SiteContentPage.test.tsx (leaving the Hours & Closures tab with unsaved hours)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Each card has its own loading ('Loading the opening hours…', 'Loading closures…') and error state with Try Again; one failing card never blanks the other"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/HoursTab.test.tsx (each card fails on its own)"
        status: pass
    human_judgment: false
  - id: D10
    description: "At 320px a day row stacks with Opens and Closes side by side, the page has no sideways scroll and axe finds nothing on the tab, with the closure window open or not"
    requirement: "CONT-01"
    verification:
      - kind: e2e
        ref: "web/e2e/site-content-hours.spec.ts at 320px a day row stacks (5 projects)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/siteContent.recipe.node.test.ts (the hours row recipe)"
        status: pass
    human_judgment: false
  - id: D11
    description: "MUST NOT use the device's date for the closure picker's today: it is the business today from the server (useBusinessToday)"
    requirement: "CONT-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ClosureModal.test.tsx (starts First day on the business today from the server, not the device's date; the tests use a date in 2031); grep: useBusinessToday 3 hits and no 'new Date()' outside comments in ClosureModal.tsx"
        status: pass
    human_judgment: true
    rationale: "The plan marks this prohibition for judgment: the tests and the grep pass, and the server's own check (11-13) is the real gate"
  - id: D12
    description: "The two cards, the day rows, the preview and the closure window look right beside the approved Settings and Site Content cards"
    requirement: "CONT-01"
    verification: []
    human_judgment: true
    rationale: "The screens are SPEC-GAP (C-17), built from the My Profile card parts; no parity scenario draws them. The owner judges them in the UI review"
---

# Phase 11 Plan 16: A Manager sets the weekly hours and adds holidays in Site Content Summary

**The Hours & Closures tab of Site Content: a seven-day opening hours form with a "Visitors see" preview, and a holidays and closures list with a modal and a delete question, all checked in the browser with the server's own messages, with the 409 banner, Undo Changes, the unsaved-changes guard, and a public-data refresh after every write.**

## Performance

- **Duration:** about 1h 25m
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files in the diff:** 25 (10 created, the rest modified); the added text is about 40,400 tokens on the chars/4 scale (the plan estimated 120,000)

## Accomplishments

- **Opening hours card.** Seven day rows Monday to Sunday, each a checkbox with Opens and Closes selects (every 30 minutes, 5:00 AM to 11:30 PM, named "{Monday} opens" and "{Monday} closes"), or the word Closed. A ticked day with no times of its own starts at 9:00 AM to 6:00 PM. "Visitors see: Mon-Sat · 9:00 AM - 6:00 PM" under the rows comes from `summarizeOpenDays`. "Save Hours" sends the version the form opened with and all seven days, and the next save uses the version the last one answered.
- **Closures card and window.** The list shows every closure whose last day is today or later, with "Edit closure on Dec 25, 2026" and "Delete closure on Dec 25, 2026", the empty state "No closures coming up", and Add Closure in the head. ClosureModal starts First day on the server's business today and shows the server's overlap line under First day.
- **Delete.** "Delete this closure?" with Cancel focused; focus moves to the next row's Edit, else the previous, else Add Closure; a 404 says "Already deleted" and reads the list again.
- **OR-3.** `hoursSchema` and `closureSchema` mirror the .NET validators message for message (tested: 38 listed times, off-step and unreadable times, closing at or before opening, a first day before today, 31 versus 32 days across a leap day, an 80 versus 81 character note, a bad first day making no made-up second error). An edit keeps a past first day (OI-1 option A).
- **Conflicts and unsaved changes.** A stale Save Hours shows the shared ConflictBanner inside the card with the typed choices kept; Load Latest asks "Discard changes?" first. Undo Changes resets and is `aria-disabled` while clean. The card reports unsaved hours to the page, so a tab change, an in-app move and a reload ask first.
- **Public data.** Every hours or closure save clears the public store in this browser (`invalidatePublicContent`) and every closure write reads the list again.

## Task Commits

1. **Task 1 (tracer): a Manager ticks Sunday open 10 to 3, saves, and the public site carries those hours** - RED `d71b7bdf`, GREEN `b13ce769`
2. **Task 2: a Manager adds, edits and deletes closures** - RED `99e17bd0`, GREEN `cb019c0c`
3. **Task 3: conflicts, unsaved changes and failures on both cards** - RED `76dbb828`, GREEN `a56a7663`

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) was not required. Each RED commit precedes its GREEN commit, and every RED was run and read before the commit.

- **Task 1 RED** (`d71b7bdf`): 2 tests failed on assertions in `SiteContentPage.test.tsx` (the tab list and `?tab=hours`); the four new files could not load or collect because the modules did not exist (`HoursTab`, `openingHoursService`, `useOpeningHoursQuery`, and `siteContentSchemas.test.ts` threw `hoursValuesOf is not a function` while collecting). For new modules the RED is a missing import, not a stub that fails an assertion; I did not write compile-only stubs (the same approach as 11-12).
- **Tracer gate:** the tracer's `<verify>` is automated only. After GREEN the unit set passed (298 tests) and `@site-content-hours` passed in all five projects (`5 passed (1.1m)`), so the tracer was verified end to end before expansion.
- **Task 2 RED** (`99e17bd0`): 19 schema tests and 16 `HoursTab.test.tsx` tests failed on assertions (one of the 16 is the Task 1 axe test, which timed out at the 5 s default); `ClosureModal.test`, `shopClosuresService.test` and `useHoursQueries.test` could not load (missing modules).
- **Task 3 RED** (`76dbb828`): 12 of the 63 tests in the two files failed on assertions (banner, Load Latest, Undo Changes, the server 400 under a time, the hours error state, one page test needing Undo Changes). Seven new tests passed at RED and are regression guards, not RED proof: the two unsaved-hours reports and two page-level tab questions (the dirty report came with Task 1, see Decisions), the "something went wrong" toast, the loading test and the closures error state (those states came with Task 1 and Task 2).
- No REFACTOR commit was needed.

## Verification evidence (real output)

- **Task 1 verify** (final tree): the plan's five test files plus the recipe and no-long-dash tests, `Test Files 7 passed (7)`, `Tests 298 passed (298)` at Task 1 GREEN. `@site-content-hours`: `5 passed (1.1m)`.
- **Task 2 verify** (final tree): `ClosureModal`, `HoursTab`, `shopClosuresService`, `siteContentSchemas` and the hook, page and recipe tests, `Test Files 9 passed (9)`, `Tests 363 passed (363)`; `@site-content-hours`: `10 passed (1.6m)`.
- **Task 3 verify** (final tree, nine files including `no-long-dash.node.test.ts`): `Test Files 9 passed (9)`, `Tests 383 passed (383)`. `npm --prefix web run typecheck`: exit 0, no output after the three `tsc` lines. `npm --prefix web run lint`: exit 0 (`eslint . --max-warnings 0`, no output); after the last small edits `tsc` (app and node projects) and `eslint src/modules/admin e2e src/test` were run again with no output. `prettier --check src e2e`: "All matched files use Prettier code style!".
- **e2e `@site-content-hours`** (final run, 15 tests over five projects): `15 passed (1.6m)`. The earlier runs of Task 3 are listed under Issues Encountered.
- **Acceptance greps:** `summarizeOpenDays` in OpeningHoursCard.tsx 3; `'hours'` in SiteContentPage.tsx 1; `useBusinessToday` in ClosureModal.tsx 3; `grep -v '^\s*//' ClosureModal.tsx | grep -c "new Date()"` 0; `ConflictBanner` in OpeningHoursCard.tsx 3; `SPEC-GAP` in HoursTab.tsx 1; `Save Closure` in siteContentCopy.ts 1 (the modal reads it from there).
- **Other unit files near the change:** `routes.test.tsx`, `sections.test.ts`, `hooks`, `services` and `layouts` (65 files): `976 passed, 1 failed` (the showcase test at 10 s under load, see Issues Encountered); `routes.test.tsx` alone: `Tests 64 passed (64)`.
- **Gitleaks** ran before each commit (`gitleaks protect --staged` and the pre-commit hook): `no leaks found`. The values in the diff are made up (`example.test`, 2026 and 2031 dates, "Christmas", "Demo holiday", "E2E-holiday").
- **No package change:** `git diff a4a03788..HEAD -- web/package.json web/package-lock.json` is empty (`npm ci --ignore-scripts` ran only from the lock file).
- **Bundle:** not re-measured with `build:budget`. No public module, no shared component and no icon changed; all new code is in the lazy admin SiteContentPage chunk (the e2e build prints it at 56.31 kB, 19.13 kB gzip; it was 39.53 kB, 13.61 kB gzip before this plan).

## Decisions Made

- **The page entry.** `hours` joins `business` in the route's panels; the two route-level tests that pinned "one tab" now list two, and "a tab that does not exist yet" uses `?tab=products`.
- **Dirty report from Task 1.** `HoursTab` takes `onDirtyChange` from its first commit, so the card reports it then. Task 3 adds the tests that prove the page asks, as regression guards.
- **Off-list saved times stay.** An old time that is not a half hour shows as one more choice so nothing changes by itself; the schema flags it until a listed time is chosen.
- **Preview layout.** The label sits on the first line only; each further run of days is its own line without the label.
- **Public checks in e2e.** The Contact page cannot show hours in this base (11-14 is a parallel plan), so the journeys read `/api/v1/public/site`, the data the Contact page and the open status draw from, for Sunday's hours and the closure.
- **Focus after a write** runs in an effect after every render and waits until the list holds the row and has stopped fetching, so a re-sorted row still gets focus.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Contact page has no hours card in this base**
- **Found during:** Task 1 (the e2e behavior line says "opens /contact and sees 'Sunday' with '10:00 AM - 3:00 PM'")
- **Issue:** `ContactPage` does not render the hours or the closures yet; that is plan 11-14, which runs in parallel and is not in this base. Such an assertion could not pass here.
- **Fix:** the journeys check the public site read for Sunday's hours and the closure's note (`upcomingClosures`), and the guide says the Contact page is not asserted. When 11-14 is merged, a Contact assertion (hours rows, "Closed on") can be added to the same spec.
- **Files modified:** `web/e2e/site-content-hours.spec.ts`, `docs/web/e2e.md`
- **Commits:** `b13ce769`, `cb019c0c`, `a56a7663`

**2. [Rule 2 - Missing critical] A closure window needs a "gone" path and a Load Latest**
- **Found during:** Task 2
- **Issue:** the plan names neither the 409 of an edit nor the 404 of a save, but SEC-07 and a deleted-meanwhile closure need an answer.
- **Fix:** a stale edit shows the shared ConflictBanner and Load Latest reads the list again (`useReadClosuresAgain`, `queryClient.query`); a 404 shows one line, "This closure wasn't found. It may have been deleted." (SPEC-GAP, owner item 5) and reads the list again.
- **Files modified:** `ClosureModal.tsx`, `useShopClosuresQuery.ts`, `siteContentCopy.ts`
- **Commit:** `cb019c0c`

**3. [Rule 3 - Blocking] Shared card, and test details**
- `SiteContentCard.tsx` is new and not in the plan's file list: both cards need the same head and footer, and `BusinessInfoTab` keeps its own local card.
- The first axe test timed out at the 5 s default under load (the seven rows hold 14 selects with 38 options each); the two component test files use `vi.setConfig({ testTimeout: 15_000 })`, as other files in this repo do.
- The "none" and "listed" axe tests share a query client, so they are two tests.
- A card's loading skeleton and its error state both show the h2, so tests wait for a control (`Monday`) before reading the heading.
- **Commits:** `b13ce769`, `99e17bd0`, `cb019c0c`

### Plan wording and process notes

**4. [Process] Files outside the plan's list.** `docs/web/e2e.md` got one row for the new tests (the same upkeep 11-12 did); `siteContent.recipe.node.test.ts` got one test for the hours row classes.
**5. [Process] Splitting a shared test file.** `HoursTab.test.tsx` and `SiteContentPage.test.tsx` hold tests of all three tasks. Before the Task 2 GREEN commit I set the Task 3 tests aside in the scratchpad and restored them for the Task 3 RED commit, so each GREEN commit has green tests.
**6. [Process] The ledger file.** `gsd-plan-head-before-11-16` was written with the base SHA before the first commit; `commits: 6` is `git rev-list --count a4a03788..HEAD` before this SUMMARY commit.

**Total deviations:** 1 Rule 2, 2 Rule 3 (one with sub-items), 3 notes. **Impact:** no scope creep; no package, schema, migration, trigger or endpoint.

## Issues Encountered

- **e2e, Task 3 (two failures, then green).** Run one: 14 passed, 1 failed: the webkit 320px test waited 8 minutes on a sidebar link that does not exist at that width. The test chose between the sidebar and the phone drawer with an instant `isVisible()` while the shell was still laying out. Fix: wait for either navigation (`menu.or(sidebarLink)`) first. Run two: 14 passed, 1 failed: in chromium the "Closure added" toast was not there after 5 s; the page snapshot shows the Save button still "Saving" with the closure typed in, because other test runs on this machine (a `dotnet test` and another e2e) were using the host and the database. Fix: the three save toasts wait up to 20 s (`SAVE_WAIT_MS`). Run three: `15 passed (1.6m)` on a quiet machine. Neither failure was the app; they are test design problems, recorded here and not hidden.
- **Unit flakes under load.** The first axe test of the hours card hit the 5 s default once (fixed with the 15 s timeout). In the wider run, `routes.test.tsx` "a Manager who opens /admin/components stays and sees the showcase" failed at its 10 s limit while a lint and a typecheck ran at the same time; the file passes alone (`Tests 64 passed (64)`). Not related to this plan.
- The shell in this worktree refuses `cd` combined with a heredoc or `git` with command substitution, so file edits went through the edit tool and the ledger was written with a plain `echo`.
- Not run here: Lighthouse, parity (no parity scenario draws these screens), the Windows deploy job, `build:budget`.

## Owner items (park for review)

1. **Delete wording for a closure of several days.** The approved lines say "{Dec 25, 2026}. The shop shows its normal hours that day." and "{Dec 25, 2026} shows normal hours." For "Dec 30, 2026 to Jan 1, 2027" they read "...that day." Options: **(a) keep the approved words for every closure (recommended: they are the spec's words)**; (b) say "those days" when the closure spans several days.
2. **Load Latest question on the hours card.** It reuses the 11-12 line: "Load Latest replaces what you typed with the saved version. Your typed changes are lost." Options: **(a) keep (recommended, one wording for every Site Content tab)**; (b) a hours-specific line.
3. **Conflict banner wording.** The shared banner says "This was changed by someone else." where the UI-SPEC Validation table lists "Someone else changed this" (the same open item as 11-12, item 1). Options: **(a) keep the shared words (recommended)**; (b) change the shared component for every form.
4. **"Visitors see" with several runs.** The label is on the first line only. Options: **(a) keep (recommended)**; (b) put the label on its own line above the runs.
5. **Closure window "gone" line.** "This closure wasn't found. It may have been deleted." is mine (SPEC-GAP). Options: **(a) keep (recommended)**; (b) reuse the "Already deleted" words.
6. **OI-1 (from 11-13) is still open.** The browser follows option A: an edit may keep a past first day. A ruling for option B would remove the zod `savedFirstDay` rule and the server's edit marker together.
7. **Contact page in e2e.** Once 11-14 is merged, add the Contact checks (Sunday's hours row, "Closed on" with the note) to `web/e2e/site-content-hours.spec.ts`; the closure journey already holds the data.

## Known Stubs

None.

## Threat Flags

None new. T-11-38: the POST carries one Idempotency-Key per submission (a unit test reads the header on the add; the hook test too) and the server's overlap rule refuses a double add. T-11-39: the closure picker's today is `useBusinessToday`; the unit test uses a date in 2031 and the grep finds no device-date call. T-11-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **11-14 (Contact page)** can read hours and closures from the public site; this plan writes both. Its e2e can extend `site-content-hours.spec.ts` (item 7 above).
- **11-20, 11-24, 11-32, 11-34** add their tabs to `BUILT_PANELS` in `SiteContentPage.tsx` (one line each) and can use `SiteContentCard` for their cards. Merge hot spots in this plan: `siteContentCopy.ts`, `siteContentSchemas.ts`, `siteContent.recipe.ts`, `siteContentFixtures.ts` and `docs/web/e2e.md` all end with new blocks, and `SiteContentPage.tsx` gained one line and one import.
- **11-37** is not touched by this plan (no audit code added).
- The shared requirement IDs CONT-04, CONT-01 and PUB-05 are shared with other plans; the orchestrator should mark each complete only after the last plan that declares it.
- STATE.md and ROADMAP.md were not touched (the orchestrator owns them).

## Self-Check: PASSED

- Files: the ten created files exist on disk (checked below). Commits `d71b7bdf`, `b13ce769`, `99e17bd0`, `cb019c0c`, `76dbb828` and `a56a7663` are ancestors of HEAD, and each RED commit precedes its GREEN commit. `git rev-list --count a4a03788..HEAD` was 6 before this SUMMARY commit.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*

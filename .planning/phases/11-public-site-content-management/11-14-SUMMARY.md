---
phase: 11-public-site-content-management
plan: 14
subsystem: ui
tags: [react, public-site, contact, open-status, hours, closures, lazy-loading, bundle-budget, msw, playwright]
created: 2026-11-12T05:45:00-06:00
updated: 2026-11-12T05:45:00-06:00

requires:
  - phase: 11-05
    provides: utils/hours.ts (groupWeek, summarizeOpenDays, callButtonSummary, formatTime)
  - phase: 11-10
    provides: the public data store (createPublicResource), useSiteQuery, ContactPage, ContactNowCard, SiteFooter, the public fixtures
  - phase: 11-11
    provides: GET /api/v1/public/open-status and the hours in the public site data
  - phase: 11-13
    provides: upcomingClosures in the public site data, closedToday and todayClosureNote in the open status
provides:
  - "Contact HoursCard: h2 Business hours, the Open now or Closed now pill, the status line, grouped weekly rows and the Closed on list"
  - "siteService.getOpenStatus and useOpenStatusQuery: a public resource read again every 5 minutes while the page is visible and once when the tab returns"
  - "statusLine in hoursCopy.ts: Closes, Opens today, Opens tomorrow, Opens Monday, Closed today for {note}, built only from the server's facts"
  - "Footer clock row (one line per run of open days) and the Call button second line (Mon-Sat, 9:00 AM - 6:00 PM)"
  - "Fixtures: demoWeek, mixedWeek, closedWeek, openStatusAt0859, openStatusAt0900, openStatusAt1759, openStatusAt1800, closureToday, sundayClosed, plus open-status MSW handlers and a default handler in the test setup"
affects: [11-16, 11-37, phase-12, phase-13]

actuals:
  tokens: 16700
  tasks: 2
  commits: 4
plan_head_before: a4a03788fd5d0bea05b702a2f7e3ea347fb2d76c
plan_head_after: 610d6874ae91077edb24bafee8a184e6ac0e3561

tech-stack:
  added: []
  patterns:
    - "Hours parts load lazily from one file (lazyHours.ts) so the build writes one preload table, not one per page chunk"
    - "A public resource with no boot key: createPublicResource key is optional for data the server never writes in the boot block"
    - "A hook that refreshes a public resource on a timer and on visibilitychange, retrying an errored resource instead of invalidating it"

key-files:
  created:
    - web/src/modules/public/hooks/useOpenStatusQuery.ts
    - web/src/modules/public/components/HoursCard.tsx
    - web/src/modules/public/components/OpenStatus.tsx
    - web/src/modules/public/components/hours.recipe.ts
    - web/src/modules/public/components/FooterHours.tsx
    - web/src/modules/public/components/CallHoursNote.tsx
    - web/src/modules/public/components/lazyHours.ts
    - web/src/modules/public/hoursCopy.ts
    - web/src/modules/public/hoursFacts.ts
    - web/src/modules/public/hoursFacts.test.ts
    - web/src/modules/public/hooks/useOpenStatusQuery.test.tsx
    - web/src/modules/public/components/hours.test.tsx
  modified:
    - web/src/modules/public/services/siteService.ts
    - web/src/modules/public/services/siteService.test.ts
    - web/src/modules/public/pages/ContactPage.tsx
    - web/src/modules/public/pages/ContactPage.test.tsx
    - web/src/modules/public/components/ContactNowCard.tsx
    - web/src/modules/public/components/BigContactButton.tsx
    - web/src/modules/public/components/SiteFooter.tsx
    - web/src/modules/public/components/SiteFooter.test.tsx
    - web/src/modules/public/components/contact.test.tsx
    - web/src/modules/public/copy.ts
    - web/src/lib/public-data/publicResource.ts
    - web/src/lib/public-data/publicResource.test.tsx
    - web/src/utils/hours.ts
    - web/src/utils/hours.test.ts
    - web/src/test/publicFixtures.ts
    - web/src/test/setup.ts
    - web/e2e/contact.spec.ts

key-decisions:
  - "Every new hours part (card, footer row, Call line) loads lazily, because Contact had 0.79 KB left. The words, the week reader and the formatters sit in files only those lazy parts import."
  - "The three lazy components are declared in one file (lazyHours.ts). Declared in three places they cost Contact 0.5 KB more, because each page chunk wrote its own preload table."
  - "A week with no open day shows one grouped row, Monday to Sunday / Closed, because groupWeek groups equal days (the plan text said seven rows)."
  - "While the status loads the card shows a pill skeleton and a line skeleton, so the card does not jump when the line arrives."
  - "An errored status is retried at the next five-minute tick and when the tab returns, not left failed for the life of the page."

requirements-completed: [PUB-05, CONT-04, PUB-02]

duration: about 1h 20m
completed: 2026-11-12
status: complete

coverage:
  - id: D1
    description: "Contact HoursCard shows Open now (success) or Closed now (muted) and the status line Closes 6:00 PM. / Opens today / Opens tomorrow / Opens Monday / Closed today for Christmas. Opens Saturday 9:00 AM. / Closed today. ..., with the Opens part left out when no opening is within 14 days, all from the server's facts"
    requirement: "PUB-05"
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/hours.test.tsx#statusLine (D-22) (9 cases) and HoursCard: the open status, HoursCard: closures"
        status: pass
      - kind: e2e
        ref: "web/e2e/contact.spec.ts#@contact-hours the hours card shows the demo week and the status the server gives right now (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The status refetches every 5 minutes while the page is visible, not while hidden, once when the tab returns, retries an error, and stops on unmount; nothing in the browser decides open or closed"
    requirement: "PUB-05"
    verification:
      - kind: unit
        ref: "web/src/modules/public/hooks/useOpenStatusQuery.test.tsx (6 tests); hours.test.tsx#follows the server and not the device clock"
        status: pass
    human_judgment: false
  - id: D3
    description: "The hours list is the grouped rows from groupWeek (Monday to Saturday / 9:00 AM - 6:00 PM, Sunday / Closed), and closures in the next 30 days follow under Closed on as 'Dec 25, 2026 · Christmas' or 'Dec 30, 2026 to Jan 1, 2027 · Year-end inventory', the note left out when empty, a long note wrapping"
    requirement: "CONT-04"
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/hours.test.tsx#HoursCard: the rows (D-21), HoursCard: closures (CONT-04, D-21)"
        status: pass
      - kind: e2e
        ref: "web/e2e/contact.spec.ts#@contact-hours the demo closure is listed under Closed on with its date and note ... (5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The footer clock row shows one line per run of open days, two lines for mixed hours, and no row when no day is open; the Call button second line is the call summary and is left out when no day is open"
    requirement: "CONT-04"
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/SiteFooter.test.tsx#SiteFooter clock row (4 tests); contact.test.tsx#ContactNowCard (D-18) (3 new tests)"
        status: pass
      - kind: e2e
        ref: "web/e2e/contact.spec.ts#@contact-hours the demo closure is listed ... and the call line and footer follow the hours"
        status: pass
    human_judgment: false
  - id: D5
    description: "UI states: a week with no open day (one Closed row, Closed now, no Opens part), a pill skeleton while the status loads, an error that hides the pill and the line and keeps the rows, a closure today, long notes, zero axe in each state"
    requirement: "PUB-05"
    verification:
      - kind: automated_ui
        ref: "web/src/modules/public/components/hours.test.tsx#HoursCard: empty, partial, loading and error states (UI states); ContactPage.test.tsx#keeps the hours rows and leaves the pill and line out when the status read fails"
        status: pass
    human_judgment: false
  - id: D6
    description: "Public bundle stays under 150 KB gzip on every page after the change (hours parts lazy)"
    verification:
      - kind: other
        ref: "npm --prefix web run build:budget"
        status: pass
    human_judgment: false
  - id: D7
    description: "MUST NOT read the device clock or time zone to choose Open now, Closed now, today or tomorrow on the Contact page"
    requirement: "PUB-05"
    verification:
      - kind: unit
        ref: "grep of the new files for new Date(, Date.now, Intl.DateTimeFormat, getTimezoneOffset: no match; hours.test.tsx#follows the server and not the device clock"
        status: pass
    human_judgment: true
    rationale: "The plan marks this prohibition as a judgment item. The grep and the pinned-clock test show no clock read in the status path; whether the Contact page words are what the owner wants stays a reviewer call."
---

# Phase 11 Plan 14: Contact hours and open status Summary

**The Contact page now tells a visitor whether the shop is open, from the server's answer only, with the week's grouped hours, the coming closures, a footer clock row and an hours line on the Call button, all loaded lazily so every public page stays under its 150 KB budget.**

## Performance

- **Duration:** about 1h 20m
- **Started:** 2026-11-12T04:30:00-06:00 (approximate)
- **Completed:** 2026-11-12T05:45:00-06:00
- **Tasks:** 2 (1 tracer, 1 auto), both TDD
- **Files in the diff:** 29 (12 created, 17 modified), 1144 lines added, 29 removed

## Accomplishments

- `GET /api/v1/public/open-status` is read by `siteService.getOpenStatus` and `useOpenStatusQuery`: a public resource (no TanStack Query) read again every 5 minutes while `document.visibilityState` is visible, once when the tab becomes visible, and retried when it had failed. The timer and listener stop on unmount.
- `HoursCard` (h2 "Business hours", first in the Contact aside): the `OpenStatus` pill ("Open now" in the success color, "Closed now" muted, both with a dot), the status line, the `dl` of grouped rows from `groupWeek`, and "Closed on" with one row per closure.
- `statusLine` builds the words from the server's facts only: "Closes 6:00 PM.", "Opens today 9:00 AM.", "Opens tomorrow 9:00 AM.", "Opens Monday 9:00 AM.", "Closed today for Christmas. Opens Saturday 9:00 AM.", "Closed today. Opens Saturday 9:00 AM."; with no opening in 14 days the Opens part is left out.
- Footer Visit column: a clock row with one line per run of open days ("Mon-Sat · 9:00 AM - 6:00 PM"); not rendered when no day is open.
- Call button: a second line from `callButtonSummary` ("Mon-Sat, 9:00 AM - 6:00 PM"), left out when no day is open.
- Fixtures and handlers for every status case the plan names, and a default open-status answer in the jsdom test setup.

## Task Commits

1. **Task 1 (tracer): Contact shows "Open now" and "Closes 6:00 PM." from the server, with the week's rows under it**
   - RED `39a2e2ab`, GREEN `2912e736`
2. **Task 2: closures, closed weeks, failures and the footer and Call lines follow the hours**
   - RED `19cbf26e`, GREEN `610d6874`

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) is not required; Vitest's console report was read by hand. A RED commit precedes each GREEN commit.

- **Task 1 RED** (`39a2e2ab`): `hours.test.tsx` and `useOpenStatusQuery.test.tsx` failed to load (`Failed to resolve import "./HoursCard"` and `"./useOpenStatusQuery"`); `siteService.test.ts` 1 failed (`getOpenStatus is not a function`); `hours.test.ts` 2 failed (`dayName` missing); `ContactPage.test.tsx` 3 failed (no Open now, no Business hours heading). Semantic assessment: the two import failures are the expected way a test for a new module fails before it exists; the other six failed on the planned assertions. I did not stub the modules to turn the import failures into assertion failures.
- **Task 1 GREEN** (`2912e736`): `npm --prefix web run test -- --run src/modules/public src/lib/public-data src/utils/hours.test.ts` gave 17 files and 162 tests passed. The tracer's `<verify>` was re-run end to end: unit set green and `npm --prefix web run e2e -- --grep @contact-hours` gave `5 passed (45.8s)` (chromium, firefox, webkit, pixel, iphone). Tracer verified end to end, expanding.
- **Task 2 RED** (`19cbf26e`): 6 of 76 failed: the Call line (3 tests) and the footer clock row (3 tests). **Weak spot, stated plainly:** the HoursCard closure, loading, error and closed-week tests that belong to Task 2 (in `hours.test.tsx`) already passed at RED, because the tracer built the whole `HoursCard` including closures and states; they went in with the Task 1 GREEN commit and stay as regression guards. The new e2e closure test was not run red (it needs the built host, and the footer and Call line it checks did not exist yet).
- **Task 2 GREEN** (`610d6874`): `src/modules/public src/lib/public-data src/utils src/test/no-long-dash.node.test.ts` gave 28 files and 870 tests passed; e2e `@contact-hours|@contact` gave 32 passed, 3 failed on the first run (see Issues Encountered) and `15 passed (1.0m)` when those three were re-run.

## Verification evidence (real output)

- **Unit (final tree, public set):** `Test Files 28 passed (28)`, `Tests 870 passed (870)`.
- **Full web unit run:** `Test Files 4 failed | 343 passed (347)`, `Tests 6 failed | 9629 passed (9635)`. Five failures were admin tests (`EditUserPanel`, `OrderFormPage`, `Phase9Demos`) that passed 180 of 180 when re-run alone; the sixth is `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions", the known fresh-worktree install issue (orchestrator note). None touches this plan.
- **Types:** `npm --prefix web run typecheck` clean. **Lint:** `npm --prefix web run lint` (`eslint . --max-warnings 0`) exit 0, no output. **Prettier:** `npx prettier --check src e2e` clean.
- **Bundle budget** (`npm --prefix web run build:budget`, gzip, limit 150 KB): home 142.15, products 142.54, gallery 147.51, **contact 149.76**, notFound 142.70; admin 220.67 (limit 250); CSS 17.79 (limit 35). All ok. Orchestrator baseline after wave 4: home 141.66, products 142.05, gallery 147.02, contact 149.21, notFound 142.21. Contact has **0.24 KB left**.
- **Acceptance greps:** `grep -c groupWeek HoursCard.tsx` = 3; `new Date(` outside comments in `OpenStatus.tsx` = 0; `grep -c summarizeOpenDays SiteFooter.tsx` = 1 (a comment naming it; the call is in `FooterHours.tsx`); `grep -c callButtonSummary ContactNowCard.tsx` = 1 (a comment naming it; the call is in `CallHoursNote.tsx`). A wider grep for `new Date(`, `Date.now`, `Intl.DateTimeFormat`, `getTimezoneOffset` over every new status and hours file found nothing.
- gitleaks `protect --staged` ran before all four commits: no leaks. The staged diffs hold only made-up values (`Sample Shop`, `0917 123 4567`, `cspsdemo` links, closure notes such as "Christmas") and no local path, real email, host or customer data.

## Files Created/Modified

See the frontmatter lists. The new lazy parts are `HoursCard.tsx`, `FooterHours.tsx` and `CallHoursNote.tsx`, declared together in `lazyHours.ts`.

## Decisions Made

- **Everything new is lazy.** The orchestrator said Contact had 0.79 KB left. A first build with the hours code in the page chunk was 150.26 KB (over). The card, the footer clock row and the Call line now load after the page; their words (`hoursCopy.ts`), week reader (`hoursFacts.ts`) and the `utils/hours` formatters are imported only by those lazy parts.
- **One file for the three lazy components.** With three separate `lazy(...)` calls the build wrote a preload table of about 16 hashed file names in each chunk that held one. `lazyHours.ts` brings Contact from 149.91 to 149.76 KB.
- **No layout jump from the lazy parts.** The card has a skeleton fallback; the Call line sits in a button whose height the 52 px icon tile sets, so the line adds no height; the footer row sits at the end of the page.
- **Closed week:** one row "Monday to Sunday" / "Closed" (see Deviations).
- **Status loading shows two skeletons** (the pill and a line-sized one) so the card does not jump when the line arrives. UI-SPEC says "a pill-sized skeleton"; the pill-sized one is there.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The hours code pushed the Contact budget over 150 KB**
- **Found during:** Task 1 (first `build:budget` run: contact 150.26 KB)
- **Issue:** The plan has HoursCard, copy and `statusLine` in `copy.ts`, and the footer and Call line call the hours formatters. All of that landed in the first download of Contact (0.79 KB headroom).
- **Fix:** Lazy-loaded card, footer row and Call line; moved the hours words and `statusLine` out of `copy.ts` into `hoursCopy.ts` (the old `contact.hours` block went with them, and its four strings are in `HOURS_COPY` unchanged); `weekHours` in `hoursFacts.ts`; the three lazy components declared in `lazyHours.ts`; `BigContactButton` `note` takes a node. New files not in the plan: `hoursCopy.ts`, `hoursFacts.ts`, `hoursFacts.test.ts`, `hours.recipe.ts`, `FooterHours.tsx`, `CallHoursNote.tsx`, `lazyHours.ts`.
- **Verification:** budget table above.
- **Committed in:** `2912e736`, `610d6874`

**2. [Rule 3 - Blocking] The generated API types give `day` as `number | string`**
- **Found during:** Task 1 (typecheck)
- **Issue:** `groupWeek` wants `1 | 2 | ... | 7`; the OpenAPI type for an int32 allows text.
- **Fix:** `weekHours` reads the day as a number and drops anything that is not 1 to 7; `statusLine` does `Number(next.day)`. `hoursFacts.test.ts` covers text, out-of-range and fractional days.
- **Committed in:** `2912e736`

**3. [Rule 3 - Blocking] `createPublicResource` required a boot key**
- **Found during:** Task 1
- **Issue:** The open status is never in the server's boot block, and the key type only allowed `site`, `productLines` and `home`. Using `site` would have primed the status with the shop facts.
- **Fix:** `key` is optional (`publicResource.ts`, one test added). Not in the plan's file list.
- **Committed in:** `2912e736`

**4. [Rule 3 - Blocking] The jsdom setup refuses unhandled requests**
- **Found during:** Task 1
- **Issue:** `onUnhandledFrame: 'error'` fails any test that renders Contact now that it reads the open status.
- **Fix:** `setup.ts` answers the open status with `openStatusAt0900` before each test, next to the existing site handler. A test that needs another answer calls `server.use`.
- **Committed in:** `39a2e2ab`

**5. [Rule 1 - Bug] Existing tests pinned the old behavior**
- **Found during:** Task 2
- **Issue:** `SiteFooter.test.tsx` asserted there is no "Mon-Sat" in the footer; `contact.test.tsx` and `ContactPage.test.tsx` named the Call link `Call 0917 123 4567`, which now carries the hours line after the lazy part loads (one of them passed only because the lazy part had not loaded yet).
- **Fix:** removed the old assertion (the new clock row tests replace it); the card test matches `/^Call 0917 123 4567/`; the page test awaits the full name `Call 0917 123 4567 Mon-Sat, 9:00 AM - 6:00 PM`.
- **Committed in:** `19cbf26e`, `610d6874`

**6. [Rule 2 - Missing critical] `dayName` for the status line**
- **Found during:** Task 1
- **Issue:** The status line needs "Monday" from the server's day number; `utils/hours.ts` kept its day list private.
- **Fix:** exported `dayName(day)` (null for any number that is not 1 to 7) with tests.
- **Committed in:** `39a2e2ab` (tests), `2912e736`

### Plan wording that I did not follow

- The plan says "closedWeek shows seven Closed rows". `groupWeek` joins equal neighbours, and its own 11-05 test fixes one closed row for a week with no open day, so the card shows one row, "Monday to Sunday" / "Closed". UI-SPEC says "Hours rows all Closed"; this meets it.
- The plan's Task 2 verify runs `src/test/no-long-dash.node.test.ts`; it passed (included in the 870).
- Acceptance greps for `summarizeOpenDays` in `SiteFooter.tsx` and `callButtonSummary` in `ContactNowCard.tsx` hold only through comments that name them: the real calls sit in the lazy files (see deviation 1).

---

**Total deviations:** 6 auto-fixed (1 bug, 1 missing critical, 4 blocking). **Impact on plan:** all needed for the bundle budget, the types or the existing suite; no scope creep, no new package, no schema or server change.

## Issues Encountered

- **e2e under load.** The first `@contact-hours|@contact` run had 3 failures at about 30 s each (`@contact the footer shows the stored tagline` on webkit, `@contact at 320px` on chromium, `@contact-hours the hours card` on firefox): `Test timeout of 30000ms exceeded`, with `Target page, context or browser has been closed` and `page.goto: ... navigation canceled`. Cause: 35 tests (7 tests on 5 projects) queue on the one site content lock while other executors were running `dotnet test` and Vitest on the same machine. Re-run alone, the same three tests gave `15 passed (1.0m)`. Recorded as a load flake, nothing hidden. A later plan that adds more `@contact` tests will lengthen the queue.
- **Five admin Vitest tests failed in the full parallel run** and passed alone (see Verification evidence); recorded as load flakes, not touched.
- **Shell:** the Bash tool in this worktree refused several scripted multi-edit commands with "too complex to verify"; I used single Edit calls instead.

## Known Stubs

None.

## Threat Flags

None. The surface is the one in the plan's threat model: T-11-33 (words built only from server facts; the grep and the pinned-clock test show no clock read), T-11-34 (the five-minute read runs only while the page is visible; the server caches the answer for 60 seconds), T-11-SC (no package added or bumped).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Bundle:** Contact has 0.24 KB of headroom (149.76 of 150). Any further addition to a public page must be lazy, and must be declared in `lazyHours.ts`'s style (one file) or the page chunk grows by a preload table. Home 142.15, products 142.54, gallery 147.51, notFound 142.70.
- **11-16 (Hours and Closures tab):** the public Contact page now reads `upcomingClosures` and the open status; nothing in this plan changed a server route or `api.generated.ts`. After an admin write, `invalidatePublicContent()` refreshes the open status too (it is a registered public resource).
- **11-37:** no audit change here.
- **docs/web/e2e.md** was not touched (a merge hot spot); the two new `@contact-hours` specs run under `withSiteContentLock` like the others.
- **Not checked in a browser pane:** the layout of the card, the pill dot and the footer row were verified through the DOM, axe and e2e only; the owner's visual review in the end-of-phase UAT covers the look.

## Self-Check: PASSED

- Files: `HoursCard.tsx`, `OpenStatus.tsx`, `hours.recipe.ts`, `FooterHours.tsx`, `CallHoursNote.tsx`, `lazyHours.ts`, `hoursCopy.ts`, `hoursFacts.ts`, `useOpenStatusQuery.ts` exist on disk (checked below).
- Commits `39a2e2ab`, `2912e736`, `19cbf26e`, `610d6874` are ancestors of HEAD; each RED commit precedes its GREEN commit.
- The measured commit count is 4 (`git rev-list --count a4a03788..HEAD` before this SUMMARY commit).

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*

---
phase: 11-public-site-content-management
plan: 24
subsystem: ui
tags: [react, testimonials, site-content, admin, react-hook-form, zod, tanstack-query, playwright, wcag]
created: 2026-11-12T13:46:00-06:00
updated: 2026-11-12T13:46:00-06:00

requires:
  - phase: 11-21
    provides: "GET, POST, PUT {id}, POST {id}/move, {id}/hide, {id}/show and DELETE {id} on /api/v1/testimonials (Manager), TestimonialDto and TestimonialRequest in the generated types, the Testing seed with four demo testimonials, GET /api/v1/public/home"
  - phase: 11-22
    provides: "The Site Content page and the admin recipe and fixture files this plan extends"
  - phase: 11-20
    provides: "The Products tab row-action, focus and announcement pattern, the Site Content e2e lock"
  - phase: 11-16
    provides: "The ClosureModal window pattern (409 banner, Load Latest, discard guard)"
provides:
  - "testimonialsService (list, create, update, move, hide, show, remove) and the testimonial hooks (useTestimonialsQuery, useReadTestimonialsAgain, useCreateTestimonial, useUpdateTestimonial, useMoveTestimonial, useSetTestimonialShown, useDeleteTestimonial); every write clears the public data in this browser and reads the list again"
  - "TestimonialsTab (S5): every testimonial in display order, quote clamped to 2 lines, name over team, one decorative star with '5 stars' or '1 star', Shown or Hidden badge with 'On the Home page' under the first 3 shown rows, Move up and down, Edit, Hide or Show and Delete, each named for the person"
  - "TestimonialModal: Quote (4 rows), Name, Team or role, Stars radio group (5 stars to 1 star, default 5), Show on the website (default ticked on add), Save Testimonial, 409 ConflictBanner with Load Latest, discard guard"
  - "testimonialSchema, testimonialValuesOf and toTestimonialRequest in siteContentSchemas.ts (OR-3: the server's rules and words)"
  - "S5 copy and toasts in siteContentCopy.ts; the testimonials tab registered on Site Content; testimonialsBackend and demoTestimonials test fixtures; the @site-content-testimonials e2e journeys"
affects: [11-25, 11-37]

actuals:
  tokens: 33700
  tasks: 2
  commits: 4
plan_head_before: 5ab9eb50ddfe92da4a3d734afb56329742d3ea73
plan_head_after: c08f665331e8c6e6acf2e58b9fa1b2a02e0fce75

tech-stack:
  added: []
  patterns:
    - "A list tab with immediate move, hide and show and a modal for add and edit: the Products tab's Acting machine (aria-disabled rows while one action saves, focus once per press, polite line after a move) over a modal that shows its own toast and hands the saved row to the tab, which moves focus to that row's Edit"
    - "The quote is plain text end to end: React escapes it, the request sends it trimmed at both ends and unchanged inside, and a test pins markup staying text"

key-files:
  created:
    - web/src/modules/admin/services/testimonialsService.ts
    - web/src/modules/admin/services/testimonialsService.test.ts
    - web/src/modules/admin/hooks/useTestimonialQueries.ts
    - web/src/modules/admin/hooks/useTestimonialQueries.test.tsx
    - web/src/modules/admin/components/TestimonialsTab.tsx
    - web/src/modules/admin/components/TestimonialsTab.test.tsx
    - web/src/modules/admin/components/TestimonialModal.tsx
    - web/src/modules/admin/components/TestimonialModal.test.tsx
    - web/e2e/site-content-testimonials.spec.ts
  modified:
    - web/src/modules/admin/siteContentSchemas.ts
    - web/src/modules/admin/siteContentSchemas.test.ts
    - web/src/modules/admin/siteContentCopy.ts
    - web/src/modules/admin/components/siteContent.recipe.ts
    - web/src/modules/admin/pages/SiteContentPage.tsx
    - web/src/modules/admin/pages/SiteContentPage.test.tsx
    - web/src/test/siteContentFixtures.ts
    - docs/web/e2e.md

key-decisions:
  - "The window shows its own save toast ('Testimonial added' or 'Testimonial saved' with 'The Home page shows the change.'), as the plan's behavior list puts that in TestimonialModal.test; the tab only moves focus to the saved row's Edit"
  - "Edit is a button that opens the window (not a link), so while a move, hide or show saves it is aria-disabled with the other row actions"
  - "The 'first 3 shown' mark counts shown rows only: a hidden row in front does not take a place on the Home page"
  - "The Delete question quotes the first 50 characters of the quote and adds an ellipsis only when it cut"
  - "The quote is sent trimmed at both ends and unchanged inside (the server trims the same way); the prohibition on changing a customer's wording on display is met because nothing rewrites the words"
  - "The tab was written beside ProductLinesTab, not by refactoring it into a shared hook, so no existing screen could change (follow-up candidate, see Issues Encountered)"

patterns-established:
  - "testimonialsBackend (MSW) keeps what each of the seven routes left and records every call, like productLinesBackend"

requirements-completed: [CONT-03, PUB-03]

coverage:
  - id: D1
    description: "The Testimonials tab lists every testimonial in display order (quote clamped to 2 lines, name over team, '5 stars' or '1 star' with one decorative star, Shown or Hidden badge, 'On the Home page' under the first 3 shown rows) with Move up, Move down, Edit, Hide or Show and Delete, each named for the person"
    requirement: "CONT-03"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/TestimonialsTab.test.tsx (the Testimonials card, 10 tests)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-testimonials.spec.ts @site-content-testimonials (5 projects, 15 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Add Testimonial opens TestimonialModal with Quote (4 rows, at most 300), Name (at most 60), Team or role (at most 80), Stars (default 5), Show on the website (ticked on add); one Idempotency-Key per add; 'Testimonial added' / 'The Home page shows the change.'; edit sends the version; 409 shows the ConflictBanner with the typed values kept; the dirty guard asks before closing"
    requirement: "CONT-03"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/TestimonialModal.test.tsx (18 tests, axe included)"
        status: pass
    human_judgment: false
  - id: D3
    description: "OR-3: testimonialSchema mirrors plan 11-21's validator with its messages (300, 60, 80, whole stars 1 to 5, counted after the trim)"
    requirement: "CONT-03"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/siteContentSchemas.test.ts (testimonialSchema and the form values and request, 13 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Move, hide and show save at once with the Products tab's focus, announcement and busy rules; Delete asks 'Delete this testimonial?' with the person and the start of the quote and focuses Cancel first, then moves focus to the next row's Edit, else the previous, else Add Testimonial"
    requirement: "CONT-03"
    verification:
      - kind: unit
        ref: "TestimonialsTab.test.tsx (Move up and Move down, Hide and Show, Delete, 17 tests)"
        status: pass
      - kind: e2e
        ref: "@site-content-testimonials move to the top, hide, show, edit and delete journeys (5 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The empty, loading and error states show 'No testimonials yet' with its message, 'Loading testimonials…' and \"Couldn't load testimonials.\" with Try Again; a 300-character quote is clamped to 2 lines in the table and shown whole in the edit window; zero axe in each"
    requirement: "CONT-03"
    verification:
      - kind: unit
        ref: "TestimonialsTab.test.tsx (the list states, the clamp, axe) and TestimonialModal.test.tsx (the whole 300-character quote in the edit window)"
        status: pass
      - kind: e2e
        ref: "@site-content-testimonials at 390px the list is row cards with the quote clamped to 2 lines, at 320px no sideways scroll and axe finds nothing (5 projects)"
        status: pass
    human_judgment: false
  - id: D6
    description: "PUB-03: every testimonial change clears the public data held in this browser and shows its toast, and the public Home data (GET /api/v1/public/home) then starts with the new first testimonial and drops a hidden or deleted one"
    requirement: "PUB-03"
    verification:
      - kind: unit
        ref: "useTestimonialQueries.test.tsx (invalidatePublicContent once per successful write, never after a failure); TestimonialsTab.test.tsx"
        status: pass
      - kind: e2e
        ref: "@site-content-testimonials the public Home data check after the move, hide, show and delete (5 projects)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Home page itself shows the new first testimonial in its first card"
    requirement: "PUB-03"
    verification: []
    human_judgment: true
    rationale: "The Home page does not draw testimonials until plan 11-25 merges (see Deviation 1). This plan proves the public Home data and the cache clearing; the card on the page is checked by plan 11-25's own spec or by the owner"
  - id: D8
    description: "MUST NOT change a customer's quote wording on display; it is stored and shown as typed"
    requirement: "CONT-03"
    verification:
      - kind: unit
        ref: "siteContentSchemas.test.ts (keeps the words inside the quote exactly as typed); TestimonialsTab.test.tsx (shows the quote as typed: markup stays text)"
        status: pass
    human_judgment: true
    rationale: "The plan marks this prohibition as a judgment item (product, unverified). The tests prove nothing rewrites the words on this screen and in the request; the trim at both ends and the server's own handling are for a reviewer to accept"
  - id: D9
    description: "The tab, the window and the row cards look right (sizes, spacing, the clamp, the star and the 'On the Home page' note)"
    verification: []
    human_judgment: true
    rationale: "The screens are SPEC-GAP built from the Products tab and the closure window looks; no parity scenario draws them. The owner judges them in the UI review"
  - id: D10
    description: "Zero warnings: lint, types, tests; the public bundle stays inside its budgets"
    verification:
      - kind: other
        ref: "npm --prefix web run lint (exit 0); npm --prefix web run typecheck (exit 0); npm --prefix web run build:budget (all rows ok)"
        status: pass
    human_judgment: false

duration: about 50 min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 24: A Manager adds and orders the testimonials Home shows Summary

**The Site Content Testimonials tab over plan 11-21's routes: an ordered list with a 2-line quote clamp and an "On the Home page" mark on the first 3 shown rows, move, hide and show that save at once, an add and edit window that mirrors the server's rules in zod, and a delete question that names the person and the start of the quote; every change clears the public data in this browser, and the e2e journeys prove the public Home data follows the Manager's order.**

## Performance

- **Duration:** about 50 min (about 12:55 to 13:46, -06:00); the two e2e runs, lint and the full suite took about half of it
- **Tasks:** 2 (1 tracer, 1 auto), both TDD
- **Files in the diff:** 17 (9 created, 8 modified; no file deleted). The added text is about 33,700 tokens on the chars/4 scale (the plan estimated 100,000)

## Accomplishments

- **Service and hooks.** `testimonialsService` has the seven calls (the adds and moves carry one Idempotency-Key per submission, a form edit carries the version and no key). The hooks run every write through `useSubmission`; each successful write calls `invalidatePublicContent()` and marks the list for a new read, and a refused write does neither. `useReadTestimonialsAgain` backs Load Latest.
- **TestimonialsTab (S5).** Quote (lead, `line-clamp-2` with `wrap-anywhere`), Name over the muted team or role, the stars as "5 stars" or "1 star" with one decorative `star`, the Shown or Hidden badge, and "On the Home page" under the first 3 shown rows (a hidden row in front does not take a place). Five row actions named for the person ("Move testimonial from Juan Dela Cruz up" and so on). The list keeps its own loading ("Loading testimonials…"), error ("Couldn't load testimonials." with Try Again) and empty ("No testimonials yet" with its message) states.
- **Move, hide, show.** They save at once with no question. While one saves, the pressed control is busy and every other row action is `aria-disabled`; focus stays on the pressed control once the list has read again (or goes to the other move button when the row reached an end); a polite line says "Testimonial from Ben Santos moved to position 2 of 4."; the toasts say "Testimonial hidden" and "Testimonial shown" with "The Home page shows the change."
- **TestimonialModal.** Quote (4 rows, hint "Write it the way the customer said it."), Name, Team or role (placeholder "e.g. Captain, Brgy. San Roque Ballers"), the Stars group (5 stars first, default 5) and Show on the website (ticked on add, so the request sends `isShown: true` as 11-21 asked). An add sends one Idempotency-Key; an edit sends the version it opened with. 400 messages land under their field with focus; a stale save keeps every typed value behind the ConflictBanner and Load Latest replaces them and the version; 404 says the testimonial was not found; the window asks "Discard changes?" before closing a changed form.
- **Delete.** "Delete this testimonial?" with "Juan Dela Cruz: “Seventeen pieces, names and numbers perfect.” It's removed for good.", Cancel focused first, "Delete Testimonial" / "Deleting"; the quote start is cut at 50 characters with an ellipsis. Focus then goes to the next row's Edit, else the previous, else Add Testimonial. A 404 says "Already deleted" and reads the list again.
- **OR-3.** `testimonialSchema` mirrors `Testimonial.Check` with the server's words ("Enter the quote.", "Keep the quote to 300 characters or fewer.", "Enter the name.", "Keep the name to 60 characters or fewer.", "Keep this to 80 characters or fewer.", "Choose 1 to 5 stars."), counted after the trim; stars are whole numbers 1 to 5.
- **Tab registration.** `testimonials` is in the panels map of `SiteContentPage.tsx`; the tab reports no unsaved changes of its own (the window guards itself).

## Task Commits

| Task | Phase | Commit | Message |
|---|---|---|---|
| 1 (tracer) and 2 | RED | `7ca80548` | test(11-24): add failing tests for the Testimonials tab, its window, the testimonial calls and the S5 rules |
| 1 (tracer) and 2 | GREEN | `ff0d3480` | feat(11-24): a Manager adds, orders, hides, edits and deletes the testimonials Home shows |
| 2 | fix | `8ddcb5b7` | test(11-24): count the table body rows so the phone row cards are counted too |
| 2 | docs | `c08f6653` | docs(11-24): add the testimonials journeys to the e2e guide |

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) is not required, and Vitest prints none of the formats it reads for a hand run. The RED evidence is the real console output, read by hand. A RED commit precedes the GREEN commit.

- **RED** (`7ca80548`): the six plan test files ran as `Test Files 6 failed (6)`, `Tests 3 failed | 20 passed (23)`. Five files could not load: `TestimonialsTab`, `TestimonialModal`, `useTestimonialQueries` and `testimonialsService` did not exist ("Failed to resolve import ..."), and `siteContentSchemas.test.ts` stopped on `TypeError: testimonialValuesOf is not a function`. In `SiteContentPage.test.tsx` the three new or changed tests failed on assertions: the tab list had 3 tabs not 4, and `role="tab" name "Testimonials"` and `role="tabpanel" name "Testimonials"` were not found. Semantic assessment: the target tests ran and failed because the modules, the schema functions and the tab did not exist; for the five new modules the RED is a missing import, not an assertion. The e2e journeys were written in the RED commit and not run at RED (no UI existed).
- **Tracer gate:** Task 1's `<verify>` holds only `<automated>` commands. They were re-run on the finished tree before anything further: the unit set and then `npm --prefix web run e2e -- --grep @site-content-testimonials`. The first e2e run was 13 passed, 2 failed (see Deviation 2); after the fix the second run was `15 passed (1.8m)`. Tracer verified end to end.
- **GREEN** (`ff0d3480`): the six plan files `Test Files 6 passed (6)`, `Tests 398 passed (398)` on the first run, no test changed to make it pass.
- **Weak spot, stated plainly:** all the unit tests of both tasks (the tracer's and Task 2's) were written in the one RED commit, and one GREEN commit made them all pass, so Task 2 has no RED commit of its own and its code is in the Task 1 GREEN commit. The Task 2 entries above are the e2e fix and the docs row.

## Verification evidence (real output)

- **Plan unit command (Task 1 set):** `Test Files 6 passed (6)`, `Tests 398 passed (398)`, run three times (RED fixed, GREEN, and again before the last commit).
- **Plan unit command (Task 2 set, with `no-long-dash.node.test.ts`):** `Test Files 3 passed (3)`, `Tests 52 passed (52)`. Also `source-layout.node.test.ts`, `siteContent.recipe.node.test.ts` and `no-long-dash.node.test.ts`: `Test Files 3 passed (3)`, `Tests 11 passed (11)`.
- **e2e `@site-content-testimonials`:** first run `13 passed`, `2 failed` ([pixel] and [iphone] of the add and move journey: `Expected: 5, Received: 4` for the table rows). After the fix: `15 passed (1.8m)` (three journeys in chromium, firefox, webkit, pixel and iphone, no retries). The flake rule did not apply: the first failure was a real test bug, fixed, and the second run was clean.
- **Types and lint:** `npm --prefix web run typecheck` exit 0 (three `tsc` lines, no output); `npm --prefix web run lint` exit 0 (`eslint . --max-warnings 0`, no output).
- **Bundle** (`npm --prefix web run build:budget`, gzip, limit 150 KB public and 250 KB admin): home 141.25, products 145.07, gallery 146.56, contact 148.75 (about 1.25 KB left), notFound 141.77, admin 219.40, CSS 18.18. After wave 9 these were 141.25, 145.07, 146.56, 148.74, 141.76, 219.37, 18.17: the public pages did not grow by more than 0.01 KB.
- **Acceptance greps:** `'testimonials'` in `SiteContentPage.tsx`: 1. `Choose 1 to 5 stars.` in `siteContentCopy.ts`: 1. `No testimonials yet` in `siteContentCopy.ts`: 1. `line-clamp-2` in `TestimonialsTab.tsx`: 1 (the doc comment names the class; the class itself is in `testimonialQuoteClasses` in `siteContent.recipe.ts`, because class tokens live in the recipe files and are checked by the class gate).
- **Whole web suite on the final tree:** see "Full web suite" below.
- gitleaks (`protect --staged`) ran before each of the four commits: `no leaks found`. The values in the diff are made up ("Juan Dela Cruz", "Ana Reyes", "Ben Santos", "Carlo Mendoza", "Dina Lopez", "E2E-Ana", "Brgy. Sample Ballers"); no local path, real email, host or customer data.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, not resolvable here] The Home page does not draw testimonials yet**
- **Found during:** Task 1 (writing the e2e journey)
- **Issue:** The plan's e2e journey ends with "opens / and sees that quote in the first testimonial card". `HomePage.tsx` does not render testimonials: plan 11-25 (same wave, built in parallel) adds the testimonials row. The card cannot exist on this tree.
- **Fix:** The journey checks the public Home data instead (`GET /api/v1/public/home`, the data the Home page draws from): after the move the first testimonial's quote is the new one, a hidden or deleted one leaves it, and a shown one comes back. The Manager-side checks are all in the browser. Recorded as coverage item D7 with `human_judgment: true`; the page check belongs to plan 11-25's spec (or the owner) once both plans are merged.
- **Files modified:** `web/e2e/site-content-testimonials.spec.ts`, `docs/web/e2e.md` (the row says so)
- **Committed in:** `7ca80548`, `c08f6653`

**2. [Rule 1 - Bug in my own test] The row count missed the phone row cards**
- **Found during:** the first e2e run (pixel and iphone projects)
- **Issue:** the add and move journey counted `table.getByRole('row')` and expected 5 then 6. On a phone the header row is hidden, so the table has one row fewer in the accessibility tree and the count was 4.
- **Fix:** count `table.locator('tbody tr')` (4, then 5) and read the first body row for the top place.
- **Files modified:** `web/e2e/site-content-testimonials.spec.ts`
- **Verification:** second run `15 passed (1.8m)`.
- **Committed in:** `8ddcb5b7`

**3. [Rule 1 - Existing tests that pinned the old behavior]**
- **Found during:** Task 1
- **Issue:** `SiteContentPage.test.tsx` said the built tabs were Business Info, Hours & Closures and Products, and used `?tab=testimonials` as the example of a tab that is not built yet.
- **Fix:** the list now includes Testimonials, and the "not built yet" example is `?tab=gallery`. Two new tests open the Testimonials tab from the address and from the tab strip.
- **Files modified:** `web/src/modules/admin/pages/SiteContentPage.test.tsx`
- **Committed in:** `7ca80548`

### Plan wording and process notes

**4. [Process] Files outside the plan's list:** `web/src/modules/admin/components/siteContent.recipe.ts` (the tab's looks: the clamp, the person, the star and the status cell; class tokens must live in a recipe file), `docs/web/e2e.md` (the `@site-content-testimonials` row, as plans 11-20 and 11-22 did).
**5. [Process] One RED and one GREEN commit for both tasks.** See the weak spot under TDD Gate Compliance. The plan's two tasks are one screen; the Task 2 behavior was implemented with the tracer because the tab's row actions, the window and the delete question share one state machine.
**6. [Process] Wording that is mine (SPEC-GAP):** the polite line "Testimonial from {name} moved to position {n} of {total}.", the danger toasts "Couldn't move / hide / show the testimonial from {name}", the window's "This testimonial wasn't found. It may have been deleted." and "Latest testimonial loaded. Make your changes again.", the 50 character quote start in the Delete question. The UI-SPEC gives the rest.
**7. [Process] Tools.** The Bash tool in this worktree refuses commands that mix `git` with heredocs or chained commands, and no Python is installed, so edits ran through the Edit and Write tools and `sed`, and git calls ran as plain separate commands. The plan-head ledger (`gsd-plan-head-before-11-24`) was written before the first commit; `commits: 4` is `git rev-list --count 5ab9eb50..HEAD` before this SUMMARY commit.

---

**Total deviations:** 3 (1 Rule 3 not resolvable here, 2 Rule 1), 4 notes. **Impact:** no scope creep; no package, schema, migration, trigger or server change.

## Issues Encountered

- The Home page card check could not be written (Deviation 1). Until plan 11-25 merges, "Home shows the new first testimonial" is proved at the data level only.
- The Testimonials tab repeats the Products tab's state machine for move, hide, show and focus (about 150 lines). I did not extract a shared hook because that would change a screen this plan does not own. A shared `useRowActions` for the Products, Testimonials and later Gallery tabs is a good follow-up quick task.
- A copy of `npm ci` log went to a path outside the worktree by mistake at the start (`.claude/worktrees/npmci.log`); I deleted it at once.
- Not run here: Lighthouse, parity (no parity scenario draws these screens), the Windows deploy job, the .NET suites (no server code changed).

## Owner items (open, nothing blocks the plan; recommendation first)

**OI-1. New words.** "Testimonial from {name} moved to position {n} of {total}.", "Couldn't move / hide / show the testimonial from {name}", "This testimonial wasn't found. It may have been deleted." and "Latest testimonial loaded. Make your changes again." Options: **(a) keep (recommended)**; (b) your own words (all in `siteContentCopy.ts`, `testimonials`).

**OI-2. The Delete question cuts the quote at 50 characters.** The UI-SPEC shows a short start with an ellipsis and no number. Options: **(a) 50 (built, recommended)**: long enough to recognize the quote, short enough for a phone dialog; (b) another length (one constant, `QUOTE_START_MAX`).

**OI-3. Edit is aria-disabled while a move, hide or show saves.** The Products tab's Edit is a link and stays usable; here it is a button that opens a window over a list that is about to change. Options: **(a) keep (recommended)**; (b) leave Edit enabled and let the window open over a list that is still reading.

## Known Stubs

None.

## Threat Flags

None new. T-11-61 (double submissions): one Idempotency-Key per POST (add, move, hide, show) through `useSubmission`, the pressed control is busy and every other row action is aria-disabled while one saves; WEB-09 is pending in the plan's register. T-11-62 (quote rendering, CWE-79): the quote is rendered as a React text node in the table and in the window's text area, no HTML is accepted or rendered, and a test pins markup in a quote staying text. T-11-SC: no package was added or bumped; `web/package.json` and the lock file are unchanged (`npm ci --ignore-scripts` ran only from the lockfile).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **11-25 (Home page):** the Manager side is done. When it draws the testimonials row, add the browser check this plan could not: after `@site-content-testimonials` adds `E2E-Ana` and moves it to the top, `/` shows that quote in the first card. The e2e seed already puts the four demo testimonials back.
- **11-37 (audit labels):** nothing new here; the codes are 11-21's.
- **Merge hot spots:** `siteContentCopy.ts`, `siteContentSchemas.ts`, `siteContentFixtures.ts`, `siteContent.recipe.ts`, `SiteContentPage.tsx` (the panels map and its test), `docs/web/e2e.md`.
- **Bundle:** see above; the Testimonials tab adds to the admin Site Content chunk only. STATE.md and ROADMAP.md were not touched (orchestrator owns them). CONT-03 and PUB-03 are shared with other plans, so the orchestrator should mark them only after the last plan that declares each.

## Full web suite

`npm --prefix web run test -- --run` on the final tree, with other executors running on the same machine: `Test Files 5 failed | 362 passed (367)`, `Tests 5 failed | 10089 passed (10094)`. The five failures:

- `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions (no npm exceptions at all)": the known fresh worktree install failure (orchestrator note); no package file was touched.
- `ExpenseModal.test.tsx` (the "Saving" double press), `OrderItemModal.test.tsx` (one request for a double click), `OrderRefundModal.test.tsx` (the credit message) and `scripts/vite-preload-font-plugin.test.ts` (the woff2 plugin): each failed once during the full run (the three modal files took 25 to 35 seconds, a busy machine) and none touches code of this plan. Run alone, the four files pass: `Test Files 4 passed (4)`, `Tests 135 passed (135)`. Recorded as load flakes, not fixed (out of scope).

## Self-Check: PASSED

- Files: the 9 created files in `key-files.created` exist on disk (9 of 9 checked).
- Commits `7ca80548`, `ff0d3480`, `8ddcb5b7` and `c08f6653` are ancestors of HEAD; the RED commit precedes the GREEN commit.
- The measured commit count is 4 (`git rev-list --count 5ab9eb50..HEAD` before this SUMMARY commit), read against the base id kept in the per-plan ledger file; `plan_head_after` is `c08f6653`.
- `git status` showed nothing else modified or untracked before this SUMMARY (the Playwright `test-results`, `playwright-report`, `.locks`, `.e2e-dist`, `.budget-dist` and `.vitest` folders are git-ignored); `web/package.json` and the lock file are unchanged.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*

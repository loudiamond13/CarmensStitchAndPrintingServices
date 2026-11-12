---
phase: 11-public-site-content-management
plan: 20
subsystem: ui
tags: [react, react-hook-form, zod, site-content, admin, product-lines, prices, order-product-types, playwright, dirty-guard, conflict-banner]
created: 2026-11-12T09:55:00-06:00
updated: 2026-11-12T10:36:00-06:00

requires:
  - phase: 11-17
    provides: "The eight /api/v1/product-lines routes (list, read, add, edit, move, hide, show, delete), the flat customize names, the messages of ProductLine.Check, the 422 product-lines.in-use answer"
  - phase: 11-12
    provides: "SiteContentPage with its panels map, the dirty and tab-change rules, siteContent.recipe, siteContentCopy, siteContentSchemas, the e2e lock and seed helpers"
  - phase: 11-18
    provides: "The public Products page that shows each price, and the bundle budget notes"
provides:
  - "The Products tab (?tab=products) of Site Content: every product line, shown and hidden, in display order, with the 44px main photo or placeholder, the title as a link to the editor over the short name, Starts at with its minimum, the order type and gallery counts, a Shown or Hidden badge, and Move up, Move down, Edit, Hide or Show and Delete"
  - "Move, Hide and Show save at once with no question; the pressed control is busy, every other control is aria-disabled, focus stays on the pressed control (or goes to the other move button at an end), and a polite line says '{title} moved to position {n} of {total}.'"
  - "Delete only for an unused line, with the Delete {title}? question (Cancel focused first); a 422 shows the server's 'This product line is in use. Hide it instead.' in the question and the list reads again; a 404 says Already deleted"
  - "The product line editor (/admin/site-content/products/new and /:lineId): Names, Words, What you can customize, Price with the Visitors see line, Photos note (new lines), Order product types and RecordMeta, one sticky save bar, the 409 ConflictBanner with Load Latest, the Discard changes guard and the not-found state"
  - "productLineSchema (OR-3): every ProductLine.Check rule with the server's own messages, plus productLineValuesOf, toProductLineRequest, linePriceError, lineMinimumError, readLinePrice and readLineMinimum"
  - "productLinesService, useProductLineListQuery, useProductLineQuery and the five write hooks (every write clears the public data in this browser)"
  - "RowAction disabled and busy props (aria-disabled, aria-busy) in components/lists, test fixtures (demoLines, productLinesBackend, lineProductTypesAre) and the @site-content-products e2e journeys (5 projects)"
affects: [11-19, 11-22, 11-26, 11-27, 11-37]

requirements-completed: [CONT-02, PUB-03]

actuals:
  tokens: 46300
  tasks: 3
  commits: 6
plan_head_before: 66b6be125bd6666bfbaa8f86e54d4538c9e07e57
plan_head_after: c66374974323c5d689b670cf45f36d8d5c7bdf0e

tech-stack:
  added: []
  patterns:
    - "The shared entry carries no new route object for the editor: the existing site-content route became the splat site-content/*, and SiteContentRoute (the Site Content chunk) reads the rest of the address (products/new, products/{id}, else Page not found), because the public Contact chunk has 0.03 KB left"
    - "One row action at a time: Acting state holds every control until the list shows what the action did (or has been read again), derived rather than cleared in an effect, and focus moves in an effect once"
    - "Immediate actions go through useSubmission with an identity that moves on after each success, so moving the same line the same way twice is two moves"

key-files:
  created:
    - web/src/modules/admin/services/productLinesService.ts
    - web/src/modules/admin/services/productLinesService.test.ts
    - web/src/modules/admin/hooks/useProductLineQueries.ts
    - web/src/modules/admin/hooks/useProductLineQueries.test.tsx
    - web/src/modules/admin/components/ProductLinesTab.tsx
    - web/src/modules/admin/components/ProductLinesTab.test.tsx
    - web/src/modules/admin/components/OrderProductTypesCard.tsx
    - web/src/modules/admin/pages/ProductLinePage.tsx
    - web/src/modules/admin/pages/ProductLinePage.test.tsx
    - web/e2e/site-content-products.spec.ts
  modified:
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/src/modules/admin/pages/SiteContentPage.tsx
    - web/src/modules/admin/pages/SiteContentPage.test.tsx
    - web/src/modules/admin/siteContentSchemas.ts
    - web/src/modules/admin/siteContentSchemas.test.ts
    - web/src/modules/admin/siteContentCopy.ts
    - web/src/modules/admin/components/siteContent.recipe.ts
    - web/src/components/lists/cells.tsx
    - web/src/components/lists/lists.recipe.ts
    - web/src/components/lists/ResponsiveTable.test.tsx
    - web/src/test/siteContentFixtures.ts
    - docs/web/e2e.md

key-decisions:
  - "The editor addresses ride on the existing Site Content route, which became the splat site-content/*; SiteContentRoute draws the tabs page, the editor (ProductLineRoute treats the segment 'new' as a new line) or the in-shell Page not found. A second lazy loader and route object put public Contact over its 150 KB budget (150.07 KB); the splat leaves it at 149.97 KB"
  - "While any row action saves, every row's controls are aria-disabled (the plan says the row's other actions): one move changes the places of the other rows, and one submission is in flight at a time, so a press on another row would be dropped without a word. Parked as OI-2"
  - "The checklist keeps the ids of retired product types filed under the line in the form's list, so a save never frees them; toProductLineRequest sends the list as it is"
  - "A disabled RowAction changes colour (text-line-strong), not opacity, because a table row carries no opacity (D-02, an existing test)"
  - "RecordMeta shows 'Recorded by: Not set' (the line has no creator name) and the last changer with the time, as Business Info does"
  - "The editor of a line that exists shows no Photos card yet (plan 11-22); a new line shows the save-first note"

patterns-established:
  - "Row actions in a ResponsiveTable cell: RowAction disabled (aria-disabled, focusable) and busy (aria-busy), registered with useRowFocus under 'control:id' keys"
  - "The editor's title link is 24px tall at least (inline-flex min-h-6) beside text under it, so axe target-size passes at 320px"

duration: about 1h 40m
completed: 2026-11-12
status: complete

coverage:
  - id: D1
    description: "A Manager opens the Products tab and sees every line, shown and hidden, in display order with the 44px photo or placeholder, the title as a link over the short name, Starts at with the minimum or the empty marker, the order type and gallery counts and a Shown or Hidden badge; Add Product Line goes to the new line editor"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ProductLinesTab.test.tsx (the Product lines card)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-products.spec.ts a Manager edits Polo with the price 450.00 (5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A price set in the editor reaches the public Products page: Visitors see updates as it is typed, Save Changes sends the version the form opened with, the toast shows and the public data in this browser is cleared"
    requirement: "PUB-03"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ProductLinePage.test.tsx (setting a price); web/src/modules/admin/hooks/useProductLineQueries.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-products.spec.ts a Manager edits Polo with the price 450.00 (the public article shows Starts at and ₱450.00)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every ProductLine.Check rule runs in the browser first with the server's own message: title, short name, number, card text, description, the five customize texts, price (decimals before range) and minimum"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/siteContentSchemas.test.ts (productLineSchema: every ProductLine.Check rule); ProductLinePage.test.tsx (refuses an empty form before any request)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A new line starts unticked, shows the save-first note, creates with one Idempotency-Key and opens its editor (replace) with the 'hidden until you tick Show on the website' toast; a duplicate short name from the server lands under Short name with focus"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ProductLinePage.test.tsx (adding a line)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-products.spec.ts a Manager adds E2E-Shorts (5 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Order product types card lists active types A to Z, names a type filed under another line, files a ticked type here on save, keeps retired types filed, and with no types links to Settings"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ProductLinePage.test.tsx (the Order product types card)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A stale save shows the ConflictBanner above the first card with the typed values kept; Load Latest asks Discard changes? and replaces the values and the version; leaving with changes asks Discard changes?; an id that is not a GUID or a line the server does not know shows 'This product line wasn't found.'"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ProductLinePage.test.tsx (the record, the Hidden badge and the 409 banner; leaving the editor; a line that is not there)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Move up and Move down save at once with the focus and announcement rules; the first row's Move up and the last row's Move down are aria-disabled but focusable; Hide and Show save at once with their toasts and keep focus on the toggle"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ProductLinesTab.test.tsx (Move up and Move down; Hide and Show)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-products.spec.ts a Manager hides E2E-Shorts, shows it again and deletes it (5 projects)"
        status: pass
    human_judgment: false
  - id: D8
    description: "MUST NOT offer Delete for a line the server reports as in use, and MUST NOT delete without the confirmation dialog: Delete shows only when canDelete, asks first with Cancel focused, a 422 shows the server line and the list reads again, a 404 says Already deleted"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ProductLinesTab.test.tsx (Delete)"
        status: pass
      - kind: e2e
        ref: "web/e2e/site-content-products.spec.ts a Manager hides E2E-Shorts, shows it again and deletes it (5 projects)"
        status: pass
    human_judgment: true
    rationale: "The plan marks this prohibition as a judgment item. The tests prove Delete appears only when the server says canDelete, the question comes first and the in-use refusal reads again; whether that is enough care for the owner is a reviewer call."
  - id: D9
    description: "Admin tables scroll inside their frame on tablets and turn into row cards on phones, with no sideways page scroll at 320px and no axe violation"
    requirement: "CONT-02"
    verification:
      - kind: e2e
        ref: "web/e2e/site-content-products.spec.ts at 390px the list is row cards, at 768px it scrolls inside its frame, and at 320px the page has no sideways scroll (5 projects)"
        status: pass
      - kind: unit
        ref: "ProductLinesTab.test.tsx and ProductLinePage.test.tsx (axe in each state)"
        status: pass
    human_judgment: false
  - id: D10
    description: "The Products tab and the editor look right: the cards, the Visitors see line, the customize icons, the checklist and the save bar match the approved Site Content screens"
    verification: []
    human_judgment: true
    rationale: "The screens are SPEC-GAP (C-17), built from the My Profile card parts; no parity scenario draws them. The owner judges them in the UI review."
---

# Phase 11 Plan 20: A Manager manages the product lines and prices in Site Content Summary

**A Manager-only Products tab and product line editor over plan 11-17's routes: the ordered list with Move, Hide, Show and delete-when-unused, and the editor with every text, the price and minimum with a "Visitors see" preview and the order product type checklist, every server rule checked in the browser first, and every write clearing the public data in this browser.**

## Performance

- **Duration:** about 1h 40m (08:57 to about 10:36, -06:00); much of the last 40 minutes was waiting for the shared machine and the e2e runs
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files in the diff:** 24 (10 created, 14 modified), 4,425 lines added; the added text is about 46,700 tokens on the chars/4 scale (the plan estimated 140,000)

## Accomplishments

- **Products tab.** `ProductLinesTab` draws the S3 table: the 44px photo (`LazyImage`) or `MediaPlaceholder`, the title as a link over the short name, Starts at as Money over "min. 10 pcs" (or the empty marker), how many order types and gallery items are filed, a Shown or Hidden badge and the row actions. It has its own loading, error and empty states and the hide-versus-delete caption.
- **Row actions.** Move up and down, Hide or Show and Delete save at once (Delete asks first). The pressed control is `aria-busy`, every other control is `aria-disabled` and keeps focus, and once the list has read again focus stays on the pressed control; a move to the first or last place leaves that button `aria-disabled`, so focus goes to the other move button of the row. A polite line says where the line went. Hide and Show use the UI-SPEC toasts and keep focus on the toggle, now named Show or Hide.
- **Delete.** The button shows only when the server says `canDelete`. The question says "Delete {title}?" and "It's removed for good. This can't be undone." with Cancel focused first. A 422 shows "This product line is in use. Hide it instead." in the question and reads the list again, so Delete goes; a 404 closes the question, says "Already deleted" and reads again. After a delete, focus goes to the next row's Edit, else the previous one's, else Add Product Line.
- **Editor.** `ProductLinePage` is one form of cards: Names (Show on the website, Title, Short name, Number), Words, What you can customize (five fields with the public page's icons), Price (`MoneyInput` and Minimum with the "Visitors see" line), a save-first note on a new line, Order product types and RecordMeta, with the sticky save bar. The version a save sends is the one the form opened with.
- **OR-3.** `productLineSchema` mirrors `ProductLine.Check` rule for rule with the server's messages: the decimals of the price are checked before its range, the number is ASCII letters and digits only, each customize message names its own card. A server 400 lands on its field with focus (a duplicate short name under Short name).
- **Create and conflict.** A new line posts with one Idempotency-Key and opens its editor with `replace`, with the "hidden until you tick Show on the website" (or "on the website now") toast. A 409 shows the shared ConflictBanner above the first card; Load Latest asks Discard changes? and replaces the values and the version. Leaving with changes asks Discard changes? (link, Cancel, the guard and `beforeunload`).
- **Order product types (D-09).** The card lists every active type A to Z; a type under another line adds " (now under {line})" built from the line list. Ticking one files it here on save. The ids of retired types filed here stay in the list. With no types it says so and links to Settings.
- **PUB-03.** Every create, save, move, hide, show and delete calls `invalidatePublicContent()` (in the hooks) and reads the list again.

## Task Commits

| Task | Phase | Commit | Message |
|---|---|---|---|
| 1 (tracer) | RED | `023e1742` | test(11-20): add failing tests for the Products tab, the product line editor and a price saved to the public page |
| 1 (tracer) | GREEN | `31f3b60c` | feat(11-20): a Manager opens a product line, sets a price and saves, and the public Products page shows it |
| 2 | RED | `e651362a` | test(11-20): add failing tests for every line rule, adding a line, the order product types and the editor guards |
| 2 | GREEN | `b18dfb3b` | feat(11-20): the editor checks every rule, adds new lines and files order product types under a line |
| 3 | RED | `477a207b` | test(11-20): add failing tests for Move, Hide, Show and Delete with the focus and dialog rules |
| 3 | GREEN | `c6637497` | feat(11-20): Move, Hide, Show and Delete work from the list with the approved focus and dialog rules |

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) is not required, and Vitest prints none of the formats it reads for a hand run. The RED evidence is the real console output, read by hand. A RED commit precedes each GREEN commit.

- **Task 1 RED** (`023e1742`): 4 new test files could not load (the service, hooks, tab and page modules did not exist) and 11 tests failed on assertions in files that existed (3 in `SiteContentPage.test` for the Products tab, 2 in `ResponsiveTable.test` for `RowAction` disabled and busy, 6 in `siteContentSchemas.test` for the value and request mappers). Semantic assessment: the target tests ran and failed because the modules and props did not exist. For the new modules the RED is a missing import, not a stub that fails an assertion.
- **Tracer gate:** Task 1's `<verify>` is automated only. It was re-run end to end before expansion. The first run stopped at the build: the two editor routes put public Contact at 150.07 KB (limit 150.00), so they became one route (see Deviations); the second run passed 5 of 5 (`5 passed (43.7s)`).
- **Task 1 GREEN** (`31f3b60c`): the five plan test files and the lists, recipe, route and showcase files around them, 264 of 264 at the time; `ResponsiveTable.test` caught my first disabled look (opacity) and failed `not.toMatch(/opacity/)`, so the look is a colour (see Deviations).
- **Task 2 RED** (`e651362a`): 22 of 324 failed on assertions (8 schema rule tests, 14 page tests: the types card, the new line note, the empty form, RecordMeta, the 409 banner, Load Latest and the leave guard). The tests for the create flow, the duplicate short name, the Hidden badge, the unknown id and axe passed at RED because Task 1's shared form already did them.
- **Task 2 GREEN** (`b18dfb3b`): 426 of 426 in the seven files around it; e2e `10 passed (1.2m)`.
- **Task 3 RED** (`477a207b`): 18 of 30 failed on assertions (the caption, the row actions, the announcement, the focus rules, the delete question and its 422 and 404 paths, Hide and Show). The loading, error and empty tests passed at RED because Task 1's table already had those states.
- **Task 3 GREEN** (`c6637497`): 30 of 30 in `ProductLinesTab.test`. The first GREEN draft failed lint (`react-hooks/set-state-in-effect`, `react-hooks/refs`); the final design derives the busy state and moves focus in an effect that only reads and writes refs. The `flowActions` column flag (Deviation 4) has its own test in `ResponsiveTable.test`, written after the e2e found the overlap and seen failing first (`expected ... not to include 'pg-phone:absolute'`) before the code; it is in the GREEN commit, not in a RED commit of its own.
- **Weak spots, stated plainly:** four hook and component tests were corrected after GREEN (`useProductLineQueries.test` needed a seeded list cache, a row-text slice in `ProductLinesTab.test` was off by one, the page test now waits for the types query, and the test for the "other row stays available" rule was reversed when I chose to hold every row, see Deviations). No REFACTOR commit was needed.

## Verification evidence (real output)

- **Task 1 verify** (plan command plus the lists, route and recipe tests): `Test Files 15 passed (15)`, `Tests 264 passed (264)`.
- **Final unit runs** (this tree): `src/modules/admin`, `src/components/lists`, `no-long-dash.node.test.ts` and `source-layout.node.test.ts`: `Test Files 200 passed (200)`, `Tests 4915 passed (4915)`. The full web suite (`npx vitest run`, run one change before the last): `Test Files 1 failed | 360 passed (361)`, `Tests 1 failed | 9954 passed (9955)`. The one failure is `scripts/license-policy.test.ts` "exits 1 on a stricter policy given through --exceptions" (the known fresh worktree install failure: license-checker finds no packages; no package file was touched).
- **Lint and types:** `npm --prefix web run typecheck`: exit 0, three `tsc` lines and no output. `npm --prefix web run lint`: exit 0, `eslint . --max-warnings 0`, no output.
- **e2e `@site-content-products`** (final run on the final tree, all five projects, 4 tests each): `20 passed (1.5m)`. Some of the runs before it: Task 1 tracer `5 passed (43.7s)` (after the budget fix), Task 2 `10 passed (1.2m)`, then for Task 3 `12 passed, 8 failed` (the 320px axe overlap and two spec locators), `15 passed, 5 failed (11.0m)` (one journey hung on a pointer click behind a toast and held the lock, Deviation 5) and `19 passed, 1 failed (3.0m)` (the stolen focus, Deviation 6). None of the failures was a flake: each had one cause, found and fixed.
- **Public and admin bundle** (e2e build, gzip, limit 150 KB public and 250 KB admin): home 142.34, products 146.27, gallery 147.71, contact 149.97, notFound 142.90, admin 221.36, CSS 18.10. Before this plan (wave 7): home 142.29, products 146.22, gallery 147.66, contact 149.91, notFound 142.85, admin 221.19, CSS 18.06. **Contact has 0.03 KB left.**
- **Acceptance greps:** `site-content/products` in routes.tsx 1; `invalidatePublicContent` in ProductLinePage.tsx 1 (a comment; the calls are in `useProductLineQueries.ts`); `useProductTypesQuery` in ProductLinePage.tsx 2; `now under` in siteContentCopy.ts 2; `aria-disabled` in ProductLinesTab.tsx 6 (comments; the code passes `disabled` to RowAction); the in-use sentence in ProductLinesTab.test.tsx 1; `SPEC-GAP` in ProductLinePage.tsx 2.
- gitleaks ran in the pre-commit hook for every commit: `no leaks found`. The values in the diff are made up (the demo line names, `8c1f4a20-...` ids, `Carmen Reyes` from the existing fixtures).

## Decisions Made

- **The editor addresses ride on the Site Content route.** The route `site-content` became the splat `site-content/*` (a two character change, behind the same Manager loader). `SiteContentRoute` reads the rest of the address: empty is the tabs page, `products/new` or `products/{id}` is `ProductLineRoute` (the segment `new` is no GUID, so it can never be a line's id), anything else is the in-shell Page not found screen, as it was before.
- **Hold every row while one action saves.** See Deviations 2 and OI-2.
- **Retired product types stay filed.** The form's list holds every id the line had, the checklist only draws the active ones, and a tick or untick changes only its own id.
- **Disabled look.** `RowAction` takes `disabled` and `busy`; a disabled control changes colour only.
- **Failure toasts of immediate actions** read "Couldn't move {title}", "Couldn't hide {title}" and "Couldn't show {title}" with the shared error line (SPEC-GAP; the UI-SPEC says only "a danger toast with the server's line").
- **Photos.** The editor of an existing line has no Photos card; plan 11-22 adds it. A new line shows "Save the product line first, then add photos."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two editor routes broke the Contact bundle budget**
- **Found during:** Task 1 tracer gate (`npm --prefix web run e2e` stops at the build)
- **Issue:** the new lazy loader and the second route object added about 0.16 KB gzip to the shared entry: Contact 150.07 KB against its 150.00 KB limit (it had 0.09 KB left, as the orchestrator warned).
- **Fix:** first one route, `site-content/products/:lineId`, reusing the Site Content lazy chunk (Contact 149.96 KB after Task 1, `31f3b60c`). At the end the existing `site-content` route became the splat `site-content/*` and `SiteContentRoute` reads the rest of the address, so no route object is added at all. A nested child route was tried and was 0.01 KB worse. Contact is 149.97 KB at the end (the build with no route change at all is 149.95 KB, so the rest of the growth is the `flowActions` recipe strings, see Deviation 4).
- **Files modified:** `routes.tsx`, `SiteContentPage.tsx`, `ProductLinePage.tsx`, `routes.test.tsx` (unknown addresses under Site Content for a Manager)
- **Verification:** `vite build --mode e2e` budget table (all `ok`), `routes.test.tsx` for the Manager, Admin and signed-out cases of both addresses and for `site-content/no-such-page`, `site-content/products` and `site-content/products/a/b`
- **Committed in:** `31f3b60c` (first version), c6637497 (the splat)

**2. [Rule 1 - Bug in the plan's wording] "that row's other actions are aria-disabled" would drop a press on another row**
- **Found during:** Task 3 design
- **Issue:** one `useSubmission` instance holds one request, so a press on another row while one saves returns the first request and is lost without a word. One move also changes the places of the other rows.
- **Fix:** while any action saves or waits for the list, every row's controls are `aria-disabled` (the pressed one is `aria-busy` and keeps focus); a press is ignored. The plan's wording for the pressed row is met as written.
- **Files modified:** `ProductLinesTab.tsx`, `ProductLinesTab.test.tsx`
- **Committed in:** c6637497

**3. [Rule 1 - Bug] A disabled row action dimmed with opacity broke an existing table test**
- **Found during:** Task 1 (`ResponsiveTable.test` "puts an inactive row on --surface-2 ... by colour only (D-02)")
- **Fix:** the disabled look is `aria-disabled:text-line-strong` and `aria-disabled:cursor-not-allowed`.
- **Files modified:** `lists.recipe.ts`, `ResponsiveTable.test.tsx` (my own test now checks the colour tokens)
- **Committed in:** `31f3b60c`

**4. [Rule 2 - Missing critical] On a phone the five row actions covered the title link (axe `target-size` at 320px)**
- **Found during:** Task 3 e2e (the 320px axe check failed in 4 of 5 projects, twice)
- **Issue:** the phone card pins the actions cell to the card's top right and reserves 88px for it, which fits two or three 36px buttons. Five buttons (about 210px) lay over the title link, so the link and the buttons were overlapping targets. The title link was also only 20px tall (the WCAG 2.5.8 minimum is 24px; its 44px hit area is a pseudo element axe cannot see).
- **Fix:** a new optional column flag `flowActions` in `components/lists` (`columns.ts`, `lists.recipe.ts`): on phones the actions cell stays in the card as a full-width row under the other cells instead of being pinned, and the product line actions use it. The title link is `inline-flex min-h-6 items-center self-start`; the Settings link inside the types note got its own inline class. Unit test: `ResponsiveTable.test` "an actions column with flowActions".
- **Files modified:** `columns.ts`, `lists.recipe.ts`, `ResponsiveTable.test.tsx`, `ProductLinesTab.tsx`, `siteContent.recipe.ts`, `OrderProductTypesCard.tsx`
- **Committed in:** c6637497

**5. [Rule 3 - Blocking] Test details in the e2e spec**
- **Found during:** Task 3 e2e
- **Issue:** `getByRole('region', { name: 'Product lines' })` matched the card section too, and `getByRole('link', { name: 'Site Content' })` matched the sidebar item and the back link. The journey also hung on the Pixel project (a pointer `click()` on Show with no timeout, so it ran to the 480 s test timeout while holding the site content lock and made three other tests time out waiting for it): the success toasts of the earlier steps were still on screen over the last card, which now carries its actions at the bottom on a phone, and a pointer click waits for the thing in front to go.
- **Fix:** the table frame is found by its `div[role="region"]`, the back link by its `href`, and the row actions of the journey are pressed from the keyboard with the existing `press` helper (focus, then Enter), which is also how its focus rules are proved. Not an app defect; a toast over the last row of a phone card stays as it is for every list.
- **Committed in:** c6637497

**6. [Rule 1 - Bug] Focus was taken a second time after the list finished reading**
- **Found during:** Task 3 e2e (the chromium journey: after a Move, the next keyboard press on Delete moved the line up again instead of opening the question)
- **Issue:** the action state was copied when the list finished reading (`settled: true`), and the effect that moves focus compared the whole object with the last one it had handled, so the copy counted as a new action and put focus back on Move up, taking it from whatever the person had moved to meanwhile. Which of the two renders came first is a race, so it showed only some of the time.
- **Fix:** each press makes one token that every copy of the action keeps, and the effect compares the token. A unit test guards the count of focus calls (`ProductLinesTab.test` "moves focus once per action"); it cannot force the unlucky order, so it passed before the fix as well. The e2e journey is what found it, and it passed after.
- **Files modified:** `ProductLinesTab.tsx`, `ProductLinesTab.test.tsx`
- **Committed in:** c6637497

### Plan wording and process notes

**7. [Process] Files outside the plan's list.** `OrderProductTypesCard.tsx` (the checklist card, to keep the page file small), `lists/cells.tsx`, `lists/lists.recipe.ts` and `ResponsiveTable.test.tsx` (RowAction disabled and busy), `routes.test.tsx` (the two addresses for every role), `siteContent.recipe.ts` and `docs/web/e2e.md`.
**8. [Process] RED tests that passed at RED.** See TDD Gate Compliance: several Task 2 and Task 3 tests passed at RED because the Task 1 form and table already did the work. I did not hold back Task 1 code to make them fail.
**9. [Process] The ledger file.** `gsd-plan-head-before-11-20` was written after the base was checked and before the first commit; `commits: 6` is `git rev-list --count 66b6be12..HEAD` before this SUMMARY commit (see the frontmatter).
**10. [Plan wording] `toProductLineRequest(values, version, keptTypeIds)`** was first written with a third argument for the retired types; the form keeps those ids in its own list, so the argument and its test were removed.

---

**Total deviations:** 6 auto-fixed (2 Rule 3, 3 Rule 1, 1 Rule 2), 4 notes. **Impact:** no scope creep; no package, schema, migration or trigger.

## Issues Encountered

- The first tracer e2e run failed at the build (Deviation 1); the next two Task 3 e2e runs failed on test locators and the 320px target size (Deviations 4 and 5). The final run is clean.
- The Bash tool in this worktree refuses heredocs and commands that mix `git` with command substitution, so files were written with the Write and Edit tools and the plan-head ledger with a plain `echo`.
- Python is not installed on this machine, so no scripted edits were possible.
- Not run here: Lighthouse, parity (no parity scenario draws these screens), the Windows deploy job, the .NET suites (no server code changed).

## Owner items (open, nothing blocks the plan; recommendation first)

**OI-1. "Recorded by: Not set" on a product line.** The detail has a creation time but no creator name, so RecordMeta shows "Recorded by: Not set", as Business Info does. Options: **(a) keep as is (recommended, shared component untouched)**; (b) the server adds the creator name to the line detail and the row shows it.

**OI-2. One action at a time on the whole list.** While a move, hide or show saves, every row's buttons are aria-disabled for a moment. The UI-SPEC says only the row's own. Options: **(a) keep (recommended: one move changes the places of the other rows)**; (b) one request queue per row, so another row's button stays live.

**OI-3. Words of the failure toasts of Move, Hide and Show.** "Couldn't move {title}", "Couldn't hide {title}" and "Couldn't show {title}" are mine (SPEC-GAP). Options: **(a) keep (recommended)**; (b) a shorter line such as "Couldn't save the change".

**OI-4. Public Contact bundle has 0.03 KB left.** Contact is 149.97 KB of 150 (it was 149.91 before this plan). Plan 11-19, 11-26 and any later plan that touches a shared module or adds a route can put it over. Recommendation: the orchestrator or the owner decides where to find about 1 KB (for example moving the open status or the hours text to a lazy file) before the next public change, and builds after merging the two plans of this wave.

**OI-5. Load Latest question wording.** "Load Latest replaces what you typed with the saved version. Your typed changes are lost." is the Business Info wording reused (SPEC-GAP). Options: **(a) keep (recommended)**; (b) a longer sentence.

## Known Stubs

None. (The Photos card of an existing line and the main photo thumbnail are not stubs of this plan: the server returns `mainPhotoThumb` null until plan 11-19 and the gallery count 0 until plan 11-26, and the table already draws both when they arrive.)

## Threat Flags

None new. T-11-50 (the id in the address): `guidParser` runs before any request and an id that is not a GUID shows "This product line wasn't found." with no request, in unit tests and for the loader redirect. T-11-51 (double submissions): every POST carries one Idempotency-Key through `useSubmission`, a busy control ignores a press, and a double click sends one request. T-11-SC: no package was added or bumped; `web/package.json` and the lock file are unchanged (`npm ci --ignore-scripts` ran only from the lockfile). The Manager-only routes sit behind `requireManager` (an Admin goes to /admin, tested for both addresses).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **11-19 and 11-22 (line photos):** `ProductLineListItem.mainPhotoThumb` already feeds the 44px photo; the editor of an existing line has room for a Photos card between Price and Order product types (the new-line note is in the same place). Photo writes must take the site-content lock (OI-4 of plan 11-17).
- **11-26 (gallery):** the table's Gallery column reads `shownGalleryCount`; the delete rule already hides Delete while the server says `canDelete` is false.
- **11-37 (audit labels):** no new audit code here.
- **Bundle:** see OI-4. Any new public route, loader or shared module needs a budget run first.
- **Hot spots for the merge:** `siteContentCopy.ts`, `siteContentSchemas.ts`, `siteContentFixtures.ts`, `SiteContentPage.tsx` (the `BUILT_PANELS` map and `SiteContentRoute`), `routes.tsx` and `docs/web/e2e.md`.
- STATE.md and ROADMAP.md were not touched (orchestrator owns them). CONT-02 and PUB-03 are shared with other plans, so the orchestrator should mark them only after the last plan that declares each.

## Self-Check: PASSED

- All 10 created files exist on disk (checked with `ls`): the service, hooks, tab, types card, page, their 5 test files and the e2e spec.
- Commits `023e1742`, `31f3b60c`, `e651362a`, `b18dfb3b`, `477a207b` and `c6637497` are ancestors of HEAD; each RED commit precedes its GREEN commit.
- The measured commit count is 6 (`git rev-list --count 66b6be12..HEAD` before this SUMMARY commit), read against the base id kept in the per-plan ledger file, not written from memory; `plan_head_after` is `c6637497`.
- `git status` shows nothing else untracked or modified (the Playwright `test-results` and `.locks` folders are git-ignored).

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*

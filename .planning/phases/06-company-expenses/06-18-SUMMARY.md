---
phase: 06-company-expenses
plan: 18
subsystem: web
tags: [playwright, e2e, a11y, responsive, showcase, kpi, long-text, or-4]
created: "2026-10-25T19:35:00-05:00"
updated: "2026-10-25T19:35:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: The Company Expenses, Deleted Expenses and Settings pages, the expense and category modals, both delete confirmations, CategoryBadge, ExpenseActorCell and the E1/E4/S1 table patterns (plans 06-04 to 06-17)
provides:
  - "@expenses-sweep e2e (all five projects): the three Phase 6 pages at 8 widths in Blush and Espresso (no sideways scroll, axe clean), the Add Expense, Edit Expense and Add Category dialogs at 320 x 568 and at 200% zoom, a 200-character description in the delete confirmation and toast, and the Phase 6 showcase cases at 320, 390 and 1440 px in both themes"
  - "Phase6Demos: an 'Expenses and settings' section in the Component Showcase with the E1 table and footer, the month cards (full and empty), the E2 modal in add, edit and view, both E3 dialogs, E4 rows, S1 rows and S2 with colour previews, all on made-up worst-case data"
  - "kpiLongValueClasses: a smaller clamp for a money figure of 15 characters or more, so 999,999,999.99 fits a KPI card at 320 px"
  - "Worst-case constants in web/src/test/expenseFixtures.ts (40-character category, 1,000-character notes, largest amount and period total)"
affects: [06-19, 07]

actuals:
  tokens: 17820
  tasks: 2
  commits: 8
plan_head_before: 157ec00bcf28478f5364f9488936a92654836089
plan_head_after: 84158ad93c23b1d2a0a16d9aeac139c087146624

tech-stack:
  added: []
  patterns:
    - "Text-overflow scan for e2e: every text node's painted extent (a text range) is compared with its nearest box, which is engine-neutral; scrollWidth versus clientWidth was not (Firefox adds a cell's reserved padding to scrollWidth, and a button's invisible 44 px touch area inflates it everywhere)"
    - "Showcase twins for service-driven modals: the E2 and S2 demos are made from the same shared parts (Modal, Field, DateInput, MoneyInput, Select, RadioGroup, RecordMeta, ConflictBanner, Note, CategoryBadge) on local state, so a demo can never save a record"
    - "One showcase test per theme and width, because one test that opened 7 dialogs and ran axe 6 times on a 190-case page timed out in WebKit and iPhone"

key-files:
  created:
    - web/e2e/expenses-sweep.spec.ts
    - web/src/modules/admin/components/showcase/Phase6Demos.tsx
    - web/src/modules/admin/components/showcase/Phase6Demos.test.tsx
  modified:
    - web/src/components/money/KpiCard.tsx
    - web/src/components/money/money.recipe.ts
    - web/src/components/money/money.test.tsx
    - web/src/modules/admin/components/showcase/Phase5Demos.tsx
    - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
    - web/src/modules/admin/components/showcase/showcaseCopy.ts
    - web/src/modules/admin/components/showcase/showcaseSections.ts
    - web/src/modules/admin/components/showcase/showcaseSections.test.ts
    - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
    - web/src/test/expenseFixtures.ts
    - web/e2e/showcase.spec.ts
    - docs/web/e2e.md

key-decisions:
  - "The new showcase section is titled 'Expenses and settings', not 'Company expenses': the E1 table is a region named 'Company expenses', so a section of the same name made the region lookup ambiguous (a test and an e2e both failed on it)."
  - "The 200% zoom check uses a 640 x 360 window (a 1280 x 720 desktop at 200%), because Playwright has no browser zoom in all five engines; it proves the same reflow."
  - "The KPI fix is scoped to figures of 15 or more characters (100,000,000.00 and up). Shorter figures keep the approved clamp, so no existing card and no parity scenario changes."
  - "The sweep seeds real rows for the real pages and uses the showcase for what a real page cannot be given (a period total of 999,999,999.99 would need a thousand rows; a former staff member needs a deleted user)."

patterns-established:
  - "Showcase demo cases for a phase live in PhaseNDemos.tsx with DemoCase (now exported from Phase5Demos.tsx) and a section entry in showcaseSections.ts"
  - "A backstop that a real page cannot show is checked on a showcase case with worst-case data and named as such in docs/web/e2e.md"

requirements-completed: [CEXP-01, CEXP-02, CEXP-03, CEXP-04, CEXP-05]

coverage:
  - id: D1
    description: "The Company Expenses (with search, category and dates set: three chips), Deleted Expenses and Settings pages do not scroll sideways at 320, 375, 414, 768, 1024, 1280, 1536 and 1920 px in Blush and Espresso, with a 200-character description, a 1,000,000.00 amount and a 100-character payer name; the wide tables scroll inside their own frame; axe finds nothing at any width"
    verification:
      - kind: e2e
        ref: "web/e2e/expenses-sweep.spec.ts @expenses-sweep (three page tests; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Add Expense, Edit Expense (1,000-character note scrolls in its box, Recorded by visible) and Add Category (six colour rows) dialogs fit at 320 x 568 and at 200% zoom with the footer buttons reachable"
    verification:
      - kind: e2e
        ref: "web/e2e/expenses-sweep.spec.ts @expenses-sweep the Add Expense, Edit Expense and Add Category dialogs (5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A 200-character description wraps inside the delete confirmation and the Expense deleted toast on the real list at 320 and 390 px"
    verification:
      - kind: e2e
        ref: "web/e2e/expenses-sweep.spec.ts @expenses-sweep a 200-character description (5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Component Showcase has an Expenses and settings section with every Phase 6 part on made-up worst-case data and local state; no request is made; axe finds nothing in the cases or in any of the seven demo dialogs"
    requirement: CEXP-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/showcase/Phase6Demos.test.tsx; showcaseSections.test.ts; ComponentShowcasePage.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses-sweep.spec.ts @expenses-sweep the Phase 6 showcase cases (six per project: 3 widths x 2 themes); web/e2e/showcase.spec.ts @showcase (5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "On the showcase at 320, 390 and 1440 px in both themes no line of text is drawn past its box (200-character descriptions, 100-character names with (former staff), 40-character category names, 1,000-character notes, 1,000,000.00 rows, a 999,999,999.99 total) and the three month cards are level where they share a row"
    verification:
      - kind: e2e
        ref: "web/e2e/expenses-sweep.spec.ts @expenses-sweep the Phase 6 showcase cases (30 of 30)"
        status: pass
    human_judgment: false
  - id: D6
    description: "How the pages, the showcase cases and the dialogs look at 390, 820 and 1440 px in both themes (the owner screenshot review, UI-SPEC backstop 9), and whether a period total as large as 999,999,999.99 on the real list looks right"
    verification: []
    human_judgment: true
    rationale: "A look is the owner's call (plan 06-19); the sweep proves fit and accessibility only. A real-list total that large needs about a thousand rows, so it is proved on the showcase case only."

duration: 2h 20m
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 18: Responsive and long-value sweep and the Phase 6 showcase Summary

**A five-engine Playwright sweep proves the three Phase 6 pages, their dialogs and a new "Expenses and settings" showcase section hold up from 320 to 1920 px in both themes on the longest and largest values the rules allow; it caught one real fault, a 999,999,999.99 KPI figure running 4 px past its box, which is fixed.**

## Performance

- **Duration:** about 2h 20m (the start time was not recorded; this is estimated from the first commit)
- **Completed:** 2026-10-25
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD), 8 commits
- **Files changed:** 15 (3 created)

## Accomplishments

- **Tracer (Task 1):** `@expenses-sweep` signs in a Manager and seeds a 200-character description, a 1,000,000.00 amount, a 1,000-character note and a payer with a 100-character name. `/admin/expenses` (search, category and dates set, so three chips), `/admin/expenses/deleted` and `/admin/settings` are swept at 320, 375, 414, 768, 1024, 1280, 1536 and 1920 px in Blush and Espresso: no sideways scroll, `html` and `body` never hide overflow, axe finds nothing at any width. The Add Expense, Edit Expense and Add Category dialogs fit at 320 x 568 and at 200% zoom, with the 1,000-character note scrolling in its own box, Recorded by visible and every footer button reachable. The sweep found no layout gap in the real pages, so Task 1 changed no page or component.
- **Showcase (Task 2):** `Phase6Demos` adds the "Expenses and settings" section with `expenses-table` (an Upcoming row, a former staff payer with a 100-character name, a retired 40-character category, a 200-character description, a row at 1,000,000.00 and a footer at 999,999,999.99), `expenses-kpis` and `expenses-kpis-empty`, `expenses-modal` (Add, Edit with the stale-save banner and the access note, View with 1,000 characters of notes), `expenses-delete-dialogs` (both E3 confirmations), `expenses-deleted-rows`, `settings-category-rows` (active, retired, never used, Others) and `settings-category-modal` (Add and Edit with the six colour radios and live badge previews). Every case runs on local state and makes no request; the people are spec section 12 names and no email address appears in any case.
- **Showcase checks in the sweep:** six tests per project (3 widths x 2 themes) check that no text is drawn past its box, the month cards are level, axe is clean in the cases, and each of the seven dialogs opens axe-clean with its footer reachable. A separate test checks the real list at 320 and 390 px: a 200-character description wraps inside the delete confirmation and the `Expense deleted` toast.
- **Real fault found and fixed:** at 320 and 390 px, `₱999,999,999.99` ran 4 px past the KPI value box (176 > 172 and 246 > 242). `KpiCard` now uses a smaller clamp for a money figure of 15 characters or more.

## Task Commits

1. **Task 1: Tracer, the three Phase 6 pages never scroll sideways at any width or theme**
   - `f18bc8d` (test): the sweep
   - `6115db2` (feat): the docs row (no layout fix was needed)
2. **Task 2: The showcase shows every Phase 6 part with the longest and largest values, and the sweep checks them**
   - `246cbc4` (test, RED): Phase6Demos tests, section tests, worst-case fixtures, showcase sweep
   - `f593c5e` (test, RED): the largest KPI amount fits its card
   - `8a430e8` (fix): KPI long-figure clamp
   - `c33db1c` (feat): Phase6Demos, the section, and the sweep refined to one test per theme and width
   - `89d6a5b` (docs): the e2e guide lists the showcase checks
   - `84158ad` (test): a 200-character description in the delete dialog and toast

**Plan metadata:** the `docs(06-18)` commits that follow this file.

### TDD gate compliance

- **Task 1:** the RED commit (`f18bc8d`) is a sweep that passed on the first run in all five projects (20 of 20). That is an unexpected green by the RED rule, so I checked why: the layouts were built to the UI-SPEC with 320 px checks in plans 06-04 to 06-17, and the same scroll read and axe call catch real overflow elsewhere (the same read is used by `shell.spec.ts`). The check also failed correctly later on the KPI figure and the showcase, so it can fail. The GREEN commit is only the docs row, because there was no gap to fix.
- **Task 2 RED:** `Phase6Demos.test.tsx` failed to load (`Failed to resolve import "./Phase6Demos"`), and the section tests failed on the missing section (`expected [ 'Brand & icons', ... ] to deeply equal [ ..., 'Company expenses' ]`). Semantic assessment: both are the planned missing module and section.
- **KPI RED:** the e2e first caught the fault (`176>172` at 320 px, `246>242` at 390 px); the unit test `money.test.tsx` then failed on the missing `kpiLongValueClasses` export (`TypeError: Cannot read properties of undefined (reading 'split')`). It fails on the planned missing export rather than on an assertion; the behavioural red evidence is the e2e line above.
- `gsd_run check tdd-red-evidence` reads JUnit from the MTP runner and does not apply to Vitest or Playwright, so the evidence is the quoted run with the semantic assessment, as in plans 06-12 to 06-17.

## Verification evidence

- Final e2e (all five projects): `npm --prefix web run e2e -- --grep "@expenses-sweep|@showcase|@expenses-kpis"` gave `110 passed (26.9m)`; the later 200-character test then gave `4 passed` (chromium, firefox) and `6 passed` (webkit, pixel, iphone).
- `npm --prefix web run verify` exited 0: `eslint . --max-warnings 0`, `All matched files use Prettier code style!`, `Test Files  202 passed (202)` / `Tests  5918 passed (5918)`, `Statements   : 95.52%`, `Branches     : 90.38%`, budgets `public JS 123.08 KB (150), admin JS 206.51 KB (250), CSS 14.78 KB (35)`, `License gate passed.`, `THIRD-PARTY-NOTICES.txt is up to date (28 packages).` The showcase stays a lazy chunk (`ComponentShowcasePage` 38.63 KB gzip) and the build-output tests (showcase address scan, no dev route path) passed.
- The text-overflow scan went through three versions before it was right, so each was run against the real result: `scrollWidth` versus `clientWidth` flagged 256 false positives (a button's 44 px touch area and, in Firefox, a cell's reserved padding); a text-range-per-element version flagged scrolling tables and the visually hidden "Not set"; the final per-text-node version flagged nothing but the one real fault, then passed in both engines. No check was loosened to pass: the final scan is stricter in kind (painted text versus its box) and its first run still reported the 4 px KPI overflow.
- Shared machine: `e2e.mjs` took the run lock and ran the preflight before every run; only CSPS_E2E was used; no BetsLLC database, port or process was touched; no background shell was left running.

## Decisions Made

- See key-decisions. All four are within the plan; none changes a ruling or wording the owner settled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A 15-character KPI figure ran past its value box**
- **Found during:** Task 2 (first showcase sweep)
- **Issue:** `₱999,999,999.99` is 4 px wider than the KPI value box at 320 and 390 px (the clamp `clamp(26px,15cqi,40px)` is 1.5% too large for that many digits, and its 26 px floor is too big at 320 px). It spilled into the card padding. It is the plan's own backstop ("a ₱999,999,999.99 period total fit ... the KPI value at 320 and 1440 px").
- **Fix:** `kpiLongValueClasses` (`clamp(22px,13.5cqi,40px)`) for money figures of 15 or more characters; shorter figures keep the approved clamp, so no parity scenario changes (their amounts are under 14 characters).
- **Files modified:** web/src/components/money/KpiCard.tsx, money.recipe.ts, money.test.tsx (not in the plan's list)
- **Verification:** unit test plus the showcase sweep at 320, 390 and 1440 px in both themes, all engines
- **Committed in:** f593c5e (RED), 8a430e8 (fix)

**2. [Rule 3 - Blocking] Existing tests pinned eleven showcase sections**
- **Found during:** Task 2
- **Issue:** `showcase.spec.ts` (section titles, `toHaveCount(11)`) and `ComponentShowcasePage.test.tsx` listed the sections; a twelfth section broke them. Neither file is in the plan's list.
- **Fix:** added "Expenses and settings" to both lists and the count to 12.
- **Files modified:** web/e2e/showcase.spec.ts, web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
- **Committed in:** 246cbc4, c33db1c

**3. [Rule 3 - Blocking] The demos needed the Phase 5 `DemoCase` frame**
- **Issue:** `DemoCase` (the labelled `data-case` frame) was private to `Phase5Demos.tsx`.
- **Fix:** exported it (and its props type) instead of copying 25 lines.
- **Files modified:** web/src/modules/admin/components/showcase/Phase5Demos.tsx
- **Committed in:** c33db1c

**4. [Rule 1 - Bug] Test-side faults found while running the sweep**
- The first showcase test timed out at 300 s in WebKit and iPhone (one test did 3 widths x 2 themes x 7 dialogs plus axe); it is now one test per theme and width. The footer-button lookup matched both the dialog's Close icon and the footer Close (`strict mode violation`); it now looks inside `footer`. The View demo lacked the focusable named region that the real View has (axe `scrollable-region-focusable` at 320 px); the twin now has it, as the real modal does.
- **Files modified:** web/e2e/expenses-sweep.spec.ts, Phase6Demos.tsx
- **Committed in:** c33db1c

### Plan wording notes

- Section title: the plan says "a Phase 6 section"; I titled it "Expenses and settings" (see key-decisions).
- `web/src/test/expenseFixtures.ts` gained the worst-case constants, but the shipped demos hold their own copies, because that file imports MSW and cannot ship; the unit test checks the two agree (200, 100, 40 and 1,000 characters).

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking); 0 checkpoints.
**Impact on plan:** No scope change. One small change to a shared component (Deviation 1) that the plan's own backstop required.

## Issues Encountered

- A first `node -e` edit with backticks inside a double-quoted shell string wrote an empty comment and an empty `test(` call; the damage was caught by the parse error and the files were fixed with the Edit tool before any run or commit.
- `docs/web/e2e.md` has CRLF line endings; the rows were inserted with a script that keeps them.

## Left for the owner's screenshot review (plan 06-19), not passed silently

- **A real-list period total of 999,999,999.99.** One row is capped at 1,000,000.00, so the real footer would need about a thousand rows. It is proved on the showcase case (`expenses-table`) only.
- **A former staff member on the real pages.** It needs a deleted user, so `(former staff)` with a 100-character name is proved on the showcase (`expenses-table`, `expenses-deleted-rows`) only. A 100-character live payer name is proved on the real pages.
- **A 40-character category name on the real pages.** Proved on the showcase and in the Add Category dialog (a 40-character name is typed in the sweep); the real list rows were not given one.
- **200% zoom** is emulated by a 640 x 360 window, not by a browser zoom.
- **How it looks** (backstop 9): 390, 820 and 1440 px in both themes.

## Known Stubs

None. The showcase demos are intentionally local (no request, nothing saved); that is their purpose, not a stub.

## Threat Flags

None. T-06-57 (real-looking personal data in shipped demo data) is mitigated and tested: only spec section 12 names and a test asserts the demos show no address outside `example.com`; the build-output address scan passed. T-06-58 (CSP violations from new components) is mitigated: every sweep test runs under the shared CSP listener, no component uses a style attribute. T-06-SC: no package was installed.

## User Setup Required

None.

## Owner items

- New dev wording to review with the other SPEC-GAP copy (05 D-48): the showcase section title "Expenses and settings" and the seven demo trigger labels (`Open Add Expense`, `Open Edit Expense`, `Open Expense details`, `Open Delete Expense`, `Open Delete Permanently`, `Open Add Category`, `Open Edit Category`).
- Please look at the KPI card with a very large figure in plan 06-19: figures of 15 characters or more are drawn at a smaller size than the other cards (down to 22 px at 320 px), by design.
- The E2 and S2 showcase demos are copies of the real modals built from the same shared parts. If a field is added to a real modal, the demo needs the same field (the unit test and the sweep would not notice a missing one).

## Next Phase Readiness

- Plan 06-19 (the owner's visual review) can use the `expenses-*` and `settings-*` showcase cases and `docs/web/e2e.md`.
- No blockers.

## Self-Check: PASSED

All created files exist on disk (`expenses-sweep.spec.ts`, `Phase6Demos.tsx`, `Phase6Demos.test.tsx`); the eight task commits (`f18bc8d`, `6115db2`, `246cbc4`, `f593c5e`, `8a430e8`, `c33db1c`, `89d6a5b`, `84158ad`) are ancestors of HEAD; `npm --prefix web run verify` exited 0 and the Phase 6 e2e passed in all five projects.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*

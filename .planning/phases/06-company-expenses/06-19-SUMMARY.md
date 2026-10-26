---
phase: 06-company-expenses
plan: 19
subsystem: web
tags: [owner-review, screenshots, playwright, rulings, wording-review, d-29, slice-pattern]
created: "2026-10-25T20:40:00-05:00"
updated: "2026-10-25T20:40:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: The real Company Expenses, Deleted Expenses and Settings pages, the expense and category windows, both delete confirmations, the Audit Log expense lines, and the Phase6Demos showcase section (plans 06-04 to 06-18)
provides:
  - "npm --prefix web run review: a 'Company expenses and settings (Phase 6)' section in artifacts/owner-review/index.html (git-ignored) with 17 cases x 2 themes x 3 widths (102 pictures), signed in as a Manager and, for three screens, as an Admin, plus Company Expenses, Deleted Expenses and Settings as signed-in pages in the page list"
  - "A Phase 6 rulings page: OQ-1 to OQ-15 with options and the built one, A-06-02, the audit viewer, the speed-test data size and the snapshot line as open; A-06-01 (D-49) and the three inline SQL files (D-50) as ruled, with their follow-up plans; four things for the owner's own eyes"
  - "A 'Words on the Phase 6 screens' table built from expensesCopy.ts, settingsCopy.ts and the Phase 6 additions of auditCopy.ts"
  - "design-side-by-side.mjs marks Company Expenses, Users and My Profile as signed-in pictures"
  - "docs/api/company-expenses.md 'The slice pattern Orders copies (D-29)': ten steps, each with its files and proof"
  - "npm run review starts again under plain Node: the copy modules are read through a short-lived Vite server when '@/' cannot be resolved"
affects: [07, 06-20, 06-21]

actuals:
  tokens: 22564
  tasks: 2
  commits: 4
plan_head_before: c7c00ccbf72e12e2fe4f262ce0d1de4746124170
plan_head_after: a64c62a5a852c98014a32969e14d0c296c31c001

tech-stack:
  added: []
  patterns:
    - "A page answer changed in the browser for one picture: the real answer is fetched from the server first (route.fetch), then only the needed part is replaced (empty month, empty list, empty Deleted Expenses), so the shape stays the server's own"
    - "Console messages a case expects (the 409 of the stale-save picture) are declared per page (allowConsole) instead of being filtered for every case"
    - "Rulings as data: each entry has options with 'recommended' and 'built' marks, and a status of open or ruled, so the pack shows what is built and what the owner chose without ever calling anything approved"

key-files:
  created:
    - .planning/phases/06-company-expenses/06-19-SUMMARY.md
  modified:
    - web/scripts/owner-review.mjs
    - web/scripts/owner-review.test.ts
    - web/scripts/design-side-by-side.mjs
    - web/scripts/design-side-by-side.test.ts
    - docs/web/owner-review.md
    - docs/api/company-expenses.md
    - .planning/STATE.md

key-decisions:
  - "A-06-01 and the inline SQL item are shown as ruled (D-49, D-50) with their follow-up plans (06-20, 06-21), not as open questions: the owner ruled both after the plan was written. Option 2 of A-06-01 and option 1 of the SQL item stay marked 'built now' because the code still behaves that way until the follow-ups land."
  - "The run seeds its own data in CSPS_E2E and marks every row with the run's tag, so the pages are narrowed with a search to this run's expenses (as the Users page was narrowed in 05-37). The month cards cannot be narrowed: they count the whole test database, so the pack says their figures are not the shop's."
  - "Pictures that need a state the shared database cannot hold (a month with no expenses, an empty list, an empty Deleted Expenses) fetch the real answer and change only the needed part, rather than inventing a whole answer."
  - "The copy modules are read through Vite only when a plain import fails, so Vitest keeps its own path and npm run review gets the same alias the app uses."

patterns-established:
  - "A review case that needs a second person (an Admin) signs a second seeded person in through the real sign-in screens (openSignedIn takes the person's key)"

requirements-completed: [CEXP-01, CEXP-02, CEXP-03, CEXP-04, CEXP-05]

coverage:
  - id: D1
    description: "npm --prefix web run review builds the Phase 6 section: 17 cases in Blush and Espresso at 390, 820 and 1440 px (102 pictures), Company Expenses, Deleted Expenses and Settings as signed-in pages, and the report lists no errors"
    requirement: CEXP-01
    verification:
      - kind: unit
        ref: "web/scripts/owner-review.test.ts#PHASE6_REVIEW_CASES; REVIEW_TARGETS; planShots; renderIndex Phase 6"
        status: pass
      - kind: other
        ref: "npm --prefix web run review (exit 0, 102 pictures, 'The pages reported no errors while the pictures were taken.')"
        status: pass
    human_judgment: false
  - id: D2
    description: "The rulings page lists OQ-1 to OQ-15 with the built option, the other open items, and the owner's rulings D-49 and D-50 with their follow-ups, and marks nothing approved; the words table holds every Company Expenses, Settings and Phase 6 Audit Log sentence with no long dash"
    verification:
      - kind: unit
        ref: "web/scripts/owner-review.test.ts#the Phase 6 rulings page content; phase6Words; renderIndex: the Phase 6 rulings page"
        status: pass
    human_judgment: false
  - id: D3
    description: "The side-by-side marks Company Expenses, Users and My Profile as signed-in pictures"
    verification:
      - kind: unit
        ref: "web/scripts/design-side-by-side.test.ts#photographs the pages that are real screens signed in"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/api/company-expenses.md records the slice pattern Phase 7 copies (D-29)"
    verification:
      - kind: other
        ref: "grep -c D-29 docs/api/company-expenses.md (1)"
        status: pass
    human_judgment: true
    rationale: "Whether the ten steps are what the Phase 7 planner needs is a reading judgment; the files and tests it names were checked to exist."
  - id: D5
    description: "How the Phase 6 screens look and read, and the rulings OQ-1 to OQ-15 (the owner screenshot review, UI-SPEC backstop and 05 D-48)"
    verification: []
    human_judgment: true
    rationale: "The look and the wording are the owner's call, and the owner is away. The item is parked in the STATE.md Owner backlog and nothing is approved for the owner."

duration: 56 min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 19: The owner's Phase 6 review pack and the D-29 slice pattern Summary

**One command now photographs the real Company Expenses, Deleted Expenses, Settings and Audit Log screens (102 pictures, both themes, three widths, Manager and Admin) into a local pack with a rulings page and a table of every new sentence, and the slice pattern Orders copies is written down; the owner's look and wording review is parked, not approved.**

## Performance

- **Duration:** 56 min
- **Started:** 2026-10-26T00:39:14Z
- **Completed:** 2026-10-26T01:36Z
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD), 4 commits
- **Files changed:** 7 (1 created)

## Accomplishments

- **Tracer (Task 1):** `/admin/expenses` is now a signed-in page in the review, and `/admin/expenses/deleted` and `/admin/settings` are added. `planPhase6ReviewShots()` plans 17 cases, each in Blush and Espresso at 390, 820 and 1440 px under `phase6-review/`. The run makes its own people, three categories (one used, one used then retired, one never used), 13 live expenses (an Upcoming one, one by a payer who is then deleted, one in the retired category, one the Admin pays but a Manager recorded, one with notes, and filler for two pages at 10 a page), 3 deleted expenses, and one expense a Manager adds and edits through the API (so the Audit Log holds "Expense added" and "Expense changed" and Last changed by names a person). The cases: E1 as a Manager (the full list, the empty Top category month, the empty list, no matches), E1 as an Admin, E2 Add with "(you)", Edit with Recorded by, the D-26 access note as an Admin, the 409 banner (a second sign-in saves first through the API), View as an Admin, both E3 confirmations, E4 with rows and empty, S1, S2 with the colour preview, and the Audit Log with an "Expense changed" entry opened. The side-by-side marks the real pages as signed in.
- **Rulings and words (Task 2):** `PHASE6_RULINGS` holds OQ-1 to OQ-15 (options, recommended first, the built one marked), A-06-02, research questions 2 and 5 and the snapshot line as open, and A-06-01 and the SQL item as ruled (D-49, D-50) with the follow-up plans, the swap point (`StaffDirectory.cs`, pinned by `StaffLookupEndpointTests`) and the three file names. `PHASE6_LOOK_AT` keeps what the tests could not show (a very large total, a former staff name at full length, 200% zoom, the speed check in CI). `phase6Words()` reads every string of `expensesCopy.ts` and `settingsCopy.ts`, with functions shown through placeholders, and the Phase 6 Audit Log groups, twelve labels, change lines and snapshot line. No long dash anywhere.
- **Docs and backlog:** "The slice pattern Orders copies (D-29)" (ten steps, each with its files and proof) in `docs/api/company-expenses.md`; the Phase 6 paragraphs in `docs/web/owner-review.md`; one line in the STATE.md Owner backlog pointing at the pack.
- **A real fault found and fixed:** `npm run review` could not start at all. Plan 06-15 made `auditCopy.ts` import the app through `@/`, which plain Node cannot resolve, so the script stopped with `Cannot find package '@/components'` (and so did the side-by-side, which imports it). Nothing had run it since. The copy modules are now read through a short-lived Vite server (same alias, no port, no watcher) when a plain import fails.

## Task Commits

1. **Task 1: Tracer, the review script photographs the real Phase 6 screens**
   - `9f9dd3a` (test, RED): targets, `planPhase6ReviewShots`, the section, the side-by-side flag, loading under plain Node
   - `9780ea7` (feat): the Phase 6 section, seed, captures and loader
2. **Task 2: The pack lists only what is still open, every new sentence, and D-29**
   - `17400d2` (test, RED): the rulings and the words
   - `a64c62a` (docs): the rulings, the words table, the docs and the backlog line

**Plan metadata:** the `docs(06-19)` commits that follow this file.

### TDD gate compliance

- **Task 1 RED (`9f9dd3a`):** 14 failures, all for the planned reason. The target list had 8 pages and no signed-in `/admin/expenses` (`expected [ Array(8) ] to deeply equal [ Array(10) ]`), `planShots` gave 45 not 57, `planPhase6ReviewShots is not a function`, and the load test failed with `ERR_MODULE_NOT_FOUND: Cannot find package '@/components' imported from ...auditCopy.ts`. Semantic assessment: each failure is the planned missing target, export or the real start-up fault; none is a syntax or setup error. (My first version of the test file crashed at collection time because two `const` lines mapped over a missing export; I moved them into the tests so each fails alone.)
- **Task 2 RED (`17400d2`):** 12 failures, all `PHASE6_RULINGS`, `PHASE6_LOOK_AT` or `phase6Words` being undefined, which is the planned missing code.
- `gsd_run check tdd-red-evidence` reads JUnit and does not apply to Vitest, so the evidence is the quoted runs with the semantic assessment, as in plans 06-12 to 06-18.
- Tracer gate: the tracer's `<verify>` is automated only, so it was re-run after the commit (the tests, then `npm --prefix web run review`, exit 0) before Task 2 started.

## Verification evidence

- `npx vitest run scripts/owner-review.test.ts scripts/design-side-by-side.test.ts`: `1..132`, no `not ok`.
- `npm --prefix web run review` (three runs, the last on the final code): exit 0, 102 files in `artifacts/owner-review/phase6-review/`, no `FAILED` line, and the page says `The pages reported no errors while the pictures were taken.`
- `npm --prefix web run verify` exited 0: `eslint . --max-warnings 0`, `All matched files use Prettier code style!`, `Test Files  202 passed (202)`, `Tests  5941 passed (5941)`, `Statements   : 95.52%`, `Branches     : 90.38%`, budgets `public JS 123.08 KB (150), admin JS 206.51 KB (250), CSS 14.78 KB (35)`, `THIRD-PARTY-NOTICES.txt is up to date (28 packages).`
- Acceptance: `grep -c planPhase6ReviewShots web/scripts/owner-review.mjs` = 2; `git status --porcelain artifacts` prints nothing; `grep -c D-29 docs/api/company-expenses.md` = 1; `grep -c OQ-15`, `A-06-01` and `StaffDirectory` in `owner-review.mjs` are 2, 3 and 1.
- I looked at six of the pictures and the rulings table: the Manager list (Upcoming, "Dario Lim (former staff)", the retired Abaca category, the total over two pages), the 409 banner at 390 px, the D-26 note, the Audit Log entry opened (`Amount: ₱710.00 to ₱715.00`), Settings with the retired, never-used and Others rows, and the ruled table. Each shows what its label says.
- Shared machine: the preflight ran before the test run and the review (`C:/Work/dev-tools/preflight.ps1`, ports free); the review took the run lock; only `CSPS_E2E` was written; no BetsLLC database, port or process was touched.

## Decisions Made

See key-decisions. None changes a ruling or a sentence the owner settled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm run review` could not start under plain Node**
- **Found during:** Task 1
- **Issue:** `auditCopy.ts` (06-15) imports the app through `@/...`; `owner-review.mjs` loaded it with a plain `import()`, which fails with `ERR_MODULE_NOT_FOUND`. The side-by-side imports the same script.
- **Fix:** `loadCopyModules` tries the plain import (Vitest) and otherwise reads every copy module through a short-lived Vite server with the app's `@` alias; the server is closed before the script goes on. RED test: it starts the script in a child Node process.
- **Files modified:** web/scripts/owner-review.mjs, web/scripts/owner-review.test.ts
- **Verification:** the child-process test, and three full `npm run review` runs
- **Committed in:** 9f9dd3a (RED), 9780ea7 (fix)

**2. [Rule 1 - Bug] A signed-in picture could be taken before its list had arrived**
- **Found during:** Task 1
- **Issue:** `openReviewPage` waited for the h1 only; the new signed-in pages load their rows after the first paint.
- **Fix:** a signed-in page also waits for the network to be idle before the picture.
- **Committed in:** 9780ea7

### Plan wording notes

- The plan's rulings truth says the page lists only what is still open and shows A-06-01 with option 2 built. The owner ruled A-06-01 (D-49) and the inline SQL item (D-50) after the plan was written, as the orchestrator told me, so those two are in a separate table, "ruled by you since the plan was written", with the follow-up plans and the option still built marked. They are not offered as open questions.
- `design-side-by-side.mjs` does not take pictures of our pages itself (it reuses the review's pictures), so "captures /admin/expenses signed in" is done by the review target and the side-by-side now carries and shows the signed-in flag. I did not run the side-by-side: it needs the owner's local design files in `.planning/design`.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), 2 wording notes; 0 checkpoints.
**Impact on plan:** No scope change. The loader fix was needed for the plan's own command to run.

## Issues Encountered

- **Stray shells I started and could not stop.** Two of my commands read standard input and hung: an empty `python -` (python.exe PID 11144) and a `node -` (node.exe PID 17664). Both sit idle at 0 CPU. The permission system refused my attempt to stop the python one, so I did not try again. They are mine, not another project's; please end them (or tell me to). Everything after that used script files instead of piped scripts.
- The month cards on Company Expenses count every expense in `CSPS_E2E`, earlier test runs included (₱65,288,953.99 in the first run), so their figures are not realistic. The pack says so on its Phase 6 intro and in `docs/web/owner-review.md`.
- The second and third `npm run review` runs were needed only to prove the final code (the options list was changed from a numbered list to a plain one after the second run started).

## Left for the owner (parked, nothing approved)

- **The look and wording review (UI-SPEC Visual Review, 05 D-48):** open `artifacts/owner-review/index.html`, section "Company expenses and settings (Phase 6)". The backlog line is in STATE.md. Rule OQ-1 to OQ-15 (the defaults are built), A-06-02, research questions 2 and 5 and the snapshot line, read the words table, and look at the four "Also look at" items.
- **A-06-01 (D-49) and the SQL item (D-50)** are ruled by the owner; plans 06-20 and 06-21 build them. The pack shows them as ruled.
- **A-06-03:** the five-year speed test in CI is still to be read after the first CI run.

## Known Stubs

None. The review's seeded data is made on purpose in the Testing database, and the pack never leaves `artifacts/`.

## Threat Flags

None. No endpoint, auth path or schema was added. T-06-59: `artifacts/` is git-ignored, the script refuses to run otherwise, and `git status --porcelain artifacts` printed nothing. T-06-60: nothing is marked approved (a test fails on the word in the rulings data), and the review item is parked in the Owner backlog. T-06-SC: no package was installed. The pictures use fake names and addresses under `csps.test`; no real customer data.

## User Setup Required

None.

## Next Phase Readiness

- Phase 7 can read "The slice pattern Orders copies (D-29)" in `docs/api/company-expenses.md`.
- Follow-up plans 06-20 (Paid by after a first sign-in) and 06-21 (no inline SQL) are the owner's rulings still to build.
- The owner review of the Phase 6 pack is the one open human gate.

## Self-Check: PASSED

Created and changed files exist on disk (`web/scripts/owner-review.mjs`, `owner-review.test.ts`, `design-side-by-side.mjs`, `design-side-by-side.test.ts`, `docs/web/owner-review.md`, `docs/api/company-expenses.md`, this file); the four task commits (`9f9dd3a`, `9780ea7`, `17400d2`, `a64c62a`) are ancestors of HEAD; `npm --prefix web run verify` and `npm --prefix web run review` exited 0.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*

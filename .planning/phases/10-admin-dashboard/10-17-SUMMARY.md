---
phase: 10-admin-dashboard
plan: 17
subsystem: ui
tags: [react, money, ledger, running-balance, tanstack-query, nuqs, url-state, pagination, vitest, playwright, tdd]
created: "2026-11-07T23:03:00-06:00"
updated: "2026-11-07T23:03:00-06:00"

requires:
  - phase: 10-admin-dashboard
    provides: GET /api/v1/staff-money/me/ledger with LedgerPageResponse, LedgerEntryResponse and the generated types (10-14)
  - phase: 10-admin-dashboard
    provides: moneyService, staffMoneyKey, MoneyPage, MoneyOnHandCard, MONEY_COPY, moneyFixtures, the refresh hooks that invalidate the staff-money root, web/e2e/money.spec.ts (10-13, 10-15)
provides:
  - "LedgerTable({ page, canSeeActions, pending, refetching, failed, error, onRetry, captionId }): the running-balance table (Date, Details, Money in, Money out, Balance) with titles and sub lines per kind, order links, the deleted look and the table states"
  - "LedgerCard({ userId }): head, Manager-only Show deleted, ResultBar, LedgerTable, Pagination, URL-bound page, size and deleted"
  - "useMoneyListParams(): tab, page, size and deleted through createListParams; Manager-only values dropped for an Admin with one replace"
  - "moneyService.ledger(userId, { page, pageSize, deleted }, signal), parseLedgerPage, LedgerPage, LedgerRow, LedgerKind, LedgerContractError"
  - "useLedgerQuery(userId, params) and ledgerKey(userId, params) = ['staff-money', 'ledger', userId, params]"
  - "MONEY_COPY.ledger, the ledger classes in money.recipe.ts, and ledger fixtures plus ledgerBackend in moneyFixtures.ts"
affects: [10-19 Manager tabs and one person's page (reuse LedgerCard and useMoneyListParams), 10-20 row actions (canSeeActions is reserved on LedgerTable), 10-21 dashboard sweep and screenshot review]

actuals:
  tokens: 22075
  tasks: 3
  commits: 5

plan_head_before: c4eea685121f4f809fe453bcd2a3afd13fd95645
plan_head_after: 1bcb6684f17ce2e25478f995a898546663c53ec0

tech-stack:
  added: []
  patterns:
    - "A server-paged card keeps one ResponsiveTable mounted with failed = isError && !isFetching and pending = isFetching && (no data || isError), so Try Again shows the skeleton and the status node says each step"
    - "A query placeholder is kept only for the same person: placeholderData reads the previous key's person, so another person's rows never stand in"
    - "A role rule on URL state sits in a thin wrapper around createListParams: the raw hook is untouched, the wrapper hides the Manager-only values at once and drops them with one replace"
    - "Server figures go through toFiniteFigure once, in parseLedgerPage; an unknown kind or a bad figure refuses the whole page"

key-files:
  created:
    - web/src/modules/admin/components/LedgerTable.tsx
    - web/src/modules/admin/components/LedgerTable.test.tsx
    - web/src/modules/admin/components/LedgerCard.tsx
    - web/src/modules/admin/components/LedgerCard.test.tsx
    - web/src/modules/admin/hooks/useMoneyListParams.ts
    - web/src/modules/admin/hooks/useMoneyListParams.test.tsx
    - web/src/modules/admin/hooks/useLedgerQuery.ts
  modified:
    - web/src/modules/admin/services/moneyService.ts
    - web/src/modules/admin/services/moneyService.test.ts
    - web/src/modules/admin/pages/MoneyPage.tsx
    - web/src/modules/admin/pages/MoneyPage.test.tsx
    - web/src/modules/admin/moneyCopy.ts
    - web/src/modules/admin/components/money.recipe.ts
    - web/src/modules/admin/routes.test.tsx
    - web/src/test/moneyFixtures.ts
    - web/e2e/money.spec.ts

key-decisions:
  - "A kind the browser does not know refuses the whole page (LedgerContractError), as an unknown recipient status is refused in 10-15. The card then shows 'Couldn't load the ledger.' rather than a row with a wrong title"
  - "The ledger card section keeps aria-labelledby on its h2 (the money-card pattern); the table frame inside it is also a region named Ledger (the ResponsiveTable caption). See Issues for review"
  - "Deleted rows follow P10-BL-10 option A: the face amount sits in Money in or Money out, muted and struck, with the word Deleted and 'Not counted' in Balance"
  - "useMoneyListParams hides the Manager-only values for an Admin on the first render and drops them with setFilters, which also resets the page (one replace)"

patterns-established:
  - "A sub line is a list of present parts joined by ' · ': text, a link or an ActorName; a missing part is null and leaves no separator"

requirements-completed: [MONEY-02]

coverage:
  - id: D1
    description: "My Money shows a 'Ledger' card under the balance card ('Newest first. The balance after each entry is shown on the right.') with a table captioned 'Ledger': Date, Details, Money in, Money out, Balance, every figure and every running balance as the server sent it, and no Actions column"
    requirement: MONEY-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/LedgerTable.test.tsx#the rows (D-41)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/MoneyPage.test.tsx#the Ledger card under the balance card (D-41, MONEY-02; plan 10-17)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/services/moneyService.test.ts#parseLedgerPage (MONEY-02, wave 5 IN-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Titles and sub lines for the six kinds, with order numbers as links to the order, 'Handed over by {name}' on a hand-over, ' (former staff)' on deleted people, missing parts left out, the empty side as EmptyValue and a negative balance in the danger tone with the true minus sign"
    requirement: MONEY-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/LedgerTable.test.tsx#Money in, Money out and Balance (D-21, OR-4, MONEY-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Page, rows per page (10, 20, 50, 100) and Show deleted live in the URL: a page change pushes, a size or deleted change replaces and resets the page, a page past the last is replaced by the last, defaults stay out of the URL, bad values fall back with one replace"
    requirement: MONEY-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useMoneyListParams.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/LedgerCard.test.tsx#paging (WEB-10)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A Manager sees 'Show deleted'; ticking it requests deleted=true and words the result bar 'Showing {n} entries, deleted transfers included · newest first'; a deleted transfer shows the Deleted badge, a muted struck amount, 'Deleted by {name} · {Oct 8, 2026, 3:42 PM}' and 'Not counted'. An Admin sees no checkbox, no request ever carries deleted, and a deleted or tab param in an Admin's URL is dropped with one replace"
    requirement: MONEY-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/LedgerCard.test.tsx#Show deleted (D-30, D-31, D-23)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useMoneyListParams.test.tsx#the Manager-only values (D-31, D-42)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Empty state 'No money in or out yet' with no button (also with Show deleted on), skeleton in 'Loading the ledger…', 'Couldn't load the ledger.' with Try Again (also for a bad figure or kind), rows kept and dimmed after 200 ms on a page change, 'Showing 1 entry' in the singular"
    requirement: MONEY-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/LedgerCard.test.tsx#states"
        status: pass
    human_judgment: false
  - id: D6
    description: "Phone card labels (data-label on every cell), the date as the lead, and 200-character notes, descriptions and names wrapping anywhere"
    requirement: MONEY-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/LedgerTable.test.tsx#phones and long text (UI-SPEC M1 phone and long-text rules)"
        status: pass
    human_judgment: false
  - id: D7
    description: "On My Money page 2 with Show deleted on, opening a row's order and pressing Back restores page 2, 10 rows per page and Show deleted, against the real API in all five browsers"
    requirement: MONEY-02
    verification:
      - kind: e2e
        ref: "web/e2e/money.spec.ts#@money the ledger keeps its page, rows per page and Show deleted through an order page and Back (WEB-10) (chromium, firefox, webkit, pixel, iphone)"
        status: pass
    human_judgment: false
  - id: D8
    description: "How the ledger looks on phones (row cards with the date as the title), on tablets (sideways scroll inside the frame) and in Espresso, and whether the Deleted badge, the struck muted amount and 'Not counted' read well; no screenshot review was done here"
    verification: []
    human_judgment: true
    rationale: "jsdom draws no layout. The look of the sub line, the pager under the card and the deleted rows belongs to the plan 10-21 screenshot review"

duration: about 32 min of work after reading (started 2026-11-08T04:30:46Z)
completed: 2026-11-07
status: complete
---

# Phase 10 Plan 17: Staff read their ledger on My Money, page by page, with the balance after each entry

*Created: 2026-11-07T23:03:00-06:00 · Updated: 2026-11-07T23:03:00-06:00*

**My Money now shows a Ledger card under the balance card: the server's rows newest first with their titles, sub lines, Money in, Money out and the running balance after each, paged with the page, rows per page and the Manager-only Show deleted kept in the URL, so Back from an order page returns to the same place.**

## Performance

- **Duration:** about 32 min after reading the context (started 2026-11-08T04:30:46Z, finished about 05:03Z)
- **Tasks:** 3 (Task 1 was a tracer), all TDD
- **Files:** 16 touched by the task commits (7 created, 9 modified); 5 commits before this SUMMARY

## Accomplishments

- **Tracer (Task 1).** `moneyService.ledger` and `parseLedgerPage` (every figure through `toFiniteFigure`, a bad figure or an unknown kind refuses the page), `useLedgerQuery`, `LedgerTable`, `LedgerCard` and the wiring into `MoneyPage`. The table builds each title and sub line from the server's facts for the six kinds, draws the order number as a link to `/admin/orders/{id}`, puts the amount under Money in or Money out and the other side as `EmptyValue`, and shows the server's `balanceAfter` (danger tone below zero). It adds and subtracts nothing. The tracer `<verify>` is automated only, so it was re-run end to end (`Test Files 3 passed (3)`, `Tests 67 passed (67)`) and expansion went ahead: `Tracer verified end-to-end, expanding`.
- **URL state, Show deleted and paging (Task 2).** `useMoneyListParams` (tab, page, size, deleted) over `createListParams`. `LedgerCard` reads it: a Manager sees the "Show deleted" checkbox (a replace that resets the page), an Admin never does and `deleted` is never sent for an Admin (the hook hides the value on the first render and drops it with one replace). Pagination with Rows per page 10, 20, 50, 100; a page past the last is replaced by the last. The result bar reads "Showing {n} entries · newest first", or "..., deleted transfers included · newest first". The e2e Back test passes in all five browsers.
- **Phones and long text (Task 3).** Tests pin `data-label` on every cell, the date as the phone card lead, and the wrap class on 200-character notes, descriptions and names. They passed on first run because Task 1 built the table on `ResponsiveTable` with those rules; a mutation check shows they bite (see TDD Gate Compliance).

## Task Commits

1. **Task 1 (tracer): the ledger rows with the running balance** - RED `8fdd2215` (test), GREEN `9b201b65` (feat)
2. **Task 2: URL state, Show deleted, paging, states, e2e Back** - RED `1420c7c8` (test), GREEN `774bf1e4` (feat)
3. **Task 3: phone card and long text** - `1bcb6684` (test only; no feat commit was needed)

**Plan metadata:** the SUMMARY commit that follows this file. `commits: 5` was measured with `git rev-list --count c4eea685..HEAD` before it.

## TDD Gate Compliance

`gsd_run check tdd-red-evidence` was not run: Vitest's default reporter is not a format that classifier reads (same as plans 10-02 to 10-15), so each RED was inspected by hand. `git log -E --grep` shows `test(10-17)` before `feat(10-17)` for Tasks 1 and 2.

**Cycle 1, Task 1.** RED `8fdd2215`: `Test Files 3 failed (3)`, `Tests 35 failed | 32 passed (67)` over `LedgerTable.test.tsx`, `MoneyPage.test.tsx`, `moneyService.test.ts`. Failures: `Unable to find an accessible element with the role "table" and name "Ledger"` (16 table tests, the table stub draws nothing), no "Ledger" heading on My Money, `expected [] to have a length of 1` and `expected undefined to be '/api/v1/staff-money/me/ledger?page=2&pageSize=20'` (the call stub), and `expected function to throw an error, but it didn't` (9 refusal tests, the parse stub passes everything through). Semantic assessment: the target tests ran and failed on the planned content and behavior. A first version of the parse stub threw, which failed every table test for the wrong reason; it was changed to a pass-through before the commit. Passed at RED on purpose: "offers no edit or delete action" (the stub draws nothing), "keeps every row in the order sent" and "keeps a deleted transfer" (the pass-through stub keeps them). GREEN `9b201b65`: `Test Files 3 passed (3)`, `Tests 67 passed (67)`; with `routes.test.tsx`, `Tests 121 passed (121)`.

**Cycle 2, Task 2.** RED `1420c7c8`: `Test Files 2 failed (2)`, `Tests 11 failed | 25 passed (36)`. Failures: the hook stub keeps `tab: 'staff'` for an Admin (2), `Unable to find ... checkbox "Show deleted"` (4), `expected '1' to be '2'` (page 2 not requested), no "Rows per page" combobox, no replace to `?page=3`, no `Bill 1` row while paging, no Next page button. E2E RED (chromium): `expect(locator).toContainText ... Page 1 of 2 ... element(s) not found` on the Pagination, after "Showing 11 entries · newest first" had passed against the real API. Semantic assessment: real failures on the planned behavior. Passed at RED on purpose (characterization, the Task 1 table already draws these): the deleted-transfer look, the same EmptyState with Show deleted on, no edit action for a Manager, and most hook cases for the Manager and for defaults. GREEN `774bf1e4`: `Tests 20 passed (20)` in `LedgerCard.test.tsx`, 16 in `useMoneyListParams.test.tsx`; e2e chromium `1 passed (19.5s)`.

**Cycle 3, Task 3.** `1bcb6684`: the new tests passed on first run (`Tests 23 passed (23)` in `LedgerTable.test.tsx`), because the table was built on `ResponsiveTable` with `data-label`, the lead date and `wrap-anywhere` in Task 1. To show they bite I changed the code and re-ran: `lead: true` to `lead: false` failed "makes the date the lead of each phone card" (1 failed | 22 passed), and removing `wrap-anywhere` from `ledgerSubClasses` failed both "wraps a long 200-character note anywhere" and "... description anywhere" (2 failed | 21 passed). Both mutations were reverted with `git checkout -- <file>`; the final run is green. No `refactor` commit was needed.

## Files Created/Modified

See the `key-files` block. Every string is in `web/src/modules/admin/moneyCopy.ts` (`MONEY_COPY.ledger`, each new group tagged `// SPEC-GAP`); the looks are in `money.recipe.ts`.

## Decisions Made

- **An unknown kind refuses the page.** The server names six kinds. A seventh would otherwise need a made-up title, and a ledger with a wrong title is worse than an error line. This matches how 10-15 refuses an unknown recipient status.
- **Placeholders never cross people.** `useLedgerQuery` keeps the previous rows while the next page loads only when the previous query was for the same person, so plan 10-19's person switch cannot show someone else's rows.
- **The hook hides first, then drops.** For an Admin, `useMoneyListParams` returns `tab: 'mine'` and `deleted: null` on the first render, so no request ever carries `deleted`, and one `setFilters` replace removes the values from the URL.
- **`canSeeActions` is reserved.** `LedgerTable` accepts it (plan 10-20) and draws nothing for it; no edit action exists (D-22).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Files outside the plan's list**
- **Found during:** Task 1
- **Issue:** The plan lists no file for the ledger looks, and an unanswered request fails a test (`onUnhandledFrame: 'error'`), so every page test that now draws My Money needs a ledger answer.
- **Fix:** Ledger classes went into `money.recipe.ts` (reusing `dashboardCardHeadClasses`, `dashboardCardTitleClasses`, `dashboardCardSubClasses` from `dashboard.recipe.ts`). `routes.test.tsx` got `ledgerBackend()` in the My Money test. `MoneyPage.test.tsx` runs inside `NuqsTestingAdapter` with a session.
- **Committed in:** `9b201b65`, `774bf1e4`

**2. [Test amendment] Existing My Money tests scoped to the balance card**
- **Found during:** Task 1
- **Issue:** The ledger fixture prints `−₱500.00` and `₱300.00`, which the balance card tests looked up by text on the whole page (two matches).
- **Fix:** The negative-balance and Transfer-gate tests look inside the "Money on hand" region; the Try Again test uses a balance of 275.00. No assertion about the balance card was weakened.
- **Committed in:** `9b201b65`

**3. [Plan staging] Behaviors that the Task 1 table already carries**
- **Issue:** Built on `ResponsiveTable`, the Task 1 table already has the deleted look, the phone labels, the lead and the wrap rules, so some Task 2 tests and all of Task 3 passed when written.
- **Fix:** They stay as characterization tests; Task 3 is a test-only commit proved by two mutations (TDD Gate Compliance). No feat commit for Task 3.

**4. [Rule 2 - Missing critical] Pager wrapper only when there is more than one page**
- **Found during:** Task 2
- **Issue:** `Pagination` draws nothing for one page, which would leave an empty bar with a border under the card.
- **Fix:** The wrapper (`ledgerPagerClasses`) renders only when `pageCount > 1`.
- **Committed in:** `774bf1e4`

---

**Total deviations:** 4 (1 blocking, 1 test amendment, 1 plan staging, 1 missing critical).
**Impact on plan:** None changes behavior the plan defined.

## Issues Encountered

- **Shell.** Compound shell commands (heredocs, pipes and `$()` that name git, `python3 -`) were refused in the worktree. The file tools and plain commands were used; `printf '%s\n'` appends worked. Prettier ran as `node node_modules/prettier/bin/prettier.cjs`.
- **node_modules.** Windows junctions to the main checkout's `web/node_modules` and `tools/openapi-gen/node_modules` were made with Node's `fs.symlinkSync(..., 'junction')`, never committed; only the links are removed before returning.
- **Flakes.** None seen in the runs of this plan. `ExpenseListTimingTests` and the third-party-notices web test were not part of it.
- **Pre-existing format warning.** `prettier --check e2e` reports `e2e/auth.ts`; this plan did not touch it.
- **For review, duplicate region name.** The card's `section` is named "Ledger" by its h2 (`aria-labelledby`, the money-card pattern the orchestrator asked to keep) and the table frame inside it is also a region named "Ledger" (the `ResponsiveTable` caption, UI-SPEC "caption Ledger"). axe at the WCAG tags passes. If the owner wants one landmark, drop the `aria-labelledby` on the section (the Recent orders card has none).
- **For review, page reset on drop.** For an Admin whose URL holds a Manager-only value, the drop uses `setFilters`, which also resets the page to 1.
- **Parked items.** P10-BL-04 (what a failed background refresh shows) and P10-BL-05 (WebKit access control checks) were not touched; the e2e guard was not weakened. The KPI layout (P10-BL-06) was not changed.

## Known Stubs

None. The RED stubs (`LedgerTable`, `LedgerCard`, the `ledger` call, `parseLedgerPage`, the unguarded hook) were replaced in GREEN; `grep "RED stub" web/src` finds nothing.

## Owner review: new wording (P10-BL-07)

Every owner-facing sentence is spelled out in the plan or the UI-SPEC except one:

- "Showing 1 entry, deleted transfers included · newest first" is the singular of the UI-SPEC's plural line, built by the same rule as the other result bars. Please confirm the wording.
- A hand-over whose "recorded by" person is missing would read "Handed over by System" (the shared ActorName rule); the server always sends the Manager, so this is a guard only.
- A ledger answer with a bad figure or an unknown kind shows the existing approved line "Couldn't load the ledger." with "Check your internet connection. Your data is safe. Nothing was changed." (the shared ErrorState body). The second line is about connections and does not fit a data fault; this is the shared component's wording.

## Threat Flags

None beyond the plan's threat model.

- T-10-35 mitigated: page and size use the shared allow-list parsers with fallback, `deleted` accepts only the word `true`, a Manager-only value in an Admin's URL is never read and is dropped with one replace, and a test asserts that no request for an Admin carries `deleted`. The server re-checks (403 on `deleted` for an Admin, 400 on bad paging).
- MONEY-02 prohibition holds: no running balance, sign or total is worked out in the browser; `parseLedgerPage` only narrows types, and tests feed balances that do not add up to prove the table shows what it is given. MONEY-03 holds: no Show deleted for an Admin and `deleted` is never sent for one.
- T-10-SC: no package was added or bumped.

## User Setup Required

None - no external service configuration required.

## Verification Results

All from this worktree, final code.

- `npm run typecheck`: exit 0, no output. `npm run lint` (`eslint . --max-warnings 0`): exit 0, no output. `prettier --check` on every file this plan changed: formatted.
- Task 1 verify: `npm run test -- --run src/modules/admin/components/LedgerTable.test.tsx src/modules/admin/pages/MoneyPage.test.tsx src/modules/admin/services/moneyService.test.ts`: `Test Files 3 passed (3)`, `Tests 67 passed (67)` at the tracer; the same files now: 23 + 20 + 29 tests.
- Task 2 verify: `useMoneyListParams.test.tsx` (16), `LedgerCard.test.tsx` (20), `LedgerTable.test.tsx` (23): all passed.
- Task 3 verify: `LedgerTable.test.tsx` `Tests 23 passed (23)`; typecheck and lint above; `src/test/no-long-dash.node.test.ts`, `src/test/source-layout.node.test.ts`, `scripts/tailwind-classes.test.ts`, `money.recipe.node.test.ts`, `src/components/index.test.ts`: `Test Files 5 passed (5)`, `Tests 146 passed (146)`.
- Wider run (`routes.test.tsx`, `DashboardPage.test.tsx`, `MoneyStrip.test.tsx`, `MoneyOnHandCard.test.tsx`, `src/modules/admin/hooks`, `AdminLayout.test.tsx`): `Test Files 32 passed (32)`, `Tests 593 passed (593)`.
- Plan e2e: `npm run e2e -- e2e/money.spec.ts --workers=1 --reporter=line`: `10 passed (1.8m)` (the 10-15 transfer test and the new ledger Back test, in chromium, firefox, webkit, pixel and iphone). The Back test was also run alone in chromium at RED (failed on the Pagination) and at GREEN (`1 passed (19.5s)`). Ports 5180, 5115, 7028 and 5199 had no listener before the runs.
- Coverage of the new files (v8, this plan's test files): `LedgerCard.tsx` and `LedgerTable.tsx` lines 100%, statements 89.7% and 92.7%; `useMoneyListParams.ts`, `useLedgerQuery.ts`, `moneyService.ts` together lines 100%, statements 97.3%, branches 93.3%. Branch and statement figures below 100% are the React Compiler's generated cache checks. The suite-wide gate is the orchestrator's.
- Axe: zero violations in jsdom for the table, the card in its error state, and My Money with the ledger; zero on the page in the e2e after Back.
- gitleaks (`gitleaks git --pre-commit --staged`, run by the pre-commit hook): no leaks found on each of the 5 commits. Fixtures and the e2e use made-up people (Carmen Reyes, Liza Mercado, Paolo Garcia, fresh `Lena Ledger...`).
- Acceptance greps: `Refund handed back` in `moneyCopy.ts` 1, `balanceAfter` in `LedgerTable.tsx` 2, `/ledger` in `moneyService.ts` 3, `createListParams` in `useMoneyListParams.ts` 2, `Not counted` in `moneyCopy.ts` 1; `LedgerCard.test.tsx` has a test whose name contains "Admin" that asserts no request includes `deleted`; `LedgerTable.test.tsx` has tests whose names contain "long" that assert the wrap class. No em or en dash in any file this plan added.
- Not run: the full Vitest and Playwright suites, parity and Lighthouse (the orchestrator's gate). `web/src/types/api.generated.ts` and `tools/openapi-gen/openapi.v1.json` were not touched.

## Next Phase Readiness

Plan 10-19 can render `<LedgerCard userId={id} />` for one person and add the Manager tabs on `useMoneyListParams().tab` (already defined, with the Admin drop). `moneyService.ledger(userId, ...)` already builds `/staff-money/{userId}/ledger`; the server route arrives with 10-16. Plan 10-20 adds the Actions column behind `canSeeActions`. Plan 10-21 owns the screenshot review: the ledger on phones (row cards, date as the title), tablets and in Espresso, the pager under the card, and the deleted rows. It should add `/admin/money` with the ledger drawn to the sweep.

## Self-Check: PASSED

- FOUND: all 7 files in `key-files.created` exist on disk.
- FOUND: commits `8fdd2215`, `9b201b65`, `1420c7c8`, `774bf1e4`, `1bcb6684` on this branch; `git rev-list --count c4eea685..HEAD` = 5 before this SUMMARY commit.
- STATE.md and ROADMAP.md were not modified. `web/src/types/api.generated.ts` and `tools/openapi-gen/openapi.v1.json` were not touched.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-07*

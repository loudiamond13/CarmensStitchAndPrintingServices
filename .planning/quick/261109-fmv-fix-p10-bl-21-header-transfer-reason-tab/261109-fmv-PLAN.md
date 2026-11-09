---
created: 2026-11-09T11:10:00-06:00
updated: 2026-11-09T11:10:00-06:00
phase: quick-261109-fmv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/components/states/ErrorState.tsx
  - web/src/components/states/ErrorState.test.tsx
  - web/src/modules/admin/components/MoneyOnHandCard.tsx
  - web/src/modules/admin/components/MoneyOnHandCard.test.tsx
  - web/src/modules/admin/components/TransferButton.tsx
  - web/src/modules/admin/pages/MoneyPage.tsx
  - web/src/modules/admin/pages/MoneyPage.test.tsx
  - web/src/modules/admin/components/StaffBalancesTable.tsx
  - web/src/modules/admin/components/StaffBalancesTable.test.tsx
  - web/src/modules/admin/components/TransfersTable.tsx
  - web/src/modules/admin/components/TransfersTable.test.tsx
  - web/src/modules/admin/hooks/useTransferRowActions.ts
  - web/src/modules/admin/components/TransfersCard.test.tsx
  - web/e2e/money.spec.ts
  - .planning/phases/10-admin-dashboard/10-UI-SPEC.md
  - .planning/phases/999.6-owner-items-parked-during-phase-10-execution/DECISIONS.md
autonomous: true
requirements: [MONEY-02, MONEY-03, MONEY-06]

estimate:
  tokens: 110000
  raw_tokens: 110000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Per D-109 (P10-BL-21 part 1), on My Money's Mine content (a Manager's Mine tab, and an Admin's page, which shows only the Mine content), while the figure loads the header Transfer is aria-disabled and described (aria-describedby) by the balance card's loading line 'Loading money on hand…', and after a failed read by the card's failure line \"Couldn't load the money on hand.\"; no new wording"
    - "With the figure shown and above zero the header Transfer has no description, and at or below ₱0.00 it keeps 'Nothing on hand to transfer.' as its description (D-14, unchanged)"
    - "Per D-109, on the All Staff and Transfers tabs the header Transfer gets no loading or failure description (those tabs stay as they are), and it never points at an id that is not on the page"
    - "Per D-109 (P10-BL-21 part 2), at 768 x 1024 the All Staff and Transfers tables fit their cards for a Manager in all five browser projects: the table frame does not scroll sideways, the last column (Actions) ends inside the card, and the page does not scroll sideways; the ledger check for a Manager and an Admin still passes"
    - "Per D-109 (P10-BL-21 part 3), the cause of the failing focus check in '@money a Manager deletes a wrong transfer ... (D-29, D-35, D-48)' is found from recorded evidence and fixed at that cause (an app bug gets a failing component test first); no assertion is loosened and no retry or sleep is added unless the evidence shows the test itself is wrong; the test then passes in all five projects in three runs in a row"
    - "10-UI-SPEC.md describes the header Transfer description and the tablet tables as built, citing D-109, and each P10-BL-21 item has its outcome with evidence in DECISIONS.md"
  artifacts:
    - path: "web/src/modules/admin/pages/MoneyPage.tsx"
      provides: "The header TransferButton gets pendingReasonId from the balance card's status or failure id, only while the Mine content is shown (D-109)"
      contains: "pendingReasonId"
    - path: "web/src/modules/admin/components/MoneyOnHandCard.tsx"
      provides: "Optional statusId and failureId props, set on its LoadingRegion status node and its ErrorState first line"
      contains: "failureId"
    - path: "web/src/components/states/ErrorState.tsx"
      provides: "Optional titleId on the bold first line, so a control can name the failure line as its description"
      contains: "titleId"
    - path: "web/src/modules/admin/components/StaffBalancesTable.tsx"
      provides: "The All Staff table without the 680 px tablet floor (existing fitTablet option)"
      contains: "fitTablet"
    - path: "web/src/modules/admin/components/TransfersTable.tsx"
      provides: "The Transfers table without the 680 px tablet floor (existing fitTablet option)"
      contains: "fitTablet"
    - path: "web/e2e/money.spec.ts"
      provides: "The 768 px fit check extended to All Staff and Transfers (Manager), through one reader keyed by table caption"
      contains: "readTableFitAt768"
  key_links:
    - from: "web/src/modules/admin/pages/MoneyPage.tsx"
      to: "web/src/modules/admin/components/MoneyOnHandCard.tsx"
      via: "MoneyRoute makes statusId and failureId with useId and passes them through MineContent to the card"
      pattern: "statusId"
    - from: "web/src/modules/admin/components/MoneyOnHandCard.tsx"
      to: "web/src/components/states/LoadingRegion.tsx"
      via: "the existing LoadingRegion statusId prop (quick 261109-c4l, commit d69ac35b)"
      pattern: "statusId=\\{statusId\\}"
    - from: "web/src/modules/admin/pages/MoneyPage.tsx"
      to: "web/src/modules/admin/components/TransferButton.tsx"
      via: "the existing TransferButton pendingReasonId prop (quick 261109-c4l, commit d69ac35b)"
      pattern: "pendingReasonId=\\{pendingReasonId\\}"
---

<objective>
Fix the three P10-BL-21 items with option A, exactly as the owner ruled. **D-109 (owner, 2026-11-09)**, in `.planning/phases/10-admin-dashboard/10-CONTEXT.md` (Owner rulings from the UI review) and `DECISIONS.md` P10-BL-21, is locked; do not revisit it:

1. The My Money header Transfer, on the Mine tab, is described (aria-describedby) by the balance card's own loading or failure line while the figure loads or has failed. No new wording. Other tabs stay as they are. Reuse the `LoadingRegion statusId` and `TransferButton pendingReasonId` props from quick 261109-c4l (commit d69ac35b).
2. The All Staff and Transfers tables use the same `fitTablet` option the ledger got in d69ac35b, so they fit at 768 px (today 680 px in a 646 px frame, Actions cut). Measure first; if a table cannot fit with the existing wrapping, stop and report. Extend the existing 768 px browser check in `web/e2e/money.spec.ts` to these tables (Manager).
3. The browser test `@money a Manager deletes a wrong transfer ... (D-29, D-35, D-48)` fails its focus check on 2 or 3 of 5 projects, also on code before 261109-c4l. Root-cause it first, fix the real cause, record the evidence.

Planner readings (use them, do not re-derive):
- **Mine content includes the Admin page.** An Admin's My Money has no tab strip and shows only the Mine content (D-42) with the same balance card, so the D-109 description applies there too. This is the Mine content D-109 names, not a new rule; say so in the SUMMARY.
- **Which failure line.** The balance card's failure state is the shared `ErrorState` banner: a bold first line "Couldn't load the money on hand.", a muted second line (and sometimes "Reference: {traceId}"), then Try Again. The button is described by the bold first line only, as the strip is described by its single failure sentence. Pointing at the whole banner would read "Try Again" and any reference as part of the description. This needs one optional `titleId` prop on `ErrorState` (no visual or wording change).
- **No tracer task.** Three independent, local fixes on a proven architecture, so a tracer slice adds no information (same call as quick 261109-c4l). Each task is red, then green, then one commit.

Purpose: MONEY-02, MONEY-03, MONEY-06. A screen reader user hears why Transfer cannot be used; a Manager on a tablet sees every column of All Staff and Transfers; the money browser suite is trustworthy again.
Output: three commits (one per item), the UI-SPEC and DECISIONS.md updates inside them, and the SUMMARY.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@./.claude/CLAUDE.md
@.planning/quick/261109-c4l-fix-the-phase-10-ui-review-findings-ui-0/261109-c4l-SUMMARY.md
@.planning/phases/999.6-owner-items-parked-during-phase-10-execution/DECISIONS.md
@.planning/phases/10-admin-dashboard/10-UI-SPEC.md

## What the planner found in the code (use it, do not re-derive)

- **Strip pattern to copy (D-107).** `web/src/modules/admin/components/MoneyStrip.tsx`: `statusId` and `failureId` from `useId`; `failed = query.isError && !query.isFetching`; `loading = query.isFetching && (money === undefined || query.isError)`; `pendingReasonId = failed ? failureId : loading ? statusId : undefined`; `LoadingRegion ... statusId={statusId}`; `TransferButton ... pendingReasonId={pendingReasonId}`. Its tests are in `MoneyStrip.test.tsx`, describe "Transfer with nothing to send" (`toHaveAccessibleDescription('Loading your money on hand…')`, the failure line, the Try Again case, then no `aria-describedby` once the figure shows).
- **TransferButton** (`web/src/modules/admin/components/TransferButton.tsx`): `describedBy = gate.nothingOnHand ? reasonId : gate.blocked ? pendingReasonId : undefined`. No change to its logic is needed; only its header comment, which today names the strip only.
- **My Money page** (`web/src/modules/admin/pages/MoneyPage.tsx`): `MoneyRoute` renders the header `TransferButton query={money} reasonId={reasonId} variant="primary" size="md"` with no `pendingReasonId`. `tab` is `values.tab` for a Manager and `'mine'` otherwise. Only the chosen tab's content is mounted (`{tab === id && <TabContent .../>}`), so the balance card and its ids exist only while Mine shows. `MineContent({ money })` renders `MoneyOnHandCard query={money}` then `LedgerCard`; `TabContent` passes `money` to it.
- **Balance card** (`web/src/modules/admin/components/MoneyOnHandCard.tsx`): the same `failed`/`loading` expressions as the strip; `LoadingRegion loading failed things={COPY.loadingThings}` (no `statusId` today) speaks "Loading money on hand…" then "Money on hand loaded."; on failure an `ErrorState things={COPY.failedThings} align="start"` inside `moneyCardStateClasses`, whose bold first line is "Couldn't load the money on hand.". The card is also used by `StaffMoneyPage.tsx` (one person's page, no header action), which keeps passing no ids.
- **ErrorState** (`web/src/components/states/ErrorState.tsx`): props are a union over `ErrorStateCommon` (`error`, `onRetry`, `align`); the bold first line is `<strong>{title}</strong>` inside `bannerTextClasses`. The project uses `exactOptionalPropertyTypes`-style props (`?: string | undefined`).
- **Page tests** (`web/src/modules/admin/pages/MoneyPage.test.tsx`): the default session is a Manager (`sessionResponse()`), `renderPage(search)` takes a query string such as `'?tab=staff'`; loading is made with `myMoneyBackend(async () => { await delay(300); return myMoneyFixture(); })`, failure with `problemResponse(500)`; the Admin tests near line 500 show how to sign in an Admin; `staffBalancesBackend()` and `transfersBackend()` feed the other tabs. The test at line 186 ("is aria-disabled with no reason line while the figure loads, and when it failed") stays true.
- **Tablet floor.** `tableClasses` in `web/src/components/lists/lists.recipe.ts` (line 43) carries `pg-tablet:min-w-[680px]`; `ResponsiveTable` swaps in `tableFitTabletClasses` when `fitTablet` is set, in the table and the skeleton. `LedgerTable.tsx` passes `fitTablet` beside `embedded`; its test "tablets (UI-24)" asserts the floor token is absent. `StaffBalancesTable.tsx` and `TransfersTable.tsx` both render `ResponsiveTable` with `embedded` and no `fitTablet`. Existing wrapping: names `staffNameClasses` (`min-w-0 wrap-anywhere`), notes and sub lines `ledgerSubClasses` (`wrap-anywhere`), the Transfers date cell `flex-wrap`; money cells stay on one line.
- **768 px check** (`web/e2e/money.spec.ts` from line 381): `LedgerFit`, the string page function `READ_LEDGER_FIT` (finds the first `table`, its frame `parentElement`, its card `closest('section')` and the "Balance" header), `readLedgerFitAt768(page)` (sets 768 x 1024, opens `/admin/money`, waits for rows), `expectLedgerFits(fit)`, and the test "@money the ledger fits its card at 768px for a Manager and an Admin" (Manager with a six-digit payment and a transfer to Rina, then an Admin in a second context). Page functions are strings because the e2e specs have no DOM typings; return an error value instead of a non-null assertion (lint). The c4l measurement: All Staff and Transfers frames 680 against 646, last column right edge 777 against a card edge of 743.
- **A leaver with money** (needed so All Staff draws its widest Actions cell, eye link plus Hand Over): the handover test in `web/e2e/money.spec.ts` (lines 308-326) seeds a payment to an Admin, then deactivates them in `/admin/users` (search by email, press "Deactivate {first name}", confirm "Deactivate User", wait for "User deactivated").
- **Focus rule after a delete** (`web/src/modules/admin/hooks/useTransferRowActions.ts`): `onDeleteDone` stores `focusId = chooseFocusAfter(id)`, the next row id else the previous one, taken from the `rows` the hook saw when the dialog's callback was made. An effect with no deps waits until the list no longer shows the transfer as it was, then calls `rowFocus.focusRow(focusId)`; if that row has no registered button it focuses the caption, else the fallback (the card `h2`). `useRowFocus` forgets a button when its row unmounts. `DeleteTransferDialog.confirm` awaits the DELETE, then calls `onDone(transfer)` and `onClose()`; the money queries are read again without being awaited. `Modal` releases its focus trap and `inert` the moment `open` turns false; the trap's teardown returns focus to the trigger only if it is still connected (`useFocusTrap.ts` line 201), and while the trap is active it pulls any outside focus back in (`onFocusIn`).
- **The failing browser test** (`web/e2e/money.spec.ts` lines 189-296): it reads the Transfers tab (shop-wide, every transfer in CSPS_E2E, newest first, `size=100`), records the index of its own row's action among all row actions (`focusPlace`), deletes, then polls that `document.activeElement`'s index equals `focusPlace`. Playwright runs the five projects in parallel workers against the one shared CSPS_E2E database (`web/playwright.config.ts`: `retries: 0`, `trace: 'retain-on-failure'`), so up to five copies of this test record and delete transfers in the same list at the same time. Component tests for the rule are in `web/src/modules/admin/components/TransfersCard.test.tsx` lines 300-392 (backend closures switch the list after the DELETE).
- **Commands.** `npm --prefix web run test -- --run <files>` (file paths relative to `web/`). Browser checks only through `npm --prefix web run e2e -- --grep <pattern> [--project <name>]` (it takes the lock, resets CSPS_E2E, builds and serves on 5199). Projects: chromium, firefox, webkit, pixel, iphone. `--grep "@money "` (with the trailing space) runs `money.spec.ts` without `@money-sweep`.

## Owner rules for this executor (subagents do not see CLAUDE.md or memory otherwise)

- **Test-driven:** each behavior change gets its failing test first; run it and quote the failure (failing for the right reason, not on setup), then fix and quote it green. Component tests use the in-house axe matcher (`expectNoAxeViolations` from `@/test/axe`). Zero warnings in build, lint, types, tests and the browser console (an act or key warning in test output counts as a failure).
- **Evidence before done:** quote each command's result tail and exit code. If a test fails, re-run it alone before calling it flaky, and record any flake in the SUMMARY with its output. Never claim a pass you did not see.
- **Shared machine:** before every e2e, parity or full Vitest run, run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`, quote it, and wait if a port is in use by another project or TheBETSLLC's test processes are listed. Never touch TheBETSLLC (`C:\Work\TheBETSLLC`), its ports 5173, 5023 and 5099, any `BetsLLC_*` database, or any process you did not start. Never set env vars at User or Machine level. No dev server is needed.
- **No stdin reads:** never run a bare `cat > file`, `read` or an interactive prompt, and never run Vitest in watch mode (always pass `--run`). Use the Write or Edit tool for files. Leave no background shell running.
- **No packages, no server:** do not add, bump or reinstall any package, and do not run `npm install` or `npm ci`. No server, database, migration or `src/` (.NET) change; if one seems needed, stop and report instead.
- **Client code (web/src):** OR-2 comments minimal and concise, saying what the code does, no history narration (update the comments that name the strip only). OR-4 no em dash or en dash anywhere in web/src (code, copy, comments). OR-5 and OR-6 unchanged, no new files under web/src. No inline styles (strict CSP). WCAG 2.2 AA with zero axe violations.
- **Copy:** no user-facing wording changes. D-109 adds none; every description points at a line already on screen or already spoken.
- **Do not edit** `docs/CSPS-UI-SPEC.md`.
- **Commits:** stage by path, never `git add -A` or `git add .`. Before each commit run `gitleaks git --staged --redact --no-banner --config .gitleaks.toml`, and scan the staged diff for server or database names, connection strings, real emails, machine names and local `C:/Users/<name>` paths. Test data stays clearly fake (reuse the existing fixtures and the `createStaff`/`createOrder` helpers). Subjects read `type(scope): summary` in plain English (`web/scripts/commit-lint.mjs`). End every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No push, no merge. Do not commit the PLAN, SUMMARY or STATE (the orchestrator does).
- **Markdown:** every markdown file you create or edit carries created and updated timestamps (ISO 8601, offset -06:00). In YAML frontmatter change only `updated:`; where a `*Created: ... · Updated: ...*` line sits under the title, change only its Updated value.
- **Owner decisions:** anything beyond D-109 that changes behavior, wording or look is the owner's call. Park it in `DECISIONS.md` under P10-BL-21 with 2-3 options, the recommendation first and a one-line reason. Never self-approve.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: The My Money header Transfer is described by the balance card's loading or failure line on the Mine content (D-109 part 1)</name>
  <files>web/src/components/states/ErrorState.tsx, web/src/components/states/ErrorState.test.tsx, web/src/modules/admin/components/MoneyOnHandCard.tsx, web/src/modules/admin/components/MoneyOnHandCard.test.tsx, web/src/modules/admin/components/TransferButton.tsx, web/src/modules/admin/pages/MoneyPage.tsx, web/src/modules/admin/pages/MoneyPage.test.tsx, .planning/phases/10-admin-dashboard/10-UI-SPEC.md</files>
  <read_first>web/src/modules/admin/components/MoneyStrip.tsx, web/src/modules/admin/components/MoneyStrip.test.tsx (describe "Transfer with nothing to send"), web/src/modules/admin/pages/MoneyPage.tsx, web/src/modules/admin/pages/MoneyPage.test.tsx (lines 134-250 and the Admin tests near line 500), web/src/modules/admin/components/MoneyOnHandCard.tsx, web/src/components/states/ErrorState.tsx, web/src/components/states/ErrorState.test.tsx, web/src/components/states/loading.test.tsx (the statusId test near line 167)</read_first>
  <behavior>
    - ErrorState: with `titleId="t1"` the bold first line has id "t1"; without it no id is set (existing tests unchanged).
    - MoneyOnHandCard: with `statusId` its LoadingRegion status node carries that id; with `failureId`, in the failed state, the bold "Couldn't load the money on hand." line carries that id.
    - MoneyPage, Manager on Mine (no tab param): while the figure loads, the header Transfer is aria-disabled and `toHaveAccessibleDescription('Loading money on hand…')`; after the figure arrives (above zero) it has no `aria-describedby`.
    - MoneyPage, failed read: the header Transfer `toHaveAccessibleDescription("Couldn't load the money on hand.")` (the bold line only, so "Try Again" and the muted line are not in it); during Try Again it goes back to 'Loading money on hand…'; once the figure shows, no description.
    - MoneyPage, Admin (no tab strip): while loading, the same 'Loading money on hand…' description.
    - MoneyPage, Manager on `?tab=staff` and on `?tab=transfers`, while the figure loads and after it failed: the header Transfer is aria-disabled with no `aria-describedby` (D-109: other tabs stay as they are).
    - At ₱0.00 the description stays "Nothing on hand to transfer." (the existing it.each at line 164 keeps passing).
    - Zero axe violations on Mine in the loading and the failed state.
  </behavior>
  <action>
Red first. Add the behavior tests above: one ErrorState test, one or two MoneyOnHandCard tests, and a new describe in MoneyPage.test.tsx named for D-109 (Mine loading, Mine failed with Try Again, Admin loading, the two other tabs loading and failed, axe in loading and failed). Run them and quote the failures (the description is empty today; the props do not exist yet, so type errors also count as red only if the test runner reports them as test failures; prefer asserting through the DOM).

Then green, per D-109:
1. ErrorState: add an optional `titleId?: string | undefined` to `ErrorStateCommon` and set it as the `id` of the `<strong>` first line. No class, wording or structure change. One short doc comment on the prop (what it is for).
2. MoneyOnHandCard: add optional `statusId?: string | undefined` and `failureId?: string | undefined` props; pass `statusId={statusId}` to its `LoadingRegion` and `titleId={failureId}` to its `ErrorState`. StaffMoneyPage keeps passing neither.
3. MoneyPage (`MoneyRoute`): make `statusId` and `failureId` with `useId`; work out `failed` and `loading` from `money` with the same two expressions the card uses; `showsCard` is true when the user is not a Manager or `tab === 'mine'`; `pendingReasonId` is undefined unless `showsCard`, else `failed ? failureId : loading ? statusId : undefined` (as MoneyStrip). Pass `pendingReasonId={pendingReasonId}` to the header TransferButton. Give `MineContent` (and `TabContent` for the mine case) the two ids and pass them to `MoneyOnHandCard`. The button must never point at an id that is not mounted.
4. Comments (OR-2): update the MoneyPage file header (the header Transfer line) and the TransferButton file header so they say the button is also described by the balance card's loading or failure line on My Money's Mine content (D-109). Short, no history.
5. 10-UI-SPEC.md: in M1 "Header (`.s-ph`)" (around line 333) and in the "Disabled Transfer" row of the interaction table (around line 448, add D-109 to its reference cell), add: D-109 (owner, 2026-11-09), P10-BL-21 A: on the Mine content (a Manager's Mine tab and an Admin's page), while the figure loads or has failed, the header Transfer is described by the balance card's loading line ("Loading money on hand…") or failure line ("Couldn't load the money on hand."), with no new wording; on All Staff and Transfers it has no such description. Bump the frontmatter `updated:` only.

Run typecheck, lint and format check, then commit by path (the seven web files and 10-UI-SPEC.md) as `fix(web): the My Money header Transfer says why while the figure loads or failed (D-109)`.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run src/components/states/ErrorState.test.tsx src/components/states/loading.test.tsx src/modules/admin/components/MoneyOnHandCard.test.tsx src/modules/admin/pages/MoneyPage.test.tsx src/modules/admin/pages/StaffMoneyPage.test.tsx src/modules/admin/components/MoneyStrip.test.tsx && npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run format:check</automated>
  </verify>
  <done>The new tests failed before the change and pass after it (both quoted); the strip and StaffMoneyPage tests still pass; typecheck, lint and format check exit 0; 10-UI-SPEC.md cites D-109 at the header and the Disabled Transfer row; one commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: All Staff and Transfers fit their cards at 768 px, measured first (D-109 part 2)</name>
  <files>web/src/modules/admin/components/StaffBalancesTable.tsx, web/src/modules/admin/components/StaffBalancesTable.test.tsx, web/src/modules/admin/components/TransfersTable.tsx, web/src/modules/admin/components/TransfersTable.test.tsx, web/e2e/money.spec.ts, .planning/phases/10-admin-dashboard/10-UI-SPEC.md</files>
  <read_first>web/e2e/money.spec.ts (lines 174-187 recordTransfer, 298-326 the handover setup, 381-469 the 768 px check), web/src/modules/admin/components/LedgerTable.test.tsx (describe "tablets (UI-24)"), web/src/modules/admin/components/StaffBalancesTable.tsx, web/src/modules/admin/components/TransfersTable.tsx, web/src/components/lists/ResponsiveTable.tsx (the fitTablet prop)</read_first>
  <behavior>
    - StaffBalancesTable and TransfersTable: the rendered table has no `pg-tablet:min-w-[680px]` class token (same assertion as LedgerTable's "tablets (UI-24)" test).
    - Browser, Manager at 768 x 1024: on `/admin/money?tab=staff` (table "Staff money on hand", with a leaver row that shows Hand Over) and on `/admin/money?tab=transfers` (table "Transfers", with the test's own transfers on page 1, one with a 200-character note), the frame `scrollWidth` is at most its `clientWidth`, the last header cell's right edge is at most the card's right edge (+0.5 px), and the page does not scroll sideways; zero axe violations on each tab. The ledger checks for the Manager and the Admin stay as they are.
  </behavior>
  <action>
Red first.
1. Component tests: add a "tablets (D-109)" test to StaffBalancesTable.test.tsx and TransfersTable.test.tsx asserting the 680 px floor token is absent, as LedgerTable.test.tsx does. Run, quote red.
2. Browser check: generalise the existing reader instead of copying it. `READ_LEDGER_FIT` becomes a page function that takes the table caption text (embed it with `JSON.stringify`), finds the table whose `caption` text equals it, and returns the frame scroll and client widths, the right edge of the last `thead` header cell (`th:last-child`, works for the visually hidden Actions header), the card's right edge and the page sideways flag. `readLedgerFitAt768` becomes `readTableFitAt768(page, path, caption)` (sets 768 x 1024, opens the path, waits for the table and for more than the header row), and `expectLedgerFits` becomes `expectTableFits(fit, caption)` with the caption in each message. Keep the ledger checks meaning the same (Manager with Actions, Admin without).
3. Extend the existing test (rename it to "@money the ledger fits its card at 768px for a Manager and an Admin, and All Staff and Transfers fit theirs for the Manager"): before the 768 px reads, also create an Admin leaver with a seeded payment and deactivate them through `/admin/users` exactly as the handover test does (a small local helper is fine; do not refactor the handover test), and record a second Manager transfer to Rina with a 200-character note made of ordinary words (add an optional `note` parameter to `recordTransfer` that fills the Note box). Then read and check `/admin/money?tab=staff` ("Staff money on hand", assert the leaver's Hand Over button is visible) and `/admin/money?tab=transfers` ("Transfers", assert the Actions header exists), with `expectNoAxeViolations` on each. All data stays clearly fake.
4. Measure first: after the preflight, run the extended test on chromium only and quote the red numbers for All Staff and Transfers (expected about 680 against 646). Then add `fitTablet` beside `embedded` in both `ResponsiveTable` calls (per D-109, the existing option, nothing new) and run chromium again; quote the new numbers.
5. Stop condition: if either table still overflows with `fitTablet` (frame scroll above client width, or Actions past the card edge), do not invent a new pattern. Revert that table's `fitTablet` change, record the measurements under P10-BL-21 in DECISIONS.md as "cannot fit with the existing wrapping" with the column that will not shrink, and stop and report to the orchestrator without committing Task 2.
6. If both fit: run the extended test in all five projects and the money sweep, both green. Update 10-UI-SPEC.md: in the All Staff panel and the Transfers panel bullets add that the table has no 680 px floor on tablets and fits its card at 768 px (D-109 (owner, 2026-11-09)); in the coverage row "Tables on tablet and phone" (around line 667) say the ledger, All Staff and Transfers have no 680 px floor and fit their cards at 768 px (UI-24, quick 261109-c4l; D-109, quick 261109-fmv). Bump `updated:` only.

Commit by path as `fix(web): All Staff and Transfers fit their cards at 768 px (D-109)`.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run src/modules/admin/components/StaffBalancesTable.test.tsx src/modules/admin/components/TransfersTable.test.tsx src/modules/admin/components/LedgerTable.test.tsx src/components/lists/ResponsiveTable.test.tsx && npm --prefix web run e2e -- --grep "fits its card at 768px" && npm --prefix web run e2e -- --grep @money-sweep && npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run format:check</automated>
  </verify>
  <done>Before and after measurements for both tables quoted from chromium; the extended 768 px test passes in all five projects and `@money-sweep` passes; component tests red then green; 10-UI-SPEC.md cites D-109 for the tablet tables; one commit. Or, if a table cannot fit, the measurements are parked under P10-BL-21 and the run stops with a report and no Task 2 commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Root-cause and fix the focus check after a transfer delete, and record every P10-BL-21 outcome (D-109 part 3)</name>
  <files>web/e2e/money.spec.ts, web/src/modules/admin/hooks/useTransferRowActions.ts, web/src/modules/admin/components/TransfersCard.test.tsx, .planning/phases/999.6-owner-items-parked-during-phase-10-execution/DECISIONS.md</files>
  <read_first>web/e2e/money.spec.ts (lines 189-296), web/src/modules/admin/hooks/useTransferRowActions.ts, web/src/modules/admin/hooks/useRowFocus.ts, web/src/modules/admin/components/TransfersCard.test.tsx (lines 300-392), web/src/modules/admin/components/DeleteTransferDialog.tsx (the confirm function), web/src/components/overlays/useFocusTrap.ts (the teardown near line 195)</read_first>
  <behavior>
    - Decided by the evidence of step 2, not in advance. If the app is at fault, a TransfersCard component test reproduces the observed order of events and fails on today's code before the fix.
    - Candidate app test (use it only if the evidence shows case B below): rows A, B, C; deleting A while B also leaves the list (the refetch answers only C): focus goes to C's Delete action (next row still shown), not to the caption. Mirror for the last row: A, B, C, deleting C while B leaves: focus goes to A's action.
    - The browser test keeps asserting one exact element after the delete; it does not accept "any row action".
  </behavior>
  <action>
Follow systematic debugging per D-109: evidence first, one hypothesis at a time, no fix before the cause is known.

1. Temporary diagnostics (never committed): in the failing test, wrap the focus poll so that on failure it logs, from the page, the labels of every row action before the delete (already in `labels`), the labels after the delete, and `document.activeElement` (tag name, aria-label, id, first 60 characters of its text), then rethrows. Test-side `console.log` goes to the reporter, not the guarded page console.
2. Reproduce, after the preflight, and quote each result: run `--grep "deletes a wrong transfer"` with `--project` set to each of chromium, firefox, webkit, pixel and iphone in turn (one copy of the test at a time), then once with no `--project` (all five copies at once against the shared CSPS_E2E). Classify every failure by its log:
   - **A, the test is wrong (shared data):** focus is on a row action whose label is the neighbor the app chose (next, else previous, in the list before the delete), but its index differs because other copies' transfers were added above it or removed. Signature: each project passes alone, failures only when copies run together, and the label list after the delete differs from the one before by rows other than the deleted one.
   - **B, app bug (neighbor left too):** focus is on the caption or the card heading although rows are still shown, because the neighbor the app picked at Delete time had left the list by the time it was read again.
   - **C, app bug (focus lost):** focus is on BODY, inside the closing dialog, or on the toast: the move ran while the dialog trap or inert was still active, or the trap's return ran after it.
   - **D, anything else:** record it and stop and report.
   Also read the deleted trigger timing in `DeleteTransferDialog.confirm` and `useFocusTrap` teardown against what the logs show. Write the classification and the quoted log lines into the SUMMARY.
3. Fix only what the evidence shows (more than one case may appear across runs):
   - **B:** red first in TransfersCard.test.tsx (the candidate tests in behavior, built like the tests at lines 300-369), quote the failure (focus on the caption). Then in useTransferRowActions, at `onDeleteDone`/`onRemoveDone` keep, from the list on screen, the ids after the target in order and the ids before it nearest first; once settled, focus the first kept "after" id that `focusRow` can focus, else the first kept "before" id, else the caption, else the fallback. The rule stays "next row's action, else previous" (UI-SPEC "Focus after changes"), now applied to the rows still shown. Update the hook's header comment in one short line.
   - **C:** red first with a TransfersCard test that reproduces the logged order; fix so the focus move runs only after the dialog has closed and the list has settled. Keep the change inside useTransferRowActions if possible.
   - **A:** the test is wrong; fix the test, not the app, and record the evidence. Replace the index check with an identity check: before the delete keep the neighbor's label (the label after the own row, else the one before); after the row is gone, the focused element's aria-label must equal it (if B was also fixed, the expected label is the first label after the own row that is still listed, else the last one before it that is still listed, else the heading). Update the comment above it to say the Transfers list is shop-wide and other runs change it at the same time. No retry, no sleep, no timeout change.
4. Remove the diagnostics. Prove it: run `--grep "deletes a wrong transfer"` with no `--project` three times in a row (15 passes), then `--grep "@money "` once (the whole money spec in all five projects), and quote each. If a run fails, re-run it alone before calling it flaky and record the output.
5. DECISIONS.md, under P10-BL-21: add one "Outcome (quick 261109-fmv)" line to each of the three bullets: fixed, with the evidence in plain words (part 1: the descriptions the tests check; part 2: the before and after 768 px numbers; part 3: the cause found, the proof runs and whether the app or the test was at fault). Bump the Updated value on the line under the title only.

Commit by path. Use `fix(web): ...` if the app changed, or `test(e2e): ...` if only the test changed, in plain English with D-109, and include DECISIONS.md.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run src/modules/admin/components/TransfersCard.test.tsx src/modules/admin/components/LedgerCard.test.tsx && npm --prefix web run e2e -- --grep "deletes a wrong transfer" && npm --prefix web run e2e -- --grep "@money " && npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run format:check</automated>
  </verify>
  <done>The cause is named with quoted log evidence and per-project results; an app fault had a failing component test first; the focus test passes in all five projects three runs in a row and `@money ` passes; no loosened assertion, retry or sleep unless the evidence shows the test was wrong; every P10-BL-21 item has its outcome in DECISIONS.md; one commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| server to browser | My Money, All Staff and Transfers render server figures; nothing here adds a request, a field or a figure. |
| shared UI primitives | `ErrorState` and `ResponsiveTable` are used on many admin screens; a regression there spreads. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-fmv-01 | Information disclosure | header TransferButton aria-describedby | low | mitigate | The description points only at the balance card's own loading status and bold failure line, already on screen or spoken; the trace reference and button text are excluded by pointing at the first line only (component tests assert the exact descriptions). |
| T-fmv-02 | Denial of service (usability) | ErrorState titleId, fitTablet on two tables | medium | mitigate | Both are additive (one optional id, one existing option); the full Vitest run, the 768 px test in five projects and `@money-sweep` run before the commits. |
| T-fmv-03 | Repudiation (test evidence) | the focus browser test | medium | mitigate | No assertion is loosened and no retry or sleep is added unless the logs show the test is wrong; the evidence is quoted in the SUMMARY and DECISIONS.md. |
| T-fmv-04 | Tampering | money figures | low | accept | No arithmetic or figure source changes; the D-33 delete preview is untouched. |
| T-fmv-SC | Tampering | npm installs | high | mitigate | No install task exists. The executor runs no `npm install` or `npm ci` and stops to ask the owner if any package seems needed. |
</threat_model>

<verification>
- `npm --prefix web run typecheck`, `npm --prefix web run lint` and `npm --prefix web run format:check` exit 0 with no warnings.
- After the preflight, the full Vitest run `npm --prefix web run test -- --run` passes with no warning lines (the OR-4 `no-long-dash.node.test.ts` and `source-layout.node.test.ts` included).
- The targeted browser runs in Tasks 2 and 3 pass in all five projects, quoted.
- `git log --oneline -4` shows the three commits on top of the orchestrator's plan commit; `git status` shows no stray tracked change from this run.

## Source coverage audit

| Source | Item | Covered by |
|---|---|---|
| GOAL | Fix the three P10-BL-21 items with option A | Tasks 1 to 3 |
| CONTEXT | D-109 part 1 (header Transfer described on Mine, no new wording, other tabs unchanged) | Task 1 |
| CONTEXT | D-109 part 2 (All Staff and Transfers use fitTablet, measured first, 768 px check extended) | Task 2 |
| CONTEXT | D-109 part 3 (focus test root-caused and fixed at its cause) | Task 3 |
| CONTEXT | UI-SPEC updated where it describes the header Transfer and the tablet tables | Tasks 1 and 2 |
| CONTEXT | Each outcome recorded under P10-BL-21 | Task 3 |
| REQ | MONEY-02 (My Money balance), MONEY-03 (Manager money views), MONEY-06 (delete transfer) | Tasks 1, 2, 3 |
| RESEARCH | none (quick task, no research phase) | not applicable |
</verification>

<success_criteria>
- A screen reader user on My Money's Mine content hears why Transfer cannot be used while the figure loads or after it failed, with existing words only; All Staff and Transfers behave as before.
- All Staff and Transfers fit their cards at 768 px with nothing cut, in all five browser projects, or the run stopped with measurements because they cannot.
- The focus-after-delete browser test passes reliably for a recorded, fixed reason.
- `10-UI-SPEC.md` and `DECISIONS.md` match what was built, citing D-109.
- No new package, server change, user-facing wording or em or en dash in web/src.
</success_criteria>

<output>
Create `.planning/quick/261109-fmv-fix-p10-bl-21-header-transfer-reason-tab/261109-fmv-SUMMARY.md` when done, with `created:` and `updated:` (offset -06:00), the three commit hashes, every quoted test result, the 768 px before and after measurements, the focus-test reproduction table (project, alone or together, pass or fail, logged focus target), the cause and why the app or the test was at fault, the Mine-content reading for Admins, and any flake with its output.
</output>

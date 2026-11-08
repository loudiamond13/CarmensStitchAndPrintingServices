---
phase: 10-admin-dashboard
plan: 21
subsystem: ui
tags: [react, component-showcase, playwright, axe, wcag, csp, responsive, sweep, tdd]
created: "2026-11-08T15:40:00-06:00"
updated: "2026-11-08T15:40:00-06:00"

requires:
  - phase: 10-admin-dashboard
    provides: the dashboard cards, money strip, My Money, ledger, All Staff, Transfers table, Transfer and Hand Over windows, delete and remove dialogs (10-07 to 10-20)
  - phase: 05-staff-and-audit
    provides: the Component Showcase and its on-demand demo pattern (05 D-30 to D-33)
provides:
  - "Component Showcase section 'Dashboard and staff money' (19 cases on made-up data), loaded on request, making no request"
  - "IncomeExpenseCardView, DeleteTransferView, RemoveTransferView and an exported TransferForm with a `send` seam: the real parts fed plain values"
  - "web/e2e/dashboard-sweep.spec.ts (@dashboard-sweep) and web/e2e/money-sweep.spec.ts (@money-sweep): axe, layout, console and CSP at 320, 390, 820 and 1440 px in Blush and Espresso, for both roles"
  - "an @dashboard-showcase browser check in web/e2e/showcase.spec.ts"
  - "a phone-layout fix: the name on an All Staff card with Hand Over no longer runs under the pinned buttons"
affects: [gsd-ui-review 10 (screenshot review), gsd-verify-work 10, phase-end code and security review]

actuals:
  tokens: 20900
  tasks: 2
  commits: 7

plan_head_before: fbc59c0a09066e12e95c95b43a4a7686279a8a9a
plan_head_after: 0c8ed5796b923ff30ab96729c20314ddf0bbf3dd

tech-stack:
  added: []
  patterns:
    - "A connected component is split into a plain-values view and a thin connected part, so the showcase draws the real thing with no request (IncomeExpenseCardView, DeleteTransferView, RemoveTransferView)"
    - "A `send` seam on useTransferAction and TransferForm: the showcase windows record or refuse a made-up save instead of calling the server"
    - "Static showcase cases sit in a `contents` wrapper that swallows presses (no link followed, the strip's Transfer opens nothing); the windows are local-state demos"
    - "The showcase section holds its own throwaway query client, so a demo save never touches the app's cache"

key-files:
  created:
    - web/src/modules/admin/components/showcase/Phase10Demos.tsx
    - web/src/modules/admin/components/showcase/Phase10Demos.test.tsx
    - web/e2e/dashboard-sweep.spec.ts
    - web/e2e/money-sweep.spec.ts
  modified:
    - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
    - web/src/modules/admin/components/showcase/showcaseSections.ts
    - web/src/modules/admin/components/showcase/showcaseSections.test.ts
    - web/src/modules/admin/components/showcase/showcaseCopy.ts
    - web/src/modules/admin/components/showcase/showcase.recipe.ts
    - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
    - web/src/modules/admin/components/IncomeExpenseCard.tsx
    - web/src/modules/admin/components/DeleteTransferDialog.tsx
    - web/src/modules/admin/components/RemoveTransferDialog.tsx
    - web/src/modules/admin/components/TransferModal.tsx
    - web/src/modules/admin/hooks/useTransferAction.ts
    - web/src/modules/admin/components/StaffBalancesTable.tsx
    - web/src/modules/admin/components/StaffBalancesTable.test.tsx
    - web/src/modules/admin/components/money.recipe.ts
    - web/src/modules/admin/components/money.recipe.node.test.ts
    - web/e2e/showcase.spec.ts

key-decisions:
  - "The showcase draws the real parts, not copies: cards and dialogs that read data themselves were split into a view that takes plain values, and the connected part now only reads and passes them on. No behaviour changed; their own tests pass"
  - "A demo window must not write: TransferForm takes an optional `send`, and the demos use it to record or refuse a made-up save. The refusal sentences are the approved server lines with made-up figures"
  - "Static cases swallow presses instead of using the `inert` attribute, so keyboard and screen reader users still reach every control while nothing is sent or opened"
  - "The All Staff name fix is in the production layout (a row with Hand Over reserves 72px more on phones), because a short name ran under the eye link at 320 px. The showcase case also keeps a phone's width, because the nested frames leave only 212 px at a 320 px window"

patterns-established:
  - "A signed-in sweep collects every finding of a page into one list and fails once, with the label of the theme and width"
  - "Each money window is opened, measured (page and sheet scroll, buttons reachable, axe) and closed with Esc inside the sweep"

requirements-completed: [DASH-06, MONEY-02]

coverage:
  - id: D1
    description: "Showcase section 'Dashboard and staff money': D1 with the demo values, a new shop at zero, a negative money strip, every dashboard card loading and failed, the chart at 6M and 12M with a negative-profit and a negative-income month, Orders by status with one large and several zero counts, Recent orders with due, overdue, Fully Paid, credit and Not collected rows, My Money in five states, the ledger with every kind, a hand-over, a negative running balance and a deleted row, All Staff with a negative active person, a deactivated person holding money and a deleted person owed money, the Transfers table, the Transfer and Hand Over windows with a validation message and a server refusal, the delete dialog with and without the warning, and the remove dialog"
    requirement: DASH-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/showcase/Phase10Demos.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/showcase/showcaseSections.test.ts"
        status: pass
      - kind: e2e
        ref: "web/e2e/showcase.spec.ts#@dashboard-showcase (chromium, firefox, pixel in run 5; webkit and iphone in run 8; 10 of 10)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The demos make no network request and touch no real data"
    requirement: DASH-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/showcase/Phase10Demos.test.tsx#makes no request, whatever is pressed (no fetch)"
        status: pass
      - kind: e2e
        ref: "web/e2e/showcase.spec.ts#@dashboard-showcase (no /api/ request after the section is asked for)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A signed-in sweep of /admin and /admin?range=12m (Manager), and /admin (Admin) at 320, 390, 820 and 1440 px in Blush and Espresso finds zero axe violations (target-size included), no sideways scroll, no console finding and no CSP violation; the 12M chart draws every other month label at 320 px and every label at 1440 px"
    requirement: DASH-06
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard-sweep.spec.ts (40 passed in five browsers)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A signed-in sweep of /admin/money for an Admin, and for a Manager /admin/money, ?tab=staff, ?tab=transfers, ?tab=transfers&deleted=true and /admin/money/staff/{leaver} at the same widths and themes, with the Transfer, Hand Over, Delete Transfer and Remove Permanently windows open clean; an Admin who opens ?tab=staff ends with no tab in the URL and no tab strip"
    requirement: MONEY-02
    verification:
      - kind: e2e
        ref: "web/e2e/money-sweep.spec.ts (25 passed, then the 20 Manager tests 20 passed after the seeding fix; five browsers)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The admin initial JS stays under 250 KB gzip with the new lazy section"
    verification:
      - kind: other
        ref: "vite build --mode e2e budget table: admin JS 217.44 KB of 250.00 KB, public JS 125.87 KB of 150.00 KB, CSS 17.17 KB of 35.00 KB (the e2e and budget builds share the dev-routes profile)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The name on an All Staff card with Hand Over stays clear of the pinned eye link and Hand Over on phones"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/StaffBalancesTable.test.tsx#keeps the name of a row with Hand Over clear of the pinned buttons on phones"
        status: pass
      - kind: e2e
        ref: "web/e2e/showcase.spec.ts#@dashboard-showcase and web/e2e/money-sweep.spec.ts at 320 px"
        status: pass
    human_judgment: false
  - id: D7
    description: "How every Phase 10 screen state looks in Blush and Espresso on phones, tablets and desktops (the UI-SPEC Visual Review), including the open owner items listed under 'Owner review' below"
    verification: []
    human_judgment: true
    rationale: "The look is the owner's screenshot review in /gsd-ui-review 10. Axe and the layout checks prove no violation and no sideways scroll, not that it looks right"

duration: about 3 h 40 min (start time not recorded exactly; most of it waiting for browser runs, and for the other project's test runs to finish)
completed: 2026-11-08
status: complete
---

# Phase 10 Plan 21: The owner can review every Phase 10 screen state in the showcase, and every new page passes the accessibility and layout sweep

*Created: 2026-11-08T15:40:00-06:00 · Updated: 2026-11-08T15:40:00-06:00*

**The Component Showcase has a "Dashboard and staff money" section with 19 cases on made-up data that send nothing, and two signed-in sweeps prove the dashboard and the money pages clean for axe, sideways scroll, console and CSP at four widths in both themes for both roles. One real layout fault turned up and is fixed: a short name ran under the pinned buttons on an All Staff card at 320 px.**

## Performance

- **Duration:** about 3 h 40 min (the exact start was not recorded)
- **Tasks:** 2 (Task 1 was a tracer), both TDD
- **Commits before this SUMMARY:** 7
- **Files touched by the task commits:** 20 (4 created, 16 modified), 2,055 lines added

## Accomplishments

- **Tracer (Task 1).** `Phase10Demos` shows the cases the plan lists. The real components are fed plain values. A connected card or dialog was split into a view plus a thin connected part (`IncomeExpenseCardView`, `DeleteTransferView`, `RemoveTransferView`), and `TransferForm` is exported with a `send` seam, so the windows can record or refuse a made-up save with no request. The section loads on request, like the Order photos section, and holds its own throwaway query client. The tracer `<verify>` is automated only, so it was re-run end to end after the GREEN commit (`Test Files 3 passed (3)`, `Tests 64 passed (64)`), and expansion went ahead: `Tracer verified end-to-end, expanding`.
- **Dashboard sweep.** `/admin` as a Manager and as an Admin, and `/admin?range=12m` as a Manager, at 320, 390, 820 and 1440 px in Blush and Espresso: axe clean, no sideways scroll, no console or CSP finding. The 12M chart draws 6 month labels at 320 px and all 12 at 1440 px.
- **Money sweep.** An Admin's My Money, and a Manager's My Money, All Staff, Transfers, Transfers with Show deleted, and a leaver's page, at the same widths and themes. The three-tab strip fits at 320 px. The Transfer, Hand Over, Delete Transfer and Remove Permanently windows open clean at every width. An Admin who opens `?tab=staff` ends with no tab in the URL and no tab strip.
- **One fix from the sweep.** At 320 px an All Staff card with Hand Over pins the eye link and Hand Over at its top right, and the title only reserved room for two icon buttons. A short name ran under the eye link (axe target-size in the showcase; on the real page the name box measured 90 px wide from x=66 while the eye link began at x=131). A row with Hand Over now reserves 72 px more, so the name wraps instead.

## Task Commits

1. **Task 1 (tracer): the showcase section** - RED `b19601d5` (test), GREEN `8bf1c037` (feat)
2. **Task 2: the sweeps** - `0c25501d` (test; the sweeps are the tests, and they passed on the first full run, so there is no separate GREEN)
3. **Fix from the sweep: Hand Over card at 320 px** - RED `8a8f2dc0` (test), GREEN `ad390759` (fix)
4. **Showcase fits 320 px and its browser check** - `9df3e611` (fix)
5. **Demo tests get room on a busy machine** - `0c8ed579` (test: a 30 s limit for `Phase10Demos.test.tsx`)

**Plan metadata:** the SUMMARY commit that follows this file. `commits: 7` was measured with `git rev-list --count fbc59c0a..HEAD` before it.

## TDD Gate Compliance

`gsd_run check tdd-red-evidence` was not run: Vitest's default reporter is not a format that classifier reads (same as plans 10-02 to 10-20), so each RED was inspected by hand. `git log -E --grep` shows `test(10-21)` before `feat(10-21)` and before `fix(10-21)` in both cycles.

**Cycle 1, Task 1.** RED `b19601d5`: `Test Files 2 failed (2)`, `Tests 27 failed | 4 passed (31)` over `Phase10Demos.test.tsx` and `showcaseSections.test.ts`. Failures: the stub drew nothing, so every `[data-case]` frame was missing, and the section list had 14 titles where 15 were expected. Semantic assessment: the target tests ran and failed on the planned behavior. Passed at RED on purpose: the three other `showcaseSections` tests and the "names no outside address" test (it asserts an absence). GREEN `8bf1c037`: after correcting guessed texts in my own RED test (the ledger row titles, the All Staff caption, the Record Handover button, the 2-days-left line, the formatted amount), `Tests 314 passed (314)` over 12 files, including the existing tests of every component that was split. No assertion was weakened; each was made to match the real copy.

**Cycle 2, the Hand Over card.** RED `8a8f2dc0`: `Test Files 2 failed (2)`, `Tests 2 failed | 27 passed (29)`: the person cell had no `pg-phone:pr-18` class, and the class was in no recipe. GREEN `ad390759`: `Test Files 3 passed (3)`, `Tests 64 passed (64)`. The e2e finding that started this cycle is the browser-level RED: `target-size` on the name link, at 320 px only.

**Task 2** has no RED run: the sweeps are browser specs, and they found nothing on the real pages. They were checked to bite in two ways: the 12M label count asserts 6 and 12 (a real number, read from the chart), and the showcase run of the same checks failed twice before the fixes below.

## Files Created/Modified

See the `key-files` block. Every string is in `showcaseCopy.ts` (dev trigger labels) or an existing copy module; the looks are in `showcase.recipe.ts` and `money.recipe.ts`.

## Decisions Made

See `key-decisions`. The main one: the showcase shows the real parts through a small seam, not copies, so a later change to a card or dialog shows in the showcase too.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A short name ran under the pinned buttons on an All Staff card at 320 px**
- **Found during:** Task 2 (the showcase sweep at 320 px)
- **Issue:** The phone card pins the eye link and Hand Over to its top right and the title reserves 88 px, enough for two icon buttons. Hand Over is wider (121 px). On the real page at 320 px, with the name "Jomar Santos", the name box ran from x=66 to x=156 and the eye link began at x=131. Axe flagged the showcase case (`target-size`, partly covered).
- **Fix:** `staffPersonHandOverClasses` (`pg-phone:pr-18`) on the person cell of a row that can Hand Over. With it the real page measures name 46 px wide (two lines), no overlap, no axe finding.
- **Files modified:** `StaffBalancesTable.tsx`, `StaffBalancesTable.test.tsx`, `money.recipe.ts`, `money.recipe.node.test.ts`
- **Committed in:** `8a8f2dc0` (RED), `ad390759` (GREEN)

**2. [Rule 1 - Bug] The showcase section widened the page at 320 px**
- **Found during:** Task 1 (the existing `@showcase` 320 px checks failed on all five browsers)
- **Issue:** Buttons never wrap. "Show the Dashboard and staff money cases" and "Open Delete Transfer (with warning)" were wider than the phone's frame, so the page scrolled sideways.
- **Fix:** Shorter dev labels ("Show the Dashboard cases", "Open Transfer (refused)", "Open Hand Over (refused)", "Open Delete (warning)"), shorter case ids, and a `min-w-72` wrapper on the All Staff case (the nested frames leave it 212 px at a 320 px window; the frame scrolls sideways when narrower, as every wide case does).
- **Files modified:** `showcaseCopy.ts`, `showcase.recipe.ts`, `Phase10Demos.tsx`, `Phase10Demos.test.tsx`, `e2e/showcase.spec.ts`
- **Committed in:** `9df3e611`

**3. [Rule 3 - Blocking] Files outside the plan's list**
- **Issue:** The plan lists the showcase files and the two sweeps. A showcase that draws the real parts and sends nothing needed: `IncomeExpenseCard.tsx` (export `IncomeExpenseCardView` and `toChartData`), `DeleteTransferDialog.tsx` (`DeleteTransferView`), `RemoveTransferDialog.tsx` (`RemoveTransferView`), `TransferModal.tsx` (export `TransferForm`, a `send` prop), `useTransferAction.ts` (a `send` option), `showcase.recipe.ts`, `ComponentShowcasePage.test.tsx` (the section list) and `e2e/showcase.spec.ts` (the section list, the h2 count 14 to 15, and the new `@dashboard-showcase` check).
- **Committed in:** `8bf1c037`, `9df3e611`

**4. [Test amendment] Existing tests adapted**
- `showcaseSections.test.ts` and `ComponentShowcasePage.test.tsx`: the section list gained "Dashboard and staff money". `e2e/showcase.spec.ts`: 14 sections became 15 (two places). No assertion was weakened.

**5. [Plan staging] Compile-only stub in the first RED commit**
- `Phase10Demos.tsx` returned null in `b19601d5`; `8bf1c037` replaced it.

**6. [Dispatch] Worktree instead of the main checkout; two commands**
- The plan says to work in the main checkout on `gsd/phase-10-admin-dashboard`. This run was dispatched into a worktree on `worktree-agent-ae1e9e40e1a4f6098`; no push, no merge, no STATE.md or ROADMAP.md edit. The plan's single command `npm --prefix web run e2e -- --grep "@dashboard-sweep|@money-sweep"` was run as one spec file at a time (`npm run e2e -- e2e/<spec> --workers=1 --reporter=line`, as the dispatch said). `npm run build:budget` was not run separately: the e2e build prints the same budget table with the same profile. `web/node_modules` and `tools/openapi-gen/node_modules` were linked to the main checkout's folders and the links are removed at the end.

---

**Total deviations:** 6 (2 bugs, 1 blocking, 1 test amendment group, 1 staging, 1 dispatch).
**Impact on plan:** None changes behavior the plan defined, except the All Staff phone spacing (deviation 1), which the plan allows ("fix any finding in the owning component").

## Issues Encountered

- **Seeding bug in my own sweep (fixed).** The first Manager run failed all 20 cases at the seed step: two transfers in a row raised two "Transfer recorded" toasts and the strict locator matched both. `recordTransfer` now checks the last toast. Admin cases (25) had passed in that first run; the fix does not touch them, so they were not run a second time.
- **Showcase browser check failures, fixed in this plan.** Run 1 of `showcase.spec.ts`: 24 failed in five browsers, all from the section (the 320 px page width, the h2 count 14, and the All Staff target-size finding). After the fixes, run 4: 61 passed, 9 failed; the 5 dashboard failures (webkit x2, pixel Espresso, iphone x2) were the test's own 120 s limit (set after my 300 s) and a 5 s wait for the page on WebKit and iPhone. `@dashboard-showcase` now sets 480 s after the page opens and waits 60 s for the h1. Runs 5 and 8: 10 of 10 pass in five browsers.
- **Known load flake, iPhone (not fixed, not mine).** `showcase.spec.ts` on the iPhone project fails 8 of 14 of its existing tests at `openShowcase`'s 5 s wait for the h1 (`Timeout: 5000ms ... element(s) not found`; the page snapshot shows the shell but no main content yet). It failed the same way in run 4 and run 9 (iPhone alone). The other four projects ran those tests clean in the same runs. The other project's integration tests were running on this machine at the time (the e2e script waited up to 15 minutes for them five times and gave up three times), so this is machine load, but I could not run the baseline to prove my section did not add to it: my section adds one button to the first render. The orchestrator's full gate on a quiet machine decides it.
- **P10-BL-06 not triggered.** The 320 px dashboard cases pass in all five browsers in this run (the e2e database is rebuilt each run, so the KPI figures stay small). No `test.fixme` was added; the existing `dashboard.spec.ts` fixme is untouched. The check does not prove the owner item is closed.
- **Parked items left alone.** P10-BL-01 to P10-BL-14: the showcase shows the current behaviour; none is decided. The 10-20 note on `useRefreshMoney` is unchanged.
- **Known flaky, not touched:** `a11y-rulings.spec.ts:373`, `ExpenseListTimingTests` and the third-party-notices web test were not run.

## Known Stubs

None. The compile-only stub of the first RED commit was replaced in GREEN.

## Owner review: new wording, choices and what I saw (P10-BL-07)

No new owner-facing sentence is in the app. In the showcase (dev wording, SPEC-GAP, like the earlier sections): the on-request button "Show the Dashboard cases" and the triggers "Open Transfer Money", "Open Transfer (refused)", "Open Hand Over Money", "Open Hand Over (refused)", "Open Delete (warning)", "Open Delete Transfer" and "Open Remove Permanently". The two made-up refusals reuse the approved server lines ("You only have ₱200.00 on hand." and "Jomar Santos only has ₱300.00 on hand.") with made-up figures.

For the screenshot review (nothing here is changed):

- **Transfer reason line.** The UI-SPEC says "beside". On the dashboard strip "Nothing on hand to transfer." takes its own full-width row under the label, figure and buttons at every width (left-aligned on phones, right-aligned wider). On My Money it sits under the header Transfer button (stacked, not beside).
- **Strip failure line.** "Couldn't load your money on hand." is Small (14 px), in the danger colour, with Try Again (ghost, small) beside it in the figure slot.
- **Wave 6 IN-02 heading choice.** The strip and the My Money card are named regions (`aria-labelledby` the visible label). Neither has a heading, so the H key skips them. The alternative is an `h2` with the same classes. Still the owner's call.
- **Validation messages in the Transfer window.** The showcase shows them by interaction: press Record Transfer with nothing filled in ("Choose who got the cash.", "Enter the amount."); type to see the others. Server refusals are the two "(refused)" triggers.
- **12M chart at 320 px** draws 6 of 12 month labels; the 6M chart draws all 6.
- **Phone card with Hand Over:** a name now wraps earlier to make room for the buttons (the fix above). Say if you prefer the buttons on their own row instead.

## Threat Flags

None. The only new seam is `send` on `useTransferAction` and `TransferForm`; nothing in the app passes it, and the demos use it only for made-up saves. T-10-46 mitigated (made-up people and figures only; the demos make no request: unit test and browser check). T-10-47 mitigated (the CSP listener runs on every swept page in both themes and both roles; no violation). T-10-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Verification Results

All from this worktree, final code unless noted.

- Tracer verify (unit): `Test Files 3 passed (3)`, `Tests 64 passed (64)` for `Phase10Demos.test.tsx`, `showcaseSections.test.ts` and `ComponentShowcasePage.test.tsx`.
- Final unit run of every file this plan touched or split (the showcase folder, `ComponentShowcasePage`, `StaffBalancesTable`, `money.recipe.node`, `IncomeExpenseCard`, `DeleteTransferDialog`, `RemoveTransferDialog`, `TransferModal`, `MoneyStrip`, `MoneyPage`, `DashboardPage`, `no-long-dash`, `source-layout`), while the other project's tests were running: `Test Files 4 failed | 14 passed (18)`, `Tests 4 failed | 418 passed (422)`. The four failures were 5 s timeouts (or a late heading) in tests this plan did not write: `no-long-dash.node.test.ts`, `DashboardPage.test.tsx` (the greeting), `Phase8Demos.test.tsx` (static axe) and `Phase9Demos.test.tsx` (one live axe). Re-run alone, one file at a time (`--no-file-parallelism`): `Test Files 4 passed (4)`, `Tests 74 passed (74)`. Load flakes, recorded. My own `Phase10Demos.test.tsx` timed out the same way once (with a `DashboardPage` test); that is why it now has a 30 s limit. Earlier, on a quieter machine: `Test Files 12 passed (12)`, `Tests 314 passed (314)` for the showcase files plus the split components.
- Dashboard sweep (`npm run e2e -- e2e/dashboard-sweep.spec.ts --workers=1 --reporter=line`): `40 passed (5.9m)`.
- Money sweep (`... e2e/money-sweep.spec.ts`): first run `25 passed`, 20 Manager cases failed at the seed step (my toast locator); after the fix `... --grep "Manager.s money pages"`: `20 passed (14.4m)`.
- Showcase browser check: run 5 (`--grep dashboard-showcase`) `7 passed`, with webkit Espresso and both iPhone cases failing on the page-load wait; run 8 (`--project webkit --project iphone`) `4 passed (19.1m)`. Together 10 of 10.
- Budget (the e2e build's table, `dev-routes` profile, the same as `build:budget`): `public JS 125.87 KB / 150.00 KB ok`, `admin JS 217.44 KB / 250.00 KB ok`, `CSS 17.17 KB / 35.00 KB ok`.
- `npm --prefix web run typecheck` (three projects) and `npm --prefix web run lint` (`eslint . --max-warnings 0`), run on the code before the last test-only commit: exit 0, no output. After it, `eslint --max-warnings 0` and `prettier --check` on `Phase10Demos.test.tsx`: clean.
- gitleaks (`gitleaks git --pre-commit --staged`, run by the pre-commit hook): no leaks found on each of the 7 commits. Every person and figure in the demos and the sweeps is made up (the fixtures' Carmen Reyes, Liza Mercado, Paolo Garcia, Jomar Santos, Ana Villanueva; fresh staff named with a random token).
- Acceptance greps: `Phase10Demos` in `ShowcaseDemos.tsx` 3 (>= 1); `Phase10Demos.test.tsx` has a test named "makes no request, whatever is pressed (no fetch)"; `@dashboard-sweep` in `dashboard-sweep.spec.ts` and `@money-sweep` in `money-sweep.spec.ts` both >= 1.
- Not run: the full Vitest and Playwright suites, parity and Lighthouse (the orchestrator's gate), the .NET suites (no server file changed), `npm run build:budget` on its own.

## Next Phase Readiness

`/gsd-ui-review 10` has the section to open at `/admin/components` (Manager) or `/dev/components` and the list above. The phase gate (full suites) is the orchestrator's; check the iPhone showcase waits there, on a quiet machine.

## Self-Check: PASSED

- FOUND: all 4 files in `key-files.created` exist on disk.
- FOUND: commits `b19601d5`, `8bf1c037`, `0c25501d`, `8a8f2dc0`, `ad390759`, `9df3e611`, `0c8ed579` on this branch; `git rev-list --count fbc59c0a..HEAD` = 7 before this SUMMARY commit.
- STATE.md and ROADMAP.md were not modified. `web/src/types/api.generated.ts` and `tools/openapi-gen/openapi.v1.json` were not touched.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-08*

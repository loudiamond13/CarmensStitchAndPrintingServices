---
created: 2026-11-09T12:15:00-06:00
updated: 2026-11-09T12:55:00-06:00
phase: quick-261109-fmv
plan: 01
subsystem: web/admin money
tags: [a11y, tablet, e2e, focus, D-109, P10-BL-21]
status: complete
requirements: [MONEY-02, MONEY-03, MONEY-06]
commits: 3
plan_head_before: 486f258cc8a5fa9e0e78a02b254c6dc0669ed31c
plan_head_after: 77b4f56268e56c71492821108cbd9d4b1c53e25b
actuals:
  tasks: 3
  commits: 3
---

# Phase quick-261109-fmv Plan 01: P10-BL-21 fixes Summary

All three parts are done. Part 2 first stopped under the plan's own stop condition (All Staff could not fit at 768 px with the existing wrapping); the owner then ruled D-110, option A, and Task 2 was finished in a third commit.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | e3258194 | The My Money header Transfer is described by the balance card's loading or failure line on the Mine content (D-109 part 1) |
| 2 | 77b4f562 | All Staff and Transfers fit at 768 px; All Staff Actions may wrap on tablets (D-109 part 2, D-110) |
| 3 | 7b29c0ef | The focus check after a transfer delete follows the rows still listed; DECISIONS.md outcomes (D-109 part 3) |

## Task 1: header Transfer description

- New optional `titleId` on `ErrorState`, optional `statusId` and `failureId` on `MoneyOnHandCard`, wired in `MoneyRoute` with `useId`. The button points at an id only while the Mine content is mounted (`showsCard`), so it never points at a missing id.
- Admin reading: an Admin's My Money has no tab strip and shows only the Mine content (D-42) with the same balance card, so the D-109 description applies there too. This is the Mine content D-109 names, not a new rule.
- Failure line: only the bold first line is the description, so "Try Again" and the reference are not read.
- Red first (quoted): 7 new tests failed (ErrorState 1, MoneyOnHandCard 2, MoneyPage 4: the description was empty). After the change:
  `npm run test -- --run ErrorState MoneyOnHandCard MoneyPage loading StaffMoneyPage MoneyStrip`: Test Files 6 passed (6), Tests 174 passed (174).
- typecheck, lint (`--max-warnings 0`) and `format:check` exited 0 ("All matched files use Prettier code style!").
- 10-UI-SPEC.md cites D-109 at the M1 header and the Disabled Transfer row.

## Task 2: tablet tables (measured, stopped, then finished under D-110)

Chromium, 768 x 1024, frame 646 px, card right edge 744 px. The extended browser check (ledger, All Staff with a leaver that holds money, Transfers with a 200 character note) was built and run.

| Table | Before (680 px floor) | With `fitTablet` |
|---|---|---|
| Ledger | 646 (already fixed in c4l) | 646, fits |
| Transfers | frame scroll 680 | table 646, fits, Actions inside the card |
| All Staff | frame scroll 680 (red run: expected <= 646, received 680) | table 658, frame scrolls 12 px, Actions header right edge 755.4 against 744 (red: expected <= 646, received 658) |

Column minimums for All Staff: Person 88, Role 98, Status 130, Money on hand 145, Actions 197 (eye link and Hand Over side by side; `rowActionsClasses` is `inline-flex` with no wrap) = 658. Per the plan, no new pattern was invented at that point: the changes were reverted, saved as a patch and the owner was asked.

**After D-110 (owner, option A):** the patch was applied with `git apply --3way` (the e2e file had moved on with Task 3) and then deleted. Scope of the wrap: All Staff only, tablets only. `RowActions` got an optional `className` (default classes unchanged, tested), and `StaffBalancesTable` passes `staffActionsTabletClasses` = `pg-tablet:flex-wrap` (768 to 1023 px). Phones, desktop, the ledger and Transfers keep `inline-flex justify-end gap-2`. Hand Over keeps `hitAreaClasses` (44 px tap area), the eye link keeps its 44 px target area, no wording changed.
- Red first (quoted): "expected [ 'inline-flex', 'justify-end', ... ] to include 'pg-tablet:flex-wrap'". The test checks the wrap class is present and the bare `flex-wrap` absent, Hand Over keeps `relative` and `before:h-11`, and the eye link comes first. The `RowActions` className test was written together with the change (not run red on its own).
- Browser: `--grep "fits its card at 768px"`: "5 passed (1.5m)" (ledger Manager and Admin, All Staff with a leaver row, Transfers with a 200 character note). I did not log the new pixel widths; the test asserts frame scroll <= frame width, last header inside the card and no sideways page scroll.
- `--grep "@money "`: "25 passed (3.1m)". `--grep "@money-sweep"`: "45 passed (9.6m)".
- typecheck, lint, format:check all exit 0. Full Vitest: Test Files 324 passed (324), Tests 9057 passed (9057), exit 0.
- 10-UI-SPEC.md: All Staff and Transfers panels and the "Tables on tablet and phone" row cite D-109 and D-110. DECISIONS.md P10-BL-21 part 2 has its outcome. D-110 in 10-CONTEXT.md and DECISIONS.md was written by the coordinator and went into this commit.

## Task 3: root cause of the focus check

Cause: the test, mostly. The five browser projects run in parallel against one shared database and the Transfers list is shop-wide. The test saved the position of its row and expected focus at that position, but other copies' rows left and arrived meanwhile.

Reproduction (temporary diagnostics, removed before the commit):

| Run | Result |
|---|---|
| Each project alone (chromium, firefox, webkit, pixel, iphone) | 5 of 5 passed |
| All five together, run 1 (old test, old app) | 2 failed (firefox heading check, pixel position check) |
| All five together, runs 2 and 3 (old test, app fix in) | 3 failed each |

Logged focus targets (fake test names):
- pixel run 1: before `[Wrongc61c, Wronga39d(own)]`, after `[Wrong76da]` (new row from another copy), focus on the caption, test expected position 0. Class A.
- pixel run 2: before `[Wrong918d, Wrong09ac, Wrong2bec(own)]`, after `[Wrong918d]`, focus on `Wrong918d` (nearest row still listed), test expected position 1. Class A, and it shows the situation behind B (the chosen neighbor left, another known row stayed).
- firefox run 2: own was first, list empty after, focus on the h2, test expected position 0 (index -1 is the heading, the app was right). Class A.
- firefox run 3 (else branch, own was the only row before): another copy's row arrived, caption focused, test expected the heading. Class A.

Fixes:
- Test (class A): `focusCheckScript` names the target: first row after the deleted one still listed, else nearest one before it still listed, else the caption (rows shown) or the heading (empty list). No assertion loosened, no retry, no sleep, no timeout change.
- App (class B, real but secondary): `useTransferRowActions` kept one neighbor id, so when it left the list focus fell to the caption although other rows were shown. It now keeps the ordered candidates (after in order, then before nearest first) and focuses the first one that can take focus. Red first (quoted): two new TransfersCard tests failed with focus on the `caption` ("Expected element with focus: button ... Received element with focus: caption"); they pass after the fix. Note: class B was not directly captured with the old app in a browser; the situation was seen in the run-2 logs and is reproduced deterministically by the component tests.

Proof: `--grep "deletes a wrong transfer"` with no project, three runs in a row: "5 passed (47.4s)", "5 passed (45.5s)", "5 passed (45.0s)" (15 of 15). `--grep "@money "`: "25 passed (2.9m)", exit 0.

## Other checks

- TransfersCard, LedgerCard, LedgerTable tests: 98 passed. typecheck, lint, format:check exit 0.
- Full Vitest run after the preflight: Test Files 324 passed (324), Tests 9053 passed (9053), exit 0, no warning lines.
- Preflight before every browser or full run: all four ports free, no dev/test processes.
- Flakes: none beyond the failing test being fixed. The `Transfer recorded` toast check in the shared `recordTransfer` helper hit a strict-mode clash with two toasts during Task 2 setup; fixed with `.first()` in the helper (in the Task 2 commit).

## Deviations from Plan

- **Stop condition (planned):** Task 2 stopped, then resumed after the owner's D-110 ruling.
- **Rule 2 style addition:** optional `className` on the shared `RowActions` (additive), to scope the wrap to All Staff.
- No other deviations. No package, server, database, wording or em/en dash changes.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- Commits e3258194, 7b29c0ef and 77b4f562 are on `gsd/phase-10-admin-dashboard` (`git log --oneline -4`).
- `git status --short` shows only this SUMMARY untracked; the patch file is deleted.

---
created: 2026-10-27T22:27:00-05:00
updated: 2026-10-27T22:45:00-05:00
phase: quick-261027-t3j
plan: 01
status: complete
requirements: [D-63]
commits: 3
plan_head_before: 4d59fca2
plan_head_after: df81a9e6c67875e08333d18e2216b925e8623560
actuals:
  tasks: 3
  commits: 3
---

# Quick 261027-t3j: Restyle shared Select and DateInput, remove the written-out date (D-63)

Date boxes now show the app's own calendar icon over the browser's invisible indicator, the dropdown and date boxes share one picker look, and no date is written out beside any date box.

Status is complete. The owner approved the look on 2026-10-27 (visual check passed).

## Commits (not pushed)

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 (tracer) | 1d228902 | D-63 recorded in 06-CONTEXT.md; written-out date and Field `beside` slot removed; From and To use plain toolbar width; `expenses.recipe.node.test.ts` deleted |
| 2 | 5dea9799 | DateInput with the 18px calendar icon, picker recipe, Firefox case, class-gate entry, `@showcase` e2e test |
| 3 | df81a9e6 | Select on the shared picker look, D-63 parity ruling group, `has-[:is(select,input):enabled]` fix |

## Gate results (quoted)

- Tracer RED: page and modal tests failed on the visible date; typecheck failed with `DateInput.test.tsx(112,7): error TS2578: Unused '@ts-expect-error' directive.` Then GREEN: `Test Files 27 passed (27) / Tests 597 passed (597)`, typecheck and lint clean.
- Task 2 RED: recipe node tests and DateInput markup tests failed before the recipe existed. GREEN: `Test Files 97 passed (97) / Tests 2907 passed (2907)`.
- Task 3 RED: `Tests 3 failed | 79 passed (82)` (Select markup, D-63 ruling list and pin). GREEN: `Test Files 9 passed (9) / Tests 194 passed (194)`.
- `npm --prefix web run verify` (second run): typecheck, lint, `prettier --check` clean; `Test Files 202 passed (202) / Tests 6008 passed (6008)`; coverage thresholds passed; build, budgets, `License gate passed.`, `THIRD-PARTY-NOTICES.txt is up to date (28 packages).`, exit 0.
- Parity `@forms|@lists` (after the fix): `86 passed`, only 3 failed, all `lists-overflow` (see Pre-existing failures). Every `@parity @forms` and `@parity @lists` row passed in all engines. `TOLERANCE_OVERRIDES` untouched.
- e2e `@showcase the date box ...` : passes in chromium, firefox, webkit, pixel, iphone (15 passed with the bypass-CSP picture run).
- e2e `@showcase|@expenses-filters|@expenses-add|@expenses-edit|@audit`: `110 passed`, 5 failed, all in `audit-log.spec.ts` (see below). No @showcase, @expenses-* failure.

## Which Firefox case held

The pinned Firefox draws its own calendar button inside date inputs. So the Firefox-only classes stay: our icon is hidden there (`supports-[-moz-appearance:none]:hidden`) and the input has 12px end padding. Exactly one calendar icon shows in every engine. Playwright WebKit (Windows build) draws no indicator of its own for a date input at all (a plain `<input type=date>` is a bare text box there), so our icon is the only one and the click-through assertion passes; on real Safari and Chromium the browser's indicator sits under it and opens the native picker.

## Deviations

1. **[Rule 3 - Blocking] Class gate rejects `opacity-0`.** The invisible-indicator class `[&::-webkit-calendar-picker-indicator]:opacity-0` is outside the D-02 opacity allow-list. I added one scoped entry to `web/scripts/class-gate.config.mjs` (this exact token, only in `field.recipe.ts`, decision D-63). It is not a text element. Not in the plan's file list; the owner may want to look at it.
2. **[Rule 1 - Bug] Firefox hover on a disabled Select.** `has-enabled:` (`:has(:enabled)`) matched the options of a disabled select in Firefox, so a disabled Select filled and darkened on hover (4 parity failures). Fixed to `has-[:is(select,input):enabled]` in Task 3 (rulings.css states the same with `select:enabled`). This also corrects the Task 2 date box.
3. **e2e screenshots in WebKit.** Playwright's WebKit screenshot injects an inline style, which the strict CSP blocks and the guard fails on. The `@showcase` test attaches Blush and Espresso pictures only outside WebKit. WebKit pictures were taken in a scratch run with CSP bypassed (not committed).
4. **e2e type check.** The e2e tsconfig has no DOM lib, so in-page code in the new test uses string expressions like the other specs.

## Pre-existing failures (not caused by this work; baseline at 4d59fca2 checked in a throwaway worktree, since removed)

- `visual/lists-overflow.spec.ts` "four filter chips wrap at 320px ...": page scrollWidth 325 vs 320 in chromium, firefox, webkit. Same result at 4d59fca2. Cause seen: each chip's clear button content overflows by 11px. The case has no form controls.
- `e2e/audit-log.spec.ts` in WebKit and iPhone: three tests fail (Audit Log data not showing, "Done to" select stays disabled). Same three fail at 4d59fca2 in WebKit with 1 worker. Chromium, Firefox and Pixel pass.

## Flakes

- `src/test/build-output.node.test.ts` "contains no dev preview module": `Test timed out in 5000ms` during the first full `verify` run; passed alone in 251 ms and in the second full run.
- `audit-log.spec.ts:243` in Firefox failed once in the large e2e run ("Edit Expense" dialog still visible) and passed on a re-run of `@audit` in Firefox.

## Known stubs / threat flags

None. No new network surface, no package added, no inline styles.

## Open for the owner (not self-approved)

Visual check: look at Company Expenses, the Add window and the showcase in Blush and Espresso, on a phone and a desktop. Confirm the dropdowns and date boxes look better, the calendar icon sits where the grey one was and opens the picker, phones keep the native wheel and calendar, and From and To read well side by side. Note on phones the toolbar now wraps Category and From on one row and To on the next (plain toolbar width, D-63).

Pictures (git-ignored, local): `artifacts\owner-review\index.html`, `...\phase6-review\e1-manager-list-{light,dark}-{390,820,1440}.png`, `...\phase6-review\e2-add-{light,dark}-{390,820,1440}.png`. Date box close-ups (scratch, five engines, Blush and Espresso): `<session scratchpad>\shots\date-<chromium|firefox|webkit|pixel|iphone>-<Blush|Espresso>.png`.

## Self-Check: PASSED

Commits 1d228902, 5dea9799 and df81a9e6 are on `fix/form-controls-restyle`; working tree clean; not pushed.

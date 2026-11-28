---
phase: 14-hardening-release-readiness
plan: 11
subsystem: testing
tags: [e2e, playwright, webkit, iphone, codeql, dialog-fit, shell]
created: "2026-11-28T01:25:00-06:00"
updated: "2026-11-28T01:25:00-06:00"
status: complete
requires: []
provides:
  - "Root cause and proof for each of the five stable WebKit and iPhone e2e failures from the 12.1 final gate (all three causes are test races, already fixed by 7efb2535; each was re-created here with its fix removed and shown to fail, then shown to pass with it)"
  - "deleteOrderDialog.ts page scripts take the dialog name as an evaluate argument (CodeQL alert 3, js/bad-code-sanitization)"
  - "Full iPhone and WebKit project totals, with every other failure listed with its alone result for plan 14-18"
affects: [14-10, 14-18]
actuals:
  tokens: 1455
  tasks: 3
  commits: 1
plan_head_before: 7547586c0379d850002315a3c05a9600dc11de26
plan_head_after: bd49d7b47ffc0e8b47ca1a1c8b710e4545b5a5af
tech-stack:
  added: []
  patterns:
    - "A page script that needs data is a real function that gets the data as the evaluate argument (typed through a small globalThis shape), never a string with the data spliced in"
key-files:
  created: []
  modified:
    - web/e2e/deleteOrderDialog.ts
key-decisions:
  - "No new owner ruling. D-25 applied as ruled: no test was skipped, deleted or loosened."
  - "Tasks 1 and 3 changed no file: the fixes for the five failures were already in the branch (commit 7efb2535, 2026-11-21, two days after the 12.1 gate). This plan proved each cause and each fix instead of repeating them."
requirements-completed: []
coverage:
  - id: D1
    description: "The five stable failures from the 12.1 final gate pass on their projects alone and in the full project runs"
    requirement: A11Y-05
    verification:
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep \"@dialog-fit|@site-content\" --project iphone --project webkit --project chromium (136 passed, 17 skipped, 0 failed); --grep @shell --project webkit --project iphone (66 passed); full iphone run 507 passed and full webkit run 530 passed with none of the five failing"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each fix names its root cause with evidence, and no test was loosened"
    requirement: A11Y-05
    verification:
      - kind: e2e
        ref: "Failing state re-created with the fix removed: shell 1187 px on both engines; dialog-fit 12 of 16 failed on the 5 s h1 wait, 16 of 16 pass with 30 s; signInAs guard test 7 of 10 failed without the top bar wait"
        status: pass
    human_judgment: false
  - id: D3
    description: "CodeQL alert 3: the Delete Order dialog helper passes the dialog name as an argument; measurements unchanged"
    requirement: A11Y-05
    verification:
      - kind: e2e
        ref: "grep -c \"JSON.stringify(DIALOG_NAME)\" web/e2e/deleteOrderDialog.ts = 0 (was 1); @dialog-fit 33 passed, 17 skipped, 0 failed on iphone, webkit, chromium and both scrollbar projects; typecheck, eslint and prettier clean"
        status: pass
    human_judgment: true
    rationale: "That GitHub closes alert 3 can only be seen on the PR's CodeQL run."
  - id: D4
    description: "Every other failure in the full iPhone and WebKit runs is recorded with its alone result for plan 14-18"
    verification:
      - kind: e2e
        ref: "Tables below: 9 of 11 iPhone failures and 5 of 7 WebKit failures passed alone (load flakes); the Contact tabbing case fails alone on both engines (a real failure)"
        status: pass
    human_judgment: true
    rationale: "Whether to fix the Contact tabbing failure in the app or in the test is plan 14-18's call, and the Contact layout is a look the owner approved."
duration: 229min
completed: 2026-11-28
---

# Phase 14 Plan 11: The stable WebKit and iPhone e2e failures Summary

**All five failures from the 12.1 final gate are test races that commit 7efb2535 already fixed; each cause was re-created here with its fix removed and shown to fail, then shown to pass, and the Delete Order dialog helper now passes the dialog name to the page as an argument (CodeQL alert 3).**

## Performance

- **Duration:** 3 h 49 min, mostly waiting for e2e runs (the full iPhone run took 55.6 min and the full WebKit run 56.0 min)
- **Started:** 2026-11-27T21:29:00-06:00
- **Completed:** 2026-11-28T01:25:00-06:00
- **Tasks:** 3
- **Files modified:** 1 (`web/e2e/deleteOrderDialog.ts`)

## What happened to the five failures

None of the five reproduced on the current branch. The STATE note said the check was to compare with f579e158. The git history answered it faster: commit `7efb2535` ("stop three timing races behind the five iPhone and WebKit failures", 2026-11-21) already fixes all five. The 12.1 gate ran on 2026-11-19. So this plan did what systematic debugging asks when a bug will not reproduce: take the fix out, see the failure come back for the stated reason, put the fix back, see it pass. No app code, wording or layout is involved in any of the five.

| Test | Project | Root cause | Fix (already in the branch) | Failing state re-created here | Alone, with the fix | In the project run |
|---|---|---|---|---|---|---|
| `@shell full bleed admin at 390x844` | webkit, iphone | The test read the page height while the Signed-in devices list was still a loading skeleton (about 1190 px). A test that assumed the list was loaded, not an app defect. | The test makes the list answer 1.5 s late and waits for "Signed-in devices loaded." before it measures (7efb2535) | A scratch copy of the f579e158 test with the list held back 4 s and no wait: **1187 px in an 845 px window on both engines**, the exact number in the gate note | 3 of 3 on webkit, 3 of 3 on iphone (plus 4 of 4 in a first run) | `--grep @shell` on webkit and iphone: 66 passed, 0 failed; full runs: the case passed on both |
| `@dialog-fit ... a click on the dark area above the sheet closes it` | iphone | `openDeleteOrder` waited the 5 s default for the Component Showcase h1. The showcase draws about 250 cases in one commit and takes 4 s on a quiet machine, 6 to 10 s under load. A test that assumed too short a wait. | 30 s timeout on that wait (7efb2535) | 30 s taken out, 6 workers, 8 repeats of both cases: **12 of 16 failed**, every one with `toHaveText('Component Showcase')` timing out at 5000 ms | 3 of 3 (and 16 of 16 under the same 6-worker load with the 30 s wait, twice) | `--grep "@dialog-fit\|@site-content"` iphone, webkit, chromium: 136 passed; full iphone run: passed |
| `@dialog-fit ... a right press on the dark area above the sheet keeps it open` | iphone | Same cause as the row above (same helper) | Same | Same run (the other 6 of the 12 failures) | 3 of 3 | Same |
| `@site-content-business at 320px ...` | iphone | `signInAs` returned while the sign-in layout's empty `main` still stood in for the admin shell. `openSiteContent` then chose the wrong navigation on a phone and hung for the 8-minute test timeout. A test that trusted `main` as proof of the shell. | `signInAs` waits for the admin top bar's Search box (7efb2535) plus the `@auth` guard test "signing in returns only once the admin shell is on screen" | The Search-box wait removed and the guard test run 10 times on pixel with 4 workers: **7 of 10 failed** ("the top bar is already on screen") | 3 of 3 on iphone, and 6 of 6 under 4 workers on iphone and pixel | `--grep "@dialog-fit\|@site-content"`: 136 passed; full iphone run: passed |

The three scratch edits (the late-list copy, the 30 s wait, the Search-box wait) were reverted at once (`git checkout -- <file>` on the one file, scratch spec deleted). The tree was clean before the CodeQL change.

## CodeQL alert 3

`web/e2e/deleteOrderDialog.ts` built the page scripts as strings with `JSON.stringify(DIALOG_NAME)` spliced into the code text. Baseline count at the start of Task 2: 1. After: 0.

The two scripts that needed the name (`settleRegion` and `measureRegion`) are now real functions that receive the name as the second argument of `page.evaluate`. They read the DOM through `globalThis`, typed by three small shapes (`DialogNode`, `RegionNode`, `PageScope`). That is the pattern other specs already use (`globalThis as unknown as { ... }`), so the e2e program still needs no DOM types and no tooling change. The page lookup, the animation wait and the measurements are the same as before. The other page scripts in the file take no data and stay strings.

Proof the measurements did not change: `@dialog-fit` on iphone, webkit, chromium, `chromium-classic-scrollbars` and `chromium-overlay-scrollbars`: 33 passed, 17 skipped by design (desktop-only or device-only cases), 0 failed. Those tests assert the 140 px, 96 px and 16 px tops, centring, full-width sheet and scroll positions. `npm --prefix web run typecheck`, `eslint --max-warnings 0` and `prettier --check` on the file are clean.

CodeQL itself can only confirm the closure on the PR run (review-pack item below).

## Task Commits

1. **Task 1: full-bleed admin shell check on WebKit and iPhone** - no commit. Nothing to change; the fix was already in the branch.
2. **Task 2: iPhone dialog-fit and Site Content checks, helper passes data as arguments** - `bd49d7b4` (test)
3. **Task 3: the fixed specs hold in their full project runs** - no commit. No spec needed another change.

**Plan metadata:** the commit that adds this file.

## Full project runs (Task 3)

| Run | Passed | Failed | Skipped | Time |
|---|---|---|---|---|
| `--project iphone` (534 tests) | 507 | 11 | 16 | 55.6 min |
| `--project webkit` (549 tests) | 530 | 7 | 12 | 56.0 min |

None of the five specs failed in either run. No run was flaky-retried (`retries: 0`).

Every other failure was re-run alone (one worker):

| Spec and case | iphone full run | iphone alone | webkit full run | webkit alone | Cause |
|---|---|---|---|---|---|
| `expenses-sweep` Phase 6 showcase cases fit (6 widths and themes) | 4 failed | 6 of 6 passed | 5 failed | 6 of 6 passed | The test waits the 5 s default for the showcase h1 (`expenses-sweep.spec.ts:341`). Same cause as the dialog-fit row above. Load flake. |
| `shell` phase 5 no sideways scroll on `/admin/components` | 1 failed | passed | none | not run | Same 5 s showcase wait. Load flake. |
| `a11y-rulings` D-05 on `/dev/components` (light, dark) | 2 failed (600 s test timeout inside `settle`) | passed, but in 7.2 and 7.9 minutes | none | not run | The case tabs through the whole showcase and takes 7 to 8 min alone on iPhone, so it passes or hits the 10 min limit depending on load. The test is too slow, not wrong. |
| `motion` user menu: desktop pops in | 1 failed (chevron still at 0 deg after 350 ms) | passed | none | not run | A timing sample at a fixed 350 ms. Load flake. |
| `orders-sweep` UIC-70 100 items | 1 failed (240 s timeout on the 100th Add Item click) | passed | none | not run | Load flake. |
| **`public-sweep` Contact at 390 px: tabbing never leaves a focused control under a bar** | 1 failed | **failed** | 1 failed | **failed** | **Real failure, alone and in the run, on both engines.** A `TEXTAREA` is "partly under the contact bar" (step 11, top 710, bottom 822, window 390 x 844, iphone and webkit). |
| **`public-sweep` Contact at 1440 px: same** | 1 failed | **failed** | 1 failed | **failed** | **Real failure.** A `TEXTAREA` is "partly outside the window" (step 15, top 867, bottom 979, window 1440 x 900). |

The two real failures are in `public-sweep.spec.ts`, not one of this plan's specs, so by the plan they go to plan 14-18. Not diagnosed to root cause here. What is known: the focused control is the textarea of the quote form that Phase 13 added to the Contact page, so these tests did not meet it at the 12.1 gate; they failed on both WebKit projects (Chromium and Firefox were not run here); and the engine's focus scroll leaves the tall textarea partly past a bar or the window edge. Whether the fix belongs in the page (scroll padding) or the test is for 14-18, and a page change would touch an approved layout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] First CodeQL fix was wrong: a string page function is not called by Playwright**
- **Found during:** Task 2, first run of the verify command
- **Issue:** I first rewrote the two scripts as strings holding an arrow function (`(name) => {...}`) and passed the name as the argument. Playwright's JS client calls a function only when it is a real function, so the string was evaluated as an expression and returned nothing. 25 tests failed (`Cannot read properties of undefined (reading 'scrollTop')`).
- **Fix:** Reverted the file and wrote real functions that read `globalThis` through small typed shapes, the pattern other specs already use. Nothing from the broken version was committed.
- **Files modified:** `web/e2e/deleteOrderDialog.ts`
- **Verification:** `@dialog-fit` 33 passed on five projects; the plan's verify command 136 passed.
- **Committed in:** `bd49d7b4`

**Total deviations:** 1 auto-fixed (1 bug, caught by the verify run before any commit).
**Impact on plan:** None on scope. The plan said to keep page scripts as strings; that was not possible for the two scripts that carry data, and real functions need no DOM types or tooling change, so the "send it to the pack" fallback was not needed.

## Issues Encountered

- Tasks 1 and 3 have no code commit because there was nothing left to fix. The plan's "commit each task" is met by the records here, not by empty commits.
- Other e2e files still splice `JSON.stringify(...)` into page code (`expenses-sweep.spec.ts`, `fixtures.ts`, `fixture-selftest.spec.ts`, `focus.ts`). The 14-03 alert list names only alert 3 for e2e code, so they were left alone. If CodeQL flags them on the PR run, the same function-and-argument pattern applies.
- The full iPhone and WebKit runs take about an hour each, and two single cases (D-05 on `/dev/components`) take 7 to 8 minutes alone on iPhone.

## Review-pack items raised (for plan 14-10, with my recommendation)

1. **CodeQL alert 3 closure** can only be confirmed on the PR's CodeQL run. Recommendation: check it there; if it stays open, dismiss it as test-only code with a written reason.
2. **Contact page: the quote form textarea sits partly under the contact bar on WebKit phones and partly outside the window at 1440 x 900 when reached by Tab** (`public-sweep` Contact tabbing, both engines, alone and in the run). Recommendation: plan 14-18 finds the cause first; if the fix is scroll padding or a spacing change on the Contact page, show before and after pictures, because it changes an approved page.
3. **Slow and load-sensitive e2e cases** (showcase h1 5 s waits in `expenses-sweep` and `shell`; the D-05 showcase tabbing taking 7 to 8 min on iPhone; the `motion` user menu 350 ms sample; `orders-sweep` UIC-70). Recommendation: give the showcase waits the same 30 s as `openDeleteOrder`, and let 14-18 decide how to speed up or split the D-05 case. Nothing should be skipped or loosened.

## Threat Flags

None. Only an e2e helper changed. The threat model's mitigations held: the preflight was run before every e2e run (ports 5180, 5115, 7028 and 5199 free, no other project's processes), only `CSPS_E2E` was used, no other process was stopped, no package was added, and no server was left running (final preflight: all ports free, no dev or test processes).

## Known Stubs

None.

## Next Phase Readiness

- Plan 14-18 gets the two real Contact tabbing failures and the list of load-sensitive cases above.
- Plan 14-10 gets the three review-pack items above.
- This plan's specs (`@shell` full bleed admin, the two iPhone `@dialog-fit` cases, iPhone `@site-content-business` at 320 px) are green alone and in the full iPhone and WebKit runs.

## Self-Check: PASSED

- `web/e2e/deleteOrderDialog.ts` exists and holds no `JSON.stringify(DIALOG_NAME)` (count 0).
- Commit `bd49d7b4` is in HEAD's history.
- `typecheck`, `eslint --max-warnings 0` and `prettier --check` on the changed file pass.
- Working tree clean before this file; no server, host or lock left (preflight: ports free).

---
*Phase: 14-hardening-release-readiness*
*Completed: 2026-11-28*

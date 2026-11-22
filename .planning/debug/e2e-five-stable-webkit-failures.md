---
status: awaiting_human_verify
trigger: "5 stable e2e failures from the 12.1 final gate (2026-11-19, full suite on branch gsd/phase-12-consent-analytics-legal): (1) iPhone @dialog-fit \"a click on the dark area above the sheet closes it\", (2) iPhone @dialog-fit \"a right press on the dark area above the sheet keeps it open\", (3) iPhone and (4) WebKit @shell full bleed admin at 390x844 (/admin/sessions is 1187 px tall in an 845 px window: \"a short page needs no scroll\"), (5) iPhone @site-content-business at 320 px. Question: did Phase 12/12.1 cause them? Start by running the same tests at commit f579e158 (before 12.1) and on the current branch head. Context: STATE.md line ~1110 \"12.1 final gate\". PR #28 is open and watched; fixes go on this branch."
created: 2026-11-21T17:15:00-06:00
updated: 2026-11-21T18:44:00-06:00
---

# Debug: five stable iPhone and WebKit e2e failures

*Created: 2026-11-21T17:15:00-06:00 · Updated: 2026-11-21T20:45:00-06:00*

## Symptoms

- **Expected:** the five tests pass in the iPhone and WebKit Playwright projects, as they do in Chromium and Pixel.
- **Actual:** they fail every time in the full suite and when run alone, spec by spec, per project:
  1. iPhone `@dialog-fit` "a click on the dark area above the sheet closes it"
  2. iPhone `@dialog-fit` "a right press on the dark area above the sheet keeps it open"
  3. iPhone `@shell` full bleed admin at 390x844: `/admin/sessions` is 1187 px tall in an 845 px window ("a short page needs no scroll")
  4. WebKit, the same `@shell` test
  5. iPhone `@site-content-business` at 320 px
- **Errors:** the assertion messages above. Exact output is to be captured on the first run.
- **Timeline:** first seen in the first full e2e run of Phase 12.1 (2026-11-19, 2533 tests, 2.1 h). No Phase 12.1 commit touched these pages or the admin layout, but this is not proved. Earlier full runs may not have included these projects or specs.
- **Repro:** `npm --prefix web run e2e` with the tag and project filters for each test. Compare commit f579e158 (before 12.1, "docs(12.1): create phase plan") with the branch head.

## Current Focus

- bug_class: Bohrbug in test code that only shows under timing and load (the same test passes or fails by CPU load: a race, not a deterministic fault). Heisenbug-like in the full suite, reproducible on demand with throttling or a delayed answer.
- next_action: wait for the owner to confirm the fix in the real workflow (re-run the full e2e suite), then archive the session.
- reasoning_checkpoint (written after the fixes were applied; the evidence above came first):
  - hypothesis: "None of the five is a Phase 12 or 12.1 regression. They are three timing races in the e2e tests. (1) `openDeleteOrder` waits 5 s for the showcase h1, which takes about 4 s on a quiet machine and 6 to 10 s under load in WebKit-based engines. (2) `@shell full bleed admin` reads the page height before the device list has loaded, while a taller loading skeleton is still showing. (3) `signInAs` returns while the sign-in layout's empty main still stands in for the admin shell, so `openSiteContent`'s non-waiting `menu.isVisible()` picks the wrong navigation on a phone and hangs."
  - confirming_evidence:
    - "Same results at 1717d7e2 (before Phase 12), f579e158 (before 12.1) and head: WebKit shell fails each time, @site-content-business 320 px hung at 1717d7e2 in WebKit and iPhone."
    - "Probe: Chromium and WebKit both read 1187/1188 px right after the h1, 844 px 2 s later; the extra height was the skeleton table."
    - "Trace of a hung run: isVisible returned false 27 ms after setViewportSize with the sign-in layout and an empty main in the snapshot; no top bar."
    - "Showcase h1 time on a quiet machine: 3.7 to 4.4 s in WebKit and iPhone at head, 3.8 to 5.9 s at 1717d7e2; 6 to 10 s while other sessions loaded the machine."
  - falsification_test: "If the fixes were not the cause, the unfixed tests would still pass under the synthetic delay/throttle, and the fixed ones would still fail. Result: unfixed red (shell 4 of 4, sign-in 8 of 10), fixed green (shell 12 of 12, sign-in 10 of 10, site-content-business 12 of 12)."
  - fix_rationale: "Each fix makes the test wait for the thing it measures: the list's loaded status, the admin top bar, and the showcase h1 with the 20 to 30 s other specs already use. No app code changes, no assertion weakened, no wait replaced by a fixed sleep."
  - blind_spots: "The showcase h1 wait only moves the limit; a much heavier showcase could exceed 30 s again. The same `if (await menu.isVisible())` copy in five other specs is covered by the `signInAs` fix, not changed itself. The Firefox font-line flakes (STATE.md item 2) were not examined."
  - candidate_causes:
    - "code (app): Phase 12 or 12.1 changed layout or the admin pages. Ruled out: same results before Phase 12."
    - "code (test): races in test helpers and specs. Confirmed."
    - "environment: machine load and engine speed (WebKit ~4x slower than Chromium on the showcase). Confirmed as the trigger that makes the races visible."
    - "data: more sessions in the list making the page taller. Ruled out: the snapshot shows one row, and the height was the skeleton."
  - and_gate: "Yes, in each case two conditions together: a test that does not wait for its precondition AND a slow engine or loaded machine. Either alone is harmless, so the fix removes the first."

## Evidence

- timestamp: 2026-11-21T17:40:00-06:00
  checked: the 14 tests matching the five names, `--project iphone --project webkit`, at branch head f9cdd18a with the default 4 workers (`npm run e2e`, DB reseeded, bundle rebuilt).
  found: WebKit `@shell full bleed admin at 390x844` FAILED (1187 vs 845). iPhone `@dialog-fit` right press FAILED ("h1 Component Showcase not found" in 5 s, but the failure page snapshot shows the h1 present, so the page was only slow). iPhone `@site-content-business` 320 px HUNG the full 8 min waiting for `aside nav[aria-label="Admin"]` Site Content link (the snapshot shows the phone layout with "Open navigation" visible). iPhone `@dialog-fit` click PASSED. iPhone `@shell` PASSED.
  implication: the five are not five identical stable failures. At least two (iPhone click, iPhone shell) pass at head in this run.
- timestamp: 2026-11-21T17:55:00-06:00
  checked: the same 14 tests at commit f579e158 (before 12.1) in a separate worktree `.claude/worktrees/dbg-f579` (`npm ci`, `npm run e2e -- --project iphone --project webkit --workers=1 --timeout=90000 --grep ...`, DB reseeded at that commit).
  found: WebKit `@shell full bleed admin at 390x844` FAILED with the same text (1187 vs 845). iPhone `@dialog-fit` right press FAILED with the same text (h1 not found within 5 s). iPhone `@dialog-fit` click, iPhone `@shell` and iPhone `@site-content-business` 320 px all PASSED.
  implication: the WebKit shell failure and the iPhone right-press failure already exist at f579e158, so Phase 12.1 did not cause them.
- timestamp: 2026-11-21T18:10:00-06:00
  checked: the identical command (`--project iphone --project webkit --workers=1 --timeout=90000 --grep ...`, reseeded DB) at branch head f9cdd18a.
  found: the same result as f579e158: WebKit `@shell` FAILED (1187 vs 845), iPhone right press FAILED (h1 not found in 5 s); iPhone click, iPhone `@shell`, iPhone `@site-content-business` and both WebKit `@site-content-business` PASSED. Output kept in the scratchpad (head-run2.txt, old-run1.txt).
  implication: head and f579e158 behave the same for these tests. Phase 12.1 did not change them.
- timestamp: 2026-11-21T18:20:00-06:00
  checked: a throwaway probe spec (deleted later) that reads `/admin/sessions` geometry at 390x844 right after the h1 shows, then again 2 s later, in Chromium, WebKit and iPhone.
  found: Chromium AND WebKit read 1188/1187 px at the first reading and 844 px two seconds later. At the first reading the Signed-in devices table is still its loading skeleton (`animate-csp-shimmer` placeholder rows, table 815 px tall); the loaded page, with one real row, is exactly the window tall. iPhone happened to read 844 (list already loaded).
  implication: `@shell full bleed admin` reads the height before the list has loaded. It is a race in the test (`openAt` waits only for the h1 and the fonts). WebKit is simply slower to load the list, so it loses the race every time. Not an engine layout bug.
- timestamp: 2026-11-21T18:25:00-06:00
  checked: a throwaway probe that times `goto('/dev/components')` to the h1 being attached, 4 loads each, one worker, nothing else of this project running.
  found (first measurement, taken while other sessions of this machine were building and testing): Chromium 1.7 to 2.0 s. WebKit 6.9 to 8.7 s. iPhone 5.9 to 10.0 s. CORRECTED later, quiet machine, back to back (see the 19:50 entry): about 4 s. `sweep.ts` already gives the showcase h1 30 s ("a loaded phone engine takes longer than the 5 s default"), `shell.spec.ts` and `auth-overflow.spec.ts` 20 s, `order-photos-a11y.spec.ts` 60 s, `showcase.spec.ts` FIRST_PAINT. Three sites still use the 5 s default: `e2e/deleteOrderDialog.ts` (openDeleteOrder, used by the failing dialog-fit tests), `e2e/motion.spec.ts:40`, `e2e/keyboard.spec.ts:46`.
  implication: the dialog-fit failures are the same h1 wait problem that commit 275974df fixed for other specs; `openDeleteOrder` was missed. The iPhone click test passing at some runs and failing at others (run 3 below) fits a wait that is only a few seconds under the page's real load time.
- timestamp: 2026-11-21T18:35:00-06:00
  checked: the same 14 tests at head with 4 workers, 60 s cap, while other sessions of this machine ran lint, build and dotnet tests (run 3).
  found: results SHUFFLED: iPhone click FAILED and iPhone right press FAILED (h1 timeouts), but WebKit `@shell` PASSED (22 s) and iPhone `@site-content-business` PASSED (23 s). Earlier run 1 (4 workers) had iPhone click and WebKit `@shell` the other way round.
  implication: none of the five is a fixed failure of one engine. Each depends on timing and machine load. "Stable" in the STATE.md note describes the owner's loaded full-suite environment, not a deterministic fault.

- timestamp: 2026-11-21T19:05:00-06:00
  checked: the hung iPhone `@site-content-business` 320 px run (reproduced 2 of the first 3 runs with `--workers=3 --repeat-each=15` at head, while other sessions ran lint and builds). Read the Playwright trace (action log, DOM snapshots, screencast).
  found: `Page.setViewportSize` ended at t=42268 ms and `Frame.isVisible("Open navigation")` ran at t=42295 and returned `false`; the next call, `click` on `aside nav[aria-label="Admin"]` Site Content, then waited until the 480 s test timeout. The DOM snapshot at the isVisible call is the sign-in layout (`grid min-h-dvh`) with an EMPTY `<main id="main">`: no top bar, no admin shell yet. The URL was already `/admin`. The network log shows about 40 lazy script files (admin shell, dashboard) loading for 1.4 s after the verify answer.
  implication: `signInAs` returns once the URL matches and `getByRole('main')` is visible, but the sign-in layout's own empty main satisfies that for a moment after the address changes (its docstring says "resolves when the admin shell is showing"). The spec's `openSiteContent` then calls the non-waiting `menu.isVisible()`, gets `false` because the shell is not drawn yet, takes the sidebar branch, and on a phone the sidebar link never shows: a hang. This test is the one that loses the race because nothing sits between `signInAs` and the check (the other tests in the spec take the content lock and seed first). Load dependent, so the owner's loaded full run saw it every time. The same `if (await menu.isVisible())` pattern is in settings, site-content-gallery, -hours, -products and -testimonials specs; they are protected by the same `signInAs` fix.
- timestamp: 2026-11-21T19:30:00-06:00
  checked: TDD for each cause. (a) New `@auth signing in returns only once the admin shell is on screen, even on a slow phone` (Chromium CDP CPU throttle 8x from the verify answer; Chromium and Pixel). (b) `@shell full bleed admin` with the device list answering 1.5 s late. (c) the iPhone `@dialog-fit` tests alone.
  found: RED before the fixes: (a) 8 of 10 runs failed "the top bar is already on screen" (a first version with a 20x throttle failed 5 of 6; with the fix, 5 of 6 passed because the URL step itself then exceeded 5 s, so the rate was lowered to 8). (b) 4 of 4 engines failed at 390x844 (1187 or 1188 vs 845). (c) iPhone right press failed in every run of runs 1, 2, 3 and at both commits. GREEN after the fixes: (a) 10 of 10 (Chromium and Pixel, 3 workers). (b) 12 of 12 across Chromium, WebKit, iPhone, Pixel x3, plus the 1440x900 cases. (c) `dialog-fit`, `motion`, `keyboard` specs on iPhone and WebKit with 4 workers: 53 passed, 18 skipped (not for that project), 1 failed (a different test, see below). iPhone `@site-content-business` 320 px: 12 of 12 passed with 3 workers (before the fix it hung in 2 of the first 3).
  implication: the three causes are confirmed and fixed. All fixes are in e2e test code only (`auth.ts`, `shell.spec.ts`, `deleteOrderDialog.ts`, `motion.spec.ts`, `keyboard.spec.ts`, plus the new test in `auth.spec.ts`). No app code, wording or layout changed.
- timestamp: 2026-11-21T19:40:00-06:00
  checked: the one failure in the green run, WebKit `@motion user menu: desktop ...` (chevron transform "none" after `waitForTimeout(350)`), rerun alone 4 times with the fixes in place.
  found: 4 of 4 passed alone.
  implication: a separate, load dependent flake (a fixed 350 ms wait for a 0.2 s transition). Not one of the five and not caused by these changes. Left alone; reported.

- timestamp: 2026-11-21T19:50:00-06:00
  checked: baseline at 1717d7e2 (the commit before Phase 12), same five tests, `--workers=1 --timeout=90000`, DB reseeded at that commit, in the worktree. Then the showcase h1 timing probe at 1717d7e2 and at head, back to back on a quiet machine (nothing else of the preflight list running), 5 loads each.
  found: 1717d7e2: WebKit `@shell full bleed` FAILED; WebKit and iPhone `@site-content-business` 320 px both HUNG 8 min; iPhone click, right press and `@shell` PASSED. Showcase h1 at 1717d7e2: Chromium 0.8 to 0.9 s, WebKit 3.9 to 5.9 s, iPhone 3.8 to 4.5 s. At head: Chromium 0.9 to 1.2 s, WebKit 3.8 to 4.4 s, iPhone 3.7 to 3.8 s.
  implication: four of the five failure patterns already exist before Phase 12 (WebKit shell, both site-content-business hangs). The iPhone right press passes before Phase 12 only because the showcase sits just under the 5 s limit on a quiet machine (about 4 s), and the earlier slow readings (6 to 10 s) were machine load, not Phase 12: head is not slower than 1717d7e2. Phase 12 did add showcase demos (cookie bar, Cookie Settings, Visitor Stats states), so the margin is a little smaller, but it is not the cause.

## Eliminated

- hypothesis: Phase 12 or Phase 12.1 changed the layout or the admin pages and so broke these tests.
  evidence: the same tests give the same results at f579e158 and at head, and the causes are in test code and timing, not in the app (see Evidence). The pre-Phase-12 baseline at 1717d7e2 (19:50 entry) shows the same failures.
  timestamp: 2026-11-21T19:45:00-06:00
- hypothesis: WebKit lays the short admin page out taller than the window (an engine layout bug).
  evidence: the probe read 1188 px in Chromium too at the first reading, and 844 px in WebKit two seconds later. The extra height was the loading skeleton.
  timestamp: 2026-11-21T18:20:00-06:00
- hypothesis: the `@dialog-fit` click and `@shell` iPhone failures are stable.
  evidence: both passed at head and at f579e158 alone, and failed or passed differently from run to run under load.
  timestamp: 2026-11-21T18:35:00-06:00

## Resolution

root_cause: "Three timing races in the e2e test code, shown by slow engines and a busy machine. Not caused by Phase 12 or 12.1 (same results at 1717d7e2 and f579e158). (1) `signInAs` treated the sign-in layout's empty main as the admin shell, so `openSiteContent`'s non-waiting `menu.isVisible()` chose the wrong navigation on a phone and hung for 8 minutes (iPhone @site-content-business 320 px). (2) `@shell full bleed admin` read the page height while the Signed-in devices list was still a loading skeleton (about 1190 px), before the list loaded (WebKit; iPhone under load). (3) `openDeleteOrder` waited the default 5 s for the showcase h1, which takes about 4 s on a quiet machine and 6 to 10 s under load in WebKit-based engines (iPhone @dialog-fit click and right press)."
fix: "e2e test code only. `web/e2e/auth.ts`: `signInAs` also waits for the admin top bar (searchbox named Search). `web/e2e/shell.spec.ts`: the full bleed test waits for the 'Signed-in devices loaded.' status and makes the list answer 1.5 s late so every engine proves the wait. `web/e2e/deleteOrderDialog.ts` and `web/e2e/motion.spec.ts`: the showcase h1 wait is 30 s. `web/e2e/keyboard.spec.ts`: 20 s. New test in `web/e2e/auth.spec.ts` (@auth signing in returns only once the admin shell is on screen, even on a slow phone). `docs/web/e2e.md`: the @auth row. Commit 7efb2535 on gsd/phase-12-consent-analytics-legal, not pushed."
verification:
  oracle_type: derived (the page's own loaded status, the top bar's presence and the h1 are the contract; the tests are not "no crash" checks)
  target_test: { result: pass, detail: "the original five at head, official path, 4 workers, repeated twice: 24 passed, 4 skipped (device-only on WebKit), 0 failed" }
  mutation_check: { result: skipped, reason_if_skipped: "no Stryker for e2e specs; done by hand instead", mutant_killed: "removing the signInAs top bar wait: the new test failed 8 of 10 runs (Chromium and Pixel, throttle 8x); with the wait 10 of 10 passed" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false, detail: "diff is 47 additions, 5 changed lines, no assertion removed or weakened; the existing main check in signInAs stays" }
  adjacent_tests: { result: pass, suites_run: ["shell, auth, sessions, settings, site-content-business, -hours, -gallery, admin-keyboard, session-menu, profile on chromium, webkit, iphone: 199 passed, 2 skipped (the Chromium-only new test), 0 failed", "dialog-fit, motion, keyboard on iphone and webkit: 53 passed, 18 skipped, 1 failed (WebKit @motion user menu chevron, fixed 350 ms wait, passes 4 of 4 alone, unrelated)"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, detail: "signInAs: revert gives 8 of 10 red, reapply 10 of 10 green. shell: before the wait 4 of 4 engines read 1187/1188 px, after 12 of 12 green. site-content-business: before the fix 2 of the first 3 runs hung for 8 minutes with 3 workers (and at 1717d7e2 both WebKit and iPhone hung), after the fix 12 of 12 passed with 3 workers. dialog-fit: the iPhone right press failed in 6 of 6 earlier runs at f579e158 and head, and passes 2 of 2 in the final run with 4 workers." }
  guardrail_verdict: accepted
files_changed: [web/e2e/auth.ts, web/e2e/auth.spec.ts, web/e2e/shell.spec.ts, web/e2e/deleteOrderDialog.ts, web/e2e/motion.spec.ts, web/e2e/keyboard.spec.ts, docs/web/e2e.md]
other_findings:
  - "WebKit @motion user menu: desktop (chevron transform none after a fixed 350 ms wait) failed once under 4 workers, passes 4 of 4 alone. A separate load flake; not fixed."
  - "The Firefox font-line flakes (STATE.md item 2) were not examined here."
  - "The same `if (await menu.isVisible())` copy exists in settings, site-content-gallery, -hours, -products and -testimonials specs. They now start from a signInAs that has the top bar, so they are covered; they are not rewritten."
  - "App observation, not a bug and not changed: on a phone the Signed-in devices skeleton is about 815 px tall while the loaded page with one device is about 40 px of content. The page jumps shorter when the list loads. Whether that matters is the owner's call (design)."
  - "The file .planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-CONTEXT.md shows as modified in the working tree. It was not changed by this session and was not staged."

## Rules for this session

- Run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199` before any e2e run; wait if another project is busy. Never kill a process you did not start, and leave no background shell running.
- Never run a command that reads stdin.
- Only `CSPS_*` databases (`CSPS_E2E` for e2e). Never touch `BetsLLC_*`.
- Fixes are test-first and go on branch `gsd/phase-12-consent-analytics-legal` (PR #28). Stage files by path, run gitleaks on the staged change before each commit.
- Any change to behavior, scope or wording goes to the owner first.

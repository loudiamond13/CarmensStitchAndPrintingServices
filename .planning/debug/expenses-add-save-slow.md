---
status: resolved
trigger: "Playwright @expenses-add (web/e2e/expenses.spec.ts) times out at 150 s on [webkit] and [iphone] in a full `npm --prefix web run e2e -- --grep \"@expenses|@settings\"` run; the snapshot shows the Save button at \"Saving\". Alone it passes but takes about 2 minutes. Find the real root cause before changing anything."
goal: find_and_fix
created: 2026-10-26T01:10:00-05:00
updated: 2026-10-26T05:52:00-05:00
---

# Debug: @expenses-add save is slow

## Current Focus

known_pattern_candidate: none
bug_class: Bohrbug (repeatable: about 25 s per page-level axe run on WebKit every time the Add Expense dialog is open; the 150 s timeout is that cost plus 4-worker load)
hypothesis: CONFIRMED (see reasoning_checkpoint).
test: done (red and green self-test, two mutants, alone run, full @expenses|@settings run, web verify).
expecting: n/a
next_action: Owner confirms (away mode: parked for review). After that, move this file to resolved/ and add the knowledge-base entry with the Prevention block.

reasoning_checkpoint:
  hypothesis: "Each page-level axe run with the Add Expense dialog open takes about 25 s on WebKit because the dialog's Paid by picker holds about 2,300 options (every signed-in staff member the shared CSPS_E2E database has collected), and @axe-core/playwright's default partial run serializes every result node, passes included, with a unique CSS selector, xpath and ancestry. That work grows faster than the node count and WebKit is about 7 times slower at it than Chromium. The test runs three such checks before it saves, so it needs about 90 s alone and crosses 150 s under load."
  confirming_evidence:
    - "Trace of the alone webkit run: the three axe runPartial evaluates take 24.7, 23.9 and 23.3 s; the save and every other step are under 1.4 s."
    - "Removing all but two Paid by options drops the WebKit axe run from 26.1 s to 1.0 s (in-page runPartial 24.1 s to 0.16 s); the largest rule result is nested-interactive with 2,310 passing nodes, one per option."
    - "axe's own performanceTimer puts all rules at under 0.9 s: the time is in result serialization, not in the checks."
    - "Same page, WebKit: default 25.8 s; resultTypes alone (partial mode still serializes every node) 26.4 s; legacy mode alone (the reporter serializes every node) 24.0 s; legacy mode plus resultTypes ['violations'] 0.74 s. Chromium: 3.7 s to 0.6 s."
    - "With an unlabelled image added to the dialog, both the default builder and legacy plus resultTypes report exactly image-alt[img]."
  falsification_test: "If the fixed helper still took more than a few seconds on WebKit with 2,300 options, or missed a violation the default builder reports, the hypothesis or the fix would be wrong."
  fix_rationale: "The helper only reads violations. Telling axe to keep full detail for violations only (resultTypes ['violations']) and to aggregate in the page (setLegacyMode, so the trimming happens before serialization) removes the per-passing-node selector work, which is the cost that grows with the data. Every rule still runs on every node, and violations keep their full targets."
  blind_spots: "Legacy mode does not test cross-origin iframes (the app has none; the strict CSP blocks them). The roster growth itself is left as is: the picker still renders every e2e staff member, now at linear cost only (rules under 1 s at 2,300 options)."
  candidate_causes:
    - "code (test helper): expectNoAxeViolations and the two sweep helpers use AxeBuilder's default partial run, which serializes every passing node"
    - "data: CSPS_E2E keeps every e2e staff member (2,476 users, about 2,300 signed in and listed as payers; 213 to 911 more per day of e2e work), so the picker grows with every local run (CI starts empty)"
    - "environment: Playwright WebKit on Windows runs the serialization about 7 times slower than Chromium; 4 workers plus the WebKit expenses sweep add load"
    - "code (test design): @expenses-add runs three page-level axe checks while the dialog is open"
    - "code (server): eliminated, every create answered in under 0.5 s"
  and_gate: "yes: the timeout needs the large picker (data) AND the per-node serialization (helper) AND WebKit's slower engine; load only pushes 90 s past 150 s. Removing the per-node serialization breaks the chain for every page and every engine without touching data or the checks."

## Symptoms

expected: The @expenses-add test saves the new expense in a second or two and finishes well inside its 150 s limit on all five projects.
actual: In the full `@expenses|@settings` run (4 workers) it hit 150 s on [webkit] and [iphone] with the Save button stuck at "Saving". Alone it passes on both, but takes 1.9 and 2.0 minutes.
errors: Playwright test timeout of 150000ms exceeded; page snapshot shows the Save Expense button labelled "Saving".
reproduction: `npm --prefix web run e2e -- --grep "@expenses|@settings"` (full run), or `--grep "@expenses-add" --project=webkit` alone for the slow pass.
started: Recorded in the review fix pass of 2026-10-26 (deferred-items.md, last row).

## Eliminated

- hypothesis: The create request is slow on the server (A-WR-01 extra read, IdempotencyGate claim or lease wait, DatabaseLocks contention between parallel workers on CSPS_E2E, a held transaction).
  evidence: Every logged POST /api/v1/company-expenses answered in under 0.5 s; in the 2-minute alone run the host was idle for 106 s before the POST arrived and answered it in 410 ms and 17.6 ms.
  timestamp: 2026-10-26T01:18:00-05:00

- hypothesis: A WebKit client issue holds the request (never sent, or waiting on a lock or refresh before sending).
  evidence: The full run logs one POST per project, including both WebKit ones, each answered in under 0.2 s; the trace shows Enter in Description followed by the dialog closing within 1.3 s.
  timestamp: 2026-10-26T01:20:00-05:00

- hypothesis: The list behind the dialog (size=100, 100 rows) makes axe slow.
  evidence: WebKit axe with the dialog open is 32.2 s at 100 rows and 32.4 s at 10 rows; without the dialog it is 4.3 s and 1.3 s.
  timestamp: 2026-10-26T01:26:00-05:00

## Evidence

- timestamp: 2026-10-26T01:12:00-05:00
  checked: knowledge base (.planning/debug/knowledge-base.md) and MemPalace
  found: No knowledge-base.md exists; MemPalace is not available in this session. Closest prior session is expense-list-command-count-flake (a test-rig counting issue), not this symptom.
  implication: No known-pattern candidate.

- timestamp: 2026-10-26T01:15:00-05:00
  checked: E2E host request log src/Csps.Server/logs/csps-20261025_004.json, csps-20261026.json (every non-GET /api/v1/company-expenses)
  found: All 18 page POSTs to /api/v1/company-expenses answered 201 in 9.6 to 472 ms. Only @expenses-add POSTs to that exact path from the page (other specs seed through /api/testing/expenses or use PUT and sub-routes). The full run (host start 05:36:21Z) logs exactly 5 such POSTs, one per project, answered in 171, 14, 51, 15 and 15 ms. So the two WebKit tests did send their save and it answered at once; the request simply went out at the very end of their 150 s.
  implication: The server never held a create for minutes. Lock waits, a stale 2-minute claim lease or a held transaction would show as a POST with a long Elapsed; there is none. The "Saving" snapshot is the timeout landing during a save that started too late.

- timestamp: 2026-10-26T01:18:00-05:00
  checked: Alone re-run timeline (host start 06:06:46Z, webkit and iphone in parallel), every API request in order
  found: Sign-in, list, KPIs and GET /api/v1/staff (the dialog opening) all finish by 06:06:53.97Z. Then the host gets no request at all for 106 s. The POSTs arrive at 06:08:39.95Z (410 ms) and 06:08:42.25Z (17.6 ms); the list re-reads follow within 2 s and the host goes quiet.
  implication: The 2 minutes are spent in the browser and test between the dialog opening and Enter in Description, not on the server.

- timestamp: 2026-10-26T01:22:00-05:00
  checked: `npm --prefix web run e2e -- --grep "@expenses-add" --project webkit --trace on` (passed, 1.5m), action durations from the trace's test.trace
  found: Three steps take 24.7 s, 23.9 s and 23.3 s: each is `AxeBuilder.runPartialRecursive` (node_modules/@axe-core/playwright/dist/index.mjs:283, the axe.runPartial evaluate) inside the three expectNoAxeViolations calls made while the Add Expense dialog is open (spec lines 484, 490, 512). The fourth axe call (line 531, dialog closed, list filtered to 1 row) is under 0.3 s. Every other step is under 1.4 s.
  implication: About 72 of the 90 s are page-level axe runs with the dialog open.

- timestamp: 2026-10-26T01:26:00-05:00
  checked: Temporary diagnostic spec (web/e2e/zz-diag-axe.spec.ts, deleted before commit), chromium and webkit, axe timed on /admin/expenses at size 100 and 10, with and without the Add Expense dialog
  found: chromium: 100 rows no dialog 4.3 s, dialog open 5.6 s; 10 rows no dialog 1.0 s, dialog open 3.3 s. webkit: 100 rows no dialog 4.3 s, dialog open 32.2 s; 10 rows no dialog 1.3 s, dialog open 32.4 s. Opening the dialog adds about 2,370 elements. axe's performanceTimer puts the rules at under 0.9 s in total.
  implication: The open dialog, not the row count, makes WebKit slow, and the time sits outside the rules.

- timestamp: 2026-10-26T01:30:00-05:00
  checked: Same diagnostic: dialog contents, then all but two Paid by options removed; in-page axe.runPartial timing and the largest rule results
  found: The Paid by select holds 2,288 options (Category 19). WebKit axe 26.1 s with them, 1.0 s with two; in-page runPartial 24.1 s vs 0.16 s; JSON size 1.56 MB vs 0.18 MB. nested-interactive has 2,310 nodes (one per option) against 24 with two options. Chromium: 3.8 s vs 0.56 s.
  implication: The options are the cost. Each one becomes a passing result node that axe serializes.

- timestamp: 2026-10-26T01:31:00-05:00
  checked: CSPS_E2E AspNetUsers (read-only sqlcmd), grouped by creation day (-05:00)
  found: 2026-10-18 556 created (501 active), 10-19 796 (751), 10-25 911 (879), 10-26 213 (209): 2,476 users. GET /api/v1/staff lists every active, unlocked, undeleted staff member who has signed in, and every e2e test signs its fresh staff in. About 114 createStaff call sites times 5 projects add hundreds per full run.
  implication: The picker grows with every local e2e run and the test gets slower each time; CI starts from an empty container, so it never sees this.

- timestamp: 2026-10-26T01:33:00-05:00
  checked: axe-core 4.13.0 source (node_modules/axe-core/axe.js): runPartial, nodeSerializer.mapRawResults, DqElement.toJSON, processAggregate
  found: runPartial calls mapRawResults on every rule's nodes, and DqElement.toJSON computes selector, xpath and ancestry for each. resultTypes trimming happens only in processAggregate (the reporter), which partial mode runs after serialization in finishRun. In legacy mode (axe.run in the page) the reporter trims non-requested result types to one node before it serializes.
  implication: Only legacy mode plus resultTypes ['violations'] skips the per-passing-node serialization.

- timestamp: 2026-10-26T01:37:00-05:00
  checked: Diagnostic, the same dialog (2,308 options) with four AxeBuilder variants, then with an unlabelled image added to the dialog
  found: WebKit: default 25.8 s, resultTypes only 26.4 s, legacy only 24.0 s, legacy plus resultTypes 0.74 s. Chromium: 3.7, 3.9, 2.0 and 0.6 s. With the image, default and legacy plus resultTypes both report `image-alt[img]` (WebKit 25.5 s vs 0.70 s).
  implication: The fix is legacy mode plus resultTypes ['violations'] in the shared helper: about 35 times faster on WebKit with the same violations.

- timestamp: 2026-10-26T01:38:00-05:00
  checked: The GET /api/v1/staff 500 at 05:36:48Z in the full run's log
  found: TaskCanceledException in StaffDirectory.ListActiveStaffAsync: the browser aborted the request (a dialog closed or the page moved on) and request logging recorded it as a 500. No test saw a 500.
  implication: Unrelated to this symptom. Noted only.

- timestamp: 2026-10-26T01:39:00-05:00
  checked: @axe-core/playwright 4.13.0 AxeBuilder.options()
  found: options() replaces the whole option object, so in the diagnostic the "resultTypes" and "legacy plus resultTypes" variants ran every axe rule, not just the A11Y-01 tags. The fast variant was fast even with more rules. The fix calls options() before withTags().
  implication: The measured gain is a lower bound; the tag set is kept in the fix.

- timestamp: 2026-10-26T01:41:00-05:00
  checked: RED, new self-test `@fixture the axe check takes seconds, not minutes, on a page with thousands of passing nodes` (web/e2e/fixture-selftest.spec.ts: a labelled select of 3,000 options on the home page, budget 10 s), before the fix
  found: chromium ok (8.1s test), firefox ok (8.7s test), webkit FAILED: `expect(received).toBeLessThan(expected) Expected: < 10000 Received: 54809`.
  implication: The test reproduces the slow check in WebKit without any data in CSPS_E2E.

- timestamp: 2026-10-26T01:43:00-05:00
  checked: GREEN, `npm --prefix web run e2e -- --grep "@fixture" --project chromium --project firefox --project webkit` after the fix (pageAxe: options({ resultTypes: ['violations'] }), withTags, setLegacyMode)
  found: 21 passed (19.8s). The new test takes 1.5 s (chromium), 1.7 s (firefox), 2.1 s (webkit) in total. `@fixture an unlabelled image fails the axe check` still passes in all three engines.
  implication: The check is fast and still catches a violation.

- timestamp: 2026-10-26T01:43:00-05:00
  checked: web/e2e/expenses-sweep.spec.ts axeWithin and axe-core's context parsing (normalizeContextSelector, parseSelectorArray)
  found: `axeWithin(page, ['[data-case^="expenses-"]', '[data-case^="settings-"]'])` passes both selectors as one include item. axe reads an array item as a frame path (the first selector picks iframes, the second runs inside them), so the expense case blocks were treated as frames, and AxeBuilder skipped them because they have no content frame. That call has checked nothing. The dialog call passes one selector and works.
  implication: A separate, pre-existing gap in the Phase 6 sweep, found while reading the code this fix touches.

- timestamp: 2026-10-26T01:46:00-05:00
  checked: RED then GREEN for the sweep gap. axeWithin now fails when axe checked nothing (results.passes is empty). Run `--grep "@expenses-sweep the Phase 6 showcase cases fit at 320 px in Blush" --project chromium` with the old include, then with one include per selector (`--grep "...fit at 320 px" --project chromium --project webkit`)
  found: Old include: `Error: axe checked nothing within [data-case^="expenses-"], [data-case^="settings-"] ... Expected: > 0 Received: 0`. One include per selector: 4 passed (chromium 21.8 s and 20.8 s, webkit 37.1 s and 29.9 s); no violations in the cases at 320 px in Blush and Espresso.
  implication: The showcase sweep now really checks the Phase 6 cases, and a selector that matches nothing fails instead of passing.

- timestamp: 2026-10-26T01:47:00-05:00
  checked: @expenses-add alone after the fix: `npm --prefix web run e2e -- --grep "@expenses-add" --project webkit --project iphone`
  found: `ok [iphone] (19.8s)`, `ok [webkit] (20.5s)`, `2 passed (28.2s)`. Before: 1.9 and 2.0 minutes.
  implication: About 6 times faster alone, with the same three dialog axe checks and the same 2,300-option picker.

- timestamp: 2026-10-26T01:50:00-05:00
  checked: Mutation check at the fix site, webkit, the new self-test. Mutant 1: pageAxe without setLegacyMode (resultTypes kept). Mutant 2: pageAxe without resultTypes (legacy mode kept).
  found: Mutant 1 failed: `Expected: < 10000 Received: 50964`. Mutant 2 failed: `Expected: < 10000 Received: 50792`. Fix restored afterwards.
  implication: Both halves of the fix are needed and the self-test kills either mutant.

- timestamp: 2026-10-26T02:11:00-05:00
  checked: Full `npm --prefix web run e2e -- --grep "@expenses|@settings"` after preflight (all ports free, no other test processes), 01:52 to 02:11
  found: `140 passed (19.0m)`, exit 0. @expenses-add: chromium 17.7 s, firefox 24.7 s, webkit 35.5 s, pixel 17.8 s, iphone 30.0 s. Slow files: webkit expenses-sweep 11.0m (the failing run noted 17 min), iphone 10.4m, firefox 7.3m, chromium 5.2m, pixel 5.1m. Every showcase sweep test (now really checking the cases) passed.
  implication: The original failure is gone with a wide margin on every project.

- timestamp: 2026-10-26T02:18:00-05:00
  checked: `npm --prefix web run verify`
  found: exit 0. typecheck, `eslint . --max-warnings 0` and Prettier clean (after `prettier --write` on fixtures.ts and fixture-selftest.spec.ts); `Test Files 202 passed (202)`, `Tests 5959 passed (5959)`; build, budget build, license and notices checks passed.
  implication: The static gate is green. No production code changed, so the .NET gates do not apply.

## Resolution

root_cause: Each page-level axe check with the Add Expense dialog open took about 25 s on WebKit. The dialog's Paid by picker lists every signed-in staff member, and the shared CSPS_E2E database has collected about 2,300 of them (every e2e test signs in fresh staff), so the dialog holds about 2,300 options. @axe-core/playwright's default partial run serializes every result node, including every passing option, with a unique selector, xpath and ancestry; WebKit does that about 7 times slower than Chromium. @expenses-add runs three such checks before it saves, so it needed about 90 s alone and crossed its 150 s limit under the 4-worker run. The save itself always answered in under 0.5 s.
fix: Test side only, no production code. web/e2e/fixtures.ts gains pageAxe(page), the one axe runner for every e2e check: resultTypes ['violations'] (set before withTags, because options() replaces all options), the A11Y-01 tags and setLegacyMode, so axe trims the passing nodes in the page before it serializes anything. expectNoAxeViolations, sweep.ts axeFindings and the expenses sweep's axeWithin all use it. axeWithin also passes one include per selector (an array was read as an iframe path and checked nothing) and fails when axe checked nothing. New self-test in fixture-selftest.spec.ts holds the check under 10 s on a 3,000-option page in every engine. docs/web/e2e.md describes pageAxe and the new self-test. The @expenses-add test and its 150 s limit are unchanged.
oracle_type: specified (the A11Y-01 check must finish in seconds on a page with thousands of passing nodes; budget 10 s against 0.7 to 2 s measured after and 51 to 55 s before on WebKit). Boundary neighbors: the image-alt self-test proves violations still surface; mutants without legacy mode or without resultTypes both fail.
verification:
  - signal 1 (reproduction): RED on webkit before the fix (`Received: 54809` against `< 10000`); the original symptom reproduced as 1.5 to 2.0 min alone with 72 s in three axe calls.
  - signal 2 (green): new self-test passes in chromium, firefox and webkit (1.5 s, 1.7 s, 2.1 s); all 21 @fixture tests pass; @expenses-add alone webkit 20.5 s, iphone 19.8 s.
  - signal 3 (mutation at the fix site): without setLegacyMode 50,964 ms, without resultTypes 50,792 ms; both fail the self-test.
  - signal 4 (regression): full `@expenses|@settings` run 140 passed (19.0m); `npm --prefix web run verify` exit 0 (5959 tests).
  - signal 5 (diff shape): adds a shared runner and a self-test, keeps every rule on every node, removes no assertion; the only behavior change in the sweep makes a check that did nothing check the cases.
guardrail_verdict: accepted
files_changed: [web/e2e/fixtures.ts, web/e2e/sweep.ts, web/e2e/expenses-sweep.spec.ts, web/e2e/fixture-selftest.spec.ts, docs/web/e2e.md]
commits: a7ddcd76 (pageAxe runner and self-test), 39cc69e3 (axeWithin one include per selector)

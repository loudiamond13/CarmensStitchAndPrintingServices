---
phase: 14-hardening-release-readiness
plan: 05
subsystem: security
tags: [cwe-top-25, attack, security-review, doc-lint, no-unsafe-code, sec-05]
created: "2026-11-27T19:05:00-06:00"
updated: "2026-11-27T19:05:00-06:00"
requires: []
provides:
  - "docs/operations/security-review.md: the 25 entries of the MITRE CWE Top 25 (2025) in rank order and 20 ATT&CK techniques, each with a mitigation and the test files that prove it"
  - "SecurityReviewDocTests (12 tests): table shape, rank order, valid statuses, named test files exist, memory-safety rows cite NoUnsafeCodeTests.cs, phase record links resolve, check date, no private details"
  - "NoUnsafeCodeTests (36 cases): no unsafe keyword, no AllowUnsafeBlocks, no process start, no run-time code, no unsafe deserializer, outbound HTTP allow list, no string evaluation in browser code"
affects: [14-10, 14-25]
actuals:
  tokens: 10900
  tasks: 2
  commits: 2
plan_head_before: 20afc14d1aabb498f72cfc683c569b6ec2fef157
plan_head_after: b92ebc283ef6cf3c002cc6c888d20b134a14c14f
tech-stack:
  added: []
  patterns:
    - "Doc-lint with paired samples: table parsed by splitting on pipes, each detector paired with a sample it must catch"
    - "Code-only scanners: comment lines skipped, string literals and trailing comments cut before a banned word is searched"
key-files:
  created:
    - docs/operations/security-review.md
    - tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs
    - tests/Csps.ArchitectureTests/NoUnsafeCodeTests.cs
  modified: []
key-decisions:
  - "Phase 07.1 is linked as well as phases 01 to 13 and 12.1, because it has its own SECURITY.md"
  - "The doc test resolves a test file by its file name anywhere under tests, web/src, web/scripts and web/e2e; a cell with a path or no back-ticked name fails"
  - "CWE-476 stays Not applicable as the plan says, with BuildConfigTests.cs (nullable analysis on, warnings are errors) cited next to NoUnsafeCodeTests.cs"
requirements-completed: []
coverage:
  - id: D1
    description: "The review lists exactly the 25 CWE Top 25 (2025) entries in rank order, each Mitigated or Not applicable, each naming test files that exist"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs#TheCweTableListsTheTwentyFiveEntriesOfTheTwentyTwentyFiveListInRankOrder"
        status: pass
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs#EveryRowNamesTestFilesThatExist"
        status: pass
    human_judgment: false
  - id: D2
    description: "The seven memory-safety rows are Not applicable and rest on a test that fails on any unsafe keyword or AllowUnsafeBlocks setting"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/NoUnsafeCodeTests.cs#NoSourceFileUsesTheUnsafeKeyword"
        status: pass
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs#TheMemorySafetyRowsAreNotApplicableAndCiteTheNoUnsafeCodeTest"
        status: pass
    human_judgment: false
  - id: D3
    description: "The ATT&CK table covers the 20 required techniques once each, with ids and names read on attack.mitre.org on 2026-11-27, and links each earlier phase SECURITY.md"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs#TheAttackTableListsEachRequiredTechniqueExactlyOnce"
        status: pass
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs#EveryEarlierPhaseSecurityRecordIsLinkedAndTheLinkResolves"
        status: pass
    human_judgment: false
  - id: D4
    description: "The wording of each mitigation describes the real control (plain-English accuracy)"
    requirement: SEC-05
    verification: []
    human_judgment: true
    rationale: "A test proves the named files exist and the rows are present, not that the sentence describes the control well. The D-26 review pack reads it."
duration: 20min
completed: 2026-11-27
status: complete
---

# Phase 14 Plan 05: The CWE Top 25 and ATT&CK review is recorded, with a test for every mitigation Summary

**A public security review of the MITRE CWE Top 25 (2025) and 20 ATT&CK techniques, each row tied to test files that a doc test proves exist, plus scans that prove the code has no unsafe blocks, no process starts, no run-time code, no unsafe deserializers and only six allow-listed files that make outbound HTTP calls.**

## Performance

- **Duration:** about 20 min
- **Started:** 2026-11-27T18:49:35-06:00
- **Completed:** 2026-11-27T19:05:00-06:00
- **Tasks:** 2 (the tracer task and the ATT&CK task)
- **Files modified:** 3 created, 0 modified

## Accomplishments

- `docs/operations/security-review.md` has the 25 CWE rows in 2025 rank order (checked against cwe.mitre.org on 2026-11-27; no 2026 list exists yet, the 2026 archive page answers not found), the 20 ATT&CK rows (every id and name read on attack.mitre.org the same day), links to 15 per-phase SECURITY.md records and a "Checked on" section.
- `SecurityReviewDocTests` fails on a missing, extra, repeated or reordered CWE row, a bad status, a Tests cell with no file, a path instead of a file name, or a file that does not exist. It also checks the phase links, the check date, the timestamps and that no email, local path, connection string or LocalDB name is in the doc.
- `NoUnsafeCodeTests` proves the seven memory-safety rows and the rows that rest on "the app does not do that" (78, 94, 502, 918, 77).

## RED and GREEN evidence

**RED** (commit `d6457239`, doc missing): `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*SecurityReviewDocTests" --filter-class "*NoUnsafeCodeTests"` gave `total: 48, failed: 11, succeeded: 37`. All 11 failures were doc tests failing on `docs/operations/security-review.md is missing.` The 37 passing were the `NoUnsafeCodeTests` scans (they hold on today's code, as intended) and the scanner sample tests. Semantic assessment: the target tests ran, failed on the planned assertion (the doc must exist and have its tables), and were not a build or load fault.

**GREEN** (commit `b92ebc28`): same command, `total: 48, failed: 0, succeeded: 48`. Whole architecture project: `total: 338, failed: 0, succeeded: 338`. Build had zero warnings.

**Bite check:** with the doc temporarily changed (one test file renamed to a missing one, rank 25 changed to CWE-771), `SecurityReviewDocTests` failed on `EveryRowNamesTestFilesThatExist` and on the rank-order test (12 run, 2 failed). The doc was restored before the commit.

## Task Commits

1. **Task 1 and Task 2 tests (RED)** - `d6457239` (test)
2. **Task 1 and Task 2 review doc (GREEN)** - `b92ebc28` (feat)

**Plan metadata:** the docs commit that holds this SUMMARY.

## Files Created/Modified

- `docs/operations/security-review.md` - the review
- `tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs` - doc-lint
- `tests/Csps.ArchitectureTests/NoUnsafeCodeTests.cs` - code scans

## Decisions Made

- Phase 07.1 is linked too (the plan said 01 to 13 and 12.1, but 07.1 has its own SECURITY.md).
- The Tests column holds file names in back-ticks, and the doc test looks each one up by file name under `tests`, `web/src`, `web/scripts` and `web/e2e` (bin, obj and node_modules skipped).
- Commit attribution uses the harness trailer `Co-Authored-By: Claude Sonnet 5.5`. The orchestrator rules file said `Claude Opus 5.5`; earlier Phase 14 commits carry that name. The trailer is the only difference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added scans so rows 9, 10, 15, 22 and 23 have a test**
- **Found during:** Task 1 (reading the test tree for each CWE row)
- **Issue:** No test proved CWE-78, 94, 502, 918 or 77. The plan forbids a mitigation without a test, and says to add one if it fits inside the plan's files.
- **Fix:** Added scans inside `NoUnsafeCodeTests.cs`: no process start, no run-time code loading or building, no binary or type-name deserializer, an allow list of the six files that make outbound HTTP calls (Cloudinary store and setup, the breached-password lookup), and no `eval`, `new Function` or `document.write` in non-test web code. All pass on today's code.
- **Files modified:** `tests/Csps.ArchitectureTests/NoUnsafeCodeTests.cs`
- **Verification:** 48 of 48 pass, sample theories prove each scanner catches code and ignores comments and strings.
- **Committed in:** `d6457239`

**2. [Rule 1 - Accuracy] Softened claims I could not tie to a test**
- **Found during:** Task 2 (checking each sentence against the tests)
- **Issue:** First draft said access tokens are "checked against the session on use", forms "check the same rules in the browser", photos use "signed addresses", and profile lookups return 404 for another user. No named test proves those words.
- **Fix:** Reworded each to what the named tests show (replay of a used refresh token revokes the session; another user's session answers 404; fixed named sizes; profile calls act on the signed-in user).
- **Files modified:** `docs/operations/security-review.md`
- **Committed in:** `b92ebc28`

### Process notes

- The two tasks share one doc and one set of tests, so the RED commit holds the tests for both tasks and the GREEN commit holds the whole doc. There is one commit per phase of the cycle, not one per task.

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 1).
**Impact on plan:** No scope creep beyond the plan's own files. Five rows gained a real test instead of a gap.

## Issues Encountered

None. Every named test file existed on the first GREEN run.

## Known Stubs

None.

## Threat Flags

None. The doc names controls and test files only: no person, email, server, database host or account id (the doc test checks this and gitleaks found nothing).

## Gaps for the D-26 review pack (plan 14-10)

No row is left without a test. Two points for the owner to weigh:

- The doc test proves a named test file exists, not that it covers the row. The sentence quality is a human judgment (coverage item D4).
- Rows 6 and 21 rest on route-level tests. A future live-host scan (ZAP, plan 14-25) will add outside evidence, and plan 14-25 adds the Phase 14 rows.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 14-25 can add its rows (ZAP, worker cache, headers) to the same two tables; the doc test already accepts extra CWE-linked notes outside the tables but fails if the 25 CWE rows or the 20 ATT&CK rows change.

## Self-Check: PASSED

- FOUND: docs/operations/security-review.md
- FOUND: tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs
- FOUND: tests/Csps.ArchitectureTests/NoUnsafeCodeTests.cs
- FOUND: d6457239, b92ebc28 (both ancestors of HEAD)
- Acceptance: `^| 25 | CWE-770` 1, `NoUnsafeCodeTests.cs` 13, `T1505.003` 1, `13-SECURITY.md` 1 (all at least 1)
- Plan verification: SecurityReviewDocTests and NoUnsafeCodeTests pass (48 of 48)

---
*Phase: 14-hardening-release-readiness*
*Completed: 2026-11-27*

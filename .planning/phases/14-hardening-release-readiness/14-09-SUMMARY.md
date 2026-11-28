---
phase: 14-hardening-release-readiness
plan: 09
subsystem: accessibility
tags: [a11y, nvda, voiceover, manual-passes, a11y-05, runbook]
created: "2026-11-27T21:28:30-06:00"
updated: "2026-11-27T21:28:30-06:00"
status: complete
requires: []
provides:
  - "docs/operations/a11y-manual-passes.md: how to run, how to read a script, tools (NVDA as a hand-run tool), eight flow scripts (89 steps), a results table with one row per step, and the sign-off section"
  - "A11yManualRecordTests: 17 facts that keep the record's shape (flows, script tables, Pass/Fail/Not run, Fail needs an outcome, run steps need a date, Signed line format, no email, phone or local path)"
affects: [14-10, 14-26, 14-28]
actuals:
  tokens: 14800
  tasks: 2
  commits: 2
plan_head_before: 11e2ec7178e3d8749be26e454134aed9af3bcb78
plan_head_after: 5ff546520f5763aef11821d66650dd16bca38854
tech-stack:
  added: []
  patterns:
    - "Doc-lint test in the HostingRecordTests style: table parsing, paired-sample detectors, mutation-checked"
key-files:
  created:
    - docs/operations/a11y-manual-passes.md
    - tests/Csps.ArchitectureTests/A11yManualRecordTests.cs
  modified: []
key-decisions:
  - "No new owner ruling. Applied 14 D-08, D-09, D-10, D-22 and D-43 as ruled."
  - "Shape rule chosen by Claude, for the review pack: a signed record may hold a Not run result only when its Outcome says why (some steps cannot run on one device)."
requirements-completed: []
coverage:
  - id: D1
    description: "All eight critical flows have a step-by-step script (keys or gestures, what NVDA and VoiceOver should say) taken from the real labels, headings and messages in the code"
    requirement: A11Y-05
    verification:
      - kind: integration
        ref: "dotnet test --project tests/Csps.ArchitectureTests --filter-class *A11yManualRecordTests (ScriptsAllEightFlows, NoPlaceholderRemains, Flow6, Flow7, Flow8 facts)"
        status: pass
  - id: D2
    description: "Flow 1 scripts the update banner (read once, never takes focus, Reload after the top bar) and the offline screen (focus on the heading, failed retry read politely)"
    requirement: A11Y-05
    verification:
      - kind: integration
        ref: "Flow1CoversTheUpdateBannerAndTheOfflineScreen"
        status: pass
  - id: D3
    description: "The record says where each pass runs, that live test data is named TEST and deleted, the test quote request is marked Spam, audit entries stay, and NVDA is a hand-run tool and not a dependency"
    requirement: A11Y-05
    verification:
      - kind: integration
        ref: "HowToRunSaysWhereEachPassRunsAndHowTestDataIsHandled, ToolsNamesNvdaAsAHandRunToolWithVersionSlots, Flow4And5SayHowTheTestDataIsRemoved"
        status: pass
  - id: D4
    description: "The record cannot claim a pass that was not run: results are Pass, Fail or Not run, a Fail has an outcome, a run step has a date, a Signed line has one format, no email or phone"
    requirement: A11Y-05
    verification:
      - kind: integration
        ref: "ResultsRowsUseOnlyPassFailOrNotRun, SignedLineMatchesTheD22Format, ASignedRecordHasNoUnexplainedNotRun, HoldsNoEmailAddressPhoneNumberOrLocalPath; six bad records were tried and each one failed the matching fact"
        status: pass
  - id: D5
    description: "A person runs the scripts with NVDA and VoiceOver and records the results"
    requirement: A11Y-05
    verification:
      - kind: other
        ref: "not run here by design: Claude's keyboard pass is plan 14-26, the owner's NVDA and VoiceOver passes are plan 14-28"
        status: pending
---

# Phase 14 Plan 09: The keyboard and screen-reader scripts for the eight critical flows are written Summary

*Created: 2026-11-27T21:28:30-06:00 · Updated: 2026-11-27T21:28:30-06:00*

**One record holds the scripts for the eight flows, an empty results table with a row for every step, and the sign-off section. A test keeps its shape. No result is filled in.**

## What was built

- **`docs/operations/a11y-manual-passes.md`** has these sections in order: How to run the passes, How to read a script, Tools, Flow 1 to Flow 8, Results, Sign-off.
  - **How to run** says who does what (Claude: Keyboard column, plan 14-26; owner: NVDA and VoiceOver columns, plan 14-28), where each pass runs (NVDA on the PC against `CSPS_Dev` after the preflight, with the preflight command; VoiceOver on the iPhone against the live site), and the live test rules from 14 D-10: own account, `TEST` data deleted afterwards, the test quote request ends as Spam, audit entries stay.
  - **Tools** names NVDA as a separate free program the owner installs and runs by hand, a tool and not a project dependency (14 D-43). It has blank version slots to fill at run time.
  - **The eight flows** have 89 steps in all (17, 10, 8, 10, 8, 12, 11, 13). Each step has the keys for the PC, the gesture for the phone, and what NVDA and VoiceOver should say. The quoted words come from `authCopy.ts`, the order, payment, expense and quote request copy files, the public copy file, and the components (OtpInput boxes, Modal, ConfirmDialog, GalleryLightbox, QuoteStatusMenu, QuotePhotoPicker).
  - **Results** has one row per step with every cell "Not run". **Sign-off** says "Not signed yet" and how the owner signs (14 D-22).
- **`A11yManualRecordTests`** (17 facts): the five sections, eight flows with at least three steps and unique ids, no placeholder, one results row per script step in order, result values, Fail needs an Outcome, a step that was run needs a `yyyy-MM-dd` date, a not-run step has no date, the `Signed: owner, yyyy-MM-dd` line (a sample pair proves a wrong name and a wrong date format fail), a signed record holds no Not run without a reason, and detectors for an email address, a Philippine mobile number and a `C:/Users` path, each with a sample it must catch.

## Verification

- RED first, twice: Task 1 had 9 of 10 facts failing with "record is missing". Task 2 added 7 facts that failed on the placeholder rows.
- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*A11yManualRecordTests"`: total 17, succeeded 17, failed 0.
- Whole `Csps.ArchitectureTests` project: total 372, succeeded 372, failed 0, no warnings in the output.
- Six bad records were tried one at a time and each failed the right fact, then the real record was restored byte for byte: a Pass with no date, a Fail with no outcome, a wrong Signed line, a signed record with Not run cells, an email and a phone number, and a placeholder row.
- gitleaks on each staged change: no leaks. No em dash or en dash in the record.

## Deviations from Plan

None - plan executed exactly as written. Two small choices inside the plan's room: the test names a fifth section ("How to read a script") to reach the plan's "five top sections", and a signed record may keep a Not run result only when its Outcome says why.

## Things the owner should know before running the passes

- **Banner and offline screen are not built yet.** Steps 1.15 to 1.17 follow the UI design contract (W2 and W3). Plans 14-23 and 14-24 build them. The words must be checked against the built screens before plan 14-28. On the live site the banner only shows after a deploy, so VoiceOver may have to stay Not run on 1.15 with the reason written.
- **Some VoiceOver steps cannot run on a phone alone:** 7.5 (arrow keys need a keyboard) and 7.6 (the round buttons are hidden at phone width). The script says to leave them Not run with a reason.
- **The dev gallery is empty.** The dev seed adds no photos, so flow 7 on `CSPS_Dev` needs two or more shown orders with photos first (one with two or more photos).
- **Step 2.9 changes the owner's real password** when run on the live site.

## Items for the review pack (plan 14-10)

- **Spam against Converted (14 D-10).** A Converted quote request cannot be marked Spam or deleted. So the live VoiceOver pass in flow 8 stops before Save Order (Cancel), and the request ends as Spam. The full conversion is only run by NVDA on `CSPS_Dev`. Recommendation: keep it this way, because it leaves no undeletable test data on the live site.
- **Possible WCAG 2.2 AA items seen while reading the code (not fixed here).**
  1. The two lightbox tap zones are named "Previous photo" and "Next photo", but they step between gallery items, not between the photos of one item. Recommendation: the owner listens at step 7.7 and says whether it confuses; renaming is a copy change that needs the owner's yes.
  2. The Show password button changes its name ("Show password" to "Hide password") and also sets pressed. Readers may say "Hide password, pressed", which is confusing. Recommendation: listen at step 1.5, then keep one signal only if it confuses.
  3. On the code screen focus lands in the first digit box, so the heading "Check your email" is skipped. The box's group name "Sign-in code" and its hint give the context. Recommendation: listen at step 1.9 and decide.
- **Shape rule I added:** a signed record may hold a Not run only with a reason in Outcome. Recommendation: keep it. Without it, the steps that cannot run on one device would block sign-off, or be marked Pass when they were not run.

## Known Stubs

None. The Results cells are all "Not run" on purpose: the scripts are written, nothing has been run.

## Threat Flags

None. The plan adds a document and a test. The test-data rules for the live pass (threat T-14-18) are in the record and checked by the tests.

## Self-Check: PASSED

- FOUND: docs/operations/a11y-manual-passes.md
- FOUND: tests/Csps.ArchitectureTests/A11yManualRecordTests.cs
- FOUND commits: 85244225, 5ff54652

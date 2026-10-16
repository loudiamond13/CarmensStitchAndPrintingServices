---
phase: 03-ci-cd-staging-deploy
plan: 23
subsystem: planning-contract
tags: [roadmap, requirements, project, prime-directive-1, no-staging, docs-only]
created: "2026-10-15T22:11:30-05:00"
updated: "2026-10-15T22:11:30-05:00"

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: 03-CONTEXT.md owner decisions D-01 to D-19 (no staging site, live-site deploy, legacy retirement)
provides:
  - ROADMAP.md Phase 3 retitled "CI/CD & Deploy" with a live-site goal and success criteria 1 to 6
  - OPS-01 and OPS-04 reworded to the process merge gate and the Run-button live deploy
  - PROJECT.md Prime Directive 1 override recorded as an owner-decided Key Decision
  - Phases 16 and 17 and MIG-04, MIG-08, CUT-02 describing an import from the verified .bak into the database that already serves CSPS
affects: [phase-03-verification, phase-06, phase-14, phase-16, phase-17]

actuals:
  tokens: 9000
  tasks: 3
  commits: 2

plan_head_before: dbe9680b8dd80ad3bfc42ee18821ab92425fd2c8
commits: 2
plan_head_after: 489e9eb6415cf45a30a652bcbc202a288f14bf74

tech-stack:
  added: []
  patterns: [scoped Edit replacements only, milestone-scope phase_count re-checked after each task]

key-files:
  created: []
  modified:
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/PROJECT.md

key-decisions:
  - "Owner approved every block R1-R11, Q1-Q6, P1-P6 as written (approve, no edits) at 2026-10-15T22:05-05:00"

requirements-completed: [OPS-04, OPS-01]

coverage:
  - id: D1
    description: "ROADMAP Phase 3 entry (title, goal, success criteria 1 to 6, prerequisites, research flag) matches D-01 to D-19 and GSD lookups still resolve Phase 3"
    requirement: "OPS-04"
    verification:
      - kind: other
        ref: "gsd-tools query roadmap.get-phase 3 --pick phase_name|goal|section"
        status: pass
    human_judgment: false
  - id: D2
    description: "OPS-04, OPS-01, MIG-04, MIG-08, CUT-02 and the Prime Directive 1 out-of-scope row carry the approved wording"
    requirement: "OPS-01"
    verification:
      - kind: other
        ref: "grep acceptance checks in 03-23-PLAN.md Tasks 2 and 3"
        status: pass
    human_judgment: false
  - id: D3
    description: "PROJECT.md records the Prime Directive 1 override and amended legacy text; Phases 16 and 17 describe the import into the live CSPS database"
    verification: []
    human_judgment: true
    rationale: "Wording is the owner's contract text; the owner approved it at the Task 1 checkpoint, and fit with later phases is judged at their discuss steps"

duration: 5min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 23: Contract amendment Summary

**ROADMAP, REQUIREMENTS and PROJECT.md amended to the owner's 2026-10-15 decisions: no staging site, owner-run deploy to the live site with smoke test and rollback, the Prime Directive 1 override, and Phase 16/17 importing from the verified `.bak` into the database that already serves CSPS.**

## Performance

- **Duration:** about 5 min after approval
- **Started:** 2026-10-15T22:07:50-05:00
- **Completed:** 2026-10-15T22:11:30-05:00
- **Tasks:** 3 (Task 1 owner checkpoint, Tasks 2 and 3 edits)
- **Files modified:** 3

## Owner approval (Task 1)

- **Approved at:** 2026-10-15T22:05-05:00, in the owner's own reply "approve", relayed by the orchestrator.
- **Owner edits:** none ("approve, no edits"). Every block was applied as written in the plan's "Proposed wording" section, including the optional Q1 (OPS-01 reworded to the process merge gate) and R11 (Phase 6 and Phase 14 discuss-step pointers).
- **Dropped blocks:** none. New titles "CI/CD & Deploy" and "Legacy Data Cutover" kept.

## Accomplishments

- ROADMAP Phase 3: new title, goal, the Amended line, success criteria 1 to 6 (live deploy, process merge gate, free security set, legacy retired safely, holding page), prerequisites and research flag; Phases list, overview, Phase 4 depends-on, calendar row and progress-table names updated.
- OPS-04 now describes the Run-button deploy to the only site on the Basic plan with `app_offline.htm`, smoke test and automatic rollback; OPS-01 states the process merge gate (D-08).
- PROJECT.md: Prime Directive 1 override added as a Key Decision, data-safety, out-of-scope, legacy-system, version-control, SQL Server 2025 and `.bak` rows and the Active list amended.
- Phases 16 and 17, MIG-04, MIG-08, CUT-02 amended to the local rehearsal and live-database import; Phase 6 and Phase 14 got "No staging site" discuss-step pointers (R11).

## Task Commits

1. **Task 1: Owner approves the exact wording** - no commit (checkpoint resolved by the owner, "approve", 2026-10-15T22:05-05:00)
2. **Task 2: Tracer, Phase 3, OPS-04 and Prime Directive 1** - `3b6aa6f` (docs). Blocks R3, R5, Q2, P1, P3c and timestamps.
3. **Task 3: Phases 16/17, overview, calendar, progress, OPS-01, MIG-04/08, CUT-02, legacy text** - `489e9eb` (docs). Blocks R1, R2, R4, R6 to R11, Q1, Q3 to Q6, P2, P3a, P3b, P4a, P4b, P5 and timestamps.

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## RED and GREEN gate output

RED (before any edit, current text):

| Check | Result |
|---|---|
| `roadmap.get-phase 3 --pick phase_name` | `CI/CD & Staging Deploy` (fail) |
| goal `grep -ci staging` | 1 (fail) |
| OPS-04 line `grep -ci staging` | 1 (fail) |
| `roadmap.get-phase 16` section `grep -ci staging` | 3 (fail) |
| Phase 17 section `domain switch` or `legacy set read-only` | 2 (fail) |
| MIG-08/CUT-02 `staging` or `domain switch` | 2 (fail) |
| Phases list lines 3/16/17 `staging` | 1 (fail) |
| Phase 17 `phase_name` | `Production Cutover` (fail) |
| `Touching the live legacy` in REQUIREMENTS / PROJECT | 1 / 1 (fail) |
| `Phase 17 cutover` in PROJECT.md | 1 (fail) |
| OPS-01 line contains D-08 | 0 (fail) |
| `milestone-scope phase_count` | 17 |
| `init.plan-phase 3 phase_req_ids` | `OPS-01, OPS-02, OPS-03, OPS-04, OPS-05` |
| `init.execute-phase 3 branch_name` | `gsd/phase-03-ci-cd-staging-deploy` |

GREEN (after Task 2): phase_name `CI/CD & Deploy`; goal staging 0; OPS-04 staging 0; Phase 3 section `staging deploy|serves|smoke` 0; `Prime Directive 1 override` count 2 in PROJECT.md; OPS-04 `workflow_dispatch` 1; req IDs unchanged; phase_count 17; branch unchanged; line-3 `Updated:` set in all three files.

GREEN (after Task 3): Phase 16 section staging 0; Phase 17 section domain switch / legacy set read-only 0; MIG-08/CUT-02 0; Phases list 0; Phase 17 `phase_name` `Legacy Data Cutover`; OPS-01 line contains `D-08` (1); `Touching the live legacy` 0 in both files; `Phase 17 cutover` 0 in PROJECT.md; phase_count 17; Phase 3 req IDs `OPS-01, OPS-02, OPS-03, OPS-04, OPS-05`; branch `gsd/phase-03-ci-cd-staging-deploy`; `git show --stat --format= HEAD` lists only ROADMAP.md, REQUIREMENTS.md, PROJECT.md.

## Files Created/Modified

- `.planning/ROADMAP.md` - Phase 3, 4 (depends-on), 6, 14, 16, 17 entries, overview, calendar, progress names, timestamps
- `.planning/REQUIREMENTS.md` - OPS-01, OPS-04, MIG-04, MIG-08, CUT-02, Prime Directive 1 out-of-scope row, timestamps
- `.planning/PROJECT.md` - data-safety constraint, Key Decisions (override row, SQL Server 2025, `.bak`), out-of-scope, legacy-system, version-control, Active list, timestamps

## Decisions Made

- Applied the owner-approved wording verbatim; no edits, nothing dropped.
- Left the REQUIREMENTS footer "Earlier:" chain as written in P6 on the first edit, and only refreshed the time token on the second edit so the chain does not nest.

## Deviations from Plan

None - plan executed exactly as written. Both edit passes used scoped `Edit` replacements. The footer time token was refreshed once more with a single `sed` over the three files (same text, new time) at the end of Task 3.

## Issues Encountered

Out-of-scope `staging` mentions remain on purpose and are not changed here (plan "Out of this plan"): ROADMAP line 105 (Phase 1 hosting record), Phase 6 criterion 5, Phase 14 criteria 1 and 5 (each now has an R11 pointer bullet), REQUIREMENTS FND-13, SEC-05, and AUTH-12 ("so staging and production can be signed in"). AUTH-12 was not in the plan's block list; flagged for the Phase 4 or Phase 14 discuss step.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 3 can be verified against a goal, success criteria and OPS-04 text that match D-01 to D-19. Phases 16 and 17 discuss steps pick up the open items now listed (fit of imported orders with staff-recorded orders; import route into the live database).

## Known Stubs

None.

## Threat Flags

None. No credentials, host names, table names or row counts were written into the planning documents (T-03-69).

## Self-Check: PASSED

- Commits `3b6aa6f` and `489e9eb` are ancestors of HEAD.
- The three modified files exist and every Task 2 and Task 3 verify and acceptance command passed.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-15*

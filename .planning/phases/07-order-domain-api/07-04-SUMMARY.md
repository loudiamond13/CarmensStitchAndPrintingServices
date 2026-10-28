---
phase: 07-order-domain-api
plan: 04
subsystem: planning
tags: [requirements, roadmap, owner-approval, amendments]
status: complete
created: "2026-10-28T10:35:00-05:00"
updated: "2026-10-28T10:35:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: owner rulings D-01 to D-38 in 07-CONTEXT.md
provides:
  - "Owner-approved wording for ORD-05, ORD-06, ORD-13, ORD-17, ORD-18 and MONEY-01 in REQUIREMENTS.md"
  - "Phase 7 notes line in ROADMAP.md"
  - "Phase 7.1 Legacy Fit Check (read-only) in ROADMAP.md (D-33)"
  - "Ruling D-39 in 07-CONTEXT.md"
affects: [phase-07-order-domain-api, phase-07.1, phase-08, phase-10]

actuals:
  tokens: 8500
  tasks: 3
  commits: 2
plan_head_before: 0e4ea416e9a635a0c2bb532b663c1d951db3919f
plan_head_after: 9a8481fe385c98aad05a425d9f9db1b51591ccf8
commits: 2

tech-stack:
  added: []
  patterns: ["draft, owner gate, then scoped Edits (no whole-file writes)"]

key-files:
  created:
    - .planning/phases/07-order-domain-api/07-AMENDMENTS.md
    - .planning/phases/07.1-legacy-fit-check-read-only/.gitkeep
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/phases/07-order-domain-api/07-CONTEXT.md
    - .planning/STATE.md

key-decisions:
  - "D-39 (owner, 2026-10-28): approve-all; the criterion 2 clause on the Phase 7 notes line is kept"
  - "Refunds on a soft-deleted order and money on hand: left open by the owner, parked in the STATE.md Owner backlog, no wording added"

requirements-completed: []
# The plan only amended requirement text. The built behaviour is delivered by later Phase 7 plans,
# so no requirement is marked complete here (ORD-17 was already ticked by 07-03).
---

# Phase 7 Plan 04: Requirement and Roadmap Amendments Summary

The owner approved the drafted wording as written, and it is now in REQUIREMENTS.md and ROADMAP.md, with Phase 7.1 "Legacy Fit Check (read-only)" scheduled after Phase 7.

## What was done

1. **Task 1 (commit 4cd22046):** drafted `07-AMENDMENTS.md` with the current and proposed wording for each item. Nothing else changed at that point.
2. **Task 2 (owner gate):** the owner answered on 2026-10-28.
   - Wording: approve-all.
   - The extra clause on the Phase 7 notes line (criterion 2 is superseded by D-12): keep it.
   - Refunds on a soft-deleted order and money on hand: leave open.
3. **Task 3 (commit 9a8481fe):** applied the approved wording.
   - ORD-05, ORD-06, ORD-13, ORD-17 (tick kept), ORD-18 and MONEY-01 carry the approved text, each ending with `(owner, 2026-10-28, D-xx)`.
   - The Phase 7 notes line was added under the success criteria. The criteria text is unchanged.
   - Phase 7.1 was inserted with `gsd-tools phase insert 7`. Its goal and dependency use the approved text.
   - Ruling D-39 was added to `07-CONTEXT.md`. `07-AMENDMENTS.md` is marked "Approved by the owner on 2026-10-28".
   - The open question on soft-deleted refunds is in the STATE.md Owner backlog.

## Deviations from Plan

None. The plan was executed as written.

- The new ruling took the next free number in the Phase 7 list, D-39.
- The Requirements line of Phase 7.1 reads "None new" instead of the tool's "TBD", because the approved draft says no requirement depends on it.
- The tool left its "to be planned" Plans placeholder in the 7.1 entry, as the draft allowed.

## Known Stubs

None. The Phase 7.1 "Plans: 0 plans / TBD" line is the standard placeholder until `/gsd-plan-phase 07.1` runs.

## Threat Flags

None. Docs only.

## Verification

- `grep -c "Legacy Fit Check" .planning/ROADMAP.md` printed 1.
- `grep -c "D-12" .planning/REQUIREMENTS.md` printed 7.
- `grep -c "Phase 7.1" .planning/ROADMAP.md` printed 2.
- `grep -c "Approved by the owner on" 07-AMENDMENTS.md` printed 1.
- No `<date you approve>` placeholder is left in REQUIREMENTS.md or ROADMAP.md.
- gitleaks on the staged change: no leaks found.

## Self-Check: PASSED

- 07-AMENDMENTS.md, REQUIREMENTS.md, ROADMAP.md, 07-CONTEXT.md and the 07.1 folder exist.
- Commits 4cd22046 and 9a8481fe are in history on `gsd/phase-07-order-domain-api`.

---
phase: 11-public-site-content-management
plan: 06
subsystem: planning
tags: [owner-review, carry-over, rulings, backlog]
status: complete
created: "2026-11-11T21:00:00-05:00"
updated: "2026-11-11T21:00:00-05:00"

requires:
  - phase: 11-public-site-content-management
    provides: plan 11-01 lock findings (roster and account-token locks)
provides:
  - owner rulings D-120 (P10-BL-23), D-121 (P10-BL-20 item 3) and D-122 (page head encoder) recorded in 11-CONTEXT.md
  - P10-BL-20 and P10-BL-23 status lines in 999.6 DECISIONS.md set to ruled
affects: [phase-11 verification, phase-10 close-out]

actuals:
  tokens: 3000
  tasks: 3
  commits: 1
plan_head_before: f8cbb402083697258a95aa6117f1c6717a93486c
plan_head_after: c719787caec6454d3ff0712bfac45c7953127734

key-files:
  created: []
  modified:
    - .planning/phases/11-public-site-content-management/11-CONTEXT.md
    - .planning/phases/11-public-site-content-management/11-02-SUMMARY.md
    - .planning/phases/999.6-owner-items-parked-during-phase-10-execution/DECISIONS.md

key-decisions:
  - "D-120 (owner, 2026-11-11): P10-BL-23 approved as built."
  - "D-121 (owner, 2026-11-11): P10-BL-20 item 3 (a), (b) and (c) approved as built."
  - "D-122 (owner, 2026-11-11): keep the Latin-1-range HTML encoder in PublicHeadWriter."

requirements-completed: [PERF-04, USER-02, DASH-06]
---

# Phase 11 Plan 06: The owner reviews the two Phase 10 items that are still waiting Summary

*Created: 2026-11-11T21:00:00-05:00 · Updated: 2026-11-11T21:00:00-05:00*

**Both carried Phase 10 reviews are answered by the owner, approved with no changes, and recorded as D-120 and D-121. A third ruling (D-122, the page head encoder from plan 11-02) was recorded at the owner's request.**

The `commits:` count of 1 is measured before this SUMMARY's own commit (`git rev-list --count f8cbb402..HEAD`). The ledger file was not written because the harness refuses the compound git command; `plan_head_before` is the spawn base asserted at start.

## Owner answers (given in chat, 2026-11-11)

| Task | Item | Owner answer, word for word |
|------|------|-----------------------------|
| 1 | P10-BL-23: faster expense list query, the 409 "busy, try again" answer on create-user, and the order-number, Manager roster and account-token locks | "Approve both" (2026-11-11) |
| 2 | P10-BL-20 item 3: (a) dashboard line "Showing figures from {time}. Couldn't refresh." with Try Again, (b) audit label "Money transfer added", (c) WebKit-only e2e guard | "Approve all three" (2026-11-11) |

No changes were requested, so there are no follow-ups.

Extra ruling from the same day, quoted from the owner: "Page head encoding (plan 11-02 deviation 4): keep the narrower Latin-1-range HTML encoder in PublicHeadWriter instead of HtmlEncoder.Default, so titles such as 'Products · CSPS' read exactly as written. The five markup characters (< > & ' \") are still escaped, and a test covers that." (owner, 2026-11-11)

## What was done

- **Next free D-number:** the highest number used anywhere in the planning docs, docs, code and every branch is D-119, so D-120, D-121 and D-122 were free. (The phase-local list reaches D-46 and uses a separate numbering.)
- **11-CONTEXT.md:** new "### Carry-over reviews (D-119)" block at the end of the decisions block with D-120, D-121 and D-122.
- **999.6 DECISIONS.md:** P10-BL-23 status is now "ruled D-120 (owner, 2026-11-11)" and P10-BL-20 is "ruled D-121 (owner, 2026-11-11)", each keeping the old text after "Was:".
- **11-02-SUMMARY.md:** one-line pointer "Ruled D-122 (owner, 2026-11-11): keep." added to the Latin-1 encoder note.
- Only the `Updated:` / `updated:` timestamps were changed on the three edited files.

## Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | Owner reviews P10-BL-23 | none (checkpoint, answered) |
| 2 | Owner reviews P10-BL-20 item 3 | none (checkpoint, answered) |
| 3 | Record rulings and close backlog items | c719787c |

## Deviations from Plan

**1. [Process] Pointer placed on the encoder note, not on a "deviation 4" entry**
- The orchestrator called the Latin-1 encoder "plan 11-02 deviation 4". In 11-02-SUMMARY.md the encoder note is in "Decisions Made"; deviation 4 there is "RED commit carries a skeleton", which is unrelated. The D-122 pointer sits on the encoder note, which is the text the ruling is about.

**2. [Process] Plan commit ledger not written** (same harness limit as plan 11-02). Count measured with `git rev-list`.

Otherwise: none, the plan ran as written. No code changed.

## Reminder for the owner

Phase 10 UAT tests 18 and 19 are still your step: run `/gsd-verify-work 10` when it suits you (they were met by the green full CI run on 89d723cd). Nothing here runs it for you.

## Known Stubs

None.

## Threat Flags

None. No code, endpoint or package was touched (T-11-10 mitigated: answers quoted with date; T-11-SC: no installs).

## Self-Check: PASSED

- FOUND: commit c719787c (`git merge-base --is-ancestor`)
- `grep -c "Carry-over reviews (D-119)"` in 11-CONTEXT.md = 1
- `ruled D-121` on P10-BL-20 and `ruled D-120` on P10-BL-23 found in DECISIONS.md
- gitleaks `protect --staged`: no leaks

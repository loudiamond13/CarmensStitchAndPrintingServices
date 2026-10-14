---
phase: quick-261007-j0u
plan: 01
status: complete
subsystem: planning-docs
tags: [requirements, roadmap, staff-money, idempotency, concurrency, owner-decisions]
requires: []
provides:
  - ORD-22 (Phase 7), MONEY-01..08 (Phase 10), MIG-09 (Phase 16), WEB-09 (Phase 2), SEC-06 (Phase 4), SEC-07 (Phase 5)
  - OD-19 resolved in PROJECT.md Key Decisions
  - Open decisions OD-15, OD-16, OD-17, OD-18, OD-20
affects: [Phase 2, Phase 4, Phase 5, Phase 7, Phase 8, Phase 9, Phase 10, Phase 15, Phase 16]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md
decisions:
  - "OD-19 resolved (owner, 2026-10-07): only the Manager role deletes money transfers (Admin 403); an Admin sees only their own money and transfers, a Manager sees everyone's"
  - "Every state-changing form POST is idempotent via Idempotency-Key (SEC-06 server in Phase 4, WEB-09 client in Phase 2)"
  - "Concurrency guarantees are explicit (SEC-07, Phase 5): rowversion 409s, locked check-then-write money operations, two-writer tests"
metrics:
  duration: 5m
  completed: 2026-10-07
commits: 3
plan_head_before: a3365f57aab086ca3481647e92fc3c25ca65d299
plan_head_after: ac2f2247ed65322aec78c9c36f015431411b4b55
actuals:
  tokens: 5200
  tasks: 3
  commits: 3
---

# Quick Task 261007-j0u: Staff Money, Payment Received By, Idempotent Posts and Concurrency Requirements Summary

The planning docs now record the owner's 2026-10-07 additions as numbered, traced requirements: payment "Received by" (ORD-22), server-computed staff money on hand with coworker transfers under the owner's rulings (MONEY-01..08), legacy receiver mapping (MIG-09), idempotent form posts (SEC-06, WEB-09) and concurrency guarantees (SEC-07). The v1 count is 175, and every count, traceability row and coverage row agrees.

## New requirement IDs and phases

| ID | Phase | Summary |
|---|---|---|
| ORD-22 | 7 | Every payment has a required, server-validated Received by (owner's "PaidTo"), naming an active Admin or Manager. A receiver change is audited. Phase 8 delivers the form field (Orders split) |
| MONEY-01..08 | 10 | Server-computed money on hand. An Admin sees only their own money (403 for any other id, existing or not) and a Manager sees everyone's. Validated, idempotent and lock-guarded transfers, no edit, Manager-only audited delete, exact authorization-matrix rows |
| MIG-09 | 16 | Migrated payments get a Received by under the OD-15 rule. No migrated payment is dropped or changed |
| WEB-09 | 2 | `lib/http` sends one Idempotency-Key per submission, reused on retry. Submit buttons are disabled while pending |
| SEC-06 | 4 | Idempotency-Key on every state-changing POST. 24-hour relational store (nvarchar, no JSON column). 422/409/400 rules, written allow-list, discovery-test coverage |
| SEC-07 | 5 | rowversion 409 with plain-English copy on every mutable aggregate, locked check-then-write money operations, no stale figures, two-writer integration tests |

**Changed existing requirement:** JOB-01 gains "idempotency-key purge" in its maintenance list. No other existing requirement text, checkbox or status changed.

**Decisions:**
- **OD-19 is resolved.** It is recorded in one PROJECT.md Key Decisions row together with the idempotency and concurrency answers. It is never flagged with ⚑ and has no open row.
- **Still open:** OD-15 (legacy receiver mapping), OD-16 (balance rules), OD-17 (transfer edit), OD-18 (soft vs hard delete) and OD-20 (field label). Each has a PROJECT.md Open Owner Decisions row, ⚑ flags in REQUIREMENTS.md, and a place in the ROADMAP discuss lists and Decision Calendar.

**Follow-up:** `CSPS-PRD.md` and `CSPS-UI-SPEC.md` don't cover staff money, the Received by field, or idempotent posts yet and need a later update. The PROJECT.md Active line and the MONEY section intro both record this.

## Tasks

| Task | Name | Commit |
|---|---|---|
| 1 | Tracer: payment Received by (ORD-22) through REQUIREMENTS, ROADMAP and PROJECT | 3911591 |
| 2 | Staff money MONEY-01..08, MIG-09, OD-16..OD-18 rows, OD-19 resolution | 989fd41 |
| 3 | SEC-06, WEB-09, SEC-07, JOB-01 purge, DoD bullets, coverage 175, footers, final guard | ac2f224 |

## Verification

- Every task's `<automated>` block passed before its commit. Check A printed `OK 163`, then `OK 172`, then `OK 175`. Check B printed OK each time: 15 flagged ODs after Task 1 and 18 after Tasks 2 and 3. That count covers every OD/C/S reference after a ⚑ marker, and each has a PROJECT.md row.
- The tracer gate re-ran the Task 1 verify end to end, and it passed before the expansion tasks.
- The guard (`sha256sum -c`) reported CLAUDE.md, .claude/CLAUDE.md, CSPS-PRD.md and CSPS-UI-SPEC.md unchanged, and the guard temp file was then removed.
- No new ID appears under `### Phase 1:` in ROADMAP.md.
- The task commits touched only `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` and `.planning/PROJECT.md`. The pre-existing changes to `.claude/CLAUDE.md` and `.planning/config.json` were left unstaged.
- The ROADMAP Progress table, Plans lines and phase checkboxes are untouched.

## Deviations from Plan

None. The plan was executed exactly as written.

## Known Stubs

None. This was a docs-only task.

## Self-Check: PASSED

- FOUND: .planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/PROJECT.md (modified)
- FOUND commits: 3911591, 989fd41, ac2f224

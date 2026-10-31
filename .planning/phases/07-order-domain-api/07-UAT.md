---
status: complete
phase: 07-order-domain-api
source: [07-VERIFICATION.md]
created: 2026-10-28T23:35:00-05:00
started: 2026-10-28T23:35:00-05:00
updated: 2026-10-29T10:20:59.514Z
---

# Phase 7 UAT

*Created: 2026-10-28T23:35:00-05:00 · Updated: 2026-10-29T05:17:37-05:00*

## Current Test

[testing complete]

## Tests

### 1. Edits re-check only the fields they change (DOM-WR-04, D-49b)
Read `src/Csps.Application/Orders/LegacyEditFilter.cs` and the six edit handlers, and try one edit of an imported legacy order through the API.
expected: A legacy value left as saved does not block an edit of another field. A changed field is still checked in full. The D-05 lock and the money caps still apply.
result: skipped
reason: "Deferred follow-up: I will check this after phase 8, remind me to read the code"

### 2. A deadlock in the duplicate-request guard answers 409 (APO-WR-01, commit 529510b1)
Read the change in `ConcurrencyConflictException`, `ConflictRetry` and `CspsUnitOfWork`, and its two-connection deadlock test.
expected: A deadlock inside the idempotency transaction answers 409, not 500, and `ConflictRetry` does not retry inside a dead transaction.
result: pass

### 3. Busy code for list writes (APX-IN-04)
expected: An owner ruling (keep the shared `auth.session-busy`, or a list-specific code), recorded as a D-number.
result: pass
ruling: D-78 (owner, 2026-10-29): option 1, keep the shared `auth.session-busy`.

### 4. Audit lines for current payer, receiver, refunder and created total (APX-IN-01)
expected: An owner ruling at the Phase 8 UI review.
result: skipped
reason: "Deferred follow-up: owner chose option 1 (2026-10-29), decide at the Phase 8 UI review as planned."

### 5. Refunds on a soft-deleted order and money on hand (D-39)
expected: A ruling before the Phase 10 money-on-hand reports are planned.
result: skipped
reason: "Deferred follow-up: owner agreed (2026-10-29) to rule it before the Phase 10 money-on-hand reports are planned."

## Summary

total: 5
passed: 2
issues: 0
pending: 0
skipped: 3
blocked: 0

## Deferred Follow-Ups

- test: 1
  idea: "I will check this after phase 8, remind me to read the code"
  deferred_at: 2026-10-29
  reminder: "After Phase 8 ships, remind the owner to read `LegacyEditFilter.cs`, the six edit handlers and `Order.cs`. Also ask them to confirm that a legacy order with no due date still needs one on edit (`OrderLegacyEditTests`), unlike a missing contact number."
- test: 4
  idea: "Decide the order audit lines (current payer, receiver, refunder, created total) at the Phase 8 UI review."
  deferred_at: 2026-10-29
- test: 5
  idea: "Rule whether a refund on a soft-deleted order counts toward money on hand (D-39) before the Phase 10 reports are planned."
  deferred_at: 2026-10-29

## Gaps

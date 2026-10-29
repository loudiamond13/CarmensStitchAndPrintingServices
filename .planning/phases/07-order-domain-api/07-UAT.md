---
status: testing
phase: 07-order-domain-api
source: [07-VERIFICATION.md]
created: 2026-10-28T23:35:00-05:00
started: 2026-10-28T23:35:00-05:00
updated: 2026-10-28T23:35:00-05:00
---

# Phase 7 UAT

*Created: 2026-10-28T23:35:00-05:00 · Updated: 2026-10-28T23:35:00-05:00*

## Current Test

number: 1
name: Edits re-check only the fields they change (DOM-WR-04, D-49b)
expected: |
  A legacy value left as saved (an amount over the cap, a future date, a quantity of 0, no contact number) does not block an edit of another field. A changed field is still checked in full. The D-05 lock, the discount cap, the payment balance cap and the refund caps still apply.
awaiting: user response

## Tests

### 1. Edits re-check only the fields they change (DOM-WR-04, D-49b)
Read `src/Csps.Application/Orders/LegacyEditFilter.cs` and the six edit handlers, and try one edit of an imported legacy order through the API.
expected: A legacy value left as saved does not block an edit of another field. A changed field is still checked in full. The D-05 lock and the money caps still apply.
result: [pending]

### 2. A deadlock in the duplicate-request guard answers 409 (APO-WR-01, commit 529510b1)
Read the change in `ConcurrencyConflictException`, `ConflictRetry` and `CspsUnitOfWork`, and its two-connection deadlock test.
expected: A deadlock inside the idempotency transaction answers 409, not 500, and `ConflictRetry` does not retry inside a dead transaction.
result: [pending]

### 3. Busy code for list writes (APX-IN-04)
expected: An owner ruling (keep the shared `auth.session-busy`, or a list-specific code), recorded as a D-number.
result: [pending]

### 4. Audit lines for current payer, receiver, refunder and created total (APX-IN-01)
expected: An owner ruling at the Phase 8 UI review.
result: [pending]

### 5. Refunds on a soft-deleted order and money on hand (D-39)
expected: A ruling before the Phase 10 money-on-hand reports are planned.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

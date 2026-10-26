---
status: testing
phase: 06-company-expenses
source: [06-VERIFICATION.md]
started: "2026-10-26T02:50:00-05:00"
updated: "2026-10-26T02:50:00-05:00"
created: "2026-10-26T02:50:00-05:00"
---

## Current Test

number: 1
name: Review pack pictures for Company Expenses, Deleted Expenses and Settings
expected: |
  The screens look right in Blush and Espresso at 390, 820 and 1440 px, including the Upcoming badge, the three row icons for a Manager, both delete confirmations and the stale-save banner.
awaiting: user response

## Tests

### 1. Review pack pictures
Run `npm --prefix web run review`, open `artifacts/owner-review/index.html`, section "Company expenses and settings (Phase 6)".
expected: The Company Expenses, Deleted Expenses and Settings screens look right in both themes at 390, 820 and 1440 px, including the Upcoming badge, the three row icons for a Manager, both delete confirmations and the stale-save banner.
result: [pending]

### 2. UI-SPEC OQ-1 to OQ-15
expected: Each open question has an owner ruling, or the built contract default is confirmed (for example the eraser as a third row icon, a separate Deleted Expenses page, Restore with no confirm).
result: [pending]

### 3. Copy review (05 D-48)
expected: The owner approves or changes the new expense, Deleted Expenses, Settings and Audit Log sentences ("Words on the Phase 6 screens" table in the pack).
result: [pending]

### 4. Paid by wording for a person who has not signed in yet
expected: The owner picks: keep "This person can't be chosen because their account isn't active..." (recommended), add a second sentence, or show the person disabled with a hint.
result: [pending]

### 5. Who may read expense notes (A-IN-03)
expected: The owner picks: notes hidden from anyone who cannot edit the row (recommended), or keep as built (every staff member can read every expense's notes).
result: [pending]

### 6. Live speed check after release (D-28)
expected: p95 under 300 ms for GET /api/v1/company-expenses and /kpis in the live request logs (procedure in docs/operations/list-performance.md). This can only be done after release.
result: [pending]

### 7. Confirm the two test-side fixes
expected: The owner confirms the slow add-expense test fix and the command-count flake fix (recommended), and decides on the accumulated CSPS_E2E staff accounts and the cancelled request logged as a server error.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

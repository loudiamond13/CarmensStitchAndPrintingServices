---
status: testing
phase: 05-profile-user-management
source: [05-VERIFICATION.md]
started: 2026-10-19T05:10:16-05:00
updated: 2026-10-19T05:10:16-05:00
created: 2026-10-19T05:10:16-05:00
---

# Phase 5: User Acceptance Tests

*Created: 2026-10-19T05:10:16-05:00 · Updated: 2026-10-19T05:10:16-05:00*

## Current Test

number: 1
name: Real-phone motion, tab bar and tap areas
expected: |
  On a real phone, the drawer, user menu and a dialog open and close smoothly; with reduced motion they appear and disappear at once; the tab bar sits at the bottom of a short page; the menu button, sidebar toggle, filter-chip clear and row buttons (Edit, Deactivate, Delete, now 8 px apart) are easy to tap without hitting a neighbour.
awaiting: user response

## Tests

### 1. Real-phone motion, tab bar and tap areas
expected: Drawer, user menu and dialogs animate smoothly and instantly under reduced motion; tab bar at the bottom of short pages; 44 px tap areas work under a thumb with no mis-taps between row buttons.
result: [pending]

### 2. Email-change mail in a real inbox
expected: Changing your own email on a dev account with SMTP sends a confirmation link to the new address and a notice to the old one; the link confirms the change.
result: [pending]

### 3. Refresh cookie Expires after the next deploy
expected: On the live site, signing in with "Keep me signed in" sets a refresh cookie with an Expires date; without it, the cookie is a session cookie.
result: [pending]

### 4. Judgment-tier prohibitions (05-31, 05-37, 05-51)
expected: Reviewing the flagged prohibitions in 05-VERIFICATION.md, none is violated in the shipped screens and emails.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

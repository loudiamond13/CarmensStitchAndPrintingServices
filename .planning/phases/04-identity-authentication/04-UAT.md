---
status: testing
phase: 04-identity-authentication
source: [04-VERIFICATION.md]
started: 2026-10-15T18:20:00-05:00
updated: 2026-10-15T18:20:00-05:00
created: 2026-10-15T18:20:00-05:00
---

## Current Test

number: 1
name: Live SMTP send from the app
expected: |
  With real SMTP secrets in dev (D-27) or at the first deploy, sign in once and check the inbox and the message source.
  Code in the subject, From "Carmen's Stitch & Printing" <no-reply@cspstailoring.com>, no Reply-To, branded HTML with inline logo, SPF/DKIM/DMARC pass, TLS used.
awaiting: user response

## Tests

### 1. Live SMTP send from the app
expected: Code in the subject, From "Carmen's Stitch & Printing" <no-reply@cspstailoring.com>, no Reply-To, branded HTML with inline logo, SPF/DKIM/DMARC pass, TLS used.
result: [pending]

### 2. Production Set-Cookie behaviour
expected: After the first HTTPS deploy, the sign-in responses set `__Secure-csps_rt` and `__Secure-csps_2fa` with HttpOnly, Secure, SameSite=Strict, Path=/api/v1/auth.
result: [pending]

### 3. Live HIBP reachability
expected: A `CSPS_LIVE_HIBP=1` run of `HibpLiveTests` (and the same from the host at first deploy) classifies breached and clean passwords correctly.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

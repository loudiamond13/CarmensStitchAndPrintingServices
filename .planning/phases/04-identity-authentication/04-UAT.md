---
status: partial
phase: 04-identity-authentication
source: [04-VERIFICATION.md]
started: 2026-10-15T18:20:00-05:00
updated: 2026-10-16T00:11:02.087Z
created: 2026-10-15T18:20:00-05:00
---

## Current Test

[testing complete]

## Tests

### 1. Live SMTP send from the app
expected: Code in the subject, From "Carmen's Stitch & Printing" <no-reply@cspstailoring.com>, no Reply-To, branded HTML with inline logo, SPF/DKIM/DMARC pass, TLS used.
result: pass

### 2. Production Set-Cookie behaviour
expected: After the first HTTPS deploy, the sign-in responses set `__Secure-csps_rt` and `__Secure-csps_2fa` with HttpOnly, Secure, SameSite=Strict, Path=/api/v1/auth.
result: blocked
blocked_by: prior-phase
reason: "delay this, we have not deploy it to production yet."

### 3. Live HIBP reachability
expected: A `CSPS_LIVE_HIBP=1` run of `HibpLiveTests` (and the same from the host at first deploy) classifies breached and clean passwords correctly.
result: pass
note: "Local CSPS_LIVE_HIBP=1 run passed (1/1). The from-host run happens at first deploy with Test 2."

## Summary

total: 3
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

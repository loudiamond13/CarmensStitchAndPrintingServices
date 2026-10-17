---
phase: 04
review: 04-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The must-change step accepts the current (temporary or breached) password as the \"new\" password"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "SignIn and ResendCode let `ConcurrencyConflictException` escape, which gives a 500"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Setting a new password at the must-change step leaves the person's other sessions alive"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "A temporary lockout makes Refresh revoke the session for good, so anyone who knows an email can force a sign-out"
  - id: IN-01
    severity: info
    disposition: open
    title: "`PasswordRules.CheckAsync` awaits the breach call without `ConfigureAwait(false)`"
  - id: IN-02
    severity: info
    disposition: open
    title: "Magic strings and repeated helpers"
  - id: IN-03
    severity: info
    disposition: open
    title: "Dead port member and discarded return values"
  - id: IN-04
    severity: info
    disposition: open
    title: "`ListQueryRules` messages hard-code the limits"
  - id: IN-05
    severity: info
    disposition: open
    title: "The breach lookup (an outbound HTTP call) runs inside an open database transaction"
  - id: IN-06
    severity: info
    disposition: open
    title: "`ToString` on some records can print personal data, and an audit doc line is wrong"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "Failed-password counter can be lost under concurrent guesses (lockout throttle bypass)"
  - id: WR-06
    severity: warning
    disposition: skipped
    title: "`HasDefaultValue(true)` on a `bool` silently turns an inactive insert into an active account"
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "Identity's default `AllowedUserNameCharacters` rejects valid staff emails"
  - id: WR-08
    severity: warning
    disposition: fixed
    title: "Email copy hard-codes lifetimes that `AuthSettings` makes configurable"
  - id: WR-09
    severity: warning
    disposition: fixed
    title: "A failure after a successful SMTP send is recorded as a send failure and retried, so staff can get duplicate emails"
  - id: IN-07
    severity: info
    disposition: open
    title: "`BootstrapTargetGuard.IsLocalServer` misses some loopback forms, so the `CSPS_*` allow-list is skipped"
  - id: IN-08
    severity: info
    disposition: open
    title: "Closed email-outbox rows keep the recipient address indefinitely"
  - id: IN-09
    severity: info
    disposition: open
    title: "`HibpPwnedPasswords.CheckAsync` omits `ConfigureAwait(false)` and has no response size cap"
  - id: IN-10
    severity: info
    disposition: open
    title: "`AppLinksOptions.IsValid` accepts URLs with user info"
  - id: WR-10
    severity: warning
    disposition: fixed
    title: "Idempotency scope uses the route pattern and the body only, not the actual path or query"
  - id: WR-11
    severity: warning
    disposition: fixed
    title: "A chunked body over 1 MB becomes a 500, not the 413 the middleware promises (and it is untested)"
  - id: WR-12
    severity: warning
    disposition: deferred
    title: "Auth rate limits key IPv6 clients by /64, which a single subscriber can rotate through"
  - id: WR-13
    severity: warning
    disposition: fixed
    title: "The admin bundle budget is not enforced for the shipped admin app"
  - id: IN-11
    severity: info
    disposition: open
    title: "Duplicate literal for the E2E origin in `playwright.config.ts`"
  - id: IN-12
    severity: info
    disposition: open
    title: "`SignInResponse` and `ResendCodeResponse` are identical records declared in the controller file"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "A failed sign-out call is swallowed, and the sign-in loader then restores the session from the still-valid refresh cookie"
  - id: WR-14
    severity: warning
    disposition: fixed
    title: "The TanStack Query cache survives sign-out and sign-in, so another account's devices list can be shown"
  - id: WR-15
    severity: warning
    disposition: fixed
    title: "\"Sign Out Other Devices\" from the user menu leaves the open devices list stale"
  - id: WR-16
    severity: warning
    disposition: fixed
    title: "Boot treats any HTTP failure as \"no session\", then the sign-in loader drops the return path"
  - id: IN-13
    severity: info
    disposition: open
    title: "`refreshFailure` goes stale on the peer-tab shortcut, which can suppress the sign-out after a 401"
  - id: IN-14
    severity: info
    disposition: open
    title: "`safeReturnUrl` validates the decoded text but returns the raw text, and refuses any legitimate percent sign"
  - id: IN-15
    severity: info
    disposition: open
    title: "Dead copy keys duplicate the password rule messages"
  - id: IN-16
    severity: info
    disposition: open
    title: "The resend announcement hardcodes 60 seconds while the countdown follows the server"
  - id: IN-17
    severity: info
    disposition: open
    title: "An unknown server role silently becomes `manager` in the shell"
  - id: IN-18
    severity: info
    disposition: open
    title: "Page-to-page import and triplicated form scaffolding"
  - id: IN-19
    severity: info
    disposition: open
    title: "`navigator` inside `createSession` shadows the global"
open: 19
total: 36
recorded: 2026-10-15T19:42:31.781Z
created: "2026-10-15T14:42:31-05:00"
updated: "2026-10-17T14:35:00-05:00"
---

# Phase 04: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 04-REVIEW-FIX.md |
| WR-02 | warning | fixed | 04-REVIEW-FIX.md |
| WR-03 | warning | fixed | 04-REVIEW-FIX.md |
| WR-04 | warning | fixed | 04-REVIEW-FIX.md |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| WR-05 | warning | fixed | 04-REVIEW-FIX.md |
| WR-06 | warning | skipped | 04-REVIEW-FIX.md |
| WR-07 | warning | fixed | 04-REVIEW-FIX.md |
| WR-08 | warning | fixed | 04-REVIEW-FIX.md |
| WR-09 | warning | fixed | 04-REVIEW-FIX.md |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| IN-10 | info | open | - |
| WR-10 | warning | fixed | 04-REVIEW-FIX.md |
| WR-11 | warning | fixed | 04-REVIEW-FIX.md |
| WR-12 | warning | deferred | Owner ruling D-49 (2026-10-15): the /64 IPv6 key stays; the change was reverted (04-REVIEW-FIX.md) |
| WR-13 | warning | fixed | 04-REVIEW-FIX.md |
| IN-11 | info | open | - |
| IN-12 | info | open | - |
| CR-01 | critical | fixed | 04-REVIEW-FIX.md |
| WR-14 | warning | fixed | 04-REVIEW-FIX.md |
| WR-15 | warning | fixed | 04-REVIEW-FIX.md |
| WR-16 | warning | fixed | 04-REVIEW-FIX.md |
| IN-13 | info | open | - |
| IN-14 | info | open | - |
| IN-15 | info | open | - |
| IN-16 | info | open | - |
| IN-17 | info | open | - |
| IN-18 | info | open | - |
| IN-19 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "HybridCache factory runs on the first caller's scoped DbContext, which can be disposed while joined callers still wait"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "IpPrefix keeps the full client IPv4 for 6to4 addresses (data-minimization bypass)"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "AuditTrail.AppendAsync commits every pending change on the shared scoped DbContext"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "The dev-seed guard has no server allow-list, and the MSSQLLocalDB block is a bypassable substring check"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "The log masker misses the Identity and secret property names Phase 4 will introduce"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "The correlation-id fallback breaks the IRequestContext contract that AuditEntry enforces"
  - id: WR-07
    severity: warning
    disposition: deferred
    title: "HSTS `includeSubDomains` on the legacy production domain can break the owner's live subdomains"
  - id: WR-08
    severity: warning
    disposition: deferred
    title: "Log retention can be wiped by a request flood (the 30-file cap is reached before 30 days)"
  - id: WR-09
    severity: warning
    disposition: deferred
    title: "The content-type assertions in two health tests pass vacuously when the header is missing"
  - id: IN-01
    severity: info
    disposition: deferred
    title: "The UserAgentFamily \"bot\" substring misclassifies real phones"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "Initialize-DevSecrets passes the JWT signing key on the command line"
  - id: IN-03
    severity: info
    disposition: deferred
    title: "The forwarded-headers detector misses the typed header accessors"
  - id: IN-04
    severity: info
    disposition: planned
    title: "JWT validation does not check the token type"
  - id: IN-05
    severity: info
    disposition: deferred
    title: "HTTPS redirection is on while HTTPS termination is unverified"
  - id: IN-06
    severity: info
    disposition: planned
    title: "`AllowedHosts: \"*\"` in production settings"
  - id: IN-07
    severity: info
    disposition: deferred
    title: "The certificate check accepts a non-RSA PFX that fails only at first key creation"
  - id: IN-08
    severity: info
    disposition: deferred
    title: "Minor tooling inaccuracies"
  - id: IN-09
    severity: info
    disposition: fixed
    title: "CLAUDE.md still states 2-year audit retention"
open: 0
total: 18
recorded: 2026-10-07T21:51:29.767Z
created: 2026-10-07T16:51:40-05:00
updated: 2026-10-14T20:15:00-05:00
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | plan 04-03 |
| WR-02 | warning | fixed | plan 04-03 (the owner deferred it in UAT test 10 on the condition that it lands before any audit write; 6to4 and NAT64 now map to the embedded IPv4 /24) |
| WR-03 | warning | fixed | plan 04-03 |
| WR-04 | warning | fixed | quick-261007-p98 (server allow-list + Failover Partner refusal, test-first; commits ed02c70, 9245949) |
| WR-05 | warning | fixed | plan 04-03 |
| WR-06 | warning | fixed | plan 04-03 |
| WR-07 | warning | deferred | Phase 3 deploy: HSTS includeSubDomains is decided with the host and domain facts; not auth-critical (04-RESEARCH Inherited Review Items) |
| WR-08 | warning | deferred | Phase 14 hardening: log retention against a request flood; not auth-critical |
| WR-09 | warning | deferred | Phase 14 hardening: vacuous content-type assertions in two health tests; test-only |
| IN-01 | info | deferred | Phase 14 hardening: the UserAgentFamily "bot" substring; not auth-critical |
| IN-02 | info | fixed | plan 04-01 |
| IN-03 | info | deferred | Phase 14 hardening: forwarded-headers detector gap; not auth-critical |
| IN-04 | info | planned | plan 04-13: the JWT typ header (at+jwt) is checked when tokens are issued |
| IN-05 | info | deferred | Phase 3 deploy: HTTPS redirection depends on how the host terminates HTTPS |
| IN-06 | info | planned | plan 04-09: reset links use App:PublicBaseUrl; the AllowedHosts value is deferred to Phase 3 deploy |
| IN-07 | info | deferred | Phase 14 hardening: non-RSA PFX check; not auth-critical |
| IN-08 | info | deferred | Phase 14 hardening: minor tooling inaccuracies |
| IN-09 | info | fixed | root CLAUDE.md already states 8-month retention (D-32), verified 2026-10-14 |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`, `planned` (scheduled in a named Phase 4 plan, not yet done).
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

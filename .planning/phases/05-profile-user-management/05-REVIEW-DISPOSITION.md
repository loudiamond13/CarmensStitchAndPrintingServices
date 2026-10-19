---
phase: 05
review: 05-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "\"Sign Out Other Devices\" does nothing on every use after the first"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Open password-reset links stay valid after a Manager sets a temporary password, after a profile password change, and after an at-once email move"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Identity concurrency failures in the simple mutators surface as 500, while controllers and OpenAPI promise 409"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "An account created with a temporary password is born with `EmailConfirmed = true` for an address nobody has proved"
  - id: WR-04
    severity: warning
    disposition: open
    title: "Scrubbing a deleted person's pending address can expire another live account's mail"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "Two inconsistent definitions of \"active Manager\"; a soft-deleted Manager still looks active"
  - id: WR-06
    severity: warning
    disposition: open
    title: "The default-on idempotency transaction holds a DB connection and applock across slow external calls, defeating the stated design in several handlers"
  - id: WR-07
    severity: warning
    disposition: open
    title: "\"No email was sent\" assertions read the sink immediately, so they can pass while a mail is sent"
  - id: WR-08
    severity: warning
    disposition: fixed
    title: "BootstrapManager tests point a live connection string at another project's database"
  - id: WR-09
    severity: warning
    disposition: fixed
    title: "Rate-limit test omits `POST /api/v1/profile/password`, the new current-password oracle"
  - id: WR-10
    severity: warning
    disposition: open
    title: "No test that user, roster and profile responses omit credential fields"
  - id: WR-11
    severity: warning
    disposition: open
    title: "Concurrent last-Manager tests require exactly {204, 422}; a 401 is a legitimate outcome"
  - id: WR-12
    severity: warning
    disposition: open
    title: "`ConcurrentRequests.SendTogetherAsync` has no timeout, so a deadlock hangs the run"
  - id: WR-13
    severity: warning
    disposition: open
    title: "Audit-log tests read an unscoped top-100 page of a shared, append-only log"
  - id: WR-14
    severity: warning
    disposition: fixed
    title: "Missing test pins an inconsistent definition of \"active Manager\" in the bootstrap path"
  - id: WR-15
    severity: warning
    disposition: open
    title: "Change Email dialog keeps the current password in memory after it closes"
  - id: WR-16
    severity: warning
    disposition: open
    title: "An account action's reload wipes whatever the Manager typed while the request ran"
  - id: WR-17
    severity: warning
    disposition: open
    title: "A refused role at sign-in is swallowed and the person is bounced with no explanation"
  - id: WR-18
    severity: warning
    disposition: open
    title: "Audit Log \"people\" failure is invisible and mislabels deep-linked filters"
  - id: WR-19
    severity: warning
    disposition: open
    title: "Every failed list load is explained as an internet problem"
  - id: WR-20
    severity: warning
    disposition: fixed
    title: "Several controls are smaller than the project's 44 px touch-target rule"
  - id: WR-21
    severity: warning
    disposition: open
    title: "`build-output.node.test.ts` can pass against a stale build, and ignores a failed build"
  - id: WR-22
    severity: warning
    disposition: open
    title: "The new `ConfirmEmailAsync` call can turn a double-submitted first code into a 500"
  - id: IN-01
    severity: info
    disposition: open
    title: "Hard-coded \"15 minutes\" in the lockout message, while the duration is configurable"
  - id: IN-02
    severity: info
    disposition: open
    title: "Near-duplicate code makes the roster handlers and mutators hard to keep in step"
  - id: IN-03
    severity: info
    disposition: open
    title: "Case handling of outbox address lookups relies on database collation"
  - id: IN-04
    severity: info
    disposition: open
    title: "An unauthenticated caller can exhaust the shared reset-email cap and block a Manager's \"send reset link\""
  - id: IN-05
    severity: info
    disposition: open
    title: "Duplicated fixture helpers and stale \"later plan\" comments"
  - id: IN-06
    severity: info
    disposition: open
    title: "Reflection and record-getter tests of little value"
  - id: IN-07
    severity: info
    disposition: open
    title: "Test name and magic count disagree in `AuditActionsTests`"
  - id: IN-08
    severity: info
    disposition: open
    title: "Mismatched user name and normalized user name in `NewRawUser`"
  - id: IN-09
    severity: info
    disposition: open
    title: "Unicode normalisation test relies on raw non-ASCII characters in source"
  - id: IN-10
    severity: info
    disposition: open
    title: "Fixed 2.5 s sleeps and a timing-dependent overlap test"
  - id: IN-11
    severity: info
    disposition: open
    title: "\"No timer\" lock test has no positive control"
  - id: IN-12
    severity: info
    disposition: open
    title: "Fixtures create states the product cannot reach, and tests then depend on them"
  - id: IN-13
    severity: info
    disposition: open
    title: "Header comments carry plan numbers and history, against OR-2"
  - id: IN-14
    severity: info
    disposition: open
    title: "Server field errors on `access` (Add User) have nowhere to show and no focus target"
  - id: IN-15
    severity: info
    disposition: open
    title: "Audit Log \"today\" is fixed when the page opens"
  - id: IN-16
    severity: info
    disposition: open
    title: "Dead and unassociated error states in the Edit panel's email choice and `RoleField`"
  - id: IN-17
    severity: info
    disposition: open
    title: "`ConfirmDialog` duplicates `errorLine`"
  - id: IN-18
    severity: info
    disposition: open
    title: "`ResponsiveTable` declares `onToggleRow` but never uses it"
  - id: IN-19
    severity: info
    disposition: open
    title: "Modal Close button and Cancel look live while `loading`"
  - id: IN-20
    severity: info
    disposition: open
    title: "\"Server text never reaches the screen\" is no longer literally true"
  - id: IN-21
    severity: info
    disposition: open
    title: "Fixed sleeps in e2e specs"
  - id: IN-22
    severity: info
    disposition: open
    title: "`MobileNavDrawer` closes on any anchor click, including modified ones"
  - id: IN-23
    severity: info
    disposition: open
    title: "Production defaults that look like real data, and a needless tab stop"
  - id: IN-24
    severity: info
    disposition: open
    title: "Gitleaks allowlists are file-wide for the generic key rule; temporary-password entropy is modest"
  - id: IN-25
    severity: info
    disposition: open
    title: "Filter-chip tap areas overlap when chips wrap onto separate rows"
  - id: IN-26
    severity: info
    disposition: open
    title: "The purge comment promises more than the code can"
  - id: IN-27
    severity: info
    disposition: open
    title: "A Manager is told \"Reset link sent\" when D-49 sent nothing"
  - id: IN-28
    severity: info
    disposition: open
    title: "A person's own email change still leaves a reset link to the old address alive"
  - id: IN-29
    severity: info
    disposition: open
    title: "A new comment contradicts the hook's own header"
  - id: IN-30
    severity: info
    disposition: open
    title: "Test timeouts raised instead of the slow gate fixed"
open: 45
total: 53
recorded: 2026-10-19T10:00:09.190Z
---

# Phase 05: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | gap plan 05-44, re-review 2026-10-19 |
| WR-01 | warning | fixed | gap plan 05-45, re-review 2026-10-19 |
| WR-02 | warning | open | - |
| WR-03 | warning | fixed | gap plans 05-46 and 05-47 (owner D-49), re-review 2026-10-19 |
| WR-04 | warning | open | - |
| WR-05 | warning | fixed | gap plan 05-48, re-review 2026-10-19 |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| WR-08 | warning | fixed | gap plan 05-48, re-review 2026-10-19 |
| WR-09 | warning | fixed | gap plan 05-52, re-review 2026-10-19 |
| WR-10 | warning | open | - |
| WR-11 | warning | open | - |
| WR-12 | warning | open | - |
| WR-13 | warning | open | - |
| WR-14 | warning | fixed | gap plan 05-48, re-review 2026-10-19 |
| WR-15 | warning | open | - |
| WR-16 | warning | open | - |
| WR-17 | warning | open | - |
| WR-18 | warning | open | - |
| WR-19 | warning | open | - |
| WR-20 | warning | fixed | gap plans 05-50 and 05-51 (owner D-51), re-review 2026-10-19 |
| WR-21 | warning | open | - |
| WR-22 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| IN-10 | info | open | - |
| IN-11 | info | open | - |
| IN-12 | info | open | - |
| IN-13 | info | open | - |
| IN-14 | info | open | - |
| IN-15 | info | open | - |
| IN-16 | info | open | - |
| IN-17 | info | open | - |
| IN-18 | info | open | - |
| IN-19 | info | open | - |
| IN-20 | info | open | - |
| IN-21 | info | open | - |
| IN-22 | info | open | - |
| IN-23 | info | open | - |
| IN-24 | info | open | - |
| IN-25 | info | open | - |
| IN-26 | info | open | - |
| IN-27 | info | open | - |
| IN-28 | info | open | - |
| IN-29 | info | open | - |
| IN-30 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

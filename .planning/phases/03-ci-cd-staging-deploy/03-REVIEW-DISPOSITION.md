---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "A certificate loaded at registration time is never disposed when the container does not resolve its owner"
  - id: WR-02
    severity: warning
    disposition: open
    title: "A killed or crashed process leaves the Data Protection private key on the host, with no sweep and no documentation"
  - id: IN-01
    severity: info
    disposition: open
    title: "Documents still say the compatibility level is 160 after the re-pin to 170"
  - id: IN-02
    severity: info
    disposition: open
    title: "The IIS redirect builds the target from the client's Host header"
  - id: IN-03
    severity: info
    disposition: open
    title: "The smoke request-limit check has a stale constant comment and an optimistic \"IIS\" label"
  - id: IN-04
    severity: info
    disposition: open
    title: "`Restore-LegacyReceipt.ps1` hides why `RESTORE VERIFYONLY` failed"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "`hostprobe` action can replace a running CSPS site with the probe app; nothing enforces \"once, before the first deploy\""
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Smoke `request-limit` check passes on any non-2xx answer, so it cannot show that the limit works"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "`Restore-LegacyReceipt.ps1` drops the existing restore before validating the new `.bak`, and its default receipt path is a tracked file in a public repo"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "The whole \"7 package\" stage runs only on a push to `main`, so it has never run and a failure surfaces after the merge"
  - id: IN-05
    severity: info
    disposition: open
    title: "Failed redeploy of the live build rolls back to an older release, not to itself"
  - id: IN-06
    severity: info
    disposition: open
    title: "Dispatching `deploy.yml` from a non-main branch ends in a skipped (not failed) run"
open: 8
total: 12
recorded: 2026-10-17T15:57:16.624Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| WR-03 | warning | fixed | 03-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 03-REVIEW-FIX.md (not in the current review) |
| WR-05 | warning | fixed | 03-REVIEW-FIX.md (not in the current review) |
| WR-06 | warning | fixed | 03-REVIEW-FIX.md (not in the current review) |
| IN-05 | info | open | - (not in the current review) |
| IN-06 | info | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "`online` action ignores `dry_run` and really deletes `app_offline.htm`"
  - id: WR-02
    severity: warning
    disposition: skipped
    title: "Certificate pin is checked on a separate connection, then `-allowUntrusted` turns off all validation for msdeploy"
  - id: WR-03
    severity: warning
    disposition: open
    title: "`hostprobe` action can replace a running CSPS site with the probe app; nothing enforces \"once, before the first deploy\""
  - id: WR-04
    severity: warning
    disposition: open
    title: "Smoke `request-limit` check passes on any non-2xx answer, so it cannot show that the limit works"
  - id: WR-05
    severity: warning
    disposition: open
    title: "`Restore-LegacyReceipt.ps1` drops the existing restore before validating the new `.bak`, and its default receipt path is a tracked file in a public repo"
  - id: WR-06
    severity: warning
    disposition: open
    title: "The whole \"7 package\" stage runs only on a push to `main`, so it has never run and a failure surfaces after the merge"
  - id: IN-01
    severity: info
    disposition: open
    title: "Pre-commit hook fails open"
  - id: IN-02
    severity: info
    disposition: open
    title: "SQL container password is exported to every later step through `GITHUB_ENV`"
  - id: IN-03
    severity: info
    disposition: open
    title: "Test-quality softening in the E2E helpers"
  - id: IN-04
    severity: info
    disposition: open
    title: "`Directory.Build.props` decides \"is a src project\" from a substring of the full path"
  - id: IN-05
    severity: info
    disposition: open
    title: "Failed redeploy of the live build rolls back to an older release, not to itself"
  - id: IN-06
    severity: info
    disposition: open
    title: "Dispatching `deploy.yml` from a non-main branch ends in a skipped (not failed) run"
open: 10
total: 12
recorded: 2026-10-16T21:33:35.776Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 03-REVIEW-FIX.md |
| WR-02 | warning | skipped | 03-REVIEW-FIX.md |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

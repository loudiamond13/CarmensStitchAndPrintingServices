---
phase: 03-ci-cd-staging-deploy
plan: 20
subsystem: cutover-host
tags: [d-18, web-deploy, dry-run, host-probe, https-rewrite, self-contained, checkpoint]
created: "2026-10-17T09:30:00-05:00"
updated: "2026-10-17T09:30:00-05:00"
status: complete

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-19: SQL Server 2025 database db_…_cspsdb, level 170"
provides:
  - "Repository secrets WEBDEPLOY_SERVER, WEBDEPLOY_SITE, WEBDEPLOY_USERNAME, WEBDEPLOY_PASSWORD, HOSTPROBE_KEY and the variable SITE_ORIGIN (names only checked)"
  - "Read-only Web Deploy dry run green (run 38996354195)"
  - "Host probe facts Verified 2026-10-16 (runs 39000637708 and 39000906168)"
  - "Owner rulings 2026-10-16: IIS HttpToHttps rule, self-contained win-x64 package, MachineKeySet certificate load (quick 261016-w4u, PR #6)"
affects: [03-21, 03-22, deploy-packaging, data-protection]

actuals:
  tasks: 3
  commits: 15
plan_head_before: d0b42f4f2602c3c17175ae1f54ac3e83cba7cbe0
plan_head_after: 7bc80e460d0c2370c00c4effcee42f05207cce22

key-files:
  created: []
  modified:
    - .planning/HOSTING-RECORD.md
    - .planning/phases/03-ci-cd-staging-deploy/03-CUTOVER-LOG.md
---

# Phase 3 Plan 20: Host settings, credentials, dry run and host probe

Written after the fact on 2026-10-17 from the cutover log, the deploy run history and quick tasks 261016-ui0 and 261016-w4u. The commit count is the first-parent range above. It covers the two quick tasks that did this plan's code and record work: 8 ui0 commits, one merge of main and 6 w4u commits. It was not measured with a plan ledger.

- **Step 4 (owner):** the app-pool environment variables were set in the control panel. The cutover log has no row for the check of the names list. The live site proves them: the health check reaches the database, the site sends mail, it decrypts with the Data Protection certificate, it signs in (JWT and code keys), the invite link uses the right base URL, and AllowedHosts refuses a foreign Host (plans 03-21 and 03-22).
- **Step 5 (owner):** the four WEBDEPLOY_* secrets, HOSTPROBE_KEY and the variable SITE_ORIGIN exist. Claude checked the names only.
- **Dry run:** run 38993830113 failed before anything changed (`ERROR_DESTINATION_INVALID`, "the remote name could not be resolved: 'https'", a server value problem). After the owner corrected it, dry run 38996354195 (action deploy, dry_run true, `-whatif`) succeeded. The Web Deploy login, port 8172 and the certificate were proven, so no certificate pin was needed.
- **Probe:** hostprobe run 38996641830 showed the certificate load failing. Quick 261016-ui0 made the probe report each attempt. Runs 39000637708 (`probe_rewrite` false) and 39000906168 (`probe_rewrite` true) then gave the facts recorded in HOSTING-RECORD, Verified 2026-10-16. Runtime 10.0.7, in-process 64-bit, content root equals the current directory, logs folder writable, no proxy, TLS at IIS, Asia/Manila and en-PH, MachineKeySet the only working certificate load, urlCompression accepted, and URL Rewrite present.
- **Conditional checkpoint (runtime too old):** the owner chose the self-contained win-x64 package (2026-10-16).
- **HTTPS rewrite ruling (OPS-05):** the owner chose the IIS rule. Quick 261016-w4u built it, PR #6 merged it as bd34a88, and it is live since the first deploy.
- **Still Unverified:** the app-pool memory limit (the probe saw the server's memory, not the 256 MB pool limit).

## Self-Check: PASSED

- FOUND: runs 38993830113 (failure), 38996354195, 38996641830, 39000637708, 39000906168 (success) in `gh run list --workflow deploy.yml`
- FOUND: bd34a88 on origin/main

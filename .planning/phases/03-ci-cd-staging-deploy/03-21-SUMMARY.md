---
phase: 03-ci-cd-staging-deploy
plan: 21
subsystem: cutover-deploy
tags: [d-18, ops-04, first-deploy, smoke, release, hosting-record]
created: "2026-10-17T09:31:00-05:00"
updated: "2026-10-17T09:31:00-05:00"
status: complete

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-20: secrets, green dry run, probe facts, self-contained package with the IIS rule (PR #6)"
provides:
  - "Schema applied by the owner: 9 migrations, latest 20261015081003_AddIdempotencyRecords"
  - "First CSPS deploy on the live site: run 39006538697, release deploy-20261017053115-bd34a88"
  - "HOSTING-RECORD: HTTPS termination, AllowedHosts, requestLimits, IIS compression of JSON, static caching through IIS Verified 2026-10-17"
affects: [03-22, phase-04-uat]

actuals:
  tasks: 3
  commits: 5
plan_head_before: c6bb30a5864f4112b848f9d115584cf85c8326ac
plan_head_after: 1c231496e2f0b668b1269f17771d8de586eaf2f5

key-files:
  created: []
  modified:
    - .planning/HOSTING-RECORD.md
    - .planning/phases/03-ci-cd-staging-deploy/03-CUTOVER-LOG.md
---

# Phase 3 Plan 21: Schema applied and the first CSPS deploy

Written on 2026-10-17 from the cutover log and the deploy run. The 5 first-parent commits in the range are b14f15e and 0e088a2 (cutover log), 0e65223 and 52b8c99 (the flaky admin routes test fix found on the PR #6 gate), and 1c23149 (Task 3, done during plan 03-22's run).

- **Task 1 (owner, step 6):** the owner ran csps-migrations.sql in SSMS on `db_…_cspsdb`. `__EFMigrationsHistory` shows Applied 9, Latest 20261015081003_AddIdempotencyRecords. That matches the script: 9 guarded migrations and no DROP TABLE.
- **Task 2 (step 7):**
  - Run 39004727306 (action deploy) was refused by input validation ("The commit sha must be 40 lowercase hex characters"). Nothing on the site changed.
  - Run 39006538697 deployed sha bd34a88 (self-contained package from main CI run 39006074317) and succeeded. Smoke: 12 of 12 PASS. Release `deploy-20261017053115-bd34a88` was created.
  - The smoke from this PC (2026-10-17, during 03-22) also passed 12 of 12.
  - GET /probe now answers with the CSPS app shell, not the probe.

| Smoke check | Result |
|-------------|--------|
| health | 200 Healthy (self, database, time-zone) |
| unknown-api | 404 ProblemDetails with a traceId |
| default-deny | anonymous 401 ProblemDetails |
| missing-file | 404 ProblemDetails |
| https-redirect | http 301 to https |
| security-headers | HSTS, CSP script-src 'self' with no unsafe- |
| no-banners | no Server or X-Powered-By on 6 responses |
| shell-cache | index.html no-cache |
| hashed-asset | immutable and br |
| json-not-compressed | /health has no Content-Encoding |
| host-filter | Host smoke.invalid refused with 404 |
| request-limit | refused by the app with 413 |

- **Task 3 (commit 1c23149):** HOSTING-RECORD changes:
  - "HTTPS termination" now cites the deploy.
  - "AllowedHosts set to the real host names" and "web.config requestLimits honoured by IIS" moved from the Phase 4 checks into Facts.
  - New facts "IIS compression of JSON" and "Static caching through IIS". All are Verified 2026-10-17.
  - HostingRecordTests: 4 passed.
- **Deviation (record wording):** the 1.5 MB POST was refused by the app (413), not by IIS. The smoke does this on purpose, because 1.5 MB is below the 2 MiB IIS backstop. The requestLimits row says so plainly, and it says that a body over 2 MiB was not tried.
- **Open:** the HOSTPROBE_KEY repository secret still exists on 2026-10-17. The owner deletes it (listed in the cutover log follow-ups).

## Self-Check: PASSED

- FOUND: run 39006538697 success; release deploy-20261017053115-bd34a88 in `gh release list`
- FOUND: commits b14f15e, 0e088a2, 1c23149

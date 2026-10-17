---
phase: 03-ci-cd-staging-deploy
plan: 22
subsystem: cutover-acceptance
tags: [d-18, d-06, d-05, auth-12, auth-13, bootstrap, smoke, hosting-record, go-live]
created: "2026-10-17T09:29:00-05:00"
updated: "2026-10-17T09:29:00-05:00"
status: complete

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-21: first CSPS deploy (run 39006538697, release deploy-20261017053115-bd34a88)"
provides:
  - "First Manager bootstrapped on db_…_cspsdb and signed in on https://cspstailoring.com with the emailed code (AUTH-12, AUTH-13)"
  - "HOSTING-RECORD Facts: outbound SMTP, breach-check reach, __Secure-csps_rt cookie, Data Protection and PublicBaseUrl for the bootstrap, first bootstrap and sign-in (Verified 2026-10-17)"
  - "CSPS accepted live by the owner (2026-10-17); rollback means an earlier CSPS release (D-05)"
  - "Full smoke from this PC: 12 of 12 PASS"
affects: [phase-03-verification, phase-04-uat, gsd-ship-3]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/HOSTING-RECORD.md
    - .planning/phases/03-ci-cd-staging-deploy/03-CUTOVER-LOG.md

key-decisions:
  - "__Secure-csps_2fa stays Unverified: the owner did not observe it (it exists only during the code step); its attributes are pinned by the auth integration tests; it waits for the owner's sign-off"
  - "Breach-check evidence uses AuditLog.Action (the plan's EventType column does not exist): count 0"

metrics:
  duration: 10 min
  completed: 2026-10-17

actuals:
  tokens: 6000
  tasks: 2
  commits: 3
plan_head_before: 52b8c99525947e580f2404b467577b08ea534ac4
commits: 3
plan_head_after: 68dd87b5830d0ba78b54c83d5db98bb917a65186
---

# Phase 3 Plan 22: First Manager, first sign-in and CSPS accepted live Summary

The owner created the first Manager on the hosted database and signed in on the live site with the emailed code. That proved mail, the breach check, the refresh cookie and the Data Protection settings on the real host. A smoke run from this PC passed 12 of 12, every first-deploy row is now in the Facts table, and the owner accepted CSPS live on 2026-10-17.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Owner bootstraps the first Manager, signs in and accepts CSPS live (checkpoint) | owner, no commit | |
| 2 | Tracer: full smoke from this PC, every first-deploy row on record | 24f2129 | HOSTING-RECORD.md, 03-CUTOVER-LOG.md |

The ledger range also holds 1c23149 (plan 03-21 Task 3, the smoke-proved host facts, done in this run because 03-21 had not recorded them) and 68dd87b (the 03-20 and 03-21 summaries).

## Smoke from this PC (2026-10-17, read-only, exit 0)

```
PASS health: 200 Healthy (self, database, time-zone)
PASS unknown-api: 404 ProblemDetails with a traceId
PASS default-deny: anonymous request answered 401 ProblemDetails
PASS missing-file: a missing static file answered 404 ProblemDetails
PASS https-redirect: http answered 301 to https
PASS security-headers: HSTS present, CSP script-src 'self' with no unsafe-
PASS no-banners: no Server or X-Powered-By on 6 responses
PASS shell-cache: index.html is Cache-Control no-cache
PASS hashed-asset: /assets/index-CnEtPxSX.js is immutable and br compressed
PASS json-not-compressed: /health JSON has no Content-Encoding
PASS host-filter: Host smoke.invalid was refused with 404
PASS request-limit: refused by the app with 413
smoke: 12 of 12 checks passed
```

## HOSTING-RECORD rows changed

Into the Facts table, Verified 2026-10-17:
- Outbound SMTP from the site: the live site sent the queued invite, and the code email arrived.
- Outbound HTTPS to the breached-password service: `auth.breach-check-unavailable` count is 0.
- `__Secure-csps_rt` cookie: HttpOnly, Secure, SameSite Strict, Path /api/v1/auth.
- Data Protection certificate and `App:PublicBaseUrl` available to the bootstrap: the bootstrap exited 0, the site decrypted and sent the invite, and the link opened the live site.
- The real bootstrap and the first sign-in with an emailed code (AUTH-12).

Into the Facts table, Unverified with its reason:
- `__Secure-csps_2fa` cookie: not observed by the owner, and its attributes are pinned by the tests.

In plan 03-21 (commit 1c23149):
- HTTPS termination now cites the deploy.
- AllowedHosts, requestLimits, IIS compression of JSON and static caching through IIS are Verified 2026-10-17.

Other changes:
- The "Phase 3 first-deploy checks added by Phase 4" table is now a list that says where each row went.
- "Consequences" gained "CSPS is live": the legacy site is retired, there is no staging site, CSPS has been live since 2026-10-17, and a rollback means an earlier CSPS release.
- The HTTPS rewrite bullet now says it is live.
- The old 160 compatibility bullet is marked superseded by 170. Nothing historical was deleted.

## Follow-ups for /gsd-ship 3

- **HOSTPROBE_KEY** is still in the repository secrets on 2026-10-17. The owner deletes it. The probe is gone from the site: GET /probe returns the CSPS app shell.
- **`__Secure-csps_2fa`** needs the owner's sign-off on the test-pinned attributes, or a look during the next code step.
- **Compatibility re-pin:** done. Level 170 is on main (PR #5).
- **IIS rewrite rule:** done. It reached main in PR #6 and is live.
- **Still Unverified, with reasons:** the app-pool memory limit and the `model` compatibility level.
- **Carried from 03-19:** whether the lower-rights SQL user (runbook step 3.4) was created is still not confirmed.

## Deviations from Plan

**1. [Rule 1 - Bug] Breach-check query column name**
- **Found during:** Task 1 (owner)
- **Issue:** the plan's query used `EventType`. The AuditLog column is `Action`.
- **Fix:** the owner ran it with `Action`. The record quotes the corrected query.

**2. [Rule 2 - Scope] Plan 03-21 Task 3 done here**
- **Issue:** 03-21 had not moved the smoke-proved facts into HOSTING-RECORD. This plan's acceptance needs that table clean.
- **Fix:** commit 1c23149, made under the 03-21 scope.

**3. Cookie row split**
- The single "Set-Cookie for both cookies" row became two Facts rows, so the verified `__Secure-csps_rt` is not held back by the unobserved `__Secure-csps_2fa`.

## Verification

- `node web/scripts/smoke.mjs --origin https://cspstailoring.com`: 12 of 12, exit 0.
- HostingRecordTests: 4 of 4 passed (after each record change). HostingRecordTests, CutoverRunbookTests and RepoRulesTests together: 29 of 29 passed.
- The grep for "CSPS accepted live by the owner" in the cutover log prints 1. The grep for "Step 7: first" prints 1.
- The staged-diff scan and the gitleaks hook found nothing on every commit.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: .planning/HOSTING-RECORD.md, .planning/phases/03-ci-cd-staging-deploy/03-CUTOVER-LOG.md
- FOUND commits: 1c23149, 24f2129, 68dd87b (ancestors of HEAD)

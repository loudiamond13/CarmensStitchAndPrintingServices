---
status: testing
phase: 03-ci-cd-staging-deploy
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md, 03-07-SUMMARY.md, 03-08-SUMMARY.md, 03-09-SUMMARY.md, 03-10-SUMMARY.md, 03-11-SUMMARY.md, 03-12-SUMMARY.md, 03-13-SUMMARY.md, 03-14-SUMMARY.md, 03-15-SUMMARY.md, 03-16-SUMMARY.md, 03-17-SUMMARY.md, 03-18-SUMMARY.md, 03-19-SUMMARY.md, 03-20-SUMMARY.md, 03-21-SUMMARY.md, 03-22-SUMMARY.md, 03-23-SUMMARY.md]
created: 2026-10-17T09:50:07-05:00
started: 2026-10-17T09:50:07-05:00
updated: 2026-10-17T10:06:21-05:00
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 6
name: Weekly all-engine run
expected: |
  Weekly run 39043267415 (dispatched on main 2026-10-17T15:01Z) finishes green, including Firefox and WebKit in the end-to-end tests. Claude is watching it and records the result.
awaiting: user response

## Tests

### 1. Holding page on a phone
expected: Every public path on https://cspstailoring.com shows the branded holding page with shop name, new-website line, address, hours, a tappable +63 phone link and the Facebook link; no sideways scroll; the look matches what the owner expects (03-09 D1, D5)
result: pass

### 2. Staff sign-in on the live site
expected: https://cspstailoring.com/admin/login accepts the Manager's email and password, the emailed code arrives, and entering it opens the admin portal (03-22, re-check after go-live)
result: pass

### 3. Deploy workflow form on GitHub
expected: GitHub, Actions, Deploy, Run workflow shows the branch fixed to main and the inputs action, commit sha and dry run; the run list shows the dry run 38996354195 and deploy 39006538697 as successful (03-12 D5). Do not start a run for this test.
result: pass

### 4. Offline page look
expected: Opening tools/deploy/app_offline.htm in a browser and narrowing the window to phone width shows the branded "we will be right back" page, readable, with no sideways scroll (03-12 D4)
result: pass

### 5. Secret scan blocks a commit
expected: In a scratch copy with the hook installed (tools/scripts/Install-Gitleaks.ps1 -SetHooksPath), staging a file with a fake key and running git commit is refused with a gitleaks finding; with nothing staged, commit is not blocked (03-10 D4)
result: pass

### 6. Weekly all-engine run
expected: GitHub, Actions, Weekly, Run workflow on main (or the first scheduled run, Sunday 18:00 UTC = Monday 2:00 AM Manila) finishes green with the extra browser engines (03-11 D4)
result: [pending]

### 7. Docs-only PR passes the required check
expected: The docs-only PR that carries this UAT file gets gate (docs) green with the Hygiene and Security checks, and Merge-PullRequest.ps1 accepts it (03-16 D2)
result: [pending]

### 8. Operations docs read clearly
expected: docs/operations/ci.md (run kinds, reading a failed run, minutes, the fallback) and docs/operations/deploy.md (the deploy and rollback runbook) are clear to the owner in plain words (03-11 D5, 03-12 D4)
result: pass

<!-- Automated: deterministically covered by passing tests in each SUMMARY's coverage block. -->

### 9. Every PR to main and every push to main gets one CI check named gate (<mode>) on ubuntu-24.04; the .NET steps run locked restore, build, format check, unit tests, integration tests (container, full mode only), architecture tests in that order
expected: Every PR to main and every push to main gets one CI check named gate (<mode>) on ubuntu-24.04; the .NET steps run locked restore, build, format check, unit tests, integration tests (container, full mode only), architecture tests in that order
result: pass
source: automated
coverage_id: 03-01 D1

### 10. Every uses: is an owner-approved full commit SHA with a version comment; top-level permissions are empty; every job has a timeout; every checkout sets persist-credentials: false; runner labels are pinned; no pull_request_target; no event data inside run:
expected: Every uses: is an owner-approved full commit SHA with a version comment; top-level permissions are empty; every job has a timeout; every checkout sets persist-credentials: false; runner labels are pinned; no pull_request_target; no event data inside run:
result: pass
source: automated
coverage_id: 03-01 D2

### 11. ci.yml triggers (pull_request on main with four types, push to main, workflow_dispatch, no path filter) and concurrency (cancel older PR runs, never cancel main)
expected: ci.yml triggers (pull_request on main with four types, push to main, workflow_dispatch, no path filter) and concurrency (cancel older PR runs, never cancel main)
result: pass
source: automated
coverage_id: 03-01 D3

### 12. The Phase 3 draft pull request to main exists and the head commit's gate (fast) check passes on GitHub
expected: The Phase 3 draft pull request to main exists and the head commit's gate (fast) check passes on GitHub
result: pass
source: automated
coverage_id: 03-01 D5

### 13. CSPS_E2E_CONNECTION drives both the E2E seed (--connection) and the E2E host (ConnectionStrings__Csps); unset or blank keeps CSPS_E2E on LocalDB
expected: CSPS_E2E_CONNECTION drives both the E2E seed (--connection) and the E2E host (ConnectionStrings__Csps); unset or blank keeps CSPS_E2E on LocalDB
result: pass
source: automated
coverage_id: 03-02 D1

### 14. A failing seed reports only the step name and exit code, never the connection value
expected: A failing seed reports only the step name and exit code, never the connection value
result: pass
source: automated
coverage_id: 03-02 D2

### 15. The merge gate allows a merge only when the PR is open, targets main, is not a draft, is 0 commits behind, is mergeable, has a passing gate (full) or gate (docs) check and no failed, pending or cancelled check, and every Definition of Done item is ticked; each refusal has its own plain-English reason
expected: The merge gate allows a merge only when the PR is open, targets main, is not a draft, is 0 commits behind, is mergeable, has a passing gate (full) or gate (docs) check and no failed, pending or cancelled check, and every Definition of Done item is ticked; each refusal has its own plain-English reason
result: pass
source: automated
coverage_id: 03-03 D1

### 16. The gate fails closed: zero checks, only gate (fast), a missing or empty Definition of Done, and gh output that cannot be read or parsed are all refused
expected: The gate fails closed: zero checks, only gate (fast), a missing or empty Definition of Done, and gh output that cannot be read or parsed are all refused
result: pass
source: automated
coverage_id: 03-03 D2

### 17. The /gsd-ship [ci skip] ship note follows the owner's parent-rule, and every other skip-token head is refused
expected: The /gsd-ship [ci skip] ship note follows the owner's parent-rule, and every other skip-token head is refused
result: pass
source: automated
coverage_id: 03-03 D3

### 18. --local-gate (D-16) replaces the green-check rule with a Local full gate section that lists the five commands each marked exit 0, still refuses a failed check, and always prints the warning
expected: --local-gate (D-16) replaces the green-check rule with a Local full gate section that lists the five commands each marked exit 0, still refuses a failed check, and always prints the warning
result: pass
source: automated
coverage_id: 03-03 D4

### 19. A draft PR is fast; a ready PR whose files are all docs (.planning/** or .md outside src, web, tests, tools, .github) is docs; every other ready PR is full
expected: A draft PR is fast; a ready PR whose files are all docs (.planning/** or .md outside src, web, tests, tools, .github) is docs; every other ready PR is full
result: pass
source: automated
coverage_id: 03-04 D1

### 20. An empty changed-file list, a failed or signalled git diff, or a malformed commit id gives full, never docs
expected: An empty changed-file list, a failed or signalled git diff, or a malformed commit id gives full, never docs
result: pass
source: automated
coverage_id: 03-04 D2

### 21. A push to main is package only when exactly one merged PR claims the commit, the PR head tree id equals the pushed tree id, and the head has a successful gate (full) run; anything else is full
expected: A push to main is package only when exactly one merged PR claims the commit, the PR head tree id equals the pushed tree id, and the head has a successful gate (full) run; anything else is full
result: pass
source: automated
coverage_id: 03-04 D3

### 22. workflow_dispatch, schedule, workflow_call, unknown events and a missing event name are full; the CLI writes exactly one mode line and exits 2 when GITHUB_OUTPUT is missing or unwritable
expected: workflow_dispatch, schedule, workflow_call, unknown events and a missing event name are full; the CLI writes exactly one mode line and exits 2 when GITHUB_OUTPUT is missing or unwritable
result: pass
source: automated
coverage_id: 03-04 D4

### 23. CODEOWNERS names @loudiamond13 for every path and for /.github/
expected: CODEOWNERS names @loudiamond13 for every path and for /.github/
result: pass
source: automated
coverage_id: 03-05 D1

### 24. The PR template has the 12 unticked PRD section 22 items in PRD order, the CodeQL clause replaced, a Conventional Commits title line, the Local full gate section, and timestamps only in an HTML comment
expected: The PR template has the 12 unticked PRD section 22 items in PRD order, the CodeQL clause replaced, a Conventional Commits title line, the Local full gate section, and timestamps only in an HTML comment
result: pass
source: automated
coverage_id: 03-05 D2

### 25. .gitignore keeps every PRD section 18 entry
expected: .gitignore keeps every PRD section 18 entry
result: pass
source: automated
coverage_id: 03-05 D3

### 26. branch-rules.md, main-ruleset.json and the CLAUDE.md merge rule describe the process gate and the rules ready to switch on
expected: branch-rules.md, main-ruleset.json and the CLAUDE.md merge rule describe the process gate and the rules ready to switch on
result: pass
source: automated
coverage_id: 03-05 D4

### 27. Dependabot covers nuget, npm (both manifests in one entry) and github-actions, monthly, grouped, Conventional Commits prefixes, 14-day cooldown on each
expected: Dependabot covers nuget, npm (both manifests in one entry) and github-actions, monthly, grouped, Conventional Commits prefixes, 14-day cooldown on each
result: pass
source: automated
coverage_id: 03-05 D5

### 28. D-13 rollback: a failed sync or smoke re-runs offline, sync, online, smoke with the last good package and exits 1 naming the release; a failed rollback or the first deploy puts app_offline.htm back and points to the D-05 kit in docs/operations/deploy.md; the last good release never equals the sha being deployed
expected: D-13 rollback: a failed sync or smoke re-runs offline, sync, online, smoke with the last good package and exits 1 naming the release; a failed rollback or the first deploy puts app_offline.htm back and points to the D-05 kit in docs/operations/deploy.md; the last good release never equals the sha being deployed
result: pass
source: automated
coverage_id: 03-06 D2

### 29. Package comes only from a successful push run of ci.yml on main for that exact sha (artifact csps-package-<sha>) or the existing deploy release for it; a malformed or empty sha is refused before any gh call
expected: Package comes only from a successful push run of ci.yml on main for that exact sha (artifact csps-package-<sha>) or the existing deploy release for it; a malformed or empty sha is refused before any gh call
result: pass
source: automated
coverage_id: 03-06 D3

### 30. Secrets: the password is redacted from every printed line and from tool output, credentials with a comma, quote, semicolon, space or control character are refused without echoing them, and -allowUntrusted is added only after the certificate SHA-256 pin matches
expected: Secrets: the password is redacted from every printed line and from tool output, credentials with a comma, quote, semicolon, space or control character are refused without echoing them, and -allowUntrusted is added only after the certificate SHA-256 pin matches
result: pass
source: automated
coverage_id: 03-06 D4

### 31. hostprobe action: key under 32 characters refused before publishing, key written only into the runner's published appsettings.json, urlCompression (and optionally one HTTPS rewrite rule) injected into the probe web.config, then offline, sync, online and the probe reader; no release; offline page back on failure
expected: hostprobe action: key under 32 characters refused before publishing, key written only into the runner's published appsettings.json, urlCompression (and optionally one HTTPS rewrite rule) injected into the probe web.config, then offline, sync, online and the probe reader; no release; offline page back on failure
result: pass
source: automated
coverage_id: 03-06 D5

### 32. Health check passes only on 200 JSON, no-store, status Healthy and self, database, time-zone Healthy; it retries a 503, a missing check, a non-JSON body or a connection error with 2, 4, 8, 15 second backoff and gives up before 90 seconds naming the last status
expected: Health check passes only on 200 JSON, no-store, status Healthy and self, database, time-zone Healthy; it retries a 503, a missing check, a non-JSON body or a connection error with 2, 4, 8, 15 second backoff and gives up before 90 seconds naming the last status
result: pass
source: automated
coverage_id: 03-07 D1

### 33. Unknown API path, anonymous site-settings and a missing static file must be real ProblemDetails; an IIS HTML page or the SPA shell fails
expected: Unknown API path, anonymous site-settings and a missing static file must be real ProblemDetails; an IIS HTML page or the SPA shell fails
result: pass
source: automated
coverage_id: 03-07 D2

### 34. OPS-05 hosting checks: http redirects 301/307/308 to https without following, HSTS and a CSP with script-src 'self' and no unsafe-, no Server or X-Powered-By, shell no-cache, first hashed asset immutable with br or gzip, /health JSON never compressed
expected: OPS-05 hosting checks: http redirects 301/307/308 to https without following, HSTS and a CSP with script-src 'self' and no unsafe-, no Server or X-Powered-By, shell no-cache, first hashed asset immutable with br or gzip, /health JSON never compressed
result: pass
source: automated
coverage_id: 03-07 D3

### 35. First-deploy host checks: Host smoke.invalid with the real SNI is not 2xx, a 1.5 MB POST is never 2xx and the detail names IIS or the app
expected: First-deploy host checks: Host smoke.invalid with the real SNI is not 2xx, a 1.5 MB POST is never 2xx and the detail names IIS or the app
result: pass
source: automated
coverage_id: 03-07 D4

### 36. Probe reader: X-Probe-Key sent, key under 32 characters or missing exits 2 before any request, facts printed, key never printed, http redirect reported
expected: Probe reader: X-Probe-Key sent, key under 32 characters or missing exits 2 before any request, facts printed, key never printed, http redirect reported
result: pass
source: automated
coverage_id: 03-07 D5

### 37. The shipped web.config turns IIS static and dynamic compression off, keeps in-process hosting, the banner removal and the 1 MiB request limit, and has no rewrite section
expected: The shipped web.config turns IIS static and dynamic compression off, keeps in-process hosting, the banner removal and the 1 MiB request limit, and has no rewrite section
result: pass
source: automated
coverage_id: 03-08 D1

### 38. A Release win-x64 framework-dependent publish holds no logs folder and no appsettings.Development.json and still holds appsettings.json, web.config and Csps.Server.dll
expected: A Release win-x64 framework-dependent publish holds no logs folder and no appsettings.Development.json and still holds appsettings.json, web.config and Csps.Server.dll
result: pass
source: automated
coverage_id: 03-08 D2

### 39. The four src projects declare win-x64, their lock files carry the win-x64 section, a locked restore passes, and the license gate and THIRD-PARTY-NOTICES.md are current
expected: The four src projects declare win-x64, their lock files carry the win-x64 section, a locked restore passes, and the license gate and THIRD-PARTY-NOTICES.md are current
result: pass
source: automated
coverage_id: 03-08 D3

### 40. Every public path shows one branded holding page with the shop name, the new-website line, the address, the hours, the phone as a tel:+63 link and the Facebook page as an https link with rel noopener noreferrer, all from the owner's answers; no placeholder, no # link, no long dash
expected: Every public path shows one branded holding page with the shop name, the new-website line, the address, the hours, the phone as a tel:+63 link and the Facebook page as an https link with rel noopener noreferrer, all from the owner's answers; no placeholder, no # link, no long dash
result: pass
source: automated
coverage_id: 03-09 D1

### 41. The holding page meets the gates: one h1, zero axe violations at component and page level, no horizontal scroll at 320 px, 44 px touch targets, one main, no banner or contentinfo, strict CSP
expected: The holding page meets the gates: one h1, zero axe violations at component and page level, no horizontal scroll at 320 px, 44 px touch targets, one main, no banner or contentinfo, strict CSP
result: pass
source: automated
coverage_id: 03-09 D2

### 42. deploy.yml runs only on workflow_dispatch and only from main, on windows-2025 with a 30 minute timeout, with an empty top-level token and job permissions of exactly contents write and actions read, and a concurrency group that never cancels
expected: deploy.yml runs only on workflow_dispatch and only from main, on windows-2025 with a 30 minute timeout, with an empty top-level token and job permissions of exactly contents write and actions read, and a concurrency group that never cancels
result: pass
source: automated
coverage_id: 03-12 D1

### 43. Every dispatch input and secret reaches deploy.mjs through env only; the deploy step passes exactly the variables deploy.mjs reads; the job installs no npm package; the orchestrator scripts import Node built-ins only
expected: Every dispatch input and secret reaches deploy.mjs through env only; the deploy step passes exactly the variables deploy.mjs reads; the job installs no npm package; the orchestrator scripts import Node built-ins only
result: pass
source: automated
coverage_id: 03-12 D2

### 44. app_offline.htm is self-contained and under 8 KB, and no package can carry one
expected: app_offline.htm is self-contained and under 8 KB, and no package can carry one
result: pass
source: automated
coverage_id: 03-12 D3

### 45. checkPackage refuses logs, app_offline.htm, environment settings files, .pfx/.pem/.key, secrets.json and .env files, and a package missing web.config (in-process), wwwroot/index.html or Csps.Server.dll; the CLI exits 0, 1 or 2 as specified
expected: checkPackage refuses logs, app_offline.htm, environment settings files, .pfx/.pem/.key, secrets.json and .env files, and a package missing web.config (in-process), wwwroot/index.html or Csps.Server.dll; the CLI exits 0, 1 or 2 as specified
result: pass
source: automated
coverage_id: 03-13 D1

### 46. Stage 7 runs only on a push to main in full or package mode, in the D-11 order, and uploads csps-package-<sha> (site/ and csps-migrations.sql) for 14 days with if-no-files-found error
expected: Stage 7 runs only on a push to main in full or package mode, in the D-11 order, and uploads csps-package-<sha> (site/ and csps-migrations.sql) for 14 days with if-no-files-found error
result: pass
source: automated
coverage_id: 03-13 D3

### 47. The package scan uses the same pinned gitleaks 8.30.1 tarball and SHA-256 as the Hygiene workflow, checked before unpack and before use
expected: The package scan uses the same pinned gitleaks 8.30.1 tarball and SHA-256 as the Hygiene workflow, checked before unpack and before use
result: pass
source: automated
coverage_id: 03-13 D4

### 48. The cutover runbook has the eight ordered steps with the five labels, names every host setting and checks each against src/, links its docs, holds no secret, switches the pool only in Step 4, and names both site addresses
expected: The cutover runbook has the eight ordered steps with the five labels, names every host setting and checks each against src/, links its docs, holds no secret, switches the pool only in Step 4, and names both site addresses
result: pass
source: automated
coverage_id: 03-14 D2

### 49. checkSubject accepts the Conventional Commits forms (type, optional lower case scope, optional !, a git Revert subject, the ship-note form) and refuses everything else with a reason; main checks the PR title and every non-merge subject in BASE_SHA..HEAD_SHA, exits 1 on an offender, 2 on a missing or non-commit id or a failing git log
expected: checkSubject accepts the Conventional Commits forms (type, optional lower case scope, optional !, a git Revert subject, the ship-note form) and refuses everything else with a reason; main checks the PR title and every non-merge subject in BASE_SHA..HEAD_SHA, exits 1 on an offender, 2 on a missing or non-commit id or a failing git log
result: pass
source: automated
coverage_id: 03-15 D1

### 50. hygiene.yml has the `commit messages` job on pull_request only, with fetch-depth 0, persist-credentials false, Node 24.21.0, and the title and range in env only (CWE-77)
expected: hygiene.yml has the `commit messages` job on pull_request only, with fetch-depth 0, persist-credentials false, Node 24.21.0, and the title and range in env only (CWE-77)
result: pass
source: automated
coverage_id: 03-15 D3

### 51. Squash-only merges, Dependabot alerts and security updates, and the SHA-pin requirement applied and read back from the API
expected: Squash-only merges, Dependabot alerts and security updates, and the SHA-pin requirement applied and read back from the API
result: pass
source: automated
coverage_id: 03-16 D1

### 52. gate (full) green on GitHub with every Hygiene and Security check green
expected: gate (full) green on GitHub with every Hygiene and Security check green
result: pass
source: automated
coverage_id: 03-16 D3

### 53. Ruleset on main applied and read back; interim ruleset deleted
expected: Ruleset on main applied and read back; interim ruleset deleted
result: pass
source: automated
coverage_id: 03-16 D4

### 54. Real CI minutes measured and recorded
expected: Real CI minutes measured and recorded
result: pass
source: automated
coverage_id: 03-16 D6

### 55. ROADMAP Phase 3 entry (title, goal, success criteria 1 to 6, prerequisites, research flag) matches D-01 to D-19 and GSD lookups still resolve Phase 3
expected: ROADMAP Phase 3 entry (title, goal, success criteria 1 to 6, prerequisites, research flag) matches D-01 to D-19 and GSD lookups still resolve Phase 3
result: pass
source: automated
coverage_id: 03-23 D1

### 56. OPS-04, OPS-01, MIG-04, MIG-08, CUT-02 and the Prime Directive 1 out-of-scope row carry the approved wording
expected: OPS-04, OPS-01, MIG-04, MIG-08, CUT-02 and the Prime Directive 1 out-of-scope row carry the approved wording
result: pass
source: automated
coverage_id: 03-23 D2

<!-- Proven by evidence: human checkpoints later shown by real runs during plans 03-16 to 03-22. -->

### 57. Each CI action and binary was owner-approved at its exact version and SHA and recorded (03-01 D4)
expected: Each CI action and binary was owner-approved at its exact version and SHA and recorded (03-01 D4)
result: pass
source: evidence
evidence: docs/dependencies.json approvals; owner approve-all 2026-10-15T22:05-05:00

### 58. Coverage gate runs on ubuntu / PowerShell 7 (03-02 D3)
expected: Coverage gate runs on ubuntu / PowerShell 7 (03-02 D3)
result: pass
source: evidence
evidence: gate (full) green on GitHub, plan 03-16 D3

### 59. Merge-PullRequest.ps1 runs the gate and squash-merges with --match-head-commit (03-03 D5)
expected: Merge-PullRequest.ps1 runs the gate and squash-merges with --match-head-commit (03-03 D5)
result: pass
source: evidence
evidence: PRs 1, 4, 5 and 6 merged through the script on the owner's instruction (03-17, 03-19, 03-20)

### 60. main is protected (03-05 D6)
expected: main is protected (03-05 D6)
result: pass
source: evidence
evidence: repo public 2026-10-16; ruleset on main applied and read back (03-16 D4)

### 61. Deploy order: offline page, sync, online, smoke, release (03-06 D1)
expected: Deploy order: offline page, sync, online, smoke, release (03-06 D1)
result: pass
source: evidence
evidence: deploy run 39006538697 succeeded, release deploy-20261017053115-bd34a88 (03-21)

### 62. Real SmarterASP.NET Web Deploy endpoint answers (03-06 D6)
expected: Real SmarterASP.NET Web Deploy endpoint answers (03-06 D6)
result: pass
source: evidence
evidence: dry run 38996354195 succeeded: login, port 8172 and certificate proven (03-20)

### 63. The twelve smoke checks pass against the real host (03-07 D6)
expected: The twelve smoke checks pass against the real host (03-07 D6)
result: pass
source: evidence
evidence: smoke 12 of 12 from CI and from this PC on 2026-10-17 (03-21, 03-22)

### 64. Host allows urlCompression in web.config and has URL Rewrite (03-08 D4)
expected: Host allows urlCompression in web.config and has URL Rewrite (03-08 D4)
result: pass
source: evidence
evidence: host probe runs 39000637708 and 39000906168 (03-20, HOSTING-RECORD)

### 65. Public JS and CSS budgets hold with the holding page (03-09 D3)
expected: Public JS and CSS budgets hold with the holding page (03-09 D3)
result: pass
source: evidence
evidence: gate (full) green on GitHub, plan 03-16 D3

### 66. Secret scan job runs on PRs and pushes to main (03-10 D1)
expected: Secret scan job runs on PRs and pushes to main (03-10 D1)
result: pass
source: evidence
evidence: Hygiene checks green on PR 1 (03-16 D3)

### 67. Full history scans clean (03-10 D2)
expected: Full history scans clean (03-10 D2)
result: pass
source: evidence
evidence: Hygiene secret scan green on GitHub (03-16 D3)

### 68. Install-Gitleaks.ps1 refuses an unpinned download and sets only the local hooks path (03-10 D3)
expected: Install-Gitleaks.ps1 refuses an unpinned download and sets only the local hooks path (03-10 D3)
result: pass
source: evidence
evidence: checked again by hands-on test 5

### 69. classify job and stages 1 to 4 run in order (03-11 D1, D2)
expected: classify job and stages 1 to 4 run in order (03-11 D1, D2)
result: pass
source: evidence
evidence: gate (full) green on GitHub (03-16 D3)

### 70. Stages 5 and 6 run in full mode (03-11 D3)
expected: Stages 5 and 6 run in full mode (03-11 D3)
result: pass
source: evidence
evidence: first full-mode run green on PR 1 (03-16 D3)

### 71. A real win-x64 publish passes the package check (03-13 D2)
expected: A real win-x64 publish passes the package check (03-13 D2)
result: pass
source: evidence
evidence: main CI run 39006074317 built and checked the self-contained package (03-21)

### 72. Stage 7 runs on push to main and uploads csps-package-<sha> (03-13 D5)
expected: Stage 7 runs on push to main and uploads csps-package-<sha> (03-13 D5)
result: pass
source: evidence
evidence: CI run 38977811876 uploaded csps-package-ba7c8a7... (03-17)

### 73. Restore-LegacyReceipt.ps1 fixed server and database, catalog-only queries, path refusals (03-14 D1)
expected: Restore-LegacyReceipt.ps1 fixed server and database, catalog-only queries, path refusals (03-14 D1)
result: pass
source: evidence
evidence: real restore in 03-18 under the preflight

### 74. Restore and receipt run end to end against the real .bak (03-14 D3)
expected: Restore and receipt run end to end against the real .bak (03-14 D3)
result: pass
source: evidence
evidence: 03-18: 17 tables, 988 rows restored to CSPS_Legacy_Restore

### 75. Cutover runbook steps work on the real control panel and host (03-14 D4)
expected: Cutover runbook steps work on the real control panel and host (03-14 D4)
result: pass
source: evidence
evidence: cutover steps 1 to 8 completed, 03-CUTOVER-LOG.md (03-19 to 03-22)

### 76. Branch history and PR title pass the Conventional Commits check (03-15 D2)
expected: Branch history and PR title pass the Conventional Commits check (03-15 D2)
result: pass
source: evidence
evidence: commit messages job green on PR 1 (03-16 D3)

### 77. actionlint and zizmor jobs install pinned tools and lint every workflow (03-15 D4, D5)
expected: actionlint and zizmor jobs install pinned tools and lint every workflow (03-15 D4, D5)
result: pass
source: evidence
evidence: Hygiene checks green on PR 1 (03-16 D3)

### 78. PROJECT.md records the Prime Directive 1 override and amended legacy text (03-23 D3)
expected: PROJECT.md records the Prime Directive 1 override and amended legacy text (03-23 D3)
result: pass
source: evidence
evidence: owner approved the wording at the 03-23 Task 1 checkpoint

### 79. Pipeline merged, legacy backup proven, new DB created, host set up, first deploy, first Manager signed in, CSPS accepted live (03-17 to 03-22)
expected: Pipeline merged, legacy backup proven, new DB created, host set up, first deploy, first Manager signed in, CSPS accepted live (03-17 to 03-22)
result: pass
source: evidence
evidence: owner accepted CSPS live 2026-10-17; 03-CUTOVER-LOG.md

### 80. Lighthouse mobile LCP under 2000 ms (03-09 D4, 03-16 D5)
expected: LCP under 2000 ms on mobile
result: skipped
reason: "Deferred: owner-approved relaxation, LCP is report-only until Phase 11 (deferred-items.md)"

## Summary

total: 80
passed: 77
issues: 0
pending: 2
skipped: 1
blocked: 0

## Gaps

[none yet]

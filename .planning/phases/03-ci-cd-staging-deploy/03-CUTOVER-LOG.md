---
phase: 03-ci-cd-staging-deploy
created: "2026-10-16T17:54:41-05:00"
updated: "2026-10-17T09:27:00-05:00"
---

# Phase 3 cutover log

Evidence for the D-18 cutover. Run ids, shas, artifact and release names and dates only; never secrets.

| Step | Date | Evidence | Checked by Claude |
|------|------|----------|-------------------|
| Pipeline merged | 2026-10-16 | PR #1 squash-merged by `Merge-PullRequest.ps1 -Pr 1 -KeepBranch` as fb9b20cb07d3782dc7bdaedd0625aa1f154ebf3d. GitHub built its squash message from the full commit log, which quoted a skip marker, so no push workflow ran on it and no package was built. Fixed by quick task 261016-ns5 (PR #4): the script now sets the squash message and the gate refuses skip markers. PR #4 merged by `Merge-PullRequest.ps1 -Pr 4 -KeepBranch` as ba7c8a7493e2b5d4465e58b8c541e8fcb240f4f6. Main push CI run 38977811876 (mode package): success, artifact `csps-package-ba7c8a7493e2b5d4465e58b8c541e8fcb240f4f6`. deploy.yml and weekly.yml are on main (Deploy and Weekly workflows registered). Branch brought level with main after each merge (empty `git diff --stat origin/main HEAD`). | Yes |
| Step 1: backup and legacy files | 2026-10-16 | Legacy .bak exported 2026-10-06 (5.1 MB; owner confirms the site was not used since). Copied in _local as legacy-20261006.bak so the hosting database id stays out of the repo. Legacy site files as a zip in _local (9.7 MB). Both git-ignored; `git status --porcelain -- _local` empty. Off-host copies: this PC (_local) and the owner's other computer. | Yes |
| Step 2: receipt ready | 2026-10-16 | Restored into CSPS_Legacy_Restore on (localdb)\MSSQLLocalDB by Restore-LegacyReceipt.ps1 (backup verified first). 17 tables, 988 rows. SHA-256 c9100fb0a390... Receipt kept in _local/legacy-receipt.md (git-ignored, names and counts only). | Yes |
| Step 2: receipt confirmed by the owner (2026-10-16) | 2026-10-16 | Owner replied confirmed-go after reviewing the 17 tables and 988 rows. | Yes |
| Step 3: new database | 2026-10-16 | Legacy database deleted by the owner (preserved only in the .bak). New database `db_…_cspsdb`: SQL Server 2025 (RTM-CU3) 17.0.4025.3, Standard Edition; compatibility_level 170; collation SQL_Latin1_General_CP1_CI_AS. SqlCompatibility.Level re-pinned 160 to 170; Infrastructure integration suite and full .NET suite green on LocalDB 17.0.4025.3. | Yes |
| Probe (probe_rewrite false) | 2026-10-16 | deploy.yml action hostprobe, run 39000637708: success. Probe facts recorded in HOSTING-RECORD (Verified 2026-10-16). | Yes |
| Probe (probe_rewrite true) | 2026-10-16 | deploy.yml action hostprobe, run 39000906168: success. http answered 301 to https, so the URL Rewrite module is present. Follow-up on the phase branch, quick 261016-w4u: self-contained win-x64 package, the IIS HttpToHttps rule and the MachineKeySet certificate load. | Yes |
| Step 6: schema applied | 2026-10-16 | Owner ran csps-migrations.sql (package csps-package-3b502ef..., no migration changes since) in SSMS on the new database: completed. `__EFMigrationsHistory`: Applied 9, Latest 20261015081003_AddIdempotencyRecords, matching the script (9 guarded migrations, no DROP TABLE). | Yes |
| Follow-up merged | 2026-10-17 | PR #6 (quick 261016-w4u) merged by `Merge-PullRequest.ps1 -Pr 6 -KeepBranch` as bd34a88f83c27884087f3322cad3a0fb7be732da. First full-gate run failed on a flaky web test (admin routes, unhandled GET /api/v1/sessions after the redirect); the rerun passed unchanged. | Yes |
| Step 7: first CSPS deploy | 2026-10-17 | deploy.yml action deploy, sha bd34a88f83c27884087f3322cad3a0fb7be732da (self-contained win-x64 package from main CI run 39006074317), run 39006538697: success. Smoke all PASS: health 200 Healthy (self, database, time-zone); unknown API 404 ProblemDetails with traceId; anonymous 401; missing file 404; http 301 to https; HSTS and strict CSP; no Server/X-Powered-By; index.html no-cache; hashed asset immutable and br; /health JSON not compressed; Host filter 404; request limit 413. Release `deploy-20261017053115-bd34a88` created. The probe's files are replaced by CSPS. | Yes |
| Step 7: smoke from this PC | 2026-10-17 | `node web/scripts/smoke.mjs --origin https://cspstailoring.com` from this PC: 12 of 12 PASS, exit 0 (health 200 Healthy with self, database, time-zone; unknown-api 404 ProblemDetails with traceId; default-deny 401; missing-file 404; https-redirect 301; security-headers HSTS and strict CSP; no-banners on 6 responses; shell-cache no-cache; hashed-asset immutable and br; json-not-compressed; host-filter 404 for `smoke.invalid`; request-limit 413 from the app). GET /probe answers 200 with the CSPS app shell (text/html, no-cache), not the probe's JSON, so the probe is gone. The repository secret HOSTPROBE_KEY still exists (owner to delete). | Yes |
| Step 8: first Manager and sign-in | 2026-10-17 | Owner ran tools/Csps.BootstrapManager against `db_…_cspsdb` with CSPS_BOOTSTRAP_CONNECTION set for that one process: exit 0, invite queued. The live site sent the invite; the owner set a password, received the 6-digit code email and signed in to the admin portal on https://cspstailoring.com. Cookie `__Secure-csps_rt`: HttpOnly, Secure, SameSite Strict, Path /api/v1/auth. `__Secure-csps_2fa` not observed by the owner (it exists only during the code step; attributes pinned by the auth integration tests; owner sign-off pending). Breach-check query `SELECT COUNT(*) FROM AuditLog WHERE Action = 'auth.breach-check-unavailable';` returned 0. No secret, code or connection string was pasted. | Yes |
| CSPS accepted live by the owner (2026-10-17) | 2026-10-17 | Owner's words: "I accept csps as live". From now on a rollback means redeploying an earlier CSPS release (D-05); the first one is `deploy-20261017053115-bd34a88`. | Yes |

## Follow-ups for the /gsd-ship 3 PR

- Compatibility re-pin: done. `SqlCompatibility.Level` 170 reached main in PR #5 (plan 03-19) and is what the first deploy runs.
- IIS rewrite rule: done. The owner chose the IIS HttpToHttps rule (2026-10-16); it reached main in PR #6 and is live (http answers 301).
- HOSTPROBE_KEY: still in the repository secrets on 2026-10-17. The owner deletes it (Settings, Secrets and variables, Actions); the probe is no longer on the site.
- `__Secure-csps_2fa`: owner sign-off on the test-pinned attributes, or a look in the browser's developer tools during the next code step.
- Still Unverified in HOSTING-RECORD, each with its reason: the app-pool memory limit, and the `model` compatibility level.

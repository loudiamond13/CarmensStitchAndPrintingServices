---
status: complete
phase: 01-hosting-verification-backend-foundation
source: [01-VERIFICATION.md]
started: 2026-10-07T22:06:20Z
updated_at: 2026-10-07T23:45:00Z
created: 2026-10-07T17:06:20-05:00
updated: 2026-10-07T18:45:00-05:00
---

## Current Test

[testing complete]

## Tests

### 1. After preflight, run Initialize-DevSecrets.ps1 if needed, then `dotnet run --project src/Csps.Server --launch-profile http` and GET http://localhost:5115/health
expected: 200 with {"status":"Healthy","checks":[{"name":"self",...},{"name":"database","status":"Healthy"},{"name":"time-zone","status":"Healthy"}]}; stop the server afterwards
result: pass
note: "Verified by Claude's own run (200, all three checks Healthy). The user's first run in their terminal failed with LocalDB error 50 'instance does not exist' — environment-specific, cause not pinned down; user accepted Claude's run."

### 2. With the https profile running (Development), open https://localhost:7028/scalar in Chrome and check the DevTools console
expected: The API reference renders and the console shows zero CSP violations; if styles render without 'unsafe-inline', tighten the carve-out (assumption A7)
result: pass
note: "Verified by Claude over http://localhost:5115/scalar/ (https profile): renders, zero CSP violations. 'unsafe-inline' for styles must stay — Scalar injects 3 non-nonce <style> tags and 34 style attributes. HTTPS 7028 not browsed: dev cert untrusted (owner may run dotnet dev-certs https --trust)."

### 3. Owner reviews the hosting record's 12 Unverified facts (.planning/HOSTING-RECORD.md) and accepts that the phase ships with them Unverified
expected: Owner confirms: runtime patch, in-process hosting, content root, logs writable, client-IP/proxy topology, HTTPS termination, Asia/Manila + en-PH, PFX EphemeralKeySet, app-pool memory are verified at the first real deploy (Phase 3); `model` compatibility level stays Unverified; DKIM and the Gmail SPF/DKIM/DMARC pass are supplied before Phase 4
result: pass
note: "Owner accepted 2026-10-07. In-process hosting was Verified first from the live web.config, leaving 11 Unverified."

### 4. Owner/maintainer acknowledges the provisional compatibility pin (SqlCompatibility.Level = 160, D-33) and adds the re-pin to 170 to the ROADMAP (Phase 15-17 cutover text)
expected: A roadmap success criterion or plan item tracks 'create the SQL Server 2025 database, verify its level, re-pin SqlCompatibility.Level, re-run MigrationScriptTests'; ROADMAP line 164 ('compatibility level re-pinned and re-proven') is corrected to 'kept at 160, provisional'
result: pass
note: "ROADMAP updated 2026-10-07: 01-13 line now 'kept at 160, provisional'; Phase 17 success criterion 1 adds the SQL Server 2025 create/restore, level check, re-pin and MigrationScriptTests re-run; owner prerequisite adds the second-database answer."

### 5. Write a held-out test for FND-01 concurrency (insufficient_spec): interrupt `dotnet ef database update` / MigrateAsync mid-run (for example a fault-injecting interceptor on the second migration) and re-run
expected: After the interruption the database holds exactly the migrations before the failed one; re-running completes the rest
result: pass
note: "Owner accepted without a new held-out fault-injection test. Existing backstops: EachMigrationAppliesOnTopOfItsPredecessor and IdempotentScriptWrapsEachMigrationInItsOwnTransaction (MigrationScriptTests)."

### 6. Write a held-out test for FND-12 concurrency (insufficient_spec): apply the idempotent script with a batch that fails inside the second migration, then re-apply
expected: History holds only the first migration and no partial objects of the second remain; the re-run completes
result: pass
note: "Owner accepted without a new held-out failing-batch test. Existing backstop: IdempotentScriptWrapsEachMigrationInItsOwnTransaction."

### 7. Write a held-out test (or observe on the host at the Phase 3 first deploy) for FND-07 multi-process logging (insufficient_spec): two processes write to the same daily log file with shared: true
expected: Both processes append without IOException and every event is a valid compact-JSON line
result: pass
note: "Owner accepted; shared: true is set (LogFileSettings). Two-process append to be observed on the host at the Phase 3 first deploy."

### 8. Write a held-out test for SEC-04 concurrency (insufficient_spec): start two hosts at the same moment against one empty DataProtectionKeys table
expected: Each may create a key; payloads protected by either host are readable by both
result: pass
note: "Owner accepted without a simultaneous-start test. Sequential cases covered by DataProtectionTests (SecondStartReusesKey, KeyRingSurvivesRestart, RotationKeepsOldKeysReadable)."

### 9. Owner confirms (or records an override for) the 01-01 license prohibition against the two owner-approved Microsoft-licensed runtime packages
expected: Either an override entry is added (Microsoft.Data.SqlClient.SNI.runtime 6.0.2 and Microsoft.Identity.Client.NativeInterop 0.20.6: free, proprietary, shipped unmodified, exact-version exception in docs/license-exceptions.json), or a substitute is planned; CLAUDE.md's license line mentions the exception
result: pass
note: "Owner confirmed Option A. Override added to 01-VERIFICATION.md frontmatter; .claude/CLAUDE.md license line names the exact-version Microsoft exceptions."

### 10. Review the two partially enforced test-tier prohibitions: 01-05 (no full client IP in audit rows) vs code-review WR-02, and 01-04 (dev seed never touches MSSQLLocalDB or a hosted DB) vs WR-04
expected: Decide fix-now or defer: map 6to4 (2002::/16) and NAT64 (64:ff9b::/96) to IPv4 before truncation; replace the MSSQLLocalDB substring check with a data-source allow-list
result: pass
note: "Owner chose to defer both fixes. WR-02 (6to4/NAT64 IPv4 mapping before truncation) and WR-04 (dev-seed server allow-list) stay open in 01-REVIEW-DISPOSITION.md; WR-02 must close before any code path writes audit rows."

### 11. Review the non-authoritative LLM verdicts on the 7 judgment-tier prohibitions (table 'Prohibitions' below)
expected: Owner/maintainer agrees with each verdict or records a gap
result: pass
note: "Owner agreed with all 7 verdicts and confirmed no changes were made to the live site or its database during the hosting checks."

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]

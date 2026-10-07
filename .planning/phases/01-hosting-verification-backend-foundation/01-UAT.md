---
status: testing
phase: 01-hosting-verification-backend-foundation
source: [01-VERIFICATION.md]
started: 2026-10-07T22:06:20Z
updated_at: 2026-10-07T22:06:20Z
created: 2026-10-07T17:06:20-05:00
updated: 2026-10-07T17:06:20-05:00
---

## Current Test

number: 1
name: After preflight, run Initialize-DevSecrets.ps1 if needed, then `dotnet run --project src/Csps.Server --launch-profile http` and GET http://localhost:5115/health
expected: |
  200 with {"status":"Healthy","checks":[{"name":"self",...},{"name":"database","status":"Healthy"},{"name":"time-zone","status":"Healthy"}]}; stop the server afterwards
awaiting: user response

## Tests

### 1. After preflight, run Initialize-DevSecrets.ps1 if needed, then `dotnet run --project src/Csps.Server --launch-profile http` and GET http://localhost:5115/health
expected: 200 with {"status":"Healthy","checks":[{"name":"self",...},{"name":"database","status":"Healthy"},{"name":"time-zone","status":"Healthy"}]}; stop the server afterwards
result: [pending]

### 2. With the https profile running (Development), open https://localhost:7028/scalar in Chrome and check the DevTools console
expected: The API reference renders and the console shows zero CSP violations; if styles render without 'unsafe-inline', tighten the carve-out (assumption A7)
result: [pending]

### 3. Owner reviews the hosting record's 12 Unverified facts (.planning/HOSTING-RECORD.md) and accepts that the phase ships with them Unverified
expected: Owner confirms: runtime patch, in-process hosting, content root, logs writable, client-IP/proxy topology, HTTPS termination, Asia/Manila + en-PH, PFX EphemeralKeySet, app-pool memory are verified at the first real deploy (Phase 3); `model` compatibility level stays Unverified; DKIM and the Gmail SPF/DKIM/DMARC pass are supplied before Phase 4
result: [pending]

### 4. Owner/maintainer acknowledges the provisional compatibility pin (SqlCompatibility.Level = 160, D-33) and adds the re-pin to 170 to the ROADMAP (Phase 15-17 cutover text)
expected: A roadmap success criterion or plan item tracks 'create the SQL Server 2025 database, verify its level, re-pin SqlCompatibility.Level, re-run MigrationScriptTests'; ROADMAP line 164 ('compatibility level re-pinned and re-proven') is corrected to 'kept at 160, provisional'
result: [pending]

### 5. Write a held-out test for FND-01 concurrency (insufficient_spec): interrupt `dotnet ef database update` / MigrateAsync mid-run (for example a fault-injecting interceptor on the second migration) and re-run
expected: After the interruption the database holds exactly the migrations before the failed one; re-running completes the rest
result: [pending]

### 6. Write a held-out test for FND-12 concurrency (insufficient_spec): apply the idempotent script with a batch that fails inside the second migration, then re-apply
expected: History holds only the first migration and no partial objects of the second remain; the re-run completes
result: [pending]

### 7. Write a held-out test (or observe on the host at the Phase 3 first deploy) for FND-07 multi-process logging (insufficient_spec): two processes write to the same daily log file with shared: true
expected: Both processes append without IOException and every event is a valid compact-JSON line
result: [pending]

### 8. Write a held-out test for SEC-04 concurrency (insufficient_spec): start two hosts at the same moment against one empty DataProtectionKeys table
expected: Each may create a key; payloads protected by either host are readable by both
result: [pending]

### 9. Owner confirms (or records an override for) the 01-01 license prohibition against the two owner-approved Microsoft-licensed runtime packages
expected: Either an override entry is added (Microsoft.Data.SqlClient.SNI.runtime 6.0.2 and Microsoft.Identity.Client.NativeInterop 0.20.6: free, proprietary, shipped unmodified, exact-version exception in docs/license-exceptions.json), or a substitute is planned; CLAUDE.md's license line mentions the exception
result: [pending]

### 10. Review the two partially enforced test-tier prohibitions: 01-05 (no full client IP in audit rows) vs code-review WR-02, and 01-04 (dev seed never touches MSSQLLocalDB or a hosted DB) vs WR-04
expected: Decide fix-now or defer: map 6to4 (2002::/16) and NAT64 (64:ff9b::/96) to IPv4 before truncation; replace the MSSQLLocalDB substring check with a data-source allow-list
result: [pending]

### 11. Review the non-authoritative LLM verdicts on the 7 judgment-tier prohibitions (table 'Prohibitions' below)
expected: Owner/maintainer agrees with each verdict or records a gap
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps

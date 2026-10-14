---
phase: "1"
slug: "hosting-verification-backend-foundation"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-07T19:45:00-05:00"
updated: "2026-10-07T19:45:00-05:00"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| HTTP client -> audit record | Remote IP and User-Agent are attacker-controlled input that reaches stored data |
| IIS -> app | Hosting adds its own headers unless removed |
| NuGet feed -> build | Third-party code enters the solution at restore time |
| NuGet graph -> shipped site | Transitive packages ship with the app and carry licenses |
| app -> database | Health checks open a connection |
| app -> database | The API reads SiteSettings with a connection string from configuration |
| app -> log files | Files on the host disk, readable by whoever can reach the host |
| app login -> AuditLog | The application's own (likely db_owner) login is the main actor to constrain |
| browser/client -> API | All responses cross to untrusted clients |
| build artifact -> production database | Idempotent scripts applied by the owner |
| client -> protected endpoints | Bearer tokens are attacker-supplied until validated |
| client -> request logging | Paths, headers and values are attacker-controlled |
| configuration -> JWT validation | The signing key decides who can forge tokens |
| database -> key ring | Anyone who can read the database could read unencrypted keys |
| developer -> dev-seed CLI | Command-line input selects the target database |
| developer -> quality gates | Thresholds and allow-lists can be weakened by edits |
| developer machine (shared) | TheBETSLLC uses MSSQLLocalDB and BetsLLC_* databases on the same machine |
| developer machine -> git | Files written locally may be committed |
| future purge job -> AuditLog | A sanctioned, narrow delete path (option-a only) |
| host settings -> certificate | The PFX and password are the root secret |
| internet -> /health | Anonymous public endpoint (D-23) |
| internet -> HostProbe | The probe briefly runs on a public site |
| owner -> live legacy account | Checks happen on the account that serves the live business site |
| owner paste -> git | Pasted command output becomes a committed document |
| owner paste -> git | Pasted outputs land in a committed file |
| record -> production config | The verified level becomes the pinned compatibility level |
| shared machine | TheBETSLLC runs on the same machine and ports |
| test process -> SQL Server | Test code issues DDL (CREATE/DROP DATABASE) |
| test/cleanup scripts -> SQL Server | DDL against the local instance |

---

## Threat Register

45 distinct threats from the 13 plans' threat models (57 register rows; `T-01-SC` repeats once per plan and is merged below). File:line evidence for each threat was gathered by the 2026-10-07 audit (summary below).

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | Directory.Packages.props / restore | high | mitigate | Exact pins, 14-day cool-down (D-19), RestorePackagesWithLockFile + locked mode in CI, NuGetAuditMode all as error, DependencyRegistryTests (CWE-1104/1395) | closed |
| T-01-02 | Information disclosure | .gitignore | medium | mitigate | Ignore logs/, artifacts/, *.pfx, *.pem, *.key; appsettings.json carries no secrets or connection strings (CWE-798) | closed |
| T-01-03 | Elevation of privilege | Layer boundaries | low | mitigate | LayerTests keep Server from bypassing Application and Domain free of infrastructure (enforced every build) | closed |
| T-01-04 | Denial of service | Shared-machine ports | low | mitigate | launchSettings pins 5115/7028 only; preflight before dev servers; nothing sets machine-level env vars | closed |
| T-01-SC | Tampering | NuGet installs (every plan: 01-01, 01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11, 01-12, 01-13) | high | mitigate | Package-legitimacy gate: blocking human checkpoint (Task 1) before the first restore | closed |
| T-01-05 | Tampering | CspsDatabase.DisposeAsync | high | mitigate | Drop only after TestDatabaseName.IsDisposable (^CSPS_Test_[0-9a-f-]{36}$); connect only to (localdb)\CSPS or the CI container; unit tests prove BetsLLC_*, CSPS_Dev, CSPS_E2E, CSPS_Legacy_Restore are rejected | closed |
| T-01-06 | Tampering | Program.cs / startup | high | mitigate | No Migrate/EnsureCreated/seed at startup (D-08); schema reaches production only via reviewed idempotent scripts (plan 04 adds the startup-safety architecture test) | closed |
| T-01-07 | Information disclosure | appsettings*.json | medium | mitigate | Only an integrated-security LocalDB string in appsettings.Development.json; production connection string only in host settings (CWE-798) | closed |
| T-01-08 | Tampering | Fixture DDL strings | low | mitigate | Database names come only from Guid.NewGuid plus a fixed prefix, are bracket-quoted and re-validated by the regex before DDL (CWE-89) | closed |
| T-01-09 | Denial of service | HybridCache on a 256 MB pool | low | mitigate | MaximumPayloadBytes 64 KB, single small immutable entry, in-process only (D-10) | closed |
| T-01-10 | Information disclosure | MinimalHealthWriter | medium | mitigate | Writes only status and name/status pairs; tests assert no exception, SQL, connection-string, duration, description or version text on 200 and 503 (CWE-200/209) | closed |
| T-01-11 | Denial of service | /health database check | low | accept | 3 s timeout and one cached settings read per call; per-IP rate limiting is SEC-03 in Phase 4 (CWE-400). Low impact on a single-instance staff app until then | closed (accepted, AR-1) |
| T-01-12 | Tampering | Business dates | low | mitigate | Time only from TimeProvider; RS0030 bans clock statics at build time; zone from SiteSettings with a fallback chain that never throws | closed |
| T-01-13 | Tampering | tools/Csps.DevSeed | high | mitigate | DevSeedTargetGuard runs before any connection: only CSPS_Dev/CSPS_E2E, never MSSQLLocalDB, never AttachDBFilename; tested near-misses; exit 2 on refusal | closed — WR-04 fixed in quick 261007-p98 (server allow-list: only `(localdb)\CSPS` or `127.0.0.1`/`localhost,<port>`; Failover Partner refused) |
| T-01-14 | Tampering | Idempotent production script | medium | mitigate | Script applied twice at 160 and 170 in tests; per-migration transactions; HasPendingModelChanges guard; trigger DDL wrapped in EXEC (plan 09) | closed |
| T-01-15 | Tampering | Remove-StaleTestDatabases.ps1 | medium | mitigate | (localdb)\CSPS only, exact regex, age filter, -WhatIf support, never MSSQLLocalDB | closed |
| T-01-16 | Information disclosure | AuditEntry IP/UA fields | medium | mitigate | Only /24 or /48 prefixes and a fixed UA family label are stored (D-24, RA 10173, CWE-359) | closed (residual accepted as AR-3: WR-02 deferred) |
| T-01-17 | Denial of service | UserAgentFamily.Classify | low | mitigate | No regex, 512-character read cap, ordered Contains checks (CWE-1333/400) | closed |
| T-01-18 | Information disclosure | Exception handler / ProblemDetails | high | mitigate | Custom 500 writer with fixed text + traceId; CspsProblemDetails overrides any 5xx detail; tests assert no exception text (CWE-209/200) | closed |
| T-01-19 | Tampering | Response headers | high | mitigate | Strict CSP without unsafe-inline/unsafe-eval, frame-ancestors 'none', nosniff, COOP, set in OnStarting on every response (CWE-79/1021) | closed |
| T-01-20 | Information disclosure | /openapi, /scalar | medium | mitigate | Registered and mapped only in Development; Production discovery test (D-14) | closed |
| T-01-21 | Spoofing | Transport | medium | mitigate | HSTS on HTTPS, upgrade-insecure-requests, HTTPS redirection outside Development/Testing (CWE-319) | closed |
| T-01-22 | Information disclosure | Server banners | low | mitigate | Kestrel AddServerHeader false; web.config removeServerHeader and X-Powered-By removal | closed |
| T-01-23 | Information disclosure | Serilog pipeline | high | mitigate | Masking enricher + destructuring policy with exact/suffix rules; no header/body logging (CWE-532) | closed |
| T-01-24 | Tampering | Log files | medium | mitigate | Compact JSON escapes CR/LF; tested (CWE-117) | closed |
| T-01-25 | Spoofing | Client IP for audit | medium | mitigate | Only Connection.RemoteIpAddress; forwarded headers ignored until FND-13; architecture test blocks forwarded-headers middleware | closed |
| T-01-26 | Information disclosure | Log location | low | mitigate | {contentRoot}/logs outside wwwroot; git-ignored; Web Deploy exclusion in Phase 3 | closed |
| T-01-27 | Denial of service | Disk usage | low | mitigate | 10 MB per file, 30 files, 30 days | closed |
| T-01-28 | Elevation of privilege | Endpoint authorization | high | mitigate | Fallback policy (deny) + discovery test that fails on any endpoint without a named policy or matrix row (CWE-862) | closed |
| T-01-29 | Elevation of privilege | Role checks | high | mitigate | Staff/Manager policies; matrix with real JWTs; unknown role -> 403 test (CWE-863) | closed |
| T-01-30 | Spoofing | JWT validation | high | mitigate | HS256 only, key at least 32 bytes, issuer/audience/lifetime/signature validated, 30 s skew; expired/foreign/unsigned token tests (CWE-347/287) | closed |
| T-01-31 | Information disclosure | Signing key | high | mitigate | Only in user-secrets (dev) or host settings (prod); ValidateOnStart fail-fast; never logged (masked name SigningKey) (CWE-798) | closed |
| T-01-32 | Repudiation | AuditLog rows | high | mitigate | AFTER UPDATE/DELETE trigger with THROW, truncate-guard FK, EF interceptor, trigger-enabled test | closed |
| T-01-33 | Tampering | Trigger itself | medium | accept | Residual risk: a db_owner can disable the trigger or drop the guard on purpose; accepted by the owner at the D-25 checkpoint and documented in docs/operations/audit-log.md; runtime check planned for hardening | closed (accepted, AR-2) |
| T-01-34 | Information disclosure | AuditLog Detail | medium | mitigate | Detail capped at 400 characters of plain text; only ids, /24 or /48 prefixes and UA family stored; test proves no raw IP/UA (CWE-532/359) | closed (residual accepted as AR-3: WR-02 deferred) |
| T-01-35 | Information disclosure | DataProtectionKeys table | high | mitigate | Keys encrypted with the certificate (CertificateXmlEncryptor); test asserts encrypted XML (CWE-312) | closed |
| T-01-36 | Denial of service | Certificate loss or bad rotation | medium | mitigate | PreviousCertificates for decryption, rotation runbook, backups outside the host, fail-fast on misconfiguration | closed |
| T-01-37 | Information disclosure | PFX and password | high | mitigate | Only in user-secrets (dev) or host app settings (prod); *.pfx git-ignored; script never echoes secrets; masked log names CertificatePassword/CertificateBase64 (CWE-798) | closed |
| T-01-38 | Tampering | License drift (paid or copyleft) | medium | mitigate | nuget-license allow-list gate over every project; stop-and-ask rule for anything outside the list (D-00, D-18) | closed |
| T-01-39 | Tampering | Coverage gate | low | mitigate | Thresholds in the script with defaults from D-17; negative run proves it fails; exclusions limited to generated code | closed |
| T-01-40 | Information disclosure | HostProbe /probe | high | mitigate | 32+ character key, fixed-time comparison, 401/503 with empty bodies, no secrets or env vars in output, separate site, deleted after use (CWE-306/200) | closed |
| T-01-41 | Tampering | Live legacy site and database | high | mitigate | Owner decision first (D-28); SELECT-only queries run by the owner; probe never on the legacy site; no trigger probe on the live DB (Prime Directive 1) | closed |
| T-01-42 | Information disclosure | HOSTING-RECORD.md | medium | mitigate | Doc-lint test rejects password, user id, account key, private key and probe-key patterns; owner masks their own IP's last octet (CWE-798/359) | closed |
| T-01-43 | Tampering | SqlCompatibility.Level | medium | mitigate | Re-pin only from a Verified fact; MigrationScriptTests re-run at the pinned level, 160 and 170 | closed |
| T-01-44 | Information disclosure | Pasted outputs | medium | mitigate | Redact before transcription; HostingRecordTests secret patterns; owner IP last octet masked (CWE-200/798) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-1 | T-01-11 (low, DoS on `/health`) | Anonymous `/health` runs DB-backed checks. Bounded by a 3 s timeout per check, one cached settings read and a single-instance staff app. Per-IP rate limiting arrives with SEC-03 in Phase 4 (CWE-400). Source: `01-03-PLAN.md` | owner (plan 01-03) | 2026-10-07 |
| AR-2 | T-01-33 (medium, audit trigger tampering) | The hosting login is db_owner-level (HOSTING-RECORD B5/B6), so it can disable `TR_AuditLog_AppendOnly` or drop `AuditLogTruncateGuard`; DENY cannot prevent it. Manual `sys.triggers` check after each deploy until a runtime check lands in hardening. Source: `docs/operations/audit-log.md` | owner (D-25 checkpoint) | 2026-10-07 |
| AR-3 | T-01-16, T-01-34 (medium; code review WR-02) | `IpPrefix.From` does not map 6to4 (`2002::/16`) or NAT64 (`64:ff9b::/96`) to IPv4 before /48 truncation, so a 6to4 client's stored prefix still encodes the full IPv4. No Phase 1 code path writes audit rows. Must be fixed before any code path calls `IAuditTrail.AppendAsync` (Phase 4) | owner (UAT test 10) | 2026-10-07 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-07 | 45 (57 rows) | 45 | 0 | gsd-security-auditor (ASVS L1, block_on high), after UAT 11/11 |

### Security Audit 2026-10-07

| Metric | Count |
|--------|-------|
| Threats found | 45 (57 register rows) |
| Closed | 45 |
| Open | 0 |

- Auditor verdict: SECURED, `threats_open: 0`. All 55 `mitigate` rows verified with file:line evidence; the 2 `accept` rows are documented (AR-1, AR-2).
- The auditor rated T-01-13 (high) closed only at L1 because of code review WR-04. The owner chose to fix it before Phase 1 closed: quick task 261007-p98 (commits f3ecf7f, ed02c70, 6d290ba, 9245949, 50a0cd3) adds the server allow-list and the Failover Partner refusal, test-first. `DevSeedTargetGuardTests` 49/49 (re-run by the orchestrator), Infrastructure integration 124/124, ArchitectureTests 77/77, 0 build warnings.
- Open code-review items that touch declared mitigations. None removes a mitigation at L1; triage them before `/gsd-ship 1`:
  - WR-05: the log masker misses Identity names such as PasswordHash and SecurityStamp (matters from Phase 4).
  - WR-07: HSTS `includeSubDomains` could affect the legacy domain's subdomains.
  - IN-05: HTTPS redirection is on while the host's TLS termination is Unverified.
  - WR-08: a request flood can fill the 30-file log cap before 30 days.
  - IN-02: the dev signing key passes through a local `dotnet user-secrets set` command line.
  - IN-03: the forwarded-headers detector misses typed accessors (none used).
  - IN-04: JWT validation has no `typ` check.
  - IN-07: a non-RSA PFX passes start-up validation and fails at the first key write.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-07

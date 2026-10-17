---
created: 2026-10-16T15:30:00-05:00
updated: 2026-10-17T10:55:53-05:00
phase: 03-ci-cd-staging-deploy
reviewed: 2026-10-17T10:55:53-05:00
depth: standard
files_reviewed: 39
files_reviewed_list:
  - .claude/CLAUDE.md
  - .github/workflows/ci.yml
  - Csps.slnx
  - Directory.Build.props
  - docs/development.md
  - docs/operations/branch-rules.md
  - docs/operations/ci.md
  - docs/operations/cutover-runbook.md
  - docs/operations/deploy.md
  - src/Csps.Infrastructure/DataProtection/CertificateLoader.cs
  - src/Csps.Infrastructure/DataProtection/DataProtectionCertificates.cs
  - src/Csps.Infrastructure/DataProtection/DataProtectionRegistration.cs
  - src/Csps.Infrastructure/Persistence/SqlCompatibility.cs
  - src/Csps.Server/web.config
  - tests/Csps.ArchitectureTests/CiWorkflowTests.cs
  - tests/Csps.ArchitectureTests/CutoverRunbookTests.cs
  - tests/Csps.ArchitectureTests/PublishOutputTests.cs
  - tests/Csps.ArchitectureTests/SolutionLayoutTests.cs
  - tests/Csps.HostProbe.Tests/CertificateChecksTests.cs
  - tests/Csps.HostProbe.Tests/Csps.HostProbe.Tests.csproj
  - tests/Csps.HostProbe.Tests/HostFactsJsonTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/DataProtection/CertificateLoaderTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/DataProtection/DataProtectionCertificatesTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs
  - tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs
  - tools/Csps.HostProbe/CertificateChecks.cs
  - tools/Csps.HostProbe/Csps.HostProbe.csproj
  - tools/Csps.HostProbe/HostFacts.cs
  - tools/Csps.HostProbe/README.md
  - tools/scripts/Merge-PullRequest.ps1
  - tools/scripts/Restore-LegacyReceipt.ps1
  - web/scripts/deploy.mjs
  - web/scripts/deploy.test.ts
  - web/scripts/merge-gate.mjs
  - web/scripts/merge-gate.test.ts
  - web/scripts/smoke.mjs
  - web/scripts/smoke.test.ts
  - web/src/modules/admin/routes.test.tsx
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 3: Code Review Report (incremental, 43d4925..HEAD)

**Reviewed:** 2026-10-17T10:55:53-05:00
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

This report supersedes the 2026-10-16 report for these files. The disposition of the earlier findings stays in `03-REVIEW-DISPOSITION.md` (and `03-REVIEW-FIX.md`); nothing from that report is repeated here.

## Summary

This pass covers the changes since 43d4925: the machine key store certificate load and its owner (`DataProtectionCertificates`), the host probe certificate diagnostics and their new test project, the self-contained `win-x64` package and its CI gating, the IIS http-to-https rule, the compatibility level 170 pin, the squash message handling in the merge gate and `Merge-PullRequest.ps1`, the `-Replace` ordering and `_local` receipt in `Restore-LegacyReceipt.ps1`, the hostprobe-after-first-deploy refusal and the `online` dry run in `deploy.mjs`, the stricter 413 smoke check, and the large CI guide.

No blocker. I traced the merge gate to merge script path (title validation, base64 hand-off, `head=`/`subject-base64=`/`body-base64=` line forging, PowerShell 5.1 argument splitting) and found it sound: a title cannot add a `head=` line (control characters are refused), cannot add a `"` or a skip marker, and the fixed body holds only a validated 40-hex commit id. The new `RESTORE VERIFYONLY` ordering is correct and the receipt was never tracked in git. No secrets, host names, ids or IP addresses were added to tracked files in this range. The workflow actions stay pinned by SHA, and the new test project adds only the packages the other test projects already lock.

The two warnings concern the new machine key store lifetime: the private key of the Data Protection certificate now lives on disk, and the code that is meant to remove it has two gaps.

## Warnings

### WR-01: A certificate loaded at registration time is never disposed when the container does not resolve its owner

**File:** `src/Csps.Infrastructure/DataProtection/DataProtectionRegistration.cs:52-67` (consumer: `tools/Csps.BootstrapManager/Program.cs:147-149`)
**Issue:** `AddCspsDataProtection` calls `TryLoad` while the service collection is being built, so each certificate's private key is written to the machine key store at that moment. Disposal is then delegated to the DI container through `services.AddSingleton(_ => owner)`. A container disposes only instances it created, and the factory runs only when something resolves `DataProtectionCertificates`. Only a started generic host does that (it resolves every `IHostedService`). Any composition that builds a provider and never starts the host loads the certificate and leaves its key file behind: the key survives the process, because finalizers do not run at exit. `tools/Csps.BootstrapManager/Program.cs` is such a composition. It calls `AddInfrastructure`, `BuildServiceProvider()`, resolves a few options and exits, and it runs with the dev PFX from user-secrets (and with the real certificate on whatever machine the owner runs it). The `Infrastructure.IntegrationTests` providers (`AuditLogSql`, `SiteSettingsReaderTests`, `BusinessCalendarTests`) have the same shape but carry no certificate setting, so they are not affected today; a `dotnet ef` design-time run on Windows with a certificate configured would be. The doc comment says "every caller must dispose", but this registration is a caller that cannot guarantee it. The tests (`DataProtectionCertificatesTests`) only cover the started-host and resolved-owner path, so the gap is untested.
**Fix:** Do not load at registration. Register the owner with a factory that loads the certificates when the container first needs them, and feed `ProtectKeysWithCertificate` / `UnprotectKeysWithAnyCertificate` from an `IConfigureOptions<KeyManagementOptions>` (or a small `IConfigureOptions` that resolves the owner), so a provider that never touches Data Protection never writes a key. If the internal decryptor list prevents that, keep the current shape and add a public, documented `DisposeDataProtectionCertificates(this IServiceProvider)` (or make the owner resolve itself when the provider is built with `ValidateOnBuild`) and call it from `BootstrapManager`. Add a test that builds a provider with certificates, disposes it without resolving anything, and asserts the machine key is gone (`StoredKey.Exists()` is already available in the test project).

### WR-02: A killed or crashed process leaves the Data Protection private key on the host, with no sweep and no documentation

**File:** `src/Csps.Infrastructure/DataProtection/CertificateLoader.cs:7-11`, `:52` (also `docs/operations/deploy.md`, `docs/operations/ci.md`)
**Issue:** The key was in memory before this change (`EphemeralKeySet`). It is now a file in the machine key store from start-up until the host disposes the owner. IIS ends a worker that does not stop in its shutdown time limit, and a crash, an out-of-memory kill or a host reboot does the same, so the private key of the certificate that encrypts the whole key ring (CWE-312 / CWE-459) is left on the shared host's disk, one more file per such event, under a random name nothing refers to again. The overlapping recycle does not collide (key names are random), but nothing removes the leftovers either: the probe's `RemoveKeyIfLeft` only deletes a key whose name it just created. The owner accepted the machine key store because the host refuses the other loads (probe 2026-10-16), so this is a documented trade-off in the code comment but not in the operations docs, where the owner would look when rotating the certificate or retiring the site (`MachineKeys` folder, how to recognise leftovers, that a leftover is readable only by the app pool identity and administrators).
**Fix:** Add a short "Data Protection key files on the host" note to `docs/operations/deploy.md`: why the key is on disk, that a forced stop can leave a file, how to find and delete leftovers (the folder, the app pool identity as owner, files newer than the last certificate rotation), and that certificate rotation should be followed by that check. Optionally log the key name at start-up (`CngKey.KeyName` for the current certificate, never the PFX or password) so a leftover can be matched to a run.

## Info

### IN-01: Documents still say the compatibility level is 160 after the re-pin to 170

**File:** `docs/development.md:66`, `CLAUDE.md:26`, `.claude/CLAUDE.md:64`
**Issue:** `SqlCompatibility.Level` is now 170 and `tools/Csps.DevSeed/Program.cs:60` pins the dev database to `SqlCompatibility.Level`, but `docs/development.md:66` still says "The seed in step 5 pins it to 160, the level the app's SQL is generated for". The root `CLAUDE.md` still reads "Compat level pinned at 160 until the host level is verified", and `.claude/CLAUDE.md` still says `UseCompatibilityLevel(160)` provisionally. A developer reading these would expect 160 and be told by `MigrationScriptTests` and the seed output that it is 170. The runbook step at `cutover-runbook.md:109` is also written as a pending decision, which is fine for a runbook but is now history.
**Fix:** Change the development guide to "pins it to the app's level (170)", and the two CLAUDE.md lines to "pinned at 170 (SQL Server 2025 host verified 2026-10-16)". Prefer wording that points at `SqlCompatibility.Level` so it cannot go stale again.

### IN-02: The IIS redirect builds the target from the client's Host header

**File:** `src/Csps.Server/web.config:31`
**Issue:** `https://{HTTP_HOST}/{R:1}` copies the request's Host header into a permanent (301) redirect. A request that forges the header gets a redirect to an attacker-chosen host (CWE-601). The impact is small, since a browser does not send a forged Host header for another site's visitor and the rule sits before the app's own host filtering (so `AllowedHosts` does not apply to plain http), but a 301 is cached, and a canonical host is available. `HTTP_HOST` also yields `https:///path` for an HTTP/1.0 request with no Host header.
**Fix:** Redirect to the fixed public host (`https://<canonical host>/{R:1}`, kept in `web.config` or injected at deploy) or add a condition on `{HTTP_HOST}` that matches the site's names, and update `WebConfigTests.RedirectsHttpToHttpsBeforeTheApp`, `PublishOutputTests.AssertWebConfig` and the smoke check that asserts the redirect.

### IN-03: The smoke request-limit check has a stale constant comment and an optimistic "IIS" label

**File:** `web/scripts/smoke.mjs:496-497`, `:520-528`
**Issue:** The comment on `OVERSIZED_BODY_BYTES` still says the body is "above the request limit the host sets in web.config", but the limit is 2 MiB and the body is 1.5 MB, so IIS never refuses it now. A non-ProblemDetails 413 is reported as "refused by IIS", yet the IIS backstop answers 404.13 for an oversized body, so such a 413 is more likely a bare Kestrel answer. A closed connection still passes without any evidence that the app's own limit is in force, which is the check's whole purpose after the tightening.
**Fix:** Reword the comment ("below the IIS backstop, above the app's limit"), label a non-ProblemDetails 413 as "the host" rather than "IIS", and either remove the connection-closed pass or report it as a warning-level detail, not an OK.

### IN-04: `Restore-LegacyReceipt.ps1` hides why `RESTORE VERIFYONLY` failed

**File:** `tools/scripts/Restore-LegacyReceipt.ps1:190-199`
**Issue:** The `catch` discards the SQL Server error and prints "The backup failed RESTORE VERIFYONLY, so it is not usable". A timeout, a lost connection or a permission change reads the same as a corrupt file, and the owner cannot tell which. The script also drops the existing `CSPS_Legacy_Restore` before the real restore, so a restore that fails afterwards (for example not enough disk space) still costs the old copy; the new text ("a bad file never costs the restore already there") covers an unreadable file only.
**Fix:** Print `$_.Exception.Message` (SQL error text holds no data values, only the file name and the reason) in the stop message, and add a free-space check against the `.bak` size and the data folder before dropping.

---

_Reviewed: 2026-10-17T10:55:53-05:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

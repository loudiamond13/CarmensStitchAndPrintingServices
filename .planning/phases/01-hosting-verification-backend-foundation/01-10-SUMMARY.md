---
phase: 01-hosting-verification-backend-foundation
plan: 10
subsystem: security
tags: [data-protection, x509, pfx, ephemeral-key-set, ef-core, key-ring, user-secrets, rotation, sec-04, d-15, tdd]

requires:
  - phase: 01-08
    provides: Initialize-DevSecrets.ps1 (Jwt:SigningKey), UserSecretsId, CspsApiFactory settings injection and the fail-fast test pattern
  - phase: 01-09
    provides: AddInfrastructure needing a host IRequestContext, Respawn ignore list with early return, idempotent-script tests at 160/170
  - phase: 01-07
    provides: CollectingSink, masked log names CertificateBase64/CertificatePassword
provides:
  - "DataProtectionRegistration.AddCspsDataProtection(IServiceCollection, IConfiguration): SetApplicationName(\"Csps\"), PersistKeysToDbContext<CspsDbContext>, ProtectKeysWithCertificate(current), UnprotectKeysWithAnyCertificate(previous)"
  - "DataProtectionSettings (CertificateBase64, CertificatePassword, PreviousCertificates[]) validated on start; messages name the setting, never the value"
  - "CertificateLoader.Load: X509CertificateLoader.LoadPkcs12 with EphemeralKeySet, refuses a PFX without a private key"
  - "CspsDbContext : IDataProtectionKeyContext; DataProtectionKeyConfiguration; migration 20261007171939_AddDataProtectionKeys (dbo.DataProtectionKeys: Id, FriendlyName, Xml nvarchar(max))"
  - "Csps.Testing.TestCertificates (Current, Other, PublicOnly), InMemoryXmlRepository for no-database hosts"
  - "Initialize-DevSecrets.ps1 now also creates the dev Data Protection PFX"
  - "docs/operations/data-protection-rotation.md"
affects: [phase-3-first-deploy (host settings DataProtection__CertificateBase64/Password), phase-4-auth (cookies, reset tokens), hardening-phase (expired key-row cleanup script)]

actuals:
  tokens: 15900
  tasks: 3
  commits: 5
plan_head_before: 91d1d1455e55bef12808178b84e1129e2bf1aa4f
plan_head_after: f5dbd5c65a1bc178cfbd47e5593774b13e90f9c8

tech-stack:
  added: []
  patterns:
    - "Secrets that the framework needs at registration time (Data Protection certificates) are read from IConfiguration in the composition method, and the same section is also bound to validated options with ValidateOnStart, so a bad secret stops the host with a plain message"
    - "Without a usable certificate, a refusing IXmlEncryptor is installed: no composition can ever store a key unencrypted"
    - "No-database test hosts (parameterless CspsApiFactory) keep the key ring in memory; database-backed hosts use the real EF key store"
    - "Secrets go to dotnet user-secrets as JSON on standard input, never on a command line"

key-files:
  created:
    - src/Csps.Infrastructure/DataProtection/DataProtectionSettings.cs
    - src/Csps.Infrastructure/DataProtection/CertificateLoader.cs
    - src/Csps.Infrastructure/DataProtection/DataProtectionRegistration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/DataProtectionKeyConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261007171939_AddDataProtectionKeys.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261007171939_AddDataProtectionKeys.Designer.cs
    - tests/Csps.Testing/TestCertificates.cs
    - tests/Csps.Testing/InMemoryXmlRepository.cs
    - tests/Csps.Server.IntegrationTests/Security/DataProtectionTests.cs
    - docs/operations/data-protection-rotation.md
  modified:
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - tests/Csps.Testing/CspsApiFactory.cs
    - tools/scripts/Initialize-DevSecrets.ps1

key-decisions:
  - "AddCspsDataProtection takes IConfiguration and loads the certificates at registration: the framework's XmlKeyDecryptionOptions is internal, so decryption certificates can only be supplied through ProtectKeysWithCertificate/UnprotectKeysWithAnyCertificate with loaded instances. Start-up validation (IValidateOptions + ValidateOnStart) still turns any bad secret into an OptionsValidationException at host start"
  - "A refusing XML encryptor is configured whenever the certificates cannot be loaded, so a tools/ command or test composition can never write an unencrypted key"
  - "No-database test hosts get an in-memory (still certificate-encrypted) key store; otherwise every such host waited about 10 s for SqlClient's retry during the start-up key-ring preload (Server suite 3 min 03 s -> 6.7 s)"
  - "The tracer test also asserts the key row is in dbo.DataProtectionKeys: on a Windows dev machine the framework default already persists keys in the user profile, so restart survival alone would not have been RED"
  - "Dev certificate secrets are passed to user-secrets as JSON on standard input, so the PFX and password never appear on a process command line (CWE-214)"

patterns-established:
  - "Certificate-encrypted DB key ring: the same code path in Development, Testing and Production; no 'No XML encryptor configured' warning anywhere"
  - "Rotation: new certificate becomes current, the old one moves to DataProtection:PreviousCertificates:{n} and only decrypts"

requirements-completed: [SEC-04]

coverage:
  - id: D1
    description: "A payload protected by one host is unprotected by a second host started later against the same database and certificate; the key row lives in dbo.DataProtectionKeys"
    requirement: SEC-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Security/DataProtectionTests.cs#KeyRingSurvivesRestart"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every stored key is certificate-encrypted (encryptedSecret/EncryptedData, no 'unencrypted form', no <masterKey>) and no 'No XML encryptor configured' warning is logged; a mutation that removed the encryptor failed both tests"
    requirement: SEC-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Security/DataProtectionTests.cs#StoredKeyXmlIsEncrypted"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Security/DataProtectionTests.cs#NoUnencryptedKeyWarning"
        status: pass
    human_judgment: false
  - id: D3
    description: "The API refuses to start (OptionsValidationException naming the setting, never the value) for an empty, non-base64, wrong-password or public-only PFX, and for a bad previous certificate"
    requirement: SEC-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Security/DataProtectionTests.cs#MissingCertificateFailsStartup (5 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A second start against the same database reuses the existing key (exactly one row)"
    requirement: SEC-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Security/DataProtectionTests.cs#SecondStartReusesKey"
        status: pass
    human_judgment: false
  - id: D5
    description: "Rotation: with Other as current and Current under PreviousCertificates old data is readable; with Other alone it throws CryptographicException; a key created after rotation is encrypted with Other only"
    requirement: SEC-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Security/DataProtectionTests.cs#RotationKeepsOldKeysReadable"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Security/DataProtectionTests.cs#NewKeysUseOnlyTheCurrentCertificate"
        status: pass
    human_judgment: false
  - id: D6
    description: "Concurrency edge (backstop): two instances starting on an empty ring at once may each create a key; both keys stay readable by both through the database-persisted ring"
    requirement: SEC-04
    verification: []
    human_judgment: true
    rationale: "Backstop truth by plan design; no simultaneous-start test exists. It follows from every instance loading all rows of dbo.DataProtectionKeys with the same certificate, which D1 and D4 prove for sequential starts"
  - id: D7
    description: "Initialize-DevSecrets.ps1 creates the dev PFX secrets once, leaves them (and Jwt:SigningKey) unchanged on a second run, and never prints them"
    verification:
      - kind: other
        ref: "powershell -File tools/scripts/Initialize-DevSecrets.ps1 (twice) && dotnet user-secrets list --project src/Csps.Server | grep -q '^DataProtection:CertificateBase64 = '; SHA-256 prefixes of all three entries identical after the second run"
        status: pass
    human_judgment: false
  - id: D8
    description: "Local full-stack run: CSPS_Dev migrated, dotnet run --launch-profile http serves /health 200 with three Healthy checks and /api/v1/nope 404 problem+json; the started processes were stopped; the dev log has no 'No XML encryptor configured'"
    verification:
      - kind: manual_procedural
        ref: "curl -s -o artifacts/health.json -w '%{http_code}' http://localhost:5115/health -> 200 and grep '\"time-zone\",\"status\":\"Healthy\"' artifacts/health.json"
        status: pass
    human_judgment: false
  - id: D9
    description: "docs/operations/data-protection-rotation.md explains, in plain words for the owner, production setup, backup, rotation and recovery"
    requirement: SEC-04
    verification: []
    human_judgment: true
    rationale: "Plain-language clarity for a non-technical owner is a judgment call; the greps only prove the key phrases exist"

duration: 23min
completed: 2026-10-07
status: complete
---

# Phase 1 Plan 10: Data Protection Key Ring in the Database, Certificate-Encrypted Summary

**The Data Protection key ring now lives in `dbo.DataProtectionKeys`, and every key is encrypted with a PFX certificate. The PFX is loaded with `X509CertificateLoader.LoadPkcs12` and `EphemeralKeySet`. A payload protected before a restart is readable after it. A retired certificate listed under `DataProtection:PreviousCertificates` keeps old keys readable without ever encrypting new ones. A missing or broken certificate stops the API at start-up with a message that names the setting. One idempotent script creates the dev certificate in user-secrets, and the owner has a rotation runbook. The walking skeleton runs end to end locally.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-10-07T17:12:07Z
- **Completed:** 2026-10-07T17:35:00Z
- **Tasks:** 3 (tracer + 2)
- **Files modified:** 15 (10 new, 5 changed)

## Accomplishments

- **Key ring in the database (SEC-04).** `AddCspsDataProtection` is called from `AddInfrastructure`. It does the following:
  - `SetApplicationName("Csps")`
  - `PersistKeysToDbContext<CspsDbContext>()`
  - `ProtectKeysWithCertificate(current)`
  - `UnprotectKeysWithAnyCertificate(previous...)`, which only decrypts

  `CspsDbContext` implements `IDataProtectionKeyContext`. The new migration `AddDataProtectionKeys` creates `Id`, `FriendlyName` and `Xml` (nvarchar(max), no JSON column).
- **Encrypted at rest (CWE-312).** Every stored `Xml` contains `encryptedSecret`/`EncryptedData` and never a plain `masterKey`. The "No XML encryptor configured" warning never appears. When no usable certificate exists, a refusing encryptor makes an unencrypted write impossible.
- **Fail-fast (T-01-36, T-01-37).** `IValidateOptions<DataProtectionSettings>` with `ValidateOnStart` refuses the following:
  - an empty PFX
  - a PFX that is not base64
  - a wrong password
  - a public-only PFX
  - a bad previous certificate

  Each message names the setting and gives the fix. It never contains the value.
- **Rotation.** Data protected under certificate `Current` can be read by a host whose current certificate is `Other` and whose previous list contains `Current`. A host with only `Other` gets `CryptographicException`. Keys created after the rotation are encrypted with `Other` only.
- **Test harness.**
  - `TestCertificates` creates three PFXs in memory once per run, each with a random password: RSA-2048 `Current` and `Other`, and `PublicOnly`.
  - `CspsApiFactory` injects `Current` into every host.
  - The no-database factory keeps the key ring in memory. Without that, every such host waited about 10 s for the SqlClient retry.
- **Dev secrets.** `Initialize-DevSecrets.ps1` creates the dev PFX once and passes it to user-secrets on standard input. It is an RSA-3072, 10-year, self-signed certificate made in memory with a random password. Re-runs change nothing, and the script never prints a value.
- **Runbook.** `docs/operations/data-protection-rotation.md` covers, in plain words:
  - what the certificate protects
  - how to create the production PFX without printing it
  - the host setting names
  - backup in two places
  - the rotation steps
  - "never delete an old certificate while a key it encrypted remains"
  - recovery: everyone signs in again, and no data is lost

## Local full-stack run (walking skeleton)

- Preflight was clean: ports 5180, 5115, 7028 and 5199 were free, and no TheBETSLLC processes were running.
- The script ran twice. The first run created the certificate pair and left `Jwt:SigningKey` unchanged. The second run left all three entries unchanged: the SHA-256 prefixes of each entry were the same before and after. No value was printed.
- `dotnet ef database update --project src/Csps.Infrastructure --startup-project src/Csps.Server` applied `20261007171939_AddDataProtectionKeys` to `CSPS_Dev`, and only `CSPS_Dev`.
- `dotnet run --project src/Csps.Server --launch-profile http` was started through `Start-Process`. Development was set only by the launch profile, for that one process.
- `GET http://localhost:5115/health` returned 200 with this body:
  ```json
  {"status":"Healthy","checks":[{"name":"self","status":"Healthy"},{"name":"database","status":"Healthy"},{"name":"time-zone","status":"Healthy"}]}
  ```
  The plan's curl verify passed: it returned 200 and saved `artifacts/health.json` (git-ignored) with `"time-zone","status":"Healthy"`.
- `GET http://localhost:5115/api/v1/nope` returned 404 `application/problem+json`:
  ```json
  {"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"We couldn't find that.","status":404,"traceId":"f542b30efdca35d0bc71b970e477dc9c"}
  ```
- **Stopped:** only the processes this run started: `Csps.Server.exe` (PID 14728), its console host (PID 17756) and `dotnet run` (PID 2680). All three were confirmed gone afterwards.
- `src/Csps.Server/logs/csps-20261007.json` (git-ignored) has no "No XML encryptor configured" text and no Warning or Error events.
- `CSPS_Dev.dbo.DataProtectionKeys` holds 1 row. It is encrypted (`encryptedSecret`) and has no `masterKey`.

## Task Commits

1. **Task 1 (tracer): a payload protected before a restart is readable after it**
   - RED: `80a2881` (test)
   - GREEN: `d3b2682` (feat)
2. **Task 2: encryption at rest, no warning, fail-fast, key reuse and rotation**
   - RED: `403d5c3` (test)
   - GREEN: `b58cd86` (feat)
3. **Task 3: dev certificate in user-secrets, rotation runbook, local full-stack run.** `f5dbd5c` (feat)

No REFACTOR commits were needed.

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 1 (tracer) | `80a2881` | `d3b2682` | none needed |
| 2 | `403d5c3` | `b58cd86` | none needed |

- **Task 1 RED.**
  - Command: `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DataProtectionTests" --report-xunit-junit`, exit 2.
  - `KeyRingSurvivesRestart` failed with `await CountKeysAsync(database) should be 1 but was -1`, because no `DataProtectionKeys` table existed and the keys lived in the user profile.
  - `gsd check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed).
- **Task 1 GREEN.** `DataProtectionTests` 1/1. Server suite 168/168, Infrastructure 99/99, Architecture 76/76.
  - Tracer feedback gate (interactive, end-of-phase, automated-only verify): the verify command was run again on the committed code and passed 1/1. Expansion went ahead after that.
- **Task 2 RED.** Same command, exit 2, 7 of 11 failing:
  - `RotationKeepsOldKeysReadable`: `protector.Unprotect(protectedPayload) should not throw but threw`
  - `MissingCertificateFailsStartup` x5: "should throw but did not" for empty and bad-previous; wrong exception type for the rest
  - `NewKeysUseOnlyTheCurrentCertificate`: `keys.Count`

  `gsd check tdd-red-evidence` returned `RED_EVIDENCE_OK` for `RotationKeepsOldKeysReadable` and for `MissingCertificateFailsStartup(fault: &quot;empty&quot;)`.

  The other 4 tests passed on the tracer. They characterize behavior Task 1 had already built: the tracer, encrypted XML, no warning, and key reuse.
- **Task 2 mutation check.** Removing `ProtectKeysWithCertificate(current)` made `StoredKeyXmlIsEncrypted`, `NoUnencryptedKeyWarning`, `RotationKeepsOldKeysReadable` and `NewKeysUseOnlyTheCurrentCertificate` fail. This shows the no-warning test really detects the warning. The file was restored from a copy, and the suite went back to 11/11.
- **Task 2 GREEN.** `DataProtectionTests` 11/11. Solution 500/500.

## Files Created/Modified

- `src/Csps.Infrastructure/DataProtection/DataProtectionSettings.cs`: the `DataProtection` section, including `PreviousCertificates` (`PreviousCertificateSettings`).
- `src/Csps.Infrastructure/DataProtection/CertificateLoader.cs`: loads the PFX with `EphemeralKeySet`, requires a private key, and uses value-free messages.
- `src/Csps.Infrastructure/DataProtection/DataProtectionRegistration.cs`: the registration, the start-up validator and the refusing encryptor.
- `src/Csps.Infrastructure/Persistence/Configurations/DataProtectionKeyConfiguration.cs`: the Fluent mapping of `DataProtectionKeys`.
- `src/Csps.Infrastructure/Persistence/Migrations/20261007171939_AddDataProtectionKeys*.cs` and `CspsDbContextModelSnapshot.cs`: the table.
- `src/Csps.Infrastructure/Persistence/CspsDbContext.cs`: `IDataProtectionKeyContext`.
- `src/Csps.Infrastructure/DependencyInjection.cs`: calls `AddCspsDataProtection(configuration)`.
- `tests/Csps.Testing/TestCertificates.cs`, `InMemoryXmlRepository.cs` and `CspsApiFactory.cs`: the test certificates, the injection and the no-database key store.
- `tests/Csps.Server.IntegrationTests/Security/DataProtectionTests.cs`: 7 tests, 11 cases.
- `tools/scripts/Initialize-DevSecrets.ps1`: the dev PFX.
- `docs/operations/data-protection-rotation.md`: the owner runbook.

## Decisions Made

- **Certificates load at registration** (see key-decisions). Research Pattern 9b also loads them eagerly. The plan's "lazy through options" variant is not possible with public APIs, because `XmlKeyDecryptionOptions` is internal. The guarantee the plan wanted still holds: a bad secret stops the host at start, with a validation message.
- **Refusing encryptor fallback:** when the certificates cannot be loaded, keys are never stored unencrypted, whatever the composition.
- **No-database test hosts use an in-memory key store.** The certificate encryptor stays the production one.
- **The tracer asserts the DB row** as well as the round-trip, so that the RED is real on a Windows dev machine.
- **Secrets on stdin** for the certificate pair.
- **No rowversion on `DataProtectionKeys`.** The framework owns the shape, and keys are only added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `XmlKeyDecryptionOptions` is internal, so the certificates cannot be resolved lazily through options**
- **Found during:** Task 1 GREEN (the build failed with CS0122).
- **Fix:**
  - `AddCspsDataProtection(IServiceCollection, IConfiguration)` reads the `DataProtection` section at registration and uses the public `ProtectKeysWithCertificate`/`UnprotectKeysWithAnyCertificate`.
  - `ValidateOnStart` still reports bad secrets at host start.
  - A failed load installs a refusing encryptor instead of throwing during registration.
  - The signature differs from the plan's `AddCspsDataProtection(IServiceCollection)`.
- **Files modified:** `DataProtectionRegistration.cs`, `DependencyInjection.cs`
- **Committed in:** `d3b2682`, `b58cd86`

**2. [Rule 1 - Bug] Every no-database test host waited about 10 s at start-up**
- **Found during:** Task 1 (the Server suite went from seconds to 3 min 03 s).
- **Issue:** the framework's start-up key-ring preload queried the never-created `CSPS_Test_` database. SqlClient retried the failed login after 10 s.
- **Fix:** the parameterless `CspsApiFactory` post-configures an `InMemoryXmlRepository`. Its keys are still encrypted with the test certificate. Database-backed hosts are unchanged.
- **Verification:** `RequestLoggingTests` went from 22.8 s to 2.2 s, and the Server suite from 3 min 03 s to 6.7 s, with 168/168 passing.
- **Committed in:** `d3b2682`

**3. [Rule 1 - Bug] The tracer test would not have been RED as the plan described it**
- **Issue:** the plan said keys are "ephemeral in memory today". On Windows, the framework default persists keys in the user profile, so host B could already read host A's payload.
- **Fix:** `KeyRingSurvivesRestart` also asserts that exactly one key row is in `dbo.DataProtectionKeys` (-1 when the table is missing).
- **Committed in:** `80a2881`

**4. [Rule 2 - Missing critical] Extra tests and cases beyond the plan's six behaviors**
- **Added:**
  - `NewKeysUseOnlyTheCurrentCertificate`, which checks that previous certificates never encrypt
  - `MissingCertificateFailsStartup` cases for non-base64, a public-only PFX and a bad previous certificate
  - a check that no failure message contains a secret value
- **Committed in:** `403d5c3`

**5. [Rule 2 - Missing critical] Refusing encryptor**
- **Issue:** without it, a composition that skipped start-up validation (a tools/ command) could store a key unencrypted (CWE-312).
- **Fix:** an `IXmlEncryptor` that throws a plain message.
- **Committed in:** `b58cd86`

**6. [TDD sequencing] PreviousCertificates and start-up validation moved from Task 1 to Task 2**
- **Why:** the plan's Task 1 action listed both, and Task 2 was meant to test them. Building them in Task 1 would have turned Task 2's RED into a mutation record.
- **Result:** keeping them for Task 2 gave a genuine RED (7 of 11 failing). The final artifacts match the plan's artifact list.

**7. [Rule 3 - Blocking] Files outside the plan's list**
- `tests/Csps.Testing/InMemoryXmlRepository.cs` (deviation 2)
- `src/Csps.Infrastructure/Persistence/Configurations/DataProtectionKeyConfiguration.cs`: Fluent-only mapping, as the project convention requires

---

**Total deviations:** 7: 2 Rule 1, 2 Rule 2, 2 Rule 3 and 1 TDD sequencing note.
**Impact on plan:** each one was needed for correctness, security, a genuine RED or a usable test suite. No packages were added (`DataProtection.EntityFrameworkCore` was already pinned and approved in plan 01).

## Issues Encountered

- `tdd-red-evidence` matches the JUnit test `name`, not `classname#name`. The theory target uses `&quot;` (as noted in 01-08).
- `user-secrets set` with JSON on stdin merges into the existing store. This was checked first against a throwaway `--id` store, which was then deleted, before touching the project's store.
- Test runs were gated on a clean preflight every time. Only `(localdb)\CSPS` was used, and `dotnet ef database update` targeted only `CSPS_Dev`. No other project's processes were touched.

## Verification

- `dotnet build Csps.slnx -tl:off --no-incremental`: 0 warnings, 0 errors.
- `dotnet test --solution Csps.slnx`: 500/500 passed. This includes `MigrationScriptTests`: the idempotent script with `AddDataProtectionKeys` applies twice at 160 and 170. Respawn resets go through the new resettable table.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- Acceptance greps passed:
  - `SetApplicationName("Csps")`, `PersistKeysToDbContext` and `EphemeralKeySet`
  - `PreviousCertificates` and `never delete` in the runbook
  - the user-secrets `DataProtection:CertificateBase64` entry
  - the health curl/grep

## Threat Model Coverage

- **T-01-35 (information disclosure, key table):**
  - the certificate encryptor
  - `StoredKeyXmlIsEncrypted` and `NoUnencryptedKeyWarning`
  - the refusing encryptor when there is no certificate
- **T-01-36 (DoS, certificate loss or bad rotation):**
  - `PreviousCertificates` for decryption only, covered by the rotation tests
  - the start-up fail-fast
  - the runbook with backup and recovery
- **T-01-37 (PFX and password):**
  - the values live only in user-secrets (dev) or host settings (prod), and `*.pfx` is git-ignored
  - the script uses stdin and never prints a value
  - validation messages contain no value, which is tested
  - Serilog masks `CertificatePassword`/`CertificateBase64` (01-07)
- **T-01-SC (supply chain):** no new packages.

## User Setup Required

None now. Developers run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-DevSecrets.ps1` once; it has already been run on this machine. Production needs `DataProtection__CertificateBase64` and `DataProtection__CertificatePassword` in the host settings before the first deploy (Phase 3), created and backed up as the runbook describes. Without them the API refuses to start.

## Next Phase Readiness

- **Phase 3 (first deploy):**
  - Create and back up the production PFX, then set the two host settings.
  - Confirm on SmarterASP.NET that `EphemeralKeySet` loads (assumption A10, HostProbe). The fallback is `MachineKeySet`.
  - Confirm where the host keeps app settings.
- **Phase 4 (auth):** cookies and reset tokens built on Data Protection now survive pool recycles.
- **Hardening phase:** write the reviewed cleanup script for expired key rows, which the runbook mentions.
- No blockers.

---
*Phase: 01-hosting-verification-backend-foundation*
*Completed: 2026-10-07*

## Self-Check: PASSED

- All 10 created files and the 5 modified files exist on disk.
- Commits `80a2881`, `d3b2682`, `403d5c3`, `b58cd86` and `f5dbd5c` exist on `gsd/phase-1-hosting-verification-backend-foundation`.
- The ledger count (`91d1d14..HEAD`) is 5, which matches `actuals.commits`.

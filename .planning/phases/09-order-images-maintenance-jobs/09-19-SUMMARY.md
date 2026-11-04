---
phase: 09-order-images-maintenance-jobs
plan: 19
subsystem: infra
tags: [cloudinary, image-storage, signed-upload, private-delivery, secret-masking, nuget, tdd]
status: complete

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plans 09-01 (IImageStorage port, UnconfiguredImageStorage), 09-02 (CloudinarySettings, folder guard), 09-07 (CloudinaryImageDelivery), 09-12, 09-13, 09-15 (metadata stripped before any upload)
provides:
  - CloudinaryDotNet 1.29.3 pinned (D-37), referenced by Csps.Infrastructure only, with records, notices and lock files
  - CloudinaryImageStorage, the real IImageStorage (private signed upload, destroy with invalidation, prefix listing, usage report)
  - CloudinaryResults status mapping and the named "cloudinary" HttpClient (60 s timeout, no retry)
  - ImagesRegistration picks Cloudinary only when CloudName, ApiKey and ApiSecret are all set, otherwise the 503 storage
  - StorageUsage with storage bytes, credits used and limit, and the plan image limit; ImageStorageException for failed listing or usage reads
  - Secret-exposure, masking and layer guard tests; docs/operations/cloudinary-setup.md
affects: [09-25, 09-28, 09-30, 09-31]

created: "2026-11-03T21:10:00-06:00"
updated: "2026-11-03T21:10:00-06:00"

actuals:
  tokens: 13300
  tasks: 3
  commits: 7

plan_head_before: 37ba6bf403cc6a52bc583fc3e737c9511edef2b5
plan_head_after: 7642b2ea229cd0f4662dbb0f77f2480b4fc4760b
commits: 7

tech-stack:
  added: [CloudinaryDotNet 1.29.3 (MIT)]
  patterns:
    - "A fresh Cloudinary client per call over the factory HttpClient, so address lookups never go stale"
    - "Failure codes (transient, unauthorized, refused, images.type) travel as outcomes; listing and usage throw ImageStorageException"
    - "Stub HttpMessageHandler for every adapter test; the real host test swaps only the primary handler of the named client"

key-files:
  created:
    - src/Csps.Infrastructure/Images/CloudinaryImageStorage.cs
    - src/Csps.Infrastructure/Images/CloudinaryResults.cs
    - src/Csps.Application/Ports/ImageStorageException.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/CloudinaryImageStorageTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/StubCloudinaryHandler.cs
    - tests/Csps.Server.IntegrationTests/Images/ImageSecretExposureTests.cs
    - docs/operations/cloudinary-setup.md
  modified:
    - Directory.Packages.props
    - src/Csps.Infrastructure/Csps.Infrastructure.csproj
    - src/Csps.Infrastructure/Images/ImagesRegistration.cs
    - src/Csps.Application/Ports/IImageStorage.cs
    - src/Csps.Server/Logging/SensitiveDataMasking.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/ImagesRegistrationTests.cs
    - tests/Csps.Server.IntegrationTests/Logging/SensitiveDataMaskingTests.cs
    - tests/Csps.ArchitectureTests/LayerTests.cs
    - docs/dependencies.json
    - docs/dependencies.md
    - THIRD-PARTY-NOTICES.md
    - "14 packages.lock.json files (CloudinaryDotNet, plus Newtonsoft.Json 13.0.3 in 10 of them, see Deviations)"

key-decisions:
  - "Failure codes: 400 maps to images.type, 401 and 403 to unauthorized, 420, 429, 5xx, timeouts and dropped connections to transient, anything else to refused"
  - "Removal 401 and 403 map to the existing ImageRemovalStatus.Rejected with code unauthorized (the enum has no Unauthorized member)"
  - "Usage numbers are read from the raw JSON, because the SDK stores credits as whole numbers and the plan's credits come in tenths"
  - "The adapter's log property is FailureCode, not Code, because the log masker hides any property named Code"

patterns-established:
  - "Adapter tests build the real adapter over StubHttpClientFactory(StubCloudinaryHandler); fake values demo-cloud, 000000000000000, test-secret-not-real"

requirements-completed: [IMG-01, IMG-03]

coverage:
  - id: D1
    description: "CloudinaryDotNet 1.29.3 pinned exactly, referenced by Csps.Infrastructure only, recorded with approval, notices and lock files; the dependency registry and license gate pass"
    requirement: "IMG-01"
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests (whole project, 266 passed, includes DependencyRegistryTests and LayerTests)"
        status: pass
      - kind: other
        ref: "dotnet nuget-license over Csps.slnx: only the two owner-excepted Microsoft parts report, nothing new"
        status: pass
    human_judgment: false
  - id: D2
    description: "An upload goes to Cloudinary as a private, signed, non-overwriting asset with the server-made public id and asset folder, no folder field and no empty field"
    requirement: "IMG-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/CloudinaryImageStorageTests.cs#AnUploadSendsOnePrivateSignedNonOverwritingRequestToTheImageUploadEndpoint"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/CloudinaryImageStorageTests.cs#AnUploadNeverSendsAFolderFieldOrAnEmptyFieldOrTheSecret"
        status: pass
    human_judgment: false
  - id: D3
    description: "Removal invalidates cached copies and maps ok, not found, busy and refused keys; listing and the usage report work and failures throw a short code"
    requirement: "IMG-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/CloudinaryImageStorageTests.cs (32 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Outside Testing the Cloudinary storage is used only when all three keys are set; otherwise the 503 storage and the site still starts"
    requirement: "IMG-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/ImagesRegistrationTests.cs#AHostMissingAnyOneOfTheThreeKeysUsesTheStorageThatAnswers503"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs#AHostWithNoImageStorageStartsAnswersTheUploadWith503AndKeepsTheHealthCheckGreen"
        status: pass
    human_judgment: false
  - id: D5
    description: "No answer, header or log line holds the API secret or key; ApiSecret is masked; only Infrastructure references the Cloudinary library"
    requirement: "IMG-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Images/ImageSecretExposureTests.cs#NoAnswerHeaderOrLogLineHoldsTheCloudinaryKeyOrSecret"
        status: pass
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/LayerTests.cs#OnlyInfrastructureReferencesTheCloudinaryLibrary"
        status: pass
    human_judgment: false
  - id: D6
    description: "The owner knows where the three keys go and what never goes into git"
    verification: []
    human_judgment: true
    rationale: "A plain-English guide: only the owner can judge whether it reads clearly and matches the hosting panel"

duration: 45min
completed: 2026-11-03
---

# Phase 9 Plan 19: Photos are stored in the shop's Cloudinary account Summary

**CloudinaryDotNet 1.29.3 is installed and `CloudinaryImageStorage` uploads private, signed, non-overwriting photos, removes them with cache invalidation, lists a folder and reads the usage report, only when all three owner keys are set, with every test on a stub and the secret proven absent from answers and logs.**

## Performance

- **Duration:** about 45 min
- **Tasks:** 3 of 3
- **Commits:** 7 code commits, then this SUMMARY

## Package check (D-37), in plain words

Re-checked on 2026-11-03 before installing:

- **Version and age:** 1.29.3 was published 2026-08-16, 79 days ago. The 14-day wait is long past.
- **License:** MIT. Free, no payment, we only keep the author's notice (added to `THIRD-PARTY-NOTICES.md`).
- **Problems:** NuGet lists it as listed, not deprecated, with no vulnerabilities. The GitHub advisory list returned nothing for CloudinaryDotNet. NuGetAudit is on as an error and the build has 0 warnings.
- **Who makes it:** Cloudinary's own library (NuGet author "Cloudinary").
- **What else it brings:** only Newtonsoft.Json. See Deviation 1.
- **License gate:** `nuget-license` over every project: only the two Microsoft parts you already approved by exact version report, nothing new.

## Task Commits

1. Package: `f9d8da3e` (chore) pin, reference, 14 lock files, records, notices
2. Task 1 (tracer): `0ebaa6e0` (test, RED) then `f8632937` (feat, GREEN) private signed upload and registration
3. Task 2: `6f1e11ea` (test, RED) then `224b6047` (feat, GREEN) removal, listing, usage
4. Task 3: `d704c45f` (test) guard tests, then `7642b2ea` (feat) ApiSecret name, log property fix, setup guide

## What was built

- **Upload:** `type=private`, server-made `public_id`, `asset_folder`, `overwrite=false`, `use_filename=false`, `allowed_formats=jpg,png,webp,heic`, signed by the SDK with the secret on the server. No `folder` field and no empty field (the test checks both).
- **Removal:** `destroy` with `type=private` and `invalidate=true`. "ok" is Removed, "not found" and 404 are NotFound.
- **Listing:** by prefix, `type=private`, `max_results=500`, with the cursor; returns ids, created times and the next cursor.
- **Usage:** storage bytes, credits used, credits limit, credits percent and the plan's image size limit.
- **Timeouts only:** the named `cloudinary` client has one 60 s timeout through Http.Resilience and no retry (well under the 2 minute idempotency lease).
- **Registration:** outside Testing, `IImageStorage` is Cloudinary only when CloudName, ApiKey and ApiSecret are all set; otherwise `UnconfiguredImageStorage` answers 503 and the host still starts.

## Deviations from Plan

**1. [Rule 3 - Blocking, flagged for the owner] Newtonsoft.Json 13.0.3 appears in 10 lock files**
- **Found during:** package install.
- **Issue:** The plan expected Newtonsoft.Json 13.0.4 to be "already locked". It is, in Csps.Infrastructure, Csps.Server and the architecture tests. In the other 10 projects (tests and tools) it was not locked, so the restore added it at 13.0.3, the lowest version CloudinaryDotNet accepts. It is the same MIT package already in the notices, 13.0.3 has no known advisory (the old advisory ended at 13.0.1), and nothing else was added or bumped. The shipped app still resolves 13.0.4.
- **Action:** I continued rather than block the whole plan, and recorded it here for your decision (see Owner decisions pending).
- **Commit:** `f9d8da3e`

**2. [Rule 1 - Bug in plan wording] `unique_filename=false` is not sent**
- **Issue:** The plan lists `unique_filename false` among the upload fields. The SDK only sends `unique_filename` when `use_filename` is true, because it has no meaning otherwise. With `use_filename=false` and our own `public_id`, no file name is ever used, so the upload is the same. I did not work around the SDK. The test asserts the other fields and the SDK behavior is noted here.
- **Commit:** `f8632937`

**3. [Rule 3 - Blocking] Removal 401 and 403 use `ImageRemovalStatus.Rejected`, not "Unauthorized"**
- **Issue:** The plan and 09-28 say "Unauthorized", but the port from 09-01 has `Rejected` and no `Unauthorized`. I used `Rejected` with `FailureCode = "unauthorized"` rather than change the enum. Plan 09-28 should check `FailureCode == "unauthorized"` (constant `CloudinaryResults.UnauthorizedCode`) to stop the job on bad keys.
- **Commit:** `224b6047`

**4. [Rule 2 - Missing critical functionality] The port gained fields and an exception**
- **Issue:** `StorageUsage` only had two percents, but the plan (and 09-25) need storage bytes, credits used and limit, and the plan's image limit. `ListAsync` and `GetUsageAsync` return plain values, so a failure had no way out.
- **Fix:** `StorageUsage` got four optional trailing fields (`StorageBytes`, `CreditsUsed`, `CreditsLimit`, `ImageMaxBytes`; every existing `new(0, 0)` still compiles). New `ImageStorageException` (short code only) is thrown by a failed listing or usage read. Both files are in `src/Csps.Application/Ports/`, outside the plan's file list. 09-25 and 09-28 should catch `ImageStorageException` and write their plain "could not be read" lines.
- **Commit:** `6f1e11ea`

**5. [Rule 1 - Bug] A log property named `Code` is masked**
- **Found during:** a deliberate mutation check of the exposure test.
- **Issue:** the masker hides any property named `Code` (a one-time code), so the adapter's own failure lines would have logged `***` instead of the cause.
- **Fix:** the property is `FailureCode`. Commit `7642b2ea`.

**6. [Rule 3 - Blocking] PowerShell cannot run from this worktree**
- **Issue:** `New-ThirdPartyNotices.ps1` could not be started. I ran its two `nuget-license` steps directly (`dotnet nuget-license` over `Csps.slnx` for the gate and over the four shipping projects for the report) and applied the script's row format with a small Python step. The result is exactly one new row (`CloudinaryDotNet | 1.29.3 | MIT`) and the count 88 to 89, with every other row unchanged. Please run the script once after merge to confirm it produces the same file.
- **Commit:** `f9d8da3e`

**7. [Design choice] A new Cloudinary client per call.** A long-lived client would keep one HttpClient forever and miss DNS changes. A client is cheap to build. No behavior in the plan changes.

## TDD Gate Compliance

- **Task 1 RED (`0ebaa6e0`):** compile shell only; 16 of 27 tests failed on planned assertions. Machine check of the JUnit report for `CloudinaryImageStorageTests.AnUploadAnswered400IsRefusedWithTheTypeCode` returned `RED_EVIDENCE_OK` (expected `images.type`, actual `not-built`). Semantic assessment: the target ran and failed on the planned assertion; the registration tests failed because the storage was `UnconfiguredImageStorage` and no `IHttpClientFactory` was registered, which is the missing behavior. **GREEN (`f8632937`):** 27 of 27 pass.
- **Task 2 RED (`6f1e11ea`):** 16 of 32 failed. `RED_EVIDENCE_OK` for `ARemovalOfAFileThatIsAlreadyGoneIsNotFound` (expected NotFound, actual Rejected). **GREEN (`224b6047`):** 44 of 44 pass across the adapter and registration classes.
- **Task 3:** no honest RED exists. The behavior (masking by the `Secret` suffix, no leak in answers or logs, layering) was already true, so the guard tests passed on their first run. To prove they can fail, I temporarily wrote the secret into the adapter's log line: `ImageSecretExposureTests` failed ("logs should not contain test-secret-not-real"), then I reverted the mutation (the final source has no such line). The one source change in this task was the `FailureCode` rename (Deviation 5) and the explicit `ApiSecret` name.
- **REFACTOR:** none.

## Check results (seen in this session)

| Check | Result |
|---|---|
| `dotnet build Csps.slnx` | 0 Warning(s), 0 Error(s) (NuGetAudit on) |
| `dotnet format Csps.slnx --verify-no-changes` | no output, exit 0 |
| `tests/Csps.Infrastructure.IntegrationTests --filter-namespace "*Images*"` | total 123, failed 0 |
| `*CloudinaryImageStorageTests` with `*ImagesRegistrationTests` | total 44 (earlier run 27 before Task 2), failed 0 |
| `tests/Csps.Server.IntegrationTests` `*ImageSecretExposureTests`, `*SensitiveDataMaskingTests` | total 59, failed 0 |
| `*OrderImagesEndpointTests`, `*OrderImageDeliveryTests`, `*OpenApiSnapshotTests`, `*AuthorizationMatrixTests` | total 392, failed 0 |
| `tests/Csps.ArchitectureTests` (whole project, includes `DependencyRegistryTests`, `LayerTests`) | total 266, failed 0 |
| `gitleaks protect --staged` before every commit | no leaks found |
| Em dash or en dash scan of new files | none |

Not run: the full solution test run (the orchestrator runs the post-merge gate), and any call to the real Cloudinary (D-07).

## Owner decisions pending

1. **Pin Newtonsoft.Json 13.0.4 centrally?** Recommendation: yes, low priority. It makes all 14 lock files agree on one version and removes the 13.0.3 entries. It needs one more `PackageVersion` line and a `docs/dependencies.json` record, so it needs your yes first. Not doing it is safe: 13.0.3 has no known problem.
2. **Smoke test the folder listing against the real account (plan 09-30).** The listing request shape (`resources/image` with `type=private` and `prefix` as query fields) is exactly what the SDK sends, but no test may call Cloudinary. Recommendation: have the owner smoke test in the dev folder (`csps-dev`) once keys are set, before the monthly sweep (09-28) is trusted.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: outbound-https | src/Csps.Infrastructure/Images/CloudinaryImageStorage.cs | New server calls to Cloudinary's API over HTTPS, signed with the account secret. Already covered by the plan's trust boundary "server to Cloudinary" (T-09-42 to T-09-46). |

## Self-Check: PASSED

- Files created exist: `CloudinaryImageStorage.cs`, `CloudinaryResults.cs`, `ImageStorageException.cs`, `CloudinaryImageStorageTests.cs`, `StubCloudinaryHandler.cs`, `ImageSecretExposureTests.cs`, `docs/operations/cloudinary-setup.md`.
- Commits `f9d8da3e`, `0ebaa6e0`, `f8632937`, `6f1e11ea`, `224b6047`, `d704c45f`, `7642b2ea` are in the branch history.
- `grep 'Include="CloudinaryDotNet" Version="1.29.3"' Directory.Packages.props` prints one line; `git diff --stat -- Directory.Packages.props` for the plan shows one added line.

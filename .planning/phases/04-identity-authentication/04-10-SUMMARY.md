---
phase: 04-identity-authentication
plan: 10
subsystem: testing
tags: [testing-environment, email-sink, e2e, playwright, release-proof, user-secrets, qual-05, d-37]
status: complete
created: "2026-10-14T22:20:00-05:00"
updated: "2026-10-14T22:20:00-05:00"

requires: ["04-07", "04-09"]
provides:
  - "GET /api/testing/emails (Testing + Debug only): the sink's mail after a cursor id, optionally for one address, no-store"
  - "POST /api/testing/staff (Testing + Debug only): a fresh Admin or Manager (active or deactivated) with a random csps.test email and a random D-11 password"
  - "BuildFlavor.HasTestingFeatures, TestingOnlyAttribute, TestingControllersFeatureProvider, TestingHostRegistration (CSPS_TESTING, Debug only)"
  - "Csps:Testing:LoadUserSecrets switch: user-secrets in the Testing environment only when asked, environment variables and the command line re-added after them"
  - "The Playwright host runs ASPNETCORE_ENVIRONMENT=Testing; web/e2e/testing-api.ts exports createStaff, readEmails, latestEmail"
  - "ReleaseHasNoEmailSinkTests: a Release build of the Server holds no sink, no Testing type and no /api/testing string; CSPS_TESTING is Debug-only in every csproj/props file"
affects: [04-12, 04-18, 04-23, 04-33, Phase 5 user management]

requirements-completed: [QUAL-05]

actuals:
  tokens: 15000
  tasks: 3
  commits: 6
plan_head_before: d7d64d5d5a23acae43098e1fc8615bb0ad063e52
plan_head_after: 14ac2833e4ba0c37b2cb7c0775ac3749241ddb1d

tech-stack:
  added: []
  patterns:
    - "Testing-only controllers carry [TestingOnly] and live under #if CSPS_TESTING; an application-part feature provider removes them outside the Testing environment, so the route falls through to the API 404"
    - "Tests that must compile in Release reference Testing-only types by HTTP route or sit under #if DEBUG"
    - "Release proof reads assembly metadata (type definitions, user strings) plus a raw byte scan for attribute blobs"

key-files:
  created:
    - src/Csps.Server/Composition/BuildFlavor.cs
    - src/Csps.Server/Testing/TestingOnlyAttribute.cs
    - src/Csps.Server/Testing/TestingControllersFeatureProvider.cs
    - src/Csps.Server/Testing/TestingHostRegistration.cs
    - src/Csps.Server/Testing/TestingConfiguration.cs
    - src/Csps.Server/Controllers/TestingEmailsController.cs
    - src/Csps.Server/Controllers/TestingFixturesController.cs
    - src/Csps.Infrastructure/Identity/TestingAccountActivation.cs
    - tests/Csps.Server.IntegrationTests/Testing/TestingEmailsEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Testing/TestingFixturesEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Testing/TestingConfigurationTests.cs
    - tests/Csps.ArchitectureTests/ReleaseHasNoEmailSinkTests.cs
    - web/e2e/testing-api.ts
    - web/e2e/testing-host.spec.ts
  modified:
    - src/Csps.Server/Csps.Server.csproj
    - src/Csps.Server/Program.cs
    - src/Csps.Infrastructure/Identity/IdentityRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Testing/CspsApiFactory.cs
    - web/playwright.config.ts
    - docs/web/e2e.md

key-decisions:
  - "A Debug build refuses to start as Production unless Csps:Testing:AllowProductionEnvironment is true; only CspsApiFactory sets it, because five existing Server tests start Production hosts in-process. No appsettings file and not the Playwright host sets it, and a test starts a Production host with it forced to false and expects the refusal"
  - "Deactivating the fixture user goes through a Debug-only TestingAccountActivation in Infrastructure, not a new IUserAccounts method: deactivation belongs to Phase 5 user management and the production port stays unchanged. The class name starts with Testing, so the Release proof covers it"
  - "POST /api/testing/staff reads the JSON body itself instead of binding it, so a missing, empty or malformed body is the same plain 400 for every caller (model binding would answer 415 or a null body when SuppressModelStateInvalidFilter is on)"
  - "The Testing smoke runs in Chromium only (testIgnore in the other four projects): the routes are API calls, not pages"

patterns-established:
  - "Every E2E test makes its own staff user with createStaff and reads its own mail with latestEmail, so resend cooldowns, caps and lockouts never leak between tests (Pitfall 8)"
  - "New Testing routes need a row and an anonymous allow-list key in AuthorizationMatrix, inside the BuildFlavor.HasTestingFeatures block"
---

# Phase 4 Plan 10: Testing Endpoints, Per-Test Staff and the Release Proof Summary

E2E tests can now read emailed codes and links from the sink and create their own staff user through two routes that exist only in the Testing environment of a Debug build, and a test builds the server in Release and proves none of it ships.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | An email the dispatcher hands to the sink is readable at GET /api/testing/emails in Testing, and the route does not exist anywhere else | RED 2c49669, GREEN 1607ef3 |
| 2 | Per-test staff users, the Testing configuration switch, the E2E host on the Testing environment and the helpers | RED 4b2a5ac, GREEN d549e25 |
| 3 | Prove the Release build has no sink, no Testing controller and no Testing route | test 1bad73b, docs 14ac283 |

`commits: 6` is measured from the plan ledger base (`plan_head_before`). Tracer gate: interactive mode with an automated-only `<verify>` (HUMAN_VERIFY_MODE end-of-phase), so after the slice was built the whole Server integration suite (333 tests, including the authorization matrix with the new row) was re-run green before Task 2 started.

## Verification

- Server integration 348 passed, Infrastructure integration 212, Architecture 111 (including the two Release proof tests, the Release build inside the first takes about 10 seconds). `dotnet build Csps.slnx` in Debug and in Release: 0 warnings, 0 errors.
- Web: `tsc` project builds, ESLint (`--max-warnings 0`) and Prettier clean for `e2e/` and `playwright.config.ts`.
- E2E, full suite after the preflight (4 workers, host on `https://localhost:5199`, `CSPS_E2E`): **566 passed, 0 failed, 31 skipped** of 597 across chromium, firefox, webkit, pixel, iphone and the two scrollbar projects (32.1 minutes). The 31 skips are the existing per-project `test.skip` cases, not new ones. No Phase 2 spec needed a change: none depended on Development-only behaviour.
- `@testing-host` ran once, in Chromium, and passed.

## Mutation evidence (Task 3)

The Release proof was shown to fail when the guard is removed (both csproj files restored with `git checkout -- <file>` afterwards):

1. Debug condition removed from `Csps.Server.csproj` only: `TestingSymbolIsDefinedOnlyForDebug` failed (`conditions should contain 'Configuration'=='Debug'`) and `ReleaseBuildHasNoTestingTypesOrRoutes` failed because the Release build itself no longer compiled (Testing code needs the Debug-only sink).
2. Debug condition removed from both `Csps.Server.csproj` and `Csps.Infrastructure.csproj`: `TestingSymbolIsDefinedOnlyForDebug` failed again and `ReleaseBuildHasNoTestingTypesOrRoutes` failed on the metadata with `["TestingConfiguration", "TestingControllersFeatureProvider", "TestingHostRegistration", "TestingOnlyAttribute", "TestingEmailsController", "TestingFixturesController"]` in `Csps.Server.dll`.

With the conditions in place both tests pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A Debug build that refuses Production would break five existing Server tests**
- **Found during:** Task 1 (the plan requires the refusal; `OpenApiExposureTests`, `SecurityHeadersTests`, `SpaHostTests` and `AuthorizationFailureTests` start Production hosts in-process, and the test suite always runs a Debug build).
- **Issue:** The refusal as written would fail every one of those tests.
- **Fix:** `Csps:Testing:AllowProductionEnvironment` (Debug builds only), set to true by `CspsApiFactory` alone. `ADebugBuildRefusesToRunAsProduction` forces it false and expects the `InvalidOperationException` that names "Testing features". The key appears in no appsettings file and not in the Playwright host.
- **Files modified:** src/Csps.Server/Testing/TestingHostRegistration.cs, tests/Csps.Testing/CspsApiFactory.cs
- **Commit:** 1607ef3

**2. [Rule 3 - Blocking] No way to create a deactivated user through IUserAccounts**
- **Found during:** Task 2.
- **Issue:** The plan creates the deactivated state "through IUserAccounts", which has no deactivate method.
- **Fix:** Debug-only `TestingAccountActivation` in Infrastructure (registered under `#if CSPS_TESTING`), so the production port is unchanged and Phase 5 designs deactivation itself.
- **Files modified:** src/Csps.Infrastructure/Identity/TestingAccountActivation.cs, src/Csps.Infrastructure/Identity/IdentityRegistration.cs
- **Commit:** d549e25

### Plan interpretation

- `TestingConfiguration` (Server, `#if CSPS_TESTING`) holds the user-secrets logic so the precedence can be tested with a stand-in source; its test is under `#if DEBUG` so the test project still compiles in Release.
- `TestingConfigurationTests` inspects the provider list of the real host (no `secrets.json` source for a plain factory, one placed before the last environment-variable and command-line sources with the switch on, none outside the Testing environment). It does not read or write any real user-secrets.
- The Release proof also scans the assembly bytes (UTF-8 and UTF-16) for `api/testing`, because `[Route("...")]` values sit in the blob heap, not in the user strings the plan names.
- `TestingSymbolIsDefinedOnlyForDebug` checks every csproj, props and targets file in the repository that mentions `CSPS_TESTING`, not only the two named projects.
- The RED commit of Task 1 and Task 2 fail at build time (types under test do not exist yet), as in earlier Phase 4 plans. Task 3's tests pass against the Task 1 and plan 04-09 conditions by design, so the mutation evidence above stands in for a failing run.
- Co-author trailer on commits is `Claude Sonnet 5.5`.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-04-30 and T-04-31 are mitigated by three layers (Debug-only compilation, application-part removal outside Testing, Production refusal) and the Release proof; T-04-32 by the explicit switch (only the Playwright host) with environment variables and the command line re-added after user-secrets; T-04-33 by the Testing environment always using the sink (plan 04-09). The fixture endpoint creates accounts only under `csps.test`.

## Notes for later plans

- New Testing routes: add `[TestingOnly]` and `#if CSPS_TESTING`, a row plus an allow-list key in `AuthorizationMatrix` inside the `BuildFlavor.HasTestingFeatures` block, and keep the type name starting with `Testing` so the Release proof covers it.
- `POST /api/testing/staff` states are `active` and `deactivated`; later plans add locked, must-change and invited here, using the `IUserAccounts` methods that already exist.
- A fresh clone must have user-secrets set (`Initialize-DevSecrets.ps1`) before `npm run e2e`, since the Testing host now loads them through `Csps__Testing__LoadUserSecrets`.
- Release test runs cannot execute the integration tests (the Testing environment has no sink in Release); the Release solution build only proves they compile.

## Self-Check: PASSED

- Files: BuildFlavor.cs, the four files in src/Csps.Server/Testing, both Testing controllers, TestingAccountActivation.cs, the three Testing test classes, ReleaseHasNoEmailSinkTests.cs, web/e2e/testing-api.ts and web/e2e/testing-host.spec.ts all exist.
- Commits 2c49669, 1607ef3, 4b2a5ac, d549e25, 1bad73b and 14ac283 are ancestors of HEAD.

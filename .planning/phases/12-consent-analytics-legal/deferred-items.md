# Phase 12 deferred items

*Created: 2026-11-18T07:55:00-06:00 · Updated: 2026-11-18T07:55:00-06:00*

Problems found during a plan that the plan did not cause. They are logged here, not fixed.

## From plan 12-30

- **`dotnet build Csps.slnx -c Release` fails in two test projects.** `tests/Csps.Infrastructure.IntegrationTests` and `tests/Csps.Server.IntegrationTests` use Testing-only types (`TestingImageDelivery`, `TestingImageStorage`, `StoredTestImage`) that are compiled only with `CSPS_TESTING`, so a Release build of the whole solution stops with 27 errors in files 12-30 did not touch (for example `Orders/OrderReaderDetailSnapshotTests.cs`, `Maintenance/ImageCleanupRunTests.cs`). Every `src/` project builds in Release with 0 warnings and 0 errors, and CI only publishes `src/Csps.Server` in Release. Suggested fix: wrap those tests in `#if CSPS_TESTING` (or skip them like the Testing route tests) so a whole-solution Release build is clean.

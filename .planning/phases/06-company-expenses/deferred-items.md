---
created: 2026-10-25T09:46:00-05:00
updated: 2026-10-25T10:50:00-05:00
---

# Phase 6 deferred items

Out-of-scope findings during execution. Nothing here was fixed by the plan that found it.

| Found in | Item | Why deferred |
| --- | --- | --- |
| 06-06 | `dotnet format Csps.slnx --verify-no-changes` reports `src/Csps.Infrastructure/Identity/UserDirectory.cs(1,1): IMPORTS: Fix imports ordering` | The file is from an earlier phase and 06-06 does not touch it. CI runs the format check, so fix it in a small follow-up (`dotnet format Csps.slnx`) before the PR |
| 06-08 | Flake: `CompanyExpenseListQueryCountTests.TheKpisRunTheSameNumberOfSqlCommandsEachTime` failed once inside a full Server integration run, then passed alone and in a second full run (1198/1198) | Not touched by 06-08 (KPI path). Seen once under full-suite load; re-run alone passed. Recorded, not hidden. Watch for a repeat before changing the test |

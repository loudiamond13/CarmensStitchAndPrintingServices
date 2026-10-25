---
created: 2026-10-25T09:46:00-05:00
updated: 2026-10-25T12:06:00-05:00
---

# Phase 6 deferred items

Out-of-scope findings during execution. Nothing here was fixed by the plan that found it.

| Found in | Item | Why deferred |
| --- | --- | --- |
| 06-06 | `dotnet format Csps.slnx --verify-no-changes` reports `src/Csps.Infrastructure/Identity/UserDirectory.cs(1,1): IMPORTS: Fix imports ordering` | The file is from an earlier phase and 06-06 does not touch it. CI runs the format check, so fix it in a small follow-up (`dotnet format Csps.slnx`) before the PR |
| 06-08 | Flake: `CompanyExpenseListQueryCountTests.TheKpisRunTheSameNumberOfSqlCommandsEachTime` failed once inside a full Server integration run, then passed alone and in a second full run (1198/1198) | Not touched by 06-08 (KPI path). Seen once under full-suite load; re-run alone passed. Recorded, not hidden. Watch for a repeat before changing the test |
| 06-10 | Machine-speed failure: `ExpenseListTimingTests.TheListAndTheKpisAnswerUnder300MsAtP95OnFiveYearsOfData` failed on the "five years, last page, size 100" case in four runs (p95 406.9 ms alone, 313.0 ms alone, and twice inside larger runs; 06-06 recorded 197.8 ms). The cheap cases slowed by the same factor (category filter p95 6.2 to 6.8 ms against 3.7 ms; month KPIs 16 ms against 8.5 ms), and 06-10 changes no list or KPI query shape (the list filter was only split into a shared helper with the same SQL) | The numbers move 30 percent between identical runs, so this is machine load (TheBETSLLC shares the box), not a code change. D-28 says the CI runner decides; the owner may want a margin there (already parked from 06-06). Not changed here |

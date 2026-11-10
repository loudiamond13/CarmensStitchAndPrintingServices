---
status: recorded
trigger: "ExpenseListTimingTests.TheListAndTheKpisAnswerUnder300MsAtP95OnFiveYearsOfData failed in two full Server integration runs on 2026-11-10 and passed alone."
goal: record_flake
created: 2026-11-10T13:05:00-06:00
updated: 2026-11-10T13:05:00-06:00
---

# Flake: expense list p95 timing under machine load

## What happened

- Full Server integration run 1 (2026-11-10, during the PR 24 Copilot fixes): failed while the web suite, a browser and TheBETSLLC's tests ran on the same machine.
- Full run 2: failed again while TheBETSLLC's tests ran. The "five years, last page, size 100" case had p95 391.5 ms against the 300 ms limit. The other cases were well under: default window p95 121.9 ms, category filter 9.2 ms, staff-name search 140.5 ms.
- Run alone on a quiet machine (preflight showed no dev or test processes): passed.

## Reading

The test measures wall time on a shared developer machine, so CPU load from another project's tests can push the slowest case past its limit. The changes in that PR (staff-money lock, Pagination, npm settings) do not touch the expense list query.

## Next

No code change. If it fails again on CI (ubuntu, no other load) or on a quiet local machine, open a debug session on the last-page query.

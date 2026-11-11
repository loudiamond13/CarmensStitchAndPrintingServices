---
status: fixed
trigger: "ExpenseListTimingTests.TheListAndTheKpisAnswerUnder300MsAtP95OnFiveYearsOfData failed in two full Server integration runs on 2026-11-10 and passed alone."
goal: record_flake
created: 2026-11-10T13:05:00-06:00
updated: 2026-11-10T23:55:00-06:00
---

# Flake: expense list p95 timing under machine load

## What happened

- Full Server integration run 1 (2026-11-10, during the PR 24 Copilot fixes): failed while the web suite, a browser and TheBETSLLC's tests ran on the same machine.
- Full run 2: failed again while TheBETSLLC's tests ran. The "five years, last page, size 100" case had p95 391.5 ms against the 300 ms limit. The other cases were well under: default window p95 121.9 ms, category filter 9.2 ms, staff-name search 140.5 ms.
- Run alone on a quiet machine (preflight showed no dev or test processes): passed.

- Full run 3 (2026-11-10, late, during the create-user deadlock fix): failed, then failed again run alone on a quiet machine (preflight showed no dev or test processes). Staff-name search p95 310.5 ms, five years last page p95 604.1 ms; default window 185.4 ms, category 18.3 ms, month KPIs 29.4 ms. The machine had just run an overloaded full suite whose hung test host was stopped. The CI full run at 2c8714e9 passed this test.

## Reading

The test measures wall time on a shared developer machine, so CPU load from another project's tests can push the slowest case past its limit. The changes in that PR (staff-money lock, Pagination, npm settings) do not touch the expense list query.

## Next

It has now failed on a quiet local machine, which this record named as the point to open a debug session on the last-page and staff-name queries. The expense list code did not change in the work around these runs. Until that session, CI is the judge: it fails the gate there if the queries really are slow.

## Cause and fix (2026-11-10, late)

Not only machine load: the page query joined the category, payer and recorder for every matching row before it skipped to the page, so the last page of five years built about 36,500 joined rows to keep 100, and any slowness pushed it over. `CompanyExpenseReader.ListAsync` now picks the page's ids from the sorted list index first and joins only those rows, in the same one statement. Measured the same hour on the same machine (p95): old last page 819.0 ms and search 362.9 ms; new last page 100.9 ms and search 73.5 ms. Push held for the owner: P10-BL-23.

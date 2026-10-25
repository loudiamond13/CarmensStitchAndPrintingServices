---
created: 2026-10-25T09:33:00-05:00
updated: 2026-10-25T09:33:00-05:00
---

# Runbook: how fast the expense list is, and how to check it

The company expense list and its month KPIs must stay fast as the data grows (PERF-04, D-28). This page says what is checked, where, what to do when the check fails, and how to read the real speed from the live site after release.

## What is required

- **Fixed number of SQL commands.** The list runs 2 commands whatever the page size (one for the count and the sum, one for the page). The month KPIs run 2. The detail of one expense runs 1. A change that adds a query per row fails a test.
- **Speed.** The p95 of `GET /api/v1/company-expenses` and `GET /api/v1/company-expenses/kpis` is under 300 ms on about five years of fake data. "p95" means 95 out of 100 requests are at least this fast.
- **Compiled queries.** The detail read and the two KPI commands are compiled once, because their shape never changes. The list is not compiled, because its optional filters change the shape.

## The tests

| Test | What it proves | Where it runs |
| --- | --- | --- |
| `CompanyExpenseReaderQueryCountTests` (Infrastructure integration tests) | The exact command counts: list 2 (page size 10 and 100, filtered, empty), KPIs 2, detail 1 | Locally and in CI |
| `CompanyExpenseListQueryCountTests` (Server integration tests) | Page size 10 and 100 run the same number of commands through the real endpoint, and a create still stamps the caller | Locally and in CI |
| `ExpenseListTimingTests` (Server integration tests) | The p95 limit on five years of fake data: the default window, a category filter, a staff-name search, a five-year range on the last page at size 100, and the KPIs | Locally and in CI |

The timing test builds about 36,500 expenses (20 a day for five years, ten categories, six staff, 2 percent soft-deleted) in its own throwaway `CSPS_Test_<guid>` database. It warms up with 20 requests, then times 200 requests for each case. The p95 is the value at position `ceil(0.95 x 200) - 1` of the sorted timings. It takes about 1.5 minutes, and it prints the p50 and p95 of each case.

The class runs alone: its test collection turns parallel running off, so no other test class shares its CPU or database.

## Run it

1. Run the preflight and wait if another project's tests are running, because they share the CPU:
   `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`
2. Run the timing test alone and show its output:
   `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ExpenseListTimingTests" --output Detailed`
3. Read the lines `default window: p50 ... ms, p95 ... ms` and the four lines after it.

In CI the test runs inside the full integration test step (`3 integration tests`, full mode only) against the throwaway SQL Server container.

## When it fails

1. Re-run it alone (step 2 above). A shared machine or a busy CI runner can add noise.
2. If it passes alone, record the flake in the plan or phase notes (date, the numbers, where it ran). Do not hide it.
3. If it keeps failing, look at the query plan of the slow case and fix the reader query in `CompanyExpenseReader`. An index change is a new migration, so ask the owner first.
4. **Never raise the 300 ms limit or the command counts to make a run pass.** If a CI-only margin looks needed, ask the owner. That is the owner's decision.

## Read the real speed after release

The live site writes one log line for every request, with the time it took in milliseconds. The files are in the `logs` folder next to the site, one per day, named `csps-YYYYMMDD.json`, and kept 30 days. Each line is JSON with `RequestMethod`, `RequestPath`, `StatusCode` and `Elapsed` (milliseconds). The query string is not logged, so every list case counts under the same path.

1. Download the `logs` folder copies you want to check to your own machine. Do not edit them on the server.
2. Open PowerShell in the folder that holds the downloaded files and run this. It only reads the files:

```powershell
$paths = '/api/v1/company-expenses', '/api/v1/company-expenses/kpis'
$lines = Get-ChildItem .\csps-*.json | Get-Content | ForEach-Object { $_ | ConvertFrom-Json }
foreach ($path in $paths) {
  $times = @($lines |
    Where-Object { $_.RequestMethod -eq 'GET' -and $_.RequestPath -eq $path -and $_.StatusCode -eq 200 } |
    ForEach-Object { [double]$_.Elapsed } | Sort-Object)
  if ($times.Count -eq 0) { "${path}: no requests found"; continue }
  $index = [math]::Ceiling(0.95 * $times.Count) - 1
  '{0}: {1} requests, p95 {2:N1} ms' -f $path, $times.Count, $times[$index]
}
```

3. Compare each p95 with 300 ms. The live number is the time the server took, not the visitor's connection, so it is close to what the test measures.

If a live p95 is over 300 ms, tell the owner and open a follow-up. Do not guess at a fix on the live site.

## Fake data never goes to the live database

The five-year data set exists only inside the throwaway test database that the test creates and drops. Never write fake or timing data to the live database, `CSPS_Dev` or `CSPS_E2E`, and never point the timing test at them. `CspsDatabase` refuses any database name that is not `CSPS_Test_<guid>`.

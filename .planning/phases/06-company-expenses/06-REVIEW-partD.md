---
phase: 06-company-expenses
part: D
created: 2026-10-25T23:40:00-05:00
updated: 2026-10-25T23:40:00-05:00
reviewed: 2026-10-25T23:40:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - tests/Csps.Testing/CommandCounter.cs
  - tests/Csps.Testing/CspsDatabase.cs
  - tests/Csps.Testing/TestSessions.cs
  - web/e2e/admin.spec.ts
  - web/e2e/audit-log.spec.ts
  - web/e2e/expenses-sweep.spec.ts
  - web/e2e/expenses.spec.ts
  - web/e2e/settings.spec.ts
  - web/e2e/showcase.spec.ts
  - web/e2e/sweep.ts
  - web/e2e/testing-api.ts
  - web/scripts/design-side-by-side.mjs
  - web/scripts/owner-review.mjs
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 6 Part D: Code Review Report

*Created: 2026-10-25T23:40:00-05:00 · Updated: 2026-10-25T23:40:00-05:00*

**Reviewed:** 2026-10-25
**Depth:** standard
**Files Reviewed:** 13 (plus CompanyExpenseListQueryCountTests.cs, read because it is the only user of the new CommandCounter scope, and fixtures.ts, ExpenseCategorySeed.cs and e2e.mjs for cross-checks)
**Status:** issues_found

## Summary

Shared test infrastructure, the Playwright specs and helpers, and the two owner-review scripts were read in full for the Phase 6 changes. `tsc -p tsconfig.node.json` and `eslint --max-warnings 0` over all the TypeScript and .mjs files in scope came back clean.

What held up under adversarial reading:

- **CommandCounter scoping (see `.planning/debug/expense-list-command-count-flake.md`).** The `AsyncLocal` write happens inside an `async` method, whose caller context is restored on return, so the scope cannot leak out of `MeasureAsync`. The email dispatcher's flow is captured at host start, before any scope exists, so its read stays out of the window. The three count tests guard against passing vacuously (`small.Count.ShouldBeGreaterThan(0)` and the "AnEmailSweepDuringTheRequestIsNotCounted" test holds the window open across a real outbox read). I found no way for the fix to under-count the request's own commands apart from the HybridCache blind spot the debug note already records.
- **Database safety.** `CspsDatabase` re-validates every name against `^CSPS_Test_[0-9a-f-]{36}$` before any DDL and drops only that. The owner-review host is pinned to `CSPS_E2E` on `(localdb)\MSSQLLocalDB` and port 5199; the seed step passes `--database CSPS_E2E` to the guarded tool. No script touches `BetsLLC_*` or ports 5173, 5023 or 5099. Nothing in scope reads stdin (the one `stdio: 'inherit'` spawn runs `dotnet run` for the seed tool and `vite build`, neither of which reads it, and the seed tool has no `Console.Read*`).
- **Secrets and real data.** No real names, emails, local paths or secrets in the fixtures or scripts. Staff are `@csps.test` or `@example.com`, passwords are random per run, the connection string carries no credentials.
- **Script error handling.** `executeReview` stops the host in a `finally`, the signal handler stops hosts and releases the lock before `process.exit`, the lock release is idempotent (verified in `e2e.mjs`), and writes are fenced by `assertWritable`.
- **E2E data isolation.** Every spec finds its rows by a per-run random token or unique word and compares the page with the response it just read, so the shared `CSPS_E2E` data does not make the new specs order-dependent.

No blocker was found. Two warnings and four info items follow.

## Warnings

### D-WR-01: Count-test rig leaks two live hosts when its setup fails

**File:** `tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseListQueryCountTests.cs:114-129`
**Issue:** `Rig.StartAsync` creates `baseFactory` and `factory`, then builds the host (`factory.Server.PreserveExecutionContext = true`), then runs `TestSessions.StartAsync` and `ExpenseFixtures.TodayAsync`. The `Rig` (which owns the disposal) is only constructed on the last line. If either of those two awaits throws, nothing disposes the two factories. Each host runs the email dispatcher with a 1 s sweep against the class's throwaway database, so a leaked host keeps polling and logging errors after `CspsDatabase.DisposeAsync` drops that database, and it can hold a pooled connection that makes the drop's `SINGLE_USER WITH ROLLBACK IMMEDIATE` kill live connections. This is the exact failure mode (a host left behind) the focus list asks about; it only appears on a failing run, which is when it makes the next failure harder to read.
**Fix:**
```csharp
public static async Task<Rig> StartAsync(CspsDatabase database)
{
    await database.ResetAsync();
    var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
    try
    {
        var counter = new CommandCounter();
        var factory = baseFactory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.ConfigureDbContext<CspsDbContext>(options => options.AddInterceptors(counter))));
        factory.Server.PreserveExecutionContext = true;
        var session = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(baseFactory);
        return new Rig(baseFactory, factory, counter, session, today);
    }
    catch
    {
        await baseFactory.DisposeAsync();
        throw;
    }
}
```
(Disposing `baseFactory` also disposes the derived factory it created; if that is not so in this harness, dispose `factory` as well inside the `catch`.)

### D-WR-02: The "stale save" owner-review picture changes the shared expense, so later pictures show different figures

**File:** `web/scripts/owner-review.mjs:3881-3903` (case `e2-edit-conflict`), driven by `capturePhase6Review` at `:4000-4047`
**Issue:** To make the second sign-in "save first", the case reads the edited expense and PUTs it back with `amount: Number(current.amount) + 5`. The case runs once per Manager view (theme x width = 6 views), and every view re-reads the current amount, so the expense goes 700, 705, 710 ... 730 across the run. Each view also runs `e1-manager-list`, `e2-edit-record-meta` and the month cards against that same row, so the owner sees a different amount for "Sticker paper" and a different month total at 390, 820 and 1440 px and in Blush versus Espresso, plus extra "Expense changed" entries in the Audit Log picture. The review exists so the owner can compare the same screen across widths and themes; figures that drift by view make that comparison unreliable and look like a rendering bug. (The 999 typed in the stale window is never saved, so only the +5 drifts.)
**Fix:** Make the competing save idempotent instead of cumulative, for example set a fixed value that differs from the one the window loaded:
```js
const rivalAmount = Number(current.amount) === 705 ? 710 : 705;
await callApi(c.request, token, 'PUT', address, { /* ... */ amount: rivalAmount, /* ... */ });
```
and, after the picture, PUT the original 700 back (read from `c.six`) so the next view starts from the seeded state. Alternatively seed a dedicated expense row for the conflict case so no other picture reads it.

## Info

### D-IN-01: CommandCounter `Reset`, `Count` and `Commands` can disagree under concurrency

**File:** `tests/Csps.Testing/CommandCounter.cs:24-28, 95-100`
**Issue:** `Reset` swaps the queue and zeroes the count as two separate steps, and `Record` increments the count and then enqueues into whichever queue it reads. A command running during a `Reset` can be counted in `Count` but land in the discarded queue (or the reverse), so `Count` and `Commands.Count` can differ by one. The scoped `MeasureAsync` path is not affected, and the only host-wide reader that matters (`WaitForOutboxSweepAsync`) uses `Commands` alone, so no current test is wrong. It is a trap for the next test that mixes `Count` with `Reset` on a host that has background work.
**Fix:** Derive `Count` from the queue (`Volatile.Read(ref _all).Count`) and drop `_count`, so one field is the single source of truth.

### D-IN-02: `allowConsole(/409/)` stays on for the rest of the page's life

**File:** `web/scripts/owner-review.mjs:3728-3737, 3882`
**Issue:** The 409 allowance is stored per page in a `WeakMap` and never removed. After `e2-edit-conflict` runs, every later console error or warning on that signed-in page that contains "409" anywhere (a URL, an id, a number) is silently dropped from the report's problem list instead of just the one expected 409.
**Fix:** Have `allowConsole` return a function that removes the pattern, and call it in a `finally` at the end of the case, or match the full expected line, for example `/status of 409.*company-expenses/`.

### D-IN-03: Helpers and constants copied across the Phase 6 specs and scripts

**File:** `web/e2e/expenses.spec.ts:24-33, 202-207, 799-802`; `web/e2e/expenses-sweep.spec.ts:18-40, 70-73`; `web/e2e/settings.spec.ts:14-31`; `web/e2e/audit-log.spec.ts:15-18, 40-43, 262-267`; `web/scripts/owner-review.mjs:190, 3566-3579`
**Issue:** `manilaDate` is defined five times (four specs and owner-review.mjs), `press` four times, `uniqueWord` twice, and `NO_SIDEWAYS_SCROLL`, `RENT` and `SUPPLIES` each three or four times. `owner-review.mjs:190` repeats the E2E connection string that `e2e.mjs` already exports as `LOCALDB_E2E_CONNECTION` (the same value today; if one changes, the host and the seed step quietly point at different databases). A fix to one copy (for example the Manila-midnight edge of `manilaDate`) will miss the others.
**Fix:** Move the shared pieces to `web/e2e/helpers.ts` (dates, `press`, `uniqueWord`, the category ids, the sideways-scroll scripts) and import `LOCALDB_E2E_CONNECTION` from `./e2e.mjs` in owner-review.mjs.

### D-IN-04: Stale comment says the expense sweep is still to come

**File:** `web/e2e/sweep.ts:23`
**Issue:** The comment says the expenses page sweep "joins the signed-in sweep in plan 06-18", but that sweep already exists in `expenses-sweep.spec.ts` (and sweep.ts still carries only the dev-preview pages). It reads as unfinished work.
**Fix:** Replace with: "/admin/expenses is a signed-in page with no dev preview; its sweep is `expenses-sweep.spec.ts`."

---

_Reviewed: 2026-10-25T23:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

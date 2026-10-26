---
phase: 06-company-expenses
review: 06-REVIEW.md
created: "2026-10-26T00:03:00-05:00"
updated: "2026-10-26T05:52:00-05:00"
---

# Phase 6: Code Review Disposition

*Created: 2026-10-26T00:03:00-05:00 · Updated: 2026-10-26T05:52:00-05:00*

One row per finding of `06-REVIEW.md`. The backend fixes ran as a code-fix pass with the owner away; nothing here was approved on
the owner's behalf. Each behavior change was made test first (a failing test commit, then the fix commit). The web findings
(Part C, the A-WR-01 web side and the Part D script and e2e items) ran as a second fix pass on 2026-10-26, also with the owner
away.

## Part A: Domain and Application

| ID | Outcome | Commits | Note |
|----|---------|---------|------|
| A-WR-01 | fixed | `81922385` (tests, red), `cb5a5a69` (fix), `05ee8a77` (API guide); web: `5a06a1e4` (tests, red), `0a772026` (fix) | On an edit, the amount cap and the description and notes lengths apply only to a value that changes, in both the validator and the domain. Add is unchanged. The handler reads the stored values before the form check, so a bad form still answers 400 with every field before the 404, 403 and 409 steps (one extra read per edit). Tests: legacy over-cap amount unchanged with a category change gives 200; a changed amount over the cap gives 400. **Web side (web fix pass):** `expenseFormSchema` takes the opened expense's stored description, amount and notes on an edit and applies each limit only to a changed value (compared after the trim, as the server does); Add passes nothing and keeps every limit (OR-3). Tests: an unchanged legacy amount of 1,500,000.00 passes and saves from the Edit modal; a change to 1,600,000 is blocked with no request. |
| A-IN-01 | fixed | `85d54dd8` (test, red), `2b2601e2` (fix) | A missing business today now throws an error that names the `today` key, instead of a bare dictionary error. |
| A-IN-02 | parked for owner | none | Already covered by the Owner backlog item "Phase 6 wording for a Paid by who has not signed in" (D-49 wording, options recorded there). No change made. |
| A-IN-03 | accepted by owner (D-57, 2026-10-26: option 2, keep as built) | `4db32f44` (backlog item) | Who may read expense notes. Parked in the STATE.md Owner backlog under the "Any checkpoints..." line, option (1) recommended: only someone who can edit the expense sees its notes. No change made. |
| A-IN-04 | fixed | `bc4f434e` | `ExpenseCategoryRules.OthersNameLocked` points at `ExpenseCategory.OthersNameMessage`; the edit handler leaves the Others rename refusal to `ExpenseCategory.Rename`. Existing Others tests pass unchanged. |
| A-IN-05 | fixed | `c2d078b8` | `RowVersions.InvalidMessage` owns the text and the profile validator reads it, so `Common` no longer depends on `Profile`. The `TargetType` doc lists `CompanyExpense` and `ExpenseCategory`. |
| A-IN-06 | fixed | `79812741` | Kept the branch (a test covers it) with a comment that it only guards a tracked entity already marked deleted in memory, as the review allowed. |

## Part B: Infrastructure and Server

| ID | Outcome | Commits | Note |
|----|---------|---------|------|
| B-WR-01 | fixed | `057f99c4` (tests, red), `edf21c43` (fix) | One shared helper, `Persistence/SqlErrors`, walks the inner-exception chain; `DatabaseLocks`, `CspsUnitOfWork` and `IdempotencyGate` use it. The stale takeover reads a wrapped deadlock as busy; a failed purge or release is logged and never fails the request; `IdempotencyLease.DisposeAsync` never throws for a failed rollback or release and always disposes the transaction. Tests inject a real wrapped SQL error (a captured real deadlock for the takeover). |
| B-IN-01 | fixed | `057f99c4` (test, red), `8c1cfd7a` (fix) | When the takeover changes no row, the claim is read again; if it is gone, the insert runs again (the existing loop allows up to three tries). |
| B-IN-02 | deferred | none | Already parked with the Owner backlog lease item (06-21, D-50); the lease bounds the window. No change made. |
| B-IN-03 | fixed | `676834f9` (tests, red), `45f5bc49` (fix) | The wait is rounded up to whole seconds, at least one; a wait of zero or less is refused. |
| B-IN-04 | deferred | none | Phase 7 refactor (a per-feature save-failure translator) when order constraints arrive. |
| B-IN-05 | deferred | none | Not a small mapping: it needs a new retryable error code in four form handlers (`UpdateCompanyExpenseHandler`, `UpdateExpenseCategoryHandler`, `UpdateProfileNameHandler`, `UpdateUserHandler`) and a web display for it, since the web edit forms key their banner on `edit.stale`. Data is safe today (the loser saved nothing); only the message is off. Suggested for the next API and web pass that touches the edit forms. |
| B-IN-06 | fixed | `c3212794` | The `IdempotencyGate` summary and the STATE.md lease backlog item now say that routes keeping a change without a stored answer (the profile actions that count a wrong password or spend an email-change link) may apply twice after a takeover. Options unchanged, recommended first. |

## Part C: Web client

| ID | Outcome | Commits | Note |
|----|---------|---------|------|
| C-WR-01 | fixed | `bead4d3d` (tests, red), `d0c62821` (fix) | `useRefreshExpenses` also refreshes `['expense-categories']`, so add, edit, delete, restore and delete permanently all keep the Settings expense counts and Delete offer right. `useRefreshCategories` now reuses it (no double refresh). The add, edit, delete and purge tests on the list page and the restore and purge tests on the deleted page check the category key. |
| C-WR-02 | fixed | `04d7560a` (tests, red), `717df8f7` (fix) | The 404 "deleted" branch and the 403 "not yours" branch run only in Edit, where their banners live. In Add, a 404 shows the mapped line "Not found. It may have been deleted. Go back and refresh the list." and Save stays usable. |
| C-WR-03 | fixed | `e7ff1f79` (tests, red), `56e0e906` (fix) | Restore on the deleted page and Retire or Use again on Settings re-read their lists on a 404 (the danger toast still shows), so a row another Manager removed leaves the table. |
| C-IN-01 | fixed | `1901bb63` (tests, red), `0042b5b4` (fix) | `pageParser` accepts 1 to `MAX_PAGE` (100000, the `MaxPage` of the users, audit and expense list validators); `guidParser` refuses the all-zero GUID. |
| C-IN-02 | fixed | `d5088648` | The two list hooks take their first key segment from `expensesKey` and `expensesDeletedKey`; `expensesDeletedKey` moved to `useDeletedExpensesQuery.ts`. The page tests check the constants instead of string literals. |
| C-IN-03 | fixed | `d0c62821` | `ExpensesPage.saved` and `updated` call `refreshAll()` (with the same focus step after it) instead of three hand-written refreshes. |

## Part D: Test infrastructure, e2e, review scripts

| ID | Outcome | Commits | Note |
|----|---------|---------|------|
| D-WR-01 | fixed | `4be107e7` | `Rig.StartAsync` disposes both web factories when setup throws. No red test (test infrastructure, failure path only). The same pattern (factories made before the rig owns them) also exists in the rigs of `CompanyExpenseKpisEndpointTests`, `ExpenseListTimingTests`, `ListCompanyExpensesEndpointTests` and `ListDeletedExpensesEndpointTests`; fixed in the web fix pass (row below). |
| D-WR-01 (follow-up) | fixed | `ba9411d4` | The same dispose-on-setup-failure fix in the rigs of `CompanyExpenseKpisEndpointTests`, `ExpenseListTimingTests`, `ListCompanyExpensesEndpointTests` and `ListDeletedExpensesEndpointTests`. No red test (failure path only); the four classes pass. |
| D-WR-02 | fixed | `b1519980` | `e2-edit-conflict` saves a fixed rival amount (705, or 710 if 705 is already stored) and puts the seeded values back after the picture, so every theme and width shows the same amounts. Each Manager view still adds two "Expense changed" audit entries (the rival save and the put-back); the audit picture expands the newest one, which is now the same in every view. |
| D-IN-01 | fixed | `a41b4d68` | `Count` is read from the same queue as `Commands`, and `Reset` swaps that one queue. No red test (a race of one command is not reliably reproducible); the count tests pass. |
| D-IN-02 | fixed | `b1519980` | `allowConsole` returns a function that removes the pattern; the conflict case calls it in a `finally`, so the 409 allowance covers only that step. |
| D-IN-03 | fixed | `a944a473` | New `web/e2e/helpers.ts` holds `manilaDate`, `press`, `uniqueWord`, `RENT`, `SUPPLIES` and `NO_SIDEWAYS_SCROLL`. The four Phase 6 specs (`expenses`, `expenses-sweep`, `settings`, `audit-log`) and `owner-review.mjs` import them, and `owner-review.mjs` takes the host connection string from `LOCALDB_E2E_CONNECTION` in `e2e.mjs`. Older specs (Phase 5 and earlier) keep their own copies, left as they are. |
| D-IN-04 | fixed | `b1e8f4f5` | The `sweep.ts` comment now says the expenses page sweep is `expenses-sweep.spec.ts`. |

## Verification (backend pass)

All checks ran in an isolated git worktree of this branch (`.claude/worktrees/rf-06-...`, removed after the run) at the last
code commit `a41b4d68`, on LocalDB with `CSPS_TEST_SQL=localdb` set for the process only. The worktree held the same tracked files
as the branch, so the numbers are reproducible from the branch tip. The preflight showed ports 5180, 5115, 7028 and 5199 free and no
other project's test processes.

- `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- `dotnet test --solution Csps.slnx`: "Test run summary: Passed! total: 4093 failed: 0 succeeded: 4092 skipped: 1" (the skip is
  the opt-in live HIBP test). Duration 4 min 44 s.
- `tools/scripts/Invoke-CoverageGate.ps1`: "Csps.Domain line 100% (1072/1072) branch 100% (458/458) PASS; Csps.Application line
  98.3% (3809/3874) PASS. Coverage gate passed."
- Re-run alone, all passed: `IdempotencyGateTests` 15/15, `DatabaseLocksTests` 15/15, `CspsUnitOfWorkTests` 3/3,
  `AccountTokenLockTests` 4/4, `IdempotencyTests` 42/42, `IdempotencyCoverageTests` 12/12, `CompanyExpenseConcurrencyTests` 3/3,
  `ProfileConcurrencyTests` 1/1, `UserEditConcurrencyTests` 2/2. No flake was seen.

## Verification (web fix pass)

All checks ran in the main checkout on branch `gsd/phase-06-company-expenses` (no worktree), at the last code commit `b1e8f4f5`,
with `CSPS_TEST_SQL=localdb` set for the .NET test process only. The preflight showed ports 5180, 5115, 7028 and 5199 free and no
other project's test processes before each run.

- `npm --prefix web run verify`: exit 0. "Test Files 202 passed (202)", "Tests 5959 passed (5959)". Coverage: statements 95.52%,
  branches 90.41%, functions 96.43%, lines 98.5%. Budgets: public JS 123.08 KB, admin JS 206.52 KB, CSS 14.78 KB (all ok;
  budget build 123.30 / 208.26 / 14.78 KB, ok). "License gate passed." Notices up to date (28 packages).
- `npm --prefix web run e2e -- --grep "@expenses|@settings"`: 138 passed, 2 failed. Both failures were `@expenses-add an Admin
  adds an expense...` on `[webkit]` and `[iphone]`: the 150 s test limit ran out while the save was in flight (the snapshot shows
  "Saving"). Re-run alone on both projects: "2 passed (2.1m)". Recorded as a flake in `deferred-items.md`.
- `npm --prefix web run review`: exit 0, no FAILED line; "the report is ready". The last Manager list picture (Espresso, 1440 px)
  shows "Sticker paper" at ₱700.00, the seeded amount, after five earlier conflict steps.
- `dotnet build Csps.slnx`: 0 warnings, 0 errors. `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- The four touched classes (`CompanyExpenseKpisEndpointTests`, `ExpenseListTimingTests`, `ListCompanyExpensesEndpointTests`,
  `ListDeletedExpensesEndpointTests`): "Passed! total: 57 failed: 0 succeeded: 57 skipped: 0".

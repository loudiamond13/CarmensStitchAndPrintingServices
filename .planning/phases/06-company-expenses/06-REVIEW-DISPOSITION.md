---
phase: 06-company-expenses
review: 06-REVIEW.md
created: "2026-10-26T00:03:00-05:00"
updated: "2026-10-26T00:03:00-05:00"
---

# Phase 6: Code Review Disposition

*Created: 2026-10-26T00:03:00-05:00 · Updated: 2026-10-26T00:03:00-05:00*

One row per finding of `06-REVIEW.md`. The backend fixes ran as a code-fix pass with the owner away; nothing here was approved on
the owner's behalf. Each behavior change was made test first (a failing test commit, then the fix commit). The web findings wait
for the web fix pass.

## Part A: Domain and Application

| ID | Outcome | Commits | Note |
|----|---------|---------|------|
| A-WR-01 | fixed | `81922385` (tests, red), `cb5a5a69` (fix), `05ee8a77` (API guide) | On an edit, the amount cap and the description and notes lengths apply only to a value that changes, in both the validator and the domain. Add is unchanged. The handler reads the stored values before the form check, so a bad form still answers 400 with every field before the 404, 403 and 409 steps (one extra read per edit). Tests: legacy over-cap amount unchanged with a category change gives 200; a changed amount over the cap gives 400. **Web follow-up for the web fix pass:** `web/src/modules/admin/expensesSchemas.ts` still applies the cap on edit, so the browser blocks the same legacy rows before the request is sent (OR-3 mirror). |
| A-IN-01 | fixed | `85d54dd8` (test, red), `2b2601e2` (fix) | A missing business today now throws an error that names the `today` key, instead of a bare dictionary error. |
| A-IN-02 | parked for owner | none | Already covered by the Owner backlog item "Phase 6 wording for a Paid by who has not signed in" (D-49 wording, options recorded there). No change made. |
| A-IN-03 | parked for owner | `4db32f44` (backlog item) | Who may read expense notes. Parked in the STATE.md Owner backlog under the "Any checkpoints..." line, option (1) recommended: only someone who can edit the expense sees its notes. No change made. |
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

| ID | Outcome |
|----|---------|
| C-WR-01 | pending: web fix pass |
| C-WR-02 | pending: web fix pass |
| C-WR-03 | pending: web fix pass |
| C-IN-01 | pending: web fix pass |
| C-IN-02 | pending: web fix pass |
| C-IN-03 | pending: web fix pass |

## Part D: Test infrastructure, e2e, review scripts

| ID | Outcome | Commits | Note |
|----|---------|---------|------|
| D-WR-01 | fixed | `4be107e7` | `Rig.StartAsync` disposes both web factories when setup throws. No red test (test infrastructure, failure path only). The same pattern (factories made before the rig owns them) also exists in the rigs of `CompanyExpenseKpisEndpointTests`, `ExpenseListTimingTests`, `ListCompanyExpensesEndpointTests` and `ListDeletedExpensesEndpointTests`; left unchanged here, suggested for the web or test fix pass. |
| D-WR-02 | pending: web fix pass | | |
| D-IN-01 | fixed | `a41b4d68` | `Count` is read from the same queue as `Commands`, and `Reset` swaps that one queue. No red test (a race of one command is not reliably reproducible); the count tests pass. |
| D-IN-02 | pending: web fix pass | | |
| D-IN-03 | pending: web fix pass | | |
| D-IN-04 | pending: web fix pass | | |

## Verification

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

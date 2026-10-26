---
phase: 06-company-expenses
status: issues_found
depth: standard (Part B deep)
diff_base: 942a838
files_reviewed: 170
findings:
  critical: 0
  warning: 7
  info: 19
  total: 26
created: "2026-10-25T23:55:00-05:00"
updated: "2026-10-25T23:55:00-05:00"
---

# Phase 6: Code Review (merged)

Four reviewers ran in parallel, one per area. Their full reports, with code locations and suggested fixes, are kept beside this file. This page is the merged summary and the single list of findings.

| Part | Area | Files | Depth | Critical | Warning | Info | Report |
|------|------|-------|-------|----------|---------|------|--------|
| A | Domain and Application | 68 | standard | 0 | 1 | 6 | `06-REVIEW-partA.md` |
| B | Infrastructure, Server, tools, the EF-only locks | 31 | deep | 0 | 1 | 6 | `06-REVIEW-partB.md` |
| C | Web client | 58 | standard | 0 | 3 | 3 | `06-REVIEW-partC.md` |
| D | Test infrastructure, e2e, review scripts | 13 | standard | 0 | 2 | 4 | `06-REVIEW-partD.md` |

Generated files (OpenAPI snapshot, `api.generated.ts`, EF designer and snapshot files) and unit test files were left out of scope.

## Findings

### Warnings

- **A-WR-01:** an edit re-applies the new-expense caps to fields the user did not change, so a legacy row over a cap (D-33) cannot be edited at all.
- **B-WR-01:** `IdempotencyGate` catches the wrong exception types; EF wraps deadlocks and transient SQL errors in `InvalidOperationException`, so the stale-takeover deadlock path, the purge and the claim release can fail a request.
- **C-WR-01:** expense changes never refresh `['expense-categories']`, so the Settings expense count and Delete offer can be wrong for up to 30 s.
- **C-WR-02:** `ExpenseModal` treats every 404 as "expense deleted", which shows nothing in Add mode.
- **C-WR-03:** Restore (Deleted Expenses) and Retire or Use again (Settings) do not re-read the list after a 404.
- **D-WR-01:** `CompanyExpenseListQueryCountTests` setup can leak two test hosts if it throws before the rig owns them.
- **D-WR-02:** the review pack's stale-save picture changes the shared expense amount on every view, so the pictures disagree.

### Info

- **A-IN-01:** `ExpenseFieldsValidator` throws if the `today` context key is missing (latent).
- **A-IN-02:** the `PaidByInactive` message ("account isn't active") is wrong for the D-49 never-signed-in case.
- **A-IN-03:** the expense detail returns Notes to any staff member, including an Admin who cannot edit the row.
- **A-IN-04:** the Others rename rule and message are duplicated between `ExpenseCategoryRules` and `ExpenseCategory`.
- **A-IN-05:** `Common/RowVersions` depends on the Profile validator; the `TargetType` doc in `IAuditLogReader` is stale.
- **A-IN-06:** an unreachable branch in `DeleteCompanyExpenseHandler`.
- **B-IN-01:** a stale claim purged between read and takeover gives a 409 although the key is free.
- **B-IN-02:** a client that disconnects during the claim insert can leave the key in progress for the full lease.
- **B-IN-03:** a lock wait under half a second rounds to 0, which means wait forever.
- **B-IN-04:** `CspsUnitOfWork` depends on `ExpenseCategoryStore`.
- **B-IN-05:** a deadlock while saving a form edit shows the stale-save 409 message.
- **B-IN-06:** the idempotency class summary and the owner backlog item say "only one of them saves", which is not true for routes that keep changes without storing an answer.
- **C-IN-01:** the shared URL parsers accept a page over the server cap and the all-zero GUID.
- **C-IN-02:** the two list query-key strings are written out in two files each.
- **C-IN-03:** `ExpensesPage.saved` and `updated` repeat the invalidation calls instead of using the shared refresh.
- **D-IN-01:** `CommandCounter.Count`, `Commands` and `Reset` can disagree by one under concurrency.
- **D-IN-02:** `allowConsole(/409/)` in the review script stays active for the rest of the page.
- **D-IN-03:** helpers and the E2E connection string are duplicated across specs and scripts.
- **D-IN-04:** a stale comment in `web/e2e/sweep.ts`.

## What held up

No reviewer found a way for two requests to pass any of the three rebuilt locks. Money is server-computed decimal with matching caps on both layers. Audit entries never store description or notes text. There is no inline SQL in `src`, no trigger, and every action declares a policy. The zod schemas match the server rules, no money is computed in the browser, and there is no unsafe HTML.

The outcome of each finding is recorded in `06-REVIEW-DISPOSITION.md`.

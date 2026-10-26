---
phase: 06-company-expenses
reviewed: 2026-10-25T23:00:00Z
depth: standard
part: A (Domain and Application)
files_reviewed: 68
files_reviewed_list:
  - src/Csps.Application/Audit/AuditChangeLines.cs
  - src/Csps.Application/Audit/AuditLogResponse.cs
  - src/Csps.Application/Audit/ListAuditLogHandler.cs
  - src/Csps.Application/Common/AuditDetailFormat.cs
  - src/Csps.Application/Common/RowVersions.cs
  - src/Csps.Application/ExpenseCategories/CategoryAuditDetail.cs
  - src/Csps.Application/ExpenseCategories/CreateExpenseCategoryHandler.cs
  - src/Csps.Application/ExpenseCategories/CreateExpenseCategoryRequest.cs
  - src/Csps.Application/ExpenseCategories/CreateExpenseCategoryRequestValidator.cs
  - src/Csps.Application/ExpenseCategories/DeleteExpenseCategoryHandler.cs
  - src/Csps.Application/ExpenseCategories/ExpenseCategoryDetailResponse.cs
  - src/Csps.Application/ExpenseCategories/ExpenseCategoryErrors.cs
  - src/Csps.Application/ExpenseCategories/ExpenseCategoryFieldsValidator.cs
  - src/Csps.Application/ExpenseCategories/ExpenseCategoryListItem.cs
  - src/Csps.Application/ExpenseCategories/ExpenseCategoryRules.cs
  - src/Csps.Application/ExpenseCategories/GetExpenseCategoryHandler.cs
  - src/Csps.Application/ExpenseCategories/IExpenseCategoryFields.cs
  - src/Csps.Application/ExpenseCategories/ListExpenseCategoriesHandler.cs
  - src/Csps.Application/ExpenseCategories/ReactivateExpenseCategoryHandler.cs
  - src/Csps.Application/ExpenseCategories/RetireExpenseCategoryHandler.cs
  - src/Csps.Application/ExpenseCategories/UpdateExpenseCategoryHandler.cs
  - src/Csps.Application/ExpenseCategories/UpdateExpenseCategoryRequest.cs
  - src/Csps.Application/ExpenseCategories/UpdateExpenseCategoryRequestValidator.cs
  - src/Csps.Application/Expenses/CompanyExpenseDetailResponse.cs
  - src/Csps.Application/Expenses/CompanyExpenseKpisResponse.cs
  - src/Csps.Application/Expenses/CompanyExpenseListResponse.cs
  - src/Csps.Application/Expenses/CreateCompanyExpenseHandler.cs
  - src/Csps.Application/Expenses/CreateCompanyExpenseRequest.cs
  - src/Csps.Application/Expenses/CreateCompanyExpenseRequestValidator.cs
  - src/Csps.Application/Expenses/DeleteCompanyExpenseHandler.cs
  - src/Csps.Application/Expenses/DeletedExpenseListResponse.cs
  - src/Csps.Application/Expenses/ExpenseAccess.cs
  - src/Csps.Application/Expenses/ExpenseAuditDetail.cs
  - src/Csps.Application/Expenses/ExpenseCategoryRef.cs
  - src/Csps.Application/Expenses/ExpenseErrors.cs
  - src/Csps.Application/Expenses/ExpenseFieldsValidator.cs
  - src/Csps.Application/Expenses/GetCompanyExpenseHandler.cs
  - src/Csps.Application/Expenses/GetCompanyExpenseKpisHandler.cs
  - src/Csps.Application/Expenses/IExpenseFieldsRequest.cs
  - src/Csps.Application/Expenses/ListCompanyExpensesHandler.cs
  - src/Csps.Application/Expenses/ListCompanyExpensesRequest.cs
  - src/Csps.Application/Expenses/ListCompanyExpensesRequestValidator.cs
  - src/Csps.Application/Expenses/ListDeletedExpensesHandler.cs
  - src/Csps.Application/Expenses/ListDeletedExpensesRequest.cs
  - src/Csps.Application/Expenses/ListDeletedExpensesRequestValidator.cs
  - src/Csps.Application/Expenses/PermanentlyDeleteCompanyExpenseHandler.cs
  - src/Csps.Application/Expenses/RestoreCompanyExpenseHandler.cs
  - src/Csps.Application/Expenses/UpdateCompanyExpenseHandler.cs
  - src/Csps.Application/Expenses/UpdateCompanyExpenseRequest.cs
  - src/Csps.Application/Expenses/UpdateCompanyExpenseRequestValidator.cs
  - src/Csps.Application/Ports/CategoryDeletedException.cs
  - src/Csps.Application/Ports/CategoryInUseException.cs
  - src/Csps.Application/Ports/CategoryNameTakenException.cs
  - src/Csps.Application/Ports/IAuditLogReader.cs
  - src/Csps.Application/Ports/ICompanyExpenseReader.cs
  - src/Csps.Application/Ports/ICompanyExpenses.cs
  - src/Csps.Application/Ports/IExpenseCategories.cs
  - src/Csps.Application/Ports/IStaffDirectory.cs
  - src/Csps.Application/Staff/ListStaffHandler.cs
  - src/Csps.Application/Staff/StaffMember.cs
  - src/Csps.Application/Staff/StaffState.cs
  - src/Csps.Domain/Auditing/AuditActions.cs
  - src/Csps.Domain/Expenses/CategoryTones.cs
  - src/Csps.Domain/Expenses/CompanyExpense.cs
  - src/Csps.Domain/Expenses/ExpenseCategory.cs
  - src/Csps.Domain/Expenses/ExpenseCategorySeed.cs
  - src/Csps.Domain/Expenses/ExpenseChanges.cs
  - src/Csps.Domain/Expenses/ExpenseRules.cs
findings:
  critical: 0
  warning: 1
  info: 6
  total: 7
status: issues_found
created: "2026-10-25T23:20:00-05:00"
updated: "2026-10-25T23:20:00-05:00"
---

# Phase 6 Part A: Code Review Report (Domain and Application)

**Reviewed:** 2026-10-25T23:00:00Z
**Depth:** standard
**Files Reviewed:** 68
**Status:** issues_found

## Summary

I read all 68 files in full and checked them against 06-CONTEXT.md D-01 to D-53, with extra attention to D-06/D-27 (audit content), D-19 to D-21 (field rules), D-26 (Admin edit rule), D-32/D-49 (payer rule) and D-50 (no inline SQL).

I found no blockers. The areas below held up:

- **Money:** amounts are `decimal`. The cap, the zero floor and the two-place scale are checked in the validator and again in the domain, with matching wording. The KPI share is decimal math rounded half away from zero. Audit amounts use the invariant `0.00` format.
- **Audit content (D-27/D-06):** `ExpenseAuditDetail` has no code path that writes description or notes text. An edit writes only the field names `description` and `notes`. The audit reader (`AuditChangeLines`) accepts only known keys and requires each value to have the shape the writer gives it.
- **Time:** the code never reads `DateTime.Now` or `DateTimeOffset.UtcNow`. Dates come from `IBusinessCalendar` or `TimeProvider`.
- **Inline SQL:** none in these files.
- **D-26:** `ExpenseAccess.CanEdit` is the single rule. The detail, the list and the save all call it, and the server re-checks it on save.
- **Concurrency:** form saves check the stored row version, then rely on the EF concurrency token, and answer 409 (`EditErrors.Stale`). Single-click actions use `ConflictRetry` with one retry. `CategoryDeletedException`, `CategoryInUseException` and `CategoryNameTakenException` cover the foreign-key and unique-index races.
- **Audit detail length:** the worst-case edit detail is about 230 characters against the 400 limit. A category rename with fully encoded names is about 250.
- **Layering:** the Application layer references only Domain, with no EF types.

The one real finding is a functional gap for legacy data that D-33 explicitly allows. The rest are minor.

## Warnings

### A-WR-01: Editing an expense re-applies the new-expense caps to values the edit did not touch, so over-cap legacy rows cannot be edited at all

**File:** `src/Csps.Application/Expenses/UpdateCompanyExpenseHandler.cs:51-58`, `src/Csps.Application/Expenses/ExpenseFieldsValidator.cs:32-36`, `src/Csps.Domain/Expenses/CompanyExpense.cs:213-226` (called from `Update`, line 127)
**Issue:** D-33 says the database checks only `Amount > 0` so that "legacy imports can hold larger amounts" than the 1,000,000.00 cap. The edit path validates the whole form (the validator runs before the row is loaded) and then `CompanyExpense.Update` re-runs `CheckFields`. Both apply the cap, the 200-character description limit and the 1,000-character notes limit to the submitted values, whether or not the user changed them.

So when a migrated expense has an amount above ₱1,000,000.00, even a Manager who only wants to fix its category or payer gets "Enter an amount of ₱1,000,000.00 or less." The same happens for an over-length legacy description or notes. The only way through is to change a value the user may not want to change, which falsifies money data. The 400 happens before the 404/403/409 steps, so the user sees a misleading amount error on a field they never touched.

This only matters if the legacy import can produce such rows, which D-33 says it can. Please confirm against the Phase 12 import rules.

**Fix:** Move the length and cap rules for amount, description and notes behind a "changed from the stored value" check. Either of these works:
```csharp
// Domain: CheckFields takes the current values (null on Create) and skips a rule when the value equals the stored one.
if (amount != current?.Amount && amount > ExpenseRules.AmountMax) { return Reject(...); }
```
or keep the validator as the new-expense rule set and let the handler skip the cap rules for fields equal to the loaded row. A test should cover an edit of an over-cap row that changes only the category.

## Info

### A-IN-01: `ExpenseFieldsValidator` throws `KeyNotFoundException` when the business today is not in the validation context

**File:** `src/Csps.Application/Expenses/ExpenseFieldsValidator.cs:70`
**Issue:** `(DateOnly)context.RootContextData[TodayKey]` throws, and so produces a 500, if any caller runs the registered `IValidator<CreateCompanyExpenseRequest>` or `IValidator<UpdateCompanyExpenseRequest>` without first setting `"today"`. Today only the two handlers call them and both set the key, so this is latent. It is a hidden contract carried by a magic string.
**Fix:** Use `TryGetValue` and add a clear failure (or throw `InvalidOperationException` with a message that names the key), or inject `IBusinessCalendar` into the validator as `ListAuditLogRequestValidator` does.

### A-IN-02: `PaidByInactive` message is wrong for the D-49 "has never signed in" case

**File:** `src/Csps.Domain/Expenses/ExpenseRules.cs:85`, used at `CreateCompanyExpenseHandler.cs:124` and `UpdateCompanyExpenseHandler.cs:168`
**Issue:** `CanPay` is false for a deactivated, locked or deleted person, and also for a person who has not finished first sign-in (D-49). The one message says "their account isn't active", which is not true for someone who is active but has never signed in. The staff lookup hides these people from the picker, so the message appears only after a stale list or a direct API call. D-32 asks for plain English that fits the cause.
**Fix:** Use wording that covers all the cases, for example "This person can't be chosen as payer yet. Choose someone else." The matching zod message in the web code should change at the same time (OR-3).

### A-IN-03: The expense detail returns Notes to any staff member, including an Admin who cannot edit the row

**File:** `src/Csps.Application/Expenses/CompanyExpenseDetailResponse.cs:52-60`, `GetCompanyExpenseHandler.cs`
**Issue:** D-19 says notes show only in the form, and D-26 says an Admin can edit only their own expenses. D-25 lets Admins see every expense in the list, totals and KPIs. The detail endpoint returns `Notes` for every expense to both roles, so an Admin can read the notes of an expense they could never open in the form. Notes are free text that D-06 treats as possibly holding personal details.
**Fix:** This is the owner's call (the decisions leave it open). If notes should follow the edit rule, set `Notes` to null when `CanEdit` is false in `CompanyExpenseDetailResponse.From`. Otherwise record the ruling that Admins may read all notes.

### A-IN-04: Duplicated Others rule and message

**File:** `src/Csps.Application/ExpenseCategories/ExpenseCategoryRules.cs:30`, `src/Csps.Domain/Expenses/ExpenseCategory.cs:41`, `UpdateExpenseCategoryHandler.cs:123-132`
**Issue:** The text "The Others name can't change." exists twice (`ExpenseCategoryRules.OthersNameLocked` and `ExpenseCategory.OthersNameMessage`), and the "Others keeps its name" check is written in both `CheckNameAsync` and `ExpenseCategory.Rename`. The two copies can drift apart.
**Fix:** Point `OthersNameLocked` at `ExpenseCategory.OthersNameMessage` as the other constants in that file already do. The handler pre-check can then be reduced to the uniqueness lookup, since `Rename` already refuses Others.

### A-IN-05: `Common/RowVersions` depends on the Profile feature, and a port comment is stale

**File:** `src/Csps.Application/Common/RowVersions.cs:1,15`, `src/Csps.Application/Ports/IAuditLogReader.cs:53`
**Issue:** `Common` is meant to be shared plumbing, but `RowVersions.InvalidMessage` reads `UpdateProfileNameRequestValidator.VersionInvalid`, so Common now depends on one feature (Profile). Separately, the `AuditLogEntryView.TargetType` doc still says `User` or `UserSession`, but expense and category entries now carry `CompanyExpense` and `ExpenseCategory`.
**Fix:** Move the version message into `Common` (for example `EditErrors` or `RowVersions`) and let the Profile validator reference it. Update the `TargetType` doc.

### A-IN-06: Unreachable branch in the soft-delete handler

**File:** `src/Csps.Application/Expenses/DeleteCompanyExpenseHandler.cs:52-55`
**Issue:** `FindAsync(id, includeDeleted: false)` never returns a deleted row, so `expense.SoftDelete(...)` can never return false there. The branch is dead code (and is probably also a coverage gap against the Application 95% target).
**Fix:** Drop the branch and ignore the return value (`_ = expense.SoftDelete(callerId, time.GetUtcNow());`), or keep it with a comment that it only guards a tracked-entity race.

---

_Reviewed: 2026-10-25T23:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

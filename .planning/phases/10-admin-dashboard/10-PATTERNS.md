---
created: "2026-11-05T14:40:00-06:00"
updated: "2026-11-05T14:40:00-06:00"
---

# Phase 10: Admin Dashboard - Pattern Map

*Created: 2026-11-05T14:40:00-06:00 · Updated: 2026-11-05T14:40:00-06:00*

**Mapped:** 2026-11-05
**Files analyzed:** 52 new or changed files (grouped below)
**Analogs found:** 49 / 52

Every analog path below is git-tracked (checked with `git ls-files`). The Company Expenses slice (Phase 6) is the closest model for almost everything: a resource controller with a Manager-only soft delete and permanent delete, handlers with audit entries, a KPI reader, a modal form, URL list state and a refresh hook.

## File Classification

### Backend

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/Csps.Domain/Money/MoneyTransfer.cs` | model (aggregate) | CRUD | `src/Csps.Domain/Expenses/CompanyExpense.cs` | exact |
| `src/Csps.Domain/Money/MoneyRules.cs`, `MoneyOnHand.cs` | utility (pure rules) | transform | `src/Csps.Domain/Expenses/ExpenseRules.cs` | role-match |
| `src/Csps.Domain/Time/BusinessClock.cs` (add `WeekOf`, `SameDayLastMonth`, greeting) | utility (pure) | transform | itself, `MonthOf` (lines 26-27) | exact |
| `src/Csps.Domain/Orders/OrderStatusRules.cs` (add `CanBeOverdue`) | utility | transform | itself, `IsActive` (line 51) | exact |
| `src/Csps.Domain/Auditing/AuditActions.cs` (3 money codes) | config | n/a | itself, lines 121-136 and the list at 453 | exact |
| `src/Csps.Application/Dashboard/GetDashboardSummaryHandler.cs` | service (handler) | request-response (read) | `src/Csps.Application/Expenses/GetCompanyExpenseKpisHandler.cs` | exact |
| `src/Csps.Application/Dashboard/GetDashboardChartHandler.cs` | service | request-response (read) | same | role-match |
| `src/Csps.Application/Money/CreateMoneyTransferHandler.cs`, `HandOverMoneyHandler.cs` | service | CRUD (locked write) | `src/Csps.Application/Expenses/CreateCompanyExpenseHandler.cs` + `PermanentlyDeleteCompanyExpenseHandler.cs` (ConflictRetry) | exact |
| `src/Csps.Application/Money/DeleteMoneyTransferHandler.cs` | service | CRUD (soft delete + version) | `src/Csps.Application/Expenses/DeleteCompanyExpenseHandler.cs` + version check in `UpdateCompanyExpenseHandler.cs:116` | exact |
| `src/Csps.Application/Money/RemoveMoneyTransferHandler.cs` | service | CRUD (hard delete + audit) | `src/Csps.Application/Expenses/PermanentlyDeleteCompanyExpenseHandler.cs` | exact |
| `src/Csps.Application/Money/Get*Balance/Ledger/List*/Recipients handlers` | service | request-response (read) | `src/Csps.Application/Expenses/ListCompanyExpensesHandler.cs`, `ListDeletedExpensesHandler.cs` | role-match |
| `src/Csps.Application/Money/*Validator.cs` | utility (validation) | request-response | `src/Csps.Application/Expenses/CreateCompanyExpenseRequestValidator.cs`, `ListCompanyExpensesRequestValidator.cs` | exact |
| `src/Csps.Application/Money/MoneyErrors.cs` | config | n/a | `src/Csps.Application/Expenses/ExpenseErrors.cs` | exact |
| `src/Csps.Application/Money/MoneyAuditDetail.cs` | utility | transform | `src/Csps.Application/Expenses/ExpenseAuditDetail.cs` | exact |
| `src/Csps.Application/Money/LedgerRunningBalance.cs` | utility (pure) | transform | none (RESEARCH Code Examples) | no analog |
| `src/Csps.Application/Audit/AuditChangeLines.cs` (new keys) | utility | transform | itself (lines 151-152) | exact |
| `src/Csps.Application/Ports/IDashboardReader.cs`, `IStaffMoneyReader.cs`, `IMoneyTransfers.cs` | port | n/a | `src/Csps.Application/Ports/ICompanyExpenseReader.cs`, `ICompanyExpenses.cs` | exact |
| `src/Csps.Application/Ports/IStaffMoneyLock.cs`, `StaffMoneyBusyException.cs` | port | n/a | `src/Csps.Application/Ports/IManagerRosterLock.cs`, `OrderNumberBusyException.cs` | exact |
| `src/Csps.Infrastructure/Dashboard/DashboardReader.cs` | repository (read) | batch aggregate | `src/Csps.Infrastructure/Orders/OrderReader.cs` (lines 68-72) + `src/Csps.Infrastructure/Expenses/CompanyExpenseReader.cs` | role-match |
| `src/Csps.Infrastructure/Money/StaffMoneyReader.cs` | repository (read) | batch aggregate | `src/Csps.Infrastructure/Expenses/CompanyExpenseReader.cs` | role-match |
| `src/Csps.Infrastructure/Money/MoneyTransferStore.cs` | repository | CRUD | `src/Csps.Infrastructure/Expenses/CompanyExpenseStore.cs` | exact |
| `src/Csps.Infrastructure/Money/StaffMoneyLock.cs` | service (lock) | request-response | `src/Csps.Infrastructure/Identity/ManagerRosterLock.cs` + `src/Csps.Infrastructure/Orders/OrderNumberAllocator.cs:68-79` | exact |
| `src/Csps.Infrastructure/Money/MoneyRegistration.cs` | config | n/a | `src/Csps.Infrastructure/Expenses/ExpensesRegistration.cs` | exact |
| `src/Csps.Infrastructure/Persistence/Configurations/MoneyTransferConfiguration.cs` | config (EF) | n/a | `src/Csps.Infrastructure/Persistence/Configurations/CompanyExpenseConfiguration.cs` | exact |
| `src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs` (add `StaffMoney`) | config | n/a | itself, lines 13-33 | exact |
| `src/Csps.Infrastructure/Persistence/CspsDbContext.cs` (`MoneyTransfers` set) | config | n/a | the `CompanyExpenses` set in it | exact |
| `src/Csps.Infrastructure/Persistence/Migrations/<ts>_AddMoneyTransfers.cs` | migration (generated) | n/a | `20261104051745_AddImageDeletions` | generated |
| `src/Csps.Server/Controllers/DashboardController.cs` | controller | request-response | `src/Csps.Server/Controllers/CompanyExpensesController.cs` (`Kpis`, lines 90-98) | exact |
| `src/Csps.Server/Controllers/StaffMoneyController.cs` | controller | request-response | same (`List`, lines 43-59) | exact |
| `src/Csps.Server/Controllers/MoneyTransfersController.cs` | controller | CRUD | same (`Create`, `Delete`, `PermanentlyDelete`) | exact |
| `src/Csps.Server/Composition/MoneyApplicationRegistration.cs` (or extend an existing one) | config | n/a | `src/Csps.Server/Composition/ExpensesApplicationRegistration.cs` | exact |
| `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` (rows) | test | n/a | itself, lines 208 and 214 | exact |
| `tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksMigrationTests.cs` (66 to 67) | test | n/a | itself, line 22 | exact |

### Web

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `web/src/modules/admin/services/dashboardService.ts`, `moneyService.ts` | service | request-response | `web/src/modules/admin/services/expensesService.ts` | exact |
| `web/src/modules/admin/hooks/useDashboardSummaryQuery.ts`, `useDashboardChartQuery.ts`, `useMyMoneyQuery.ts`, `useLedgerQuery.ts`, `useStaffBalancesQuery.ts`, `useTransfersQuery.ts`, `useTransferRecipientsQuery.ts` | hook (query) | request-response | `web/src/modules/admin/hooks/useExpenseKpisQuery.ts`, `useExpensesQuery.ts` | exact |
| `web/src/modules/admin/hooks/useTransferAction.ts` | hook (mutation) | CRUD | `web/src/modules/admin/hooks/useExpenseAction.ts` | exact |
| `web/src/modules/admin/hooks/useDashboardRange.ts`, `useMoneyListParams.ts`, `useStaffMoneyParams.ts` | hook (URL state) | event-driven | `web/src/modules/admin/hooks/useDeletedExpensesListParams.ts` | exact |
| `web/src/modules/admin/hooks/useRefreshMoney.ts`; changes to `useRefreshOrders.ts`, `useRefreshExpenses.ts` | hook | event-driven (invalidation) | `web/src/modules/admin/hooks/useRefreshExpenses.ts`, `useRefreshOrders.ts:13-24` | exact |
| `web/src/modules/admin/pages/DashboardPage.tsx` | component (page) | request-response | `web/src/modules/admin/pages/ExpensesPage.tsx` | role-match |
| `web/src/modules/admin/pages/MoneyPage.tsx`, `StaffMoneyPage.tsx` | component (page) | request-response | `web/src/modules/admin/pages/DeletedExpensesPage.tsx` (paged table, Manager guard) | role-match |
| `web/src/modules/admin/components/MoneyStrip.tsx`, `MoneyOnHandCard.tsx` | component | request-response | `web/src/modules/admin/components/OrderBalanceStrip.tsx`, `ExpenseKpiRow.tsx` | role-match |
| `web/src/modules/admin/components/OrdersByStatusCard.tsx`, `RecentOrdersCard.tsx` | component | request-response | `web/src/modules/admin/components/ExpenseKpiRow.tsx` (per-card states); `OrdersTable` cell renderers | role-match |
| `web/src/modules/admin/components/LedgerTable.tsx`, `StaffBalancesTable.tsx`, `TransfersTable.tsx` | component (table) | request-response | the table in `web/src/modules/admin/pages/DeletedExpensesPage.tsx` | role-match |
| `web/src/modules/admin/components/TransferModal.tsx` | component (form) | CRUD | `web/src/modules/admin/components/ExpenseModal.tsx` | exact |
| `web/src/modules/admin/components/DeleteTransferDialog.tsx`, `RemoveTransferDialog.tsx` | component (confirm) | CRUD | `web/src/modules/admin/components/DeleteOrderDialog.tsx` | exact |
| `web/src/modules/admin/dashboardCopy.ts`, `moneyCopy.ts` | config (copy) | n/a | `web/src/modules/admin/expensesCopy.ts` | exact |
| `web/src/modules/admin/moneySchemas.ts` | utility (zod) | validation | `web/src/modules/admin/expensesSchemas.ts` | exact |
| `web/src/modules/admin/auditCopy.ts` (3 labels) | config | n/a | itself | exact |
| `web/src/modules/admin/routes.tsx` (index, `money`, `money/staff/:userId`; drop dev `/admin` preview) | route | n/a | itself, lines 139-147, 165-171, 220-232 | exact |
| `web/src/modules/admin/sections.ts` (money prefix) | config | n/a | itself (`SECTION_CHILDREN`) | exact |
| `web/src/components/navigation/Sidebar.tsx` (`MONEY_NAV_ITEM`) | component | n/a | itself, `AUDIT_NAV_ITEM` lines 70-85 and line 126 | exact |
| `web/src/components/data/IncomeExpenseChart.tsx` (profit, negatives, width) | component (SVG) | transform | itself (lines 31-35, 47-80, 161) | exact |
| e2e specs `web/e2e/admin.spec.ts`, `admin-keyboard.spec.ts`, `motion.spec.ts`; `routes.test.tsx` | test | n/a | `web/e2e/admin.spec.ts:13` (Phase 8 removal note) | exact |

## Pattern Assignments

### `MoneyTransfersController.cs`, `StaffMoneyController.cs`, `DashboardController.cs` (controller)

**Analog:** `src/Csps.Server/Controllers/CompanyExpensesController.cs`

**Class header** (lines 22-27): attribute route, Staff policy at class level, no caching, primary constructor with one handler per action.
```csharp
[ApiController]
[Route("api/v1/company-expenses")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class CompanyExpensesController(CreateCompanyExpenseHandler create, GetCompanyExpenseHandler get, ...) : ControllerBase
```

**Thin read action** (lines 90-98), copy for `GET dashboard/summary`, `GET staff-money/me`:
```csharp
[HttpGet("kpis")]
[EndpointName("GetCompanyExpenseKpis")]
[ProducesResponseType<CompanyExpenseKpisResponse>(StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
public async Task<IResult> Kpis(CancellationToken cancellationToken)
{
    var result = await kpis.HandleAsync(cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(HttpContext, static figures => TypedResults.Ok(figures));
}
```

**Paged list with query params** (lines 48-59), copy for the ledger and transfer list (`page`, `pageSize`, `deleted`):
```csharp
public async Task<IResult> List([FromQuery] string? q, ..., CancellationToken cancellationToken,
    [FromQuery] int page = 1, [FromQuery] int pageSize = ListCompanyExpensesRequest.DefaultPageSize)
```

**Create with idempotent POST** (lines 75-81). The body may be empty and becomes `Request.Empty`:
```csharp
public async Task<IResult> Create([FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CreateCompanyExpenseRequest? body, CancellationToken cancellationToken)
{
    var result = await create.HandleAsync(body ?? CreateCompanyExpenseRequest.Empty, cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(HttpContext, static created => TypedResults.Created($"/api/v1/company-expenses/{created.Id:D}", created));
}
```

**Manager-only delete and permanent delete** (lines 136-148, 208-220). Add `[FromQuery] string? version` to the soft delete (new in this repo, RESEARCH Pattern 9).
```csharp
[HttpDelete("{id:guid}/permanent")]
[Authorize(Policy = Policies.Manager)]
[EndpointName("PermanentlyDeleteCompanyExpense")]
[ProducesResponseType(StatusCodes.Status204NoContent)]
...
public async Task<IResult> PermanentlyDelete(Guid id, CancellationToken cancellationToken)
{
    var result = await permanentlyDelete.HandleAsync(id, cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
}
```
Rules: no PUT or PATCH on transfers (MONEY-07). `staff-money/me` is a static segment beside `{userId:guid}`. The `handovers` POST carries `[Authorize(Policy = Policies.Manager)]`. Every action has XML docs listing each status code, as the analog does.

---

### `CreateMoneyTransferHandler.cs`, `HandOverMoneyHandler.cs` (handler, locked write)

**Analog:** `src/Csps.Application/Expenses/CreateCompanyExpenseHandler.cs` for the shape; `PermanentlyDeleteCompanyExpenseHandler.cs` for `ConflictRetry`.

**Constructor and caller check** (lines 18-42):
```csharp
public sealed class CreateCompanyExpenseHandler(
    ICompanyExpenses expenses, ICompanyExpenseReader reader, IExpenseCategories categories, IStaffDirectory staff,
    IBusinessCalendar calendar, IAuditTrail audit, IUnitOfWork unitOfWork, IRequestContext requestContext,
    IValidator<CreateCompanyExpenseRequest> validator)
...
if (requestContext.UserId is not { } callerId)
{
    return Result.Failure<CompanyExpenseDetailResponse>(AuthErrors.SessionEnded);
}
```
The sender for a normal transfer is `callerId` (never the body, CWE-639).

**Validation with business today** (lines 44-52):
```csharp
var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
var context = new ValidationContext<CreateCompanyExpenseRequest>(request);
context.RootContextData[CreateCompanyExpenseRequestValidator.TodayKey] = clock.Today;
var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
await CheckReferencesAsync(request, validation, cancellationToken).ConfigureAwait(false);
if (!validation.IsValid)
{
    return Result.Failure<CompanyExpenseDetailResponse>(ValidationResults.ToError(validation, ExpenseErrors.ValidationCode, ExpenseErrors.ValidationMessage));
}
```

**Transaction with retry** (`PermanentlyDeleteCompanyExpenseHandler.cs` lines 35-40):
```csharp
var outcome = await ConflictRetry
    .RunAsync(
        () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, token), cancellationToken),
        Result.Failure<bool>(AuthErrors.SessionBusy))
    .ConfigureAwait(false);
```
Inside `AttemptAsync`: `await moneyLock.LockAsync(token)` first (D-53), then staff states and balances, then `MoneyTransfer.Record(...)`, then `transfers.Add`, audit (hand-over only), `SaveChangesAsync`. Full sketch in RESEARCH Pattern 4. Catch `StaffMoneyBusyException` and map to `MoneyErrors.Busy` (409), as handlers map `OrderNumberBusyException`.

**Staff state check** (lines 119-126). Recipient "active" reuses `CanPay` (D-56 adds locked and not-set-up staff as active, so the planner must define a rule that differs from `CanPay` for those two flags):
```csharp
var payer = await staff.GetStaffStateAsync(payerId, cancellationToken).ConfigureAwait(false);
if (payer is not { CanPay: true })
{
    validation.Errors.Add(new ValidationFailure(nameof(CreateCompanyExpenseRequest.PaidByUserId), ExpenseRules.PaidByInactive));
}
```

---

### `DeleteMoneyTransferHandler.cs` (soft delete with version)

**Analogs:** `src/Csps.Application/Expenses/DeleteCompanyExpenseHandler.cs` (soft delete flow), `UpdateCompanyExpenseHandler.cs` line 116 (version compare), `src/Csps.Application/Common/RowVersions.cs:28-44` (`TryParse`), `src/Csps.Application/Common/EditErrors.cs` (`EditErrors.Stale`).

Domain soft delete to copy (`src/Csps.Domain/Expenses/CompanyExpense.cs` lines 156-166):
```csharp
public bool SoftDelete(Guid by, DateTimeOffset now)
{
    if (IsDeleted)
    {
        return false;
    }

    DeletedAtUtc = now;
    DeletedById = by;
    return true;
}
```
Version check: `if (!transfer.RowVersion.AsSpan().SequenceEqual(version)) return Result.Failure(EditErrors.Stale);`. Unknown or already deleted: 404. Audit `money-transfer.deleted` with ids only and `note=yes|no` (D-52).

---

### `RemoveMoneyTransferHandler.cs` (permanent remove)

**Analog:** `src/Csps.Application/Expenses/PermanentlyDeleteCompanyExpenseHandler.cs` lines 43-59. Audit first, then a tracked `Remove`, one save:
```csharp
var expense = await expenses.FindAsync(id, includeDeleted: true, cancellationToken).ConfigureAwait(false);
if (expense is null)
{
    return Result.Failure<bool>(ExpenseErrors.NotFound);
}

audit.Record(
    AuditActions.CompanyExpensePermanentlyDeleted,
    ExpenseTarget,
    AuditKey.Of(expense.Id),
    ExpenseAuditDetail.Snapshot(expense.ExpenseDate, expense.CategoryId, expense.Amount, expense.PaidByUserId));
expenses.Remove(expense);
await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
```
Difference: a live (not soft-deleted) transfer answers 422 ("Delete the transfer first."), D-24.

---

### `MoneyAuditDetail.cs` (audit detail)

**Analog:** `src/Csps.Application/Expenses/ExpenseAuditDetail.cs` lines 6-23:
```csharp
public static string Snapshot(DateOnly date, Guid categoryId, decimal amount, Guid payerId) =>
    AuditDetailFormat.Join(
        AuditDetailFormat.Pair("date", date),
        AuditDetailFormat.Pair("category", categoryId),
        AuditDetailFormat.Pair("amount", amount),
        AuditDetailFormat.Pair("payer", payerId));
```
Money keys: `from`, `to`, `amount`, `date`, `note=yes|no` (D-52), `recordedBy`, `deletedBy`, `deletedAt`. Stay under `AuditEntry.DetailMaxLength` (400). Add the person keys to `AuditChangeLines` (lines 151-152) so the audit screen names people.

Audit codes go in `src/Csps.Domain/Auditing/AuditActions.cs` beside lines 121-136 and in the list near line 453: `money-transfer.deleted`, `money-transfer.permanently-deleted`, `money-transfer.handed-over`.

---

### `MoneyErrors.cs`

**Analog:** `src/Csps.Application/Expenses/ExpenseErrors.cs` lines 6-31: `const string` code plus plain-English message, then `static Error` properties built with `Error.NotFound(...)`, `Error.Forbidden(...)`. Codes use the `money-transfers.` / `staff-money.` prefix. Add `BusyMessage` reusing the `AuthErrors.SessionBusyMessage` wording.

---

### `GetDashboardSummaryHandler.cs`, `GetDashboardChartHandler.cs` (read handlers)

**Analog:** `src/Csps.Application/Expenses/GetCompanyExpenseKpisHandler.cs` lines 12-38:
```csharp
public sealed class GetCompanyExpenseKpisHandler(ICompanyExpenseReader reader, IBusinessCalendar calendar)
{
    public async Task<Result<CompanyExpenseKpisResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        var (thisFirst, thisLast) = BusinessClock.MonthOf(today);
        var (lastFirst, lastLast) = BusinessClock.MonthOf(thisFirst.AddDays(-1));

        var totals = await reader.GetKpisAsync(new KpiMonths(thisFirst, thisLast, lastFirst, lastLast), cancellationToken).ConfigureAwait(false);
        ...
            var share = (int)Math.Round(totals.TopTotal / totals.ThisMonthTotal * 100m, 0, MidpointRounding.AwayFromZero);
```
The summary handler reuses `ICompanyExpenseReader.GetKpisAsync` directly for the Company expenses card (D-07 already matches). The Collected percent uses the same rounding and divides by the absolute comparison value (D-54), `null` at 0.00 (D-06). The chart handler validates `months` against `{6, 12}` (400 otherwise).

---

### `BusinessClock.cs` additions (pure)

**Analog:** itself, lines 23-27:
```csharp
public static (DateOnly First, DateOnly Last) MonthOf(DateOnly day) =>
    (new DateOnly(day.Year, day.Month, 1), new DateOnly(day.Year, day.Month, DateTime.DaysInMonth(day.Year, day.Month)));
```
Add `WeekOf`, `SameDayLastMonth` and a greeting part from `LocalNow` in the same static, documented style (code in RESEARCH Pattern 6). Domain coverage is 100%.

---

### `MoneyTransfer.cs` (aggregate)

**Analog:** `src/Csps.Domain/Expenses/CompanyExpense.cs`
- Lines 10-23: `sealed class ... : IAttributedRecord`, private constructor used by EF and the factory, `RowVersion = []`.
- Lines 80-102: static `Result<T> Create(...)` that checks every rule, then `Guid.CreateVersion7(now)`.
- Lines 156-166: `SoftDelete(by, now)` (above).
No `Update` method (D-22). Refusal messages are field errors in the style of `OrderRules.Reject<OrderPayment>(...)` (`src/Csps.Domain/Orders/Order.cs:928`). Peso text via `Pesos.Format` (positive figures only).

---

### `MoneyTransferConfiguration.cs` (EF config)

**Analog:** `src/Csps.Infrastructure/Persistence/Configurations/CompanyExpenseConfiguration.cs` lines 15-57. Copy: `ToTable` with `HasCheckConstraint("CK_..._Amount_Positive", "[Amount] > 0")`, `ValueGeneratedNever()` key, `HasColumnType("date")`, `HasPrecision(18, 2)`, `IsRowVersion()`, every people FK with `OnDelete(DeleteBehavior.NoAction)`, named indexes with `.HasFilter("[DeletedAtUtc] IS NULL")` and `.IncludeProperties(...)`.
```csharp
builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(expense => expense.PaidByUserId).OnDelete(DeleteBehavior.NoAction);
builder.HasIndex(expense => expense.PaidByUserId).IncludeProperties(expense => expense.Amount).HasDatabaseName("IX_CompanyExpenses_PaidByUserId");
```
**Do not copy line 31** (`HasQueryFilter("SoftDelete", ...)`). Transfers get no `SoftDelete` filter (RESEARCH Pitfall 4); filter `DeletedAtUtc == null` explicitly. Add a second check constraint `[FromUserId] <> [ToUserId]`. No triggers (OR-7).

---

### `StaffMoneyLock.cs` and `DatabaseLocks.cs` change

**Analog:** `src/Csps.Infrastructure/Identity/ManagerRosterLock.cs` lines 10-20:
```csharp
internal sealed class ManagerRosterLock(CspsDbContext context, TimeProvider time) : IManagerRosterLock
{
    // A lock row, so no trigger (OR-7) and no inline SQL (D-50).
    public Task LockActiveManagersAsync(CancellationToken cancellationToken) =>
        DatabaseLocks.TakeAsync(context, DatabaseLocks.ActiveManagers, time.GetUtcNow(), DatabaseLocks.DefaultWait,
            "The Manager roster lock could not be taken.", cancellationToken);
}
```
Wrap it in try/catch to throw `StaffMoneyBusyException`, as `OrderNumberAllocator.cs` lines 68-79 does (RESEARCH Code Examples). In `DatabaseLocks.cs` add `public const string StaffMoney = "staff-money";` next to lines 13-17 and add it to `StandingNames` (lines 27-32). The seed in `DatabaseLockConfiguration.cs:22` picks it up; bump `DatabaseLocksMigrationTests.cs:22` from 66 to 67.

---

### `DashboardReader.cs`, `StaffMoneyReader.cs` (readers)

**Analogs:** `src/Csps.Infrastructure/Orders/OrderReader.cs` lines 68-72 (one grouped count read) and `src/Csps.Infrastructure/Expenses/CompanyExpenseReader.cs` line 95 (top category ordering).
```csharp
var counts = await context.Orders.AsNoTracking()
    .GroupBy(static _ => 1)
    .Select(group => new { All = group.Count(), Active = group.Count(order => ActiveStatuses.Contains(order.Status)) })
    .SingleOrDefaultAsync(cancellationToken)
    .ConfigureAwait(false);
```
Balance read: six correlated sums per user (RESEARCH Pattern 2). Ledger: narrow `Concat` with no string columns (Pattern 3, Pitfall 3). Exclude `LegacyHolder.Id` as `src/Csps.Infrastructure/Identity/StaffDirectory.cs:18` does. No `IgnoreQueryFilters` (comment at `OrderReader.cs:117`). No inline SQL.

---

### `MoneyRegistration.cs` and handler registration

**Analogs:** `src/Csps.Infrastructure/Expenses/ExpensesRegistration.cs` lines 8-25 (`services.AddScoped<ICompanyExpenses, CompanyExpenseStore>();` behind a `public static IServiceCollection AddCsps...` extension) and `src/Csps.Server/Composition/ExpensesApplicationRegistration.cs` lines 9-43 (validators as singletons, handlers as scoped).

---

### `AuthorizationMatrix.cs` rows

**Analog:** itself, lines 208 and 214:
```csharp
new("DELETE", "/api/v1/company-expenses/{id:guid}", "/api/v1/company-expenses/b4d7e1a9-2f63-4c80-9a15-7e3c0d8b6f42", Anonymous: 401, Admin: 403, Manager: 404),
```
Add one row per action from RESEARCH Pattern 8. The soft-delete sample path carries a well-formed `version`.

---

### `dashboardService.ts`, `moneyService.ts` (web service)

**Analog:** `web/src/modules/admin/services/expensesService.ts`
- Lines 1-17: header comment, `apiClient` / `HttpClient` import, types from `@/types/api.generated` `components['schemas']`.
- Lines 37-84: an `interface XService` with a doc comment per call naming the route and status codes.
- Lines 86-130: `createXService(client)` factory plus a default export bound to `apiClient`.
```typescript
create: (body, idempotencyKey, signal) =>
  client.post<ExpenseDetailResponse>('/company-expenses', body, { idempotencyKey, signal }),
purge: (id, signal) => client.delete(`${expensePath(id)}/permanent`, { signal }),
```
Soft delete sends the version through `params` so `+` and `/` are encoded (Pitfall 8): `client.delete(transferPath(id), { params: { version }, signal })`.

---

### Query hooks

**Analog:** `web/src/modules/admin/hooks/useExpenseKpisQuery.ts`:
```typescript
export const expenseKpisKey = ['company-expense-kpis'] as const;

export function useExpenseKpisQuery() {
  return useQuery({
    queryKey: expenseKpisKey,
    queryFn: ({ signal }) => expensesService.kpis(signal),
  });
}
```
New roots `['dashboard']`, `['staff-money']`, `['money-transfers']`; add `staleTime: 0, refetchOnMount: 'always'` (D-13; shared default is 30 s in `web/src/lib/query/queryClient.ts:7`).

### URL state hooks

**Analog:** `web/src/modules/admin/hooks/useDeletedExpensesListParams.ts`:
```typescript
export const useDeletedExpensesListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  category: guidParser,
});
```
`range` and `tab` use `literalParser`; `deleted` a boolean literal; `:userId` the `guidParser`.

### Refresh hooks (D-13)

**Analog:** `web/src/modules/admin/hooks/useRefreshExpenses.ts` (a `Promise.all` of `invalidateQueries`) and `useRefreshOrders.ts` lines 13-24 (`REFRESHED_KEYS` list). Add the dashboard and money keys to both lists; create `useRefreshMoney` the same way.

---

### `TransferModal.tsx` (form modal)

**Analog:** `web/src/modules/admin/components/ExpenseModal.tsx` lines 1-60. Import set to copy: `zodResolver`, `useForm`/`Controller`, `Button`, `MoneyInput`, `DateInput`, `Field`, `Modal`, `Note`, `isHttpError`, `serverFieldMessage`, `useSubmission` (one Idempotency-Key per submission, a new key for a corrected body), `describeHttpError`, the module copy and schema files. Uses `PaidBySelect`-style ordering for the hand-over recipients. Copy lives in `moneyCopy.ts`, never in JSX.

### `moneySchemas.ts`

**Analog:** `web/src/modules/admin/expensesSchemas.ts` (form input and output types, server messages copied word for word, OR-3).

### `DeleteTransferDialog.tsx`, `RemoveTransferDialog.tsx`

**Analog:** `web/src/modules/admin/components/DeleteOrderDialog.tsx` lines 1-50: `ConfirmDialog` from `@/components/overlays`, `useToast`, `isHttpError`, the action hook and refresh hook, copy constant `const COPY = ...`. 404 means someone else deleted it: info toast and refetch. Add the 409 `edit.stale` alert line and the D-33 warning block.

### `KpiRow` area of `DashboardPage.tsx`, `MoneyStrip.tsx`, cards

**Analog:** `web/src/modules/admin/components/ExpenseKpiRow.tsx` lines 1-60: per-card loading through `KpiCard loading`, one `ErrorState align="start"` with `onRetry={() => { void query.refetch(); }}`, month names from the server's date (`formatMonthShort`), never the device clock, and `toNumber` for generated number-or-string types.

### Paged pages and tables (`MoneyPage.tsx`, `StaffMoneyPage.tsx`, table components)

**Analog:** `web/src/modules/admin/pages/DeletedExpensesPage.tsx` lines 1-30: `SPEC-GAP:` header comment, layout recipe imports (`pageHeadClasses`, `pageTitleClasses`, `pageSublineClasses`), `ResponsiveTable`, `ResultBar`, `Pagination`, `useRowFocus` after a row leaves, and the 403 banner for a role lost mid-session.

### `routes.tsx`

**Analog:** itself.
- Lines 143-147: guard with fallback, copy as `requireManagerOrMoney = ... requireManagerLoader(args, '/admin/money')`.
- Lines 165-171: replace the index `redirect('/admin/orders')` with `{ index: true, lazy: dashboardPage }`.
- Lines 86-89: `lazyRoute` page loaders; add `dashboardPage`, `moneyPage`, `staffMoneyPage`.
- Lines 220-232: remove the dev `/admin` index preview (Pitfall 1); keep `dev/components` and `dev/public`.

### `Sidebar.tsx`

**Analog:** itself, lines 70-85 (`AUDIT_NAV_ITEM`) and line 126 (`flatMap` insert). Add `MONEY_NAV_ITEM = { id: 'money', label: 'My Money', icon: 'wallet', to: '/admin/money' }` after Company Expenses for both roles.

### `IncomeExpenseChart.tsx`

**Analog:** itself. `ChartDatum` at lines 31-35 gains optional `profit`; the browser "Net" at line 161 (`Net {formatPeso(cur.income - cur.expenses)}`) stays only when `showProfit` is off. Keep the `--tip-x` React `style` object pattern for custom properties (strict CSP). Guard `ResizeObserver` (Pitfall 10).

## Shared Patterns

### Authorization
**Source:** `src/Csps.Server/Controllers/CompanyExpensesController.cs` lines 24, 137; `src/Csps.Application/Expenses/UpdateCompanyExpenseHandler.cs` line 72 (`var callerIsManager = caller?.IsManager == true;`).
**Apply to:** all three controllers and every `{userId}` handler. Role check before existence check, so an Admin gets 403 for any other id (Pitfall 5).

### Result to ProblemDetails
**Source:** `result.ToHttpResult(HttpContext, static x => TypedResults.Ok(x))` in every controller action; `ValidationResults.ToError(...)` in handlers.
**Apply to:** all controllers and handlers.

### Transactions, retry and locks
**Source:** `ConflictRetry.RunAsync` + `unitOfWork.InTransactionAsync` (`PermanentlyDeleteCompanyExpenseHandler.cs` 35-40); `DatabaseLocks.TakeAsync` (`ManagerRosterLock.cs`).
**Apply to:** transfer create, hand-over, delete, remove. Only create and hand-over take the `staff-money` lock (D-53).

### Audit
**Source:** `audit.Record(action, target, AuditKey.Of(id), detail)` (`CreateCompanyExpenseHandler.cs` 76-80); `AuditDetailFormat` pairs; ids only, no names or free text.
**Apply to:** delete, remove, hand-over.

### Stamping (SEC-08)
**Source:** `IAttributedRecord` on `CompanyExpense` and `src/Csps.Infrastructure/Persistence/RecordStampInterceptor.cs`.
**Apply to:** `MoneyTransfer`. Never set Created* in a handler.

### Web freshness and copy
**Source:** `useRefreshExpenses.ts`, `useRefreshOrders.ts`; `expensesCopy.ts`.
**Apply to:** every mutation and every new component. No long dash anywhere in `web/src` (OR-4); `EmptyValue` for empty cells.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/Csps.Application/Money/LedgerRunningBalance.cs` | utility | transform | No running-balance code exists. Use RESEARCH "Running balance (pure)". |
| Ledger `Concat` query in `StaffMoneyReader.cs` | repository | batch | No set operation is used in the repo yet. Prove it in Wave 0 (RESEARCH Pattern 3, Pitfall 3). |
| Soft delete taking a `version` query parameter | controller + handler | CRUD | Every existing DELETE takes no version. Combine the delete analog with the `UpdateCompanyExpenseHandler` version compare. |

## Metadata

**Analog search scope:** `src/Csps.Domain`, `src/Csps.Application`, `src/Csps.Infrastructure`, `src/Csps.Server`, `tests/`, `web/src/modules/admin`, `web/src/components`
**Files scanned:** about 230 listed, 16 read
**Pattern extraction date:** 2026-11-05

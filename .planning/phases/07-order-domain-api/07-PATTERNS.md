# Phase 7: Order Domain & API - Pattern Map

*Created: 2026-10-28T10:00:00-05:00 · Updated: 2026-10-28T10:00:00-05:00*

**Mapped:** 2026-10-28
**Files analyzed:** about 60 new or changed files, in the groups listed below (the file list follows the RESEARCH.md "Recommended Project Structure")
**Analogs found:** every group has one, except the per-year order number counter, which only partly matches

All analog paths below are git-tracked source (checked with `git ls-files`).

## File Classification

| New/Modified File(s) | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/Csps.Domain/Orders/Order.cs` (aggregate) | model | transform | `src/Csps.Domain/Expenses/CompanyExpense.cs` | role-match (no aggregate with children exists yet) |
| `Orders/OrderItem.cs, Payment.cs, Refund.cs, Discount.cs, OrderExpense.cs, OrderStatusChange.cs` | model (child) | transform | `CompanyExpense.cs` (fields, Create/CheckFields) | role-match |
| `Orders/OrderRules.cs`, `OrderImportRules.cs` | config/constants | n/a | `src/Csps.Domain/Expenses/ExpenseRules.cs` | exact |
| `Orders/OrderChanges.cs` | model (value) | transform | `src/Csps.Domain/Expenses/ExpenseChanges.cs` (+ `ValueChange<T>`) | exact |
| `Orders/OrderMath.cs`, `OrderMathModels.cs` (modify: refunds, credit) | utility | transform | itself; tests `tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs` | exact |
| `Orders/OrderStatus.cs`, `OrderStatusRules.cs`, `OrderNumber.cs`, `OrderNumberCounter.cs`, `OrderTotals.cs` | model / utility | transform | `ExpenseRules.cs` (constants and messages) | partial |
| `Lists/ManagedListEntry.cs`, `PaymentMethod.cs`, `OrderExpenseCategory.cs`, `ProductType.cs`, `*Seed.cs` | model | CRUD | `src/Csps.Domain/Expenses/ExpenseCategory.cs`, `ExpenseCategorySeed.cs`, `CategoryTones.cs` | exact |
| `LegacyHolder.cs` | config | n/a | `ExpenseCategorySeed.OthersId` (fixed id) | partial |
| `src/Csps.Domain/Auditing/AuditActions.cs` (modify) | config | n/a | itself, lines 120-136 and catalog near line 309 | exact |
| `src/Csps.Application/Orders/*Handler.cs` (create, details, child add/edit/remove, status, delete, restore, import) | service | request-response | `src/Csps.Application/Expenses/CreateCompanyExpenseHandler.cs`, `UpdateCompanyExpenseHandler.cs`, `DeleteCompanyExpenseHandler.cs`, `RestoreCompanyExpenseHandler.cs` | exact |
| `Application/Orders/*Request.cs`, `*RequestValidator.cs`, `*Response.cs`, `OrderErrors.cs`, `OrderAuditDetail.cs` | model / validator | request-response | `Application/Expenses/CreateCompanyExpenseRequest(Validator).cs`, `CompanyExpenseDetailResponse.cs`, `ExpenseErrors.cs`, `ExpenseAuditDetail.cs` | exact |
| `Application/Orders/List*Handler.cs`, `Get*Handler.cs` | service | CRUD (read) | `ListCompanyExpensesHandler.cs`, `GetCompanyExpenseHandler.cs` | exact |
| `Application/OrderLists/*` (list handlers) | service | CRUD | `src/Csps.Application/ExpenseCategories/*` (Create, Update, Retire, Reactivate, Delete, List, Get) | exact |
| `Application/Ports/IOrders.cs, IOrderReader.cs, IOrderNumbers.cs, IPaymentMethods.cs, IOrderExpenseCategories.cs, IProductTypes.cs` | port | CRUD | `Ports/ICompanyExpenses.cs`, `ICompanyExpenseReader.cs`, `IExpenseCategories.cs`, `IManagerRosterLock` | exact |
| `src/Csps.Infrastructure/Orders/OrderStore.cs, OrderReader.cs, *ListStore.cs, OrdersRegistration.cs` | repository | CRUD | `src/Csps.Infrastructure/Expenses/CompanyExpenseStore.cs`, `CompanyExpenseReader.cs`, `ExpenseCategoryStore.cs`, `ExpensesRegistration.cs` | exact |
| `Infrastructure/Orders/OrderNumberAllocator.cs` | repository | request-response (lock + counter) | `src/Csps.Infrastructure/Identity/ManagerRosterLock.cs` + `Persistence/Locking/DatabaseLocks.cs` | partial |
| `Infrastructure/Persistence/Configurations/Order*Configuration.cs` (one per table) | config | n/a | `Configurations/CompanyExpenseConfiguration.cs`, `ExpenseCategoryConfiguration.cs` | exact |
| `Infrastructure/Persistence/CspsUnitOfWork.cs` (modify: translate order list save failures, Pitfall 7) | middleware | n/a | itself, lines 28-40 | exact |
| `Infrastructure/Persistence/Migrations/*_AddOrders*.cs` (+ standing lock row `order-numbers`) | migration | n/a | `Migrations/20261025121237_AddCompanyExpenses.cs`, `20261026024441_AddDatabaseLocks.cs` | exact |
| `src/Csps.Server/Controllers/Orders*Controller.cs`, list controllers | controller | request-response | `src/Csps.Server/Controllers/CompanyExpensesController.cs`, `ExpenseCategoriesController.cs` | exact |
| `src/Csps.Server/Composition/OrdersApplicationRegistration.cs` | config | n/a | `Composition/ExpensesApplicationRegistration.cs` | exact |
| Testing seeder/controller (CSPS_TESTING) | utility | batch | `Infrastructure/Expenses/TestingExpenseSeeder.cs`, `Server/Controllers/TestingExpensesController.cs` | exact |
| Domain unit tests | test | n/a | `tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs`, `Auditing/AuditActionsTests.cs` | exact |
| Application unit tests | test | n/a | `tests/Csps.Application.UnitTests/Expenses/CreateCompanyExpenseHandlerTests.cs`, `ExpenseCategories/*` | exact |
| Infrastructure integration tests (migration, store, query count, triggers) | test | n/a | `tests/Csps.Infrastructure.IntegrationTests/Persistence/CompanyExpensesMigrationTests.cs`, `Expenses/CompanyExpenseReaderQueryCountTests.cs`, `Persistence/TriggerInventoryTests.cs` | exact |
| Server integration tests (endpoints, concurrency, attribution, timing, fixtures) | test | n/a | `tests/Csps.Server.IntegrationTests/CompanyExpenses/*` (ExpenseFixtures, CompanyExpenseConcurrencyTests, CompanyExpenseAttributionTests, ExpenseTimingData/Collection, ExpenseListTimingTests) | exact |
| `AuthorizationMatrix.cs`, `IdempotencyAllowList.cs`, OpenAPI snapshot (modify) | test | n/a | themselves | exact |
| `docs/api/orders.md`, `docs/api/order-lists.md`, `docs/operations/audit-log.md` | docs | n/a | existing `docs/api/*` for expenses | role-match |

## Pattern Assignments

### `Order.cs` and child entities (model)

**Analog:** `src/Csps.Domain/Expenses/CompanyExpense.cs`

- Sealed class, `: IAttributedRecord`, private constructor used by EF and by `Create` (lines 10-23); `RowVersion = []` in the constructor.
- Private setters; attribution members `CreatedById/CreatedAtUtc/UpdatedById/UpdatedAtUtc` set only by the DB layer (lines 46-56). Soft delete pair `DeletedAtUtc/DeletedById` + `IsDeleted` (lines 58-68).
- Static `Create(..., DateOnly today, DateTimeOffset now)` re-checks every field through `CheckFields`, returns `Result<T>`, key from `Guid.CreateVersion7(now)` (lines 80-104).
- `Update` returns `Result<ExpenseChanges>` built from `ValueChange<T>` old/new pairs, assigns nothing on failure (lines 119-150):

```csharp
var changes = new ExpenseChanges(
    amount == Amount ? null : new ValueChange<decimal>(Amount, amount),
    date == ExpenseDate ? null : new ValueChange<DateOnly>(ExpenseDate, date),
    ...);
Amount = amount;
```

New for orders (no analog, use RESEARCH.md Patterns 1, 2, 5 and the "Root touch" code example): private `_items` etc. lists exposed as `IReadOnlyList<T>`, `Recalculate()` snapshot from `OrderMath`, `Touch(now)` setting `EditVersion = Guid.CreateVersion7(now)` so child-only edits bump the root row version.

### Managed lists: `PaymentMethod`, `OrderExpenseCategory`, `ProductType` (model, CRUD)

**Analog:** `src/Csps.Domain/Expenses/ExpenseCategory.cs`

- Constants block for limits, field names, error codes and plain-English messages (lines 14-47), e.g. `NameMaxLength = 40`, `InvalidCode = "expense-categories.invalid-request"`.
- `Name`, `NormalizedName` (static `Normalize`, line 102), `Tone`, `RetiredAtUtc`, `IsRetired`; `FromSeed(row)` (line 111); `Create(name, tone, now)` (line 122); `Retire(now)` returning `Result<bool>` (line 190); `Reactivate()` (line 208); protected fixed-id entry (`IsOthers`, `OthersId` from `ExpenseCategorySeed`). A shared `ManagedListEntry` base should lift these members as-is.

### `OrderRules.cs` (constants)

**Analog:** `src/Csps.Domain/Expenses/ExpenseRules.cs` lines 13-28 (`DescriptionMaxLength = 200`, `NotesMaxLength = 1000`, `AmountScale = 2`, `DateFormat = "yyyy-MM-dd"`) plus message strings used by both validators and domain.

### Write handlers (service, request-response)

**Analog:** `src/Csps.Application/Expenses/CreateCompanyExpenseHandler.cs` (whole file, 128 lines)

Constructor injection of ports, `IBusinessCalendar`, `IAuditTrail`, `IUnitOfWork`, `IRequestContext`, `IValidator<TRequest>` (lines 18-27). Flow (lines 35-101):

```csharp
if (requestContext.UserId is not { } callerId)
    return Result.Failure<...>(AuthErrors.SessionEnded);
var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
var context = new ValidationContext<CreateCompanyExpenseRequest>(request);
context.RootContextData[CreateCompanyExpenseRequestValidator.TodayKey] = clock.Today;
var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
await CheckReferencesAsync(request, validation, cancellationToken).ConfigureAwait(false);
if (!validation.IsValid)
    return Result.Failure<...>(ValidationResults.ToError(validation, ExpenseErrors.ValidationCode, ExpenseErrors.ValidationMessage));
...
await unitOfWork.InTransactionAsync(async token =>
{
    expenses.Add(expense);
    audit.Record(AuditActions.CompanyExpenseAdded, ExpenseTarget, AuditKey.Of(expense.Id),
        ExpenseAuditDetail.Snapshot(...));
    await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
    return expense.Id;
}, cancellationToken).ConfigureAwait(false);
var view = await reader.GetDetailAsync(expense.Id, cancellationToken).ConfigureAwait(false);
```

Reference checks (lines 104-127): look up list entries and payer only when the id parsed, add `ValidationFailure` per field (retired entry, `payer is not { CanPay: true }`) so one 400 lists every field. Order handlers reuse this for payment method, category, product type and payer.

**Edit/child handlers analog:** `src/Csps.Application/Expenses/UpdateCompanyExpenseHandler.cs` lines 43-120:

```csharp
_ = RowVersions.TryParse(request.Version, out var version);
try {
    var outcome = await unitOfWork.InTransactionAsync(
        token => AttemptAsync(id, ..., version, clock.Today, token), cancellationToken).ConfigureAwait(false);
    if (outcome.IsFailure) return Result.Failure<...>(outcome.Error);
}
catch (ConcurrencyConflictException) { return Result.Failure<...>(EditErrors.Stale); }
catch (CategoryDeletedException) { ... 400 on the field ... }
```

and inside `AttemptAsync`: `FindAsync(id, includeDeleted: false)` then 404, access check then 403, `if (!expense.RowVersion.AsSpan().SequenceEqual(version)) return EditErrors.Stale;` then call the domain method. Every child add/edit/remove handler follows this, comparing against the **order's** row version.

### Order number allocator (partial analog)

**Analog:** `src/Csps.Infrastructure/Identity/ManagerRosterLock.cs` lines 10-20 and `Persistence/Locking/DatabaseLocks.cs` lines 11-29:

```csharp
DatabaseLocks.TakeAsync(context, DatabaseLocks.ActiveManagers, time.GetUtcNow(),
    DatabaseLocks.DefaultWait, "The Manager roster lock could not be taken.", cancellationToken);
```

Add `public const string OrderNumbers = "order-numbers";` to `DatabaseLocks`, include it in `StandingNames`, and add the standing row in the migration (copy `20261026024441_AddDatabaseLocks.cs`). The counter row bump uses EF API only (RESEARCH.md "Number allocation" example); `tests/Csps.ArchitectureTests/NoInlineSqlTests.cs` enforces no inline SQL.

### EF configurations (config)

**Analog:** `src/Csps.Infrastructure/Persistence/Configurations/CompanyExpenseConfiguration.cs` (lines 13-57):

```csharp
builder.ToTable("CompanyExpenses", table => table.HasCheckConstraint("CK_CompanyExpenses_Amount_Positive", "[Amount] > 0"));
builder.HasKey(expense => expense.Id);
builder.Property(expense => expense.Id).ValueGeneratedNever();
builder.Property(expense => expense.Amount).HasPrecision(18, 2);
builder.Property(expense => expense.RowVersion).IsRowVersion();
builder.HasQueryFilter("SoftDelete", expense => expense.DeletedAtUtc == null);
builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(expense => expense.CreatedById).OnDelete(DeleteBehavior.NoAction);
builder.HasIndex(...).IsDescending(...).HasFilter("[DeletedAtUtc] IS NULL").IncludeProperties(...).HasDatabaseName("IX_...");
```

Notes: named filter `"SoftDelete"`, NO ACTION on every FK, named CHECK constraints `CK_<Table>_<Rule>`, named indexes `IX_<Table>_<Purpose>`. Child tables need the matching named filter (RESEARCH.md Pitfall 5). Only the root carries `RowVersion`.

### Unit of work save-failure translation (modify)

**Analog:** `src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs` lines 28-40. Today only `ExpenseCategoryStore.TranslateSaveFailure(exception)` is consulted; chain the new list stores' translators the same way (Pitfall 7), clearing the change tracker before rethrowing the typed error.

### Controllers (controller, request-response)

**Analog:** `src/Csps.Server/Controllers/CompanyExpensesController.cs` lines 22-81:

```csharp
[ApiController]
[Route("api/v1/company-expenses")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class CompanyExpensesController(CreateCompanyExpenseHandler create, ...) : ControllerBase
...
[HttpPost]
[EndpointName("CreateCompanyExpense")]
[ProducesResponseType<CompanyExpenseDetailResponse>(StatusCodes.Status201Created)]
[ProducesResponseType(StatusCodes.Status400BadRequest)]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
public async Task<IResult> Create(
    [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CreateCompanyExpenseRequest? body,
    CancellationToken cancellationToken)
{
    var result = await create.HandleAsync(body ?? CreateCompanyExpenseRequest.Empty, cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(HttpContext, static created => TypedResults.Created($"/api/v1/company-expenses/{created.Id:D}", created));
}
```

XML doc on each action states rules in plain English, the idempotency replay behaviour and every status code (feeds the OpenAPI snapshot). Manager-only actions use the Manager policy as in `ExpenseCategoriesController.cs`.

### Registration (config)

**Analogs:** `src/Csps.Server/Composition/ExpensesApplicationRegistration.cs` lines 14-44 (validators `AddSingleton<IValidator<T>, TValidator>()`, handlers `AddScoped<THandler>()`) and `src/Csps.Infrastructure/Expenses/ExpensesRegistration.cs` lines 13-25 (ports `AddScoped<IPort, Store>()`, testing seeder under `#if CSPS_TESTING`). Wire the new `AddCspsOrders...` calls wherever `AddCspsExpenses` / `AddCspsExpenseHandlers` are called.

### Audit actions (modify)

**Analog:** `src/Csps.Domain/Auditing/AuditActions.cs` lines 120-136 (`public const string CompanyExpenseAdded = "company-expense.added";` with a one-line summary) and the catalog list near line 309. New `order.*`, `order-item.*`, `payment.*`, `payment-method.*` etc. go in both places; `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs` and `docs/operations/audit-log.md` must change with them (Pitfall 8). Audit detail shape: copy `ExpenseAuditDetail.Snapshot(...)` (no free text: never notes or descriptions).

## Shared Patterns

### Result and errors
`Result<T>` from `Csps.Domain.Common`; `AuthErrors.SessionEnded` (401), `EditErrors.Stale` (409), `ValidationResults.ToError(validation, Code, Message)` (400), per-feature `*Errors` class with `NotFound`, `NotYours`. Controllers only call `result.ToHttpResult(HttpContext, ...)`.

### Transactions, concurrency, idempotency
`unitOfWork.InTransactionAsync` joins the idempotency middleware's outer transaction through a savepoint (`CspsUnitOfWork.cs` lines 51-89). `ConcurrencyConflictException` maps to 409. Every POST needs an `Idempotency-Key`; exemptions only via `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs`, and `IdempotencyCoverageTests.cs` discovers all routes.

### Authorization matrix
`tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` lines 151-160: one row per action with a comment, e.g.

```csharp
new("POST", "/api/v1/expense-categories/{id:guid}/retire", "/api/v1/expense-categories/5a9c3e71-.../retire", Anonymous: 401, Admin: 403, Manager: 404),
```

Use fresh random GUIDs and the status each role actually meets.

### Clock
`IBusinessCalendar.GetClockAsync` gives `Today`, `UtcNow` (and year); the domain receives them as arguments, never reads a clock.

### Tests
- Endpoint tests and fixtures: `tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseFixtures.cs`, `CreateCompanyExpenseEndpointTests.cs`, `CompanyExpenseConcurrencyTests.cs` (uses `tests/Csps.Testing/ConcurrentRequests.cs`), `CompanyExpenseAttributionTests.cs`.
- Timing (PERF-04): `ExpenseTimingData.cs`, `ExpenseTimingCollection.cs`, `ExpenseListTimingTests.cs`; query count: `CompanyExpenseListQueryCountTests.cs`, `Infrastructure.IntegrationTests/Expenses/CompanyExpenseReaderQueryCountTests.cs`.
- Schema: `Persistence/CompanyExpensesMigrationTests.cs`; trigger guard `Persistence/TriggerInventoryTests.cs` (OR-7: no new triggers).
- Contract: `tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs` (update snapshot, Pitfall 9).
- Money: keep `OrderMathGoldenVectorTests.cs` vectors green when adding refunds and credit (Pitfall 6).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `Order.cs` child collections, `Recalculate`, `Touch` | model | transform | No aggregate with child entities yet; use RESEARCH.md Patterns 1-2 and the "Root touch" example |
| `OrderStatusRules.cs`, `OrderStatusChange.cs` | model | event-driven (state machine) | No status machine yet; RESEARCH.md Pattern 5 |
| `OrderNumberCounter.cs` / counter table | model | batch | Lock row exists, per-year counter does not; RESEARCH.md Pattern 3 |
| `Order.Import` / `OrderImportRules.cs` | model | batch | Closest is the D-33 "imported value stays editable" rule in `CompanyExpense.Update`; RESEARCH.md Pattern 7 |

## Metadata

**Analog search scope:** `src/Csps.Domain`, `src/Csps.Application`, `src/Csps.Infrastructure`, `src/Csps.Server`, `tests/*`
**Files scanned:** about 120 file paths listed, 9 read in detail
**Pattern extraction date:** 2026-10-28

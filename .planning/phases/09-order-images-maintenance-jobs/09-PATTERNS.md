# Phase 9: Order Images & Maintenance Jobs - Pattern Map

*Created: 2026-10-31T10:12:00-05:00 · Updated: 2026-10-31T10:12:00-05:00*

**Mapped:** 2026-10-31
**Files analyzed:** 52 (new and changed, from 09-RESEARCH.md "Recommended Project Structure" and 09-CONTEXT.md)
**Analogs found:** 44 / 52

All analog paths below are git-tracked (checked with `git ls-files`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/Csps.Domain/Orders/OrderImage.cs` | model (child entity) | CRUD | `src/Csps.Domain/Orders/OrderItem.cs` | exact |
| `src/Csps.Domain/Orders/OrderImageRules.cs` | model rules | transform | `OrderRules` (`MaxItems`, messages) in `src/Csps.Domain/Orders/` | role-match |
| `src/Csps.Domain/Orders/Order.cs` (AddImage, MoveImage, DescribeImage, RemoveImage) | model (aggregate) | CRUD | `Order.AddItem` / `RemoveItem` (Order.cs lines 502-580) | exact |
| `src/Csps.Domain/Auditing/AuditActions.cs` (5 `order-image.*`) | config | n/a | `OrderItemAdded/Changed/Removed` (lines 178-184, list at 457-459) | exact |
| `src/Csps.Application/Images/ImageSniffer.cs`, `ImageMetadataStripper.cs`, `ImageFacts.cs`, `ImageKind.cs` | utility (pure) | transform | none | no analog |
| `src/Csps.Application/Images/ImageUploadSettings.cs`, `PublicIds.cs` | config / utility | transform | `tools/Csps.HostProbe/ProbeKey.cs` (crypto use) | partial |
| `src/Csps.Application/Ports/IImageStorage.cs`, `IImageDelivery.cs`, `IImageDeletionQueue.cs` | port | request-response | `src/Csps.Application/Ports/IEmailOutbox.cs`, `IOrders.cs` | role-match |
| `src/Csps.Application/Orders/UploadOrderImageHandler.cs` | service (handler) | file-I/O + CRUD | `src/Csps.Application/Orders/AddOrderItemHandler.cs` | role-match |
| `src/Csps.Application/Orders/MoveOrderImageHandler.cs`, `DescribeOrderImageHandler.cs` | service (handler) | CRUD (versioned) | `src/Csps.Application/Orders/UpdateOrderItemHandler.cs` / `AddOrderItemHandler.cs` | exact |
| `src/Csps.Application/Orders/RemoveOrderImageHandler.cs` | service (handler) | CRUD (no version) | `src/Csps.Application/Orders/RemoveOrderItemHandler.cs` | exact |
| `src/Csps.Application/Orders/GetImageRulesHandler.cs` | service (handler) | request-response | any Get handler in `src/Csps.Application/Orders/` | role-match |
| request records + validators (`MoveOrderImageRequest`, `DescribeOrderImageRequest`, ...) | validation | n/a | `UpdateOrderItemRequest.cs`, `UpdateOrderItemRequestValidator.cs` | exact |
| `src/Csps.Application/Orders/PermanentlyDeleteOrderHandler.cs` (changed) | service | CRUD | itself (lines 45-66) | exact |
| `src/Csps.Application/Orders/OrderDetailResponse` + list entry (Images, Cover, ImageCount) | DTO | transform | existing response records | exact |
| `src/Csps.Application/Maintenance/*` (IMaintenanceJob, RunMaintenanceHandler, StraySweepJob, ImageRemovalJob, CloudinaryUsageJob) | service (job runner) | batch | `IdempotencyGate.PurgeExpiredAsync` (batch delete), `TryClaimAsync` (lease) | partial |
| `src/Csps.Infrastructure/Images/CloudinaryImageStorage.cs`, `CloudinaryImageDelivery.cs`, `CloudinarySettings.cs` | adapter | request-response | `src/Csps.Infrastructure/Email/MailKitTransport.cs` + `SmtpOptions.cs` | role-match |
| `src/Csps.Infrastructure/Images/ImagesRegistration.cs` | config (DI) | n/a | `src/Csps.Infrastructure/Email/EmailRegistration.cs` | exact |
| `src/Csps.Infrastructure/Images/TestingImageStorage.cs`, `TestingImageDelivery.cs` | test seam | n/a | `src/Csps.Infrastructure/Email/InMemoryEmailSink.cs` | exact |
| `src/Csps.Infrastructure/Images/ImageDeletion.cs`, `ImageDeletionQueue.cs` | model + store | batch / event-driven | `src/Csps.Infrastructure/Persistence/Locking/DatabaseLock.cs`, `Email/EmailOutboxMessage.cs` | role-match |
| `src/Csps.Infrastructure/Maintenance/PurgeExpiredRecordsJob.cs` | service | batch | `IdempotencyGate.PurgeExpiredAsync` (lines 385-405) | exact |
| `src/Csps.Infrastructure/Maintenance/MaintenanceRunLock.cs` | service | lease | `IdempotencyGate.TryClaimAsync` (lines 281-300) | exact |
| `src/Csps.Infrastructure/Persistence/Configurations/OrderImageConfiguration.cs` | config (EF) | CRUD | `OrderItemConfiguration.cs` | exact |
| `src/Csps.Infrastructure/Persistence/Configurations/ImageDeletionConfiguration.cs` | config (EF) | CRUD | `DatabaseLockConfiguration.cs` | role-match |
| `src/Csps.Infrastructure/Orders/OrderStore.cs` (add `.Include(order => order.Images)`) | store | CRUD | itself (lines 57-61) | exact |
| migration `AddOrderImages` | migration | n/a | `Migrations/20261026024441_AddDatabaseLocks.cs` | exact |
| `src/Csps.Server/Controllers/OrderImagesController.cs` | controller | request-response (multipart) | `src/Csps.Server/Controllers/OrderItemsController.cs` | exact (plus multipart) |
| `src/Csps.Server/Controllers/MaintenanceController.cs` | controller | request-response | `OrderItemsController.cs` + `AuthSessionController.cs` (`[IdempotencyExempt]`) | role-match |
| `src/Csps.Server/Controllers/TestingImagesController.cs` | controller (test only) | request-response | `src/Csps.Server/Controllers/TestingEmailsController.cs` | exact |
| `src/Csps.Server/Security/RequireMaintenanceKeyAttribute.cs` | middleware (filter) | request-response | `src/Csps.Server/Security/RequireCsrfHeaderAttribute.cs` | exact |
| `src/Csps.Server/Security/MaintenanceKey.cs` | utility | n/a | `tools/Csps.HostProbe/ProbeKey.cs` | exact |
| `src/Csps.Server/Http/RequestBodyLimitMiddleware.cs` (changed: after routing, per endpoint) | middleware | request-response | itself | exact |
| Idempotency middleware (multipart part-wise hash) | middleware | request-response | existing idempotency middleware + `IdempotencyGate.cs` | exact |
| `web.config` `maxAllowedContentLength`, `Program.cs` order, rate limiter | config | n/a | existing files and `WebConfigTests`, `RequestBodyLimitTests` | exact |
| `tools/Csps.CloudinarySetup/` | tool (CLI) | batch | `tools/Csps.HostProbe/` (config key from user-secrets) | partial |
| `.github/workflows/maintenance.yml` | config (CI) | batch | `.github/workflows/weekly.yml` | role-match |
| `web/src/utils/images.ts` (`prepareImage`) | utility | transform / file-I/O | none (browser canvas code) | no analog |
| `web/src/modules/admin/hooks/usePhotoUploadQueue.ts` | hook (store) | event-driven | none (no client upload queue yet) | no analog |
| `web/src/modules/admin/services/orderPhotosService.ts` | service | request-response | `web/src/modules/admin/services/ordersService.ts` | exact |
| `web/src/modules/admin/orderPhotosCopy.ts`, `orderPhotosSchemas.ts` | config / validation | n/a | `orderPaymentCopy.ts`, `orderPaymentSchemas.ts` | exact |
| `web/src/modules/admin/components/OrderPhotosCard.tsx` | component | CRUD | `OrderItemsTab.tsx` | role-match |
| `web/src/modules/admin/components/PhotoDescriptionModal.tsx` | component (modal form) | CRUD | `OrderItemModal.tsx` | exact |
| `web/src/modules/admin/components/OrderPhotoPicker.tsx` | component | file-I/O | `web/src/components/media/ImageUploader.tsx` (drop zone, hidden input) | role-match |
| `web/src/components/media/ImageUploader.tsx` (rebuilt), `PhotoTile.tsx` | component | event-driven | current `ImageUploader.tsx` | exact |
| `web/src/components/media/PhotoViewer.tsx` | component (dialog) | event-driven | existing dialogs, e.g. `DeactivateUserDialog.tsx` | partial |
| `web/src/components/brand/icons.ts` (`camera`) | config | n/a | itself (lines 21-90 registry) | exact |
| `web/src/modules/admin/pages/OrderFormPage.tsx`, `OrderPage.tsx`, `DeletedOrderPage.tsx` | page | CRUD | themselves (replace "Image uploads are coming soon." card) | exact |
| `docs/operations/maintenance.md`, `docs/operations/cloudinary-setup.md` | docs | n/a | `docs/operations/mail-setup.md`, `audit-log.md` | role-match |

## Pattern Assignments

### `src/Csps.Domain/Orders/OrderImage.cs` (model, CRUD)

**Analog:** `src/Csps.Domain/Orders/OrderItem.cs`

Copy the shape exactly: `public sealed class ... : IAttributedRecord`, an `internal` constructor for EF constructor binding and `Order`, private setters, `public Order Order { get; internal set; } = null!;`, and the four attributed members (lines 55-65).

```csharp
public sealed class OrderItem : IAttributedRecord
{
    // Used by EF Core (constructor binding) and by Order.Create.
    internal OrderItem(Guid id, Guid orderId, Guid productTypeId, string description, ...int position)
    { Id = id; OrderId = orderId; ... Position = position; }

    public Guid Id { get; private set; }
    public Guid OrderId { get; private set; }
    public Order Order { get; internal set; } = null!;
    ...
    public Guid? CreatedById { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public Guid? UpdatedById { get; private set; }
    public DateTimeOffset? UpdatedAtUtc { get; private set; }
```

Fields for the new type (RESEARCH Pattern 2): `Slot` (byte, 0 to 4, never changes), `Position` (0 = cover), `PublicId`, `Width`, `Height`, `Bytes`, `Format`, `Description` (null = default text, D-30). No row version of its own.

### `src/Csps.Domain/Orders/Order.cs` (AddImage, MoveImage, DescribeImage, RemoveImage)

**Analog:** `Order.AddItem` (lines 502-535) and `RemoveItem` (around 550).

- Backing list like `private readonly List<OrderItem> _items = [];` (line 16) and `public IReadOnlyList<OrderItem> Items => _items;` (line 122).
- Every method starts with `if (EnsureEditable() is { } locked) { return ...locked...; }` (line 510) so D-11 holds.
- Cap check like `if (_items.Count >= OrderRules.MaxItems)` (line 521) with `OrderImageRules.MaxImagesPerOrder = 5`.
- `Find` by id on this order only (line 555), 404-style error when missing.
- Return `Result<OrderImage>` so the handler can audit and queue the removed public id.

### `src/Csps.Domain/Auditing/AuditActions.cs`

**Analog:** lines 178-184 and the list at 457-459.

```csharp
public const string OrderItemAdded = "order-item.added";
public const string OrderItemChanged = "order-item.changed";
public const string OrderItemRemoved = "order-item.removed";
```

Add `order-image.added`, `.moved`, `.cover-changed`, `.description-changed`, `.deleted`, and add each to the all-actions list (`AuditActionsTests` checks it). Details never carry a public id or URL.

### `src/Csps.Application/Orders/UploadOrderImageHandler.cs` (handler, file-I/O + CRUD)

**Analog:** `src/Csps.Application/Orders/AddOrderItemHandler.cs` (whole file, 73 lines)

**Constructor and session check** (lines 19-44):
```csharp
public sealed class AddOrderItemHandler(
    IOrders orders, IOrderReader reader, IOrderLists lists, IBusinessCalendar calendar,
    IAuditTrail audit, IUnitOfWork unitOfWork, IRequestContext requestContext,
    IValidator<AddOrderItemRequest> validator)
{
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, AddOrderItemRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }
```

**Validation to Result** (lines 46-51):
```csharp
var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
if (!validation.IsValid)
{
    return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
}
```

**Save through OrderChildWrite** (lines 53-71): use `OrderChildWrite.AttemptAsync` (not `SaveFormAsync`, upload has no version) wrapped like `RemoveOrderItemHandler` lines 39-57, with the change lambda calling `order.AddImage(...)` and returning `new OrderChildAudit(AuditActions.OrderImageAdded, OrderAuditDetail.ImageAdded(...))`.

**Extra steps (no analog):** pre-check read before the upload (404, `orders.locked`, 5 photos), `ImageSniffer`, limits, `ImageMetadataStripper`, `IImageStorage.UploadAsync`, and on a failed save the compensation row via a short-lived context (see `MaintenanceRunLock` below for the `IDbContextFactory` pattern). Add `IImageStorage`, `IImageDeletionQueue`, `IOptions<ImageUploadSettings>` and `TimeProvider` or the calendar to the constructor.

### `MoveOrderImageHandler.cs`, `DescribeOrderImageHandler.cs` (versioned CRUD)

**Analog:** `AddOrderItemHandler.cs` lines 53-71 (`SaveFormAsync` with `RowVersions.TryParse(request.Version, out var version)`), and `UpdateOrderItemHandler.cs` / `UpdateOrderItemRequestValidator.cs` for the request record + validator pair. `SaveFormAsync` already maps `ConcurrencyConflictException` to `EditErrors.Stale` (OrderChildWrite.cs lines 107-118), which gives the D-15 409.

### `RemoveOrderImageHandler.cs` (CRUD, no version)

**Analog:** `src/Csps.Application/Orders/RemoveOrderItemHandler.cs` lines 31-58, copied nearly line for line:

```csharp
var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
var outcome = await ConflictRetry.RunAsync(
    () => OrderChildWrite.AttemptAsync(
        orders, audit, unitOfWork, orderId, version: null,
        (order, _) =>
        {
            var removed = order.RemoveItem(itemId, clock.UtcNow);
            return Task.FromResult(removed.IsFailure
                ? Result.Failure<OrderChildAudit?>(removed.Error)
                : Result.Success<OrderChildAudit?>(new OrderChildAudit(AuditActions.OrderItemRemoved, OrderAuditDetail.ItemRemoved(removed.Value))));
        },
        cancellationToken),
    Result.Failure<bool>(EditErrors.Stale)).ConfigureAwait(false);
return outcome.IsFailure
    ? Result.Failure<OrderDetailResponse>(outcome.Error)
    : await OrderChildWrite.ReadAsync(reader, orderId, cancellationToken).ConfigureAwait(false);
```

Inside the lambda, after `RemoveImage` succeeds, call `deletionQueue.Enqueue(removed.Value.PublicId, ImageDeletionReason.PhotoDeleted)` so the queue row joins the same `SaveChangesAsync` that `OrderChildWrite.AttemptAsync` makes (line 79). That is D-20 "same transaction".

### `PermanentlyDeleteOrderHandler.cs` (changed)

**Analog:** itself, lines 45-66. Insert the enqueue loop between `audit.Record(...)` (line 58) and `orders.Remove(order)` (line 63):

```csharp
audit.Record(AuditActions.OrderPermanentlyDeleted, OrderAuditDetail.OrderTarget, AuditKey.Of(order.Id), OrderAuditDetail.PermanentlyDeleted(order));
// new: foreach (var image in order.Images) deletionQueue.Enqueue(image.PublicId, ImageDeletionReason.OrderDeleted);
orders.Remove(order);
await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
```

Needs `OrderStore.FindAsync` to include images (below). Soft delete and restore handlers are not touched.

### `src/Csps.Infrastructure/Orders/OrderStore.cs`

Add `.Include(order => order.Images)` next to lines 57-61 (`.Include(order => order.Items)` and friends).

### `OrderImageConfiguration.cs` (EF config)

**Analog:** `src/Csps.Infrastructure/Persistence/Configurations/OrderItemConfiguration.cs` (whole file, 47 lines)

```csharp
internal sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("OrderItems", table =>
        {
            table.HasCheckConstraint("CK_OrderItems_Quantity_NonNegative", "[Quantity] >= 0");
        });
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).ValueGeneratedNever();
        builder.Property(item => item.Description).IsRequired().IsUnicode().HasMaxLength(OrderRules.ItemDescriptionMaxLength);
        builder.HasQueryFilter("SoftDelete", item => item.Order.DeletedAtUtc == null);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(item => item.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasIndex(item => item.OrderId).HasDatabaseName("IX_OrderItems_OrderId");
```

For images: `CK_OrderImages_Slot_Range` (`[Slot] BETWEEN 0 AND 4`), `CK_OrderImages_Position_Range`, a unique index `(OrderId, Slot)`, a unique index on `PublicId`, `Format` as `IsUnicode(false).HasMaxLength(8)`. No trigger (OR-7). Keep the named `SoftDelete` filter; the stray sweep reads with `IgnoreQueryFilters(["SoftDelete"])`.

### `ImageDeletionConfiguration.cs`, `ImageDeletion.cs`, migration `AddOrderImages`

**Analog:** `DatabaseLock.cs` (factory method style, lines 33-42) and `DatabaseLockConfiguration.cs`; migration modeled on `20261026024441_AddDatabaseLocks.cs` and its `DatabaseLocksMigrationTests.cs`.

```csharp
public static DatabaseLock Claim(string name, Guid holderId, DateTimeOffset now, TimeSpan lease)
{
    ArgumentException.ThrowIfNullOrWhiteSpace(name);
    ArgumentOutOfRangeException.ThrowIfGreaterThan(name.Length, NameMaxLength);
    ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(lease, TimeSpan.Zero);
    return new DatabaseLock { Name = name, TakenAtUtc = now, ExpiresAtUtc = now + lease, HolderId = holderId };
}
```

`ImageDeletion.Queue(publicId, deliveryType, reason, now)` follows this shape. `PublicId` indexed, not unique.

### `MaintenanceRunLock.cs` and the upload compensation write (lease, own context)

**Analog:** `src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs` `TryClaimAsync`, lines 281-300 (constructor at line 214 takes `IDbContextFactory<CspsDbContext> contexts`):

```csharp
var claimContext = await contexts.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
await using (claimContext.ConfigureAwait(false))
{
    claimContext.Add(DatabaseLock.Claim(name, holderId, now, ClaimLease));
    try
    {
        await claimContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return true;
    }
    catch (DbUpdateException error) when (error.InnerException is SqlException { Number: DuplicateIndexKey or DuplicateKey })
    {
        // name taken
    }
}
```

Use name `maintenance-run`, 3-minute lease; a taken claim maps to 409. The same short-context write saves the `UploadUndone` queue row after a failed save.

### `PurgeExpiredRecordsJob.cs` (batch)

**Analog:** `IdempotencyGate.PurgeExpiredAsync`, lines 385-405:

```csharp
await context.Set<IdempotencyRecord>()
    .Where(record => record.ExpiresAt <= now)
    .OrderBy(record => record.ExpiresAt)
    .Take(PurgeBatchSize)
    .ExecuteDeleteAsync(cancellationToken)
    .ConfigureAwait(false);
...
catch (Exception exception) when (SqlErrors.IsDatabaseFailure(exception))
{
    LogPurgeFailed(logger, exception);
```

Loop each table (UserSessions, TwoFactorChallenges, AccountTokens, IdempotencyRecords, DatabaseLocks claims, closed EmailOutbox rows per D-35) in batches of 500 until fewer than 500 are deleted or the budget runs out. No inline SQL. Use `[LoggerMessage]` source-generated log methods like `LogPurgeFailed` (the class is `partial`). A failure becomes a failed `MaintenanceLine`, not a thrown error.

### `ImageRemovalJob` per-item lease (no analog for conditional update)

Follow RESEARCH Pattern 5: read 25 candidate ids, then `ExecuteUpdateAsync` with `Where(id == x && (LeaseUntilUtc == null || LeaseUntilUtc < now))`; result 1 owns it. Waits through `Task.Delay(delay, timeProvider, ct)` so `FakeTimeProvider` drives tests.

### `ImagesRegistration.cs`, `CloudinarySettings.cs`, `TestingImageStorage.cs`

**Analog:** `src/Csps.Infrastructure/Email/EmailRegistration.cs` lines 11-60.

```csharp
public static IServiceCollection AddCspsEmail(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
{
    ArgumentNullException.ThrowIfNull(services); ...
    services.AddOptions<EmailDispatcherOptions>()
        .Bind(configuration.GetSection(EmailDispatcherOptions.SectionName))
        .Validate(options => options.SweepInterval > TimeSpan.Zero, "Email:Dispatcher:SweepInterval must be greater than zero.")
        .ValidateOnStart();
    services.AddScoped<IEmailOutbox, OutboxEmailSender>();
    if (environment.IsEnvironment(TestingEnvironment))
    {
        AddTestingSink(services);
    }
    else
    {
        sender.ValidateOnStart();
        services.AddSingleton<IValidateOptions<EmailSenderOptions>, EmailSenderOptions.Validator>();
```

Testing gets `TestingImageStorage` (Debug builds only, like `InMemoryEmailSink`). Settings carry a `SectionName` const and an `IValidateOptions` validator class; missing Cloudinary keys outside Testing answer 503 on upload rather than stopping the host (RESEARCH endpoint table), so validate only shape (folder root non-empty), not presence. The adapter uses the `HttpClient` timeout from Http.Resilience; app-level retries live in the job.

### `OrderImagesController.cs` (controller, multipart)

**Analog:** `src/Csps.Server/Controllers/OrderItemsController.cs` (whole file)

**Class attributes** (lines 17-22):
```csharp
[ApiController]
[Route("api/v1/orders/{orderId:guid}/items")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderItemsController(AddOrderItemHandler add, UpdateOrderItemHandler update, RemoveOrderItemHandler remove) : ControllerBase
```

**Thin action** (lines 39-54 and 99-110):
```csharp
[HttpDelete("{itemId:guid}")]
[EndpointName("RemoveOrderItem")]
[ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
...
public async Task<IResult> Remove(Guid orderId, Guid itemId, CancellationToken cancellationToken)
{
    var result = await remove.HandleAsync(orderId, itemId, cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
}
```

Route `api/v1/orders/{orderId:guid}/images`. Upload action adds `[Consumes("multipart/form-data")]`, `[RequestSizeLimit(...)]`, `[RequestFormLimits(MemoryBufferThreshold = limit + 1, MultipartBodyLengthLimit = limit)]`, an `[EnableRateLimiting(...)]` policy, `IFormFile file` and optional `description`; copy bytes to a bounded `MemoryStream` and pass bytes to the handler (the handler never sees `IFormFile`, onion rule). `GET image-rules` lives on a route that does not collide with `{orderId:guid}` (for example on `OrdersController` or a separate `[Route("api/v1/orders/image-rules")]`). PUT bodies use `[FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] Request? body` with `body ?? Request.Empty` (line 49-52).

### `MaintenanceController.cs`

**Analog:** `OrderItemsController.cs` for the shape, plus `AuthSessionController.cs` line 33 for:
```csharp
[IdempotencyExempt("Returns a new access token and rotates the cookie; must never be stored or replayed.")]
```
Use `[AllowAnonymous]`, `[RequireMaintenanceKey]`, `[IdempotencyExempt("...")]`, a per-IP rate limit policy, route `api/v1/maintenance/run`, and add the allow-list entry the idempotency test expects. The authorization-matrix test must expect 401 for every caller without the key.

### `RequireMaintenanceKeyAttribute.cs` and `MaintenanceKey.cs`

**Analogs:** `src/Csps.Server/Security/RequireCsrfHeaderAttribute.cs` (lines 15-42) and `tools/Csps.HostProbe/ProbeKey.cs` (lines 11-40).

```csharp
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RequireCsrfHeaderAttribute : Attribute, IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        ... if (ok) { return; }
        var refusal = Result.Failure(AuthErrors.CsrfCheckFailed).ToHttpResult(context.HttpContext, static () => Results.NoContent());
        await refusal.ExecuteAsync(context.HttpContext).ConfigureAwait(false);
        context.Result = new EmptyResult();
    }
}
```

```csharp
public const string HeaderName = "X-Probe-Key";          // -> "X-Maintenance-Key"
public const string ConfigurationKey = "HostProbe:Key";  // -> "Maintenance:Key"
public const int MinimumLength = 32;
public static bool Matches(string? provided, string? configured)
{
    if (!IsConfigured(configured) || provided is null) { return false; }
    var expected = SHA256.HashData(Encoding.UTF8.GetBytes(configured));
    var actual = SHA256.HashData(Encoding.UTF8.GetBytes(provided));
    return CryptographicOperations.FixedTimeEquals(actual, expected);
}
```

Read the configured key from `IConfiguration` via `context.HttpContext.RequestServices`; a failure is a 401 ProblemDetails.

### `RequestBodyLimitMiddleware.cs` (changed)

**Analog:** itself (36 lines). Keep the 413 via `CspsProblemDetails.WriteAsync(context, StatusCodes.Status413PayloadTooLarge)` and the `IHttpMaxRequestBodySizeFeature` write (lines 23-32); replace the fixed `MaxBytes` with `context.GetEndpoint()?.Metadata.GetMetadata<IRequestSizeLimitMetadata>()?.MaxRequestBodySize ?? MaxBytes`, and move the `UseMiddleware` call in `Program.cs` to just after `app.UseRouting()`. Update `tests/Csps.Server.IntegrationTests/Http/RequestBodyLimitTests.cs` and `WebConfigTests` (pins `"2097152"`).

### `TestingImagesController.cs`

**Analog:** `src/Csps.Server/Controllers/TestingEmailsController.cs` (whole file): `#if CSPS_TESTING`, `[TestingOnly]`, `[AllowAnonymous]`, route `api/testing/images`, reads the fake storage's state for E2E.

### `.github/workflows/maintenance.yml`

**Analog:** `.github/workflows/weekly.yml` lines 1-21.

```yaml
name: Weekly
on:
  schedule:
    - cron: "0 18 * * 0"
  workflow_dispatch:
# D-15: the token starts with no rights; the one job asks for what ci.yml's jobs need.
permissions: {}
```

Add a plain `runs-on: ubuntu-latest` job with `timeout-minutes`, `permissions: {}` at job level too, cron `"17 19 1 * *"`, a curl loop while `more` (cap 10) using `secrets.MAINTENANCE_KEY`, counts-only `$GITHUB_STEP_SUMMARY` (D-36), `exit 1` when `ok` is false. Any action used must be SHA-pinned and in `ApprovedActions` (`CiWorkflowTests`); prefer no actions at all.

### `web/src/modules/admin/services/orderPhotosService.ts`

**Analog:** `web/src/modules/admin/services/ordersService.ts` (lines 2-93)

```ts
import { apiClient, type HttpClient } from '@/core/api/apiClient';
export type OrderDetailResponse = Schemas['OrderDetailResponse'];
export interface OrdersService {
  create(body: CreateOrderRequest, idempotencyKey: string, signal?: AbortSignal): Promise<OrderDetailResponse>;
}
export function createOrdersService(client: HttpClient): OrdersService {
  return {
    create: (body, idempotencyKey, signal) =>
      client.post<OrderDetailResponse>('/orders', body, { idempotencyKey, signal }),
  };
}
export const ordersService: OrdersService = createOrdersService(apiClient);
```

Upload passes a `FormData` body with `{ idempotencyKey, signal, timeoutMs }`. If `HttpClient.post` does not yet accept `FormData` (it must not set `Content-Type` for it), that is a `core/api/http` change, which D-31 says stays unchanged for progress; check before planning and flag it if needed (100% coverage applies to `core/api`).

### `orderPhotosCopy.ts`, `orderPhotosSchemas.ts`

**Analog:** `web/src/modules/admin/orderPaymentSchemas.ts` lines 1-40 (header comment naming the server validator mirrored, `z.config({ jitless: true });`, `const COPY = ORDER_PAYMENT_COPY.errors;`, named limit constants with the server rule in a comment) and `orderPaymentCopy.ts`. Limits come from `GET image-rules`; keep the server message winning.

### `OrderPhotosCard.tsx`, `PhotoDescriptionModal.tsx`

**Analogs:** `web/src/modules/admin/components/OrderItemsTab.tsx` (list of children on the order page, locked state, 409 reload) and `OrderItemModal.tsx` (RHF + zod modal, idempotency key per submit, server field errors). Each has a sibling `*.test.tsx` with RTL + axe to copy.

### `web/src/components/media/ImageUploader.tsx` (rebuilt), `PhotoTile.tsx`, `OrderPhotoPicker.tsx`

**Analog:** current `ImageUploader.tsx` lines 1-40: header comment listing each `SPEC-DEVIATION`, native listeners via callback refs (jsx-a11y rule), looks in `media.recipe.ts`, imports from `@/components/brand`, `@/ui/tw`, `@/utils/csps`. Remove the D-05 hover gate for "Make cover" (D-14) and update the comment. The class gate allows reveal tokens only in `src/components/media/ImageUploader*` (`class-gate.config.mjs`); a new `PhotoTile.tsx` needing them requires a gate update.

### `web/src/components/brand/icons.ts`

Add `Camera` to the lucide import list (near line 21) and `camera: Camera,` to the registry (near lines 89-90, alphabetical).

### Pages

`OrderFormPage.tsx`, `OrderPage.tsx`: replace the "Image uploads are coming soon." card (header comments at line 2) and update the tests at `OrderFormPage.test.tsx:165` and `OrderPage.test.tsx:197`, which assert that text today.

## Shared Patterns

### Result to HTTP
**Source:** `OrderItemsController.cs` line 53. **Apply to:** every new action.
```csharp
return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
```

### Session check first
**Source:** `AddOrderItemHandler.cs` lines 41-44. **Apply to:** every staff handler.

### One transaction, lock, audit, save
**Source:** `OrderChildWrite.AttemptAsync` lines 39-82. **Apply to:** every photo change; queue rows are added inside the change lambda so they share the save.

### Lost race retry
**Source:** `ConflictRetry.RunAsync(..., Result.Failure<bool>(EditErrors.Stale))` in `RemoveOrderItemHandler.cs` lines 39-54. **Apply to:** upload, delete, permanent delete.

### Short-lived context writes and batched deletes
**Source:** `IdempotencyGate.cs` lines 281-300 and 385-405. **Apply to:** run lease, compensation rows, all purges.

### Config options + Testing fake
**Source:** `EmailRegistration.cs` lines 26-60. **Apply to:** Cloudinary settings, image upload settings, maintenance key.

### Client service and schema
**Source:** `ordersService.ts`, `orderPaymentSchemas.ts`. **Apply to:** all web photo code. Imports use `@/` across folders; no long dash in `web/src` (OR-4).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/Csps.Application/Images/ImageSniffer.cs` | utility | transform | No binary format parsing exists; follow RESEARCH Pattern 1 and "Hand-rolled on purpose", synthetic fixtures only |
| `src/Csps.Application/Images/ImageMetadataStripper.cs` | utility | transform | Same; riskiest code in the phase |
| Multipart part-wise hash in the idempotency middleware | middleware | transform | Existing middleware hashes the raw body only; RESEARCH Pattern 7 step 4 |
| `ImageRemovalJob` conditional `ExecuteUpdateAsync` lease | service | batch | No per-row lease claim via update exists; RESEARCH Pattern 5 |
| `CloudinaryImageDelivery` URL builder | utility | transform | No CDN URL code exists; RESEARCH Pattern 4 table |
| `web/src/utils/images.ts` (`prepareImage`) | utility | file-I/O | No canvas or `createImageBitmap` code; RESEARCH Pattern 8 |
| `web/src/modules/admin/hooks/usePhotoUploadQueue.ts` | hook/store | event-driven | No module-level client queue exists; RESEARCH Pattern 8 |
| `tools/Csps.CloudinarySetup/` | tool | batch | Only loosely like `tools/Csps.HostProbe/`; must read keys from user-secrets or args, never from tracked files |

## Metadata

**Analog search scope:** `src/Csps.Domain`, `src/Csps.Application`, `src/Csps.Infrastructure`, `src/Csps.Server`, `tools/`, `.github/workflows`, `web/src/components`, `web/src/modules/admin`, matching tests.
**Files scanned:** about 60
**Pattern extraction date:** 2026-10-31

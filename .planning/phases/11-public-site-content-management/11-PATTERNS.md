---
created: 2026-11-11T17:15:00-06:00
updated: 2026-11-11T17:15:00-06:00
---

# Phase 11: Public Site & Content Management - Pattern Map

**Mapped:** 2026-11-11
**Files analyzed:** 34 (new or changed groups)
**Analogs found:** 31 / 34

All analog paths below are git-tracked source. Line numbers are from the branch `gsd/phase-11-public-site-content-management` at mapping time.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/Csps.Domain/Content/SiteSettings.cs` (widen, add `IAttributedRecord`) | model | CRUD | `src/Csps.Domain/Expenses/ExpenseCategory.cs` | role-match |
| `src/Csps.Domain/Content/ProductLine.cs`, `Testimonial.cs`, `GalleryEntry.cs`, `ShopClosure.cs`, `OpeningHours.cs`, `SitePhoneNumber.cs`, `ProductLinePhoto.cs` | model | CRUD | `src/Csps.Domain/Expenses/ExpenseCategory.cs` | exact |
| `src/Csps.Domain/Content/OpenStatus.cs` | utility (pure) | transform | `src/Csps.Domain/Time/BusinessClock.cs` | partial |
| `src/Csps.Domain/Orders/Order.cs` (public settings method, cancel turns off show) | model | CRUD | `Order.UpdateDetails` (lines 458-480), `Order.ChangeStatus` (line 1323) | exact |
| `src/Csps.Domain/OrderLists/ProductType.cs` (+ `ProductLineId`) | model | CRUD | same file | exact |
| `src/Csps.Application/Content/*Handler.cs` (Get/Update/Create/Move/Hide/Delete) | service | CRUD | `src/Csps.Application/OrderLists/UpdateOrderListEntryHandler.cs` | exact |
| `src/Csps.Application/Content/*Validator.cs` | utility | validation | `src/Csps.Application/OrderLists/OrderListEntryRequestValidator.cs` | exact |
| `src/Csps.Application/Content/Upload*PhotoHandler.cs` (line photo, share picture, gallery upload) | service | file-I/O | `src/Csps.Application/Orders/UploadOrderImageHandler.cs` | exact |
| `src/Csps.Application/Orders/SetOrderPublicSettingsHandler.cs` | service | CRUD | `UpdateOrderListEntryHandler.cs` + `ChangeOrderStatusHandler.cs` | role-match |
| `src/Csps.Application/Ports/IPublicContentReader.cs`, `IPublicContentCache.cs` | port | request-response | `src/Csps.Application/Ports/ISiteSettingsReader.cs`, `ISiteSettingsCache.cs` | exact |
| `src/Csps.Infrastructure/Content/PublicContentReader.cs` | service | cached read | `src/Csps.Infrastructure/Content/SiteSettingsReader.cs` | exact |
| `src/Csps.Infrastructure/Content/SiteContentLock.cs` (`site-content` lock) | service | locking | `src/Csps.Infrastructure/Money/StaffMoneyLock.cs` | exact |
| `src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs` (+ `SiteContent`) | config | locking | same file lines 13-37 | exact |
| `src/Csps.Infrastructure/Orders/OrderNumberAllocator.cs` (P10-BL-22 fix) | service | locking | `StaffMoneyLock.cs` lines 36-59 | exact |
| `src/Csps.Infrastructure/Persistence/Configurations/*Configuration.cs` (new tables) | config | CRUD | `SiteSettingsConfiguration.cs`, `CompanyExpenseConfiguration.cs` | exact |
| `src/Csps.Infrastructure/Persistence/Migrations/<ts>_AddSiteContent.cs` | migration | batch | `20261107110304_AddMoneyTransfers.cs` (InsertData lines 65-68) | exact |
| `src/Csps.Infrastructure/Images/ImageNamedSizes.cs` (new sizes) | config | n/a | same file | exact |
| `src/Csps.Application/Maintenance/StraySweepJob.cs` + `IImageInventory` (content folder) | service | batch | same file line 61 | exact |
| `src/Csps.Server/Controllers/PublicSiteController.cs` (anonymous, ETag) | controller | request-response | `SiteSettingsController.cs` | role-match |
| `src/Csps.Server/Controllers/SiteContent*Controller.cs` (Manager) | controller | CRUD | `src/Csps.Server/Controllers/ProductTypesController.cs` | exact |
| `src/Csps.Server/Controllers/SiteContent*PhotosController.cs` (uploads) | controller | file-I/O | `src/Csps.Server/Controllers/OrderImagesController.cs` lines 43-73 | exact |
| `src/Csps.Server/Controllers/OrderPublicSettingsController.cs` (Staff, D-16) | controller | CRUD | `ProductTypesController.cs` (class-level Staff policy) | exact |
| `src/Csps.Server/Endpoints/ShellPage.cs`, `PublicRouteTable.cs`, `SpaHosting.cs` (change) | route | request-response | `src/Csps.Server/Endpoints/SpaHosting.cs` | exact |
| `src/Csps.Server/Endpoints/SeoEndpoints.cs` (robots, sitemap) | route | request-response | `SpaHosting.cs` (`MapFallback(...).AllowAnonymous().ExcludeFromDescription()`) + `HealthEndpoint.cs` | role-match |
| `src/Csps.Server/Http/SecurityHeadersMiddleware.cs` (frame-src) | middleware | request-response | same file line 16-17 | exact |
| Rate limit `public-read` in `src/Csps.Server/Security/RateLimitingRegistration.cs` | config | n/a | same file (`ImageUpload` policy) | exact |
| `web/src/modules/public/services/*Service.ts` | service | request-response | `web/src/modules/admin/services/siteSettingsService.ts` | exact |
| `web/src/modules/public/hooks/use*Store.ts` (useSyncExternalStore, boot data) | hook | request-response | none (TanStack forbidden on public) | no analog |
| `web/src/modules/public/pages/{Home,Products,Gallery,Contact,NotFound}Page.tsx` | component | request-response | `web/src/modules/public/pages/HoldingPage.tsx` | role-match |
| `web/src/modules/admin/services/siteContentService.ts` (and per-tab services) | service | CRUD | `web/src/modules/admin/services/productTypesService.ts` | exact |
| `web/src/modules/admin/hooks/use*Query.ts` | hook | CRUD | `web/src/modules/admin/hooks/useProductTypesQuery.ts` | exact |
| `web/src/modules/admin/siteContentSchemas.ts` (zod, OR-3) | utility | validation | `web/src/modules/admin/categorySchemas.ts` | exact |
| `web/src/modules/admin/pages/SiteContentPage.tsx`, `components/*Tab.tsx` | component | CRUD | `web/src/modules/admin/pages/SettingsPage.tsx` + `components/ListSettingsSection.tsx` | role-match |
| `web/scripts/vite-brotli-plugin.ts` | config | file-I/O | none | no analog |
| `web/scripts/budget.ts` (`PUBLIC_ROUTE` per page) | config | n/a | same file line 87, 146 | exact |
| `web/src/utils/hours.ts` | utility | transform | `web/src/utils/` formatters | partial |

## Pattern Assignments

### Domain entities: `ProductLine`, `Testimonial`, `GalleryEntry`, `ShopClosure`, `SitePhoneNumber`, `OpeningHours`

**Analog:** `src/Csps.Domain/Expenses/ExpenseCategory.cs`

- Class shape (line 11): `public sealed class X : IAttributedRecord`. Stamps come from the interceptor (SEC-08), never set by handlers.
- Constants block (lines 13-46): max lengths, field names, `InvalidCode` like `"expense-categories.invalid-request"`, plain-English messages (`"Keep the name to 40 characters or fewer."`). Put UI-SPEC messages here.
- Private ctor for EF binding with `RowVersion = [];` (lines 49-57).
- Attribution members (lines 79-91):
```csharp
public Guid? CreatedById { get; private set; }
public DateTimeOffset CreatedAtUtc { get; private set; }
public Guid? UpdatedById { get; private set; }
public DateTimeOffset? UpdatedAtUtc { get; private set; }
public byte[] RowVersion { get; private set; }
```
- Factory returns `Result<T>` and re-checks rules (lines 122-140), id via `Guid.CreateVersion7(now)`.
- Mutators return `Result<old value>` so handlers can tell "no change" and write audit (`Rename`, line 147; `Recolor`, line 173).

### `src/Csps.Domain/Content/SiteSettings.cs` (widen)

**Analog:** `ExpenseCategory.cs` for `IAttributedRecord`. Research Pattern 3 notes SiteSettings uses `CreatedByUserId`/`UpdatedByUserId`: implement `IAttributedRecord` and map with `HasColumnName` onto the existing column names (no rename). Keep `ContactPhone`/`AddressLine` columns (D-39), stop reading them.

### `src/Csps.Domain/Orders/Order.cs` (public settings)

**Analog:** `Order.UpdateDetails` (lines 458-480): starts with `if (EnsureEditable() is { } locked) return Result.Failure<...>(locked);`. The new public settings method must NOT call `EnsureEditable` (Completed allowed, D-38) and must refuse Cancelled with its own error. `ChangeStatus` (line 1323) is where cancelling also clears "shown" (D-41).

### Application handlers (`src/Csps.Application/Content/*Handler.cs`)

**Analog:** `src/Csps.Application/OrderLists/UpdateOrderListEntryHandler.cs`

Constructor (lines 19-23):
```csharp
public sealed class UpdateOrderListEntryHandler(
    IOrderLists lists, IAuditTrail audit, IUnitOfWork unitOfWork, IValidator<OrderListEntryRequest> validator)
```
Order of steps (lines 31-69): validate (400) then transaction then catch conflicts then re-read the view.
```csharp
var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
if (!validation.IsValid) return Result.Failure<...>(OrderListErrors.Invalid(descriptor, validation));
_ = RowVersions.TryParse(request.Version, out var version);
try
{
    var outcome = await unitOfWork.InTransactionAsync(token => AttemptAsync(...), cancellationToken).ConfigureAwait(false);
    if (outcome.IsFailure) return Result.Failure<...>(outcome.Error);
}
catch (ConcurrencyConflictException) { return Result.Failure<...>(EditErrors.Stale); }
```
Inside the attempt (lines 79-123): compare `entry.RowVersion.AsSpan().SequenceEqual(version)` for 409, skip save and audit when nothing changed, `audit.Record(action, targetType, AuditKey.Of(entry.Id), detail)`, then `SaveChangesAsync`.

**Phase 11 addition:** after a successful save, call `IPublicContentCache.InvalidateAsync(ct)` (Research Pattern 4 invalidation matrix). Moves and closure overlap checks take the `site-content` lock first inside the transaction.

Delete-only-when-unused (D-08): copy the `in-use` 422 path of `DeleteOrderListEntryHandler.cs` (`OrderListEntryInUseException` in `Ports/`).

### Validators

**Analog:** `src/Csps.Application/OrderLists/OrderListEntryRequestValidator.cs` (lines 14-47)
```csharp
RuleFor(request => request.Name).Custom(static (text, context) => { ... context.AddFailure(...); });
RuleFor(request => request.Version)
    .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage)
    .When(...edit...);
```
Messages come from domain constants. Reject bracket placeholders (P-3).

### Upload handlers (line photos, share picture, gallery uploads)

**Analog:** `src/Csps.Application/Orders/UploadOrderImageHandler.cs`
- Dependencies (lines 20-29): `IAuditTrail, IUnitOfWork, IRequestContext, IImageStorage, IImageDeletionQueue, ImageUploadSettings`.
- Step order (lines 41-80): `requestContext.UserId is null` gives `AuthErrors.SessionEnded`; `!storage.IsConfigured` gives `ImageErrors.NotConfigured`; empty bytes gives `ImageErrors.FileMissing`; `ImageInspection.Check(...)`; `ImageMetadataStripper.Strip(...)`; then upload under a random id (`PublicIds`), and on a failed save queue `UploadUndone` removal.
- New ids go under `{root}/content/...`, never `{root}/orders/` (Pattern 9, P-9).

### Ports and reader: `IPublicContentReader`, `IPublicContentCache`, `PublicContentReader`

**Analog:** `src/Csps.Infrastructure/Content/SiteSettingsReader.cs` (whole file, 65 lines)
```csharp
internal sealed class SiteSettingsReader(HybridCache cache, IDbContextFactory<CspsDbContext> contextFactory) : ISiteSettingsReader, ISiteSettingsCache
{
    internal const string CacheKey = "csps:site-settings:v1";
    internal const string CacheTag = "site-settings";
    private static readonly string[] Tags = [CacheTag];
    public ValueTask<SiteSettingsSnapshot> GetAsync(CancellationToken ct) =>
        cache.GetOrCreateAsync(CacheKey, LoadAsync, EntryOptions, Tags, ct);
    public ValueTask InvalidateAsync(CancellationToken ct) => cache.RemoveByTagAsync(CacheTag, ct);
    private async ValueTask<SiteSettingsSnapshot> LoadAsync(CancellationToken ct)
    {
        var db = await contextFactory.CreateDbContextAsync(ct).ConfigureAwait(false);
        await using (db.ConfigureAwait(false)) { return await Query(db, ct).ConfigureAwait(false); }
    }
```
Use keys like `csps:public:home:v1`, tag `public-content`; invalidation also clears `site-settings`. Projections use `.AsNoTracking().Select(new ...)` with D-13 fields only. Watch the 64 KB cache cap (P-4).

### Lock: `SiteContentLock` and P10-BL-22 fix

**Analog:** `src/Csps.Infrastructure/Money/StaffMoneyLock.cs` lines 36-59
```csharp
await DatabaseLocks.TakeAsync(_context, DatabaseLocks.StaffMoney, _time.GetUtcNow(), _wait, MoneyErrors.BusyMessage, cancellationToken).ConfigureAwait(false);
...
catch (DatabaseLockTimeoutException error) when (SqlErrors.Has(error, SqlErrors.DeadlockVictim))
{
    _context.ChangeTracker.Clear();
    throw new ConcurrencyConflictException(error);
}
catch (DatabaseLockTimeoutException error)
{
    LogBusy(_logger, error, DatabaseLocks.StaffMoney, (int)Math.Ceiling(_wait.TotalSeconds));
    throw new StaffMoneyBusyException(error);
}
```
Add `public const string SiteContent = "site-content";` to `DatabaseLocks.cs` (lines 13-20) and to `StandingNames` (lines 31-37). Test first by copying `tests/Csps.Infrastructure.IntegrationTests/Money/StaffMoneyLockTests.cs` (`ADeadlockOnTheLockInsideAnOuterTransactionIsALostRaceWithTheTransactionEnded`).

### EF configurations

**Analog:** `src/Csps.Infrastructure/Persistence/Configurations/SiteSettingsConfiguration.cs`
```csharp
builder.ToTable("SiteSettings", table => table.HasCheckConstraint("CK_SiteSettings_Singleton", $"[Id] = {SiteSettings.SingletonId}"));
builder.Property(s => s.BusinessName).IsRequired().IsUnicode().HasMaxLength(SiteSettings.BusinessNameMaxLength);
builder.Property(s => s.RowVersion).IsRowVersion();
```
Use `HasCheckConstraint` for stars 1..5, hours both-or-none, closure LastDay >= FirstDay. Filtered unique index for one main phone: `HasFilter("[IsMain] = 1")`. FKs `OnDelete(DeleteBehavior.Restrict)`. No JSON columns. Do NOT use `HasData` for the six lines (Pattern 8).

### Migration `<ts>_AddSiteContent.cs`

**Analog:** `src/Csps.Infrastructure/Persistence/Migrations/20261107110304_AddMoneyTransfers.cs` lines 65-68
```csharp
migrationBuilder.InsertData(
    table: "DatabaseLocks",
    columns: new[] { "Name", "ExpiresAtUtc", "HolderId", "TakenAtUtc" },
    values: new object[] { "staff-money", null, null, null });
```
Same hand-written `InsertData` for the `site-content` lock row and the six product lines (fixed literal Guids, shown, prices null; D-06, D-40). Blank bracket placeholders in `FacebookUrl`/`ContactEmail` with `UpdateData` or a targeted statement inside the migration only (migrations are the inline-SQL exception). No drops (D-39). No triggers (OR-7).

### Stray sweep

**Analog:** `src/Csps.Application/Maintenance/StraySweepJob.cs` line 60-61
```csharp
// The trailing slash keeps "csps" from matching "csps-dev" (D-07).
var folder = $"{storage.RootFolder}/orders/";
```
Add a pass for `{root}/content/` with the same trailing-slash rule; `IImageInventory` must list content-owned ids.

### Manager controllers `SiteContent*Controller.cs`

**Analog:** `src/Csps.Server/Controllers/ProductTypesController.cs`
- Class attributes (lines 19-24): `[ApiController] [Route("api/v1/...")] [Authorize(Policy = ...)] [Produces("application/json")] [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]`. For site content use `Policies.Manager` at class level.
- Thin action (lines 62-68):
```csharp
public async Task<IResult> Create([FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] OrderListEntryRequest? body, CancellationToken cancellationToken)
{
    var result = await create.HandleAsync(OrderListKind.ProductType, body ?? OrderListEntryRequest.Empty, cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(HttpContext, static created => TypedResults.Created($"/api/v1/product-types/{created.Id:D}", created));
}
```
- Every action has `[EndpointName]` and `[ProducesResponseType]` for 200/201/204, 400, 401, 403, 404, 409, 422.
- Retire/reactivate (lines 123-157) is the shape for hide/show and move (POST with Idempotency-Key, P-11).
- Add each action to `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`.

### `OrderPublicSettingsController.cs`

Same analog, class-level `[Authorize(Policy = Policies.Staff)]` (D-16), one PUT with version. Route `api/v1/orders/{orderId:guid}/public`.

### Upload controllers

**Analog:** `src/Csps.Server/Controllers/OrderImagesController.cs` lines 43-73
```csharp
[HttpPost]
[EnableRateLimiting(RateLimitPolicies.ImageUpload)]
[RequestSizeLimitMetadata(ImageUploadLimits.BodyBytes)]
[RequestFormLimits(MultipartBodyLengthLimit = ImageUploadLimits.BodyBytes, MemoryBufferThreshold = ImageUploadLimits.BodyBytes + 1)]
public async Task<IResult> Upload(Guid orderId, IFormFile? file, [FromForm] string? description, CancellationToken cancellationToken)
{
    using var buffer = new MemoryStream((int)Math.Min(file?.Length ?? 0, ImageUploadLimits.BodyBytes));
    if (file is not null) await file.CopyToAsync(buffer, cancellationToken).ConfigureAwait(false);
    var request = new UploadOrderImageRequest(buffer.GetBuffer().AsMemory(0, (int)buffer.Length), file?.FileName, description);
    ...
}
```

### `PublicSiteController.cs` (anonymous reads)

**Analog:** `src/Csps.Server/Controllers/SiteSettingsController.cs` (lines 11-27) for the shape; swap to `[AllowAnonymous]` and `[EnableRateLimiting("public-read")]`. The ETag action body is Research "Conditional GET in a thin action" (lines 518-526): set `ETag`, `Cache-Control: no-cache`, return 304 on match, else `TypedResults.Text(snapshot.Json, "application/json", Encoding.UTF8)`. Open status: `Cache-Control: public, max-age=60`. JSON stays uncompressed (D-43).

### `ShellPage.cs`, `PublicRouteTable.cs`, `SpaHosting.cs`

**Analog:** `src/Csps.Server/Endpoints/SpaHosting.cs`
- Keep `ShellPattern = "{*path:nonfile}"` (line 28) and `FilePattern` (line 34) so matrix keys stay.
- Replace line 68 `app.MapFallbackToFile(ShellFile, ...)` with `app.MapFallback(ShellPattern, ShellPage.WriteAsync).WithMetadata(new HttpMethodMetadata(["GET", "HEAD"])).AllowAnonymous().ExcludeFromDescription();` (keeps L-01).
- HEAD handling copies `NotFound` (lines 78-88): set status and type, write no body on HEAD.
- `NoCache` helper (lines 90-91) for `Cache-Control: no-cache`; HTML ETag is weak (P-5).
- Origin from `App:PublicBaseUrl` like `src/Csps.Infrastructure/Email/AppLinksOptions.cs`, never request Host.
- Tests extend `tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs` (update `OtherStaticFilesRevalidate`, which lists `/index.html` and `/robots.txt`). Delete `web/public/robots.txt` and the fixture copy in `tests/Csps.Testing/Fixtures/webroot/`.

### `SecurityHeadersMiddleware.cs`

Line 16-17 `StrictCsp`: insert `frame-src https://www.google.com/maps/embed;` only. Nothing for scripts.

### Public web services `web/src/modules/public/services/*Service.ts`

**Analog:** `web/src/modules/admin/services/siteSettingsService.ts` (lines 1-18)
```ts
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';
export type SiteSettings = components['schemas']['SiteSettingsDto'];
export interface SiteSettingsService { get(signal?: AbortSignal): Promise<SiteSettings>; }
export function createSiteSettingsService(client: HttpClient): SiteSettingsService {
  return { get: (signal) => client.get<SiteSettings>('/site-settings', { signal }) };
}
export const siteSettingsService: SiteSettingsService = createSiteSettingsService(apiClient);
```
Factory plus singleton keeps services testable with MSW. Check the public chunk does not pull admin code (budget rule).

### Admin web services, hooks and schemas

- Service: `web/src/modules/admin/services/productTypesService.ts` (lines 1-58). Header comment rule: "A save from a form carries the row version and no Idempotency-Key (SEC-07); the POSTs carry one key per submission (SEC-06)." Paths via `encodeURIComponent`.
- Hook: `web/src/modules/admin/hooks/useProductTypesQuery.ts`:
```ts
export const productTypesKey = ['product-types'] as const;
export function useProductTypesQuery() {
  return useQuery({ queryKey: productTypesKey, queryFn: ({ signal }) => productTypesService.list(signal) });
}
```
After each content write, also clear the public store (Pattern 6).
- Schema: `web/src/modules/admin/categorySchemas.ts`: `z.config({ jitless: true });` (CSP has no unsafe-eval), messages from a copy file, exported max constants, `z.input`/`z.output` types. Test file next to it (`categorySchemas.test.ts`).

### Admin pages and tabs

**Analog:** `web/src/modules/admin/pages/SettingsPage.tsx` with `components/ListSettingsSection.tsx` and `components/CategoryModal.tsx`. Register the lazy page through `lazyRoute(...)` in `web/src/modules/admin/routes.tsx` (lines 18-90), and the nav item in `web/src/modules/admin/sections.ts`. Undrawn screens get `// SPEC-GAP:` (C-17).

### Public pages

**Analog:** `web/src/modules/public/pages/HoldingPage.tsx` (lines 1-50): deep imports, not barrels (`@/components/brand/Logo`, `@/components/layout/layout.recipe`), copy from `../copy`, class strings as constants, `<main id="main" tabIndex={-1}>`, `pg-phone:` responsive variants, `min-h-11` touch targets. Render inside `web/src/layouts/PublicLayout.tsx`. Reuse `web/src/components/media` (PhotoTile, PhotoViewer) and `web/src/components/marketing` (TestimonialCard, CategoryCard, ProcessSteps) by deep path. Lazy-load the lightbox. No em or en dash (OR-4); empty values use `EmptyValue`.

### `web/scripts/budget.ts`

Line 87 `PUBLIC_ROUTE` names only `HoldingPage.tsx`: change to one measurement per page module (P-7). Line 146 `PUBLIC_FORBIDDEN_MODULE_PREFIXES` stays; allow nuqs on Gallery only.

## Shared Patterns

### Result to ProblemDetails
**Source:** `Csps.Server.Http` `ToHttpResult` (used in every controller, e.g. `SiteSettingsController.cs` line 26). Apply to all new controllers.

### Authorization
**Source:** `ProductTypesController.cs` lines 21 and 55. Class policy plus per-action `[Authorize(Policy = Policies.Manager)]`, or `[AllowAnonymous]` for public reads. Every new action gets matrix rows in `AuthorizationMatrix.cs`.

### Concurrency
**Source:** `UpdateOrderListEntryHandler.cs` lines 45-59, 79-82. `RowVersions.TryParse`, compare bytes, `EditErrors.Stale` 409. Hours get their own token (P-8).

### Audit
**Source:** `UpdateOrderListEntryHandler.cs` lines 111-120. `audit.Record(action, targetType, AuditKey.Of(id), detail)` in the same save. Never log personal data or photo addresses.

### Cache invalidation
**Source:** `SiteSettingsReader.InvalidateAsync` (line 36-37). Every content and shown-order write calls the new invalidate port after commit.

### Locks
**Source:** `DatabaseLocks.TakeAsync` plus `StaffMoneyLock` deadlock mapping. No `sp_getapplock`, no raw SQL.

### Image pipeline
**Source:** `UploadOrderImageHandler.cs`, `ImageInspection`, `ImageMetadataStripper`, `PublicIds`, `ImageNamedSizes.cs`, `CloudinarySetupCommand.cs` (owner runs it after deploy, D-44).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `web/src/modules/public/hooks/use*Store.ts` | hook | request-response | Public pages cannot use TanStack Query (D-42). Use Research Pattern 6: `useSyncExternalStore`, boot data from `<script type="application/json" id="csps-boot">`. |
| `web/scripts/vite-brotli-plugin.ts` | config | file-I/O | No Vite plugin exists in repo. Use Research "Brotli files at build time" with `node:zlib`. |
| `src/Csps.Server/Endpoints/ShellPage.cs` head writer | route | transform | No HTML writer exists. Use `HtmlEncoder.Default` and `JsonSerializer` (Research Pattern 1, 2); keep `SpaHosting.cs` conventions. |

## Metadata

**Analog search scope:** `src/Csps.Domain`, `src/Csps.Application`, `src/Csps.Infrastructure`, `src/Csps.Server`, `web/src/modules`, `web/src/layouts`, `web/src/components`, `web/scripts`, `tests/`
**Files scanned:** about 40
**Pattern extraction date:** 2026-11-11

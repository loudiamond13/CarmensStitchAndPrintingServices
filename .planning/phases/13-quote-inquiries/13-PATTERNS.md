---
created: 2026-11-21T20:45:00-06:00
updated: 2026-11-21T20:45:00-06:00
---

# Phase 13: Quote Inquiries - Pattern Map

**Mapped:** 2026-11-21
**Files analyzed:** about 60 new or changed (file list from 13-RESEARCH.md "Recommended Project Structure" and the 13-UI-SPEC inventory)
**Analogs found:** all but 2 have a direct analog (see "No Analog Found")

All analog paths below are git-tracked source. Line numbers were read in this session.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/Csps.Domain/QuoteRequests/QuoteRequest.cs` (+ Status enum, Photo, Note, StatusChange, Rules, Retention) | model (aggregate) | CRUD | `src/Csps.Domain/Orders/Order.cs`, `OrderImage.cs`, `OrderRules.cs` | role-match |
| `src/Csps.Application/QuoteRequests/CreateQuoteRequestHandler.cs` (+ Request, Validator) | service (handler) | request-response, transactional | `src/Csps.Application/Orders/CreateOrderHandler.cs` + `CreateOrderRequestValidator.cs` | exact |
| `.../UploadQuotePhotoHandler.cs` | service | file-I/O | `src/Csps.Application/Orders/UploadOrderImageHandler.cs` | exact |
| `.../ChangeQuoteRequestStatusHandler.cs` (+ Request, Validator) | service | CRUD | `src/Csps.Application/Orders/ChangeOrderStatusHandler.cs`, `ChangeOrderStatusRequestValidator.cs` | exact |
| `.../AddQuoteRequestNoteHandler.cs`, `DeleteQuoteRequestHandler.cs` | service | CRUD | `AddOrderPaymentHandler.cs`, `DeleteOrderHandler.cs` | role-match |
| `.../ListQuoteRequestsHandler.cs`, `GetQuoteRequestHandler.cs`, `GetNewQuoteCountHandler.cs`, `GetOrderPrefillHandler.cs` | service (query) | request-response | `ListOrdersHandler.cs` + `ListOrdersRequestValidator.cs`, `GetOrderHandler.cs` | exact |
| `.../QuoteRequestErrors.cs`, `QuoteRequestAuditDetail.cs` | utility | n/a | `src/Csps.Application/Orders/OrderErrors.cs`, `OrderAuditDetail.cs` | exact |
| `src/Csps.Application/Email/AuthEmail.cs` (kinds 12 to 14) | model | event-driven (outbox) | same file, existing kinds up to `ManagerResetLink = 11` | exact |
| `src/Csps.Application/Content/SendQuoteAlertTestHandler.cs`; `UpdateSiteSettingsRequest(+Validator).cs` | service | request-response | existing `UpdateSiteSettings*` in same folder | exact |
| `src/Csps.Application/Orders/CreateOrderHandler.cs`, `PermanentlyDeleteOrderHandler.cs` (modify) | service | transactional | self | n/a |
| `src/Csps.Application/Ports/IImageDeletionQueue.cs` (reasons 6 to 8) | port | n/a | self (`PhotoDeleted = 1` .. `PhotoReplaced = 5`) | exact |
| `src/Csps.Application/Images/PublicIds.cs` (+ `QuoteFolder`, `NewQuote`) | utility | transform | `PublicIds.Folder` / `PublicIds.New` (lines 20, 30) | exact |
| `src/Csps.Application/Maintenance/StraySweepJob.cs` (third pass) | service (job) | batch | self, lines 69-72 | exact |
| `src/Csps.Infrastructure/Maintenance/QuoteRequestRetentionJob.cs` | service (job) | batch | `src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs` | exact |
| `src/Csps.Infrastructure/Images/ImageInventory.cs` (modify) | service | batch | self | n/a |
| `src/Csps.Infrastructure/Email/EmailRenderer.cs`, `EmailHtmlLayout.cs`, `AppLinksOptions.cs` (modify) | utility | transform | self | n/a |
| `src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs` (+ `QuoteAlerts`) | config | n/a | self, lines 14-34 | exact |
| `src/Csps.Infrastructure/Persistence/Configurations/QuoteRequest*Configuration.cs` + migration | config / migration | n/a | `OrderConfiguration.cs`, `OrderImageConfiguration.cs`, `EmailOutboxMessageConfiguration.cs:17` (`HasConversion<byte>()`) | exact |
| `src/Csps.Server/Controllers/PublicQuoteRequestsController.cs` | controller | request-response + file-I/O, anonymous | `PublicSiteController.cs` (attributes) + `OrderImagesController.cs` (Upload action) | exact (combined) |
| `src/Csps.Server/Controllers/QuoteRequestsController.cs` | controller | CRUD, Staff | `OrdersController.cs` | exact |
| `src/Csps.Server/Controllers/SiteSettingsController.cs` (+ test action) | controller | request-response | self | n/a |
| `src/Csps.Server/Security/RateLimitSettings.cs`, `RateLimitingRegistration.cs` | config | n/a | `ImageUpload`/`PublicRead` policies (lines 28-31), `Default()` line 78 | exact |
| `src/Csps.Server/Endpoints/PublicPageHeads.cs`, `src/Csps.Domain/Content/LegalPages.cs` | config | n/a | self (lines 25-26, line 18) | exact |
| `src/Csps.Domain/Auditing/AuditActions.cs` + `AuditActionsTests.cs` count + `web/.../auditCopy.ts` | config | n/a | self | exact |
| `web/src/modules/public/services/quoteService.ts` | service (web) | request-response + upload | `modules/public/services/privacyContactService.ts` (shape) + `modules/admin/services/orderPhotosService.ts` (upload) | exact |
| `web/src/modules/admin/services/quoteRequestsService.ts` | service (web) | CRUD | `modules/admin/services/ordersService.ts` | exact |
| `web/src/modules/public/quoteSchemas.ts`, `web/src/modules/admin/quoteRequestsSchemas.ts` | utility (zod) | validation | `modules/admin/orderPhotosSchemas.ts`, `orderFormSchemas.ts` | exact |
| `web/src/modules/public/components/QuoteForm.tsx`, `QuotePhotoPicker.tsx` | component | form + upload | admin order form (`pages/OrderFormPage.tsx`) and order photo picker components | role-match |
| `web/src/modules/public/pages/ContactPage.tsx`, `components/ContactNowCard.tsx`, `BigContactButton.tsx`, `copy.ts`, `legalPrivacy.ts`, `legalPages.ts` (modify) | component / copy | n/a | self | n/a |
| `web/src/modules/admin/pages/QuoteRequestsPage.tsx` | page | list + URL state | `modules/admin/pages/OrdersPage.tsx` | exact |
| `web/src/modules/admin/pages/QuoteRequestPage.tsx` | page | detail | `modules/admin/pages/OrderPage.tsx` | exact |
| `web/src/modules/admin/components/QuoteRequestsTable.tsx`, `QuoteStatusFilter.tsx`, `QuoteStatusMenu.tsx`, `QuoteRequestsStrip.tsx`, `QuoteAlertsCard.tsx` | component | n/a | `OrdersTable.tsx`, `OrdersToolbar.tsx`, `BusinessInfoTab.tsx`, dashboard strips in `DashboardPage.tsx` | role-match |
| `web/src/modules/admin/quoteStatus.ts`, `quoteRequestsCopy.ts` | utility / copy | n/a | `orderPhotosCopy.ts`, order status helpers | role-match |
| `web/src/components/brand/icons.ts`, Sidebar / MobileNavDrawer `counts`, `TabBar.tsx`, `@/utils/images` | component | n/a | self | n/a |
| `web/src/types/api.generated.ts` | generated | n/a | regenerate via `tools/openapi-gen`, never hand-edit | n/a |

## Pattern Assignments

### `PublicQuoteRequestsController.cs` (controller, anonymous)

**Analog A, class attributes:** `src/Csps.Server/Controllers/PublicSiteController.cs` lines 25-29
```csharp
[Route("api/v1/public")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.PublicRead)]
public sealed class PublicSiteController(
```
Use a new route (for example `api/v1/public/quote-requests`), `[AllowAnonymous]` explicitly (default-deny, authorization-matrix test discovers it), and new policies per action (create, photo, ticket).

**Analog B, one-photo upload action:** `src/Csps.Server/Controllers/OrderImagesController.cs` lines 45-79
```csharp
[HttpPost]
[EndpointName("UploadOrderImage")]
[EnableRateLimiting(RateLimitPolicies.ImageUpload)]
[UploadSlot]
[RequestSizeLimitMetadata(ImageUploadLimits.BodyBytes)]
[RequestFormLimits(MultipartBodyLengthLimit = ImageUploadLimits.BodyBytes, MemoryBufferThreshold = ImageUploadLimits.BodyBytes + 1)]
[ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
... 400/401/404/409/413/422/429/503
public async Task<IResult> Upload(Guid orderId, IFormFile? file, [FromForm] string? description, CancellationToken cancellationToken)
{
    // The form limits above keep the whole body in memory, so this copy is bounded and never touches the disk.
    using var buffer = new MemoryStream((int)Math.Min(file?.Length ?? 0, ImageUploadLimits.BodyBytes));
    if (file is not null) { await file.CopyToAsync(buffer, cancellationToken).ConfigureAwait(false); }
    var request = new UploadOrderImageRequest(buffer.GetBuffer().AsMemory(0, (int)buffer.Length), file?.FileName, description);
    var result = await upload.HandleAsync(orderId, request, cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
}
```
Thin action, one handler, `Result<T>.ToHttpResult` maps to ProblemDetails. Class also carries `[Produces("application/json")]` and `[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]` (lines 22-26). XML doc lists every status code.

### `QuoteRequestsController.cs` (controller, Staff)
**Analog:** `OrdersController.cs`, same attribute set as `OrderImagesController.cs` lines 21-26 with `[Authorize(Policy = Policies.Staff)]` (Manager-only actions use the Manager policy per D-rulings in CONTEXT). Primary-constructor injection of one handler per action.

### `UploadQuotePhotoHandler.cs` (service, file-I/O)
**Analog:** `src/Csps.Application/Orders/UploadOrderImageHandler.cs`
- Constructor (lines 11-20): `IImageStorage storage, IImageDeletionQueue imageDeletions, ImageUploadSettings settings, IUnitOfWork unitOfWork, IBusinessCalendar calendar`. Drop `IRequestContext` user check (anonymous) and `IAuditTrail` (SEC-08: no creator, no audit row).
- Order of work (lines 31-82):
```csharp
if (!storage.IsConfigured) return Result.Failure<...>(ImageErrors.NotConfigured);
if (request.Bytes.IsEmpty) return Result.Failure<...>(ImageErrors.FileMissing);
var inspected = ImageInspection.Check(request.Bytes, request.FileName, settings);
var cleaned = ImageMetadataStripper.Strip(facts.Kind, request.Bytes.Span, request.FileName);
var publicId = PublicIds.New(storage.RootFolder, orderId);          // -> PublicIds.NewQuote(root, requestId)
var stored = await storage.UploadAsync(new ImageUpload(publicId, PublicIds.Folder(storage.RootFolder, orderId), clean, facts.Kind), cancellationToken);
if (!stored.Succeeded)
{
    // A timeout or busy storage may have kept the file; queue it. A clear refusal stored nothing.
    if (stored.FailureCode == ImageFailureCodes.Transient) await UndoUploadAsync(publicId);
    return Result.Failure<...>(ImageErrors.StorageFailed);
}
```
- Row-save failure path (`SavePhotoAsync`, lines ~94-110): queue removal with `CancellationToken.None` on its own context; stray sweep is the backstop. Map `ImageErrors` codes to the quote copy (UI-SPEC Validation).

### `CreateQuoteRequestHandler.cs` (service, transactional)
**Analog:** `CreateOrderHandler.cs` (transaction + lock + outbox) and the RESEARCH "Create handler order of work" sketch. Key existing pieces:
- `unitOfWork.InTransactionAsync(async token => { ... }, cancellationToken)`.
- Lock: `DatabaseLocks` (lines 11-34) "A lock is an `ExecuteUpdate` on its row inside the caller's transaction. A new lock name is a new standing row added by a migration." Add `public const string QuoteAlerts = "quote-alerts";` and add it to `StandingNames`.
- Outbox: `IEmailOutbox.EnqueueAsync` joins the caller's unit of work; `CountRecentAsync(kind, toAddress, since, ct)` for the D-09 hourly cap.
- No inline SQL (NoInlineSqlTests); LINQ / `ExecuteUpdate` / `ExecuteDelete` only.

### Validators (FluentValidation in handler)
**Analog:** `src/Csps.Application/Orders/ChangeOrderStatusRequestValidator.cs`
```csharp
public sealed class ChangeOrderStatusRequestValidator : AbstractValidator<ChangeOrderStatusRequest>
{
    public ChangeOrderStatusRequestValidator()
    {
        RuleFor(request => request.Status)
            .Must(static text => OrderStatusNames.TryParse(text, out _)).WithMessage(OrderRules.StatusInvalid);
    }
}
```
Messages live as constants on the Domain rules class (`OrderRules`, `src/Csps.Domain/Orders/OrderRules.cs` lines 15-30 for name 100, team 100, email 254, notes 2000, `ContactNumberMaxLength = 30`). `QuoteRequestRules` reuses these values and `OrderRules.IsValidEmail` (Pitfall 7).

### `QuoteRequestRetentionJob.cs` (job, batch)
**Analog:** `src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs`
```csharp
internal sealed partial class AnalyticsRetentionJob(CspsDbContext context, IBusinessCalendar calendar, ILogger<AnalyticsRetentionJob> logger) : IMaintenanceJob
{
    internal const string RawLabel = "Old visit records removed";
    internal const string JobName = "analytics-retention";
    internal const int BatchSize = 500;
    public int Order => 15;
    public string Name => JobName;
    public async Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        // rules list of (Label, FailedText, Work); a rule that stops for the budget returns new MaintenanceJobReport(lines, true)
    }
    // RunRuleAsync: catch (Exception exception) when (SqlErrors.IsDatabaseFailure(exception)) -> logged failed line, never throws
}
```
Use an `Order` between 10 and 30 (before removals), a fixed label such as "Old quote requests removed", count only. Queue photo ids with new reason `QuotePurged` before deleting rows. Register in `MaintenanceRegistration.cs`.

### `PublicIds.cs` additions
Copy `Folder` (line 20) and `New` (line 30):
```csharp
public static string New(string root, Guid orderId) => $"{Folder(root, orderId)}/{Base32(RandomNumberGenerator.GetBytes(RandomBytes))}";
```
New folder is `{root}/quotes/{requestId}`; add a third pass in `StraySweepJob.cs` (lines 69-72 list `orders/` and `content/`) and add `QuoteRequestPhotos` to `ImageInventory` known ids (Pitfall 3).

### Rate limits
`src/Csps.Server/Security/RateLimitSettings.cs`: policy names are constants (lines 7-34, e.g. `public const string ImageUpload = "images-upload";`), rules use `RateLimitRule` like line 78 `Default() => new() { PermitLimit = 30, Window = TimeSpan.FromMinutes(10) }`. Add quote create (5 per hour, D-26, a setting), quote photo, test-email policies; register in `RateLimitingRegistration.cs` with the existing `PartitionKey`.

### `web/src/modules/public/services/quoteService.ts`
**Analog (shape):** `web/src/modules/public/services/privacyContactService.ts` lines 1-19
```ts
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';
export type PrivacyContact = components['schemas']['PrivacyContactDto'];
export interface PrivacyContactService { getPrivacyContact(signal?: AbortSignal): Promise<PrivacyContact>; }
export function createPrivacyContactService(client: HttpClient): PrivacyContactService {
  return { getPrivacyContact: (signal) => client.get<PrivacyContact>('/public/privacy-contact', { signal }) };
}
export const privacyContactService: PrivacyContactService = createPrivacyContactService(apiClient);
```
**Analog (upload):** `web/src/modules/admin/services/orderPhotosService.ts` lines 1-30: `UPLOAD_TIMEOUT_MS = 120_000`, `upload(id, file: Blob, fileName, ..., idempotencyKey, signal)`; doc comment lists every status code; keyed form upload never retried by the client. Only `core/api/http` touches `fetch` (ESLint WEB-04).

### zod schemas (`quoteSchemas.ts`, `quoteRequestsSchemas.ts`)
**Analog:** `web/src/modules/admin/orderPhotosSchemas.ts` lines 1-25
```ts
import { z } from 'zod';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });
```
Messages come from the copy file and match the server messages (OR-3). Public bundle is near its 150 KB budget (Pitfall 6): planner must pick the zod/mini or lazy-load decision from RESEARCH.

### `QuoteRequestsPage.tsx` (admin list)
**Analog:** `web/src/modules/admin/pages/OrdersPage.tsx` lines 1-30: header comment summarizing behavior; imports from `@/components/actions`, `@/components/feedback` (`EmptyState`), `@/components/layout/layout.recipe` (page head classes), `@/components/lists` (`FilterChip`, `Pagination`, `ResultBar`), `@/components/states` (`ErrorState`, `LoadingRegion`, skeletons, `useDelayedFlag`), `@/lib/query/useSettledListParams`, `@/lib/url-state/usePagedList`. Filters and page live in the URL.

### `QuoteRequestPage.tsx` (admin detail)
**Analog:** `web/src/modules/admin/pages/OrderPage.tsx` (detail, private photo viewer, row-version 409 handling).

## Shared Patterns

- **Result to ProblemDetails:** every action ends `result.ToHttpResult(HttpContext, static x => TypedResults.Ok(x))` (`OrderImagesController.cs` line 78).
- **Explicit auth on every controller:** `[Authorize(Policy = Policies.Staff)]` or `[AllowAnonymous]`; add each new action to the authorization-matrix test.
- **Errors:** static `Error` constants per area (`OrderErrors.cs`, `ImageErrors`); plain-English messages from the UI-SPEC.
- **Time:** `IBusinessCalendar.GetClockAsync` (`clock.UtcNow`, `clock.Today`); never `DateTime.Now`.
- **Stored enums:** byte conversion, append-only numbering (`AuthEmailKind` 12-14, `ImageDeletionReason` 6-8); comment "never reorder or reuse".
- **Audit:** new actions go in `AuditActions.All`, the count in `AuditActionsTests.cs:14` (currently 132), and `auditCopy.ts` labels.
- **Logging:** no address or content in logs (CWE-532); `ILogger` source-generated (`partial` class).
- **Web imports:** `@/` across folders, `./` within; services only via `@/core/api/apiClient`; no em/en dash (OR-4); empty values use `EmptyValue`.
- **No SQL triggers (OR-7), no JSON columns, no inline SQL.**

## No Analog Found

| File | Role | Reason |
|---|---|---|
| Form ticket (time-limited Data Protection protector + honeypot) | service | No existing bot-guard ticket; use RESEARCH "Time-limited ticket" (`ToTimeLimitedDataProtector`). |
| Alert email footer reason in `EmailContent` / `EmailHtmlLayout.cs:47` | utility | Footer is fixed today; small new optional field. |

## Metadata

**Analog search scope:** `src/Csps.Server/Controllers`, `src/Csps.Application/Orders`, `src/Csps.Application/Images`, `src/Csps.Infrastructure/{Analytics,Maintenance,Persistence}`, `src/Csps.Server/Security`, `web/src/modules/{public,admin}`
**Files scanned:** about 15 read in part
**Pattern extraction date:** 2026-11-21

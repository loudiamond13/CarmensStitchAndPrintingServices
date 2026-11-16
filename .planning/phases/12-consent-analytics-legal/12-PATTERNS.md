# Phase 12: Consent, Analytics & Legal - Pattern Map

*Created: 2026-11-15T22:00:00-06:00 · Updated: 2026-11-15T22:00:00-06:00*

**Mapped:** 2026-11-15
**Files analyzed:** about 45 new or changed files (grouped below)
**Analogs found:** 40 / 45

All analog paths below are git-tracked (checked with `git ls-files`). Nothing here points at `.planning/design/`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/Csps.Domain/Analytics/AnalyticsRetention.cs` | config (constants) | n/a | `src/Csps.Domain/Auditing/AuditRetention.cs` | exact |
| `src/Csps.Domain/Analytics/{ReferrerName,DeviceClass,AnalyticsPath,ConsentCookie,VitalRating,PageKey}.cs` | utility (pure) | transform | `src/Csps.Domain/Auditing/UserAgentFamily.cs`, `IpPrefix.cs` | role-match |
| `src/Csps.Domain/Analytics/{ConsentRecord,Visit,PageView,VitalSample,Daily*Count,AnalyticsSalt}.cs` | model | CRUD | `src/Csps.Infrastructure/Maintenance/MaintenanceCursor` (no rowversion) | role-match |
| `src/Csps.Infrastructure/Persistence/Configurations/*Configuration.cs` (one per new table) | config | CRUD | `src/Csps.Infrastructure/Persistence/Configurations/MaintenanceCursorConfiguration.cs` | exact |
| `src/Csps.Infrastructure/Persistence/SqlErrors.cs` (add 2627, 2601) | utility | n/a | same file | modify |
| `src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs` | service (job) | batch | `src/Csps.Infrastructure/Maintenance/PurgeExpiredRecordsJob.cs` | exact |
| `src/Csps.Infrastructure/Maintenance/MaintenanceRegistration.cs` | config | n/a | same file (line 22) | modify |
| `src/Csps.Application/Analytics/*Handler.cs` + validators + DTOs | service | request-response | `src/Csps.Application/Audit/ListAuditLogRequestValidator.cs` + its handler | role-match |
| `src/Csps.Application/Ports/{IAnalyticsStore,IVisitorStatsReader,IIpSalts}.cs` | port | CRUD | existing `src/Csps.Application/Ports/*` | role-match |
| `src/Csps.Server/Controllers/ConsentController.cs` | controller | request-response (sets cookies) | `src/Csps.Server/Controllers/SignInController.cs` (lines 63-113) | exact |
| `src/Csps.Server/Controllers/AnalyticsController.cs` (page-views, vitals, clear) | controller | event-driven (beacon) | `SignInController.cs` + `PublicSiteController.cs` | role-match |
| `src/Csps.Server/Controllers/VisitorStatsController.cs` (+ export) | controller | request-response | `src/Csps.Server/Controllers/AuditLogController.cs` | exact |
| privacy-contact read (on `PublicSiteController.cs` or own) | controller | request-response | `src/Csps.Server/Controllers/PublicSiteController.cs` | exact |
| `src/Csps.Server/Security/AnalyticsCookies.cs` (consent, vid, staff marker) | utility | n/a | `src/Csps.Server/Security/AuthCookies.cs` | exact |
| `src/Csps.Server/Security/RateLimitSettings.cs`, `RateLimitingRegistration.cs` | config | n/a | same files | modify |
| `src/Csps.Server/Endpoints/{PublicRouteTable,PublicPageHeads,SeoEndpoints}.cs`, new `LegalPages.cs` | config/route | request-response | same files | modify |
| `tests/fixtures/legal-pages.json`, `consent-cookie-cases.json` | test fixture | n/a | `tests/fixtures/public-paths.json`, `philippine-phone-cases.json` | exact |
| `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` | test | n/a | same file (lines 211-212) | modify |
| `tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs` | test | batch | `tests/Csps.Infrastructure.IntegrationTests/Maintenance/PurgeExpiredRecordsJobTests.cs` | exact |
| `web/src/modules/public/services/{consentService,analyticsService,privacyContactService}.ts` | service | request-response | `web/src/modules/public/services/siteService.ts` | exact |
| `web/src/modules/admin/services/visitorStatsService.ts` | service | request-response | `web/src/modules/admin/services/auditLogService.ts` | exact |
| `web/src/modules/admin/hooks/useVisitorStatsQuery.ts` | hook | request-response | `web/src/modules/admin/hooks/useAuditLogQuery.ts`, `useDashboardSummaryQuery.ts` | exact |
| `web/src/modules/admin/visitorStatsRange.ts` | utility (zod + presets) | transform | `web/src/modules/admin/auditRange.ts` | exact |
| `web/src/modules/admin/components/StatsCustomRange.tsx` | component | n/a | `web/src/modules/admin/components/AuditCustomRange.tsx` | exact |
| `web/src/modules/admin/pages/VisitorStatsPage.tsx` | component (page) | request-response | `web/src/modules/admin/pages/AuditLogPage.tsx`, `DashboardPage.tsx` | exact |
| `web/src/modules/admin/routes.tsx` | route | n/a | same file (lines 128-161, `requireManager`) | modify |
| `web/src/components/navigation/Sidebar.tsx` (`VISITOR_STATS_NAV_ITEM`) | component | n/a | `CONTENT_NAV_ITEM` (lines 104-113) | exact |
| `web/src/components/data/VisitorTrendChart.tsx` | component | n/a | `web/src/components/data/IncomeExpenseChart.tsx` | exact |
| `web/src/components/brand/icons.ts` (3 icons) | config | n/a | same file (lines 8-84) | modify |
| `web/src/components/states/EmptyValue.tsx` (`label` prop) | component | n/a | same file | modify |
| `web/src/layouts/PublicLayout.tsx` | layout | event-driven | same file (ContactBarSlot lazy, lines 29-35) | modify |
| `web/src/modules/public/components/{ConsentBar,CookieSettingsDialog,ClearDataDialog}.tsx` | component | event-driven | `ContactBarSlot.tsx` (lazy), `components/overlays/Modal.tsx`, `ConfirmDialog.tsx` | role-match |
| `web/src/modules/public/hooks/{useConsent,usePageViewBeacon,useSpeedReport}.ts` | hook | event-driven | `web/src/modules/public/hooks/useSiteQuery.ts` | partial |
| `web/src/modules/public/components/MapCard.tsx` | component | n/a | same file (line 6 hook note, line 48 `loaded`) | modify |
| `web/src/modules/public/components/SiteFooter.tsx` | component | n/a | same file (lines 111-186) | modify |
| `web/src/modules/public/components/PageHead.tsx` (`notice`, `meta` slots) | component | n/a | same file | modify |
| `web/src/modules/public/components/Legal*.tsx`, `pages/*Page.tsx`, `legal*.ts` | component/page | request-response (LegalFacts) | Phase 11 public pages + `PageHead.tsx` | role-match |
| `web/src/core/api/http/httpClient.ts` (text/csv opt-in, keepalive) | utility (transport) | request-response | same file (lines 351-449) | modify |
| `web/src/modules/public/consentCookie.ts` | utility | transform | shared-fixture pattern of `web/src/test/public-paths.node.test.ts` | role-match |

## Pattern Assignments

### `AnalyticsRetentionJob.cs` (service, batch)

**Analog:** `src/Csps.Infrastructure/Maintenance/PurgeExpiredRecordsJob.cs`

Class shape, labels and batch size (lines 21-33, 47-51):
```csharp
internal sealed partial class PurgeExpiredRecordsJob(CspsDbContext context, TimeProvider time, ILogger<PurgeExpiredRecordsJob> logger) : IMaintenanceJob
{
    internal const string RequestKeysLabel = "Expired request keys removed";
    internal const int BatchSize = 500;
    public int Order => 10;
    public string Name => "purge-expired-records";
```
Run loop that stops when the budget is spent (lines 54-70) and one rule as a list of delete steps (lines 81-95):
```csharp
token => context.Set<IdempotencyRecord>()
    .Where(record => record.ExpiresAt <= now)
    .OrderBy(record => record.ExpiresAt)
    .Take(BatchSize)
    .ExecuteDeleteAsync(token),
```
Per-rule failure line (lines 145-167):
```csharp
catch (Exception exception) when (SqlErrors.IsDatabaseFailure(exception))
{
    LogPurgeFailed(logger, rule.Label, exception);
    return (new MaintenanceLine(rule.Label, null, true, rule.FailedText), false);
}
```
Use `Order => 15` (between purge 10 and stray sweep 20, per `IMaintenanceJob.cs` line 9). The rollup cursor uses `IMaintenanceCursors` (registered at `MaintenanceRegistration.cs` line 20). Register the job next to line 22: `services.AddScoped<IMaintenanceJob, AnalyticsRetentionJob>();`.

**Constants:** copy `src/Csps.Domain/Auditing/AuditRetention.cs` (lines 1-8):
```csharp
public static class AuditRetention
{
    /// <summary>The number of months an entry is kept: the owner's 8-month rule.</summary>
    public const int Months = 8;
}
```
→ `AnalyticsRetention { RawMonths = 13; ConsentMonths = 13; DailyYears = 3; }`.

**Test:** copy `tests/Csps.Infrastructure.IntegrationTests/Maintenance/PurgeExpiredRecordsJobTests.cs` (lines 1-30): `IClassFixture<CspsDatabase>`, label constants repeated in the test, a fixed `Now` and `FakeTimeProvider`.

---

### New table configurations (config, CRUD)

**Analog:** `src/Csps.Infrastructure/Persistence/Configurations/MaintenanceCursorConfiguration.cs` (lines 7-22):
```csharp
/// <summary>... There is no row version (only the run that holds the maintenance lease writes it), no JSON column and no trigger (OR-7).</summary>
internal sealed class MaintenanceCursorConfiguration : IEntityTypeConfiguration<MaintenanceCursor>
{
    public void Configure(EntityTypeBuilder<MaintenanceCursor> builder)
    {
        builder.ToTable("MaintenanceCursors");
        builder.HasKey(row => row.JobName);
        builder.Property(row => row.JobName).IsUnicode(false).HasMaxLength(MaintenanceCursor.JobNameMaxLength).ValueGeneratedNever();
```
Use `IsUnicode(false)` for page keys, browser and OS labels; max lengths as named constants on the entity. Composite keys for `Daily*Counts`. Add `UniqueKeyViolation = 2627` and `DuplicateKey = 2601` to `SqlErrors.cs` beside lines 14-17 and use `SqlErrors.Has(error, ...)` (line 23).

---

### `ConsentController.cs` and `AnalyticsController.cs` (controller, anonymous POST that sets cookies)

**Analog:** `src/Csps.Server/Controllers/SignInController.cs` (lines 63-80):
```csharp
[HttpPost("two-factor/verify")]
[EnableRateLimiting(RateLimitPolicies.Verify)]
[IdempotencyExempt("The answer carries an access token and sets the refresh cookie; tokens must never be stored.")]
[RequireCsrfHeader]
[EndpointName("VerifyCode")]
[ProducesResponseType<VerifyCodeResponse>(StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status429TooManyRequests)]
public async Task<IResult> VerifyCode(
    [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] VerifyCodeRequest? body,
    CancellationToken cancellationToken)
{
    var ticket = Request.Cookies[AuthCookies.TicketCookieName];
    var result = await verifyCode.HandleAsync(ticket, body ?? VerifyCodeRequest.Empty, cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(HttpContext, outcome => { ... });
```
Put `[AllowAnonymous]` on each class or action (default-deny). The cookie is read in the controller and passed to the handler; the handler holds the logic. Add the new policy names (`Consent`, `AnalyticsCollect`, `AnalyticsClear`) to `RateLimitPolicies` in `src/Csps.Server/Security/RateLimitSettings.cs` (same doc-comment style as `PublicRead`) and register them next to `RateLimitingRegistration.cs` lines 73-81 with `AddPolicy(options, RateLimitPolicies.X, rule)`.

### `AnalyticsCookies.cs` (utility)

**Analog:** `src/Csps.Server/Security/AuthCookies.cs` (lines 8-70):
```csharp
public const string RefreshCookieName = "__Secure-csps_rt";
public const string CookiePath = "/api/v1/auth";
public static void SetRefresh(HttpResponse response, string token, DateTimeOffset? expiresAt)
{
    ArgumentNullException.ThrowIfNull(response);
    ArgumentException.ThrowIfNullOrEmpty(token);
    var options = Options();
    options.Expires = expiresAt;
    response.Cookies.Append(RefreshCookieName, token, options);
}
public static void ClearRefresh(HttpResponse response) { ... response.Cookies.Delete(RefreshCookieName, Options()); }
private static CookieOptions Options() => new() { HttpOnly = true, Secure = true, SameSite = SameSiteMode.Strict, ... };
```
The consent cookie differs: `HttpOnly = false`, `Path = "/"`, `SameSite = Lax`, `__Host-` prefix. The staff marker is set and cleared in the same places `SetRefresh` and `ClearRefresh` are called.

---

### `VisitorStatsController.cs` (controller, Manager-only read + CSV)

**Analog:** `src/Csps.Server/Controllers/AuditLogController.cs` (lines 16-56):
```csharp
[ApiController]
[Route("api/v1/audit-log")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuditLogController(ListAuditLogHandler list, ListAuditPeopleHandler people) : ControllerBase
{
    [HttpGet]
    [EndpointName("ListAuditLog")]
    [ProducesResponseType<AuditLogResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> List([FromQuery] string? from, [FromQuery] string? to, ..., CancellationToken cancellationToken)
    {
        var result = await list.HandleAsync(new ListAuditLogRequest(from, to, ...), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static entries => TypedResults.Ok(entries));
    }
```
For the export, return `TypedResults.Text(csv, "text/csv", Encoding.UTF8)` (the text form is used in `PublicSiteController.cs` line 150) and set `Content-Disposition`; override `[Produces]` on that action.

**Validator analog:** `src/Csps.Application/Audit/ListAuditLogRequestValidator.cs`. Reuse the messages verbatim (lines 23-26):
```csharp
public const string DateInvalid = "Enter a real date.";
public const string RangeOrderInvalid = "The start date must be on or before the end date.";
```
and the window check (lines 76-84), with `AddYears(-AnalyticsRetention.DailyYears)` in place of `AddMonths(-AuditRetention.Months)`:
```csharp
var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
var floor = clock.Today.AddMonths(-AuditRetention.Months);
var window = $"Choose a date from {floor.ToString("MMM d, yyyy", CultureInfo.InvariantCulture)} to today.";
```

**Auth matrix:** add rows like `AuthorizationMatrix.cs` lines 211-212:
```csharp
new("GET", "/api/v1/audit-log", "/api/v1/audit-log", Anonymous: 401, Admin: 403, Manager: 200),
```
Anonymous POST rows for consent, page-views, vitals and clear follow the existing anonymous rows in the same file.

---

### Privacy contact read (controller, request-response)

**Analog:** `src/Csps.Server/Controllers/PublicSiteController.cs` (lines 23-53). Class attributes `[Route("api/v1/public")]`, `[AllowAnonymous]`, `[EnableRateLimiting(RateLimitPolicies.PublicRead)]`. Action:
```csharp
[HttpGet("site")]
[EndpointName("GetPublicSite")]
[ProducesResponseType<PublicSiteDto>(StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status429TooManyRequests)]
public async Task<IResult> GetPublicSite(CancellationToken cancellationToken)
{
    var result = await site.HandleAsync(cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(HttpContext, snapshot => Conditional(snapshot.Json));
}
```
Do not add the email to `PublicSiteDto` (the doc at line 40 says "The shop email is never sent"; RESEARCH Pitfall 1, D-29).

---

### Legal routes on the server (route/config)

**Analog:** `src/Csps.Server/Endpoints/PublicRouteTable.cs` lines 53-62:
```csharp
private static readonly (string Path, PublicPage Page)[] Pages =
[
    ("/", PublicPage.Home),
    ("/products", PublicPage.Products),
    ("/gallery", PublicPage.Gallery),
    ("/contact", PublicPage.Contact),
];
public static IReadOnlyList<string> PagePaths { get; } = [.. Pages.Select(static entry => entry.Path)];
```
Add the four paths and enum members. `PublicPageHeads.For` (line 35-41) gains four switch arms. `SeoEndpoints.cs` line 64 loops `PublicRouteTable.PagePaths`: filter it by `LegalPages` approval. Fixture test analog: `tests/Csps.Server.IntegrationTests/Http/PublicRouteTableTests.cs` with `web/src/test/public-paths.node.test.ts`, both reading `tests/fixtures/public-paths.json`.

---

### Domain utilities (referrer, device, path, codec)

**Analogs:** `src/Csps.Domain/Auditing/UserAgentFamily.cs` (no regex, 512-character scan cap, ordered checks) and `src/Csps.Domain/Auditing/IpPrefix.cs` (reuse as is, do not copy). Pure static classes, 100% branch coverage, with shared JSON fixtures as for `tests/fixtures/philippine-phone-cases.json`.

---

### `web/src/modules/public/services/*.ts` (service, request-response)

**Analog:** `web/src/modules/public/services/siteService.ts` (lines 1-22):
```ts
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type PublicSite = components['schemas']['PublicSiteDto'];

export interface SiteService {
  /** `GET /api/v1/public/site`. */
  getSite(signal?: AbortSignal): Promise<PublicSite>;
}

export function createSiteService(client: HttpClient): SiteService {
  return {
    getSite: (signal) => client.get<PublicSite>('/public/site', { signal }),
  };
}

export const siteService: SiteService = createSiteService(apiClient);
```
Same interface + `create*` factory + singleton for `consentService`, `analyticsService`, `privacyContactService`. Beacons use `keepalive` through `httpClient`, never `navigator.sendBeacon`.

### `web/src/modules/admin/services/visitorStatsService.ts`

**Analog:** `web/src/modules/admin/services/auditLogService.ts` (lines 4-40): `type Schemas = components['schemas']`, a query interface with `from`/`to` as `YYYY-MM-DD` strings or null, `client.get<T>('/audit-log', { params: {...}, signal })`. The export call needs the new text mode in `httpClient`.

### `web/src/core/api/http/httpClient.ts` (transport)

Modify around `toHttpResponse` (line 351) and the guard comment at line 369 ("never the DTO the caller typed (LIB-WR-05)"), plus `Accept` at line 401. Add an explicit opt-in (for example `responseType: 'text'`, allow-list `text/csv`) and a `keepalive` option. Keep 100% `core/api` coverage.

### `web/src/modules/admin/hooks/useVisitorStatsQuery.ts`

**Analog:** `web/src/modules/admin/hooks/useAuditLogQuery.ts` (lines 3-23):
```ts
import { useQuery } from '@tanstack/react-query';
export const auditLogKey = ['audit-log'] as const;
export function useAuditPeopleQuery() {
  return useQuery({
    queryKey: [...auditLogKey, 'people'] as const,
    queryFn: ({ signal }) => auditLogService.people(signal),
  });
}
```
Keep previous data on range change (UI-SPEC "keeps the last figures dimmed"); `useDashboardSummaryQuery.ts` is the dashboard analog.

### `web/src/modules/admin/visitorStatsRange.ts`

**Analog:** `web/src/modules/admin/auditRange.ts` (lines 5-32):
```ts
import { z } from 'zod';
import { CUSTOM_RANGE, isCalendarDate, resolveRangePreset, type RangePreset } from '@/lib/url-state/parsers';
z.config({ jitless: true });
export const AUDIT_KEPT_MONTHS = 8;
export const AUDIT_PRESETS = ['last-7-days', 'last-30-days', 'this-month', 'last-month'] as const satisfies readonly RangePreset[];
export const DEFAULT_AUDIT_RANGE = 'last-7-days' satisfies AuditRange;
```
Stats: presets add `'this-year'` (exists in `RANGE_PRESETS`, `parsers.ts` line 124), default `'last-30-days'`, no "all" preset, floor 3 years. URL state via `dateRangeParsers(presets, default)` (`parsers.ts` line 155); the hook analog is `useAuditListParams.ts`. Today comes from `useBusinessToday.ts`, never the device clock.

### `StatsCustomRange.tsx`, `VisitorStatsPage.tsx`, routes, nav

- Copy `web/src/modules/admin/components/AuditCustomRange.tsx` for the From/To pair.
- Page: `AuditLogPage.tsx` (range toolbar, states) + `DashboardPage.tsx` (card grid, KPI row, `dashboard.recipe.ts`).
- Route: `web/src/modules/admin/routes.tsx` lines 128-132 (lazy page) and the `requireManager` loader at lines 151-153.
- Nav: copy `CONTENT_NAV_ITEM` (`Sidebar.tsx` lines 107-113):
```ts
export const CONTENT_NAV_ITEM: AdminNavItem = {
  id: 'content', label: 'Site Content', icon: 'globe', to: '/admin/site-content', manager: true,
};
```
→ `VISITOR_STATS_NAV_ITEM` with `icon: 'chart-column'`, added by `withAuditLog` after Site Content.
- Icons: add `ChartColumn`, `CircleX`, `Download` to the lucide import (`icons.ts` lines 8-81) and the `ICONS` map (line 84).

### `VisitorTrendChart.tsx`

**Analog:** `web/src/components/data/IncomeExpenseChart.tsx` with `data.recipe.ts` looks. Change keyboard model to one tab stop with arrow keys (UI-SPEC A11Y-CHART). Export from the `@/components` barrel and update `web/src/components/index.test.ts`.

### `PublicLayout.tsx` (mount bar, beacon, scroll padding)

**Analog:** the same file, lines 29-35 (lazy chunk + scroll padding token):
```ts
const ContactBarSlot = lazy(() => import('@/modules/public/components/ContactBarSlot'));
const contactScrollPaddingClasses = tw(
  'vp-lt-md:[:root:has(&)]:scroll-pb-[calc(var(--spacing-contact-bar)+var(--space-6)+env(safe-area-inset-bottom))]',
);
```
Copy it for `ConsentBar` (lazy, only when `needsChoice`) and `--spacing-consent-bar`. Deep imports only (header comment lines 14-16, PERF-01). Hide ContactBarSlot on `/contact` while the bar shows (D-30). Bar goes after `<SkipLink />` and before `<SiteHeader />` (UI-SPEC block order).

### `MapCard.tsx`, `SiteFooter.tsx`, `PageHead.tsx`

- `MapCard.tsx`: line 6 already reserves the hook: "once consent exists and the visitor allowed maps, `loaded` starts true". Seed `useState(false)` at line 48 from `useConsent().map`.
- `SiteFooter.tsx`: add the `nav aria-label="Legal"` row in both variants near the copyright and `StaffLogin` (lines 125-186).
- `PageHead.tsx`: add optional `notice` and `meta` slots.

### Legal text modules and pages

Module-root files (`web/src/modules/public/legalPrivacy.ts` and so on) export `{ version, lastUpdated, approved, sections }`. No new folder under `modules/public` (`web/src/test/source-layout.node.test.ts` lines 54-57). LegalFacts reads `useSiteQuery` (as `PublicLayout.tsx` line 56) plus the new privacy-contact service.

## Shared Patterns

### Default-deny authorization
**Source:** `AuditLogController.cs` line 18, `PublicSiteController.cs` line 25. **Apply to:** every new controller. Every action is covered in `AuthorizationMatrix.cs`.

### Anonymous write endpoints
**Source:** `SignInController.cs` lines 63-66. **Apply to:** consent, page-views, vitals, clear. Always the set `[EnableRateLimiting]` + `[RequireCsrfHeader]` + `[IdempotencyExempt("reason")]`.

### Result to HTTP
**Source:** `result.ToHttpResult(HttpContext, ...)` (`AuditLogController.cs` line 55). **Apply to:** every action; handlers return `Result<T>`, no logic in controllers.

### Maintenance jobs
**Source:** `PurgeExpiredRecordsJob.cs`. **Apply to:** the rollup and every purge. Fixed labels, batches of 500, budget check, `SqlErrors.IsDatabaseFailure` per rule, `ExecuteDeleteAsync` only (no inline SQL, no triggers).

### Business dates
**Source:** `ListAuditLogRequestValidator.cs` (`calendar.GetClockAsync`, `clock.Today`) and `web/src/modules/admin/hooks/useBusinessToday.ts`. **Apply to:** stats range, buckets, cut date, `BusinessDay` on insert.

### Shared fixtures across C# and TS
**Source:** `tests/fixtures/public-paths.json` read by `PublicRouteTableTests.cs` and `public-paths.node.test.ts`. **Apply to:** `legal-pages.json`, `consent-cookie-cases.json`.

### Web services and lazy chunks
**Source:** `siteService.ts` (factory + singleton), `PublicLayout.tsx` line 30 (`lazy(() => import(...))`). **Apply to:** all new web services and the ConsentBar, CookieSettingsDialog and speed reader chunks.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `web/src/modules/public/hooks/useSpeedReport.ts` | hook | event-driven | No `web-vitals` or `PerformanceObserver` code yet; use RESEARCH Pattern 3 |
| `web/src/modules/public/hooks/usePageViewBeacon.ts` ("pending landing view" state machine) | hook | event-driven | No beacon on route change exists; use RESEARCH Pattern 3 |
| `web/src/modules/public/hooks/useConsent.ts` | hook | event-driven (cookie + GPC) | No client cookie reader exists; use RESEARCH Pattern 2 |
| CSV builder in the stats export handler | utility | transform | No CSV export exists (Audit Log has none, D-29); use RESEARCH Pattern 5 |
| `/.well-known/gpc.json` (D-39) | route | request-response | Closest is `SeoEndpoints.cs` (robots.txt, framework-mapped); a small static JSON answer |

## Metadata

**Analog search scope:** `src/Csps.Domain`, `src/Csps.Application`, `src/Csps.Infrastructure`, `src/Csps.Server`, `tests/`, `web/src`
**Files scanned:** about 40
**Pattern extraction date:** 2026-11-15

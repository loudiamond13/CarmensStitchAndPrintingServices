---
created: "2026-10-14T12:45:00-05:00"
updated: "2026-10-14T12:45:00-05:00"
phase: 04-identity-authentication
kind: patterns
---

# Phase 4: Identity & Authentication - Pattern Map

**Mapped:** 2026-10-14 (tree on branch `gsd/quick-261014-owner-conventions`)
**Files analyzed:** ~70 new/modified (grouped by layer below)
**Analogs found:** 58 / 70 (the rest have no codebase precedent; use RESEARCH patterns)

All analog paths below are git-tracked (`git ls-files` checked). Line numbers are from the current tree.

## Stale or not-yet-existing paths (flag for the planner)

| Path named in RESEARCH / UI-SPEC / CONTEXT | Status on disk | Use instead |
|---|---|---|
| `src/Csps.Server/Controllers/` | Does not exist. No controller exists yet; only Minimal API endpoints in `src/Csps.Server/Endpoints/`. | Create it in Wave 0 (controllers infra). Copy result mapping from `Endpoints/SiteSettingsEndpoints.cs`. |
| "the single `api.ts`" (comment in `web/src/lib/forms/useSubmission.ts` line 3) | Gone. | Per-module services: `web/src/modules/admin/services/*.ts` over `@/core/api/apiClient`. Fix the stale comment when touching the file. |
| `web/src/layouts/AuthLayout.tsx`, `web/src/modules/admin/{guard.ts,authCopy.ts}`, `modules/admin/services/{authService.ts,session.ts}`, `modules/admin/pages/{SignInPage,...,SessionsPage}.tsx` | Do not exist yet (new). Parent folders exist (`modules/admin/pages`, `services`, `components`; `modules/admin/hooks/.gitkeep`). | Create at these paths (owner tree OR-6). |
| `Note` component "`@/components` (area `states`)" | Not present. | New `web/src/components/states/Note.tsx`, export from `components/states/index.ts`; `components/index.test.ts` pins the barrel list, update it. |
| `hitAreaClasses` "`@/ui/tw` or the actions recipe" | `web/src/ui/tw.ts` exists (the `tw` marker only). | Put the constant in `web/src/components/actions/button.recipe.ts` (recipes hold class strings; `ui/` is theme only per OR-6). |
| `docs/dependencies.json` (RESEARCH Wave 0 item 1) vs `docs/dependencies.md` (CONTEXT canonical refs) | Planner to confirm which exists. | Follow CONTEXT (`docs/dependencies.md`, `docs/license-exceptions.json`). |
| `IAuditTrail.AppendAsync` (saves immediately) | Exists, but WR-03 rename to `Record` + `RecordIndependentlyAsync` is Phase 4 work. | See Shared Patterns: Audit. |
| `modules/admin/sections.ts` `DEV_USER` used by `AdminLayout.tsx` lines 33, 69-75, 97 | Dev placeholder user. | Replace with the session user from `services/session.ts`. |

## File Classification

### Backend: Domain (pure rules, 100% coverage)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/Csps.Domain/Identity/PasswordPolicy.cs` | model (pure rule) | transform | `src/Csps.Domain/Auditing/UserAgentFamily.cs` | role-match |
| `src/Csps.Domain/Identity/TwoFactorChallenge.cs` (+ `TwoFactorCode.cs`) | model (aggregate, state machine) | CRUD | `src/Csps.Domain/Content/SiteSettings.cs` | role-match |
| `src/Csps.Domain/Identity/UserSession.cs`, `RefreshToken.cs` | model (aggregate) | CRUD | `src/Csps.Domain/Content/SiteSettings.cs` | role-match |
| `src/Csps.Domain/Identity/AccountToken.cs` | model | CRUD | `src/Csps.Domain/Content/SiteSettings.cs` | role-match |
| `src/Csps.Domain/Identity/DeviceSummary.cs` (D-32 "Chrome on Android") | utility (pure) | transform | `src/Csps.Domain/Auditing/UserAgentFamily.cs` | exact |
| `src/Csps.Domain/Auditing/IpPrefix.cs` (WR-02 fix) | utility | transform | itself + `tests/Csps.Domain.UnitTests/Auditing/IpPrefixTests.cs` | exact |
| `src/Csps.Domain/Common/ErrorKind.cs`, `Error.cs` (add `Unauthenticated` 401, `TooManyRequests` 429) | model | n/a | itself | exact |
| `src/Csps.Domain/Auditing/AuditActions.cs` (action-code catalog) | config (constants) | n/a | `src/Csps.Application/Security/Roles.cs` / `UserAgentFamily` const block | role-match |

### Backend: Application (handlers + ports)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/Csps.Application/Auth/SignInHandler.cs`, `VerifyCodeHandler.cs`, `ResendCodeHandler.cs`, `RefreshHandler.cs`, `SignOutHandler.cs`, `SignOutOthersHandler.cs`, `ListSessionsHandler.cs`, `RevokeSessionHandler.cs`, `ForgotPasswordHandler.cs`, `CheckAccountTokenHandler.cs`, `ResetPasswordHandler.cs`, `AcceptInviteHandler.cs`, `SetNewPasswordHandler.cs` (D-13), `BootstrapManagerHandler.cs` | service (use case) | request-response | `src/Csps.Application/Content/GetSiteSettingsHandler.cs` | exact (shape) |
| `src/Csps.Application/Auth/*Request.cs`, `*Response.cs`, `*Validator.cs` (FluentValidation) | model / validation | transform | `src/Csps.Application/Content/SiteSettingsDto.cs` (DTO); no validator yet | partial |
| `src/Csps.Application/Ports/IUserAccounts.cs`, `ISessionStore.cs`, `ITwoFactorStore.cs`, `IAccountTokenStore.cs`, `IEmailSender.cs`, `IPwnedPasswords.cs`, `ISecretHasher.cs`, `ISecureRandom.cs`, `IAccessTokenIssuer.cs`, `ISessionValidator.cs` | port (interface) | varies | `src/Csps.Application/Ports/ISiteSettingsReader.cs`, `IAuditTrail.cs`, `IRequestContext.cs` | exact |
| `src/Csps.Application/Ports/IAuditTrail.cs` (WR-03: `Record` + `RecordIndependentlyAsync`) | port | event (append) | itself | exact |

### Backend: Infrastructure

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/Csps.Infrastructure/Persistence/CspsDbContext.cs` (to `IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>`) | config | CRUD | itself | exact |
| `src/Csps.Infrastructure/Persistence/Configurations/{ApplicationUser,UserSession,RefreshToken,TwoFactorChallenge,TwoFactorCode,AccountToken,EmailOutbox,IdempotencyRecord,Role}Configuration.cs` | config (EF Fluent) | CRUD | `Persistence/Configurations/AuditEntryConfiguration.cs`, `SiteSettingsConfiguration.cs` | exact |
| `src/Csps.Infrastructure/Persistence/Migrations/<ts>_AddIdentity.cs` (+ sessions, outbox, idempotency) | migration | n/a | `Migrations/20261007165906_AddAuditLog.cs` | exact |
| `src/Csps.Infrastructure/Identity/ApplicationUser.cs`, `IdentityRegistration.cs`, `UserAccounts.cs`, EF stores | service / config | CRUD | `DataProtection/DataProtectionRegistration.cs` (registration), `Content/SiteSettingsReader.cs` (store) | role-match |
| `src/Csps.Infrastructure/Auditing/AuditTrail.cs` (WR-03) | service | event (append) | itself (lines 15-33) | exact |
| `src/Csps.Infrastructure/Email/OutboxEmailSender.cs`, `EmailDispatcher.cs` (BackgroundService), `MailKitTransport.cs`, `EmailTemplates.cs`, `SmtpOptions.cs`, `InMemoryEmailSink.cs` (`#if CSPS_TESTING`) | service | event-driven / batch | none (no BackgroundService or mail yet); options via `Server/Composition/JwtOptions.cs` | no analog (core) |
| `src/Csps.Infrastructure/Passwords/HibpPwnedPasswords.cs`, `CommonPasswordFloor.cs` (+ embedded top-10k list) | service | request-response (HTTP) | none (no typed HttpClient yet) | no analog |
| `src/Csps.Infrastructure/Idempotency/IdempotencyStore.cs` | service | CRUD | `Content/SiteSettingsReader.cs` | role-match |
| `src/Csps.Infrastructure/DependencyInjection.cs` | config | n/a | itself (lines 47-90) | exact |

### Backend: Server

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/Csps.Server/Controllers/AuthController.cs`, `SessionsController.cs` | controller | request-response | `src/Csps.Server/Endpoints/SiteSettingsEndpoints.cs` | role-match (Minimal API → controller) |
| `src/Csps.Server/Controllers/TestingEmailsController.cs` (`#if CSPS_TESTING`) | controller | request-response | same | role-match |
| `src/Csps.Server/Http/ResultHttpExtensions.cs` (+401, +429 Retry-After) | utility | transform | itself lines 42-55 | exact |
| `src/Csps.Server/Security/AccessTokenIssuer.cs` | service | transform | `tests/Csps.Testing/TestTokens.cs` lines 57-82 (same `JsonWebTokenHandler` shape) | exact |
| `src/Csps.Server/Security/SessionValidation.cs` (`OnTokenValidated`), `AuthCookies.cs`, `CsrfHeaderFilter.cs` | middleware | request-response | `Composition/SecurityRegistration.cs` lines 41-82 | role-match |
| `src/Csps.Server/Security/RateLimitingRegistration.cs`, `IdempotencyMiddleware.cs` + `IdempotencyExemptAttribute.cs` | middleware | request-response | `Http/SecurityHeadersMiddleware.cs`, `Composition/SecurityRegistration.cs` | role-match |
| `src/Csps.Server/Composition/AuthOptions.cs` (`Auth:CodeMacKey`, limits, `App:PublicBaseUrl`) | config | n/a | `Composition/JwtOptions.cs` | exact |
| `src/Csps.Server/Composition/SecurityRegistration.cs` (`ValidTypes = ["at+jwt"]`, events) | config | n/a | itself | exact |
| `src/Csps.Server/Composition/ApplicationRegistration.cs` | config | n/a | itself line 15 | exact |
| `src/Csps.Server/Program.cs` (AddControllers, rate limiter, idempotency, MapControllers, Testing sink) | config | n/a | itself lines 26-105 | exact |
| `src/Csps.Server/Http/CorrelationId.cs` (WR-06), `Logging/SensitiveDataMasking.cs` (WR-05) | utility | transform | themselves | exact |
| `src/Csps.Server/Csps.Server.csproj`, `src/Csps.Infrastructure/Csps.Infrastructure.csproj` (`CSPS_TESTING` under Debug only) | config | n/a | themselves | exact |

### Tools

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `tools/Csps.BootstrapManager/Program.cs` + `.csproj` | CLI | batch | `tools/Csps.DevSeed/Program.cs` | exact |
| `src/Csps.Infrastructure/Seeding/BootstrapTargetGuard.cs` (or in tool) | utility (pure guard) | transform | `src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs` | exact |
| `tools/scripts/Initialize-DevSecrets.ps1` (add `Auth:CodeMacKey`, SMTP via stdin) | config script | n/a | itself | exact |

### Tests

| New/Modified File | Role | Closest Analog | Match |
|---|---|---|---|
| `tests/Csps.Domain.UnitTests/Identity/*Tests.cs` | test | `tests/Csps.Domain.UnitTests/Auditing/UserAgentFamilyTests.cs` | exact |
| `tests/Csps.Application.UnitTests/Auth/*HandlerTests.cs` | test | `tests/Csps.Application.UnitTests/Content/GetSiteSettingsHandlerTests.cs` | exact |
| `tests/Csps.Infrastructure.IntegrationTests/Identity|Email|Idempotency/*` | test | `tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditTrailTests.cs`, `Seeding/DevSeedTargetGuardTests.cs` | exact |
| `tests/Csps.Server.IntegrationTests/Auth/*EndpointTests.cs` | test | `tests/Csps.Server.IntegrationTests/Content/SiteSettingsEndpointTests.cs` | exact |
| `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` (new rows + allow-list) | test data | itself lines 53-84 | exact |
| `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyCoverageTests.cs` (SEC-06 discovery) | test | `Authorization/AuthorizationCoverageTests.cs` | exact |
| `tests/Csps.Testing/TestTokens.cs` (+`sid`, `typ`), `CspsDatabase.cs` (ignore `AspNetRoles`, Pitfall 7), `CspsApiFactory.cs` (high limits, sink) | test infra | themselves | exact |
| `tests/Csps.ArchitectureTests/ReleaseSinkAbsentTests.cs` (QUAL-05) | test | `tests/Csps.ArchitectureTests/BuildConfigTests.cs`, `StartupSafetyTests.cs` | role-match |

### Web (`web/src`, owner tree OR-6)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `modules/admin/services/authService.ts` (+ `.test.ts`, MSW) | service | request-response | `modules/admin/services/siteSettingsService.ts` (+ `.test.ts`) | exact |
| `modules/admin/services/sessionsService.ts` (list/revoke, S7) | service | CRUD | same | exact |
| `modules/admin/services/session.ts` (token in memory, refresh, Web Locks, BroadcastChannel, notices) | store / provider | event-driven | `core/api/apiClient.ts` + `core/api/http/httpClient.ts` `refresh`/`onUnauthorized` hooks (lines 105-116, 492-535) | role-match |
| `core/api/apiClient.ts` (wire `refresh`, `onUnauthorized`) | config | n/a | itself | exact |
| `modules/admin/guard.ts` (`ensureSession` loader, `safeReturnUrl`) | middleware (route loader) | request-response | `modules/admin/routes.tsx` (route objects) | partial |
| `modules/admin/routes.tsx`, `core/routes/router.tsx` (D-20 reversal, auth routes, guard) | route | n/a | themselves | exact |
| `modules/admin/authCopy.ts` (`AUTH_COPY`) | config (copy) | n/a | `modules/admin/copy.ts` | exact |
| `modules/admin/schemas.ts` or per-page zod schemas (OR-3) | validation | transform | none (first zod use) | no analog |
| `layouts/AuthLayout.tsx` (+ `AuthHeader`) | component (layout) | n/a | `layouts/AdminLayout.tsx` / `layouts/PublicLayout.tsx` | role-match |
| `modules/admin/pages/SignInPage.tsx`, `VerifyCodePage.tsx`, `NewPasswordPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `AcceptInvitePage.tsx` | component (page, form) | request-response | `modules/admin/pages/AdminPreviewPage.tsx` (page) + `lib/forms/useSubmission.ts` (submit) | partial |
| `modules/admin/pages/SessionsPage.tsx` (S7) | component (list page) | CRUD | `dev/previews/ListTable.tsx` / `ListTableState.tsx` (ResponsiveTable usage) | role-match |
| `modules/admin/components/SignOutOthersDialog.tsx`, `SignOutDeviceDialog.tsx` | component (dialog) | request-response | `components/overlays/ConfirmDialog.tsx` (failure rule) | exact |
| `modules/admin/components/deviceSummary.ts` | utility | transform | `utils/format.ts` (`formatBusinessDate` line 45) | exact |
| `utils/format.ts` (+ `formatBusinessDateTime`) | utility | transform | itself line 45 | exact |
| `components/states/Note.tsx`, `ErrorState.tsx` (`align` prop) | component | n/a | `components/states/ErrorState.tsx`, `EmptyValue.tsx` | exact |
| `components/navigation/UserMenu.tsx` (`devicesPath`, `onSignOutOthers`) | component | event | itself lines 35-46, 103-190 | exact |
| `components/overlays/Modal.tsx` (R2-10 `inert`) | component | n/a | `layouts/AdminLayout.tsx` line 67 (`inert={navOpen}`) | exact |
| `layouts/AdminLayout.tsx` (real user, real Logout, sign-out-others) | component | event | itself lines 103-120 | exact |
| `web/e2e/auth*.spec.ts`, `web/playwright.config.ts` (`Testing` env switch) | test | n/a | `web/e2e/admin.spec.ts`, `web/e2e/fixtures.ts` | role-match |
| `web/src/test/msw/*` (server setup) | test infra | n/a | `web/src/test/fakeFetch.ts`, `test/setup.ts` | partial |

---

## Pattern Assignments

### Controllers: `src/Csps.Server/Controllers/AuthController.cs`, `SessionsController.cs`

**Analog:** `src/Csps.Server/Endpoints/SiteSettingsEndpoints.cs` (no controller exists yet; keep its thin-call + result mapping)

Thin action pattern (lines 35-42), copy into each action body:
```csharp
private static async Task<IResult> GetSiteSettingsAsync(
    [FromServices] GetSiteSettingsHandler handler,
    HttpContext http,
    CancellationToken cancellationToken)
{
    var result = await handler.HandleAsync(cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(http, static dto => TypedResults.Ok(dto));
}
```
Policy precedent (line 27): `.RequireAuthorization(Policies.Staff)`. In controllers: `[Authorize(Policy = Policies.Staff)]` on SessionsController / sign-out-others; `[AllowAnonymous]` per anonymous action (sign-in, verify, resend, refresh, sign-out, forgot, reset, accept-invite, token check). Policies live in `src/Csps.Application/Security/Policies.cs`; role names in `Roles.cs`.

Controller rules (RESEARCH Pattern 1): `[ApiController]`, `[Route("api/v1/auth")]`, `[FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] XRequest? dto` then `handler.HandleAsync(dto ?? XRequest.Empty, ct)`. Every `/api/v1/auth/*` response sets `Cache-Control: no-store`. Idempotency-exempt actions carry `[IdempotencyExempt(Reason = "...")]`.

---

### `src/Csps.Server/Http/ResultHttpExtensions.cs` (modify)

**Analog:** itself, the single switch (lines 42-55):
```csharp
var status = error.Kind switch
{
    ErrorKind.Validation => StatusCodes.Status400BadRequest,
    ErrorKind.NotFound => StatusCodes.Status404NotFound,
    ErrorKind.Conflict => StatusCodes.Status409Conflict,
    ErrorKind.BusinessRule => StatusCodes.Status422UnprocessableEntity,
    ErrorKind.Forbidden => StatusCodes.Status403Forbidden,
    _ => throw new ArgumentOutOfRangeException(nameof(error), error.Kind, "Unknown error kind."),
};
return TypedResults.Problem(CspsProblemDetails.Build(http, status, error.Message, SortedFieldErrors(error)));
```
Add `ErrorKind.Unauthenticated => 401` and `ErrorKind.TooManyRequests => 429` (set `Retry-After` on `http.Response` when the error carries it). Matching factories go in `src/Csps.Domain/Common/Error.cs` following lines 57-75 (`public static Error Forbidden(string code, string message) => new(ErrorKind.Forbidden, code, message, null);`). Tests: `tests/Csps.Server.IntegrationTests/Http/ResultHttpExtensionsTests.cs`, `tests/Csps.Domain.UnitTests/Common/ErrorTests.cs`.

---

### Handlers: `src/Csps.Application/Auth/*Handler.cs`

**Analog:** `src/Csps.Application/Content/GetSiteSettingsHandler.cs` (lines 1-22)
```csharp
using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>Use case: ... One handler per use case, no mediator (PRD section 3.3). ...</summary>
public sealed class GetSiteSettingsHandler(ISiteSettingsReader reader)
{
    public async Task<Result<SiteSettingsDto>> HandleAsync(CancellationToken cancellationToken)
    {
        var snapshot = await reader.GetAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(SiteSettingsDto.From(snapshot));
    }
}
```
- Primary constructor DI with ports only (Application may not reference EF, Identity, MailKit or ASP.NET Core; `tests/Csps.ArchitectureTests/LayerTests.cs` enforces).
- Expected failures returned as `Result.Failure<T>(Error.X(...))`, never thrown (`Result.cs` lines 3-5).
- Inject `TimeProvider` for every expiry/floor; `DateTime.UtcNow` and `System.Random` are banned (BannedSymbols).
- Validators: `AbstractValidator<XRequest>` from FluentValidation 12; the handler runs it and maps failures to `Error.Validation(code, message, fieldErrors)` (Error.cs line 42 requires at least one field error).
- Register each in `src/Csps.Server/Composition/ApplicationRegistration.cs` line 15 style: `services.AddScoped<SignInHandler>();`.

DTO analog: `src/Csps.Application/Content/SiteSettingsDto.cs` (record with `static From(...)` manual mapping; no AutoMapper).

---

### Ports: `src/Csps.Application/Ports/I*.cs`

**Analog:** `src/Csps.Application/Ports/IAuditTrail.cs` (lines 1-23) and `IRequestContext.cs`
```csharp
namespace Csps.Application.Ports;

/// <summary>... what it does, which requirement ...</summary>
/// <remarks>Never pass personal data or secrets ...</remarks>
public interface IAuditTrail
{
    ValueTask AppendAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken);
}
```
`IRequestContext` (lines 11-30) already gives `UserId`, `RemoteIp`, `UserAgent`, `CorrelationId`: handlers read the IP/UA for rate keys, the D-32 device summary and D-43 session rows from here, not from HttpContext.

---

### Domain aggregates: `UserSession`, `RefreshToken`, `TwoFactorChallenge`, `TwoFactorCode`, `AccountToken`

**Analog:** `src/Csps.Domain/Content/SiteSettings.cs`
- Max-length constants as `public const int XMaxLength` (lines 13-35), consumed by the EF configuration.
- Private constructor for EF binding + static factory (lines 37-68, 118-133): `public static SiteSettings CreateDefault(DateTimeOffset createdAtUtc) => new(...)`.
- `{ get; private set; }` properties; state changes through methods that take `utcNow` from the caller (lines 141-170, `ResetToSeedDefaults(DateTimeOffset utcNow)`), so rules stay pure and 100%-testable.
- `RowVersion` byte[] for aggregates with concurrent writes (line 110), e.g. `UserSession` and outbox rows.

### `src/Csps.Domain/Identity/PasswordPolicy.cs`, `DeviceSummary.cs`

**Analog:** `src/Csps.Domain/Auditing/UserAgentFamily.cs`
- Static class, `public const string` labels (lines 16-47), a bounded scan of attacker input with no regex (lines 8-12, 50, 62: `userAgent.AsSpan(0, Math.Min(userAgent.Length, MaxScanLength))`), ordered checks (lines 68-114), `Has(...)` with `StringComparison.OrdinalIgnoreCase` (lines 117-118).
- `DeviceSummary` should reuse `UserAgentFamily.Classify` for the browser and add a device check (Android, iPhone, iPad, Windows, Mac) the same way, capped at 60 chars, "Unknown browser" fallback (UI-SPEC S7).
- `PasswordPolicy` (D-11): 8 to 64 code points via `EnumerateRunes()`, one digit, one symbol; D-15 "can't contain" parts of 3+ chars, case-insensitive.

---

### EF configurations: `Persistence/Configurations/*Configuration.cs`

**Analog:** `src/Csps.Infrastructure/Persistence/Configurations/AuditEntryConfiguration.cs` (lines 13-42)
```csharp
internal sealed class AuditEntryConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> builder)
    {
        builder.ToTable("AuditLog", table => { ... });
        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.Action).IsRequired().IsUnicode().HasMaxLength(AuditEntry.ActionMaxLength);
        builder.Property(entry => entry.CorrelationId).IsRequired().IsUnicode(false).HasMaxLength(AuditEntry.CorrelationIdLength);
        builder.HasIndex(entry => entry.OccurredAtUtc).HasDatabaseName("IX_AuditLog_OccurredAtUtc");
    }
}
```
- Hashes as `binary(32)` (`HasMaxLength(32).IsFixedLength()`), unique indexes on `TokenHash`/`TicketHash`, named `IX_<Table>_<Cols>`.
- No `ToJson()` / owned JSON (D-13). `ProtectedBody`, `ResponseBody` as plain `nvarchar(max)`.
- Roles seeded with `HasData` (fixed Ids and ConcurrencyStamps) in a `RoleConfiguration`.

### `src/Csps.Infrastructure/Persistence/CspsDbContext.cs` (modify)

Current (line 14): `public sealed class CspsDbContext(DbContextOptions<CspsDbContext> options) : DbContext(options), IDataProtectionKeyContext`. Change base to `IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>`; add `DbSet` properties in the lines 16-23 style (`public DbSet<X> Xs => Set<X>();` with a one-line summary); in `OnModelCreating` (lines 26-30) call `base.OnModelCreating(modelBuilder)` before `ApplyConfigurationsFromAssembly`. Pin `o.Stores.SchemaVersion = IdentitySchemaVersions.Version2`.

### Migrations

**Analog:** `src/Csps.Infrastructure/Persistence/Migrations/20261007165906_AddAuditLog.cs` (generated by `dotnet ef migrations add`, then reviewed; raw SQL via `migrationBuilder.Sql` only where EF can't express it). Script tests: `tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs`, `MigrationTests.cs` (extend with the no-JSON and no-`AspNetUserPasskeys` checks, Pitfall 6).

---

### `src/Csps.Infrastructure/Auditing/AuditTrail.cs` (WR-03)

**Analog:** itself (lines 15-33)
```csharp
internal sealed class AuditTrail(CspsDbContext context, IRequestContext request, TimeProvider time) : IAuditTrail
{
    public async ValueTask AppendAsync(...)
    {
        var entry = AuditEntry.Create(time.GetUtcNow(), request.UserId, action, targetType, targetId,
            request.RemoteIp, request.UserAgent, request.CorrelationId, detail);
        context.AuditLog.Add(entry);
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);   // WR-03: flushes everything tracked
    }
}
```
Split into `Record(...)` (Add only, the handler's own SaveChanges commits it) and `RecordIndependentlyAsync(...)` (new context from `IDbContextFactory<CspsDbContext>`, for failure audits that must survive a rollback). Tests: `tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditTrailTests.cs` with `FixedRequestContext.cs`.

---

### `src/Csps.Infrastructure/DependencyInjection.cs` (modify)

**Analog:** itself (lines 61-89). Keep the commented-block style:
```csharp
// Needs IRequestContext, which the host registers (the Server reads it from HttpContext, plan 07).
services.AddScoped<IAuditTrail, AuditTrail>();

// The key ring in the database, encrypted with the DataProtection certificate (SEC-04, D-15).
services.AddCspsDataProtection(configuration);
```
Add `services.AddCspsIdentity()`, `services.AddCspsEmail(configuration, environment)`, `services.AddCspsPasswordChecks(configuration)` as extension methods in their folders, each following `DataProtection/DataProtectionRegistration.cs` lines 34-71 (`AddOptions<T>().BindConfiguration(T.SectionName).ValidateOnStart()` + `IValidateOptions<T>` singleton; failure messages name the setting and never the value; `FixAdvice` const at lines 22-23). Add `services.AddDbContextFactory` alongside `AddCspsPersistence` (line 101) for the session cache and independent audits (WR-01 lesson).

### Options classes: `SmtpOptions`, `AuthOptions`, `RateLimitOptions`

**Analog:** `src/Csps.Server/Composition/JwtOptions.cs` (lines 9-57): `SectionName` const, plain-English `*Message` consts that never include the secret, `{ get; set; } = string.Empty` properties, a `TryGet...Bytes` decoder for base64 secrets (copy for `Auth:CodeMacKey`, min 32 bytes). Registration pattern from `SecurityRegistration.cs` lines 34-39:
```csharp
services.AddOptions<JwtOptions>()
    .BindConfiguration(JwtOptions.SectionName)
    .Validate(static options => options.TryGetSigningKeyBytes(out _), JwtOptions.SigningKeyInvalidMessage)
    .ValidateOnStart();
```

---

### `src/Csps.Server/Security/AccessTokenIssuer.cs`

**Analog:** `tests/Csps.Testing/TestTokens.cs` (lines 57-82), the same handler and descriptor:
```csharp
return Handler.CreateToken(new SecurityTokenDescriptor
{
    Issuer = issuer,
    Audience = audience,
    Claims = new Dictionary<string, object> { ["sub"] = ..., ["role"] = role },
    NotBefore = issuedAt.UtcDateTime,
    IssuedAt = issuedAt.UtcDateTime,
    Expires = issuedAt.Add(lifetime).UtcDateTime,
    SigningCredentials = signingCredentials,
});
```
Add `["sid"]`, `["jti"]`, `TokenType = "at+jwt"`; read key/iss/aud from `IOptions<JwtOptions>`; `issuedAt` from `TimeProvider`. Update `TestTokens.Create` the same way (sid, typ) so the matrix still gets 200s.

### `src/Csps.Server/Composition/SecurityRegistration.cs` (modify)

**Analog:** itself. In `ConfigureBearer` (lines 53-82) add `ValidTypes = ["at+jwt"]` to the `TokenValidationParameters` initializer, and `bearer.Events = new JwtBearerEvents { OnTokenValidated = SessionValidation.ValidateAsync }`. Claim constants `SubjectClaim`/`RoleClaim` (lines 16-19) are where a `SessionClaim = "sid"` const belongs.

### `src/Csps.Server/Program.cs` (modify)

**Analog:** itself. Insert with the same "comment explains why" style:
- after line 46: `builder.Services.AddControllers().ConfigureApiBehaviorOptions(o => o.SuppressModelStateInvalidFilter = true);`, `AddCspsRateLimiting(...)`, idempotency services, and the Testing sink under `#if CSPS_TESTING` + `builder.Environment.IsEnvironment("Testing")` (the environment check already exists at line 19).
- after `UseAuthorization()` (line 96): `app.UseRateLimiter();` then `app.UseMiddleware<IdempotencyMiddleware>();` (RESEARCH Pattern 10 ordering; `UseRateLimiter` must follow `UseRouting`, line 92).
- next to `app.MapSiteSettings();` (line 100): `app.MapControllers();` before `app.MapSpaHost()` (line 105).
- Kestrel 1 MB body limit next to line 15 (`ConfigureKestrel`).

### `src/Csps.Server/Security/IdempotencyMiddleware.cs`, `CsrfHeaderFilter.cs`

**Analog:** `src/Csps.Server/Http/SecurityHeadersMiddleware.cs` (conventional middleware class registered with `app.UseMiddleware<T>()`, Program.cs line 62). Errors written with `CspsProblemDetails.WriteAsync(context, status)` exactly as Program.cs lines 72 and 76 do, so 400/409/422/429 bodies match every other ProblemDetails.

---

### `tools/Csps.BootstrapManager/Program.cs`

**Analog:** `tools/Csps.DevSeed/Program.cs` (lines 8-81)
```csharp
// Exit codes: 0 done, 1 failed, 2 refused by the guard, 64 usage error.
const int Succeeded = 0; const int Failed = 1; const int Refused = 2; const int UsageError = 64;

options = DevSeedOptions.Parse(args);            // catch ArgumentException -> UsageError
var check = DevSeedTargetGuard.Check(options.ConnectionString);
if (!check.Allowed) { await Console.Error.WriteLineAsync($"Refused: {check.Reason}"); return Refused; }
var builder = new DbContextOptionsBuilder<CspsDbContext>();
CspsDbContextOptions.Configure(builder, options.ConnectionString);
...
catch (Exception error) { await Console.Error.WriteLineAsync($"Failed: {error.Message}"); return Failed; }
```
Differences (RESEARCH Pattern 13, CONTEXT D-29): never migrate (drop lines 48-65); connection string from a per-process env var or hidden prompt, never argv; `--confirm-database` must equal Initial Catalog; refuse when an active Manager exists; sends an invite (no typed password). Compose services through `AddInfrastructure` so the outbox and audit are the real ones; logic in `BootstrapManagerHandler` (Application) so it is testable in-process.

**Guard analog:** `src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs` (lines 36-99): pure, never opens a connection, `SqlConnectionStringBuilder`, refuses AttachDBFilename/FailoverPartner, reasons never echo the connection string. Bootstrap guard differs: any server allowed (production target), but refuse `BetsLLC_*` and `CSPS_Legacy_Restore`. Test analog: `tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedTargetGuardTests.cs`.

---

### Tests

**Domain unit tests** — analog `tests/Csps.Domain.UnitTests/Auditing/UserAgentFamilyTests.cs`: `public sealed class XTests`, `[Fact]`/`[Theory][InlineData]`, Shouldly `ShouldBe`, real UA strings (lines 8-12, 26-36). Reuse those UA strings for `DeviceSummaryTests`.

**Application unit tests** — analog `tests/Csps.Application.UnitTests/Content/GetSiteSettingsHandlerTests.cs` (lines 22-77): NSubstitute ports, `TestContext.Current.CancellationToken`, `Should.ThrowAsync`, the CA2012 pragma around `ValueTask` `Returns` (lines 73-75). Add `FakeTimeProvider` for floors/expiry and `FakeLogger` (Microsoft.Extensions.Diagnostics.Testing) for the no-secrets-in-logs checks.

**Authorization matrix** — `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` lines 53-84: add one `new("POST", "/api/v1/auth/sign-in", ...)` row per action and each anonymous key to `AnonymousAllowList`. Key form is `"{METHOD} {RoutePattern}"` with leading slash (line 59); Wave 0 must normalise controller `RawText` (Pitfall 9). Testing sink rows inside `#if CSPS_TESTING`.

**Respawn** — `tests/Csps.Testing/CspsDatabase.cs` line 24: `IgnoredTables = ["__EFMigrationsHistory", "SiteSettings", "AuditLog", "AuditLogTruncateGuard"]`; add `"AspNetRoles"` (Pitfall 7).

**API factory** — `tests/Csps.Testing/CspsApiFactory.cs` lines 77-102: add settings with `builder.UseSetting(key, value)` (high rate limits, `Auth:CodeMacKey`, SMTP off) and services with `ConfigureTestServices`.

---

### Web: `modules/admin/services/authService.ts`, `sessionsService.ts`

**Analog:** `web/src/modules/admin/services/siteSettingsService.ts` (lines 1-18)
```ts
// Site settings calls (WEB-04). Types come from the generated OpenAPI types (D-16).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type SiteSettings = components['schemas']['SiteSettingsDto'];

export interface SiteSettingsService {
  /** `GET /api/v1/site-settings`. */
  get(signal?: AbortSignal): Promise<SiteSettings>;
}

export function createSiteSettingsService(client: HttpClient): SiteSettingsService {
  return { get: (signal) => client.get<SiteSettings>('/site-settings', { signal }) };
}

export const siteSettingsService: SiteSettingsService = createSiteSettingsService(apiClient);
```
- Factory over `HttpClient` + a default instance; types from `@/types/api.generated` (regenerate via `tools/openapi-gen` after the OpenAPI snapshot refresh).
- Sign-in, verify, refresh pass `skipAuthRefresh: true` (httpClient.ts lines 35-38). Refresh and sign-out send header `X-CSPS-CSRF: 1`.
- Forgot / reset / accept-invite / set-new-password take `{ idempotencyKey }` from `useSubmission`.
- No `code` in query params (the client's secret-param guard rejects it, httpClient.ts line ~135).

**Test analog:** `siteSettingsService.test.ts` (lines 1-120): `createFakeFetch` plans, `createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, refresh, onUnauthorized })`, the `rejection()` helper (lines 32-37), and the "three concurrent 401s, one refresh" test (lines 95-120) which the real `session.ts` refresh must keep passing. MSW 3 (`msw/node`) is new; it can replace `createFakeFetch` for authService tests but keep the same assertions.

### `core/api/apiClient.ts` (modify) and `modules/admin/services/session.ts`

**Analog:** `web/src/core/api/apiClient.ts` (lines 1-7) currently `createHttpClient({ baseURL: '/api/v1' })`; its header already says "Phase 4 adds the session refresh and the sign-out on 401 here". Hook contracts are in `core/api/http/httpClient.ts` lines 105-116 (`refresh?: () => Promise<void>`, `onUnauthorized?: () => void`) and the single-flight join at lines 492-535. Keep `core/api` free of admin imports (public bundle budget): `session.ts` registers the hooks (e.g. a `configureSession({ refresh, onUnauthorized, bearer })` setter or a request interceptor exported from `apiClient.ts`), and only the admin chunk imports `session.ts`. `core/api` has a 100% coverage gate.

### `modules/admin/routes.tsx`, `core/routes/router.tsx` (modify)

**Analog:** themselves. `routes.tsx` lines 17-23 (`/* @__PURE__ */ lazyRoute(async () => ({ Component: (await import(...)).X }))`) and lines 25-45 (route tree with `AdminRootErrorBoundary` / `AdminRouteErrorBoundary`). New:
- auth branch `admin/login`, `admin/login/verify`, `admin/login/new-password`, `admin/forgot-password`, `admin/reset-password`, `admin/accept-invite` under a lazy `AuthLayout`, outside the guard.
- guarded branch: add `loader: ensureSession` to the existing `path: 'admin'` layout route (lines 26-30) and `{ path: 'sessions', lazy: ... }` to its children (line 37 style).
- `dev/components` (lines 46-59) and preview routes stay under `__DEV_ROUTES__` and unguarded (Pitfall 11).
- `router.tsx` line 41 `...(__DEV_ROUTES__ ? adminRoutes : [])`: split into always-on real admin/auth routes and dev-only routes (D-20 reversal); update `web/src/test/build-output.node.test.ts`.

### `modules/admin/authCopy.ts`

**Analog:** `web/src/modules/admin/copy.ts` (lines 1-15): one `as const` object, `/** */` doc per key, `// SPEC-GAP:` notes inline, `titleSuffix: ' · CSPS Admin'`. Strings from UI-SPEC § Copywriting; no em/en dash (OR-4, enforced by `web/src/test/no-long-dash.node.test.ts`).

### Pages `modules/admin/pages/*Page.tsx`

**Analog for submission:** `web/src/lib/forms/useSubmission.ts` (API lines 25-65): `const { submit, pending, fieldErrors, error, reset } = useSubmission(send, { onSuccess, onFailure })`; `pending` drives `Button loading`; server `fieldErrors` keyed in server casing; `focusFirstInvalid` from `web/src/lib/forms/focusFirstInvalid.ts` on client and server field errors. RHF + `zodResolver(schema)`; read live values with `useWatch`, never `watch()` (React Compiler lint).
**Analog for page structure:** `web/src/modules/admin/pages/AdminPreviewPage.tsx` (named route export, document title via `ADMIN_COPY.titleSuffix`).
Components all from `@/components`: `Field`, `PasswordField` (`showStrength`, `hint`, `error`), `OtpInput` (`components/entry/OtpInput.tsx`, `FIRST_BOX_AUTOCOMPLETE` line 46), `Checkbox`, `Button`, `ButtonLink`, `UiLink`, `ErrorState`, `LoadingRegion`, `SkeletonText`.

### `modules/admin/pages/SessionsPage.tsx` (S7)

**Analog:** `web/src/dev/previews/ListTable.tsx` and `ListTableState.tsx` (ResponsiveTable with `pending` / `failed` + `onRetry`), `components/lists/ResponsiveTable.tsx` and `components/lists/cells.tsx`; `RowActions`/`RowAction`, `Badge` from `@/components`. Query via TanStack Query hook in `modules/admin/hooks/` with a key added to `web/src/lib/query/keys.ts`.

### Dialogs `SignOutOthersDialog.tsx`, `SignOutDeviceDialog.tsx`

**Analog:** `web/src/components/overlays/ConfirmDialog.tsx` (lines 608-660): compose `Modal`, accept `onConfirm` returning a promise or a `useSubmission` outcome, `isFailedOutcome` (lines 626-628), `failureText(describeHttpError(...))` (lines 640-643) shown above buttons with `role="alert"`, ignore Esc/scrim/dismiss while pending. Do not reuse ConfirmDialog itself (danger button and `trash-2`, UI-SPEC).

### `modules/admin/components/deviceSummary.ts`, `utils/format.ts`

**Analog:** `web/src/utils/format.ts` line 7 `BUSINESS_ZONE = 'Asia/Manila'` and lines 41-48:
```ts
export function formatBusinessDate(utcIso: string, zone: string = BUSINESS_ZONE): string | null {
  if (calendarParts(INSTANT.exec(utcIso)) === null) return null;
  return formatterFor(zone).format(new Date(utcIso));
}
```
Add `formatBusinessDateTime` the same way (returns `null` for bad input; caller renders `EmptyValue`, OR-4). Tests next to `utils/format.test.ts`.

### `components/navigation/UserMenu.tsx`, `layouts/AdminLayout.tsx`

**Analog:** themselves. `UserMenuProps` (lines 35-46) has `onLogout?: (() => void) | undefined`; add `devicesPath?: string | undefined` and `onSignOutOthers?: (() => void) | undefined` the same way, rendered only when given (keeps the Phase 2 showcase). Thread through `MenuPopoverProps` (lines 103-118) and the item list near line 190. `AdminLayout.tsx` `AdminShell` (lines 103-120) replaces the dev toast `onLogout` with the real sign-out; `AdminFrame` already models `inert={navOpen}` (line 67), the same attribute Modal needs for R2-10.

### `layouts/AuthLayout.tsx`

**Analog:** `web/src/layouts/AdminLayout.tsx` imports (lines 19-24): `SkipLink` from `@/components/entry`, `ToastProvider` from `@/components/feedback`, `pageRootClasses` from `@/components/layout/layout.recipe`; `<main id="main" tabIndex={-1}>` (line 84). Fixed `data-theme="light"`. Looks go in a recipe file (e.g. `modules/admin/components/admin.recipe.ts` pattern, or a new `layouts/auth.recipe.ts`), never inline styles (strict CSP).

---

## Shared Patterns

### Result to ProblemDetails
**Source:** `src/Csps.Server/Http/ResultHttpExtensions.cs` lines 18-55; `src/Csps.Server/Http/CspsProblemDetails.cs`
**Apply to:** every controller action, idempotency and rate-limit rejections, CSRF filter.
```csharp
return result.ToHttpResult(http, static dto => TypedResults.Ok(dto));
```

### Default-deny authorization
**Source:** `src/Csps.Server/Composition/SecurityRegistration.cs` lines 45-48 (fallback policy + `Policies.Staff`/`Policies.Manager`)
**Apply to:** every controller/action carries `[Authorize(Policy = ...)]` or `[AllowAnonymous]`; each gets a matrix row (`AuthorizationMatrix.cs`).

### Audit (AUDIT-01)
**Source:** `src/Csps.Infrastructure/Auditing/AuditTrail.cs`, `src/Csps.Domain/Auditing/AuditEntry.cs` (limits: action 64, detail 400, correlation 32 hex)
**Apply to:** every auth handler. Users by id only; never emails, codes, tokens. Codes from RESEARCH Pattern 12 plus D-43 per-device sign-out. WR-02 (`IpPrefix.cs`) and WR-06 (`Http/CorrelationId.cs`) fixed before the first write.

### Options and secrets
**Source:** `src/Csps.Server/Composition/JwtOptions.cs`, `DataProtection/DataProtectionRegistration.cs`
**Apply to:** `AuthOptions`, `SmtpOptions`, rate-limit options. Validate on start, messages name the setting and never the value; dev secrets written by `tools/scripts/Initialize-DevSecrets.ps1` via stdin (IN-02).

### Log masking
**Source:** `src/Csps.Server/Logging/SensitiveDataMasking.cs` lines 17-31 (exact names and suffixes)
**Apply to:** add `Ticket`, `CodeMac`, `TokenHash`, `RequestHash`, `ProtectedBody`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, suffix `Hash` (WR-05). Test in `tests/Csps.Server.IntegrationTests/Logging/SensitiveDataMaskingTests.cs`.

### Time
**Source:** `DependencyInjection.cs` line 71 `services.TryAddSingleton(TimeProvider.System);`
**Apply to:** all handlers, issuers, dispatcher, response floor (`Task.Delay(remaining, timeProvider)`). Tests use `FakeTimeProvider`.

### Web: services per module, client in `core/api`
**Source:** `modules/admin/services/siteSettingsService.ts`; boundaries enforced by ESLint WEB-04 and `web/src/test/source-layout.node.test.ts`
**Apply to:** `authService.ts`, `sessionsService.ts`. UI imports errors only from `@/core/api/errors`.

### Web: submission and errors
**Source:** `lib/forms/useSubmission.ts`, `utils/describeHttpError.ts`, `lib/forms/focusFirstInvalid.ts`
**Apply to:** every auth form and both dialogs. Covered POSTs pass the idempotency key; allow-listed ones still use the pending guard.

### Web: copy and dash rule
**Source:** `modules/admin/copy.ts`; `test/no-long-dash.node.test.ts`; `components/states/EmptyValue.tsx`
**Apply to:** `authCopy.ts`, all new components, S7 empty cells.

## No Analog Found

| File | Role | Data Flow | Reason / use instead |
|---|---|---|---|
| `src/Csps.Infrastructure/Email/EmailDispatcher.cs` | service (BackgroundService) | event-driven / batch | No hosted service exists. RESEARCH Pattern 9b. |
| `src/Csps.Infrastructure/Email/MailKitTransport.cs`, `EmailTemplates.cs` | service | request-response (SMTP) | First mail code. RESEARCH 9a/9b, CONTEXT D-26, D-30 (inline CID logo, text alternative). |
| `src/Csps.Infrastructure/Email/InMemoryEmailSink.cs`, `Server/Controllers/TestingEmailsController.cs` | test-only service | request-response | No `#if` build-symbol precedent. RESEARCH 9c, D-37. |
| `src/Csps.Infrastructure/Passwords/HibpPwnedPasswords.cs`, `CommonPasswordFloor.cs` | service | request-response (HTTP) | No typed HttpClient yet. RESEARCH Pattern 7, Code Example 4, D-14. |
| `src/Csps.Server/Security/RateLimitingRegistration.cs` | middleware config | request-response | No limiter yet. RESEARCH Pattern 11, D-39. |
| `src/Csps.Server/Security/IdempotencyMiddleware.cs` (transaction + `sp_getapplock`) | middleware | request-response | Only the middleware shape has an analog. RESEARCH Pattern 10, D-40. |
| `web/src/modules/admin/schemas.ts` (zod) | validation | transform | First zod/RHF use. RESEARCH 14c, OR-3. |
| `web/src/modules/admin/services/session.ts` Web Locks / BroadcastChannel parts | store | event-driven | No cross-tab code yet. RESEARCH 14a. |
| `tests/Csps.ArchitectureTests/ReleaseSinkAbsentTests.cs` (Release build + metadata walk) | test | batch | Nearest is `BuildConfigTests.cs` for static csproj checks only. RESEARCH 9c. |

## Metadata

**Analog search scope:** `src/`, `tools/`, `tests/`, `web/src/`, `web/e2e/` (git-tracked only)
**Files scanned:** ~330 tracked paths listed; 30 analogs read
**Pattern extraction date:** 2026-10-14

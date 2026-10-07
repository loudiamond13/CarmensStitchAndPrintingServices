# Architecture Research

**Domain:** Staff order-management portal + public marketing site for a small tailoring/sublimation shop (.NET 10 onion Minimal API + React 19 SPA, same origin, SQL Server, shared IIS hosting)
**Researched:** 2026-10-06
**Confidence:** MEDIUM overall. Framework behaviour was checked against first-party docs fetched today (learn.microsoft.com, cloudinary.com, smarterasp.net). The research seam rates `webfetch` as LOW and cross-checked `websearch` as MEDIUM, so each claim below carries its own tag. Design recommendations, as opposed to framework facts, are opinion. Some are marked SPIKE because they need a quick proof in code before a plan locks them in.

> Scope note: the PRD (§3, §5, §8–§10, §15, §16) already fixes the architecture. This file turns it into buildable structure, fixes the build order, and flags where the PRD, the UI spec and CLAUDE.md pull in different directions. It doesn't redesign anything.

---

## Standard Architecture

### System Overview

```
 Browser (phone-first)                                   Future Android client
 ┌───────────────────────────────────────────────┐       ┌────────────────────┐
 │ React 19 SPA (one bundle, route-level lazy)    │       │ Same /api/v1        │
 │  PublicLayout routes      AdminLayout routes   │       │ tokens in body      │
 │  pages → features → ui (UI-spec verbatim)      │       └─────────┬──────────┘
 │  TanStack Query → api.ts → httpClient (fetch)  │                 │
 │  access token in memory; refresh = cookie      │                 │
 └───────────────┬───────────────────────────────┘                 │
                 │ same origin HTTPS (no CORS)                      │
═════════════════╪══════════════════════════════════════════════════╪═════════
 IIS (SmarterASP.NET, in-process ANCM) ─ single site, single worker │
 ┌───────────────▼──────────────────────────────────────────────────▼────────┐
 │ Csps.Server  (composition root)                                            │
 │  middleware: correlation-id → security headers → exception→ProblemDetails │
 │   → rate limiter → authN (JWT bearer) → session check → authZ (fallback   │
 │   deny) → output cache → endpoints                                        │
 │  /api/v1/* endpoint groups (static methods, typed results)                │
 │  /api/v1/maintenance/* (secret-key scheme, for GitHub Actions cron)       │
 │  SPA host: static assets + server-shaped index.html fallback (meta/OG)   │
 ├────────────────────────────────────────────────────────────────────────────┤
 │ Csps.Application  (use cases, ports, DTOs, validators, policy names)      │
 │  CreateOrderHandler · AddPaymentHandler · SignInHandler · … (1 per case)  │
 │  ports: IOrderRepository IUnitOfWork IOrderQueries IImageStorage          │
 │         IEmailSender ISecondFactorDelivery IIdentityService ICurrentUser  │
 │         IBusinessCalendar ISecureCodeGenerator ITokenIssuer IAuditTrail   │
 │         IAnalyticsStore IOrderNumberGenerator IJobLease                    │
 ├────────────────────────────────────────────────────────────────────────────┤
 │ Csps.Domain  (BCL only: aggregates, value objects, invariants, errors)    │
 │  Order(+Items,Payments,Discounts,Expenses,Images) · CompanyExpense        │
 │  Session/RefreshToken/TwoFactorChallenge · SiteSettings · PriceCategory   │
 ├────────────────────────────────────────────────────────────────────────────┤
 │ Csps.Infrastructure  (implements ports)                                    │
 │  CspsDbContext : IdentityDbContext<ApplicationUser,…,Guid>,               │
 │                  IDataProtectionKeyContext · Fluent configs · migrations  │
 │  interceptors (audit stamps, aggregate-root touch) · query projections    │
 │  Identity adapter · JWT issuer · MailKit · Cloudinary · HIBP · clock      │
 └──────┬─────────────────────┬────────────────────┬───────────────────────┘
        │                     │                    │
   SQL Server 2025       Cloudinary API        SMTP (SmarterASP mail)   HIBP range API
   (host DB; LocalDB     (signed server-side    TLS                      (k-anonymity)
    dev/test)             upload, eager vars)

 Out-of-band:  GitHub Actions ── cron → POST /api/v1/maintenance/{job} (secret header)
               tools/Csps.LegacyMigration ── reads CSPS_Legacy_Restore (local, read-only)
                                           └─ writes a fresh CSPS DB via Domain + Infrastructure
```

Dependency direction: `Domain ← Application ← Infrastructure ← Server`. Runtime calls go the other way: Server → Application handler → port → Infrastructure adapter. NetArchTest enforces the compile-time direction.

### Component Responsibilities

| Component | Owns | Must not | Implementation |
|---|---|---|---|
| `Csps.Domain` | Aggregates, invariants, totals math, rounding rule, value objects (`Money`, `OrderNumber`, `PhoneNumber`, `EmailAddress`, `CustomerInfo`), domain errors, security entities (session family, refresh-token rotation and reuse rules, 2FA attempt and expiry rules) | Reference any package, read the clock, generate random numbers, know about users beyond `Guid` ids | Sealed classes, private setters, private backing collections, factory methods that return `Result<T>`, time and randomness passed in as arguments |
| `Csps.Application` | Use cases (one handler each), command/query DTOs, FluentValidation validators, port interfaces, policy-name constants, `Result`/`Error` types, manual mapping extensions | Reference EF Core, ASP.NET Core, Cloudinary or MailKit. Return `IQueryable`. Touch HTTP concepts (cookies, headers, status codes) | `ICommandHandler<TCmd,TRes>` / `IQueryHandler<TQ,TRes>`, registered by a ~15-line assembly scan in `AddApplication()` (no Scrutor, no MediatR) |
| `Csps.Infrastructure` | `CspsDbContext`, Fluent configurations, migrations, interceptors, repositories, read-side projections, Identity adapter, token issuer, email, image storage, HIBP client, maintenance job bodies, dev seeder | Reference `Csps.Server` or ASP.NET hosting types beyond Identity, Data Protection and `IHttpClientFactory` | `AddInfrastructure(IConfiguration)` extension, all classes `internal sealed` except the DI entry point |
| `Csps.Server` | Composition root, endpoint groups, policies registration, auth schemes (JWT + maintenance key), cookie/body token *transport*, middleware, ProblemDetails mapping, rate-limit policies, SPA host and index.html shaping, OpenAPI | Use `DbContext` directly in endpoints, hold business rules | `Program.cs` calls `AddApplication()/AddInfrastructure()/AddServerSecurity()`, then `app.MapCspsApi()` and `app.MapSpaHost()` |
| `web/` | Presentation, live previews (via `lib/csps.ts` only), client-side UX validation (zod), session restore and refresh single-flight | Compute persisted money, call `fetch` outside `lib/http`, store tokens in storage | Vite build → `src/Csps.Server/wwwroot` |
| `tools/Csps.LegacyMigration` | One-time ETL, dry runs, reconciliation report | Ship with the site, touch the live legacy DB, write report rows that hold customer data outside `_local/` | Console app referencing Domain + Infrastructure |

---

## Recommended Project Structure

### Repository

```
/Csps.slnx                       replaces CarmensStitchAndPrintingServices.slnx
/global.json                     pins SDK 10.0.4xx (machine has 10.0.401)
/Directory.Build.props           strict settings (PRD §17.1)
/Directory.Packages.props        central versions
/BannedSymbols.txt               DateTime.Now/UtcNow, DateTimeOffset.Now, System.Random, Guid.NewGuid (domain) …
/.editorconfig
/src/Csps.Domain/
/src/Csps.Application/
/src/Csps.Infrastructure/
/src/Csps.Server/                wwwroot/ is build output (gitignored)
/web/                            Vite app (see below)
/tests/Csps.Domain.UnitTests/
/tests/Csps.Application.UnitTests/
/tests/Csps.Infrastructure.IntegrationTests/
/tests/Csps.Server.IntegrationTests/      authorization matrix lives here
/tests/Csps.ArchitectureTests/
/tests/Csps.Testing/                       shared builders, DB fixture (LocalDB|container), JWT minting
/tools/Csps.LegacyMigration/
/tools/Csps.LegacyMigration.Tests/
/tools/scripts/                            Drop-StaleTestDbs.ps1 (CSPS_Test_* only), check-budgets wrapper
/.github/workflows/                        ci.yml, deploy.yml, maintenance-cron.yml
/_local/                                   gitignored; never read before the legacy phase
```

### Backend layers with namespaces

```
src/Csps.Domain/                         namespace Csps.Domain.*
  Common/        Result.cs, Error.cs, Entity.cs, AggregateRoot.cs, IAuditable.cs
  Money/         Money.cs (readonly record struct, decimal, 2dp, AwayFromZero), Rounding.cs
  Orders/        Order.cs, OrderItem.cs, Payment.cs, Discount.cs, OrderExpense.cs, OrderImage.cs,
                 OrderNumber.cs, OrderStatus.cs (+ transition table), ProductType.cs, PaymentMethod.cs,
                 OrderExpenseCategory.cs, CustomerInfo.cs, OrderTotals.cs, OrderRules.cs (MaxImages, MaxDiscounts),
                 OrderErrors.cs
  Expenses/      CompanyExpense.cs, CompanyExpenseCategory.cs, ExpenseErrors.cs
  Content/       SiteSettings.cs (singleton; incl. TimeZoneId, Currency, Locale), PriceCategory.cs, PriceItem.cs
  Security/      UserSession.cs (refresh family), RefreshToken.cs, TwoFactorChallenge.cs, SecurityErrors.cs
  Analytics/     ConsentRecord.cs, PageView.cs, DailyPageStat.cs
  Shared/        PhoneNumber.cs (PH mobile), EmailAddress.cs

src/Csps.Application/                    namespace Csps.Application.*
  Abstractions/  ICommandHandler.cs, IQueryHandler.cs, PagedResult.cs, Validation.cs (EnsureValidAsync helper)
  Ports/         IUnitOfWork, IOrderRepository, ICompanyExpenseRepository, ISiteContentRepository,
                 IOrderQueries, IExpenseQueries, IDashboardQueries, IUserQueries, IAuditQueries, IMetricsQueries,
                 IOrderNumberGenerator, IImageStorage, IEmailSender, ISecondFactorDelivery,
                 IIdentityService, ICurrentUser, IBusinessCalendar, ISecureCodeGenerator, ISecretHasher,
                 ITokenIssuer, ISessionStore, IAuditTrail, IAnalyticsStore, IBreachedPasswordChecker, IJobLease
  Security/      Policies.cs (const names), Roles.cs, AuditActions.cs
  Auth/          SignIn/, VerifySecondFactor/, ResendCode/, RefreshSession/, SignOut/, RevokeAllSessions/,
                 ForgotPassword/, SetPasswordWithToken/ (reset + invite acceptance share this), BootstrapManager/
  Profile/  Users/  Orders/  OrderImages/  Expenses/  Dashboard/  Content/  Analytics/  Maintenance/
    each use case folder: XxxCommand.cs, XxxHandler.cs, XxxValidator.cs, XxxDto.cs (+ Mapping.cs per feature)

src/Csps.Infrastructure/                 namespace Csps.Infrastructure.*
  DependencyInjection.cs                 public static AddInfrastructure(...)
  Persistence/   CspsDbContext.cs, UnitOfWork.cs, Configurations/*.cs (IEntityTypeConfiguration<T>),
                 Interceptors/AuditStampInterceptor.cs, Interceptors/AggregateRootTouchInterceptor.cs,
                 Migrations/, Repositories/, Queries/ (AsNoTracking projections), OrderNumberGenerator.cs,
                 Seeding/DevSeeder.cs, DesignTimeDbContextFactory.cs
  Identity/      ApplicationUser.cs (: IdentityUser<Guid>), IdentityService.cs, PasswordPolicyValidator.cs
  Security/      JwtTokenIssuer.cs, HmacSecretHasher.cs, SecureCodeGenerator.cs, SessionStore.cs
  Email/         MailKitEmailSender.cs, EmailSecondFactorDelivery.cs, Templates/
  Images/        CloudinaryImageStorage.cs, ImageSignatureSniffer.cs (magic bytes), ImageVariants.cs
  Analytics/     AnalyticsStore.cs, IpAnonymizer.cs (truncate + HMAC with rotating salt), UaFamilyParser.cs
  Jobs/          JobLease.cs, CloudinaryCleanupJob.cs, AnalyticsRollupJob.cs, SecurityPurgeJob.cs
  Time/          BusinessCalendar.cs (TimeProvider + SiteSettings.TimeZoneId)
  Http/          BreachedPasswordChecker.cs (HIBP range, typed HttpClient, allow-listed host)

src/Csps.Server/                         namespace Csps.Server.*
  Program.cs
  Composition/   SecurityRegistration.cs (JWT, policies, fallback), RateLimitRegistration.cs, ProblemDetailsSetup.cs
  Endpoints/     ApiRouting.cs (MapCspsApi: groups + conventions), AuthEndpoints.cs, ProfileEndpoints.cs,
                 UsersEndpoints.cs, OrdersEndpoints.cs, OrderChildrenEndpoints.cs, OrderImagesEndpoints.cs,
                 ExpensesEndpoints.cs, DashboardEndpoints.cs, SiteContentEndpoints.cs, PublicContentEndpoints.cs,
                 ConsentEndpoints.cs, AnalyticsEndpoints.cs, MetricsEndpoints.cs, AuditEndpoints.cs,
                 MaintenanceEndpoints.cs
  Http/          ResultHttpExtensions.cs (Result→TypedResults/ProblemDetails), RowVersionHeader.cs,
                 AuthCookieTransport.cs (web) / AuthBodyTransport.cs (mobile, later), CsrfHeaderFilter.cs,
                 CorrelationIdMiddleware.cs, SecurityHeadersMiddleware.cs, ClientIp.cs
  Auth/          CurrentUser.cs (ICurrentUser from ClaimsPrincipal), SessionValidationEvents.cs,
                 MaintenanceKeyAuthenticationHandler.cs
  Spa/           SpaHost.cs (static assets + index.html shaping, public-route table, noindex for /admin)
  Testing/       (#if CSPS_TESTING only) InMemoryEmailSink.cs, TestEndpoints.cs  → see Test Architecture
  web.config     in-process, header removal, HTTPS rewrite, cache rules
```

### Where every port lives

| Port (Application) | Purpose | Implementation (Infrastructure unless noted) | Notes |
|---|---|---|---|
| `IOrderRepository` | Load the full aggregate for update, add, remove | `OrderRepository` (EF, `AsSplitQuery` on load) | `GetForUpdateAsync(id, expectedRowVersion)` sets the RowVersion original value |
| `IOrderQueries` | List/detail/count read models | `OrderQueries` (AsNoTracking projections) | Read side returns DTOs, never entities |
| `IUnitOfWork` | `SaveChangesAsync`, `ExecuteInTransactionAsync(Func<Task>)` | `UnitOfWork` wrapping `CspsDbContext` | Must run user transactions inside the execution strategy (see Pitfalls) |
| `IOrderNumberGenerator` | Next `ORD-YYYY-NNNN` | `OrderNumberGenerator` (counter table, `MERGE … WITH (HOLDLOCK)`) | Runs inside the create transaction |
| `IImageStorage` | Upload stream, delete public id, build signed variant URLs | `CloudinaryImageStorage` | Owns the variant set (eager list) |
| `IEmailSender` | Send a transactional message | `MailKitEmailSender`; `InMemoryEmailSink` only in testing builds | Templates in Infrastructure |
| `ISecondFactorDelivery` | Deliver a code over a channel | `EmailSecondFactorDelivery` (uses `IEmailSender`) | SMS/TOTP later without Domain changes |
| `IIdentityService` | Password check with lockout, create/invite user, tokens (reset, invite, email change), role, activate/deactivate, security stamp | `IdentityService` over `UserManager<ApplicationUser>` + `SignInManager.CheckPasswordSignInAsync(lockoutOnFailure: true)` | Returns Application DTOs and `Result`, never `ApplicationUser` |
| `ICurrentUser` | UserId, role, session id, IP (truncated), UA family | **Server** `CurrentUser` (from `HttpContext`) | Only port implemented in Server, since it's an HTTP concept |
| `IClock` → **use `TimeProvider`** | Instant time | BCL `TimeProvider.System`; tests use `FakeTimeProvider` | `TimeProvider` is BCL, so Domain may take `DateTimeOffset` arguments without a custom `IClock`. Keep `IClock` only if the owner insists on the name |
| `IBusinessCalendar` | Today, month bounds and year in the business time zone | `BusinessCalendar` (TimeProvider + `SiteSettings.TimeZoneId`, cached) | Used by order numbers, dashboard, due-date hints |
| `ISecureCodeGenerator` | 6-digit codes, 256-bit tokens, ticket ids | `SecureCodeGenerator` (`RandomNumberGenerator.GetInt32(0, 1_000_000)` → `D6`) | |
| `ISecretHasher` | SHA-256 for tokens and tickets, HMAC-SHA256 for codes, fixed-time compare | `HmacSecretHasher` | Key from configuration |
| `ITokenIssuer` | JWT access token (`sub`, `role`, `sid`, `jti`, 15 min) | `JwtTokenIssuer` (`JsonWebTokenHandler`) | |
| `ISessionStore` | Persist sessions, refresh tokens, challenges | `SessionStore` (EF) | Rotation and reuse rules live in Domain `UserSession` |
| `IAuditTrail` | Append audit entries in the same unit of work | `AuditTrail` (EF entity `AuditLogEntry`) | DB trigger blocks UPDATE/DELETE |
| `IAnalyticsStore` | Record consented page view, bump anonymous daily counter, forget visitor | `AnalyticsStore` | IP never stored in clear |
| `IBreachedPasswordChecker` | HIBP k-anonymity | `BreachedPasswordChecker` (typed `HttpClient`) | Fail-open or fail-closed is an owner/security call. Recommend fail-open with an audit entry |
| `IJobLease` | Exclusive, time-boxed job runs | `JobLease` (row per job, `UPDATE … WHERE LeasedUntil < @now`) | Survives app-pool recycles |

**Identity isolation.** `ApplicationUser : IdentityUser<Guid>` (FirstName, LastName, IsActive, CreatedAt, DeletedAt) lives only in `Csps.Infrastructure.Identity`. Use `AddIdentityCore<ApplicationUser>().AddRoles<IdentityRole<Guid>>().AddSignInManager().AddEntityFrameworkStores<CspsDbContext>().AddDefaultTokenProviders()`, not `AddIdentity` (which registers cookie schemes CSPS doesn't use). Domain tables store `CreatedBy`/`RecordedBy` as `Guid`. The FK to `AspNetUsers` is configured in Infrastructure Fluent config only. That's safe because **user "delete" must be a soft delete** (UI-SPEC §8.9: "Orders and expenses they recorded stay, under their name"). Scramble the email, block sign-in and keep the name. One `CspsDbContext` holds Identity + Data Protection keys + domain tables, giving one migration history and one transaction for "change role + revoke sessions + audit".

### Frontend (reconciling PRD §9.1 with UI-SPEC §2.2)

The UI-spec verbatim files import each other through `@/ui` and `@/lib/csps`. Their paths are therefore load-bearing and win. PRD §9.1 concepts map onto them as follows:

```
web/
  index.html  vite.config.ts  tsconfig.json      ← UI-SPEC D.7 (+ PRD strict flags, proxy, outDir)
  eslint.config.js  playwright.config.ts  .prettierrc
  public/mark.svg                                 ← Appendix F   (manifest.webmanifest added in hardening)
  scripts/check-budgets.mjs                       ← reads Vite manifest.json, gz-sizes each route's static import closure
  src/
    main.tsx                                      ← D.6 verbatim (fonts + globals.css) + createRoot
    app/            router.tsx (lazy routes), providers.tsx (QueryClient, LinkProvider, Auth), RouterLink.tsx (D.6),
                    ErrorBoundary.tsx, guards/RequireSession.tsx, guards/RequireRole.tsx, paths.ts
    layouts/        PublicLayout.tsx, AdminLayout.tsx            ← UI-SPEC path (PRD "app/layouts" concept)
    pages/public/   Home, Products, Gallery, Contact, legal/*    ← UI-SPEC path (route components only)
    pages/admin/    Login, SecondFactor*, ForgotPassword*, ResetPassword*, AcceptInvite*, Dashboard, Orders,
                    OrderForm, OrderDetail, Expenses, Users, Profile, SiteContent*, Metrics*, AuditLog*   (*SPEC-GAP)
    features/       orders/ expenses/ users/ site-content/ analytics/ auth/ profile/   ← PRD path
                      hooks (useOrderList, useAddPayment…), zod schemas, modals, feature sub-components
    ui/             index.tsx (D.3), icons.ts (D.5), mark.ts (D.4)   ← PRD "components/ui" = this folder
    ui/ext/         PRD §9.2 primitives missing from Appendix D (e.g. CookieBanner, CookiePreferences), each `// SPEC-GAP`
    lib/            csps.ts (D.1) + csps.test.ts (D.2)  ← formatPeso/formatDate/orderTotals live HERE; no second formatter
                    http/httpClient.ts, http/tokenStore.ts, http/HttpError.ts (+ tests, 100%)
                    api.ts (the only endpoint file), queryKeys.ts, consent.ts, businessTime.ts
    types/          api.gen.ts (openapi-typescript output, CI drift check), index.ts (re-exports + UI-only types)
    styles/         globals.css (A.2), tokens.css (A), compat.css (A.3), components.css (B), screens.css (C)
  tests/e2e/        *.spec.ts, fixtures/ (mail sink reader, DB reset)
```

Rules that keep the two documents compatible:
- `pages/*` are thin route shells that translate Appendix E markup. `features/*` hold the data hooks and forms they use. This satisfies the PRD rule ("features = feature UI only") and the UI-spec rule ("build pages from Appendix E").
- `lib/csps.ts` is the single client formatter and order-math module. PRD's "lib formatters" requirement is met by it, so don't add `lib/format.ts`.
- ESLint `no-restricted-imports`: `pages/**` and `features/**` may not import `lib/http/*`. Only `lib/api.ts` may. `fetch` is banned outside `lib/http`.

---

## Architectural Patterns

### Pattern 1: Handler-per-use-case with `Result<T>` → ProblemDetails

**What:** Each use case is one `sealed` handler class. The endpoint is a static method that binds the request, calls the handler and maps the `Result`. Validation is an explicit first line in the handler, not a hidden pipeline.
**When:** Every endpoint.
**Trade-offs:** A little repetition per handler (validate, load, act, save). In exchange there's no magic, call sites are greppable, and handlers are trivially unit-testable with NSubstitute. Don't also call .NET 10's `AddValidation()` (DataAnnotations source generator). One validation system (FluentValidation, PRD §2) avoids double and divergent errors. [ASP.NET Core 10 release notes: `AddValidation` is opt-in. Seam: LOW, first-party docs.]

```csharp
// Application
public sealed class AddPaymentHandler(IOrderRepository orders, IUnitOfWork uow, IValidator<AddPayment> v,
    IBusinessCalendar cal, ICurrentUser me) : ICommandHandler<AddPayment, OrderDetailDto>
{
    public async Task<Result<OrderDetailDto>> Handle(AddPayment cmd, CancellationToken ct)
    {
        if (await v.EnsureValidAsync(cmd, ct) is { } invalid) return invalid;          // Error.Validation(fields)
        var order = await orders.GetForUpdateAsync(cmd.OrderId, cmd.RowVersion, ct);
        if (order is null) return OrderErrors.NotFound;
        var added = order.AddPayment(Money.Of(cmd.Amount), cmd.PaidOn, cmd.Method, cmd.Reference, me.UserId, cal.Today);
        if (added.IsFailure) return added.Error;                                           // e.g. Overpayment (422)
        var saved = await uow.SaveChangesAsync(ct);                                        // Conflict → 409
        return saved.IsFailure ? saved.Error : order.ToDetailDto();
    }
}

// Server
static async Task<Results<Ok<OrderDetailDto>, ProblemHttpResult, ValidationProblem>> AddPayment(
    Guid orderId, AddPaymentRequest body, [FromHeader(Name = "If-Match")] string rowVersion,
    ICommandHandler<AddPayment, OrderDetailDto> handler, CancellationToken ct)
    => (await handler.Handle(body.ToCommand(orderId, RowVersionHeader.Parse(rowVersion)), ct)).ToHttpResult();
```

Error → status mapping, in one place (`ResultHttpExtensions`): `Validation` → 400 `ValidationProblem` (field `errors`), `NotFound` → 404, `Conflict` (concurrency) → 409, `BusinessRule` → 422, `Forbidden` → 403, `Unauthorized` → 401. Every ProblemDetails carries `traceId` = correlation id. Endpoints are **named static methods, not lambdas**. ASP.NET Core 10's XML-doc → OpenAPI integration only works for named methods [release notes; seam LOW], and named methods are easier to reference from tests.

### Pattern 2: Order aggregate on EF Core 10

**Children are entities, not owned types or complex types.** Items, payments, discounts, expenses and images each need an identity for nested REST routes (`/orders/{id}/payments/{paymentId}`), per-row edit/delete and concurrency messages. Map them as regular entity types with a required FK, `OnDelete(Cascade)`, navigations only from the root (no `DbSet` for children), and field-access backing collections. **Value objects become EF 10 complex types.** EF 10 adds optional and struct complex types, and the EF team says to prefer complex types over owned types for value-like data [EF 10 what's new; seam LOW, first-party docs]. Don't use `ToJson()` anywhere. SQL Server 2025's `json` column type is still **preview** [learn.microsoft.com json data type; websearch MEDIUM], and EF 10 switches to it automatically at compatibility level 170. **Pin `UseCompatibilityLevel(160)`** so the schema is identical on LocalDB 17.0, the Linux container and whatever compat level the SmarterASP database reports.

```csharp
internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.Property(o => o.RowVersion).IsRowVersion();
        b.Property(o => o.Number).HasConversion(n => n.Value, s => OrderNumber.Rehydrate(s)).HasMaxLength(32);
        b.HasIndex(o => o.Number).IsUnique();
        b.ComplexProperty(o => o.Customer, c => { c.Property(x => x.Name).HasMaxLength(120).HasColumnName("CustomerName"); /* team, phone, email, address */ });
        b.ComplexProperty(o => o.Totals, t =>                    // persisted snapshot, see below
        {
            t.MoneyColumn(x => x.ItemsTotal, "ItemsTotal");      // helper: nested Money complex type → decimal(18,2)
            t.MoneyColumn(x => x.DiscountTotal, "DiscountTotal");
            t.MoneyColumn(x => x.NetTotal, "NetTotal");
            t.MoneyColumn(x => x.PaidTotal, "PaidTotal");
            t.MoneyColumn(x => x.Balance, "Balance");
            t.MoneyColumn(x => x.ExpenseTotal, "ExpenseTotal");
        });
        b.Property(o => o.OrderDate);                            // DateOnly → date (native in SQL Server provider)
        b.HasMany(o => o.Items).WithOne().HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(o => o.Items).UsePropertyAccessMode(PropertyAccessMode.Field);
        // … Payments, Discounts, Expenses, Images identically
        b.ToTable(t => t.HasCheckConstraint("CK_Orders_TotalsConsistent",
            "[NetTotal] = [ItemsTotal] - [DiscountTotal] AND [Balance] = [NetTotal] - [PaidTotal]"));
        b.HasIndex(o => new { o.Status, o.DueDate });  b.HasIndex(o => o.OrderDate);   // list filters/sorts
    }
}
```

**Totals: persist a snapshot computed by the domain. Don't compute them on read.** Every mutating method on `Order` ends with `RecalculateTotals()`, which writes `OrderTotals` (items, discount, net, paid, balance, expenses). The domain is still the single source of truth (PRD §5.1). The database just stores the domain's answer. Why:
- ORD-02 sorts and filters on balance and total and has a "has balance" filter. The dashboard needs Σ max(Balance, 0) over active orders. Persisted columns make these indexable one-table queries with no N+1 and no correlated aggregate subqueries.
- The root row is rewritten on every child change anyway (concurrency, below), so persisting totals costs nothing extra.
- A DB `CHECK` guards the arithmetic between snapshot columns. An integration test plus a maintenance "verify totals" job recompute from child rows and compare. That catches anything (including the ETL) that bypasses the aggregate.
- Naming the columns `ItemsTotal / DiscountTotal / NetTotal / PaidTotal / Balance` makes conflict C-13 (PRD "Total" vs UI "Total") unambiguous in the schema. DTOs then label them in UI-spec terms.

**Rounding.** Use `MidpointRounding.AwayFromZero` in one place (`Rounding.cs`). UI-SPEC's `Math.round(n*100)/100` equals AwayFromZero for positive values, but IEEE-754 doubles can still differ by a centavo in rare cases (for example `1.005`). The server is authoritative and the client only previews. Add a shared fixture test so both sides agree on the ORD-2026-0148 and ORD-2026-0151 figures.

**Discount cardinality (C-1).** Model `Discounts` as a collection with `OrderRules.MaxDiscountsPerOrder` (1 per PRD, or unlimited per UI spec). The invariant is Σ discount ≤ ItemsTotal. Either owner ruling is then a constant change, not a schema change.

**Concurrency: the root rowversion must move when only children change.** SQL `rowversion` changes only when *that row* is updated. EF puts the token in the WHERE clause only for rows it actually UPDATEs or DELETEs [EF concurrency docs; seam LOW, first-party]. Adding a payment inserts a `Payments` row and, unless the root is touched, never checks `Orders.RowVersion`. Two staff could then each add a payment that's "within balance" and together overpay (OD-4). Fix it with an `AggregateRootTouchInterceptor`. On `SavingChanges`, for every Added/Modified/Deleted child entry, find the tracked `Order` by `OrderId` and set `UpdatedAt`/`UpdatedBy`. That always marks the root Modified, so EF issues `UPDATE Orders … WHERE Id=@id AND RowVersion=@original`. Disconnected clients send `rowVersion` (base64, or `If-Match`). The repository sets `entry.Property(o => o.RowVersion).OriginalValue = expected` after loading. Every child mutation returns the full `OrderDetailDto` with the new rowVersion, so the detail page always holds the current token.

```csharp
internal sealed class AggregateRootTouchInterceptor(TimeProvider time, ICurrentUser me) : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData e, InterceptionResult<int> r, CancellationToken ct = default)
    {
        var tracker = e.Context!.ChangeTracker;
        var touched = tracker.Entries<IOrderChild>()
            .Where(x => x.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Select(x => x.Entity.OrderId).ToHashSet();
        foreach (var root in tracker.Entries<Order>().Where(o => touched.Contains(o.Entity.Id)))
            root.Entity.MarkUpdated(time.GetUtcNow(), me.UserId);   // changes a column → root UPDATE with rowversion check
        return base.SavingChangesAsync(e, r, ct);
    }
}
```

**Order numbers (C-15): a per-year counter table, not a SQL SEQUENCE.** Requirements: `ORD-{YYYY}-{NNNN}` sequential per year (UI spec), DB-generated and concurrency-safe (the intent of the PRD's "SQL SEQUENCE"), and legacy numbers preserved. A single SEQUENCE can't reset per year. Per-year sequences would need runtime DDL, which breaks the least-privilege login (PRD §19.2), and they leave gaps on rollback. Recommended design:
- Table `OrderNumberCounters(Year int PK, LastValue int)`, created by migration.
- `IOrderNumberGenerator.NextAsync(year)` runs inside the create transaction via a parameterized `DbCommand` on the context's connection:
  `MERGE dbo.OrderNumberCounters WITH (HOLDLOCK) AS t USING (SELECT @year AS [Year]) s ON t.[Year]=s.[Year] WHEN MATCHED THEN UPDATE SET LastValue = t.LastValue + 1 WHEN NOT MATCHED THEN INSERT ([Year], LastValue) VALUES (s.[Year], 1) OUTPUT inserted.LastValue;`
  This is gapless because a rollback also rolls back the increment. It's serialized per year, and contention at shop scale is nil.
- `Year` = the business-time-zone year at creation (`IBusinessCalendar`), not `OrderDate` (which can be back-dated). Confirm with the owner as part of C-15.
- Format with `D4` as a *minimum* (`ORD-2026-10000` if a year ever overflows; never truncate). There's a unique index on `Number`.
- `OrderNumber.Rehydrate` accepts any legacy format verbatim (a `IsLegacy` flag; nullable `LegacyOrderNumber` column added in the import phase). The ETL sets each year's counter to max(legacy NNNN) when legacy numbers share the ORD- format.
- This is a deliberate deviation from the PRD's literal "SEQUENCE". Record it as the C-15 resolution at the Orders discuss step.

**Create flow (C-3).** `POST /orders` accepts details + `items[1..n]` plus *optional* `payments[]`, `discounts[]` and `expenses[]` in one transaction. That's the PRD superset. The UI-spec form sends only details + items. One endpoint satisfies both documents.

**Legacy-import path.** Add `Order.Import(...)` from the start: a factory that accepts historical facts that new-entry rules would reject (past due dates, overpayments, statuses outside the transition table) and flags them. Without it, the late legacy phase may find data the invariants refuse, forcing domain changes after hardening.

**Images: 5-per-order in the domain and the DB.** The domain checks the count, and the root-touch rowversion makes the check race-free. For DB defence in depth: `CHECK (SortOrder BETWEEN 0 AND MaxImages-1)` + `UNIQUE (OrderId, SortOrder)`. Reorder must be a **single** UPDATE statement (a CASE over ids via `ExecuteUpdateAsync` or reviewed interpolated `ExecuteSql`). Otherwise EF's per-row UPDATEs collide on the unique index mid-batch.

### Pattern 3: Read-side query ports (no N+1, no IQueryable leakage)

**What:** Application declares `IOrderQueries.ListAsync(OrderListQuery) → PagedResult<OrderListItemDto>`. Infrastructure implements it with `AsNoTracking().Where(...).OrderBy(...).Select(o => new OrderListItemDto(...))`. The cover image is `o.Images.OrderBy(i => i.SortOrder).Select(i => i.PublicId).FirstOrDefault()`, which translates to one correlated `TOP(1)` subquery in the same statement. Totals come straight from the snapshot columns. The query is two SQL statements (count + page).
**Enforcement:** a `DbCommandInterceptor` in integration tests counts commands per request and asserts ≤ 2 on list endpoints (PRD §7.1).
**SPIKE (Phase 1/Orders):** prove that `Sum(p => p.Amount.Amount)` and `OrderBy(o => o.Totals.Balance.Amount)` over nested struct complex types translate on EF 10. If they don't, map `Money` as a value converter and keep a raw `decimal` shadow for queries.

### Pattern 4: Endpoint groups, default-deny, and discovery-driven authorization tests

```csharp
// Server/Composition
services.AddAuthorization(o =>
{
    o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();   // safety net
    o.AddPolicy(Policies.Staff,   p => p.RequireAuthenticatedUser().RequireRole(Roles.Admin, Roles.Manager).AddRequirements(new ActiveSessionRequirement()));
    o.AddPolicy(Policies.Manager, p => p.RequireAuthenticatedUser().RequireRole(Roles.Manager).AddRequirements(new ActiveSessionRequirement()));
    o.AddPolicy(Policies.Maintenance, p => p.AddAuthenticationSchemes("MaintenanceKey").RequireAuthenticatedUser());
});

// Server/Endpoints/ApiRouting.cs
var api     = app.MapGroup("/api/v1").AddEndpointFilter<CorrelationFilter>();
var anon    = api.MapGroup("").AllowAnonymous();                       // AllowAnonymous WINS over RequireAuthorization
var staff   = api.MapGroup("").RequireAuthorization(Policies.Staff);
var manager = api.MapGroup("").RequireAuthorization(Policies.Manager);
AuthEndpoints.MapAnonymous(anon.MapGroup("/auth").RequireRateLimiting(RateLimits.Auth));      // login, 2fa, refresh, forgot, reset
AuthEndpoints.MapAuthenticated(staff.MapGroup("/auth"));                                       // sessions/revoke-all, me
OrdersEndpoints.Map(staff.MapGroup("/orders"));
UsersEndpoints.Map(manager.MapGroup("/users"));
PublicContentEndpoints.Map(anon.MapGroup("/public").CacheOutput(OutputPolicies.PublicContent));
SiteContentEndpoints.Map(manager.MapGroup("/site"));
ConsentEndpoints.Map(anon.MapGroup("/consent").RequireRateLimiting(RateLimits.Public));
MaintenanceEndpoints.Map(api.MapGroup("/maintenance").RequireAuthorization(Policies.Maintenance));
api.MapFallback(() => TypedResults.Problem(statusCode: 404)).AllowAnonymous();   // unknown /api/* must NOT return index.html
```

Verified: once a `FallbackPolicy` exists, **static-asset endpoints are subject to it**. Docs prescribe `app.MapStaticAssets().Add(b => b.Metadata.Add(new AllowAnonymousAttribute()))` [ASP.NET Core static files, aspnetcore-10.0 moniker; seam LOW, first-party]. The SPA fallback endpoint needs the same treatment, or every public page returns 401.

**Discovery (the authorization matrix finds endpoints by itself):**
1. *Architecture/integration test* boots `WebApplicationFactory<Program>`, resolves `EndpointDataSource` and enumerates every `RouteEndpoint` whose pattern starts with `/api/`. It asserts that each endpoint has **exactly one** of: `IAllowAnonymous` metadata *and* membership in the checked-in `AnonymousEndpoints` allow-list, or ≥ 1 `IAuthorizeData` whose `Policy` is a `Policies.*` constant. A missing policy or an unexpected anonymous endpoint fails the build.
2. *Matrix completeness test:* `AuthorizationMatrix.cs` is a table keyed by `"{METHOD} {route pattern}"` with an expected status for {Anonymous, Admin, Manager} and a request factory for the allowed cases. The test fails if a discovered endpoint has no row, or a row has no endpoint. Adding an endpoint therefore forces the author to declare its expectations.
3. *Matrix execution:* a theory over rows × principals. It uses **real JWTs** minted by `Csps.Testing` with the test signing key, plus a seeded session row, so bearer validation and the session-revocation check are exercised too. No fake auth handler.

### Pattern 5: Transport-agnostic auth (Application issues, Server delivers)

Application handlers return `SignInOutcome` / `SessionTokens` records (access token, refresh token plaintext, expiries, pending-ticket id). Only Server decides *how* they travel. `AuthCookieTransport` (web, now) sets cookies and returns the access token in JSON. `AuthBodyTransport` (Android, later) returns everything in JSON and ignores cookies. Each request declares `client: "web" | "mobile"`. Cookie endpoints require the anti-CSRF header, and body endpoints never read cookies. An Application unit test asserts no handler references any HTTP type (the NetArchTest rule already forbids ASP.NET Core in Application).

### Pattern 6: Outbox-style idempotent maintenance jobs (shared hosting)

No `BackgroundService`: app pools idle and recycle. Instead:
- *Work tables* are written in the same transaction as the business change: `PendingImageDeletions(PublicId PK, RequestedAt, Attempts, LastError, DoneAt)`, raw analytics rows with timestamps, expired sessions and challenges.
- *Job endpoint* `POST /api/v1/maintenance/{job}` sits behind the `MaintenanceKey` scheme. It does a fixed-time compare of the `X-Maintenance-Key` header against a secret in host configuration, and rate-limits. It acquires `IJobLease` (`UPDATE JobLeases SET LeasedUntil=@now+2min WHERE Job=@j AND LeasedUntil<@now`), processes a bounded batch (≤ ~20 s wall time), and returns `{ processed, remaining }`.
- *Idempotency:* Cloudinary `destroy` of an already-missing id counts as success. Analytics roll-up uses `MERGE` keyed by (date, path). Purges are `DELETE TOP (n) … WHERE …`. A second concurrent cron call just fails to get the lease and returns 202 with nothing to do.
- *Scheduler:* `.github/workflows/maintenance-cron.yml` (e.g. every 30 min) loops while `remaining > 0`, max N iterations. GitHub cron is best-effort and can run late, so nothing user-facing may depend on job latency. SmarterASP also sells an "MSSQL Job" add-on [smarterasp.net; websearch MEDIUM]. It can't call Cloudinary, so it's at most a backup for pure-SQL purges. Not recommended as primary, because it moves logic out of tested code.

### Pattern 7: Server-shaped `index.html` for public routes

Facebook's link-preview scraper (the main traffic source) doesn't run JavaScript, so per-page `<title>`, meta description, Open Graph tags and `LocalBusiness` JSON-LD (PUB-04) must be in the **initial HTML**. `SpaHost` serves `index.html` from a cached template and injects, per known public route, meta + OG + a JSON-LD data block built from `SiteSettings` (HybridCache, invalidated when a Manager edits content). It can also embed a `<script type="application/json" id="csps-boot">` with site settings, which removes one request from the LCP path. Unknown public paths get the same shell with HTTP **404** (no soft 404s). `/admin/*` gets `X-Robots-Tag: noindex`. **SPIKE:** confirm that data-block scripts (`type="application/ld+json"`, `application/json`) don't trip `script-src 'self'` in all three engines. If they do, use a CSP hash for the injected block.

---

## Data Flow

### Request flow (staff mutation)

```
OrderDetail page ─ useAddPayment() ─ api.orders.addPayment(id, body, rowVersion)
    → httpClient: +Authorization: Bearer <mem token> +X-CSPS-Request +X-Correlation-Id
    → IIS/ANCM → CorrelationId → SecurityHeaders → RateLimiter → JwtBearer
    → session check (sid active? cached ≤ 30 s) → Policy "Staff" → OrdersEndpoints.AddPayment
    → AddPaymentHandler: validate → repo.GetForUpdateAsync(id, rv) (split query) → order.AddPayment()
        → RecalculateTotals() → uow.SaveChanges (interceptors: audit stamps, root touch)
        → UPDATE Orders … WHERE RowVersion=@rv ; INSERT Payments …       (one transaction)
    ← Result<OrderDetailDto>  → 200 JSON (totals + new rowVersion)  | 409 ProblemDetails | 422 | 400
← TanStack: setQueryData(qk.orders.detail(id)), invalidate qk.orders.lists(), qk.dashboard.*
← toast "Payment added" / "Balance now ₱…" (value from the server DTO, never from client math)
```

### Auth flow

```
1  POST /auth/login {email, password, rememberMe, client:"web"}
     → IIdentityService.CheckPassword (lockout on failure; dummy hash for unknown email; equal timing)
     → fail: 401 generic ProblemDetails "Invalid email or password"   (deactivated → same 401, CWE-204 vs C-8)
     → ok:  TwoFactorChallenge{UserId, TicketHash, CodeHmac, ExpiresAt=+15m, Attempts=0, Sends=1, RememberMe}
            ISecondFactorDelivery.Send(code)  ; audit "2fa.issued"
            Set-Cookie: __Secure-csps_2fa=<ticket>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=900
            200 {status:"SecondFactorRequired", expiresAt, resendAvailableAt}
2  POST /auth/2fa/verify {code}  (+ ticket cookie, + X-CSPS-Request)
     → load challenge by SHA-256(ticket); bound to UserId; FixedTimeEquals(HMAC(code), CodeHmac)
     → wrong: Attempts++ (5 → invalidate) 400 ; expired/used: 400 generic
     → ok:  challenge consumed; UserSession{Id=sid, UserId, AbsoluteExpiry = rememberMe ? +90d : +12h}
            RefreshToken{FamilyId=sid, Hash, CreatedAt} ; JWT{sub, role, sid, jti, exp=+15m}
            Set-Cookie: __Secure-csps_rt=<rt>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth
                        [Expires=family expiry only if rememberMe; else session cookie]
            clear 2fa cookie ; audit "signin.success" ; 200 {accessToken, expiresAt, me}
3  POST /auth/refresh  (+ rt cookie, + X-CSPS-Request; Sec-Fetch-Site must be same-origin if present)
     → token by hash → UserSession.Rotate(presented, now):
         current & valid     → consume, issue successor, new JWT, Set-Cookie(new rt)
         consumed ≤ 20 s ago and successor is the family head → benign tab race: new JWT only, no cookie change
         consumed otherwise  → REUSE: revoke family, audit "session.reuse_detected", 401
         family revoked/expired, user inactive, security stamp changed → 401
4  POST /auth/logout → revoke family, expire cookies. POST /auth/sessions/revoke-all (bearer) → revoke all families.
   Password change/reset, role change, deactivation → revoke all families (USER-05, AUTH-09/10).
```

- **`__Host-` isn't possible here.** The `__Host-` prefix requires `Path=/`, and the PRD scopes the refresh cookie to `Path=/api/v1/auth`. Use `__Secure-`, as PRD §8.1's own fallback allows. (Cookie-prefix rules per RFC 6265bis / MDN: training knowledge, HIGH.)
- **"Immediate" revocation (USER-05, AUTH-10) needs a per-request session check.** A 15-minute JWT outlives a revocation. `JwtBearerEvents.OnTokenValidated` (or the `ActiveSessionRequirement` handler) checks `sid` against `UserSessions`. Cache it in-process for ≤ 30 s and evict on revoke. A single IIS worker makes an in-memory cache coherent.
- **Durable limits in the DB, coarse limits in memory.** In-memory rate limiters reset on app-pool recycle. Lockout (Identity), 2FA attempts and the resend quota (5/hour/account, AUTH-04) must be persisted columns. The `Microsoft.AspNetCore.RateLimiting` per-IP windows are the coarse layer on top.
- **Anti-CSRF.** `SameSite=Strict` + required custom header `X-CSPS-Request: 1` on cookie-bearing endpoints, with CORS kept disabled so cross-origin JS can't send custom headers, + a `Sec-Fetch-Site` check. Bearer endpoints are inherently CSRF-immune. The upload endpoint binds `IFormFile`, so on .NET 10 it carries antiforgery metadata. Call `.DisableAntiforgery()` with a comment, because it's bearer-authenticated, which the docs explicitly allow [anti-request-forgery docs; seam LOW]. The "automatic Fetch-Metadata CSRF middleware" on the current docs page is a **.NET 11 preview** feature [startdebugging.net, July 2026; websearch MEDIUM]. Don't rely on it on .NET 10 LTS.
- **Bootstrap.** Production starts with zero users. Add a Server CLI verb (`Csps.Server bootstrap-manager --email …`) that creates the first Manager and emails an invitation, using the same set-password-by-token flow as reset (Phase 2).

### SPA session and refresh single-flight

```
App boot on /admin/* → RequireSession → api.auth.refresh() once (restores in-memory token after reload)
                         ├ 200 → tokenStore.set(); render AdminLayout
                         └ 401 → navigate /admin/login?returnUrl=<local path only>   (CWE-601)
Public routes never call /auth/* (the cookie path keeps the refresh cookie off other requests anyway).

httpClient response 401 (not from /auth/*):
   refreshPromise ??= navigator.locks.request('csps-refresh', () => api.auth.refresh())   // cross-tab single-flight
   await refreshPromise → retry the original request once with the new token
   refresh failed → tokenStore.clear(); BroadcastChannel('csps-auth').postMessage('signed-out'); navigate login
```

The Web Locks API serializes refreshes across tabs. The server's 20-second "benign race" window covers the leftover case where two tabs sent the same cookie before either response landed. Without both, a staff member with two tabs open can trip reuse detection and be signed out. That's a classic rotating-refresh-token failure.

### Image pipeline

```
ImageUploader (UI spec) → client downscale (createImageBitmap → canvas, ≤ 2560 px, re-encode JPEG/WebP; HEIC passes through)
  → create flow: order saved FIRST, then the queued files upload one per request (no orphan staging)
  → POST /orders/{id}/images  multipart, one file, bearer, DisableAntiforgery, size limit 10 MB (+ IIS maxAllowedContentLength)
  → handler: load aggregate (rowversion) → order.CanAddImage() (≤ Max) → ImageSignatureSniffer (JPEG FFD8FF, PNG 89504E47,
             WebP RIFF….WEBP, HEIC ftyp heic/heix/mif1; reject SVG/everything else; extension and Content-Type ignored)
  → IImageStorage.UploadAsync(stream, publicId = "csps/orders/{orderId}/{random-128-bit}", type, incoming transformation
             c_limit,w_2560,h_2560 (normalises dims, re-encodes → strips EXIF/GPS), eager variants if authenticated)
  → order.AddImage(publicId, w, h, bytes, format, alt) → SaveChanges
       └ DB failure (409/limit race) → compensate: destroy publicId now; on failure insert PendingImageDeletions row
  → 201 OrderDetailDto (image DTOs carry server-built variant URLs: thumb 88/176, card 400/800, detail 800/1200/1600, blur 32)
Delete image/order → same transaction inserts PendingImageDeletions → cron job destroys → marks done (retry with attempts)
Weekly orphan sweep: Admin API list prefix csps/orders/, delete resources not in DB and older than 24 h (rate-limited API).
```

**OD-9 has an architectural consequence the PRD doesn't mention.** Cloudinary's docs say: *"You can't create on-the-fly transformations for authenticated assets… only access derived assets that were generated ahead of time during upload or update using eager transformations."* Signed delivery URLs **don't expire** unless the account is on the Advanced plan or above (token-based access) [cloudinary.com/documentation/control_access_to_media; seam LOW, first-party, quoted verbatim]. So:
- **Authenticated (PRD recommendation):** fix the variant set in `ImageVariants.cs` and generate it eagerly at upload. Deliver explicit `f_webp` variants rather than relying on on-the-fly `f_auto`. WebP covers "last 2 versions" of all target browsers, so no JPEG fallback is needed. The server builds signed URLs. The protection is "unguessable and non-transformable", not "expiring".
- **Upload/public + strict transformations:** on-the-fly `f_auto,q_auto,w_*`, random 128-bit public ids. Similar practical secrecy, simpler.
- Recommendation: put both options to the owner at the Order-images discuss step with this trade-off. If they choose authenticated, the eager list and URL builder are a Phase-5 plan item, and adding a breakpoint later means re-deriving existing images (a maintenance job).

### Analytics and consent

```
First visit → CookieBanner (nothing non-essential set) ── GPC (navigator.globalPrivacyControl / Sec-GPC: 1) ⇒ treated as Reject
  Accept/Reject/Customize → POST /consent {analytics, policyVersion}
     → ConsentRecord{ConsentId (random), choices, policyVersion, at, gpc}   (proof of consent, no IP)
     → Set-Cookie csps_consent=<id.version.choices> (12 mo, readable by JS for UI state; server is authority)
     → if analytics: Set-Cookie csps_vid=<uuid>; HttpOnly; Secure; SameSite=Lax; Max-Age ≤ 12 mo
Route change (public routes only; admin not tracked) → navigator.sendBeacon('/api/v1/analytics/pv', {path, ref})
  → server re-checks consent cookie + Sec-GPC
     consented  → PageView{VisitorId, SessionId (30-min inactivity, server-derived), path (allow-listed pattern, no query),
                   referrerHost, device/browser/os family (in-house parser, GeneratedRegex), at}
                   + IpTag = HMAC(truncate(ip)/24 or /48, dailySalt) — used only for dedupe/abuse, salt rows deleted after 48 h
     no consent → MERGE DailyPageStats(Date, Path) Count+1     (no cookie read/write, no identifier, no IP)
Clear my data → POST /consent/clear → delete PageViews for vid, expire csps_vid/csps_consent (Set-Cookie past date),
                client clears local/session storage; withdrawal itself logged as a ConsentRecord
Jobs: analytics-rollup (raw > 13 mo → DailyPageStats, then delete), salt-rotation, consent-retention
Manager metrics: IMetricsQueries over PageViews ∪ DailyPageStats; CSV export endpoint; RUM web-vitals only with consent
```

### Legacy ETL (tools/Csps.LegacyMigration)

```
_local/*.bak ──restore (legacy phase only)──▶ LocalDB  CSPS_Legacy_Restore   (read-only login, ApplicationIntent=ReadOnly)
                                                    │ LegacyReader (Microsoft.Data.SqlClient, hand-written SELECTs, batched by key)
                                                    ▼
                                    Mapping (pure functions, unit-tested against synthetic rows, no real data)
                                                    │  → Order.Import(...) / CompanyExpense.Import(...) (domain validates, flags anomalies)
                                                    ▼
          fresh DB created by EF migrations (CSPS_Import_Rehearsal, or the production CSPS DB at cutover)
             upsert by LegacyId (nullable, filtered UNIQUE WHERE LegacyId IS NOT NULL) → re-runs are idempotent
             one transaction per batch; --dry-run rolls back each batch; counters set to max legacy NNNN per year
             legacy images → Cloudinary with deterministic public id csps/orders/{orderId}/legacy-{legacyKey}, overwrite=false
                                                    ▼
          reconcile: counts per entity; Σ items, Σ payments, Σ discounts, Σ order expenses, Σ company expenses;
                     per-order Total/Paid/Balance legacy vs new; every transformed/rejected row with reason
             → summary (aggregates only) may go in .planning/; per-row report (has customer data) stays in _local/
```

- **Naming conflict (C-20).** CLAUDE.md says "restore the `.bak` into LocalDB as `CSPS_Dev`". PRD §16.1 says `CSPS_Legacy_Restore`. Restoring as `CSPS_Dev` would overwrite the code-first dev database and blur Prime Directive 11. Recommend `CSPS_Legacy_Restore` in LocalDB (it keeps the `CSPS_` prefix, so it still follows CLAUDE.md's prefix rule) and ask the owner to amend that CLAUDE.md line.
- LocalDB here is **SQL Server 2025 17.0.4025.3** (checked with `sqllocaldb versions`), so a legacy backup from an older engine restores fine.
- **Cutover option worth offering:** run the ETL locally into `CSPS_Import`, reconcile, back it up, and restore that backup on SmarterASP via the control panel. That avoids a long ETL over the internet and makes the rehearsal byte-identical to cutover. This needs the host DB to be SQL Server 2025, because a 17.x backup can't restore to an older engine. The host advertises 2025, but confirm the actual instance.

### Frontend state

```
Server state: TanStack Query (cache) ← query fns are api.ts functions (AbortSignal passed through)
UI state:     component state; theme in localStorage['csps-theme']; orders view in localStorage['csps-orders-view']
Auth state:   lib/http/tokenStore (module memory) + AuthProvider (me DTO) — never localStorage
Consent:      lib/consent.ts (cookie-backed) — gates the analytics tracker module (lazy-loaded only when consented)
```

Query keys (`lib/queryKeys.ts`) use hierarchical factories, so invalidation is prefix-based:
`qk.orders.all → ['orders']`, `.lists() → ['orders','list']`, `.list(f)`, `.detail(id)`; `qk.expenses.list(f)`, `qk.expenses.summary(period)`; `qk.dashboard.summary(months)`; `qk.users.list(f)`; `qk.me`; `qk.site.settings`, `qk.site.prices`; `qk.metrics.summary(range)`; `qk.audit.list(f)`.
Lists use `placeholderData: keepPreviousData`, a 300 ms debounced search and `staleTime` ≈ 30 s. Public content has a long `staleTime` (it's server-cached). No optimistic updates for money. Mutations apply the server's returned DTO.

`api.ts` is grouped by area and returns typed DTOs from `types/api.gen.ts`:

```ts
export const api = {
  auth:     { login, verifyCode, resendCode, refresh, logout, revokeAll, forgot, setPassword },
  orders:   { list: (q: OrderListQuery, signal?: AbortSignal) => http.get<Paged<OrderListItemDto>>('/orders', { params: q, signal }),
              detail, create, update, remove,
              addPayment: (id: string, b: AddPaymentRequest, rv: string) =>
                http.post<OrderDetailDto>(`/orders/${id}/payments`, b, { headers: { 'If-Match': rv } }),
              /* items, discounts, expenses, images (upload uses onUploadProgress → XHR transport) */ },
  expenses: { … }, users: { … }, profile: { … }, dashboard: { summary },
  site:     { publicSettings, publicPrices, updateSettings, prices: { … } },
  consent:  { save, clear }, analytics: { pageView /* sendBeacon wrapper lives in http layer */ }, metrics: { … }, audit: { list },
} as const;
```

**Bundle budgets (150 KB public / 250 KB admin gz).**
- `router.tsx` statically imports only the two layouts' *loaders*. Every page uses React Router's `lazy`. Since v7.5 the object form (`lazy: { Component: async () => … }`) loads properties independently [remix.run "faster lazy loading", React Router 7.5 changelog; websearch MEDIUM]. The UI spec pins react-router 8.x, which keeps the API.
- Heavy admin pieces (chart, ImageUploader, OrderForm) are separate lazy chunks.
- **Risk:** `src/ui/index.tsx` is one module holding *every* design-system component. Rollup tree-shakes unused exports, but a module shared by the public and admin chunks lands in one shared chunk with the union of used exports. Admin components used anywhere can therefore inflate the public initial load. Measure it in Phase 1 with `scripts/check-budgets.mjs` (Vite `build.manifest: true` + gzip of each route's static import closure; no new dependency). If the public route breaks budget, ask the owner to approve splitting `ui/index.tsx` into per-component files re-exported from `ui/index.ts`. That's identical markup and only a file-layout deviation, so mark it `// SPEC-GAP`.

---

## Test Architecture

### Database for integration tests: C-20 reconciled

| | LocalDB (`CSPS_Test_<guid>`) | Testcontainers (`mssql/server:2025-latest`) |
|---|---|---|
| Engine parity | SQL Server 2025 17.0.4025.3 here (verified) | SQL Server 2025 17.x Linux [websearch MEDIUM] |
| This machine | Installed; obeys CLAUDE.md naming; no Docker needed | Docker 29.8.1 (Linux engine, verified) works |
| GitHub `windows-2025` runner | **Not installed** (runner README lists no LocalDB) [websearch MEDIUM] | Windows runners can't run Linux containers |
| GitHub `ubuntu-latest` runner | Not available | Works (the standard path) |
| Isolation | One DB per run/collection; manual cleanup of crashed runs | Disposable container; nothing left behind |
| Shared-machine risk | Must never touch `BetsLLC_*` (prefix-guarded fixture + cleanup script) | None: own container and port mapping (random host port is in the dynamic range, but Testcontainers handles that and there's no fixed listener) |
| Speed | Fast startup | ~10–20 s container start per run (cached image) |

**Recommendation: one fixture, two providers.**
- `Csps.Testing.SqlFixture` reads `CSPS_TEST_SQL=localdb|container`, defaulting to `container` when `CI=true` and `localdb` otherwise.
- Both create a database named `CSPS_Test_<guid>`, apply **EF migrations** (never `EnsureCreated`, since migrations are the thing under test), reset with Respawn between tests (tables-to-ignore: `__EFMigrationsHistory`, `OrderNumberCounters` is reset too) and drop the DB at the end.
- In xUnit v3, use an assembly/collection fixture with DB-touching tests in one non-parallel collection per assembly.
- `tools/scripts/Drop-StaleTestDbs.ps1` drops only `^CSPS_Test_[0-9a-f-]{36}$`.
- This satisfies the PRD (Testcontainers SQL 2025 in CI) and CLAUDE.md (LocalDB names locally), on the same engine version.

### WebApplicationFactory setup

- `Program` has `public partial class Program;`.
- `CspsApiFactory : WebApplicationFactory<Program>` sets environment `Testing` and connection string → fixture DB. In `ConfigureTestServices` it swaps `TimeProvider` → `FakeTimeProvider`, `IEmailSender` → `InMemoryEmailSink`, `IImageStorage` → a fake (Cloudinary is covered by a separate opt-in contract test), and `IBreachedPasswordChecker` → a stub.
- Test JWTs are minted with the test signing key (see Pattern 4).
- Set `WebRootPath` to a fixture folder containing a stub `index.html`. `wwwroot` is gitignored build output, so the SPA-fallback tests must not depend on a web build.
- A `DbCommandInterceptor` counts queries (N+1 guard).

### Testing-only email sink (must not exist in Release builds)

PRD §14 allows "compiled out of Release builds or registered only when `Testing`". Playwright (Node) has to read codes from a *running* server, so a test-assembly-only override isn't enough. Recommended:
- `src/Csps.Server/Testing/*` is wrapped in `#if CSPS_TESTING`, and is also registered only when `IsEnvironment("Testing")` (two independent guards). It holds `InMemoryEmailSink` and `GET /_test/emails?to=` / `POST /_test/reset` (Respawn + E2E seed).
- The E2E artifact is `dotnet publish src/Csps.Server -c Release -p:CspsTestingHooks=true -o artifacts/e2e`. The production artifact is a plain `dotnet publish -c Release`.
- **Verification test** (CI, after the production publish): load `artifacts/prod/Csps.Server.dll` in a `MetadataLoadContext` and assert there's no type in `Csps.Server.Testing`. Boot the production artifact's DI under `Production` and assert no endpoint pattern starts with `/_test`.
- Alternative to evaluate: a separate .NET host wrapping `WebApplicationFactory<Program>` with Kestrel. `WebApplicationFactory` in .NET 10 has Kestrel support fields per source.dot.net [websearch MEDIUM]. That keeps test code out of `src/` entirely, but static-asset manifest resolution through the factory is unproven (SPIKE).

### Playwright on 5199

`playwright.config.ts` → `webServer: { command: 'dotnet artifacts/e2e/Csps.Server.dll --urls https://localhost:5199', url: 'https://localhost:5199/health', reuseExistingServer: false, ignoreHTTPSErrors: true, env: { ASPNETCORE_ENVIRONMENT: 'Testing', ConnectionStrings__Csps: '…Database=CSPS_E2E…' } }`.
- Env vars are set **only for that child process**, as CLAUDE.md allows.
- Use HTTPS, not HTTP, because `__Secure-` cookies need a secure origin and WebKit's treatment of `http://localhost` as secure isn't something to bet the auth tests on (SPIKE: confirm all three engines).
- Run preflight (`preflight.ps1 -Ports 5180,5115,7028,5199`) before every run.
- Fail on any console warning or error.
- Each spec calls `/_test/reset` in `beforeAll`.

---

## Deployment Topology (SmarterASP.NET)

```
GitHub Actions (ubuntu): web build → dotnet build/test → publish (prod) → artifact
                         + dotnet ef migrations script --idempotent → artifact (reviewed by owner)
  deploy.yml: Web Deploy (msdeploy) with app_offline.htm → STAGING site (subdomain/second site)
              → smoke E2E + ZAP baseline → manual approval → PRODUCTION site
SmarterASP IIS site (per environment): ANCM in-process, single worker, wwwroot = SPA, web.config:
  hostingModel="inprocess", remove Server/X-Powered-By, HTTPS redirect, requestFiltering maxAllowedContentLength,
  static cache rules (/assets/* immutable 1 y, index.html no-cache), compression
SQL Server 2025 DB per environment (CSPS staging / CSPS prod); app login least-privilege if the plan allows a second login
Secrets: host environment variables or a server-only appsettings.Production.json (never in git)
Data Protection: PersistKeysToDbContext<CspsDbContext>() + SetApplicationName("CSPS") + explicit at-rest protection (X.509 if available)
```

- **.NET 10 and SQL Server 2025 are advertised** by SmarterASP.NET [smarterasp.net home and ASP.NET Core pages; websearch MEDIUM]. In-process hosting, staging-subdomain sites, env-var configuration and app-pool memory limits are **not documented** there. Confirm them in the control panel in Phase 1 (gap).
- **Data Protection keys:** an explicit persistence location turns off the default at-rest key encryption. Docs recommend configuring encryption explicitly in production [key storage providers; seam LOW, first-party]. On shared hosting with no certificate store access, record the residual risk (keys sit in the DB, readable by the app login) rather than silently ignoring it.
- **Migrations:** a reviewed idempotent script after a backup, never on startup. Any `migrationBuilder.Sql` that creates a TRIGGER, PROCEDURE or VIEW (the append-only audit trigger) must be wrapped in `EXEC(N'…')`. Idempotent scripts put each migration inside `IF NOT EXISTS … BEGIN … END`, and `CREATE TRIGGER` must be first in its batch. (EF docs, training knowledge: HIGH. Verify in the Phase 1 migration test by running the generated idempotent script against an empty DB in CI.)
- **Static assets:** `MapStaticAssets` serves only files present in the **build-time** manifest and gzip/brotli-precompresses them at publish [static files docs; seam LOW, first-party]. So `npm run build` (into `wwwroot`) **must run before** `dotnet publish`. Files appearing later are served through a runtime fallback that logs a warning, which breaks the zero-warnings rule. MapStaticAssets fingerprints with its own hash and marks only its fingerprinted URLs `immutable`. Vite's own hashed names (referenced by `index.html`) may be served `no-cache` + ETag. **SPIKE (Phase 1):** inspect the headers. If they aren't immutable, serve `/assets/*` via `UseStaticFiles` with `OnPrepareResponse` immutable, and keep MapStaticAssets for precompression where it doesn't conflict.
- **Cold starts:** app pools idle out. The first request after idle pays .NET startup plus the EF model build. Mitigations: keep startup lean, consider the EF compiled model (`dotnet ef dbcontext optimize`, regenerated in CI), and have the maintenance cron's runs keep the site warm as a side effect.
- **Client IP:** in-process IIS gives the true remote IP unless SmarterASP fronts sites with a proxy. Confirm before trusting `X-Forwarded-For` (rate limits, audit IP).

### Dev loop: replacing the VS scaffold

Recommended: **two processes, Vite proxy, no SpaProxy.**

| Step | Change |
|---|---|
| Solution | New `Csps.slnx` with only .NET projects. Drop the `.esproj` (it needs the VS JavaScript SDK in CI and adds nothing once Vite builds into `wwwroot`). Delete `CarmensStitchAndPrintingServices.*` after the new skeleton runs. |
| Server | Remove the `Microsoft.AspNetCore.SpaProxy` package, `SpaRoot`/`SpaProxy*` properties and the `ASPNETCORE_HOSTINGSTARTUPASSEMBLIES` entries in `launchSettings.json`. Keep profiles `https` = `https://localhost:7028;http://localhost:5115` and `ASPNETCORE_ENVIRONMENT=Development` (profile-scoped, so allowed). |
| Vite | `server: { port: 5180, strictPort: true, https: <dotnet dev-certs PEM, as the scaffold already does>, proxy: { '/api': { target: 'https://localhost:7028', secure: false }, '/health': { … } } }`. **Hard-code** the target and port: drop the scaffold's reads of `ASPNETCORE_HTTPS_PORT`, `ASPNETCORE_URLS` and `DEV_SERVER_PORT`, so no machine-level variable can ever steer it. `build: { outDir: '../src/Csps.Server/wwwroot', emptyOutDir: true, manifest: true }`. |
| Daily loop | Preflight → `dotnet run --project src/Csps.Server --launch-profile https` + `npm run dev --prefix web` → browse `https://localhost:5180`. Cookies are host-scoped, not port-scoped, so the proxied auth cookies behave as in production. |
| Why not SpaProxy | It launches npm from the .NET process, hides Vite's output and port conflicts, ties the loop to the template's env-var plumbing, and the PRD's production model (SPA built into `wwwroot`, same origin) doesn't need it. |

---

## Suggested Build Order (dependency-driven)

```
F0 Repo & build tooling ──► F1 Domain/Application primitives ──► F2 Persistence core ──► F3 Server host ──► F4 Web shell
                                                                       │                        │
                                                                       ▼                        ▼
                                                          (SiteSettings core, AuditLog,   (httpClient, api.ts, layouts,
                                                           migrations test, dev seed)      budgets, E2E host+smoke)
                                                                       └──────────┬─────────────┘
                                                                                  ▼
                                                     A  Auth (sessions, 2FA, email, token flows, bootstrap)
                                                                                  ▼
                                                     U  Profile + user mgmt + audit viewer
                                                                                  ▼
                              ┌──────────────────────────────────────┬────────────┴───────────────┐
                              ▼                                      ▼                            ▼
                     E  Company expenses                    O1 Orders domain+API           C  Site content model
                      (pattern-proving CRUD)                         ▼                    + public read API
                              │                             O2 Orders UI                          ▼
                              │                                      ▼                    P  Public pages + content mgmt UI
                              │                             I  Order images + job framework       ▼
                              └──────────────┬───────────────────────┘                    K  Consent/analytics/legal
                                             ▼                                                    │
                                     D  Admin dashboard ◄─────────────────────────────────────────┘ (no dep; ordering only)
                                             ▼
                                     H  Hardening (+PWA) ─► L1 Legacy discovery ─► L2 Import ─► L3 Cutover
```

| Step | Depends on | Why it must come first |
|---|---|---|
| F0–F4 Foundation | — | Everything. Include **SiteSettings core** (time zone, currency, locale + `IBusinessCalendar`), the **AuditLog** table/port/trigger, the endpoint-group conventions and the empty authorization-matrix harness, the OpenAPI→TS generation, the budgets script, and the E2E host + one Playwright smoke test. |
| A Auth | F | Every other endpoint needs policies and a real session. The audit trail must already exist because sign-in events are audited. Build forgot/reset **and** invite acceptance here: same set-password-by-token mechanism, plus the bootstrap-manager CLI. |
| U Users/Profile | A | Needs the email flows, session revocation (USER-05) and audit writes. Add the Manager **audit-log viewer** here. |
| E Company expenses | A (U for "Recorded by" names) | The simplest aggregate: rowversion, 409 UI, filters, period totals, ConfirmDialog. It proves the vertical-slice template before the complex Order aggregate. Optional reorder (see below). |
| O1 Orders domain+API | A, F (counter table, calendar) | Aggregate, persisted totals, numbers, concurrency, nested endpoints, matrix rows. |
| O2 Orders UI | O1 | List (grid/table), form (without the Images card), detail with tabs and modals. |
| I Order images | O2, F (job framework lands here) | Needs orders and the detail/form screens. The first real cron job (Cloudinary cleanup) brings the maintenance framework, and token/challenge purge registers on it. |
| D Dashboard | O1, E (I only for thumbnails, optional) | KPIs and chart need payments, order expenses **and** company expenses. Until then `/admin` redirects to `/admin/orders`. |
| C/P Public + content | A (Manager policy), F (SiteSettings core) | Public pages read the content **model** and read API (seeded). The management UI can follow within the phase. Decide the content-model ruling (C-21) and the inquiry-form ruling (C-12) first. |
| K Consent/analytics/legal | P (footer links, public routes to track) | The banner and tracker attach to PublicLayout. The metrics dashboard needs data. |
| H Hardening | all features | ZAP, manual a11y, backup/restore test, runbooks, PWA/service worker, View Transitions. |
| L1–L3 Legacy | H (the app is complete on an empty DB, Prime Directive 11) | Read-only discovery → owner-approved mapping → ETL → reconciliation → rehearsal → cutover. |

### Comparison with PRD §20: ordering problems and corrections

| # | Issue in PRD §20 | Correction |
|---|---|---|
| 1 | **Admin dashboard (UI-SPEC §8.3, C-18) isn't in any phase.** It needs orders, payments, order expenses **and** company expenses, so it can't come before PRD Phase 6. | Add a Dashboard phase after Company expenses (or fold it into Phase 6). Until then, `/admin` redirects to Orders. |
| 2 | **Audit log:** the PRD puts it in Phase 2, but auth is the *first* writer (sign-in success/failure), and the Manager **audit viewer** (PRD §4) has no phase. | Build the AuditLog table, `IAuditTrail` and the append-only trigger in Phase 1 (foundation) or Phase 2's first wave. Put the viewer in Phase 3. |
| 3 | **SiteSettings is "Phase 7", but time zone and currency (OD-1/OD-2) are needed from Phase 1** (formatters, `IBusinessCalendar`), Phase 4 (order-number year, "today", due-date hints) and the dashboard's month boundaries. | Move the SiteSettings entity + seed + read port to Phase 1. Only the management UI stays in Phase 7. |
| 4 | **The price list doesn't need management first, but it does need its model first.** Public pages read the DB-backed content model (seeded). Separately, the PRD links OrderItem to a price-list item, which would make Orders depend on Phase 7. | Within Phase 7: model + public read API + seed → public pages → management screens. Give OrderItem a fixed `ProductType` enum (UI-SPEC §9.5) and drop or defer the price-item FK, so Orders has no Phase-7 dependency. |
| 5 | **Invite acceptance vs bootstrap:** USER-02 invitations are Phase 3, but production has zero users after the Phase 1 staging deploy, and Phase 2 can't be tested on staging without a Manager. | Build the set-password-by-token flow (reset + invite) and a `bootstrap-manager` CLI in Phase 2. Phase 3 adds the invite UI. |
| 6 | **Phase 1 staging deploy is owner-gated** (GitHub remote, secrets, hosting credentials, unknown host details), which could block the whole foundation phase. | Make "CI + staging deploy" the last, separately gated plan of Phase 1, or Phase 1.1, so local foundation work completes independently. |
| 7 | **Phase 4 OrderForm includes an Images card (C-3, UI spec)** that depends on Phase 5. Phase 4 is also very large: aggregate + 5 child types + list + detail + form. | With "fine" granularity, split Phase 4 into **4a domain+API** and **4b UI**. Phase 4b ships the form without the Images card, and Phase 5 adds it. Scope Phase 4's UI review to exclude the card. |
| 8 | **Maintenance/cron infrastructure** has no phase. It's first needed for Cloudinary cleanup (Phase 5), and token purge (Phase 2) is housekeeping. | Build the job framework (lease, key scheme, workflow) in Phase 5. Register auth purges then. |
| 9 | **Performance budgets** are listed under Phase 9 Hardening, but PRD §7.1 says CI enforces them from the start. | Put the budget check (and Lighthouse CI on whatever public page exists) in Phase 1. Phase 9 only audits. |
| 10 | **PWA, View Transitions and the contact inquiry form (C-12)** aren't assigned to phases. | PWA + View Transitions → Hardening (the service worker affects deploy freshness, so test it last). Inquiry form → Phase 7 if the owner approves (it needs an `Inquiry` entity, attachment security CWE-434 for PDF/AI, email routing, retention). |
| 11 | **Legacy discovery comes last (Phases 10–11, per PRD §16 and the PROJECT key decision).** Real data may break domain invariants (C-1 multiple discounts, OD-4 overpayments, OD-3 statuses, OD-7 customers) after hardening. | Keep the PRD order (it's an explicit directive) but de-risk it. Add `Order.Import(...)` and configurable rule constants in Phase 4. Optionally ask the owner whether a *read-only* discovery right after Phase 4 is acceptable. It wouldn't derive the schema from the `.bak`, only check fit. |
| 12 | **Company expenses (6) could precede Orders (4).** | Recommended, not required: move expenses before orders as the pattern-proving slice. If the owner prefers orders first (core value), keep the order and treat the Orders phase as the pattern-setter. |

**Revised phase list (if corrections are adopted):**
1. Foundation (+ SiteSettings core, AuditLog, authz harness, budgets, E2E host). 1.1 CI + staging deploy (owner-gated).
2. Identity & auth (+ token flows, bootstrap, email sink).
3. Profile & user management (+ audit viewer).
4. Company expenses.
5. Orders: domain & API.
6. Orders: UI.
7. Order images + job framework.
8. Admin dashboard.
9. Public site & content management (+ inquiry if approved).
10. Consent, analytics & legal (+ metrics dashboard).
11. Hardening (+ PWA, View Transitions).
12. Legacy discovery & mapping.
13. Legacy import.
14. Production cutover.

**Parallelization flags:** after Phase 3, Company expenses and Orders domain/API are independent, and the Site content model/API is independent of both. Phases 9–10 only need the Manager policy plus SiteSettings core.

---

## Scaling Considerations

| Scale | Architecture adjustments |
|---|---|
| Real target: ~5 staff, thousands of orders/yr, bursty public traffic from Facebook posts | The monolith on one IIS worker is right. In-memory caches are coherent (single instance). Persisted order totals keep lists to one indexed table scan. |
| 10× (a viral post) | The public site is static SPA + output-cached content endpoints. The analytics ingestion is the only per-view DB write, so rate-limit it, keep the payload tiny and fall back to aggregate-only on overload. |
| Beyond shared hosting | Move off SmarterASP (VPS/App Service) before splitting anything. The port boundaries already allow it. |

### Scaling priorities

1. **First bottleneck: cold start after app-pool idle** (LCP on the first Facebook click). Lean startup, EF compiled model, and cron traffic as an incidental warm-up.
2. **Second: upload bandwidth and memory** (10 MB images proxied through the server). Client-side downscaling before upload, one file per request, and stream to Cloudinary after sniffing the first bytes.
3. **Third: DB size limits on the hosting plan.** Analytics raw rows grow fastest, so roll up and purge on schedule (ANL-09). Check the plan's DB quota in Phase 1.

---

## Anti-Patterns

### Anti-Pattern 1: Trusting the root rowversion to cover child changes

**What people do:** add `IsRowVersion()` to `Order` and assume adding a payment is concurrency-checked.
**Why it's wrong:** only rows actually updated are checked. Child inserts never touch `Orders.RowVersion`, so concurrent payments can overpay and nobody gets a 409.
**Do this instead:** the root-touch interceptor (Pattern 2) plus an integration test with two contexts racing `AddPayment`.

### Anti-Pattern 2: Computing totals in the client or in each query

**What people do:** sum children in React (the UI-spec helper makes it tempting) or write ad-hoc `Sum()` subqueries per list/dashboard endpoint.
**Why it's wrong:** divergent rounding, N+1/correlated-subquery costs, and two sources of truth.
**Do this instead:** domain `RecalculateTotals()` → a persisted snapshot. Clients only *preview* with `lib/csps.ts` and always display server figures after a save.

### Anti-Pattern 3: `AllowAnonymous` on a parent group "for convenience"

**What people do:** put `/auth` under an anonymous group, then add `/auth/sessions/revoke-all` with `RequireAuthorization`.
**Why it's wrong:** `AllowAnonymous` metadata wins, so the endpoint is public.
**Do this instead:** separate anonymous and authenticated groups, plus the discovery test that rejects anonymous endpoints not on the allow-list.

### Anti-Pattern 4: Background services on shared hosting

**What people do:** `IHostedService` timers for Cloudinary cleanup, analytics roll-up and token purge.
**Why it's wrong:** app pools idle and recycle, so jobs stop silently or run twice.
**Do this instead:** outbox tables + leased, bounded, idempotent maintenance endpoints driven by cron (Pattern 6).

### Anti-Pattern 5: `BeginTransaction` with a retrying execution strategy

**What people do:** enable `EnableRetryOnFailure`, then call `Database.BeginTransactionAsync()` in the create-order handler (needed for order number + insert).
**Why it's wrong:** SQL Server's retrying strategy rejects user-initiated transactions at runtime. Retries would also re-run non-idempotent work. (EF connection-resiliency docs, training knowledge: HIGH. Re-check in Phase 1.)
**Do this instead:** `IUnitOfWork.ExecuteInTransactionAsync` wraps `Database.CreateExecutionStrategy().ExecuteAsync(...)` around begin/commit, and nothing external (email, Cloudinary) runs inside the retried delegate.

### Anti-Pattern 6: SPA fallback that swallows `/api`

**What people do:** `MapFallbackToFile("index.html")` with nothing else.
**Why it's wrong:** unknown API routes return 200 + HTML. Android clients and the authorization matrix see garbage, and with a fallback policy the SPA itself returns 401.
**Do this instead:** an `/api/{**}` ProblemDetails 404 fallback, an anonymous SPA host with a known-route table, and 404 status for unknown public paths.

### Anti-Pattern 7: Reading the `.bak` "just to check a column name"

**What people do:** peek at `_local/` early to shape entities.
**Why it's wrong:** it violates Prime Directives 1 and 11 and the PROJECT key decision.
**Do this instead:** design from PRD §5 + UI-SPEC §9. Keep `Order.Import` lenient. Raise the early-discovery question with the owner instead of doing it.

---

## Integration Points

### External services

| Service | Integration pattern | Notes |
|---|---|---|
| SQL Server 2025 (host) | EF Core 10, `UseCompatibilityLevel(160)`, reviewed idempotent scripts | Host DB is pre-created by the control panel, so collation is whatever the host set. Check it (case-insensitive search depends on it). One vs two logins (least privilege) is unknown. |
| Cloudinary | `CloudinaryDotNet` server-side signed upload; `IImageStorage` owns public-id scheme and variants | Authenticated type means eager variants only, and signed URLs don't expire below the Advanced plan (verified). The Admin API is rate-limited, so batch the orphan sweep. |
| SMTP (SmarterASP mail) | MailKit, TLS, behind `IEmailSender` | Sender domain + SPF/DKIM/DMARC is OD-12 and blocks real 2FA delivery on staging. |
| HIBP Pwned Passwords | Typed `HttpClient`, range API (first 5 SHA-1 hex chars) | Allow-listed host (CWE-918). Decide fail-open vs fail-closed. |
| GitHub Actions | CI/CD + cron → maintenance endpoint | Cron timing is best-effort. Scheduled workflows in *public* repos are disabled after 60 days of inactivity; the CSPS repo is private. |

### Internal boundaries

| Boundary | Communication | Notes |
|---|---|---|
| Server ↔ Application | Direct DI call to `ICommandHandler/IQueryHandler` | Endpoints never see entities or `DbContext` (arch test). |
| Application ↔ Infrastructure | Port interfaces (Application-owned), DTO returns | No `IQueryable`, no `ApplicationUser` crossing the boundary. |
| Domain ↔ everything | Pure method calls; time/randomness as arguments | `BannedSymbols.txt` + BannedApiAnalyzers make violations compile errors. |
| Web ↔ API | `api.ts` → `httpClient` → `/api/v1` JSON; types from OpenAPI | `types/api.gen.ts` drift check in CI. |
| Tools ↔ App | `Csps.LegacyMigration` references Domain + Infrastructure | Never referenced by `Csps.Server` (arch test). Not in the deploy artifact. |
| Tests ↔ App | `WebApplicationFactory<Program>`, `Csps.Testing` fixtures | Testing hooks only behind `CSPS_TESTING` + the `Testing` environment. |

---

## Open Questions and Spikes for Phase Research

1. SPIKE (Phase 1): EF 10 translation of `Sum`/`OrderBy` over nested struct complex-type `Money` members.
2. SPIKE (Phase 1): MapStaticAssets `Cache-Control` for Vite-hashed files, with `AllowAnonymous` on assets + SPA fallback under the fallback policy.
3. SPIKE (Phase 1): CSP behaviour for injected JSON-LD/boot data blocks in Chromium, Firefox and WebKit.
4. SPIKE (Phase 2): `__Secure-` cookies over the Vite HTTPS proxy and Playwright WebKit on `https://localhost:5199`.
5. Phase 1 (host): confirm SmarterASP in-process hosting, staging-site option, env-var/secret mechanism, DB compat level and collation, DB quota, second SQL login, and whether a proxy sits in front (client IP).
6. Phase 5/7 (owner): OD-9 authenticated vs public delivery, with the eager-variant implication above.
7. Phase 4 (owner): C-15 counter-table resolution and which "year" applies (creation vs order date).
8. Legacy phase (owner): `CSPS_Legacy_Restore` vs CLAUDE.md's `CSPS_Dev` instruction. Also the local-ETL-then-restore cutover option (requires the host to run SQL 2025).

---

## Sources

- EF Core 10 what's new (complex types, optional/struct, ToJson, named query filters, ExecuteUpdate, parameterized collections), https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-10.0/whatsnew. Fetched 2026-10-06 (doc updated 2026-08-05). Seam: LOW (webfetch, first-party).
- EF Core concurrency (`IsRowVersion`, token in WHERE, application-managed tokens), https://learn.microsoft.com/en-us/ef/core/saving/concurrency. Seam: LOW, first-party.
- EF Core SQL Server provider (`UseCompatibilityLevel`, JSON indexes in EF 11), https://learn.microsoft.com/en-us/ef/core/providers/sql-server/. Seam: LOW, first-party.
- SQL Server `json` data type (preview in SQL Server 2025), https://learn.microsoft.com/en-us/sql/t-sql/data-types/json-data-type. Websearch, MEDIUM.
- ASP.NET Core 10 release notes (AddValidation, OpenAPI 3.1, IApiEndpointMetadata 401/403, exception-handler logging change), https://learn.microsoft.com/en-us/aspnet/core/release-notes/aspnetcore-10.0. Seam: LOW, first-party.
- Static files / MapStaticAssets (fallback policy applies to static asset endpoints; build-time manifest; precompression; runtime fallback warning), https://learn.microsoft.com/en-us/aspnet/core/fundamentals/static-files (aspnetcore-10.0 moniker, updated 2026-09-24). Seam: LOW, first-party.
- Antiforgery and Minimal APIs (`DisableAntiforgery` for bearer endpoints), https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery. Seam: LOW, first-party. The automatic Fetch-Metadata CSRF is .NET 11 preview per https://startdebugging.net/2026/07/aspnetcore-11-automatic-csrf-protection-fetch-metadata-preview-6/ (websearch, MEDIUM).
- Data Protection key storage (EF Core provider, at-rest encryption warning), https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/implementation/key-storage-providers. Seam: LOW, first-party.
- Cloudinary access control (authenticated = eager only; signed URLs don't expire; token auth Advanced+), https://cloudinary.com/documentation/control_access_to_media. Seam: LOW, first-party, quoted verbatim.
- SmarterASP.NET (.NET 10, SQL Server 2025, Let's Encrypt, MSSQL Job add-on), https://www.smarterasp.net/ and https://www.smarterasp.net/asp.net_core_hosting. Websearch/webfetch, MEDIUM for "advertised", unknown for operational details.
- Testcontainers.MsSql and the `mssql/server:2025-latest` stable tag, https://www.nuget.org/packages/Testcontainers.MsSql/ and https://hub.docker.com/r/microsoft/mssql-server. Websearch, MEDIUM.
- GitHub windows-2025 runner software list (no LocalDB), https://github.com/actions/runner-images/blob/main/images/windows/Windows2025-Readme.md. MEDIUM.
- React Router granular `lazy` (v7.5+), https://remix.run/blog/faster-lazy-loading and https://app.unpkg.com/react-router@7.5.0/files/CHANGELOG.md. Websearch, MEDIUM.
- WebApplicationFactory Kestrel support fields, https://source.dot.net/Microsoft.AspNetCore.Mvc.Testing/WebApplicationFactory.cs.html. Websearch, MEDIUM.
- Local environment checks (read-only): `sqllocaldb versions` reports SQL Server 2025 17.0.4025.3; the Docker server OS is linux. Scaffold files read: `.Server/*.csproj`, `Program.cs`, `launchSettings.json`, client `vite.config.js`, `package.json`.
- Training knowledge (HIGH, re-verify during phase research): cookie-prefix rules (`__Host-` requires `Path=/`); EF idempotent scripts need `EXEC()` around CREATE TRIGGER/PROC; the retrying execution strategy rejects user transactions; SQL Server `uniqueidentifier` sort order (so EF's sequential GUID generation is preferred over `Guid.CreateVersion7()` for clustered keys, which barely matters at this scale).

---
*Architecture research for: CSPS staff order portal + public site (.NET 10 onion + React 19, SmarterASP.NET)*
*Researched: 2026-10-06*

# Phase 2: Web Foundation & Design System - Pattern Map

*Created: 2026-10-07T20:44:08-05:00 · Updated: 2026-10-07T20:44:08-05:00*

**Mapped:** 2026-10-07
**Files analyzed:** 48 (grouped; `web/` is new, so frontend "analogs" are the verbatim spec appendices in `CSPS-UI-SPEC.md` plus RESEARCH patterns)
**Analogs found:** 48 / 48 (13 real .NET code analogs, 29 spec-appendix analogs, 6 RESEARCH-pattern only)

All analog paths below are git-tracked (`git ls-files` verified). `.planning/design/*.html` is gitignored and is **never** an analog; it is a visual reference only.

## Spec appendix line index (`CSPS-UI-SPEC.md`, repo root)

| Appendix | Target file | Lines |
|---|---|---|
| A tokens.css | `web/src/styles/tokens.css` | 1606-1762 |
| A.2 globals.css | `web/src/styles/globals.css` | 1763-1860 |
| A.3 compat.css | `web/src/styles/compat.css` | 1861-1873 |
| B components.css | `web/src/styles/components.css` | 1874-2266 |
| C screens.css | `web/src/styles/screens.css` | 2267-2787 |
| D.1 csps.ts | `web/src/lib/csps.ts` | 2788-2992 (formatPeso 2917, formatDate 2925, **round2 2934**, discountAmount 2937, orderTotals 2947) |
| D.2 csps.test.ts | `web/src/lib/csps.test.ts` | 2993-3057 |
| D.3 ui/index.tsx | `web/src/ui/index.tsx` | 3058-3880 (UiLink 3092, Icon 3106, Mark 3127, Field 3252, Tabs 3351, Modal 3609, SiteHeader 3702, Sidebar 3733, Topbar 3763, EmptyState 3838, Skeleton 3849, ToastProvider 3858) |
| D.4 mark.ts | `web/src/ui/mark.tsx` (JSX, no innerHTML) | 3881-3891 |
| D.5 icons.ts | `web/src/ui/icons.ts` (lucide map, D-10) | 3892-3904 |
| D.6 main.tsx | `web/src/main.tsx` | 3905-3936 |
| D.6b RouterLink.tsx | `web/src/app/RouterLink.tsx` | 3937-3952 |
| D.7 vite.config.ts | `web/vite.config.ts` | 3953-3970 |
| D.7b tsconfig.json | `web/tsconfig.app.json` (superseded by PRD §17.2 / D-07) | 3971-4010 |
| D.7c index.html | `web/index.html` | 4011-4032 |
| E.1 Home (header/footer markup) | `PublicLayout`, footer, DOM fixtures | 4059-4314 |
| E.7 Orders (toolbar, `.s-rt`, chips) | FilterBar/SearchBox/ResponsiveTable | 4917-5103 |
| E.8 states (empty/no-match/loading/error) | ErrorState, Skeleton family, EmptyState usage | 5104-5185 |
| E.12 Users (inactive row) | ResponsiveTable `is-inactive` (D-02 replaces opacity) | 5947-6130 |
| F mark.svg | `web/public/mark.svg` + Mark JSX | 6229-end |

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/Csps.Server/Program.cs` (modify: compression, static files, SPA fallbacks) | config / composition root | request-response | itself (lines 51-82) + `Endpoints/ApiRouting.cs` | exact |
| `src/Csps.Server/Endpoints/SpaHosting.cs` (new: `MapSpaFallbacks`, `{*path:file}` 404, `MapFallbackToFile`, reserved `/scalar` `/openapi` 404 in non-Dev) | route | request-response | `src/Csps.Server/Endpoints/ApiRouting.cs` | exact |
| `src/Csps.Server/Composition/SpaRegistration.cs` (new: `AddCspsResponseCompression`, `SpaCaching.Apply`) | config | request-response | `src/Csps.Server/Composition/OpenApiRegistration.cs` | role-match |
| `.gitignore` (modify: `src/Csps.Server/wwwroot/`, `web/.e2e-dist/`, `web/.budget-dist/`) / `.gitattributes` (new) | config | — | `.gitignore` lines 28-37 | exact |
| `tests/Csps.Testing/CspsApiFactory.cs` (modify: fixture web root) | test fixture | — | itself (lines 63-93) | exact |
| `tests/Csps.Server.IntegrationTests/Fixtures/wwwroot/index.html` (new stub) | test fixture | file-I/O | none (static stub) | n/a |
| `tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs` (new) | test | request-response | `tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs` | exact |
| `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` (modify: 2-3 rows + allow-list) | test data | — | itself (lines 53-62) | exact |
| `tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs` (modify: `ProductionHasNoApiDocs` asserts 404, D-29) | test | request-response | itself (lines 57-71) | exact |
| `tests/Csps.ArchitectureTests/DependencyRegistry.cs` (modify: `npm` kind) | utility (validator) | transform | itself (lines 17-18, 244-248) | exact |
| `tests/Csps.ArchitectureTests/PackagePins.cs` (modify: read `web/package.json`, `tools/openapi-gen/package.json`) | utility (reader) | file-I/O | itself `ReadToolManifest` (lines 36-50) | exact |
| `tests/Csps.ArchitectureTests/DependencyRegistryTests.cs` (modify: npm cases) | test | — | itself (lines 1-70) | exact |
| `docs/dependencies.json`, `docs/license-exceptions.json` (modify: npm entries, nuqs planned→packages, D-11/D-25/D-26) | config | — | existing entries / `planned` block (line 381) | exact |
| `src/Csps.Domain/Orders/OrderMath.cs` (new) | model (pure domain calc) | transform | `src/Csps.Domain/Auditing/IpPrefix.cs` | role-match |
| `tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs` (new) | test | file-I/O + transform | `tests/Csps.Domain.UnitTests/Auditing/IpPrefixTests.cs` | role-match |
| `tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj` (modify: link JSON) | config | — | itself | exact |
| `tests/fixtures/order-math-golden-vectors.json` + `web/scripts/gen-golden-vectors.mjs` | fixture / script | batch | none (RESEARCH Pattern 8) | no analog |
| `tests/.../OpenApiSnapshotTests.cs` + `tools/openapi-gen/{package.json,openapi.v1.json}` (D-16) | test / tool | file-I/O | `OpenApiExposureTests.DevelopmentServesOpenApiAndScalar` (lines 18-46) | role-match |
| `web/src/styles/{tokens,globals,compat,components,screens}.css` | config (CSS) | — | App. A-C (verbatim) | exact |
| `web/src/styles/spec-gaps.css`, `overrides.css` | config (CSS) | — | App. B conventions; UI-SPEC §Color overrides table | partial |
| `web/src/styles/verbatim.test.ts`, `overrides.test.ts` | test | file-I/O | RESEARCH Pitfall 5; UI-SPEC D-02 rule | no code analog |
| `web/src/lib/csps.ts` (+ `csps.test.ts`, `csps.golden.test.ts`) | utility | transform | App. D.1 / D.2 | exact |
| `web/src/lib/format.ts` | utility | transform | App. D.1 formatDate (2925) + RESEARCH Code Example | exact |
| `web/src/ui/index.tsx`, `icons.ts`, `mark.tsx`, `__reference__/*` | component | — | App. D.3 / D.4 / D.5 | exact |
| `web/src/ui/differential.test.tsx` | test | — | RESEARCH Pattern 3 | no code analog |
| `web/src/ui/gaps/*` (ResponsiveTable, Pagination, SearchBox, FilterBar, MoneyInput, OtpInput, LazyImage, ErrorState, Skeleton family, Checkbox, SkipLink, MobileNavDrawer, UserMenu, useFocusTrap) | component | event-driven | App. D.3 (Field 3252, Modal 3609, Skeleton 3849, EmptyState 3838) + App. E.7/E.8 markup | role-match |
| `web/src/main.tsx`, `web/src/app/router.tsx` | config / provider | request-response | App. D.6 + RESEARCH Pattern 2 | exact |
| `web/src/app/RouterLink.tsx` | component | — | App. D.6b | exact |
| `web/src/app/public/{PublicLayout,PublicPlaceholderPage}.tsx` | component (layout/page) | — | App. E.1 (4059-4314) + UI-SPEC Layout Contract | exact |
| `web/src/app/admin/{AdminLayout,AdminPreviewPage,UrlStateLayout}.tsx`, `web/src/app/dev/ComponentShowcase.tsx`, `ErrorBoundary.tsx` | component | — | App. D.3 Sidebar/Topbar + spec §8.1 + RESEARCH Pattern 10 | role-match |
| `web/src/lib/http/httpClient.ts` (+ tests, 100% cov) | service | request-response | RESEARCH Pattern 5; server-side error shape `src/Csps.Server/Http/CspsProblemDetails.cs` | partial |
| `web/src/lib/api.ts`, `web/src/types/api.generated.ts` | service | request-response | `src/Csps.Server/Endpoints/SiteSettingsEndpoints.cs` (only endpoint) | partial |
| `web/src/lib/query/*`, `web/src/lib/url-state/*` | hook / provider | event-driven | RESEARCH Patterns 9, 10 | no code analog |
| `web/vite.config.ts`, `scripts/vite-budget-plugin.ts`, `scripts/budget.ts`, `scripts/vite-preload-font-plugin.ts` | config / build plugin | batch | App. D.7 + RESEARCH Patterns 1, 12, 14 | role-match |
| `web/{package.json,.npmrc,tsconfig.*.json,eslint.config.ts,.prettierrc,.prettierignore,index.html,public/*}` | config | — | App. D.7b/D.7c + RESEARCH Installation + Pattern 6 | role-match |
| `web/src/test/{setup.ts,axe.ts,lint-rules.test.ts}` | test util | — | RESEARCH Patterns 4, 6 | no code analog |
| `web/playwright.config.ts`, `web/e2e/*`, `scripts/lighthouse-assert.mjs`, visual-report script (D-24) | test / tool | batch | RESEARCH Patterns 11, 13 | no code analog |

## Pattern Assignments

### `src/Csps.Server/Endpoints/SpaHosting.cs` (route, request-response)

**Analog:** `src/Csps.Server/Endpoints/ApiRouting.cs` (whole file, 34 lines). Copy its shape exactly: static class, `public const string` pattern, `Map*` extension returning `IEndpointConventionBuilder`, `ArgumentNullException.ThrowIfNull`, `.AllowAnonymous().ExcludeFromDescription()`, ProblemDetails via `CspsProblemDetails.Build`.

```csharp
public const string FallbackPattern = "/api/{**path}";

public static IEndpointConventionBuilder MapApiFallback(this IEndpointRouteBuilder endpoints)
{
    ArgumentNullException.ThrowIfNull(endpoints);

    return endpoints
        .MapFallback(FallbackPattern, ApiNotFound)
        .AllowAnonymous()
        .ExcludeFromDescription();
}

private static ProblemHttpResult ApiNotFound(HttpContext context) =>
    TypedResults.Problem(CspsProblemDetails.Build(context, StatusCodes.Status404NotFound));
```

New members (RESEARCH Pattern 7, Pitfalls 11-12, D-29): `FilePattern = "{*path:file}"` → same `ApiNotFound`-style 404; `MapFallbackToFile("index.html").AllowAnonymous()` (raw text `{*path:nonfile}`) with `Cache-Control: no-cache`; in non-Development, reserved `/scalar/{**path}` and `/openapi/{**path}` 404 fallbacks so they never reach the SPA shell. Use `const` patterns so the matrix rows reference them.

### `src/Csps.Server/Program.cs` (composition root, modify)

**Analog:** itself. Insertion points (lines 67-82):

```csharp
app.UseStatusCodePages(static context => CspsProblemDetails.WriteAsync(context.HttpContext, context.HttpContext.Response.StatusCode));
// INSERT: app.UseResponseCompression();  app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = SpaCaching.Apply });
var requestLogger = app.Services.GetRequiredService<Serilog.ILogger>();
app.UseSerilogRequestLogging(options => options.Logger = requestLogger);
app.UseAuthentication();
app.UseAuthorization();

app.MapCspsHealth();
app.MapApiFallback();
app.MapSiteSettings();
app.MapCspsApiDocs();
// INSERT: app.MapSpaHost();  (after API docs so dev /scalar wins)
```

Every call gets a one-line comment naming the requirement (house style, lines 11-49). Service registration goes beside line 49 (`builder.Services.AddCspsOpenApi(builder.Environment);`). `SecurityHeadersMiddleware` stays outermost (line 54) so static files carry the CSP.

### `src/Csps.Server/Composition/SpaRegistration.cs` (config)

**Analog:** `src/Csps.Server/Composition/OpenApiRegistration.cs` lines 9-46: static class with XML docs, `Add*` on `IServiceCollection` taking `IHostEnvironment`, `Map*` on `WebApplication`, `ArgumentNullException.ThrowIfNull` guards, environment branching via `environment.IsDevelopment()`.

```csharp
public static IServiceCollection AddCspsOpenApi(this IServiceCollection services, IHostEnvironment environment)
{
    ArgumentNullException.ThrowIfNull(services);
    ArgumentNullException.ThrowIfNull(environment);

    if (environment.IsDevelopment())
    {
        services.AddOpenApi();
    }

    return services;
}
```

Compression `MimeTypes` = html, css, js, svg only (never JSON, BREACH); Brotli + Gzip, `EnableForHttps = true`; `/assets/*` immutable 1 year, others `no-cache` (RESEARCH Pitfall 3).

### `tests/Csps.Testing/CspsApiFactory.cs` (test fixture, modify)

**Analog:** itself, `ConfigureWebHost` lines 63-93. Add one setting next to the others, with a comment explaining why (house style, lines 69-82):

```csharp
builder.UseEnvironment(EnvironmentName);
builder.UseSetting(DependencyInjection.ConnectionStringKey, _connectionString);
// ...
builder.UseSetting(LogFileSwitchKey, "false");
```

Add `builder.UseWebRoot(<repo>/tests/Csps.Server.IntegrationTests/Fixtures/wwwroot)` (or a copied-to-output fixture folder) so the suite never depends on `npm run build` (RESEARCH Pattern 7 "Test web root").

### `tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs` (test, request-response)

**Analog:** `tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs` lines 1-60. Copy: primary-constructor class with `IClassFixture<CspsDatabase>`, `await using var factory = CspsApiFactory.ForDatabase(...)`, `new Uri(path, UriKind.Relative)`, `TestContext.Current.CancellationToken`, Shouldly assertions.

```csharp
public sealed class HealthEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task IsNotCacheable()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
    }
}
```

For tests that never touch the DB, prefer the parameterless `new CspsApiFactory()` (CspsApiFactory.cs lines 26-36). Environment switching: `baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Production))` (OpenApiExposureTests.cs line 61). CSP assertion helper: `SecurityHeadersTests.Single(response, SecurityHeadersTests.CspHeader).ShouldBe(SecurityHeadersTests.StrictCsp)` (OpenApiExposureTests.cs line 28). Problem content type: `ProblemJson.MediaType` (line 69). Cases: `/` and `/admin/x` → 200 text/html no-cache; `/missing.js` → 404 problem (anon); `/api/v1/nope` → 404 problem; `/assets/x` immutable; html/js compressed, JSON not.

### `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` (modify)

**Analog:** itself lines 53-62:

```csharp
public static IReadOnlyList<MatrixRow> Rows { get; } =
[
    new("*", "/health", "/health", Anonymous: 200, Admin: 200, Manager: 200),
    new("*", "/api/{**path}", "/api/v1/does-not-exist", Anonymous: 404, Admin: 404, Manager: 404),
    new("GET", "/api/v1/site-settings", "/api/v1/site-settings", Anonymous: 401, Admin: 200, Manager: 200),
];

public static IReadOnlySet<string> AnonymousAllowList { get; } =
    new[] { "* /health", "* /api/{**path}" }.ToFrozenSet(StringComparer.Ordinal);
```

Add rows keyed by the exact `RoutePattern.RawText` (`AuthorizationCoverage.KeysOf`, AuthorizationCoverage.cs lines 29-38): `"* {*path:file}"` (sample `/missing.js`, 404/404/404), `"* {*path:nonfile}"` (sample `/`, 200/200/200), plus the reserved docs fallbacks if mapped in the Testing environment. Add each key to `AnonymousAllowList`. Matrix runs in `Testing` env, so Development-only Scalar rows do not appear.

### `tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs` (modify, D-29)

**Analog:** itself lines 57-71. Tighten `response.IsSuccessStatusCode.ShouldBeFalse(path)` to `response.StatusCode.ShouldBe(HttpStatusCode.NotFound, path)`; keep the ProblemJson media-type assertion; add `/openapi/` and `/scalar/x` sub-paths. `DocsRoutes` helper (lines 92-96) must still return empty in Production, so the reserved-prefix 404 fallbacks need patterns that do **not** start with `openapi`/`scalar` after `TrimStart('/')`, or the helper must filter to non-fallback endpoints. Decide in the plan.

### `tests/Csps.ArchitectureTests/DependencyRegistry.cs` + `PackagePins.cs` (modify)

**Analog:** themselves.
- `DependencyRegistry.cs` line 17: `private static readonly string[] Kinds = ["nuget", "tool"];` → add `"npm"`. Line 244 kind mapping: `var expectedKind = string.Equals(pin.Source, "tool", StringComparison.Ordinal) ? "tool" : "nuget";` → map a new `"npm"` source to `"npm"`.
- `PackagePins.cs` lines 16-20 `ReadAll()` collection-expression spread; add `.. ReadNpmManifest(...)` for `web/package.json` and `tools/openapi-gen/package.json`. Copy `ReadToolManifest` (lines 36-50) shape:

```csharp
public static List<PackagePin> ReadToolManifest(string json)
{
    using var document = JsonDocument.Parse(json);
    if (!document.RootElement.TryGetProperty("tools", out var tools))
    {
        return [];
    }

    return tools.EnumerateObject()
        .Select(tool => new PackagePin(tool.Name, ..., "tool"))
        .ToList();
}
```

npm reader reads `dependencies` + `devDependencies`; alias values (`npm:@typescript/typescript6@6.0.2`) must resolve to the exact version. Note collision: `typescript` appears in both web (alias 6.0.2) and tools/openapi-gen (5.9.3), and the registry rejects duplicate ids (ValidateOrder lines 211-225); plan needs a distinct id scheme (e.g. `web:typescript` / `tools/openapi-gen:typescript`) or source-qualified matching.
- Tests: copy `DependencyRegistryTests.cs` style (sample pins lines 8-10, `Registry()` JsonNode builder, `ShouldContain(problem => problem.Contains(...))`).

### `src/Csps.Domain/Orders/OrderMath.cs` (pure domain, transform)

**Analog:** `src/Csps.Domain/Auditing/IpPrefix.cs` lines 1-42: file-scoped namespace, `public static class` with a `<summary>` citing the decision IDs, `private const` named constants with trailing comments, one pure public method, BCL only (Domain has no package refs).

```csharp
namespace Csps.Domain.Auditing;

/// <summary>
/// Truncates a client IP address before it is stored (D-24, ...)
/// </summary>
public static class IpPrefix
{
    private const int Ipv4PrefixBytes = 3;   // /24
    ...
    public static string? From(IPAddress? address)
```

Body: `decimal` math, `Math.Round(x, 2, MidpointRounding.AwayFromZero)`, pinned order documented in the XML summary (round items total → round each discount → sum → round sum → subtract; D-09). Mirror field names of App. D.1 `Totals` (lines 2947-2954): total, discount, paid, balance, expenses, profit, fullyPaid. Domain coverage 100%.

### `tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs` (test)

**Analog:** `tests/Csps.Domain.UnitTests/Auditing/IpPrefixTests.cs` lines 1-50: `public sealed class XTests`, `[Theory]` + Shouldly `ShouldBe`. For vectors use `[Theory]` with `[MemberData]` (or xUnit v3 `TheoryData<…>`) loading the linked JSON with `System.Text.Json`; amounts are strings parsed with `decimal.Parse(..., CultureInfo.InvariantCulture)`. Add a fact asserting ≥ 200 cases. csproj link per RESEARCH Pattern 8:

```xml
<ItemGroup>
  <Content Include="..\fixtures\order-math-golden-vectors.json" Link="Fixtures\order-math-golden-vectors.json" CopyToOutputDirectory="PreserveNewest" />
</ItemGroup>
```

Add it beside the existing groups in `tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj` (lines 4-11 style, with an XML comment).

### `web/src/lib/csps.ts` (utility, transform)

**Analog:** App. D.1 lines 2788-2992, verbatim. Only change: `round2` at line 2934 (`Math.round((Number(n) || 0) * 100) / 100`) → integer-centavo, half-away-from-zero, with `// SPEC-DEVIATION: D-09 (C-25) ...`. Red evidence: the unmodified round2 must fail midpoint vectors (RESEARCH Pitfall 13). `csps.test.ts` = App. D.2 (2993-3057) verbatim; `csps.golden.test.ts` reads `tests/fixtures/order-math-golden-vectors.json` via `fs.readFileSync(new URL('../../../tests/fixtures/...', import.meta.url))`.

### `web/src/ui/index.tsx`, `icons.ts`, `mark.tsx` (component)

**Analog:** App. D.3 (3058-3880), D.5 (3892-3904), D.4 (3881-3891). Process per D-07: copy verbatim → compile/lint → smallest fixes with `// SPEC-DEVIATION:`. Known fix list and counts: RESEARCH Pitfall 7 (7 TS errors, 99 lint findings). Specific targets: `UiLink` (3092, static-components → render react-router `Link`), `Icon` (3106, lucide wrapper, D-10/D-28), `Mark` (3127, JSX children, no `dangerouslySetInnerHTML`), `Tabs` (3351, full WAI-ARIA), `Modal` (3609, focus trap via `useFocusTrap`, overlay handler via ref+effect), `Sidebar` (3733, Logout `<button>`, D-27), `ToastProvider` (3858, D-04 danger persists). Frozen copies of D.3/D.4/D.5 go in `web/src/ui/__reference__/` for the differential test (RESEARCH Pattern 3).

### `web/src/ui/gaps/*` (SPEC-GAP components)

**Analogs inside App. D.3:** `Field` (3252) for MoneyInput/OtpInput structure and `.csp-msg` errors; `Modal` (3609) for MobileNavDrawer dialog semantics; `Skeleton` (3849) and `EmptyState` (3838) for the Skeleton family / empty states. Markup to reproduce exactly: App. E.7 (4917-5103) for `.s-toolbar[role=search]`, `.s-search-box`, `.s-resultbar`, `.s-filter-chip`, `.s-rt-wrap > table.s-rt`; App. E.8 (5104-5185) for ErrorState `.s-banner.is-danger` and the skeleton order card. Behaviour/a11y contracts: UI-SPEC `02-UI-SPEC.md` § SPEC-GAP Primitive Specs (lines 284-303). Styles only in `spec-gaps.css` under `@layer components`, tokens only, `/* SPEC-GAP: <name> */`.

### `web/src/main.tsx` + `web/src/app/router.tsx` (provider/config)

**Analog:** App. D.6 (3905-3936) for CSS import order and providers; replace `<BrowserRouter>` with RESEARCH Pattern 2 (`createBrowserRouter` from `react-router`, `RouterProvider` from `react-router/dom`, root `HydrateFallback`, `ErrorBoundary`, `...(__DEV_ROUTES__ ? adminRoutes : [])`). Root error callbacks: RESEARCH Code Examples "Root error callbacks". CSS order: fonts → globals → spec-gaps → overrides (UI-SPEC lines 44-52), marked `// SPEC-DEVIATION: D-07 overrides/spec-gaps load order`.

### Layouts and pages (`web/src/app/public/*`, `admin/*`, `dev/*`)

**Analog:** UI-SPEC Layout Contract (lines 222-269) skeletons; App. E.1 (4059-4314) header/footer markup verbatim; App. D.3 `SiteHeader` (3702), `Sidebar` (3733), `Topbar` (3763). Theme: RESEARCH Code Example "Theme init without inline script" (lazy `useState(readTheme)` with try/catch). nuqs adapter: RESEARCH Pattern 10 (`UrlStateLayout` lazy). Overlays render inside `.s-page`, never `createPortal(document.body)`.

### `web/vite.config.ts` + build plugins

**Analog:** App. D.7 (3953-3970) + RESEARCH Pattern 1 (port 5180 strictPort, proxy `/api` → `http://localhost:5115`, `outDir` per mode, `assetsInlineLimit: 0`, `license: true`, `__DEV_ROUTES__` define). Budget plugin: RESEARCH Pattern 12 (pure `budget.ts`, 1 KB = 1000 B, `this.error`). Font preload: Pattern 14.

### `web/eslint.config.ts`, `web/src/test/*`, Playwright, Lighthouse

**Analog:** RESEARCH Pattern 6 (restriction block exported for `lint-rules.test.ts`), Pattern 4 (`expectNoAxeViolations`), Pattern 11 (playwright `webServer` https 5199, `reuseExistingServer: false`, per-process env only), Pattern 13 (lighthouse-assert). Preflight wrapper calls `C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`.

## Shared Patterns

### .NET house style (all .NET files)
**Source:** `src/Csps.Server/Endpoints/ApiRouting.cs`, `Composition/OpenApiRegistration.cs`, `Program.cs`
- XML `<summary>` on every public type/member citing requirement/decision IDs (FND-05, D-14, ...).
- `ArgumentNullException.ThrowIfNull` on every public extension parameter.
- Extension methods named `AddCsps*` / `Map*`, returning the builder.
- Zero warnings: `StringComparer.Ordinal`/`StringComparison.Ordinal` explicitly, collection expressions, file-scoped namespaces.

### ProblemDetails for every non-success
**Source:** `src/Csps.Server/Http/CspsProblemDetails.cs` via `ApiRouting.cs` line 33
```csharp
TypedResults.Problem(CspsProblemDetails.Build(context, StatusCodes.Status404NotFound));
```
**Apply to:** file 404 fallback, reserved docs 404 fallbacks.

### Default-deny authorization coverage
**Source:** `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` (53-62) + `AuthorizationCoverage.cs` (29-80)
**Apply to:** every new endpoint (SPA shell, file fallback, reserved prefixes): `.AllowAnonymous()` + allow-list key + matrix row with exact RawText.

### Integration test skeleton
**Source:** `tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs`, `Http/OpenApiExposureTests.cs`
**Apply to:** SpaHostTests, OpenApiSnapshotTests.

### Pure validator + sample-data tests
**Source:** `tests/Csps.ArchitectureTests/DependencyRegistry.cs` (Validate returns `List<string>` problems), `DependencyRegistryTests.cs`
**Apply to:** npm kind, npm pin reader, any new repo-file gate.

### SPEC-DEVIATION / SPEC-GAP markers (all web files)
**Source:** CONTEXT D-07/D-08, UI-SPEC lines 44-52
- Verbatim CSS: byte-for-byte (LF-normalized), never edited.
- TS/TSX deviations: `// SPEC-DEVIATION: <reason>`, no DOM change; DOM-changing fixes stop for the owner (D-08; batch O-1..O-10).
- New CSS: `/* SPEC-GAP: … */` in `spec-gaps.css`; owner rulings `/* D-0x (C-xx) */` in `overrides.css`.

### Locale formatting
**Source:** App. D.1 lines 2914-2930 (`formatPeso` with U+2212, `formatDate` "Oct 6, 2026")
**Apply to:** Money, KpiCard, OrderTotals, MoneyInput, showcase data.

## No Analog Found

| File | Role | Data Flow | Reason / use instead |
|---|---|---|---|
| `tests/fixtures/order-math-golden-vectors.json` + generator | fixture/script | batch | No shared fixtures folder yet; RESEARCH Pattern 8 |
| `web/src/lib/http/httpClient.ts` | service | request-response | No client code exists; RESEARCH Pattern 5 (inject `fetch`) |
| `web/src/lib/query/*`, `url-state/*` | hook | event-driven | RESEARCH Patterns 9, 10 |
| `web/src/test/axe.ts`, `lint-rules.test.ts`, `ui/differential.test.tsx` | test util | — | RESEARCH Patterns 3, 4, 6 |
| `web/playwright.config.ts`, `e2e/*`, Lighthouse + D-24 visual scripts | test/tool | batch | RESEARCH Patterns 11, 13; D-24 output gitignored |
| `tests/Csps.Server.IntegrationTests/Fixtures/wwwroot/index.html` | fixture | file-I/O | Minimal stub HTML, no inline script/style |

## Metadata

**Analog search scope:** `src/`, `tests/`, `docs/`, `.gitignore`, `CSPS-UI-SPEC.md` appendices
**Files scanned:** ~20 read, 150 listed
**Pattern extraction date:** 2026-10-07

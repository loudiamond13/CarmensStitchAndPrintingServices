---
created: 2026-10-08T07:40:00-05:00
updated: 2026-10-08T07:40:00-05:00
---

# Phase 2: Web Foundation & Design System - Pattern Map

**Mapped:** 2026-10-08
**Files analyzed:** ~95 (grouped into 30 file families below)
**Analogs found:** 25 / 30 families (tracked Phase 1 code, or the proven prior implementation at `74621f5` per D-37)

**How to read analog paths.**
- `src/...`, `tests/...`, `docs/...` with no prefix are git-tracked in the working tree today.
- `74621f5:<path>` means "read with `git show 74621f5:<path>`". This is the reverted, style-independent prior implementation (D-37). Use it as a reference only. Every task stays TDD (RED first, inert placeholders, never a compile-error RED, L-26). Nothing is restored wholesale without its tests.
- **Never use as patterns:** `74621f5:web/src/styles/*.css`, `overrides.css`, `spec-gaps.css`, `web/src/ui/differential.test.tsx`, `web/src/ui/reference-verbatim.test.ts`, `web/scripts/reference-resolve-plugin.mjs`, or the `className="csp-..."` strings in any reverted component. D-33 replaced them. For styles, the pattern sources are RESEARCH §"Tailwind v4 Conversion Design", §"Where Class Strings Live" and the UI-SPEC Tailwind contract.
- The one allowed use of `74621f5:web/src/styles/overrides.css` is as the **value source** for the test-only `web/visual/reference/rulings.css` (RESEARCH line 759).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/Csps.Server/Program.cs` (modify) | config (composition root) | request-response | `74621f5:src/Csps.Server/Program.cs` lines 51-105 | exact |
| `src/Csps.Server/Composition/SpaRegistration.cs` (+ `SpaCaching`) | config | file-I/O | `74621f5:src/Csps.Server/Composition/SpaRegistration.cs` | exact |
| `src/Csps.Server/Composition/HiddenSegmentFileProvider.cs` | middleware/utility | file-I/O | `74621f5:src/Csps.Server/Composition/HiddenSegmentFileProvider.cs` | exact |
| `src/Csps.Server/Endpoints/SpaHosting.cs`, `ReservedPathMetadata.cs` | route | request-response | `74621f5:src/Csps.Server/Endpoints/SpaHosting.cs`; live style: `src/Csps.Server/Endpoints/ApiRouting.cs` | exact |
| `tests/Csps.Testing/CspsApiFactory.cs` (modify) + `Csps.Testing.csproj` copy item | test fixture | — | `74621f5:tests/Csps.Testing/CspsApiFactory.cs` lines 91-94 | exact |
| `tests/Csps.Testing/Fixtures/webroot/**` | test fixture | file-I/O | `74621f5:tests/Csps.Testing/Fixtures/webroot/` (index.html, robots.txt, assets/app-fixture.js, .vite/license.md, .x/y.txt) | exact |
| `tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs`, `HiddenSegmentFileProviderTests.cs`, `WebConfigTests.cs` | test | request-response | `74621f5:` same paths | exact |
| `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` (modify) | test | — | live file lines 53-63 + `74621f5:` same file lines 55-72 | exact |
| L-03 probe moves in Phase 1 tests (`AuthorizationFailureTests`, health/500 probes) | test | request-response | `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs` | exact |
| `src/Csps.Domain/Orders/OrderMath.cs`, `OrderMathModels.cs` | model (pure domain) | transform | `74621f5:src/Csps.Domain/Orders/OrderMath.cs` | exact |
| `tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs`, `OrderMathGoldenVectorTests.cs` | test | transform | `74621f5:` same paths | exact |
| `tests/fixtures/order-math-golden-vectors.json` + `web/scripts/gen-golden-vectors.mjs`, `golden-math.mjs` (+tests) | fixture + tool | batch | `74621f5:` same paths | exact |
| `tests/Csps.ArchitectureTests/DependencyRegistry.cs`, `PackagePins.cs`, `DependencyRegistryTests.cs` (modify: `npm` kind, overrides as pins) | test | transform | live files (`DependencyRegistry.cs:17` `Kinds`) | exact |
| `docs/dependencies.json`, `docs/license-exceptions.json` (modify), `docs/development.md` (modify) | config/docs | — | live files | exact |
| `.gitignore`, `.gitattributes`, `.editorconfig` (modify) | config | — | live root files | exact |
| `web/package.json`, `.npmrc`, `.prettierrc.json`, `.prettierignore`, `index.html`, `public/*` | config | — | `74621f5:web/` same paths (+ D-34/D-36 pins from RESEARCH §Installation) | exact |
| `web/vite.config.ts` | config (build) | batch | `74621f5:web/vite.config.ts` (change `license: true` → `false`, D-35; add budget plugin) | exact |
| `web/vitest.config.ts`, `tsconfig*.json` | config (test) | — | `74621f5:web/vitest.config.ts`, `tsconfig.*.json` (drop `referenceResolvePlugin` and `__reference__` excludes) | role-match |
| `web/eslint.config.mjs` | config (lint) | — | `74621f5:web/eslint.config.mjs` (escalate helper) + RESEARCH Pattern 6 (one `syntaxBans` array with D-33 bans) | role-match |
| `web/src/styles/app.css`, `base.css` | config (theme) | — | **none in repo**; RESEARCH lines 527-575 skeleton | no analog |
| `web/src/styles/stylesheet-contract.test.ts`, `web/scripts/tailwind-classes.test.ts` | test (node) | transform | `74621f5:web/src/test/lint-rules.test.ts`, `build-config.test.ts` (node-env Vitest over config files) | partial |
| `web/src/test/setup.ts`, `consoleGuard.ts`, `axe.ts`, `axeTags.ts`, `fakeFetch.ts` (+ self-tests) | test utility | — | `74621f5:web/src/test/` same paths | exact |
| `web/src/lib/http/httpClient.ts`, `HttpError.ts` (+ 4 test files) | service | request-response | `74621f5:web/src/lib/http/` | exact |
| `web/src/lib/api.ts` (+test), `web/src/types/api.generated.ts`, `tools/openapi-gen/*` | service + codegen tool | request-response | `74621f5:web/src/lib/api.ts`, `74621f5:tools/openapi-gen/check.mjs` | exact |
| `web/src/lib/query/*`, `web/src/lib/url-state/*` | hook/provider | request-response / URL state | `74621f5:web/src/lib/query/`, `.../url-state/` | exact |
| `web/src/lib/forms/*`, `web/src/lib/errors/describeHttpError.ts` | hook/utility | request-response | `74621f5:` same paths | exact |
| `web/src/lib/csps.ts` (D-09), `format.ts` (+ golden test) | utility | transform | `74621f5:web/src/lib/csps.ts`, `format.ts`, `csps.golden.test.ts` | exact |
| `web/src/ui/*.tsx` + `*.recipe.ts` (converted App. D.3), `ui/icons.ts`, `ui/mark.tsx`, `ui/gaps/*.tsx` | component | event-driven (UI) | Behaviour/ARIA: `74621f5:web/src/ui/icons.ts`, `mark.tsx`, `ui/gaps/*.tsx`. **Styles:** RESEARCH §Where Class Strings Live (recipe pattern) — no repo analog | role-match (behaviour only) |
| `web/src/main.tsx`, `web/src/app/router.tsx`, layouts, `RouterLink.tsx`, `ErrorBoundary`, placeholder page | provider/route | request-response | `74621f5:web/src/main.tsx`, `app/RouterLink.tsx` + RESEARCH Pattern 2 | role-match |
| `web/src/dev/scenarios.ts`, `ComponentShowcase.tsx` | component (dev) | — | none (new under D-33) | no analog |
| `web/visual/**` (extract-spec, rulings.css, reference main, configs, `parity.spec.ts`) | test harness | batch | Partial: `74621f5:web/e2e/fixtures.ts` (CSP binding), `74621f5:web/scripts/owner-review-pack.mjs` | partial |
| `web/playwright.config.ts`, `web/e2e/fixtures.ts`, `e2e/*.spec.ts`, `web/scripts/e2e.mjs` | test harness | request-response | `74621f5:web/` same paths | exact |
| `web/scripts/license-gate.mjs`, `license-policy.mjs`, `npm-tree.mjs`, `third-party-notices.mjs` (+tests), `THIRD-PARTY-NOTICES.txt` | tool | batch | `74621f5:web/scripts/` same paths | exact |
| `web/scripts/vite-preload-font-plugin.ts`, `font-metrics.mjs` (+tests) | tool (vite plugin) | batch | `74621f5:web/scripts/` same paths | exact |
| `web/scripts/vite-budget-plugin.ts`, `budget.ts`, `lighthouse-assert.mjs` | tool | batch | Closest: `74621f5:web/scripts/vite-preload-font-plugin.ts` (plugin shape, fail-closed `this.error`) | role-match |
| `web/scripts/owner-review-pack.mjs`, D-24 side-by-side script | tool (local only) | batch | `74621f5:web/scripts/owner-review-pack.mjs` | exact (rebuild-if-stale fix, L-29) |

## Pattern Assignments

### `src/Csps.Server/Program.cs` (composition root, modify)

**Analog:** `74621f5:src/Csps.Server/Program.cs`; today's file is `src/Csps.Server/Program.cs` (87 lines).

Insert after `builder.Services.AddCspsOpenApi(builder.Environment);` (live line 49):
```csharp
// Brotli/gzip for the SPA's static html, css, js and svg only; JSON is never compressed (PERF-02, BREACH).
builder.Services.AddCspsSpaHosting();
```
Insert after `app.UseStatusCodePages(...)` (live line 68), before `UseSerilogRequestLogging` (prior lines 73-87):
```csharp
app.UseResponseCompression();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new HiddenSegmentFileProvider(app.Environment.WebRootFileProvider),
    OnPrepareResponse = SpaCaching.Apply,
});
// Explicit, so static files run before endpoint matching (L-02).
app.UseRouting();
```
After `app.MapCspsApiDocs();` (live line 82): `app.MapSpaHost();` (prior line 105). Keep the existing comment style: one plain-English line per middleware naming the requirement ID.

---

### `src/Csps.Server/Composition/SpaRegistration.cs` (config, file-I/O)

**Analog:** `74621f5:src/Csps.Server/Composition/SpaRegistration.cs` (62 lines). Core pattern (lines 20-61):
```csharp
public static IServiceCollection AddCspsSpaHosting(this IServiceCollection services)
{
    ArgumentNullException.ThrowIfNull(services);
    services.AddResponseCompression(options =>
    {
        options.EnableForHttps = true;
        options.Providers.Add<BrotliCompressionProvider>();
        options.Providers.Add<GzipCompressionProvider>();
        options.MimeTypes = SpaCaching.CompressibleTypes;   // replaces defaults: no JSON (BREACH)
    });
    return services;
}
public const string ImmutableCacheControl = "public, max-age=31536000, immutable";
public static IReadOnlyList<string> CompressibleTypes { get; } =
    ["text/html", "text/css", "text/javascript", "application/javascript", "image/svg+xml"];
public static void Apply(StaticFileResponseContext context) { /* /assets → immutable, else "no-cache" */ }
```
Same extension-method shape as live `src/Csps.Server/Composition/OpenApiRegistration.cs` / `SecurityRegistration.cs`.

---

### `src/Csps.Server/Composition/HiddenSegmentFileProvider.cs` (file-I/O guard, L-04)

**Analog:** `74621f5:src/Csps.Server/Composition/HiddenSegmentFileProvider.cs` (104 lines). Core (lines 27, 45-61, 66-92):
```csharp
private static readonly char[] Separators = ['/', '\\'];
public static bool IsHidden(string? subpath)
{
    if (string.IsNullOrEmpty(subpath)) return false;
    foreach (var segment in subpath.Split(Separators, StringSplitOptions.RemoveEmptyEntries))
        if (segment[0] == '.' || segment.Contains('~', StringComparison.Ordinal)) return true;
    return false;
}
public IFileInfo GetFileInfo(string subpath) =>
    IsHidden(subpath) ? new NotFoundFileInfo(subpath) : _inner.GetFileInfo(subpath);
// GetDirectoryContents: NotFoundDirectoryContents.Singleton when hidden; VisibleDirectoryContents filters entries.
public IChangeToken Watch(string filter) => _inner.Watch(filter);
```
Build this in the tracer plan (L-04), with the `.vite/license.md` and `.x/y.txt` fixtures and a `File.Exists` guard in the test.

---

### `src/Csps.Server/Endpoints/SpaHosting.cs` (+ `ReservedPathMetadata.cs`) (route)

**Analog:** `74621f5:src/Csps.Server/Endpoints/SpaHosting.cs` (89 lines). Constants (lines 22-40) are the matrix keys:
```csharp
public const string ShellFile = "index.html";
public const string ShellPattern = "{*path:nonfile}";
public const string FilePattern = "{*path:file}";
public static IReadOnlyList<string> ReservedDocsPatterns { get; } = ["/openapi/{**path}", "/scalar/{**path}"];
```
Mapping (lines 48-88):
```csharp
app.MapFallback(FilePattern, NotFound).AllowAnonymous().ExcludeFromDescription();
if (!app.Environment.IsDevelopment())
    foreach (var pattern in ReservedDocsPatterns)
        app.MapFallback(pattern, NotFound).AllowAnonymous().ExcludeFromDescription()
           .WithMetadata(new ReservedPathMetadata());          // D-29
endpoints.MapFallbackToFile(ShellFile, new StaticFileOptions { OnPrepareResponse = static c => NoCache(c) })
         .AllowAnonymous();                                     // GET + HEAD only (L-01)
private static ProblemHttpResult NotFound(HttpContext context) =>
    TypedResults.Problem(CspsProblemDetails.Build(context, StatusCodes.Status404NotFound));
```
The 404 body goes through the live `src/Csps.Server/Http/CspsProblemDetails.cs` (shared error pattern below).

---

### `tests/Csps.Testing/CspsApiFactory.cs` + fixture web root (test fixture)

**Analog:** live `tests/Csps.Testing/CspsApiFactory.cs` lines 63-80 (`ConfigureWebHost`), plus `74621f5:` same file lines 91-93:
```csharp
// The .NET suite must never depend on `npm run build`: the host serves the committed fixture web root.
builder.UseSetting(WebHostDefaults.WebRootKey, FixtureWebRoot);
```
`FixtureWebRoot = Path.Combine(AppContext.BaseDirectory, "Fixtures", "webroot")`; csproj item `<None Include="Fixtures\webroot\**" CopyToOutputDirectory="PreserveNewest" />`. Folder name `webroot`, never `wwwroot` (Pattern 7). Never commit anything under `src/Csps.Server/wwwroot`.

---

### `tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs` (test, request-response)

**Analog:** `74621f5:tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs` (218 lines). Test shape (lines 20-49):
```csharp
[Theory]
[InlineData("/")] [InlineData("/products")] [InlineData("/admin/orders")]
public async Task NonFilePathsServeTheShell(string path)
{
    await using var factory = new CspsApiFactory();
    using var client = factory.CreateClient();
    using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
    response.StatusCode.ShouldBe(HttpStatusCode.OK, path);
    response.Content.Headers.ContentType.ShouldNotBeNull(path).MediaType.ShouldBe("text/html", path);
    response.Headers.CacheControl.ShouldNotBeNull(path).NoCache.ShouldBeTrue(path);
    SecurityHeadersTests.Single(response, SecurityHeadersTests.CspHeader).ShouldBe(SecurityHeadersTests.StrictCsp, path);
}
```
Conventions: xunit.v3 + Shouldly, `TestContext.Current.CancellationToken`, one factory per test, sealed class, XML doc naming requirement IDs. Also covers: unknown `/api` → ProblemDetails 404, missing file 404 for GET and POST, `UnservedMethodOnAPagePathIsChallenged` (POST page path → 401, L-01), compression, caching, D-29.

---

### `AuthorizationMatrix.cs` (modify)

**Analog:** live `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` lines 53-63, extended per `74621f5:` lines 55-72:
```csharp
new("GET",  "{*path:nonfile}", "/",          Anonymous: 200, Admin: 200, Manager: 200),
new("HEAD", "{*path:nonfile}", "/products",  Anonymous: 200, Admin: 200, Manager: 200),
new("*",    "{*path:file}",    "/missing.js", Anonymous: 404, Admin: 404, Manager: 404),
new("*",    "/openapi/{**path}", "/openapi/v1.json", Anonymous: 404, Admin: 404, Manager: 404),
new("*",    "/scalar/{**path}",  "/scalar",         Anonymous: 404, Admin: 404, Manager: 404),
```
Add each new key to `AnonymousAllowList` (currently `new[] { "* /health", "* /api/{**path}" }.ToFrozenSet(StringComparer.Ordinal)`). `AuthorizationCoverage` discovers endpoints automatically, so a missing row fails `DiscoveredEndpointsAreFullyCovered`.

---

### `src/Csps.Domain/Orders/OrderMath.cs` (pure domain, transform)

**Analog:** `74621f5:src/Csps.Domain/Orders/OrderMath.cs` (58 lines). Core (lines 27-57):
```csharp
var total = Round(items.Sum(item => item.Quantity * item.UnitPrice));      // 1
var discount = Round(discounts.Sum(d => DiscountAmount(d, total)));        // 2, 3
var balance = total - discount - paid;                                      // 4
private static decimal DiscountAmount(OrderMathDiscount discount, decimal itemsTotal) =>
    Round(discount.Kind == DiscountKind.Percentage ? itemsTotal * discount.Value / 100m : discount.Value);
private static decimal Round(decimal amount) => Math.Round(amount, Centavos, MidpointRounding.AwayFromZero);
```
Literal `100m`, never a `private const decimal` (L-11, Domain 100%). The domain layout follows live `src/Csps.Domain/Common/Result.cs` / `Content/SiteSettings.cs` (namespace per folder, XML docs, `ArgumentNullException.ThrowIfNull`).

**Golden vector test analog:** `74621f5:tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs` lines 12-46: a `Lazy<VectorFile>`, a `TheoryData<string> CaseIds`, `PinsTheOperationOrder` asserting the exact string `"round the items total; round each discount; sum the discounts and round the sum; subtract (D-09)"`, and `HasAtLeast200CasesWithUniqueIds`. The TS side (`74621f5:web/src/lib/csps.golden.test.ts`) asserts the same category list.

---

### `DependencyRegistry` / `PackagePins` (modify, L-08)

**Analog:** live `tests/Csps.ArchitectureTests/DependencyRegistry.cs`:
```csharp
private static readonly string[] Kinds = ["nuget", "tool"];           // line 17 → add "npm"
private static readonly string[] Scopes = ["runtime", "build", "test", "tool", "font"];
public static List<string> Validate(string? json, IReadOnlyCollection<PackagePin> pins)  // pure: text in, problems out
```
`PackagePins.cs` gains readers for `web/package.json` and `tools/openapi-gen/package.json` (folder-qualified ids, alias resolution, `overrides` as pins). Keep the pure-validator + thin test pattern of `DependencyRegistryTests.cs`.

---

### `web/vite.config.ts` (build config)

**Analog:** `74621f5:web/vite.config.ts` (55 lines). Keep its structure: a header line citing App. D.7, each delta prefixed `// SPEC-DEVIATION:`, the `isAppSource` filter (lines 11-20, L-27 `string | undefined`), `__DEV_ROUTES__` define (line 35), the 5180/strictPort/http-5115 proxy (lines 39-43), `outDir` per mode (line 47), `assetsInlineLimit: 0`, `sourcemap: false`. **Changes:** `license: false` (D-35; prior line 53 had `true`) and add `budgetPlugin({ devRoutes })` per RESEARCH Pattern 1.

### `web/vitest.config.ts`

**Analog:** `74621f5:web/vitest.config.ts` (43 lines): `mergeConfig(viteConfig({ ...env, mode: 'test' }), …)` so tests run the compiled React Compiler output; jsdom; `setupFiles: ['src/test/setup.ts']`; coverage v8 with per-folder threshold `'src/lib/http/**': 100`. **Drop** `referenceResolvePlugin` and the `src/ui/__reference__/**` exclude (DOM-differential approach retired). Add the node-env project/files for `stylesheet-contract.test.ts` and `scripts/tailwind-classes.test.ts`; the JUnit output dir `web/.vitest/` is gitignored (L-28).

### `web/eslint.config.mjs`

**Analog:** `74621f5:web/eslint.config.mjs` (197 lines). Copy the `escalateEntry`/`escalate` helpers (lines 16-40) verbatim in spirit: every warn → error with options kept (L-19). Replace its restriction block with RESEARCH Pattern 6 (lines 1007-1046): **one** `syntaxBans` array including the D-33 selectors (`style` only `--*`, no `TemplateLiteral`/`+` in `className`, no `cssText`, no `setAttribute('style')`), the `*.css` import ban with negations for `@/styles/app.css` and `@fontsource*`, and re-spread it in per-file overrides (`src/lib/http/**`, `src/lib/api.ts`, `src/main.tsx`). Add `eslint-plugin-better-tailwindcss` 4.7.0 (D-36). Prove each ban through ESLint's `Linter` in a test, as `74621f5:web/src/test/lint-rules.test.ts` and `eslint-config.test.ts` did.

---

### `web/src/styles/app.css` + `base.css` (theme) — no repo analog

Use RESEARCH lines 527-575 (verified with tailwindcss 4.3.3): `@import "tailwindcss" source("../src")`, `@source not` for tests and `src/test`, `@import "./base.css" layer(base)`, the exact `@custom-variant` set (`dark`, `hover`, `pg-*`, `vp-*`, `no-hover`), `@theme { --*: initial; --spacing: 4px; ... }`, and `@theme inline` colour/font/shadow mappings. Only the allowed constructs listed in UI-SPEC line 71's table; enforced by `stylesheet-contract.test.ts`.

### `web/src/ui/*.tsx` + `*.recipe.ts` (components)

**Style pattern (no repo analog):** RESEARCH lines 672-702, the `button.recipe.ts` shape:
```ts
import clsx from 'clsx';
const base = 'inline-flex cursor-pointer items-center ...';            // complete literal tokens only
const variant = { primary: '...', secondary: '...' } as const satisfies Record<ButtonVariant, string>;
const size = { sm: 'h-9 px-3 text-[14px]', md: 'h-11 px-5 text-[15px]', lg: 'h-13 px-6 text-[16px]' } as const satisfies Record<ButtonSize, string>;
export const buttonClasses = (o: {...}) => clsx(base, variant[o.variant], size[o.size], o.block && 'w-full', o.iconOnly && iconOnly[o.size], o.className);
```
Rules: literals only, disjoint axes, `className` = layout glue only, shared recipes (Button/ButtonLink/SkipLink; Field family), context via props, no `{...rest}` spreads (L-13), no `.csp-*`/`.s-*` class hooks; use `data-ui="<spec name>"` + `in-data-[ui=...]:` (RESEARCH lines 649-653, 1396-1406). Dynamic values only through `style={{ '--x': v }}` (RESEARCH lines 1408-1413).

**Behaviour/ARIA pattern (reuse from 74621f5, ignore its classNames):**
- `74621f5:web/src/ui/icons.ts` (129 lines): per-icon named lucide imports behind `<Icon name=… />`, the header `// SPEC-DEVIATION: D-10 lucide-react wrapper…`, `trash-2`→`Trash`, `filter`→`Funnel` aliases (D-32). Update the version note to 1.53.0 (D-34).
- `74621f5:web/src/ui/mark.tsx`: Mark as JSX, no `dangerouslySetInnerHTML`.
- `74621f5:web/src/ui/gaps/SkipLink.tsx` lines 8-17: `preventDefault()` then `document.getElementById(targetId)?.focus()`; copy from `gaps/copy.ts`. Replace `className="csp-btn ..."` with `buttonClasses(...)` plus focus-visible utilities.
- Same for `gaps/Checkbox`, `ErrorState`, `FilterBar`, `LazyImage`, `LoadingRegion`, `MoneyInput`, `OtpInput`, `Pagination`, `ResponsiveTable`, `SearchBox`, `Skeletons`, `useDelayedFlag`, `copy.ts`, and their `*.test.tsx` (role/label queries, `expectNoAxeViolations`). `74621f5:web/src/ui/PasswordField.test.tsx` for PasswordField.

---

### `web/src/lib/http/httpClient.ts` (service, request-response)

**Analog:** `74621f5:web/src/lib/http/httpClient.ts` (546 lines) + `HttpError.ts` + 4 test files (100% coverage). Header and types (lines 1-70):
```ts
// The project's only HTTP transport (WEB-03, PRD 9.3): an axios-like client over fetch. src/lib/api.ts is its only
// consumer (WEB-04, enforced by ESLint). Every failure rejects with an HttpError; a raw Response never escapes.
import { HttpError, isHttpError, parseProblemDetails } from './HttpError';
export interface RequestConfig { readonly method?: HttpMethod | undefined; readonly url: string; ...
  readonly idempotencyKey?: string | undefined; readonly onUploadProgress?: ((p: UploadProgress) => void) | undefined; }
```
Note the `| undefined` on every optional (exactOptionalPropertyTypes) and "no body" = `null` (L-14). Behaviours per RESEARCH Pattern 5. Tests use `74621f5:web/src/test/fakeFetch.ts` (planned answers incl. `networkError`/`hang`); wait for in-flight with `vi.waitFor` (L-25).

### `web/src/lib/api.ts` + `tools/openapi-gen/`

**Analog:** `74621f5:web/src/lib/api.ts` (39 lines), whole file:
```ts
import type { components } from '@/types/api.generated';
import { createHttpClient, type HttpClient } from './http/httpClient';
export { HttpError, isHttpError, type HttpErrorKind } from './http/HttpError';
type Schemas = components['schemas'];
export type SiteSettings = Schemas['SiteSettingsDto'];
export function createApi(client: HttpClient): Api { return { site: { settings: (signal) => client.get<SiteSettings>('/site-settings', { signal }) } }; }
export const api: Api = createApi(createHttpClient({ baseURL: '/api/v1' }));
```
Keep its convention comment block (lines 1-11). Generator/drift check: `74621f5:tools/openapi-gen/check.mjs`, `package.json`, `.npmrc`, `openapi.v1.json`; server side snapshot test `74621f5:tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs`.

### `web/src/lib/query/*`, `web/src/lib/url-state/*`

**Analogs:** `74621f5:web/src/lib/query/queryClient.ts` (20 lines):
```ts
export const QUERY_DEFAULTS = {
  queries: { staleTime: 30_000, gcTime: 300_000, retry: false, refetchOnWindowFocus: true },
  mutations: { retry: false },
} as const satisfies DefaultOptions;
export function createQueryClient(): QueryClient { return new QueryClient({ defaultOptions: QUERY_DEFAULTS }); }
```
`prefetchOnIntent.ts` must use `queryClient.query(options).catch(() => undefined)` (L-15). `74621f5:web/src/lib/url-state/UrlStateLayout.tsx` (14 lines):
```tsx
import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';
export default function UrlStateLayout() {
  return (<NuqsAdapter defaultOptions={URL_STATE_DEFAULTS} processUrlSearchParams={orderSearchParams}><Outlet /></NuqsAdapter>);
}
```
Plus `parsers.ts`, `defaultOptions.ts`, `createListParams.ts`, `useListQuery.ts`, `useDebouncedValue.ts` with tests (L-16/L-17: assert `window.location.search` with `createBrowserRouter`).

### `web/src/lib/forms/*`, `lib/errors/describeHttpError.ts`, `lib/csps.ts`, `lib/format.ts`

**Analogs:** `74621f5:` same paths with tests. `csps.ts` header (lines 4-6) documents D-09 "figures are PREVIEWS; server is authoritative"; keep it. Integer-centavo rounding through exact decimal text (L-12).

---

### `web/src/main.tsx`, `app/router.tsx`, layouts, `RouterLink.tsx`

**Analogs:** `74621f5:web/src/main.tsx`, `74621f5:web/src/app/RouterLink.tsx` (11 lines, `import { Link } from 'react-router'`). Router per RESEARCH Pattern 2 (`createBrowserRouter`, `HydrateFallback`, `ErrorBoundary`, `...(__DEV_ROUTES__ ? adminRoutes : [])`, `RouterProvider` from `react-router/dom`). Root error callbacks (RESEARCH lines 1373-1380). Theme init with a lazy `useState` initializer and guarded `localStorage` (lines 1389-1394). `main.tsx` imports fontsource CSS + `@/styles/app.css` only, marked `// SPEC-DEVIATION: D-33`.

### `web/playwright.config.ts`, `web/e2e/fixtures.ts`, `web/scripts/e2e.mjs`

**Analogs:** `74621f5:web/e2e/fixtures.ts` (140 lines). Key pattern (lines 34-40, 59):
```ts
const CSP_BINDING = '__cspsE2eCspViolation';
const cspListener = `document.addEventListener('securitypolicyviolation', (event) => {
  window.${CSP_BINDING}({ directive: event.effectiveDirective || event.violatedDirective, blockedURI: event.blockedURI });
}, true);`;
export const test = base.extend<{ guard: Guard }>({ guard: [ /* console, pageerror, CSP via exposeBinding, >=400 responses */ ] });
```
`74621f5:web/scripts/e2e.mjs` (119 lines): `// @ts-check`, preflight → refuse busy 5199 (never kill) → guarded seed of `CSPS_E2E` → `vite build --mode e2e` → `playwright test`. `run()` helper uses `spawnSync(command, args, { cwd, stdio: 'inherit' })`; spawn `process.execPath` + the JS entry, never `.cmd` shims (L-22). The seed guard is the live `src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs` (refuses any DB except `CSPS_Dev`/`CSPS_E2E`). Playwright `webServer` per RESEARCH Pattern 11 (HTTPS 5199, `reuseExistingServer: false`, env set on that process only).

### `web/visual/**` parity harness (partial analog)

New under D-33. Reuse: the CSP listener/binding from `74621f5:web/e2e/fixtures.ts`; route-served pages with the live `SecurityHeadersMiddleware.StrictCsp` constant (`src/Csps.Server/Http/SecurityHeadersMiddleware.cs:16-17`) read as text; pixel A/B snippet from RESEARCH lines 965-973; comparator normalizations from lines 736-748. `rulings.css` values from `git show 74621f5:web/src/styles/overrides.css` (value source only).

### `web/scripts/license-gate.mjs` and friends

**Analog:** `74621f5:web/scripts/license-gate.mjs` (109 lines): `// @ts-check`, header comment listing the rules, `parseArgs` with `--allowed`/`--exceptions` overrides (for the RED proof), reads only installed `node_modules`, exits 1 on any problem, pure logic in `license-policy.mjs` with `license-policy.test.ts`. Re-create the D-26 + addendum entries in `docs/license-exceptions.json` (L-08/L-09).

### `web/scripts/vite-budget-plugin.ts` + `budget.ts`

**Closest analog:** `74621f5:web/scripts/vite-preload-font-plugin.ts` (+ `.test.ts`): a Vite plugin factory that fails closed with `this.error`. Split as pure `budget.ts` (gz sizes → verdicts; 150/250/35 KB; exactly one CSS asset) + a thin `generateBundle` plugin. `lighthouse-assert.mjs` follows the `e2e.mjs`/`license-gate.mjs` script style.

## Shared Patterns

### ProblemDetails for every server error
**Source:** `src/Csps.Server/Http/CspsProblemDetails.cs` (used in `Program.cs` lines 26-27, 62-68). **Apply to:** SPA 404 fallbacks. Use `TypedResults.Problem(CspsProblemDetails.Build(context, StatusCodes.Status404NotFound))`, never a hand-built body.

### Strict CSP is the contract
**Source:** `src/Csps.Server/Http/SecurityHeadersMiddleware.cs` lines 16-17 (`StrictCsp`). **Apply to:** `index.html` (no inline script/style), every component (no `style` attribute except `--*` via CSSOM), the parity harness and the E2E fixture. Assert it with `SecurityHeadersTests.Single(response, SecurityHeadersTests.CspHeader)` in .NET tests.

### Default-deny + explicit anonymous allow-list
**Source:** `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` + `AuthorizationCoverage.cs`. **Apply to:** every new endpoint (each SPA fallback gets `.AllowAnonymous()`, a matrix row and an allow-list key).

### Comment and doc style
- C#: `/// <summary>` on every public member, requirement/decision IDs in prose (`(WEB-01, D-29)`), `ArgumentNullException.ThrowIfNull` first.
- TS/MJS: a top-of-file `//` comment naming requirement IDs and the file's one rule; `// @ts-check` on `.mjs`; every spec delta marked `// SPEC-DEVIATION: <reason>`, every gap `// SPEC-GAP`.

### TDD evidence
RED with inert placeholders that compile (L-26). .NET: xunit.v3 + Shouldly + `TestContext.Current.CancellationToken`. Web: Vitest + RTL queries by role/label, `expectNoAxeViolations` from `74621f5:web/src/test/axe.ts` (lines 20-39: rejects empty container, contrast off in jsdom, sorted messages), real timers for axe and user-event (L-24).

### Shared-machine safety
Ports 5180/5115/7028/5199 hard-coded; preflight before servers (`e2e.mjs` pattern); env vars set per process only (Playwright `webServer.env`); LocalDB `(localdb)\CSPS`, `CSPS_E2E` via the seed guard.

### Dependency registration
Every npm package: `docs/dependencies.json` entry (purpose, license, publisher, legitimacy, scope) validated by `DependencyRegistry.Validate`; exact versions in `package.json`; `.npmrc` with save-exact and min-release-age.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `web/src/styles/app.css`, `base.css` | theme config | — | D-33 is new; use RESEARCH lines 527-575 and UI-SPEC line 71 table |
| `web/src/ui/*.recipe.ts` (class strings) | component styling | — | Prior CSS approach retired; use RESEARCH §Where Class Strings Live |
| `web/scripts/tailwind-classes.test.ts`, `stylesheet-contract.test.ts` | test gate | transform | New; RESEARCH line 712-713 (TS API + tailwind `compile()`) |
| `web/src/dev/scenarios.ts`, showcase | dev component | — | New single scenario list (RESEARCH lines 766-772) |
| `web/visual/reference/extract-spec.mjs`, `spec-appendix.sha256`, `parity.spec.ts` | test harness | batch | New; RESEARCH §Proving the Look Is Unchanged |

## Metadata

**Analog search scope:** `src/Csps.*`, `tests/*`, `docs/*` (working tree); `git ls-tree -r 74621f5 -- web tools/openapi-gen src tests` (reverted reference, D-37).
**Files scanned:** ~40 read or excerpted.
**Tracked-source gate:** all non-prefixed paths are from `git ls-files`; `74621f5:` paths are from `git ls-tree`. No gitignored mirror paths are named.
**Pattern extraction date:** 2026-10-08

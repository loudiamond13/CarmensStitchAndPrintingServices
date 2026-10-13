---
phase: 02-web-foundation-design-system
status: issues_found
depth: standard
created: 2026-10-13T06:15:00-05:00
updated: 2026-10-13T06:15:00-05:00
reviewed: 2026-10-13
files_reviewed: 292
findings:
  critical: 4
  warning: 42
  info: 40
  total: 86
lanes: [dotnet, tooling, weblib, webui]
files_reviewed_list:
  - src/Csps.Domain/Orders/OrderMath.cs
  - src/Csps.Domain/Orders/OrderMathModels.cs
  - src/Csps.Server/Composition/HiddenSegmentFileProvider.cs
  - src/Csps.Server/Composition/SpaRegistration.cs
  - src/Csps.Server/Endpoints/ReservedPathMetadata.cs
  - src/Csps.Server/Endpoints/SpaHosting.cs
  - src/Csps.Server/Program.cs
  - tests/Csps.ArchitectureTests/DependencyRegistry.cs
  - tests/Csps.ArchitectureTests/DependencyRegistryTests.cs
  - tests/Csps.ArchitectureTests/PackagePins.cs
  - tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj
  - tests/Csps.Domain.UnitTests/Orders/OrderMathGoldenVectorTests.cs
  - tests/Csps.Domain.UnitTests/Orders/OrderMathTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs
  - tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs
  - tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs
  - tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs
  - tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs
  - tests/Csps.Testing/Csps.Testing.csproj
  - tests/Csps.Testing/CspsApiFactory.cs
  - tests/Csps.Testing/Fixtures/webroot/.x/y.txt
  - tests/Csps.Testing/Fixtures/webroot/assets/app-fixture.js
  - tests/Csps.Testing/Fixtures/webroot/index.html
  - tests/Csps.Testing/Fixtures/webroot/robots.txt
  - tools/openapi-gen/.npmrc
  - tools/openapi-gen/check.mjs
  - web/.npmrc
  - web/.prettierignore
  - web/e2e/fixtures.ts
  - web/e2e/sweep.ts
  - web/eslint.config.mjs
  - web/index.html
  - web/parity.html
  - web/playwright.config.ts
  - web/scripts/budget.ts
  - web/scripts/class-gate.config.mjs
  - web/scripts/class-gate.mjs
  - web/scripts/design-side-by-side.mjs
  - web/scripts/e2e.mjs
  - web/scripts/font-metrics.mjs
  - web/scripts/gen-golden-vectors.mjs
  - web/scripts/golden-math.mjs
  - web/scripts/license-gate.mjs
  - web/scripts/license-policy.mjs
  - web/scripts/lighthouse-assert.mjs
  - web/scripts/lighthouse.mjs
  - web/scripts/npm-tree.mjs
  - web/scripts/owner-review.mjs
  - web/scripts/parity.mjs
  - web/scripts/third-party-notices.mjs
  - web/scripts/verify.mjs
  - web/scripts/vite-budget-plugin.ts
  - web/scripts/vite-preload-font-plugin.ts
  - web/scripts/vite-route-preload-plugin.ts
  - web/visual/compare.ts
  - web/visual/guard.ts
  - web/visual/intentional-differences.ts
  - web/visual/parity-matrix.ts
  - web/visual/playwright.visual.config.ts
  - web/visual/reference/extract-spec.mjs
  - web/visual/reference/fragments/AdminShell.tsx
  - web/visual/reference/fragments/DefinedTotalsNote.tsx
  - web/visual/reference/fragments/DimmedZeroKpi.tsx
  - web/visual/reference/fragments/FailedConfirmDialog.tsx
  - web/visual/reference/fragments/IconSet.tsx
  - web/visual/reference/fragments/KeyboardScrollTable.tsx
  - web/visual/reference/fragments/ListTable.tsx
  - web/visual/reference/fragments/MediaPlaceholderNoChip.tsx
  - web/visual/reference/fragments/OpenedDialog.tsx
  - web/visual/reference/fragments/OpenedSiteDrawer.tsx
  - web/visual/reference/fragments/Overlay.tsx
  - web/visual/reference/fragments/PublicShell.tsx
  - web/visual/reference/fragments/RatedTestimonial.tsx
  - web/visual/reference/fragments/RevealPassword.tsx
  - web/visual/reference/fragments/TabsWithPanel.tsx
  - web/visual/reference/fragments/Toolbar.tsx
  - web/visual/reference/fragments/WalkInOrderCard.tsx
  - web/visual/reference/index.html
  - web/visual/reference/kit.ts
  - web/visual/reference/main.tsx
  - web/visual/reference/reference.css
  - web/visual/reference/rulings.css
  - web/visual/reference/select.ts
  - web/visual/reference/spec-appendix.sha256
  - web/visual/scenarios.ts
  - web/visual/serve.ts
  - web/visual/vite.reference.config.ts
  - web/visual/webkit-style-sync.ts
  - web/vite.config.ts
  - web/vitest.config.ts
  - web/src/app/ErrorBoundary.tsx
  - web/src/app/Root.tsx
  - web/src/app/ShellFallback.tsx
  - web/src/app/admin/AdminLayout.tsx
  - web/src/app/admin/AdminPreviewPage.tsx
  - web/src/app/admin/TabBar.tsx
  - web/src/app/admin/admin.recipe.ts
  - web/src/app/admin/copy.ts
  - web/src/app/admin/routes.tsx
  - web/src/app/admin/sections.ts
  - web/src/app/admin/theme.ts
  - web/src/app/lazyRoute.ts
  - web/src/app/public/PublicLayout.tsx
  - web/src/app/public/PublicPlaceholderPage.tsx
  - web/src/app/public/SiteFooter.tsx
  - web/src/app/public/siteContact.ts
  - web/src/app/router.tsx
  - web/src/lib/api.ts
  - web/src/lib/csps.ts
  - web/src/lib/errors/describeHttpError.ts
  - web/src/lib/format.ts
  - web/src/lib/forms/focusFirstInvalid.ts
  - web/src/lib/forms/idempotencyKey.ts
  - web/src/lib/forms/useSubmission.ts
  - web/src/lib/http/HttpError.ts
  - web/src/lib/http/httpClient.ts
  - web/src/lib/query/keys.ts
  - web/src/lib/query/prefetchOnIntent.ts
  - web/src/lib/query/queryClient.ts
  - web/src/lib/query/useDebouncedValue.ts
  - web/src/lib/query/useListQuery.ts
  - web/src/lib/query/useSettledListParams.ts
  - web/src/lib/url-state/UrlStateLayout.tsx
  - web/src/lib/url-state/createListParams.ts
  - web/src/lib/url-state/defaultOptions.ts
  - web/src/lib/url-state/parsers.ts
  - web/src/main.tsx
  - web/src/styles/app.css
  - web/src/styles/base.css
  - web/src/test/axe.ts
  - web/src/test/axeTags.ts
  - web/src/test/consoleGuard.ts
  - web/src/test/fakeFetch.ts
  - web/src/test/setup.ts
  - web/src/types/react-css-custom-properties.d.ts
  - web/src/dev/ComponentShowcase.tsx
  - web/src/dev/ShowcaseDemos.tsx
  - web/src/dev/kit.ts
  - web/src/dev/parity-main.tsx
  - web/src/dev/previews/AdminShell.tsx
  - web/src/dev/previews/DefinedTotalsNote.tsx
  - web/src/dev/previews/DimmedZeroKpi.tsx
  - web/src/dev/previews/FailedConfirmDialog.tsx
  - web/src/dev/previews/FailedLazyImage.tsx
  - web/src/dev/previews/FocusedSkipLink.tsx
  - web/src/dev/previews/IconSet.tsx
  - web/src/dev/previews/KeyboardScrollTable.tsx
  - web/src/dev/previews/ListTable.tsx
  - web/src/dev/previews/ListTableState.tsx
  - web/src/dev/previews/LongUserName.tsx
  - web/src/dev/previews/MediaPlaceholderNoChip.tsx
  - web/src/dev/previews/OpenedDialog.tsx
  - web/src/dev/previews/OpenedNavDrawer.tsx
  - web/src/dev/previews/OpenedSiteDrawer.tsx
  - web/src/dev/previews/OpenedUserMenu.tsx
  - web/src/dev/previews/PendingLazyImage.tsx
  - web/src/dev/previews/PublicShell.tsx
  - web/src/dev/previews/RatedTestimonial.tsx
  - web/src/dev/previews/RevealPassword.tsx
  - web/src/dev/previews/TabsWithPanel.tsx
  - web/src/dev/previews/Toolbar.tsx
  - web/src/dev/previews/TracedErrorState.tsx
  - web/src/dev/previews/WalkInOrderCard.tsx
  - web/src/dev/previews/typeInto.ts
  - web/src/dev/renderScenario.tsx
  - web/src/dev/scenarios/collect.ts
  - web/src/dev/scenarios/groups/actions.ts
  - web/src/dev/scenarios/groups/brand.ts
  - web/src/dev/scenarios/groups/choice.ts
  - web/src/dev/scenarios/groups/data.ts
  - web/src/dev/scenarios/groups/entry.ts
  - web/src/dev/scenarios/groups/feedback.ts
  - web/src/dev/scenarios/groups/forms.ts
  - web/src/dev/scenarios/groups/layouts-admin-boundaries.ts
  - web/src/dev/scenarios/groups/layouts-admin.ts
  - web/src/dev/scenarios/groups/layouts-public.ts
  - web/src/dev/scenarios/groups/lists-states.ts
  - web/src/dev/scenarios/groups/lists.ts
  - web/src/dev/scenarios/groups/marketing.ts
  - web/src/dev/scenarios/groups/media.ts
  - web/src/dev/scenarios/groups/money.ts
  - web/src/dev/scenarios/groups/navigation-gaps.ts
  - web/src/dev/scenarios/groups/navigation.ts
  - web/src/dev/scenarios/groups/overlays.ts
  - web/src/dev/scenarios/groups/states.ts
  - web/src/dev/scenarios/groups/status.ts
  - web/src/dev/scenarios/index.ts
  - web/src/dev/scenarios/types.ts
  - web/src/dev/showcase.recipe.ts
  - web/src/dev/showcaseCopy.ts
  - web/src/dev/showcaseSections.ts
  - web/src/ui/actions/Button.tsx
  - web/src/ui/actions/ButtonLink.tsx
  - web/src/ui/actions/UiLink.tsx
  - web/src/ui/actions/button.recipe.ts
  - web/src/ui/actions/index.ts
  - web/src/ui/brand/Icon.tsx
  - web/src/ui/brand/Logo.tsx
  - web/src/ui/brand/Mark.tsx
  - web/src/ui/brand/MediaPlaceholder.tsx
  - web/src/ui/brand/SectionCut.tsx
  - web/src/ui/brand/StitchDivider.tsx
  - web/src/ui/brand/brand.recipe.ts
  - web/src/ui/brand/icons.ts
  - web/src/ui/brand/index.ts
  - web/src/ui/choice/SegmentedControl.tsx
  - web/src/ui/choice/Tabs.tsx
  - web/src/ui/choice/choice.recipe.ts
  - web/src/ui/choice/index.ts
  - web/src/ui/choice/roving.ts
  - web/src/ui/data/DataTable.tsx
  - web/src/ui/data/IncomeExpenseChart.tsx
  - web/src/ui/data/OrderCard.tsx
  - web/src/ui/data/copy.ts
  - web/src/ui/data/data.recipe.ts
  - web/src/ui/data/index.ts
  - web/src/ui/entry/Checkbox.tsx
  - web/src/ui/entry/MoneyInput.tsx
  - web/src/ui/entry/OtpInput.tsx
  - web/src/ui/entry/SkipLink.tsx
  - web/src/ui/entry/copy.ts
  - web/src/ui/entry/entry.recipe.ts
  - web/src/ui/entry/index.ts
  - web/src/ui/feedback/EmptyState.tsx
  - web/src/ui/feedback/Skeleton.tsx
  - web/src/ui/feedback/Toast.tsx
  - web/src/ui/feedback/ToastProvider.tsx
  - web/src/ui/feedback/feedback.recipe.ts
  - web/src/ui/feedback/index.ts
  - web/src/ui/feedback/toastQueue.ts
  - web/src/ui/forms/Field.tsx
  - web/src/ui/forms/PasswordField.tsx
  - web/src/ui/forms/Select.tsx
  - web/src/ui/forms/field.recipe.ts
  - web/src/ui/forms/index.ts
  - web/src/ui/index.ts
  - web/src/ui/layout/layout.recipe.ts
  - web/src/ui/lists/FilterBar.tsx
  - web/src/ui/lists/Pagination.tsx
  - web/src/ui/lists/ResponsiveTable.tsx
  - web/src/ui/lists/SearchBox.tsx
  - web/src/ui/lists/SkeletonTable.tsx
  - web/src/ui/lists/cells.tsx
  - web/src/ui/lists/columns.ts
  - web/src/ui/lists/copy.ts
  - web/src/ui/lists/index.ts
  - web/src/ui/lists/lists.recipe.ts
  - web/src/ui/marketing/CategoryCard.tsx
  - web/src/ui/marketing/ProcessSteps.tsx
  - web/src/ui/marketing/TestimonialCard.tsx
  - web/src/ui/marketing/index.ts
  - web/src/ui/marketing/marketing.recipe.ts
  - web/src/ui/media/ImageUploader.tsx
  - web/src/ui/media/index.ts
  - web/src/ui/media/media.recipe.ts
  - web/src/ui/money/KpiCard.tsx
  - web/src/ui/money/Money.tsx
  - web/src/ui/money/OrderTotals.tsx
  - web/src/ui/money/index.ts
  - web/src/ui/money/money.recipe.ts
  - web/src/ui/navigation/MobileNavDrawer.tsx
  - web/src/ui/navigation/Sidebar.tsx
  - web/src/ui/navigation/SiteHeader.tsx
  - web/src/ui/navigation/Topbar.tsx
  - web/src/ui/navigation/UserMenu.tsx
  - web/src/ui/navigation/index.ts
  - web/src/ui/navigation/navItem.recipe.ts
  - web/src/ui/navigation/navigation.recipe.ts
  - web/src/ui/overlays/ConfirmDialog.tsx
  - web/src/ui/overlays/Modal.tsx
  - web/src/ui/overlays/Overlay.tsx
  - web/src/ui/overlays/index.ts
  - web/src/ui/overlays/overlays.recipe.ts
  - web/src/ui/overlays/useBodyScrollLock.ts
  - web/src/ui/overlays/useFocusTrap.ts
  - web/src/ui/states/ErrorState.tsx
  - web/src/ui/states/LazyImage.tsx
  - web/src/ui/states/LoadingRegion.tsx
  - web/src/ui/states/Skeletons.tsx
  - web/src/ui/states/copy.ts
  - web/src/ui/states/index.ts
  - web/src/ui/states/states.recipe.ts
  - web/src/ui/states/useDelayedFlag.ts
  - web/src/ui/status/Avatar.tsx
  - web/src/ui/status/Badge.tsx
  - web/src/ui/status/StatusBadge.tsx
  - web/src/ui/status/index.ts
  - web/src/ui/status/status.recipe.ts
  - web/src/ui/status/tones.ts
  - web/src/ui/tw.ts
---

# Phase 02 Code Review

Standard-depth review of the phase-02 source changes (base 3b42ddc), run as four parallel lanes and merged here. Finding IDs are prefixed by lane so they stay unique.

| Lane | Critical | Warning | Info |
|---|---|---|---|
| dotnet (NET) | 0 | 5 | 6 |
| tooling (TOOL) | 1 | 14 | 9 |
| weblib (LIB) | 2 | 8 | 12 |
| webui (UI) | 1 | 15 | 13 |
| **Total** | **4** | **42** | **40** |

## Lane: dotnet (finding IDs prefixed NET-)

Full lane report: 02-REVIEW-lane-dotnet.md

## Phase 02: Code Review Report (lane: .NET server and test infrastructure)

*Created: 2026-10-13T05:29:51-05:00 · Updated: 2026-10-13T05:29:51-05:00*

**Reviewed:** 2026-10-13T10:29:51Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

### Narrative Findings (AI reviewer)

### Summary

This lane covers the .NET side of phase 02: SPA hosting (static files, the shell fallback, the missing-file and reserved-docs 404s), the hidden-segment file provider, response compression and caching, the authoritative `OrderMath`, and the test-infrastructure changes (fixture web root, OpenAPI snapshot, dependency-registry npm support, authorization-matrix rows).

I traced the hidden-segment rule against the ways a path can reach `PhysicalFileProvider`: decoded `%2E`, `%5C` backslashes, `..` segments, 8.3 short names, ADS suffixes and literal `%2F`. I found no bypass. JSON and ProblemDetails are kept out of compression (BREACH), and the missing-file 404 does not leak file metadata. No blockers were found.

The real defects are:

- `OrderMath` silently treats any non-`Percentage` discount kind as a peso amount.
- `OrderMathResult.Total` means something different from the PRD's `Total`.
- The security wrapper covers only one consumer of the web root.
- Static-file requests no longer write the FND-07 completion log event.
- The npm pin reader misses dependency sections, so packages in them skip the registry gate.

### Warnings

#### NET-WR-01: An undefined `DiscountKind` is silently valued as a fixed peso amount

**File:** `src/Csps.Domain/Orders/OrderMath.cs:52-53` (and `src/Csps.Domain/Orders/OrderMathModels.cs:4-11`)
**Issue:** `DiscountAmount` checks `discount.Kind == DiscountKind.Percentage` and treats everything else as `Fixed`. A C# enum can hold any integer value, and `default(DiscountKind)` is `Fixed` (value 0). So a discount kind that is out of range or never set (for example a legacy row mapped wrongly during migration, a bad cast, or a deserializer default) becomes a fixed peso discount equal to the stored value. A legacy "10 percent" read this way becomes ₱10.00 with no error. This is the authoritative money path (Core Value: server-computed totals, zero-loss migration, reconciliation in PRD §16), so it should fail loudly, not guess.
**Fix:**
```csharp
private static decimal DiscountAmount(OrderMathDiscount discount, decimal itemsTotal) => Round(discount.Kind switch
{
    DiscountKind.Fixed => discount.Value,
    DiscountKind.Percentage => itemsTotal * discount.Value / 100m,
    _ => throw new ArgumentOutOfRangeException(nameof(discount), discount.Kind, "Unknown discount kind."),
});
```
Add a unit test for `(DiscountKind)99`. Also consider making the enum start at 1 so an unset value is never a valid kind.

#### NET-WR-02: `OrderMathResult.Total` is the PRD's *Subtotal*, and the PRD's net *Total* is missing

**File:** `src/Csps.Domain/Orders/OrderMathModels.cs:24-38`, `src/Csps.Domain/Orders/OrderMath.cs:37,46`
**Issue:** PRD §5.1 defines `Subtotal = Σ LineTotal`, `Total = Subtotal − DiscountAmount` and `Balance = Total − TotalPaid`. ORD-07 shows "Subtotal, Discount, Total, Paid, Balance". In `OrderMathResult`, `Total` is the pre-discount items total (`Σ quantity × unit price`), and no field holds the net total. The balance is still correct. The risk is that a later phase maps `OrderMathResult.Total` to the ORD-01/ORD-07 "Total" column or to the reconciliation report's per-order Total (PRD §16 step 4). Staff and the legacy comparison would then see the pre-discount amount as the order total. That is the order-math integrity the Core Value protects. The naming copies the design's `csps.ts`, but the server is meant to be the single source of truth.
**Fix:** Rename `Total` to `Subtotal` and add `Total` as `Subtotal − Discount`, both here and in the golden-vector `expected` shape. The other option is to record an owner decision that overrides the PRD naming and put a `// SPEC-DEVIATION` note on the record. Whichever is chosen, settle it now, before Phase 5 builds DTOs on these names.

#### NET-WR-03: The hidden-segment rule wraps one middleware's provider, not the web root itself

**File:** `src/Csps.Server/Program.cs:79-83`, `src/Csps.Server/Endpoints/SpaHosting.cs:68`
**Issue:** The `HiddenSegmentFileProvider` is created inline for the single `UseStaticFiles` call. `IWebHostEnvironment.WebRootFileProvider` is still the raw provider, so every other consumer of the web root skips the L-04 rule:
- `MapFallbackToFile` (its `StaticFileOptions` has no `FileProvider`).
- Any future `UseDefaultFiles`, `UseFileServer` or `UseDirectoryBrowser`.
- Any service that resolves files through `IWebHostEnvironment`.

Today the shell path is fixed (`index.html`), so this cannot be exploited yet. But this is a security control (CWE-538/200), and it currently depends on every future caller remembering to wrap the provider by hand.
**Fix:** Wrap the provider once, before any middleware, and use it everywhere:
```csharp
app.Environment.WebRootFileProvider = new HiddenSegmentFileProvider(app.Environment.WebRootFileProvider);
app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = SpaCaching.Apply }); // uses the wrapped provider
```
Then add a test asserting `factory.Services.GetRequiredService<IWebHostEnvironment>().WebRootFileProvider is HiddenSegmentFileProvider`.

#### NET-WR-04: Static-file responses no longer write the FND-07 request-completion event

**File:** `src/Csps.Server/Program.cs:79-91`
**Issue:** `UseStaticFiles` now runs before `UseSerilogRequestLogging`. `StaticFileMiddleware` ends the request without calling `next` when it serves a file, including 304 Not Modified and 416 responses. Every request for JS, CSS, fonts, SVG, `robots.txt` or `/index.html` therefore produces no completion event. This breaks the comment on line 88 ("One completion event per request") and the FND-07 contract stated in `tests/Csps.Server.IntegrationTests/Logging/RequestLoggingTests.cs:9` ("every request writes one Serilog request-completion event"). No test covers a static path, so nothing catches the gap. In practice, an incident timeline loses all asset traffic, including scanners probing real files.
**Fix:** Move `app.UseSerilogRequestLogging(...)` above `UseResponseCompression()`/`UseStaticFiles()`, after `UseStatusCodePages`. Add a `RequestLoggingTests` row for `/assets/app-fixture.js`. If leaving static files out of the log is deliberate, update the Program.cs comment and the FND-07 test doc to say so, and record that decision.

#### NET-WR-05: npm pins ignore `optionalDependencies`, `peerDependencies` and `bundleDependencies`, so packages there skip the registry gate

**File:** `tests/Csps.ArchitectureTests/PackagePins.cs` (`NpmSections`, `ReadNpmManifest`)
**Issue:** `NpmSections = ["dependencies", "devDependencies", "overrides"]`. npm 7+ installs `peerDependencies` automatically and installs `optionalDependencies` by default. A package added to any of the three missing sections is installed without a registry entry, without the exact-version check and without the 14-day cool-down check. QUAL-06/D-18/D-19 exist to stop exactly that. The gate is silently open, not failed-closed.
**Fix:** Add `"optionalDependencies"`, `"peerDependencies"` and `"bundleDependencies"` (the last is an array, so handle it). Better still, fail when the manifest has any `*ependencies` key not in an allow-list, so a new section can never be skipped silently. Add a `DependencyRegistryTests` case that puts a package under `optionalDependencies` and expects a "has no registry entry" problem.

### Info

#### NET-IN-01: `FullyPaid` is true for a fully discounted order with no payment, but false for an empty order

**File:** `src/Csps.Domain/Orders/OrderMath.cs:49`
**Issue:** `FullyPaid = total > 0 && balance <= 0`. With items of ₱51 and a 100% discount (allowed by PRD §5.1), `balance` is 0, so the order reads as fully paid with ₱0 received. An order with no items reads as not paid. The PRD defines no fully-paid rule, and §21 leaves overpayment open. This is a business rule hidden inside the arithmetic.
**Fix:** Have the owner confirm the rule (and whether `total` should be the net total, see NET-WR-02), then note the decision in the XML doc.

#### NET-IN-02: `OrderMath` does not guard null elements or PRD invariants

**File:** `src/Csps.Domain/Orders/OrderMath.cs:31-43`
**Issue:** The code checks only that each list is not null. A `null` item or discount inside a list throws `NullReferenceException`. It also accepts negative quantities, negative prices, a negative percent or a percent above 100, which PRD §5.1 forbids. The doc says "arithmetic only", so this is acceptable only if the Order aggregate enforces those rules.
**Fix:** Add `ArgumentNullException` for null elements, or document that callers must pass validated aggregate state. Make sure the Phase 5 aggregate tests cover the invariants.

#### NET-IN-03: `{*path:file}` sends dotted client routes to a JSON 404

**File:** `src/Csps.Server/Endpoints/SpaHosting.cs:28,34`
**Issue:** Any page URL whose last segment contains a dot (for example `/admin/users/j.smith`, `/admin/orders/2026.0042`, or a slug like `v1.2`) matches the file pattern. On refresh or on a shared link it returns a ProblemDetails 404 instead of the shell. No current route has a dynamic parameter, but later phases add detail routes.
**Fix:** Record this as a routing constraint in docs/web (route params must never contain a dot, or must be encoded), or add a test that fails when a route definition allows dotted params.

#### NET-IN-04: The shell's no-cache value duplicates `SpaCaching.RevalidateCacheControl`

**File:** `src/Csps.Server/Endpoints/SpaHosting.cs:90-91`
**Issue:** `NoCache` hard-codes `"no-cache"` instead of using `SpaCaching.RevalidateCacheControl`. The two cache policies can drift apart.
**Fix:** `context.Context.Response.Headers[HeaderNames.CacheControl] = SpaCaching.RevalidateCacheControl;`

#### NET-IN-05: Compressed and uncompressed representations share one strong ETag

**File:** `src/Csps.Server/Composition/SpaRegistration.cs:27-35` with `Program.cs:74-83`
**Issue:** `StaticFileMiddleware` sends a strong ETag, and `ResponseCompressionMiddleware` passes it through unchanged for the `br`, `gzip` and identity bodies. RFC 9110 §8.8.3 requires different strong validators for different representations. `Vary: Accept-Encoding` covers most caches, but `If-Range` and intermediaries that dedupe by ETag can mix them up.
**Fix:** Serve precompressed `.br`/`.gz` assets with their own ETags (for example `MapStaticAssets` or a build-time precompression step), or accept and document the risk.

#### NET-IN-06: Some integration rows in the hidden-segment test pass without testing their rule

**File:** `tests/Csps.Server.IntegrationTests/Http/HiddenSegmentFileProviderTests.cs:25-37`
**Issue:**
- The `/VITE~1/...` rows prove the tilde rule end to end only where NTFS generates 8.3 names. On the ubuntu CI runner, and on Windows volumes with short names off (for example Dev Drive/ReFS), they pass because the file simply does not exist. The existence guard checks `.vite/license.md`, not the alias.
- The `%2Evite` rows are, as their comment admits, identical to the plain rows.

The unit `IsHiddenRules` cases do cover the rule, so this is a test-reliability note only.
**Fix:** Mark the 8.3 rows as best-effort in the comment, or guard them with a check that `VITE~1` actually resolves through the inner provider. Drop the duplicate `%2E` rows or send the raw encoded path through a custom `HttpRequestMessage` that skips `Uri` normalization.

---

_Reviewed: 2026-10-13T10:29:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_


## Lane: tooling (finding IDs prefixed TOOL-)

Full lane report: 02-REVIEW-lane-tooling.md

## Phase 2: Code Review Report (lane: tooling)

**Reviewed:** 2026-10-13T10:36:24Z
**Depth:** standard
**Files Reviewed:** 66 (of 68 in the lane list)
**Status:** issues_found

### Summary

This lane covers the web build, verify, budget, license, class-gate, E2E, Lighthouse, owner-review, parity and
OpenAPI-drift tooling, plus the Vite, Vitest, Playwright and ESLint configs. The review looked hardest at gates that
could pass when they should fail.

Most gates fail closed and are written with care. The budget graph walk throws on an unknown chunk. A missing
Lighthouse category or metric counts as a failure. The notices check fails when the tree is empty. The spec extraction
writes nothing when the pin does not match. Path guards protect every script that writes files, and nothing passes
untrusted input to a shell.

The weak spots are where a gate trusts something that it does not check itself:

- **Critical (TOOL-CR-01):** the switch that turns dev routes on is read from `process.env` and from git-ignored `.env.*`
  files, and production mode honours it. The D-20 guard in the budget plugin is turned off by that same switch, so dev
  and admin routes and `parity.html` can reach `wwwroot` with no error.
- **License policy:** any `X WITH <anything>` passes when X is allowed. Licenses that license-checker only guessed also
  pass.
- **Parity yardstick:** the spec pin hashes the blocks joined with no separator. Fragments can silently shadow frozen
  spec components. The icon mask covers every SVG whose viewBox is `0 0 24 24`, not only icons.
- **Class and colour gates:** they only read literal class positions, and their colour-literal patterns miss most CSS
  colour syntaxes.
- **Shared-machine run scripts:** the preflight only prints a report and never makes a run wait. A crashed run leaves
  the lock in place. On POSIX, Ctrl+C leaves the host running.

Not opened: `web/.env.budget` and `web/.env.e2e`. The secret-file guard blocks reading them. Their role, the
`VITE_DEV_ROUTES` switch, was reviewed through `vite.config.ts`.

### Critical Issues

#### TOOL-CR-01: The production build obeys `VITE_DEV_ROUTES` from the environment and turns off its own D-20 guard

**File:** `web/vite.config.ts:30-31` (also `:48`, `:52`, `:69`, `:84-91`); `web/scripts/budget.ts:196-206`;
`web/scripts/vite-budget-plugin.ts:110-114`

**Issue:** The config computes:

```ts
const env = loadEnv(mode, process.cwd(), 'VITE_');
const devRoutes = mode === 'development' || env.VITE_DEV_ROUTES === 'true';
```

Vite's `loadEnv` merges every `VITE_*` variable from `process.env`. The installed `vite/dist/node/chunks/node.js` has
`for (const key in process.env) if (prefixes.some(...)) env[key] = process.env[key]`, so process variables win over the
files. It also reads `.env`, `.env.local`, `.env.production` and `.env.production.local`. `.gitignore` ignores all of
these through `.env*`, so a developer can have one locally and it never shows up in review.

So a plain production `vite build` with `VITE_DEV_ROUTES=true` in the shell, in CI, or in an untracked `.env.local`
produces this:

- `outDir` is still `../src/Csps.Server/wwwroot`, because that choice depends only on `mode`.
- `__DEV_ROUTES__` is `true`, so the admin preview, `/dev/components` and `src/dev/**` are compiled in.
- `parity.html` becomes a second entry in `wwwroot`.
- `budgetPlugin({ devRoutes: true })` skips exactly the checks meant to catch this: the "unexpected entry" check, the
  `DEV_ONLY_MODULE_PREFIXES` check (`budget.ts:196`) and the wwwroot reference-folder check
  (`vite-budget-plugin.ts:112`).
- `routePreloadPlugin` is dropped as well.

The build passes with no error, and the deployable web root ships dev-only code (CWE-489, D-20). The guard and the
thing it guards depend on the same untrusted flag.

A smaller issue in the same code: `process.cwd()` is not the config directory. Running from the repository root with
`--config web/vite.config.ts` silently drops `.env.e2e` and `.env.budget`.

**Fix:** Decide dev routes from the mode only, refuse the flag in production, and key the production checks to the
mode, not the flag:

```ts
const webRoot = fileURLToPath(new URL('.', import.meta.url));
const DEV_ROUTE_MODES = new Set(['development', 'e2e', 'budget']);
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, webRoot, 'VITE_');
  if (mode === 'production' && env.VITE_DEV_ROUTES !== undefined && env.VITE_DEV_ROUTES !== 'false') {
    throw new Error('VITE_DEV_ROUTES must never be set for a production build (D-20).');
  }
  const devRoutes = DEV_ROUTE_MODES.has(mode) && (mode === 'development' || env.VITE_DEV_ROUTES === 'true');
  // ...
  budgetPlugin({ devRoutes, production: mode === 'production' }),
```

In `evaluateBudgets` and `writeBundle`, run the entry, dev-module and reference-folder checks whenever
`production === true`, whatever `devRoutes` says. Add a test that sets `process.env.VITE_DEV_ROUTES = 'true'` and
expects the production config to throw.

### Warnings

#### TOOL-WR-01: The SPDX `WITH` clause accepts any exception id, so restrictive add-ons pass as the base license

**File:** `web/scripts/license-policy.mjs:118-124`

**Issue:** `atom()` checks only that the token after `WITH` is a plain id, then returns `allowed.has(baseLicense)`.
So `Apache-2.0 WITH Commons-Clause`, or `MIT WITH LicenseRef-NonCommercial`, passes as Apache-2.0 or MIT. The Commons
Clause forbids selling the software, the opposite of the free-only rule (D-00). The license tests cover malformed
expressions but not a hostile exception id.

**Fix:** Keep an explicit list of allowed exception ids (for example `LLVM-exception` and `Classpath-exception-2.0`)
and fail on any other:

```js
const ALLOWED_WITH = new Set(['LLVM-exception', 'Classpath-exception-2.0']);
if (peek() === 'WITH') { take(); const id = take(); if (!isPlain(id)) throw ...; if (!ALLOWED_WITH.has(id)) return false; }
```

#### TOOL-WR-02: Licenses that license-checker only guessed pass the gate and are just printed

**File:** `web/scripts/license-policy.mjs:169-172`, `:186-187`, `:326-328`; `web/scripts/license-gate.mjs:121-124`

**Issue:** license-checker adds a `*` to a license it guessed, often from a README line such as "License: MIT".
`withoutGuessMark` strips the `*` and the package is judged as if it had declared that license. The gate only prints
one "Guessed licenses" line. A new transitive package whose README guess is wrong passes a gate that enforces a binding
owner rule.

**Fix:** Fail on a guessed license unless that exact `name@version` is listed in a reviewed file such as
`docs/license-guesses.json`, with the license text checked. Report a listed guess that no longer appears as stale, the
same way stale exceptions are reported.

#### TOOL-WR-03: The spec-appendix pin cannot see content moved from one appendix to the next

**File:** `web/visual/reference/extract-spec.mjs:107-113`

**Issue:** `hashAppendices` feeds the nine blocks into one SHA-256 with no separator. Every block ends in `\n`, so a
line moved from the end of one appendix to the start of the next leaves the joined bytes, and the hash, unchanged. The
extracted files still change. For example, a rule moved from `components.css` to `screens.css` changes the cascade
layer. The "the yardstick never moves silently" promise breaks.

**Fix:** Hash each block with its file name and length, then re-pin once with the owner:

```js
for (const file of Object.values(APPENDIX_FILES)) {
  const text = blocks.get(file) ?? '';
  hash.update(`${file}\0${Buffer.byteLength(text, 'utf8')}\0`, 'utf8');
  hash.update(text, 'utf8');
}
```

#### TOOL-WR-04: A reference fragment silently replaces a frozen spec component with the same name

**File:** `web/visual/reference/kit.ts:30-33`

**Issue:** `kit = { ...components(spec), ...fragments }`, and the comment says "fragments win on a name clash". If
someone adds `fragments/Button.tsx` (or any of the 42 frozen exports), the reference side renders hand-written code in
place of the approved design. Parity then compares the app against a copy anyone can edit, not against the pinned spec,
and no check or registry entry records it. There is no clash today (checked against `.reference-src/ui/index.tsx`).

**Fix:** Throw on a clash unless the name is in an explicit, decision-tagged wrap list:

```ts
const clashes = Object.keys(fragmentComponents).filter((name) => name in specComponents && !WRAPS.has(name));
if (clashes.length > 0) throw new Error(`Fragments shadow frozen spec components: ${clashes.join(', ')}`);
```

#### TOOL-WR-05: The icon mask hides every 24 x 24 SVG drawing, not only lucide icons

**File:** `web/visual/intentional-differences.ts:109-116`; `web/visual/compare.ts:253`, `:388-390`

**Issue:** The D-32 mask is keyed only on `viewBox="0 0 24 24"`. Any SVG with that viewBox has its subtree removed
from the style comparison and its drawing masked in screenshots. That includes spinners, check marks, chevrons inside
components, and the brand mark if it uses that viewBox. A broken path in any of them, or a wrong drawing, is invisible
to parity. D-32 approved new icon drawings, not "any 24 px SVG".

**Fix:** Mark icon wrappers explicitly on both sides (for example `data-icon` on the lucide wrapper and on the
reference `Icon`) and mask only `svg[data-icon][viewBox="0 0 24 24"]`. Add a test that a non-icon 24 x 24 SVG is still
compared.

#### TOOL-WR-06: Class strings held in variables outside `*.recipe.ts` escape both class gates

**File:** `web/scripts/class-gate.mjs:116-150`, `:177-196`; `web/eslint.config.mjs:273-277`

**Issue:** The class gate and `better-tailwindcss` read only `className` literals and branches, `clsx` and `tw`
arguments, and string literals in recipe files. `readClassExpression` ignores identifiers. So the following passes
both gates and compiles to no CSS:

```ts
const x = 'bg-blue-500';
<div className={x} />
```

That is exactly the cleared-default bug the gate exists to catch. The source has 275 `className={identifier}` sites.
Today they all point at `tw()` results in recipes, but only by convention.

**Fix:** Pick one:

- Add a lint rule that a `className={Identifier}` must resolve to an import from a `*.recipe.ts` module or to a `tw()`
  or `clsx()` initialiser.
- Have the class gate resolve identifiers to their initialisers through the TypeScript checker and read those.

#### TOOL-WR-07: The colour-literal gates miss most CSS colour syntaxes

**File:** `web/scripts/class-gate.config.mjs:31`; `web/eslint.config.mjs:287-289`

**Issue:** Both gates ban only `#hex`, `rgb(`, `rgba(` and `oklch(`. These compile under Tailwind v4, so they also pass
the "unknown" check:

- `bg-[hsl(0_0%_50%)]`
- `text-[hwb(...)]`, `lab(`, `lch(`, `oklab(`, `color(`, `color-mix(`
- named colours: `bg-[red]`, `text-[color:tomato]`, `border-[transparent]`

UI-SPEC transcription rule 2 (colours come from tokens) can be bypassed without either gate noticing.

**Fix:** Ban any arbitrary colour value that is not a `var(--…)` token. One option is a single pattern on the bracket
content of colour-taking utilities, e.g. `/\[(?:color:)?(?!var\()[^\]]+\]/` for
`bg-`/`text-`/`border-`/`fill-`/`stroke-`/`ring-`/`outline-`/`shadow-`/`from-`/`via-`/`to-`/`decoration-`/`accent-`/`caret-`.
The simpler option is to add `hsla?\(|hwb\(|lab\(|lch\(|oklab\(|color\(|color-mix\(` plus a named-colour list. Use the
same pattern in both files.

#### TOOL-WR-08: The preflight is report-only, so E2E, Lighthouse, owner-review and parity runs never wait for TheBETSLLC

**File:** `web/scripts/e2e.mjs:48-57`; `web/scripts/lighthouse.mjs:66-75`; `web/scripts/owner-review.mjs:186-195`;
`web/scripts/parity.mjs:38-46`

**Issue:** CLAUDE.md is binding: "If a port is IN USE by another project, or TheBETSLLC's test processes are listed,
wait." `C:\Work\dev-tools\preflight.ps1` only prints its report and always exits 0. Each script prints that report and
starts building, seeding and starting a host at once. Only port 5199 is actually checked. A TheBETSLLC Playwright or
test run in progress does not stop or delay anything, and the warning scrolls past in inherited output. On a machine
without the preflight script, the step is skipped with no message.

**Fix:** After the preflight, do the check in the script itself. For example, list processes whose command line
contains `C:\Work\TheBETSLLC` with `Get-CimInstance Win32_Process`. Refuse, or wait under the same 15-minute rule as the
lock, while any are running. Log a line when the preflight script is missing instead of skipping it silently.

#### TOOL-WR-09: A crashed run leaves `.locks/e2e.lock` behind, and every later run waits 15 minutes and then fails

**File:** `web/scripts/e2e.mjs:122-162`

**Issue:** The lock is released by `finally`, on `exit` and on SIGINT/SIGTERM. It is not released when the run is
killed (Task Manager, `taskkill /F`, closing the console, which sends SIGHUP on Windows, or a power loss). The token
already holds the PID, but `acquireLock` never checks whether that process is still alive. Every later e2e, Lighthouse
or owner-review run polls for 15 minutes and then says "Another ... run has held ... Wait for it to finish", which is
wrong, and nothing tells the user how to recover. `parity.lock` has the same problem.

**Fix:** On `EEXIST`, read the token. If its PID is no longer running (`process.kill(pid, 0)` throws `ESRCH`), or the
lock is older than a hard ceiling, remove it with an atomic rename-then-delete and try again. Name the lock file and how
to clear it in the timeout message. Handle `SIGHUP` too.

#### TOOL-WR-10: On Linux and macOS, Ctrl+C leaves the API host running on 5199

**File:** `web/scripts/lighthouse.mjs:214-220`, `:330-336`; `web/scripts/owner-review.mjs:976-982`

**Issue:** `startHost` spawns the host with `detached: true` on non-Windows systems, in its own process group, so the
terminal's SIGINT does not reach it. `onSignal` releases the lock and calls `process.exit(130)` without calling
`host.stop()`. The `finally` that would stop the host never runs after `process.exit`. Result: an orphaned `dotnet`
host on 5199 and a released lock. The next run then refuses with "port busy", or, worse, a run that starts later talks
to the stale host.

**Fix:** Keep a module-level reference to the running host. In `onSignal`, stop it synchronously before exiting (on
POSIX, `process.kill(-pid, 'SIGTERM')`, then `SIGKILL` after a short wait). Alternatively, set a flag and let the
`async` flow unwind instead of calling `process.exit`.

#### TOOL-WR-11: The Barlow Condensed fallback tries Arial Narrow first but is sized for Arial

**File:** `web/scripts/font-metrics.mjs:65-76`; `web/visual/reference/rulings.css:36`; (`web/src/styles/base.css:162`,
other lane)

**Issue:** The fallback face is `src: local("Arial Narrow"), local("Arial")` with `size-adjust: 68.92%`. The recorded
metrics say Arial Narrow "was not installed on the measuring machine, so the display face is matched against Arial".
Arial Narrow ships with Microsoft Office and many Windows installs, and its glyphs are about 18% narrower than Arial's.
On those machines, size-adjust shrinks the already narrow face a second time: display text in the fallback is far too
narrow, and the swap to Barlow Condensed shifts the layout. That is the PERF-05/CLS failure the face exists to prevent.
Lighthouse on the measuring machine cannot see it.

**Fix:** Either drop `local("Arial Narrow")` from the face (it falls back to Arial, the font it was measured against),
or record Arial Narrow's metrics and use a separate `@font-face` per local source. The `--font-display` stack can keep
"Arial Narrow" after the fallback face, where it is unadjusted.

#### TOOL-WR-12: The lint rule for CWE-79 covers only the JSX `dangerouslySetInnerHTML` attribute

**File:** `web/eslint.config.mjs:102-105`

**Issue:** None of these is banned, so each is a raw-HTML sink that lint lets through:

- `element.innerHTML = …`, `outerHTML`, `insertAdjacentHTML`, `document.write` and `DOMParser`-to-DOM injection
- `createElement(tag, { dangerouslySetInnerHTML })`
- `iframe` `srcdoc`

None is used in `src/` today. The ban exists to keep it that way, and right now it only does that for one syntax.

**Fix:** Add to `syntaxBans`:

```js
{ selector: "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]", message: 'Raw HTML injection is forbidden (CWE-79).' },
{ selector: "CallExpression[callee.property.name=/^(insertAdjacentHTML|write|writeln)$/]", message: 'Raw HTML injection is forbidden (CWE-79).' },
{ selector: "Property[key.name='dangerouslySetInnerHTML']", message: 'Raw HTML injection is forbidden (CWE-79).' },
{ selector: "JSXAttribute[name.name='srcDoc']", message: 'Raw HTML injection is forbidden (CWE-79).' },
```

#### TOOL-WR-13: The `.npmrc` cool-down waivers name a package, have no end date, and outlive the fix they were for

**File:** `web/.npmrc:6-14`

**Issue:** `min-release-age-exclude[]=vite`, `=source-map-js` and `=http-cache-semantics` were approved for one
security version each (vite 8.3.3, source-map-js 1.2.2, http-cache-semantics 4.3.0). The waivers name the package, not
the version, so every future release of these packages, including a compromised one, skips the 14-day cool-down. The
comments give "ages out" dates (2026-10-14 and 2026-10-18), but nothing removes the lines or fails when those dates
pass. CLAUDE.md allows skipping the cool-down only for security fixes, with a recorded reason, and the reason here
applies to one version.

**Fix:** Add a check to `license-gate.mjs`, or a small `npmrc-gate` test, that parses the `min-release-age-exclude`
lines. It should fail when an excluded package's installed version is not the approved one, or when today is past the
recorded age-out date. Remove the source-map-js and http-cache-semantics lines once they age out. Pin the vite waiver to
8.3.3 in that check.

#### TOOL-WR-14: The E2E guard ignores requests that fail with no response, and covers only the default page

**File:** `web/e2e/fixtures.ts:95-126`

**Issue:** The visual guard records `requestfailed` (`visual/guard.ts:270-272`), but the E2E guard does not. A
same-origin script, font, chunk or API call that fails at network level (aborted, reset, `net::ERR_*`) gets no
`response` event. Firefox writes no console line for it either, so the test passes on a page that is missing a
resource. The guard is also attached only to the fixture `page`. A page from `context.newPage()` or a popup (the
sign-in flows later) is not guarded at all.

**Fix:** Add `page.on('requestfailed', …)` for same-origin URLs, with the same `expectStatus`-style opt-out. Guard
every page in the context through `context.on('page', watch)`, as `guard.ts` does for `appPage`.

### Info

#### TOOL-IN-01: The license gate never checks that each tree was actually read

**File:** `web/scripts/license-gate.mjs:80-99`

**Issue:** If `tools/openapi-gen/node_modules`, or a production dependency of `web/`, is missing, license-checker
reports only the root. A license problem in the missing part then cannot be seen. The stale-exception check fails
closed only by accident.

**Fix:** Check that every direct dependency in each `package.json` appears in its tree, and fail if not.

#### TOOL-IN-02: The OpenAPI type-drift check is not part of `npm run verify`

**File:** `web/scripts/verify.mjs:11-20`; `tools/openapi-gen/check.mjs`

**Issue:** D-16 drift is caught only when someone runs `npm --prefix tools/openapi-gen run check` by hand
(`docs/web/release-gates.md`). No CI workflow exists yet.

**Fix:** Add a verify step, or a root script that runs both, so the generated types cannot drift between releases.

#### TOOL-IN-03: The comment says E2E and parity share a lock, but they don't

**File:** `web/scripts/e2e.mjs:3-4`, `:111`; `web/scripts/parity.mjs:23`

**Issue:** The E2E header says the lock is "shared with the parity ... runs", but parity takes `parity.lock`. Parity's
`build-app` and E2E's `build` both run `--mode e2e` and write `artifacts/budget/budget.e2e.json`, so the two can run at
the same time and overwrite each other's file.

**Fix:** Correct the comment, and give the parity build its own report mode or folder.

#### TOOL-IN-04: Builds in a custom mode write to output folders nothing ignores

**File:** `web/vite.config.ts:69`

**Issue:** `.${mode}-dist` is ignored only for `e2e` and `budget`. `vite build --mode development` or `--mode staging`
writes `.development-dist` or `.staging-dist`, which git, ESLint and Prettier all pick up.

**Fix:** Allow only the known modes (throw otherwise), or ignore `web/.*-dist/`.

#### TOOL-IN-05: `openReviewPage` leaks its browser context on failure

**File:** `web/scripts/owner-review.mjs:793-824`

**Issue:** If `goto`, the status check or the `h1` wait throws, the context created at `:795` is never closed. Only
`browser.close()` cleans it up later.

**Fix:** Wrap the steps after `newContext` in `try`, and call `context.close()` in `catch` before rethrowing.

#### TOOL-IN-06: The side-by-side "every network request is blocked" promise is broader than the code

**File:** `web/scripts/design-side-by-side.mjs:306-314`

**Issue:** `context.route('**/*')` does not intercept WebSockets (that needs `routeWebSocket`) or service-worker
fetches (that needs `serviceWorkers: 'block'`), and DNS prefetch and preconnect bypass it too.

**Fix:** Add `serviceWorkers: 'block'` to `newContext`, add a `routeWebSocket(/.*/, ws => ws.close())`, or reword the
promise.

#### TOOL-IN-07: The WebKit screenshot discount can hide a real inline-style CSP violation

**File:** `web/visual/webkit-style-sync.ts:41-50`

**Issue:** The discount removes up to N matching violations for N screenshots. If Playwright skips its style toggle for
a screenshot, the page's own blocked `<style>` is discounted in its place. Chromium and Firefox would usually still
catch it, unless the violation happens only in WebKit.

**Fix:** Pair each discount with a timestamp window around the screenshot call.

#### TOOL-IN-08: `check.mjs` argument parsing and working directory

**File:** `tools/openapi-gen/check.mjs:80-91`, `:66`

**Issue:** `--snapshot --generated` takes `--generated` as the path. `spawnSync` inherits the caller's working
directory, so a `redocly.yaml` there can change the output of openapi-typescript.

**Fix:** Use `node:util` `parseArgs`, and pass `cwd: fileURLToPath(new URL('.', import.meta.url))`.

#### TOOL-IN-09: The Lighthouse gate scores the production bundle on a Development-environment host, from one run

**File:** `web/scripts/lighthouse.mjs:84-93`, `:161-175`; `web/scripts/lighthouse-assert.mjs:69-123`

**Issue:** `ASPNETCORE_ENVIRONMENT=Development` can change headers, compression, caching and error handling compared
with production. The score comes from a single run. `runtimeError` and `finalDisplayedUrl` are not checked, so a
redirect to another page would be scored as `/`.

**Fix:** Run the host in Production with the dev certificate passed per process, or record the difference in
`docs/web/release-gates.md`. Fail when `runtimeError` is present or `finalDisplayedUrl` is not `LIGHTHOUSE_URL`.
Consider the median of 3 runs.

---

_Reviewed: 2026-10-13T10:36:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_


## Lane: weblib (finding IDs prefixed LIB-)

Full lane report: 02-REVIEW-lane-weblib.md

## Phase 2: Code Review Report (lane: weblib)

**Reviewed:** 2026-10-13T10:30:29Z
**Depth:** standard
**Files Reviewed:** 45
**Status:** issues_found

### Summary

This lane covers the web foundation libraries: the HTTP client and `HttpError`, `api.ts`, the order math and formatters (`csps.ts`, `format.ts`), submission and idempotency (`useSubmission`, `idempotencyKey`), error copy, TanStack Query conventions, nuqs URL state, the router, layouts and error boundaries, the dev admin shell, the global styles and the test helpers.

The order math in `csps.ts` agrees with `Csps.Domain.Orders.OrderMath` to the centavo. I traced the pinned operation order, half-away-from-zero rounding, exact BigInt fractions, the percentage on the rounded items total, and sum-then-round for payments and expenses, and found no money defect there. `newIdempotencyKey` is a correct v4 UUID from a CSPRNG.

The serious defects are in the **submission and idempotency layer**, which WEB-09 and SEC-06 rely on to stop duplicates:

1. After a fast success, the hook issues a new key. So a double-click whose second click lands after the response creates a second record.
2. JSON comparison treats every `FormData`, `File`, `Blob`, `Map` and `Set` as `"{}"`, so the hook reuses a key for a different payload. Under SEC-06's body-hash rule (a multipart boundary differs on every send), an upload form that fails once is then stuck on 422 for good.

Other problems:

- **Key reuse after a definitive rejection:** the hook also reuses the key after a final 4xx, which SEC-06 replays from its stored response for 24 hours.
- **Silent 400 field errors:** a 400 with field errors produces no feedback at all when no rendered field matches.
- **401 contract traps:** every 401 is silent, and the refresh path is re-entrant.
- **Untyped 2xx bodies:** a non-JSON 2xx body is returned typed as the DTO.
- **Pasted money:** a pasted amount can be inflated 100x.

### Narrative Findings (AI reviewer)

### Critical Issues

#### LIB-CR-01: A double-click that straddles a fast success creates a duplicate record (new key after success)

**File:** `web/src/lib/forms/useSubmission.ts:104-116, 130-139`
**Issue:** The in-flight guard (`inFlightRef`) covers only the time the request is pending. When a submission succeeds, `run` clears `inFlightRef` and `pending`, and `failedRef` stays `undefined`. The next `submit` then always takes `newIdempotencyKey()` (line 104). On a LAN or localhost, or with any fast endpoint, the response can arrive in about 30–80 ms, well inside a normal double-click interval (100–250 ms).

The sequence:
- Click 1 creates key A, the POST succeeds and `pending` drops back to false.
- Click 2 arrives before `onSuccess`'s navigation commits or the form unmounts. The public layout keeps the form mounted while the next route's lazy chunk loads.
- Click 2 creates key B and sends a second POST.

The server's SEC-06 store cannot dedupe two different keys, so a second order, payment, expense or inquiry is created. This breaks the hook's own contract ("A double-click, a second Enter or a retry must never create two orders, payments or expenses", lines 1-2) and WEB-09/SEC-06.
**Fix:** Bind the key to the data across a success as well. Only `reset()` or changed data starts a new key, so a same-data resubmission replays the server's stored response instead of creating a record:
```ts
interface LastSubmission { readonly key: string; readonly serialized: string; readonly succeeded: boolean }
const lastRef = useRef<LastSubmission | undefined>(undefined);
// in run():
const last = lastRef.current;
const key = last !== undefined && serialized !== undefined && last.serialized === serialized
  ? last.key
  : newIdempotencyKey();
// after the outcome (success or failure):
lastRef.current = serialized === undefined ? undefined : { key, serialized, succeeded: outcome.ok };
// reset(): lastRef.current = undefined;
```
Alternatively, keep `pending` (or a `submitted` latch) true after success until the caller calls `reset()` or the component unmounts. Add a test in which the fake `send` resolves at once and two `submit()` calls are separated by a resolved microtask or macrotask.

#### LIB-CR-02: Every FormData, File, Blob, Map or Set payload compares equal, so a key is reused for a different body, and an upload form gets stuck on 422

**File:** `web/src/lib/forms/useSubmission.ts:54-65, 104, 118`; `web/src/lib/http/httpClient.ts:385-393, 426`
**Issue:** `serialize` treats `JSON.stringify(data)` as the identity of a submission. `JSON.stringify(new FormData())`, `JSON.stringify(file)`, `JSON.stringify(new Map(...))` and `JSON.stringify(new Set(...))` all return `"{}"`, and an object holding a `File` serializes the file as `{}`. Two consequences:

1. **A different payload reuses the old key.** If an image upload fails and the user picks a different file, line 104 reuses the old key. Under SEC-06 (REQUIREMENTS.md: "the same key with a different body gets a 422"), the retry fails with 422. Worse, if the first attempt actually committed (a client timeout), the server returns the stored 201 of the *old* image and the UI reports success for an image that was never saved.
2. **The form is stuck permanently.** A multipart body gets a new random boundary on every send, so even the *same* file produces a different SHA-256 body hash. After any ambiguous failure, every retry gets 422. Line 118 then stores the same `{key, serialized: "{}"}` again, so the hook never rotates the key: the form cannot succeed until `reset()` or a remount. The HTTP client has the same problem on its own retries: `canRetry` (line 426) retries a key-carrying FormData POST after a network error, and that retry also re-encodes the multipart body.

`httpClient` explicitly supports `FormData` and `onUploadProgress` for exactly these upload flows (order images, Cloudinary). `useSubmission` is declared the one submission path for every form.
**Fix:** Refuse to treat non-plain data as comparable. Then rotate the key for such payloads, or require an explicit identity from the caller:
```ts
function isPlainJson(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(isPlainJson);
  const proto = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null) && Object.values(value).every(isPlainJson);
}
function serialize(data: unknown): string | undefined {
  if (data === undefined) return NO_DATA;
  if (!isPlainJson(data)) return undefined; // FormData/File/Blob/Map/Set/Date: never "the same submission"
  try { return JSON.stringify(data); } catch { return undefined; }
}
```
Also add an optional `identity?: (data: TData) => string` option, so an upload can key on, for example, `file.name + file.size + file.lastModified`. Then either make the server's SEC-06 hash multipart-boundary-independent (hash the parts), or have the client's `canRetry` exclude `FormData` bodies. Record that decision in the plan.

### Warnings

#### LIB-WR-01: The key is reused after definitive 4xx rejections, which SEC-06 replays for 24 hours

**File:** `web/src/lib/forms/useSubmission.ts:117-118`
**Issue:** After *any* failure, the hook keeps the key for the next same-data submission. Key reuse is only correct when the outcome is ambiguous: a network error, a timeout, an abort mid-flight, a 5xx, or SEC-06's "still running" 409. In those cases the server may have committed, and the replay must land on the stored result.

A 400, 403, 404, 422 or 429 is final. SEC-06 stores "the response status and body" for 24 hours and replays it for the same key and body. So:
- A same-data retry after a server-state-dependent 400 (for example "payment exceeds balance", fixed meanwhile by another staff member) replays the stale 400 until the user edits a field.
- After a 429 "Wait a minute, then try again", waiting does not help if the server stored the 429.
- After a 422 key mismatch, the hook re-stores the same key, so it never recovers.
**Fix:** Set `failedRef` only for ambiguous failures:
```ts
const ambiguous = !isHttpError(err) || err.kind !== 'http' || err.status >= 500 || err.status === 409;
failedRef.current = ambiguous && serialized !== undefined ? { key, serialized } : undefined;
```
Add a test for each class.

#### LIB-WR-02: A 400 with field errors gives no feedback when no rendered field matches the server's key

**File:** `web/src/lib/forms/useSubmission.ts:119-125`; `web/src/lib/errors/describeHttpError.ts:18-19, 59-61`
**Issue:** When `fieldErrors` is non-empty, `copy` is forced to `null`, so `onFailure` never runs. The `checkFields` copy that describeHttpError defines ("Check the highlighted fields.") therefore never reaches a form. Server keys come back "in the server's casing" (for example `Amount`, `Items[0].UnitPrice`, `RowVersion`, `$.amount` from a JSON binding error). If no rendered field matches one, nothing is highlighted, no banner appears, and `focusFirstInvalid` returns false. The user sees the button stop spinning and nothing else.
**Fix:** Always call `onFailure` with `describeHttpError(error)`, which already returns `checkFields` for this case and lets the caller decide. Alternatively, return an `unmatchedFieldErrors` list so a form can render the leftover messages in the banner.

#### LIB-WR-03: Every 401 is silent: no copy, no callback, nothing wired in Phase 2, and no per-request opt-out

**File:** `web/src/lib/errors/describeHttpError.ts:56-58`; `web/src/lib/http/httpClient.ts:481-488`; `web/src/lib/api.ts:57-58`
**Issue:**
- **Silent failure today:** `describeHttpError` returns `null` for every 401, on the premise that "the sign-in redirect takes over". But the shared client is built with no `refresh` and no `onUnauthorized` (api.ts:58), so in Phase 2 nothing takes over. A 401 shows nothing: `useSubmission` skips `onFailure`, and ConfirmDialog sets `failure` to `null`.
- **Wrong sign-out later:** `execute` sends *every* 401 into refresh or `onUnauthorized`, including a 401 that is a legitimate answer, such as the Phase 4 sign-in or 2FA-verify endpoint rejecting a bad password. With the current design, that 401 triggers a refresh attempt and then the global sign-out callback, and the form shows no message.
**Fix:**
- Add `readonly skipAuthRefresh?: boolean` to `RequestOptions`. `execute` rethrows such a 401 untouched.
- Give `describeHttpError` an explicit 401 copy ("Your session ended. Sign in again."), used whenever the error is not consumed by the client's `onUnauthorized` path. For example, mark consumed errors with an `HttpError.handledBySession` flag, or let `describeHttpError` take an option.

#### LIB-WR-04: The refresh single flight deadlocks if `refresh` uses the same client, and a stale 401 starts a second refresh

**File:** `web/src/lib/http/httpClient.ts:458-505`
**Issue:**
1. **Deadlock.** The docs and `api.ts` (lines 12, 57) say Phase 4 passes the real `refresh` to "the shared client". If `refresh` calls `/auth/refresh` through that same client and the refresh request itself gets a 401:
   - `execute` → `joinRefresh` returns the cycle already in flight;
   - `await cycle.done` waits on `refresh()`, which waits on this same request, so it never settles;
   - every queued 401 hangs forever and `onUnauthorized` never runs.
2. **Second refresh.** A request sent with the old credentials can return its 401 *after* the cycle has finished and `refreshCycle` is back to `undefined` (line 471). It then starts a second refresh. With rotating refresh tokens and reuse detection, the second refresh can revoke the whole session.
**Fix:**
- Mark requests issued inside `refresh` (the `skipAuthRefresh` from LIB-WR-03) so that they never join a cycle.
- Record a monotonically increasing `sessionEpoch` that each request captures at send time. A 401 from a request whose epoch is older than the last successful refresh retries directly, without a new refresh.
- Add tests for both cases.

#### LIB-WR-05: Non-JSON or empty 2xx bodies resolve as the typed DTO

**File:** `web/src/lib/http/httpClient.ts:334-339, 533`; `web/src/lib/api.ts:49`
**Issue:** `toHttpResponse` returns `data: text` for any 2xx with a non-JSON Content-Type, and `data: undefined` for an empty body. `request<T>` then casts it with `response.data as T`, so `api.site.settings()` can resolve with an HTML string or `undefined` typed as `SiteSettings`. Real triggers:
- captive portals and carrier interstitials on PH mobile networks;
- a reverse proxy or host login page reached through a followed redirect (fetch follows 3xx silently, and `response.redirected` is never checked);
- a 204 from an endpoint the caller types as an object.

Consumers then read `undefined` fields with no error, so a "parse" failure surfaces as a crash or a blank screen far from the cause.
**Fix:** Since the client always sends `Accept: application/json`, treat a non-empty 2xx body whose Content-Type is not JSON as `new HttpError({ kind: 'parse', status })`. Also treat `response.redirected === true` on an `/api` call as a parse or network failure. Keep `undefined` only for 204/205, and type such endpoints as `Promise<void>` in `api.ts`.

#### LIB-WR-06: `normalizePastedMoney` strips commas anywhere, so "1,50" becomes ₱150.00 (100x)

**File:** `web/src/lib/format.ts:86-89`
**Issue:** `text.replace(/[\s,]/g, '')` removes every comma without checking that the commas are thousands separators in valid positions. These pastes are silently accepted as a different amount:
- "1,50" or "12,5" (decimal-comma text, common in spreadsheets and phone keyboards set to other locales) become 150 and 125;
- "1,2,3" becomes 123.

Money entry is part of the Core Value. A 100x inflation on a payment or expense passes `MONEY_TEXT` and reaches the server as a valid amount.
**Fix:** Accept commas only as proper groups, and reject anything else:
```ts
const GROUPED = /^\d{1,3}(,\d{3})+(\.\d{0,2})?$/;
const compact = text.replace(/\s/g, '');
const candidate = compact.includes(',') ? (GROUPED.test(compact) ? compact.replace(/,/g, '') : '') : compact;
return MONEY_TEXT.test(candidate) ? candidate : '';
```

#### LIB-WR-07: `csps.formatDate` reads the machine's time zone for timestamps

**File:** `web/src/lib/csps.ts:169-177`
**Issue:** For any input that is not exactly 10 characters (an API instant such as `2026-10-06T16:30:00Z`), `new Date(d)` plus `getMonth()`, `getDate()` and `getFullYear()` format in the *browser's* zone, not Asia/Manila. A staff laptop set to another zone shows the wrong calendar day. `format.ts` states "Nothing here reads the machine's zone", and `OrderCard.tsx:15` explicitly avoids this function for that reason. It is still exported from the module whose header says "every figure shown wherever an order appears comes from" it, and nothing marks it as unsafe.
**Fix:** Remove `formatDate` from `csps.ts`, or re-implement it as a thin wrapper:
```ts
export const formatDate = (d: string | null | undefined): string =>
  !d ? '—' : d.length === 10 ? formatCalendarDate(d) : formatBusinessDate(d);
```

#### LIB-WR-08: The CWE-598 secret-parameter guard can be bypassed through the URL string

**File:** `web/src/lib/http/httpClient.ts:188-203`
**Issue:** `assertNoSecretParams` inspects only `params`. `buildUrl` accepts a query already in `request.url` (it appends with `&` when `url.includes('?')`). So `client.get('/auth/confirm?token=abc')` or `client.post(\`/x?code=${otp}\`)` passes the guard, and the secret lands in server logs, history and Referer, which is exactly what the guard documents it prevents.
**Fix:** Parse the query of the final URL and check every key:
```ts
const finalUrl = buildUrl(baseURL, prepared);
const query = finalUrl.split('?')[1] ?? '';
for (const name of new URLSearchParams(query).keys()) {
  if (secretParams.has(name.toLowerCase())) throw new TypeError(/* same text */);
}
```
Alternatively, reject any `?` in `request.url`.

### Info

#### LIB-IN-01: Programming errors are classified as `network`, retried and masked

**File:** `web/src/lib/http/httpClient.ts:216-227`; `web/src/test/fakeFetch.ts:83-85`
**Issue:** `toTransportError` maps every non-HttpError thrown by the transport to `kind: 'network'`. The cases this covers include fetch's TypeError for a GET or HEAD with a body, an invalid URL, and the fake fetch's "no planned response" error. GET, PUT and DELETE then retry twice, and the user sees "Couldn't reach the server". In tests, an unexpected extra request turns into a generic network error instead of the fake's descriptive message, so the failure is harder to read.
**Fix:** Classify as `network` only for `TypeError` from the fetch call, rethrow anything else unchanged, and reject a `body` on GET or HEAD in `initialRequest`.

#### LIB-IN-02: `defaultSleep` ignores a signal that is already aborted

**File:** `web/src/lib/http/httpClient.ts:132-143`
**Issue:** An `abort` event that has already fired is not re-dispatched. If the caller aborts between a failed attempt and the backoff, the wait runs to completion, and then one more doomed attempt starts.
**Fix:** `if (signal?.aborted) { reject(new DOMException(..., 'AbortError')); return; }` at the top.

#### LIB-IN-03: A `__proto__` field name in the ProblemDetails `errors` member changes the object's prototype

**File:** `web/src/lib/http/HttpError.ts:86-92`
**Issue:** `errors[field] = ...` on a `{}` literal with `field === '__proto__'` (an own key after `JSON.parse`) sets the prototype instead of a property. The field error is lost, and `errors` inherits array members. The effect is local, but it is avoidable.
**Fix:** Use `const errors: Record<string, readonly string[]> = Object.create(null)`, or skip `__proto__`, `constructor` and `prototype`.

#### LIB-IN-04: `formatBusinessDate` can throw on a string that passes the regex

**File:** `web/src/lib/format.ts:47-50`
**Issue:** INSTANT allows up to 9 fractional digits (.NET emits 7). ECMAScript defines only 3, so parsing more is implementation-defined. If an engine returns Invalid Date, `Intl.DateTimeFormat.format` throws a RangeError during render instead of returning "—".
**Fix:** `const date = new Date(utcIso); if (Number.isNaN(date.getTime())) return EMPTY;`, or trim the fraction to 3 digits before parsing.

#### LIB-IN-05: `clampPage` with a non-finite page count writes `page=NaN` to the URL

**File:** `web/src/lib/url-state/parsers.ts:112-115`; `web/src/lib/url-state/createListParams.ts:169-175`
**Issue:** `clampPage(page, NaN)` returns NaN, `target !== page` holds, and the hook writes NaN. The normalization effect then strips it, and the next clamp can write it again (URL flapping) if a response is missing `totalPages`.
**Fix:** `if (!Number.isFinite(totalPages)) return;` in the setter, and `Number.isFinite` guards in `clampPage`.

#### LIB-IN-06: `useSettledListParams` compares with `Object.is`, so an array or object parser value would loop renders

**File:** `web/src/lib/query/useSettledListParams.ts:19-32`
**Issue:** If a list ever adds a parser whose value is not referentially stable (for example `parseAsArrayOf` for multi-select status), `sameValues` is false on every render. `setHeld` during render then re-renders without end ("Too many re-renders"). No such parser exists today.
**Fix:** Compare by each parser's `eq`, or by `JSON.stringify` of the values. Document the restriction in `createListParams` if it stays.

#### LIB-IN-07: The default 30 s per-attempt timeout also applies to XHR uploads, and a timeout is never retried

**File:** `web/src/lib/http/httpClient.ts:402-406, 423`
**Issue:** A multi-MB jersey mockup over a slow mobile link can take longer than 30 s while progress is still moving. The upload then fails as "Couldn't reach the server".
**Fix:** For requests with `onUploadProgress`, use a much larger default, or reset the timer on each progress event (an idle timeout).

#### LIB-IN-08: The SEC-06 "duplicate still running" 409 gets the rowversion-conflict copy

**File:** `web/src/lib/errors/describeHttpError.ts:27`
**Issue:** "Someone else changed this. Reload to see the latest version…" is misleading for an idempotency in-flight 409 on a create.
**Fix:** Distinguish the two by the ProblemDetails `type` the server sets, and show "Still saving your last attempt. Wait a moment, then try again."

#### LIB-IN-09: Reduced motion zeroes only transitions; keyframe animations keep running

**File:** `web/src/styles/base.css:184-188`
**Issue:** `csp-shimmer`, `csp-spin`, `csp-rise` and `csp-slide` still animate under `prefers-reduced-motion: reduce`.
**Fix:** Add `animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;` there, or exempt only the spinner explicitly.

#### LIB-IN-10: `HttpError.message` carries server-written text

**File:** `web/src/lib/http/HttpError.ts:46-49`
**Issue:** The message is the server's ProblemDetails `title`. describeHttpError guarantees that no server text reaches the screen, but any future code that renders or logs `error.message` (an error boundary using `useRouteError`, a toast fallback) breaks that guarantee (CWE-209).
**Fix:** Keep the server title in `problem.title` only, and make `message` always the fixed default for the kind.

#### LIB-IN-11: The dev route `/dev` has no index route, and the admin preview never restores `document.title`

**File:** `web/src/app/admin/routes.tsx:44-57`; `web/src/app/admin/AdminPreviewPage.tsx:21-23`
**Issue:** `/dev` matches the `dev` branch and renders the admin shell with an empty `main`. After leaving an admin preview, the tab keeps "{Section} · CSPS Admin".
**Fix:** Add `{ index: true, loader: () => redirect('/dev/components') }`, and return a cleanup from the effect that restores the previous title.

#### LIB-IN-12: The component axe helper runs WCAG tags only, so best-practice rules are skipped

**File:** `web/src/test/axe.ts:22-25`; `web/src/app/public/SiteFooter.tsx:51, 63, 76`
**Issue:** `runOnly` by WCAG tags excludes `heading-order`, `region`, `landmark-*` and the other best-practice rules. As a result, the footer's `h4` directly after the page's `h1` is never flagged, although the project bar is "zero axe violations".
**Fix:** Add `'best-practice'` to `AXE_TAGS`, or explicitly enable `heading-order` and `region`. Use `h2` for the footer column headings.

---

_Reviewed: 2026-10-13T10:30:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_


## Lane: webui (finding IDs prefixed UI-)

Full lane report: 02-REVIEW-lane-webui.md

## Phase 2: Code Review Report (lane: webui)

**Reviewed:** 2026-10-13T10:32:52Z
**Depth:** standard
**Files Reviewed:** 155
**Status:** issues_found

### Narrative Findings (AI reviewer)

### Summary

This lane covers the design-system components under `web/src/ui` and the dev-only showcase, parity page, scenarios and previews under `web/src/dev`. I read every listed file. Where a finding depended on code outside the lane (`lib/format.ts`, `lib/csps.ts`, the server CSP string, `app/admin/routes.tsx`), I checked that code as well.

Checks that came back clean:
- No `dangerouslySetInnerHTML`, no `eval`, and no raw-HTML injection. `Mark` renders as JSX.
- Every `style={{…}}` sets only a CSS custom property. React applies these through the CSSOM, which the lint rule and the research note allow.
- Server text never reaches `ErrorState` or the ConfirmDialog failure line. Only the traceId is shown.
- `/dev/components` is gated by `__DEV_ROUTES__`, so a production build has no route to the dev code.

Most look decisions are App. D.3 parity or owner rulings, and I did not judge them.

Findings by area:
- **Overlays and toasts (UI-WR-01 to UI-WR-05):** the overlay stack has no concept of nesting, so Esc and focus trapping fight each other. Toasts nest live regions and can stay paused forever.
- **Production CSP (UI-CR-01):** ImageUploader previews use `blob:` URLs, which the shipped `img-src` blocks.
- **Entry controls (UI-WR-08, UI-WR-09):** OtpInput's `maxLength={1}` truncates the autofill it advertises. MoneyInput silently drops a pasted amount in the app's own `₱` format.
- **Accessibility gaps (UI-WR-07, UI-WR-12, UI-WR-15):** the global "/" shortcut fails WCAG 2.1.4. OrderCard hides the order status from assistive technology. Pagination drops focus.
- **ImageUploader state bugs (UI-WR-10, UI-WR-11).**

### Critical Issues

#### UI-CR-01: ImageUploader previews use `blob:` object URLs, which the shipped CSP blocks

**File:** `web/src/ui/media/ImageUploader.tsx:80` (also 187)
**Issue:** `addFiles` builds each new thumbnail's `src` with `URL.createObjectURL(f)`. The production policy (`src/Csps.Server/Http/SecurityHeadersMiddleware.cs:17`, PRD §504) is `img-src 'self' data: https://res.cloudinary.com`. CSP `'self'` does not match the `blob:` scheme, so every picked or dropped image renders as a broken image under the strict CSP. That includes the Component Showcase and the visual/e2e host, which serve the same policy. The guard/CSP listener would report it as a violation. The object URLs are also never revoked, either on remove or on unmount.
**Fix:** Pick one of these:
- Add `blob:` to `img-src` as a documented need. It is the narrowest change and keeps `unsafe-inline` out.
- Read previews with `FileReader.readAsDataURL`, which the existing `data:` source already allows.

In both cases, revoke the URLs:
```tsx
// on remove
URL.revokeObjectURL(img.src);
// on unmount
useEffect(() => () => {
  for (const img of listRef.current) {
    if (img.src?.startsWith('blob:')) URL.revokeObjectURL(img.src);
  }
}, []);
```

### Warnings

#### UI-WR-01: Esc closes every open overlay at once (Modal, ConfirmDialog, MobileNavDrawer)

**File:** `web/src/ui/overlays/Modal.tsx:95-103`, `web/src/ui/navigation/MobileNavDrawer.tsx:87-94`
**Issue:** Each open overlay adds its own `window` keydown listener that calls `requestClose()` on Escape. None of them checks `event.defaultPrevented`, stops propagation, or knows whether it is the topmost layer. Example: a ConfirmDialog opened from inside an edit Modal (a child-row delete from a dialog). One Esc closes both the confirm and the outer Modal, and the outer form's unsaved input is lost.
**Fix:** Keep a module-level overlay stack, like the `holders` counter in `useBodyScrollLock`. Only the top entry handles Esc, and it calls `event.preventDefault()`. At minimum:
```ts
const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !event.defaultPrevented && isTopmost(overlayId)) {
    event.preventDefault();
    requestClose();
  }
};
```

#### UI-WR-02: useFocusTrap has no trap stack, so two active traps fight over focus

**File:** `web/src/ui/overlays/useFocusTrap.ts:65-70, 97-104`
**Issue:** Every active trap adds a document `focusin` listener that pulls focus back into its own root. A second trap whose root is a DOM sibling of the first has this problem:
- The second trap is, for example, a Modal rendered next to the open MobileNavDrawer, since nothing uses portals. When it activates, it focuses its initial element before its own listeners exist (lines 65-70 run before 103).
- The first trap's `focusin` handler sees a target outside its root and moves focus back into the drawer.

The dialog that is visually on top then has no focus. After both are listening, each Tab runs both keydown handlers, and both call `preventDefault` and focus their own first or last element.
**Fix:** Keep a stack of active traps. Only the top trap enforces `focusin` and Tab; lower traps go dormant until the traps above them are removed. When activated, push onto the stack before moving focus.

#### UI-WR-03: Persistent (danger and warning) toasts cannot be reached by keyboard or screen reader while a Modal or drawer is open

**File:** `web/src/ui/overlays/useFocusTrap.ts:97-101`, `web/src/ui/feedback/ToastProvider.tsx:122`
**Issue:**
- The toast layer sits at `z-(--z-toast)` above the scrim, outside the dialog.
- The focus trap sends any focus that leaves the dialog back to its first element, and `aria-modal="true"` hides the toast from the virtual cursor.
- Danger and warning toasts persist until someone closes them (D-04, D-31 O-7).

So a keyboard user cannot reach a danger toast's Dismiss button or `action` (for example "Try again") while a dialog is open. That fails WCAG 2.1.1, and the toast is the place a failed save is reported.
**Fix:** Let the trap treat `[data-ui="s-toast-layer"]` as an allowed outside region, so `focusin` there is not pulled back and Tab can cycle into it. Another option is to render the toast layer inside the topmost dialog while one is open. Keep the toast reachable from the dialog with an F6-style landmark jump or a visible "View message" link.

#### UI-WR-04: Toasts are live regions nested inside a live region, so they are announced twice

**File:** `web/src/ui/feedback/Toast.tsx:38`, `web/src/ui/feedback/ToastProvider.tsx:122`
**Issue:** The layer is `aria-live="polite"`, and each Toast inside it also gets `role="status"` (implicitly polite) or `role="alert"` (assertive). NVDA and JAWS commonly announce nested live regions twice. A danger toast is read once assertively by the alert and again by the polite parent.
**Fix:** Use a single live region. Either keep the always-mounted layer with `aria-live="polite"` (D-31 O-5) and drop the toast roles, or keep the roles and remove the layer's `aria-live`. For danger toasts, move the item into a separate always-mounted `role="alert"` region rather than nesting one inside the other.

#### UI-WR-05: Toast timers stay paused forever after a Dismiss click while other toasts remain; focus is lost

**File:** `web/src/ui/feedback/ToastProvider.tsx:92-95, 108-117`
**Issue:**
- Clicking Dismiss focuses the button and sets `focusInside` to true. The toast is then removed with focus inside it.
- As the comment at line 108 admits, some browsers fire no `focusout` for a removed focused element, so `focusInside` stays true.
- The reset only runs when the stack becomes empty. If another success or info toast is still shown, the later `pointerleave` calls `syncClock()`, which still sees `focusInside === true`, so the remaining timed toasts never expire.

Focus is also dropped to `<body>` (WCAG 2.4.3).
**Fix:** In the Dismiss handler, first move focus to the next toast's Dismiss button, or back to the element focused before the layer was entered. Then recompute `focusInside` as `layer.contains(document.activeElement)` after the commit, for example in a `useEffect` keyed on `toasts`, instead of trusting the event flag.

#### UI-WR-06: ConfirmDialog does not handle a synchronous throw from `onConfirm`

**File:** `web/src/ui/overlays/ConfirmDialog.tsx:100`
**Issue:** `const result = onConfirm?.();` is not guarded. If the handler throws before returning a promise (a validation guard, a `mutateAsync` misuse, a null deref), the error escapes the click handler. The failure line never shows, `inFlight` is never set, and the user sees nothing happen. The T-02-54 failure state only covers rejected promises.
**Fix:**
```ts
let result: unknown;
try {
  result = onConfirm?.();
} catch (error: unknown) {
  fail(error);
  return;
}
```

#### UI-WR-07: The global "/" single-character shortcut fails WCAG 2.1.4 (Level A)

**File:** `web/src/ui/navigation/Topbar.tsx:65-80`
**Issue:** Pressing "/" anywhere outside a field always moves focus to the search box. WCAG 2.1.4 Character Key Shortcuts requires a single printable-key shortcut to be:
- turnable off,
- remappable to include a modifier, or
- active only while its component has focus.

None of these apply here. Speech-input users who dictate text, and anyone typing "/" into a `role="textbox"` or `contenteditable="false"` widget, trigger it. The handler also ignores modifiers, `event.isComposing` and `event.defaultPrevented`. While a Modal or drawer is open, it steals focus outside the dialog, and the trap then bounces it back (UI-WR-02). This is App. D.3 behaviour, but AA conformance is a binding project constraint.
**Fix:** Make the shortcut need a modifier (Ctrl+K or Ctrl+/), or add a user setting to turn it off. Also skip it when `event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.defaultPrevented`, and while an `[aria-modal="true"]` element is open.

#### UI-WR-08: OtpInput's `maxLength={1}` truncates the one-time-code autofill it advertises

**File:** `web/src/ui/entry/OtpInput.tsx:187-188` (with the header claim at lines 10-11)
**Issue:** The first box has `autoComplete="one-time-code"`, and the header says autofill "goes through the same fill". But the box also has `maxLength={1}`. Browser autofill and keyboard code suggestions (iOS Mail and Messages codes, Chrome) insert text as user input, and `maxlength` constrains that input. The `change` handler therefore receives one digit, and the other five boxes stay empty. The paste path works only because `onPaste` calls `preventDefault` before the browser applies `maxlength`.
**Fix:** Remove `maxLength` from box 0. The `change` handler already strips non-digits and `fill()` spreads the digits across the boxes. Alternatively, use a single visually hidden `one-time-code` input that feeds the boxes. Add a test that sets six digits on box 0 through the native value setter.

#### UI-WR-09: MoneyInput silently drops a pasted amount in the app's own `₱` format

**File:** `web/src/ui/entry/MoneyInput.tsx:68-81`
**Issue:** `normalizePastedMoney` returns `""` for any text with a peso sign (`lib/format.ts:82-89`). The paste handler then calls `preventDefault` and returns without feedback. Every figure the app shows is formatted as `₱4,327.50` (`formatPeso`), including the Add Payment hint "Balance due: ₱4,327.50". Copying the balance into the amount field is a natural staff action, and it silently does nothing.
**Fix:** Strip a leading `₱` or `PHP` (and the U+2212 minus check, which should still reject) in `normalizePastedMoney`, or at least in the MoneyInput paste path, before validating:
```ts
const pasted = normalizePastedMoney(event.clipboardData.getData('text').replace(/^\s*(₱|PHP)\s*/i, ''));
```
If the paste is still rejected, show the `ENTRY_COPY.money.invalid` hint instead of ignoring it.

#### UI-WR-10: ImageUploader exceeds `max` when the list is already over the limit (negative `slice` end)

**File:** `web/src/ui/media/ImageUploader.tsx:70-72`
**Issue:** `.slice(0, max - list.length)` is wrong when `list.length > max`, which can happen with controlled `images` from a migrated legacy order that has more than 12 images. The end index is then negative, and `slice(0, -n)` keeps all but the last `n` picked files, so more files are added past the cap. The hint then reads, for example, "15/12".
**Fix:**
```ts
const room = Math.max(0, max - list.length);
const picked = Array.from(files ?? []).filter((f) => f.type.startsWith('image/')).slice(0, room);
```

#### UI-WR-11: ImageUploader cannot re-pick a file that was just removed

**File:** `web/src/ui/media/ImageUploader.tsx:166-175`
**Issue:** The hidden `<input type="file">` value is never cleared. After a user removes `jersey.jpg` and chooses `jersey.jpg` again through "browse", the input value has not changed, so no `change` event fires and nothing is added.
**Fix:** Clear the input after reading it:
```tsx
onChange={(e) => {
  addFiles(e.target.files);
  e.target.value = '';
}}
```

#### UI-WR-12: OrderCard hides the order status and image count from assistive technology

**File:** `web/src/ui/data/OrderCard.tsx:62-82`
**Issue:** The cover `<button>` has `aria-label="View order …"`, which replaces its accessible name. The StatusBadge and the image count inside it are therefore never exposed, and the card body has no status anywhere else. A screen-reader user scanning order cards cannot tell Pending from In Production or Cancelled (WCAG 1.3.1 and 4.1.2). The View and Edit buttons are also unnamed per order ("View", "Edit"), while Delete is named "Delete order …".
**Fix:** Do one of the following:
- Include the status in the name: `aria-label={\`View order ${o.number}, ${statusLabel}\`}`.
- Move the badge out of the button, positioned absolutely over the media, so it is read as card content.

Also give View and Edit names that carry the order number, as Delete already does.

#### UI-WR-13: IncomeExpenseChart keys month groups by the short month name

**File:** `web/src/ui/data/IncomeExpenseChart.tsx:119`
**Issue:** `key={d.month}` uses "Oct", "Nov" and so on. Any series longer than 12 months, or one that crosses a year (Oct 2025 to Oct 2026), repeats keys. React then warns (which breaks the zero-console-warnings rule) and may reuse or drop the wrong `<g>`, including its focus and hover state.
**Fix:** Key on something unique, for example `key={d.label ?? \`${d.month}-${String(i)}\`}`, or require a `key`/`id` in `ChartDatum`.

#### UI-WR-14: OrderTotals shows an overpaid order as "Fully Paid" and hides the negative balance

**File:** `web/src/ui/money/OrderTotals.tsx:41, 58-66`
**Issue:** When `fullyPaid` is true (`balance <= 0`), the block shows only "Fully Paid" with a check and never shows `t.balance`. An order where payments exceed total minus discount, for example a duplicated GCash payment, looks the same as one paid exactly. The overpayment that staff need to refund or credit is not visible. That conflicts with the Core Value that staff "always see correct, server-computed totals and balances". This is App. D.3 parity, so it needs an owner decision, not a silent change.
**Fix:** When `t.balance < 0`, show the overpayment ("Overpaid ₱X" or "Credit ₱X", tone warning) alongside or instead of "Fully Paid". Log this as an owner question if the spec must stay frozen.

#### UI-WR-15: Pagination drops keyboard focus when it disables the focused button

**File:** `web/src/ui/lists/Pagination.tsx:54-59, 67, 84`
**Issue:** If Next is pressed on page `n-1`, Next gets the native `disabled` attribute on the next render while it still has focus, so focus falls to `<body>`. The same happens with Previous on page 2. `focusTargetId` is optional, so without it a keyboard user is sent back to the top of the document (WCAG 2.4.3). Even with it, `goTo` focuses the target synchronously, before the parent has re-rendered, so focus lands correctly only if the caption already exists and survives the update.
**Fix:**
- Use `aria-disabled` at the ends instead of `disabled`, as Button already does for `pending`, and ignore activation.
- Focus the target after the update, for example in a `useEffect` keyed on `page` when a page change came from this component.
- Consider making `focusTargetId` required.

### Info

#### UI-IN-01: DataTable is an unnamed focusable region when `caption` is omitted

**File:** `web/src/ui/data/DataTable.tsx:86`
**Issue:** `role="region" tabIndex={0} aria-label={caption}` renders a keyboard stop with no name when `caption` is undefined. `caption` is optional in `DataTableProps`.
**Fix:** Make `caption` required, as `ResponsiveTable` does, or drop `role` and `tabIndex` when there is no caption.

#### UI-IN-02: Native-prop spreads can override the computed ARIA and the reveal `type`

**File:** `web/src/ui/forms/Field.tsx:73-75`, `web/src/ui/forms/PasswordField.tsx:66-77`, `web/src/ui/forms/Select.tsx:45-50`
**Issue:** `{...rest}` is spread after `aria-invalid`, `aria-describedby` and (in PasswordField) `type`. A caller passing `aria-describedby` drops the hint and error linkage. A caller passing `type="password"` breaks the Show password toggle. PasswordField and Select also take `required` without showing the asterisk that Field shows.
**Fix:** Spread `rest` first and the computed attributes last, and merge any caller `aria-describedby` with the message id.

#### UI-IN-03: A controlled Sidebar `collapsed` leaves a focusable toggle that does nothing

**File:** `web/src/ui/navigation/Sidebar.tsx:90-91, 103-108`
**Issue:** With `collapsed` given, the "Collapse sidebar" button updates internal state that is ignored, and there is no `onCollapsedChange` callback. No caller uses controlled mode yet.
**Fix:** Add `onCollapsedChange`, or hide the toggle in controlled mode.

#### UI-IN-04: Topbar defaults to a demo identity

**File:** `web/src/ui/navigation/Topbar.tsx:53-54`
**Issue:** `user = { name: 'Carmen Reyes' }` and `role = 'manager'` are production defaults. If a caller forgets the props, the app shows a fake manager identity. This is display only, because the server enforces roles.
**Fix:** Make `user` and `role` required.

#### UI-IN-05: UiLink passes `target` without enforcing `rel` for external links

**File:** `web/src/ui/actions/UiLink.tsx:53-73`
**Issue:** `target="_blank"` with no `rel` relies on browsers treating it as `noopener`.
**Fix:** When `target === '_blank'`, default `rel` to `noopener noreferrer`.

#### UI-IN-06: ResponsiveTable shows the wrong empty-state edges

**File:** `web/src/ui/lists/ResponsiveTable.tsx:160, 173-181`
**Issue:**
- The "Clear Filters" button renders even when `onClearFilters` is undefined, so it does nothing.
- `rows === undefined && !pending` (a disabled query) shows the first-use "No {things} yet" state.

**Fix:** Render the button only when the handler exists, and treat `rows === undefined` as not-loaded rather than empty.

#### UI-IN-07: IncomeExpenseChart computes the Net figure on the client

**File:** `web/src/ui/data/IncomeExpenseChart.tsx:159`
**Issue:** `formatPeso(cur.income - cur.expenses)` is a money figure derived in the browser, documented as App. D.3 display parity. Centavo rounding in `formatPeso` makes it numerically safe, but it goes against "money is computed server-side only".
**Fix:** Accept a server `net` in `ChartDatum` when Phase 10 wires real data.

#### UI-IN-08: KpiCard shows the delta unrounded

**File:** `web/src/ui/money/KpiCard.tsx:75`
**Issue:** `{Math.abs(delta)}%` prints `12.3456789%` if the caller passes a raw ratio.
**Fix:** Format with one decimal, or document that the caller rounds.

#### UI-IN-09: ImageUploader accepts more than the hint says

**File:** `web/src/ui/media/ImageUploader.tsx:71, 164, 169`
**Issue:** `accept="image/*"` and the `image/` prefix filter also accept GIF, SVG and HEIC, while the copy says "JPG, PNG or WEBP". There is no 10 MB check (documented for Phase 9).
**Fix:** Use `accept="image/jpeg,image/png,image/webp"` and the same allow-list in the filter.

#### UI-IN-10: Avatar with an empty name renders an unnamed `role="img"`

**File:** `web/src/ui/status/Avatar.tsx:26, 44-45`
**Issue:** `name` defaults to `''`, which produces `role="img" aria-label=""` (axe `role-img-alt`). In UserMenu, Sidebar and TestimonialCard the avatar's name also repeats the visible name next to it.
**Fix:** Hide the avatar (`aria-hidden`) when the name is empty, or when the name is shown next to it.

#### UI-IN-11: The toast queue keeps its timers after the provider unmounts

**File:** `web/src/ui/feedback/ToastProvider.tsx:60`
**Issue:** The `browserQueue()` timeouts are never cancelled on unmount. They call `dismiss` on a queue nothing listens to. The effect is harmless but leaks.
**Fix:** Add `queue.dispose()`, which cancels every clock, and call it from an unmount effect.

#### UI-IN-12: OtpInput swallows Ctrl/Cmd + digit browser shortcuts

**File:** `web/src/ui/entry/OtpInput.tsx:125`
**Issue:** `DIGIT.test(key)` is checked before modifiers, so Ctrl+1 or Cmd+1 types a digit and blocks the tab-switch shortcut.
**Fix:** Check `!event.ctrlKey && !event.metaKey && !event.altKey` before the digit branch.

#### UI-IN-13 (dev only): FailedConfirmDialog picks the first dialog in the document

**File:** `web/src/dev/previews/FailedConfirmDialog.tsx:24`
**Issue:** `document.querySelector('[role="dialog"]')` can find another open dialog in the showcase, such as the drawer. It then types into and clicks the wrong one.
**Fix:** Scope the query to a wrapper ref, as OpenedDialog does.

---

_Reviewed: 2026-10-13T10:32:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_


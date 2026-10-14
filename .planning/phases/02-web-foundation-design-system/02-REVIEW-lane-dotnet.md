---
phase: 02-web-foundation-design-system
lane: dotnet
created: 2026-10-13T05:29:51-05:00
updated: 2026-10-13T05:29:51-05:00
reviewed: 2026-10-13T10:29:51Z
depth: standard
files_reviewed: 26
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
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 02: Code Review Report (lane: .NET server and test infrastructure)

*Created: 2026-10-13T05:29:51-05:00 · Updated: 2026-10-13T05:29:51-05:00*

**Reviewed:** 2026-10-13T10:29:51Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

This lane covers the .NET side of phase 02: SPA hosting (static files, the shell fallback, the missing-file and reserved-docs 404s), the hidden-segment file provider, response compression and caching, the authoritative `OrderMath`, and the test-infrastructure changes (fixture web root, OpenAPI snapshot, dependency-registry npm support, authorization-matrix rows).

I traced the hidden-segment rule against the ways a path can reach `PhysicalFileProvider`: decoded `%2E`, `%5C` backslashes, `..` segments, 8.3 short names, ADS suffixes and literal `%2F`. I found no bypass. JSON and ProblemDetails are kept out of compression (BREACH), and the missing-file 404 does not leak file metadata. No blockers were found.

The real defects are:

- `OrderMath` silently treats any non-`Percentage` discount kind as a peso amount.
- `OrderMathResult.Total` means something different from the PRD's `Total`.
- The security wrapper covers only one consumer of the web root.
- Static-file requests no longer write the FND-07 completion log event.
- The npm pin reader misses dependency sections, so packages in them skip the registry gate.

## Warnings

### WR-01: An undefined `DiscountKind` is silently valued as a fixed peso amount

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

### WR-02: `OrderMathResult.Total` is the PRD's *Subtotal*, and the PRD's net *Total* is missing

**File:** `src/Csps.Domain/Orders/OrderMathModels.cs:24-38`, `src/Csps.Domain/Orders/OrderMath.cs:37,46`
**Issue:** PRD §5.1 defines `Subtotal = Σ LineTotal`, `Total = Subtotal − DiscountAmount` and `Balance = Total − TotalPaid`. ORD-07 shows "Subtotal, Discount, Total, Paid, Balance". In `OrderMathResult`, `Total` is the pre-discount items total (`Σ quantity × unit price`), and no field holds the net total. The balance is still correct. The risk is that a later phase maps `OrderMathResult.Total` to the ORD-01/ORD-07 "Total" column or to the reconciliation report's per-order Total (PRD §16 step 4). Staff and the legacy comparison would then see the pre-discount amount as the order total. That is the order-math integrity the Core Value protects. The naming copies the design's `csps.ts`, but the server is meant to be the single source of truth.
**Fix:** Rename `Total` to `Subtotal` and add `Total` as `Subtotal − Discount`, both here and in the golden-vector `expected` shape. The other option is to record an owner decision that overrides the PRD naming and put a `// SPEC-DEVIATION` note on the record. Whichever is chosen, settle it now, before Phase 5 builds DTOs on these names.

### WR-03: The hidden-segment rule wraps one middleware's provider, not the web root itself

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

### WR-04: Static-file responses no longer write the FND-07 request-completion event

**File:** `src/Csps.Server/Program.cs:79-91`
**Issue:** `UseStaticFiles` now runs before `UseSerilogRequestLogging`. `StaticFileMiddleware` ends the request without calling `next` when it serves a file, including 304 Not Modified and 416 responses. Every request for JS, CSS, fonts, SVG, `robots.txt` or `/index.html` therefore produces no completion event. This breaks the comment on line 88 ("One completion event per request") and the FND-07 contract stated in `tests/Csps.Server.IntegrationTests/Logging/RequestLoggingTests.cs:9` ("every request writes one Serilog request-completion event"). No test covers a static path, so nothing catches the gap. In practice, an incident timeline loses all asset traffic, including scanners probing real files.
**Fix:** Move `app.UseSerilogRequestLogging(...)` above `UseResponseCompression()`/`UseStaticFiles()`, after `UseStatusCodePages`. Add a `RequestLoggingTests` row for `/assets/app-fixture.js`. If leaving static files out of the log is deliberate, update the Program.cs comment and the FND-07 test doc to say so, and record that decision.

### WR-05: npm pins ignore `optionalDependencies`, `peerDependencies` and `bundleDependencies`, so packages there skip the registry gate

**File:** `tests/Csps.ArchitectureTests/PackagePins.cs` (`NpmSections`, `ReadNpmManifest`)
**Issue:** `NpmSections = ["dependencies", "devDependencies", "overrides"]`. npm 7+ installs `peerDependencies` automatically and installs `optionalDependencies` by default. A package added to any of the three missing sections is installed without a registry entry, without the exact-version check and without the 14-day cool-down check. QUAL-06/D-18/D-19 exist to stop exactly that. The gate is silently open, not failed-closed.
**Fix:** Add `"optionalDependencies"`, `"peerDependencies"` and `"bundleDependencies"` (the last is an array, so handle it). Better still, fail when the manifest has any `*ependencies` key not in an allow-list, so a new section can never be skipped silently. Add a `DependencyRegistryTests` case that puts a package under `optionalDependencies` and expects a "has no registry entry" problem.

## Info

### IN-01: `FullyPaid` is true for a fully discounted order with no payment, but false for an empty order

**File:** `src/Csps.Domain/Orders/OrderMath.cs:49`
**Issue:** `FullyPaid = total > 0 && balance <= 0`. With items of ₱51 and a 100% discount (allowed by PRD §5.1), `balance` is 0, so the order reads as fully paid with ₱0 received. An order with no items reads as not paid. The PRD defines no fully-paid rule, and §21 leaves overpayment open. This is a business rule hidden inside the arithmetic.
**Fix:** Have the owner confirm the rule (and whether `total` should be the net total, see WR-02), then note the decision in the XML doc.

### IN-02: `OrderMath` does not guard null elements or PRD invariants

**File:** `src/Csps.Domain/Orders/OrderMath.cs:31-43`
**Issue:** The code checks only that each list is not null. A `null` item or discount inside a list throws `NullReferenceException`. It also accepts negative quantities, negative prices, a negative percent or a percent above 100, which PRD §5.1 forbids. The doc says "arithmetic only", so this is acceptable only if the Order aggregate enforces those rules.
**Fix:** Add `ArgumentNullException` for null elements, or document that callers must pass validated aggregate state. Make sure the Phase 5 aggregate tests cover the invariants.

### IN-03: `{*path:file}` sends dotted client routes to a JSON 404

**File:** `src/Csps.Server/Endpoints/SpaHosting.cs:28,34`
**Issue:** Any page URL whose last segment contains a dot (for example `/admin/users/j.smith`, `/admin/orders/2026.0042`, or a slug like `v1.2`) matches the file pattern. On refresh or on a shared link it returns a ProblemDetails 404 instead of the shell. No current route has a dynamic parameter, but later phases add detail routes.
**Fix:** Record this as a routing constraint in docs/web (route params must never contain a dot, or must be encoded), or add a test that fails when a route definition allows dotted params.

### IN-04: The shell's no-cache value duplicates `SpaCaching.RevalidateCacheControl`

**File:** `src/Csps.Server/Endpoints/SpaHosting.cs:90-91`
**Issue:** `NoCache` hard-codes `"no-cache"` instead of using `SpaCaching.RevalidateCacheControl`. The two cache policies can drift apart.
**Fix:** `context.Context.Response.Headers[HeaderNames.CacheControl] = SpaCaching.RevalidateCacheControl;`

### IN-05: Compressed and uncompressed representations share one strong ETag

**File:** `src/Csps.Server/Composition/SpaRegistration.cs:27-35` with `Program.cs:74-83`
**Issue:** `StaticFileMiddleware` sends a strong ETag, and `ResponseCompressionMiddleware` passes it through unchanged for the `br`, `gzip` and identity bodies. RFC 9110 §8.8.3 requires different strong validators for different representations. `Vary: Accept-Encoding` covers most caches, but `If-Range` and intermediaries that dedupe by ETag can mix them up.
**Fix:** Serve precompressed `.br`/`.gz` assets with their own ETags (for example `MapStaticAssets` or a build-time precompression step), or accept and document the risk.

### IN-06: Some integration rows in the hidden-segment test pass without testing their rule

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

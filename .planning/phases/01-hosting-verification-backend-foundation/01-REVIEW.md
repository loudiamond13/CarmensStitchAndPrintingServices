---
phase: 01-hosting-verification-backend-foundation
reviewed: 2026-10-07T21:48:19Z
created: 2026-10-07T16:48:19-05:00
updated: 2026-10-07T16:48:19-05:00
depth: standard
diff_base: 46faceb
files_reviewed: 171
files_reviewed_list:
  - .config/dotnet-tools.json
  - Directory.Build.props
  - Directory.Packages.props
  - global.json
  - src/Csps.Application/AssemblyMarker.cs
  - src/Csps.Application/Content/GetSiteSettingsHandler.cs
  - src/Csps.Application/Content/SiteSettingsDto.cs
  - src/Csps.Application/Content/SiteSettingsSnapshot.cs
  - src/Csps.Application/Csps.Application.csproj
  - src/Csps.Application/Ports/IAuditTrail.cs
  - src/Csps.Application/Ports/IBusinessCalendar.cs
  - src/Csps.Application/Ports/IRequestContext.cs
  - src/Csps.Application/Ports/ISiteSettingsCache.cs
  - src/Csps.Application/Ports/ISiteSettingsReader.cs
  - src/Csps.Application/Security/Policies.cs
  - src/Csps.Application/Security/Roles.cs
  - src/Csps.Domain/AssemblyMarker.cs
  - src/Csps.Domain/Auditing/AuditEntry.cs
  - src/Csps.Domain/Auditing/IpPrefix.cs
  - src/Csps.Domain/Auditing/UserAgentFamily.cs
  - src/Csps.Domain/Common/Error.cs
  - src/Csps.Domain/Common/ErrorKind.cs
  - src/Csps.Domain/Common/Result.cs
  - src/Csps.Domain/Content/SiteSettings.cs
  - src/Csps.Domain/Content/SiteSettingsDefaults.cs
  - src/Csps.Domain/Csps.Domain.csproj
  - src/Csps.Domain/Time/BusinessClock.cs
  - src/Csps.Domain/Time/TimeZoneResolver.cs
  - src/Csps.Domain/Time/ZoneSource.cs
  - src/Csps.Infrastructure/AssemblyMarker.cs
  - src/Csps.Infrastructure/Auditing/AuditLogAppendOnlyInterceptor.cs
  - src/Csps.Infrastructure/Auditing/AuditTrail.cs
  - src/Csps.Infrastructure/Content/SiteSettingsReader.cs
  - src/Csps.Infrastructure/Csps.Infrastructure.csproj
  - src/Csps.Infrastructure/DataProtection/CertificateLoader.cs
  - src/Csps.Infrastructure/DataProtection/DataProtectionRegistration.cs
  - src/Csps.Infrastructure/DataProtection/DataProtectionSettings.cs
  - src/Csps.Infrastructure/DependencyInjection.cs
  - src/Csps.Infrastructure/Health/DatabaseHealthCheck.cs
  - src/Csps.Infrastructure/Health/TimeZoneHealthCheck.cs
  - src/Csps.Infrastructure/Persistence/Configurations/AuditEntryConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/DataProtectionKeyConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/SiteSettingsConfiguration.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContextOptions.cs
  - src/Csps.Infrastructure/Persistence/CspsDesignTimeDbContextFactory.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261007140149_InitialCreate.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261007165906_AddAuditLog.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261007171939_AddDataProtectionKeys.cs
  - src/Csps.Infrastructure/Persistence/SqlCompatibility.cs
  - src/Csps.Infrastructure/Seeding/DevSeedOptions.cs
  - src/Csps.Infrastructure/Seeding/DevSeedSteps.cs
  - src/Csps.Infrastructure/Seeding/DevSeedTargetCheck.cs
  - src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs
  - src/Csps.Infrastructure/Seeding/DevSeeder.cs
  - src/Csps.Infrastructure/Seeding/ISeedStep.cs
  - src/Csps.Infrastructure/Seeding/SeedStepResult.cs
  - src/Csps.Infrastructure/Seeding/SiteSettingsSeedStep.cs
  - src/Csps.Infrastructure/Time/BusinessCalendar.cs
  - src/Csps.Server/Composition/ApplicationRegistration.cs
  - src/Csps.Server/Composition/JwtOptions.cs
  - src/Csps.Server/Composition/LoggingRegistration.cs
  - src/Csps.Server/Composition/OpenApiRegistration.cs
  - src/Csps.Server/Composition/SecurityRegistration.cs
  - src/Csps.Server/Csps.Server.csproj
  - src/Csps.Server/Endpoints/ApiRouting.cs
  - src/Csps.Server/Endpoints/HealthEndpoint.cs
  - src/Csps.Server/Endpoints/SiteSettingsEndpoints.cs
  - src/Csps.Server/Http/CorrelationId.cs
  - src/Csps.Server/Http/CspsProblemDetails.cs
  - src/Csps.Server/Http/HttpRequestContext.cs
  - src/Csps.Server/Http/MinimalHealthWriter.cs
  - src/Csps.Server/Http/PlainEnglish.cs
  - src/Csps.Server/Http/ResultHttpExtensions.cs
  - src/Csps.Server/Http/SecurityHeadersMiddleware.cs
  - src/Csps.Server/Logging/LogFileSettings.cs
  - src/Csps.Server/Logging/SensitiveDataDestructuringPolicy.cs
  - src/Csps.Server/Logging/SensitiveDataMasking.cs
  - src/Csps.Server/Logging/SensitiveDataMaskingEnricher.cs
  - src/Csps.Server/Program.cs
  - src/Csps.Server/Properties/launchSettings.json
  - src/Csps.Server/appsettings.Development.json
  - src/Csps.Server/appsettings.json
  - src/Csps.Server/web.config
  - tests/Csps.Application.UnitTests/Content/GetSiteSettingsHandlerTests.cs
  - tests/Csps.Application.UnitTests/Csps.Application.UnitTests.csproj
  - tests/Csps.ArchitectureTests/BuildConfigTests.cs
  - tests/Csps.ArchitectureTests/Csps.ArchitectureTests.csproj
  - tests/Csps.ArchitectureTests/DependencyRegistry.cs
  - tests/Csps.ArchitectureTests/DependencyRegistryTests.cs
  - tests/Csps.ArchitectureTests/ForwardedHeadersTests.cs
  - tests/Csps.ArchitectureTests/HostingRecordTests.cs
  - tests/Csps.ArchitectureTests/LayerTests.cs
  - tests/Csps.ArchitectureTests/PackagePins.cs
  - tests/Csps.ArchitectureTests/RepoRoot.cs
  - tests/Csps.ArchitectureTests/SolutionLayoutTests.cs
  - tests/Csps.ArchitectureTests/StartupSafetyTests.cs
  - tests/Csps.Domain.UnitTests/Auditing/AuditEntryTests.cs
  - tests/Csps.Domain.UnitTests/Auditing/IpPrefixTests.cs
  - tests/Csps.Domain.UnitTests/Auditing/UserAgentFamilyTests.cs
  - tests/Csps.Domain.UnitTests/Common/ErrorTests.cs
  - tests/Csps.Domain.UnitTests/Common/ResultTests.cs
  - tests/Csps.Domain.UnitTests/Content/SiteSettingsTests.cs
  - tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj
  - tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs
  - tests/Csps.Domain.UnitTests/Time/TimeZoneResolverTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogSql.cs
  - tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditTrailTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Auditing/FixedRequestContext.cs
  - tests/Csps.Infrastructure.IntegrationTests/Content/SiteSettingsReaderTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Csps.Infrastructure.IntegrationTests.csproj
  - tests/Csps.Infrastructure.IntegrationTests/Fixture/CspsDatabaseTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Fixture/SqlBackendTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Fixture/SqlFixtureTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Fixture/TestDatabaseNameTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedOptionsTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedTargetGuardTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Time/BusinessCalendarTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationCoverage.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationCoverageTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs
  - tests/Csps.Server.IntegrationTests/Content/SiteSettingsEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Csps.Server.IntegrationTests.csproj
  - tests/Csps.Server.IntegrationTests/Health/HealthBody.cs
  - tests/Csps.Server.IntegrationTests/Health/HealthEndpointFailureTests.cs
  - tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Http/ApiRequests.cs
  - tests/Csps.Server.IntegrationTests/Http/CspsProblemDetailsTests.cs
  - tests/Csps.Server.IntegrationTests/Http/HttpRequestContextTests.cs
  - tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs
  - tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs
  - tests/Csps.Server.IntegrationTests/Http/ProblemJson.cs
  - tests/Csps.Server.IntegrationTests/Http/ResultHarness.cs
  - tests/Csps.Server.IntegrationTests/Http/ResultHttpExtensionsTests.cs
  - tests/Csps.Server.IntegrationTests/Http/SecurityHeadersTests.cs
  - tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs
  - tests/Csps.Server.IntegrationTests/Logging/LogEvents.cs
  - tests/Csps.Server.IntegrationTests/Logging/LogFileTests.cs
  - tests/Csps.Server.IntegrationTests/Logging/RequestLoggingTests.cs
  - tests/Csps.Server.IntegrationTests/Logging/SensitiveDataMaskingTests.cs
  - tests/Csps.Server.IntegrationTests/Security/DataProtectionTests.cs
  - tests/Csps.Testing/CollectingSink.cs
  - tests/Csps.Testing/Csps.Testing.csproj
  - tests/Csps.Testing/CspsApiFactory.cs
  - tests/Csps.Testing/CspsDatabase.cs
  - tests/Csps.Testing/InMemoryXmlRepository.cs
  - tests/Csps.Testing/SqlBackend.cs
  - tests/Csps.Testing/SqlServerInstance.cs
  - tests/Csps.Testing/TestCertificates.cs
  - tests/Csps.Testing/TestDatabaseName.cs
  - tests/Csps.Testing/TestJwt.cs
  - tests/Csps.Testing/TestTokens.cs
  - tests/Directory.Build.props
  - tools/Csps.DevSeed/Csps.DevSeed.csproj
  - tools/Csps.DevSeed/Program.cs
  - tools/Csps.HostProbe/Csps.HostProbe.csproj
  - tools/Csps.HostProbe/HostFacts.cs
  - tools/Csps.HostProbe/ProbeKey.cs
  - tools/Csps.HostProbe/Program.cs
  - tools/Csps.HostProbe/appsettings.json
  - tools/scripts/Initialize-DevSecrets.ps1
  - tools/scripts/Initialize-LocalDb.ps1
  - tools/scripts/Invoke-CoverageGate.ps1
  - tools/scripts/New-ThirdPartyNotices.ps1
  - tools/scripts/Remove-StaleTestDatabases.ps1
findings:
  critical: 0
  warning: 9
  info: 9
  total: 18
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-07T21:48:19Z
**Depth:** standard
**Files Reviewed:** 171 (all src/, tools/ and Csps.Testing files line by line; the test projects were scanned for vacuous or misdirected assertions)
**Status:** issues_found

## Summary

The Phase 1 foundation holds up well against the binding security rules:

- Authorization is default-deny: a fallback policy plus named Staff and Manager policies, and a coverage test that finds every endpoint.
- JWT validation is strict: HS256 only, issuer, audience, lifetime and signature are all required, and error details are off.
- The strict CSP has no `unsafe-inline` and no `unsafe-eval` outside the Development-only `/scalar` carve-out.
- A 5xx response never carries exception text.
- The append-only trigger rejects every UPDATE, and every DELETE except an 8-month purge behind a session flag. A truncate guard backs it up.
- Every DDL name the test fixture uses passes `^CSPS_Test_[0-9a-f-]{36}$` plus a length check. The stale-DB script connects only to `(localdb)\CSPS`.
- No secrets are in git.

No BLOCKER-class defect was found.

The warnings fall into four groups:

1. **Runtime correctness.**
   - The HybridCache factory captures a scoped DbContext, which can be disposed while other callers still wait on it (WR-01).
   - `AuditTrail` saves the whole shared unit of work (WR-03).
   - The correlation-id fallback breaks the `IRequestContext` contract that `AuditEntry` enforces (WR-06).
2. **Privacy and security gaps.**
   - A 6to4 IPv6 address keeps the full client IPv4 after /48 truncation (WR-02).
   - The log masker misses the Identity secret properties Phase 4 will introduce (WR-05).
   - HSTS `includeSubDomains` can affect the legacy domain (WR-07).
   - A request flood can evict the 30-day log retention (WR-08).
3. **Tool safety.** The dev-seed guard has no server allow-list. It blocks MSSQLLocalDB by substring only (WR-04).
4. **Test reliability.** Two health tests assert the content type through `?.`, so they pass vacuously when the header is missing (WR-09).

No tests were run for this review. It is a static, read-only review.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: HybridCache factory runs on the first caller's scoped DbContext, which can be disposed while joined callers still wait

**File:** `src/Csps.Infrastructure/Content/SiteSettingsReader.cs:14,31-32,38-54` (registration at `src/Csps.Infrastructure/DependencyInjection.cs:66-68`)
**Issue:**
- `SiteSettingsReader` is scoped and closes over the scoped `CspsDbContext db`. `GetAsync` passes the instance method `LoadAsync` as the HybridCache factory.
- HybridCache's stampede protection runs one factory call for all concurrent callers of `csps:site-settings:v1`. Each caller's cancellation is independent, and the shared work is cancelled only when every caller has cancelled.
- So when the caller that started the factory cancels, its scope ends and its DbContext is disposed, while the factory keeps running for the other callers. Those callers then get `ObjectDisposedException`, which means a 500 for `/api/v1/site-settings` or an Unhealthy time-zone check.
- This is realistic here, because `TimeZoneHealthCheck` has a 3-second timeout (`DependencyInjection.cs:34,87`). Per the code's own comment, SqlClient's login retry takes 10 seconds. On a DB hiccup with a cold cache, the health check times out, disposes its scope, and takes any joined request down with it.
- The scenario needs a cold cache, which happens hourly and after every `InvalidateAsync`.

**Fix:** Do not capture request-scoped state in the cache factory. Use `IDbContextFactory<CspsDbContext>`, and create and dispose the context inside the factory:

```csharp
internal sealed class SiteSettingsReader(HybridCache cache, IDbContextFactory<CspsDbContext> contexts) : ISiteSettingsReader, ISiteSettingsCache
{
    public ValueTask<SiteSettingsSnapshot> GetAsync(CancellationToken ct) =>
        cache.GetOrCreateAsync(CacheKey, contexts, static async (f, token) =>
        {
            await using var db = await f.CreateDbContextAsync(token).ConfigureAwait(false);
            return await db.SiteSettings.AsNoTracking()/* ...same projection... */
                .SingleOrDefaultAsync(token).ConfigureAwait(false) ?? throw new InvalidOperationException(MissingRowMessage);
        }, EntryOptions, Tags, ct);
}
```

Register it with `services.AddDbContextFactory<CspsDbContext>(...)`, which also keeps the scoped `CspsDbContext` registration. The reader can then be a singleton.

### WR-02: IpPrefix keeps the full client IPv4 for 6to4 addresses (data-minimization bypass)

**File:** `src/Csps.Domain/Auditing/IpPrefix.cs:37-40`
**Issue:**
- An IPv6 address is cut to its first 6 bytes (/48).
- A 6to4 address (`2002::/16`, RFC 3056) is `2002:WWXX:YYZZ::/48`, where `WWXXYYZZ` is the client's full public IPv4 address.
- So `2002:cbb1:0c2d::1` is stored as `2002:cbb1:c2d::`, which is exactly 203.177.12.45. D-24 and RA 10173 require IPv4 to be kept only to /24.
- The NAT64 well-known prefix `64:ff9b::/96` has the opposite problem. Its embedded IPv4 is erased entirely, so analytics lose the /24 they are allowed to keep.

**Fix:** Before truncating, map the IPv6 forms that embed an IPv4 address back to IPv4. Then apply the /24 rule:

```csharp
if (address.AddressFamily == AddressFamily.InterNetworkV6)
{
    var b = address.GetAddressBytes();
    if (b[0] == 0x20 && b[1] == 0x02)                       // 6to4 2002:WWXX:YYZZ::/48
        address = new IPAddress(b.AsSpan(2, 4));
    else if (b.AsSpan(0, 12).SequenceEqual(Nat64WellKnown)) // 64:ff9b::/96
        address = new IPAddress(b.AsSpan(12, 4));
}
```

Add `IpPrefixTests` cases for `2002:cbb1:0c2d::1` → `203.177.12.0` and `64:ff9b::cbb1:c2d` → `203.177.12.0`.

### WR-03: AuditTrail.AppendAsync commits every pending change on the shared scoped DbContext

**File:** `src/Csps.Infrastructure/Auditing/AuditTrail.cs:31-32`
**Issue:**
- `AuditTrail` is scoped and receives the same scoped `CspsDbContext` as every handler in the request.
- `context.SaveChangesAsync()` saves the audit row, but it also saves any unrelated entity the handler has modified but not yet decided to commit.
- A handler that audits a rejection or failure before returning a `Result` failure would persist half-made changes. A handler that audits before its own `SaveChangesAsync` hits a concurrency conflict (409) leaves an audit row claiming an action that never happened.
- If the audit save throws, the `Added` entry stays in the tracker, and the handler's next `SaveChangesAsync` silently re-inserts it.
- No handler calls this in Phase 1, but the port doc ("Writes one audit entry and saves it immediately", `IAuditTrail.cs:15`) invites exactly these usages in Phase 4.

**Fix:** Make the unit of work explicit. Either:
- (a) Have `AppendAsync` only `Add` the entry (rename it `Record`), so the handler's own `SaveChangesAsync` commits the entry atomically with the business change. Or
- (b) For audits that must persist even when the business change fails (for example `auth.sign-in-failed`), write through a separate short-lived context from `IDbContextFactory<CspsDbContext>`, so unrelated tracked changes are never flushed.

Document which option each action uses.

### WR-04: The dev-seed guard has no server allow-list, and the MSSQLLocalDB block is a bypassable substring check

**File:** `src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs:45-66` (doc claim at `src/Csps.Infrastructure/Seeding/DevSeedTargetCheck.cs:4`)
**Issue:**
- `DevSeedTargetCheck.Allowed` is documented as "True only for CSPS_Dev or CSPS_E2E **on an allowed server**", but there is no server allow-list.
- Any server is accepted as long as `Initial Catalog` is `CSPS_Dev` or `CSPS_E2E`. For example, `--connection "Server=sql1234.site4now.net;Database=CSPS_E2E;User Id=...;Password=..." --reset` reaches `EnsureDeletedAsync()` (`tools/Csps.DevSeed/Program.cs:41-45`) on a remote host.
- The shared-instance block is `DataSource.Contains("MSSQLLocalDB")`. It does not stop the same instance reached by its named pipe (`np:\\.\pipe\LOCALDB#xxxxxxxx\tsql\query`) or by any other alias. CSPS_Dev could then be created and seeded on TheBETSLLC's shared instance, which CLAUDE.md forbids.

**Fix:** Replace the blocklist with an allow-list of data sources, checked before the database name:

```csharp
private static readonly string[] AllowedDataSources = [@"(localdb)\CSPS", "localhost", "127.0.0.1", "."]; // CI container on loopback
var dataSource = builder.DataSource.Trim();
var host = dataSource.Split(',')[0];   // strip ",port"
if (!AllowedDataSources.Contains(host, StringComparer.OrdinalIgnoreCase))
    return Refused(database, $"Server '{host}' is not an allowed dev-seed server. Use (localdb)\\CSPS.");
```

Add `DevSeedTargetGuardTests` cases for a remote host and for the `np:` pipe form.

### WR-05: The log masker misses the Identity and secret property names Phase 4 will introduce

**File:** `src/Csps.Server/Logging/SensitiveDataMasking.cs:15-31`
**Issue:**
- The exact list is Password, Code, Otp, ApiKey, Authorization, Cookie, ConnectionString, CertificatePassword, CertificateBase64, SigningKey, Secret and Token. The suffixes are Password, Token and Secret.
- With those rules, `PasswordHash` (`IdentityUser`), `SecurityStamp`, `ConcurrencyStamp`, `AuthenticatorKey`, `RecoveryCodes`, `PrivateKey`, `Key`, `Pfx`, `ProbeKey`, `ResetCode` and `VerificationCode` are all logged in clear text.
- The stack uses `IdentityUser<Guid>` (CLAUDE.md), so one `{@User}` in Phase 4 leaks password hashes and security stamps into the 30-day log files (CWE-532).

**Fix:**
- Add `PasswordHash`, `SecurityStamp`, `AuthenticatorKey`, `RecoveryCodes`, `PrivateKey` and `Pfx` to `ExactNames`.
- Add `Key`, `Hash`, `Stamp` and `Code` as suffixes, with `StatusCode` explicitly exempt, or keep `Code` exact and add `ResetCode`/`VerificationCode`.
- Extend `SensitiveDataMaskingTests` with an `IdentityUser<Guid>` instance logged as `{@User}`.

### WR-06: The correlation-id fallback breaks the IRequestContext contract that AuditEntry enforces

**File:** `src/Csps.Server/Http/CorrelationId.cs:20-22`, `src/Csps.Server/Http/HttpRequestContext.cs:32-34`
**Issue:**
- `IRequestContext.CorrelationId` promises "32 lowercase hex characters" (`src/Csps.Application/Ports/IRequestContext.cs:25-29`).
- `AuditEntry.Create` throws `ArgumentException` for anything else (`src/Csps.Domain/Auditing/AuditEntry.cs:140-145`).
- But `HttpRequestContext.CorrelationId` delegates to `CorrelationId.For`, which falls back to `HttpContext.TraceIdentifier` (for example `0HN7...:00000001`) when `Activity.Current` is null. `CspsProblemDetailsTests.WithoutAnActivityTheTraceIdentifierIsUsed` pins that fallback in place.
- Any audit write on that path becomes a 500.
- Separately, `Activity.Current` is the ambient activity, not necessarily the request's. A handler that starts a new root activity gets a different trace id than the one in the logs and the ProblemDetails.

**Fix:** Read the request's own activity, and never return a non-W3C value:

```csharp
public static string For(HttpContext context)
{
    var activity = context.Features.Get<IHttpActivityFeature>()?.Activity ?? Activity.Current;
    return activity is { TraceId: var id } && id != default ? id.ToHexString() : ActivityTraceId.CreateRandom().ToHexString();
}
```

Cache the random id in `context.Items` so the response and the logs agree. Update the fallback test to assert 32 lowercase hex characters.

### WR-07: HSTS `includeSubDomains` on the legacy production domain can break the owner's live subdomains

**File:** `src/Csps.Server/Http/SecurityHeadersMiddleware.cs:24,69-72`
**Issue:**
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` goes on every HTTPS response.
- D-12 makes the legacy site's domain the system domain, and CLAUDE.md says "never disturb the live site".
- If the API is ever served on that domain's apex, every browser that visits it will refuse plain HTTP on every subdomain of the domain for a year. That includes the legacy site, mail or webmail hosts, and any HTTP-only control-panel aliases. There is no way to undo this remotely.
- PRD §15 also says "HSTS after HTTPS verified", but HTTPS termination is still Unverified in `.planning/HOSTING-RECORD.md:170`.

**Fix:**
- Make `includeSubDomains` (and later `preload`) configuration-driven, default off: `SecurityHeaders:HstsIncludeSubDomains=false`.
- Start with a short `max-age` (for example 300) until the hosting record verifies HTTPS on every subdomain.
- Record the owner's approval before turning it on.

### WR-08: Log retention can be wiped by a request flood (the 30-file cap is reached before 30 days)

**File:** `src/Csps.Server/Logging/LogFileSettings.cs:46-54`
**Issue:**
- `RetainedFileCountLimit: 30` combined with `RollOnFileSizeLimit: true` at 10 MB means retention is "30 files", not "30 days" (D-21).
- Every anonymous request writes one request-completion event (`Program.cs:72-73`). Hitting `/api/x` returns a cheap 404 and still logs.
- About 300 MB of requests (on the order of 1M requests) evicts all older files, including the evidence of whatever came before the flood (CWE-779, log evasion).

**Fix:**
- Keep the time limit and raise or remove the count limit (for example `retainedFileCountLimit: null` with `retainedFileTimeLimit: 30 days`).
- Bound disk use with a larger per-file size or a disk-space check instead.
- At minimum, drop the per-request completion event to `Debug` for 404s on the anonymous fallback, using `GetLevel` in `UseSerilogRequestLogging`.

### WR-09: The content-type assertions in two health tests pass vacuously when the header is missing

**File:** `tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs:25`, `tests/Csps.Server.IntegrationTests/Health/HealthEndpointFailureTests.cs:95`
**Issue:**
- `response.Content.Headers.ContentType?.MediaType.ShouldBe("application/json");` puts the `ShouldBe` call inside the null-conditional chain.
- If `ContentType` is null, nothing is asserted.
- `HtmlAcceptStillGetsJson` exists precisely to prove the JSON content type, so its key assertion can never fail on a missing header.

**Fix:**

```csharp
response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/json");
```

## Info

### IN-01: The UserAgentFamily "bot" substring misclassifies real phones

**File:** `src/Csps.Domain/Auditing/UserAgentFamily.cs:68`
**Issue:** `Has(ua, "bot")` matches the Android device brand "CUBOT" (`... Android 10; CUBOT X30 ...`) and any UA containing "Robot". Such visitors are labelled Bot, which skews the later visitor metrics.
**Fix:** Match bot tokens such as `bot/`, `bot;`, `bot)`, `bot ` or `-bot`, or a known list (`Googlebot`, `bingbot`, ...), and add a CUBOT test case.

### IN-02: Initialize-DevSecrets passes the JWT signing key on the command line

**File:** `tools/scripts/Initialize-DevSecrets.ps1:55,124` (contrast with lines 18-19 and 76-81)
**Issue:**
- `Set-Secret $signingKeyName (New-RandomBase64 48)` runs `dotnet user-secrets set Jwt:SigningKey <value>`.
- That puts the key in the process command line, which other local processes can read (CWE-214).
- The certificate pair deliberately goes through stdin "so it never appears on a command line".

**Fix:** Store the signing key through `Set-SecretsFromStdin @{ 'Jwt:SigningKey' = (New-RandomBase64 48) }` as well.

### IN-03: The forwarded-headers detector misses the typed header accessors

**File:** `tests/Csps.ArchitectureTests/ForwardedHeadersTests.cs:172-177`
**Issue:**
- `ProxyHeaderLiteral` only finds quoted names. `context.Request.Headers.XForwardedFor` and `HeaderNames.XForwardedFor` / `HeaderNames.XRealIP` read the same headers without a string literal, so they pass the guard.
- `ServerDoesNotReferenceForwardedHeadersTypes` does not catch them either: `IHeaderDictionary.XForwardedFor` is a property on `Microsoft.AspNetCore.Http.IHeaderDictionary`, not a HttpOverrides type.

**Fix:** Add `\b(XForwardedFor|XForwardedProto|XForwardedHost|XRealIP)\b` to the source regex, plus an `InlineData` sample for each.

### IN-04: JWT validation does not check the token type

**File:** `src/Csps.Server/Composition/SecurityRegistration.cs:66-81`
**Issue:** `TokenValidationParameters` sets no `ValidTypes`. Any HS256 JWT signed with the same key and the same `iss`/`aud` is accepted as an access token. If Phase 4 mints other JWTs (refresh, e-mail confirmation, password reset) with the same key, those could be replayed as bearer tokens (token confusion).
**Fix:** Issue access tokens with `typ: at+jwt` (`SecurityTokenDescriptor.TokenType`), set `ValidTypes = ["at+jwt"]`, and update `TestTokens`.

### IN-05: HTTPS redirection is on while HTTPS termination is unverified

**File:** `src/Csps.Server/Program.cs:19-23,56-59`
**Issue:** Outside Development and Testing, `UseHttpsRedirection()` is unconditional. The hosting record marks "HTTPS termination" Unverified. If SmarterASP terminates TLS in front of IIS and forwards plain HTTP, `Request.IsHttps` is always false. The result is a redirect loop and no HSTS. Forwarded headers are deliberately off, so nothing would correct it.
**Fix:** Gate it on configuration (`Https:Redirect`, default true) so the first deploy can switch it off without a rebuild. Add the check to the Phase 3 first-deploy checklist.

### IN-06: `AllowedHosts: "*"` in production settings

**File:** `src/Csps.Server/appsettings.json:18`
**Issue:**
- Host filtering is disabled, so any `Host` header is accepted.
- In Phase 1 only the HTTPS redirect builds a URL from it, so an attacker can only redirect themselves.
- Phase 4 password-reset and confirmation links built from `Request.Host` would be poisonable (CWE-644).

**Fix:** Set `AllowedHosts` to the real host names in production configuration, and never build e-mail links from the request host.

### IN-07: The certificate check accepts a non-RSA PFX that fails only at first key creation

**File:** `src/Csps.Infrastructure/DataProtection/CertificateLoader.cs:57-61`
**Issue:**
- Start-up validation checks only `HasPrivateKey`. Certificate XML encryption needs an RSA key.
- An ECDSA PFX passes `ValidateOnStart`, then throws on the first key-ring write, after the site is already serving.

**Fix:** Also require `certificate.GetRSAPrivateKey() is not null`, with a plain message such as "The certificate must hold an RSA key". Add a `TestCertificates` ECDSA case.

### IN-08: Minor tooling inaccuracies

**File:** `tools/Csps.DevSeed/Program.cs:43-44`; `tools/scripts/Remove-StaleTestDatabases.ps1:43-45`
**Issue:**
- DevSeed prints "Dropped {db}." even when `EnsureDeletedAsync()` returned false because there was nothing to drop.
- The `MSSQLLocalDB` check in the cleanup script tests a hard-coded constant, so it can never fire (dead code).

**Fix:** Print based on the return value of `EnsureDeletedAsync`. Remove the dead check, or make the connection string a parameter that the check actually guards.

### IN-09: CLAUDE.md still states 2-year audit retention

**File:** `CLAUDE.md` ("Audit/logs" bullet) vs `src/Csps.Infrastructure/Persistence/Migrations/20261007165906_AddAuditLog.cs:53-69`
**Issue:** D-32 changed retention to 8 months, and the trigger enforces 8 months. The project instructions that every session reads still say "2-year audit retention", so a future session may "fix" the trigger back.
**Fix:** Update the CLAUDE.md bullet to "8-month audit retention (D-32)".

---

_Reviewed: 2026-10-07T21:48:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

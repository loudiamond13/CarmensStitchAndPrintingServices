using Csps.Server.IntegrationTests.Authorization;
using Csps.Server.Security;
using Csps.Testing;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Idempotency;

/// <summary>
/// SEC-06, D-40: every POST the API maps is covered by the Idempotency-Key gate or exempt with a written reason that
/// matches the allow-list. The rule is proven on synthetic endpoints, then applied to the real API.
/// </summary>
public sealed class IdempotencyCoverageTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Reason = "Read-only lookup; changes nothing.";

    private static readonly IReadOnlyDictionary<string, string> NoAllowList = new Dictionary<string, string>(StringComparer.Ordinal);

    [Fact]
    public async Task EveryDiscoveredPostIsCoveredOrExemptWithAWrittenReason()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>().ToList();

        // Discovery must really see the API, or an empty list would pass vacuously: one covered and one exempt POST.
        var postKeys = endpoints.SelectMany(AuthorizationCoverage.KeysOf).Where(static key => key.StartsWith("POST ", StringComparison.Ordinal)).ToList();
        postKeys.ShouldContain("POST /api/v1/auth/password/forgot");
        postKeys.ShouldContain("POST /api/v1/auth/sign-in");

        IdempotencyCoverage.FindViolations(endpoints, IdempotencyAllowList.ReasonsByKey).ShouldBeEmpty();
    }

    [Fact]
    public async Task ThePasswordPostsThatChangeStateAreCovered()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>().ToList();

        foreach (var route in new[] { "api/v1/auth/password/forgot", "api/v1/auth/password/reset" })
        {
            var endpoint = endpoints.Single(e => e.RoutePattern.RawText == route && e.Metadata.GetMetadata<IHttpMethodMetadata>()!.HttpMethods.Contains("POST"));
            endpoint.Metadata.GetMetadata<IdempotencyExemptAttribute>().ShouldBeNull(route);
            IdempotencyAllowList.ReasonsByKey.ShouldNotContainKey($"POST /{route}");
        }
    }

    [Fact]
    public void EveryEntryHasAKeyAReasonAndTheDecision()
    {
        IdempotencyAllowList.Entries.ShouldNotBeEmpty();
        IdempotencyAllowList.Entries.Select(static entry => entry.Key).ShouldBeUnique();
        foreach (var entry in IdempotencyAllowList.Entries)
        {
            entry.Key.ShouldStartWith("POST /");
            entry.Reason.ShouldNotBeNullOrWhiteSpace(entry.Key);
            entry.Decision.ShouldBe("D-40", entry.Key);
        }
    }

    [Fact]
    public void APostWithNeitherAnExemptionNorAnEntryIsCovered()
    {
        var endpoint = Endpoint("/api/v1/orders", ["POST"]);

        IdempotencyCoverage.FindViolations([endpoint], NoAllowList).ShouldBeEmpty();
    }

    [Fact]
    public void AnExemptPostThatIsNotOnTheAllowListIsAViolation()
    {
        var endpoint = Endpoint("/api/v1/orders", ["POST"], new IdempotencyExemptAttribute(Reason));

        IdempotencyCoverage.FindViolations([endpoint], NoAllowList).ShouldHaveSingleItem().ShouldContain("POST /api/v1/orders");
    }

    [Fact]
    public void AListedPostThatIsNotExemptIsAViolation()
    {
        var endpoint = Endpoint("/api/v1/orders", ["POST"]);
        var allowList = new Dictionary<string, string> { ["POST /api/v1/orders"] = Reason };

        IdempotencyCoverage.FindViolations([endpoint], allowList).ShouldHaveSingleItem().ShouldContain("POST /api/v1/orders");
    }

    [Fact]
    public void AnAllowListEntryThatMatchesNoPostIsAViolation()
    {
        var getOnly = Endpoint("/api/v1/orders", ["GET"]);
        var allowList = new Dictionary<string, string> { ["POST /api/v1/orders"] = Reason, ["POST /api/v1/gone"] = Reason };

        var violations = IdempotencyCoverage.FindViolations([getOnly], allowList);

        violations.Count.ShouldBe(2);
        violations.ShouldAllBe(static line => line.Contains("matches no POST endpoint", StringComparison.Ordinal));
    }

    [Fact]
    public void AReasonThatDiffersFromTheAllowListIsAViolation()
    {
        var endpoint = Endpoint("/api/v1/orders", ["POST"], new IdempotencyExemptAttribute(Reason));
        var allowList = new Dictionary<string, string> { ["POST /api/v1/orders"] = "A different reason." };

        IdempotencyCoverage.FindViolations([endpoint], allowList).ShouldHaveSingleItem().ShouldContain("reason");
    }

    [Fact]
    public void ExemptAndListedWithTheSameReasonIsFine()
    {
        var endpoint = Endpoint("api/v1/orders", ["POST"], new IdempotencyExemptAttribute(Reason));
        var allowList = new Dictionary<string, string> { ["POST /api/v1/orders"] = Reason };

        IdempotencyCoverage.FindViolations([endpoint], allowList).ShouldBeEmpty();
    }

    [Fact]
    public void AnyMethodAndNonPostEndpointsAreNotPostEndpoints()
    {
        RouteEndpoint[] endpoints =
        [
            Endpoint("/api/{**path}", []),
            Endpoint("/health", ["GET", "HEAD"]),
            Endpoint("/api/v1/items", ["GET", "DELETE"]),
        ];

        IdempotencyCoverage.FindViolations(endpoints, NoAllowList).ShouldBeEmpty();
    }

    [Fact]
    public void AMultiMethodEndpointIsCheckedForItsPostKey()
    {
        var endpoint = Endpoint("/api/v1/items", ["GET", "POST"], new IdempotencyExemptAttribute(Reason));

        IdempotencyCoverage.FindViolations([endpoint], NoAllowList).ShouldHaveSingleItem().ShouldContain("POST /api/v1/items");
    }

    [Fact]
    public void TheExemptionNeedsAReason()
    {
        Should.Throw<ArgumentException>(() => new IdempotencyExemptAttribute(string.Empty));
        Should.Throw<ArgumentException>(() => new IdempotencyExemptAttribute("   "));
    }

    private static RouteEndpoint Endpoint(string pattern, string[] methods, params object[] metadata)
    {
        var builder = new RouteEndpointBuilder(static _ => Task.CompletedTask, RoutePatternFactory.Parse(pattern), order: 0);
        if (methods.Length > 0)
        {
            builder.Metadata.Add(new HttpMethodMetadata(methods));
        }

        foreach (var item in metadata)
        {
            builder.Metadata.Add(item);
        }

        return (RouteEndpoint)builder.Build();
    }
}

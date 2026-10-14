using Csps.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;

namespace Csps.Server.IntegrationTests.Authorization;

/// <summary>
/// SEC-02: proves the coverage rule fails on each kind of gap, with synthetic endpoints built by
/// <see cref="RouteEndpointBuilder"/>, so no endpoint has to be added to the real API to show the harness bites.
/// </summary>
public sealed class AuthorizationCoverageTests
{
    private static readonly IReadOnlySet<string> NoAllowList = new HashSet<string>(StringComparer.Ordinal);

    [Fact]
    public void EndpointWithNoAuthorizationMetadataIsAViolation()
    {
        var endpoint = Endpoint("/api/v1/open", "GET");

        var violations = Find([endpoint], [Row("GET", "/api/v1/open")]);

        violations.ShouldHaveSingleItem().ShouldContain("GET /api/v1/open");
    }

    [Fact]
    public void RequireAuthorizationWithoutANamedPolicyIsAViolation()
    {
        var endpoint = Endpoint("/api/v1/signed-in", "GET", new AuthorizeAttribute());

        var violations = Find([endpoint], [Row("GET", "/api/v1/signed-in")]);

        violations.ShouldHaveSingleItem().ShouldContain("GET /api/v1/signed-in");
    }

    [Fact]
    public void PolicyThatIsNotAPoliciesConstantIsAViolation()
    {
        var endpoint = Endpoint("/api/v1/shadow", "GET", new AuthorizeAttribute("Shadow"));

        var violations = Find([endpoint], [Row("GET", "/api/v1/shadow")]);

        var violation = violations.ShouldHaveSingleItem();
        violation.ShouldContain("GET /api/v1/shadow");
        violation.ShouldContain("Shadow");
    }

    [Fact]
    public void AnonymousEndpointMissingFromTheAllowListIsAViolation()
    {
        var endpoint = Endpoint("/public", null, new AllowAnonymousAttribute());

        var violations = Find([endpoint], [Row("*", "/public")]);

        violations.ShouldHaveSingleItem().ShouldContain("* /public");
    }

    [Fact]
    public void AllowAnonymousOverridesAPolicyAndStillNeedsTheAllowList()
    {
        // An anonymous parent group wins over the policy inside it (research Anti-Patterns).
        var endpoint = Endpoint("/api/v1/leaky", "GET", new AuthorizeAttribute(Policies.Staff), new AllowAnonymousAttribute());

        var violations = Find([endpoint], [Row("GET", "/api/v1/leaky")]);

        violations.ShouldHaveSingleItem().ShouldContain("GET /api/v1/leaky");
    }

    [Fact]
    public void EndpointWithoutAMatrixRowIsAViolation()
    {
        var endpoint = Endpoint("/api/v1/orders", "GET", new AuthorizeAttribute(Policies.Staff));

        var violations = Find([endpoint], []);

        violations.ShouldHaveSingleItem().ShouldContain("GET /api/v1/orders");
    }

    [Fact]
    public void MatrixRowMatchingNoEndpointIsAViolation()
    {
        var violations = Find([], [Row("GET", "/api/v1/gone")]);

        violations.ShouldHaveSingleItem().ShouldContain("GET /api/v1/gone");
    }

    [Fact]
    public void AllowListEntryMatchingNoAnonymousEndpointIsAViolation()
    {
        var endpoint = Endpoint("/api/v1/orders", "GET", new AuthorizeAttribute(Policies.Staff));
        var allowList = new HashSet<string>(StringComparer.Ordinal) { "GET /api/v1/orders" };

        var violations = AuthorizationCoverage.FindViolations([endpoint], [Row("GET", "/api/v1/orders")], allowList);

        violations.ShouldHaveSingleItem().ShouldContain("GET /api/v1/orders");
    }

    [Fact]
    public void EachMethodOfAMultiMethodEndpointNeedsItsOwnRow()
    {
        var endpoint = MultiMethodEndpoint("/api/v1/items", ["GET", "POST"], new AuthorizeAttribute(Policies.Staff));

        var violations = Find([endpoint], [Row("GET", "/api/v1/items")]);

        violations.ShouldHaveSingleItem().ShouldContain("POST /api/v1/items");
    }

    [Fact]
    public void FullyCoveredEndpointsHaveNoViolations()
    {
        RouteEndpoint[] endpoints =
        [
            MultiMethodEndpoint("/health", ["GET", "HEAD"], new AllowAnonymousAttribute()),
            Endpoint("/api/{**path}", null, new AllowAnonymousAttribute()),
            Endpoint("/api/v1/site-settings", "GET", new AuthorizeAttribute(Policies.Staff)),
            Endpoint("/api/v1/users", "POST", new AuthorizeAttribute(Policies.Manager)),
        ];
        var allowList = new HashSet<string>(StringComparer.Ordinal) { "GET /health", "HEAD /health", "* /api/{**path}" };
        MatrixRow[] matrix =
        [
            Row("GET", "/health"),
            Row("HEAD", "/health"),
            Row("*", "/api/{**path}"),
            Row("GET", "/api/v1/site-settings"),
            Row("POST", "/api/v1/users"),
        ];

        AuthorizationCoverage.FindViolations(endpoints, matrix, allowList).ShouldBeEmpty();
    }

    [Fact]
    public void KeysUseTheMethodOrAStar()
    {
        AuthorizationCoverage.KeysOf(Endpoint("/api/{**path}", null)).ShouldBe(["* /api/{**path}"]);
        AuthorizationCoverage.KeysOf(MultiMethodEndpoint("/health", ["GET", "HEAD"])).ShouldBe(["GET /health", "HEAD /health"]);
        AuthorizationCoverage.KeysOf(MultiMethodEndpoint("/api/v1/items", ["GET", "POST"])).ShouldBe(["GET /api/v1/items", "POST /api/v1/items"]);
    }

    [Fact]
    public void PolicyNamesAreThePoliciesConstants() =>
        AuthorizationCoverage.PolicyNames.ShouldBe([Policies.Staff, Policies.Manager], ignoreOrder: true);

    private static IReadOnlyList<string> Find(IEnumerable<RouteEndpoint> endpoints, IReadOnlyCollection<MatrixRow> matrix) =>
        AuthorizationCoverage.FindViolations(endpoints, matrix, NoAllowList);

    private static MatrixRow Row(string method, string pattern) => new(method, pattern, pattern, 401, 200, 200);

    private static RouteEndpoint Endpoint(string pattern, string? method, params object[] metadata) =>
        MultiMethodEndpoint(pattern, method is null ? [] : [method], metadata);

    private static RouteEndpoint MultiMethodEndpoint(string pattern, string[] methods, params object[] metadata)
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

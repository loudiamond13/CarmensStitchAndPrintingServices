using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Health;

/// <summary>
/// FND-06, D-23: the walking skeleton end to end. <c>GET /health</c> runs the self, database and time-zone checks
/// against a migrated <c>CSPS_Test_&lt;guid&gt;</c> database, where the zone comes from the SiteSettings row.
/// Only GET and HEAD reach the checks; any other method gets the unserved-request answer (401 or 404).
/// </summary>
public sealed class HealthEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string ExpectedBody =
        """{"status":"Healthy","checks":[{"name":"self","status":"Healthy"},{"name":"database","status":"Healthy"},{"name":"time-zone","status":"Healthy"}]}""";

    [Fact]
    public async Task ReturnsHealthyWithAllChecks()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/json");
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldBe(ExpectedBody);
    }

    [Fact]
    public async Task IsNotCacheable()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
    }

    [Theory]
    [InlineData("POST", false, HttpStatusCode.Unauthorized)]
    [InlineData("PUT", false, HttpStatusCode.Unauthorized)]
    [InlineData("DELETE", false, HttpStatusCode.Unauthorized)]
    [InlineData("POST", true, HttpStatusCode.NotFound)]
    [InlineData("PUT", true, HttpStatusCode.NotFound)]
    [InlineData("DELETE", true, HttpStatusCode.NotFound)]
    public async Task OtherMethodsNeverRunTheChecks(string method, bool signedIn, HttpStatusCode expected)
    {
        // Only GET and HEAD map to the health checks. Any other method matches no endpoint, so it is answered like
        // every unserved request: default deny challenges an anonymous caller (SEC-02, assumption A3), and a signed-in
        // caller gets 404, not 405, because the any-method missing-file fallback shares the routing node (research A4).
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var token = signedIn ? TestTokens.For(Roles.Admin, TimeProvider.System) : null;
        using var request = ApiRequests.Create(new HttpMethod(method), "/health", token);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(expected);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/problem+json");
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldNotContain("Healthy");
        body.ShouldNotContain("checks");
    }

    [Fact]
    public async Task ExposesNoInternals()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        HealthBody.PropertyNames(body).ShouldBe(HealthBody.AllowedPropertyNames, ignoreOrder: true);
    }
}

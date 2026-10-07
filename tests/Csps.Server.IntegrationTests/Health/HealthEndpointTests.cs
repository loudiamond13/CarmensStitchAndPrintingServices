using System.Net;
using System.Text.Json;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Health;

/// <summary>
/// FND-06, D-23: the walking skeleton end to end. <c>GET /health</c> runs the self, database and time-zone checks
/// against a migrated <c>CSPS_Test_&lt;guid&gt;</c> database, where the zone comes from the SiteSettings row.
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
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/json");
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

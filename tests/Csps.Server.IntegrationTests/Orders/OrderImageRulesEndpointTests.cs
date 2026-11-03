using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-04, IMG-02, OR-3: signed-in staff read the photo rules from one server source; anonymous callers do not.</summary>
public sealed class OrderImageRulesEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/orders/image-rules";

    [Theory]
    [InlineData(Roles.Manager)]
    [InlineData(Roles.Admin)]
    public async Task StaffReadTheLimitsTheUploadEnforces(string role)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory, role);

        using var request = ApiRequests.Get(Route, session.AccessToken);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        using var document = JsonDocument.Parse(text);
        var rules = document.RootElement;
        rules.GetProperty("maxPerOrder").GetInt32().ShouldBe(5);
        rules.GetProperty("maxBytes").GetInt32().ShouldBe(10_485_760);
        rules.GetProperty("maxPixels").GetInt64().ShouldBe(25_000_000);
        rules.GetProperty("maxSide").GetInt32().ShouldBe(10_000);
        rules.GetProperty("types").EnumerateArray().Select(static type => type.GetString()).ShouldBe(["jpeg", "png", "webp", "heic"]);
        rules.GetProperty("descriptionMaxLength").GetInt32().ShouldBe(200);
    }

    [Fact]
    public async Task AnonymousCallersAreRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var request = ApiRequests.Get(Route);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}

using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// D-29, SEC-02: <c>GET /api/v1/site-settings</c> is a real protected endpoint. Staff (Admin or Manager) read the
/// migration-seeded settings; an anonymous caller is challenged with a ProblemDetails 401.
/// </summary>
public sealed class SiteSettingsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/site-settings";

    private static readonly string[] DtoPropertyNames =
    [
        "businessName", "timeZoneId", "currencyCode", "locale", "contactEmail", "contactPhone", "addressLine", "facebookUrl", "rowVersion",
    ];

    [Fact]
    public Task ManagerReadsSettings() => StaffReadsSettingsAsync(Roles.Manager);

    [Fact]
    public Task AdminReadsSettings() => StaffReadsSettingsAsync(Roles.Admin);

    [Fact]
    public async Task AnonymousGets401Problem()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(Route);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("status").GetInt32().ShouldBe(401);
        problem.GetProperty("title").GetString().ShouldBe("Please sign in to continue.");
        ProblemJson.TraceId(problem);
    }

    private async Task StaffReadsSettingsAsync(string role)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(Route, (await TestSessions.StartAsync(factory, role)).AccessToken);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/json");
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(text);
        var settings = document.RootElement;

        settings.EnumerateObject().Select(property => property.Name).ShouldBe(DtoPropertyNames, ignoreOrder: true);
        settings.GetProperty("businessName").GetString().ShouldBe("Carmen's Stitch & Printing Services");
        settings.GetProperty("timeZoneId").GetString().ShouldBe("Asia/Manila");
        settings.GetProperty("currencyCode").GetString().ShouldBe("PHP");
        settings.GetProperty("locale").GetString().ShouldBe("en-PH");
        var rowVersion = settings.GetProperty("rowVersion").GetString().ShouldNotBeNull();
        Convert.FromBase64String(rowVersion).Length.ShouldBe(8, "rowVersion is the base64 of the 8-byte SQL rowversion");
    }
}

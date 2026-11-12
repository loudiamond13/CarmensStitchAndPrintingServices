using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// D-29, D-35, SEC-02, CONT-01: <c>GET /api/v1/site-settings</c> is a real protected endpoint. Staff (Admin or Manager) read every
/// Business Info field, the shop email, the phones, the version and who last changed the settings, with the fixed time zone, currency
/// and locale; an anonymous caller is challenged with a ProblemDetails 401.
/// </summary>
public sealed class SiteSettingsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/site-settings";

    private static readonly string[] DtoPropertyNames =
    [
        "businessName", "tagline", "aboutText", "turnaroundLine", "street", "townOrCity", "province", "postalCode", "directionsUrl",
        "mapEmbedUrl", "messengerUrl", "facebookUrl", "instagramUrl", "tiktokUrl", "contactEmail", "phones", "timeZoneId", "currencyCode",
        "locale", "version", "updatedByName", "updatedAtUtc",
    ];

    [Fact]
    public Task ManagerReadsSettings() => StaffReadsSettingsAsync(Roles.Manager);

    [Fact]
    public Task AdminReadsSettings() => StaffReadsSettingsAsync(Roles.Admin);

    [Fact]
    public async Task AnAdminSeesTheEmailAndEverythingElseAManagerSavedAndWhoSavedIt()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        using var current = await Get(client, admin.AccessToken);
        var version = await VersionAsync(current);
        using var saved = await SiteSettingsWriteTests.PutAsync(client, manager.AccessToken, SiteSettingsWriteTests.Body(version, "Sample tagline two"));
        saved.StatusCode.ShouldBe(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        using var response = await Get(client, admin.AccessToken);

        var settings = Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        settings.GetProperty("businessName").GetString().ShouldBe("Sample Shop");
        settings.GetProperty("tagline").GetString().ShouldBe("Sample tagline two");
        settings.GetProperty("aboutText").GetString().ShouldBe("About the sample shop.");
        settings.GetProperty("turnaroundLine").GetString().ShouldBe("Mockups in 24 hours.");
        settings.GetProperty("street").GetString().ShouldBe("12 Sample St., Poblacion");
        settings.GetProperty("townOrCity").GetString().ShouldBe("Sample City");
        settings.GetProperty("province").GetString().ShouldBe("Sample Province");
        settings.GetProperty("postalCode").GetString().ShouldBe("1000");
        settings.GetProperty("directionsUrl").GetString().ShouldBe("https://maps.app.goo.gl/abc123");
        settings.GetProperty("mapEmbedUrl").GetString().ShouldBe("https://www.google.com/maps/embed?pb=sample");
        settings.GetProperty("messengerUrl").GetString().ShouldBe("https://m.me/cspsdemo");
        settings.GetProperty("facebookUrl").GetString().ShouldBe("https://www.facebook.com/cspsdemo");
        settings.GetProperty("instagramUrl").GetString().ShouldBe("https://www.instagram.com/cspsdemo");
        settings.GetProperty("tiktokUrl").GetString().ShouldBe("https://www.tiktok.com/@cspsdemo");
        settings.GetProperty("contactEmail").GetString().ShouldBe("shop-private@example.test");
        var phones = settings.GetProperty("phones").EnumerateArray().ToList();
        phones.Select(phone => phone.GetProperty("number").GetString()).ShouldBe(["0917 123 4567", "02 8123 4567"]);
        phones[0].GetProperty("label").GetString().ShouldBe("Globe");
        phones[0].GetProperty("isMain").GetBoolean().ShouldBeTrue();
        phones[1].GetProperty("isMain").GetBoolean().ShouldBeFalse();
        settings.GetProperty("timeZoneId").GetString().ShouldBe("Asia/Manila");
        settings.GetProperty("currencyCode").GetString().ShouldBe("PHP");
        settings.GetProperty("locale").GetString().ShouldBe("en-PH");
        settings.GetProperty("updatedByName").GetString().ShouldBe("Paolo Reyes");
        settings.GetProperty("updatedAtUtc").GetDateTimeOffset().ShouldBeGreaterThan(TimeProvider.System.GetUtcNow().AddMinutes(-5));
    }

    [Fact]
    public async Task AnAnonymousCallerGets401Problem()
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

    private static async Task<HttpResponseMessage> Get(HttpClient client, string accessToken)
    {
        using var request = ApiRequests.Get(Route, accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static JsonElement Parse(string text)
    {
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    private static async Task<string> VersionAsync(HttpResponseMessage response) =>
        Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).GetProperty("version").GetString()!;

    private async Task StaffReadsSettingsAsync(string role)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory, role);

        using var response = await Get(client, session.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/json");
        var settings = Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        settings.EnumerateObject().Select(property => property.Name).ShouldBe(DtoPropertyNames, ignoreOrder: true);
        settings.GetProperty("businessName").GetString().ShouldNotBeNullOrWhiteSpace();
        settings.GetProperty("timeZoneId").GetString().ShouldBe("Asia/Manila");
        settings.GetProperty("currencyCode").GetString().ShouldBe("PHP");
        settings.GetProperty("locale").GetString().ShouldBe("en-PH");
        var version = settings.GetProperty("version").GetString().ShouldNotBeNull();
        Convert.FromBase64String(version).Length.ShouldBe(8, "version is the base64 of the 8-byte SQL rowversion");
    }
}

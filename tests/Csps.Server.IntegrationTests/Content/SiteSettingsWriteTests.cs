using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// CONT-01, PUB-03, SEC-07, SEC-08, AUDIT-01: a Manager saves the business info with <c>PUT /api/v1/site-settings</c>, and the next
/// public read and page head show it at once. An Admin and an anonymous caller are refused. All values are fake.
/// </summary>
public sealed partial class SiteSettingsWriteTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/site-settings";
    private const string PublicRoute = "/api/v1/public/site";

    [Fact]
    public async Task AManagersNewTaglineShowsOnTheNextPublicReadWithANewETagAndAsTheHomeDescription()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        using var before = await client.GetAsync(new Uri(PublicRoute, UriKind.Relative), TestContext.Current.CancellationToken);
        var oldEtag = before.Headers.ETag.ShouldNotBeNull();

        using var response = await PutAsync(client, manager.AccessToken, Body(await VersionAsync(), "Sample tagline two"));

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var saved = JsonDocument.Parse(text);
        saved.RootElement.GetProperty("tagline").GetString().ShouldBe("Sample tagline two");
        using var after = await client.GetAsync(new Uri(PublicRoute, UriKind.Relative), TestContext.Current.CancellationToken);
        using var site = JsonDocument.Parse(await after.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        site.RootElement.GetProperty("tagline").GetString().ShouldBe("Sample tagline two");
        after.Headers.ETag.ShouldNotBeNull().ShouldNotBe(oldEtag);
        var home = await client.GetStringAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
        DescriptionPattern().Match(home).Groups["content"].Value.ShouldBe("Sample tagline two");
    }

    [Fact]
    public async Task AnAdminGets403AndNothingIsStored()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using var response = await PutAsync(client, admin.AccessToken, Body(await VersionAsync(), "Admin tagline"));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        await using var context = database.CreateContext();
        (await context.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).Tagline.ShouldBe("Sample tagline");
    }

    [Fact]
    public async Task AnAnonymousCallerGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await PutAsync(client, accessToken: null, Body("AAAAAAAAB9E=", "Anonymous tagline"));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    internal static object Body(string version, string tagline) => new
    {
        version,
        businessName = "Sample Shop",
        tagline,
        aboutText = "About the sample shop.",
        turnaroundLine = "Mockups in 24 hours.",
        street = "12 Sample St., Poblacion",
        townOrCity = "Sample City",
        province = "Sample Province",
        postalCode = "1000",
        directionsUrl = "https://maps.app.goo.gl/abc123",
        mapEmbedUrl = "https://www.google.com/maps/embed?pb=sample",
        messengerUrl = "https://m.me/cspsdemo",
        facebookUrl = "https://www.facebook.com/cspsdemo",
        instagramUrl = "https://www.instagram.com/cspsdemo",
        tiktokUrl = "https://www.tiktok.com/@cspsdemo",
        contactEmail = "shop-private@example.test",
        phones = new[]
        {
            new { number = "0917 123 4567", label = (string?)"Globe", isMain = true },
            new { number = "02 8123 4567", label = (string?)null, isMain = false },
        },
    };

    internal static async Task<HttpResponseMessage> PutAsync(HttpClient client, string? accessToken, object? body)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Put, Route, accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private async Task<string> VersionAsync()
    {
        await using var context = database.CreateContext();
        var row = await context.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        return Convert.ToBase64String(row.RowVersion);
    }

    [GeneratedRegex("<meta name=\"description\" content=\"(?<content>[^\"]*)\"", RegexOptions.None, matchTimeoutMilliseconds: 1000)]
    private static partial Regex DescriptionPattern();
}

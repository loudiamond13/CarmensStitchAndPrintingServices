using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Content;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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
        await PublicContentSeeding.SaveAsync(database, Seed());
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
        await PublicContentSeeding.SaveAsync(database, Seed());
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

    [Fact]
    public async Task TwoManagersReadTheSameVersionTheFirstSaveWinsAndTheSecondGets409AndChangesNothing()
    {
        await PublicContentSeeding.SaveAsync(database, Seed());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var first = await TestSessions.StartAsync(factory, Roles.Manager);
        var second = await TestSessions.StartAsync(factory, Roles.Manager);
        var version = await VersionAsync();

        using var winner = await PutAsync(client, first.AccessToken, Body(version, "First manager tagline"));
        using var loser = await PutAsync(client, second.AccessToken, Body(version, "Second manager tagline"));

        winner.StatusCode.ShouldBe(HttpStatusCode.OK, await winner.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        loser.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var problem = await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("edit.stale");
        problem.GetProperty("status").GetInt32().ShouldBe(409);
        await using var context = database.CreateContext();
        (await context.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).Tagline.ShouldBe("First manager tagline");
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == second.UserId, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task StampFieldsSentByTheClientAreIgnoredAndTheServerStampsTheManagerAndTheClock()
    {
        await PublicContentSeeding.SaveAsync(database, Seed());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var other = await TestSessions.StartAsync(factory, Roles.Admin);
        await using var before = database.CreateContext();
        var createdAt = (await before.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).CreatedAtUtc;
        var body = WithExtras(
            Body(await VersionAsync(), "Stamped tagline"),
            ("createdById", other.UserId),
            ("updatedById", other.UserId),
            ("createdAtUtc", "2000-01-01T00:00:00Z"),
            ("updatedAtUtc", "2000-01-01T00:00:00Z"));

        using var response = await PutAsync(client, manager.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var row = await context.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        row.UpdatedById.ShouldBe(manager.UserId);
        row.UpdatedAtUtc.ShouldNotBeNull().ShouldBeInRange(TimeProvider.System.GetUtcNow().AddMinutes(-2), TimeProvider.System.GetUtcNow().AddMinutes(1));
        row.CreatedAtUtc.ShouldBe(createdAt);
        row.CreatedById.ShouldNotBe(other.UserId);
    }

    [Fact]
    public async Task ASaveThatChangesTheNameAndTaglineWritesOneAuditEntryWithTheNameButNotTheTagline()
    {
        await PublicContentSeeding.SaveAsync(database, Seed("Audit tagline before"));
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var body = WithExtras(Body(await VersionAsync(), "Audit tagline after"), ("businessName", "Renamed Sample Shop"));

        using var response = await PutAsync(client, manager.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking().SingleAsync(row => row.ActorUserId == manager.UserId && row.Action == "site-settings.changed", TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("SiteSettings");
        entry.TargetId.ShouldBe("1");
        entry.Detail.ShouldBe("fields=businessName,tagline;businessName=Sample Shop>Renamed Sample Shop");
        entry.Detail.ShouldNotBeNull().ShouldNotContain("Audit tagline");
    }

    [Fact]
    public async Task ASaveWithNoChangeWritesNoAuditEntryAndKeepsTheVersion()
    {
        await PublicContentSeeding.SaveAsync(database, Seed());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        using var first = await PutAsync(client, manager.AccessToken, Body(await VersionAsync(), "Unchanged tagline"));
        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        var version = await VersionAsync();

        using var again = await PutAsync(client, manager.AccessToken, Body(version, "Unchanged tagline"));

        again.StatusCode.ShouldBe(HttpStatusCode.OK, await again.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await VersionAsync()).ShouldBe(version);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == manager.UserId && row.Action == "site-settings.changed", TestContext.Current.CancellationToken)).ShouldBe(1);
        using var saved = JsonDocument.Parse(await again.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        saved.RootElement.GetProperty("version").GetString().ShouldBe(version);
    }

    [Fact]
    public async Task TwoSavesInARowEachGiveADistinctPublicETag()
    {
        await PublicContentSeeding.SaveAsync(database, Seed());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var original = await PublicETagAsync(client);

        using var one = await PutAsync(client, manager.AccessToken, Body(await VersionAsync(), "Tagline one"));
        var afterOne = await PublicETagAsync(client);
        using var two = await PutAsync(client, manager.AccessToken, Body(await VersionAsync(), "Tagline two"));
        var afterTwo = await PublicETagAsync(client);

        one.StatusCode.ShouldBe(HttpStatusCode.OK);
        two.StatusCode.ShouldBe(HttpStatusCode.OK);
        new[] { original, afterOne, afterTwo }.Distinct(StringComparer.Ordinal).Count().ShouldBe(3);
    }

    [Fact]
    public async Task ChangingOnlyThePhonesShowsOnThePublicReadMovesTheVersionAndAuditsPhonesWithoutTheNumbers()
    {
        await PublicContentSeeding.SaveAsync(database, Seed());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var versionBefore = await VersionAsync();
        var etagBefore = await PublicETagAsync(client);
        var body = WithExtras(
            Body(versionBefore, "Sample tagline"),
            ("phones", new object[]
            {
                new { number = "02 8123 4567", label = "Office", isMain = true },
                new { number = "0917 123 4567", label = "Globe", isMain = false },
                new { number = "0918 765 4321", label = (string?)null, isMain = false },
            }));

        using var response = await PutAsync(client, manager.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await VersionAsync()).ShouldNotBe(versionBefore);
        (await PublicETagAsync(client)).ShouldNotBe(etagBefore);
        using var site = JsonDocument.Parse(await client.GetStringAsync(new Uri(PublicRoute, UriKind.Relative), TestContext.Current.CancellationToken));
        site.RootElement.GetProperty("phones").EnumerateArray().Select(phone => phone.GetProperty("e164").GetString())
            .ShouldBe(["+63281234567", "+639171234567", "+639187654321"]);
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking().SingleAsync(row => row.ActorUserId == manager.UserId && row.Action == "site-settings.changed", TestContext.Current.CancellationToken);
        entry.Detail.ShouldBe("fields=phones");
        (await context.SitePhoneNumbers.AsNoTracking().CountAsync(row => row.IsMain, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task AManagerSavesTheQuoteAlertsEmailAndTheStaffReadAndTheStoreReturnIt()
    {
        await PublicContentSeeding.SaveAsync(database, Seed());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        (await StoredAlertsEmailAsync(factory)).ShouldBeEmpty();
        var body = WithExtras(Body(await VersionAsync(), "Sample tagline"), ("quoteAlertsEmail", " quotes@example.com "));

        using var response = await PutAsync(client, manager.AccessToken, body);

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var saved = JsonDocument.Parse(text);
        saved.RootElement.GetProperty("quoteAlertsEmail").GetString().ShouldBe("quotes@example.com");
        using var read = ApiRequests.Create(HttpMethod.Get, Route, manager.AccessToken);
        using var reread = await client.SendAsync(read, TestContext.Current.CancellationToken);
        using var settings = JsonDocument.Parse(await reread.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        settings.RootElement.GetProperty("quoteAlertsEmail").GetString().ShouldBe("quotes@example.com");
        (await StoredAlertsEmailAsync(factory)).ShouldBe("quotes@example.com");
    }

    [Fact]
    public async Task AnAdminCannotSetTheQuoteAlertsEmail()
    {
        await PublicContentSeeding.SaveAsync(database, Seed());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var body = WithExtras(Body(await VersionAsync(), "Sample tagline"), ("quoteAlertsEmail", "quotes@example.com"));

        using var response = await PutAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await StoredAlertsEmailAsync(factory)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ASaveThatChangesOnlyTheQuoteAlertsEmailAuditsTheFieldNameWithoutTheAddress()
    {
        await PublicContentSeeding.SaveAsync(database, Seed());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var body = WithExtras(Body(await VersionAsync(), "Sample tagline"), ("quoteAlertsEmail", "quotes@example.com"));

        using var response = await PutAsync(client, manager.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking().SingleAsync(row => row.ActorUserId == manager.UserId && row.Action == "site-settings.changed", TestContext.Current.CancellationToken);
        entry.Detail.ShouldBe("fields=quoteAlertsEmail");
    }

    [Fact]
    public async Task ABodyWithoutAQuoteAlertsEmailClearsTheSavedOneLikeEveryOtherOptionalValue()
    {
        await PublicContentSeeding.SaveAsync(database, Seed() with { QuoteAlertsEmail = "quotes@example.com" });
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        (await StoredAlertsEmailAsync(factory)).ShouldBe("quotes@example.com");

        using var response = await PutAsync(client, manager.AccessToken, Body(await VersionAsync(), "Sample tagline"));

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        (await StoredAlertsEmailAsync(factory)).ShouldBeEmpty();
        using var saved = JsonDocument.Parse(text);
        saved.RootElement.GetProperty("quoteAlertsEmail").ValueKind.ShouldBe(JsonValueKind.Null);
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking().SingleAsync(row => row.ActorUserId == manager.UserId && row.Action == "site-settings.changed", TestContext.Current.CancellationToken);
        entry.Detail.ShouldBe("fields=quoteAlertsEmail");
    }

    [Fact]
    public async Task ABadQuoteAlertsEmailIs400OnItsFieldWithTheApprovedMessageAndNothingIsStored()
    {
        await PublicContentSeeding.SaveAsync(database, Seed());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var version = await VersionAsync();

        using var wrongShape = await PutAsync(client, manager.AccessToken, WithExtras(Body(version, "Sample tagline"), ("quoteAlertsEmail", "a@b@c.ph")));
        using var tooLong = await PutAsync(client, manager.AccessToken, WithExtras(Body(version, "Sample tagline"), ("quoteAlertsEmail", $"{new string('a', 250)}@b.ph")));

        wrongShape.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemJson.ReadAsync(wrongShape, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("quoteAlertsEmail")[0].GetString()
            .ShouldBe("Enter a valid email, like name@gmail.com");
        tooLong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemJson.ReadAsync(tooLong, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("quoteAlertsEmail")[0].GetString()
            .ShouldBe("Keep the email to 254 characters or fewer.");
        (await StoredAlertsEmailAsync(factory)).ShouldBeEmpty();
        (await VersionAsync()).ShouldBe(version);
    }

    [Fact]
    public async Task ABadFormIs400OnItsFieldsWithTheApprovedMessagesAndChangesNothing()
    {
        await PublicContentSeeding.SaveAsync(database, Seed());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var versionBefore = await VersionAsync();
        var body = WithExtras(
            Body(versionBefore, "Bad form tagline"),
            ("messengerUrl", "http://m.me/cspsdemo"),
            ("facebookUrl", "javascript:alert(1)"),
            ("phones", Array.Empty<object>()));

        using var response = await PutAsync(client, manager.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("site-content.invalid-request");
        var errors = problem.GetProperty("errors");
        errors.GetProperty("messengerUrl")[0].GetString().ShouldBe("Paste your Messenger link, like https://m.me/yourpage.");
        errors.GetProperty("facebookUrl")[0].GetString().ShouldBe("Paste your Facebook page link, like https://www.facebook.com/yourpage.");
        errors.GetProperty("phones")[0].GetString().ShouldBe("Add at least one phone number.");
        (await VersionAsync()).ShouldBe(versionBefore);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == manager.UserId, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).Tagline.ShouldBe("Sample tagline");
    }

    // The stored values start equal to what Body sends, so a test changes only what it means to change.
    private static BusinessInfo Seed(string tagline = "Sample tagline") => PublicContentSeeding.Demo(tagline) with
    {
        DirectionsUrl = "https://maps.app.goo.gl/abc123",
        MapEmbedUrl = "https://www.google.com/maps/embed?pb=sample",
        FacebookUrl = "https://www.facebook.com/cspsdemo",
        InstagramUrl = "https://www.instagram.com/cspsdemo",
        TikTokUrl = "https://www.tiktok.com/@cspsdemo",
    };

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

    // The body as JSON with some members set or added, so a test can send stamp fields or break one rule.
    internal static JsonObject WithExtras(object body, params (string Name, object? Value)[] extras)
    {
        var json = JsonSerializer.SerializeToNode(body, JsonSerializerOptions.Web)!.AsObject();
        foreach (var (name, value) in extras)
        {
            json[name] = JsonSerializer.SerializeToNode(value, JsonSerializerOptions.Web);
        }

        return json;
    }

    private static async Task<string> PublicETagAsync(HttpClient client)
    {
        using var response = await client.GetAsync(new Uri(PublicRoute, UriKind.Relative), TestContext.Current.CancellationToken);
        return response.Headers.ETag.ShouldNotBeNull().ToString();
    }

    private static async Task<string> StoredAlertsEmailAsync(CspsApiFactory factory)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ISiteContentStore>().GetQuoteAlertsEmailAsync(TestContext.Current.CancellationToken);
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

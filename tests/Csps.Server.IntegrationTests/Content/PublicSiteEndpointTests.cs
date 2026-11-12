using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Content;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// PUB-02, PUB-03, CONT-05, D-25, D-43: <c>GET /api/v1/public/site</c> answers anonymously from the database with the shop's facts, a
/// strong ETag and 304 on a repeat, never the shop email, never a bracket placeholder, and never compressed.
/// </summary>
public sealed class PublicSiteEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/public/site";

    private static readonly string[] DtoPropertyNames =
    [
        "businessName", "tagline", "aboutText", "turnaroundLine", "address", "phones", "messengerUrl", "facebookUrl", "instagramUrl",
        "tiktokUrl", "directionsUrl", "mapEmbedUrl", "year", "hours", "upcomingClosures",
    ];

    [Fact]
    public async Task AnAnonymousVisitorGetsTheStoredFactsWithTheMainNumberFirst()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo("Sample tagline") with
        {
            Phones = [new BusinessPhone("02 8123 4567", null, false), new BusinessPhone("0917 123 4567", "Globe", true)],
        });
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/json");
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var site = document.RootElement;
        site.EnumerateObject().Select(property => property.Name).ShouldBe(DtoPropertyNames, ignoreOrder: true);
        site.GetProperty("businessName").GetString().ShouldBe("Sample Shop");
        site.GetProperty("tagline").GetString().ShouldBe("Sample tagline");
        site.GetProperty("turnaroundLine").GetString().ShouldBe("Mockups in 24 hours.");
        var address = site.GetProperty("address");
        address.GetProperty("street").GetString().ShouldBe("12 Sample St., Poblacion");
        address.GetProperty("townOrCity").GetString().ShouldBe("Sample City");
        address.GetProperty("province").GetString().ShouldBe("Sample Province");
        address.GetProperty("postalCode").GetString().ShouldBe("1000");
        var phones = site.GetProperty("phones");
        phones.GetArrayLength().ShouldBe(2);
        phones[0].GetProperty("display").GetString().ShouldBe("0917 123 4567");
        phones[0].GetProperty("e164").GetString().ShouldBe("+639171234567");
        phones[0].GetProperty("label").GetString().ShouldBe("Globe");
        phones[0].GetProperty("isMain").GetBoolean().ShouldBeTrue();
        phones[1].GetProperty("display").GetString().ShouldBe("02 8123 4567");
        phones[1].GetProperty("isMain").GetBoolean().ShouldBeFalse();
        site.GetProperty("messengerUrl").GetString().ShouldBe("https://m.me/cspsdemo");
        site.GetProperty("facebookUrl").GetString().ShouldBe("https://facebook.example.test/cspsdemo");
        site.GetProperty("directionsUrl").GetString().ShouldBe("https://maps.example.test/directions");
        site.GetProperty("mapEmbedUrl").GetString().ShouldBe("https://maps.example.test/embed");
        site.GetProperty("year").GetInt32().ShouldBeGreaterThanOrEqualTo(2026);
    }

    [Fact]
    public async Task TheResponseHasAStrongETagNoCacheAndIsNeverCompressed()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(Route);
        request.Headers.AcceptEncoding.ParseAdd("gzip, br");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.ETag.ShouldNotBeNull().IsWeak.ShouldBeFalse();
        response.Headers.CacheControl.ShouldNotBeNull().NoCache.ShouldBeTrue();
        response.Content.Headers.ContentEncoding.ShouldBeEmpty();
    }

    [Fact]
    public async Task AMatchingIfNoneMatchGets304WithNoBodyAndADifferentOneGets200()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var first = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        var etag = first.Headers.ETag.ShouldNotBeNull();

        using var matching = ApiRequests.Get(Route);
        matching.Headers.TryAddWithoutValidation("If-None-Match", etag.ToString());
        using var repeat = await client.SendAsync(matching, TestContext.Current.CancellationToken);
        using var different = ApiRequests.Get(Route);
        different.Headers.TryAddWithoutValidation("If-None-Match", "\"not-this-one\"");
        using var changed = await client.SendAsync(different, TestContext.Current.CancellationToken);

        repeat.StatusCode.ShouldBe(HttpStatusCode.NotModified);
        (await repeat.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();
        repeat.Headers.ETag.ShouldBe(etag);
        repeat.Headers.CacheControl.ShouldNotBeNull().NoCache.ShouldBeTrue();
        changed.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await changed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldNotBeEmpty();
    }

    [Fact]
    public async Task NoPublicBodyHoldsTheShopEmailAnAtSignOrABracket()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        var body = await (await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken))
            .Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        body.ShouldNotContain("shop-private@example.test", Case.Insensitive);
        body.ShouldNotContain("@");
        StringValues(body).ShouldNotContain(value => value.Contains('[', StringComparison.Ordinal));
    }

    [Fact]
    public async Task AFreshlyMigratedDatabaseShowsTheApprovedTaglineAndNothingElse()
    {
        var fresh = await CspsDatabase.CreateAsync();
        await using (fresh)
        {
            await using var factory = CspsApiFactory.ForDatabase(fresh.ConnectionString);
            using var client = factory.CreateClient();

            using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);

            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            StringValues(body).ShouldNotContain(value => value.Contains('[', StringComparison.Ordinal));
            body.ShouldNotContain("@");
            using var document = JsonDocument.Parse(body);
            var site = document.RootElement;
            site.GetProperty("tagline").GetString().ShouldBe("Custom tailoring and full-sublimation printing for teams, leagues and riding groups.");
            site.GetProperty("phones").GetArrayLength().ShouldBe(0);
            site.GetProperty("address").GetProperty("street").ValueKind.ShouldBe(JsonValueKind.Null);
            site.GetProperty("facebookUrl").ValueKind.ShouldBe(JsonValueKind.Null);
            site.GetProperty("turnaroundLine").ValueKind.ShouldBe(JsonValueKind.Null);
        }
    }

    [Fact]
    public async Task AnEmptyRowAnswers200WithEmptyOrNullFieldsNeverA500()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Bare());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("phones").GetArrayLength().ShouldBe(0);
        document.RootElement.GetProperty("messengerUrl").ValueKind.ShouldBe(JsonValueKind.Null);
        document.RootElement.GetProperty("address").GetProperty("townOrCity").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task UpcomingClosuresHoldTheNextThirtyDaysByFirstDayAndLeaveOutOneStartingInFortyDays()
    {
        var today = PublicContentSeeding.ManilaToday();
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await PublicContentSeeding.SaveClosuresAsync(
            database,
            [
                (today.AddDays(40), null, "Too far"),
                (today.AddDays(10), null, "Christmas"),
                (today.AddDays(-1), today.AddDays(1), "Running"),
                (today.AddDays(-9), today.AddDays(-5), "Past"),
            ]);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        await PublicContentSeeding.SaveClosuresAsync(database, []);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var closures = document.RootElement.GetProperty("upcomingClosures").EnumerateArray().ToList();
        closures.Select(closure => closure.GetProperty("note").GetString()).ShouldBe(["Running", "Christmas"]);
        closures[0].GetProperty("firstDay").GetString().ShouldBe(today.AddDays(-1).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
        closures[0].GetProperty("lastDay").GetString().ShouldBe(today.AddDays(1).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
        closures[1].GetProperty("lastDay").GetString().ShouldBe(closures[1].GetProperty("firstDay").GetString());
    }

    [Fact]
    public async Task AClosureWithNoNoteHasANullNote()
    {
        var today = PublicContentSeeding.ManilaToday();
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await PublicContentSeeding.SaveClosuresAsync(database, [(today.AddDays(3), today.AddDays(4), null)]);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        await PublicContentSeeding.SaveClosuresAsync(database, []);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var closure = document.RootElement.GetProperty("upcomingClosures").EnumerateArray().ShouldHaveSingleItem();
        closure.GetProperty("note").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task TheHoursAreSevenDaysMondayFirstAndTheUpcomingClosuresAreEmpty()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await PublicContentSeeding.SaveClosuresAsync(database, []);
        await PublicContentSeeding.SaveHoursAsync(database, PublicContentSeeding.DemoWeek);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var hours = document.RootElement.GetProperty("hours").EnumerateArray().ToList();
        hours.Select(day => day.GetProperty("day").GetInt32()).ShouldBe([1, 2, 3, 4, 5, 6, 7]);
        hours[0].GetProperty("opensAt").GetString().ShouldBe("09:00");
        hours[0].GetProperty("closesAt").GetString().ShouldBe("18:00");
        hours[5].GetProperty("closesAt").GetString().ShouldBe("18:00");
        hours[6].GetProperty("opensAt").ValueKind.ShouldBe(JsonValueKind.Null);
        hours[6].GetProperty("closesAt").ValueKind.ShouldBe(JsonValueKind.Null);
        document.RootElement.GetProperty("upcomingClosures").GetArrayLength().ShouldBe(0);
    }

    [Fact]
    public async Task UntilAManagerSavesHoursEveryDayReadsClosed()
    {
        await using var fresh = await CspsDatabase.CreateAsync();
        await PublicContentSeeding.SaveAsync(fresh, PublicContentSeeding.Demo());
        await using var factory = CspsApiFactory.ForDatabase(fresh.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var hours = document.RootElement.GetProperty("hours").EnumerateArray().ToList();
        hours.Count.ShouldBe(7);
        hours.ShouldAllBe(day => day.GetProperty("opensAt").ValueKind == JsonValueKind.Null && day.GetProperty("closesAt").ValueKind == JsonValueKind.Null);
    }

    [Fact]
    public async Task TheYearIsTheBusinessYear()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, new FakeTimeProvider(new DateTimeOffset(2026, 12, 31, 16, 30, 0, TimeSpan.Zero)));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("year").GetInt32().ShouldBe(2027);
    }

    // Every string value in the JSON, whatever its depth. A bracket inside a value is a leaked placeholder; the array brackets are not.
    private static List<string> StringValues(string json)
    {
        using var document = JsonDocument.Parse(json);
        var values = new List<string>();
        Collect(document.RootElement, values);
        return values;
    }

    private static void Collect(JsonElement element, List<string> values)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.String:
                values.Add(element.GetString()!);
                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    Collect(item, values);
                }

                break;
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    Collect(property.Value, values);
                }

                break;
            default:
                break;
        }
    }

    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Manager)]
    public async Task StaffReadItToo(string role)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(Route, (await TestSessions.StartAsync(factory, role)).AccessToken);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// PUB-05, D-21, D-22, CONT-01: a Manager saves the weekly hours with <c>PUT /api/v1/opening-hours</c> and an anonymous visitor reads
/// the server's open or closed answer from <c>GET /api/v1/public/open-status</c>, worked out in Manila time and cached for a minute.
/// The host clock is pinned, so every answer is exact.
/// </summary>
public sealed class OpenStatusEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string HoursRoute = "/api/v1/opening-hours";
    private const string StatusRoute = "/api/v1/public/open-status";
    private const string ClosuresRoute = "/api/v1/shop-closures";

    // Monday 16 Nov 2026, 10:00 and 18:00 in Manila (UTC+8).
    private static readonly DateTimeOffset MondayTenAmManila = new(2026, 11, 16, 2, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset MondaySixPmManila = new(2026, 11, 16, 10, 0, 0, TimeSpan.Zero);

    // Monday 2 Nov 2026, 10:00 in Manila. The closure tests use a clock earlier than the real one, so a session started on the real
    // clock is still valid on the pinned host.
    private static readonly DateTimeOffset PastMondayTenAmManila = new(2026, 11, 2, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AtTenOnAMondayTheShopIsOpenUntilSixPmAndTheAnswerIsCachedForAMinuteWithNoETag()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await SaveMondayNineToSixAsync(baseFactory);
        await using var factory = AuthClient.WithClock(baseFactory, new FakeTimeProvider(MondayTenAmManila));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(StatusRoute, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.GetValues("Cache-Control").ShouldBe(["public, max-age=60"]);
        response.Headers.ETag.ShouldBeNull();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var root = document.RootElement;
        root.GetProperty("isOpen").GetBoolean().ShouldBeTrue();
        root.GetProperty("closesAt").GetString().ShouldBe("18:00");
        root.GetProperty("closedToday").GetBoolean().ShouldBeFalse();
        root.GetProperty("todayClosureNote").ValueKind.ShouldBe(JsonValueKind.Null);
        root.GetProperty("nextOpening").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task AtSixPmOnAMondayTheShopIsClosedAndOpensNextMondayAsAWeekday()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await SaveMondayNineToSixAsync(baseFactory);
        await using var factory = AuthClient.WithClock(baseFactory, new FakeTimeProvider(MondaySixPmManila));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(StatusRoute, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var root = document.RootElement;
        root.GetProperty("isOpen").GetBoolean().ShouldBeFalse();
        root.GetProperty("closesAt").ValueKind.ShouldBe(JsonValueKind.Null);
        var next = root.GetProperty("nextOpening");
        next.GetProperty("when").GetString().ShouldBe("weekday");
        next.GetProperty("day").GetInt32().ShouldBe(1);
        next.GetProperty("opensAt").GetString().ShouldBe("09:00");
        next.GetProperty("date").GetString().ShouldBe("2026-11-23");
    }

    [Fact]
    public async Task OnAFreshDatabaseEveryDayIsClosedSoTheShopIsClosedWithNoNextOpening()
    {
        await using var fresh = await CspsDatabase.CreateAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(fresh.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, new FakeTimeProvider(MondayTenAmManila));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(StatusRoute, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("isOpen").GetBoolean().ShouldBeFalse();
        document.RootElement.GetProperty("nextOpening").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task AManagerReadsSevenDaysMondayFirstWithTheirTimes()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await SaveMondayNineToSixAsync(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        using var client = factory.CreateClient();

        using var request = ApiRequests.Get(HoursRoute, manager.AccessToken);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var days = document.RootElement.GetProperty("days").EnumerateArray().ToList();
        days.Select(day => day.GetProperty("day").GetInt32()).ShouldBe([1, 2, 3, 4, 5, 6, 7]);
        days[0].GetProperty("opensAt").GetString().ShouldBe("09:00");
        days[0].GetProperty("closesAt").GetString().ShouldBe("18:00");
        days[1].GetProperty("opensAt").ValueKind.ShouldBe(JsonValueKind.Null);
        document.RootElement.GetProperty("version").GetString().ShouldNotBeNullOrEmpty();
    }

    [Fact]
    public async Task AClosureForTodayMakesTheStatusClosedWithItsNoteAndTheNextOpeningSkipsIt()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await SaveMondayNineToSixAsync(baseFactory);
        var manager = await TestSessions.StartAsync(baseFactory, Roles.Manager);
        await using var factory = AuthClient.WithClock(baseFactory, new FakeTimeProvider(PastMondayTenAmManila));
        using var client = factory.CreateClient();

        using var created = await PostClosureAsync(client, manager.AccessToken, "2026-11-02", null, "Christmas");
        created.StatusCode.ShouldBe(HttpStatusCode.Created, await created.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        using var response = await client.GetAsync(new Uri(StatusRoute, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var root = document.RootElement;
        root.GetProperty("isOpen").GetBoolean().ShouldBeFalse();
        root.GetProperty("closedToday").GetBoolean().ShouldBeTrue();
        root.GetProperty("todayClosureNote").GetString().ShouldBe("Christmas");
        var next = root.GetProperty("nextOpening");
        next.GetProperty("date").GetString().ShouldBe("2026-11-09");
        next.GetProperty("when").GetString().ShouldBe("weekday");
        next.GetProperty("opensAt").GetString().ShouldBe("09:00");
    }

    [Fact]
    public async Task AManagerListsTheClosureWithItsVersionAndAnAdminGets403()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await SaveMondayNineToSixAsync(baseFactory);
        var manager = await TestSessions.StartAsync(baseFactory, Roles.Manager);
        var admin = await TestSessions.StartAsync(baseFactory, Roles.Admin);
        await using var factory = AuthClient.WithClock(baseFactory, new FakeTimeProvider(PastMondayTenAmManila));
        using var client = factory.CreateClient();
        using var created = await PostClosureAsync(client, manager.AccessToken, "2026-12-24", "2026-12-26", "Christmas");
        created.StatusCode.ShouldBe(HttpStatusCode.Created, await created.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        using var listRequest = ApiRequests.Get(ClosuresRoute, manager.AccessToken);
        using var list = await client.SendAsync(listRequest, TestContext.Current.CancellationToken);
        using var adminRequest = ApiRequests.Get(ClosuresRoute, admin.AccessToken);
        using var forbidden = await client.SendAsync(adminRequest, TestContext.Current.CancellationToken);

        list.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await list.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var closure = document.RootElement.EnumerateArray().ShouldHaveSingleItem();
        closure.GetProperty("firstDay").GetString().ShouldBe("2026-12-24");
        closure.GetProperty("lastDay").GetString().ShouldBe("2026-12-26");
        closure.GetProperty("note").GetString().ShouldBe("Christmas");
        closure.GetProperty("version").GetString().ShouldNotBeNullOrEmpty();
        closure.GetProperty("id").GetGuid().ShouldNotBe(Guid.Empty);
        forbidden.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    private static async Task<HttpResponseMessage> PostClosureAsync(HttpClient client, string accessToken, string firstDay, string? lastDay, string? note)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, ClosuresRoute, accessToken);
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("D"));
        request.Content = JsonContent.Create(new { firstDay, lastDay, note });
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task SaveMondayNineToSixAsync(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory)
    {
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        using var client = factory.CreateClient();
        using var read = ApiRequests.Get(HoursRoute, manager.AccessToken);
        using var current = await client.SendAsync(read, TestContext.Current.CancellationToken);
        current.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await current.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var version = document.RootElement.GetProperty("version").GetString();

        using var request = ApiRequests.Create(HttpMethod.Put, HoursRoute, manager.AccessToken);
        request.Content = JsonContent.Create(new
        {
            version,
            days = Enumerable.Range(1, 7)
                .Select(day => new { day, opensAt = day == 1 ? "09:00" : null, closesAt = day == 1 ? "18:00" : null })
                .ToArray(),
        });
        using var saved = await client.SendAsync(request, TestContext.Current.CancellationToken);
        saved.StatusCode.ShouldBe(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }
}

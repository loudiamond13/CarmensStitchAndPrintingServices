using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// CONT-01, SEC-07, SEC-08, AUDIT-01, P-8: a Manager saves the weekly hours with <c>PUT /api/v1/opening-hours</c>. The hours have their
/// own version, a stale version is refused, bad hours are refused with the approved messages, the server stamps the rows, and a change
/// writes one audit entry. An Admin is refused.
/// </summary>
public sealed class OpeningHoursEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/opening-hours";
    private const string SettingsRoute = "/api/v1/site-settings";

    [Fact]
    public async Task TheStaffReadIsNeverStoredByABrowserOrAProxy()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await GetAsync(client, Route, manager.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
    }

    [Fact]
    public async Task ASavedBusinessInfoNeverMakesTheHoursVersionStale()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var reader = await TestSessions.StartAsync(factory, Roles.Manager);
        var other = await TestSessions.StartAsync(factory, Roles.Manager);
        var hoursVersion = (await ReadAsync(client, reader.AccessToken)).Version;
        using var settings = await GetAsync(client, SettingsRoute, reader.AccessToken);
        var settingsVersion = JsonDocument.Parse(await settings.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).RootElement.GetProperty("version").GetString();
        using var businessInfo = await SiteSettingsWriteTests.PutAsync(client, other.AccessToken, SiteSettingsWriteTests.Body(settingsVersion!, $"Tagline {Guid.NewGuid():N}"));
        businessInfo.StatusCode.ShouldBe(HttpStatusCode.OK, await businessInfo.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        using var saved = await PutAsync(client, reader.AccessToken, hoursVersion, Week((1, "09:00", "18:00")));

        saved.StatusCode.ShouldBe(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task TwoManagersReadTheSameVersionTheFirstSaveWinsAndTheSecondGets409AndChangesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        await ClosedWeekAsync(factory, client);
        var first = await TestSessions.StartAsync(factory, Roles.Manager);
        var second = await TestSessions.StartAsync(factory, Roles.Manager);
        var version = (await ReadAsync(client, first.AccessToken)).Version;

        using var winner = await PutAsync(client, first.AccessToken, version, Week((1, "09:00", "18:00")));
        using var loser = await PutAsync(client, second.AccessToken, version, Week((2, "10:00", "17:00")));

        winner.StatusCode.ShouldBe(HttpStatusCode.OK, await winner.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        loser.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var problem = await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("edit.stale");
        var after = await ReadAsync(client, first.AccessToken);
        after.Days[0].Opens.ShouldBe("09:00");
        after.Days[1].Opens.ShouldBeNull();
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == second.UserId, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task StampFieldsSentByTheClientAreIgnoredAndTheServerStampsTheManagerAndTheClock()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        await ClosedWeekAsync(factory, client);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var other = await TestSessions.StartAsync(factory, Roles.Admin);
        var version = (await ReadAsync(client, manager.AccessToken)).Version;
        DateTimeOffset? tuesdayStampBefore;
        await using (var before = database.CreateContext())
        {
            tuesdayStampBefore = (await before.OpeningHours.AsNoTracking().SingleAsync(row => row.DayOfWeek == 2, TestContext.Current.CancellationToken)).UpdatedAtUtc;
        }

        var body = Body(version, Week((1, "09:00", "18:00")));
        body["createdById"] = other.UserId.ToString();
        body["updatedById"] = other.UserId.ToString();
        body["updatedAtUtc"] = "2000-01-01T00:00:00Z";

        using var response = await PutBodyAsync(client, manager.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var monday = await context.OpeningHours.AsNoTracking().SingleAsync(row => row.DayOfWeek == 1, TestContext.Current.CancellationToken);
        monday.UpdatedById.ShouldBe(manager.UserId);
        monday.UpdatedAtUtc.ShouldNotBeNull().ShouldBeInRange(TimeProvider.System.GetUtcNow().AddMinutes(-2), TimeProvider.System.GetUtcNow().AddMinutes(1));
        monday.CreatedById.ShouldNotBe(other.UserId);
        var tuesday = await context.OpeningHours.AsNoTracking().SingleAsync(row => row.DayOfWeek == 2, TestContext.Current.CancellationToken);
        // The setup may have stamped Tuesday already; this save must not stamp it again.
        tuesday.UpdatedAtUtc.ShouldBe(tuesdayStampBefore, "a day that did not change is not stamped");
    }

    [Fact]
    public async Task ASaveChangingMondayAndSaturdayWritesOneAuditEntryNamingBothDaysWithOldAndNewTimes()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        await ClosedWeekAsync(factory, client);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var version = (await ReadAsync(client, manager.AccessToken)).Version;

        using var response = await PutAsync(client, manager.AccessToken, version, Week((1, "09:00", "18:00"), (6, "09:00", "17:00")));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking().SingleAsync(row => row.ActorUserId == manager.UserId && row.Action == "opening-hours.changed", TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("OpeningHours");
        entry.TargetId.ShouldBe("week");
        entry.Detail.ShouldBe("monday=closed>09:00-18:00;saturday=closed>09:00-17:00");
    }

    [Fact]
    public async Task ChangingAnOpenDayAndClosingAnotherNamesTheOldTimesAndClosed()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        await ClosedWeekAsync(factory, client);
        var setup = await TestSessions.StartAsync(factory, Roles.Manager);
        using var seeded = await PutAsync(client, setup.AccessToken, (await ReadAsync(client, setup.AccessToken)).Version, Week((1, "09:00", "18:00"), (2, "09:00", "18:00")));
        seeded.StatusCode.ShouldBe(HttpStatusCode.OK);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await PutAsync(client, manager.AccessToken, (await ReadAsync(client, manager.AccessToken)).Version, Week((1, "10:30", "18:00")));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking().SingleAsync(row => row.ActorUserId == manager.UserId && row.Action == "opening-hours.changed", TestContext.Current.CancellationToken);
        entry.Detail.ShouldBe("monday=09:00-18:00>10:30-18:00;tuesday=09:00-18:00>closed");
    }

    [Fact]
    public async Task ASaveWithNoChangeWritesNoAuditEntryAndKeepsTheVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        await ClosedWeekAsync(factory, client);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var before = await ReadAsync(client, manager.AccessToken);

        using var response = await PutAsync(client, manager.AccessToken, before.Version, Week());

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await ReadAsync(client, manager.AccessToken)).Version.ShouldBe(before.Version);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == manager.UserId, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ASaveMovesTheVersionAndReturnsTheNewHoursWithTheLastChangersName()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        await ClosedWeekAsync(factory, client);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var before = await ReadAsync(client, manager.AccessToken);

        using var response = await PutAsync(client, manager.AccessToken, before.Version, Week((4, "08:00", "20:30")));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var saved = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        saved.RootElement.GetProperty("version").GetString().ShouldNotBe(before.Version);
        saved.RootElement.GetProperty("days")[3].GetProperty("opensAt").GetString().ShouldBe("08:00");
        saved.RootElement.GetProperty("days")[3].GetProperty("closesAt").GetString().ShouldBe("20:30");
        saved.RootElement.GetProperty("updatedByName").GetString().ShouldBe("Paolo Reyes");
        saved.RootElement.GetProperty("updatedAtUtc").ValueKind.ShouldBe(JsonValueKind.String);
    }

    [Fact]
    public async Task ABadWeekIs400OnTheDayAndFieldWithTheApprovedMessagesAndChangesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        await ClosedWeekAsync(factory, client);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var before = await ReadAsync(client, manager.AccessToken);
        var days = new List<object>
        {
            new { day = 1, opensAt = "18:00", closesAt = "09:00" },
            new { day = 2, opensAt = "09:00", closesAt = (string?)null },
            new { day = 3, opensAt = "09:15", closesAt = "17:00" },
            new { day = 4, opensAt = (string?)null, closesAt = (string?)null },
            new { day = 5, opensAt = (string?)null, closesAt = (string?)null },
            new { day = 6, opensAt = (string?)null, closesAt = (string?)null },
            new { day = 7, opensAt = (string?)null, closesAt = (string?)null },
        };

        using var response = await PutBodyAsync(client, manager.AccessToken, Body(before.Version, days));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("site-content.invalid-request");
        var errors = problem.GetProperty("errors");
        errors.GetProperty("days[0].closesAt")[0].GetString().ShouldBe("Closing time must be after opening time.");
        errors.GetProperty("days[1].closesAt")[0].GetString().ShouldBe("Choose the closing time.");
        errors.GetProperty("days[2].opensAt")[0].GetString().ShouldBe("Choose a time on the hour or half hour, from 5:00 AM to 11:30 PM.");
        (await ReadAsync(client, manager.AccessToken)).Version.ShouldBe(before.Version);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == manager.UserId, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnAdminGets403OnGetAndPutAndNothingIsStored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        await ClosedWeekAsync(factory, client);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var version = (await ReadAsync(client, manager.AccessToken)).Version;

        using var read = await GetAsync(client, Route, admin.AccessToken);
        using var write = await PutAsync(client, admin.AccessToken, version, Week((1, "09:00", "18:00")));

        read.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        write.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ReadAsync(client, manager.AccessToken)).Days[0].Opens.ShouldBeNull();
    }

    // Puts every day closed, so a test starts from a known week whatever ran before it.
    private static async Task ClosedWeekAsync(WebApplicationFactory<Program> factory, HttpClient client)
    {
        var setup = await TestSessions.StartAsync(factory, Roles.Manager);
        using var response = await PutAsync(client, setup.AccessToken, (await ReadAsync(client, setup.AccessToken)).Version, Week());
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    // Seven days, Monday first; the given days are open and the rest closed.
    private static List<object> Week(params (int Day, string Opens, string Closes)[] open) =>
        [.. Enumerable.Range(1, 7).Select(day =>
        {
            var hours = open.FirstOrDefault(entry => entry.Day == day);
            return hours.Opens is null
                ? (object)new { day, opensAt = (string?)null, closesAt = (string?)null }
                : new { day, opensAt = (string?)hours.Opens, closesAt = (string?)hours.Closes };
        })];

    private static JsonObject Body(string version, List<object> days) =>
        JsonSerializer.SerializeToNode(new { version, days }, JsonSerializerOptions.Web)!.AsObject();

    private static Task<HttpResponseMessage> PutAsync(HttpClient client, string? accessToken, string version, List<object> days) =>
        PutBodyAsync(client, accessToken, Body(version, days));

    private static async Task<HttpResponseMessage> PutBodyAsync(HttpClient client, string? accessToken, JsonObject body)
    {
        using var request = ApiRequests.Create(HttpMethod.Put, Route, accessToken);
        request.Content = JsonContent.Create(body);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> GetAsync(HttpClient client, string route, string accessToken)
    {
        using var request = ApiRequests.Get(route, accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HoursRead> ReadAsync(HttpClient client, string accessToken)
    {
        using var response = await GetAsync(client, Route, accessToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var days = document.RootElement.GetProperty("days").EnumerateArray()
            .Select(day => new DayRead(day.GetProperty("opensAt").GetString(), day.GetProperty("closesAt").GetString()))
            .ToList();
        return new HoursRead(document.RootElement.GetProperty("version").GetString()!, days);
    }

    private sealed record DayRead(string? Opens, string? Closes);

    private sealed record HoursRead(string Version, List<DayRead> Days);
}

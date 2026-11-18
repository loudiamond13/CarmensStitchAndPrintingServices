using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Security;
using Csps.Domain.Analytics;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Analytics;

/// <summary>
/// ANL-08, D-23, D-24, D-27, D-33: <c>GET /api/v1/visitor-stats</c> is a Manager-only read of unique visitors, visits and page views. The range is
/// resolved in the business zone on the server, and the answer holds totals only.
/// </summary>
public sealed class VisitorStatsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/visitor-stats";

    // 12:00 in Manila on 2026-11-15. The cut is 2025-10-15 and the floor is 2023-11-15.
    private static readonly DateTimeOffset Noon = new(2026, 11, 15, 4, 0, 0, TimeSpan.Zero);

    private static readonly string[] ForbiddenWords = ["hash", "visitorid", "visitid", "timestamp", "startedat", "lastseen", "session"];

    [Fact]
    public async Task AManagerReadsTheLastThirtyDaysByDefaultWithExactTotals()
    {
        await using var rig = await Rig.StartAsync(database, Noon);
        await rig.SeedViewsAsync(new DateOnly(2026, 11, 15), PageKeys.Home, 10);
        await rig.SeedViewsAsync(new DateOnly(2026, 11, 15), PageKeys.Gallery, 5);
        await rig.SeedViewsAsync(new DateOnly(2026, 10, 17), PageKeys.Contact, 4);
        await rig.SeedViewsAsync(new DateOnly(2026, 10, 16), PageKeys.Home, 99);
        await rig.SeedVisitAsync(1, new DateOnly(2026, 11, 14));
        await rig.SeedVisitAsync(1, new DateOnly(2026, 11, 15));
        await rig.SeedVisitAsync(2, new DateOnly(2026, 11, 10));
        await rig.SeedVisitAsync(3, new DateOnly(2026, 10, 16));

        using var response = await rig.GetAsync(string.Empty, rig.Manager.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await ReadAsync(response);
        body.GetProperty("range").GetString().ShouldBe("last-30-days");
        body.GetProperty("from").GetString().ShouldBe("2026-10-17");
        body.GetProperty("to").GetString().ShouldBe("2026-11-15");
        body.GetProperty("cutDate").GetString().ShouldBe("2025-10-15");
        var totals = body.GetProperty("totals");
        totals.GetProperty("uniqueVisitors").GetInt32().ShouldBe(2);
        totals.GetProperty("visits").GetInt32().ShouldBe(3);
        totals.GetProperty("pageViews").GetInt32().ShouldBe(19);
        IsNullOrMissing(totals, "countedFrom").ShouldBeTrue();
    }

    [Fact]
    public async Task TheLastThirtyDaysAnswerOneDayBucketPerDayWithZerosForEmptyDays()
    {
        await using var rig = await Rig.StartAsync(database, Noon);
        await rig.SeedViewsAsync(new DateOnly(2026, 11, 15), PageKeys.Home, 10);
        await rig.SeedViewsAsync(new DateOnly(2026, 11, 15), PageKeys.Gallery, 5);
        await rig.SeedVisitAsync(1, new DateOnly(2026, 11, 15));
        await rig.SeedVisitAsync(1, new DateOnly(2026, 11, 15));
        await rig.SeedVisitAsync(2, new DateOnly(2026, 11, 15));
        await rig.SeedVisitAsync(3, new DateOnly(2026, 10, 17));

        using var response = await rig.GetAsync(string.Empty, rig.Manager.AccessToken);

        var body = await ReadAsync(response);
        body.GetProperty("bucket").GetString().ShouldBe("day");
        var trend = body.GetProperty("trend").EnumerateArray().ToList();
        trend.Count.ShouldBe(30);
        trend.Select(static b => b.GetProperty("start").GetString())
            .ShouldBe(Enumerable.Range(0, 30).Select(static i => new DateOnly(2026, 10, 17).AddDays(i).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)));
        Figures(trend[0]).ShouldBe((0, 1));
        Figures(trend[1]).ShouldBe((0, 0));
        Figures(trend[29]).ShouldBe((15, 2));
    }

    [Fact]
    public async Task TheAnswerIsNeverCached()
    {
        await using var rig = await Rig.StartAsync(database, Noon);

        using var response = await rig.GetAsync(string.Empty, rig.Manager.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
    }

    [Fact]
    public async Task AnAdminGets403AndAnAnonymousCallerGets401()
    {
        await using var rig = await Rig.StartAsync(database, Noon);

        using var admin = await rig.GetAsync(string.Empty, rig.Admin.AccessToken);
        using var anonymous = await rig.GetAsync(string.Empty, accessToken: null);

        admin.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("range=custom", "from", "Enter a start date.")]
    [InlineData("range=custom&from=2026-11-01", "to", "Enter an end date.")]
    [InlineData("range=custom&from=2026-02-30&to=2026-11-01", "from", "Enter a real date.")]
    [InlineData("range=custom&from=2026-11-01&to=tomorrow", "to", "Enter a real date.")]
    [InlineData("range=custom&from=2026-11-10&to=2026-11-09", "from", "The start date must be on or before the end date.")]
    [InlineData("range=custom&from=2023-11-14&to=2026-11-01", "from", "Choose a date from Nov 15, 2023 to today.")]
    [InlineData("range=custom&from=2026-11-01&to=2026-11-16", "to", "Choose a date from Nov 15, 2023 to today.")]
    public async Task ABadCustomRangeIs400WithTheFieldMessage(string query, string field, string message)
    {
        await using var rig = await Rig.StartAsync(database, Noon);

        using var response = await rig.GetAsync(query, rig.Manager.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ReadAsync(response);
        problem.GetProperty("errors").GetProperty(field).EnumerateArray().Select(static m => m.GetString()).ShouldBe([message], query);
    }

    [Fact]
    public async Task PresetsFollowTheBusinessDayNotTheUtcDayAtManilaMidnight()
    {
        // 00:30 in Manila on 2026-11-16 is still 2026-11-15 in UTC.
        await using var rig = await Rig.StartAsync(database, new DateTimeOffset(2026, 11, 15, 16, 30, 0, TimeSpan.Zero));

        using var thisMonth = await rig.GetAsync("range=this-month", rig.Manager.AccessToken);
        using var week = await rig.GetAsync("range=last-7-days", rig.Manager.AccessToken);

        var month = await ReadAsync(thisMonth);
        (month.GetProperty("from").GetString(), month.GetProperty("to").GetString()).ShouldBe(("2026-11-01", "2026-11-16"));
        var seven = await ReadAsync(week);
        (seven.GetProperty("from").GetString(), seven.GetProperty("to").GetString()).ShouldBe(("2026-11-10", "2026-11-16"));
    }

    [Fact]
    public async Task ACustomRangeAndAnUnknownRangeBothAnswer200()
    {
        await using var rig = await Rig.StartAsync(database, Noon);

        using var custom = await rig.GetAsync("range=custom&from=2026-11-01&to=2026-11-15", rig.Manager.AccessToken);
        using var unknown = await rig.GetAsync("range=bogus&from=junk", rig.Manager.AccessToken);

        custom.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadAsync(custom)).GetProperty("range").GetString().ShouldBe("custom");
        unknown.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadAsync(unknown)).GetProperty("range").GetString().ShouldBe("last-30-days");
    }

    [Fact]
    public async Task ARangeWhollyBeforeTheCutAnswersNoVisitFiguresAndTheStoredPageViews()
    {
        await using var rig = await Rig.StartAsync(database, Noon);
        await rig.SeedViewsAsync(new DateOnly(2025, 6, 1), PageKeys.Home, 8);
        await rig.SeedVisitAsync(1, new DateOnly(2025, 10, 14));

        using var response = await rig.GetAsync("range=custom&from=2025-01-01&to=2025-10-14", rig.Manager.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var totals = (await ReadAsync(response)).GetProperty("totals");
        IsNullOrMissing(totals, "uniqueVisitors").ShouldBeTrue();
        IsNullOrMissing(totals, "visits").ShouldBeTrue();
        IsNullOrMissing(totals, "countedFrom").ShouldBeTrue();
        totals.GetProperty("pageViews").GetInt32().ShouldBe(8);
    }

    [Fact]
    public async Task ARangeCrossingTheCutCountsVisitsFromTheCutDayAndSaysSo()
    {
        await using var rig = await Rig.StartAsync(database, Noon);
        await rig.SeedVisitAsync(1, new DateOnly(2025, 10, 14));
        await rig.SeedVisitAsync(2, new DateOnly(2025, 10, 15));
        await rig.SeedVisitAsync(2, new DateOnly(2026, 3, 1));
        await rig.SeedViewsAsync(new DateOnly(2025, 10, 10), PageKeys.Home, 6);

        using var response = await rig.GetAsync("range=custom&from=2025-10-01&to=2026-11-15", rig.Manager.AccessToken);

        var totals = (await ReadAsync(response)).GetProperty("totals");
        totals.GetProperty("visits").GetInt32().ShouldBe(2);
        totals.GetProperty("uniqueVisitors").GetInt32().ShouldBe(1);
        totals.GetProperty("pageViews").GetInt32().ShouldBe(6);
        totals.GetProperty("countedFrom").GetString().ShouldBe("2025-10-15");
    }

    [Fact]
    public async Task AnEmptyMonthInsideThirteenMonthsAnswersZerosNotNulls()
    {
        await using var rig = await Rig.StartAsync(database, Noon);

        using var response = await rig.GetAsync("range=custom&from=2026-09-01&to=2026-09-30", rig.Manager.AccessToken);

        var totals = (await ReadAsync(response)).GetProperty("totals");
        totals.GetProperty("uniqueVisitors").GetInt32().ShouldBe(0);
        totals.GetProperty("visits").GetInt32().ShouldBe(0);
        totals.GetProperty("pageViews").GetInt32().ShouldBe(0);
        IsNullOrMissing(totals, "countedFrom").ShouldBeTrue();
    }

    [Fact]
    public async Task TheAnswerHoldsOnlyTotalsNeverAHashAnIdOrATime()
    {
        await using var rig = await Rig.StartAsync(database, Noon);
        await rig.SeedVisitAsync(1, new DateOnly(2026, 11, 14));
        await rig.SeedViewsAsync(new DateOnly(2026, 11, 14), PageKeys.Home, 2);

        using var response = await rig.GetAsync(string.Empty, rig.Manager.AccessToken);

        var names = new List<string>();
        CollectNames(await ReadAsync(response), names);
        string[] allowed = ["range", "from", "to", "cutDate", "totals", "uniqueVisitors", "visits", "pageViews", "countedFrom", "bucket", "trend", "start"];
        names.Except(allowed).ShouldBeEmpty("later plans extend this list on purpose, one reviewed name at a time");
        names.ShouldNotContain(name => ForbiddenWords.Any(word => name.Contains(word, StringComparison.OrdinalIgnoreCase)));
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Regex.IsMatch(body, "[0-9a-fA-F]{32}").ShouldBeFalse("no hash is ever returned");
        Regex.IsMatch(body, @"\d{2}:\d{2}").ShouldBeFalse("no time of day is ever returned");
    }

    private static void CollectNames(JsonElement element, List<string> names)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                names.Add(property.Name);
                CollectNames(property.Value, names);
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                CollectNames(item, names);
            }
        }
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return JsonDocument.Parse(text).RootElement.Clone();
    }

    private static (int PageViews, int? UniqueVisitors) Figures(JsonElement bucket)
    {
        var unique = bucket.GetProperty("uniqueVisitors");
        return (bucket.GetProperty("pageViews").GetInt32(), unique.ValueKind == JsonValueKind.Null ? null : unique.GetInt32());
    }

    private static bool IsNullOrMissing(JsonElement element, string name) =>
        !element.TryGetProperty(name, out var value) || value.ValueKind == JsonValueKind.Null;

    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsApiFactory _baseFactory;
        private readonly WebApplicationFactory<Program> _factory;
        private readonly CspsDatabase _database;

        private Rig(CspsDatabase database, CspsApiFactory baseFactory, WebApplicationFactory<Program> factory, StartedSession admin, StartedSession manager)
        {
            _database = database;
            _baseFactory = baseFactory;
            _factory = factory;
            Client = factory.CreateClient();
            Admin = admin;
            Manager = manager;
        }

        public HttpClient Client { get; }

        public StartedSession Admin { get; }

        public StartedSession Manager { get; }

        public static async Task<Rig> StartAsync(CspsDatabase database, DateTimeOffset now)
        {
            await database.ResetAsync();
            var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
            WebApplicationFactory<Program>? clockFactory = null;
            try
            {
                clockFactory = AuthClient.WithClock(baseFactory, new FakeTimeProvider(now));

                // The sessions start on the fixed-clock host. The token lifetime is checked against the system clock, so each token
                // is minted for the real now.
                var admin = await SignInAsync(clockFactory, Roles.Admin);
                var manager = await SignInAsync(clockFactory, Roles.Manager);
                return new Rig(database, baseFactory, clockFactory, admin, manager);
            }
            catch
            {
                if (clockFactory is not null)
                {
                    await clockFactory.DisposeAsync();
                }

                await baseFactory.DisposeAsync();
                throw;
            }
        }

        public async Task<HttpResponseMessage> GetAsync(string query, string? accessToken)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, query.Length == 0 ? Route : $"{Route}?{query}");
            if (accessToken is not null)
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            }

            return await Client.SendAsync(request, TestContext.Current.CancellationToken);
        }

        public async Task SeedViewsAsync(DateOnly day, string pageKey, int views)
        {
            await using var context = _database.CreateContext();
            context.DailyPageCounts.Add(DailyPageCount.First(day, pageKey));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            await context.DailyPageCounts
                .Where(row => row.BusinessDay == day && row.PageKey == pageKey)
                .ExecuteUpdateAsync(set => set.SetProperty(row => row.Views, views), TestContext.Current.CancellationToken);
        }

        public async Task SeedVisitAsync(byte visitor, DateOnly day)
        {
            await using var context = _database.CreateContext();
            var startedAt = new DateTimeOffset(day.ToDateTime(new TimeOnly(10, 0)), TimeSpan.FromHours(8)).ToUniversalTime();
            context.AnalyticsVisits.Add(
                AnalyticsVisit.Start(Enumerable.Repeat(visitor, 32).ToArray(), day, startedAt, ReferrerName.Direct, DeviceKind.Phone, "Chrome", "Android", null));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
            await _baseFactory.DisposeAsync();
        }

        private static async Task<StartedSession> SignInAsync(WebApplicationFactory<Program> clockFactory, string role)
        {
            var started = await TestSessions.StartAsync(clockFactory, role);
            return started with { AccessToken = TestTokens.For(role, TimeProvider.System, started.UserId, sessionId: started.SessionId) };
        }
    }
}

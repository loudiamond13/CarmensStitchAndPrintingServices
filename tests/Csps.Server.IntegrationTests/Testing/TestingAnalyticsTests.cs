using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Analytics;
using Csps.Server.Composition;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Testing;

/// <summary>
/// ANL-08, D-27: <c>POST /api/testing/analytics</c> lets E2E specs put visit totals on chosen business days, so the 13-month view can be
/// proved with exact numbers. Days before the cut get daily rows only; days from the cut on also get raw visits. Testing builds only.
/// </summary>
public sealed class TestingAnalyticsTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/testing/analytics";

    // 12:00 in Manila on 2026-11-15. The cut is 2025-10-15.
    private static readonly DateTimeOffset Noon = new(2026, 11, 15, 4, 0, 0, TimeSpan.Zero);

    private static readonly DateOnly Today = new(2026, 11, 15);

    [Fact]
    public async Task ADay400DaysAgoGetsItsDailyRowsAndNoRawVisits()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var rig = await Rig.StartAsync(database, Noon);
        var day = Today.AddDays(-400);

        using var seed = await rig.PostAsync(OldDay(-400, views: 7));

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var pages = await context.DailyPageCounts.AsNoTracking().Where(row => row.BusinessDay == day).ToListAsync(TestContext.Current.CancellationToken);
        pages.Select(row => $"{row.PageKey}|{row.Views}").ShouldBe(["home|7"]);
        var referrers = await context.DailyReferrerCounts.AsNoTracking().Where(row => row.BusinessDay == day).OrderBy(row => row.Referrer).ToListAsync(TestContext.Current.CancellationToken);
        referrers.Select(row => $"{row.Referrer}|{row.Visits}").ShouldBe(["Direct|1", "Facebook|2"]);
        var labels = await context.DailyDeviceCounts.AsNoTracking().Where(row => row.BusinessDay == day).OrderBy(row => row.Dimension).ThenBy(row => row.Name).ToListAsync(TestContext.Current.CancellationToken);
        labels.Select(row => $"{row.Dimension}|{row.Name}|{row.Visits}").ShouldBe(["Device|Computer|1", "Device|Phone|2", "Browser|Chrome|2", "Browser|Firefox|1"]);
        (await context.AnalyticsVisits.CountAsync(row => row.BusinessDay == day, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ARangeWhollyBeforeTheCutReadsTheSeededPageViewsAndReferrersAndNoVisitCounts()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var rig = await Rig.StartAsync(database, Noon);

        using var seed = await rig.PostAsync(OldDay(-400, views: 7));
        using var read = await rig.GetStatsAsync("range=custom&from=2025-10-10&to=2025-10-12");

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        read.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var totals = document.RootElement.GetProperty("totals");
        totals.GetProperty("pageViews").GetInt32().ShouldBe(7);
        totals.GetProperty("visits").ValueKind.ShouldBe(JsonValueKind.Null);
        totals.GetProperty("uniqueVisitors").ValueKind.ShouldBe(JsonValueKind.Null);
        var referrers = document.RootElement.GetProperty("referrers").EnumerateArray().Select(row => $"{row.GetProperty("name").GetString()}|{row.GetProperty("count").GetInt32()}");
        referrers.ShouldBe(["Facebook|2", "Direct|1"]);
    }

    [Fact]
    public async Task ADayInsideThirteenMonthsGetsRawVisitsWithTheirPageViewsAndNoRolledUpRows()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var rig = await Rig.StartAsync(database, Noon);
        var day = Today.AddDays(-3);

        using var seed = await rig.PostAsync(OldDay(-3, views: 9));

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        (await context.DailyPageCounts.AsNoTracking().SingleAsync(row => row.BusinessDay == day, TestContext.Current.CancellationToken)).Views.ShouldBe(9);
        var visits = await context.AnalyticsVisits.AsNoTracking().Where(row => row.BusinessDay == day).OrderBy(row => row.Referrer).ThenBy(row => row.Browser).ThenBy(row => row.PageViews).ToListAsync(TestContext.Current.CancellationToken);
        visits.Select(row => $"{row.Referrer}|{row.Device}|{row.Browser}|{row.Os}|{row.PageViews}").ShouldBe(
            ["Direct|Computer|Firefox|Windows|1", "Facebook|Phone|Chrome|Android|2", "Facebook|Phone|Chrome|Android|3"]);
        visits.Select(row => Convert.ToHexString(row.VisitorHash)).Distinct().Count().ShouldBe(3);
        (await context.AnalyticsPageViews.CountAsync(row => row.BusinessDay == day && row.PageKey == PageKeys.Home, TestContext.Current.CancellationToken)).ShouldBe(6);
        (await context.DailyReferrerCounts.CountAsync(row => row.BusinessDay == day, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.DailyDeviceCounts.CountAsync(row => row.BusinessDay == day, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ARepeatReplacesTheRowsOnThoseDays()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var rig = await Rig.StartAsync(database, Noon);
        var day = Today.AddDays(-400);

        using var first = await rig.PostAsync(OldDay(-400, views: 7));
        using var second = await rig.PostAsync(new { days = new[] { new { offsetDays = -400, pageKey = "gallery", views = 4, visits = Array.Empty<object>() } } });

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var pages = await context.DailyPageCounts.AsNoTracking().Where(row => row.BusinessDay == day).ToListAsync(TestContext.Current.CancellationToken);
        pages.Select(row => $"{row.PageKey}|{row.Views}").ShouldBe(["gallery|4"]);
        (await context.DailyReferrerCounts.CountAsync(row => row.BusinessDay == day, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.DailyDeviceCounts.CountAsync(row => row.BusinessDay == day, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Theory]
    [InlineData("")]
    [InlineData("{}")]
    [InlineData("""{"days":[{"offsetDays":1,"pageKey":"home","views":1}]}""")]
    [InlineData("""{"days":[{"offsetDays":-2000,"pageKey":"home","views":1}]}""")]
    [InlineData("""{"days":[{"offsetDays":-5,"pageKey":"admin","views":1}]}""")]
    [InlineData("""{"days":[{"offsetDays":-5,"pageKey":"home","views":0}]}""")]
    [InlineData("""{"days":[{"offsetDays":-5,"pageKey":"home","views":1},{"offsetDays":-5,"pageKey":"home","views":2}]}""")]
    [InlineData("""{"days":[{"offsetDays":-5,"pageKey":"home","views":1,"visits":[{"referrer":"Direct","device":"Fridge","browser":"Chrome","os":"Android","pageViews":1}]}]}""")]
    [InlineData("""{"days":[{"offsetDays":-5,"pageKey":"home","views":1,"visits":[{"referrer":"Direct","device":"Phone","browser":"Chrome","os":"Android","pageViews":0}]}]}""")]
    public async Task ABodyThatIsMissingOrOutOfBoundsIsAPlain400AndChangesNothing(string body)
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var rig = await Rig.StartAsync(database, Noon);

        using var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
        using var response = await rig.Client.PostAsync(new Uri(Route, UriKind.Relative), content, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        await using var context = database.CreateContext();
        (await context.DailyPageCounts.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Theory]
    [InlineData("CSPS_Dev_Copy")]
    [InlineData("CSPS_E2E_Copy")]
    [InlineData("Csps_Unlisted_Guard")]
    public async Task APostOnADatabaseOutsideTheTestListIsRefusedAndNeverNamesTheDatabase(string databaseName)
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        var builder = new SqlConnectionStringBuilder(database.ConnectionString) { InitialCatalog = databaseName };
        await using var factory = CspsApiFactory.ForDatabase(builder.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), OldDay(-400, views: 7), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain("only runs on");
        body.ShouldNotContain(databaseName);
    }

    // One page with three visits: two from Facebook on a phone in Chrome (2 and 3 page views), one direct on a computer in Firefox.
    private static object OldDay(int offsetDays, int views) => new
    {
        days = new[]
        {
            new
            {
                offsetDays,
                pageKey = PageKeys.Home,
                views,
                visits = new[]
                {
                    new { referrer = ReferrerName.Facebook, device = "Phone", browser = "Chrome", os = "Android", pageViews = 2 },
                    new { referrer = ReferrerName.Facebook, device = "Phone", browser = "Chrome", os = "Android", pageViews = 3 },
                    new { referrer = ReferrerName.Direct, device = "Computer", browser = "Firefox", os = "Windows", pageViews = 1 },
                },
            },
        },
    };

    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsApiFactory _baseFactory;
        private readonly WebApplicationFactory<Program> _factory;

        private Rig(CspsApiFactory baseFactory, WebApplicationFactory<Program> factory, StartedSession manager)
        {
            _baseFactory = baseFactory;
            _factory = factory;
            Client = factory.CreateClient();
            Manager = manager;
        }

        public HttpClient Client { get; }

        public StartedSession Manager { get; }

        public static async Task<Rig> StartAsync(CspsDatabase database, DateTimeOffset now)
        {
            await database.ResetAsync();
            var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
            WebApplicationFactory<Program>? clockFactory = null;
            try
            {
                clockFactory = AuthClient.WithClock(baseFactory, new FakeTimeProvider(now));
                var started = await TestSessions.StartAsync(clockFactory, Roles.Manager);

                // The token lifetime is checked against the system clock, so the token is minted for the real now.
                var manager = started with { AccessToken = TestTokens.For(Roles.Manager, TimeProvider.System, started.UserId, sessionId: started.SessionId) };
                return new Rig(baseFactory, clockFactory, manager);
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

        public Task<HttpResponseMessage> PostAsync(object body) =>
            Client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), body, TestContext.Current.CancellationToken);

        public async Task<HttpResponseMessage> GetStatsAsync(string query)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/visitor-stats?{query}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Manager.AccessToken);
            return await Client.SendAsync(request, TestContext.Current.CancellationToken);
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
            await _baseFactory.DisposeAsync();
        }
    }
}

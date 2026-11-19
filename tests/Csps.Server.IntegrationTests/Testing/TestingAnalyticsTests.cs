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
/// ANL-08, D-57, D-70: <c>POST /api/testing/analytics</c> lets E2E specs put page counts on chosen business days, so the page can be proved
/// with exact numbers up to 3 years back. It writes daily page counts only, never a visit row. Testing builds only.
/// </summary>
public sealed class TestingAnalyticsTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/testing/analytics";

    // 12:00 in Manila on 2026-11-15. The 3-year floor is 2023-11-15.
    private static readonly DateTimeOffset Noon = new(2026, 11, 15, 4, 0, 0, TimeSpan.Zero);

    private static readonly DateOnly Today = new(2026, 11, 15);

    [Theory]
    [InlineData(-3)]
    [InlineData(-400)]
    [InlineData(-730)]
    [InlineData(-1096)]
    public async Task ADayGetsItsDailyPageCountsAndNoOtherRow(int offsetDays)
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var rig = await Rig.StartAsync(database, Noon);
        var day = Today.AddDays(offsetDays);

        using var seed = await rig.PostAsync(PageDay(offsetDays, views: 7));

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var pages = await context.DailyPageCounts.AsNoTracking().Where(row => row.BusinessDay == day).ToListAsync(TestContext.Current.CancellationToken);
        pages.Select(row => $"{row.PageKey}|{row.Views}").ShouldBe(["home|7"]);
        (await context.AnalyticsVisits.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AnalyticsPageViews.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.DailyReferrerCounts.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.DailyDeviceCounts.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnOldBodyThatStillCarriesVisitsWritesNoVisitRows()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var rig = await Rig.StartAsync(database, Noon);
        object visit = new { referrer = "Facebook", device = "Phone", browser = "Chrome", os = "Android", pageViews = 2 };

        using var recent = await rig.PostAsync(new { days = new[] { new { offsetDays = -3, pageKey = PageKeys.Home, views = 9, visits = new[] { visit } } } });
        using var old = await rig.PostAsync(new { days = new[] { new { offsetDays = -400, pageKey = PageKeys.Home, views = 7, visits = new[] { visit } } } });

        recent.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        old.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        (await context.DailyPageCounts.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(2);
        (await context.AnalyticsVisits.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AnalyticsPageViews.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.DailyReferrerCounts.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.DailyDeviceCounts.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ARangeTwoYearsBackReadsTheSeededPageViewsAndTopPage()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var rig = await Rig.StartAsync(database, Noon);
        var from = Today.AddDays(-732).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
        var to = Today.AddDays(-730).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

        using var seed = await rig.PostAsync(PageDay(-731, views: 7));
        using var read = await rig.GetStatsAsync($"range=custom&from={from}&to={to}");

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        read.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("pageViews").GetInt32().ShouldBe(7);
        var pages = document.RootElement.GetProperty("topPages").EnumerateArray().Select(row => $"{row.GetProperty("name").GetString()}|{row.GetProperty("count").GetInt32()}");
        pages.ShouldBe(["home|7"]);
    }

    [Fact]
    public async Task ARepeatReplacesTheRowsOnThoseDays()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var rig = await Rig.StartAsync(database, Noon);
        var day = Today.AddDays(-400);

        using var first = await rig.PostAsync(PageDay(-400, views: 7));
        using var second = await rig.PostAsync(new { days = new[] { new { offsetDays = -400, pageKey = "gallery", views = 4 } } });

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var pages = await context.DailyPageCounts.AsNoTracking().Where(row => row.BusinessDay == day).ToListAsync(TestContext.Current.CancellationToken);
        pages.Select(row => $"{row.PageKey}|{row.Views}").ShouldBe(["gallery|4"]);
    }

    [Theory]
    [InlineData("")]
    [InlineData("{}")]
    [InlineData("""{"days":[{"offsetDays":1,"pageKey":"home","views":1}]}""")]
    [InlineData("""{"days":[{"offsetDays":-1097,"pageKey":"home","views":1}]}""")]
    [InlineData("""{"days":[{"offsetDays":-2000,"pageKey":"home","views":1}]}""")]
    [InlineData("""{"days":[{"offsetDays":-5,"pageKey":"admin","views":1}]}""")]
    [InlineData("""{"days":[{"offsetDays":-5,"pageKey":"home","views":0}]}""")]
    [InlineData("""{"days":[{"offsetDays":-5,"pageKey":"home","views":1},{"offsetDays":-5,"pageKey":"home","views":2}]}""")]
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

    [Fact]
    public async Task TheRefusalTextNamesTheNewRulesAndNoVisits()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var rig = await Rig.StartAsync(database, Noon);

        using var content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json");
        using var response = await rig.Client.PostAsync(new Uri(Route, UriKind.Relative), content, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain("within 3 years");
        body.ShouldContain("Each day and page appears once");
        body.ShouldNotContain("visit");
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

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), PageDay(-400, views: 7), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain("only runs on");
        body.ShouldNotContain(databaseName);
    }

    private static object PageDay(int offsetDays, int views) => new
    {
        days = new[] { new { offsetDays, pageKey = PageKeys.Home, views } },
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

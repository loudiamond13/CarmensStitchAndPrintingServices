using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Analytics;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Analytics;

/// <summary>
/// ANL-08, D-25, D-27, D-33: <c>GET /api/v1/visitor-stats/export</c> answers the chosen range as a UTF-8 CSV with a byte-order mark and one row per
/// business day. Managers only.
/// </summary>
public sealed class VisitorStatsExportTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/visitor-stats/export";
    private const string Header = "Date,Unique visitors,Visits,Page views";

    // 12:00 in Manila on 2026-11-15. The cut is 2025-10-15.
    private static readonly DateTimeOffset Noon = new(2026, 11, 15, 4, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AManagerGetsTheRangeAsAUtf8CsvFileThatStartsWithAByteOrderMark()
    {
        await using var rig = await Rig.StartAsync(database, Noon);
        await rig.SeedViewsAsync(new DateOnly(2026, 11, 13), PageKeys.Home, 7);
        await rig.SeedViewsAsync(new DateOnly(2026, 11, 15), PageKeys.Home, 10);
        await rig.SeedViewsAsync(new DateOnly(2026, 11, 15), PageKeys.Gallery, 5);
        await rig.SeedVisitAsync(1, new DateOnly(2026, 11, 13));
        await rig.SeedVisitAsync(1, new DateOnly(2026, 11, 15));
        await rig.SeedVisitAsync(1, new DateOnly(2026, 11, 15));
        await rig.SeedVisitAsync(2, new DateOnly(2026, 11, 15));

        using var response = await rig.GetAsync("range=custom&from=2026-11-13&to=2026-11-15", rig.Manager.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var type = response.Content.Headers.ContentType.ShouldNotBeNull();
        (type.MediaType, type.CharSet).ShouldBe(("text/csv", "utf-8"));
        response.Content.Headers.ContentDisposition.ShouldNotBeNull().ToString()
            .ShouldBe("attachment; filename=\"visitor-stats-2026-11-13-to-2026-11-15.csv\"");
        var bytes = await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        bytes.Take(3).ShouldBe(new byte[] { 0xEF, 0xBB, 0xBF });
        Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3)
            .ShouldBe($"{Header}\r\n2026-11-13,1,1,7\r\n2026-11-14,0,0,0\r\n2026-11-15,2,3,15\r\n");
    }

    [Fact]
    public async Task WithNoRangeTheFileHoldsTheLastThirtyDaysOneRowPerDay()
    {
        await using var rig = await Rig.StartAsync(database, Noon);

        using var response = await rig.GetAsync(string.Empty, rig.Manager.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentDisposition.ShouldNotBeNull().FileName.ShouldBe("visitor-stats-2026-10-17-to-2026-11-15.csv");
        var lines = (await ReadCsvAsync(response)).Split("\r\n");
        lines.Length.ShouldBe(32);
        lines[0].ShouldBe(Header);
        lines[1].ShouldBe("2026-10-17,0,0,0");
        lines[30].ShouldBe("2026-11-15,0,0,0");
        lines[31].ShouldBeEmpty();
    }

    [Fact]
    public async Task TheFileIsNeverCached()
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

    [Fact]
    public async Task ABadCustomRangeIs400WithTheFieldMessageAsProblemJson()
    {
        await using var rig = await Rig.StartAsync(database, Noon);

        using var response = await rig.GetAsync("range=custom&from=2026-11-10&to=2026-11-09", rig.Manager.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/problem+json");
        response.Content.Headers.ContentDisposition.ShouldBeNull();
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        problem.RootElement.GetProperty("errors").GetProperty("from").EnumerateArray().Select(static m => m.GetString())
            .ShouldBe(["The start date must be on or before the end date."]);
    }

    private static async Task<string> ReadCsvAsync(HttpResponseMessage response)
    {
        var bytes = await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        bytes.Take(3).ShouldBe(new byte[] { 0xEF, 0xBB, 0xBF });
        return Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
    }

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

                // The token lifetime is checked against the system clock, so each token is minted for the real now.
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

using System.Net;
using System.Net.Http.Headers;
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
/// ANL-08, D-23, D-24, D-27, D-33: <c>GET /api/v1/visitor-stats</c> is a Manager-only read of unique visitors, visits and page views. The range is
/// resolved in the business zone on the server, and the answer holds totals only.
/// </summary>
public sealed class VisitorStatsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/visitor-stats";

    // 12:00 in Manila on 2026-11-15. The cut is 2025-10-15 and the floor is 2023-11-15.
    private static readonly DateTimeOffset Noon = new(2026, 11, 15, 4, 0, 0, TimeSpan.Zero);

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

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return JsonDocument.Parse(text).RootElement.Clone();
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

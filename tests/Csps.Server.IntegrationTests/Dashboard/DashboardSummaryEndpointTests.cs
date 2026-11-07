using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Orders;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Dashboard;

/// <summary>DASH-01, 07 D-01, D-12, D-13: one live call gives the business today, the greeting part, the caller's first name and the order figures.</summary>
public sealed class DashboardSummaryEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/dashboard/summary";

    // 09:30 in Manila on Wednesday 2026-11-04.
    private static readonly DateTimeOffset NineThirtyManila = new(2026, 11, 4, 1, 30, 0, TimeSpan.Zero);

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task AManagerGetsTheBusinessTodayTheMorningGreetingAndTheirOwnFirstName()
    {
        await using var rig = await Rig.StartAsync(database, NineThirtyManila);
        await Rig.RenameAsync(database, rig.Manager.UserId, "Carmen");

        var summary = await rig.ReadAsync(rig.Manager.AccessToken);

        summary.GetProperty("today").GetString().ShouldBe("2026-11-04");
        summary.GetProperty("greeting").GetString().ShouldBe("morning");
        summary.GetProperty("firstName").GetString().ShouldBe("Carmen");
    }

    [Theory]
    [InlineData(5, 0, "afternoon")]
    [InlineData(10, 0, "evening")]
    [InlineData(3, 59, "morning")]
    public async Task TheGreetingPartFollowsTheManilaClock(int hour, int minute, string expected)
    {
        await using var rig = await Rig.StartAsync(database, new DateTimeOffset(2026, 11, 4, hour, minute, 0, TimeSpan.Zero));

        var summary = await rig.ReadAsync(rig.Manager.AccessToken);

        summary.GetProperty("greeting").GetString().ShouldBe(expected);
    }

    [Fact]
    public async Task AnAdminGetsTheirOwnFirstNameAndTheManagerGetsTheirs()
    {
        await using var rig = await Rig.StartAsync(database, NineThirtyManila);
        await Rig.RenameAsync(database, rig.Admin.UserId, "Liza");
        await Rig.RenameAsync(database, rig.Manager.UserId, "Carmen");

        var forAdmin = await rig.ReadAsync(rig.Admin.AccessToken);
        var forManager = await rig.ReadAsync(rig.Manager.AccessToken);

        forAdmin.GetProperty("firstName").GetString().ShouldBe("Liza");
        forManager.GetProperty("firstName").GetString().ShouldBe("Carmen");
    }

    [Fact]
    public async Task ActiveCountsPendingToDeliveredAndLeavesOutEndStatesAndDeletedOrders()
    {
        await using var rig = await Rig.StartAsync(database, NineThirtyManila);
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0001", OrderStatus.Pending));
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0002", OrderStatus.Pending));
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0003", OrderStatus.Delivered));
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0004", OrderStatus.Completed));
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0005", OrderStatus.Cancelled));
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0006", OrderStatus.Pending) { Deleted = true });

        var summary = await rig.ReadAsync(rig.Admin.AccessToken);

        summary.GetProperty("orders").GetProperty("active").GetInt32().ShouldBe(3);
    }

    [Fact]
    public async Task TheAnswerIsNeverCached()
    {
        await using var rig = await Rig.StartAsync(database, NineThirtyManila);

        using var response = await rig.GetAsync(rig.Manager.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
    }

    [Fact]
    public async Task AnAnonymousCallerGets401()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = baseFactory.CreateClient();
        using var request = ApiRequests.Get(Route);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsApiFactory _baseFactory;
        private readonly WebApplicationFactory<Program> _factory;
        private readonly DateTimeOffset _now;

        private Rig(CspsApiFactory baseFactory, WebApplicationFactory<Program> factory, DateTimeOffset now, StartedSession admin, StartedSession manager)
        {
            _baseFactory = baseFactory;
            _factory = factory;
            _now = now;
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

                // The sessions start on the fixed-clock host; the token lifetime is checked against the system clock, so each token is minted for the real now.
                var admin = await SignInAsync(clockFactory, Roles.Admin);
                var manager = await SignInAsync(clockFactory, Roles.Manager);
                return new Rig(baseFactory, clockFactory, now, admin, manager);
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

        public async Task<HttpResponseMessage> GetAsync(string? accessToken)
        {
            using var request = ApiRequests.Get(Route, accessToken);
            return await Client.SendAsync(request, TestContext.Current.CancellationToken);
        }

        public async Task<JsonElement> ReadAsync(string accessToken)
        {
            using var response = await GetAsync(accessToken);
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
            return JsonSerializer.Deserialize<JsonElement>(text, Web);
        }

        public static async Task RenameAsync(CspsDatabase db, Guid userId, string firstName)
        {
            await using var context = db.CreateContext();
            await context.Users.Where(user => user.Id == userId)
                .ExecuteUpdateAsync(set => set.SetProperty(user => user.FirstName, firstName), TestContext.Current.CancellationToken);
        }

        public Task<Guid> SeedAsync(CspsDatabase db, SeedOrder order) => OrderSeeding.AddAsync(db, order, Manager.UserId, _now);

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

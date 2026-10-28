using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-14, D-23, T-07-15: order numbers are unique, contiguous and in the business year of the save, even when many creates start together.</summary>
public sealed class OrderNumberingTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int Senders = 20;
    private const int Repetitions = 10;

    [Fact]
    public async Task TwentyCreatesAtTheSameMomentGetTwentyDistinctContiguousNumbersEveryRound()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var today = await OrderFixtures.TodayAsync(factory);

        for (var round = 1; round <= Repetitions; round++)
        {
            await database.ResetAsync();
            var admin = await TestSessions.StartAsync(factory, Roles.Admin);
            var manager = await TestSessions.StartAsync(factory, Roles.Manager);

            var senders = Enumerable.Range(0, Senders)
                .Select<int, Func<Task<HttpResponseMessage>>>(index => () => OrderFixtures.PostAsync(
                    client,
                    index % 2 == 0 ? admin.AccessToken : manager.AccessToken,
                    OrderFixtures.ValidBody(OrderFixtures.BasketballId, today)))
                .ToList();
            var responses = await ConcurrentRequests.SendAllTogetherAsync(senders);

            var created = new List<(Guid Id, string Number)>();
            foreach (var response in responses)
            {
                using (response)
                {
                    var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
                    response.StatusCode.ShouldBe(HttpStatusCode.Created, $"round {round}: {text}");
                    using var document = JsonDocument.Parse(text);
                    created.Add((document.RootElement.GetProperty("id").GetGuid(), document.RootElement.GetProperty("number").GetString()!));
                }
            }

            var expected = Enumerable.Range(1, Senders).Select(sequence => Number(today.Year, sequence)).ToList();
            created.Select(order => order.Number).Order(StringComparer.Ordinal).ToList().ShouldBe(expected, $"round {round}");
            created.Select(order => order.Number).Distinct(StringComparer.Ordinal).Count().ShouldBe(Senders, $"round {round}");

            foreach (var (id, number) in created)
            {
                var read = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
                read.GetProperty("number").GetString().ShouldBe(number, $"round {round}");
            }

            await using var context = database.CreateContext();
            var counter = await context.OrderNumberCounters.AsNoTracking().SingleAsync(row => row.Year == today.Year, TestContext.Current.CancellationToken);
            counter.LastValue.ShouldBe(Senders, $"round {round}");
            (await context.Orders.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(Senders, $"round {round}");
        }
    }

    [Fact]
    public async Task OneSecondBeforeManilaMidnightTheNumberIsStillInTheOldYear()
    {
        await using var rig = await ClockRig.StartAsync(database, new DateTimeOffset(2026, 12, 31, 15, 59, 59, TimeSpan.Zero));

        var number = await rig.CreateAsync();

        number.ShouldBe("ORD-2026-0001");
    }

    [Fact]
    public async Task AtManilaMidnightTheFirstCreateOfTheNewYearGetsOne()
    {
        await using var rig = await ClockRig.StartAsync(database, new DateTimeOffset(2026, 12, 31, 16, 0, 0, TimeSpan.Zero));

        var number = await rig.CreateAsync();

        number.ShouldBe("ORD-2027-0001");
    }

    [Fact]
    public async Task TheCountersOfTwoYearsRunSeparatelyAcrossTheMidnight()
    {
        await using var rig = await ClockRig.StartAsync(database, new DateTimeOffset(2026, 12, 31, 15, 59, 58, TimeSpan.Zero));

        var before = new[] { await rig.CreateAsync(), await rig.CreateAsync() };
        rig.Clock.Advance(TimeSpan.FromSeconds(2));
        var after = new[] { await rig.CreateAsync(), await rig.CreateAsync() };

        before.ShouldBe(["ORD-2026-0001", "ORD-2026-0002"]);
        after.ShouldBe(["ORD-2027-0001", "ORD-2027-0002"]);
        await using var context = database.CreateContext();
        var counters = await context.OrderNumberCounters.AsNoTracking().OrderBy(row => row.Year).ToListAsync(TestContext.Current.CancellationToken);
        counters.Select(row => (row.Year, row.LastValue)).ToList().ShouldBe([(2026, 2), (2027, 2)]);
    }

    [Fact]
    public async Task AnOrderDatedLastYearButSavedThisYearGetsThisYearsNumber()
    {
        await using var rig = await ClockRig.StartAsync(database, new DateTimeOffset(2027, 1, 2, 2, 0, 0, TimeSpan.Zero));
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, new DateOnly(2026, 12, 30));
        body["dueDate"] = OrderFixtures.Date(new DateOnly(2027, 1, 13));

        var number = await rig.CreateAsync(body);

        number.ShouldBe("ORD-2027-0001");
    }

    private static string Number(int year, int sequence) =>
        $"ORD-{year.ToString(CultureInfo.InvariantCulture)}-{sequence.ToString("D4", CultureInfo.InvariantCulture)}";

    // A host whose clock starts at a fixed instant, with one Admin signed in by that clock.
    private sealed class ClockRig : IAsyncDisposable
    {
        private readonly CspsApiFactory _baseFactory;
        private readonly WebApplicationFactory<Program> _factory;
        private readonly HttpClient _client;
        private readonly StartedSession _admin;

        private ClockRig(CspsApiFactory baseFactory, WebApplicationFactory<Program> factory, FakeTimeProvider clock, StartedSession admin)
        {
            _baseFactory = baseFactory;
            _factory = factory;
            Clock = clock;
            _client = factory.CreateClient();
            _admin = admin;
        }

        public FakeTimeProvider Clock { get; }

        public static async Task<ClockRig> StartAsync(CspsDatabase database, DateTimeOffset start)
        {
            await database.ResetAsync();
            var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
            WebApplicationFactory<Program>? factory = null;
            try
            {
                var clock = new FakeTimeProvider(start);

                // The bearer check reads the wall clock, so a token issued at a December date would not be valid yet. Judge its lifetime by the test clock.
                factory = AuthClient.WithClock(baseFactory, clock).WithWebHostBuilder(builder => builder.ConfigureTestServices(
                    services => services.PostConfigureAll<JwtBearerOptions>(options =>
                        options.TokenValidationParameters.LifetimeValidator = (notBefore, expires, _, parameters) =>
                        {
                            var now = clock.GetUtcNow().UtcDateTime;
                            return (notBefore is null || now + parameters.ClockSkew >= notBefore) && (expires is null || now - parameters.ClockSkew <= expires);
                        })));
                var admin = await TestSessions.StartAsync(factory, Roles.Admin);
                return new ClockRig(baseFactory, factory, clock, admin);
            }
            catch
            {
                if (factory is not null)
                {
                    await factory.DisposeAsync();
                }

                await baseFactory.DisposeAsync();
                throw;
            }
        }

        // Creates one order (a plain one when no body is given) and returns its number.
        public async Task<string> CreateAsync(Dictionary<string, object?>? body = null)
        {
            var created = await OrderFixtures.CreateAsync(_client, _admin.AccessToken, body ?? OrderFixtures.ValidBody(OrderFixtures.BasketballId, await TodayAsync()));
            return created.GetProperty("number").GetString()!;
        }

        private async Task<DateOnly> TodayAsync()
        {
            var scope = _factory.Services.CreateAsyncScope();
            await using (scope)
            {
                var calendar = scope.ServiceProvider.GetRequiredService<IBusinessCalendar>();
                return (await calendar.GetClockAsync(TestContext.Current.CancellationToken)).Today;
            }
        }

        public async ValueTask DisposeAsync()
        {
            _client.Dispose();
            await _factory.DisposeAsync();
            await _baseFactory.DisposeAsync();
        }
    }
}

using Csps.Application.Security;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>PERF-04: the order list route runs exactly two SQL commands whatever the page size and whichever filter or sort is on, so no row costs a query.</summary>
public sealed class OrderListQueryCountTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int RowCount = 40;

    public static TheoryData<string> Queries() =>
    [
        string.Empty,
        "q=Dela",
        "status=all",
        "status=pending",
        "from=2000-01-01&to=2100-01-01",
        "hasBalance=true",
        "sort=newest",
        "sort=balance",
        "sort=total",
    ];

    [Theory]
    [MemberData(nameof(Queries))]
    public async Task ThePageSizeAndTheFilterDoNotChangeTheNumberOfSqlCommands(string query)
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.SeedOrdersAsync(RowCount);
        var separator = query.Length == 0 ? string.Empty : "&";

        foreach (var pageSize in new[] { 1, 20, 100 })
        {
            var measured = await rig.CountAsync(() => OrderFixtures.ReadListAsync(rig.Client, rig.Token, $"{query}{separator}pageSize={pageSize}"));

            measured.Count.ShouldBe(2, $"page size {pageSize}:\n{string.Join("\n", measured.Commands)}");
            measured.Result.GetProperty("items").GetArrayLength().ShouldBe(Math.Min(pageSize, RowCount));
        }
    }

    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsApiFactory _baseFactory;
        private readonly WebApplicationFactory<Program> _factory;

        private Rig(CspsApiFactory baseFactory, WebApplicationFactory<Program> factory, CommandCounter counter, StartedSession session)
        {
            _baseFactory = baseFactory;
            _factory = factory;
            Counter = counter;
            Client = factory.CreateClient();
            Token = session.AccessToken;
        }

        public CommandCounter Counter { get; }

        public HttpClient Client { get; }

        public string Token { get; }

        public static async Task<Rig> StartAsync(CspsDatabase database)
        {
            await database.ResetAsync();
            var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
            WebApplicationFactory<Program>? factory = null;
            try
            {
                var counter = new CommandCounter();

                // ConfigureDbContext appends to the options the host registers, so the stamp interceptor stays.
                factory = baseFactory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
                    services.ConfigureDbContext<CspsDbContext>(options => options.AddInterceptors(counter))));

                // Each request runs in the caller's async flow, so the counter can tell its commands from the host's background work.
                factory.Server.PreserveExecutionContext = true;
                var session = await TestSessions.StartAsync(factory, Roles.Manager);
                return new Rig(baseFactory, factory, counter, session);
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

        // Saves the orders through the API, each with a jersey line and a due date among the next 20 days, so every filter finds rows.
        public async Task SeedOrdersAsync(int count)
        {
            var today = await OrderFixtures.TodayAsync(_baseFactory);
            for (var index = 0; index < count; index++)
            {
                var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
                body["customerName"] = $"Juan Dela Cruz {index:000}";
                body["dueDate"] = OrderFixtures.Date(today.AddDays(1 + (index % 20)));
                await OrderFixtures.CreateAsync(Client, Token, body);
            }
        }

        public Task<MeasuredCommands<T>> CountAsync<T>(Func<Task<T>> request) => Counter.MeasureAsync(request);

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
            await _baseFactory.DisposeAsync();
        }
    }
}

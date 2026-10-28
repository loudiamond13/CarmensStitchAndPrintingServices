using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>
/// PERF-04: on about five years of fake data (8 orders a day, about 14,600 rows) the order list answers with a p95 under 300 ms for
/// the default list, a customer-name search, a product type filter, has-balance, the other sorts and a far page, measured over 200
/// requests after 20 warm-up requests. It runs alone (<see cref="OrderTimingRunsAlone"/>) in its own throwaway database. A failure is
/// re-run alone before it is called flaky, and the limit is never raised without the owner.
/// </summary>
[Collection(OrderTimingRunsAlone.Name)]
public sealed class OrderListTimingTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int WarmUps = 20;
    private const int Samples = 200;
    private const double LimitMilliseconds = 300;

    [Fact]
    public async Task TheListAnswersUnder300MsAtP95OnFiveYearsOfOrders()
    {
        await using var rig = await Rig.StartAsync(database);
        var data = await OrderTimingData.BuildAsync(database, rig.Today, TimeProvider.System.GetUtcNow());
        data.Rows.ShouldBe(OrderTimingData.PerDay * OrderTimingData.Days);

        var everything = $"{OrderFixtures.Route}?status=all&pageSize=100";
        var wholeRange = await rig.ReadAsync($"{everything}&page=1");
        var total = wholeRange.GetProperty("total").GetInt32();
        total.ShouldBeGreaterThan(OrderTimingData.PerDay * OrderTimingData.Days * 9 / 10, "the fake data must be in the database, or this test proves nothing");
        var lastPage = (total + 99) / 100;

        var scenarios = new (string Name, string Path)[]
        {
            ("default list", OrderFixtures.Route),
            ("customer-name search", $"{OrderFixtures.Route}?status=all&q={data.SearchName}"),
            ("product type filter", $"{OrderFixtures.Route}?status=all&productType={OrderFixtures.PoloId:D}"),
            ("has balance", $"{OrderFixtures.Route}?status=all&hasBalance=true"),
            ("far page, size 100", $"{everything}&page={lastPage}"),
            ("newest sort", $"{everything}&sort=newest&page=3"),
            ("balance sort", $"{everything}&sort=balance&page=3"),
            ("total sort", $"{everything}&sort=total&page=3"),
        };

        var results = new List<(string Name, double P50, double P95)>();
        foreach (var (name, path) in scenarios)
        {
            for (var warm = 0; warm < WarmUps; warm++)
            {
                await rig.SendAsync(path);
            }

            var timings = new List<double>(Samples);
            for (var sample = 0; sample < Samples; sample++)
            {
                timings.Add(await rig.SendAsync(path));
            }

            results.Add((name, ExpenseListTimingTests.Percentile(timings, 0.50), ExpenseListTimingTests.Percentile(timings, 0.95)));
        }

        var report = string.Join(
            Environment.NewLine,
            results.Select(result => string.Create(CultureInfo.InvariantCulture, $"{result.Name}: p50 {result.P50:F1} ms, p95 {result.P95:F1} ms")));
        TestContext.Current.TestOutputHelper?.WriteLine(report);
        TestContext.Current.SendDiagnosticMessage(report);

        foreach (var result in results)
        {
            result.P95.ShouldBeLessThan(LimitMilliseconds, $"{result.Name} p95 is too slow.{Environment.NewLine}{report}");
        }
    }

    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsApiFactory _factory;
        private readonly string _token;

        private Rig(CspsApiFactory factory, string token, DateOnly today)
        {
            _factory = factory;
            _token = token;
            Today = today;
            Client = factory.CreateClient();
        }

        public DateOnly Today { get; }

        private HttpClient Client { get; }

        public static async Task<Rig> StartAsync(CspsDatabase database)
        {
            await database.ResetAsync();
            var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
            try
            {
                var session = await TestSessions.StartAsync(factory, Roles.Manager);
                return new Rig(factory, session.AccessToken, await OrderFixtures.TodayAsync(factory));
            }
            catch
            {
                await factory.DisposeAsync();
                throw;
            }
        }

        public async Task<JsonElement> ReadAsync(string path)
        {
            using var request = ApiRequests.Get(path, _token);
            using var response = await Client.SendAsync(request, TestContext.Current.CancellationToken);
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
            using var document = JsonDocument.Parse(text);
            return document.RootElement.Clone();
        }

        // One request, answer read in full, timed in milliseconds.
        public async Task<double> SendAsync(string path)
        {
            using var request = ApiRequests.Get(path, _token);
            var start = TimeProvider.System.GetTimestamp();
            using var response = await Client.SendAsync(request, TestContext.Current.CancellationToken);
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            var elapsed = TimeProvider.System.GetElapsedTime(start).TotalMilliseconds;
            response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
            return elapsed;
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
        }
    }
}

using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>
/// PERF-04, D-28: on about five years of fake data (20 expenses a day, about 36,500 rows) the expense list and the month KPIs answer
/// with a p95 under 300 ms, measured over 200 requests after 20 warm-up requests. It runs alone (<see cref="ExpenseTimingRunsAlone"/>)
/// in its own throwaway database. A failure is re-run alone before it is called flaky, and the limit is never raised without the owner.
/// </summary>
[Collection(ExpenseTimingRunsAlone.Name)]
public sealed class ExpenseListTimingTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int WarmUps = 20;
    private const int Samples = 200;
    private const double LimitMilliseconds = 300;

    // 12:00 in Manila on 2026-10-25, so the business today is 2026-10-25 whatever the machine's own day is.
    private static readonly DateTimeOffset FixedNow = new(2026, 10, 25, 4, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 25);

    [Fact]
    public async Task TheListAndTheKpisAnswerUnder300MsAtP95OnFiveYearsOfData()
    {
        await using var rig = await Rig.StartAsync(database);
        var data = await ExpenseTimingData.BuildAsync(database, Today, FixedNow);
        data.Rows.ShouldBe(ExpenseTimingData.PerDay * ExpenseTimingData.Days);

        var from = Today.AddDays(1 - ExpenseTimingData.Days).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var to = Today.AddDays(30).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var fiveYears = $"from={from}&to={to}&pageSize=100";
        var wholeRange = await rig.ReadAsync($"{ExpenseFixtures.Route}?{fiveYears}&page=1");
        var total = wholeRange.GetProperty("total").GetInt32();
        total.ShouldBeGreaterThan(ExpenseTimingData.PerDay * ExpenseTimingData.Days * 9 / 10, "the fake data must be in the database, or this test proves nothing");
        var lastPage = (total + 99) / 100;

        var scenarios = new (string Name, string Path)[]
        {
            ("default window", ExpenseFixtures.Route),
            ("category filter", $"{ExpenseFixtures.Route}?category={ExpenseFixtures.SuppliesId:D}"),
            ("staff-name search", $"{ExpenseFixtures.Route}?q={data.SearchName}"),
            ("five years, last page, size 100", $"{ExpenseFixtures.Route}?{fiveYears}&page={lastPage}"),
            ("month KPIs", $"{ExpenseFixtures.Route}/kpis"),
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

            results.Add((name, Percentile(timings, 0.50), Percentile(timings, 0.95)));
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

    // The value at index ceil(fraction * n) - 1 of the sorted timings.
    internal static double Percentile(IReadOnlyList<double> timings, double fraction)
    {
        var sorted = timings.Order().ToList();
        var index = (int)Math.Ceiling(fraction * sorted.Count) - 1;
        return sorted[Math.Clamp(index, 0, sorted.Count - 1)];
    }

    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsApiFactory _baseFactory;
        private readonly WebApplicationFactory<Program> _factory;
        private readonly string _token;

        private Rig(CspsApiFactory baseFactory, WebApplicationFactory<Program> factory, string token)
        {
            _baseFactory = baseFactory;
            _factory = factory;
            _token = token;
            Client = factory.CreateClient();
        }

        private HttpClient Client { get; }

        public static async Task<Rig> StartAsync(CspsDatabase database)
        {
            await database.ResetAsync();
            var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
            WebApplicationFactory<Program>? clockFactory = null;
            try
            {
                clockFactory = AuthClient.WithClock(baseFactory, new FakeTimeProvider(FixedNow));

                // The session starts on the fixed-clock host; the token lifetime is checked against the system clock, so the token is minted for the real now.
                var started = await TestSessions.StartAsync(clockFactory, Roles.Manager);
                var token = TestTokens.For(Roles.Manager, TimeProvider.System, started.UserId, sessionId: started.SessionId);
                return new Rig(baseFactory, clockFactory, token);
            }
            catch
            {
                // The rig owns both hosts only once it exists; before that a failed setup stops them here.
                if (clockFactory is not null)
                {
                    await clockFactory.DisposeAsync();
                }

                await baseFactory.DisposeAsync();
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
            await _baseFactory.DisposeAsync();
        }
    }
}

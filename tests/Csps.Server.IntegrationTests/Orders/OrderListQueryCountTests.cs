using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Infrastructure.Persistence;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>PERF-04: the order list route runs exactly three SQL commands whatever the page size and whichever filter or sort is on, so no row costs a query.</summary>
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

        // The business calendar reads the cached site settings once; warm it so the counted request shows only the list commands.
        (await OrderFixtures.ReadListAsync(rig.Client, rig.Token)).GetProperty("items").GetArrayLength().ShouldBeGreaterThan(0);

        foreach (var pageSize in new[] { 1, 20, 100 })
        {
            var measured = await rig.CountAsync(() => OrderFixtures.ReadListAsync(rig.Client, rig.Token, $"{query}{separator}pageSize={pageSize}"));

            // Count, page and the two list-wide counts: 3 fixed commands (D-60, owner, 2026-10-29).
            measured.Count.ShouldBe(3, $"page size {pageSize}:\n{string.Join("\n", measured.Commands)}");
            measured.Result.GetProperty("items").GetArrayLength().ShouldBe(Math.Min(pageSize, RowCount));

            // The photos are read in the same commands: a row with a photo has a cover, a row without has none.
            var items = measured.Result.GetProperty("items").EnumerateArray().ToList();
            items.ShouldAllBe(item => (item.GetProperty("imageCount").GetInt32() > 0) == (item.GetProperty("cover").ValueKind == JsonValueKind.Object));
            if (pageSize == 100)
            {
                items.ShouldContain(item => item.GetProperty("imageCount").GetInt32() == 2);
            }
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
                var created = await OrderFixtures.CreateAsync(Client, Token, body);

                // Every fifth order gets one photo and every tenth a second one, so the page command reads covers and counts.
                for (var photo = 0; photo < (index % 10 == 0 ? 2 : index % 5 == 0 ? 1 : 0); photo++)
                {
                    await UploadPhotoAsync(created.GetProperty("id").GetGuid());
                }
            }
        }

        private async Task UploadPhotoAsync(Guid orderId)
        {
            using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", Token);
            request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
            using var form = new MultipartFormDataContent();
            var part = new ByteArrayContent(SyntheticImages.Jpeg(640, 480));
            part.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
            form.Add(part, "file", "photo.jpg");
            request.Content = form;
            using var response = await Client.SendAsync(request, TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
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

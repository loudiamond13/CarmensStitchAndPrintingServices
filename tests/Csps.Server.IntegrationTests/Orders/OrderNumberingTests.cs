using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

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

    private static string Number(int year, int sequence) =>
        $"ORD-{year.ToString(CultureInfo.InvariantCulture)}-{sequence.ToString("D4", CultureInfo.InvariantCulture)}";
}

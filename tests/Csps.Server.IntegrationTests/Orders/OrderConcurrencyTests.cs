using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>
/// ORD-08, SEC-07, T-07-17: two staff saving the same order with the same version never both win. The stored details are the
/// winner's, the loser's are never stored, and only the winner leaves an audit entry. Later plans add the child cases here.
/// </summary>
public sealed class OrderConcurrencyTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string StaleDetail = "This was changed by someone else. Reload and try again.";
    private const int Repetitions = 10;

    [Fact]
    public async Task TwoStaffSavingTheSameOrderWithTheSameVersionGiveExactlyOneWinnerEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, m1.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        for (var round = 1; round <= Repetitions; round++)
        {
            var opened = await OrderFixtures.ReadDetailAsync(client, m1.AccessToken, id);
            var byM1 = OrderFixtures.DetailsBodyFrom(opened);
            byM1["notes"] = $"First {round}";
            var byM2 = OrderFixtures.DetailsBodyFrom(opened);
            byM2["notes"] = $"Second {round}";

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => OrderFixtures.PutDetailsAsync(client, m1.AccessToken, id, byM1),
                () => OrderFixtures.PutDetailsAsync(client, m2.AccessToken, id, byM2));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");

            var (winner, loser, winnerNotes, winnerId) = firstResponse.StatusCode == HttpStatusCode.OK
                ? (firstResponse, secondResponse, $"First {round}", m1.UserId)
                : (secondResponse, firstResponse, $"Second {round}", m2.UserId);
            var refusal = await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken);
            refusal.GetProperty("code").GetString().ShouldBe("edit.stale", $"round {round}");
            refusal.GetProperty("detail").GetString().ShouldBe(StaleDetail, $"round {round}");

            var won = await ReadAsync(winner);
            won.GetProperty("notes").GetString().ShouldBe(winnerNotes, $"round {round}");
            var stored = await OrderFixtures.ReadDetailAsync(client, m1.AccessToken, id);
            stored.GetProperty("notes").GetString().ShouldBe(winnerNotes, $"round {round}");
            stored.GetProperty("version").GetString().ShouldBe(won.GetProperty("version").GetString(), $"round {round}");
            stored.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(winnerId, $"round {round}");

            await using var context = database.CreateContext();
            var changed = await context.AuditLog.CountAsync(
                row => row.Action == "order.changed" && row.TargetId == id.ToString("D"),
                TestContext.Current.CancellationToken);
            changed.ShouldBe(round, $"round {round}: one order.changed entry per round");
        }
    }

    [Fact]
    public async Task TwoEditsOfDifferentFieldsWithTheSameVersionStillGiveOneWinner()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, m1.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var byName = OrderFixtures.DetailsBodyFrom(created);
        byName["customerName"] = "Maria Santos";
        var byDate = OrderFixtures.DetailsBodyFrom(created);
        byDate["dueDate"] = OrderFixtures.Date(today.AddDays(30));

        var (first, second) = await ConcurrentRequests.SendTogetherAsync(
            () => OrderFixtures.PutDetailsAsync(client, m1.AccessToken, id, byName),
            () => OrderFixtures.PutDetailsAsync(client, m2.AccessToken, id, byDate));
        using var firstResponse = first;
        using var secondResponse = second;

        var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
        statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, string.Join(", ", statuses));
        statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, string.Join(", ", statuses));
        var stored = await OrderFixtures.ReadDetailAsync(client, m1.AccessToken, id);
        var nameWon = firstResponse.StatusCode == HttpStatusCode.OK;
        stored.GetProperty("customerName").GetString().ShouldBe(nameWon ? "Maria Santos" : "Juan Dela Cruz");
        stored.GetProperty("dueDate").GetString().ShouldBe(OrderFixtures.Date(nameWon ? today.AddDays(14) : today.AddDays(30)));
    }

    [Fact]
    public async Task ALaterSaveWithTheOriginalVersionIsRefusedAndStoresNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var original = OrderFixtures.DetailsBodyFrom(created);
        var firstEdit = OrderFixtures.DetailsBodyFrom(created);
        firstEdit["notes"] = "Accepted";
        using (var accepted = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, firstEdit))
        {
            accepted.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        original["notes"] = "Late";
        using var late = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, original);

        late.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var refusal = await ProblemJson.ReadAsync(late, TestContext.Current.CancellationToken);
        refusal.GetProperty("code").GetString().ShouldBe("edit.stale");
        (await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("notes").GetString().ShouldBe("Accepted");
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }
}

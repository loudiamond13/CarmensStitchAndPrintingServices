using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>
/// SEC-07, CEXP-02, T-06-26: two staff saving the same expense with the same version never both win. The stored values and the list's
/// period total are the winner's, and the loser's values are never stored.
/// </summary>
public sealed class CompanyExpenseConcurrencyTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string StaleDetail = "This was changed by someone else. Reload and try again.";
    private const int Repetitions = 10;

    [Fact]
    public async Task TwoManagersSavingTheSameExpenseWithTheSameVersionGiveExactlyOneWinnerEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var label = $"Race {Guid.NewGuid():N}";
        var start = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, m1.UserId, today);
        start["description"] = label;
        var created = await ExpenseFixtures.CreateAsync(client, m1.AccessToken, start);
        var id = created.GetProperty("id").GetGuid();

        for (var round = 1; round <= Repetitions; round++)
        {
            var opened = await ExpenseFixtures.ReadDetailAsync(client, m1.AccessToken, id);
            var byM1 = ExpenseFixtures.BodyFrom(opened);
            byM1["amount"] = 1000m + round;
            var byM2 = ExpenseFixtures.BodyFrom(opened);
            byM2["amount"] = 2000m + round;

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => ExpenseFixtures.PutAsync(client, m1.AccessToken, id, byM1),
                () => ExpenseFixtures.PutAsync(client, m2.AccessToken, id, byM2));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");

            var (winner, loser, winnerAmount, winnerId) = firstResponse.StatusCode == HttpStatusCode.OK
                ? (firstResponse, secondResponse, 1000m + round, m1.UserId)
                : (secondResponse, firstResponse, 2000m + round, m2.UserId);
            var refusal = await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken);
            refusal.GetProperty("code").GetString().ShouldBe("edit.stale", $"round {round}");
            refusal.GetProperty("detail").GetString().ShouldBe(StaleDetail, $"round {round}");

            var won = await ReadAsync(winner);
            won.GetProperty("amount").GetDecimal().ShouldBe(winnerAmount, $"round {round}");
            var stored = await ExpenseFixtures.ReadDetailAsync(client, m1.AccessToken, id);
            stored.GetProperty("amount").GetDecimal().ShouldBe(winnerAmount, $"round {round}");
            stored.GetProperty("version").GetString().ShouldBe(won.GetProperty("version").GetString(), $"round {round}");
            stored.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(winnerId, $"round {round}");
            var page = await ExpenseFixtures.ReadPageAsync(client, m1.AccessToken, $"q={label}");
            page.PeriodTotal.ShouldBe(winnerAmount, $"round {round}");
        }
    }

    [Fact]
    public async Task ALaterSaveWithTheOriginalVersionIsRefusedAndStoresNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var original = ExpenseFixtures.BodyFrom(created);
        var firstEdit = ExpenseFixtures.BodyFrom(created);
        firstEdit["amount"] = 700m;
        using (var accepted = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, firstEdit))
        {
            accepted.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        original["amount"] = 999m;
        using var late = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, original);

        late.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var refusal = await ProblemJson.ReadAsync(late, TestContext.Current.CancellationToken);
        refusal.GetProperty("code").GetString().ShouldBe("edit.stale");
        refusal.GetProperty("detail").GetString().ShouldBe(StaleDetail);
        var stored = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("amount").GetDecimal().ShouldBe(700m);
    }

    [Fact]
    public async Task TwoPayerChangesSentTogetherWithOneVersionGiveOneWinnerAndOneConflict()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var recorder = await TestSessions.StartAsync(factory, Roles.Manager);
        var payerA = await TestSessions.StartAsync(factory, Roles.Admin);
        var payerB = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, recorder.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, recorder.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var toA = ExpenseFixtures.BodyFrom(created);
        toA["paidByUserId"] = payerA.UserId;
        var toB = ExpenseFixtures.BodyFrom(created);
        toB["paidByUserId"] = payerB.UserId;

        var (first, second) = await ConcurrentRequests.SendTogetherAsync(
            () => ExpenseFixtures.PutAsync(client, recorder.AccessToken, id, toA),
            () => ExpenseFixtures.PutAsync(client, recorder.AccessToken, id, toB));
        using var firstResponse = first;
        using var secondResponse = second;

        var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
        statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, string.Join(", ", statuses));
        statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, string.Join(", ", statuses));
        var winnerPayer = firstResponse.StatusCode == HttpStatusCode.OK ? payerA.UserId : payerB.UserId;
        var stored = await ExpenseFixtures.ReadDetailAsync(client, recorder.AccessToken, id);
        stored.GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(winnerPayer);
        string.Create(CultureInfo.InvariantCulture, $"{stored.GetProperty("amount").GetDecimal():0.00}").ShouldBe("640.00");
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.Clone();
    }
}

using System.Net;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>MONEY-05, D-53, D-49, SEC-07, T-10-17: transfers sent at the same moment never spend the same money twice.</summary>
public sealed class MoneyTransferConcurrencyTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int Rounds = 3;
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task TwoTransfersThatTogetherExceedTheSendersBalanceGiveExactlyOneSuccess()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var today = await ExpenseFixtures.TodayAsync(factory);
        var orderNumber = 0;

        for (var round = 1; round <= Rounds; round++)
        {
            var sender = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
            var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
            var paolo = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Paolo", "Garcia");
            await MoneyFixtures.SeedPaymentAsync(database, sender.UserId, NextOrderNumber(ref orderNumber), 1000.00m, today, Now);

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => MoneyFixtures.PostTransferAsync(client, sender.AccessToken, liza.UserId, 600.00m, today),
                () => MoneyFixtures.PostTransferAsync(client, sender.AccessToken, paolo.UserId, 600.00m, today));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode }.Order().ToArray();
            statuses.ShouldBe([HttpStatusCode.Created, HttpStatusCode.BadRequest], $"round {round}");
            var (winner, loser, winnerPerson, loserPerson) = firstResponse.StatusCode == HttpStatusCode.Created
                ? (firstResponse, secondResponse, liza, paolo)
                : (secondResponse, firstResponse, paolo, liza);
            (await MoneyFixtures.ReadFieldErrorsAsync(loser, "amount")).ShouldBe(["You only have ₱400.00 on hand."], $"round {round}");
            winner.StatusCode.ShouldBe(HttpStatusCode.Created);
            (await MoneyFixtures.ReadBalanceAsync(client, sender.AccessToken)).ShouldBe(400.00m, $"round {round}");
            (await MoneyFixtures.ReadBalanceAsync(client, winnerPerson.AccessToken)).ShouldBe(600.00m, $"round {round}");
            (await MoneyFixtures.ReadBalanceAsync(client, loserPerson.AccessToken)).ShouldBe(0.00m, $"round {round}");
        }
    }

    [Fact]
    public async Task ATransferRacingAnExpenseThePayerAlsoPaysEndsInOneOfTheTwoSerialOutcomes()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var today = await ExpenseFixtures.TodayAsync(factory);
        var orderNumber = 0;

        for (var round = 1; round <= Rounds; round++)
        {
            var sender = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
            var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
            await MoneyFixtures.SeedPaymentAsync(database, sender.UserId, NextOrderNumber(ref orderNumber), 1000.00m, today, Now);
            var expense = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, sender.UserId, today);
            expense["amount"] = 500.00m;

            var (transfer, paid) = await ConcurrentRequests.SendTogetherAsync(
                () => MoneyFixtures.PostTransferAsync(client, sender.AccessToken, liza.UserId, 800.00m, today),
                () => ExpenseFixtures.PostAsync(client, sender.AccessToken, expense));
            using var transferResponse = transfer;
            using var expenseResponse = paid;

            expenseResponse.StatusCode.ShouldBe(HttpStatusCode.Created, $"round {round}: the expense is never refused");
            var senderBalance = await MoneyFixtures.ReadBalanceAsync(client, sender.AccessToken);
            var lizaBalance = await MoneyFixtures.ReadBalanceAsync(client, liza.AccessToken);
            if (transferResponse.StatusCode == HttpStatusCode.Created)
            {
                senderBalance.ShouldBe(-300.00m, $"round {round}: transfer recorded, then the expense");
                lizaBalance.ShouldBe(800.00m, $"round {round}");
            }
            else
            {
                transferResponse.StatusCode.ShouldBe(HttpStatusCode.BadRequest, $"round {round}");
                (await MoneyFixtures.ReadFieldErrorsAsync(transferResponse, "amount")).ShouldBe(["You only have ₱500.00 on hand."], $"round {round}");
                senderBalance.ShouldBe(500.00m, $"round {round}: transfer refused after the expense");
                lizaBalance.ShouldBe(0.00m, $"round {round}");
            }
        }
    }

    [Fact]
    public async Task TwoTransfersIntoALeaverWhoIsOwedLessThanBothGiveExactlyOneSuccess()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var today = await ExpenseFixtures.TodayAsync(factory);
        var orderNumber = 0;

        for (var round = 1; round <= Rounds; round++)
        {
            var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
            var leaver = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
            await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, NextOrderNumber(ref orderNumber), 2000.00m, today, Now);
            await MoneyFixtures.SeedCompanyExpenseAsync(database, leaver.UserId, leaver.UserId, 500.00m, today, Now);
            await MoneyFixtures.DeleteAccountAsync(database, leaver.UserId, Now);

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, leaver.UserId, 400.00m, today),
                () => MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, leaver.UserId, 400.00m, today));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode }.Order().ToArray();
            statuses.ShouldBe([HttpStatusCode.Created, HttpStatusCode.BadRequest], $"round {round}");
            var loser = firstResponse.StatusCode == HttpStatusCode.BadRequest ? firstResponse : secondResponse;
            (await MoneyFixtures.ReadFieldErrorsAsync(loser, "amount")).ShouldBe(["Jomar Santos is owed only ₱100.00. Enter that or less."], $"round {round}");
            (await ReadBalanceByIdAsync(factory, leaver.UserId)).ShouldBe(-100.00m, $"round {round}");
            (await MoneyFixtures.ReadBalanceAsync(client, carmen.AccessToken)).ShouldBe(1600.00m, $"round {round}");
        }
    }

    [Fact]
    public async Task ADoubleClickWithOneKeyAndOneBodyReleasedTogetherRecordsExactlyOneRow()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var today = await ExpenseFixtures.TodayAsync(factory);
        var sender = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        await MoneyFixtures.SeedPaymentAsync(database, sender.UserId, "ORD-2026-0001", 1000.00m, today, Now);
        var key = Guid.NewGuid();

        var (first, second) = await ConcurrentRequests.SendTogetherAsync(
            () => MoneyFixtures.PostTransferAsync(client, sender.AccessToken, liza.UserId, 300.00m, today, "Fabric", key),
            () => MoneyFixtures.PostTransferAsync(client, sender.AccessToken, liza.UserId, 300.00m, today, "Fabric", key));
        using var firstResponse = first;
        using var secondResponse = second;

        var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
        statuses.ShouldContain(HttpStatusCode.Created);
        statuses.ShouldAllBe(status => status == HttpStatusCode.Created || status == HttpStatusCode.Conflict);
        (await MoneyFixtures.ReadTransfersAsync(database)).ShouldHaveSingleItem();
        (await MoneyFixtures.ReadBalanceAsync(client, sender.AccessToken)).ShouldBe(700.00m);
    }

    private static string NextOrderNumber(ref int counter) => $"ORD-2026-{++counter:D4}";

    private static async Task<decimal> ReadBalanceByIdAsync(CspsApiFactory factory, Guid userId)
    {
        var scope = factory.Services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var reader = scope.ServiceProvider.GetRequiredService<IStaffMoneyReader>();
            var sums = await reader.GetSumsAsync([userId], TestContext.Current.CancellationToken);
            return sums.Single(row => row.UserId == userId).Balance();
        }
    }
}

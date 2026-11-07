using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>MONEY-04, MONEY-05, D-14, D-56: a staff member transfers part of their money on hand to a coworker, and both balances move exactly.</summary>
public sealed class MoneyTransferEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AManagerSendsTwoThousandPesosAndBothBalancesMoveByExactlyThatAmount()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 8450.00m, today, Now);
        (await MoneyFixtures.ReadBalanceAsync(client, carmen.AccessToken)).ShouldBe(8450.00m);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 2000.00m, today, "Cash for the fabric run");
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        var saved = document.RootElement;
        saved.GetProperty("senderBalance").GetDecimal().ShouldBe(6450.00m);
        var transfer = saved.GetProperty("transfer");
        transfer.GetProperty("id").GetGuid().ShouldNotBe(Guid.Empty);
        transfer.GetProperty("from").GetProperty("id").GetGuid().ShouldBe(carmen.UserId);
        transfer.GetProperty("from").GetProperty("name").GetString().ShouldBe("Carmen Reyes");
        transfer.GetProperty("to").GetProperty("id").GetGuid().ShouldBe(liza.UserId);
        transfer.GetProperty("to").GetProperty("name").GetString().ShouldBe("Liza Mercado");
        transfer.GetProperty("amount").GetDecimal().ShouldBe(2000.00m);
        transfer.GetProperty("transferDate").GetString().ShouldBe(today.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
        transfer.GetProperty("note").GetString().ShouldBe("Cash for the fabric run");
        transfer.GetProperty("isHandover").GetBoolean().ShouldBeFalse();
        transfer.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(carmen.UserId);
        transfer.GetProperty("isDeleted").GetBoolean().ShouldBeFalse();
        transfer.GetProperty("version").GetString().ShouldNotBeNullOrWhiteSpace();
        (await MoneyFixtures.ReadBalanceAsync(client, carmen.AccessToken)).ShouldBe(6450.00m);
        (await MoneyFixtures.ReadBalanceAsync(client, liza.AccessToken)).ShouldBe(2000.00m);
    }

    [Fact]
    public async Task AnAdminSenderGetsTheSame201Shape()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, liza.UserId, "ORD-2026-0001", 1200.00m, today, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, liza.AccessToken, carmen.UserId, 200.00m, today);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        document.RootElement.GetProperty("senderBalance").GetDecimal().ShouldBe(1000.00m);
        document.RootElement.GetProperty("transfer").GetProperty("from").GetProperty("id").GetGuid().ShouldBe(liza.UserId);
        document.RootElement.GetProperty("transfer").GetProperty("to").GetProperty("id").GetGuid().ShouldBe(carmen.UserId);
        document.RootElement.GetProperty("transfer").GetProperty("note").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task AnAnonymousPostGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await MoneyFixtures.PostTransferAsync(client, null, Guid.NewGuid(), 10.00m, new DateOnly(2026, 11, 4));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task TheAnswerCarriesTheSendersBalanceOnlyAndNeverTheRecipientsFigure()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 500.00m, today, Now);
        await MoneyFixtures.SeedPaymentAsync(database, liza.UserId, "ORD-2026-0002", 321.00m, today, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 100.00m, today);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        document.RootElement.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal).ShouldBe(["senderBalance", "transfer"]);
        document.RootElement.GetProperty("transfer").EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal).ShouldBe(
        [
            "amount", "deletedAtUtc", "deletedBy", "from", "id", "isDeleted", "isHandover", "note", "recordedAtUtc", "recordedBy", "to", "transferDate", "version",
        ]);
        text.ShouldNotContain("421.00");
    }
}

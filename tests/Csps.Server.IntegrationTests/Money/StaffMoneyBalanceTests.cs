using System.Net;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>MONEY-01, MONEY-08: a staff member reads their own server-computed money on hand, and no one else's.</summary>
public sealed class StaffMoneyBalanceTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task APaymentReceivedAndAnExpensePaidGiveTheExactBalance()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, liza.UserId, "ORD-2026-0001", 1500.00m, today, Now);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, liza.UserId, liza.UserId, 400.00m, today, Now);

        var body = await MoneyFixtures.ReadMeAsync(client, liza.AccessToken);

        body.GetProperty("userId").GetGuid().ShouldBe(liza.UserId);
        body.GetProperty("name").GetString().ShouldBe("Liza Mercado");
        body.GetProperty("balance").GetDecimal().ShouldBe(1100.00m);
        body.GetProperty("today").GetString().ShouldBe(today.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task AManagerAndAnAdminEachReadTheirOwnFigure()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 900.00m, today, Now);
        await MoneyFixtures.SeedPaymentAsync(database, liza.UserId, "ORD-2026-0002", 250.00m, today, Now);

        var forCarmen = await MoneyFixtures.ReadMeAsync(client, carmen.AccessToken);
        var forLiza = await MoneyFixtures.ReadMeAsync(client, liza.AccessToken);

        forCarmen.GetProperty("userId").GetGuid().ShouldBe(carmen.UserId);
        forCarmen.GetProperty("balance").GetDecimal().ShouldBe(900.00m);
        forLiza.GetProperty("userId").GetGuid().ShouldBe(liza.UserId);
        forLiza.GetProperty("balance").GetDecimal().ShouldBe(250.00m);
    }

    [Fact]
    public async Task ABrandNewStaffMemberReadsZero()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");

        (await MoneyFixtures.ReadBalanceAsync(client, liza.AccessToken)).ShouldBe(0.00m);
    }

    [Fact]
    public async Task AnExpenseLargerThanWhatThePayerHoldsReadsAsANegativeFigure()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, liza.UserId, "ORD-2026-0001", 100.00m, today, Now);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, liza.UserId, liza.UserId, 450.00m, today, Now);

        (await MoneyFixtures.ReadBalanceAsync(client, liza.AccessToken)).ShouldBe(-350.00m);
    }

    [Fact]
    public async Task DeletingTheOrderThatHeldAPaymentCanLeaveTheBalanceBelowZero()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        var order = await MoneyFixtures.SeedPaymentAsync(database, liza.UserId, "ORD-2026-0001", 1000.00m, today, Now);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, liza.UserId, liza.UserId, 400.00m, today, Now);
        (await MoneyFixtures.ReadBalanceAsync(client, liza.AccessToken)).ShouldBe(600.00m);

        await MoneyFixtures.DeleteOrderAsync(database, order, Now);

        (await MoneyFixtures.ReadBalanceAsync(client, liza.AccessToken)).ShouldBe(-400.00m);
    }

    [Fact]
    public async Task ChangingAnExpensesPayerMovesTheAmountExactlyFromOnePersonToTheOther()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var paolo = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Paolo", "Garcia");
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, carmen.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, liza.UserId, today));
        (await MoneyFixtures.ReadBalanceAsync(client, liza.AccessToken)).ShouldBe(-640.00m);
        (await MoneyFixtures.ReadBalanceAsync(client, paolo.AccessToken)).ShouldBe(0.00m);
        var body = ExpenseFixtures.BodyFrom(created);
        body["paidByUserId"] = paolo.UserId;

        using var response = await ExpenseFixtures.PutAsync(client, carmen.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await MoneyFixtures.ReadBalanceAsync(client, liza.AccessToken)).ShouldBe(0.00m);
        (await MoneyFixtures.ReadBalanceAsync(client, paolo.AccessToken)).ShouldBe(-640.00m);
    }

    [Fact]
    public async Task AHandoverRaisesTheRecipientAndLeavesTheManagerWhoRecordedItUntouched()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var jomar = await OrderSeeding.AddStaffAsync(database, "Jomar", Now, "Santos");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, jomar, "ORD-2026-0001", 800.00m, today, Now);
        await MoneySeeding.AddTransferAsync(database, new SeedTransfer(jomar, liza.UserId, 500.00m, today) { IsHandover = true, CreatedById = carmen.UserId }, Now);

        (await MoneyFixtures.ReadBalanceAsync(client, liza.AccessToken)).ShouldBe(500.00m);
        (await MoneyFixtures.ReadBalanceAsync(client, carmen.AccessToken)).ShouldBe(0.00m);
    }

    [Fact]
    public async Task AnAnonymousCallerGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await MoneyFixtures.GetMeAsync(client, null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task TheBodyCarriesOnlyTheUserTheNameTheBalanceAndToday()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");

        var body = await MoneyFixtures.ReadMeAsync(client, liza.AccessToken);

        body.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal).ShouldBe(["balance", "name", "today", "userId"]);
    }
}

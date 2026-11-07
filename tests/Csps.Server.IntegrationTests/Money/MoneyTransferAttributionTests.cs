using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>SEC-08, MONEY-04, T-10-16, T-10-20, CWE-639, CWE-915: the sender and the stamps come from the token and the clock, never from the request.</summary>
public sealed class MoneyTransferAttributionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AForgedSenderAndForgedStampsInTheBodyAreIgnored()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var paolo = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Paolo", "Garcia");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 1000.00m, today, Now);
        await MoneyFixtures.SeedPaymentAsync(database, paolo.UserId, "ORD-2026-0002", 1000.00m, today, Now);
        var body = MoneyFixtures.TransferBody(liza.UserId, 300.00m, today);
        body["fromUserId"] = paolo.UserId;
        body["createdById"] = paolo.UserId;
        body["createdAtUtc"] = "1999-01-01T00:00:00Z";
        body["updatedById"] = paolo.UserId;
        body["updatedAtUtc"] = "1999-01-01T00:00:00Z";
        body["isHandover"] = true;
        body["deletedAtUtc"] = "1999-01-01T00:00:00Z";
        body["deletedById"] = paolo.UserId;
        body["rowVersion"] = "AAAAAAAAAAE=";
        var before = TimeProvider.System.GetUtcNow();

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, body);

        var after = TimeProvider.System.GetUtcNow();
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        var row = (await MoneyFixtures.ReadTransfersAsync(database)).ShouldHaveSingleItem();
        row.FromUserId.ShouldBe(carmen.UserId);
        row.ToUserId.ShouldBe(liza.UserId);
        row.IsHandover.ShouldBeFalse();
        row.CreatedById.ShouldBe(carmen.UserId);
        row.CreatedAtUtc.ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
        row.UpdatedById.ShouldBeNull();
        row.UpdatedAtUtc.ShouldBeNull();
        row.DeletedById.ShouldBeNull();
        row.DeletedAtUtc.ShouldBeNull();
        row.IsDeleted.ShouldBeFalse();
        row.RowVersion.Length.ShouldBe(8);
        using var document = JsonDocument.Parse(text);
        var transfer = document.RootElement.GetProperty("transfer");
        transfer.GetProperty("from").GetProperty("id").GetGuid().ShouldBe(carmen.UserId);
        transfer.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(carmen.UserId);
        transfer.GetProperty("recordedAtUtc").GetDateTimeOffset().ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
        (await MoneyFixtures.ReadBalanceAsync(client, carmen.AccessToken)).ShouldBe(700.00m);
        (await MoneyFixtures.ReadBalanceAsync(client, paolo.AccessToken)).ShouldBe(1000.00m);
    }

    [Fact]
    public async Task ATransferRecordedByAnAdminIsStampedWithThatAdmin()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, liza.UserId, "ORD-2026-0001", 1000.00m, today, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, liza.AccessToken, carmen.UserId, 250.00m, today);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var row = (await MoneyFixtures.ReadTransfersAsync(database)).ShouldHaveSingleItem();
        row.FromUserId.ShouldBe(liza.UserId);
        row.CreatedById.ShouldBe(liza.UserId);
    }
}

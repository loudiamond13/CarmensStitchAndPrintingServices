using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>D-17, D-18, D-52, D-53, AUDIT-01: a Manager hands money held by former staff to an active coworker, and the hand-over is audited.</summary>
public sealed class MoneyHandoverEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AManagerHandsOverADeactivatedPersonsTwoThousandPesosAndOnlyThoseTwoBalancesMove()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, jomar.UserId, "ORD-2026-0001", 2000.00m, today, Now);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0002", 500.00m, today, Now);
        await MoneyFixtures.DeactivateAccountAsync(database, jomar.UserId);

        using var response = await MoneyFixtures.PostHandoverAsync(client, carmen.AccessToken, jomar.UserId, liza.UserId, 2000.00m, today);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        var saved = document.RootElement;
        saved.GetProperty("senderBalance").GetDecimal().ShouldBe(0.00m);
        var transfer = saved.GetProperty("transfer");
        transfer.GetProperty("isHandover").GetBoolean().ShouldBeTrue();
        transfer.GetProperty("from").GetProperty("id").GetGuid().ShouldBe(jomar.UserId);
        transfer.GetProperty("from").GetProperty("name").GetString().ShouldBe("Jomar Santos");
        transfer.GetProperty("to").GetProperty("id").GetGuid().ShouldBe(liza.UserId);
        transfer.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(carmen.UserId);
        transfer.GetProperty("amount").GetDecimal().ShouldBe(2000.00m);
        (await MoneyFixtures.ReadBalanceByIdAsync(factory, jomar.UserId)).ShouldBe(0.00m);
        (await MoneyFixtures.ReadBalanceAsync(client, liza.AccessToken)).ShouldBe(2000.00m);
        (await MoneyFixtures.ReadBalanceAsync(client, carmen.AccessToken)).ShouldBe(500.00m);
    }

    [Fact]
    public async Task AHandOverWritesOneAuditEntryWithTheManagerAsActorAndIdsOnly()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, jomar.UserId, "ORD-2026-0001", 2000.00m, today, Now);
        await MoneyFixtures.DeactivateAccountAsync(database, jomar.UserId);

        using var response = await MoneyFixtures.PostHandoverAsync(client, carmen.AccessToken, jomar.UserId, liza.UserId, 2000.00m, today);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        var id = JsonDocument.Parse(text).RootElement.GetProperty("transfer").GetProperty("id").GetGuid();
        var entry = (await MoneyFixtures.ReadAuditAsync(database, AuditActions.MoneyHandedOver)).ShouldHaveSingleItem();
        entry.ActorUserId.ShouldBe(carmen.UserId);
        entry.TargetType.ShouldBe("MoneyTransfer");
        entry.TargetId.ShouldBe(id.ToString("D"));
        entry.Detail.ShouldBe(
            $"from={jomar.UserId:D};to={liza.UserId:D};amount=2000.00;date={today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)};note=no");
    }

    [Fact]
    public async Task AnAdminPostingTheSameBodyGets403AndNothingIsRecorded()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Paolo", "Garcia");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, jomar.UserId, "ORD-2026-0001", 2000.00m, today, Now);
        await MoneyFixtures.DeactivateAccountAsync(database, jomar.UserId);

        using var response = await MoneyFixtures.PostHandoverAsync(client, admin.AccessToken, jomar.UserId, liza.UserId, 2000.00m, today);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await MoneyFixtures.ReadTransfersAsync(database)).ShouldBeEmpty();
        (await MoneyFixtures.ReadAuditAsync(database, AuditActions.MoneyHandedOver)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnAnonymousPostGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await MoneyFixtures.PostHandoverAsync(client, null, Guid.NewGuid(), Guid.NewGuid(), 10.00m, new DateOnly(2026, 11, 4));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}

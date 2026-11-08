using System.Globalization;
using System.Net;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>
/// MONEY-06, D-23, D-33, D-35, D-52, SEC-07, OD-19: a Manager deletes a wrong transfer with its version, both balances move back at
/// once, the audit log says who did it, and an Admin is refused.
/// </summary>
public sealed class MoneyTransferDeletionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AManagerDeletesATransferWithItsVersionAndBothBalancesMoveBackAtOnce()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 2000.00m, world.Today, "Cash for thread");
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Paolo.AccessToken)).ShouldBe(0.00m);
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Liza.AccessToken)).ShouldBe(2000.00m);

        using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Paolo.AccessToken)).ShouldBe(2000.00m);
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Liza.AccessToken)).ShouldBe(0.00m);
        var row = (await MoneyFixtures.ReadTransfersAsync(world.Database)).Single(transfer => transfer.Id == id);
        row.DeletedById.ShouldBe(world.Carmen.UserId);
        row.DeletedAtUtc.ShouldNotBeNull();
        row.Amount.ShouldBe(2000.00m);
    }

    [Fact]
    public async Task TheDeleteWritesOneAuditEntryWithTheManagerAsActorAndNoNoteText()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 2000.00m, world.Today, "Cash for thread");

        using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var entry = (await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferDeleted, world.Carmen.UserId)).ShouldHaveSingleItem();
        entry.ActorUserId.ShouldBe(world.Carmen.UserId);
        entry.TargetType.ShouldBe("MoneyTransfer");
        entry.TargetId.ShouldBe(id.ToString("D"));
        entry.Detail.ShouldBe(
            $"from={world.Paolo.UserId:D};to={world.Liza.UserId:D};amount=2000.00;date={world.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)};note=yes;recordedBy={world.Paolo.UserId:D}");
        entry.Detail.ShouldNotBeNull().ShouldNotContain("thread", Case.Insensitive);
    }

    [Fact]
    public async Task AnAdminGets403AndNothingChanges()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 500.00m, world.Today);

        using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Paolo.AccessToken, id, version);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await MoneyFixtures.ReadTransfersAsync(world.Database)).Single(transfer => transfer.Id == id).IsDeleted.ShouldBeFalse();
        (await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferDeleted, world.Paolo.UserId)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnAnonymousDeleteGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await MoneyFixtures.DeleteTransferAsync(client, null, Guid.NewGuid(), "AAAAAAAAB9E=");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private async Task<World> StartWorldAsync(decimal paoloMoney)
    {
        await database.ResetAsync();
        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var paolo = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Paolo", "Garcia");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, paolo.UserId, "ORD-2026-0001", paoloMoney, today, Now);
        return new World(factory, client, database, carmen, paolo, liza, today);
    }

    private sealed record World(
        CspsApiFactory Factory,
        HttpClient Client,
        CspsDatabase Database,
        StartedSession Carmen,
        StartedSession Paolo,
        StartedSession Liza,
        DateOnly Today) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await Factory.DisposeAsync();
        }
    }
}

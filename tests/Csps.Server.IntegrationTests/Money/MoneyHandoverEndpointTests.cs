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
        var entry = (await MoneyFixtures.ReadAuditAsync(database, AuditActions.MoneyHandedOver, carmen.UserId)).ShouldHaveSingleItem();
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
        (await MoneyFixtures.ReadAuditAsync(database, AuditActions.MoneyHandedOver, admin.UserId)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnAnonymousPostGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await MoneyFixtures.PostHandoverAsync(client, null, Guid.NewGuid(), Guid.NewGuid(), 10.00m, new DateOnly(2026, 11, 4));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AnAmountOneCentavoAboveWhatTheLeaverHoldsIsRefusedUnderAmountAndNothingIsWritten()
    {
        await using var world = await StartWorldAsync(leaverMoney: 2000.00m);

        using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, world.Liza.UserId, 2000.01m, world.Today);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "amount")).ShouldBe(["Jomar Santos only has ₱2,000.00 on hand."]);
        await NothingWasWrittenAsync(world.Carmen.UserId);
    }

    [Fact]
    public async Task ALeaverWithNothingOnHandIsToldSo()
    {
        await using var world = await StartWorldAsync(leaverMoney: 0m);

        using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, world.Liza.UserId, 10.00m, world.Today);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "amount")).ShouldBe(["Jomar Santos has nothing on hand to hand over."]);
        await NothingWasWrittenAsync(world.Carmen.UserId);
    }

    [Fact]
    public async Task ALeaverWhoIsOwedMoneyHasNothingOnHandToHandOver()
    {
        await using var world = await StartWorldAsync(leaverMoney: 0m);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, world.Jomar.UserId, world.Jomar.UserId, 500.00m, world.Today, Now);

        using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, world.Liza.UserId, 10.00m, world.Today);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "amount")).ShouldBe(["Jomar Santos has nothing on hand to hand over."]);
    }

    [Fact]
    public async Task AnActiveSenderIsRefusedUnderFromUserId()
    {
        await using var world = await StartWorldAsync(leaverMoney: 2000.00m, deactivate: false);

        using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, world.Liza.UserId, 100.00m, world.Today);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "fromUserId")).ShouldBe(["Only money held by former staff can be handed over."]);
        await NothingWasWrittenAsync(world.Carmen.UserId);
    }

    [Fact]
    public async Task AnUnknownIdAndTheLegacyHolderAreRefusedAsSendersWithTheSameNamelessLine()
    {
        await using var world = await StartWorldAsync(leaverMoney: 100.00m);

        foreach (var sender in new[] { Guid.NewGuid(), Csps.Domain.Identity.LegacyHolder.Id })
        {
            using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, sender, world.Liza.UserId, 10.00m, world.Today);

            (await MoneyFixtures.ReadFieldErrorsAsync(response, "fromUserId")).ShouldBe(["Only money held by former staff can be handed over."], sender.ToString());
        }
    }

    [Fact]
    public async Task AHandOverToTheLeaverIsRefusedAndNamesThem()
    {
        await using var world = await StartWorldAsync(leaverMoney: 2000.00m);

        using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, world.Jomar.UserId, 100.00m, world.Today);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "toUserId")).ShouldBe(["Choose someone other than Jomar Santos."]);
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("deleted")]
    public async Task AFormerStaffRecipientCannotReceiveAHandOverEvenWhenOwedMoney(string state)
    {
        await using var world = await StartWorldAsync(leaverMoney: 2000.00m);
        var ana = await MoneyFixtures.StartStaffAsync(world.Factory, database, Roles.Admin, "Ana", "Abad");
        await MoneyFixtures.SeedCompanyExpenseAsync(database, ana.UserId, ana.UserId, 300.00m, world.Today, Now);
        if (state == "deleted")
        {
            await MoneyFixtures.DeleteAccountAsync(database, ana.UserId, Now);
        }
        else
        {
            await MoneyFixtures.DeactivateAccountAsync(database, ana.UserId);
        }

        using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, ana.UserId, 100.00m, world.Today);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "toUserId")).ShouldBe(["Ana Abad can't receive transfers now. Choose someone else."]);
        await NothingWasWrittenAsync(world.Carmen.UserId);
    }

    [Fact]
    public async Task AnUnknownRecipientAndTheLegacyHolderAreRefusedWithTheNamelessLine()
    {
        await using var world = await StartWorldAsync(leaverMoney: 2000.00m);

        foreach (var recipient in new[] { Guid.NewGuid(), Csps.Domain.Identity.LegacyHolder.Id })
        {
            using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, recipient, 100.00m, world.Today);

            (await MoneyFixtures.ReadFieldErrorsAsync(response, "toUserId")).ShouldBe(["This person can't receive transfers now. Choose someone else."], recipient.ToString());
        }
    }

    [Theory]
    [InlineData("locked")]
    [InlineData("not-set-up")]
    public async Task AnActiveRecipientWhoIsLockedOrNotSetUpCanReceiveAHandOver(string state)
    {
        await using var world = await StartWorldAsync(leaverMoney: 2000.00m);
        if (state == "locked")
        {
            await MoneyFixtures.LockAccountAsync(database, world.Liza.UserId, Now);
        }
        else
        {
            await MoneyFixtures.MakeNotSetUpAsync(database, world.Liza.UserId);
        }

        using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, world.Liza.UserId, 100.00m, world.Today);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ADeletedLeaverWorksLikeADeactivatedOneAndIsMarkedFormerStaff()
    {
        await using var world = await StartWorldAsync(leaverMoney: 2000.00m, deactivate: false);
        await MoneyFixtures.DeleteAccountAsync(database, world.Jomar.UserId, Now);

        using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, world.Liza.UserId, 750.00m, world.Today);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        document.RootElement.GetProperty("senderBalance").GetDecimal().ShouldBe(1250.00m);
        document.RootElement.GetProperty("transfer").GetProperty("from").GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task AnEmptyBodyListsTheLeaverTheCoworkerTheAmountAndTheDateTogether()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");

        using var response = await MoneyFixtures.PostHandoverAsync(client, carmen.AccessToken, body: null);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await Csps.Server.IntegrationTests.Http.ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["amount", "fromUserId", "toUserId", "transferDate"]);
        ExpenseFixtures.FieldErrors(problem, "fromUserId").ShouldBe(["Choose whose money to hand over."]);
        ExpenseFixtures.FieldErrors(problem, "toUserId").ShouldBe(["Choose who got the cash."]);
        ExpenseFixtures.FieldErrors(problem, "amount").ShouldBe(["Enter the amount."]);
        ExpenseFixtures.FieldErrors(problem, "transferDate").ShouldBe(["Enter the transfer date."]);
    }

    [Fact]
    public async Task AHandOverWithANoteWritesNoteYesAndNeverTheNoteText()
    {
        await using var world = await StartWorldAsync(leaverMoney: 2000.00m);
        const string note = "Cash from the drawer, counted twice";

        using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, world.Liza.UserId, 300.00m, world.Today, note);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var entry = (await MoneyFixtures.ReadAuditAsync(database, AuditActions.MoneyHandedOver, world.Carmen.UserId)).ShouldHaveSingleItem();
        entry.Detail.ShouldNotBeNull().ShouldEndWith(";note=yes");
        entry.Detail.ShouldNotContain("Cash");
        entry.Detail.Length.ShouldBeLessThan(400);
        (await MoneyFixtures.ReadTransfersAsync(database)).ShouldHaveSingleItem().Note.ShouldBe(note);
    }

    [Fact]
    public async Task AForgedRecorderAndHandoverFlagInTheBodyAreIgnored()
    {
        await using var world = await StartWorldAsync(leaverMoney: 2000.00m);
        var body = MoneyFixtures.HandoverBody(world.Jomar.UserId, world.Liza.UserId, 100.00m, world.Today);
        body["createdById"] = world.Liza.UserId;
        body["isHandover"] = false;

        using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = (await MoneyFixtures.ReadTransfersAsync(database)).ShouldHaveSingleItem();
        stored.IsHandover.ShouldBeTrue();
        stored.CreatedById.ShouldBe(world.Carmen.UserId);
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("deleted")]
    [InlineData("locked")]
    public async Task AManagerWhoLeavesAfterSigningInCannotHandOverWithTheOldToken(string change)
    {
        await using var world = await StartWorldAsync(leaverMoney: 2000.00m);
        switch (change)
        {
            case "deactivated":
                await MoneyFixtures.DeactivateAccountAsync(database, world.Carmen.UserId);
                break;
            case "deleted":
                await MoneyFixtures.DeleteAccountAsync(database, world.Carmen.UserId, Now);
                break;
            default:
                await MoneyFixtures.LockAccountAsync(database, world.Carmen.UserId, Now);
                break;
        }

        using var response = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, world.Liza.UserId, 100.00m, world.Today);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await NothingWasWrittenAsync(world.Carmen.UserId);
    }

    [Fact]
    public async Task TheSameKeyAndBodyTwiceRecordsOneHandOverAndOneAuditEntry()
    {
        await using var world = await StartWorldAsync(leaverMoney: 2000.00m);
        var key = Guid.NewGuid();

        using var first = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, world.Liza.UserId, 400.00m, world.Today, "Fabric", key);
        using var second = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, world.Liza.UserId, 400.00m, world.Today, "Fabric", key);

        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.Headers.Contains(Csps.Server.IntegrationTests.Auth.AuthClient.ReplayedHeader).ShouldBeTrue();
        (await MoneyFixtures.ReadTransfersAsync(database)).ShouldHaveSingleItem();
        (await MoneyFixtures.ReadAuditAsync(database, AuditActions.MoneyHandedOver, world.Carmen.UserId)).ShouldHaveSingleItem();
    }

    [Fact]
    public async Task TheAuditScreenNamesTheLeaverAndTheCoworkerAndMarksADeletedLeaverFormerStaff()
    {
        await using var world = await StartWorldAsync(leaverMoney: 2000.00m, deactivate: false);
        await MoneyFixtures.DeleteAccountAsync(database, world.Jomar.UserId, Now);
        using var post = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, world.Jomar.UserId, world.Liza.UserId, 500.00m, world.Today, "Fabric");
        post.StatusCode.ShouldBe(HttpStatusCode.Created, await post.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        using var request = Csps.Server.IntegrationTests.Http.ApiRequests.Get("/api/v1/audit-log?pageSize=100", world.Carmen.AccessToken);
        using var response = await world.Client.SendAsync(request, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var item = document.RootElement.GetProperty("items").EnumerateArray().Single(entry =>
            entry.GetProperty("action").GetString() == AuditActions.MoneyHandedOver
            && entry.GetProperty("doneBy").GetProperty("person") is { ValueKind: JsonValueKind.Object } person
            && person.GetProperty("id").GetGuid() == world.Carmen.UserId);
        var lines = item.GetProperty("changes").EnumerateArray().ToList();
        lines.Select(line => line.GetProperty("field").GetString()).ShouldBe(["from", "to", "amount", "date"]);
        lines[0].GetProperty("toPerson").GetProperty("id").GetGuid().ShouldBe(world.Jomar.UserId);
        lines[0].GetProperty("toPerson").GetProperty("name").GetString().ShouldBe("Jomar Santos");
        lines[0].GetProperty("toPerson").GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
        lines[1].GetProperty("toPerson").GetProperty("id").GetGuid().ShouldBe(world.Liza.UserId);
        lines[1].GetProperty("toPerson").GetProperty("formerStaff").GetBoolean().ShouldBeFalse();
        lines[2].GetProperty("to").GetString().ShouldBe("500.00");
        text.ShouldNotContain("Fabric");
    }

    private async Task NothingWasWrittenAsync(Guid carmenId)
    {
        (await MoneyFixtures.ReadTransfersAsync(database)).ShouldBeEmpty();
        (await MoneyFixtures.ReadAuditAsync(database, AuditActions.MoneyHandedOver, carmenId)).ShouldBeEmpty();
    }

    // Carmen (Manager) signs in, Liza (Admin) is the coworker, Jomar (Admin) holds the money and leaves unless asked otherwise.
    private async Task<World> StartWorldAsync(decimal leaverMoney, bool deactivate = true)
    {
        await database.ResetAsync();
        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        if (leaverMoney > 0m)
        {
            await MoneyFixtures.SeedPaymentAsync(database, jomar.UserId, "ORD-2026-0001", leaverMoney, today, Now);
        }

        if (deactivate)
        {
            await MoneyFixtures.DeactivateAccountAsync(database, jomar.UserId);
        }

        return new World(factory, client, carmen, jomar, liza, today);
    }

    private sealed record World(
        CspsApiFactory Factory,
        HttpClient Client,
        StartedSession Carmen,
        StartedSession Jomar,
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

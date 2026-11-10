using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Auditing;
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
    public async Task ATransferWritesOneAuditEntryWithTheSenderAsActorAndNoNoteText()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 8450.00m, today, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 2000.00m, today, "Cash for the fabric run");
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        var id = JsonDocument.Parse(text).RootElement.GetProperty("transfer").GetProperty("id").GetGuid();
        var entry = (await MoneyFixtures.ReadAuditAsync(database, AuditActions.MoneyTransferAdded, carmen.UserId)).ShouldHaveSingleItem();
        entry.ActorUserId.ShouldBe(carmen.UserId);
        entry.TargetType.ShouldBe("MoneyTransfer");
        entry.TargetId.ShouldBe(id.ToString("D"));
        entry.Detail.ShouldBe(
            $"from={carmen.UserId:D};to={liza.UserId:D};amount=2000.00;date={today.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)};note=yes");
        entry.Detail.ShouldNotBeNull().ShouldNotContain("fabric", Case.Insensitive);
    }

    [Fact]
    public async Task ARefusedTransferWritesNoAuditEntry()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 3200.00m, today, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 3200.01m, today);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await MoneyFixtures.ReadAuditAsync(database, AuditActions.MoneyTransferAdded, carmen.UserId)).ShouldBeEmpty();
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

    [Fact]
    public async Task AnAmountOneCentavoAboveWhatTheSenderHoldsIsRefusedUnderAmount()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 3200.00m, today, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 3200.01m, today);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "amount")).ShouldBe(["You only have ₱3,200.00 on hand."]);
        (await MoneyFixtures.ReadTransfersAsync(database)).ShouldBeEmpty();
    }

    [Fact]
    public async Task SendingEverythingTheSenderHoldsIsAllowedAndLeavesZero()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 3200.00m, today, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 3200.00m, today);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await MoneyFixtures.ReadBalanceAsync(client, carmen.AccessToken)).ShouldBe(0.00m);
    }

    [Fact]
    public async Task ASenderWithNothingOnHandIsToldSo()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 10.00m, today);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "amount")).ShouldBe(["You have nothing on hand to transfer."]);
    }

    [Fact]
    public async Task ATransferToYourselfIsRefusedUnderToUserId()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 500.00m, today, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, carmen.UserId, 10.00m, today);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "toUserId")).ShouldBe(["Choose someone other than yourself."]);
    }

    [Fact]
    public async Task ACoworkerWhoIsLockedByAManagerCanReceive()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 500.00m, today, Now);
        await MoneyFixtures.LockAccountAsync(database, liza.UserId, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 100.00m, today);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ACoworkerWhoHasNotFinishedSetUpCanReceive()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 500.00m, today, Now);
        await MoneyFixtures.MakeNotSetUpAsync(database, liza.UserId);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 100.00m, today);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await MoneyFixtures.ReadBalanceAsync(client, liza.AccessToken)).ShouldBe(100.00m);
    }

    [Fact]
    public async Task ADeactivatedPersonAtZeroCannotReceiveAndIsNamed()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 500.00m, today, Now);
        await MoneyFixtures.DeactivateAccountAsync(database, jomar.UserId);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, jomar.UserId, 100.00m, today);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "toUserId")).ShouldBe(["Jomar Santos can't receive transfers now. Choose someone else."]);
    }

    [Fact]
    public async Task ADeletedPersonWithMoneyOnHandCannotReceive()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 500.00m, today, Now);
        await MoneyFixtures.SeedPaymentAsync(database, jomar.UserId, "ORD-2026-0002", 300.00m, today, Now);
        await MoneyFixtures.DeleteAccountAsync(database, jomar.UserId, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, jomar.UserId, 100.00m, today);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "toUserId")).ShouldBe(["Jomar Santos can't receive transfers now. Choose someone else."]);
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("deleted")]
    [InlineData("locked")]
    public async Task ASenderWhoLeavesAfterSigningInCannotMoveTheirMoneyWithTheOldToken(string change)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, liza.UserId, "ORD-2026-0001", 900.00m, today, Now);
        switch (change)
        {
            case "deactivated":
                await MoneyFixtures.DeactivateAccountAsync(database, liza.UserId);
                break;
            case "deleted":
                await MoneyFixtures.DeleteAccountAsync(database, liza.UserId, Now);
                break;
            default:
                await MoneyFixtures.LockAccountAsync(database, liza.UserId, Now);
                break;
        }

        using var response = await MoneyFixtures.PostTransferAsync(client, liza.AccessToken, carmen.UserId, 600.00m, today);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await MoneyFixtures.ReadTransfersAsync(database)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUnknownIdTheLegacyHolderAndAnAccountWithNoStaffRoleAreAllRefusedWithTheUnknownRecipientLine()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 500.00m, today, Now);
        var roleless = await OrderSeeding.AddStaffAsync(database, "Ana", Now, "Abad");

        foreach (var recipient in new[] { Guid.NewGuid(), Csps.Domain.Identity.LegacyHolder.Id, roleless })
        {
            using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, recipient, 100.00m, today);

            (await MoneyFixtures.ReadFieldErrorsAsync(response, "toUserId")).ShouldBe(["This person can't receive transfers now. Choose someone else."], recipient.ToString());
        }

        (await MoneyFixtures.ReadTransfersAsync(database)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AManagerCanSendUpToWhatALeaverIsOwedAndNotOneCentavoMore()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 2000.00m, today, Now);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, jomar.UserId, jomar.UserId, 500.00m, today, Now);
        await MoneyFixtures.DeleteAccountAsync(database, jomar.UserId, Now);

        using var tooMuch = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, jomar.UserId, 500.01m, today);
        using var exact = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, jomar.UserId, 500.00m, today);

        (await MoneyFixtures.ReadFieldErrorsAsync(tooMuch, "amount")).ShouldBe(["Jomar Santos is owed only ₱500.00. Enter that or less."]);
        exact.StatusCode.ShouldBe(HttpStatusCode.Created, await exact.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await MoneyFixtures.ReadTransfersAsync(database)).ShouldHaveSingleItem().Amount.ShouldBe(500.00m);
    }

    [Fact]
    public async Task AnAdminSendingMoreThanALeaverIsOwedIsToldToAskAManagerAndTheAnswerHasNoOwedFigure()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, liza.UserId, "ORD-2026-0001", 2000.00m, today, Now);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, jomar.UserId, jomar.UserId, 500.00m, today, Now);
        await MoneyFixtures.DeactivateAccountAsync(database, jomar.UserId);

        using var response = await MoneyFixtures.PostTransferAsync(client, liza.AccessToken, jomar.UserId, 500.01m, today);

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, text);
        text.ShouldContain("That's more than Jomar Santos is owed. Ask a Manager for the amount.");
        text.ShouldNotContain("500.00");
    }

    [Fact]
    public async Task ATransferDatedInThePastIsAcceptedAgainstTheBalanceNow()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 900.00m, today, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 400.00m, new DateOnly(2025, 1, 15));

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await MoneyFixtures.ReadTransfersAsync(database)).ShouldHaveSingleItem().TransferDate.ShouldBe(new DateOnly(2025, 1, 15));
        (await MoneyFixtures.ReadBalanceAsync(client, carmen.AccessToken)).ShouldBe(500.00m);
    }

    [Fact]
    public async Task ATransferDatedTomorrowIsRefusedUnderTransferDate()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 900.00m, today, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 100.00m, today.AddDays(1));

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "transferDate")).ShouldBe(["The transfer date can't be in the future."]);
    }

    [Fact]
    public async Task AnEmptyBodyListsTheRecipientTheAmountAndTheDateTogether()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, body: null);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await Csps.Server.IntegrationTests.Http.ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("money-transfers.invalid-request");
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["amount", "toUserId", "transferDate"]);
        ExpenseFixtures.FieldErrors(problem, "toUserId").ShouldBe(["Choose who got the cash."]);
        ExpenseFixtures.FieldErrors(problem, "amount").ShouldBe(["Enter the amount."]);
        ExpenseFixtures.FieldErrors(problem, "transferDate").ShouldBe(["Enter the transfer date."]);
    }

    [Fact]
    public async Task AnAnonymousPostWithNoBodyGets401NotAnErrorList()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await MoneyFixtures.PostTransferAsync(client, null, body: null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task TheCreatedAnswerHasNoLocationBecauseThereIsNoSingleTransferRoute()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 900.00m, today, Now);

        using var response = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 100.00m, today);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        response.Headers.Location.ShouldBeNull();
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
    }

    [Fact]
    public async Task TheSameKeyAndBodyTwiceRecordsOneTransferAndReplaysTheStored201()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 900.00m, today, Now);
        var key = Guid.NewGuid();

        using var first = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 400.00m, today, "Fabric", key);
        using var second = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 400.00m, today, "Fabric", key);

        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.Headers.Contains(Csps.Server.IntegrationTests.Auth.AuthClient.ReplayedHeader).ShouldBeTrue();
        (await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))
            .ShouldBe(await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await MoneyFixtures.ReadTransfersAsync(database)).ShouldHaveSingleItem();
        (await MoneyFixtures.ReadBalanceAsync(client, carmen.AccessToken)).ShouldBe(500.00m);
    }

    [Fact]
    public async Task TheSameKeyAndBodyTwiceWritesOneAuditEntry()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 900.00m, today, Now);
        var key = Guid.NewGuid();

        using var first = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 400.00m, today, "Fabric", key);
        using var second = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 400.00m, today, "Fabric", key);

        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.StatusCode.ShouldBe(HttpStatusCode.Created);
        (await MoneyFixtures.ReadAuditAsync(database, AuditActions.MoneyTransferAdded, carmen.UserId)).ShouldHaveSingleItem();
    }

    [Fact]
    public async Task TheSameKeyWithAnotherAmountIsRefusedWith422AndRecordsNothingMore()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 900.00m, today, Now);
        var key = Guid.NewGuid();

        using var first = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 400.00m, today, null, key);
        using var second = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 300.00m, today, null, key);

        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await MoneyFixtures.ReadTransfersAsync(database)).ShouldHaveSingleItem().Amount.ShouldBe(400.00m);
    }
}

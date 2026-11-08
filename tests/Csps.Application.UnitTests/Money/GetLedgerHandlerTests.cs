using Csps.Application.Auth;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Domain.Money;
using NSubstitute;

namespace Csps.Application.UnitTests.Money;

/// <summary>MONEY-02, D-41: the handler turns one read-port page into rows with a server-computed running balance after each one.</summary>
public sealed class GetLedgerHandlerTests
{
    private static readonly Guid CallerId = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly DateOnly Day = new(2026, 10, 5);
    private static readonly DateTimeOffset At = new(2026, 10, 5, 4, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task TheBalanceAfterTheFirstRowIsTheBalanceMinusTheSumOfTheNewerRows()
    {
        var reader = ReaderReturning(new LedgerPage([Row(LedgerEntryKind.PaymentReceived, 1000.00m), Row(LedgerEntryKind.CompanyExpensePaid, -300.00m), Row(LedgerEntryKind.PaymentReceived, 200.00m)], 23, 600.00m, 1500.00m));
        var handler = Handler(reader);

        var result = await handler.HandleAsync(null, new GetLedgerRequest(3, 10), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Items.Select(item => item.BalanceAfter).ShouldBe([900.00m, -100.00m, 200.00m]);
        result.Value.Balance.ShouldBe(1500.00m);
        result.Value.Total.ShouldBe(23);
        result.Value.Page.ShouldBe(3);
        result.Value.PageSize.ShouldBe(10);
        await reader.Received(1).GetLedgerPageAsync(CallerId, 3, 10, Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAdminsReadNeverAsksForDeletedTransfers()
    {
        var reader = ReaderReturning(new LedgerPage([], 0, 0.00m, 0.00m));
        var handler = Handler(reader, Roles.Admin);

        await handler.HandleAsync(null, new GetLedgerRequest(), TestContext.Current.CancellationToken);

        await reader.Received(1).GetLedgerPageAsync(CallerId, 1, 20, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AManagerWhoAsksForDeletedTransfersGetsThemFromTheReaderAndTheResponseSaysSo()
    {
        var deleted = new LedgerRowView(LedgerEntryKind.TransferOut, Guid.NewGuid(), Day, At, 0m, IsDeleted: true) { DeletedAmount = 300.00m };
        var reader = ReaderReturning(new LedgerPage([Row(LedgerEntryKind.PaymentReceived, 100.00m), deleted, Row(LedgerEntryKind.PaymentReceived, 50.00m)], 3, 0.00m, 150.00m));
        var handler = Handler(reader, Roles.Manager);

        var result = await handler.HandleAsync(null, new GetLedgerRequest(Deleted: true), TestContext.Current.CancellationToken);

        await reader.Received(1).GetLedgerPageAsync(CallerId, 1, 20, true, Arg.Any<CancellationToken>());
        result.Value.IncludesDeleted.ShouldBeTrue();
        result.Value.Items.Select(item => item.BalanceAfter).ShouldBe([150.00m, null, 50.00m]);
        result.Value.Items[1].IsDeleted.ShouldBeTrue();
        result.Value.Items[1].MoneyOut.ShouldBe(300.00m);
        result.Value.Items[1].MoneyIn.ShouldBeNull();
    }

    [Fact]
    public async Task AManagerWhoDoesNotAskGetsNoDeletedTransfers()
    {
        var reader = ReaderReturning(new LedgerPage([], 0, 0.00m, 0.00m));
        var handler = Handler(reader, Roles.Manager);

        var result = await handler.HandleAsync(null, new GetLedgerRequest(), TestContext.Current.CancellationToken);

        await reader.Received(1).GetLedgerPageAsync(CallerId, 1, 20, false, Arg.Any<CancellationToken>());
        result.Value.IncludesDeleted.ShouldBeFalse();
    }

    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(null)]
    public async Task AnAdminOrAnAccountWithNoRoleWhoAsksForDeletedTransfersIsRefusedBeforeAnyRead(string? role)
    {
        var reader = Substitute.For<IStaffMoneyReader>();
        var handler = Handler(reader, role);

        var result = await handler.HandleAsync(null, new GetLedgerRequest(Deleted: true), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.DeletedForbidden);
        result.Error.Message.ShouldBe("Only Managers can see deleted transfers.");
        await reader.DidNotReceive().GetLedgerPageAsync(Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EachKindGetsItsWireWordAndMoneyInOrMoneyOutNeverBoth()
    {
        var kinds = new[]
        {
            (LedgerEntryKind.PaymentReceived, 10.00m, "payment-received", true),
            (LedgerEntryKind.RefundHandedBack, -20.00m, "refund-handed-back", false),
            (LedgerEntryKind.TransferIn, 30.00m, "transfer-in", true),
            (LedgerEntryKind.TransferOut, -40.00m, "transfer-out", false),
            (LedgerEntryKind.CompanyExpensePaid, -50.00m, "company-expense", false),
            (LedgerEntryKind.OrderExpensePaid, -60.00m, "order-expense", false),
        };
        var reader = ReaderReturning(new LedgerPage([.. kinds.Select(entry => Row(entry.Item1, entry.Item2))], 6, 0.00m, 0.00m));
        var handler = Handler(reader);

        var result = await handler.HandleAsync(null, new GetLedgerRequest(), TestContext.Current.CancellationToken);

        result.Value.Items.Select(item => item.Kind).ShouldBe(kinds.Select(entry => entry.Item3));
        for (var index = 0; index < kinds.Length; index++)
        {
            var item = result.Value.Items[index];
            var amount = Math.Abs(kinds[index].Item2);
            item.MoneyIn.ShouldBe(kinds[index].Item4 ? amount : null);
            item.MoneyOut.ShouldBe(kinds[index].Item4 ? null : amount);
        }
    }

    [Fact]
    public void AnUnknownKindIsRefused()
    {
        var row = new LedgerRowView((LedgerEntryKind)99, Guid.NewGuid(), Day, At, 1.00m, IsDeleted: false);

        Should.Throw<ArgumentOutOfRangeException>(() => LedgerEntryResponse.Of(row, 1.00m));
    }

    [Fact]
    public void ADeletedRowWithNoFaceAmountShowsZeroAndNoBalance()
    {
        var row = new LedgerRowView(LedgerEntryKind.TransferOut, Guid.NewGuid(), Day, At, 0m, IsDeleted: true);

        var entry = LedgerEntryResponse.Of(row, null);

        entry.MoneyOut.ShouldBe(0m);
        entry.MoneyIn.ShouldBeNull();
        entry.BalanceAfter.ShouldBeNull();
    }

    [Fact]
    public async Task OnlyTransferRowsCarryATransferId()
    {
        var transfer = Row(LedgerEntryKind.TransferIn, 30.00m);
        var payment = Row(LedgerEntryKind.PaymentReceived, 10.00m);
        var handler = Handler(ReaderReturning(new LedgerPage([transfer, payment], 2, 0.00m, 40.00m)));

        var result = await handler.HandleAsync(null, new GetLedgerRequest(), TestContext.Current.CancellationToken);

        result.Value.Items[0].TransferId.ShouldBe(transfer.SourceId);
        result.Value.Items[1].TransferId.ShouldBeNull();
    }

    [Fact]
    public async Task ATokenWithNoUserIsRefusedAndNothingIsRead()
    {
        var reader = Substitute.For<IStaffMoneyReader>();
        var handler = Handler(reader, signedIn: false);

        var result = await handler.HandleAsync(null, new GetLedgerRequest(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await reader.DidNotReceive().GetLedgerPageAsync(Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAccountTheDirectoryDoesNotKnowIsRefusedAndNothingIsRead()
    {
        var reader = Substitute.For<IStaffMoneyReader>();
        var handler = Handler(reader, role: null, knownAccount: false);

        var result = await handler.HandleAsync(null, new GetLedgerRequest(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await reader.DidNotReceive().GetLedgerPageAsync(Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(0, 20, "page")]
    [InlineData(100001, 20, "page")]
    [InlineData(1, 0, "pageSize")]
    [InlineData(1, 101, "pageSize")]
    public async Task APageOrPageSizeOutOfRangeIsRefusedWithTheSharedWordsAndNothingIsRead(int page, int pageSize, string field)
    {
        var reader = Substitute.For<IStaffMoneyReader>();
        var handler = Handler(reader);

        var result = await handler.HandleAsync(null, new GetLedgerRequest(page, pageSize), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe([field]);
        result.Error.FieldErrors[field].ShouldBe([field == "page" ? "Use a page from 1 to 100000." : "Use a page size from 1 to 100."]);
        await reader.DidNotReceive().GetLedgerPageAsync(Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnotherPersonsLedgerIsNotServedByThisHandler()
    {
        var reader = Substitute.For<IStaffMoneyReader>();
        var handler = Handler(reader);

        var result = await handler.HandleAsync(Guid.NewGuid(), new GetLedgerRequest(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.Forbidden);
        await reader.DidNotReceive().GetLedgerPageAsync(Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AskingForTheCallersOwnIdWorksLikeAskingForNoId()
    {
        var reader = ReaderReturning(new LedgerPage([], 0, 0.00m, 0.00m));
        var handler = Handler(reader);

        var result = await handler.HandleAsync(CallerId, new GetLedgerRequest(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Items.ShouldBeEmpty();
        result.Value.Total.ShouldBe(0);
    }

    [Fact]
    public async Task ANullRequestIsRefused()
    {
        var handler = Handler(Substitute.For<IStaffMoneyReader>());

        await Should.ThrowAsync<ArgumentNullException>(() => handler.HandleAsync(null, null!, TestContext.Current.CancellationToken));
    }

    private static LedgerRowView Row(LedgerEntryKind kind, decimal signed) => new(kind, Guid.NewGuid(), Day, At, signed, IsDeleted: false);

    private static IStaffMoneyReader ReaderReturning(LedgerPage page)
    {
        var reader = Substitute.For<IStaffMoneyReader>();
        reader.GetLedgerPageAsync(Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<bool>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(page));
        return reader;
    }

    private static GetLedgerHandler Handler(IStaffMoneyReader reader, string? role = Roles.Admin, bool signedIn = true, bool knownAccount = true)
    {
        var caller = Substitute.For<IRequestContext>();
        caller.UserId.Returns(signedIn ? CallerId : (Guid?)null);
        var directory = Substitute.For<IStaffDirectory>();
        directory.GetStaffStateAsync(CallerId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<StaffState?>(knownAccount ? new StaffState(CallerId, "Liza Mercado", role, true, false, false, true) : null));
        return new GetLedgerHandler(reader, caller, directory, new GetLedgerRequestValidator());
    }
}

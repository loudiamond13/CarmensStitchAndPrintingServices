using Csps.Application.Auth;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Common;
using Csps.Domain.Money;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Money;

/// <summary>
/// MONEY-04, MONEY-05, D-53, D-56: the handler checks the form, takes the lock before it reads anything, lets the domain decide, saves
/// once and answers with the sender's new balance only.
/// </summary>
public sealed class CreateMoneyTransferHandlerTests
{
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");

    // 10:00 in Manila on Wednesday 2026-11-04.
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 11, 4);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid RecipientId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");

    [Fact]
    public async Task WithNoCallerTheSessionHasEndedAndNothingIsLockedOrRead()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await harness.MoneyLock.DidNotReceive().LockAsync(Arg.Any<CancellationToken>());
        harness.Transfers.DidNotReceiveWithAnyArgs().Add(default!);
    }

    [Fact]
    public async Task AFormThatBreaksAFieldRuleIsRefusedBeforeTheLockIsTaken()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(CreateMoneyTransferRequest.Empty, TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(MoneyRules.InvalidCode);
        result.Error.FieldErrors.ShouldNotBeNull().Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "toUserId", "transferDate"]);
        await harness.MoneyLock.DidNotReceive().LockAsync(Arg.Any<CancellationToken>());
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task TheLockIsTakenBeforeAnyPersonOrBalanceIsRead()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.MoneyLock.LockAsync(Arg.Any<CancellationToken>());
            harness.Staff.GetStaffStateAsync(CallerId, Arg.Any<CancellationToken>());
            harness.Staff.GetStaffStateAsync(RecipientId, Arg.Any<CancellationToken>());
            harness.Reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
            harness.Transfers.Add(Arg.Any<MoneyTransfer>());
            harness.Reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
        });
    }

    [Fact]
    public async Task ASavedTransferAnswersWithTheSendersNewBalanceAndTheTwoPeople()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var saved = result.Value;
        saved.SenderBalance.ShouldBe(800.00m);
        saved.Transfer.From.ShouldBe(new ActorRef(CallerId, "Carmen Reyes", false));
        saved.Transfer.To.ShouldBe(new ActorRef(RecipientId, "Liza Mercado", false));
        saved.Transfer.RecordedBy.ShouldBe(new ActorRef(CallerId, "Carmen Reyes", false));
        saved.Transfer.Amount.ShouldBe(200.00m);
        saved.Transfer.TransferDate.ShouldBe(Today);
        saved.Transfer.Note.ShouldBe("Fabric");
        saved.Transfer.IsHandover.ShouldBeFalse();
        saved.Transfer.IsDeleted.ShouldBeFalse();
        saved.Transfer.DeletedBy.ShouldBeNull();
        saved.Transfer.DeletedAtUtc.ShouldBeNull();
        harness.Transfers.Received(1).Add(Arg.Is<MoneyTransfer>(transfer => transfer.FromUserId == CallerId && transfer.ToUserId == RecipientId));
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task AFormerStaffRecipientIsMarkedFormerStaffInTheAnswerWhenDeleted()
    {
        var harness = new Harness(recipient: new StaffState(RecipientId, "Jomar Santos", Roles.Admin, false, false, true, true), recipientBalance: -500.00m);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Transfer.To.ShouldBe(new ActorRef(RecipientId, "Jomar Santos", true));
    }

    [Fact]
    public async Task ATokenWhoseAccountIsGoneIsRefusedAsASessionEnded()
    {
        var harness = new Harness(callerMissing: true);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Transfers.DidNotReceiveWithAnyArgs().Add(default!);
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("deleted")]
    [InlineData("locked")]
    [InlineData("no-role")]
    [InlineData("other-role")]
    public async Task ASenderWhoIsNoLongerCurrentStaffIsRefusedAsASessionEndedAndNothingIsSaved(string state)
    {
        var caller = state switch
        {
            "deactivated" => new StaffState(CallerId, "Carmen Reyes", Roles.Manager, false, false, false, true),
            "deleted" => new StaffState(CallerId, "Carmen Reyes", Roles.Manager, false, false, true, true),
            "locked" => new StaffState(CallerId, "Carmen Reyes", Roles.Manager, true, true, false, true),
            "no-role" => new StaffState(CallerId, "Carmen Reyes", null, true, false, false, true),
            _ => new StaffState(CallerId, "Carmen Reyes", "Visitor", true, false, false, true),
        };
        var harness = new Harness(callerState: caller);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Transfers.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnUnknownRecipientIsRefusedUnderToUserIdAndNothingIsSaved()
    {
        var harness = new Harness(recipientMissing: true);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        OnlyField(result, "toUserId", MoneyErrors.UnknownRecipientMessage);
        harness.Transfers.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnAccountWithNoStaffRoleIsRefusedWithTheUnknownRecipientLineAndNoName()
    {
        var harness = new Harness(recipient: new StaffState(RecipientId, "Ana Abad", null, true, false, false, true));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        OnlyField(result, "toUserId", MoneyErrors.UnknownRecipientMessage);
    }

    [Fact]
    public async Task AnAmountAboveTheBalanceIsRefusedByTheDomainAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid() with { Amount = 1000.01m }, TestContext.Current.CancellationToken);

        OnlyField(result, "amount", "You only have ₱1,000.00 on hand.");
        harness.Transfers.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AManagerCallerIsPassedToTheDomainSoTheLeaverFigureIsShown()
    {
        var harness = new Harness(
            recipient: new StaffState(RecipientId, "Jomar Santos", Roles.Admin, false, false, true, true),
            recipientBalance: -100.00m);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        OnlyField(result, "amount", "Jomar Santos is owed only ₱100.00. Enter that or less.");
    }

    [Fact]
    public async Task AnAdminCallerIsToldToAskAManagerAndSeesNoFigure()
    {
        var harness = new Harness(
            callerState: new StaffState(CallerId, "Liza Mercado", Roles.Admin, true, false, false, true),
            recipient: new StaffState(RecipientId, "Jomar Santos", Roles.Admin, false, false, true, true),
            recipientBalance: -100.00m);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        OnlyField(result, "amount", "That's more than Jomar Santos is owed. Ask a Manager for the amount.");
    }

    [Fact]
    public async Task ALockThatCannotBeHadAnswersBusyAndRecordsNothing()
    {
        var harness = new Harness();
        harness.MoneyLock.LockAsync(Arg.Any<CancellationToken>()).Returns(Task.FromException(new StaffMoneyBusyException()));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.Busy);
        harness.Transfers.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task ASaveThatLosesARaceOnceIsReadAgainAndDecidedAgain()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.MoneyLock.Received(2).LockAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ASaveThatLosesTheRaceTwiceAnswersBusy()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.Busy);
    }

    [Fact]
    public async Task ATransferToYourselfAsksTheReaderForOnePersonOnly()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid() with { ToUserId = CallerId }, TestContext.Current.CancellationToken);

        OnlyField(result, "toUserId", "Choose someone other than yourself.");
        await harness.Reader.Received(1).GetSumsAsync(
            Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 1 && ids.Contains(CallerId)), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void ADeletedTransferShowsWhoDeletedItAndWhen()
    {
        var sender = new MoneyParty(CallerId, "Carmen Reyes", MoneyPartyStatus.Active, 1000.00m);
        var recipient = new MoneyParty(RecipientId, "Liza Mercado", MoneyPartyStatus.Active, 0m);
        var transfer = MoneyTransfer.Record(sender, recipient, 100.00m, Today, null, callerIsManager: true, Today, Now).Value;
        transfer.SoftDelete(CallerId, Now.AddHours(1)).ShouldBeTrue();
        var carmen = new ActorRef(CallerId, "Carmen Reyes", false);

        var response = MoneyTransferResponse.Of(transfer, carmen, new ActorRef(RecipientId, "Liza Mercado", false), carmen, carmen);

        response.IsDeleted.ShouldBeTrue();
        response.DeletedBy.ShouldBe(carmen);
        response.DeletedAtUtc.ShouldBe(Now.AddHours(1));
    }

    [Fact]
    public void TheBusyExceptionCarriesTheBusyMessage()
    {
        new StaffMoneyBusyException().Message.ShouldBe(MoneyErrors.BusyMessage);
    }

    private static CreateMoneyTransferRequest Valid() => new(RecipientId, 200.00m, "2026-11-04", "Fabric");

    private static void OnlyField(Result<MoneyTransferSavedResponse> result, string field, string message)
    {
        result.IsFailure.ShouldBeTrue();
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields.Keys.ShouldBe([field]);
        fields[field].ShouldBe([message]);
    }

    private sealed class Harness
    {
        public Harness(
            bool noCaller = false,
            bool callerMissing = false,
            StaffState? callerState = null,
            bool recipientMissing = false,
            StaffState? recipient = null,
            decimal recipientBalance = 0m)
        {
            var theRecipientId = RecipientId;
            var caller = callerState ?? new StaffState(CallerId, "Carmen Reyes", Roles.Manager, true, false, false, true);
            var other = recipient ?? new StaffState(RecipientId, "Liza Mercado", Roles.Admin, true, false, false, true);

            Transfers = Substitute.For<IMoneyTransfers>();
            MoneyLock = Substitute.For<IStaffMoneyLock>();
            MoneyLock.LockAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            Staff = Substitute.For<IStaffDirectory>();
            Staff.GetStaffStateAsync(CallerId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<StaffState?>(callerMissing ? null : caller));
            Staff.GetStaffStateAsync(theRecipientId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<StaffState?>(recipientMissing ? null : other));
            Reader = Substitute.For<IStaffMoneyReader>();
            IReadOnlyList<StaffMoneySums> before =
            [
                new StaffMoneySums(CallerId, "Carmen Reyes", 1000.00m, 0m, 0m, 0m, 0m, 0m),
                new StaffMoneySums(theRecipientId, "Liza Mercado", Math.Max(recipientBalance, 0m), 0m, 0m, 0m, Math.Max(-recipientBalance, 0m), 0m),
            ];
            IReadOnlyList<StaffMoneySums> after = [new StaffMoneySums(CallerId, "Carmen Reyes", 1000.00m, 0m, 200.00m, 0m, 0m, 0m)];
            Reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(before), Task.FromResult(after));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new CreateMoneyTransferHandler(Transfers, Reader, MoneyLock, Staff, new FixedCalendar(), Unit, request, new CreateMoneyTransferRequestValidator());
        }

        public IMoneyTransfers Transfers { get; }

        public IStaffMoneyReader Reader { get; }

        public IStaffMoneyLock MoneyLock { get; }

        public IStaffDirectory Staff { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public CreateMoneyTransferHandler Handler { get; }
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}

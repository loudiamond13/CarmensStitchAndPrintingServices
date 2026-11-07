using Csps.Application.Auth;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Csps.Domain.Money;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Money;

/// <summary>
/// D-17, D-18, D-52, D-53, MONEY-06: the hand-over handler checks the form, takes the lock before it reads anything, re-reads the
/// Manager under it, lets the domain decide, writes one audit entry with ids only and answers with the leaver's new balance.
/// </summary>
public sealed class HandOverMoneyHandlerTests
{
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");

    // 10:00 in Manila on Wednesday 2026-11-04.
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid LeaverId = Guid.Parse("3a9f1d64-7e20-4c85-9b13-6d4e8f2a0c57");
    private static readonly Guid RecipientId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");

    [Fact]
    public async Task WithNoCallerTheSessionHasEndedAndNothingIsLockedOrRead()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await harness.MoneyLock.DidNotReceive().LockAsync(Arg.Any<CancellationToken>());
        harness.Audit.DidNotReceiveWithAnyArgs().Record(default!, default, default, default);
    }

    [Fact]
    public async Task AFormThatBreaksAFieldRuleIsRefusedBeforeTheLockIsTaken()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(CreateMoneyHandoverRequest.Empty, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(MoneyRules.InvalidCode);
        result.Error.FieldErrors.ShouldNotBeNull().Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "fromUserId", "toUserId", "transferDate"]);
        await harness.MoneyLock.DidNotReceive().LockAsync(Arg.Any<CancellationToken>());
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task TheLockIsTakenBeforeAnyPersonOrBalanceIsReadAndTheAuditEntryJoinsTheSave()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.MoneyLock.LockAsync(Arg.Any<CancellationToken>());
            harness.Staff.GetStaffStateAsync(CallerId, Arg.Any<CancellationToken>());
            harness.Staff.GetStaffStateAsync(LeaverId, Arg.Any<CancellationToken>());
            harness.Staff.GetStaffStateAsync(RecipientId, Arg.Any<CancellationToken>());
            harness.Reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
            harness.Transfers.Add(Arg.Any<MoneyTransfer>());
            harness.Audit.Record(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<string?>());
            harness.Reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
        });
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ASavedHandOverAnswersWithTheLeaversNewBalanceAndTheThreePeople()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        var saved = result.Value;
        saved.SenderBalance.ShouldBe(1700.00m);
        saved.Transfer.IsHandover.ShouldBeTrue();
        saved.Transfer.From.ShouldBe(new ActorRef(LeaverId, "Jomar Santos", false));
        saved.Transfer.To.ShouldBe(new ActorRef(RecipientId, "Liza Mercado", false));
        saved.Transfer.RecordedBy.ShouldBe(new ActorRef(CallerId, "Carmen Reyes", false));
        saved.Transfer.Amount.ShouldBe(300.00m);
        harness.Transfers.Received(1).Add(Arg.Is<MoneyTransfer>(transfer =>
            transfer.FromUserId == LeaverId && transfer.ToUserId == RecipientId && transfer.IsHandover));
    }

    [Fact]
    public async Task ADeletedLeaverIsMarkedFormerStaffInTheAnswer()
    {
        var harness = new Harness(leaver: new StaffState(LeaverId, "Jomar Santos", Roles.Admin, false, false, true, true));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.Value.Transfer.From.ShouldBe(new ActorRef(LeaverId, "Jomar Santos", true));
    }

    [Fact]
    public async Task TheAuditEntryHasTheHandOverActionTheTransferAsTargetAndIdsOnly()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        var id = result.Value.Transfer.Id.ToString("D");
        harness.Audit.Received(1).Record(
            AuditActions.MoneyHandedOver,
            "MoneyTransfer",
            id,
            $"from={LeaverId:D};to={RecipientId:D};amount=300.00;date=2026-11-04;note=yes");
    }

    [Fact]
    public async Task AHandOverWithNoNoteWritesNoteNo()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(Valid() with { Note = "   " }, TestContext.Current.CancellationToken);

        harness.Audit.Received(1).Record(
            AuditActions.MoneyHandedOver, "MoneyTransfer", Arg.Any<string?>(), Arg.Is<string?>(detail => detail!.EndsWith(";note=no", StringComparison.Ordinal)));
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
    [InlineData("admin")]
    [InlineData("other-role")]
    public async Task AManagerWhoIsNoLongerAnActiveManagerIsRefusedUnderTheLockAndNothingIsSaved(string state)
    {
        var caller = state switch
        {
            "deactivated" => new StaffState(CallerId, "Carmen Reyes", Roles.Manager, false, false, false, true),
            "deleted" => new StaffState(CallerId, "Carmen Reyes", Roles.Manager, false, false, true, true),
            "locked" => new StaffState(CallerId, "Carmen Reyes", Roles.Manager, true, true, false, true),
            "no-role" => new StaffState(CallerId, "Carmen Reyes", null, true, false, false, true),
            "admin" => new StaffState(CallerId, "Carmen Reyes", Roles.Admin, true, false, false, true),
            _ => new StaffState(CallerId, "Carmen Reyes", "Visitor", true, false, false, true),
        };
        var harness = new Harness(callerState: caller);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await harness.MoneyLock.Received(1).LockAsync(Arg.Any<CancellationToken>());
        harness.Transfers.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Audit.DidNotReceiveWithAnyArgs().Record(default!, default, default, default);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnActiveSenderIsRefusedUnderFromUserIdAndNothingIsWritten()
    {
        var harness = new Harness(leaver: new StaffState(LeaverId, "Jomar Santos", Roles.Admin, true, false, false, true));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        OnlyField(result, "fromUserId", MoneyRules.HandoverSenderActive);
        harness.Transfers.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Audit.DidNotReceiveWithAnyArgs().Record(default!, default, default, default);
    }

    [Fact]
    public async Task AnUnknownSenderIsRefusedWithTheSameLineAndNoName()
    {
        var harness = new Harness(leaverMissing: true);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        OnlyField(result, "fromUserId", MoneyRules.HandoverSenderActive);
    }

    [Fact]
    public async Task AnUnknownRecipientIsRefusedUnderToUserIdWithTheNamelessLine()
    {
        var harness = new Harness(recipientMissing: true);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        OnlyField(result, "toUserId", MoneyErrors.UnknownRecipientMessage);
        harness.Transfers.DidNotReceiveWithAnyArgs().Add(default!);
    }

    [Fact]
    public async Task TheLegacyHolderAndAnAccountWithNoStaffRoleAreRefusedAsRecipientsWithoutTheirName()
    {
        var legacy = new Harness(recipient: new StaffState(LegacyHolder.Id, "Legacy / unassigned", Roles.Admin, true, false, false, true));
        var roleless = new Harness(recipient: new StaffState(RecipientId, "Ana Abad", null, true, false, false, true));

        OnlyField(await legacy.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken), "toUserId", MoneyErrors.UnknownRecipientMessage);
        OnlyField(await roleless.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken), "toUserId", MoneyErrors.UnknownRecipientMessage);
    }

    [Fact]
    public async Task AFormerStaffRecipientIsRefusedWithTheNamedLine()
    {
        var harness = new Harness(recipient: new StaffState(RecipientId, "Ana Abad", Roles.Admin, false, false, true, true));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        OnlyField(result, "toUserId", "Ana Abad can't receive transfers now. Choose someone else.");
    }

    [Fact]
    public async Task AnAmountAboveWhatTheLeaverHoldsIsRefusedByTheDomainAndNothingIsWritten()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid() with { Amount = 2000.01m }, TestContext.Current.CancellationToken);

        OnlyField(result, "amount", "Jomar Santos only has ₱2,000.00 on hand.");
        harness.Transfers.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Audit.DidNotReceiveWithAnyArgs().Record(default!, default, default, default);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AHandOverToTheLeaverAsksTheReaderForOnePersonOnly()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid() with { ToUserId = LeaverId }, TestContext.Current.CancellationToken);

        OnlyField(result, "toUserId", "Choose someone other than Jomar Santos.");
        await harness.Reader.Received(1).GetSumsAsync(
            Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 1 && ids.Contains(LeaverId)), Arg.Any<CancellationToken>());
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

    private static CreateMoneyHandoverRequest Valid() => new(LeaverId, RecipientId, 300.00m, "2026-11-04", "Fabric");

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
            bool leaverMissing = false,
            StaffState? leaver = null,
            bool recipientMissing = false,
            StaffState? recipient = null)
        {
            var caller = callerState ?? new StaffState(CallerId, "Carmen Reyes", Roles.Manager, true, false, false, true);
            var former = leaver ?? new StaffState(LeaverId, "Jomar Santos", Roles.Admin, false, false, false, true);
            var other = recipient ?? new StaffState(RecipientId, "Liza Mercado", Roles.Admin, true, false, false, true);

            Transfers = Substitute.For<IMoneyTransfers>();
            MoneyLock = Substitute.For<IStaffMoneyLock>();
            MoneyLock.LockAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            Audit = Substitute.For<IAuditTrail>();
            Staff = Substitute.For<IStaffDirectory>();
            Staff.GetStaffStateAsync(CallerId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<StaffState?>(callerMissing ? null : caller));
            Staff.GetStaffStateAsync(LeaverId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<StaffState?>(leaverMissing ? null : former));
            Staff.GetStaffStateAsync(RecipientId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<StaffState?>(recipientMissing ? null : other));
            Reader = Substitute.For<IStaffMoneyReader>();
            IReadOnlyList<StaffMoneySums> before =
            [
                new StaffMoneySums(LeaverId, "Jomar Santos", 2000.00m, 0m, 0m, 0m, 0m, 0m),
                new StaffMoneySums(RecipientId, "Liza Mercado", 0m, 0m, 0m, 0m, 0m, 0m),
            ];
            IReadOnlyList<StaffMoneySums> after = [new StaffMoneySums(LeaverId, "Jomar Santos", 2000.00m, 0m, 300.00m, 0m, 0m, 0m)];
            Reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(before), Task.FromResult(after));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new HandOverMoneyHandler(Transfers, Reader, MoneyLock, Staff, new FixedCalendar(), Audit, Unit, request, new CreateMoneyHandoverRequestValidator());
        }

        public IMoneyTransfers Transfers { get; }

        public IStaffMoneyReader Reader { get; }

        public IStaffMoneyLock MoneyLock { get; }

        public IStaffDirectory Staff { get; }

        public IAuditTrail Audit { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public HandOverMoneyHandler Handler { get; }
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}

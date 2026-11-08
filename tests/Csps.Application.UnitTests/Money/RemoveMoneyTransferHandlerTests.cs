using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Money;
using NSubstitute;

namespace Csps.Application.UnitTests.Money;

/// <summary>
/// MONEY-06, D-24, D-25, D-52: a permanent remove takes the staff-money lock first, refuses a transfer that is not deleted, writes
/// the full record to the audit log before the row goes, and does both in one save.
/// </summary>
public sealed class RemoveMoneyTransferHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Day = new(2026, 11, 4);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid PaoloId = Guid.Parse("3a9f1d64-7e20-4c85-9b13-6d4e8f2a0c57");
    private static readonly Guid LizaId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");

    [Fact]
    public async Task WithNoCallerTheSessionHasEndedAndNothingIsLockedOrRead()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await harness.MoneyLock.DidNotReceive().LockAsync(Arg.Any<CancellationToken>());
        harness.Transfers.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task TheLockComesFirstThenTheReadThenTheAuditEntryThenTheRemoveAndOneSave()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.MoneyLock.LockAsync(Arg.Any<CancellationToken>());
            harness.Transfers.FindAsync(harness.Transfer.Id, true, Arg.Any<CancellationToken>());
            harness.Audit.Record(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<string?>());
            harness.Transfers.Remove(harness.Transfer);
        });
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task TheAuditEntryHoldsTheFullRecordAsIdsAndValuesAndNoNoteText()
    {
        var harness = new Harness(note: "Cash for Aling Nena");

        await harness.Handler.HandleAsync(harness.Transfer.Id, TestContext.Current.CancellationToken);

        harness.Audit.ReceivedCalls().Single().GetArguments().ShouldBe(
        [
            AuditActions.MoneyTransferPermanentlyDeleted,
            "MoneyTransfer",
            harness.Transfer.Id.ToString("D"),
            $"from={PaoloId:D};to={LizaId:D};amount=2000.00;date=2026-11-04;note=yes;recordedBy={PaoloId:D};deletedBy={CallerId:D};deletedAt=2026-11-04T02:00:00Z",
        ]);
    }

    [Fact]
    public async Task ALiveTransferIsRefusedWithDeleteItFirstAndNothingIsWrittenOrRemoved()
    {
        var harness = new Harness(deleted: false);

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(MoneyRules.NotDeletedCode);
        result.Error.Message.ShouldBe("Delete the transfer first.");
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.DidNotReceiveWithAnyArgs().Record(default!, default, default, default);
        harness.Transfers.DidNotReceiveWithAnyArgs().Remove(default!);
    }

    [Fact]
    public async Task AnUnknownTransferIsA404AndNothingIsWritten()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.TransferNotFound);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.DidNotReceiveWithAnyArgs().Record(default!, default, default, default);
    }

    [Fact]
    public async Task ALockThatCannotBeHadAnswersBusyAndWritesNothing()
    {
        var harness = new Harness();
        harness.MoneyLock.LockAsync(Arg.Any<CancellationToken>()).Returns(Task.FromException(new StaffMoneyBusyException()));

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.Busy);
        harness.Unit.Saves.ShouldBe(0);
        harness.Transfers.DidNotReceiveWithAnyArgs().Remove(default!);
    }

    [Fact]
    public async Task ALostRaceIsReadAgainAndDecidedAgainAs404WhenTheOtherRemoveWon()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();
        harness.Transfers.FindAsync(harness.Transfer.Id, true, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<MoneyTransfer?>(harness.Transfer), Task.FromResult<MoneyTransfer?>(null));

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.TransferNotFound);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task TwoLostRacesAnswerBusy()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.Busy);
        harness.Unit.Commits.ShouldBe(0);
    }

    private static void SetPrivate(MoneyTransfer transfer, string property, object? value) =>
        typeof(MoneyTransfer).GetProperty(property, BindingFlags.Instance | BindingFlags.Public)!.SetValue(transfer, value);

    private sealed class Harness
    {
        public Harness(bool noCaller = false, string? note = "Cash for thread", bool deleted = true)
        {
            var paolo = new MoneyParty(PaoloId, "Paolo Garcia", MoneyPartyStatus.Active, 2000.00m);
            var liza = new MoneyParty(LizaId, "Liza Mercado", MoneyPartyStatus.Active, 0m);
            Transfer = MoneyTransfer.Record(paolo, liza, 2000.00m, Day, note, callerIsManager: false, Day, Now).Value;
            SetPrivate(Transfer, nameof(MoneyTransfer.CreatedById), PaoloId);
            if (deleted)
            {
                Transfer.SoftDelete(CallerId, Now);
            }

            Transfers = Substitute.For<IMoneyTransfers>();
            Transfers.FindAsync(Transfer.Id, true, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<MoneyTransfer?>(Transfer));
            MoneyLock = Substitute.For<IStaffMoneyLock>();
            MoneyLock.LockAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            Audit = Substitute.For<IAuditTrail>();
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new RemoveMoneyTransferHandler(Transfers, MoneyLock, Audit, Unit, request);
        }

        public MoneyTransfer Transfer { get; }

        public IMoneyTransfers Transfers { get; }

        public IStaffMoneyLock MoneyLock { get; }

        public IAuditTrail Audit { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RemoveMoneyTransferHandler Handler { get; }
    }
}

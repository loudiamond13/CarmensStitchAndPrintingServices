using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Money;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Money;

/// <summary>
/// MONEY-06, D-23, D-35, D-52, D-53, SEC-07: a delete checks the version before any lookup, takes no lock, marks the
/// Manager and the clock, writes one audit entry in the same save, and refuses a stale, missing or already deleted transfer.
/// </summary>
public sealed class DeleteMoneyTransferHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Day = new(2026, 11, 4);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid PaoloId = Guid.Parse("3a9f1d64-7e20-4c85-9b13-6d4e8f2a0c57");
    private static readonly Guid LizaId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");
    private static readonly byte[] StoredVersion = [0, 0, 0, 0, 0, 0, 0x07, 0xD1];

    [Fact]
    public async Task WithNoCallerTheSessionHasEndedAndNothingIsRead()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, harness.VersionText, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Transfers.ReceivedCalls().ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("abc")]
    [InlineData("AAAAAAAAB9E")]
    [InlineData("AAAAAAAAAAAAB9E=")]
    public async Task AMissingOrMalformedVersionIs400UnderVersionBeforeAnyLookup(string? version)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, version, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(MoneyRules.InvalidCode);
        result.Error.FieldErrors.ShouldNotBeNull()["version"].ShouldBe([RowVersions.InvalidMessage]);
        harness.Transfers.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task TheTransferIsReadThenTheAuditEntryJoinsTheOneSave()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, harness.VersionText, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.Transfers.FindAsync(harness.Transfer.Id, false, Arg.Any<CancellationToken>());
            harness.Audit.Record(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<string?>());
        });
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task ALiveTransferIsMarkedWithTheCallerAndTheClockAndOneAuditEntryIsWritten()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, harness.VersionText, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Transfer.IsDeleted.ShouldBeTrue();
        harness.Transfer.DeletedById.ShouldBe(CallerId);
        harness.Transfer.DeletedAtUtc.ShouldBe(harness.Time.GetUtcNow());
        var call = harness.Audit.ReceivedCalls().Single();
        call.GetArguments().ShouldBe(
        [
            AuditActions.MoneyTransferDeleted,
            "MoneyTransfer",
            harness.Transfer.Id.ToString("D"),
            $"from={PaoloId:D};to={LizaId:D};amount=2000.00;date=2026-11-04;note=yes;recordedBy={PaoloId:D}",
        ]);
    }

    [Fact]
    public async Task TheAuditDetailHoldsNoNoteText()
    {
        var harness = new Harness(note: "Cash for Aling Nena");

        await harness.Handler.HandleAsync(harness.Transfer.Id, harness.VersionText, TestContext.Current.CancellationToken);

        var detail = (string?)harness.Audit.ReceivedCalls().Single().GetArguments()[3];
        detail.ShouldNotBeNull().ShouldNotContain("Nena", Case.Insensitive);
        detail.ShouldContain("note=yes");
    }

    [Fact]
    public async Task AVersionWithPlusAndSlashInItsTextMatchesTheStoredBytes()
    {
        byte[] stored = [0xFB, 0xFF, 0xBF, 0xFB, 0xFF, 0xBF, 0xFB, 0xFF];
        var harness = new Harness(storedVersion: stored);
        var text = RowVersions.ToText(stored);
        text.ShouldContain('+');
        text.ShouldContain('/');

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, text, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Transfer.IsDeleted.ShouldBeTrue();
    }

    [Fact]
    public async Task AnUnknownTransferIsA404AndNothingIsWritten()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), harness.VersionText, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.TransferNotFound);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.DidNotReceiveWithAnyArgs().Record(default!, default, default, default);
    }

    [Fact]
    public async Task AStaleVersionIsA409AndNothingChanges()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, RowVersions.ToText([0, 0, 0, 0, 0, 0, 0x07, 0xD2]), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Transfer.IsDeleted.ShouldBeFalse();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.DidNotReceiveWithAnyArgs().Record(default!, default, default, default);
    }

    [Fact]
    public async Task ATransferThatIsAlreadyMarkedDeletedInMemoryIsA404AndNothingIsWritten()
    {
        var harness = new Harness();
        harness.Transfer.SoftDelete(Guid.NewGuid(), Now);

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, harness.VersionText, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.TransferNotFound);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.DidNotReceiveWithAnyArgs().Record(default!, default, default, default);
    }

    [Fact]
    public async Task ALostRaceIsReadAgainAndDecidedAgainAs404WhenTheOtherDeleteWon()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();
        harness.Transfers.FindAsync(harness.Transfer.Id, false, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<MoneyTransfer?>(harness.Transfer), Task.FromResult<MoneyTransfer?>(null));

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, harness.VersionText, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.TransferNotFound);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task TwoLostRacesAnswerBusy()
    {
        var harness = new Harness(freshRowEachRead: true);
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Transfer.Id, harness.VersionText, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.Busy);
        harness.Unit.Commits.ShouldBe(0);
    }

    private static void SetPrivate(MoneyTransfer transfer, string property, object? value) =>
        typeof(MoneyTransfer).GetProperty(property, BindingFlags.Instance | BindingFlags.Public)!.SetValue(transfer, value);

    private sealed class Harness
    {
        public Harness(bool noCaller = false, string? note = "Cash for thread", byte[]? storedVersion = null, bool freshRowEachRead = false)
        {
            var paolo = new MoneyParty(PaoloId, "Paolo Garcia", MoneyPartyStatus.Active, 2000.00m);
            var liza = new MoneyParty(LizaId, "Liza Mercado", MoneyPartyStatus.Active, 0m);
            Transfer = MoneyTransfer.Record(paolo, liza, 2000.00m, Day, note, callerIsManager: false, Day, Now).Value;
            SetPrivate(Transfer, nameof(MoneyTransfer.RowVersion), storedVersion ?? StoredVersion);
            SetPrivate(Transfer, nameof(MoneyTransfer.CreatedById), PaoloId);
            VersionText = RowVersions.ToText(Transfer.RowVersion);

            Transfers = Substitute.For<IMoneyTransfers>();
            Transfers.FindAsync(Transfer.Id, false, Arg.Any<CancellationToken>()).Returns(_ =>
            {
                // A second pass reloads what is in the database, which is the live row again after a failed save.
                if (freshRowEachRead && Transfer.IsDeleted)
                {
                    SetPrivate(Transfer, nameof(MoneyTransfer.DeletedAtUtc), null);
                    SetPrivate(Transfer, nameof(MoneyTransfer.DeletedById), null);
                }

                return Task.FromResult<MoneyTransfer?>(Transfer);
            });
            Audit = Substitute.For<IAuditTrail>();
            Time = new FakeTimeProvider(Now.AddHours(1));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new DeleteMoneyTransferHandler(Transfers, Audit, Unit, request, Time);
        }

        public MoneyTransfer Transfer { get; }

        public string VersionText { get; }

        public IMoneyTransfers Transfers { get; }

        public IAuditTrail Audit { get; }

        public FakeTimeProvider Time { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public DeleteMoneyTransferHandler Handler { get; }
    }
}

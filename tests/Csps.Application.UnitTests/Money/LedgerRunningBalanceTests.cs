using Csps.Application.Money;
using Csps.Domain.Money;

namespace Csps.Application.UnitTests.Money;

/// <summary>D-41: the running balance after each ledger row is worked out by one pure walk down the page.</summary>
public sealed class LedgerRunningBalanceTests
{
    private static readonly DateOnly Day = new(2026, 10, 5);
    private static readonly DateTimeOffset At = new(2026, 10, 5, 4, 0, 0, TimeSpan.Zero);

    [Fact]
    public void EachNextBalanceIsThePreviousBalanceMinusThePreviousRowsSignedAmount()
    {
        IReadOnlyList<LedgerRowView> rows = [Row(1000.00m), Row(-300.00m), Row(200.00m)];

        var balances = LedgerRunningBalance.Apply(rows, 900.00m);

        balances.ShouldBe([900.00m, -100.00m, 200.00m]);
    }

    [Fact]
    public void ADeletedRowGetsNoBalanceAndLeavesTheRunningValueUnchangedForTheRowsAfterIt()
    {
        IReadOnlyList<LedgerRowView> rows = [Row(1000.00m), DeletedRow(), Row(-300.00m), Row(200.00m)];

        var balances = LedgerRunningBalance.Apply(rows, 900.00m);

        balances.ShouldBe([900.00m, null, -100.00m, 200.00m]);
    }

    [Fact]
    public void ADeletedFirstRowGetsNoBalanceAndTheNextRowTakesTheBalanceAfterFirst()
    {
        IReadOnlyList<LedgerRowView> rows = [DeletedRow(), Row(-300.00m)];

        var balances = LedgerRunningBalance.Apply(rows, 700.00m);

        balances.ShouldBe([null, 700.00m]);
    }

    [Fact]
    public void NoRowsGiveNoBalances()
    {
        LedgerRunningBalance.Apply([], 123.45m).ShouldBeEmpty();
    }

    [Fact]
    public void TheLastRowOfTheOldestPageEndsOnItsOwnSignedAmount()
    {
        IReadOnlyList<LedgerRowView> rows = [Row(-50.00m), Row(250.00m)];

        var balances = LedgerRunningBalance.Apply(rows, 200.00m);

        balances[^1].ShouldBe(rows[^1].SignedAmount);
    }

    [Fact]
    public void ANullListIsRefused()
    {
        Should.Throw<ArgumentNullException>(() => LedgerRunningBalance.Apply(null!, 0m));
    }

    private static LedgerRowView Row(decimal signed) =>
        new(signed >= 0 ? LedgerEntryKind.PaymentReceived : LedgerEntryKind.CompanyExpensePaid, Guid.NewGuid(), Day, At, signed, IsDeleted: false);

    private static LedgerRowView DeletedRow() =>
        new(LedgerEntryKind.TransferIn, Guid.NewGuid(), Day, At, 0m, IsDeleted: true) { DeletedAmount = 500.00m };
}

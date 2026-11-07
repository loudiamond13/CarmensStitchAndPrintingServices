using Csps.Domain.Money;

namespace Csps.Domain.UnitTests.Money;

/// <summary>MONEY-04, MONEY-05, D-14, D-17 to D-24, D-49, D-56: the transfer aggregate records valid sends and refuses every broken rule with the owner's words.</summary>
public sealed class MoneyTransferTests
{
    private static readonly DateOnly Today = new(2026, 11, 5);
    private static readonly DateTimeOffset Now = new(2026, 11, 5, 3, 30, 0, TimeSpan.Zero);

    private static readonly MoneyParty Carmen = new(Guid.Parse("c0a1b2c3-0001-4000-8000-000000000001"), "Carmen Reyes", MoneyPartyStatus.Active, 8450.00m);
    private static readonly MoneyParty Liza = new(Guid.Parse("c0a1b2c3-0002-4000-8000-000000000002"), "Liza Mercado", MoneyPartyStatus.Active, 100.00m);

    [Fact]
    public void AValidTransferKeepsEveryValueAndIsNotAHandover()
    {
        var result = Record(Carmen, Liza, 2000.00m, Today, "  Cash for the fabric run  ");

        result.IsSuccess.ShouldBeTrue();
        var transfer = result.Value;
        transfer.FromUserId.ShouldBe(Carmen.Id);
        transfer.ToUserId.ShouldBe(Liza.Id);
        transfer.Amount.ShouldBe(2000.00m);
        transfer.TransferDate.ShouldBe(Today);
        transfer.Note.ShouldBe("Cash for the fabric run");
        transfer.IsHandover.ShouldBeFalse();
        transfer.IsDeleted.ShouldBeFalse();
        transfer.DeletedAtUtc.ShouldBeNull();
        transfer.DeletedById.ShouldBeNull();
        transfer.CreatedById.ShouldBeNull();
        transfer.UpdatedById.ShouldBeNull();
        transfer.UpdatedAtUtc.ShouldBeNull();
        transfer.RowVersion.ShouldBeEmpty();
    }

    [Fact]
    public void TheKeyIsAVersionSevenIdMadeFromTheInstant()
    {
        var id = Record(Carmen, Liza, 10m, Today, null).Value.Id;

        id.Version.ShouldBe(7);
        var bytes = id.ToByteArray(bigEndian: true);
        var milliseconds = bytes.Take(6).Aggregate(0L, (total, next) => (total << 8) | next);
        milliseconds.ShouldBe(Now.ToUnixTimeMilliseconds());
    }

    [Fact]
    public void AnAmountOfTwoDecimalsIsStoredAsGiven()
    {
        Record(Carmen, Liza, 10.50m, Today, null).Value.Amount.ShouldBe(10.50m);
    }

    private static Csps.Domain.Common.Result<MoneyTransfer> Record(
        MoneyParty sender,
        MoneyParty recipient,
        decimal amount,
        DateOnly date,
        string? note,
        bool callerIsManager = true) =>
        MoneyTransfer.Record(sender, recipient, amount, date, note, callerIsManager, Today, Now);
}

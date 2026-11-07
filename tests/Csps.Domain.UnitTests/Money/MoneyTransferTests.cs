using Csps.Domain.Money;

namespace Csps.Domain.UnitTests.Money;

/// <summary>MONEY-04, MONEY-05, D-14, D-17 to D-24, D-49, D-56: the transfer aggregate records valid sends and refuses every broken rule with the owner's words.</summary>
public sealed class MoneyTransferTests
{
    private static readonly DateOnly Today = new(2026, 11, 5);
    private static readonly DateTimeOffset Now = new(2026, 11, 5, 3, 30, 0, TimeSpan.Zero);

    private static readonly MoneyParty Carmen = new(Guid.Parse("c0a1b2c3-0001-4000-8000-000000000001"), "Carmen Reyes", MoneyPartyStatus.Active, 8450.00m);
    private static readonly MoneyParty Liza = new(Guid.Parse("c0a1b2c3-0002-4000-8000-000000000002"), "Liza Mercado", MoneyPartyStatus.Active, 100.00m);
    private static readonly MoneyParty Leaver = new(Guid.Parse("c0a1b2c3-0003-4000-8000-000000000003"), "Jomar Santos", MoneyPartyStatus.Deactivated, 0.00m);

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

    [Fact]
    public void ANoteWithEmojiAndFilipinoTextIsKeptUnchanged()
    {
        Record(Carmen, Liza, 10m, Today, "Salamat po, ñ 😀").Value.Note.ShouldBe("Salamat po, ñ 😀");
    }

    [Theory]
    [InlineData("")]
    [InlineData("     ")]
    public void ABlankNoteBecomesNull(string note)
    {
        Record(Carmen, Liza, 10m, Today, note).Value.Note.ShouldBeNull();
    }

    [Fact]
    public void AMissingRecipientIsRefusedUnderToUserId()
    {
        var nobody = new MoneyParty(Guid.Empty, "Nobody", MoneyPartyStatus.NotStaff, 0m);

        ShouldFail(Record(Carmen, nobody, 10m, Today, null), "toUserId", "Choose who got the cash.");
    }

    [Fact]
    public void ARecipientWhoIsTheSenderIsRefusedAsSelf()
    {
        ShouldFail(Record(Carmen, Carmen, 10m, Today, null), "toUserId", "Choose someone other than yourself.");
    }

    [Theory]
    [InlineData(0.00)]
    [InlineData(-5.00)]
    public void AnAmountOfZeroOrLessIsRefused(double amount)
    {
        ShouldFail(Record(Carmen, Liza, (decimal)amount, Today, null), "amount", "Enter an amount of at least ₱0.01.");
    }

    [Fact]
    public void AnAmountOfOneCentavoIsAccepted()
    {
        Record(Carmen, Liza, 0.01m, Today, null).IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData("10.005")]
    [InlineData("0.001")]
    public void AnAmountWithMoreThanTwoDecimalsIsRefused(string text)
    {
        var amount = decimal.Parse(text, System.Globalization.CultureInfo.InvariantCulture);

        ShouldFail(Record(Carmen, Liza, amount, Today, null), "amount", "Use at most 2 decimal places.");
    }

    [Fact]
    public void ADateOfTodayIsAcceptedAndAnyPastDateToo()
    {
        Record(Carmen, Liza, 10m, Today, null).IsSuccess.ShouldBeTrue();
        Record(Carmen, Liza, 10m, Today.AddDays(-4000), null).IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void ADateAfterTodayIsRefusedAsInTheFuture()
    {
        ShouldFail(Record(Carmen, Liza, 10m, Today.AddDays(1), null), "transferDate", "The transfer date can't be in the future.");
    }

    [Fact]
    public void ANoteOfTwoHundredCharactersIsAcceptedAndTwoHundredAndOneIsRefused()
    {
        Record(Carmen, Liza, 10m, Today, new string('n', 200)).IsSuccess.ShouldBeTrue();
        ShouldFail(Record(Carmen, Liza, 10m, Today, new string('n', 201)), "note", "Keep the note to 200 characters or fewer.");
    }

    [Fact]
    public void TheNoteLimitCountsAfterTheTrim()
    {
        var padded = "  " + new string('n', 200) + "  ";

        var result = Record(Carmen, Liza, 10m, Today, padded);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Note!.Length.ShouldBe(200);
    }

    [Fact]
    public void WhenSeveralFieldsAreWrongTheRecipientComesBeforeAmountDateAndNote()
    {
        var result = MoneyTransfer.Record(Carmen, Carmen, -1m, Today.AddDays(1), new string('n', 201), true, Today, Now);

        ShouldFail(result, "toUserId", "Choose someone other than yourself.");
        ShouldFail(Record(Carmen, Liza, -1m, Today.AddDays(1), new string('n', 201)), "amount", "Enter an amount of at least ₱0.01.");
        ShouldFail(Record(Carmen, Liza, 10m, Today.AddDays(1), new string('n', 201)), "transferDate", "The transfer date can't be in the future.");
    }

    [Fact]
    public void ASenderWithNothingOnHandIsRefused()
    {
        var empty = Carmen with { Balance = 0.00m };
        var overdrawn = Carmen with { Balance = -20.00m };

        ShouldFail(Record(empty, Liza, 10m, Today, null), "amount", "You have nothing on hand to transfer.");
        ShouldFail(Record(overdrawn, Liza, 10m, Today, null), "amount", "You have nothing on hand to transfer.");
    }

    [Fact]
    public void AnAmountAboveTheSendersBalanceNamesTheBalance()
    {
        var sender = Carmen with { Balance = 3200.00m };

        ShouldFail(Record(sender, Liza, 3200.01m, Today, null), "amount", "You only have ₱3,200.00 on hand.");
        Record(sender, Liza, 3200.00m, Today, null).IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void ASenderWithOneCentavoCanSendOneCentavoAndNotTwo()
    {
        var sender = Carmen with { Balance = 0.01m };

        Record(sender, Liza, 0.01m, Today, null).IsSuccess.ShouldBeTrue();
        ShouldFail(Record(sender, Liza, 0.02m, Today, null), "amount", "You only have ₱0.01 on hand.");
    }

    [Theory]
    [InlineData(MoneyPartyStatus.NotStaff)]
    [InlineData(MoneyPartyStatus.Deactivated)]
    [InlineData(MoneyPartyStatus.Deleted)]
    public void ARecipientWhoCannotReceiveIsRefusedByNameUnderToUserId(MoneyPartyStatus status)
    {
        var recipient = new MoneyParty(Guid.Parse("c0a1b2c3-0003-4000-8000-000000000003"), "Jomar Santos", status, 0.00m);

        ShouldFail(Record(Carmen, recipient, 10m, Today, null), "toUserId", "Jomar Santos can't receive transfers now. Choose someone else.");
    }

    [Fact]
    public void AFormerStaffMemberWhoHoldsMoneyCannotReceive()
    {
        var recipient = Leaver with { Balance = 250.00m };

        ShouldFail(Record(Carmen, recipient, 10m, Today, null), "toUserId", "Jomar Santos can't receive transfers now. Choose someone else.");
    }

    [Theory]
    [InlineData(MoneyPartyStatus.Deactivated)]
    [InlineData(MoneyPartyStatus.Deleted)]
    public void AFormerStaffMemberWhoIsOwedMoneyCanReceiveUpToWhatIsOwed(MoneyPartyStatus status)
    {
        var recipient = Leaver with { Status = status, Balance = -500.00m };

        var result = Record(Carmen, recipient, 500.00m, Today, null);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ToUserId.ShouldBe(recipient.Id);
    }

    [Fact]
    public void AManagerTransferringAboveWhatALeaverIsOwedReadsTheOwedOnlyFigure()
    {
        var recipient = Leaver with { Balance = -500.00m };

        ShouldFail(Record(Carmen, recipient, 500.01m, Today, null, callerIsManager: true), "amount", "Jomar Santos is owed only ₱500.00. Enter that or less.");
    }

    [Fact]
    public void AnAdminTransferringAboveWhatALeaverIsOwedIsToldToAskAManagerWithNoFigure()
    {
        var recipient = Leaver with { Balance = -500.00m };

        var result = Record(Carmen, recipient, 500.01m, Today, null, callerIsManager: false);

        ShouldFail(result, "amount", "That's more than Jomar Santos is owed. Ask a Manager for the amount.");
        result.Error.FieldErrors!["amount"][0].ShouldNotContain("500");
    }

    [Fact]
    public void TheSendersBalanceIsCheckedBeforeWhatALeaverIsOwed()
    {
        var recipient = Leaver with { Balance = -500.00m };
        var sender = Carmen with { Balance = 100.00m };

        ShouldFail(Record(sender, recipient, 200.00m, Today, null), "amount", "You only have ₱100.00 on hand.");
    }

    private static void ShouldFail(Csps.Domain.Common.Result<MoneyTransfer> result, string field, string message)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(Csps.Domain.Common.ErrorKind.Validation);
        result.Error.Code.ShouldBe("money-transfers.invalid-request");
        result.Error.Message.ShouldBe("Check the highlighted fields.");
        result.Error.FieldErrors.ShouldNotBeNull();
        result.Error.FieldErrors.Keys.ShouldBe([field]);
        result.Error.FieldErrors[field].ShouldBe([message]);
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

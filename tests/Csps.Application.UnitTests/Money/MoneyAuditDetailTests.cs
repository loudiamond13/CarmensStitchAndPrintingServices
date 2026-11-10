using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Money;
using Csps.Domain.Auditing;
using Csps.Domain.Money;

namespace Csps.Application.UnitTests.Money;

/// <summary>D-52, AUDIT-01: the audit detail of a money event holds ids, a two-decimal amount, a date and note=yes or note=no, and nothing else.</summary>
public sealed class MoneyAuditDetailTests
{
    private static readonly Guid Jomar = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid Liza = Guid.Parse("22222222-2222-4222-8222-222222222222");
    private static readonly Guid Carmen = Guid.Parse("33333333-3333-4333-8333-333333333333");
    private static readonly DateOnly Day = new(2026, 11, 4);
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public void AHandOverWithANoteWritesNoteYes()
    {
        MoneyAuditDetail.Handover(Jomar, Liza, 2000m, Day, hasNote: true)
            .ShouldBe($"from={Jomar:D};to={Liza:D};amount=2000.00;date=2026-11-04;note=yes");
    }

    [Fact]
    public void AHandOverWithNoNoteWritesNoteNo()
    {
        MoneyAuditDetail.Handover(Jomar, Liza, 2000m, Day, hasNote: false)
            .ShouldBe($"from={Jomar:D};to={Liza:D};amount=2000.00;date=2026-11-04;note=no");
    }

    [Fact]
    public void TheDetailForAnyNoteStaysFarUnderTheFourHundredCharacterLimit()
    {
        var detail = MoneyAuditDetail.Handover(Guid.NewGuid(), Guid.NewGuid(), 9999999999999999.99m, DateOnly.MaxValue, hasNote: true);

        detail.Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Theory]
    [InlineData("de-DE")]
    [InlineData("fil-PH")]
    [InlineData("fr-FR")]
    public void AmountsAndDatesAreWrittenWithTwoDecimalsAndTheInvariantCulture(string culture)
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo(culture);

            MoneyAuditDetail.Snapshot(Jomar, Liza, 1234.5m, Day, hasNote: false)
                .ShouldContain("amount=1234.50;date=2026-11-04");
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Fact]
    public void TheDetailReadsBackIntoTheSameKeysInOrder()
    {
        var parts = AuditDetailFormat.Parse(MoneyAuditDetail.Handover(Jomar, Liza, 10m, Day, hasNote: true));

        parts.Select(part => part.Key).ShouldBe([MoneyAuditDetail.FromKey, MoneyAuditDetail.ToKey, "amount", "date", MoneyAuditDetail.NoteKey]);
        parts.Single(part => part.Key == MoneyAuditDetail.NoteKey).To.ShouldBe("yes");
    }

    [Fact]
    public void ADeleteDetailHoldsTheFactsAndWhoRecordedItAndNoNoteText()
    {
        var transfer = Transfer("Cash for Aling Nena", Jomar);

        var detail = MoneyAuditDetail.Deleted(transfer);

        detail.ShouldBe($"from={Jomar:D};to={Liza:D};amount=2000.00;date=2026-11-04;note=yes;recordedBy={Jomar:D}");
        detail.ShouldNotContain("Nena", Case.Insensitive);
    }

    [Fact]
    public void ADeleteDetailWritesNoteNoWhenThereIsNoNote()
    {
        MoneyAuditDetail.Deleted(Transfer(null, Jomar)).ShouldContain("note=no");
    }

    [Fact]
    public void ADeleteDetailLeavesOutRecordedByWhenNoOneIsRecorded()
    {
        MoneyAuditDetail.Deleted(Transfer("x", null)).ShouldNotContain("recordedBy");
    }

    [Fact]
    public void ARemoveDetailHoldsTheFullRecordAsIdsAndValuesAndNoNoteText()
    {
        var transfer = Transfer("Cash for Aling Nena", Jomar);
        transfer.SoftDelete(Carmen, new DateTimeOffset(2026, 11, 5, 3, 4, 5, TimeSpan.FromHours(8)));

        var detail = MoneyAuditDetail.Removed(transfer);

        detail.ShouldBe(
            $"from={Jomar:D};to={Liza:D};amount=2000.00;date=2026-11-04;note=yes;recordedBy={Jomar:D};handover=no;deletedBy={Carmen:D};deletedAt=2026-11-04T19:04:05Z");
        detail.ShouldNotContain("Nena", Case.Insensitive);
    }

    [Fact]
    public void ARemoveDetailWritesNoteNoWhenThereIsNoNote()
    {
        var transfer = Transfer(null, Jomar);
        transfer.SoftDelete(Carmen, Now);

        MoneyAuditDetail.Removed(transfer).ShouldContain("note=no");
    }

    [Fact]
    public void ARemoveDetailForALiveTransferHasNoDeletedByOrDeletedAt()
    {
        var detail = MoneyAuditDetail.Removed(Transfer("x", Jomar));

        detail.ShouldNotContain("deletedBy");
        detail.ShouldNotContain("deletedAt");
    }

    [Fact]
    public void ARemoveDetailSaysHandoverNoForANormalTransferAndYesForAHandOver()
    {
        var normal = Transfer("x", Jomar);
        normal.SoftDelete(Carmen, Now);
        var leaver = new MoneyParty(Jomar, "Jomar Santos", MoneyPartyStatus.Deactivated, 2000m);
        var coworker = new MoneyParty(Liza, "Liza Mercado", MoneyPartyStatus.Active, 0m);
        var handover = MoneyTransfer.RecordHandover(leaver, coworker, 2000m, Day, "x", Day, Now).Value;
        handover.SoftDelete(Carmen, Now);

        MoneyAuditDetail.Removed(normal).ShouldContain(";handover=no;deletedBy=");
        MoneyAuditDetail.Removed(handover).ShouldContain(";handover=yes;deletedBy=");
        MoneyAuditDetail.Deleted(normal).ShouldNotContain("handover");
    }

    [Fact]
    public void TheDeleteAndRemoveDetailsForTheLongestValuesStayUnderTheFourHundredCharacterLimit()
    {
        var transfer = Transfer(new string('x', 200), Guid.NewGuid(), amount: 9999999999999999.99m, from: Guid.NewGuid(), to: Guid.NewGuid());
        transfer.SoftDelete(Guid.NewGuid(), DateTimeOffset.MaxValue);

        MoneyAuditDetail.Deleted(transfer).Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
        MoneyAuditDetail.Removed(transfer).Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void TheRemoveDetailReadsBackIntoTheSameKeysInOrder()
    {
        var transfer = Transfer("x", Jomar);
        transfer.SoftDelete(Carmen, Now);

        AuditDetailFormat.Parse(MoneyAuditDetail.Removed(transfer)).Select(part => part.Key).ShouldBe(
            [MoneyAuditDetail.FromKey, MoneyAuditDetail.ToKey, "amount", "date", MoneyAuditDetail.NoteKey, MoneyAuditDetail.RecordedByKey, MoneyAuditDetail.HandoverKey, MoneyAuditDetail.DeletedByKey, MoneyAuditDetail.DeletedAtKey]);
    }

    private static MoneyTransfer Transfer(string? note, Guid? recordedBy, decimal amount = 2000m, Guid? from = null, Guid? to = null)
    {
        var sender = new MoneyParty(from ?? Jomar, "Jomar Santos", MoneyPartyStatus.Active, amount);
        var recipient = new MoneyParty(to ?? Liza, "Liza Mercado", MoneyPartyStatus.Active, 0m);
        var transfer = MoneyTransfer.Record(sender, recipient, amount, Day, note, callerIsManager: false, Day, Now).Value;
        typeof(MoneyTransfer).GetProperty(nameof(MoneyTransfer.CreatedById))!.SetValue(transfer, recordedBy);
        return transfer;
    }
}

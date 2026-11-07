using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Money;
using Csps.Domain.Auditing;

namespace Csps.Application.UnitTests.Money;

/// <summary>D-52, AUDIT-01: the audit detail of a money event holds ids, a two-decimal amount, a date and note=yes or note=no, and nothing else.</summary>
public sealed class MoneyAuditDetailTests
{
    private static readonly Guid Jomar = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid Liza = Guid.Parse("22222222-2222-4222-8222-222222222222");
    private static readonly DateOnly Day = new(2026, 11, 4);

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
}

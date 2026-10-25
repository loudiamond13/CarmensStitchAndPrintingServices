using Csps.Application.Common;
using Csps.Domain.Auditing;

namespace Csps.Application.UnitTests.Common;

/// <summary>D-27, D-06, T-06-05: one detail format for expense and category audit entries. It carries no description or notes text.</summary>
public sealed class AuditDetailFormatTests
{
    private static readonly Guid Category = Guid.Parse("6869715c-a01f-4053-87d8-8fd39feebebc");
    private static readonly Guid Payer = Guid.Parse("51702a8f-81e4-4a20-8e39-2d4b270793de");

    [Fact]
    public void AnAmountIsWrittenWithTwoDecimalsAndNoCultureSeparators()
    {
        AuditDetailFormat.Pair("amount", 1200m).ShouldBe("amount=1200.00");
        AuditDetailFormat.Pair("amount", 1234567.5m).ShouldBe("amount=1234567.50");
    }

    [Fact]
    public void ADateIsWrittenAsYearMonthDay()
    {
        AuditDetailFormat.Pair("date", new DateOnly(2026, 10, 5)).ShouldBe("date=2026-10-05");
    }

    [Fact]
    public void AnIdIsWrittenWithDashesInLowerCase()
    {
        AuditDetailFormat.Pair("payer", Guid.Parse("51702A8F-81E4-4A20-8E39-2D4B270793DE")).ShouldBe("payer=51702a8f-81e4-4a20-8e39-2d4b270793de");
    }

    [Fact]
    public void ATextValueIsEncoded()
    {
        AuditDetailFormat.Pair("name", "Rent; 50%").ShouldBe("name=Rent%3B 50%25");
    }

    [Fact]
    public void AChangeShowsOldThenNew()
    {
        AuditDetailFormat.Change("date", new DateOnly(2026, 10, 5), new DateOnly(2026, 10, 6)).ShouldBe("date=2026-10-05>2026-10-06");
        AuditDetailFormat.Change("amount", 1200m, 1250.5m).ShouldBe("amount=1200.00>1250.50");
        AuditDetailFormat.Change("category", Category, Payer).ShouldBe($"category={Category:D}>{Payer:D}");
        AuditDetailFormat.Change("name", "Rent", "Rent & hall").ShouldBe("name=Rent>Rent & hall");
    }

    [Fact]
    public void JoinKeepsTheOrderAndSeparatesWithSemicolons()
    {
        AuditDetailFormat.Join("date=2026-10-05", "amount=1.00", "payer=x").ShouldBe("date=2026-10-05;amount=1.00;payer=x");
    }

    [Fact]
    public void EncodeEscapesOnlyThePercentSemicolonEqualsAndGreaterThan()
    {
        AuditDetailFormat.Encode("A;B=C>D%").ShouldBe("A%3BB%3DC%3ED%25");
        AuditDetailFormat.Encode("Plain name, with-punctuation & more").ShouldBe("Plain name, with-punctuation & more");
    }

    [Theory]
    [InlineData("A;B=C>D%")]
    [InlineData("%3B")]
    [InlineData("100%25")]
    [InlineData("")]
    [InlineData(";;==>>%%")]
    public void DecodeReversesEncode(string text)
    {
        AuditDetailFormat.Decode(AuditDetailFormat.Encode(text)).ShouldBe(text);
    }

    [Fact]
    public void ParseReadsSingleValuesAndChanges()
    {
        var parts = AuditDetailFormat.Parse($"amount=1200.00>1250.00;fields=description,notes;payer={Payer:D}");

        parts.ShouldBe(
        [
            new AuditDetailPart("amount", "1200.00", "1250.00"),
            new AuditDetailPart("fields", null, "description,notes"),
            new AuditDetailPart("payer", null, Payer.ToString("D")),
        ]);
    }

    [Fact]
    public void ParseDecodesEncodedText()
    {
        var detail = AuditDetailFormat.Join(AuditDetailFormat.Change("name", "A;B", "C>D"), AuditDetailFormat.Pair("tone", "info"));

        AuditDetailFormat.Parse(detail).ShouldBe([new AuditDetailPart("name", "A;B", "C>D"), new AuditDetailPart("tone", null, "info")]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void ParseOfNothingIsEmpty(string? detail)
    {
        AuditDetailFormat.Parse(detail).ShouldBeEmpty();
    }

    [Fact]
    public void ParseSkipsAPartWithNoEqualsSign()
    {
        AuditDetailFormat.Parse("junk;amount=1.00").ShouldBe([new AuditDetailPart("amount", null, "1.00")]);
    }

    [Fact]
    public void AWorstCaseExpenseChangeFitsInAnAuditDetail()
    {
        var detail = AuditDetailFormat.Join(
            AuditDetailFormat.Change("amount", 9999999999999999.99m, 9999999999999998.99m),
            AuditDetailFormat.Change("date", new DateOnly(2026, 10, 5), new DateOnly(2026, 10, 6)),
            AuditDetailFormat.Change("category", Category, Payer),
            "fields=description,notes",
            AuditDetailFormat.Pair("payer", Payer));

        detail.Length.ShouldBeLessThanOrEqualTo(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void AWorstCaseCategoryRenameFitsInAnAuditDetail()
    {
        var reserved = new string(';', 40);
        var other = new string('%', 40);

        var detail = AuditDetailFormat.Change("name", reserved, other);

        detail.Length.ShouldBeLessThanOrEqualTo(AuditEntry.DetailMaxLength);
        AuditDetailFormat.Parse(detail).ShouldBe([new AuditDetailPart("name", reserved, other)]);
    }

    [Fact]
    public void NoMethodTakesFreeTextForDescriptionOrNotes()
    {
        // The only text path is Pair/Change with a string, used for category names; the public surface has no description or notes parameter.
        typeof(AuditDetailFormat).GetMethods()
            .SelectMany(method => method.GetParameters())
            .Select(parameter => parameter.Name)
            .ShouldNotContain(name => name!.Contains("description", StringComparison.OrdinalIgnoreCase) || name.Contains("notes", StringComparison.OrdinalIgnoreCase));
    }
}

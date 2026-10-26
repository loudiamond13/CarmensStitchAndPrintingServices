using Csps.Application.Audit;
using Csps.Application.Users;
using Csps.Domain.Auditing;

namespace Csps.Application.UnitTests.Audit;

/// <summary>D-27, 05 D-40: the stored detail of expense and category entries becomes typed lines, and no free text of an expense gets through.</summary>
public sealed class AuditChangeLinesTests
{
    private static readonly Guid Ana = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid Bea = Guid.Parse("22222222-2222-4222-8222-222222222222");
    private static readonly Guid Supplies = Guid.Parse("33333333-3333-4333-8333-333333333333");
    private static readonly Guid Equipment = Guid.Parse("44444444-4444-4444-8444-444444444444");

    [Fact]
    public void AnEditGivesTheAmountLineTheTextFieldNamesAndThePayerForDoneTo()
    {
        var parsed = AuditChangeLines.For(AuditActions.CompanyExpenseChanged, $"amount=1200.00>1250.00;fields=description;payer={Ana:D}");

        parsed.Lines.ShouldBe([new ParsedAuditChange("amount", "1200.00", "1250.00"), new ParsedAuditChange("description", null, null)]);
        parsed.PayerId.ShouldBe(Ana);
        parsed.Snapshot.ShouldBeNull();
    }

    [Fact]
    public void AnEditOfDateCategoryAndBothTextFieldsKeepsTheStoredOrder()
    {
        var parsed = AuditChangeLines.For(
            AuditActions.CompanyExpenseChanged,
            $"date=2026-10-05>2026-10-06;category={Supplies:D}>{Equipment:D};fields=description,notes;payer={Ana:D}");

        parsed.Lines.ShouldBe(
        [
            new ParsedAuditChange("date", "2026-10-05", "2026-10-06"),
            new ParsedAuditChange("category", Supplies.ToString("D"), Equipment.ToString("D")),
            new ParsedAuditChange("description", null, null),
            new ParsedAuditChange("notes", null, null),
        ]);
    }

    [Fact]
    public void APayerChangeGivesOnePayerLineAndTheNewPayerForDoneTo()
    {
        var parsed = AuditChangeLines.For(AuditActions.CompanyExpensePayerChanged, $"payer={Ana:D}>{Bea:D}");

        parsed.Lines.ShouldBe([new ParsedAuditChange("payer", Ana.ToString("D"), Bea.ToString("D"))]);
        parsed.PayerId.ShouldBe(Bea);
    }

    [Theory]
    [InlineData(AuditActions.CompanyExpenseAdded)]
    [InlineData(AuditActions.CompanyExpenseDeleted)]
    [InlineData(AuditActions.CompanyExpenseRestored)]
    [InlineData(AuditActions.CompanyExpensePermanentlyDeleted)]
    public void ASnapshotCodeGivesTheSnapshotAndNoLines(string action)
    {
        var parsed = AuditChangeLines.For(action, $"date=2026-10-05;category={Supplies:D};amount=8642.35;payer={Ana:D}");

        parsed.Lines.ShouldBeEmpty();
        parsed.Snapshot.ShouldBe(new ParsedAuditSnapshot(new DateOnly(2026, 10, 5), Supplies, 8642.35m, Ana));
        parsed.PayerId.ShouldBe(Ana);
    }

    [Fact]
    public void ACategoryRenameDecodesBothNames()
    {
        var parsed = AuditChangeLines.For(AuditActions.ExpenseCategoryRenamed, "name=Tools%3BParts>Office%3EWare");

        parsed.Lines.ShouldBe([new ParsedAuditChange("name", "Tools;Parts", "Office>Ware")]);
        parsed.PayerId.ShouldBeNull();
    }

    [Fact]
    public void ARecolorGivesAToneLineAndAnAddedCategoryGivesItsNameAndTone()
    {
        AuditChangeLines.For(AuditActions.ExpenseCategoryRecolored, "tone=info>success").Lines
            .ShouldBe([new ParsedAuditChange("tone", "info", "success")]);
        AuditChangeLines.For(AuditActions.ExpenseCategoryAdded, "name=Fuel;tone=warning").Lines
            .ShouldBe([new ParsedAuditChange("name", null, "Fuel"), new ParsedAuditChange("tone", null, "warning")]);
    }

    [Theory]
    [InlineData(AuditActions.ExpenseCategoryRetired)]
    [InlineData(AuditActions.ExpenseCategoryReactivated)]
    [InlineData(AuditActions.ExpenseCategoryDeleted)]
    public void ARetireReactivateOrDeleteGivesTheNameOnly(string action)
    {
        AuditChangeLines.For(action, "name=Old%3Dstock").Lines.ShouldBe([new ParsedAuditChange("name", null, "Old=stock")]);
    }

    [Fact]
    public void AnUnknownKeyAnUnknownFieldAndAMalformedValueAreLeftOut()
    {
        var parsed = AuditChangeLines.For(
            AuditActions.CompanyExpenseChanged,
            "secret=hunter2>x;amount=lots>some;date=soon>later;category=a>b;fields=description,shoe-size;payer=not-a-guid");

        parsed.Lines.ShouldBe([new ParsedAuditChange("description", null, null)]);
        parsed.PayerId.ShouldBeNull();
    }

    [Fact]
    public void ASnapshotWithABadDateOrAmountIsLeftOut()
    {
        AuditChangeLines.For(AuditActions.CompanyExpenseAdded, $"date=yesterday;category={Supplies:D};amount=5.00;payer={Ana:D}").Snapshot.ShouldBeNull();
        AuditChangeLines.For(AuditActions.CompanyExpenseAdded, $"date=2026-10-05;category={Supplies:D};amount=five;payer={Ana:D}").Snapshot.ShouldBeNull();
    }

    [Theory]
    [InlineData(AuditActions.UserRoleChanged, "role=admin>manager")]
    [InlineData(AuditActions.SignInFailed, "bad-password")]
    [InlineData(AuditActions.UserDetailsChanged, "fields=email")]
    public void AnotherActionGivesNothing(string action, string detail)
    {
        AuditChangeLines.For(action, detail).ShouldBe(ParsedAuditChanges.None);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void NoDetailGivesNothing(string? detail)
    {
        AuditChangeLines.For(AuditActions.CompanyExpenseChanged, detail).ShouldBe(ParsedAuditChanges.None);
    }

    [Fact]
    public void ResolveNamesTheCategoriesAndThePeopleAndLeavesAGoneCategoryNull()
    {
        var anaRef = new ActorRef(Ana, "Ana Reyes", false);
        var beaRef = new ActorRef(Bea, "Bea Navarro", true);
        var parsed = new ParsedAuditChanges(
            [
                new ParsedAuditChange("amount", "1200.00", "1250.00"),
                new ParsedAuditChange("category", Supplies.ToString("D"), Equipment.ToString("D")),
                new ParsedAuditChange("payer", Ana.ToString("D"), Bea.ToString("D")),
                new ParsedAuditChange("notes", null, null),
            ],
            new ParsedAuditSnapshot(new DateOnly(2026, 10, 5), Equipment, 8642.35m, Bea),
            Bea);
        var categories = new Dictionary<Guid, string> { [Supplies] = "Supplies" };

        var (lines, snapshot) = AuditChangeLines.Resolve(parsed, categories, id => id == Ana ? anaRef : id == Bea ? beaRef : null);

        lines.ShouldBe(
        [
            new AuditChangeLine("amount", "1200.00", "1250.00", null, null),
            new AuditChangeLine("category", "Supplies", null, null, null),
            new AuditChangeLine("payer", null, null, anaRef, beaRef),
            new AuditChangeLine("notes", null, null, null, null),
        ]);
        snapshot.ShouldBe(new AuditExpenseSnapshot(new DateOnly(2026, 10, 5), null, 8642.35m, beaRef));
    }

    [Fact]
    public void ResolveOfNothingIsEmpty()
    {
        var (lines, snapshot) = AuditChangeLines.Resolve(ParsedAuditChanges.None, new Dictionary<Guid, string>(), _ => null);

        lines.ShouldBeEmpty();
        snapshot.ShouldBeNull();
    }
}

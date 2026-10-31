using Csps.Domain.Expenses;

namespace Csps.Domain.UnitTests.Expenses;

/// <summary>D-08, D-09, D-13: the ten seeded expense categories and their tones.</summary>
public sealed class ExpenseCategorySeedTests
{
    private static readonly (string Name, string Tone)[] Expected =
    [
        ("Rent", "accent"),
        ("Utilities", "info"),
        ("Salaries", "mockup"),
        ("Supplies", "warning"),
        ("Equipment", "success"),
        ("Maintenance", "neutral"),
        ("Government contributions", "info"),
        ("Taxes and permits", "mockup"),
        ("Transport and fuel", "warning"),
        ("Others", "neutral"),
    ];

    [Fact]
    public void TheSeedHasTheTenCategoriesWithTheirTones()
    {
        ExpenseCategorySeed.Rows.Select(row => (row.Name, row.Tone)).ShouldBe(Expected);
    }

    [Fact]
    public void EveryIdIsDistinctAndNotEmpty()
    {
        ExpenseCategorySeed.Rows.Select(row => row.Id).Distinct().Count().ShouldBe(10);
        ExpenseCategorySeed.Rows.ShouldAllBe(row => row.Id != Guid.Empty);
    }

    [Fact]
    public void OthersIdIsTheOthersRow()
    {
        ExpenseCategorySeed.Rows.Single(row => row.Name == "Others").Id.ShouldBe(ExpenseCategorySeed.OthersId);
        ExpenseCategory.OthersId.ShouldBe(ExpenseCategorySeed.OthersId);
    }

    [Fact]
    public void EveryToneIsOneTheDatabaseAccepts()
    {
        ExpenseCategorySeed.Rows.ShouldAllBe(row => CategoryTones.IsValid(row.Tone));
    }

    [Fact]
    public void TheSixTonesAreInTheDocumentedOrder()
    {
        CategoryTones.All.ShouldBe(["neutral", "accent", "info", "mockup", "warning", "success"]);
    }

    [Theory]
    [InlineData("neutral", true)]
    [InlineData("success", true)]
    [InlineData("danger", false)]
    [InlineData("Neutral", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsValidIsOrdinal(string? tone, bool expected)
    {
        CategoryTones.IsValid(tone).ShouldBe(expected);
    }

    [Fact]
    public void NormalizeTrimsAndUpperCasesInvariantly()
    {
        ExpenseCategory.Normalize("  Rent ").ShouldBe("RENT");
    }

    [Fact]
    public void FromSeedKeepsTheSeedValuesAndHasNoRetirementOrAttribution()
    {
        var row = ExpenseCategorySeed.Rows[0];

        var category = ExpenseCategory.FromSeed(row);

        category.Id.ShouldBe(row.Id);
        category.Name.ShouldBe(row.Name);
        category.NormalizedName.ShouldBe("RENT");
        category.Tone.ShouldBe(row.Tone);
        category.CreatedAtUtc.ShouldBe(ExpenseCategorySeed.SeededAtUtc);
        category.RetiredAtUtc.ShouldBeNull();
        category.IsRetired.ShouldBeFalse();
        category.CreatedById.ShouldBeNull();
        category.UpdatedById.ShouldBeNull();
        category.UpdatedAtUtc.ShouldBeNull();
    }

    [Fact]
    public void OnlyOthersIsOthers()
    {
        ExpenseCategory.FromSeed(ExpenseCategorySeed.Rows.Single(row => row.Name == "Others")).IsOthers.ShouldBeTrue();
        ExpenseCategory.FromSeed(ExpenseCategorySeed.Rows[0]).IsOthers.ShouldBeFalse();
    }
}

using Csps.Domain.Common;
using Csps.Domain.Expenses;

namespace Csps.Domain.UnitTests.Expenses;

/// <summary>D-08, D-12, D-13, OQ-6, OQ-10: a category keeps its rules, and Others can change colour but never name, retirement or removal.</summary>
public sealed class ExpenseCategoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 24, 20, 30, 0, TimeSpan.Zero);

    [Fact]
    public void CreateTrimsTheNameAndKeepsTheToneAndNormalizesForTheUniqueIndex()
    {
        var result = ExpenseCategory.Create("  Laundry  ", CategoryTones.Info, Now);

        result.IsSuccess.ShouldBeTrue();
        var category = result.Value;
        category.Name.ShouldBe("Laundry");
        category.NormalizedName.ShouldBe("LAUNDRY");
        category.Tone.ShouldBe("info");
        category.IsRetired.ShouldBeFalse();
        category.RetiredAtUtc.ShouldBeNull();
        category.IsOthers.ShouldBeFalse();
        category.CreatedAtUtc.ShouldBe(Now);
        category.CreatedById.ShouldBeNull();
        category.RowVersion.ShouldBeEmpty();
    }

    [Fact]
    public void CreateMakesAVersionSevenIdFromTheInstant()
    {
        var id = ExpenseCategory.Create("Laundry", CategoryTones.Info, Now).Value.Id;

        id.Version.ShouldBe(7);
        var bytes = id.ToByteArray(bigEndian: true);
        bytes.Take(6).Aggregate(0L, (total, next) => (total << 8) | next).ShouldBe(Now.ToUnixTimeMilliseconds());
    }

    [Fact]
    public void CreateAcceptsAFortyCharacterNameAndEveryTone()
    {
        var name = new string('a', ExpenseCategory.NameMaxLength);

        ExpenseCategory.Create(name, CategoryTones.Neutral, Now).IsSuccess.ShouldBeTrue();
        foreach (var tone in CategoryTones.All)
        {
            ExpenseCategory.Create("Laundry", tone, Now).Value.Tone.ShouldBe(tone);
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void CreateRefusesAnEmptyName(string name)
    {
        var result = ExpenseCategory.Create(name, CategoryTones.Info, Now);

        Rejected(result, "name", "Enter a category name.");
    }

    [Fact]
    public void CreateRefusesAFortyOneCharacterNameAfterTrimming()
    {
        var result = ExpenseCategory.Create(new string('a', 41), CategoryTones.Info, Now);

        Rejected(result, "name", "Keep the name to 40 characters or fewer.");
    }

    [Theory]
    [InlineData("danger")]
    [InlineData("Info")]
    [InlineData("")]
    public void CreateRefusesAToneOutsideTheSix(string tone)
    {
        var result = ExpenseCategory.Create("Laundry", tone, Now);

        Rejected(result, "tone", "Choose a badge color.");
    }

    [Fact]
    public void RenameChangesTheNameAndNormalizedNameAndReturnsTheOldName()
    {
        var category = Created("Supplies");

        var result = category.Rename("  Office supplies ");

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe("Supplies");
        category.Name.ShouldBe("Office supplies");
        category.NormalizedName.ShouldBe("OFFICE SUPPLIES");
    }

    [Fact]
    public void RenamingToTheSameNameChangesNothing()
    {
        var category = Created("Supplies");

        var result = category.Rename("Supplies");

        result.Value.ShouldBe("Supplies");
        category.Name.ShouldBe("Supplies");
    }

    [Theory]
    [InlineData("", "Enter a category name.")]
    [InlineData("   ", "Enter a category name.")]
    public void RenameRefusesAnEmptyNameAndKeepsTheOldOne(string name, string message)
    {
        var category = Created("Supplies");

        Rejected(category.Rename(name), "name", message);
        category.Name.ShouldBe("Supplies");
    }

    [Fact]
    public void RenameRefusesAFortyOneCharacterName()
    {
        var category = Created("Supplies");

        Rejected(category.Rename(new string('a', 41)), "name", "Keep the name to 40 characters or fewer.");
        category.Name.ShouldBe("Supplies");
    }

    [Fact]
    public void OthersCannotBeRenamedButKeepsItsNameWhenTheSameNameIsSent()
    {
        var others = Others();

        Rejected(others.Rename("Misc"), "name", "The Others name can't change.");
        others.Name.ShouldBe("Others");
        others.Rename("Others").IsSuccess.ShouldBeTrue();
        others.Name.ShouldBe("Others");
    }

    [Fact]
    public void RecolorChangesTheToneAndReturnsTheOldOne()
    {
        var category = Created("Supplies");

        var result = category.Recolor(CategoryTones.Success);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe("info");
        category.Tone.ShouldBe("success");
    }

    [Fact]
    public void RecolorRefusesAToneOutsideTheSixAndKeepsTheOldOne()
    {
        var category = Created("Supplies");

        Rejected(category.Recolor("danger"), "tone", "Choose a badge color.");
        category.Tone.ShouldBe("info");
    }

    [Fact]
    public void OthersCanBeRecoloredToAnyTone()
    {
        var others = Others();

        foreach (var tone in CategoryTones.All)
        {
            others.Recolor(tone).IsSuccess.ShouldBeTrue();
            others.Tone.ShouldBe(tone);
        }
    }

    [Fact]
    public void RetireMarksTheCategoryRetiredAtTheInstantAndASecondRetireChangesNothing()
    {
        var category = Created("Supplies");

        var first = category.Retire(Now.AddHours(1));
        var second = category.Retire(Now.AddHours(2));

        first.IsSuccess.ShouldBeTrue();
        first.Value.ShouldBeTrue();
        second.IsSuccess.ShouldBeTrue();
        second.Value.ShouldBeFalse();
        category.IsRetired.ShouldBeTrue();
        category.RetiredAtUtc.ShouldBe(Now.AddHours(1));
    }

    [Fact]
    public void OthersCannotBeRetired()
    {
        var others = Others();

        var result = others.Retire(Now);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("expense-categories.protected");
        result.Error.Message.ShouldBe("The Others category can't be retired or deleted.");
        others.IsRetired.ShouldBeFalse();
    }

    [Fact]
    public void ReactivateClearsTheRetirementAndAnActiveCategoryChangesNothing()
    {
        var category = Created("Supplies");
        category.Retire(Now);

        var first = category.Reactivate();
        var second = category.Reactivate();

        first.ShouldBeTrue();
        second.ShouldBeFalse();
        category.IsRetired.ShouldBeFalse();
        category.RetiredAtUtc.ShouldBeNull();
    }

    private static ExpenseCategory Created(string name) => ExpenseCategory.Create(name, CategoryTones.Info, Now).Value;

    private static ExpenseCategory Others() => ExpenseCategory.FromSeed(ExpenseCategorySeed.Rows.Single(row => row.Id == ExpenseCategorySeed.OthersId));

    private static void Rejected(Result result, string field, string message)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields.ShouldContainKey(field);
        fields[field].ShouldBe([message]);
    }
}

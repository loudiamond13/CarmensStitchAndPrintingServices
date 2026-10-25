using Csps.Domain.Common;
using Csps.Domain.Expenses;

namespace Csps.Domain.UnitTests.Expenses;

/// <summary>CEXP-02, D-19, D-20, D-21, OQ-10: the aggregate accepts each limit exactly and refuses one step past it, with the owner's words.</summary>
public sealed class CompanyExpenseTests
{
    private static readonly DateOnly Today = new(2026, 10, 25);
    private static readonly DateTimeOffset Now = new(2026, 10, 24, 20, 30, 0, TimeSpan.Zero);
    private static readonly Guid CategoryId = Guid.Parse("447ad32e-1433-4b70-8786-72e3dc3f9937");
    private static readonly Guid PayerId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");

    [Fact]
    public void AValidExpenseKeepsEveryValueAndIsNotDeleted()
    {
        var result = Create();

        result.IsSuccess.ShouldBeTrue();
        var expense = result.Value;
        expense.ExpenseDate.ShouldBe(Today);
        expense.CategoryId.ShouldBe(CategoryId);
        expense.Description.ShouldBe("Thread and needles");
        expense.Amount.ShouldBe(640.00m);
        expense.PaidByUserId.ShouldBe(PayerId);
        expense.Notes.ShouldBeNull();
        expense.IsDeleted.ShouldBeFalse();
        expense.DeletedAtUtc.ShouldBeNull();
        expense.DeletedById.ShouldBeNull();
        expense.CreatedById.ShouldBeNull();
        expense.UpdatedById.ShouldBeNull();
        expense.UpdatedAtUtc.ShouldBeNull();
        expense.RowVersion.ShouldBeEmpty();
    }

    [Fact]
    public void TheKeyIsAVersionSevenIdMadeFromTheInstant()
    {
        var id = Create().Value.Id;

        id.Version.ShouldBe(7);
        var bytes = id.ToByteArray(bigEndian: true);
        var milliseconds = bytes.Take(6).Aggregate(0L, (total, next) => (total << 8) | next);
        milliseconds.ShouldBe(Now.ToUnixTimeMilliseconds());
    }

    [Theory]
    [InlineData("0.01")]
    [InlineData("1250.10")]
    [InlineData("1250.1")]
    [InlineData("1000000.00")]
    public void AnAmountInsideTheLimitsIsAccepted(string text)
    {
        var amount = decimal.Parse(text, System.Globalization.CultureInfo.InvariantCulture);

        var result = Create(amount: amount);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Amount.ShouldBe(amount);
    }

    [Theory]
    [InlineData(0.00, ExpenseRules.AmountTooSmall)]
    [InlineData(-1.00, ExpenseRules.AmountTooSmall)]
    [InlineData(1000000.01, ExpenseRules.AmountTooLarge)]
    [InlineData(1250.123, ExpenseRules.AmountDecimals)]
    [InlineData(0.001, ExpenseRules.AmountDecimals)]
    public void AnAmountOutsideTheLimitsIsRefusedOnTheAmountField(double amount, string message)
    {
        var result = Create(amount: (decimal)amount);

        ShouldFail(result, ExpenseRules.AmountField, message);
    }

    [Fact]
    public void TheAmountKeepsTheExactDecimalValueNotAFloat()
    {
        Create(amount: 1250.10m).Value.Amount.ShouldBe(1250.10m);
        Create(amount: 0.1m + 0.2m).Value.Amount.ShouldBe(0.3m);
    }

    [Fact]
    public void TheLatestDateIsThirtyDaysAfterTodayAndAnyPastDateIsAccepted()
    {
        Create(date: Today.AddDays(30)).IsSuccess.ShouldBeTrue();
        Create(date: Today.AddDays(-4000)).IsSuccess.ShouldBeTrue();
        Create(date: DateOnly.MinValue).IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void ADateThirtyOneDaysAheadIsRefusedWithTheLatestDayNamed()
    {
        var result = Create(date: Today.AddDays(31));

        ShouldFail(result, ExpenseRules.DateField, "Choose a date up to 30 days from today, Nov 24, 2026 at the latest.");
    }

    [Fact]
    public void AnEmptyCategoryIsRefused()
    {
        ShouldFail(Create(categoryId: Guid.Empty), ExpenseRules.CategoryField, ExpenseRules.CategoryRequired);
    }

    [Fact]
    public void AnEmptyPayerIsRefused()
    {
        ShouldFail(Create(paidByUserId: Guid.Empty), ExpenseRules.PaidByField, ExpenseRules.PaidByRequired);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ABlankDescriptionIsRefused(string description)
    {
        ShouldFail(Create(description: description), ExpenseRules.DescriptionField, ExpenseRules.DescriptionRequired);
    }

    [Fact]
    public void ADescriptionOfTwoHundredCharactersIsAcceptedAndTwoHundredAndOneIsRefused()
    {
        Create(description: new string('d', 200)).IsSuccess.ShouldBeTrue();
        ShouldFail(Create(description: new string('d', 201)), ExpenseRules.DescriptionField, ExpenseRules.DescriptionTooLong);
    }

    [Fact]
    public void TheDescriptionLimitCountsAfterTheTrim()
    {
        var padded = "  " + new string('d', 200) + "  ";

        var result = Create(description: padded);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Description.Length.ShouldBe(200);
    }

    [Fact]
    public void LengthsAreUtf16CodeUnitsLikeABrowserString()
    {
        // Each emoji is a surrogate pair, two code units, so 100 fit and 101 do not.
        Create(description: string.Concat(Enumerable.Repeat("😀", 100))).IsSuccess.ShouldBeTrue();
        ShouldFail(Create(description: string.Concat(Enumerable.Repeat("😀", 101))), ExpenseRules.DescriptionField, ExpenseRules.DescriptionTooLong);
    }

    [Fact]
    public void ANullDescriptionIsAProgrammingError()
    {
        Should.Throw<ArgumentNullException>(() => Create(description: null!));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void EmptyNotesBecomeNone(string notes)
    {
        Create(notes: notes).Value.Notes.ShouldBeNull();
    }

    [Fact]
    public void NotesAreTrimmedAndKept()
    {
        Create(notes: "  paid in cash  ").Value.Notes.ShouldBe("paid in cash");
    }

    [Fact]
    public void ThousandCharactersOfNotesAreAcceptedAndOneMoreIsRefused()
    {
        Create(notes: new string('n', 1000)).IsSuccess.ShouldBeTrue();
        ShouldFail(Create(notes: new string('n', 1001)), ExpenseRules.NotesField, ExpenseRules.NotesTooLong);
    }

    [Fact]
    public void WhenSeveralFieldsAreWrongTheFirstInFormOrderIsNamed()
    {
        var result = Create(date: Today.AddDays(99), categoryId: Guid.Empty, description: "", amount: 0m);

        ShouldFail(result, ExpenseRules.DateField, ExpenseRules.DateTooFar(Today.AddDays(30)));
    }

    [Fact]
    public void TheRulesHelpersAgreeWithTheLimits()
    {
        ExpenseRules.Latest(Today).ShouldBe(new DateOnly(2026, 11, 24));
        ExpenseRules.HasValidScale(1.10m).ShouldBeTrue();
        ExpenseRules.HasValidScale(1.101m).ShouldBeFalse();
        ExpenseRules.DateTooFar(new DateOnly(2026, 11, 24)).ShouldBe("Choose a date up to 30 days from today, Nov 24, 2026 at the latest.");
    }

    private static Result<CompanyExpense> Create(
        DateOnly? date = null,
        Guid? categoryId = null,
        string description = "Thread and needles",
        decimal amount = 640.00m,
        Guid? paidByUserId = null,
        string? notes = null) =>
        CompanyExpense.Create(date ?? Today, categoryId ?? CategoryId, description, amount, paidByUserId ?? PayerId, notes, Today, Now);

    private static void ShouldFail(Result<CompanyExpense> result, string field, string message)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe(ExpenseRules.InvalidCode);
        result.Error.Message.ShouldBe(ExpenseRules.InvalidMessage);
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields.Keys.ShouldBe([field]);
        fields[field].ShouldBe([message]);
    }
}

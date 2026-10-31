using Csps.Application.Expenses;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.UnitTests.Expenses;

/// <summary>CEXP-02, D-19, D-20, D-21, OQ-10: every static rule of the Add Expense form, each at its limit.</summary>
public sealed class CreateCompanyExpenseRequestValidatorTests
{
    private static readonly DateOnly Today = new(2026, 10, 25);
    private static readonly Guid CategoryId = Guid.Parse("447ad32e-1433-4b70-8786-72e3dc3f9937");
    private static readonly Guid PayerId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");

    [Fact]
    public void AValidFormPasses()
    {
        Validate(Valid()).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void AnEmptyFormListsEveryRequiredFieldAndNotTheNotes()
    {
        var result = Validate(CreateCompanyExpenseRequest.Empty);

        result.Errors.Select(error => error.PropertyName).Order(StringComparer.Ordinal)
            .ShouldBe(["Amount", "CategoryId", "Date", "Description", "PaidByUserId"]);
        Messages(result, "Date").ShouldBe(["Enter the date."]);
        Messages(result, "CategoryId").ShouldBe(["Choose a category."]);
        Messages(result, "Description").ShouldBe(["Add a short description so others know what this was for."]);
        Messages(result, "Amount").ShouldBe(["Enter an amount greater than ₱0.00."]);
        Messages(result, "PaidByUserId").ShouldBe(["Choose who paid."]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void AMissingDateIsRequired(string? date)
    {
        Messages(Validate(Valid() with { Date = date }), "Date").ShouldBe(["Enter the date."]);
    }

    [Theory]
    [InlineData("2026-02-30")]
    [InlineData("2026-13-01")]
    [InlineData("25/10/2026")]
    [InlineData("2026-1-5")]
    [InlineData("20261025")]
    [InlineData("2026-10-25T00:00:00")]
    [InlineData("tomorrow")]
    public void ADateThatIsNotARealIsoDayIsRefused(string date)
    {
        Messages(Validate(Valid() with { Date = date }), "Date").ShouldBe(["Enter a real date."]);
    }

    [Theory]
    [InlineData("2026-10-25")]
    [InlineData("2026-11-24")]
    [InlineData("2020-02-29")]
    [InlineData(" 2026-10-25 ")]
    public void AnyPastDateAndTheLatestDayAreAccepted(string date)
    {
        Validate(Valid() with { Date = date }).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void TheDayAfterTheLatestIsRefusedWithTheLatestDayNamed()
    {
        Messages(Validate(Valid() with { Date = "2026-11-25" }), "Date")
            .ShouldBe(["Choose a date up to 30 days from today, Nov 24, 2026 at the latest."]);
    }

    [Fact]
    public void TheLatestDayMovesWithTheBusinessToday()
    {
        var result = Validate(Valid() with { Date = "2027-01-31" }, new DateOnly(2027, 1, 1));

        result.IsValid.ShouldBeTrue();
        Messages(Validate(Valid() with { Date = "2027-02-01" }, new DateOnly(2027, 1, 1)), "Date")
            .ShouldBe(["Choose a date up to 30 days from today, Jan 31, 2027 at the latest."]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public void AMissingOrEmptyCategoryIsRefused(string? id)
    {
        var request = Valid() with { CategoryId = id is null ? null : Guid.Parse(id) };

        Messages(Validate(request), "CategoryId").ShouldBe(["Choose a category."]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public void AMissingOrEmptyPayerIsRefused(string? id)
    {
        var request = Valid() with { PaidByUserId = id is null ? null : Guid.Parse(id) };

        Messages(Validate(request), "PaidByUserId").ShouldBe(["Choose who paid."]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("    ")]
    public void ABlankDescriptionIsRequired(string? description)
    {
        Messages(Validate(Valid() with { Description = description }), "Description")
            .ShouldBe(["Add a short description so others know what this was for."]);
    }

    [Fact]
    public void ADescriptionIsCountedAfterTheTrim()
    {
        Validate(Valid() with { Description = " " + new string('d', 200) + " " }).IsValid.ShouldBeTrue();
        Messages(Validate(Valid() with { Description = new string('d', 201) }), "Description")
            .ShouldBe(["Keep the description to 200 characters or fewer."]);
    }

    [Theory]
    [InlineData("0.01")]
    [InlineData("1250.10")]
    [InlineData("1250.1")]
    [InlineData("1000000.00")]
    public void AnAmountInsideTheLimitsIsAccepted(string text)
    {
        var amount = decimal.Parse(text, System.Globalization.CultureInfo.InvariantCulture);

        Validate(Valid() with { Amount = amount }).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0.00)]
    [InlineData(-1.00)]
    public void AMissingZeroOrNegativeAmountIsRefused(double? amount)
    {
        Messages(Validate(Valid() with { Amount = amount is null ? null : (decimal)amount }), "Amount")
            .ShouldBe(["Enter an amount greater than ₱0.00."]);
    }

    [Fact]
    public void AnAmountOverTheCapIsRefused()
    {
        Messages(Validate(Valid() with { Amount = 1000000.01m }), "Amount").ShouldBe(["Enter an amount of ₱1,000,000.00 or less."]);
    }

    [Theory]
    [InlineData(1250.123)]
    [InlineData(0.001)]
    public void AnAmountWithMoreThanTwoDecimalPlacesIsRefused(double amount)
    {
        Messages(Validate(Valid() with { Amount = (decimal)amount }), "Amount").ShouldBe(["Use at most 2 decimal places."]);
    }

    [Fact]
    public void NotesAreOptionalAndLimitedToAThousandCharactersAfterTheTrim()
    {
        Validate(Valid() with { Notes = null }).IsValid.ShouldBeTrue();
        Validate(Valid() with { Notes = " " + new string('n', 1000) + " " }).IsValid.ShouldBeTrue();
        Messages(Validate(Valid() with { Notes = new string('n', 1001) }), "Notes").ShouldBe(["Keep notes to 1,000 characters or fewer."]);
    }

    [Fact]
    public void LengthsAreUtf16CodeUnits()
    {
        Validate(Valid() with { Description = string.Concat(Enumerable.Repeat("😀", 100)) }).IsValid.ShouldBeTrue();
        Messages(Validate(Valid() with { Description = string.Concat(Enumerable.Repeat("😀", 101)) }), "Description")
            .ShouldBe(["Keep the description to 200 characters or fewer."]);
    }

    [Fact]
    public void TryParseDateReadsOnlyIsoDays()
    {
        CreateCompanyExpenseRequestValidator.TryParseDate("2026-10-25", out var date).ShouldBeTrue();
        date.ShouldBe(Today);
        CreateCompanyExpenseRequestValidator.TryParseDate(null, out _).ShouldBeFalse();
        CreateCompanyExpenseRequestValidator.TryParseDate("2026-02-30", out _).ShouldBeFalse();
    }

    [Fact]
    public void ACallerThatPassesNoBusinessTodayGetsAnErrorNamingTheKey()
    {
        var context = new ValidationContext<CreateCompanyExpenseRequest>(Valid());

        var error = Should.Throw<InvalidOperationException>(() => new CreateCompanyExpenseRequestValidator().Validate(context));

        error.Message.ShouldContain($"'{CreateCompanyExpenseRequestValidator.TodayKey}'");
    }

    private static CreateCompanyExpenseRequest Valid() => new("2026-10-25", CategoryId, "Thread and needles", 640.00m, PayerId, null);

    private static ValidationResult Validate(CreateCompanyExpenseRequest request, DateOnly? today = null)
    {
        var context = new ValidationContext<CreateCompanyExpenseRequest>(request);
        context.RootContextData[CreateCompanyExpenseRequestValidator.TodayKey] = today ?? Today;
        return new CreateCompanyExpenseRequestValidator().Validate(context);
    }

    private static string[] Messages(ValidationResult result, string property) =>
        [.. result.Errors.Where(error => error.PropertyName == property).Select(error => error.ErrorMessage)];
}

using Csps.Application.Expenses;

namespace Csps.Application.UnitTests.Expenses;

/// <summary>CEXP-01, SEC-03, WEB-10, OR-3: every cap and message of the expense list query, at its edge.</summary>
public sealed class ListCompanyExpensesRequestValidatorTests
{
    private readonly ListCompanyExpensesRequestValidator _validator = new();

    [Fact]
    public void AnEmptyQueryIsAccepted()
    {
        _validator.Validate(new ListCompanyExpensesRequest()).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(100_000, 100)]
    public void TheEdgesOfThePageAndSizeRangesAreAccepted(int page, int pageSize)
    {
        _validator.Validate(new ListCompanyExpensesRequest(Page: page, PageSize: pageSize)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData(0, 20, "Page", "Use a page from 1 to 100000.")]
    [InlineData(100_001, 20, "Page", "Use a page from 1 to 100000.")]
    [InlineData(1, 0, "PageSize", "Use a page size from 1 to 100.")]
    [InlineData(1, 101, "PageSize", "Use a page size from 1 to 100.")]
    public void APageOrSizeOutsideItsRangeIsRefusedWithTheOwnersWords(int page, int pageSize, string field, string message)
    {
        var result = _validator.Validate(new ListCompanyExpensesRequest(Page: page, PageSize: pageSize));

        result.Errors.ShouldHaveSingleItem().ShouldSatisfyAllConditions(
            error => error.PropertyName.ShouldBe(field),
            error => error.ErrorMessage.ShouldBe(message));
    }

    [Fact]
    public void ASearchOfOneHundredCharactersPassesAndOneHundredAndOneIsRefused()
    {
        _validator.Validate(new ListCompanyExpensesRequest(Q: new string('a', 100))).IsValid.ShouldBeTrue();

        var refused = _validator.Validate(new ListCompanyExpensesRequest(Q: new string('a', 101)));

        refused.Errors.ShouldHaveSingleItem().ErrorMessage.ShouldBe("Use 100 characters or fewer.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("447ad32e-1433-4b70-8786-72e3dc3f9937")]
    [InlineData(" 447AD32E-1433-4B70-8786-72E3DC3F9937 ")]
    public void ABlankOrDashedCategoryIdIsAccepted(string? category)
    {
        _validator.Validate(new ListCompanyExpensesRequest(Category: category)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("not-a-guid")]
    [InlineData("447ad32e14334b70878672e3dc3f9937")]
    [InlineData("{447ad32e-1433-4b70-8786-72e3dc3f9937}")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public void AnythingElseAsACategoryIsRefused(string category)
    {
        var result = _validator.Validate(new ListCompanyExpensesRequest(Category: category));

        var error = result.Errors.ShouldHaveSingleItem();
        error.PropertyName.ShouldBe("Category");
        error.ErrorMessage.ShouldBe("Choose a category from the list.");
    }

    [Fact]
    public void ARealPairOfDatesInOrderIsAccepted()
    {
        _validator.Validate(new ListCompanyExpensesRequest(From: "2026-10-01", To: "2026-10-31")).IsValid.ShouldBeTrue();
        _validator.Validate(new ListCompanyExpensesRequest(From: "2026-10-05", To: "2026-10-05")).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("2026-02-30", "2026-03-01", "From")]
    [InlineData("2026-10-01", "10/31/2026", "To")]
    [InlineData("tomorrow", "2026-03-01", "From")]
    [InlineData("2026-13-01", "2026-12-01", "From")]
    public void ADateThatIsNotARealDayIsRefused(string from, string to, string field)
    {
        var result = _validator.Validate(new ListCompanyExpensesRequest(From: from, To: to));

        var error = result.Errors.ShouldHaveSingleItem();
        error.PropertyName.ShouldBe(field);
        error.ErrorMessage.ShouldBe("Enter a real date.");
    }

    [Theory]
    [InlineData("2026-10-01", null, "To")]
    [InlineData("2026-10-01", "  ", "To")]
    [InlineData(null, "2026-10-31", "From")]
    [InlineData("", "2026-10-31", "From")]
    public void OnlyOneOfTheTwoDatesIsRefusedOnTheMissingOne(string? from, string? to, string field)
    {
        var result = _validator.Validate(new ListCompanyExpensesRequest(From: from, To: to));

        var error = result.Errors.ShouldHaveSingleItem();
        error.PropertyName.ShouldBe(field);
        error.ErrorMessage.ShouldBe("Enter both dates, or neither.");
    }

    [Fact]
    public void AStartAfterTheEndIsRefusedOnTheStart()
    {
        var result = _validator.Validate(new ListCompanyExpensesRequest(From: "2026-11-01", To: "2026-10-31"));

        var error = result.Errors.ShouldHaveSingleItem();
        error.PropertyName.ShouldBe("From");
        error.ErrorMessage.ShouldBe("The start date must be on or before the end date.");
    }

    [Fact]
    public void EveryBadFieldIsReportedTogether()
    {
        var result = _validator.Validate(new ListCompanyExpensesRequest(new string('a', 101), "nope", "2026-02-30", "2026-03-01", 0, 0));

        result.Errors.Select(error => error.PropertyName).Order(StringComparer.Ordinal).ShouldBe(["Category", "From", "Page", "PageSize", "Q"]);
    }
}

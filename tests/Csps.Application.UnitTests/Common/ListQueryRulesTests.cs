using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.UnitTests.Common;

/// <summary>SEC-03: the shared page-size and search caps, counted in UTF-16 code units like the browser's string length.</summary>
public sealed class ListQueryRulesTests
{
    private const string PageSizeMessage = "Use a page size from 1 to 100.";
    private const string SearchMessage = "Use 100 characters or fewer.";

    private static readonly TestValidator Validator = new();

    [Theory]
    [InlineData(1)]
    [InlineData(50)]
    [InlineData(100)]
    public void PageSizeInRangeIsAccepted(int size) =>
        Validator.Validate(new Query(size, null)).IsValid.ShouldBeTrue();

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(101)]
    public void PageSizeOutOfRangeIsRejected(int size)
    {
        var result = Validator.Validate(new Query(size, null));

        var error = result.Errors.ShouldHaveSingleItem();
        error.PropertyName.ShouldBe(nameof(Query.PageSize));
        error.ErrorMessage.ShouldBe(PageSizeMessage);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("jersey")]
    public void ShortOrMissingSearchIsAccepted(string? search) =>
        Validator.Validate(new Query(10, search)).IsValid.ShouldBeTrue();

    [Fact]
    public void ASearchOf100CharactersIsAcceptedAnd101IsRejected()
    {
        Validator.Validate(new Query(10, new string('a', 100))).IsValid.ShouldBeTrue();

        var error = Validator.Validate(new Query(10, new string('a', 101))).Errors.ShouldHaveSingleItem();
        error.PropertyName.ShouldBe(nameof(Query.Search));
        error.ErrorMessage.ShouldBe(SearchMessage);
    }

    [Fact]
    public void SearchLengthCountsUtf16CodeUnits()
    {
        // Each emoji is two UTF-16 code units, which is what the browser's string length reports.
        Validator.Validate(new Query(10, string.Concat(Enumerable.Repeat("😀", 50)))).IsValid.ShouldBeTrue();
        Validator.Validate(new Query(10, string.Concat(Enumerable.Repeat("😀", 51)))).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void LimitsAre100() =>
        (ListQueryLimits.MaxPageSize, ListQueryLimits.MaxSearchLength).ShouldBe((100, 100));

    private sealed record Query(int PageSize, string? Search);

    private sealed class TestValidator : AbstractValidator<Query>
    {
        public TestValidator()
        {
            RuleFor(static query => query.PageSize).PageSize();
            RuleFor(static query => query.Search).SearchText();
        }
    }
}

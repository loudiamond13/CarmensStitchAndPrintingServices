using Csps.Application.Common;
using Csps.Domain.Common;
using FluentValidation.Results;

namespace Csps.Application.UnitTests.Common;

/// <summary>Validation errors keep camelCase field names, including every segment of a nested path.</summary>
public sealed class ValidationResultsTests
{
    [Theory]
    [InlineData("Date", "date")]
    [InlineData("CustomerName", "customerName")]
    [InlineData("Items[1].UnitPrice", "items[1].unitPrice")]
    [InlineData("Items[0].ProductTypeId", "items[0].productTypeId")]
    [InlineData("Order.Items[12].Quantity", "order.items[12].quantity")]
    [InlineData("items[3]", "items[3]")]
    [InlineData("A", "a")]
    [InlineData("", "")]
    public void EveryDottedSegmentStartsWithALowerCaseLetter(string property, string expected)
    {
        var result = new ValidationResult([new ValidationFailure(property, "Bad.")]);

        var error = ValidationResults.ToError(result, "x.invalid", "Check the highlighted fields.");

        error.Kind.ShouldBe(ErrorKind.Validation);
        error.Code.ShouldBe("x.invalid");
        error.Message.ShouldBe("Check the highlighted fields.");
        error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe([expected]);
    }

    [Fact]
    public void MessagesOfOneFieldStayTogetherInTheOrderTheyWereRaised()
    {
        var result = new ValidationResult(
        [
            new ValidationFailure("Items[0].Quantity", "First."),
            new ValidationFailure("Date", "Second."),
            new ValidationFailure("Items[0].Quantity", "Third."),
        ]);

        var fields = ValidationResults.ToError(result, "x.invalid", "Check.").FieldErrors.ShouldNotBeNull();

        fields["items[0].quantity"].ShouldBe(["First.", "Third."]);
        fields["date"].ShouldBe(["Second."]);
    }

    [Fact]
    public void ANullResultIsAProgrammingError() =>
        Should.Throw<ArgumentNullException>(() => ValidationResults.ToError(null!, "x", "y"));
}

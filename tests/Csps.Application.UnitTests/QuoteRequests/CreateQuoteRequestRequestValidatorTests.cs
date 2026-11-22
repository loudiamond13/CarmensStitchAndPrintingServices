using Csps.Application.Common;
using Csps.Application.QuoteRequests;
using FluentValidation.Results;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>INQ-01, OR-3, Pitfall 7: every quote form rule and its UI-SPEC message, at its boundary.</summary>
public sealed class CreateQuoteRequestRequestValidatorTests
{
    private static readonly CreateQuoteRequestRequestValidator Validator = new();

    [Fact]
    public void ABoundaryValidFormHasNoErrors() => Fields(Valid()).ShouldBeEmpty();

    [Fact]
    public void AFormWithOnlyANameAndANumberHasNoErrors() =>
        Fields(CreateQuoteRequestRequest.Empty with { CustomerName = "Juan", ContactNumber = "0917 123 4567" }).ShouldBeEmpty();

    [Fact]
    public void AnEmptyFormListsTheTwoRequiredFields() =>
        Fields(CreateQuoteRequestRequest.Empty).Keys.Order(StringComparer.Ordinal).ShouldBe(["contactNumber", "customerName"]);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void AMissingNameIsRefused(string? name) => One(Valid() with { CustomerName = name }, "customerName", "Enter your name.");

    [Fact]
    public void ANameIsLimitedToOneHundredUtf16UnitsAfterTrimming()
    {
        Fields(Valid() with { CustomerName = "  " + new string('a', 100) + "  " }).ShouldBeEmpty();
        One(Valid() with { CustomerName = new string('a', 101) }, "customerName", "Keep your name to 100 characters or fewer.");
        One(Valid() with { CustomerName = new string('a', 99) + "\U0001F600" }, "customerName", "Keep your name to 100 characters or fewer.");
    }

    [Fact]
    public void ATeamNameIsLimitedToOneHundredCharacters()
    {
        Fields(Valid() with { TeamName = new string('t', 100) }).ShouldBeEmpty();
        One(Valid() with { TeamName = new string('t', 101) }, "teamName", "Keep the team name to 100 characters or fewer.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("02 8123 4567")]
    [InlineData("0917 123 456")]
    [InlineData("banana")]
    public void AMissingOrNonMobileNumberIsRefused(string? number) =>
        One(Valid() with { ContactNumber = number }, "contactNumber", "Enter a mobile number, like 0917 123 4567.");

    [Theory]
    [InlineData("0917.123.4567")]
    [InlineData("+63 917 123 4567")]
    [InlineData("(0917) 123-4567")]
    public void AMobileNumberWithSeparatorsIsAccepted(string number) => Fields(Valid() with { ContactNumber = number }).ShouldBeEmpty();

    [Fact]
    public void ANumberOfThirtyOneCharactersIsRefused()
    {
        Fields(Valid() with { ContactNumber = "0917" + new string('-', 19) + "1234567" }).ShouldBeEmpty();
        One(Valid() with { ContactNumber = "0917" + new string('-', 20) + "1234567" }, "contactNumber", "Enter a mobile number, like 0917 123 4567.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void AnEmptyEmailIsAccepted(string? email) => Fields(Valid() with { Email = email }).ShouldBeEmpty();

    [Theory]
    [InlineData("nope")]
    [InlineData("juan@")]
    [InlineData("juan@example")]
    [InlineData("Juan <juan@example.com>")]
    public void AnEmailThatIsNotAnAddressIsRefused(string email) =>
        One(Valid() with { Email = email }, "email", "Enter a valid email, like name@gmail.com");

    [Fact]
    public void AnEmailIsLimitedToTwoHundredFiftyFourCharacters()
    {
        var domain = string.Concat(Enumerable.Repeat(new string('b', 60) + ".", 4)) + "com";

        Fields(Valid() with { Email = new string('x', 6) + "@" + domain }).ShouldBeEmpty();
        One(Valid() with { Email = new string('x', 7) + "@" + domain }, "email", "Keep the email to 254 characters or fewer.");
    }

    [Theory]
    [InlineData("custom")]
    [InlineData("not-sure")]
    public void ACustomOrNotSureChoiceNeedsNoLineKey(string choice) => Fields(Valid() with { ProductChoice = choice, ProductLineKey = null }).ShouldBeEmpty();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void NoChoiceIsAccepted(string? choice) => Fields(Valid() with { ProductChoice = choice, ProductLineKey = null }).ShouldBeEmpty();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ALineChoiceWithNoKeyIsRefused(string? key) =>
        One(Valid() with { ProductChoice = "line", ProductLineKey = key }, "productLineKey", "Choose a product from the list.");

    [Theory]
    [InlineData("banana")]
    [InlineData("LINE")]
    public void AnUnknownChoiceIsRefused(string choice) =>
        One(Valid() with { ProductChoice = choice }, "productChoice", "Choose a product from the list.");

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("1-9")]
    [InlineData("10-20")]
    [InlineData("21-50")]
    [InlineData("51-100")]
    [InlineData("100+")]
    [InlineData(" 10-20 ")]
    public void AnEmptyOrKnownQuantityIsAccepted(string? quantity) => Fields(Valid() with { Quantity = quantity }).ShouldBeEmpty();

    [Theory]
    [InlineData("7-8")]
    [InlineData("many")]
    [InlineData("0")]
    public void AnUnknownQuantityIsRefused(string quantity) => One(Valid() with { Quantity = quantity }, "quantity", "Choose a quantity from the list.");

    [Fact]
    public void AMessageIsLimitedToTwoThousandUtf16Units()
    {
        Fields(Valid() with { Message = new string('m', 2000) }).ShouldBeEmpty();
        One(Valid() with { Message = new string('m', 2001) }, "message", "Keep your message to 2,000 characters or fewer.");
        One(Valid() with { Message = new string('m', 1999) + "\U0001F600" }, "message", "Keep your message to 2,000 characters or fewer.");
    }

    private static CreateQuoteRequestRequest Valid() => new(
        "Juan Dela Cruz",
        "Brgy. San Roque Ballers",
        "0917 123 4567",
        "juan.dc@example.com",
        "line",
        "basketball",
        "10-20",
        "Need 15 jerseys by Dec 12.");

    private static Dictionary<string, string[]> Fields(CreateQuoteRequestRequest request)
    {
        ValidationResult result = Validator.Validate(request);
        return result.IsValid
            ? []
            : ValidationResults.ToError(result, "quote-requests.validation", "Check the highlighted fields.").FieldErrors.ShouldNotBeNull()
                .ToDictionary(pair => pair.Key, pair => pair.Value);
    }

    private static void One(CreateQuoteRequestRequest request, string field, string message)
    {
        var fields = Fields(request);
        fields.Keys.ShouldBe([field]);
        fields[field].ShouldBe([message]);
    }
}

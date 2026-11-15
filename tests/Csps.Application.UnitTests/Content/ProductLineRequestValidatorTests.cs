using System.Globalization;
using Csps.Application.Content;
using FluentValidation;

namespace Csps.Application.UnitTests.Content;

/// <summary>OR-3, CONT-02, D-07: the product line form is judged by the UI-SPEC rules with the approved words, and an edit needs its version.</summary>
public sealed class ProductLineRequestValidatorTests
{
    private static readonly ProductLineRequestValidator Validator = new();

    private static readonly ProductLineRequest Valid = new(
        "Shorts", "Shorts", "7", "Light shorts for the team.", "Printed shorts.", "Mesh", "No collar", "Standard", "Any font", "Crest", null, null, false, null, null);

    private static Dictionary<string, string[]> Failures(ProductLineRequest request, bool edit = false)
    {
        var context = new ValidationContext<ProductLineRequest>(request);
        if (edit)
        {
            context.RootContextData[ProductLineRequestValidator.EditKey] = true;
        }

        return Validator.Validate(context).Errors
            .GroupBy(failure => failure.PropertyName, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.Select(failure => failure.ErrorMessage).ToArray(), StringComparer.Ordinal);
    }

    [Fact]
    public void AValidFormHasNoFailuresWhetherAddingOrEditingWithAVersion()
    {
        Failures(Valid).ShouldBeEmpty();
        Failures(Valid with { Version = Convert.ToBase64String(new byte[8]) }, edit: true).ShouldBeEmpty();
    }

    [Fact]
    public void AnEditNeedsAWellFormedVersionAndAnAddIgnoresIt()
    {
        Failures(Valid, edit: true)["Version"].ShouldBe(["Reload the form and try again."]);
        Failures(Valid with { Version = "not base 64" }, edit: true)["Version"].ShouldBe(["Reload the form and try again."]);
        Failures(Valid with { Version = "not base 64" }).ShouldBeEmpty();
    }

    [Fact]
    public void TheEmptyFormFailsOnEveryRequiredField() =>
        Failures(ProductLineRequest.Empty).Keys.ShouldBe(["title", "shortName", "cardText", "description", "fabricText", "collarText", "cutText", "namesText", "logosText"]);

    [Fact]
    public void TheTitleAndShortNameMessages()
    {
        Failures(Valid with { Title = " " })["title"].ShouldBe(["Enter the title."]);
        Failures(Valid with { Title = new string('a', 61) })["title"].ShouldBe(["Keep the title to 60 characters or fewer."]);
        Failures(Valid with { ShortName = null })["shortName"].ShouldBe(["Enter a short name."]);
        Failures(Valid with { ShortName = new string('a', 21) })["shortName"].ShouldBe(["Keep the short name to 20 characters or fewer."]);
    }

    [Theory]
    [InlineData("A1", true)]
    [InlineData("23", true)]
    [InlineData("", true)]
    [InlineData("123", false)]
    [InlineData("$", false)]
    public void TheNumberIsUpToTwoLettersOrDigits(string number, bool fine)
    {
        var failures = Failures(Valid with { Number = number });

        if (fine)
        {
            failures.ShouldBeEmpty();
        }
        else
        {
            failures["number"].ShouldBe(["Use up to 2 letters or digits, like 23 or 3X."]);
        }
    }

    [Fact]
    public void TheWordsAndTheFiveCustomizeTextsMessages()
    {
        Failures(Valid with { CardText = "" })["cardText"].ShouldBe(["Enter the card text."]);
        Failures(Valid with { CardText = new string('a', 141) })["cardText"].ShouldBe(["Keep the card text to 140 characters or fewer."]);
        Failures(Valid with { Description = "" })["description"].ShouldBe(["Enter the description."]);
        Failures(Valid with { Description = new string('a', 301) })["description"].ShouldBe(["Keep the description to 300 characters or fewer."]);
        Failures(Valid with { FabricText = "" })["fabricText"].ShouldBe(["Enter the Fabric text."]);
        Failures(Valid with { CollarText = "" })["collarText"].ShouldBe(["Enter the Collar style text."]);
        Failures(Valid with { CutText = "" })["cutText"].ShouldBe(["Enter the Cut & fit text."]);
        Failures(Valid with { NamesText = "" })["namesText"].ShouldBe(["Enter the Names & numbers text."]);
        Failures(Valid with { LogosText = "" })["logosText"].ShouldBe(["Enter the Logos & sponsors text."]);
        Failures(Valid with { LogosText = new string('a', 121) })["logosText"].ShouldBe(["Keep this to 120 characters or fewer."]);
    }

    [Theory]
    [InlineData("0.01")]
    [InlineData("999999.99")]
    public void ThePriceLimitsPass(string price) =>
        Failures(Valid with { StartsAtPrice = decimal.Parse(price, CultureInfo.InvariantCulture) }).ShouldBeEmpty();

    [Theory]
    [InlineData("0.00", "Enter a price of at least ₱0.01.")]
    [InlineData("1000000.00", "Enter a price up to ₱999,999.99.")]
    [InlineData("1.234", "Use at most 2 decimal places.")]
    public void APriceOutsideTheRulesIsRefusedWithItsMessage(string price, string message) =>
        Failures(Valid with { StartsAtPrice = decimal.Parse(price, CultureInfo.InvariantCulture) })["startsAtPrice"].ShouldBe([message]);

    [Theory]
    [InlineData("1")]
    [InlineData("9999")]
    public void TheMinimumLimitsPass(string minimum) =>
        Failures(Valid with { MinimumQuantity = decimal.Parse(minimum, CultureInfo.InvariantCulture) }).ShouldBeEmpty();

    [Theory]
    [InlineData("0")]
    [InlineData("10000")]
    [InlineData("1.5")]
    public void AMinimumOutsideTheRulesIsRefused(string minimum) =>
        Failures(Valid with { MinimumQuantity = decimal.Parse(minimum, CultureInfo.InvariantCulture) })["minimumQuantity"].ShouldBe(["Enter a whole number from 1 to 9,999."]);

    [Fact]
    public void TheMoveFormAcceptsUpAndDownInAnyCaseAndNothingElse()
    {
        var validator = new MoveProductLineRequestValidator();

        validator.Validate(new MoveProductLineRequest("up")).IsValid.ShouldBeTrue();
        validator.Validate(new MoveProductLineRequest("DOWN")).IsValid.ShouldBeTrue();
        foreach (var bad in new string?[] { null, "", "sideways", "u" })
        {
            var result = validator.Validate(new MoveProductLineRequest(bad));
            result.IsValid.ShouldBeFalse();
            result.Errors.Single().ErrorMessage.ShouldBe("Check the highlighted fields.");
        }

        MoveProductLineRequest.Empty.Direction.ShouldBeNull();
    }
}

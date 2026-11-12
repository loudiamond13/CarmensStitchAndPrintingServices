using Csps.Application.Content;
using FluentValidation;

namespace Csps.Application.UnitTests.Content;

/// <summary>OR-3, CONT-03, D-05: the testimonial form is judged by the UI-SPEC rules with the approved words, and an edit needs its version.</summary>
public sealed class TestimonialRequestValidatorTests
{
    private static readonly TestimonialRequestValidator Validator = new();

    private static readonly TestimonialRequest Valid = new("Seventeen pieces, names and numbers perfect.", "Juan Dela Cruz", "Captain, Brgy. Sample Ballers", 5, true, null);

    private static Dictionary<string, string[]> Failures(TestimonialRequest request, bool edit = false)
    {
        var context = new ValidationContext<TestimonialRequest>(request);
        if (edit)
        {
            context.RootContextData[TestimonialRequestValidator.EditKey] = true;
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
    public void TheEmptyFormFailsOnTheQuoteTheNameAndTheStars() =>
        Failures(TestimonialRequest.Empty).Keys.ShouldBe(["quote", "name", "stars"]);

    [Fact]
    public void TheQuoteMessages()
    {
        Failures(Valid with { Quote = " " })["quote"].ShouldBe(["Enter the quote."]);
        Failures(Valid with { Quote = new string('q', 300) }).ShouldBeEmpty();
        Failures(Valid with { Quote = new string('q', 301) })["quote"].ShouldBe(["Keep the quote to 300 characters or fewer."]);
    }

    [Fact]
    public void TheNameMessages()
    {
        Failures(Valid with { Name = null })["name"].ShouldBe(["Enter the name."]);
        Failures(Valid with { Name = new string('n', 60) }).ShouldBeEmpty();
        Failures(Valid with { Name = new string('n', 61) })["name"].ShouldBe(["Keep the name to 60 characters or fewer."]);
    }

    [Fact]
    public void TheTeamLineIsOptionalAndAtMostEighty()
    {
        Failures(Valid with { TeamOrRole = null }).ShouldBeEmpty();
        Failures(Valid with { TeamOrRole = new string('t', 80) }).ShouldBeEmpty();
        Failures(Valid with { TeamOrRole = new string('t', 81) })["teamOrRole"].ShouldBe(["Keep this to 80 characters or fewer."]);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public void StarsOutsideOneToFiveAreRefused(int stars) =>
        Failures(Valid with { Stars = stars })["stars"].ShouldBe(["Choose 1 to 5 stars."]);

    [Fact]
    public void AMissingOrFractionalStarCountIsRefusedWithTheSameMessage()
    {
        Failures(Valid with { Stars = null })["stars"].ShouldBe(["Choose 1 to 5 stars."]);
        Failures(Valid with { Stars = 2.5m })["stars"].ShouldBe(["Choose 1 to 5 stars."]);
    }

    [Fact]
    public void TheMoveFormTakesUpOrDownInAnyLetterCase()
    {
        var move = new MoveTestimonialRequestValidator();

        move.Validate(new MoveTestimonialRequest("up")).IsValid.ShouldBeTrue();
        move.Validate(new MoveTestimonialRequest("DOWN")).IsValid.ShouldBeTrue();
        move.Validate(new MoveTestimonialRequest("sideways")).IsValid.ShouldBeFalse();
        move.Validate(MoveTestimonialRequest.Empty).IsValid.ShouldBeFalse();
    }
}

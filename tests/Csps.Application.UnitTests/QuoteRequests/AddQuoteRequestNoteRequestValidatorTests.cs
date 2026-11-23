using Csps.Application.QuoteRequests;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>INQ-05, D-17, OR-3: a note is 1 to 1,000 characters after trimming, with the same words the web form shows.</summary>
public sealed class AddQuoteRequestNoteRequestValidatorTests
{
    private readonly AddQuoteRequestNoteRequestValidator _validator = new();

    [Theory]
    [InlineData("Called, will send mockup Friday.")]
    [InlineData("a")]
    [InlineData("  Line one.\nLine two.  ")]
    public void ANoteWithTextIsAccepted(string text)
    {
        _validator.Validate(new AddQuoteRequestNoteRequest(text)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\n\t ")]
    public void AnEmptyNoteIsRefused(string? text)
    {
        Refused(new AddQuoteRequestNoteRequest(text), "Write a note first.");
    }

    [Fact]
    public void ExactlyOneThousandCharactersAfterTrimmingIsAccepted()
    {
        _validator.Validate(new AddQuoteRequestNoteRequest($"  {new string('a', 1000)}  ")).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void OneThousandAndOneCharactersIsRefused()
    {
        Refused(new AddQuoteRequestNoteRequest(new string('a', 1001)), "Keep the note to 1,000 characters or fewer.");
    }

    [Fact]
    public void TheEmptyRequestReportsTheText()
    {
        Refused(AddQuoteRequestNoteRequest.Empty, "Write a note first.");
    }

    private void Refused(AddQuoteRequestNoteRequest request, string message)
    {
        var result = _validator.Validate(request);

        result.IsValid.ShouldBeFalse();
        var error = result.Errors.ShouldHaveSingleItem();
        error.PropertyName.ShouldBe("Text");
        error.ErrorMessage.ShouldBe(message);
    }
}

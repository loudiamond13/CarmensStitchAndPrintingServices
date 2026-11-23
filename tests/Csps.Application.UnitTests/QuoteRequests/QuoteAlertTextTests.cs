using Csps.Application.QuoteRequests;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>INQ-04, D-08, D-33, review W1 IN-04: the alert cuts long text, and no visitor text can add a header or a line.</summary>
public sealed class QuoteAlertTextTests
{
    private const string Prefix = "New quote request from ";

    [Fact]
    public void TheLimitsAreTheOwnersNumbers()
    {
        QuoteAlertText.SubjectNameLimit.ShouldBe(60);
        QuoteAlertText.MessageExcerptLimit.ShouldBe(300);
    }

    [Fact]
    public void AShortNameIsKeptWhole()
    {
        QuoteAlertText.Subject("Juan Dela Cruz").ShouldBe(Prefix + "Juan Dela Cruz");
    }

    [Fact]
    public void ASixtyCharacterNameIsKept()
    {
        var name = new string('a', 60);

        QuoteAlertText.Subject(name).ShouldBe(Prefix + name);
    }

    [Fact]
    public void ASixtyOneCharacterNameIsCutToSixtyWithAnEllipsis()
    {
        var name = new string('a', 61);

        QuoteAlertText.Subject(name).ShouldBe(Prefix + new string('a', 60) + "…");
    }

    [Fact]
    public void ACutNeverSplitsAnEmojiInHalf()
    {
        var name = new string('a', 59) + "😀" + "bc";

        QuoteAlertText.Subject(name).ShouldBe(Prefix + new string('a', 59) + "…");
    }

    [Theory]
    [InlineData("Juan\r\nBcc: evil@example.com", "Juan Bcc: evil@example.com")]
    [InlineData("Juan\nDela\rCruz", "Juan Dela Cruz")]
    [InlineData("Juan\u0000\u001bCruz", "Juan Cruz")]
    [InlineData("  Juan \t  Cruz  ", "Juan Cruz")]
    [InlineData("Juan\u2028Cruz", "Juan Cruz")]
    public void ControlCharactersAndLineBreaksBecomeOneSpaceInTheSubject(string name, string expected)
    {
        var subject = QuoteAlertText.Subject(name);

        subject.ShouldBe(Prefix + expected);
        subject.ShouldNotContain("\r");
        subject.ShouldNotContain("\n");
        subject.Any(char.IsControl).ShouldBeFalse();
    }

    [Fact]
    public void TheShortNameIsCutTheSameWayAsTheSubject()
    {
        QuoteAlertText.ShortName(new string('b', 61)).ShouldBe(new string('b', 60) + "…");
        QuoteAlertText.ShortName("Juan\r\nCruz").ShouldBe("Juan Cruz");
    }

    [Fact]
    public void OneLineKeepsTheWholeValueButAddsNoLineBreak()
    {
        var value = new string('c', 200) + "\r\nPhone: 000";

        QuoteAlertText.OneLine(value).ShouldBe(new string('c', 200) + " Phone: 000");
    }

    [Fact]
    public void AThreeHundredCharacterMessageIsKept()
    {
        var message = new string('m', 300);

        QuoteAlertText.Excerpt(message).ShouldBe(message);
    }

    [Fact]
    public void AThreeHundredAndOneCharacterMessageIsCutToThreeHundredWithAnEllipsis()
    {
        var message = new string('m', 301);

        QuoteAlertText.Excerpt(message).ShouldBe(new string('m', 300) + "…");
    }

    [Fact]
    public void AMessageKeepsItsLineBreaksAsPlainNewLinesAndLosesOtherControlCharacters()
    {
        QuoteAlertText.Excerpt("one\r\ntwo\rthree\nfour\u0000\u001b five").ShouldBe("one\ntwo\nthree\nfour five");
    }

    [Fact]
    public void AMessageCutNeverSplitsAnEmojiInHalf()
    {
        var message = new string('m', 299) + "😀" + "tail";

        QuoteAlertText.Excerpt(message).ShouldBe(new string('m', 299) + "…");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  \r\n\t ")]
    public void NoMessageHasNoExcerpt(string? message)
    {
        QuoteAlertText.Excerpt(message).ShouldBeNull();
    }
}

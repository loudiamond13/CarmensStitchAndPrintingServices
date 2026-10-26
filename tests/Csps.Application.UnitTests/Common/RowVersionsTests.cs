using Csps.Application.Common;

namespace Csps.Application.UnitTests.Common;

/// <summary>SEC-07: a row version travels as base64 of exactly eight bytes; anything else is not a version.</summary>
public sealed class RowVersionsTests
{
    private static readonly byte[] Eight = [0, 0, 0, 0, 0, 0, 0x1F, 0xA4];

    [Fact]
    public void ToTextThenTryParseRoundTripsEightBytes()
    {
        var text = RowVersions.ToText(Eight);

        RowVersions.TryParse(text, out var parsed).ShouldBeTrue();
        parsed.ShouldBe(Eight);
    }

    [Fact]
    public void ToTextIsStandardBase64()
    {
        RowVersions.ToText(Eight).ShouldBe(Convert.ToBase64String(Eight));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not base64!")]
    [InlineData("AAAAAAAAAA==")]
    [InlineData("AAAAAAAAAAAAAA==")]
    public void ATextThatIsNotEightBytesOfBase64IsRefused(string? text)
    {
        RowVersions.TryParse(text, out var parsed).ShouldBeFalse();
        parsed.ShouldBeEmpty();
    }

    [Fact]
    public void SevenAndNineBytesAreRefused()
    {
        RowVersions.TryParse(Convert.ToBase64String(new byte[7]), out _).ShouldBeFalse();
        RowVersions.TryParse(Convert.ToBase64String(new byte[9]), out _).ShouldBeFalse();
    }

    [Fact]
    public void TheMessageIsTheOneTheProfileFormUses()
    {
        RowVersions.InvalidMessage.ShouldBe("Reload the form and try again.");
    }
}

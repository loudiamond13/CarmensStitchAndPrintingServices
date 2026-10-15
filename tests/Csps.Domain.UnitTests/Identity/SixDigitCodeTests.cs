using System.Globalization;
using Csps.Domain.Identity;

namespace Csps.Domain.UnitTests.Identity;

public sealed class SixDigitCodeTests
{
    [Theory]
    [InlineData("000123")]
    [InlineData("999999")]
    [InlineData("000000")]
    public void WellFormedCodesAreExactlySixAsciiDigits(string code)
    {
        SixDigitCode.IsWellFormed(code).ShouldBeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("1234567")]
    [InlineData("12a456")]
    [InlineData(" 123456")]
    [InlineData("１２３４５６")]
    public void MalformedCodesAreRejected(string? code)
    {
        SixDigitCode.IsWellFormed(code).ShouldBeFalse();
    }

    [Theory]
    [InlineData(0, "000000")]
    [InlineData(123, "000123")]
    [InlineData(999999, "999999")]
    public void FormatKeepsLeadingZeros(int value, string expected)
    {
        SixDigitCode.Format(value).ShouldBe(expected);
    }

    [Fact]
    public void FormatUsesTheInvariantCulture()
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = new CultureInfo("ar-SA");
            SixDigitCode.Format(123).ShouldBe("000123");
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(1_000_000)]
    public void FormatRejectsValuesOutsideTheRange(int value)
    {
        Should.Throw<ArgumentOutOfRangeException>(() => SixDigitCode.Format(value));
    }
}

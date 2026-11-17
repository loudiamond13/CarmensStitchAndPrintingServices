using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

public sealed class OsFamilyTests
{
    [Theory]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "iOS")]
    [InlineData("Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Version/15.0 Safari/604.1", "iOS")]
    [InlineData("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "iPadOS")]
    [InlineData("Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36", "Android")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", "Windows")]
    [InlineData("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", "macOS")]
    [InlineData("Mozilla/5.0 (Mac OS X 10_15_7) AppleWebKit/605.1.15", "macOS")]
    [InlineData("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", "ChromeOS")]
    [InlineData("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "Linux")]
    [InlineData("curl/8.0", "Other")]
    [InlineData("", "Other")]
    [InlineData(null, "Other")]
    public void FamilyIsNamed(string? userAgent, string expected)
    {
        OsFamily.From(userAgent).ShouldBe(expected);
    }

    [Fact]
    public void IPhoneAndIPadAreCheckedBeforeMac()
    {
        OsFamily.From("iPhone Mac OS X").ShouldBe("iOS");
        OsFamily.From("iPad Macintosh").ShouldBe("iPadOS");
    }

    [Fact]
    public void AndroidAndChromeOsAreCheckedBeforeLinux()
    {
        OsFamily.From("X11; Linux; Android 14").ShouldBe("Android");
        OsFamily.From("X11; Linux; CrOS x86_64").ShouldBe("ChromeOS");
    }

    [Fact]
    public void EveryLabelFitsTheColumn()
    {
        OsFamily.MaxLength.ShouldBe(20);
        string[] labels = ["iOS", "iPadOS", "Android", "Windows", "macOS", "ChromeOS", "Linux", "Other"];

        labels.ShouldAllBe(label => label.Length <= OsFamily.MaxLength);
    }

    [Fact]
    public void ReadsOnlyTheFirst512Characters()
    {
        var userAgent = new string('a', 600) + "Windows" + new string('a', 100);

        OsFamily.From(userAgent).ShouldBe("Other");
    }

    [Fact]
    public void TokenEndingAtCharacter512IsRead()
    {
        var userAgent = new string('a', 512 - "Windows".Length) + "Windows" + new string('a', 100);

        OsFamily.From(userAgent).ShouldBe("Windows");
    }

    [Fact]
    public void TokenCrossingCharacter512IsNotRead()
    {
        var userAgent = new string('a', 512 - "Windows".Length + 1) + "Windows" + new string('a', 100);

        OsFamily.From(userAgent).ShouldBe("Other");
    }
}

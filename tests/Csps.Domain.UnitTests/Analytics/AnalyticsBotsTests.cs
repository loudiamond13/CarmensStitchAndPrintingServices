using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

public sealed class AnalyticsBotsTests
{
    [Theory]
    [InlineData("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/129.0.6668.70 Safari/537.36")]
    [InlineData("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")]
    [InlineData("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36")]
    [InlineData("mozilla/5.0 (linux; android 11) applewebkit/537.36 chrome/109.0.0.0 mobile safari/537.36 chrome-lighthouse")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 PTST/240101.1")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0) Chrome/129.0.0.0 Safari/537.36 ptst/1")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0) Chrome/129.0.0.0 Safari/537.36 LIGHTHOUSE")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0) Chrome/129.0.0.0 Safari/537.36 headlesschrome/1")]
    public void BotsAndTestRunnersAreBots(string userAgent)
    {
        AnalyticsBots.IsBot(userAgent).ShouldBeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void MissingOrBlankIsABot(string? userAgent)
    {
        AnalyticsBots.IsBot(userAgent).ShouldBeTrue();
    }

    [Theory]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Safari/537.36")]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")]
    [InlineData("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.5 Mobile Safari/537.36")]
    [InlineData("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0")]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/482.0.0.39.106]")]
    public void NormalBrowsersAreNotBots(string userAgent)
    {
        AnalyticsBots.IsBot(userAgent).ShouldBeFalse();
    }

    [Fact]
    public void ReadsOnlyTheFirst512CharactersForTheExtraTokens()
    {
        const string chrome = "Mozilla/5.0 (Windows NT 10.0) Chrome/129.0.0.0 Safari/537.36 ";
        var userAgent = chrome + new string('a', 600) + "HeadlessChrome" + new string('a', 100);

        AnalyticsBots.IsBot(userAgent).ShouldBeFalse();
    }

    [Fact]
    public void ExtraTokenEndingAtCharacter512IsRead()
    {
        const string chrome = "Mozilla/5.0 (Windows NT 10.0) Chrome/129.0.0.0 Safari/537.36 ";
        var userAgent = chrome + new string('a', 512 - chrome.Length - "PTST".Length) + "PTST" + new string('a', 100);

        AnalyticsBots.IsBot(userAgent).ShouldBeTrue();
    }

    [Fact]
    public void ExtraTokenCrossingCharacter512IsNotRead()
    {
        const string chrome = "Mozilla/5.0 (Windows NT 10.0) Chrome/129.0.0.0 Safari/537.36 ";
        var userAgent = chrome + new string('a', 512 - chrome.Length - "PTST".Length + 1) + "PTST" + new string('a', 100);

        AnalyticsBots.IsBot(userAgent).ShouldBeFalse();
    }
}

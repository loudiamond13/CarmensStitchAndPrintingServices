using Csps.Domain.Identity;

namespace Csps.Domain.UnitTests.Identity;

public sealed class DeviceSummaryTests
{
    private const string PixelChrome =
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

    private const string IPhoneSafari =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1";

    private const string IPadSafari =
        "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1";

    private const string WindowsEdge =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";

    private const string MacFirefox =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0";

    private const string ChromebookChrome =
        "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

    private const string SamsungAndroid =
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";

    private const string FacebookIPhone =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/482.0.0.39.106;FBBV/663478938;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.6]";

    private const string InstagramIPhone =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 346.0.0.29.92 (iPhone14,5; iOS 17_6; en_US)";

    private const string OperaWindows =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0";

    private const string ChromeLinux =
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

    private const string SafariOldMacToken =
        "Mozilla/5.0 (Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";

    [Theory]
    [InlineData(PixelChrome, "Chrome on Android")]
    [InlineData(IPhoneSafari, "Safari on iPhone")]
    [InlineData(IPadSafari, "Safari on iPad")]
    [InlineData(WindowsEdge, "Edge on Windows")]
    [InlineData(MacFirefox, "Firefox on Mac")]
    [InlineData(ChromebookChrome, "Chrome on Chromebook")]
    [InlineData(SamsungAndroid, "Samsung Internet on Android")]
    [InlineData(FacebookIPhone, "Facebook app on iPhone")]
    [InlineData(InstagramIPhone, "Instagram app on iPhone")]
    [InlineData(OperaWindows, "Opera on Windows")]
    [InlineData(ChromeLinux, "Chrome on Linux")]
    [InlineData(SafariOldMacToken, "Safari on Mac")]
    public void KnownBrowsersAreNamedWithTheirDevice(string userAgent, string label)
    {
        var description = DeviceSummary.Describe(userAgent);

        description.Label.ShouldBe(label);
        description.IsKnown.ShouldBeTrue();
    }

    [Fact]
    public void ABrowserOnAnUnknownDeviceIsNamedAlone()
    {
        var description = DeviceSummary.Describe("Mozilla/5.0 Firefox/131.0");

        description.Label.ShouldBe("Firefox");
        description.IsKnown.ShouldBeTrue();
    }

    [Theory]
    [InlineData("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("curl/8.5.0")]
    public void BotsBlankAndUnknownAgentsAreUnknownBrowser(string? userAgent)
    {
        var description = DeviceSummary.Describe(userAgent);

        description.Label.ShouldBe("Unknown browser");
        description.IsKnown.ShouldBeFalse();
    }

    [Fact]
    public void OnlyTheFirst512CharactersAreScanned()
    {
        var userAgent = "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0 " + new string('x', 600) + " Android Edg/1";

        DeviceSummary.Describe(userAgent).Label.ShouldBe("Chrome on Windows");
    }

    [Theory]
    [InlineData(PixelChrome)]
    [InlineData(SamsungAndroid)]
    [InlineData(ChromebookChrome)]
    [InlineData(FacebookIPhone)]
    public void TheLabelNeverExceedsTheStoredLimit(string userAgent)
    {
        DeviceSummary.Describe(userAgent).Label.Length.ShouldBeLessThanOrEqualTo(UserSession.DeviceLabelMaxLength);
    }

    [Fact]
    public void TheLabelCarriesNoVersionAddressOrModel()
    {
        var label = DeviceSummary.Describe(PixelChrome).Label;

        label.ShouldNotContain("130");
        label.ShouldNotContain("Pixel");
        label.ShouldNotContain("14");
    }
}

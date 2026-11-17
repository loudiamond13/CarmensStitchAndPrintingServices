using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

public sealed class DeviceClassTests
{
    private const string IPhoneSafari =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

    private const string SamsungPhoneChrome =
        "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";

    private const string AndroidTabletChrome =
        "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

    private const string IPadSafari =
        "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

    private const string WindowsChrome =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

    private const string MacSafari =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

    private const string ChromeOs =
        "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

    private const string LinuxFirefox =
        "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";

    [Fact]
    public void KindsHaveTheStoredValues()
    {
        ((byte)DeviceKind.Phone).ShouldBe((byte)1);
        ((byte)DeviceKind.Tablet).ShouldBe((byte)2);
        ((byte)DeviceKind.Computer).ShouldBe((byte)3);
        ((byte)DeviceKind.Other).ShouldBe((byte)4);
    }

    [Theory]
    [InlineData(IPhoneSafari)]
    [InlineData(SamsungPhoneChrome)]
    [InlineData("Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Version/15.0 Safari/604.1")]
    [InlineData("Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950) Mobile Safari/537.36 Edge/15.14977")]
    [InlineData("Opera/9.80 (J2ME/MIDP; Opera Mini/9.80) Mobi")]
    [InlineData("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36 Mobile")]
    public void PhonesArePhone(string userAgent)
    {
        DeviceClass.From(userAgent).ShouldBe(DeviceKind.Phone);
    }

    [Theory]
    [InlineData(IPadSafari)]
    [InlineData(AndroidTabletChrome)]
    [InlineData("Mozilla/5.0 (Linux; U; Android 4.0.3; en-us; KFTT Build/IML74K) AppleWebKit/535.19 Silk/3.0 Tablet Safari/535.19")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64; Tablet PC 2.0) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36")]
    [InlineData("mozilla/5.0 (ipad; cpu os 17_5 like mac os x)")]
    public void TabletsAreTablet(string userAgent)
    {
        DeviceClass.From(userAgent).ShouldBe(DeviceKind.Tablet);
    }

    [Theory]
    [InlineData(WindowsChrome)]
    [InlineData(MacSafari)]
    [InlineData(ChromeOs)]
    [InlineData(LinuxFirefox)]
    public void DesktopsAreComputer(string userAgent)
    {
        DeviceClass.From(userAgent).ShouldBe(DeviceKind.Computer);
    }

    [Fact]
    public void IPadOsSafariWithAMacHeaderIsComputer()
    {
        DeviceClass.From(MacSafari).ShouldBe(DeviceKind.Computer);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("curl/8.0")]
    [InlineData("SomeGameConsole/1.0")]
    public void AnythingElseIsOther(string? userAgent)
    {
        DeviceClass.From(userAgent).ShouldBe(DeviceKind.Other);
    }

    [Fact]
    public void ReadsOnlyTheFirst512Characters()
    {
        var userAgent = new string('a', 600) + "iPhone" + new string('a', 100);

        DeviceClass.From(userAgent).ShouldBe(DeviceKind.Other);
    }

    [Fact]
    public void TokenEndingAtCharacter512IsRead()
    {
        var userAgent = new string('a', 512 - "iPhone".Length) + "iPhone" + new string('a', 100);

        DeviceClass.From(userAgent).ShouldBe(DeviceKind.Phone);
    }

    [Fact]
    public void TokenCrossingCharacter512IsNotRead()
    {
        var userAgent = new string('a', 512 - "iPhone".Length + 1) + "iPhone" + new string('a', 100);

        DeviceClass.From(userAgent).ShouldBe(DeviceKind.Other);
    }
}

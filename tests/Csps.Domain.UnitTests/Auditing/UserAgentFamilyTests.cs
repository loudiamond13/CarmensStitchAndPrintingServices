using System.Reflection;
using Csps.Domain.Auditing;

namespace Csps.Domain.UnitTests.Auditing;

public sealed class UserAgentFamilyTests
{
    private const string Googlebot =
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/129.0.6668.70 Safari/537.36";

    private const string EdgeDesktop =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";

    [Fact]
    public void GooglebotIsBotEvenThoughItSaysChrome()
    {
        UserAgentFamily.Classify(Googlebot).ShouldBe("Bot");
    }

    [Fact]
    public void EdgeDesktopIsEdgeEvenThoughItSaysChrome()
    {
        UserAgentFamily.Classify(EdgeDesktop).ShouldBe("Edge");
    }

    [Theory]
    [InlineData("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")]
    [InlineData("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")]
    [InlineData("Mozilla/5.0 (compatible; SiteAuditCrawler/1.0)")]
    [InlineData("Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)")]
    [InlineData("Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)")]
    [InlineData("GOOGLEBOT/2.1")]
    public void BotsAreBot(string userAgent)
    {
        UserAgentFamily.Classify(userAgent).ShouldBe("Bot");
    }

    [Theory]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/482.0.0.39.106;FBBV/663478938;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/80]")]
    [InlineData("Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/483.0.0.53.109;]")]
    public void FacebookInAppBrowserIsFacebookInApp(string userAgent)
    {
        UserAgentFamily.Classify(userAgent).ShouldBe("Facebook in-app");
    }

    [Fact]
    public void InstagramInAppBrowserIsInstagramInApp()
    {
        const string instagram =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 346.0.0.29.92 (iPhone14,5; iOS 17_6; en_US; en; scale=3.00; 1170x2532; 634108168)";

        UserAgentFamily.Classify(instagram).ShouldBe("Instagram in-app");
    }

    [Theory]
    [InlineData("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 EdgA/129.0.0.0")]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/129.2792.84 Mobile/15E148 Safari/605.1.15")]
    public void EdgeMobileIsEdge(string userAgent)
    {
        UserAgentFamily.Classify(userAgent).ShouldBe("Edge");
    }

    [Theory]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0")]
    [InlineData("Opera/9.80 (Windows NT 6.1; U; en) Presto/2.12.388 Version/12.18")]
    public void OperaIsOpera(string userAgent)
    {
        UserAgentFamily.Classify(userAgent).ShouldBe("Opera");
    }

    [Fact]
    public void SamsungBrowserIsSamsungInternet()
    {
        const string samsung =
            "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36";

        UserAgentFamily.Classify(samsung).ShouldBe("Samsung Internet");
    }

    [Theory]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0")]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15")]
    public void FirefoxIsFirefox(string userAgent)
    {
        UserAgentFamily.Classify(userAgent).ShouldBe("Firefox");
    }

    [Theory]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1")]
    [InlineData("mozilla/5.0 (x11; linux x86_64) chrome/129.0.0.0")]
    public void ChromeIsChrome(string userAgent)
    {
        UserAgentFamily.Classify(userAgent).ShouldBe("Chrome");
    }

    [Theory]
    [InlineData("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15")]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")]
    public void SafariIsSafari(string userAgent)
    {
        UserAgentFamily.Classify(userAgent).ShouldBe("Safari");
    }

    [Theory]
    [InlineData("curl/8.0")]
    [InlineData("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36")]
    [InlineData("Version/18.0 Mobile")]
    public void AnythingElseIsOther(string userAgent)
    {
        UserAgentFamily.Classify(userAgent).ShouldBe("Other");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("\t\r\n ")]
    public void MissingOrBlankIsUnknown(string? userAgent)
    {
        UserAgentFamily.Classify(userAgent).ShouldBe("Unknown");
    }

    [Fact]
    public void ReadsOnlyTheFirst512Characters()
    {
        var userAgent = new string('a', 600) + "Firefox/131.0";
        userAgent += new string('a', 10_000 - userAgent.Length);
        userAgent.Length.ShouldBe(10_000);

        UserAgentFamily.Classify(userAgent).ShouldBe("Other");
    }

    [Fact]
    public void TokenEndingAtCharacter512IsRead()
    {
        var userAgent = new string('a', 512 - "Firefox/".Length) + "Firefox/" + new string('a', 100);

        UserAgentFamily.Classify(userAgent).ShouldBe("Firefox");
    }

    [Fact]
    public void TokenCrossingCharacter512IsNotRead()
    {
        var userAgent = new string('a', 512 - "Firefox/".Length + 1) + "Firefox/" + new string('a', 100);

        UserAgentFamily.Classify(userAgent).ShouldBe("Other");
    }

    [Fact]
    public void EveryLabelFitsTheColumn()
    {
        var labels = typeof(UserAgentFamily)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(f => f.IsLiteral && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!)
            .ToList();

        labels.ShouldBe(
            [
                "Bot", "Facebook in-app", "Instagram in-app", "Edge", "Opera", "Samsung Internet",
                "Firefox", "Chrome", "Safari", "Other", "Unknown",
            ],
            ignoreOrder: true);
        labels.ShouldAllBe(label => label.Length <= AuditEntry.UserAgentFamilyMaxLength);
    }

    [Fact]
    public void AuditEntryStoresTheFamilyNotTheHeader()
    {
        var entry = AuditEntry.Create(
            new DateTimeOffset(2026, 10, 7, 1, 2, 3, TimeSpan.Zero),
            actorUserId: null,
            "system.check",
            targetType: null,
            targetId: null,
            remoteIp: null,
            Googlebot,
            "0123456789abcdef0123456789abcdef",
            detail: null);

        entry.UserAgentFamily.ShouldBe("Bot");
    }
}

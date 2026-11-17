using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

public sealed class ReferrerNameTests
{
    private const string Site = "csps.example";

    private const string DesktopChrome =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

    private const string FacebookIos =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/482.0.0.39.106;FBBV/663478938;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/80]";

    private const string MessengerIos =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0.0.0.0;FBBV/1;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBID/phone;FBLC/en_US]";

    private const string MessengerAndroid =
        "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/480.0.0.0.0;]";

    private const string FacebookAndroid =
        "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/483.0.0.53.109;]";

    private const string InstagramIos =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 346.0.0.29.92 (iPhone14,5; iOS 17_6; en_US; en; scale=3.00; 1170x2532; 634108168)";

    [Fact]
    public void NamesAreTheFixedLabels()
    {
        ReferrerName.Facebook.ShouldBe("Facebook");
        ReferrerName.Messenger.ShouldBe("Messenger");
        ReferrerName.Instagram.ShouldBe("Instagram");
        ReferrerName.Google.ShouldBe("Google");
        ReferrerName.Direct.ShouldBe("Direct");
        ReferrerName.MaxLength.ShouldBe(253);
    }

    [Theory]
    [InlineData("m.facebook.com")]
    [InlineData("l.facebook.com")]
    [InlineData("lm.facebook.com")]
    [InlineData("www.facebook.com")]
    [InlineData("facebook.com")]
    [InlineData("FACEBOOK.COM")]
    [InlineData("com.facebook.katana")]
    public void FacebookHostsAreFacebook(string host)
    {
        ReferrerName.From(host, Site, DesktopChrome).ShouldBe("Facebook");
    }

    [Theory]
    [InlineData("messenger.com")]
    [InlineData("www.messenger.com")]
    [InlineData("l.messenger.com")]
    [InlineData("com.facebook.orca")]
    public void MessengerHostsAreMessenger(string host)
    {
        ReferrerName.From(host, Site, DesktopChrome).ShouldBe("Messenger");
    }

    [Theory]
    [InlineData("instagram.com")]
    [InlineData("l.instagram.com")]
    [InlineData("www.instagram.com")]
    [InlineData("com.instagram.android")]
    public void InstagramHostsAreInstagram(string host)
    {
        ReferrerName.From(host, Site, DesktopChrome).ShouldBe("Instagram");
    }

    [Theory]
    [InlineData("google.com")]
    [InlineData("www.google.com")]
    [InlineData("google.com.ph")]
    [InlineData("www.google.com.ph")]
    [InlineData("www.google.co.uk")]
    [InlineData("google.ph")]
    [InlineData("google.de")]
    [InlineData("images.google.com.ph")]
    [InlineData("WWW.GOOGLE.COM")]
    public void GoogleHostsAreGoogle(string host)
    {
        ReferrerName.From(host, Site, DesktopChrome).ShouldBe("Google");
    }

    [Theory]
    [InlineData("notgoogle.com", "notgoogle.com")]
    [InlineData("notfacebook.com", "notfacebook.com")]
    [InlineData("google.evil.example", "google.evil.example")]
    [InlineData("google.com.evil.example", "google.com.evil.example")]
    [InlineData("google.xyz", "google.xyz")]
    [InlineData("google.c1", "google.c1")]
    [InlineData("google.1c", "google.1c")]
    [InlineData("google", "google")]
    [InlineData("com.google.com.ph.example", "com.google.com.ph.example")]
    [InlineData("facebook.com.evil.example", "facebook.com.evil.example")]
    [InlineData("xfacebook.com", "xfacebook.com")]
    [InlineData("com.facebook.katanax", "com.facebook.katanax")]
    public void LookAlikeHostsAreTheirOwnHost(string host, string expected)
    {
        ReferrerName.From(host, Site, DesktopChrome).ShouldBe(expected);
    }

    [Theory]
    [InlineData("www.Basketball-League.ph", "basketball-league.ph")]
    [InlineData("riders.example.org", "riders.example.org")]
    [InlineData("Bing.com", "bing.com")]
    public void OtherHostsAreLowercasedWithWwwDropped(string host, string expected)
    {
        ReferrerName.From(host, Site, DesktopChrome).ShouldBe(expected);
    }

    [Fact]
    public void OnlyOneLeadingWwwIsDropped()
    {
        ReferrerName.From("www.www.example.org", Site, null).ShouldBe("www.example.org");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void NoReferrerIsDirectWithADesktopHeader(string? host)
    {
        ReferrerName.From(host, Site, DesktopChrome).ShouldBe("Direct");
    }

    [Theory]
    [InlineData("csps.example")]
    [InlineData("www.csps.example")]
    [InlineData("CSPS.EXAMPLE")]
    public void TheSitesOwnHostCountsAsNoReferrer(string host)
    {
        ReferrerName.From(host, Site, DesktopChrome).ShouldBe("Direct");
    }

    [Fact]
    public void SiteHostIsComparedWithWwwDropped()
    {
        ReferrerName.From("csps.example", "www.csps.example", DesktopChrome).ShouldBe("Direct");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("a b.com")]
    public void MissingOrInvalidSiteHostDoesNotHideARealReferrer(string? siteHost)
    {
        ReferrerName.From("riders.example.org", siteHost, DesktopChrome).ShouldBe("riders.example.org");
    }

    [Fact]
    public void NoReferrerAndNoHeaderIsDirect()
    {
        ReferrerName.From(null, Site, null).ShouldBe("Direct");
    }

    [Theory]
    [InlineData(FacebookIos)]
    [InlineData(FacebookAndroid)]
    [InlineData("Mozilla/5.0 Mobile [FBAN/FBIOS]")]
    [InlineData("Mozilla/5.0 Mobile [FBAV/480.0]")]
    [InlineData("Mozilla/5.0 Mobile [FB_IAB/FB4A]")]
    [InlineData("mozilla/5.0 mobile [fban/fbios]")]
    public void FacebookInAppHeaderWithNoReferrerIsFacebook(string userAgent)
    {
        ReferrerName.From(null, Site, userAgent).ShouldBe("Facebook");
        ReferrerName.From("", Site, userAgent).ShouldBe("Facebook");
        ReferrerName.From(Site, Site, userAgent).ShouldBe("Facebook");
    }

    [Theory]
    [InlineData(MessengerIos)]
    [InlineData(MessengerAndroid)]
    [InlineData("Mozilla/5.0 Mobile [FBAN/MessengerLiteForiOS;FBAV/400.0]")]
    public void MessengerInAppHeaderWithNoReferrerIsMessengerEvenThoughItCarriesFban(string userAgent)
    {
        ReferrerName.From(null, Site, userAgent).ShouldBe("Messenger");
    }

    [Fact]
    public void InstagramInAppHeaderWithNoReferrerIsInstagram()
    {
        ReferrerName.From(null, Site, InstagramIos).ShouldBe("Instagram");
    }

    [Fact]
    public void ARealReferrerAlwaysWinsOverTheHeader()
    {
        ReferrerName.From("riders.example.org", Site, FacebookIos).ShouldBe("riders.example.org");
        ReferrerName.From("www.google.com", Site, InstagramIos).ShouldBe("Google");
        ReferrerName.From("facebook.com", Site, MessengerIos).ShouldBe("Facebook");
    }

    [Theory]
    [InlineData("a b.com")]
    [InlineData("xn--ü.ph")]
    [InlineData("café.example")]
    [InlineData("host/path")]
    [InlineData("example.org/path?x=1")]
    [InlineData("https://evil.example/")]
    [InlineData("host:8080")]
    [InlineData("www.")]
    public void InvalidHostCountsAsNoReferrer(string host)
    {
        ReferrerName.From(host, Site, DesktopChrome).ShouldBe("Direct");
        ReferrerName.From(host, Site, FacebookIos).ShouldBe("Facebook");
    }

    [Fact]
    public void HostOf253CharactersIsKept()
    {
        var host = new string('a', 253);

        ReferrerName.From(host, Site, DesktopChrome).ShouldBe(host);
    }

    [Fact]
    public void HostOf254CharactersCountsAsNoReferrer()
    {
        var host = new string('a', 254);

        ReferrerName.From(host, Site, DesktopChrome).ShouldBe("Direct");
    }

    [Fact]
    public void HostOf253CharactersWithWwwIsKeptWithoutIt()
    {
        var host = "www." + new string('a', 249);

        ReferrerName.From(host, Site, DesktopChrome).ShouldBe(new string('a', 249));
    }

    [Fact]
    public void ReadsOnlyTheFirst512CharactersOfTheHeader()
    {
        var userAgent = new string('a', 600) + "FBAN/FBIOS" + new string('a', 100);

        ReferrerName.From(null, Site, userAgent).ShouldBe("Direct");
    }

    [Fact]
    public void TokenEndingAtCharacter512IsRead()
    {
        var userAgent = new string('a', 512 - "FBAN".Length) + "FBAN" + new string('a', 100);

        ReferrerName.From(null, Site, userAgent).ShouldBe("Facebook");
    }

    [Fact]
    public void TokenCrossingCharacter512IsNotRead()
    {
        var userAgent = new string('a', 512 - "FBAN".Length + 1) + "FBAN" + new string('a', 100);

        ReferrerName.From(null, Site, userAgent).ShouldBe("Direct");
    }

    [Theory]
    [InlineData("riders.example.org", DesktopChrome)]
    [InlineData("m.facebook.com", FacebookIos)]
    [InlineData(null, MessengerIos)]
    [InlineData("a b.com/secret?token=1", InstagramIos)]
    public void TheResultNeverHoldsTheHeaderOrAFullUrl(string? host, string userAgent)
    {
        var result = ReferrerName.From(host, Site, userAgent);

        result.Length.ShouldBeLessThanOrEqualTo(ReferrerName.MaxLength);
        result.ShouldNotContain("Mozilla");
        result.ShouldNotContain("/");
        result.ShouldNotContain("?");
        result.ShouldNotContain(" ");
    }
}

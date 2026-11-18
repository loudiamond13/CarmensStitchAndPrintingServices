using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Csps.Application.Analytics;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.Time;
using FluentValidation;
using FluentValidation.Results;
using NSubstitute;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>ANL-05, ANL-06: a page view is counted for the business day and the page key the route table gives, and a bad body is refused.</summary>
public sealed class CollectPageViewHandlerTests
{
    // 2026-11-17 04:30 in the fixed UTC+8 zone, so the business day differs from the UTC day.
    private static readonly DateTimeOffset Now = new(2026, 11, 16, 20, 30, 0, TimeSpan.Zero);
    private static readonly DateOnly BusinessDay = new(2026, 11, 17);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private const string Token = "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv";
    private static readonly Guid ConsentChain = Guid.Parse("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d");
    private const string Chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

    [Fact]
    public async Task AGalleryViewIsCountedForTheBusinessDayUnderTheGalleryKey()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new PageViewRequest("/gallery"), Visitor(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Counts.Received(1).IncrementAsync(BusinessDay, PageKeys.Gallery, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AViewOfAPathTheResolverDoesNotCountStoresNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new PageViewRequest("/admin/orders"), Visitor(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Counts.DidNotReceive().IncrementAsync(Arg.Any<DateOnly>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("gallery")]
    [InlineData("?q=1")]
    public async Task AMissingEmptyOrSlashlessPathIs400NamingThePathAndStoresNothing(string? path)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new PageViewRequest(path), Visitor(), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe(PageViewErrors.ValidationCode);
        result.Error.FieldErrors.ShouldNotBeNull().ShouldContainKey("path");
        await harness.Counts.DidNotReceive().IncrementAsync(Arg.Any<DateOnly>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task APathLongerThanTheLimitIs400AndStoresNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new PageViewRequest("/" + new string('a', AnalyticsPath.MaxLength)), Visitor(), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull().ShouldContainKey("path");
        await harness.Counts.DidNotReceive().IncrementAsync(Arg.Any<DateOnly>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task APathAtTheLimitIsAccepted()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new PageViewRequest("/" + new string('a', AnalyticsPath.MaxLength - 1)), Visitor(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public async Task TheEmptyRequestIs400NamingThePath()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(PageViewRequest.Empty, Visitor(), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull().ShouldContainKey("path");
    }

    [Theory]
    [InlineData("/gallery?q=secret#x")]
    [InlineData("/gallery#top?x=1")]
    [InlineData("/gallery?")]
    [InlineData("/gallery#")]
    public async Task ThePathIsCutAtTheFirstQuestionMarkOrHashBeforeItIsResolved(string path)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new PageViewRequest(path), Visitor(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Pages.Received(1).PageKeyFor("/gallery");
        harness.Pages.DidNotReceive().PageKeyFor(Arg.Is<string>(cut => cut.Contains('?', StringComparison.Ordinal) || cut.Contains('#', StringComparison.Ordinal)));
        await harness.Counts.Received(1).IncrementAsync(BusinessDay, PageKeys.Gallery, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task APathThatIsOnlyAQueryOnTheHomePageCountsAsHome()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new PageViewRequest("/?utm_source=facebook"), Visitor(), TestContext.Current.CancellationToken);

        await harness.Counts.Received(1).IncrementAsync(BusinessDay, PageKeys.Home, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnUnknownPublicPathCountsAsNotFound()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new PageViewRequest("/nope"), Visitor(), TestContext.Current.CancellationToken);

        await harness.Counts.Received(1).IncrementAsync(BusinessDay, PageKeys.NotFound, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")]
    [InlineData("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36")]
    [InlineData("Mozilla/5.0 (Linux; Android 11) Chrome-Lighthouse")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task ABotABlankOrAMissingUserAgentStoresNothingAndStillSucceeds(string? userAgent)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new PageViewRequest("/gallery"), Visitor(userAgent), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Counts.DidNotReceive().IncrementAsync(Arg.Any<DateOnly>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")]
    [InlineData("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36")]
    public async Task APhoneBrowserIsCounted(string userAgent)
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new PageViewRequest("/gallery"), Visitor(userAgent), TestContext.Current.CancellationToken);

        await harness.Counts.Received(1).IncrementAsync(BusinessDay, PageKeys.Gallery, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ASignedInStaffMemberStoresNothingAndStillSucceeds()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new PageViewRequest("/gallery"), Visitor(staff: true), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Pages.DidNotReceive().PageKeyFor(Arg.Any<string>());
        await harness.Counts.DidNotReceive().IncrementAsync(Arg.Any<DateOnly>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ABadBodyIs400EvenFromStaff()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new PageViewRequest("gallery"), Visitor(staff: true), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
    }

    [Fact]
    public async Task ABadBodyIs400EvenFromABot()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new PageViewRequest(null), Visitor("Googlebot/2.1"), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
    }

    [Fact]
    public async Task APathThatCannotBeCutStoresNothingEvenIfTheValidatorLetsItThrough()
    {
        var validator = Substitute.For<IValidator<PageViewRequest>>();
        validator.ValidateAsync(Arg.Any<PageViewRequest>(), Arg.Any<CancellationToken>()).Returns(new ValidationResult());
        var harness = new Harness(validator);

        var result = await harness.Handler.HandleAsync(new PageViewRequest("gallery"), Visitor(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Pages.DidNotReceive().PageKeyFor(Arg.Any<string>());
        await harness.Counts.DidNotReceive().IncrementAsync(Arg.Any<DateOnly>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheReferrerHostAndTheOtherContextValuesAreNeverPassedToTheCounter()
    {
        var harness = new Harness();
        var context = new CollectContext(Chrome, false, true, "visitor-token-value", "consent-cookie-value");

        await harness.Handler.HandleAsync(new PageViewRequest("/gallery", "facebook.com"), context, TestContext.Current.CancellationToken);

        await harness.Counts.Received(1).IncrementAsync(BusinessDay, PageKeys.Gallery, Arg.Any<CancellationToken>());
        harness.Counts.ReceivedCalls().Count().ShouldBe(1);
    }

    [Fact]
    public async Task AConsentedVisitorsFirstViewStartsOneVisitWithTheHashedIdAndAddsAPageView()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new PageViewRequest("/gallery"), Consented(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Counts.Received(1).IncrementAsync(BusinessDay, PageKeys.Gallery, Arg.Any<CancellationToken>());
        await harness.Visits.Received(1).StartUnlessCurrentAsync(
            Arg.Is<AnalyticsVisit>(visit =>
                visit.VisitorHash.SequenceEqual(SHA256.HashData(Encoding.UTF8.GetBytes(Token)))
                && visit.BusinessDay == BusinessDay
                && visit.StartedAtUtc == Now
                && visit.Referrer == "Direct"
                && visit.Device == DeviceKind.Computer
                && visit.Browser == "Chrome"
                && visit.Os == "Windows"
                && visit.IpHash == null
                && visit.PageViews == 1),
            Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        await harness.Visits.Received(1).AddPageViewAsync(
            Arg.Is<AnalyticsPageView>(view => view.VisitId == harness.StartedVisitId && view.PageKey == "gallery" && view.BusinessDay == BusinessDay && view.OccurredAtUtc == Now),
            Arg.Any<CancellationToken>());
        await harness.Visits.DidNotReceive().TouchAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ASecondViewInTheCurrentVisitTouchesItAndAddsAPageViewWithoutStartingAnother()
    {
        var harness = new Harness();
        var current = Guid.CreateVersion7();
        harness.Visits.FindCurrentAsync(Arg.Any<byte[]>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(current);

        await harness.Handler.HandleAsync(new PageViewRequest("/"), Consented(), TestContext.Current.CancellationToken);

        await harness.Visits.Received(1).FindCurrentAsync(
            Arg.Is<byte[]>(hash => hash.SequenceEqual(SHA256.HashData(Encoding.UTF8.GetBytes(Token)))),
            Now.AddMinutes(-AnalyticsRetention.SessionMinutes),
            Arg.Any<CancellationToken>());
        await harness.Visits.Received(1).TouchAsync(current, Now, Arg.Any<CancellationToken>());
        await harness.Visits.Received(1).AddPageViewAsync(Arg.Is<AnalyticsPageView>(view => view.VisitId == current && view.PageKey == "home"), Arg.Any<CancellationToken>());
        await harness.Visits.DidNotReceive().StartUnlessCurrentAsync(Arg.Any<AnalyticsVisit>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AFirstViewThatLosesTheRaceJoinsTheVisitTheOtherCallStartedAndTouchesIt()
    {
        var harness = new Harness();
        var winner = Guid.CreateVersion7();
        harness.Visits.StartUnlessCurrentAsync(Arg.Any<AnalyticsVisit>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns((winner, false));

        await harness.Handler.HandleAsync(new PageViewRequest("/gallery"), Consented(), TestContext.Current.CancellationToken);

        await harness.Visits.Received(1).StartUnlessCurrentAsync(
            Arg.Any<AnalyticsVisit>(),
            Now.AddMinutes(-AnalyticsRetention.SessionMinutes),
            Arg.Any<CancellationToken>());
        await harness.Visits.Received(1).TouchAsync(winner, Now, Arg.Any<CancellationToken>());
        await harness.Visits.Received(1).AddPageViewAsync(Arg.Is<AnalyticsPageView>(view => view.VisitId == winner), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task APhoneVisitStoresThePhoneClassAndTheBrowserAndOsLabels()
    {
        var harness = new Harness();
        const string Phone = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

        await harness.Handler.HandleAsync(new PageViewRequest("/"), Consented(Phone), TestContext.Current.CancellationToken);

        await harness.Visits.Received(1).StartUnlessCurrentAsync(
            Arg.Is<AnalyticsVisit>(visit => visit.Device == DeviceKind.Phone && visit.Browser == "Chrome" && visit.Os == "Android"),
            Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [MemberData(nameof(ClosedGates))]
    public async Task WithoutAllThreeIdentifiedGatesOnlyTheAnonymousCountChanges(string? token, string? consent, bool gpc)
    {
        var harness = new Harness();
        var context = new CollectContext(Chrome, false, gpc, token, consent);

        var result = await harness.Handler.HandleAsync(new PageViewRequest("/gallery"), context, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Counts.Received(1).IncrementAsync(BusinessDay, PageKeys.Gallery, Arg.Any<CancellationToken>());
        harness.Visits.ReceivedCalls().ShouldBeEmpty();
    }

    public static TheoryData<string?, string?, bool> ClosedGates() => new()
    {
        { null, ConsentValue(true), false },
        { string.Empty, ConsentValue(true), false },
        { Token, null, false },
        { Token, "not-a-cookie", false },
        { Token, ConsentValue(false), false },
        { Token, ConsentValue(null), false },
        { Token, ConsentValue(true, version: "0.9"), false },
        { Token, ConsentValue(true, decidedOn: BusinessDay.AddMonths(-12)), false },
        { Token, ConsentValue(true, decidedOn: BusinessDay.AddDays(1)), false },
        { Token, ConsentValue(true), true },
        { Token, ConsentValue(true, pending: true), false },
    };

    [Fact]
    public async Task ASignedInStaffMemberWithAConsentedCookieStoresNoVisit()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new PageViewRequest("/gallery"), Consented(staff: true), TestContext.Current.CancellationToken);

        harness.Visits.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task ABotWithAConsentedCookieStoresNoVisit()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new PageViewRequest("/gallery"), Consented("Mozilla/5.0 (compatible; Googlebot/2.1)"), TestContext.Current.CancellationToken);

        harness.Visits.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AnAdminPathWithAConsentedCookieStoresNoVisit()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new PageViewRequest("/admin/orders"), Consented(), TestContext.Current.CancellationToken);

        harness.Visits.ReceivedCalls().ShouldBeEmpty();
    }

    [Theory]
    [InlineData("m.facebook.com", "Facebook")]
    [InlineData("l.facebook.com", "Facebook")]
    [InlineData("www.google.com.ph", "Google")]
    [InlineData("News.Example.Org", "news.example.org")]
    public async Task ANewVisitStoresTheReferrerNameFromTheBeaconHost(string host, string expected)
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new PageViewRequest("/", host), Consented(), TestContext.Current.CancellationToken);

        await harness.Visits.Received(1).StartUnlessCurrentAsync(Arg.Is<AnalyticsVisit>(visit => visit.Referrer == expected), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NoReferrerAndADesktopBrowserIsStoredAsDirect()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new PageViewRequest("/"), Consented(), TestContext.Current.CancellationToken);

        await harness.Visits.Received(1).StartUnlessCurrentAsync(Arg.Is<AnalyticsVisit>(visit => visit.Referrer == "Direct"), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NoReferrerAndAFacebookInAppHeaderIsStoredAsFacebook()
    {
        var harness = new Harness();
        const string FacebookApp = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/450.0.0.0;]";

        await harness.Handler.HandleAsync(new PageViewRequest("/"), Consented(FacebookApp), TestContext.Current.CancellationToken);

        await harness.Visits.Received(1).StartUnlessCurrentAsync(
            Arg.Is<AnalyticsVisit>(visit => visit.Referrer == "Facebook" && visit.Browser == "Facebook in-app" && visit.Device == DeviceKind.Phone),
            Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ARefererFromTheSitesOwnHostIsStoredAsDirect()
    {
        var harness = new Harness();
        var context = Consented() with { SiteHost = "shop.example.test" };

        await harness.Handler.HandleAsync(new PageViewRequest("/", "shop.example.test"), context, TestContext.Current.CancellationToken);

        await harness.Visits.Received(1).StartUnlessCurrentAsync(Arg.Is<AnalyticsVisit>(visit => visit.Referrer == "Direct"), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("https://evil.example/path?x=1")]
    [InlineData("evil.example/path")]
    [InlineData("user@evil.example")]
    public async Task AFullUrlOrAnythingThatIsNotAHostNameIsNeverStored(string value)
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new PageViewRequest("/", value), Consented(), TestContext.Current.CancellationToken);

        await harness.Visits.Received(1).StartUnlessCurrentAsync(Arg.Is<AnalyticsVisit>(visit => visit.Referrer == "Direct"), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheAddressHashIsTheHmacOfTheTruncatedPrefixWithTheDaysSalt()
    {
        var harness = new Harness(remoteIp: IPAddress.Parse("192.0.2.10"));
        var expected = HMACSHA256.HashData(SaltOf(BusinessDay), Encoding.UTF8.GetBytes("192.0.2.0"));

        await harness.Handler.HandleAsync(new PageViewRequest("/"), Consented(), TestContext.Current.CancellationToken);

        await harness.Visits.Received(1).StartUnlessCurrentAsync(Arg.Is<AnalyticsVisit>(visit => visit.IpHash != null && visit.IpHash.SequenceEqual(expected)), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        await harness.Salts.Received(1).ForDayAsync(BusinessDay, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnIpv6AddressIsCutToItsFirst48BitsBeforeHashing()
    {
        var harness = new Harness(remoteIp: IPAddress.Parse("2001:db8:abcd:12::1"));
        var expected = HMACSHA256.HashData(SaltOf(BusinessDay), Encoding.UTF8.GetBytes("2001:db8:abcd::"));

        await harness.Handler.HandleAsync(new PageViewRequest("/"), Consented(), TestContext.Current.CancellationToken);

        await harness.Visits.Received(1).StartUnlessCurrentAsync(Arg.Is<AnalyticsVisit>(visit => visit.IpHash != null && visit.IpHash.SequenceEqual(expected)), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TwoAddressesInTheSameBlockOnTheSameDayGiveTheSameHashAndTheNextDayAnotherOne()
    {
        var first = await StoredIpHashAsync("192.0.2.10", Now);
        var second = await StoredIpHashAsync("192.0.2.200", Now);
        var nextDay = await StoredIpHashAsync("192.0.2.10", Now.AddDays(1));

        first.ShouldNotBeNull();
        second.ShouldBe(first);
        nextDay.ShouldNotBeNull();
        nextDay.ShouldNotBe(first);
    }

    [Fact]
    public async Task AnotherBlockGivesAnotherHash()
    {
        var first = await StoredIpHashAsync("192.0.2.10", Now);
        var other = await StoredIpHashAsync("192.0.3.10", Now);

        other.ShouldNotBe(first);
    }

    [Fact]
    public async Task WithoutARemoteAddressTheHashIsNullAndNoSaltIsRead()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new PageViewRequest("/"), Consented(), TestContext.Current.CancellationToken);

        await harness.Visits.Received(1).StartUnlessCurrentAsync(Arg.Is<AnalyticsVisit>(visit => visit.IpHash == null), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        await harness.Salts.DidNotReceive().ForDayAsync(Arg.Any<DateOnly>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AViewInAnExistingVisitReadsNoSaltAndStartsNothing()
    {
        var harness = new Harness(remoteIp: IPAddress.Parse("192.0.2.10"));
        harness.Visits.FindCurrentAsync(Arg.Any<byte[]>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(Guid.CreateVersion7());

        await harness.Handler.HandleAsync(new PageViewRequest("/", "m.facebook.com"), Consented(), TestContext.Current.CancellationToken);

        await harness.Salts.DidNotReceive().ForDayAsync(Arg.Any<DateOnly>(), Arg.Any<CancellationToken>());
        await harness.Visits.DidNotReceive().StartUnlessCurrentAsync(Arg.Any<AnalyticsVisit>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NoStoredValueHoldsTheRawAddressTheUserAgentOrTheVisitorId()
    {
        var harness = new Harness(remoteIp: IPAddress.Parse("192.0.2.10"));

        await harness.Handler.HandleAsync(new PageViewRequest("/", "m.facebook.com"), Consented(), TestContext.Current.CancellationToken);

        var visit = harness.StartedVisit.ShouldNotBeNull();
        var texts = new[] { visit.Referrer, visit.Browser, visit.Os, visit.Device.ToString(), Convert.ToHexString(visit.VisitorHash), Convert.ToHexString(visit.IpHash!) };
        texts.ShouldAllBe(text => !text.Contains("192.0.2", StringComparison.Ordinal) && !text.Contains("Mozilla", StringComparison.Ordinal) && !text.Contains(Token, StringComparison.Ordinal));
        visit.VisitorHash.ShouldNotBe(Encoding.UTF8.GetBytes(Token));
    }

    private static async Task<byte[]?> StoredIpHashAsync(string address, DateTimeOffset now)
    {
        var harness = new Harness(remoteIp: IPAddress.Parse(address), now: now);
        await harness.Handler.HandleAsync(new PageViewRequest("/"), Consented(), TestContext.Current.CancellationToken);
        return harness.StartedVisit.ShouldNotBeNull().IpHash;
    }

    // A different fixed salt for each business day, so a test can see that the day changes the hash.
    private static byte[] SaltOf(DateOnly day) => SHA256.HashData(Encoding.UTF8.GetBytes("test-salt-" + day.ToString("O", CultureInfo.InvariantCulture)));

    private static string ConsentValue(bool? stats, string? version = null, DateOnly? decidedOn = null, bool pending = false) =>
        new ConsentCookie(ConsentChain, version ?? LegalPages.CookiePolicyVersion, stats, true, decidedOn ?? BusinessDay, pending).Format();

    private static CollectContext Consented(string? userAgent = Chrome, bool staff = false) => new(userAgent, staff, false, Token, ConsentValue(true));

    private static CollectContext Visitor(string? userAgent = Chrome, bool staff = false) => new(userAgent, staff, false, null, null);

    private sealed class Harness
    {
        public Harness(IValidator<PageViewRequest>? validator = null, IPAddress? remoteIp = null, DateTimeOffset? now = null)
        {
            Salts = Substitute.For<IAnalyticsSalts>();
            Salts.ForDayAsync(Arg.Any<DateOnly>(), Arg.Any<CancellationToken>()).Returns(call => Task.FromResult(SaltOf(call.Arg<DateOnly>())));
            RequestContext = Substitute.For<IRequestContext>();
            RequestContext.RemoteIp.Returns(remoteIp);
            Visits = Substitute.For<IAnalyticsVisits>();
            Visits.StartUnlessCurrentAsync(Arg.Any<AnalyticsVisit>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                StartedVisit = call.Arg<AnalyticsVisit>();
                StartedVisitId = StartedVisit.Id;
                return Task.FromResult((StartedVisitId, true));
            });
            Pages = Substitute.For<IPublicPageResolver>();
            Pages.PageKeyFor(Arg.Any<string>()).Returns(call => call.Arg<string>() switch
            {
                "/gallery" => PageKeys.Gallery,
                "/" => PageKeys.Home,
                _ => call.Arg<string>().StartsWith("/admin", StringComparison.Ordinal) ? null : PageKeys.NotFound,
            });
            Counts = Substitute.For<IPageViewCounts>();
            var calendar = Substitute.For<IBusinessCalendar>();
            calendar.GetClockAsync(Arg.Any<CancellationToken>()).Returns(new BusinessClock(Manila, ZoneSource.Stored, now ?? Now));
            Handler = new CollectPageViewHandler(Pages, Counts, Visits, Salts, RequestContext, calendar, validator ?? new PageViewRequestValidator());
        }

        public IAnalyticsSalts Salts { get; }

        public IRequestContext RequestContext { get; }

        public IAnalyticsVisits Visits { get; }

        public Guid StartedVisitId { get; private set; }

        public AnalyticsVisit? StartedVisit { get; private set; }

        public IPublicPageResolver Pages { get; }

        public IPageViewCounts Counts { get; }

        public CollectPageViewHandler Handler { get; }
    }
}

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
    private const string Chrome ="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

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
        await harness.Visits.Received(1).StartAsync(
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
            Arg.Any<CancellationToken>());
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
        await harness.Visits.DidNotReceive().StartAsync(Arg.Any<AnalyticsVisit>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task APhoneVisitStoresThePhoneClassAndTheBrowserAndOsLabels()
    {
        var harness = new Harness();
        const string Phone = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

        await harness.Handler.HandleAsync(new PageViewRequest("/"), Consented(Phone), TestContext.Current.CancellationToken);

        await harness.Visits.Received(1).StartAsync(
            Arg.Is<AnalyticsVisit>(visit => visit.Device == DeviceKind.Phone && visit.Browser == "Chrome" && visit.Os == "Android"),
            Arg.Any<CancellationToken>());
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

    private static string ConsentValue(bool? stats, string? version = null, DateOnly? decidedOn = null) =>
        new ConsentCookie(ConsentChain, version ?? LegalPages.CookiePolicyVersion, stats, true, decidedOn ?? BusinessDay, false).Format();

    private static CollectContext Consented(string? userAgent = Chrome, bool staff = false) => new(userAgent, staff, false, Token, ConsentValue(true));

    private static CollectContext Visitor(string? userAgent = Chrome, bool staff = false) => new(userAgent, staff, false, null, null);

    private sealed class Harness
    {
        public Harness(IValidator<PageViewRequest>? validator = null)
        {
            Visits = Substitute.For<IAnalyticsVisits>();
            Visits.StartAsync(Arg.Any<AnalyticsVisit>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                StartedVisitId = call.Arg<AnalyticsVisit>().Id;
                return Task.FromResult(StartedVisitId);
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
            calendar.GetClockAsync(Arg.Any<CancellationToken>()).Returns(new BusinessClock(Manila, ZoneSource.Stored, Now));
            Handler = new CollectPageViewHandler(Pages, Counts, Visits, calendar, validator ?? new PageViewRequestValidator());
        }

        public IAnalyticsVisits Visits { get; }

        public Guid StartedVisitId { get; private set; }

        public IPublicPageResolver Pages { get; }

        public IPageViewCounts Counts { get; }

        public CollectPageViewHandler Handler { get; }
    }
}

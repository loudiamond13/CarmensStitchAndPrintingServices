using System.Security.Cryptography;
using System.Text;
using Csps.Application.Analytics;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>ANL-05, D-26, D-41: a consented visitor's speed samples are stored against the current visit, each metric checked on its own, and nobody else's are.</summary>
public sealed class CollectVitalsHandlerTests
{
    private const string Token = "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv";
    private const string Chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    private static readonly DateTimeOffset Now = new(2026, 11, 16, 20, 30, 0, TimeSpan.Zero);
    private static readonly DateOnly BusinessDay = new(2026, 11, 17);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid ConsentChain = Guid.Parse("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d");

    [Fact]
    public async Task AllThreeMetricsOfAConsentedVisitorAreStoredAgainstTheCurrentVisitWithThePageKeyOfTheCutPath()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new VitalsRequest("/contact?x=1#y", 2100m, 0.04m, 180m), Consented(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Pages.Received(1).PageKeyFor("/contact");
        await harness.Visits.Received(1).FindCurrentAsync(
            Arg.Is<byte[]>(hash => hash.SequenceEqual(SHA256.HashData(Encoding.UTF8.GetBytes(Token)))),
            Now.AddMinutes(-AnalyticsRetention.SessionMinutes),
            Arg.Any<CancellationToken>());
        var samples = harness.Stored.ShouldNotBeNull();
        samples.Select(sample => (sample.Metric, sample.Value)).ShouldBe([(VitalMetric.Lcp, 2100m), (VitalMetric.Cls, 0.04m), (VitalMetric.Inp, 180m)]);
        samples.ShouldAllBe(sample => sample.VisitId == harness.CurrentVisit && sample.PageKey == "contact" && sample.BusinessDay == BusinessDay);
    }

    [Fact]
    public async Task AReportDoesNotTouchTheVisitOrAddAPageView()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new VitalsRequest("/", 2100m), Consented(), TestContext.Current.CancellationToken);

        await harness.Visits.DidNotReceive().TouchAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        await harness.Visits.DidNotReceive().AddPageViewAsync(Arg.Any<AnalyticsPageView>(), Arg.Any<CancellationToken>());
        await harness.Visits.DidNotReceive().StartAsync(Arg.Any<AnalyticsVisit>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnOutOfRangeMetricIsDroppedAndTheOthersAreKept()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new VitalsRequest("/", 70000m, 0.04m, 180m), Consented(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Stored.ShouldNotBeNull().Select(sample => sample.Metric).ShouldBe([VitalMetric.Cls, VitalMetric.Inp]);
    }

    [Theory]
    [InlineData(-1, 0.1, 100)]
    [InlineData(100, 10.5, 100)]
    [InlineData(100, 0.1, 60000.5)]
    public async Task EachMetricOutsideItsRangeIsDroppedOnItsOwn(double lcp, double cls, double inp)
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new VitalsRequest("/", (decimal)lcp, (decimal)cls, (decimal)inp), Consented(), TestContext.Current.CancellationToken);

        harness.Stored.ShouldNotBeNull().Count.ShouldBe(2);
    }

    [Fact]
    public async Task AValueExactlyOnTheLimitIsKept()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new VitalsRequest("/", 60000m, 10m, 0m), Consented(), TestContext.Current.CancellationToken);

        harness.Stored.ShouldNotBeNull().Count.ShouldBe(3);
    }

    [Fact]
    public async Task OnlyTheMetricsTheBrowserSentAreStored()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new VitalsRequest("/", Cls: 0.02m), Consented(), TestContext.Current.CancellationToken);

        harness.Stored.ShouldNotBeNull().Select(sample => sample.Metric).ShouldBe([VitalMetric.Cls]);
    }

    [Fact]
    public async Task AReportWithNoUsableMetricStoresNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new VitalsRequest("/", 70000m), Consented(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Visits.DidNotReceive().AddSamplesAsync(Arg.Any<IReadOnlyList<AnalyticsVitalSample>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task WithNoCurrentVisitNothingIsStoredAndTheAnswerIsStillSuccess()
    {
        var harness = new Harness(hasVisit: false);

        var result = await harness.Handler.HandleAsync(new VitalsRequest("/", 2100m), Consented(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Visits.DidNotReceive().AddSamplesAsync(Arg.Any<IReadOnlyList<AnalyticsVitalSample>>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [MemberData(nameof(ClosedGates))]
    public async Task WithoutAllThreeIdentifiedGatesNothingIsStored(string? token, string? consent, bool gpc)
    {
        var harness = new Harness();
        var context = new CollectContext(Chrome, false, gpc, token, consent);

        var result = await harness.Handler.HandleAsync(new VitalsRequest("/", 2100m), context, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Visits.ReceivedCalls().ShouldBeEmpty();
    }

    public static TheoryData<string?, string?, bool> ClosedGates() => new()
    {
        { null, ConsentValue(true), false },
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

    [Theory]
    [InlineData("Mozilla/5.0 (compatible; Googlebot/2.1)")]
    [InlineData("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36")]
    [InlineData(null)]
    public async Task ABotOrAMissingUserAgentStoresNothing(string? userAgent)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new VitalsRequest("/", 2100m), Consented(userAgent), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Visits.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task ASignedInStaffMemberStoresNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new VitalsRequest("/", 2100m), Consented(staff: true), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Visits.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AnAdminPathStoresNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new VitalsRequest("/admin/orders", 2100m), Consented(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Visits.ReceivedCalls().ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("contact")]
    public async Task AMissingOrSlashlessPathIs400NamingThePathAndStoresNothing(string? path)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new VitalsRequest(path, 2100m), Consented(), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull().ShouldContainKey("path");
        harness.Visits.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task APathLongerThanTheLimitIs400()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new VitalsRequest("/" + new string('a', AnalyticsPath.MaxLength)), Consented(), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull().ShouldContainKey("path");
    }

    [Fact]
    public async Task TheEmptyRequestIs400NamingThePath()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(VitalsRequest.Empty, Consented(), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull().ShouldContainKey("path");
    }

    [Fact]
    public async Task ABadBodyIs400EvenFromStaffOrABot()
    {
        var harness = new Harness();

        var staff = await harness.Handler.HandleAsync(new VitalsRequest("contact"), Consented(staff: true), TestContext.Current.CancellationToken);
        var bot = await harness.Handler.HandleAsync(new VitalsRequest(null), Consented("Googlebot/2.1"), TestContext.Current.CancellationToken);

        staff.Error.Kind.ShouldBe(ErrorKind.Validation);
        bot.Error.Kind.ShouldBe(ErrorKind.Validation);
    }

    private static string ConsentValue(bool? stats, string? version = null, DateOnly? decidedOn = null, bool pending = false) =>
        new ConsentCookie(ConsentChain, version ?? LegalPages.CookiePolicyVersion, stats, true, decidedOn ?? BusinessDay, pending).Format();

    private static CollectContext Consented(string? userAgent = Chrome, bool staff = false) => new(userAgent, staff, false, Token, ConsentValue(true));

    private sealed class Harness
    {
        public Harness(bool hasVisit = true)
        {
            CurrentVisit = Guid.CreateVersion7();
            Visits = Substitute.For<IAnalyticsVisits>();
            Visits.FindCurrentAsync(Arg.Any<byte[]>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(hasVisit ? CurrentVisit : null);
            Visits.AddSamplesAsync(Arg.Any<IReadOnlyList<AnalyticsVitalSample>>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                Stored = call.Arg<IReadOnlyList<AnalyticsVitalSample>>();
                return Task.CompletedTask;
            });
            Pages = Substitute.For<IPublicPageResolver>();
            Pages.PageKeyFor(Arg.Any<string>()).Returns(call => call.Arg<string>() switch
            {
                "/contact" => PageKeys.Contact,
                "/" => PageKeys.Home,
                _ => call.Arg<string>().StartsWith("/admin", StringComparison.Ordinal) ? null : PageKeys.NotFound,
            });
            var calendar = Substitute.For<IBusinessCalendar>();
            calendar.GetClockAsync(Arg.Any<CancellationToken>()).Returns(new BusinessClock(Manila, ZoneSource.Stored, Now));
            Handler = new CollectVitalsHandler(Pages, Visits, calendar, new VitalsRequestValidator());
        }

        public Guid CurrentVisit { get; }

        public IReadOnlyList<AnalyticsVitalSample>? Stored { get; private set; }

        public IAnalyticsVisits Visits { get; }

        public IPublicPageResolver Pages { get; }

        public CollectVitalsHandler Handler { get; }
    }
}

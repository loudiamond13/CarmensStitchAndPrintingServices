using Csps.Application.Analytics;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Analytics;
using Csps.Domain.Content;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>ANL-07, D-43: a decision is logged once with the server's time, answered with the stored state and saved as a cookie value without the pending marker.</summary>
public sealed class RecordConsentHandlerTests
{
    // 2026-11-17 04:30 in the fixed UTC+8 zone, so the business day differs from the UTC day.
    private static readonly DateTimeOffset Now = new(2026, 11, 16, 20, 30, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid Chain = Guid.Parse("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d");

    [Fact]
    public async Task AcceptAllAddsOneRecordWithTheServerTimeAndSavesOnce()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(stats: true, map: true, source: "bar"), Fresh, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var record = harness.Added.ShouldHaveSingleItem();
        record.Stats.ShouldBe(true);
        record.Map.ShouldBeTrue();
        record.Gpc.ShouldBeFalse();
        record.Source.ShouldBe(ConsentSource.Bar);
        record.PolicyVersion.ShouldBe(LegalPages.CookiePolicyVersion);
        record.DecidedAtUtc.ShouldBe(Now);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task TheAnswerCarriesTheStoredStateAndTheBusinessDay()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(stats: true, map: false, source: "settings"), Fresh, TestContext.Current.CancellationToken);

        var response = result.Value.Response;
        response.ConsentId.ShouldBe(harness.Added.Single().ConsentId.ToString("N"));
        response.PolicyVersion.ShouldBe(LegalPages.CookiePolicyVersion);
        response.Stats.ShouldBe(true);
        response.Map.ShouldBeFalse();
        response.Gpc.ShouldBeFalse();
        response.DecidedOn.ShouldBe("2026-11-17");
    }

    [Fact]
    public async Task TheCookieValueIsTheCodecFormatWithoutThePendingMarkerAndExpiresTwelveMonthsAfterTheDecision()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(stats: true, map: true, source: "bar"), Fresh, TestContext.Current.CancellationToken);

        var outcome = result.Value;
        outcome.CookieValue.ShouldBe($"1_{harness.Added.Single().ConsentId:N}_{LegalPages.CookiePolicyVersion}_1_1_20261117");
        ConsentCookie.TryParse(outcome.CookieValue, out var cookie).ShouldBeTrue();
        cookie!.Pending.ShouldBeFalse();
        outcome.ExpiresAt.ShouldBe(Now.AddMonths(ConsentCookie.LifetimeMonths));
    }

    [Fact]
    public async Task AFirstDecisionWithNoChainIdGetsANewOne()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(stats: true, map: true, source: "bar"), Fresh, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Added.Single().ConsentId.ShouldNotBe(Guid.Empty);
    }

    [Fact]
    public async Task ALaterDecisionThatSendsAChainIdKeepsIt()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(consentId: Chain.ToString("N"), stats: false, map: false, source: "settings"), Fresh, TestContext.Current.CancellationToken);

        result.Value.Response.ConsentId.ShouldBe(Chain.ToString("N"));
        harness.Added.Single().ConsentId.ShouldBe(Chain);
    }

    [Fact]
    public async Task TheCookieValueNeverCarriesThePendingMarkerWhateverTheBodyHolds()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(consentId: Chain.ToString("N"), stats: null, map: true, source: "map-link"), Fresh, TestContext.Current.CancellationToken);

        result.Value.CookieValue.ShouldEndWith("_-_1_20261117");
        result.Value.CookieValue.ShouldNotEndWith("_p");
    }

    [Theory]
    [InlineData(null, "bar", "policyVersion")]
    [InlineData("", "bar", "policyVersion")]
    [InlineData("0.1", null, "source")]
    [InlineData("0.1", "", "source")]
    public async Task AMissingPolicyVersionOrSourceIs400AndStoresNothing(string? policyVersion, string? source, string field)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(
            new RecordConsentRequest(null, policyVersion, true, true, source), Fresh, TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull().ShouldContainKey(field);
        harness.Added.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    private static ConsentCallContext Fresh => new(false, false);

    private static RecordConsentRequest Request(string? consentId = null, bool? stats = null, bool map = false, string? source = null) =>
        new(consentId, LegalPages.CookiePolicyVersion, stats, map, source);

    private sealed class Harness
    {
        public Harness()
        {
            var records = Substitute.For<IConsentRecords>();
            records.When(port => port.Add(Arg.Any<ConsentRecord>())).Do(call => Added.Add(call.Arg<ConsentRecord>()));
            var calendar = Substitute.For<IBusinessCalendar>();
            calendar.GetClockAsync(Arg.Any<CancellationToken>()).Returns(new BusinessClock(Manila, ZoneSource.Stored, Now));
            Random = Substitute.For<ISecureRandom>();
            Handler = new RecordConsentHandler(records, Unit, calendar, Random);
        }

        public List<ConsentRecord> Added { get; } = [];

        public FakeUnitOfWork Unit { get; } = new();

        public ISecureRandom Random { get; }

        public RecordConsentHandler Handler { get; }
    }
}

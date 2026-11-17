using Csps.Application.Analytics;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Analytics;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>
/// ANL-04, D-19, D-31, D-41, CWE-639: Clear deletes the rows of the visitor the cookie names, logs a reset decision whether or not anything was
/// deleted, and answers the same either way.
/// </summary>
public sealed class ClearVisitorDataHandlerTests
{
    // 2026-11-17 04:30 in the fixed UTC+8 zone, so the business day differs from the UTC day.
    private static readonly DateTimeOffset Now = new(2026, 11, 16, 20, 30, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private const string Token = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE";

    [Fact]
    public async Task AHeldVisitorIdDeletesThatVisitorsRowsByItsHashOnce()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ClearCallContext(false, Token), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var hash = harness.Deleted.ShouldHaveSingleItem();
        hash.ShouldBe(VisitorKey.HashVisitor(Token));
    }

    [Fact]
    public async Task NoVisitorIdDeletesNothingAndStillLogsTheDecision()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ClearCallContext(false, null), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Deleted.ShouldBeEmpty();
        harness.Added.ShouldHaveSingleItem();
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task TheDecisionIsAResetWithANewChainStatsOffMapOffAndSourceClear()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ClearCallContext(false, Token), TestContext.Current.CancellationToken);

        var record = harness.Added.ShouldHaveSingleItem();
        record.ConsentId.ShouldNotBe(Guid.Empty);
        record.Stats.ShouldBe(false);
        record.Map.ShouldBeFalse();
        record.Gpc.ShouldBeFalse();
        record.Source.ShouldBe(ConsentSource.Clear);
        record.PolicyVersion.ShouldBe(LegalPages.CookiePolicyVersion);
        record.DecidedAtUtc.ShouldBe(Now);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task TheGpcSignalIsStoredWithTheDecision()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ClearCallContext(true, Token), TestContext.Current.CancellationToken);

        harness.Added.Single().Gpc.ShouldBeTrue();
    }

    [Fact]
    public async Task TwoClearsStartTwoDifferentChains()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ClearCallContext(false, Token), TestContext.Current.CancellationToken);
        await harness.Handler.HandleAsync(new ClearCallContext(false, Token), TestContext.Current.CancellationToken);

        harness.Added.Select(record => record.ConsentId).Distinct().Count().ShouldBe(2);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task TheAnswerIsTheSameWhetherOrNotAVisitorIdWasHeld(bool held)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ClearCallContext(false, held ? Token : null), TestContext.Current.CancellationToken);

        var outcome = result.Value;
        outcome.Visitor.ShouldBe(VisitorIdAction.Expire);
        outcome.VisitorToken.ShouldBeNull();
        outcome.Response.Stats.ShouldBe(false);
        outcome.Response.Map.ShouldBeFalse();
        outcome.Response.DecidedOn.ShouldBe("2026-11-17");
        outcome.CookieValue.ShouldBe($"1_{harness.Added.Single().ConsentId:N}_{LegalPages.CookiePolicyVersion}_0_0_20261117");
        outcome.ExpiresAt.ShouldBe(Now.AddMonths(ConsentCookie.LifetimeMonths));
    }

    [Fact]
    public async Task TheDeleteRunsBeforeTheDecisionIsAdded()
    {
        var harness = new Harness();
        var order = new List<string>();
        harness.Visits.When(port => port.DeleteForVisitorAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>())).Do(_ => order.Add("delete"));
        harness.Records.When(port => port.Add(Arg.Any<ConsentRecord>())).Do(_ => order.Add("add"));

        await harness.Handler.HandleAsync(new ClearCallContext(false, Token), TestContext.Current.CancellationToken);

        order.ShouldBe(["delete", "add"]);
    }

    private sealed class Harness
    {
        public Harness()
        {
            Visits = Substitute.For<IAnalyticsVisits>();
            Visits.DeleteForVisitorAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>())
                .Returns(call =>
                {
                    Deleted.Add(call.Arg<byte[]>());
                    return Task.CompletedTask;
                });
            Records = Substitute.For<IConsentRecords>();
            Records.When(port => port.Add(Arg.Any<ConsentRecord>())).Do(call => Added.Add(call.Arg<ConsentRecord>()));
            var calendar = Substitute.For<IBusinessCalendar>();
            calendar.GetClockAsync(Arg.Any<CancellationToken>()).Returns(new BusinessClock(Manila, ZoneSource.Stored, Now));
            Handler = new ClearVisitorDataHandler(Visits, Records, Unit, calendar);
        }

        public List<byte[]> Deleted { get; } = [];

        public List<ConsentRecord> Added { get; } = [];

        public FakeUnitOfWork Unit { get; } = new();

        public IAnalyticsVisits Visits { get; }

        public IConsentRecords Records { get; }

        public ClearVisitorDataHandler Handler { get; }
    }
}

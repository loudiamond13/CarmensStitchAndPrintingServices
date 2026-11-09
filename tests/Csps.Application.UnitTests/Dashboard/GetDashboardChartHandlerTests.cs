using Csps.Application.Dashboard;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Dashboard;

/// <summary>DASH-03, CWE-20: the chart handler checks the months first, then asks the reader for exactly the window.</summary>
public sealed class GetDashboardChartHandlerTests
{
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");

    // 10:00 in Manila on Wednesday 2026-11-04.
    private static readonly DateTimeOffset Wednesday = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task SixMonthsAskTheReaderForJuneFirstToNovemberThirtieth()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new GetDashboardChartRequest("6"), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Asked.ShouldBe((new DateOnly(2026, 6, 1), new DateOnly(2026, 11, 30)));
        result.Value.Months.ShouldBe(6);
        result.Value.Items.Select(item => item.Month).ShouldBe(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    }

    [Fact]
    public async Task NoMonthsMeansSix()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new GetDashboardChartRequest(), TestContext.Current.CancellationToken);

        result.Value.Months.ShouldBe(6);
        result.Value.Items.Count.ShouldBe(6);
    }

    [Fact]
    public async Task TwelveMonthsAskForDecemberFirstToNovemberThirtieth()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new GetDashboardChartRequest("12"), TestContext.Current.CancellationToken);

        harness.Asked.ShouldBe((new DateOnly(2025, 12, 1), new DateOnly(2026, 11, 30)));
        result.Value.Items.Count.ShouldBe(12);
        result.Value.Items[0].Month.ShouldBe("2025-12");
        result.Value.Items[^1].Month.ShouldBe("2026-11");
    }

    [Fact]
    public async Task AtFebruaryTenthSixMonthsRunSeptember2025ToFebruary2026()
    {
        var harness = new Harness(new DateTimeOffset(2026, 2, 10, 2, 0, 0, TimeSpan.Zero));

        var result = await harness.Handler.HandleAsync(new GetDashboardChartRequest("6"), TestContext.Current.CancellationToken);

        harness.Asked.ShouldBe((new DateOnly(2025, 9, 1), new DateOnly(2026, 2, 28)));
        result.Value.Items.Select(item => item.Month).ShouldBe(["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
    }

    [Fact]
    public async Task At0030ManilaOnNovemberFirstTheWindowEndsInNovemberNotOctober()
    {
        // 16:30Z on Oct 31 is 00:30 on Nov 1 in Manila.
        var harness = new Harness(new DateTimeOffset(2026, 10, 31, 16, 30, 0, TimeSpan.Zero));

        var result = await harness.Handler.HandleAsync(new GetDashboardChartRequest("6"), TestContext.Current.CancellationToken);

        harness.Asked.ShouldBe((new DateOnly(2026, 6, 1), new DateOnly(2026, 11, 30)));
        result.Value.Items[^1].Month.ShouldBe("2026-11");
    }

    [Fact]
    public async Task At2359ManilaOnNovemberThirtiethTheWindowStillEndsInNovember()
    {
        // 15:59Z on Nov 30 is 23:59 the same day in Manila.
        var harness = new Harness(new DateTimeOffset(2026, 11, 30, 15, 59, 0, TimeSpan.Zero));

        var result = await harness.Handler.HandleAsync(new GetDashboardChartRequest("6"), TestContext.Current.CancellationToken);

        harness.Asked.ShouldBe((new DateOnly(2026, 6, 1), new DateOnly(2026, 11, 30)));
        result.Value.Items[^1].Month.ShouldBe("2026-11");
    }

    [Fact]
    public async Task AtMidnightManilaOnDecemberFirstTheWindowEndsInDecemberThoughTheUtcDateIsStillNovember()
    {
        // 16:00Z on Nov 30 is 00:00 on Dec 1 in Manila: the month comes from the business date, not the UTC date.
        var harness = new Harness(new DateTimeOffset(2026, 11, 30, 16, 0, 0, TimeSpan.Zero));

        var result = await harness.Handler.HandleAsync(new GetDashboardChartRequest("6"), TestContext.Current.CancellationToken);

        harness.Asked.ShouldBe((new DateOnly(2026, 7, 1), new DateOnly(2026, 12, 31)));
        result.Value.Items.Select(item => item.Month).ShouldBe(["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]);
    }

    [Theory]
    [InlineData("7")]
    [InlineData("0")]
    [InlineData("-6")]
    [InlineData("1000")]
    [InlineData("abc")]
    [InlineData("6.0")]
    [InlineData("6,12")]
    public async Task AnyOtherMonthsIsA400OnMonthsAndTheReaderIsNeverAsked(string months)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new GetDashboardChartRequest(months), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(GetDashboardChartRequestValidator.InvalidCode);
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields.Keys.ShouldBe(["months"]);
        fields["months"].ShouldBe(["Choose 6 or 12 months."]);
        await harness.Reader.DidNotReceive().GetMonthSumsAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ANullRequestIsRefused()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(null!, TestContext.Current.CancellationToken));
    }

    private sealed class Harness
    {
        public Harness(DateTimeOffset? now = null)
        {
            Reader = Substitute.For<IDashboardReader>();
            Reader.GetMonthSumsAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
                .Returns(call =>
                {
                    Asked = (call.ArgAt<DateOnly>(0), call.ArgAt<DateOnly>(1));
                    return Task.FromResult(new DashboardMonthSums([], [], [], []));
                });
            Handler = new GetDashboardChartHandler(Reader, new FixedCalendar(now ?? Wednesday), new GetDashboardChartRequestValidator());
        }

        public IDashboardReader Reader { get; }

        public GetDashboardChartHandler Handler { get; }

        public (DateOnly First, DateOnly Last) Asked { get; private set; }
    }

    private sealed class FixedCalendar(DateTimeOffset now) : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, now));
    }
}

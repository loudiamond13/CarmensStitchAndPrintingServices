using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>ANL-05: the visit, page view, speed sample and salt rows hold only reduced values and refuse anything that would not fit their columns.</summary>
public sealed class AnalyticsVisitTests
{
    private static readonly DateOnly Day = new(2026, 11, 17);
    private static readonly DateTimeOffset At = new(2026, 11, 17, 3, 0, 0, TimeSpan.Zero);

    [Fact]
    public void AVisitStartsWithOnePageViewAndItsLastSeenTimeIsItsStart()
    {
        var hash = Hash(1);
        var ipHash = Hash(2);

        var visit = AnalyticsVisit.Start(hash, Day, At, ReferrerName.Facebook, DeviceKind.Phone, "Chrome", "Android", ipHash);

        visit.Id.ShouldNotBe(Guid.Empty);
        visit.VisitorHash.ShouldBe(hash);
        visit.BusinessDay.ShouldBe(Day);
        visit.StartedAtUtc.ShouldBe(At);
        visit.LastSeenAtUtc.ShouldBe(At);
        visit.Referrer.ShouldBe("Facebook");
        visit.Device.ShouldBe(DeviceKind.Phone);
        visit.Browser.ShouldBe("Chrome");
        visit.Os.ShouldBe("Android");
        visit.IpHash.ShouldBe(ipHash);
        visit.PageViews.ShouldBe(1);
    }

    [Fact]
    public void AVisitWithNoAddressKeepsANullAddressHash()
    {
        AnalyticsVisit.Start(Hash(1), Day, At, "Direct", DeviceKind.Computer, "Safari", "macOS", null).IpHash.ShouldBeNull();
    }

    [Fact]
    public void TwoVisitsGetDifferentIds()
    {
        var first = AnalyticsVisit.Start(Hash(1), Day, At, "Direct", DeviceKind.Other, "Other", "Other", null);
        var second = AnalyticsVisit.Start(Hash(1), Day, At, "Direct", DeviceKind.Other, "Other", "Other", null);

        first.Id.ShouldNotBe(second.Id);
    }

    [Fact]
    public void ALabelAndAReferrerAtTheirLongestLengthAreKept()
    {
        var host = new string('a', ReferrerName.MaxLength);
        var label = new string('b', AnalyticsVisit.LabelMaxLength);

        var visit = AnalyticsVisit.Start(Hash(1), Day, At, host, DeviceKind.Tablet, label, label, null);

        visit.Referrer.ShouldBe(host);
        visit.Browser.ShouldBe(label);
        visit.Os.ShouldBe(label);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(31)]
    [InlineData(33)]
    public void AVisitorHashThatIsNot32BytesIsRefused(int length)
    {
        Should.Throw<ArgumentException>(() => AnalyticsVisit.Start(new byte[length], Day, At, "Direct", DeviceKind.Phone, "Chrome", "Android", null));
    }

    [Fact]
    public void ANullVisitorHashIsRefused()
    {
        Should.Throw<ArgumentNullException>(() => AnalyticsVisit.Start(null!, Day, At, "Direct", DeviceKind.Phone, "Chrome", "Android", null));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(16)]
    [InlineData(64)]
    public void AnAddressHashThatIsNot32BytesIsRefused(int length)
    {
        Should.Throw<ArgumentException>(() => AnalyticsVisit.Start(Hash(1), Day, At, "Direct", DeviceKind.Phone, "Chrome", "Android", new byte[length]));
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public void ABlankReferrerIsRefused(string referrer)
    {
        Should.Throw<ArgumentException>(() => AnalyticsVisit.Start(Hash(1), Day, At, referrer, DeviceKind.Phone, "Chrome", "Android", null));
    }

    [Fact]
    public void ANullOrTooLongReferrerIsRefused()
    {
        Should.Throw<ArgumentNullException>(() => AnalyticsVisit.Start(Hash(1), Day, At, null!, DeviceKind.Phone, "Chrome", "Android", null));
        Should.Throw<ArgumentException>(() => AnalyticsVisit.Start(Hash(1), Day, At, new string('a', ReferrerName.MaxLength + 1), DeviceKind.Phone, "Chrome", "Android", null));
    }

    [Fact]
    public void ABlankNullOrTooLongBrowserOrOsLabelIsRefused()
    {
        Should.Throw<ArgumentException>(() => AnalyticsVisit.Start(Hash(1), Day, At, "Direct", DeviceKind.Phone, " ", "Android", null));
        Should.Throw<ArgumentNullException>(() => AnalyticsVisit.Start(Hash(1), Day, At, "Direct", DeviceKind.Phone, null!, "Android", null));
        Should.Throw<ArgumentException>(() => AnalyticsVisit.Start(Hash(1), Day, At, "Direct", DeviceKind.Phone, "Chrome", " ", null));
        Should.Throw<ArgumentException>(() => AnalyticsVisit.Start(Hash(1), Day, At, "Direct", DeviceKind.Phone, new string('a', AnalyticsVisit.LabelMaxLength + 1), "Android", null));
        Should.Throw<ArgumentException>(() => AnalyticsVisit.Start(Hash(1), Day, At, "Direct", DeviceKind.Phone, "Chrome", new string('a', AnalyticsVisit.LabelMaxLength + 1), null));
    }

    [Fact]
    public void AnUnnamedDeviceClassIsRefused()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => AnalyticsVisit.Start(Hash(1), Day, At, "Direct", (DeviceKind)99, "Chrome", "Android", null));
    }

    [Fact]
    public void APageViewHoldsTheVisitTheDayTheTimeAndThePageKey()
    {
        var visitId = Guid.CreateVersion7();

        var view = AnalyticsPageView.Of(visitId, Day, At, PageKeys.Gallery);

        view.VisitId.ShouldBe(visitId);
        view.BusinessDay.ShouldBe(Day);
        view.OccurredAtUtc.ShouldBe(At);
        view.PageKey.ShouldBe("gallery");
        view.Id.ShouldBe(0);
    }

    [Fact]
    public void APageViewRefusesAnEmptyVisitIdAndABadPageKey()
    {
        Should.Throw<ArgumentException>(() => AnalyticsPageView.Of(Guid.Empty, Day, At, PageKeys.Home));
        Should.Throw<ArgumentException>(() => AnalyticsPageView.Of(Guid.CreateVersion7(), Day, At, " "));
        Should.Throw<ArgumentNullException>(() => AnalyticsPageView.Of(Guid.CreateVersion7(), Day, At, null!));
        Should.Throw<ArgumentException>(() => AnalyticsPageView.Of(Guid.CreateVersion7(), Day, At, new string('a', PageKeys.MaxLength + 1)));
    }

    [Fact]
    public void ASampleHoldsTheMetricTheValueAndThePageKey()
    {
        var visitId = Guid.CreateVersion7();

        var sample = AnalyticsVitalSample.Of(visitId, Day, VitalMetric.Lcp, 2100m, PageKeys.Contact);

        sample.VisitId.ShouldBe(visitId);
        sample.BusinessDay.ShouldBe(Day);
        sample.Metric.ShouldBe(VitalMetric.Lcp);
        sample.Value.ShouldBe(2100m);
        sample.PageKey.ShouldBe("contact");
        sample.Id.ShouldBe(0);
    }

    [Fact]
    public void ASampleValueIsRoundedToThreeDecimals()
    {
        AnalyticsVitalSample.Of(Guid.CreateVersion7(), Day, VitalMetric.Cls, 0.04449m, PageKeys.Home).Value.ShouldBe(0.044m);
        AnalyticsVitalSample.Of(Guid.CreateVersion7(), Day, VitalMetric.Cls, 0.0445m, PageKeys.Home).Value.ShouldBe(0.045m);
    }

    [Fact]
    public void ASampleRefusesAnEmptyVisitIdABadPageKeyAnUnknownMetricAndAnOutOfRangeValue()
    {
        var visitId = Guid.CreateVersion7();

        Should.Throw<ArgumentException>(() => AnalyticsVitalSample.Of(Guid.Empty, Day, VitalMetric.Lcp, 1m, PageKeys.Home));
        Should.Throw<ArgumentException>(() => AnalyticsVitalSample.Of(visitId, Day, VitalMetric.Lcp, 1m, " "));
        Should.Throw<ArgumentException>(() => AnalyticsVitalSample.Of(visitId, Day, VitalMetric.Lcp, 1m, new string('a', PageKeys.MaxLength + 1)));
        Should.Throw<ArgumentOutOfRangeException>(() => AnalyticsVitalSample.Of(visitId, Day, (VitalMetric)99, 1m, PageKeys.Home));
        Should.Throw<ArgumentOutOfRangeException>(() => AnalyticsVitalSample.Of(visitId, Day, VitalMetric.Lcp, 70000m, PageKeys.Home));
        Should.Throw<ArgumentOutOfRangeException>(() => AnalyticsVitalSample.Of(visitId, Day, VitalMetric.Cls, -0.1m, PageKeys.Home));
    }

    [Fact]
    public void ASaltHoldsItsDayAnd32Bytes()
    {
        var bytes = Hash(7);

        var salt = AnalyticsSalt.Create(Day, bytes);

        salt.BusinessDay.ShouldBe(Day);
        salt.Salt.ShouldBe(bytes);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(31)]
    [InlineData(33)]
    public void ASaltThatIsNot32BytesIsRefused(int length)
    {
        Should.Throw<ArgumentException>(() => AnalyticsSalt.Create(Day, new byte[length]));
    }

    [Fact]
    public void ANullSaltIsRefused()
    {
        Should.Throw<ArgumentNullException>(() => AnalyticsSalt.Create(Day, null!));
    }

    private static byte[] Hash(byte fill) => Enumerable.Repeat(fill, 32).ToArray();
}

using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>ANL-09: the rolled-up rows hold only a day, a label and a count, and refuse values the columns cannot hold.</summary>
public sealed class DailyAnalyticsCountTests
{
    private static readonly DateOnly Day = new(2026, 11, 14);

    [Fact]
    public void AReferrerRowHoldsTheDayTheSourceAndTheCount()
    {
        var row = DailyReferrerCount.Of(Day, "Facebook", 2);

        row.BusinessDay.ShouldBe(Day);
        row.Referrer.ShouldBe("Facebook");
        row.Visits.ShouldBe(2);
    }

    [Fact]
    public void AReferrerAtTheLongestLengthIsKept()
    {
        var host = new string('a', ReferrerName.MaxLength);

        DailyReferrerCount.Of(Day, host, 1).Referrer.ShouldBe(host);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ABlankReferrerIsRefused(string referrer)
    {
        Should.Throw<ArgumentException>(() => DailyReferrerCount.Of(Day, referrer, 1));
    }

    [Fact]
    public void ANullReferrerIsRefused()
    {
        Should.Throw<ArgumentNullException>(() => DailyReferrerCount.Of(Day, null!, 1));
    }

    [Fact]
    public void AReferrerLongerThanTheColumnIsRefused()
    {
        Should.Throw<ArgumentException>(() => DailyReferrerCount.Of(Day, new string('a', ReferrerName.MaxLength + 1), 1));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void AReferrerCountBelowOneIsRefused(int visits)
    {
        Should.Throw<ArgumentOutOfRangeException>(() => DailyReferrerCount.Of(Day, "Direct", visits));
    }

    [Fact]
    public void ADeviceRowHoldsTheDayTheDimensionTheNameAndTheCount()
    {
        var row = DailyDeviceCount.Of(Day, DeviceDimension.Browser, "Chrome", 3);

        row.BusinessDay.ShouldBe(Day);
        row.Dimension.ShouldBe(DeviceDimension.Browser);
        row.Name.ShouldBe("Chrome");
        row.Visits.ShouldBe(3);
    }

    [Fact]
    public void ADeviceLabelAtTheLongestLengthIsKept()
    {
        var label = new string('a', AnalyticsVisit.LabelMaxLength);

        DailyDeviceCount.Of(Day, DeviceDimension.Device, label, 1).Name.ShouldBe(label);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ABlankDeviceLabelIsRefused(string name)
    {
        Should.Throw<ArgumentException>(() => DailyDeviceCount.Of(Day, DeviceDimension.Device, name, 1));
    }

    [Fact]
    public void ADeviceLabelLongerThanTheColumnIsRefused()
    {
        Should.Throw<ArgumentException>(() => DailyDeviceCount.Of(Day, DeviceDimension.Device, new string('a', AnalyticsVisit.LabelMaxLength + 1), 1));
    }

    [Fact]
    public void AnUnnamedDimensionIsRefused()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => DailyDeviceCount.Of(Day, (DeviceDimension)9, "Phone", 1));
    }

    [Fact]
    public void ADeviceCountBelowOneIsRefused()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => DailyDeviceCount.Of(Day, DeviceDimension.Device, "Phone", 0));
    }

    [Fact]
    public void NeitherRowHoldsAnythingAboutTheVisitor()
    {
        typeof(DailyReferrerCount).GetProperties().Select(property => property.Name).ShouldBe(["BusinessDay", "Referrer", "Visits"], ignoreOrder: true);
        typeof(DailyDeviceCount).GetProperties().Select(property => property.Name).ShouldBe(["BusinessDay", "Dimension", "Name", "Visits"], ignoreOrder: true);
    }
}

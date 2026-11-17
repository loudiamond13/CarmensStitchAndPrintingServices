using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>ANL-09 (D-26): Google's thresholds and the accepted value bounds.</summary>
public sealed class VitalRatingTests
{
    [Theory]
    [InlineData(VitalMetric.Lcp, "2500", VitalGrade.Good)]
    [InlineData(VitalMetric.Lcp, "2501", VitalGrade.NeedsWork)]
    [InlineData(VitalMetric.Lcp, "4000", VitalGrade.NeedsWork)]
    [InlineData(VitalMetric.Lcp, "4001", VitalGrade.Poor)]
    [InlineData(VitalMetric.Lcp, "0", VitalGrade.Good)]
    [InlineData(VitalMetric.Cls, "0.1", VitalGrade.Good)]
    [InlineData(VitalMetric.Cls, "0.11", VitalGrade.NeedsWork)]
    [InlineData(VitalMetric.Cls, "0.25", VitalGrade.NeedsWork)]
    [InlineData(VitalMetric.Cls, "0.26", VitalGrade.Poor)]
    [InlineData(VitalMetric.Inp, "200", VitalGrade.Good)]
    [InlineData(VitalMetric.Inp, "201", VitalGrade.NeedsWork)]
    [InlineData(VitalMetric.Inp, "500", VitalGrade.NeedsWork)]
    [InlineData(VitalMetric.Inp, "501", VitalGrade.Poor)]
    public void AValueIsRatedByTheThresholdsAndOnAThresholdGetsTheBetterRating(VitalMetric metric, string value, VitalGrade expected)
    {
        VitalRating.Rate(metric, decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture)).ShouldBe(expected);
    }

    [Theory]
    [InlineData(VitalMetric.Lcp, "-1", false)]
    [InlineData(VitalMetric.Lcp, "0", true)]
    [InlineData(VitalMetric.Lcp, "60000", true)]
    [InlineData(VitalMetric.Lcp, "60001", false)]
    [InlineData(VitalMetric.Cls, "-0.01", false)]
    [InlineData(VitalMetric.Cls, "0", true)]
    [InlineData(VitalMetric.Cls, "10", true)]
    [InlineData(VitalMetric.Cls, "10.01", false)]
    [InlineData(VitalMetric.Inp, "0", true)]
    [InlineData(VitalMetric.Inp, "60000", true)]
    [InlineData(VitalMetric.Inp, "60001", false)]
    [InlineData(VitalMetric.Inp, "-1", false)]
    public void OnlyValuesInsideTheBoundsAreAccepted(VitalMetric metric, string value, bool expected)
    {
        VitalBounds.IsValid(metric, decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture)).ShouldBe(expected);
    }

    [Fact]
    public void AnUnknownMetricIsRejectedByBothRules()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => VitalRating.Rate((VitalMetric)99, 1m));
        Should.Throw<ArgumentOutOfRangeException>(() => VitalBounds.IsValid((VitalMetric)99, 1m));
    }

    [Fact]
    public void TheMetricNumbersAreFixedBecauseTheyAreStored()
    {
        ((byte)VitalMetric.Lcp).ShouldBe((byte)1);
        ((byte)VitalMetric.Cls).ShouldBe((byte)2);
        ((byte)VitalMetric.Inp).ShouldBe((byte)3);
    }
}

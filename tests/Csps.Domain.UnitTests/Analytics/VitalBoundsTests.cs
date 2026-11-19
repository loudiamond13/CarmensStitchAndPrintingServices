using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>ANL-09 (D-26): the accepted value bounds of a stored speed sample.</summary>
public sealed class VitalBoundsTests
{
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
    public void AnUnknownMetricIsRejected()
    {
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

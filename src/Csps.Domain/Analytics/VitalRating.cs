namespace Csps.Domain.Analytics;

/// <summary>How good a speed number is, by Google's published thresholds.</summary>
public enum VitalGrade
{
    /// <summary>At or under the good threshold.</summary>
    Good = 1,

    /// <summary>Over the good threshold, at or under the poor threshold.</summary>
    NeedsWork = 2,

    /// <summary>Over the poor threshold.</summary>
    Poor = 3,
}

/// <summary>Rates a speed number Good, Needs work or Poor (D-26). A value exactly on a threshold gets the better rating.</summary>
public static class VitalRating
{
    private const decimal LcpGoodMs = 2500m;
    private const decimal LcpPoorMs = 4000m;
    private const decimal ClsGood = 0.1m;
    private const decimal ClsPoor = 0.25m;
    private const decimal InpGoodMs = 200m;
    private const decimal InpPoorMs = 500m;

    /// <summary>Rates one measured value.</summary>
    public static VitalGrade Rate(VitalMetric metric, decimal value)
    {
        var (good, poor) = metric switch
        {
            VitalMetric.Lcp => (LcpGoodMs, LcpPoorMs),
            VitalMetric.Cls => (ClsGood, ClsPoor),
            VitalMetric.Inp => (InpGoodMs, InpPoorMs),
            _ => throw new ArgumentOutOfRangeException(nameof(metric), metric, "Unknown metric."),
        };

        return value <= good ? VitalGrade.Good : value <= poor ? VitalGrade.NeedsWork : VitalGrade.Poor;
    }
}

/// <summary>The range of values a visitor's browser may report; anything outside is rejected as noise or abuse.</summary>
public static class VitalBounds
{
    private const decimal MaxMilliseconds = 60000m;
    private const decimal MaxClsScore = 10m;

    /// <summary>True when the value is inside the accepted range for the metric.</summary>
    public static bool IsValid(VitalMetric metric, decimal value)
    {
        var max = metric switch
        {
            VitalMetric.Lcp or VitalMetric.Inp => MaxMilliseconds,
            VitalMetric.Cls => MaxClsScore,
            _ => throw new ArgumentOutOfRangeException(nameof(metric), metric, "Unknown metric."),
        };

        return value >= 0m && value <= max;
    }
}

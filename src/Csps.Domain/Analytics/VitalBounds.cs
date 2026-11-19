namespace Csps.Domain.Analytics;

/// <summary>The range of values a visitor's browser may report; anything outside is rejected as noise or abuse.</summary>
public static class VitalBounds
{
    /// <summary>True when the value is inside the accepted range for the metric.</summary>
    public static bool IsValid(VitalMetric metric, decimal value)
    {
        const decimal MaxMilliseconds = 60000m;
        const decimal MaxClsScore = 10m;

        var max = metric switch
        {
            VitalMetric.Lcp or VitalMetric.Inp => MaxMilliseconds,
            VitalMetric.Cls => MaxClsScore,
            _ => throw new ArgumentOutOfRangeException(nameof(metric), metric, "Unknown metric."),
        };

        return value >= 0m && value <= max;
    }
}

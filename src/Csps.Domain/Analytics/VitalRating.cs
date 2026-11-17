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
    /// <summary>Rates one measured value.</summary>
    public static VitalGrade Rate(VitalMetric metric, decimal value) => throw new NotImplementedException();
}

/// <summary>The range of values a visitor's browser may report; anything outside is rejected as noise or abuse.</summary>
public static class VitalBounds
{
    /// <summary>True when the value is inside the accepted range for the metric.</summary>
    public static bool IsValid(VitalMetric metric, decimal value) => throw new NotImplementedException();
}

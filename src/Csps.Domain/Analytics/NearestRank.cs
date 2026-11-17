namespace Csps.Domain.Analytics;

/// <summary>The nearest-rank percentile, the method Google uses for the 75th percentile.</summary>
public static class NearestRank
{
    /// <summary>The zero-based index of the percentile in a sorted list of <paramref name="count"/> items, or null for an empty list.</summary>
    public static int? Index(int count, decimal percentile) =>
        count <= 0 ? null : Math.Max(0, (int)decimal.Ceiling(percentile * count) - 1);
}

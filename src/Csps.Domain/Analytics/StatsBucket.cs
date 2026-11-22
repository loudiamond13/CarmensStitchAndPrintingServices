namespace Csps.Domain.Analytics;

/// <summary>The size of one bar in a visits chart.</summary>
public enum StatsBucketKind
{
    /// <summary>One bar per day.</summary>
    Day = 1,

    /// <summary>One bar per month.</summary>
    Month = 2,
}

/// <summary>Chooses day or month bars for a date range.</summary>
public static class StatsBucket
{
    /// <summary>The longest range, in days, that is still drawn per day.</summary>
    public const int MaxDayBuckets = 62;

    /// <summary>Day for a range of up to 62 days, Month for anything longer. Both ends count.</summary>
    public static StatsBucketKind For(DateOnly from, DateOnly to) =>
        to.DayNumber - from.DayNumber + 1 <= MaxDayBuckets ? StatsBucketKind.Day : StatsBucketKind.Month;
}

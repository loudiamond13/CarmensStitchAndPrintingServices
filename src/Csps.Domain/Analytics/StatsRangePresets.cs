namespace Csps.Domain.Analytics;

/// <summary>The date range presets of the Visitor Stats page (D-24). Dates are business dates, both ends included.</summary>
public static class StatsRangePresets
{
    /// <summary>The last 7 days, today included.</summary>
    public const string LastSevenDays = "last-7-days";

    /// <summary>The last 30 days, today included.</summary>
    public const string LastThirtyDays = "last-30-days";

    /// <summary>From the 1st of this month to today.</summary>
    public const string ThisMonth = "this-month";

    /// <summary>The whole of the previous month.</summary>
    public const string LastMonth = "last-month";

    /// <summary>From 1 January to today.</summary>
    public const string ThisYear = "this-year";

    /// <summary>The name used when the caller sends its own dates.</summary>
    public const string Custom = "custom";

    /// <summary>The preset used when none is named.</summary>
    public const string Default = LastThirtyDays;

    /// <summary>The five named presets.</summary>
    public static IReadOnlyList<string> Names { get; } = [LastSevenDays, LastThirtyDays, ThisMonth, LastMonth, ThisYear];

    /// <summary>Resolves a preset against the business today; an unknown, empty or custom name gives the default.</summary>
    public static (DateOnly From, DateOnly To) Resolve(string? name, DateOnly today)
    {
        switch (name)
        {
            case LastSevenDays:
                return (today.AddDays(-6), today);
            case ThisMonth:
                return (new DateOnly(today.Year, today.Month, 1), today);
            case LastMonth:
                var lastDay = new DateOnly(today.Year, today.Month, 1).AddDays(-1);
                return (new DateOnly(lastDay.Year, lastDay.Month, 1), lastDay);
            case ThisYear:
                return (new DateOnly(today.Year, 1, 1), today);
            default:
                return (today.AddDays(-29), today);
        }
    }
}

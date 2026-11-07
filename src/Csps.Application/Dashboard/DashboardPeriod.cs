using Csps.Domain.Time;

namespace Csps.Application.Dashboard;

/// <summary>The business dates one dashboard answer is judged against, all taken from one clock read.</summary>
/// <param name="Today">The business today.</param>
/// <param name="WeekMonday">The Monday of the business week that holds today.</param>
/// <param name="WeekSunday">The Sunday of that week.</param>
/// <param name="MonthFirst">The first day of the business month that holds today.</param>
/// <param name="MonthLast">The last day of that month.</param>
/// <param name="ComparisonFirst">The first day of last month.</param>
/// <param name="ComparisonLast">The same day number last month, clamped to its last day.</param>
/// <param name="MonthStartUtc">The UTC instant the business month starts.</param>
/// <param name="MonthEndUtcExclusive">The UTC instant the next business month starts.</param>
public sealed record DashboardPeriod(
    DateOnly Today,
    DateOnly WeekMonday,
    DateOnly WeekSunday,
    DateOnly MonthFirst,
    DateOnly MonthLast,
    DateOnly ComparisonFirst,
    DateOnly ComparisonLast,
    DateTimeOffset MonthStartUtc,
    DateTimeOffset MonthEndUtcExclusive)
{
    /// <summary>Builds the period of a clock reading.</summary>
    /// <param name="clock">The business clock at the moment of the request.</param>
    /// <returns>The period.</returns>
    public static DashboardPeriod From(BusinessClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        var today = clock.Today;
        return new DashboardPeriod(today, today, today, today, today, today, today, clock.UtcNow, clock.UtcNow);
    }
}

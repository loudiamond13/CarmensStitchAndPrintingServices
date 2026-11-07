using Csps.Domain.Time;

namespace Csps.Application.Dashboard;

/// <summary>The business dates one dashboard answer is judged against, all taken from one clock read.</summary>
/// <param name="Today">The business today.</param>
public sealed record DashboardPeriod(DateOnly Today)
{
    /// <summary>Builds the period of a clock reading.</summary>
    /// <param name="clock">The business clock at the moment of the request.</param>
    /// <returns>The period.</returns>
    public static DashboardPeriod From(BusinessClock clock)
    {
        ArgumentNullException.ThrowIfNull(clock);
        return new DashboardPeriod(clock.Today);
    }
}

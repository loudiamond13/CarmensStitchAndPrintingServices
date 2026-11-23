using Csps.Domain.Time;

namespace Csps.Domain.QuoteRequests;

/// <summary>
/// How long a quote request that never became an order is kept (INQ-07, Phase 12 D-02, D-07). The daily cleanup reads the cut from here.
/// A converted request is never purged by age (D-22).
/// </summary>
public static class QuoteRequestRetention
{
    /// <summary>Calendar months a request is kept.</summary>
    public const int Months = 6;

    /// <summary>
    /// Requests received before this instant are purged: the start of the business day <see cref="Months"/> calendar months before
    /// <paramref name="today"/>. A day number the earlier month lacks is clamped to its last day.
    /// </summary>
    /// <param name="today">Today's business date.</param>
    /// <param name="zone">The business time zone.</param>
    /// <returns>The cut as a UTC instant.</returns>
    public static DateTimeOffset PurgeBefore(DateOnly today, TimeZoneInfo zone)
    {
        ArgumentNullException.ThrowIfNull(zone);

        var day = today.AddMonths(-Months);
        return new BusinessClock(zone, ZoneSource.Stored, DateTimeOffset.UnixEpoch).UtcRange(day, day).StartUtc;
    }
}

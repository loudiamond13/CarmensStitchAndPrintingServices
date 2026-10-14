namespace Csps.Domain.Time;

/// <summary>
/// Business time at one instant: the resolved business zone (D-02) and the current UTC instant. Pure: it never
/// reads a clock, so callers get "now" from <c>TimeProvider</c> and tests pin it with a fake clock. Day, month and
/// year boundaries are local midnights in <see cref="Zone"/>, converted to UTC with an exclusive end, so a query
/// is always <c>StartUtc &lt;= instant &lt; EndUtcExclusive</c>.
/// </summary>
/// <param name="Zone">The resolved business time zone.</param>
/// <param name="Source">Which step of the D-02 fallback chain produced <paramref name="Zone"/>.</param>
/// <param name="UtcNow">The current instant.</param>
public sealed record BusinessClock(TimeZoneInfo Zone, ZoneSource Source, DateTimeOffset UtcNow)
{
    /// <summary>The current instant in the business zone.</summary>
    public DateTimeOffset LocalNow => TimeZoneInfo.ConvertTime(UtcNow, Zone);

    /// <summary>Today's date in the business zone.</summary>
    public DateOnly Today => DateOnly.FromDateTime(LocalNow.DateTime);

    /// <summary>The current calendar year (January to December, D-03) in the business zone.</summary>
    public int Year => Today.Year;

    /// <summary>Returns the first and last day of the month that contains <paramref name="day"/>.</summary>
    /// <param name="day">Any day of the month.</param>
    /// <returns>The first and the last day of that month.</returns>
    public static (DateOnly First, DateOnly Last) MonthOf(DateOnly day) =>
        (new DateOnly(day.Year, day.Month, 1), new DateOnly(day.Year, day.Month, DateTime.DaysInMonth(day.Year, day.Month)));

    /// <summary>
    /// Returns the UTC instants that bound the business days <paramref name="from"/> through
    /// <paramref name="toInclusive"/>: the start of the first day and the start of the day after the last.
    /// </summary>
    /// <param name="from">The first business day.</param>
    /// <param name="toInclusive">The last business day, included in the range.</param>
    /// <returns>The inclusive UTC start and the exclusive UTC end.</returns>
    /// <exception cref="ArgumentOutOfRangeException"><paramref name="toInclusive"/> is before <paramref name="from"/>.</exception>
    public (DateTimeOffset StartUtc, DateTimeOffset EndUtcExclusive) UtcRange(DateOnly from, DateOnly toInclusive)
    {
        if (toInclusive < from)
        {
            throw new ArgumentOutOfRangeException(nameof(toInclusive), toInclusive, "The last day must not be before the first day.");
        }

        return (StartOfDayUtc(from), StartOfDayUtc(toInclusive.AddDays(1)));
    }

    /// <summary>Returns the UTC range of the business month that contains <paramref name="anyDayInMonth"/>.</summary>
    /// <param name="anyDayInMonth">Any day of the month.</param>
    /// <returns>The inclusive UTC start and the exclusive UTC end of that month.</returns>
    public (DateTimeOffset StartUtc, DateTimeOffset EndUtcExclusive) MonthUtcRange(DateOnly anyDayInMonth)
    {
        var (first, last) = MonthOf(anyDayInMonth);
        return UtcRange(first, last);
    }

    /// <summary>Returns the UTC range of the business calendar year <paramref name="year"/> (D-03).</summary>
    /// <param name="year">The calendar year.</param>
    /// <returns>The inclusive UTC start and the exclusive UTC end of that year.</returns>
    public (DateTimeOffset StartUtc, DateTimeOffset EndUtcExclusive) YearUtcRange(int year) =>
        UtcRange(new DateOnly(year, 1, 1), new DateOnly(year, 12, 31));

    // Asia/Manila has no DST, but a Manager may store a zone that does. If midnight falls in a DST gap the day
    // starts at the first valid local minute; if midnight happens twice the day starts at the first occurrence,
    // which has the larger UTC offset.
    private DateTimeOffset StartOfDayUtc(DateOnly day)
    {
        var local = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        while (Zone.IsInvalidTime(local))
        {
            local = local.AddMinutes(1);
        }

        if (Zone.IsAmbiguousTime(local))
        {
            return new DateTimeOffset(local, Zone.GetAmbiguousTimeOffsets(local).Max()).ToUniversalTime();
        }

        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, Zone), TimeSpan.Zero);
    }
}

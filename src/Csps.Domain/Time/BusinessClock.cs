namespace Csps.Domain.Time;

/// <summary>
/// Business time at one instant: the resolved business zone (D-02) and the current UTC instant. Pure: it never
/// reads a clock, so callers get "now" from <c>TimeProvider</c> and tests pin it with a fake clock.
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

    /// <summary>RED stub.</summary>
    public int Year => UtcNow.Year;

    /// <summary>RED stub.</summary>
    /// <param name="day">Any day.</param>
    /// <returns>Stub.</returns>
    public static (DateOnly First, DateOnly Last) MonthOf(DateOnly day) => (day, day);

    /// <summary>RED stub.</summary>
    /// <param name="from">First day.</param>
    /// <param name="toInclusive">Last day.</param>
    /// <returns>Stub.</returns>
    public (DateTimeOffset StartUtc, DateTimeOffset EndUtcExclusive) UtcRange(DateOnly from, DateOnly toInclusive) =>
        (new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero) + (UtcNow - UtcNow),
            new DateTimeOffset(toInclusive.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));

    /// <summary>RED stub.</summary>
    /// <param name="anyDayInMonth">Any day.</param>
    /// <returns>Stub.</returns>
    public (DateTimeOffset StartUtc, DateTimeOffset EndUtcExclusive) MonthUtcRange(DateOnly anyDayInMonth) =>
        UtcRange(anyDayInMonth, anyDayInMonth);

    /// <summary>RED stub.</summary>
    /// <param name="year">The year.</param>
    /// <returns>Stub.</returns>
    public (DateTimeOffset StartUtc, DateTimeOffset EndUtcExclusive) YearUtcRange(int year) =>
        UtcRange(new DateOnly(year, 1, 1), new DateOnly(year, 12, 31));
}

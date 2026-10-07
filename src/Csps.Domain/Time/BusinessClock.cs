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
}

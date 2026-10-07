namespace Csps.Domain.Time;

/// <summary>Resolves the stored business time zone through the D-02 fallback chain.</summary>
public static class TimeZoneResolver
{
    /// <summary>The default business zone (IANA id).</summary>
    public const string DefaultIana = "Asia/Manila";

    /// <summary>The Windows id of the same UTC+08, no-DST zone.</summary>
    public const string DefaultWindows = "Singapore Standard Time";

    /// <summary>Resolves <paramref name="storedId"/> against the system time-zone database.</summary>
    /// <param name="storedId">The id stored in SiteSettings; may be null, blank or unknown.</param>
    /// <returns>The zone and the step of the chain that produced it.</returns>
    public static (TimeZoneInfo Zone, ZoneSource Source) Resolve(string? storedId) =>
        Resolve(storedId, id => TimeZoneInfo.TryFindSystemTimeZoneById(id, out var zone) ? zone : null);

    internal static (TimeZoneInfo Zone, ZoneSource Source) Resolve(string? storedId, Func<string, TimeZoneInfo?> find)
    {
        if (!string.IsNullOrWhiteSpace(storedId) && find(storedId) is { } stored)
        {
            return (stored, ZoneSource.Stored);
        }

        if (find(DefaultIana) is { } iana)
        {
            return (iana, ZoneSource.FallbackIana);
        }

        return (TimeZoneInfo.Utc, ZoneSource.FallbackIana);
    }
}

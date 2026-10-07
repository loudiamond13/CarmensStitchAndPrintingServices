namespace Csps.Domain.Time;

/// <summary>Which step of the D-02 fallback chain produced the business time zone.</summary>
public enum ZoneSource
{
    /// <summary>The id stored in SiteSettings resolved.</summary>
    Stored,

    /// <summary>The stored id did not resolve; <c>Asia/Manila</c> (IANA) did.</summary>
    FallbackIana,

    /// <summary>Neither resolved; the Windows id <c>Singapore Standard Time</c> (UTC+08, no DST) did.</summary>
    FallbackWindows,

    /// <summary>Nothing resolved; a fixed UTC+08 zone with no daylight saving time is used.</summary>
    FixedOffset,
}

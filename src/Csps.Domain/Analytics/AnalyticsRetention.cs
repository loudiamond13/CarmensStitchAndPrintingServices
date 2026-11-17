namespace Csps.Domain.Analytics;

/// <summary>How long visitor analytics data is kept (D-03 to D-05, D-07). The cleanup job and the stats page read the cut dates from here.</summary>
public static class AnalyticsRetention
{
    /// <summary>Months a raw visit is kept (D-03).</summary>
    public const int RawMonths = 0;

    /// <summary>Months a consent record is kept after it was given (D-04).</summary>
    public const int ConsentMonths = 0;

    /// <summary>Years the daily roll-ups are kept (D-05).</summary>
    public const int DailyYears = 0;

    /// <summary>Months a consent choice lasts before the visitor is asked again.</summary>
    public const int ConsentLifetimeMonths = 0;

    /// <summary>Minutes of silence that end a visit (D-07).</summary>
    public const int SessionMinutes = 0;

    /// <summary>Days a visitor-hash salt lives before it is replaced (D-07).</summary>
    public const int SaltDays = 0;

    /// <summary>Raw visits dated before this business date are deleted.</summary>
    public static DateOnly RawCut(DateOnly today) => throw new NotImplementedException();

    /// <summary>Daily roll-ups dated before this business date are deleted.</summary>
    public static DateOnly DailyFloor(DateOnly today) => throw new NotImplementedException();

    /// <summary>Consent records given before this moment are deleted.</summary>
    public static DateTimeOffset ConsentPurgeBefore(DateTimeOffset utcNow) => throw new NotImplementedException();
}

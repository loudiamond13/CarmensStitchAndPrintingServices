namespace Csps.Domain.Analytics;

/// <summary>How long visitor analytics data is kept (D-03 to D-05, D-07). The cleanup job and the stats page read the cut dates from here.</summary>
public static class AnalyticsRetention
{
    /// <summary>Months a raw visit is kept (D-03).</summary>
    public const int RawMonths = 13;

    /// <summary>Months a consent record is kept after it was given (D-05).</summary>
    public const int ConsentMonths = 13;

    /// <summary>Years the daily roll-ups are kept (D-04).</summary>
    public const int DailyYears = 3;

    /// <summary>Days a visitor-hash salt lives before it is replaced (D-07): today's salt and the day before's.</summary>
    public const int SaltDays = 2;

    /// <summary>Raw visits dated before this business date are deleted.</summary>
    public static DateOnly RawCut(DateOnly today) => today.AddMonths(-RawMonths);

    /// <summary>Daily roll-ups dated before this business date are deleted.</summary>
    public static DateOnly DailyFloor(DateOnly today) => today.AddYears(-DailyYears);

    /// <summary>Salts dated before this business date are deleted, so only the last <see cref="SaltDays"/> days stay.</summary>
    public static DateOnly SaltCut(DateOnly today) => today.AddDays(-(SaltDays - 1));

    /// <summary>Consent records given before this moment are deleted.</summary>
    public static DateTimeOffset ConsentPurgeBefore(DateTimeOffset utcNow) => utcNow.AddMonths(-ConsentMonths);
}

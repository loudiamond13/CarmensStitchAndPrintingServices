namespace Csps.LegacyFitCheck.Mapping;

/// <summary>The two ways a stored legacy datetime can be read as a date (provisional, RESEARCH A3).</summary>
internal static class LegacyDates
{
    /// <summary>Reads the stored value as UTC and returns its Asia/Manila date.</summary>
    public static DateOnly ToManilaDate(DateTime stored) => DateOnly.FromDateTime(stored);

    /// <summary>Returns the date exactly as stored, with no zone change.</summary>
    public static DateOnly AsStoredDate(DateTime stored) => DateOnly.FromDateTime(stored);

    /// <summary>Tells whether the two readings give different dates.</summary>
    public static bool Differs(DateTime stored) => ToManilaDate(stored) != AsStoredDate(stored);
}

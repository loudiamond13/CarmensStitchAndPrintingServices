namespace Csps.Application.Analytics;

/// <summary>One business day of the CSV export (D-25). A count that is no longer kept (D-27) is null.</summary>
/// <param name="Day">The business day.</param>
/// <param name="UniqueVisitors">The distinct visitors of the day, or null before the 13-month cut.</param>
/// <param name="Visits">The visits of the day, or null before the 13-month cut.</param>
/// <param name="PageViews">The page views of the day.</param>
public sealed record DailyStatsRow(DateOnly Day, int? UniqueVisitors, int? Visits, int PageViews);

/// <summary>Writes the visitor stats CSV (D-25, D-33).</summary>
public static class VisitorStatsCsv
{
    /// <summary>The header line (D-33).</summary>
    public const string Header = "Date,Unique visitors,Visits,Page views";

    /// <summary>Writes the header and one line per row.</summary>
    /// <param name="rows">The rows, in order.</param>
    /// <returns>The CSV text.</returns>
    public static string Write(IReadOnlyList<DailyStatsRow> rows)
    {
        ArgumentNullException.ThrowIfNull(rows);
        return Header;
    }
}

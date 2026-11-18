using System.Globalization;
using System.Text;

namespace Csps.Application.Analytics;

/// <summary>One business day of the CSV export (D-25). A count that is no longer kept (D-27) is null.</summary>
/// <param name="Day">The business day.</param>
/// <param name="UniqueVisitors">The distinct visitors of the day, or null before the 13-month cut.</param>
/// <param name="Visits">The visits of the day, or null before the 13-month cut.</param>
/// <param name="PageViews">The page views of the day.</param>
public sealed record DailyStatsRow(DateOnly Day, int? UniqueVisitors, int? Visits, int PageViews);

/// <summary>
/// Writes the visitor stats CSV (D-25, D-33): the header, then one CRLF line per row. Every cell is a YYYY-MM-DD date, plain invariant digits or
/// empty, so no cell can start a spreadsheet formula (CWE-1236).
/// </summary>
public static class VisitorStatsCsv
{
    /// <summary>The header line (D-33).</summary>
    public const string Header = "Date,Unique visitors,Visits,Page views";

    private const string LineEnd = "\r\n";
    private const string DateFormat = "yyyy-MM-dd";

    /// <summary>Writes the header and one line per row.</summary>
    /// <param name="rows">The rows, in order.</param>
    /// <returns>The CSV text.</returns>
    /// <exception cref="ArgumentOutOfRangeException">A count is negative, which would start its cell with a minus sign.</exception>
    public static string Write(IReadOnlyList<DailyStatsRow> rows)
    {
        ArgumentNullException.ThrowIfNull(rows);

        var csv = new StringBuilder(Header).Append(LineEnd);
        foreach (var row in rows)
        {
            csv.Append(row.Day.ToString(DateFormat, CultureInfo.InvariantCulture))
                .Append(',').Append(Count(row.UniqueVisitors))
                .Append(',').Append(Count(row.Visits))
                .Append(',').Append(Count(row.PageViews))
                .Append(LineEnd);
        }

        return csv.ToString();
    }

    private static string Count(int? value)
    {
        if (value is null)
        {
            return string.Empty;
        }

        ArgumentOutOfRangeException.ThrowIfNegative(value.Value);
        return value.Value.ToString(CultureInfo.InvariantCulture);
    }
}

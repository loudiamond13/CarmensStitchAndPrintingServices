using System.Globalization;
using System.Text;

namespace Csps.Application.Analytics;

/// <summary>One line of the CSV export: the page views of one page on one business day (D-69).</summary>
/// <param name="Day">The business day.</param>
/// <param name="Page">The page's name, such as <c>Home</c>.</param>
/// <param name="PageViews">The page views of the page on the day.</param>
public sealed record DailyPageRow(DateOnly Day, string Page, int PageViews);

/// <summary>
/// Writes the visitor stats CSV (D-69): the header, then one CRLF line per row. A cell is a YYYY-MM-DD date, a page name that starts with a letter
/// and holds no comma, quote or line break, or plain invariant digits, so no cell can start a spreadsheet formula or break a line (CWE-1236).
/// </summary>
public static class VisitorStatsCsv
{
    /// <summary>The header line (D-69).</summary>
    public const string Header = "Date,Page,Page views";

    private const string LineEnd = "\r\n";
    private const string DateFormat = "yyyy-MM-dd";

    /// <summary>Writes the header and one line per row.</summary>
    /// <param name="rows">The rows, in order.</param>
    /// <returns>The CSV text.</returns>
    /// <exception cref="ArgumentException">A page text starts with something other than a letter or holds a comma, quote or line break.</exception>
    /// <exception cref="ArgumentOutOfRangeException">A count is negative, which would start its cell with a minus sign.</exception>
    public static string Write(IReadOnlyList<DailyPageRow> rows)
    {
        ArgumentNullException.ThrowIfNull(rows);

        var csv = new StringBuilder(Header).Append(LineEnd);
        foreach (var row in rows)
        {
            ArgumentOutOfRangeException.ThrowIfNegative(row.PageViews);
            csv.Append(row.Day.ToString(DateFormat, CultureInfo.InvariantCulture))
                .Append(',').Append(SafePage(row.Page))
                .Append(',').Append(row.PageViews.ToString(CultureInfo.InvariantCulture))
                .Append(LineEnd);
        }

        return csv.ToString();
    }

    private static string SafePage(string page)
    {
        if (string.IsNullOrEmpty(page) || !char.IsLetter(page[0]) || page.AsSpan().ContainsAny(",\"\r\n"))
        {
            throw new ArgumentException("A page text must start with a letter and hold no comma, quote or line break.", nameof(page));
        }

        return page;
    }
}

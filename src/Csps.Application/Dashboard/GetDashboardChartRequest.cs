using System.Globalization;

namespace Csps.Application.Dashboard;

/// <summary>The dashboard chart query (DASH-03). The months arrive as text so a value that is not a number still reaches the validator.</summary>
/// <param name="Months">How many months to show; 6 or 12. Blank or not sent means 6.</param>
public sealed record GetDashboardChartRequest(string? Months = null)
{
    /// <summary>The window lengths the chart accepts.</summary>
    public static readonly IReadOnlyList<int> AllowedMonths = [6, 12];

    /// <summary>The window length used when the caller sends none.</summary>
    public const int DefaultMonths = 6;

    /// <summary>Reads the months text as a whole number.</summary>
    /// <param name="text">The text sent by the browser.</param>
    /// <param name="months">The number when the text is a whole number of digits.</param>
    /// <returns>True when the text is digits only.</returns>
    public static bool TryReadMonths(string? text, out int months) =>
        int.TryParse(text?.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out months);
}

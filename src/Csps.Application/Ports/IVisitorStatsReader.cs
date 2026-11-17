namespace Csps.Application.Ports;

/// <summary>Read-only visitor figures for the Manager stats page (ANL-08). Totals only: no per-visitor or per-visit value leaves the store.</summary>
public interface IVisitorStatsReader
{
    /// <summary>
    /// Reads the totals for the business days <paramref name="first"/> to <paramref name="last"/>, both included. Page views are summed from the
    /// daily counts for the whole range. Visits and unique visitors are counted from the raw visits on the days from the later of
    /// <paramref name="first"/> and <paramref name="cut"/> to <paramref name="last"/>; they are zero when that span is empty.
    /// </summary>
    /// <param name="first">The first business day.</param>
    /// <param name="last">The last business day.</param>
    /// <param name="cut">The first business day raw visits are still kept for.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The three totals; a day with no rows counts as zero.</returns>
    Task<VisitorTotals> ReadTotalsAsync(DateOnly first, DateOnly last, DateOnly cut, CancellationToken cancellationToken);
}

/// <summary>The three totals of a range.</summary>
/// <param name="UniqueVisitors">The distinct visitors with a visit in the raw span.</param>
/// <param name="Visits">The visits in the raw span: one sitting, ended by 30 minutes of silence.</param>
/// <param name="PageViews">Every page view in the range, from the daily counts.</param>
public sealed record VisitorTotals(int UniqueVisitors, int Visits, int PageViews);

using Csps.Domain.Analytics;

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

    /// <summary>
    /// Reads page views and unique visitors per day or per month for the business days <paramref name="first"/> to <paramref name="last"/>.
    /// Page views come from the daily counts. Unique visitors are a distinct count over each bucket's raw visits from <paramref name="cut"/> on.
    /// </summary>
    /// <param name="first">The first business day.</param>
    /// <param name="last">The last business day.</param>
    /// <param name="cut">The first business day raw visits are still kept for.</param>
    /// <param name="bucket">Per day or per month.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>Only the buckets that have data, oldest first; the caller fills the rest with zeros.</returns>
    Task<IReadOnlyList<TrendCount>> ReadTrendAsync(DateOnly first, DateOnly last, DateOnly cut, StatsBucketKind bucket, CancellationToken cancellationToken);

    /// <summary>
    /// Reads the grouped counts behind the ranked lists for the business days <paramref name="first"/> to <paramref name="last"/>. Page views
    /// per page key come from the daily counts for the whole range.
    /// </summary>
    /// <param name="first">The first business day.</param>
    /// <param name="last">The last business day.</param>
    /// <param name="cut">The first business day raw visits are still kept for.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>One count per name, in no set order; a name with no count is left out. The caller orders, shares and trims.</returns>
    Task<VisitorLists> ReadListsAsync(DateOnly first, DateOnly last, DateOnly cut, CancellationToken cancellationToken);
}

/// <summary>The grouped counts behind the ranked lists.</summary>
/// <param name="Pages">Page views per page key.</param>
public sealed record VisitorLists(IReadOnlyList<NamedCount> Pages);

/// <summary>One grouped count.</summary>
/// <param name="Name">The name as stored.</param>
/// <param name="Count">The count.</param>
public sealed record NamedCount(string Name, long Count);

/// <summary>The three totals of a range.</summary>
/// <param name="UniqueVisitors">The distinct visitors with a visit in the raw span.</param>
/// <param name="Visits">The visits in the raw span: one sitting, ended by 30 minutes of silence.</param>
/// <param name="PageViews">Every page view in the range, from the daily counts.</param>
public sealed record VisitorTotals(int UniqueVisitors, int Visits, int PageViews);

/// <summary>The figures of one chart bucket that has data.</summary>
/// <param name="Start">The day, or the first day of the month.</param>
/// <param name="PageViews">The page views of the bucket inside the range.</param>
/// <param name="UniqueVisitors">The distinct visitors of the bucket from the cut on.</param>
public sealed record TrendCount(DateOnly Start, int PageViews, int UniqueVisitors);

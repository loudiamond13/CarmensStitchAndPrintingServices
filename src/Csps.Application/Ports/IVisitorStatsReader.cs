using Csps.Domain.Analytics;

namespace Csps.Application.Ports;

/// <summary>Read-only figures for the Manager stats page (ANL-08). Totals only: no per-visitor or per-visit value leaves the store.</summary>
public interface IVisitorStatsReader
{
    /// <summary>Reads every page view of the business days <paramref name="first"/> to <paramref name="last"/>, both included, from the daily page counts.</summary>
    /// <param name="first">The first business day.</param>
    /// <param name="last">The last business day.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The page views, capped at <see cref="int.MaxValue"/>; a day with no rows counts as zero.</returns>
    Task<int> ReadPageViewsAsync(DateOnly first, DateOnly last, CancellationToken cancellationToken);

    /// <summary>Reads page views per day or per month for the business days <paramref name="first"/> to <paramref name="last"/> from the daily page counts.</summary>
    /// <param name="first">The first business day.</param>
    /// <param name="last">The last business day.</param>
    /// <param name="bucket">Per day or per month.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>Only the buckets that have data, oldest first; the caller fills the rest with zeros.</returns>
    Task<IReadOnlyList<TrendCount>> ReadTrendAsync(DateOnly first, DateOnly last, StatsBucketKind bucket, CancellationToken cancellationToken);

    /// <summary>Reads the page views per page key for the business days <paramref name="first"/> to <paramref name="last"/> from the daily page counts.</summary>
    /// <param name="first">The first business day.</param>
    /// <param name="last">The last business day.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>One count per page key, in no set order; a page with no row is left out. The caller orders, shares and trims.</returns>
    Task<IReadOnlyList<NamedCount>> ReadPagesAsync(DateOnly first, DateOnly last, CancellationToken cancellationToken);

    /// <summary>Reads the page views of each page on each business day from <paramref name="first"/> to <paramref name="last"/> for the CSV export (D-69).</summary>
    /// <param name="first">The first business day.</param>
    /// <param name="last">The last business day.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>One row per day and page key that has views above zero, in no set order; the caller names, orders and writes them.</returns>
    Task<IReadOnlyList<DailyPageViews>> ReadDailyPagesAsync(DateOnly first, DateOnly last, CancellationToken cancellationToken);
}

/// <summary>The page views of one page on one business day.</summary>
/// <param name="Day">The business day.</param>
/// <param name="PageKey">The stored page key.</param>
/// <param name="Views">The page views, above zero.</param>
public sealed record DailyPageViews(DateOnly Day, string PageKey, int Views);

/// <summary>One grouped count.</summary>
/// <param name="Name">The name as stored.</param>
/// <param name="Count">The count.</param>
public sealed record NamedCount(string Name, long Count);

/// <summary>The page views of one chart bucket that has data.</summary>
/// <param name="Start">The day, or the first day of the month.</param>
/// <param name="PageViews">The page views of the bucket inside the range.</param>
public sealed record TrendCount(DateOnly Start, int PageViews);

namespace Csps.Application.Analytics;

/// <summary>The three headline totals of a range (ANL-08, D-33). Totals only: no visitor, visit or time is ever listed.</summary>
/// <param name="UniqueVisitors">The distinct visitors who had a visit in the counted span; null when the whole range is older than the raw cut (D-27).</param>
/// <param name="Visits">The visits in the counted span: one sitting, ended by 30 minutes of silence; null when the whole range is older than the raw cut (D-27).</param>
/// <param name="PageViews">Every page view in the range, from the daily counts, which are kept longer than the visits.</param>
/// <param name="CountedFrom">The business day visits and unique visitors are counted from, <c>YYYY-MM-DD</c>, when the range starts before the raw cut; otherwise null.</param>
public sealed record VisitorTotalsDto(int? UniqueVisitors, int? Visits, int PageViews, string? CountedFrom);

/// <summary>One bar of the visits chart (ANL-08): a day, or a month of the range.</summary>
/// <param name="Start">The first business day of the bar inside the range, <c>YYYY-MM-DD</c>: the day itself, or the month's first day in the range.</param>
/// <param name="PageViews">The page views of the bar; a bar with no data is 0.</param>
/// <param name="UniqueVisitors">The distinct visitors of the bar, counted once per bar from the raw cut on; null when the whole bar is older than the cut (D-27).</param>
public sealed record TrendBucketDto(string Start, int PageViews, int? UniqueVisitors);

/// <summary>One row of a ranked stats list (ANL-08, D-28): a page key, source, device class or browser with its count and share.</summary>
/// <param name="Name">The name as stored: a page key, a source such as <c>Facebook</c> or a host, a device class, or a browser family.</param>
/// <param name="Count">The page views (top pages) or visits (the other lists).</param>
/// <param name="Share">The whole percent of the list's total; a full list's shares add up to 100.</param>
public sealed record RankedItemDto(string Name, int Count, int Share);

/// <summary>The visitor stats answer (ANL-08). Dates are business days as <c>YYYY-MM-DD</c>.</summary>
/// <param name="Range">The range that was read: a preset name or <c>custom</c>.</param>
/// <param name="From">The first business day of the range, resolved on the server.</param>
/// <param name="To">The last business day of the range, resolved on the server.</param>
/// <param name="CutDate">The oldest business day that still has visits (13 months back); older days keep page views only.</param>
/// <param name="Totals">The three totals.</param>
/// <param name="Bucket">The bar size the server chose: <c>day</c> for a range of up to 62 days, otherwise <c>month</c>.</param>
/// <param name="Trend">One bar per day or month from the start of the range to its end, oldest first.</param>
/// <param name="TopPages">Up to 10 pages by page views, highest first; each name is a page key.</param>
public sealed record VisitorStatsResponse(
    string Range,
    string From,
    string To,
    string CutDate,
    VisitorTotalsDto Totals,
    string Bucket,
    IReadOnlyList<TrendBucketDto> Trend,
    IReadOnlyList<RankedItemDto> TopPages);

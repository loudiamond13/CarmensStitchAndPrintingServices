namespace Csps.Application.Analytics;

/// <summary>One bar of the page views chart (ANL-08, D-68): a day, or a month of the range.</summary>
/// <param name="Start">The first business day of the bar inside the range, <c>YYYY-MM-DD</c>: the day itself, or the month's first day in the range.</param>
/// <param name="PageViews">The page views of the bar; a bar with no data is 0.</param>
public sealed record TrendBucketDto(string Start, int PageViews);

/// <summary>One row of the most viewed pages list (ANL-08, D-67): a page key with its count and share.</summary>
/// <param name="Name">The page key as stored.</param>
/// <param name="Count">The page views of the page in the range.</param>
/// <param name="Share">The whole percent of all page views in the list's range; a full list's shares add up to 100.</param>
public sealed record RankedItemDto(string Name, int Count, int Share);

/// <summary>The visitor stats answer (ANL-08, D-57). Dates are business days as <c>YYYY-MM-DD</c>; every figure comes from the daily page counts.</summary>
/// <param name="Range">The range that was read: a preset name or <c>custom</c>.</param>
/// <param name="From">The first business day of the range, resolved on the server.</param>
/// <param name="To">The last business day of the range, resolved on the server.</param>
/// <param name="PageViews">Every page view in the range.</param>
/// <param name="Bucket">The bar size the server chose: <c>day</c> for a range of up to 62 days, otherwise <c>month</c>.</param>
/// <param name="Trend">One bar per day or month from the start of the range to its end, oldest first.</param>
/// <param name="TopPages">Up to 5 pages by page views, highest first; each name is a page key.</param>
public sealed record VisitorStatsResponse(
    string Range,
    string From,
    string To,
    int PageViews,
    string Bucket,
    IReadOnlyList<TrendBucketDto> Trend,
    IReadOnlyList<RankedItemDto> TopPages);

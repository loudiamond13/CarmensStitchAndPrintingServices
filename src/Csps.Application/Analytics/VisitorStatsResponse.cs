namespace Csps.Application.Analytics;

/// <summary>The three headline totals of a range (ANL-08, D-33). Totals only: no visitor, visit or time is ever listed.</summary>
/// <param name="UniqueVisitors">The distinct visitors who had a visit in the counted span; null when the whole range is older than the raw cut (D-27).</param>
/// <param name="Visits">The visits in the counted span: one sitting, ended by 30 minutes of silence; null when the whole range is older than the raw cut (D-27).</param>
/// <param name="PageViews">Every page view in the range, from the daily counts, which are kept longer than the visits.</param>
/// <param name="CountedFrom">The business day visits and unique visitors are counted from, <c>YYYY-MM-DD</c>, when the range starts before the raw cut; otherwise null.</param>
public sealed record VisitorTotalsDto(int? UniqueVisitors, int? Visits, int PageViews, string? CountedFrom);

/// <summary>The visitor stats answer (ANL-08). Dates are business days as <c>YYYY-MM-DD</c>.</summary>
/// <param name="Range">The range that was read: a preset name or <c>custom</c>.</param>
/// <param name="From">The first business day of the range, resolved on the server.</param>
/// <param name="To">The last business day of the range, resolved on the server.</param>
/// <param name="CutDate">The oldest business day that still has visits (13 months back); older days keep page views only.</param>
/// <param name="Totals">The three totals.</param>
public sealed record VisitorStatsResponse(string Range, string From, string To, string CutDate, VisitorTotalsDto Totals);

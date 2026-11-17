namespace Csps.Application.Analytics;

/// <summary>The visitor stats query (ANL-08, D-24). Every part is optional; with no range the last 30 days are read.</summary>
/// <param name="Range">A preset name (<c>last-7-days</c>, <c>last-30-days</c>, <c>this-month</c>, <c>last-month</c>, <c>this-year</c>) or <c>custom</c>; anything else means last 30 days.</param>
/// <param name="From">The first business day as <c>YYYY-MM-DD</c>; read only when <paramref name="Range"/> is <c>custom</c>.</param>
/// <param name="To">The last business day as <c>YYYY-MM-DD</c>; read only when <paramref name="Range"/> is <c>custom</c>.</param>
public sealed record VisitorStatsRequest(string? Range = null, string? From = null, string? To = null);

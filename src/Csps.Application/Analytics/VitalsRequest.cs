namespace Csps.Application.Analytics;

/// <summary>
/// One page speed report as the browser sends it (ANL-05, D-26). The path is the page's pathname; the server cuts it at the first <c>?</c> or
/// <c>#</c>. Each metric is optional: the browser reports the ones it measured. LCP and INP are in milliseconds, CLS is a score.
/// </summary>
/// <param name="Path">The page path, starting with a slash.</param>
/// <param name="Lcp">Largest Contentful Paint in milliseconds, or null.</param>
/// <param name="Cls">Cumulative Layout Shift score, or null.</param>
/// <param name="Inp">Interaction to Next Paint in milliseconds, or null.</param>
public sealed record VitalsRequest(string? Path = null, decimal? Lcp = null, decimal? Cls = null, decimal? Inp = null)
{
    /// <summary>Gets the request used when no body arrives, so the field error names the missing path.</summary>
    public static VitalsRequest Empty { get; } = new();
}

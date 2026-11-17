namespace Csps.Application.Analytics;

/// <summary>
/// One page view as the browser sends it (ANL-05, ANL-06). The path is the page's pathname; the server cuts it at the first <c>?</c> or <c>#</c>
/// and never stores it as sent. The referrer host is the host name of <c>document.referrer</c>, sent on the first view of a page load only.
/// </summary>
/// <param name="Path">The page path, starting with a slash.</param>
/// <param name="ReferrerHost">The referrer's host name, or null.</param>
public sealed record PageViewRequest(string? Path = null, string? ReferrerHost = null)
{
    /// <summary>Gets the request used when no body arrives, so the field error names the missing path.</summary>
    public static PageViewRequest Empty { get; } = new();
}

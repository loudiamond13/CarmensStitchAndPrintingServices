namespace Csps.Application.Analytics;

/// <summary>
/// One page view as the browser sends it (ANL-05, ANL-06). The path is the page's pathname; the server cuts it at the first <c>?</c> or <c>#</c>
/// and never stores it as sent. A body from an old cached page that still carries a referrer property is read as the path alone.
/// </summary>
/// <param name="Path">The page path, starting with a slash.</param>
public sealed record PageViewRequest(string? Path = null)
{
    /// <summary>Gets the request used when no body arrives, so the field error names the missing path.</summary>
    public static PageViewRequest Empty { get; } = new();
}

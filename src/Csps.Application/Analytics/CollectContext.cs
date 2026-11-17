namespace Csps.Application.Analytics;

/// <summary>
/// What the server knows about a page view call beyond its body, read by the controller from headers and cookies. None of these values is
/// stored or logged by the anonymous count (ANL-06).
/// </summary>
/// <param name="UserAgent">The <c>User-Agent</c> header, or null when it is missing.</param>
/// <param name="IsStaff">True when the call carries the staff marker cookie or an <c>Authorization</c> header (D-21).</param>
/// <param name="Gpc">True when the browser sent <c>Sec-GPC: 1</c>.</param>
/// <param name="VisitorToken">The visitor id cookie value, or null.</param>
/// <param name="ConsentCookie">The consent cookie value, or null.</param>
/// <param name="SiteHost">The site's own host name, so a referrer from the site itself counts as no referrer (D-28); null when unknown.</param>
public sealed record CollectContext(string? UserAgent, bool IsStaff, bool Gpc, string? VisitorToken, string? ConsentCookie, string? SiteHost = null);

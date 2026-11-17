namespace Csps.Server.Security;

/// <summary>
/// The two analytics cookies and their attributes (ANL-05, ANL-07). The consent cookie holds the visitor's choice and is readable by the
/// page; the visitor id is HttpOnly and sent only to the analytics API.
/// </summary>
public static class AnalyticsCookies
{
    /// <summary>The consent cookie name. The <c>__Host-</c> prefix stops a subdomain from planting it.</summary>
    public const string ConsentCookieName = "__Host-csps_consent";

    /// <summary>The visitor id cookie name.</summary>
    public const string VisitorCookieName = "__Secure-csps_vid";

    /// <summary>The path the visitor id cookie is sent to.</summary>
    public const string CookiePath = "/api/v1/analytics";
}

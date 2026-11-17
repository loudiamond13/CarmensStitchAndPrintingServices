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

    /// <summary>
    /// Sets the consent cookie from the server so Safari keeps it for the full 12 months: Path=/, Secure, SameSite=Lax and not HttpOnly,
    /// because the page reads it to decide what to load.
    /// </summary>
    /// <param name="response">The response.</param>
    /// <param name="value">The cookie value, made by the consent cookie codec.</param>
    /// <param name="expires">When the cookie expires.</param>
    public static void SetConsent(HttpResponse response, string value, DateTimeOffset expires)
    {
        ArgumentNullException.ThrowIfNull(response);
        ArgumentException.ThrowIfNullOrEmpty(value);

        response.Cookies.Append(ConsentCookieName, value, new CookieOptions
        {
            HttpOnly = false,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = expires,
            IsEssential = true,
        });
    }
}

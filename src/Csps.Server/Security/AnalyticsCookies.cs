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

    /// <summary>The staff marker cookie name (D-21).</summary>
    public const string StaffCookieName = "__Secure-csps_staff";

    /// <summary>The path the visitor id and staff marker cookies are sent to.</summary>
    public const string CookiePath = "/api/v1/analytics";

    private const int VisitorIdLength = 43;

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

    /// <summary>Gives the browser its visitor id. It is HttpOnly, Secure and SameSite Strict, and only the analytics API ever sees it (ANL-05).</summary>
    /// <param name="response">The response.</param>
    /// <param name="token">The visitor id, a secret random token.</param>
    /// <param name="expires">When the cookie expires.</param>
    public static void SetVisitor(HttpResponse response, string token, DateTimeOffset expires)
    {
        ArgumentNullException.ThrowIfNull(response);
        ArgumentException.ThrowIfNullOrEmpty(token);

        var options = VisitorOptions();
        options.Expires = expires;
        response.Cookies.Append(VisitorCookieName, token, options);
    }

    /// <summary>Takes the visitor id away, with the same path and attributes it was set with. Past analytics rows are not touched (D-41).</summary>
    /// <param name="response">The response.</param>
    public static void ExpireVisitor(HttpResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        response.Cookies.Delete(VisitorCookieName, VisitorOptions());
    }

    /// <summary>Marks the browser as signed-in staff, so the stats leave it out (D-21).</summary>
    /// <param name="response">The response.</param>
    /// <param name="expires">When the cookie expires; null for a browser-session cookie.</param>
    public static void SetStaff(HttpResponse response, DateTimeOffset? expires)
    {
        ArgumentNullException.ThrowIfNull(response);
        _ = expires;
    }

    /// <summary>Takes the staff marker away, with the same path and attributes it was set with.</summary>
    /// <param name="response">The response.</param>
    public static void ClearStaff(HttpResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
    }

    /// <summary>Tells whether a cookie value looks like a visitor id: 43 characters of base64url, as <c>ISecureRandom.NewToken</c> makes them.</summary>
    /// <param name="value">The cookie value, or null when the cookie is absent.</param>
    /// <returns>True when the value is a well-formed visitor id.</returns>
    public static bool IsVisitorId(string? value) =>
        value is { Length: VisitorIdLength } && value.All(static c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');

    private static CookieOptions VisitorOptions() => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Strict,
        Path = CookiePath,
        IsEssential = true,
    };
}

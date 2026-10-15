namespace Csps.Server.Security;

/// <summary>
/// The two auth cookies and their attributes (D-38, AUTH-02, AUTH-05). Both are scoped to the auth API only, are
/// HttpOnly, Secure and SameSite Strict, and carry the <c>csps_</c> stem because cookies ignore ports and another app
/// on <c>localhost</c> shares the jar.
/// </summary>
public static class AuthCookies
{
    /// <summary>The refresh cookie name (D-38). Renaming or rescoping it signs every device out once.</summary>
    public const string RefreshCookieName = "__Secure-csps_rt";

    /// <summary>The pending-login ticket cookie name.</summary>
    public const string TicketCookieName = "__Secure-csps_2fa";

    /// <summary>The path both cookies are sent to.</summary>
    public const string CookiePath = "/api/v1/auth";

    /// <summary>Sets the pending-login ticket cookie, expiring with the challenge.</summary>
    /// <param name="response">The response.</param>
    /// <param name="ticket">The ticket value.</param>
    /// <param name="expiresAt">When the challenge ends.</param>
    public static void SetTicket(HttpResponse response, string ticket, DateTimeOffset expiresAt)
    {
        ArgumentNullException.ThrowIfNull(response);
        ArgumentException.ThrowIfNullOrEmpty(ticket);

        var options = Options();
        options.Expires = expiresAt;
        response.Cookies.Append(TicketCookieName, ticket, options);
    }

    /// <summary>Clears the pending-login ticket cookie.</summary>
    /// <param name="response">The response.</param>
    public static void ClearTicket(HttpResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        response.Cookies.Delete(TicketCookieName, Options());
    }

    /// <summary>
    /// Sets the refresh cookie. With an expiry it lasts that long ("Keep me signed in"); without one it is a
    /// browser-session cookie that goes when the browser closes (D-03).
    /// </summary>
    /// <param name="response">The response.</param>
    /// <param name="token">The raw refresh token. A secret.</param>
    /// <param name="expiresAt">When the cookie expires; null for a browser-session cookie.</param>
    public static void SetRefresh(HttpResponse response, string token, DateTimeOffset? expiresAt)
    {
        ArgumentNullException.ThrowIfNull(response);
        ArgumentException.ThrowIfNullOrEmpty(token);

        var options = Options();
        options.Expires = expiresAt;
        response.Cookies.Append(RefreshCookieName, token, options);
    }

    /// <summary>Clears the refresh cookie.</summary>
    /// <param name="response">The response.</param>
    public static void ClearRefresh(HttpResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        response.Cookies.Delete(RefreshCookieName, Options());
    }

    private static CookieOptions Options() => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Strict,
        Path = CookiePath,
        IsEssential = true,
    };
}

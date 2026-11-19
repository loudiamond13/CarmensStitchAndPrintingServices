namespace Csps.Server.Security;

/// <summary>
/// The staff marker cookie and its attributes (D-21). The server sets no consent or visitor id cookie any more; the two retired names are in
/// <see cref="RetiredCookies"/> (D-63).
/// </summary>
public static class AnalyticsCookies
{
    /// <summary>The staff marker cookie name (D-21).</summary>
    public const string StaffCookieName = "__Secure-csps_staff";

    /// <summary>The path the staff marker cookie is sent to.</summary>
    public const string CookiePath = "/api/v1/analytics";

    private const string StaffMarkerValue = "1";

    /// <summary>Marks the browser as signed-in staff, so the stats leave it out (D-21).</summary>
    /// <param name="response">The response.</param>
    /// <param name="expires">When the cookie expires; null for a browser-session cookie.</param>
    public static void SetStaff(HttpResponse response, DateTimeOffset? expires)
    {
        ArgumentNullException.ThrowIfNull(response);

        var options = Options();
        options.Expires = expires;
        response.Cookies.Append(StaffCookieName, StaffMarkerValue, options);
    }

    /// <summary>Takes the staff marker away, with the same path and attributes it was set with.</summary>
    /// <param name="response">The response.</param>
    public static void ClearStaff(HttpResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        response.Cookies.Delete(StaffCookieName, Options());
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

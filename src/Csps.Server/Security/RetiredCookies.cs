namespace Csps.Server.Security;

/// <summary>
/// The two cookies the site no longer sets (D-63). The names live here, apart from <see cref="AnalyticsCookies"/> and <see cref="AuthCookies"/>,
/// so the cookie list in the Privacy Policy is checked against the cookies the site sets and never has to name these. Only the retired
/// cookie middleware reads them, to expire them in browsers that still hold them.
/// </summary>
public static class RetiredCookies
{
    /// <summary>The retired consent cookie name.</summary>
    public const string ConsentCookieName = "__Host-csps_consent";

    /// <summary>The retired visitor id cookie name.</summary>
    public const string VisitorCookieName = "__Secure-csps_vid";

    /// <summary>The path the consent cookie was set with.</summary>
    public const string ConsentPath = "/";

    /// <summary>The path the visitor id cookie was set with.</summary>
    public const string VisitorPath = "/api/v1/analytics";
}

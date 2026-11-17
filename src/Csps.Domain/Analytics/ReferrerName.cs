namespace Csps.Domain.Analytics;

/// <summary>Groups a referrer host into the friendly name the analytics tables store (D-28, D-37).</summary>
public static class ReferrerName
{
    /// <summary>Facebook, including its mobile and link-shim hosts.</summary>
    public const string Facebook = "Facebook";

    /// <summary>Messenger.</summary>
    public const string Messenger = "Messenger";

    /// <summary>Instagram.</summary>
    public const string Instagram = "Instagram";

    /// <summary>Google search, including the country sites.</summary>
    public const string Google = "Google";

    /// <summary>No usable referrer.</summary>
    public const string Direct = "Direct";

    /// <summary>The longest host name that is stored.</summary>
    public const int MaxLength = 253;

    /// <summary>Returns the name to store for a visit.</summary>
    /// <param name="referrerHost">The referrer host name (never a full URL), or null.</param>
    /// <param name="siteHost">The site's own host, so an internal referrer counts as none.</param>
    /// <param name="userAgent">The raw User-Agent, read only to spot an in-app browser when there is no referrer.</param>
    /// <returns>A fixed name, or a validated lowercase host; never part of the header.</returns>
    public static string From(string? referrerHost, string? siteHost, string? userAgent) => string.Empty;
}

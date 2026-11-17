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
    public static string From(string? referrerHost, string? siteHost, string? userAgent)
    {
        var host = Normalize(referrerHost);
        if (host is not null && host != Normalize(siteHost))
        {
            return Group(host) ?? host;
        }

        return FromInAppBrowser(userAgent) ?? Direct;
    }

    private static string? Normalize(string? host)
    {
        if (host is null || host.Length is 0 or > MaxLength)
        {
            return null;
        }

        foreach (var c in host)
        {
            if (!char.IsAsciiLetterOrDigit(c) && c is not ('.' or '-'))
            {
                return null;
            }
        }

        var lower = host.ToLowerInvariant();
        var name = lower.StartsWith("www.", StringComparison.Ordinal) ? lower[4..] : lower;
        return name.Length == 0 ? null : name;
    }

    private static string? Group(string host) => host switch
    {
        "com.facebook.katana" => Facebook,
        "com.facebook.orca" => Messenger,
        "com.instagram.android" => Instagram,
        _ when IsDomain(host, "facebook.com") => Facebook,
        _ when IsDomain(host, "messenger.com") => Messenger,
        _ when IsDomain(host, "instagram.com") => Instagram,
        _ when IsGoogle(host) => Google,
        _ => null,
    };

    // The host is the domain, or ends with a dot and the domain, so "notfacebook.com" does not match.
    private static bool IsDomain(string host, string domain) =>
        host.EndsWith(domain, StringComparison.Ordinal)
        && (host.Length == domain.Length || host[host.Length - domain.Length - 1] == '.');

    // google.<tld>, or google.com / google.co followed by one country label, with any subdomains in front.
    private static bool IsGoogle(string host)
    {
        var labels = host.Split('.');
        var n = labels.Length;
        return (n >= 2 && labels[n - 2] == "google" && (labels[n - 1] == "com" || IsCountry(labels[n - 1])))
            || (n >= 3 && labels[n - 3] == "google" && labels[n - 2] is "com" or "co" && IsCountry(labels[n - 1]));
    }

    private static bool IsCountry(string label) =>
        label.Length == 2 && char.IsAsciiLetter(label[0]) && char.IsAsciiLetter(label[1]);

    // Messenger headers also carry FBAN, so Messenger is checked first. The scan is capped (CWE-400).
    private static string? FromInAppBrowser(string? userAgent)
    {
        if (userAgent is null)
        {
            return null;
        }

        var ua = userAgent.AsSpan(0, Math.Min(userAgent.Length, Auditing.UserAgentFamily.MaxScanLength));
        if (Has(ua, "FBAN/Messenger") || Has(ua, "FB_IAB/MESSENGER"))
        {
            return Messenger;
        }

        if (Has(ua, "FBAN") || Has(ua, "FBAV") || Has(ua, "FB_IAB"))
        {
            return Facebook;
        }

        return Has(ua, "Instagram") ? Instagram : null;
    }

    private static bool Has(ReadOnlySpan<char> userAgent, string token) =>
        userAgent.Contains(token, StringComparison.OrdinalIgnoreCase);
}

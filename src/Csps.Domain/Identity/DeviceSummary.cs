using Csps.Domain.Auditing;

namespace Csps.Domain.Identity;

/// <summary>A coarse browser-and-device label and whether the browser was recognised.</summary>
/// <param name="Label">For example "Chrome on Android", or "Unknown browser".</param>
/// <param name="IsKnown">False when the browser could not be named.</param>
public readonly record struct DeviceDescription(string Label, bool IsKnown);

/// <summary>
/// Turns a User-Agent into a short label for the code email (D-32) and the signed-in devices page (D-43).
/// The label never holds a version, model, address or location. The header is attacker-controlled, so the scan
/// uses no regular expressions (CWE-1333) and reads at most the first <see cref="UserAgentFamily.MaxScanLength"/> characters
/// (CWE-400). Every label is built from fixed words, so it is far shorter than the 60 character storage limit.
/// </summary>
public static class DeviceSummary
{
    private const string UnknownBrowser = "Unknown browser";

    /// <summary>Describes <paramref name="userAgent"/>.</summary>
    /// <param name="userAgent">The raw User-Agent header, or null.</param>
    /// <returns>The label; "Unknown browser" for bots, blanks and anything unrecognised.</returns>
    public static DeviceDescription Describe(string? userAgent)
    {
        var browser = BrowserName(UserAgentFamily.Classify(userAgent));
        if (browser is null)
        {
            return new DeviceDescription(UnknownBrowser, false);
        }

        var device = DeviceName(userAgent.AsSpan(0, Math.Min(userAgent!.Length, UserAgentFamily.MaxScanLength)));
        return new DeviceDescription(device is null ? browser : $"{browser} on {device}", true);
    }

    private static string? BrowserName(string family) => family switch
    {
        UserAgentFamily.FacebookInApp => "Facebook app",
        UserAgentFamily.InstagramInApp => "Instagram app",
        UserAgentFamily.Chrome or UserAgentFamily.Edge or UserAgentFamily.Firefox or UserAgentFamily.Safari
            or UserAgentFamily.Opera or UserAgentFamily.SamsungInternet => family,
        _ => null,
    };

    // iPhone and iPad come first because their headers also say "Mac OS X"; Android and CrOS before Linux.
    private static string? DeviceName(ReadOnlySpan<char> userAgent)
    {
        if (Has(userAgent, "iPhone"))
        {
            return "iPhone";
        }

        if (Has(userAgent, "iPad"))
        {
            return "iPad";
        }

        if (Has(userAgent, "Android"))
        {
            return "Android";
        }

        if (Has(userAgent, "CrOS"))
        {
            return "Chromebook";
        }

        if (Has(userAgent, "Windows"))
        {
            return "Windows";
        }

        if (Has(userAgent, "Macintosh") || Has(userAgent, "Mac OS X"))
        {
            return "Mac";
        }

        return Has(userAgent, "Linux") ? "Linux" : null;
    }

    private static bool Has(ReadOnlySpan<char> userAgent, string token) =>
        userAgent.Contains(token, StringComparison.OrdinalIgnoreCase);
}

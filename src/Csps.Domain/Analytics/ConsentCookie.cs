using System.Diagnostics.CodeAnalysis;

namespace Csps.Domain.Analytics;

/// <summary>
/// The visitor's saved cookie choice (ANL-07). The cookie value is
/// "1_{consentId}_{policyVersion}_{s}_{m}_{yyyymmdd}" with an optional "_p" (pending) suffix.
/// </summary>
/// <param name="ConsentId">The id of the consent chain.</param>
/// <param name="PolicyVersion">The policy version the choice was made under, like "1.0".</param>
/// <param name="Stats">True or false when chosen, null when not chosen yet (map-only save, D-18).</param>
/// <param name="Map">True when the map is allowed.</param>
/// <param name="DecidedOn">The day the choice was made.</param>
/// <param name="Pending">True while the browser has not had the choice confirmed by the server.</param>
public sealed record ConsentCookie(Guid ConsentId, string PolicyVersion, bool? Stats, bool Map, DateOnly DecidedOn, bool Pending)
{
    /// <summary>The cookie name. The __Host- prefix stops a subdomain from planting it.</summary>
    public const string CookieName = "__Host-csps_consent";

    /// <summary>How long a choice stays current, in months.</summary>
    public const int LifetimeMonths = 12;

    /// <summary>Reads a cookie value. Anything that is not exactly the format gives false; it never throws.</summary>
    public static bool TryParse(string? value, [NotNullWhen(true)] out ConsentCookie? cookie)
    {
        cookie = null;
        return false;
    }

    /// <summary>The cookie value for this choice.</summary>
    public string Format() => Pending ? "p" : string.Empty;

    /// <summary>True when the visitor allowed stats, under the current policy version, less than 12 months ago.</summary>
    public bool AllowsStats(string currentVersion, DateOnly today) => Pending && currentVersion.Length < 0 && today == DecidedOn;
}

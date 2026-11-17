using System.Diagnostics.CodeAnalysis;
using System.Globalization;

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

    private const int MaxLength = 100;
    private const int FieldCount = 6;
    private const int PendingFieldCount = 7;
    private const int DayLength = 8;
    private const string Prefix = "1";
    private const string NotChosen = "-";
    private const string PendingMarker = "p";

    /// <summary>Reads a cookie value. Anything that is not exactly the format gives false; it never throws.</summary>
    public static bool TryParse(string? value, [NotNullWhen(true)] out ConsentCookie? cookie)
    {
        cookie = null;
        if (string.IsNullOrEmpty(value) || value.Length > MaxLength || !value.All(IsCookieOctet))
        {
            return false;
        }

        var parts = value.Split('_');
        var pending = parts.Length == PendingFieldCount;
        if ((parts.Length != FieldCount && !pending) || (pending && parts[FieldCount] != PendingMarker))
        {
            return false;
        }

        if (parts[0] != Prefix
            || !Guid.TryParseExact(parts[1], "N", out var consentId)
            || !IsLowerHex(parts[1])
            || !IsVersion(parts[2])
            || !TryReadStats(parts[3], out var stats)
            || !TryReadFlag(parts[4], out var map)
            || !TryReadDay(parts[5], out var decidedOn))
        {
            return false;
        }

        cookie = new ConsentCookie(consentId, parts[2], stats, map, decidedOn, pending);
        return true;
    }

    /// <summary>The cookie value for this choice.</summary>
    public string Format()
    {
        var stats = Stats switch
        {
            true => "1",
            false => "0",
            null => NotChosen,
        };
        var map = Map ? "1" : "0";
        var day = DecidedOn.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        var suffix = Pending ? "_" + PendingMarker : string.Empty;
        return $"{Prefix}_{ConsentId:N}_{PolicyVersion}_{stats}_{map}_{day}{suffix}";
    }

    /// <summary>
    /// True when the visitor allowed stats and the choice is current: the current policy version (D-22), a decision day
    /// that is not after <paramref name="today"/> (D-43: a cookie dated in the future is no choice), and less than 12
    /// months old (ANL-07). <paramref name="today"/> is the business day the server stamps through IBusinessCalendar.
    /// </summary>
    public bool AllowsStats(string currentVersion, DateOnly today) => Stats == true && IsCurrent(currentVersion, today);

    // Checked in this order so a future year-9999 day never reaches Expiry.
    private bool IsCurrent(string currentVersion, DateOnly today) =>
        string.Equals(PolicyVersion, currentVersion, StringComparison.Ordinal)
        && DecidedOn <= today
        && today < Expiry;

    // 12 months after the choice. AddMonths clamps month ends (29 Feb); the last year saturates instead of throwing.
    private DateOnly Expiry => DecidedOn.Year >= DateOnly.MaxValue.Year ? DateOnly.MaxValue : DecidedOn.AddMonths(LifetimeMonths);

    // Cookie-octet (RFC 6265): no control characters, space, quote, comma, semicolon or backslash.
    private static bool IsCookieOctet(char c) =>
        c == 0x21 || c is >= (char)0x23 and <= (char)0x2B || c is >= (char)0x2D and <= (char)0x3A
        || c is >= (char)0x3C and <= (char)0x5B || c is >= (char)0x5D and <= (char)0x7E;

    private static bool IsLowerHex(string text) => text.All(c => char.IsAsciiDigit(c) || c is >= 'a' and <= 'f');

    // "digits.digits", like "1.0".
    private static bool IsVersion(string text)
    {
        var dot = text.IndexOf('.', StringComparison.Ordinal);
        if (dot <= 0 || dot == text.Length - 1)
        {
            return false;
        }

        return text.Where((_, index) => index != dot).All(char.IsAsciiDigit);
    }

    private static bool TryReadStats(string text, out bool? stats)
    {
        stats = text switch
        {
            "1" => true,
            "0" => false,
            _ => null,
        };
        return stats is not null || text == NotChosen;
    }

    private static bool TryReadFlag(string text, out bool flag)
    {
        flag = text == "1";
        return text is "1" or "0";
    }

    private static bool TryReadDay(string text, out DateOnly day)
    {
        day = default;
        return text.Length == DayLength
            && text.All(char.IsAsciiDigit)
            && DateOnly.TryParseExact(text, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out day);
    }
}

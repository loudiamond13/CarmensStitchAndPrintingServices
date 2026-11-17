using Csps.Domain.Auditing;

namespace Csps.Domain.Analytics;

/// <summary>The device class stored for a visit.</summary>
public enum DeviceKind : byte
{
    /// <summary>A phone.</summary>
    Phone = 1,

    /// <summary>A tablet.</summary>
    Tablet = 2,

    /// <summary>A desktop or laptop computer.</summary>
    Computer = 3,

    /// <summary>Anything else, or no User-Agent.</summary>
    Other = 4,
}

/// <summary>
/// Reduces a User-Agent to a device class. The header is attacker-controlled, so the scan uses no regular
/// expressions (CWE-1333) and reads at most <see cref="UserAgentFamily.MaxScanLength"/> characters (CWE-400).
/// iPadOS Safari sends a Mac header, so an iPad that way counts as a Computer.
/// </summary>
public static class DeviceClass
{
    /// <summary>Returns the device class for <paramref name="userAgent"/>.</summary>
    /// <param name="userAgent">The raw User-Agent header, or null.</param>
    /// <returns>One of the <see cref="DeviceKind"/> values.</returns>
    public static DeviceKind From(string? userAgent)
    {
        if (userAgent is null)
        {
            return DeviceKind.Other;
        }

        var ua = userAgent.AsSpan(0, Math.Min(userAgent.Length, UserAgentFamily.MaxScanLength));
        if (Has(ua, "iPad") || Has(ua, "Tablet") || (Has(ua, "Android") && !Has(ua, "Mobile")))
        {
            return DeviceKind.Tablet;
        }

        if (Has(ua, "iPhone") || Has(ua, "iPod") || Has(ua, "Mobi") || Has(ua, "Android"))
        {
            return DeviceKind.Phone;
        }

        if (Has(ua, "Windows") || Has(ua, "Macintosh") || Has(ua, "CrOS") || Has(ua, "Linux"))
        {
            return DeviceKind.Computer;
        }

        return DeviceKind.Other;
    }

    private static bool Has(ReadOnlySpan<char> userAgent, string token) =>
        userAgent.Contains(token, StringComparison.OrdinalIgnoreCase);
}

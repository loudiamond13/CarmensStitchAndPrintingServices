using System.Net;

namespace Csps.Domain.Auditing;

/// <summary>Truncates a client IP address before it is stored (D-24).</summary>
public static class IpPrefix
{
    /// <summary>Returns the stored prefix for <paramref name="address"/>.</summary>
    /// <param name="address">The remote address, or null.</param>
    /// <returns>The prefix text, or null.</returns>
    public static string? From(IPAddress? address) => null;
}

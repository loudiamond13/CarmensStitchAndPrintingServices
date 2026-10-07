using System.Net;
using System.Net.Sockets;

namespace Csps.Domain.Auditing;

/// <summary>
/// Truncates a client IP address before it is stored (D-24, RA 10173 data minimization): IPv4 to /24.
/// </summary>
public static class IpPrefix
{
    private const int Ipv4PrefixBytes = 3;

    /// <summary>Returns the stored prefix for <paramref name="address"/>.</summary>
    /// <param name="address">The remote address, or null.</param>
    /// <returns>The /24 prefix text, or null for a null or non-IPv4 address.</returns>
    public static string? From(IPAddress? address)
    {
        if (address is null || address.AddressFamily != AddressFamily.InterNetwork)
        {
            return null;
        }

        var bytes = address.GetAddressBytes();
        Array.Clear(bytes, Ipv4PrefixBytes, bytes.Length - Ipv4PrefixBytes);
        return new IPAddress(bytes).ToString();
    }
}

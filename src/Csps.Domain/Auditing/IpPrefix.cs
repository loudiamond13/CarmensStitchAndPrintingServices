using System.Net;
using System.Net.Sockets;

namespace Csps.Domain.Auditing;

/// <summary>
/// Truncates a client IP address before it is stored (D-24, RA 10173 data minimization): IPv4 to /24
/// (<c>203.177.12.45</c> becomes <c>203.177.12.0</c>) and IPv6 to /48 (<c>2001:db8:abcd:12::1</c> becomes
/// <c>2001:db8:abcd::</c>). The audit log and, later, visitor analytics use the same rule.
/// </summary>
public static class IpPrefix
{
    private const int Ipv4PrefixBytes = 3;   // /24
    private const int Ipv6PrefixBytes = 6;   // /48

    /// <summary>Returns the stored prefix for <paramref name="address"/>.</summary>
    /// <param name="address">The remote address, or null when the connection has none.</param>
    /// <returns>
    /// The /24 or /48 prefix in standard text form, at most 45 characters; null for a null address.
    /// An IPv4-mapped IPv6 address (<c>::ffff:a.b.c.d</c>) is treated as IPv4, and an IPv6 scope id is dropped.
    /// </returns>
    public static string? From(IPAddress? address)
    {
        if (address is null)
        {
            return null;
        }

        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }

        // IPAddress only ever holds IPv4 (4 bytes) or IPv6 (16 bytes): its constructors reject any other
        // length, so there is no third family to handle. The new IPAddress built from the zeroed bytes
        // carries no scope id.
        var bytes = address.GetAddressBytes();
        var keep = address.AddressFamily == AddressFamily.InterNetwork ? Ipv4PrefixBytes : Ipv6PrefixBytes;
        Array.Clear(bytes, keep, bytes.Length - keep);
        return new IPAddress(bytes).ToString();
    }
}

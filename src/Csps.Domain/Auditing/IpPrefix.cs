using System.Net;
using System.Net.Sockets;

namespace Csps.Domain.Auditing;

/// <summary>
/// Truncates a client IP address before it is stored (D-24, RA 10173 data minimization): IPv4 to /24
/// (<c>203.177.12.45</c> becomes <c>203.177.12.0</c>) and IPv6 to /48 (<c>2001:db8:abcd:12::1</c> becomes
/// <c>2001:db8:abcd::</c>). IPv6 forms that embed an IPv4 address are mapped back to it first, so the visitor's
/// IPv4 is cut to /24 too: IPv4-mapped (<c>::ffff:a.b.c.d</c>), 6to4 (<c>2002::/16</c>) and the NAT64 well-known
/// prefix (<c>64:ff9b::/96</c>). The audit log and, later, visitor analytics use the same rule.
/// </summary>
public static class IpPrefix
{
    private const int Ipv4PrefixBytes = 3;   // /24
    private const int Ipv6PrefixBytes = 6;   // /48
    private const int Ipv6Length = 16;
    private const int SixToFourOffset = 2;   // 2002:AABB:CCDD::/16 carries the IPv4 in bytes 2-5
    private const int Nat64Offset = 12;      // 64:ff9b::/96 carries the IPv4 in the last 4 bytes

    /// <summary>Returns the stored prefix for <paramref name="address"/>.</summary>
    /// <param name="address">The remote address, or null when the connection has none.</param>
    /// <returns>
    /// The /24 or /48 prefix in standard text form, at most 45 characters; null for a null address.
    /// IPv4-mapped, 6to4 and NAT64 addresses are treated as their embedded IPv4, and an IPv6 scope id is dropped.
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
        if (TryEmbeddedIpv4(bytes, out var embedded))
        {
            bytes = embedded;
        }

        var keep = bytes.Length == Ipv6Length ? Ipv6PrefixBytes : Ipv4PrefixBytes;
        Array.Clear(bytes, keep, bytes.Length - keep);
        return new IPAddress(bytes).ToString();
    }

    private static bool TryEmbeddedIpv4(byte[] bytes, out byte[] ipv4)
    {
        ipv4 = [];
        if (bytes.Length != Ipv6Length)
        {
            return false;
        }

        if (bytes[0] == 0x20 && bytes[1] == 0x02)
        {
            ipv4 = bytes[SixToFourOffset..(SixToFourOffset + 4)];
            return true;
        }

        if (bytes[0] == 0x00 && bytes[1] == 0x64 && bytes[2] == 0xff && bytes[3] == 0x9b && bytes.AsSpan(4, 8).IndexOfAnyExcept((byte)0) < 0)
        {
            ipv4 = bytes[Nat64Offset..];
            return true;
        }

        return false;
    }
}

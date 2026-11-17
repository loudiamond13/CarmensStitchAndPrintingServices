using System.Security.Cryptography;
using System.Text;

namespace Csps.Application.Analytics;

/// <summary>
/// Reduces the visitor id to the value the analytics tables store (ANL-05, T-12-38). Only built-in hashes are used. Nothing here logs or
/// returns the input.
/// </summary>
public static class VisitorKey
{
    /// <summary>Hashes the visitor id cookie value with SHA-256, so the id itself is never stored.</summary>
    /// <param name="token">The cookie value.</param>
    /// <returns>The 32-byte hash.</returns>
    public static byte[] HashVisitor(string token)
    {
        ArgumentException.ThrowIfNullOrEmpty(token);
        return SHA256.HashData(Encoding.UTF8.GetBytes(token));
    }

    /// <summary>
    /// Hashes an address prefix (the /24 or /48 text from <c>IpPrefix.From</c>) with HMAC-SHA256 under the business day's random salt, so the
    /// same prefix gives the same value all day and a different one the next day (T-12-37).
    /// </summary>
    /// <param name="prefix">The truncated address prefix, or null when the connection had no address.</param>
    /// <param name="salt">The day's 32-byte salt.</param>
    /// <returns>The 32-byte hash, or null for a null prefix.</returns>
    public static byte[]? HashIp(string? prefix, byte[] salt)
    {
        ArgumentNullException.ThrowIfNull(salt);
        return prefix is null ? null : HMACSHA256.HashData(salt, Encoding.UTF8.GetBytes(prefix));
    }
}

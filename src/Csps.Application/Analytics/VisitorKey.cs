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
}

using System.Security.Cryptography;
using System.Text;

namespace Csps.Domain.Identity;

/// <summary>
/// SHA-256 of tickets and tokens, and the only way secrets are compared. A raw ticket or token is never
/// stored; the 32-byte hash (or a MAC for codes) is.
/// </summary>
public static class TokenHash
{
    /// <summary>Length in bytes of a SHA-256 hash and of an HMAC-SHA256 value.</summary>
    public const int HashLength = 32;

    /// <summary>Hashes <paramref name="secret"/> with SHA-256 over its UTF-8 bytes.</summary>
    /// <param name="secret">The raw ticket or token.</param>
    /// <returns>The 32-byte hash.</returns>
    public static byte[] Compute(string secret) => SHA256.HashData(Encoding.UTF8.GetBytes(secret));

    /// <summary>Compares two values in fixed time (CWE-208). Different lengths are never equal.</summary>
    /// <param name="left">The first value.</param>
    /// <param name="right">The second value.</param>
    /// <returns>True when both values are byte-for-byte equal.</returns>
    public static bool Equal(ReadOnlySpan<byte> left, ReadOnlySpan<byte> right) =>
        left.Length == right.Length && CryptographicOperations.FixedTimeEquals(left, right);
}

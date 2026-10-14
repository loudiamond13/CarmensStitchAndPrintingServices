using System.Diagnostics.CodeAnalysis;
using System.Security.Cryptography;
using System.Text;

namespace Csps.HostProbe;

/// <summary>
/// The probe's only access check (threat T-01-40, CWE-306). The key comes from configuration
/// (<c>HostProbe:Key</c>), never from source or git, and must be at least <see cref="MinimumLength"/> characters.
/// </summary>
internal static class ProbeKey
{
    /// <summary>The request header that carries the key.</summary>
    public const string HeaderName = "X-Probe-Key";

    /// <summary>The configuration key that holds the expected value.</summary>
    public const string ConfigurationKey = "HostProbe:Key";

    /// <summary>Shortest key the probe accepts. Shorter (or missing) keys leave the probe closed.</summary>
    public const int MinimumLength = 32;

    /// <summary>True when a usable key is configured.</summary>
    public static bool IsConfigured([NotNullWhen(true)] string? configured) =>
        !string.IsNullOrWhiteSpace(configured) && configured.Length >= MinimumLength;

    /// <summary>
    /// True only when a usable key is configured and <paramref name="provided"/> equals it. Both values are hashed
    /// with SHA-256 first, so the fixed-time comparison never leaks the key's length or a matching prefix.
    /// </summary>
    public static bool Matches(string? provided, string? configured)
    {
        if (!IsConfigured(configured) || provided is null)
        {
            return false;
        }

        var expected = SHA256.HashData(Encoding.UTF8.GetBytes(configured));
        var actual = SHA256.HashData(Encoding.UTF8.GetBytes(provided));
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}

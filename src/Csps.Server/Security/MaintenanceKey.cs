using System.Diagnostics.CodeAnalysis;
using System.Security.Cryptography;
using System.Text;
using Csps.Domain.Common;

namespace Csps.Server.Security;

/// <summary>
/// The only access check of the maintenance run (JOB-01, T-09-16, CWE-306 and CWE-208). The key comes from configuration
/// (<c>Maintenance:Key</c>), never from source or git, and must be at least <see cref="MinimumLength"/> characters.
/// With no usable key the endpoint stays closed.
/// </summary>
public static class MaintenanceKey
{
    /// <summary>The request header that carries the key.</summary>
    public const string HeaderName = "X-Maintenance-Key";

    /// <summary>The configuration key that holds the expected value.</summary>
    public const string ConfigurationKey = "Maintenance:Key";

    /// <summary>Shortest key the endpoint accepts. A shorter or missing key leaves the endpoint closed.</summary>
    public const int MinimumLength = 32;

    /// <summary>The machine code of a refused call.</summary>
    public const string ErrorCode = "maintenance.key";

    /// <summary>The message of a refused call. It is the same for a missing, a wrong and an unset key, so it reveals nothing.</summary>
    public const string WrongKeyMessage = "The maintenance key is missing or wrong.";

    /// <summary>Gets the error for a refused call.</summary>
    public static Error Refused { get; } = Error.Unauthenticated(ErrorCode, WrongKeyMessage);

    /// <summary>True when a usable key is configured.</summary>
    /// <param name="configured">The configured value.</param>
    /// <returns>True when it is present and long enough.</returns>
    public static bool IsConfigured([NotNullWhen(true)] string? configured) =>
        !string.IsNullOrWhiteSpace(configured) && configured.Length >= MinimumLength;

    /// <summary>
    /// True only when a usable key is configured and <paramref name="provided"/> equals it. Both values are hashed with SHA-256 first,
    /// so the fixed-time comparison never leaks the key's length or a matching prefix.
    /// </summary>
    /// <param name="provided">The value from the request header.</param>
    /// <param name="configured">The configured value.</param>
    /// <returns>True when the call may run.</returns>
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

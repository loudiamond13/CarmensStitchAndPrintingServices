using System.Collections.Frozen;

namespace Csps.Server.Logging;

/// <summary>
/// Decides which log property names hold secrets (FND-07, CWE-532). The rule is an exact name or a suffix, both
/// case-insensitive, and never a substring: <c>StatusCode</c> contains "code" but is not a secret, while
/// <c>Code</c> (a one-time code) is.
/// </summary>
public static class SensitiveDataMasking
{
    /// <summary>The value written in place of a secret.</summary>
    public const string Mask = "***";

    private static readonly FrozenSet<string> ExactNames = new[]
    {
        "Password",
        "Code",
        "Otp",
        "ApiKey",
        "Authorization",
        "Cookie",
        "ConnectionString",
        "CertificatePassword",
        "CertificateBase64",
        "SigningKey",
        "Secret",
        "Token",
    }.ToFrozenSet(StringComparer.OrdinalIgnoreCase);

    private static readonly string[] Suffixes = ["Password", "Token", "Secret"];

    /// <summary>Returns whether a property with this name must be written as <see cref="Mask"/>.</summary>
    /// <param name="name">The property name.</param>
    /// <returns><see langword="true"/> for a secret name.</returns>
    public static bool IsSensitive(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        return ExactNames.Contains(name)
            || Suffixes.Any(suffix => name.EndsWith(suffix, StringComparison.OrdinalIgnoreCase));
    }
}

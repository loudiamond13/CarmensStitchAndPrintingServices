using System.Collections.Frozen;

namespace Csps.Server.Logging;

/// <summary>
/// Decides which log property names hold secrets (FND-07, CWE-532). The rule is an exact name or a suffix, both
/// case-insensitive, and never a substring: <c>StatusCode</c> contains "code" but is not a secret, while
/// <c>Code</c> (a one-time code) is. The exact names cover Identity and sign-in secrets such as <c>PasswordHash</c>,
/// <c>SecurityStamp</c> and <c>CodeMac</c>; the suffixes <c>Hash</c>, <c>Stamp</c>, <c>Key</c> and <c>Mac</c> catch
/// the rest (WR-05).
/// </summary>
public static class SensitiveDataMasking
{
    /// <summary>The value written in place of a secret.</summary>
    public const string Mask = "***";

    private static readonly FrozenSet<string> ExactNames = new[]
    {
        "Password",
        "PasswordHash",
        "SecurityStamp",
        "ConcurrencyStamp",
        "AuthenticatorKey",
        "RecoveryCodes",
        "PrivateKey",
        "Pfx",
        "Ticket",
        "CodeMac",
        "TokenHash",
        "RequestHash",
        "ProtectedBody",
        "ResetCode",
        "VerificationCode",
        "SigningKeyId",
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

    private static readonly string[] Suffixes = ["Password", "Token", "Secret", "Hash", "Stamp", "Key", "Mac"];

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

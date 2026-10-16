namespace Csps.Infrastructure.Identity;

/// <summary>
/// Secrets of the sign-in flow, bound from the <c>Auth</c> section. <c>CodeMacKey</c> comes only from user-secrets in
/// Development (<c>tools/scripts/Initialize-DevSecrets.ps1</c>) and from the host settings in Production, never from
/// git. The API refuses to start when it is missing or too short, and no message ever contains the value.
/// </summary>
public sealed class AuthSecretsOptions
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "Auth";

    /// <summary>The smallest accepted key: 256 bits, the HMAC-SHA256 block of security.</summary>
    public const int MinimumKeyBytes = 32;

    /// <summary>The failure message for a missing, malformed or short key. It never contains the value.</summary>
    public const string CodeMacKeyInvalidMessage =
        "Auth:CodeMacKey must be a base64 value of at least 32 bytes. In Development run "
        + "tools/scripts/Initialize-DevSecrets.ps1; in Production set it in the host settings.";

    /// <summary>The HMAC-SHA256 key that binds sign-in codes to their challenge, base64-encoded. A secret.</summary>
    public string CodeMacKey { get; set; } = string.Empty;

    /// <summary>Decodes <see cref="CodeMacKey"/> when it is valid base64 of at least <see cref="MinimumKeyBytes"/> bytes.</summary>
    /// <param name="key">The decoded key bytes, or an empty array when the value is invalid.</param>
    /// <returns>True when the key is usable.</returns>
    public bool TryGetCodeMacKeyBytes(out byte[] key)
    {
        key = [];
        if (string.IsNullOrWhiteSpace(CodeMacKey))
        {
            return false;
        }

        var buffer = new byte[(CodeMacKey.Length * 3 / 4) + 3];
        if (!Convert.TryFromBase64String(CodeMacKey.Trim(), buffer, out var written) || written < MinimumKeyBytes)
        {
            return false;
        }

        key = buffer[..written];
        return true;
    }
}

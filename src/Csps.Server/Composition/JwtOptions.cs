namespace Csps.Server.Composition;

/// <summary>
/// Access-token validation settings, bound from the <c>Jwt</c> section (SEC-02, T-01-30, T-01-31). The issuer and
/// audience are not secrets and live in appsettings.json. The signing key is a secret: it comes only from
/// user-secrets in Development (<c>tools/scripts/Initialize-DevSecrets.ps1</c>) and from the host settings in
/// Production, never from git. The API refuses to start when any value is missing or the key is too short.
/// </summary>
public sealed class JwtOptions
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "Jwt";

    /// <summary>The smallest accepted signing key: 256 bits, the HMAC-SHA256 block of security.</summary>
    public const int MinimumKeyBytes = 32;

    /// <summary>The failure message for a missing issuer.</summary>
    public const string IssuerMissingMessage = "Jwt:Issuer is not configured.";

    /// <summary>The failure message for a missing audience.</summary>
    public const string AudienceMissingMessage = "Jwt:Audience is not configured.";

    /// <summary>The failure message for a missing, malformed or short signing key. It never contains the value.</summary>
    public const string SigningKeyInvalidMessage =
        "Jwt:SigningKey must be a base64 value of at least 32 bytes. In Development run "
        + "tools/scripts/Initialize-DevSecrets.ps1; in Production set it in the host settings.";

    /// <summary>The expected <c>iss</c> claim.</summary>
    public string Issuer { get; set; } = string.Empty;

    /// <summary>The expected <c>aud</c> claim.</summary>
    public string Audience { get; set; } = string.Empty;

    /// <summary>The HMAC-SHA256 signing key, base64-encoded. A secret.</summary>
    public string SigningKey { get; set; } = string.Empty;

    /// <summary>Decodes <see cref="SigningKey"/> when it is valid base64 of at least <see cref="MinimumKeyBytes"/> bytes.</summary>
    /// <param name="key">The decoded key bytes, or an empty array when the value is invalid.</param>
    /// <returns>True when the key is usable.</returns>
    public bool TryGetSigningKeyBytes(out byte[] key)
    {
        key = [];
        if (string.IsNullOrWhiteSpace(SigningKey))
        {
            return false;
        }

        var buffer = new byte[(SigningKey.Length * 3 / 4) + 3];
        if (!Convert.TryFromBase64String(SigningKey.Trim(), buffer, out var written) || written < MinimumKeyBytes)
        {
            return false;
        }

        key = buffer[..written];
        return true;
    }
}

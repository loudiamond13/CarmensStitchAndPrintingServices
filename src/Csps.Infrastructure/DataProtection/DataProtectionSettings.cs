namespace Csps.Infrastructure.DataProtection;

/// <summary>
/// The Data Protection certificates, bound from the <c>DataProtection</c> section (SEC-04, D-15). The key ring in
/// the database is encrypted with the current certificate. Every value is a secret: Development reads them from
/// user-secrets (<c>tools/scripts/Initialize-DevSecrets.ps1</c>) and Production from the host settings, never from git
/// or appsettings.json. The API refuses to start when any configured certificate cannot be opened with its private key.
/// </summary>
public sealed class DataProtectionSettings
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "DataProtection";

    /// <summary>The current certificate as a base64-encoded PFX (PKCS#12) that contains its private key. A secret.</summary>
    public string CertificateBase64 { get; set; } = string.Empty;

    /// <summary>The password of <see cref="CertificateBase64"/>. A secret.</summary>
    public string CertificatePassword { get; set; } = string.Empty;

    /// <summary>
    /// Certificates that encrypted older keys, kept after a rotation so those keys stay readable. They only decrypt;
    /// new keys always use the current certificate. Never remove one while a key it encrypted is still stored
    /// (docs/operations/data-protection-rotation.md).
    /// </summary>
    public IList<PreviousCertificateSettings> PreviousCertificates { get; } = [];
}

/// <summary>One retired Data Protection certificate, bound from <c>DataProtection:PreviousCertificates:{n}</c>.</summary>
public sealed class PreviousCertificateSettings
{
    /// <summary>The retired certificate as a base64-encoded PFX that contains its private key. A secret.</summary>
    public string CertificateBase64 { get; set; } = string.Empty;

    /// <summary>The password of <see cref="CertificateBase64"/>. A secret.</summary>
    public string CertificatePassword { get; set; } = string.Empty;
}

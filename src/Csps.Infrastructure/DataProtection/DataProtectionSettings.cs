namespace Csps.Infrastructure.DataProtection;

/// <summary>
/// The Data Protection certificate, bound from the <c>DataProtection</c> section (SEC-04, D-15). The key ring in
/// the database is encrypted with this certificate. Both values are secrets: Development reads them from
/// user-secrets (<c>tools/scripts/Initialize-DevSecrets.ps1</c>) and Production from the host settings, never
/// from git or appsettings.json.
/// </summary>
public sealed class DataProtectionSettings
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "DataProtection";

    /// <summary>The current certificate as a base64-encoded PFX (PKCS#12) that contains its private key. A secret.</summary>
    public string CertificateBase64 { get; set; } = string.Empty;

    /// <summary>The password of <see cref="CertificateBase64"/>. A secret.</summary>
    public string CertificatePassword { get; set; } = string.Empty;
}

using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace Csps.Testing;

/// <summary>
/// The Data Protection certificates of the test hosts (SEC-04, D-15). Each one is a self-signed RSA-2048 certificate
/// created in memory once per test run with <see cref="CertificateRequest"/>, never in the Windows certificate store,
/// and exported as a base64 PFX under a random password. Nothing is written to disk or to the repository.
/// </summary>
public static class TestCertificates
{
    /// <summary>The configuration key of the current certificate's base64 PFX.</summary>
    public const string CertificateBase64Setting = "DataProtection:CertificateBase64";

    /// <summary>The configuration key of the current certificate's PFX password.</summary>
    public const string CertificatePasswordSetting = "DataProtection:CertificatePassword";

    private const int KeySizeBits = 2048;

    private static readonly Lazy<TestCertificate> LazyCurrent = new(() => Create("CN=Csps Tests Data Protection (current)", includePrivateKey: true));

    private static readonly Lazy<TestCertificate> LazyOther = new(() => Create("CN=Csps Tests Data Protection (other)", includePrivateKey: true));

    private static readonly Lazy<TestCertificate> LazyPublicOnly = new(() => Create("CN=Csps Tests Data Protection (public only)", includePrivateKey: false));

    /// <summary>Gets the certificate every test host uses by default.</summary>
    public static TestCertificate Current => LazyCurrent.Value;

    /// <summary>Gets a second certificate, for rotation tests and for a host that must not read the default key ring.</summary>
    public static TestCertificate Other => LazyOther.Value;

    /// <summary>Gets a PFX that holds a certificate without its private key, which the API must refuse.</summary>
    public static TestCertificate PublicOnly => LazyPublicOnly.Value;

    /// <summary>Gets the configuration key of a previous certificate's base64 PFX.</summary>
    /// <param name="index">The zero-based position in <c>DataProtection:PreviousCertificates</c>.</param>
    /// <returns>The key, for example <c>DataProtection:PreviousCertificates:0:CertificateBase64</c>.</returns>
    public static string PreviousBase64Setting(int index) =>
        FormattableString.Invariant($"DataProtection:PreviousCertificates:{index}:CertificateBase64");

    /// <summary>Gets the configuration key of a previous certificate's PFX password.</summary>
    /// <param name="index">The zero-based position in <c>DataProtection:PreviousCertificates</c>.</param>
    /// <returns>The key, for example <c>DataProtection:PreviousCertificates:0:CertificatePassword</c>.</returns>
    public static string PreviousPasswordSetting(int index) =>
        FormattableString.Invariant($"DataProtection:PreviousCertificates:{index}:CertificatePassword");

    private static TestCertificate Create(string subject, bool includePrivateKey)
    {
        using var rsa = RSA.Create(KeySizeBits);
        var request = new CertificateRequest(subject, rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var now = TimeProvider.System.GetUtcNow();
        using var certificate = request.CreateSelfSigned(now.AddDays(-1), now.AddYears(1));
        var password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));

        if (includePrivateKey)
        {
            return new TestCertificate(Convert.ToBase64String(certificate.Export(X509ContentType.Pfx, password)), password);
        }

        using var publicOnly = X509CertificateLoader.LoadCertificate(certificate.RawData);
        return new TestCertificate(Convert.ToBase64String(publicOnly.Export(X509ContentType.Pfx, password)), password);
    }
}

/// <summary>A test PFX as the API reads it from configuration: base64 bytes and the password that opens them.</summary>
/// <param name="Base64">The PFX bytes, base64-encoded.</param>
/// <param name="Password">The PFX password.</param>
public sealed record TestCertificate(string Base64, string Password);

using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Csps.Infrastructure.DataProtection;
using Csps.Testing;

namespace Csps.Infrastructure.IntegrationTests.DataProtection;

/// <summary>
/// SEC-04, D-15: the Data Protection PFX opens into the machine key store, the one way the host allows (probe
/// 2026-10-16), and its key file is gone once the certificate is disposed.
/// </summary>
public sealed class CertificateLoaderTests
{
    [Fact]
    public void TheLoadedCertificateRoundTripsASecret()
    {
        using var certificate = CertificateLoader.Load(TestCertificates.Current.Base64, TestCertificates.Current.Password);
        using var publicKey = certificate.GetRSAPublicKey().ShouldNotBeNull();
        using var privateKey = certificate.GetRSAPrivateKey().ShouldNotBeNull();
        var secret = RandomNumberGenerator.GetBytes(32);

        var encrypted = publicKey.Encrypt(secret, RSAEncryptionPadding.Pkcs1);

        privateKey.Decrypt(encrypted, RSAEncryptionPadding.Pkcs1).ShouldBe(secret);
    }

    [Fact]
    [SupportedOSPlatform("windows")]
    public void TheKeyLivesInTheMachineKeyStoreWhileOpen()
    {
        Assert.SkipUnless(OperatingSystem.IsWindows(), "CNG key stores exist only on Windows.");

        using var certificate = CertificateLoader.Load(TestCertificates.Current.Base64, TestCertificates.Current.Password);
        using var privateKey = certificate.GetRSAPrivateKey().ShouldNotBeNull();
        using var key = privateKey.ShouldBeOfType<RSACng>().Key;

        key.IsMachineKey.ShouldBeTrue();
        key.IsEphemeral.ShouldBeFalse();
    }

    [Fact]
    [SupportedOSPlatform("windows")]
    public void DisposingTheCertificateRemovesItsKey()
    {
        Assert.SkipUnless(OperatingSystem.IsWindows(), "CNG key stores exist only on Windows.");

        StoredKey stored;
        using (var certificate = CertificateLoader.Load(TestCertificates.Current.Base64, TestCertificates.Current.Password))
        {
            stored = StoredKey.Read(certificate);
        }

        stored.Exists().ShouldBeFalse("The key file must not outlive the certificate (no PersistKeySet).");
    }

    [Fact]
    public void AWrongPasswordIsRefusedWithAPlainMessage()
    {
        var error = Should.Throw<InvalidOperationException>(
            () => CertificateLoader.Load(TestCertificates.Current.Base64, "not-the-password"));

        error.Message.ShouldBe(CertificateLoader.CannotOpenMessage);
    }
}

/// <summary>A machine key's name and provider, read with every handle to it already closed.</summary>
/// <param name="Name">The CNG key name.</param>
/// <param name="Provider">The CNG key storage provider.</param>
[SupportedOSPlatform("windows")]
internal sealed record StoredKey(string Name, CngProvider Provider)
{
    public static StoredKey Read(X509Certificate2 certificate)
    {
        using var privateKey = certificate.GetRSAPrivateKey().ShouldNotBeNull();
        using var key = privateKey.ShouldBeOfType<RSACng>().Key;
        key.IsMachineKey.ShouldBeTrue();
        return new StoredKey(key.KeyName.ShouldNotBeNull(), key.Provider.ShouldNotBeNull());
    }

    public bool Exists() => CngKey.Exists(Name, Provider, CngKeyOpenOptions.MachineKey);
}

using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace Csps.Infrastructure.DataProtection;

/// <summary>
/// Opens a Data Protection certificate from its base64 PFX and password (D-15). On the host, in-memory and user-store
/// keys fail because the app pool runs on a temporary profile (0x80090024, probe 2026-10-16), so the key is loaded
/// with <see cref="X509KeyStorageFlags.MachineKeySet"/>. It stays in the machine key store only while the certificate
/// is open: disposing the certificate deletes it, so every caller must dispose. Error messages never contain the PFX
/// or the password.
/// </summary>
public static class CertificateLoader
{
    /// <summary>The failure message when the PFX value is empty.</summary>
    public const string MissingMessage = "No certificate is configured.";

    /// <summary>The failure message when the PFX value is not base64.</summary>
    public const string NotBase64Message = "The certificate is not valid base64.";

    /// <summary>The failure message when the PFX cannot be opened, for example because the password is wrong.</summary>
    public const string CannotOpenMessage = "The certificate could not be opened. Check the PFX and its password.";

    /// <summary>The failure message when the PFX holds no private key.</summary>
    public const string NoPrivateKeyMessage = "The certificate has no private key, so it cannot decrypt the key ring.";

    /// <summary>Loads a certificate with its private key. The caller disposes it.</summary>
    /// <param name="base64">The PFX bytes, base64-encoded.</param>
    /// <param name="password">The PFX password.</param>
    /// <returns>The certificate, with a private key that is deleted when the certificate is disposed.</returns>
    /// <exception cref="InvalidOperationException">The value is empty, not base64, cannot be opened, or has no private key.</exception>
    public static X509Certificate2 Load(string base64, string password)
    {
        if (string.IsNullOrWhiteSpace(base64))
        {
            throw new InvalidOperationException(MissingMessage);
        }

        byte[] pfx;
        try
        {
            pfx = Convert.FromBase64String(base64.Trim());
        }
        catch (FormatException exception)
        {
            throw new InvalidOperationException(NotBase64Message, exception);
        }

        X509Certificate2 certificate;
        try
        {
            certificate = X509CertificateLoader.LoadPkcs12(pfx, password, X509KeyStorageFlags.MachineKeySet);
        }
        catch (CryptographicException exception)
        {
            throw new InvalidOperationException(CannotOpenMessage, exception);
        }

        if (!certificate.HasPrivateKey)
        {
            certificate.Dispose();
            throw new InvalidOperationException(NoPrivateKeyMessage);
        }

        return certificate;
    }
}

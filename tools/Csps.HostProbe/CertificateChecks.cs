using System.Globalization;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.RegularExpressions;

namespace Csps.HostProbe;

/// <summary>One certificate load attempt. Failures carry the failing step, the error type, its code and a cleaned message.</summary>
internal sealed record CertificateAttempt(
    string Name,
    bool Ok,
    string? Step,
    string? ExceptionType,
    string? HResult,
    string? Message,
    string KeyCleanup);

/// <summary>
/// SEC-04 prerequisite (research Pattern 9b): which way of loading an in-memory PFX works on the host, and where it fails.
/// The key is tested the way Data Protection uses it. Messages never hold the password, a folder path or a stack trace.
/// </summary>
internal static partial class CertificateChecks
{
    internal const int KeySize = 3072;
    internal const int MaxMessageLength = 200;

    internal const string StepCreate = "create";
    internal const string StepExport = "export";
    internal const string StepLoad = "load";
    internal const string StepUse = "use";

    internal const string CleanupNone = "none";

    private sealed record AttemptSpec(
        string Name,
        Func<X509Certificate2, string, byte[]> Export,
        X509KeyStorageFlags Flags);

    private static readonly AttemptSpec[] Attempts =
    [
        new("ephemeral", PlatformExport, X509KeyStorageFlags.EphemeralKeySet),
    ];

    public static IReadOnlyList<CertificateAttempt> Run(TimeProvider time)
    {
        ArgumentNullException.ThrowIfNull(time);

        var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        X509Certificate2 certificate;
        try
        {
            using var rsa = RSA.Create(KeySize);
            var request = new CertificateRequest(
                "CN=Csps.HostProbe", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            var now = time.GetUtcNow();
            certificate = request.CreateSelfSigned(now.AddMinutes(-5), now.AddDays(1));
        }
        catch (Exception error) when (IsCryptoFailure(error))
        {
            return [.. Attempts.Select(spec => Failed(spec.Name, StepCreate, error, password))];
        }

        using (certificate)
        {
            return [.. Attempts.Select(spec => RunAttempt(spec, certificate, password))];
        }
    }

    internal static CertificateAttempt Failed(string name, string step, Exception error, string password)
    {
        ArgumentNullException.ThrowIfNull(error);

        return new CertificateAttempt(
            name,
            Ok: false,
            step,
            error.GetType().Name,
            "0x" + error.HResult.ToString("X8", CultureInfo.InvariantCulture),
            Clean(error.Message, password),
            CleanupNone);
    }

    internal static string Clean(string message, string password)
    {
        ArgumentNullException.ThrowIfNull(message);

        var text = string.IsNullOrEmpty(password) ? message : message.Replace(password, "[hidden]", StringComparison.Ordinal);
        text = DrivePath().Replace(text, "[path]");
        text = UncPath().Replace(text, "[path]");
        text = UnixPath().Replace(text, "[path]");
        text = Whitespace().Replace(text, " ").Trim();

        return text.Length <= MaxMessageLength ? text : string.Concat(text.AsSpan(0, MaxMessageLength - 3), "...");
    }

    private static CertificateAttempt RunAttempt(AttemptSpec spec, X509Certificate2 certificate, string password)
    {
        var step = StepExport;
        try
        {
            var pfx = spec.Export(certificate, password);

            step = StepLoad;
            using var loaded = X509CertificateLoader.LoadPkcs12(pfx, password, spec.Flags);

            step = StepUse;
            using var publicKey = loaded.GetRSAPublicKey();
            using var privateKey = loaded.GetRSAPrivateKey();
            if (publicKey is null || privateKey is null)
            {
                return Unusable("The certificate has no RSA key pair.");
            }

            // PKCS#1 v1.5 because Data Protection's EncryptedXml key wrap uses it.
            var session = RandomNumberGenerator.GetBytes(32);
            var cipher = publicKey.Encrypt(session, RSAEncryptionPadding.Pkcs1);
            var plain = privateKey.Decrypt(cipher, RSAEncryptionPadding.Pkcs1);
            return session.AsSpan().SequenceEqual(plain)
                ? new CertificateAttempt(spec.Name, Ok: true, null, null, null, null, CleanupNone)
                : Unusable("The decrypted value did not match.");
        }
        catch (Exception error) when (IsCryptoFailure(error))
        {
            return Failed(spec.Name, step, error, password);
        }

        CertificateAttempt Unusable(string message) =>
            new(spec.Name, Ok: false, StepUse, null, null, message, CleanupNone);
    }

    private static byte[] PlatformExport(X509Certificate2 certificate, string password) =>
        certificate.Export(X509ContentType.Pkcs12, password);

    private static bool IsCryptoFailure(Exception error) =>
        error is CryptographicException or PlatformNotSupportedException or UnauthorizedAccessException
            or IOException or ArgumentException;

    [GeneratedRegex(@"[A-Za-z]:\\[^\s""'<>|]*", RegexOptions.CultureInvariant)]
    private static partial Regex DrivePath();

    [GeneratedRegex(@"\\\\[^\s""'<>|]+", RegexOptions.CultureInvariant)]
    private static partial Regex UncPath();

    [GeneratedRegex(@"(?<![\w/])/[\w.\-]+(?:/[\w.\-]+)*", RegexOptions.CultureInvariant)]
    private static partial Regex UnixPath();

    [GeneratedRegex(@"[\s\p{Cc}]+", RegexOptions.CultureInvariant)]
    private static partial Regex Whitespace();
}

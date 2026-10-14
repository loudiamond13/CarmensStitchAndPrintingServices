using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace Csps.HostProbe;

/// <summary>Result of a yes/no check. <see cref="Error"/> holds an exception type name only, never its message.</summary>
internal sealed record CheckResult(bool Ok, string? Error);

/// <summary>Whether <c>{contentRoot}/logs</c> accepts a file (D-21 log files live there).</summary>
internal sealed record LogsFolderResult(bool Writable, bool FolderExisted, string? Error);

/// <summary>Whether the business zone Asia/Manila resolves on the host (FND-08).</summary>
internal sealed record ZoneResult(bool Found, string? Id, string? BaseUtcOffset);

/// <summary>Whether the en-PH culture loads and how it formats 12450 as currency (expected ₱12,450.00).</summary>
internal sealed record CultureResult(bool Available, string? Currency12450, string? Error);

/// <summary>
/// The facts only the host can show (FND-13, research Pattern 15). By design it never contains environment
/// variables, configuration values, secrets or connection strings.
/// </summary>
internal sealed record HostFacts(
    string FrameworkDescription,
    string EnvironmentVersion,
    bool Is64BitProcess,
    string ProcessName,
    bool InProcess,
    string CurrentDirectory,
    string ContentRootPath,
    LogsFolderResult LogsWritable,
    string? RemoteIpAddress,
    string? XForwardedFor,
    string? XForwardedProto,
    string? XRealIp,
    string? CfConnectingIp,
    bool IsHttps,
    ZoneResult ManilaZone,
    CultureResult EnPhCulture,
    CheckResult EphemeralPfxRoundTrip,
    long TotalAvailableMemoryBytes,
    DateTimeOffset CheckedAtUtc)
{
    private const string ManilaZoneId = "Asia/Manila";
    private const string PhilippineCulture = "en-PH";
    private const decimal SampleAmount = 12450m;

    /// <summary>Collects every fact for one request. Each check catches its own failure, so one never hides another.</summary>
    public static HostFacts Collect(HttpContext context, IHostEnvironment environment, TimeProvider time)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(environment);
        ArgumentNullException.ThrowIfNull(time);

        var processName = CurrentProcessName();
        var request = context.Request;

        return new HostFacts(
            FrameworkDescription: RuntimeInformation.FrameworkDescription,
            EnvironmentVersion: Environment.Version.ToString(),
            Is64BitProcess: Environment.Is64BitProcess,
            ProcessName: processName,
            InProcess: string.Equals(processName, "w3wp", StringComparison.OrdinalIgnoreCase),
            CurrentDirectory: Directory.GetCurrentDirectory(),
            ContentRootPath: environment.ContentRootPath,
            LogsWritable: CheckLogsFolder(environment.ContentRootPath),
            RemoteIpAddress: context.Connection.RemoteIpAddress?.ToString(),
            XForwardedFor: RawHeader(request, "X-Forwarded-For"),
            XForwardedProto: RawHeader(request, "X-Forwarded-Proto"),
            XRealIp: RawHeader(request, "X-Real-IP"),
            CfConnectingIp: RawHeader(request, "CF-Connecting-IP"),
            IsHttps: request.IsHttps,
            ManilaZone: CheckManilaZone(),
            EnPhCulture: CheckPhilippineCulture(),
            EphemeralPfxRoundTrip: CheckEphemeralPfx(time),
            TotalAvailableMemoryBytes: GC.GetGCMemoryInfo().TotalAvailableMemoryBytes,
            CheckedAtUtc: time.GetUtcNow());
    }

    private static string CurrentProcessName()
    {
        using var process = Process.GetCurrentProcess();
        return process.ProcessName;
    }

    // Raw values only: the probe reports what arrives, it never trusts or applies forwarded headers.
    private static string? RawHeader(HttpRequest request, string name) =>
        request.Headers.TryGetValue(name, out var values) ? values.ToString() : null;

    private static LogsFolderResult CheckLogsFolder(string contentRoot)
    {
        var folder = Path.Combine(contentRoot, "logs");
        var existed = Directory.Exists(folder);
        try
        {
            Directory.CreateDirectory(folder);
            var file = Path.Combine(folder, $"hostprobe-{Guid.NewGuid():N}.tmp");
            File.WriteAllText(file, "probe");
            File.Delete(file);
            if (!existed && !Directory.EnumerateFileSystemEntries(folder).Any())
            {
                Directory.Delete(folder);
            }

            return new LogsFolderResult(Writable: true, FolderExisted: existed, Error: null);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return new LogsFolderResult(Writable: false, FolderExisted: existed, Error: error.GetType().Name);
        }
    }

    private static ZoneResult CheckManilaZone() =>
        TimeZoneInfo.TryFindSystemTimeZoneById(ManilaZoneId, out var zone)
            ? new ZoneResult(Found: true, Id: zone.Id, BaseUtcOffset: zone.BaseUtcOffset.ToString())
            : new ZoneResult(Found: false, Id: null, BaseUtcOffset: null);

    private static CultureResult CheckPhilippineCulture()
    {
        try
        {
            var culture = CultureInfo.GetCultureInfo(PhilippineCulture, predefinedOnly: true);
            return new CultureResult(Available: true, Currency12450: SampleAmount.ToString("C", culture), Error: null);
        }
        catch (CultureNotFoundException error)
        {
            return new CultureResult(Available: false, Currency12450: null, Error: error.GetType().Name);
        }
    }

    // SEC-04 prerequisite (research Pattern 9b): an in-memory PFX loads with EphemeralKeySet and its RSA key works,
    // so Data Protection can use a certificate on IIS without a loaded user profile or the certificate store.
    private static CheckResult CheckEphemeralPfx(TimeProvider time)
    {
        try
        {
            using var rsa = RSA.Create(2048);
            var request = new CertificateRequest(
                "CN=Csps.HostProbe", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            var now = time.GetUtcNow();
            using var certificate = request.CreateSelfSigned(now.AddMinutes(-5), now.AddDays(1));

            var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
            var pfx = certificate.Export(X509ContentType.Pkcs12, password);
            using var loaded = X509CertificateLoader.LoadPkcs12(pfx, password, X509KeyStorageFlags.EphemeralKeySet);
            using var publicKey = loaded.GetRSAPublicKey();
            using var privateKey = loaded.GetRSAPrivateKey();
            if (publicKey is null || privateKey is null)
            {
                return new CheckResult(Ok: false, Error: "MissingRsaKey");
            }

            var plain = "CSPS-probe"u8.ToArray();
            var cipher = publicKey.Encrypt(plain, RSAEncryptionPadding.OaepSHA256);
            var roundTrip = privateKey.Decrypt(cipher, RSAEncryptionPadding.OaepSHA256);
            return new CheckResult(Ok: plain.AsSpan().SequenceEqual(roundTrip), Error: null);
        }
        catch (Exception error) when (error is CryptographicException or PlatformNotSupportedException)
        {
            return new CheckResult(Ok: false, Error: error.GetType().Name);
        }
    }
}

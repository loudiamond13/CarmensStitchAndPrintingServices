using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Security.Cryptography.X509Certificates;
using System.Xml.Linq;
using Csps.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.XmlEncryption;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.DataProtection;

/// <summary>
/// Data Protection for every environment (SEC-04, D-15): the key ring lives in the <c>DataProtectionKeys</c> table, so
/// cookies and tokens survive an app-pool recycle, and each key is encrypted with the configured certificate, so a
/// copy of the database alone does not reveal it (CWE-312). Development and Production use this same code path.
/// </summary>
public static class DataProtectionRegistration
{
    /// <summary>The advice appended to every certificate failure message.</summary>
    public const string FixAdvice =
        "In Development run tools/scripts/Initialize-DevSecrets.ps1; in Production set it in the host settings.";

    /// <summary>
    /// Adds Data Protection with the database key repository and certificate encryption, reading the certificates
    /// from the <c>DataProtection</c> section of <paramref name="configuration"/>. The settings are validated when
    /// the host starts, so a missing or unusable certificate stops the API with a plain message instead of letting
    /// it run with keys it could not protect.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">Application configuration.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsDataProtection(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddOptions<DataProtectionSettings>()
            .BindConfiguration(DataProtectionSettings.SectionName)
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<DataProtectionSettings>, DataProtectionSettingsValidator>();

        // Every instance that must read the same key ring uses the same application name.
        var builder = services.AddDataProtection()
            .SetApplicationName("Csps")
            .PersistKeysToDbContext<CspsDbContext>();

        // The framework's decryption-certificate list is internal, so the certificates are loaded here, from the same
        // configuration the options bind to, and handed to the public builder methods.
        var settings = configuration.GetSection(DataProtectionSettings.SectionName).Get<DataProtectionSettings>() ?? new DataProtectionSettings();
        if (TryLoad(settings, out var current, out var previous))
        {
            // Encrypts new keys and decrypts the keys it encrypted, without the Windows certificate store.
            builder.ProtectKeysWithCertificate(current);

            // Retired certificates only decrypt older keys; they never encrypt a new one.
            if (previous.Length > 0)
            {
                builder.UnprotectKeysWithAnyCertificate(previous);
            }

            // The host disposes this owner when it shuts down (also after a failed start), which deletes each machine key.
            var owner = new DataProtectionCertificates([current, .. previous]);
            services.AddSingleton(_ => owner);
            services.AddHostedService(static provider => provider.GetRequiredService<DataProtectionCertificates>());
        }
        else
        {
            // The start-up validation stops a web host before it serves anything. Any other composition (a tools/
            // command, a test) gets an encryptor that refuses, so a key is never stored unencrypted.
            builder.AddKeyManagementOptions(static options => options.XmlEncryptor = new RefusingXmlEncryptor());
        }

        return services;
    }

    /// <summary>Describes the first certificate problem in <paramref name="settings"/>, or returns null when all load.</summary>
    /// <param name="settings">The settings to check.</param>
    /// <returns>A plain-English message that names the setting and never contains a secret, or null.</returns>
    internal static string? FindProblem(DataProtectionSettings settings)
    {
        ArgumentNullException.ThrowIfNull(settings);

        var problem = Check(DataProtectionSettings.SectionName + ":CertificateBase64", settings.CertificateBase64, settings.CertificatePassword);
        for (var index = 0; problem is null && index < settings.PreviousCertificates.Count; index++)
        {
            var previous = settings.PreviousCertificates[index];
            var path = string.Format(CultureInfo.InvariantCulture, "{0}:PreviousCertificates:{1}", DataProtectionSettings.SectionName, index);
            problem = Check(path, previous.CertificateBase64, previous.CertificatePassword);
        }

        return problem;
    }

    private static string? Check(string setting, string base64, string password)
    {
        try
        {
            using var certificate = CertificateLoader.Load(base64, password);
            return null;
        }
        catch (InvalidOperationException exception)
        {
            return $"{setting}: {exception.Message} {FixAdvice}";
        }
    }

    // Loads the current and every previous certificate, or none of them: a failure disposes what was already loaded
    // and leaves the reason to the start-up validation, which reports it with the setting name.
    private static bool TryLoad(
        DataProtectionSettings settings,
        [NotNullWhen(true)] out X509Certificate2? current,
        out X509Certificate2[] previous)
    {
        var loaded = new List<X509Certificate2>();
        try
        {
            loaded.Add(CertificateLoader.Load(settings.CertificateBase64, settings.CertificatePassword));
            foreach (var item in settings.PreviousCertificates)
            {
                loaded.Add(CertificateLoader.Load(item.CertificateBase64, item.CertificatePassword));
            }
        }
        catch (InvalidOperationException)
        {
            foreach (var certificate in loaded)
            {
                certificate.Dispose();
            }

            current = null;
            previous = [];
            return false;
        }

        current = loaded[0];
        previous = [.. loaded.Skip(1)];
        return true;
    }

    private sealed class DataProtectionSettingsValidator : IValidateOptions<DataProtectionSettings>
    {
        public ValidateOptionsResult Validate(string? name, DataProtectionSettings options)
        {
            var problem = FindProblem(options);
            return problem is null ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(problem);
        }
    }

    private sealed class RefusingXmlEncryptor : IXmlEncryptor
    {
        public EncryptedXmlInfo Encrypt(XElement plaintextElement) =>
            throw new InvalidOperationException(
                "Data Protection has no usable certificate, so no key can be stored. " + FixAdvice);
    }
}

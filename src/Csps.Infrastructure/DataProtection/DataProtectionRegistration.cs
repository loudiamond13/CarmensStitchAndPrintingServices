using Csps.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.DataProtection;

/// <summary>
/// Data Protection for every environment (SEC-04, D-15): the key ring lives in the <c>DataProtectionKeys</c> table, so
/// cookies and tokens survive an app-pool recycle, and each key is encrypted with the configured certificate, so a
/// copy of the database alone does not reveal it (CWE-312). Development and Production use this same code path.
/// </summary>
public static class DataProtectionRegistration
{
    /// <summary>
    /// Adds Data Protection with the database key repository and certificate encryption, reading the certificate from
    /// the <c>DataProtection</c> section of <paramref name="configuration"/>.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">Application configuration.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsDataProtection(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddOptions<DataProtectionSettings>().BindConfiguration(DataProtectionSettings.SectionName);

        // Every instance that must read the same key ring uses the same application name.
        var builder = services.AddDataProtection()
            .SetApplicationName("Csps")
            .PersistKeysToDbContext<CspsDbContext>();

        var settings = configuration.GetSection(DataProtectionSettings.SectionName).Get<DataProtectionSettings>() ?? new DataProtectionSettings();
        if (!string.IsNullOrWhiteSpace(settings.CertificateBase64))
        {
            // Encrypts new keys and decrypts the keys it encrypted, without the Windows certificate store.
            builder.ProtectKeysWithCertificate(CertificateLoader.Load(settings.CertificateBase64, settings.CertificatePassword));
        }

        return services;
    }
}

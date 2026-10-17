using System.Runtime.Versioning;
using Csps.Infrastructure.DataProtection;
using Csps.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Csps.Infrastructure.IntegrationTests.DataProtection;

/// <summary>
/// SEC-04, D-15: the certificates Data Protection keeps are owned by one hosted singleton, so the host disposes them,
/// and removes their machine key files, when it shuts down.
/// </summary>
public sealed class DataProtectionCertificatesTests
{
    [Fact]
    public void OneSingletonOwnsEveryCertificateAndIsAHostedService()
    {
        using var provider = BuildProvider();

        var owner = provider.GetRequiredService<DataProtectionCertificates>();

        owner.Certificates.Count.ShouldBe(2);
        provider.GetRequiredService<DataProtectionCertificates>().ShouldBeSameAs(owner);
        provider.GetServices<IHostedService>().ShouldContain(owner);
    }

    [Fact]
    public async Task StartingAndStoppingKeepTheCertificatesUsable()
    {
        await using var provider = BuildProvider();
        var owner = provider.GetRequiredService<DataProtectionCertificates>();

        await owner.StartAsync(TestContext.Current.CancellationToken);
        await owner.StopAsync(TestContext.Current.CancellationToken);

        owner.Certificates.ShouldAllBe(certificate => certificate.HasPrivateKey);
    }

    [Fact]
    public void DisposingTheProviderDisposesEveryCertificate()
    {
        var provider = BuildProvider();
        var owner = provider.GetRequiredService<DataProtectionCertificates>();
        var certificates = owner.Certificates.ToList();

        provider.Dispose();

        certificates.ShouldAllBe(certificate => certificate.Handle == IntPtr.Zero);
        Should.NotThrow(owner.Dispose);
    }

    [Fact]
    [SupportedOSPlatform("windows")]
    public void DisposingTheProviderRemovesTheMachineKeys()
    {
        Assert.SkipUnless(OperatingSystem.IsWindows(), "CNG key stores exist only on Windows.");

        List<StoredKey> keys;
        using (var provider = BuildProvider())
        {
            keys = [.. provider.GetRequiredService<DataProtectionCertificates>().Certificates.Select(StoredKey.Read)];
            keys.ShouldAllBe(key => key.Exists());
        }

        keys.Count.ShouldBe(2);
        keys.ShouldAllBe(key => !key.Exists());
    }

    private static ServiceProvider BuildProvider()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [TestCertificates.CertificateBase64Setting] = TestCertificates.Current.Base64,
                [TestCertificates.CertificatePasswordSetting] = TestCertificates.Current.Password,
                [TestCertificates.PreviousBase64Setting(0)] = TestCertificates.Other.Base64,
                [TestCertificates.PreviousPasswordSetting(0)] = TestCertificates.Other.Password,
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddCspsDataProtection(configuration);
        return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
    }
}

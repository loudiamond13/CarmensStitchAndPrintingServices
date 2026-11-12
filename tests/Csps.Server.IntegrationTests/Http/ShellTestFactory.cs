using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>A test host with no database whose site settings come from a stub, so the shell's head can be checked on its own.</summary>
internal sealed class ShellTestFactory(ISiteSettingsReader reader) : CspsApiFactory
{
    /// <summary>The business name the default stub returns.</summary>
    public const string DefaultBusinessName = "Test Shop's Name & Co";

    public ShellTestFactory()
        : this(new StubSiteSettingsReader(DefaultBusinessName))
    {
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        base.ConfigureWebHost(builder);
        builder.ConfigureTestServices(services => services.AddSingleton(reader));
    }
}

/// <summary>Returns a fixed settings snapshot, or throws the given exception.</summary>
internal sealed class StubSiteSettingsReader : ISiteSettingsReader
{
    private readonly SiteSettingsSnapshot? _snapshot;
    private readonly Exception? _failure;

    public StubSiteSettingsReader(string businessName)
    {
        _snapshot = new SiteSettingsSnapshot(
            businessName, "Asia/Manila", "PHP", "en-PH", "owner@example.test", "0917 000 0000", "Test Street", "https://facebook.example/test", "AAAA");
    }

    public StubSiteSettingsReader(Exception failure) => _failure = failure;

    public ValueTask<SiteSettingsSnapshot> GetAsync(CancellationToken cancellationToken) =>
        _failure is not null ? throw _failure : ValueTask.FromResult(_snapshot!);
}

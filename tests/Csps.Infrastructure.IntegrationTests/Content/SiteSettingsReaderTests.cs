using Csps.Application.Ports;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting.Internal;

namespace Csps.Infrastructure.IntegrationTests.Content;

/// <summary>
/// FND-09: SiteSettings are read through the cached Application port, composed exactly as the Server composes
/// Infrastructure. Tests that change the row use their own ad-hoc database so other classes are unaffected.
/// </summary>
public sealed class SiteSettingsReaderTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    // Apostrophe, ampersand and the peso sign (U+20B1).
    private const string UnicodeBusinessName = "Carmen's Stitch & Printing ₱ Services";

    [Fact]
    public async Task ReturnsSeededSnapshot()
    {
        await using var services = BuildServices(database.ConnectionString);

        var snapshot = await ReadAsync(services);

        snapshot.BusinessName.ShouldBe("Carmen's Stitch & Printing Services");
        snapshot.TimeZoneId.ShouldBe("Asia/Manila");
        snapshot.CurrencyCode.ShouldBe("PHP");
        snapshot.Locale.ShouldBe("en-PH");
        snapshot.ContactEmail.ShouldBe("[hello@yourdomain.ph]");
        snapshot.ContactPhone.ShouldBe("[0917 000 0000]");
        snapshot.AddressLine.ShouldBe("[Shop address], [City], Philippines");
        snapshot.FacebookUrl.ShouldBe("[Facebook page URL]");
        snapshot.RowVersion.ShouldNotBeNullOrWhiteSpace();
        Convert.FromBase64String(snapshot.RowVersion).Length.ShouldBe(8);
    }

    [Fact]
    public async Task ServesCachedValueUntilInvalidated()
    {
        var adHoc = await CspsDatabase.CreateAsync();
        await using (adHoc)
        {
            await using var services = BuildServices(adHoc.ConnectionString);
            (await ReadAsync(services)).BusinessName.ShouldBe("Carmen's Stitch & Printing Services");

            await ExecuteAsync(adHoc, "UPDATE dbo.SiteSettings SET BusinessName = N'Changed Behind The Cache' WHERE Id = 1;");

            (await ReadAsync(services)).BusinessName.ShouldBe("Carmen's Stitch & Printing Services");
        }
    }

    [Fact]
    public async Task InvalidateThenReadReturnsCommittedValue()
    {
        var adHoc = await CspsDatabase.CreateAsync();
        await using (adHoc)
        {
            await using var services = BuildServices(adHoc.ConnectionString);
            var before = await ReadAsync(services);

            await ExecuteAsync(adHoc, "UPDATE dbo.SiteSettings SET BusinessName = N'Committed Before Invalidation' WHERE Id = 1;");
            await InvalidateAsync(services);

            var after = await ReadAsync(services);
            after.BusinessName.ShouldBe("Committed Before Invalidation");
            after.RowVersion.ShouldNotBe(before.RowVersion);
        }
    }

    [Fact]
    public async Task RoundTripsUnicodeText()
    {
        var adHoc = await CspsDatabase.CreateAsync();
        await using (adHoc)
        {
            await using var services = BuildServices(adHoc.ConnectionString);

            await ExecuteAsync(adHoc, "UPDATE dbo.SiteSettings SET BusinessName = N'Carmen''s Stitch & Printing ₱ Services' WHERE Id = 1;");
            await InvalidateAsync(services);

            (await ReadAsync(services)).BusinessName.ShouldBe(UnicodeBusinessName);
            (await ReadAsync(services)).BusinessName.ShouldBe(UnicodeBusinessName);
        }
    }

    [Fact]
    public async Task MissingRowThrowsClearError()
    {
        var adHoc = await CspsDatabase.CreateAsync();
        await using (adHoc)
        {
            await using var services = BuildServices(adHoc.ConnectionString);
            await ExecuteAsync(adHoc, "DELETE FROM dbo.SiteSettings;");

            var error = await Should.ThrowAsync<InvalidOperationException>(async () => await ReadAsync(services));

            error.Message.ShouldContain("SiteSettings");
            error.Message.ShouldContain("migrations");
        }
    }

    private static ServiceProvider BuildServices(string connectionString)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:Csps"] = connectionString })
            .Build();

        var services = new ServiceCollection();
        services.AddInfrastructure(configuration, new HostingEnvironment { EnvironmentName = CspsApiFactory.EnvironmentName });
        return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
    }

    // Each read runs in its own scope, like separate HTTP requests sharing the singleton cache.
    private static async Task<Csps.Application.Content.SiteSettingsSnapshot> ReadAsync(ServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ISiteSettingsReader>().GetAsync(TestContext.Current.CancellationToken);
    }

    private static async Task InvalidateAsync(ServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ISiteSettingsCache>().InvalidateAsync(TestContext.Current.CancellationToken);
    }

    private static async Task ExecuteAsync(CspsDatabase target, string sql)
    {
        var connection = new SqlConnection(target.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }
    }
}

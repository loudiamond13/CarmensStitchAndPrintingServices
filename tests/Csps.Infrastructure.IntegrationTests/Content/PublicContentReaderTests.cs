using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Infrastructure.IntegrationTests.Auditing;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting.Internal;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Content;

/// <summary>
/// PUB-02, CONT-05, P-4: the public site snapshot is read from the database through one cache, built the way the Server composes
/// Infrastructure. The second read runs no SQL command, the JSON never holds the shop email, and an empty settings row is not an error.
/// </summary>
public sealed class PublicContentReaderTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string PrivateEmail = "shop-private@example.test";

    [Fact]
    public async Task ReadsTheStoredFactsWithTheMainNumberFirst()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo("Sample tagline") with
        {
            Phones = [new BusinessPhone("02 8123 4567", null, false), new BusinessPhone("0917 123 4567", "Globe", true)],
        });
        await using var services = BuildServices(database.ConnectionString);

        var site = (await ReadAsync(services)).Site;

        site.BusinessName.ShouldBe("Sample Shop");
        site.Tagline.ShouldBe("Sample tagline");
        site.AboutText.ShouldBe("About the sample shop.");
        site.TurnaroundLine.ShouldBe("Mockups in 24 hours.");
        site.Address.ShouldBe(new PublicAddressDto("12 Sample St., Poblacion", "Sample City", "Sample Province", "1000"));
        site.Phones.ShouldBe(
        [
            new PublicPhoneDto("0917 123 4567", "+639171234567", "Globe", true),
            new PublicPhoneDto("02 8123 4567", "+63281234567", null, false),
        ]);
        site.MessengerUrl.ShouldBe("https://m.me/cspsdemo");
        site.FacebookUrl.ShouldBe("https://facebook.example.test/cspsdemo");
        site.InstagramUrl.ShouldBe("https://instagram.example.test/cspsdemo");
        site.TiktokUrl.ShouldBe("https://tiktok.example.test/cspsdemo");
        site.DirectionsUrl.ShouldBe("https://maps.example.test/directions");
        site.MapEmbedUrl.ShouldBe("https://maps.example.test/embed");
    }

    [Fact]
    public async Task TheSecondReadRunsNoDatabaseCommand()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        var counter = new CommandCounter();
        await using var services = BuildServices(database.ConnectionString, counter);

        var first = await ReadAsync(services);
        counter.Reset();
        var second = await ReadAsync(services);

        counter.Count.ShouldBe(0);
        second.ShouldBeSameAs(first);
    }

    [Fact]
    public async Task AnEmptyRowReadsWithNoPhonesAndNullFields()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Bare());
        await using var services = BuildServices(database.ConnectionString);

        var site = (await ReadAsync(services)).Site;

        site.Phones.ShouldBeEmpty();
        site.Address.ShouldBe(new PublicAddressDto(null, null, null, null));
        new[] { site.AboutText, site.TurnaroundLine, site.MessengerUrl, site.FacebookUrl, site.InstagramUrl, site.TiktokUrl, site.DirectionsUrl, site.MapEmbedUrl }
            .ShouldAllBe(value => value == null);
        site.Tagline.ShouldBe("Sample tagline");
    }

    [Fact]
    public async Task TheShopEmailIsNotInTheSnapshotOrItsJson()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var services = BuildServices(database.ConnectionString);

        var snapshot = await ReadAsync(services);

        snapshot.Json.Json.ShouldNotContain(PrivateEmail, Case.Insensitive);
        snapshot.Json.Json.ShouldNotContain("@");
        JsonSerializer.Serialize(snapshot.Site).ShouldNotContain("mail", Case.Insensitive);
    }

    [Fact]
    public async Task TheJsonUsesCamelCaseNamesAndHoldsTheSameFactsAsTheTypedData()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var services = BuildServices(database.ConnectionString);

        var snapshot = await ReadAsync(services);

        using var document = JsonDocument.Parse(snapshot.Json.Json);
        var root = document.RootElement;
        root.GetProperty("businessName").GetString().ShouldBe("Sample Shop");
        root.GetProperty("tagline").GetString().ShouldBe("Sample tagline");
        root.GetProperty("address").GetProperty("townOrCity").GetString().ShouldBe("Sample City");
        root.GetProperty("phones")[0].GetProperty("e164").GetString().ShouldBe("+639171234567");
        root.GetProperty("phones")[0].GetProperty("isMain").GetBoolean().ShouldBeTrue();
        root.GetProperty("tiktokUrl").GetString().ShouldBe("https://tiktok.example.test/cspsdemo");
        root.GetProperty("year").GetInt32().ShouldBe(snapshot.Site.Year);
    }

    [Fact]
    public async Task TheETagIsAStrongHashOfTheExactBytesAndChangesWithTheContent()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo("First line"));
        await using var services = BuildServices(database.ConnectionString);
        var first = (await ReadAsync(services)).Json;
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo("Second line"));
        await using var other = BuildServices(database.ConnectionString);
        var second = (await ReadAsync(other)).Json;

        first.ETag.ShouldBe($"\"{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(first.Json)))}\"");
        first.ETag.ShouldStartWith("\"");
        second.ETag.ShouldNotBe(first.ETag);
    }

    [Fact]
    public async Task LastChangedIsTheNewestStampOfTheSettingsAndThePhones()
    {
        var later = new DateTimeOffset(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);
        await using (var context = database.CreateContext())
        {
            await PublicContentSeeding.SaveAsync(context, PublicContentSeeding.Demo("A line"), PublicContentSeeding.DefaultNow);
            await PublicContentSeeding.SaveAsync(context, PublicContentSeeding.Demo("A line"), later);
        }

        await using var services = BuildServices(database.ConnectionString);

        (await ReadAsync(services)).Json.LastChangedUtc.ShouldBe(later);
    }

    [Fact]
    public async Task TheYearIsTheBusinessYearNotTheUtcYear()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        var newYearInManila = new FakeTimeProvider(new DateTimeOffset(2026, 12, 31, 16, 30, 0, TimeSpan.Zero));
        await using var services = BuildServices(database.ConnectionString, time: newYearInManila);

        (await ReadAsync(services)).Site.Year.ShouldBe(2027);
    }

    [Fact]
    public async Task AMissingSettingsRowThrowsAClearError()
    {
        var adHoc = await CspsDatabase.CreateAsync();
        await using (adHoc)
        {
            await using var context = adHoc.CreateContext();
            await context.SiteSettings.ExecuteDeleteAsync(TestContext.Current.CancellationToken);
            await using var services = BuildServices(adHoc.ConnectionString);

            var error = await Should.ThrowAsync<InvalidOperationException>(async () => await ReadAsync(services));

            error.Message.ShouldContain("SiteSettings");
            error.Message.ShouldContain("migrations");
        }
    }

    private static ServiceProvider BuildServices(string connectionString, CommandCounter? counter = null, TimeProvider? time = null)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:Csps"] = connectionString })
            .Build();

        var services = new ServiceCollection();
        services.AddSingleton<IRequestContext>(new FixedRequestContext());
        if (time is not null)
        {
            services.AddSingleton(time);
        }

        services.AddInfrastructure(configuration, new HostingEnvironment { EnvironmentName = CspsApiFactory.EnvironmentName });
        if (counter is not null)
        {
            services.ConfigureDbContext<CspsDbContext>(options => options.AddInterceptors(counter));
        }

        return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
    }

    // Each read runs in its own scope, like separate HTTP requests sharing the singleton cache.
    private static async Task<PublicSiteSnapshot> ReadAsync(ServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IPublicContentReader>().GetSiteAsync(TestContext.Current.CancellationToken);
    }
}

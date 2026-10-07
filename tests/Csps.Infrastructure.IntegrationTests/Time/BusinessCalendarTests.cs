using Csps.Application.Ports;
using Csps.Domain.Time;
using Csps.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting.Internal;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Time;

/// <summary>
/// FND-08, D-02: the business calendar reads the zone from the migrated SiteSettings row and "now" from the
/// registered <see cref="TimeProvider"/>, composed exactly as the Server composes Infrastructure.
/// </summary>
public sealed class BusinessCalendarTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task UsesStoredZoneAndFakeClock()
    {
        // 16:00 UTC on Oct 6 is midnight, Oct 7, in Manila.
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 10, 6, 16, 0, 0, TimeSpan.Zero));
        await using var services = BuildServices(database.ConnectionString, clock);
        await using var scope = services.CreateAsyncScope();

        var businessClock = await scope.ServiceProvider.GetRequiredService<IBusinessCalendar>()
            .GetClockAsync(TestContext.Current.CancellationToken);

        businessClock.Source.ShouldBe(ZoneSource.Stored);
        businessClock.UtcNow.ShouldBe(clock.GetUtcNow());
        businessClock.Today.ShouldBe(new DateOnly(2026, 10, 7));
        businessClock.Zone.BaseUtcOffset.ShouldBe(TimeSpan.FromHours(8));
    }

    // The fake clock is registered first; AddInfrastructure only adds TimeProvider.System when none is registered.
    private static ServiceProvider BuildServices(string connectionString, TimeProvider timeProvider)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [DependencyInjection.ConnectionStringKey] = connectionString })
            .Build();

        var services = new ServiceCollection();
        services.AddSingleton(timeProvider);
        services.AddInfrastructure(configuration, new HostingEnvironment { EnvironmentName = CspsApiFactory.EnvironmentName });
        return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
    }
}

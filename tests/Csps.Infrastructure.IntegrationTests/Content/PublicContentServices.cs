using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Infrastructure.IntegrationTests.Auditing;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting.Internal;

namespace Csps.Infrastructure.IntegrationTests.Content;

/// <summary>Composes Infrastructure the way the Server does, for the public content tests.</summary>
internal static class PublicContentServices
{
    /// <summary>Builds the services against a database, with an optional command counter and clock.</summary>
    /// <param name="connectionString">The database connection string.</param>
    /// <param name="counter">Counts every SQL command the contexts run; none when null.</param>
    /// <param name="time">Replaces the clock; the system clock when null.</param>
    /// <param name="actor">The signed-in user the stamps use; nobody (System) when null.</param>
    /// <returns>The provider. The caller disposes it.</returns>
    public static ServiceProvider Build(string connectionString, CommandCounter? counter = null, TimeProvider? time = null, ICurrentActor? actor = null)
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

        if (actor is not null)
        {
            services.AddSingleton(actor);
        }

        services.AddInfrastructure(configuration, new HostingEnvironment { EnvironmentName = CspsApiFactory.EnvironmentName });
        if (counter is not null)
        {
            services.ConfigureDbContext<CspsDbContext>(options => options.AddInterceptors(counter));
        }

        return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
    }

    /// <summary>Reads the public site snapshot in its own scope, like a separate HTTP request sharing the singleton cache.</summary>
    /// <param name="services">The provider.</param>
    /// <returns>The snapshot.</returns>
    public static async Task<PublicSiteSnapshot> ReadAsync(ServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IPublicContentReader>().GetSiteAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>Reads the product lines snapshot in its own scope, like a separate HTTP request sharing the singleton cache.</summary>
    /// <param name="services">The provider.</param>
    /// <returns>The snapshot.</returns>
    public static async Task<PublicProductLinesSnapshot> ReadLinesAsync(ServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IPublicContentReader>().GetProductLinesAsync(TestContext.Current.CancellationToken);
    }
}

using Csps.Application.Ports;
using Csps.Infrastructure.Content;
using Csps.Infrastructure.Health;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Time;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace Csps.Infrastructure;

/// <summary>Registers the Infrastructure layer. Nothing here migrates or seeds the database (D-08).</summary>
public static class DependencyInjection
{
    /// <summary>The configuration key of the SQL Server connection string.</summary>
    public const string ConnectionStringKey = "ConnectionStrings:Csps";

    private const string ConnectionStringName = "Csps";

    /// <summary>The name of the database health check in the <c>/health</c> report.</summary>
    public const string DatabaseHealthCheckName = "database";

    /// <summary>The name of the business time-zone health check in the <c>/health</c> report.</summary>
    public const string TimeZoneHealthCheckName = "time-zone";

    private const int MaximumCachePayloadBytes = 64 * 1024;

    // Bounds the worst-case /health latency when the database is unreachable (D-23, T-01-11).
    private static readonly TimeSpan DatabaseHealthCheckTimeout = TimeSpan.FromSeconds(3);

    /// <summary>
    /// Adds persistence, the in-process HybridCache, the SiteSettings ports, the business calendar and the
    /// <c>database</c> and <c>time-zone</c> health checks, reading the connection string from configuration.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">Application configuration; must contain <c>ConnectionStrings:Csps</c>.</param>
    /// <param name="environment">The host environment.</param>
    /// <returns>The same service collection.</returns>
    /// <exception cref="InvalidOperationException"><c>ConnectionStrings:Csps</c> is missing or blank.</exception>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(environment);

        var connectionString = configuration.GetConnectionString(ConnectionStringName);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"The database connection string '{ConnectionStringKey}' is not configured. "
                + "Development reads it from appsettings.Development.json; production reads it from the host settings.");
        }

        services.AddCspsPersistence(connectionString);

        // In-process only (no IDistributedCache) and small: the host app pool has 256 MB (D-10).
        services.AddHybridCache(options => options.MaximumPayloadBytes = MaximumCachePayloadBytes);

        services.AddScoped<SiteSettingsReader>();
        services.AddScoped<ISiteSettingsReader>(provider => provider.GetRequiredService<SiteSettingsReader>());
        services.AddScoped<ISiteSettingsCache>(provider => provider.GetRequiredService<SiteSettingsReader>());

        // Time comes only from TimeProvider (RS0030 bans the clock statics); tests replace it with a fake clock.
        services.TryAddSingleton(TimeProvider.System);
        services.AddScoped<IBusinessCalendar, BusinessCalendar>();

        // Runs after the Server's "self" check, so the report order is self, database, time-zone.
        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>(DatabaseHealthCheckName, timeout: DatabaseHealthCheckTimeout)
            .AddCheck<TimeZoneHealthCheck>(TimeZoneHealthCheckName);

        return services;
    }

    /// <summary>Adds <see cref="CspsDbContext"/> configured through <see cref="CspsDbContextOptions.Configure"/>.</summary>
    /// <param name="services">The service collection.</param>
    /// <param name="connectionString">The SQL Server connection string.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsPersistence(this IServiceCollection services, string connectionString)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);

        services.AddDbContext<CspsDbContext>(options => CspsDbContextOptions.Configure(options, connectionString));
        return services;
    }
}

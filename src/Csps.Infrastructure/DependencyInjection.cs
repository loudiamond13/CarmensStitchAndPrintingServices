using Csps.Application.Ports;
using Csps.Infrastructure.Auditing;
using Csps.Infrastructure.Content;
using Csps.Infrastructure.DataProtection;
using Csps.Infrastructure.Email;
using Csps.Infrastructure.Health;
using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Passwords;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
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

    // Bounds the worst-case /health latency when the database is unreachable (D-23, T-01-11). Both checks need it:
    // the time-zone check reads SiteSettings from the database when the cache is cold, and SqlClient retries a
    // failed login after 10 seconds. The checks run in parallel, so /health takes as long as the slowest one.
    private static readonly TimeSpan HealthCheckTimeout = TimeSpan.FromSeconds(3);

    /// <summary>
    /// Adds persistence, the in-process HybridCache, the SiteSettings ports, the business calendar, the audit trail,
    /// Data Protection (key ring in the database, encrypted with the <c>DataProtection</c> certificate), the email
    /// outbox with its dispatcher, and the <c>database</c> and <c>time-zone</c> health checks, reading the connection
    /// string from configuration.
    /// The host must also register <see cref="IRequestContext"/>, which the audit trail reads.
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

        // Needs IRequestContext, which the host registers (the Server reads it from HttpContext, plan 07).
        services.AddScoped<IAuditTrail, AuditTrail>();
        services.AddScoped<IUnitOfWork, CspsUnitOfWork>();

        services.AddCspsIdentity();
        services.AddCspsIdempotency();
        services.AddCspsEmail(configuration, environment);
        services.AddCspsPasswordChecks(environment);

        // The key ring in the database, encrypted with the DataProtection certificate (SEC-04, D-15).
        services.AddCspsDataProtection(configuration);

        // The health service needs ILogger<>. The web host already provides logging (AddLogging only TryAdds), but
        // a plain ServiceCollection, such as a tools/ command or an integration test, would fail to validate.
        services.AddLogging();

        // Runs after the Server's "self" check, so the report order is self, database, time-zone.
        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>(DatabaseHealthCheckName, timeout: HealthCheckTimeout)
            .AddCheck<TimeZoneHealthCheck>(TimeZoneHealthCheckName, timeout: HealthCheckTimeout);

        return services;
    }

    /// <summary>
    /// Adds an <see cref="IDbContextFactory{TContext}"/> for <see cref="CspsDbContext"/> (short-lived contexts for caches
    /// and independent audit writes) and, with it, the scoped context that handlers and Identity use, both configured
    /// through <see cref="CspsDbContextOptions.Configure"/>.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="connectionString">The SQL Server connection string.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsPersistence(this IServiceCollection services, string connectionString)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);

        // The interceptor wakes the email dispatcher after a commit that added outbox rows.
        services.TryAddSingleton<OutboxSignal>();
        services.TryAddSingleton<OutboxSignalInterceptor>();
        services.AddDbContextFactory<CspsDbContext>((provider, options) =>
            CspsDbContextOptions.Configure(options, connectionString).AddInterceptors(provider.GetRequiredService<OutboxSignalInterceptor>()));
        return services;
    }
}

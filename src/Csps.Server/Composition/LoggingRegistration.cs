using Csps.Server.Logging;
using Serilog;

namespace Csps.Server.Composition;

/// <summary>
/// Structured logging for the API (FND-07, D-21, D-22). Serilog replaces the default logger providers. Every event
/// carries the W3C trace id of its request, which is the <c>traceId</c> the client sees in a ProblemDetails, so a
/// reported reference leads straight to the request in the logs. There is no alerting, e-mail or database sink.
/// </summary>
public static class LoggingRegistration
{
    /// <summary>
    /// Registers Serilog. Minimum levels and overrides come from the <c>Serilog</c> configuration section; sinks are
    /// built in code. Any <c>ILogEventSink</c> registered in DI is attached too, which is how tests collect events.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The application configuration.</param>
    /// <param name="environment">The hosting environment.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsLogging(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(environment);

        // preserveStaticLogger: each host keeps its own logger instead of replacing the process-wide Log.Logger, so
        // parallel test hosts never write into each other's sinks.
        services.AddSerilog(
            (serviceProvider, logger) =>
            {
                logger
                    .ReadFrom.Configuration(configuration)
                    .ReadFrom.Services(serviceProvider)
                    .Enrich.FromLogContext()
                    // Masking runs after every other enricher, so nothing added later can carry a secret (CWE-532).
                    .Enrich.With<SensitiveDataMaskingEnricher>()
                    .Destructure.With<SensitiveDataDestructuringPolicy>();

                if (environment.IsDevelopment())
                {
                    logger.WriteTo.Console(formatProvider: System.Globalization.CultureInfo.InvariantCulture);
                }
            },
            preserveStaticLogger: true);

        return services;
    }
}

using Csps.Application.Auth;
using Csps.Application.Ports;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Logging;
using Polly;

namespace Csps.Infrastructure.Passwords;

/// <summary>Registers the breached-password check (AUTH-11, D-12).</summary>
public static class PasswordCheckRegistration
{
    /// <summary>The name of the HIBP <see cref="HttpClient"/>.</summary>
    internal const string HttpClientName = "HibpPwnedPasswords";

    private static readonly TimeSpan TotalTimeout = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan AttemptTimeout = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan RetryDelay = TimeSpan.FromMilliseconds(250);

    /// <summary>
    /// Adds <see cref="PasswordRules"/> and the HIBP client: a total timeout of 3 seconds, so an outage never holds up a
    /// password change for long (D-14), with one quick retry.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="environment">The host environment.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsPasswordChecks(this IServiceCollection services, IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(environment);

        services.AddScoped<PasswordRules>();

        services.AddHttpClient(HttpClientName)
            .AddTypedClient<IPwnedPasswords>((http, provider) =>
                new HibpPwnedPasswords(http, provider.GetRequiredService<ILogger<HibpPwnedPasswords>>()))
            .AddStandardResilienceHandler(options =>
            {
                options.TotalRequestTimeout.Timeout = TotalTimeout;
                options.AttemptTimeout.Timeout = AttemptTimeout;
                options.Retry.MaxRetryAttempts = 1;
                options.Retry.BackoffType = DelayBackoffType.Constant;
                options.Retry.UseJitter = false;
                options.Retry.Delay = RetryDelay;
            });

        return services;
    }
}

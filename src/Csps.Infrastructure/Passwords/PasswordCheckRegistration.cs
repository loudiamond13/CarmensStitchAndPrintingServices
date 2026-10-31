using Csps.Application.Auth;
using Csps.Application.Ports;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
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

    private const string TestingEnvironment = "Testing";

    /// <summary>The largest answer read (1 MB); a padded range answer is about 40 KB, so more is not from HIBP (IN-09).</summary>
    private const long MaxAnswerBytes = 1024 * 1024;

    private static readonly TimeSpan TotalTimeout = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan AttemptTimeout = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan RetryDelay = TimeSpan.FromMilliseconds(250);

    /// <summary>
    /// Adds <see cref="PasswordRules"/>, the embedded common-password list and the breach checker. Outside Testing the
    /// checker is the HIBP client: a total timeout of 3 seconds, so an outage never holds up a password change for
    /// long (D-14), with one quick retry, and a 1 MB cap on the answer (an oversized answer reads as unavailable). The Testing environment gets the offline stand-in (Debug builds only, QUAL-05).
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="environment">The host environment.</param>
    /// <returns>The same service collection.</returns>
    /// <exception cref="InvalidOperationException">The environment is Testing in a Release build, which has no stand-in.</exception>
    public static IServiceCollection AddCspsPasswordChecks(this IServiceCollection services, IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(environment);

        services.AddScoped<PasswordRules>();
        services.TryAddSingleton<ICommonPasswords, CommonPasswordList>();

        if (environment.IsEnvironment(TestingEnvironment))
        {
            AddTestingStandIn(services);
        }
        else
        {
            AddHibp(services);
        }

        return services;
    }

    private static void AddHibp(IServiceCollection services)
    {
        services.AddHttpClient(HttpClientName, http => http.MaxResponseContentBufferSize = MaxAnswerBytes)
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
    }

    private static void AddTestingStandIn(IServiceCollection services)
    {
#if CSPS_TESTING
        services.TryAddSingleton<IPwnedPasswords, TestingPwnedPasswords>();
#else
        throw new InvalidOperationException(
            "The Testing environment needs a Debug build: the breach-check stand-in is not in Release builds (QUAL-05).");
#endif
    }
}

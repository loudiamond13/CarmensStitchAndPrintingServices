using Csps.Application.Ports;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Email;

/// <summary>Registers the email outbox, the dispatcher and the transport (AUTH-13).</summary>
public static class EmailRegistration
{
    /// <summary>
    /// Adds the outbox port, the renderer, the link settings and the background dispatcher. The link settings are
    /// validated when the host starts, so a missing or unsafe <c>App:PublicBaseUrl</c> stops the API with a plain message.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">Application configuration.</param>
    /// <param name="environment">The host environment.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsEmail(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(environment);

        services.AddOptions<AppLinksOptions>()
            .Bind(configuration.GetSection(AppLinksOptions.SectionName))
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<AppLinksOptions>, AppLinksOptions.Validator>();

        services.AddOptions<EmailDispatcherOptions>()
            .Bind(configuration.GetSection(EmailDispatcherOptions.SectionName))
            .Validate(options => options.SweepInterval > TimeSpan.Zero, "Email:Dispatcher:SweepInterval must be greater than zero.")
            .ValidateOnStart();

        services.TryAddSingleton<OutboxSignal>();
        services.AddScoped<EmailRenderer>();
        services.AddScoped<IEmailOutbox, OutboxEmailSender>();
        services.AddHostedService<EmailDispatcher>();

        // Replaced by the real transports in the next task.
        services.TryAddSingleton<IEmailTransport, UnconfiguredEmailTransport>();

        return services;
    }

    private sealed class UnconfiguredEmailTransport : IEmailTransport
    {
        public Task SendAsync(OutgoingEmail email, CancellationToken cancellationToken) =>
            throw new InvalidOperationException("No email transport is configured.");
    }
}

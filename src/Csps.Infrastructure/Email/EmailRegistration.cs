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
    private const string TestingEnvironment = "Testing";

    /// <summary>
    /// Adds the outbox port, the renderer, the link settings, the background dispatcher and the transport. The link and
    /// mailbox settings are validated when the host starts, so a missing or unsafe value stops the API with a plain
    /// message. The Testing environment gets the in-memory sink (Debug builds only, D-27, QUAL-05); every other
    /// environment sends through SMTP over required TLS (D-26).
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">Application configuration.</param>
    /// <param name="environment">The host environment.</param>
    /// <returns>The same service collection.</returns>
    /// <exception cref="InvalidOperationException">The environment is Testing in a Release build, which has no sink.</exception>
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

        var sender = services.AddOptions<EmailSenderOptions>().Bind(configuration.GetSection(EmailSenderOptions.SectionName));

        if (environment.IsEnvironment(TestingEnvironment))
        {
            AddTestingSink(services);
        }
        else
        {
            // Missing mailbox settings stop the host at start instead of failing at the first sign-in (D-26).
            sender.ValidateOnStart();
            services.AddSingleton<IValidateOptions<EmailSenderOptions>, EmailSenderOptions.Validator>();
            services.AddOptions<SmtpOptions>()
                .Bind(configuration.GetSection(SmtpOptions.SectionName))
                .ValidateOnStart();
            services.AddSingleton<IValidateOptions<SmtpOptions>, SmtpOptions.Validator>();
            services.TryAddSingleton<IEmailTransport, MailKitTransport>();
        }

        return services;
    }

    private static void AddTestingSink(IServiceCollection services)
    {
#if CSPS_TESTING
        services.TryAddSingleton<InMemoryEmailSink>();
        services.TryAddSingleton<IEmailTransport>(provider => provider.GetRequiredService<InMemoryEmailSink>());
#else
        throw new InvalidOperationException(
            "The Testing environment needs a Debug build: the email sink is not in Release builds (QUAL-05).");
#endif
    }
}

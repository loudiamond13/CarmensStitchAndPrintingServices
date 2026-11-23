using Csps.Application.Ports;
using Csps.Application.QuoteRequests;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.QuoteRequests;

/// <summary>Registers the quote request services.</summary>
public static class QuoteRequestsRegistration
{
    /// <summary>Adds the quote request store and the quote limits, validated when the host starts.</summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">Application configuration.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsQuoteRequests(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddOptions<QuoteRequestSettings>()
            .Bind(configuration.GetSection(QuoteRequestSettings.SectionName))
            .Validate(settings => settings.Validate() is null, "The QuoteRequests settings are not valid.")
            .ValidateOnStart();
        services.AddSingleton(provider => provider.GetRequiredService<IOptions<QuoteRequestSettings>>().Value);
        services.AddScoped<IQuoteRequestStore, QuoteRequestStore>();
        return services;
    }
}

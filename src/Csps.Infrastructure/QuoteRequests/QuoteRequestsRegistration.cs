using Csps.Application.Ports;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.QuoteRequests;

/// <summary>Registers the quote request services.</summary>
public static class QuoteRequestsRegistration
{
    /// <summary>Adds the quote request store.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsQuoteRequests(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<IQuoteRequestStore, QuoteRequestStore>();
        return services;
    }
}

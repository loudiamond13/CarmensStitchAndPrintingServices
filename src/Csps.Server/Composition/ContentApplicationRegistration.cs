using Csps.Application.Content;
using FluentValidation;

namespace Csps.Server.Composition;

/// <summary>Registers the public site content use cases: one handler class per use case, no mediator.</summary>
public static class ContentApplicationRegistration
{
    /// <summary>Adds the public content handlers as scoped services and their form rules as singletons.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsContentHandlers(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<GetPublicSiteHandler>();
        services.AddScoped<UpdateSiteSettingsHandler>();
        services.AddSingleton<IValidator<UpdateSiteSettingsRequest>, UpdateSiteSettingsRequestValidator>();
        services.AddScoped<GetOpenStatusHandler>();
        services.AddScoped<GetOpeningHoursHandler>();
        services.AddScoped<UpdateOpeningHoursHandler>();
        services.AddSingleton<IValidator<UpdateOpeningHoursRequest>, UpdateOpeningHoursRequestValidator>();
        return services;
    }
}

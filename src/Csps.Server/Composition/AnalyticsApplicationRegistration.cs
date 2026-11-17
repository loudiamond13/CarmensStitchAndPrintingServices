using Csps.Application.Analytics;
using Csps.Application.Ports;
using Csps.Server.Endpoints;
using FluentValidation;

namespace Csps.Server.Composition;

/// <summary>Registers the analytics and consent use cases: one handler class per use case, no mediator.</summary>
public static class AnalyticsApplicationRegistration
{
    /// <summary>Adds the analytics handlers and their validators as scoped services.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsAnalyticsHandlers(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<RecordConsentHandler>();
        services.AddScoped<IValidator<RecordConsentRequest>, RecordConsentRequestValidator>();
        services.AddScoped<ClearVisitorDataHandler>();
        services.AddScoped<CollectPageViewHandler>();
        services.AddScoped<IValidator<PageViewRequest>, PageViewRequestValidator>();
        services.AddScoped<CollectVitalsHandler>();
        services.AddScoped<IValidator<VitalsRequest>, VitalsRequestValidator>();
        services.AddScoped<GetVisitorStatsHandler>();
        services.AddScoped<IValidator<VisitorStatsRequest>, VisitorStatsRequestValidator>();
        services.AddSingleton<IPublicPageResolver, PublicPageResolver>();
        return services;
    }
}

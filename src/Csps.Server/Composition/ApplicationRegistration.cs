using Csps.Application.Auth;
using Csps.Application.Content;

namespace Csps.Server.Composition;

/// <summary>Registers the Application use cases: one handler class per use case, no mediator (PRD section 3.3).</summary>
public static class ApplicationRegistration
{
    /// <summary>Adds every use-case handler as a scoped service.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsApplication(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<GetSiteSettingsHandler>();
        services.AddScoped<SignInHandler>();
        return services;
    }
}

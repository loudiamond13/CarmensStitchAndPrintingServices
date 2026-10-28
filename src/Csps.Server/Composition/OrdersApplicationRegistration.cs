using Csps.Application.OrderLists;

namespace Csps.Server.Composition;

/// <summary>Registers the order use cases: one handler class per use case, no mediator.</summary>
public static class OrdersApplicationRegistration
{
    /// <summary>Adds the order handlers as scoped services.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsOrderHandlers(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<ListOrderListHandler>();
        return services;
    }
}

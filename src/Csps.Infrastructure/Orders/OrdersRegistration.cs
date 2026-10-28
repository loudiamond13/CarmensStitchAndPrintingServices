using Csps.Application.Ports;
using Csps.Infrastructure.OrderLists;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.Orders;

/// <summary>Registers the order services.</summary>
public static class OrdersRegistration
{
    /// <summary>Adds the order list store, the order store, the order reader and the order number allocator.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsOrders(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<IOrderLists, OrderListStore>();
        services.AddScoped<IOrders, OrderStore>();
        services.AddScoped<IOrderReader, OrderReader>();
        services.AddScoped<IOrderNumbers, OrderNumberAllocator>();
        return services;
    }
}

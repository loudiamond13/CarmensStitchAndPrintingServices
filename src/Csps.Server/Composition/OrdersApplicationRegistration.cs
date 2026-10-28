using Csps.Application.OrderLists;
using Csps.Application.Orders;
using FluentValidation;

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

        services.AddSingleton<IValidator<CreateOrderRequest>, CreateOrderRequestValidator>();
        services.AddSingleton<IValidator<UpdateOrderDetailsRequest>, UpdateOrderDetailsRequestValidator>();
        services.AddSingleton<IValidator<AddOrderItemRequest>, AddOrderItemRequestValidator>();
        services.AddSingleton<IValidator<UpdateOrderItemRequest>, UpdateOrderItemRequestValidator>();
        services.AddSingleton<IValidator<AddOrderDiscountRequest>, AddOrderDiscountRequestValidator>();
        services.AddSingleton<IValidator<UpdateOrderDiscountRequest>, UpdateOrderDiscountRequestValidator>();
        services.AddSingleton<IValidator<AddOrderPaymentRequest>, AddOrderPaymentRequestValidator>();
        services.AddSingleton<IValidator<UpdateOrderPaymentRequest>, UpdateOrderPaymentRequestValidator>();
        services.AddScoped<ListOrderListHandler>();
        services.AddScoped<CreateOrderHandler>();
        services.AddScoped<GetOrderHandler>();
        services.AddScoped<UpdateOrderDetailsHandler>();
        services.AddScoped<AddOrderItemHandler>();
        services.AddScoped<UpdateOrderItemHandler>();
        services.AddScoped<RemoveOrderItemHandler>();
        services.AddScoped<AddOrderDiscountHandler>();
        services.AddScoped<UpdateOrderDiscountHandler>();
        services.AddScoped<RemoveOrderDiscountHandler>();
        services.AddScoped<AddOrderPaymentHandler>();
        services.AddScoped<UpdateOrderPaymentHandler>();
        services.AddScoped<RemoveOrderPaymentHandler>();
        return services;
    }
}

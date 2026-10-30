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
        services.AddSingleton<IValidator<AddOrderExpenseRequest>, AddOrderExpenseRequestValidator>();
        services.AddSingleton<IValidator<UpdateOrderExpenseRequest>, UpdateOrderExpenseRequestValidator>();
        services.AddSingleton<IValidator<AddOrderRefundRequest>, AddOrderRefundRequestValidator>();
        services.AddSingleton<IValidator<UpdateOrderRefundRequest>, UpdateOrderRefundRequestValidator>();
        services.AddSingleton<IValidator<ChangeOrderStatusRequest>, ChangeOrderStatusRequestValidator>();
        services.AddScoped<ListOrderListHandler>();
        services.AddSingleton<IValidator<OrderListEntryRequest>, OrderListEntryRequestValidator>();
        services.AddScoped<CreateOrderListEntryHandler>();
        services.AddScoped<GetOrderListEntryHandler>();
        services.AddScoped<UpdateOrderListEntryHandler>();
        services.AddScoped<RetireOrderListEntryHandler>();
        services.AddScoped<ReactivateOrderListEntryHandler>();
        services.AddScoped<DeleteOrderListEntryHandler>();
        services.AddSingleton<IValidator<ListOrdersRequest>, ListOrdersRequestValidator>();
        services.AddScoped<ListOrdersHandler>();
        services.AddScoped<CreateOrderHandler>();
        services.AddScoped<GetOrderHandler>();
        services.AddScoped<GetDeletedOrderHandler>();
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
        services.AddScoped<AddOrderExpenseHandler>();
        services.AddScoped<UpdateOrderExpenseHandler>();
        services.AddScoped<RemoveOrderExpenseHandler>();
        services.AddScoped<AddOrderRefundHandler>();
        services.AddScoped<UpdateOrderRefundHandler>();
        services.AddScoped<RemoveOrderRefundHandler>();
        services.AddScoped<ChangeOrderStatusHandler>();
        services.AddSingleton<IValidator<ListDeletedOrdersRequest>, ListDeletedOrdersRequestValidator>();
        services.AddScoped<DeleteOrderHandler>();
        services.AddScoped<RestoreOrderHandler>();
        services.AddScoped<PermanentlyDeleteOrderHandler>();
        services.AddScoped<ListDeletedOrdersHandler>();
        services.AddScoped<ImportOrderHandler>();
        return services;
    }
}

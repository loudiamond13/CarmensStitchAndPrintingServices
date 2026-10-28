using Csps.Domain.OrderLists;

namespace Csps.Application.OrderLists;

/// <summary>What the shared list code needs to know about one list (D-19).</summary>
/// <param name="Kind">Which list.</param>
/// <param name="RouteSegment">The segment after <c>/api/v1/</c>, also the error code prefix.</param>
/// <param name="AuditTargetType">The audit target type of the list's events.</param>
/// <param name="Noun">The singular noun plain-English messages use.</param>
public sealed record OrderListDescriptor(OrderListKind Kind, string RouteSegment, string AuditTargetType, string Noun)
{
    /// <summary>The product types.</summary>
    public static OrderListDescriptor ProductTypes { get; } = new(OrderListKind.ProductType, "product-types", "ProductType", "product type");

    /// <summary>The payment methods.</summary>
    public static OrderListDescriptor PaymentMethods { get; } = new(OrderListKind.PaymentMethod, "payment-methods", "PaymentMethod", "payment method");

    /// <summary>The order expense categories.</summary>
    public static OrderListDescriptor OrderExpenseCategories { get; } = new(OrderListKind.OrderExpenseCategory, "order-expense-categories", "OrderExpenseCategory", "category");

    /// <summary>Gets the descriptor of a list.</summary>
    /// <param name="kind">Which list.</param>
    /// <returns>The descriptor.</returns>
    public static OrderListDescriptor For(OrderListKind kind) => kind switch
    {
        OrderListKind.ProductType => ProductTypes,
        OrderListKind.PaymentMethod => PaymentMethods,
        OrderListKind.OrderExpenseCategory => OrderExpenseCategories,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown order list."),
    };
}

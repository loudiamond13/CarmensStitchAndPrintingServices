namespace Csps.Application.Orders;

/// <summary>The refund fields the refund routes share, so one validator checks them all (ORD-05, ORD-18).</summary>
public interface IOrderRefundFields
{
    /// <summary>Gets the day the money was handed back, <c>yyyy-MM-dd</c>.</summary>
    string? RefundDate { get; }

    /// <summary>Gets the amount in pesos.</summary>
    decimal? Amount { get; }

    /// <summary>Gets the short reason.</summary>
    string? Reason { get; }

    /// <summary>Gets the staff member who handed the money back.</summary>
    Guid? RefundedByUserId { get; }
}

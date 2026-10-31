namespace Csps.Application.Orders;

/// <summary>The payment fields the New Order form and the payment routes share, so one validator checks them all (ORD-05, ORD-22).</summary>
public interface IOrderPaymentFields
{
    /// <summary>Gets the day the money was received, <c>yyyy-MM-dd</c>.</summary>
    string? PaymentDate { get; }

    /// <summary>Gets the amount in pesos.</summary>
    decimal? Amount { get; }

    /// <summary>Gets the payment method.</summary>
    Guid? PaymentMethodId { get; }

    /// <summary>Gets the reference, such as a transfer number.</summary>
    string? Reference { get; }

    /// <summary>Gets the notes.</summary>
    string? Notes { get; }

    /// <summary>Gets the staff member who received the money.</summary>
    Guid? ReceivedByUserId { get; }
}

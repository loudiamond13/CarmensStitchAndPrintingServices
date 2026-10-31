using Csps.Domain.Common;

namespace Csps.Domain.Orders;

/// <summary>
/// One refund on an order (ORD-18, D-07): money handed back to the customer on a day, for a short reason, by one staff member.
/// The refunder is who gave the money back, not who typed the refund in; who recorded it and when are set only by the database
/// layer (SEC-08).
/// </summary>
public sealed class OrderRefund : IAttributedRecord
{
    // Used by EF Core (constructor binding) and by Order.
    internal OrderRefund(
        Guid id,
        Guid orderId,
        DateOnly refundDate,
        decimal amount,
        string reason,
        Guid refundedByUserId,
        int position)
    {
        Id = id;
        OrderId = orderId;
        RefundDate = refundDate;
        Amount = amount;
        Reason = reason;
        RefundedByUserId = refundedByUserId;
        Position = position;
    }

    /// <summary>Gets the primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the order the refund belongs to.</summary>
    public Guid OrderId { get; private set; }

    /// <summary>Gets the order the refund belongs to.</summary>
    public Order Order { get; internal set; } = null!;

    /// <summary>Gets the day the money was handed back.</summary>
    public DateOnly RefundDate { get; private set; }

    /// <summary>Gets the amount in pesos, above zero.</summary>
    public decimal Amount { get; private set; }

    /// <summary>Gets the short reason, 1 to 200 characters.</summary>
    public string Reason { get; private set; }

    /// <summary>Gets the staff member who handed the money back.</summary>
    public Guid RefundedByUserId { get; private set; }

    /// <summary>Gets the place of the refund in the order, from 0; a removal leaves a gap, and a new refund goes after the highest.</summary>
    public int Position { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    // Takes the new values, already checked and trimmed by Order.UpdateRefund.
    internal void Apply(NewOrderRefund values)
    {
        RefundDate = values.RefundDate;
        Amount = values.Amount;
        Reason = values.Reason;
        RefundedByUserId = values.RefundedByUserId;
    }
}

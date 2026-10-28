using Csps.Domain.Common;

namespace Csps.Domain.Orders;

/// <summary>
/// One payment on an order (ORD-05, ORD-22): money received on a day, by one method, held by one staff member. The receiver is
/// who has the money, not who typed the payment in; who recorded it and when are set only by the database layer (SEC-08).
/// </summary>
public sealed class OrderPayment : IAttributedRecord
{
    // Used by EF Core (constructor binding) and by Order.
    internal OrderPayment(
        Guid id,
        Guid orderId,
        DateOnly paymentDate,
        decimal amount,
        Guid paymentMethodId,
        string? reference,
        string? notes,
        Guid receivedByUserId,
        int position)
    {
        Id = id;
        OrderId = orderId;
        PaymentDate = paymentDate;
        Amount = amount;
        PaymentMethodId = paymentMethodId;
        Reference = reference;
        Notes = notes;
        ReceivedByUserId = receivedByUserId;
        Position = position;
    }

    /// <summary>Gets the primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the order the payment belongs to.</summary>
    public Guid OrderId { get; private set; }

    /// <summary>Gets the order the payment belongs to.</summary>
    public Order Order { get; internal set; } = null!;

    /// <summary>Gets the day the money was received.</summary>
    public DateOnly PaymentDate { get; private set; }

    /// <summary>Gets the amount in pesos, above zero.</summary>
    public decimal Amount { get; private set; }

    /// <summary>Gets the payment method.</summary>
    public Guid PaymentMethodId { get; private set; }

    /// <summary>Gets the reference, such as a transfer number; null when none.</summary>
    public string? Reference { get; private set; }

    /// <summary>Gets the notes; null when none.</summary>
    public string? Notes { get; private set; }

    /// <summary>Gets the staff member who received the money.</summary>
    public Guid ReceivedByUserId { get; private set; }

    /// <summary>Gets the place of the payment in the order, from 0; a removal leaves a gap, and a new payment goes after the highest.</summary>
    public int Position { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    // Takes the new values, already checked and trimmed by Order.UpdatePayment.
    internal void Apply(NewOrderPayment values)
    {
        PaymentDate = values.PaymentDate;
        Amount = values.Amount;
        PaymentMethodId = values.PaymentMethodId;
        Reference = values.Reference;
        Notes = values.Notes;
        ReceivedByUserId = values.ReceivedByUserId;
    }
}

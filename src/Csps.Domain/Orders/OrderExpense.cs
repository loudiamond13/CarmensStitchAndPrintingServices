using Csps.Domain.Common;

namespace Csps.Domain.Orders;

/// <summary>
/// One expense of an order (ORD-05, ORD-23): money the shop spent on the order on a day, in one category, paid by one staff
/// member. The payer is who spent the money, not who typed the expense in; who recorded it and when are set only by the database
/// layer (SEC-08).
/// </summary>
public sealed class OrderExpense : IAttributedRecord
{
    // Used by EF Core (constructor binding) and by Order.
    internal OrderExpense(
        Guid id,
        Guid orderId,
        DateOnly expenseDate,
        Guid orderExpenseCategoryId,
        string? description,
        decimal amount,
        Guid paidByUserId,
        int position)
    {
        Id = id;
        OrderId = orderId;
        ExpenseDate = expenseDate;
        OrderExpenseCategoryId = orderExpenseCategoryId;
        Description = description;
        Amount = amount;
        PaidByUserId = paidByUserId;
        Position = position;
    }

    /// <summary>Gets the primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the order the expense belongs to.</summary>
    public Guid OrderId { get; private set; }

    /// <summary>Gets the order the expense belongs to.</summary>
    public Order Order { get; internal set; } = null!;

    /// <summary>Gets the day of the expense.</summary>
    public DateOnly ExpenseDate { get; private set; }

    /// <summary>Gets the order expense category.</summary>
    public Guid OrderExpenseCategoryId { get; private set; }

    /// <summary>Gets the description; null when none.</summary>
    public string? Description { get; private set; }

    /// <summary>Gets the amount in pesos, above zero.</summary>
    public decimal Amount { get; private set; }

    /// <summary>Gets the staff member who paid.</summary>
    public Guid PaidByUserId { get; private set; }

    /// <summary>Gets the place of the expense in the order, from 0; a removal leaves a gap, and a new expense goes after the highest.</summary>
    public int Position { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    // Takes the new values, already checked and trimmed by Order.UpdateExpense.
    internal void Apply(NewOrderExpense values)
    {
        ExpenseDate = values.ExpenseDate;
        OrderExpenseCategoryId = values.OrderExpenseCategoryId;
        Description = values.Description;
        Amount = values.Amount;
        PaidByUserId = values.PaidByUserId;
    }
}

namespace Csps.Application.Orders;

/// <summary>The order expense fields the New Order form and the expense routes share, so one validator checks them all (ORD-05, ORD-23).</summary>
public interface IOrderExpenseFields
{
    /// <summary>Gets the day of the expense, <c>yyyy-MM-dd</c>.</summary>
    string? ExpenseDate { get; }

    /// <summary>Gets the order expense category.</summary>
    Guid? OrderExpenseCategoryId { get; }

    /// <summary>Gets the description.</summary>
    string? Description { get; }

    /// <summary>Gets the amount in pesos.</summary>
    decimal? Amount { get; }

    /// <summary>Gets the staff member who paid.</summary>
    Guid? PaidByUserId { get; }
}

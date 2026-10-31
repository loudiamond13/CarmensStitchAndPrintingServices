namespace Csps.Domain.OrderLists;

/// <summary>The three Manager-editable lists orders point at (D-16, D-17, D-18, D-19).</summary>
public enum OrderListKind
{
    /// <summary>What an order item is, for example a basketball jersey.</summary>
    ProductType = 1,

    /// <summary>How a payment was made, for example GCash.</summary>
    PaymentMethod = 2,

    /// <summary>What an order expense was for, for example fabric.</summary>
    OrderExpenseCategory = 3,
}

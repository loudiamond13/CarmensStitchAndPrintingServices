using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;

namespace Csps.LegacyFitCheck.Checks;

/// <summary>
/// Made-up values that pass every strict rule. The probe puts one real field group or one real child into a neutral order, so the
/// rule that fires can only come from that part.
/// </summary>
internal static class NeutralOrder
{
    public const string Number = "ORD-2000-0001";

    public const string CustomerName = "Neutral Customer";

    public const string ContactNumber = "(000) 000-0000";

    public const string ItemDescription = "Neutral item";

    public const string Reason = "Neutral reason";

    /// <summary>Gets the date every neutral part uses: the order date, or the business today when the order date is later.</summary>
    /// <param name="orderDate">The real order date.</param>
    /// <param name="today">The business today.</param>
    /// <returns>A date no later than today.</returns>
    public static DateOnly DateFor(DateOnly orderDate, DateOnly today) => orderDate > today ? today : orderDate;

    /// <summary>Builds an order that passes <see cref="OrderImportRules.Strict"/>: one neutral item and nothing else.</summary>
    /// <param name="date">The neutral date from <see cref="DateFor"/>.</param>
    /// <returns>The neutral order.</returns>
    public static OrderImportSnapshot Create(DateOnly date) => new(Number, Details(date), OrderStatus.Pending, [Item()]);

    public static OrderDetails Details(DateOnly date) => new(CustomerName, null, ContactNumber, null, null, date, date, null);

    public static NewOrderItem Item() => new(OrderListSeed.ProductTypes[0].Id, ItemDescription, null, 1, 1.00m);

    public static NewOrderPayment Payment(DateOnly date, decimal amount) =>
        new(date, amount, OrderListSeed.PaymentMethods[0].Id, null, null, LegacyHolder.Id);

    public static NewOrderExpense Expense(DateOnly date, decimal amount) =>
        new(date, amount, OrderListSeed.OrderExpenseOthersId, null, LegacyHolder.Id);

    public static NewOrderRefund Refund(DateOnly date, decimal amount) => new(date, amount, Reason, LegacyHolder.Id);
}

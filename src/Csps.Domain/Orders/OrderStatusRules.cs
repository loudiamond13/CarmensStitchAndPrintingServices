using Csps.Domain.Common;

namespace Csps.Domain.Orders;

/// <summary>
/// The owner's status rules (D-02 to D-05, D-13, D-38). Moves among the active statuses are free, an order can be
/// completed only with a zero balance, and Completed and Cancelled are locked end states that are left only by a reopen.
/// </summary>
public static class OrderStatusRules
{
    /// <summary>The code of a Completed request while money is owed.</summary>
    public const string CompleteBalanceOwedCode = "orders.complete-balance-owed";

    /// <summary>Gets the statuses an order can move among freely (D-02).</summary>
    public static IReadOnlyList<OrderStatus> ActiveStatuses { get; } =
    [
        OrderStatus.Pending,
        OrderStatus.Mockup,
        OrderStatus.InProduction,
        OrderStatus.Ready,
        OrderStatus.Delivered,
    ];

    /// <summary>Builds the message for a Completed request while money is owed.</summary>
    /// <param name="balance">The balance still owed.</param>
    /// <returns>The plain-English message.</returns>
    public static string CompleteBalanceOwedMessage(decimal balance) =>
        $"This order still has {Pesos.Format(balance)} to pay. Record the payment first.";

    /// <summary>Checks a status change.</summary>
    /// <param name="from">The current status.</param>
    /// <param name="to">The requested status.</param>
    /// <param name="balance">The order balance right now.</param>
    /// <returns>What the change does, or the business-rule error that refuses it.</returns>
    /// <exception cref="ArgumentOutOfRangeException">When either status is not one of the seven.</exception>
    public static Result<OrderStatusMove> Check(OrderStatus from, OrderStatus to, decimal balance)
    {
        if (!Enum.IsDefined(from))
        {
            throw new ArgumentOutOfRangeException(nameof(from), from, "Not an order status.");
        }

        if (!Enum.IsDefined(to))
        {
            throw new ArgumentOutOfRangeException(nameof(to), to, "Not an order status.");
        }

        if (from == to)
        {
            return Result.Success(OrderStatusMove.NoChange);
        }

        if (to == OrderStatus.Completed && balance > 0m)
        {
            return Result.Failure<OrderStatusMove>(
                Error.BusinessRule(CompleteBalanceOwedCode, CompleteBalanceOwedMessage(balance)));
        }

        return Result.Success(OrderStatusMove.Move);
    }
}

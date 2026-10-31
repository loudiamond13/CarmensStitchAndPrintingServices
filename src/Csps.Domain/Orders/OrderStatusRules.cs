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

    /// <summary>The code of a Completed request while the customer has a credit.</summary>
    public const string CompleteCreditCode = "orders.complete-credit";

    /// <summary>The code of a direct Completed to Cancelled or Cancelled to Completed move.</summary>
    public const string ReopenFirstCode = "orders.reopen-first";

    /// <summary>The message for a direct Completed to Cancelled move (D-38).</summary>
    public const string ReopenFirstCancelMessage = "Reopen the order first, then cancel it.";

    /// <summary>The message for a direct Cancelled to Completed move (D-38).</summary>
    public const string ReopenFirstCompleteMessage = "Reopen the order first, then mark it Completed.";

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

    /// <summary>Builds the message for a Completed request while the customer has a credit.</summary>
    /// <param name="credit">The credit, as a positive amount.</param>
    /// <returns>The plain-English message.</returns>
    public static string CompleteCreditMessage(decimal credit) =>
        $"This order has a customer credit of {Pesos.Format(credit)}. Record a refund first.";

    /// <summary>Tells whether a status is one of the five active ones.</summary>
    /// <param name="status">The status.</param>
    /// <returns>True for Pending, Mockup, InProduction, Ready and Delivered.</returns>
    public static bool IsActive(OrderStatus status) =>
        status is OrderStatus.Pending or OrderStatus.Mockup or OrderStatus.InProduction or OrderStatus.Ready or OrderStatus.Delivered;

    /// <summary>Tells whether an order in this status is locked against changes (D-05).</summary>
    /// <param name="status">The status.</param>
    /// <returns>True for Completed and Cancelled only.</returns>
    public static bool IsLocked(OrderStatus status) => status is OrderStatus.Completed or OrderStatus.Cancelled;

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

        if (IsLocked(from))
        {
            if (!IsLocked(to))
            {
                return Result.Success(OrderStatusMove.Reopen);
            }

            var message = to == OrderStatus.Cancelled ? ReopenFirstCancelMessage : ReopenFirstCompleteMessage;
            return Refuse(ReopenFirstCode, message);
        }

        if (to == OrderStatus.Completed)
        {
            if (balance > 0m)
            {
                return Refuse(CompleteBalanceOwedCode, CompleteBalanceOwedMessage(balance));
            }

            if (balance < 0m)
            {
                return Refuse(CompleteCreditCode, CompleteCreditMessage(-balance));
            }
        }

        return Result.Success(OrderStatusMove.Move);
    }

    private static Result<OrderStatusMove> Refuse(string code, string message) =>
        Result.Failure<OrderStatusMove>(Error.BusinessRule(code, message));
}

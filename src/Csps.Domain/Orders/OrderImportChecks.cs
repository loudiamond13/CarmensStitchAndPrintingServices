using Csps.Domain.Common;

namespace Csps.Domain.Orders;

/// <summary>
/// The checks <see cref="Order.Import"/> runs before it builds anything (ORD-21). The structural rules always hold: a number, a known
/// status and discount kind, no negative quantity or price, money to two decimals, payment, refund and expense amounts above zero, and
/// text that fits its column (refused, never cut short). Every other rule of the create path is applied through the same
/// <see cref="OrderRules"/> checks and words unless <see cref="OrderImportRules"/> relaxes it.
/// </summary>
internal static class OrderImportChecks
{
    /// <summary>The field the order number is reported on.</summary>
    internal const string NumberField = "number";

    /// <summary>The field prefix of the status history rows.</summary>
    internal const string StatusHistoryField = "statusHistory";

    /// <summary>The field prefix of the refunds.</summary>
    internal const string RefundsField = "refunds";

    /// <summary>The message for an empty order number.</summary>
    internal const string NumberRequired = "Enter the order number.";

    /// <summary>The message for an order number over its column.</summary>
    internal const string NumberTooLong = "Keep the order number to 32 characters or fewer.";

    /// <summary>The message for an order number the number column cannot hold without changing it.</summary>
    internal const string NumberNotPlain = "Use plain letters, digits and punctuation in the order number.";

    /// <summary>The message for an order number that is not <c>ORD-{YYYY}-{NNNN}</c> when the rules do not keep legacy numbers.</summary>
    internal const string NumberFormat = "Use the form ORD-2026-0001 for the order number.";

    /// <summary>The message for a history row that moves to the status the order was already in.</summary>
    internal const string HistoryNoChange = "A status change must move to a different status.";

    /// <summary>The message for a history row that does not start in the status the row before it ended in.</summary>
    internal const string HistoryNotChained = "Start this change in the status the last change ended in.";

    /// <summary>The message for a history row dated before the row above it.</summary>
    internal const string HistoryOutOfOrder = "List the status changes oldest first.";

    /// <summary>The message for a history whose last row is not the order's current status.</summary>
    internal const string HistoryEndsElsewhere = "The last status change must end in the order's current status.";

    /// <summary>
    /// Checks and cleans a legacy order, returning the first broken rule. Text is trimmed and empty optional text becomes null, as on
    /// any other order. Rules that need the figures (the balance, the discount cap, Completed with a balance) are judged by the order
    /// once its figures are worked out.
    /// </summary>
    /// <param name="snapshot">The legacy order.</param>
    /// <param name="rules">The relaxations to apply.</param>
    /// <param name="today">The business today; needed unless the rules allow future dates.</param>
    /// <returns>The cleaned snapshot, or a validation error naming the first broken field.</returns>
    /// <exception cref="ArgumentException">No business today was given and the rules do not allow future dates.</exception>
    internal static Result<OrderImportSnapshot> Check(OrderImportSnapshot snapshot, OrderImportRules rules, DateOnly? today)
    {
        if (!rules.AllowFutureDates && today is null)
        {
            throw new ArgumentException("The business today is needed to check the dates.", nameof(today));
        }

        var day = today.GetValueOrDefault();
        var number = CheckNumber(snapshot.Number, rules);
        if (number.IsFailure)
        {
            return Result.Failure<OrderImportSnapshot>(number.Error);
        }

        var details = OrderRules.CheckDetails(snapshot.Details, rules);
        if (details.IsFailure)
        {
            return Result.Failure<OrderImportSnapshot>(details.Error);
        }

        if (!Enum.IsDefined(snapshot.Status))
        {
            return OrderRules.Reject<OrderImportSnapshot>(OrderRules.StatusField, OrderRules.StatusInvalid);
        }

        if (snapshot.Items.Count == 0 && !rules.AllowNoItems)
        {
            return OrderRules.Reject<OrderImportSnapshot>(OrderRules.ItemsField, OrderRules.ItemsRequired);
        }

        var items = CheckList(snapshot.Items, OrderRules.MaxItems, OrderRules.ItemsField, OrderRules.ItemsTooMany, rules, (index, item) => OrderRules.CheckItem(index, item, rules));
        if (items.IsFailure)
        {
            return Result.Failure<OrderImportSnapshot>(items.Error);
        }

        var discounts = CheckList(snapshot.Discounts, OrderRules.MaxDiscounts, OrderRules.DiscountsField, OrderRules.DiscountsTooMany, rules, (index, discount) => OrderRules.CheckDiscount(index, discount, rules));
        if (discounts.IsFailure)
        {
            return Result.Failure<OrderImportSnapshot>(discounts.Error);
        }

        var payments = CheckList(snapshot.Payments, OrderRules.MaxPayments, OrderRules.PaymentsField, OrderRules.PaymentsTooMany, rules, (index, payment) => OrderRules.CheckPayment(index, payment, day, rules));
        if (payments.IsFailure)
        {
            return Result.Failure<OrderImportSnapshot>(payments.Error);
        }

        var refunds = CheckList(snapshot.Refunds, OrderRules.MaxRefunds, RefundsField, OrderRules.RefundsTooMany, rules, (index, refund) => CheckRefund(index, refund, day, rules));
        if (refunds.IsFailure)
        {
            return Result.Failure<OrderImportSnapshot>(refunds.Error);
        }

        var expenses = CheckList(snapshot.Expenses, OrderRules.MaxExpenses, OrderRules.ExpensesField, OrderRules.ExpensesTooMany, rules, (index, expense) => OrderRules.CheckExpense(index, expense, day, rules));
        if (expenses.IsFailure)
        {
            return Result.Failure<OrderImportSnapshot>(expenses.Error);
        }

        var history = CheckHistory(snapshot.StatusHistory, snapshot.Status, rules);
        if (history.IsFailure)
        {
            return Result.Failure<OrderImportSnapshot>(history.Error);
        }

        return Result.Success(snapshot with
        {
            Number = number.Value,
            Details = details.Value,
            Items = items.Value,
            Discounts = discounts.Value,
            Payments = payments.Value,
            Refunds = refunds.Value,
            Expenses = expenses.Value,
        });
    }

    // The number goes into an ASCII column, so a character outside plain text would be changed on the way in.
    private static Result<string> CheckNumber(string? number, OrderImportRules rules)
    {
        if (string.IsNullOrWhiteSpace(number))
        {
            return OrderRules.Reject<string>(NumberField, NumberRequired);
        }

        if (number.Length > OrderNumber.MaxLength)
        {
            return OrderRules.Reject<string>(NumberField, NumberTooLong);
        }

        if (!number.All(char.IsAscii))
        {
            return OrderRules.Reject<string>(NumberField, NumberNotPlain);
        }

        return !rules.KeepLegacyNumber && !OrderNumber.TryParse(number, out _, out _)
            ? OrderRules.Reject<string>(NumberField, NumberFormat)
            : Result.Success(number);
    }

    // Checks the size of a list, then each member in order, and gives back the cleaned members.
    private static Result<IReadOnlyList<T>> CheckList<T>(
        IReadOnlyList<T> source,
        int max,
        string field,
        string tooMany,
        OrderImportRules rules,
        Func<int, T, Result<T>> check)
    {
        if (!rules.IgnoreChildCaps && source.Count > max)
        {
            return OrderRules.Reject<IReadOnlyList<T>>(field, tooMany);
        }

        var cleaned = new List<T>(source.Count);
        for (var index = 0; index < source.Count; index++)
        {
            var member = check(index, source[index]);
            if (member.IsFailure)
            {
                return Result.Failure<IReadOnlyList<T>>(member.Error);
            }

            cleaned.Add(member.Value);
        }

        return Result.Success<IReadOnlyList<T>>(cleaned);
    }

    // The refund check has no list path of its own, so each field is put under the refund's place in the list.
    private static Result<NewOrderRefund> CheckRefund(int index, NewOrderRefund refund, DateOnly today, OrderImportRules rules)
    {
        var checkedRefund = OrderRules.CheckRefund(refund, today, rules);
        if (checkedRefund.IsSuccess)
        {
            return checkedRefund;
        }

        var error = checkedRefund.Error;
        return Result.Failure<NewOrderRefund>(Error.Validation(
            error.Code,
            error.Message,
            error.FieldErrors!.ToDictionary(pair => $"{RefundsField}[{index}].{pair.Key}", static pair => pair.Value)));
    }

    // Every status must be one of the seven. Unless the rules allow any history, each move must be one the status rules allow
    // (judged as if nothing were owed, since the balance is not known per row), and the rows must chain, run in time order and
    // end in the order's status. Phase 7.1 decides whether the default rules relax any of this.
    private static Result<bool> CheckHistory(IReadOnlyList<ImportedStatusChange> history, OrderStatus status, OrderImportRules rules)
    {
        for (var index = 0; index < history.Count; index++)
        {
            var row = history[index];
            var path = $"{StatusHistoryField}[{index}]";
            if (!Enum.IsDefined(row.ToStatus))
            {
                return OrderRules.Reject<bool>($"{path}.toStatus", OrderRules.StatusInvalid);
            }

            if (row.FromStatus is { } previous && !Enum.IsDefined(previous))
            {
                return OrderRules.Reject<bool>($"{path}.fromStatus", OrderRules.StatusInvalid);
            }

            if (!rules.AllowAnyStatusHistory && row.FromStatus is { } earlier)
            {
                var move = OrderStatusRules.Check(earlier, row.ToStatus, 0m);
                if (move.IsFailure)
                {
                    return OrderRules.Reject<bool>(path, move.Error.Message);
                }

                if (move.Value == OrderStatusMove.NoChange)
                {
                    return OrderRules.Reject<bool>(path, HistoryNoChange);
                }
            }
        }

        return rules.AllowAnyStatusHistory ? Result.Success(true) : CheckHistoryAgrees(history, status);
    }

    // The rows chain (each starts where the one before ended, so only the first may have no earlier status), run in time order
    // and end in the order's current status.
    private static Result<bool> CheckHistoryAgrees(IReadOnlyList<ImportedStatusChange> history, OrderStatus status)
    {
        for (var index = 1; index < history.Count; index++)
        {
            var path = $"{StatusHistoryField}[{index}]";
            if (history[index].FromStatus != history[index - 1].ToStatus)
            {
                return OrderRules.Reject<bool>($"{path}.fromStatus", HistoryNotChained);
            }

            if (history[index].ChangedAtUtc < history[index - 1].ChangedAtUtc)
            {
                return OrderRules.Reject<bool>($"{path}.changedAtUtc", HistoryOutOfOrder);
            }
        }

        return history.Count > 0 && history[^1].ToStatus != status
            ? OrderRules.Reject<bool>($"{StatusHistoryField}[{history.Count - 1}].toStatus", HistoryEndsElsewhere)
            : Result.Success(true);
    }
}

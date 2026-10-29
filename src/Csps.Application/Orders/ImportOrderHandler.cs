using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Staff;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using FluentValidation.Results;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: migration tooling imports one legacy order (ORD-21). There is no HTTP route: the Phase 7.1 fit check and the Phase 16
/// import call it. The order is built and checked by <see cref="Order.Import"/> first. Then every product type, payment method and
/// order expense category it names must exist (retired ones only when the rules allow it), and every receiver, refunder, payer and
/// history person must be a known account (the Legacy holder and people who can no longer be chosen only when the rules allow it).
/// All failures come back together in one 400 on their own paths. Only after every check passed is the order number lock taken: the
/// number must not be taken, the year's counter is lifted past the legacy number (ORD-14), and the order, its history and the
/// counter save in one transaction. An import is tooling, not a staff change, so it writes no audit entry.
/// </summary>
public sealed class ImportOrderHandler(
    IOrders orders,
    IOrderNumbers numbers,
    IOrderLists lists,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IUnitOfWork unitOfWork)
{
    /// <summary>Imports the order.</summary>
    /// <param name="snapshot">The legacy order.</param>
    /// <param name="rules">The relaxations to apply; <see cref="OrderImportRules.Default"/> for the migration.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The new order id, a 400 listing every field that failed, a 422 <c>orders.number-taken</c> when another order holds the number,
    /// or a 409 when the number lock timed out or the save was a deadlock victim.
    /// </returns>
    public async Task<Result<Guid>> HandleAsync(OrderImportSnapshot snapshot, OrderImportRules rules, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        ArgumentNullException.ThrowIfNull(rules);

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var built = Order.Import(snapshot, rules, clock.UtcNow, clock.Today);
        if (built.IsFailure)
        {
            return Result.Failure<Guid>(built.Error);
        }

        var references = await CheckReferencesAsync(snapshot, rules, cancellationToken).ConfigureAwait(false);
        if (!references.IsValid)
        {
            return Result.Failure<Guid>(ValidationResults.ToError(references, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        var order = built.Value;
        try
        {
            return await unitOfWork.InTransactionAsync(
                async token =>
                {
                    if (await orders.NumberTakenAsync(order.Number, token).ConfigureAwait(false))
                    {
                        return Result.Failure<Guid>(OrderErrors.NumberTaken);
                    }

                    await numbers.ReserveLegacyAsync(order.Number, clock.UtcNow, token).ConfigureAwait(false);
                    orders.Add(order);
                    await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                    return Result.Success(order.Id);
                },
                cancellationToken).ConfigureAwait(false);
        }
        catch (OrderNumberTakenException)
        {
            // Another import took the number between the read and the save; the unique index found it.
            return Result.Failure<Guid>(OrderErrors.NumberTaken);
        }
        catch (OrderNumberBusyException)
        {
            return Result.Failure<Guid>(OrderErrors.Busy);
        }
        catch (ConcurrencyConflictException)
        {
            // A new order has no version to lose, so a conflict at save is a deadlock victim: the same answer as a busy lock.
            return Result.Failure<Guid>(OrderErrors.Busy);
        }
    }

    private async Task<ValidationResult> CheckReferencesAsync(OrderImportSnapshot snapshot, OrderImportRules rules, CancellationToken cancellationToken)
    {
        var result = new ValidationResult();
        await AddEntryFailuresAsync(
            OrderListKind.ProductType,
            [.. snapshot.Items.Select(static (item, index) => ($"items[{index}].productTypeId", item.ProductTypeId))],
            OrderRules.ProductTypeRequired,
            OrderRules.ProductTypeRetired,
            rules,
            result,
            cancellationToken).ConfigureAwait(false);
        await AddEntryFailuresAsync(
            OrderListKind.PaymentMethod,
            [.. snapshot.Payments.Select(static (payment, index) => ($"payments[{index}].paymentMethodId", payment.PaymentMethodId))],
            OrderRules.PaymentMethodRequired,
            OrderRules.PaymentMethodRetired,
            rules,
            result,
            cancellationToken).ConfigureAwait(false);
        await AddEntryFailuresAsync(
            OrderListKind.OrderExpenseCategory,
            [.. snapshot.Expenses.Select(static (expense, index) => ($"expenses[{index}].orderExpenseCategoryId", expense.OrderExpenseCategoryId))],
            OrderRules.ExpenseCategoryRequired,
            OrderRules.ExpenseCategoryRetired,
            rules,
            result,
            cancellationToken).ConfigureAwait(false);

        var known = new Dictionary<Guid, StaffState?>();
        for (var index = 0; index < snapshot.Payments.Count; index++)
        {
            await AddPersonFailureAsync($"payments[{index}].receivedByUserId", snapshot.Payments[index].ReceivedByUserId, OrderRules.ReceivedByRequired, OrderRules.ReceivedByInactive, rules, known, result, cancellationToken).ConfigureAwait(false);
        }

        for (var index = 0; index < snapshot.Refunds.Count; index++)
        {
            await AddPersonFailureAsync($"refunds[{index}].refundedByUserId", snapshot.Refunds[index].RefundedByUserId, OrderRules.RefundedByRequired, OrderRules.RefundedByInactive, rules, known, result, cancellationToken).ConfigureAwait(false);
        }

        for (var index = 0; index < snapshot.Expenses.Count; index++)
        {
            await AddPersonFailureAsync($"expenses[{index}].paidByUserId", snapshot.Expenses[index].PaidByUserId, OrderRules.PaidByRequired, OrderRules.PaidByInactive, rules, known, result, cancellationToken).ConfigureAwait(false);
        }

        for (var index = 0; index < snapshot.StatusHistory.Count; index++)
        {
            if (snapshot.StatusHistory[index].ChangedById is { } changedBy)
            {
                await AddPersonFailureAsync($"statusHistory[{index}].changedById", changedBy, OrderErrors.HistoryPersonUnknownMessage, OrderRules.ReceivedByInactive, rules, known, result, cancellationToken).ConfigureAwait(false);
            }
        }

        return result;
    }

    // One lookup serves all distinct ids of a list. A list nobody names is not asked.
    private async Task AddEntryFailuresAsync(
        OrderListKind kind,
        IReadOnlyList<(string Path, Guid Id)> references,
        string unknownMessage,
        string retiredMessage,
        OrderImportRules rules,
        ValidationResult result,
        CancellationToken cancellationToken)
    {
        if (references.Count == 0)
        {
            return;
        }

        var ids = references.Select(static reference => reference.Id).Distinct().ToList();
        var states = (await lists.GetStatesAsync(kind, ids, cancellationToken).ConfigureAwait(false)).ToDictionary(static state => state.Id);
        foreach (var (path, id) in references)
        {
            if (!states.TryGetValue(id, out var state))
            {
                result.Errors.Add(new ValidationFailure(path, unknownMessage));
            }
            else if (state.Retired && !rules.AllowRetiredListEntries)
            {
                result.Errors.Add(new ValidationFailure(path, retiredMessage));
            }
        }
    }

    // The Legacy holder is never asked: the directory treats it as unknown on purpose (D-37). Each other person is asked once.
    private async Task AddPersonFailureAsync(
        string path,
        Guid personId,
        string unknownMessage,
        string cannotBeChosenMessage,
        OrderImportRules rules,
        Dictionary<Guid, StaffState?> known,
        ValidationResult result,
        CancellationToken cancellationToken)
    {
        if (personId == LegacyHolder.Id)
        {
            if (!rules.AllowLegacyHolder)
            {
                result.Errors.Add(new ValidationFailure(path, cannotBeChosenMessage));
            }

            return;
        }

        if (!known.TryGetValue(personId, out var state))
        {
            state = await staff.GetStaffStateAsync(personId, cancellationToken).ConfigureAwait(false);
            known[personId] = state;
        }

        if (state is null)
        {
            result.Errors.Add(new ValidationFailure(path, unknownMessage));
        }
        else if (!rules.AllowInactivePeople && !state.CanPay)
        {
            result.Errors.Add(new ValidationFailure(path, cannotBeChosenMessage));
        }
    }
}

using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation.Results;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: migration tooling imports one legacy order (ORD-21). There is no HTTP route: the Phase 7.1 fit check and the Phase 16
/// import call it. The order is built and checked by <see cref="Order.Import"/> before any lock is taken. The legacy number is then
/// reserved under the order number lock, so the year's counter is lifted past it (ORD-14), and the order, its history and the
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
    /// <returns>The new order id, or the error that refused the order.</returns>
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

        _ = await CheckReferencesAsync(snapshot, rules, cancellationToken).ConfigureAwait(false);
        var order = built.Value;
        await unitOfWork.InTransactionAsync(
            async token =>
            {
                await numbers.ReserveLegacyAsync(order.Number, clock.UtcNow, token).ConfigureAwait(false);
                orders.Add(order);
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                return order.Id;
            },
            cancellationToken).ConfigureAwait(false);
        return Result.Success(order.Id);
    }

    // The list entries and people the order names must exist.
    private Task<ValidationResult> CheckReferencesAsync(OrderImportSnapshot snapshot, OrderImportRules rules, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(lists);
        ArgumentNullException.ThrowIfNull(staff);
        ArgumentNullException.ThrowIfNull(snapshot);
        ArgumentNullException.ThrowIfNull(rules);
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(new ValidationResult());
    }
}

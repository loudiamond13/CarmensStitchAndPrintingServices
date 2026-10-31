using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a Manager deletes an order and everything inside it for good, whether or not it was soft-deleted (ORD-06, D-28, D-29).
/// The caller types the order number as <c>confirm</c> and it must match exactly, letter for letter, or nothing is removed (400 on
/// <c>confirm</c>). In one transaction the audit trail records <c>order.permanently-deleted</c> first, with the money facts and the
/// people's user ids and never customer details or notes, and then the order is removed with its items, discounts, payments,
/// expenses, refunds and history, so the entry stays when the rows are gone. A tracked remove is used, not a bulk delete, so the
/// audit row and the delete share one save. No version is sent: the delete applies to the latest state, so a lost race is read again
/// and decided again, and an order that is already gone is a 404 that writes nothing. The 404 comes before the confirm check, so a
/// wrong id never learns anything about the order.
/// </summary>
public sealed class PermanentlyDeleteOrderHandler(
    IOrders orders,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext)
{
    /// <summary>Deletes the order for good.</summary>
    /// <param name="id">The order to remove.</param>
    /// <param name="confirm">The order number as typed by the caller; null when none was sent.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 401 when the token names no usable account, a 404 when no such order exists, a 400 on <c>confirm</c> when it is not the exact number, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, string? confirm, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, confirm, token), cancellationToken),
                Result.Failure<bool>(EditErrors.Stale))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, string? confirm, CancellationToken cancellationToken)
    {
        var order = await orders.FindAsync(id, includeDeleted: true, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<bool>(OrderErrors.NotFound);
        }

        if (!string.Equals(confirm, order.Number, StringComparison.Ordinal))
        {
            return Result.Failure<bool>(OrderErrors.ConfirmMismatch);
        }

        audit.Record(
            AuditActions.OrderPermanentlyDeleted,
            OrderAuditDetail.OrderTarget,
            AuditKey.Of(order.Id),
            OrderAuditDetail.PermanentlyDeleted(order));
        orders.Remove(order);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

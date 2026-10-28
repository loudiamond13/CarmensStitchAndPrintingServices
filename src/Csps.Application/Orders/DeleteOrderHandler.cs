using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member of either role soft-deletes an order (ORD-06, D-26, D-27). The order and everything inside it stay in the
/// database but leave every default read. Who deleted it and when are set from the token and the clock. No version is sent: the delete
/// applies to the latest state, so a lost race is read again and decided again, and an order that is gone or already deleted is a 404
/// that writes nothing. The order's row is locked before it is changed, so a delete and a child write never leave a deleted order
/// with a new child.
/// </summary>
public sealed class DeleteOrderHandler(
    IOrders orders,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    TimeProvider time)
{
    private const string OrderTarget = "Order";

    /// <summary>Deletes the order.</summary>
    /// <param name="id">The order to delete.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 401 when the token names no usable account, a 404 when the order does not exist or is already deleted, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, callerId, token), cancellationToken),
                Result.Failure<bool>(EditErrors.Stale))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, Guid callerId, CancellationToken cancellationToken)
    {
        var order = await orders.FindAsync(id, includeDeleted: false, cancellationToken).ConfigureAwait(false);
        if (order is null || !order.SoftDelete(callerId, time.GetUtcNow()))
        {
            return Result.Failure<bool>(OrderErrors.NotFound);
        }

        await orders.LockAsync(order, cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.OrderDeleted, OrderTarget, AuditKey.Of(order.Id), OrderAuditDetail.Deleted(order));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

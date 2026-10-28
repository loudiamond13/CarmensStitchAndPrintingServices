using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a Manager restores a soft-deleted order, so it and everything inside it count again everywhere (ORD-06, D-28). No
/// version is sent: the restore applies to the latest state, so a lost race is read again and decided again. An order that is not
/// deleted, like an unknown id, is a 404 that writes nothing, so a second restore never has a second effect.
/// </summary>
public sealed class RestoreOrderHandler(
    IOrders orders,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext)
{
    /// <summary>Restores the order.</summary>
    /// <param name="id">The order to restore.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 401 when the token names no usable account, a 404 when no deleted order has that id, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, token), cancellationToken),
                Result.Failure<bool>(EditErrors.Stale))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await orders.FindAsync(id, includeDeleted: true, cancellationToken).ConfigureAwait(false);
        if (order is null || !order.Restore())
        {
            return Result.Failure<bool>(OrderErrors.NotFound);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

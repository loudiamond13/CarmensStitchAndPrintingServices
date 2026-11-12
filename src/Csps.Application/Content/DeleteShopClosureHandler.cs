using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager deletes a closure (CONT-04). No version is sent: the delete applies to the latest state, so a lost race is read
/// again and decided again, and a closure that is gone is a 404. One transaction writes the <c>shop-closure.deleted</c> entry with the
/// days and removes the row. Removing a closure can never make two closures overlap, so no lock is needed.
/// </summary>
/// <param name="store">The site content store.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
public sealed class DeleteShopClosureHandler(ISiteContentStore store, IAuditTrail audit, IUnitOfWork unitOfWork)
{
    /// <summary>Deletes the closure.</summary>
    /// <param name="id">The closure to delete.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 404 when the closure does not exist, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, CancellationToken cancellationToken)
    {
        var closure = await store.FindClosureAsync(id, cancellationToken).ConfigureAwait(false);
        if (closure is null)
        {
            return Result.Failure<bool>(ShopClosureErrors.NotFound);
        }

        audit.Record(AuditActions.ShopClosureDeleted, ShopClosureAuditDetail.TargetType, AuditKey.Of(closure.Id), ShopClosureAuditDetail.Deleted(closure));
        store.RemoveClosure(closure);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

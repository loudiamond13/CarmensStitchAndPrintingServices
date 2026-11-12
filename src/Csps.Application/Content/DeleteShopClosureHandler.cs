using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager deletes a closure (CONT-04). No version is sent: the delete applies to the latest state, so a lost race is read
/// again and decided again, and a closure that is gone is a 404.
/// </summary>
/// <param name="store">The site content store.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
public sealed class DeleteShopClosureHandler(ISiteContentStore store, IUnitOfWork unitOfWork)
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

        store.RemoveClosure(closure);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

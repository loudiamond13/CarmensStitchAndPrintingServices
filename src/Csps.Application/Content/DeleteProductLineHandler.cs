using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager deletes a product line that nothing is filed under (CONT-02, D-08). A line with a photo, a gallery item or an
/// order product type is a 422 that points to Hide instead, and a line that is gone is a 404. One transaction writes the
/// <c>product-line.deleted</c> entry with the key and title and removes the row. The transaction takes the site-content lock first, as the
/// photo writes do, so a photo that arrives at the same moment is decided before or after the delete and never in the middle (a 422 or a
/// 404, not a database error). The foreign keys from the photos and the product types stay as the backstop. No version is sent: the delete
/// applies to the latest state, so a lost race is read again and decided again.
/// </summary>
/// <param name="lines">The product line store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
public sealed class DeleteProductLineHandler(IProductLines lines, ISiteContentLock siteLock, IAuditTrail audit, IUnitOfWork unitOfWork)
{
    /// <summary>Deletes the line.</summary>
    /// <param name="id">The line to delete.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 404 when the line does not exist, a 422 when something is filed under it, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, token), cancellationToken),
                    Result.Failure<bool>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
            return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure(AuthErrors.SessionBusy);
        }
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var line = await lines.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (line is null)
        {
            return Result.Failure<bool>(SiteContentErrors.LineNotFound);
        }

        if ((await lines.GetUsageAsync(line.Id, cancellationToken).ConfigureAwait(false)).IsUsed)
        {
            return Result.Failure<bool>(SiteContentErrors.LineInUse);
        }

        audit.Record(AuditActions.ProductLineDeleted, ProductLineAuditDetail.TargetType, AuditKey.Of(line.Id), ProductLineAuditDetail.Named(line));
        lines.Remove(line);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

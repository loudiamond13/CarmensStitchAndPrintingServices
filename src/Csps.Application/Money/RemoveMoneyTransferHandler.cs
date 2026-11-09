using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Money;

/// <summary>
/// Use case: a Manager removes a soft-deleted transfer for good (MONEY-06, D-24, D-25). Only a transfer already in the bin can go, so
/// removing changes no balance. In one transaction the audit trail records
/// <c>money-transfer.permanently-deleted</c> first with the full record as ids and values, never the note text (D-52), and then the
/// row is removed, so the entry stays when the row is gone. A tracked remove is used, not a bulk delete, so the audit row and the
/// removal share one save. The remove takes no <c>staff-money</c> lock (D-53). A transfer that is gone is a 404 that writes nothing, so
/// a repeated or racing remove leaves one entry.
/// </summary>
public sealed class RemoveMoneyTransferHandler(
    IMoneyTransfers transfers,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext)
{

    /// <summary>Removes the transfer.</summary>
    /// <param name="id">The transfer to remove.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// Success, a 401 when the token names no usable account, a 404 when no such transfer exists, a 422 when it is not deleted yet, or a
    /// 409 when two saves lost a race twice.
    /// </returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, token), cancellationToken),
                Result.Failure<bool>(MoneyErrors.Busy))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, CancellationToken cancellationToken)
    {
        var transfer = await transfers.FindAsync(id, includeDeleted: true, cancellationToken).ConfigureAwait(false);
        if (transfer is null)
        {
            return Result.Failure<bool>(MoneyErrors.TransferNotFound);
        }

        var removable = transfer.EnsureRemovable();
        if (removable.IsFailure)
        {
            return Result.Failure<bool>(removable.Error);
        }

        audit.Record(AuditActions.MoneyTransferPermanentlyDeleted, MoneyAuditTargets.Transfer, AuditKey.Of(transfer.Id), MoneyAuditDetail.Removed(transfer));
        transfers.Remove(transfer);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

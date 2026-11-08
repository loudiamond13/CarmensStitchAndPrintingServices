using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Money;

namespace Csps.Application.Money;

/// <summary>
/// Use case: a Manager soft-deletes a wrong transfer (MONEY-06, D-23, D-35). The version the Manager last saw must be the stored one,
/// so a stale screen cannot delete over a newer state (SEC-07). The transfer stays stored with who deleted it and when, and stops
/// counting toward both balances at once. One transaction marks the row and records <c>money-transfer.deleted</c> with ids, the
/// amount, the date and note=yes or note=no, never the note text (D-52). A transfer that is gone or already deleted is a 404 that
/// writes nothing, so a repeated or racing delete leaves exactly one audit entry.
/// </summary>
public sealed class DeleteMoneyTransferHandler(
    IMoneyTransfers transfers,
    IStaffMoneyLock moneyLock,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    TimeProvider time)
{
    private const string TransferTarget = "MoneyTransfer";
    private const string VersionField = "version";

    private static readonly Error InvalidVersion = Error.Validation(
        MoneyRules.InvalidCode,
        MoneyRules.InvalidMessage,
        new Dictionary<string, string[]> { [VersionField] = [RowVersions.InvalidMessage] });

    /// <summary>Deletes the transfer.</summary>
    /// <param name="id">The transfer to delete.</param>
    /// <param name="version">The version text the Manager last saw; checked before any lookup.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// Success, a 401 when the token names no usable account, a 400 under <c>version</c> when it is missing or malformed, a 404 when the
    /// transfer does not exist or is already deleted, a 409 when the version is stale, or a 409 when two saves lost a race twice.
    /// </returns>
    public async Task<Result> HandleAsync(Guid id, string? version, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(moneyLock);
        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        if (!RowVersions.TryParse(version, out var sent))
        {
            return Result.Failure(InvalidVersion);
        }

        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, sent, callerId, token), cancellationToken),
                Result.Failure<bool>(MoneyErrors.Busy))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, byte[] sent, Guid callerId, CancellationToken cancellationToken)
    {
        var transfer = await transfers.FindAsync(id, includeDeleted: false, cancellationToken).ConfigureAwait(false);
        if (transfer is null)
        {
            return Result.Failure<bool>(MoneyErrors.TransferNotFound);
        }

        if (!transfer.RowVersion.AsSpan().SequenceEqual(sent))
        {
            return Result.Failure<bool>(EditErrors.Stale);
        }

        // The store finds live rows only, so this guards just a tracked entity that is already marked deleted in memory.
        if (!transfer.SoftDelete(callerId, time.GetUtcNow()))
        {
            return Result.Failure<bool>(MoneyErrors.TransferNotFound);
        }

        audit.Record(AuditActions.MoneyTransferDeleted, TransferTarget, AuditKey.Of(transfer.Id), MoneyAuditDetail.Deleted(transfer));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

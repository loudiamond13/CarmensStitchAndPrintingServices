using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;

namespace Csps.Application.OrderLists;

/// <summary>
/// Use case: a Manager brings a retired entry of an order list back so it can be chosen again (D-19). One transaction clears the
/// retirement and records the list's <c>.reactivated</c> entry with the name (D-31). Reactivating an entry that is already active
/// is a success that writes and audits nothing. No version is sent: the change applies to the latest state, so a lost race is read
/// again and decided again.
/// </summary>
public sealed class ReactivateOrderListEntryHandler(
    IOrderLists lists,
    IAuditTrail audit,
    IUnitOfWork unitOfWork)
{
    /// <summary>Brings the entry back.</summary>
    /// <param name="kind">Which list.</param>
    /// <param name="id">The entry to bring back.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success (also when it was already active), a 404 when the entry does not exist, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(OrderListKind kind, Guid id, CancellationToken cancellationToken)
    {
        var descriptor = OrderListDescriptor.For(kind);
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(descriptor, id, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(OrderListDescriptor descriptor, Guid id, CancellationToken cancellationToken)
    {
        var entry = await lists.FindAsync(descriptor.Kind, id, cancellationToken).ConfigureAwait(false);
        if (entry is null)
        {
            return Result.Failure<bool>(OrderListErrors.NotFound(descriptor));
        }

        if (!entry.Reactivate())
        {
            return Result.Success(false);
        }

        audit.Record(descriptor.ReactivatedAction, descriptor.AuditTargetType, AuditKey.Of(entry.Id), OrderListAuditDetail.NameOnly(entry.Name));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

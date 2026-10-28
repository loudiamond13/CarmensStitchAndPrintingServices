using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;

namespace Csps.Application.OrderLists;

/// <summary>
/// Use case: a Manager retires an entry of an order list so it can no longer be chosen on a new item, payment or order expense
/// (D-19). It stays in the list and the list filters, marked retired, and saved rows keep it. One transaction marks the entry and
/// records the list's <c>.retired</c> entry with the name (D-31). Retiring a retired entry is a success that writes and audits
/// nothing; the order expense Others can never be retired. No version is sent: the retire applies to the latest state, so a lost
/// race is read again and decided again.
/// </summary>
public sealed class RetireOrderListEntryHandler(
    IOrderLists lists,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    /// <summary>Retires the entry.</summary>
    /// <param name="kind">Which list.</param>
    /// <param name="id">The entry to retire.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success (also when it was already retired), a 404 when the entry does not exist, a 422 for Others, or a 409 when two saves lost a race twice.</returns>
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

        var retired = entry.Retire(time.GetUtcNow());
        if (retired.IsFailure)
        {
            return Result.Failure<bool>(retired.Error);
        }

        if (!retired.Value)
        {
            return Result.Success(false);
        }

        audit.Record(descriptor.RetiredAction, descriptor.AuditTargetType, AuditKey.Of(entry.Id), OrderListAuditDetail.NameOnly(entry.Name));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

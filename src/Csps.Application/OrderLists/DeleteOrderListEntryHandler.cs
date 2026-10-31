using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;

namespace Csps.Application.OrderLists;

/// <summary>
/// Use case: a Manager deletes an entry of an order list that no row uses (D-19, 06 D-30). "Used" means an order item, payment or
/// order expense row exists now, soft-deleted orders included, so an entry whose every order was deleted for good can be deleted
/// again. A used entry is a 422 that points to Retire instead, and the order expense Others can never be deleted. The foreign key
/// from the rows is the backstop for a row added in the same moment: its refusal is the same 422. One transaction records the
/// list's <c>.deleted</c> entry with the name and removes the row (D-31). No version is sent: the delete applies to the latest
/// state, so a lost race is read again and decided again, and an entry that is gone is a 404.
/// </summary>
public sealed class DeleteOrderListEntryHandler(
    IOrderLists lists,
    IAuditTrail audit,
    IUnitOfWork unitOfWork)
{
    /// <summary>Deletes the entry.</summary>
    /// <param name="kind">Which list.</param>
    /// <param name="id">The entry to delete.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 404 when the entry does not exist, a 422 for Others or a used entry, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(OrderListKind kind, Guid id, CancellationToken cancellationToken)
    {
        var descriptor = OrderListDescriptor.For(kind);
        try
        {
            var outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(descriptor, id, token), cancellationToken),
                    Result.Failure<bool>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
            return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
        }
        catch (OrderListEntryInUseException)
        {
            return Result.Failure(OrderListErrors.InUse(descriptor));
        }
    }

    private async Task<Result<bool>> AttemptAsync(OrderListDescriptor descriptor, Guid id, CancellationToken cancellationToken)
    {
        var entry = await lists.FindAsync(descriptor.Kind, id, cancellationToken).ConfigureAwait(false);
        if (entry is null)
        {
            return Result.Failure<bool>(OrderListErrors.NotFound(descriptor));
        }

        if (entry.IsOthers)
        {
            return Result.Failure<bool>(entry.Protected());
        }

        if (await lists.CountUsesAsync(descriptor.Kind, entry.Id, cancellationToken).ConfigureAwait(false) > 0)
        {
            return Result.Failure<bool>(OrderListErrors.InUse(descriptor));
        }

        audit.Record(descriptor.DeletedAction, descriptor.AuditTargetType, AuditKey.Of(entry.Id), OrderListAuditDetail.NameOnly(entry.Name));
        lists.Remove(entry);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

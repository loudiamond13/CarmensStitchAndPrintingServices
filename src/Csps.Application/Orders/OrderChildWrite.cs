using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Application.Orders;

/// <summary>The audit entry a child change records for its order (D-31).</summary>
/// <param name="Action">The audit action, such as <c>order-item.added</c>.</param>
/// <param name="Detail">The detail text, without customer or item text.</param>
internal sealed record OrderChildAudit(string Action, string Detail)
{
    /// <summary>Gets a second entry recorded in the same save, such as a receiver change that stands on its own; null for none.</summary>
    public OrderChildAudit? Then { get; init; }
}

/// <summary>
/// The one flow every write to an order's children uses (ORD-08, SEC-07): inside one transaction the order is found with its
/// children (404 when missing or deleted), the version the form was opened with is compared when one is given (409), the domain
/// change runs, and when it changed something the order's row is locked, its audit entry is recorded and the save is made.
/// Children are only ever reached through their order, so an id from another order is never found (CWE-639). Any change a child
/// makes moves the order's edit version, so the order's row version decides who wins a race, and the loser rolls its audit entry
/// back with its change.
/// </summary>
internal static class OrderChildWrite
{
    /// <summary>
    /// Runs one attempt. A lost race at save time throws <see cref="ConcurrencyConflictException"/> for the caller to turn into a 409
    /// or to retry.
    /// </summary>
    /// <param name="orders">The order store.</param>
    /// <param name="audit">The audit trail.</param>
    /// <param name="unitOfWork">The unit of work.</param>
    /// <param name="orderId">The order the child belongs to.</param>
    /// <param name="version">The version the form was opened with; null for a single-click action that acts on the latest state.</param>
    /// <param name="change">Applies the domain change; the audit entry to record, or null when nothing changed and nothing is saved.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>True when a change was saved, false when nothing changed, or the failure.</returns>
    public static Task<Result<bool>> AttemptAsync(
        IOrders orders,
        IAuditTrail audit,
        IUnitOfWork unitOfWork,
        Guid orderId,
        byte[]? version,
        Func<Order, CancellationToken, Task<Result<OrderChildAudit?>>> change,
        CancellationToken cancellationToken) =>
        unitOfWork.InTransactionAsync(
            async token =>
            {
                var order = await orders.FindAsync(orderId, includeDeleted: false, token).ConfigureAwait(false);
                if (order is null)
                {
                    return Result.Failure<bool>(OrderErrors.NotFound);
                }

                if (version is not null && !order.RowVersion.AsSpan().SequenceEqual(version))
                {
                    return Result.Failure<bool>(EditErrors.Stale);
                }

                var outcome = await change(order, token).ConfigureAwait(false);
                if (outcome.IsFailure)
                {
                    return Result.Failure<bool>(outcome.Error);
                }

                if (outcome.Value is not { } entry)
                {
                    return Result.Success(false);
                }

                // The order's row is locked before any child row is written, so two writers never wait on each other's rows.
                await orders.LockAsync(order, token).ConfigureAwait(false);
                for (var each = entry; each is not null; each = each.Then)
                {
                    audit.Record(each.Action, OrderAuditDetail.OrderTarget, AuditKey.Of(order.Id), each.Detail);
                }

                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                return Result.Success(true);
            },
            cancellationToken);

    /// <summary>
    /// Saves a form: one attempt that never retries, a lost race answered as the stale-version 409, a list entry deleted at that moment
    /// answered as a 400 on its field, then the order read again.
    /// </summary>
    /// <param name="orders">The order store.</param>
    /// <param name="reader">The order reader.</param>
    /// <param name="audit">The audit trail.</param>
    /// <param name="unitOfWork">The unit of work.</param>
    /// <param name="orderId">The order the child belongs to.</param>
    /// <param name="version">The version the form was opened with.</param>
    /// <param name="change">Applies the domain change; the audit entry to record, or null when nothing changed and nothing is saved.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The order as saved, or the failure.</returns>
    public static async Task<Result<OrderDetailResponse>> SaveFormAsync(
        IOrders orders,
        IOrderReader reader,
        IAuditTrail audit,
        IUnitOfWork unitOfWork,
        Guid orderId,
        byte[] version,
        Func<Order, CancellationToken, Task<Result<OrderChildAudit?>>> change,
        CancellationToken cancellationToken)
    {
        try
        {
            var outcome = await AttemptAsync(orders, audit, unitOfWork, orderId, version, change, cancellationToken).ConfigureAwait(false);
            if (outcome.IsFailure)
            {
                return Result.Failure<OrderDetailResponse>(outcome.Error);
            }
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<OrderDetailResponse>(EditErrors.Stale);
        }
        catch (OrderListEntryDeletedException deleted)
        {
            // The chosen list entry was deleted in the moment before the save: the same 400 as any other refused choice.
            return Result.Failure<OrderDetailResponse>(OrderReferenceChecks.DeletedError(deleted.Kind));
        }

        return await ReadAsync(reader, orderId, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Reads the order after a save.</summary>
    /// <param name="reader">The order reader.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The order, or a 404 when it is gone.</returns>
    public static async Task<Result<OrderDetailResponse>> ReadAsync(IOrderReader reader, Guid orderId, CancellationToken cancellationToken)
    {
        var view = await reader.GetDetailAsync(orderId, cancellationToken).ConfigureAwait(false);
        return view is null ? Result.Failure<OrderDetailResponse>(OrderErrors.NotFound) : Result.Success(view);
    }
}

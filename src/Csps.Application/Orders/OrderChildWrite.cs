using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Application.Orders;

/// <summary>
/// The one flow every write to an order's children uses (ORD-08, SEC-07): inside one transaction the order is found with its
/// children (404 when missing or deleted), the version the form was opened with is compared when one is given (409), the domain
/// change runs and is saved. Children are only ever reached through their order, so an id from another order is never found
/// (CWE-639). Any change a child makes moves the order's edit version, so the order's row version decides who wins a race.
/// </summary>
internal static class OrderChildWrite
{
    /// <summary>
    /// Runs one attempt. A lost race at save time throws <see cref="ConcurrencyConflictException"/> for the caller to turn into a 409
    /// or to retry.
    /// </summary>
    /// <param name="orders">The order store.</param>
    /// <param name="unitOfWork">The unit of work.</param>
    /// <param name="orderId">The order the child belongs to.</param>
    /// <param name="version">The version the form was opened with; null for a single-click action that acts on the latest state.</param>
    /// <param name="change">Applies the domain change; true when something changed and must be saved.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>True when a change was saved, false when nothing changed, or the failure.</returns>
    public static Task<Result<bool>> AttemptAsync(
        IOrders orders,
        IUnitOfWork unitOfWork,
        Guid orderId,
        byte[]? version,
        Func<Order, CancellationToken, Task<Result<bool>>> change,
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
                if (outcome.IsSuccess && outcome.Value)
                {
                    await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                }

                return outcome;
            },
            cancellationToken);

    /// <summary>
    /// Saves a form: one attempt that never retries, a lost race answered as the stale-version 409, then the order read again.
    /// </summary>
    /// <param name="orders">The order store.</param>
    /// <param name="reader">The order reader.</param>
    /// <param name="unitOfWork">The unit of work.</param>
    /// <param name="orderId">The order the child belongs to.</param>
    /// <param name="version">The version the form was opened with.</param>
    /// <param name="change">Applies the domain change; true when something changed and must be saved.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The order as saved, or the failure.</returns>
    public static async Task<Result<OrderDetailResponse>> SaveFormAsync(
        IOrders orders,
        IOrderReader reader,
        IUnitOfWork unitOfWork,
        Guid orderId,
        byte[] version,
        Func<Order, CancellationToken, Task<Result<bool>>> change,
        CancellationToken cancellationToken)
    {
        try
        {
            var outcome = await AttemptAsync(orders, unitOfWork, orderId, version, change, cancellationToken).ConfigureAwait(false);
            if (outcome.IsFailure)
            {
                return Result.Failure<OrderDetailResponse>(outcome.Error);
            }
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<OrderDetailResponse>(EditErrors.Stale);
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

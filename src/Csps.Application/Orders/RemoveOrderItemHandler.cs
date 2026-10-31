using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member removes one item of a saved order (ORD-05, ORD-13). No version is sent: the removal applies to the
/// latest state, so a lost race is read again and decided again once, and a second lost race is the stale-version 409. The item is
/// found on that order only (404, CWE-639), and the last item of an order is never removed (422). The totals are worked out again, and one
/// <c>order-item.removed</c> entry joins the same save (D-31).
/// </summary>
public sealed class RemoveOrderItemHandler(
    IOrders orders,
    IOrderReader reader,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext)
{
    /// <summary>Removes the item.</summary>
    /// <param name="orderId">The order the item is on.</param>
    /// <param name="itemId">The item to remove.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 401 when the token names no usable account, a 404 when the order or the item on it does not exist, a 409
    /// when two saves lost a race twice, or a 422 when it is the last item.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, Guid itemId, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var outcome = await ConflictRetry.RunAsync(
            () => OrderChildWrite.AttemptAsync(
                orders,
                audit,
                unitOfWork,
                orderId,
                version: null,
                (order, _) =>
                {
                    var removed = order.RemoveItem(itemId, clock.UtcNow);
                    return Task.FromResult(removed.IsFailure
                        ? Result.Failure<OrderChildAudit?>(removed.Error)
                        : Result.Success<OrderChildAudit?>(new OrderChildAudit(AuditActions.OrderItemRemoved, OrderAuditDetail.ItemRemoved(removed.Value))));
                },
                cancellationToken),
            Result.Failure<bool>(EditErrors.Stale)).ConfigureAwait(false);
        return outcome.IsFailure
            ? Result.Failure<OrderDetailResponse>(outcome.Error)
            : await OrderChildWrite.ReadAsync(reader, orderId, cancellationToken).ConfigureAwait(false);
    }
}

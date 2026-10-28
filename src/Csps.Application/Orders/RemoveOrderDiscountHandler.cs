using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member removes one discount of a saved order (D-15, ORD-05). No version is sent: the removal applies to the
/// latest state, so a lost race is read again and decided again once, and a second lost race is the stale-version 409. The discount
/// is found on that order only (404, CWE-639). The totals are worked out again, and one <c>order-discount.removed</c> entry joins
/// the same save (D-31).
/// </summary>
public sealed class RemoveOrderDiscountHandler(
    IOrders orders,
    IOrderReader reader,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext)
{
    /// <summary>Removes the discount.</summary>
    /// <param name="orderId">The order the discount is on.</param>
    /// <param name="discountId">The discount to remove.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 401 when the token names no usable account, a 404 when the order or the discount on it does not exist,
    /// or a 409 when two saves lost a race twice.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, Guid discountId, CancellationToken cancellationToken)
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
                    var removed = order.RemoveDiscount(discountId, clock.UtcNow);
                    return Task.FromResult(removed.IsFailure
                        ? Result.Failure<OrderChildAudit?>(removed.Error)
                        : Result.Success<OrderChildAudit?>(new OrderChildAudit(AuditActions.OrderDiscountRemoved, OrderAuditDetail.DiscountRemoved(removed.Value))));
                },
                cancellationToken),
            Result.Failure<bool>(EditErrors.Stale)).ConfigureAwait(false);
        return outcome.IsFailure
            ? Result.Failure<OrderDetailResponse>(outcome.Error)
            : await OrderChildWrite.ReadAsync(reader, orderId, cancellationToken).ConfigureAwait(false);
    }
}

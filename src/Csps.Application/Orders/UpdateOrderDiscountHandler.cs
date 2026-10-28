using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member edits one discount of a saved order with the order's version the form was opened with (D-15, ORD-05,
/// ORD-08). The form is checked against the discount rules (400). The order is then found (404), the version compared (409) and the
/// discount found on that order only (404, CWE-639). The domain checks every rule again and that the discounts still fit under the
/// items total (400 on value), works the totals out again and moves the order's version. A form save never retries on a conflict.
/// An edit that changes nothing saves nothing, records nothing and keeps the version; a change records one
/// <c>order-discount.changed</c> entry in the same save (D-31).
/// </summary>
public sealed class UpdateOrderDiscountHandler(
    IOrders orders,
    IOrderReader reader,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<UpdateOrderDiscountRequest> validator)
{
    /// <summary>Saves the edit.</summary>
    /// <param name="orderId">The order the discount is on.</param>
    /// <param name="discountId">The discount to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 listing every field that failed, a 401 when the token names no usable account, a 404 when the order
    /// or the discount on it does not exist, or a 409 for a stale version or a lost race.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, Guid discountId, UpdateOrderDiscountRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        _ = RowVersions.TryParse(request.Version, out var version);
        _ = DiscountKindNames.TryParse(request.Kind, out var kind);
        var values = new NewOrderDiscount(kind, request.Value!.Value, request.Reason!);

        return await OrderChildWrite.SaveFormAsync(
            orders,
            reader,
            audit,
            unitOfWork,
            orderId,
            version,
            (order, _) =>
            {
                var changes = order.UpdateDiscount(discountId, values, clock.UtcNow);
                if (changes.IsFailure)
                {
                    return Task.FromResult(Result.Failure<OrderChildAudit?>(changes.Error));
                }

                var entry = changes.Value.HasAny
                    ? new OrderChildAudit(AuditActions.OrderDiscountChanged, OrderAuditDetail.DiscountChanged(order.Discounts.Single(discount => discount.Id == discountId), changes.Value))
                    : null;
                return Task.FromResult(Result.Success(entry));
            },
            cancellationToken).ConfigureAwait(false);
    }
}

using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member adds a discount to a saved order with the order's version the form was opened with (D-15, ORD-05,
/// ORD-08). The form is checked against the discount rules (400). The order is then found (404), the version compared (409), and
/// the domain checks every rule again, works the totals out again and moves the order's version. A form save never retries on a
/// conflict: the person reloads and decides. One <c>order-discount.added</c> entry (discount id, kind and value, never the reason)
/// joins the same save (D-31). Who added the discount and when come from the token and the clock, never from the request (SEC-08).
/// </summary>
public sealed class AddOrderDiscountHandler(
    IOrders orders,
    IOrderReader reader,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<AddOrderDiscountRequest> validator)
{
    /// <summary>Adds the discount.</summary>
    /// <param name="orderId">The order to add to.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 listing every field that failed, a 401 when the token names no usable account, a 404 when the order
    /// does not exist or was deleted, or a 409 for a stale version or a lost race.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, AddOrderDiscountRequest request, CancellationToken cancellationToken)
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
        var discount = new NewOrderDiscount(kind, request.Value!.Value, request.Reason!);

        return await OrderChildWrite.SaveFormAsync(
            orders,
            reader,
            audit,
            unitOfWork,
            orderId,
            version,
            (order, _) =>
            {
                var added = order.AddDiscount(discount, clock.UtcNow);
                return Task.FromResult(added.IsFailure
                    ? Result.Failure<OrderChildAudit?>(added.Error)
                    : Result.Success<OrderChildAudit?>(new OrderChildAudit(AuditActions.OrderDiscountAdded, OrderAuditDetail.DiscountAdded(added.Value))));
            },
            cancellationToken).ConfigureAwait(false);
    }
}

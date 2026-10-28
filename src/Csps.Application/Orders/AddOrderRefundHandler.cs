using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member records a refund on a saved order with the order's version the form was opened with (ORD-05, ORD-08,
/// ORD-18, D-07). The form is checked against the refund rules and, in the same 400, against the database: the refunder must be
/// someone who can be chosen (D-07). The order is then found (404), the version compared (409), and the domain checks every rule
/// again, works the totals out again and moves the order's version. A form save never retries on a conflict: the person reloads and
/// decides. One <c>order-refund.added</c> entry (refund id, date, amount and refunder, never the reason) joins the same save
/// (D-31). Who recorded the refund and when come from the token and the clock, never from the request (SEC-08).
/// </summary>
public sealed class AddOrderRefundHandler(
    IOrders orders,
    IOrderReader reader,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<AddOrderRefundRequest> validator)
{
    /// <summary>Adds the refund.</summary>
    /// <param name="orderId">The order to add to.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 listing every field that failed, a 401 when the token names no usable account, a 404 when the order
    /// does not exist or was deleted, a 409 for a stale version or a lost race, or a 422 when the order is locked, cannot be refunded
    /// or already has 50 refunds.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, AddOrderRefundRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var context = new ValidationContext<AddOrderRefundRequest>(request);
        context.RootContextData[OrderRefundFieldsValidator.TodayKey] = clock.Today;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        await OrderReferenceChecks.AddRefunderFailureAsync(staff, request.RefundedByUserId, validation, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        _ = OrderDetailsFieldsValidator.TryParseDate(request.RefundDate, out var refundDate);
        var refund = new NewOrderRefund(refundDate, request.Amount!.Value, request.Reason!, request.RefundedByUserId!.Value);

        return await OrderChildWrite.SaveFormAsync(
            orders,
            reader,
            audit,
            unitOfWork,
            orderId,
            version,
            (order, _) =>
            {
                var added = order.AddRefund(refund, clock.Today, clock.UtcNow);
                return Task.FromResult(added.IsFailure
                    ? Result.Failure<OrderChildAudit?>(added.Error)
                    : Result.Success<OrderChildAudit?>(new OrderChildAudit(AuditActions.OrderRefundAdded, OrderAuditDetail.RefundAdded(added.Value))));
            },
            cancellationToken).ConfigureAwait(false);
    }
}

using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member edits one refund of a saved order with the order's version the form was opened with (ORD-05, ORD-08,
/// ORD-18, D-35). The form is checked against the refund rules (400). The order is then found (404), the version compared (409)
/// and the refund found on that order only (404, CWE-639). A refunder is checked against the database only when the edit changes
/// them, because a refund may keep a refunder who was deactivated after it was saved (D-07); a switch to someone who cannot be
/// chosen is a 400. The domain then checks every rule again, keeps the refund within its cap plus its old amount (D-09, D-34),
/// works the totals out again and moves the order's version. A form save never retries on a conflict. An edit that changes
/// nothing saves nothing, records nothing and keeps the version. A change records one <c>order-refund.changed</c> entry when
/// anything but the refunder changed, and a new refunder records its own <c>order-refund.refunder-changed</c> entry, all in the
/// same save (D-31).
/// </summary>
public sealed class UpdateOrderRefundHandler(
    IOrders orders,
    IOrderReader reader,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<UpdateOrderRefundRequest> validator)
{
    /// <summary>Saves the edit.</summary>
    /// <param name="orderId">The order the refund is on.</param>
    /// <param name="refundId">The refund to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 listing every field that failed, a 401 when the token names no usable account, a 404 when the order
    /// or the refund on it does not exist, a 409 for a stale version or a lost race, or a 422 when the order is completed.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, Guid refundId, UpdateOrderRefundRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var context = new ValidationContext<UpdateOrderRefundRequest>(request);
        context.RootContextData[OrderRefundFieldsValidator.TodayKey] = clock.Today;
        var validation = await LegacyEditFilter.RelaxAsync(
            await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false),
            reader,
            orderId,
            view => view.Refunds.FirstOrDefault(refund => refund.Id == refundId) is { } saved
                ? LegacyEditFilter.Unchanged(
                    (nameof(IOrderRefundFields.Amount), request.Amount == saved.Amount),
                    (nameof(IOrderRefundFields.RefundDate), OrderDetailsFieldsValidator.TryParseDate(request.RefundDate, out var date) && date == saved.RefundDate))
                : LegacyEditFilter.Unchanged(),
            cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        _ = OrderDetailsFieldsValidator.TryParseDate(request.RefundDate, out var refundDate);
        var values = new NewOrderRefund(refundDate, request.Amount!.Value, request.Reason!, request.RefundedByUserId!.Value);

        return await OrderChildWrite.SaveFormAsync(
            orders,
            reader,
            audit,
            unitOfWork,
            orderId,
            version,
            async (order, token) =>
            {
                var existing = order.Refunds.FirstOrDefault(refund => refund.Id == refundId);
                if (existing is not null && existing.RefundedByUserId != values.RefundedByUserId)
                {
                    var references = new ValidationResult();
                    await OrderReferenceChecks.AddRefunderFailureAsync(staff, values.RefundedByUserId, references, token).ConfigureAwait(false);
                    if (!references.IsValid)
                    {
                        return Result.Failure<OrderChildAudit?>(ValidationResults.ToError(references, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
                    }
                }

                var changes = order.UpdateRefund(refundId, values, clock.Today, clock.UtcNow);
                if (changes.IsFailure)
                {
                    return Result.Failure<OrderChildAudit?>(changes.Error);
                }

                return Result.Success(Entries(existing!, changes.Value));
            },
            cancellationToken).ConfigureAwait(false);
    }

    // A refunder change is its own entry and is never merged into the field change (D-07).
    private static OrderChildAudit? Entries(OrderRefund refund, OrderRefundChanges changes)
    {
        OrderChildAudit? refunder = changes.Refunder is { } change
            ? new OrderChildAudit(AuditActions.OrderRefundRefunderChanged, OrderAuditDetail.RefundRefunderChanged(refund, change))
            : null;
        return changes.HasFieldChange
            ? new OrderChildAudit(AuditActions.OrderRefundChanged, OrderAuditDetail.RefundChanged(refund, changes)) { Then = refunder }
            : refunder;
    }
}

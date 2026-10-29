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
/// Use case: a staff member edits one payment of a saved order with the order's version the form was opened with (ORD-05, ORD-08,
/// ORD-22). The form is checked against the payment rules (400). The order is then found (404), the version compared (409) and the
/// payment found on that order only (404, CWE-639). A payment method is checked against the database only when the edit changes
/// it, and a receiver only when the edit changes them, because a payment may keep a method that was retired or a receiver who was
/// deactivated after it was saved (D-16, ORD-22); a switch to a retired or ineligible one is a 400. The domain then checks every
/// rule again, keeps the payment within the balance plus its old amount (D-11), works the totals out again and moves the order's
/// version. A form save never retries on a conflict. An edit that changes nothing saves nothing, records nothing and keeps the
/// version. A change records one <c>order-payment.changed</c> entry when anything but the receiver changed, and a new receiver
/// records its own <c>order-payment.receiver-changed</c> entry, all in the same save (D-31).
/// </summary>
public sealed class UpdateOrderPaymentHandler(
    IOrders orders,
    IOrderReader reader,
    IOrderLists lists,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<UpdateOrderPaymentRequest> validator)
{
    /// <summary>Saves the edit.</summary>
    /// <param name="orderId">The order the payment is on.</param>
    /// <param name="paymentId">The payment to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 listing every field that failed, a 401 when the token names no usable account, a 404 when the order
    /// or the payment on it does not exist, a 409 for a stale version or a lost race, or a 422 when the order is completed or cancelled or the payments would drop below the refunds.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, Guid paymentId, UpdateOrderPaymentRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var context = new ValidationContext<UpdateOrderPaymentRequest>(request);
        context.RootContextData[OrderPaymentFieldsValidator.TodayKey] = clock.Today;
        var validation = await LegacyEditFilter.RelaxAsync(
            await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false),
            reader,
            orderId,
            view => view.Payments.FirstOrDefault(payment => payment.Id == paymentId) is { } saved
                ? LegacyEditFilter.Unchanged(
                    (nameof(IOrderPaymentFields.Amount), request.Amount == saved.Amount),
                    (nameof(IOrderPaymentFields.PaymentDate), OrderDetailsFieldsValidator.TryParseDate(request.PaymentDate, out var date) && date == saved.PaymentDate))
                : LegacyEditFilter.Unchanged(),
            cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        _ = OrderDetailsFieldsValidator.TryParseDate(request.PaymentDate, out var paymentDate);
        var values = new NewOrderPayment(
            paymentDate,
            request.Amount!.Value,
            request.PaymentMethodId!.Value,
            request.Reference,
            request.Notes,
            request.ReceivedByUserId!.Value);

        return await OrderChildWrite.SaveFormAsync(
            orders,
            reader,
            audit,
            unitOfWork,
            orderId,
            version,
            async (order, token) =>
            {
                var existing = order.Payments.FirstOrDefault(payment => payment.Id == paymentId);
                if (existing is not null)
                {
                    var references = new ValidationResult();
                    if (existing.PaymentMethodId != values.PaymentMethodId)
                    {
                        await OrderReferenceChecks.AddPaymentMethodFailureAsync(lists, values.PaymentMethodId, references, token).ConfigureAwait(false);
                    }

                    if (existing.ReceivedByUserId != values.ReceivedByUserId)
                    {
                        await OrderReferenceChecks.AddReceiverFailureAsync(staff, values.ReceivedByUserId, references, token).ConfigureAwait(false);
                    }

                    if (!references.IsValid)
                    {
                        return Result.Failure<OrderChildAudit?>(ValidationResults.ToError(references, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
                    }
                }

                var changes = order.UpdatePayment(paymentId, values, clock.Today, clock.UtcNow);
                if (changes.IsFailure)
                {
                    return Result.Failure<OrderChildAudit?>(changes.Error);
                }

                return Result.Success(Entries(existing!, changes.Value));
            },
            cancellationToken).ConfigureAwait(false);
    }

    // A receiver change is its own entry and is never merged into the field change (ORD-22).
    private static OrderChildAudit? Entries(OrderPayment payment, OrderPaymentChanges changes)
    {
        OrderChildAudit? receiver = changes.Receiver is { } change
            ? new OrderChildAudit(AuditActions.OrderPaymentReceiverChanged, OrderAuditDetail.PaymentReceiverChanged(payment, change))
            : null;
        return changes.HasFieldChange
            ? new OrderChildAudit(AuditActions.OrderPaymentChanged, OrderAuditDetail.PaymentChanged(payment, changes)) { Then = receiver }
            : receiver;
    }
}

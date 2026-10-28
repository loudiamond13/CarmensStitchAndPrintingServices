using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member records a payment on a saved order with the order's version the form was opened with (ORD-05, ORD-08,
/// ORD-22). The form is checked against the payment rules and, in the same 400, against the database: the payment method must
/// exist and not be retired (D-16), and the receiver must be someone who can be chosen (ORD-22). The order is then found (404), the
/// version compared (409), and the domain checks every rule again, refuses a payment above the balance (D-11), works the totals
/// out again and moves the order's version. A form save never retries on a conflict: the person reloads and decides. One
/// <c>order-payment.added</c> entry (payment id, date, amount, method and receiver, never the reference or notes) joins the same
/// save (D-31). Who recorded the payment and when come from the token and the clock, never from the request (SEC-08).
/// </summary>
public sealed class AddOrderPaymentHandler(
    IOrders orders,
    IOrderReader reader,
    IOrderLists lists,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<AddOrderPaymentRequest> validator)
{
    /// <summary>Adds the payment.</summary>
    /// <param name="orderId">The order to add to.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 listing every field that failed, a 401 when the token names no usable account, a 404 when the order
    /// does not exist or was deleted, a 409 for a stale version or a lost race, or a 422 when the order already has 100 payments.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, AddOrderPaymentRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var context = new ValidationContext<AddOrderPaymentRequest>(request);
        context.RootContextData[OrderPaymentFieldsValidator.TodayKey] = clock.Today;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        await OrderReferenceChecks.AddPaymentMethodFailureAsync(lists, request.PaymentMethodId, validation, cancellationToken).ConfigureAwait(false);
        await OrderReferenceChecks.AddReceiverFailureAsync(staff, request.ReceivedByUserId, validation, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        _ = OrderDetailsFieldsValidator.TryParseDate(request.PaymentDate, out var paymentDate);
        var payment = new NewOrderPayment(
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
            (order, _) =>
            {
                var added = order.AddPayment(payment, clock.Today, clock.UtcNow);
                return Task.FromResult(added.IsFailure
                    ? Result.Failure<OrderChildAudit?>(added.Error)
                    : Result.Success<OrderChildAudit?>(new OrderChildAudit(AuditActions.OrderPaymentAdded, OrderAuditDetail.PaymentAdded(added.Value))));
            },
            cancellationToken).ConfigureAwait(false);
    }
}

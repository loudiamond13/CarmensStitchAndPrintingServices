using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member moves a saved order to another status (ORD-16, ORD-17). No version is sent: the move is judged on the
/// latest state inside the save, so a lost race is read again and decided again once, and a second lost race is the stale-version
/// 409. That is what keeps an order from being completed while a new discount or payment has just left it owing or in credit. The
/// status key is checked first (400); the owner's table then decides (422). A move adds a history row and one
/// <c>order.status-changed</c> entry, a reopen from Completed or Cancelled one <c>order.reopened</c> entry, in the same save
/// (D-31). A request for the status the order already has saves nothing, records nothing and keeps the version.
/// </summary>
public sealed class ChangeOrderStatusHandler(
    IOrders orders,
    IOrderReader reader,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<ChangeOrderStatusRequest> validator)
{
    /// <summary>Moves the order.</summary>
    /// <param name="orderId">The order to move.</param>
    /// <param name="request">The requested status.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 on the status, a 401 when the token names no usable account, a 404 when the order does not exist
    /// or was deleted, a 409 when two saves lost a race twice, or a 422 when the owner's table refuses the move.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, ChangeOrderStatusRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        _ = OrderStatusNames.TryParse(request.Status, out var target);
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
                    var from = order.Status;
                    var moved = order.ChangeStatus(target, callerId, clock.UtcNow);
                    return Task.FromResult(moved.IsFailure ? Result.Failure<OrderChildAudit?>(moved.Error) : Result.Success(Entry(moved.Value, from, target)));
                },
                cancellationToken),
            Result.Failure<bool>(EditErrors.Stale)).ConfigureAwait(false);
        return outcome.IsFailure
            ? Result.Failure<OrderDetailResponse>(outcome.Error)
            : await OrderChildWrite.ReadAsync(reader, orderId, cancellationToken).ConfigureAwait(false);
    }

    private static OrderChildAudit? Entry(OrderStatusMove move, OrderStatus from, OrderStatus to) => move switch
    {
        OrderStatusMove.Reopen => new OrderChildAudit(AuditActions.OrderReopened, OrderAuditDetail.StatusChanged(from, to)),
        OrderStatusMove.Move => new OrderChildAudit(AuditActions.OrderStatusChanged, OrderAuditDetail.StatusChanged(from, to)),
        _ => null,
    };
}

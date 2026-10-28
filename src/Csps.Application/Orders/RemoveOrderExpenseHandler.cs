using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member removes one expense of a saved order (ORD-05). No version is sent: the removal applies to the latest
/// state, so a lost race is read again and decided again once, and a second lost race is the stale-version 409. The expense is
/// found on that order only (404, CWE-639). The expenses and the profit are worked out again, and one <c>order-expense.removed</c>
/// entry joins the same save (D-31).
/// </summary>
public sealed class RemoveOrderExpenseHandler(
    IOrders orders,
    IOrderReader reader,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext)
{
    /// <summary>Removes the expense.</summary>
    /// <param name="orderId">The order the expense is on.</param>
    /// <param name="expenseId">The expense to remove.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 401 when the token names no usable account, a 404 when the order or the expense on it does not exist,
    /// or a 409 when two saves lost a race twice.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, Guid expenseId, CancellationToken cancellationToken)
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
                    var removed = order.RemoveExpense(expenseId, clock.UtcNow);
                    return Task.FromResult(removed.IsFailure
                        ? Result.Failure<OrderChildAudit?>(removed.Error)
                        : Result.Success<OrderChildAudit?>(new OrderChildAudit(AuditActions.OrderExpenseRemoved, OrderAuditDetail.ExpenseRemoved(removed.Value))));
                },
                cancellationToken),
            Result.Failure<bool>(EditErrors.Stale)).ConfigureAwait(false);
        return outcome.IsFailure
            ? Result.Failure<OrderDetailResponse>(outcome.Error)
            : await OrderChildWrite.ReadAsync(reader, orderId, cancellationToken).ConfigureAwait(false);
    }
}

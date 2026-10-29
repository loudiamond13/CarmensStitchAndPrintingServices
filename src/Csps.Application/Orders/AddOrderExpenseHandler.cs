using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member records an expense on a saved order with the order's version the form was opened with (ORD-05, ORD-08,
/// ORD-23). The form is checked against the expense rules and, in the same 400, against the database: the category must exist and
/// not be retired (D-17), and the payer must be someone who can be chosen (ORD-23). The order is then found (404), the version
/// compared (409), and the domain checks every rule again, works the expenses and the profit out again and moves the order's
/// version. A form save never retries on a conflict: the person reloads and decides. One <c>order-expense.added</c> entry (expense
/// id, date, amount, category and payer, never the description) joins the same save (D-31). Who recorded the expense and when come
/// from the token and the clock, never from the request (SEC-08).
/// </summary>
public sealed class AddOrderExpenseHandler(
    IOrders orders,
    IOrderReader reader,
    IOrderLists lists,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<AddOrderExpenseRequest> validator)
{
    /// <summary>Adds the expense.</summary>
    /// <param name="orderId">The order to add to.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 listing every field that failed, a 401 when the token names no usable account, a 404 when the order
    /// does not exist or was deleted, a 409 for a stale version or a lost race, or a 422 when the order already has 100 expenses or is completed or cancelled.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, AddOrderExpenseRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var context = new ValidationContext<AddOrderExpenseRequest>(request);
        context.RootContextData[OrderExpenseFieldsValidator.TodayKey] = clock.Today;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        await OrderReferenceChecks.AddExpenseCategoryFailureAsync(lists, request.OrderExpenseCategoryId, validation, cancellationToken).ConfigureAwait(false);
        await OrderReferenceChecks.AddPayerFailureAsync(staff, request.PaidByUserId, validation, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        _ = OrderDetailsFieldsValidator.TryParseDate(request.ExpenseDate, out var expenseDate);
        var expense = new NewOrderExpense(
            expenseDate,
            request.Amount!.Value,
            request.OrderExpenseCategoryId!.Value,
            request.Description,
            request.PaidByUserId!.Value);

        return await OrderChildWrite.SaveFormAsync(
            orders,
            reader,
            audit,
            unitOfWork,
            orderId,
            version,
            (order, _) =>
            {
                var added = order.AddExpense(expense, clock.Today, clock.UtcNow);
                return Task.FromResult(added.IsFailure
                    ? Result.Failure<OrderChildAudit?>(added.Error)
                    : Result.Success<OrderChildAudit?>(new OrderChildAudit(AuditActions.OrderExpenseAdded, OrderAuditDetail.ExpenseAdded(added.Value))));
            },
            cancellationToken).ConfigureAwait(false);
    }
}

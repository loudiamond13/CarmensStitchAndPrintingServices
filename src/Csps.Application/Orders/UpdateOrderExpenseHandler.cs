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
/// Use case: a staff member edits one expense of a saved order with the order's version the form was opened with (ORD-05, ORD-08,
/// ORD-23). The form is checked against the expense rules (400). The order is then found (404), the version compared (409) and the
/// expense found on that order only (404, CWE-639). A category is checked against the database only when the edit changes it, and a
/// payer only when the edit changes them, because an expense may keep a category that was retired or a payer who was deactivated
/// after it was saved (D-17, ORD-23); a switch to a retired or ineligible one is a 400. The domain then checks every rule again,
/// works the expenses and the profit out again and moves the order's version. A form save never retries on a conflict. An edit that
/// changes nothing saves nothing, records nothing and keeps the version. A change records one <c>order-expense.changed</c> entry
/// when anything but the payer changed, and a new payer records its own <c>order-expense.payer-changed</c> entry, all in the same
/// save (D-31).
/// </summary>
public sealed class UpdateOrderExpenseHandler(
    IOrders orders,
    IOrderReader reader,
    IOrderLists lists,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<UpdateOrderExpenseRequest> validator)
{
    /// <summary>Saves the edit.</summary>
    /// <param name="orderId">The order the expense is on.</param>
    /// <param name="expenseId">The expense to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 listing every field that failed, a 401 when the token names no usable account, a 404 when the order
    /// or the expense on it does not exist, or a 409 for a stale version or a lost race.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, Guid expenseId, UpdateOrderExpenseRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var context = new ValidationContext<UpdateOrderExpenseRequest>(request);
        context.RootContextData[OrderExpenseFieldsValidator.TodayKey] = clock.Today;
        var validation = await LegacyEditFilter.RelaxAsync(
            await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false),
            reader,
            orderId,
            view => view.Expenses.FirstOrDefault(expense => expense.Id == expenseId) is { } saved
                ? LegacyEditFilter.Unchanged(
                    (nameof(IOrderExpenseFields.Amount), request.Amount == saved.Amount),
                    (nameof(IOrderExpenseFields.ExpenseDate), OrderDetailsFieldsValidator.TryParseDate(request.ExpenseDate, out var date) && date == saved.ExpenseDate))
                : LegacyEditFilter.Unchanged(),
            cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        _ = OrderDetailsFieldsValidator.TryParseDate(request.ExpenseDate, out var expenseDate);
        var values = new NewOrderExpense(
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
            async (order, token) =>
            {
                var existing = order.Expenses.FirstOrDefault(expense => expense.Id == expenseId);
                if (existing is not null)
                {
                    var references = new ValidationResult();
                    if (existing.OrderExpenseCategoryId != values.OrderExpenseCategoryId)
                    {
                        await OrderReferenceChecks.AddExpenseCategoryFailureAsync(lists, values.OrderExpenseCategoryId, references, token).ConfigureAwait(false);
                    }

                    if (existing.PaidByUserId != values.PaidByUserId)
                    {
                        await OrderReferenceChecks.AddPayerFailureAsync(staff, values.PaidByUserId, references, token).ConfigureAwait(false);
                    }

                    if (!references.IsValid)
                    {
                        return Result.Failure<OrderChildAudit?>(ValidationResults.ToError(references, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
                    }
                }

                var changes = order.UpdateExpense(expenseId, values, clock.Today, clock.UtcNow);
                if (changes.IsFailure)
                {
                    return Result.Failure<OrderChildAudit?>(changes.Error);
                }

                return Result.Success(Entries(existing!, changes.Value));
            },
            cancellationToken).ConfigureAwait(false);
    }

    // A payer change is its own entry and is never merged into the field change (ORD-23).
    private static OrderChildAudit? Entries(OrderExpense expense, OrderExpenseChanges changes)
    {
        OrderChildAudit? payer = changes.Payer is { } change
            ? new OrderChildAudit(AuditActions.OrderExpensePayerChanged, OrderAuditDetail.ExpensePayerChanged(expense, change))
            : null;
        return changes.HasFieldChange
            ? new OrderChildAudit(AuditActions.OrderExpenseChanged, OrderAuditDetail.ExpenseChanged(expense, changes)) { Then = payer }
            : payer;
    }
}

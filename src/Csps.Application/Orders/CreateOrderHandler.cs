using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member creates an order with its items, discounts, payments and expenses in one call (ORD-03, D-24). The form is checked against the field rules and,
/// in the same 400, against the database: every product type must exist and not be retired (D-18), every payment method must exist
/// and not be retired (D-16), every receiver and every payer must be someone who can be chosen (ORD-22, ORD-23), and every expense
/// category must exist and not be retired (D-17). The order is then built and
/// checked again by the domain before any lock is taken, so a refused order allocates no number. The number, the order, its first
/// history row, the counter and one audit entry save in one transaction. The audit entry holds the number, status, dates, item
/// count and total, never customer details or notes (D-31). Who recorded the order and when come from the token and the clock,
/// never from the request (SEC-08).
/// </summary>
public sealed class CreateOrderHandler(
    IOrders orders,
    IOrderReader reader,
    IOrderNumbers numbers,
    IOrderLists lists,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<CreateOrderRequest> validator)
{
    /// <summary>Creates the order.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new order, a 400 listing every field that failed, a 409 when the number lock timed out or the save was a deadlock victim, or a 401 when the token names no usable account.</returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(CreateOrderRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var context = new ValidationContext<CreateOrderRequest>(request);
        context.RootContextData[OrderPaymentFieldsValidator.TodayKey] = clock.Today;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        await OrderReferenceChecks.AddProductTypeFailuresAsync(lists, request.Items, validation, cancellationToken).ConfigureAwait(false);
        await OrderReferenceChecks.AddPaymentFailuresAsync(lists, staff, request.Payments, validation, cancellationToken).ConfigureAwait(false);
        await OrderReferenceChecks.AddExpenseFailuresAsync(lists, staff, request.Expenses, validation, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        var created = Order.Create(ToNewOrder(request), callerId, clock.UtcNow, clock.Today);
        if (created.IsFailure)
        {
            return Result.Failure<OrderDetailResponse>(created.Error);
        }

        var order = created.Value;
        try
        {
            await unitOfWork.InTransactionAsync(
                async token =>
                {
                    order.AssignNumber(await numbers.NextAsync(clock.Year, clock.UtcNow, token).ConfigureAwait(false));
                    orders.Add(order);
                    audit.Record(AuditActions.OrderCreated, OrderAuditDetail.OrderTarget, AuditKey.Of(order.Id), OrderAuditDetail.Created(order));
                    await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                    return order.Id;
                },
                cancellationToken).ConfigureAwait(false);
        }
        catch (OrderListEntryDeletedException deleted)
        {
            // A list entry was deleted between the form check and the save: the rows that named it are marked on their own paths.
            return Result.Failure<OrderDetailResponse>(await OrderReferenceChecks.DeletedErrorAsync(lists, staff, request, deleted.Kind, cancellationToken).ConfigureAwait(false));
        }
        catch (OrderNumberBusyException)
        {
            return Result.Failure<OrderDetailResponse>(OrderErrors.Busy);
        }
        catch (ConcurrencyConflictException)
        {
            // A new order has no version to lose, so a conflict at save is a deadlock victim (the unit of work maps it): same answer as a busy lock.
            return Result.Failure<OrderDetailResponse>(OrderErrors.Busy);
        }

        var view = await reader.GetDetailAsync(order.Id, cancellationToken).ConfigureAwait(false);
        return view is null ? Result.Failure<OrderDetailResponse>(OrderErrors.NotFound) : Result.Success(view);
    }

    // The validator has passed, so the dates parse, the status is active or absent, and every item, discount, payment and expense is present and complete.
    private static NewOrder ToNewOrder(CreateOrderRequest request)
    {
        _ = OrderDetailsFieldsValidator.TryParseDate(request.OrderDate, out var orderDate);
        _ = OrderDetailsFieldsValidator.TryParseDate(request.DueDate, out var dueDate);
        var status = OrderStatusNames.TryParse(request.Status, out var named) ? named : OrderStatus.Pending;
        var details = new OrderDetails(
            request.CustomerName!,
            request.TeamName,
            request.ContactNumber,
            request.Email,
            request.Address,
            orderDate,
            dueDate,
            request.Notes);
        var items = request.Items!
            .Select(static item => new NewOrderItem(item!.ProductTypeId!.Value, item.Description!, item.SizeVariant, item.Quantity!.Value, item.UnitPrice!.Value))
            .ToList();
        var discounts = (request.Discounts ?? [])
            .Select(static discount =>
            {
                _ = DiscountKindNames.TryParse(discount!.Kind, out var kind);
                return new NewOrderDiscount(kind, discount.Value!.Value, discount.Reason!);
            })
            .ToList();
        var payments = (request.Payments ?? [])
            .Select(static payment =>
            {
                _ = OrderDetailsFieldsValidator.TryParseDate(payment!.PaymentDate, out var paymentDate);
                return new NewOrderPayment(paymentDate, payment.Amount!.Value, payment.PaymentMethodId!.Value, payment.Reference, payment.Notes, payment.ReceivedByUserId!.Value);
            })
            .ToList();
        var expenses = (request.Expenses ?? [])
            .Select(static expense =>
            {
                _ = OrderDetailsFieldsValidator.TryParseDate(expense!.ExpenseDate, out var expenseDate);
                return new NewOrderExpense(expenseDate, expense.Amount!.Value, expense.OrderExpenseCategoryId!.Value, expense.Description, expense.PaidByUserId!.Value);
            })
            .ToList();
        return new NewOrder(details, status, items) { Discounts = discounts, Payments = payments, Expenses = expenses };
    }
}

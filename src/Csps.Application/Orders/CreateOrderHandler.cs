using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member creates an order with its items and discounts in one call (ORD-03, D-24). The form is checked against the field rules and,
/// in the same 400, against the database: every product type must exist and not be retired (D-18). The order is then built and
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
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<CreateOrderRequest> validator)
{
    private const string OrderTarget = "Order";

    /// <summary>Creates the order.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new order, a 400 listing every field that failed, a 409 when the number lock timed out, or a 401 when the token names no usable account.</returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(CreateOrderRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        await OrderReferenceChecks.AddProductTypeFailuresAsync(lists, request.Items, validation, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        var created = Order.Create(ToNewOrder(request), callerId, clock.UtcNow);
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
                    audit.Record(AuditActions.OrderCreated, OrderTarget, AuditKey.Of(order.Id), OrderAuditDetail.Created(order));
                    await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                    return order.Id;
                },
                cancellationToken).ConfigureAwait(false);
        }
        catch (OrderNumberBusyException)
        {
            return Result.Failure<OrderDetailResponse>(OrderErrors.Busy);
        }

        var view = await reader.GetDetailAsync(order.Id, cancellationToken).ConfigureAwait(false);
        return view is null ? Result.Failure<OrderDetailResponse>(OrderErrors.NotFound) : Result.Success(view);
    }

    // The validator has passed, so the dates parse, the status is active or absent, and every item and discount is present and complete.
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
        return new NewOrder(details, status, items) { Discounts = discounts };
    }
}

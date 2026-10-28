using System.Globalization;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member creates an order with its items in one call (ORD-03). The order is built and checked before any lock
/// is taken, so a refused order allocates no number. The number, the order, its first history row and the counter then save in
/// one transaction. Who recorded the order and when come from the token and the clock, never from the request (SEC-08).
/// </summary>
public sealed class CreateOrderHandler(
    IOrders orders,
    IOrderReader reader,
    IOrderNumbers numbers,
    IBusinessCalendar calendar,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext)
{
    /// <summary>Creates the order.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new order, a 400 for field errors, a 409 when the number lock timed out, or a 401 when the token names no usable account.</returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(CreateOrderRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var input = ToNewOrder(request);
        if (input.IsFailure)
        {
            return Result.Failure<OrderDetailResponse>(input.Error);
        }

        var created = Order.Create(input.Value, callerId, clock.UtcNow);
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

    private static Result<NewOrder> ToNewOrder(CreateOrderRequest request)
    {
        if (!TryParseDate(request.OrderDate, out var orderDate))
        {
            return OrderRules.Reject<NewOrder>(OrderRules.OrderDateField, OrderRules.DateInvalid);
        }

        _ = TryParseDate(request.DueDate, out var dueDate);
        var status = OrderStatus.Pending;
        if (request.Status is not null && !OrderStatusNames.TryParse(request.Status, out status))
        {
            return OrderRules.Reject<NewOrder>(OrderRules.StatusField, OrderRules.StatusInvalid);
        }

        var items = new List<NewOrderItem>();
        foreach (var item in request.Items ?? [])
        {
            if (item?.UnitPrice is not { } unitPrice)
            {
                return OrderRules.Reject<NewOrder>(OrderRules.ItemPath(items.Count, OrderRules.UnitPriceField), OrderRules.UnitPriceRequired);
            }

            items.Add(new NewOrderItem(item.ProductTypeId ?? Guid.Empty, item.Description ?? string.Empty, item.SizeVariant, item.Quantity ?? 0, unitPrice));
        }

        var details = new OrderDetails(
            request.CustomerName ?? string.Empty,
            request.TeamName,
            request.ContactNumber,
            request.Email,
            request.Address,
            orderDate,
            dueDate == default ? null : dueDate,
            request.Notes);
        return Result.Success(new NewOrder(details, status, items));
    }

    private static bool TryParseDate(string? text, out DateOnly date)
    {
        date = default;
        return text is not null
            && DateOnly.TryParseExact(text.Trim(), OrderRules.DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }
}

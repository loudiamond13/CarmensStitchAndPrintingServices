using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member adds an item to a saved order with the order's version the form was opened with (ORD-05, ORD-08,
/// ORD-13). The form is checked against the item rules and, in the same 400, against the database: the product type must exist and
/// not be retired (D-18). The order is then found (404), the version compared (409), and the domain checks every rule again,
/// refuses a 101st item (422), works the totals out again and moves the order's version. A form save never retries on a conflict:
/// the person reloads and decides. Who added the item and when come from the token and the clock, never from the request (SEC-08).
/// </summary>
public sealed class AddOrderItemHandler(
    IOrders orders,
    IOrderReader reader,
    IOrderLists lists,
    IBusinessCalendar calendar,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<AddOrderItemRequest> validator)
{
    /// <summary>Adds the item.</summary>
    /// <param name="orderId">The order to add to.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 listing every field that failed, a 401 when the token names no usable account, a 404 when the order
    /// does not exist or was deleted, a 409 for a stale version or a lost race, or a 422 when the order already has 100 items.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, AddOrderItemRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        await OrderReferenceChecks.AddProductTypeFailureAsync(lists, request.ProductTypeId, validation, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        _ = RowVersions.TryParse(request.Version, out var version);
        var item = new NewOrderItem(request.ProductTypeId!.Value, request.Description!, request.SizeVariant, request.Quantity!.Value, request.UnitPrice!.Value);

        return await OrderChildWrite.SaveFormAsync(
            orders,
            reader,
            unitOfWork,
            orderId,
            version,
            (order, _) =>
            {
                var added = order.AddItem(item, clock.UtcNow);
                return Task.FromResult(added.IsFailure ? Result.Failure<bool>(added.Error) : Result.Success(true));
            },
            cancellationToken).ConfigureAwait(false);
    }
}

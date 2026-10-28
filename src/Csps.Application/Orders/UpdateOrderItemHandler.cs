using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member edits one item of a saved order with the order's version the form was opened with (ORD-05, ORD-08,
/// ORD-13). The form is checked against the item rules (400). The order is then found (404), the version compared (409) and the item
/// found on that order only (404, CWE-639). A product type is checked against the database only when the edit changes it, because an
/// item may keep a type that was retired after it was saved (D-19, 06 D-11); a switch to a retired or unknown type is a 400. The
/// domain then checks every rule again, works the totals out again and moves the order's version. A form save never retries on a
/// conflict. An edit that changes nothing saves nothing and keeps the version.
/// </summary>
public sealed class UpdateOrderItemHandler(
    IOrders orders,
    IOrderReader reader,
    IOrderLists lists,
    IBusinessCalendar calendar,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<UpdateOrderItemRequest> validator)
{
    /// <summary>Saves the edit.</summary>
    /// <param name="orderId">The order the item is on.</param>
    /// <param name="itemId">The item to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 listing every field that failed, a 401 when the token names no usable account, a 404 when the order
    /// or the item on it does not exist, or a 409 for a stale version or a lost race.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, Guid itemId, UpdateOrderItemRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        _ = RowVersions.TryParse(request.Version, out var version);
        var values = new NewOrderItem(request.ProductTypeId!.Value, request.Description!, request.SizeVariant, request.Quantity!.Value, request.UnitPrice!.Value);

        return await OrderChildWrite.SaveFormAsync(
            orders,
            reader,
            unitOfWork,
            orderId,
            version,
            async (order, token) =>
            {
                var existing = order.Items.FirstOrDefault(item => item.Id == itemId);
                if (existing is not null && existing.ProductTypeId != values.ProductTypeId)
                {
                    var typeCheck = new ValidationResult();
                    await OrderReferenceChecks.AddProductTypeFailureAsync(lists, values.ProductTypeId, typeCheck, token).ConfigureAwait(false);
                    if (!typeCheck.IsValid)
                    {
                        return Result.Failure<bool>(ValidationResults.ToError(typeCheck, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
                    }
                }

                var changes = order.UpdateItem(itemId, values, clock.UtcNow);
                return changes.IsFailure ? Result.Failure<bool>(changes.Error) : Result.Success(changes.Value.HasAny);
            },
            cancellationToken).ConfigureAwait(false);
    }
}

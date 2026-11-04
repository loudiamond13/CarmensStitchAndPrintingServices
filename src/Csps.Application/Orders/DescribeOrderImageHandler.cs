using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member sets or clears one photo's description on a saved order (ORD-04, D-12, D-30), with the order's version
/// the page was opened with. The request is checked (400), then the order is found (404), the version compared (409) and the photo
/// found on that order only (404, CWE-639). An empty text, or the default text of the photo's place, is kept as none. A description
/// that changes nothing saves nothing, records nothing and keeps the version. A change records one
/// <c>order-image.description-changed</c> entry with the old and new text (D-19). A form save never retries on a conflict.
/// </summary>
public sealed class DescribeOrderImageHandler(
    IOrders orders,
    IOrderReader reader,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<DescribeOrderImageRequest> validator)
{
    /// <summary>Saves the description.</summary>
    /// <param name="orderId">The order the photo is on.</param>
    /// <param name="imageId">The photo to describe.</param>
    /// <param name="request">The description and the version.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 for a description that is too long or a version that is not usable, a 401 when the token names no
    /// usable account, a 404 when the order or the photo on it does not exist, a 409 for a stale version or a lost race, or a 422 for
    /// a completed or cancelled order.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, Guid imageId, DescribeOrderImageRequest request, CancellationToken cancellationToken)
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

        return await OrderChildWrite.SaveFormAsync(
            orders,
            reader,
            audit,
            unitOfWork,
            orderId,
            version,
            (order, _) =>
            {
                var described = order.DescribeImage(imageId, request.Description, clock.UtcNow);
                if (described.IsFailure)
                {
                    return Task.FromResult(Result.Failure<OrderChildAudit?>(described.Error));
                }

                var entry = described.Value is { } change
                    ? new OrderChildAudit(AuditActions.OrderImageDescriptionChanged, OrderAuditDetail.ImageDescriptionChanged(order, order.Images.First(image => image.Id == imageId), change))
                    : null;
                return Task.FromResult(Result.Success(entry));
            },
            cancellationToken).ConfigureAwait(false);
    }
}

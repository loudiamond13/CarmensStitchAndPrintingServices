using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member moves one photo of a saved order to a place, or makes it the cover with place 0 (ORD-04, D-13, D-14),
/// with the order's version the page was opened with. The request is checked (400), then the order is found (404), the version
/// compared (409) and the photo found on that order only (404, CWE-639). The domain keeps the places 0 to n-1 with no gap. A move to
/// the place the photo already has saves nothing, records nothing and keeps the version. A move records one
/// <c>order-image.moved</c> entry, and one <c>order-image.cover-changed</c> entry when the cover is now another photo (D-19). A form
/// save never retries on a conflict.
/// </summary>
public sealed class MoveOrderImageHandler(
    IOrders orders,
    IOrderReader reader,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<MoveOrderImageRequest> validator)
{
    /// <summary>Moves the photo.</summary>
    /// <param name="orderId">The order the photo is on.</param>
    /// <param name="imageId">The photo to move.</param>
    /// <param name="request">The place and the version.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 for a place or version that is not usable, a 401 when the token names no usable account, a 404 when
    /// the order or the photo on it does not exist, a 409 for a stale version or a lost race, or a 422 for a completed or cancelled order.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, Guid imageId, MoveOrderImageRequest request, CancellationToken cancellationToken)
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
                var moved = order.MoveImage(imageId, request.Position!.Value, clock.UtcNow);
                if (moved.IsFailure)
                {
                    return Task.FromResult(Result.Failure<OrderChildAudit?>(moved.Error));
                }

                return Task.FromResult(Result.Success(moved.Value is { } change ? Entry(order, change) : null));
            },
            cancellationToken).ConfigureAwait(false);
    }

    private static OrderChildAudit Entry(Order order, OrderImageMove move) =>
        new(AuditActions.OrderImageMoved, OrderAuditDetail.ImageMoved(order, move))
        {
            Then = move.NewCoverFrom is { } coverFrom ? new OrderChildAudit(AuditActions.OrderImageCoverChanged, OrderAuditDetail.ImageCoverChanged(order, coverFrom)) : null,
        };
}

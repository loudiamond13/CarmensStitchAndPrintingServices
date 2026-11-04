using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member deletes one photo of a saved order (ORD-04, JOB-02, D-19, D-20). No version is sent: the delete applies
/// to the latest state, so a lost race is read again and decided again once, and a second lost race is the stale-version 409. The
/// photo is found on that order only (404, CWE-639); deleting it twice is a 404 the second time. The places of the other photos close
/// up, and the next photo becomes the cover when the cover was deleted. In the same save, one <c>order-image.deleted</c> entry is
/// recorded and the photo's stored file is queued for removal. Nothing calls the photo storage here, so a failed or slow storage can
/// never block or half-finish a delete; the maintenance job removes the file later.
/// </summary>
public sealed class RemoveOrderImageHandler(
    IOrders orders,
    IOrderReader reader,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IImageDeletionQueue deletionQueue,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext)
{
    /// <summary>Deletes the photo.</summary>
    /// <param name="orderId">The order the photo is on.</param>
    /// <param name="imageId">The photo to delete.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 401 when the token names no usable account, a 404 when the order or the photo on it does not exist, a 409
    /// when two saves lost a race twice, or a 422 when the order is completed or cancelled.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, Guid imageId, CancellationToken cancellationToken)
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
                    var removed = order.RemoveImage(imageId, clock.UtcNow);
                    if (removed.IsFailure)
                    {
                        return Task.FromResult(Result.Failure<OrderChildAudit?>(removed.Error));
                    }

                    deletionQueue.Enqueue(removed.Value.PublicId, ImageDeletionReason.PhotoDeleted);
                    return Task.FromResult(Result.Success<OrderChildAudit?>(new OrderChildAudit(AuditActions.OrderImageDeleted, OrderAuditDetail.ImageDeleted(order, removed.Value))));
                },
                cancellationToken),
            Result.Failure<bool>(EditErrors.Stale)).ConfigureAwait(false);
        return outcome.IsFailure
            ? Result.Failure<OrderDetailResponse>(outcome.Error)
            : await OrderChildWrite.ReadAsync(reader, orderId, cancellationToken).ConfigureAwait(false);
    }
}

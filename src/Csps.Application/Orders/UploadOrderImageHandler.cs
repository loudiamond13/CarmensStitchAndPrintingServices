using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member uploads one photo to a saved order (ORD-04, IMG-01, IMG-02, IMG-03). The steps run in this order so a
/// refused upload never leaves a customer photo in storage: the storage must be set up (503), the order must exist, be open and have
/// room, and the description must fit (404 or 422), then the file is read by its first bytes and held to the size limits (400), and only then is it sent to
/// the storage under a random id (D-01). The photo row is saved through the order's row lock with one <c>order-image.added</c> entry
/// that names the order number and the photo's place, never its id or address (D-19). A save that loses a race is read again and
/// decided again once. The client file name and content type never shape the stored id.
/// </summary>
public sealed class UploadOrderImageHandler(
    IOrders orders,
    IOrderReader reader,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IImageStorage storage,
    ImageUploadSettings settings)
{
    /// <summary>Uploads the photo.</summary>
    /// <param name="orderId">The order to add the photo to.</param>
    /// <param name="request">The file and the optional description.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 when there is no file, the file is not a photo we can use, is too large or too big, or the description is too long, a 401 when the
    /// token names no usable account, a 404 when the order does not exist or was deleted, a 409 when two saves lost a race twice, a 422
    /// when the order is completed or cancelled or already has 5 photos, or a 503 when photo storage is not set up or did not take the file.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid orderId, UploadOrderImageRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        if (!storage.IsConfigured)
        {
            return Result.Failure<OrderDetailResponse>(ImageErrors.NotConfigured);
        }

        if (request.Bytes.IsEmpty)
        {
            return Result.Failure<OrderDetailResponse>(ImageErrors.FileMissing);
        }

        var precheck = await orders.FindAsync(orderId, includeDeleted: false, cancellationToken).ConfigureAwait(false);
        if (precheck is null)
        {
            return Result.Failure<OrderDetailResponse>(OrderErrors.NotFound);
        }

        var refused = precheck.CheckCanAddImage() ?? OrderImageRules.CheckDescription(request.Description);
        if (refused is not null)
        {
            return Result.Failure<OrderDetailResponse>(refused);
        }

        var inspected = ImageInspection.Check(request.Bytes, request.FileName, settings);
        if (inspected.IsFailure)
        {
            return Result.Failure<OrderDetailResponse>(inspected.Error);
        }

        var facts = inspected.Value;

        var publicId = PublicIds.New(storage.RootFolder, orderId);
        var stored = await storage.UploadAsync(new ImageUpload(publicId, PublicIds.Folder(storage.RootFolder, orderId), request.Bytes, facts.Kind), cancellationToken).ConfigureAwait(false);
        if (!stored.Succeeded)
        {
            return Result.Failure<OrderDetailResponse>(ImageErrors.StorageFailed);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var photo = new NewOrderImage(publicId, facts.UprightWidth, facts.UprightHeight, request.Bytes.Length, ImageKinds.Key(facts.Kind), request.Description);
        var outcome = await ConflictRetry.RunAsync(
            () => OrderChildWrite.AttemptAsync(
                orders,
                audit,
                unitOfWork,
                orderId,
                version: null,
                (order, _) =>
                {
                    var added = order.AddImage(photo, clock.UtcNow);
                    return Task.FromResult(added.IsFailure
                        ? Result.Failure<OrderChildAudit?>(added.Error)
                        : Result.Success<OrderChildAudit?>(new OrderChildAudit(AuditActions.OrderImageAdded, OrderAuditDetail.ImageAdded(order, added.Value))));
                },
                cancellationToken),
            Result.Failure<bool>(EditErrors.Stale)).ConfigureAwait(false);
        return outcome.IsFailure
            ? Result.Failure<OrderDetailResponse>(outcome.Error)
            : await OrderChildWrite.ReadAsync(reader, orderId, cancellationToken).ConfigureAwait(false);
    }
}

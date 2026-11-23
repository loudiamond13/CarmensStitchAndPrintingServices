using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.QuoteRequests;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Use case: staff of either role open one quote request (INQ-05, D-13). Photo addresses are built here by the private delivery
/// (D-36), so the browser never builds one and never sees a storage id.
/// </summary>
public sealed class GetQuoteRequestHandler(IQuoteRequestReader reader, IImageDelivery imageDelivery, IRequestContext requestContext)
{
    /// <summary>Reads one request.</summary>
    /// <param name="id">The request id.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The request, a 404 when it does not exist, or a 401 when the token names no usable account.</returns>
    public async Task<Result<QuoteRequestDetailResponse>> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure<QuoteRequestDetailResponse>(AuthErrors.SessionEnded);
        }

        return await ReadAsync(reader, imageDelivery, id, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Reads and maps one request.</summary>
    /// <param name="reader">The reader.</param>
    /// <param name="imageDelivery">The photo address builder.</param>
    /// <param name="id">The request id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The request, or a 404 when it is gone.</returns>
    private static async Task<Result<QuoteRequestDetailResponse>> ReadAsync(
        IQuoteRequestReader reader, IImageDelivery imageDelivery, Guid id, CancellationToken cancellationToken)
    {
        var view = await reader.GetDetailAsync(id, cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<QuoteRequestDetailResponse>(QuoteRequestErrors.NotFound)
            : Result.Success(ToResponse(view, imageDelivery));
    }

    private static QuoteRequestDetailResponse ToResponse(QuoteRequestDetailView view, IImageDelivery imageDelivery)
    {
        var photos = new List<QuoteRequestPhotoResponse>();
        var missing = new List<string>();
        foreach (var place in view.Photos)
        {
            if (place is { PublicId: { } publicId, Width: { } width, Height: { } height })
            {
                var urls = imageDelivery.ForPhoto(publicId, width, height);
                photos.Add(new QuoteRequestPhotoResponse(
                    place.Slot,
                    place.FileName,
                    width,
                    height,
                    new ImageSourceResponse(urls.Thumb.Src, urls.Thumb.SrcSet),
                    new ImageSourceResponse(urls.Viewer.Src, urls.Viewer.SrcSet),
                    urls.FullSize));
            }
            else
            {
                missing.Add(place.FileName);
            }
        }

        List<QuoteRequestStatusChangeResponse> history =
        [
            .. view.History.Select(row => new QuoteRequestStatusChangeResponse(
                QuoteRequestStatusNames.ToKey(row.From),
                QuoteRequestStatusNames.ToKey(row.To),
                row.ChangedBy,
                row.ChangedAtUtc)),
            new(null, QuoteRequestStatusNames.ToKey(QuoteRequestStatus.New), null, view.ReceivedAtUtc),
        ];

        return new QuoteRequestDetailResponse(
            view.Id,
            view.ReceivedAtUtc,
            view.CustomerName,
            view.TeamName,
            PhilippinePhone.TryParse(view.ContactNumberE164, out var phone) ? phone.Display : view.ContactNumberE164,
            view.Email,
            view.ProductChoice is { } choice ? new QuoteRequestProduct(QuoteProductChoiceNames.ToKey(choice), view.ProductTitle) : null,
            view.QuantityRange is { } range ? QuoteQuantityRangeNames.ToKey(range) : null,
            view.Message,
            QuoteRequestStatusNames.ToKey(view.Status),
            view.StatusChangedAtUtc,
            view.Photos.Count,
            photos,
            missing,
            view.PhotosRemovedAtUtc,
            history,
            [.. view.Notes.Select(static note => new QuoteRequestNoteResponse(note.Id, note.Text, note.CreatedBy, note.CreatedAtUtc))],
            view.LastChangedBy,
            view.LastChangedAtUtc,
            RowVersions.ToText(view.RowVersion));
    }
}

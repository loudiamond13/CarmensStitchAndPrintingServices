using Csps.Application.Orders;
using Csps.Application.Users;

namespace Csps.Application.QuoteRequests;

/// <summary>One stored photo of a quote request (INQ-05, D-36). The addresses are built when the request is read and are never stored.</summary>
/// <param name="Slot">The place, from 0.</param>
/// <param name="FileName">The file name the visitor declared.</param>
/// <param name="Width">The width in pixels, as the photo is shown upright.</param>
/// <param name="Height">The height in pixels, as the photo is shown upright.</param>
/// <param name="Thumb">The tile thumb, with a 2x candidate.</param>
/// <param name="Viewer">The whole photo for the viewer, with width candidates.</param>
/// <param name="FullSize">The address of the 2000 px JPEG behind "Open Full Size".</param>
public sealed record QuoteRequestPhotoResponse(
    int Slot,
    string FileName,
    int Width,
    int Height,
    ImageSourceResponse Thumb,
    ImageSourceResponse Viewer,
    string FullSize);

/// <summary>One row of the status history (D-15). The last row is the arrival: from null to new, by nobody (SEC-08).</summary>
/// <param name="From">The status the request left; null for the arrival.</param>
/// <param name="To">The status the request entered.</param>
/// <param name="ChangedBy">Who moved it; null for the arrival or a system move.</param>
/// <param name="ChangedAt">When it moved.</param>
public sealed record QuoteRequestStatusChangeResponse(string? From, string To, ActorRef? ChangedBy, DateTimeOffset ChangedAt);

/// <summary>One quote request in full for staff (INQ-05, D-13).</summary>
/// <param name="Id">The request id.</param>
/// <param name="ReceivedAtUtc">When the request was received, in UTC.</param>
/// <param name="CustomerName">The visitor's name.</param>
/// <param name="TeamName">The team or organization; null when none.</param>
/// <param name="ContactNumber">The mobile number in its display form, such as <c>0917 123 4567</c>.</param>
/// <param name="Email">The email address; null when none.</param>
/// <param name="Product">What the visitor chose; null when nothing was chosen.</param>
/// <param name="Quantity">The estimated quantity key such as <c>21-50</c>; null when none was chosen.</param>
/// <param name="Message">What the visitor wrote; null when nothing.</param>
/// <param name="Status">The status key: new, contacted, quoted, converted, closed or spam.</param>
/// <param name="StatusChangedAtUtc">When the status last changed.</param>
/// <param name="PhotoCount">How many photo places the request holds.</param>
/// <param name="Photos">The photos that arrived, in slot order.</param>
/// <param name="MissingPhotos">The file names of the photos that never arrived (D-03), in slot order.</param>
/// <param name="PhotosRemovedAtUtc">When the photos were removed because the request was marked Spam (D-04); null while kept.</param>
/// <param name="History">The status history, newest first, ending with the arrival.</param>
/// <param name="LastChangedBy">Who last changed the request; null when nobody has.</param>
/// <param name="LastChangedAt">When the request was last changed; null when never.</param>
/// <param name="Version">The row version to send with a status change.</param>
public sealed record QuoteRequestDetailResponse(
    Guid Id,
    DateTimeOffset ReceivedAtUtc,
    string CustomerName,
    string? TeamName,
    string ContactNumber,
    string? Email,
    QuoteRequestProduct? Product,
    string? Quantity,
    string? Message,
    string Status,
    DateTimeOffset StatusChangedAtUtc,
    int PhotoCount,
    IReadOnlyList<QuoteRequestPhotoResponse> Photos,
    IReadOnlyList<string> MissingPhotos,
    DateTimeOffset? PhotosRemovedAtUtc,
    IReadOnlyList<QuoteRequestStatusChangeResponse> History,
    ActorRef? LastChangedBy,
    DateTimeOffset? LastChangedAt,
    string Version);

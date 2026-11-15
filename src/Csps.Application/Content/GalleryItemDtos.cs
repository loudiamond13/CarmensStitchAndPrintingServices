using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>One gallery item as the Manager's Gallery tab reads it (GAL-03, D-10).</summary>
/// <param name="Id">The gallery entry id.</param>
/// <param name="Kind"><c>order</c> or <c>upload</c>.</param>
/// <param name="Name">The name shown.</param>
/// <param name="LineId">The line the item is filed under; null when an order has none.</param>
/// <param name="LineShortName">The line's short name; null when there is no line.</param>
/// <param name="LineHidden">True when the line is hidden, so the item is off the public site.</param>
/// <param name="Pieces">The pieces; null for an upload that gives none.</param>
/// <param name="IsShown">True while the item can show on the website; always true for an order item, which is listed while it is shown.</param>
/// <param name="OrderId">The order of an order item; null on an upload.</param>
/// <param name="OrderNumber">The number of an order item; null on an upload.</param>
/// <param name="Note">The note of an upload; null when none.</param>
/// <param name="Thumb">The address of the small square photo; null when there is none.</param>
/// <param name="Version">The text an edit of an upload must send back; null on an order item.</param>
public sealed record GalleryItemRowDto(
    Guid Id,
    string Kind,
    string Name,
    Guid? LineId,
    string? LineShortName,
    bool LineHidden,
    int? Pieces,
    bool IsShown,
    Guid? OrderId,
    string? OrderNumber,
    string? Note,
    string? Thumb,
    string? Version)
{
    /// <summary>The kind word of an order item.</summary>
    public const string OrderKind = "order";

    /// <summary>The kind word of an upload.</summary>
    public const string UploadKind = "upload";

    /// <summary>Maps one row to the DTO (manual mapping, PRD section 3.3). The delivery port makes the thumb address.</summary>
    /// <param name="row">The row.</param>
    /// <param name="delivery">Makes the address.</param>
    /// <returns>The DTO.</returns>
    public static GalleryItemRowDto From(GalleryItemRow row, IImageDelivery delivery)
    {
        ArgumentNullException.ThrowIfNull(row);
        ArgumentNullException.ThrowIfNull(delivery);

        var upload = row.Kind == GalleryEntryKind.Upload;
        string? thumb = null;
        if (row.PhotoPublicId is not null && row.PhotoWidth is { } width && row.PhotoHeight is { } height)
        {
            var address = delivery.ForGallery(row.PhotoPublicId, width, height).Thumb;
            thumb = string.IsNullOrEmpty(address) ? null : address;
        }

        return new GalleryItemRowDto(
            row.Id,
            upload ? UploadKind : OrderKind,
            row.Name,
            row.LineId,
            row.LineShortName,
            row.LineHidden,
            row.Pieces,
            row.IsShown,
            row.OrderId,
            row.OrderNumber,
            row.Note,
            thumb,
            upload ? RowVersions.ToText(row.RowVersion) : null);
    }
}

/// <summary>One page of the Manager's gallery list.</summary>
/// <param name="Rows">The rows of the page, in gallery order.</param>
/// <param name="Total">How many items match the filter over every page.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="Size">The page size.</param>
public sealed record GalleryItemListDto(IReadOnlyList<GalleryItemRowDto> Rows, int Total, int Page, int Size);

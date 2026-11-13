using Csps.Domain.Content;

namespace Csps.Application.Ports;

/// <summary>
/// One item of the Manager's gallery list: a shown order or an upload (D-10, GAL-03). The line is the one the item is filed under, the
/// staff choice or the auto line for an order. The photo fields name the cover or the upload's photo; no address is made here.
/// </summary>
/// <param name="Id">The gallery entry id.</param>
/// <param name="Kind">An order or an upload.</param>
/// <param name="Position">The place in the gallery order.</param>
/// <param name="Name">The name shown: the public name or team of an order, the team or name of an upload.</param>
/// <param name="LineId">The line the item is filed under; null when an order has none.</param>
/// <param name="LineShortName">The line's short name; null when there is no line.</param>
/// <param name="LineHidden">True when the line is hidden, so the item is off the public site (D-08).</param>
/// <param name="Pieces">The pieces; null for an upload that gives none.</param>
/// <param name="IsShown">True while the item can show on the website.</param>
/// <param name="OrderId">The order of an order item; null on an upload.</param>
/// <param name="OrderNumber">The number of an order item; null on an upload.</param>
/// <param name="Note">The note of an upload; null otherwise.</param>
/// <param name="PhotoPublicId">The stored id of the cover or upload photo; null when an order has no photo.</param>
/// <param name="PhotoWidth">The photo's upright width in pixels.</param>
/// <param name="PhotoHeight">The photo's upright height in pixels.</param>
/// <param name="RowVersion">The version of an upload's entry, which an edit sends back; empty on an order item.</param>
public sealed record GalleryItemRow(
    Guid Id,
    GalleryEntryKind Kind,
    int Position,
    string Name,
    Guid? LineId,
    string? LineShortName,
    bool LineHidden,
    int? Pieces,
    bool IsShown,
    Guid? OrderId,
    string? OrderNumber,
    string? Note,
    string? PhotoPublicId,
    int? PhotoWidth,
    int? PhotoHeight,
    byte[] RowVersion);

/// <summary>One place in the gallery order as a move sees it: only what is needed to find a neighbour and to name the item in the audit entry.</summary>
/// <param name="Id">The gallery entry id.</param>
/// <param name="Kind">An order or an upload.</param>
/// <param name="Name">The name shown, which is public.</param>
/// <param name="LineId">The line the item is filed under; null when an order has none.</param>
public sealed record GalleryOrderRef(Guid Id, GalleryEntryKind Kind, string Name, Guid? LineId);

/// <summary>One page of the Manager's gallery list.</summary>
/// <param name="Rows">The rows of the page, in gallery order.</param>
/// <param name="Total">How many items match the filter over every page.</param>
public sealed record GalleryItemPage(IReadOnlyList<GalleryItemRow> Rows, int Total);
